// Electricidad a doble resolución (salto de calidad del 2D, pedido por Mikel el 2026-10-21).
// Como los muebles (furnitureArt.ts) y las defensas (defenseArt.ts): cada pieza se dibuja en un lienzo
// del doble de tamaño y se coloca a la mitad. La pieza tiene la cara de arriba (W × TH) y debajo el
// frente (W × F). Solo dibujo: se elige por el id del contenido y no decide nada del juego.
import type { BuildingDef } from '../data/buildings';
import { beam, disc, groundShadow, line, rivet, rustSpots } from './defenseArt';
import { hash, kit, Kit, OL, shade } from './furnitureArt';

/** Ids que se dibujan aquí, a doble resolución. */
export const POWER_HI_RES_IDS: ReadonlySet<string> = new Set([
  'generador_lena',
  'placa_solar',
  'molino_viento',
  'molino_agua',
  'bateria',
  'lampara',
  'radio',
]);

export function isHiResPower(def: BuildingDef): boolean {
  return POWER_HI_RES_IDS.has(def.id) && !def.vehicle;
}

type Colors = BuildingDef['colors'];

const STEEL = '#8a9198';
const COPPER = '#c27a3e';
const CONCRETE = '#8c8a84';
const WATER = '#3a6a8a';
const FOAM = '#cfe6f0';

/**
 * Dibuja un edificio de electricidad a doble resolución. `W` = ancho, `TH` = alto de la cara de
 * arriba y `F` = alto del frente, ya multiplicados por dos.
 */
export function drawPowerHi(ctx: CanvasRenderingContext2D, def: BuildingDef, W: number, TH: number, F: number): void {
  ctx.clearRect(0, 0, W, TH + F);
  const k = kit(ctx, W, TH, F);
  const c = def.colors;
  switch (def.id) {
    case 'generador_lena':
      return woodGenerator(k, c);
    case 'placa_solar':
      return solarPanel(k, c);
    case 'molino_viento':
      return windmill(k, c);
    case 'molino_agua':
      return waterMill(k, c);
    case 'bateria':
      return batteryBank(k, c);
    case 'lampara':
      return streetLamp(k, c);
    case 'radio':
      return radioSet(k, c);
  }
}

// ——— Utilidades ———

/** Losa de hormigón baja en la que se apoya la máquina. */
function pad(k: Kit, x: number, y: number, w: number, h: number): void {
  k.block(x, y, w, h, Math.max(3, Math.floor(k.F * 0.12)), CONCRETE, shade(CONCRETE, 0.7));
  for (let i = 0; i < 6; i++) {
    const cx = x + 2 + Math.floor(hash(i, 4, w) * Math.max(1, w - 6));
    const cy = y + 2 + Math.floor(hash(i, 5, h) * Math.max(1, h - 4));
    k.px(cx, cy, 2, 1, shade(CONCRETE, 0.8));
  }
}

/** Manómetro redondo con su aguja. */
function gauge(k: Kit, cx: number, cy: number, r: number): void {
  disc(k, cx, cy, r + 1, r + 1, OL);
  disc(k, cx, cy, r, r, '#e8e2cc');
  line(k, cx, cy, cx + r * 0.6, cy - r * 0.6, 1, '#c03a2a');
  k.px(cx, cy, 1, 1, OL);
}

/** Cable que sale de la máquina hacia el borde (para conectar la red). */
function cableOut(k: Kit, x0: number, y0: number, x1: number, y1: number): void {
  line(k, x0, y0, x1, y1, 2, OL);
  line(k, x0, y0 - 0.5, x1, y1 - 0.5, 1, COPPER);
}

// ——— Generador de leña (2×2) ———

/**
 * Generador de leña: caldera de hierro con la portezuela al rojo, chimenea con humo, volante de
 * inercia con su correa hasta la dinamo, manómetro y un montón de leña al lado.
 */
