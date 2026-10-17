// Proyección del relieve: cada nivel de altura se dibuja desplazado hacia arriba LIFT píxeles,
// y entre una casilla y la de abajo (sur) más baja se ve una pared. Sin Phaser: se puede probar.
import { GameMap, inBounds, isWater, MAX_LEVEL, Terrain } from '../sim/map';

export const TILE = 16;

/** Una inclinación de la vista: alto en pantalla de cada casilla y altura de cada nivel. */
export interface Tilt {
  name: string;
  tileH: number;
  lift: number;
}

/** Inclinaciones disponibles, de mirar desde arriba a mirar casi de lado. */
export const TILTS: readonly Tilt[] = [
  { name: 'cenital', tileH: 16, lift: 5 },
  { name: 'alta', tileH: 14, lift: 9 },
  { name: 'inclinada', tileH: 12, lift: 12 },
  { name: 'baja', tileH: 10, lift: 15 },
];
export const DEFAULT_TILT = 2;

/**
 * Alto en pantalla de una casilla. Menor que TILE: el suelo se ve inclinado (desde un lado),
 * mientras que paredes, objetos y colonos se dibujan de pie con su tamaño normal.
 * Cambia con `setTilt` (los módulos que lo importan ven siempre el valor actual).
 */
export let TILE_H = TILTS[DEFAULT_TILT].tileH;
/** Píxeles (del mundo) que sube cada nivel de altura. */
export let LIFT = TILTS[DEFAULT_TILT].lift;
/** Margen superior de las texturas del mapa para que la primera fila elevada no se corte. */
export let TOP_MARGIN = MAX_LEVEL * LIFT;
/** Índice en TILTS de la inclinación actual. */
export let tiltIndex = DEFAULT_TILT;

/** Cambia la inclinación de la vista (se recorta a las disponibles). Devuelve el índice aplicado. */
export function setTilt(index: number): number {
  const i = Math.max(0, Math.min(TILTS.length - 1, Math.round(index)));
  tiltIndex = i;
  TILE_H = TILTS[i].tileH;
  LIFT = TILTS[i].lift;
  TOP_MARGIN = MAX_LEVEL * LIFT;
  return i;
}

/** Nivel con el que se dibuja una casilla: el agua siempre abajo del todo. */
export function renderLevel(map: GameMap, x: number, y: number): number {
  if (!inBounds(map, x, y)) return 0;
  const i = y * map.width + x;
  return isWater(map.terrain[i] as Terrain) ? 0 : map.level[i];
}

/** Desplazamiento vertical (hacia arriba, en píxeles del mundo) de una casilla. */
export function liftOf(map: GameMap, x: number, y: number): number {
  return renderLevel(map, x, y) * LIFT;
}

/** Y del mundo donde se dibuja el borde superior de una casilla. */
export function tileTop(map: GameMap, x: number, y: number): number {
  return y * TILE_H - liftOf(map, x, y);
}

/** Y del mundo de una posición continua en casillas (sin contar la altura). */
export function rowY(y: number): number {
  return y * TILE_H;
}

/**
 * Casilla que se ve en un punto del mundo (en píxeles), teniendo en cuenta que las casillas
 * de delante (más al sur) y más altas tapan a las de detrás. Tocar una pared devuelve la casilla
 * de arriba del desnivel. null si fuera del mapa.
 */
export function pickTile(map: GameMap, wx: number, wy: number): { x: number; y: number } | null {
  const tx = Math.floor(wx / TILE);
  if (tx < 0 || tx >= map.width) return null;
  const last = Math.min(map.height - 1, Math.floor((wy + TOP_MARGIN) / TILE_H));
  const first = Math.max(0, Math.floor(wy / TILE_H) - 1);
  for (let ty = last; ty >= first; ty--) {
    const top = tileTop(map, tx, ty);
    const below = ty + 1 < map.height ? renderLevel(map, tx, ty + 1) : 0;
    const wallBottom = (ty + 1) * TILE_H - below * LIFT;
    if (wy >= top && wy < Math.max(top + TILE_H, wallBottom)) return { x: tx, y: ty };
  }
  return null;
}

/** Alturas (en píxeles sobre los pies) que se comprueban para saber si algo tapa a un colono. */
const BODY_SAMPLES = [2, 6, 10];

/**
 * Parte (0–1) del cuerpo de un colono que queda tapada por terreno de delante (filas más al sur)
 * dibujado por encima de él. `footX`, `footY` son sus pies en el mundo; `row` su fila.
 */
export function occludedFraction(map: GameMap, footX: number, footY: number, row: number): number {
  let hidden = 0;
  for (const h of BODY_SAMPLES) {
    const t = pickTile(map, footX, footY - h);
    if (t && t.y > row) hidden++;
  }
  return hidden / BODY_SAMPLES.length;
}
