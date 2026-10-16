import { GameMap, Prop, Terrain, isWater, RADIATION_THRESHOLD } from '../sim/map';
import { ValueNoise } from '../sim/noise';
import { Rng } from '../sim/rng';

export const TILE = 16;

type RGB = [number, number, number];

const GROUND: Record<Terrain, RGB> = {
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
export function paintGround(map: GameMap, img: ImageData): void {
  const w = map.width * TILE;
  const px = img.data;
  const rng = new Rng(map.seed ^ 0x9e3779b9);
  const warp = new ValueNoise(rng);
  const grain = new ValueNoise(rng);

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

  for (let py = 0; py < map.height * TILE; py++) {
    for (let pxl = 0; pxl < w; pxl++) {
      const fx = (pxl + 0.5) / TILE;
      const fy = (py + 0.5) / TILE;
      const { t, hx, hy } = groundAt(pxl, py);
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
        c = shadeRelief(map, c, pxl, py, g);
        // Grano del suelo.
        const shade = (g - 0.5) * 18 + (rng.next() < 0.04 ? -14 : 0);
        c = [c[0] + shade, c[1] + shade, c[2] + shade];
      }
      const o = (py * w + pxl) * 4;
      px[o] = clamp(c[0]);
      px[o + 1] = clamp(c[1]);
      px[o + 2] = clamp(c[2]);
      px[o + 3] = 255;
    }
  }
}

const CLIFF_TOP: RGB = [150, 136, 112];
const CLIFF_FACE: RGB = [92, 80, 66];
const CLIFF_DARK: RGB = [52, 44, 38];

/**
 * Relieve: las terrazas más altas se ven más claras, los acantilados como pared de roca
 * con el borde iluminado y una sombra hacia abajo-derecha (luz desde arriba-izquierda).
 * Usa la casilla exacta del píxel para que lo que se ve coincida con lo que bloquea.
 */
function shadeRelief(map: GameMap, c: RGB, pxl: number, py: number, g: number): RGB {
  const tx = Math.floor(pxl / TILE);
  const ty = Math.floor(py / TILE);
  const lx = pxl - tx * TILE; // posición dentro de la casilla (0..15)
  const ly = py - ty * TILE;
  const w = map.width;
  const i = ty * w + tx;
  const lvl = map.level[i];
  const levelAt = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= map.height ? lvl : map.level[y * w + x]);
  const isLower = (x: number, y: number) => {
    const l = levelAt(x, y);
    return l > 0 && l < lvl;
  };

  // Altura general: cada nivel más claro y algo más seco que el de abajo.
  const k = 1 + (lvl - 2) * 0.1;
  let out: RGB = mix([c[0] * k, c[1] * k, c[2] * k], [176, 160, 130], Math.max(0, lvl - 2) * 0.06);

  if (map.cliff[i]) {
    const south = isLower(tx, ty + 1);
    const north = isLower(tx, ty - 1);
    const east = isLower(tx + 1, ty);
    const west = isLower(tx - 1, ty);
    // Vetas verticales de la roca.
    const streak = ((pxl * 7 + Math.floor(py / 5) * 3) % 11) / 11;
    const rock = mix(CLIFF_FACE, CLIFF_DARK, streak * 0.35 + (g - 0.5) * 0.3);
    let px = out;
    if (west && lx <= 7) px = mix(rock, CLIFF_TOP, 0.45 - lx * 0.03); // cara al oeste: iluminada
    if (east && lx >= 8) px = mix(rock, CLIFF_DARK, 0.25 + (lx - 8) * 0.04); // cara al este: en sombra
    if (north && ly <= 5) px = ly >= 4 ? CLIFF_TOP : mix(rock, CLIFF_DARK, 0.2);
    if (south) {
      // Pared vista de frente: labio claro arriba y la roca oscureciéndose hacia el pie.
      if (ly >= 4) px = mix(rock, CLIFF_DARK, (ly - 4) / 13);
      else if (ly === 3) px = CLIFF_TOP;
    }
    // Labio iluminado en el lado alto (donde la casilla linda con su misma altura).
    if (!north && ly === 0 && !south) px = mix(px, CLIFF_TOP, 0.5);
    if (!west && lx === 0 && (east || south)) px = mix(px, CLIFF_TOP, 0.3);
    return px;
  }

  // Sombra que proyecta un desnivel más alto al norte o al oeste.
  const upN = levelAt(tx, ty - 1) > lvl;
  const upW = levelAt(tx - 1, ty) > lvl;
  const upNW = levelAt(tx - 1, ty - 1) > lvl;
  let shadow = 0;
  if (upN) shadow = Math.max(shadow, 1 - ly / 6);
  if (upW) shadow = Math.max(shadow, 1 - lx / 5);
  if (upNW && !upN && !upW) shadow = Math.max(shadow, 1 - Math.max(lx, ly) / 4);
  if (shadow > 0) out = mix(out, [24, 20, 18], shadow * 0.45);

  // Pendientes: gradiente suave hacia el lado bajo y una línea de nivel.
  if (map.slope[i]) {
    if (isLower(tx, ty + 1)) out = mix(out, [40, 34, 30], (ly / 16) * 0.22);
    if (isLower(tx + 1, ty)) out = mix(out, [40, 34, 30], (lx / 16) * 0.18);
    if (isLower(tx, ty - 1) && ly === 0) out = mix(out, [200, 184, 150], 0.25);
    if (isLower(tx - 1, ty) && lx === 0) out = mix(out, [200, 184, 150], 0.2);
  }
  return out;
}

/** Pinta todos los objetos del mapa en un lienzo transparente del tamaño del mapa. */
export function paintProps(map: GameMap, ctx: CanvasRenderingContext2D): void {
  const rng = new Rng(map.seed ^ 0x2f6a1c3d);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const p = map.props[y * map.width + x] as Prop;
      if (p === Prop.None) continue;
      drawProp(ctx, p, x * TILE, y * TILE, rng);
    }
  }
}

function drawProp(ctx: CanvasRenderingContext2D, p: Prop, x: number, y: number, rng: Rng): void {
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
