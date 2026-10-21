// Vehículos: el buggy de los colonos (segunda parte) y el de los saqueadores (tercera parte).
// Un vehículo ocupa 2×2 casillas; su casilla de referencia (`x`, `y`) es la de arriba a la
// izquierda. Lo llevan colonos sentados en él: el conductor lo mueve y el tirador dispara desde
// dentro. En marcha gasta ⛽ y atropella a los saqueadores que pilla (los derriba, no los mata).
// El de los saqueadores lo llevan ellos solos: va a por el colono más cercano para atropellarlo,
// su tirador dispara a los colonos, y al huir se va por el borde. El blindaje se lleva parte de los
// golpes a los de dentro; si se queda sin vida (o sin nadie dentro, el de los saqueadores), queda
// como chatarra.
// Puro y determinista: sin Phaser ni DOM.
import type { Colonist } from './colonist';
import type { World } from './world';
import { index, inBounds, isPassable, isWater, PROP_INFO, Prop, Terrain } from './map';
import { Point } from './pathfinding';
import { attack, canHit, foeLabel, hurtFoe, leaveMap } from './people';
import { hurt } from './health';
import { theName, usesFuel, VehicleDef, vehicleDef } from '../data/vehicles';
import { explodeAt } from './fire';

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

/**
 * Un barco puede estar en la casilla: agua (cualquiera) sin puente, plataforma, construcción ni
 * objeto que corte el paso.
 */
export function canFloat(w: World, x: number, y: number): boolean {
  const m = w.map;
  if (!inBounds(m, x, y)) return false;
  const i = index(m, x, y);
  return isWater(m.terrain[i] as Terrain) && m.bridge[i] === 0 && m.blocked[i] === 0 && !PROP_INFO[m.props[i] as Prop].blocks && !w.structures.at(x, y);
}

/**
 * La balsa de los saqueadores pasa por debajo de un puente levadizo bajado (elegido por Mikel el
 * 2026-10-21); los puentes, las plataformas y el levadizo alzado la paran.
 */
function underDrawbridge(w: World, x: number, y: number): boolean {
  const m = w.map;
  if (!inBounds(m, x, y)) return false;
  const i = index(m, x, y);
  if (!isWater(m.terrain[i] as Terrain) || PROP_INFO[m.props[i] as Prop].blocks) return false;
  const s = w.structures.at(x, y);
  return !!s && s.built && !!s.def.drawbridge && !s.raised && !w.structures.floorAt(x, y);
}

/**
 * Cabe con la esquina en (x, y): todas sus casillas se pueden pisar (un barco, todas de agua
 * libre). Sin `def`, como un vehículo de tierra.
 */
export function fits(w: World, x: number, y: number, def?: VehicleDef): boolean {
  if (def?.water && def.hostile) return footprint(x, y).every((t) => canFloat(w, t.x, t.y) || underDrawbridge(w, t.x, t.y));
  if (def?.water) return footprint(x, y).every((t) => canFloat(w, t.x, t.y));
  return footprint(x, y).every((t) => isPassable(w.map, t.x, t.y));
}

/** Coste de pasar por una casilla para el vehículo (un barco, igual en cualquier agua). */
function costFor(w: World, x: number, y: number, def?: VehicleDef): number {
  return def?.water ? 1 : w.moveCostAt(x, y);
}

/** Centro del vehículo (donde se ven los que van dentro). */
export function vehicleCenter(v: Vehicle): { x: number; y: number } {
  return { x: v.pos.x + VEHICLE_SIZE / 2, y: v.pos.y + VEHICLE_SIZE / 2 };
}

/** El vehículo ocupa la casilla (x, y). */
export function covers(v: Vehicle, x: number, y: number): boolean {
  return x >= v.x && x < v.x + VEHICLE_SIZE && y >= v.y && y < v.y + VEHICLE_SIZE;
}

/** Quién va (o va hacia) cada asiento (colonos o, en el de los saqueadores, saqueadores). */
export function occupant(w: World, v: Vehicle, seat: VehicleSeat): Colonist | undefined {
  return w.pawns().find((c) => c.vehicle?.id === v.id && c.vehicle.seat === seat);
}

/** Todos los que van dentro (ya sentados). */
export function riders(w: World, v: Vehicle): Colonist[] {
  return w.pawns().filter((c) => c.vehicle?.id === v.id && c.vehicle.boarded);
}

