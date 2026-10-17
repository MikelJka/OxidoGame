// Gente que no es de la colonia y lo que trae el narrador: supervivientes que piden unirse,
// raids de saqueadores (combate cuerpo a cuerpo, huida, heridos que se pueden capturar),
// prisioneros (retener, convencer, liberar) y caravanas de comerciantes (con esclavos).
import { RESOURCES, ResourceId } from '../data/resources';
import { personValue, RESOURCE_VALUES } from '../data/values';
import type { Colonist } from './colonist';
import { BODY_PARTS, hurt } from './health';
import { findPath, Point } from './pathfinding';
import { isPassable } from './map';
import { RAID_GAP, raidSize, TRADER_GAP, WANDERER_GAP } from './storyteller';
import type { World } from './world';
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
  const days = (gap: [number, number]) => w.rng.int(gap[0] * TICKS_PER_DAY, gap[1] * TICKS_PER_DAY);
  if (w.offer && w.tick > w.offer.until) w.rejectOffer();
  if (w.gameOver) return;
  if (w.tick >= sch.nextWanderer) {
    sch.nextWanderer = w.tick + days(WANDERER_GAP);
    if (!w.offer) offerWanderer(w);
  }
  if (w.tick >= sch.nextRaid) {
    sch.nextRaid = w.tick + days(RAID_GAP);
    startRaid(w, raidSize(w.day, colonyWealth(w), w.colonists.length));
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
  w.addLog(`🚶 ${c.name} «${c.nickname}», ${c.age} años, pide unirse a la colonia.`, 'info');
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
  for (const r of out) {
    r.skills.combate = Math.max(r.skills.combate, w.rng.int(3, 10));
    w.others.push(r);
  }
  w.addLog(`⚔️ ¡Raid! ${n} ${n === 1 ? 'saqueador llega' : 'saqueadores llegan'}. Recluta a los colonos (🎖) para defenderos.`, 'malo');
  return out;
}

/** Llega una caravana: un comerciante con mercancía y, a veces, esclavos. */
export function startTrader(w: World): Colonist | null {
  const t = w.makePawn('comerciante');
  if (!w.placeAtEdge(t)) return null;
  const stock: Partial<Record<ResourceId, number>> = {};
  for (const r of RESOURCES) if (w.rng.chance(0.5)) stock[r] = w.rng.int(10, 60);
  stock.componentes = w.rng.int(2, 10);
  const slaves: Colonist[] = [];
  const nSlaves = w.rng.int(0, 2);
  for (let i = 0; i < nSlaves; i++) slaves.push(w.makePawn('prisionero'));
  t.trader = { stock, slaves, leaveAt: w.tick + Math.round(TICKS_PER_DAY * 0.75), leaving: false };
  w.others.push(t);
  const path = findPath(w.map, t.tile, nearFree(w, w.map.start) ?? w.map.start, 60000);
  if (path) t.path = path;
  w.addLog(`🐫 Llega una caravana de ${t.name}${nSlaves ? ` con ${nSlaves} ${nSlaves === 1 ? 'esclavo' : 'esclavos'}` : ''}. Toca al comerciante para comerciar.`, 'bueno');
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

/** Un golpe cuerpo a cuerpo. Devuelve true si acierta. */
export function attack(w: World, a: Colonist, b: Colonist): boolean {
  a.attackCooldown = ATTACK_COOLDOWN;
  const dx = b.pos.x - a.pos.x;
  if (Math.abs(dx) > 0.01) a.facing = dx > 0 ? 1 : -1;
  const hitChance = Math.min(0.95, 0.55 + a.skills.combate * 0.02);
  if (!w.rng.chance(hitChance)) return false;
  const tough = b.traits.some((t) => t.id === 'duro') ? 0.75 : 1;
  const dmg = (0.08 + w.rng.next() * 0.1) * (1 + a.skills.combate * 0.03) * tough;
  const part = BODY_PARTS[w.rng.int(0, BODY_PARTS.length - 1)];
  const wasDown = b.downed;
  hurt(b, dmg, part);
  if (!wasDown && b.downed) {
    w.addLog(b.role === 'colono' ? `🩸 ${b.name} cae herido (${part}).` : `${b.name} (saqueador) cae al suelo.`, b.role === 'colono' ? 'malo' : 'bueno');
  }
  return true;
}

const adjacent = (a: Colonist, b: Colonist) => Math.max(Math.abs(a.tile.x - b.tile.x), Math.abs(a.tile.y - b.tile.y)) <= 1;

/** Defensa de un colono: golpea a un saqueador pegado a él; reclutado, además va a por los cercanos. true si ha actuado. */
export function colonistFight(w: World, c: Colonist): boolean {
  if (c.downed) return false;
  if (c.attackCooldown && c.attackCooldown > 0) c.attackCooldown--;
  const enemies = w.others.filter(hostile);
  if (enemies.length === 0) return false;
  const near = enemies.find((e) => adjacent(c, e));
  if (near) {
    if (!c.attackCooldown) attack(w, c, near);
    if (c.drafted || c.job === null) {
      c.path = [];
      return true;
    }
    return false;
  }
  if (!c.drafted || c.path.length > 0) return false;
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

// --- Gente que no es de la colonia ----------------------------------------------------

export function updateOthers(w: World): void {
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
      continue;
    }
    if (o.role === 'saqueador') updateRaider(w, o);
    else if (o.role === 'comerciante') updateTrader(w, o);
    else if (o.role === 'prisionero') updatePrisoner(w, o);
  }
}

function leaveMap(w: World, o: Colonist, why: string): void {
  const i = w.others.indexOf(o);
  if (i >= 0) w.others.splice(i, 1);
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
      const path = findPath(m, o.tile, p, 30000);
      if (path) {
        o.path = path;
        return;
      }
    }
  }
  // No hay salida: se queda (y se rinde si es saqueador).
  leaveMap(w, o, why);
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
        o.path = findPath(w.map, o.tile, stack, 30000) ?? [];
        if (o.path.length === 0) r.fleeing = true;
      }
    }
    if (o.path.length) w.moveAlongPath(o);
    return;
  }
  const target = targets.sort((a, b) => Math.abs(a.tile.x - o.tile.x) + Math.abs(a.tile.y - o.tile.y) - (Math.abs(b.tile.x - o.tile.x) + Math.abs(b.tile.y - o.tile.y)))[0];
  if (adjacent(o, target)) {
    o.path = [];
    o.activity = 'working';
    if (!o.attackCooldown) attack(w, o, target);
    return;
  }
  // Recalcula el camino de vez en cuando (el objetivo se mueve).
  if (o.path.length === 0 || (w.tick + o.id) % 30 === 0) {
    const path = findPath(w.map, o.tile, target.tile, 20000);
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
