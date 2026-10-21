// Gente que no es de la colonia y lo que trae el narrador: supervivientes que piden unirse,
// raids de saqueadores (combate cuerpo a cuerpo, huida, heridos que se pueden capturar),
// prisioneros (retener, convencer, liberar) y caravanas de comerciantes (con esclavos).
import { RESOURCE_ICONS, RESOURCES, ResourceId } from '../data/resources';
import { personValue, RESOURCE_VALUES } from '../data/values';
import { ammoFor, damageAt, GRENADE, isGear, RAIDER_AMMO, raiderWeaponPool, WEAPONS, WeaponDef } from '../data/weapons';
import { armorProtection, isArmor, raiderVestPool } from '../data/armor';
import { MEDICINE_STOCK } from '../data/medicine';
import { CREATURES, CreatureId, flies, isMachine, MACHINES, PACKS, TAMING } from '../data/creatures';
import type { Colonist } from './colonist';
import type { Structure } from './structures';
import { BODY_PARTS, healthLabel, hurt } from './health';
import { findPath, flightPath, Point } from './pathfinding';
import { BLOCK_SOLID, inBounds, isPassable, isWater, Prop, PROP_INFO, RADIATION_THRESHOLD, Terrain, TERRAIN_INFO } from './map';
import { absorbHit, besideTiles, fits, nearRaft, nextTo, occupant, raftLanding, riders, VEHICLE_SIZE } from './vehicles';
import { RAIDER_RAFT, RAIDER_VEHICLE, vehicleDef } from '../data/vehicles';
import { DIFFICULTIES, RADIO_GAP_DAYS, raidGap, raidSize, TRADER_GAP, WANDERER_GAP } from './storyteller';
import type { World } from './world';
import { maybePanic, witnessFall } from './panic';
import { tryThrowGrenade } from './grenades';
import { mortarManned, mortarShots } from './mortar';
import { TICKS_PER_DAY } from './time';
import { ALLY_HELP, factionDef, RADIO, RAIDER_FACTION, RELATION, TRADER_FACTION, TRIBUTE, WAR } from '../data/factions';
import { isResearched } from './research';
import { reachFactor } from './events';
import { MARKET } from '../data/market';
import { marketTrade, marketValue } from './market';
import { Rng } from './rng';
import { researchDef } from '../data/research';
import { giftPoints } from './factions';
import { enrage, makeAnimal, tameAnimal, updateAnimal } from './animals';
import { enrichBase } from './worldmap';
import { ignite } from './fire';
export { canTalk, TALK_HOURS } from './jobs';

/** Ticks entre golpes. */
export const ATTACK_COOLDOWN = 45;
/** Distancia (casillas) a la que un colono reclutado va a por un enemigo. */
export const ENGAGE_RANGE = 10;

const hostile = (c: Colonist) => c.role === 'saqueador' && !c.downed && !c.raider?.fleeing;

/** Cómo se nombra a un enemigo en el diario: «Rata (saqueador)» o «Perro mutante 2». */
export function foeLabel(c: Colonist): string {
  return c.creature ? c.name : `${c.name} (saqueador)`;
}

/**
 * Daño a quien no es de la colonia ni colono: a los saqueadores se les derriba sin matarlos (luego se
 * elige capturarlos o rematarlos, #22); una criatura tiene su propia vida y al caer muere.
 * Devuelve true si acaba de caer (o de morir).
 */
export function hurtFoe(w: World, b: Colonist, dmg: number, part: string): boolean {
  const wasDown = b.downed;
  if (b.creature) {
    // La armadura de una máquina (la araña de chatarra, −40 %) le quita parte de cualquier daño.
    const def = CREATURES[b.creature];
    hurt(b, (dmg * (1 - (def.armor ?? 0))) / def.health, part);
    if (b.downed && w.others.includes(b)) w.killPawn(b, 'abatido', true);
    return !wasDown && b.downed;
  }
  hurt(b, dmg, part, b.role === 'saqueador');
  return !wasDown && b.downed;
}

/** Valor de lo que tiene la colonia (para el tamaño de los raids). */
export function colonyWealth(w: World): number {
  const inv = w.inventory();
  let v = RESOURCES.reduce((a, r) => a + inv[r] * RESOURCE_VALUES[r], 0);
  for (const s of w.structures.all()) {
    if (!s.built) continue;
    for (const [r, n] of Object.entries(w.structures.costOf(s)) as [ResourceId, number][]) v += n * RESOURCE_VALUES[r];
  }
  return v;
}

// --- Narrador ---------------------------------------------------------------------

export function runStoryteller(w: World): void {
  const sch = w.schedule;
  const days = (gap: [number, number]) => w.rng.int(Math.round(gap[0] * TICKS_PER_DAY), Math.round(gap[1] * TICKS_PER_DAY));
  const diff = DIFFICULTIES[w.difficulty.level];
  if (w.offer && w.tick > w.offer.until) w.rejectOffer();
  if (w.gameOver) return;
  if (w.tick >= sch.nextWanderer) {
    sch.nextWanderer = w.tick + days(WANDERER_GAP);
    if (!w.offer) offerWanderer(w);
  }
  // Radio de llamada (#21 C): mientras haya una con corriente, atrae un superviviente más cada 3 días.
  if (w.radioOn()) {
    if (sch.nextRadio === undefined) sch.nextRadio = w.tick + Math.round(RADIO_GAP_DAYS * TICKS_PER_DAY);
    else if (w.tick >= sch.nextRadio) {
      // Si hay otro esperando respuesta, lo intenta a la hora siguiente.
      if (!w.offer) {
        offerWanderer(w, true);
        sch.nextRadio = w.tick + Math.round(RADIO_GAP_DAYS * TICKS_PER_DAY);
      }
    }
  } else sch.nextRadio = undefined;
  if (w.tick >= sch.nextRaid) {
    sch.nextRaid = w.tick + days(raidGap(w.difficulty.level));
    // Máquinas (bloque 6 del catálogo): desde el día 30, 1 de cada 4 ataques es de máquinas.
    // Mutantes (bloque 2 del catálogo): desde el día 8, 1 de cada 3 raids es una manada de perros
    // (1 de cada 2 si la colonia está cerca de una zona irradiada).
    if (w.day >= MACHINES.fromDay && w.rng.chance(1 / MACHINES.every)) {
      startMachines(w, w.rng.int(MACHINES.spiders[0], MACHINES.spiders[1]), w.rng.int(MACHINES.drones[0], MACHINES.drones[1]));
    }
    else if (w.day >= CREATURES.perro_mutante.fromDay && w.rng.chance(1 / packOdds(w))) startPack(w, packSize(w));
    // Tributo (bloque 7): desde el día 10, 1 de cada 3 raids de saqueadores empieza pidiendo recursos.
    else if (w.day >= TRIBUTE.fromDay && !w.tribute && w.rng.chance(1 / TRIBUTE.every) && demandTribute(w)) { /* espera respuesta */ }
    else startRaid(w, raidSize(w.day, colonyWealth(w), w.colonists.length, diff.raidScale), undefined, undefined, raidFaction(w));
    // Facciones aliadas (60 o más): si os atacan, mandan combatientes (una vez cada 10 días).
    if (w.factions.some((f) => f.relation >= RELATION.ally)) sendAllies(w);
  }
  warRaids(w, days);
  // Sin respuesta al tributo a tiempo: cuenta como negarse.
  if (w.tribute && w.tick > w.tribute.until) refuseTribute(w);
  if (w.tick >= sch.nextTrader) {
    sch.nextTrader = w.tick + days(TRADER_GAP);
    if (!w.others.some((o) => o.role === 'comerciante')) startTrader(w);
  }
}

/** Un superviviente pide unirse (el jugador decide). */
export function offerWanderer(w: World, byRadio = false): void {
  const c = w.makePawn('colono');
  w.offer = { kind: 'superviviente', pawn: c, until: w.tick + TICKS_PER_DAY / 2 };
  w.addLog(`🚶 ${c.name} «${c.nickname}», ${c.age} años, ${byRadio ? 'ha oído la 📻 radio y ' : ''}pide unirse a la colonia.`, 'info', 'visita');
}

/**
 * Pone el buggy de los saqueadores junto al primero y sube a dos: el conductor y el tirador (el líder
 * ★ prefiere ir a pie). false si no cabe.
 */
function raiderBuggy(w: World, raid: Colonist[], defId: string): boolean {
  const t = (raid.find((r) => !r.vehicle) ?? raid[0]).tile;
  let anchor: Point | null = null;
  for (let r = 0; r <= 3 && !anchor; r++) {
    for (let dy = -r; dy <= r && !anchor; dy++) {
      for (let dx = -r; dx <= r && !anchor; dx++) {
        const x = Math.max(0, Math.min(w.map.width - VEHICLE_SIZE, t.x + dx));
        const y = Math.max(0, Math.min(w.map.height - VEHICLE_SIZE, t.y + dy));
        if ([0, 1].every((ox) => [0, 1].every((oy) => isPassable(w.map, x + ox, y + oy)))) anchor = { x, y };
      }
    }
  }
  if (!anchor) return false;
  const v = w.addVehicle(defId, anchor.x, anchor.y);
  // Lo traen lleno (y no gasta).
  v.fuel = vehicleDef(defId)!.fuelCapacity;
  const free = raid.filter((r) => !r.vehicle);
  if (free.length < 2) return false;
  const crew = [...free.filter((r) => !r.raider?.leader), ...free.filter((r) => r.raider?.leader)].slice(0, 2);
  crew.forEach((c, i) => {
    c.vehicle = { id: v.id, seat: i === 0 ? 'conductor' : 'tirador', boarded: true };
    c.tile = { x: anchor!.x + 1, y: anchor!.y + 1 };
    c.pos = { x: anchor!.x + 1, y: anchor!.y + 1 };
    c.path = [];
  });
  return true;
}

/**
 * Lo que piden de tributo: de los recursos de la colonia que más valen en total (ni armas ni
 * armaduras), hasta unas 200 chapas. null si la colonia no tiene tanto.
 */
export function tributeDemand(w: World): { demand: Partial<Record<ResourceId, number>>; value: number } | null {
  const inv = w.inventory();
  const pool = RESOURCES.filter((r) => inv[r] > 0 && !isGear(r) && !isArmor(r) && !r.startsWith('kit_'))
    .sort((a, b) => inv[b] * RESOURCE_VALUES[b] - inv[a] * RESOURCE_VALUES[a]);
  const demand: Partial<Record<ResourceId, number>> = {};
  let value = 0;
  for (const r of pool.slice(0, 3)) {
    if (value >= TRIBUTE.value) break;
    const n = Math.min(inv[r], Math.ceil((TRIBUTE.value - value) / RESOURCE_VALUES[r]));
    if (n <= 0) continue;
    demand[r] = n;
    value += n * RESOURCE_VALUES[r];
  }
  return value >= TRIBUTE.value ? { demand, value: Math.round(value) } : null;
}