/** Es de los saqueadores. */
export function isHostileVehicle(v: Vehicle): boolean {
  return !!defOf(v).hostile;
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
export function vehiclePath(w: World, from: Point, to: Point, def?: VehicleDef): Point[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  if (!fits(w, to.x, to.y, def)) return null;
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
      if (!fits(w, nx, ny, def)) continue;
      const nk = key(nx, ny);
      const nd = d + costFor(w, nx, ny, def);
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
export function anchorFor(w: World, t: Point, def?: VehicleDef): Point | null {
  for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    const a = { x: t.x + dx, y: t.y + dy };
    if (fits(w, a.x, a.y, def)) return a;
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
  if (def.hostile && !driveRaider(w, v)) return;
  const driver = seated(w, v, 'conductor');
  const fueled = !usesFuel(def) || v.fuel > 0;
  if (v.path.length > 0 && driver && fueled) {
    const next = v.path[0];
    if (!fits(w, next.x, next.y, def)) {
      // Algo se ha puesto en medio (un muro nuevo): se para.
      v.path = [];
    } else {
      let budget = (baseWalk * def.speed) / ticksPerSecond / costFor(w, next.x, next.y, def);
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
      if (usesFuel(def) && v.fuel <= 0) {
        v.path = [];
        v.pos = { x: v.x, y: v.y };
        w.addLog(`⛽ ${theName(def, true)} se ha quedado sin combustible.`, 'malo');
      }
      runOver(w, v, def);
    }
  } else if (v.path.length > 0 && !driver) {
    v.path = [];
  }
  if (v.path.length === 0) {
    v.pos = { x: v.x, y: v.y };
    if (!def.hostile && w.tick % ticksPerSecond === 0) refuel(w, v, def);
  }
  // Los que van dentro se mueven con él; el tirador dispara a lo que tenga a tiro.
  const at = vehicleCenter(v);
  for (const c of riders(w, v)) {
    c.pos = { x: at.x, y: at.y };
    c.tile = { x: v.x + 1, y: v.y + 1 };
    c.path = [];
    c.facing = v.facing;
    c.activity = 'idle';
    if (c.vehicle!.seat === 'tirador') gunnerFight(w, c, !!def.hostile);
  }
}

/**
 * Atropella a los saqueadores de pie que pilla: los deja en el suelo (como un golpe, no mata); a un
 * perro mutante, lo mata. El de los saqueadores atropella a los colonos.
 */
function runOver(w: World, v: Vehicle, def: VehicleDef): void {
  // La balsa no atropella a nadie.
  if (!(def.runOverDamage > 0)) return;
  if (def.hostile) {
    runOverColonists(w, v, def);
    return;
  }
  for (const o of [...w.others]) {
    if (o.role !== 'saqueador' || o.downed || o.vehicle?.boarded || !covers(v, o.tile.x, o.tile.y)) continue;
    const last = w.runOverAt.get(o.id);
    if (last !== undefined && w.tick - last < 60) continue;
    w.runOverAt.set(o.id, w.tick);
    const fell = hurtFoe(w, o, def.runOverDamage, 'las piernas');
    const what = fell ? (o.creature ? ': muere' : ': cae al suelo') : '';
    w.addLog(`🚙 ${theName(def, true)} atropella a ${foeLabel(o)}${what}.`, 'bueno');
  }
}

/** El buggy de los saqueadores pilla a los colonos que van a pie. */
function runOverColonists(w: World, v: Vehicle, def: VehicleDef): void {
  for (const c of [...w.colonists]) {
    if (c.downed || c.vehicle?.boarded || !covers(v, c.tile.x, c.tile.y)) continue;
    const last = w.runOverAt.get(c.id);
    if (last !== undefined && w.tick - last < 60) continue;
    w.runOverAt.set(c.id, w.tick);
    hurt(c, def.runOverDamage, 'las piernas');
    if (c.downed) w.addLog(`🚙 ${theName(def, true)} atropella a ${c.name}: cae herido.`, 'malo', 'caido', c.tile);
    else w.combatAlert(c, 'herido', `🚙 ${theName(def, true)} atropella a ${c.name}.`);
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
      w.addLog(`⛽ ${theName(def, true)} reposta ${got.amount} ⛽ (${Math.floor(v.fuel)}/${def.fuelCapacity}).`, 'info');
    }
    return;
  }
}

/** El tirador dispara (o golpea) al enemigo más cercano que tenga a tiro, sin bajarse (el de los saqueadores, a los colonos). */
function gunnerFight(w: World, c: Colonist, hostile: boolean): void {
  // Al saqueador se le baja el tiempo de espera en `updateOthers`; al colono, aquí.
  if (!hostile && c.attackCooldown && c.attackCooldown > 0) c.attackCooldown--;
  if (c.attackCooldown) return;
  if (hostile && c.raider?.fleeing) return;
  const enemies = hostile
    ? [...w.colonists, ...w.others.filter((k) => k.role === 'aliado')].filter((k) => !k.downed && canHit(w, c, k))
    : w.others.filter((o) => o.role === 'saqueador' && !o.downed && !o.raider?.fleeing && canHit(w, c, o));
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

/**
 * Golpe a alguien que va dentro de un vehículo: el blindaje se lleva su parte (que le quita vida al
 * vehículo) y devuelve el daño que le llega a él. A pie, el daño entero.
 */
export function absorbHit(w: World, c: Colonist, dmg: number): number {
  if (!c.vehicle?.boarded) return dmg;
  const v = w.vehicles.find((k) => k.id === c.vehicle!.id);
  if (!v) return dmg;
  const def = defOf(v);
  const stopped = dmg * def.armor;
  v.hp -= stopped * def.damageScale;
  if (v.hp <= 0) wreckVehicle(w, v, `💥 ${theName(def, true)} queda destrozad${def.feminine ? 'a' : 'o'}`, true);
  return dmg - stopped;
}

/** El vehículo se rompe: los de dentro se bajan y queda su chatarra en el suelo. */
export function wreckVehicle(w: World, v: Vehicle, why: string, blownUp = false): void {
  const def = defOf(v);
  // Roto a golpes o por el fuego con ⛽ en el depósito: explota.
  const boom = blownUp && def.fuelCapacity > 0 && v.fuel > 0;
  for (const c of riders(w, v)) w.leaveVehicle(c);
  for (const c of w.pawns()) if (c.vehicle?.id === v.id) delete c.vehicle;
  const i = w.vehicles.indexOf(v);
  if (i >= 0) w.vehicles.splice(i, 1);
  const parts: string[] = [];
  for (const [r, n] of Object.entries(def.wreck) as [Parameters<World['items']['drop']>[2], number][]) {
    w.items.drop(v.x, v.y, r, n);
    parts.push(`${n} de ${r}`);
  }
  w.addLog(`${why}: deja ${parts.join(', ') || 'nada'}.`, def.hostile ? 'bueno' : 'malo', undefined, { x: v.x, y: v.y });
  if (boom) explodeAt(w, { x: v.x, y: v.y }, `💥 ¡Explota el depósito de ⛽ de ${theName(def)}!`);
}

/** Cada cuánto recalcula el buggy de los saqueadores su camino hacia el colono más cercano. */
const RAIDER_REPATH_TICKS = 30;

/** Esquina en el borde del mapa (la más cercana a la que pueda ir) para huir. */
function edgePath(w: World, v: Vehicle): Point[] | null {
  const m = w.map;
  const maxX = m.width - VEHICLE_SIZE;
  const maxY = m.height - VEHICLE_SIZE;
  const edges: [number, Point][] = [
    [v.x, { x: 0, y: v.y }], [maxX - v.x, { x: maxX, y: v.y }], [v.y, { x: v.x, y: 0 }], [maxY - v.y, { x: v.x, y: maxY }],
  ];
  edges.sort((a, b) => a[0] - b[0]);
  for (const [, e] of edges) {
    const alongX = e.y === 0 || e.y === maxY;
    for (let k = 0; k < 30; k++) {
      const off = k % 2 ? (k + 1) / 2 : -k / 2;
      const p = alongX ? { x: Math.max(0, Math.min(maxX, e.x + off)), y: e.y } : { x: e.x, y: Math.max(0, Math.min(maxY, e.y + off)) };
      if (!fits(w, p.x, p.y, defOf(v))) continue;
      const path = vehiclePath(w, { x: v.x, y: v.y }, p, defOf(v));
      if (path) return path;
      break; // ese borde no se alcanza: prueba otro
    }
  }
  return null;
}

/** Casillas de tierra (no de agua) que se pisan pegadas al vehículo con la esquina en (x, y). */
function shoreBeside(w: World, x: number, y: number): boolean {
  const m = w.map;
  for (let ty = y - 1; ty <= y + VEHICLE_SIZE; ty++) {
    for (let tx = x - 1; tx <= x + VEHICLE_SIZE; tx++) {
      if (tx >= x && tx < x + VEHICLE_SIZE && ty >= y && ty < y + VEHICLE_SIZE) continue;
      if (!inBounds(m, tx, ty) || !isPassable(m, tx, ty)) continue;
      if (!isWater(m.terrain[index(m, tx, ty)] as Terrain) || m.bridge[index(m, tx, ty)]) return true;
    }
  }
  return false;
}

/**
 * Camino de una balsa de los saqueadores desde `from` hasta el sitio del agua, pegado a la orilla,
 * más cercano a `home` al que llega remando (si un puente corta el río, se para antes). null si no
 * hay ninguno.
 */
export function raftLanding(w: World, from: Point, home: Point, def: VehicleDef): Point[] | null {
  const W = w.map.width;
  const key = (x: number, y: number) => y * W + x;
  const start = key(from.x, from.y);
  const prev = new Map<number, number>([[start, -1]]);
  const queue = [start];
  let best = -1;
  let bestD = Infinity;
  for (let q = 0; q < queue.length && q < VEHICLE_PATH_NODES; q++) {
    const k = queue[q];
    const x = k % W;
    const y = (k - x) / W;
    if (shoreBeside(w, x, y)) {
      const d = Math.hypot(x + 1 - home.x, y + 1 - home.y);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const nk = key(nx, ny);
      if (prev.has(nk) || !fits(w, nx, ny, def)) continue;
      prev.set(nk, k);
      queue.push(nk);
    }
  }
  if (best < 0) return null;
  const path: Point[] = [];
  for (let k = best; k !== start; k = prev.get(k)!) {
    const x = k % W;
    path.push({ x, y: (k - x) / W });
  }
  return path.reverse();
}

/** Saqueadores que llegaron en la balsa y aún pueden volver a ella (en pie y en el mapa). */
export function raftCrew(w: World, v: Vehicle): Colonist[] {
  return w.others.filter((o) => o.raider?.raft === v.id && !o.downed);
}

/**
 * La balsa de los saqueadores (elegido por Mikel el 2026-10-21): rema hasta la orilla más cercana
 * a la colonia y allí se bajan todos a atacar a pie; la balsa se queda. Al huir, los que vuelven a
 * ella se van remando por el borde. Sin nadie que pueda volver, se rompe. Devuelve false si ya no está.
 */
function driveRaiderRaft(w: World, v: Vehicle): boolean {
  const def = defOf(v);
  for (const c of riders(w, v)) if (c.downed) w.leaveVehicle(c);
  const inside = riders(w, v);
  if (inside.length === 0) {
    if (raftCrew(w, v).length === 0) {
      wreckVehicle(w, v, `🛶 Los saqueadores abandonan ${theName(def)}`);
      return false;
    }
    return true;
  }
  const fleeing = inside.some((c) => !c.raider || c.raider.fleeing || w.tick > c.raider.leaveAt);
  if (!fleeing) {
    if (v.path.length > 0) return true;
    const home = w.colonyPoint();
    const path = home ? raftLanding(w, { x: v.x, y: v.y }, home, def) : null;
    if (path && path.length > 0) {
      v.path = path;
      return true;
    }
    // Ha llegado (o no puede ir más allá): se bajan todos a atacar a pie.
    for (const c of inside) w.leaveVehicle(c);
    w.addLog(`🛶 Los saqueadores desembarcan de ${theName(def)}.`, 'malo', 'raid', { x: v.x, y: v.y });
    return true;
  }
  for (const c of inside) if (c.raider && !c.raider.fleeing) c.raider.fleeing = true;
  // Espera a los que vienen hacia ella (mientras quepan).
  if (inside.length < VEHICLE_SEATS.length && raftCrew(w, v).some((o) => !o.vehicle && o.raider?.fleeing && nearRaft(v, o, def))) return true;
  const m = w.map;
  if (v.x <= 0 || v.y <= 0 || v.x >= m.width - VEHICLE_SIZE || v.y >= m.height - VEHICLE_SIZE) {
    w.vehicles.splice(w.vehicles.indexOf(v), 1);
    for (const c of inside) {
      delete c.vehicle;
      leaveMap(w, c, '');
    }
    w.addLog(`🏳 ${theName(def, true)} huye río abajo.`, 'bueno');
    return false;
  }
  if (v.path.length === 0) {
    const path = edgePath(w, v);
    if (!path) {
      // No hay salida por el agua: se bajan y huyen a pie.
      for (const c of inside) w.leaveVehicle(c);
      return true;
    }
    v.path = path;
  }
  return true;
}

/** El saqueador tiene la balsa a `reboardRange` casillas o menos. */
export function nearRaft(v: Vehicle, o: Colonist, def: VehicleDef): boolean {
  const range = def.raft?.reboardRange ?? 0;
  const dx = Math.max(v.x - o.tile.x, 0, o.tile.x - (v.x + VEHICLE_SIZE - 1));
  const dy = Math.max(v.y - o.tile.y, 0, o.tile.y - (v.y + VEHICLE_SIZE - 1));
  return Math.max(dx, dy) <= range;
}

/**
 * El buggy de los saqueadores: si cae el conductor, el tirador coge el volante; sin nadie dentro,
 * lo abandonan (queda como chatarra). Va a por el colono de pie más cercano para atropellarlo, y al
 * huir el raid se marcha por el borde. Devuelve false si el vehículo ya no está.
 */
function driveRaider(w: World, v: Vehicle): boolean {
  const def = defOf(v);
  if (def.water) return driveRaiderRaft(w, v);
  // Los que han caído dentro se bajan (quedan en el suelo al lado).
  for (const c of riders(w, v)) if (c.downed) w.leaveVehicle(c);
  const inside = riders(w, v);
  if (inside.length === 0) {
    wreckVehicle(w, v, `🚙 Los saqueadores abandonan el ${def.name.toLowerCase()}`);
    return false;
  }
  let driver = inside.find((c) => c.vehicle!.seat === 'conductor');
  if (!driver) {
    driver = inside[0];
    driver.vehicle!.seat = 'conductor';
    w.addLog(`🚙 ${foeLabel(driver)} coge el volante del ${def.name.toLowerCase()}.`, 'info');
  }
  const r = driver.raider;
  const fleeing = !r || r.fleeing || w.tick > r.leaveAt || driver.health < 0.45;
  if (fleeing) {
    for (const c of inside) if (c.raider && !c.raider.fleeing) c.raider.fleeing = true;
    const m = w.map;
    if (v.x <= 0 || v.y <= 0 || v.x >= m.width - VEHICLE_SIZE || v.y >= m.height - VEHICLE_SIZE) {
      w.vehicles.splice(w.vehicles.indexOf(v), 1);
      for (const c of inside) {
        delete c.vehicle;
        leaveMap(w, c, '');
      }
      w.addLog(`🏳 ${theName(def, true)} huye del mapa.`, 'bueno');
      return false;
    }
    if (v.path.length === 0) {
      const path = edgePath(w, v);
      if (!path) {
        // No hay salida para el buggy: se bajan y huyen a pie.
        wreckVehicle(w, v, `🚙 Los saqueadores abandonan el ${def.name.toLowerCase()}`);
        return false;
      }
      v.path = path;
    }
    return true;
  }
  if (v.path.length === 0 || (w.tick + v.id) % RAIDER_REPATH_TICKS === 0) {
    const targets = w.colonists.filter((c) => !c.downed);
    const at = vehicleCenter(v);
    targets.sort((a, b) => Math.hypot(a.pos.x - at.x, a.pos.y - at.y) - Math.hypot(b.pos.x - at.x, b.pos.y - at.y));
    const target = targets[0];
    const anchor = target ? anchorFor(w, target.tile, def) : null;
    // Sin camino (muros): espera donde está y su tirador dispara a lo que tenga a tiro.
    v.path = anchor ? vehiclePath(w, { x: v.x, y: v.y }, anchor, def) ?? [] : [];
  }
  return true;
}
