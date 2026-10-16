import Phaser from 'phaser';
import { GameMap, describeTile, inBounds } from '../sim/map';
import { Colonist } from '../sim/colonist';
import { isWalkable } from '../sim/pathfinding';
import { GameSpeed, World } from '../sim/world';
import { paintGround, paintProps, TILE } from './mapArt';
import { liftOf, pickTile, TOP_MARGIN } from './projection';

export { TILE };
const MAP_TEXTURE = 'world-map';
const PROPS_TEXTURE = 'world-props';
const MAX_ZOOM = 4;
const COLONIST_DEPTH = 10;
const UI_EMIT_MS = 200;

type MoveKeys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

export interface WorldSceneData {
  seed: number;
}

/**
 * Escena principal: dibuja el mapa y gestiona la cámara
 * (arrastrar, rueda, pellizco táctil y teclado).
 */
export class WorldScene extends Phaser.Scene {
  world!: World;
  map!: GameMap;
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
    this.drawMap();
    this.add.image(0, -TOP_MARGIN, MAP_TEXTURE).setOrigin(0, 0);
    this.add.image(0, -TOP_MARGIN, PROPS_TEXTURE).setOrigin(0, 0).setDepth(2);
    this.selectionGfx = this.add.graphics().setDepth(COLONIST_DEPTH - 1);
    this.createColonistSprites();

    const cam = this.cameras.main;
    const worldW = this.map.width * TILE;
    const worldH = this.map.height * TILE;
    cam.setBounds(0, -TOP_MARGIN, worldW, worldH + TOP_MARGIN);
    cam.setBackgroundColor('#141210');
    cam.setZoom(this.clampZoom(Math.max(this.minZoom(), 1.5)));
    cam.centerOn((this.map.start.x + 0.5) * TILE, (this.map.start.y + 0.5) * TILE - liftOf(this.map, this.map.start.x, this.map.start.y));

    this.setupInput();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
    this.game.events.emit('map-ready', this.map);
    this.game.events.emit('selection', null);
    this.emitClock();
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

  /** Pinta el suelo y los objetos en dos texturas de lienzo. */
  private drawMap(): void {
    for (const key of [MAP_TEXTURE, PROPS_TEXTURE]) {
      if (this.textures.exists(key)) this.textures.remove(key);
    }
    const w = this.map.width * TILE;
    const h = this.map.height * TILE + TOP_MARGIN;

    const ground = this.textures.createCanvas(MAP_TEXTURE, w, h);
    if (!ground) throw new Error('No se pudo crear la textura del mapa');
    const gctx = ground.getContext();
    const img = gctx.createImageData(w, h);
    paintGround(this.map, img);
    gctx.putImageData(img, 0, 0);
    ground.refresh();

    const props = this.textures.createCanvas(PROPS_TEXTURE, w, h);
    if (!props) throw new Error('No se pudo crear la textura de objetos');
    paintProps(this.map, props.getContext());
    props.refresh();
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
  }

  private updatePinch(): void {
    if (this.pinchStartDist === 0) this.startPinch();
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    this.lastPinchAt = this.time.now;
    if (this.pinchStartDist < 1) return;
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
    return Math.max(width / (this.map.width * TILE), height / (this.map.height * TILE + TOP_MARGIN));
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
    if (c) this.cameras.main.pan(c.pos.x * TILE, c.pos.y * TILE - this.colonistLift(c), 300, 'Sine.easeInOut');
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
    const tile = pickTile(this.map, world.x, world.y);
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
    g.strokeRect(tx * TILE + 2, ty * TILE - liftOf(this.map, tx, ty) + 2, TILE - 4, TILE - 4);
    this.tweens.add({ targets: g, alpha: 0, duration: 600, onComplete: () => g.destroy() });
  }

  private createColonistSprites(): void {
    for (const c of this.world.colonists) {
      const key = `colonist-${this.map.seed}-${c.id}`;
      if (!this.textures.exists(key)) drawColonistTexture(this, key, c);
      const lift = liftOf(this.map, c.tile.x, c.tile.y);
      this.spriteLift.set(c.id, lift);
      const img = this.add.image(c.pos.x * TILE, c.pos.y * TILE - lift, key).setDepth(COLONIST_DEPTH).setOrigin(0.5, 0.75);
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
      const target = liftOf(this.map, c.tile.x, c.tile.y);
      const prev = this.spriteLift.get(c.id) ?? target;
      const lift = Math.abs(target - prev) < 0.3 ? target : prev + (target - prev) * 0.25;
      this.spriteLift.set(c.id, lift);
      img.setPosition(c.pos.x * TILE, c.pos.y * TILE - lift + bob);
      img.setFlipX(c.facing < 0);
      img.setDepth(COLONIST_DEPTH + c.pos.y / 1000);
    }
  }

  private drawSelection(): void {
    const g = this.selectionGfx;
    g.clear();
    const c = this.selected();
    if (!c) return;
    const lift = this.colonistLift(c);
    if (c.path.length > 0) {
      g.lineStyle(1.5, 0xf0d7b0, 0.6);
      g.beginPath();
      g.moveTo(c.pos.x * TILE, c.pos.y * TILE - lift);
      for (const p of c.path) g.lineTo((p.x + 0.5) * TILE, (p.y + 0.5) * TILE - liftOf(this.map, p.x, p.y));
      g.strokePath();
      const end = c.path[c.path.length - 1];
      g.strokeRect(end.x * TILE + 3, end.y * TILE - liftOf(this.map, end.x, end.y) + 3, TILE - 6, TILE - 6);
    }
    g.lineStyle(2, 0xd96c2c, 1);
    g.strokeEllipse(c.pos.x * TILE, c.pos.y * TILE - lift + 3, TILE * 0.95, TILE * 0.45);
  }

  private reportTile(p: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    const tile = pickTile(this.map, world.x, world.y);
    if (!tile || !inBounds(this.map, tile.x, tile.y)) return;
    this.game.events.emit('tile-info', describeTile(this.map, tile.x, tile.y));
  }

  /** Elevación con la que se dibuja ahora mismo un colono. */
  private colonistLift(c: Colonist): number {
    return this.spriteLift.get(c.id) ?? liftOf(this.map, c.tile.x, c.tile.y);
  }

  /** Colono dibujado bajo un punto del mundo (en píxeles), el de más delante si hay varios. */
  private colonistAtScreen(wx: number, wy: number): Colonist | undefined {
    let best: Colonist | undefined;
    let bestDist = TILE * 0.9;
    for (const c of this.world.colonists) {
      // Centro del cuerpo: el sprite se ancla en los pies.
      const d = Math.hypot(c.pos.x * TILE - wx, c.pos.y * TILE - this.colonistLift(c) - 3 - wy);
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
