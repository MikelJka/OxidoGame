import { Rng } from './rng';
import { ValueNoise } from './noise';
import { AmountRange, HarvestJob, ResourceId } from '../data/resources';
import { RUBBLE_MEDICINE } from '../data/medicine';

/**
 * Suelo de cada casilla. Es la capa base: pocos tipos, con transiciones suaves al dibujar.
 * La variedad del mapa viene de los objetos (Prop) colocados encima.
 */
export enum Terrain {
  DeepWater = 0,
  Water = 1,
  ShallowWater = 2,
  Sand = 3,
  Soil = 4,
  Gravel = 5,
  Rock = 6,
  Concrete = 7,
}

export interface TerrainInfo {
  name: string;
  walkable: boolean;
  buildable: boolean;
  /** Multiplicador de coste de movimiento (1 = normal). */
  moveCost: number;
}

export const TERRAIN_INFO: Record<Terrain, TerrainInfo> = {
  [Terrain.DeepWater]: { name: 'Agua profunda', walkable: false, buildable: false, moveCost: Infinity },
  [Terrain.Water]: { name: 'Agua', walkable: false, buildable: false, moveCost: Infinity },
  [Terrain.ShallowWater]: { name: 'Agua poco profunda', walkable: true, buildable: false, moveCost: 3 },
  [Terrain.Sand]: { name: 'Arena', walkable: true, buildable: true, moveCost: 1.2 },
  [Terrain.Soil]: { name: 'Tierra', walkable: true, buildable: true, moveCost: 1 },
  [Terrain.Gravel]: { name: 'Pedregal', walkable: true, buildable: true, moveCost: 1.3 },
  [Terrain.Rock]: { name: 'Roca', walkable: false, buildable: false, moveCost: Infinity },
  [Terrain.Concrete]: { name: 'Asfalto viejo', walkable: true, buildable: true, moveCost: 0.9 },
};

/** Objetos colocados sobre el suelo. */
export enum Prop {
  None = 0,
  DeadTree = 1,
  Stump = 2,
  Bush = 3,
  Boulder = 4,
  Stones = 5,
  ScrapPile = 6,
  CarWreck = 7,
  RuinWall = 8,
  Rubble = 9,
  ToxicBarrel = 10,
  GlowPuddle = 11,
  Spring = 12,
  Bones = 13,
  Tires = 14,
}

/** Cómo se aprovecha un objeto del mapa: qué da, cuánto trabajo cuesta y qué deja. */
export interface HarvestInfo {
  job: HarvestJob;
  resource: ResourceId;
  /** Unidades del recurso que tiene el objeto al generarse el mapa. */
  amount: AmountRange;
  /** Ticks de trabajo de un colono normal para terminarlo. */
  work: number;
  /** Objeto que queda en la casilla al terminar (None = nada). */
  leaves: Prop;
  /** Recurso extra que puede salir (p. ej. componentes al desguazar un coche). */
  bonus?: { resource: ResourceId; amount: AmountRange };
  /** Hallazgo que sale solo a veces (p. ej. 💊 entre los escombros). */
  find?: { resource: ResourceId; chance: number; amount: AmountRange };
}

export interface PropInfo {
  name: string;
  /** Impide el paso. */
  blocks: boolean;
  /** Multiplicador de coste al atravesarlo (si no bloquea). */
  moveCost: number;
  /** Recurso que se obtiene de él, si se puede aprovechar. */
  harvest?: HarvestInfo;
}

