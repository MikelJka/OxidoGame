// Designaciones: casillas marcadas por el jugador para talar, picar o saquear.
// Los trabajos (siguiente paso) las convertirán en tareas para los colonos.
import { HarvestJob } from '../data/resources';
import { GameMap, inBounds, index } from './map';
import { harvestAt } from './resources';

/** Casilla designada con su trabajo. */
export interface Designation {
  x: number;
  y: number;
  job: HarvestJob;
}

/** Rectángulo de casillas (ambas esquinas incluidas, en cualquier orden). */
export interface TileRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Recorre las casillas de un rectángulo recortado al mapa. */
function forEachInRect(map: GameMap, r: TileRect, fn: (x: number, y: number) => void): void {
  const xa = Math.max(0, Math.min(r.x0, r.x1));
  const xb = Math.min(map.width - 1, Math.max(r.x0, r.x1));
  const ya = Math.max(0, Math.min(r.y0, r.y1));
  const yb = Math.min(map.height - 1, Math.max(r.y0, r.y1));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) fn(x, y);
}

/** Se puede designar la casilla para ese trabajo: tiene un objeto que se aprovecha así y le queda algo. */
export function canDesignate(map: GameMap, x: number, y: number, job: HarvestJob): boolean {
  return harvestAt(map, x, y)?.job === job;
}

export class Designations {
  private marks = new Map<number, HarvestJob>();
  /** Aumenta con cada cambio: el dibujado lo usa para saber cuándo repintar. */
  version = 0;

  constructor(readonly map: GameMap) {}

  at(x: number, y: number): HarvestJob | undefined {
    return inBounds(this.map, x, y) ? this.marks.get(index(this.map, x, y)) : undefined;
  }

  /** Designa una casilla. Devuelve false si no se puede o ya lo estaba con ese trabajo. */
  add(x: number, y: number, job: HarvestJob): boolean {
    if (!canDesignate(this.map, x, y, job)) return false;
    const i = index(this.map, x, y);
    if (this.marks.get(i) === job) return false;
    this.marks.set(i, job);
    this.version++;
    return true;
  }

  /** Quita la designación de una casilla. Devuelve true si había una. */
  remove(x: number, y: number): boolean {
    if (!inBounds(this.map, x, y) || !this.marks.delete(index(this.map, x, y))) return false;
    this.version++;
    return true;
  }

  /** Designa todo lo que se pueda de un trabajo dentro de un rectángulo. Devuelve cuántas casillas nuevas. */
  designateArea(r: TileRect, job: HarvestJob): number {
    let added = 0;
    forEachInRect(this.map, r, (x, y) => {
      if (this.add(x, y, job)) added++;
    });
    return added;
  }

  /** Quita las designaciones de un rectángulo. Devuelve cuántas se han quitado. */
  cancelArea(r: TileRect): number {
    let removed = 0;
    forEachInRect(this.map, r, (x, y) => {
      if (this.remove(x, y)) removed++;
    });
    return removed;
  }

  /** Cuántas casillas de un rectángulo se podrían designar para un trabajo (o cancelar, si `job` es null). */
  countArea(r: TileRect, job: HarvestJob | null): number {
    let n = 0;
    forEachInRect(this.map, r, (x, y) => {
      if (job === null ? this.at(x, y) !== undefined : canDesignate(this.map, x, y, job) && this.at(x, y) !== job) n++;
    });
    return n;
  }

  /** Quita las designaciones que ya no se pueden hacer (el objeto se agotó o cambió). Devuelve cuántas. */
  prune(): number {
    let removed = 0;
    for (const [i, job] of this.marks) {
      const x = i % this.map.width;
      const y = Math.floor(i / this.map.width);
      if (!canDesignate(this.map, x, y, job)) {
        this.marks.delete(i);
        removed++;
      }
    }
    if (removed > 0) this.version++;
    return removed;
  }

  list(): Designation[] {
    const out: Designation[] = [];
    for (const [i, job] of this.marks) out.push({ x: i % this.map.width, y: Math.floor(i / this.map.width), job });
    return out;
  }

  /** Cuántas casillas hay designadas para cada trabajo. */
  counts(): Record<HarvestJob, number> {
    const c: Record<HarvestJob, number> = { talar: 0, minar: 0, saquear: 0 };
    for (const job of this.marks.values()) c[job]++;
    return c;
  }

  get count(): number {
    return this.marks.size;
  }
}
