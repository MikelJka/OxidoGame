// Muebles y talleres a doble resolución (salto de calidad del 2D, pedido por Mikel el 2026-10-21).
// Cada pieza se dibuja en un lienzo del doble de tamaño y se coloca a la mitad, como las personas y
// los objetos del mapa: así caben vetas de la madera, tornillos, herramientas, frascos o brasas.
// La pieza tiene la cara de arriba (W × TH) y debajo el frente (W × F), como en buildArt.ts.
// Solo dibujo: se elige por el id del contenido y no decide nada del juego.
import type { BuildingDef } from '../data/buildings';

/** Ids que se dibujan aquí, a doble resolución. */
export const HI_RES_IDS: ReadonlySet<string> = new Set([
  'cama',
  'cama_prision',
  'cama_hospital',
  'mesa',
  'mesa_juego',
  'silla',
  'alfombra',
  'cuadro',
  'estufa',
  'armario',
  'armero',
  'nevera',
  'estanteria_madera',
  'estanteria_metal',
  'banco_trabajo',
  'cocina',
  'horno',
  'recicladora',
  'destileria',
  'mesa_boticario',
  'banco_investigacion',
]);

export function isHiResFurniture(def: BuildingDef): boolean {
  return HI_RES_IDS.has(def.id) && !def.vehicle;
}

export const OL = '#1a1410';

export type Px = (x: number, y: number, w: number, h: number, c: string) => void;

/** Aclara (f > 1) u oscurece (f < 1) un color #rrggbb. */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Azar fijo por posición (mismo dibujo siempre). */
export function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x + 11, 0x9e3779b1) ^ Math.imul(y + 7, 0x85ebca6b) ^ s;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface Kit {
  px: Px;
  W: number;
  TH: number;
  F: number;
  H: number;
  /** Pieza más ancha que alta (2×1 sin girar). */
  wide: boolean;
  /** Bloque con contorno: cara de arriba con borde claro y frente que se oscurece hacia el suelo. */
  block(x: number, y: number, w: number, topH: number, faceH: number, top: string, face: string): void;
  /** Tablones de madera con vetas, en horizontal. */
  planks(x: number, y: number, w: number, h: number, base: string, rowH: number, seed: number): void;
}

export function kit(ctx: CanvasRenderingContext2D, W: number, TH: number, F: number): Kit {
  const px: Px = (x, y, w, h, c) => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const k: Kit = {
    px,
    W,
    TH,
    F,
    H: TH + F,
    wide: W > TH * 1.25,
    block(x, y, w, topH, faceH, top, face) {
      px(x, y, w, topH + faceH, OL);
      px(x + 1, y + 1, w - 2, topH - 2, top);
      px(x + 1, y + 1, w - 2, 1, shade(top, 1.25));
      px(x + 1, y + topH - 2, w - 2, 1, shade(top, 0.82));
      for (let j = 0; j < faceH - 1; j++) {
        const t = faceH > 2 ? j / (faceH - 2) : 0;
        px(x + 1, y + topH - 1 + j, w - 2, 1, shade(face, 1.02 - 0.28 * t));
      }
      px(x + 1, y + topH - 1, w - 2, 1, shade(face, 1.15));
    },
    planks(x, y, w, h, base, rowH, seed) {
      for (let r = 0, yy = y; yy < y + h; r++, yy += rowH) {
        const hh = Math.min(rowH, y + h - yy);
        const c = shade(base, 0.92 + hash(r, 0, seed) * 0.16);
        px(x, yy, w, hh, c);
        px(x, yy + hh - 1, w, 1, shade(base, 0.7));
        // Vetas y nudos.
        for (let g = 0; g < w / 6; g++) {
          const gx = x + Math.floor(hash(r, g, seed + 1) * (w - 4));
          const gy = yy + 1 + Math.floor(hash(r, g, seed + 2) * Math.max(1, hh - 2));
          px(gx, gy, 2 + Math.floor(hash(g, r, seed) * 4), 1, shade(c, 0.86));
        }
        if (hash(r, 9, seed) < 0.5) px(x + Math.floor(hash(r, 8, seed) * (w - 3)), yy + Math.floor(hh / 2) - 1, 2, 2, shade(base, 0.6));
        // Juntas a tope en hileras alternas.
        const jx = x + Math.floor(w * (r % 2 ? 0.35 : 0.7));
        px(jx, yy, 1, hh - 1, shade(base, 0.68));
      }
    },
  };
  return k;
}

/**
 * Dibuja un mueble o taller a doble resolución. `W` = ancho, `TH` = alto de la cara de arriba y `F` =
 * alto del frente, ya multiplicados por dos.
 */
export function drawFurnitureHi(ctx: CanvasRenderingContext2D, def: BuildingDef, W: number, TH: number, F: number): void {
  ctx.clearRect(0, 0, W, TH + F);
  const k = kit(ctx, W, TH, F);
  const c = def.colors;
  switch (def.id) {
    case 'cama':
    case 'cama_prision':
      return bed(k, c, def.id === 'cama_prision');
    case 'cama_hospital':
      return hospitalBed(k, c);
    case 'mesa':
    case 'mesa_juego':
      return table(k, c, def.id === 'mesa_juego');
    case 'silla':
      return chair(k, c);
    case 'alfombra':
      return rug(k, c);
    case 'cuadro':
      return easel(k, c);
    case 'estufa':
      return stove(k, c);
    case 'armario':
      return wardrobe(k, c);
    case 'armero':
      return gunRack(k, c);
    case 'nevera':
      return fridge(k, c);
    case 'estanteria_madera':
    case 'estanteria_metal':
      return shelf(k, c, def.id === 'estanteria_metal');
    case 'banco_trabajo':
      return workbench(k, c);
    case 'cocina':
      return kitchen(k, c);
    case 'horno':
      return smelter(k, c);
    case 'recicladora':
      return recycler(k, c);
    case 'destileria':
      return still(k, c);
    case 'mesa_boticario':
      return apothecary(k, c);
    case 'banco_investigacion':
      return research(k, c);
  }
}

type Colors = BuildingDef['colors'];

/** Sombra suave bajo un mueble plano (las cosas a ras de suelo no tienen frente). */
function floorShadow(k: Kit, x: number, y: number, w: number, h: number): void {
  k.px(x + 2, y + h, w - 2, 2, 'rgba(0,0,0,0.28)');
  k.px(x + w, y + 2, 2, h, 'rgba(0,0,0,0.22)');
}

// ——— Muebles ———

