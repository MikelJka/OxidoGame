// Ambiente del mapa (salto de calidad del 2D, pedido por Mikel el 2026-10-21): luz del día que cambia
// con la hora (amanecer cálido, noche azulada), luces que brillan de noche (lámparas, hogueras, estufas
// y el fuego), humo que sube de lo que arde, lluvia, nieve, polvo y relámpagos según el tiempo, y
// motas de polvo flotando de día. Solo dibujo: lee el estado del mundo y no decide nada.
// Pulido de la luz (última parte, sesión 68): la oscuridad es un «mapa de luz» en el que cada luz abre
// un hueco con su color (el suelo junto a una lámpara se ve con sus colores, no tapado de amarillo),
// las luces se aplastan como el suelo inclinado, las máquinas con corriente dejan un piloto de luz, los
// fogonazos y explosiones iluminan alrededor, con tormenta o polvo las luces se notan aunque sea de día
// y los bordes de la pantalla se oscurecen un poco (más de noche).
import Phaser from 'phaser';
import { eventDef } from '../data/events';
import { isWinter } from '../sim/seasons';
import { footprint } from '../sim/structures';
import type { World } from '../sim/world';
import { graphics } from './graphics';
import { TILE, TILE_H } from './projection';

const LIGHT_TEX = 'atmo-light';
const DOT_TEX = 'atmo-dot';
const DROP_TEX = 'atmo-drop';
const PUFF_TEX = 'atmo-puff';
const LIGHTMAP_TEX = 'atmo-lightmap';
const VIGNETTE_TEX = 'atmo-vignette';
// Cuántas luces y a qué resolución el mapa de luz: según la calidad gráfica (`graphics.ts`).
const OVERLAY_DEPTH = 900;

/** Dónde se dibuja una casilla del mapa (la escena sabe girar la vista y la altura). */
export type TileToScreen = (x: number, y: number) => { x: number; y: number };

interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: number;
  flicker: boolean;
  /** Piloto de una máquina: luz pequeña y fría, sin halo. */
  small?: boolean;
}

