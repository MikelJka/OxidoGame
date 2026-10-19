// Guardar y cargar partidas. El formato lleva versión y se lee de forma tolerante, para que
// una partida guardada siga sirviendo cuando se publica una versión nueva del juego:
// lo que ya no existe se descarta y lo nuevo toma su valor por defecto.
import { isCreature } from '../data/creatures';
import { SKILLS, Skill, TRAITS } from '../data/colonists';
import { BUILDINGS } from '../data/buildings';
import { CROPS, cropDef } from '../data/crops';
import { recipeDef } from '../data/recipes';
import { TERRAIN_JOBS, TerrainJob } from './terrain';
import { RESOURCES, ResourceId } from '../data/resources';
import { WORK_TYPES, WorkType } from '../data/work';
import { Colonist, DEFAULT_PRIORITY, STANCES, WorkPriority } from './colonist';
import { GameMap, isPassable } from './map';
import type { StoragePriority } from './zones';
import { ALERT_KINDS, GameSpeed, LogEntry, TICKS_PER_DAY, World } from './world';
import { initialSchedule, makeDifficulty, WANDERER_GAP } from './storyteller';
import { vehicleDef } from '../data/vehicles';
import { isWeapon } from '../data/weapons';
import { ARMORS, isArmor } from '../data/armor';

/** Versión del formato. Súbela solo si un cambio no se puede leer de forma tolerante, y añade la migración. */
export const SAVE_VERSION = 1;

type U8Field = 'terrain' | 'props' | 'contaminated' | 'level' | 'cliff' | 'slope' | 'stock' | 'trench';
type F32Field = 'elevation' | 'moisture' | 'radiation';
const U8_FIELDS: readonly U8Field[] = ['terrain', 'props', 'contaminated', 'level', 'cliff', 'slope', 'stock', 'trench'];
const F32_FIELDS: readonly F32Field[] = ['elevation', 'moisture', 'radiation'];

export interface SaveData {
  format: 'oxido-partida';
  version: number;
  /** Fecha en que se guardó (ISO). */
  savedAt: string;
  /** Versión del juego que la guardó (informativa). */
  gameVersion?: string;
  seed: number;
  tick: number;
  speed: number;
  rng: number;
  map: {
    width: number;
    height: number;
    start: { x: number; y: number };
    u8: Partial<Record<U8Field, string>>;
    f32: Partial<Record<F32Field, string>>;
  };
  colonists: SavedColonist[];
  items: { x: number; y: number; resource: string; amount: number }[];
  designations: { x: number; y: number; job: string }[];
  zones: { id: number; name: string; priority: number; accepts: Record<string, boolean>; tiles: number[] }[];
  structures: { def: string; x: number; y: number; built: boolean; delivered: Record<string, number>; progress: number; hp: number; demolish?: boolean; bill?: { recipe: string; target: number; paused: boolean; mode?: string }; rot?: number; stored?: number; fuel?: number; electric?: boolean; upgrade?: { delivered: Record<string, number>; progress: number }; moveTo?: { x: number; y: number; rot: number } }[];
  /** Obras de terreno pendientes (desde que existen). */
  terrain?: { x: number; y: number; job: string }[];
  /** Huertos (desde que existe el cultivo; las partidas anteriores no los tienen). */
  farms?: { id: number; name: string; crop: string; tiles: number[] }[];
  plants?: { i: number; crop: string; growth: number }[];
  /** Casillas de almacenes y huertos por despejar (#14; las partidas anteriores no las tienen). */
  clearing?: { i: number; kind: string; zone: number; prop: number }[];
  /** Saqueadores, prisioneros y comerciantes (desde que existen). */
  others?: SavedColonist[];
  /** Raids en marcha, para su moral (desde que existe; las anteriores, ninguno). */
  raidGroups?: { id: number; size: number; leaderId: number; escaped: number[]; routed: boolean }[];
  /** `alert` y `at`: avisos en pantalla (desde #17; las partidas anteriores no los tienen). */
  log?: { tick: number; text: string; kind: string; alert?: string; at?: { x: number; y: number } }[];
  graveyard?: { name: string; cause: string; day: number }[];
  gameOver?: { day: number; cause: string } | null;
  offer?: { pawn: SavedColonist; until: number } | null;
  schedule?: { nextWanderer: number; nextRaid: number; nextTrader: number; nextRadio?: number };
  nextPawnId?: number;
  /** Vehículos (desde el buggy, 2026-10-19). Se guardan parados. */
  vehicles?: { id: number; def: string; x: number; y: number; fuel: number; hp: number; facing?: number }[];
  nextVehicleId?: number;
  /** Raids, caravanas y supervivientes activados (por defecto, sí). */
  events?: boolean;
  /** Dureza y días sin raids (desde que existe; las anteriores, Normal). */
  difficulty?: { level?: string; graceDays?: number };
}

