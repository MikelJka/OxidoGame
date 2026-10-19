// Dibujos pixel art de colonos, montones y plantas sobre un lienzo 2D.
// Los usan la vista 2D (Phaser) y la vista 3D (Three.js).
import type { Colonist } from '../sim/colonist';
import type { CropDef } from '../data/crops';
import type { ResourceId } from '../data/resources';

/** Tamaños de los dibujos (px). */
export const COLONIST_SIZE = 16;
export const ITEM_W = 12;
export const ITEM_H = 10;
export const CROP_SIZE = 16;

/** Dibuja un colono pixel art de 16×16 con sus colores. */
export function paintColonist(ctx: CanvasRenderingContext2D, c: Colonist): void {
  const hex = (n: number, shade = 0) => {
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + shade));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + shade));
    const b = Math.max(0, Math.min(255, (n & 255) + shade));
    return `rgb(${r},${g},${b})`;
  };
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const outline = '#1a1410';
  // Sombra
  px(4, 14, 8, 1, 'rgba(0,0,0,0.35)');
  // Piernas
  px(6, 11, 2, 3, '#3a3028');
  px(9, 11, 2, 3, '#3a3028');
  // Cuerpo (camisa) con contorno
  px(4, 6, 8, 6, outline);
  px(5, 6, 6, 5, hex(c.look.shirt));
  px(5, 6, 6, 1, hex(c.look.shirt, 25));
  px(10, 7, 1, 4, hex(c.look.shirt, -30));
  // Brazos
  px(4, 7, 1, 3, hex(c.look.skin, -20));
  px(11, 7, 1, 3, hex(c.look.skin, -20));
  // Cabeza
  px(5, 1, 6, 6, outline);
  px(6, 2, 4, 4, hex(c.look.skin));
  // Pelo
  px(6, 1, 4, 2, hex(c.look.hair));
  px(5, 2, 1, 2, hex(c.look.hair));
  // Ojo (mira a la derecha; el sprite se voltea)
  px(9, 4, 1, 1, outline);
  // Quien no es de la colonia se distingue de un vistazo.
  if (c.role === 'saqueador') {
    px(5, 3, 6, 1, '#b02a1a'); // pañuelo rojo
    px(4, 3, 1, 2, '#b02a1a');
    px(5, 6, 6, 1, '#5a1a12');
    if (c.raider?.leader) {
      // Líder del raid: estrella dorada sobre la cabeza.
      px(13, 0, 1, 3, '#f0c030');
      px(12, 1, 3, 1, '#f0c030');
    }
  } else if (c.role === 'prisionero') {
    px(5, 6, 6, 5, '#d9822b'); // mono naranja
    px(5, 8, 6, 1, '#8a4a1a');
    px(4, 9, 8, 1, '#9aa0a8'); // grilletes
  } else if (c.role === 'comerciante') {
    px(3, 1, 10, 1, '#5a3f22'); // sombrero de ala ancha
    px(5, 0, 6, 1, '#7a5a32');
  }
}

/** Clave de textura: cambia si cambia su papel (un prisionero que se une ya no lleva mono). */
export function colonistLookKey(c: Colonist): string {
  return `${c.id}-${c.role}-${c.look.shirt}-${c.look.hair}${c.raider?.leader ? '-lider' : ''}`;
}

