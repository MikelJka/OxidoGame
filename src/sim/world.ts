import { Colonist, createColonist, RaidGroup, walkSpeedMultiplier } from './colonist';
import { countReachable, GameMap, generateMap, inBounds, isPassable, isWater, Prop, PROP_INFO, Terrain, TERRAIN_INFO, tileMoveCost } from './map';
import { findPath, isWalkable, Point } from './pathfinding';
import { Rng } from './rng';
import { GroundItems } from './items';
import { Designations } from './designations';
import { canWorkFrom, findJob, findJobAt, stationWantsWork, JOB_PATH_NODES, JobContext, reservePlan, Reservations, workSpeed } from './jobs';
import { harvestAt, harvestTile, Stockpile } from './resources';
import { StorageZones } from './zones';
import { GrowZones } from './farming';
import { regrowNature } from './nature';
import { Rooms } from './rooms';
import { tickHealth, treatWounds } from './health';
import { Difficulty, initialSchedule, makeDifficulty, scaledSupplies, StorySchedule } from './storyteller';
import { canTalk, colonistFight, dropGear, makePrisoner, runStoryteller, talkToPrisoner, updateOthers } from './people';
import { AMMO_CARRY, AMMO_LOW, isGear, isWeapon, WEAPON_IDS, WEAPONS, weaponScore } from '../data/weapons';
import { ARMOR_IDS, ARMORS, isArmor } from '../data/armor';
import { TRAPPED_TILES } from './diagnostics';
import {
  BAD_WATER_TICKS_DAYS, DEHYDRATED, DRINK_TICKS, EAT_TICKS, EXHAUSTED, foodDecay, foodPreference, HUNGRY, isFood, isRawFood, NUTRITION, restDecay,
  restGain, STARVING, THIRSTY, TIRED, waterDecay,
} from './needs';
import { applyTerrainJob, LOWER_STONE, terrainBlocker, TerrainJob, TerrainOrders } from './terrain';
import { Structure, Structures } from './structures';
import { lacksPower, litTiles, PowerNet, updatePower, windStrength } from './power';
import type { TileRect } from './designations';
import { RESOURCES, ResourceId, STARTING_SUPPLIES } from '../data/resources';

import { TICKS_PER_DAY, TICKS_PER_HOUR, TICKS_PER_SECOND } from './time';
export { TICKS_PER_DAY, TICKS_PER_HOUR, TICKS_PER_SECOND };
/** Casillas por segundo (a x1) de un colono normal en terreno de coste 1. */
const BASE_WALK_SPEED = 3;
/** La partida empieza a las 7:00 del día 1. */
const START_HOUR = 7;
/** Máximo de ticks a simular por fotograma para no bloquear el navegador. */
const MAX_TICKS_PER_UPDATE = 60;
/** Casillas que mira un colono, como mucho, buscando dónde beber. */
const DRINK_SEARCH_TILES = 12000;
/** Ticks que espera un colono para volver a buscar trabajo si no encontró ninguno. */
const JOB_RETRY_TICKS = 90;
/** Ticks de pausa entre terminar un trabajo y empezar el siguiente. */
const JOB_PAUSE_TICKS = 10;
/** Velocidad de trabajo de noche sin luz. */
const DARK_WORK = 0.8;
/** Cada cuánto mira un colono, entre trabajos, si hay un arma mejor o le faltan flechas. */
const GEAR_SCAN_TICKS = TICKS_PER_SECOND * 5;
/** Cada cuánto se mira si alguien se ha quedado encerrado (10 minutos de juego). */
const RESCUE_TICKS = TICKS_PER_HOUR / 6;
/** Distancia máxima a la que se saca a alguien encerrado. */
const RESCUE_RADIUS = 8;
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
  /** Hambre y sueño (por defecto, sí). */
  needs?: boolean;
  /** Sucesos del narrador: supervivientes, raids, caravanas (por defecto, sí). */
  events?: boolean;
  /** Dureza y días sin raids (por defecto, Normal con 5 días). */
  difficulty?: Partial<Difficulty>;
}

/** Una línea del diario de la colonia. */
export interface LogEntry {
  tick: number;
  text: string;
  kind: 'info' | 'bueno' | 'malo';
}

/** Algo que el jugador tiene que decidir (p. ej. aceptar a un superviviente). */
export interface Offer {
  kind: 'superviviente';
  pawn: Colonist;
  /** Tick hasta el que espera respuesta. */
  until: number;
}

export class World implements JobContext {
  readonly map: GameMap;
  readonly rng: Rng;
  readonly colonists: Colonist[] = [];
  /** Personas que no son de la colonia: saqueadores, prisioneros, comerciantes. */
  readonly others: Colonist[] = [];
  /** Raids en marcha (para la moral: huyen todos al caer su líder o la mitad). */
  readonly raidGroups: RaidGroup[] = [];
  /** Diario: lo que ha pasado (el más reciente al final). */
  readonly log: LogEntry[] = [];
  /** Colonos muertos: nombre, causa y día. */
  readonly graveyard: { name: string; cause: string; day: number }[] = [];
  /** La partida ha terminado (no queda nadie). */
  gameOver: { day: number; cause: string } | null = null;
  /** Decisión pendiente para el jugador. */
  offer: Offer | null = null;
  /** Cuándo pasan las cosas. */
  schedule: StorySchedule;
  eventsEnabled: boolean;
  /** Dureza de la partida y días sin raids al empezar. */
  difficulty: Difficulty;
  /** Siguiente id para una persona nueva. */
  nextPawnId = 1;
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
  /** Habitaciones cerradas (se recalculan solas cuando cambian construcciones o relieve). */
  readonly rooms: Rooms;
  /** Casillas cuyo objeto ha cambiado desde la última vez que se preguntó (para repintarlas). */
  private changedTiles: number[] = [];
  /** Cambia cuando cambia el relieve (el dibujado recoloca lo que va encima del suelo). */
  terrainVersion = 0;
  /** Cambia cuando cambia algún objeto del mapa (talado, rebrotado…). */
  propsVersion = 0;
  /** Tick a partir del cual cada colono vuelve a mirar si puede comer o dormir. */
  private nextNeedScan = new Map<number, number>();
  /** Hambre y sueño activados (se pueden quitar en pruebas que no van de eso). */
  needsEnabled: boolean;
  /** Tick a partir del cual cada colono vuelve a mirar si hay un arma mejor o le faltan flechas. */
  private nextGearScan = new Map<number, number>();
  /** Tick a partir del cual cada colono vuelve a buscar trabajo. */
  private nextJobScan = new Map<number, number>();
  /**
   * Avisos internos para el registro de errores (no se guardan): p. ej. por qué estaba encerrado
   * un colono al que se ha sacado. La comprobación de 🐞 los recoge.
   */
  readonly incidents: string[] = [];
  /** Redes eléctricas (se recalculan cada segundo; no se guardan). */
  powerNets: PowerNet[] = [];
  /** Casillas iluminadas por lámparas encendidas. */
  lit = new Set<number>();
  /** Arqueros reclutados que van a una casilla con cobertura (no se guarda). */
  readonly coverMoves = new Set<number>();
  tick = 0;
  speed: GameSpeed = 1;
  private accumulator = 0;

