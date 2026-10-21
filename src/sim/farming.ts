// Cultivo: zonas de cultivo con un tipo de planta, fertilidad del suelo y plantas que crecen.
// Los colonos siembran y cosechan (trabajo «cultivar»). Determinista: el azar viene de `Rng`.
import { CROPS, CropDef, cropDef } from '../data/crops';
import { GameMap, inBounds, index, isPassable, isWater, Prop, RADIATION_THRESHOLD, Terrain } from './map';
import type { TileRect } from './designations';

/** Fertilidad base de cada suelo (0 = no se puede cultivar). */
const TERRAIN_FERTILITY: Record<Terrain, number> = {
  [Terrain.DeepWater]: 0,
  [Terrain.Water]: 0,
  [Terrain.ShallowWater]: 0,
  [Terrain.Sand]: 0.35,
  [Terrain.Soil]: 1,
  [Terrain.Gravel]: 0.55,
  [Terrain.Rock]: 0,
  [Terrain.Concrete]: 0,
};

/** Fertilidad de una casilla, 0–1,2: el suelo, la humedad (ayuda) y la radiación (la reduce). */
export function fertilityAt(map: GameMap, x: number, y: number): number {
  if (!inBounds(map, x, y)) return 0;
  const i = index(map, x, y);
  const t = map.terrain[i] as Terrain;
  const base = TERRAIN_FERTILITY[t];
  if (base === 0 || isWater(t)) return 0;
  let f = base + (map.moisture[i] - 0.5) * 0.4;
  if (map.radiation[i] > RADIATION_THRESHOLD) f *= 0.5;
  return Math.max(0.05, Math.min(1.2, f));
}

/** Se puede cultivar la casilla: se pisa, no es agua, tiene algo de fertilidad y no hay objetos ni construcciones. */
export function canFarm(map: GameMap, x: number, y: number): boolean {
  if (!isPassable(map, x, y)) return false;
  const i = index(map, x, y);
  return fertilityAt(map, x, y) > 0 && map.props[i] === Prop.None && map.blocked[i] === 0 && !map.trench[i];
}

export interface Plant {
  crop: CropDef;
  /** 0 recién sembrada … 1 madura. */
  growth: number;
  /** Le ha caído lluvia ácida: la cosecha se multiplica por esto (0,7). */
  harm?: number;
  /** Enferma por una plaga: hay que arrancarla (sin cosecha). */
  sick?: boolean;
  /** Abonada al sembrarla («Agricultura mejorada»): da `FERTILIZER_BONUS` más de cosecha. */
  fertilized?: boolean;
}

/** Lo que da de más una planta abonada (+25 %, bloque 3 del catálogo). */
export const FERTILIZER_BONUS = 1.25;

/** Lo que crece más deprisa una planta abonada (+25 %, pedido de Mikel del 2026-10-21 con la compostera). */
export const FERTILIZER_GROWTH = 1.25;

/** Fase visible de una planta: 0 sembrada, 1 brote, 2 creciendo, 3 madura. */
export function plantStage(p: Plant): 0 | 1 | 2 | 3 {
  if (p.growth >= 1) return 3;
  if (p.growth >= 0.55) return 2;
  if (p.growth >= 0.15) return 1;
  return 0;
}

export interface GrowZone {
  id: number;
  name: string;
  crop: CropDef;
  tiles: Set<number>;
}

export class GrowZones {
  private zones = new Map<number, GrowZone>();
  private zoneOf: Int32Array;
  private plants = new Map<number, Plant>();
  private nextId = 1;
  /** Cambia con cada cambio visible (zonas, plantas nuevas, cosechadas o que cambian de fase). */
  version = 0;
  /** Cambia solo cuando cambian las zonas (no las plantas): para redibujar los huertos. */
  zoneVersion = 0;

  constructor(readonly map: GameMap) {
    this.zoneOf = new Int32Array(map.width * map.height);
  }

  get(id: number): GrowZone | undefined {
    return this.zones.get(id);
  }

  all(): GrowZone[] {
    return [...this.zones.values()];
  }

  at(x: number, y: number): GrowZone | undefined {
    if (!inBounds(this.map, x, y)) return undefined;
    const id = this.zoneOf[index(this.map, x, y)];
    return id ? this.zones.get(id) : undefined;
  }

