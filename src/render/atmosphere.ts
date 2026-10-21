// Ambiente del mapa (salto de calidad del 2D, pedido por Mikel el 2026-10-21): luz del día que cambia
// con la hora (amanecer cálido, noche azulada), luces que brillan de noche (lámparas, hogueras, estufas
// y el fuego), humo que sube de lo que arde, lluvia, nieve, polvo y relámpagos según el tiempo, y
// motas de polvo flotando de día. Solo dibujo: lee el estado del mundo y no decide nada.
import Phaser from 'phaser';
import { eventDef } from '../data/events';
import { isWinter } from '../sim/seasons';
import type { World } from '../sim/world';
import { TILE, TILE_H } from './projection';

const LIGHT_TEX = 'atmo-light';
const DOT_TEX = 'atmo-dot';
const DROP_TEX = 'atmo-drop';
const PUFF_TEX = 'atmo-puff';
const MAX_LIGHTS = 160;
const OVERLAY_DEPTH = 900;

/** Dónde se dibuja una casilla del mapa (la escena sabe girar la vista y la altura). */
export type TileToScreen = (x: number, y: number) => { x: number; y: number };

interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: number;
  flicker: boolean;
}

/** Oscuridad (0 de día, 1 en plena noche) y color del ambiente según la hora. */
export function ambientAt(hour: number): { dark: number; color: number } {
  const h = ((hour % 24) + 24) % 24;
  // Noche cerrada 21:30–4:30; transiciones al amanecer (4:30–7) y al anochecer (18–21:30).
  let dark: number;
  if (h >= 7 && h <= 18) dark = 0;
  else if (h > 18 && h < 21.5) dark = (h - 18) / 3.5;
  else if (h > 4.5 && h < 7) dark = (7 - h) / 2.5;
  else dark = 1;
  // Tono: cálido en las horas de transición, azul de noche.
  const warm = h > 17 && h < 20 ? 1 - Math.abs(h - 18.5) / 1.5 : h > 5 && h < 8 ? 1 - Math.abs(h - 6.5) / 1.5 : 0;
  const night: [number, number, number] = [70, 84, 140];
  const dusk: [number, number, number] = [255, 196, 150];
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  let c: [number, number, number] = [255, 255, 255];
  if (warm > 0) c = [lerp(255, dusk[0], warm), lerp(255, dusk[1], warm), lerp(255, dusk[2], warm)];
  c = [lerp(c[0], night[0], dark), lerp(c[1], night[1], dark), lerp(c[2], night[2], dark)];
  return { dark, color: (c[0] << 16) | (c[1] << 8) | c[2] };
}