/** Cama: armazón de madera con patas, cabecero, colchón, manta con pliegues y almohada mullida. */
function bed(k: Kit, c: Colors, prison: boolean): void {
  const { px, W, TH, wide } = k;
  const frame = prison ? '#6a6a6e' : c.dark;
  const blanket = prison ? '#6e6a5e' : c.face;
  floorShadow(k, 1, 1, W - 4, TH - 4);
  px(1, 1, W - 4, TH - 4, OL);
  px(2, 2, W - 6, TH - 6, frame);
  px(2, 2, W - 6, 1, shade(frame, 1.3));
  // Patas en las esquinas.
  for (const [x, y] of [[1, 1], [W - 6, 1], [1, TH - 6], [W - 6, TH - 6]]) px(x, y, 3, 3, shade(frame, 0.6));
  // Cabecero (lado corto de arriba o de la izquierda).
  if (wide) {
    px(2, 2, 4, TH - 6, shade(frame, 1.15));
    px(3, 3, 1, TH - 8, shade(frame, 1.4));
  } else {
    px(2, 2, W - 6, 4, shade(frame, 1.15));
    px(3, 3, W - 8, 1, shade(frame, 1.4));
  }
  // Colchón.
  const mx = wide ? 6 : 4;
  const my = wide ? 4 : 6;
  const mw = wide ? W - 12 : W - 10;
  const mh = wide ? TH - 10 : TH - 12;
  px(mx, my, mw, mh, prison ? '#b8b2a0' : '#e4dccb');
  // Almohada.
  const pl = wide ? { x: mx + 1, y: my + 2, w: Math.min(8, mw / 3), h: mh - 4 } : { x: mx + 2, y: my + 1, w: mw - 4, h: Math.min(6, mh / 3) };
  px(pl.x, pl.y, pl.w, pl.h, '#f4efe2');
  px(pl.x, pl.y + pl.h - 1, pl.w, 1, '#c8bfa8');
  px(pl.x + 1, pl.y + 1, Math.max(1, pl.w - 3), 1, '#ffffff');
  // Manta con el embozo doblado y pliegues.
  const bx = wide ? pl.x + pl.w + 2 : mx;
  const by = wide ? my : pl.y + pl.h + 2;
  const bw = wide ? mx + mw - bx : mw;
  const bh = wide ? mh : my + mh - by;
  px(bx, by, bw, bh, blanket);
  if (wide) {
    px(bx, by, 3, bh, shade(blanket, 1.3));
    px(bx + 3, by, 1, bh, shade(blanket, 0.75));
    for (let i = 1; i < 4; i++) px(bx + Math.floor((bw * i) / 4) + 2, by + 1, 1, bh - 2, shade(blanket, 0.85));
  } else {
    px(bx, by, bw, 3, shade(blanket, 1.3));
    px(bx, by + 3, bw, 1, shade(blanket, 0.75));
    for (let i = 1; i < 4; i++) px(bx + 1, by + Math.floor((bh * i) / 4) + 2, bw - 2, 1, shade(blanket, 0.85));
  }
  // Remiendo o cuadros en la manta.
  if (!prison) {
    const qx = bx + Math.floor(bw * 0.6);
    const qy = by + Math.floor(bh * 0.55);
    px(qx, qy, 5, 4, shade(blanket, 0.7));
    px(qx + 1, qy + 1, 3, 2, '#a8784a');
  }
  if (prison) {
    // Cadena con grillete a los pies.
    const fx = wide ? W - 9 : Math.floor(W / 2);
    const fy = wide ? Math.floor(TH / 2) : TH - 9;
    for (let i = 0; i < 4; i++) {
      const cx = wide ? fx - i * 3 : fx - 6 + i * 3;
      const cy = wide ? fy - 4 + (i % 2) : fy + (i % 2);
      px(cx, cy, 3, 2, '#9aa0a8');
      px(cx + 1, cy, 1, 1, '#d0d4d8');
    }
    px(wide ? fx - 12 : fx + 6, wide ? fy - 5 : fy - 1, 4, 4, '#5a5e64');
    px(wide ? fx - 11 : fx + 7, wide ? fy - 4 : fy, 2, 2, '#b0b4b8');
  }
}

/**
 * Cama de hospital: armazón de tubo metálico con barandillas, colchón blanco, sábana con la cruz roja,
 * almohada, la manivela para incorporarla a los pies y un gotero con su bolsa junto al cabecero.
 */
