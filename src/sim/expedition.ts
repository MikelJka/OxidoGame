// Atacar la base de una facción (bases, segunda parte; elegido por Mikel el 2026-10-21, opción
// 1C): se manda a unos colonos de expedición; tras los días de viaje se carga un mapa de batalla
// con la base (muros, torres, defensores y su botín) y se pelea en directo. Al acabar vuelven a
// casa con lo que hayan ganado. Si cae la base, la facción desaparece y quedan sus ruinas.
// Puro y determinista: sin Phaser ni DOM.
import { factionDef } from '../data/factions';
import { baseLevel } from '../data/worldmap';
import { RAIDER_AMMO, ammoFor, raiderWeaponPool } from '../data/weapons';
import { RESOURCES, ResourceId } from '../data/resources';
import type { Colonist } from './colonist';
import { isPassable, Prop, Terrain } from './map';
import { Rng } from './rng';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { travelDays } from './worldmap';
import { fits, Vehicle } from './vehicles';
import { vehicleDef } from '../data/vehicles';
import { CARRY_PER_COLONIST, loadWeight } from '../data/weights';
import { animalCargo } from '../data/creatures';
import { packAnimals } from './animals';
import { World } from './world';

/** Una expedición en marcha: de ida, peleando o de vuelta. */
export interface Expedition {
  faction: string;
  /** «ocupar»: van a vivir a las ruinas de una base (su nombre en `ruin`). Sin poner, a atacar. */
  kind?: 'ataque' | 'ocupar';
  ruin?: string;
  members: Colonist[];
  phase: 'ida' | 'batalla' | 'vuelta';
  /** Tick (del mapa de la colonia) en que llegan a la base o vuelven a casa. */
  arriveAt: number;
  /** Lo que traen de vuelta. */
  loot: Partial<Record<ResourceId, number>>;
  /** Lo que llevan para la batalla (comida, armas, munición…). */
  supplies?: Partial<Record<ResourceId, number>>;
  /** Vehículos que se llevan (el buggy, barcas…). */
  vehicles?: Vehicle[];
  /** Animales de carga que van con ellos (esperan fuera de la batalla). */
  animals?: Colonist[];
  /** Cómo acabó la batalla (de vuelta). */
  result?: BattleResult;
}

export type BattleResult = 'victoria' | 'derrota' | 'retirada';

/** Lo que sabe un mapa de batalla: de qué colonia es, contra quién y cómo va. */
export interface BattleInfo {
  home: World;
  faction: string;
  /** Rectángulo de la base [x0, y0, x1, y1]. */
  base: [number, number, number, number];
  result?: BattleResult;
}

/** Ruinas de una base destruida (para ocuparla más adelante). */
export interface Ruin {
  faction: string;
  name: string;
  x: number;
  y: number;
  day: number;
}

/** Tamaño del mapa de batalla. */
const BATTLE_SIZE = { width: 64, height: 44 };
/** Defensores como mucho (aunque la base tenga más gente). */
const MAX_DEFENDERS = 18;

/** Kilos que pueden llevar esos colonos con esos vehículos. */
export function expeditionCapacity(w: World, members: number, vehicleIds: number[] = [], animalIds: number[] = []): number {
  let kg = members * CARRY_PER_COLONIST;
  for (const v of w.vehicles) if (vehicleIds.includes(v.id)) kg += vehicleDef(v.def)?.cargo ?? 0;
  for (const a of packAnimals(w)) if (animalIds.includes(a.id)) kg += animalCargo(a.creature);
  return kg;
}

/** Vehículos de la colonia que se pueden llevar (los suyos, con capacidad de carga). */
export function expeditionVehicles(w: World): Vehicle[] {
  return w.vehicles.filter((v) => !vehicleDef(v.def)?.hostile && (vehicleDef(v.def)?.cargo ?? 0) > 0);
}

/**
 * Saca a unos colonos de la colonia y los manda a atacar la base de una facción, con lo que lleven
 * (`supplies`, hasta lo que aguanten por peso) y los vehículos elegidos. Devuelve el motivo si no se puede.
 */
