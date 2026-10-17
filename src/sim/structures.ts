// Construcciones: planos que colocan el jugador y que los colonos completan llevando
// materiales y trabajando. Al terminarse, los muros bloquean el paso y las puertas lo frenan.
import { BuildingDef, buildingDef } from '../data/buildings';
import { RESOURCES, ResourceId } from '../data/resources';
import type { RecipeDef } from '../data/recipes';
import { BLOCK_SOLID, walkableStructureCode, GameMap, inBounds, index, isPassable, isWater, Prop, TERRAIN_INFO, Terrain } from './map';
import type { TileRect } from './designations';
import type { Stockpile } from './resources';

export interface Structure {
  def: BuildingDef;
  /** Esquina (arriba a la izquierda) de lo que ocupa. */
  x: number;
  y: number;
  /** Girada un cuarto de vuelta (se intercambian ancho y alto). */
  rot: 0 | 1;
  /** false mientras es un plano. */
  built: boolean;
  /** Materiales ya llevados al plano. */
  delivered: Partial<Stockpile>;
  /** Ticks de trabajo acumulados. */
  progress: number;
  hp: number;
  /** Marcada para demoler (solo las terminadas). */
  demolish?: boolean;
  /** Taller: qué fabricar y hasta cuánto. En un taller, `delivered` guarda los materiales ya traídos. */
  bill?: Bill;
}

/** Orden de fabricación de un taller: hacer la receta hasta que la colonia tenga `target` del producto. */
export interface Bill {
  recipe: RecipeDef;
  target: number;
  paused: boolean;
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
  if (map.trench[i]) return 'zanja';
  return null;
}

/** Ancho y alto (en casillas) de una construcción con su giro. */
export function footprint(def: BuildingDef, rot: 0 | 1): { w: number; h: number } {
  const [w, h] = def.size ?? [1, 1];
  return rot ? { w: h, h: w } : { w, h };
}

