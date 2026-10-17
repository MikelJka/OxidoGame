import { Colonist, createColonist, walkSpeedMultiplier } from './colonist';
import { GameMap, generateMap, isPassable, tileMoveCost } from './map';
import { findPath, isWalkable, Point } from './pathfinding';
import { Rng } from './rng';
import { GroundItems } from './items';
import { Designations } from './designations';
import { canWorkFrom, findJob, findJobAt, isBeside, JOB_PATH_NODES, JobContext, reservePlan, Reservations, sideTiles, workSpeed } from './jobs';
import { harvestAt, harvestTile, Stockpile } from './resources';
import { StorageZones } from './zones';
import { GrowZones } from './farming';
import { regrowNature } from './nature';
import { applyTerrainJob, LOWER_STONE, terrainBlocker, TerrainJob, TerrainOrders } from './terrain';
import { Structure, Structures } from './structures';
import type { TileRect } from './designations';
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
  /** Mapa ya hecho (al cargar una partida): no se genera ni se reparten provisiones. */
  map?: GameMap;
}

export class World implements JobContext {
  readonly map: GameMap;
  readonly rng: Rng;
  readonly colonists: Colonist[] = [];
  /** Montones de recursos en el suelo. */
  readonly items: GroundItems;
  /** Casillas marcadas para talar, picar o saquear. */
  readonly designations: Designations;
  /** Qué colono hace cada tarea (casilla designada, montón, destino, plano). */
  readonly reservations: Reservations;
  /** Zonas de almacén. */
  readonly zones: StorageZones;
  /** Planos y construcciones. */
  readonly structures: Structures;
  /** Huertos y lo plantado en ellos. */
  readonly farms: GrowZones;
  /** Obras de terreno pendientes (rebajar, elevar, rampas). */
  readonly terrain: TerrainOrders;
  /** Casillas cuyo objeto ha cambiado desde la última vez que se preguntó (para repintarlas). */
  private changedTiles: number[] = [];
  /** Cambia cuando cambia el relieve (el dibujado recoloca lo que va encima del suelo). */
  terrainVersion = 0;
  /** Tick a partir del cual cada colono vuelve a buscar trabajo. */
  private nextJobScan = new Map<number, number>();
  tick = 0;
  speed: GameSpeed = 1;
  private accumulator = 0;

  constructor(opts: WorldOptions) {
    this.map = opts.map ?? generateMap({ width: opts.width ?? MAP_SIZE, height: opts.height ?? MAP_SIZE, seed: opts.seed });
    this.rng = new Rng(opts.seed ^ 0x51ed270b);
    if (!opts.map) this.spawnColonists(opts.colonists ?? 3);
    this.items = new GroundItems(this.map);
    this.designations = new Designations(this.map);
    this.reservations = new Reservations(this.map);
    this.zones = new StorageZones(this.map);
    this.structures = new Structures(this.map);
    this.farms = new GrowZones(this.map);
    this.terrain = new TerrainOrders(this.map);
    if (!opts.map) this.dropStartingSupplies();
  }

  /** Devuelve (y olvida) las casillas cuyo objeto ha cambiado: el dibujado las repinta. */
  takeChangedTiles(): number[] {
    const out = this.changedTiles;
    this.changedTiles = [];
    return out;
  }

  /** Inventario de la colonia: lo que hay en el suelo más lo que llevan encima los colonos. */
  inventory(): Stockpile {
    const total = this.items.totals();
    for (const c of this.colonists) if (c.carrying) total[c.carrying.resource] += c.carrying.amount;
    return total;
  }

