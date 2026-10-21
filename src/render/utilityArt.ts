// Pozo, depuradora, cantera, muelle y trampa de pesca a doble resolución (salto de calidad del 2D,
// pedido por Mikel el 2026-10-21). Como los muebles (furnitureArt.ts), las defensas (defenseArt.ts) y
// la electricidad (powerArt.ts): cada pieza se dibuja en un lienzo del doble de tamaño y se coloca a la
// mitad. La pieza tiene la cara de arriba (W × TH) y debajo el frente (W × F; 0 si va a ras de suelo).
// Solo dibujo: se elige por el id del contenido y no decide nada del juego.
import type { BuildingDef } from '../data/buildings';
import { beam, disc, groundShadow, line, rivet, rustSpots } from './defenseArt';
import { hash, kit, Kit, OL, shade } from './furnitureArt';

/** Ids que se dibujan aquí, a doble resolución. */
export const UTILITY_HI_RES_IDS: ReadonlySet<string> = new Set(['pozo', 'depuradora', 'cantera', 'muelle', 'trampa_pesca']);

export function isHiResUtility(def: BuildingDef): boolean {
  return UTILITY_HI_RES_IDS.has(def.id) && !def.vehicle;
}

type Colors = BuildingDef['colors'];

const STEEL = '#8a9198';
const ROPE = '#c8b48a';
const WOOD = '#8a6440';
const DEEP = '#16303e';
const STONE = '#8e8a80';

/**
 * Dibuja una de estas piezas a doble resolución. `W` = ancho, `TH` = alto de la cara de arriba y
 * `F` = alto del frente, ya multiplicados por dos.
 */
export function drawUtilityHi(ctx: CanvasRenderingContext2D, def: BuildingDef, W: number, TH: number, F: number): void {
  ctx.clearRect(0, 0, W, TH + F);
  const k = kit(ctx, W, TH, F);
  const c = def.colors;
  switch (def.id) {
    case 'pozo':
      return well(k, c);
    case 'depuradora':
      return purifier(k, c);
    case 'cantera':
      return quarry(k, c);
    case 'muelle':
      return dock(k, c);
    case 'trampa_pesca':
      return fishTrap(k, c);
  }
}

// ——— Utilidades ———

/** Cilindro de pie: cuerpo (frente) con sombreado de lado a lado y la tapa elíptica arriba. */
function cylinder(k: Kit, cx: number, topY: number, rx: number, ry: number, bodyH: number, top: string, side: string): void {
  // Contorno: tapa, cuerpo y base.
  disc(k, cx, topY + bodyH, rx + 1, ry + 1, OL);
  k.px(cx - rx - 1, topY, rx * 2 + 3, bodyH, OL);
  disc(k, cx, topY, rx + 1, ry + 1, OL);
  // Cuerpo: más claro a la izquierda (luz) y oscuro a la derecha.
  for (let x = -rx; x <= rx; x++) {
    const t = (x + rx) / Math.max(1, rx * 2);
    const f = t < 0.3 ? 1.12 - t * 0.3 : 1.03 - (t - 0.3) * 0.5;
    const half = Math.round(ry * Math.sqrt(Math.max(0, 1 - (x / (rx + 0.5)) ** 2)));
    k.px(cx + x, topY, 1, bodyH + half, shade(side, f));
  }
  disc(k, cx, topY, rx, ry, top);
  // Brillo del borde de la tapa.
  for (let x = -rx + 2; x < 0; x++) {
    const half = Math.round(ry * Math.sqrt(Math.max(0, 1 - (x / (rx + 0.5)) ** 2)));
    k.px(cx + x, topY - half, 1, 1, shade(top, 1.3));
  }
}

/** Ondas en el agua alrededor de un punto. */
function ripples(k: Kit, cx: number, cy: number, r: number, seed: number): void {
  for (let i = 0; i < 2; i++) {
    const rr = r + i * 3;
    for (let a = 0; a < 18; a++) {
      if (hash(a, i, seed) < 0.45) continue;
      const ang = (a / 18) * Math.PI * 2;
      k.px(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.45, 2, 1, i ? 'rgba(207,230,240,0.35)' : 'rgba(207,230,240,0.6)');
    }
  }
}

// ——— Pozo (1×1) ———

