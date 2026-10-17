import { Colonist, createColonist, walkSpeedMultiplier } from './colonist';
import { GameMap, generateMap, tileMoveCost } from './map';
import { findPath, isWalkable, Point } from './pathfinding';
import { Rng } from './rng';
import { GroundItems } from './items';
import { Designations } from './designations';
import { canWorkFrom, findJob, Reservations, workSpeed } from './jobs';
import { harvestAt, harvestTile, Stockpile } from './resources';
import { RESOURCES, STARTING_SUPPLIES } from '../data/resources';

/** Ticks de simulación por segundo real a velocidad x1. */
export const TICKS_PER_SECOND = 30;
/** Un día de juego dura 6 minutos reales a x1. */
export const TICKS_PER_DAY = TICKS_PER_SECOND * 60 * 6;
export const TICKS_PER_HOUR = TICKS_PER_DAY / 24;
/** Casillas por segundo (a x1) de un colono normal en terreno de coste 1. */
const BASE_WALK_SPEED = 3;
/** La partida empieza a las 7:00 del día 1. */
const START_HOUR = 7;
/** Máximo de ticks a simular por fotograma para no bloquear el navegador. */
const MAX_TICKS_PER_UPDATE = 60;
/** Ticks que espera un colono para volver a buscar trabajo si no encontró ninguno. */
const JOB_RETRY_TICKS = 90;
/** Ticks de pausa entre terminar un trabajo y empezar el siguiente. */
const JOB_PAUSE_TICKS = 10;
/** Lado (en casillas) de los mapas de partida. */
export const MAP_SIZE = 140;

export type GameSpeed = 0 | 1 | 2 | 3;

export interface WorldOptions {
  seed: number;
  width?: number;
  height?: number;
  colonists?: number;
}

export class World {
  readonly map: GameMap;
  readonly rng: Rng;
  readonly colonists: Colonist[] = [];
  /** Montones de recursos en el suelo. */
  readonly items: GroundItems;
  /** Casillas marcadas para talar, picar o saquear. */
  readonly designations: Designations;
  /** Qué colono hace cada casilla designada. */
  readonly reservations: Reservations;
  /** Tick a partir del cual cada colono vuelve a buscar trabajo. */
  private nextJobScan = new Map<number, number>();
  tick = 0;
  speed: GameSpeed = 1;
  private accumulator = 0;

  constructor(opts: WorldOptions) {
    this.map = generateMap({ width: opts.width ?? MAP_SIZE, height: opts.height ?? MAP_SIZE, seed: opts.seed });
    this.rng = new Rng(opts.seed ^ 0x51ed270b);
    this.spawnColonists(opts.colonists ?? 3);
    this.items = new GroundItems(this.map);
    this.designations = new Designations(this.map);
    this.reservations = new Reservations(this.map);
    this.dropStartingSupplies();
  }

  /** Inventario de la colonia: todo lo que hay en el suelo. */
  inventory(): Stockpile {
    return this.items.totals();
  }

  /**
   * Termina de aprovechar el objeto de una casilla y suelta lo obtenido en el suelo, al lado.
   * Devuelve lo obtenido, o null si no había nada. Lo usarán los trabajos de talar, picar y saquear.
   */
  harvest(x: number, y: number): Partial<Stockpile> | null {
    const gains = harvestTile(this.map, x, y, this.rng);
    if (gains) {
      this.items.dropAll(x, y, gains);
      // Lo que queda (p. ej. un tocón) no sigue designado: hay que volver a marcarlo.
      this.designations.remove(x, y);
    }
    return gains;
  }

  /** Avanza la simulación según el tiempo real transcurrido y la velocidad. */
  update(deltaMs: number): number {
    if (this.speed === 0) return 0;
    this.accumulator += (deltaMs / 1000) * TICKS_PER_SECOND * this.speed;
    let steps = 0;
    while (this.accumulator >= 1 && steps < MAX_TICKS_PER_UPDATE) {
      this.step();
      this.accumulator -= 1;
      steps++;
    }
    if (steps === MAX_TICKS_PER_UPDATE) this.accumulator = 0; // descarta el atraso
    return steps;
  }

  /** Un tick de simulación. */
  step(): void {
    this.tick++;
    for (const c of this.colonists) this.updateColonist(c);
  }

  /** Orden directa: el colono va a la casilla indicada. Devuelve false si no hay camino. */
  orderMove(colonistId: number, target: Point): boolean {
    const c = this.colonists.find((k) => k.id === colonistId);
    if (!c) return false;
    const path = findPath(this.map, c.tile, target);
    if (!path) return false;
    this.dropJob(c); // la orden directa manda sobre el trabajo
    c.path = path;
    c.activity = 'moving';
    c.waitTicks = 0;
    return true;
  }

  colonistAt(x: number, y: number, radius = 0.6): Colonist | undefined {
    let best: Colonist | undefined;
    let bestDist = radius;
    for (const c of this.colonists) {
      const d = Math.hypot(c.pos.x - x, c.pos.y - y);
      if (d <= bestDist) {
        best = c;
        bestDist = d;
      }
    }
    return best;
  }

  get day(): number {
    return Math.floor((this.tick + START_HOUR * TICKS_PER_HOUR) / TICKS_PER_DAY) + 1;
  }

  /** Hora del día en horas decimales (0–24). */
  get hour(): number {
    return (((this.tick + START_HOUR * TICKS_PER_HOUR) % TICKS_PER_DAY) / TICKS_PER_HOUR);
  }