  /**
   * Termina de aprovechar el objeto de una casilla y suelta lo obtenido en el suelo, al lado.
   * Devuelve lo obtenido, o null si no había nada. Lo usarán los trabajos de talar, picar y saquear.
   */
  harvest(x: number, y: number): Partial<Stockpile> | null {
    const gains = harvestTile(this.map, x, y, this.rng);
    if (gains) {
      this.changedTiles.push(y * this.map.width + x);
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
    // Cada hora, la naturaleza vuelve un poco: rebrotan tocones y nacen árboles y matorrales.
    if (this.tick % TICKS_PER_HOUR === 0) {
      const grown = regrowNature(this.map, this.rng, (x, y) =>
        !this.structures.at(x, y) && !this.zones.at(x, y) && !this.farms.at(x, y) && !this.items.at(x, y) &&
        !this.colonists.some((c) => c.tile.x === x && c.tile.y === y) && !this.colonists.some((c) => c.path.some((p) => p.x === x && p.y === y)));
      this.changedTiles.push(...grown);
    }
    // Las plantas crecen a saltos de un segundo (basta y cuesta poco).
    if (this.tick % TICKS_PER_SECOND === 0) {
      const h = this.hour;
      this.farms.grow(TICKS_PER_SECOND, h >= 6 && h < 20, TICKS_PER_DAY);
    }
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
    if (c.drafted) {
      // Reclutado: solo se mueve si se le manda; si no, espera quieto.
      if (c.path.length > 0) this.moveAlongPath(c);
      else c.activity = 'idle';
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
    if (this.designations.count === 0 && this.zones.all().length === 0 && this.structures.blueprints().length === 0 && this.structures.toDemolish().length === 0 && this.farms.all().length === 0 && this.farms.plantList().length === 0 && this.terrain.count === 0) return false;
    if (this.tick < (this.nextJobScan.get(c.id) ?? 0)) return false;
    const plan = findJob(this, c);
    if (!plan || !reservePlan(this.reservations, c, plan.job)) {
      this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
      return false;
    }
    c.job = plan.job;
    c.path = plan.path;
    c.activity = 'toJob';
    c.waitTicks = 0;
    return true;
  }

  /** Deja el trabajo actual (terminado, cancelado o imposible): suelta reservas y lo que lleve encima. */
  private dropJob(c: Colonist): void {
    this.reservations.releaseAll(c.id);
    if (c.carrying) {
      this.items.drop(c.tile.x, c.tile.y, c.carrying.resource, c.carrying.amount);
      c.carrying = null;
    }
    if (!c.job) return;
    c.job = null;
    c.path = [];
    c.activity = 'idle';
    c.waitTicks = JOB_PAUSE_TICKS;
  }

  /** El trabajo sigue teniendo sentido (no se ha quitado la orden, el montón sigue ahí…). */
  private jobStillValid(c: Colonist): boolean {
    const j = c.job!;
    const h = j.haul;
    if (j.kind === 'construir') {
      const s = this.structures.at(j.x, j.y);
      if (j.demolish) return !!s && s.built && !!s.demolish;
      if (!s || s.built) return false;
      if (h && !h.picked) {
        const st = this.items.at(h.from.x, h.from.y);
        if (!st || st.resource !== h.resource || (this.structures.needs(s)[h.resource] ?? 0) <= 0) return false;
      }
      return true;
    }
    if (j.kind === 'terreno') {
      return this.terrain.at(j.x, j.y) === j.terrain && !terrainBlocker(this.map, j.x, j.y, j.terrain!, !!this.structures.at(j.x, j.y));
    }
    if (j.kind === 'cultivar') {
      if (j.farm === 'cosechar') return (this.farms.plantAt(j.x, j.y)?.growth ?? 0) >= 1;
      const z = this.farms.at(j.x, j.y);
      return !!z && !this.farms.plantAt(j.x, j.y) && this.farms.canSow(j.x, j.y, z.crop) && !this.structures.at(j.x, j.y);
    }
    if (j.kind === 'transportar') {
      if (!h) return false;
      if (!h.picked) {
        const st = this.items.at(h.from.x, h.from.y);
        if (!st || st.resource !== h.resource) return false;
      }
      return this.zones.priorityFor(h.to.x, h.to.y, h.resource) > 0 && this.items.room(h.to.x, h.to.y, h.resource) > 0;
    }
    return this.designations.at(j.x, j.y) === j.kind && harvestAt(this.map, j.x, j.y)?.job === j.kind;
  }

  private updateJob(c: Colonist): void {
    const j = c.job!;
    if (!this.jobStillValid(c)) {
      this.dropJob(c);
      return;
    }
    if (c.path.length > 0) {
      c.activity = 'toJob';
      this.moveAlongPath(c);
      return;
    }
    if (j.haul) {
      this.updateHaul(c);
      return;
    }
    const building = j.kind === 'construir';
    const inPlace = building ? isBeside(c.tile, j.x, j.y) : canWorkFrom(this.map, c.tile, j.x, j.y);
    if (!inPlace) {
      const path = findPath(this.map, c.tile, j.stand, JOB_PATH_NODES);
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
    if (building && j.demolish) {
      if (j.progress >= j.work) {
        this.demolishStructure(this.structures.at(j.x, j.y)!);
        this.dropJob(c);
      }
      return;
    }
    if (building) {
      const s = this.structures.at(j.x, j.y)!;
      s.progress = Math.min(j.progress, s.def.work);
      if (j.progress >= j.work) {
        this.completeStructure(s);
        this.dropJob(c);
      }
      return;
    }
    if (j.progress >= j.work) {
      if (j.kind === 'cultivar') this.finishFarmWork(j.x, j.y, j.farm!);
      else if (j.kind === 'terreno') this.finishTerrainWork(j.x, j.y, j.terrain!);
      else this.harvest(j.x, j.y);
      this.dropJob(c);
    }
  }

  /** Termina una obra de terreno: cambia el nivel (o hace la rampa) y repinta alrededor. */
  finishTerrainWork(x: number, y: number, job: TerrainJob): void {
    this.terrain.remove(x, y);
    const changed = applyTerrainJob(this.map, x, y, job);
    this.changedTiles.push(...changed);
    this.terrainVersion++;
    if (job === 'rebajar') this.items.drop(x, y, 'piedra', LOWER_STONE);
    // Lo que quedara mal colocado tras el cambio (zonas, plantas, colonos) se corrige.
    this.zones.prune();
    this.farms.prune();
    for (const c of this.colonists) {
      if (!isPassable(this.map, c.tile.x, c.tile.y)) this.moveOutOfTheWay(c);
    }
  }

  /** Termina de sembrar o de cosechar una casilla. */
  private finishFarmWork(x: number, y: number, action: 'sembrar' | 'cosechar'): void {
    if (action === 'sembrar') {
      this.farms.sow(x, y);
      return;
    }
    const crop = this.farms.harvest(x, y, (a, b) => this.rng.int(a, b));
    if (crop) this.items.drop(x, y, crop.resource, crop.amount);
  }

  /** Crea un huerto (sin pisar almacenes). */
  createGrowZone(r: TileRect): ReturnType<GrowZones['create']> {
    return this.farms.create(r, undefined, (x, y) => this.zones.at(x, y) !== undefined);
  }

  extendGrowZone(id: number, r: TileRect): number {
    return this.farms.extend(id, r, (x, y) => this.zones.at(x, y) !== undefined);
  }

  /** Crea un almacén (sin pisar huertos). */
  createStorageZone(r: TileRect): ReturnType<StorageZones['create']> {
    return this.zones.create(r, (x, y) => this.farms.at(x, y) !== undefined);
  }

  extendStorageZone(id: number, r: TileRect): number {
    return this.zones.extend(id, r, (x, y) => this.farms.at(x, y) !== undefined);
  }

  /** Transporte en dos tramos: ir al montón y cogerlo; llevarlo al almacén o al plano y dejarlo. */
  private updateHaul(c: Colonist): void {
    const j = c.job!;
    const h = j.haul!;
    if (!h.picked) {
      if (c.tile.x !== h.from.x || c.tile.y !== h.from.y) {
        this.repathOrDrop(c, h.from);
        return;
      }
      const got = this.items.take(h.from.x, h.from.y, h.amount);
      if (!got) {
        this.dropJob(c);
        return;
      }
      c.carrying = { resource: got.resource, amount: got.amount };
      h.picked = true;
      this.reservations.release(h.from.x, h.from.y, c.id, 'pickup');
      // Al almacén se entra; a un plano se le lleva el material desde el lado.
      const targets = h.toBlueprint ? sideTiles(this.map, h.to.x, h.to.y) : [h.to];
      const route = this.routeTo(c, targets);
      if (!route) {
        this.dropJob(c);
        this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
        return;
      }
      j.stand = route.stand;
      c.path = route.path;
      c.activity = 'toJob';
      return;
    }
    const arrived = h.toBlueprint ? isBeside(c.tile, h.to.x, h.to.y) : c.tile.x === h.to.x && c.tile.y === h.to.y;
    if (!arrived) {
      this.repathOrDrop(c, j.stand);
      return;
    }
    const load = c.carrying;
    if (load) {
      let left = load.amount;
      if (h.toBlueprint) {
        const s = this.structures.at(h.to.x, h.to.y);
        if (s) left -= this.structures.deliver(s, load.resource, left);
      } else {
        left = this.items.addAt(h.to.x, h.to.y, load.resource, left);
      }
      c.carrying = left > 0 ? { resource: load.resource, amount: left } : null;
    }
    this.dropJob(c); // si sobra algo, lo deja en el suelo donde está
  }

  /** Vuelve a calcular el camino hasta una casilla; si no hay, deja el trabajo. */
  private repathOrDrop(c: Colonist, to: Point): void {
    const path = findPath(this.map, c.tile, to, JOB_PATH_NODES);
    if (!path || path.length === 0) {
      this.dropJob(c);
      this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
      return;
    }
    c.path = path;
  }

  private routeTo(c: Colonist, targets: Point[]): { stand: Point; path: Point[] } | null {
    const sorted = [...targets].sort((a, b) => Math.abs(a.x - c.tile.x) + Math.abs(a.y - c.tile.y) - (Math.abs(b.x - c.tile.x) + Math.abs(b.y - c.tile.y)));
    for (const t of sorted) {
      if (t.x === c.tile.x && t.y === c.tile.y) return { stand: t, path: [] };
      const path = findPath(this.map, c.tile, t, JOB_PATH_NODES);
      if (path) return { stand: t, path };
    }
    return null;
  }

  // --- Construcción ------------------------------------------------------------

  /** Quita un plano y suelta en el suelo los materiales que ya se habían llevado. */
  cancelBlueprint(x: number, y: number): boolean {
    const back = this.structures.cancel(x, y);
    if (!back) return false;
    this.items.dropAll(x, y, back);
    return true;
  }

  /** Derriba una construcción terminada y deja en el suelo parte de su material. */
  demolishStructure(s: Structure): void {
    const back = this.structures.demolish(s);
    this.items.dropAll(s.x, s.y, back);
  }

  /** Marca para demoler (o quita el plano, si no está terminada) cada construcción de un área. */
  demolishArea(r: TileRect): { planos: number; demoler: number } {
    let planos = 0;
    let demoler = 0;
    for (const t of Structures.areaTiles(r, 'relleno')) {
      if (this.cancelBlueprint(t.x, t.y)) planos++;
      else if (this.structures.markDemolish(t.x, t.y)) demoler++;
    }
    return { planos, demoler };
  }

  // --- Reclutar y órdenes directas -------------------------------------------------

  /** Recluta (o libera) a un colono. Reclutado deja lo que hacía y espera órdenes. */
  setDrafted(colonistId: number, drafted: boolean): void {
    const c = this.colonists.find((k) => k.id === colonistId);
    if (!c || c.drafted === drafted) return;
    c.drafted = drafted;
    this.dropJob(c);
    c.path = [];
    c.activity = 'idle';
    c.waitTicks = drafted ? 0 : 30;
  }

  /**
   * Orden directa de trabajo: el colono hace ya lo que haya en esa casilla (talar lo marcado o un
   * árbol, construir un plano, cosechar…). Si no estaba marcado y se puede aprovechar, se marca.
   * Si otro colono lo tenía, lo deja. Devuelve false si ahí no hay nada que hacer o no se llega.
   */
  forceJob(colonistId: number, x: number, y: number): boolean {
    const c = this.colonists.find((k) => k.id === colonistId);
    if (!c) return false;
    const h = harvestAt(this.map, x, y);
    const addedMark = !!h && !this.designations.at(x, y) && this.designations.add(x, y, h.job);
    const other = this.colonists.find((k) => k !== c && k.job && k.job.x === x && k.job.y === y);
    if (other) this.dropJob(other);
    this.dropJob(c);
    const plan = findJobAt(this, c, x, y);
    if (!plan || !reservePlan(this.reservations, c, plan.job)) {
      if (addedMark) this.designations.remove(x, y);
      return false;
    }
    c.job = plan.job;
    c.path = plan.path;
    c.activity = 'toJob';
    c.waitTicks = 0;
    return true;
  }

  /**
   * Manda a varios colonos a una casilla: cada uno a una casilla libre distinta, empezando por
   * esa y siguiendo por las más cercanas a pie. Devuelve cuántos tienen camino.
   */
  orderGroupMove(ids: number[], target: Point): number {
    if (ids.length <= 1) return ids.length === 1 && this.orderMove(ids[0], target) ? 1 : 0;
    const spots: Point[] = [];
    const seen = new Set<number>();
    const queue: Point[] = isPassable(this.map, target.x, target.y) ? [target] : [];
    if (queue.length) seen.add(target.y * this.map.width + target.x);
    for (let head = 0; head < queue.length && spots.length < ids.length; head++) {
      const p = queue[head];
      spots.push(p);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { x: p.x + dx, y: p.y + dy };
        const k = n.y * this.map.width + n.x;
        if (seen.has(k) || !isPassable(this.map, n.x, n.y)) continue;
        seen.add(k);
        queue.push(n);
      }
    }
    let ok = 0;
    ids.forEach((id, i) => {
      if (spots[i] && this.orderMove(id, spots[i])) ok++;
    });
    return ok;
  }

  /** ¿Hay en la casilla algo que un colono pueda hacer por orden directa? */
  hasWorkAt(x: number, y: number): boolean {
    if (this.designations.at(x, y) || this.terrain.at(x, y)) return true;
    const s = this.structures.at(x, y);
    if (s && (!s.built || s.demolish)) return true;
    if ((this.farms.plantAt(x, y)?.growth ?? 0) >= 1) return true;
    // Un árbol, roca o coche que corta el paso: tocarlo es pedir que se aproveche.
    const h = harvestAt(this.map, x, y);
    return !!h && !isPassable(this.map, x, y);
  }

  /** Termina una construcción y aparta lo que quede debajo (montones, colonos). */
  completeStructure(s: Structure): void {
    this.structures.complete(s);
    if (!s.def.blocks) return;
    const stack = this.items.at(s.x, s.y);
    if (stack) {
      const got = this.items.take(s.x, s.y, stack.amount)!;
      this.items.drop(s.x, s.y, got.resource, got.amount);
    }
    for (const c of this.colonists) {
      if (c.tile.x === s.x && c.tile.y === s.y) this.moveOutOfTheWay(c);
    }
    // Los caminos que pasaban por ahí se recalculan.
    for (const c of this.colonists) {
      if (!c.path.some((p) => p.x === s.x && p.y === s.y)) continue;
      const goal = c.path[c.path.length - 1];
      const path = isPassable(this.map, goal.x, goal.y) ? findPath(this.map, c.tile, goal, JOB_PATH_NODES) : null;
      c.path = path ?? [];
    }
    this.zones.prune();
    this.farms.prune();
  }

  /** Aparta a un colono a la casilla libre más cercana (cuando se levanta un muro donde está). */
  moveOutOfTheWay(c: Colonist): void {
    for (let r = 1; r <= 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = c.tile.x + dx;
          const y = c.tile.y + dy;
          if (!isPassable(this.map, x, y)) continue;
          c.tile = { x, y };
          c.pos = { x: x + 0.5, y: y + 0.5 };
          c.path = [];
          return;
        }
      }
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

