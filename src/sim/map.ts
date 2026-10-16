import { Rng } from './rng';
import { ValueNoise } from './noise';

/** Tipos de terreno. Los valores se guardan en un Uint8Array. */
export enum Terrain {
  DeepWater = 0,
  Water = 1,
  ShallowWater = 2,
  Sand = 3,
  Wasteland = 4,
  DeadForest = 5,
  Hills = 6,
  Rock = 7,
  Ruins = 8,
  Irradiated = 9,
  Spring = 10,
}

export interface TerrainInfo {
  name: string;
  /** Se puede caminar por encima. */
  walkable: boolean;
  /** Se puede construir encima directamente. */
  buildable: boolean;
  /** Multiplicador de coste de movimiento (1 = normal). */
  moveCost: number;
}

export const TERRAIN_INFO: Record<Terrain, TerrainInfo> = {
  [Terrain.DeepWater]: { name: 'Agua profunda', walkable: false, buildable: false, moveCost: Infinity },
  [Terrain.Water]: { name: 'Agua', walkable: false, buildable: false, moveCost: Infinity },
  [Terrain.ShallowWater]: { name: 'Agua poco profunda', walkable: true, buildable: false, moveCost: 3 },
  [Terrain.Sand]: { name: 'Arena', walkable: true, buildable: true, moveCost: 1.2 },
  [Terrain.Wasteland]: { name: 'Páramo', walkable: true, buildable: true, moveCost: 1 },
  [Terrain.DeadForest]: { name: 'Bosque muerto', walkable: true, buildable: true, moveCost: 1.5 },
  [Terrain.Hills]: { name: 'Colinas', walkable: true, buildable: true, moveCost: 1.8 },
  [Terrain.Rock]: { name: 'Roca', walkable: false, buildable: false, moveCost: Infinity },
  [Terrain.Ruins]: { name: 'Ruinas', walkable: true, buildable: false, moveCost: 1.4 },
  [Terrain.Irradiated]: { name: 'Zona irradiada', walkable: true, buildable: true, moveCost: 1 },
  [Terrain.Spring]: { name: 'Manantial', walkable: true, buildable: false, moveCost: 2 },
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
  /** Elevación 0..1 por casilla (para ventaja defensiva y pozos más adelante). */
  elevation: Float32Array;
  /** 1 si el agua de la casilla está contaminada. */
  contaminated: Uint8Array;
  /** Casilla sugerida para empezar la colonia. */
  start: { x: number; y: number };
}

export function index(map: { width: number }, x: number, y: number): number {
  return y * map.width + x;
}