  clockLabel(): string {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return `Día ${this.day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Deja las provisiones iniciales junto al punto de inicio (sin azar: no cambia el resto de la partida). */
  private dropStartingSupplies(): void {
    const { start } = this.map;
    for (const r of RESOURCES) {
      const amount = STARTING_SUPPLIES[r] ?? 0;
      if (amount <= 0) continue;
      const left = this.items.drop(start.x + 2, start.y + 1, r, amount);
      if (left > 0) this.items.drop(start.x, start.y, r, left);
    }
  }

  private spawnColonists(count: number): void {
    const { start } = this.map;
    const spots: Point[] = [];
    for (let r = 0; r <= 3 && spots.length < count; r++) {
      for (let dy = -r; dy <= r && spots.length < count; dy++) {
        for (let dx = -r; dx <= r && spots.length < count; dx++) {
          const p = { x: start.x + dx, y: start.y + dy };
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (isWalkable(this.map, p.x, p.y) && (dx + dy) % 2 === 0) spots.push(p);
        }
      }
    }
    while (spots.length < count) spots.push({ ...start });
    for (let i = 0; i < count; i++) this.colonists.push(createColonist(i + 1, spots[i], this.rng));
  }

  private updateColonist(c: Colonist): void {
    if (c.job) {
      this.updateJob(c);
      return;
    }
    if (c.path.length > 0) {
      // Quien deambula deja de hacerlo si aparece trabajo; una orden directa no se interrumpe.
      if (c.activity === 'wandering' && this.tryStartJob(c)) return;
      this.moveAlongPath(c);
      return;
    }
    if (this.tryStartJob(c)) return;
    if (c.activity !== 'idle') {
      c.activity = 'idle';
      c.waitTicks = this.rng.int(60, 240);
    }
    if (c.waitTicks > 0) {
      c.waitTicks--;
      return;
    }
    this.startWander(c);
  }

  /** Busca trabajo (si toca) y lo empieza. true si ahora tiene uno. */
  private tryStartJob(c: Colonist): boolean {
    if (this.designations.count === 0) return false;
    if (this.tick < (this.nextJobScan.get(c.id) ?? 0)) return false;
    const plan = findJob(this.map, c, this.designations, this.reservations);
    if (!plan || !this.reservations.reserve(plan.job.x, plan.job.y, c.id)) {
      this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
      return false;
    }
    c.job = plan.job;
    c.path = plan.path;
    c.activity = 'toJob';
    c.waitTicks = 0;
    return true;
  }

  /** Deja el trabajo actual (terminado, cancelado o imposible) y suelta su reserva. */
  private dropJob(c: Colonist): void {
    if (!c.job) return;
    this.reservations.release(c.job.x, c.job.y, c.id);
    c.job = null;
    c.path = [];
    c.activity = 'idle';
    c.waitTicks = JOB_PAUSE_TICKS;
  }

  private updateJob(c: Colonist): void {
    const j = c.job!;
    // La orden se ha quitado o el objeto ya no da nada: se deja.
    if (this.designations.at(j.x, j.y) !== j.kind || harvestAt(this.map, j.x, j.y)?.job !== j.kind) {
      this.dropJob(c);
      return;
    }
    if (c.path.length > 0) {
      c.activity = 'toJob';
      this.moveAlongPath(c);
      return;
    }
    if (!canWorkFrom(this.map, c.tile, j.x, j.y)) {
      const path = findPath(this.map, c.tile, j.stand, 12000);
      if (!path || path.length === 0) {
        this.dropJob(c);
        this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
        return;
      }
      c.path = path;
      return;
    }
    c.activity = 'working';
    const dx = j.x + 0.5 - c.pos.x;
    if (Math.abs(dx) > 0.01) c.facing = dx > 0 ? 1 : -1;
    j.progress += workSpeed(c, j.kind);
    if (j.progress >= j.work) {
      this.harvest(j.x, j.y);
      this.dropJob(c);
    }
  }

  private startWander(c: Colonist): void {
    for (let tries = 0; tries < 8; tries++) {
      const target = {
        x: c.tile.x + this.rng.int(-10, 10),
        y: c.tile.y + this.rng.int(-10, 10),
      };
      if (!isWalkable(this.map, target.x, target.y)) continue;
      const path = findPath(this.map, c.tile, target, 4000);
      if (path && path.length > 0) {
        c.path = path;
        c.activity = 'wandering';
        return;
      }
    }
    c.waitTicks = this.rng.int(30, 90);
  }

  private moveAlongPath(c: Colonist): void {
    const next = c.path[0];
    const cost = this.terrainCost(next);
    let budget = (BASE_WALK_SPEED * walkSpeedMultiplier(c)) / TICKS_PER_SECOND / cost;
    while (budget > 0 && c.path.length > 0) {
      const target = c.path[0];
      const tx = target.x + 0.5;
      const ty = target.y + 0.5;
      const dx = tx - c.pos.x;
      const dy = ty - c.pos.y;
      const dist = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.01) c.facing = dx > 0 ? 1 : -1;
      if (dist <= budget) {
        c.pos.x = tx;
        c.pos.y = ty;
        c.tile = { x: target.x, y: target.y };
        c.path.shift();
        budget -= dist;
      } else {
        c.pos.x += (dx / dist) * budget;
        c.pos.y += (dy / dist) * budget;
        budget = 0;
      }
    }
  }

  private terrainCost(p: Point): number {
    const cost = tileMoveCost(this.map, p.x, p.y);
    return Number.isFinite(cost) ? cost : 1;
  }
}