export const PROP_INFO: Record<Prop, PropInfo> = {
  [Prop.None]: { name: '', blocks: false, moveCost: 1 },
  [Prop.DeadTree]: {
    name: 'Árbol seco', blocks: true, moveCost: 1,
    harvest: { job: 'talar', resource: 'madera', amount: [15, 30], work: 300, leaves: Prop.Stump },
  },
  [Prop.Stump]: {
    name: 'Tocón', blocks: false, moveCost: 1.3,
    harvest: { job: 'talar', resource: 'madera', amount: [4, 8], work: 120, leaves: Prop.None },
  },
  [Prop.Bush]: {
    name: 'Matorral', blocks: false, moveCost: 1.6,
    harvest: { job: 'talar', resource: 'madera', amount: [1, 3], work: 60, leaves: Prop.None },
  },
  [Prop.Boulder]: {
    name: 'Roca grande', blocks: true, moveCost: 1,
    harvest: { job: 'minar', resource: 'piedra', amount: [20, 35], work: 450, leaves: Prop.Stones },
  },
  [Prop.Stones]: {
    name: 'Piedras', blocks: false, moveCost: 1.3,
    harvest: { job: 'minar', resource: 'piedra', amount: [5, 10], work: 150, leaves: Prop.None },
  },
  [Prop.ScrapPile]: {
    name: 'Montón de chatarra', blocks: true, moveCost: 1,
    harvest: {
      job: 'saquear', resource: 'chatarra', amount: [15, 30], work: 300, leaves: Prop.None,
      bonus: { resource: 'componentes', amount: [0, 2] },
    },
  },
  [Prop.CarWreck]: {
    name: 'Coche abandonado', blocks: true, moveCost: 1,
    harvest: {
      job: 'saquear', resource: 'chatarra', amount: [30, 50], work: 600, leaves: Prop.None,
      bonus: { resource: 'componentes', amount: [1, 4] },
    },
  },
  [Prop.RuinWall]: {
    name: 'Muro derruido', blocks: true, moveCost: 1,
    harvest: { job: 'minar', resource: 'piedra', amount: [10, 20], work: 400, leaves: Prop.Rubble },
  },
  [Prop.Rubble]: {
    name: 'Escombros', blocks: false, moveCost: 1.5,
    harvest: {
      job: 'saquear', resource: 'chatarra', amount: [3, 8], work: 120, leaves: Prop.None,
      find: { resource: 'medicina', chance: RUBBLE_MEDICINE.chance, amount: RUBBLE_MEDICINE.amount },
    },
  },
  [Prop.ToxicBarrel]: { name: 'Barril tóxico', blocks: true, moveCost: 1 },
  [Prop.GlowPuddle]: { name: 'Charco radiactivo', blocks: false, moveCost: 1.2 },
  [Prop.Spring]: { name: 'Manantial', blocks: true, moveCost: 1 },
  [Prop.Bones]: { name: 'Huesos', blocks: false, moveCost: 1 },
  [Prop.Tires]: {
    name: 'Neumáticos', blocks: false, moveCost: 1.4,
    harvest: { job: 'saquear', resource: 'chatarra', amount: [2, 5], work: 90, leaves: Prop.None },
  },
};

export interface MapOptions {
  width: number;
  height: number;
  seed: number;
}

export interface GameMap {
  width: number;
  height: number;
  seed: number;
  terrain: Uint8Array;
  props: Uint8Array;
  /** Elevación 0..1 por casilla (ventaja defensiva y pozos más adelante). */
  elevation: Float32Array;
  /** Humedad 0..1 (afecta al color del suelo y a la vegetación). */
  moisture: Float32Array;
  /** Radiación 0..1 (tinte del suelo, barriles y charcos; salud más adelante). */
  radiation: Float32Array;
  /** 1 si el agua de la casilla está contaminada. */
  contaminated: Uint8Array;
  /** Nivel de altura en terrazas: 0 agua, 1–4 tierra (más alto = mejor defensa y vista). */
  level: Uint8Array;
  /** 1 si la casilla es un acantilado: borde alto de un desnivel, no se puede pisar. */
  cliff: Uint8Array;
  /** 1 si la casilla es una pendiente entre dos niveles: se cruza, pero más despacio. */
  slope: Uint8Array;
  /** Unidades de recurso que quedan en el objeto de cada casilla (0 si no tiene). */
  stock: Uint8Array;
  /** Construcción en la casilla: 0 nada, 1 impide el paso (muro…), ≥2 se pisa con otro coste (ver `walkableStructureCode`). Lo mantiene `Structures`. */
  blocked: Uint8Array;
  /** 1 si hay un puente terminado: el agua se cruza andando, como suelo normal. Lo mantiene `Structures`. */
  bridge: Uint8Array;
  /** Zanja: 0 nada, 1 seca (se cruza muy despacio, frena a los enemigos), 2 inundada (foso con agua: no se cruza andando). */
  trench: Uint8Array;
  /** Casilla sugerida para empezar la colonia. */
  start: { x: number; y: number };
}

/** Nivel de radiación a partir del cual una casilla se considera irradiada. */
export const RADIATION_THRESHOLD = 0.78;
/** Nivel de altura máximo. */
export const MAX_LEVEL = 4;
/** Coste extra de subir o bajar por una pendiente. */
export const SLOPE_COST = 1.5;
/** Coste extra de cruzar una zanja. */
export const TRENCH_COST = 4;
/** Valor de `trench` de una zanja seca. */
export const TRENCH_DRY = 1;
/** Valor de `trench` de una zanja inundada (foso con agua, con «Hidráulica»): solo se cruza por un puente. */
export const TRENCH_FLOODED = 2;

/** La casilla es un foso con agua: una zanja inundada. */
export function isFlooded(map: GameMap, i: number): boolean {
  return map.trench[i] === TRENCH_FLOODED;
}
/**
 * Valores de `blocked`: 0 nada, 1 construcción que impide el paso; desde 2, construcción que se
 * pisa y cambia el coste de paso: el valor guarda ese coste (×10 + 1), p. ej. 14 = ×1,3 (puerta),
 * 9 = ×0,8 (suelo), 21 = ×2 (barricada).
 */