interface SavedColonist {
  id: number;
  name: string;
  nickname: string;
  age: number;
  skills: Record<string, number>;
  passions: Record<string, number>;
  traits: string[];
  look: { shirt: number; skin: number; hair: number };
  tile: { x: number; y: number };
  facing: number;
  priorities: Record<string, number>;
  carrying: { resource: string; amount: number } | null;
  drafted?: boolean;
  needs?: { food: number; rest: number; sleptIn: string | null; water?: number; badWaterUntil?: number; lastMeal?: string | null; inLight?: boolean; finishedUntil?: number; sawFinishUntil?: number };
  health?: number;
  wounds?: { part: string; severity: number; bleeding: boolean; treated: boolean; medicine?: boolean; self?: boolean; age?: number; infectRolled?: boolean }[];
  /** Infección (desde las medicinas). */
  infection?: { part: string; dayTicks: number; untreatedDays: number; doses: number; dosedToday: boolean };
  downed?: boolean;
  /** Guarda cama malherido tras un combate (desde 2026-10-19). */
  resting?: boolean;
  /** Asiento en un vehículo (desde el buggy). */
  vehicle?: { id: number; seat: string; boarded: boolean };
  role?: string;
  prisoner?: { resistance: number; mode: string; lastTalk: number };
  raider?: { fleeing: boolean; leaveAt: number; group?: number; leader?: boolean; finish?: boolean };
  /** Criatura (perro mutante…), desde 2026-10-19. */
  creature?: string;
  trader?: { stock: Record<string, number>; slaves: SavedColonist[]; leaveAt: number; leaving: boolean };
  /** Arma, la que prefiere y munición (desde que hay armas). */
  weapon?: string | null;
  weaponChoice?: string;
  ammo?: number;
  vest?: string | null;
  helmet?: string | null;
  armorChoice?: string;
  panic?: { until: number };
  /** Postura del reclutado (desde las posturas). */
  stance?: string;
  attackTarget?: number;
}

/** Postura del reclutado; las partidas antiguas no la tienen. */
function loadStance(s: SavedColonist): Pick<Colonist, 'stance' | 'attackTarget'> {
  const stance = STANCES.find((k) => k === s.stance);
  if (!stance || !s.drafted) return {};
  if (stance === 'atacar') return typeof s.attackTarget === 'number' ? { stance, attackTarget: s.attackTarget } : {};
  return { stance };
}

