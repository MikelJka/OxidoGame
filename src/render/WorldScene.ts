import Phaser from 'phaser';
import { GameMap, describeTile, inBounds } from '../sim/map';
import { activityLabel, Colonist, groupSummary, type Stance } from '../sim/colonist';
import { TURRET_SHOT_TICKS } from '../sim/people';
import { BLAST_TICKS } from '../sim/grenades';
import { mortarShots } from '../sim/mortar';
import { isWalkable } from '../sim/pathfinding';
import { GameSpeed, World } from '../sim/world';
import { loadWorld } from '../sim/save';
import type { Difficulty } from '../sim/storyteller';
import { describeStack } from '../sim/items';
import { canDesignate, TileRect } from '../sim/designations';
import { HARVEST_JOB_NAMES, HarvestJob, MAX_STACK, RESOURCE_NAMES, RESOURCES, ResourceId } from '../data/resources';
import { WorkType } from '../data/work';
import { BuildingDef, buildingDef } from '../data/buildings';
import { missingResearch } from '../sim/research';
import { canZone, STORAGE_PRIORITY_NAMES } from '../sim/zones';
import { footprintTiles, PlaceShape, Structure, Structures } from '../sim/structures';
import { fertilityAt, plantStage } from '../sim/farming';
import { TERRAIN_JOB_NAMES, terrainBlocker, TerrainJob } from '../sim/terrain';
import { CropDef } from '../data/crops';
import { drawBuilding, faceHeight, wallHeight } from './buildArt';
import { paintVehicle, VEHICLE_H, VEHICLE_W } from './vehicleArt';
import { defOf, occupant, Vehicle } from '../sim/vehicles';
import { colonistLookKey, COLONIST_SIZE, CROP_SIZE, ITEM_H, ITEM_W, paintColonist, paintCorpse, paintCrop, paintItem } from './spriteArt';
import { rotOf } from '../sim/corpses';
import { TICKS_PER_DAY } from '../sim/time';
import { canvasPropRasterizer, paintGround, PropRasterizer, TILE } from './mapArt';
import { LIFT, liftOf, occludedFraction, pickTile, rowY, setTilt, TILE_H, tiltIndex, TILTS, TOP_MARGIN } from './projection';
import { fromView, normalizeRotation, Rotation, rotateMap, tileFromView, tileToView, toView } from './rotation';

export { TILE };
const MAP_TEXTURE = 'world-map';
const MAX_ZOOM = 4;
const COLONIST_DEPTH = 10;
/** Marcas de designación: encima de los montones, debajo de los colonos. */
const DESIGN_DEPTH = COLONIST_DEPTH - 1.5;

/** Zonas de almacén: por debajo de todo lo que está encima del suelo. */
const ZONE_DEPTH = -0.5;

/**
 * Modo de órdenes: designar un trabajo, quitar designaciones, marcar o quitar almacenes,
 * colocar planos (la construcción elegida está en `buildDefId`) o quitarlos. null = ninguno.
 */
export type DesignMode = HarvestJob | TerrainJob | 'cancelar' | 'almacen' | 'cultivo' | 'quitarAlmacen' | 'construir' | 'quitarPlano' | 'seleccionar' | 'mover' | null;

/** Color de cada trabajo y modo en las marcas y en la vista previa del área. */
export const DESIGN_COLORS: Record<WorkType | TerrainJob | 'cancelar' | 'almacen' | 'cultivo' | 'quitarAlmacen' | 'quitarPlano' | 'seleccionar' | 'mover', number> = {
  seleccionar: 0xf0d7b0,
  mover: 0x6fa8dc,
  rebajar: 0xc09060,
  elevar: 0xc09060,
  rampa: 0xc09060,
  zanja: 0x9a6a40,
  rellenar: 0xc09060,
  cultivar: 0x8fc060,
  cultivo: 0x8fc060,
  terreno: 0xc09060,
  fabricar: 0xd0a060,
  cocinar: 0xe0a070,
  investigar: 0x9ab0e0,
  curar: 0xe06a6a,
  carcelero: 0xd09040,
  talar: 0x9bc45a,
  minar: 0x8fb4d8,
  saquear: 0xe0913a,
  transportar: 0xd8c27a,
  construir: 0x6fa8dc,
  cancelar: 0xd9534f,
  almacen: 0xd8c27a,
  quitarAlmacen: 0xd9534f,
  quitarPlano: 0xd9534f,
};

/** Color de relleno de un almacén según su prioridad. */
export const ZONE_COLORS: Record<number, number> = { 1: 0x8a7a5a, 2: 0xd8c27a, 3: 0xe0a040, 4: 0xe06a3a };
const UI_EMIT_MS = 200;
/** Giro de los dedos (en radianes) que hace falta para girar la vista un cuarto de vuelta. */
const TWIST_STEP = Math.PI / 4;
/** Desplazamiento vertical (px de pantalla) de los dos dedos a la vez que cambia la inclinación un paso. */
const TILT_DRAG_STEP = 60;

type MoveKeys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

export interface WorldSceneData {
  /** Semilla de un mapa nuevo. */
  seed: number;
  /** Partida guardada (JSON) que cargar en lugar de un mapa nuevo. */
  save?: string;
  /** Colonos al empezar (mapa nuevo). */
  colonists?: number;
  /** Raids, caravanas y supervivientes (mapa nuevo; por defecto, sí). */
  events?: boolean;
  /** Dureza y días sin raids (mapa nuevo; por defecto, Normal). */
  difficulty?: Difficulty;
}

/** Punto continuo de la vista (en casillas). */
interface ViewPoint {
  x: number;
  y: number;
}

/**
 * Escena principal: dibuja el mapa y gestiona la cámara
 * (arrastrar, rueda, pellizco táctil y teclado).
 */
export class WorldScene extends Phaser.Scene {
  world!: World;
  /** Mapa real: el que usa la simulación. */
  map!: GameMap;
  /** Mapa girado tal como se dibuja. Igual a `map` sin giro. */
  view!: GameMap;
  /** Giro de la vista en cuartos de vuelta (se mantiene al generar un mapa nuevo). */
  rotation: Rotation = 0;
  private mapImage?: Phaser.GameObjects.Image;
  private mapTexture?: Phaser.Textures.CanvasTexture;
  private mapPixels?: ImageData;
  private propRaster?: PropRasterizer;
  /** Última X dibujada de cada colono, para saber hacia dónde mira con la vista girada. */
  private lastViewX = new Map<number, number>();
  private pinchStartAngle = 0;
  private pinchStartY: [number, number] = [0, 0];
  selectedId: number | null = null;
  /** false mientras se usa la vista 3D: las teclas y botones de cámara son suyos. */
  cameraKeysEnabled = true;
  /** Colonos elegidos además del principal (selección de grupo). */
  extraIds = new Set<number>();
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  /** Elevación dibujada de cada colono, suavizada al subir o bajar de nivel. */
  private spriteLift = new Map<number, number>();
  private selectionGfx!: Phaser.GameObjects.Graphics;
  /** Dibujos de los montones del suelo; se rehacen cuando cambian (versión) o cambia la vista. */
  private itemSprites: Phaser.GameObjects.Image[] = [];
  private itemsVersion = -1;
  /** Modo de órdenes activo: arrastrar o tocar marca casillas en lugar de mover la cámara. */
  designMode: DesignMode = null;
  /** El próximo «soltar» no cuenta como toque (el clic derecho que ha cancelado un modo). */
  private swallowUp = false;
  private designStart: ViewPoint | null = null;
  private designEnd: ViewPoint | null = null;
  private designGfx!: Phaser.GameObjects.Graphics;
  private designPreview!: Phaser.GameObjects.Graphics;
  private designVersion = -1;
  /** Fantasmas de la vista previa de construcción. */
  private ghostSprites: Phaser.GameObjects.Image[] = [];
  /** Casilla bajo el ratón en modo de órdenes (sin pulsar). */
  private designHover: { x: number; y: number } | null = null;
  /**
   * Con el dedo, lo que se va a construir no se pone al levantarlo: queda aquí, en blanco, hasta
   * que se confirma (✔) o se cancela (✖). Se puede girar o volver a tocar en otro sitio antes.
   */
  private pendingBuild: TileRect | null = null;
  private seenTerrainVersion = 0;
  /** Construcción que se coloca en el modo «construir» y forma del área. */
  buildDefId = 'muro_madera';
  buildShape: PlaceShape = 'contorno';
  /** Giro de la construcción que se coloca (para las de varias casillas). */
  buildRot: 0 | 1 = 0;
  private zoneGfx!: Phaser.GameObjects.Graphics;
  private zoneVersion = -1;
  private structSprites: Phaser.GameObjects.Image[] = [];
  private structVersion = -1;
  private carrySprites = new Map<number, Phaser.GameObjects.Image>();
  /** Dibujo de cada vehículo, por id. */
  private vehicleSprites = new Map<number, Phaser.GameObjects.Image>();
  /** Dibujo de cada cadáver, por id. */
  private corpseSprites = new Map<number, Phaser.GameObjects.Image>();
  /** Vehículo cuyo panel está abierto: tocar el suelo lo manda allí. */
  selectedVehicleId: number | null = null;
  /** Almacén cuyo panel está abierto (se resalta). */
  selectedZoneId: number | null = null;
  /** Huerto cuyo panel está abierto. */
  selectedFarmId: number | null = null;
  private farmVersion = -1;
  private plantSprites: Phaser.GameObjects.Image[] = [];
  private plantsVersion = -1;
  /** Punto del mundo bajo el centro de los dos dedos al empezar el gesto (para moverse con dos dedos). */
  private pinchAnchor = new Phaser.Math.Vector2();
  private uiTimer = 0;
  private dragging = false;
  private dragStart = new Phaser.Math.Vector2();
  private camStart = new Phaser.Math.Vector2();
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private lastPinchAt = -1000;
  private keys?: MoveKeys;

  /** Herramienta del modo Dios activa: recibe la casilla tocada; true si la ha usado. */
  godTap: ((tile: { x: number; y: number }, hit: Colonist | undefined) => boolean) | null = null;

  constructor() {
    super('world');
  }

  create(data: WorldSceneData): void {
    this.world = data.save ? loadOrNew(data.save, data.seed, this.game) : new World({ seed: data.seed, colonists: data.colonists, events: data.events, difficulty: data.difficulty });
    this.map = this.world.map;
    this.selectedId = null;
    this.sprites.clear();
    this.spriteLift.clear();
    this.lastViewX.clear();
    this.mapImage = undefined;
    this.itemSprites = [];
    this.itemsVersion = -1;
    this.designVersion = -1;
    this.zoneVersion = -1;
    this.structVersion = -1;
    this.structSprites = [];
    this.carrySprites.clear();
    this.vehicleSprites.clear();
    this.selectedVehicleId = null;
    this.extraIds.clear();
    // Los paneles abiertos eran del mapa anterior: se cierran.
    this.selectedZoneId = null;
    this.selectedFarmId = null;
    this.selectedStation = null;
    this.game.events.emit('zone-select', null);
    this.game.events.emit('farm-select', null);
    this.game.events.emit('station-select', null);
    this.farmVersion = -1;
    this.plantSprites = [];
    this.plantsVersion = -1;
    this.designStart = null;
    this.designEnd = null;
    this.designHover = null;
    this.pendingBuild = null;
    this.ghostSprites = [];
    this.view = rotateMap(this.map, this.rotation);
    this.drawMap();
    this.selectionGfx = this.add.graphics().setDepth(COLONIST_DEPTH - 1);
    this.designGfx = this.add.graphics().setDepth(DESIGN_DEPTH);
    this.zoneGfx = this.add.graphics().setDepth(ZONE_DEPTH);
    this.designPreview = this.add.graphics().setDepth(COLONIST_DEPTH + 2);
    this.createColonistSprites();

    const cam = this.cameras.main;
    this.applyBounds();
    cam.setBackgroundColor('#141210');
    cam.setZoom(this.clampZoom(Math.max(this.minZoom(), 1.5)));
    this.centerOnTile(this.map.start.x, this.map.start.y);

    this.setupInput();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
    this.game.events.emit('map-ready', this.map);
    this.game.events.emit('selection', null);
    this.emitClock();
    this.game.events.emit('view-rotation', this.rotation);
    this.game.events.emit('view-tilt', tiltIndex);
    this.emitDesignations();
  }