/** Dibuja un montón pixel art de 12×10 para un recurso. */
export function paintItem(ctx: CanvasRenderingContext2D, r: ResourceId): void {
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  px(1, 9, 10, 1, 'rgba(0,0,0,0.35)'); // sombra
  switch (r) {
    case 'madera':
      // Tres troncos apilados con las puntas claras.
      for (const [x, y] of [[1, 5], [6, 5], [3, 1]]) {
        px(x, y, 5, 4, '#1a1410');
        px(x + 1, y + 1, 3, 2, '#7a5634');
        px(x + 1, y + 1, 1, 2, '#c9a26a');
      }
      break;
    case 'piedra':
      // Bloques de piedra grises.
      for (const [x, y, w] of [[1, 5, 5], [6, 5, 5], [3, 1, 6]]) {
        px(x, y, w, 4, '#22201e');
        px(x + 1, y + 1, w - 2, 2, '#8c8a84');
        px(x + 1, y + 1, w - 2, 1, '#b4b1a8');
      }
      break;
    case 'chatarra':
      // Chapas y barras oxidadas.
      px(1, 5, 10, 4, '#1a1410');
      px(2, 6, 8, 2, '#8a4a26');
      px(3, 6, 2, 1, '#c27a3e');
      px(7, 7, 2, 1, '#5c5a56');
      px(4, 2, 5, 3, '#1a1410');
      px(5, 3, 3, 1, '#a35a2c');
      px(9, 1, 1, 4, '#6e6c66');
      break;
    case 'componentes':
      // Caja con un engranaje.
      px(1, 2, 10, 7, '#1a1410');
      px(2, 3, 8, 5, '#5a6b4a');
      px(2, 3, 8, 1, '#7d8f68');
      px(5, 4, 2, 3, '#d8c27a');
      px(4, 5, 4, 1, '#d8c27a');
      break;
    case 'patata':
    case 'maiz':
    case 'setas': {
      // Cesto de mimbre con la cosecha encima.
      const fill = r === 'patata' ? ['#b08a52', '#8a6a3a'] : r === 'maiz' ? ['#e0c040', '#a08a20'] : ['#c8b8a0', '#a85a3a'];
      px(1, 5, 10, 4, '#1a1410');
      px(2, 5, 8, 3, '#8a6a3a');
      for (let x = 2; x < 10; x += 2) px(x, 6, 1, 2, '#6a4e2a');
      px(2, 2, 8, 3, '#1a1410');
      for (const [x, y] of [[3, 3], [5, 2], [7, 3], [4, 4], [8, 4]]) px(x, y, 2, 1, fill[(x + y) % 2]);
      break;
    }
    case 'hormigon':
      // Bloques de hormigón.
      for (const [x, y] of [[1, 5], [6, 5], [3, 2]]) {
        px(x, y, 5, 3, '#1a1410');
        px(x + 1, y, 3, 2, '#a8a49c');
        px(x + 1, y + 1, 1, 1, '#86827a');
      }
      break;
    case 'metal':
      // Lingotes apilados.
      for (const [x, y] of [[1, 5], [6, 5], [3, 2]]) {
        px(x, y, 5, 3, '#1a1410');
        px(x + 1, y, 3, 2, '#9aa0a6');
        px(x + 1, y, 3, 1, '#c8ccd0');
      }
      break;
    case 'hierba':
      // Manojos de hierba curativa atados.
      px(1, 3, 10, 6, '#1a1410');
      px(2, 4, 3, 4, '#5a9a5a');
      px(7, 4, 3, 4, '#5a9a5a');
      px(2, 4, 3, 1, '#8ac06a');
      px(7, 4, 3, 1, '#8ac06a');
      px(3, 2, 1, 2, '#e8e0a0');
      px(8, 2, 1, 2, '#e8e0a0');
      px(5, 6, 2, 1, '#c8a060');
      break;
    case 'fibra':
      // Madejas de fibra atadas.
      px(1, 3, 10, 6, '#1a1410');
      px(2, 4, 8, 4, '#8ac06a');
      px(2, 5, 8, 1, '#5a8a44');
      px(5, 3, 2, 6, '#c8a060');
      break;
    case 'comida':
      // Olla de guiso con vapor.
      px(1, 4, 10, 5, '#1a1410');
      px(2, 5, 8, 3, '#5c5a56');
      px(2, 5, 8, 1, '#8a8780');
      px(0, 5, 1, 2, '#1a1410');
      px(11, 5, 1, 2, '#1a1410');
      px(3, 4, 6, 1, '#b0703a'); // el guiso asomando
      px(4, 1, 1, 2, 'rgba(230,230,230,0.6)');
      px(7, 0, 1, 3, 'rgba(230,230,230,0.6)');
      break;
    // --- Armas: tumbadas en el suelo, en diagonal ---
    case 'palo':
      for (let i = 0; i < 8; i++) px(2 + i, 8 - i, 2, 2, i < 3 ? '#3a2a1a' : '#7a5634');
      break;
    case 'cuchillo':
      px(2, 7, 3, 2, '#3a2a1a'); // mango
      for (let i = 0; i < 5; i++) px(5 + i, 6 - i, 1, 2, '#c8c8c0');
      break;
    case 'tuberia':
      for (let i = 0; i < 8; i++) px(2 + i, 8 - i, 2, 2, '#5c5a56');
      px(2, 8, 2, 1, '#8a4a26');
      px(9, 1, 2, 2, '#8a8780');
      break;
    case 'lanza':
      for (let i = 0; i < 9; i++) px(1 + i, 9 - i, 1, 1, '#7a5634');
      px(9, 0, 2, 2, '#b4b1a8');
      px(10, 0, 1, 1, '#e0ded6');
      break;
    case 'machete':
      px(1, 7, 3, 2, '#1a1410');
      for (let i = 0; i < 6; i++) px(4 + i, 6 - i, 2, 2, '#a8aca8');
      px(9, 1, 1, 1, '#e0e4e0');
      break;
    case 'arco':
      // Arco de madera con su cuerda.
      for (let i = 0; i < 8; i++) px(3 + Math.round(Math.sin((i / 7) * Math.PI) * 3), 1 + i, 2, 1, '#7a5634');
      px(3, 1, 1, 8, 'rgba(220,210,190,0.8)');
      break;
    case 'chaleco_cuero':
    case 'chaleco_chapa':
    case 'chaleco_metal': {
      const [base, light] = r === 'chaleco_cuero' ? ['#7a5634', '#a57a48'] : r === 'chaleco_chapa' ? ['#8a4a26', '#c27a3e'] : ['#6e747a', '#9aa0a6'];
      px(2, 1, 8, 8, '#1a1410');
      px(3, 2, 6, 6, base);
      px(3, 2, 6, 1, light);
      px(5, 1, 2, 2, '#1a1410'); // cuello
      break;
    }
    case 'casco_chapa':
    case 'casco_metal': {
      const [base, light] = r === 'casco_chapa' ? ['#8a4a26', '#c27a3e'] : ['#6e747a', '#b4b8bc'];
      px(2, 3, 8, 6, '#1a1410');
      px(3, 4, 6, 4, base);
      px(4, 4, 3, 1, light);
      px(1, 7, 10, 1, '#1a1410');
      break;
    }
    case 'flechas':
      for (const y of [3, 5, 7]) {
        px(2, y, 7, 1, '#9a7650');
        px(9, y - 1, 1, 3, '#b4b1a8');
        px(1, y - 1, 1, 3, '#d8c27a');
      }
      break;
  }
}

