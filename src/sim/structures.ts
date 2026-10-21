// Construcciones: planos que colocan el jugador y que los colonos completan llevando
// materiales y trabajando. Al terminarse, los muros bloquean el paso y las puertas lo frenan.
import { BuildingDef, buildingDef, depositOf, kitOf } from '../data/buildings';
import { RESOURCES, ResourceId } from '../data/resources';
import type { RecipeDef } from '../data/recipes';
import { BLOCK_SOLID, TRENCH_FLOODED, walkableStructureCode, GameMap, inBounds, index, isPassable, isWater, Prop, TERRAIN_INFO, Terrain } from './map';
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
  /** Bandeja hidropónica: qué cultiva (id de cultivo) y cuánto le falta (0 recién sembrada … 1 madura). */
  crop?: string;
  growth?: number;
  /** Calefactor o aire acondicionado: temperatura elegida (°C; sin ella, la de por defecto). */
  target?: number;
  /** Calefactor o aire acondicionado: está trabajando (pide corriente). No se guarda. */
  climateOn?: boolean;
  /** Taller electrificado: gasta corriente y, si le llega, trabaja el doble de rápido. */
  electric?: boolean;
  /** Electrificación pedida y aún sin terminar: material ya traído y trabajo hecho. */
  upgrade?: { delivered: Partial<Stockpile>; progress: number };
  /** Plano que se monta con un kit del almacén (pide solo el kit y la mitad del trabajo). */
  fromKit?: boolean;
  /** Pedido desmontarla en kit (la desmonta un colono y queda el kit en el suelo). */
  pack?: boolean;
  /** Averiada (suceso «Avería»): parada hasta que un colono la arregle con lo que pide. */
  repair?: { need: Partial<Stockpile>; work: number; delivered: Partial<Stockpile>; progress: number };
  /** Mover: adónde la quiere llevar el jugador (un colono la desmonta y la lleva). */
  moveTo?: { x: number; y: number; rot: 0 | 1 };
  /** La lleva un colono: no ocupa casillas; `x`, `y` y `rot` ya son las del destino. */
  lifted?: boolean;
  /** Mientras se lleva: dónde estaba (por si hay que devolverla). */
  moveFrom?: { x: number; y: number; rot: 0 | 1 };
  /** Puente levadizo: está alzado (no se pasa). */
  raised?: boolean;
  /** Puente levadizo: se quiere alzar (se alza en cuanto no hay nadie encima). */
  wantUp?: boolean;
  /** Puente levadizo: lo alzó solo el raid (al acabar, baja solo). */
  autoRaised?: boolean;
  /** Puente levadizo: ya se ha decidido qué hacer en el raid de ahora (no se guarda). */
  raidHandled?: boolean;
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

/** Se puede tender un puente en la casilla: es agua (de cualquier tipo) y no hay ningún objeto. */
export function canBridge(map: GameMap, x: number, y: number): boolean {
  if (!inBounds(map, x, y)) return false;
  const i = index(map, x, y);
  return isWater(map.terrain[i] as Terrain) && map.props[i] === Prop.None && !map.cliff[i];
}

/**
 * Se puede tender un puente (o apoyar un puente levadizo) en la casilla: agua o un foso con agua
 * (una zanja inundada, con «Hidráulica»), sin ningún objeto.
 */
export function canSpan(map: GameMap, x: number, y: number): boolean {
  if (!inBounds(map, x, y)) return false;
  const i = index(map, x, y);
  return canBridge(map, x, y) || (map.trench[i] === TRENCH_FLOODED && map.props[i] === Prop.None && !map.cliff[i]);
}

/** Se puede poner esa plataforma en la casilla: agua sin objeto; la de madera, no en la profunda. */
export function canPlatform(map: GameMap, def: BuildingDef, x: number, y: number): boolean {
  if (!def.platform || !canBridge(map, x, y)) return false;
  return def.platform.deepWater || map.terrain[index(map, x, y)] !== Terrain.DeepWater;
}

/** Se puede poner en la casilla algo que va en un río (molino de agua): agua poco profunda o normal, sin objeto. */
export function canRiver(map: GameMap, x: number, y: number): boolean {
  return canBridge(map, x, y) && map.terrain[index(map, x, y)] !== Terrain.DeepWater;
}