  constructor(opts: WorldOptions) {
    this.needsEnabled = opts.needs ?? true;
    this.eventsEnabled = opts.events ?? true;
    this.difficulty = makeDifficulty(opts.difficulty);
    this.schedule = initialSchedule(TICKS_PER_DAY, 0, this.difficulty.graceDays);
    this.map = opts.map ?? generateMap({ width: opts.width ?? MAP_SIZE, height: opts.height ?? MAP_SIZE, seed: opts.seed });
    this.rng = new Rng(opts.seed ^ 0x51ed270b);
    if (!opts.map) this.spawnColonists(opts.colonists ?? 3);
    this.nextPawnId = this.colonists.length + 1;
    this.items = new GroundItems(this.map);
    // Una estantería terminada multiplica lo que cabe en su casilla.
    this.items.capacityAt = (x, y, resource) => {
      const s = this.structures?.at(x, y);
      if (!s || !s.built || !s.def.storage) return 1;
      // El armero solo guarda armas y munición: lo demás no cabe en sus casillas.
      if (s.def.storageFor === 'armas' && resource && !isGear(resource)) return 0;
      return s.def.storage;
    };
    this.designations = new Designations(this.map);
    this.reservations = new Reservations(this.map);
    this.zones = new StorageZones(this.map);
    this.structures = new Structures(this.map);
    this.farms = new GrowZones(this.map);
    this.terrain = new TerrainOrders(this.map);
    this.rooms = new Rooms(this.map, this.structures, () => `${this.structures.version}:${this.terrainVersion}:${this.propsVersion}`);
    if (!opts.map) this.dropStartingSupplies();
  }

  /** Apunta casillas que hay que repintar (y que pueden cambiar las habitaciones). */
  private markChanged(...tiles: number[]): void {
    if (tiles.length === 0) return;
    this.changedTiles.push(...tiles);
    this.propsVersion++;
  }

