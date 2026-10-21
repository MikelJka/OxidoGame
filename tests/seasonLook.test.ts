// Aspecto de las estaciones (salto de calidad del 2D, 2026-10-21): hojas de los árboles y nieve en el suelo.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { foliageAt, snowCover } from '../src/sim/seasons';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/time';

describe('aspecto de las estaciones', () => {
  it('las hojas siguen el año: brotes en primavera, verdes en verano, ocres en otoño y sin hojas en invierno', () => {
    expect(foliageAt(3, 12, 0)).toBe('brotes');
    expect(foliageAt(15, 12, 0)).toBe('verde');
    expect(foliageAt(23, 12, 0)).toBe('otono');
    expect(foliageAt(35, 12, 0)).toBe('desnudo');
    expect(foliageAt(55, 12, 0)).toBe('verde'); // el año siguiente
  });

  it('el cambio es poco a poco: unas plantas cambian antes que otras', () => {
    // El día 21 por la mañana (empieza el otoño), unas ya están ocres y otras aún verdes.
    const looks = new Set([0, 0.25, 0.5, 0.75, 1].map((j) => foliageAt(21, 6, j)));
    expect(looks.has('verde')).toBe(true);
    expect(looks.has('otono')).toBe(true);
  });

  it('la nieve cubre el suelo poco a poco en invierno y se funde en primavera', () => {
    const w = flatWorld(0);
    w.tick = 15 * TICKS_PER_DAY; // verano
    expect(snowCover(w)).toBe(0);
    w.tick = 30 * TICKS_PER_DAY - 7 * TICKS_PER_HOUR; // primer instante del invierno (día 31, 0:00)
    const first = snowCover(w);
    w.tick += TICKS_PER_DAY;
    const later = snowCover(w);
    expect(later).toBeGreaterThan(first);
    w.tick += 5 * TICKS_PER_DAY;
    expect(snowCover(w)).toBe(1);
    w.tick = 40 * TICKS_PER_DAY; // primavera del año siguiente: se va fundiendo
    expect(snowCover(w)).toBeGreaterThan(0);
    expect(snowCover(w)).toBeLessThan(1);
    w.tick = 45 * TICKS_PER_DAY;
    expect(snowCover(w)).toBe(0);
  });

  it('la ola de frío también deja nieve', () => {
    const w = flatWorld(0);
    w.tick = 22 * TICKS_PER_DAY;
    w.weather.push({ id: 'ola_frio', until: w.tick + 40 * TICKS_PER_HOUR });
    w.tick += 6 * TICKS_PER_HOUR;
    expect(snowCover(w)).toBeGreaterThan(0);
  });
});
