// Objetos altos del mapa a doble resolución (salto de calidad del 2D, pedido por Mikel el 2026-10-21):
// árboles secos, matorrales, tocones, rocas, chatarra, coches, ruinas, bidones y neumáticos. Cada uno
// tiene 4 variantes en un único atlas (una sola textura: se dibujan todos de una vez) y se colocan como
// sprites, ordenados con las personas. Los objetos planos (piedras, charcos, huesos…) siguen en el suelo.
// Solo dibujo: no decide nada del juego.
import type { FoliageStage } from '../data/seasons';
import { Prop } from '../sim/map';
import { Rng } from '../sim/rng';

/** Tamaño de cada fotograma del atlas (a doble resolución: se dibuja a la mitad). */
export const PROP_W = 32;
export const PROP_H = 64;
/** Fila del fotograma que cae en el pie de la casilla. */
export const PROP_BASE = 60;
export const PROP_VARIANTS = 4;

/** Objetos que se dibujan como sprite (los demás, planos, van pintados en el suelo). */
export const TALL_PROPS: readonly Prop[] = [Prop.DeadTree, Prop.Stump, Prop.Bush, Prop.Boulder, Prop.ScrapPile, Prop.CarWreck, Prop.RuinWall, Prop.ToxicBarrel, Prop.Tires];

export function isTallProp(p: Prop): boolean {
  return TALL_PROPS.includes(p);
}

/** Árboles y matorrales: cambian de hojas con las estaciones. */
export const FOLIAGE_PROPS: readonly Prop[] = [Prop.DeadTree, Prop.Bush];
export const FOLIAGE_STAGES: readonly FoliageStage[] = ['desnudo', 'brotes', 'verde', 'otono', 'cayendo'];

/** Aspectos de un objeto: con hojas de cada estación (si tiene) y con nieve encima o sin ella. */
function looksOf(p: Prop): { stage: FoliageStage | null; snow: boolean }[] {
  const stages: (FoliageStage | null)[] = FOLIAGE_PROPS.includes(p) ? [...FOLIAGE_STAGES] : [null];
  return stages.flatMap((stage) => [false, true].map((snow) => ({ stage, snow })));
}

/** Columnas del atlas (la fila más ancha). */
export const PROP_ATLAS_COLS = Math.max(...TALL_PROPS.map((p) => looksOf(p).length)) * PROP_VARIANTS;

export function propFrame(p: Prop, variant: number, stage: FoliageStage | null = null, snow = false): string {
  const st = FOLIAGE_PROPS.includes(p) ? (stage ?? 'verde') : 'x';
  return `${p}-${variant}-${st}-${snow ? 1 : 0}`;
}

/** Variante (0–3) del objeto de una casilla: siempre la misma para esa casilla. */
export function propVariant(seed: number, x: number, y: number): number {
  return ((seed ^ Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0) % PROP_VARIANTS;
}

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

/** Dibuja el atlas completo: una fila por objeto alto y una columna por variante. */
export function paintPropAtlas(ctx: CanvasRenderingContext2D): { frame: string; x: number; y: number }[] {
  const frames: { frame: string; x: number; y: number }[] = [];
  TALL_PROPS.forEach((p, row) => {
    const looks = looksOf(p);
    for (let k = 0; k < looks.length * PROP_VARIANTS; k++) {
      const v = k % PROP_VARIANTS;
      const look = looks[Math.floor(k / PROP_VARIANTS)];
      const ox = k * PROP_W;
      const oy = row * PROP_H;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, PROP_W, PROP_H);
      ctx.clip();
      const px: Px = (x, y, w, h, c) => {
        if (w <= 0 || h <= 0) return;
        ctx.fillStyle = c;
        ctx.fillRect(ox + Math.round(x), oy + Math.round(y), Math.round(w), Math.round(h));
      };
      // El mismo azar en todas las estaciones: la planta tiene la misma forma todo el año.
      paintProp(px, ctx, ox, oy, p, new Rng(0x51ed27 + p * 977 + v * 131), look.stage ?? 'verde');
      ctx.restore();
      if (look.snow) addSnow(ctx, ox, oy);
      frames.push({ frame: propFrame(p, v, look.stage, look.snow), x: ox, y: oy });
    }
  });
  return frames;
}