export function startExpedition(w: World, factionId: string, ids: number[], supplies: Partial<Record<ResourceId, number>> = {}, vehicleIds: number[] = [], animalIds: number[] = []): string | null {
  if (w.expedition) return 'Ya hay una expedición fuera.';
  const f = w.faction(factionId);
  if (!f?.base) return 'Esa facción no tiene base.';
  const members = w.colonists.filter((c) => ids.includes(c.id) && !c.downed);
  if (!members.length) return 'Elige al menos a un colono que pueda andar.';
  const vehicles = expeditionVehicles(w).filter((v) => vehicleIds.includes(v.id));
  const animals = packAnimals(w).filter((a) => animalIds.includes(a.id));
  const cap = expeditionCapacity(w, members.length, vehicles.map((v) => v.id), animals.map((a) => a.id));
  const kg = loadWeight(supplies);
  if (kg > cap) return `Demasiada carga: ${kg} de ${cap} kg.`;
  const inv = w.inventory();
  for (const [r, n] of Object.entries(supplies) as [ResourceId, number][]) if ((n ?? 0) > inv[r]) return `No hay tanto de ${r}.`;
  for (const c of members) w.removeFromColony(c);
  // Lo que llevan sale de los montones; los vehículos se van con ellos (los que iban dentro se bajan).
  const load: Partial<Record<ResourceId, number>> = {};
  for (const [r, n] of Object.entries(supplies) as [ResourceId, number][]) {
    if (!(n > 0)) continue;
    takeStock(w, r, n);
    load[r] = n;
  }
  for (const v of vehicles) {
    for (const c of w.pawns()) if (c.vehicle?.id === v.id) w.leaveVehicle(c);
    w.vehicles.splice(w.vehicles.indexOf(v), 1);
    v.path = [];
  }
  for (const a of animals) {
    w.others.splice(w.others.indexOf(a), 1);
    a.path = [];
  }
  const speed = Math.min(1, ...vehicles.map((v) => vehicleDef(v.def)?.travel ?? 1));
  const days = Math.max(0.5, Math.round(travelDays(f.base) * speed * 2) / 2);
  w.expedition = { faction: factionId, members, phase: 'ida', arriveAt: w.tick + Math.round(days * TICKS_PER_DAY), loot: {}, supplies: load, vehicles, animals };
  // Atacarles los pone en guerra con vosotros.
  w.changeRelation(factionId, -100, 'les atacáis');
  const def = factionDef(factionId);
  w.addLog(`⚔️ ${members.map((c) => c.name).join(', ')} ${members.length === 1 ? 'sale' : 'salen'} hacia ${f.settlement}, la base de ${def?.name ?? factionId}: ${String(days).replace('.', ',')} días de viaje.`, 'info');
  return null;
}

/** Cada hora en la colonia: la expedición llega a la base (empieza la batalla) o vuelve a casa. */
export function updateExpedition(w: World): void {
  const e = w.expedition;
  if (!e || w.tick < e.arriveAt) return;
  if (e.phase === 'ida' && e.kind === 'ocupar') {
    settleRuin(w, e);
    return;
  }
  if (e.phase === 'ida') {
    const f = w.faction(e.faction);
    if (!f?.base) {
      // La base ya no existe: se vuelven.
      e.phase = 'vuelta';
      e.arriveAt = w.tick + TICKS_PER_DAY;
      return;
    }
    e.phase = 'batalla';
    w.pendingBattle = createBattle(w, e);
    w.addLog(`⚔️ La expedición llega a ${f.settlement}. ¡Empieza la batalla!`, 'malo', 'raid');
    return;
  }
  if (e.phase === 'vuelta') {
    w.expedition = null;
    for (const c of e.members) {
      w.colonists.push(c);
      if (!w.placeNearColony(c)) {
        const p = w.colonyPoint() ?? { x: 0, y: 0 };
        c.tile = { ...p };
        c.pos = { x: p.x + 0.5, y: p.y + 0.5 };
      }
    }
    const home = w.colonyPoint();
    if (home) w.items.dropAll(home.x, home.y, e.loot);
    // Los vehículos vuelven junto a la colonia.
    for (const v of e.vehicles ?? []) parkVehicle(w, v);
    // Y los animales de carga.
    for (const a of e.animals ?? []) {
      w.others.push(a);
      const p = w.colonyPoint();
      if (p) {
        a.tile = { ...p };
        a.pos = { x: p.x + 0.5, y: p.y + 0.5 };
        a.path = [];
      }
      a.fedAt = w.tick;
    }
    const got = (Object.entries(e.loot) as [ResourceId, number][]).filter(([, n]) => n > 0).map(([r, n]) => `${n} de ${r}`).join(', ');
    w.addLog(`🏠 Vuelve la expedición: ${e.members.map((c) => c.name).join(', ') || 'nadie'}${got ? `, con ${got}` : ''}.`, e.result === 'victoria' ? 'bueno' : 'info');
  }
}

