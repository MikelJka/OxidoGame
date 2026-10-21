// Dibujos pixel art de colonos y plantas sobre un lienzo 2D.
// Los usa la vista 2D (Phaser). Los montones están en itemArt.ts.
import type { Colonist } from '../sim/colonist';
import type { CreatureId } from '../data/creatures';
import type { CropDef } from '../data/crops';

/** Tamaños de los dibujos (px). */
export const COLONIST_SIZE = 16;
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
  // Las criaturas tienen su propio dibujo (según su id, para que otro motor ponga su modelo).
  if (c.creature) {
    paintCreature(px, c.creature);
    return;
  }
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
  } else if (c.role === 'aliado') {
    px(5, 3, 6, 1, '#3a7ac0'); // pañuelo azul de los aliados
    px(4, 3, 1, 2, '#3a7ac0');
    px(4, 8, 1, 2, '#3a7ac0'); // brazalete
  }
}

/** Dibujo de una criatura de 16×16, mirando a la derecha (el sprite se voltea). */
function paintCreature(px: (x: number, y: number, w: number, h: number, color: string) => void, id: CreatureId): void {
  const outline = '#1a1410';
  switch (id) {
    case 'perro_mutante': {
      // Perro flaco y sarnoso, piel gris verdosa con calvas rosadas y ojo brillante.
      const fur = '#6b6f4a';
      const dark = '#474a30';
      px(2, 14, 12, 1, 'rgba(0,0,0,0.35)'); // sombra
      // Patas
      for (const x of [3, 5, 10, 12]) {
        px(x, 11, 1, 3, outline);
      }
      // Cuerpo
      px(2, 6, 10, 6, outline);
      px(3, 7, 8, 4, fur);
      px(3, 10, 8, 1, dark);
      px(5, 7, 2, 1, '#c98a8a'); // calva
      px(8, 9, 2, 1, '#c98a8a');
      // Lomo erizado
      px(4, 5, 1, 1, outline);
      px(6, 5, 1, 1, outline);
      px(8, 5, 1, 1, outline);
      // Cola
      px(0, 5, 2, 1, outline);
      px(1, 6, 1, 1, dark);
      // Cabeza y hocico
      px(10, 3, 5, 5, outline);
      px(11, 4, 3, 3, fur);
      px(14, 6, 2, 2, outline);
      px(11, 2, 1, 2, outline); // oreja
      px(13, 4, 1, 1, '#d4ff4a'); // ojo
      px(14, 8, 1, 1, '#e8e0c8'); // colmillo
      break;
    }
    case 'bruto_mutante': {
      // Mole jorobada de piel verde grisácea con bultos, brazos enormes hasta el suelo y un ojo rojo.
      const skin = '#6f7d52';
      const dark = '#4a5636';
      const lump = '#9a8a5a';
      px(1, 14, 14, 2, 'rgba(0,0,0,0.4)'); // sombra
      // Piernas cortas y gruesas
      px(4, 11, 3, 4, outline);
      px(9, 11, 3, 4, outline);
      px(5, 12, 1, 2, dark);
      px(10, 12, 1, 2, dark);
      // Torso ancho, joroba
      px(2, 3, 12, 9, outline);
      px(3, 4, 10, 7, skin);
      px(3, 9, 10, 2, dark);
      px(4, 3, 4, 1, outline); // joroba
      px(5, 5, 2, 1, lump); // bultos
      px(9, 7, 2, 2, lump);
      px(4, 8, 1, 1, lump);
      // Brazos enormes que llegan al suelo, puño derecho más grande
      px(0, 5, 2, 8, outline);
      px(1, 6, 1, 6, dark);
      px(14, 5, 2, 7, outline);
      px(13, 11, 3, 3, outline);
      px(14, 12, 1, 1, skin);
      // Cabeza pequeña hundida entre los hombros
      px(8, 1, 5, 4, outline);
      px(9, 2, 3, 2, skin);
      px(11, 2, 1, 1, '#ff3a2a'); // ojo
      px(10, 4, 3, 1, '#e8e0c8'); // dientes
      break;
    }
    case 'arana_chatarra': {
      // Araña de chatarra: cuerpo de chapa remachada y oxidada sobre ocho patas de tubo, con un ojo rojo.
      const plate = '#7a7f86';
      const dark = '#4a4e54';
      const rust = '#8a4a24';
      px(1, 14, 14, 1, 'rgba(0,0,0,0.4)'); // sombra
      // Patas: cuatro a cada lado, dobladas hacia arriba y bajando al suelo
      for (const [x, k] of [[1, 0], [3, 1], [11, 1], [13, 0]] as const) {
        px(x, 8 - k, 2, 1, outline);
        px(x + (x < 8 ? 0 : 1), 9 - k, 1, 5 + k, outline);
      }
      px(0, 10, 2, 1, dark);
      px(14, 10, 2, 1, dark);
      // Cuerpo: abdomen trasero y cabeza delante
      px(3, 5, 7, 6, outline);
      px(4, 6, 5, 4, plate);
      px(4, 9, 5, 1, dark);
      px(5, 6, 2, 1, rust); // óxido
      px(7, 8, 1, 1, '#c9ced4'); // remache
      px(5, 8, 1, 1, '#c9ced4');
      px(9, 6, 5, 5, outline);
      px(10, 7, 3, 3, dark);
      px(12, 7, 1, 1, '#ff2a1a'); // ojo
      px(13, 10, 2, 1, '#c9ced4'); // pinzas
      // Antena
      px(10, 4, 1, 2, outline);
      px(10, 3, 1, 1, '#ff2a1a');
      break;
    }
    case 'gallina_mutada': {
      // Gallina mutada: cuerpo redondo pardo, cresta roja (doble) y patas finas.
      px(4, 14, 8, 1, 'rgba(0,0,0,0.35)');
      px(6, 12, 1, 2, '#d8a030');
      px(9, 12, 1, 2, '#d8a030');
      px(3, 7, 9, 6, outline);
      px(4, 8, 7, 4, '#b07a48');
      px(4, 11, 7, 1, '#7a5030');
      px(2, 6, 3, 3, '#5a3a20'); // cola
      px(10, 4, 4, 5, outline); // cabeza
      px(11, 5, 2, 3, '#b07a48');
      px(12, 5, 1, 1, '#c8e040'); // ojo
      px(14, 6, 1, 1, '#e8b030'); // pico
      px(10, 3, 1, 1, '#d83a2a'); // cresta (dos)
      px(12, 2, 1, 2, '#d83a2a');
      px(13, 3, 1, 1, '#d83a2a');
      break;
    }
    case 'ciervo_mutado':
    case 'jabali':
    case 'mula':
    case 'cabra_salvaje':
    case 'vaca_dos_cabezas':
    case 'caballo_salvaje':
    case 'rata_gigante': {
      // Animales: cuerpo, patas, cabeza y lo suyo (cuernos torcidos, colmillos o cola pelada).
      const ANIMAL_FUR: Record<string, [string, string, number]> = {
        ciervo_mutado: ['#8a6a44', '#5e4630', 1],
        jabali: ['#5a4a3a', '#3a2e24', 1],
        mula: ['#7a6a5a', '#4a4036', 1],
        cabra_salvaje: ['#c8bca4', '#8a8070', 0],
        vaca_dos_cabezas: ['#e0dcd0', '#5a4a40', 1],
        caballo_salvaje: ['#7a4a2a', '#4a2a18', 1],
      };
      const [fur, dark, big] = ANIMAL_FUR[id] ?? ['#6a6260', '#4a4442', 0];
      px(2, 14, 12, 1, 'rgba(0,0,0,0.35)'); // sombra
      for (const x of big ? [3, 5, 10, 12] : [4, 6, 9, 11]) px(x, big ? 10 : 12, 1, big ? 4 : 2, outline);
      px(2, big ? 5 : 8, 10, big ? 6 : 5, outline);
      px(3, big ? 6 : 9, 8, big ? 4 : 3, fur);
      px(3, big ? 9 : 11, 8, 1, dark);
      px(11, big ? 4 : 8, 4, big ? 4 : 3, outline); // cabeza
      px(12, big ? 5 : 9, 2, big ? 2 : 1, fur);
      px(13, big ? 5 : 9, 1, 1, '#c8e040'); // ojo
      if (id === 'ciervo_mutado') {
        px(11, 0, 1, 4, '#d8c8a0'); // cuernos
        px(13, 1, 1, 3, '#d8c8a0');
        px(10, 1, 1, 1, '#d8c8a0');
      } else if (id === 'mula') {
        px(12, 1, 1, 3, fur); // orejas largas
        px(14, 1, 1, 3, fur);
        px(4, 5, 6, 1, '#a07040'); // alforjas
      } else if (id === 'jabali') {
        px(15, 7, 1, 1, '#e8e0c8'); // colmillo
        px(3, 4, 6, 1, dark); // cerdas
      } else if (id === 'cabra_salvaje') {
        px(11, 5, 1, 3, '#9a8a6a'); // cuernos curvos hacia atrás
        px(10, 4, 1, 2, '#9a8a6a');
        px(13, 6, 1, 2, '#9a8a6a');
        px(14, 12, 1, 1, '#e8e0d0'); // barba
      } else if (id === 'vaca_dos_cabezas') {
        px(4, 7, 2, 2, dark); // manchas
        px(8, 6, 2, 2, dark);
        px(12, 8, 4, 4, outline); // la segunda cabeza, más baja y adelantada
        px(13, 9, 2, 2, fur);
        px(14, 9, 1, 1, '#c8e040');
        px(11, 3, 1, 1, '#e8e0c8'); // cuernos cortos
        px(14, 3, 1, 1, '#e8e0c8');
        px(15, 7, 1, 1, '#e8e0c8');
      } else if (id === 'caballo_salvaje') {
        px(10, 3, 1, 4, dark); // crin
        px(1, 6, 1, 4, dark); // cola
      } else {
        px(0, 10, 2, 1, '#c89a9a'); // cola
        px(1, 11, 1, 1, '#c89a9a');
      }
      break;
    }
    case 'dron_vigilancia': {
      // Dron de vigilancia: cuatro rotores sobre brazos en cruz, un cuerpo de chapa con su cámara roja
      // y el cañón debajo; la sombra queda lejos, en el suelo, porque vuela.
      const plate = '#8a9098';
      const dark = '#4a4e54';
      px(5, 15, 6, 1, 'rgba(0,0,0,0.3)'); // sombra en el suelo
      // Brazos
      px(3, 4, 10, 1, outline);
      px(3, 9, 10, 1, outline);
      // Rotores (discos borrosos)
      for (const [x, y] of [[1, 3], [11, 3], [1, 8], [11, 8]] as const) {
        px(x, y, 4, 1, 'rgba(200,210,220,0.55)');
        px(x + 1, y + 1, 2, 1, outline);
      }
      // Cuerpo
      px(5, 4, 6, 6, outline);
      px(6, 5, 4, 4, plate);
      px(6, 8, 4, 1, dark);
      px(7, 6, 2, 2, '#1a1a1a'); // cámara
      px(8, 6, 1, 1, '#ff2a1a'); // luz roja
      // Cañón
      px(7, 10, 2, 2, outline);
      break;
    }
  }
}