/** Los Piratas del Óxido piden tributo en vez de atacar. false si la colonia no tiene con qué pagar. */
export function demandTribute(w: World): boolean {
  const ask = tributeDemand(w);
  const def = factionDef(RAIDER_FACTION);
  if (!ask || !def) return false;
  w.tribute = { faction: RAIDER_FACTION, demand: ask.demand, value: ask.value, until: w.tick + Math.round(TRIBUTE.hours * TICKS_PER_DAY / 24) };
  const list = (Object.entries(ask.demand) as [ResourceId, number][]).map(([r, n]) => `${n} ${RESOURCE_ICONS[r]}`).join(', ');
  w.addLog(`${def.icon} ${def.name} piden tributo: ${list} (unas ${ask.value} chapas). Si pagáis, no atacan; si no, llega su raid.`, 'malo', 'raid');
  return true;
}

/** Se paga el tributo: se lo llevan de los montones y no hay raid. false si ya no hay tanto. */
export function payTribute(w: World): boolean {
  const t = w.tribute;
  if (!t) return false;
  const inv = w.inventory();
  if ((Object.entries(t.demand) as [ResourceId, number][]).some(([r, n]) => inv[r] < n)) return false;
  for (const [r, n] of Object.entries(t.demand) as [ResourceId, number][]) takeFromStock(w, r, n);
  w.tribute = null;
  enrichBase(w, t.faction, t.value);
  const def = factionDef(t.faction);
  w.addLog(`${def?.icon ?? ''} Pagáis el tributo a ${def?.name ?? t.faction}: esta vez no atacan.`, 'info');
  return true;
}

/** No se paga: llega su raid (y, si su relación puede cambiar, baja). */
export function refuseTribute(w: World): void {
  const t = w.tribute;
  if (!t) return;
  w.tribute = null;
  w.changeRelation(t.faction, RELATION.refuseTribute, 'os negáis a pagar el tributo');
  const diff = DIFFICULTIES[w.difficulty.level];
  startRaid(w, raidSize(w.day, colonyWealth(w), w.colonists.length, diff.raidScale), undefined, undefined, t.faction);
}

/** Quita `n` de un recurso de los montones de la colonia. */
function takeFromStock(w: World, r: ResourceId, n: number): void {
  let left = n;
  for (const s of w.items.list()) {
    if (left <= 0) break;
    if (s.resource !== r) continue;
    const got = w.items.take(s.x, s.y, left);
    if (got) left -= got.amount;
  }
}

/**
 * De quién son los raids normales: de los Piratas del Óxido; si ya no existen, de otra facción
 * siempre hostil (el Culto del Reactor…), y si no queda ninguna, de sus restos (siguen llegando).
 */
export function raidFaction(w: World): string {
  if (w.faction(RAIDER_FACTION)) return RAIDER_FACTION;
  return w.factions.find((f) => factionDef(f.id)?.fixed)?.id ?? RAIDER_FACTION;
}

/**
 * Guerra (bloque 7): una facción con −50 o menos de relación manda sus propios raids además de los
 * normales; el primero, a los 2 días, y luego tan a menudo como los normales. Los Piratas del Óxido
 * ya son los de los raids normales.
 */
function warRaids(w: World, days: (gap: [number, number]) => number): void {
  const diff = DIFFICULTIES[w.difficulty.level];
  for (const f of w.factions) {
    if (f.id === RAIDER_FACTION || f.id === raidFaction(w) || f.relation > RELATION.war) {
      f.warRaidAt = undefined;
      continue;
    }
    if (f.warRaidAt === undefined) f.warRaidAt = w.tick + Math.round(WAR.firstRaidDays * TICKS_PER_DAY);
    else if (w.tick >= f.warRaidAt) {
      f.warRaidAt = w.tick + days(raidGap(w.difficulty.level));
      startRaid(w, raidSize(w.day, colonyWealth(w), w.colonists.length, diff.raidScale), undefined, undefined, f.id);
    }
  }
}

/**
 * Cada facción aliada (relación de 60 o más) que no haya ayudado en los últimos 10 días manda 2–4
 * combatientes armados que llegan por un borde, pelean con los atacantes y se van al acabar.
 * Devuelve los que llegan.
 */
export function sendAllies(w: World): Colonist[] {
  const out: Colonist[] = [];
  for (const f of w.factions) {
    const def = factionDef(f.id);
    if (!def || f.relation < RELATION.ally) continue;
    if (f.helpAt !== undefined && w.tick - f.helpAt < ALLY_HELP.everyDays * TICKS_PER_DAY) continue;
    const n = w.rng.int(ALLY_HELP.fighters[0], ALLY_HELP.fighters[1]);
    const pool = raiderWeaponPool(w.day);
    const group: Colonist[] = [];
    for (let i = 0; i < n; i++) {
      const a = w.makePawn('aliado');
      a.faction = f.id;
      if (i === 0) {
        if (!w.placeAtEdge(a)) break;
      } else {
        const spot = nearFree(w, group[0].tile) ?? group[0].tile;
        a.tile = { ...spot };
        a.pos = { x: spot.x + 0.5, y: spot.y + 0.5 };
      }
      a.skills.combate = Math.max(a.skills.combate, w.rng.int(5, 12));
      a.weapon = pool[w.rng.int(0, pool.length - 1)];
      a.ammo = ammoFor(a.weapon) ? RAIDER_AMMO : 0;
      group.push(a);
      w.others.push(a);
    }
    if (group.length === 0) continue;
    f.helpAt = w.tick;
    out.push(...group);
    w.addLog(`🤝 ${def.name} de ${f.settlement} mandan ${group.length} combatientes para ayudaros.`, 'bueno', 'visita', group[0].tile);
  }
  return out;
}

/** Por qué no se puede usar la radio para hablar con las facciones (null si se puede). */
export function radioProblem(w: World): string | null {
  if (!isResearched(w.research, RADIO.research)) return `Antes hay que investigar «${researchDef(RADIO.research)?.name ?? RADIO.research}» (📜 → 🔬 Investigación).`;
  if (!w.radioOn()) return 'Hace falta una 📻 radio de llamada construida y con corriente (🏗 → Electricidad).';
  return null;
}

/**
 * Llama por radio a una caravana de los Chatarreros: llega en unas 4 horas. Como mucho una vez cada
 * 3 días, y no si la relación es negativa. Devuelve el motivo si no se puede (null si se ha llamado).
 */
export function callCaravan(w: World): string | null {
  const why = radioProblem(w);
  if (why) return why;
  const f = w.faction(TRADER_FACTION);
  const def = factionDef(TRADER_FACTION);
  if (!f || !def) return 'No hay nadie a quien llamar.';
  if (f.relation < RADIO.caravanMinRelation) return `${def.name} no quieren comerciar con vosotros (relación ${f.relation}).`;
  if (f.calledAt !== undefined && w.tick - f.calledAt < RADIO.caravanEveryDays * TICKS_PER_DAY) {
    const left = Math.ceil((f.calledAt + RADIO.caravanEveryDays * TICKS_PER_DAY - w.tick) / (TICKS_PER_DAY / 24));
    return `Ya los habéis llamado hace poco: podréis volver a llamar en ${left} h.`;
  }
  if (w.others.some((o) => o.role === 'comerciante' && !o.trader?.leaving)) return 'Ya hay una caravana en la colonia.';
  f.calledAt = w.tick;
  w.schedule.nextTrader = Math.min(w.schedule.nextTrader, w.tick + Math.round(RADIO.caravanHours * TICKS_PER_DAY / 24));
  w.addLog(`📻 Llamáis por radio a ${def.name} de ${f.settlement}: su caravana llegará en unas ${RADIO.caravanHours} horas.`, 'info');
  return null;
}

/** Pide ayuda por radio a los aliados durante un ataque. Devuelve el motivo si nadie viene (null si viene alguien). */
export function callAllies(w: World): string | null {
  const why = radioProblem(w);
  if (why) return why;
  if (!underAttack(w)) return 'Solo se pide ayuda cuando os atacan.';
  if (!w.factions.some((f) => f.relation >= RELATION.ally)) return `Nadie es aliado vuestro: hace falta una relación de ${RELATION.ally} o más.`;
  const came = sendAllies(w);
  return came.length ? null : `Vuestros aliados ya os ayudaron hace poco (como mucho, una vez cada ${ALLY_HELP.everyDays} días).`;
}

/** Hay atacantes en pie que no huyen. */
function underAttack(w: World): boolean {
  return w.others.some(hostile);
}

/** Un aliado: va a por el atacante más cercano y pelea; sin atacantes, se vuelve a su asentamiento. */
function updateAlly(w: World, o: Colonist): void {
  if (!underAttack(w)) {
    goAway(w, o, '');
    return;
  }
  const foes = w.others.filter(hostile);
  const target = foes.sort((a, b) => Math.abs(a.tile.x - o.tile.x) + Math.abs(a.tile.y - o.tile.y) - (Math.abs(b.tile.x - o.tile.x) + Math.abs(b.tile.y - o.tile.y)))[0];
  if (canHit(w, o, target)) {
    o.path = [];
    o.activity = 'working';
    if (!o.attackCooldown) attack(w, o, target);
    return;
  }
  if (o.path.length === 0 || (w.tick + o.id) % 30 === 0) {
    const path = findPath(w.map, o.tile, target.tile, 20000);
    o.path = path ? path.slice(0, Math.max(1, path.length - 1)) : [];
  }
  o.activity = 'moving';
  if (o.path.length) w.moveAlongPath(o);
  else o.activity = 'idle';
}

/** Esquinas de agua en el borde del mapa donde cabe la balsa, de la más cercana a `home` a la más lejana. */
function edgeWaterAnchors(w: World, home: Point): Point[] {
  const def = RAIDER_RAFT!;
  const maxX = w.map.width - VEHICLE_SIZE;
  const maxY = w.map.height - VEHICLE_SIZE;
  const out: Point[] = [];
  for (let x = 0; x <= maxX; x++) for (const y of [0, maxY]) if (fits(w, x, y, def)) out.push({ x, y });
  for (let y = 1; y < maxY; y++) for (const x of [0, maxX]) if (fits(w, x, y, def)) out.push({ x, y });
  return out.sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y));
}

/**
 * Saqueadores en balsa (elegido por Mikel el 2026-10-21): 1 balsa por cada 3 saqueadores del raid,
 * con 2 dentro (uno rema y otro dispara), que entran por el río desde el borde. Solo si el río deja
 * remar hasta 15 casillas o menos de la colonia. Devuelve cuántos van en balsa.
 */