  update(_time: number, delta: number): void {
    this.world.update(delta);
    this.repaintChangedTiles();
    this.syncColonists();
    this.syncVehicles();
    this.syncCorpses();
    this.drawTurretShots();
    this.syncItems();
    this.syncDesignations();
    this.syncZones();
    this.syncStructures();
    this.syncPlants();
    this.drawSelection();
    this.uiTimer += delta;
    if (this.uiTimer >= UI_EMIT_MS) {
      this.uiTimer = 0;
      this.emitClock();
      if (this.selectedId !== null) this.emitSelection();
      if (this.selectedStation) this.game.events.emit('station-tick', this.selectedStation);
      if (this.selectedVehicleId !== null) {
        const v = this.world.vehicle(this.selectedVehicleId);
        if (v) this.game.events.emit('vehicle-select', v);
        else this.selectVehicle(null);
      }
      if (this.selectedPiece) {
        // Demolido mientras se miraba: se cierra el panel.
        if (this.world.structures.get(this.selectedPiece.id) !== this.selectedPiece) this.selectPiece(null);
        else this.game.events.emit('piece-select', this.selectedPiece);
      }
      if (this.selectedZoneId !== null) {
        const z = this.world.zones.get(this.selectedZoneId);
        if (z) this.game.events.emit('zone-tick', z);
      }
      if (this.selectedFarmId !== null) {
        const f = this.world.farms.get(this.selectedFarmId);
        if (f) this.game.events.emit('farm-tick', f);
      }
    }
    if (!this.keys || isTyping() || !this.cameraKeysEnabled) return;
    const cam = this.cameras.main;
    const speed = (0.6 * delta) / cam.zoom;
    const k = this.keys;
    if (k.left.isDown || k.a.isDown) cam.scrollX -= speed;
    if (k.right.isDown || k.d.isDown) cam.scrollX += speed;
    if (k.up.isDown || k.w.isDown) cam.scrollY -= speed;
    if (k.down.isDown || k.s.isDown) cam.scrollY += speed;
  }

  /** Pinta suelo, paredes y objetos (del mapa girado) en una sola textura, fila a fila. */
  private drawMap(): void {
    this.mapImage?.destroy();
    this.mapImage = undefined;
    if (this.textures.exists(MAP_TEXTURE)) this.textures.remove(MAP_TEXTURE);
    const w = this.view.width * TILE;
    const h = this.view.height * TILE_H + TOP_MARGIN;

    const ground = this.textures.createCanvas(MAP_TEXTURE, w, h);
    if (!ground) throw new Error('No se pudo crear la textura del mapa');
    const gctx = ground.getContext();
    const img = gctx.createImageData(w, h);
    this.propRaster ??= canvasPropRasterizer();
    paintGround(this.view, img, this.propRaster);
    gctx.putImageData(img, 0, 0);
    ground.refresh();
    this.mapTexture = ground;
    this.mapPixels = img;
    this.world.takeChangedTiles(); // ya están pintados
    this.mapImage = this.add.image(0, -TOP_MARGIN, MAP_TEXTURE).setOrigin(0, 0).setDepth(-1);
  }

  /**
   * Repinta las columnas del mapa donde ha cambiado un objeto (árbol talado, roca picada…).
   * Solo esas columnas: no hay tirones aunque el mapa sea grande.
   */
  private repaintChangedTiles(): void {
    const changed = this.world.takeChangedTiles();
    if (changed.length === 0 || !this.mapTexture || !this.mapPixels) return;
    const columns = new Set<number>();
    for (const i of changed) {
      const x = i % this.map.width;
      const y = Math.floor(i / this.map.width);
      const v = this.viewTile(x, y);
      if (this.view !== this.map) {
        // La vista girada es una copia: se le pasa el cambio.
        const vi = v.y * this.view.width + v.x;
        this.view.props[vi] = this.map.props[i];
        this.view.stock[vi] = this.map.stock[i];
        this.view.level[vi] = this.map.level[i];
        this.view.cliff[vi] = this.map.cliff[i];
        this.view.slope[vi] = this.map.slope[i];
        this.view.terrain[vi] = this.map.terrain[i];
        this.view.trench[vi] = this.map.trench[i];
      }
      columns.add(v.x);
    }
    // Si ha cambiado el relieve, todo lo que va encima del suelo se recoloca.
    if (this.world.terrainVersion !== this.seenTerrainVersion) {
      this.seenTerrainVersion = this.world.terrainVersion;
      this.itemsVersion = -1;
      this.designVersion = -1;
      this.zoneVersion = -1;
      this.structVersion = -1;
      this.plantsVersion = -1;
      this.spriteLift.clear();
    }
    const ctx = this.mapTexture.getContext();
    const h = this.view.height * TILE_H + TOP_MARGIN;
    for (const col of columns) {
      paintGround(this.view, this.mapPixels, this.propRaster, col);
      ctx.putImageData(this.mapPixels, 0, 0, col * TILE, 0, TILE, h);
    }
    this.mapTexture.refresh();
  }

  private applyBounds(): void {
    this.cameras.main.setBounds(0, -TOP_MARGIN, this.view.width * TILE, this.view.height * TILE_H + TOP_MARGIN);
  }

  // --- Conversión entre el mapa real y la vista girada -------------------------

  /** Posición continua real (en casillas) → punto de la vista. */
  private toViewPoint(x: number, y: number): ViewPoint {
    return toView(x, y, this.map.width, this.map.height, this.rotation);
  }

  /** Casilla real → casilla de la vista. */
  private viewTile(tx: number, ty: number): ViewPoint {
    return tileToView(tx, ty, this.map.width, this.map.height, this.rotation);
  }

  /** Elevación dibujada de una casilla real. */
  /** Trazos de los disparos recientes de las torretas (amarillo si aciertan, gris si fallan), granadas y explosiones. */
  private shotGfx: Phaser.GameObjects.Graphics | null = null;

  private drawTurretShots(): void {
    const shots = this.world.turretShots;
    if (!this.shotGfx) {
      if (shots.length === 0 && this.world.grenades.length === 0 && this.world.blasts.length === 0) return;
      this.shotGfx = this.add.graphics().setDepth(COLONIST_DEPTH + 1.5);
    }
    const g = this.shotGfx;
    g.clear();
    for (const k of shots) {
      const age = (this.world.tick - k.tick) / TURRET_SHOT_TICKS;
      if (age > 1) continue;
      const a = this.toViewPoint(k.from.x + 0.5, k.from.y + 0.5);
      const b = this.toViewPoint(k.to.x + 0.5, k.to.y + 0.5);
      const ay = rowY(a.y) - this.liftAt(k.from.x, k.from.y) - 8;
      const by = rowY(b.y) - this.liftAt(k.to.x, k.to.y) - 4;
      g.lineStyle(1.5, k.hit ? 0xffd27a : 0xb8b0a0, 1 - age);
      g.lineBetween(a.x * TILE, ay, b.x * TILE, by);
    }
    // Granadas en el aire: una bolita que sube y baja en arco hasta donde estalla.
    for (const k of this.world.grenades) {
      const t = Math.min(1, (this.world.tick - k.thrownAt) / Math.max(1, k.explodeAt - k.thrownAt));
      const a = this.toViewPoint(k.from.x + 0.5, k.from.y + 0.5);
      const b = this.toViewPoint(k.to.x + 0.5, k.to.y + 0.5);
      const ay = rowY(a.y) - this.liftAt(k.from.x, k.from.y) - 8;
      const by = rowY(b.y) - this.liftAt(k.to.x, k.to.y) - 2;
      const x = (a.x + (b.x - a.x) * t) * TILE;
      const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * TILE * 1.2;
      g.fillStyle(0x3e4628, 1);
      g.fillCircle(x, y, 2.5);
    }
    // Explosiones: fogonazo naranja que cubre el 3×3 y se apaga.
    for (const k of this.world.blasts) {
      const age = (this.world.tick - k.tick) / BLAST_TICKS;
      if (age > 1) continue;
      const c = this.toViewPoint(k.x + 0.5, k.y + 0.5);
      const cy = rowY(c.y) - this.liftAt(k.x, k.y) - 4;
      g.fillStyle(0xff9a3c, 0.55 * (1 - age));
      g.fillCircle(c.x * TILE, cy, TILE * (0.8 + 0.8 * age));
      g.fillStyle(0xffe08a, 0.8 * (1 - age));
      g.fillCircle(c.x * TILE, cy, TILE * 0.5 * (1 - age));
    }
  }

  private liftAt(tx: number, ty: number): number {
    const v = this.viewTile(tx, ty);
    return liftOf(this.view, v.x, v.y);
  }

  /** Casilla real bajo un punto del mundo (en píxeles), o null. */
  private pickRealTile(wx: number, wy: number): ViewPoint | null {
    const t = pickTile(this.view, wx, wy);
    return t ? tileFromView(t.x, t.y, this.map.width, this.map.height, this.rotation) : null;
  }

  private centerOnTile(tx: number, ty: number): void {
    const v = this.viewTile(tx, ty);
    this.cameras.main.centerOn((v.x + 0.5) * TILE, rowY(v.y + 0.5) - liftOf(this.view, v.x, v.y));
  }

  /** Gira la vista un cuarto de vuelta (+1 horario, −1 antihorario) manteniendo centrado lo que se miraba. */
  rotate(dir: 1 | -1): void {
    this.changeView(() => {
      this.rotation = normalizeRotation(this.rotation + dir);
    });
    this.game.events.emit('view-rotation', this.rotation);
  }

  /** Cambia la inclinación un paso (+1 más de lado, −1 más desde arriba). */
  tilt(dir: 1 | -1): void {
    this.setTiltLevel(tiltIndex + dir);
  }

  /** Pone una inclinación concreta (índice en TILTS). */
  setTiltLevel(index: number): void {
    if (index < 0 || index >= TILTS.length || index === tiltIndex) return;
    this.changeView(() => setTilt(index));
    this.game.events.emit('view-tilt', tiltIndex);
  }

  /** Aplica un cambio de giro o de inclinación, redibuja el mapa y mantiene centrado lo que se miraba. */
  private changeView(apply: () => void): void {
    const cam = this.cameras.main;
    // Centro de la pantalla en el mundo (el zoom de Phaser se aplica respecto al centro).
    const mid = { x: cam.scrollX + cam.width / 2, y: cam.scrollY + cam.height / 2 };
    const tile = this.pickRealTile(mid.x, mid.y);
    const center = tile ?? (() => {
      const p = fromView(mid.x / TILE, mid.y / TILE_H, this.map.width, this.map.height, this.rotation);
      return {
        x: Phaser.Math.Clamp(Math.floor(p.x), 0, this.map.width - 1),
        y: Phaser.Math.Clamp(Math.floor(p.y), 0, this.map.height - 1),
      };
    })();
    apply();
    this.view = rotateMap(this.map, this.rotation);
    this.drawMap();
    this.applyBounds();
    cam.setZoom(this.clampZoom(cam.zoom));
    this.centerOnTile(center.x, center.y);
    this.lastViewX.clear();
    this.spriteLift.clear(); // la altura en píxeles de cada nivel puede haber cambiado
    this.itemsVersion = -1; // los montones cambian de sitio en pantalla
    this.designVersion = -1;
    this.zoneVersion = -1;
    this.structVersion = -1;
    this.plantsVersion = -1;
    this.drawDesignPreview();
  }

