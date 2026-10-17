import Phaser from 'phaser';
import { GameMap, describeTile, inBounds } from '../sim/map';
import { Colonist } from '../sim/colonist';
import { isWalkable } from '../sim/pathfinding';
import { GameSpeed, World } from '../sim/world';
import { loadWorld } from '../sim/save';
import { describeStack } from '../sim/items';
import { canDesignate, TileRect } from '../sim/designations';
import { HARVEST_JOB_NAMES, HarvestJob, MAX_STACK, RESOURCE_NAMES, RESOURCES, ResourceId } from '../data/resources';
import { WorkType } from '../data/work';
import { BuildingDef, buildingDef } from '../data/buildings';
import { canZone, STORAGE_PRIORITY_NAMES, StorageZone } from '../sim/zones';
import { PlaceShape, Structure, Structures } from '../sim/structures';
import { drawBuilding, wallHeight } from './buildArt';
import { canvasPropRasterizer, paintGround, TILE } from './mapArt';
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
export type DesignMode = HarvestJob | 'cancelar' | 'almacen' | 'quitarAlmacen' | 'construir' | 'quitarPlano' | null;

/** Color de cada trabajo y modo en las marcas y en la vista previa del área. */
export const DESIGN_COLORS: Record<WorkType | 'cancelar' | 'almacen' | 'quitarAlmacen' | 'quitarPlano', number> = {
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
const ZONE_COLORS: Record<number, number> = { 1: 0x8a7a5a, 2: 0xd8c27a, 3: 0xe0a040, 4: 0xe06a3a };
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
  /** Última X dibujada de cada colono, para saber hacia dónde mira con la vista girada. */
  private lastViewX = new Map<number, number>();
  private pinchStartAngle = 0;
  private pinchStartY: [number, number] = [0, 0];
  selectedId: number | null = null;
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  /** Elevación dibujada de cada colono, suavizada al subir o bajar de nivel. */
  private spriteLift = new Map<number, number>();
  private selectionGfx!: Phaser.GameObjects.Graphics;
  /** Dibujos de los montones del suelo; se rehacen cuando cambian (versión) o cambia la vista. */
  private itemSprites: Phaser.GameObjects.Image[] = [];
  private itemsVersion = -1;
  /** Modo de órdenes activo: arrastrar o tocar marca casillas en lugar de mover la cámara. */
  designMode: DesignMode = null;
  private designStart: ViewPoint | null = null;
  private designEnd: ViewPoint | null = null;
  private designGfx!: Phaser.GameObjects.Graphics;
  private designPreview!: Phaser.GameObjects.Graphics;
  private designVersion = -1;
  /** Construcción que se coloca en el modo «construir» y forma del área. */
  buildDefId = 'muro_madera';
  buildShape: PlaceShape = 'contorno';
  private zoneGfx!: Phaser.GameObjects.Graphics;
  private zoneVersion = -1;
  private structSprites: Phaser.GameObjects.Image[] = [];
  private structVersion = -1;
  private carrySprites = new Map<number, Phaser.GameObjects.Image>();
  /** Almacén cuyo panel está abierto (se resalta). */
  selectedZoneId: number | null = null;
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

  constructor() {
    super('world');
  }

  create(data: WorldSceneData): void {
    this.world = data.save ? loadOrNew(data.save, data.seed, this.game) : new World({ seed: data.seed });
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
    this.selectedZoneId = null;
    this.designStart = null;
    this.designEnd = null;
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
    this.syncColonists();
    this.syncItems();
    this.syncDesignations();
    this.syncZones();
    this.syncStructures();
    this.drawSelection();
    this.uiTimer += delta;
    if (this.uiTimer >= UI_EMIT_MS) {
      this.uiTimer = 0;
      this.emitClock();
      if (this.selectedId !== null) this.game.events.emit('selection', this.selected());
    }
    if (!this.keys || isTyping()) return;
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
    paintGround(this.view, img, canvasPropRasterizer());
    gctx.putImageData(img, 0, 0);
    ground.refresh();
    this.mapImage = this.add.image(0, -TOP_MARGIN, MAP_TEXTURE).setOrigin(0, 0).setDepth(-1);
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
    this.drawDesignPreview();
  }

  private setupInput(): void {
    this.input.addPointer(1); // segundo dedo para el pellizco
    this.input.mouse?.disableContextMenu();
    const cam = this.cameras.main;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isPinching()) {
        this.clearDesignDrag();
        this.startPinch();
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
      if (this.dragging && p.isDown) {
        cam.scrollX = this.camStart.x - (p.x - this.dragStart.x) / cam.zoom;
        cam.scrollY = this.camStart.y - (p.y - this.dragStart.y) / cam.zoom;
      }
      this.reportTile(p);
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const moved = Phaser.Math.Distance.Between(p.downX, p.downY, p.upX, p.upY);
      const wasPinch = this.pinchStartDist > 0 || this.time.now - this.lastPinchAt < 350;
      if (this.designMode) {
        if (!wasPinch) this.applyDesignDrag();
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
      kb.on('keydown-ESC', hotkey(() => (this.designMode ? this.setDesignMode(null) : this.select(null))));
      kb.on('keydown-Q', hotkey(() => this.rotate(-1)));
      kb.on('keydown-E', hotkey(() => this.rotate(1)));
      kb.on('keydown-R', hotkey(() => this.tilt(-1)));
      kb.on('keydown-F', hotkey(() => this.tilt(1)));
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
    if (id !== null && this.designMode) this.setDesignMode(null); // elegir un colono sale del modo de órdenes
    if (id !== null) this.selectZone(null);
    this.selectedId = id;
    this.game.events.emit('selection', this.selected());
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
    const hit = this.colonistAtScreen(world.x, world.y);
    if (hit && !p.rightButtonReleased()) {
      this.select(hit.id);
      return;
    }
    this.reportTile(p);
    if (this.selectedId === null) {
      // Sin colono elegido, tocar un almacén abre su panel (filtro y prioridad).
      const t = this.pickRealTile(world.x, world.y);
      const z = t ? this.world.zones.at(t.x, t.y) : undefined;
      this.selectZone(z ? z.id : null);
      return;
    }
    const tile = this.pickRealTile(world.x, world.y);
    if (!tile) return;
    const { x: tx, y: ty } = tile;
    if (!isWalkable(this.map, tx, ty)) {
      this.game.events.emit('toast', 'No se puede caminar ahí');
      return;
    }
    if (this.world.orderMove(this.selectedId, { x: tx, y: ty })) {
      this.flashTarget(tx, ty);
    } else {
      this.game.events.emit('toast', 'No hay camino hasta ahí');
    }
  }

  private flashTarget(tx: number, ty: number): void {
    const g = this.add.graphics().setDepth(COLONIST_DEPTH + 1);
    g.lineStyle(2, 0xf0d7b0, 1);
    const v = this.viewTile(tx, ty);
    g.strokeRect(v.x * TILE + 2, v.y * TILE_H - liftOf(this.view, v.x, v.y) + 2, TILE - 4, TILE_H - 4);
    this.tweens.add({ targets: g, alpha: 0, duration: 600, onComplete: () => g.destroy() });
  }

  private createColonistSprites(): void {
    for (const c of this.world.colonists) {
      const key = `colonist-${this.map.seed}-${c.id}`;
      if (!this.textures.exists(key)) drawColonistTexture(this, key, c);
      const lift = this.liftAt(c.tile.x, c.tile.y);
      this.spriteLift.set(c.id, lift);
      const v = this.toViewPoint(c.pos.x, c.pos.y);
      const img = this.add.image(v.x * TILE, rowY(v.y) - lift, key).setDepth(COLONIST_DEPTH).setOrigin(0.5, 0.75);
      this.sprites.set(c.id, img);
    }
  }

  private syncColonists(): void {
    const t = this.time.now;
    for (const c of this.world.colonists) {
      const img = this.sprites.get(c.id);
      if (!img) continue;
      const walking = c.path.length > 0 && this.world.speed > 0;
      const working = c.activity === 'working' && this.world.speed > 0;
      // Al trabajar, golpes cortos (hacha, pico o palanca); al andar, el paso.
      const bob = walking ? Math.abs(Math.sin(t / 90 + c.id)) * -1.5 : working ? -Math.max(0, Math.sin(t / 70 + c.id)) * 2 : 0;
      // Sube o baja de nivel poco a poco en lugar de saltar.
      const target = this.liftAt(c.tile.x, c.tile.y);
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
      img.setDepth(COLONIST_DEPTH + v.y / 1000);
      this.syncCarried(c, img);
    }
  }

  // --- Órdenes: designar talar, picar y saquear ----------------------------------

  /** Activa un modo de órdenes (o lo quita con null). */
  setDesignMode(mode: DesignMode): void {
    this.designMode = mode;
    this.clearDesignDrag();
    if (mode) {
      this.select(null);
      this.selectZone(null);
    }
    this.game.events.emit('design-mode', mode);
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
    if (mode === 'almacen') {
      const start = this.designStart ? this.world.zones.at(this.designStart.x, this.designStart.y) : undefined;
      if (start) {
        const n = this.world.zones.extend(start.id, r);
        toast(n > 0 ? `${start.name}: +${n} casillas` : 'Ahí no se puede ampliar');
      } else {
        const z = this.world.zones.create(r);
        toast(z ? `${z.name} creado (${z.tiles.size} casillas) · tócalo para el filtro y la prioridad` : 'Ahí no se puede guardar nada');
      }
    } else if (mode === 'quitarAlmacen') {
      const n = this.world.zones.removeArea(r);
      toast(n > 0 ? `Quitadas ${n} casillas de almacén` : 'No había almacén ahí');
    } else if (mode === 'construir') {
      const def = buildingDef(this.buildDefId);
      const n = this.world.structures.placeArea(r, def.id, this.buildShape);
      toast(n > 0 ? `${def.name}: ${n} ${n === 1 ? 'plano' : 'planos'}` : 'Ahí no se puede construir (hace falta suelo llano y libre)');
    } else if (mode === 'quitarPlano') {
      let n = 0;
      for (const t of Structures.areaTiles(r, 'relleno')) if (this.world.cancelBlueprint(t.x, t.y)) n++;
      toast(n > 0 ? `${n} ${n === 1 ? 'plano quitado' : 'planos quitados'}` : 'No había planos ahí');
    } else if (mode === 'cancelar') {
      const n = d.cancelArea(r);
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
    const r = this.designRect();
    const mode = this.designMode;
    if (!r || !mode) return;
    const xa = Math.max(0, Math.min(r.x0, r.x1));
    const xb = Math.min(this.map.width - 1, Math.max(r.x0, r.x1));
    const ya = Math.max(0, Math.min(r.y0, r.y1));
    const yb = Math.min(this.map.height - 1, Math.max(r.y0, r.y1));
    const color = DESIGN_COLORS[mode];
    const d = this.world.designations;
    const st = this.world.structures;
    const hitAt = (x: number, y: number, edge: boolean): boolean => {
      switch (mode) {
        case 'cancelar': return d.at(x, y) !== undefined;
        case 'almacen': return canZone(this.map, x, y) && !this.world.zones.at(x, y);
        case 'quitarAlmacen': return this.world.zones.at(x, y) !== undefined;
        case 'construir': return (this.buildShape === 'relleno' || edge) && st.canPlace(x, y);
        case 'quitarPlano': return st.at(x, y)?.built === false;
        default: return canDesignate(this.map, x, y, mode);
      }
    };
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

  /** Rehace las marcas de las casillas designadas si han cambiado. */
  private syncDesignations(): void {
    const d = this.world.designations;
    if (d.version === this.designVersion) return;
    this.designVersion = d.version;
    const g = this.designGfx;
    g.clear();
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

  /** Rehace el dibujo de los almacenes si han cambiado. */
  private syncZones(): void {
    const zones = this.world.zones;
    if (zones.version === this.zoneVersion) return;
    this.zoneVersion = zones.version;
    const g = this.zoneGfx;
    g.clear();
    for (const z of zones.all()) {
      const sel = z.id === this.selectedZoneId;
      g.fillStyle(ZONE_COLORS[z.priority], sel ? 0.4 : 0.22);
      for (const i of z.tiles) this.fillTile(g, i % this.map.width, Math.floor(i / this.map.width), 0.5);
      // Borde donde la casilla vecina no es de la misma zona.
      g.lineStyle(1, ZONE_COLORS[z.priority], sel ? 1 : 0.7);
      for (const i of z.tiles) this.strokeZoneEdges(g, z, i % this.map.width, Math.floor(i / this.map.width));
    }
  }

  private strokeZoneEdges(g: Phaser.GameObjects.Graphics, z: StorageZone, x: number, y: number): void {
    // Se trabaja en la vista: los lados de la casilla girada.
    const v = this.viewTile(x, y);
    const left = v.x * TILE;
    const top = v.y * TILE_H - liftOf(this.view, v.x, v.y);
    const same = (vx: number, vy: number) => {
      const t = tileFromView(vx, vy, this.map.width, this.map.height, this.rotation);
      return this.world.zones.at(t.x, t.y)?.id === z.id;
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
    const wallH = wallHeight(LIFT);
    for (const s of st.all()) {
      const key = `build-${s.def.id}-${TILE_H}-${wallH}`;
      if (!this.textures.exists(key)) drawBuildingTexture(this, key, s.def, wallH);
      const v = this.viewTile(s.x, s.y);
      const top = v.y * TILE_H - liftOf(this.view, v.x, v.y);
      const img = this.add.image(v.x * TILE, top - wallH, key).setOrigin(0, 0);
      // Delante de lo que está en su fila y en las de detrás; detrás de lo que está más al sur.
      img.setDepth(COLONIST_DEPTH + (v.y + 0.99) / 1000);
      if (!s.built) img.setAlpha(0.45).setTint(0x8fc0ff); // plano: translúcido y azulado
      this.structSprites.push(img);
    }
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
    if (!tile || !inBounds(this.map, tile.x, tile.y)) return;
    const stack = this.world.items.at(tile.x, tile.y);
    const job = this.world.designations.at(tile.x, tile.y);
    let text = describeTile(this.map, tile.x, tile.y);
    if (stack) text = `${describeStack(stack, RESOURCE_NAMES)} · ${text}`;
    if (job) text += ` · orden: ${HARVEST_JOB_NAMES[job].toLowerCase()}`;
    const zone = this.world.zones.at(tile.x, tile.y);
    if (zone) text = `${zone.name} (${STORAGE_PRIORITY_NAMES[zone.priority].toLowerCase()}) · ${text}`;
    const s = this.world.structures.at(tile.x, tile.y);
    if (s) text = `${structureLabel(this.world.structures, s)} · ${text}`;
    this.game.events.emit('tile-info', text);
  }

  /** Elevación con la que se dibuja ahora mismo un colono. */
  private colonistLift(c: Colonist): number {
    return this.spriteLift.get(c.id) ?? this.liftAt(c.tile.x, c.tile.y);
  }

  /** Colono dibujado bajo un punto del mundo (en píxeles), el de más delante si hay varios. */
  private colonistAtScreen(wx: number, wy: number): Colonist | undefined {
    let best: Colonist | undefined;
    let bestDist = TILE * 0.9;
    for (const c of this.world.colonists) {
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
function isTyping(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);
}

/** Dibuja un colono pixel art de 16×16 con sus colores. */
function drawColonistTexture(scene: Phaser.Scene, key: string, c: Colonist): void {
  const tex = scene.textures.createCanvas(key, 16, 16);
  if (!tex) return;
  const ctx = tex.getContext();
  const hex = (n: number, shade = 0) => {
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + shade));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + shade));
    const b = Math.max(0, Math.min(255, (n & 255) + shade));
    return `rgb(${r},${g},${b})`;
  };
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const outline = '#1a1410';
  // Sombra
  px(4, 14, 8, 1, 'rgba(0,0,0,0.35)');
  // Piernas
  px(6, 11, 2, 3, '#3a3028');
  px(9, 11, 2, 3, '#3a3028');
  // Cuerpo (camisa) con contorno
  px(4, 6, 8, 6, outline);
  px(5, 6, 6, 5, hex(c.look.shirt));
  px(5, 6, 6, 1, hex(c.look.shirt, 25));
  px(10, 7, 1, 4, hex(c.look.shirt, -30));
  // Brazos
  px(4, 7, 1, 3, hex(c.look.skin, -20));
  px(11, 7, 1, 3, hex(c.look.skin, -20));
  // Cabeza
  px(5, 1, 6, 6, outline);
  px(6, 2, 4, 4, hex(c.look.skin));
  // Pelo
  px(6, 1, 4, 2, hex(c.look.hair));
  px(5, 2, 1, 2, hex(c.look.hair));
  // Ojo (mira a la derecha; el sprite se voltea)
  px(9, 4, 1, 1, outline);
  tex.refresh();
}

function itemTextureKey(r: ResourceId): string {
  return `item-${r}`;
}

/** Dibuja un montón pixel art de 12×10 para un recurso. */
function drawItemTexture(scene: Phaser.Scene, key: string, r: ResourceId): void {
  const tex = scene.textures.createCanvas(key, 12, 10);
  if (!tex) return;
  const ctx = tex.getContext();
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  px(1, 9, 10, 1, 'rgba(0,0,0,0.35)'); // sombra
  switch (r) {
    case 'madera':
      // Tres troncos apilados con las puntas claras.
      for (const [x, y] of [[1, 5], [6, 5], [3, 1]]) {
        px(x, y, 5, 4, '#1a1410');
        px(x + 1, y + 1, 3, 2, '#7a5634');
        px(x + 1, y + 1, 1, 2, '#c9a26a');
      }
      break;
    case 'piedra':
      // Bloques de piedra grises.
      for (const [x, y, w] of [[1, 5, 5], [6, 5, 5], [3, 1, 6]]) {
        px(x, y, w, 4, '#22201e');
        px(x + 1, y + 1, w - 2, 2, '#8c8a84');
        px(x + 1, y + 1, w - 2, 1, '#b4b1a8');
      }
      break;
    case 'chatarra':
      // Chapas y barras oxidadas.
      px(1, 5, 10, 4, '#1a1410');
      px(2, 6, 8, 2, '#8a4a26');
      px(3, 6, 2, 1, '#c27a3e');
      px(7, 7, 2, 1, '#5c5a56');
      px(4, 2, 5, 3, '#1a1410');
      px(5, 3, 3, 1, '#a35a2c');
      px(9, 1, 1, 4, '#6e6c66');
      break;
    case 'componentes':
      // Caja con un engranaje.
      px(1, 2, 10, 7, '#1a1410');
      px(2, 3, 8, 5, '#5a6b4a');
      px(2, 3, 8, 1, '#7d8f68');
      px(5, 4, 2, 3, '#d8c27a');
      px(4, 5, 4, 1, '#d8c27a');
      break;
  }
  tex.refresh();
}

/** Texto de una construcción o plano para la información de casilla. */
function structureLabel(st: Structures, s: Structure): string {
  if (s.built) return s.def.name;
  const needs = st.needs(s);
  const parts = RESOURCES.filter((r) => (s.def.cost[r] ?? 0) > 0).map(
    (r) => `${RESOURCE_NAMES[r].toLowerCase()} ${(s.def.cost[r] ?? 0) - (needs[r] ?? 0)}/${s.def.cost[r]}`,
  );
  return `Plano: ${s.def.name} (${parts.join(', ')})`;
}

function drawBuildingTexture(scene: Phaser.Scene, key: string, def: BuildingDef, wallH: number): void {
  const tex = scene.textures.createCanvas(key, TILE, TILE_H + wallH);
  if (!tex) return;
  drawBuilding(tex.getContext(), def, TILE, TILE_H, wallH);
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