export function raiderRafts(w: World, raid: Colonist[]): number {
  const def = RAIDER_RAFT;
  const home = w.colonyPoint();
  if (!def?.raft || !home) return 0;
  const count = Math.floor(raid.length / def.raft.raidersPerRaft);
  if (count < 1) return 0;
  // La entrada del río más cercana desde la que se llega remando cerca de la colonia.
  let launch: Point | null = null;
  const tried: Point[] = [];
  for (const a of edgeWaterAnchors(w, home)) {
    if (tried.length >= 8) break;
    // Las de al lado de una ya probada van al mismo sitio.
    if (tried.some((t) => Math.abs(t.x - a.x) + Math.abs(t.y - a.y) <= 6)) continue;
    tried.push(a);
    const path = raftLanding(w, a, home, def);
    if (!path) continue;
    const end = path.length ? path[path.length - 1] : a;
    if (Math.hypot(end.x + 1 - home.x, end.y + 1 - home.y) <= def.raft.nearRiver) {
      launch = a;
      break;
    }
  }
  if (!launch) return 0;
  const crew = [...raid.filter((r) => !r.raider?.leader), ...raid.filter((r) => r.raider?.leader)];
  // Las balsas, una detrás de otra en el agua desde la entrada del río (sin pisarse).
  const spots: Point[] = [launch];
  const seen = new Set([launch.y * w.map.width + launch.x]);
  let placed = 0;
  for (let q = 0, i = 0; q < spots.length && q < 400 && i < count; q++) {
    const at = spots[q];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: at.x + dx, y: at.y + dy };
      const k = n.y * w.map.width + n.x;
      if (seen.has(k) || !fits(w, n.x, n.y, def)) continue;
      seen.add(k);
      spots.push(n);
    }
    if (w.vehicles.some((v) => Math.abs(v.x - at.x) < VEHICLE_SIZE && Math.abs(v.y - at.y) < VEHICLE_SIZE)) continue;
    const v = w.addVehicle(def.id, at.x, at.y);
    v.path = raftLanding(w, at, home, def) ?? [];
    crew.slice(i * 2, i * 2 + 2).forEach((c, k) => {
      c.vehicle = { id: v.id, seat: k === 0 ? 'conductor' : 'tirador', boarded: true };
      c.raider!.raft = v.id;
      c.tile = { x: at.x + 1, y: at.y + 1 };
      c.pos = { x: at.x + 1, y: at.y + 1 };
      c.path = [];
      placed++;
    });
    i++;
  }
  return placed;
}

/**
 * Llega un raid de `n` saqueadores por un mismo borde (`withBuggy`: fuerza que traigan o no buggy;
 * `withRaft`: que parte llegue o no en balsa por el río).
 */
export function startRaid(w: World, n: number, withBuggy?: boolean, withRaft?: boolean, faction = RAIDER_FACTION): Colonist[] {
  const out: Colonist[] = [];
  const first = w.makePawn('saqueador');
  if (!w.placeAtEdge(first)) return out;
  first.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
  out.push(first);
  for (let i = 1; i < n; i++) {
    const r = w.makePawn('saqueador');
    r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
    // Junto al primero.
    const spot = nearFree(w, first.tile) ?? first.tile;
    r.tile = { ...spot };
    r.pos = { x: spot.x + 0.5, y: spot.y + 0.5 };
    out.push(r);
  }
  // Armados según el día: palos y cuchillos al principio; tuberías, lanzas, arcos y pistolas más adelante;
  // escopetas y rifles desde el día 25; subfusiles y rifles de francotirador desde el día 35.
  const pool = raiderWeaponPool(w.day);
  for (const r of out) {
    r.faction = faction;
    r.skills.combate = Math.max(r.skills.combate, w.rng.int(3, 10));
    r.weapon = pool[w.rng.int(0, pool.length - 1)];
    r.ammo = ammoFor(r.weapon) ? RAIDER_AMMO : 0;
    const vests = raiderVestPool(w.day);
    if (vests.some((v) => v)) r.vest = vests[w.rng.int(0, vests.length - 1)];
    // Desde el día 30, alguno trae granadas (elegido por Mikel el 2026-10-20).
    if (w.day >= GRENADE.raiderFromDay && w.rng.chance(GRENADE.raiderChance)) r.grenades = GRENADE.raiderCarry;
    w.others.push(r);
  }
  // El de más Combate dirige el raid (★). Si cae él o la mitad del grupo, huyen todos.
  const leader = out.reduce((a, b) => (b.skills.combate > a.skills.combate ? b : a));
  leader.raider!.leader = true;
  for (const r of out) r.raider!.group = first.id;
  w.raidGroups.push({ id: first.id, size: out.length, leaderId: leader.id, escaped: [], routed: false });
  const lead = out.length > 1 ? `, con ${leader.name} ★ al frente` : '';
  // Desde el día 15, en 1 de cada 2 raids, parte del grupo llega en balsa por el río.
  const raftDef = RAIDER_RAFT;
  const raft = withRaft ?? (!!raftDef && w.day >= (raftDef.fromDay ?? 0) && w.rng.chance(raftDef.raidChance ?? 0));
  const byRaft = raft ? raiderRafts(w, out) : 0;
  const river = byRaft ? `, ${byRaft} por el río en 🛶 balsa` : '';
  // Desde el día 20, llegan en buggy (vehículos, tercera parte): dos van dentro, conductor y tirador.
  const def = RAIDER_VEHICLE;
  const buggy = withBuggy ?? (!!def && out.length - byRaft >= 2 && w.day >= (def.fromDay ?? 0) && w.rng.chance(def.raidChance ?? 0));
  const inBuggy = buggy && def ? raiderBuggy(w, out, def.id) : false;
  const how = inBuggy ? `, dos de ellos en un 🚙 ${def!.name.toLowerCase()}` : '';
  const fdef = faction !== RAIDER_FACTION ? factionDef(faction) : undefined;
  const who = fdef ? ` de ${fdef.name} (en guerra con la colonia)` : '';
  w.addLog(`⚔️ ¡Raid${who}! ${n} ${n === 1 ? 'saqueador llega' : 'saqueadores llegan'}${lead}${how}${river}. Recluta a los colonos (🎖) para defenderos.`, 'malo', 'raid', first.tile);
  return out;
}

/** 1 de cada cuántos raids es una manada: menos si la colonia está cerca de una zona irradiada. */
export function packOdds(w: World): number {
  return nearRadiation(w) ? PACKS.everyNearRadiation : PACKS.every;
}

/** ¿Hay una casilla irradiada a menos de `PACKS.radiationRange` casillas del centro de la colonia? */
export function nearRadiation(w: World): boolean {
  const home = w.colonyPoint();
  if (!home) return false;
  const m = w.map;
  const R = PACKS.radiationRange;
  for (let y = Math.max(0, home.y - R); y <= Math.min(m.height - 1, home.y + R); y++) {
    for (let x = Math.max(0, home.x - R); x <= Math.min(m.width - 1, home.x + R); x++) {
      if ((x - home.x) ** 2 + (y - home.y) ** 2 >= R * R) continue;
      const i = y * m.width + x;
      if (m.radiation[i] > RADIATION_THRESHOLD && !isWater(m.terrain[i] as Terrain)) return true;
    }
  }
  return false;
}

/**
 * Perros de una manada: entre 3 y 8, por la dureza de la partida. Equilibrio (2026-10-21): el máximo
 * crece con los días (3 el día del primer perro, uno más cada `growDays` días, hasta 8).
 */
export function packSize(w: World): number {
  const top = Math.min(PACKS.size[1], PACKS.size[0] + Math.max(0, Math.floor((w.day - CREATURES.perro_mutante.fromDay) / PACKS.growDays)));
  const n = w.rng.int(PACKS.size[0], top);
  return Math.max(2, Math.round(n * DIFFICULTIES[w.difficulty.level].raidScale));
}

/** Prepara a una persona nueva como criatura: sin rasgos, sin armas y con su nombre. */
export function makeCreature(w: World, c: Colonist, kind: CreatureId, n: number): void {
  c.role = 'saqueador';
  c.creature = kind;
  c.name = `${CREATURES[kind].name} ${n}`;
  c.nickname = '';
  c.traits = [];
  c.weapon = null;
  c.weaponChoice = 'ninguna';
  c.ammo = 0;
  c.vest = null;
  c.helmet = null;
  c.skills.combate = w.rng.int(4, 8);
  c.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
}

/** Brutos que trae una manada de `dogs` perros: desde el día 15, 1 por cada 3 perros. */
export function packBrutes(w: World, dogs: number): number {
  return w.day >= CREATURES.bruto_mutante.fromDay ? Math.floor(dogs / PACKS.dogsPerBrute) : 0;
}

/**
 * Llega una manada de `n` perros mutantes (y `brutes` brutos) por un mismo borde. Sin líder: huyen
 * al caer la mitad.
 */
export function startPack(w: World, n: number, brutes = packBrutes(w, n)): Colonist[] {
  const out: Colonist[] = [];
  const first = w.makePawn('saqueador');
  if (!w.placeAtEdge(first)) return out;
  const kinds: CreatureId[] = [...Array<CreatureId>(n).fill('perro_mutante'), ...Array<CreatureId>(brutes).fill('bruto_mutante')];
  const count: Partial<Record<CreatureId, number>> = {};
  kinds.forEach((kind, i) => {
    const c = i === 0 ? first : w.makePawn('saqueador');
    count[kind] = (count[kind] ?? 0) + 1;
    makeCreature(w, c, kind, count[kind]!);
    if (i > 0) {
      const spot = nearFree(w, first.tile) ?? first.tile;
      c.tile = { ...spot };
      c.pos = { x: spot.x + 0.5, y: spot.y + 0.5 };
    }
    c.raider!.group = first.id;
    out.push(c);
    w.others.push(c);
  });
  w.raidGroups.push({ id: first.id, size: out.length, leaderId: -1, escaped: [], routed: false });
  const dog = CREATURES.perro_mutante;
  const brute = CREATURES.bruto_mutante;
  const dogs = n === 1 ? dog.name.toLowerCase() : dog.plural;
  if (brutes > 0) {
    const big = brutes === 1 ? `un ${brute.name.toLowerCase()}` : `${brutes} ${brute.plural}`;
    w.addLog(`${dog.emoji}${brute.emoji} ¡Una manada de ${n} ${dogs} y ${big}! El bruto es lento pero muy duro y rompe muros y puertas. Recluta a los colonos (🎖).`, 'malo', 'raid', first.tile);
  } else {
    w.addLog(`${dog.emoji} ¡Una manada de ${n} ${dogs}! Son rápidos pero frágiles; no rompen muros ni puertas. Recluta a los colonos (🎖).`, 'malo', 'raid', first.tile);
  }
  return out;
}

/**
 * Llega un ataque de máquinas por un mismo borde: `spiders` arañas de chatarra y `drones` drones de
 * vigilancia. Sin moral: no huyen aunque caigan casi todas.
 */
export function startMachines(w: World, spiders: number, drones = 0): Colonist[] {
  const out: Colonist[] = [];
  const total = spiders + drones;
  if (total <= 0) return out;
  const first = w.makePawn('saqueador');
  if (!w.placeAtEdge(first)) return out;
  for (let i = 0; i < total; i++) {
    const c = i === 0 ? first : w.makePawn('saqueador');
    const kind: CreatureId = i < spiders ? 'arana_chatarra' : 'dron_vigilancia';
    makeCreature(w, c, kind, i < spiders ? i + 1 : i - spiders + 1);
    if (i > 0) {
      const spot = nearFree(w, first.tile) ?? first.tile;
      c.tile = { ...spot };
      c.pos = { x: spot.x + 0.5, y: spot.y + 0.5 };
    }
    c.raider!.group = first.id;
    out.push(c);
    w.others.push(c);
  }
  w.raidGroups.push({ id: first.id, size: out.length, leaderId: -1, escaped: [], routed: false });
  const spider = CREATURES.arana_chatarra;
  const drone = CREATURES.dron_vigilancia;
  const who: string[] = [];
  if (spiders > 0) who.push(spiders === 1 ? `una ${spider.name.toLowerCase()}` : `${spiders} ${spider.plural}`);
  if (drones > 0) who.push(drones === 1 ? `un ${drone.name.toLowerCase()}` : `${drones} ${drone.plural}`);
  const traits: string[] = [];
  if (spiders > 0) traits.push('las arañas, muy duras y blindadas, rompen muros');
  if (drones > 0) traits.push('los drones vuelan por encima de muros y zanjas y disparan');
  w.addLog(
    `${(spiders > 0 ? spider : drone).emoji} ¡Ataque de máquinas: ${who.join(' y ')}! No huyen; ${traits.join('; ')}. Las armas de fuego les hacen más daño. Recluta a los colonos (🎖).`,
    'malo', 'raid', first.tile,
  );
  return out;
}