  plantAt(x: number, y: number): Plant | undefined {
    return inBounds(this.map, x, y) ? this.plants.get(index(this.map, x, y)) : undefined;
  }

  plantList(): { x: number; y: number; plant: Plant }[] {
    return [...this.plants].map(([i, plant]) => ({ x: i % this.map.width, y: Math.floor(i / this.map.width), plant }));
  }

  /** Crea una zona de cultivo. `exclude` deja fuera casillas (p. ej. las de un almacén). */
  create(r: TileRect, crop: CropDef = CROPS[0], exclude?: (x: number, y: number) => boolean): GrowZone | null {
    const tiles = this.freeTiles(r, exclude);
    if (tiles.length === 0) return null;
    const id = this.nextId++;
    const zone: GrowZone = { id, name: `Huerto ${id}`, crop, tiles: new Set() };
    this.zones.set(id, zone);
    for (const i of tiles) {
      zone.tiles.add(i);
      this.zoneOf[i] = id;
    }
    this.version++;
    this.zoneVersion++;
    return zone;
  }

  extend(id: number, r: TileRect, exclude?: (x: number, y: number) => boolean): number {
    const zone = this.zones.get(id);
    if (!zone) return 0;
    const tiles = this.freeTiles(r, exclude);
    for (const i of tiles) {
      zone.tiles.add(i);
      this.zoneOf[i] = id;
    }
    if (tiles.length > 0) {
      this.version++;
      this.zoneVersion++;
    }
    return tiles.length;
  }

  /** Quita casillas de las zonas (y lo que hubiera plantado en ellas). */
  removeArea(r: TileRect): number {
    let removed = 0;
    forRect(this.map, r, (i) => {
      const id = this.zoneOf[i];
      if (!id) return;
      this.zoneOf[i] = 0;
      this.plants.delete(i);
      const zone = this.zones.get(id)!;
      zone.tiles.delete(i);
      if (zone.tiles.size === 0) this.zones.delete(id);
      removed++;
    });
    if (removed > 0) {
      this.version++;
      this.zoneVersion++;
    }
    return removed;
  }

  delete(id: number): boolean {
    const zone = this.zones.get(id);
    if (!zone) return false;
    for (const i of zone.tiles) {
      this.zoneOf[i] = 0;
      this.plants.delete(i);
    }
    this.zones.delete(id);
    this.version++;
    this.zoneVersion++;
    return true;
  }

  /** Cambia el cultivo de una zona. Lo ya plantado de otro tipo sigue creciendo hasta cosecharse. */
  setCrop(id: number, crop: CropDef): void {
    const zone = this.zones.get(id);
    if (!zone || zone.crop === crop) return;
    zone.crop = crop;
    this.version++;
    this.zoneVersion++;
  }

  /** Siembra una casilla. false si no es de una zona, ya tiene planta o el suelo no vale. */
  sow(x: number, y: number): boolean {
    const zone = this.at(x, y);
    if (!zone || this.plantAt(x, y) || !this.canSow(x, y, zone.crop)) return false;
    this.plants.set(index(this.map, x, y), { crop: zone.crop, growth: 0 });
    this.version++;
    return true;
  }

  /** La casilla admite ese cultivo ahora mismo (libre y con fertilidad suficiente). */
  canSow(x: number, y: number, crop: CropDef): boolean {
    return canFarm(this.map, x, y) && fertilityAt(this.map, x, y) >= crop.minFertility;
  }

  /** Quita una planta madura y devuelve la cosecha (recurso y cantidad), o null. */
  harvest(x: number, y: number, roll: (min: number, max: number) => number): { resource: CropDef['resource']; amount: number } | null {
    const p = this.plantAt(x, y);
    if (!p || p.growth < 1) return null;
    this.plants.delete(index(this.map, x, y));
    this.version++;
    // Una tierra mejor da algo más.
    const bonus = Math.max(0.6, Math.min(1.2, fertilityAt(this.map, x, y)));
    return { resource: p.crop.resource, amount: Math.max(1, Math.round(roll(p.crop.yield[0], p.crop.yield[1]) * bonus * (p.harm ?? 1) * (p.fertilized ? FERTILIZER_BONUS : 1))) };
  }