/** Material que pide una construcción puesta en (x, y): el de su definición o, en un puente sobre agua profunda, más. */
export function structureCost(map: GameMap, def: BuildingDef, x: number, y: number): Partial<Record<ResourceId, number>> {
  if (!def.bridge || def.bridge.deepCostMultiplier === 1 || !inBounds(map, x, y)) return def.cost;
  if (map.terrain[index(map, x, y)] !== Terrain.DeepWater) return def.cost;
  const out: Partial<Record<ResourceId, number>> = {};
  for (const [r, n] of Object.entries(def.cost) as [ResourceId, number][]) out[r] = Math.ceil(n * def.bridge.deepCostMultiplier);
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
  private gatesFor = -1;
  private gates = new Set<number>();

  /** Casillas con puerta de valla construida: los animales no las cruzan. */
  gateTiles(): ReadonlySet<number> {
    if (this.gatesFor !== this.version) {
      this.gatesFor = this.version;
      this.gates = new Set();
      for (const s of this.all()) if (s.built && s.def.gate) for (const t of this.tilesOf(s)) this.gates.add(index(this.map, t.x, t.y));
    }
    return this.gates;
  }

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
    // Un puente levadizo alzado no deja pasar a nadie.
    const up = !!top?.def.drawbridge && !!top.raised;
    this.map.blocked[i] = !top ? 0 : top.def.blocks || up ? BLOCK_SOLID : walkableStructureCode(top.def.moveCost ?? 1);
    // Puentes, plataformas y puentes levadizos bajados: el agua de debajo se anda como suelo.
    const down = !!main?.built && !!main.def.drawbridge && !main.raised;
    // El muelle terminado también se pisa sobre el agua.
    const dock = !!main?.built && !!main.def.dock;
    this.map.bridge[i] = (floor?.built && (floor.def.bridge || floor.def.platform)) || down || dock ? 1 : 0;
  }

  /**
   * Material que pide una construcción. Lo de su definición salvo en un puente sobre agua
   * profunda, que cuesta `bridge.deepCostMultiplier` veces más (elegido por Mikel el 2026-10-18).
   */
  costOf(s: Structure): Partial<Record<ResourceId, number>> {
    const kit = s.fromKit ? kitOf(s.def) : undefined;
    if (kit) return { [kit]: 1 };
    return structureCost(this.map, s.def, s.x, s.y);
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

  /** Máquinas averiadas (los colonos las arreglan como una obra). */
  repairs(): Structure[] {
    return this.all().filter((s) => s.built && !!s.repair && !s.demolish);
  }

  /** Avería: la máquina se para hasta que la arreglen. */
  breakDown(s: Structure, need: Partial<Stockpile>, work: number): boolean {
    if (!s.built || s.repair) return false;
    s.repair = { need: { ...need }, work, delivered: {}, progress: 0 };
    this.version++;
    return true;
  }

  /** Arreglada: vuelve a funcionar (lo que se trajo se gasta). */
  finishRepair(s: Structure): void {
    if (!s.repair) return;
    s.repair = undefined;
    this.version++;
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
    const tiles = this.tilesOf(s);
    this.byId.delete(s.id);
    for (const t of tiles) {
      const i = index(this.map, t.x, t.y);
      this.layer(s).delete(i);
      this.refreshBlocked(i);
    }
    this.version++;
    const back = this.demolishRefund(s);
    // Sin la plataforma, lo que había encima sobre el agua se viene abajo: se recupera como al demolerlo.
    if (s.def.platform) {
      for (const t of tiles) {
        const i = index(this.map, t.x, t.y);
        if (!isWater(this.map.terrain[i] as Terrain)) continue;
        for (const top of [this.byTile.get(i), this.cableByTile.get(i)]) {
          if (!top) continue;
          const got = top.built ? this.demolish(top) : this.dropPlan(top);
          for (const [r, n] of Object.entries(got) as [ResourceId, number][]) back[r] = (back[r] ?? 0) + n;
        }
      }
    }
    return back;
  }

  /** Quita un plano sin terminar y devuelve lo que ya se le había llevado. */
  private dropPlan(s: Structure): Partial<Stockpile> {
    if (this.byId.get(s.id) !== s) return {};
    this.byId.delete(s.id);
    for (const t of this.tilesOf(s)) this.layer(s).delete(index(this.map, t.x, t.y));
    this.version++;
    return { ...s.delivered };
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
      const n = Math.floor(((this.costOf(s)[r] ?? 0) + extra) * share) + (s.delivered[r] ?? 0) + (s.upgrade?.delivered[r] ?? 0);
      if (n > 0) back[r] = n;
    }
    return back;
  }

  /**
   * Se puede poner un plano en esa casilla: terreno llano y libre, sin objeto ni otra construcción.
   * Sobre un suelo se puede construir de todo menos lo del agua; un suelo va donde no haya otro.
   */
  canPlace(x: number, y: number, def?: BuildingDef, ignore?: Structure): boolean {
    // Un puente solo va sobre el agua (cualquiera) sin nada encima.
    if (def?.bridge) return canSpan(this.map, x, y) && !this.floorAt(x, y) && !this.mainAt(x, y);
    if (def?.platform) return canPlatform(this.map, def, x, y) && !this.floorAt(x, y) && !this.mainAt(x, y);
    // El puente levadizo va sobre el agua (cualquiera) o en la orilla, sin nada debajo ni encima.
    if (def?.drawbridge) {
      const main = this.mainAt(x, y);
      if (this.floorAt(x, y) || (main && main !== ignore)) return false;
      return canSpan(this.map, x, y) || buildBlocker(this.map, x, y) === null;
    }
    // El molino de agua y el muelle van en el agua misma: ni en tierra ni sobre un puente o una plataforma.
    if (def?.onWater || def?.dock || def?.fishTrap) {
      const main = this.mainAt(x, y);
      return canRiver(this.map, x, y) && !this.floorAt(x, y) && (!main || (!!ignore && main === ignore));
    }
    let blocker = buildBlocker(this.map, x, y);
    // Sobre una plataforma terminada se construye como en tierra (los suelos y lo del agua, no).
    if (blocker === 'agua' && this.onPlatform(x, y)) blocker = null;
    if (blocker !== null && !(def && slopeOrCliffOk(def, blocker))) return false;
    if (!def) return !this.at(x, y);
    if (isCable(def)) return !this.cableAt(x, y);
    if (isFloor(def)) return !this.floorAt(x, y);
    if (def.category === 'agua' && this.floorAt(x, y)) return false;
    const main = this.mainAt(x, y);
    return !main || (!!ignore && main === ignore);
  }

  /** Muelle (terminado o en plano) pegado por un lado a la casilla. */
  dockBeside(x: number, y: number, ignore?: Structure, builtOnly = false): Structure | undefined {
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(this.map, nx, ny)) continue;
      const other = this.byTile.get(index(this.map, nx, ny));
      if (other && other !== ignore && other.def.dock && (!builtOnly || other.built)) return other;
    }
    return undefined;
  }

  /** La casilla toca por un lado la orilla (tierra) o otro muelle. */
  dockAnchored(x: number, y: number, ignore?: Structure): boolean {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(this.map, nx, ny)) return false;
      const i = index(this.map, nx, ny);
      const other = this.byTile.get(i);
      if (other && other !== ignore && other.def.dock) return true;
      return !isWater(this.map.terrain[i] as Terrain) && !this.map.cliff[i] && this.map.trench[i] !== TRENCH_FLOODED;
    });
  }

  /** Hay una plataforma terminada en la casilla. */
  onPlatform(x: number, y: number): boolean {
    const f = this.floorAt(x, y);
    return !!f && f.built && !!f.def.platform;
  }

  /** Cabe una construcción (de varias casillas) en (x, y): todas libres y a la misma altura. */
  canPlaceDef(def: BuildingDef, x: number, y: number, rot: 0 | 1 = 0, ignore?: Structure): boolean {
    const tiles = footprintTiles(def, x, y, rot);
    if (!inBounds(this.map, x, y)) return false;
    const level = this.map.level[index(this.map, x, y)];
    // El puente levadizo va de una orilla a otra por encima del agua: no hace falta que todo esté a la misma altura.
    if (!tiles.every((t) => this.canPlace(t.x, t.y, def, ignore) && (def.drawbridge || this.map.level[index(this.map, t.x, t.y)] === level))) return false;
    // El muelle va pegado (no en diagonal) a la orilla o a otro muelle, terminado o en plano.
    if (def.dock && !this.dockAnchored(x, y, ignore)) return false;
    // La trampa de pesca, pegada a un muelle.
    if (def.fishTrap && !this.dockBeside(x, y, ignore)) return false;
    // El puente levadizo tiene que tener agua debajo (al menos una casilla).
    if (def.drawbridge && !tiles.some((t) => canSpan(this.map, t.x, t.y))) return false;
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
    // Averiada: lo que hace falta para arreglarla (mientras, nada más).
    if (s.built && s.repair) {
      for (const r of RESOURCES) {
        const want = (s.repair.need[r] ?? 0) - (s.repair.delivered[r] ?? 0);
        if (want > 0) out[r] = want;
      }
      return out;
    }
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
    const wanted = s.built ? (active ? s.bill!.recipe.inputs : {}) : this.costOf(s);
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
      const store = s.built && s.repair ? s.repair.delivered : s.built && s.upgrade ? s.upgrade.delivered : s.delivered;
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

  /** Alza o baja un puente levadizo terminado (cambia el paso por sus casillas). */
  setRaised(s: Structure, up: boolean): void {
    if (!s.def.drawbridge || !!s.raised === up) return;
    s.raised = up;
    for (const t of this.tilesOf(s)) this.refreshBlocked(index(this.map, t.x, t.y));
    this.version++;
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

/** Trabajo de construir un plano (montar un kit lleva la mitad). */
export function buildWork(s: Structure): number {
  return s.fromKit ? Math.ceil(s.def.work / 2) : s.def.work;
}
