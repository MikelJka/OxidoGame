import Phaser from 'phaser';
import { generateMap, GameMap, Terrain, TERRAIN_INFO, terrainAt, inBounds } from '../sim/map';
import { Rng } from '../sim/rng';
import { CONTAMINATION_TINT, TERRAIN_COLORS } from './palette';

export const TILE = 16;
const MAP_TEXTURE = 'world-map';
const MAX_ZOOM = 4;

type MoveKeys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

export interface WorldSceneData {
  seed: number;
}

/**
 * Escena principal: dibuja el mapa y gestiona la cámara
 * (arrastrar, rueda, pellizco táctil y teclado).
 */
export class WorldScene extends Phaser.Scene {
  map!: GameMap;
  private dragging = false;
  private dragStart = new Phaser.Math.Vector2();
  private camStart = new Phaser.Math.Vector2();
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private keys?: MoveKeys;

  constructor() {
    super('world');
  }

  create(data: WorldSceneData): void {
    this.map = generateMap({ width: 100, height: 100, seed: data.seed });
    this.drawMap();
    this.add.image(0, 0, MAP_TEXTURE).setOrigin(0, 0);
    this.drawStartMarker();

    const cam = this.cameras.main;
    const worldW = this.map.width * TILE;
    const worldH = this.map.height * TILE;
    cam.setBounds(0, 0, worldW, worldH);
    cam.setBackgroundColor('#141210');
    cam.setZoom(this.clampZoom(Math.max(this.minZoom(), 1.5)));
    cam.centerOn((this.map.start.x + 0.5) * TILE, (this.map.start.y + 0.5) * TILE);

    this.setupInput();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
    this.game.events.emit('map-ready', this.map);
  }

  update(_time: number, delta: number): void {
    if (!this.keys) return;
    const cam = this.cameras.main;
    const speed = (0.6 * delta) / cam.zoom;
    const k = this.keys;
    if (k.left.isDown || k.a.isDown) cam.scrollX -= speed;
    if (k.right.isDown || k.d.isDown) cam.scrollX += speed;
    if (k.up.isDown || k.w.isDown) cam.scrollY -= speed;
    if (k.down.isDown || k.s.isDown) cam.scrollY += speed;
  }

  /** Pinta todo el mapa en una textura de lienzo, con detalle pixel art por casilla. */
  private drawMap(): void {
    if (this.textures.exists(MAP_TEXTURE)) this.textures.remove(MAP_TEXTURE);
    const w = this.map.width * TILE;
    const h = this.map.height * TILE;
    const canvas = this.textures.createCanvas(MAP_TEXTURE, w, h);
    if (!canvas) throw new Error('No se pudo crear la textura del mapa');
    const ctx = canvas.getContext();
    const img = ctx.createImageData(w, h);
    const px = img.data;
    const rng = new Rng(this.map.seed ^ 0x9e3779b9);

    for (let ty = 0; ty < this.map.height; ty++) {
      for (let tx = 0; tx < this.map.width; tx++) {
        const t = terrainAt(this.map, tx, ty);
        const base = [...TERRAIN_COLORS[t]] as [number, number, number];
        if (this.map.contaminated[ty * this.map.width + tx]) {
          for (let c = 0; c < 3; c++) base[c] += CONTAMINATION_TINT[c];
        }
        const tileShade = rng.range(-6, 6);
        for (let y = 0; y < TILE; y++) {
          for (let x = 0; x < TILE; x++) {
            const shade = tileShade + pixelDetail(t, x, y, rng);
            const i = ((ty * TILE + y) * w + tx * TILE + x) * 4;
            px[i] = clamp(base[0] + shade);
            px[i + 1] = clamp(base[1] + shade);
            px[i + 2] = clamp(base[2] + shade);
            px[i + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    canvas.refresh();
    this.textures.get(MAP_TEXTURE).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private drawStartMarker(): void {
    const { x, y } = this.map.start;
    const g = this.add.graphics();
    g.lineStyle(2, 0xd96c2c, 1);
    g.strokeRect((x - 2) * TILE, (y - 2) * TILE, TILE * 5, TILE * 5);
    this.add
      .text((x + 0.5) * TILE, (y - 2.6) * TILE, 'Inicio', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f0d7b0',
        backgroundColor: '#00000088',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setResolution(2);
  }

  private setupInput(): void {
    this.input.addPointer(1); // segundo dedo para el pellizco
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
      if (moved < 8) this.reportTile(p);
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
      this.keys = kb.addKeys({
        up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
        w: K.W, a: K.A, s: K.S, d: K.D,
      }) as MoveKeys;
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
    this.pinchStartDist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    this.pinchStartZoom = this.cameras.main.zoom;
  }

  private updatePinch(): void {
    if (this.pinchStartDist === 0) this.startPinch();
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
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
    return Math.max(width / (this.map.width * TILE), height / (this.map.height * TILE));
  }

  private clampZoom(z: number): number {
    return Phaser.Math.Clamp(z, this.minZoom(), MAX_ZOOM);
  }

  private onResize(): void {
    const cam = this.cameras.main;
    cam.setZoom(this.clampZoom(cam.zoom));
  }

  private reportTile(p: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    const tx = Math.floor(world.x / TILE);
    const ty = Math.floor(world.y / TILE);
    if (!inBounds(this.map, tx, ty)) return;
    const t = terrainAt(this.map, tx, ty);
    const info = TERRAIN_INFO[t];
    const dirty = this.map.contaminated[ty * this.map.width + tx] ? ' (contaminada)' : '';
    this.game.events.emit('tile-info', `${info.name}${dirty} · ${tx},${ty}`);
  }
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Variación de brillo por píxel para dar textura pixel art a cada terreno. */
function pixelDetail(t: Terrain, x: number, y: number, rng: Rng): number {
  switch (t) {
    case Terrain.DeepWater:
    case Terrain.Water:
    case Terrain.ShallowWater:
      // Ondas horizontales suaves.
      return (y + (x >> 2)) % 6 === 0 && rng.chance(0.6) ? 14 : 0;
    case Terrain.DeadForest: {
      // Troncos secos: una columna oscura con ramas.
      const trunk = x === 7 || x === 8;
      if (trunk && y > 3 && y < 14) return -26;
      if ((y === 6 || y === 9) && x > 4 && x < 11) return -18;
      return rng.chance(0.12) ? -10 : 0;
    }
    case Terrain.Rock:
      return (x + y * 3) % 7 === 0 ? -14 : rng.chance(0.1) ? 10 : 0;
    case Terrain.Hills:
      return y % 5 === 0 && rng.chance(0.5) ? 12 : rng.chance(0.06) ? -10 : 0;
    case Terrain.Ruins:
      // Patrón de ladrillos rotos.
      if (y % 4 === 0) return -20;
      if ((x + (y % 8 < 4 ? 0 : 4)) % 8 === 0) return -20;
      return rng.chance(0.08) ? 16 : 0;
    case Terrain.Irradiated:
      return rng.chance(0.05) ? 28 : rng.chance(0.15) ? -8 : 0;
    case Terrain.Spring:
      return Math.hypot(x - 7.5, y - 7.5) < 4 ? 30 : 0;
    default:
      return rng.chance(0.08) ? -10 : rng.chance(0.04) ? 8 : 0;
  }
}
