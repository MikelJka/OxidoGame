import { describe, expect, it } from 'vitest';
import { checkWorld } from '../src/sim/diagnostics';
import { canWorkFrom, findJob, standTiles, workSpeed } from '../src/sim/jobs';
import { index, Prop, rollStock, Terrain } from '../src/sim/map';
import { Rng } from '../src/sim/rng';
import { World } from '../src/sim/world';

/** Partida en un mapa llano de 30 × 30, sin objetos, con los colonos quietos al principio. */
function flatWorld(colonists = 1): World {
  const world = new World({ seed: 7, width: 30, height: 30, colonists });
  const map = world.map;
  map.terrain.fill(Terrain.Soil);
  map.props.fill(Prop.None);
  map.stock.fill(0);
  map.cliff.fill(0);
  map.slope.fill(0);
  map.level.fill(2);
  for (const s of world.items.list()) world.items.take(s.x, s.y, s.amount);
  world.colonists.forEach((c, i) => {
    c.path = [];
    c.tile = { x: 5 + i, y: 5 };
    c.pos = { x: 5.5 + i, y: 5.5 };
    c.activity = 'idle';
    c.waitTicks = 0;
  });
  return world;
}

const rng = new Rng(3);
function put(world: World, x: number, y: number, p: Prop): void {
  const i = index(world.map, x, y);
  world.map.props[i] = p;
  world.map.stock[i] = rollStock(p, rng);
}

/** Avanza hasta que se cumpla la condición (o se acaben los ticks). */
function runUntil(world: World, done: () => boolean, maxTicks = 20000): number {
  for (let t = 0; t < maxTicks; t++) {
    if (done()) return t;
    world.step();
  }
  return -1;
}