function woodGenerator(k: Kit, c: Colors): void {
  const { px, W, H, TH, F } = k;
  groundShadow(k, 2, H - 8, W - 4, 8);
  pad(k, 2, Math.floor(TH * 0.25), W - 4, H - Math.floor(TH * 0.25) - Math.max(3, Math.floor(F * 0.12)) - 1);
  // Caldera: un cilindro tumbado (bloque con los cantos redondeados).
  const bx = Math.floor(W * 0.1);
  const bw = Math.floor(W * 0.5);
  const by = Math.floor(TH * 0.3);
  const bh = H - by - Math.floor(TH * 0.18) - 4;
  px(bx, by + 2, bw, bh - 2, OL);
  px(bx + 2, by, bw - 4, bh, OL);
  for (let j = 0; j < bh - 2; j++) {
    const t = j / Math.max(1, bh - 3);
    const f = t < 0.3 ? 1.25 - t : 1.05 - 0.45 * (t - 0.3);
    px(bx + 1, by + 1 + j, bw - 2, 1, shade(c.top, f));
  }
  // Aros remachados.
  for (const t of [0.18, 0.82]) {
    const x = bx + Math.floor(bw * t);
    px(x, by, 2, bh, shade(c.dark, 1.3));
    for (let j = 3; j < bh - 2; j += 4) rivet(k, x, by + j, c.top);
  }
  rustSpots(k, bx + 3, by + 3, bw - 6, bh - 6, 10, 41);
  // Portezuela con el fuego.
  const dw = Math.max(8, Math.floor(bw * 0.36));
  const dh = Math.max(6, Math.floor(bh * 0.32));
  const dx = bx + Math.floor((bw - dw) / 2);
  const dy = by + bh - dh - 3;
  px(dx - 1, dy - 1, dw + 2, dh + 2, OL);
  px(dx, dy, dw, dh, '#2a1408');
  for (let i = 0; i < dw - 2; i++) {
    const fh = 1 + Math.floor(hash(i, 7, 3) * (dh - 2));
    px(dx + 1 + i, dy + dh - 1 - fh, 1, fh, i % 2 ? '#e06a1a' : '#f0a030');
  }
  px(dx + 1, dy + dh - 2, dw - 2, 1, '#ffd060');
  for (let i = 0; i < dw; i += 3) px(dx + i, dy, 1, dh, OL); // rejilla
  px(dx + dw + 1, dy + Math.floor(dh / 2), 2, 2, STEEL); // pestillo
  // Resplandor en el suelo.
  disc(k, dx + dw / 2, H - 5, dw * 0.8, 2, 'rgba(255,140,40,0.22)');
  // Chimenea con su sombrerete y humo.
  const cx = bx + Math.floor(bw * 0.3);
  const ctop = 2;
  px(cx - 1, ctop, 6, by - ctop + 2, OL);
  px(cx, ctop + 1, 4, by - ctop, '#3a3836');
  px(cx, ctop + 1, 1, by - ctop, '#5a5854');
  px(cx - 2, ctop, 8, 2, OL);
  for (let i = 0; i < 4; i++) disc(k, cx + 2 + i * 2, ctop - 1 - i, 2 + i * 0.4, 1.5, `rgba(200,200,200,${0.35 - i * 0.07})`);
  gauge(k, bx + bw - Math.floor(bw * 0.18), by + 5, 3);
  // Volante de inercia y dinamo a la derecha.
  const fx = bx + bw + Math.floor(W * 0.12);
  const fy = by + Math.floor(bh * 0.45);
  const fr = Math.max(5, Math.floor(Math.min(W * 0.13, bh * 0.4)));
  disc(k, fx, fy, fr + 1, fr + 1, OL);
  disc(k, fx, fy, fr, fr, '#4a4c50');
  disc(k, fx, fy, fr - 2, fr - 2, '#2a2c30');
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.4;
    line(k, fx, fy, fx + Math.cos(a) * (fr - 2), fy + Math.sin(a) * (fr - 2), 1, STEEL);
  }
  disc(k, fx, fy, 2, 2, STEEL);
  // Correa hasta la dinamo.
  const gx = W - Math.floor(W * 0.12);
  const gy = fy + Math.floor(fr * 0.6);
  line(k, fx, fy - fr, gx, gy - 3, 1, '#1a1a1a');
  line(k, fx, fy + fr, gx, gy + 3, 1, '#1a1a1a');
  px(gx - 5, gy - 5, 10, 10, OL);
  px(gx - 4, gy - 4, 8, 8, '#3a5a3a');
  px(gx - 4, gy - 4, 8, 1, '#5a8a5a');
  for (let j = 0; j < 3; j++) px(gx - 3, gy - 2 + j * 2, 6, 1, COPPER); // bobinado
  cableOut(k, gx + 4, gy + 3, W - 1, H - 4);
  // Leña apilada a la izquierda delante.
  const lx = 3;
  const ly = H - 12;
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 3 - r; i++) {
      const x = lx + i * 5 + r * 2;
      const y = ly + 4 - r * 4;
      disc(k, x + 2, y + 2, 3, 2.5, OL);
      disc(k, x + 2, y + 2, 2, 1.5, '#c89a5a');
      k.px(x + 2, y + 2, 1, 1, '#8a5a2a');
    }
  }
}