/** Cómo cae una criatura: la máquina queda destrozada; el mutante, muerto. */
export function creatureFallText(c: Colonist): string {
  if (!isMachine(c.creature)) return `${c.name} cae muerto.`;
  return `${c.name} queda ${CREATURES[c.creature!].female ? 'destrozada' : 'destrozado'}.`;
}

/**
 * Coste de abrirse paso a golpes por una casilla para quien rompe muros (el bruto mutante): un muro,
 * puerta o portón terminado que corte el paso (o una puerta automática cerrada). Infinity si no se
 * puede: no hay nada que romper o, sin ello, la casilla tampoco se podría pisar (agua, acantilado…).
 */
export function breakCost(w: World, x: number, y: number, perHit: number): number {
  const m = w.map;
  if (!inBounds(m, x, y) || perHit <= 0) return Infinity;
  const i = y * m.width + x;
  if (m.blocked[i] !== BLOCK_SOLID && !w.shutDoors.has(i)) return Infinity;
  if (!TERRAIN_INFO[m.terrain[i] as Terrain].walkable || PROP_INFO[m.props[i] as Prop].blocks || m.cliff[i]) return Infinity;
  const s = w.structures.mainAt(x, y);
  if (!s || !s.built || !BREAKABLE.has(s.def.category)) return Infinity;
  // Cada golpe cuesta como andar unas casillas: prefiere rodear si el rodeo es corto.
  return 4 + 3 * Math.ceil(s.hp / perHit);
}

const BREAKABLE: ReadonlySet<string> = new Set(['muro', 'puerta', 'porton', 'granja']);

/** Un golpe de quien rompe muros a la construcción que le corta el paso. */
export function smashStructure(w: World, o: Colonist, s: Structure): void {
  const def = o.creature ? CREATURES[o.creature] : undefined;
  if (!def?.breaksWalls) return;
  o.attackCooldown = ATTACK_COOLDOWN;
  const dx = s.x + 0.5 - o.pos.x;
  if (Math.abs(dx) > 0.01) o.facing = dx > 0 ? 1 : -1;
  if (s.hp >= s.def.hp) w.addLog(`${def.emoji} ¡${o.name} está rompiendo ${articled(s.def.name)}!`, 'malo', 'combate', { x: s.x, y: s.y });
  s.hp -= def.wallDamage;
  if (s.hp <= 0) {
    w.breakStructure(s);
    w.addLog(`💥 ${o.name} ha roto ${articled(s.def.name)}.`, 'malo', 'combate', { x: s.x, y: s.y });
  }
}

/** «el muro de madera», «la puerta de chapa», «los sacos de arena». */
function articled(name: string): string {
  const low = name.charAt(0).toLowerCase() + name.slice(1);
  if (/^(pinchos|sacos)/i.test(name)) return `los ${low}`;
  return /^(puerta|empalizada|muralla|torre|barricada|mina|trampa)/i.test(name) ? `la ${low}` : `el ${low}`;
}

/** Llega una caravana: un comerciante con mercancía y, a veces, esclavos. */
export function startTrader(w: World): Colonist | null {
  const t = w.makePawn('comerciante');
  if (!w.placeAtEdge(t)) return null;
  const stock: Partial<Record<ResourceId, number>> = {};
  // Las caravanas todavía no venden armas, y el ⛽ solo sale de la destilería (decidido por Mikel).
  for (const r of RESOURCES) if (r !== 'combustible' && !isGear(r) && !isArmor(r) && !r.startsWith('kit_') && r !== 'abrigo' && w.rng.chance(0.5)) stock[r] = w.rng.int(10, 60);
  stock.componentes = w.rng.int(2, 10);
  // La medicina, en poca cantidad (si la trae).
  if (stock.medicina !== undefined) stock.medicina = w.rng.int(MEDICINE_STOCK[0], MEDICINE_STOCK[1]);
  const slaves: Colonist[] = [];
  const nSlaves = w.rng.int(0, 2);
  for (let i = 0; i < nSlaves; i++) slaves.push(w.makePawn('prisionero'));
  t.trader = { stock, slaves, leaveAt: w.tick + Math.round(TICKS_PER_DAY * 0.75), leaving: false };
  t.faction = caravanFaction(w);
  // Los Granjeros y los Nómadas traen mulas de carga (elegido por Mikel el 2026-10-21).
  if (t.faction === 'granjeros' || t.faction === 'nomadas') {
    const r = new Rng(((w.map.seed ^ 0x1f2e3d4c) + w.day * 0x27d4eb2d) >>> 0);
    t.trader.mules = r.int(TAMING.mulesForSale[0], TAMING.mulesForSale[1]);
  }
  caravanWants(w, t);
  w.others.push(t);
  const home = w.colonyPoint();
  const path = home ? findPath(w.map, t.tile, nearFree(w, home) ?? home, 60000) : null;
  if (path) t.path = path;
  const from = t.faction ? factionDef(t.faction) : undefined;
  const extras = [nSlaves ? `${nSlaves} ${nSlaves === 1 ? 'esclavo' : 'esclavos'}` : '', t.trader.mules ? `${t.trader.mules} ${t.trader.mules === 1 ? 'mula' : 'mulas'}` : ''].filter(Boolean);
  w.addLog(`🐫 Llega una caravana de ${t.name}${from ? ` (${from.icon} ${from.name})` : ''}${extras.length ? ` con ${extras.join(' y ')}` : ''}. Toca al comerciante para comerciar.`, 'bueno', 'caravana', t.tile);
  return t;
}

/**
 * De qué facción es la caravana que llega: de las que comercian (Chatarreros, Granjeros, Nómadas…)
 * y no están en guerra con la colonia; con su propio azar, sacado del día.
 */
export function caravanFaction(w: World, day = w.day): string {
  const ok = w.factions.filter((f) => MARKET.caravans[f.id] && f.relation > RELATION.war && !factionDef(f.id)?.fixed);
  if (!ok.length) return TRADER_FACTION;
  const r = new Rng(((w.map.seed ^ 0x7f4a7c15) + day * 0x9e3779b1) >>> 0);
  return ok[r.int(0, ok.length - 1)].id;
}

/** Azar de las necesidades de la caravana que llega ese día (el mismo antes y después de llegar). */
function caravanRng(w: World, day: number): Rng {
  return new Rng(((w.map.seed ^ 0x2c1b3c6d) + day * 0x85ebca6b) >>> 0);
}

/** Saca hasta `range` recursos distintos de `pool`. */
function pickSome(rng: Rng, pool: ResourceId[], range: [number, number]): ResourceId[] {
  const left = [...pool];
  const out: ResourceId[] = [];
  for (let n = rng.int(range[0], range[1]); n > 0 && left.length; n--) out.push(left.splice(rng.int(0, left.length - 1), 1)[0]);
  return out;
}

/**
 * Necesidades y sobrantes de una caravana (bloque 8), según su facción: 2–3 recursos que paga a
 * +50 % (y que no vende) y 2–3 de los que trae que rebaja un 30 %. Con su propio azar, sacado de la
 * semilla y del día (no toca el de la partida; así se pueden ver antes con «Rutas comerciales»).
 */
export function caravanWants(w: World, t: Colonist): void {
  const info = t.trader;
  const pools = t.faction ? MARKET.caravans[t.faction] : undefined;
  if (!info || !pools) return;
  const rng = caravanRng(w, w.day);
  info.needs = pickSome(rng, pools.needs, MARKET.needs);
  // Lo que necesita no lo vende; lo que le sobra tiene que traerlo.
  for (const r of info.needs) delete info.stock[r];
  info.surplus = pickSome(rng, pools.surplus.filter((r) => (info.stock[r] ?? 0) > 0 && !info.needs!.includes(r)), MARKET.surplus);
}

/** Lo que necesitará la próxima caravana (la que toca por el calendario), para verlo con «Rutas comerciales». */
export function nextCaravanNeeds(w: World): { day: number; needs: ResourceId[]; faction: string } | null {
  const at = w.schedule.nextTrader;
  if (!Number.isFinite(at)) return null;
  const day = w.dayOf(at);
  const faction = caravanFaction(w, day);
  const pools = MARKET.caravans[faction];
  if (!pools) return null;
  return { day, faction, needs: pickSome(caravanRng(w, day), pools.needs, MARKET.needs) };
}

/** Lo que cobra la caravana por una unidad: su precio de mercado, más su margen; lo que le sobra, −30 %. */
export function buyPrice(w: World, trader: Colonist, r: ResourceId): number {
  const surplus = trader.trader?.surplus?.includes(r) ? 1 - MARKET.surplusDiscount : 1;
  return marketValue(w.market, r) * TRADER_MARGIN * surplus;
}

/** Lo que paga la caravana por una unidad: su precio de mercado; lo que necesita, +50 %; lo que le sobra, −30 %. */
export function sellPrice(w: World, trader: Colonist, r: ResourceId): number {
  const t = trader.trader;
  const need = t?.needs?.includes(r) ? 1 + MARKET.needPremium : 1;
  const surplus = t?.surplus?.includes(r) ? 1 - MARKET.surplusDiscount : 1;
  return marketValue(w.market, r) * need * surplus;
}

function nearFree(w: World, p: Point): Point | null {
  for (let r = 1; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isPassable(w.map, p.x + dx, p.y + dy)) return { x: p.x + dx, y: p.y + dy };
      }
    }
  }
  return null;
}

// --- Combate ------------------------------------------------------------------------

/** Arma que puede usar ahora (un arco sin flechas o un arma de fuego sin balas no disparan: puños). */
export function usableWeapon(c: Colonist): WeaponDef | null {
  // El dron de vigilancia dispara con su arma (como una pistola) sin gastar munición.
  const gun = c.creature ? CREATURES[c.creature].gun : undefined;
  if (gun) return WEAPONS[gun as keyof typeof WEAPONS] ?? null;
  if (!c.weapon) return null;
  const def = WEAPONS[c.weapon];
  return def.ammo && c.ammo <= 0 ? null : def;
}

/** Está subido a una torre de vigía terminada. */
export function onTower(w: World, c: Colonist): boolean {
  const s = w.structures.mainAt(c.tile.x, c.tile.y);
  return !!s?.built && s.def.category === 'torre';
}

/** Casillas de alcance de una persona con lo que lleva (desde una torre, +2 a distancia). */
export function reachOf(c: Colonist, w?: World): number {
  const weapon = usableWeapon(c);
  const reach = weapon?.reach ?? 1;
  const base = weapon?.ammo && w && onTower(w, c) ? reach + TOWER_REACH : reach;
  // Con una tormenta de polvo, los disparos llegan a la mitad de lejos.
  return weapon?.ammo && w ? Math.max(1, Math.floor(base * reachFactor(w))) : base;
}

