// Gente que no es de la colonia y lo que trae el narrador: supervivientes que piden unirse,
// raids de saqueadores (combate cuerpo a cuerpo, huida, heridos que se pueden capturar),
// prisioneros (retener, convencer, liberar) y caravanas de comerciantes (con esclavos).
import { RESOURCES, ResourceId } from '../data/resources';
import { personValue, RESOURCE_VALUES } from '../data/values';
import { isGear, raiderWeaponPool, WEAPONS, WeaponDef } from '../data/weapons';
import { armorProtection, isArmor, raiderVestPool } from '../data/armor';
import { MEDICINE_STOCK } from '../data/medicine';
import type { Colonist } from './colonist';
import type { Structure } from './structures';
import { BODY_PARTS, healthLabel, hurt } from './health';
import { findPath, Point } from './pathfinding';
import { inBounds, isPassable, Prop, Terrain } from './map';
import { DIFFICULTIES, raidGap, raidSize, TRADER_GAP, WANDERER_GAP } from './storyteller';
import type { World } from './world';
import { maybePanic, witnessFall } from './panic';
import { TICKS_PER_DAY } from './time';
export { canTalk, TALK_HOURS } from './jobs';

/** Ticks entre golpes. */
export const ATTACK_COOLDOWN = 45;
/** Distancia (casillas) a la que un colono reclutado va a por un enemigo. */
export const ENGAGE_RANGE = 10;

const hostile = (c: Colonist) => c.role === 'saqueador' && !c.downed && !c.raider?.fleeing;