/** Sombra suave en el suelo (elipse por franjas). */
function shadow(px: Px, cx: number, w: number, y = PROP_BASE - 3): void {
  for (let i = 0; i < 4; i++) {
    const ww = w - i * 3;
    px(cx - ww / 2 + 2, y + i - 1, ww, 1, `rgba(10,8,6,${0.1 + i * 0.06})`);
  }
}

/** Nieve encima de todo lo que mira al cielo: los píxeles con aire justo encima se vuelven blancos. */
function addSnow(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  const img = ctx.getImageData(ox, oy, PROP_W, PROP_H);
  const d = img.data;
  const solid = (x: number, y: number) => y >= 0 && d[(y * PROP_W + x) * 4 + 3] > 200;
  const shadowRow = PROP_BASE - 5; // la sombra del suelo no lleva nieve
  for (let x = 0; x < PROP_W; x++) {
    let depth = 0;
    for (let y = 0; y < shadowRow; y++) {
      if (!solid(x, y)) {
        depth = 0;
        continue;
      }
      // Hasta 2 píxeles de nieve bajo cada borde de arriba (1 en los bordes muy inclinados).
      const flat = solid(x - 1, y) && solid(x + 1, y);
      if (depth < (flat ? 2 : 0)) {
        const o = (y * PROP_W + x) * 4;
        const shade = depth === 0 ? 248 : 222;
        d[o] = shade;
        d[o + 1] = shade + 2;
        d[o + 2] = Math.min(255, shade + 8);
      }
      depth++;
    }
  }
  ctx.putImageData(img, ox, oy);
}

function paintProp(px: Px, ctx: CanvasRenderingContext2D, ox: number, oy: number, p: Prop, rng: Rng, stage: FoliageStage): void {
  switch (p) {
    case Prop.DeadTree:
      return deadTree(px, ctx, ox, oy, rng, stage);
    case Prop.Stump:
      return stump(px, rng);
    case Prop.Bush:
      return bush(px, rng, stage);
    case Prop.Boulder:
      return boulder(px, rng);
    case Prop.ScrapPile:
      return scrap(px, rng);
    case Prop.CarWreck:
      return car(px, rng);
    case Prop.RuinWall:
      return ruin(px, rng);
    case Prop.ToxicBarrel:
      return barrel(px, rng);
    case Prop.Tires:
      return tires(px, rng);
  }
}

// --- Árbol seco: tronco retorcido con corteza, ramas que se abren y alguna hoja muerta -------------

/** Colores de las hojas según la estación (contorno, sombra, cuerpo, luz). */
const LEAVES: Record<FoliageStage, string[][]> = {
  desnudo: [],
  brotes: [['#3a5a24', '#5e8a34', '#86b048', '#b0d468']],
  verde: [
    ['#1e2e14', '#2e4a1e', '#46682a', '#6a8e3a'],
    ['#22301a', '#364e24', '#4e6e30', '#76944a'],
  ],
  otono: [
    ['#3a1e0e', '#7a3a14', '#b0601e', '#d8962e'],
    ['#3a240e', '#8a5a18', '#c08a24', '#e0b844'],
    ['#38140e', '#7a2416', '#a8401e', '#cc6a2e'],
  ],
  cayendo: [['#30200e', '#5e3e1a', '#8a5a24', '#a8783a']],
};

