// Defensas a doble resolución (salto de calidad del 2D, pedido por Mikel el 2026-10-21).
// Como los muebles (furnitureArt.ts): cada pieza se dibuja en un lienzo del doble de tamaño y se
// coloca a la mitad. La pieza tiene la cara de arriba (W × TH) y debajo el frente (W × F); las que
// van a ras de suelo (pinchos, alambre, minas, trampas, mortero) no tienen frente (F = 0).
// Solo dibujo: se elige por el id del contenido y no decide nada del juego.
import type { BuildingDef } from '../data/buildings';
import { hash, kit, Kit, OL, shade } from './furnitureArt';

/** Ids que se dibujan aquí, a doble resolución. */
export const DEFENSE_HI_RES_IDS: ReadonlySet<string> = new Set([
  'barricada_madera',
  'barricada_chatarra',
  'barricada_metal',
  'barricada_hormigon',
  'sacos_arena',
  'pinchos_madera',
  'pinchos_metal',
  'alambre_espino',
  'mina_casera',
  'trampa_electrica',
  'mortero',
  'torreta_ligera',
  'torreta_pesada',
  'torreta_rotativa',
]);

export function isHiResDefense(def: BuildingDef): boolean {
  return DEFENSE_HI_RES_IDS.has(def.id) && !def.vehicle;
}

type Colors = BuildingDef['colors'];

const STEEL = '#8a9198';
const GUN = '#2b2d30';
const BRASS = '#c9a24a';
const RUST = '#8a4a26';

/**
 * Dibuja una defensa a doble resolución. `W` = ancho, `TH` = alto de la cara de arriba y `F` = alto
 * del frente, ya multiplicados por dos.
 */
export function drawDefenseHi(ctx: CanvasRenderingContext2D, def: BuildingDef, W: number, TH: number, F: number): void {
  ctx.clearRect(0, 0, W, TH + F);
  const k = kit(ctx, W, TH, F);
  const c = def.colors;
  switch (def.id) {
    case 'barricada_madera':
      return woodBarricade(k, c);
    case 'barricada_chatarra':
      return scrapBarricade(k, c);
    case 'barricada_metal':
      return steelBarricade(k, c);
    case 'barricada_hormigon':
      return jerseyBarrier(k, c);
    case 'sacos_arena':
      return sandbags(k, c);
    case 'pinchos_madera':
      return woodSpikes(k, c);
    case 'pinchos_metal':
      return steelSpikes(k, c);
    case 'alambre_espino':
      return barbedWire(k, c);
    case 'mina_casera':
      return mine(k, c);
    case 'trampa_electrica':
      return shockTrap(k, c);
    case 'mortero':
      return mortar(k, c);
    case 'torreta_ligera':
      return turret(k, c, 'ligera');
    case 'torreta_pesada':
      return turret(k, c, 'pesada');
    case 'torreta_rotativa':
      return turret(k, c, 'rotativa');
  }
}

// ——— Utilidades ———

/** Elipse rellena (en filas de píxeles). */
export function disc(k: Kit, cx: number, cy: number, rx: number, ry: number, c: string): void {
  const r = Math.max(1, Math.round(ry));
  for (let y = -r; y <= r; y++) {
    const t = y / r;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    k.px(cx - half, cy + y, half * 2 + 1, 1, c);
  }
}

/** Línea gruesa de (x0, y0) a (x1, y1). */
export function line(k: Kit, x0: number, y0: number, x1: number, y1: number, w: number, c: string): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    k.px(x0 + (x1 - x0) * t - w / 2, y0 + (y1 - y0) * t - w / 2, w, w, c);
  }
}

/** Línea con contorno: primero el contorno, luego el color y un brillo arriba. */
export function beam(k: Kit, x0: number, y0: number, x1: number, y1: number, w: number, c: string): void {
  line(k, x0, y0, x1, y1, w + 2, OL);
  line(k, x0, y0, x1, y1, w, c);
  line(k, x0, y0 - Math.max(1, w / 3), x1, y1 - Math.max(1, w / 3), 1, shade(c, 1.3));
}

/** Sombra en el suelo, a los pies de la pieza. */
export function groundShadow(k: Kit, x: number, y: number, w: number, h: number): void {
  disc(k, x + w / 2, y + h / 2, w / 2, h / 2, 'rgba(0,0,0,0.26)');
}

