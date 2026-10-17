// Texturas pixel art de las construcciones en 3D: tablones, sillares, chapa, metal, hormigón.
// Se repiten una vez por casilla (las mallas llevan las coordenadas de textura en casillas).
import type { BuildingDef } from '../data/buildings';

export type Surface = 'madera' | 'piedra' | 'chatarra' | 'metal' | 'hormigon' | 'tela';

/** De qué está hecha una construcción (por su id y su coste). */
export function surfaceOf(def: BuildingDef): Surface {
  const id = def.id;
  if (id.includes('madera') || id.includes('empalizada')) return 'madera';
  if (id.includes('piedra') || id.includes('muralla') || id === 'cantera' || id === 'pozo' || id === 'horno' || id === 'cocina') return 'piedra';
  if (id.includes('chatarra') || id.includes('chapa') || id === 'recicladora') return 'chatarra';
  if (id.includes('metal') || id === 'depuradora') return 'metal';
  if (id.includes('hormigon')) return 'hormigon';
  const cost = def.cost as Record<string, number | undefined>;
  return (cost.madera ?? 0) >= (cost.chatarra ?? 0) ? 'madera' : 'chatarra';
}

function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x ^ 0x27d4eb2d ^ s, 0x165667b1) ^ Math.imul(y ^ 0x85ebca6b, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Textura de 16×16 de una cara. `side`: lateral (tablones de pie, hiladas) o de arriba.
 * Usa los colores de la construcción para que cada material se reconozca.
 */
export function paintSurface(def: BuildingDef, side: boolean): HTMLCanvasElement {
  const S = 16;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d')!;
  const base = parse(side ? def.colors.face : def.colors.top);
  const dark = parse(def.colors.dark);
  const surf = surfaceOf(def);
  const put = (x: number, y: number, c: [number, number, number], k = 1) => {
    ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, c[0] * k)) | 0},${Math.max(0, Math.min(255, c[1] * k)) | 0},${Math.max(0, Math.min(255, c[2] * k)) | 0})`;
    ctx.fillRect(x, y, 1, 1);
  };
  const seed = def.id.length * 131 + (side ? 7 : 3);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = hash(x, y, seed);
      let k = 0.92 + n * 0.14;
      let c = base;
      if (surf === 'madera') {
        // Tablones (de pie en los lados, tumbados arriba) con vetas y clavos.
        const a = side ? x : y;
        const b = side ? y : x;
        if (a % 4 === 0) c = dark;
        else {
          k *= 0.95 + ((a >> 2) % 2) * 0.08;
          if (hash(a, b >> 2, seed) > 0.8) k *= 0.88; // veta
          if (a % 4 === 2 && (b === 2 || b === 13)) c = dark; // clavo
        }
      } else if (surf === 'piedra') {
        // Sillares en hiladas alternas.
        const row = y >> 2;
        const off = row % 2 ? 4 : 0;
        if (y % 4 === 0 || (x + off) % 8 === 0) c = dark;
        else k *= 0.9 + hash((x + off) >> 3, row, seed) * 0.2;
      } else if (surf === 'chatarra') {
        // Planchas remendadas, con óxido y remaches.
        const px = x >> 3;
        const py = y >> 3;
        const patch = hash(px, py, seed);
        k *= 0.85 + patch * 0.3;
        if (x % 8 === 0 || y % 8 === 0) c = dark;
        else if ((x % 8 === 1 || x % 8 === 6) && (y % 8 === 1 || y % 8 === 6)) k *= 1.35;
        else if (n > 0.9) c = [140, 78, 40]; // óxido
      } else if (surf === 'metal') {
        // Chapa ondulada.
        k *= side ? (x % 4 < 2 ? 1.1 : 0.88) : y % 4 < 2 ? 1.1 : 0.88;
        if ((side ? y : x) === 0) c = dark;
      } else if (surf === 'hormigon') {
        // Bloques con juntas y poros.
        if (y % 8 === 0 || (x + (y >> 3) * 4) % 16 === 0) k *= 0.75;
        if (n > 0.96) k *= 0.7;
      } else {
        if (n > 0.9) k *= 0.85;
      }
      put(x, y, c, k);
    }
  }
  return cv;
}
