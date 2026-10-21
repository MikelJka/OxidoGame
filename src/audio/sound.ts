// Sonido del juego (pedido por Mikel el 2026-10-21): efectos con ZzFX (librería open source, MIT)
// y ambiente hecho con Web Audio (viento, lluvia, agua, fuego, pájaros de día y grillos de noche).
// Los efectos suenan más fuerte cuanto más cerca de la cámara y a la izquierda o a la derecha según
// dónde ocurren. Sin archivos de audio: todo se genera en el navegador. Solo presentación.
import { ZZFX_RATE, zzfxG, ZzfxParams } from './zzfx';

/** Efectos (parámetros de ZzFX; ver `zzfx.ts`). */
const FX: Record<string, ZzfxParams> = {
  disparo: [1.1, 0.06, 300, 0, 0.02, 0.18, 4, 2.5, -5, 0, 0, 0, 0, 9, 0, 0.1, 0, 0.6, 0.05],
  escopeta: [1.5, 0.05, 170, 0, 0.04, 0.32, 4, 2, -3, 0, 0, 0, 0, 12, 0, 0.2, 0, 0.5, 0.08],
  rafaga: [0.9, 0.08, 320, 0, 0.01, 0.1, 4, 2.5, -6, 0, 0, 0, 0, 9, 0, 0.1, 0, 0.6, 0.03],
  arco: [0.5, 0.1, 420, 0, 0.02, 0.14, 2, 1, -25, 0, 0, 0, 0, 0.5],
  llamas: [0.7, 0.1, 80, 0.02, 0.2, 0.3, 4, 1, 0, 0, 0, 0, 0, 25, 0, 0.2, 0, 0.7, 0, 0, 900],
  golpe: [0.8, 0.12, 90, 0, 0.01, 0.12, 3, 1, -2, 0, 0, 0, 0, 4],
  gruñido: [0.6, 0.2, 70, 0.02, 0.12, 0.2, 3, 2, -1, 0, 0, 0, 0, 6, 8],
  explosion: [2, 0.1, 60, 0, 0.12, 0.9, 4, 1, -0.4, 0, 0, 0, 0, 20, 0, 0.3, 0, 0.4, 0.2],
  hacha: [0.45, 0.1, 180, 0, 0.01, 0.08, 4, 1.5, -8, 0, 0, 0, 0, 6, 0, 0, 0, 0.5, 0.02],
  pico: [0.4, 0.1, 900, 0, 0.01, 0.07, 1, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0.4, 0.02],
  martillo: [0.4, 0.1, 380, 0, 0.01, 0.05, 1, 1, -10, 0, 0, 0, 0, 1],
  azada: [0.3, 0.2, 120, 0, 0.02, 0.1, 4, 1, 0, 0, 0, 0, 0, 15],
  alarma: [0.6, 0, 300, 0.04, 0.9, 0.3, 2, 1, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 1, 0, 0.4],
  bueno: [0.35, 0, 660, 0.01, 0.08, 0.3, 0, 1, 0, 0, 330, 0.08],
  malo: [0.45, 0, 160, 0.01, 0.15, 0.4, 1, 1, -2],
  muerte: [0.6, 0, 110, 0.05, 0.4, 0.9, 0, 1, -1, 0, 0, 0, 0, 0, 0, 0, 0.2],
  pajaro: [0.12, 0.3, 2100, 0.01, 0.02, 0.07, 0, 1, 20, 0, 500, 0.04, 0.06],
  grillo: [0.05, 0.1, 4300, 0, 0.08, 0.03, 0, 1, 0, 0, 0, 0, 0.02, 0, 0, 0, 0, 1, 0, 0.9],
  trueno: [1.6, 0.1, 40, 0.05, 0.5, 1.8, 4, 1, 0, 0, 0, 0, 0, 30, 0, 0.5, 0.1, 0.5, 0.3],
  chapoteo: [0.25, 0.2, 300, 0, 0.02, 0.12, 4, 1, 0, 0, 0, 0, 0, 15],
  clic: [0.15, 0, 1300, 0, 0, 0.02, 1],
};

/** Cada cuánto, como mucho, suena cada efecto (ms): una batalla no se vuelve ruido. */
const MIN_GAP: Record<string, number> = { disparo: 45, rafaga: 45, golpe: 60, hacha: 120, pico: 120, martillo: 120, azada: 150, pajaro: 300 };

/** Niveles de volumen que se eligen en el menú. */
export const VOLUME_STEPS = [1, 0.5, 0] as const;
const VOLUME_KEY = 'oxido-volumen';

export interface Ambience {
  /** 0–1 de cada capa. */
  wind: number;
  rain: number;
  water: number;
  fire: number;
  /** De día cantan pájaros; de noche, grillos. */
  night: boolean;
  /** Invierno: sin pájaros ni grillos. */
  winter: boolean;
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers: Record<'wind' | 'rain' | 'water' | 'fire', GainNode> | null = null;
  private last = new Map<string, number>();
  private listener = { x: 0, y: 0, zoom: 1, w: 800, h: 600 };
  private critterTimer = 0;
  volume = 1;

