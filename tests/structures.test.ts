import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingDef, validateBuilding } from '../src/data/buildings';
import { checkWorld } from '../src/sim/diagnostics';
import { index, isPassable, Prop, tileMoveCost, Terrain } from '../src/sim/map';
import { findPath } from '../src/sim/pathfinding';
import { Structures } from '../src/sim/structures';
import { flatWorld } from './helpers';

function runUntil(world: ReturnType<typeof flatWorld>, done: () => boolean, maxTicks = 30000): number {
  for (let t = 0; t < maxTicks; t++) {
    if (done()) return t;
    world.step();
    if (t % 250 === 0) expect(checkWorld(world)).toEqual([]);
  }
  return -1;
}

describe('definiciones de construcciones', () => {
  it('todas son válidas y hay muros de varios materiales y puertas', () => {
    expect(BUILDINGS.filter((b) => b.category === 'muro').length).toBeGreaterThanOrEqual(3);
    expect(BUILDINGS.some((b) => b.category === 'puerta')).toBe(true);
    expect(new Set(BUILDINGS.map((b) => b.id)).size).toBe(BUILDINGS.length);
    expect(() => validateBuilding({ id: 'x', name: 'X', category: 'muro', cost: { oro: 1 }, work: 1, hp: 1, blocks: true, colors: { top: 'a', face: 'b', dark: 'c' } })).toThrow();
  });

  it('hay muros altos y torres de vigía de madera, piedra y chatarra', () => {
    const high = BUILDINGS.filter((b) => b.category === 'muro' && b.height >= 2);
    const towers = BUILDINGS.filter((b) => b.category === 'torre');
    for (const list of [high, towers]) {
      expect(list.some((b) => b.cost.madera)).toBe(true);
      expect(list.some((b) => b.cost.piedra)).toBe(true);
      expect(list.some((b) => b.cost.chatarra)).toBe(true);
    }
    // Un muro alto aguanta más que el normal del mismo material.
    expect(buildingDef('muralla_piedra').hp).toBeGreaterThan(buildingDef('muro_piedra').hp);
    for (const t of towers) {
      expect(t.blocks).toBe(false);
      expect(t.sight).toBeGreaterThan(0);
    }
  });
});

describe('planos', () => {
  it('se colocan en contorno o relleno y solo en terreno llano y libre', () => {
    const world = flatWorld();
    const st = world.structures;
    expect(Structures.areaTiles({ x0: 0, y0: 0, x1: 3, y1: 2 }, 'contorno')).toHaveLength(10);
    expect(Structures.areaTiles({ x0: 0, y0: 0, x1: 3, y1: 2 }, 'relleno')).toHaveLength(12);
    world.map.props[index(world.map, 11, 10)] = Prop.Boulder;
    world.map.slope[index(world.map, 12, 10)] = 1;
    world.map.terrain[index(world.map, 13, 10)] = Terrain.Water;
    expect(st.placeArea({ x0: 10, y0: 10, x1: 14, y1: 10 }, 'muro_madera', 'contorno')).toBe(2);
    expect(st.place(10, 10, 'muro_piedra')).toBe(false); // ya hay un plano
    expect(isPassable(world.map, 10, 10)).toBe(true); // un plano no bloquea
  });

  it('quitar un plano devuelve al suelo lo ya llevado', () => {
    const world = flatWorld();
    world.structures.place(10, 10, 'muro_piedra');
    const s = world.structures.at(10, 10)!;
    expect(world.structures.deliver(s, 'piedra', 99)).toBe(6);
    expect(world.structures.deliver(s, 'madera', 5)).toBe(0);
    expect(world.cancelBlueprint(10, 10)).toBe(true);
    expect(world.structures.at(10, 10)).toBeUndefined();
    expect(world.inventory().piedra).toBe(6);
  });
});

describe('construir', () => {
  it('los colonos llevan el material, levantan el muro y este bloquea el paso', () => {
    const world = flatWorld(2);
    world.items.drop(4, 8, 'madera', 40);
    world.structures.placeArea({ x0: 12, y0: 3, x1: 12, y1: 7 }, 'muro_madera', 'contorno');
    const t = runUntil(world, () => world.structures.blueprints().length === 0);
    expect(t).toBeGreaterThan(0);
    expect(world.structures.all()).toHaveLength(5);
    expect(world.inventory().madera).toBe(40 - 5 * buildingDef('muro_madera').cost.madera!);
    for (let y = 3; y <= 7; y++) expect(isPassable(world.map, 12, y)).toBe(false);
    expect(world.colonists.every((c) => !(c.tile.x === 12 && c.tile.y >= 3 && c.tile.y <= 7))).toBe(true);
    expect(checkWorld(world)).toEqual([]);
  });

  it('una puerta se cruza (más despacio) y un cuarto cerrado con puerta sigue comunicado', () => {
    const world = flatWorld();
    world.items.drop(4, 8, 'piedra', 100);
    world.items.drop(4, 9, 'madera', 30);
    world.structures.placeArea({ x0: 15, y0: 15, x1: 19, y1: 19 }, 'muro_piedra', 'contorno');
    world.cancelBlueprint(17, 15);
    world.structures.place(17, 15, 'puerta_madera');
    runUntil(world, () => world.structures.blueprints().length === 0, 60000);
    expect(world.structures.blueprints()).toHaveLength(0);
    expect(isPassable(world.map, 17, 15)).toBe(true);
    expect(tileMoveCost(world.map, 17, 15)).toBeGreaterThan(tileMoveCost(world.map, 17, 14));
    expect(findPath(world.map, { x: 5, y: 5 }, { x: 17, y: 17 })).not.toBeNull();
    // Sin la puerta no se podría entrar.
    world.map.blocked[index(world.map, 17, 15)] = 1;
    expect(findPath(world.map, { x: 5, y: 5 }, { x: 17, y: 17 })).toBeNull();
  });

  it('una torre de vigía terminada se puede subir', () => {
    const world = flatWorld();
    world.items.drop(4, 8, 'madera', 40);
    world.structures.place(12, 12, 'torre_madera');
    runUntil(world, () => world.structures.blueprints().length === 0);
    expect(world.structures.at(12, 12)!.built).toBe(true);
    expect(isPassable(world.map, 12, 12)).toBe(true);
    expect(world.orderMove(world.colonists[0].id, { x: 12, y: 12 })).toBe(true);
    runUntil(world, () => world.colonists[0].tile.x === 12 && world.colonists[0].tile.y === 12, 3000);
    expect(world.colonists[0].tile).toEqual({ x: 12, y: 12 });
  });

  it('sin material no se construye y no se rompe nada', () => {
    const world = flatWorld();
    world.structures.place(10, 10, 'muro_chatarra');
    for (let i = 0; i < 1000; i++) world.step();
    expect(world.structures.at(10, 10)!.built).toBe(false);
    expect(world.reservations.list()).toEqual([]);
    expect(checkWorld(world)).toEqual([]);
  });

  it('un muro que se termina donde hay un montón lo aparta a una casilla libre', () => {
    const world = flatWorld();
    world.items.addAt(10, 10, 'chatarra', 7);
    world.structures.place(10, 10, 'muro_madera');
    const s = world.structures.at(10, 10)!;
    world.structures.deliver(s, 'madera', 5);
    world.completeStructure(s);
    expect(world.items.at(10, 10)).toBeUndefined();
    expect(world.inventory().chatarra).toBe(7);
    expect(checkWorld(world)).toEqual([]);
  });
});
