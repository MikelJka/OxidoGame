import { describe, expect, it } from 'vitest';
import {
  generateMap, isPassable, isWater, MAX_LEVEL, MIN_FLAT_AREA, Prop, PROP_INFO, reachableFrom, Terrain, TERRAIN_INFO, terrainAt, tileMoveCost,
} from '../src/sim/map';
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
  const opts = { width: 140, height: 140, seed: 42 };

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

  it('el relieve deja llanos amplios donde construir', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const map = generateMap({ ...opts, seed });
      const W = map.width;
      // Parte de la tierra cuyo cuadrado de 7×7 alrededor está todo a la misma altura.
      let land = 0;
      let flat = 0;
      for (let y = 3; y < map.height - 3; y++) {
        for (let x = 3; x < W - 3; x++) {
          const l = map.level[y * W + x];
          if (!l) continue;
          land++;
          let ok = true;
          for (let dy = -3; dy <= 3 && ok; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              if (map.level[(y + dy) * W + x + dx] !== l) {
                ok = false;
                break;
              }
            }
          }
          if (ok) flat++;
        }
      }
      expect(flat / land, `semilla ${seed}: llanos 7×7`).toBeGreaterThan(0.18);
      // No quedan manchas de altura pequeñas (salvo orillas y vados, que van al nivel del agua).
      const seen = new Uint8Array(map.level.length);
      for (let s = 0; s < map.level.length; s++) {
        if (!map.level[s] || seen[s]) continue;
        const stack = [s];
        seen[s] = 1;
        let n = 0;
        let shore = false;
        while (stack.length) {
          const i = stack.pop()!;
          n++;
          const t = map.terrain[i] as Terrain;
          if (t === Terrain.Sand || t === Terrain.ShallowWater) shore = true;
          const x = i % W;
          const y = (i - x) / W;
          for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
            if (nx < 0 || ny < 0 || nx >= W || ny >= map.height) continue;
            const j = ny * W + nx;
            if (!seen[j] && map.level[j] === map.level[s]) {
              seen[j] = 1;
              stack.push(j);
            }
          }
        }
        if (!shore) expect(n, `semilla ${seed}: mancha de nivel ${map.level[s]}`).toBeGreaterThanOrEqual(MIN_FLAT_AREA);
      }
    }
  });

  it('genera relieve: terrazas, acantilados y pendientes', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const map = generateMap({ ...opts, seed });
      const perLevel = new Array(MAX_LEVEL + 1).fill(0);
      let cliffs = 0;
      let slopes = 0;
      for (let i = 0; i < map.level.length; i++) {
        perLevel[map.level[i]]++;
        cliffs += map.cliff[i];
        slopes += map.slope[i];
        expect(map.cliff[i] && map.slope[i], `semilla ${seed}: acantilado y pendiente a la vez`).toBeFalsy();
      }
      const bigLevels = perLevel.slice(1).filter((n) => n > 400).length;
      expect(bigLevels, `semilla ${seed}: niveles con superficie`).toBeGreaterThanOrEqual(3);
      expect(cliffs, `semilla ${seed}: acantilados`).toBeGreaterThan(100);
      expect(slopes, `semilla ${seed}: pendientes`).toBeGreaterThan(100);
    }
  });

  it('el mismo relieve con la misma semilla', () => {
    const a = generateMap(opts);
    const b = generateMap(opts);
    expect(Array.from(a.level)).toEqual(Array.from(b.level));
    expect(Array.from(a.cliff)).toEqual(Array.from(b.cliff));
  });

  it('los acantilados no se pisan, no tienen objetos y las pendientes cuestan más', () => {
    const map = generateMap(opts);
    for (let i = 0; i < map.cliff.length; i++) {
      const x = i % map.width;
      const y = Math.floor(i / map.width);
      if (map.cliff[i]) {
        expect(isPassable(map, x, y)).toBe(false);
        expect(map.props[i]).toBe(Prop.None);
        expect(map.terrain[i]).not.toBe(Terrain.Concrete);
      }
    }
    map.terrain[0] = Terrain.Soil;
    map.props[0] = Prop.None;
    map.cliff[0] = 0;
    map.slope[0] = 0;
    const flat = tileMoveCost(map, 0, 0);
    map.slope[0] = 1;
    expect(tileMoveCost(map, 0, 0)).toBeGreaterThan(flat);
  });

  it('ningún acantilado deja aislada una zona alcanzable a pie (pasos estrechos)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const map = generateMap({ ...opts, seed });
      const reached = reachableFrom(map, map.start.x, map.start.y);
      const w = map.width;
      for (let i = 0; i < map.cliff.length; i++) {
        if (!map.cliff[i]) continue;
        let inside = false;
        let outside = false;
        const x = i % w;
        const y = Math.floor(i / w);
        for (const [jx, jy] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (!isPassable(map, jx, jy)) continue;
          const j = jy * w + jx;
          if (reached[j]) inside = true;
          else outside = true;
        }
        expect(inside && outside, `semilla ${seed}: acantilado ${i % w},${Math.floor(i / w)} aísla una zona`).toBe(false);
      }
    }
  });

  it('casi todo el terreno transitable se alcanza desde el inicio (vados garantizados)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const map = generateMap({ ...opts, seed });
      const reached = reachableFrom(map, map.start.x, map.start.y);
      let passable = 0;
      let ok = 0;
      for (let i = 0; i < reached.length; i++) {
        if (!isPassable(map, i % map.width, Math.floor(i / map.width))) continue;
        passable++;
        ok += reached[i];
      }
      expect(ok / passable, `semilla ${seed}: alcanzable`).toBeGreaterThan(0.9);
    }
  });
});