/** Destello de un disparo o una explosión que se apaga en `ms`. */
interface Flash {
  x: number;
  y: number;
  tiles: number;
  color: number;
  born: number;
  ms: number;
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
  /** Oscuridad: mapa de luz que se multiplica por todo lo de debajo. */
  private overlay: Phaser.GameObjects.RenderTexture;
  private vignette: Phaser.GameObjects.Image;
  private flashes: Flash[] = [];
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
  /** Cae un rayo (para el trueno). */
  onBolt?: () => void;
  /** Fuegos y hogueras que se ven ahora (para el sonido). */
  flickerNear = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly toScreen: TileToScreen) {
    makeTextures(scene);
    this.overlay = scene.add.renderTexture(0, 0, 64, 64).setOrigin(0, 0).setDepth(OVERLAY_DEPTH);
    this.overlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
    // El juego es pixel art (filtro «más cercano»): el mapa de luz, estirado, se ve suave con el lineal.
    this.overlay.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.vignette = scene.add.image(0, 0, VIGNETTE_TEX).setOrigin(0, 0).setDepth(OVERLAY_DEPTH + 0.5);
    this.vignette.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.haze = scene.add.rectangle(0, 0, 10, 10, 0x9a7a4a, 0).setOrigin(0, 0).setDepth(OVERLAY_DEPTH + 2);
    // Zona de salida de las partículas: lo que se ve de la cámara (se mueve con ella).
    const area = this.zone;
    const zone = {
      type: 'random' as const,
      source: {
        getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
          p.x = area.x + Math.random() * area.width;
          p.y = area.y + Math.random() * area.height;
          return p;
        },
      },
    };
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
    this.applyGraphics();
  }

  /** Aplica la calidad gráfica elegida: cuántas partículas del tiempo salen. */
  applyGraphics(): void {
    const k = graphics().weather;
    if (k <= 0) {
      for (const e of [this.rain, this.snow, this.dust, this.motes]) e.stop();
      return;
    }
    // A menos calidad, salen la mitad de veces.
    this.rain.setFrequency(16 / k, 6);
    this.snow.setFrequency(30 / k, 2);
    this.dust.setFrequency(20 / k, 4);
    this.motes.setFrequency(260 / k, 1);
  }

  destroy(): void {
    for (const o of [this.overlay, this.vignette, this.haze, this.smoke, this.rain, this.snow, this.dust, this.motes, ...this.lights]) o.destroy();
    this.lights = [];
  }

  update(world: World, delta: number): void {
    const cam = this.scene.cameras.main;
    const v = cam.worldView;
    const pad = 40;
    this.zone.setTo(v.x - pad, v.y - pad, v.width + pad * 2, v.height + pad);
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
        this.onBolt?.();
      }
    }
    if (this.flash > 0) {
      color = lerpColor(color, 0xffffff, this.flash);
      this.flash = Math.max(0, this.flash - delta / 180);
    }
    this.haze.setFillStyle(0x9a7a4a, dustStorm ? 0.22 : 0);
    // Cuánta falta hace la luz: de noche, y también de día con tormenta, lluvia o polvo.
    const need = Math.max(amb.dark, Math.min(1, (1 - luminance(color)) * 1.6));
    // Bordes de la pantalla algo más oscuros, como en el cine (más de noche).
    this.vignette.setPosition(v.x - pad, v.y - pad).setDisplaySize(v.width + pad * 2, v.height + pad * 2);
    this.vignette.setAlpha(0.1 + 0.32 * need);

    // En calidad baja no hay partículas del tiempo.
    const particles = graphics().weather > 0;
    setEmitting(this.rain, particles && (storm || acid));
    this.rain.setParticleTint(acid ? 0xa8e070 : 0xc0d0e0);
    setEmitting(this.snow, particles && (cold || (isWinter(world) && amb.dark > 0.5)));
    setEmitting(this.dust, particles && dustStorm);
    setEmitting(this.motes, particles && amb.dark < 0.3 && !storm && !acid && !dustStorm);

    const t = this.scene.time.now;
    this.flashes = this.flashes.filter((f) => t - f.born < f.ms);
    const sources = need > 0.05 || world.fires.size ? lightSources(world, this.toScreen, v) : [];
    this.drawLightmap(color, need, sources, v, pad, t);
    this.updateLights(sources, need, delta);
  }

  /** Un fogonazo o una explosión: ilumina el suelo de alrededor y se apaga en `ms`. */
  flashLight(x: number, y: number, tiles: number, color: number, ms: number): void {
    if (this.flashes.length >= 40) this.flashes.shift();
    this.flashes.push({ x, y, tiles, color, born: this.scene.time.now, ms });
  }

  /**
   * La oscuridad: se llena con el color del ambiente y cada luz suma el suyo encima (así, junto a una
   * lámpara, el suelo recupera su color). Luego todo se multiplica por lo que hay debajo.
   */
  private drawLightmap(color: number, need: number, sources: LightSource[], v: Phaser.Geom.Rectangle, pad: number, t: number): void {
    const rt = this.overlay;
    if (color === 0xffffff) {
      rt.setVisible(false);
      return;
    }
    const cam = this.scene.cameras.main;
    const worldW = v.width + pad * 2;
    const worldH = v.height + pad * 2;
    // Calidad baja: sin mapa de luz, solo la capa del color del ambiente (las luces, con su halo encima).
    const res = graphics().lightmapRes;
    const w = res > 0 ? Math.max(16, Math.ceil(cam.width * res)) : 16;
    const h = res > 0 ? Math.max(16, Math.ceil(cam.height * res)) : 16;
    if (rt.width !== w || rt.height !== h) {
      rt.resize(w, h);
      rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    rt.setVisible(true).setPosition(v.x - pad, v.y - pad).setDisplaySize(worldW, worldH);
    const kx = w / worldW;
    const ky = h / worldH;
    rt.clear();
    rt.fill(color, 1);
    if (need <= 0.02 || res <= 0) return;
    const maxLights = graphics().maxLights;
    // Las luces caen sobre el suelo inclinado: se aplastan como él.
    const squash = TILE_H / TILE;
    const add = Phaser.BlendModes.ADD;
    let n = 0;
    for (const s of sources) {
      if (n++ >= maxLights) break;
      const wob = s.flicker ? flickerAt(t, s.x, s.y) : 1;
      const size = (s.radius * TILE * 2 * wob) / 128;
      rt.stamp(LIGHTMAP_TEX, undefined, (s.x - v.x + pad) * kx, (s.y - v.y + pad) * ky, {
        scaleX: size * kx, scaleY: size * ky * squash, tint: s.color, alpha: Math.min(1, need * (s.small ? 0.7 : 1.05) * wob), blendMode: add,
      });
    }
    for (const f of this.flashes) {
      const k = 1 - (t - f.born) / f.ms;
      const size = (f.tiles * TILE * 2.4) / 128;
      rt.stamp(LIGHTMAP_TEX, undefined, (f.x - v.x + pad) * kx, (f.y - v.y + pad) * ky, {
        scaleX: size * kx, scaleY: size * ky * squash, tint: f.color, alpha: Math.min(1, need * 1.2 * k * k), blendMode: add,
      });
    }
  }

  /** Halo de las luces por encima de la oscuridad (el brillo de la bombilla o la llama, no el suelo). */
  private updateLights(sources: LightSource[], dark: number, delta: number): void {
    // Humo de lo que arde (también de día).
    this.smokeTimer += delta;
    if (this.smokeTimer > 260) {
      this.smokeTimer = 0;
      for (const s of sources) if (s.flicker && Math.random() < 0.35) this.smoke.emitParticleAt(s.x + (Math.random() - 0.5) * 4, s.y - 4, 1);
    }
    this.flickerNear = sources.filter((s) => s.flicker).length;
    let n = 0;
    const t = this.scene.time.now;
    for (const s of sources) {
      if (n >= graphics().maxLights) break;
      const strength = Math.max(dark, s.flicker ? 0.35 : 0) * (s.small ? 0.45 : 0.55);
      if (strength <= 0.02) continue;
      let img = this.lights[n];
      if (!img) {
        img = this.scene.add.image(0, 0, LIGHT_TEX).setBlendMode(Phaser.BlendModes.ADD).setDepth(OVERLAY_DEPTH + 1);
        this.lights.push(img);
      }
      const wob = s.flicker ? flickerAt(t, s.x, s.y) : 1;
      // Halo más pequeño que la luz del suelo: rodea la llama o la bombilla.
      const r = s.small ? 0.9 : s.radius * 0.55;
      img.setVisible(true).setPosition(s.x, s.y - (s.small ? 0 : 3)).setTint(s.color).setAlpha(Math.min(0.9, strength * wob)).setScale((r * TILE * 2 * wob) / 128);
      n++;
    }
    for (let i = n; i < this.lights.length; i++) this.lights[i].setVisible(false);
  }
}

