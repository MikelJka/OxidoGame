import { describe, expect, it } from 'vitest';
import { generateMap, isPassable, isWater, Prop, PROP_INFO, Terrain, TERRAIN_INFO, terrainAt } from '../src/sim/map';
import { findPath } from '../src/sim/pathfinding';
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
    expect(Array.from(a.props)).toEqual(Array.from(b.props));
  });

  it('genera mapas distintos con semillas distintas', () => {
    const a = generateMap(opts);
    const b = generateMap({ ...opts, seed: 7 });
    expect(Array.from(a.terrain)).not.toEqual(Array.from(b.terrain));
  });

  it('tiene agua, suelo construible y objetos variados', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const map = generateMap({ ...opts, seed });
      let water = 0;
      let buildable = 0;
      const propKinds = new Set<Prop>();
      let propCount = 0;
      for (let i = 0; i < map.terrain.length; i++) {
        const t = map.terrain[i] as Terrain;
        if (isWater(t)) water++;
        if (TERRAIN_INFO[t].buildable) buildable++;
        if (map.props[i] !== Prop.None) {
          propKinds.add(map.props[i] as Prop);
          propCount++;
        }
      }
      expect(water, `semilla ${seed}: agua`).toBeGreaterThan(100);
      expect(buildable, `semilla ${seed}: construible`).toBeGreaterThan(3000);
      expect(propKinds.size, `semilla ${seed}: tipos de objetos`).toBeGreaterThanOrEqual(7);
      expect(propCount, `semilla ${seed}: cantidad de objetos`).toBeGreaterThan(600);
      expect(propCount, `semilla ${seed}: no saturado`).toBeLessThan(4000);
    }
  });

  it('el inicio es construible, está despejado y conecta con buena parte del mapa', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const map = generateMap({ ...opts, seed });
      const { x, y } = map.start;
      expect(TERRAIN_INFO[terrainAt(map, x, y)].buildable).toBe(true);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          expect(PROP_INFO[map.props[(y + dy) * map.width + x + dx] as Prop].blocks).toBe(false);
        }
      }
      // Hay sitios alejados alcanzables.
      let reachable = 0;
      for (let k = 0; k < 10; k++) {
        const tx = (x + 15 + k * 3) % map.width;
        const ty = (y + 7 * k) % map.height;
        if (isPassable(map, tx, ty) && findPath(map, { x, y }, { x: tx, y: ty })) reachable++;
      }
      expect(reachable, `semilla ${seed}: alcanzables`).toBeGreaterThanOrEqual(3);
    }
  });
});