export const BLOCK_SOLID = 1;
/** Código de `blocked` para una construcción transitable con un coste de paso dado. */
export function walkableStructureCode(moveCost: number): number {
  return Math.max(2, Math.min(255, Math.round(moveCost * 10) + 1));
}
/** Coste de paso que guarda un código de `blocked` (1 si no hay construcción transitable). */
export function structureMoveCost(code: number): number {
  return code >= 2 ? (code - 1) / 10 : 1;
}
const LEVEL_NAMES = ['', 'llano bajo', 'llano', 'loma', 'meseta'];

export function index(map: { width: number }, x: number, y: number): number {
  return y * map.width + x;
}

export function inBounds(map: { width: number; height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function terrainAt(map: GameMap, x: number, y: number): Terrain {
  return map.terrain[index(map, x, y)] as Terrain;
}

export function propAt(map: GameMap, x: number, y: number): Prop {
  return map.props[index(map, x, y)] as Prop;
}

export function isWater(t: Terrain): boolean {
  return t === Terrain.DeepWater || t === Terrain.Water || t === Terrain.ShallowWater;
}

/** Se puede caminar: suelo transitable y sin objeto que bloquee. */
export function isPassable(map: GameMap, x: number, y: number): boolean {
  if (!inBounds(map, x, y)) return false;
  const i = index(map, x, y);
  // Un foso con agua solo se cruza por un puente (o un puente levadizo bajado).
  if (map.trench[i] === TRENCH_FLOODED && map.bridge[i] !== 1) return false;
  return (TERRAIN_INFO[map.terrain[i] as Terrain].walkable || map.bridge[i] === 1) && !PROP_INFO[map.props[i] as Prop].blocks && !map.cliff[i] && map.blocked[i] !== BLOCK_SOLID;
}

/** Coste de pisar la casilla (suelo × objeto). Infinity si no se puede. */
export function tileMoveCost(map: GameMap, x: number, y: number): number {
  const i = index(map, x, y);
  const prop = PROP_INFO[map.props[i] as Prop];
  if (prop.blocks || map.cliff[i] || map.blocked[i] === BLOCK_SOLID) return Infinity;
  if (map.trench[i] === TRENCH_FLOODED && !map.bridge[i]) return Infinity;
  const built = structureMoveCost(map.blocked[i]);
  // Sobre un puente, el foso con agua se cruza como suelo normal.
  const trench = map.trench[i] && !(map.bridge[i] && map.trench[i] === TRENCH_FLOODED) ? TRENCH_COST : 1;
  // Sobre un puente el agua se anda como suelo normal.
  const ground = map.bridge[i] ? 1 : TERRAIN_INFO[map.terrain[i] as Terrain].moveCost;
  return ground * prop.moveCost * (map.slope[i] ? SLOPE_COST : 1) * built * trench;
}

/** Texto descriptivo de una casilla para la interfaz. */
export function describeTile(map: GameMap, x: number, y: number): string {
  const i = index(map, x, y);
  const t = map.terrain[i] as Terrain;
  const parts = [TERRAIN_INFO[t].name];
  if (isWater(t) && map.contaminated[i]) parts[0] += ' contaminada';
  if (map.cliff[i]) parts.unshift('Acantilado');
  if (map.trench[i]) parts.unshift(map.trench[i] === TRENCH_FLOODED ? 'Foso con agua' : 'Zanja');
  else if (map.slope[i]) parts.push('pendiente');
  if (!isWater(t)) parts.push(LEVEL_NAMES[map.level[i]] ?? '');
  const p = map.props[i] as Prop;
  if (p !== Prop.None) {
    const h = PROP_INFO[p].harvest;
    parts.unshift(h && map.stock[i] > 0 ? `${PROP_INFO[p].name} (${h.resource} ${map.stock[i]})` : PROP_INFO[p].name);
  }
  if (!isWater(t) && map.radiation[i] > RADIATION_THRESHOLD) parts.push('irradiado');
  return parts.filter(Boolean).join(' · ');
}

/** Genera un mapa determinista a partir de una semilla. */
export function generateMap(opts: MapOptions): GameMap {
  const { width, height, seed } = opts;
  const rng = new Rng(seed);
  const elevNoise = new ValueNoise(rng);
  const moistNoise = new ValueNoise(rng);
  const radNoise = new ValueNoise(rng);
  const detailNoise = new ValueNoise(rng);
  const cliffNoise = new ValueNoise(rng);

  const size = width * height;
  const map: GameMap = {
    width,
    height,
    seed,
    terrain: new Uint8Array(size),
    props: new Uint8Array(size),
    elevation: new Float32Array(size),
    moisture: new Float32Array(size),
    radiation: new Float32Array(size),
    contaminated: new Uint8Array(size),
    level: new Uint8Array(size),
    cliff: new Uint8Array(size),
    slope: new Uint8Array(size),
    stock: new Uint8Array(size),
    blocked: new Uint8Array(size),
    bridge: new Uint8Array(size),
    trench: new Uint8Array(size),
    start: { x: 0, y: 0 },
  };
  const { terrain, elevation, moisture, radiation } = map;

  // 1. Campos continuos de ruido.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      elevation[i] = elevNoise.fbm(x / 22, y / 22, 5, 0.5);
      moisture[i] = moistNoise.fbm(x / 14, y / 14, 3, 0.5);
      radiation[i] = radNoise.fbm(x / 26, y / 26, 3, 0.55);
    }
  }
  normalize(elevation);
  normalize(moisture);
  normalize(radiation);

  // 2. Suelo según la elevación.
  for (let i = 0; i < size; i++) {
    const e = elevation[i];
    let t: Terrain;
    if (e < 0.16) t = Terrain.DeepWater;
    else if (e < 0.22) t = Terrain.Water;
    else if (e < 0.25) t = Terrain.ShallowWater;
    else if (e < 0.29) t = Terrain.Sand;
    else if (e > 0.88) t = Terrain.Rock;
    else if (e > 0.74) t = Terrain.Gravel;
    else t = Terrain.Soil;
    terrain[i] = t;
  }

  // 3. Ríos que cruzan el mapa.
  const riverCount = rng.int(1, 2);
  for (let r = 0; r < riverCount; r++) carveRiver(map, rng, elevNoise);

  // 4. Agua contaminada en zonas con radiación.
  for (let i = 0; i < size; i++) {
    if (isWater(terrain[i] as Terrain) && radiation[i] > 0.6) map.contaminated[i] = 1;
  }

  // 5. Terrazas de altura (ya con los ríos excavados).
  assignLevels(map);

  // 6. Carreteras viejas y ruinas a sus lados.
  const roads = carveRoads(map, rng, detailNoise);
  placeRuins(map, rng, roads);

  // 7. Acantilados y pendientes en los desniveles (las carreteras siempre son rampa).
  markCliffs(map, cliffNoise);

  // 8. Objetos naturales y restos dispersos.
  scatterProps(map, rng, detailNoise);

  // 9. Manantiales: agua limpia en terreno alto.
  placeSprings(map, rng);

  map.start = findStart(map);
  clearAround(map, map.start.x, map.start.y, 3);
  // 10. Pasos estrechos: abre los acantilados que dejen zonas aisladas del inicio.
  openPasses(map);
  // 11. Vados: si el agua separa una zona grande del inicio, se abre un vado por el tramo más corto.
  if (openFords(map)) openPasses(map);
  // 12. Recursos de cada objeto aprovechable (con su propia semilla: no altera lo anterior).
  fillStock(map, new Rng(seed ^ 0x6b3a91c5));
  return map;
}