function hospitalBed(k: Kit, c: Colors): void {
  const { px, W, TH, wide } = k;
  const tube = c.dark;
  const hi = shade(tube, 1.5);
  floorShadow(k, 1, 1, W - 4, TH - 4);
  px(1, 1, W - 4, TH - 4, OL);
  px(2, 2, W - 6, TH - 6, tube);
  px(2, 2, W - 6, 1, hi);
  // Ruedas en las esquinas.
  for (const [x, y] of [[1, 1], [W - 6, 1], [1, TH - 6], [W - 6, TH - 6]]) {
    px(x, y, 3, 3, '#2a2e32');
    px(x + 1, y + 1, 1, 1, '#8a9096');
  }
  // Cabecero y piecero de tubo (los dos lados cortos).
  if (wide) {
    for (const x of [2, W - 7]) {
      px(x, 2, 3, TH - 6, shade(tube, 1.2));
      px(x + 1, 3, 1, TH - 8, hi);
    }
  } else {
    for (const y of [2, TH - 7]) {
      px(2, y, W - 6, 3, shade(tube, 1.2));
      px(3, y + 1, W - 8, 1, hi);
    }
  }
  // Colchón blanco.
  const mx = wide ? 5 : 4;
  const my = wide ? 4 : 5;
  const mw = wide ? W - 12 : W - 10;
  const mh = wide ? TH - 10 : TH - 12;
  px(mx, my, mw, mh, '#f2f4f6');
  // Barandillas a los lados largos.
  if (wide) {
    px(mx + 4, 2, mw - 8, 2, '#b8c0c8');
    px(mx + 4, TH - 6, mw - 8, 2, '#b8c0c8');
    for (let x = mx + 6; x < mx + mw - 4; x += 5) {
      px(x, 2, 1, 2, hi);
      px(x, TH - 6, 1, 2, hi);
    }
  } else {
    px(2, my + 4, 2, mh - 8, '#b8c0c8');
    px(W - 6, my + 4, 2, mh - 8, '#b8c0c8');
    for (let y = my + 6; y < my + mh - 4; y += 5) {
      px(2, y, 2, 1, hi);
      px(W - 6, y, 2, 1, hi);
    }
  }
  // Almohada.
  const pl = wide ? { x: mx + 1, y: my + 2, w: Math.min(8, mw / 3), h: mh - 4 } : { x: mx + 2, y: my + 1, w: mw - 4, h: Math.min(6, mh / 3) };
  px(pl.x, pl.y, pl.w, pl.h, '#ffffff');
  px(pl.x, pl.y + pl.h - 1, pl.w, 1, '#c8d0d8');
  // Sábana azul claro con el embozo blanco doblado y pliegues.
  const sheet = '#cfe0ea';
  const bx = wide ? pl.x + pl.w + 2 : mx;
  const by = wide ? my : pl.y + pl.h + 2;
  const bw = wide ? mx + mw - bx : mw;
  const bh = wide ? mh : my + mh - by;
  px(bx, by, bw, bh, sheet);
  if (wide) {
    px(bx, by, 3, bh, '#ffffff');
    px(bx + 3, by, 1, bh, shade(sheet, 0.8));
    for (let i = 1; i < 4; i++) px(bx + Math.floor((bw * i) / 4) + 2, by + 1, 1, bh - 2, shade(sheet, 0.9));
  } else {
    px(bx, by, bw, 3, '#ffffff');
    px(bx, by + 3, bw, 1, shade(sheet, 0.8));
    for (let i = 1; i < 4; i++) px(bx + 1, by + Math.floor((bh * i) / 4) + 2, bw - 2, 1, shade(sheet, 0.9));
  }
  // Cruz roja en la sábana.
  const cx = bx + Math.floor(bw / 2) + (wide ? 1 : 0);
  const cy = by + Math.floor(bh / 2) + (wide ? 0 : 1);
  px(cx - 1, cy - 4, 3, 9, '#c0392b');
  px(cx - 4, cy - 1, 9, 3, '#c0392b');
  px(cx, cy - 3, 1, 7, '#e05a48');
  // Manivela a los pies.
  if (wide) {
    px(W - 5, Math.floor(TH / 2) - 1, 3, 2, '#8a9096');
    px(W - 3, Math.floor(TH / 2) - 2, 1, 4, '#5a6066');
  } else {
    px(Math.floor(W / 2) - 1, TH - 5, 2, 3, '#8a9096');
    px(Math.floor(W / 2) - 2, TH - 3, 4, 1, '#5a6066');
  }
  // Gotero junto al cabecero: pie, barra, bolsa de suero y el tubo hasta la cama.
  const ix = wide ? 3 : W - 9;
  const iy = wide ? TH - 9 : 6;
  px(ix - 1, iy + 3, 5, 2, OL);
  px(ix, iy + 3, 3, 1, '#8a9096');
  px(ix + 1, iy - 1, 1, 5, '#b8c0c8');
  px(ix, iy - 4, 3, 4, OL);
  px(ix, iy - 4, 3, 3, '#e8f4f8');
  px(ix + 1, iy - 3, 1, 1, '#ffffff');
  px(ix + 2, iy - 1, 1, 1, '#c8e0e8');
  px(wide ? ix + 3 : ix - 2, wide ? iy - 1 : iy + 1, 2, 1, '#c8e0e8');
}

/** Mesa de tablones con su faldón y patas; la de juego, con tapete, cartas y fichas. */
function table(k: Kit, c: Colors, game: boolean): void {
  const { px, W, TH, F } = k;
  const legH = F - 3;
  // Patas.
  for (const x of [3, W - 8]) {
    px(x, TH, 5, legH, OL);
    px(x + 1, TH, 3, legH - 1, c.face);
    px(x + 1, TH, 1, legH - 1, shade(c.face, 1.2));
  }
  px(4, TH + legH - 1, W - 10, 2, 'rgba(0,0,0,0.25)');
  // Tablero.
  px(1, 2, W - 2, TH + 2, OL);
  k.planks(2, 3, W - 4, TH - 3, game ? '#9c7446' : c.top, 5, 31);
  px(2, TH - 1, W - 4, 3, shade(c.face, 0.9)); // canto
  px(2, TH - 1, W - 4, 1, shade(c.face, 1.15));
  if (game) {
    // Tapete con ribete, cartas y fichas.
    px(5, 5, W - 10, TH - 9, shade(c.top, 0.75));
    px(6, 6, W - 12, TH - 11, c.top);
    px(6, 6, W - 12, 1, shade(c.top, 1.2));
    const cards = [[0.2, 0.3], [0.32, 0.5], [0.62, 0.35]];
    for (const [fx, fy] of cards) {
      const x = 6 + Math.floor((W - 16) * fx);
      const y = 6 + Math.floor((TH - 14) * fy);
      px(x, y, 4, 5, OL);
      px(x, y, 3, 4, '#f0ead8');
      px(x + 1, y + 1, 1, 1, hash(x, y, 3) < 0.5 ? '#c03a3a' : '#2a2a2a');
    }
    for (let i = 0; i < 5; i++) {
      const x = 6 + Math.floor((W - 16) * (0.5 + hash(i, 1, 4) * 0.4));
      const y = 7 + Math.floor((TH - 14) * hash(i, 2, 4));
      const col = ['#c04040', '#e8e0c8', '#3a6ac0', '#e0b030', '#c04040'][i];
      px(x, y, 3, 2, shade(col, 0.6));
      px(x, y - 1, 3, 2, col);
    }
  } else {
    // Una jarra y una vela encima.
    const x = Math.floor(W * 0.62);
    const y = Math.floor(TH * 0.3);
    px(x, y, 5, 6, OL);
    px(x + 1, y + 1, 3, 4, '#8a9096');
    px(x + 1, y + 1, 1, 4, '#c0c6cc');
    px(x + 5, y + 2, 1, 2, OL);
    const vx = Math.floor(W * 0.28);
    px(vx, y + 1, 3, 4, '#e8e0c8');
    px(vx + 1, y - 1, 1, 2, '#f0b040');
  }
}

/** Silla vista desde arriba: asiento de listones, respaldo y patas. */
function chair(k: Kit, c: Colors): void {
  const { px, W, TH } = k;
  const s = Math.min(W, TH);
  const x0 = Math.floor((W - s * 0.6) / 2);
  const w = Math.floor(s * 0.6);
  const y0 = Math.floor(TH * 0.3);
  const h = Math.floor(TH * 0.55);
  floorShadow(k, x0, y0, w, h);
  px(x0, y0, w, h, OL);
  k.planks(x0 + 1, y0 + 1, w - 2, h - 2, c.top, 3, 7);
  // Respaldo.
  px(x0 - 1, y0 - 6, w + 2, 6, OL);
  px(x0, y0 - 5, w, 4, c.face);
  px(x0, y0 - 5, w, 1, shade(c.face, 1.3));
  for (let x = x0 + 3; x < x0 + w - 2; x += 4) px(x, y0 - 4, 1, 3, shade(c.face, 0.7));
  // Patas.
  for (const x of [x0, x0 + w - 2]) px(x, y0 + h, 2, 2, c.dark);
}

