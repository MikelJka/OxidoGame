// Personas a doble resolución (salto de calidad del 2D, pedido por Mikel el 2026-10-21): cada persona
// es una tira de fotogramas de 32×32 (se dibuja a la mitad, así que con zoom se ve el doble de
// detalle) con sombreado de tres tonos, contorno de color, cara, peinados, ropa, chalecos, cascos y el
// arma en la mano; y animaciones de estar quieto (respira), andar, trabajar, pelear y caído.
// Solo dibujo: lee el aspecto de la persona y no decide nada del juego.
import type { Colonist } from '../sim/colonist';

export const CHAR = 32;

export type CharPose = 'idle0' | 'idle1' | 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'work0' | 'work1' | 'hit0' | 'hit1' | 'down';
export const CHAR_POSES: readonly CharPose[] = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'work0', 'work1', 'hit0', 'hit1', 'down'];

// --- Color ----------------------------------------------------------------------------------------

function rgbOf(n: number): [number, number, number] {
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Aclara (k > 0) u oscurece (k < 0) y tira un poco hacia el cálido o el frío, como la luz y la sombra. */
function tone(n: number, k: number): string {
  const [r, g, b] = rgbOf(n);
  const f = (v: number, warm: number) => Math.round(Math.max(0, Math.min(255, k >= 0 ? v + (255 - v) * k + warm * k * 18 : v * (1 + k) + warm * k * 10)));
  // En luz, algo más amarillo; en sombra, algo más azul.
  return `rgb(${f(r, 1)},${f(g, 0.6)},${f(b, -1)})`;
}

/** Rampa de cuatro tonos: sombra profunda, sombra, base y luz. */
function ramp(n: number): [string, string, string, string] {
  return [tone(n, -0.55), tone(n, -0.25), tone(n, 0), tone(n, 0.28)];
}

function hash(n: number): number {
  let x = (n * 0x45d9f3b) >>> 0;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  return ((x >>> 16) ^ x) >>> 0;
}

const PANTS = [0x3a4a6a, 0x6a5a3a, 0x3e3e40, 0x5a3e2a, 0x4a5a3a];
const OUTLINE = '#1c1612';

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

interface Look {
  skin: number;
  hair: number;
  shirt: number;
  pants: number;
  style: number;
  beard: boolean;
  role: Colonist['role'];
  leader: boolean;
  weapon: string | null;
  vest: string | null;
  helmet: string | null;
}

function lookOf(c: Colonist): Look {
  const h = hash(c.id * 7 + (c.look.hair & 255));
  return {
    skin: c.look.skin,
    hair: c.look.hair,
    shirt: c.look.shirt,
    pants: PANTS[h % PANTS.length],
    style: (h >>> 3) % 6,
    beard: ((h >>> 7) % 4 === 0) && c.role !== 'prisionero',
    role: c.role,
    leader: !!c.raider?.leader,
    weapon: c.weapon ?? null,
    vest: c.vest ?? null,
    helmet: c.helmet ?? null,
  };
}

/** Clave de la tira de fotogramas: cambia si cambia lo que se ve. */
export function charKey(c: Colonist): string {
  const l = lookOf(c);
  return `p2-${c.id}-${l.role}-${c.look.shirt}-${c.look.hair}-${c.look.skin}-${l.weapon}-${l.vest}-${l.helmet}${l.leader ? '-L' : ''}`;
}

/** Dibuja la tira de fotogramas (CHAR_POSES.length × 32 de ancho, 32 de alto). */
export function paintCharSheet(ctx: CanvasRenderingContext2D, c: Colonist): void {
  const look = lookOf(c);
  CHAR_POSES.forEach((pose, i) => {
    ctx.save();
    ctx.translate(i * CHAR, 0);
    const px: Px = (x, y, w, h, color) => {
      if (w <= 0 || h <= 0) return;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    if (pose === 'down') paintDown(px, look);
    else paintStanding(px, look, pose);
    ctx.restore();
  });
}

// --- De pie -----------------------------------------------------------------------------------------

function paintStanding(px: Px, l: Look, pose: CharPose): void {
  const walk = pose.startsWith('walk') ? Number(pose.slice(4)) : -1;
  const idleUp = pose === 'idle1' ? 1 : 0;
  // El cuerpo sube un pelo en los pasos con las piernas juntas.
  const lift = walk === 1 || walk === 3 ? 1 : 0;
  const dy = -lift;
  // Sombra suave en el suelo (más pequeña al levantar el cuerpo).
  px(9, 30, 14, 1, 'rgba(0,0,0,0.28)');
  px(11, 29, 10, 1, 'rgba(0,0,0,0.18)');
  px(10, 31, 12, 1, 'rgba(0,0,0,0.12)');
  const skin = ramp(l.skin);
  const prisoner = l.role === 'prisionero';
  const shirt = ramp(prisoner ? 0xd9822b : l.shirt);
  const pants = ramp(prisoner ? 0xc8701f : l.pants);
  const boots = ramp(0x4a3424);

  // Piernas: separadas según el paso (la de delante es la de la derecha del dibujo).
  const stride = walk === 0 ? 2 : walk === 2 ? -2 : 0;
  leg(px, 13 - stride, 23 + dy, pants, boots, true);
  leg(px, 17 + stride, 23 + dy, pants, boots, false);

  // Brazo de atrás (más oscuro), detrás del torso; se balancea al andar.
  const swing = walk === 0 ? -2 : walk === 2 ? 2 : 0;
  const working = pose === 'work0' || pose === 'work1' || pose === 'hit0' || pose === 'hit1';
  px(11 + swing / 2, 15 + dy, 3, 7, OUTLINE);
  px(12 + swing / 2, 16 + dy, 1, 5, shirt[0]);
  px(12 + swing / 2, 21 + dy, 2, 2, skin[1]);

  // Torso: camisa con luz arriba a la izquierda y sombra abajo a la derecha.
  const ty = 14 + dy - idleUp;
  px(12, ty, 9, 10 + idleUp, OUTLINE);
  px(13, ty + 1, 7, 8 + idleUp, shirt[2]);
  px(13, ty + 1, 7, 1, shirt[3]);
  px(13, ty + 2, 2, 5, shirt[3]);
  px(18, ty + 2, 2, 7 + idleUp, shirt[1]);
  px(13, ty + 7 + idleUp, 7, 1, shirt[1]);
  // Cuello de la camisa y botones (o la cremallera del mono naranja).
  px(15, ty + 1, 3, 1, shirt[1]);
  px(16, ty + 3, 1, 1, shirt[0]);
  px(16, ty + 5, 1, 1, shirt[0]);
  // Cinturón con hebilla.
  px(13, ty + 8 + idleUp, 7, 1, prisoner ? shirt[0] : '#2a1e14');
  px(16, ty + 8 + idleUp, 1, 1, prisoner ? shirt[0] : '#b8a060');

  // Chaleco encima de la camisa.
  if (l.vest) vest(px, l.vest, ty, idleUp);

  // Pañuelo, mochila, brazalete… según quién es.
  if (l.role === 'comerciante') {
    // Mochila grande a la espalda.
    px(8, ty - 1, 5, 9, OUTLINE);
    px(9, ty, 3, 7, '#7a5a32');
    px(9, ty, 3, 1, '#9a7a4a');
    px(9, ty + 3, 3, 1, '#5a3f22');
  }
  if (l.role === 'aliado') px(19, ty + 2, 1, 3, '#3a7ac0');
  if (l.role === 'prisionero') px(18, ty + 6, 3, 1, '#9aa0a8'); // grilletes

  // Cabeza.
  head(px, l, dy - idleUp);

  // Brazo de delante y lo que lleva en la mano.
  if (working) frontArmWork(px, l, pose, dy, skin, shirt);
  else {
    const hx = 19 - swing / 2;
    px(hx - 1, 15 + dy, 3, 7, OUTLINE);
    px(hx, 16 + dy, 1, 5, shirt[2]);
    px(hx, 16 + dy, 1, 1, shirt[3]);
    px(hx, 21 + dy, 2, 2, skin[2]);
    if (l.weapon) heldWeapon(px, l.weapon, hx + 1, 21 + dy, false);
  }

  // El líder del raid: estrella dorada encima.
  if (l.leader) {
    px(24, 1, 1, 5, '#f0c030');
    px(22, 3, 5, 1, '#f0c030');
    px(23, 2, 3, 3, '#f8d860');
  }
}

function leg(px: Px, x: number, y: number, pants: string[], boots: string[], back: boolean): void {
  px(x - 1, y, 4, 6, OUTLINE);
  px(x, y, 2, 5, back ? pants[1] : pants[2]);
  if (!back) px(x, y, 1, 4, pants[3]);
  // Bota, un poco hacia delante.
  px(x - 1, y + 5, 5, 3, OUTLINE);
  px(x, y + 5, 3, 2, back ? boots[1] : boots[2]);
  px(x, y + 5, 3, 1, boots[3]);
}

function head(px: Px, l: Look, dy: number): void {
  const skin = ramp(l.skin);
  const hair = ramp(l.hair);
  const y = 5 + dy;
  // Pelo largo por detrás (antes que la cara).
  if (l.style === 1) {
    px(11, y + 2, 4, 9, OUTLINE);
    px(12, y + 3, 2, 7, hair[1]);
  }
  if (l.style === 3) {
    // Coleta.
    px(10, y + 3, 3, 6, OUTLINE);
    px(11, y + 4, 1, 4, hair[2]);
  }
  // Cara: contorno, piel con luz y sombra, oreja, ojo, ceja, nariz y boca.
  px(12, y, 9, 10, OUTLINE);
  px(13, y + 1, 7, 8, skin[2]);
  px(13, y + 1, 2, 6, skin[3]);
  px(19, y + 2, 1, 7, skin[1]);
  px(13, y + 8, 7, 1, skin[1]);
  px(13, y + 5, 2, 2, skin[1]); // oreja
  px(14, y + 5, 1, 1, skin[0]);
  px(17, y + 4, 2, 1, '#f4f0e8'); // blanco del ojo
  px(18, y + 4, 1, 1, '#1e1a18'); // pupila mirando a la derecha
  px(17, y + 3, 2, 1, hair[0]); // ceja
  px(20, y + 5, 1, 2, skin[1]); // nariz
  px(17, y + 7, 2, 1, skin[0]); // boca
  if (l.beard) {
    px(15, y + 6, 5, 3, hair[1]);
    px(16, y + 9, 3, 1, OUTLINE);
    px(16, y + 9, 3, 1, hair[0]);
    px(17, y + 7, 2, 1, skin[0]);
  }
  // Peinados.
  switch (l.style) {
    case 0: // corto
    case 1: // largo
    case 3: // coleta
      px(12, y - 1, 9, 3, OUTLINE);
      px(13, y, 7, 2, hair[2]);
      px(13, y, 4, 1, hair[3]);
      px(13, y + 2, 2, 3, hair[1]);
      px(19, y + 1, 1, 1, hair[1]);
      break;
    case 2: // rapado, con barba de días
      px(13, y + 1, 7, 1, hair[1]);
      px(13, y, 7, 1, OUTLINE);
      break;
    case 4: // cresta
      px(14, y - 3, 4, 4, OUTLINE);
      px(15, y - 2, 2, 3, hair[2]);
      px(15, y - 2, 1, 2, hair[3]);
      px(13, y + 1, 7, 1, hair[0]);
      break;
    case 5: // gorro de lana
      px(12, y - 2, 9, 5, OUTLINE);
      px(13, y - 1, 7, 3, tone(l.shirt, -0.35));
      px(13, y - 1, 3, 1, tone(l.shirt, -0.1));
      px(13, y + 1, 7, 1, tone(l.shirt, -0.5));
      break;
  }
  // Casco encima del pelo.
  if (l.helmet) {
    const c = l.helmet === 'casco_chapa' ? 0x9a5a30 : l.helmet === 'casco_tactico' ? 0x5a6440 : 0x7a8088;
    const h = ramp(c);
    px(11, y - 2, 11, 5, OUTLINE);
    px(12, y - 1, 9, 3, h[2]);
    px(12, y - 1, 4, 1, h[3]);
    px(12, y + 2, 10, 1, h[0]);
    if (l.helmet === 'casco_chapa') px(17, y, 1, 1, '#5a2a14');
    if (l.helmet === 'casco_tactico') px(19, y, 2, 1, '#2a3020');
  }
  // Pañuelo de los saqueadores (rojo) tapando la boca, o el de los aliados (azul) al cuello.
  if (l.role === 'saqueador') {
    px(13, y + 6, 8, 3, '#8a1e14');
    px(13, y + 6, 8, 1, '#c03424');
    px(12, y + 7, 1, 3, '#8a1e14'); // nudo
    px(17, y + 4, 2, 1, '#f0e0d0'); // mirada que destaca
    px(18, y + 4, 1, 1, '#2a0a06');
  }
  if (l.role === 'aliado') {
    px(13, y + 9, 7, 2, '#2a5a9a');
    px(13, y + 9, 7, 1, '#4a8ad0');
  }
  if (l.role === 'comerciante') {
    // Sombrero de ala ancha.
    px(9, y - 1, 15, 2, OUTLINE);
    px(10, y - 1, 13, 1, '#7a5a32');
    px(12, y - 4, 9, 4, OUTLINE);
    px(13, y - 3, 7, 3, '#8a6a3a');
    px(13, y - 1, 7, 1, '#4a3018');
  }
}

function vest(px: Px, kind: string, ty: number, up: number): void {
  const base = kind === 'chaleco_cuero' ? 0x7a5634 : kind === 'chaleco_chapa' ? 0x9a5a30 : kind === 'chaleco_tactico' ? 0x5a6440 : 0x7a8088;
  const v = ramp(base);
  px(13, ty + 1, 7, 7 + up, v[2]);
  px(13, ty + 1, 7, 1, v[3]);
  px(18, ty + 2, 2, 6 + up, v[1]);
  px(15, ty + 1, 2, 2, v[0]); // escote
  if (kind === 'chaleco_chapa' || kind === 'chaleco_metal') {
    px(14, ty + 3, 1, 1, v[3]); // remaches
    px(18, ty + 3, 1, 1, v[3]);
    px(14, ty + 6, 5, 1, v[0]); // junta de las placas
  } else if (kind === 'chaleco_tactico') {
    px(14, ty + 4, 2, 2, v[0]); // bolsillos
    px(17, ty + 4, 2, 2, v[0]);
  } else {
    px(14, ty + 2, 1, 5, v[1]); // costura
  }
}

/** Brazo de delante trabajando (golpe con la herramienta) o peleando (con su arma). */
function frontArmWork(px: Px, l: Look, pose: CharPose, dy: number, skin: string[], shirt: string[]): void {
  const fighting = pose === 'hit0' || pose === 'hit1';
  const up = pose === 'work0' || pose === 'hit0';
  const gun = !!l.weapon && isGun(l.weapon);
  if (fighting && gun) {
    // Apunta al frente; en el segundo fotograma, el fogonazo.
    px(18, 15 + dy, 6, 3, OUTLINE);
    px(19, 16 + dy, 4, 1, shirt[2]);
    px(23, 16 + dy, 2, 2, skin[2]);
    heldWeapon(px, l.weapon!, 24, 17 + dy, true);
    if (!up) {
      px(31, 15 + dy, 1, 3, '#ffe080');
      px(30, 16 + dy, 2, 1, '#fff4c0');
    }
    return;
  }
  if (up) {
    // Brazo arriba, a punto de golpear.
    px(18, 9 + dy, 3, 8, OUTLINE);
    px(19, 10 + dy, 1, 6, shirt[2]);
    px(19, 8 + dy, 2, 2, skin[2]);
    if (fighting && l.weapon) heldWeapon(px, l.weapon, 20, 8 + dy, false, true);
    else tool(px, 20, 8 + dy, true);
  } else {
    // Golpe abajo y adelante.
    px(18, 15 + dy, 6, 3, OUTLINE);
    px(19, 16 + dy, 4, 1, shirt[2]);
    px(23, 17 + dy, 2, 2, skin[2]);
    if (fighting && l.weapon) heldWeapon(px, l.weapon, 24, 18 + dy, true);
    else tool(px, 24, 18 + dy, false);
  }
}

/** Martillo genérico del trabajo (construir, minar, talar…). */
function tool(px: Px, x: number, y: number, raised: boolean): void {
  if (raised) {
    px(x, y - 7, 1, 8, '#6a4a2a');
    px(x - 2, y - 9, 5, 3, '#5c5a56');
    px(x - 2, y - 9, 5, 1, '#9a9890');
  } else {
    px(x, y, 6, 1, '#6a4a2a');
    px(x + 5, y - 2, 3, 5, '#5c5a56');
    px(x + 5, y - 2, 1, 5, '#9a9890');
  }
}

function isGun(w: string): boolean {
  return ['pistola', 'escopeta', 'rifle', 'subfusil', 'francotirador', 'lanzallamas', 'arco', 'ballesta'].includes(w);
}

/** El arma en la mano (x, y: la mano). `forward`: apuntando al frente; `raised`: levantada para golpear. */
function heldWeapon(px: Px, w: string, x: number, y: number, forward: boolean, raised = false): void {
  const metal = '#6e6c66';
  const dark = '#3a3834';
  const wood = '#7a5634';
  if (raised) {
    // Arma blanca levantada (vertical sobre la mano).
    const len = w === 'lanza' || w === 'lanza_metal' ? 12 : w === 'palo' || w === 'tuberia' ? 9 : 7;
    px(x, y - len, 1, len, w === 'tuberia' ? metal : w === 'lanza_metal' ? '#8a8c88' : wood);
    if (w === 'cuchillo' || w === 'machete') px(x, y - len, 1, len - 2, '#c8ccd0');
    if (w === 'lanza' || w === 'lanza_metal') px(x - 1, y - len - 2, 3, 3, '#b4b8bc');
    return;
  }
  switch (w) {
    case 'palo':
      px(x, y - 6, 1, 8, wood);
      px(x, y - 6, 1, 2, '#9a7650');
      break;
    case 'tuberia':
      px(x, y - 6, 2, 8, metal);
      px(x, y - 6, 1, 8, '#8a8880');
      break;
    case 'cuchillo':
      px(x + 1, y, 4, 1, '#c8ccd0');
      px(x, y, 1, 1, dark);
      break;
    case 'machete':
      px(x + 1, y - 1, 6, 2, '#b8bcc0');
      px(x + 1, y - 1, 6, 1, '#e0e4e8');
      px(x, y, 1, 1, dark);
      break;
    case 'lanza':
    case 'lanza_metal':
      px(x, y - 12, 1, 16, w === 'lanza' ? wood : '#8a8c88');
      px(x - 1, y - 15, 3, 3, '#b4b8bc');
      px(x, y - 16, 1, 1, '#e0e4e8');
      break;
    case 'arco':
      px(x + 1, y - 6, 1, 13, wood);
      px(x + 2, y - 7, 1, 2, wood);
      px(x + 2, y + 6, 1, 2, wood);
      px(x, y - 5, 1, 11, '#d8d0b8');
      break;
    case 'ballesta':
      px(x, y, 7, 2, wood);
      px(x + 5, y - 3, 1, 8, '#4a3a2a');
      break;
    case 'pistola':
      px(x, y - 1, 5, 2, dark);
      px(x, y - 1, 5, 1, metal);
      px(x, y + 1, 2, 2, '#3a2a1a');
      break;
    case 'escopeta':
      px(x - 3, y, 3, 2, wood);
      px(x, y - 1, 8, 2, dark);
      px(x, y - 1, 8, 1, metal);
      break;
    case 'rifle':
    case 'francotirador':
      px(x - 4, y, 4, 2, wood);
      px(x, y - 1, w === 'francotirador' ? 11 : 9, 1, dark);
      px(x, y, 5, 1, wood);
      if (w === 'francotirador') px(x + 2, y - 3, 4, 2, '#2a2826');
      break;
    case 'subfusil':
      px(x - 2, y - 1, 7, 2, dark);
      px(x - 2, y - 1, 7, 1, metal);
      px(x + 1, y + 1, 1, 3, '#2a2826');
      break;
    case 'lanzallamas':
      px(x - 1, y - 1, 8, 2, '#5c5a56');
      px(x + 7, y - 2, 1, 3, '#2e2c28');
      px(x + 8, y - 1, 1, 1, '#f0a020');
      break;
    default:
      if (!forward) px(x, y - 4, 1, 6, wood);
  }
}

// --- Caído o durmiendo (tumbado de lado) --------------------------------------------------------

function paintDown(px: Px, l: Look): void {
  const skin = ramp(l.skin);
  const hair = ramp(l.hair);
  const prisoner = l.role === 'prisionero';
  const shirt = ramp(prisoner ? 0xd9822b : l.shirt);
  const pants = ramp(prisoner ? 0xc8701f : l.pants);
  px(4, 29, 25, 2, 'rgba(0,0,0,0.28)');
  // Piernas.
  px(20, 23, 9, 6, OUTLINE);
  px(21, 24, 7, 2, pants[2]);
  px(21, 26, 7, 2, pants[1]);
  px(27, 23, 3, 6, '#3a2818');
  // Torso.
  px(11, 21, 10, 8, OUTLINE);
  px(12, 22, 8, 6, shirt[2]);
  px(12, 22, 8, 2, shirt[3]);
  px(12, 26, 8, 2, shirt[1]);
  if (l.vest) px(13, 22, 6, 5, tone(l.vest === 'chaleco_cuero' ? 0x7a5634 : 0x7a8088, 0));
  // Brazo.
  px(13, 27, 7, 2, skin[1]);
  // Cabeza de lado, ojos cerrados.
  px(3, 21, 9, 8, OUTLINE);
  px(4, 22, 7, 6, skin[2]);
  px(4, 22, 7, 2, skin[3]);
  px(4, 21, 7, 2, hair[2]);
  px(3, 22, 2, 5, hair[1]);
  px(8, 25, 2, 1, skin[0]); // ojo cerrado
  if (l.role === 'saqueador') px(5, 26, 6, 2, '#8a1e14');
}
