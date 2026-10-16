import { describe, expect, it } from 'vitest';
import { generateMap, Terrain, TERRAIN_INFO, isWater, terrainAt } from '../src/sim/map';
import { Rng, seedFromString } from '../src/sim/rng';

describe('Rng', () => {
  it('es determinista con la misma semilla', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('convierte textos en semillas estables', () => {
    expect(seedFromString('oxido')).toBe(seedFromString('oxido'));
    expect(seedFromString('oxido')).not.toBe(seedFromString('oxido2'));
  });
});

describe('generateMap', () => {
  const opts = { width: 100, height: 100, seed: 42 };

  it('genera el mismo mapa con la misma semilla', () => {
    const a = generateMap(opts);
    const b = generateMap(opts);
    expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
  });

  it('genera mapas distintos con semillas distintas', () => {
    const a = generateMap(opts);
    const b = generateMap({ ...opts, seed: 7 });
    expect(Array.from(a.terrain)).not.toEqual(Array.from(b.terrain));
  });

  it('siempre tiene agua, terreno construible y variedad de terreno', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const map = generateMap({ ...opts, seed });
      const counts = new Map<Terrain, number>();
      for (const t of map.terrain) counts.set(t as Terrain, (counts.get(t as Terrain) ?? 0) + 1);
      const water = [...counts].filter(([t]) => isWater(t)).reduce((s, [, n]) => s + n, 0);
      const buildable = [...counts].filter(([t]) => TERRAIN_INFO[t].buildable).reduce((s, [, n]) => s + n, 0);
      expect(water, `semilla ${seed}: agua`).toBeGreaterThan(100);
      expect(buildable, `semilla ${seed}: construible`).toBeGreaterThan(3000);
      expect(counts.size, `semilla ${seed}: variedad`).toBeGreaterThanOrEqual(6);
    }
  });

  it('coloca el inicio en terreno construible', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const map = generateMap({ ...opts, seed });
      const t = terrainAt(map, map.start.x, map.start.y);
      expect(TERRAIN_INFO[t].buildable).toBe(true);
    }
  });
});
