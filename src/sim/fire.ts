// Fuego (incendio grande, pedido por Mikel el 2026-10-21): casillas que arden y lo pasan a las de
// al lado según lo que haya en ellas (árboles, matorrales, tierra seca, cultivos, madera, lo
// construido con madera). Quema lo que hay, hace daño a quien está dentro y, si llega cerca de la
// colonia, los colonos van a apagarlo. Puro y determinista: sin Phaser ni DOM.
import { FIRE, FuelKind } from '../data/fire';
import { index, inBounds, isWater, Prop, Terrain } from './map';
import { Rng } from './rng';
import { TICKS_PER_DAY, TICKS_PER_SECOND } from './time';
import type { World } from './world';
import { DOWNED } from './health';
import type { Colonist } from './colonist';
import { seasonOf } from '../data/seasons';
import { blastAt } from './grenades';
import { wreckVehicle } from './vehicles';

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Lo que arde en una casilla (lo que más dura), o null si nada. */
export function fuelAt(w: World, x: number, y: number): FuelKind | null {
  const m = w.map;
  if (!inBounds(m, x, y)) return null;
  const i = index(m, x, y);
  const t = m.terrain[i] as Terrain;
  if (isWater(t)) return null;
  const s = w.structures.at(x, y);
  if (s && (s.def.cost.madera ?? 0) > 0) return 'structure';
  const p = m.props[i] as Prop;
  if (p === Prop.DeadTree || p === Prop.Stump) return 'tree';
  if (p === Prop.Bush) return 'bush';
  if (p === Prop.Tires) return 'tires';
  if (w.farms.plantAt(x, y)) return 'plant';
  const st = w.items.at(x, y);
  if (st && FIRE.flammableItems.includes(st.resource)) return 'item';
  // La tierra seca arde un momento (si no se ha quemado hace poco y no hay nada que no arda encima).
  if (t === Terrain.Soil && !s && !m.trench[i]) {
    const burnt = w.burnt.get(i);
    if (burnt === undefined || w.tick - burnt > FIRE.noRegrowDays * TICKS_PER_DAY) return 'soil';
  }
  return null;
}

/** Prende fuego a una casilla (si hay algo que arda). */
export function ignite(w: World, x: number, y: number): boolean {
  if (!inBounds(w.map, x, y)) return false;
  const i = index(w.map, x, y);
  if (w.fires.has(i) || w.fires.size >= FIRE.maxFires || !fuelAt(w, x, y)) return false;
  w.fires.set(i, 0);
  w.fireVersion++;
  return true;
}

/** Apaga una casilla. */
export function extinguish(w: World, x: number, y: number): boolean {
  const i = index(w.map, x, y);
  if (!w.fires.delete(i)) return false;
  w.fireVersion++;
  return true;
}

/** La casilla está ardiendo. */
export function burning(w: World, x: number, y: number): boolean {
  return inBounds(w.map, x, y) && w.fires.has(index(w.map, x, y));
}

/** El fuego de esa casilla amenaza la colonia: cerca de su punto o de algo construido. */
export function threatens(w: World, x: number, y: number): boolean {
  const R = FIRE.threatRange;
  const home = w.colonyPoint();
  if (home && Math.abs(home.x - x) + Math.abs(home.y - y) <= R) return true;
  // Lo construido: basta con el rectángulo que lo abarca todo, ensanchado (se calcula una vez por segundo).
  const box = builtBox(w);
  const r = R / 2;
  return !!box && x >= box[0] - r && x <= box[2] + r && y >= box[1] - r && y <= box[3] + r;
}

const boxCache = new WeakMap<World, { key: number; box: [number, number, number, number] | null }>();

/** Rectángulo [x0, y0, x1, y1] que abarca todo lo construido (o null). */
function builtBox(w: World): [number, number, number, number] | null {
  const key = w.structures.version;
  const hit = boxCache.get(w);
  if (hit && hit.key === key) return hit.box;
  let box: [number, number, number, number] | null = null;
  for (const s of w.structures.all()) {
    if (!s.built) continue;
    box = box ? [Math.min(box[0], s.x), Math.min(box[1], s.y), Math.max(box[2], s.x), Math.max(box[3], s.y)] : [s.x, s.y, s.x, s.y];
  }
  boxCache.set(w, { key, box });
  return box;
}

