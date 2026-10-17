// Guardar y cargar partidas. El formato lleva versión y se lee de forma tolerante, para que
// una partida guardada siga sirviendo cuando se publica una versión nueva del juego:
// lo que ya no existe se descarta y lo nuevo toma su valor por defecto.
import { SKILLS, Skill, TRAITS } from '../data/colonists';
import { BUILDINGS } from '../data/buildings';
import { CROPS, cropDef } from '../data/crops';
import { TERRAIN_JOBS, TerrainJob } from './terrain';
import { RESOURCES, ResourceId } from '../data/resources';
import { WORK_TYPES, WorkType } from '../data/work';
import { Colonist, DEFAULT_PRIORITY, WorkPriority } from './colonist';
import { GameMap, isPassable } from './map';
import type { StoragePriority } from './zones';
import { GameSpeed, World } from './world';

/** Versión del formato. Súbela solo si un cambio no se puede leer de forma tolerante, y añade la migración. */
export const SAVE_VERSION = 1;

type U8Field = 'terrain' | 'props' | 'contaminated' | 'level' | 'cliff' | 'slope' | 'stock';
type F32Field = 'elevation' | 'moisture' | 'radiation';
const U8_FIELDS: readonly U8Field[] = ['terrain', 'props', 'contaminated', 'level', 'cliff', 'slope', 'stock'];
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
  structures: { def: string; x: number; y: number; built: boolean; delivered: Record<string, number>; progress: number; hp: number; demolish?: boolean }[];
  /** Obras de terreno pendientes (desde que existen). */
  terrain?: { x: number; y: number; job: string }[];
  /** Huertos (desde que existe el cultivo; las partidas anteriores no los tienen). */
  farms?: { id: number; name: string; crop: string; tiles: number[] }[];
  plants?: { i: number; crop: string; growth: number }[];
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
    colonists: world.colonists.map((c) => ({
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
    })),
    items: world.items.list().map((s) => ({ x: s.x, y: s.y, resource: s.resource, amount: s.amount })),
    designations: world.designations.list().map((d) => ({ ...d })),
    zones: world.zones.all().map((z) => ({ id: z.id, name: z.name, priority: z.priority, accepts: { ...z.accepts }, tiles: [...z.tiles] })),
    farms: world.farms.all().map((z) => ({ id: z.id, name: z.name, crop: z.crop.id, tiles: [...z.tiles] })),
    plants: world.farms.plantList().map(({ x, y, plant }) => ({ i: y * m.width + x, crop: plant.crop.id, growth: plant.growth })),
    structures: world.structures.all().map((s) => ({
      def: s.def.id, x: s.x, y: s.y, built: s.built, delivered: { ...s.delivered } as Record<string, number>, progress: s.progress, hp: s.hp,
      demolish: s.demolish || undefined,
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
    world.structures.restore(def, s.x, s.y, !!s.built, delivered, num(s.progress, 0), num(s.hp, def.hp));
    if (s.demolish) world.structures.markDemolish(s.x, s.y);
  }
  for (const sc of d.colonists ?? []) world.colonists.push(restoreColonist(sc));
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
  // Colonos que quedaran sobre una casilla que ya no se pisa se apartan.
  for (const c of world.colonists) {
    if (!isPassable(world.map, c.tile.x, c.tile.y)) world.moveOutOfTheWay(c);
  }
  return world;
}