  /** Cambia el objeto de una casilla (modo Dios) y la repinta. */
  setProp(x: number, y: number, prop: Prop): void {
    const i = y * this.map.width + x;
    this.map.props[i] = prop;
    this.map.stock[i] = 0;
    this.designations.remove(x, y);
    this.markChanged(i);
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
      this.markChanged(y * this.map.width + x);
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
        // Nada nace a menos de 2 casillas de un colono ni en su camino: un árbol que rebrota no puede encerrarlo.
        !this.colonists.some((c) => Math.abs(c.tile.x - x) <= 2 && Math.abs(c.tile.y - y) <= 2) &&
        !this.colonists.some((c) => c.path.some((p) => p.x === x && p.y === y)));
      this.markChanged(...grown);
    }
    // Las plantas crecen a saltos de un segundo (basta y cuesta poco).
    if (this.tick % TICKS_PER_SECOND === 0) {
      const h = this.hour;
      this.farms.grow(TICKS_PER_SECOND, h >= 6 && h < 20, TICKS_PER_DAY);
    }
    // Salud: cada segundo (hambre, sed, heridas y recuperación).
    if (this.tick % TICKS_PER_SECOND === 0) {
      for (const c of [...this.colonists, ...this.others]) {
        const r = tickHealth(c, TICKS_PER_SECOND, TICKS_PER_DAY, c.activity === 'sleeping');
        if (r.died) this.killPawn(c, r.cause ?? 'heridas');
      }
    }
    if (this.eventsEnabled && this.tick % TICKS_PER_HOUR === 0) runStoryteller(this);
    if (this.tick % RESCUE_TICKS === 0) this.rescueTrapped();
    // Electricidad: cada segundo se reparte la corriente y se encienden o apagan las lámparas.
    if (this.tick % TICKS_PER_SECOND === 0) {
      this.powerNets = updatePower(this.structures, TICKS_PER_SECOND / TICKS_PER_HOUR, { hour: this.hour, wind: this.wind });
      this.lit = litTiles(this.structures);
    }
    for (const c of this.colonists) this.updateColonist(c);
    updateOthers(this);
  }

  // --- Personas: diario, muertes y llegadas ------------------------------------------

  addLog(text: string, kind: LogEntry['kind'] = 'info'): void {
    this.log.push({ tick: this.tick, text, kind });
    if (this.log.length > 200) this.log.splice(0, this.log.length - 200);
  }

  /** Todas las personas del mapa. */
  pawns(): Colonist[] {
    return [...this.colonists, ...this.others];
  }

  /** Una persona muere: deja lo que llevaba y se apunta en el diario. */
  killPawn(c: Colonist, cause: string): void {
    dropGear(this, c);
    if (c.role === 'colono') {
      this.dropJob(c);
      if (c.need) this.endNeed(c);
      const i = this.colonists.indexOf(c);
      if (i >= 0) this.colonists.splice(i, 1);
      this.graveyard.push({ name: c.name, cause, day: this.day });
      this.addLog(`💀 ${c.name} «${c.nickname}» ha muerto (${cause}).`, 'malo');
      if (this.colonists.length === 0 && !this.gameOver) {
        this.gameOver = { day: this.day, cause };
        this.addLog('La colonia ha caído: no queda nadie.', 'malo');
      }
    } else {
      this.reservations.releaseAll(c.id);
      const i = this.others.indexOf(c);
      if (i >= 0) this.others.splice(i, 1);
      if (c.carrying) this.items.drop(c.tile.x, c.tile.y, c.carrying.resource, c.carrying.amount);
      const who = c.role === 'saqueador' ? 'Un saqueador' : c.role === 'prisionero' ? 'El prisionero' : 'Alguien';
      this.addLog(`${who} (${c.name}) ha muerto (${cause}).`, 'info');
    }
  }

  /** Persona nueva (aún sin colocar). */
  makePawn(role: Colonist['role']): Colonist {
    const c = createColonist(this.nextPawnId++, { x: 0, y: 0 }, this.rng);
    c.role = role;
    return c;
  }

  /** Coloca a una persona en una casilla transitable del borde del mapa (desde donde se llegue al inicio). */
  placeAtEdge(c: Colonist): boolean {
    const m = this.map;
    for (let tries = 0; tries < 200; tries++) {
      const side = this.rng.int(0, 3);
      const k = this.rng.int(0, (side % 2 === 0 ? m.width : m.height) - 1);
      const p = side === 0 ? { x: k, y: 0 } : side === 1 ? { x: m.width - 1, y: k } : side === 2 ? { x: k, y: m.height - 1 } : { x: 0, y: k };
      if (!isPassable(m, p.x, p.y)) continue;
      if (!findPath(m, p, m.start, 60000)) continue;
      c.tile = { ...p };
      c.pos = { x: p.x + 0.5, y: p.y + 0.5 };
      c.path = [];
      return true;
    }
    return false;
  }

  /** El jugador acepta lo que se le ofrece. */
  acceptOffer(): void {
    const o = this.offer;
    if (!o) return;
    this.offer = null;
    if (o.kind === 'superviviente') this.joinColony(o.pawn, 'se une a la colonia');
  }

  rejectOffer(): void {
    if (!this.offer) return;
    this.addLog(`${this.offer.pawn.name} sigue su camino.`, 'info');
    this.offer = null;
  }

  /** Alguien pasa a ser de la colonia (superviviente, prisionero convencido…). */
  joinColony(c: Colonist, why: string): void {
    const i = this.others.indexOf(c);
    if (i >= 0) this.others.splice(i, 1);
    this.reservations.releaseAll(c.id);
    c.role = 'colono';
    c.prisoner = undefined;
    c.drafted = false;
    c.job = null;
    c.need = null;
    if (c.pos.x === 0.5 && c.pos.y === 0.5 && c.tile.x === 0 && c.tile.y === 0) this.placeAtEdge(c);
    // Que nadie comparta id.
    if (this.colonists.some((k) => k.id === c.id)) c.id = this.nextPawnId++;
    this.colonists.push(c);
    const path = findPath(this.map, c.tile, this.map.start, 60000);
    if (path) {
      c.path = path;
      c.activity = 'moving';
    }
    this.addLog(`🙂 ${c.name} «${c.nickname}» ${why}.`, 'bueno');
  }

  /** Orden directa: el colono va a la casilla indicada. Devuelve false si no hay camino. */
  orderMove(colonistId: number, target: Point): boolean {
    const c = this.colonists.find((k) => k.id === colonistId);
    if (!c) return false;
    const path = findPath(this.map, c.tile, target);
    if (!path) return false;
    this.dropJob(c); // la orden directa manda sobre el trabajo
    c.gearTask = undefined;
    if (c.need) this.endNeed(c); // y sobre comer o dormir
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

  /** Viento ahora, de 0 a 1 (mueve los molinos). */
  get wind(): number {
    return windStrength(this.tick / TICKS_PER_HOUR, this.map.seed);
  }

  clockLabel(): string {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return `Día ${this.day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Deja las provisiones iniciales junto al punto de inicio (sin azar: no cambia el resto de la partida). */
  private dropStartingSupplies(): void {
    const { start } = this.map;
    const supplies = scaledSupplies(STARTING_SUPPLIES, this.difficulty.level);
    for (const r of RESOURCES) {
      const amount = supplies[r] ?? 0;
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
    if (c.downed) {
      // En el suelo: no hace nada hasta recuperarse (o hasta que lo curen).
      c.gearTask = undefined;
      if (c.job) this.dropJob(c);
      if (c.need) this.endNeed(c);
      c.path = [];
      c.activity = 'idle';
      return;
    }
    // Si hay un saqueador al lado, se defiende (y si está reclutado, va a por los cercanos).
    if (colonistFight(this, c)) return;
    if (this.needsEnabled) {
      this.decayNeeds(c);
      if (c.need) {
        this.updateNeed(c);
        return;
      }
      if (!c.drafted && this.tryStartNeed(c)) return;
    }
    if (c.job) {
      this.updateJob(c);
      return;
    }
    if (c.gearTask) {
      this.updateGear(c);
      return;
    }
    if (c.drafted) {
      // Reclutado: solo se mueve si se le manda; si no, espera quieto.
      if (c.path.length > 0) this.moveAlongPath(c);
      else c.activity = 'idle';
      return;
    }
    // Entre trabajo y trabajo (no en mitad de una orden directa), coge un arma mejor o flechas.
    if ((c.path.length === 0 || c.activity === 'wandering') && this.tryStartGear(c)) return;
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

  // --- Armas: coger la mejor libre y flechas ---------------------------------------------

  /** Lo que quiere ir a coger: un arma mejor que la suya, la que se le ha elegido, o flechas. */
  wantedGear(c: Colonist): ResourceId | null {
    const inv = this.items.totals();
    if (c.weaponChoice === 'ninguna') return null;
    if (c.weaponChoice !== 'auto') {
      if (c.weapon !== c.weaponChoice && inv[c.weaponChoice] > 0) return c.weaponChoice;
    } else {
      const arrows = c.ammo > 0 || inv.flechas > 0;
      let best = c.weapon;
      let bestScore = weaponScore(c.weapon, arrows);
      for (const id of WEAPON_IDS) {
        if (inv[id] <= 0) continue;
        const sc = weaponScore(id, arrows);
        if (sc > bestScore + 0.05) {
          best = id;
          bestScore = sc;
        }
      }
      if (best !== c.weapon) return best;
    }
    if (c.weapon && WEAPONS[c.weapon].ammo && c.ammo < AMMO_LOW && inv.flechas > 0) return 'flechas';
    // Armadura: el chaleco y el casco que más protegen de los que hay libres.
    if (c.armorChoice === 'auto') {
      for (const slot of ['chaleco', 'casco'] as const) {
        const now = slot === 'chaleco' ? c.vest : c.helmet;
        let best = now;
        for (const id of ARMOR_IDS) {
          const def = ARMORS[id];
          if (def.slot !== slot || inv[id] <= 0) continue;
          if (def.protection > (best ? ARMORS[best].protection : 0)) best = id;
        }
        if (best !== now) return best;
      }
    }
    return null;
  }

  /** Armadura: la mejor libre o ninguna (la que lleva se deja en el suelo y la llevan al almacén). */
  setArmorChoice(c: Colonist, choice: Colonist['armorChoice']): void {
    c.armorChoice = choice;
    c.gearTask = undefined;
    this.nextGearScan.delete(c.id);
    if (choice === 'ninguna') {
      if (c.vest) this.items.drop(c.tile.x, c.tile.y, c.vest, 1);
      if (c.helmet) this.items.drop(c.tile.x, c.tile.y, c.helmet, 1);
      c.vest = null;
      c.helmet = null;
    }
  }

  /** Aplica lo elegido en la ficha: sin arma, la suelta (y la llevan al almacén). */
  setWeaponChoice(c: Colonist, choice: Colonist['weaponChoice']): void {
    c.weaponChoice = choice;
    c.gearTask = undefined;
    this.nextGearScan.delete(c.id);
    if (choice === 'ninguna' || (choice !== 'auto' && c.weapon && c.weapon !== choice)) {
      if (c.weapon) this.items.drop(c.tile.x, c.tile.y, c.weapon, 1);
      if (c.ammo > 0) this.items.drop(c.tile.x, c.tile.y, 'flechas', c.ammo);
      c.weapon = null;
      c.ammo = 0;
    }
  }

  private tryStartGear(c: Colonist): boolean {
    if (this.tick < (this.nextGearScan.get(c.id) ?? 0)) return false;
    this.nextGearScan.set(c.id, this.tick + GEAR_SCAN_TICKS);
    const want = this.wantedGear(c);
    if (!want) return false;
    const stacks = this.items
      .list()
      .filter((s) => s.resource === want)
      .sort((a, b) => Math.abs(a.x - c.tile.x) + Math.abs(a.y - c.tile.y) - (Math.abs(b.x - c.tile.x) + Math.abs(b.y - c.tile.y)))
      .slice(0, 3);
    for (const s of stacks) {
      const here = s.x === c.tile.x && s.y === c.tile.y;
      const path = here ? [] : findPath(this.map, c.tile, { x: s.x, y: s.y }, JOB_PATH_NODES);
      if (!here && !path) continue;
      c.gearTask = { x: s.x, y: s.y, resource: want };
      c.path = path ?? [];
      c.activity = 'moving';
      return true;
    }
    return false;
  }

  private updateGear(c: Colonist): void {
    const t = c.gearTask!;
    if (c.tile.x === t.x && c.tile.y === t.y && c.path.length === 0) {
      c.gearTask = undefined;
      c.activity = 'idle';
      if (t.resource === 'flechas') {
        const got = this.items.at(t.x, t.y)?.resource === 'flechas' ? this.items.take(t.x, t.y, AMMO_CARRY - c.ammo) : null;
        if (got) c.ammo += got.amount;
        return;
      }
      if (isArmor(t.resource)) {
        if (this.items.at(t.x, t.y)?.resource !== t.resource || !this.items.take(t.x, t.y, 1)) return;
        const slot = ARMORS[t.resource].slot;
        const old = slot === 'chaleco' ? c.vest : c.helmet;
        if (old) this.items.drop(t.x, t.y, old, 1);
        if (slot === 'chaleco') c.vest = t.resource;
        else c.helmet = t.resource;
        return;
      }
      if (!isWeapon(t.resource) || this.items.at(t.x, t.y)?.resource !== t.resource) return;
      const got = this.items.take(t.x, t.y, 1);
      if (!got) return;
      // Deja la que llevaba (y sus flechas, si la nueva no las usa) donde estaba la nueva.
      if (c.weapon) this.items.drop(t.x, t.y, c.weapon, 1);
      if (c.ammo > 0 && !WEAPONS[t.resource].ammo) {
        this.items.drop(t.x, t.y, 'flechas', c.ammo);
        c.ammo = 0;
      }
      c.weapon = t.resource;
      return;
    }
    if (c.path.length === 0) {
      // Ya no se puede llegar (o lo han apartado): lo intentará más tarde.
      c.gearTask = undefined;
      return;
    }
    this.moveAlongPath(c);
  }

  // --- Necesidades: comer y dormir --------------------------------------------------

  private decayNeeds(c: Colonist): void {
    const n = c.needs;
    n.food = Math.max(0, n.food - foodDecay(c, TICKS_PER_DAY));
    n.water = Math.max(0, n.water - waterDecay(TICKS_PER_DAY));
    if (c.activity !== 'sleeping') n.rest = Math.max(0, n.rest - restDecay(TICKS_PER_HOUR));
  }

  /** Es de noche (22:00–6:00): hora de dormir. */
  private get isNight(): boolean {
    const h = this.hour;
    return h >= 22 || h < 6;
  }

  /** Empieza a comer o a dormir si hace falta. Lo urgente interrumpe el trabajo. */
  private tryStartNeed(c: Colonist): boolean {
    const n = c.needs;
    const busy = c.job !== null || c.activity === 'moving';
    const wantsSleep = n.rest < (busy ? EXHAUSTED : TIRED) || (!busy && this.isNight && n.rest < 0.75);
    const wantsFood = n.food < (busy ? STARVING : HUNGRY);
    const wantsWater = n.water < (busy ? DEHYDRATED : THIRSTY);
    if (!wantsSleep && !wantsFood && !wantsWater) return false;
    if (this.tick < (this.nextNeedScan.get(c.id) ?? 0)) return false;
    // Primero lo más grave.
    const wants: { what: 'comer' | 'dormir' | 'beber'; level: number }[] = [];
    if (wantsFood) wants.push({ what: 'comer', level: n.food });
    if (wantsWater) wants.push({ what: 'beber', level: n.water });
    if (wantsSleep) wants.push({ what: 'dormir', level: n.rest });
    wants.sort((a, b) => a.level - b.level);
    for (const { what } of wants) {
      const ok = what === 'comer' ? this.startEating(c) : what === 'beber' ? this.startDrinking(c) : this.startSleeping(c);
      if (ok) return true;
    }
    this.nextNeedScan.set(c.id, this.tick + JOB_RETRY_TICKS);
    return false;
  }

  /**
   * Agua que se puede beber desde una casilla en la que se está de pie: limpia (manantial, pozo,
   * depuradora o agua sin contaminar al lado), sucia (solo agua contaminada) o ninguna.
   */
  drinkAt(x: number, y: number): 'limpia' | 'sucia' | null {
    let dirty = false;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= this.map.width || ny >= this.map.height) continue;
      const i = ny * this.map.width + nx;
      if (this.map.props[i] === Prop.Spring) return 'limpia';
      const s = this.structures.at(nx, ny);
      // La depuradora solo limpia el agua con corriente; el pozo no la necesita.
      if (s && s.built && s.def.category === 'agua' && !lacksPower(s)) return 'limpia';
      if (isWater(this.map.terrain[i] as Terrain)) {
        if (!this.map.contaminated[i]) return 'limpia';
        dirty = true;
      }
    }
    return dirty ? 'sucia' : null;
  }

  /** Va a beber al sitio más cercano con agua limpia (o, si no hay, con agua contaminada). */
  private startDrinking(c: Colonist): boolean {
    const m = this.map;
    const start = c.tile.y * m.width + c.tile.x;
    const seen = new Set<number>([start]);
    const queue = [start];
    let dirtySpot: Point | null = null;
    let clean: Point | null = null;
    for (let head = 0; head < queue.length && head < DRINK_SEARCH_TILES; head++) {
      const i = queue[head];
      const x = i % m.width;
      const y = (i - x) / m.width;
      const kind = this.drinkAt(x, y);
      if (kind === 'limpia') {
        clean = { x, y };
        break;
      }
      if (kind === 'sucia' && !dirtySpot) dirtySpot = { x, y };
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isPassable(m, nx, ny)) continue;
        const j = ny * m.width + nx;
        if (seen.has(j)) continue;
        seen.add(j);
        queue.push(j);
      }
    }
    const spot = clean ?? dirtySpot;
    if (!spot) return false;
    const route = this.routeTo(c, [spot]);
    if (!route) return false;
    if (c.job) this.dropJob(c);
    c.need = { type: 'beber', x: spot.x, y: spot.y, bed: false, progress: 0, dirty: !clean };
    c.path = route.path;
    c.activity = 'toNeed';
    return true;
  }

  /** Va al montón de comida más cercano al que se llega. */
  private startEating(c: Colonist): boolean {
    const foods = this.items
      .list()
      .filter((s) => isFood(s.resource) && this.reservations.holder(s.x, s.y, 'pickup') === undefined)
      .map((s) => ({ s, d: foodPreference(s.resource, Math.abs(s.x - c.tile.x) + Math.abs(s.y - c.tile.y)) }))
      .sort((a, b) => a.d - b.d || a.s.y - b.s.y || a.s.x - b.s.x)
      .map((e) => e.s);
    for (const f of foods.slice(0, 6)) {
      const route = this.routeTo(c, [{ x: f.x, y: f.y }]);
      if (!route) continue;
      if (c.job) this.dropJob(c);
      this.reservations.reserve(f.x, f.y, c.id, 'pickup');
      c.need = { type: 'comer', x: f.x, y: f.y, bed: false, progress: 0 };
      c.path = route.path;
      c.activity = 'toNeed';
      return true;
    }
    return false;
  }

  /** Va a la cama libre más cercana; si no hay, duerme donde está. */
  private startSleeping(c: Colonist): boolean {
    const beds = this.structures
      .all()
      .filter((s) => s.built && s.def.id === 'cama' && this.reservations.holder(s.x, s.y) === undefined)
      .sort((a, b) => Math.abs(a.x - c.tile.x) + Math.abs(a.y - c.tile.y) - (Math.abs(b.x - c.tile.x) + Math.abs(b.y - c.tile.y)));
    if (c.job) this.dropJob(c);
    for (const b of beds.slice(0, 4)) {
      const route = this.routeTo(c, [{ x: b.x, y: b.y }]);
      if (!route) continue;
      this.reservations.reserve(b.x, b.y, c.id, 'work');
      c.need = { type: 'dormir', x: b.x, y: b.y, bed: true, progress: 0 };
      c.path = route.path;
      c.activity = 'toNeed';
      return true;
    }
    c.need = { type: 'dormir', x: c.tile.x, y: c.tile.y, bed: false, progress: 0 };
    c.path = [];
    c.activity = 'sleeping';
    return true;
  }

  /** Deja de comer o dormir (terminado o imposible) y suelta lo reservado. */
  endNeed(c: Colonist): void {
    this.reservations.releaseAll(c.id);
    c.need = null;
    c.path = [];
    c.activity = 'idle';
    c.waitTicks = 10;
  }

  private updateNeed(c: Colonist): void {
    const t = c.need!;
    if (c.path.length > 0) {
      this.moveAlongPath(c);
      return;
    }
    if (t.type === 'beber') {
      if (c.tile.x !== t.x || c.tile.y !== t.y) {
        const path = findPath(this.map, c.tile, t, JOB_PATH_NODES);
        if (!path || path.length === 0) this.endNeed(c);
        else c.path = path;
        return;
      }
      c.activity = 'eating';
      t.progress++;
      if (t.progress < DRINK_TICKS) return;
      c.needs.water = 1;
      if (t.dirty) c.needs.badWaterUntil = this.tick + BAD_WATER_TICKS_DAYS * TICKS_PER_DAY;
      this.endNeed(c);
      return;
    }
    if (t.type === 'comer') {
      const stack = this.items.at(t.x, t.y);
      if (!stack || !isFood(stack.resource)) {
        this.endNeed(c);
        return;
      }
      if (c.tile.x !== t.x || c.tile.y !== t.y) {
        const path = findPath(this.map, c.tile, t, JOB_PATH_NODES);
        if (!path || path.length === 0) this.endNeed(c);
        else c.path = path;
        return;
      }
      c.activity = 'eating';
      t.progress++;
      if (t.progress < EAT_TICKS) return;
      const per = NUTRITION[stack.resource] ?? 0.1;
      const units = Math.max(1, Math.ceil((1 - c.needs.food) / per));
      const got = this.items.take(t.x, t.y, units);
      if (got) {
        c.needs.food = Math.min(1, c.needs.food + got.amount * per);
        c.needs.lastMeal = isRawFood(got.resource) ? 'cruda' : 'cocinada';
      }
      this.endNeed(c);
      return;
    }
    // Dormir.
    if (t.bed) {
      const bed = this.structures.at(t.x, t.y);
      if (!bed || !bed.built) {
        this.endNeed(c);
        return;
      }
      if (c.tile.x !== t.x || c.tile.y !== t.y) {
        const path = findPath(this.map, c.tile, t, JOB_PATH_NODES);
        if (!path || path.length === 0) this.endNeed(c);
        else c.path = path;
        return;
      }
    }
    c.activity = 'sleeping';
    c.needs.rest = Math.min(1, c.needs.rest + restGain(t.bed, TICKS_PER_HOUR));
    // Se despierta descansado (o, de día, bastante descansado) o si el hambre aprieta.
    const rested = c.needs.rest >= 0.99 || (!this.isNight && c.needs.rest >= 0.85);
    if (rested || c.needs.food < STARVING) {
      c.needs.sleptIn = t.bed ? (this.rooms.at(t.x, t.y) ? 'habitacion' : 'cama') : 'suelo';
      this.endNeed(c);
    }
  }

  /** Busca trabajo (si toca) y lo empieza. true si ahora tiene uno. */
  private tryStartJob(c: Colonist): boolean {
    const people = this.others.length > 0 || this.colonists.some((k) => k.wounds.some((w) => w.bleeding));
    if (!people && this.designations.count === 0 && this.zones.all().length === 0 && this.structures.blueprints().length === 0 && this.structures.toDemolish().length === 0 && this.structures.stations().length === 0 && this.farms.all().length === 0 && this.farms.plantList().length === 0 && this.terrain.count === 0 && !this.structures.all().some((s) => s.built && !!s.def.fuel)) return false;
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
  dropJob(c: Colonist): void {
    this.reservations.releaseAll(c.id);
    if (c.carrying) {
      this.items.drop(c.tile.x, c.tile.y, c.carrying.resource, c.carrying.amount);
      c.carrying = null;
    }
    if (!c.job) return;
    if (c.job.escorting) {
      // Suelta a quien llevaba a la celda donde esté.
      for (const o of this.others) if (o.carriedBy === c.id) o.carriedBy = undefined;
    }
    c.job = null;
    c.path = [];
    c.activity = 'idle';
    c.waitTicks = JOB_PAUSE_TICKS;
  }

  /** Construcción a la que va un trabajo (por su id; si no tiene, la de la casilla). */
  private jobStructure(j: NonNullable<Colonist['job']>): Structure | undefined {
    return j.sid !== undefined ? this.structures.get(j.sid) : this.structures.at(j.x, j.y);
  }

  /** El trabajo sigue teniendo sentido (no se ha quitado la orden, el montón sigue ahí…). */
  private jobStillValid(c: Colonist): boolean {
    const j = c.job!;
    const h = j.haul;
    if (j.kind === 'curar' || j.kind === 'carcelero') {
      const o = this.pawns().find((k) => k.id === j.pid);
      if (!o) return false;
      if (j.kind === 'curar') return o.wounds.some((w) => w.bleeding);
      if (j.escorting) return o.role === 'prisionero';
      if (j.warden === 'capturar') return o.role === 'saqueador' && o.downed;
      if (o.role !== 'prisionero' || o.prisoner?.mode === 'liberar') return false;
      if (j.warden === 'alimentar') return this.foodStack() !== null;
      return canTalk(this.tick, o);
    }
    if (j.kind === 'construir') {
      const s = this.jobStructure(j);
      if (j.demolish) return !!s && s.built && !!s.demolish;
      if (!s || s.built) return false;
      if (h && !h.picked) {
        const st = this.items.at(h.from.x, h.from.y);
        if (!st || st.resource !== h.resource || (this.structures.needs(s)[h.resource] ?? 0) <= 0) return false;
      }
      return true;
    }
    if (j.kind === 'fabricar' || j.kind === 'cocinar') {
      const s = this.jobStructure(j);
      if (!s || !stationWantsWork(this, s)) return false;
      if (h && !h.picked) {
        const st = this.items.at(h.from.x, h.from.y);
        return !!st && st.resource === h.resource && (this.structures.needs(s)[h.resource] ?? 0) > 0;
      }
      return h ? true : !this.structures.needsAny(s);
    }
    if (j.kind === 'terreno') {
      return this.terrain.at(j.x, j.y) === j.terrain && !terrainBlocker(this.map, j.x, j.y, j.terrain!, !!this.structures.at(j.x, j.y));
    }
    if (j.kind === 'cultivar') {
      if (j.farm === 'cosechar') return (this.farms.plantAt(j.x, j.y)?.growth ?? 0) >= 1;
      const z = this.farms.at(j.x, j.y);
      return !!z && !this.farms.plantAt(j.x, j.y) && this.farms.canSow(j.x, j.y, z.crop) && !this.structures.at(j.x, j.y);
    }
    if (j.kind === 'transportar' && j.sid !== undefined) {
      // Llevar combustible a un generador.
      const s = this.structures.get(j.sid);
      if (!s || !s.built || s.demolish || !h) return false;
      if (!h.picked) {
        const st = this.items.at(h.from.x, h.from.y);
        return !!st && st.resource === h.resource && (this.structures.needs(s)[h.resource] ?? 0) > 0;
      }
      return true;
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
    if (j.kind === 'curar' || j.kind === 'carcelero') {
      this.updatePawnJob(c);
      return;
    }
    const building = j.kind === 'construir' || j.kind === 'fabricar' || j.kind === 'cocinar';
    const target = building ? this.jobStructure(j) : undefined;
    const inPlace = building ? !!target && this.structures.isBesideStructure(c.tile, target) : canWorkFrom(this.map, c.tile, j.x, j.y);
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
    j.progress += workSpeed(c, j.kind) * this.lightFactor(c.tile);
    if (building && j.demolish) {
      if (j.progress >= j.work) {
        this.demolishStructure(this.jobStructure(j)!);
        this.dropJob(c);
      }
      return;
    }
    if (j.kind === 'fabricar' || j.kind === 'cocinar') {
      const st = this.jobStructure(j);
      // Si se va la corriente a media tanda, la máquina se para y se deja el trabajo.
      if (st && lacksPower(st)) {
        this.dropJob(c);
        return;
      }
      if (j.progress >= j.work) {
        const s = this.jobStructure(j)!;
        if (this.structures.consumeInputs(s)) this.dropBeside(s, s.bill!.recipe.outputs);
        this.dropJob(c);
      }
      return;
    }
    if (building) {
      const s = this.jobStructure(j)!;
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

  /** Primer montón de comida que haya (para dar de comer a los prisioneros). */
  private foodStack(): { x: number; y: number } | null {
    return this.items.list().find((s) => isFood(s.resource)) ?? null;
  }

  /** Cama de prisionero terminada y libre (sin nadie encima ni reservada para traer a alguien). */
  freePrisonBed(): Point | null {
    for (const s of this.structures.all()) {
      if (!s.built || s.def.id !== 'cama_prision') continue;
      const busy = this.others.some((o) => o.role === 'prisionero' && o.carriedBy === undefined && o.tile.x === s.x && o.tile.y === s.y) ||
        this.colonists.some((k) => k.job?.escorting && k.job.x === s.x && k.job.y === s.y);
      if (!busy) return { x: s.x, y: s.y };
    }
    return null;
  }

  /** Trabajos con personas: curar, capturar, dar de comer, convencer y llevar a la celda. */
  private updatePawnJob(c: Colonist): void {
    const j = c.job!;
    const o = this.pawns().find((k) => k.id === j.pid)!;
    if (j.escorting) {
      // Ha llegado a la cama: deja al prisionero en ella.
      o.carriedBy = undefined;
      o.tile = { x: j.x, y: j.y };
      o.pos = { x: j.x + 0.5, y: j.y + 0.5 };
      this.addLog(`⛓ ${c.name} deja a ${o.name} en su celda.`, 'info');
      this.dropJob(c);
      return;
    }
    if (Math.max(Math.abs(c.tile.x - o.tile.x), Math.abs(c.tile.y - o.tile.y)) > 1) {
      const route = this.routeTo(c, [o.tile]);
      if (!route) {
        this.dropJob(c);
        this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
        return;
      }
      c.path = route.path;
      if (c.path.length === 0) this.dropJob(c);
      return;
    }
    c.activity = 'working';
    const dx = o.pos.x - c.pos.x;
    if (Math.abs(dx) > 0.01) c.facing = dx > 0 ? 1 : -1;
    j.progress += workSpeed(c, j.kind) * this.lightFactor(c.tile);
    if (j.progress < j.work) return;
    if (j.kind === 'curar') {
      const n = treatWounds(o);
      this.addLog(`🩹 ${c.name} cura ${n === 1 ? 'una herida' : `${n} heridas`} de ${o.name}.`, 'bueno');
      this.dropJob(c);
      return;
    }
    if (j.warden === 'capturar') {
      makePrisoner(o, 0.45 + this.rng.next() * 0.45);
      this.addLog(`⛓ ${c.name} captura a ${o.name}. Está en 👥 → Prisioneros.`, 'bueno');
      const bed = this.freePrisonBed();
      const path = bed ? findPath(this.map, c.tile, bed, 60000) : null;
      if (bed && path) {
        o.carriedBy = c.id;
        j.escorting = true;
        j.x = bed.x;
        j.y = bed.y;
        c.path = path;
        c.activity = 'toJob';
        return;
      }
      this.dropJob(c);
      return;
    }
    if (j.warden === 'alimentar') {
      const st = this.foodStack();
      if (st) {
        const per = NUTRITION[this.items.at(st.x, st.y)?.resource ?? 'patata'] ?? 0.1;
        const got = this.items.take(st.x, st.y, Math.max(1, Math.min(3, Math.ceil((1 - o.needs.food) / per))));
        if (got) o.needs.food = Math.min(1, o.needs.food + (NUTRITION[got.resource] ?? 0.1) * got.amount);
        o.needs.water = 1;
      }
      this.dropJob(c);
      return;
    }
    talkToPrisoner(this, c, o);
    this.dropJob(c);
  }

  /** Termina una obra de terreno: cambia el nivel (o hace la rampa) y repinta alrededor. */
  finishTerrainWork(x: number, y: number, job: TerrainJob): void {
    this.terrain.remove(x, y);
    const changed = applyTerrainJob(this.map, x, y, job);
    this.markChanged(...changed);
    this.terrainVersion++;
    if (job === 'rebajar') this.items.drop(x, y, 'piedra', LOWER_STONE);
    // En una zanja no se guarda nada: lo que hubiera se aparta.
    const stack = this.items.at(x, y);
    if (stack && !this.items.canHold(x, y)) {
      const got = this.items.take(x, y, stack.amount)!;
      this.items.drop(x, y, got.resource, got.amount);
    }
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
      const dest = h.toBlueprint ? this.jobStructure(j) : undefined;
      const targets = h.toBlueprint ? (dest ? this.structures.sidesOf(dest) : []) : [h.to];
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
    const dest = h.toBlueprint ? this.jobStructure(j) : undefined;
    const arrived = h.toBlueprint ? !!dest && this.structures.isBesideStructure(c.tile, dest) : c.tile.x === h.to.x && c.tile.y === h.to.y;
    if (!arrived) {
      this.repathOrDrop(c, j.stand);
      return;
    }
    const load = c.carrying;
    if (load) {
      let left = load.amount;
      if (h.toBlueprint) {
        const s = this.jobStructure(j);
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

  routeTo(c: Colonist, targets: Point[]): { stand: Point; path: Point[] } | null {
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

  /** Suelta recursos junto a una construcción (desde una casilla de al lado, por si ocupa varias). */
  private dropBeside(s: Structure, gains: Partial<Stockpile>): void {
    const side = this.structures.sidesOf(s)[0] ?? { x: s.x, y: s.y };
    this.items.dropAll(side.x, side.y, gains);
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
    c.gearTask = undefined;
    this.dropJob(c);
    if (c.need) this.endNeed(c);
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
    if (c.need) this.endNeed(c);
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
    if (s.def.storageFor) {
      // Lo que no se guarda en él (en un armero, lo que no es arma) sale a un lado.
      for (const t of this.structures.tilesOf(s)) {
        const stack = this.items.at(t.x, t.y);
        if (!stack || this.items.maxAt(t.x, t.y, stack.resource) > 0) continue;
        const got = this.items.take(t.x, t.y, stack.amount)!;
        const side = this.structures.sidesOf(s)[0] ?? t;
        this.items.drop(side.x, side.y, got.resource, got.amount);
      }
    }
    if (!s.def.blocks) return;
    const tiles = this.structures.tilesOf(s);
    const on = (p: Point) => tiles.some((t) => t.x === p.x && t.y === p.y);
    for (const t of tiles) {
      const stack = this.items.at(t.x, t.y);
      if (!stack) continue;
      const got = this.items.take(t.x, t.y, stack.amount)!;
      const side = this.structures.sidesOf(s)[0] ?? t;
      this.items.drop(side.x, side.y, got.resource, got.amount);
    }
    for (const c of this.colonists) {
      if (on(c.tile)) this.moveOutOfTheWay(c);
    }
    // Quien lo levantaba desde dentro de un hueco que acaba de cerrarse sale por el otro lado
    // (como si cruzara antes de poner la última pieza): nadie se queda encerrado al construir.
    for (const c of this.colonists) {
      if (!this.structures.isBesideStructure(c.tile, s)) continue;
      if (countReachable(this.map, c.tile.x, c.tile.y, TRAPPED_TILES) >= TRAPPED_TILES) continue;
      const out = this.structures.sidesOf(s).find((t) => countReachable(this.map, t.x, t.y, TRAPPED_TILES) >= TRAPPED_TILES);
      if (out) {
        c.tile = { ...out };
        c.pos = { x: out.x + 0.5, y: out.y + 0.5 };
        c.path = [];
      }
    }
    // Los caminos que pasaban por ahí se recalculan.
    for (const c of this.colonists) {
      if (!c.path.some(on)) continue;
      const goal = c.path[c.path.length - 1];
      const path = isPassable(this.map, goal.x, goal.y) ? findPath(this.map, c.tile, goal, JOB_PATH_NODES) : null;
      c.path = path ?? [];
    }
    this.zones.prune();
    this.farms.prune();
  }

  /**
   * Nadie se queda encerrado en un hueco, pase lo que pase (árboles, obras, terreno, modo Dios…):
   * quien solo llega a unas pocas casillas sale a la más cercana desde la que se llega lejos.
   * Se apunta qué lo rodeaba para encontrar la causa.
   */
  rescueTrapped(): number {
    let n = 0;
    for (const c of this.colonists) {
      if (countReachable(this.map, c.tile.x, c.tile.y, TRAPPED_TILES) >= TRAPPED_TILES) continue;
      const out = this.nearestOpenTile(c.tile, RESCUE_RADIUS);
      if (!out) continue;
      const from = { ...c.tile };
      const why = this.trapCauses(from);
      if (c.job) this.dropJob(c);
      c.tile = { ...out };
      c.pos = { x: out.x + 0.5, y: out.y + 0.5 };
      c.path = [];
      this.nextJobScan.delete(c.id);
      this.incidents.push(`${c.name} (#${c.id}) estaba encerrado en (${from.x}, ${from.y}) por ${why}; ha salido a (${out.x}, ${out.y})`);
      if (this.incidents.length > 20) this.incidents.shift();
      this.addLog(`🧗 ${c.name} estaba encerrado y sale como puede.`, 'info');
      n++;
    }
    return n;
  }

  /** Casilla más cercana (hasta `radius`) desde la que se llega lejos. */
  private nearestOpenTile(p: Point, radius: number): Point | null {
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = p.x + dx;
          const y = p.y + dy;
          if (!isWalkable(this.map, x, y)) continue;
          if (countReachable(this.map, x, y, TRAPPED_TILES) >= TRAPPED_TILES) return { x, y };
        }
      }
    }
    return null;
  }

  /** Qué impide el paso alrededor de una casilla (texto para el registro). */
  private trapCauses(p: Point): string {
    const out = new Set<string>();
    const m = this.map;
    const add = (x: number, y: number) => {
      if (!inBounds(m, x, y)) return out.add('borde del mapa');
      if (isPassable(m, x, y)) return;
      const i = y * m.width + x;
      const s = this.structures.mainAt(x, y);
      if (s?.built) out.add(s.def.name);
      else if (PROP_INFO[m.props[i] as Prop].blocks) out.add(PROP_INFO[m.props[i] as Prop].name);
      else if (m.cliff[i]) out.add('acantilado');
      else if (!TERRAIN_INFO[m.terrain[i] as Terrain].walkable) out.add(TERRAIN_INFO[m.terrain[i] as Terrain].name);
      else out.add('casilla bloqueada');
    };
    if (!isPassable(m, p.x, p.y)) out.add(`su propia casilla (${this.structures.mainAt(p.x, p.y)?.def.name ?? PROP_INFO[m.props[p.y * m.width + p.x] as Prop].name ?? 'bloqueada'})`);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(p.x + dx, p.y + dy);
    return [...out].join(', ') || 'algo desconocido';
  }

  /** De noche (20:00–6:00), sin luz se trabaja un 20 % más despacio; con una lámpara cerca, normal. */
  lightFactor(p: Point): number {
    const h = this.hour;
    if (h >= 6 && h < 20) return 1;
    return this.lit.has(p.y * this.map.width + p.x) ? 1 : DARK_WORK;
  }

  /** Red eléctrica de una construcción (la de un cable suyo o pegado), si tiene. */
  powerNetOf(s: Structure): PowerNet | undefined {
    return this.powerNets.find((n) => n.producers.includes(s) || n.consumers.includes(s) || n.batteries.includes(s) ||
      (!!s.def.conduit && n.tiles.includes(s.y * this.map.width + s.x)));
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

  moveAlongPath(c: Colonist): void {
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