/**
 * Pozo: brocal redondo de mampostería con el agua al fondo y su reflejo, dos postes de madera con un
 * tejadillo, el torno con su manivela, la cuerda que baja y un cubo de chapa apoyado en el borde.
 */
function well(k: Kit, c: Colors): void {
  const { px, W, H, TH, F } = k;
  const cx = Math.floor(W / 2);
  const rx = Math.floor(W * 0.4);
  const ry = Math.max(4, Math.min(Math.floor(TH * 0.3), 9));
  const bodyH = Math.max(5, Math.floor(F * 0.45));
  const cy = H - 3 - bodyH - ry;
  groundShadow(k, 1, H - ry - 3, W - 2, ry + 2);
  // Cuerpo de piedra: un cilindro con mampostería en el frente.
  cylinder(k, cx, cy, rx, ry, bodyH, shade(STONE, 1.05), c.face);
  for (let x = -rx; x <= rx; x++) {
    const half = Math.round(ry * Math.sqrt(Math.max(0, 1 - (x / (rx + 0.5)) ** 2)));
    // Hileras de piedra solo por la parte visible del frente.
    for (let y = 0; y < bodyH + half - 1; y++) {
      const row = Math.floor(y / 4);
      const off = row % 2 ? 2 : 0;
      if ((x + rx + off) % 6 === 0 || y % 4 === 3) px(cx + x, cy + y + 1, 1, 1, shade(c.face, 0.62));
    }
  }
  // Borde de piedras (la tapa) y el agua dentro.
  disc(k, cx, cy, rx, ry, shade(STONE, 1.08));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    px(cx + Math.cos(a) * (rx - 2) - 1, cy + Math.sin(a) * (ry - 1.5), 2, 1, shade(STONE, 0.7));
  }
  disc(k, cx, cy, rx - 3, ry - 2, OL);
  disc(k, cx, cy + 1, rx - 4, Math.max(1, ry - 3), DEEP);
  disc(k, cx, cy + 1, rx - 6, Math.max(1, ry - 4), shade(c.top, 0.7));
  px(cx - 3, cy, 4, 1, 'rgba(220,240,250,0.55)'); // reflejo
  px(cx + 2, cy + 1, 2, 1, 'rgba(220,240,250,0.35)');
  // Musgo al pie del brocal.
  for (let i = 0; i < 6; i++) px(cx - rx + 1 + Math.floor(hash(i, 1, 13) * (rx * 2 - 2)), cy + bodyH + Math.floor(ry * 0.5), 2, 1, '#4a6a32');
  // Postes, tejadillo y torno.
  const roofY = 1;
  const postL = cx - rx + 1;
  const postR = cx + rx - 3;
  for (const x of [postL, postR]) {
    px(x - 1, roofY + 3, 4, cy - roofY - 1, OL);
    px(x, roofY + 4, 2, cy - roofY - 2, WOOD);
    px(x, roofY + 4, 1, cy - roofY - 2, shade(WOOD, 1.25));
  }
  // Torno: un tronco entre los postes con su cuerda enrollada y la manivela.
  const axY = roofY + Math.max(7, Math.floor((cy - roofY) * 0.45));
  px(postL + 1, axY - 1, postR - postL, 4, OL);
  px(postL + 2, axY, postR - postL - 2, 2, shade(WOOD, 1.1));
  for (let x = cx - 3; x <= cx + 2; x += 2) px(x, axY - 1, 1, 4, ROPE);
  px(postR + 2, axY, 3, 1, STEEL); // manivela
  px(postR + 4, axY, 1, 4, STEEL);
  px(postR + 4, axY + 3, 2, 1, OL);
  // Cuerda hasta el agua.
  px(cx, axY + 2, 1, cy - axY - 1, ROPE);
  // Tejadillo a dos aguas de tablas.
  const rw = rx * 2 + 6;
  const rh = Math.max(4, Math.floor(TH * 0.2));
  px(cx - rw / 2 - 1, roofY - 1 + 1, rw + 2, rh + 2, OL);
  for (let j = 0; j < rh; j++) px(cx - rw / 2, roofY + 1 + j, rw, 1, shade(c.dark, 1.6 - (j / rh) * 0.35));
  for (let x = cx - rw / 2 + 2; x < cx + rw / 2; x += 4) px(x, roofY + 1, 1, rh, shade(c.dark, 1.1));
  px(cx - rw / 2, roofY + 1, rw, 1, shade(c.dark, 1.9)); // cumbrera
  // Cubo de chapa sobre el borde, delante a la derecha.
  const bx = cx + Math.floor(rx * 0.35);
  const by = cy + ry - 3;
  px(bx - 1, by - 1, 7, 7, OL);
  px(bx, by, 5, 5, STEEL);
  px(bx, by, 5, 1, shade(STEEL, 1.3));
  px(bx + 1, by + 1, 3, 1, '#3a6a8a');
  px(bx + 3, by + 1, 2, 4, shade(STEEL, 0.75));
  line(k, bx - 1, by - 1, bx + 2, by - 4, 1, OL); // asa
  line(k, bx + 2, by - 4, bx + 5, by - 1, 1, OL);
}