/** Remache: un punto claro con su sombra. */
export function rivet(k: Kit, x: number, y: number, c: string): void {
  k.px(x, y, 2, 2, shade(c, 0.55));
  k.px(x, y, 1, 1, shade(c, 1.45));
}

/** Manchas de óxido al azar en un rectángulo. */
export function rustSpots(k: Kit, x: number, y: number, w: number, h: number, n: number, seed: number): void {
  for (let i = 0; i < n; i++) {
    const rx = x + Math.floor(hash(i, 1, seed) * Math.max(1, w - 3));
    const ry = y + Math.floor(hash(i, 2, seed) * Math.max(1, h - 2));
    const s = 1 + Math.floor(hash(i, 3, seed) * 3);
    k.px(rx, ry, s, Math.max(1, s - 1), i % 3 ? RUST : shade(RUST, 0.7));
  }
}

/** Franjas de aviso amarillas y negras en diagonal. */
export function hazard(k: Kit, x: number, y: number, w: number, h: number): void {
  k.px(x, y, w, h, '#e0b02a');
  for (let i = -h; i < w; i += 6) for (let j = 0; j < h; j++) k.px(x + Math.max(0, Math.min(w - 1, i + j)), y + j, Math.max(0, Math.min(3, w - (i + j))), 1, '#1e1e1e');
}

// ——— Barricadas (un piso de alto) ———

/** Barricada de madera: dos postes, dos largueros de tablón y una cruz de San Andrés clavada. */
function woodBarricade(k: Kit, c: Colors): void {
  const { px, W, H, TH } = k;
  const y0 = Math.floor(TH * 0.4);
  groundShadow(k, 1, H - 6, W - 2, 6);
  // Postes.
  for (const x of [2, W - 7]) {
    px(x, y0 - 2, 5, H - y0, OL);
    px(x + 1, y0 - 1, 3, H - y0 - 2, c.face);
    px(x + 1, y0 - 1, 1, H - y0 - 2, shade(c.face, 1.25));
    px(x + 1, y0 - 1, 3, 1, shade(c.top, 1.15)); // corte del poste
  }
  // Cruz.
  beam(k, 5, y0 + 4, W - 6, H - 5, 4, shade(c.face, 0.92));
  beam(k, W - 6, y0 + 4, 5, H - 5, 4, c.face);
  // Largueros de arriba y de abajo, con vetas.
  for (const [y, h] of [[y0 + 1, 6], [H - 9, 5]]) {
    px(0, y - 1, W, h + 2, OL);
    k.planks(1, y, W - 2, h, c.top, h, y);
    px(1, y, W - 2, 1, shade(c.top, 1.25));
  }
  // Clavos.
  for (const x of [4, W - 5, Math.floor(W / 2) - 1]) {
    px(x, y0 + 3, 1, 1, '#c8ccd0');
    px(x, H - 7, 1, 1, '#c8ccd0');
  }
  px(Math.floor(W / 2) - 1, Math.floor((y0 + H) / 2), 2, 2, '#9aa0a6');
}