// ——— Placa solar (2×2) ———

/**
 * Placa solar: dos paneles inclinados en un bastidor de aluminio, con las celdas en cuadrícula,
 * reflejos del cielo, la caja de conexión y las patas atornilladas al suelo.
 */
function solarPanel(k: Kit, c: Colors): void {
  const { px, W, H, TH, F } = k;
  groundShadow(k, 2, H - Math.floor(TH * 0.45), W - 4, Math.floor(TH * 0.4));
  const frame = '#b8bec4';
  // El panel va de atrás arriba (y0) a delante abajo (y1), tapando parte del frente.
  const y0 = 2;
  const y1 = Math.max(Math.floor(TH * 0.75), H - Math.max(6, Math.floor(F * 0.5)));
  const ph = y1 - y0;
  // Patas: las de delante, bajas; las de atrás, altas (asoman por debajo del panel).
  for (const x of [Math.floor(W * 0.14), Math.floor(W * 0.5) - 1, W - Math.floor(W * 0.14) - 2]) {
    px(x - 1, y1 - 2, 4, H - y1 + 1, OL);
    px(x, y1 - 2, 2, H - y1, frame);
    px(x - 2, H - 3, 6, 2, OL); // pie atornillado
  }
  line(k, Math.floor(W * 0.14), H - 4, Math.floor(W * 0.5), y1, 1, shade(frame, 0.7)); // riostra
  line(k, W - Math.floor(W * 0.14), H - 4, Math.floor(W * 0.5), y1, 1, shade(frame, 0.7));
  // Dos paneles, uno al lado del otro.
  const gap = 2;
  const pw = Math.floor((W - 4 - gap) / 2);
  for (let p = 0; p < 2; p++) {
    const x = 2 + p * (pw + gap);
    px(x, y0, pw, ph, OL);
    px(x + 1, y0 + 1, pw - 2, ph - 2, frame);
    const ix = x + 2;
    const iw = pw - 4;
    const iy = y0 + 2;
    const ih = ph - 4;
    // Celdas: degradado del azul (más claro atrás, refleja el cielo).
    for (let j = 0; j < ih; j++) {
      const t = j / Math.max(1, ih - 1);
      px(ix, iy + j, iw, 1, shade(c.top, 1.18 - 0.35 * t));
    }
    const cols = Math.max(3, Math.round(iw / 7));
    const rows = Math.max(3, Math.round(ih / 6));
    for (let i = 1; i < cols; i++) px(ix + Math.round((i * iw) / cols), iy, 1, ih, shade(c.top, 0.55));
    for (let j = 1; j < rows; j++) px(ix, iy + Math.round((j * ih) / rows), iw, 1, shade(c.top, 0.55));
    // Hilos de plata de cada celda.
    for (let j = 0; j < rows; j++) {
      const yy = iy + Math.round(((j + 0.5) * ih) / rows);
      px(ix, yy, iw, 1, shade(c.top, 1.35));
    }
    // Reflejo diagonal.
    for (let j = 0; j < ih; j++) {
      const sx = ix + Math.floor(iw * 0.15) + Math.floor((ih - j) * 0.5);
      if (sx < ix + iw - 2) px(sx, iy + j, 2, 1, 'rgba(220,235,255,0.35)');
    }
    // Polvo y una celda rota en el de la derecha.
    if (p === 1) {
      const cx = ix + Math.floor(iw * 0.65);
      const cy = iy + Math.floor(ih * 0.6);
      line(k, cx - 3, cy - 2, cx + 2, cy + 2, 1, '#d8e0ea');
      line(k, cx + 2, cy - 2, cx - 2, cy + 1, 1, '#d8e0ea');
    }
    for (let i = 0; i < 5; i++) px(ix + Math.floor(hash(i, p, 9) * (iw - 2)), iy + ih - 1 - Math.floor(hash(i, p, 11) * 3), 2, 1, 'rgba(160,140,110,0.45)');
  }
  // Caja de conexión y cable.
  const jx = Math.floor(W * 0.5) - 3;
  const jy = y1 + 1;
  px(jx - 1, jy - 1, 8, 6, OL);
  px(jx, jy, 6, 4, '#3a3c40');
  px(jx + 1, jy + 1, 1, 1, '#7fe07a');
  cableOut(k, jx + 6, jy + 3, W - 1, H - 2);
}

