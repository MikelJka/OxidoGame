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
    // Los muros sí van en las pendientes (para cerrar los huecos de los acantilados).
    expect(st.placeArea({ x0: 10, y0: 10, x1: 14, y1: 10 }, 'muro_madera', 'contorno')).toBe(3);
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

  it('portones, suelos, barricadas y pinchos se pisan, cada uno con su coste de paso', () => {
    const world = flatWorld();
    const base = tileMoveCost(world.map, 20, 20);
    const put = (x: number, id: string) => {
      world.structures.place(x, 20, id);
      const s = world.structures.at(x, 20)!;
      for (const [r, n] of Object.entries(s.def.cost)) world.structures.deliver(s, r as never, n as number);
      world.completeStructure(s);
      return tileMoveCost(world.map, x, 20);
    };
    expect(put(10, 'porton_madera')).toBeGreaterThan(base);
    expect(put(11, 'suelo_piedra')).toBeLessThan(base);
    expect(put(12, 'barricada_madera')).toBeGreaterThan(put(13, 'puerta_madera'));
    expect(put(14, 'pinchos_madera')).toBeGreaterThan(base * 2);
    for (let x = 10; x <= 14; x++) expect(isPassable(world.map, x, 20)).toBe(true);
    expect(checkWorld(world)).toEqual([]);
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

describe('construcciones de varias casillas', () => {
  it('una cama ocupa 2×1 (o 1×2 girada) y un horno 2×2; no se solapan', () => {
    const world = flatWorld();
    const st = world.structures;
    expect(st.place(10, 10, 'cama')).toBe(true);
    expect(st.at(11, 10)).toBe(st.at(10, 10));
    expect(st.place(11, 10, 'cama')).toBe(false);
    expect(st.place(10, 12, 'cama', 1)).toBe(true);
    expect(st.at(10, 13)).toBe(st.at(10, 12));
    expect(st.place(14, 10, 'horno')).toBe(true);
    expect(st.tilesOf(st.at(15, 11)!)).toHaveLength(4);
    expect(st.all().length).toBe(3);
  });

  it('no cabe sobre un desnivel ni encima de un objeto', () => {
    const world = flatWorld();
    world.map.level[index(world.map, 21, 10)] = 3;
    expect(world.structures.place(20, 10, 'horno')).toBe(false);
    world.map.props[index(world.map, 26, 11)] = Prop.Boulder;
    expect(world.structures.place(25, 10, 'horno')).toBe(false);
  });

  it('un horno 2×2 se construye desde fuera, bloquea sus 4 casillas y funde', () => {
    const world = flatWorld(2);
    world.items.drop(4, 20, 'piedra', 50);
    world.items.drop(4, 22, 'chatarra', 40);
    world.structures.place(14, 10, 'horno');
    runUntil(world, () => world.structures.blueprints().length === 0, 40000);
    const h = world.structures.at(14, 10)!;
    expect(h.built).toBe(true);
    for (const t of world.structures.tilesOf(h)) expect(isPassable(world.map, t.x, t.y)).toBe(false);
    world.demolishStructure(h);
    for (const t of world.structures.tilesOf(h)) expect(isPassable(world.map, t.x, t.y)).toBe(true);
    expect(checkWorld(world)).toEqual([]);
  });
});

describe('suelos (capa aparte)', () => {
  it('sobre un suelo se construye de todo menos lo del agua; el muro manda en el paso y al demolerlo vuelve el suelo', () => {
    const world = flatWorld();
    const st = world.structures;
    const put = (x: number, y: number, id: string, rot: 0 | 1 = 0) => {
      expect(st.place(x, y, id, rot)).toBe(true);
      const s = [...st.all()].reverse().find((k) => k.x === x && k.y === y && k.def.id === id)!;
      for (const [r, n] of Object.entries(s.def.cost)) st.deliver(s, r as never, n as number);
      world.completeStructure(s);
      return s;
    };
    put(10, 10, 'suelo_piedra');
    put(11, 10, 'suelo_piedra');
    const base = tileMoveCost(world.map, 10, 10);
    expect(st.place(10, 10, 'suelo_madera')).toBe(false); // ya hay suelo
    const wall = put(10, 10, 'muro_piedra');
    expect(isPassable(world.map, 10, 10)).toBe(false);
    expect(st.at(10, 10)).toBe(wall);
    expect(st.floorAt(10, 10)?.def.id).toBe('suelo_piedra');
    expect(st.canPlaceDef(buildingDef('pozo'), 11, 10)).toBe(false); // agua no
    expect(st.canPlaceDef(buildingDef('cama'), 9, 10)).toBe(false); // la cama 2×1 pisaría el muro
    expect(st.place(11, 10, 'cama', 1)).toBe(true); // girada sí cabe sobre el suelo
    world.demolishStructure(wall);
    expect(tileMoveCost(world.map, 10, 10)).toBeCloseTo(base);
    expect(checkWorld(world)).toEqual([]);
  });

  it('los colonos construyen un muro encima de un suelo terminado', () => {
    const world = flatWorld();
    world.items.drop(4, 20, 'piedra', 30);
    world.structures.place(12, 12, 'suelo_piedra');
    runUntil(world, () => world.structures.blueprints().length === 0);
    world.structures.place(12, 12, 'muro_piedra');
    runUntil(world, () => world.structures.blueprints().length === 0);
    expect(world.structures.mainAt(12, 12)?.built).toBe(true);
    expect(world.structures.floorAt(12, 12)?.built).toBe(true);
    expect(isPassable(world.map, 12, 12)).toBe(false);
  });
});

describe('no encerrarse al construir (#8)', () => {
  it('quien pone la última pieza de un cuarto pequeño desde dentro sale por fuera', () => {
    const world = flatWorld();
    // Cuarto de 3×3 por dentro sin puerta; el colono está dentro, junto al último hueco.
    const st = world.structures;
    for (let y = 10; y <= 14; y++) for (let x = 10; x <= 14; x++) {
      if (!(x === 10 || x === 14 || y === 10 || y === 14) || (x === 12 && y === 10)) continue;
      st.place(x, y, 'muro_madera');
      const s = st.at(x, y)!;
      st.deliver(s, 'madera', 5);
      world.completeStructure(s);
    }
    const c = world.colonists[0];
    c.tile = { x: 12, y: 11 };
    c.pos = { x: 12.5, y: 11.5 };
    st.place(12, 10, 'muro_madera');
    const last = st.at(12, 10)!;
    st.deliver(last, 'madera', 5);
    world.completeStructure(last);
    expect(c.tile).toEqual({ x: 12, y: 9 });
    expect(checkWorld(world).filter((p) => p.key.startsWith('trapped'))).toEqual([]);
  });
});
