import { describe, expect, it } from 'vitest';
import { generateMap, Terrain } from '../src/sim/map';
import { LIFT, occludedFraction, pickTile, TILE, tileTop } from '../src/render/projection';

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
    expect(tileTop(map, 2, 2)).toBe(2 * TILE - LIFT);
    expect(tileTop(map, 2, 5)).toBe(5 * TILE - 3 * LIFT);
  });

  it('al tocar el centro de una casilla dibujada devuelve esa casilla', () => {
    const map = stepMap();
    for (const [x, y] of [[1, 1], [3, 5], [7, 8], [0, 4], [9, 6]]) {
      const top = tileTop(map, x, y);
      expect(pickTile(map, x * TILE + 8, top + 8)).toEqual({ x, y });
    }
  });

  it('la meseta (delante y más alta) tapa la fila de detrás', () => {
    const map = stepMap();
    // La fila 3 (nivel 1) se dibuja entre 3*16-12 y 4*16-12; la meseta empieza en 4*16-36.
    const y = 4 * TILE - 3 * LIFT + 2;
    expect(pickTile(map, 20, y)).toEqual({ x: 1, y: 4 });
  });

  it('tocar la pared bajo la meseta devuelve la casilla de arriba', () => {
    const map = stepMap();
    const wallY = 7 * TILE - 3 * LIFT + 4; // justo debajo de la superficie de la fila 6
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
    const footY = (row + 0.5) * TILE - LIFT; // pies en el centro de su casilla de nivel 1
    expect(occludedFraction(map, 24, footY, row)).toBeGreaterThan(0.5);
  });

  it('un colono encima de la meseta o lejos de ella se ve entero', () => {
    const map = stepMap();
    expect(occludedFraction(map, 24, (5.5) * TILE - 3 * LIFT, 5)).toBe(0);
    expect(occludedFraction(map, 24, (1.5) * TILE - LIFT, 1)).toBe(0);
    // Delante de la meseta (más al sur) tampoco se tapa.
    expect(occludedFraction(map, 24, (8.5) * TILE - LIFT, 8)).toBe(0);
  });
});
