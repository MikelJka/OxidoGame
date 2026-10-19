// Vehículos de la colonia (vehículos, segunda parte: el buggy de los colonos).
// Un vehículo ocupa 2×2 casillas; su casilla de referencia (`x`, `y`) es la de arriba a la
// izquierda. Lo llevan colonos sentados en él: el conductor lo mueve y el tirador dispara desde
// dentro. En marcha gasta ⛽ y atropella a los saqueadores que pilla (los derriba, no los mata).
// Puro y determinista: sin Phaser ni DOM.
import type { Colonist } from './colonist';
import type { World } from './world';
import { isPassable } from './map';
import { Point } from './pathfinding';
import { attack, canHit, foeLabel, hurtFoe } from './people';
import { VehicleDef, vehicleDef } from '../data/vehicles';

/** Lado del vehículo en casillas (todos son de 2×2 por ahora). */
export const VEHICLE_SIZE = 2;
/** Casillas de un montón de ⛽ a las que tiene que estar aparcado para repostar solo. */
export const REFUEL_REACH = 2;
/** Nodos máximos al buscar camino para un vehículo. */
const VEHICLE_PATH_NODES = 30000;

export type VehicleSeat = 'conductor' | 'tirador';
export const VEHICLE_SEATS: readonly VehicleSeat[] = ['conductor', 'tirador'];

export interface Vehicle {
  id: number;
  /** Id de su definición en `vehicles.json`. */
  def: string;
  /** Casilla de arriba a la izquierda. */
  x: number;
  y: number;
  /** Posición continua de esa esquina (para moverse suave). */
  pos: { x: number; y: number };
  /** Casillas (de esquina) que le quedan por recorrer. */
  path: Point[];
  /** ⛽ en el depósito. */
  fuel: number;
  hp: number;
  facing: 1 | -1;
}

/** Sitio de un colono en un vehículo. `boarded`: ya está dentro (si no, va hacia él). */
export interface VehicleSeatInfo {
  id: number;
  seat: VehicleSeat;
  boarded: boolean;
}

export function defOf(v: Vehicle): VehicleDef {
  return vehicleDef(v.def)!;
}

/** Casillas que ocupa con la esquina en (x, y). */
export function footprint(x: number, y: number): Point[] {
  const out: Point[] = [];
  for (let dy = 0; dy < VEHICLE_SIZE; dy++) for (let dx = 0; dx < VEHICLE_SIZE; dx++) out.push({ x: x + dx, y: y + dy });
  return out;
}

/** Cabe con la esquina en (x, y): todas sus casillas se pueden pisar. */
export function fits(w: World, x: number, y: number): boolean {
  return footprint(x, y).every((t) => isPassable(w.map, t.x, t.y));
}

/** Centro del vehículo (donde se ven los que van dentro). */
export function vehicleCenter(v: Vehicle): { x: number; y: number } {
  return { x: v.pos.x + VEHICLE_SIZE / 2, y: v.pos.y + VEHICLE_SIZE / 2 };
}

/** El vehículo ocupa la casilla (x, y). */
export function covers(v: Vehicle, x: number, y: number): boolean {
  return x >= v.x && x < v.x + VEHICLE_SIZE && y >= v.y && y < v.y + VEHICLE_SIZE;
}

/** Quién va (o va hacia) cada asiento. */
export function occupant(w: World, v: Vehicle, seat: VehicleSeat): Colonist | undefined {
  return w.colonists.find((c) => c.vehicle?.id === v.id && c.vehicle.seat === seat);
}

/** Quién va sentado (ya dentro) en un asiento. */
export function seated(w: World, v: Vehicle, seat: VehicleSeat): Colonist | undefined {
  const c = occupant(w, v, seat);
  return c?.vehicle?.boarded ? c : undefined;
}

/**
 * Camino para la esquina del vehículo, de casilla en casilla (sin diagonales), por donde quepa
 * entero. Dijkstra con el coste de paso de cada casilla. null si no hay.
 */