function deadTree(px: Px, ctx: CanvasRenderingContext2D, ox: number, oy: number, rng: Rng, stage: FoliageStage = 'desnudo'): void {
  const tips: [number, number][] = [];
  const bark = [['#2a2018', '#4a3a2a', '#6a5640', '#8a7458'], ['#241c16', '#3e3226', '#5e4c3a', '#7e6a52'], ['#2a221c', '#4a4036', '#6a5e50', '#8e8270']][rng.int(0, 2)];
  shadow(px, 16, 22);
  const tall = rng.int(0, 8);
  const lean = rng.int(-3, 3);
  const top = 30 - tall;
  // Raíces.
  px(10, PROP_BASE - 3, 4, 2, bark[1]);
  px(18, PROP_BASE - 3, 5, 2, bark[1]);
  // Tronco: de abajo arriba se estrecha y se inclina.
  for (let y = PROP_BASE - 2; y > top; y--) {
    const t = (PROP_BASE - y) / (PROP_BASE - top);
    const wdt = Math.max(2, Math.round(6 - t * 4));
    const x = 13 + Math.round(lean * t * t);
    px(x - 1, y, wdt + 2, 1, bark[0]);
    px(x, y, wdt, 1, bark[2]);
    px(x, y, 1, 1, bark[3]); // lado iluminado
    px(x + wdt - 1, y, 1, 1, bark[1]);
    if ((y * 7 + x) % 5 === 0) px(x + 1, y, 1, 1, bark[1]); // vetas
  }
  // Ramas: segmentos que se abren hacia arriba (con ramitas).
  const branch = (x: number, y: number, ang: number, len: number, depth: number) => {
    let cx = x;
    let cy = y;
    for (let i = 0; i < len; i++) {
      cx += Math.cos(ang);
      cy -= Math.abs(Math.sin(ang)) + 0.2;
      ctx.fillStyle = depth > 1 ? bark[1] : bark[2];
      ctx.fillRect(ox + Math.round(cx), oy + Math.round(cy), depth > 1 ? 2 : 1, 1);
    }
    if (depth < 3 && len > 3) {
      branch(cx, cy, ang + rng.next() * 0.9 - 0.2, Math.round(len * 0.6), depth + 1);
      branch(cx, cy, ang - rng.next() * 0.9 + 0.2, Math.round(len * 0.5), depth + 1);
    } else tips.push([cx, cy]);
  };
  const tx = 14 + lean;
  branch(tx, top + 2, -2.4 + rng.next() * 0.4, 8 + rng.int(0, 3), 1);
  branch(tx + 2, top + 1, -0.6 - rng.next() * 0.4, 8 + rng.int(0, 3), 1);
  branch(tx + 1, top, -1.6, 7, 1);
  branch(tx + 1, top + 9, -2.8, 6, 2);
  branch(tx + 3, top + 12, -0.3, 6, 2);
  // Copa según la estación: racimos de hojas alrededor de las puntas de las ramas.
  // Su azar no depende de la estación: los racimos están en el mismo sitio todo el año.
  const leafRng = new Rng(Math.floor(tips.length * 7919 + top * 31 + lean * 3 + 1000));
  const clusters = tips.map(([x, y]) => ({ x: x + leafRng.int(-1, 1), y: y + leafRng.int(-1, 1), r: leafRng.int(3, 5), keep: leafRng.next(), pal: leafRng.int(0, 2) }));
  const pals = LEAVES[stage];
  if (pals.length) {
    const pal = (i: number) => pals[i % pals.length];
    // Brotes: hojitas sueltas; cayendo: solo quedan algunos racimos y más pequeños.
    const list = stage === 'cayendo' ? clusters.filter((c) => c.keep < 0.45) : clusters;
    const rad = (r: number) => (stage === 'brotes' ? 1 : stage === 'cayendo' ? r - 2 : r);
    for (const c of list) disc(px, c.x, c.y, rad(c.r) + 1, pal(c.pal)[0]);
    for (const c of list) {
      const p4 = pal(c.pal);
      const r = rad(c.r);
      disc(px, c.x, c.y, r, p4[1]);
      // Borde irregular: hojas que asoman alrededor del racimo.
      if (r > 1) {
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2 + c.keep * 3;
          const bx = c.x + Math.round(Math.cos(a) * (r + 0.5));
          const by = c.y + Math.round(Math.sin(a) * (r + 0.5));
          px(bx, by, 1, 1, by < c.y ? p4[2] : p4[1]);
        }
      }
      disc(px, c.x - 1, c.y - 1, Math.max(0, r - 1), p4[2]);
      if (r > 2) disc(px, c.x - 2, c.y - 2, r - 3, p4[3]);
      // Textura de hojas: puntos de luz y de sombra dentro del racimo.
      for (let k = 0; k < r * 3; k++) {
        const dx = leafRng.int(-r + 1, r - 1);
        const dy = leafRng.int(-r + 1, r - 1);
        if (dx * dx + dy * dy >= r * r) continue;
        px(c.x + dx, c.y + dy, 1, 1, dy + dx < 0 ? p4[3] : p4[0]);
      }
    }
    // Hojas caídas al pie (otoño).
    if (stage === 'otono' || stage === 'cayendo') {
      for (let i = 0; i < 14; i++) px(leafRng.int(4, 27), PROP_BASE - leafRng.int(1, 4), 1, 1, pal(i)[2 + (i % 2)]);
    }
  }
}

