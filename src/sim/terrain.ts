// Obras de terreno: rebajar o elevar el nivel de una casilla y convertir un acantilado en rampa.
// Las hacen los colonos (trabajo «terreno»). Al cambiar un nivel se recalculan los bordes:
// los desniveles nuevos son pendientes (se pueden cruzar); los acantilados que ya había se respetan.
import { GameMap, inBounds, index, isWater, MAX_LEVEL, PROP_INFO, Prop, Terrain, TERRAIN_INFO, TRENCH_DRY, TRENCH_FLOODED } from './map';
import type { TileRect } from './designations';

export type TerrainJob = 'rebajar' | 'elevar' | 'rampa' | 'zanja' | 'rellenar';
export const TERRAIN_JOBS: readonly TerrainJob[] = ['rebajar', 'elevar', 'rampa', 'zanja', 'rellenar'];

export const TERRAIN_JOB_NAMES: Record<TerrainJob, string> = {
  rebajar: 'Rebajar',
  elevar: 'Elevar',
  rampa: 'Hacer rampa',
  zanja: 'Cavar zanja',
  rellenar: 'Rellenar zanja',
};

/** Ticks de trabajo de un colono normal. */
export const TERRAIN_WORK: Record<TerrainJob, number> = {
  rebajar: 480,
  elevar: 600,
  rampa: 300,
  zanja: 360,
  rellenar: 240,
};

/** Piedra que sale al rebajar una casilla. */
export const LOWER_STONE = 3;

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Por qué no se puede hacer esa obra en la casilla, o null si se puede. `hasStructure` dice si hay una construcción. */
export function terrainBlocker(map: GameMap, x: number, y: number, job: TerrainJob, hasStructure = false): string | null {
  if (!inBounds(map, x, y)) return 'fuera del mapa';
  const i = index(map, x, y);
  const t = map.terrain[i] as Terrain;
  if (isWater(t)) return 'agua';
  if (!TERRAIN_INFO[t].walkable && t !== Terrain.Rock) return 'terreno';
  if (t === Terrain.Rock && job !== 'rebajar') return 'roca (primero hay que rebajarla)';
  if (hasStructure) return 'construcción';
  if (PROP_INFO[map.props[i] as Prop].blocks) return 'objeto';
  switch (job) {
    case 'rebajar':
      return map.level[i] <= 1 && t !== Terrain.Rock ? 'ya está al nivel más bajo' : null;
    case 'elevar':
      return map.level[i] >= MAX_LEVEL ? 'ya está al nivel más alto' : null;
    case 'rampa':
      return map.cliff[i] ? null : 'no es un acantilado';
    case 'zanja':
      return map.trench[i] ? 'ya hay zanja' : map.cliff[i] ? 'acantilado' : t === Terrain.Rock ? 'roca' : null;
    case 'rellenar':
      return map.trench[i] ? null : 'no hay zanja';
  }
}

/** Recalcula acantilado y pendiente de una casilla según sus vecinas (tras cambiar niveles). */
function reclassify(map: GameMap, x: number, y: number): void {
  if (!inBounds(map, x, y)) return;
  const i = index(map, x, y);
  let higherThanSide = false;
  for (const [dx, dy] of SIDES) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(map, nx, ny)) continue;
    const j = index(map, nx, ny);
    if (map.level[j] > 0 && map.level[j] < map.level[i]) higherThanSide = true;
  }
  if (!higherThanSide) {
    map.cliff[i] = 0;
    map.slope[i] = 0;
  } else if (!map.cliff[i]) {
    map.slope[i] = 1;
  }
}

/** Hace la obra en la casilla. Devuelve las casillas cuyo aspecto ha cambiado (para repintarlas). */
export function applyTerrainJob(map: GameMap, x: number, y: number, job: TerrainJob): number[] {
  const i = index(map, x, y);
  if (job === 'rampa') {
    map.cliff[i] = 0;
    map.slope[i] = 1;
  } else if (job === 'zanja' || job === 'rellenar') {
    map.trench[i] = job === 'zanja' ? TRENCH_DRY : 0;
  } else {
    map.level[i] = Math.max(1, Math.min(MAX_LEVEL, map.level[i] + (job === 'elevar' ? 1 : -1)));
    // Una casilla que se toca deja de ser acantilado: queda como pendiente o llano.
    map.cliff[i] = 0;
    // La roca se queda en su sitio al subir; al rebajar, la casilla pasa a pedregal (se puede pisar).
    if (job === 'rebajar' && map.terrain[i] === Terrain.Rock) map.terrain[i] = Terrain.Gravel;
  }
  const changed: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(map, nx, ny)) continue;
      reclassify(map, nx, ny);
      changed.push(index(map, nx, ny));
    }
  }
  return changed;
}