// ——— Molino de viento (1×1, dos pisos) ———

/**
 * Molino de viento: torre de celosía con riostras en cruz, rueda de aspas de chapa (como los de las
 * granjas), buje rojo, veleta de cola y una zapata de hormigón con el cable que baja.
 */
function windmill(k: Kit, c: Colors): void {
  const { px, W, H, TH } = k;
  const cx = Math.floor(W / 2);
  groundShadow(k, 3, H - 6, W - 6, 6);
  // Zapata.
  const footY = H - Math.floor(TH * 0.5);
  k.block(4, footY, W - 8, Math.floor(TH * 0.35), 3, CONCRETE, shade(CONCRETE, 0.7));
  // Torre: dos patas que se juntan arriba, con riostras en X.
  const r = Math.min(Math.floor(W / 2) - 2, Math.floor(H * 0.2));
  const hubY = r + 2;
  const topY = hubY + 2;
  const legL0 = 6;
  const legR0 = W - 7;
  const legBot = footY + 3;
  const leg = shade(c.face, 1.1);
  beam(k, legL0, legBot, cx - 2, topY, 2, leg);
  beam(k, legR0, legBot, cx + 2, topY, 2, leg);
  const steps = Math.max(2, Math.floor((legBot - topY) / 10));
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const lx = (t: number) => legL0 + (cx - 2 - legL0) * t;
    const rx = (t: number) => legR0 + (cx + 2 - legR0) * t;
    const yy = (t: number) => legBot + (topY - legBot) * t;
    line(k, lx(t0), yy(t0), rx(t1), yy(t1), 1, shade(c.face, 0.8));
    line(k, rx(t0), yy(t0), lx(t1), yy(t1), 1, shade(c.face, 0.8));
    line(k, lx(t1), yy(t1), rx(t1), yy(t1), 1, shade(c.face, 0.95));
  }
  // Escalerilla y cable bajando por una pata.
  line(k, cx + 1, topY + 2, legR0 - 1, legBot, 1, OL);
  cableOut(k, legR0 - 1, legBot, W - 1, H - 2);
  // Veleta de cola (asoma por detrás, a la izquierda).
  line(k, cx, hubY, 2, hubY - 3, 1, OL);
  px(1, hubY - 8, 6, 7, OL);
  px(2, hubY - 7, 4, 5, c.top);
  px(2, hubY - 7, 4, 1, shade(c.top, 1.3));
  // Rueda de aspas.
  disc(k, cx, hubY, r + 1, r + 1, OL);
  const blades = 12;
  const inner = r * 0.3;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > r || d < inner) continue;
      // Cada aspa es un sector de chapa: la mitad que da a la luz, clara; la otra, oscura (están torcidas).
      let a = Math.atan2(y, x) / (Math.PI * 2);
      if (a < 0) a += 1;
      const f = (a * blades) % 1;
      const gapLine = f > 0.92;
      const col = gapLine ? shade(c.dark, 1.2) : f < 0.45 ? shade(c.top, 1.12 - (d / r) * 0.15) : shade(c.top, 0.8 - (d / r) * 0.1);
      px(cx + x, hubY + y, 1, 1, col);
    }
  }
  // Aro exterior e interior.
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    px(cx + Math.cos(a) * r, hubY + Math.sin(a) * r, 1, 1, shade(c.dark, 1.4));
    px(cx + Math.cos(a) * r * 0.3, hubY + Math.sin(a) * r * 0.3, 1, 1, shade(c.dark, 1.4));
  }
  rustSpots(k, cx - r + 2, hubY - r + 2, r * 2 - 4, r * 2 - 4, 6, 77);
  // Buje.
  disc(k, cx, hubY, 3, 3, OL);
  disc(k, cx, hubY, 2, 2, '#c0402e');
  px(cx - 1, hubY - 1, 1, 1, '#f08070');
}