// ——— Depuradora (1×1) ———

/**
 * Depuradora: depósito de chapa sobre un patín con el filtro de arena al lado, la bomba eléctrica con
 * su ventilador, el manguito que baja al agua, un manómetro, el grifo que gotea y el piloto verde.
 */
function purifier(k: Kit, c: Colors): void {
  const { px, W, H, TH, F } = k;
  groundShadow(k, 1, H - 7, W - 2, 7);
  // Patín de perfiles de acero.
  const skidY = H - Math.max(4, Math.floor(F * 0.18)) - 2;
  px(1, skidY - 1, W - 2, H - skidY, OL);
  px(2, skidY, W - 4, H - skidY - 2, shade(c.dark, 1.2));
  px(2, skidY, W - 4, 1, shade(c.dark, 1.7));
  for (let x = 4; x < W - 4; x += 7) rivet(k, x, skidY + 1, c.dark);
  // Depósito grande (izquierda).
  const tr = Math.max(6, Math.floor(W * 0.27));
  const tcx = 2 + tr;
  const try_ = Math.max(3, Math.floor(TH * 0.18));
  const tTop = Math.max(try_ + 2, Math.floor(TH * 0.3));
  const tBody = skidY - tTop - try_ + 1;
  cylinder(k, tcx, tTop, tr, try_, Math.max(4, tBody), shade(c.top, 1.05), c.top);
  // Aros y remaches del depósito.
  for (const t of [0.3, 0.75]) {
    const y = tTop + Math.floor(Math.max(4, tBody) * t);
    px(tcx - tr, y, tr * 2 + 1, 1, shade(c.top, 0.6));
    for (let x = tcx - tr + 2; x < tcx + tr; x += 4) px(x, y + 1, 1, 1, shade(c.top, 1.35));
  }
  rustSpots(k, tcx - tr + 2, tTop + 3, tr * 2 - 4, Math.max(4, tBody) - 4, 6, 17);
  // Boca de registro en la tapa.
  disc(k, tcx, tTop, Math.max(2, Math.floor(tr * 0.4)), Math.max(1, Math.floor(try_ * 0.5)), OL);
  disc(k, tcx, tTop, Math.max(1, Math.floor(tr * 0.4) - 1), Math.max(1, Math.floor(try_ * 0.5) - 1), STEEL);
  // Indicador de nivel: un tubo de cristal con el agua azul.
  const lvX = tcx - Math.floor(tr * 0.5);
  const lvY = tTop + 3;
  const lvH = Math.max(4, tBody - 6);
  px(lvX - 1, lvY, 3, lvH, OL);
  px(lvX, lvY + 1, 1, lvH - 2, '#c8dce4');
  px(lvX, lvY + Math.floor(lvH * 0.35), 1, lvH - Math.floor(lvH * 0.35) - 1, '#4aa0d0');
  // Filtro de arena (derecha, detrás) y el tubo que lo une al depósito.
  const fr = Math.max(4, Math.floor(W * 0.15));
  const fcx = W - fr - 3;
  const fTop = Math.max(fr, Math.floor(TH * 0.22));
  const fBody = Math.max(4, Math.floor((skidY - fTop) * 0.55));
  const pipeY = fTop + Math.floor(fBody * 0.4);
  px(tcx + tr, pipeY - 1, fcx - fr - tcx - tr + 1, 4, OL);
  px(tcx + tr, pipeY, fcx - fr - tcx - tr + 1, 2, STEEL);
  px(tcx + tr, pipeY, fcx - fr - tcx - tr + 1, 1, shade(STEEL, 1.3));
  // Patas del filtro.
  for (const x of [fcx - fr + 1, fcx + fr - 2]) {
    px(x - 1, fTop + fBody, 3, skidY - fTop - fBody, OL);
    px(x, fTop + fBody, 1, skidY - fTop - fBody, STEEL);
  }
  cylinder(k, fcx, fTop, fr, Math.max(2, Math.floor(fr * 0.5)), fBody, shade(c.face, 1.25), c.face);
  // Manómetro sobre el filtro.
  disc(k, fcx, fTop + Math.floor(fBody * 0.55), 3, 3, OL);
  disc(k, fcx, fTop + Math.floor(fBody * 0.55), 2, 2, '#e8e2cc');
  px(fcx, fTop + Math.floor(fBody * 0.55) - 2, 1, 2, '#c03a2a');
  // Bomba con motor y ventilador, delante a la derecha.
  const pw = Math.max(9, Math.floor(W * 0.36));
  const ph = Math.max(6, Math.floor(F * 0.32));
  const pX = W - pw - 2;
  const pY = skidY - ph;
  k.block(pX, pY, pw, Math.max(3, Math.floor(ph * 0.35)), ph - Math.max(3, Math.floor(ph * 0.35)), '#4a6a4a', '#3a5a3a');
  for (let x = pX + 2; x < pX + pw - 4; x += 2) px(x, pY + Math.floor(ph * 0.4), 1, Math.max(2, ph - Math.floor(ph * 0.4) - 2), '#2a3a2a'); // aletas
  disc(k, pX + pw - 3, pY + Math.floor(ph * 0.6), 2, 2, OL);
  px(pX + pw - 4, pY + Math.floor(ph * 0.6) - 1, 2, 2, STEEL); // ventilador
  px(pX + 2, pY + 1, 2, 2, '#5aff7a'); // piloto
  px(pX + 1, pY, 4, 4, 'rgba(90,255,122,0.25)');
  // Grifo con una gota.
  const gx = tcx + Math.floor(tr * 0.3);
  const gy = tTop + Math.max(4, tBody) - 3;
  px(gx - 1, gy - 1, 5, 3, OL);
  px(gx, gy, 3, 1, STEEL);
  px(gx + 1, gy + 1, 1, 2, STEEL);
  px(gx + 1, gy + 3, 1, 2, '#7ac8f0');
  // Manguito de aspiración: sale por la izquierda hacia el agua.
  const hy = skidY - 2;
  line(k, tcx - tr + 1, hy, 0, H - 2, 3, OL);
  line(k, tcx - tr + 1, hy, 0, H - 2, 1.5, '#2a2a2a');
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    px(tcx - tr + 1 - (tcx - tr + 1) * t, hy + (H - 2 - hy) * t - 1, 1, 2, '#555');
  }
  // Placa con la gota (agua potable).
  px(tcx + 2, tTop + Math.floor(Math.max(4, tBody) * 0.45), 5, 4, '#e8e8e0');
  px(tcx + 4, tTop + Math.floor(Math.max(4, tBody) * 0.45) + 1, 1, 2, '#2a7ac0');
}