/** Unidades iniciales de recurso de un objeto (0 si no se aprovecha). */
export function rollStock(prop: Prop, rng: Rng): number {
  const h = PROP_INFO[prop].harvest;
  return h ? rng.int(h.amount[0], h.amount[1]) : 0;
}

function fillStock(map: GameMap, rng: Rng): void {
  for (let i = 0; i < map.props.length; i++) map.stock[i] = rollStock(map.props[i] as Prop, rng);
}

/** Zonas a pie de al menos este tamaño deben poder alcanzarse desde el inicio. */
const MIN_CONNECTED_REGION = 250;

function openFords(map: GameMap): boolean {
  const { width, height, terrain } = map;
  const size = width * height;
  let changed = false;
  for (let iter = 0; iter < 8; iter++) {
    const reached = reachableFrom(map, map.start.x, map.start.y);
    // Zonas grandes sin conectar.
    const target = new Uint8Array(size);
    const seen = new Uint8Array(size);
    let any = false;
    for (let i = 0; i < size; i++) {
      if (reached[i] || seen[i]) continue;
      const x = i % width;
      const y = (i - x) / width;
      if (!isPassable(map, x, y)) continue;
      const region = reachableFrom(map, x, y);
      let n = 0;
      for (let j = 0; j < size; j++) if (region[j]) n++;
      for (let j = 0; j < size; j++) {
        if (!region[j]) continue;
        seen[j] = 1;
        if (n >= MIN_CONNECTED_REGION) {
          target[j] = 1;
          any = true;
        }
      }
    }
    if (!any) return changed;

    // BFS por el agua desde la zona alcanzada hasta la primera casilla de una zona objetivo.
    const prev = new Int32Array(size).fill(-1);
    const queue: number[] = [];
    for (let i = 0; i < size; i++) if (reached[i]) queue.push(i);
    const visited = Uint8Array.from(reached);
    let hit = -1;
    for (let head = 0; head < queue.length && hit < 0; head++) {
      const i = queue[head];
      const x = i % width;
      const y = (i - x) / width;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (!inBounds(map, nx, ny)) continue;
        const j = ny * width + nx;
        if (visited[j]) continue;
        if (target[j]) {
          prev[j] = i;
          hit = j;
          break;
        }
        if (!isWater(terrain[j] as Terrain)) continue;
        visited[j] = 1;
        prev[j] = i;
        queue.push(j);
      }
    }
    if (hit < 0) return changed;
    for (let k = prev[hit]; k >= 0 && !reached[k]; k = prev[k]) {
      terrain[k] = Terrain.ShallowWater;
      map.level[k] = 1;
      map.props[k] = Prop.None;
      changed = true;
    }
  }
  return changed;
}

