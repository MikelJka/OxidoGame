// Dibujo pixel art de construcciones (muros y puertas) sobre un lienzo 2D.
// La pieza tiene la cara de arriba (TILE × tileH) y debajo el frente (TILE × wallH).
import type { BuildingDef } from '../data/buildings';

/** Altura del frente de un muro para una elevación de nivel dada (px). */
export function wallHeight(lift: number): number {
  return lift + 2;
}

/** Alto en píxeles del frente de una construcción (muro normal, alto o torre). */
export function faceHeight(def: BuildingDef, lift: number): number {
  return wallHeight(lift) * def.height;
}

/**
 * Dibuja una construcción. `tile` = ancho, `tileH` = alto de la cara de arriba, `wallH` = alto
 * de un piso de muro (la construcción mide `def.height` pisos).
 */
export function drawBuilding(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, unitH: number): void {
  const { top, face, dark } = def.colors;
  const wallH = unitH * def.height;
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const outline = '#1a1410';
  const h = tileH + wallH;
  px(0, 0, tile, h, outline);
  if (def.category === 'torre') {
    drawTower(ctx, def, tile, tileH, wallH);
    return;
  }
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

/** Torre de vigía: plataforma con barandilla arriba y patas (o fuste de piedra) debajo. */
function drawTower(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, wallH: number): void {
  const { top, face, dark } = def.colors;
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const outline = '#1a1410';
  ctx.clearRect(0, 0, tile, tileH + wallH);
  const h = tileH + wallH;
  if (def.id.includes('piedra')) {
    // Fuste macizo algo más estrecho que la casilla, con sillares.
    px(2, tileH - 1, tile - 4, wallH + 1, outline);
    px(3, tileH - 1, tile - 6, wallH, face);
    for (let y = tileH + 3; y < h - 1; y += 4) px(3, y, tile - 6, 1, dark);
    px(7, tileH + 4, 2, 3, outline); // tronera
  } else {
    // Cuatro patas (se ven las dos de delante) con riostras en aspa.
    px(1, tileH - 1, 3, wallH + 1, outline);
    px(tile - 4, tileH - 1, 3, wallH + 1, outline);
    px(2, tileH - 1, 1, wallH, face);
    px(tile - 3, tileH - 1, 1, wallH, face);
    for (let k = 0; k < wallH - 2; k++) {
      const x = 3 + Math.floor((k * (tile - 7)) / Math.max(1, wallH - 3));
      px(x, tileH + k, 1, 1, dark);
      px(tile - 4 - (x - 3), tileH + k, 1, 1, dark);
    }
    if (def.id.includes('chatarra')) px(3, tileH + Math.floor(wallH / 2), tile - 6, 2, face);
  }
  // Plataforma con barandilla.
  px(0, 0, tile, tileH, outline);
  px(1, 1, tile - 2, tileH - 2, top);
  for (let x = 2; x < tile - 2; x += 3) px(x, 2, 1, tileH - 4, dark);
  px(0, tileH - 2, tile, 2, dark);
}

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.min(255, v + 30);
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