/** Parpadeo de una llama: varias ondas a destiempo (cada fuego, a su ritmo). */
function flickerAt(t: number, x: number, y: number): number {
  return 0.88 + 0.07 * Math.sin(t / 90 + x * 0.3) + 0.04 * Math.sin(t / 37 + y) + 0.03 * Math.sin(t / 211 + x + y);
}

/** Brillo de un color (0 negro … 1 blanco). */
function luminance(c: number): number {
  return (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
}

/** Lámparas encendidas, hogueras y estufas con leña, máquinas con corriente y casillas que arden (las que se ven). */
function lightSources(world: World, toScreen: TileToScreen, view: Phaser.Geom.Rectangle): LightSource[] {
  const out: LightSource[] = [];
  const inView = (p: { x: number; y: number }) => p.x > view.x - 60 && p.x < view.right + 60 && p.y > view.y - 60 && p.y < view.bottom + 60;
  for (const s of world.structures.all()) {
    if (!s.built) continue;
    const lamp = s.def.light && s.powered;
    const burning = (s.def.cheer || s.def.heater) && (s.fuel ?? 0) > 0;
    // Piloto: una máquina que gasta corriente y le llega (no las averiadas).
    const machine = !lamp && !burning && s.powered && !s.repair && ((s.def.power ?? 0) < 0 || s.electric);
    if (!lamp && !burning && !machine) continue;
    const f = footprint(s.def, s.rot);
    const p = toScreen(s.x + f.w / 2, s.y + f.h / 2);
    if (!inView(p)) continue;
    if (machine) out.push({ x: p.x, y: p.y - TILE_H / 2, radius: 1.3, color: 0x9ad4ff, flicker: false, small: true });
    else out.push({ x: p.x, y: p.y - TILE_H / 2, radius: lamp ? (s.def.light ?? 3) + 1 : 3.5, color: lamp ? 0xffe2a8 : 0xff9a40, flicker: !lamp });
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
  if (!scene.textures.exists(LIGHTMAP_TEX)) {
    // Luz del suelo: cae suave, como la de verdad (más fuerte en el centro, sin borde).
    const t = scene.textures.createCanvas(LIGHTMAP_TEX, 128, 128);
    if (t) {
      const c = t.getContext();
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.82)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.38)');
      g.addColorStop(0.85, 'rgba(255,255,255,0.1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      t.refresh();
    }
  }
  if (!scene.textures.exists(VIGNETTE_TEX)) {
    // Bordes oscuros: transparente en el centro y negro hacia las esquinas.
    const t = scene.textures.createCanvas(VIGNETTE_TEX, 128, 128);
    if (t) {
      const c = t.getContext();
      const g = c.createRadialGradient(64, 64, 30, 64, 64, 92);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
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