/** Nivel de altura de una casilla de tierra según su elevación. */
export function levelForElevation(e: number): number {
  if (e < 0.40) return 1;
  if (e < 0.60) return 2;
  if (e < 0.76) return 3;
  return MAX_LEVEL;
}

/** Radio (en casillas) del suavizado de la elevación antes de repartirla en niveles. */
const LEVEL_BLUR_RADIUS = 5;
/** Superficie mínima (en casillas) de una zona llana: las más pequeñas se igualan con su entorno. */
export const MIN_FLAT_AREA = 40;

/**
 * Niveles de altura. Se calculan sobre la elevación suavizada para que haya llanos amplios donde
 * construir, y las manchas de un mismo nivel demasiado pequeñas se funden con el nivel de alrededor.
 */
function assignLevels(map: GameMap): void {
  const { width, height, level, terrain } = map;
  const smooth = blur(blur(map.elevation, width, height, LEVEL_BLUR_RADIUS), width, height, LEVEL_BLUR_RADIUS);
  // Casillas cuyo nivel viene impuesto por el agua: no se mueven al suavizar.
  const fixed = new Uint8Array(level.length);
  for (let i = 0; i < level.length; i++) {
    const t = terrain[i] as Terrain;
    if (isWater(t) && t !== Terrain.ShallowWater) {
      level[i] = 0;
      fixed[i] = 1;
    } else if (t === Terrain.ShallowWater || t === Terrain.Sand) {
      // Los vados y orillas del río quedan al nivel del agua más baja posible.
      level[i] = 1;
      fixed[i] = 1;
    } else {
      level[i] = levelForElevation(smooth[i]);
    }
  }
  mergeSmallFlats(map, fixed);
}

/** Media de cada casilla con sus vecinas en un cuadrado de radio `r` (por filas y columnas). */
function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) {
        sum += src[y * w + k];
        n++;
      }
      tmp[y * w + x] = sum / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) {
        sum += tmp[k * w + x];
        n++;
      }
      out[y * w + x] = sum / n;
    }
  }
  return out;
}

/** Funde con el nivel vecino más común las zonas de tierra de un mismo nivel menores que MIN_FLAT_AREA. */
function mergeSmallFlats(map: GameMap, fixed: Uint8Array): void {
  const { width, height, level } = map;
  for (let pass = 0; pass < 6; pass++) {
    const region = new Int32Array(level.length).fill(-1);
    let changed = false;
    for (let s = 0; s < level.length; s++) {
      if (level[s] === 0 || region[s] >= 0) continue;
      const cells: number[] = [];
      const stack = [s];
      region[s] = s;
      let locked = false;
      const around = new Map<number, number>();
      while (stack.length) {
        const i = stack.pop()!;
        cells.push(i);
        if (fixed[i]) locked = true;
        const x = i % width;
        const y = (i - x) / width;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (level[j] === level[s]) {
            if (region[j] < 0) {
              region[j] = s;
              stack.push(j);
            }
          } else if (level[j] > 0) {
            around.set(level[j], (around.get(level[j]) ?? 0) + 1);
          }
        }
      }
      if (locked || cells.length >= MIN_FLAT_AREA || around.size === 0) continue;
      let best = 0;
      let bestCount = -1;
      for (const [l, n] of around) {
        if (n > bestCount || (n === bestCount && Math.abs(l - level[s]) < Math.abs(best - level[s]))) {
          best = l;
          bestCount = n;
        }
      }
      for (const i of cells) level[i] = best;
      changed = true;
    }
    if (!changed) break;
  }
}