/** Un segundo de fuego: arde lo que hay, se extiende y se apaga lo que se ha consumido. */
export function updateFires(w: World): void {
  if (w.fires.size === 0) return;
  const m = w.map;
  const rng = new Rng(((m.seed ^ 0x0f1a3e5d) + Math.floor(w.tick / TICKS_PER_SECOND) * 0x9e3779b1) >>> 0);
  const rain = w.weather.some((e) => w.tick < e.until && e.id === 'lluvia_acida');
  const factor = (1 + FIRE.windSpread * w.wind) * (rain ? FIRE.rainSpread : 1) * (FIRE.seasonSpread[seasonOf(w.day).id] ?? 1);
  const [wx, wy] = SIDES[windDirection(w)];
  const spreadTo: number[] = [];
  for (const [i, age] of [...w.fires]) {
    const x = i % m.width;
    const y = (i - x) / m.width;
    const fuel = fuelAt(w, x, y);
    if (!fuel) {
      w.fires.delete(i);
      continue;
    }
    const next = age + 1;
    w.fires.set(i, next);
    // Quien está dentro se quema.
    for (const c of w.pawns()) {
      if (c.tile.x !== x || c.tile.y !== y || c.vehicle?.boarded) continue;
      burn(c, FIRE.harmPerSecond);
      if (c.role === 'colono') w.combatAlert(c, 'herido', `🔥 ${c.name} se está quemando.`);
    }
    // Lo construido con madera pierde vida hasta romperse (y lo que lleva combustible, explota).
    const s = w.structures.at(x, y);
    if (fuel === 'structure' && s) {
      s.hp -= Math.max(1, Math.ceil(s.def.hp / FIRE.burnSeconds.structure));
      if (s.hp <= 0) {
        w.breakStructure(s);
        w.addLog(`🔥 El fuego destruye: ${s.def.name.toLowerCase()}.`, 'malo', undefined, { x, y });
        if (s.def.explodes) explodeAt(w, { x, y }, `💥 ¡Explota ${s.def.name.toLowerCase()}!`);
      }
    }
    // Un montón de ⛽, napalm o granadas que arde, explota.
    const st = w.items.at(x, y);
    if (st && FIRE.explosiveItems.includes(st.resource)) {
      w.items.take(x, y, st.amount);
      explodeAt(w, { x, y }, `💥 ¡Explota un montón de ${st.resource} que estaba ardiendo!`);
    }
    // Los vehículos encima se queman (y si se rompen con ⛽ dentro, explotan).
    for (const v of [...w.vehicles]) {
      if (x < v.x || x > v.x + 1 || y < v.y || y > v.y + 1) continue;
      v.hp -= FIRE.vehicleBurnPerSecond;
      if (v.hp <= 0) wreckVehicle(w, v, '🔥 El fuego destroza un vehículo', true);
    }
    // Se extiende a las de al lado.
    for (const [dx, dy] of SIDES) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(m, nx, ny) || w.fires.has(index(m, nx, ny))) continue;
      const f = fuelAt(w, nx, ny);
      const dir = dx === wx && dy === wy ? FIRE.downwind : dx === -wx && dy === -wy ? FIRE.upwind : 1;
      if (f && rng.chance(Math.min(0.9, FIRE.spread[f] * factor * dir))) spreadTo.push(index(m, nx, ny));
    }
    // Consumido: se apaga y deja lo quemado.
    if (fuel !== 'structure' && next >= FIRE.burnSeconds[fuel]) {
      burnOut(w, x, y, fuel);
      w.fires.delete(i);
    }
  }
  for (const i of spreadTo) ignite(w, i % m.width, Math.floor(i / m.width));
  w.fireVersion++;
}