/** Distancia en casillas (en diagonal cuenta como una). */
export function tileDistance(a: Colonist, b: Colonist): number {
  return Math.max(Math.abs(a.tile.x - b.tile.x), Math.abs(a.tile.y - b.tile.y));
}

// --- Cobertura (números aprobados por Mikel) --------------------------------------------

/** Cobertura total: un muro impide el disparo. */
export const FULL_COVER = 1;
/** Alcance extra y acierto extra disparando desde una torre de vigía. */
export const TOWER_REACH = 2;
export const TOWER_AIM = 0.15;
/** Lo que quita al acierto estar dentro de una zanja. */
export const TRENCH_COVER = 0.25;

/** Cuánto protege lo que hay en una casilla (0 nada, 0,3 árbol o coche, 0,5 barricada o roca, 1 muro). */
export function coverValue(w: World, x: number, y: number): number {
  const m = w.map;
  if (!inBounds(m, x, y)) return 0;
  const s = w.structures.mainAt(x, y);
  if (s?.built) {
    const cat = s.def.category;
    // Un muro con aspilleras protege mucho, pero no del todo: por él se dispara.
    if (cat === 'muro' && s.def.loophole !== undefined) return s.def.loophole;
    if (cat === 'muro' || cat === 'puerta' || cat === 'porton') return FULL_COVER;
    if (cat === 'defensa' && s.def.height >= 1) return 0.5;
  }
  const i = y * m.width + x;
  if (m.terrain[i] === Terrain.Rock) return FULL_COVER;
  switch (m.props[i] as Prop) {
    case Prop.RuinWall:
      return FULL_COVER;
    case Prop.Boulder:
      return 0.5;
    case Prop.DeadTree:
    case Prop.CarWreck:
    case Prop.ScrapPile:
    case Prop.ToxicBarrel:
    case Prop.Tires:
      return 0.3;
    default:
      return 0;
  }
}

/**
 * Cobertura de quien está en `target` frente a un disparo desde `from`: cuenta lo que hay en la
 * casilla pegada al objetivo en dirección al tirador (y la zanja, si está dentro de una).
 */
export function coverAt(w: World, from: Point, target: Point): number {
  const ddx = from.x - target.x;
  const ddy = from.y - target.y;
  if (Math.max(Math.abs(ddx), Math.abs(ddy)) <= 1) return 0; // pegados: cuerpo a cuerpo
  // La casilla de al lado más cercana a la línea de tiro.
  const ax = Math.abs(ddx);
  const ay = Math.abs(ddy);
  const sx = ax >= ay / 2 ? Math.sign(ddx) : 0;
  const sy = ay >= ax / 2 ? Math.sign(ddy) : 0;
  const cover = coverValue(w, target.x + sx, target.y + sy);
  if (cover >= FULL_COVER) return FULL_COVER;
  const trench = inBounds(w.map, target.x, target.y) && w.map.trench[target.y * w.map.width + target.x] ? TRENCH_COVER : 0;
  return 1 - (1 - cover) * (1 - trench);
}

/**
 * Un muro (puerta, roca…) pegado al objetivo o pegado al tirador, en la línea de tiro, impide el
 * disparo; por un muro con aspilleras sí se dispara, desde los dos lados.
 */
export function shotBlocked(w: World, from: Point, target: Point): boolean {
  if (Math.max(Math.abs(from.x - target.x), Math.abs(from.y - target.y)) <= 1) return false;
  return coverAt(w, from, target) >= FULL_COVER || coverAt(w, target, from) >= FULL_COVER;
}

/** Puede golpear o disparar a `b` desde donde está: a su alcance y sin un muro en medio. */
export function canHit(w: World, a: Colonist, b: Colonist): boolean {
  const d = tileDistance(a, b);
  if (d <= 1) return true;
  if (d > reachOf(a, w)) return false;
  // Quien vuela (el dron) está por encima de los muros: lo que tiene pegado no le tapa el tiro.
  if (!flies(b.creature) && coverAt(w, a.tile, b.tile) >= FULL_COVER) return false;
  return flies(a.creature) || coverAt(w, b.tile, a.tile) < FULL_COVER;
}

/** Cobertura de `b` frente a un tiro desde `from`: a quien vuela no le cubre nada. */
export function coverOf(w: World, from: Point, b: Colonist): number {
  return flies(b.creature) ? 0 : coverAt(w, from, b.tile);
}

/** Un golpe (o un disparo, con arco o arma de fuego). Devuelve true si acierta. */
export function attack(w: World, a: Colonist, b: Colonist): boolean {
  const weapon = usableWeapon(a);
  fightAlert(w, a, b);
  a.attackCooldown = Math.round(ATTACK_COOLDOWN * (weapon?.cooldown ?? 1));
  const dx = b.pos.x - a.pos.x;
  if (Math.abs(dx) > 0.01) a.facing = dx > 0 ? 1 : -1;
  const dist = tileDistance(a, b);
  let hitChance = Math.min(0.95, 0.55 + a.skills.combate * 0.02);
  if (weapon?.ammo) {
    if (!a.creature) a.ammo--;
    // A distancia se acierta menos cuanto más lejos, y menos aún si el objetivo está a cubierto.
    hitChance = Math.max(0.2, hitChance * (1 - 0.06 * Math.max(0, dist - 1)));
    if (onTower(w, a)) hitChance = Math.min(0.98, hitChance + TOWER_AIM);
    hitChance *= 1 - Math.min(FULL_COVER, coverOf(w, a.tile, b));
  }
  if (!w.rng.chance(hitChance)) {
    // Fuego amigo: un disparo fallado puede dar a un colono en la línea de tiro junto al objetivo.
    if (weapon?.ammo) {
      const victim = strayVictim(w, a, b);
      if (victim && w.rng.chance(FRIENDLY_FIRE)) {
        w.addLog(`🎯 ${a.name} falla el disparo y le da a ${victim.name}.`, 'malo', 'herido', victim.tile);
        applyHit(w, a, victim, weapon);
      }
    }
    return false;
  }
  applyHit(w, a, b, weapon);
  // El lanzallamas prende fuego a la casilla del objetivo.
  if (weapon?.ignites) ignite(w, b.tile.x, b.tile.y);
  return true;
}

/** Aviso de pelea (#17, #18): un colono ataca o es atacado por un saqueador (uno por colono y hora). */
function fightAlert(w: World, a: Colonist, b: Colonist): void {
  if (a.role === 'colono' && b.role === 'saqueador') w.combatAlert(a, 'combate', `⚔️ ${a.name} está peleando con ${b.name}.`);
  else if (b.role === 'colono' && a.role === 'saqueador') w.combatAlert(b, 'combate', `⚔️ ${foeLabel(a)} ataca a ${b.name}.`);
}

/** Tics que espera un saqueador sin camino antes de volver a buscarlo. */
const NO_PATH_RETRY = 90;

/** Parte de los fallos a distancia que dan a un colono en la línea de tiro (número aprobado por Mikel). */
export const FRIENDLY_FIRE = 0.25;

/**
 * Colono que puede llevarse un disparo fallado de `a` a `b`: de pie, pegado al objetivo (a 1
 * casilla) y en la línea de tiro (por delante o por detrás del objetivo). El más cercano a la línea.
 */
export function strayVictim(w: World, a: Colonist, b: Colonist): Colonist | null {
  const dx = b.tile.x - a.tile.x;
  const dy = b.tile.y - a.tile.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  let best: { c: Colonist; off: number } | null = null;
  for (const c of w.pawns()) {
    if (c === a || c === b || c.role !== 'colono' || c.downed) continue;
    if (Math.max(Math.abs(c.tile.x - b.tile.x), Math.abs(c.tile.y - b.tile.y)) !== 1) continue;
    // Distancia de la casilla a la recta del disparo.
    const off = Math.abs((c.tile.x - a.tile.x) * dy - (c.tile.y - a.tile.y) * dx) / len;
    if (off > 0.75) continue;
    if (!best || off < best.off) best = { c, off };
  }
  return best?.c ?? null;
}

/** El golpe o disparo que acierta en `b`: daño según arma, Combate, rasgos y armadura. */
function applyHit(w: World, a: Colonist, b: Colonist, weapon: WeaponDef | null | undefined): void {
  const tough = b.traits.some((t) => t.id === 'duro') ? 0.75 : 1;
  // La dureza de la partida solo cambia los golpes de los saqueadores.
  const hard = a.role === 'saqueador' ? DIFFICULTIES[w.difficulty.level].enemyDamage : 1;
  const armor = 1 - armorProtection([b.vest, b.helmet]);
  // Una criatura muerde o golpea con su propio daño (el perro mutante, ×1,2).
  // La escopeta pega menos a más de 3 casillas.
  // El dron dispara con su arma (como una pistola).
  const blow = a.creature && !CREATURES[a.creature].gun ? CREATURES[a.creature].damage : weapon ? damageAt(weapon, tileDistance(a, b)) : 1;
  // Dentro de un vehículo blindado, el blindaje se lleva parte del golpe (el buggy, −40 %; el de los
  // saqueadores, −30 %) y pierde esa vida.
  // Las armas de fuego hacen más daño a las máquinas (+25 %).
  const vsMachine = weapon?.firearm && !a.creature && isMachine(b.creature) ? 1 + MACHINES.firearmBonus : 1;
  const dmg = absorbHit(w, b, (0.08 + w.rng.next() * 0.1) * (1 + a.skills.combate * 0.03) * tough * hard * blow * armor * vsMachine);
  const part = BODY_PARTS[w.rng.int(0, BODY_PARTS.length - 1)];
  const wasDown = b.downed;
  const fell = b.role === 'colono' ? (hurt(b, dmg, part, !wasDown), !wasDown && b.downed) : hurtFoe(w, b, dmg, part);
  if (fell) {
    if (b.role === 'colono') w.addLog(`🩸 ${b.name} cae herido (${part}).`, 'malo', 'caido', b.tile);
    else if (b.creature) w.addLog(creatureFallText(b), 'bueno');
    else if (b.role === 'aliado') w.addLog(`${b.name} (aliado) cae al suelo.`, 'malo');
    else w.addLog(`${b.name} (saqueador) cae al suelo.`, 'bueno');
    // Quienes lo ven caer pueden entrar en pánico.
    if (b.role === 'colono') witnessFall(w, b);
  } else if (b.role === 'colono' && !b.downed) {
    w.combatAlert(b, 'herido', `🩸 ${b.name} está herido (${part}) · salud ${healthLabel(b).toLowerCase()}.`);
    // Herido y con el ánimo por los suelos: puede entrar en pánico.
    maybePanic(w, b, 'herido');
  }
  // El jabalí herido (y en pie) se vuelve contra quien le ataca.
  if (!fell && b.role === 'animal' && !b.downed && w.others.includes(b)) enrage(w, b);
}

// --- Torretas (defensas activas con electricidad) --------------------------------------

/** Puntería de una torreta: como un colono con Combate 8. Sin corriente, no dispara. */
export const TURRET_AIM_SKILL = 8;
/** Ticks que se ve el trazo de un disparo de torreta (solo para el dibujado). */
export const TURRET_SHOT_TICKS = 12;

/** Disparo de torreta reciente (para dibujar el trazo; no se guarda). */
export interface TurretShot {
  from: Point;
  to: Point;
  tick: number;
  hit: boolean;
}

