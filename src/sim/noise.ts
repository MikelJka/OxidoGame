import { Rng } from './rng';

/**
 * Ruido de valor 2D suavizado con varias octavas (fBm).
 * Devuelve valores aproximadamente en [0, 1].
 */
export class ValueNoise {
  private readonly perm: Uint8Array;
  private readonly values: Float32Array;

  constructor(rng: Rng) {
    this.perm = new Uint8Array(512);
    this.values = new Float32Array(256);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    for (let i = 0; i < 256; i++) this.values[i] = rng.next();
  }

  private lattice(ix: number, iy: number): number {
    return this.values[this.perm[(this.perm[ix & 255] + iy) & 511]];
  }

  /** Ruido de una sola octava en [0, 1]. */
  sample(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = this.lattice(x0, y0);
    const b = this.lattice(x0 + 1, y0);
    const c = this.lattice(x0, y0 + 1);
    const d = this.lattice(x0 + 1, y0 + 1);
    const top = a + (b - a) * sx;
    const bottom = c + (d - c) * sx;
    return top + (bottom - top) * sy;
  }

  /** Suma de octavas, normalizada a [0, 1]. */
  fbm(x: number, y: number, octaves = 4, persistence = 0.5): number {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let max = 0;
    for (let o = 0; o < octaves; o++) {
      total += this.sample(x * frequency, y * frequency) * amplitude;
      max += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / max;
  }
}
