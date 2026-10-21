// Montones del suelo a doble resolución (salto de calidad del 2D, pedido por Mikel el 2026-10-21).
// Cada montón se dibuja en un lienzo del doble de tamaño y se coloca a la mitad, como las personas
// y los muebles. Hay tres tamaños según lo lleno que está (unos troncos sueltos o una pila entera).
// Solo dibujo: se elige por el id del recurso y no decide nada del juego.
import type { ResourceId } from '../data/resources';

/** Lienzo de un montón, a doble resolución (en pantalla se ve a la mitad: 14×11). */
export const ITEM_HI_W = 28;
export const ITEM_HI_H = 22;

/** Tamaño del montón (1 poco, 2 medio, 3 lleno) según lo que tiene y lo que cabe. */
export function pileLevel(amount: number, max: number): 1 | 2 | 3 {
  const f = max > 0 ? amount / max : 1;
  return f <= 0.34 ? 1 : f <= 0.67 ? 2 : 3;
}

const OL = '#1a1410';

/** Aclara (f > 1) u oscurece (f < 1) un color #rrggbb. */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `#${((1 << 24) | (ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).slice(1)}`;
}

interface Pen {
  px(x: number, y: number, w: number, h: number, c: string): void;
  /** Elipse rellena (sombras, piedras, sacos). */
  oval(cx: number, cy: number, rx: number, ry: number, c: string): void;
  /** Trazo recto de un punto a otro, de grosor t (armas, astas, flechas). */
  line(x0: number, y0: number, x1: number, y1: number, t: number, c: string): void;
}

function pen(ctx: CanvasRenderingContext2D): Pen {
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  return {
    px,
    oval(cx, cy, rx, ry, c) {
      for (let dy = -ry; dy <= ry; dy++) {
        const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
        px(cx - half, cy + dy, half * 2 + 1, 1, c);
      }
    },
    line(x0, y0, x1, y1, t, c) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, t, t, c);
    },
  };
}

// --- Piezas sueltas ---

/** Tronco tumbado: corteza con vetas y la punta clara con anillos. */
function log(p: Pen, x: number, y: number, len: number, bark = '#6a4a2c'): void {
  p.px(x, y, len, 6, OL);
  p.px(x + 1, y + 1, len - 2, 4, bark);
  p.px(x + 1, y + 1, len - 2, 1, shade(bark, 1.3));
  p.px(x + 1, y + 4, len - 2, 1, shade(bark, 0.7));
  for (let i = 3; i < len - 5; i += 4) p.px(x + i, y + 2 + (i % 2), 2, 1, shade(bark, 0.78));
  // Punta cortada.
  p.oval(x + len - 3, y + 3, 2, 2, OL);
  p.oval(x + len - 3, y + 3, 1, 1, '#d8b47a');
  p.px(x + len - 3, y + 3, 1, 1, '#a07848');
}

/** Bloque con cara de arriba clara y frente más oscuro. */
function block(p: Pen, x: number, y: number, w: number, h: number, top: string, face: string): void {
  p.px(x, y, w, h, OL);
  p.px(x + 1, y + 1, w - 2, 2, top);
  p.px(x + 1, y + 3, w - 2, h - 4, face);
  p.px(x + 1, y + h - 2, w - 2, 1, shade(face, 0.75));
  p.px(x + 1, y + 1, 1, h - 2, shade(top, 1.15));
}

/** Piedra redondeada con brillo y grieta. */
function stone(p: Pen, cx: number, cy: number, rx: number, ry: number, base: string): void {
  p.oval(cx, cy, rx + 1, ry + 1, OL);
  p.oval(cx, cy, rx, ry, base);
  p.oval(cx - 1, cy - 1, Math.max(1, rx - 2), Math.max(1, ry - 2), shade(base, 1.18));
  p.px(cx + 1, cy + ry - 1, rx - 1, 1, shade(base, 0.72));
  p.px(cx - rx + 2, cy, 2, 1, shade(base, 0.7));
}

