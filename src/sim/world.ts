import { Colonist, createColonist, RaidGroup, Stance, walkSpeedMultiplier } from './colonist';
import { createFactions, FactionState, shiftRelation } from './factions';
import { marketDay, MarketState, newMarket } from './market';
import { ActiveEvent, firstEventTick, runEvents, solarFactor } from './events';
import { burning, extinguish, threatens, updateFires } from './fire';
import { checkNewFaction, growBases, placeBases } from './worldmap';
import { coldNow, frostNow, updateCold } from './seasons';
import { updateClimate, updateHeat } from './climate';
import { updateHydroponics } from './hydroponics';
import { spoilHour } from './spoilage';
import { BoatTrip, updateBoatTrips } from './boatTrade';
import { animalDrops, feedPackAnimals, spawnAnimals, tryTame } from './animals';
import { ROOMS } from '../data/roomRules';
import { seasonOf } from '../data/seasons';
import { BattleInfo, checkBattle, Expedition, Outpost, Ruin, updateExpedition } from './expedition';
import { factionDef, RELATION } from '../data/factions';
import { countReachable, GameMap, generateMap, inBounds, isPassable, TRENCH_FLOODED, isWater, Prop, PROP_INFO, Terrain, TERRAIN_INFO, tileMoveCost } from './map';
import { findPath, isWalkable, Point } from './pathfinding';
import { Rng } from './rng';
import { GroundItems } from './items';
import { Designations } from './designations';
import { canWorkFrom, findJob, findJobAt, needsUrgentCare, researchBenchReady, stationWantsWork, JOB_PATH_NODES, JobContext, pathToNearest, reservePlan, Reservations, workSpeed } from './jobs';
import { harvestAt, harvestTile, Stockpile } from './resources';
import { StorageZones } from './zones';
import { ZoneClearing } from './clearing';
import { fertilityAt, GrowZones } from './farming';
import { regrowNature } from './nature';
import { Room, Rooms } from './rooms';
import { putRoof, roofed, roofRooms, roofTodo, roomInfoAt } from './roofs';
import { giveDose, needsDose, tickHealth, tickInfection, treatWounds } from './health';
import { Difficulty, initialSchedule, makeDifficulty, scaledSupplies, StorySchedule } from './storyteller';
import { findRefuge, updatePanic } from './panic';
import { attack, canHit, canTalk, colonistFight, creatureFallText, dropGear, hurtFoe, makePrisoner, runStoryteller, talkToPrisoner, TurretShot, updateOthers, updateTurrets, validAttackTarget } from './people';
import { AMMO_CARRY, AMMO_LOW, ammoFor, GRENADE, isAmmo, isGear, isWeapon, WEAPON_IDS, WEAPONS, weaponScore } from '../data/weapons';
import { ARMOR_IDS, ARMORS, armorProtection, isArmor } from '../data/armor';
import { FINISH_MOOD } from '../data/morale';
import { Corpse, updateCorpses } from './corpses';
import { Blast, Grenade, grenadesOf, updateGrenades } from './grenades';
import { updateMortars } from './mortar';
import { isLitBonfire, updateBonfireCheer, updateBonfires } from './bonfire';
import { CREATURES, flies, MACHINES } from '../data/creatures';
import { addResearch, isResearched, trenchesFlood, batteryMultiplier, infectionChanceFactor, machinePartsMultiplier, woundHealTimeFactor, unlocked, unlockedBy, chooseResearch, newResearch, ResearchState } from './research';
import { BED_REST, HOSPITAL_BED, HOSPITAL_BED_ID, SELF_CARE_WORK } from '../data/medicine';
import { absorbHit, anchorFor, besideTiles, defOf, nextTo, occupant, updateVehicle, Vehicle, vehicleCenter, vehiclePath, VehicleSeat, covers } from './vehicles';
import { prepName, theName, usesFuel, vehicleDef } from '../data/vehicles';
import { TRAPPED_TILES } from './diagnostics';
import {
  BAD_WATER_TICKS_DAYS, DEHYDRATED, DRINK_TICKS, EAT_TICKS, EXHAUSTED, foodDecay, foodPreference, HUNGRY, isFood, isRawFood, NUTRITION, restDecay,
  restGain, STARVING, THIRSTY, TIRED, waterDecay,
} from './needs';
import { applyTerrainJob, LOWER_STONE, terrainBlocker, TerrainJob, TerrainOrders, updateFlooding } from './terrain';
import { Bill, buildWork, PlaceShape, Structure, Structures } from './structures';
import { toggleDrawbridge, updateDrawbridges } from './drawbridge';
import { batteryCapacity, isDaylight, lacksPower, litTiles, PowerNet, shutDoorTiles, stationSpeed, updatePower, windStrength } from './power';
import type { TileRect } from './designations';
import { BUILDINGS, buildingDef, kitOf, depositOf } from '../data/buildings';
import { RECIPES, RecipeDef } from '../data/recipes';
import { CROPS, CropDef } from '../data/crops';
import { FOOD_RESOURCES, RESOURCES, ResourceId, STARTING_SUPPLIES } from '../data/resources';

import { TICKS_PER_DAY, TICKS_PER_HOUR, TICKS_PER_SECOND } from './time';
export { TICKS_PER_DAY, TICKS_PER_HOUR, TICKS_PER_SECOND };
/** Casillas por segundo (a x1) de un colono normal en terreno de coste 1. */
const BASE_WALK_SPEED = 3;
/** La partida empieza a las 7:00 del día 1. */
export const START_HOUR = 7;
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
/** Hasta dónde se busca, alrededor de la casilla de inicio, una casilla libre a la que llegar. */
const COLONY_POINT_RADIUS = 40;
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
  /** La comida se pone mala (por defecto, sí; los tests la quitan). */
  spoilage?: boolean;
  /** Dureza y días sin raids (por defecto, Normal con 5 días). */
  difficulty?: Partial<Difficulty>;
}

/** Una línea del diario de la colonia. */
export interface LogEntry {
  tick: number;
  text: string;
  kind: 'info' | 'bueno' | 'malo';
  /** Si es un aviso que salta en pantalla (#17, #18): de qué tipo. */
  alert?: AlertKind;
  /** Dónde ha pasado, para llevar la cámara al tocar el aviso. */
  at?: Point;
}

/** Tipos de aviso en pantalla: raids, peleas, heridos, caídos, muertes, pánico y visitas. */
export type AlertKind = 'raid' | 'combate' | 'herido' | 'caido' | 'muerte' | 'panico' | 'visita' | 'caravana';
export const ALERT_KINDS: readonly AlertKind[] = ['raid', 'combate', 'herido', 'caido', 'muerte', 'panico', 'visita', 'caravana'];

/** Cada cuánto, como mucho, se avisa de que un mismo colono pelea o está herido (1 hora de juego). */
export const COMBAT_ALERT_GAP = TICKS_PER_HOUR;

/** Algo que el jugador tiene que decidir (p. ej. aceptar a un superviviente). */
export interface Offer {
  /** «refugiado»: un herido de una facción que pide que lo curéis (suceso). */
  kind: 'superviviente' | 'refugiado';
  pawn: Colonist;
  /** Tick hasta el que espera respuesta. */
  until: number;
}

/** Una facción pide tributo (los Piratas del Óxido): si se paga, no hay raid; si no, llega y baja la relación. */
export interface Tribute {
  faction: string;
  demand: Partial<Record<ResourceId, number>>;
  /** Valor de lo pedido, en chapas. */
  value: number;
  /** Tick hasta el que espera respuesta. */
  until: number;
}

/** Daño medio de un puñetazo (los golpes quitan de 0,08 a 0,18 de salud): la mina casera pega ×4. */
const MINE_FIST_DAMAGE = 0.13;

/** Al buscar cama para un herido, una normal cuenta como si estuviera así de lejos más: antes la de hospital. */
const HOSPITAL_FIRST = 1_000_000;

