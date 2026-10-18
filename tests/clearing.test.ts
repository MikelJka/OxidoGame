import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { index, Prop } from '../src/sim/map';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_HOUR } from '../src/sim/world';

/** Pone un objeto del mapa con algo que aprovechar. */
function put(world: ReturnType<typeof flatWorld>, x: number, y: number, prop: Prop, stock = 5): void {
  const i = index(world.map, x, y);
  world.map.props[i] = prop;
  world.map.stock[i] = stock;
}

describe('despejar las zonas al marcarlas (#14)', () => {
  it('un almacén sobre un árbol y una roca: se marcan, se quitan y la casilla entra en el almacén', () => {
    const world = flatWorld(2);
    put(world, 10, 10, Prop.DeadTree);
    put(world, 12, 11, Prop.Boulder);
    put(world, 11, 10, Prop.ScrapPile);
    const z = world.createStorageZone({ x0: 9, y0: 9, x1: 13, y1: 12 })!;
    expect(z).not.toBeNull();
    // Los que bloquean el paso quedan fuera por ahora; todo queda marcado para despejar.
    expect(world.zones.at(10, 10)).toBeUndefined();
    expect(world.clearing.countFor('almacen', z.id)).toBe(3);
    expect(world.designations.at(10, 10)).toBe('talar');
    expect(world.designations.at(12, 11)).toBe('minar');
    expect(world.designations.at(11, 10)).toBe('saquear');
    for (let t = 0; t < TICKS_PER_HOUR * 24 && world.clearing.count > 0; t++) world.step();
    expect(world.clearing.count).toBe(0);
    for (const [x, y] of [[10, 10], [12, 11], [11, 10]]) {
      expect(world.map.props[index(world.map, x, y)], `(${x}, ${y})`).toBe(Prop.None);
      expect(world.zones.at(x, y)?.id, `(${x}, ${y})`).toBe(z.id);
    }
  });

  it('en un huerto se quitan los matorrales y luego se puede sembrar', () => {
    const world = flatWorld(1);
    put(world, 8, 8, Prop.Bush);
    const f = world.createGrowZone({ x0: 7, y0: 7, x1: 9, y1: 9 })!;
    expect(world.designations.at(8, 8)).toBe('talar');
    for (let t = 0; t < TICKS_PER_HOUR * 12 && world.clearing.count > 0; t++) world.step();
    expect(world.map.props[index(world.map, 8, 8)]).toBe(Prop.None);
    expect(world.farms.at(8, 8)?.id).toBe(f.id);
  });

  it('si el jugador quita la orden, o la zona, ya no se despeja', () => {
    const world = flatWorld(0);
    put(world, 10, 10, Prop.DeadTree);
    put(world, 20, 20, Prop.DeadTree);
    world.createStorageZone({ x0: 9, y0: 9, x1: 11, y1: 11 });
    world.createStorageZone({ x0: 19, y0: 19, x1: 21, y1: 21 });
    expect(world.clearing.count).toBe(2);
    world.designations.remove(10, 10);
    world.removeZonesArea({ x0: 19, y0: 19, x1: 21, y1: 21 });
    for (let t = 0; t < TICKS_PER_HOUR; t++) world.step();
    expect(world.clearing.count).toBe(0);
    expect(world.designations.at(10, 10)).toBeUndefined();
  });

  it('lo que falta por despejar se guarda con la partida', () => {
    const world = flatWorld(0);
    put(world, 10, 10, Prop.DeadTree);
    const z = world.createStorageZone({ x0: 9, y0: 9, x1: 11, y1: 11 })!;
    const loaded = loadWorld(JSON.parse(JSON.stringify(serializeWorld(world))));
    expect(loaded.clearing.countFor('almacen', z.id)).toBe(1);
    // Una partida antigua sin el campo carga sin nada por despejar.
    const old = serializeWorld(world) as unknown as Record<string, unknown>;
    delete old.clearing;
    expect(loadWorld(JSON.parse(JSON.stringify(old))).clearing.count).toBe(0);
  });
});