export function vehiclePath(w: World, from: Point, to: Point): Point[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  if (!fits(w, to.x, to.y)) return null;
  const W = w.map.width;
  const key = (x: number, y: number) => y * W + x;
  const dist = new Map<number, number>([[key(from.x, from.y), 0]]);
  const prev = new Map<number, number>();
  // Cola de prioridad sencilla (montículo binario).
  const heap: [number, number][] = [[0, key(from.x, from.y)]];
  const push = (d: number, k: number) => {
    heap.push([d, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const goal = key(to.x, to.y);
  let seen = 0;
  while (heap.length > 0 && seen < VEHICLE_PATH_NODES) {
    const [d, k] = pop();
    if (d > (dist.get(k) ?? Infinity)) continue;
    seen++;
    if (k === goal) break;
    const x = k % W;
    const y = (k - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!fits(w, nx, ny)) continue;
      const nk = key(nx, ny);
      const nd = d + w.moveCostAt(nx, ny);
      if (nd >= (dist.get(nk) ?? Infinity)) continue;
      dist.set(nk, nd);
      prev.set(nk, k);
      push(nd, nk);
    }
  }
  if (!prev.has(goal)) return null;
  const path: Point[] = [];
  for (let k = goal; k !== key(from.x, from.y); k = prev.get(k)!) {
    const x = k % W;
    path.push({ x, y: (k - x) / W });
  }
  return path.reverse();
}

/**
 * Esquina a la que ir para que el vehículo quede sobre la casilla tocada: primero con la casilla
 * arriba a la izquierda, si no cabe, en las otras tres posiciones.
 */
export function anchorFor(w: World, t: Point): Point | null {
  for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    const a = { x: t.x + dx, y: t.y + dy };
    if (fits(w, a.x, a.y)) return a;
  }
  return null;
}

/** Casilla libre pegada al vehículo más cercana a `from` (para subir o bajar). */
export function besideTiles(w: World, v: Vehicle): Point[] {
  const out: Point[] = [];
  for (let y = v.y - 1; y <= v.y + VEHICLE_SIZE; y++) {
    for (let x = v.x - 1; x <= v.x + VEHICLE_SIZE; x++) {
      if (covers(v, x, y) || !isPassable(w.map, x, y)) continue;
      out.push({ x, y });
    }
  }
  return out;
}

/** Está pegado al vehículo (o encima). */
export function nextTo(v: Vehicle, t: Point): boolean {
  return t.x >= v.x - 1 && t.x <= v.x + VEHICLE_SIZE && t.y >= v.y - 1 && t.y <= v.y + VEHICLE_SIZE;
}

/**
 * Un paso de simulación del vehículo: si tiene conductor, camino y ⛽, avanza (el doble de rápido
 * que un colono), gasta combustible y atropella; parado junto a un montón de ⛽, reposta solo.
 */
export function updateVehicle(w: World, v: Vehicle, ticksPerSecond: number, ticksPerHour: number, baseWalk: number): void {
  const def = defOf(v);
  const driver = seated(w, v, 'conductor');
  if (v.path.length > 0 && driver && v.fuel > 0) {
    const next = v.path[0];
    if (!fits(w, next.x, next.y)) {
      // Algo se ha puesto en medio (un muro nuevo): se para.
      v.path = [];
    } else {
      let budget = (baseWalk * def.speed) / ticksPerSecond / w.moveCostAt(next.x, next.y);
      while (budget > 0 && v.path.length > 0) {
        const t = v.path[0];
        const dx = t.x - v.pos.x;
        const dy = t.y - v.pos.y;
        const dist = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.01) v.facing = dx > 0 ? 1 : -1;
        if (dist <= budget) {
          v.pos = { x: t.x, y: t.y };
          v.x = t.x;
          v.y = t.y;
          v.path.shift();
          budget -= dist;
        } else {
          v.pos = { x: v.pos.x + (dx / dist) * budget, y: v.pos.y + (dy / dist) * budget };
          budget = 0;
        }
      }
      // La casilla de referencia es la más cercana a donde está (para atropellar y para las paradas).
      v.x = Math.round(v.pos.x);
      v.y = Math.round(v.pos.y);
      v.fuel = Math.max(0, v.fuel - def.fuelPerHour / ticksPerHour);
      if (v.fuel <= 0) {
        v.path = [];
        v.pos = { x: v.x, y: v.y };
        w.addLog(`⛽ El ${def.name.toLowerCase()} se ha quedado sin combustible.`, 'malo');
      }
      runOver(w, v, def);
    }
  } else if (v.path.length > 0 && !driver) {
    v.path = [];
  }
  if (v.path.length === 0) {
    v.pos = { x: v.x, y: v.y };
    if (w.tick % ticksPerSecond === 0) refuel(w, v, def);
  }
  // Los que van dentro se mueven con él; el tirador dispara a lo que tenga a tiro.
  const at = vehicleCenter(v);
  for (const c of w.colonists) {
    if (c.vehicle?.id !== v.id || !c.vehicle.boarded) continue;
    c.pos = { x: at.x, y: at.y };
    c.tile = { x: v.x + 1, y: v.y + 1 };
    c.path = [];
    c.facing = v.facing;
    c.activity = 'idle';
    if (c.vehicle.seat === 'tirador') gunnerFight(w, c);
  }
}