/** Alfombra tejida: ribete, cenefa de rombos, medallón central y flecos en los extremos. */
function rug(k: Kit, c: Colors): void {
  const { px, W, TH } = k;
  const x0 = 3;
  const y0 = 4;
  const w = W - 6;
  const h = TH - 8;
  px(x0, y0, w, h, c.dark);
  px(x0 + 1, y0 + 1, w - 2, h - 2, c.top);
  px(x0 + 3, y0 + 3, w - 6, h - 6, '#c8a050');
  px(x0 + 4, y0 + 4, w - 8, h - 8, c.face);
  // Rombos de la cenefa.
  for (let x = x0 + 6; x < x0 + w - 6; x += 5) {
    px(x, y0 + 1, 1, 1, '#e8c878');
    px(x, y0 + h - 2, 1, 1, '#e8c878');
  }
  // Medallón.
  const cx = Math.floor(W / 2);
  const cy = Math.floor(TH / 2);
  const r = Math.max(2, Math.floor(Math.min(w, h) / 4));
  for (let y = -r; y <= r; y++) {
    const half = r - Math.abs(y);
    px(cx - half, cy + y, half * 2 + 1, 1, Math.abs(y) === r || half === 0 ? '#e8c878' : y % 2 ? c.top : '#d8b060');
  }
  // Flecos.
  for (let y = y0 + 1; y < y0 + h - 1; y += 2) {
    px(x0 - 2, y, 2, 1, '#d8ccb0');
    px(x0 + w, y, 2, 1, '#d8ccb0');
  }
  // Desgaste en el centro.
  for (let i = 0; i < 6; i++) px(cx - 6 + Math.floor(hash(i, 0, 5) * 12), cy - 3 + Math.floor(hash(i, 1, 5) * 6), 1, 1, shade(c.face, 1.25));
}

/** Cuadro en un caballete: marco dorado, paisaje con cielo, montes y sol, y las tres patas. */
function easel(k: Kit, c: Colors): void {
  const { px, W, TH } = k;
  const fw = Math.floor(W * 0.62);
  const fh = Math.floor(TH * 0.62);
  const x0 = Math.floor((W - fw) / 2);
  const y0 = 1;
  // Patas del caballete.
  px(x0 + 2, y0 + fh - 2, 2, TH - fh, c.dark);
  px(x0 + fw - 4, y0 + fh - 2, 2, TH - fh, c.dark);
  px(Math.floor(W / 2) - 1, y0 + fh - 2, 2, TH - fh - 3, shade(c.dark, 0.8));
  px(x0 + 2, TH - 2, fw - 4, 1, 'rgba(0,0,0,0.25)');
  // Marco.
  px(x0, y0, fw, fh, OL);
  px(x0 + 1, y0 + 1, fw - 2, fh - 2, c.top);
  px(x0 + 1, y0 + 1, fw - 2, 1, shade(c.top, 1.3));
  px(x0 + 1, y0 + fh - 2, fw - 2, 1, c.face);
  // Lienzo: cielo, sol, montes y prado.
  const lx = x0 + 3;
  const ly = y0 + 3;
  const lw = fw - 6;
  const lh = fh - 6;
  for (let y = 0; y < lh; y++) px(lx, ly + y, lw, 1, shade('#6a9ac8', 1 + (y / lh) * 0.3));
  px(lx + lw - 6, ly + 2, 3, 3, '#f0d070');
  for (let x = 0; x < lw; x++) {
    const hgt = Math.floor(lh * 0.35 + Math.sin(x * 0.45) * 2 + Math.sin(x * 0.17) * 3);
    px(lx + x, ly + lh - hgt, 1, hgt, '#6a7a8a');
  }
  px(lx, ly + Math.floor(lh * 0.72), lw, lh - Math.floor(lh * 0.72), '#5a9a5a');
  px(lx, ly + Math.floor(lh * 0.72), lw, 1, '#7aba6a');
}

/** Estufa de hierro: placa de arriba, tubo de chapa, puerta con rejilla de brasas y patas. */
function stove(k: Kit, c: Colors): void {
  const { px, W, TH, F } = k;
  const x0 = 4;
  const w = W - 8;
  const y0 = Math.floor(TH * 0.25);
  k.block(x0, y0, w, TH - y0, F - 2, c.top, c.face);
  // Placa con aros.
  const cx = x0 + Math.floor(w * 0.38);
  const cy = y0 + Math.floor((TH - y0) / 2);
  px(cx - 4, cy - 2, 8, 4, shade(c.top, 0.7));
  px(cx - 3, cy - 1, 6, 2, shade(c.top, 0.55));
  // Tubo.
  const tx = x0 + w - 7;
  px(tx, 0, 5, cy + 2, OL);
  px(tx + 1, 0, 3, cy + 1, '#8a9096');
  px(tx + 1, 0, 1, cy + 1, '#b8bec4');
  px(tx - 1, 0, 7, 2, '#5a6066');
  // Puerta con rejilla y brasas.
  const dy = TH + 2;
  const dh = Math.max(4, F - 7);
  px(x0 + 4, dy, w - 8, dh, OL);
  px(x0 + 5, dy + 1, w - 10, dh - 2, '#3a1a10');
  for (let x = x0 + 6; x < x0 + w - 6; x += 2) px(x, dy + 1, 1, dh - 2, x % 4 ? '#e07a2a' : '#f0b040');
  px(x0 + w - 6, dy + Math.floor(dh / 2), 2, 1, '#b8bec4'); // pestillo
  // Patas.
  px(x0 + 1, TH + F - 3, 3, 3, OL);
  px(x0 + w - 4, TH + F - 3, 3, 3, OL);
}

/** Armario de dos puertas con cuarterones, cornisa y tiradores de latón. */
function wardrobe(k: Kit, c: Colors): void {
  const { px, W, TH, F } = k;
  k.block(1, 0, W - 2, TH, F, c.top, c.face);
  k.planks(2, 1, W - 4, TH - 3, c.top, 4, 13);
  px(2, TH - 2, W - 4, 1, shade(c.top, 0.7));
  // Cornisa.
  px(1, TH - 1, W - 2, 2, shade(c.face, 1.25));
  const mid = Math.floor(W / 2);
  px(mid, TH + 1, 1, F - 2, OL);
  // Cuarterones de cada puerta.
  for (const [x, w] of [[4, mid - 6], [mid + 3, W - mid - 7]]) {
    const ph = Math.max(2, Math.floor((F - 8) / 2));
    for (const y of [TH + 3, TH + 4 + ph]) {
      px(x, y, w, ph, shade(c.face, 0.8));
      px(x + 1, y + 1, w - 2, ph - 2, shade(c.face, 1.05));
    }
  }
  px(mid - 3, TH + Math.floor(F / 2) - 1, 2, 3, '#d8c27a');
  px(mid + 2, TH + Math.floor(F / 2) - 1, 2, 3, '#d8c27a');
  px(3, TH + F - 2, W - 6, 1, shade(c.face, 0.55));
}