/**
 * Cadáver de una criatura (por su id): su mismo dibujo, apagado y manchado, para tumbarlo en el suelo.
 * `rot` va de 0 (recién muerto) a 1 (podrido): cuanto más podrido, más oscuro y con más moscas.
 */
export function paintCorpse(ctx: CanvasRenderingContext2D, id: CreatureId, rot: number): void {
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  paintCreature(px, id);
  // Apagado: se pinta encima solo donde ya hay dibujo.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = `rgba(52,40,26,${(0.35 + 0.35 * rot).toFixed(2)})`;
  ctx.fillRect(0, 0, COLONIST_SIZE, COLONIST_SIZE);
  ctx.restore();
  // Mancha de sangre seca y moscas.
  px(3, 14, 10, 1, 'rgba(90,20,14,0.55)');
  const flies = rot < 0.34 ? 1 : rot < 0.67 ? 2 : 3;
  const spots = [[2, 2], [12, 1], [7, 0]];
  for (let i = 0; i < flies; i++) px(spots[i][0], spots[i][1], 1, 1, '#141414');
}

/** Clave de textura: cambia si cambia su papel (un prisionero que se une ya no lleva mono). */
export function colonistLookKey(c: Colonist): string {
  return `${c.id}-${c.creature ?? c.role}-${c.look.shirt}-${c.look.hair}${c.raider?.leader ? '-lider' : ''}`;
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