// ——— Molino de agua (1×2, en el agua) ———

/**
 * Molino de agua: caseta de tablones sobre pilotes con la dinamo dentro y una rueda de paletas que
 * entra en el agua, con la espuma que levanta.
 */
function waterMill(k: Kit, c: Colors): void {
  const { px, W, H, TH, F, wide } = k;
  // Agua a los pies.
  const wy = H - Math.max(6, Math.floor(F * 0.45));
  for (let j = wy; j < H; j++) px(0, j, W, 1, shade(WATER, 1.05 - ((j - wy) / Math.max(1, H - wy)) * 0.3));
  // Caseta: detrás (vertical) o a la izquierda (si la vista la pone tumbada).
  const hx = wide ? 2 : 3;
  const hw = wide ? Math.floor(W * 0.5) - 3 : W - 6;
  const hy = 2;
  const roofH = Math.max(6, Math.floor(TH * (wide ? 0.4 : 0.22)));
  const hh = (wide ? wy : Math.floor(TH * 0.55) + Math.floor(F * 0.4)) - hy;
  // Pilotes.
  for (const x of [hx + 2, hx + hw - 4]) {
    px(x - 1, hy + hh - 2, 4, wy - hy - hh + 6, OL);
    px(x, hy + hh - 2, 2, wy - hy - hh + 5, shade(c.dark, 1.6));
  }
  // Tejado de chapa a dos aguas (visto desde arriba: franjas).
  px(hx - 1, hy - 1, hw + 2, roofH + 2, OL);
  for (let j = 0; j < roofH; j++) px(hx, hy + j, hw, 1, shade('#8a8f92', 1.15 - (j / roofH) * 0.35));
  for (let x = hx + 2; x < hx + hw - 1; x += 3) px(x, hy, 1, roofH, '#5a5e62');
  rustSpots(k, hx + 1, hy + 1, hw - 2, roofH - 2, 5, 23);
  // Pared de tablones con una ventana.
  const wallY = hy + roofH + 1;
  const wallH = Math.max(4, hh - roofH - 1);
  px(hx - 1, wallY - 1, hw + 2, wallH + 2, OL);
  k.planks(hx, wallY, hw, wallH, c.face, 4, 5);
  if (wallH >= 7) {
    const winX = hx + Math.floor(hw * 0.25);
    px(winX - 1, wallY + 1, 6, 5, OL);
    px(winX, wallY + 2, 4, 3, '#e0b860'); // luz de la dinamo dentro
    px(winX + 2, wallY + 2, 1, 3, OL);
  }
  // Rueda: delante (vertical) o a la derecha (tumbada).
  const r = wide ? Math.max(5, Math.min(Math.floor(W * 0.24), Math.floor(H / 2) - 2)) : Math.max(5, Math.min(Math.floor(W / 2) - 3, Math.floor((H - hy - hh) / 2) + 2));
  const wcx = wide ? Math.floor(W * 0.75) : Math.floor(W / 2);
  const wcy = Math.min(H - Math.floor(r * 0.5), wide ? wy - Math.floor(r * 0.4) : hy + hh + r - 2);
  // Eje hasta la caseta.
  if (wide) px(hx + hw, wcy - 1, wcx - hx - hw, 3, OL);
  // Aro, radios y paletas.
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2;
    px(wcx + Math.cos(a) * r - 1, wcy + Math.sin(a) * r - 1, 2, 2, OL);
    px(wcx + Math.cos(a) * (r - 1), wcy + Math.sin(a) * (r - 1), 1, 1, c.top);
  }
  const paddles = 10;
  for (let i = 0; i < paddles; i++) {
    const a = (i / paddles) * Math.PI * 2 + 0.15;
    line(k, wcx, wcy, wcx + Math.cos(a) * (r - 1), wcy + Math.sin(a) * (r - 1), 1, shade(c.face, 0.9));
    const ox = wcx + Math.cos(a) * (r + 1);
    const oy = wcy + Math.sin(a) * (r + 1);
    px(ox - 2, oy - 2, 4, 4, OL);
    px(ox - 1, oy - 1, 2, 2, shade(c.top, 1.15));
  }
  disc(k, wcx, wcy, 2, 2, OL);
  px(wcx - 1, wcy - 1, 2, 2, STEEL);
  // Lo que queda bajo el agua, más oscuro; y la espuma alrededor.
  for (let j = wy + 1; j < H; j++) for (let x = wcx - r - 2; x <= wcx + r + 2; x++) if ((x - wcx) ** 2 + (j - wcy) ** 2 <= (r + 2) ** 2) px(x, j, 1, 1, 'rgba(30,60,90,0.45)');
  for (let i = 0; i < 9; i++) {
    const fx = wcx - r - 2 + Math.floor(hash(i, 1, 31) * (r * 2 + 4));
    px(fx, wy + Math.floor(hash(i, 2, 31) * 3), 2 + Math.floor(hash(i, 3, 31) * 3), 1, FOAM);
  }
  for (let x = 1; x < W - 1; x += 5) px(x + (x % 3), wy, 3, 1, 'rgba(207,230,240,0.6)');
}

