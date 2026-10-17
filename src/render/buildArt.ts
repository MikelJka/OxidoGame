// Dibujo pixel art de construcciones (muros y puertas) sobre un lienzo 2D.
// La pieza tiene la cara de arriba (TILE × tileH) y debajo el frente (TILE × wallH).
import type { BuildingDef } from '../data/buildings';

/** Altura del frente de un muro para una elevación de nivel dada (px). */
export function wallHeight(lift: number): number {
  return lift + 2;
}

/** Dibuja una construcción. `tile` = ancho, `tileH` = alto de la cara de arriba, `wallH` = alto del frente. */
export function drawBuilding(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, wallH: number): void {
  const { top, face, dark } = def.colors;
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const outline = '#1a1410';
  const h = tileH + wallH;
  px(0, 0, tile, h, outline);
  if (def.category === 'puerta') {
    // Marco con la hoja de la puerta en el frente; arriba, el dintel.
    px(1, 1, tile - 2, tileH - 2, top);
    px(1, tileH - 1, tile - 2, wallH, dark);
    px(3, tileH, tile - 6, wallH - 1, face);
    for (let x = 5; x < tile - 3; x += 3) px(x, tileH, 1, wallH - 1, dark);
    px(tile - 6, tileH + Math.floor(wallH / 2), 2, 1, '#d8c27a'); // tirador
    return;
  }
  // Cara de arriba con un borde claro.
  px(1, 1, tile - 2, tileH - 2, top);
  px(1, 1, tile - 2, 1, lighten(top));
  // Frente con textura según el material.
  px(1, tileH - 1, tile - 2, wallH, face);
  px(1, h - 2, tile - 2, 1, dark);
  if (def.id.includes('piedra')) {
    // Sillares en hileras alternas.
    for (let row = 0, y = tileH + 2; y < h - 2; row++, y += 4) {
      px(1, y, tile - 2, 1, dark);
      for (let x = row % 2 === 0 ? 4 : 1; x < tile - 1; x += 6) px(x, y - 3 < tileH ? tileH : y - 3, 1, 3, dark);
    }
  } else if (def.id.includes('madera')) {
    // Tablones verticales.
    for (let x = 4; x < tile - 1; x += 4) px(x, tileH, 1, wallH - 2, dark);
    for (let x = 2; x < tile - 1; x += 4) px(x, 1, 1, tileH - 2, dark);
  } else {
    // Chapas remachadas.
    px(1, tileH + Math.floor(wallH / 2), tile - 2, 1, dark);
    for (let x = 3; x < tile - 2; x += 5) {
      px(x, tileH + 1, 1, 1, lighten(face));
      if (wallH > 6) px(x, h - 4, 1, 1, lighten(face));
    }
    px(Math.floor(tile / 2), tileH, 2, Math.max(2, Math.floor(wallH / 3)), dark);
  }
}

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.min(255, v + 30);
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
