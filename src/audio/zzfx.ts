// ZzFX — Zuper Zmall Zound Zynth, de Frank Force (https://github.com/KilledByAPixel/ZzFX).
// Licencia MIT, Copyright (c) 2019 Frank Force. Adaptado a TypeScript para Óxido: solo el generador
// de muestras (zzfxG); la reproducción la hace `sound.ts` con Web Audio.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
// associated documentation files (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge, publish, distribute,
// sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions: The above copyright notice and this
// permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

export const ZZFX_RATE = 44100;

/**
 * Parámetros de un sonido de ZzFX, en su orden: volumen, azar, frecuencia, ataque, sostenido,
 * caída, forma, curva, deslizamiento, deslizamiento², salto de tono, momento del salto, repetición,
 * ruido, modulación, bitcrush, eco, volumen sostenido, decaimiento, trémolo, filtro.
 */
export type ZzfxParams = number[];

/** Genera las muestras (−1…1) de un sonido. `rand` da números en [0, 1). */
export function zzfxG(p: ZzfxParams, rand: () => number = Math.random): Float32Array {
  let [volume = 1, randomness = 0.05, frequency = 220, attack = 0, sustain = 0, release = 0.1, shape = 0, shapeCurve = 1,
    slide = 0, deltaSlide = 0, pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0, bitCrush = 0,
    delay = 0, sustainVolume = 1, decay = 0, tremolo = 0, filter = 0] = p;
  const PI2 = Math.PI * 2;
  const sr = ZZFX_RATE;
  const sign = (v: number) => (v < 0 ? -1 : 1);
  slide *= (500 * PI2) / sr / sr;
  const startSlide = slide;
  frequency *= ((1 + randomness * 2 * rand() - randomness) * PI2) / sr;
  let startFrequency = frequency;
  const quality = 2;
  const w = (PI2 * Math.abs(filter) * 2) / sr;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / 2 / quality;
  const a0 = 1 + alpha;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  const b0 = (1 + sign(filter) * cos) / 2 / a0;
  const b1 = -(sign(filter) + cos) / a0;
  const b2 = b0;
  let x2 = 0, x1 = 0, y2 = 0, y1 = 0;
  attack = attack * sr + 9;
  decay *= sr;
  sustain *= sr;
  release *= sr;
  delay *= sr;
  deltaSlide *= (500 * PI2) / sr ** 3;
  modulation *= PI2 / sr;
  pitchJump *= PI2 / sr;
  pitchJumpTime *= sr;
  repeatTime = (repeatTime * sr) | 0;
  const length = (attack + decay + sustain + release + delay) | 0;
  const b = new Float32Array(length);
  let t = 0, tm = 0, j = 1, r = 0, c = 0, s = 0;
  const crush = (bitCrush * 100) | 0;
  for (let i = 0; i < length; i++) {
    if (!crush || !(++c % crush)) {
      s = shape
        ? shape > 1
          ? shape > 2
            ? shape > 3
              ? Math.sin(t ** 3)
              : Math.max(Math.min(Math.tan(t), 1), -1)
            : 1 - ((((2 * t) / PI2) % 2) + 2) % 2
          : 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2)
        : Math.sin(t);
      const env = i < attack ? i / attack
        : i < attack + decay ? 1 - ((i - attack) / decay) * (1 - sustainVolume)
        : i < attack + decay + sustain ? sustainVolume
        : i < length - delay ? ((length - i - delay) / release) * sustainVolume
        : 0;
      s = (repeatTime ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) : 1) * sign(s) * Math.abs(s) ** shapeCurve * env;
      if (delay) s = s / 2 + (delay > i ? 0 : ((i < length - delay ? 1 : (length - i) / delay) * b[(i - delay) | 0]) / 2);
      if (filter) {
        const y = b2 * x2 + b1 * x1 + b0 * s - a2 * y2 - a1 * y1;
        x2 = x1;
        x1 = s;
        y2 = y1;
        y1 = y;
        s = y;
      }
    }
    const f = (frequency += slide += deltaSlide) * Math.cos(modulation * tm++);
    t += f + f * noise * Math.sin(i ** 5);
    if (j && ++j > pitchJumpTime) {
      frequency += pitchJump;
      startFrequency += pitchJump;
      j = 0;
    }
    if (repeatTime && !(++r % repeatTime)) {
      frequency = startFrequency;
      slide = startSlide;
      j = j || 1;
    }
    b[i] = s * volume;
  }
  return b;
}