export function inBounds(map: { width: number; height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function terrainAt(map: GameMap, x: number, y: number): Terrain {
  return map.terrain[index(map, x, y)] as Terrain;
}

export function isWater(t: Terrain): boolean {
  return t === Terrain.DeepWater || t === Terrain.Water || t === Terrain.ShallowWater;
}

/** Genera un mapa determinista a partir de una semilla. */
export function generateMap(opts: MapOptions): GameMap {
  const { width, height, seed } = opts;
  const rng = new Rng(seed);
  const elevNoise = new ValueNoise(rng);
  const moistNoise = new ValueNoise(rng);
  const radNoise = new ValueNoise(rng);

  const size = width * height;
  const terrain = new Uint8Array(size);
  const elevation = new Float32Array(size);
  const contaminated = new Uint8Array(size);
  const moisture = new Float32Array(size);
  const radiation = new Float32Array(size);

  // 1. Campos base de ruido.
  const elevScale = 1 / 22;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      elevation[i] = elevNoise.fbm(x * elevScale, y * elevScale, 5, 0.5);
      moisture[i] = moistNoise.fbm(x / 14, y / 14, 3, 0.5);
      radiation[i] = radNoise.fbm(x / 26, y / 26, 3, 0.55);
    }
  }
  normalize(elevation);
  normalize(radiation);

  // 2. Terreno según elevación y humedad.
  for (let i = 0; i < size; i++) {
    const e = elevation[i];
    let t: Terrain;
    if (e < 0.16) t = Terrain.DeepWater;
    else if (e < 0.22) t = Terrain.Water;
    else if (e < 0.25) t = Terrain.ShallowWater;
    else if (e < 0.29) t = Terrain.Sand;
    else if (e > 0.86) t = Terrain.Rock;
    else if (e > 0.72) t = Terrain.Hills;
    else if (moisture[i] > 0.58) t = Terrain.DeadForest;
    else t = Terrain.Wasteland;
    terrain[i] = t;
  }

  // 3. Ríos: 1 o 2 cauces que cruzan el mapa serpenteando.
  const riverCount = rng.int(1, 2);
  for (let r = 0; r < riverCount; r++) {
    carveRiver(terrain, elevation, width, height, rng, elevNoise);
  }

  // 4. Zonas irradiadas en tierra; el agua de esas zonas queda contaminada.
  for (let i = 0; i < size; i++) {
    const t = terrain[i] as Terrain;
    const rad = radiation[i];
    if (rad > 0.82 && (t === Terrain.Wasteland || t === Terrain.Sand || t === Terrain.DeadForest)) {
      terrain[i] = Terrain.Irradiated;
    }
    if (isWater(t) && rad > 0.6) contaminated[i] = 1;
  }

  // 5. Ruinas: varios bloques rectangulares sobre terreno llano.
  const ruinCount = rng.int(3, 6);
  for (let n = 0; n < ruinCount; n++) placeRuins(terrain, width, height, rng);

  // 6. Manantiales: agua limpia en colinas o junto a ellas.
  const springCount = rng.int(2, 4);
  for (let n = 0, tries = 0; n < springCount && tries < 500; tries++) {
    const x = rng.int(2, width - 3);
    const y = rng.int(2, height - 3);
    const i = y * width + x;
    if (terrain[i] === Terrain.Hills || terrain[i] === Terrain.Wasteland) {
      terrain[i] = Terrain.Spring;
      n++;
    }
  }

  const map: GameMap = { width, height, seed, terrain, elevation, contaminated, start: { x: 0, y: 0 } };
  map.start = findStart(map);
  return map;
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

function carveRiver(
  terrain: Uint8Array,
  elevation: Float32Array,
  width: number,
  height: number,
  rng: Rng,
  noise: ValueNoise,
): void {
  const vertical = rng.chance(0.5);
  const length = vertical ? height : width;
  const span = vertical ? width : height;
  const base = rng.range(span * 0.2, span * 0.8);
  const amplitude = rng.range(span * 0.12, span * 0.25);
  const offset = rng.range(0, 1000);
  const halfWidth = rng.range(1, 2.2);

  for (let s = 0; s < length; s++) {
    const wander = (noise.fbm(s / 30 + offset, offset, 3, 0.5) - 0.5) * 2 * amplitude;
    const center = base + wander;
    const w = halfWidth + noise.sample(s / 10, offset + 7) * 1.2;
    for (let d = Math.floor(center - w - 1); d <= Math.ceil(center + w + 1); d++) {
      if (d < 0 || d >= span) continue;
      const x = vertical ? d : s;
      const y = vertical ? s : d;
      const i = y * width + x;
      const dist = Math.abs(d - center);
      if (terrain[i] === Terrain.Rock && dist > w * 0.5) continue; // los cañones respetan la roca
      if (dist <= w * 0.6) {
        terrain[i] = Terrain.Water;
        elevation[i] = Math.min(elevation[i], 0.2);
      } else if (dist <= w) {
        if (terrain[i] !== Terrain.Water && terrain[i] !== Terrain.DeepWater) terrain[i] = Terrain.ShallowWater;
      } else if (dist <= w + 1) {
        const t = terrain[i];
        if (t === Terrain.Wasteland || t === Terrain.DeadForest) terrain[i] = Terrain.Sand;
      }
    }
  }
}

function placeRuins(terrain: Uint8Array, width: number, height: number, rng: Rng): void {
  for (let tries = 0; tries < 40; tries++) {
    const w = rng.int(4, 9);
    const h = rng.int(4, 9);
    const x0 = rng.int(2, width - w - 3);
    const y0 = rng.int(2, height - h - 3);
    let ok = true;
    for (let y = y0; y < y0 + h && ok; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const t = terrain[y * width + x];
        if (t !== Terrain.Wasteland && t !== Terrain.Sand && t !== Terrain.Irradiated) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) continue;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
        // Muros derruidos en el borde, escombros dispersos dentro.
        if ((edge && rng.chance(0.7)) || (!edge && rng.chance(0.15))) {
          terrain[y * width + x] = Terrain.Ruins;
        }
      }
    }
    return;
  }
}

/** Busca la casilla construible más cercana al centro con terreno firme alrededor. */
function findStart(map: GameMap): { x: number; y: number } {
  const cx = Math.floor(map.width / 2);
  const cy = Math.floor(map.height / 2);
  const maxR = Math.max(map.width, map.height);
  for (let r = 0; r < maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!inBounds(map, x - 2, y - 2) || !inBounds(map, x + 2, y + 2)) continue;
        if (areaBuildable(map, x, y, 2)) return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}

function areaBuildable(map: GameMap, x: number, y: number, radius: number): boolean {
  for (let yy = y - radius; yy <= y + radius; yy++) {
    for (let xx = x - radius; xx <= x + radius; xx++) {
      if (!TERRAIN_INFO[terrainAt(map, xx, yy)].buildable) return false;
    }
  }
  return true;
}
