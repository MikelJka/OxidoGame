// Criaturas y animales a doble resolución con animación (salto de calidad del 2D, pedido por Mikel el
// 2026-10-21): cuadrúpedos con su pelaje sombreado, patas que se mueven al andar, cabeza, orejas,
// cuernos, colmillos y cola; la gallina, el bruto mutante, la araña de chatarra y el dron. Una tira de
// fotogramas de 32×32 por criatura, igual que las personas (`charArt.ts`). Solo dibujo.
import type { CreatureId } from '../data/creatures';

export const BEAST = 32;
export type BeastPose = 'idle0' | 'idle1' | 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'hit0' | 'hit1' | 'down';
export const BEAST_POSES: readonly BeastPose[] = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'hit0', 'hit1', 'down'];

type Px = (x: number, y: number, w: number, h: number, c: string) => void;
const OUT = '#1a1410';

function shade(hex: number, k: number): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f((hex >> 16) & 255)},${f((hex >> 8) & 255)},${f(hex & 255)})`;
}

interface Quad {
  fur: number;
  belly?: number;
  /** Largo y alto del cuerpo, alto de las patas. */
  len: number;
  body: number;
  legs: number;
  head: number;
  feature?: 'astas' | 'colmillos' | 'orejas' | 'cuernos' | 'crin' | 'manchas' | 'dos_cabezas' | 'costillas' | 'alforjas' | 'cola_pelada';
  tailLong?: boolean;
  eye?: string;
}

const QUADS: Partial<Record<CreatureId, Quad>> = {
  perro_mutante: { fur: 0x6a5a4a, belly: 0x8a6a5a, len: 15, body: 6, legs: 5, head: 6, feature: 'costillas', tailLong: true, eye: '#e04020' },
  ciervo_mutado: { fur: 0x8a6a44, belly: 0xb09068, len: 15, body: 7, legs: 7, head: 6, feature: 'astas', eye: '#c8e040' },
  jabali: { fur: 0x5a4a3a, belly: 0x4a3a2c, len: 16, body: 8, legs: 4, head: 7, feature: 'colmillos', eye: '#e0a020' },
  rata_gigante: { fur: 0x6a6260, belly: 0x8a8280, len: 12, body: 5, legs: 3, head: 5, feature: 'cola_pelada', eye: '#e03030' },
  cabra_salvaje: { fur: 0xc8bca4, belly: 0xe0d8c4, len: 13, body: 6, legs: 6, head: 5, feature: 'cuernos', eye: '#c8a020' },
  vaca_dos_cabezas: { fur: 0xe0dcd0, belly: 0xf0ece4, len: 18, body: 8, legs: 6, head: 6, feature: 'dos_cabezas', eye: '#2a2020' },
  caballo_salvaje: { fur: 0x7a4a2a, belly: 0x9a6a4a, len: 17, body: 8, legs: 8, head: 6, feature: 'crin', tailLong: true, eye: '#1a1010' },
  mula: { fur: 0x7a6a5a, belly: 0x9a8a7a, len: 16, body: 7, legs: 7, head: 6, feature: 'alforjas', tailLong: true, eye: '#1a1010' },
};

export function hasBeastArt(id: CreatureId): boolean {
  return !!QUADS[id] || id === 'gallina_mutada' || id === 'bruto_mutante' || id === 'arana_chatarra' || id === 'dron_vigilancia';
}

export function paintBeastSheet(ctx: CanvasRenderingContext2D, id: CreatureId): void {
  BEAST_POSES.forEach((pose, i) => {
    ctx.save();
    ctx.translate(i * BEAST, 0);
    const px: Px = (x, y, w, h, c) => {
      if (w <= 0 || h <= 0) return;
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const q = QUADS[id];
    if (q) quad(px, q, pose);
    else if (id === 'gallina_mutada') hen(px, pose);
    else if (id === 'bruto_mutante') brute(px, pose);
    else if (id === 'arana_chatarra') spider(px, pose);
    else if (id === 'dron_vigilancia') drone(px, pose, i);
    ctx.restore();
  });
}

function groundShadow(px: Px, cx: number, w: number): void {
  px(cx - w / 2, 30, w, 1, 'rgba(0,0,0,0.3)');
  px(cx - w / 2 + 2, 29, w - 4, 1, 'rgba(0,0,0,0.15)');
}

// --- Cuadrúpedos ------------------------------------------------------------------------------------

function quad(px: Px, q: Quad, pose: BeastPose): void {
  const fur = [shade(q.fur, -0.55), shade(q.fur, -0.25), shade(q.fur, 0), shade(q.fur, 0.25)];
  const belly = shade(q.belly ?? q.fur, 0);
  if (pose === 'down') {
    // Tumbado de lado, con las patas recogidas.
    groundShadow(px, 16, q.len + 8);
    const y = 29 - q.body;
    px(16 - q.len / 2 - 1, y - 1, q.len + 2, q.body + 2, OUT);
    px(16 - q.len / 2, y, q.len, q.body, fur[2]);
    px(16 - q.len / 2, y, q.len, 2, fur[3]);
    px(16 - q.len / 2, y + q.body - 2, q.len, 2, fur[1]);
    px(16 + q.len / 2, y + 1, q.head, q.head - 2, OUT);
    px(16 + q.len / 2, y + 2, q.head - 1, q.head - 4, fur[2]);
    px(16 + q.len / 2 + q.head - 3, y + 3, 1, 1, OUT); // ojo cerrado
    return;
  }
  const walk = pose.startsWith('walk') ? Number(pose.slice(4)) : -1;
  const bob = walk === 1 || walk === 3 ? -1 : pose === 'idle1' ? 0 : 0;
  const bodyTop = 30 - q.legs - q.body + bob;
  const x0 = 16 - Math.round(q.len / 2) - 2;
  const x1 = x0 + q.len;
  const lunge = pose === 'hit0' ? 2 : pose === 'hit1' ? -1 : 0;
  groundShadow(px, 16, q.len + 6);
  // Patas: delanteras y traseras, cada par con una adelantada (la de atrás, más oscura).
  const step = walk === 0 ? 2 : walk === 2 ? -2 : 0;
  const legTop = bodyTop + q.body - 1;
  const legAt = (x: number, dx: number, back: boolean) => {
    px(x + dx - 1, legTop, 3, 30 - legTop, OUT);
    px(x + dx, legTop, 1, 29 - legTop, back ? fur[1] : fur[2]);
    px(x + dx - 1, 29, 3, 1, OUT); // pezuña
  };
  legAt(x0 + 3, -step, true);
  legAt(x1 - 3 + lunge, step, true);
  legAt(x0 + 5, step, false);
  legAt(x1 - 1 + lunge, -step, false);
  // Cola.
  if (q.feature === 'cola_pelada') {
    for (let i = 0; i < 7; i++) px(x0 - i, bodyTop + 2 + Math.round(Math.sin(i * 0.8 + (walk + 1)) * 1.5), 1, 1, '#c89a9a');
  } else if (q.tailLong) {
    px(x0 - 3, bodyTop + 1, 3, q.body - 1, OUT);
    px(x0 - 2, bodyTop + 2, 1, q.body - 2, fur[1]);
  } else px(x0 - 2, bodyTop + 1, 2, 2, fur[1]);
  // Cuerpo: contorno, luz en el lomo, sombra en la tripa.
  px(x0 - 1, bodyTop - 1, q.len + 2, q.body + 2, OUT);
  px(x0, bodyTop, q.len, q.body, fur[2]);
  px(x0 + 1, bodyTop, q.len - 2, 2, fur[3]);
  px(x0, bodyTop + q.body - 2, q.len, 2, fur[1]);
  px(x0 + 3, bodyTop + q.body - 1, q.len - 6, 1, belly);
  // Detalles del lomo.
  if (q.feature === 'costillas') for (let x = x0 + 4; x < x1 - 3; x += 2) px(x, bodyTop + 2, 1, q.body - 3, fur[0]);
  if (q.feature === 'manchas' || q.feature === 'dos_cabezas') {
    px(x0 + 3, bodyTop + 1, 4, 3, '#4a3a30');
    px(x0 + 10, bodyTop + 2, 3, 3, '#4a3a30');
  }
  if (q.feature === 'alforjas') {
    px(x0 + 4, bodyTop - 1, 7, q.body, '#5a3a1a');
    px(x0 + 4, bodyTop - 1, 7, 1, '#8a6030');
    px(x0 + 7, bodyTop + 1, 1, q.body - 3, '#3a2210');
  }
  if (q.feature === 'colmillos') for (let x = x0 + 1; x < x1 - 1; x += 2) px(x, bodyTop - 2, 1, 2, fur[0]); // cerdas
  // Cuello y cabeza al frente (con la embestida, más adelante).
  const hx = x1 - 1 + lunge;
  const hy = bodyTop - Math.round(q.head / 2) + (pose === 'hit1' ? 2 : 0);
  if (q.feature === 'crin') {
    px(hx - 2, hy - 1, 3, q.head + 2, OUT);
    px(hx - 1, hy, 2, q.head + 1, fur[0]);
  }
  head(px, q, fur, hx, hy);
  if (q.feature === 'dos_cabezas') head(px, q, fur, hx + 1, hy + q.head - 1);
}

function head(px: Px, q: Quad, fur: string[], hx: number, hy: number): void {
  const s = q.head;
  px(hx - 1, hy - 1, s + 2, s + 1, OUT);
  px(hx, hy, s, s - 1, fur[2]);
  px(hx, hy, s, 1, fur[3]);
  px(hx + s - 2, hy + s - 3, 3, 2, OUT); // hocico
  px(hx + s - 2, hy + s - 3, 2, 1, fur[1]);
  px(hx + s - 3, hy + 1, 1, 1, q.eye ?? OUT);
  switch (q.feature) {
    case 'astas':
      for (const [x, y] of [[1, -1], [1, -2], [0, -3], [2, -3], [2, -4], [-1, -4], [3, -5], [1, -5]] as const) px(hx + x, hy + y, 1, 1, '#d8c8a0');
      break;
    case 'colmillos':
      px(hx + s, hy + s - 3, 1, 2, '#f0e8d0');
      break;
    case 'cuernos':
      px(hx, hy - 2, 1, 2, '#8a7a5a');
      px(hx - 1, hy - 3, 1, 2, '#8a7a5a');
      px(hx + s - 2, hy + s - 1, 2, 1, '#e8e0d0'); // barba
      break;
    case 'dos_cabezas':
      px(hx, hy - 1, 1, 1, '#e8e0c8');
      px(hx + 3, hy - 1, 1, 1, '#e8e0c8');
      break;
    default:
      px(hx + 1, hy - 2, 1, 2, fur[1]); // orejas
      px(hx + 3, hy - 2, 1, 2, fur[1]);
  }
}

// --- Gallina mutada ---------------------------------------------------------------------------------

function hen(px: Px, pose: BeastPose): void {
  const walk = pose.startsWith('walk') ? Number(pose.slice(4)) : -1;
  const peck = pose === 'idle1' || pose === 'hit1';
  groundShadow(px, 16, 12);
  if (pose === 'down') {
    px(10, 24, 12, 6, OUT);
    px(11, 25, 10, 4, '#b07a48');
    return;
  }
  const step = walk === 0 ? 1 : walk === 2 ? -1 : 0;
  px(14 + step, 26, 1, 4, '#d8a030');
  px(18 - step, 26, 1, 4, '#d8a030');
  px(9, 18, 13, 9, OUT);
  px(10, 19, 11, 7, '#b07a48');
  px(10, 19, 11, 2, '#d09a68');
  px(11, 22, 6, 3, '#8a5a30'); // ala
  px(7, 16, 4, 6, OUT); // cola
  px(8, 17, 2, 4, '#5a3a20');
  const hy = peck ? 18 : 12;
  px(19, hy, 6, 7, OUT);
  px(20, hy + 1, 4, 5, '#b07a48');
  px(22, hy + 2, 1, 1, '#1a1010');
  px(25, hy + 3, 2, 1, '#e8b030');
  px(20, hy - 2, 1, 2, '#d83a2a'); // cresta doble
  px(22, hy - 3, 1, 3, '#d83a2a');
  px(23, hy - 2, 1, 2, '#d83a2a');
  px(24, hy + 5, 1, 2, '#d83a2a');
}

// --- Bruto mutante: enorme, encorvado, brazos largos y piel llena de bultos ---------------------------

function brute(px: Px, pose: BeastPose): void {
  const skin = ['#3a3a28', '#5a5a3a', '#7a7a4a', '#9a9a62'];
  groundShadow(px, 16, 22);
  if (pose === 'down') {
    px(3, 21, 26, 9, OUT);
    px(4, 22, 24, 7, skin[2]);
    px(4, 22, 24, 2, skin[3]);
    return;
  }
  const walk = pose.startsWith('walk') ? Number(pose.slice(4)) : -1;
  const step = walk === 0 ? 2 : walk === 2 ? -2 : 0;
  const smash = pose === 'hit0' ? -6 : pose === 'hit1' ? 3 : 0;
  // Piernas cortas y gruesas.
  px(9 - step, 23, 6, 7, OUT);
  px(10 - step, 23, 4, 6, skin[1]);
  px(17 + step, 23, 6, 7, OUT);
  px(18 + step, 23, 4, 6, skin[2]);
  // Torso enorme y encorvado.
  px(6, 9, 21, 16, OUT);
  px(7, 10, 19, 14, skin[2]);
  px(7, 10, 12, 4, skin[3]);
  px(20, 12, 6, 12, skin[1]);
  for (const [x, y] of [[10, 15], [15, 18], [21, 14], [12, 20]] as const) {
    px(x, y, 2, 2, skin[1]); // bultos
    px(x, y, 1, 1, skin[3]);
  }
  px(8, 22, 18, 3, '#4a3a2a'); // taparrabos
  // Brazo de atrás y brazo que golpea.
  px(5, 12, 4, 13, OUT);
  px(6, 13, 2, 11, skin[1]);
  px(23, 12 + smash, 6, 14, OUT);
  px(24, 13 + smash, 4, 12, skin[2]);
  px(23, 24 + smash, 6, 4, skin[1]); // puño
  // Cabeza pequeña hundida entre los hombros.
  px(15, 4, 9, 8, OUT);
  px(16, 5, 7, 6, skin[2]);
  px(16, 5, 7, 1, skin[3]);
  px(20, 7, 2, 1, '#ff3a1a');
  px(19, 10, 4, 1, '#2a1a10'); // boca
  px(20, 10, 1, 1, '#e8e0c8');
}

// --- Araña de chatarra: cuerpo de chapa, ocho patas articuladas y ojo rojo ---------------------------

function spider(px: Px, pose: BeastPose): void {
  const plate = ['#2a2e32', '#4a4e54', '#6a6e74', '#9aa0a6'];
  groundShadow(px, 16, 26);
  if (pose === 'down') {
    px(8, 22, 16, 8, OUT);
    px(9, 23, 14, 6, plate[1]);
    for (const x of [4, 10, 20, 26]) px(x, 27, 3, 2, plate[0]);
    return;
  }
  const walk = pose.startsWith('walk') ? Number(pose.slice(4)) : 0;
  // Patas: cuatro a cada lado, alternándose.
  for (let k = 0; k < 4; k++) {
    const up = (k + walk) % 2 ? -2 : 0;
    const bx = 9 + k * 4;
    for (const side of [-1, 1]) {
      const fx = 16 + side * (8 + k * 2);
      px(Math.min(bx, fx), 18 + up, Math.abs(fx - bx) + 1, 1, plate[0]);
      px(fx, 18 + up, 1, 12 - up, plate[side < 0 ? 0 : 1]);
      px(fx, 29, 1, 1, plate[3]);
    }
  }
  // Cuerpo.
  px(8, 13, 17, 10, OUT);
  px(9, 14, 15, 8, plate[2]);
  px(9, 14, 15, 2, plate[3]);
  px(9, 20, 15, 2, plate[1]);
  for (const x of [11, 16, 21]) px(x, 16, 1, 1, plate[3]); // remaches
  // Cabeza con el ojo rojo (brilla al atacar).
  px(22, 15, 6, 6, OUT);
  px(23, 16, 4, 4, plate[1]);
  px(25, 17, 2, 2, pose === 'hit0' ? '#ffa080' : '#ff2a1a');
  px(14, 9, 1, 4, OUT); // antena
  px(14, 8, 1, 1, '#ff2a1a');
}

// --- Dron: cuatro rotores que giran (cambian de forma en cada fotograma) y su cámara ---------------------

function drone(px: Px, pose: BeastPose, frame: number): void {
  const plate = ['#2e3236', '#4a4e54', '#8a9098', '#c0c6cc'];
  px(10, 30, 12, 1, 'rgba(0,0,0,0.25)'); // sombra lejos, en el suelo
  if (pose === 'down') {
    px(8, 24, 16, 6, OUT);
    px(9, 25, 14, 4, plate[1]);
    px(20, 26, 2, 2, '#4a1010');
    return;
  }
  const hover = frame % 2 ? -1 : 0;
  px(5, 9 + hover, 22, 1, OUT);
  px(5, 15 + hover, 22, 1, OUT);
  for (const [x, y] of [[2, 7], [21, 7], [2, 13], [21, 13]] as const) {
    const wide = frame % 2 === 0;
    px(x, y + hover, wide ? 9 : 5, 1, 'rgba(210,220,230,0.6)');
    px(x + (wide ? 4 : 2), y - 1 + hover, 1, 3, plate[0]);
  }
  px(10, 8 + hover, 12, 10, OUT);
  px(11, 9 + hover, 10, 8, plate[2]);
  px(11, 9 + hover, 10, 2, plate[3]);
  px(15, 17 + hover, 3, 3, OUT); // cañón
  px(18, 12 + hover, 3, 3, '#1a0a0a');
  px(19, 13 + hover, 1, 1, pose === 'hit0' ? '#ffe080' : '#ff2a1a');
}