  private setupInput(): void {
    this.input.addPointer(1); // segundo dedo para el pellizco
    this.input.mouse?.disableContextMenu();
    const cam = this.cameras.main;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // El botón central es para pivotar la vista libremente: eso lo hace la vista 3D.
      if (p.middleButtonDown()) {
        this.game.events.emit('request-3d');
        return;
      }
      if (this.isPinching()) {
        this.clearDesignDrag();
        this.startPinch();
        return;
      }
      if (this.designMode && p.rightButtonDown()) {
        // Clic derecho mientras se coloca algo (o se marcan órdenes): quita el fantasma y sale del modo.
        this.setDesignMode(null);
        this.swallowUp = true;
        return;
      }
      if (this.designMode) {
        // En modo de órdenes, un dedo (o el ratón) marca un área en lugar de mover la cámara.
        const w = cam.getWorldPoint(p.x, p.y);
        this.designStart = this.pickRealTile(w.x, w.y);
        this.designEnd = this.designStart;
        this.dragging = false;
        this.drawDesignPreview();
        return;
      }
      if (p.rightButtonDown()) {
        // Clic derecho: soltar sin mover da la orden; arrastrar elige a todos los del recuadro.
        const w = cam.getWorldPoint(p.x, p.y);
        this.boxStart = { x: w.x, y: w.y };
        this.dragging = false;
        return;
      }
      this.dragging = true;
      this.dragStart.set(p.x, p.y);
      this.camStart.set(cam.scrollX, cam.scrollY);
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.isPinching()) {
        this.updatePinch();
        return;
      }
      if (this.designMode) {
        if (!p.isDown) {
          const w = cam.getWorldPoint(p.x, p.y);
          this.setDesignHover(this.pickRealTile(w.x, w.y));
        }
        // Solo sigue un área empezada con un toque nuevo (no el dedo que queda tras pellizcar).
        if (p.isDown && this.designStart) {
          const w = cam.getWorldPoint(p.x, p.y);
          const t = this.pickRealTile(w.x, w.y);
          if (t) {
            this.designEnd = t;
            this.drawDesignPreview();
          }
        }
        this.reportTile(p);
        return;
      }
      if (this.boxStart && p.isDown) {
        const w = cam.getWorldPoint(p.x, p.y);
        this.drawSelectBox(this.boxStart, w);
      }
      if (this.dragging && p.isDown) {
        cam.scrollX = this.camStart.x - (p.x - this.dragStart.x) / cam.zoom;
        cam.scrollY = this.camStart.y - (p.y - this.dragStart.y) / cam.zoom;
      }
      this.reportTile(p);
    });

    // Si el dedo se levanta encima de un panel, Phaser avisa con «pointerupoutside»: se cierra el gesto.
    this.input.on('pointerupoutside', () => {
      this.endSelectBox();
      this.dragging = false;
      this.pinchStartDist = 0;
      this.clearDesignDrag();
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.swallowUp) {
        // El clic que ha cancelado el modo construir no cuenta como toque.
        this.swallowUp = false;
        this.dragging = false;
        return;
      }
      const moved = Phaser.Math.Distance.Between(p.downX, p.downY, p.upX, p.upY);
      const wasPinch = this.pinchStartDist > 0 || this.time.now - this.lastPinchAt < 350;
      if (this.boxStart) {
        const start = this.boxStart;
        this.endSelectBox();
        if (moved >= 8 && !wasPinch) {
          const w = cam.getWorldPoint(p.x, p.y);
          this.selectInScreenBox(start, w);
        } else if (!wasPinch) {
          this.handleTap(p);
        }
      } else if (this.designMode) {
        if (!wasPinch) this.finishDesignDrag(p.wasTouch);
        this.clearDesignDrag();
      } else if (moved < 8 && !wasPinch) {
        this.handleTap(p);
      }
      this.dragging = false;
      this.pinchStartDist = 0;
      // Si queda un dedo apoyado tras el pellizco, reanuda el arrastre desde él.
      const remaining = [this.input.pointer1, this.input.pointer2].find((q) => q && q.isDown && q !== p);
      if (remaining) {
        this.dragging = true;
        this.dragStart.set(remaining.x, remaining.y);
        this.camStart.set(cam.scrollX, cam.scrollY);
      }
    });

    this.input.on('wheel', (p: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
      const factor = dy > 0 ? 0.88 : 1.14;
      this.zoomAt(cam.zoom * factor, p.x, p.y);
    });

    const kb = this.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      // Sin captura: si no, el navegador no recibe W, A, S, D al escribir en un cuadro de texto.
      this.keys = kb.addKeys({
        up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
        w: K.W, a: K.A, s: K.S, d: K.D,
      }, false) as MoveKeys;
      const hotkey = (fn: () => void) => () => {
        if (!isTyping()) fn();
      };
      kb.on('keydown-SPACE', hotkey(() => this.setSpeed(this.world.speed === 0 ? 1 : 0)));
      kb.on('keydown-ONE', hotkey(() => this.setSpeed(1)));
      kb.on('keydown-TWO', hotkey(() => this.setSpeed(2)));
      kb.on('keydown-THREE', hotkey(() => this.setSpeed(3)));
      kb.on('keydown-ESC', hotkey(() => (this.attackPick ? this.cancelAttackPick() : this.designMode ? this.setDesignMode(null) : this.select(null))));
      kb.on('keydown-G', hotkey(() => this.toggleDraftSelected()));
      // Con la vista 3D, las teclas de cámara las lleva ella.
      const cam2d = (fn: () => void) => hotkey(() => this.cameraKeysEnabled && fn());
      kb.on('keydown-Q', cam2d(() => this.rotate(-1)));
      kb.on('keydown-E', cam2d(() => this.rotate(1)));
      // Al construir, R gira lo que se va a poner (lo hace main.ts); si no, inclina la vista.
      kb.on('keydown-R', cam2d(() => !this.placing && this.tilt(-1)));
      kb.on('keydown-F', cam2d(() => this.tilt(1)));
    }
  }

  private isPinching(): boolean {
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    return !!(a && b && a.isDown && b.isDown);
  }

  private startPinch(): void {
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    this.dragging = false;
    this.lastPinchAt = this.time.now;
    this.pinchStartDist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    this.pinchStartZoom = this.cameras.main.zoom;
    this.pinchStartAngle = Math.atan2(b.y - a.y, b.x - a.x);
    this.pinchStartY = [a.y, b.y];
    const mid = this.cameras.main.getWorldPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
    this.pinchAnchor.set(mid.x, mid.y);
  }

  private updatePinch(): void {
    if (this.pinchStartDist === 0) this.startPinch();
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    this.lastPinchAt = this.time.now;
    if (this.pinchStartDist < 1) return;
    // Girar los dos dedos gira la vista un cuarto de vuelta por cada 45°.
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const twist = Phaser.Math.Angle.Wrap(angle - this.pinchStartAngle);
    if (Math.abs(twist) >= TWIST_STEP) {
      this.rotate(twist > 0 ? 1 : -1);
      this.pinchStartAngle = angle;
    }
    // Deslizar los dos dedos a la vez hacia arriba o abajo (sin separarlos) cambia la inclinación.
    const dyA = a.y - this.pinchStartY[0];
    const dyB = b.y - this.pinchStartY[1];
    const sameWay = Math.sign(dyA) === Math.sign(dyB);
    const steady = Math.abs(dist / this.pinchStartDist - 1) < 0.2;
    if (sameWay && steady && Math.min(Math.abs(dyA), Math.abs(dyB)) >= TILT_DRAG_STEP) {
      this.tilt(dyA < 0 ? 1 : -1);
      this.startPinch();
      return;
    }
    const zoom = this.pinchStartZoom * (dist / this.pinchStartDist);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    if (this.designMode) {
      // En modo de órdenes un dedo marca, así que con dos dedos además se mueve la cámara:
      // el punto que estaba bajo los dedos los sigue.
      const cam = this.cameras.main;
      const z = this.clampZoom(zoom);
      cam.setZoom(z);
      cam.scrollX = this.pinchAnchor.x - cam.width / 2 - (mx - cam.width / 2) / z;
      cam.scrollY = this.pinchAnchor.y - cam.height / 2 - (my - cam.height / 2) / z;
      return;
    }
    this.zoomAt(zoom, mx, my);
  }

  /** Hace zoom manteniendo fijo el punto de la pantalla (sx, sy). */
  private zoomAt(zoom: number, sx: number, sy: number): void {
    // En Phaser el zoom se aplica respecto al centro de la cámara:
    // mundoX = scrollX + ancho/2 + (pantallaX - ancho/2) / zoom
    const cam = this.cameras.main;
    const hw = cam.width / 2;
    const hh = cam.height / 2;
    const wx = cam.scrollX + hw + (sx - hw) / cam.zoom;
    const wy = cam.scrollY + hh + (sy - hh) / cam.zoom;
    const z = this.clampZoom(zoom);
    cam.setZoom(z);
    cam.scrollX = wx - hw - (sx - hw) / z;
    cam.scrollY = wy - hh - (sy - hh) / z;
  }

  private minZoom(): number {
    const { width, height } = this.scale.gameSize;
    return Math.max(width / (this.view.width * TILE), height / (this.view.height * TILE_H + TOP_MARGIN));
  }

  private clampZoom(z: number): number {
    return Phaser.Math.Clamp(z, this.minZoom(), MAX_ZOOM);
  }

  private onResize(): void {
    const cam = this.cameras.main;
    cam.setZoom(this.clampZoom(cam.zoom));
  }

  setSpeed(speed: GameSpeed): void {
    this.world.speed = speed;
    this.emitClock();
  }

  select(id: number | null): void {
    this.attackPick = false; // cambiar de elegido cancela «atacar a…»
    if (id !== null && this.designMode) this.setDesignMode(null); // elegir un colono sale del modo de órdenes
    if (id !== null) {
      this.selectZone(null);
      this.selectFarm(null);
      this.selectStation(null);
      this.selectPiece(null);
      this.selectVehicle(null);
    }
    this.selectedId = id;
    this.extraIds.clear();
    this.emitSelection();
  }

  /** Añade o quita un colono de la selección (selección de grupo). */
  toggleSelect(id: number): void {
    if (this.selectedId === null) {
      this.select(id);
      return;
    }
    if (this.selectedId === id) {
      // Se quita el principal: pasa a serlo el siguiente.
      const next = [...this.extraIds][0] ?? null;
      this.extraIds.delete(next as number);
      this.selectedId = next;
    } else if (this.extraIds.has(id)) {
      this.extraIds.delete(id);
    } else {
      this.extraIds.add(id);
    }
    this.emitSelection();
  }

  /** Elige a todos los colonos. */
  selectAll(): void {
    const ids = this.world.colonists.map((c) => c.id);
    this.select(ids[0] ?? null);
    for (const id of ids.slice(1)) this.extraIds.add(id);
    this.emitSelection();
  }

  /** Elige a un grupo de personas: los colonos quedan elegidos y del resto se da un resumen. */
  selectPawns(pawns: Colonist[]): void {
    const colonists = pawns.filter((c) => c.role === 'colono');
    const others = pawns.filter((c) => c.role !== 'colono');
    if (colonists.length > 0) {
      this.select(colonists[0].id);
      for (const c of colonists.slice(1)) this.extraIds.add(c.id);
      this.emitSelection();
    }
    if (others.length > 0) {
      this.game.events.emit('toast', groupSummary(others), 4000);
    } else if (colonists.length === 0) {
      this.game.events.emit('toast', 'No hay nadie en el recuadro');
    }
  }

  /** Recuadro del clic derecho arrastrado (en coordenadas del mundo de la cámara). */
  private boxStart: { x: number; y: number } | null = null;
  private boxGfx: Phaser.GameObjects.Graphics | null = null;

  private drawSelectBox(a: { x: number; y: number }, b: { x: number; y: number }): void {
    if (!this.boxGfx) this.boxGfx = this.add.graphics().setDepth(COLONIST_DEPTH + 2);
    const g = this.boxGfx;
    g.clear();
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x);
    const h = Math.abs(a.y - b.y);
    g.fillStyle(0xf0d7b0, 0.12).fillRect(x, y, w, h);
    g.lineStyle(1.5 / this.cameras.main.zoom, 0xf0d7b0, 0.9).strokeRect(x, y, w, h);
  }

  private endSelectBox(): void {
    this.boxStart = null;
    this.boxGfx?.clear();
  }

  /** Elige a las personas cuyo dibujo cae dentro del recuadro (lo que se ve es lo que se elige). */
  private selectInScreenBox(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    const inside = this.world.pawns().filter((c) => {
      const v = this.toViewPoint(c.pos.x, c.pos.y);
      const px = v.x * TILE;
      const py = rowY(v.y) - this.colonistLift(c) - 4; // centro del cuerpo
      return px >= x0 - 3 && px <= x1 + 3 && py >= y0 - 6 && py <= y1 + 6;
    });
    this.selectPawns(inside);
  }

  /** Ids de los colonos elegidos (el principal primero). */
  selectedIds(): number[] {
    return this.selectedId === null ? [] : [this.selectedId, ...this.extraIds];
  }

  /** Esperando a que se toque un enemigo para «atacar a…». */
  attackPick = false;

  /**
   * Postura de los elegidos (null = la normal). «atacar» no se aplica aquí: deja el juego esperando
   * a que se toque un saqueador (`tapAt`).
   */
  setStanceSelected(stance: Stance | null): void {
    const ids = this.selectedIds();
    if (ids.length === 0) return;
    if (stance === 'atacar') {
      this.attackPick = true;
      this.game.events.emit('toast', '🎯 Toca al enemigo que quieres atacar');
      this.emitSelection();
      return;
    }
    this.attackPick = false;
    for (const id of ids) this.world.setStance(id, stance);
    const label = stance === 'mantener' ? '🛡 Mantienen la posición' : stance === 'retirarse' ? '🏃 Se retiran sin pelear' : '⚔ Sin postura: van a por los enemigos cercanos';
    this.game.events.emit('toast', label);
    this.emitSelection();
  }

  /** Deja de esperar el toque de «atacar a…». */
  cancelAttackPick(): void {
    if (!this.attackPick) return;
    this.attackPick = false;
    this.game.events.emit('toast', 'Ataque cancelado');
    this.emitSelection();
  }

  /** Recluta o libera a los elegidos (si alguno no está reclutado, se recluta a todos). */
  toggleDraftSelected(): void {
    const sel = this.world.colonists.filter((c) => this.selectedIds().includes(c.id));
    if (sel.length === 0) return;
    const draft = sel.some((c) => !c.drafted);
    for (const c of sel) this.world.setDrafted(c.id, draft);
    this.game.events.emit('toast', draft ? `🎖 ${sel.length === 1 ? sel[0].name : `${sel.length} colonos`}: reclutado${sel.length > 1 ? 's' : ''}, esperando órdenes` : '🏳 Liberados: vuelven a trabajar');
    this.emitSelection();
  }

  private emitSelection(): void {
    const ids = this.selectedIds();
    this.game.events.emit('selection', this.selected(), this.world.colonists.filter((c) => ids.includes(c.id)));
  }

  /** Quita de la selección a quien ya no es colono (ha muerto o se ha ido) y avisa a la interfaz. */
  refreshSelection(): void {
    const alive = new Set(this.world.colonists.map((c) => c.id));
    for (const id of [...this.extraIds]) if (!alive.has(id)) this.extraIds.delete(id);
    if (this.selectedId !== null && !alive.has(this.selectedId)) {
      const next = [...this.extraIds][0] ?? null;
      if (next !== null) this.extraIds.delete(next);
      this.selectedId = next;
    }
    this.emitSelection();
  }

  /** Centra la cámara en una casilla. */
  focusTile(x: number, y: number): void {
    const v = this.toViewPoint(x + 0.5, y + 0.5);
    this.cameras.main.pan(v.x * TILE, rowY(v.y) - this.liftAt(x, y), 300, 'Sine.easeInOut');
  }

  /** Centra la cámara en un colono. */
  focus(id: number): void {
    const c = this.world.colonists.find((k) => k.id === id);
    if (!c) return;
    const v = this.toViewPoint(c.pos.x, c.pos.y);
    this.cameras.main.pan(v.x * TILE, rowY(v.y) - this.colonistLift(c), 300, 'Sine.easeInOut');
  }

  private selected(): Colonist | null {
    return this.world.colonists.find((c) => c.id === this.selectedId) ?? null;
  }

  private emitClock(): void {
    this.game.events.emit('clock', this.world.clockLabel(), this.world.speed);
    this.game.events.emit('inventory', this.world.inventory());
  }

  /** Toque o clic sin arrastrar: seleccionar colono, dar orden o deseleccionar. */
  private handleTap(p: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    const ev = p.event as MouseEvent | undefined;
    this.tapAt(this.colonistAtScreen(world.x, world.y), this.pickRealTile(world.x, world.y), {
      right: p.rightButtonReleased(),
      additive: !!ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey),
      mouse: !p.wasTouch,
    });
  }

  /**
   * Toque o clic (sin arrastrar) sobre un colono o una casilla real: elegir colono, abrir el
   * panel de lo tocado, mandar a los elegidos u ordenar un trabajo. Lo usan la vista 2D y la 3D.
   */
  tapAt(hit: Colonist | undefined, t: { x: number; y: number } | null, opts: { right: boolean; additive: boolean; mouse?: boolean }): void {
    // Modo Dios con una herramienta elegida: el toque es para ella.
    if (this.godTap && t && this.godTap(t, hit)) return;
    if (this.attackPick) {
      // «Atacar a…»: el toque elige al enemigo; tocar otra cosa lo cancela.
      this.attackPick = false;
      const ids = this.selectedIds();
      // Tocar el buggy de los saqueadores es ir a por quien lo conduce.
      const foeVeh = !hit && t ? this.world.vehicleAt(t.x, t.y) : undefined;
      const foe = foeVeh && defOf(foeVeh).hostile ? occupant(this.world, foeVeh, 'conductor') ?? occupant(this.world, foeVeh, 'tirador') : hit;
      const ok = foe && foe.role === 'saqueador' ? ids.filter((id) => this.world.setStance(id, 'atacar', foe.id)).length : 0;
      this.game.events.emit('toast', ok > 0 ? `🎯 A por ${foe!.name}` : foe && foe.role === 'saqueador' ? 'Ese enemigo ya no puede pelear' : 'Ataque cancelado: no has tocado a un enemigo');
      this.emitSelection();
      return;
    }
    if (hit && hit.role !== 'colono' && !opts.right) {
      // Saqueador, prisionero o comerciante: su panel.
      this.game.events.emit('pawn-tap', hit);
      return;
    }
    if (hit && !opts.right) {
      if (opts.additive) this.toggleSelect(hit.id);
      else this.select(hit.id);
      return;
    }
    // Un vehículo: tocarlo abre su panel; con el panel abierto, tocar el suelo lo manda allí.
    const veh = t && !opts.right ? this.world.vehicleAt(t.x, t.y) : undefined;
    if (veh && defOf(veh).hostile) {
      // El de los saqueadores no se maneja: solo se ve cuánta vida le queda.
      const d = defOf(veh);
      this.game.events.emit('toast', `🚙 ${d.name} · vida ${Math.max(0, Math.ceil(veh.hp))}/${d.hp} · blindaje −${Math.round(d.armor * 100)} %. Recluta a los colonos y ataca a los de dentro.`);
      return;
    }
    if (veh) {
      this.selectVehicle(veh.id);
      return;
    }
    if (this.selectedVehicleId !== null && t) {
      if (opts.mouse && !opts.right) this.selectVehicle(null);
      else {
        this.orderSelectedVehicle(t);
        return;
      }
    }
    if (t) this.reportTileAt(t);
    // Con ratón, el clic izquierdo en el suelo deselecciona; las órdenes van con el derecho.
    // Con el dedo no hay botón derecho: tocar el suelo sigue mandando a los elegidos.
    if (opts.mouse && !opts.right && this.selectedId !== null) this.select(null);
    if (this.selectedId === null) {
      // Sin colono elegido, tocar un almacén abre su panel (filtro y prioridad).
      const z = t ? this.world.zones.at(t.x, t.y) : undefined;
      const f = t ? this.world.farms.at(t.x, t.y) : undefined;
      const st = t ? this.world.structures.at(t.x, t.y) : undefined;
      this.selectZone(z ? z.id : null);
      this.selectFarm(f ? f.id : null);
      this.selectStation(st && st.built && st.def.category === 'taller' ? st : null);
      this.selectPiece(st && st.built && (st.def.movable || st.def.drawbridge) && st.def.category !== 'taller' ? st : null);
      return;
    }
    const tile = t;
    if (!tile) return;
    const { x: tx, y: ty } = tile;
    const ids = this.selectedIds();
    // Con un solo colono, tocar algo con trabajo (lo marcado, un árbol, un plano…) es «hazlo ya».
    if (ids.length === 1 && this.world.hasWorkAt(tx, ty)) {
      const c = this.selected()!;
      if (this.world.forceJob(c.id, tx, ty)) {
        this.flashTarget(tx, ty);
        this.game.events.emit('toast', `${c.name}: ${activityLabel(c).toLowerCase()}`);
        return;
      }
    }
    if (!isWalkable(this.map, tx, ty)) {
      this.game.events.emit('toast', 'No se puede caminar ahí');
      return;
    }
    if (this.world.orderGroupMove(ids, { x: tx, y: ty }) > 0) {
      this.flashTarget(tx, ty);
    } else {
      this.game.events.emit('toast', 'No hay camino hasta ahí');
    }
  }

  private flashTarget(tx: number, ty: number): void {
    if (!this.scene.isVisible()) return; // con la vista 3D, la 2D no se dibuja
    const g = this.add.graphics().setDepth(COLONIST_DEPTH + 1);
    g.lineStyle(2, 0xf0d7b0, 1);
    const v = this.viewTile(tx, ty);
    g.strokeRect(v.x * TILE + 2, v.y * TILE_H - liftOf(this.view, v.x, v.y) + 2, TILE - 4, TILE_H - 4);
    this.tweens.add({ targets: g, alpha: 0, duration: 600, onComplete: () => g.destroy() });
  }

  private createColonistSprites(): void {
    for (const c of this.world.pawns()) this.ensureSprite(c);
  }

  /** Sprite de una persona (colono, saqueador, prisionero, comerciante); lo crea o cambia si hace falta. */
  private ensureSprite(c: Colonist): Phaser.GameObjects.Image {
    const key = `colonist-${this.map.seed}-${colonistLookKey(c)}`;
    if (!this.textures.exists(key)) drawColonistTexture(this, key, c);
    let img = this.sprites.get(c.id);
    if (!img) {
      const lift = this.liftAt(c.tile.x, c.tile.y);
      this.spriteLift.set(c.id, lift);
      const v = this.toViewPoint(c.pos.x, c.pos.y);
      img = this.add.image(v.x * TILE, rowY(v.y) - lift, key).setDepth(COLONIST_DEPTH).setOrigin(0.5, 0.75);
      this.sprites.set(c.id, img);
    } else if (img.texture.key !== key) img.setTexture(key);
    return img;
  }

  private syncColonists(): void {
    const t = this.time.now;
    const pawns = this.world.pawns();
    // Quien se ha ido (o ha muerto) deja de dibujarse.
    const alive = new Set(pawns.map((c) => c.id));
    for (const [id, img] of this.sprites) {
      if (alive.has(id)) continue;
      img.destroy();
      this.sprites.delete(id);
      this.carrySprites.get(id)?.destroy();
      this.carrySprites.delete(id);
    }
    for (const c of pawns) {
      const img = this.ensureSprite(c);
      const walking = c.path.length > 0 && this.world.speed > 0;
      const working = c.activity === 'working' && this.world.speed > 0;
      // Al trabajar, golpes cortos (hacha, pico o palanca); al andar, el paso.
      const bob = walking ? Math.abs(Math.sin(t / 90 + c.id)) * -1.5 : working ? -Math.max(0, Math.sin(t / 70 + c.id)) * 2 : 0;
      // Sube o baja de nivel poco a poco en lugar de saltar.
      const target = this.liftAt(c.tile.x, c.tile.y) + this.towerLift(c.tile.x, c.tile.y);
      const prev = this.spriteLift.get(c.id) ?? target;
      const lift = Math.abs(target - prev) < 0.3 ? target : prev + (target - prev) * 0.25;
      this.spriteLift.set(c.id, lift);
      const v = this.toViewPoint(c.pos.x, c.pos.y);
      const footY = rowY(v.y) - lift;
      img.setPosition(v.x * TILE, footY + bob);
      // Mira hacia donde se mueve en pantalla (con la vista girada no coincide con el mapa).
      if (this.rotation === 0) {
        img.setFlipX(c.facing < 0);
      } else {
        const prevX = this.lastViewX.get(c.id);
        if (prevX !== undefined && Math.abs(v.x - prevX) > 0.001) img.setFlipX(v.x < prevX);
      }
      this.lastViewX.set(c.id, v.x);
      // Detrás de una meseta o pared: se ve como silueta translúcida para no perderlo.
      const vt = this.viewTile(c.tile.x, c.tile.y);
      const hidden = occludedFraction(this.view, v.x * TILE, footY, vt.y);
      img.setAlpha(1 - hidden * 0.6);
      if (hidden > 0) img.setTint(0xb8c4d0);
      else img.clearTint();
      img.setDepth(COLONIST_DEPTH + v.y / 1000 + (c.carriedBy !== undefined ? 0.01 : 0));
      // Dentro de un vehículo no se ve (se ve el vehículo).
      img.setVisible(!c.vehicle?.boarded);
      // Durmiendo o caído: tumbado. A cuestas: un poco más arriba.
      img.setAngle(c.activity === 'sleeping' || c.downed || c.carriedBy !== undefined ? -90 : 0);
      if (c.carriedBy !== undefined) img.y -= 7;
      this.syncCarried(c, img);
    }
  }

  /** Dibuja cada vehículo donde está (centrado en sus 2×2 casillas) y quita los que ya no existen. */
  private syncVehicles(): void {
    const alive = new Set(this.world.vehicles.map((v) => v.id));
    for (const [id, img] of this.vehicleSprites) {
      if (alive.has(id)) continue;
      img.destroy();
      this.vehicleSprites.delete(id);
    }
    for (const v of this.world.vehicles) {
      let img = this.vehicleSprites.get(v.id);
      if (!img) {
        const key = `vehicle-${v.def}`;
        if (!this.textures.exists(key)) {
          const tex = this.textures.createCanvas(key, VEHICLE_W, VEHICLE_H);
          if (tex) {
            paintVehicle(tex.getContext(), v.def);
            tex.refresh();
          }
        }
        img = this.add.image(0, 0, key).setOrigin(0.5, 0.8);
        this.vehicleSprites.set(v.id, img);
      }
      const c = this.toViewPoint(v.pos.x + 1, v.pos.y + 1);
      const lift = Math.max(this.liftAt(v.x, v.y), this.liftAt(v.x + 1, v.y), this.liftAt(v.x, v.y + 1), this.liftAt(v.x + 1, v.y + 1));
      const moving = v.path.length > 0 && this.world.speed > 0;
      const bob = moving ? Math.abs(Math.sin(this.time.now / 60 + v.id)) * -1 : 0;
      img.setPosition(c.x * TILE, rowY(c.y + 0.9) - lift + bob);
      if (this.rotation === 0) img.setFlipX(v.facing < 0);
      img.setDepth(COLONIST_DEPTH + (c.y + 0.9) / 1000);
    }
  }

  /** Dibuja los cadáveres tumbados donde cayeron (más oscuros cuanto más podridos) y quita los que ya no están. */
  private syncCorpses(): void {
    const alive = new Set(this.world.corpses.map((c) => c.id));
    for (const [id, img] of this.corpseSprites) {
      if (alive.has(id)) continue;
      img.destroy();
      this.corpseSprites.delete(id);
    }
    for (const k of this.world.corpses) {
      // Tres dibujos por criatura según lo podrido que esté.
      const stage = Math.min(2, Math.floor(rotOf(k, this.world.tick, TICKS_PER_DAY) * 3));
      const key = `corpse-${k.creature}-${stage}`;
      if (!this.textures.exists(key)) {
        const tex = this.textures.createCanvas(key, COLONIST_SIZE, COLONIST_SIZE);
        if (tex) {
          paintCorpse(tex.getContext(), k.creature, stage / 2);
          tex.refresh();
        }
      }
      let img = this.corpseSprites.get(k.id);
      if (!img) {
        img = this.add.image(0, 0, key).setOrigin(0.5, 0.75).setAngle(-90);
        this.corpseSprites.set(k.id, img);
      } else if (img.texture.key !== key) img.setTexture(key);
      const v = this.toViewPoint(k.x + 0.5, k.y + 0.5);
      img.setPosition(v.x * TILE, rowY(v.y) - this.liftAt(k.x, k.y) - 4);
      img.setDepth(COLONIST_DEPTH + (v.y - 0.1) / 1000);
    }
  }

  // --- Órdenes: designar talar, picar y saquear ----------------------------------

  /** Activa un modo de órdenes (o lo quita con null). */
  setDesignMode(mode: DesignMode): void {
    if (mode !== 'mover') this.moveSid = null;
    this.designMode = mode;
    this.designHover = null;
    this.setPendingBuild(null);
    this.clearDesignDrag();
    if (mode) {
      this.select(null);
      this.selectZone(null);
      this.selectFarm(null);
      this.selectStation(null);
      this.selectPiece(null);
    }
    this.game.events.emit('design-mode', mode);
  }

  /** Mueble o taller que se está llevando a otro sitio (modo «mover»). */
  private moveSid: number | null = null;

  /** Se está poniendo algo (construir o mover): se ve el fantasma bajo el ratón. */
  get placing(): boolean {
    return this.designMode === 'construir' || this.designMode === 'mover';
  }

  movingStructure(): Structure | undefined {
    return this.moveSid === null ? undefined : this.world.structures.get(this.moveSid);
  }

  /** ✋ Mover: se coloca el fantasma del mueble donde se quiera llevar; un colono lo lleva. */
  startMove(s: Structure): void {
    if (!this.world.structures.canMove(s)) {
      this.game.events.emit('toast', s.electric ? 'Electrificado no se mueve: demuélelo para recuperar parte del material' : 'Esto no se puede mover');
      return;
    }
    this.selectStation(null);
    this.selectPiece(null);
    this.buildDefId = s.def.id;
    this.buildRot = s.rot;
    this.moveSid = s.id;
    this.designMode = null; // para que setDesignMode no borre moveSid antes de tiempo
    this.setDesignMode('mover');
    this.moveSid = s.id;
  }

  /** Mueble tocado (cama, armario, lámpara…): su panel con «✋ Mover». */
  private selectedPiece: Structure | null = null;

  selectPiece(s: Structure | null): void {
    if (this.selectedPiece === s) return;
    this.selectedPiece = s;
    this.game.events.emit('piece-select', s);
  }

  /** Abre (o cierra con null) el panel de un vehículo. Mientras está abierto, tocar el suelo lo manda allí. */
  selectVehicle(id: number | null): void {
    if (id !== null) {
      if (this.selectedId !== null) this.select(null);
      this.selectZone(null);
      this.selectFarm(null);
      this.selectStation(null);
      this.selectPiece(null);
      if (this.designMode) this.setDesignMode(null);
    }
    if (this.selectedVehicleId === id) return;
    this.selectedVehicleId = id;
    this.game.events.emit('vehicle-select', id !== null ? this.world.vehicle(id) ?? null : null);
  }

  /** Manda el vehículo elegido a la casilla tocada (avisa si no puede). */
  private orderSelectedVehicle(t: { x: number; y: number }): void {
    const v = this.selectedVehicleId !== null ? this.world.vehicle(this.selectedVehicleId) : undefined;
    if (!v) return;
    const r = this.world.orderVehicleMove(v.id, t);
    const name = defOf(v).name;
    const boat = !!defOf(v).water;
    const icon = boat ? '🛶' : '🚙';
    if (r === 'ok') this.flashTarget(t.x, t.y);
    else if (r === 'sin-conductor') this.game.events.emit('toast', `${icon} ${name}: falta ${boat ? 'quien reme' : 'un conductor'} (elígelo en su panel)`);
    else if (r === 'sin-combustible') this.game.events.emit('toast', `⛽ ${name}: sin combustible (apárcalo junto a un montón de ⛽)`);
    else this.game.events.emit('toast', boat ? `🛶 ${name}: solo va por el agua libre (sin puentes) y ahí no cabe o no llega` : `🚙 ${name}: no cabe o no llega ahí`);
  }

  /** Vista 3D: empieza, sigue y termina un arrastre de órdenes en casillas reales. */
  designBegin(t: { x: number; y: number } | null): void {
    this.designStart = t;
    this.designEnd = t;
    this.drawDesignPreview();
  }

  designUpdate(t: { x: number; y: number } | null): void {
    if (!this.designStart || !t) return;
    this.designEnd = t;
    this.drawDesignPreview();
  }

  designFinish(apply: boolean, touch = false): void {
    if (apply) this.finishDesignDrag(touch);
    this.clearDesignDrag();
  }

  /** Al soltar: con el dedo y al construir, deja la construcción pendiente de confirmar; si no, la aplica. */
  private finishDesignDrag(touch: boolean): void {
    const r = this.designRect();
    if (touch && this.placing && r) {
      this.setPendingBuild(r);
      return;
    }
    this.applyDesignDrag();
  }

  private setPendingBuild(r: TileRect | null): void {
    const had = !!this.pendingBuild;
    this.pendingBuild = r;
    if (had || r) this.game.events.emit('build-pending', !!r);
  }

  /** ¿Hay una construcción esperando ✔ o ✖? */
  get hasPendingBuild(): boolean {
    return !!this.pendingBuild;
  }

  /** ✔ Pone la construcción pendiente. */
  confirmPendingBuild(): void {
    const r = this.pendingBuild;
    if (!r || !this.placing) return;
    this.designStart = { x: r.x0, y: r.y0 };
    this.designEnd = { x: r.x1, y: r.y1 };
    this.applyDesignDrag();
    this.setPendingBuild(null);
    this.clearDesignDrag();
  }

  /** ✖ Quita la construcción pendiente sin ponerla. */
  cancelPendingBuild(): void {
    this.setPendingBuild(null);
    this.drawDesignPreview();
  }

  /** Área que se está arrastrando, o la casilla bajo el ratón al construir (vista previa; también la 3D). */
  currentDesignRect(): TileRect | null {
    return this.previewRect();
  }

  private previewRect(): TileRect | null {
    const r = this.designRect();
    if (r) return r;
    if (this.pendingBuild && this.placing) return this.pendingBuild;
    const h = this.designHover;
    return h && this.placing ? { x0: h.x, y0: h.y, x1: h.x, y1: h.y } : null;
  }

  /** Vuelve a dibujar la vista previa (p. ej. al girar lo que se va a construir). */
  refreshDesignPreview(): void {
    this.drawDesignPreview();
  }

  /** Casilla bajo el ratón (sin pulsar) en modo construir: ahí se ve el fantasma de lo que se va a poner. */
  setDesignHover(t: { x: number; y: number } | null): void {
    if (t?.x === this.designHover?.x && t?.y === this.designHover?.y) return;
    this.designHover = t;
    if (this.placing && !this.designStart && !this.pendingBuild) this.drawDesignPreview();
  }

  /** Casillas de cada construcción que se pondría con el área de la vista previa (máx. 300). */
  ghostGroups(r: TileRect): { tiles: { x: number; y: number }[]; ok: boolean }[] {
    const def = buildingDef(this.buildDefId);
    const st = this.world.structures;
    const [w, h] = def.size ?? [1, 1];
    const groups: { tiles: { x: number; y: number }[]; ok: boolean }[] = [];
    if (w * h > 1 || this.designMode === 'mover') {
      // Al mover, solo cuenta la esquina donde se suelta (un mueble entero, nunca un área).
      const tiles = footprintTiles(def, r.x0, r.y0, this.buildRot).filter((t) => inBounds(this.map, t.x, t.y));
      if (tiles.length) groups.push({ tiles, ok: st.canPlaceDef(def, r.x0, r.y0, this.buildRot, this.movingStructure()) });
    } else {
      for (const t of Structures.areaTiles(r, this.buildShape)) {
        if (groups.length >= 300) break;
        if (!inBounds(this.map, t.x, t.y)) continue;
        const ok = st.canPlace(t.x, t.y, def);
        // En un área solo se ven donde caben; bajo el ratón, también en rojo si no cabe.
        if (ok || (r.x0 === r.x1 && r.y0 === r.y1)) groups.push({ tiles: [t], ok });
      }
    }
    return groups;
  }

  /** Lo que se va a construir, en blanco translúcido, en cada casilla donde cabe. */
  private drawGhosts(r: TileRect): void {
    const def = buildingDef(this.buildDefId);
    for (const { tiles, ok } of this.ghostGroups(r)) {
      const img = this.buildingImage(def, tiles).setTintFill(ok ? 0xffffff : 0xff6a5a).setAlpha(0.55);
      img.setDepth(img.depth + 0.0001);
      this.ghostSprites.push(img);
    }
  }

  /** ¿Se marcaría esta casilla con el modo y el área actuales? (vista previa de la 3D). */
  designHitAt(x: number, y: number, edge: boolean): boolean {
    return this.designHit(x, y, edge);
  }

  private clearDesignDrag(): void {
    this.designStart = null;
    this.designEnd = null;
    this.drawDesignPreview();
  }

  private designRect(): TileRect | null {
    if (!this.designStart || !this.designEnd) return null;
    return { x0: this.designStart.x, y0: this.designStart.y, x1: this.designEnd.x, y1: this.designEnd.y };
  }

  /** Aplica el área arrastrada (o la casilla tocada) con el modo activo. */
  private applyDesignDrag(): void {
    const r = this.designRect();
    const mode = this.designMode;
    if (!r || !mode) return;
    const d = this.world.designations;
    const toast = (text: string) => this.game.events.emit('toast', text);
    if (mode === 'seleccionar') {
      const xa = Math.min(r.x0, r.x1), xb = Math.max(r.x0, r.x1), ya = Math.min(r.y0, r.y1), yb = Math.max(r.y0, r.y1);
      const inside = this.world.pawns().filter((c) => c.tile.x >= xa && c.tile.x <= xb && c.tile.y >= ya && c.tile.y <= yb);
      this.setDesignMode(null);
      this.selectPawns(inside);
      return;
    }
    if (mode === 'almacen') {
      const start = this.designStart ? this.world.zones.at(this.designStart.x, this.designStart.y) : undefined;
      if (start) {
        const n = this.world.extendStorageZone(start.id, r);
        const c = this.world.clearing.countFor('almacen', start.id);
        toast(n > 0 || c > 0 ? `${start.name}: +${n} casillas${clearNote(c)}` : 'Ahí no se puede ampliar');
      } else {
        const z = this.world.createStorageZone(r);
        toast(z ? `${z.name} creado (${z.tiles.size} casillas)${clearNote(this.world.clearing.countFor('almacen', z.id))} · tócalo para el filtro y la prioridad` : 'Ahí no se puede guardar nada');
      }
    } else if (mode === 'cultivo') {
      const start = this.designStart ? this.world.farms.at(this.designStart.x, this.designStart.y) : undefined;
      if (start) {
        const n = this.world.extendGrowZone(start.id, r);
        const c = this.world.clearing.countFor('huerto', start.id);
        toast(n > 0 || c > 0 ? `${start.name}: +${n} casillas${clearNote(c)}` : 'Ahí no se puede ampliar');
      } else {
        const z = this.world.createGrowZone(r);
        toast(z ? `${z.name} creado (${z.tiles.size} casillas)${clearNote(this.world.clearing.countFor('huerto', z.id))} · tócalo para elegir qué plantar` : 'Ahí no se puede cultivar (hace falta tierra)');
      }
    } else if (mode === 'quitarAlmacen') {
      const n = this.world.removeZonesArea(r);
      toast(n > 0 ? `Quitadas ${n} casillas de almacenes y huertos` : 'No había zonas ahí');
    } else if (mode === 'mover') {
      const moving = this.movingStructure();
      const ok = !!moving && this.world.orderMoveStructure(moving.id, r.x0, r.y0, this.buildRot);
      toast(ok ? `✋ ${moving!.def.name}: un colono lo llevará ahí` : 'Ahí no cabe (hace falta suelo llano y libre)');
      if (ok) {
        this.setDesignMode(null);
        return;
      }
    } else if (mode === 'construir') {
      const def = buildingDef(this.buildDefId);
      const n = this.world.placeBuildArea(r, def.id, this.buildShape, this.buildRot);
      const need = missingResearch(this.world.research, def);
      if (need) toast(`🔒 ${def.name}: antes hay que investigar «${need.name}» (📜 → 🔬 Investigación)`);
      else toast(n > 0 ? `${def.name}: ${n} ${n === 1 ? 'plano' : 'planos'}` : 'Ahí no se puede construir (hace falta suelo llano y libre)');
    } else if (mode === 'quitarPlano') {
      const n = this.world.demolishArea(r);
      const parts = [];
      if (n.planos > 0) parts.push(`${n.planos} ${n.planos === 1 ? 'plano quitado' : 'planos quitados'}`);
      if (n.demoler > 0) parts.push(`${n.demoler} para demoler`);
      toast(parts.length ? parts.join(' · ') : 'Ahí no hay construcciones');
    } else if (mode === 'rebajar' || mode === 'elevar' || mode === 'rampa' || mode === 'zanja' || mode === 'rellenar') {
      const n = this.world.terrain.addArea(r, mode, (x, y) => !!this.world.structures.at(x, y));
      toast(n > 0 ? `${TERRAIN_JOB_NAMES[mode]}: ${n} ${n === 1 ? 'casilla' : 'casillas'}` : mode === 'rampa' ? 'Ahí no hay acantilados' : mode === 'rellenar' ? 'Ahí no hay zanjas' : 'Ahí no se puede (agua, construcción, objeto, acantilado o nivel límite)');
    } else if (mode === 'cancelar') {
      const n = d.cancelArea(r) + this.world.terrain.removeArea(r);
      toast(n > 0 ? `${n} ${n === 1 ? 'orden quitada' : 'órdenes quitadas'}` : 'No había órdenes ahí');
    } else {
      const n = d.designateArea(r, mode);
      this.game.events.emit('toast', n > 0 ? `${HARVEST_JOB_NAMES[mode]}: ${n} ${n === 1 ? 'casilla marcada' : 'casillas marcadas'}` : `Ahí no hay nada para ${HARVEST_JOB_NAMES[mode].toLowerCase()}`);
    }
    this.emitDesignations();
  }

  private emitDesignations(): void {
    this.game.events.emit('designations', this.world.designations.counts());
  }

  /** Rectángulo (con la elevación) de una casilla real en la vista. */
  private fillTile(g: Phaser.GameObjects.Graphics, x: number, y: number, inset = 0): void {
    const v = this.viewTile(x, y);
    g.fillRect(v.x * TILE + inset, v.y * TILE_H - liftOf(this.view, v.x, v.y) + inset, TILE - inset * 2, TILE_H - inset * 2);
  }

  /** Vista previa del área que se está arrastrando: borde y casillas que se marcarían. */
  private drawDesignPreview(): void {
    const g = this.designPreview;
    if (!g) return;
    g.clear();
    for (const img of this.ghostSprites) img.destroy();
    this.ghostSprites = [];
    const r = this.previewRect();
    const mode = this.designMode;
    if (!r || !mode) return;
    if ((mode === 'construir' || mode === 'mover') && this.scene.isVisible()) this.drawGhosts(r);
    const xa = Math.max(0, Math.min(r.x0, r.x1));
    const xb = Math.min(this.map.width - 1, Math.max(r.x0, r.x1));
    const ya = Math.max(0, Math.min(r.y0, r.y1));
    const yb = Math.min(this.map.height - 1, Math.max(r.y0, r.y1));
    const color = DESIGN_COLORS[mode];
    const st = this.world.structures;
    // Construcción de varias casillas: se ve lo que ocupará (verde si cabe, rojo si no).
    if (mode === 'construir' || mode === 'mover') {
      const def = buildingDef(this.buildDefId);
      const [w, h] = def.size ?? [1, 1];
      if (w * h > 1 || mode === 'mover') {
        const ok = st.canPlaceDef(def, r.x0, r.y0, this.buildRot, this.movingStructure());
        g.fillStyle(ok ? 0x8fc060 : 0xd9534f, 0.55);
        for (const t of footprintTiles(def, r.x0, r.y0, this.buildRot)) {
          if (inBounds(this.map, t.x, t.y)) this.fillTile(g, t.x, t.y, 1);
        }
        return;
      }
    }
    const hitAt = (x: number, y: number, edge: boolean): boolean => this.designHit(x, y, edge);
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const edge = x === xa || x === xb || y === ya || y === yb;
        const hit = hitAt(x, y, edge);
        if (hit) {
          g.fillStyle(color, 0.55);
          this.fillTile(g, x, y, 1);
        } else if (edge) {
          g.fillStyle(0xf0d7b0, 0.22);
          this.fillTile(g, x, y);
        }
      }
    }
  }

  /** Casilla que se marcaría con el modo de órdenes actual. */
  private designHit(x: number, y: number, edge: boolean): boolean {
    const mode = this.designMode;
    if (!mode) return false;
    const d = this.world.designations;
    const st = this.world.structures;
      switch (mode) {
        case 'cancelar': return d.at(x, y) !== undefined || this.world.terrain.at(x, y) !== undefined;
        case 'rebajar':
        case 'elevar':
        case 'rampa':
        case 'zanja':
        case 'rellenar': return terrainBlocker(this.map, x, y, mode, !!st.at(x, y)) === null;
        case 'almacen': return canZone(this.map, x, y) && !this.world.zones.at(x, y) && !this.world.farms.at(x, y);
        case 'cultivo': return canZone(this.map, x, y) && fertilityAt(this.map, x, y) > 0 && !this.world.zones.at(x, y) && !this.world.farms.at(x, y);
        case 'quitarAlmacen': return this.world.zones.at(x, y) !== undefined || this.world.farms.at(x, y) !== undefined;
        case 'construir': return (this.buildShape === 'relleno' || edge) && st.canPlace(x, y, buildingDef(this.buildDefId));
        case 'quitarPlano': return st.at(x, y) !== undefined;
        case 'mover': return false;
        case 'seleccionar': return this.world.pawns().some((c) => c.tile.x === x && c.tile.y === y);
        default: return canDesignate(this.map, x, y, mode);
      }
  }

  /** Rehace las marcas de las casillas designadas si han cambiado. */
  private syncDesignations(): void {
    const d = this.world.designations;
    const version = d.version * 65536 + this.world.terrain.version;
    if (version === this.designVersion) return;
    this.designVersion = version;
    this.emitDesignations(); // los contadores de los botones bajan según se trabaja
    const g = this.designGfx;
    g.clear();
    // Obras de terreno: esquinas y una flecha (abajo rebajar, arriba elevar) o una rampa.
    for (const o of this.world.terrain.list()) {
      const v = this.viewTile(o.x, o.y);
      const left = v.x * TILE;
      const top = v.y * TILE_H - liftOf(this.view, v.x, v.y);
      const color = DESIGN_COLORS.terreno;
      g.lineStyle(1.5, color, 0.95);
      g.strokeRect(left + 1, top + 1, TILE - 2, TILE_H - 2);
      const cx = left + TILE / 2;
      const cy = top + TILE_H / 2;
      g.fillStyle(color, 1);
      if (o.job === 'rebajar') g.fillTriangle(cx - 4, cy - 2, cx + 4, cy - 2, cx, cy + 3);
      else if (o.job === 'elevar') g.fillTriangle(cx - 4, cy + 2, cx + 4, cy + 2, cx, cy - 3);
      else if (o.job === 'zanja') g.fillRect(cx - 5, cy - 1, 10, 3);
      else if (o.job === 'rellenar') {
        g.fillRect(cx - 5, cy - 1, 10, 3);
        g.fillTriangle(cx - 3, cy - 3, cx + 3, cy - 3, cx, cy - 6);
      } else {
        g.lineStyle(2, color, 1);
        g.lineBetween(left + 3, top + TILE_H - 3, left + TILE - 3, top + 3);
      }
    }
    for (const m of d.list()) {
      const v = this.viewTile(m.x, m.y);
      const left = v.x * TILE;
      const top = v.y * TILE_H - liftOf(this.view, v.x, v.y);
      const color = DESIGN_COLORS[m.job];
      // Esquinas de la casilla.
      g.lineStyle(1.5, color, 0.95);
      const k = 4;
      const r = left + TILE;
      const b = top + TILE_H;
      g.beginPath();
      g.moveTo(left, top + k); g.lineTo(left, top); g.lineTo(left + k, top);
      g.moveTo(r - k, top); g.lineTo(r, top); g.lineTo(r, top + k);
      g.moveTo(left, b - k); g.lineTo(left, b); g.lineTo(left + k, b);
      g.moveTo(r - k, b); g.lineTo(r, b); g.lineTo(r, b - k);
      g.strokePath();
      // Rombo sobre el objeto (los árboles y rocas sobresalen hacia arriba).
      const cx = left + TILE / 2;
      const cy = top - 6;
      g.fillStyle(0x1a1410, 1);
      g.fillTriangle(cx - 4, cy, cx, cy - 4, cx + 4, cy);
      g.fillTriangle(cx - 4, cy, cx, cy + 4, cx + 4, cy);
      g.fillStyle(color, 1);
      g.fillTriangle(cx - 3, cy, cx, cy - 3, cx + 3, cy);
      g.fillTriangle(cx - 3, cy, cx, cy + 3, cx + 3, cy);
    }
  }

  /** Abre (o cierra con null) el panel de un almacén. */
  selectZone(id: number | null): void {
    if (this.selectedZoneId === id) return;
    this.selectedZoneId = id;
    this.zoneVersion = -1;
    this.game.events.emit('zone-select', id === null ? null : this.world.zones.get(id) ?? null);
  }

  /** Avisa a la interfaz de que el almacén abierto ha cambiado (prioridad, filtro). */
  refreshZone(): void {
    const z = this.selectedZoneId === null ? undefined : this.world.zones.get(this.selectedZoneId);
    if (!z) this.selectedZoneId = null;
    this.game.events.emit('zone-select', z ?? null);
  }

  /** Taller cuyo panel está abierto. */
  selectedStation: Structure | null = null;

  /** Abre (o cierra con null) el panel de un taller. */
  selectStation(s: Structure | null): void {
    if (this.selectedStation === s) return;
    this.selectedStation = s;
    this.game.events.emit('station-select', s);
  }

  /** Avisa a la interfaz de que el taller abierto ha cambiado. */
  refreshStation(): void {
    const s = this.selectedStation;
    if (s && this.world.structures.at(s.x, s.y) !== s) this.selectedStation = null;
    this.game.events.emit('station-select', this.selectedStation);
  }

  /** Abre (o cierra con null) el panel de un huerto. */
  selectFarm(id: number | null): void {
    if (this.selectedFarmId === id) return;
    this.selectedFarmId = id;
    this.farmVersion = -1;
    this.zoneVersion = -1;
    this.game.events.emit('farm-select', id === null ? null : this.world.farms.get(id) ?? null);
  }

  refreshFarm(): void {
    const f = this.selectedFarmId === null ? undefined : this.world.farms.get(this.selectedFarmId);
    if (!f) this.selectedFarmId = null;
    this.game.events.emit('farm-select', f ?? null);
  }

  /** Rehace las plantas de los huertos si han cambiado (sembradas, cosechadas o de otra fase). */
  private syncPlants(): void {
    const farms = this.world.farms;
    if (farms.version === this.plantsVersion) return;
    this.plantsVersion = farms.version;
    for (const img of this.plantSprites) img.destroy();
    this.plantSprites = [];
    for (const { x, y, plant } of farms.plantList()) {
      const stage = plantStage(plant);
      const key = `crop-${plant.crop.id}-${stage}`;
      if (!this.textures.exists(key)) drawCropTexture(this, key, plant.crop, stage);
      const v = this.viewTile(x, y);
      const cx = (v.x + 0.5) * TILE;
      const bottom = (v.y + 1) * TILE_H - liftOf(this.view, v.x, v.y);
      const img = this.add.image(cx, bottom, key).setOrigin(0.5, 1);
      img.setDepth(COLONIST_DEPTH + (v.y + 0.35) / 1000);
      this.plantSprites.push(img);
    }
  }

  /** Rehace el dibujo de almacenes y huertos si han cambiado. */
  private syncZones(): void {
    const zones = this.world.zones;
    const farms = this.world.farms;
    if (zones.version === this.zoneVersion && farms.zoneVersion === this.farmVersion) return;
    this.zoneVersion = zones.version;
    this.farmVersion = farms.zoneVersion;
    const g = this.zoneGfx;
    g.clear();
    for (const f of farms.all()) {
      const sel = f.id === this.selectedFarmId;
      // Surcos: tierra más oscura con el borde verde.
      g.fillStyle(0x4a3a24, sel ? 0.5 : 0.35);
      for (const i of f.tiles) this.fillTile(g, i % this.map.width, Math.floor(i / this.map.width), 0.5);
      g.lineStyle(1, 0x8fc060, sel ? 1 : 0.7);
      for (const i of f.tiles) this.strokeZoneEdges(g, (x, y) => this.world.farms.at(x, y)?.id === f.id, i % this.map.width, Math.floor(i / this.map.width));
    }
    for (const z of zones.all()) {
      const sel = z.id === this.selectedZoneId;
      g.fillStyle(ZONE_COLORS[z.priority], sel ? 0.4 : 0.22);
      for (const i of z.tiles) this.fillTile(g, i % this.map.width, Math.floor(i / this.map.width), 0.5);
      // Borde donde la casilla vecina no es de la misma zona.
      g.lineStyle(1, ZONE_COLORS[z.priority], sel ? 1 : 0.7);
      for (const i of z.tiles) this.strokeZoneEdges(g, (x, y) => this.world.zones.at(x, y)?.id === z.id, i % this.map.width, Math.floor(i / this.map.width));
    }
  }

  private strokeZoneEdges(g: Phaser.GameObjects.Graphics, inZone: (x: number, y: number) => boolean, x: number, y: number): void {
    // Se trabaja en la vista: los lados de la casilla girada.
    const v = this.viewTile(x, y);
    const left = v.x * TILE;
    const top = v.y * TILE_H - liftOf(this.view, v.x, v.y);
    const same = (vx: number, vy: number) => {
      const t = tileFromView(vx, vy, this.map.width, this.map.height, this.rotation);
      return inZone(t.x, t.y);
    };
    g.beginPath();
    if (!same(v.x, v.y - 1)) { g.moveTo(left, top); g.lineTo(left + TILE, top); }
    if (!same(v.x, v.y + 1)) { g.moveTo(left, top + TILE_H); g.lineTo(left + TILE, top + TILE_H); }
    if (!same(v.x - 1, v.y)) { g.moveTo(left, top); g.lineTo(left, top + TILE_H); }
    if (!same(v.x + 1, v.y)) { g.moveTo(left + TILE, top); g.lineTo(left + TILE, top + TILE_H); }
    g.strokePath();
  }

  /** Rehace los dibujos de muros, puertas y planos si han cambiado. */
  private syncStructures(): void {
    const st = this.world.structures;
    if (st.version === this.structVersion) return;
    this.structVersion = st.version;
    for (const img of this.structSprites) img.destroy();
    this.structSprites = [];
    for (const s of st.all()) {
      const img = this.buildingImage(s.def, st.tilesOf(s), !!s.raised);
      if (!s.built) img.setAlpha(0.45).setTint(0x8fc0ff); // plano: translúcido y azulado
      else if (s.demolish) img.setTint(0xff8a7a); // marcada para demoler: rojiza
      this.structSprites.push(img);
      if (s.moveTo) {
        // Adónde se va a llevar: su fantasma en blanco.
        const ghost = this.buildingImage(s.def, footprintTiles(s.def, s.moveTo.x, s.moveTo.y, s.moveTo.rot)).setTintFill(0xffffff).setAlpha(0.35);
        this.structSprites.push(ghost);
      }
    }
    // Lo que un colono está llevando: el fantasma en su sitio nuevo.
    for (const s of st.liftedList()) {
      this.structSprites.push(this.buildingImage(s.def, st.tilesOf(s)).setTintFill(0xffffff).setAlpha(0.35));
    }
  }

  /** Imagen de una construcción que ocupa esas casillas reales (vista con el giro actual). */
  private buildingImage(def: BuildingDef, tiles: { x: number; y: number }[], raised = false): Phaser.GameObjects.Image {
    const unitH = wallHeight(LIFT);
    const vt = tiles.map((t) => this.viewTile(t.x, t.y));
    const vx0 = Math.min(...vt.map((t) => t.x));
    const vy0 = Math.min(...vt.map((t) => t.y));
    const vw = Math.max(...vt.map((t) => t.x)) - vx0 + 1;
    const vh = Math.max(...vt.map((t) => t.y)) - vy0 + 1;
    const key = `build-${def.id}${raised ? '-alzado' : ''}-${TILE_H}-${unitH}-${vw}x${vh}`;
    if (!this.textures.exists(key)) drawBuildingTexture(this, key, def, unitH, vw, vh, raised);
    const top = vy0 * TILE_H - liftOf(this.view, vx0, vy0);
    const img = this.add.image(vx0 * TILE, top - faceHeight(def, LIFT), key).setOrigin(0, 0);
    // Delante de lo que está en su fila y en las de detrás; detrás de lo que está más al sur.
    // Torres, cosas a ras de suelo y estanterías, por debajo de lo que tienen encima o delante.
    const flat = def.height === 0;
    const rowOffset = def.category === 'torre' || flat || def.storage ? 0.3 : 0.99;
    // Los suelos van pegados al suelo, debajo de montones y colonos.
    // Los cables, encima de los suelos.
    img.setDepth(def.category === 'suelo' ? ZONE_DEPTH - 0.1 : def.conduit ? ZONE_DEPTH - 0.05 : COLONIST_DEPTH + (vy0 + vh - 1 + rowOffset) / 1000);
    return img;
  }

  /** Dibuja lo que lleva cada colono encima de la cabeza. */
  private syncCarried(c: Colonist, img: Phaser.GameObjects.Image): void {
    let carry = this.carrySprites.get(c.id);
    if (!c.carrying) {
      carry?.setVisible(false);
      return;
    }
    const key = itemTextureKey(c.carrying.resource);
    if (!this.textures.exists(key)) drawItemTexture(this, key, c.carrying.resource);
    if (!carry) {
      carry = this.add.image(0, 0, key).setOrigin(0.5, 1).setScale(0.7);
      this.carrySprites.set(c.id, carry);
    }
    carry.setTexture(key).setVisible(true).setPosition(img.x, img.y - 11).setDepth(img.depth + 0.00001).setAlpha(img.alpha);
  }

  /** Rehace los dibujos de los montones del suelo si han cambiado. */
  private syncItems(): void {
    const items = this.world.items;
    if (items.version === this.itemsVersion) return;
    this.itemsVersion = items.version;
    for (const img of this.itemSprites) img.destroy();
    this.itemSprites = [];
    for (const s of items.list()) {
      const key = itemTextureKey(s.resource);
      if (!this.textures.exists(key)) drawItemTexture(this, key, s.resource);
      const v = this.viewTile(s.x, s.y);
      const cx = (v.x + 0.5) * TILE;
      const cy = rowY(v.y + 0.5) - liftOf(this.view, v.x, v.y);
      // Un montón casi vacío se ve más pequeño que uno lleno.
      const scale = 0.7 + 0.3 * Math.min(1, s.amount / MAX_STACK[s.resource]);
      const img = this.add.image(cx, cy + 2, key).setOrigin(0.5, 0.8).setScale(scale);
      // Por filas, como colonos y muros: lo de delante tapa lo de detrás.
      img.setDepth(COLONIST_DEPTH + (v.y + 0.4) / 1000);
      // Detrás de una meseta o pared: casi transparente, como los colonos.
      const above = pickTile(this.view, cx, cy - 2);
      if (above && above.y > v.y) img.setAlpha(0.35).setTint(0xb8c4d0);
      this.itemSprites.push(img);
    }
  }

  private drawSelection(): void {
    const g = this.selectionGfx;
    g.clear();
    this.drawJobProgress(g);
    // Barra de salud sobre quien está herido.
    for (const k of this.world.pawns()) {
      if (k.health >= 0.999 || k.carriedBy !== undefined) continue;
      const v = this.toViewPoint(k.pos.x, k.pos.y);
      const top = rowY(v.y) - this.colonistLift(k) - (k.downed ? 10 : 19);
      const w = 12;
      g.fillStyle(0x1a1410, 0.9);
      g.fillRect(v.x * TILE - w / 2 - 1, top - 1, w + 2, 4);
      g.fillStyle(k.health > 0.5 ? 0x7fae5a : k.health > 0.25 ? 0xd9a22b : 0xc8442c, 1);
      g.fillRect(v.x * TILE - w / 2, top, Math.max(1, Math.round(w * k.health)), 2);
    }
    // Los reclutados llevan un banderín sobre la cabeza.
    for (const k of this.world.colonists) {
      if (!k.drafted) continue;
      const v = this.toViewPoint(k.pos.x, k.pos.y);
      const top = rowY(v.y) - this.colonistLift(k) - 17;
      g.fillStyle(0x1a1410, 1);
      g.fillRect(v.x * TILE - 1, top - 1, 2, 8);
      g.fillStyle(0xd96c2c, 1);
      g.fillTriangle(v.x * TILE + 1, top - 1, v.x * TILE + 7, top + 2, v.x * TILE + 1, top + 5);
    }
    for (const id of this.extraIds) {
      const k = this.world.colonists.find((q) => q.id === id);
      if (!k) continue;
      const v = this.toViewPoint(k.pos.x, k.pos.y);
      g.lineStyle(2, 0xd96c2c, 0.8);
      g.strokeEllipse(v.x * TILE, rowY(v.y) - this.colonistLift(k) + 2, TILE * 0.95, TILE_H * 0.45);
    }
    const sv = this.selectedVehicleId !== null ? this.world.vehicle(this.selectedVehicleId) : undefined;
    if (sv) this.drawVehicleSelection(g, sv);
    const c = this.selected();
    if (!c) return;
    const lift = this.colonistLift(c);
    const here = this.toViewPoint(c.pos.x, c.pos.y);
    if (c.path.length > 0) {
      g.lineStyle(1.5, 0xf0d7b0, 0.6);
      g.beginPath();
      g.moveTo(here.x * TILE, rowY(here.y) - lift);
      for (const p of c.path) {
        const v = this.viewTile(p.x, p.y);
        g.lineTo((v.x + 0.5) * TILE, rowY(v.y + 0.5) - liftOf(this.view, v.x, v.y));
      }
      g.strokePath();
      const last = c.path[c.path.length - 1];
      const end = this.viewTile(last.x, last.y);
      g.strokeRect(end.x * TILE + 3, end.y * TILE_H - liftOf(this.view, end.x, end.y) + 2, TILE - 6, TILE_H - 4);
    }
    g.lineStyle(2, 0xd96c2c, 1);
    g.strokeEllipse(here.x * TILE, rowY(here.y) - lift + 2, TILE * 0.95, TILE_H * 0.45);
  }

  /** Barra de progreso sobre cada objeto que se está trabajando. */
  private drawJobProgress(g: Phaser.GameObjects.Graphics): void {
    for (const c of this.world.colonists) {
      const j = c.job;
      if (!j || c.activity !== 'working') continue;
      const v = this.viewTile(j.x, j.y);
      const left = v.x * TILE + 1;
      const top = v.y * TILE_H - liftOf(this.view, v.x, v.y) - 14;
      const w = TILE - 2;
      const frac = Math.min(1, j.progress / j.work);
      g.fillStyle(0x1a1410, 0.9);
      g.fillRect(left - 1, top - 1, w + 2, 4);
      g.fillStyle(DESIGN_COLORS[j.kind], 1);
      g.fillRect(left, top, Math.max(1, Math.round(w * frac)), 2);
    }
  }

  private reportTile(p: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    const tile = this.pickRealTile(world.x, world.y);
    if (tile) this.reportTileAt(tile);
  }

  /** Muestra la información de una casilla real. */
  reportTileAt(tile: { x: number; y: number }): void {
    if (!inBounds(this.map, tile.x, tile.y)) return;
    const stack = this.world.items.at(tile.x, tile.y);
    const job = this.world.designations.at(tile.x, tile.y);
    let text = describeTile(this.map, tile.x, tile.y);
    if (stack) text = `${describeStack(stack, RESOURCE_NAMES)} · ${text}`;
    if (job) text += ` · orden: ${HARVEST_JOB_NAMES[job].toLowerCase()}`;
    const zone = this.world.zones.at(tile.x, tile.y);
    if (zone) text = `${zone.name} (${STORAGE_PRIORITY_NAMES[zone.priority].toLowerCase()}) · ${text}`;
    const room = this.world.rooms.at(tile.x, tile.y);
    if (room) text = `Habitación (${room.tiles.length} casillas, ${room.doors} ${room.doors === 1 ? 'puerta' : 'puertas'}) · ${text}`;
    const farm = this.world.farms.at(tile.x, tile.y);
    const plant = this.world.farms.plantAt(tile.x, tile.y);
    if (plant) text = `${plant.crop.name} ${plant.growth >= 1 ? 'maduras' : `${Math.floor(plant.growth * 100)} %`} · ${text}`;
    if (farm) text = `${farm.name} (${farm.crop.name.toLowerCase()}, fertilidad ${Math.round(fertilityAt(this.map, tile.x, tile.y) * 100)} %) · ${text}`;
    const floor = this.world.structures.floorAt(tile.x, tile.y);
    const s = this.world.structures.mainAt(tile.x, tile.y);
    if (floor) text = `${structureLabel(this.world.structures, floor)} · ${text}`;
    const cable = this.world.structures.cableAt(tile.x, tile.y);
    if (cable) text = `${structureLabel(this.world.structures, cable)}${cable.built ? powerLabel(this.world, cable) : ''} · ${text}`;
    if (s) text = `${structureLabel(this.world.structures, s)}${s.built && s.def.sight ? ` (vista ${s.def.sight} casillas)` : ''}${s.built ? powerLabel(this.world, s) : ''} · ${text}`;
    this.game.events.emit('tile-info', text);
  }

  /** Altura extra de quien está subido a una torre terminada. */
  private towerLift(x: number, y: number): number {
    const s = this.world.structures.at(x, y);
    return s && s.built && s.def.category === 'torre' ? faceHeight(s.def, LIFT) : 0;
  }

  /** Elevación con la que se dibuja ahora mismo un colono. */
  private colonistLift(c: Colonist): number {
    return this.spriteLift.get(c.id) ?? this.liftAt(c.tile.x, c.tile.y);
  }

  /** Marco del vehículo elegido y la ruta que le queda. */
  private drawVehicleSelection(g: Phaser.GameObjects.Graphics, v: Vehicle): void {
    const c = this.toViewPoint(v.pos.x + 1, v.pos.y + 1);
    const lift = this.liftAt(v.x, v.y);
    g.lineStyle(2, 0xf0d7b0, 0.9);
    g.strokeEllipse(c.x * TILE, rowY(c.y + 0.6) - lift, TILE * 2.3, TILE_H * 1.3);
    if (v.path.length === 0) return;
    g.lineStyle(1.5, 0xf0d7b0, 0.6);
    g.beginPath();
    g.moveTo(c.x * TILE, rowY(c.y) - lift);
    for (const p of v.path) {
      const q = this.toViewPoint(p.x + 1, p.y + 1);
      g.lineTo(q.x * TILE, rowY(q.y) - this.liftAt(p.x, p.y));
    }
    g.strokePath();
  }

  /** Colono dibujado bajo un punto del mundo (en píxeles), el de más delante si hay varios. */
  private colonistAtScreen(wx: number, wy: number): Colonist | undefined {
    let best: Colonist | undefined;
    let bestDist = TILE * 0.9;
    for (const c of this.world.pawns()) {
      if (c.vehicle?.boarded) continue; // dentro de un vehículo: se toca el vehículo
      // Centro del cuerpo: el sprite se ancla en los pies.
      const v = this.toViewPoint(c.pos.x, c.pos.y);
      const d = Math.hypot(v.x * TILE - wx, rowY(v.y) - this.colonistLift(c) - 4 - wy);
      if (d <= bestDist) {
        best = c;
        bestDist = d;
      }
    }
    return best;
  }
}