/** Armero: tablero de pared con soportes; lo guardado se dibuja delante. */
function gunRack(k: Kit, c: Colors): void {
  const { px, W, TH, F } = k;
  k.block(1, 0, W - 2, TH, F, c.top, c.face);
  k.planks(2, 1, W - 4, TH - 3, c.top, 4, 17);
  // Ganchos para las armas.
  for (let x = 6; x < W - 4; x += 7) {
    px(x, TH + 2, 2, 3, '#9aa0a8');
    px(x, TH + F - 6, 2, 3, '#9aa0a8');
  }
  // Una franja de aviso roja y un candado.
  px(3, TH + Math.floor(F / 2), W - 6, 1, '#8a2a20');
  px(W - 9, TH + Math.floor(F / 2) - 2, 4, 4, '#c8a040');
  px(W - 8, TH + Math.floor(F / 2) - 4, 2, 2, '#9aa0a8');
}

/** Nevera: arcón esmaltado con tapa, junta de goma, rejilla del motor, tirador y piloto. */
function fridge(k: Kit, c: Colors): void {
  const { px, W, TH, F } = k;
  k.block(1, 0, W - 2, TH, F, c.top, c.face);
  px(2, 1, W - 4, 2, '#ffffff');
  px(3, Math.floor(TH / 2), W - 6, 1, shade(c.top, 0.85));
  // Junta.
  px(1, TH - 1, W - 2, 2, '#3a3e42');
  // Tirador cromado.
  const mid = Math.floor(W / 2);
  px(mid - 6, TH + 3, 12, 2, OL);
  px(mid - 5, TH + 3, 10, 1, '#e0e6ea');
  // Rejilla del motor y piloto.
  for (let y = TH + 7; y < TH + F - 3; y += 2) px(4, y, 8, 1, shade(c.face, 0.6));
  px(W - 8, TH + 3, 3, 2, '#7ad0ff');
  px(W - 8, TH + 3, 1, 1, '#d0f0ff');
  // Óxido en las esquinas (es de chatarra).
  px(2, TH + F - 4, 3, 2, '#9a6a3a');
  px(W - 6, TH + F - 3, 3, 1, '#9a6a3a');
}

/** Estantería: postes, baldas con canto y la sombra de cada una en la balda de debajo. */
function shelf(k: Kit, c: Colors, metal: boolean): void {
  const { px, W, H } = k;
  for (const x of [0, W - 3]) {
    px(x, 0, 3, H, OL);
    px(x + 1, 0, 1, H - 1, c.face);
    if (metal) for (let y = 3; y < H - 2; y += 4) px(x + 1, y, 1, 1, OL); // agujeros del poste
  }
  const step = Math.max(6, Math.floor(H / 4));
  for (let y = 1; y < H - 3; y += step) {
    px(2, y, W - 4, 4, OL);
    if (metal) {
      px(2, y, W - 4, 2, c.top);
      px(2, y, W - 4, 1, shade(c.top, 1.3));
    } else k.planks(2, y, W - 4, 2, c.top, 2, y);
    px(2, y + 2, W - 4, 1, c.face);
    px(3, y + 4, W - 6, 2, 'rgba(0,0,0,0.25)');
  }
  px(2, H - 3, W - 4, 3, c.dark);
}

// ——— Talleres ———

/** Tablero grueso con patas, cajonera, y encima un tornillo de banco, sierra, martillo y virutas. */
function workbench(k: Kit, c: Colors): void {
  const { px, W, TH, F, wide } = k;
  // Patas y travesaño.
  for (const x of [2, W - 8]) {
    px(x, TH, 6, F - 1, OL);
    px(x + 1, TH, 4, F - 2, c.face);
    px(x + 1, TH, 1, F - 2, shade(c.face, 1.25));
  }
  px(8, TH + F - 6, W - 16, 2, c.dark);
  // Cajonera.
  if (wide) {
    const dx = Math.floor(W * 0.55);
    px(dx, TH + 1, 14, F - 7, OL);
    px(dx + 1, TH + 2, 12, Math.floor((F - 9) / 2), c.face);
    px(dx + 1, TH + 3 + Math.floor((F - 9) / 2), 12, Math.floor((F - 9) / 2), c.face);
    px(dx + 5, TH + 3, 4, 1, '#c8b890');
  }
  // Tablero.
  px(0, 1, W, TH + 1, OL);
  k.planks(1, 2, W - 2, TH - 3, c.top, 5, 23);
  px(1, TH - 1, W - 2, 2, shade(c.face, 1.1));
  // Tornillo de banco.
  px(2, 3, 7, 6, OL);
  px(3, 4, 5, 4, '#5a6a7a');
  px(3, 4, 5, 1, '#8a9aaa');
  px(4, 8, 1, 4, '#9aa0a8');
  // Sierra.
  const sx = Math.floor(W * (wide ? 0.25 : 0.2));
  const sy = Math.floor(TH * (wide ? 0.25 : 0.45));
  px(sx, sy, 12, 3, '#9aa4ae');
  px(sx, sy + 2, 12, 1, OL);
  for (let x = sx; x < sx + 12; x += 2) px(x, sy + 3, 1, 1, '#9aa4ae');
  px(sx + 12, sy - 1, 4, 5, '#a0582a');
  px(sx + 13, sy, 2, 3, '#5a3018');
  // Martillo.
  const hx = Math.floor(W * (wide ? 0.62 : 0.55));
  const hy = Math.floor(TH * (wide ? 0.4 : 0.15));
  px(hx, hy, 2, 10, '#7a5634');
  px(hx - 2, hy, 6, 3, '#5c5f63');
  px(hx - 2, hy, 6, 1, '#9aa0a8');
  // Llave inglesa y clavos.
  const wx = Math.floor(W * (wide ? 0.8 : 0.3));
  const wy = Math.floor(TH * (wide ? 0.25 : 0.75));
  px(wx, wy, 8, 2, '#8a9096');
  px(wx + 7, wy - 1, 3, 4, '#8a9096');
  px(wx + 8, wy, 1, 2, c.top);
  for (let i = 0; i < 4; i++) px(Math.floor(W * 0.45) + i * 3, Math.floor(TH * 0.75) - (i % 2), 1, 2, '#c0c6cc');
  // Virutas.
  for (let i = 0; i < 8; i++) px(Math.floor(hash(i, 0, 9) * (W - 6)) + 3, Math.floor(hash(i, 1, 9) * (TH - 6)) + 3, 2, 1, '#e0c08a');
}