function savePawn(c: Colonist): SavedColonist {
  return {
    id: c.id,
    name: c.name,
    nickname: c.nickname,
    age: c.age,
    skills: { ...c.skills },
    passions: { ...c.passions },
    traits: c.traits.map((t) => t.id),
    look: { ...c.look },
    tile: { ...c.tile },
    facing: c.facing,
    priorities: { ...c.priorities },
    // Los trabajos en curso no se guardan: al cargar, cada colono busca uno nuevo.
    carrying: c.carrying ? { ...c.carrying } : null,
    drafted: c.drafted,
    needs: { ...c.needs },
    health: c.health,
    wounds: c.wounds.map((w) => ({ ...w })),
    infection: c.infection ? { ...c.infection } : undefined,
    downed: c.downed,
    ...(c.resting ? { resting: true } : {}),
    ...(c.vehicle ? { vehicle: { ...c.vehicle } } : {}),
    role: c.role,
    prisoner: c.prisoner ? { ...c.prisoner } : undefined,
    raider: c.raider ? { ...c.raider } : undefined,
    ...(c.creature ? { creature: c.creature } : {}),
    trader: c.trader
      ? { stock: { ...c.trader.stock } as Record<string, number>, slaves: c.trader.slaves.map(savePawn), leaveAt: c.trader.leaveAt, leaving: c.trader.leaving }
      : undefined,
    weapon: c.weapon,
    weaponChoice: c.weaponChoice,
    ammo: c.ammo,
    vest: c.vest,
    helmet: c.helmet,
    armorChoice: c.armorChoice,
    panic: c.panic ? { ...c.panic } : undefined,
    stance: c.stance,
    attackTarget: c.attackTarget,
  };
}

// --- Codificación de arrays en base64 ------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- Guardar --------------------------------------------------------------------

export function serializeWorld(world: World, gameVersion?: string): SaveData {
  const m = world.map;
  const u8: Partial<Record<U8Field, string>> = {};
  for (const f of U8_FIELDS) u8[f] = bytesToBase64(m[f]);
  const f32: Partial<Record<F32Field, string>> = {};
  for (const f of F32_FIELDS) f32[f] = bytesToBase64(new Uint8Array(m[f].buffer.slice(0)));
  return {
    format: 'oxido-partida',
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    gameVersion,
    seed: m.seed,
    tick: world.tick,
    speed: world.speed,
    rng: world.rng.getState(),
    map: { width: m.width, height: m.height, start: { ...m.start }, u8, f32 },
    colonists: world.colonists.map(savePawn),
    others: world.others.map(savePawn),
    raidGroups: world.raidGroups.map((g) => ({ ...g, escaped: [...g.escaped] })),
    log: world.log.map((l) => ({ ...l })),
    graveyard: world.graveyard.map((g) => ({ ...g })),
    gameOver: world.gameOver ? { ...world.gameOver } : null,
    offer: world.offer ? { pawn: savePawn(world.offer.pawn), until: world.offer.until } : null,
    schedule: { ...world.schedule },
    nextPawnId: world.nextPawnId,
    vehicles: world.vehicles.map((v) => ({ id: v.id, def: v.def, x: v.x, y: v.y, fuel: v.fuel, hp: v.hp, facing: v.facing })),
    nextVehicleId: world.nextVehicleId,
    events: world.eventsEnabled,
    difficulty: { ...world.difficulty },
    items: world.items.list().map((s) => ({ x: s.x, y: s.y, resource: s.resource, amount: s.amount })),
    designations: world.designations.list().map((d) => ({ ...d })),
    zones: world.zones.all().map((z) => ({ id: z.id, name: z.name, priority: z.priority, accepts: { ...z.accepts }, tiles: [...z.tiles] })),
    farms: world.farms.all().map((z) => ({ id: z.id, name: z.name, crop: z.crop.id, tiles: [...z.tiles] })),
    plants: world.farms.plantList().map(({ x, y, plant }) => ({ i: y * m.width + x, crop: plant.crop.id, growth: plant.growth })),
    clearing: world.clearing.list(),
    // Un mueble que alguien lleva en brazos se guarda en su sitio de antes, con la orden de moverlo.
    structures: [...world.structures.all(), ...world.structures.liftedList()].map((s) => ({
      def: s.def.id, x: s.lifted && s.moveFrom ? s.moveFrom.x : s.x, y: s.lifted && s.moveFrom ? s.moveFrom.y : s.y, built: s.built, delivered: { ...s.delivered } as Record<string, number>, progress: s.progress, hp: s.hp,
      demolish: s.demolish || undefined,
      rot: (s.lifted && s.moveFrom ? s.moveFrom.rot : s.rot) || undefined,
      moveTo: s.moveTo ? { ...s.moveTo } : undefined,
      bill: s.bill ? { recipe: s.bill.recipe.id, target: s.bill.target, paused: s.bill.paused, mode: s.bill.mode === 'count' ? 'count' : undefined } : undefined,
      stored: s.stored || undefined,
      fuel: s.fuel || undefined,
      electric: s.electric || undefined,
      upgrade: s.upgrade ? { delivered: { ...s.upgrade.delivered } as Record<string, number>, progress: s.upgrade.progress } : undefined,
    })),
    terrain: world.terrain.list().map((o) => ({ ...o })),
  };
}