  /**
   * Hace crecer las plantas `ticks` ticks. `daylight` dice si es de día; `ticksPerDay` la duración de un día.
   * De noche solo crecen las que pueden (setas).
   */
  grow(ticks: number, daylight: boolean, ticksPerDay: number, frozen?: (x: number, y: number) => boolean): void {
    // Solo se crece de día: para madurar en `growDays` días hay que contar solo esas horas.
    const dayFraction = 14 / 24;
    for (const [i, p] of this.plants) {
      if (p.growth >= 1) continue;
      // En invierno, lo que está al aire libre no crece.
      if (frozen && frozen(i % this.map.width, Math.floor(i / this.map.width))) continue;
      if (!daylight && !p.crop.growsInDark) continue;
      const hours = p.crop.growsInDark ? 1 : dayFraction;
      const f = fertilityAt(this.map, i % this.map.width, Math.floor(i / this.map.width));
      const before = plantStage(p);
      p.growth = Math.min(1, p.growth + (ticks * f * (p.fertilized ? FERTILIZER_GROWTH : 1)) / (p.crop.growDays * ticksPerDay * hours));
      if (plantStage(p) !== before) this.version++;
    }
  }

  /** Quita las plantas que ya no pueden seguir (p. ej. se construyó encima). */
  prune(): void {
    let changed = false;
    for (const [i] of this.plants) {
      if (!canFarm(this.map, i % this.map.width, Math.floor(i / this.map.width))) {
        this.plants.delete(i);
        changed = true;
      }
    }
    for (const zone of [...this.zones.values()]) {
      for (const i of [...zone.tiles]) {
        if (fertilityAt(this.map, i % this.map.width, Math.floor(i / this.map.width)) === 0) {
          zone.tiles.delete(i);
          this.zoneOf[i] = 0;
          changed = true;
          this.zoneVersion++;
        }
      }
      if (zone.tiles.size === 0) this.zones.delete(zone.id);
    }
    if (changed) this.version++;
  }

  /** Vuelve a poner una zona guardada. */
  restore(z: { id: number; name: string; crop: CropDef; tiles: number[] }): void {
    const zone: GrowZone = { id: z.id, name: z.name, crop: z.crop, tiles: new Set() };
    for (const i of z.tiles) {
      if (i < 0 || i >= this.zoneOf.length || this.zoneOf[i]) continue;
      if (fertilityAt(this.map, i % this.map.width, Math.floor(i / this.map.width)) === 0) continue;
      zone.tiles.add(i);
      this.zoneOf[i] = z.id;
    }
    if (zone.tiles.size === 0) return;
    this.zones.set(z.id, zone);
    this.nextId = Math.max(this.nextId, z.id + 1);
    this.version++;
    this.zoneVersion++;
  }

  /** Arranca una planta (enferma): se pierde sin dar nada. */
  uproot(x: number, y: number): boolean {
    if (!this.plantAt(x, y)) return false;
    this.plants.delete(index(this.map, x, y));
    this.version++;
    return true;
  }

  /** Vuelve a poner una planta guardada. */
  restorePlant(i: number, crop: CropDef, growth: number, harm?: number, sick?: boolean, fertilized?: boolean): void {
    if (i < 0 || i >= this.zoneOf.length) return;
    this.plants.set(i, { crop, growth: Math.max(0, Math.min(1, growth)), ...(harm !== undefined && harm > 0 && harm < 1 ? { harm } : {}), ...(sick ? { sick: true } : {}), ...(fertilized ? { fertilized: true } : {}) });
    this.version++;
  }

  private freeTiles(r: TileRect, exclude?: (x: number, y: number) => boolean): number[] {
    const out: number[] = [];
    forRect(this.map, r, (i, x, y) => {
      if (this.zoneOf[i] || fertilityAt(this.map, x, y) === 0 || !isPassable(this.map, x, y)) return;
      if (exclude?.(x, y)) return;
      out.push(i);
    });
    return out;
  }
}

function forRect(map: GameMap, r: TileRect, fn: (i: number, x: number, y: number) => void): void {
  const xa = Math.max(0, Math.min(r.x0, r.x1));
  const xb = Math.min(map.width - 1, Math.max(r.x0, r.x1));
  const ya = Math.max(0, Math.min(r.y0, r.y1));
  const yb = Math.min(map.height - 1, Math.max(r.y0, r.y1));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) fn(index(map, x, y), x, y);
}

export { cropDef };
