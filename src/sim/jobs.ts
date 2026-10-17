// Sistema de trabajos: convierte las designaciones en tareas, las reserva para un colono
// y elige la siguiente según sus prioridades y la distancia. Determinista: sin azar.
import { HARVEST_JOB_SKILL, HarvestJob } from '../data/resources';
import { Colonist, ColonistJob } from './colonist';
import { Designations } from './designations';
import { GameMap, index, isPassable, PROP_INFO, Prop } from './map';
import { findPath, Point } from './pathfinding';
import { harvestAt } from './resources';

/** Cuántas tareas candidatas (las más cercanas) se prueban con el buscador de caminos. */
const CANDIDATES_PER_SEARCH = 6;
/** Límite de nodos del buscador de caminos al buscar trabajo. */
const JOB_PATH_NODES = 12000;

const SIDES: readonly Point[] = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }];

/** Velocidad de trabajo de un colono (1 = normal): de ×0,6 con habilidad 0 a ×1,6 con 20. */
export function workSpeed(c: Colonist, kind: HarvestJob): number {
  return 0.6 + c.skills[HARVEST_JOB_SKILL[kind]] * 0.05;
}

/** Reservas de tareas: cada casilla designada la hace como mucho un colono. */
export class Reservations {
  private byTile = new Map<number, number>();

  constructor(readonly map: GameMap) {}

  holder(x: number, y: number): number | undefined {
    return this.byTile.get(index(this.map, x, y));
  }

  /** Reserva una casilla para un colono. false si ya la tiene otro. */
  reserve(x: number, y: number, colonistId: number): boolean {
    const i = index(this.map, x, y);
    const h = this.byTile.get(i);
    if (h !== undefined && h !== colonistId) return false;
    this.byTile.set(i, colonistId);
    return true;
  }

  release(x: number, y: number, colonistId: number): void {
    const i = index(this.map, x, y);
    if (this.byTile.get(i) === colonistId) this.byTile.delete(i);
  }

  /** Suelta todas las reservas de un colono. */
  releaseAll(colonistId: number): void {
    for (const [i, id] of this.byTile) if (id === colonistId) this.byTile.delete(i);
  }

  list(): { x: number; y: number; colonistId: number }[] {
    return [...this.byTile].map(([i, colonistId]) => ({ x: i % this.map.width, y: Math.floor(i / this.map.width), colonistId }));
  }
}

/** Casillas desde las que se puede trabajar un objeto: la suya si se pisa, si no las de los lados. */
export function standTiles(map: GameMap, x: number, y: number): Point[] {
  if (isPassable(map, x, y)) return [{ x, y }];
  return SIDES.map((d) => ({ x: x + d.x, y: y + d.y })).filter((p) => isPassable(map, p.x, p.y));
}

/** Ya está en un sitio desde el que puede trabajar la casilla. */
export function canWorkFrom(map: GameMap, at: Point, x: number, y: number): boolean {
  if (at.x === x && at.y === y) return true;
  if (isPassable(map, x, y)) return false; // si el objeto se pisa, hay que estar encima
  return Math.abs(at.x - x) + Math.abs(at.y - y) === 1;
}

export interface JobPlan {
  job: ColonistJob;
  path: Point[];
}

/**
 * Busca el siguiente trabajo para un colono: primero los de mejor prioridad (1 antes que 4;
 * 0 = no lo hace), y dentro de ella los más cercanos a los que puede llegar andando.
 * No reserva nada: lo hace quien acepta el plan.
 */
export function findJob(
  map: GameMap,
  c: Colonist,
  designations: Designations,
  reservations: Reservations,
): JobPlan | null {
  const byPriority = new Map<number, { x: number; y: number; kind: HarvestJob; dist: number }[]>();
  for (const d of designations.list()) {
    const p = c.priorities[d.job];
    if (p === 0) continue;
    const holder = reservations.holder(d.x, d.y);
    if (holder !== undefined && holder !== c.id) continue;
    const dist = Math.abs(d.x - c.tile.x) + Math.abs(d.y - c.tile.y);
    const list = byPriority.get(p) ?? [];
    list.push({ x: d.x, y: d.y, kind: d.job, dist });
    byPriority.set(p, list);
  }
  const priorities = [...byPriority.keys()].sort((a, b) => a - b);
  for (const p of priorities) {
    // Orden estable: distancia y después posición, para que sea determinista.
    const list = byPriority.get(p)!.sort((a, b) => a.dist - b.dist || a.y - b.y || a.x - b.x);
    for (const cand of list.slice(0, CANDIDATES_PER_SEARCH)) {
      const h = harvestAt(map, cand.x, cand.y);
      if (!h) continue;
      const stands = standTiles(map, cand.x, cand.y).sort(
        (a, b) => Math.abs(a.x - c.tile.x) + Math.abs(a.y - c.tile.y) - (Math.abs(b.x - c.tile.x) + Math.abs(b.y - c.tile.y)),
      );
      for (const stand of stands) {
        const path = canWorkFrom(map, c.tile, cand.x, cand.y) ? [] : findPath(map, c.tile, stand, JOB_PATH_NODES);
        if (!path) continue;
        const at = canWorkFrom(map, c.tile, cand.x, cand.y) ? { ...c.tile } : stand;
        return { job: { kind: cand.kind, x: cand.x, y: cand.y, stand: at, progress: 0, work: h.work }, path };
      }
    }
  }
  return null;
}

/** Nombre del objeto sobre el que se trabaja, para la interfaz. */
export function jobTargetName(map: GameMap, job: ColonistJob): string {
  return PROP_INFO[map.props[index(map, job.x, job.y)] as Prop].name;
}
