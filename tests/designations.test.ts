import { describe, expect, it } from 'vitest';
import { checkWorld } from '../src/sim/diagnostics';
import { canDesignate, Designations } from '../src/sim/designations';
import { generateMap, index, Prop, PROP_INFO, rollStock, Terrain } from '../src/sim/map';
import { Rng } from '../src/sim/rng';
import { World } from '../src/sim/world';

/** Mapa llano de 20 × 20 con algunos objetos colocados a mano. */
function testMap() {
  const map = generateMap({ width: 20, height: 20, seed: 1 });
  map.terrain.fill(Terrain.Soil);
  map.props.fill(Prop.None);
  map.stock.fill(0);
  map.cliff.fill(0);
  map.slope.fill(0);
  const rng = new Rng(9);
  const put = (x: number, y: number, p: Prop) => {
    map.props[index(map, x, y)] = p;
    map.stock[index(map, x, y)] = rollStock(p, rng);
  };
  put(2, 2, Prop.DeadTree);
  put(3, 2, Prop.DeadTree);
  put(4, 3, Prop.Bush);
  put(5, 5, Prop.Boulder);
  put(6, 5, Prop.CarWreck);
  put(7, 7, Prop.ToxicBarrel);
  return map;
}

describe('designaciones', () => {
  it('un área solo marca los objetos de ese trabajo', () => {
    const d = new Designations(testMap());
    expect(d.designateArea({ x0: 0, y0: 0, x1: 10, y1: 10 }, 'talar')).toBe(3);
    expect(d.counts()).toEqual({ talar: 3, minar: 0, saquear: 0 });
    expect(d.at(2, 2)).toBe('talar');
    expect(d.at(5, 5)).toBeUndefined();
    // Las esquinas pueden darse en cualquier orden.
    expect(d.designateArea({ x0: 10, y0: 10, x1: 0, y1: 0 }, 'minar')).toBe(1);
    expect(d.designateArea({ x0: 6, y0: 5, x1: 6, y1: 5 }, 'saquear')).toBe(1);
    expect(d.count).toBe(5);
  });

  it('volver a designar no cuenta doble y lo que no se aprovecha no se marca', () => {
    const map = testMap();
    const d = new Designations(map);
    d.designateArea({ x0: 0, y0: 0, x1: 19, y1: 19 }, 'talar');
    expect(d.designateArea({ x0: 0, y0: 0, x1: 19, y1: 19 }, 'talar')).toBe(0);
    expect(d.add(7, 7, 'saquear')).toBe(false); // barril tóxico
    expect(d.add(9, 9, 'talar')).toBe(false); // suelo vacío
    expect(canDesignate(map, 4, 3, 'talar')).toBe(true);
    expect(canDesignate(map, 4, 3, 'minar')).toBe(false);
  });

  it('el área se recorta al mapa y cuenta lo que haría antes de soltar', () => {
    const d = new Designations(testMap());
    const r = { x0: -50, y0: -50, x1: 500, y1: 500 };
    expect(d.countArea(r, 'talar')).toBe(3);
    expect(d.countArea(r, null)).toBe(0);
    d.designateArea(r, 'talar');
    expect(d.countArea(r, 'talar')).toBe(0);
    expect(d.countArea(r, null)).toBe(3);
  });

  it('cancelar quita las designaciones de un área', () => {
    const d = new Designations(testMap());
    d.designateArea({ x0: 0, y0: 0, x1: 19, y1: 19 }, 'talar');
    d.designateArea({ x0: 0, y0: 0, x1: 19, y1: 19 }, 'minar');
    const v = d.version;
    expect(d.cancelArea({ x0: 0, y0: 0, x1: 3, y1: 3 })).toBe(2);
    expect(d.counts()).toEqual({ talar: 1, minar: 1, saquear: 0 });
    expect(d.version).toBeGreaterThan(v);
    expect(d.cancelArea({ x0: 0, y0: 0, x1: 3, y1: 3 })).toBe(0);
  });

  it('se poda si el objeto desaparece', () => {
    const map = testMap();
    const d = new Designations(map);
    d.add(2, 2, 'talar');
    map.props[index(map, 2, 2)] = Prop.None;
    map.stock[index(map, 2, 2)] = 0;
    expect(d.prune()).toBe(1);
    expect(d.at(2, 2)).toBeUndefined();
  });

  it('en la partida, aprovechar una casilla designada quita la designación', () => {
    const world = new World({ seed: 5 });
    const map = world.map;
    const i = map.props.indexOf(Prop.DeadTree);
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    expect(world.designations.add(x, y, 'talar')).toBe(true);
    expect(checkWorld(world)).toEqual([]);
    world.harvest(x, y);
    expect(map.props[i]).toBe(PROP_INFO[Prop.DeadTree].harvest!.leaves);
    expect(world.designations.at(x, y)).toBeUndefined();
    expect(checkWorld(world)).toEqual([]);
  });

  it('las comprobaciones avisan de una designación sin objeto', () => {
    const world = new World({ seed: 5 });
    const map = world.map;
    const i = map.props.indexOf(Prop.Boulder);
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    world.designations.add(x, y, 'minar');
    map.props[i] = Prop.None;
    expect(checkWorld(world).map((p) => p.key)).toContain(`designation-${x}-${y}`);
  });
});
