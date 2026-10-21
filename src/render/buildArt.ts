// Dibujo pixel art de construcciones (muros y puertas) sobre un lienzo 2D.
// La pieza tiene la cara de arriba (TILE × tileH) y debajo el frente (TILE × wallH).
import type { BuildingDef } from '../data/buildings';
import { paintVehicle } from './vehicleArt';

/** Altura del frente de un muro para una elevación de nivel dada (px). */
import { drawWall, joinSides } from './wallArt';

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
export function drawBuilding(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, unitH: number, raised = false, links = 0, variant = 0): void {
  // Muros: tramos que se unen con sus vecinos (wallArt.ts).
  if (def.category === 'muro') {
    drawWall(ctx, def, tile, tileH, unitH * def.height, links, variant);
    return;
  }
  drawBuildingBase(ctx, def, tile, tileH, unitH, raised, links);
  // Puertas y portones unidos a un muro: sin contorno por ese lado.
  if (def.category === 'puerta' || def.category === 'porton') joinSides(ctx, tile, tileH + unitH * def.height, links);
}

function drawBuildingBase(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, unitH: number, raised = false, links = 0): void {
  // Puente levadizo: bajado o alzado.
  if (def.drawbridge) {
    drawDrawbridge(ctx, def, tile, tileH, raised);
    return;
  }
  // Vehículos (el plano del buggy): su propio dibujo.
  if (def.vehicle) {
    paintVehicle(ctx, def.vehicle, tile, tileH + unitH * def.height);
    return;
  }
  const { top, face, dark } = def.colors;
  const wallH = unitH * def.height;
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const outline = '#1a1410';
  const h = tileH + wallH;
  if (def.category === 'granja') {
    drawFarmBuilding(ctx, def, tile, tileH, wallH, links);
    return;
  }
  px(0, 0, tile, h, outline);
  if (def.category === 'torre') {
    drawTower(ctx, def, tile, tileH, wallH);
    return;
  }
  if (def.climate) {
    if (def.climate.mode === 'calor') {
      // Calefactor: radiador de aletas con la rejilla caliente y un piloto naranja.
      px(1, 1, tile - 2, tileH - 2, top);
      for (let x = 2; x < tile - 2; x += 2) px(x, 2, 1, tileH - 4, dark);
      px(1, tileH - 1, tile - 2, wallH, face);
      for (let x = 2; x < tile - 2; x += 2) px(x, tileH, 1, wallH - 2, dark);
      px(3, tileH + 1, tile - 6, 1, '#e07a2a'); // resistencia al rojo
      px(tile - 4, h - 4, 2, 1, '#ffb040'); // piloto
      px(1, h - 2, tile - 2, 1, dark);
    } else {
      // Aire acondicionado: caja blanca con rejilla, ventilador y piloto azul.
      px(1, 1, tile - 2, tileH - 2, top);
      px(3, 3, tile - 6, tileH - 6, dark);
      px(Math.floor(tile / 2) - 2, Math.floor(tileH / 2) - 1, 4, 2, face); // aspas
      px(1, tileH - 1, tile - 2, wallH, face);
      for (let y = tileH + 1; y < h - 3; y += 2) px(2, y, tile - 4, 1, dark);
      px(tile - 4, h - 4, 2, 1, '#7ad0ff');
      px(1, h - 2, tile - 2, 1, dark);
    }
    return;
  }
  if (def.fridge) {
    // Nevera: arcón blanco con la tapa, la junta, el tirador y una luz azul.
    px(1, 1, tile - 2, tileH - 2, top);
    px(1, 1, tile - 2, 1, '#ffffff');
    px(2, Math.floor(tileH / 2), tile - 4, 1, dark);
    px(1, tileH - 1, tile - 2, wallH, face);
    px(1, tileH - 1, tile - 2, 1, dark);
    px(Math.floor(tile / 2) - 3, tileH + 2, 6, 1, dark); // tirador
    px(tile - 5, tileH + 2, 2, 1, '#7ad0ff'); // piloto
    px(1, h - 2, tile - 2, 1, dark);
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
  if (def.loophole !== undefined) {
    // Aspilleras: dos rendijas oscuras en el frente y su marca en la cara de arriba.
    const sy = tileH + Math.max(1, Math.floor(wallH / 3));
    const sh = Math.max(2, Math.floor(wallH / 3));
    for (const sx of [Math.floor(tile / 4), Math.floor((tile * 3) / 4) - 1]) {
      px(sx - 1, sy - 1, 3, sh + 2, lighten(face));
      px(sx, sy, 1, sh, outline);
    }
    px(Math.floor(tile / 4), Math.floor(tileH / 2), Math.ceil(tile / 2), 1, dark);
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
  if (def.id === 'muelle') {
    // Tablones sobre el agua con un poste y una caña de pescar apoyada.
    px(0, 1, tile, tileH - 1, '#1a1410');
    for (let y = 2, row = 0; y < tileH - 1; y += 3, row++) px(1, y, tile - 2, 2, row % 2 ? top : face);
    px(1, tileH - 1, 2, wallH, dark);
    px(tile - 3, tileH - 1, 2, wallH, dark);
    px(2, 0, 2, 4, '#5a4228'); // poste
    px(5, 1, 1, 1, '#c8b890'); // caña
    px(6, 0, 6, 1, '#c8b890');
    px(12, 1, 1, 4, '#d8d8d0'); // sedal
    return;
  }
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
  if (def.id === 'banco_investigacion') {
    // Mesa con un microscopio viejo, papeles y una radio desmontada.
    px(0, 1, tile, tileH - 1, '#1a1410');
    px(1, 2, tile - 2, tileH - 3, top);
    px(1, tileH - 1, tile - 2, 2, face);
    px(1, tileH + 1, 2, wallH - 1, dark);
    px(tile - 3, tileH + 1, 2, wallH - 1, dark);
    px(3, 1, 2, 5, '#3a3a40'); // microscopio
    px(2, 5, 4, 1, '#5c5a56');
    px(3, 1, 2, 1, '#9ab0e0');
    px(8, 3, 3, 3, '#e8e0c8'); // papeles
    px(9, 4, 2, 1, '#8a8070');
    px(12, 2, 3, 3, '#4a5a4a'); // radio
    px(13, 3, 1, 1, '#c0e080');
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

/**
 * Puente levadizo visto desde arriba: bajado, un tablero de chapa de lado a lado con franjas de aviso
 * en los extremos y la junta en medio; alzado, las dos hojas levantadas en los extremos y el agua en medio.
 */
function drawDrawbridge(ctx: CanvasRenderingContext2D, def: BuildingDef, w: number, h: number, raised: boolean): void {
  const { top, face, dark } = def.colors;
  const px = painter(ctx);
  ctx.clearRect(0, 0, w, h);
  const along = w >= h; // el tablero va a lo largo del lado más largo
  const len = along ? w : h;
  const wid = along ? h : w;
  // r(a, b, la, lb): rectángulo en coordenadas «a lo largo» (a) y «a lo ancho» (b).
  const r = (a: number, b: number, la: number, lb: number, color: string) => (along ? px(a, b, la, lb, color) : px(b, a, lb, la, color));
  const leaf = Math.max(4, Math.floor(len * (raised ? 0.16 : 0.5)));
  for (const start of [0, len - leaf]) {
    r(start, 0, leaf, wid, dark);
    r(start + 1, 1, leaf - 2, wid - 2, raised ? face : top);
    if (!raised) for (let b = 3; b < wid - 2; b += 3) r(start + 2, b, leaf - 4, 1, face);
  }
  // Franjas de aviso amarillas y negras en los dos extremos.
  for (let b = 1; b < wid - 1; b += 4) {
    r(1, b, 2, 2, '#e0c040');
    r(len - 3, b, 2, 2, '#e0c040');
    r(1, b + 2, 2, 2, '#1a1410');
    r(len - 3, b + 2, 2, 2, '#1a1410');
  }
  if (raised) {
    // Hojas alzadas: un borde claro y una franja roja; entre ellas, el agua se ve.
    r(leaf - 2, 1, 2, wid - 2, '#c0392b');
    r(len - leaf, 1, 2, wid - 2, '#c0392b');
  } else {
    r(Math.floor(len / 2) - 1, 0, 2, wid, '#1a1410'); // junta de las dos hojas
  }
}

/** Cosas a ras de suelo: suelos, pinchos y muebles (solo la cara de arriba). */
function drawFlat(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number): void {
  const { top, face, dark } = def.colors;
  const px = painter(ctx);
  ctx.clearRect(0, 0, tile, tileH);
  if (def.fishTrap) {
    // Nasa de mimbre medio hundida, con su cuerda.
    px(3, 3, tile - 6, tileH - 6, '#1a1410');
    px(4, 4, tile - 8, tileH - 8, top);
    for (let x = 5; x < tile - 5; x += 2) px(x, 4, 1, tileH - 8, dark);
    px(4, Math.floor(tileH / 2), tile - 8, 1, face);
    px(1, 1, 3, 1, '#c8b890'); // cuerda
    px(1, 1, 1, 3, '#c8b890');
    return;
  }
  if (def.bridge) {
    // Puente: tablones (o chapa) de lado a lado con huecos al agua, y una barandilla a cada lado.
    if (def.id.includes('madera')) {
      for (let y = 1; y < tileH - 1; y += 3) {
        px(1, y, tile - 2, 2, top);
        px(1, y + 1, tile - 2, 1, face);
      }
    } else {
      px(1, 1, tile - 2, tileH - 2, top);
      for (let y = 2; y < tileH - 1; y += 2) for (let x = 2 + (y % 4 === 0 ? 1 : 0); x < tile - 2; x += 3) px(x, y, 1, 1, dark);
    }
    px(0, 0, 1, tileH, dark);
    px(tile - 1, 0, 1, tileH, dark);
    px(0, 0, tile, 1, face);
    px(0, tileH - 1, tile, 1, dark);
    return;
  }
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
    if (def.platform) {
      // Plataforma: un marco oscuro y un pilote en cada esquina, para no confundirla con un suelo.
      px(0, 0, tile, 1, dark);
      px(0, 0, 1, tileH, dark);
      px(tile - 1, 0, 1, tileH, dark);
      for (const [cx, cy] of [[1, 1], [tile - 3, 1], [1, tileH - 3], [tile - 3, tileH - 3]]) px(cx, cy, 2, 2, dark);
    }
    return;
  }
  if (def.id === 'mina_casera') {
    // Mina casera: un disco de chapa medio enterrado, con su espoleta roja en medio.
    const cx = Math.floor(tile / 2);
    const cy = Math.floor(tileH / 2);
    const r = Math.max(2, Math.floor(tile / 4));
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      px(cx - half, cy + y, half * 2 + 1, 1, y < 0 ? top : face);
    }
    px(cx - r, cy + r, r * 2 + 1, 1, dark);
    px(cx, cy - 1, 1, 2, '#c0392b');
    return;
  }
  if (def.id === 'mortero') {
    // Mortero: placa base redonda, dos patas en V y el tubo inclinado con la boca oscura.
    const cx = Math.floor(tile / 2);
    const cy = Math.floor(tileH / 2) + 1;
    const r = Math.max(3, Math.floor(tile / 3));
    for (let y = -Math.floor(r / 2); y <= Math.floor(r / 2); y++) {
      const half = Math.floor(Math.sqrt(r * r - 4 * y * y));
      px(cx - half, cy + y, half * 2 + 1, 1, y < 0 ? top : face);
    }
    px(cx - r + 1, cy + Math.floor(r / 2), r * 2 - 1, 1, dark);
    px(cx - 3, cy - 1, 1, 3, dark); // patas
    px(cx + 3, cy - 1, 1, 3, dark);
    for (let k = 0; k < 5; k++) px(cx - 1 + k, cy - 1 - k, 3, 2, k === 4 ? '#1a1410' : face); // tubo
    px(cx + 3, cy - 5, 2, 1, '#1a1410'); // boca
    return;
  }
  if (def.id === 'trampa_electrica') {
    // Trampa eléctrica: una placa de chapa con dos bornes y un rayo amarillo en medio.
    const m = Math.max(1, Math.floor(tile / 6));
    px(m, m, tile - 2 * m, tileH - 2 * m, face);
    px(m, m, tile - 2 * m, 1, top);
    px(m, tileH - m - 1, tile - 2 * m, 1, dark);
    px(m + 1, m + 1, 2, 2, '#c0392b');
    px(tile - m - 3, tileH - m - 3, 2, 2, '#2c3e50');
    const cx = Math.floor(tile / 2);
    const cy = Math.floor(tileH / 2);
    px(cx, cy - 2, 2, 2, '#f1c40f');
    px(cx - 1, cy, 2, 1, '#f1c40f');
    px(cx - 2, cy + 1, 2, 2, '#f1c40f');
    return;
  }
  if (def.id === 'alambre_espino') {
    // Alambre de espino: dos postes y dos hilos en zigzag con púas.
    const posts = [2, tile - 3];
    for (const x of posts) {
      px(x, 1, 1, tileH - 2, dark);
      px(x + 1, 1, 1, tileH - 2, face);
    }
    for (let row = 0; row < 2; row++) {
      const yBase = Math.floor((tileH * (row + 1)) / 3);
      for (let x = 0; x < tile; x++) {
        const y = yBase + (Math.floor(x / 2) % 2 === 0 ? 0 : -1);
        px(x, y, 1, 1, top);
        if (x % 4 === 1) {
          px(x, y - 1, 1, 1, dark);
          px(x, y + 1, 1, 1, dark);
        }
      }
    }
    return;
  }
  if (def.id === 'mesa' || def.id === 'mesa_juego') {
    // Mesa: tablero con sus patas; la de juego, con el tapete verde y unas fichas.
    px(1, 2, tile - 2, tileH - 4, '#1a1410');
    px(2, 3, tile - 4, tileH - 6, def.id === 'mesa_juego' ? '#3e6a4a' : top);
    px(2, tileH - 3, 2, 2, dark);
    px(tile - 4, tileH - 3, 2, 2, dark);
    if (def.id === 'mesa_juego') {
      px(5, 5, 2, 2, '#e8e0c8');
      px(9, 6, 2, 2, '#c04040');
    }
    return;
  }
  if (def.id === 'silla') {
    px(5, 4, 6, 6, '#1a1410');
    px(6, 5, 4, 4, top);
    px(6, 2, 4, 2, face); // respaldo
    return;
  }
  if (def.id === 'alfombra') {
    px(1, 2, tile - 2, tileH - 4, dark);
    px(2, 3, tile - 4, tileH - 6, top);
    px(4, 5, tile - 8, tileH - 10, '#c8a050');
    return;
  }
  if (def.id === 'cuadro') {
    // Cuadro apoyado en un caballete.
    px(4, 1, 8, 8, '#1a1410');
    px(5, 2, 6, 6, top);
    px(6, 3, 4, 2, '#5a8ac0');
    px(6, 5, 4, 2, '#5a9a5a');
    px(5, 9, 1, 4, face);
    px(10, 9, 1, 4, face);
    return;
  }
  if (def.id === 'estufa') {
    // Estufa: caja de piedra con la boca del fuego y el tubo de chapa.
    px(2, 2, tile - 4, tileH - 3, '#1a1410');
    px(3, 3, tile - 6, tileH - 5, top);
    px(4, tileH - 6, tile - 8, 3, '#2a1a10');
    px(5, tileH - 5, tile - 10, 1, '#e67e22');
    px(tile - 6, 0, 2, 5, '#8a9096');
    px(tile - 6, 0, 2, 1, '#5a6066');
    return;
  }
  if (def.id === 'hoguera') {
    // Hoguera: un corro de piedras con dos troncos cruzados y brasas en medio.
    const cx = Math.floor(tile / 2);
    const cy = Math.floor(tileH / 2);
    const r = Math.max(3, Math.floor(Math.min(tile, tileH) / 2) - 1);
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const x = cx + Math.round(Math.cos(ang) * r) - 1;
      const y = cy + Math.round(Math.sin(ang) * r * 0.8) - 1;
      px(x, y, 2, 2, a % 2 ? top : face);
    }
    px(cx - r + 2, cy, (r - 2) * 2, 1, '#6a4a2a');
    px(cx - 1, cy - r + 2, 2, (r - 2) * 2, '#5a3a1e');
    px(cx - 1, cy - 1, 3, 2, '#e67e22');
    px(cx, cy - 2, 1, 1, '#f1c40f');
    px(cx - 1, cy + 1, 3, 1, dark);
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
  if (def.id === 'sacos_arena') {
    // Dos hileras de sacos abultados, la de arriba desplazada medio saco.
    const rows = 2;
    const rowH = Math.max(3, Math.floor((h - y0 - 1) / rows));
    for (let r = 0; r < rows; r++) {
      const y = h - 1 - (r + 1) * rowH;
      const off = r % 2 === 0 ? 0 : 3;
      for (let x = off - 3; x < tile; x += 6) {
        const x0 = Math.max(0, x);
        const w = Math.min(tile, x + 6) - x0;
        if (w <= 1) continue;
        px(x0, y, w, rowH, '#1a1410');
        px(x0 + 1, y + 1, w - 2, rowH - 2, face);
        px(x0 + 1, y + 1, w - 2, 1, top);
        px(x0 + 1, y + rowH - 2, w - 2, 1, dark);
      }
    }
  } else if (def.id.includes('madera')) {
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

/** Electricidad: cable a ras de suelo, generador, placa solar, molinos, batería y lámpara. */
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
  if (def.id === 'molino_agua') {
    // Molino de agua: una caseta de madera con una rueda de paletas que entra en el agua.
    const wy = Math.floor(h * 0.45);
    px(2, 2, tile - 4, wy, '#1a1410');
    px(3, 3, tile - 6, wy - 3, top);
    px(3, wy - 2, tile - 6, 2, face);
    const cx = Math.floor(tile / 2);
    const r = Math.max(3, Math.min(Math.floor(tile / 2) - 2, Math.floor((h - wy) / 2) - 1));
    const cy = Math.min(h - r - 1, wy + r + 1);
    px(cx - r, cy - 1, r * 2, 2, dark);
    px(cx - 1, cy - r, 2, r * 2, dark);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      px(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 3, 3, face);
    }
    px(cx - 1, cy - 1, 3, 3, top);
    px(1, h - 2, tile - 2, 1, '#8fb4e0'); // espuma del agua
    return;
  }
  if (def.id === 'radio') {
    // Radio de llamada: caja con dial y altavoz y una antena alta.
    px(2, 5, tile - 4, h - 5, '#1a1410');
    px(3, 6, tile - 6, tileH - 6, top);
    px(3, tileH - 1, tile - 6, wallH - 1, face);
    px(5, tileH + 1, 4, Math.max(2, wallH - 3), dark); // altavoz
    px(tile - 8, tileH + 1, 3, 2, '#d8c27a'); // dial
    px(tile - 5, 0, 1, 7, '#8a9096'); // antena
    px(tile - 6, 0, 3, 1, '#d9534f');
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
  const barrelLen = Math.max(3, tile - cx - cw - 1);
  if (def.id === 'torreta_rotativa') {
    // Haz de tres cañones finos con un anillo, para distinguirla de la ligera.
    for (let i = 0; i < 3; i++) px(cx + cw, cy + 1 + i * 2, barrelLen, 1, i === 1 ? '#3a3a3a' : '#222222');
    px(cx + cw + Math.floor(barrelLen / 2), cy, 1, 6, dark);
    px(cx + cw - 1, cy, 1, 6, '#1a1410');
  } else {
    // Cañón (dos en la pesada).
    const barrel = big ? 3 : 2;
    px(cx + cw, cy + 2, barrelLen, barrel, '#2a2a2a');
    if (big) px(cx + cw, cy + 6, barrelLen, 2, '#2a2a2a');
  }
  // Piloto (se ve si hay corriente; el dibujo es el mismo, la luz ayuda a reconocerla).
  px(cx + 1, cy + 1, 2, 1, '#7fe07a');
}

/**
 * Granja: valla (postes y dos travesaños, transparente entre medias), puerta de valla (lo mismo con
 * bisagras y una diagonal), poste con su cuerda enrollada y establo (suelo de paja con tejado a dos aguas).
 */
function drawFarmBuilding(ctx: CanvasRenderingContext2D, def: BuildingDef, tile: number, tileH: number, wallH: number, links: number): void {
  const { top, face, dark } = def.colors;
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  };
  const outline = '#1a1410';
  const h = tileH + wallH;
  const base = h - Math.max(2, Math.round(tileH / 2)); // donde se clavan los postes (mitad de la casilla)
  if (def.fence) {
    const postH = Math.max(5, Math.round(wallH * 0.75));
    const cx = Math.floor(tile / 2) - 1;
    // Hacia dónde va: de este a oeste (lo normal, y si está sola) o de norte a sur.
    const horizontal = (links & 3) !== 0 || (links & 12) === 0;
    const vertical = (links & 12) !== 0;
    const rails = [base - postH + 2, base - Math.round(postH / 2) + 1];
    const post = (x: number) => {
      px(x - 1, base - postH - 1, 4, postH + 2, outline);
      px(x, base - postH, 2, postH, face);
      px(x, base - postH, 2, 1, top);
    };
    if (horizontal) {
      px(0, base + 1, tile, 1, 'rgba(0,0,0,0.3)'); // sombra en el suelo
      // Travesaños de lado a lado (o hasta el centro si solo sigue por un lado).
      const from = links === 0 || links & 2 || !(links & 1) ? 0 : cx;
      const to = links === 0 || links & 1 || !(links & 2) ? tile : cx + 2;
      for (const y of rails) {
        px(from, y - 1, to - from, 3, outline);
        px(from, y, to - from, 1, top);
      }
    }
    if (vertical) {
      // De norte a sur: un travesaño que sube (hacia la casilla de atrás) y baja (hacia la de delante).
      const upTo = links & 4 ? 0 : base - postH;
      const downTo = links & 8 ? h : base;
      px(cx - 1, upTo, 4, downTo - upTo, outline);
      px(cx, upTo, 2, downTo - upTo, top);
    }
    // Sola, un poste en cada punta; en hilera, uno en el centro (así no salen postes dobles).
    if (links === 0) {
      post(1);
      post(tile - 3);
    } else post(cx);
    if (def.gate) {
      // Bisagras y una diagonal (en las de norte a sur, la hoja en el centro, más clara).
      if (horizontal) {
        // La hoja: tablas más claras entre los travesaños, con su diagonal y las bisagras.
        px(2, rails[0] - 1, tile - 4, rails[1] - rails[0] + 3, outline);
        px(3, rails[0], tile - 6, rails[1] - rails[0] + 1, lighten(top));
        for (let k = 0; k < tile - 6; k++) px(3 + k, rails[1] - Math.round((k * (rails[1] - rails[0])) / (tile - 7)), 1, 1, dark);
        px(2, rails[0], 1, 1, '#c9ced4');
        px(2, rails[1], 1, 1, '#c9ced4');
      } else {
        px(cx - 2, base - postH, 6, postH, face);
        px(cx - 2, base - postH, 6, 1, top);
        for (let k = 0; k < postH - 1; k++) px(cx - 2 + Math.round((k * 5) / postH), base - postH + k + 1, 1, 1, dark);
      }
    }
    return;
  }
  if (def.tiePost) {
    const cx = Math.floor(tile / 2) - 1;
    const postH = Math.max(6, wallH);
    px(cx - 2, base + 1, 6, 1, 'rgba(0,0,0,0.3)');
    px(cx - 1, base - postH - 1, 4, postH + 2, outline);
    px(cx, base - postH, 2, postH, face);
    px(cx, base - postH, 2, 1, top);
    // Cuerda enrollada y un cabo suelto.
    px(cx - 1, base - postH + 2, 4, 2, dark);
    px(cx + 3, base - postH + 3, 1, 3, dark);
    px(cx + 4, base - postH + 6, 2, 1, dark);
    return;
  }
  if (def.scarecrow) {
    // Espantapájaros: palo en cruz, camisa azul remendada, cabeza de saco y sombrero de paja.
    const cx = Math.floor(tile / 2) - 1;
    const top0 = Math.max(0, base - wallH - Math.round(tileH / 2));
    px(cx - 3, base + 1, 8, 1, 'rgba(0,0,0,0.3)');
    px(cx, top0 + 4, 2, base - top0 - 4, face); // palo
    px(cx - 5, top0 + 7, 12, 2, face); // brazos
    px(cx - 3, top0 + 6, 8, 6, outline);
    px(cx - 2, top0 + 7, 6, 4, dark); // camisa
    px(cx, top0 + 8, 1, 1, '#c8b07a'); // remiendo
    px(cx - 1, top0 + 2, 4, 4, '#d8c8a0'); // cabeza de saco
    px(cx, top0 + 3, 1, 1, outline);
    px(cx + 2, top0 + 3, 1, 1, outline);
    px(cx - 3, top0 + 1, 8, 1, top); // ala del sombrero
    px(cx - 1, top0, 4, 1, top);
    for (const x of [cx - 6, cx + 7]) px(x, top0 + 7, 1, 2, top); // paja en las mangas
    return;
  }
  if (def.compost) {
    // Compostera: cajón de tablas lleno de restos oscuros con algo verde.
    px(0, 0, tile, h, outline);
    px(1, 1, tile - 2, tileH - 2, top);
    for (let y = 2; y < tileH - 2; y += 2) for (let x = 2 + (y % 4); x < tile - 2; x += 4) px(x, y, 2, 1, '#6a8a3a');
    px(1, tileH - 1, tile - 2, wallH, face);
    for (let x = 4; x < tile - 1; x += 4) px(x, tileH, 1, wallH - 1, dark);
    px(1, h - 2, tile - 2, 1, dark);
    return;
  }
  if (def.hydroponics) {
    // Bandeja hidropónica: mesa de chapa con su pila de agua y filas de brotes, y la luz encima.
    px(0, 0, tile, h, outline);
    px(1, 1, tile - 2, tileH - 2, dark);
    px(2, 2, tile - 4, tileH - 4, '#2a5a6a'); // agua
    for (let y = 3; y < tileH - 3; y += 3) for (let x = 3; x < tile - 3; x += 3) px(x, y, 2, 2, top);
    px(1, tileH - 1, tile - 2, wallH, face);
    px(1, h - 2, tile - 2, 1, dark);
    px(2, tileH + 1, tile - 4, 1, '#c8e8ff'); // tubo de luz
    return;
  }
  // Establo: suelo de paja, paredes bajas de tablas atrás y a los lados y tejado rojo a dos aguas.
  px(0, 0, tile, h, outline);
  px(1, wallH + 1, tile - 2, tileH - 2, dark); // paja
  for (let x = 3; x < tile - 2; x += 4) for (let y = wallH + 3; y < h - 2; y += 3) px(x + (y % 2), y, 2, 1, '#b8a050');
  // Tejado (cara de arriba) con su cumbrera.
  const roofH = Math.max(4, Math.round(tileH * 0.45));
  px(1, 1, tile - 2, roofH, top);
  px(1, 1, tile - 2, 1, lighten(top));
  px(1, Math.round(roofH / 2), tile - 2, 1, outline);
  // Frente abierto: pilares y viga.
  px(1, roofH + 1, tile - 2, 2, face);
  for (const x of [1, Math.floor(tile / 2) - 1, tile - 3]) px(x, roofH + 1, 2, h - roofH - 2, face);
}

/** Azar fijo de un píxel (para el desgaste: siempre igual para el mismo edificio). */
function pixHash(x: number, y: number, s: number): number {
  let h = Math.imul(x + 1, 0x85ebca6b) ^ Math.imul(y + 1, 0x27d4eb2f) ^ s;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/**
 * Desgaste sobre un edificio ya dibujado: grano y manchas en el material, la cara de arriba algo más
 * clara, el frente más oscuro cerca del suelo y churretes de suciedad que bajan por la pared.
 */
export function weatherBuilding(ctx: CanvasRenderingContext2D, w: number, h: number, tileH: number, id: string): void {
  if (w <= 0 || h <= 0) return;
  let seed = 7;
  for (let i = 0; i < id.length; i++) seed = Math.imul(seed ^ id.charCodeAt(i), 0x01000193);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const faceH = Math.max(1, h - tileH);
  for (let x = 0; x < w; x++) {
    // Churrete: algunas columnas tienen suciedad que baja desde arriba del frente.
    const streak = pixHash(x, 0, seed) < 0.18 ? Math.floor(pixHash(x, 1, seed) * faceH * 0.8) : 0;
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4;
      if (d[o + 3] < 200) continue;
      const r = d[o], g = d[o + 1], b = d[o + 2];
      if (r + g + b < 90) continue; // contornos y huecos oscuros, tal cual
      let f = 1;
      if (y < tileH - 1) f = 1.05;
      else {
        const t = (y - tileH) / faceH;
        f = 1.02 - 0.2 * t * t;
        if (streak && y - tileH < streak) f *= 0.9 + 0.06 * ((y - tileH) / streak);
      }
      const blot = (pixHash(x >> 2, y >> 2, seed + 3) - 0.5) * 10;
      const n = (pixHash(x, y, seed) - 0.5) * 12 + blot;
      d[o] = Math.max(0, Math.min(255, r * f + n));
      d[o + 1] = Math.max(0, Math.min(255, g * f + n));
      d[o + 2] = Math.max(0, Math.min(255, b * f + n * 0.9));
    }
  }
  ctx.putImageData(img, 0, 0);
}