function stump(px: Px, rng: Rng): void {
  const bark = ['#2a2018', '#4a3a2a', '#6a5640', '#8a7458'];
  shadow(px, 16, 20);
  const h = rng.int(6, 10);
  // Raíces que se agarran al suelo.
  px(7, PROP_BASE - 3, 5, 3, bark[0]);
  px(8, PROP_BASE - 3, 3, 2, bark[1]);
  px(21, PROP_BASE - 3, 5, 3, bark[0]);
  px(22, PROP_BASE - 3, 3, 2, bark[1]);
  // Tronco cortado: cilindro con corteza.
  px(10, PROP_BASE - h - 1, 13, h + 1, bark[0]);
  px(11, PROP_BASE - h, 11, h, bark[1]);
  px(11, PROP_BASE - h, 3, h, bark[2]);
  px(12, PROP_BASE - h, 1, h, bark[3]);
  for (let x = 15; x < 22; x += 3) px(x, PROP_BASE - h + 2, 1, h - 3, bark[0]);
  // Corte de arriba (elipse) con anillos.
  px(11, PROP_BASE - h - 4, 11, 1, bark[0]);
  px(10, PROP_BASE - h - 3, 13, 3, bark[0]);
  px(11, PROP_BASE - h - 3, 11, 2, '#a08a62');
  px(12, PROP_BASE - h - 4, 9, 1, '#a08a62');
  px(13, PROP_BASE - h - 3, 7, 1, '#8a7450');
  px(15, PROP_BASE - h - 3, 3, 1, '#a08a62');
  px(16, PROP_BASE - h - 3, 1, 1, '#6a5640');
  if (rng.chance(0.5)) px(20, PROP_BASE - h - 2, 2, 1, '#5a6a3a'); // musgo
  if (rng.chance(0.5)) px(13, PROP_BASE - h - 6, 1, 2, '#6a8a3a'); // un brote
}

// --- Matorral: racimos de hojas secas y verdes con luz arriba ----------------------------------------

function bush(px: Px, rng: Rng, stage: FoliageStage = 'verde'): void {
  const green = [
    ['#2a3018', '#46502a', '#64703a', '#8a9452'],
    ['#2e2c18', '#504a28', '#6e6638', '#948a52'],
    ['#262e1c', '#3c4a2a', '#56663a', '#7a8a50'],
    ['#30261a', '#5a4428', '#7a6238', '#9e8452'],
  ][rng.int(0, 3)];
  shadow(px, 16, 26);
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) blobs.push([rng.int(5, 25), rng.int(PROP_BASE - 16, PROP_BASE - 5), rng.int(3, 6)]);
  blobs.sort((a, b) => a[1] - b[1]);
  // Ramitas (se ven en invierno y entre las hojas que quedan).
  for (const [x, y] of blobs) {
    for (let k = 0; k < 6; k++) px(16 + Math.round(((x - 16) * k) / 6), PROP_BASE - 3 - Math.round(((PROP_BASE - 3 - y) * k) / 6), 1, 1, '#4a3a2a');
  }
  if (stage === 'desnudo') {
    for (const [x, y] of blobs) px(x, y - 1, 1, 2, '#5e4a36');
    return;
  }
  const pal = stage === 'otono' ? LEAVES.otono[rng.int(0, 2)] : stage === 'cayendo' ? LEAVES.cayendo[0] : stage === 'brotes' ? LEAVES.brotes[0] : green;
  if (stage === 'brotes' || stage === 'cayendo') {
    // Pocas hojas: racimos pequeños en algunas ramas.
    blobs.forEach(([x, y, r], i) => {
      if (stage === 'cayendo' && i % 2) return;
      disc(px, x, y, Math.max(1, r - 3), pal[1]);
      px(x - 1, y - 1, 1, 1, pal[3]);
    });
    return;
  }
  // Contorno, luego sombra, cuerpo y luz de cada racimo.
  for (const [x, y, r] of blobs) disc(px, x, y, r + 1, pal[0]);
  for (const [x, y, r] of blobs) {
    disc(px, x, y, r, pal[1]);
    disc(px, x - 1, y - 1, r - 1, pal[2]);
    disc(px, x - 2, y - 2, Math.max(1, r - 3), pal[3]);
    // Textura de hojas.
    for (let k = 0; k < r * 3; k++) {
      const dx = rng.int(-r + 1, r - 1);
      const dy = rng.int(-r + 1, r - 1);
      if (dx * dx + dy * dy < r * r) px(x + dx, y + dy, 1, 1, dx + dy < 0 ? pal[3] : pal[0]);
    }
  }
  // Hojas sueltas y alguna flor o baya.
  for (let i = 0; i < 10; i++) px(rng.int(4, 27), rng.int(PROP_BASE - 20, PROP_BASE - 4), 1, 1, pal[rng.int(2, 3)]);
  if (rng.chance(0.4)) for (let i = 0; i < 4; i++) px(rng.int(8, 24), rng.int(PROP_BASE - 16, PROP_BASE - 6), 1, 1, '#b0503a');
}

