// Construcciones: planos que colocan el jugador y que los colonos completan llevando
// materiales y trabajando. Al terminarse, los muros bloquean el paso y las puertas lo frenan.
import { BuildingDef, buildingDef } from '../data/buildings';
import { RESOURCES, ResourceId } from '../data/resources';
import { BLOCK_SOLID, walkableStructureCode, GameMap, inBounds, index, isWater, Prop, TERRAIN_INFO, Terrain } from './map';
import type { TileRect } from './designations';
import type { Stockpile } from './resources';

export interface Structure {
  def: BuildingDef;
  x: number;
  y: number;
  /** false mientras es un plano. */
  built: boolean;
  /** Materiales ya llevados al plano. */
  delivered: Partial<Stockpile>;
  /** Ticks de trabajo acumulados. */
  progress: number;
  hp: number;
  /** Marcada para demoler (solo las terminadas). */
  demolish?: boolean;
}

/** Parte del coste que se recupera al demoler. */
export const DEMOLISH_REFUND = 0.5;

/** Forma en que se coloca un área de planos. */
export type PlaceShape = 'contorno' | 'relleno';

/** Por qué no se puede construir en una casilla, o null si se puede. */
export function buildBlocker(map: GameMap, x: number, y: number): string | null {
  if (!inBounds(map, x, y)) return 'fuera del mapa';
  const i = index(map, x, y);
  const t = map.terrain[i] as Terrain;
  if (isWater(t)) return 'agua';
  if (!TERRAIN_INFO[t].walkable) return 'terreno';
  if (map.cliff[i]) return 'acantilado';
  if (map.slope[i]) return 'pendiente';
  if (map.props[i] !== Prop.None) return 'objeto';
  return null;
}

export class Structures {
  private byTile = new Map<number, Structure>();
  /** Aumenta con cada cambio: el dibujado lo usa para saber cuándo repintar. */
  version = 0;

  constructor(readonly map: GameMap) {}

  at(x: number, y: number): Structure | undefined {
    return inBounds(this.map, x, y) ? this.byTile.get(index(this.map, x, y)) : undefined;
  }

  all(): Structure[] {
    return [...this.byTile.values()];
  }

  blueprints(): Structure[] {
    return this.all().filter((s) => !s.built);
  }

  /** Construcciones terminadas marcadas para demoler. */
  toDemolish(): Structure[] {
    return this.all().filter((s) => s.built && s.demolish);
  }

  /** Marca (o desmarca) una construcción terminada para demolerla. */
  markDemolish(x: number, y: number, on = true): boolean {
    const s = this.at(x, y);
    if (!s || !s.built || !!s.demolish === on) return false;
    s.demolish = on;
    this.version++;
    return true;
  }

  /** Quita una construcción terminada (demolida). Devuelve el material que se recupera. */
  demolish(s: Structure): Partial<Stockpile> {
    const i = index(this.map, s.x, s.y);
    if (this.byTile.get(i) !== s) return {};
    this.byTile.delete(i);
    this.map.blocked[i] = 0;
    this.version++;
    const back: Partial<Stockpile> = {};
    for (const r of RESOURCES) {
      const n = Math.floor((s.def.cost[r] ?? 0) * DEMOLISH_REFUND);
      if (n > 0) back[r] = n;
    }
    return back;
  }

  /** Se puede poner un plano: terreno llano y libre, sin objeto ni otra construcción. */
  canPlace(x: number, y: number): boolean {
    return buildBlocker(this.map, x, y) === null && !this.at(x, y);
  }

  /** Coloca un plano. false si no se puede. */
  place(x: number, y: number, defId: string): boolean {
    if (!this.canPlace(x, y)) return false;
    const def = buildingDef(defId);
    this.byTile.set(index(this.map, x, y), { def, x, y, built: false, delivered: {}, progress: 0, hp: def.hp });
    this.version++;
    return true;
  }

  /** Casillas de un área: el contorno (para muros) o todas. */
  static areaTiles(r: TileRect, shape: PlaceShape): { x: number; y: number }[] {
    const xa = Math.min(r.x0, r.x1);
    const xb = Math.max(r.x0, r.x1);
    const ya = Math.min(r.y0, r.y1);
    const yb = Math.max(r.y0, r.y1);
    const out: { x: number; y: number }[] = [];
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        if (shape === 'relleno' || x === xa || x === xb || y === ya || y === yb) out.push({ x, y });
      }
    }
    return out;
  }

  /** Coloca planos en un área. Devuelve cuántos. */
  placeArea(r: TileRect, defId: string, shape: PlaceShape): number {
    let n = 0;
    for (const t of Structures.areaTiles(r, shape)) if (this.place(t.x, t.y, defId)) n++;
    return n;
  }

  /**
   * Quita un plano (no las construcciones terminadas). Devuelve los materiales que ya se habían
   * llevado, para soltarlos en el suelo, o null si no había plano.
   */
  cancel(x: number, y: number): Partial<Stockpile> | null {
    const s = this.at(x, y);
    if (!s || s.built) return null;
    this.byTile.delete(index(this.map, x, y));
    this.version++;
    return { ...s.delivered };
  }

  /** Lo que falta por llevar a un plano. */
  needs(s: Structure): Partial<Stockpile> {
    const out: Partial<Stockpile> = {};
    for (const r of RESOURCES) {
      const want = (s.def.cost[r] ?? 0) - (s.delivered[r] ?? 0);
      if (want > 0) out[r] = want;
    }
    return out;
  }

  needsAny(s: Structure): boolean {
    return Object.keys(this.needs(s)).length > 0;
  }

  /** Entrega material a un plano. Devuelve cuánto ha aceptado. */
  deliver(s: Structure, resource: ResourceId, amount: number): number {
    const want = this.needs(s)[resource] ?? 0;
    const put = Math.max(0, Math.min(want, Math.floor(amount)));
    if (put > 0) {
      s.delivered[resource] = (s.delivered[resource] ?? 0) + put;
      this.version++;
    }
    return put;
  }

  /** Vuelve a poner una construcción guardada (al cargar una partida). */
  restore(def: BuildingDef, x: number, y: number, built: boolean, delivered: Partial<Stockpile>, progress: number, hp: number): void {
    if (!inBounds(this.map, x, y)) return;
    const s: Structure = { def, x, y, built: false, delivered: { ...delivered }, progress, hp };
    this.byTile.set(index(this.map, x, y), s);
    if (built) this.complete(s);
    s.progress = progress;
    this.version++;
  }

  /** Termina una construcción: deja de ser plano y bloquea o frena el paso. */
  complete(s: Structure): void {
    if (s.built) return;
    s.built = true;
    s.progress = s.def.work;
    this.map.blocked[index(this.map, s.x, s.y)] = s.def.blocks ? BLOCK_SOLID : walkableStructureCode(s.def.moveCost ?? 1);
    this.version++;
  }
}