/** Lo que queda al consumirse el fuego de una casilla. */
function burnOut(w: World, x: number, y: number, fuel: FuelKind): void {
  const m = w.map;
  const i = index(m, x, y);
  if (fuel === 'tree' || fuel === 'bush' || fuel === 'tires') {
    m.props[i] = Prop.None;
    w.markChanged(i);
  } else if (fuel === 'plant') w.farms.uproot(x, y);
  else if (fuel === 'item') {
    const st = w.items.at(x, y);
    if (st) w.items.take(x, y, st.amount);
  }
  w.burnt.set(i, w.tick);
}

/** Suceso: un incendio grande en un sitio al azar con algo que arda, lejos de la colonia. */
export function startWildfire(w: World, rng: Rng): boolean {
  const m = w.map;
  const home = w.colonyPoint() ?? { x: Math.floor(m.width / 2), y: Math.floor(m.height / 2) };
  for (let tries = 0; tries < 200; tries++) {
    const x = rng.int(1, m.width - 2);
    const y = rng.int(1, m.height - 2);
    if (Math.abs(x - home.x) + Math.abs(y - home.y) < FIRE.event.minDistance) continue;
    const f = fuelAt(w, x, y);
    if (f !== 'tree' && f !== 'bush') continue;
    const r = FIRE.event.startRadius;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) ignite(w, x + dx, y + dy);
    w.addLog(`🔥 ¡Incendio! Ha prendido fuego en el monte y se extiende (el viento sopla ${WIND_NAMES[windDirection(w)]}). Si llega cerca de la colonia, los colonos irán a apagarlo.`, 'malo', 'raid', { x, y });
    return true;
  }
  return false;
}

/** Lee el fuego de una partida guardada. */
export function restoreFires(w: World, fires: unknown, burnt: unknown): void {
  w.fires.clear();
  w.burnt.clear();
  const n = w.map.width * w.map.height;
  if (Array.isArray(fires)) for (const f of fires) if (Array.isArray(f) && f[0] >= 0 && f[0] < n) w.fires.set(Math.floor(f[0]), Math.max(0, Math.floor(f[1] ?? 0)));
  if (Array.isArray(burnt)) for (const b of burnt) if (Array.isArray(b) && b[0] >= 0 && b[0] < n) w.burnt.set(Math.floor(b[0]), Math.floor(b[1] ?? 0));
}

/** Quemadura: quita salud y deja una herida que no sangra (una por cada vez que pisa el fuego). */
function burn(c: Colonist, amount: number): void {
  c.health = Math.max(0, c.health - amount);
  const w = c.wounds.find((k) => k.part === 'quemaduras' && !k.treated);
  if (w) w.severity = Math.min(1, w.severity + amount * 2.5);
  else c.wounds.push({ part: 'quemaduras', severity: Math.min(1, amount * 2.5), bleeding: false, treated: false });
  if (c.health < DOWNED) c.downed = true;
}

/** Hacia dónde sopla hoy el viento (índice de los cuatro lados: este, oeste, sur, norte). */
export function windDirection(w: World): number {
  return new Rng(((w.map.seed ^ 0x77d1e5) + w.day * 0x9e3779b1) >>> 0).int(0, 3);
}

export const WIND_NAMES = ['al este', 'al oeste', 'al sur', 'al norte'] as const;

/** Una explosión: hiere y daña alrededor y prende fuego a lo que arda cerca. */
export function explodeAt(w: World, at: { x: number; y: number }, text: string): void {
  const e = FIRE.explosion;
  w.addLog(text, 'malo', 'combate', at);
  blastAt(w, at, e.radius, e.damage, e.structureDamage, 'La explosión', 'la explosión');
  for (let dy = -e.radius; dy <= e.radius; dy++) for (let dx = -e.radius; dx <= e.radius; dx++) ignite(w, at.x + dx, at.y + dy);
}

/** Un rayo cae en una casilla al azar del mapa y prende lo que haya (tormenta eléctrica). */
export function lightningStrike(w: World, rng: Rng): { x: number; y: number } | null {
  const m = w.map;
  for (let tries = 0; tries < 40; tries++) {
    const x = rng.int(0, m.width - 1);
    const y = rng.int(0, m.height - 1);
    if (!fuelAt(w, x, y)) continue;
    ignite(w, x, y);
    return { x, y };
  }
  return null;
}