// ——— Cantera (3×3) ———

/**
 * Cantera: un tajo en la roca con las bancadas en escalones (cada una más oscura), un charco al
 * fondo, una grúa de trípode con su polea sacando un bloque, bloques cortados apilados, una
 * carretilla con cascotes, el pico y el mazo, y las vetas de la roca en el frente.
 */
function quarry(k: Kit, c: Colors): void {
  const { px, W, H, TH, F } = k;
  groundShadow(k, 2, H - 10, W - 4, 10);
  const rock = c.top;
  // Masa de roca: la cara de arriba es la superficie y el frente son los estratos.
  const top0 = 4;
  const faceH = Math.max(4, F - 3);
  k.block(2, top0, W - 4, TH - top0, faceH, rock, c.face);
  // Estratos del frente con grietas.
  for (let j = 0; j < faceH - 2; j++) {
    const band = Math.floor((j / Math.max(1, faceH)) * 5);
    if (j % 5 === 4) px(3, TH - 1 + j, W - 6, 1, shade(c.face, 0.7 - band * 0.02));
  }
  for (let i = 0; i < 7; i++) {
    const x = 6 + Math.floor(hash(i, 3, 61) * (W - 14));
    const y0 = TH + Math.floor(hash(i, 4, 61) * Math.max(1, faceH * 0.4));
    line(k, x, y0, x + (hash(i, 5, 61) - 0.5) * 6, y0 + Math.max(3, faceH * 0.4), 1, shade(c.face, 0.55));
  }
  // Superficie: piedrecitas y matas.
  for (let i = 0; i < 26; i++) {
    const x = 4 + Math.floor(hash(i, 1, 62) * (W - 10));
    const y = top0 + 2 + Math.floor(hash(i, 2, 62) * (TH - top0 - 5));
    px(x, y, 2, 1, i % 4 ? shade(rock, 0.78) : '#5a7a3a');
  }
  // El tajo: bancadas en escalones. En esta vista se ve la pared del fondo de cada escalón.
  const pitX = Math.floor(W * 0.07);
  const pitY = top0 + Math.floor((TH - top0) * 0.1);
  const pitW = Math.floor(W * 0.6);
  const pitH = Math.floor((TH - top0) * 0.82);
  const steps = 3;
  const sx = Math.floor(pitW / (steps * 2 + 2));
  const sy = Math.floor(pitH / (steps * 2 + 2));
  px(pitX - 1, pitY - 1, pitW + 2, pitH + 2, OL);
  for (let s = 0; s <= steps; s++) {
    const x = pitX + s * sx;
    const y = pitY + s * sy;
    const w = pitW - s * sx * 2;
    const h = pitH - s * sy * 2;
    if (w <= 4 || h <= 4) break;
    const floor = shade(rock, 0.9 - s * 0.13);
    const wall = shade(c.face, 0.95 - s * 0.14);
    px(x, y, w, h, floor);
    // Pared del fondo (al norte) y del lado izquierdo, con marcas de corte.
    const wallH = Math.max(2, Math.floor(sy * 0.75));
    px(x, y, w, wallH, wall);
    for (let xx = x + 2; xx < x + w - 2; xx += 4) px(xx, y, 1, wallH, shade(wall, 0.8));
    px(x, y, Math.max(1, Math.floor(sx * 0.4)), h, shade(wall, 0.9));
    // Canto claro del escalón (la luz).
    px(x, y + h - 1, w, 1, shade(floor, 1.25));
    px(x + w - 1, y, 1, h, shade(floor, 1.12));
  }
  // Charco al fondo.
  const pcx = pitX + Math.floor(pitW / 2);
  const pcy = pitY + Math.floor(pitH / 2) + 2;
  disc(k, pcx + 2, pcy, Math.max(3, Math.floor(sx * 1.1)), Math.max(2, Math.floor(sy * 0.7)), '#3e5a5e');
  px(pcx, pcy - 1, 3, 1, 'rgba(220,240,250,0.45)');
  // Cascotes por las bancadas.
  for (let i = 0; i < 16; i++) {
    const x = pitX + 2 + Math.floor(hash(i, 7, 63) * (pitW - 6));
    const y = pitY + 2 + Math.floor(hash(i, 8, 63) * (pitH - 5));
    px(x, y, 2, 2, shade(rock, 0.6 + hash(i, 9, 63) * 0.5));
  }
  // Bloques cortados apilados (derecha).
  const stackX = pitX + pitW + Math.floor(W * 0.05);
  const bw = Math.max(8, Math.floor(W * 0.11));
  const bTop = Math.max(3, Math.floor(bw * 0.45));
  const bFace = Math.max(3, Math.floor(bw * 0.4));
  const piles: [number, number, number][] = [
    [stackX, TH - bTop - bFace - 6, 3],
    [stackX + bw + 2, TH - bTop - bFace - 6, 2],
    [stackX + Math.floor(bw / 2), top0 + Math.floor((TH - top0) * 0.25), 2],
  ];
  piles.forEach(([x0, y0, n], p) => {
    // Uno encima de otro, cada uno algo desplazado.
    for (let r = 0; r < n; r++) {
      const x = x0 + r;
      const y = y0 - r * (bFace + 1);
      const tone = shade(STONE, 1.05 + hash(p, r, 64) * 0.15);
      k.block(x, y, bw, bTop, bFace, tone, shade(tone, 0.78));
      px(x + 2, y + bTop + 1, 1, bFace - 2, shade(tone, 0.6)); // marca de la cuña
    }
  });
  // Carretilla con cascotes (delante a la derecha).
  const wx = W - Math.floor(W * 0.2);
  const wy = H - Math.max(6, Math.floor(F * 0.35)) - 8;
  px(wx - 1, wy - 1, 13, 7, OL);
  px(wx, wy, 11, 5, '#6a7a82');
  px(wx, wy, 11, 1, shade('#6a7a82', 1.3));
  for (let i = 0; i < 5; i++) px(wx + 1 + i * 2, wy - 1 - (i % 2), 2, 2, shade(STONE, 0.9 + i * 0.05));
  disc(k, wx + 12, wy + 5, 2, 2, OL);
  px(wx + 11, wy + 4, 2, 2, '#3a3a3a');
  line(k, wx, wy + 3, wx - 5, wy + 6, 1, WOOD); // varales
  // Pico apoyado en la roca.
  const pkx = Math.floor(W * 0.72);
  const pky = top0 + Math.floor((TH - top0) * 0.55);
  beam(k, pkx, pky + 8, pkx + 5, pky - 2, 1, WOOD);
  line(k, pkx + 1, pky - 3, pkx + 9, pky - 1, 2, OL);
  line(k, pkx + 2, pky - 3, pkx + 8, pky - 1, 1, STEEL);
  // Grúa de trípode sobre el tajo con su polea y un bloque colgando.
  const apexX = pitX + Math.floor(pitW * 0.55);
  const apexY = 1;
  const legs: [number, number][] = [
    [pitX + 2, pitY + Math.floor(pitH * 0.25)],
    [pitX + pitW - 3, pitY + Math.floor(pitH * 0.2)],
    [pitX + Math.floor(pitW * 0.45), pitY + pitH + 2],
  ];
  for (const [lx, ly] of legs.slice(0, 2)) beam(k, lx, ly, apexX, apexY + 2, 2, WOOD);
  const hangY = pitY + Math.floor(pitH * 0.55);
  px(apexX, apexY + 4, 1, hangY - apexY - 4, ROPE);
  line(k, apexX + 1, apexY + 4, legs[1][0] - 3, legs[1][1] - 1, 1, ROPE); // tiro hasta el torno
  // Bloque colgando del gancho.
  px(apexX - 1, hangY - 1, 3, 2, STEEL);
  k.block(apexX - Math.floor(bw / 2), hangY + 1, bw, bTop, bFace, shade(STONE, 1.1), shade(STONE, 0.85));
  // Pata de delante (pasa por encima del bloque) y la polea.
  beam(k, legs[2][0], legs[2][1], apexX, apexY + 2, 2, shade(WOOD, 1.05));
  disc(k, apexX, apexY + 3, 3, 3, OL);
  disc(k, apexX, apexY + 3, 2, 2, STEEL);
  px(apexX, apexY + 3, 1, 1, OL);
  // Atado de cuerda en la cabeza del trípode.
  px(apexX - 2, apexY + 1, 5, 1, ROPE);
}