/** Barricada de chatarra: chapa ondulada, una puerta de coche, un neumático y un tubo, todo oxidado. */
function scrapBarricade(k: Kit, c: Colors): void {
  const { px, W, H, TH } = k;
  const y0 = Math.floor(TH * 0.35);
  groundShadow(k, 0, H - 6, W, 6);
  // Montón de fondo.
  px(1, y0 + 3, W - 2, H - y0 - 4, OL);
  px(2, y0 + 4, W - 4, H - y0 - 6, shade(c.face, 0.8));
  // Chapa ondulada inclinada (a la izquierda).
  const sw = Math.floor(W * 0.55);
  for (let x = 0; x < sw; x++) {
    const top = y0 + 1 + Math.floor((x * 4) / sw);
    const col = x % 4 < 2 ? c.top : shade(c.top, 0.72);
    px(2 + x, top, 1, H - top - 3, col);
  }
  px(2, y0 + 1, sw, 1, OL);
  rustSpots(k, 2, y0 + 3, sw, H - y0 - 6, 10, 11);
  // Puerta de coche (a la derecha), con su ventanilla rota.
  const dx = Math.floor(W * 0.5);
  const dy = y0 + 4;
  px(dx, dy, W - dx - 1, H - dy - 2, OL);
  px(dx + 1, dy + 1, W - dx - 3, H - dy - 4, '#6b7a62');
  px(dx + 3, dy + 2, W - dx - 7, Math.floor((H - dy) * 0.32), '#2c3a44');
  px(dx + 4, dy + 3, 3, 1, '#8fa8b4'); // reflejo
  line(k, dx + 6, dy + 3, dx + 9, dy + 6, 1, '#8fa8b4'); // grieta
  px(dx + 3, dy + Math.floor((H - dy) * 0.55), 4, 1, '#c8ccd0'); // manilla
  rustSpots(k, dx + 1, dy + 4, W - dx - 3, H - dy - 6, 6, 23);
  // Neumático apoyado delante.
  const ty = H - 7;
  disc(k, 9, ty, 7, 5, OL);
  disc(k, 9, ty, 6, 4, '#2a2a2a');
  disc(k, 9, ty, 3, 2, '#5e5e5e');
  px(5, ty - 3, 3, 1, '#4a4a4a');
  // Tubo cruzado.
  beam(k, Math.floor(W * 0.3), y0 + 2, W - 3, y0 + 8, 2, STEEL);
}

/** Barricada de metal: planchas atornilladas con remaches, una mirilla y dos tornapuntas. */
function steelBarricade(k: Kit, c: Colors): void {
  const { px, W, H, TH } = k;
  const y0 = Math.floor(TH * 0.35);
  groundShadow(k, 0, H - 6, W, 6);
  k.block(1, y0, W - 2, 5, H - y0 - 6, c.top, c.face);
  // Juntas entre planchas y remaches.
  const mid = Math.floor(W / 2);
  px(mid, y0 + 4, 1, H - y0 - 7, shade(c.face, 0.55));
  px(mid + 1, y0 + 4, 1, H - y0 - 7, shade(c.face, 1.2));
  for (let x = 4; x < W - 3; x += 5) {
    rivet(k, x, y0 + 6, c.face);
    rivet(k, x, H - 6, c.face);
  }
  // Mirilla.
  px(Math.floor(W * 0.2), y0 + 10, Math.floor(W * 0.25), 2, OL);
  px(Math.floor(W * 0.2), y0 + 12, Math.floor(W * 0.25), 1, shade(c.face, 1.3));
  // Arañazos y algo de óxido.
  line(k, mid + 4, y0 + 9, mid + 10, y0 + 12, 1, shade(c.face, 1.35));
  line(k, 6, H - 10, 11, H - 12, 1, shade(c.face, 1.3));
  rustSpots(k, 3, H - 10, W - 6, 4, 5, 37);
  // Tornapuntas a los lados (se ven en la cara de arriba).
  for (const x of [3, W - 6]) {
    px(x, 1, 3, y0, OL);
    px(x + 1, 2, 1, y0 - 1, c.dark);
  }
}

/** Barricada de hormigón: tipo «New Jersey», con desconchones, varillas y franjas de aviso. */
function jerseyBarrier(k: Kit, c: Colors): void {
  const { px, W, H, TH } = k;
  const y0 = Math.floor(TH * 0.3);
  groundShadow(k, 0, H - 6, W, 6);
  const faceH = H - y0 - 5;
  const upper = Math.floor(faceH * 0.45);
  // Lomo estrecho arriba.
  px(1, y0, W - 2, H - y0 - 1, OL);
  px(2, y0 + 1, W - 4, 3, shade(c.top, 1.1));
  px(2, y0 + 1, W - 4, 1, shade(c.top, 1.3));
  // Frente: parte recta, rampa inclinada (más clara) y pie.
  px(2, y0 + 4, W - 4, upper, c.face);
  px(2, y0 + 4 + upper, W - 4, Math.floor(faceH * 0.3), shade(c.top, 0.98));
  px(2, y0 + 4 + upper, W - 4, 1, shade(c.top, 1.2));
  px(2, H - 2 - Math.ceil(faceH * 0.25), W - 4, Math.ceil(faceH * 0.25), shade(c.face, 0.82));
  // Grano del hormigón.
  for (let i = 0; i < W * 2; i++) {
    const gx = 2 + Math.floor(hash(i, 4, 51) * (W - 4));
    const gy = y0 + 4 + Math.floor(hash(i, 5, 51) * (faceH - 2));
    px(gx, gy, 1, 1, hash(i, 6, 51) < 0.5 ? shade(c.face, 0.88) : shade(c.face, 1.12));
  }
  // Franjas de aviso y agujeros de izado.
  hazard(k, 3, y0 + 5, W - 6, 3);
  for (const x of [Math.floor(W * 0.25), Math.floor(W * 0.7)]) px(x, H - 4, 4, 2, shade(c.face, 0.45));
  // Desconchón en una esquina con la varilla oxidada al aire.
  px(W - 8, y0 + 1, 6, 4, shade(c.face, 0.65));
  px(W - 6, y0 - 2, 1, 4, RUST);
  px(W - 4, y0 - 1, 1, 3, RUST);
}