/** Dibuja una planta de 16×16 en una de sus fases (0 sembrada … 3 madura). */
export function paintCrop(ctx: CanvasRenderingContext2D, crop: CropDef, stage: number): void {
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const { leaf, dark, fruit } = crop.colors;
  // Montoncito de tierra removida.
  px(3, 13, 10, 2, '#3a2a1a');
  px(4, 12, 8, 1, '#5a4228');
  if (stage === 0) {
    px(6, 12, 1, 1, '#8a6a40');
    px(9, 12, 1, 1, '#8a6a40');
    return;
  }
  if (crop.id === 'setas') {
    // Setas: pies claros y sombreros que crecen.
    const caps = stage === 1 ? [[7, 10, 2]] : stage === 2 ? [[5, 9, 3], [9, 10, 2]] : [[3, 7, 4], [8, 8, 4], [6, 10, 3]];
    for (const [x, y, w] of caps) {
      px(x + Math.floor(w / 2), y + 1, 1, 12 - y, leaf);
      px(x, y, w, 2, stage === 3 ? fruit : dark);
      px(x, y, w, 1, stage === 3 ? '#d08060' : leaf);
    }
    return;
  }
  const h = stage === 1 ? 3 : stage === 2 ? 7 : crop.id === 'maiz' || crop.id === 'canamo' ? 12 : 9;
  // Tallo y hojas alternas.
  px(7, 13 - h, 2, h, dark);
  for (let k = 1; k < h; k += 2) {
    const y = 13 - k;
    px(k % 4 === 1 ? 4 : 9, y, 3, 1, leaf);
  }
  px(6, 13 - h, 4, 1, leaf);
  if (stage === 3) {
    if (crop.id === 'maiz') {
      px(9, 5, 2, 4, fruit);
      px(5, 7, 2, 3, fruit);
    } else if (crop.id === 'patata') {
      px(4, 11, 2, 2, fruit);
      px(10, 11, 2, 2, fruit);
      px(6, 4, 1, 1, '#e0e0c0');
      px(9, 5, 1, 1, '#e0e0c0');
    } else {
      px(5, 2, 6, 2, fruit);
      px(4, 4, 8, 1, fruit);
    }
  }
}
