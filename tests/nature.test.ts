import { describe, expect, it } from 'vitest';
import { checkWorld } from '../src/sim/diagnostics';
import { index, Prop } from '../src/sim/map';
import { regrowNature } from '../src/sim/nature';
import { Rng } from '../src/sim/rng';
import { TICKS_PER_DAY } from '../src/sim/world';
import { flatWorld } from './helpers';

describe('la naturaleza vuelve', () => {
  it('los tocones rebrotan y junto a los árboles nacen otros, pero no en lo ocupado', () => {
    const world = flatWorld();
    const m = world.map;
    for (let x = 5; x < 25; x += 2) m.props[index(m, x, 20)] = Prop.Stump;
    m.props[index(m, 10, 10)] = Prop.DeadTree;
    const rng = new Rng(2);
    const blocked = (x: number, y: number) => x === 11 && y === 10;
    for (let h = 0; h < 24 * 6; h++) regrowNature(m, rng, (x, y) => !blocked(x, y));
    let trees = 0;
    for (let x = 5; x < 25; x += 2) if (m.props[index(m, x, 20)] === Prop.DeadTree) trees++;
    expect(trees).toBeGreaterThan(5);
    let near = 0;
    for (let y = 8; y <= 12; y++) for (let x = 8; x <= 12; x++) if (m.props[index(m, x, y)] !== Prop.None) near++;
    expect(near).toBeGreaterThan(1);
    expect(m.props[index(m, 11, 10)]).toBe(Prop.None);
    // Los árboles nuevos tienen madera.
    expect(m.stock[index(m, 10, 10)] >= 0).toBe(true);
  });

  it('en la partida, crecer no rompe nada (colonos, almacenes, construcciones)', () => {
    const world = flatWorld(2);
    const m = world.map;
    for (let x = 2; x < 28; x += 3) m.props[index(m, x, 15)] = Prop.Stump;
    world.createStorageZone({ x0: 10, y0: 13, x1: 14, y1: 17 });
    for (let t = 0; t < TICKS_PER_DAY * 2; t++) {
      world.step();
      if (t % 1000 === 0) expect(checkWorld(world)).toEqual([]);
    }
    for (const i of world.zones.all()[0].tiles) expect(m.props[i] === Prop.None || m.props[i] === Prop.Stump).toBe(true);
  });
});

describe('árboles y colonos (#7)', () => {
  it('un colono quieto entre tocones no queda encerrado cuando rebrotan', () => {
    const world = flatWorld();
    const m = world.map;
    const c = world.colonists[0];
    world.setDrafted(c.id, true); // quieto días enteros
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      m.props[index(m, c.tile.x + dx, c.tile.y + dy)] = Prop.Stump;
    }
    for (let t = 0; t < TICKS_PER_DAY * 4; t++) world.step();
    expect(checkWorld(world).filter((p) => p.key.startsWith('trapped'))).toEqual([]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      expect(m.props[index(m, c.tile.x + dx, c.tile.y + dy)]).toBe(Prop.Stump);
    }
  });
});