/** Lingote: trapecio con el canto brillante. */
function ingot(p: Pen, x: number, y: number, base: string): void {
  p.px(x, y + 1, 9, 4, OL);
  p.px(x + 1, y, 7, 1, OL);
  p.px(x + 1, y + 1, 7, 1, shade(base, 1.45));
  p.px(x + 1, y + 2, 7, 2, base);
  p.px(x + 1, y + 4, 7, 1, shade(base, 0.7));
  p.px(x + 2, y + 2, 2, 1, shade(base, 1.25));
}

/** Saco de tela atado arriba. */
function sack(p: Pen, x: number, y: number, w: number, h: number, base: string): void {
  p.px(x + 1, y + 2, w - 2, h - 2, OL);
  p.px(x, y + 4, w, h - 5, OL);
  p.px(x + 1, y + 4, w - 2, h - 6, base);
  p.px(x + 2, y + 3, w - 4, 1, base);
  p.px(x + 2, y + 4, w - 4, 1, shade(base, 1.2));
  p.px(x + 2, y + h - 3, w - 4, 1, shade(base, 0.72));
  p.px(x + Math.floor(w / 2) - 1, y, 3, 3, OL);
  p.px(x + Math.floor(w / 2), y + 1, 1, 2, '#c8a060');
}

/** Caja de madera con tablas y esquineras. */
function crate(p: Pen, x: number, y: number, w: number, h: number, wood = '#8a6238'): void {
  block(p, x, y, w, h, shade(wood, 1.2), wood);
  for (let yy = y + 5; yy < y + h - 2; yy += 3) p.px(x + 1, yy, w - 2, 1, shade(wood, 0.7));
  p.px(x + 1, y + 3, 1, h - 4, shade(wood, 0.6));
  p.px(x + w - 2, y + 3, 1, h - 4, shade(wood, 0.6));
}

/** Lata o bidón de pie, con aros. */
function can(p: Pen, x: number, y: number, w: number, h: number, base: string): void {
  p.px(x, y, w, h, OL);
  p.px(x + 1, y + 1, w - 2, h - 2, base);
  p.px(x + 1, y + 1, w - 2, 1, shade(base, 1.35));
  p.px(x + 1, y + 1, 1, h - 2, shade(base, 1.2));
  p.px(x + w - 2, y + 1, 1, h - 2, shade(base, 0.7));
  p.px(x + 1, y + Math.floor(h / 2), w - 2, 1, shade(base, 0.75));
}

/** Cesto de mimbre (lo de dentro se dibuja antes, asomando por arriba). */
function basket(p: Pen, x: number, y: number, w: number, h: number): void {
  p.px(x, y, w, h, OL);
  p.px(x + 1, y + 1, w - 2, h - 2, '#8a6a3a');
  for (let i = x + 1; i < x + w - 1; i += 2) p.px(i, y + 1, 1, h - 2, '#6a4e2a');
  p.px(x + 1, y + 1, w - 2, 1, '#b08a52');
}

/** Sombra del montón en el suelo. */
function groundShadow(p: Pen, w: number): void {
  p.oval(14, 19, w, 2, 'rgba(0,0,0,0.3)');
}

/** Los n primeros puestos de la lista, según el tamaño del montón. */
function take<T>(list: readonly T[], level: number, per: readonly [number, number, number]): readonly T[] {
  return list.slice(0, per[level - 1]);
}

// --- Montones ---