/** Sacos terreros: tres hileras de sacos abultados con costuras y atados, la del medio desplazada. */
function sandbags(k: Kit, c: Colors): void {
  const { px, W, H, TH } = k;
  const y0 = Math.floor(TH * 0.3);
  groundShadow(k, 0, H - 6, W, 6);
  const rows = 3;
  const rowH = Math.max(5, Math.floor((H - y0 - 2) / rows));
  const sackW = 12;
  for (let r = 0; r < rows; r++) {
    const y = H - 2 - (r + 1) * rowH;
    const off = r % 2 === 0 ? 0 : -sackW / 2;
    for (let i = 0, x = off; x < W; i++, x += sackW) {
      const x0 = Math.max(0, x);
      const w = Math.min(W, x + sackW) - x0;
      if (w <= 3) continue;
      const tint = shade(c.face, 0.94 + hash(i, r, 71) * 0.14);
      // Saco: rectángulo redondeado con brillo arriba y sombra abajo.
      px(x0, y + 1, w, rowH - 1, OL);
      px(x0 + 1, y, w - 2, 1, OL);
      px(x0 + 1, y + 1, w - 2, rowH - 2, tint);
      px(x0 + 2, y + 1, w - 4, 1, shade(c.top, 1.12));
      px(x0 + 2, y + 2, w - 4, 1, c.top);
      px(x0 + 1, y + rowH - 2, w - 2, 1, shade(c.dark, 1.1));
      // Costura con puntadas y atado en un extremo.
      if (x >= 0) for (let j = y + 2; j < y + rowH - 2; j += 2) px(x0 + 2, j, 1, 1, c.dark);
      if (x + sackW <= W) {
        px(x0 + w - 3, y + Math.floor(rowH / 2) - 1, 2, 2, c.dark);
        px(x0 + w - 2, y + Math.floor(rowH / 2) - 2, 1, 1, shade(c.top, 1.2));
      }
      // Arena que se sale de alguno.
      if (hash(i, r, 73) < 0.15) px(x0 + 4, y + rowH - 1, 3, 1, c.top);
    }
  }
}

// ——— A ras de suelo (sin frente) ———

/** Pinchos de madera: tres filas de estacas afiladas, atadas con un travesaño. */
function woodSpikes(k: Kit, c: Colors): void {
  const { px, W, TH } = k;
  // Tierra removida.
  disc(k, W / 2, TH / 2 + 1, W / 2 - 1, TH / 2 - 2, 'rgba(70,50,30,0.35)');
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const base = Math.floor((TH * (r + 1)) / (rows + 0.6)) + 2;
    const h = Math.max(6, Math.floor(TH * 0.42));
    // Travesaño.
    px(1, base - Math.floor(h / 2), W - 2, 2, OL);
    px(1, base - Math.floor(h / 2), W - 2, 1, c.dark);
    for (let x = 2 + (r % 2) * 4; x < W - 3; x += 8) {
      const lean = r % 2 ? 1 : -1;
      // Sombra hacia la derecha.
      line(k, x + 2, base, x + 5, base - 2, 2, 'rgba(0,0,0,0.3)');
      // Estaca: lado de luz, lado de sombra y punta clara.
      px(x - 1, base - h, 5, h + 1, OL);
      px(x, base - h + 2, 2, h - 2, c.face);
      px(x + 2, base - h + 2, 1, h - 2, c.dark);
      px(x, base - h + 2, 1, h - 2, shade(c.face, 1.25));
      px(x + (lean > 0 ? 1 : 0), base - h, 2, 2, c.top);
      px(x + 1, base - h - 1, 1, 1, shade(c.top, 1.3));
    }
  }
}

