// Construcciones: planos que colocan el jugador y que los colonos completan llevando
// materiales y trabajando. Al terminarse, los muros bloquean el paso y las puertas lo frenan.
import { BuildingDef, buildingDef, depositOf } from '../data/buildings';
import { RESOURCES, ResourceId } from '../data/resources';
import type { RecipeDef } from '../data/recipes';
import { BLOCK_SOLID, walkableStructureCode, GameMap, inBounds, index, isPassable, isWater, Prop, TERRAIN_INFO, Terrain } from './map';
import type { TileRect } from './designations';
import type { Stockpile } from './resources';

export interface Structure {
  /** Identificador único (para que un trabajo sepa a qué construcción va, aunque haya un suelo debajo). */
  id: number;
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
  /** Electricidad: le llega corriente (consumidores) o está produciendo (generadores). No se guarda. */
  powered?: boolean;
  /** Generador: vatios que produce ahora (la placa solar de noche o el molino sin viento, 0). No se guarda. */
  output?: number;
  /** Molino: tiene algo alrededor que le quita el viento. No se guarda. */
  sheltered?: boolean;
  /** Batería: vatios-hora guardados. */
  stored?: number;
  /** Generador: unidades de combustible dentro (se gastan poco a poco). */
  fuel?: number;
  /** Taller electrificado: gasta corriente y, si le llega, trabaja el doble de rápido. */
  electric?: boolean;
  /** Electrificación pedida y aún sin terminar: material ya traído y trabajo hecho. */
  upgrade?: { delivered: Partial<Stockpile>; progress: number };
  /** Mover: adónde la quiere llevar el jugador (un colono la desmonta y la lleva). */
  moveTo?: { x: number; y: number; rot: 0 | 1 };
  /** La lleva un colono: no ocupa casillas; `x`, `y` y `rot` ya son las del destino. */
  lifted?: boolean;
  /** Mientras se lleva: dónde estaba (por si hay que devolverla). */
  moveFrom?: { x: number; y: number; rot: 0 | 1 };
}

/**
 * Modo de una orden de fabricación:
 * - `until`: «hasta tener N»: fabrica mientras la colonia tenga menos de `target` del producto.
 * - `count`: «fabricar N»: fabrica `target` unidades más y para (cada tanda resta lo que sale).
 */
export type BillMode = 'until' | 'count';

/** Orden de fabricación de un taller. */
export interface Bill {
  recipe: RecipeDef;
  /** «Hasta tener»: cuántos quiere la colonia. «Fabricar»: cuántos faltan por hacer. */
  target: number;
  paused: boolean;
  /** Sin poner = `until` (así eran todas antes del 2026-10-18). */
  mode?: BillMode;
}

/** Máximo que se puede pedir en una orden. */
export const BILL_MAX_TARGET = 999;

/** Cuántas unidades del producto principal (el primero de la receta) salen de una tanda. */
export function billBatchSize(b: Bill): number {
  const first = Object.values(b.recipe.outputs)[0] ?? 1;
  return Math.max(1, first);
}

