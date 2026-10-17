import { describe, expect, it } from 'vitest';
import { cameraPosition, clampOrbit, MAX_PITCH, MIN_DIST, northLabel3d, panOrbit } from '../src/render3d/camera3d';

describe('cámara orbital 3D', () => {
  it('con giro 0 la cámara está al sur del punto mirado y por encima', () => {
    const p = cameraPosition({ tx: 10, tz: 10, yaw: 0, pitch: Math.PI / 4, dist: 10 });
    expect(p.x).toBeCloseTo(10);
    expect(p.z).toBeGreaterThan(10);
    expect(p.y).toBeGreaterThan(0);
  });

  it('se limita la inclinación, la distancia y el giro se normaliza', () => {
    const o = clampOrbit({ tx: -5, tz: 500, yaw: -Math.PI / 2, pitch: 3, dist: 1 }, 100, 100);
    expect(o.tx).toBe(0);
    expect(o.tz).toBe(100);
    expect(o.pitch).toBe(MAX_PITCH);
    expect(o.dist).toBe(MIN_DIST);
    expect(o.yaw).toBeCloseTo((3 * Math.PI) / 2);
  });

  it('arrastrar a la derecha mueve el punto mirado a la izquierda de la pantalla, con cualquier giro', () => {
    for (const yaw of [0, 0.7, Math.PI / 2, 2.5, Math.PI]) {
      const o = { tx: 50, tz: 50, yaw, pitch: Math.PI / 2, dist: 20 };
      const moved = panOrbit(o, 1, 0);
      // La derecha de la pantalla en el suelo es (cos yaw, -sin yaw): el punto va en sentido contrario.
      expect(moved.tx - o.tx).toBeCloseTo(-Math.cos(yaw));
      expect(moved.tz - o.tz).toBeCloseTo(Math.sin(yaw));
    }
  });

  it('la brújula dice qué queda arriba', () => {
    expect(northLabel3d(0)).toBe('N');
    expect(northLabel3d(Math.PI)).toBe('S');
    expect(northLabel3d(Math.PI / 4)).toBe('NO');
  });
});
