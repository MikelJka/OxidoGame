import Phaser from 'phaser';
import { GameMap, describeTile, inBounds } from '../sim/map';
import { Colonist } from '../sim/colonist';
import { isWalkable } from '../sim/pathfinding';
import { GameSpeed, World } from '../sim/world';
import { canvasPropRasterizer, paintGround, TILE } from './mapArt';
import { liftOf, occludedFraction, pickTile, rowY, setTilt, TILE_H, tiltIndex, TILTS, TOP_MARGIN } from './projection';
import { fromView, normalizeRotation, Rotation, rotateMap, tileFromView, tileToView, toView } from './rotation';

export { TILE };
const MAP_TEXTURE = 'world-map';
const MAX_ZOOM = 4;
const COLONIST_DEPTH = 10;
const UI_EMIT_MS = 200;
/** Giro de los dedos (en radianes) que hace falta para girar la vista un cuarto de vuelta. */
const TWIST_STEP = Math.PI / 4;
/** Desplazamiento vertical (px de pantalla) de los dos dedos a la vez que cambia la inclinación un paso. */
const TILT_DRAG_STEP = 60;

type MoveKeys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

export interface WorldSceneData {
  seed: number;
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
    this.world = new World({ seed: data.seed });
    this.map = this.world.map;
    this.selectedId = null;
    this.sprites.clear();
    this.spriteLift.clear();
    this.lastViewX.clear();
    this.mapImage = undefined;
    this.view = rotateMap(this.map, this.rotation);
    this.drawMap();
    this.selectionGfx = this.add.graphics().setDepth(COLONIST_DEPTH - 1);
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
  }

  update(_time: number, delta: number): void {
    this.world.update(delta);
    this.syncColonists();
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
  }

  private setupInput(): void {
    this.input.addPointer(1); // segundo dedo para el pellizco
    this.input.mouse?.disableContextMenu();
    const cam = this.cameras.main;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isPinching()) {
        this.startPinch();
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
      if (this.dragging && p.isDown) {
        cam.scrollX = this.camStart.x - (p.x - this.dragStart.x) / cam.zoom;
        cam.scrollY = this.camStart.y - (p.y - this.dragStart.y) / cam.zoom;
      }
      this.reportTile(p);
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const moved = Phaser.Math.Distance.Between(p.downX, p.downY, p.upX, p.upY);
      const wasPinch = this.pinchStartDist > 0 || this.time.now - this.lastPinchAt < 350;
      if (moved < 8 && !wasPinch) this.handleTap(p);
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
      kb.on('keydown-ESC', hotkey(() => this.select(null)));
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
    this.zoomAt(this.pinchStartZoom * (dist / this.pinchStartDist), (a.x + b.x) / 2, (a.y + b.y) / 2);
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
    if (this.selectedId === null) return;
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
      const bob = walking ? Math.abs(Math.sin(t / 90 + c.id)) * -1.5 : 0;
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
    }
  }

  private drawSelection(): void {
    const g = this.selectionGfx;
    g.clear();
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

  private reportTile(p: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    const tile = this.pickRealTile(world.x, world.y);
    if (!tile || !inBounds(this.map, tile.x, tile.y)) return;
    this.game.events.emit('tile-info', describeTile(this.map, tile.x, tile.y));
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