/** Dibuja un montón de 28×22 (doble resolución) de un recurso, con su tamaño (1–3). */
export function paintItemHi(ctx: CanvasRenderingContext2D, r: ResourceId, level: 1 | 2 | 3 = 3): void {
  const p = pen(ctx);
  groundShadow(p, level === 1 ? 8 : 11);
  switch (r) {
    case 'madera': {
      // Pila de troncos: abajo tres, encima dos y uno en lo alto.
      const spots: [number, number, number][] = [[3, 13, 11], [14, 13, 11], [8, 8, 12], [2, 8, 7], [16, 8, 9], [10, 3, 10]];
      for (const [x, y, l] of take(spots, level, [2, 4, 6])) log(p, x, y, l);
      break;
    }
    case 'piedra': {
      const spots: [number, number, number, number, string][] = [
        [7, 16, 4, 3, '#8c8a84'], [17, 16, 5, 3, '#7e7c76'], [12, 15, 4, 3, '#9a978e'],
        [9, 11, 4, 3, '#86847e'], [17, 11, 3, 3, '#a09d94'], [13, 7, 4, 3, '#928f88'],
      ];
      for (const [cx, cy, rx, ry, c] of take(spots, level, [2, 4, 6])) stone(p, cx, cy, rx, ry, c);
      break;
    }
    case 'chatarra': {
      // Chapas oxidadas, un tubo y un engranaje viejo.
      p.px(3, 13, 22, 6, OL);
      p.px(4, 14, 20, 4, '#8a4a26');
      p.px(4, 14, 20, 1, '#c27a3e');
      p.px(8, 15, 5, 1, '#5c5a56');
      p.px(17, 16, 4, 1, '#a35a2c');
      if (level >= 2) {
        p.line(4, 12, 20, 6, 2, OL);
        p.line(5, 12, 20, 7, 1, '#7a7874');
        p.px(6, 7, 9, 6, OL);
        p.px(7, 8, 7, 4, '#a35a2c');
        p.px(7, 8, 7, 1, '#d08a4a');
        p.px(9, 10, 2, 1, '#6a3a1e');
      }
      if (level >= 3) {
        p.oval(19, 6, 4, 4, OL);
        p.oval(19, 6, 3, 3, '#6e6c66');
        p.oval(19, 6, 1, 1, OL);
        for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) p.px(19 + dx, 6 + dy, 1, 1, '#8a8780');
        p.line(2, 4, 6, 12, 1, '#5c5a56');
      }
      break;
    }
    case 'componentes': {
      // Cajas con engranajes, tornillos y un cable asomando.
      const boxes: [number, number][] = [[4, 10], [15, 11], [9, 3]];
      for (const [x, y] of take(boxes, level, [1, 2, 3])) {
        crate(p, x, y, 10, 8, '#5a6b4a');
        p.oval(x + 4, y + 1, 2, 1, '#d8c27a');
        p.px(x + 6, y, 2, 1, '#b4b1a8');
        p.px(x + 7, y - 1, 1, 2, '#c84a2a');
      }
      break;
    }
    case 'patata':
    case 'maiz':
    case 'setas': {
      const n = level === 1 ? 4 : level === 2 ? 7 : 11;
      const heap: [number, number][] = [[7, 9], [11, 8], [15, 9], [19, 9], [9, 6], [13, 5], [17, 6], [11, 3], [15, 3], [13, 1], [8, 4]];
      if (level === 3) sack(p, 19, 4, 8, 14, '#a89068');
      for (const [x, y] of heap.slice(0, n)) {
        if (r === 'patata') {
          p.oval(x, y + 2, 2, 1, OL);
          p.oval(x, y + 2, 1, 1, '#b08a52');
          p.px(x - 1, y + 1, 1, 1, '#d0aa72');
        } else if (r === 'maiz') {
          p.px(x - 1, y, 3, 5, OL);
          p.px(x, y + 1, 1, 3, '#e8c840');
          p.px(x + 1, y + 2, 1, 2, '#6a9a3a');
        } else {
          p.px(x, y + 2, 1, 2, '#e8dcc0');
          p.px(x - 2, y, 5, 2, OL);
          p.px(x - 1, y + 1, 3, 1, '#a85a3a');
          p.px(x - 1, y, 2, 1, '#d08060');
        }
      }
      basket(p, 3, 11, 19, 8);
      break;
    }
    case 'fibra':
    case 'hierba': {
      // Manojos atados con cordel: la fibra más clara y la hierba con flores.
      const leaf = r === 'fibra' ? '#8ac06a' : '#5a9a5a';
      const bundles: [number, number][] = [[3, 11], [15, 11], [9, 5]];
      for (const [x, y] of take(bundles, level, [1, 2, 3])) {
        p.px(x, y, 11, 7, OL);
        p.px(x + 1, y + 1, 9, 5, leaf);
        for (let i = x + 1; i < x + 10; i += 2) p.px(i, y + 1, 1, 5, shade(leaf, 0.72));
        p.px(x + 1, y + 1, 9, 1, shade(leaf, 1.25));
        p.px(x + 4, y, 2, 7, '#c8a060');
        if (r === 'hierba') {
          p.px(x + 1, y - 1, 1, 1, '#e8e0a0');
          p.px(x + 8, y - 1, 1, 1, '#f0c0d0');
        }
      }
      break;
    }
    case 'metal': {
      const spots: [number, number][] = [[3, 14], [12, 14], [7, 10], [16, 10], [11, 6], [6, 2]];
      for (const [x, y] of take(spots, level, [2, 4, 5])) ingot(p, x, y, '#9aa0a6');
      break;
    }
    case 'hormigon': {
      const spots: [number, number][] = [[2, 12], [14, 12], [8, 5]];
      for (const [x, y] of take(spots, level, [1, 2, 3])) {
        block(p, x, y, 12, 7, '#b8b4ac', '#9a968e');
        p.px(x + 3, y + 4, 1, 1, '#76726a');
        p.px(x + 8, y + 5, 1, 1, '#76726a');
        p.px(x + 10, y + 1, 1, 3, '#8a4a26'); // varilla
      }
      break;
    }
    case 'comida': {
      // Olla de guiso con vapor y, al haber más, cuencos al lado.
      if (level >= 2) for (const x of [1, 21]) { p.px(x, 14, 6, 4, OL); p.px(x + 1, 14, 4, 3, '#a87a4a'); p.px(x + 1, 14, 4, 1, '#b0703a'); }
      if (level >= 3) { p.px(20, 9, 6, 4, OL); p.px(21, 9, 4, 3, '#a87a4a'); p.px(21, 9, 4, 1, '#c88a4a'); }
      can(p, 7, 8, 14, 11, '#5c5a56');
      p.px(5, 10, 2, 2, OL);
      p.px(21, 10, 2, 2, OL);
      p.px(8, 8, 12, 2, '#b0703a');
      p.px(10, 8, 2, 1, '#d8a050');
      p.px(15, 9, 2, 1, '#c84a2a');
      p.px(11, 2, 1, 4, 'rgba(230,230,230,0.55)');
      p.px(16, 1, 1, 5, 'rgba(230,230,230,0.45)');
      break;
    }
    case 'carne': {
      // Piezas de carne sobre una tela, con hueso y vetas de grasa.
      p.px(2, 14, 24, 5, OL);
      p.px(3, 15, 22, 3, '#c8b890');
      const cuts: [number, number][] = [[5, 10], [15, 10], [10, 5]];
      for (const [x, y] of take(cuts, level, [1, 2, 3])) {
        p.oval(x + 4, y + 3, 5, 3, OL);
        p.oval(x + 4, y + 3, 4, 2, '#a8323a');
        p.px(x + 1, y + 2, 6, 1, '#e0b0a0');
        p.px(x + 2, y + 4, 4, 1, '#7a1e26');
        p.px(x + 8, y + 2, 3, 2, '#ece4d4');
      }
      break;
    }
    case 'pescado': {
      const fish: [number, number][] = [[3, 13], [10, 9], [5, 5], [13, 3]];
      p.px(2, 16, 24, 3, OL);
      p.px(3, 16, 22, 2, '#7a5634');
      for (const [x, y] of take(fish, level, [2, 3, 4])) {
        p.oval(x + 6, y + 2, 6, 2, OL);
        p.oval(x + 6, y + 2, 5, 1, '#8aa0b0');
        p.px(x + 2, y + 1, 8, 1, '#c8d8e0');
        p.px(x + 12, y, 3, 5, OL);
        p.px(x + 13, y + 1, 1, 3, '#5a7080');
        p.px(x + 2, y + 2, 1, 1, OL);
      }
      break;
    }
    case 'cuero': {
      // Pieles curtidas dobladas, unas encima de otras.
      const n = level === 1 ? 1 : level === 2 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const y = 13 - i * 4;
        const x = 3 + (i % 2) * 2;
        const c = ['#8a5a34', '#7a4e2c', '#9a6a3e'][i];
        p.px(x, y, 20, 5, OL);
        p.px(x + 1, y + 1, 18, 3, c);
        p.px(x + 1, y + 1, 18, 1, shade(c, 1.25));
        p.px(x - 1, y + 2, 2, 2, OL);
        p.px(x + 19, y + 1, 2, 2, OL);
      }
      break;
    }
    case 'abrigo': {
      // Abrigo doblado: tela gruesa con cuello de borrego y botones.
      block(p, 4, 9, 20, 10, '#7a6a52', '#5e5040');
      p.px(5, 10, 18, 2, '#e0d4bc');
      p.px(5, 10, 18, 1, '#f0e8d8');
      for (const x of [9, 14, 19]) p.px(x, 14, 1, 1, '#c8a060');
      p.px(13, 12, 1, 6, '#3e342a');
      if (level >= 2) { block(p, 6, 4, 16, 6, '#6a5a44', '#504434'); p.px(7, 5, 14, 1, '#e0d4bc'); }
      break;
    }
    case 'medicina': {
      // Botiquín blanco con cruz roja y frascos de pastillas.
      block(p, 4, 8, 15, 11, '#f0ece4', '#d0ccc4');
      p.px(10, 10, 3, 7, '#c8322a');
      p.px(8, 12, 7, 3, '#c8322a');
      p.px(9, 7, 5, 2, OL);
      const bottles: [number, number][] = [[20, 11], [23, 13], [1, 13]];
      for (const [x, y] of take(bottles, level, [0, 2, 3])) {
        can(p, x, y, 4, 6, '#d08a2a');
        p.px(x, y - 1, 4, 2, '#f0ece4');
      }
      break;
    }
    case 'combustible': {
      // Bidones rojos de gasolina con tapón.
      const cans: [number, number][] = [[3, 9], [14, 9], [9, 3]];
      for (const [x, y] of take(cans, level, [1, 2, 3])) {
        can(p, x, y, 10, 10, '#a8321e');
        p.px(x + 2, y + 3, 6, 4, '#7e2416');
        p.line(x + 2, y + 3, x + 7, y + 6, 1, '#c8501e');
        p.px(x + 7, y - 2, 2, 2, OL);
        p.px(x + 1, y - 1, 4, 1, OL);
      }
      break;
    }
    case 'napalm': {
      const cans: [number, number][] = [[4, 9], [14, 9], [9, 3]];
      for (const [x, y] of take(cans, level, [1, 2, 3])) {
        can(p, x, y, 9, 10, '#4a6a3a');
        p.px(x + 3, y + 3, 3, 3, '#e08020');
        p.px(x + 4, y + 2, 1, 1, '#f0c040');
        p.px(x + 3, y - 1, 3, 1, OL);
      }
      break;
    }
    case 'abono': {
      const sacks: [number, number][] = [[3, 7], [14, 7], [9, 1]];
      for (const [x, y] of take(sacks, level, [1, 2, 3])) {
        sack(p, x, y, 11, 12, '#6a4a2a');
        p.px(x + 3, y + 7, 4, 1, '#8a6a3a');
      }
      break;
    }
    case 'leche': {
      const churns: [number, number][] = [[9, 6], [2, 9], [18, 9]];
      for (const [x, y] of take(churns, level, [1, 2, 3])) {
        can(p, x, y, 8, 11, '#c8ccd0');
        p.px(x + 2, y - 2, 4, 2, OL);
        p.px(x + 3, y - 1, 2, 1, '#9aa0a6');
        p.px(x + 2, y + 5, 4, 1, '#eae6dc');
      }
      break;
    }
    case 'huevos': {
      const eggs: [number, number][] = [[7, 8], [11, 7], [15, 8], [19, 8], [9, 5], [13, 4], [17, 5]];
      for (const [x, y] of take(eggs, level, [3, 5, 7])) {
        p.oval(x, y + 2, 2, 2, OL);
        p.oval(x, y + 2, 1, 1, '#f0e8d8');
        p.px(x - 1, y + 1, 1, 1, '#ffffff');
      }
      basket(p, 4, 11, 20, 8);
      p.px(5, 11, 18, 1, '#e8d8a0'); // paja
      break;
    }
    case 'balas': {
      // Caja de munición verde y cartuchos sueltos de latón.
      block(p, 4, 9, 14, 10, '#6e7848', '#4e5634');
      p.px(9, 9, 4, 1, '#2a2e1c');
      p.px(7, 13, 8, 2, '#d8c27a');
      const shells = take([20, 23, 16, 1] as const, level, [1, 2, 4]);
      for (const x of shells) {
        p.px(x, 12, 3, 7, OL);
        p.px(x + 1, 14, 1, 4, '#c29a3e');
        p.px(x + 1, 13, 1, 1, '#8a8780');
      }
      break;
    }
    case 'flechas': {
      // Carcaj de cuero con flechas y unas sueltas en el suelo.
      const n = level === 1 ? 2 : level === 2 ? 4 : 6;
      for (let i = 0; i < n; i++) p.line(6 + i * 2, 1 + (i % 2), 9 + i, 10, 1, '#9a7650');
      for (let i = 0; i < n; i++) p.px(5 + i * 2, i % 2, 2, 2, i % 2 ? '#d8c27a' : '#e8e0d0');
      p.px(5, 9, 12, 10, OL);
      p.px(6, 10, 10, 8, '#7a5634');
      p.px(6, 10, 10, 1, '#a57a48');
      p.px(6, 14, 10, 1, '#5a3e22');
      if (level >= 2) { p.line(17, 17, 26, 15, 1, '#9a7650'); p.px(25, 14, 2, 3, '#b4b1a8'); }
      break;
    }
    case 'granadas': {
      const spots: [number, number][] = [[4, 10], [11, 11], [18, 10], [8, 5], [15, 5]];
      for (const [x, y] of take(spots, level, [2, 3, 5])) {
        p.px(x, y, 6, 8, OL);
        p.px(x + 1, y + 1, 4, 6, '#5a6438');
        p.px(x + 1, y + 1, 1, 6, '#7a8450');
        p.px(x + 1, y + 3, 4, 1, '#3e4628');
        p.px(x + 2, y - 1, 2, 1, '#8a8780');
        p.px(x + 4, y - 2, 2, 2, '#b4b1a8');
      }
      break;
    }
    // --- Armas tumbadas en el suelo ---
    case 'palo':
      p.line(3, 17, 22, 3, 3, OL);
      p.line(4, 17, 22, 4, 2, '#7a5634');
      p.line(4, 17, 9, 13, 2, '#4a3420');
      break;
    case 'cuchillo':
      p.line(4, 17, 10, 13, 3, OL);
      p.line(5, 17, 10, 14, 2, '#3a2a1a');
      p.line(10, 13, 21, 5, 3, OL);
      p.line(11, 13, 21, 6, 2, '#c8c8c0');
      p.line(12, 12, 20, 6, 1, '#f0f0e8');
      break;
    case 'tuberia':
      p.line(3, 17, 22, 3, 4, OL);
      p.line(4, 17, 22, 4, 2, '#5c5a56');
      p.line(5, 16, 21, 4, 1, '#8a8780');
      p.px(20, 1, 5, 5, OL);
      p.px(21, 2, 3, 3, '#7a7874');
      p.px(4, 16, 3, 2, '#8a4a26');
      break;
    case 'lanza':
    case 'lanza_metal': {
      const shaft = r === 'lanza' ? '#7a5634' : '#5c5a56';
      p.line(2, 19, 21, 5, 2, OL);
      p.line(2, 19, 21, 5, 1, shaft);
      p.line(19, 6, 25, 1, 3, OL);
      p.line(20, 5, 25, 1, 2, r === 'lanza' ? '#b4b1a8' : '#d0d0c8');
      p.px(18, 6, 2, 2, r === 'lanza' ? '#c8a060' : '#a57a48');
      break;
    }
    case 'machete':
      p.line(3, 17, 8, 14, 3, OL);
      p.line(4, 17, 8, 15, 2, '#3a2a1a');
      p.line(8, 13, 22, 4, 4, OL);
      p.line(9, 13, 22, 5, 3, '#a8aca8');
      p.line(9, 15, 22, 6, 1, '#e0e4e0');
      p.px(8, 12, 2, 4, '#5c5a56');
      break;
    case 'arco':
      for (let i = 0; i <= 16; i++) {
        const x = 7 + Math.round(Math.sin((i / 16) * Math.PI) * 7);
        p.px(x - 1, 2 + i, 3, 1, OL);
        p.px(x, 2 + i, 1, 1, '#8a6238');
      }
      p.px(13, 9, 2, 4, '#c8a060');
      p.px(7, 2, 1, 17, 'rgba(230,220,200,0.85)');
      break;
    case 'ballesta':
      p.px(2, 10, 20, 4, OL);
      p.px(3, 11, 18, 2, '#7a5634');
      p.px(0, 10, 4, 5, '#6a4628');
      p.px(17, 2, 3, 20, OL);
      p.px(18, 3, 1, 18, '#8a8780');
      p.line(17, 4, 14, 11, 1, 'rgba(230,220,200,0.85)');
      p.line(14, 12, 17, 19, 1, 'rgba(230,220,200,0.85)');
      p.px(20, 11, 5, 2, '#b4b1a8');
      p.px(7, 14, 2, 3, OL);
      break;
    case 'pistola':
      p.px(4, 6, 17, 5, OL);
      p.px(5, 7, 15, 3, '#5c5a56');
      p.px(5, 7, 15, 1, '#8a8780');
      p.px(19, 7, 1, 2, OL);
      p.px(6, 10, 9, 2, '#8a4a26');
      p.px(4, 10, 5, 9, OL);
      p.px(5, 11, 3, 7, '#3a2a1a');
      p.px(5, 13, 3, 2, '#a57a48');
      p.px(10, 12, 2, 3, OL);
      p.px(7, 7, 1, 1, '#d0d0c8');
      break;
    case 'escopeta':
    case 'rifle':
    case 'subfusil':
    case 'francotirador': {
      // Armas largas: cañón, cuerpo, culata de madera y lo propio de cada una.
      const long = r === 'francotirador' || r === 'rifle';
      const x1 = r === 'subfusil' ? 22 : 27;
      p.px(8, 7, x1 - 8, r === 'escopeta' ? 5 : 3, OL);
      p.px(9, 8, x1 - 10, 1, '#5c5a56');
      if (r === 'escopeta') { p.px(9, 9, x1 - 10, 1, '#47453f'); p.px(9, 10, x1 - 10, 1, '#5c5a56'); }
      p.px(5, 9, 13, 5, OL);
      p.px(6, 10, 11, 3, r === 'subfusil' ? '#5c5a56' : '#7a5634');
      p.px(6, 10, 11, 1, r === 'subfusil' ? '#8a8780' : '#a57a48');
      if (r === 'subfusil') {
        p.line(0, 9, 6, 9, 1, '#8a8780');
        p.line(0, 9, 0, 13, 1, '#8a8780');
        p.px(13, 13, 3, 8, OL);
        p.px(14, 13, 1, 7, '#2e2c28');
      } else {
        p.px(0, 10, 7, 7, OL);
        p.px(1, 11, 5, 5, '#6a4628');
        p.px(1, 11, 5, 1, '#8a5e36');
      }
      p.px(10, 13, 2, 3, OL);
      if (long) {
        p.px(10, r === 'francotirador' ? 3 : 5, r === 'francotirador' ? 9 : 5, r === 'francotirador' ? 3 : 2, OL);
        if (r === 'francotirador') { p.px(11, 4, 7, 1, '#2e2c28'); p.px(18, 4, 1, 1, '#6fa0b4'); p.px(13, 6, 2, 1, OL); }
        if (r === 'rifle') p.px(14, 13, 3, 4, '#8a4a26');
      }
      if (r === 'escopeta') p.px(12, 10, 4, 3, '#8a4a26');
      break;
    }
    case 'lanzallamas':
      can(p, 1, 6, 7, 12, '#8a2e1c');
      p.px(2, 4, 3, 2, OL);
      p.px(8, 10, 14, 3, OL);
      p.px(8, 11, 13, 1, '#5c5a56');
      p.px(11, 13, 3, 5, OL);
      p.px(12, 13, 1, 4, '#3a2a1a');
      p.px(21, 8, 3, 6, OL);
      p.px(24, 9, 2, 3, '#f0a020');
      p.px(26, 10, 1, 1, '#e05010');
      break;
    // --- Ropa de protección doblada ---
    case 'chaleco_cuero':
    case 'chaleco_chapa':
    case 'chaleco_metal':
    case 'chaleco_tactico': {
      const base = r === 'chaleco_cuero' ? '#7a5634' : r === 'chaleco_chapa' ? '#8a4a26' : r === 'chaleco_metal' ? '#6e747a' : '#4e5634';
      p.px(5, 4, 18, 15, OL);
      p.px(6, 5, 16, 13, base);
      p.px(6, 5, 16, 1, shade(base, 1.35));
      p.px(11, 3, 6, 5, OL); // cuello
      p.px(13, 8, 2, 10, shade(base, 0.6)); // cierre
      if (r === 'chaleco_chapa' || r === 'chaleco_metal') for (const [x, y] of [[8, 8], [18, 8], [8, 14], [18, 14]]) p.px(x, y, 1, 1, '#d0d0c8');
      if (r === 'chaleco_tactico') {
        p.px(6, 11, 16, 1, '#2a2e1c');
        p.px(7, 13, 4, 4, '#3a4026');
        p.px(17, 13, 4, 4, '#3a4026');
      }
      if (r === 'chaleco_cuero') p.px(8, 9, 3, 1, '#a57a48');
      break;
    }
    case 'casco_chapa':
    case 'casco_metal':
    case 'casco_tactico': {
      const base = r === 'casco_chapa' ? '#8a4a26' : r === 'casco_metal' ? '#6e747a' : '#4e5634';
      p.oval(14, 12, 9, 7, OL);
      p.oval(14, 12, 8, 6, base);
      p.oval(11, 9, 3, 2, shade(base, 1.35));
      p.px(3, 15, 22, 3, OL);
      p.px(4, 16, 20, 1, shade(base, 0.75));
      if (r === 'casco_tactico') { p.px(7, 12, 14, 2, '#2a2e1c'); p.px(10, 12, 3, 2, '#6fa0b4'); p.px(15, 12, 3, 2, '#6fa0b4'); }
      if (r === 'casco_chapa') p.px(16, 10, 2, 1, '#c27a3e');
      break;
    }
    default:
      kitCrate(p, r, level);
  }
}

