import { describe, expect, it } from 'vitest';
import { generateMap } from '../src/sim/map';
import {
  fromView, normalizeRotation, northLabel, Rotation, rotateMap, tileFromView, tileToView, toView, viewSize,
} from '../src/render/rotation';

const ROTS: Rotation[] = [0, 1, 2, 3];

describe('giro de la vista', () => {
  it('normaliza el giro a 0–3', () => {
    expect(normalizeRotation(4)).toBe(0);
    expect(normalizeRotation(-1)).toBe(3);
    expect(normalizeRotation(5)).toBe(1);
  });

  it('toView y fromView son inversas (mapa no cuadrado)', () => {
    const w = 7;
    const h = 4;
    for (const r of ROTS) {
      for (const [x, y] of [[0, 0], [2.3, 1.7], [7, 4], [6.5, 0.5]]) {
        const v = toView(x, y, w, h, r);
        const { width, height } = viewSize(w, h, r);
        expect(v.x).toBeGreaterThanOrEqual(0);
        expect(v.y).toBeGreaterThanOrEqual(0);
        expect(v.x).toBeLessThanOrEqual(width);
        expect(v.y).toBeLessThanOrEqual(height);
        const back = fromView(v.x, v.y, w, h, r);
        expect(back.x).toBeCloseTo(x);
        expect(back.y).toBeCloseTo(y);
      }
    }
  });

  it('las casillas van y vuelven sin perderse', () => {
    const w = 5;
    const h = 3;
    for (const r of ROTS) {
      const seen = new Set<string>();
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = tileToView(x, y, w, h, r);
          seen.add(`${v.x},${v.y}`);
          expect(tileFromView(v.x, v.y, w, h, r)).toEqual({ x, y });
        }
      }
      expect(seen.size).toBe(w * h);
    }
  });

  it('con un cuarto de vuelta el oeste queda arriba', () => {
    // Casilla del borde oeste, abajo del todo: queda en la fila de arriba, a la izquierda.
    expect(tileToView(0, 3, 7, 4, 1)).toEqual({ x: 0, y: 0 });
    expect(northLabel(1)).toBe('O');
    expect(northLabel(3)).toBe('E');
  });

  it('rotateMap gira todas las capas y el inicio', () => {
    const map = generateMap({ width: 12, height: 9, seed: 5 });
    for (const r of ROTS) {
      const v = rotateMap(map, r);
      expect(v.width * v.height).toBe(map.width * map.height);
      for (const [x, y] of [[0, 0], [11, 8], [3, 6], [map.start.x, map.start.y]]) {
        const t = tileToView(x, y, map.width, map.height, r);
        const vi = t.y * v.width + t.x;
        const i = y * map.width + x;
        expect(v.terrain[vi]).toBe(map.terrain[i]);
        expect(v.level[vi]).toBe(map.level[i]);
        expect(v.props[vi]).toBe(map.props[i]);
        expect(v.elevation[vi]).toBe(map.elevation[i]);
      }
      expect(v.start).toEqual(tileToView(map.start.x, map.start.y, map.width, map.height, r));
    }
    expect(rotateMap(map, 0)).toBe(map);
  });

  it('cuatro cuartos de vuelta dejan el mapa como estaba', () => {
    const map = generateMap({ width: 10, height: 6, seed: 2 });
    let v = map;
    for (let i = 0; i < 4; i++) v = rotateMap(v, 1);
    expect(v.width).toBe(map.width);
    expect(Array.from(v.level)).toEqual(Array.from(map.level));
    expect(Array.from(v.terrain)).toEqual(Array.from(map.terrain));
  });
});