// --- Cargar ---------------------------------------------------------------------

const isResource = (r: string): r is ResourceId => (RESOURCES as readonly string[]).includes(r);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Comprueba que un texto u objeto es una partida que esta versión sabe leer. Lanza un error explicado si no. */
export function parseSave(input: string | unknown): SaveData {
  let data: unknown = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      throw new Error('El archivo no es una partida de Óxido (no es JSON)');
    }
  }
  const d = data as SaveData;
  if (!d || d.format !== 'oxido-partida') throw new Error('No es una partida de Óxido');
  if (typeof d.version !== 'number' || d.version < 1) throw new Error('Partida sin versión');
  if (d.version > SAVE_VERSION) throw new Error('La partida es de una versión más nueva del juego; recarga la página para actualizarlo');
  if (!d.map || !(d.map.width > 0) || !(d.map.height > 0) || !d.map.u8?.terrain) throw new Error('La partida no tiene mapa');
  return migrate(d);
}

/** Pasa partidas de formatos antiguos al actual. (De momento solo existe la versión 1.) */
function migrate(d: SaveData): SaveData {
  return d;
}

function restoreMap(d: SaveData): GameMap {
  const { width, height } = d.map;
  const size = width * height;
  const u8 = (f: U8Field): Uint8Array => {
    const b64 = d.map.u8[f];
    if (!b64) return new Uint8Array(size); // campo nuevo: vacío
    const a = base64ToBytes(b64);
    if (a.length !== size) throw new Error(`Mapa dañado (${f})`);
    return a;
  };
  const f32 = (f: F32Field): Float32Array => {
    const b64 = d.map.f32?.[f];
    if (!b64) return new Float32Array(size);
    const a = base64ToBytes(b64);
    if (a.length !== size * 4) throw new Error(`Mapa dañado (${f})`);
    return new Float32Array(a.buffer);
  };
  const map: GameMap = {
    width,
    height,
    seed: num(d.seed, 0),
    terrain: u8('terrain'),
    props: u8('props'),
    elevation: f32('elevation'),
    moisture: f32('moisture'),
    radiation: f32('radiation'),
    contaminated: u8('contaminated'),
    level: u8('level'),
    cliff: u8('cliff'),
    slope: u8('slope'),
    stock: u8('stock'),
    blocked: new Uint8Array(size), // lo rehacen las construcciones al cargarse
    trench: u8('trench'), // las partidas de antes de las zanjas no lo tienen: vacío
    start: { x: num(d.map.start?.x, 0), y: num(d.map.start?.y, 0) },
  };
  return map;
}

