// Habitaciones: zonas cerradas por muros (o acantilados, roca, agua…), con las puertas y portones
// como separación. Servirán para el ánimo (dormir a cubierto) y la temperatura.
import { GameMap, inBounds, index, isPassable } from './map';
import type { Structures } from './structures';

/** Una zona más grande que esto se considera exterior. */
export const MAX_ROOM_TILES = 400;

export interface Room {
  id: number;
  /** Casillas (índices del mapa). */
  tiles: number[];
  /** Puertas y portones que dan a ella. */
  doors: number;
}

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export class Rooms {
  private roomOf = new Map<number, Room | null>();
  private builtFor = '';
  private nextId = 1;

  constructor(readonly map: GameMap, readonly structures: Structures, private readonly stamp: () => string) {}

  /** Habitación de una casilla, o null si está al aire libre (o no se pisa). */
  at(x: number, y: number): Room | null {
    if (!inBounds(this.map, x, y)) return null;
    const key = this.stamp();
    if (key !== this.builtFor) {
      this.roomOf.clear();
      this.builtFor = key;
    }
    const i = index(this.map, x, y);
    if (this.roomOf.has(i)) return this.roomOf.get(i)!;
    if (!isPassable(this.map, x, y) || this.isDoor(x, y)) {
      this.roomOf.set(i, null);
      return null;
    }
    // Relleno desde la casilla hasta topar con muros, puertas o el borde del mapa.
    const tiles: number[] = [i];
    const seen = new Set<number>(tiles);
    const doors = new Set<number>();
    let open = false;
    for (let head = 0; head < tiles.length; head++) {
      const t = tiles[head];
      const tx = t % this.map.width;
      const ty = Math.floor(t / this.map.width);
      for (const [dx, dy] of SIDES) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (!inBounds(this.map, nx, ny)) {
          open = true;
          continue;
        }
        const j = index(this.map, nx, ny);
        if (seen.has(j)) continue;
        seen.add(j);
        if (!isPassable(this.map, nx, ny)) {
          // Una valla no cierra una habitación: lo de dentro sigue al aire libre (un corral).
          if (this.isFence(nx, ny)) open = true;
          continue;
        }
        if (this.isDoor(nx, ny)) {
          doors.add(j);
          continue;
        }
        tiles.push(j);
      }
      if (open || tiles.length > MAX_ROOM_TILES) {
        open = true;
        break;
      }
    }
    const room: Room | null = open ? null : { id: this.nextId++, tiles, doors: doors.size };
    if (room) for (const t of tiles) this.roomOf.set(t, room);
    else this.roomOf.set(i, null);
    return room;
  }

  private isFence(x: number, y: number): boolean {
    const s = this.structures.at(x, y);
    return !!s && s.built && !!s.def.fence;
  }

  private isDoor(x: number, y: number): boolean {
    const s = this.structures.at(x, y);
    return !!s && s.built && (s.def.category === 'puerta' || s.def.category === 'porton');
  }
}
