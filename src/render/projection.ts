// Proyección del relieve: cada nivel de altura se dibuja desplazado hacia arriba LIFT píxeles,
// y entre una casilla y la de abajo (sur) más baja se ve una pared. Sin Phaser: se puede probar.
import { GameMap, inBounds, isWater, MAX_LEVEL, Terrain } from '../sim/map';

export const TILE = 16;
/** Píxeles (del mundo) que sube cada nivel de altura. */
export const LIFT = 12;
/** Margen superior de las texturas del mapa para que la primera fila elevada no se corte. */
export const TOP_MARGIN = MAX_LEVEL * LIFT;

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
  return y * TILE - liftOf(map, x, y);
}

/**
 * Casilla que se ve en un punto del mundo (en píxeles), teniendo en cuenta que las casillas
 * de delante (más al sur) y más altas tapan a las de detrás. Tocar una pared devuelve la casilla
 * de arriba del desnivel. null si fuera del mapa.
 */
export function pickTile(map: GameMap, wx: number, wy: number): { x: number; y: number } | null {
  const tx = Math.floor(wx / TILE);
  if (tx < 0 || tx >= map.width) return null;
  const last = Math.min(map.height - 1, Math.floor((wy + TOP_MARGIN) / TILE));
  const first = Math.max(0, Math.floor(wy / TILE) - 1);
  for (let ty = last; ty >= first; ty--) {
    const top = tileTop(map, tx, ty);
    const below = ty + 1 < map.height ? renderLevel(map, tx, ty + 1) : 0;
    const wallBottom = (ty + 1) * TILE - below * LIFT;
    if (wy >= top && wy < Math.max(top + TILE, wallBottom)) return { x: tx, y: ty };
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
