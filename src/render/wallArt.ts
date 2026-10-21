// Muros que parecen una obra de verdad (pedido por Mikel el 2026-10-21): los tramos se unen con sus
// vecinos sin costuras ni contornos entre medias, la cara de arriba es continua, los extremos llevan
// un pilar, y cada material tiene su aparejo (piedras irregulares con mortero, tablones o troncos,
// planchas de chatarra remendadas, paneles de metal o bloques de hormigón). Cada tramo tiene 4
// variantes para que una muralla larga no se vea repetida. Solo dibujo.
import type { BuildingDef } from '../data/buildings';
import { Rng } from '../sim/rng';

/** Uniones de un tramo con sus vecinos en la vista: 1 este, 2 oeste, 4 norte (arriba), 8 sur. */
export const LINK_E = 1;
export const LINK_W = 2;
export const LINK_N = 4;
export const LINK_S = 8;

type Material = 'piedra' | 'tablas' | 'troncos' | 'chatarra' | 'metal' | 'hormigon';

function materialOf(id: string): Material {
  if (id.includes('empalizada')) return 'troncos';
  if (id.includes('madera')) return 'tablas';
  if (id.includes('piedra') || id.includes('muralla')) return 'piedra';
  if (id.includes('chatarra')) return 'chatarra';
  if (id.includes('hormigon')) return 'hormigon';
  return 'metal';
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const css = (c: RGB) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(',')})`;
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const OUTLINE: RGB = [26, 20, 16];
const RUST: RGB = [122, 64, 34];

/**
 * Dibuja un tramo de muro de `tile` × (`tileH` + `wallH` × pisos). `links` dice con qué vecinos se une
 * y `variant` (0–3) cambia el aparejo.
 */
export function drawWall(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, wallH: number, links: number, variant: number): void {
  const h = tileH + wallH;
  const mat = materialOf(def.id);
  const top = hex(def.colors.top);
  const face = hex(def.colors.face);
  const dark = hex(def.colors.dark);
  const rng = new Rng(0x6a11 + variant * 7919 + def.id.length * 131);
  const px = (x: number, y: number, w: number, hh: number, c: RGB) => {
    if (w <= 0 || hh <= 0) return;
    ctx.fillStyle = css(c);
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh));
  };
  const e = !!(links & LINK_E);
  const wst = !!(links & LINK_W);
  const n = !!(links & LINK_N);
  const s = !!(links & LINK_S);
  ctx.clearRect(0, 0, tile, h);

  // --- Frente (la cara que mira al sur) ---
  const fy = tileH - 1; // primera fila del frente
  const fh = h - fy;
  paintFace(px, rng, mat, face, dark, tile, fy, fh, variant);
  // Zócalo: la base, más oscura y sucia.
  px(0, h - 3, tile, 1, shade(face, 0.72));
  px(0, h - 2, tile, 1, shade(dark, 0.8));
  px(0, h - 1, tile, 1, OUTLINE);
  // Pilar en los extremos que no se unen a nada (y un contorno).
  const pillar = (x: number, side: 'l' | 'r') => {
    const pc = mat === 'tablas' || mat === 'troncos' ? shade(face, 0.85) : mixc(face, top, 0.35);
    px(x, fy, 3, fh - 1, pc);
    px(side === 'l' ? x : x + 2, fy, 1, fh - 1, side === 'l' ? mixc(pc, [255, 255, 255], 0.2) : shade(pc, 0.7));
    px(side === 'l' ? x + 3 : x - 1, fy, 1, fh - 1, shade(dark, 0.7)); // sombra del pilar sobre el muro
  };
  if (!wst) pillar(0, 'l');
  if (!e) pillar(tile - 3, 'r');
  if (!wst) px(0, fy, 1, fh, OUTLINE);
  if (!e) px(tile - 1, fy, 1, fh, OUTLINE);

  // --- Cara de arriba (el lomo del muro) ---
  paintTop(px, rng, mat, top, dark, tile, tileH, links);
  // Bordes: contorno solo donde el muro termina.
  if (!n) px(0, 0, tile, 1, OUTLINE);
  if (!wst) px(0, 0, 1, tileH, OUTLINE);
  if (!e) px(tile - 1, 0, 1, tileH, OUTLINE);
  // Albardilla: el borde de arriba sobresale un poco y da sombra al frente.
  if (!s) {
    px(wst ? 0 : 1, tileH - 2, tile - (wst ? 0 : 1) - (e ? 0 : 1), 1, mixc(top, [255, 255, 255], 0.25));
    px(wst ? 0 : 1, tileH, tile - (wst ? 0 : 1) - (e ? 0 : 1), 1, shade(face, 0.6));
  }

  // Aspilleras: dos rendijas en el frente.
  if (def.loophole !== undefined) {
    const sy = tileH + Math.max(1, Math.floor(wallH / 3));
    const sh = Math.max(2, Math.floor(wallH / 3));
    for (const sx of [Math.floor(tile / 4) + 1, Math.floor((tile * 3) / 4) - 1]) {
      px(sx - 1, sy - 1, 3, sh + 2, mixc(face, top, 0.5));
      px(sx, sy, 1, sh, OUTLINE);
    }
  }
}

function paintFace(px: (x: number, y: number, w: number, h: number, c: RGB) => void, rng: Rng, mat: Material, face: RGB, dark: RGB, tile: number, y0: number, fh: number, variant: number): void {
  const y1 = y0 + fh - 2;
  if (mat === 'piedra') {
    // Sillarejo: hileras de piedras de tamaños distintos, cada una con su tono, mortero entre ellas.
    px(0, y0, tile, fh, shade(dark, 0.9)); // mortero
    let y = y0;
    let row = 0;
    while (y < y1) {
      const rh = Math.min(y1 - y, 3 + ((row + variant) % 2));
      let x = -rng.int(0, 4);
      while (x < tile) {
        const sw = rng.int(3, 6);
        const c = shade(face, 0.85 + rng.next() * 0.3);
        px(x + 1, y + 1, sw - 1, rh - 1, c);
        px(x + 1, y + 1, sw - 1, 1, mixc(c, [255, 255, 255], 0.18)); // canto con luz
        px(x + sw - 1, y + 2, 1, rh - 2, shade(c, 0.8));
        if (rng.chance(0.08)) px(x + 2, y + rh - 1, 2, 1, [86, 104, 58]); // musgo
        x += sw;
      }
      y += rh;
      row++;
    }
  } else if (mat === 'tablas') {
    // Tablones horizontales con vetas, clavos y alguna tabla más clara (cambiada).
    let y = y0;
    let k = 0;
    while (y < y1) {
      const ph = Math.min(3, y1 - y);
      const c = shade(face, [1, 0.88, 0.95, 1.06][(k + variant) % 4] * (rng.chance(0.12) ? 1.15 : 1));
      px(0, y, tile, ph, c);
      px(0, y, tile, 1, mixc(c, [255, 255, 255], 0.12));
      px(0, y + ph - 1, tile, 1, shade(c, 0.72));
      for (let i = 0; i < 2; i++) px(rng.int(1, tile - 4), y + 1, rng.int(2, 4), 1, shade(c, 0.85)); // vetas
      if (rng.chance(0.25)) px(rng.int(2, tile - 3), y + 1, 1, 1, shade(c, 0.6)); // nudo
      y += ph;
      k++;
    }
    // Montantes cada media casilla con clavos.
    for (const x of [7]) {
      px(x, y0, 2, fh - 2, shade(face, 0.78));
      px(x, y0, 1, fh - 2, shade(face, 0.95));
      for (let yy = y0 + 1; yy < y1; yy += 3) px(x + 1, yy, 1, 1, [150, 146, 136]);
    }
  } else if (mat === 'troncos') {
    // Empalizada: troncos verticales redondeados, con corteza y punta.
    for (let x = 0; x < tile; x += 4) {
      const c = shade(face, 0.9 + ((x / 4 + variant) % 3) * 0.08);
      px(x, y0, 4, fh, shade(c, 0.6));
      px(x + 1, y0, 2, fh - 1, c);
      px(x + 1, y0, 1, fh - 1, mixc(c, [255, 255, 255], 0.15));
      for (let yy = y0 + 2 + (x % 3); yy < y1; yy += 4) px(x + 2, yy, 1, 2, shade(c, 0.75)); // corteza
    }
    // Travesaño atado.
    const ty = y0 + Math.floor(fh / 3);
    px(0, ty, tile, 2, shade(face, 0.7));
    px(0, ty, tile, 1, mixc(face, [200, 180, 140], 0.3));
  } else if (mat === 'chatarra') {
    // Planchas remendadas de colores distintos, remaches y churretes de óxido.
    const plates: RGB[] = [face, shade(face, 0.85), [104, 100, 92], [86, 96, 84], [120, 84, 52], [96, 90, 104]];
    px(0, y0, tile, fh, shade(dark, 0.9));
    let x = -rng.int(0, 3);
    while (x < tile) {
      const pw = rng.int(4, 8);
      let y = y0;
      while (y < y1) {
        const ph = Math.min(y1 - y, rng.int(4, 7));
        const c = plates[rng.int(0, plates.length - 1)];
        px(x + 1, y + 1, pw - 1, ph - 1, c);
        px(x + 1, y + 1, pw - 1, 1, mixc(c, [255, 255, 255], 0.15));
        px(x + 1, y + 1, 1, 1, [170, 164, 150]); // remache
        if (pw > 4) px(x + pw - 2, y + 1, 1, 1, [170, 164, 150]);
        if (rng.chance(0.5)) px(x + rng.int(1, pw - 2), y + 2, 1, ph - 2, mixc(c, RUST, 0.55)); // óxido
        y += ph;
      }
      x += pw;
    }
  } else if (mat === 'hormigon') {
    // Bloques grandes con juntas, manchas de humedad y, en alguno, hierros a la vista.
    px(0, y0, tile, fh, face);
    for (let y = y0 + 4; y < y1; y += 5) px(0, y, tile, 1, shade(face, 0.8));
    const off = (variant % 2) * 4;
    for (let y = y0, r = 0; y < y1; y += 5, r++) px((off + r * 8 + 4) % 8 + 4, y, 1, Math.min(4, y1 - y), shade(face, 0.8));
    for (let i = 0; i < 3; i++) px(rng.int(0, tile - 3), rng.int(y0, y1 - 3), rng.int(2, 4), rng.int(1, 3), shade(face, 0.9));
    if (variant === 3) {
      px(5, y1 - 4, 3, 3, shade(dark, 0.9));
      px(6, y1 - 4, 1, 3, RUST);
    }
  } else {
    // Metal: paneles de media casilla con nervio, juntas y tornillos.
    px(0, y0, tile, fh, face);
    for (const x of [0, 8]) {
      px(x, y0, 1, fh - 2, shade(face, 0.7));
      px(x + 1, y0, 1, fh - 2, mixc(face, [255, 255, 255], 0.15));
      for (const yy of [y0 + 1, y1 - 2]) px(x + 2, yy, 1, 1, [178, 184, 190]);
      for (const yy of [y0 + 1, y1 - 2]) px(x + 6, yy, 1, 1, [178, 184, 190]);
    }
    const ry = y0 + Math.floor(fh / 2) - 1;
    px(0, ry, tile, 1, mixc(face, [255, 255, 255], 0.2));
    px(0, ry + 1, tile, 1, shade(face, 0.65));
    if (rng.chance(0.6)) px(rng.int(2, tile - 3), ry + 2, 1, rng.int(2, 4), mixc(face, RUST, 0.5));
  }
}

function paintTop(px: (x: number, y: number, w: number, h: number, c: RGB) => void, rng: Rng, mat: Material, top: RGB, dark: RGB, tile: number, tileH: number, links: number): void {
  const ns = !!(links & (LINK_N | LINK_S)) && !(links & (LINK_E | LINK_W));
  px(0, 0, tile, tileH - 1, top);
  if (mat === 'piedra' || mat === 'hormigon') {
    // Losas de remate.
    const step = mat === 'piedra' ? 5 : 8;
    if (ns) for (let y = 3; y < tileH - 1; y += step - 1) px(1, y, tile - 2, 1, shade(top, 0.82));
    else for (let x = rng.int(2, 4); x < tile; x += step) px(x, 1, 1, tileH - 3, shade(top, 0.82));
    for (let i = 0; i < 4; i++) px(rng.int(1, tile - 2), rng.int(1, tileH - 3), 1, 1, shade(top, rng.chance(0.5) ? 0.88 : 1.08));
  } else if (mat === 'troncos') {
    // Las puntas de los troncos vistas desde arriba.
    for (let x = 0; x < tile; x += 4) {
      px(x, 1, 4, tileH - 3, shade(dark, 1.1));
      px(x + 1, 2, 2, tileH - 5, top);
      px(x + 1, 2, 1, 1, mixc(top, [255, 255, 255], 0.3));
      px(x + 2, Math.floor(tileH / 2), 1, 1, shade(top, 0.75));
    }
  } else if (mat === 'tablas') {
    // Tablas del remate en el sentido del muro.
    if (ns) for (let x = 3; x < tile; x += 4) px(x, 0, 1, tileH - 1, shade(top, 0.8));
    else for (let y = 3; y < tileH - 1; y += 3) px(0, y, tile, 1, shade(top, 0.8));
  } else {
    // Chapa o metal: plancha con tornillos y una junta.
    if (ns) px(Math.floor(tile / 2), 0, 1, tileH - 1, shade(top, 0.75));
    else px(0, Math.floor(tileH / 2), tile, 1, shade(top, 0.75));
    for (const [x, y] of [[2, 2], [tile - 3, 2], [2, tileH - 4], [tile - 3, tileH - 4]]) px(x, y, 1, 1, mixc(top, [255, 255, 255], 0.35));
    if (mat === 'chatarra') px(rng.int(2, tile - 6), rng.int(2, tileH - 5), 3, 2, mixc(top, RUST, 0.5));
  }
}

/**
 * Puertas y portones: quita el contorno del lado por el que se unen a un muro (para que no se vea
 * un cubo pegado a otro), copiando la columna de al lado.
 */
export function joinSides(ctx: CanvasRenderingContext2D, w: number, h: number, links: number): void {
  if (!(links & (LINK_E | LINK_W))) return;
  if (links & LINK_W) ctx.drawImage(ctx.canvas, 1, 0, 1, h, 0, 0, 1, h);
  if (links & LINK_E) ctx.drawImage(ctx.canvas, w - 2, 0, 1, h, w - 1, 0, 1, h);
}