export class Atmosphere {
  private overlay: Phaser.GameObjects.Rectangle;
  private haze: Phaser.GameObjects.Rectangle;
  private lights: Phaser.GameObjects.Image[] = [];
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private rain: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private zone = new Phaser.Geom.Rectangle(0, 0, 100, 100);
  private smokeTimer = 0;
  private flash = 0;
  private boltTimer = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly toScreen: TileToScreen) {
    makeTextures(scene);
    this.overlay = scene.add.rectangle(0, 0, 10, 10, 0xffffff).setOrigin(0, 0).setDepth(OVERLAY_DEPTH);
    this.overlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.haze = scene.add.rectangle(0, 0, 10, 10, 0x9a7a4a, 0).setOrigin(0, 0).setDepth(OVERLAY_DEPTH + 2);
    const zone = { type: 'random' as const, source: this.zone };
    this.smoke = scene.add.particles(0, 0, PUFF_TEX, {
      emitting: false, lifespan: 2600, speedY: { min: -9, max: -5 }, speedX: { min: -2, max: 4 },
      scale: { start: 0.25, end: 0.9 }, alpha: { start: 0.45, end: 0 }, tint: 0x6a6460,
    }).setDepth(OVERLAY_DEPTH - 1);
    this.rain = scene.add.particles(0, 0, DROP_TEX, {
      emitting: false, emitZone: zone, lifespan: 600, speedY: { min: 220, max: 280 }, speedX: { min: -30, max: -20 },
      alpha: { start: 0.55, end: 0.2 }, quantity: 6, frequency: 16,
    }).setDepth(OVERLAY_DEPTH + 1);
    this.snow = scene.add.particles(0, 0, DOT_TEX, {
      emitting: false, emitZone: zone, lifespan: 4000, speedY: { min: 14, max: 26 }, speedX: { min: -10, max: 10 },
      scale: { min: 0.5, max: 1 }, alpha: { start: 0.9, end: 0.3 }, quantity: 2, frequency: 30,
    }).setDepth(OVERLAY_DEPTH + 1);
    this.dust = scene.add.particles(0, 0, DOT_TEX, {
      emitting: false, emitZone: zone, lifespan: 1800, speedX: { min: 90, max: 160 }, speedY: { min: -10, max: 10 },
      scale: { min: 0.4, max: 0.9 }, alpha: { start: 0.6, end: 0 }, tint: 0xb8925a, quantity: 4, frequency: 20,
    }).setDepth(OVERLAY_DEPTH + 1);
    this.motes = scene.add.particles(0, 0, DOT_TEX, {
      emitting: false, emitZone: zone, lifespan: 6000, speedX: { min: -3, max: 3 }, speedY: { min: -4, max: -1 },
      scale: { min: 0.25, max: 0.5 }, alpha: { start: 0, end: 0.5, ease: 'Sine.easeInOut' }, tint: 0xf0e0b0, quantity: 1, frequency: 260,
    }).setDepth(OVERLAY_DEPTH + 1);
  }

  destroy(): void {
    for (const o of [this.overlay, this.haze, this.smoke, this.rain, this.snow, this.dust, this.motes, ...this.lights]) o.destroy();
    this.lights = [];
  }

  update(world: World, delta: number): void {
    const cam = this.scene.cameras.main;
    const v = cam.worldView;
    const pad = 40;
    this.zone.setTo(v.x - pad, v.y - pad, v.width + pad * 2, v.height + pad);
    this.overlay.setPosition(v.x - pad, v.y - pad).setSize(v.width + pad * 2, v.height + pad * 2);
    this.haze.setPosition(v.x - pad, v.y - pad).setSize(v.width + pad * 2, v.height + pad * 2);

    // Tiempo (sucesos que duran) y estación.
    const active = world.weather.filter((e) => world.tick < e.until).map((e) => eventDef(e.id));
    const acid = active.some((e) => e?.cropYield !== undefined);
    const storm = active.some((e) => e?.lightning);
    const dustStorm = active.some((e) => e?.solar === 0);
    const cold = active.some((e) => e?.coldWave);
    const amb = ambientAt(world.hour);
    let color = amb.color;
    // Con tormenta o lluvia, más oscuro y gris; con polvo, amarillento.
    if (storm || acid) color = mulColor(color, acid ? 0x9ab08a : 0x8a90a0);
    if (dustStorm) color = mulColor(color, 0xd8b890);
    if (cold) color = mulColor(color, 0xc8d8ff);
    // Relámpago: un destello blanco que se apaga.
    if (storm) {
      this.boltTimer -= delta;
      if (this.boltTimer <= 0) {
        this.boltTimer = 2500 + Math.random() * 6000;
        this.flash = 1;
      }
    }
    if (this.flash > 0) {
      color = lerpColor(color, 0xffffff, this.flash);
      this.flash = Math.max(0, this.flash - delta / 180);
    }
    this.overlay.setFillStyle(color, 1);
    this.overlay.setVisible(color !== 0xffffff);
    this.haze.setFillStyle(0x9a7a4a, dustStorm ? 0.22 : 0);

    setEmitting(this.rain, storm || acid);
    this.rain.setParticleTint(acid ? 0xa8e070 : 0xc0d0e0);
    setEmitting(this.snow, cold || (isWinter(world) && amb.dark > 0.5));
    setEmitting(this.dust, dustStorm);
    setEmitting(this.motes, amb.dark < 0.3 && !storm && !acid && !dustStorm);

    this.updateLights(world, amb.dark, delta);
  }

  private updateLights(world: World, dark: number, delta: number): void {
    const sources = dark > 0.05 || world.fires.size ? lightSources(world, this.toScreen, this.scene.cameras.main.worldView) : [];
    // Humo de lo que arde (también de día).
    this.smokeTimer += delta;
    if (this.smokeTimer > 260) {
      this.smokeTimer = 0;
      for (const s of sources) if (s.flicker && Math.random() < 0.35) this.smoke.emitParticleAt(s.x + (Math.random() - 0.5) * 4, s.y - 4, 1);
    }
    let n = 0;
    const t = this.scene.time.now;
    for (const s of sources) {
      if (n >= MAX_LIGHTS) break;
      const strength = Math.max(dark, s.flicker ? 0.25 : 0);
      if (strength <= 0.02) continue;
      let img = this.lights[n];
      if (!img) {
        img = this.scene.add.image(0, 0, LIGHT_TEX).setBlendMode(Phaser.BlendModes.ADD).setDepth(OVERLAY_DEPTH + 1);
        this.lights.push(img);
      }
      const wob = s.flicker ? 0.9 + 0.1 * Math.sin(t / 90 + s.x * 0.3) + 0.05 * Math.sin(t / 37 + s.y) : 1;
      img.setVisible(true).setPosition(s.x, s.y).setTint(s.color).setAlpha(Math.min(0.9, strength * 0.8 * wob)).setScale((s.radius * TILE * 2 * wob) / 128);
      n++;
    }
    for (let i = n; i < this.lights.length; i++) this.lights[i].setVisible(false);
  }
}