/** Órdenes de terreno pendientes. */
export class TerrainOrders {
  private marks = new Map<number, TerrainJob>();
  version = 0;

  constructor(readonly map: GameMap) {}

  at(x: number, y: number): TerrainJob | undefined {
    return inBounds(this.map, x, y) ? this.marks.get(index(this.map, x, y)) : undefined;
  }

  list(): { x: number; y: number; job: TerrainJob }[] {
    return [...this.marks].map(([i, job]) => ({ x: i % this.map.width, y: Math.floor(i / this.map.width), job }));
  }

  get count(): number {
    return this.marks.size;
  }

  add(x: number, y: number, job: TerrainJob, hasStructure = false): boolean {
    if (terrainBlocker(this.map, x, y, job, hasStructure)) return false;
    const i = index(this.map, x, y);
    if (this.marks.get(i) === job) return false;
    this.marks.set(i, job);
    this.version++;
    return true;
  }

  remove(x: number, y: number): boolean {
    if (!inBounds(this.map, x, y) || !this.marks.delete(index(this.map, x, y))) return false;
    this.version++;
    return true;
  }

  /** Marca un área. `hasStructure` dice si una casilla tiene construcción. */
  addArea(r: TileRect, job: TerrainJob, hasStructure: (x: number, y: number) => boolean): number {
    let n = 0;
    forRect(this.map, r, (x, y) => {
      if (this.add(x, y, job, hasStructure(x, y))) n++;
    });
    return n;
  }

  removeArea(r: TileRect): number {
    let n = 0;
    forRect(this.map, r, (x, y) => {
      if (this.remove(x, y)) n++;
    });
    return n;
  }
}

function forRect(map: GameMap, r: TileRect, fn: (x: number, y: number) => void): void {
  const xa = Math.max(0, Math.min(r.x0, r.x1));
  const xb = Math.min(map.width - 1, Math.max(r.x0, r.x1));
  const ya = Math.max(0, Math.min(r.y0, r.y1));
  const yb = Math.min(map.height - 1, Math.max(r.y0, r.y1));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) fn(x, y);
}

/**
 * Foso con agua (bloque 13, «Hidráulica»: «una zanja que toca el agua se inunda; nadie la cruza
 * andando, solo por un puente o un puente levadizo»). Con `enabled`, se inunda toda zanja pegada
 * (por un lado, no en diagonal) al agua o a otra zanja inundada; sin él, todas quedan secas.
 * Devuelve las casillas que han cambiado (para repintarlas).
 */
export function updateFlooding(map: GameMap, enabled: boolean): number[] {
  const size = map.width * map.height;
  const wet = new Uint8Array(size);
  if (enabled) {
    const queue: number[] = [];
    for (let i = 0; i < size; i++) {
      if (!map.trench[i]) continue;
      const x = i % map.width;
      const y = (i - x) / map.width;
      const touches = SIDES.some(([dx, dy]) => inBounds(map, x + dx, y + dy) && isWater(map.terrain[index(map, x + dx, y + dy)] as Terrain));
      if (touches) {
        wet[i] = 1;
        queue.push(i);
      }
    }
    while (queue.length) {
      const i = queue.pop()!;
      const x = i % map.width;
      const y = (i - x) / map.width;
      for (const [dx, dy] of SIDES) {
        if (!inBounds(map, x + dx, y + dy)) continue;
        const j = index(map, x + dx, y + dy);
        if (map.trench[j] && !wet[j]) {
          wet[j] = 1;
          queue.push(j);
        }
      }
    }
  }
  const changed: number[] = [];
  for (let i = 0; i < size; i++) {
    if (!map.trench[i]) continue;
    const v = wet[i] ? TRENCH_FLOODED : TRENCH_DRY;
    if (map.trench[i] !== v) {
      map.trench[i] = v;
      changed.push(i);
    }
  }
  return changed;
}