function disc(px: Px, cx: number, cy: number, r: number, c: string): void {
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    px(cx - w, cy + y, w * 2 + 1, 1, c);
  }
}

// --- Roca: facetas con luz arriba a la izquierda, grietas y algo de musgo -----------------------------

function boulder(px: Px, rng: Rng): void {
  const pal = ['#2a2826', '#4a4642', '#6a6660', '#8a8478', '#aaa498'];
  shadow(px, 17, 28);
  const w = rng.int(20, 26);
  const h = rng.int(14, 20);
  const x0 = 16 - w / 2;
  const y0 = PROP_BASE - h - 1;
  // Silueta de cúpula: estrecha arriba, ancha y apoyada abajo.
  for (let y = 0; y < h; y++) {
    const k = (h - y) / h;
    const inset = Math.round((w / 2) * (1 - Math.sqrt(Math.max(0, 1 - k * k))) * 0.9);
    const t = y / h;
    px(x0 + inset - 1, y0 + y, w - inset * 2 + 2, 1, pal[0]);
    px(x0 + inset, y0 + y, w - inset * 2, 1, t < 0.35 ? pal[3] : t < 0.7 ? pal[2] : pal[1]);
    px(x0 + inset, y0 + y, 2, 1, t < 0.5 ? pal[4] : pal[3]); // borde iluminado
    px(x0 + w - inset - 3, y0 + y, 3, 1, pal[1]); // lado en sombra
  }
  px(x0, PROP_BASE - 1, w, 1, pal[0]);
  // Facetas y grietas.
  px(x0 + w * 0.45, y0 + 3, 1, h * 0.5, pal[1]);
  px(x0 + w * 0.45, y0 + 3 + h * 0.5, w * 0.25, 1, pal[1]);
  px(x0 + w * 0.2, y0 + h * 0.6, w * 0.2, 1, pal[1]);
  if (rng.chance(0.6)) for (let i = 0; i < 7; i++) px(x0 + rng.int(3, w - 4), y0 + rng.int(1, 5), rng.int(1, 3), 1, ['#5a6a3a', '#6a7a44'][i % 2]);
}

// --- Montón de chatarra: chapas oxidadas, tubos, un neumático y tornillería ---------------------------

