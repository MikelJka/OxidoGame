// Objetos en el suelo: montones de recursos, uno por casilla. Lo que hay en el suelo es el
// inventario de la colonia (más adelante se distinguirá lo que está en zonas de almacén).
import { MAX_STACK, RESOURCES, ResourceId } from '../data/resources';
import { GameMap, inBounds, index, isPassable, isWater, Terrain } from './map';
import { emptyStockpile, Stockpile } from './resources';

/** Montón de un recurso sobre una casilla. */
export interface ItemStack {
  resource: ResourceId;
  amount: number;
}

/** Montón con su casilla, para recorrerlos. */
export interface PlacedStack extends ItemStack {
  x: number;
  y: number;
}

/** Hasta qué distancia (en pasos) se buscan casillas libres al soltar recursos. */
export const DROP_RADIUS = 8;

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Montones de recursos en el suelo del mapa. Determinista: no usa azar. */
export class GroundItems {
  private stacks = new Map<number, ItemStack>();
  /** Aumenta con cada cambio: el dibujado lo usa para saber cuándo repintar. */
  version = 0;

  /** Cuántos montones normales caben en una casilla (2 o más con una estantería). Lo fija `World`. */
  capacityAt: (x: number, y: number, resource?: ResourceId) => number = () => 1;

  constructor(readonly map: GameMap) {}

  /** Máximo de un recurso en una casilla. */
  maxAt(x: number, y: number, resource: ResourceId): number {
    return MAX_STACK[resource] * this.capacityAt(x, y, resource);
  }

  /** Montón de una casilla, o undefined. */
  at(x: number, y: number): ItemStack | undefined {
    return inBounds(this.map, x, y) ? this.stacks.get(index(this.map, x, y)) : undefined;
  }

  /** Se puede dejar algo en la casilla: se pisa, no es agua y no tiene un objeto que bloquee. */
  canHold(x: number, y: number): boolean {
    if (!isPassable(this.map, x, y)) return false;
    const i = index(this.map, x, y);
    return !isWater(this.map.terrain[i] as Terrain) && !this.map.trench[i];
  }

  /** Cuánto de un recurso cabe todavía en una casilla. */
  room(x: number, y: number, resource: ResourceId): number {
    if (!this.canHold(x, y)) return 0;
    const s = this.at(x, y);
    if (!s) return this.maxAt(x, y, resource);
    return s.resource === resource ? Math.max(0, this.maxAt(x, y, resource) - s.amount) : 0;
  }

  /**
   * Deja en una casilla todo lo que quepa de un recurso (sin buscar otras).
   * Devuelve lo que no ha cabido.
   */
  addAt(x: number, y: number, resource: ResourceId, amount: number): number {
    const put = Math.min(Math.max(0, Math.floor(amount)), this.room(x, y, resource));
    if (put > 0) {
      const i = index(this.map, x, y);
      const s = this.stacks.get(i);
      if (s) s.amount += put;
      else this.stacks.set(i, { resource, amount: put });
      this.version++;
    }
    return amount - put;
  }

  /**
   * Suelta recursos cerca de una casilla: primero completa montones del mismo recurso,
   * después ocupa casillas libres, de la más cercana (a pie) a la más lejana.
   * Solo usa casillas a las que se llega andando desde el origen, hasta `DROP_RADIUS` pasos.
   * Devuelve lo que no ha cabido (normalmente nada).
   */
  drop(x: number, y: number, resource: ResourceId, amount: number): number {
    let left = Math.max(0, Math.floor(amount));
    if (left === 0) return 0;
    const tiles = this.nearbyTiles(x, y);
    // Primero, los montones del mismo recurso que no están llenos.
    for (const t of tiles) {
      if (left === 0) break;
      const s = this.at(t.x, t.y);
      if (s && s.resource === resource) left = this.addAt(t.x, t.y, resource, left);
    }
    for (const t of tiles) {
      if (left === 0) break;
      if (!this.at(t.x, t.y)) left = this.addAt(t.x, t.y, resource, left);
    }
    return left;
  }

  /** Suelta varios recursos (p. ej. lo obtenido al talar). Devuelve lo que no ha cabido. */
  dropAll(x: number, y: number, gains: Partial<Stockpile>): Partial<Stockpile> {
    const left: Partial<Stockpile> = {};
    for (const r of RESOURCES) {
      const rest = this.drop(x, y, r, gains[r] ?? 0);
      if (rest > 0) left[r] = rest;
    }
    return left;
  }

  /** Coge hasta `amount` unidades del montón de una casilla. Devuelve lo cogido. */
  take(x: number, y: number, amount: number): ItemStack | null {
    const s = this.at(x, y);
    if (!s || amount <= 0) return null;
    const got = Math.min(s.amount, Math.floor(amount));
    if (got <= 0) return null;
    s.amount -= got;
    if (s.amount === 0) this.stacks.delete(index(this.map, x, y));
    this.version++;
    return { resource: s.resource, amount: got };
  }

  /** Total de cada recurso en el suelo: el inventario de la colonia. */
  totals(): Stockpile {
    const total = emptyStockpile();
    for (const s of this.stacks.values()) total[s.resource] += s.amount;
    return total;
  }

  /** Todos los montones con su casilla. */
  list(): PlacedStack[] {
    const out: PlacedStack[] = [];
    for (const [i, s] of this.stacks) {
      out.push({ x: i % this.map.width, y: Math.floor(i / this.map.width), resource: s.resource, amount: s.amount });
    }
    return out;
  }

  get count(): number {
    return this.stacks.size;
  }

  /**
   * Casillas donde se puede dejar algo, ordenadas por pasos desde (x, y) (búsqueda en anchura,
   * orden fijo de vecinos). Si el origen no se puede pisar (p. ej. un árbol que aún está en pie),
   * se empieza por sus vecinas.
   */
  private nearbyTiles(x: number, y: number): { x: number; y: number }[] {
    const map = this.map;
    const seen = new Set<number>();
    let frontier: { x: number; y: number }[] = [];
    const visit = (px: number, py: number) => {
      if (!inBounds(map, px, py)) return;
      const i = index(map, px, py);
      if (seen.has(i) || !isPassable(map, px, py)) return;
      seen.add(i);
      frontier.push({ x: px, y: py });
    };
    visit(x, y);
    if (frontier.length === 0) for (const [dx, dy] of NEIGHBORS) visit(x + dx, y + dy);
    const out: { x: number; y: number }[] = [];
    for (let step = 0; step <= DROP_RADIUS && frontier.length > 0; step++) {
      const current = frontier;
      frontier = [];
      for (const t of current) {
        if (this.canHold(t.x, t.y)) out.push(t);
        for (const [dx, dy] of NEIGHBORS) visit(t.x + dx, t.y + dy);
      }
    }
    return out;
  }
}

/** Texto de un montón para la interfaz, p. ej. «Madera ×40». */
export function describeStack(s: ItemStack, names: Record<ResourceId, string>): string {
  return `${names[s.resource]} ×${s.amount}`;
}