// ——— Batería (1×1) ———

/**
 * Batería: estante de acero con dos acumuladores de plomo, sus bornes rojo y negro, los puentes de
 * cobre entre ellos, el indicador de carga y una etiqueta de peligro.
 */
function batteryBank(k: Kit, c: Colors): void {
  const { px, W, H, TH } = k;
  groundShadow(k, 2, H - 5, W - 4, 5);
  // Estante.
  const sx = 2;
  const sw = W - 4;
  const sy = Math.floor(TH * 0.25);
  px(sx, sy, 2, H - sy - 1, OL);
  px(sx + sw - 2, sy, 2, H - sy - 1, OL);
  px(sx, H - 4, sw, 2, OL);
  px(sx + 1, H - 4, sw - 2, 1, STEEL);
  // Dos acumuladores.
  const bw = Math.floor((sw - 6) / 2);
  const by = sy + 2;
  const bh = H - 5 - by;
  const topH = Math.max(4, Math.floor(TH * 0.42));
  for (let i = 0; i < 2; i++) {
    const bx = sx + 3 + i * (bw + 1);
    k.block(bx, by, bw, topH, bh - topH, c.top, c.face);
    // Bornes.
    px(bx + 2, by + 1, 3, 3, OL);
    px(bx + 3, by + 1, 1, 2, '#d9534f');
    px(bx + bw - 5, by + 1, 3, 3, OL);
    px(bx + bw - 4, by + 1, 1, 2, '#e0e4e0');
    // Tapones de ventilación.
    for (let j = 0; j < 2; j++) px(bx + Math.floor(bw / 2) - 2 + j * 3, by + Math.floor(topH / 2), 2, 2, shade(c.top, 0.6));
    // Etiqueta.
    const ly = by + topH + 2;
    if (bh - topH > 8) {
      px(bx + 2, ly, bw - 4, 4, '#e0d8b0');
      px(bx + 3, ly + 1, Math.max(1, bw - 10), 1, OL);
      px(bx + bw - 5, ly + 1, 2, 2, '#e0b02a');
    }
    // Indicador de carga: tres rayas verdes.
    const iy = by + bh - 4;
    for (let j = 0; j < 3; j++) px(bx + 2 + j * 3, iy, 2, 2, j < 2 ? '#7fe07a' : '#2a4a2a');
  }
  // Puente de cobre entre los dos.
  line(k, sx + 3 + bw - 4, by + 1, sx + 3 + bw + 1 + 3, by + 1, 1, COPPER);
  cableOut(k, sx + 3 + 3, by + 2, 0, by + 6);
  cableOut(k, sx + sw - 4, by + 2, W - 1, by + 6);
}

// ——— Lámpara (1×1) ———

/**
 * Lámpara: farola de tubo con su base atornillada, brazo curvo, tulipa de chapa y la bombilla
 * encendida con un halo cálido.
 */