function restoreColonist(s: SavedColonist): Colonist {
  const skills = {} as Record<Skill, number>;
  const passions = {} as Record<Skill, 0 | 1 | 2>;
  for (const k of SKILLS) {
    skills[k] = Math.max(0, Math.min(20, num(s.skills?.[k], 0)));
    const p = num(s.passions?.[k], 0);
    passions[k] = (p === 1 || p === 2 ? p : 0) as 0 | 1 | 2;
  }
  const priorities = {} as Record<WorkType, WorkPriority>;
  for (const w of WORK_TYPES) {
    const p = num(s.priorities?.[w], DEFAULT_PRIORITY);
    priorities[w] = (p >= 0 && p <= 4 ? Math.round(p) : DEFAULT_PRIORITY) as WorkPriority;
  }
  const tile = { x: num(s.tile?.x, 0), y: num(s.tile?.y, 0) };
  return {
    id: s.id,
    name: String(s.name ?? 'Superviviente'),
    nickname: String(s.nickname ?? ''),
    age: num(s.age, 30),
    skills,
    passions,
    traits: (s.traits ?? []).map((id) => TRAITS.find((t) => t.id === id)).filter((t) => t !== undefined),
    look: { shirt: num(s.look?.shirt, 0x7a6a5a), skin: num(s.look?.skin, 0xc68e62), hair: num(s.look?.hair, 0x2a1d14) },
    pos: { x: tile.x + 0.5, y: tile.y + 0.5 },
    tile,
    path: [],
    activity: 'idle',
    waitTicks: 30,
    facing: s.facing < 0 ? -1 : 1,
    priorities,
    job: null,
    carrying: null,
    drafted: !!s.drafted,
    health: Math.max(0.01, Math.min(1, num(s.health, 1))),
    wounds: (s.wounds ?? []).map((w) => ({
      part: String(w.part ?? 'el cuerpo'), severity: Math.max(0, Math.min(1, num(w.severity, 0))), bleeding: !!w.bleeding, treated: !!w.treated,
      // Las heridas de partidas antiguas ya no se infectan (no se sabe cuánto llevan abiertas).
      ...(w.medicine ? { medicine: true } : {}), ...(w.self ? { self: true } : {}), age: Math.max(0, num(w.age, 0)), infectRolled: w.age === undefined ? true : !!w.infectRolled,
    })),
    infection: s.infection
      ? {
          part: String(s.infection.part ?? 'el cuerpo'),
          dayTicks: Math.max(0, num(s.infection.dayTicks, 0)),
          untreatedDays: Math.max(0, Math.round(num(s.infection.untreatedDays, 0))),
          doses: Math.max(0, Math.round(num(s.infection.doses, 0))),
          dosedToday: !!s.infection.dosedToday,
        }
      : undefined,
    downed: !!s.downed,
    ...(s.resting ? { resting: true } : {}),
    ...(s.vehicle && (s.vehicle.seat === 'conductor' || s.vehicle.seat === 'tirador')
      ? { vehicle: { id: num(s.vehicle.id, 0), seat: s.vehicle.seat, boarded: !!s.vehicle.boarded } }
      : {}),
    role: (['colono', 'saqueador', 'prisionero', 'comerciante'] as const).find((r) => r === s.role) ?? 'colono',
    prisoner: s.prisoner
      ? {
          resistance: Math.max(0, Math.min(1, num(s.prisoner.resistance, 0.5))),
          mode: (['retener', 'convencer', 'liberar'] as const).find((m) => m === s.prisoner!.mode) ?? 'retener',
          lastTalk: num(s.prisoner.lastTalk, -1e9),
        }
      : undefined,
    raider: s.raider
      ? {
          fleeing: !!s.raider.fleeing,
          leaveAt: num(s.raider.leaveAt, 0),
          ...(s.raider.group !== undefined ? { group: num(s.raider.group, 0) } : {}),
          ...(s.raider.leader ? { leader: true } : {}),
          ...(s.raider.finish ? { finish: true } : {}),
        }
      : undefined,
    ...(isCreature(s.creature) ? { creature: s.creature } : {}),
    trader: s.trader
      ? {
          stock: Object.fromEntries(Object.entries(s.trader.stock ?? {}).filter(([r]) => isResource(r)).map(([r, n]) => [r, Math.max(0, num(n, 0))])),
          slaves: (s.trader.slaves ?? []).map(restoreColonist),
          leaveAt: num(s.trader.leaveAt, 0),
          leaving: !!s.trader.leaving,
        }
      : undefined,
    needs: {
      food: Math.max(0, Math.min(1, num(s.needs?.food, 0.8))),
      water: Math.max(0, Math.min(1, num(s.needs?.water, 0.85))),
      badWaterUntil: Math.max(0, num(s.needs?.badWaterUntil, 0)),
      rest: Math.max(0, Math.min(1, num(s.needs?.rest, 0.85))),
      sleptIn: (['cama', 'suelo', 'habitacion'] as const).find((k) => k === s.needs?.sleptIn) ?? null,
      lastMeal: (['cocinada', 'cruda'] as const).find((k) => k === s.needs?.lastMeal) ?? null,
      // Partidas de antes de la luz: sin lámpara cerca (se recalcula al segundo).
      ...(s.needs?.inLight ? { inLight: true } : {}),
      // Partidas de antes de #22 (segunda parte): sin nada que les pese.
      ...(num(s.needs?.finishedUntil, 0) > 0 ? { finishedUntil: num(s.needs?.finishedUntil, 0) } : {}),
      ...(num(s.needs?.sawFinishUntil, 0) > 0 ? { sawFinishUntil: num(s.needs?.sawFinishUntil, 0) } : {}),
    },
    need: null,
    // Partidas de antes de las armas: sin arma, eligiendo sola la mejor.
    weapon: typeof s.weapon === 'string' && isWeapon(s.weapon) ? s.weapon : null,
    weaponChoice: s.weaponChoice === 'ninguna' || (typeof s.weaponChoice === 'string' && isWeapon(s.weaponChoice)) ? s.weaponChoice : 'auto',
    ammo: Math.max(0, Math.round(num(s.ammo, 0))),
    // Partidas de antes de las armaduras: sin nada puesto, eligiendo sola la mejor.
    vest: typeof s.vest === 'string' && isArmor(s.vest) && ARMORS[s.vest].slot === 'chaleco' ? s.vest : null,
    helmet: typeof s.helmet === 'string' && isArmor(s.helmet) && ARMORS[s.helmet].slot === 'casco' ? s.helmet : null,
    armorChoice: s.armorChoice === 'ninguna' ? 'ninguna' : 'auto',
    // Partidas de antes del pánico: nadie en pánico (al cargar, sin camino: se queda quieto hasta que se le pasa).
    ...(s.panic && typeof s.panic === 'object' ? { panic: { until: num(s.panic.until, 0) } } : {}),
    ...loadStance(s),
  };
}