  constructor() {
    this.volume = readVolume();
    if (typeof window === 'undefined') return;
    // El navegador solo deja sonar tras un toque o una tecla.
    const unlock = () => {
      this.start();
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /** Cambia el volumen (y lo recuerda en este navegador). */
  setVolume(v: number): void {
    this.volume = v;
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      /* sin almacenamiento: solo esta vez */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v * 0.8, this.ctx.currentTime, 0.1);
  }

  private start(): void {
    if (this.ctx || typeof AudioContext === 'undefined') return;
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume * 0.8;
    // Un compresor suave para que una explosión no reviente lo demás.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.layers = {
      wind: this.loop(brownNoise(ctx, 4), 'lowpass', 420, 0.6),
      rain: this.loop(whiteNoise(ctx, 3), 'bandpass', 2600, 0.4),
      water: this.loop(brownNoise(ctx, 5), 'lowpass', 700, 0.5),
      fire: this.loop(crackle(ctx, 4), 'highpass', 300, 0.7),
    };
  }

  /** Capa de ambiente: un sonido en bucle, filtrado, con su volumen (empieza callado). */
  private loop(buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number): GainNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master!);
    src.start();
    return g;
  }

  /** Dónde mira la cámara (centro en píxeles del mundo, zoom y tamaño de la pantalla). */
  setListener(x: number, y: number, zoom: number, w: number, h: number): void {
    this.listener = { x, y, zoom, w, h };
  }

  /** Suena un efecto; con `at` (píxeles del mundo), más flojo cuanto más lejos de la cámara. */
  play(name: string, at?: { x: number; y: number }, gain = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.volume <= 0 || ctx.state !== 'running') return;
    const p = FX[name];
    if (!p) return;
    const now = performance.now();
    if (now - (this.last.get(name) ?? -1e9) < (MIN_GAP[name] ?? 30)) return;
    let vol = gain;
    let pan = 0;
    if (at) {
      const L = this.listener;
      const dx = ((at.x - L.x) * L.zoom) / (L.w / 2);
      const dy = ((at.y - L.y) * L.zoom) / (L.h / 2);
      const d = Math.hypot(dx, dy);
      vol *= d < 1 ? 1 : Math.max(0, 1 - (d - 1) * 0.7);
      // Muy alejado (zoom pequeño), todo suena algo más lejano.
      vol *= Math.min(1, 0.45 + L.zoom * 0.3);
      pan = Math.max(-1, Math.min(1, dx * 0.6));
    }
    if (vol < 0.03) return;
    this.last.set(name, now);
    const data = zzfxG(p);
    const buf = ctx.createBuffer(1, data.length, ZZFX_RATE);
    buf.getChannelData(0).set(data);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol * 0.5;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    src.connect(g).connect(panner).connect(this.master);
    src.start();
  }

  /** Ambiente: cada capa va poco a poco a su volumen; de vez en cuando, un pájaro o un grillo. */
  updateAmbience(a: Ambience, delta: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.layers) return;
    const t = ctx.currentTime;
    const set = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, t, 0.8);
    set(this.layers.wind, 0.05 + a.wind * 0.35);
    set(this.layers.rain, a.rain * 0.35);
    set(this.layers.water, a.water * 0.25);
    set(this.layers.fire, a.fire * 0.4);
    if (a.winter || a.rain > 0.3) return;
    this.critterTimer -= delta;
    if (this.critterTimer > 0) return;
    if (a.night) {
      this.critterTimer = 120 + Math.random() * 500;
      this.play('grillo', undefined, 0.6 + Math.random() * 0.4);
    } else {
      this.critterTimer = 1500 + Math.random() * 5000;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) window.setTimeout(() => this.play('pajaro', undefined, 0.5 + Math.random() * 0.5), i * 140);
    }
  }
}

function readVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return localStorage.getItem(VOLUME_KEY) === null || !Number.isFinite(v) ? 1 : Math.max(0, Math.min(1, v));
  } catch {
    return 1;
  }
}

function whiteNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Ruido marrón (grave, como viento o agua lejana), con subidas y bajadas lentas. */
function brownNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    const swell = 0.6 + 0.4 * Math.sin((i / d.length) * Math.PI * 2 * 2);
    d[i] = last * 3.5 * swell;
  }
  return buf;
}

/** Chisporroteo del fuego: chasquidos sueltos sobre un rumor. */
function crackle(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 1.5;
    if (Math.random() < 0.0009) {
      const len = 60 + Math.floor(Math.random() * 200);
      const amp = 0.3 + Math.random() * 0.6;
      for (let k = 0; k < len && i + k < d.length; k++) d[i + k] += (Math.random() * 2 - 1) * amp * (1 - k / len);
    }
  }
  return buf;
}