/** Pinchos de metal: erizos de varilla corrugada en dos filas, con algo de óxido. */
function steelSpikes(k: Kit, c: Colors): void {
  const { px, W, TH } = k;
  disc(k, W / 2, TH / 2 + 1, W / 2 - 1, TH / 2 - 2, 'rgba(40,40,40,0.3)');
  const rows = 2;
  for (let r = 0; r < rows; r++) {
    const cy = Math.floor((TH * (r + 0.75)) / (rows + 0.2)) + 1;
    for (let x = 6 + (r % 2) * 8; x < W - 3; x += 16) {
      const s = Math.max(4, Math.floor(TH * 0.32));
      // Erizo: tres varillas cruzadas.
      line(k, x + 3, cy + 3, x + 7, cy + 1, 2, 'rgba(0,0,0,0.3)');
      beam(k, x - s, cy + s / 2, x + s, cy - s / 2, 2, c.face);
      beam(k, x - s, cy - s / 2, x + s, cy + s / 2, 2, shade(c.face, 0.9));
      beam(k, x, cy + s / 2 + 1, x, cy - s, 2, c.top);
      px(x - 1, cy - s - 1, 2, 1, shade(c.top, 1.3));
      px(x - 1, cy - 1, 3, 3, RUST);
    }
  }
}

/** Alambre de espino: una concertina (rollo en espiral) entre dos estacas, con púas. */
function barbedWire(k: Kit, c: Colors): void {
  const { px, W, TH } = k;
  const cy = Math.floor(TH * 0.55);
  const ry = Math.max(3, Math.floor(TH * 0.32));
  const rx = 5;
  // Sombra del rollo.
  px(2, cy + ry - 1, W - 4, 2, 'rgba(0,0,0,0.22)');
  // Estacas.
  for (const x of [1, W - 4]) {
    px(x, cy - ry - 1, 3, ry * 2 + 2, OL);
    px(x + 1, cy - ry, 1, ry * 2, c.face);
  }
  // Espiras: la mitad de atrás más oscura, la de delante clara.
  for (let i = 0, x0 = 5; x0 < W - 4; i++, x0 += 4) {
    for (let a = 0; a < 28; a++) {
      const ang = (a / 28) * Math.PI * 2;
      const x = x0 + Math.cos(ang) * rx;
      const y = cy + Math.sin(ang) * ry;
      if (x < 2 || x > W - 3) continue;
      const front = Math.sin(ang) > 0;
      if (front) px(x, y + 1, 1, 1, OL);
      px(x, y, 1, 1, front ? c.top : c.dark);
      // Púas.
      if (a % 7 === 3) {
        px(x - 1, y - 1, 1, 1, front ? shade(c.top, 1.2) : c.face);
        px(x + 1, y + 1, 1, 1, front ? shade(c.top, 1.2) : c.face);
      }
    }
    if (hash(i, 0, 91) < 0.4) px(x0, cy - ry, 1, 1, '#ffffff'); // reflejo
  }
  // Hilo tenso de una estaca a otra.
  for (let x = 3; x < W - 3; x++) px(x, cy - ry + 1 + (Math.floor(x / 3) % 2), 1, 1, shade(c.face, 1.1));
}

/** Mina casera: una lata de chapa medio enterrada, con la placa de presión, la espoleta y un hilo. */
function mine(k: Kit, c: Colors): void {
  const { px, W, TH } = k;
  const cx = Math.floor(W / 2);
  const cy = Math.floor(TH / 2) + 1;
  const r = Math.max(5, Math.floor(W * 0.28));
  const ry = Math.max(3, Math.floor(r * (TH / W) * 0.95));
  // Tierra removida alrededor.
  disc(k, cx, cy + 1, r + 4, ry + 3, 'rgba(84,62,38,0.6)');
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    px(cx + Math.cos(a) * (r + 3), cy + 1 + Math.sin(a) * (ry + 2), 2, 1, '#6a4e30');
  }
  // Cuerpo.
  disc(k, cx, cy + 1, r + 1, ry + 1, OL);
  disc(k, cx, cy + 1, r, ry, c.face);
  disc(k, cx, cy, r, ry, c.top);
  // Anillo de tornillos.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    px(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (ry - 1), 1, 1, c.dark);
  }
  // Placa de presión y espoleta roja.
  disc(k, cx, cy, Math.floor(r / 2), Math.floor(ry / 2), shade(c.top, 0.8));
  px(cx - 1, cy - 2, 3, 3, OL);
  px(cx - 1, cy - 2, 2, 2, '#d0402e');
  px(cx - 1, cy - 2, 1, 1, '#ff8a70');
  // Hilo de tropiezo hasta una estaquilla.
  line(k, cx + r - 1, cy, W - 3, cy - ry - 1, 1, '#cfcfc0');
  px(W - 4, cy - ry - 3, 2, 3, '#6a4e30');
  rustSpots(k, cx - r, cy - 1, r, ry, 3, 101);
}