/** Fogón de ladrillo con dos fuegos: olla humeante, sartén, cucharón colgado y boca de leña encendida. */
function kitchen(k: Kit, c: Colors): void {
  const { px, W, TH, F, wide } = k;
  k.block(1, 1, W - 2, TH - 1, F, c.top, c.face);
  // Encimera de losas.
  for (let y = 3; y < TH - 3; y += 5) px(2, y, W - 4, 1, shade(c.top, 0.8));
  for (let x = 8; x < W - 3; x += 9) px(x, 2, 1, TH - 5, shade(c.top, 0.8));
  // Ladrillos en el frente.
  for (let r = 0, y = TH + 1; y < TH + F - 2; r++, y += 4) {
    px(2, y + 3, W - 4, 1, shade(c.face, 0.7));
    for (let x = 2 + (r % 2) * 4; x < W - 2; x += 8) px(x, y, 1, 3, shade(c.face, 0.7));
  }
  // Boca del fuego.
  const my = TH + 2;
  const mh = Math.max(5, F - 6);
  const mx = Math.floor(W / 2) - 8;
  px(mx, my, 16, mh, OL);
  px(mx + 1, my + 1, 14, mh - 2, '#2a1208');
  px(mx + 2, my + mh - 4, 12, 2, '#6a3a1e'); // leña
  for (let x = mx + 2; x < mx + 14; x += 2) px(x, my + mh - 5 - (x % 4 ? 1 : 2), 1, 2, x % 4 ? '#e07a2a' : '#f0c040');
  // Olla con caldo y vapor.
  const ox = wide ? Math.floor(W * 0.18) : Math.floor(W * 0.2);
  const oy = wide ? Math.floor(TH * 0.25) : Math.floor(TH * 0.15);
  px(ox, oy, 11, 8, OL);
  px(ox + 1, oy + 1, 9, 6, '#4a4844');
  px(ox + 2, oy + 1, 7, 3, '#b0703a');
  px(ox + 3, oy + 1, 2, 1, '#d8a060');
  px(ox - 1, oy + 3, 1, 2, OL);
  px(ox + 11, oy + 3, 1, 2, OL);
  px(ox + 3, oy - 3, 1, 2, 'rgba(230,230,230,0.6)');
  px(ox + 6, oy - 5, 1, 3, 'rgba(230,230,230,0.5)');
  // Sartén con mango.
  const sx = wide ? Math.floor(W * 0.58) : Math.floor(W * 0.25);
  const sy = wide ? Math.floor(TH * 0.3) : Math.floor(TH * 0.6);
  px(sx, sy, 9, 7, OL);
  px(sx + 1, sy + 1, 7, 5, '#3a3836');
  px(sx + 2, sy + 2, 3, 2, '#d8b060'); // huevo o tortilla
  px(sx + 9, sy + 3, 6, 2, '#5a3a22');
  // Cucharón colgado delante.
  px(W - 8, TH + 1, 1, 6, '#8a9096');
  px(W - 9, TH + 7, 3, 2, '#8a9096');
}

/** Horno de fundición de ladrillo refractario: boca al rojo, crisol, chimenea y lingotes al lado. */
function smelter(k: Kit, c: Colors): void {
  const { px, W, TH, F } = k;
  const bw = Math.floor(W * 0.72);
  k.block(1, 4, bw, TH - 4, F, c.top, c.face);
  // Losas de la cara de arriba.
  for (let r = 0, y = 9; y < TH - 3; r++, y += 6) {
    px(2, y, bw - 2, 1, shade(c.top, 0.8));
    for (let x = 6 + (r % 2) * 6; x < bw - 1; x += 12) px(x, y - 5, 1, 5, shade(c.top, 0.8));
  }
  // Ladrillos refractarios.
  for (let r = 0, y = TH + 1; y < TH + F - 2; r++, y += 4) {
    px(2, y + 3, bw - 2, 1, shade(c.face, 0.7));
    for (let x = 2 + (r % 2) * 5; x < bw; x += 10) px(x, y, 1, 3, shade(c.face, 0.7));
  }
  // Boca arqueada con el fuego.
  const mw = Math.floor(bw * 0.5);
  const mx = 1 + Math.floor((bw - mw) / 2);
  const my = TH + 3;
  const mh = Math.max(6, F - 7);
  px(mx, my + 2, mw, mh - 2, OL);
  px(mx + 2, my, mw - 4, 2, OL);
  px(mx + 1, my + 3, mw - 2, mh - 4, '#5a1a08');
  px(mx + 3, my + 1, mw - 6, 2, '#5a1a08');
  for (let y = 0; y < mh - 5; y++) px(mx + 2, my + 3 + y, mw - 4, 1, shade('#f0a030', 1 - y * 0.06));
  px(mx + 4, my + mh - 4, mw - 8, 2, '#fff0a0');
  // Resplandor sobre los ladrillos.
  px(mx - 2, my + mh - 2, mw + 4, 1, 'rgba(255,160,60,0.35)');
  // Crisol arriba con metal fundido.
  const cx = 1 + Math.floor(bw * 0.3);
  const cy = 6 + Math.floor((TH - 10) * 0.3);
  px(cx, cy, 10, 8, OL);
  px(cx + 1, cy + 1, 8, 6, '#5c5a56');
  px(cx + 2, cy + 1, 6, 3, '#ffb040');
  px(cx + 3, cy + 1, 3, 1, '#fff0a0');
  // Chimenea con humo.
  const hx = bw - 9;
  px(hx, 0, 8, TH - 2, OL);
  px(hx + 1, 0, 6, TH - 3, shade(c.top, 0.8));
  for (let y = 2; y < TH - 3; y += 4) px(hx + 1, y, 6, 1, shade(c.top, 0.6));
  px(hx + 2, 0, 4, 2, '#2a2420');
  // Lingotes apilados al lado y un pico de fundidor.
  const lx = bw + 3;
  const ly = Math.floor(TH * 0.55);
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 3 - r; i++) {
      const x = lx + i * 6 + r * 3;
      const y = ly + 8 - r * 4;
      if (x + 6 > W) continue;
      px(x, y, 6, 4, OL);
      px(x + 1, y + 1, 4, 2, '#9aa4ae');
      px(x + 1, y + 1, 4, 1, '#d0d6dc');
    }
  }
  px(lx + 2, ly - 6, 2, 10, '#7a5634');
  px(lx, ly - 7, 7, 2, '#5c5f63');
  // Montón de chatarra por fundir delante.
  for (let i = 0; i < 6; i++) px(lx + Math.floor(hash(i, 2, 4) * Math.max(1, W - lx - 4)), TH + 2 + Math.floor(hash(i, 3, 4) * 6), 3, 2, i % 2 ? '#c27a3e' : '#8a9096');
}

