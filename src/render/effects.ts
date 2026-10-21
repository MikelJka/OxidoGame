// Efectos (última parte del salto de calidad del 2D, pedido por Mikel el 2026-10-21): fogonazos en la
// boca de las armas, chispas y sangre al recibir un golpe, explosiones con destello, onda, cascotes,
// humo y una mancha quemada que se borra poco a poco, y brasas que saltan del fuego. Solo dibujo: la
// escena le avisa de lo que ha pasado en la simulación y aquí no se decide nada.
import Phaser from 'phaser';
import { TILE } from './projection';

const GLOW_TEX = 'fx-glow';
const SPARK_TEX = 'fx-spark';
const RING_TEX = 'fx-ring';
const STAR_TEX = 'fx-star';
const SCORCH_TEX = 'fx-scorch';
const PUFF_TEX = 'fx-puff';
/** Por encima de la oscuridad de la noche (así el destello ilumina). */
const GLOW_DEPTH = 905;
/** Cascotes, sangre y humo: con las personas, debajo de la oscuridad. */
const BODY_DEPTH = 12;
/** Manchas del suelo: encima del mapa y debajo de todo lo demás. */
const DECAL_DEPTH = -0.5;
const MAX_SCORCH = 40;
const SCORCH_MS = 45_000;

/** Material de quien recibe el golpe: carne (sangre) o máquina (chispas). */
export type HitKind = 'flesh' | 'machine';

interface Scorch {
  img: Phaser.GameObjects.Image;
  born: number;
}

export class Effects {
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private debris: Phaser.GameObjects.Particles.ParticleEmitter;
  private blood: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private flames: Phaser.GameObjects.Particles.ParticleEmitter;
  private glows: Phaser.GameObjects.Image[] = [];
  private scorches: Scorch[] = [];
  /** Cada destello también ilumina el suelo de alrededor (lo dibuja el mapa de luz del ambiente). */
  onLight?: (x: number, y: number, tiles: number, color: number, ms: number) => void;

  constructor(private readonly scene: Phaser.Scene) {
    makeTextures(scene);
    const add = Phaser.BlendModes.ADD;
    this.sparks = scene.add.particles(0, 0, SPARK_TEX, {
      emitting: false, lifespan: { min: 220, max: 480 }, speed: { min: 40, max: 130 }, angle: { min: 0, max: 360 },
      gravityY: 180, scale: { start: 1, end: 0.2 }, alpha: { start: 1, end: 0 }, tint: [0xfff2a0, 0xffc040, 0xff8a20],
      blendMode: add, maxParticles: 220,
    }).setDepth(GLOW_DEPTH);
    this.embers = scene.add.particles(0, 0, SPARK_TEX, {
      emitting: false, lifespan: { min: 900, max: 1700 }, speedY: { min: -38, max: -16 }, speedX: { min: -8, max: 8 },
      accelerationX: { min: -14, max: 14 }, scale: { start: 0.8, end: 0.1 }, alpha: { start: 1, end: 0 },
      tint: [0xffd060, 0xff8a2a, 0xff5a1a], blendMode: add, maxParticles: 260,
    }).setDepth(GLOW_DEPTH);
    this.flames = scene.add.particles(0, 0, PUFF_TEX, {
      emitting: false, lifespan: { min: 260, max: 420 }, speed: { min: 50, max: 90 }, scale: { start: 0.35, end: 1.1 },
      alpha: { start: 0.9, end: 0 }, tint: [0xffe080, 0xff9a30, 0xff5020], blendMode: add, maxParticles: 160,
    }).setDepth(GLOW_DEPTH);
    this.debris = scene.add.particles(0, 0, SPARK_TEX, {
      emitting: false, lifespan: { min: 500, max: 900 }, speed: { min: 50, max: 150 }, angle: { min: 200, max: 340 },
      gravityY: 260, scale: { min: 0.8, max: 1.6 }, alpha: { start: 1, end: 0.6 }, tint: [0x3a3028, 0x5a4a3a, 0x6a6058, 0x2a2420],
      rotate: { min: 0, max: 360 }, maxParticles: 200,
    }).setDepth(BODY_DEPTH);
    this.blood = scene.add.particles(0, 0, SPARK_TEX, {
      emitting: false, lifespan: { min: 260, max: 520 }, speed: { min: 18, max: 60 }, angle: { min: 200, max: 340 },
      gravityY: 220, scale: { start: 0.9, end: 0.5 }, alpha: { start: 1, end: 0.3 }, tint: [0x8a1010, 0xb01818, 0x6a0a0a],
      maxParticles: 160,
    }).setDepth(BODY_DEPTH);
    this.smoke = scene.add.particles(0, 0, PUFF_TEX, {
      emitting: false, lifespan: { min: 1800, max: 3200 }, speedY: { min: -18, max: -6 }, speedX: { min: -10, max: 10 },
      scale: { start: 0.6, end: 2.4 }, alpha: { start: 0.55, end: 0 }, tint: [0x3a3430, 0x4e4842, 0x2a2624],
      maxParticles: 140,
    }).setDepth(BODY_DEPTH + 0.5);
    this.dust = scene.add.particles(0, 0, PUFF_TEX, {
      emitting: false, lifespan: { min: 300, max: 600 }, speed: { min: 6, max: 22 }, angle: { min: 180, max: 360 },
      scale: { start: 0.25, end: 0.7 }, alpha: { start: 0.6, end: 0 }, tint: [0xb8a88a, 0x9a8a70], maxParticles: 120,
    }).setDepth(BODY_DEPTH);
  }