/** Trampa eléctrica: placa de rejilla con dos bobinas de cobre, aisladores, un aviso y chispas. */
function shockTrap(k: Kit, c: Colors): void {
  const { px, W, TH } = k;
  const m = 3;
  px(m - 1, m - 1, W - 2 * m + 2, TH - 2 * m + 2, OL);
  px(m, m, W - 2 * m, TH - 2 * m, c.face);
  px(m, m, W - 2 * m, 1, shade(c.top, 1.15));
  // Rejilla.
  for (let y = m + 2; y < TH - m - 1; y += 3) px(m + 1, y, W - 2 * m - 2, 1, shade(c.face, 0.7));
  for (let x = m + 2; x < W - m - 1; x += 3) px(x, m + 1, 1, TH - 2 * m - 2, shade(c.face, 0.78));
  // Bobinas en dos esquinas.
  for (const [bx, by] of [[m + 1, m + 1], [W - m - 8, TH - m - 6]]) {
    px(bx, by, 7, 5, OL);
    for (let i = 0; i < 5; i++) px(bx + 1 + i, by + 1, 1, 3, i % 2 ? '#b8662e' : '#e09050');
    px(bx + 2, by - 1, 2, 2, '#e8e4dc'); // aislador
  }
  // Aviso: triángulo amarillo con el rayo.
  const tx = Math.floor(W / 2);
  const ty = Math.floor(TH / 2) - 3;
  for (let j = 0; j < 7; j++) px(tx - Math.floor(j / 2) - 1, ty + j, Math.floor(j / 2) * 2 + 3, 1, j === 6 ? OL : '#e8c22a');
  px(tx, ty + 2, 1, 2, OL);
  px(tx - 1, ty + 4, 1, 1, OL);
  // Cable que sale por un lado.
  line(k, W - m, m + 3, W - 1, m + 1, 1, OL);
  // Chispas azules.
  for (let i = 0; i < 4; i++) {
    const sx = m + 2 + Math.floor(hash(i, 0, 113) * (W - 2 * m - 4));
    const sy = m + 2 + Math.floor(hash(i, 1, 113) * (TH - 2 * m - 4));
    px(sx, sy, 1, 1, '#bfe8ff');
    px(sx + 1, sy - 1, 1, 1, '#6ab8ff');
  }
}

/** Mortero: placa base, bípode, tubo inclinado con la boca oscura y una caja de granadas al lado. */
function mortar(k: Kit, c: Colors): void {
  const { px, W, TH } = k;
  const cx = Math.floor(W * 0.42);
  const cy = Math.floor(TH * 0.62);
  const r = Math.max(5, Math.floor(W * 0.22));
  const ry = Math.max(3, Math.floor(r * 0.55));
  // Placa base.
  disc(k, cx + 1, cy + 2, r + 1, ry + 1, 'rgba(0,0,0,0.3)');
  disc(k, cx, cy + 1, r + 1, ry + 1, OL);
  disc(k, cx, cy + 1, r, ry, c.face);
  disc(k, cx, cy, r - 1, ry - 1, c.top);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    px(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (ry - 1), 1, 1, c.dark);
  }
  // Tubo hacia arriba y a la derecha.
  const mx = cx + Math.floor(W * 0.28);
  const my = Math.max(2, cy - Math.floor(TH * 0.55));
  // Bípode.
  line(k, mx - 3, my + 4, mx - 6, cy + ry, 1, OL);
  line(k, mx - 1, my + 5, mx + 2, cy + ry - 1, 1, OL);
  px(mx - 5, my + 6, 6, 1, c.dark); // husillo
  beam(k, cx, cy, mx, my, 4, shade(c.face, 1.05));
  // Boca.
  disc(k, mx, my, 3, 2, OL);
  px(mx - 1, my - 1, 2, 1, '#000000');
  // Visor.
  px(cx + Math.floor((mx - cx) * 0.45) - 2, cy - Math.floor((cy - my) * 0.45) - 4, 3, 2, '#3a4a3a');
  // Caja de granadas abierta, con las espoletas de latón.
  const bx = 2;
  const by = TH - 9;
  px(bx, by, 10, 7, OL);
  px(bx + 1, by + 1, 8, 5, '#5a6440');
  for (let i = 0; i < 3; i++) {
    px(bx + 2 + i * 3, by + 2, 2, 3, '#4a4f46');
    px(bx + 2 + i * 3, by + 2, 2, 1, BRASS);
  }
}

