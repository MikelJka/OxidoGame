import { describe, expect, it } from 'vitest';
import { checkWorld } from '../src/sim/diagnostics';
import { bestStorageTile } from '../src/sim/jobs';
import { index, Prop, rollStock, Terrain } from '../src/sim/map';
import { Rng } from '../src/sim/rng';
import { World } from '../src/sim/world';
import { flatWorld } from './helpers';
import { StorageZones } from '../src/sim/zones';

function runUntil(world: World, done: () => boolean, maxTicks = 20000): number {
  for (let t = 0; t < maxTicks; t++) {
    if (done()) return t;
    world.step();
    if (t % 250 === 0) expect(checkWorld(world)).toEqual([]);
  }
  return -1;
}

describe('zonas de almacén', () => {
  it('se crean sobre casillas libres, sin solaparse, y se pueden recortar', () => {
    const world = flatWorld();
    world.map.terrain[index(world.map, 1, 1)] = Terrain.Soil;
    world.map.terrain[index(world.map, 2, 2)] = Terrain.Water;
    const zones = new StorageZones(world.map);
    const a = zones.create({ x0: 0, y0: 0, x1: 3, y1: 3 })!;
    expect(a.tiles.size).toBe(15); // 16 menos el agua
    const b = zones.create({ x0: 2, y0: 2, x1: 5, y1: 5 })!;
    expect(b.tiles.size).toBe(16 - 4); // las de la otra zona (y el agua) se respetan
    expect(zones.at(3, 3)?.id).toBe(a.id);
    expect(zones.removeArea({ x0: 0, y0: 0, x1: 9, y1: 9 })).toBe(27);
    expect(zones.all()).toEqual([]);
  });

  it('el filtro y la prioridad deciden adónde va cada recurso', () => {
    const world = flatWorld();
    const low = world.zones.create({ x0: 10, y0: 10, x1: 11, y1: 11 })!;
    const high = world.zones.create({ x0: 20, y0: 20, x1: 21, y1: 21 })!;
    world.zones.setPriority(high.id, 4);
    expect(bestStorageTile(world, 'madera', 0, { x: 10, y: 10 })).toEqual({ x: 20, y: 20 });
    world.zones.setAccepts(high.id, 'madera', false);
    expect(bestStorageTile(world, 'madera', 0, { x: 10, y: 10 })).toEqual({ x: 10, y: 10 });
    expect(world.zones.priorityFor(20, 20, 'madera')).toBe(0);
    expect(world.zones.priorityFor(20, 20, 'piedra')).toBe(4);
    // Lo que ya está en una zona de su prioridad no se mueve a otra igual.
    expect(bestStorageTile(world, 'madera', low.priority, { x: 10, y: 10 })).toBeNull();
  });

  it('los colonos llevan los montones sueltos al almacén', () => {
    const world = flatWorld(2);
    world.items.drop(3, 20, 'madera', 120);
    world.items.drop(25, 3, 'piedra', 30);
    world.zones.create({ x0: 12, y0: 12, x1: 14, y1: 14 });
    const t = runUntil(world, () => world.items.list().every((s) => world.zones.at(s.x, s.y)) && world.colonists.every((c) => !c.job));
    expect(t).toBeGreaterThan(0);
    expect(world.inventory().madera).toBe(120);
    expect(world.inventory().piedra).toBe(30);
    expect(world.colonists.every((c) => c.carrying === null)).toBe(true);
    expect(world.reservations.list()).toEqual([]);
  });

  it('cambiar la prioridad mueve lo guardado a la zona más importante', () => {
    const world = flatWorld();
    const a = world.zones.create({ x0: 12, y0: 12, x1: 13, y1: 13 })!;
    const b = world.zones.create({ x0: 20, y0: 5, x1: 21, y1: 6 })!;
    world.items.addAt(12, 12, 'chatarra', 20);
    for (let i = 0; i < 600; i++) world.step();
    expect(world.items.at(12, 12)?.amount).toBe(20); // misma prioridad: se queda
    world.zones.setPriority(b.id, 3);
    runUntil(world, () => world.items.list().every((s) => world.zones.at(s.x, s.y)?.id === b.id));
    expect(world.items.list().every((s) => world.zones.at(s.x, s.y)?.id === b.id)).toBe(true);
    expect(a.tiles.size).toBe(4);
  });

  it('el criterio de la fase 2: marco árboles y los colonos los talan y guardan la madera solos', () => {
    const world = flatWorld(3);
    const rng = new Rng(4);
    for (const [x, y] of [[20, 20], [22, 21], [24, 20], [21, 24]]) {
      world.map.props[index(world.map, x, y)] = Prop.DeadTree;
      world.map.stock[index(world.map, x, y)] = rollStock(Prop.DeadTree, rng);
    }
    world.designations.designateArea({ x0: 18, y0: 18, x1: 26, y1: 26 }, 'talar');
    world.zones.create({ x0: 4, y0: 10, x1: 7, y1: 13 });
    const t = runUntil(
      world,
      () => world.designations.count === 0 && world.items.list().every((s) => world.zones.at(s.x, s.y)) && world.colonists.every((c) => !c.job),
      40000,
    );
    expect(t).toBeGreaterThan(0);
    expect(world.inventory().madera).toBeGreaterThan(40);
  });
});