/** El mapa de batalla: la base de la facción a la derecha y los colonos entrando por la izquierda. */
export function createBattle(home: World, e: Expedition): World {
  const f = home.faction(e.faction)!;
  const base = f.base!;
  const seed = ((home.map.seed ^ 0x0ba771e5) + base.x * 131 + base.y * 977 + home.day) >>> 0;
  const b = new World({ seed, width: BATTLE_SIZE.width, height: BATTLE_SIZE.height, colonists: 0, events: false, needs: false });
  b.nextPawnId = home.nextPawnId + 1000;
  b.tick = home.tick;
  // El mismo mundo: las mismas facciones, ruinas y mercado que la colonia.
  b.factions = home.factions;
  b.ruins = home.ruins;
  b.market = home.market;
  const m = b.map;
  const rng = new Rng(seed);
  // Terreno llano y sin agua en el centro (para que se pueda pelear).
  const level = baseLevel(base.population);
  const [bw, bh] = level.id === 'fortaleza' ? [17, 13] : level.id === 'pueblo' ? [13, 11] : [9, 9];
  const x0 = m.width - bw - 6;
  const y0 = Math.floor((m.height - bh) / 2);
  const x1 = x0 + bw - 1;
  const y1 = y0 + bh - 1;
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const i = y * m.width + x;
      const t = m.terrain[i] as Terrain;
      if (t <= Terrain.ShallowWater || t === Terrain.Rock || x >= x0 - 3 || x < 6) m.terrain[i] = Terrain.Soil;
      if (x >= x0 - 3 || x < 6 || m.props[i] === Prop.RuinWall || m.props[i] === Prop.Boulder) m.props[i] = Prop.None;
      m.cliff[i] = 0;
      m.slope[i] = 0;
      m.level[i] = 2;
    }
  }
  m.start = { x: 2, y: Math.floor(m.height / 2) };
  for (const s of b.items.list()) b.items.take(s.x, s.y, s.amount);
  // Muros (de madera en una aldea, de piedra en un pueblo y de hormigón en una fortaleza) con la entrada hacia la izquierda.
  const wall = level.id === 'fortaleza' ? 'muro_hormigon' : level.id === 'pueblo' ? 'muro_piedra' : 'muro_madera';
  const gate = Math.floor((y0 + y1) / 2);
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
      if (x === x0 && Math.abs(y - gate) <= 1) continue;
      if (b.structures.place(x, y, wall)) b.completeStructure(b.structures.at(x, y)!);
    }
  }
  // Torres de vigía por dentro, según sus defensas.
  const tower = level.id === 'aldea' ? 'torre_madera' : 'torre_piedra';
  const corners = [[x0 + 1, y0 + 1], [x0 + 1, y1 - 1], [x1 - 1, y0 + 1], [x1 - 1, y1 - 1], [x0 + 2, gate - 3], [x0 + 2, gate + 3]];
  for (const [tx, ty] of corners.slice(0, Math.min(corners.length, Math.floor(base.defenses / 2)))) {
    if (b.structures.place(tx, ty, tower)) b.completeStructure(b.structures.at(tx, ty)!);
  }
  // Su botín: la mitad de su riqueza en recursos, en el centro de la base.
  const pool: ResourceId[] = ['madera', 'piedra', 'chatarra', 'componentes', 'metal', 'comida', 'medicina', 'balas'];
  let value = Math.max(60, Math.round(base.wealth / 2) + base.population * 15);
  for (let k = 0; k < 6 && value > 0; k++) {
    const r = pool[rng.int(0, pool.length - 1)];
    const n = Math.max(1, Math.round(value / 3 / Math.max(1, rVal(r))));
    b.items.dropAll(Math.floor((x0 + x1) / 2), gate, { [r]: n });
    value -= n * rVal(r);
  }
  // Defensores, armados según el día, dentro de la base.
  const n = Math.max(2, Math.min(MAX_DEFENDERS, base.population));
  const weapons = raiderWeaponPool(home.day);
  const group = b.nextPawnId;
  const defenders: Colonist[] = [];
  for (let k = 0; k < n; k++) {
    const d = b.makePawn('saqueador');
    d.faction = e.faction;
    d.raider = { fleeing: false, leaveAt: Number.MAX_SAFE_INTEGER, group };
    d.skills.combate = Math.max(d.skills.combate, rng.int(3, 10));
    d.weapon = weapons[rng.int(0, weapons.length - 1)];
    d.ammo = ammoFor(d.weapon) ? RAIDER_AMMO : 0;
    for (let tries = 0; tries < 40; tries++) {
      const x = rng.int(x0 + 1, x1 - 1);
      const y = rng.int(y0 + 1, y1 - 1);
      if (!isPassable(m, x, y)) continue;
      d.tile = { x, y };
      d.pos = { x: x + 0.5, y: y + 0.5 };
      break;
    }
    defenders.push(d);
    b.others.push(d);
  }
  const leader = defenders.reduce((a, c) => (c.skills.combate > a.skills.combate ? c : a));
  leader.raider!.leader = true;
  b.raidGroups.push({ id: group, size: defenders.length, leaderId: leader.id, escaped: [], routed: false });
  // Los colonos entran por la izquierda, reclutados.
  e.members.forEach((c, k) => {
    const y = Math.max(1, Math.min(m.height - 2, m.start.y - Math.floor(e.members.length / 2) + k));
    c.tile = { x: 2, y };
    c.pos = { x: 2.5, y: y + 0.5 };
    c.path = [];
    c.job = null;
    c.drafted = true;
    b.colonists.push(c);
  });
  // Lo que traen, en el suelo junto a la entrada; los vehículos de tierra, aparcados al lado.
  b.items.dropAll(3, m.start.y, e.supplies ?? {});
  b.nextVehicleId = Math.max(b.nextVehicleId, ...(e.vehicles ?? []).map((v) => v.id + 1));
  for (const v of e.vehicles ?? []) {
    const def = vehicleDef(v.def);
    if (!def || def.water) continue;
    for (let k = 0; k < 20; k++) {
      const x = 4 + (k % 3) * 3;
      const y = Math.max(0, Math.min(m.height - 2, m.start.y - 6 + Math.floor(k / 3) * 3));
      if (!fits(b, x, y, def) || b.vehicles.some((o) => Math.abs(o.x - x) < 2 && Math.abs(o.y - y) < 2)) continue;
      v.x = x;
      v.y = y;
      v.pos = { x, y };
      v.path = [];
      b.vehicles.push(v);
      break;
    }
  }
  b.battle = { home, faction: e.faction, base: [x0, y0, x1, y1] };
  b.addLog(`⚔️ Batalla en ${f.settlement}: ${defenders.length} defensores tras sus muros. Vuestros colonos están reclutados: tocad a un enemigo para atacarle, o 🏳 Retirarse para volver.`, 'malo', 'raid');
  return b;
}