function scrap(px: Px, rng: Rng): void {
  shadow(px, 16, 30);
  const rust = ['#3a1e10', '#6a3a1e', '#9a5a2e', '#c07a3e'];
  const steel = ['#2a2a2c', '#4a4a4e', '#6a6a70', '#9a9aa0'];
  // Base del montón.
  for (let y = 0; y < 12; y++) {
    const w = 28 - Math.round(y * 1.4);
    px(16 - w / 2, PROP_BASE - 2 - y, w, 1, y < 2 ? rust[0] : rust[1]);
  }
  // Chapas inclinadas, tubos y piezas.
  for (let i = 0; i < 6; i++) {
    const x = rng.int(5, 22);
    const y = PROP_BASE - rng.int(6, 16);
    const w = rng.int(5, 10);
    const pal = rng.chance(0.6) ? rust : steel;
    px(x, y, w, 3, pal[0]);
    px(x, y, w, 2, pal[2]);
    px(x, y, w, 1, pal[3]);
  }
  px(8, PROP_BASE - 19, 1, 12, steel[2]); // tubo de pie
  px(8, PROP_BASE - 19, 1, 1, steel[3]);
  px(19, PROP_BASE - 10, 9, 2, steel[1]); // tubo tumbado
  px(19, PROP_BASE - 10, 9, 1, steel[2]);
  disc(px, 22, PROP_BASE - 5, 3, '#1a1816'); // neumático
  disc(px, 22, PROP_BASE - 5, 1, '#3a3836');
  for (let i = 0; i < 6; i++) px(rng.int(5, 27), PROP_BASE - rng.int(3, 14), 1, 1, rust[3]);
}

// --- Coche abandonado: carrocería oxidada, cristales rotos, ruedas pinchadas --------------------------

function car(px: Px, rng: Rng): void {
  const paints = [0x7a4a36, 0x5a6a6e, 0x6e6a4a, 0x7a3a32];
  const base = paints[rng.int(0, 3)];
  const c = (k: number) => {
    const r = (base >> 16) & 255;
    const g = (base >> 8) & 255;
    const b = base & 255;
    const f = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  };
  shadow(px, 16, 32, PROP_BASE - 2);
  // Ruedas.
  for (const x of [3, 22]) {
    px(x, PROP_BASE - 7, 7, 6, '#141210');
    px(x + 2, PROP_BASE - 5, 3, 2, '#3a3836');
  }
  // Carrocería baja.
  px(0, PROP_BASE - 15, 32, 10, '#1a1614');
  px(1, PROP_BASE - 14, 30, 8, c(0));
  px(1, PROP_BASE - 14, 30, 2, c(0.25));
  px(1, PROP_BASE - 8, 30, 2, c(-0.35));
  // Techo y cristales.
  px(6, PROP_BASE - 22, 19, 8, '#1a1614');
  px(7, PROP_BASE - 21, 17, 7, c(-0.1));
  px(7, PROP_BASE - 21, 17, 1, c(0.3));
  px(8, PROP_BASE - 20, 7, 4, '#2e3a3e');
  px(16, PROP_BASE - 20, 7, 4, '#2e3a3e');
  px(9, PROP_BASE - 20, 2, 1, '#6a8a90'); // brillo
  px(18, PROP_BASE - 19, 3, 2, '#1a1614'); // cristal roto
  // Óxido, faros y una puerta abierta.
  for (let i = 0; i < 8; i++) px(rng.int(2, 28), PROP_BASE - rng.int(7, 14), rng.int(1, 3), 1, ['#8a4a20', '#a4743c', '#5a2e14'][i % 3]);
  px(29, PROP_BASE - 13, 2, 2, '#c8c0a0');
  if (rng.chance(0.5)) px(14, PROP_BASE - 13, 1, 6, '#1a1614');
}

// --- Muro en ruinas: bloques de hormigón rotos, ladrillo asomando y varillas ---------------------------