/** Kits de defensas y energía: caja con su franja de color y un dibujo de lo que lleva. */
function kitCrate(p: Pen, r: ResourceId, level: number): void {
  const color: Partial<Record<ResourceId, string>> = {
    kit_barricada_madera: '#a07848',
    kit_barricada_chatarra: '#a35a2c',
    kit_barricada_metal: '#9aa0a6',
    kit_barricada_hormigon: '#b8b4ac',
    kit_sacos_arena: '#c8b07a',
    kit_torreta_ligera: '#c84a2a',
    kit_torreta_pesada: '#a8321e',
    kit_torreta_rotativa: '#d8641e',
    kit_mortero: '#5a6438',
    kit_generador_lena: '#d8a030',
    kit_placa_solar: '#3a6a9a',
    kit_molino_viento: '#e0e0d8',
    kit_bateria: '#4a9a4a',
    kit_lampara: '#f0d060',
  };
  const band = color[r] ?? '#d8c27a';
  if (level >= 2) crate(p, 16, 10, 10, 9);
  crate(p, 3, 6, 15, 13);
  p.px(4, 9, 13, 3, band);
  p.px(4, 9, 13, 1, shade(band, 1.3));
  // Dibujo estarcido en el frente.
  const ink = 'rgba(26,20,16,0.75)';
  if (r.startsWith('kit_torreta') || r === 'kit_mortero') {
    p.px(8, 14, 5, 3, ink);
    p.px(12, 14, 4, 1, ink);
  } else if (r === 'kit_placa_solar') {
    p.px(7, 13, 7, 4, ink);
    p.px(10, 13, 1, 4, band);
  } else if (r === 'kit_lampara' || r === 'kit_generador_lena' || r === 'kit_bateria') {
    p.line(11, 13, 9, 15, 1, ink);
    p.line(9, 15, 12, 15, 1, ink);
    p.line(12, 15, 10, 17, 1, ink);
  } else if (r === 'kit_molino_viento') {
    p.line(7, 13, 13, 17, 1, ink);
    p.line(13, 13, 7, 17, 1, ink);
  } else {
    for (const x of [6, 10, 14]) p.px(x, 14, 2, 3, ink);
  }
  // Flejes.
  p.px(3, 6, 1, 13, '#3a3a3a');
  p.px(17, 6, 1, 13, '#3a3a3a');
}