const rVal = (r: ResourceId) => ({ madera: 1, piedra: 1, chatarra: 2, componentes: 12, metal: 4, comida: 5, medicina: 20, balas: 1.2 } as Partial<Record<ResourceId, number>>)[r] ?? 1;

/** Cada segundo en el mapa de batalla: ¿se ha acabado? */
export function checkBattle(b: World): void {
  const info = b.battle;
  if (!info || info.result) return;
  const foes = b.others.some((o) => o.role === 'saqueador' && o.faction === info.faction && !o.downed && !o.raider?.fleeing);
  const ours = b.colonists.some((c) => !c.downed);
  if (!foes) info.result = 'victoria';
  else if (!ours) info.result = 'derrota';
}

/** Se retiran de la batalla (con los heridos a cuestas). */
export function retreat(b: World): void {
  if (b.battle && !b.battle.result) b.battle.result = 'retirada';
}

/**
 * Acaba la batalla: los colonos vuelven a la colonia (días de viaje) con su botín si han ganado;
 * si cae la base, la facción desaparece y quedan sus ruinas.
 */
export function finishBattle(b: World): World {
  const info = b.battle!;
  const home = info.home;
  const e = home.expedition;
  const f = home.faction(info.faction);
  const def = factionDef(info.faction);
  const result = info.result ?? 'retirada';
  for (const g of b.graveyard) {
    home.graveyard.push({ ...g });
    home.addLog(`💀 ${g.name} ha muerto en la batalla (${g.cause}).`, 'malo', 'muerte');
  }
  const members = [...b.colonists];
  for (const c of members) {
    c.drafted = false;
    c.job = null;
    c.path = [];
    c.need = null;
    delete c.vehicle;
    c.activity = 'idle';
  }
  const loot: Partial<Record<ResourceId, number>> = {};
  // Lo suyo que quede fuera de la base (lo que llevaron, lo que soltaron) vuelve con ellos; si han
  // ganado, también lo de dentro.
  const [x0, y0, x1, y1] = info.base;
  for (const s of b.items.list()) {
    const inside = s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
    if (inside && result !== 'victoria') continue;
    loot[s.resource] = (loot[s.resource] ?? 0) + s.amount;
  }
  for (const c of b.pawns()) if (c.vehicle) delete c.vehicle;
  const ownVehicles = (e?.vehicles ?? []).filter((v) => b.vehicles.includes(v) || vehicleDef(v.def)?.water);
  if (result === 'victoria') {
    if (f?.base) home.ruins.push({ faction: f.id, name: f.settlement, x: f.base.x, y: f.base.y, day: home.day });
    home.factions.splice(home.factions.findIndex((k) => k.id === info.faction), 1);
    home.addLog(`🏚 ¡Victoria! ${f?.settlement ?? 'La base'} ha caído: ${def?.name ?? info.faction} ya no existen. Quedan sus ruinas en el mapa del mundo.`, 'bueno');
  } else {
    home.addLog(result === 'derrota' ? `☠ Derrota en ${f?.settlement ?? 'la base'}: los vuestros vuelven a casa malheridos.` : `🏳 La expedición se retira de ${f?.settlement ?? 'la base'} y vuelve a casa.`, 'malo');
  }
  const days = f?.base ? travelDays(f.base) : 1;
  home.expedition = { faction: info.faction, members, phase: 'vuelta', arriveAt: home.tick + Math.round(days * TICKS_PER_DAY), loot, result, vehicles: ownVehicles, animals: e?.animals ?? [] };
  home.pendingBattle = null;
  if (e) e.members = members;
  return home;
}