/** Recicladora: tolva llena de chatarra, cinta con rodillos, engranajes y franjas de aviso. */
function recycler(k: Kit, c: Colors): void {
  const { px, W, TH, F } = k;
  k.block(1, 2, W - 2, TH - 2, F, c.top, c.face);
  // Tolva.
  const tx = 5;
  const tw = Math.floor(W * 0.55);
  const ty = 4;
  const th = TH - 9;
  px(tx, ty, tw, th, OL);
  px(tx + 1, ty + 1, tw - 2, th - 2, '#2a2420');
  for (let i = 0; i < 18; i++) {
    const x = tx + 2 + Math.floor(hash(i, 0, 21) * (tw - 7));
    const y = ty + 2 + Math.floor(hash(i, 1, 21) * (th - 5));
    const col = ['#c27a3e', '#8a9096', '#6a7078', '#a85a2a', '#b0b6bc'][i % 5];
    px(x, y, 3 + (i % 3), 2 + (i % 2), col);
  }
  px(tx, ty, tw, 1, shade(c.top, 1.3));
  // Engranajes.
  const gx = tx + tw + 6;
  const gy = ty + Math.floor(th / 2);
  const r = Math.max(3, Math.min(6, Math.floor((W - gx - 3) / 2)));
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    px(gx + Math.round(Math.cos(ang) * (r + 1)) - 1, gy + Math.round(Math.sin(ang) * (r + 1)) - 1, 2, 2, '#5c5f63');
  }
  px(gx - r + 1, gy - r + 1, r * 2 - 1, r * 2 - 1, '#7a8088');
  px(gx - 1, gy - 1, 3, 3, OL);
  // Cinta con rodillos en el frente.
  const by = TH + F - 9;
  px(2, by, W - 4, 5, OL);
  px(3, by + 1, W - 6, 3, '#3a3a3e');
  for (let x = 4; x < W - 4; x += 4) px(x, by + 1, 2, 3, '#6a6e74');
  for (let i = 0; i < 4; i++) px(6 + i * Math.floor((W - 16) / 4), by - 2, 4, 2, i % 2 ? '#8a9096' : '#c27a3e');
  // Franjas de aviso.
  for (let x = 2; x < W - 2; x += 6) {
    px(x, TH + 1, 3, 3, '#e0b030');
    px(x + 3, TH + 1, 3, 3, OL);
  }
  // Piloto verde.
  px(W - 7, TH + 5, 3, 2, '#7fe07a');
}

/** Destilería: alambique de cobre con cúpula, serpentín, fuego debajo, bidón y bidones llenos. */
function still(k: Kit, c: Colors): void {
  const { px, W, TH, F, H } = k;
  // Base de piedra con el fuego.
  const bx = 3;
  const bw = Math.floor(W * 0.5);
  px(bx, TH + F - 10, bw, 10, OL);
  px(bx + 1, TH + F - 9, bw - 2, 8, '#6a6460');
  px(bx + 4, TH + F - 7, bw - 8, 5, '#2a1208');
  for (let x = bx + 5; x < bx + bw - 5; x += 2) px(x, TH + F - 5 - (x % 4 ? 0 : 1), 1, 2, x % 4 ? '#e07a2a' : '#f0c040');
  // Caldera de cobre redonda.
  const cx = bx + Math.floor(bw / 2);
  const r = Math.max(6, Math.floor(Math.min(bw, H * 0.6) / 2));
  // Asentada sobre la base del fuego.
  const cy = TH + F - 10 - r + 3;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    px(cx - half - 1, cy + y, half * 2 + 3, 1, OL);
  }
  for (let y = -r + 1; y < r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y)) - 1;
    const t = (y + r) / (2 * r);
    px(cx - half, cy + y, half * 2 + 1, 1, shade(c.top, 1.15 - t * 0.45));
  }
  px(cx - Math.floor(r / 2), cy - Math.floor(r / 2), 2, Math.floor(r / 2), '#f0c090'); // brillo
  for (let a = 0; a < 6; a++) px(cx - r + 2 + a * Math.floor((2 * r - 4) / 5), cy + 1, 1, 1, shade(c.top, 0.6)); // remaches
  // Cuello y tubo hasta el serpentín.
  px(cx - 1, cy - r - 4, 3, 5, OL);
  px(cx, cy - r - 4, 1, 4, c.top);
  const sx = Math.floor(W * 0.68);
  px(cx, cy - r - 5, sx - cx + 1, 2, OL);
  px(cx + 1, cy - r - 5, sx - cx - 1, 1, '#d8904a');
  // Serpentín dentro de un cubo de agua.
  const qx = sx - 4;
  const qy = cy - r - 2;
  const qw = Math.min(14, W - qx - 2);
  const qh = TH + F - qy - 3;
  px(qx, qy, qw, qh, OL);
  px(qx + 1, qy + 1, qw - 2, qh - 2, '#5a7a8a');
  for (let y = qy + 2; y < qy + qh - 2; y += 3) px(qx + 2, y, qw - 4, 1, '#d8904a');
  for (let y = qy + 3; y < qy + qh - 2; y += 6) px(qx + 2, y, 1, 3, '#d8904a');
  // Grifo y bidón de combustible delante.
  const dx = qx + 2;
  const dy = TH + F - 10;
  px(dx - 1, qy + qh - 1, 2, 3, '#8a9096');
  px(dx - 2, dy, 9, 10, OL);
  px(dx - 1, dy + 1, 7, 8, '#a03a2a');
  px(dx - 1, dy + 3, 7, 1, '#d0c050');
  px(dx - 1, dy + 6, 7, 1, shade('#a03a2a', 0.7));
}

