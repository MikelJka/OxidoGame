import { afterEach, describe, expect, it } from 'vitest';
import { generateMap, Terrain } from '../src/sim/map';
import {
  DEFAULT_TILT, LIFT, occludedFraction, pickTile, setTilt, TILE, TILE_H, tileTop, TILTS, TOP_MARGIN,
} from '../src/render/projection';
import { MAX_LEVEL } from '../src/sim/map';

function stepMap() {
  // Mapa llano de nivel 1 con una meseta de nivel 3 en las filas 4 a 6.
  const map = generateMap({ width: 10, height: 10, seed: 3 });
  map.terrain.fill(Terrain.Soil);
  map.props.fill(0);
  map.cliff.fill(0);
  map.slope.fill(0);
  map.level.fill(1);
  for (let y = 4; y <= 6; y++) for (let x = 0; x < 10; x++) map.level[y * 10 + x] = 3;
  return map;
}

describe('proyección del relieve', () => {
  it('eleva cada casilla según su nivel', () => {
    const map = stepMap();
    expect(tileTop(map, 2, 2)).toBe(2 * TILE_H - LIFT);
    expect(tileTop(map, 2, 5)).toBe(5 * TILE_H - 3 * LIFT);
  });

  it('al tocar el centro de una casilla dibujada devuelve esa casilla', () => {
    const map = stepMap();
    for (const [x, y] of [[1, 1], [3, 5], [7, 8], [0, 4], [9, 6]]) {
      const top = tileTop(map, x, y);
      expect(pickTile(map, x * TILE + 8, top + TILE_H / 2)).toEqual({ x, y });
    }
  });

  it('la meseta (delante y más alta) tapa la fila de detrás', () => {
    const map = stepMap();
    // La meseta (fila 4, nivel 3) empieza más arriba que donde acaba la fila 3 (nivel 1).
    const y = 4 * TILE_H - 3 * LIFT + 2;
    expect(y).toBeLessThan(4 * TILE_H - LIFT);
    expect(pickTile(map, 20, y)).toEqual({ x: 1, y: 4 });
  });

  it('tocar la pared bajo la meseta devuelve la casilla de arriba', () => {
    const map = stepMap();
    const wallY = 7 * TILE_H - 3 * LIFT + 4; // justo debajo de la superficie de la fila 6
    expect(pickTile(map, 20, wallY)).toEqual({ x: 1, y: 6 });
  });

  it('fuera del mapa devuelve null', () => {
    const map = stepMap();
    expect(pickTile(map, -5, 20)).toBeNull();
    expect(pickTile(map, 20, 5000)).toBeNull();
  });
});

describe('ocultación detrás del relieve', () => {
  it('un colono en llano justo detrás de una meseta queda tapado', () => {
    const map = stepMap(); // meseta de nivel 3 en las filas 4 a 6
    const row = 3;
    const footY = (row + 0.5) * TILE_H - LIFT; // pies en el centro de su casilla de nivel 1
    expect(occludedFraction(map, 24, footY, row)).toBeGreaterThan(0.5);
  });

  it('un colono encima de la meseta o lejos de ella se ve entero', () => {
    const map = stepMap();
    expect(occludedFraction(map, 24, 5.5 * TILE_H - 3 * LIFT, 5)).toBe(0);
    expect(occludedFraction(map, 24, 1.5 * TILE_H - LIFT, 1)).toBe(0);
    // Delante de la meseta (más al sur) tampoco se tapa.
    expect(occludedFraction(map, 24, 8.5 * TILE_H - LIFT, 8)).toBe(0);
  });
});

describe('inclinación ajustable', () => {
  afterEach(() => setTilt(DEFAULT_TILT));

  it('cambia el alto de casilla y la altura de los niveles', () => {
    expect(setTilt(0)).toBe(0);
    expect(TILE_H).toBe(TILTS[0].tileH);
    expect(LIFT).toBe(TILTS[0].lift);
    expect(TOP_MARGIN).toBe(MAX_LEVEL * TILTS[0].lift);
    expect(setTilt(99)).toBe(TILTS.length - 1);
    expect(setTilt(-3)).toBe(0);
  });

  it('va de mirar desde arriba a mirar de lado', () => {
    for (let i = 1; i < TILTS.length; i++) {
      expect(TILTS[i].tileH).toBeLessThan(TILTS[i - 1].tileH);
      expect(TILTS[i].lift).toBeGreaterThan(TILTS[i - 1].lift);
    }
  });

  it('con cualquier inclinación, tocar una casilla la selecciona y la meseta tapa lo de detrás', () => {
    const map = stepMap();
    for (let t = 0; t < TILTS.length; t++) {
      setTilt(t);
      for (const [x, y] of [[1, 0], [3, 5], [7, 8], [0, 4], [9, 6], [4, 7]]) {
        const top = tileTop(map, x, y);
        expect(pickTile(map, x * TILE + 8, top + TILE_H / 2)).toEqual({ x, y });
      }
      const footY = 3.5 * TILE_H - LIFT;
      expect(occludedFraction(map, 24, footY, 3)).toBeGreaterThan(0);
      expect(occludedFraction(map, 24, 8.5 * TILE_H - LIFT, 8)).toBe(0);
    }
  });
});