/** Rehace una partida guardada. */
export function loadWorld(input: string | unknown): World {
  const d = parseSave(input);
  const map = restoreMap(d);
  const world = new World({ seed: map.seed, map });
  world.tick = Math.max(0, Math.floor(num(d.tick, 0)));
  const speed = num(d.speed, 1);
  world.speed = (speed >= 0 && speed <= 3 ? Math.round(speed) : 1) as GameSpeed;
  world.rng.setState(num(d.rng, map.seed));

  // Construcciones primero: deciden qué casillas bloquean.
  for (const s of d.structures ?? []) {
    const def = BUILDINGS.find((b) => b.id === s.def);
    if (!def) continue; // construcción que ya no existe
    const delivered: Partial<Record<ResourceId, number>> = {};
    for (const [r, n] of Object.entries(s.delivered ?? {})) if (isResource(r)) delivered[r] = num(n, 0);
    // En las construcciones terminadas solo cuenta lo que hay dentro de un taller.
    const keep = !s.built || def.category === 'taller' ? delivered : {};
    const restored = world.structures.restore(def, s.x, s.y, !!s.built, keep, num(s.progress, 0), num(s.hp, def.hp), s.rot === 1 ? 1 : 0);
    if (!restored) {
      // Ya no cabe (p. ej. ahora ocupa más casillas): se devuelve su material.
      const back: Partial<Record<ResourceId, number>> = s.built ? { ...def.cost } : { ...delivered };
      for (const [r, n] of Object.entries(back) as [ResourceId, number][]) world.items.drop(s.x, s.y, r, n);
      continue;
    }
    if (s.demolish) world.structures.markDemolish(s.x, s.y);
    // Orden de mover (desde el 2026-10-18): si ya no cabe donde iba, se olvida.
    if (s.moveTo) world.structures.orderMove(restored, num(s.moveTo.x, -1), num(s.moveTo.y, -1), s.moveTo.rot === 1 ? 1 : 0);
    // Electricidad (desde que existe): carga de las baterías y combustible de los generadores.
    if (def.battery) restored.stored = Math.max(0, Math.min(def.battery, num(s.stored, 0)));
    if (def.fuel) restored.fuel = Math.max(0, Math.min(def.fuel.capacity, num(s.fuel, 0)));
    // Talleres electrificados o a medio electrificar (desde 2026-10-18; antes, ninguno).
    if (def.electrify && s.built) {
      if (s.electric) restored.electric = true;
      else if (s.upgrade) {
        const got: Partial<Record<ResourceId, number>> = {};
        for (const [r, n] of Object.entries(s.upgrade.delivered ?? {})) if (isResource(r) && num(n, 0) > 0) got[r] = Math.floor(num(n, 0));
        restored.upgrade = { delivered: got, progress: Math.max(0, num(s.upgrade.progress, 0)) };
      }
    }
    const recipe = s.bill ? recipeDef(String(s.bill.recipe)) : undefined;
    if (restored && recipe && recipe.station === def.id) {
      // El modo «fabricar N» existe desde el 2026-10-18; las órdenes de antes son «hasta tener».
      world.structures.setBill(restored, { recipe, target: Math.max(0, Math.floor(num(s.bill!.target, 10))), paused: !!s.bill!.paused, mode: s.bill!.mode === 'count' ? 'count' : 'until' });
    }
  }
  for (const sc of d.colonists ?? []) world.colonists.push({ ...restoreColonist(sc), role: 'colono' });
  for (const sc of d.others ?? []) {
    const o = restoreColonist(sc);
    if (o.role === 'colono') continue;
    if (o.role === 'prisionero' && !o.prisoner) o.prisoner = { resistance: 0.5, mode: 'retener', lastTalk: -1e9 };
    if (o.role === 'comerciante' && !o.trader) continue;
    world.others.push(o);
  }
  for (const l of d.log ?? []) {
    const kind = (['info', 'bueno', 'malo'] as const).find((k) => k === l.kind) ?? 'info';
    const entry: LogEntry = { tick: num(l.tick, 0), text: String(l.text ?? ''), kind };
    const alert = ALERT_KINDS.find((a) => a === l.alert);
    if (alert) entry.alert = alert;
    if (l.at && Number.isFinite(l.at.x) && Number.isFinite(l.at.y)) entry.at = { x: num(l.at.x, 0), y: num(l.at.y, 0) };
    world.log.push(entry);
  }
  for (const g of d.graveyard ?? []) world.graveyard.push({ name: String(g.name ?? ''), cause: String(g.cause ?? ''), day: num(g.day, 1) });
  world.gameOver = d.gameOver ? { day: num(d.gameOver.day, 1), cause: String(d.gameOver.cause ?? '') } : null;
  if (d.offer?.pawn) world.offer = { kind: 'superviviente', pawn: { ...restoreColonist(d.offer.pawn), role: 'colono' }, until: num(d.offer.until, world.tick) };
  for (const g of d.raidGroups ?? []) {
    world.raidGroups.push({
      id: num(g.id, 0),
      size: Math.max(1, num(g.size, 1)),
      leaderId: num(g.leaderId, 0),
      escaped: Array.isArray(g.escaped) ? g.escaped.map((e) => num(e, 0)) : [],
      routed: !!g.routed,
    });
  }
  // Partidas de antes del narrador: los sucesos empiezan a contar desde ahora.
  world.schedule = d.schedule
    ? {
        nextWanderer: num(d.schedule.nextWanderer, 0), nextRaid: num(d.schedule.nextRaid, 0), nextTrader: num(d.schedule.nextTrader, 0),
        ...(d.schedule.nextRadio !== undefined ? { nextRadio: num(d.schedule.nextRadio, 0) } : {}),
      }
    : initialSchedule(TICKS_PER_DAY, world.tick);
  // #21 A: en partidas guardadas con la espera antigua (4-8 días), el próximo superviviente
  // no tarda más que la espera nueva más larga.
  world.schedule.nextWanderer = Math.min(world.schedule.nextWanderer, world.tick + Math.round(WANDERER_GAP[1] * TICKS_PER_DAY));
  const ids = [...world.colonists, ...world.others, ...world.others.flatMap((o) => o.trader?.slaves ?? []), ...(world.offer ? [world.offer.pawn] : [])].map((c) => c.id);
  world.eventsEnabled = d.events !== false;
  world.bringHomeStranded(); // #12: supervivientes que se quedaron en la esquina (0, 0)
  world.difficulty = makeDifficulty(d.difficulty);
  world.nextPawnId = Math.max(num(d.nextPawnId, 1), ...ids.map((i) => i + 1), 1);
  for (const v of d.vehicles ?? []) {
    const def = vehicleDef(String(v.def));
    if (!def) continue;
    const x = Math.round(num(v.x, 0));
    const y = Math.round(num(v.y, 0));
    world.vehicles.push({
      id: num(v.id, 0), def: def.id, x, y, pos: { x, y }, path: [],
      fuel: Math.max(0, Math.min(def.fuelCapacity, num(v.fuel, 0))), hp: Math.max(1, Math.min(def.hp, num(v.hp, def.hp))), facing: v.facing === -1 ? -1 : 1,
    });
  }
  world.nextVehicleId = Math.max(num(d.nextVehicleId, 1), ...world.vehicles.map((v) => v.id + 1), 1);
  // Asientos de vehículos que ya no existen: fuera.
  for (const c of world.pawns()) if (c.vehicle && !world.vehicle(c.vehicle.id)) delete c.vehicle;
  for (const it of d.items ?? []) {
    if (!isResource(it.resource)) continue;
    // En su casilla; si ya no cabe ahí (p. ej. ahora hay un muro), al lado.
    const left = world.items.addAt(it.x, it.y, it.resource, num(it.amount, 0));
    if (left > 0) world.items.drop(it.x, it.y, it.resource, left);
  }
  // Lo que llevaban encima se deja en el suelo, a sus pies.
  for (const sc of d.colonists ?? []) {
    const r = sc.carrying?.resource;
    if (r && isResource(r)) world.items.drop(sc.tile.x, sc.tile.y, r, num(sc.carrying!.amount, 0));
  }
  for (const des of d.designations ?? []) {
    if (des.job === 'talar' || des.job === 'minar' || des.job === 'saquear') world.designations.add(des.x, des.y, des.job);
  }
  for (const z of d.zones ?? []) {
    const p = num(z.priority, 2);
    const priority = (p >= 1 && p <= 4 ? Math.round(p) : 2) as StoragePriority;
    const accepts: Partial<Record<ResourceId, boolean>> = {};
    for (const [r, v] of Object.entries(z.accepts ?? {})) if (isResource(r)) accepts[r] = !!v;
    world.zones.restore({ id: num(z.id, 1), name: String(z.name ?? 'Almacén'), priority, accepts, tiles: z.tiles ?? [] });
  }
  for (const o of d.terrain ?? []) {
    if ((TERRAIN_JOBS as readonly string[]).includes(o.job)) {
      world.terrain.add(o.x, o.y, o.job as TerrainJob, !!world.structures.at(o.x, o.y));
    }
  }
  for (const f of d.farms ?? []) {
    const crop = cropDef(String(f.crop)) ?? CROPS[0];
    world.farms.restore({ id: num(f.id, 1), name: String(f.name ?? 'Huerto'), crop, tiles: f.tiles ?? [] });
  }
  for (const p of d.plants ?? []) {
    const crop = cropDef(String(p.crop));
    if (crop) world.farms.restorePlant(num(p.i, -1), crop, num(p.growth, 0));
  }
  for (const c of d.clearing ?? []) {
    if (c.kind !== 'almacen' && c.kind !== 'huerto') continue;
    world.clearing.restore(num(c.i, -1), { kind: c.kind, zone: num(c.zone, 0), prop: num(c.prop, 0) });
  }
  // Colonos que quedaran sobre una casilla que ya no se pisa se apartan.
  for (const c of world.colonists) {
    if (!isPassable(world.map, c.tile.x, c.tile.y)) world.moveOutOfTheWay(c);
  }
  return world;
}