/** El jugador está escribiendo en un cuadro de texto: el teclado no mueve la cámara ni cambia la velocidad. */
/** Aviso de lo que hay que despejar dentro de una zona nueva o ampliada (#14). */
function clearNote(n: number): string {
  return n > 0 ? ` · ${n} ${n === 1 ? 'casilla' : 'casillas'} por despejar (árboles, rocas o chatarra)` : '';
}

function isTyping(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);
}


function itemTextureKey(r: ResourceId): string {
  return `item-${r}`;
}


/** Texto de una construcción o plano para la información de casilla. */
function structureLabel(st: Structures, s: Structure): string {
  if (s.built) return s.def.name;
  const needs = st.needs(s);
  const cost = st.costOf(s);
  const parts = RESOURCES.filter((r) => (cost[r] ?? 0) > 0).map(
    (r) => `${RESOURCE_NAMES[r].toLowerCase()} ${(cost[r] ?? 0) - (needs[r] ?? 0)}/${cost[r]}`,
  );
  return `Plano: ${s.def.name} (${parts.join(', ')})`;
}

/** Estado eléctrico de una construcción y de su red, para la información de la casilla. */
function powerLabel(w: World, s: Structure): string {
  const parts: string[] = [];
  const f = s.def.fuel;
  // Averiada: lo primero que se ve (está parada hasta que la arreglen).
  if (s.repair) parts.push(`🔧 averiada: parada hasta que un colono con «Construir» la arregle`);
  if (f && s.def.burnsCorpses) parts.push(s.powered ? 'encendida: quema los cadáveres' : 'apagada: hace falta leña', `${RESOURCE_NAMES[f.resource].toLowerCase()} ${Math.ceil(s.fuel ?? 0)}/${f.capacity}`);
  else if (s.def.mortar) parts.push(mortarShots(s) > 0 ? `${mortarShots(s)} disparos: lo maneja un colono reclutado pegado a él` : 'sin munición: hace falta chatarra', `${RESOURCE_NAMES[s.def.mortar.ammo.resource].toLowerCase()} ${Math.floor(s.fuel ?? 0)}/${s.def.mortar.ammo.capacity}`);
  else if (f) parts.push(s.powered ? 'en marcha' : `sin ${RESOURCE_NAMES[f.resource].toLowerCase()}`, `${RESOURCE_NAMES[f.resource].toLowerCase()} ${Math.ceil(s.fuel ?? 0)}/${f.capacity}`);
  else if (s.def.battery) parts.push(`${Math.round(s.stored ?? 0)}/${w.batteryCapacity(s)} Wh`);
  else if (s.def.source === 'solar') parts.push(s.powered ? `${s.output ?? 0} W` : 'de noche no produce');
  else if (s.def.source === 'wind') parts.push(s.sheltered ? 'tapado: necesita las casillas de alrededor libres' : `${s.output ?? 0} W, viento ${Math.round(w.wind * 100)} %`);
  else if (s.electric) parts.push(s.powered ? 'eléctrico: el doble de rápido' : 'eléctrico, sin corriente: velocidad normal');
  else if (s.upgrade) parts.push('electrificando');
  else if (s.def.drawbridge) parts.push(s.raised ? 'alzado: no pasa nadie' : s.wantUp ? 'se alza en cuanto no haya nadie encima' : 'bajado: se cruza andando', s.powered ? 'con corriente: se alza solo ante un raid' : 'sin corriente: solo a mano');
  else if (s.def.autoDoor) parts.push(!s.powered ? 'sin corriente: se queda abierta' : w.shutDoors.has(s.y * w.map.width + s.x) ? 'cerrada a los saqueadores' : 'con corriente: se cierra ante un raid');
  else if ((s.def.power ?? 0) < 0) parts.push(s.powered ? (s.def.light ? 'encendida' : 'en marcha') : s.def.light ? 'sin corriente' : 'sin corriente: parada');
  if (s.def.power || s.electric || s.def.battery || s.def.conduit) {
    const net = w.powerNetOf(s);
    if (net) parts.push(`red: produce ${net.production} W, gasta ${net.supplied} de ${net.demand} W, baterías ${Math.round(net.stored)}/${net.capacity} Wh`);
    else if (!s.def.conduit) parts.push('sin cable: no está conectado');
  }
  return parts.length ? ` (${parts.join(' · ')})` : '';
}