/** Valor de lo que tiene la colonia (para el tamaño de los raids). */
export function colonyWealth(w: World): number {
  const inv = w.inventory();
  let v = RESOURCES.reduce((a, r) => a + inv[r] * RESOURCE_VALUES[r], 0);
  for (const s of w.structures.all()) {
    if (!s.built) continue;
    for (const [r, n] of Object.entries(s.def.cost) as [ResourceId, number][]) v += n * RESOURCE_VALUES[r];
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
  if (w.tick >= sch.nextRaid) {
    sch.nextRaid = w.tick + days(raidGap(w.difficulty.level));
    startRaid(w, raidSize(w.day, colonyWealth(w), w.colonists.length, diff.raidScale));
  }
  if (w.tick >= sch.nextTrader) {
    sch.nextTrader = w.tick + days(TRADER_GAP);
    if (!w.others.some((o) => o.role === 'comerciante')) startTrader(w);
  }
}

/** Un superviviente pide unirse (el jugador decide). */
export function offerWanderer(w: World): void {
  const c = w.makePawn('colono');
  w.offer = { kind: 'superviviente', pawn: c, until: w.tick + TICKS_PER_DAY / 2 };
  w.addLog(`🚶 ${c.name} «${c.nickname}», ${c.age} años, pide unirse a la colonia.`, 'info', 'visita');
}

/** Llega un raid de `n` saqueadores por un mismo borde. */
export function startRaid(w: World, n: number): Colonist[] {
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
  // Armados según el día: palos y cuchillos al principio; tuberías, lanzas y arcos más adelante.
  const pool = raiderWeaponPool(w.day);
  for (const r of out) {
    r.skills.combate = Math.max(r.skills.combate, w.rng.int(3, 10));
    r.weapon = pool[w.rng.int(0, pool.length - 1)];
    r.ammo = r.weapon && WEAPONS[r.weapon].ammo ? 15 : 0;
    const vests = raiderVestPool(w.day);
    if (vests.some((v) => v)) r.vest = vests[w.rng.int(0, vests.length - 1)];
    w.others.push(r);
  }
  // El de más Combate dirige el raid (★). Si cae él o la mitad del grupo, huyen todos.
  const leader = out.reduce((a, b) => (b.skills.combate > a.skills.combate ? b : a));
  leader.raider!.leader = true;
  for (const r of out) r.raider!.group = first.id;
  w.raidGroups.push({ id: first.id, size: out.length, leaderId: leader.id, escaped: [], routed: false });
  const lead = out.length > 1 ? `, con ${leader.name} ★ al frente` : '';
  w.addLog(`⚔️ ¡Raid! ${n} ${n === 1 ? 'saqueador llega' : 'saqueadores llegan'}${lead}. Recluta a los colonos (🎖) para defenderos.`, 'malo', 'raid', first.tile);
  return out;
}

/** Llega una caravana: un comerciante con mercancía y, a veces, esclavos. */
export function startTrader(w: World): Colonist | null {
  const t = w.makePawn('comerciante');
  if (!w.placeAtEdge(t)) return null;
  const stock: Partial<Record<ResourceId, number>> = {};
  // Las caravanas todavía no venden armas.
  for (const r of RESOURCES) if (!isGear(r) && !isArmor(r) && w.rng.chance(0.5)) stock[r] = w.rng.int(10, 60);
  stock.componentes = w.rng.int(2, 10);
  // La medicina, en poca cantidad (si la trae).
  if (stock.medicina !== undefined) stock.medicina = w.rng.int(MEDICINE_STOCK[0], MEDICINE_STOCK[1]);
  const slaves: Colonist[] = [];
  const nSlaves = w.rng.int(0, 2);
  for (let i = 0; i < nSlaves; i++) slaves.push(w.makePawn('prisionero'));
  t.trader = { stock, slaves, leaveAt: w.tick + Math.round(TICKS_PER_DAY * 0.75), leaving: false };
  w.others.push(t);
  const home = w.colonyPoint();
  const path = home ? findPath(w.map, t.tile, nearFree(w, home) ?? home, 60000) : null;
  if (path) t.path = path;
  w.addLog(`🐫 Llega una caravana de ${t.name}${nSlaves ? ` con ${nSlaves} ${nSlaves === 1 ? 'esclavo' : 'esclavos'}` : ''}. Toca al comerciante para comerciar.`, 'bueno', 'caravana', t.tile);
  return t;
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

/** Arma que puede usar ahora (un arco sin flechas no dispara: se pelea con los puños). */
export function usableWeapon(c: Colonist): WeaponDef | null {
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
  return weapon?.ammo && w && onTower(w, c) ? reach + TOWER_REACH : reach;
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

/** Puede golpear o disparar a `b` desde donde está: a su alcance y sin un muro delante del objetivo. */
export function canHit(w: World, a: Colonist, b: Colonist): boolean {
  const d = tileDistance(a, b);
  if (d <= 1) return true;
  if (d > reachOf(a, w)) return false;
  return coverAt(w, a.tile, b.tile) < FULL_COVER;
}

/** Un golpe (o un disparo, con arco). Devuelve true si acierta. */
export function attack(w: World, a: Colonist, b: Colonist): boolean {
  const weapon = usableWeapon(a);
  fightAlert(w, a, b);
  a.attackCooldown = Math.round(ATTACK_COOLDOWN * (weapon?.cooldown ?? 1));
  const dx = b.pos.x - a.pos.x;
  if (Math.abs(dx) > 0.01) a.facing = dx > 0 ? 1 : -1;
  const dist = tileDistance(a, b);
  let hitChance = Math.min(0.95, 0.55 + a.skills.combate * 0.02);
  if (weapon?.ammo) {
    a.ammo--;
    // A distancia se acierta menos cuanto más lejos, y menos aún si el objetivo está a cubierto.
    hitChance = Math.max(0.2, hitChance * (1 - 0.06 * Math.max(0, dist - 1)));
    if (onTower(w, a)) hitChance = Math.min(0.98, hitChance + TOWER_AIM);
    hitChance *= 1 - Math.min(FULL_COVER, coverAt(w, a.tile, b.tile));
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
  return true;
}

/** Aviso de pelea (#17, #18): un colono ataca o es atacado por un saqueador (uno por colono y hora). */
function fightAlert(w: World, a: Colonist, b: Colonist): void {
  if (a.role === 'colono' && b.role === 'saqueador') w.combatAlert(a, 'combate', `⚔️ ${a.name} está peleando con ${b.name}.`);
  else if (b.role === 'colono' && a.role === 'saqueador') w.combatAlert(b, 'combate', `⚔️ ${a.name} (saqueador) ataca a ${b.name}.`);
}

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
  const dmg = (0.08 + w.rng.next() * 0.1) * (1 + a.skills.combate * 0.03) * tough * hard * (weapon?.damage ?? 1) * armor;
  const part = BODY_PARTS[w.rng.int(0, BODY_PARTS.length - 1)];
  const wasDown = b.downed;
  // A los saqueadores se les derriba, no se les mata: luego se elige capturarlo o rematarlo (#22).
  hurt(b, dmg, part, b.role === 'saqueador');
  if (!wasDown && b.downed) {
    if (b.role === 'colono') w.addLog(`🩸 ${b.name} cae herido (${part}).`, 'malo', 'caido', b.tile);
    else w.addLog(`${b.name} (saqueador) cae al suelo.`, 'bueno');
    // Quienes lo ven caer pueden entrar en pánico.
    if (b.role === 'colono') witnessFall(w, b);
  } else if (b.role === 'colono' && !b.downed) {
    w.combatAlert(b, 'herido', `🩸 ${b.name} está herido (${part}) · salud ${healthLabel(b).toLowerCase()}.`);
    // Herido y con el ánimo por los suelos: puede entrar en pánico.
    maybePanic(w, b, 'herido');
  }
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
      if (d > 1 && coverAt(w, from, e.tile) >= FULL_COVER) continue;
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
  hitChance *= 1 - Math.min(FULL_COVER, coverAt(w, from, b.tile));
  if (!w.rng.chance(hitChance)) return false;
  const tough = b.traits.some((k) => k.id === 'duro') ? 0.75 : 1;
  const armor = 1 - armorProtection([b.vest, b.helmet]);
  const dmg = (0.08 + w.rng.next() * 0.1) * (1 + TURRET_AIM_SKILL * 0.03) * tough * t.damage * armor;
  const part = BODY_PARTS[w.rng.int(0, BODY_PARTS.length - 1)];
  const wasDown = b.downed;
  hurt(b, dmg, part, true);
  if (!wasDown && b.downed) w.addLog(`🔫 La ${s.def.name.toLowerCase()} derriba a ${b.name} (saqueador).`, 'bueno');
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
      if (dist > reachOf(c, w) || coverAt(w, { x, y }, enemy.tile) >= FULL_COVER) continue;
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
    const fallen = g.size - g.escaped.length - standing.length;
    const leader = members.find((o) => o.id === g.leaderId);
    const leaderDown = !g.escaped.includes(g.leaderId) && (!leader || leader.downed);
    if (!leaderDown && fallen * 2 < g.size) continue;
    g.routed = true;
    if (standing.length === 0) continue;
    for (const o of standing) {
      if (o.raider!.fleeing) continue;
      o.raider!.fleeing = true;
      o.path = [];
    }
    const name = leader?.name ?? 'su líder';
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
    if (o.downed) {
      o.path = [];
      o.activity = 'idle';
      dropGear(w, o);
      continue;
    }
    if (o.role === 'saqueador') updateRaider(w, o);
    else if (o.role === 'comerciante') updateTrader(w, o);
    else if (o.role === 'prisionero') updatePrisoner(w, o);
  }
}

/** Suelta el arma y la munición que lleva en su casilla (se pueden recoger). */
export function dropGear(w: World, c: Colonist): void {
  if (c.weapon) w.items.drop(c.tile.x, c.tile.y, c.weapon, 1);
  if (c.ammo > 0) w.items.drop(c.tile.x, c.tile.y, 'flechas', c.ammo);
  if (c.vest) w.items.drop(c.tile.x, c.tile.y, c.vest, 1);
  if (c.helmet) w.items.drop(c.tile.x, c.tile.y, c.helmet, 1);
  c.weapon = null;
  c.ammo = 0;
  c.vest = null;
  c.helmet = null;
}

function leaveMap(w: World, o: Colonist, why: string): void {
  const i = w.others.indexOf(o);
  if (i >= 0) w.others.splice(i, 1);
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

function updateRaider(w: World, o: Colonist): void {
  const r = (o.raider ??= { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY });
  if (!r.fleeing && (o.health < 0.45 || w.tick > r.leaveAt)) {
    r.fleeing = true;
    o.path = [];
    w.addLog(`${o.name} (saqueador) huye.`, 'bueno');
  }
  if (r.fleeing) {
    goAway(w, o, '');
    return;
  }
  const targets = w.colonists.filter((c) => !c.downed);
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
  if (canHit(w, o, target)) {
    o.path = [];
    o.activity = 'working';
    if (!o.attackCooldown) attack(w, o, target);
    return;
  }
  // Recalcula el camino de vez en cuando (el objetivo se mueve).
  dropShutPath(w, o);
  if (o.path.length === 0 || (w.tick + o.id) % 30 === 0) {
    const path = findPath(w.map, o.tile, target.tile, 20000, w.shutDoors);
    o.path = path ? path.slice(0, Math.max(1, path.length - 1)) : [];
    if (!path) {
      // No llega (muros): da vueltas un rato y acabará marchándose.
      o.path = [];
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
}

/** El comerciante cobra un poco más de lo que paga. */
export const TRADER_MARGIN = 1.25;

export function slaveValue(c: Colonist): number {
  return personValue(Object.values(c.skills).reduce((a, b) => a + b, 0));
}

/** Balance de un trato para la colonia (≥ 0: el comerciante acepta). */
export function dealBalance(w: World, trader: Colonist, d: TradeDeal): number {
  let give = 0;
  for (const [r, n] of Object.entries(d.sell) as [ResourceId, number][]) give += n * RESOURCE_VALUES[r];
  for (const id of d.sellPrisoners) {
    const p = w.others.find((o) => o.id === id && o.role === 'prisionero');
    if (p) give += slaveValue(p) * 0.6;
  }
  let take = 0;
  for (const [r, n] of Object.entries(d.buy) as [ResourceId, number][]) take += n * RESOURCE_VALUES[r] * TRADER_MARGIN;
  for (const id of d.slaves) {
    const s = trader.trader?.slaves.find((k) => k.id === id);
    if (s) take += slaveValue(s) * TRADER_MARGIN;
  }
  return give - take;
}

/** Hace un trato. Devuelve un motivo si no se puede, o null si se ha hecho. */
export function makeDeal(w: World, trader: Colonist, d: TradeDeal): string | null {
  const t = trader.trader;
  if (!t || t.leaving) return 'El comerciante ya se va';
  const inv = w.inventory();
  for (const [r, n] of Object.entries(d.sell) as [ResourceId, number][]) if (n > inv[r]) return `No hay tanto de ${r}`;
  for (const [r, n] of Object.entries(d.buy) as [ResourceId, number][]) if (n > (t.stock[r] ?? 0)) return `No tiene tanto de ${r}`;
  if (dealBalance(w, trader, d) < 0) return 'No le compensa: ofrece más o pide menos';
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
  return null;
}
