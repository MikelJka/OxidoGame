// Tejados y habitaciones (pedido por Mikel el 2026-10-21): un espacio cerrado del todo con
// paredes (no con muros altos) y puertas es una habitación que pide tejado; los colonos con
// «Construir» lo ponen casilla a casilla. Bajo techo no llueve. Cada habitación tiene su belleza y
// su limpieza, que cambian el ánimo de quien está dentro. Si se abre (se quita una pared), el
// tejado se cae. Puro y determinista: sin Phaser ni DOM.
import { ROOMS } from '../data/roomRules';
import { inBounds, index } from './map';
import type { Room } from './rooms';
import type { World } from './world';
import type { Point } from './pathfinding';

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Lo que se sabe de cada habitación con tejado (o por tejar). */
export interface RoomInfo {
  room: Room;
  /** 0–1. */
  beauty: number;
  /** 0–1. */
  clean: number;
}

/** La habitación se puede tejar: la cierran paredes de un piso, puertas o el terreno (no muros altos). */
function roofable(w: World, room: Room): boolean {
  const own = new Set(room.tiles);
  let walls = 0;
  for (const t of room.tiles) {
    const x = t % w.map.width;
    const y = (t - x) / w.map.width;
    for (const [dx, dy] of SIDES) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(w.map, nx, ny) || own.has(index(w.map, nx, ny))) continue;
      const s = w.structures.mainAt(nx, ny);
      if (!s || !s.built) continue;
      if (s.def.category === 'muro' && s.def.height >= 2) return false;
      if (s.def.category === 'muro' || s.def.category === 'puerta' || s.def.category === 'porton') walls++;
    }
  }
  // Una cueva en la roca no es una habitación construida.
  return walls > 0;
}

/** Habitaciones que se pueden tejar (se recalcula al cambiar las construcciones o el terreno). */
export function roofRooms(w: World): Room[] {
  const key = `${w.structures.version}:${w.terrainVersion}:${w.propsVersion}`;
  if (w.roofCache.key === key) return w.roofCache.rooms;
  const seen = new Set<number>();
  const rooms: Room[] = [];
  for (const s of w.structures.all()) {
    if (!s.built || (s.def.category !== 'muro' && s.def.category !== 'puerta' && s.def.category !== 'porton')) continue;
    for (const t of w.structures.tilesOf(s)) {
      for (const [dx, dy] of SIDES) {
        const r = w.rooms.at(t.x + dx, t.y + dy);
        if (!r || seen.has(r.id)) continue;
        seen.add(r.id);
        if (roofable(w, r)) rooms.push(r);
      }
    }
  }
  w.roofCache = { key, rooms };
  // Lo que ya no está en una habitación que se pueda tejar se queda sin tejado.
  const keep = new Set(rooms.flatMap((r) => r.tiles));
  let fell = 0;
  for (const i of [...w.roofs]) {
    if (keep.has(i)) continue;
    w.roofs.delete(i);
    fell++;
  }
  if (fell) {
    w.roofVersion++;
    w.addLog(`🏚 Se ha abierto una habitación: se caen ${fell} ${fell === 1 ? 'casilla' : 'casillas'} de tejado.`, 'info');
  }
  return rooms;
}

/** Casillas que piden tejado (de una habitación que se puede tejar y aún sin él). */
export function roofTodo(w: World): Point[] {
  const out: Point[] = [];
  for (const r of roofRooms(w)) {
    for (const i of r.tiles) {
      if (w.roofs.has(i)) continue;
      const x = i % w.map.width;
      out.push({ x, y: (i - x) / w.map.width });
    }
  }
  return out;
}

/** La casilla está bajo techo. */
export function roofed(w: World, x: number, y: number): boolean {
  return inBounds(w.map, x, y) && w.roofs.has(index(w.map, x, y));
}

/** Pone el tejado en una casilla (si lo pide). */
export function putRoof(w: World, x: number, y: number): boolean {
  if (!inBounds(w.map, x, y)) return false;
  const i = index(w.map, x, y);
  if (w.roofs.has(i) || !roofTodo(w).some((p) => p.x === x && p.y === y)) return false;
  w.roofs.add(i);
  w.roofVersion++;
  return true;
}

/** Belleza y limpieza de la habitación con tejado de una casilla, o null si no está bajo techo. */
export function roomInfoAt(w: World, x: number, y: number): RoomInfo | null {
  if (!roofed(w, x, y)) return null;
  const room = w.rooms.at(x, y);
  if (!room) return null;
  const B = ROOMS.beauty;
  const C = ROOMS.cleanliness;
  let points = 0;
  let noFloor = 0;
  let clutter = 0;
  const furniture = new Set<number>();
  for (const i of room.tiles) {
    const tx = i % w.map.width;
    const ty = (i - tx) / w.map.width;
    const floor = w.structures.floorAt(tx, ty);
    if (floor?.built) points += B.floor;
    else noFloor++;
    const s = w.structures.mainAt(tx, ty);
    if (s?.built && (s.def.category === 'mueble' || s.def.category === 'taller') && !s.def.storage && !furniture.has(s.id)) {
      furniture.add(s.id);
      points += s.def.beauty ?? B.furniture;
    }
    if (w.lit.has(i)) points += B.light;
    // Lo tirado por el suelo (fuera de estanterías y almacenes) afea y ensucia.
    const st = w.items.at(tx, ty);
    if (st && !(s?.built && s.def.storage) && !w.zones.at(tx, ty)) {
      clutter++;
      points += B.clutter;
    }
  }
  const n = Math.max(1, room.tiles.length);
  // El tamaño cuenta: un cuarto muy pequeño agobia y uno amplio gusta (bloque 12).
  const Z = ROOMS.size;
  const size = n < Z.small ? Z.smallPoints : n >= Z.big ? Z.bigPoints : 0;
  const beauty = Math.max(0, Math.min(1, (points / n) * B.scale + size));
  const clean = Math.max(0, Math.min(1, 1 - (noFloor / n) * C.noFloor - (clutter / n) * C.clutter));
  return { room, beauty, clean };
}

/** Lee los tejados de una partida guardada. */
export function restoreRoofs(w: World, saved: unknown): void {
  w.roofs.clear();
  if (!Array.isArray(saved)) return;
  const n = w.map.width * w.map.height;
  for (const i of saved) if (typeof i === 'number' && i >= 0 && i < n) w.roofs.add(Math.floor(i));
}
