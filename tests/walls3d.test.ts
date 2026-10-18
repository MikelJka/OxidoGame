import { describe, expect, it } from 'vitest';
import { boxQuads, QuadSink, wallBoxes, WALL_THICK } from '../src/render3d/walls3d';

const area = (bs: ReturnType<typeof wallBoxes>) => bs.reduce((a, b) => a + (b.x1 - b.x0) * (b.z1 - b.z0), 0);

describe('muros de la vista 3D', () => {
  it('un muro suelto ocupa la casilla de este a oeste', () => {
    expect(wallBoxes({ n: false, e: false, s: false, w: false })).toEqual([{ x0: 0, x1: 1, z0: 0.25, z1: 0.75 }]);
  });

  it('en una fila de este a oeste es un solo tramo que llega a los bordes', () => {
    const bs = wallBoxes({ n: false, e: true, s: false, w: true });
    expect(bs).toHaveLength(1);
    expect(bs[0].x0).toBe(0);
    expect(bs[0].x1).toBe(1);
  });

  it('en una columna llega a los bordes norte y sur, con el grosor del muro', () => {
    const bs = wallBoxes({ n: true, e: false, s: true, w: false });
    expect(Math.min(...bs.map((b) => b.z0))).toBe(0);
    expect(Math.max(...bs.map((b) => b.z1))).toBe(1);
    for (const b of bs) expect(b.x1 - b.x0).toBe(WALL_THICK);
    expect(area(bs)).toBeCloseTo(WALL_THICK);
  });

  it('una esquina se une con sus dos vecinos sin cajas solapadas', () => {
    const bs = wallBoxes({ n: true, e: true, s: false, w: false });
    expect(area(bs)).toBeCloseTo(0.75 * 0.5 + 0.25 * 0.5);
    for (let i = 0; i < bs.length; i++) {
      for (let k = i + 1; k < bs.length; k++) {
        const a = bs[i];
        const b = bs[k];
        const overlap = Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.z1, b.z1) > Math.max(a.z0, b.z0);
        expect(overlap).toBe(false);
      }
    }
  });

  it('las caras de una caja miran hacia fuera', () => {
    const quads: { corners: [number, number, number][]; normal: [number, number, number] }[] = [];
    const sink: QuadSink = { quad: (_top, corners, normal) => quads.push({ corners, normal }) };
    boxQuads(sink, 0, 1, 0, 2, 0, 0.5);
    expect(quads).toHaveLength(5);
    for (const { corners: [a, b, c], normal } of quads) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const dot = n[0] * normal[0] + n[1] * normal[1] + n[2] * normal[2];
      expect(dot).toBeGreaterThan(0);
    }
  });
});
