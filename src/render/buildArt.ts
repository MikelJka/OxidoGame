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
  if (def.storage) {
    drawShelf(ctx, def, tile, tileH, wallH);
    return;
  }
  if (def.category === 'electricidad') {
    drawElectric(ctx, def, tile, tileH, wallH);
    return;
  }
  if (def.category === 'suelo' || def.category === 'mueble' || (def.category === 'defensa' && def.height === 0)) {
    drawFlat(ctx, def, tile, tileH);
    return;
  }
  if (def.category === 'agua') {
    drawWater(ctx, def, tile, tileH, wallH);
    return;
  }
  if (def.category === 'taller') {
    drawStation(ctx, def, tile, tileH, wallH);
    return;
  }
  if (def.category === 'porton') {
    drawGate(ctx, def, tile, tileH, wallH);
    return;
  }
  if (def.turret) {
    drawTurret(ctx, def, tile, tileH, wallH);
    return;
  }
  if (def.category === 'defensa') {
    drawBarricade(ctx, def, tile, tileH, wallH);
    return;
  }
  if (def.category === 'puerta') {
    // Marco con la hoja de la puerta en el frente; arriba, el dintel.
    px(1, 1, tile - 2, tileH - 2, top);
    px(1, tileH - 1, tile - 2, wallH, dark);
    px(3, tileH, tile - 6, wallH - 1, face);
    for (let x = 5; x < tile - 3; x += 3) px(x, tileH, 1, wallH - 1, dark);
    px(tile - 6, tileH + Math.floor(wallH / 2), 2, 1, '#d8c27a'); // tirador
    if (def.autoDoor) px(Math.floor(tile / 2) - 1, tileH - 1, 2, 1, '#7fe07a'); // piloto de la puerta automática
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

/** Talleres: horno de fundición (boca encendida y chimenea) o banco de trabajo (tablero con herramientas). */
function drawStation(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, wallH: number): void {
  const { top, face, dark } = def.colors;
  const px = painter(ctx);
  const h = tileH + wallH;
  ctx.clearRect(0, 0, tile, h);
  if (def.id === 'cantera') {
    // Pila de bloques cortados con un trípode de poleas.
    px(1, tileH - 2, tile - 2, wallH + 2, '#1a1410');
    for (let y = tileH - 1, row = 0; y < h - 1; y += 3, row++) {
      for (let x = 2 + (row % 2) * 2; x < tile - 3; x += 4) px(x, y, 3, 2, row % 2 ? top : face);
    }
    px(3, 0, 1, tileH, '#5a4228');
    px(12, 0, 1, tileH, '#5a4228');
    px(3, 0, 10, 1, '#5a4228');
    px(8, 1, 1, tileH - 2, '#8a9096'); // cuerda
    return;
  }
  if (def.id === 'recicladora') {
    // Tolva con una cinta y chatarra cayendo.
    px(1, 1, tile - 2, h - 1, '#1a1410');
    px(2, 2, tile - 4, tileH - 3, top);
    px(4, 3, tile - 8, tileH - 5, '#2a2420');
    px(2, tileH - 1, tile - 4, wallH - 1, face);
    px(2, h - 4, tile - 4, 2, dark);
    for (let x = 3; x < tile - 3; x += 3) px(x, h - 4, 1, 2, '#8a9096');
    px(6, 4, 2, 1, '#c27a3e');
    px(9, 5, 2, 1, '#8a9096');
    return;
  }
  if (def.id === 'horno') {
    px(1, 1, tile - 2, h - 1, '#1a1410');
    px(2, 2, tile - 4, tileH - 3, top);
    px(2, tileH - 1, tile - 4, wallH - 1, face);
    for (let y = tileH + 2; y < h - 2; y += 3) px(2, y, tile - 4, 1, dark);
    // Boca con brasas.
    const my = tileH + Math.max(1, Math.floor(wallH / 3));
    px(5, my, 6, Math.max(2, wallH - (my - tileH) - 2), '#2a1a10');
    px(6, my + 1, 4, 1, '#e07a2a');
    px(6, my + 2, 4, 1, '#f0b040');
    // Chimenea.
    px(10, 0, 3, 4, '#1a1410');
    px(11, 0, 1, 3, dark);
    return;
  }
  if (def.id === 'destileria') {
    // Alambique de cobre con serpentín, fuego debajo y un bidón de combustible al lado.
    px(1, 1, tile - 2, h - 1, '#1a1410');
    px(2, 2, tile - 4, tileH - 3, dark);
    px(3, 1, 7, h - 3, '#1a1410');
    px(4, 2, 5, h - 6, top); // caldera
    px(5, 3, 1, h - 9, '#e0a060'); // brillo
    px(4, h - 4, 5, 2, '#2a1a10');
    px(5, h - 4, 3, 1, '#e07a2a'); // fuego
    px(9, 3, 3, 1, '#8a9096'); // tubo
    for (let y = 4; y < tileH + 2; y += 2) px(11, y, 2, 1, '#8a9096'); // serpentín
    px(10, tileH + 1, 5, wallH - 2, '#1a1410');
    px(11, tileH + 2, 3, wallH - 4, '#a03a2a'); // bidón
    px(11, tileH + 3, 3, 1, '#d0c050');
    return;
  }
  if (def.id === 'mesa_boticario') {
    // Mesa con un mortero, frascos y un manojo de hierbas colgando.
    px(0, 1, tile, tileH - 1, '#1a1410');
    px(1, 2, tile - 2, tileH - 3, top);
    px(1, tileH - 1, tile - 2, 2, face);
    px(1, tileH + 1, 2, wallH - 1, dark);
    px(tile - 3, tileH + 1, 2, wallH - 1, dark);
    px(3, 3, 4, 3, '#5c5a56'); // mortero
    px(4, 3, 2, 1, '#8a8780');
    px(6, 1, 1, 3, '#7a5634'); // mano del mortero
    px(9, 2, 2, 4, '#1a1410'); // frascos
    px(9, 3, 2, 2, '#6aa0c0');
    px(12, 3, 2, 3, '#1a1410');
    px(12, 4, 2, 1, '#c04040');
    px(2, tileH - 3, 4, 1, '#5a9a5a'); // hierbas
    px(3, tileH - 4, 2, 1, '#2e6a3a');
    return;
  }
  if (def.id === 'cocina') {
    // Fogón de piedra con dos ollas encima y fuego en la boca.
    px(1, 1, tile - 2, h - 1, '#1a1410');
    px(2, 2, tile - 4, tileH - 3, top);
    px(2, tileH - 1, tile - 4, wallH - 1, face);
    const my = tileH + Math.max(1, Math.floor(wallH / 3));
    px(4, my, 8, Math.max(2, wallH - (my - tileH) - 2), '#2a1a10');
    px(5, my + 1, 6, 1, '#e07a2a');
    px(3, 2, 4, 3, '#3a3836'); // olla
    px(4, 2, 2, 1, '#b0703a');
    px(9, 3, 4, 2, '#5c5a56'); // sartén
    px(13, 3, 2, 1, '#1a1410');
    return;
  }
  // Banco: tablero, patas y herramientas encima.
  px(0, 1, tile, tileH - 1, '#1a1410');
  px(1, 2, tile - 2, tileH - 3, top);
  px(1, tileH - 1, tile - 2, 2, face);
  px(1, tileH + 1, 2, wallH - 1, dark);
  px(tile - 3, tileH + 1, 2, wallH - 1, dark);
  px(3, 3, 5, 1, '#8a9096'); // sierra
  px(10, 3, 1, 4, '#5a4228'); // martillo
  px(9, 3, 3, 1, '#8a9096');
  px(4, tileH - 4, 3, 2, '#c08040');
}

/** Estantería: dos postes traseros, baldas y el estante de abajo libre para lo que se guarde delante. */
function drawShelf(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, wallH: number): void {
  const { top, face, dark } = def.colors;
  const px = painter(ctx);
  const h = tileH + wallH;
  ctx.clearRect(0, 0, tile, h);
  // Postes.
  px(0, 0, 2, h, '#1a1410');
  px(tile - 2, 0, 2, h, '#1a1410');
  px(0, 0, 1, h, face);
  px(tile - 2, 0, 1, h, face);
  if (def.id === 'armario') {
    // Armario cerrado: dos puertas con tiradores.
    px(1, 0, tile - 2, h, '#1a1410');
    px(2, 1, tile - 4, tileH - 2, top);
    px(2, tileH - 1, tile - 4, wallH, face);
    px(Math.floor(tile / 2), tileH - 1, 1, wallH, dark);
    px(Math.floor(tile / 2) - 2, tileH + Math.floor(wallH / 2), 1, 2, '#d8c27a');
    px(Math.floor(tile / 2) + 2, tileH + Math.floor(wallH / 2), 1, 2, '#d8c27a');
    return;
  }
  // Baldas.
  for (let y = 1; y < h - 2; y += Math.max(3, Math.floor(h / 4))) {
    px(1, y, tile - 2, 2, '#1a1410');
    px(1, y, tile - 2, 1, top);
  }
  px(1, h - 2, tile - 2, 2, dark);
}

/** Pozo (brocal de piedra con agua y travesaño) o depuradora (depósito con tubo). */
function drawWater(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, wallH: number): void {
  const { top, face, dark } = def.colors;
  const px = painter(ctx);
  const h = tileH + wallH;
  ctx.clearRect(0, 0, tile, h);
  if (def.id === 'pozo') {
    const lip = Math.max(3, Math.floor(wallH / 2));
    px(1, tileH - 2, tile - 2, lip + 3, '#1a1410');
    px(2, tileH - 1, tile - 4, lip + 1, face);
    px(2, 1, tile - 4, tileH - 2, '#1a1410');
    px(3, 2, tile - 6, tileH - 4, top);
    px(2, 0, 1, tileH, '#5a4228');
    px(tile - 3, 0, 1, tileH, '#5a4228');
    px(2, 0, tile - 4, 1, '#5a4228');
    px(Math.floor(tile / 2), 1, 1, 3, '#8a9096');
    return;
  }
  px(1, 1, tile - 2, h - 1, '#1a1410');
  px(2, 2, tile - 4, tileH - 3, top);
  px(2, tileH - 1, tile - 4, wallH - 1, face);
  for (let y = tileH + 1; y < h - 2; y += 3) px(2, y, tile - 4, 1, dark);
  px(tile - 5, tileH + 2, 4, 2, '#8a9096');
  px(4, 4, 3, 2, '#9ad0e0');
}

type Px = (x: number, y: number, w: number, h: number, color: string) => void;
function painter(ctx: CanvasRenderingContext2D): Px {
  return (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
}

/** Cosas a ras de suelo: suelos, pinchos y muebles (solo la cara de arriba). */
function drawFlat(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number): void {
  const { top, face, dark } = def.colors;
  const px = painter(ctx);
  ctx.clearRect(0, 0, tile, tileH);
  if (def.category === 'suelo') {
    px(0, 0, tile, tileH, top);
    if (def.id.includes('madera')) {
      for (let y = 0; y < tileH; y += 3) px(0, y, tile, 1, face);
      px(Math.floor(tile / 2), 1, 1, 2, dark);
      px(3, 4, 1, 2, dark);
    } else if (def.id.includes('piedra')) {
      px(0, Math.floor(tileH / 2), tile, 1, dark);
      px(Math.floor(tile / 2), 0, 1, Math.floor(tileH / 2), dark);
      px(4, Math.floor(tileH / 2), 1, tileH - Math.floor(tileH / 2), dark);
      px(12, Math.floor(tileH / 2), 1, tileH - Math.floor(tileH / 2), dark);
    } else {
      // Chapa estriada.
      for (let y = 1; y < tileH; y += 3) for (let x = (y % 2) * 2; x < tile; x += 4) px(x, y, 2, 1, face);
    }
    px(0, tileH - 1, tile, 1, dark);
    return;
  }
  if (def.category === 'defensa') {
    // Pinchos: estacas afiladas en dos filas.
    for (let row = 0; row < 2; row++) {
      const y = Math.floor((tileH * (row + 1)) / 3);
      for (let x = 1 + row * 2; x < tile - 1; x += 4) {
        px(x, y - 3, 1, 4, dark);
        px(x + 1, y - 4, 1, 5, face);
        px(x + 1, y - 5, 1, 1, top);
      }
    }
    return;
  }
  // Cama: armazón, manta y almohada (en el lado corto de arriba o de la izquierda).
  px(1, 1, tile - 2, tileH - 2, '#1a1410');
  px(2, 2, tile - 4, tileH - 4, dark);
  px(3, 2, tile - 6, tileH - 5, face);
  if (tile > tileH * 1.3) {
    px(3, 3, 5, tileH - 7, '#d8d0bc');
    px(tile - 6, 2, 2, tileH - 5, top);
  } else {
    px(3, 2, tile - 6, 3, '#d8d0bc');
    px(3, tileH - 5, tile - 6, 2, top);
  }
  if (def.id === 'cama_prision') {
    // Grilletes: una cadena gris a los pies.
    const fy = tile > tileH * 1.3 ? Math.floor(tileH / 2) : tileH - 3;
    for (let x = 2; x < tile - 2; x += 2) px(x, fy, 1, 1, '#9aa0a8');
  }
}

/** Portón: hoja alta de tablones o chapa, pensado para ponerse en línea (las casillas se juntan). */
function drawGate(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, wallH: number): void {
  const { top, face, dark } = def.colors;
  const px = painter(ctx);
  const h = tileH + wallH;
  ctx.clearRect(0, 0, tile, h);
  // Viga superior (cara de arriba) y hoja (frente), sin bordes laterales para que se unan.
  px(0, 0, tile, tileH, '#1a1410');
  px(0, 1, tile, tileH - 2, top);
  px(0, tileH - 1, tile, wallH, face);
  px(0, h - 1, tile, 1, '#1a1410');
  const metal = def.id.includes('chapa');
  if (metal) {
    for (let y = tileH + 3; y < h - 1; y += 4) px(0, y, tile, 1, dark);
    px(1, tileH + 1, 1, 1, top);
    px(tile - 2, tileH + 1, 1, 1, top);
  } else {
    for (let x = 0; x < tile; x += 4) px(x, tileH, 1, wallH - 1, dark);
    // Travesaños y diagonal.
    px(0, tileH + 2, tile, 2, dark);
    px(0, h - 4, tile, 2, dark);
    for (let k = 0; k < tile; k++) px(k, tileH + 4 + Math.floor(((wallH - 8) * k) / tile), 1, 1, dark);
  }
}

/** Barricada: tablones cruzados o chatarra apilada, a media altura. */
function drawBarricade(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, wallH: number): void {
  const { top, face, dark } = def.colors;
  const px = painter(ctx);
  const h = tileH + wallH;
  ctx.clearRect(0, 0, tile, h);
  const y0 = Math.floor(tileH / 2);
  if (def.id.includes('madera')) {
    px(0, y0 + 2, tile, 3, '#1a1410');
    px(0, y0 + 3, tile, 1, top);
    for (let k = 0; k < tile; k++) {
      const a = y0 + Math.floor(((h - y0 - 2) * k) / tile);
      px(k, a, 1, 2, face);
      px(tile - 1 - k, a, 1, 2, dark);
    }
  } else {
    px(1, y0 + 1, tile - 2, h - y0 - 1, '#1a1410');
    px(2, y0 + 2, tile - 4, h - y0 - 3, face);
    px(2, y0 + 2, tile - 4, 1, top);
    px(4, y0 + 5, 5, 2, dark);
    px(9, h - 5, 4, 2, dark);
  }
}

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.min(255, v + 30);
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** Electricidad: cable a ras de suelo, generador, placa solar, molino, batería y lámpara. */
function drawElectric(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, wallH: number): void {
  const { top, face, dark } = def.colors;
  const px = painter(ctx);
  const h = tileH + wallH;
  ctx.clearRect(0, 0, tile, h);
  if (def.conduit) {
    // Cable de cobre en cruz con un empalme en el centro (se une con los de al lado).
    const cy = Math.floor(tileH / 2);
    const cx = Math.floor(tile / 2);
    px(0, cy, tile, 2, dark);
    px(cx - 1, 0, 2, tileH, dark);
    px(0, cy, tile, 1, top);
    px(cx - 1, 0, 1, tileH, top);
    px(cx - 2, cy - 1, 4, 4, face);
    return;
  }
  if (def.light) {
    // Farola: poste fino con la bombilla arriba.
    const cx = Math.floor(tile / 2);
    px(cx - 3, h - 3, 6, 2, '#1a1410');
    px(cx - 1, 2, 2, h - 4, face);
    px(cx - 3, 0, 6, 4, '#1a1410');
    px(cx - 2, 1, 4, 2, top);
    return;
  }
  if (def.source === 'solar') {
    // Placa solar: marco bajo con celdas azules en cuadrícula.
    const y0 = Math.max(0, h - tileH - 3);
    px(1, y0, tile - 2, tileH + 2, '#1a1410');
    px(2, y0 + 1, tile - 4, tileH, top);
    for (let x = 2 + 4; x < tile - 2; x += 5) px(x, y0 + 1, 1, tileH, face);
    for (let y = y0 + 4; y < y0 + 1 + tileH; y += 4) px(2, y, tile - 4, 1, face);
    px(3, y0 + 2, 2, 1, '#8fb4e0'); // brillo
    return;
  }
  if (def.source === 'wind') {
    // Molino: poste alto y aspas en cruz arriba.
    const cx = Math.floor(tile / 2);
    px(cx - 3, h - 3, 6, 2, '#1a1410');
    px(cx - 1, 6, 2, h - 8, face);
    const r = Math.min(7, Math.floor(tile / 2) - 1);
    px(cx - r, 5, r * 2, 1, top);
    px(cx, 5 - Math.min(5, r), 1, Math.min(5, r) * 2 + 1, top);
    px(cx - 1, 4, 3, 3, dark);
    return;
  }
  // Máquinas: caja con rejilla; el generador, con su chimenea; la batería, con sus bornes.
  px(1, 1, tile - 2, h - 1, '#1a1410');
  px(2, 2, tile - 4, tileH - 3, top);
  px(2, tileH - 1, tile - 4, wallH - 1, face);
  for (let x = 4; x < tile - 4; x += 3) px(x, tileH + 1, 1, Math.max(1, wallH - 3), dark);
  if (def.fuel) {
    px(tile - 7, 0, 3, 4, '#2a2826');
    px(4, 4, 4, 3, '#c27a3e'); // fuego por la portezuela
  } else if (def.battery) {
    px(4, 2, 2, 2, '#d9534f');
    px(tile - 6, 2, 2, 2, '#e0e4e0');
    px(4, tileH, tile - 8, 1, '#8fc060');
  }
}

/** Torreta: base blindada, cúpula arriba con el cañón hacia delante y un piloto verde. */
function drawTurret(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, wallH: number): void {
  const { top, face, dark } = def.colors;
  const px = painter(ctx);
  const h = tileH + wallH;
  ctx.clearRect(0, 0, tile, h);
  const big = tile > 20;
  // Base: un bloque con remaches.
  px(1, Math.floor(tileH / 2), tile - 2, h - Math.floor(tileH / 2), '#1a1410');
  px(2, Math.floor(tileH / 2) + 1, tile - 4, h - Math.floor(tileH / 2) - 2, face);
  px(2, h - 3, tile - 4, 1, dark);
  for (let x = 4; x < tile - 3; x += big ? 6 : 4) px(x, tileH + 1, 1, 1, top);
  // Cúpula.
  const cw = Math.max(6, Math.floor(tile * 0.55));
  const cx = Math.floor((tile - cw) / 2);
  const cy = Math.max(1, Math.floor(tileH / 2) - (big ? 6 : 4));
  const ch = big ? 9 : 6;
  px(cx - 1, cy - 1, cw + 2, ch + 2, '#1a1410');
  px(cx, cy, cw, ch, top);
  px(cx, cy + ch - 2, cw, 2, dark);
  // Cañón (dos en la pesada).
  const barrel = big ? 3 : 2;
  px(cx + cw, cy + 2, Math.max(3, tile - cx - cw - 1), barrel, '#2a2a2a');
  if (big) px(cx + cw, cy + 6, Math.max(3, tile - cx - cw - 1), 2, '#2a2a2a');
  // Piloto (se ve si hay corriente; el dibujo es el mismo, la luz ayuda a reconocerla).
  px(cx + 1, cy + 1, 2, 1, '#7fe07a');
}