/** Lámparas encendidas, hogueras y estufas con leña, y casillas que arden (las que se ven). */
function lightSources(world: World, toScreen: TileToScreen, view: Phaser.Geom.Rectangle): LightSource[] {
  const out: LightSource[] = [];
  const inView = (p: { x: number; y: number }) => p.x > view.x - 60 && p.x < view.right + 60 && p.y > view.y - 60 && p.y < view.bottom + 60;
  for (const s of world.structures.all()) {
    if (!s.built) continue;
    const lamp = s.def.light && s.powered;
    const burning = (s.def.cheer || s.def.heater) && (s.fuel ?? 0) > 0;
    if (!lamp && !burning) continue;
    const p = toScreen(s.x + 0.5, s.y + 0.5);
    if (!inView(p)) continue;
    out.push({ x: p.x, y: p.y - TILE_H / 2, radius: lamp ? (s.def.light ?? 3) + 1 : 3.5, color: lamp ? 0xffe2a8 : 0xff9a40, flicker: !lamp });
  }
  let k = 0;
  for (const i of world.fires.keys()) {
    // Una de cada dos casillas que arden da luz (basta para que se vea el resplandor).
    if (k++ % 2) continue;
    const x = i % world.map.width;
    const y = (i - x) / world.map.width;
    const p = toScreen(x + 0.5, y + 0.5);
    if (!inView(p)) continue;
    out.push({ x: p.x, y: p.y - TILE_H / 2, radius: 2.5, color: 0xff7a2a, flicker: true });
  }
  return out;
}

function setEmitting(e: Phaser.GameObjects.Particles.ParticleEmitter, on: boolean): void {
  if (on && !e.emitting) e.start();
  else if (!on && e.emitting) e.stop();
}

function mulColor(a: number, b: number): number {
  const r = (((a >> 16) & 255) * ((b >> 16) & 255)) / 255;
  const g = (((a >> 8) & 255) * ((b >> 8) & 255)) / 255;
  const bl = ((a & 255) * (b & 255)) / 255;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

function lerpColor(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Texturas pequeñas de las luces y las partículas. */
function makeTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(LIGHT_TEX)) {
    const t = scene.textures.createCanvas(LIGHT_TEX, 128, 128);
    if (t) {
      const c = t.getContext();
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      t.refresh();
    }
  }
  if (!scene.textures.exists(DOT_TEX)) {
    const t = scene.textures.createCanvas(DOT_TEX, 2, 2);
    if (t) {
      const c = t.getContext();
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, 2, 2);
      t.refresh();
    }
  }
  if (!scene.textures.exists(DROP_TEX)) {
    const t = scene.textures.createCanvas(DROP_TEX, 1, 5);
    if (t) {
      const c = t.getContext();
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fillRect(0, 0, 1, 5);
      t.refresh();
    }
  }
  if (!scene.textures.exists(PUFF_TEX)) {
    const t = scene.textures.createCanvas(PUFF_TEX, 16, 16);
    if (t) {
      const c = t.getContext();
      const g = c.createRadialGradient(8, 8, 0, 8, 8, 8);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 16, 16);
      t.refresh();
    }
  }
  void TILE;
}