/** Marca acantilados (borde alto de un desnivel) y pendientes. */
function markCliffs(map: GameMap, noise: ValueNoise): void {
  const { width, height, level, terrain, cliff, slope, props } = map;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (level[i] <= 1) continue;
      let drop = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(map, nx, ny)) continue;
        const j = ny * width + nx;
        if (level[j] > 0 && level[j] < level[i]) drop = Math.max(drop, level[i] - level[j]);
      }
      if (drop === 0) continue;
      const t = terrain[i] as Terrain;
      // Tramos largos de acantilado con huecos de pendiente; los saltos dobles casi siempre son acantilado.
      const steep = noise.fbm(x / 11, y / 11, 2, 0.5) + (drop > 1 ? 0.25 : 0) + (level[i] >= 3 ? 0.08 : 0);
      if (t !== Terrain.Concrete && t !== Terrain.Rock && steep > 0.5) {
        cliff[i] = 1;
        props[i] = Prop.None;
      } else if (t !== Terrain.Rock) {
        slope[i] = 1;
      }
    }
  }
}

/**
 * Garantiza que todo el terreno transitable que solo queda aislado por acantilados se pueda
 * alcanzar desde el inicio, abriendo un paso estrecho (una casilla de pendiente) cada vez.
 */
function openPasses(map: GameMap): void {
  const { width, height, cliff, slope } = map;
  for (let iter = 0; iter < 400; iter++) {
    const reached = reachableFrom(map, map.start.x, map.start.y);
    let opened = -1;
    for (let y = 0; y < height && opened < 0; y++) {
      for (let x = 0; x < width && opened < 0; x++) {
        const i = y * width + x;
        if (!cliff[i]) continue;
        let touchesReached = false;
        let touchesOther = false;
        for (const [jx, jy] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (!isPassable(map, jx, jy)) continue;
          const j = jy * width + jx;
          if (reached[j]) touchesReached = true;
          else touchesOther = true;
        }
        if (touchesReached && touchesOther) opened = i;
      }
    }
    if (opened < 0) return;
    cliff[opened] = 0;
    slope[opened] = 1;
  }
}