/** Atropella a los saqueadores de pie que pilla: los deja en el suelo (como un golpe, no mata); a un perro mutante, lo mata. */
function runOver(w: World, v: Vehicle, def: VehicleDef): void {
  for (const o of [...w.others]) {
    if (o.role !== 'saqueador' || o.downed || !covers(v, o.tile.x, o.tile.y)) continue;
    const last = w.runOverAt.get(o.id);
    if (last !== undefined && w.tick - last < 60) continue;
    w.runOverAt.set(o.id, w.tick);
    const fell = hurtFoe(w, o, def.runOverDamage, 'las piernas');
    const what = fell ? (o.creature ? ': muere' : ': cae al suelo') : '';
    w.addLog(`🚙 El ${def.name.toLowerCase()} atropella a ${foeLabel(o)}${what}.`, 'bueno');
  }
}

/** Parado junto a un montón de ⛽ (a 2 casillas o menos), llena el depósito con él. */
function refuel(w: World, v: Vehicle, def: VehicleDef): void {
  const room = Math.floor(def.fuelCapacity - v.fuel);
  if (room <= 0) return;
  for (const s of w.items.list()) {
    if (s.resource !== 'combustible') continue;
    if (s.x < v.x - REFUEL_REACH || s.x > v.x + VEHICLE_SIZE - 1 + REFUEL_REACH || s.y < v.y - REFUEL_REACH || s.y > v.y + VEHICLE_SIZE - 1 + REFUEL_REACH) continue;
    const got = w.items.take(s.x, s.y, room);
    if (got) {
      v.fuel = Math.min(def.fuelCapacity, v.fuel + got.amount);
      w.addLog(`⛽ El ${def.name.toLowerCase()} reposta ${got.amount} ⛽ (${Math.floor(v.fuel)}/${def.fuelCapacity}).`, 'info');
    }
    return;
  }
}

/** El tirador dispara (o golpea) al saqueador más cercano que tenga a tiro, sin bajarse. */
function gunnerFight(w: World, c: Colonist): void {
  if (c.attackCooldown && c.attackCooldown > 0) c.attackCooldown--;
  if (c.attackCooldown) return;
  const enemies = w.others.filter((o) => o.role === 'saqueador' && !o.downed && !o.raider?.fleeing && canHit(w, c, o));
  if (enemies.length === 0) return;
  enemies.sort((a, b) => Math.abs(a.tile.x - c.tile.x) + Math.abs(a.tile.y - c.tile.y) - (Math.abs(b.tile.x - c.tile.x) + Math.abs(b.tile.y - c.tile.y)));
  attack(w, c, enemies[0]);
}

/** Parte del daño que se ahorra un colono por ir dentro de un vehículo (0 si va a pie). */
export function vehicleArmorFor(w: World, c: Colonist): number {
  if (!c.vehicle?.boarded) return 0;
  const v = w.vehicles.find((k) => k.id === c.vehicle!.id);
  return v ? defOf(v).armor : 0;
}