/** Casilla de la torreta más cercana a un punto y su distancia (en diagonal cuenta como una). */
function turretTileNear(w: World, s: Structure, p: Point): { from: Point; d: number } {
  let best = { from: { x: s.x, y: s.y }, d: Infinity };
  for (const t of w.structures.tilesOf(s)) {
    const d = Math.max(Math.abs(t.x - p.x), Math.abs(t.y - p.y));
    if (d < best.d) best = { from: t, d };
  }
  return best;
}

/**
 * Torretas: cada una con corriente dispara al saqueador más cercano a su alcance que no esté
 * detrás de un muro. No gastan munición. Los fallos no dan a los colonos.
 */
export function updateTurrets(w: World): void {
  // Se olvidan los trazos viejos (van en orden de tiempo).
  const fresh = w.turretShots.findIndex((k) => w.tick - k.tick <= TURRET_SHOT_TICKS);
  w.turretShots.splice(0, fresh < 0 ? w.turretShots.length : fresh);
  for (const [id, cd] of w.turretCooldown) {
    if (cd <= 1) w.turretCooldown.delete(id);
    else w.turretCooldown.set(id, cd - 1);
  }
  const enemies = w.others.filter(hostile);
  if (enemies.length === 0) return;
  for (const s of w.structures.turrets()) {
    const t = s.def.turret!;
    if (!s.powered || w.turretCooldown.has(s.id)) continue;
    let best: { e: Colonist; from: Point; d: number } | null = null;
    for (const e of enemies) {
      const { from, d } = turretTileNear(w, s, e.tile);
      if (d > t.reach) continue;
      if (d > 1 && coverOf(w, from, e) >= FULL_COVER) continue;
      if (!best || d < best.d) best = { e, from, d };
    }
    if (!best) continue;
    w.turretCooldown.set(s.id, Math.round(ATTACK_COOLDOWN * t.cooldown));
    const hit = turretShot(w, s, best.e, best.from, best.d);
    w.turretShots.push({ from: { ...best.from }, to: { ...best.e.tile }, tick: w.tick, hit });
  }
}

/** Un disparo de torreta: acierta como un tirador con Combate 8 y hace el daño de su arma. */
function turretShot(w: World, s: Structure, b: Colonist, from: Point, dist: number): boolean {
  const t = s.def.turret!;
  let hitChance = Math.min(0.95, 0.55 + TURRET_AIM_SKILL * 0.02);
  hitChance = Math.max(0.2, hitChance * (1 - 0.06 * Math.max(0, dist - 1)));
  hitChance *= 1 - Math.min(FULL_COVER, coverOf(w, from, b));
  if (!w.rng.chance(hitChance)) return false;
  const tough = b.traits.some((k) => k.id === 'duro') ? 0.75 : 1;
  const armor = 1 - armorProtection([b.vest, b.helmet]);
  // Dentro de un vehículo blindado, el blindaje se lleva parte del disparo (y pierde esa vida).
  const dmg = absorbHit(w, b, (0.08 + w.rng.next() * 0.1) * (1 + TURRET_AIM_SKILL * 0.03) * tough * t.damage * armor);
  const part = BODY_PARTS[w.rng.int(0, BODY_PARTS.length - 1)];
  if (hurtFoe(w, b, dmg, part)) w.addLog(b.creature ? `🔫 La ${s.def.name.toLowerCase()} abate a ${b.name}.` : `🔫 La ${s.def.name.toLowerCase()} derriba a ${foeLabel(b)}.`, 'bueno');
  return true;
}

/** Cada cuánto mira un arquero reclutado si tiene mejor cobertura cerca. */
const COVER_CHECK_TICKS = 30;
/** Hasta dónde busca cobertura (casillas) y cuánta le basta para no moverse. */
export const COVER_SEARCH = 3;
const COVER_GOOD = 0.3;

/**
 * Arquero reclutado al descubierto: va a la casilla cercana (a 3 o menos) con más cobertura frente
 * al enemigo desde la que todavía le puede disparar. true si se mueve.
 */
export function seekCover(w: World, c: Colonist, enemy: Colonist): boolean {
  if (!usableWeapon(c)?.ammo) return false;
  const here = coverAt(w, enemy.tile, c.tile);
  if (here >= COVER_GOOD) return false;
  const taken = new Set(w.pawns().filter((p) => p !== c).map((p) => p.tile.y * w.map.width + p.tile.x));
  let best: { x: number; y: number; cover: number; d: number } | null = null;
  for (let dy = -COVER_SEARCH; dy <= COVER_SEARCH; dy++) {
    for (let dx = -COVER_SEARCH; dx <= COVER_SEARCH; dx++) {
      const x = c.tile.x + dx;
      const y = c.tile.y + dy;
      if ((dx === 0 && dy === 0) || !isPassable(w.map, x, y) || taken.has(y * w.map.width + x)) continue;
      const cover = coverAt(w, enemy.tile, { x, y });
      if (cover <= here || cover < COVER_GOOD) continue;
      // Desde ahí tiene que poder seguir disparándole.
      const dist = Math.max(Math.abs(x - enemy.tile.x), Math.abs(y - enemy.tile.y));
      if (dist > reachOf(c, w) || shotBlocked(w, { x, y }, enemy.tile)) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (!best || cover > best.cover || (cover === best.cover && d < best.d)) best = { x, y, cover, d };
    }
  }
  if (!best) return false;
  const path = findPath(w.map, c.tile, best, 400);
  if (!path || path.length === 0 || path.length > COVER_SEARCH * 3) return false;
  c.path = path;
  w.coverMoves.add(c.id);
  return true;
}

/** Defensa de un colono: golpea a un saqueador pegado a él; reclutado, además va a por los cercanos. true si ha actuado. */
export function colonistFight(w: World, c: Colonist): boolean {
  if (c.downed) return false;
  if (c.attackCooldown && c.attackCooldown > 0) c.attackCooldown--;
  // Posturas del reclutado: retirarse no pelea; atacar solo va a por su objetivo.
  if (c.drafted && c.stance === 'retirarse') return false;
  if (c.drafted && c.stance === 'atacar') return attackTargetFight(w, c);
  const enemies = w.others.filter(hostile);
  if (enemies.length === 0) return false;
  // El enemigo más cercano a su alcance (pegado, o más lejos con lanza o arco) y sin un muro delante.
  const near = enemies.filter((e) => canHit(w, c, e)).sort((x, y) => tileDistance(c, x) - tileDistance(c, y))[0];
  // Granadas: si hay un grupo de enemigos a tiro sin colonos cerca, lanza una en vez de golpear.
  if (!c.attackCooldown && tryThrowGrenade(w, c)) {
    c.attackCooldown = ATTACK_COOLDOWN;
    if (c.drafted || c.job === null) {
      c.path = [];
      return true;
    }
    return false;
  }
  if (near) {
    if (!c.attackCooldown) attack(w, c, near);
    // Reclutado y con arco: si está al descubierto, busca cobertura cerca (sin dejar de disparar).
    if (c.drafted && w.coverMoves.has(c.id) && c.path.length > 0) {
      w.moveAlongPath(c);
      return true;
    }
    w.coverMoves.delete(c.id);
    // Manteniendo la posición no se mueve, ni para buscar cobertura.
    const holding = c.drafted && c.stance === 'mantener';
    if (c.drafted && !holding && (w.tick + c.id) % COVER_CHECK_TICKS === 0 && seekCover(w, c, near)) return true;
    if (c.drafted || c.job === null) {
      c.path = [];
      return true;
    }
    return false;
  }
  if (!c.drafted || c.path.length > 0 || c.stance === 'mantener') return false;
  // Manejando un mortero cargado: se queda a su lado en vez de ir a por el enemigo.
  if (mortarManned(w, c) && mortarShots(mortarManned(w, c)!) > 0) return false;
  // Reclutado y quieto: va a por el más cercano a su alcance.
  const target = enemies
    .map((e) => ({ e, d: Math.abs(e.tile.x - c.tile.x) + Math.abs(e.tile.y - c.tile.y) }))
    .filter((k) => k.d <= ENGAGE_RANGE)
    .sort((a, b) => a.d - b.d)[0];
  if (!target) return false;
  const path = findPath(w.map, c.tile, target.e.tile, 4000);
  if (path) c.path = path.slice(0, -1).length ? path.slice(0, -1) : path;
  return false;
}

/** Cada cuánto recalcula el camino hacia su objetivo quien lo persigue (el objetivo se mueve). */
const CHASE_REPATH_TICKS = 20;

/** ¿Sigue siendo un objetivo válido? (un saqueador en pie que no ha huido ni se ha ido) */
export function validAttackTarget(w: World, id: number | undefined): Colonist | undefined {
  if (id === undefined) return undefined;
  const e = w.others.find((o) => o.id === id);
  return e && hostile(e) ? e : undefined;
}

/**
 * Postura «atacar a…»: va a por su objetivo y solo le pega a él. Cuando cae, huye o se va,
 * vuelve a la postura normal. Siempre devuelve true (no hace otra cosa mientras ataca).
 */
function attackTargetFight(w: World, c: Colonist): boolean {
  const target = validAttackTarget(w, c.attackTarget);
  if (!target) {
    const e = c.attackTarget !== undefined ? w.others.find((o) => o.id === c.attackTarget) : undefined;
    c.stance = undefined;
    c.attackTarget = undefined;
    c.path = [];
    c.activity = 'idle';
    const why = e?.downed ? `ha abatido a ${e.name}` : e?.raider?.fleeing ? `${e.name} huye` : 'pierde a su objetivo';
    w.addLog(`🎯 ${c.name}: ${why}; espera órdenes.`, 'info');
    return true;
  }
  if (canHit(w, c, target)) {
    if (!c.attackCooldown) attack(w, c, target);
    c.path = [];
    c.activity = 'idle';
    return true;
  }
  if (c.path.length === 0 || (w.tick + c.id) % CHASE_REPATH_TICKS === 0) {
    const path = findPath(w.map, c.tile, target.tile, 4000);
    c.path = path ? (path.length > 1 ? path.slice(0, -1) : path) : [];
  }
  if (c.path.length > 0) w.moveAlongPath(c);
  else c.activity = 'idle';
  return true;
}

// --- Gente que no es de la colonia ----------------------------------------------------

/**
 * Moral de los raids: si cae el líder ★ o la mitad del grupo (en el suelo, muertos o capturados;
 * los que ya se han escapado no cuentan), huyen todos los que quedan en pie.
 */