  destroy(): void {
    for (const o of [this.sparks, this.embers, this.flames, this.debris, this.blood, this.smoke, this.dust, ...this.glows]) o.destroy();
    this.clearDecals();
    this.glows = [];
  }

  /** Quita las manchas del suelo (al girar o inclinar la vista cambian de sitio). */
  clearDecals(): void {
    for (const s of this.scorches) s.img.destroy();
    this.scorches = [];
  }

  /** Cada fotograma: las manchas quemadas se van borrando. */
  update(): void {
    const now = this.scene.time.now;
    for (let i = this.scorches.length - 1; i >= 0; i--) {
      const s = this.scorches[i];
      const age = (now - s.born) / SCORCH_MS;
      if (age >= 1) {
        s.img.destroy();
        this.scorches.splice(i, 1);
      } else if (age > 0.6) s.img.setAlpha(0.75 * (1 - (age - 0.6) / 0.4));
    }
  }

  /** Fogonazo en la boca del arma (dir: 1 a la derecha, −1 a la izquierda; 0 si no se sabe). */
  muzzle(x: number, y: number, dir: number, big = false): void {
    this.glow(x, y, big ? 2.2 : 1.4, 0xffd890, 110);
    const star = this.glowImage(STAR_TEX);
    star.setPosition(x, y).setTint(0xfff4c0).setAlpha(1).setScale((big ? 0.9 : 0.6) * (Math.random() < 0.5 ? 1 : -1), big ? 0.9 : 0.6)
      .setRotation(dir === 0 ? Math.random() * Math.PI : (Math.random() - 0.5) * 0.4);
    this.fade(star, 70);
    this.sparks.emitParticleAt(x, y, big ? 4 : 2);
    this.dust.emitParticleAt(x + dir * 2, y, 1);
  }

  /** Llamarada del lanzallamas hacia delante. */
  flameJet(x: number, y: number, dir: number): void {
    this.glow(x + dir * 10, y, 2.6, 0xff9a40, 260);
    for (let i = 0; i < 6; i++) {
      const d = 4 + i * 4;
      this.flames.emitParticleAt(x + dir * d, y + (Math.random() - 0.5) * 3, 1);
    }
    this.embers.emitParticleAt(x + dir * 18, y, 3);
  }

  /** Golpe recibido: sangre en la carne y chispas en las máquinas. */
  hit(x: number, y: number, kind: HitKind, strength = 1): void {
    const n = Math.max(2, Math.min(10, Math.round(4 * strength)));
    if (kind === 'machine') {
      this.sparks.emitParticleAt(x, y, n + 2);
      this.glow(x, y, 0.9, 0xffe0a0, 90);
    } else {
      this.blood.emitParticleAt(x, y, n);
    }
  }

  /** Un disparo que no da a nadie levanta polvo donde cae. */
  miss(x: number, y: number): void {
    this.dust.emitParticleAt(x, y, 3);
  }