// ——— Muelle (casilla a ras del agua) ———

/**
 * Muelle: tablones de lado a lado con sus clavos y el desgaste, rendijas por las que se ve el agua,
 * un larguero de canto que da grosor y los pilotes de las esquinas con su atadura de cuerda.
 * Las casillas de muelle se juntan sin costura.
 */
function dock(k: Kit, c: Colors): void {
  const { px, W, TH } = k;
  // El agua por las rendijas.
  px(0, 0, W, TH, DEEP);
  const edge = Math.max(2, Math.floor(TH * 0.12)); // grosor del larguero de delante
  const plankW = Math.max(5, Math.floor(W / 5));
  // Tablones de arriba abajo (perpendiculares a la orilla en la vista).
  for (let i = 0, x = 0; x < W; i++, x += plankW) {
    const w = Math.min(plankW - 1, W - x);
    const base = shade(c.top, 0.86 + hash(i, 0, 71) * 0.24);
    for (let y = 0; y < TH - edge; y++) px(x, y, w, 1, shade(base, 1.04 - (y / TH) * 0.08));
    px(x, 0, 1, TH - edge, shade(base, 1.2));
    px(x + w - 1, 0, 1, TH - edge, shade(base, 0.72));
    // Vetas y nudos.
    for (let g = 0; g < 3; g++) {
      const gy = Math.floor(hash(i, g, 72) * (TH - edge - 3));
      px(x + 1 + Math.floor(hash(g, i, 73) * Math.max(1, w - 2)), gy, 1, 3 + Math.floor(hash(i, g, 74) * 4), shade(base, 0.82));
    }
    if (hash(i, 5, 75) < 0.4) px(x + Math.floor(w / 2) - 1, Math.floor(hash(i, 6, 75) * (TH - edge - 3)) + 1, 2, 2, shade(base, 0.55));
    // Clavos arriba y abajo (sobre las vigas de debajo).
    for (const ny of [2, TH - edge - 3]) {
      px(x + 1, ny, 1, 1, '#3a3a3a');
      px(x + w - 2, ny, 1, 1, '#3a3a3a');
    }
    // Tablón gastado o húmedo.
    if (hash(i, 7, 76) < 0.35) px(x + 1, Math.floor(TH * 0.4), w - 2, Math.floor(TH * 0.25), 'rgba(40,30,20,0.18)');
  }
  // Larguero de canto delante (da grosor al muelle).
  px(0, TH - edge, W, edge, shade(c.face, 0.95));
  px(0, TH - edge, W, 1, shade(c.face, 1.25));
  px(0, TH - 1, W, 1, c.dark);
  // Pilotes de las esquinas de delante con su atadura (los de atrás quedan bajo los tablones).
  for (const x of [1, W - 6]) {
    px(x - 1, TH - edge - 5, 7, 6, OL);
    disc(k, x + 2, TH - edge - 3, 2.5, 2, shade(c.dark, 1.7));
    px(x + 1, TH - edge - 3, 2, 1, shade(c.dark, 1.2)); // anillos del tronco
    px(x, TH - edge - 1, 5, 1, ROPE);
  }
}