export function checkRaidMorale(w: World): void {
  for (let i = w.raidGroups.length - 1; i >= 0; i--) {
    const g = w.raidGroups[i];
    const members = w.others.filter((o) => o.role === 'saqueador' && o.raider?.group === g.id);
    if (members.length === 0) {
      w.raidGroups.splice(i, 1);
      continue;
    }
    if (g.routed) continue;
    const standing = members.filter((o) => !o.downed);
    // Las máquinas no tienen moral: no huyen.
    if (standing.length > 0 && standing.every((o) => isMachine(o.creature))) continue;
    const fallen = g.size - g.escaped.length - standing.length;
    const leader = members.find((o) => o.id === g.leaderId);
    // Las manadas no tienen líder (leaderId < 0): solo huyen al caer la mitad.
    const leaderDown = g.leaderId >= 0 && !g.escaped.includes(g.leaderId) && (!leader || leader.downed);
    if (!leaderDown && fallen * 2 < g.size) continue;
    g.routed = true;
    if (standing.length === 0) continue;
    for (const o of standing) {
      if (o.raider!.fleeing) continue;
      o.raider!.fleeing = true;
      o.path = [];
    }
    const name = leader?.name ?? 'su líder';
    const beasts = standing.find((o) => o.creature)?.creature;
    if (beasts && !leaderDown) {
      w.addLog(`🏳 Ha caído la mitad de la manada: los ${CREATURES[beasts].plural} huyen.`, 'bueno');
      continue;
    }
    w.addLog(leaderDown ? `🏳 Ha caído ${name} ★, el líder del raid: los saqueadores huyen.` : '🏳 Ha caído la mitad del raid: los saqueadores huyen.', 'bueno');
  }
}

export function updateOthers(w: World): void {
  checkRaidMorale(w);
  for (const o of [...w.others]) {
    if (o.attackCooldown && o.attackCooldown > 0) o.attackCooldown--;
    if (o.carriedBy !== undefined) {
      const carrier = w.colonists.find((c) => c.id === o.carriedBy);
      if (!carrier) o.carriedBy = undefined;
      else {
        o.pos = { ...carrier.pos };
        o.tile = { ...carrier.tile };
        continue;
      }
    }
    // En el buggy de los saqueadores: si cae, se baja (queda en el suelo al lado); si no, lo lleva el buggy.
    if (o.vehicle) {
      if (o.downed || !o.vehicle.boarded) w.leaveVehicle(o);
      else continue;
    }
    // Una criatura no se queda en el suelo: muere (por si cae por algo que no sea un golpe).
    if (o.downed && o.creature) {
      w.killPawn(o, 'heridas');
      continue;
    }
    // Un aliado que cae se lo llevan los suyos.
    if (o.downed && o.role === 'aliado') {
      leaveMap(w, o, `🤝 ${o.name} cae herido y se lo llevan los suyos.`);
      continue;
    }
    if (o.downed) {
      o.path = [];
      o.activity = 'idle';
      dropGear(w, o);
      continue;
    }
    // Aturdido por una trampa eléctrica: se queda quieto, sin moverse ni atacar.
    if (o.stunnedUntil !== undefined) {
      if (w.tick < o.stunnedUntil) {
        o.activity = 'idle';
        continue;
      }
      o.stunnedUntil = undefined;
    }
    if (o.role === 'saqueador') updateRaider(w, o);
    else if (o.role === 'aliado') updateAlly(w, o);
    else if (o.role === 'animal') updateAnimal(w, o, goAway);
    else if (o.role === 'comerciante') updateTrader(w, o);
    else if (o.role === 'prisionero') updatePrisoner(w, o);
  }
}

/** Suelta el arma y la munición que lleva en su casilla (se pueden recoger). */
export function dropGear(w: World, c: Colonist): void {
  if (c.ammo > 0) w.items.drop(c.tile.x, c.tile.y, ammoFor(c.weapon) ?? 'flechas', c.ammo);
  if (c.weapon) w.items.drop(c.tile.x, c.tile.y, c.weapon, 1);
  if ((c.grenades ?? 0) > 0) w.items.drop(c.tile.x, c.tile.y, 'granadas', c.grenades!);
  c.grenades = 0;
  if (c.vest) w.items.drop(c.tile.x, c.tile.y, c.vest, 1);
  if (c.helmet) w.items.drop(c.tile.x, c.tile.y, c.helmet, 1);
  if (c.coat) w.items.drop(c.tile.x, c.tile.y, 'abrigo', 1);
  c.coat = false;
  c.weapon = null;
  c.ammo = 0;
  c.vest = null;
  c.helmet = null;
}

export function leaveMap(w: World, o: Colonist, why: string): void {
  const i = w.others.indexOf(o);
  if (i >= 0) w.others.splice(i, 1);
  // Liberar a un prisionero sube la relación con su facción.
  if (i >= 0 && o.role === 'prisionero' && o.prisoner?.mode === 'liberar') w.changeRelation(o.faction, RELATION.releasePrisoner, `liberáis a ${o.name}`);
  // Un saqueador que se escapa con botín enriquece la base de su facción.
  if (i >= 0 && o.role === 'saqueador' && o.carrying) enrichBase(w, o.faction, o.carrying.amount * RESOURCE_VALUES[o.carrying.resource]);
  // Un saqueador que se escapa no cuenta como caído para la moral de su raid.
  const g = o.raider?.group !== undefined ? w.raidGroups.find((k) => k.id === o.raider!.group) : undefined;
  if (g && !g.escaped.includes(o.id)) g.escaped.push(o.id);
  w.reservations.releaseAll(o.id);
  if (why) w.addLog(why, 'info');
}

/** Va hacia el borde y se marcha al llegar. */
function goAway(w: World, o: Colonist, why: string): void {
  const m = w.map;
  if (o.tile.x === 0 || o.tile.y === 0 || o.tile.x === m.width - 1 || o.tile.y === m.height - 1) {
    leaveMap(w, o, why);
    return;
  }
  if (o.raider) dropShutPath(w, o);
  if (o.path.length > 0) {
    w.moveAlongPath(o);
    return;
  }
  // Quien vuela va en línea recta al borde más cercano.
  if (flies(o.creature)) {
    const out: Point[] = [
      { x: 0, y: o.tile.y }, { x: m.width - 1, y: o.tile.y }, { x: o.tile.x, y: 0 }, { x: o.tile.x, y: m.height - 1 },
    ];
    out.sort((a, b) => Math.abs(a.x - o.tile.x) + Math.abs(a.y - o.tile.y) - (Math.abs(b.x - o.tile.x) + Math.abs(b.y - o.tile.y)));
    o.path = flightPath(o.tile, out[0]);
    return;
  }
  // El borde más cercano al que se llegue.
  const edges: Point[] = [
    { x: 0, y: o.tile.y }, { x: m.width - 1, y: o.tile.y }, { x: o.tile.x, y: 0 }, { x: o.tile.x, y: m.height - 1 },
  ].sort((a, b) => Math.abs(a.x - o.tile.x) + Math.abs(a.y - o.tile.y) - (Math.abs(b.x - o.tile.x) + Math.abs(b.y - o.tile.y)));
  for (const e of edges) {
    for (let k = 0; k < 20; k++) {
      const p = e.x === 0 || e.x === m.width - 1 ? { x: e.x, y: Math.min(m.height - 1, Math.max(0, e.y + (k % 2 ? k : -k))) } : { x: Math.min(m.width - 1, Math.max(0, e.x + (k % 2 ? k : -k))), y: e.y };
      if (!isPassable(m, p.x, p.y)) continue;
      const path = findPath(m, o.tile, p, 30000, o.raider ? w.shutDoors : undefined);
      if (path) {
        o.path = path;
        return;
      }
    }
  }
  // No hay salida: se queda (y se rinde si es saqueador).
  leaveMap(w, o, why);
}

/** Si una puerta automática se ha cerrado en el camino de un saqueador, lo olvida y busca otro. */
function dropShutPath(w: World, o: Colonist): void {
  if (!w.shutDoors.size || !o.path.length) return;
  if (o.path.some((p) => w.shutDoors.has(p.y * w.map.width + p.x))) o.path = [];
}

/**
 * Al huir, el que llegó en balsa vuelve a ella si la tiene a 8 casillas o menos y le queda sitio, y
 * se sube. true si va hacia ella (o ya se ha subido); si no puede, la olvida y se va a pie.
 */
function backToRaft(w: World, o: Colonist): boolean {
  const r = o.raider!;
  const v = w.vehicle(r.raft!);
  const def = v ? vehicleDef(v.def) : undefined;
  if (!v || !def?.raft || !nearRaft(v, o, def) || riders(w, v).length >= 2) {
    r.raft = undefined;
    return false;
  }
  if (nextTo(v, o.tile)) {
    const seat = occupant(w, v, 'conductor') ? 'tirador' : 'conductor';
    o.vehicle = { id: v.id, seat, boarded: true };
    o.path = [];
    o.activity = 'idle';
    return true;
  }
  const last = o.path[o.path.length - 1];
  if (!last || !nextTo(v, last)) {
    const spots = besideTiles(w, v).sort((a, b) => Math.abs(a.x - o.tile.x) + Math.abs(a.y - o.tile.y) - (Math.abs(b.x - o.tile.x) + Math.abs(b.y - o.tile.y)));
    let path: Point[] | null = null;
    for (const p of spots.slice(0, 4)) {
      path = findPath(w.map, o.tile, p, 4000, w.shutDoors);
      if (path) break;
    }
    if (!path) {
      r.raft = undefined;
      return false;
    }
    o.path = path;
  }
  dropShutPath(w, o);
  if (o.path.length) w.moveAlongPath(o);
  o.activity = 'moving';
  return true;
}

function updateRaider(w: World, o: Colonist): void {
  const r = (o.raider ??= { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY });
  // Las máquinas no tienen moral: ni heridas ni cansadas de esperar se van.
  if (!r.fleeing && !isMachine(o.creature) && (o.health < 0.45 || w.tick > r.leaveAt)) {
    r.fleeing = true;
    o.path = [];
    w.addLog(`${foeLabel(o)} huye.`, 'bueno');
  }
  if (r.fleeing) {
    if (r.raft !== undefined && backToRaft(w, o)) return;
    goAway(w, o, '');
    return;
  }
  // Atacan a los colonos y a los aliados que han venido a ayudarlos.
  const targets = [...w.colonists, ...w.others.filter((k) => k.role === 'aliado')].filter((c) => !c.downed);
  // Las criaturas no saquean: sin nadie en pie, se marchan.
  if (targets.length === 0 && o.creature) {
    r.fleeing = true;
    o.path = [];
    return;
  }
  if (targets.length === 0) {
    // Nadie en pie: saquea un montón y se va.
    if (!o.carrying) {
      const stack = w.items.list()[0];
      if (stack && o.tile.x === stack.x && o.tile.y === stack.y) {
        const got = w.items.take(stack.x, stack.y, 30);
        if (got) o.carrying = { resource: got.resource, amount: got.amount };
        r.fleeing = true;
      } else if (stack && o.path.length === 0) {
        o.path = findPath(w.map, o.tile, stack, 30000, w.shutDoors) ?? [];
        if (o.path.length === 0) r.fleeing = true;
      }
    }
    dropShutPath(w, o);
    if (o.path.length) w.moveAlongPath(o);
    return;
  }
  const target = targets.sort((a, b) => Math.abs(a.tile.x - o.tile.x) + Math.abs(a.tile.y - o.tile.y) - (Math.abs(b.tile.x - o.tile.x) + Math.abs(b.tile.y - o.tile.y)))[0];
  // Granadas: si hay un grupo de colonos a tiro sin saqueadores cerca, lanza una en vez de golpear.
  if (!o.attackCooldown && !o.vehicle && tryThrowGrenade(w, o)) {
    o.attackCooldown = ATTACK_COOLDOWN;
    o.path = [];
    o.activity = 'working';
    return;
  }
  if (canHit(w, o, target)) {
    o.path = [];
    o.activity = 'working';
    if (!o.attackCooldown) attack(w, o, target);
    return;
  }
  // Recalcula el camino de vez en cuando (el objetivo se mueve).
  const breaker = o.creature && CREATURES[o.creature].breaksWalls ? CREATURES[o.creature] : undefined;
  if (!breaker) dropShutPath(w, o);
  if (flies(o.creature)) {
    // El dron vuela en línea recta hacia su objetivo, por encima de todo, hasta tenerlo a tiro.
    if (o.path.length === 0 || (w.tick + o.id) % 30 === 0) {
      const path = flightPath(o.tile, target.tile);
      o.path = path.slice(0, Math.max(1, path.length - 1));
    }
    o.activity = 'moving';
    if (o.path.length) w.moveAlongPath(o);
    return;
  }
  // Si hace poco que no encontró camino, no lo vuelve a buscar en cada tic (con la colonia amurallada
  // eso lo hacía todo muy lento): espera un poco antes de reintentar.
  if ((o.path.length === 0 && w.tick >= (r.noPathUntil ?? 0)) || (o.path.length > 0 && (w.tick + o.id) % 30 === 0)) {
    let path = findPath(w.map, o.tile, target.tile, 20000, w.shutDoors);
    // El bruto mutante, si no llega, se abre paso rompiendo muros y puertas.
    if (!path && breaker) path = findPath(w.map, o.tile, target.tile, 20000, w.shutDoors, (x, y) => breakCost(w, x, y, breaker.wallDamage));
    o.path = path ? path.slice(0, Math.max(1, path.length - 1)) : [];
    if (!path) {
      // No llega (muros): da vueltas un rato y acabará marchándose.
      o.path = [];
      r.noPathUntil = w.tick + NO_PATH_RETRY;
    }
  }
  // Lo siguiente del camino es un muro o una puerta cerrada: lo golpea hasta romperlo.
  if (breaker && o.path.length) {
    const next = o.path[0];
    const i = next.y * w.map.width + next.x;
    if (!isPassable(w.map, next.x, next.y) || w.shutDoors.has(i)) {
      const s = w.structures.mainAt(next.x, next.y);
      if (s && breakCost(w, next.x, next.y, breaker.wallDamage) < Infinity) {
        o.activity = 'working';
        if (!o.attackCooldown) smashStructure(w, o, s);
      } else o.path = [];
      return;
    }
  }
  o.activity = 'moving';
  if (o.path.length) w.moveAlongPath(o);
}

