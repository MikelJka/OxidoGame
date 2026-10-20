import { GameMap, isPassable, tileMoveCost } from './map';

export interface Point {
  x: number;
  y: number;
}

const DIRS: ReadonlyArray<[number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

export function isWalkable(map: GameMap, x: number, y: number): boolean {
  return isPassable(map, x, y);
}

function moveCost(map: GameMap, x: number, y: number): number {
  return tileMoveCost(map, x, y);
}

/**
 * A* en 8 direcciones, sin cortar esquinas, con coste de movimiento por terreno.
 * Devuelve la lista de casillas desde la siguiente al origen hasta el destino
 * (vacía si origen == destino) o null si no hay camino. `shut`: casillas (y·ancho + x) cerradas
 * para quien busca el camino (las puertas automáticas para los saqueadores durante un raid).
 */
export function findPath(
  map: GameMap, from: Point, to: Point, maxNodes = 20000, shut?: ReadonlySet<number>, through?: (x: number, y: number) => number,
): Point[] | null {
  // `through`: coste de abrirse paso por una casilla que no se puede pisar (Infinity si no se puede);
  // lo usan quienes rompen muros y puertas (el bruto mutante). Esas casillas no cuentan como cerradas.
  const open = (x: number, y: number): boolean => isWalkable(map, x, y) || (!!through && through(x, y) < Infinity);
  const closedTo = (i: number): boolean => !!shut?.has(i) && !(through && through(i % map.width, Math.floor(i / map.width)) < Infinity);
  if (!isWalkable(map, to.x, to.y) || !open(from.x, from.y)) return null;
  if (closedTo(to.y * map.width + to.x)) return null;
  if (from.x === to.x && from.y === to.y) return [];

  const w = map.width;
  const size = w * map.height;
  const g = new Float64Array(size).fill(Infinity);
  const parent = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const heap = new MinHeap();

  const start = from.y * w + from.x;
  const goal = to.y * w + to.x;
  g[start] = 0;
  heap.push(start, heuristic(from.x, from.y, to.x, to.y));

  let expanded = 0;
  while (heap.size > 0) {
    const current = heap.pop();
    if (current === goal) return rebuild(parent, goal, start, w);
    if (closed[current]) continue;
    closed[current] = 1;
    if (++expanded > maxNodes) return null;

    const cx = current % w;
    const cy = (current - cx) / w;
    for (const [dx, dy, step] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!open(nx, ny)) continue;
      // Sin cortar esquinas: en diagonal, ambas casillas laterales deben ser transitables.
      // (Quien rompe muros no pasa en diagonal entre dos: tiene que romper uno.)
      if (dx !== 0 && dy !== 0 && (!isWalkable(map, cx + dx, cy) || !isWalkable(map, cx, cy + dy))) continue;
      const n = ny * w + nx;
      if (shut && (closedTo(n) || (dx !== 0 && dy !== 0 && (shut.has(cy * w + cx + dx) || shut.has((cy + dy) * w + cx))))) continue;
      if (closed[n]) continue;
      const base = isWalkable(map, nx, ny) && !shut?.has(n) ? moveCost(map, nx, ny) : through!(nx, ny);
      const cost = g[current] + step * base;
      if (cost < g[n]) {
        g[n] = cost;
        parent[n] = current;
        heap.push(n, cost + heuristic(nx, ny, to.x, to.y));
      }
    }
  }
  return null;
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function rebuild(parent: Int32Array, goal: number, start: number, w: number): Point[] {
  const path: Point[] = [];
  for (let n = goal; n !== start; n = parent[n]) {
    path.push({ x: n % w, y: Math.floor(n / w) });
  }
  return path.reverse();
}

/** Montículo binario mínimo de (nodo, prioridad). */
class MinHeap {
  private nodes: number[] = [];
  private prios: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: number, prio: number): void {
    this.nodes.push(node);
    this.prios.push(prio);
    let i = this.nodes.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.prios[p] <= this.prios[i]) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.nodes[0];
    const lastN = this.nodes.pop()!;
    const lastP = this.prios.pop()!;
    if (this.nodes.length > 0) {
      this.nodes[0] = lastN;
      this.prios[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.nodes.length && this.prios[l] < this.prios[m]) m = l;
        if (r < this.nodes.length && this.prios[r] < this.prios[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.nodes[a], this.nodes[b]] = [this.nodes[b], this.nodes[a]];
    [this.prios[a], this.prios[b]] = [this.prios[b], this.prios[a]];
  }
}

/**
 * Camino en línea recta para quien vuela (el dron de vigilancia): no mira el terreno ni lo
 * construido. Como `findPath`, desde la casilla siguiente al origen hasta el destino (vacía si
 * origen == destino). Cada paso avanza una casilla en 8 direcciones.
 */
export function flightPath(from: Point, to: Point): Point[] {
  const out: Point[] = [];
  const n = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  for (let i = 1; i <= n; i++) {
    // La casilla de la recta en el paso i, sin saltos de más de una casilla.
    out.push({ x: Math.round(from.x + ((to.x - from.x) * i) / n), y: Math.round(from.y + ((to.y - from.y) * i) / n) });
  }
  return out;
}