function drawBuildingTexture(scene: Phaser.Scene, key: string, def: BuildingDef, unitH: number, vw = 1, vh = 1, raised = false): void {
  const tex = scene.textures.createCanvas(key, TILE * vw, TILE_H * vh + unitH * def.height);
  if (!tex) return;
  drawBuilding(tex.getContext(), def, TILE * vw, TILE_H * vh, unitH, raised);
  tex.refresh();
}

/** Carga una partida; si no se puede, avisa y empieza un mapa nuevo. */
function loadOrNew(save: string, seed: number, game: Phaser.Game): World {
  try {
    return loadWorld(save);
  } catch (err) {
    game.events.emit('load-failed', err instanceof Error ? err.message : String(err));
    return new World({ seed });
  }
}


function drawColonistTexture(scene: Phaser.Scene, key: string, c: Colonist): void {
  const tex = scene.textures.createCanvas(key, COLONIST_SIZE, COLONIST_SIZE);
  if (!tex) return;
  paintColonist(tex.getContext(), c);
  tex.refresh();
}

function drawItemTexture(scene: Phaser.Scene, key: string, r: ResourceId): void {
  const tex = scene.textures.createCanvas(key, ITEM_W, ITEM_H);
  if (!tex) return;
  paintItem(tex.getContext(), r);
  tex.refresh();
}

function drawCropTexture(scene: Phaser.Scene, key: string, crop: CropDef, stage: number): void {
  const tex = scene.textures.createCanvas(key, CROP_SIZE, CROP_SIZE);
  if (!tex) return;
  paintCrop(tex.getContext(), crop, stage);
  tex.refresh();
}