/** Casillas alcanzables a pie desde (x, y), contando como mucho hasta `limit`. */
export function countReachable(map: GameMap, x: number, y: number, limit: number): number {
  if (!isPassable(map, x, y)) return 0;
  const seen = new Set<number>([y * map.width + x]);
  const queue = [[x, y]];
  for (let head = 0; head < queue.length && seen.size < limit; head++) {
    const [cx, cy] = queue[head];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = ny * map.width + nx;
      if (seen.has(k) || !isPassable(map, nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen.size;
}

/** Casillas alcanzables a pie (4 direcciones) desde (sx, sy). */
export function reachableFrom(map: GameMap, sx: number, sy: number): Uint8Array {
  const { width } = map;
  const seen = new Uint8Array(map.terrain.length);
  if (!isPassable(map, sx, sy)) return seen;
  const queue = [sy * width + sx];
  seen[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % width;
    const y = (i - x) / width;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (!isPassable(map, nx, ny)) continue;
      const j = ny * width + nx;
      if (seen[j]) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return seen;
}

function normalize(field: Float32Array): void {
  let min = Infinity;
  let max = -Infinity;
  for (const v of field) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - min) / span;
}

function carveRiver(map: GameMap, rng: Rng, noise: ValueNoise): void {
  const { width, height, terrain, elevation } = map;
  const vertical = rng.chance(0.5);
  const length = vertical ? height : width;
  const span = vertical ? width : height;
  const base = rng.range(span * 0.2, span * 0.8);
  const amplitude = rng.range(span * 0.12, span * 0.25);
  const offset = rng.range(0, 1000);
  const halfWidth = rng.range(1, 2.2);
  // Vados: tramos poco profundos que se pueden cruzar a pie antes de tener puentes.
  const fords = Array.from({ length: rng.int(2, 3) }, () => rng.int(5, length - 6));

  for (let s = 0; s < length; s++) {
    const isFord = fords.some((f) => Math.abs(f - s) <= 1);
    const center = base + (noise.fbm(s / 30 + offset, offset, 3, 0.5) - 0.5) * 2 * amplitude;
    const w = halfWidth + noise.sample(s / 10, offset + 7) * 1.2;
    for (let d = Math.floor(center - w - 1); d <= Math.ceil(center + w + 1); d++) {
      if (d < 0 || d >= span) continue;
      const x = vertical ? d : s;
      const y = vertical ? s : d;
      const i = y * width + x;
      const dist = Math.abs(d - center);
      if (terrain[i] === Terrain.Rock && dist > w * 0.5) continue; // cañón entre rocas
      if (dist <= w && isFord) {
        terrain[i] = Terrain.ShallowWater;
      } else if (dist <= w * 0.6) {
        terrain[i] = Terrain.Water;
        elevation[i] = Math.min(elevation[i], 0.2);
      } else if (dist <= w) {
        if (terrain[i] !== Terrain.Water && terrain[i] !== Terrain.DeepWater) terrain[i] = Terrain.ShallowWater;
      } else if (terrain[i] === Terrain.Soil || terrain[i] === Terrain.Gravel) {
        terrain[i] = Terrain.Sand;
      }
    }
  }
}

/** Una o dos carreteras viejas, rectas con ligeras curvas. Devuelve sus casillas. */
function carveRoads(map: GameMap, rng: Rng, noise: ValueNoise): number[] {
  const { width, height, terrain } = map;
  const cells: number[] = [];
  const count = rng.int(1, 2);
  for (let r = 0; r < count; r++) {
    const vertical = rng.chance(0.5);
    const length = vertical ? height : width;
    const span = vertical ? width : height;
    const base = rng.range(span * 0.25, span * 0.75);
    const offset = rng.range(0, 1000);
    let broken = 0;
    for (let s = 0; s < length; s++) {
      const center = Math.round(base + (noise.fbm(s / 50 + offset, offset, 2, 0.5) - 0.5) * span * 0.3);
      // Tramos de asfalto desaparecidos.
      if (broken > 0) {
        broken--;
        continue;
      }
      if (rng.chance(0.02)) broken = rng.int(2, 6);
      for (let d = center - 1; d <= center + 1; d++) {
        if (d < 0 || d >= span) continue;
        const x = vertical ? d : s;
        const y = vertical ? s : d;
        const i = y * width + x;
        const t = terrain[i] as Terrain;
        if (t === Terrain.Soil || t === Terrain.Sand || t === Terrain.Gravel) {
          // Bordes desgastados.
          if (d !== center && rng.chance(0.25)) continue;
          terrain[i] = Terrain.Concrete;
          cells.push(i);
        }
      }
    }
  }
  return cells;
}

function placeRuins(map: GameMap, rng: Rng, roadCells: number[]): void {
  const { width, height, terrain, props } = map;
  const buildings = rng.int(4, 8);
  for (let n = 0; n < buildings; n++) {
    for (let tries = 0; tries < 60; tries++) {
      const w = rng.int(4, 8);
      const h = rng.int(4, 7);
      let x0: number;
      let y0: number;
      if (roadCells.length > 0 && rng.chance(0.8)) {
        // Junto a la carretera.
        const c = roadCells[rng.int(0, roadCells.length - 1)];
        x0 = (c % width) + rng.int(2, 4) * (rng.chance(0.5) ? 1 : -1) - (rng.chance(0.5) ? w : 0);
        y0 = Math.floor(c / width) + rng.int(2, 4) * (rng.chance(0.5) ? 1 : -1) - (rng.chance(0.5) ? h : 0);
      } else {
        x0 = rng.int(2, width - w - 3);
        y0 = rng.int(2, height - h - 3);
      }
      if (x0 < 1 || y0 < 1 || x0 + w >= width - 1 || y0 + h >= height - 1) continue;
      const lvl = map.level[y0 * width + x0];
      if (!areaIs(map, x0 - 1, y0 - 1, w + 2, h + 2, (t, p, i) =>
        (t === Terrain.Soil || t === Terrain.Sand || t === Terrain.Gravel) && p === Prop.None && map.level[i] === lvl)) continue;

      const door = rng.int(1, 2 * (w + h) - 6);
      let k = 0;
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const i = y * width + x;
          terrain[i] = Terrain.Concrete;
          const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
          if (edge) {
            k++;
            const isDoor = k === door || k === door + 1;
            if (!isDoor && rng.chance(0.75)) props[i] = Prop.RuinWall;
            else if (!isDoor && rng.chance(0.5)) props[i] = Prop.Rubble;
          } else if (rng.chance(0.12)) {
            props[i] = rng.chance(0.3) ? Prop.ScrapPile : Prop.Rubble;
          }
        }
      }
      break;
    }
  }
  // Coches abandonados sobre la carretera.
  for (const i of roadCells) {
    if (props[i] === Prop.None && rng.chance(0.025)) props[i] = Prop.CarWreck;
  }
}

function scatterProps(map: GameMap, rng: Rng, noise: ValueNoise): void {
  const { width, height, terrain, props, moisture, radiation } = map;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (props[i] !== Prop.None || map.cliff[i]) continue;
      const t = terrain[i] as Terrain;
      if (t !== Terrain.Soil && t !== Terrain.Sand && t !== Terrain.Gravel) continue;
      const m = moisture[i];
      const rad = radiation[i];
      const grove = noise.fbm(x / 7, y / 7, 2, 0.5); // agrupa la vegetación en bosquecillos
      const r = rng.next();

      if (rad > RADIATION_THRESHOLD) {
        if (r < 0.035) props[i] = Prop.ToxicBarrel;
        else if (r < 0.09) props[i] = Prop.GlowPuddle;
        else if (r < 0.11) props[i] = Prop.Bones;
        else if (r < 0.13) props[i] = Prop.DeadTree;
        continue;
      }
      if (t === Terrain.Gravel) {
        if (r < 0.07) props[i] = Prop.Boulder;
        else if (r < 0.14) props[i] = Prop.Stones;
        else if (r < 0.16) props[i] = Prop.Bush;
        continue;
      }
      const treeChance = t === Terrain.Sand ? 0.01 : Math.max(0, (m - 0.45) * 0.55 + (grove - 0.5) * 0.5);
      if (r < treeChance) props[i] = Prop.DeadTree;
      else if (r < treeChance + 0.05 + m * 0.04) props[i] = Prop.Bush;
      else if (r < treeChance + 0.1 + m * 0.04) props[i] = rng.chance(0.4) ? Prop.Stump : Prop.Stones;
      else if (r < treeChance + 0.106 + m * 0.04) props[i] = Prop.ScrapPile;
      else if (r < treeChance + 0.11 + m * 0.04) props[i] = rng.chance(0.5) ? Prop.Bones : Prop.Tires;
    }
  }
}

