import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingDef, validateBuilding } from '../src/data/buildings';
import { checkWorld } from '../src/sim/diagnostics';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { flatWorld } from './helpers';

type W = ReturnType<typeof flatWorld>;

function runUntil(world: W, done: () => boolean, maxTicks = 30000): number {
  for (let t = 0; t < maxTicks; t++) {
    if (done()) return t;
    world.step();
    if (t % 250 === 0) expect(checkWorld(world)).toEqual([]);
  }
  return -1;
}

/** Partida llana con un horno ya construido en (12, 10) y chatarra y madera en el suelo. */
function furnaceWorld(chatarra: number, madera: number): W {
  const world = flatWorld(1);
  world.structures.place(12, 10, 'horno_fundicion');
  world.completeStructure(world.structures.at(12, 10)!);
  if (chatarra) world.items.drop(6, 12, 'chatarra', chatarra);
  if (madera) world.items.drop(8, 12, 'madera', madera);
  return world;
}

describe('metal y horno de fundición', () => {
  it('hay un horno con receta y muros y torre de metal más resistentes que los de chatarra', () => {
    const horno = buildingDef('horno_fundicion');
    expect(horno.recipe?.output).toBe('metal');
    expect(horno.recipe?.input.chatarra).toBeGreaterThan(0);
    const metal = BUILDINGS.filter((b) => b.cost.metal);
    expect(metal.some((b) => b.category === 'muro' && b.height === 1)).toBe(true);
    expect(metal.some((b) => b.category === 'muro' && b.height === 2)).toBe(true);
    expect(metal.some((b) => b.category === 'torre')).toBe(true);
    expect(buildingDef('muro_metal').hp).toBeGreaterThan(buildingDef('muro_chatarra').hp);
    expect(buildingDef('muro_alto_metal').hp).toBeGreaterThan(buildingDef('muro_alto_chatarra').hp);
    // Una construcción de producción sin receta no vale.
    expect(() => validateBuilding({ id: 'x', name: 'X', category: 'produccion', cost: { piedra: 1 }, work: 1, hp: 1, blocks: true, colors: { top: 'a', face: 'b', dark: 'c' } })).toThrow();
  });

  it('al terminarse, el horno empieza encendido y sin nada cargado', () => {
    const world = furnaceWorld(0, 0);
    const st = world.structures.at(12, 10)!.station!;
    expect(st.active).toBe(true);
    expect(st.loaded).toEqual({});
    expect(world.structures.stations()).toHaveLength(1);
  });

  it('un colono lleva chatarra y madera al horno, funde metal y para al llegar al objetivo', () => {
    const world = furnaceWorld(9, 3);
    const s = world.structures.at(12, 10)!;
    world.structures.setStation(s, true, 2);
    expect(runUntil(world, () => world.inventory().metal >= 2)).toBeGreaterThan(0);
    // Ya no empieza otra tanda: quedan 3 de chatarra y 1 de madera en el suelo.
    for (let i = 0; i < 3000; i++) world.step();
    const inv = world.inventory();
    expect(inv.metal).toBe(2);
    expect(inv.chatarra).toBe(3);
    expect(inv.madera).toBe(1);
    expect(s.station!.loaded).toEqual({});
    // El metal queda en el suelo junto al horno.
    const stack = world.items.list().find((it) => it.resource === 'metal');
    expect(stack && Math.abs(stack.x - 12) + Math.abs(stack.y - 10)).toBeLessThanOrEqual(3);
  });

  it('un horno parado no hace nada; sin límite funde todo lo que haya', () => {
    const world = furnaceWorld(6, 2);
    const s = world.structures.at(12, 10)!;
    world.structures.setStation(s, false, 0);
    for (let i = 0; i < 4000; i++) world.step();
    expect(world.inventory().metal).toBe(0);
    expect(world.inventory().chatarra).toBe(6);
    world.structures.setStation(s, true, 0);
    expect(runUntil(world, () => world.inventory().metal >= 2)).toBeGreaterThan(0);
    expect(world.inventory().chatarra).toBe(0);
  });

  it('sin prioridad de «fabricar» el colono no usa el horno', () => {
    const world = furnaceWorld(6, 2);
    world.colonists[0].priorities.fabricar = 0;
    for (let i = 0; i < 4000; i++) world.step();
    expect(world.inventory().metal).toBe(0);
  });

  it('el metal sirve para construir un muro de metal', () => {
    const world = flatWorld(1);
    world.items.drop(6, 12, 'metal', 4);
    world.structures.place(12, 10, 'muro_metal');
    expect(runUntil(world, () => !!world.structures.at(12, 10)?.built)).toBeGreaterThan(0);
    expect(world.inventory().metal).toBe(0);
  });

  it('demoler un horno devuelve los ingredientes cargados', () => {
    const world = furnaceWorld(0, 0);
    const s = world.structures.at(12, 10)!;
    world.structures.load(s, 'chatarra', 2);
    expect(world.structures.stationNeeds(s)).toEqual({ chatarra: 1, madera: 1 });
    const back = world.structures.demolish(s);
    expect(back.chatarra).toBe(Math.floor(10 / 2) + 2);
  });

  it('el estado del horno se guarda y se carga', () => {
    const world = furnaceWorld(0, 0);
    const s = world.structures.at(12, 10)!;
    world.structures.setStation(s, false, 100);
    world.structures.load(s, 'madera', 1);
    s.station!.progress = 42;
    const loaded = loadWorld(JSON.stringify(serializeWorld(world, 'test')));
    expect(loaded.structures.at(12, 10)!.station).toEqual({ active: false, target: 100, loaded: { madera: 1 }, progress: 42 });
    // Una partida de antes del horno (sin «station») toma los valores por defecto.
    const old = serializeWorld(world, 'test');
    for (const st of old.structures) delete st.station;
    expect(loadWorld(JSON.stringify(old)).structures.at(12, 10)!.station).toEqual({ active: true, target: 30, loaded: {}, progress: 0 });
  });
});