/** Mesa de boticario: mortero con su mano, frascos de colores, balanza, hierbas secas y un libro. */
function apothecary(k: Kit, c: Colors): void {
  const { px, W, TH, F, wide } = k;
  for (const x of [2, W - 7]) {
    px(x, TH, 5, F - 1, OL);
    px(x + 1, TH, 3, F - 2, c.face);
  }
  px(7, TH + F - 6, W - 14, 2, c.dark);
  // Manojos de hierbas colgando del canto.
  for (let i = 0; i < 3; i++) {
    const x = 10 + i * Math.floor((W - 20) / 3);
    px(x + 1, TH + 1, 1, 2, '#c8b890');
    px(x, TH + 3, 4, 5, '#4a7a3a');
    px(x + 1, TH + 3, 2, 4, '#6a9a4a');
  }
  px(0, 1, W, TH + 1, OL);
  k.planks(1, 2, W - 2, TH - 3, c.top, 5, 41);
  px(1, TH - 1, W - 2, 2, shade(c.face, 1.1));
  // Mortero de piedra.
  const mx = Math.floor(W * 0.08) + 2;
  const my = Math.floor(TH * 0.3);
  px(mx, my, 10, 8, OL);
  px(mx + 1, my + 1, 8, 6, '#7a7872');
  px(mx + 2, my + 1, 6, 3, '#4a7a3a');
  px(mx + 7, my - 4, 2, 7, '#7a5634');
  // Frascos.
  const cols = ['#6aa0c0', '#c04040', '#7ac07a', '#d8a040', '#a070c0'];
  const fx0 = Math.floor(W * (wide ? 0.38 : 0.55));
  for (let i = 0; i < 5; i++) {
    const x = fx0 + (wide ? i * 5 : (i % 3) * 5);
    const y = Math.floor(TH * (wide ? 0.2 : 0.15)) + (wide ? (i % 2) * 3 : Math.floor(i / 3) * 9);
    if (x + 4 > W - 2) continue;
    px(x, y, 4, 7, OL);
    px(x + 1, y + 2, 2, 4, cols[i]);
    px(x + 1, y + 2, 1, 2, shade(cols[i], 1.4));
    px(x + 1, y, 2, 1, '#a07a4a'); // tapón
  }
  // Balanza.
  const bx = Math.floor(W * (wide ? 0.72 : 0.2));
  const by = Math.floor(TH * (wide ? 0.25 : 0.7));
  px(bx + 4, by, 1, 7, '#c8a040');
  px(bx, by, 9, 1, '#c8a040');
  px(bx - 1, by + 2, 3, 1, '#c8a040');
  px(bx + 7, by + 2, 3, 1, '#c8a040');
  px(bx + 2, by + 7, 5, 1, '#8a6a30');
  // Libro abierto.
  const lx = Math.floor(W * (wide ? 0.4 : 0.15));
  const ly = Math.floor(TH * (wide ? 0.62 : 0.85)) - 4;
  if (ly + 6 < TH) {
    px(lx, ly, 12, 6, OL);
    px(lx + 1, ly + 1, 5, 4, '#e8e0c8');
    px(lx + 6, ly + 1, 5, 4, '#ddd4b8');
    for (let y = ly + 2; y < ly + 5; y += 1) px(lx + 2, y, 3, 1, y % 2 ? '#8a8070' : '#e8e0c8');
  }
}

/** Banco de investigación: microscopio, montón de libros, planos con notas, radio abierta y flexo. */
function research(k: Kit, c: Colors): void {
  const { px, W, TH, F, wide } = k;
  for (const x of [2, W - 7]) {
    px(x, TH, 5, F - 1, OL);
    px(x + 1, TH, 3, F - 2, c.face);
  }
  // Cajón con archivos.
  px(Math.floor(W / 2) - 7, TH + 1, 14, Math.max(4, F - 8), OL);
  px(Math.floor(W / 2) - 6, TH + 2, 12, Math.max(2, F - 10), c.face);
  px(Math.floor(W / 2) - 2, TH + 3, 4, 1, '#c8b890');
  px(0, 1, W, TH + 1, OL);
  px(1, 2, W - 2, TH - 3, c.top);
  px(1, 2, W - 2, 1, shade(c.top, 1.25));
  px(1, TH - 1, W - 2, 2, shade(c.face, 1.15));
  // Planos con notas.
  const px0 = Math.floor(W * (wide ? 0.32 : 0.15));
  const py0 = Math.floor(TH * (wide ? 0.2 : 0.42));
  px(px0, py0, 14, 10, '#c8d8e8');
  px(px0, py0, 14, 1, '#e8f0f8');
  for (let y = py0 + 2; y < py0 + 9; y += 2) px(px0 + 1, y, 6 + Math.floor(hash(y, 0, 2) * 6), 1, '#4a6a9a');
  px(px0 + 9, py0 + 3, 4, 4, '#c04040');
  px(px0 + 10, py0 + 4, 2, 2, '#c8d8e8');
  // Microscopio.
  const mx = 4;
  const my = Math.floor(TH * 0.15);
  px(mx, my + 8, 8, 3, OL);
  px(mx + 1, my + 8, 6, 2, '#3a3a40');
  px(mx + 3, my, 3, 9, OL);
  px(mx + 4, my + 1, 1, 7, '#6a6a74');
  px(mx + 3, my, 3, 2, '#9ab0e0');
  px(mx + 5, my + 4, 3, 1, '#b8bec4');
  // Libros apilados.
  const lx = Math.floor(W * (wide ? 0.62 : 0.6));
  const ly = Math.floor(TH * (wide ? 0.2 : 0.1));
  const books = ['#8a2a2a', '#2a4a7a', '#4a6a3a', '#7a5a2a'];
  books.forEach((col, i) => {
    px(lx + (i % 2), ly + i * 3, 10, 3, OL);
    px(lx + 1 + (i % 2), ly + i * 3, 8, 2, col);
    px(lx + 1 + (i % 2), ly + i * 3, 8, 1, shade(col, 1.3));
  });
  // Radio desmontada con su dial verde.
  const rx = W - 13;
  const ry = Math.floor(TH * (wide ? 0.55 : 0.75)) - 3;
  if (ry + 7 < TH) {
    px(rx, ry, 10, 7, OL);
    px(rx + 1, ry + 1, 8, 5, '#4a5a4a');
    px(rx + 2, ry + 2, 3, 2, '#c0e080');
    px(rx + 6, ry + 2, 2, 2, '#9aa0a8');
    px(rx + 3, ry - 3, 1, 3, '#9aa0a8'); // antena
  }
  // Flexo con su luz cálida.
  if (wide) {
    const fx = Math.floor(W * 0.88);
    px(fx, 3, 1, 8, '#5c5f63');
    px(fx - 4, 3, 5, 1, '#5c5f63');
    px(fx - 6, 3, 4, 3, '#c8a040');
    px(fx - 6, 6, 4, 2, 'rgba(255,230,150,0.45)');
  }
}