function streetLamp(k: Kit, c: Colors): void {
  const { px, W, H } = k;
  const cx = Math.floor(W * 0.38);
  groundShadow(k, cx - 6, H - 5, 12, 4);
  // Base.
  px(cx - 4, H - 6, 9, 4, OL);
  px(cx - 3, H - 5, 7, 2, shade(c.face, 0.8));
  rivet(k, cx - 3, H - 5, c.face);
  rivet(k, cx + 2, H - 5, c.face);
  // Poste.
  const topY = 6;
  px(cx - 1, topY, 4, H - 6 - topY, OL);
  px(cx, topY, 2, H - 6 - topY, c.face);
  px(cx, topY, 1, H - 6 - topY, shade(c.face, 1.35));
  // Brazo curvo hacia la derecha.
  const ax = Math.floor(W * 0.72);
  line(k, cx + 1, topY + 1, cx + 4, topY - 2, 2, OL);
  line(k, cx + 4, topY - 2, ax, topY - 2, 2, OL);
  line(k, cx + 1, topY + 1, cx + 4, topY - 2, 1, c.face);
  line(k, cx + 4, topY - 2, ax, topY - 2, 1, c.face);
  // Tulipa.
  const ly = topY - 1;
  px(ax - 5, ly, 11, 3, OL);
  px(ax - 4, ly, 9, 2, shade(c.face, 0.9));
  // Halo y bombilla.
  for (let i = 4; i >= 1; i--) disc(k, ax, ly + 6, i * 2.5, i * 2, `rgba(255,220,130,${0.06 + (4 - i) * 0.04})`);
  px(ax - 2, ly + 3, 5, 3, OL);
  px(ax - 1, ly + 3, 3, 2, c.top);
  px(ax, ly + 3, 1, 1, '#fff8d8');
  // Cable que sube por el poste.
  line(k, cx + 2, H - 7, W - 1, H - 3, 1, OL);
  // Mancha de luz en el suelo.
  disc(k, ax, H - 4, 7, 2, 'rgba(255,220,130,0.16)');
}

// ——— Radio de llamada (1×1) ———

/**
 * Radio de llamada: transmisor militar sobre una caja de munición, con el dial iluminado, mandos,
 * rejilla del altavoz, el micrófono colgando de su cable y una antena alta con su luz roja.
 */
function radioSet(k: Kit, c: Colors): void {
  const { px, W, H, TH } = k;
  groundShadow(k, 2, H - 5, W - 4, 5);
  // Caja de munición de apoyo.
  const crY = H - Math.max(7, Math.floor(k.F * 0.4)) - Math.floor(TH * 0.3);
  k.block(3, crY, W - 6, Math.floor(TH * 0.3), H - crY - Math.floor(TH * 0.3) - 1, '#5a6440', '#4a5434');
  px(Math.floor(W / 2) - 3, crY + Math.floor(TH * 0.3) + 2, 6, 2, shade('#5a6440', 0.6)); // asa
  // Transmisor encima.
  const rx = 4;
  const rw = W - 10;
  const ry = Math.max(8, crY - Math.floor(TH * 0.55));
  const rTop = Math.max(3, Math.floor(TH * 0.25));
  k.block(rx, ry, rw, rTop, crY - ry - rTop + 2, c.top, c.face);
  const fy = ry + rTop;
  const fh = crY - fy;
  // Dial iluminado con su aguja.
  if (fh >= 5) {
    px(rx + 2, fy + 1, Math.floor(rw * 0.45), 3, OL);
    px(rx + 3, fy + 1, Math.floor(rw * 0.45) - 2, 2, '#e0c060');
    px(rx + 3 + Math.floor(rw * 0.2), fy + 1, 1, 2, '#c03a2a');
    // Rejilla del altavoz.
    for (let j = 0; j < Math.min(3, fh - 2); j++) px(rx + Math.floor(rw * 0.6), fy + 1 + j, Math.floor(rw * 0.32), 1, j % 2 ? c.face : OL);
  }
  // Mandos arriba.
  for (let i = 0; i < 3; i++) {
    px(rx + 3 + i * 4, ry + 1, 3, 2, OL);
    px(rx + 4 + i * 4, ry + 1, 1, 1, STEEL);
  }
  px(rx + rw - 4, ry + 1, 2, 1, '#7fe07a'); // piloto
  // Micrófono colgando del lado.
  line(k, rx + rw - 1, fy + 1, rx + rw + 2, crY + 3, 1, OL);
  px(rx + rw + 1, crY + 3, 3, 5, OL);
  px(rx + rw + 2, crY + 4, 1, 3, '#3a3a3a');
  // Antena alta con su luz y un viento tensor.
  const ax = rx + rw - 2;
  px(ax, 1, 2, ry - 1, OL);
  px(ax, 1, 1, ry - 1, '#b8bec4');
  px(ax - 1, 0, 4, 2, '#e0402e');
  disc(k, ax + 1, 1, 3, 2, 'rgba(255,80,60,0.25)');
}