function placeSprings(map: GameMap, rng: Rng): void {
  const { width, height, terrain, props, elevation, radiation } = map;
  const count = rng.int(2, 4);
  for (let n = 0, tries = 0; n < count && tries < 2000; tries++) {
    const x = rng.int(3, width - 4);
    const y = rng.int(3, height - 4);
    const i = y * width + x;
    const t = terrain[i];
    if ((t === Terrain.Gravel || t === Terrain.Soil) && elevation[i] > 0.55 && radiation[i] < 0.6 && !map.cliff[i]) {
      props[i] = Prop.Spring;
      // Hierba algo más viva alrededor: matorrales.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = (y + dy) * width + x + dx;
          if (j !== i && props[j] === Prop.None && !map.cliff[j] && rng.chance(0.4)) props[j] = Prop.Bush;
        }
      }
      n++;
    }
  }
}

function areaIs(
  map: GameMap, x0: number, y0: number, w: number, h: number,
  ok: (t: Terrain, p: Prop, i: number) => boolean,
): boolean {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (!inBounds(map, x, y)) return false;
      const i = y * map.width + x;
      if (!ok(map.terrain[i] as Terrain, map.props[i] as Prop, i)) return false;
    }
  }
  return true;
}

/** Casilla construible más cercana al centro con terreno firme alrededor. */
function findStart(map: GameMap): { x: number; y: number } {
  const cx = Math.floor(map.width / 2);
  const cy = Math.floor(map.height / 2);
  const good = (t: Terrain, _p: Prop, i: number) => TERRAIN_INFO[t].buildable && !map.cliff[i];
  const main = largestRegion(map);
  const maxR = Math.max(map.width, map.height);
  for (let r = 0; r < maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (map.radiation[y * map.width + x] > 0.65) continue;
        if (main && !main[y * map.width + x]) continue;
        if (areaIs(map, x - 3, y - 3, 7, 7, good)) return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}

/** Zona más grande a la que se llega a pie (sin contar el río ni los lagos), para empezar en ella. */
function largestRegion(map: GameMap): Uint8Array | null {
  const visited = new Uint8Array(map.terrain.length);
  let best: Uint8Array | null = null;
  let bestSize = 0;
  for (let i = 0; i < visited.length; i++) {
    if (visited[i]) continue;
    const x = i % map.width;
    const y = (i - x) / map.width;
    if (!isPassable(map, x, y)) continue;
    const region = reachableFrom(map, x, y);
    let size = 0;
    for (let j = 0; j < region.length; j++) {
      if (region[j]) {
        visited[j] = 1;
        size++;
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = region;
    }
  }
  return best;
}

/** Quita objetos que bloquean alrededor del inicio para que los colonos puedan moverse. */
function clearAround(map: GameMap, cx: number, cy: number, r: number): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(map, x, y)) continue;
      const i = y * map.width + x;
      if (PROP_INFO[map.props[i] as Prop].blocks || map.props[i] === Prop.GlowPuddle) map.props[i] = Prop.None;
      if (map.cliff[i]) {
        map.cliff[i] = 0;
        map.slope[i] = 1;
      }
    }
  }
}
