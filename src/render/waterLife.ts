// Agua con vida (salto de calidad del 2D, pedido por Mikel el 2026-10-21): brillos que titilan,
// ondas que se abren, peces que saltan y espuma que va y viene en la orilla. Solo dibujo.
import Phaser from 'phaser';
import { GameMap, isWater, Terrain } from '../sim/map';
import { liftOf, TILE_H, TOP_MARGIN } from './projection';
import { TILE } from './projection';

const GLINT = 'water-glint';
const FISH = 'water-fish';
const DEPTH = -0.9; // encima del suelo pintado, debajo de todo lo demás

export class WaterLife {
  private foam: Phaser.GameObjects.Graphics;
  private foamKey = '';
  private timer = 0;
  private fishTimer = 0;
  /** Un pez cae al agua (para el chapoteo). */
  onSplash?: (x: number, y: number) => void;

  constructor(private readonly scene: Phaser.Scene) {
    makeTextures(scene);
    this.foam = scene.add.graphics().setDepth(DEPTH);
  }

  destroy(): void {
    this.foam.destroy();
  }

  update(view: GameMap, key: string, delta: number, dark: number): void {
    if (key !== this.foamKey) {
      this.foamKey = key;
      this.drawFoam(view);
    }
    const t = this.scene.time.now;
    // La espuma va y viene (como olas pequeñas).
    this.foam.setAlpha(0.45 + 0.25 * Math.sin(t / 900));
    this.foam.y = Math.sin(t / 900) * 0.6;

    const cam = this.scene.cameras.main.worldView;
    this.timer += delta;
    // Brillos y ondas: unos cuantos por segundo en el agua que se ve (menos de noche).
    const every = dark > 0.6 ? 220 : 70;
    while (this.timer > every) {
      this.timer -= every;
      const p = this.randomWater(view, cam);
      if (!p) continue;
      if (Math.random() < 0.8) this.glint(p.x, p.y, dark);
      else this.ripple(p.x, p.y, 6 + Math.random() * 6);
    }
    // De vez en cuando salta un pez.
    this.fishTimer += delta;
    if (this.fishTimer > 2600) {
      this.fishTimer = Math.random() * 1500;
      const p = this.randomWater(view, cam, true);
      if (p) this.fish(p.x, p.y);
    }
  }

  /** Un punto al azar de la pantalla que sea agua (si `deep`, agua no muy de orilla). */
  private randomWater(view: GameMap, cam: Phaser.Geom.Rectangle, deep = false): { x: number; y: number } | null {
    for (let k = 0; k < 4; k++) {
      const x = cam.x + Math.random() * cam.width;
      const y = cam.y + Math.random() * cam.height;
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE_H);
      if (tx < 0 || ty < 0 || tx >= view.width || ty >= view.height) continue;
      const t = view.terrain[ty * view.width + tx] as Terrain;
      if (!isWater(t)) continue;
      if (deep && t === Terrain.ShallowWater) continue;
      return { x, y: y - liftOf(view, tx, ty) };
    }
    return null;
  }

  private glint(x: number, y: number, dark: number): void {
    const img = this.scene.add.image(x, y, GLINT).setDepth(DEPTH + 0.01).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    img.setTint(dark > 0.6 ? 0x9ab0e0 : 0xfff6dc);
    this.scene.tweens.add({ targets: img, alpha: 0.9 - dark * 0.5, duration: 260 + Math.random() * 300, yoyo: true, onComplete: () => img.destroy() });
  }

  private ripple(x: number, y: number, size: number): void {
    const ring = this.scene.add.ellipse(x, y, 2, 1).setStrokeStyle(1, 0xd8ecf0, 0.7).setDepth(DEPTH + 0.01);
    this.scene.tweens.add({ targets: ring, width: size, height: size * 0.45, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
  }

  private fish(x: number, y: number): void {
    const f = this.scene.add.image(x, y, FISH).setDepth(DEPTH + 0.02).setFlipX(Math.random() < 0.5);
    this.scene.tweens.add({
      targets: f, y: y - 7, angle: f.flipX ? 30 : -30, duration: 260, ease: 'Sine.easeOut', yoyo: true,
      onYoyo: () => f.setAngle(f.flipX ? -30 : 30),
      onComplete: () => {
        f.destroy();
        this.onSplash?.(x, y);
        this.ripple(x, y, 9);
        this.ripple(x + (f.flipX ? -3 : 3), y, 6);
      },
    });
    this.ripple(x, y, 5);
  }

  /** Espuma en la orilla: una línea clara por cada lado de agua que toca tierra. */
  private drawFoam(view: GameMap): void {
    const g = this.foam;
    g.clear();
    const W = view.width;
    const land = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < view.height && !isWater(view.terrain[y * W + x]);
    for (let y = 0; y < view.height; y++) {
      for (let x = 0; x < W; x++) {
        if (!isWater(view.terrain[y * W + x])) continue;
        const top = y * TILE_H - liftOf(view, x, y);
        const left = x * TILE;
        g.fillStyle(0xe8f2f0, 0.55);
        if (land(x, y - 1)) g.fillRect(left, top, TILE, 1);
        if (land(x, y + 1)) g.fillRect(left, top + TILE_H - 1, TILE, 1);
        if (land(x - 1, y)) g.fillRect(left, top, 1, TILE_H);
        if (land(x + 1, y)) g.fillRect(left + TILE - 1, top, 1, TILE_H);
        g.fillStyle(0xe8f2f0, 0.2);
        if (land(x, y - 1)) g.fillRect(left + 2, top + 2, TILE - 4, 1);
        if (land(x - 1, y)) g.fillRect(left + 2, top + 1, 1, TILE_H - 2);
        if (land(x + 1, y)) g.fillRect(left + TILE - 3, top + 1, 1, TILE_H - 2);
      }
    }
    void TOP_MARGIN;
  }
}

function makeTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(GLINT)) {
    const t = scene.textures.createCanvas(GLINT, 5, 3);
    if (t) {
      const c = t.getContext();
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillRect(0, 1, 5, 1);
      c.fillStyle = '#ffffff';
      c.fillRect(2, 0, 1, 3);
      c.fillRect(1, 1, 3, 1);
      t.refresh();
    }
  }
  if (!scene.textures.exists(FISH)) {
    const t = scene.textures.createCanvas(FISH, 6, 3);
    if (t) {
      const c = t.getContext();
      c.fillStyle = '#5a6a70';
      c.fillRect(1, 1, 4, 1);
      c.fillStyle = '#c8d4d8';
      c.fillRect(1, 0, 3, 1);
      c.fillStyle = '#3a4448';
      c.fillRect(0, 0, 1, 3); // cola
      c.fillRect(5, 1, 1, 1);
      t.refresh();
    }
  }
}