// ——— Trampa de pesca (casilla de agua) ———

/**
 * Trampa de pesca: nasa de mimbre medio hundida, con su boca en embudo y los aros, ondas en el agua
 * alrededor, una boya roja y blanca y la cuerda que la ata al muelle.
 */
function fishTrap(k: Kit, c: Colors): void {
  const { px, W, TH } = k;
  const cx = Math.floor(W / 2);
  const cy = Math.floor(TH * 0.55);
  const rx = Math.floor(W * 0.36);
  const ry = Math.max(3, Math.floor(TH * 0.26));
  // La parte hundida, vista a través del agua.
  disc(k, cx, cy + 2, rx + 2, ry + 1, 'rgba(20,40,55,0.45)');
  ripples(k, cx, cy, rx + 1, 81);
  // Cuerpo de mimbre: un huso con la trama de mimbre.
  disc(k, cx, cy, rx + 1, ry + 1, OL);
  disc(k, cx, cy, rx, ry, c.top);
  for (let x = -rx + 1; x < rx; x += 2) {
    const half = Math.round(ry * Math.sqrt(Math.max(0, 1 - (x / (rx + 0.5)) ** 2)));
    px(cx + x, cy - half + 1, 1, half * 2 - 1, shade(c.top, x % 4 === 0 ? 0.75 : 1.12));
  }
  // Aros.
  for (const t of [-0.5, 0, 0.5]) {
    const x = cx + Math.round(rx * t);
    const half = Math.round(ry * Math.sqrt(Math.max(0, 1 - t * t)));
    px(x, cy - half, 1, half * 2 + 1, c.dark);
  }
  // Boca en embudo (izquierda) y la tapa atada (derecha).
  disc(k, cx - rx + 1, cy, 2, Math.max(2, ry - 1), OL);
  px(cx - rx + 1, cy - 1, 2, 2, DEEP);
  px(cx + rx - 1, cy - 2, 2, 4, c.dark);
  // Brillo del agua encima de la parte hundida.
  px(cx - 3, cy + ry - 1, 6, 1, 'rgba(207,230,240,0.55)');
  // Boya y cuerda.
  const bx = W - 5;
  const by = 4;
  line(k, cx + rx - 1, cy - 1, bx, by + 2, 1, ROPE);
  line(k, cx - rx, cy - 1, 0, 1, 1, ROPE); // hasta el muelle
  disc(k, bx, by, 3, 2.5, OL);
  disc(k, bx, by, 2, 1.5, '#d23a2a');
  px(bx - 2, by, 5, 1, '#f0f0e8');
  ripples(k, bx, by + 1, 3, 82);
  px(bx - 1, by - 1, 1, 1, 'rgba(255,255,255,0.7)');
}