describe('trabajos', () => {
  it('un árbol bloquea el paso: se trabaja desde una casilla de al lado; un matorral, encima', () => {
    const world = flatWorld();
    put(world, 10, 10, Prop.DeadTree);
    put(world, 12, 12, Prop.Bush);
    expect(standTiles(world.map, 10, 10)).toHaveLength(4);
    expect(standTiles(world.map, 12, 12)).toEqual([{ x: 12, y: 12 }]);
    expect(canWorkFrom(world.map, { x: 10, y: 11 }, 10, 10)).toBe(true);
    expect(canWorkFrom(world.map, { x: 11, y: 11 }, 10, 10)).toBe(false); // en diagonal no
    expect(canWorkFrom(world.map, { x: 12, y: 13 }, 12, 12)).toBe(false);
  });

  it('un colono va a talar lo designado, la madera sale al suelo y la orden desaparece', () => {
    const world = flatWorld();
    put(world, 15, 8, Prop.DeadTree);
    const stock = world.map.stock[index(world.map, 15, 8)];
    world.designations.add(15, 8, 'talar');
    const c = world.colonists[0];
    const t = runUntil(world, () => world.designations.count === 0);
    expect(t).toBeGreaterThan(0);
    expect(world.inventory().madera).toBe(stock);
    expect(world.map.props[index(world.map, 15, 8)]).toBe(Prop.Stump);
    expect(c.job).toBeNull();
    expect(world.reservations.list()).toEqual([]);
    expect(checkWorld(world)).toEqual([]);
  });

  it('elige primero la prioridad mejor y, a igualdad, lo más cercano', () => {
    const world = flatWorld();
    const c = world.colonists[0];
    put(world, 7, 5, Prop.Boulder); // cerca, picar
    put(world, 20, 5, Prop.DeadTree); // lejos, talar
    put(world, 25, 5, Prop.DeadTree); // más lejos, talar
    world.designations.designateArea({ x0: 0, y0: 0, x1: 29, y1: 29 }, 'talar');
    world.designations.designateArea({ x0: 0, y0: 0, x1: 29, y1: 29 }, 'minar');
    expect(findJob(world, c)!.job).toMatchObject({ kind: 'minar', x: 7, y: 5 });
    c.priorities.talar = 1;
    expect(findJob(world, c)!.job).toMatchObject({ kind: 'talar', x: 20, y: 5 });
    c.priorities.talar = 0;
    c.priorities.minar = 0;
    expect(findJob(world, c)).toBeNull();
  });

  it('dos colonos no cogen la misma tarea', () => {
    const world = flatWorld(2);
    put(world, 12, 5, Prop.DeadTree);
    put(world, 12, 9, Prop.DeadTree);
    world.designations.designateArea({ x0: 0, y0: 0, x1: 29, y1: 29 }, 'talar');
    world.step();
    const [a, b] = world.colonists;
    expect(a.job).not.toBeNull();
    expect(b.job).not.toBeNull();
    expect(`${a.job!.x},${a.job!.y}`).not.toBe(`${b.job!.x},${b.job!.y}`);
    expect(checkWorld(world)).toEqual([]);
    runUntil(world, () => world.designations.count === 0);
    expect(world.designations.count).toBe(0);
    expect(world.inventory().madera).toBeGreaterThan(0);
  });

  it('quitar la orden o dar una orden directa hace que deje el trabajo', () => {
    const world = flatWorld();
    put(world, 20, 20, Prop.Boulder);
    world.designations.add(20, 20, 'minar');
    const c = world.colonists[0];
    world.step();
    expect(c.job).not.toBeNull();
    world.designations.remove(20, 20);
    world.step();
    expect(c.job).toBeNull();
    expect(world.reservations.list()).toEqual([]);

    world.designations.add(20, 20, 'minar');
    runUntil(world, () => c.job !== null);
    expect(world.orderMove(c.id, { x: 2, y: 2 })).toBe(true);
    expect(c.job).toBeNull();
    expect(c.activity).toBe('moving');
    expect(world.reservations.list()).toEqual([]);
  });

  it('con más habilidad se trabaja más rápido', () => {
    const world = flatWorld();
    const c = world.colonists[0];
    c.skills.mineria = 0;
    const slow = workSpeed(c, 'minar');
    c.skills.mineria = 20;
    expect(workSpeed(c, 'minar')).toBeGreaterThan(slow * 2);
  });

  it('lo que no se alcanza no se reserva y se sigue con lo demás', () => {
    const world = flatWorld();
    // Una roca rodeada de agua: no se llega.
    put(world, 25, 25, Prop.Boulder);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      world.map.terrain[index(world.map, 25 + dx, 25 + dy)] = Terrain.DeepWater;
    }
    put(world, 8, 8, Prop.Stones);
    world.designations.designateArea({ x0: 0, y0: 0, x1: 29, y1: 29 }, 'minar');
    runUntil(world, () => world.designations.at(8, 8) === undefined);
    expect(world.designations.at(8, 8)).toBeUndefined();
    expect(world.designations.at(25, 25)).toBe('minar');
    for (let i = 0; i < 300; i++) world.step();
    expect(world.reservations.list()).toEqual([]);
    expect(checkWorld(world)).toEqual([]);
  });

  it('en un mapa real con mucho designado, los colonos trabajan sin romper nada', () => {
    const world = new World({ seed: 12 });
    const { start } = world.map;
    const r = { x0: start.x - 12, y0: start.y - 12, x1: start.x + 12, y1: start.y + 12 };
    world.designations.designateArea(r, 'talar');
    world.designations.designateArea(r, 'minar');
    world.designations.designateArea(r, 'saquear');
    const before = world.designations.count;
    const inv0 = world.inventory();
    for (let i = 0; i < 9000; i++) {
      world.step();
      if (i % 500 === 0) expect(checkWorld(world)).toEqual([]);
    }
    expect(world.designations.count).toBeLessThan(before);
    const inv = world.inventory();
    expect(inv.madera + inv.piedra + inv.chatarra).toBeGreaterThan(inv0.madera + inv0.piedra + inv0.chatarra);
  });
});