/** Recursos válidos (para leer una partida guardada). */
export function cleanLoot(o: unknown): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {};
  if (!o || typeof o !== 'object') return out;
  for (const [r, n] of Object.entries(o)) if (RESOURCES.includes(r as ResourceId) && typeof n === 'number' && n > 0) out[r as ResourceId] = Math.floor(n);
  return out;
}

/** Horas que faltan para que llegue la expedición (a la base o a casa). */
export function expeditionHours(w: World): number {
  return w.expedition ? Math.max(0, Math.ceil((w.expedition.arriveAt - w.tick) / TICKS_PER_HOUR)) : 0;
}

// --- Ocupar las ruinas (bases, tercera parte; opción 3A de Mikel) ------------------------------

/** Una colonia más: las ruinas de una base que han ocupado unos colonos. */
export interface Outpost {
  name: string;
  world: World;
}

/** Manda a unos colonos a vivir en las ruinas de una base. Devuelve el motivo si no se puede. */
export function startSettling(w: World, ruinName: string, ids: number[]): string | null {
  if (w.expedition) return 'Ya hay una expedición fuera.';
  const ruin = w.ruins.find((r) => r.name === ruinName);
  if (!ruin) return 'Esas ruinas ya no están.';
  const members = w.colonists.filter((c) => ids.includes(c.id) && !c.downed);
  if (!members.length) return 'Elige al menos a un colono que pueda andar.';
  if (members.length === w.colonists.length) return 'Alguien tiene que quedarse en la colonia.';
  for (const c of members) w.removeFromColony(c);
  const days = travelDays({ x: ruin.x, y: ruin.y, population: 0, wealth: 0, defenses: 0, grownAt: 0 });
  w.expedition = { faction: ruin.faction, kind: 'ocupar', ruin: ruin.name, members, phase: 'ida', arriveAt: w.tick + Math.round(days * TICKS_PER_DAY), loot: {} };
  w.addLog(`🏚 ${members.map((c) => c.name).join(', ')} ${members.length === 1 ? 'sale' : 'salen'} hacia las ruinas de ${ruin.name} para vivir allí: ${String(days).replace('.', ',')} días de viaje.`, 'info');
  return null;
}