function ruin(px: Px, rng: Rng): void {
  const con = ['#2a2826', '#4e4a46', '#6e6a64', '#8e8a82'];
  shadow(px, 16, 32, PROP_BASE - 1);
  const h = rng.int(18, 26);
  // Perfil roto arriba.
  const tops: number[] = [];
  for (let x = 0; x < 32; x++) tops.push(PROP_BASE - h + Math.round(Math.abs(Math.sin(x * 0.5 + rng.next() * 3)) * 6 + (x > 10 && x < 20 && rng.chance(0.4) ? 6 : 0)));
  for (let x = 0; x < 32; x++) {
    px(x, tops[x], 1, PROP_BASE - tops[x], con[1]);
    px(x, tops[x], 1, 2, con[3]);
    px(x, tops[x] + 2, 1, 1, con[0]);
  }
  // Juntas de los bloques.
  for (let y = PROP_BASE - 4; y > PROP_BASE - h; y -= 6) {
    for (let x = 0; x < 32; x++) if (y > tops[x] + 2) px(x, y, 1, 1, con[0]);
    for (let x = ((PROP_BASE - y) / 6) % 2 ? 4 : 10; x < 32; x += 12) for (let k = 0; k < 6; k++) if (y - k > tops[x] + 2) px(x, y - k, 1, 1, con[0]);
  }
  // Un trozo de ladrillo a la vista y varillas de hierro.
  const bx = rng.int(4, 20);
  const by = PROP_BASE - rng.int(8, 14);
  for (let y = 0; y < 6; y += 2) for (let x = 0; x < 8; x += 3) px(bx + x + (y % 4 ? 1 : 0), by + y, 2, 1, '#8a4a30');
  for (const x of [rng.int(3, 12), rng.int(18, 28)]) {
    px(x, tops[x] - 5, 1, 6, '#5a3a24');
    px(x + 1, tops[x] - 6, 1, 2, '#6a4a30');
  }
  // Pintadas o manchas de óxido.
  if (rng.chance(0.5)) {
    const gx = rng.int(4, 18);
    px(gx, PROP_BASE - 9, 6, 1, '#a03a2a');
    px(gx + 2, PROP_BASE - 11, 1, 4, '#a03a2a');
  }
  for (let i = 0; i < 6; i++) px(rng.int(1, 30), PROP_BASE - rng.int(2, 8), 1, 2, '#5a4a3a');
}

// --- Bidón tóxico: abollado, con el símbolo y babas verdes ------------------------------------------

function barrel(px: Px, rng: Rng): void {
  const pal = ['#2a2a0e', '#4a4614', '#6e6a20', '#8a8630', '#a8a448'];
  shadow(px, 16, 20);
  const x0 = 9;
  const y0 = PROP_BASE - 22;
  px(x0 - 1, y0, 16, 21, '#1a1a0a');
  for (let x = 0; x < 14; x++) {
    const shade = x < 3 ? pal[3] : x < 9 ? pal[2] : x < 12 ? pal[1] : pal[0];
    px(x0 + x, y0 + 1, 1, 19, shade);
  }
  px(x0 + 1, y0 + 1, 2, 19, pal[4]); // brillo
  for (const y of [y0 + 5, y0 + 14]) px(x0, y, 14, 1, pal[0]); // aros
  px(x0, y0, 14, 2, pal[3]); // tapa
  // Símbolo de peligro.
  px(x0 + 5, y0 + 8, 5, 4, '#1a1a10');
  px(x0 + 6, y0 + 9, 3, 2, '#d8c830');
  px(x0 + 7, y0 + 9, 1, 1, '#1a1a10');
  // Abolladura y babas verdes que brillan.
  if (rng.chance(0.6)) px(x0 + 10, y0 + 3, 2, 3, pal[0]);
  px(x0 + 3, y0 + 20, 3, 2, '#7ab43c');
  px(x0 + 4, y0 + 19, 1, 3, '#9ae44c');
  px(x0 + 12, PROP_BASE - 2, 6, 2, '#6aa43a');
  px(x0 + 13, PROP_BASE - 2, 3, 1, '#b4f45c');
}

function tires(px: Px, rng: Rng): void {
  shadow(px, 16, 26);
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i++) {
    const y = PROP_BASE - 5 - i * 5;
    const x = 16 + rng.int(-2, 2);
    // Neumático tumbado: aro grueso visto un poco desde arriba.
    px(x - 9, y - 4, 18, 1, '#141210');
    px(x - 11, y - 3, 22, 6, '#141210');
    px(x - 9, y + 3, 18, 1, '#141210');
    px(x - 10, y - 3, 20, 5, '#2a2826');
    px(x - 9, y - 3, 18, 1, '#4a4644');
    px(x - 6, y - 2, 12, 3, '#0a0908'); // hueco
    px(x - 5, y - 2, 10, 1, '#1e1c1a');
    for (let k = -9; k < 10; k += 3) px(x + k, y + 2, 1, 1, '#2e2c2a'); // dibujo de la goma
  }
  if (rng.chance(0.5)) px(4, PROP_BASE - 3, 6, 2, '#2a3a20'); // hierba entre las ruedas
}