/** Herido o enfermo: con heridas sin cerrar o con infección (va antes a una cama de hospital). */
function isPatient(c: Colonist): boolean {
  return c.wounds.length > 0 || !!c.infection;
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
  /** Comida echada a perder desde el último aviso del diario (no se guarda). */
  spoiled = 0;
  spoilageEnabled = true;
  /** Barcos fuera comerciando (comercio por barco). */
  boatTrips: BoatTrip[] = [];
  nextBoatTripId = 1;
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
  /** Vehículos de la colonia (el buggy…). */
  readonly vehicles: Vehicle[] = [];
  /** Siguiente id para un vehículo nuevo. */
  nextVehicleId = 1;
  /** Cadáveres de criaturas que se pudren en el mapa (bloque 2). */
  readonly corpses: Corpse[] = [];
  /** Investigación: proyecto en marcha, lo hecho y lo terminado. */
  research: ResearchState = newResearch();
  nextCorpseId = 1;
  /** Último tick en que un vehículo atropelló a cada saqueador (para no golpearle en cada paso). */
  readonly runOverAt = new Map<number, number>();
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
  /** Casillas de almacenes y huertos que hay que despejar antes de usarlas (#14). */
  readonly clearing: ZoneClearing;
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
  /** Casillas de puertas automáticas cerradas a los saqueadores (durante un raid y con corriente). */
  shutDoors = new Set<number>();
  /** Arqueros reclutados que van a una casilla con cobertura (no se guarda). */
  readonly coverMoves = new Set<number>();
  /** Torretas: ticks hasta su siguiente disparo (no se guarda). */
  readonly turretCooldown = new Map<number, number>();
  /** Disparos recientes de las torretas, para dibujar el trazo (no se guarda). */
  readonly turretShots: TurretShot[] = [];
  /** Granadas en el aire (se guardan con la partida). */
  readonly grenades: Grenade[] = [];
  /** Explosiones recientes (para el dibujado; no se guardan). */
  readonly blasts: Blast[] = [];
  /** Facciones (bloque 7): sus asentamientos y su relación con la colonia. */
  factions: FactionState[];
  /** Sucesos que duran (tormenta de polvo…) y tick del siguiente suceso. */
  weather: ActiveEvent[] = [];
  /** Grados de cada habitación con tejado que tiene estufa o aparatos (id de habitación → °C). No se guarda: se recalcula cada segundo. */
  roomTemps = new Map<number, number>();
  /** Fuego: casillas que arden (índice → segundos ardiendo), las quemadas (índice → tick) y versión para el dibujado. */
  readonly fires = new Map<number, number>();
  readonly burnt = new Map<number, number>();
  fireVersion = 0;
  /** Expedición de colonos fuera (atacando una base), el mapa de batalla que está por abrirse y las ruinas de las bases destruidas. */
  expedition: Expedition | null = null;
  pendingBattle: World | null = null;
  ruins: Ruin[] = [];
  /** Tick en que llega una facción nueva (si quedan pocas), o null. */
  newFactionAt: number | null = null;
  /** Solo en un mapa de batalla: de qué colonia es y contra quién. */
  battle?: BattleInfo;
  /** Otras colonias del jugador (las ruinas de bases ocupadas). Solo avanza la que se está viendo. */
  readonly outposts: Outpost[] = [];
  /** En una colonia ocupada: la principal (es la que se guarda, con esta dentro). */
  outpostHome?: World;
  /** Nombre de la colonia (las ocupadas, el de las ruinas). */
  name?: string;
  /** Tejados: casillas bajo techo, versión para el dibujado y habitaciones que se pueden tejar (caché). */
  readonly roofs = new Set<number>();
  roofVersion = 0;
  roofCache: { key: string; rooms: Room[] } = { key: '', rooms: [] };
  /** Plaga en un huerto: cuál y hasta cuándo hay para arrancar las enfermas. */
  plague: { zone: number; until: number } | null = null;
  nextEvent = firstEventTick();
  /** Mercado (bloque 8): el precio de cada recurso. */
  market: MarketState = newMarket();
  /** Tributo pedido y sin responder (o null). */
  tribute: Tribute | null = null;
  tick = 0;
  speed: GameSpeed = 1;
  private accumulator = 0;

  constructor(opts: WorldOptions) {
    this.needsEnabled = opts.needs ?? true;
    this.eventsEnabled = opts.events ?? true;
    this.spoilageEnabled = opts.spoilage ?? true;
    this.difficulty = makeDifficulty(opts.difficulty);
    this.schedule = initialSchedule(TICKS_PER_DAY, 0, this.difficulty.graceDays);
    this.map = opts.map ?? generateMap({ width: opts.width ?? MAP_SIZE, height: opts.height ?? MAP_SIZE, seed: opts.seed });
    this.rng = new Rng(opts.seed ^ 0x51ed270b);
    this.factions = createFactions(this.map.seed);
    placeBases(this.factions, this.map.seed, 0);
    if (!opts.map) this.spawnColonists(opts.colonists ?? 3);
    this.nextPawnId = this.colonists.length + 1;
    this.items = new GroundItems(this.map);
    // Una estantería terminada multiplica lo que cabe en su casilla.
    this.items.capacityAt = (x, y, resource) => {
      const s = this.structures?.at(x, y);
      if (!s || !s.built || !s.def.storage) return 1;
      // El armero solo guarda armas y munición: lo demás no cabe en sus casillas.
      if (s.def.storageFor === 'armas' && resource && !isGear(resource)) return 0;
      // La nevera solo guarda comida.
      if (s.def.storageFor === 'comida' && resource && !FOOD_RESOURCES.includes(resource)) return 0;
      return s.def.storage;
    };
    this.designations = new Designations(this.map);
    this.reservations = new Reservations(this.map);
    this.zones = new StorageZones(this.map);
    this.structures = new Structures(this.map);
    this.farms = new GrowZones(this.map);
    this.terrain = new TerrainOrders(this.map);
    this.clearing = new ZoneClearing(this.map);
    this.rooms = new Rooms(this.map, this.structures, () => `${this.structures.version}:${this.terrainVersion}:${this.propsVersion}`);
    if (!opts.map) this.dropStartingSupplies();
  }

  /** Apunta casillas que hay que repintar (y que pueden cambiar las habitaciones). */
  /** Han cambiado los objetos de esas casillas (índices): rehace lo que depende de ellos. */
  markChanged(...tiles: number[]): void {
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
    // Las demás colonias (la principal y las ocupadas) corren a la vez, también durante una batalla
    // (pedido por Mikel el 2026-10-21).
    const others = this.otherColonies();
    while (this.accumulator >= 1 && steps < MAX_TICKS_PER_UPDATE) {
      this.step();
      for (const o of others) o.step();
      this.accumulator -= 1;
      steps++;
      // Un ataque o un suceso en cualquiera de ellas: todo vuelve a x1 (sin pararse).
      if ([this, ...others].some((k) => k.slowDown)) {
        for (const k of [this, ...others]) k.slowDown = false;
        if (this.speed > 1) {
          this.speed = 1;
          this.accumulator = Math.min(this.accumulator, 1);
        }
      }
    }
    if (steps === MAX_TICKS_PER_UPDATE) this.accumulator = 0; // descarta el atraso
    return steps;
  }

  /** Las otras colonias del jugador (sin esta): la principal y las ruinas ocupadas. */
  otherColonies(): World[] {
    const main = this.battle ? (this.battle.home.outpostHome ?? this.battle.home) : (this.outpostHome ?? this);
    return [main, ...main.outposts.map((o) => o.world)].filter((k) => k !== this);
  }

  /** Un tick de simulación. */
  step(): void {
    this.tick++;
    // Foso con agua: si han cambiado las zanjas o lo investigado, se mira qué zanjas se inundan.
    const floodKey = `${this.terrainVersion}:${this.research.done.length}`;
    if (floodKey !== this.floodKey) this.refreshFlooding();
    // Cada hora, la naturaleza vuelve un poco: rebrotan tocones y nacen árboles y matorrales.
    if (this.tick % TICKS_PER_HOUR === 0) {
      const grown = regrowNature(this.map, this.rng, (x, y) =>
        !this.structures.at(x, y) && !this.zones.at(x, y) && !this.farms.at(x, y) && !this.items.at(x, y) &&
        // Nada nace a menos de 2 casillas de un colono ni en su camino: un árbol que rebrota no puede encerrarlo.
        !this.colonists.some((c) => Math.abs(c.tile.x - x) <= 2 && Math.abs(c.tile.y - y) <= 2) &&
        !this.colonists.some((c) => c.path.some((p) => p.x === x && p.y === y)));
      this.markChanged(...grown);
    }
    // Fuego: cada segundo arde, se extiende o se apaga.
    if (this.tick % TICKS_PER_SECOND === 0 && this.fires.size > 0) updateFires(this);
    // Cada día, los precios del mercado se acercan a su valor y alguno cambia.
    // Lo que es de todo el mundo (precios, bases, facciones nuevas) lo lleva la colonia principal.
    if (this.tick % TICKS_PER_DAY === 0 && !this.battle && !this.outpostHome) marketDay(this.market, this.map.seed, this.day);
    // Los animales de carga comen una vez al día (y sin comida se escapan).
    if (this.tick % TICKS_PER_HOUR === 0) feedPackAnimals(this);
    // Animales: cada día llegan algunos por los bordes (con los sucesos activados).
    if (this.tick % TICKS_PER_DAY === TICKS_PER_HOUR && this.eventsEnabled && !this.battle) spawnAnimals(this);
    // Y las bases de las facciones crecen.
    if (this.tick % TICKS_PER_DAY === 0 && !this.battle && !this.outpostHome) growBases(this);
    // Si quedan pocas facciones, llega una nueva a los pocos días.
    if (this.tick % TICKS_PER_HOUR === 0 && !this.battle && !this.outpostHome) checkNewFaction(this);
    // Cada día, las trampas de pesca dejan su 🐟 en el muelle de al lado.
    if (this.tick % TICKS_PER_HOUR === 0) {
      this.emptyFishTraps();
      if (this.spoilageEnabled) spoilHour(this);
      // Una vez al día, en el diario, lo que se ha echado a perder.
      if (Math.round(this.hour) % 24 === 20 && this.spoiled > 0) {
        this.addLog(`🤢 Hoy se han echado a perder ${this.spoiled} de comida. Una nevera con corriente la conserva.`, 'info');
        this.spoiled = 0;
      }
    }
    // Las plantas crecen a saltos de un segundo (basta y cuesta poco).
    if (this.tick % TICKS_PER_SECOND === 0) {
      const h = this.hour;
      // En invierno no crece nada al aire libre (bajo techo, sí).
      this.farms.grow(TICKS_PER_SECOND, h >= 6 && h < 20, TICKS_PER_DAY, frostNow(this) ? (x, y) => !roofed(this, x, y) : undefined);
    }
    // Salud: cada segundo (hambre, sed, heridas y recuperación).
    if (this.tick % TICKS_PER_SECOND === 0) {
      // «Medicina avanzada» vale para los que cuida la colonia: sus colonos y sus prisioneros.
      const healTime = woundHealTimeFactor(this.research);
      const infChance = infectionChanceFactor(this.research);
      for (const c of [...this.colonists, ...this.others]) {
        const ours = c.role === 'colono' || c.role === 'prisionero';
        // En una cama de hospital, las heridas de un colono se cierran antes y se infectan menos.
        const hospital = c.role === 'colono' && this.inHospitalBed(c);
        const r = tickHealth(c, TICKS_PER_SECOND, TICKS_PER_DAY, c.activity === 'sleeping',
          (ours ? healTime : 1) / (hospital ? HOSPITAL_BED.healFactor : 1));
        if (r.died) {
          this.killPawn(c, r.cause ?? 'heridas');
          continue;
        }
        const inf = tickInfection(c, TICKS_PER_SECOND, TICKS_PER_DAY, this.rng,
          (ours ? infChance : 1) * (hospital ? HOSPITAL_BED.infectionFactor : 1));
        const mine = c.role === 'colono';
        if (inf.recovered && mine) this.addLog(`💪 ${c.name} vence la infección sin medicina.`, 'bueno');
        if (inf.died) this.killPawn(c, 'infección');
        else if (inf.infected && mine) this.addLog(`🦠 Se le infecta la herida de ${inf.infected} a ${c.name}. Necesita 💊 Medicina: una al día durante 2 días.`, 'malo', 'herido', c.tile);
        else if (inf.worse && mine) this.addLog(`🦠 Empeora la infección de ${c.name}${c.infection!.untreatedDays >= 2 ? ': si mañana no toma 💊, morirá' : ''}.`, 'malo', 'herido', c.tile);
      }
    }
    if (this.eventsEnabled && this.tick % TICKS_PER_HOUR === 0) runStoryteller(this);
    if (this.eventsEnabled && this.tick % TICKS_PER_HOUR === 0) runEvents(this);
    // La expedición llega a la base o vuelve a casa.
    if (this.expedition && this.tick % TICKS_PER_HOUR === 0) updateExpedition(this);
    if (this.boatTrips.length && this.tick % TICKS_PER_HOUR === 0) updateBoatTrips(this);
    // En un mapa de batalla: ¿se ha acabado?
    if (this.battle && this.tick % TICKS_PER_SECOND === 0) checkBattle(this);
    if (this.tick % RESCUE_TICKS === 0) this.rescueTrapped();
    if (this.tick % TICKS_PER_SECOND === 0) this.medicalPriority();
    // Cadáveres: se pudren y a quien los ve cerca le pesa.
    if (this.tick % TICKS_PER_SECOND === 0 && this.corpses.length > 0) updateCorpses(this.corpses, this.colonists, this.tick, TICKS_PER_HOUR, TICKS_PER_DAY);
    // Electricidad: cada segundo se reparte la corriente y se encienden o apagan las lámparas.
    if (this.tick % TICKS_PER_SECOND === 0) {
      // Temperatura de las habitaciones y qué calefactores o aires acondicionados trabajan.
      updateClimate(this);
      this.powerNets = updatePower(this.structures, TICKS_PER_SECOND / TICKS_PER_HOUR, { hour: this.hour, wind: this.wind, batteryMultiplier: batteryMultiplier(this.research), solar: solarFactor(this) });
      updateBonfires(this.structures, TICKS_PER_SECOND / TICKS_PER_HOUR, coldNow(this));
      updateHydroponics(this, TICKS_PER_SECOND);
      this.lit = litTiles(this.structures);
      // Puertas automáticas: con corriente, se cierran a los saqueadores mientras dura el raid.
      const raid = this.others.some((o) => o.role === 'saqueador' && !o.downed && !o.raider?.fleeing);
      const before = this.shutDoors.size;
      this.shutDoors = shutDoorTiles(this.structures, raid);
      if (!before && this.shutDoors.size) this.addLog('🚪 Las puertas automáticas se cierran: los saqueadores no pueden pasar.', 'bueno');
      else if (before && !this.shutDoors.size && !raid) this.addLog('🚪 Las puertas automáticas se abren.', 'info');
      // Puentes levadizos: con corriente se alzan solos ante un raid y bajan al acabar.
      updateDrawbridges(this, raid);
      // Ánimo: de noche, quien duerme o trabaja junto a una lámpara encendida está más a gusto.
      const night = !isDaylight(this.hour);
      updateBonfireCheer(this.structures, this.colonists, this.tick, TICKS_PER_HOUR, night);
      for (const c of this.colonists) {
        const on = night && (c.activity === 'sleeping' || c.activity === 'working') && this.lit.has(c.tile.y * this.map.width + c.tile.x);
        if (on) c.needs.inLight = true;
        else delete c.needs.inLight;
        // (El frío, más abajo, para todos a la vez.)
        // Dentro de una habitación con tejado: su belleza y su limpieza le cambian el ánimo.
        // (Si se ha abierto alguna, aquí se cae su tejado.)
        roofRooms(this);
        const info = roomInfoAt(this, c.tile.x, c.tile.y);
        if (info) c.needs.room = { beauty: info.beauty, clean: info.clean };
        else delete c.needs.room;
      }
    }
    // Ratos libres: quien está sin hacer nada junto a una mesa de juego o una hoguera encendida, se distrae.
    if (this.tick % TICKS_PER_SECOND === 0) {
      const spots = this.leisureSpots();
      if (spots.length) {
        const R = ROOMS.leisure.radius;
        for (const c of this.colonists) {
          if (c.job || c.drafted || c.need || (c.activity !== 'idle' && c.activity !== 'wandering')) continue;
          if (spots.some((p) => Math.abs(p.x - c.tile.x) <= R && Math.abs(p.y - c.tile.y) <= R)) c.needs.funAt = this.tick;
        }
      }
    }
    // Frío de invierno: quien no está a cubierto con estufa ni lleva abrigo lo pasa mal.
    if (this.tick % TICKS_PER_SECOND === 0 && this.needsEnabled) {
      updateCold(this, TICKS_PER_SECOND);
      updateHeat(this, TICKS_PER_SECOND);
    }
    // Zonas por despejar: lo que ya está libre se suma a su almacén o huerto.
    if (this.tick % TICKS_PER_SECOND === 0 && this.clearing.count > 0) this.updateClearing();
    for (const c of this.colonists) this.updateColonist(c);
    for (const v of this.vehicles) updateVehicle(this, v, TICKS_PER_SECOND, TICKS_PER_HOUR, BASE_WALK_SPEED);
    updateOthers(this);
    updateTurrets(this);
    updateMortars(this);
    updateGrenades(this);
  }

  // --- Personas: diario, muertes y llegadas ------------------------------------------

  addLog(text: string, kind: LogEntry['kind'] = 'info', alert?: AlertKind, at?: Point): void {
    const entry: LogEntry = { tick: this.tick, text, kind };
    if (alert) entry.alert = alert;
    if (at) entry.at = { x: at.x, y: at.y };
    this.log.push(entry);
    if (this.log.length > 200) this.log.splice(0, this.log.length - 200);
    // Un ataque (raid, manada, máquinas, un animal que ataca): la partida vuelve a x1 (pedido por Mikel).
    if (alert === 'raid' || (alert === 'combate' && kind === 'malo')) this.slowDown = true;
  }

  /** Ha pasado algo (un ataque, un suceso) y hay que volver a velocidad x1 (lo mira quien avanza el tiempo). */
  slowDown = false;

  /** Último aviso de pelea o herida por colono (clave `tipo:id`); no se guarda: solo evita repetir avisos. */
  private readonly combatAlerts = new Map<string, number>();

  /** Aviso de pelea o herida de un colono, como mucho uno de cada tipo por colono y hora. */
  combatAlert(c: Colonist, alert: 'combate' | 'herido', text: string): void {
    const key = `${alert}:${c.id}`;
    const last = this.combatAlerts.get(key);
    if (last !== undefined && this.tick - last < COMBAT_ALERT_GAP) return;
    this.combatAlerts.set(key, this.tick);
    this.addLog(text, 'malo', alert, c.tile);
  }

  /** Todas las personas del mapa. */
  pawns(): Colonist[] {
    return [...this.colonists, ...this.others];
  }

  /** Una persona muere: deja lo que llevaba y se apunta en el diario. */
  killPawn(c: Colonist, cause: string, quiet = false): void {
    if (c.vehicle) this.leaveVehicle(c);
    dropGear(this, c);
    if (c.role === 'colono') {
      this.dropJob(c);
      if (c.need) this.endNeed(c);
      const i = this.colonists.indexOf(c);
      if (i >= 0) this.colonists.splice(i, 1);
      this.graveyard.push({ name: c.name, cause, day: this.day });
      this.addLog(`💀 ${c.name} «${c.nickname}» ha muerto (${cause}).`, 'malo', 'muerte', c.tile);
      // En un mapa de batalla no se acaba la partida: la colonia sigue en casa.
      if (this.colonists.length === 0 && !this.gameOver && !this.battle) {
        this.gameOver = { day: this.day, cause };
        this.addLog('La colonia ha caído: no queda nadie.', 'malo', 'muerte');
      }
    } else {
      this.reservations.releaseAll(c.id);
      const i = this.others.indexOf(c);
      if (i >= 0) this.others.splice(i, 1);
      if (c.carrying) this.items.drop(c.tile.x, c.tile.y, c.carrying.resource, c.carrying.amount);
      // Las máquinas (bloque 6) sueltan chatarra y componentes; las demás criaturas dejan su cadáver.
      if (c.creature && CREATURES[c.creature].machine) {
        const scrap = this.rng.int(MACHINES.scrap[0], MACHINES.scrap[1]);
        // «Desguace de máquinas» dobla los componentes.
        const parts = Math.round(this.rng.int(MACHINES.parts[0], MACHINES.parts[1]) * machinePartsMultiplier(this.research));
        this.items.drop(c.tile.x, c.tile.y, 'chatarra', scrap);
        this.items.drop(c.tile.x, c.tile.y, 'componentes', parts);
        this.addLog(`🔩 Los restos de ${c.name} dejan 🔩${scrap} y ⚙️${parts}.`, 'bueno', undefined, c.tile);
      } else if (c.creature && CREATURES[c.creature].animal) animalDrops(this, c);
      else if (c.creature) this.corpses.push({ id: this.nextCorpseId++, creature: c.creature, x: c.tile.x, y: c.tile.y, diedAt: this.tick });
      if (quiet) return;
      if (c.creature) {
        const def = CREATURES[c.creature];
        this.addLog(def.machine ? `${c.name} queda ${def.female ? 'destrozada' : 'destrozado'} (${cause}).` : `${c.name} muere (${cause}).`, 'info');
        return;
      }
      const who = c.role === 'saqueador' ? 'Un saqueador' : c.role === 'prisionero' ? 'El prisionero' : 'Alguien';
      this.addLog(`${who} (${c.name}) ha muerto (${cause}).`, 'info');
      // Matar a los suyos baja la relación con su facción.
      if (c.faction && (c.role === 'saqueador' || c.role === 'prisionero')) this.changeRelation(c.faction, RELATION.killOrHold);
    }
  }

  /**
   * Saqueador en el suelo (#22): «rematar» manda a un carcelero a acabar con él; «capturar»
   * (lo de siempre) lo lleva preso. false si no es un saqueador en el suelo.
   */
  setDownedFate(id: number, fate: 'capturar' | 'rematar'): boolean {
    const o = this.others.find((k) => k.id === id);
    if (!o || o.role !== 'saqueador' || !o.downed || o.carriedBy !== undefined) return false;
    const finish = fate === 'rematar';
    if (!!o.raider?.finish === finish) return true;
    const r = (o.raider ??= { fleeing: false, leaveAt: this.tick + TICKS_PER_DAY });
    if (finish) r.finish = true;
    else delete r.finish;
    // Quien iba a hacer lo otro lo deja: se vuelve a repartir el trabajo.
    for (const c of this.colonists) if (c.job?.pid === id && c.job.kind === 'carcelero') this.dropJob(c);
    this.addLog(finish ? `🗡 Se rematará a ${o.name} (saqueador).` : `⛓ Se capturará a ${o.name} (saqueador).`, 'info');
    return true;
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
    const home = this.colonyPoint();
    if (!home) return false;
    for (let tries = 0; tries < 200; tries++) {
      const side = this.rng.int(0, 3);
      const k = this.rng.int(0, (side % 2 === 0 ? m.width : m.height) - 1);
      const p = side === 0 ? { x: k, y: 0 } : side === 1 ? { x: m.width - 1, y: k } : side === 2 ? { x: k, y: m.height - 1 } : { x: 0, y: k };
      if (!isPassable(m, p.x, p.y)) continue;
      if (!findPath(m, p, home, 60000)) continue;
      c.tile = { ...p };
      c.pos = { x: p.x + 0.5, y: p.y + 0.5 };
      c.path = [];
      return true;
    }
    return false;
  }

  /**
   * Casilla a la que van los que llegan a la colonia: la de inicio o, si se ha construido encima
   * (un muro, una cama…), la transitable más cercana a ella. null si no hay ninguna cerca.
   */
  colonyPoint(): Point | null {
    const m = this.map;
    const s = m.start;
    if (isPassable(m, s.x, s.y)) return { ...s };
    for (let r = 1; r <= COLONY_POINT_RADIUS; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (isPassable(m, s.x + dx, s.y + dy)) return { x: s.x + dx, y: s.y + dy };
        }
      }
    }
    return null;
  }

  /** Pone a alguien junto a la colonia (al lado de un colono, o en la casilla de llegada). */
  placeNearColony(c: Colonist): boolean {
    const others = this.colonists.filter((k) => k !== c);
    const spots = [...others.map((k) => k.tile), ...[this.colonyPoint()].filter((p): p is Point => !!p)];
    for (const at of spots) {
      const p = this.nearestOpenTile(at, RESCUE_RADIUS) ?? (isPassable(this.map, at.x, at.y) ? at : null);
      if (!p) continue;
      c.tile = { ...p };
      c.pos = { x: p.x + 0.5, y: p.y + 0.5 };
      c.path = [];
      return true;
    }
    return false;
  }

  /**
   * Arreglo para partidas guardadas con el fallo #12: un superviviente aceptado se quedaba en la
   * esquina (0, 0) sin poder llegar a la colonia. Se le trae junto a ella.
   */
  bringHomeStranded(): number {
    let n = 0;
    for (const c of this.colonists) {
      if (c.tile.x !== 0 || c.tile.y !== 0) continue;
      const home = this.colonyPoint();
      if (home && isPassable(this.map, 0, 0) && findPath(this.map, c.tile, home, 60000)) continue;
      if (this.placeNearColony(c)) n++;
    }
    return n;
  }

  /** El jugador acepta lo que se le ofrece. */
  acceptOffer(): void {
    const o = this.offer;
    if (!o) return;
    this.offer = null;
    if (o.kind === 'superviviente') this.joinColony(o.pawn, 'se une a la colonia');
    else if (o.kind === 'refugiado') {
      const faction = o.pawn.faction;
      this.joinColony(o.pawn, 'se queda para que lo curéis');
      // Al curarse decidirá si se queda o vuelve con los suyos.
      if (faction) o.pawn.refugee = faction;
    }
  }

  rejectOffer(): void {
    if (!this.offer) return;
    this.addLog(`${this.offer.pawn.name} sigue su camino.`, 'info');
    this.offer = null;
  }

  /** Saca a un colono de la colonia sin que muera (se va de expedición). */
  removeFromColony(c: Colonist): void {
    const i = this.colonists.indexOf(c);
    if (i < 0) return;
    if (c.vehicle) this.leaveVehicle(c);
    this.dropJob(c);
    if (c.need) this.endNeed(c);
    this.colonists.splice(i, 1);
    this.reservations.releaseAll(c.id);
    c.drafted = false;
    c.path = [];
  }

  /** Un colono se va de la colonia (el refugiado ya curado que vuelve con los suyos): se marcha andando por un borde. */
  leaveColony(c: Colonist, faction: string): void {
    const i = this.colonists.indexOf(c);
    if (i < 0) return;
    if (c.vehicle) this.leaveVehicle(c);
    this.dropJob(c);
    if (c.need) this.endNeed(c);
    this.colonists.splice(i, 1);
    this.reservations.releaseAll(c.id);
    c.role = 'aliado';
    c.faction = faction;
    c.drafted = false;
    c.path = [];
    delete c.refugee;
    this.others.push(c);
  }

  /** Alguien pasa a ser de la colonia (superviviente, prisionero convencido…). */
  joinColony(c: Colonist, why: string): void {
    const i = this.others.indexOf(c);
    if (i >= 0) this.others.splice(i, 1);
    this.reservations.releaseAll(c.id);
    c.role = 'colono';
    c.prisoner = undefined;
    c.faction = undefined;
    c.drafted = false;
    c.job = null;
    c.need = null;
    // Llega por un borde desde el que se llegue a la colonia; si no hay ninguno (colonia
    // amurallada sin puertas), aparece junto a ella. Nunca se queda en la esquina (0, 0).
    if (c.pos.x === 0.5 && c.pos.y === 0.5 && c.tile.x === 0 && c.tile.y === 0 && !this.placeAtEdge(c)) this.placeNearColony(c);
    // Que nadie comparta id.
    if (this.colonists.some((k) => k.id === c.id)) c.id = this.nextPawnId++;
    this.colonists.push(c);
    const home = this.colonyPoint();
    const path = home ? findPath(this.map, c.tile, home, 60000) : null;
    if (path) {
      c.path = path;
      c.activity = 'moving';
    }
    this.addLog(`🙂 ${c.name} «${c.nickname}» ${why}.`, 'bueno');
  }

  /** Orden directa: el colono va a la casilla indicada. Devuelve false si no hay camino. */
  orderMove(colonistId: number, target: Point): boolean {
    const c = this.colonists.find((k) => k.id === colonistId);
    if (!c || c.panic) return false; // en pánico no obedece
    // Mandarlo a pie a un sitio le hace bajarse del vehículo.
    if (c.vehicle) this.leaveVehicle(c);
    const path = findPath(this.map, c.tile, target);
    if (!path) return false;
    this.dropJob(c); // la orden directa manda sobre el trabajo
    c.gearTask = undefined;
    if (c.need) this.endNeed(c); // y sobre comer o dormir
    // Mandarlo a un sitio quita «atacar» y «retirarse»; «mantener» sigue (se queda donde llegue).
    if (c.stance === 'atacar' || c.stance === 'retirarse') {
      c.stance = undefined;
      c.attackTarget = undefined;
    }
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

  /** Día de juego de un tick cualquiera. */
  dayOf(tick: number): number {
    return Math.floor((tick + START_HOUR * TICKS_PER_HOUR) / TICKS_PER_DAY) + 1;
  }

  /** A su hora, cada trampa de pesca terminada deja lo suyo en el muelle terminado de al lado. */
  private emptyFishTraps(): void {
    const hour = Math.round(this.hour) % 24;
    for (const s of this.structures.all()) {
      const trap = s.def.fishTrap;
      if (!trap || !s.built || trap.hour !== hour) continue;
      const dock = this.structures.dockBeside(s.x, s.y, undefined, true);
      if (dock) this.items.dropAll(dock.x, dock.y, { pescado: trap.perDay });
    }
    // Compostera: cada día, a su hora, deja abono a su lado.
    for (const s of this.structures.all()) {
      const c = s.def.compost;
      if (!c || !s.built || c.hour !== hour) continue;
      const spot = this.structures.sidesOf(s).find((t) => isPassable(this.map, t.x, t.y) && !this.structures.at(t.x, t.y)?.def.blocks);
      if (spot) this.items.drop(spot.x, spot.y, 'abono', c.perDay);
    }
  }

  /** Facción con ese id. */
  faction(id: string): FactionState | undefined {
    return this.factions.find((f) => f.id === id);
  }

  /**
   * Sube o baja la relación con una facción (`why`: el motivo para el diario; sin él, no se
   * anota salvo que cambie de nivel, p. ej. de «Hostil» a «En guerra»).
   */
  changeRelation(id: string | undefined, delta: number, why?: string): void {
    if (!id || delta === 0) return;
    const before = this.faction(id)?.relation;
    const change = shiftRelation(this.factions, id, delta);
    const f = this.faction(id);
    const def = factionDef(id);
    if (!f || !def || before === undefined || f.relation === before) return;
    const sign = f.relation > before ? `+${f.relation - before}` : `${f.relation - before}`;
    if (why) this.addLog(`${def.icon} ${def.name}: ${sign} de relación (${why}). Ahora: ${f.relation}.`, f.relation > before ? 'bueno' : 'info');
    if (change) this.addLog(`${def.icon} ${def.name} de ${f.settlement}: ahora sois ${change.to === 'aliado' ? 'aliados' : change.to === 'hostil' ? 'enemigos (en guerra)' : 'neutrales'} (${f.relation}).`, change.to === 'hostil' ? 'malo' : 'bueno');
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
    // Con una tormenta de polvo (o lo que dure), su icono al lado de la hora.
    const sky = this.weather.some((e) => e.id === 'tormenta_polvo' && this.tick < e.until) ? ' · 🌪' : '';
    return `Día ${this.day} ${seasonOf(this.day).icon} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${sky}`;
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
    if (c.vehicle && this.updateVehicleSeat(c)) return;
    if (c.downed) {
      // En el suelo: no hace nada hasta recuperarse (o hasta que lo curen).
      c.gearTask = undefined;
      if (c.job) this.dropJob(c);
      if (c.need) this.endNeed(c);
      c.path = [];
      c.panic = undefined;
      if (c.carriedBy !== undefined) {
        // Lo llevan a cuestas a una cama: va con quien le lleva.
        const carrier = this.colonists.find((k) => k.id === c.carriedBy);
        if (carrier?.job?.escorting && carrier.job.pid === c.id) {
          c.pos = { ...carrier.pos };
          c.tile = { ...carrier.tile };
          c.activity = 'idle';
          return;
        }
        c.carriedBy = undefined;
      }
      // En una cama se recupera como durmiendo (más deprisa que tirado en el suelo).
      c.activity = this.isBedTile(c.tile.x, c.tile.y) ? 'sleeping' : 'idle';
      return;
    }
    c.carriedBy = undefined;
    // En pánico: solo corre a refugiarse (y sigue con hambre y sueño, pero no va a por ellos).
    if (c.panic) {
      if (this.needsEnabled) this.decayNeeds(c);
      updatePanic(this, c);
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
      // Cada arma de disparo vale si hay su munición: la que lleva encima o la del almacén.
      const carried = ammoFor(c.weapon);
      const hasAmmo = (id: typeof c.weapon) => {
        const a = ammoFor(id);
        return !a || (carried === a && c.ammo > 0) || inv[a] > 0;
      };
      let best = c.weapon;
      let bestScore = weaponScore(c.weapon, hasAmmo(c.weapon));
      for (const id of WEAPON_IDS) {
        if (inv[id] <= 0) continue;
        const sc = weaponScore(id, hasAmmo(id));
        if (sc > bestScore + 0.05) {
          best = id;
          bestScore = sc;
        }
      }
      if (best !== c.weapon) return best;
    }
    const ammo = ammoFor(c.weapon);
    if (ammo && c.ammo < AMMO_LOW && inv[ammo] > 0) return ammo;
    // Granadas: lleva 2 aparte de su arma (no quien va desarmado; eso ya ha salido arriba).
    if (grenadesOf(c) < GRENADE.carry && inv.granadas > 0) return 'granadas';
    // Abrigo (bloque 11): si hay alguno libre, lo coge y ya lo lleva siempre.
    if (!c.coat && inv.abrigo > 0) return 'abrigo';
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
      if (c.ammo > 0) this.items.drop(c.tile.x, c.tile.y, ammoFor(c.weapon) ?? 'flechas', c.ammo);
      if (c.weapon) this.items.drop(c.tile.x, c.tile.y, c.weapon, 1);
      c.weapon = null;
      c.ammo = 0;
    }
    // Desarmado del todo: tampoco lleva granadas.
    if (choice === 'ninguna' && grenadesOf(c) > 0) {
      this.items.drop(c.tile.x, c.tile.y, 'granadas', grenadesOf(c));
      c.grenades = 0;
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
      if (t.resource === 'granadas') {
        const got = this.items.at(t.x, t.y)?.resource === 'granadas' ? this.items.take(t.x, t.y, GRENADE.carry - grenadesOf(c)) : null;
        if (got) c.grenades = grenadesOf(c) + got.amount;
        return;
      }
      if (t.resource === 'abrigo') {
        if (!c.coat && this.items.at(t.x, t.y)?.resource === 'abrigo' && this.items.take(t.x, t.y, 1)) c.coat = true;
        return;
      }
      if (isAmmo(t.resource)) {
        // Solo la munición de su arma (si la ha cambiado mientras iba, no la coge).
        if (ammoFor(c.weapon) !== t.resource) return;
        const got = this.items.at(t.x, t.y)?.resource === t.resource ? this.items.take(t.x, t.y, AMMO_CARRY - c.ammo) : null;
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
      // Deja la que llevaba (y su munición, si la nueva no usa la misma) donde estaba la nueva.
      const oldAmmo = ammoFor(c.weapon);
      if (c.weapon) this.items.drop(t.x, t.y, c.weapon, 1);
      if (c.ammo > 0 && oldAmmo !== WEAPONS[t.resource].ammo) {
        this.items.drop(t.x, t.y, oldAmmo ?? 'flechas', c.ammo);
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
    const wantsRest = this.wantsBedRest(c);
    if (!wantsSleep && !wantsFood && !wantsWater && !wantsRest) return false;
    if (this.tick < (this.nextNeedScan.get(c.id) ?? 0)) return false;
    // Primero lo más grave.
    const wants: { what: 'comer' | 'dormir' | 'beber'; level: number }[] = [];
    if (wantsFood) wants.push({ what: 'comer', level: n.food });
    if (wantsWater) wants.push({ what: 'beber', level: n.water });
    // El malherido guarda cama (y allí también descansa); antes, come y bebe si lo necesita.
    if (wantsSleep && !wantsRest) wants.push({ what: 'dormir', level: n.rest });
    wants.sort((a, b) => a.level - b.level);
    for (const { what } of wants) {
      const ok = what === 'comer' ? this.startEating(c) : what === 'beber' ? this.startDrinking(c) : this.startSleeping(c);
      if (ok) return true;
    }
    if (wantsRest) {
      if (!c.resting) this.addLog(`🛏 ${c.name} está malherido y se acuesta hasta recuperarse.`, 'info');
      c.resting = true;
      return this.startSleeping(c, 'reposar');
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

  /**
   * El herido que sigue en pie guarda cama tras el combate (decidido el 2026-10-19, opción C): con la
   * salud por debajo del 50 % se acuesta y se queda hasta el 80 %; se levanta a comer y beber.
   * No con heridas que sangran (primero se curan), ni reclutado, ni mientras haya saqueadores en pie.
   */
  wantsBedRest(c: Colonist): boolean {
    if (c.role !== 'colono' || c.downed) return false;
    if (c.resting && c.health >= BED_REST.untilHealth) c.resting = false;
    if (!c.resting && c.health >= BED_REST.startBelow) return false;
    if (c.drafted || c.panic || c.wounds.some((w) => w.bleeding) || !this.fightOver()) return false;
    return c.needs.food >= STARVING && c.needs.water >= DEHYDRATED;
  }

  /**
   * Va a la cama libre más cercana; si no hay, duerme (o reposa) donde está. El herido (con heridas,
   * infectado o guardando cama) va antes a una cama de hospital; el sano no la ocupa.
   */
  private startSleeping(c: Colonist, type: 'dormir' | 'reposar' = 'dormir'): boolean {
    const patient = type === 'reposar' || isPatient(c);
    const dist = (s: { x: number; y: number }) => Math.abs(s.x - c.tile.x) + Math.abs(s.y - c.tile.y);
    const rank = (s: { def: { id: string } }) => (patient && s.def.id === HOSPITAL_BED_ID ? 0 : 1);
    const beds = this.structures
      .all()
      .filter((s) => s.built && (s.def.id === 'cama' || (patient && s.def.id === HOSPITAL_BED_ID)) &&
        this.reservations.holder(s.x, s.y) === undefined && !this.bedTaken(s.x, s.y, c))
      .sort((a, b) => rank(a) - rank(b) || dist(a) - dist(b));
    if (c.job) this.dropJob(c);
    for (const b of beds.slice(0, 4)) {
      const route = this.routeTo(c, [{ x: b.x, y: b.y }]);
      if (!route) continue;
      this.reservations.reserve(b.x, b.y, c.id, 'work');
      c.need = { type, x: b.x, y: b.y, bed: true, progress: 0 };
      c.path = route.path;
      c.activity = 'toNeed';
      return true;
    }
    c.need = { type, x: c.tile.x, y: c.tile.y, bed: false, progress: 0 };
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
    if (t.type === 'reposar' && !this.wantsBedRest(c)) {
      // Recuperado (o vuelve el combate, o tiene que ir a comer o beber): se levanta.
      if (!c.resting) this.addLog(`🛏 ${c.name} se ha recuperado y se levanta.`, 'bueno');
      this.endNeed(c);
      return;
    }
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
    if (t.type === 'reposar') return;
    // Se despierta descansado (o, de día, bastante descansado) o si el hambre aprieta.
    const rested = c.needs.rest >= 0.99 || (!this.isNight && c.needs.rest >= 0.85);
    if (rested || c.needs.food < STARVING) {
      c.needs.sleptIn = t.bed ? (roofed(this, t.x, t.y) ? 'habitacion' : 'cama') : 'suelo';
      this.endNeed(c);
    }
  }

  /** Busca trabajo (si toca) y lo empieza. true si ahora tiene uno. */
  private tryStartJob(c: Colonist): boolean {
    const people = this.others.length > 0 || this.fires.size > 0 || roofTodo(this).length > 0 || this.colonists.some((k) => k.wounds.some((w) => w.bleeding) || needsDose(k) || k.downed);
    if (!people && this.designations.count === 0 && this.zones.all().length === 0 && this.structures.blueprints().length === 0 && this.structures.toDemolish().length === 0 && this.structures.toMove().length === 0 && this.structures.repairs().length === 0 && this.structures.stations().length === 0 && this.farms.all().length === 0 && this.farms.plantList().length === 0 && this.terrain.count === 0 && this.corpses.length === 0 && !this.structures.all().some((s) => s.built && !!depositOf(s.def))) return false;
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
    if (c.job.corpse?.body) {
      // Suelta el cadáver donde esté (se sigue pudriendo; otro lo llevará si la hoguera sigue encendida).
      this.corpses.push({ ...c.job.corpse.body, x: c.tile.x, y: c.tile.y });
      c.job.corpse.body = undefined;
    }
    if (c.job.move === 'montar') {
      // Se deja a medio camino: el mueble vuelve a su sitio (la orden sigue, otro lo intentará).
      const s = this.jobStructure(c.job);
      if (s?.lifted) this.returnLifted(s, false);
    }
    if (c.job.escorting) {
      // Suelta a quien llevaba a la celda donde esté.
      for (const o of [...this.others, ...this.colonists]) if (o.carriedBy === c.id) o.carriedBy = undefined;
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
    if (j.kind === 'cazar') {
      const o = this.others.find((k) => k.id === j.pid);
      return !!o && !o.downed && (j.tame ? !!o.tameMarked && !o.tamed : !!o.huntMarked);
    }
    if (j.kind === 'curar' || j.kind === 'carcelero') {
      const o = this.pawns().find((k) => k.id === j.pid);
      if (!o) return false;
      if (j.kind === 'curar' && j.escorting) return o.downed && o.carriedBy === c.id;
      if (j.kind === 'curar') return o.wounds.some((w) => w.bleeding) || (needsDose(o) && this.medicineStack() !== null) || this.wantsCarryToBed(o);
      if (j.escorting) return o.role === 'prisionero';
      if (j.warden === 'capturar') return o.role === 'saqueador' && o.downed && !o.raider?.finish;
      if (j.warden === 'rematar') return o.role === 'saqueador' && o.downed && !!o.raider?.finish;
      if (o.role !== 'prisionero' || o.prisoner?.mode === 'liberar') return false;
      if (j.warden === 'alimentar') return this.foodStack() !== null;
      return canTalk(this.tick, o);
    }
    if (j.kind === 'construir') {
      if (j.fire) return burning(this, j.x, j.y);
      if (j.roof) return roofTodo(this).some((p) => p.x === j.x && p.y === j.y);
      const s = this.jobStructure(j);
      if (j.demolish) return !!s && s.built && !!s.demolish;
      if (j.move === 'desmontar') return !!s && !!s.moveTo && this.structures.canMove(s);
      if (j.move === 'montar') return !!s && !!s.lifted;
      if (j.repair) {
        if (!s || !s.built || !s.repair || s.demolish) return false;
      } else if (j.upgrade) {
        if (!s || !s.built || !s.upgrade || s.demolish) return false;
      } else if (!s || s.built) return false;
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
    if (j.kind === 'investigar') {
      const s = this.jobStructure(j);
      return !!s && researchBenchReady(this, s);
    }
    if (j.kind === 'terreno') {
      return this.terrain.at(j.x, j.y) === j.terrain && !terrainBlocker(this.map, j.x, j.y, j.terrain!, !!this.structures.at(j.x, j.y));
    }
    if (j.kind === 'cultivar') {
      if (j.farm === 'arrancar') return !!this.farms.plantAt(j.x, j.y)?.sick;
      if (j.farm === 'cosechar') return (this.farms.plantAt(j.x, j.y)?.growth ?? 0) >= 1;
      const z = this.farms.at(j.x, j.y);
      return !!z && !this.farms.plantAt(j.x, j.y) && this.farms.canSow(j.x, j.y, z.crop) && !this.structures.at(j.x, j.y);
    }
    if (j.corpse) {
      // Llevar un cadáver a la hoguera: tiene que seguir encendida (y el cadáver, en el suelo hasta recogerlo).
      const s = this.structures.get(j.sid ?? -1);
      if (!s || !isLitBonfire(s)) return false;
      return !!j.corpse.body || this.corpses.some((k) => k.id === j.corpse!.id);
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
    if (j.corpse) {
      this.updateCorpseJob(c);
      return;
    }
    if (j.haul) {
      this.updateHaul(c);
      return;
    }
    if (j.kind === 'cazar') {
      this.updateHuntJob(c);
      return;
    }
    if (j.kind === 'curar' || j.kind === 'carcelero') {
      this.updatePawnJob(c);
      return;
    }
    if (j.fire) {
      this.updateFireJob(c);
      return;
    }
    if (j.roof) {
      this.updateRoofJob(c);
      return;
    }
    const building = j.kind === 'construir' || j.kind === 'fabricar' || j.kind === 'cocinar';
    const atStructure = building || j.kind === 'investigar';
    const target = atStructure ? this.jobStructure(j) : undefined;
    const inPlace = atStructure ? !!target && this.structures.isBesideStructure(c.tile, target) : canWorkFrom(this.map, c.tile, j.x, j.y);
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
    // Un taller electrificado con corriente va el doble de rápido.
    const boost = (j.kind === 'fabricar' || j.kind === 'cocinar') && target ? stationSpeed(target) : 1;
    // Algunos talleres van con otra habilidad (la mesa de boticario, con Medicina).
    const skill = (j.kind === 'fabricar' || j.kind === 'cocinar') ? target?.def.workSkill : undefined;
    // Y alguno con su propia escala (el muelle: de ×1 con Supervivencia 0 a ×2 con 20).
    const range = skill ? target?.def.skillSpeed : undefined;
    const done = workSpeed(c, j.kind, skill, range) * this.lightFactor(c.tile) * boost;
    j.progress += done;
    if (j.kind === 'investigar') {
      const finished = addResearch(this.research, done);
      if (finished) {
        const build = unlockedBy(BUILDINGS, finished.id, this.research).map((b) => b.name);
        const craft = unlockedBy(RECIPES, finished.id, this.research).map((r) => r.name);
        const plant = unlockedBy(CROPS, finished.id, this.research).map((cr) => cr.name);
        const extra = (build.length ? ` Ya se puede construir: ${build.join(', ')}.` : '') + (craft.length ? ` Ya se puede fabricar: ${craft.join(', ')}.` : '') + (plant.length ? ` Ya se puede plantar: ${plant.join(', ')}.` : '');
        this.addLog(`🔬 Investigación terminada: ${finished.name}. Desbloquea: ${finished.unlocks}.${extra}`, 'bueno');
      }
      if (finished || j.progress >= j.work) this.dropJob(c);
      return;
    }
    if (building && j.move) {
      if (j.progress >= j.work) this.finishMoveStep(c);
      return;
    }
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
    if (building && j.repair) {
      const s = this.jobStructure(j)!;
      if (s.repair) s.repair.progress = j.progress;
      if (j.progress >= j.work) {
        this.structures.finishRepair(s);
        this.addLog(`🔧 ${c.name} arregla ${s.def.name.toLowerCase()}: vuelve a funcionar.`, 'bueno', undefined, { x: s.x, y: s.y });
        this.dropJob(c);
      }
      return;
    }
    if (building && j.upgrade) {
      const s = this.jobStructure(j)!;
      if (s.upgrade) s.upgrade.progress = j.progress;
      if (j.progress >= j.work) {
        this.structures.finishElectrify(s);
        this.addLog(`⚡ Taller electrificado: ${s.def.name}. Con corriente trabaja el doble de rápido.`, 'bueno');
        this.dropJob(c);
      }
      return;
    }
    if (building) {
      const s = this.jobStructure(j)!;
      s.progress = Math.min(j.progress, buildWork(s));
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

  /** Primer montón de 💊 Medicina que haya. */
  private medicineStack(): { x: number; y: number } | null {
    return this.items.list().find((s) => s.resource === 'medicina') ?? null;
  }

  /** Gasta 1 💊 de la colonia. true si había. */
  private takeMedicine(): boolean {
    const st = this.medicineStack();
    return !!st && !!this.items.take(st.x, st.y, 1);
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

  /** No queda ningún saqueador en pie que no huya (todos en el suelo, huyendo o no hay raid). */
  fightOver(): boolean {
    return !this.others.some((o) => o.role === 'saqueador' && !o.downed && !o.raider?.fleeing);
  }

  /** Hay una radio de llamada construida y con corriente (#21 C). */
  radioOn(): boolean {
    return this.structures.all().some((s) => s.built && s.def.id === 'radio' && !lacksPower(s));
  }

  /** En la casilla hay una cama (de colono o de hospital) construida. */
  isBedTile(x: number, y: number): boolean {
    const s = this.structures.at(x, y);
    return !!s && s.built && (s.def.id === 'cama' || s.def.id === HOSPITAL_BED_ID);
  }

  /** En la casilla hay una cama de hospital construida. */
  isHospitalBedTile(x: number, y: number): boolean {
    const s = this.structures.at(x, y);
    return !!s && s.built && s.def.id === HOSPITAL_BED_ID;
  }

  /** Está tumbado (en el suelo o durmiendo) en una cama de hospital: sus heridas se cierran antes y se infectan menos. */
  inHospitalBed(c: Colonist): boolean {
    if (c.carriedBy !== undefined || !(c.downed || c.activity === 'sleeping')) return false;
    return this.isHospitalBedTile(c.tile.x, c.tile.y);
  }

  /** La cama la ocupa otro: un herido tumbado en ella o al que llevan a ella. */
  private bedTaken(x: number, y: number, except?: Colonist): boolean {
    const bed = this.structures.at(x, y);
    return this.colonists.some((k) => k !== except && (
      (k.downed && k.carriedBy === undefined && !!bed && this.structures.at(k.tile.x, k.tile.y) === bed) ||
      (k.job?.kind === 'curar' && !!k.job.escorting && k.job.x === x && k.job.y === y && k.job.pid !== except?.id)));
  }

  /**
   * La cama libre más cercana para un herido (sin nadie durmiendo, tumbado ni de camino a ella):
   * antes una de hospital que una normal, aunque esté más lejos.
   */
  private restBedFor(p: Colonist): Point | null {
    let best: Point | null = null;
    let bestD = Infinity;
    for (const s of this.structures.all()) {
      if (!s.built || (s.def.id !== 'cama' && s.def.id !== HOSPITAL_BED_ID) || this.reservations.holder(s.x, s.y) !== undefined || this.bedTaken(s.x, s.y, p)) continue;
      const d = Math.abs(s.x - p.tile.x) + Math.abs(s.y - p.tile.y) + (s.def.id === HOSPITAL_BED_ID ? 0 : HOSPITAL_FIRST);
      if (d < bestD) {
        bestD = d;
        best = { x: s.x, y: s.y };
      }
    }
    return best;
  }

  /**
   * Prioridad médica, segunda parte: tras el combate, a un colono en el suelo que no está en una cama
   * (ni lo llevan) se le cura y se le lleva a la cama libre más cercana. Si no hay cama, se queda en el suelo.
   */
  wantsCarryToBed(p: Colonist): boolean {
    if (p.role !== 'colono' || !p.downed || p.carriedBy !== undefined || this.isBedTile(p.tile.x, p.tile.y)) return false;
    return this.fightOver() && this.restBedFor(p) !== null;
  }

  /**
   * Prioridad médica tras el combate (pedida por Mikel el 2026-10-19): a cada colono que sangra
   * y no tiene a nadie yendo a curarle, va el colono libre más cercano, aunque deje lo que hace.
   * Libre: no reclutado, ni en el suelo, ni en pánico, ni comiendo o durmiendo, ni curando ya.
   */
  medicalPriority(): void {
    if (!this.fightOver()) return;
    const tending = new Set<number>();
    for (const k of this.colonists) if (k.job?.kind === 'curar' && k.job.pid !== undefined) tending.add(k.job.pid);
    for (const p of this.colonists) {
      if (!(needsUrgentCare(p) || this.wantsCarryToBed(p)) || tending.has(p.id)) continue;
      let best: Colonist | undefined;
      let bestD = Infinity;
      for (const k of this.colonists) {
        if (k === p || k.drafted || k.downed || k.panic || k.need || k.vehicle || k.job?.kind === 'curar') continue;
        const d = Math.abs(k.tile.x - p.tile.x) + Math.abs(k.tile.y - p.tile.y);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      if (!best) continue;
      // Solo deja lo que hace si de verdad puede ir a curar (si no llega, sigue con lo suyo).
      const plan = findJob(this, best);
      if (!plan || plan.job.kind !== 'curar' || plan.job.pid === undefined) continue;
      const patient = this.colonists.find((k) => k.id === plan.job.pid);
      if (!patient || tending.has(patient.id) || !(needsUrgentCare(patient) || this.wantsCarryToBed(patient))) continue;
      if (best.job) {
        this.addLog(`🩹 ${best.name} deja lo que hace para atender a ${patient.name}.`, 'info');
        this.dropJob(best);
      }
      best.gearTask = undefined;
      best.job = plan.job;
      best.path = plan.path;
      best.activity = 'toJob';
      best.waitTicks = 0;
      tending.add(patient.id);
    }
    // Sin nadie libre que le atienda, el herido que sigue en pie se cura él mismo (peor que si le cura otro).
    for (const p of this.colonists) {
      if (!needsUrgentCare(p) || tending.has(p.id) || p.downed || p.drafted || p.panic || p.need || p.vehicle) continue;
      if (p.job) this.dropJob(p);
      p.gearTask = undefined;
      p.job = { kind: 'curar', x: p.tile.x, y: p.tile.y, pid: p.id, stand: { ...p.tile }, progress: 0, work: SELF_CARE_WORK };
      p.path = [];
      p.activity = 'toJob';
      p.waitTicks = 0;
      tending.add(p.id);
      this.addLog(`🩹 Nadie puede atender a ${p.name}: se cura él mismo.`, 'info');
    }
  }

  /** Camas de prisionero libres menos las que ya tiene apalabradas un carcelero que va a capturar (#22). */
  prisonBedsFree(): number {
    let free = 0;
    for (const s of this.structures.all()) {
      if (!s.built || s.def.id !== 'cama_prision') continue;
      const busy = this.others.some((o) => o.role === 'prisionero' && o.carriedBy === undefined && o.tile.x === s.x && o.tile.y === s.y) ||
        this.colonists.some((k) => k.job?.escorting && k.job.x === s.x && k.job.y === s.y);
      if (!busy) free++;
    }
    const going = this.colonists.filter((k) => k.job?.kind === 'carcelero' && k.job.warden === 'capturar' && !k.job.escorting).length;
    return Math.max(0, free - going);
  }

  /** Rematar pesa (#22): −5 % a quien remata y −3 % a quien lo ve cerca; a los «duros», nada. */
  private finishMood(killer: Colonist, at: Point): void {
    const until = this.tick + FINISH_MOOD.hours * TICKS_PER_HOUR;
    const tough = (k: Colonist) => k.traits.some((t) => t.id === 'duro');
    if (!tough(killer)) killer.needs.finishedUntil = until;
    for (const k of this.colonists) {
      if (k === killer || tough(k) || k.downed || k.activity === 'sleeping') continue;
      if (Math.max(Math.abs(k.tile.x - at.x), Math.abs(k.tile.y - at.y)) > FINISH_MOOD.witnessRadius) continue;
      k.needs.sawFinishUntil = until;
    }
  }

  /** Llevar un cadáver a la hoguera: lo recoge, va hasta ella y lo quema. */
  private updateCorpseJob(c: Colonist): void {
    const j = c.job!;
    const fire = this.structures.get(j.sid!)!;
    const cj = j.corpse!;
    if (!cj.body) {
      const i = this.corpses.findIndex((k) => k.id === cj.id);
      const body = this.corpses[i];
      if (c.tile.x !== body.x || c.tile.y !== body.y) {
        // No ha llegado a la casilla del cadáver: vuelve a buscar el camino.
        const route = this.routeTo(c, [{ x: body.x, y: body.y }]);
        if (!route || route.path.length === 0) {
          this.dropJob(c);
          this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
        } else c.path = route.path;
        return;
      }
      this.corpses.splice(i, 1);
      cj.body = body;
    }
    if (!this.structures.isBesideStructure(c.tile, fire)) {
      const route = this.routeTo(c, this.structures.sidesOf(fire));
      if (!route || route.path.length === 0) {
        this.dropJob(c);
        this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
        return;
      }
      c.path = route.path;
      c.activity = 'toJob';
      return;
    }
    const name = CREATURES[cj.body.creature].name.toLowerCase();
    cj.body = undefined;
    this.addLog(`🔥 ${c.name} quema el cadáver de un ${name} en la hoguera.`, 'info');
    this.dropJob(c);
  }

  /** Trabajos con personas: curar, capturar, dar de comer, convencer y llevar a la celda. */
  private updatePawnJob(c: Colonist): void {
    const j = c.job!;
    const o = this.pawns().find((k) => k.id === j.pid)!;
    if (j.escorting && j.kind === 'curar') {
      // Ha llegado a la cama: deja al herido en ella para que se recupere.
      o.carriedBy = undefined;
      o.tile = { x: j.x, y: j.y };
      o.pos = { x: j.x + 0.5, y: j.y + 0.5 };
      const where = this.isHospitalBedTile(j.x, j.y) ? 'una cama de hospital' : 'una cama';
      this.addLog(`🛏 ${c.name} deja a ${o.name} en ${where} para que se recupere.`, 'bueno');
      this.dropJob(c);
      return;
    }
    if (j.escorting) {
      // Ha llegado a la cama: deja al prisionero en ella.
      o.carriedBy = undefined;
      o.tile = { x: j.x, y: j.y };
      o.pos = { x: j.x + 0.5, y: j.y + 0.5 };
      this.addLog(`⛓ ${c.name} deja a ${o.name} en su celda.`, 'info');
      this.dropJob(c);
      return;
    }
    if (o !== c && Math.max(Math.abs(c.tile.x - o.tile.x), Math.abs(c.tile.y - o.tile.y)) > 1) {
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
      // Con 💊 en la colonia, la usa: cierra las heridas el doble de rápido y trata la infección.
      const bleeding = o.wounds.some((w) => w.bleeding);
      const dose = needsDose(o);
      // A los saqueadores en el suelo solo se les cierran las heridas: la 💊 no se gasta en ellos.
      const pill = o.role !== 'saqueador' && (bleeding || dose) && this.takeMedicine();
      const self = o === c;
      const n = treatWounds(o, pill, self);
      const what = n === 1 ? 'una herida' : `${n} heridas`;
      if (n) this.addLog(self ? `🩹 ${c.name} se cura ${what} él mismo${pill ? ' con 💊 Medicina' : ''}.` : `🩹 ${c.name} cura ${what} de ${o.name}${pill ? ' con 💊 Medicina' : ''}.`, 'bueno');
      if (pill && dose) {
        const cured = giveDose(o);
        if (self) this.addLog(cured ? `💊 ${c.name} toma su medicina: se cura de la infección.` : `💊 ${c.name} toma su medicina contra la infección (falta otra mañana).`, 'bueno');
        else this.addLog(cured ? `💊 ${c.name} trata a ${o.name}: se cura de la infección.` : `💊 ${c.name} da a ${o.name} su medicina contra la infección (falta otra mañana).`, 'bueno');
      }
      // Tras el combate, al colono que está en el suelo se le lleva a una cama libre; si no hay, se queda donde está.
      if (this.wantsCarryToBed(o)) {
        const bed = this.restBedFor(o);
        const path = bed ? findPath(this.map, c.tile, bed, 60000) : null;
        if (bed && path) {
          o.carriedBy = c.id;
          j.escorting = true;
          j.x = bed.x;
          j.y = bed.y;
          c.path = path;
          c.activity = 'toJob';
          this.addLog(`🛏 ${c.name} lleva a ${o.name} a una cama.`, 'info');
          return;
        }
      }
      this.dropJob(c);
      return;
    }
    if (j.warden === 'rematar') {
      const at = { ...o.tile };
      this.dropJob(c);
      this.killPawn(o, `rematado por ${c.name}`);
      this.finishMood(c, at);
      return;
    }
    if (j.warden === 'capturar') {
      // Sin cama de prisionero libre (o sin camino hasta ella) no se captura: sigue en el suelo (#22).
      const bed = this.freePrisonBed();
      const path = bed ? findPath(this.map, c.tile, bed, 60000) : null;
      if (!bed || !path) {
        this.dropJob(c);
        this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
        return;
      }
      makePrisoner(o, 0.45 + this.rng.next() * 0.45);
      this.addLog(`⛓ ${c.name} captura a ${o.name}. Está en 👥 → Prisioneros.`, 'bueno');
      // Retener a los suyos también baja la relación con su facción.
      this.changeRelation(o.faction, RELATION.killOrHold);
      o.carriedBy = c.id;
      j.escorting = true;
      j.x = bed.x;
      j.y = bed.y;
      c.path = path;
      c.activity = 'toJob';
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

  /** Lo que valía la clave del foso con agua la última vez que se miró (zanjas y lo investigado). */
  private floodKey = '';

  /**
   * Inunda las zanjas que tocan el agua (con «Hidráulica») o las deja secas, repinta las que cambian
   * y saca de un foso recién inundado a quien estuviera dentro.
   */
  refreshFlooding(): void {
    this.floodKey = `${this.terrainVersion}:${this.research.done.length}`;
    const changed = updateFlooding(this.map, trenchesFlood(this.research));
    if (!changed.length) return;
    this.markChanged(...changed);
    const wet = new Set(changed.filter((i) => this.map.trench[i] === TRENCH_FLOODED));
    for (const c of this.colonists) {
      if (flies(c.creature)) continue;
      if (wet.has(c.tile.y * this.map.width + c.tile.x) && !isPassable(this.map, c.tile.x, c.tile.y)) this.moveOutOfTheWay(c);
      // Quien pensaba cruzar por ahí busca otro camino.
      else if (c.path.some((p) => wet.has(p.y * this.map.width + p.x) && !isPassable(this.map, p.x, p.y))) c.path = [];
    }
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
    // Una zanja nueva pegada al agua (o a un foso) se inunda en el momento.
    if (job === 'zanja' || job === 'rellenar') this.refreshFlooding();
  }

  /** Casillas que arden cerca de la colonia (se calcula como mucho una vez por segundo). */
  fireThreats(): Point[] {
    const key = Math.floor(this.tick / TICKS_PER_SECOND);
    if (this.fireThreatKey === key) return this.fireThreatCache;
    this.fireThreatKey = key;
    this.fireThreatCache = [];
    for (const i of this.fires.keys()) {
      const x = i % this.map.width;
      const y = (i - x) / this.map.width;
      if (threatens(this, x, y)) this.fireThreatCache.push({ x, y });
    }
    return this.fireThreatCache;
  }
  private fireThreatKey = -1;
  private fireThreatCache: Point[] = [];

  /** Caza: se acerca al animal hasta tenerlo a tiro y le dispara (o le golpea). */
  private updateHuntJob(c: Colonist): void {
    const j = c.job!;
    const a = this.others.find((k) => k.id === j.pid);
    if (j.tame) {
      // Domar: se acerca, le da de comer un rato y lo intenta.
      if (!a || a.downed || !a.tameMarked || a.tamed) {
        this.dropJob(c);
        return;
      }
      if (Math.abs(a.tile.x - c.tile.x) + Math.abs(a.tile.y - c.tile.y) <= 1) {
        c.path = [];
        c.activity = 'working';
        a.path = [];
        j.progress += 1;
        if (j.progress >= j.work) {
          tryTame(this, c, a);
          this.dropJob(c);
          this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
        }
        return;
      }
      if (c.path.length === 0 || (this.tick + c.id) % 30 === 0) {
        const path = findPath(this.map, c.tile, a.tile, JOB_PATH_NODES);
        if (!path) {
          this.dropJob(c);
          return;
        }
        c.path = path.slice(0, Math.max(1, path.length - 1));
      }
      return;
    }
    if (!a || a.downed || !a.huntMarked) {
      this.dropJob(c);
      return;
    }
    if (c.attackCooldown && c.attackCooldown > 0) c.attackCooldown--;
    if (canHit(this, c, a)) {
      c.path = [];
      c.activity = 'working';
      if (!c.attackCooldown) attack(this, c, a);
      return;
    }
    if (c.path.length === 0 || (this.tick + c.id) % 30 === 0) {
      const path = findPath(this.map, c.tile, a.tile, JOB_PATH_NODES);
      if (!path) {
        this.dropJob(c);
        this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
        return;
      }
      c.path = path.slice(0, Math.max(1, path.length - 1));
    }
  }

  /** Casillas de habitaciones cerradas que piden tejado. */
  roofTodo(): Point[] {
    return roofTodo(this);
  }

  /** Va a la casilla y pone el tejado. */
  private updateRoofJob(c: Colonist): void {
    const j = c.job!;
    if (c.tile.x !== j.x || c.tile.y !== j.y) {
      if (c.path.length === 0) {
        const path = findPath(this.map, c.tile, { x: j.x, y: j.y }, JOB_PATH_NODES);
        if (!path || path.length === 0) {
          this.dropJob(c);
          this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
          return;
        }
        c.path = path;
      }
      return;
    }
    c.activity = 'working';
    j.progress += workSpeed(c, 'construir') * this.lightFactor(c.tile);
    if (j.progress >= j.work) {
      putRoof(this, j.x, j.y);
      this.dropJob(c);
    }
  }

  /** Va a la casilla que arde y la apaga. */
  private updateFireJob(c: Colonist): void {
    const j = c.job!;
    if (!burning(this, j.x, j.y)) {
      this.dropJob(c);
      return;
    }
    const here = (Math.abs(c.tile.x - j.x) + Math.abs(c.tile.y - j.y)) <= 1;
    if (!here) {
      if (c.path.length === 0) {
        const path = findPath(this.map, c.tile, j.stand, JOB_PATH_NODES);
        if (!path || path.length === 0) {
          this.dropJob(c);
          this.nextJobScan.set(c.id, this.tick + JOB_RETRY_TICKS);
          return;
        }
        c.path = path;
      }
      return;
    }
    c.path = [];
    c.activity = 'working';
    j.progress += 1;
    if (j.progress >= j.work) {
      extinguish(this, j.x, j.y);
      this.dropJob(c);
    }
  }

  /** Termina de sembrar o de cosechar una casilla. */
  private finishFarmWork(x: number, y: number, action: 'sembrar' | 'cosechar' | 'arrancar'): void {
    if (action === 'arrancar') {
      this.farms.uproot(x, y);
      return;
    }
    if (action === 'sembrar') {
      // Con «Agricultura mejorada», si hay abono en la colonia se echa 1 al sembrar (+25 % de cosecha).
      if (this.farms.sow(x, y) && isResearched(this.research, 'agricultura')) {
        const st = this.items.list().find((s) => s.resource === 'abono');
        const p = this.farms.plantAt(x, y);
        if (st && p && this.items.take(st.x, st.y, 1)) p.fertilized = true;
      }
      return;
    }
    const crop = this.farms.harvest(x, y, (a, b) => this.rng.int(a, b));
    if (crop) this.items.drop(x, y, crop.resource, crop.amount);
  }

  /** Crea un huerto (sin pisar almacenes). */
  createGrowZone(r: TileRect): ReturnType<GrowZones['create']> {
    const z = this.farms.create(r, undefined, (x, y) => this.zones.at(x, y) !== undefined);
    if (z) this.markClearing(r, 'huerto', z.id);
    return z;
  }

  extendGrowZone(id: number, r: TileRect): number {
    const n = this.farms.extend(id, r, (x, y) => this.zones.at(x, y) !== undefined);
    if (this.farms.get(id)) this.markClearing(r, 'huerto', id);
    return n;
  }

  /** Crea un almacén (sin pisar huertos). */
  createStorageZone(r: TileRect): ReturnType<StorageZones['create']> {
    const z = this.zones.create(r, (x, y) => this.farms.at(x, y) !== undefined);
    if (z) this.markClearing(r, 'almacen', z.id);
    return z;
  }

  extendStorageZone(id: number, r: TileRect): number {
    const n = this.zones.extend(id, r, (x, y) => this.farms.at(x, y) !== undefined);
    if (this.zones.get(id)) this.markClearing(r, 'almacen', id);
    return n;
  }

  /** Quita casillas de almacenes y huertos (y lo que faltaba por despejar en ellas). */
  removeZonesArea(r: TileRect): number {
    this.clearing.removeArea(r);
    return this.zones.removeArea(r) + this.farms.removeArea(r);
  }

  /**
   * Despejar zonas (#14): lo que haya dentro del rectángulo que se tale, pique o saquee queda
   * marcado; las casillas de otra zona o con una construcción se respetan.
   */
  private markClearing(r: TileRect, kind: 'almacen' | 'huerto', id: number): number {
    return this.clearing.markArea(r, kind, id, this.designations, (x, y) => {
      if (this.structures.at(x, y)) return true;
      const z = this.zones.at(x, y);
      const f = this.farms.at(x, y);
      if (kind === 'almacen') return !!f || (!!z && z.id !== id);
      if (z || (f && f.id !== id)) return true;
      return fertilityAt(this.map, x, y) === 0; // en un huerto, solo lo que se podrá cultivar
    });
  }

  /** Revisa lo que falta por despejar; lo que ya está libre entra en su zona. */
  private updateClearing(): void {
    this.clearing.update(
      this.designations,
      (kind, id) => (kind === 'almacen' ? !!this.zones.get(id) : !!this.farms.get(id)),
      (x, y, m) => {
        const r = { x0: x, y0: y, x1: x, y1: y };
        if (m.kind === 'almacen') this.zones.extend(m.zone, r, (a, b) => this.farms.at(a, b) !== undefined);
        else this.farms.extend(m.zone, r, (a, b) => this.zones.at(a, b) !== undefined);
      },
    );
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
      if (left > 0 && h.toBlueprint && this.nextSharedBlueprint(c)) return;
    }
    this.dropJob(c); // si sobra algo, lo deja en el suelo donde está
  }

  /**
   * Reparto de material (#20): con carga de sobra, sigue al siguiente plano de la lista que aún pida
   * ese recurso y al que se pueda llegar. false si no queda ninguno.
   */
  private nextSharedBlueprint(c: Colonist): boolean {
    const j = c.job!;
    const h = j.haul!;
    const load = c.carrying;
    while (load && h.extra && h.extra.length > 0) {
      const e = h.extra.shift()!;
      const s = this.structures.get(e.sid);
      const ok = !!s && !s.built && s.x === e.x && s.y === e.y && (this.structures.needs(s)[load.resource] ?? 0) > 0;
      const route = ok ? this.routeTo(c, this.structures.sidesOf(s!)) : null;
      if (!route) {
        this.reservations.release(e.x, e.y, c.id, 'work');
        continue;
      }
      this.reservations.release(j.x, j.y, c.id, 'work');
      j.sid = e.sid;
      j.x = e.x;
      j.y = e.y;
      h.to = { x: e.x, y: e.y };
      j.stand = route.stand;
      c.path = route.path;
      c.activity = 'toJob';
      return true;
    }
    return false;
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
  /** Cancela la electrificación de un taller: el material ya traído se deja a su lado. */
  cancelElectrify(s: Structure): void {
    const back = this.structures.cancelElectrify(s);
    if (Object.keys(back).length) this.dropBeside(s, back);
  }

  private dropBeside(s: Structure, gains: Partial<Stockpile>): void {
    const side = this.structures.sidesOf(s)[0] ?? { x: s.x, y: s.y };
    this.items.dropAll(side.x, side.y, gains);
  }

  /** Derriba una construcción terminada y deja en el suelo parte de su material. */
  // --- Mover muebles -------------------------------------------------------------

  /** Pide llevar una construcción a otro sitio (✋ Mover). false si no se mueve o no cabe allí. */
  orderMoveStructure(id: number, x: number, y: number, rot: 0 | 1): boolean {
    const s = this.structures.get(id);
    return !!s && this.structures.orderMove(s, x, y, rot);
  }

  /** Quita la orden de mover (si nadie lo lleva aún). */
  cancelMoveStructure(id: number): boolean {
    const s = this.structures.get(id);
    return !!s && this.structures.cancelMove(s);
  }

  /** Termina un paso de mover: al desmontar se lo lleva hacia el destino; al montar lo deja puesto. */
  private finishMoveStep(c: Colonist): void {
    const j = c.job!;
    const s = this.jobStructure(j);
    if (!s) {
      this.dropJob(c);
      return;
    }
    if (j.move === 'desmontar') {
      const to = s.moveTo;
      if (!to || !this.structures.canPlaceDef(s.def, to.x, to.y, to.rot, s)) {
        s.moveTo = undefined;
        this.addLog(`✋ ${s.def.name}: ya no cabe donde se quería llevar; se queda donde está.`, 'info');
        this.dropJob(c);
        return;
      }
      this.structures.lift(s);
      // Ya montado encima de su sitio de antes (lo movió un poco): se monta sin andar.
      const here = this.structures.isBesideStructure(c.tile, s);
      const route = here ? { stand: { ...c.tile }, path: [] } : pathToNearest(this.map, c.tile, this.structures.sidesOf(s));
      if (!route) {
        this.returnLifted(s, true);
        this.addLog(`✋ ${s.def.name}: no hay camino hasta donde se quería llevar.`, 'info');
        this.dropJob(c);
        return;
      }
      j.move = 'montar';
      j.x = s.x;
      j.y = s.y;
      j.stand = route.stand;
      j.progress = 0;
      c.path = route.path;
      c.activity = 'toJob';
      // Suelta el sitio de antes y reserva el nuevo (si no, otro colono podría coger el mismo
      // trabajo y el aviso «trabaja sin tenerlo reservado» saltaba mientras lo montaba, #19).
      this.reservations.releaseAll(c.id);
      // Si ya lo tiene otro, lo deja: el mueble vuelve a su sitio y la orden sigue.
      if (!this.reservations.reserve(j.x, j.y, c.id, 'work')) this.dropJob(c);
      return;
    }
    // Montar en el destino.
    if (!this.structures.putDown(s, s.x, s.y, s.rot)) {
      this.returnLifted(s, true);
      this.addLog(`✋ ${s.def.name}: el sitio nuevo se ha ocupado; vuelve a donde estaba.`, 'info');
    } else {
      s.moveTo = undefined;
      this.settleStructure(s);
    }
    this.dropJob(c);
  }

  /**
   * Devuelve un mueble que se estaba llevando: a su sitio de antes o, si se ha ocupado, al lado.
   * Si no cabe en ningún sitio, se desmonta del todo y deja su material. `forget` quita la orden.
   */
  private returnLifted(s: Structure, forget: boolean): void {
    const from = s.moveFrom ?? { x: s.x, y: s.y, rot: s.rot };
    const spots: { x: number; y: number }[] = [from];
    for (let r = 1; r <= 4; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) spots.push({ x: from.x + dx, y: from.y + dy });
    }
    const keep = forget ? undefined : s.moveTo;
    for (const p of spots) {
      if (this.structures.putDown(s, p.x, p.y, from.rot)) {
        s.moveTo = keep && !(keep.x === s.x && keep.y === s.y && keep.rot === s.rot) ? keep : undefined;
        this.settleStructure(s);
        return;
      }
    }
    const back = this.structures.discardLifted(s);
    this.items.dropAll(from.x, from.y, back);
  }

  demolishStructure(s: Structure): void {
    // Desmontar en kit: no se recupera el material, queda el kit (y lo que tuviera dentro).
    const kit = s.pack ? kitOf(s.def) : undefined;
    if (kit) {
      const inside = { ...s.delivered };
      this.breakStructure(s);
      this.items.dropAll(s.x, s.y, { ...inside, [kit]: 1 });
      this.addLog(`📦 Desmontado en kit: ${s.def.name.toLowerCase()}. Se guarda en el almacén y se monta en otro sitio.`, 'info', undefined, { x: s.x, y: s.y });
      return;
    }
    const back = this.structures.demolish(s);
    this.items.dropAll(s.x, s.y, back);
  }

  /** Pide desmontar en kit una construcción terminada que lo admite (lo hace un colono con «Construir»). */
  orderPack(id: number, on = true): boolean {
    const s = this.structures.get(id);
    if (!s || !s.built || !kitOf(s.def)) return false;
    s.pack = on;
    s.demolish = on;
    this.structures.version++;
    return true;
  }

  /** Kits de esa construcción en el almacén que no tiene ya apalabrados otro plano. */
  freeKits(defId: string): number {
    const kit = kitOf(buildingDef(defId));
    if (!kit) return 0;
    const claimed = this.structures.all().filter((s) => !s.built && s.fromKit && s.def.id === defId && !(s.delivered[kit] ?? 0)).length;
    return Math.max(0, this.inventory()[kit] - claimed);
  }

  /** Una construcción rota a golpes (por el bruto mutante): desaparece sin dejar material. */
  breakStructure(s: Structure): void {
    const tiles = this.structures.tilesOf(s);
    this.structures.demolish(s);
    for (const t of tiles) this.shutDoors.delete(t.y * this.map.width + t.x);
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

  /** Se pueden poner planos nuevos de esta construcción (las torretas piden su investigación). */
  canBuild(defId: string): boolean {
    return unlocked(this.research, buildingDef(defId));
  }

  /**
   * Pone planos de construcción en un área (la orden de 🏗). Devuelve cuántos; 0 si aún falta
   * la investigación que pide.
   */
  placeBuildArea(r: TileRect, defId: string, shape: PlaceShape, rot: 0 | 1 = 0): number {
    let kits = this.freeKits(defId);
    if (!this.canBuild(defId) && kits <= 0) return 0;
    const before = new Set(this.structures.all().map((s) => s.id));
    const n = this.structures.placeArea(r, defId, shape, rot);
    // Con kits en el almacén, los planos nuevos se montan con ellos (sin material).
    for (const s of this.structures.all()) {
      if (kits <= 0) break;
      if (before.has(s.id) || s.built || s.def.id !== defId) continue;
      s.fromKit = true;
      kits--;
    }
    return n;
  }

  /** Ya se puede encargar esta receta (las armas de fuego y las balas piden «Pólvora»). */
  canCraft(recipe: RecipeDef): boolean {
    return unlocked(this.research, recipe);
  }

  /** Ya se puede elegir este cultivo para un huerto (la hierba curativa pide «Medicina de campo»). */
  canPlant(crop: CropDef): boolean {
    return unlocked(this.research, crop);
  }

  /**
   * Elige qué se planta en un huerto. false si el cultivo aún pide investigación (en las partidas
   * empezadas, los huertos que ya estaban con él lo siguen plantando).
   */
  setFarmCrop(zoneId: number, crop: CropDef): boolean {
    if (!this.canPlant(crop)) return false;
    this.farms.setCrop(zoneId, crop);
    return true;
  }

  /** Pone (o quita, con null) la orden de un taller. false si la receta aún pide investigación. */
  setStationBill(s: Structure, bill: Bill | null): boolean {
    if (bill && !this.canCraft(bill.recipe)) return false;
    this.structures.setBill(s, bill);
    return true;
  }

  // --- Reclutar y órdenes directas -------------------------------------------------

  /** Elige el proyecto de investigación (null para parar). Devuelve false si aún no se puede. */
  setResearch(id: string | null): boolean {
    if (!chooseResearch(this.research, id)) return false;
    // Quien estaba investigando lo deja para volver a mirar qué hacer.
    if (id === null) for (const c of this.colonists) if (c.job?.kind === 'investigar') this.dropJob(c);
    return true;
  }

  /** Recluta (o libera) a un colono. Reclutado deja lo que hacía y espera órdenes. */
  setDrafted(colonistId: number, drafted: boolean): void {
    const c = this.colonists.find((k) => k.id === colonistId);
    if (!c || c.drafted === drafted) return;
    c.drafted = drafted;
    // Al liberarlo pierde la postura; reclutado de nuevo empieza sin ella.
    c.stance = undefined;
    c.attackTarget = undefined;
    if (c.panic) return; // en pánico sigue huyendo; al calmarse, obedece
    c.gearTask = undefined;
    this.dropJob(c);
    if (c.need) this.endNeed(c);
    c.path = [];
    c.activity = 'idle';
    c.waitTicks = drafted ? 0 : 30;
  }

  /**
   * Postura de combate (null = la normal: va a por los enemigos cercanos). Si no estaba reclutado,
   * se recluta. «atacar» necesita el id de un saqueador en pie; «retirarse» sale ya hacia la cama
   * o habitación más cercana. Devuelve false si no se puede (en pánico, objetivo no válido…).
   */
  setStance(colonistId: number, stance: Stance | null, targetId?: number): boolean {
    const c = this.colonists.find((k) => k.id === colonistId);
    if (!c || c.panic || c.downed) return false;
    if (stance === 'atacar' && !validAttackTarget(this, targetId)) return false;
    if (!c.drafted) this.setDrafted(c.id, true);
    c.stance = stance ?? undefined;
    c.attackTarget = stance === 'atacar' ? targetId : undefined;
    this.coverMoves.delete(c.id);
    if (stance === 'mantener' || stance === 'atacar' || stance === null) {
      // Mantener: se queda donde está (o termina de llegar adonde se le mandó).
      if (stance === 'atacar') c.path = [];
      return true;
    }
    const refuge = findRefuge(this, c);
    c.path = refuge?.path ?? [];
    c.activity = c.path.length ? 'moving' : 'idle';
    this.addLog(`🏃 ${c.name} se retira ${refuge ? (refuge.bed ? 'a una cama' : 'a resguardo') : 'pero no encuentra dónde: se queda quieto'}, sin pelear.`, 'info');
    return true;
  }

  /**
   * Orden directa de trabajo: el colono hace ya lo que haya en esa casilla (talar lo marcado o un
   * árbol, construir un plano, cosechar…). Si no estaba marcado y se puede aprovechar, se marca.
   * Si otro colono lo tenía, lo deja. Devuelve false si ahí no hay nada que hacer o no se llega.
   */
  forceJob(colonistId: number, x: number, y: number): boolean {
    const c = this.colonists.find((k) => k.id === colonistId);
    if (!c || c.panic) return false;
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
    // Un vehículo terminado deja de ser una construcción: sale a rodar desde su sitio.
    if (s.def.vehicle && vehicleDef(s.def.vehicle)) {
      this.structures.demolish(s);
      this.addVehicle(s.def.vehicle, s.x, s.y);
      const vd = vehicleDef(s.def.vehicle)!;
      const boat = !!vd.water;
      const rowed = boat && !usesFuel(vd);
      this.addLog(`${boat ? '🛶' : '🚙'} ${s.def.name}: terminado. Tócalo para elegir ${rowed ? 'quién rema y quién va de tirador' : 'conductor y tirador'}.`, 'bueno');
      return;
    }
    this.settleStructure(s);
  }

  // --- Vehículos ----------------------------------------------------------------

  /** Pone un vehículo nuevo con la esquina en (x, y) (sin combustible). */
  addVehicle(def: string, x: number, y: number): Vehicle {
    const d = vehicleDef(def)!;
    const v: Vehicle = { id: this.nextVehicleId++, def, x, y, pos: { x, y }, path: [], fuel: 0, hp: d.hp, facing: 1 };
    this.vehicles.push(v);
    return v;
  }

  vehicle(id: number): Vehicle | undefined {
    return this.vehicles.find((v) => v.id === id);
  }

  /** Vehículo que ocupa la casilla (x, y). */
  vehicleAt(x: number, y: number): Vehicle | undefined {
    return this.vehicles.find((v) => covers(v, x, y));
  }

  /** Coste de pasar por una casilla (1 normal; más en barro, agua poco profunda…). */
  moveCostAt(x: number, y: number): number {
    return this.terrainCost({ x, y });
  }

  /**
   * Un colono va a un asiento de un vehículo (conductor o tirador). Si había otro, se baja; si él iba
   * en otro sitio, lo deja. Va andando hasta el vehículo y se sube al llegar.
   */
  boardVehicle(vehicleId: number, colonistId: number, seat: VehicleSeat): boolean {
    const v = this.vehicle(vehicleId);
    const c = this.colonists.find((k) => k.id === colonistId);
    if (!v || !c || c.downed || c.panic || defOf(v).hostile) return false;
    if (c.vehicle?.id === v.id && c.vehicle.seat === seat) return true;
    const other = occupant(this, v, seat);
    if (other) this.leaveVehicle(other);
    if (c.vehicle) this.leaveVehicle(c);
    this.dropJob(c);
    c.gearTask = undefined;
    if (c.need) this.endNeed(c);
    c.path = [];
    c.vehicle = { id: v.id, seat, boarded: false };
    return true;
  }

  /** Se baja (o deja de ir hacia) el vehículo; si iba dentro, queda en una casilla libre pegada a él. */
  leaveVehicle(c: Colonist): void {
    const seat = c.vehicle;
    if (!seat) return;
    delete c.vehicle;
    const v = this.vehicle(seat.id);
    if (!seat.boarded || !v) return;
    const at = vehicleCenter(v);
    const spots = besideTiles(this, v).sort((a, b) => Math.hypot(a.x + 0.5 - at.x, a.y + 0.5 - at.y) - Math.hypot(b.x + 0.5 - at.x, b.y + 0.5 - at.y));
    // En medio de un lago (la balsa) no hay dónde poner el pie al lado: va nadando a la orilla más cercana.
    const t = spots[0] ?? this.nearestDryTile(v.x, v.y) ?? { x: v.x, y: v.y };
    if (!spots[0] && defOf(v).water) this.addLog(`🛶 ${c.name} se baja de ${theName(defOf(v))} y nada hasta la orilla.`, 'info', undefined, t);
    c.tile = { x: t.x, y: t.y };
    c.pos = { x: t.x + 0.5, y: t.y + 0.5 };
    c.path = [];
    c.activity = 'idle';
    c.waitTicks = 10;
    // Sin conductor, el vehículo se para.
    if (seat.seat === 'conductor') v.path = [];
  }

  /** Casilla que se pisa más cercana a (x, y), en anillos de hasta 40 casillas. */
  private nearestDryTile(x: number, y: number): Point | null {
    for (let r = 1; r <= 40; r++) {
      let best: Point | null = null;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !isPassable(this.map, x + dx, y + dy)) continue;
          const d = Math.hypot(dx, dy);
          if (d < bestD) {
            bestD = d;
            best = { x: x + dx, y: y + dy };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Se bajan todos los del vehículo. */
  emptyVehicle(vehicleId: number): void {
    for (const c of this.pawns()) if (c.vehicle?.id === vehicleId) this.leaveVehicle(c);
  }

  /**
   * Manda el vehículo a la casilla tocada (lo deja encima). Hace falta conductor sentado y ⛽.
   * Devuelve qué ha pasado, para el aviso en pantalla.
   */
  orderVehicleMove(vehicleId: number, target: Point): 'ok' | 'sin-conductor' | 'sin-combustible' | 'sin-camino' {
    const v = this.vehicle(vehicleId);
    if (!v || defOf(v).hostile) return 'sin-camino';
    const driver = occupant(this, v, 'conductor');
    if (!driver?.vehicle?.boarded) return 'sin-conductor';
    const def = defOf(v);
    if (usesFuel(def) && v.fuel <= 0) return 'sin-combustible';
    const anchor = anchorFor(this, target, def);
    const path = anchor ? vehiclePath(this, { x: v.x, y: v.y }, anchor, def) : null;
    if (!path) return 'sin-camino';
    v.path = path;
    return 'ok';
  }

  /**
   * El colono que tiene asiento en un vehículo: va hacia él y se sube, o va dentro. Devuelve true si
   * esto ocupa su turno. Se baja si cae, entra en pánico o tiene que ir a comer o beber ya.
   */
  private updateVehicleSeat(c: Colonist): boolean {
    const seat = c.vehicle!;
    const v = this.vehicle(seat.id);
    if (!v || c.downed || c.panic) {
      this.leaveVehicle(c);
      return false;
    }
    if (seat.boarded) {
      if (!this.needsEnabled) return true;
      this.decayNeeds(c);
      if (c.needs.food < STARVING || c.needs.water < DEHYDRATED) {
        this.addLog(`🚙 ${c.name} se baja ${prepName(defOf(v), 'de')} para ${c.needs.food < STARVING ? 'comer' : 'beber'}.`, 'info');
        this.leaveVehicle(c);
        return false;
      }
      return true;
    }
    if (nextTo(v, c.tile)) {
      seat.boarded = true;
      c.path = [];
      this.addLog(`🚙 ${c.name} se sube ${prepName(defOf(v), 'a')} de ${seat.seat}.`, 'info');
      return true;
    }
    if (c.path.length === 0) {
      const route = this.routeTo(c, besideTiles(this, v).slice(0, 6));
      if (!route || route.path.length === 0) {
        this.addLog(`🚙 ${c.name} no puede llegar ${prepName(defOf(v), 'a')}.`, 'malo');
        delete c.vehicle;
        return false;
      }
      c.path = route.path;
    }
    c.activity = 'moving';
    this.moveAlongPath(c);
    return true;
  }

  /**
   * Lo que pasa al quedar puesta una construcción (al terminarla o al montar un mueble movido):
   * lo que no cabe en ella sale a un lado y nadie se queda dentro ni encerrado.
   */
  private settleStructure(s: Structure): void {
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
  /** Vatios-hora que caben en una batería (el doble con «Baterías mejoradas»). */
  batteryCapacity(s: Structure): number {
    return batteryCapacity(s, batteryMultiplier(this.research));
  }

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

  /** Sitios para los ratos libres: casillas junto a una mesa de juego o a una hoguera encendida. */
  leisureSpots(): Point[] {
    const out: Point[] = [];
    for (const s of this.structures.all()) {
      if (!s.built || !(s.def.recreation || (s.def.burnsCorpses && (s.fuel ?? 0) > 0))) continue;
      out.push(...this.structures.sidesOf(s));
    }
    return out;
  }

  private startWander(c: Colonist): void {
    // Si hace mucho de su último rato libre y hay mesa de juego u hoguera, va allí.
    if (this.tick - (c.needs.funAt ?? 0) > ROOMS.leisure.dueHours * TICKS_PER_HOUR) {
      const spots = this.leisureSpots();
      if (spots.length) {
        const route = pathToNearest(this.map, c.tile, spots);
        if (route && route.path.length > 0) {
          c.path = route.path;
          c.activity = 'wandering';
          return;
        }
      }
    }
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
    // Quien vuela (el dron) no nota el terreno ni pisa trampas ni alambre.
    const flying = flies(c.creature);
    const cost = flying ? 1 : this.terrainCost(next);
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
        if (!flying && this.stepHazard(c)) return;
      } else {
        c.pos.x += (dx / dist) * budget;
        c.pos.y += (dy / dist) * budget;
        budget = 0;
      }
    }
  }

  /**
   * Al entrar en una casilla con alambre de espino, un saqueador o una criatura se hace un poco de daño
   * (a los colonos, no: saben dónde está). Devuelve true si ha caído (o muerto) y deja de andar.
   */
  private stepHazard(c: Colonist): boolean {
    if (c.role !== 'saqueador' || c.downed) return false;
    const s = this.structures.mainAt(c.tile.x, c.tile.y);
    if (s?.built && s.def.mine) return this.explodeMine(s, c);
    if (s?.built && s.def.stunSeconds) return this.shockTrap(s, c);
    const dmg = s?.built ? s.def.stepDamage : undefined;
    if (!dmg) return false;
    if (!hurtFoe(this, c, dmg, 'las piernas')) return false;
    c.path = [];
    return true;
  }

  /** Botón del puente levadizo: lo alza (en cuanto no hay nadie encima) o lo baja. */
  toggleDrawbridge(s: Structure): boolean {
    return toggleDrawbridge(this, s);
  }

  /**
   * Trampa eléctrica: si tiene corriente, aturde a `by` (no se mueve ni ataca) unos segundos y le para
   * en la casilla. No se gasta. Devuelve true si le ha aturdido.
   */
  shockTrap(s: Structure, by: Colonist): boolean {
    if (!s.powered) return false;
    by.stunnedUntil = this.tick + Math.round(s.def.stunSeconds! * TICKS_PER_SECOND);
    by.path = [];
    by.activity = 'idle';
    this.addLog(`⚡ ${by.name} pisa una ${s.def.name.toLowerCase()} y se queda aturdido.`, 'bueno', 'combate', { x: s.x, y: s.y });
    return true;
  }

  /**
   * Estalla una mina casera que ha pisado `by`: hace daño (× los puños, de media) a cada saqueador o
   * criatura a su alcance (el 3×3), no a los colonos, y se gasta. Devuelve true si `by` ha caído.
   */
  explodeMine(s: Structure, by: Colonist): boolean {
    const m = s.def.mine!;
    this.breakStructure(s);
    this.addLog(`💥 ${by.name} pisa una ${s.def.name.toLowerCase()} y estalla.`, 'bueno', 'combate', { x: s.x, y: s.y });
    let fellBy = false;
    for (const o of [...this.others]) {
      if (o.role !== 'saqueador' || Math.max(Math.abs(o.tile.x - s.x), Math.abs(o.tile.y - s.y)) > m.radius) continue;
      const armor = 1 - armorProtection([o.vest, o.helmet]);
      const fell = hurtFoe(this, o, absorbHit(this, o, MINE_FIST_DAMAGE * m.damage * armor), 'las piernas');
      if (fell) {
        if (o.creature) this.addLog(creatureFallText(o), 'bueno');
        else this.addLog(`${o.name} (saqueador) cae al suelo.`, 'bueno');
      }
      if (o === by && (fell || o.downed)) fellBy = true;
    }
    if (fellBy) by.path = [];
    return fellBy;
  }

  private terrainCost(p: Point): number {
    const cost = tileMoveCost(this.map, p.x, p.y);
    return Number.isFinite(cost) ? cost : 1;
  }
}

