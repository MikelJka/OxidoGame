// Terreno de la vista 3D: una textura pixel art vista desde arriba (suelo con granulado,
// guijarros, matas, vetas…) y una malla única con las caras de arriba de cada casilla y los
// taludes donde una casilla está más alta que su vecina. Sin reglas de juego.
import * as THREE from 'three';
import { GameMap, isWater, RADIATION_THRESHOLD, Terrain } from '../sim/map';
import { GROUND, RGB } from '../render/mapArt';

/** Píxeles de textura por casilla. */
export const GROUND_PX = 8;

function hash(x: number, y: number, s = 0): number {
  let h = Math.imul(x ^ 0x27d4eb2d ^ s, 0x165667b1) ^ Math.imul(y ^ 0x85ebca6b, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Ruido suave (interpolado) para deformar los bordes entre tipos de suelo. */
function smooth(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const MOIST: RGB = [78, 82, 50];
const IRRADIATED: RGB = [128, 138, 56];
const CONTAMINATED: RGB = [96, 104, 58];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/** Pinta la textura del suelo de todo el mapa (vista cenital). */
export function paintGroundTexture(map: GameMap): HTMLCanvasElement {
  const W = map.width * GROUND_PX;
  const H = map.height * GROUND_PX;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const out = img.data;
  const solid = (t: Terrain) => isWater(t) || t === Terrain.Rock;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const fx = (px + 0.5) / GROUND_PX;
      const fy = (py + 0.5) / GROUND_PX;
      // Bordes entre suelos deformados (menos donde hay agua o roca, que bloquean el paso).
      const ox = (smooth(fx * 0.9, fy * 0.9, 11) - 0.5) * 0.9;
      const oy = (smooth(fx * 0.9 + 40, fy * 0.9 + 40, 23) - 0.5) * 0.9;
      const tx = Math.floor(fx);
      const ty = Math.floor(fy);
      const wx = Math.max(0, Math.min(map.width - 1, Math.floor(fx + ox)));
      const wy = Math.max(0, Math.min(map.height - 1, Math.floor(fy + oy)));
      const i = ty * map.width + tx;
      const own = map.terrain[i] as Terrain;
      let t = map.terrain[wy * map.width + wx] as Terrain;
      // Solo se mezclan casillas del mismo nivel (si no, el borde de un talud se vería del otro color).
      if (solid(own) || solid(t) || map.level[wy * map.width + wx] !== map.level[i]) t = own;
      let c: RGB = GROUND[t];
      const lx = px % GROUND_PX;
      const ly = py % GROUND_PX;
      const n = hash(px, py, 7);
      const big = smooth(fx * 0.35, fy * 0.35, 5);
      if (isWater(t)) {
        // Agua: más oscura en el centro, reflejos sueltos.
        c = shade(c, 0.9 + big * 0.2);
        if (n > 0.985) c = mix(c, [150, 180, 190], 0.5);
        if (map.contaminated[i]) c = mix(c, CONTAMINATED, 0.45);
      } else {
        c = shade(c, 0.9 + n * 0.12 + (big - 0.5) * 0.12);
        if (t === Terrain.Soil) {
          c = mix(c, MOIST, Math.max(0, Math.min(1, map.moisture[i])) * 0.45);
          if (n > 0.97) c = [86, 102, 58]; // matita
          else if (n < 0.025) c = shade(c, 0.7); // terrón
        } else if (t === Terrain.Gravel) {
          if (n > 0.9) c = shade(c, 1.25);
          else if (n < 0.12) c = shade(c, 0.72);
        } else if (t === Terrain.Sand) {
          if ((ly + Math.floor(smooth(fx * 2, fy * 0.5, 3) * 4)) % 4 === 0) c = shade(c, 0.94);
        } else if (t === Terrain.Rock) {
          if (n < 0.06 || (lx === ((ty * 3 + tx) % GROUND_PX) && n < 0.4)) c = shade(c, 0.65);
          else if (n > 0.95) c = shade(c, 1.2);
        } else if (t === Terrain.Concrete) {
          // Losas con juntas y grietas.
          if (lx === 0 || ly === 0) c = shade(c, 0.78);
          if (n > 0.985) c = shade(c, 0.6);
        }
        if (map.radiation[i] > RADIATION_THRESHOLD) c = mix(c, IRRADIATED, 0.3);
        if (map.trench[i]) c = shade(c, 0.55);
      }
      const o = (py * W + px) * 4;
      out[o] = Math.max(0, Math.min(255, c[0]));
      out[o + 1] = Math.max(0, Math.min(255, c[1]));
      out[o + 2] = Math.max(0, Math.min(255, c[2]));
      out[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Textura de los taludes: estratos y piedras (se tiñe con el color de cada cara). */
export function paintBankTexture(): HTMLCanvasElement {
  const S = 16;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d')!;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = hash(x, y, 99);
      let v = 200 + n * 40;
      if (y % 5 === 0) v -= 45; // estrato
      if (n > 0.93) v += 30;
      if (n < 0.06) v -= 60;
      if (y === 0) v += 25; // borde de arriba más claro
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

export interface TerrainGeometry {
  tops: THREE.BufferGeometry;
  sides: THREE.BufferGeometry;
  water: THREE.BufferGeometry;
}

const ROCK_FACE: RGB = [118, 106, 92];
const BANK_FACE: RGB = [128, 100, 70];
const SAND_FACE: RGB = [150, 128, 92];

/**
 * Mallas del terreno. `topY(x, y)` da la altura de la cara de arriba de cada casilla;
 * `waterY` la de la lámina de agua.
 */
export function buildTerrainGeometry(map: GameMap, topY: (x: number, y: number) => number, waterY: number): TerrainGeometry {
  const W = map.width;
  const H = map.height;
  const tp: number[] = [];
  const tn: number[] = [];
  const tu: number[] = [];
  const sp: number[] = [];
  const sn: number[] = [];
  const su: number[] = [];
  const sc: number[] = [];
  const wp: number[] = [];
  const quad = (pos: number[], nor: number[], a: number[], b: number[], c: number[], d: number[], n: number[]) => {
    // a-b-c-d en orden antihorario visto desde fuera: dos triángulos.
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let k = 0; k < 6; k++) nor.push(...n);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const h = topY(x, y);
      const t = map.terrain[i] as Terrain;
      // Cara de arriba.
      quad(tp, tn, [x, h, y], [x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [0, 1, 0]);
      const u0 = x / W;
      const u1 = (x + 1) / W;
      const v0 = 1 - y / H;
      const v1 = 1 - (y + 1) / H;
      tu.push(u0, v0, u0, v1, u1, v1, u0, v0, u1, v1, u1, v0);
      if (isWater(t)) {
        quad(wp, [], [x, waterY, y], [x, waterY, y + 1], [x + 1, waterY, y + 1], [x + 1, waterY, y], [0, 1, 0]);
      }
      // Taludes hacia los vecinos más bajos (y en el borde del mapa, hasta abajo).
      const face: RGB = t === Terrain.Rock || map.cliff[i] ? ROCK_FACE : t === Terrain.Sand ? SAND_FACE : isWater(t) ? shade(BANK_FACE, 0.7) : BANK_FACE;
      const sides: [number, number, number[], number[], number[]][] = [
        // dx, dy, esquina 1, esquina 2, normal
        [0, -1, [x + 1, 0, y], [x, 0, y], [0, 0, -1]],
        [0, 1, [x, 0, y + 1], [x + 1, 0, y + 1], [0, 0, 1]],
        [-1, 0, [x, 0, y], [x, 0, y + 1], [-1, 0, 0]],
        [1, 0, [x + 1, 0, y + 1], [x + 1, 0, y], [1, 0, 0]],
      ];
      for (const [dx, dy, p1, p2, n] of sides) {
        const nx = x + dx;
        const ny = y + dy;
        const inside = nx >= 0 && ny >= 0 && nx < W && ny < H;
        const low = inside ? topY(nx, ny) : 0;
        if (low >= h - 1e-4) continue;
        quad(sp, sn, [p1[0], h, p1[2]], [p1[0], low, p1[2]], [p2[0], low, p2[2]], [p2[0], h, p2[2]], n);
        // Coordenadas de textura en casillas (la textura se repite).
        su.push(0, h, 0, low, 1, low, 0, h, 1, low, 1, h);
        const k = 0.85 + hash(x, y, dx * 3 + dy) * 0.15;
        for (let q = 0; q < 6; q++) sc.push((face[0] * k) / 255, (face[1] * k) / 255, (face[2] * k) / 255);
      }
    }
  }
  const tops = new THREE.BufferGeometry();
  tops.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  tops.setAttribute('normal', new THREE.Float32BufferAttribute(tn, 3));
  tops.setAttribute('uv', new THREE.Float32BufferAttribute(tu, 2));
  const sides = new THREE.BufferGeometry();
  sides.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sides.setAttribute('normal', new THREE.Float32BufferAttribute(sn, 3));
  sides.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
  sides.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const water = new THREE.BufferGeometry();
  water.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  water.computeVertexNormals();
  for (const g of [tops, sides, water]) g.computeBoundingSphere();
  return { tops, sides, water };
}