  /** Explosión (granada, mina, mortero, montón de ⛽…): destello, onda, cascotes, chispas, humo y mancha. */
  explosion(x: number, y: number, groundX: number, groundY: number): void {
    this.glow(x, y, 7, 0xffc070, 520);
    this.glow(x, y, 3.2, 0xfff0c0, 200);
    const ring = this.glowImage(RING_TEX);
    ring.setPosition(groundX, groundY).setTint(0xfff0d0).setAlpha(0.85).setScale(0.15, 0.08).setRotation(0);
    this.scene.tweens.add({
      targets: ring, scaleX: (TILE * 3.4) / 64, scaleY: (TILE * 1.9) / 64, alpha: 0, duration: 420, ease: 'Cubic.easeOut',
      onComplete: () => ring.setVisible(false),
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.flames.emitParticleAt(x + Math.cos(a) * 6, y + Math.sin(a) * 4, 1);
    }
    this.sparks.emitParticleAt(x, y, 18);
    this.debris.emitParticleAt(x, y, 16);
    this.dust.emitParticleAt(groundX, groundY, 8);
    // El humo sale un poco después y tarda en irse.
    for (let i = 0; i < 4; i++) {
      this.scene.time.delayedCall(80 + i * 120, () => this.smoke.emitParticleAt(x + (Math.random() - 0.5) * 14, y - i * 3, 2));
    }
    this.scorch(groundX, groundY);
  }

  /** Brasa que salta de una casilla que arde. */
  ember(x: number, y: number): void {
    this.embers.emitParticleAt(x + (Math.random() - 0.5) * TILE * 0.7, y, 1);
  }

  /** Humo espeso de un incendio. */
  fireSmoke(x: number, y: number): void {
    this.smoke.emitParticleAt(x + (Math.random() - 0.5) * 6, y, 1);
  }

  private scorch(x: number, y: number): void {
    if (this.scorches.length >= MAX_SCORCH) {
      this.scorches.shift()?.img.destroy();
    }
    const img = this.scene.add.image(x, y, SCORCH_TEX).setDepth(DECAL_DEPTH).setAlpha(0.75)
      .setScale((TILE * 2.6) / 32, (TILE * 1.6) / 32).setRotation((Math.random() - 0.5) * 0.3);
    this.scorches.push({ img, born: this.scene.time.now });
  }

  /** Luz que se enciende y se apaga en un momento (se ve más de noche). */
  private glow(x: number, y: number, tiles: number, color: number, ms: number): void {
    const img = this.glowImage(GLOW_TEX);
    const s = (tiles * TILE * 2) / 64;
    img.setPosition(x, y).setTint(color).setAlpha(0.95).setScale(s).setRotation(0);
    this.fade(img, ms);
    this.onLight?.(x, y, tiles, color, ms);
  }

  private fade(img: Phaser.GameObjects.Image, ms: number): void {
    this.scene.tweens.add({ targets: img, alpha: 0, duration: ms, ease: 'Quad.easeIn', onComplete: () => img.setVisible(false) });
  }

  /** Imagen suelta del montón (se reutilizan las que ya no se ven). */
  private glowImage(tex: string): Phaser.GameObjects.Image {
    let img = this.glows.find((g) => !g.visible && g.texture.key === tex);
    if (!img) {
      img = this.scene.add.image(0, 0, tex).setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW_DEPTH);
      this.glows.push(img);
    }
    this.scene.tweens.killTweensOf(img);
    return img.setVisible(true);
  }
}

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  draw(t.getContext());
  t.refresh();
}

function makeTextures(scene: Phaser.Scene): void {
  canvasTex(scene, GLOW_TEX, 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
  canvasTex(scene, SPARK_TEX, 3, 3, (c) => {
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fillRect(0, 0, 3, 3);
    c.fillStyle = '#ffffff';
    c.fillRect(1, 0, 1, 3);
    c.fillRect(0, 1, 3, 1);
  });
  canvasTex(scene, PUFF_TEX, 16, 16, (c) => {
    const g = c.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 16);
  });
  canvasTex(scene, RING_TEX, 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 20, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
  // Fogonazo: estrella de cuatro puntas, más larga hacia delante.
  canvasTex(scene, STAR_TEX, 32, 32, (c) => {
    c.translate(16, 16);
    const ray = (len: number, wid: number, rot: number) => {
      c.save();
      c.rotate(rot);
      const g = c.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, -wid);
      c.lineTo(len, 0);
      c.lineTo(0, wid);
      c.closePath();
      c.fill();
      c.restore();
    };
    ray(16, 3, 0);
    ray(7, 2, Math.PI);
    ray(8, 2, Math.PI / 2);
    ray(8, 2, -Math.PI / 2);
    ray(10, 1.5, Math.PI / 4);
    ray(10, 1.5, -Math.PI / 4);
    c.fillStyle = 'rgba(255,255,255,1)';
    c.beginPath();
    c.arc(0, 0, 3, 0, Math.PI * 2);
    c.fill();
  });
  // Mancha quemada: centro negro, borde pardo deshilachado.
  canvasTex(scene, SCORCH_TEX, 32, 32, (c) => {
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(10,8,6,0.95)');
    g.addColorStop(0.45, 'rgba(26,20,14,0.8)');
    g.addColorStop(0.8, 'rgba(50,38,26,0.35)');
    g.addColorStop(1, 'rgba(50,38,26,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
    // Rayos de hollín hacia fuera.
    c.strokeStyle = 'rgba(14,10,8,0.5)';
    c.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.13;
      const r1 = 6 + (i % 4);
      const r2 = 12 + ((i * 7) % 4);
      c.beginPath();
      c.moveTo(16 + Math.cos(a) * r1, 16 + Math.sin(a) * r1);
      c.lineTo(16 + Math.cos(a) * r2, 16 + Math.sin(a) * r2);
      c.stroke();
    }
  });
}