// ——— Torretas ———

/**
 * Torreta: zócalo blindado con franjas de aviso, corona giratoria y cabeza con su arma. La ligera
 * lleva un cañón, la pesada dos con freno de boca y la rotativa un haz de cañones con su cinta.
 */
function turret(k: Kit, c: Colors, kind: 'ligera' | 'pesada' | 'rotativa'): void {
  const { px, W, H, TH } = k;
  const big = kind === 'pesada';
  const u = W / 32; // escala: 1 en una casilla, 2 en la pesada (2×2)
  // Losa: una plataforma baja con franjas de aviso.
  const topP = Math.floor(TH * 0.55);
  const faceP = Math.max(Math.floor(3 * u), Math.floor(k.F * 0.35));
  const plinthY = H - faceP - topP - 1;
  const inset = Math.floor(2 * u);
  groundShadow(k, inset - 1, H - Math.floor(4 * u), W - inset * 2 + 2, Math.floor(5 * u));
  k.block(inset, plinthY, W - inset * 2, topP, faceP + 1, shade(c.top, 0.9), c.face);
  if (faceP >= 3 * u) hazard(k, inset + 1, H - faceP + 1, W - inset * 2 - 2, Math.max(2, Math.min(Math.floor(3 * u), faceP - Math.floor(2 * u))));
  for (let x = inset + 4; faceP >= 8 * u && x < W - inset - 4; x += Math.floor(6 * u)) rivet(k, x, H - Math.floor(faceP / 2) + Math.floor(u), c.face);
  for (const [x, y] of [[inset + 2, plinthY + 2], [W - inset - 4, plinthY + 2], [inset + 2, plinthY + topP - 5], [W - inset - 4, plinthY + topP - 5]]) rivet(k, x, y, c.top);
  // Cable que sale de la losa.
  line(k, inset + Math.floor(4 * u), plinthY + topP - 3, 0, plinthY + topP + 1, 1, OL);
  // Pedestal: columna de acero con su rejilla.
  const cx = Math.floor(W / 2);
  const footY = plinthY + Math.floor(topP * 0.55);
  const pedH = Math.max(Math.floor(4 * u), Math.floor(k.F * 0.55));
  const ringY = footY - pedH;
  const pw = Math.floor(8 * u);
  px(cx - pw / 2 - 1, ringY, pw + 2, pedH + 1, OL);
  px(cx - pw / 2, ringY, pw, pedH, c.face);
  px(cx - pw / 2, ringY, Math.max(1, Math.floor(pw / 4)), pedH, shade(c.face, 1.25));
  px(cx + pw / 2 - Math.max(1, Math.floor(pw / 4)), ringY, Math.max(1, Math.floor(pw / 4)), pedH, shade(c.face, 0.7));
  for (let i = 0; i < 3 && ringY + 3 + i * 2 < footY - 1; i++) px(cx - Math.floor(pw / 4), ringY + 3 + i * 2, Math.floor(pw / 2), 1, OL);
  disc(k, cx, footY, Math.floor(pw / 2) + 2, Math.max(1, Math.floor(u * 1.5)), shade(c.dark, 1.1));
  // Corona giratoria.
  disc(k, cx, ringY, Math.floor(9 * u), Math.floor(3 * u), OL);
  disc(k, cx, ringY, Math.floor(8 * u), Math.floor(2 * u), c.dark);
  px(cx - Math.floor(6 * u), ringY - 1, Math.floor(12 * u), 1, shade(c.dark, 1.4));
  // Cabeza.
  const hw = Math.floor((big ? 13 : 12) * u);
  const hh = Math.floor((big ? 8 : 9) * u);
  const hx = cx - Math.floor(hw / 2) - Math.floor(2 * u);
  const hy = Math.max(1, ringY - hh);
  px(hx - 1, hy - 1, hw + 2, hh + 3, OL);
  px(hx, hy, hw, hh + 1, c.face);
  px(hx, hy, hw, Math.floor(hh * 0.45), c.top); // techo de la cabeza
  px(hx, hy, hw, 1, shade(c.top, 1.3));
  px(hx, hy + hh, hw, 1, shade(c.face, 0.6));
  if (big) {
    // Placa delantera inclinada.
    for (let j = 0; j < hh; j++) px(hx + hw, hy + j, Math.floor((j * 4 * u) / hh) + 1, 1, shade(c.face, 0.85));
  }
  // Ojo (sensor) y piloto verde.
  px(hx + Math.floor(2 * u), hy + Math.floor(hh * 0.55), Math.floor(3 * u), Math.floor(2 * u), OL);
  px(hx + Math.floor(2 * u), hy + Math.floor(hh * 0.55), Math.floor(2 * u), 1, '#e0402e');
  px(hx + hw - Math.floor(3 * u), hy + 1, Math.floor(2 * u), 1, '#7fe07a');
  // Arma hacia la derecha.
  const gx = hx + hw + (big ? Math.floor(4 * u) : 0);
  const len = W - gx - 1;
  const gy = hy + Math.floor(hh * 0.5);
  if (kind === 'rotativa') {
    // Haz de cañones con dos anillos y la boca vista de frente.
    px(gx, gy - 4, len, 8, OL);
    for (let i = 0; i < 3; i++) px(gx, gy - 3 + i * 2 + (i > 0 ? 1 : 0), len - 2, 1, i === 1 ? '#4a4d52' : GUN);
    px(gx, gy - 2, len - 2, 1, '#6a6e74');
    for (const t of [0.25, 0.75]) px(gx + Math.floor(len * t), gy - 4, 2, 8, STEEL);
    disc(k, W - 3, gy, 2, 3, '#4a4d52');
    px(W - 3, gy - 1, 1, 1, '#000000');
    px(W - 3, gy + 1, 1, 1, '#000000');
    // Cinta de balas que cuelga hasta el zócalo.
    for (let j = 0; j < 7; j++) {
      const bx = hx - 3 + Math.floor(j / 3);
      const by = hy + hh - 1 + j * 2;
      if (by > H - 5) break;
      px(bx, by, 3, 2, OL);
      px(bx, by, 2, 1, BRASS);
    }
  } else {
    const barrels = big ? [gy - Math.floor(2 * u), gy + Math.floor(2 * u)] : [gy];
    const bw = big ? 4 : 3;
    for (const by of barrels) {
      px(gx, by - 1, len, bw + 1, OL);
      px(gx, by, len - 1, bw - 1, GUN);
      px(gx, by, len - 1, 1, '#5a5e64');
      // Freno de boca (pesada) o punta (ligera).
      px(W - (big ? 7 : 4), by - 2, big ? 5 : 3, bw + 3, OL);
      px(W - (big ? 6 : 3), by - 1, big ? 3 : 2, bw + 1, '#4a4d52');
      if (big) px(W - 5, by - 1, 1, bw + 1, OL);
    }
    // Manguito del cañón.
    px(gx, gy - Math.floor(3 * u), Math.floor(3 * u), Math.floor(6 * u) + 1, shade(c.face, 0.8));
  }
  if (big) {
    // Caja de munición y antena.
    px(hx - Math.floor(5 * u), hy + Math.floor(3 * u), Math.floor(5 * u), Math.floor(5 * u), OL);
    px(hx - Math.floor(5 * u) + 1, hy + Math.floor(3 * u) + 1, Math.floor(5 * u) - 2, Math.floor(5 * u) - 2, '#5a6440');
    px(hx + 2, 0, 1, hy, OL);
    px(hx + 1, 0, 3, 1, '#e0402e');
  }
}