/** Llegan a las ruinas: se crea la colonia nueva con ellos dentro. */
function settleRuin(w: World, e: Expedition): void {
  const ruin = w.ruins.find((r) => r.name === e.ruin);
  w.expedition = null;
  const mainWorld = w.outpostHome ?? w;
  const name = ruin?.name ?? e.ruin ?? 'Ruinas';
  const seed = ((w.map.seed ^ 0x51e7713) + (ruin?.x ?? 0) * 131 + (ruin?.y ?? 0) * 977) >>> 0;
  const o = new World({ seed, width: 80, height: 60, colonists: 0, events: true, difficulty: w.difficulty });
  o.nextPawnId = mainWorld.nextPawnId + 2000 * (mainWorld.outposts.length + 1);
  o.tick = w.tick;
  o.name = name;
  const m = o.map;
  for (const s of o.items.list()) o.items.take(s.x, s.y, s.amount);
  const home = o.colonyPoint() ?? { x: Math.floor(m.width / 2), y: Math.floor(m.height / 2) };
  // Lo que queda de sus muros: un recinto de madera roto, con huecos.
  const rng = new Rng(seed);
  for (let x = home.x - 6; x <= home.x + 6; x++) {
    for (let y = home.y - 5; y <= home.y + 5; y++) {
      if (x !== home.x - 6 && x !== home.x + 6 && y !== home.y - 5 && y !== home.y + 5) continue;
      if (!rng.chance(0.55)) continue;
      if (o.structures.place(x, y, 'muro_madera')) {
        const s = o.structures.at(x, y)!;
        o.completeStructure(s);
        s.hp = Math.max(1, Math.round(s.hp * (0.3 + rng.next() * 0.5)));
      }
    }
  }
  o.items.dropAll(home.x, home.y, { madera: 30, comida: 10 });
  e.members.forEach((c) => {
    c.drafted = false;
    c.job = null;
    c.path = [];
    o.colonists.push(c);
    if (!o.placeNearColony(c)) {
      c.tile = { ...home };
      c.pos = { x: home.x + 0.5, y: home.y + 0.5 };
    }
  });
  // Comparten el mundo con la principal: las mismas facciones, ruinas y mercado.
  const main = w.outpostHome ?? w;
  o.factions = main.factions;
  o.ruins = main.ruins;
  o.market = main.market;
  o.outpostHome = main;
  main.outposts.push({ name, world: o });
  if (ruin) w.ruins.splice(w.ruins.indexOf(ruin), 1);
  w.addLog(`🏚 ${e.members.map((c) => c.name).join(', ')} ${e.members.length === 1 ? 'se instala' : 'se instalan'} en las ruinas de ${name}: es vuestra nueva colonia. Cambiad de una a otra en 📜 → 🏳 Facciones.`, 'bueno');
}

/** Todas las colonias del jugador: la principal y las ocupadas. */
export function allColonies(w: World): { name: string; world: World }[] {
  const home = w.outpostHome ?? w.battle?.home ?? w;
  return [{ name: home.name ?? 'Colonia principal', world: home }, ...home.outposts.map((o) => ({ name: o.name, world: o.world }))];
}

/** Quita `n` de un recurso de los montones de la colonia. */
function takeStock(w: World, r: ResourceId, n: number): void {
  let left = n;
  for (const s of w.items.list()) {
    if (left <= 0) break;
    if (s.resource !== r) continue;
    const got = w.items.take(s.x, s.y, left);
    if (got) left -= got.amount;
  }
}

/** Deja un vehículo que vuelve junto a la colonia (en el agua más cercana, si es un barco). */
export function parkVehicle(w: World, v: Vehicle): void {
  const def = vehicleDef(v.def);
  const home = w.colonyPoint();
  if (!def || !home) return;
  for (let r = 1; r <= Math.max(w.map.width, w.map.height); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = home.x + dx;
        const y = home.y + dy;
        if (!fits(w, x, y, def) || w.vehicles.some((o) => Math.abs(o.x - x) < 2 && Math.abs(o.y - y) < 2)) continue;
        v.id = w.nextVehicleId++;
        v.x = x;
        v.y = y;
        v.pos = { x, y };
        v.path = [];
        w.vehicles.push(v);
        return;
      }
    }
  }
}
