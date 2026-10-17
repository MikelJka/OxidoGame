import { describe, expect, it } from 'vitest';
import { MAX_STACK, RESOURCES, STARTING_SUPPLIES } from '../src/data/resources';
import { checkWorld } from '../src/sim/diagnostics';
import { DROP_RADIUS, GroundItems } from '../src/sim/items';
import { generateMap, index, isPassable, Prop, PROP_INFO, reachableFrom, Terrain } from '../src/sim/map';
import { World } from '../src/sim/world';

/** Mapa llano de prueba: todo tierra transitable, sin objetos. */
function flatMap(width = 20, height = 20) {
  const map = generateMap({ width, height, seed: 1 });
  map.terrain.fill(Terrain.Soil);
  map.props.fill(Prop.None);
  map.stock.fill(0);
  map.cliff.fill(0);
  map.slope.fill(0);
  map.level.fill(2);
  return map;
}

describe('objetos en el suelo', () => {
  it('un montón no pasa del máximo y lo que sobra va a casillas vecinas', () => {
    const items = new GroundItems(flatMap());
    const left = items.drop(10, 10, 'madera', 200);
    expect(left).toBe(0);
    expect(items.at(10, 10)).toEqual({ resource: 'madera', amount: MAX_STACK.madera });
    expect(items.totals().madera).toBe(200);
    expect(items.count).toBe(Math.ceil(200 / MAX_STACK.madera));
    for (const s of items.list()) {
      expect(s.amount).toBeLessThanOrEqual(MAX_STACK.madera);
      expect(Math.abs(s.x - 10) + Math.abs(s.y - 10)).toBeLessThanOrEqual(1);
    }
  });

  it('completa primero los montones del mismo recurso y no mezcla recursos en una casilla', () => {
    const items = new GroundItems(flatMap());
    items.drop(10, 10, 'piedra', 10);
    items.drop(10, 10, 'madera', 5);
    expect(items.at(10, 10)).toEqual({ resource: 'piedra', amount: 10 });
    const wood = items.list().find((s) => s.resource === 'madera');
    expect(wood?.amount).toBe(5);
    items.drop(10, 10, 'madera', 5);
    expect(items.list().filter((s) => s.resource === 'madera')).toEqual([{ ...wood!, amount: 10 }]);
  });

  it('no deja nada en el agua ni en casillas bloqueadas, y respeta el radio', () => {
    const map = flatMap();
    map.terrain[index(map, 10, 10)] = Terrain.ShallowWater;
    map.props[index(map, 11, 10)] = Prop.Boulder;
    const items = new GroundItems(map);
    items.drop(10, 10, 'chatarra', 30);
    expect(items.at(10, 10)).toBeUndefined();
    expect(items.at(11, 10)).toBeUndefined();
    expect(items.totals().chatarra).toBe(30);
    // Rombo de radio DROP_RADIUS alrededor de (10, 10) en un mapa de 21 × 21 todo libre.
    const big = new GroundItems(flatMap(21, 21));
    const tiles = 1 + 2 * DROP_RADIUS * (DROP_RADIUS + 1);
    expect(big.drop(10, 10, 'componentes', tiles * MAX_STACK.componentes + 10)).toBe(10);
    expect(big.count).toBe(tiles);
  });

  it('desde un objeto que bloquea (árbol en pie) suelta en las casillas de al lado', () => {
    const map = flatMap();
    map.props[index(map, 5, 5)] = Prop.DeadTree;
    const items = new GroundItems(map);
    items.drop(5, 5, 'madera', 20);
    const [s] = items.list();
    expect(Math.abs(s.x - 5) + Math.abs(s.y - 5)).toBe(1);
  });

  it('coger reduce el montón y lo quita al vaciarse', () => {
    const items = new GroundItems(flatMap());
    items.addAt(3, 3, 'piedra', 12);
    const v = items.version;
    expect(items.take(3, 3, 5)).toEqual({ resource: 'piedra', amount: 5 });
    expect(items.at(3, 3)?.amount).toBe(7);
    expect(items.take(3, 3, 99)).toEqual({ resource: 'piedra', amount: 7 });
    expect(items.at(3, 3)).toBeUndefined();
    expect(items.take(3, 3, 1)).toBeNull();
    expect(items.version).toBeGreaterThan(v);
  });
});

describe('inventario de la colonia', () => {
  it('la colonia empieza con sus provisiones en el suelo, al alcance del inicio', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const world = new World({ seed });
      const inv = world.inventory();
      for (const r of RESOURCES) expect(inv[r], `${r}, semilla ${seed}`).toBe(STARTING_SUPPLIES[r] ?? 0);
      const reach = reachableFrom(world.map, world.map.start.x, world.map.start.y);
      for (const s of world.items.list()) {
        expect(reach[index(world.map, s.x, s.y)], `montón en (${s.x}, ${s.y}), semilla ${seed}`).toBe(1);
        expect(Math.abs(s.x - world.map.start.x) + Math.abs(s.y - world.map.start.y)).toBeLessThanOrEqual(DROP_RADIUS + 3);
      }
      expect(checkWorld(world)).toEqual([]);
    }
  });

  it('las provisiones no cambian el resto de la partida (mismos colonos con la misma semilla)', () => {
    const a = new World({ seed: 3 });
    const b = new World({ seed: 3 });
    expect(a.colonists.map((c) => c.name)).toEqual(b.colonists.map((c) => c.name));
    expect(a.items.list()).toEqual(b.items.list());
  });

  it('aprovechar un objeto suelta sus recursos al lado y suben al inventario', () => {
    const world = new World({ seed: 5 });
    const map = world.map;
    const i = map.props.indexOf(Prop.DeadTree);
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    const stock = map.stock[i];
    const before = world.inventory().madera;
    const gains = world.harvest(x, y);
    expect(gains).toEqual({ madera: stock });
    expect(world.inventory().madera).toBe(before + stock);
    expect(map.props[i]).toBe(PROP_INFO[Prop.DeadTree].harvest!.leaves);
    expect(isPassable(map, x, y)).toBe(true);
    expect(world.harvest(x, y)).not.toBeNull(); // queda el tocón, que también da madera
    expect(checkWorld(world)).toEqual([]);
  });
});
