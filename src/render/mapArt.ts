import { GameMap, Prop, Terrain, isWater, RADIATION_THRESHOLD, TRENCH_FLOODED } from '../sim/map';
import { ValueNoise } from '../sim/noise';
import { Rng } from '../sim/rng';
import { LIFT, renderLevel, TILE, TILE_H, TOP_MARGIN } from './projection';

export { TILE };

export type RGB = [number, number, number];

export const GROUND: Record<Terrain, RGB> = {
  [Terrain.DeepWater]: [30, 50, 66],
  [Terrain.Water]: [44, 78, 94],
  [Terrain.ShallowWater]: [74, 108, 112],
  [Terrain.Sand]: [164, 144, 106],
  [Terrain.Soil]: [116, 98, 72],
  [Terrain.Gravel]: [124, 116, 102],
  [Terrain.Rock]: [84, 80, 76],
  [Terrain.Concrete]: [88, 86, 84],
};
const MOIST: RGB = [86, 84, 54];
const IRRADIATED: RGB = [128, 138, 56];
const CONTAMINATED: RGB = [96, 104, 58];

/** Número en [0, 1) que depende solo de (a, b, c): el dibujo de un píxel no depende del orden de pintado. */
function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f) ^ c;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Valor de un campo por casilla interpolado en una posición continua (en casillas). */
function sampleField(map: GameMap, field: Float32Array, fx: number, fy: number): number {
  const x = Math.max(0, Math.min(map.width - 1.001, fx - 0.5));
  const y = Math.max(0, Math.min(map.height - 1.001, fy - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const i = y0 * map.width + x0;
  const a = field[i];
  const b = field[i + 1];
  const c = field[i + map.width];
  const d = field[i + map.width + 1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

/**
 * Pinta el suelo píxel a píxel. Los bordes entre tipos de suelo se deforman con ruido
 * y la humedad y la radiación se interpolan, para que no se vean bloques por casilla.
 */
/** Píxeles RGBA de un objeto ya dibujado, con su ancla (esquina de su casilla) en (0, ancla). */
export interface PropSprite {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Fila del sprite que corresponde al borde superior de la casilla. */
  anchorY: number;
}

/** Dibuja un objeto en un lienzo pequeño y devuelve sus píxeles; null si no hay lienzo (tests). */
export type PropRasterizer = (p: Prop, rng: Rng) => PropSprite | null;

/** Píxeles que un objeto puede sobresalir por encima de su casilla. */
export const PROP_HEADROOM = 16;

/** Rasterizador con un lienzo del navegador: los objetos pueden sobresalir hacia arriba de su casilla. */
export function canvasPropRasterizer(): PropRasterizer {
  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE + PROP_HEADROOM;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return () => null;
  return (p, rng) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawProp(ctx, p, 0, PROP_HEADROOM, rng);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { data: img.data, width: canvas.width, height: canvas.height, anchorY: PROP_HEADROOM };
  };
}

/**
 * Pinta el mapa completo (suelo, paredes y objetos) fila a fila de norte a sur, para que
 * lo que está delante y más alto tape lo de detrás.
 * Con `column` solo repinta esa columna de casillas (todo lo que se dibuja de una casilla cae
 * en su columna de píxeles): sirve para actualizar un objeto talado o picado sin repintar todo.
 * El resultado es idéntico al de pintar el mapa entero.
 */
export function paintGround(map: GameMap, img: { data: Uint8ClampedArray }, rasterizeProp?: PropRasterizer, column?: number): void {
  const w = map.width * TILE;
  const rng = new Rng(map.seed ^ 0x9e3779b9);
  const warp = new ValueNoise(rng);
  const grain = new ValueNoise(rng);
  // Manchas grandes del terreno (zonas más secas, más oscuras, más claras) y grietas.
  const patch = new ValueNoise(rng);

  const solid = (k: Terrain) => k === Terrain.Water || k === Terrain.DeepWater || k === Terrain.Rock;
  /** Tipo de suelo que se ve en un píxel, con bordes deformados por ruido. */
  const groundAt = (pxl: number, py: number) => {
    const fx = (pxl + 0.5) / TILE;
    const fy = (py + 0.5) / TILE;
    const ox = (warp.fbm(pxl / 9, py / 9, 2, 0.5) - 0.5) * 0.9;
    const oy = (warp.fbm(pxl / 9 + 50, py / 9 + 50, 2, 0.5) - 0.5) * 0.9;
    const tx = Math.max(0, Math.min(map.width - 1, Math.floor(fx + ox)));
    const ty = Math.max(0, Math.min(map.height - 1, Math.floor(fy + oy)));
    // El agua y la roca (que bloquean el paso) se deforman menos, para no engañar al jugador.
    const hx = Math.max(0, Math.min(map.width - 1, Math.floor(fx + ox * 0.55)));
    const hy = Math.max(0, Math.min(map.height - 1, Math.floor(fy + oy * 0.55)));
    const near = map.terrain[hy * map.width + hx] as Terrain;
    let t = map.terrain[ty * map.width + tx] as Terrain;
    if (solid(near) || solid(t)) t = near;
    return { t, hx, hy };
  };

  const out = img.data;
  const H = map.height * TILE_H + TOP_MARGIN;
  const put = (x: number, y: number, c: RGB) => {
    if (y < 0 || y >= H) return;
    const o = (y * w + x) * 4;
    out[o] = clamp(c[0]);
    out[o + 1] = clamp(c[1]);
    out[o + 2] = clamp(c[2]);
    out[o + 3] = 255;
  };
  // Columnas de casillas que se pintan.
  const c0 = column === undefined ? 0 : Math.max(0, Math.min(map.width - 1, column));
  const c1 = column === undefined ? map.width - 1 : c0;
  const p0 = c0 * TILE;
  const p1 = (c1 + 1) * TILE;
  // Fondo bajo el mapa (lo que asoma por el borde inferior si la última fila está elevada).
  for (let y = 0; y < H; y++) {
    for (let x = p0; x < p1; x++) {
      const o = (y * w + x) * 4;
      out[o] = 20; out[o + 1] = 18; out[o + 2] = 16; out[o + 3] = 255;
    }
  }

  /** Azar propio de cada casilla para la forma de su objeto: no cambia aunque cambien las demás. */
  const propRngAt = (tx: number, ty: number) => new Rng((map.seed ^ 0x2f6a1c3d ^ Math.imul(tx + 1, 73856093) ^ Math.imul(ty + 1, 19349663)) >>> 0);
  /** Mezcla un objeto sobre la imagen respetando su transparencia. */
  const blendProp = (sprite: PropSprite, x0: number, y0: number) => {
    const { data, width, height } = sprite;
    for (let y = 0; y < height; y++) {
      const oy = y0 + y;
      if (oy < 0 || oy >= H) continue;
      for (let x = 0; x < width; x++) {
        const si = (y * width + x) * 4;
        const a = data[si + 3] / 255;
        if (a === 0) continue;
        const o = (oy * w + x0 + x) * 4;
        out[o] = data[si] * a + out[o] * (1 - a);
        out[o + 1] = data[si + 1] * a + out[o + 1] * (1 - a);
        out[o + 2] = data[si + 2] * a + out[o + 2] * (1 - a);
      }
    }
  };

  // Se pinta fila a fila de norte a sur: lo de delante tapa a lo de detrás.
  for (let ty = 0; ty < map.height; ty++) {
    // La casilla se pinta en 16×16 y se aplasta a 16×TILE_H para inclinar el suelo.
    for (let r = 0; r < TILE_H; r++) {
      const py = ty * TILE + Math.floor(((r + 0.5) * TILE) / TILE_H);
      for (let pxl = p0; pxl < p1; pxl++) {
        const tx = Math.floor(pxl / TILE);
        put(pxl, ty * TILE_H + r + TOP_MARGIN - renderLevel(map, tx, ty) * LIFT, surfaceColor(pxl, py));
      }
    }
    // Zanjas: un foso oscuro dentro de la casilla, con sombra arriba y borde de tierra abajo.
    for (let tx = c0; tx <= c1; tx++) {
      const tr = map.trench[ty * map.width + tx];
      if (!tr) continue;
      // Foso con agua (zanja inundada): el fondo se ve de agua turbia en vez de tierra.
      const flooded = tr === TRENCH_FLOODED;
      const top = ty * TILE_H + TOP_MARGIN - renderLevel(map, tx, ty) * LIFT;
      for (let r = 1; r < TILE_H - 1; r++) {
        for (let lx = 2; lx < TILE - 2; lx++) {
          const pxl = tx * TILE + lx;
          const deep = r < 3 ? 0.85 : r > TILE_H - 4 ? 0.35 : 0.65;
          const g = grain.sample(pxl / 3, (top + r) / 3);
          if (flooded && r >= 3 && r <= TILE_H - 3) {
            put(pxl, top + r, mix([52, 92, 104], [24, 48, 58], (r < 4 ? 0.6 : 0.2) + g * 0.25));
            continue;
          }
          const base: RGB = r > TILE_H - 3 ? [120, 96, 66] : [46, 36, 26];
          put(pxl, top + r, mix(base, [20, 16, 12], deep * (0.8 + g * 0.2)));
        }
      }
    }
    // Paredes en la cara sur de las casillas más altas que su vecina de abajo.
    for (let tx = c0; tx <= c1; tx++) {
      const l = renderLevel(map, tx, ty);
      const below = ty + 1 < map.height ? renderLevel(map, tx, ty + 1) : 0;
      if (l <= below) continue;
      const i = ty * map.width + tx;
      const top = (ty + 1) * TILE_H + TOP_MARGIN - l * LIFT;
      const bottom = (ty + 1) * TILE_H + TOP_MARGIN - below * LIFT;
      const kind: WallKind = map.cliff[i] || map.terrain[i] === Terrain.Rock ? 'rock'
        : map.slope[i] ? 'slope' : 'bank';
      for (let y = top; y < bottom; y++) {
        for (let lx = 0; lx < TILE; lx++) {
          const pxl = tx * TILE + lx;
          put(pxl, y, wallColor(kind, pxl, y, (y - top) / Math.max(1, bottom - top - 1), grain.sample(pxl / 3, y / 3)));
        }
      }
    }
    // Objetos de esta fila, encima de su suelo y debajo de las filas de delante.
    if (rasterizeProp) {
      for (let tx = c0; tx <= c1; tx++) {
        const p = map.props[ty * map.width + tx] as Prop;
        if (p === Prop.None) continue;
        const sprite = rasterizeProp(p, propRngAt(tx, ty));
        if (!sprite) continue;
        // El objeto está dibujado para una casilla de 16×16: su base se apoya en el pie de la casilla.
        const tileBottomY = (ty + 1) * TILE_H + TOP_MARGIN - renderLevel(map, tx, ty) * LIFT;
        blendProp(sprite, tx * TILE, tileBottomY - TILE - sprite.anchorY);
      }
    }
  }

  /** Detalle del suelo: manchas, tierra seca agrietada, matas de hierba y piedrecitas. */
  function groundDetail(c: RGB, t: Terrain, pxl: number, py: number, m: number): RGB {
    const big = patch.fbm(pxl / 56, py / 56, 3, 0.5);
    const dry = patch.fbm(pxl / 110 + 200, py / 110 + 200, 2, 0.5);
    const lit = (big - 0.5) * 30;
    c = [c[0] + lit, c[1] + lit * 0.9, c[2] + lit * 0.7];
    const soil = t === Terrain.Soil || t === Terrain.Gravel;
    if (soil) {
      if (dry > 0.55) c = mix(c, [142, 120, 80], Math.min(0.45, (dry - 0.55) * 2.2));
      else if (dry < 0.42) c = mix(c, [84, 72, 56], Math.min(0.35, (0.42 - dry) * 2));
      // Grietas de tierra reseca.
      if (dry > 0.58 && m < 0.45 && Math.abs(patch.fbm(pxl / 7 + 90, py / 7, 2, 0.5) - 0.5) < 0.009) c = mix(c, [62, 50, 38], 0.5);
    }
    if (t === Terrain.Sand) {
      // Ondas de arena que deja el viento.
      const wave = Math.sin(py * 0.9 + patch.sample(pxl / 14, py / 14) * 9);
      if (wave > 0.82) c = mix(c, [188, 168, 128], 0.35);
      else if (wave < -0.86) c = mix(c, [130, 112, 82], 0.3);
    }
    // Matas de hierba (más donde hay humedad): cada celda de 5×4 píxeles puede tener una.
    if (soil || t === Terrain.Sand) {
      const cx = Math.floor(pxl / 5);
      const cy = Math.floor(py / 4);
      const h = hash01(cx, cy, map.seed + 7);
      const density = t === Terrain.Sand ? 0.03 : Math.max(0.02, (m - 0.25) * 0.8) * (dry > 0.6 ? 0.4 : 1);
      if (h < density) {
        const bx = cx * 5 + 1 + Math.floor(hash01(cx, cy, map.seed + 8) * 3);
        const ly = cy * 4 + 3 - py;
        const lx = pxl - bx;
        const tall = 2 + Math.floor(hash01(cx, cy, map.seed + 9) * 2);
        const blade = (lx === 0 && ly <= tall) || (Math.abs(lx) === 1 && ly <= tall - 1 - ((lx + cx) & 1));
        if (blade) {
          const green = Math.min(1, Math.max(0, (m - 0.3) * 2.5));
          const base = mix([136, 126, 72], [88, 112, 56], green);
          return mix(base, [24, 22, 14], ly === 0 ? 0.35 : ly >= tall ? -0.25 : 0);
        }
      }
      // Piedrecitas: luz arriba, sombra abajo.
      const sx = Math.floor(pxl / 4);
      const sy = Math.floor(py / 4);
      const k = hash01(sx, sy, map.seed + 11);
      if (k < (t === Terrain.Gravel ? 0.3 : 0.05)) {
        const px0 = sx * 4 + 1 + Math.floor(hash01(sx, sy, map.seed + 12) * 2);
        const py0 = sy * 4 + 1;
        if (pxl >= px0 && pxl <= px0 + 1 && py === py0) return mix(c, [182, 172, 156], 0.55);
        if (pxl >= px0 && pxl <= px0 + 1 && py === py0 + 1) return mix(c, [50, 44, 38], 0.5);
      }
    }
    return c;
  }

  function surfaceColor(pxl: number, py: number): RGB {
    const fx = (pxl + 0.5) / TILE;
    const fy = (py + 0.5) / TILE;
    const ground = groundAt(pxl, py);
    let { t } = ground;
    const { hx, hy } = ground;
    // Con el relieve elevado, un borde deformado no puede mezclar suelo de otra altura.
    const ax = Math.floor(pxl / TILE);
    const ay = Math.floor(py / TILE);
    const actual = map.terrain[ay * map.width + ax] as Terrain;
    if (isWater(actual) !== isWater(t) || renderLevel(map, hx, hy) !== renderLevel(map, ax, ay)) t = actual;
    let c: RGB = [...GROUND[t]];
    const g = grain.sample(pxl / 3, py / 3);

    if (isWater(t)) {
      if (map.contaminated[hy * map.width + hx]) c = mix(c, CONTAMINATED, 0.45);
      // Reflejos suaves.
      if ((py + Math.floor(pxl / 5)) % 7 === 0 && g > 0.6) c = mix(c, [150, 170, 170], 0.25);
    } else {
      const m = sampleField(map, map.moisture, fx, fy);
      if (t === Terrain.Soil || t === Terrain.Gravel) c = mix(c, MOIST, Math.max(0, (m - 0.45) * 0.9));
      const rad = sampleField(map, map.radiation, fx, fy);
      const radStart = RADIATION_THRESHOLD - 0.12;
      if (rad > radStart) c = mix(c, IRRADIATED, Math.min(0.4, (rad - radStart) * 1.6));
      if (t === Terrain.Concrete) {
        // Grietas en el asfalto.
        if (Math.abs(grain.fbm(pxl / 11, py / 11, 2, 0.5) - 0.5) < 0.02) c = mix(c, [50, 48, 46], 0.7);
      } else if (t === Terrain.Rock) {
        // Afloramiento en relieve: borde superior iluminado y sombra abajo.
        const h = grain.fbm(pxl / 6, py / 6, 3, 0.5);
        c = mix(c, h > 0.55 ? [120, 114, 106] : [60, 56, 54], Math.abs(h - 0.5) * 1.2);
        if (groundAt(pxl, py - 3).t !== Terrain.Rock) c = mix(c, [150, 142, 130], 0.55);
        else if (groundAt(pxl, py + 4).t !== Terrain.Rock) c = mix(c, [40, 36, 34], 0.6);
      }
      if (t !== Terrain.Rock) c = groundDetail(c, t, pxl, py, m);
      c = shadeRelief(map, c, pxl, py, g);
      // Grano del suelo.
      const shade = (g - 0.5) * 18 + (hash01(pxl, py, map.seed) < 0.04 ? -14 : 0);
      c = [c[0] + shade, c[1] + shade, c[2] + shade];
    }
    return c;
  }
}

const CLIFF_TOP: RGB = [168, 152, 124];
const ROCK_FACE: RGB = [98, 86, 72];
const ROCK_DARK: RGB = [46, 40, 36];
const BANK_FACE: RGB = [112, 90, 64];
const SLOPE_FACE: RGB = [138, 116, 84];

type WallKind = 'rock' | 'slope' | 'bank';

/** Color de la pared vista de frente bajo una casilla elevada. t = 0 arriba, 1 al pie. */
function wallColor(kind: WallKind, pxl: number, y: number, t: number, g: number): RGB {
  if (kind === 'rock') {
    // Roca con vetas verticales, más oscura hacia el pie.
    const streak = ((pxl * 7 + Math.floor(y / 4) * 3) % 11) / 11;
    let c = mix(ROCK_FACE, ROCK_DARK, streak * 0.4 + (g - 0.5) * 0.3);
    c = mix(c, ROCK_DARK, t * 0.6);
    if (t === 0) c = CLIFF_TOP;
    return c;
  }
  if (kind === 'slope') {
    // Talud de tierra transitable: claro, con rayas en diagonal que indican la rampa.
    let c = mix(SLOPE_FACE, [96, 80, 58], t * 0.45);
    if ((pxl + y) % 6 === 0) c = mix(c, [176, 156, 120], 0.35);
    return mix(c, [0, 0, 0], (g - 0.5) * 0.15);
  }
  // Orilla o pequeño escalón de tierra.
  let c = mix(BANK_FACE, [60, 48, 36], t * 0.7);
  if (t === 0) c = mix(c, [190, 170, 130], 0.5);
  return mix(c, [0, 0, 0], (g - 0.5) * 0.2);
}

/**
 * Sombreado de la superficie de una casilla: cada nivel más claro, el borde alto de los
 * acantilados en roca y sombra al pie de lo que tiene detrás (norte) o a la izquierda (oeste).
 */
function shadeRelief(map: GameMap, c: RGB, pxl: number, py: number, g: number): RGB {
  const tx = Math.floor(pxl / TILE);
  const ty = Math.floor(py / TILE);
  const lx = pxl - tx * TILE;
  const ly = py - ty * TILE;
  const i = ty * map.width + tx;
  const lvl = renderLevel(map, tx, ty);
  const levelAt = (x: number, y: number) =>
    x < 0 || y < 0 || x >= map.width || y >= map.height ? lvl : renderLevel(map, x, y);

  // Cada nivel algo más claro y seco que el de abajo.
  const k = 1 + (lvl - 2) * 0.13;
  let out: RGB = mix([c[0] * k, c[1] * k, c[2] * k], [186, 168, 134], Math.max(0, lvl - 2) * 0.1);

  if (map.cliff[i]) {
    // Borde superior del acantilado: roca desnuda.
    const h = ((pxl * 5 + py * 3) % 7) / 7;
    out = mix(out, mix(ROCK_FACE, CLIFF_TOP, 0.5 + (g - 0.5) * 0.4 + h * 0.1), 0.3);
  }
  // Caídas a los lados (no se ve la pared): línea oscura en el borde y labio claro.
  if (levelAt(tx + 1, ty) < lvl) {
    if (lx >= 14) out = mix(out, ROCK_DARK, lx === 15 ? 0.7 : 0.35);
  }
  if (levelAt(tx - 1, ty) < lvl) {
    if (lx === 0) out = mix(out, CLIFF_TOP, 0.5);
  }
  if (levelAt(tx, ty - 1) < lvl && ly === 0) out = mix(out, CLIFF_TOP, 0.45);

  // Sombra al pie de una pared que queda detrás (norte) o a la izquierda (oeste).
  let shadow = 0;
  const upN = levelAt(tx, ty - 1) - lvl;
  const upW = levelAt(tx - 1, ty) - lvl;
  if (upN > 0) shadow = Math.max(shadow, 1 - ly / (3 + upN * 2));
  if (upW > 0) shadow = Math.max(shadow, 1 - lx / (2 + upW * 2));
  if (shadow > 0) out = mix(out, [20, 16, 14], shadow * 0.5);
  return out;
}

/** Dibuja un objeto del mapa (árbol, roca…) con su base en (x, y + 16). Lo usa también la vista 3D. */
export function drawProp(ctx: CanvasRenderingContext2D, p: Prop, x: number, y: number, rng: Rng): void {
  const r = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + dx, y + dy, w, h);
  };
  const shadow = (dx: number, dy: number, w: number) => r(dx, dy, w, 2, 'rgba(0,0,0,0.28)');
  const j = rng.int(-2, 2); // pequeña variación de posición

  switch (p) {
    case Prop.DeadTree: {
      const trunk = ['#4a3a2a', '#3e3024', '#56442e'][rng.int(0, 2)];
      const tall = rng.int(0, 3);
      shadow(3 + j, 14, 10);
      r(7 + j, 3 - tall, 2, 12 + tall, trunk);
      r(8 + j, 3 - tall, 1, 12 + tall, '#2e241a');
      // Ramas secas
      r(4 + j, 5 - tall, 3, 1, trunk);
      r(3 + j, 4 - tall, 1, 1, trunk);
      r(9 + j, 7 - tall, 4, 1, trunk);
      r(12 + j, 6 - tall, 1, 1, trunk);
      r(5 + j, 9, 2, 1, trunk);
      r(6 + j, 1 - tall, 1, 2, trunk);
      if (rng.chance(0.5)) r(10 + j, 2 - tall, 1, 3, trunk);
      break;
    }
    case Prop.Stump:
      shadow(4, 12, 8);
      r(5 + j, 9, 6, 4, '#4a3a2a');
      r(5 + j, 9, 6, 1, '#7a6448');
      r(7 + j, 9, 2, 1, '#5a4a36');
      break;
    case Prop.Bush: {
      const greens = ['#5a6040', '#4e5636', '#686a44', '#6a5a3a'];
      const c = greens[rng.int(0, greens.length - 1)];
      shadow(3 + j, 13, 10);
      r(4 + j, 8, 8, 5, c);
      r(3 + j, 10, 10, 3, c);
      r(5 + j, 7, 3, 2, c);
      r(9 + j, 7, 2, 2, c);
      r(5 + j, 9, 1, 1, '#3a3e28');
      r(10 + j, 11, 1, 1, '#3a3e28');
      r(7 + j, 8, 1, 1, '#8a8a5a');
      break;
    }
    case Prop.Boulder:
      shadow(2, 13, 13);
      r(3, 5 + j / 2, 10, 8, '#6a6660');
      r(2, 7 + j / 2, 12, 6, '#6a6660');
      r(4, 5 + j / 2, 6, 2, '#8a8478');
      r(3, 7 + j / 2, 2, 2, '#8a8478');
      r(10, 9 + j / 2, 3, 4, '#4e4a46');
      r(5, 12 + j / 2, 8, 1, '#4e4a46');
      break;
    case Prop.Stones:
      r(3 + j, 10, 3, 2, '#7a746a');
      r(9, 7 + j, 2, 2, '#6a645c');
      r(11 + j, 12, 3, 2, '#827c70');
      r(3 + j, 10, 3, 1, '#9a9488');
      break;
    case Prop.ScrapPile:
      shadow(1, 13, 14);
      r(2, 9, 12, 4, '#5a4a3e');
      r(3, 7, 9, 3, '#7a5a40');
      r(5, 5, 5, 3, '#8a6a4a');
      r(4, 8, 3, 1, '#a4743c');
      r(9, 6, 1, 4, '#4a4a4e');
      r(11, 10, 2, 2, '#9a8a6a');
      r(6, 4, 2, 1, '#b07a3a');
      break;
    case Prop.CarWreck: {
      const body = ['#7a4a36', '#5a6a6e', '#6e6a4a', '#7a3a32'][rng.int(0, 3)];
      shadow(0, 14, 16);
      r(0, 6, 16, 8, '#2a2420');
      r(1, 6, 14, 7, body);
      r(4, 4, 8, 3, body);
      r(5, 5, 6, 2, '#2e3a3e');
      r(1, 9, 14, 1, 'rgba(0,0,0,0.25)');
      r(2, 12, 3, 2, '#1a1614');
      r(11, 12, 3, 2, '#1a1614');
      r(6, 7, 2, 1, '#a4743c');
      r(12, 8, 2, 2, '#a4743c');
      break;
    }
    case Prop.RuinWall:
      r(0, 3, 16, 13, '#4e4a46');
      r(0, 3, 16, 3, '#7a746c');
      r(0, 6, 16, 1, '#3a3632');
      r(4, 7, 1, 4, '#3a3632');
      r(11, 7, 1, 4, '#3a3632');
      r(0, 11, 16, 1, '#3a3632');
      if (rng.chance(0.4)) r(rng.int(2, 10), 3, rng.int(2, 4), 2, 'rgba(0,0,0,0)');
      if (rng.chance(0.4)) r(rng.int(1, 12), 3, 3, 1, '#2e2a26');
      break;
    case Prop.Rubble:
      r(2 + j, 10, 4, 3, '#6a645c');
      r(8, 8 + j / 2, 5, 3, '#5a5650');
      r(5, 12, 3, 2, '#7a746a');
      r(11 + j / 2, 12, 2, 2, '#8a5a40');
      r(8, 8 + j / 2, 5, 1, '#7a746a');
      break;
    case Prop.ToxicBarrel:
      shadow(3, 14, 10);
      r(4, 4, 8, 10, '#6e6a20');
      r(4, 4, 8, 1, '#8a8630');
      r(4, 7, 8, 1, '#4a4614');
      r(4, 11, 8, 1, '#4a4614');
      r(7, 8, 2, 2, '#1a1a10');
      r(11, 5, 1, 8, '#4a4614');
      r(3, 14, 3, 1, '#9ac43c');
      break;
    case Prop.GlowPuddle:
      r(3 + j, 8, 10, 5, '#6a8a2a');
      r(2 + j, 9, 12, 3, '#6a8a2a');
      r(5 + j, 9, 5, 2, '#a4d43c');
      r(6 + j, 9, 2, 1, '#d4f46c');
      break;
    case Prop.Spring:
      r(2, 5, 12, 9, '#7a7468');
      r(3, 6, 10, 7, '#3a7a8a');
      r(4, 7, 8, 5, '#4a9aaa');
      r(6, 8, 3, 1, '#9adae4');
      r(9, 10, 2, 1, '#9adae4');
      r(2, 5, 12, 1, '#9a9488');
      break;
    case Prop.Bones:
      r(4 + j, 10, 7, 1, '#d4ccb4');
      r(3 + j, 9, 2, 3, '#d4ccb4');
      r(10 + j, 9, 2, 3, '#d4ccb4');
      r(9, 5 + j / 2, 3, 3, '#c4bca4');
      r(10, 6 + j / 2, 1, 1, '#2a2420');
      break;
    case Prop.Tires:
      shadow(3, 13, 10);
      r(3 + j, 8, 9, 5, '#1e1c1a');
      r(5 + j, 9, 5, 3, '#4a4440');
      r(6 + j, 10, 3, 1, '#1e1c1a');
      r(4 + j, 6, 7, 3, '#262422');
      r(6 + j, 7, 3, 1, '#4a4440');
      break;
    default:
      break;
  }
}