/** Casillas que ocupa una construcción puesta en (x, y). */
export function footprintTiles(def: BuildingDef, x: number, y: number, rot: 0 | 1): { x: number; y: number }[] {
  const { w, h } = footprint(def, rot);
  const out: { x: number; y: number }[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: x + dx, y: y + dy });
  return out;
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
    return [...new Set(this.byTile.values())];
  }

  /** Casillas que ocupa. */
  tilesOf(s: Structure): { x: number; y: number }[] {
    return footprintTiles(s.def, s.x, s.y, s.rot);
  }

  /** Casillas transitables pegadas a la construcción (desde donde se trabaja en ella). */
  sidesOf(s: Structure): { x: number; y: number }[] {
    const own = new Set(this.tilesOf(s).map((t) => index(this.map, t.x, t.y)));
    const out: { x: number; y: number }[] = [];
    const seen = new Set<number>();
    for (const t of this.tilesOf(s)) {
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const nx = t.x + dx;
        const ny = t.y + dy;
        if (!inBounds(this.map, nx, ny)) continue;
        const i = index(this.map, nx, ny);
        if (own.has(i) || seen.has(i) || !isPassable(this.map, nx, ny)) continue;
        seen.add(i);
        out.push({ x: nx, y: ny });
      }
    }
    return out;
  }

  /** Está justo al lado (no en diagonal) de alguna de sus casillas, sin estar encima. */
  isBesideStructure(at: { x: number; y: number }, s: Structure): boolean {
    let beside = false;
    for (const t of this.tilesOf(s)) {
      if (t.x === at.x && t.y === at.y) return false;
      if (Math.abs(t.x - at.x) + Math.abs(t.y - at.y) === 1) beside = true;
    }
    return beside;
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
    if (this.byTile.get(index(this.map, s.x, s.y)) !== s) return {};
    for (const t of this.tilesOf(s)) {
      const i = index(this.map, t.x, t.y);
      this.byTile.delete(i);
      this.map.blocked[i] = 0;
    }
    this.version++;
    const back: Partial<Stockpile> = {};
    for (const r of RESOURCES) {
      // La mitad del material y, en un taller, todo lo que tenía dentro.
      const n = Math.floor((s.def.cost[r] ?? 0) * DEMOLISH_REFUND) + (s.delivered[r] ?? 0);
      if (n > 0) back[r] = n;
    }
    return back;
  }

  /** Se puede poner un plano en esa casilla: terreno llano y libre, sin objeto ni otra construcción. */
  canPlace(x: number, y: number): boolean {
    return buildBlocker(this.map, x, y) === null && !this.at(x, y);
  }

  /** Cabe una construcción (de varias casillas) en (x, y): todas libres y a la misma altura. */
  canPlaceDef(def: BuildingDef, x: number, y: number, rot: 0 | 1 = 0): boolean {
    const tiles = footprintTiles(def, x, y, rot);
    if (!inBounds(this.map, x, y)) return false;
    const level = this.map.level[index(this.map, x, y)];
    return tiles.every((t) => this.canPlace(t.x, t.y) && this.map.level[index(this.map, t.x, t.y)] === level);
  }

  /** Coloca un plano con su esquina en (x, y). false si no cabe. */
  place(x: number, y: number, defId: string, rot: 0 | 1 = 0): boolean {
    const def = buildingDef(defId);
    if (!this.canPlaceDef(def, x, y, rot)) return false;
    const s: Structure = { def, x, y, rot, built: false, delivered: {}, progress: 0, hp: def.hp };
    for (const t of footprintTiles(def, x, y, rot)) this.byTile.set(index(this.map, t.x, t.y), s);
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

  /**
   * Coloca planos en un área. Devuelve cuántos. Las construcciones de varias casillas (camas,
   * talleres) se ponen una sola vez, con su esquina en el inicio del arrastre.
   */
  placeArea(r: TileRect, defId: string, shape: PlaceShape, rot: 0 | 1 = 0): number {
    const def = buildingDef(defId);
    const [w, h] = def.size ?? [1, 1];
    if (w * h > 1) return this.place(r.x0, r.y0, defId, rot) ? 1 : 0;
    let n = 0;
    for (const t of Structures.areaTiles(r, shape)) if (this.place(t.x, t.y, defId, rot)) n++;
    return n;
  }

  /**
   * Quita un plano (no las construcciones terminadas). Devuelve los materiales que ya se habían
   * llevado, para soltarlos en el suelo, o null si no había plano.
   */
  cancel(x: number, y: number): Partial<Stockpile> | null {
    const s = this.at(x, y);
    if (!s || s.built) return null;
    for (const t of this.tilesOf(s)) this.byTile.delete(index(this.map, t.x, t.y));
    this.version++;
    return { ...s.delivered };
  }

  /** Lo que falta por llevar a un plano o, en un taller con orden, para la siguiente tanda. */
  needs(s: Structure): Partial<Stockpile> {
    const out: Partial<Stockpile> = {};
    const wanted = s.built ? (s.bill && !s.bill.paused ? s.bill.recipe.inputs : {}) : s.def.cost;
    for (const r of RESOURCES) {
      const want = (wanted[r] ?? 0) - (s.delivered[r] ?? 0);
      if (want > 0) out[r] = want;
    }
    return out;
  }

  /** Talleres terminados. */
  stations(): Structure[] {
    return this.all().filter((s) => s.built && s.def.category === 'taller');
  }

  /** Pone (o quita con null) la orden de fabricación de un taller. */
  setBill(s: Structure, bill: Bill | null): void {
    s.bill = bill ?? undefined;
    this.version++;
  }

  /** Gasta los materiales de una tanda. false si no estaban todos. */
  consumeInputs(s: Structure): boolean {
    if (!s.bill || this.needsAny(s)) return false;
    for (const [r, n] of Object.entries(s.bill.recipe.inputs) as [ResourceId, number][]) {
      s.delivered[r] = (s.delivered[r] ?? 0) - n;
      if (!s.delivered[r]) delete s.delivered[r];
    }
    this.version++;
    return true;
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
  restore(def: BuildingDef, x: number, y: number, built: boolean, delivered: Partial<Stockpile>, progress: number, hp: number, rot: 0 | 1 = 0): Structure | undefined {
    const tiles = footprintTiles(def, x, y, rot);
    // Si ya no cabe (p. ej. ahora ocupa más casillas que cuando se guardó), no se pone.
    if (tiles.some((t) => !inBounds(this.map, t.x, t.y) || this.at(t.x, t.y))) return undefined;
    const s: Structure = { def, x, y, rot, built: false, delivered: {}, progress, hp };
    for (const t of tiles) this.byTile.set(index(this.map, t.x, t.y), s);
    if (built) this.complete(s);
    s.delivered = { ...delivered };
    s.progress = progress;
    this.version++;
    return s;
  }

  /** Termina una construcción: deja de ser plano y bloquea o frena el paso. */
  complete(s: Structure): void {
    if (s.built) return;
    s.built = true;
    s.delivered = {}; // el material ya es la construcción; en un taller, aquí irán sus materiales
    s.progress = s.def.work;
    const code = s.def.blocks ? BLOCK_SOLID : walkableStructureCode(s.def.moveCost ?? 1);
    for (const t of this.tilesOf(s)) this.map.blocked[index(this.map, t.x, t.y)] = code;
    this.version++;
  }
}