function updateTrader(w: World, o: Colonist): void {
  const t = o.trader!;
  if (!t.leaving && w.tick >= t.leaveAt) {
    t.leaving = true;
    o.path = [];
    w.addLog(`🐫 La caravana de ${o.name} se marcha.`, 'info');
  }
  if (t.leaving) {
    goAway(w, o, '');
    return;
  }
  if (o.path.length) w.moveAlongPath(o);
  else o.activity = 'idle';
}

function updatePrisoner(w: World, o: Colonist): void {
  const p = o.prisoner!;
  // Los prisioneros pasan hambre y sed (los alimenta el carcelero).
  o.needs.food = Math.max(0, o.needs.food - 1 / (1.5 * TICKS_PER_DAY));
  o.needs.water = Math.max(0, o.needs.water - 1 / TICKS_PER_DAY);
  if (p.mode === 'liberar') {
    goAway(w, o, `🕊 ${o.name} ha sido liberado y se marcha.`);
    return;
  }
  o.path = [];
  o.activity = 'idle';
}

// --- Prisioneros -----------------------------------------------------------------------

/** Convierte a alguien en prisionero (capturado o comprado). */
export function makePrisoner(o: Colonist, resistance: number): void {
  o.role = 'prisionero';
  o.raider = undefined;
  o.trader = undefined;
  o.path = [];
  o.prisoner = { resistance: Math.max(0, Math.min(1, resistance)), mode: 'retener', lastTalk: -1e9 };
}

/** Una charla para convencerlo. Devuelve si se ha unido. */
export function talkToPrisoner(w: World, warden: Colonist, o: Colonist): boolean {
  const p = o.prisoner!;
  p.lastTalk = w.tick;
  const skill = warden.skills.social;
  if (p.resistance > 0) {
    // El hambre y la sed lo vuelven más reacio; bien tratado, cede antes.
    const cared = o.needs.food > 0.4 && o.needs.water > 0.4 ? 1.2 : 0.6;
    p.resistance = Math.max(0, p.resistance - (0.06 + skill * 0.012) * cared);
    w.addLog(`🗣 ${warden.name} habla con ${o.name}: resistencia ${Math.round(p.resistance * 100)} %.`, 'info');
    return false;
  }
  if (w.rng.chance(0.4 + skill * 0.03)) {
    w.joinColony(o, 'se ha dejado convencer y se une a la colonia');
    return true;
  }
  w.addLog(`🗣 ${o.name} todavía duda. ${warden.name} lo intentará de nuevo.`, 'info');
  return false;
}

// --- Comercio -----------------------------------------------------------------------

export interface TradeDeal {
  /** Lo que la colonia compra al comerciante. */
  buy: Partial<Record<ResourceId, number>>;
  /** Lo que la colonia le vende. */
  sell: Partial<Record<ResourceId, number>>;
  /** Esclavos (ids) que la colonia compra. */
  slaves: number[];
  /** Prisioneros (ids) que la colonia vende. */
  sellPrisoners: number[];
  /** Mulas de carga que compra (caravanas de los Granjeros y los Nómadas). */
  mules?: number;
}

/** El comerciante cobra un poco más de lo que paga. */
export const TRADER_MARGIN = 1.25;

export function slaveValue(c: Colonist): number {
  return personValue(Object.values(c.skills).reduce((a, b) => a + b, 0));
}

/** Balance de un trato para la colonia (≥ 0: el comerciante acepta). */
export function dealBalance(w: World, trader: Colonist, d: TradeDeal): number {
  let give = 0;
  for (const [r, n] of Object.entries(d.sell) as [ResourceId, number][]) give += n * sellPrice(w, trader, r);
  for (const id of d.sellPrisoners) {
    const p = w.others.find((o) => o.id === id && o.role === 'prisionero');
    if (p) give += slaveValue(p) * 0.6;
  }
  let take = 0;
  for (const [r, n] of Object.entries(d.buy) as [ResourceId, number][]) take += n * buyPrice(w, trader, r);
  for (const id of d.slaves) {
    const s = trader.trader?.slaves.find((k) => k.id === id);
    if (s) take += slaveValue(s) * TRADER_MARGIN;
  }
  take += Math.min(d.mules ?? 0, trader.trader?.mules ?? 0) * TAMING.mulePrice * TRADER_MARGIN;
  return give - take;
}

/** Lo que mueve un trato (lo que se da más lo que se recibe), en chapas. */
function dealValue(w: World, trader: Colonist, d: TradeDeal): number {
  let v = 0;
  for (const [r, n] of Object.entries(d.sell) as [ResourceId, number][]) v += n * sellPrice(w, trader, r);
  for (const [r, n] of Object.entries(d.buy) as [ResourceId, number][]) v += n * buyPrice(w, trader, r);
  return v;
}

/** Hace un trato. Devuelve un motivo si no se puede, o null si se ha hecho. */
export function makeDeal(w: World, trader: Colonist, d: TradeDeal): string | null {
  const t = trader.trader;
  if (!t || t.leaving) return 'El comerciante ya se va';
  const inv = w.inventory();
  for (const [r, n] of Object.entries(d.sell) as [ResourceId, number][]) if (n > inv[r]) return `No hay tanto de ${r}`;
  for (const [r, n] of Object.entries(d.buy) as [ResourceId, number][]) if (n > (t.stock[r] ?? 0)) return `No tiene tanto de ${r}`;
  const balance = dealBalance(w, trader, d);
  if (balance < 0) return 'No le compensa: ofrece más o pide menos';
  // Lo vendido sale de los montones de la colonia (los más cercanos al comerciante).
  for (const [r, n] of Object.entries(d.sell) as [ResourceId, number][]) {
    let left = n;
    const stacks = w.items.list().filter((s) => s.resource === r)
      .sort((a, b) => Math.abs(a.x - trader.tile.x) + Math.abs(a.y - trader.tile.y) - (Math.abs(b.x - trader.tile.x) + Math.abs(b.y - trader.tile.y)));
    for (const s of stacks) {
      if (left <= 0) break;
      const got = w.items.take(s.x, s.y, left);
      if (got) left -= got.amount;
    }
    t.stock[r] = (t.stock[r] ?? 0) + n;
  }
  for (const [r, n] of Object.entries(d.buy) as [ResourceId, number][]) {
    t.stock[r] = (t.stock[r] ?? 0) - n;
    w.items.drop(trader.tile.x, trader.tile.y, r, n);
  }
  for (const id of d.sellPrisoners) {
    const p = w.others.find((o) => o.id === id && o.role === 'prisionero');
    if (!p) continue;
    w.others.splice(w.others.indexOf(p), 1);
    t.slaves.push(p);
  }
  for (const id of d.slaves) {
    const s = t.slaves.find((k) => k.id === id);
    if (!s) continue;
    t.slaves.splice(t.slaves.indexOf(s), 1);
    // El esclavo comprado pasa a ser prisionero de la colonia, con poca resistencia y para convencerlo.
    const spot = nearFree(w, trader.tile) ?? trader.tile;
    s.tile = { ...spot };
    s.pos = { x: spot.x + 0.5, y: spot.y + 0.5 };
    makePrisoner(s, 0.1 + w.rng.next() * 0.25);
    s.prisoner!.mode = 'convencer';
    w.others.push(s);
    w.addLog(`⛓ Compráis a ${s.name}: ahora es prisionero de la colonia. Convencedlo para que se una.`, 'info');
  }
  // Mulas de carga compradas: aparecen junto al comerciante, ya domadas.
  const mules = Math.min(d.mules ?? 0, t.mules ?? 0);
  for (let k = 0; k < mules; k++) {
    const m = makeAnimal(w, 'mula');
    const spot = nearFree(w, trader.tile) ?? trader.tile;
    m.tile = { ...spot };
    m.pos = { x: spot.x + 0.5, y: spot.y + 0.5 };
    tameAnimal(w, m);
    w.others.push(m);
  }
  if (mules > 0) {
    t.mules = (t.mules ?? 0) - mules;
    w.addLog(`🫏 Compráis ${mules} ${mules === 1 ? 'mula' : 'mulas'} de carga (+${TAMING.cargo} kg cada una en las expediciones). Hay que darles de comer.`, 'bueno');
  }
  // La base de su facción se enriquece con el comercio.
  enrichBase(w, trader.faction, dealValue(w, trader, d));
  // Mercado: lo que se vende mucho baja de precio y lo que se compra sube.
  for (const r of RESOURCES) marketTrade(w.market, r, (d.sell[r] ?? 0) - (d.buy[r] ?? 0));
  // Facciones: el primer trato con cada caravana sube la relación, y lo que se da de más cuenta como regalo.
  if (!t.traded) {
    t.traded = true;
    w.changeRelation(trader.faction, RELATION.tradeCaravan, 'comerciáis con su caravana');
  }
  const gift = giftPoints(balance);
  if (gift > 0) w.changeRelation(trader.faction, gift, `regalo de ${Math.floor(balance)} chapas`);
  return null;
}