/** Una orden aún tiene trabajo según su modo, sabiendo lo que tiene la colonia. */
export function billPending(b: Bill, inv: Stockpile): boolean {
  if (b.mode === 'count') return b.target > 0;
  return (Object.keys(b.recipe.outputs) as ResourceId[]).some((r) => inv[r] < b.target);
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

/**
 * Lo que se puede poner en una pendiente o en un acantilado (pedido por Mikel el 2026-10-19: que
 * no queden huecos sin cerrar junto a los acantilados). En las pendientes van los cables, los muros,
 * las puertas, los portones y las defensas; en el borde del acantilado, los muros y las defensas
 * (una puerta ahí no llevaría a ninguna parte).
 */
export function slopeOrCliffOk(def: BuildingDef, blocker: string): boolean {
  const cat = def.category;
  if (blocker === 'pendiente') return isCable(def) || cat === 'muro' || cat === 'puerta' || cat === 'porton' || cat === 'defensa';
  if (blocker === 'acantilado') return cat === 'muro' || cat === 'defensa';
  return false;
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

/** Los suelos van en su propia capa: encima se puede construir casi todo. */
export function isFloor(def: BuildingDef): boolean {
  return def.category === 'suelo';
}

/** Los cables van en otra capa, por debajo de todo (también de suelos y muros). */
export function isCable(def: BuildingDef): boolean {
  return !!def.conduit;
}

export class Structures {
  /** Construcciones (muros, muebles, talleres…), una por casilla. */
  private byTile = new Map<number, Structure>();
  /** Suelos, debajo de lo anterior. */
  private floorByTile = new Map<number, Structure>();
  /** Cables, debajo de todo. */
  private cableByTile = new Map<number, Structure>();
  private byId = new Map<number, Structure>();
  private nextId = 1;
  /** Aumenta con cada cambio: el dibujado lo usa para saber cuándo repintar. */
  version = 0;

  constructor(readonly map: GameMap) {}

  /** Lo construido en una casilla: la construcción o, si no hay, el suelo. */
  at(x: number, y: number): Structure | undefined {
    if (!inBounds(this.map, x, y)) return undefined;
    const i = index(this.map, x, y);
    return this.byTile.get(i) ?? this.floorByTile.get(i) ?? this.cableByTile.get(i);
  }

  /** Solo la construcción (no el suelo). */
  mainAt(x: number, y: number): Structure | undefined {
    return inBounds(this.map, x, y) ? this.byTile.get(index(this.map, x, y)) : undefined;
  }

  /** Solo el suelo. */
  floorAt(x: number, y: number): Structure | undefined {
    return inBounds(this.map, x, y) ? this.floorByTile.get(index(this.map, x, y)) : undefined;
  }

  /** Solo el cable. */
  cableAt(x: number, y: number): Structure | undefined {
    return inBounds(this.map, x, y) ? this.cableByTile.get(index(this.map, x, y)) : undefined;
  }

  get(id: number): Structure | undefined {
    return this.byId.get(id);
  }

  /** Construcciones puestas en el mapa (sin las que lleva un colono al moverlas). */
  all(): Structure[] {
    return [...this.byId.values()].filter((s) => !s.lifted);
  }

  /** Torretas terminadas. */
  turrets(): Structure[] {
    return this.all().filter((s) => s.built && !!s.def.turret);
  }

  /** Las que está llevando un colono a otro sitio. */
  liftedList(): Structure[] {
    return [...this.byId.values()].filter((s) => s.lifted);
  }

  /** Se puede mover: es un mueble o taller que se mueve, terminado, sin electrificar ni otra orden. */
  canMove(s: Structure): boolean {
    return s.built && !!s.def.movable && !s.electric && !s.upgrade && !s.demolish && !s.lifted;
  }

  /** Pide llevar una construcción a otro sitio. false si no se mueve o no cabe allí. */
  orderMove(s: Structure, x: number, y: number, rot: 0 | 1): boolean {
    if (!this.canMove(s) || (s.x === x && s.y === y && s.rot === rot)) return false;
    if (!this.canPlaceDef(s.def, x, y, rot, s)) return false;
    s.moveTo = { x, y, rot };
    this.version++;
    return true;
  }

  /** Quita la orden de mover (si aún no la lleva nadie). */
  cancelMove(s: Structure): boolean {
    if (!s.moveTo || s.lifted) return false;
    s.moveTo = undefined;
    this.version++;
    return true;
  }

  /** Construcciones con orden de mover que esperan a que alguien las desmonte. */
  toMove(): Structure[] {
    return this.all().filter((s) => !!s.moveTo && this.canMove(s));
  }

  /** Un colono la desmonta y se la lleva: deja libres sus casillas y pasa a tener las del destino. */
  lift(s: Structure): void {
    const to = s.moveTo;
    if (!to || s.lifted || this.byId.get(s.id) !== s) return;
    for (const t of this.tilesOf(s)) {
      const i = index(this.map, t.x, t.y);
      this.layer(s).delete(i);
      this.refreshBlocked(i);
    }
    s.moveFrom = { x: s.x, y: s.y, rot: s.rot };
    s.x = to.x;
    s.y = to.y;
    s.rot = to.rot;
    s.lifted = true;
    this.version++;
  }

  /** La deja montada en (x, y). false si ya no cabe ahí. */
  putDown(s: Structure, x: number, y: number, rot: 0 | 1): boolean {
    if (!s.lifted || !this.canPlaceDef(s.def, x, y, rot)) return false;
    s.x = x;
    s.y = y;
    s.rot = rot;
    s.lifted = false;
    s.moveFrom = undefined;
    for (const t of this.tilesOf(s)) {
      const i = index(this.map, t.x, t.y);
      this.layer(s).set(i, s);
      this.refreshBlocked(i);
    }
    this.version++;
    return true;
  }

  /** Quita del todo una que se llevaba y no cabe en ningún sitio (devuelve su material, como al demoler). */
  discardLifted(s: Structure): Partial<Stockpile> {
    if (!s.lifted) return {};
    s.lifted = false;
    s.moveTo = undefined;
    const back = this.demolishRefund(s);
    this.byId.delete(s.id);
    this.version++;
    return back;
  }

  private layer(s: Structure): Map<number, Structure> {
    return this.layerFor(s.def);
  }

  private layerFor(def: BuildingDef): Map<number, Structure> {
    return isCable(def) ? this.cableByTile : isFloor(def) ? this.floorByTile : this.byTile;
  }

  /** Código de paso de una casilla según lo terminado en ella (la construcción manda sobre el suelo). */
  private refreshBlocked(i: number): void {
    const main = this.byTile.get(i);
    const floor = this.floorByTile.get(i);
    const top = main?.built ? main : floor?.built ? floor : undefined;
    this.map.blocked[i] = !top ? 0 : top.def.blocks ? BLOCK_SOLID : walkableStructureCode(top.def.moveCost ?? 1);
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

  /** Talleres terminados con la electrificación pedida (los colonos la hacen como una obra). */
  upgrades(): Structure[] {
    return this.all().filter((s) => s.built && !!s.upgrade && !s.demolish);
  }

  /** Se puede pedir electrificar este taller. */
  canElectrify(s: Structure): boolean {
    return s.built && !!s.def.electrify && !s.electric && !s.upgrade && !s.demolish;
  }

  /** Pide electrificar un taller: los colonos traerán el material y harán la obra. */
  orderElectrify(s: Structure): boolean {
    if (!this.canElectrify(s)) return false;
    s.upgrade = { delivered: {}, progress: 0 };
    this.version++;
    return true;
  }

  /** Cancela la electrificación pedida. Devuelve el material que ya se había traído. */
  cancelElectrify(s: Structure): Partial<Stockpile> {
    if (!s.upgrade) return {};
    const back = { ...s.upgrade.delivered };
    s.upgrade = undefined;
    this.version++;
    return back;
  }

  /** Termina la electrificación: desde ahora el taller gasta corriente. */
  finishElectrify(s: Structure): void {
    if (!s.def.electrify || s.electric) return;
    s.upgrade = undefined;
    s.electric = true;
    this.version++;
  }

  /** Construcciones terminadas marcadas para demoler. */
  toDemolish(): Structure[] {
    return this.all().filter((s) => s.built && s.demolish);
  }

  /** Marca (o desmarca) una construcción terminada para demolerla (si hay construcción y suelo, la construcción). */
  markDemolish(x: number, y: number, on = true): boolean {
    const s = this.mainAt(x, y)?.built ? this.mainAt(x, y) : this.floorAt(x, y)?.built ? this.floorAt(x, y) : this.cableAt(x, y);
    if (!s || !s.built || !!s.demolish === on) return false;
    s.demolish = on;
    this.version++;
    return true;
  }

  /** Quita una construcción terminada (demolida). Devuelve el material que se recupera. */
  demolish(s: Structure): Partial<Stockpile> {
    if (this.byId.get(s.id) !== s) return {};
    this.byId.delete(s.id);
    for (const t of this.tilesOf(s)) {
      const i = index(this.map, t.x, t.y);
      this.layer(s).delete(i);
      this.refreshBlocked(i);
    }
    this.version++;
    return this.demolishRefund(s);
  }

  /** Material que se recupera al demoler una construcción. */
  private demolishRefund(s: Structure): Partial<Stockpile> {
    const back: Partial<Stockpile> = {};
    // Lo que se desmonta sin romperse (sacos de arena) devuelve todo.
    const share = s.def.fullRefund ? 1 : DEMOLISH_REFUND;
    for (const r of RESOURCES) {
      // La mitad del material y, en un taller, todo lo que tenía dentro.
      // Electrificado, también la mitad de la mejora; a medio electrificar, lo que se había traído.
      const extra = s.electric ? (s.def.electrify?.cost[r] ?? 0) : 0;
      const n = Math.floor(((s.def.cost[r] ?? 0) + extra) * share) + (s.delivered[r] ?? 0) + (s.upgrade?.delivered[r] ?? 0);
      if (n > 0) back[r] = n;
    }
    return back;
  }

  /**
   * Se puede poner un plano en esa casilla: terreno llano y libre, sin objeto ni otra construcción.
   * Sobre un suelo se puede construir de todo menos lo del agua; un suelo va donde no haya otro.
   */
  canPlace(x: number, y: number, def?: BuildingDef, ignore?: Structure): boolean {
    const blocker = buildBlocker(this.map, x, y);
    if (blocker !== null && !(def && slopeOrCliffOk(def, blocker))) return false;
    if (!def) return !this.at(x, y);
    if (isCable(def)) return !this.cableAt(x, y);
    if (isFloor(def)) return !this.floorAt(x, y);
    if (def.category === 'agua' && this.floorAt(x, y)) return false;
    const main = this.mainAt(x, y);
    return !main || (!!ignore && main === ignore);
  }

  /** Cabe una construcción (de varias casillas) en (x, y): todas libres y a la misma altura. */
  canPlaceDef(def: BuildingDef, x: number, y: number, rot: 0 | 1 = 0, ignore?: Structure): boolean {
    const tiles = footprintTiles(def, x, y, rot);
    if (!inBounds(this.map, x, y)) return false;
    const level = this.map.level[index(this.map, x, y)];
    if (!tiles.every((t) => this.canPlace(t.x, t.y, def, ignore) && this.map.level[index(this.map, t.x, t.y)] === level)) return false;
    // La depuradora tiene que tocar agua.
    if (def.nearWater && !tiles.some((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = t.x + dx;
      const ny = t.y + dy;
      return inBounds(this.map, nx, ny) && isWater(this.map.terrain[index(this.map, nx, ny)] as Terrain);
    }))) return false;
    return true;
  }

  /** Coloca un plano con su esquina en (x, y). false si no cabe. */
  place(x: number, y: number, defId: string, rot: 0 | 1 = 0): boolean {
    const def = buildingDef(defId);
    if (!this.canPlaceDef(def, x, y, rot)) return false;
    const s: Structure = { id: this.nextId++, def, x, y, rot, built: false, delivered: {}, progress: 0, hp: def.hp };
    this.byId.set(s.id, s);
    for (const t of footprintTiles(def, x, y, rot)) this.layer(s).set(index(this.map, t.x, t.y), s);
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
    // Primero el plano de construcción; si no hay, el de suelo.
    const main = this.mainAt(x, y);
    const floor = this.floorAt(x, y);
    const s = main && !main.built ? main : floor && !floor.built ? floor : this.cableAt(x, y);
    if (!s || s.built) return null;
    this.byId.delete(s.id);
    for (const t of this.tilesOf(s)) this.layer(s).delete(index(this.map, t.x, t.y));
    this.version++;
    return { ...s.delivered };
  }

  /** Lo que falta por llevar a un plano o, en un taller con orden, para la siguiente tanda. */
  needs(s: Structure): Partial<Stockpile> {
    const out: Partial<Stockpile> = {};
    // Generador: el combustible que le falta para llenarse.
    const f = depositOf(s.def);
    if (s.built && f) {
      const want = f.capacity - Math.ceil(s.fuel ?? 0) - (s.delivered[f.resource] ?? 0);
      if (want > 0) out[f.resource] = want;
      return out;
    }
    // Taller a medio electrificar: el material de la mejora (mientras, no se fabrica).
    if (s.built && s.upgrade && s.def.electrify) {
      for (const r of RESOURCES) {
        const want = (s.def.electrify.cost[r] ?? 0) - (s.upgrade.delivered[r] ?? 0);
        if (want > 0) out[r] = want;
      }
      return out;
    }
    // Una orden «fabricar N» ya terminada no pide más material.
    const active = s.bill && !s.bill.paused && !(s.bill.mode === 'count' && s.bill.target <= 0);
    const wanted = s.built ? (active ? s.bill!.recipe.inputs : {}) : s.def.cost;
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

  /** Cambia el número de la orden (sin bajar de 0 ni pasar de `BILL_MAX_TARGET`). */
  setBillTarget(s: Structure, target: number): void {
    if (!s.bill) return;
    s.bill.target = Math.max(0, Math.min(BILL_MAX_TARGET, Math.floor(Number.isFinite(target) ? target : 0)));
    this.version++;
  }

  /** Cambia entre «fabricar N» y «hasta tener N» (el número se queda igual). */
  setBillMode(s: Structure, mode: BillMode): void {
    if (!s.bill) return;
    s.bill.mode = mode;
    this.version++;
  }

  /** Pausa o reanuda la orden. */
  toggleBillPause(s: Structure): void {
    if (!s.bill) return;
    s.bill.paused = !s.bill.paused;
    this.version++;
  }

  /** Gasta los materiales de una tanda. false si no estaban todos. En «fabricar N», descuenta lo que sale. */
  consumeInputs(s: Structure): boolean {
    if (!s.bill || this.needsAny(s)) return false;
    for (const [r, n] of Object.entries(s.bill.recipe.inputs) as [ResourceId, number][]) {
      s.delivered[r] = (s.delivered[r] ?? 0) - n;
      if (!s.delivered[r]) delete s.delivered[r];
    }
    if (s.bill.mode === 'count') s.bill.target = Math.max(0, s.bill.target - billBatchSize(s.bill));
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
      const store = s.built && s.upgrade ? s.upgrade.delivered : s.delivered;
      store[resource] = (store[resource] ?? 0) + put;
      this.version++;
    }
    return put;
  }

  /** Vuelve a poner una construcción guardada (al cargar una partida). */
  restore(def: BuildingDef, x: number, y: number, built: boolean, delivered: Partial<Stockpile>, progress: number, hp: number, rot: 0 | 1 = 0): Structure | undefined {
    const tiles = footprintTiles(def, x, y, rot);
    const layer = this.layerFor(def);
    // Si ya no cabe (p. ej. ahora ocupa más casillas que cuando se guardó), no se pone.
    if (tiles.some((t) => !inBounds(this.map, t.x, t.y) || layer.has(index(this.map, t.x, t.y)))) return undefined;
    const s: Structure = { id: this.nextId++, def, x, y, rot, built: false, delivered: {}, progress, hp };
    this.byId.set(s.id, s);
    for (const t of tiles) layer.set(index(this.map, t.x, t.y), s);
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
    for (const t of this.tilesOf(s)) this.refreshBlocked(index(this.map, t.x, t.y));
    this.version++;
  }
}
