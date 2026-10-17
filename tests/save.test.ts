import { describe, expect, it } from 'vitest';
import { checkWorld } from '../src/sim/diagnostics';
import { loadWorld, parseSave, SAVE_VERSION, serializeWorld } from '../src/sim/save';
import { World } from '../src/sim/world';

/** Partida con un poco de todo: órdenes, almacén, planos y muros terminados, tiempo jugado. */
function busyWorld(): World {
  const world = new World({ seed: 21 });
  const { start } = world.map;
  const r = { x0: start.x - 10, y0: start.y - 10, x1: start.x + 10, y1: start.y + 10 };
  world.designations.designateArea(r, 'talar');
  world.designations.designateArea(r, 'minar');
  const z = world.zones.create({ x0: start.x - 3, y0: start.y + 3, x1: start.x + 1, y1: start.y + 5 });
  if (z) {
    world.zones.setPriority(z.id, 3);
    world.zones.setAccepts(z.id, 'piedra', false);
  }
  world.structures.placeArea({ x0: start.x + 3, y0: start.y - 6, x1: start.x + 6, y1: start.y - 3 }, 'muro_madera', 'contorno');
  for (let i = 0; i < 4000; i++) world.step();
  return world;
}

describe('guardar y cargar', () => {
  it('una partida guardada y cargada es igual a la original', () => {
    const world = busyWorld();
    const save = serializeWorld(world, 'test');
    const text = JSON.stringify(save);
    const loaded = loadWorld(text);
    expect(loaded.tick).toBe(world.tick);
    expect(Array.from(loaded.map.terrain)).toEqual(Array.from(world.map.terrain));
    expect(Array.from(loaded.map.props)).toEqual(Array.from(world.map.props));
    expect(Array.from(loaded.map.stock)).toEqual(Array.from(world.map.stock));
    expect(Array.from(loaded.map.blocked)).toEqual(Array.from(world.map.blocked));
    expect(Array.from(loaded.map.elevation)).toEqual(Array.from(world.map.elevation));
    expect(loaded.inventory()).toEqual(world.inventory());
    expect(loaded.designations.list()).toEqual(world.designations.list());
    expect(loaded.zones.all().map((z) => ({ ...z, tiles: [...z.tiles] }))).toEqual(world.zones.all().map((z) => ({ ...z, tiles: [...z.tiles] })));
    expect(loaded.structures.all().map((s) => [s.def.id, s.x, s.y, s.built])).toEqual(world.structures.all().map((s) => [s.def.id, s.x, s.y, s.built]));
    expect(loaded.colonists.map((c) => [c.name, c.skills, c.traits.map((t) => t.id), c.priorities])).toEqual(
      world.colonists.map((c) => [c.name, c.skills, c.traits.map((t) => t.id), c.priorities]),
    );
    expect(checkWorld(loaded)).toEqual([]);
  });

  it('tras cargar, la partida sigue funcionando (los colonos retoman el trabajo)', () => {
    const world = busyWorld();
    const loaded = loadWorld(serializeWorld(world));
    const before = loaded.designations.count + loaded.structures.blueprints().length;
    for (let i = 0; i < 6000; i++) {
      loaded.step();
      if (i % 500 === 0) expect(checkWorld(loaded)).toEqual([]);
    }
    expect(loaded.designations.count + loaded.structures.blueprints().length).toBeLessThan(before);
  });

  it('lee partidas con datos de versiones antiguas o nuevas sin romperse', () => {
    const save = serializeWorld(busyWorld()) as unknown as Record<string, any>;
    // Como si la partida fuera de antes: faltan prioridades, un recurso desconocido, una construcción que ya no existe.
    delete save.colonists[0].priorities;
    save.colonists[0].skills = { mineria: 7 };
    save.colonists[0].traits = ['agil', 'rasgo-borrado'];
    save.items.push({ x: 1, y: 1, resource: 'uranio', amount: 5 });
    save.structures.push({ def: 'torre-futurista', x: 2, y: 2, built: true, delivered: {}, progress: 0, hp: 1 });
    delete save.zones;
    delete save.map.f32.moisture;
    const loaded = loadWorld(JSON.stringify(save));
    expect(loaded.colonists[0].priorities.construir).toBe(3);
    expect(loaded.colonists[0].skills.mineria).toBe(7);
    expect(loaded.colonists[0].skills.medicina).toBe(0);
    expect(loaded.colonists[0].traits.map((t) => t.id)).toEqual(['agil']);
    expect(loaded.structures.at(2, 2)).toBeUndefined();
    expect(checkWorld(loaded)).toEqual([]);
  });

  it('rechaza con un motivo claro lo que no es una partida o es de una versión más nueva', () => {
    expect(() => parseSave('hola')).toThrow(/no es JSON/);
    expect(() => parseSave({ format: 'otra-cosa' })).toThrow(/No es una partida/);
    const future = { ...serializeWorld(new World({ seed: 1, width: 40, height: 40 })), version: SAVE_VERSION + 1 };
    expect(() => parseSave(future)).toThrow(/más nueva/);
  });

  it('el archivo guardado ocupa poco (cabe de sobra en el navegador)', () => {
    const text = JSON.stringify(serializeWorld(busyWorld()));
    expect(text.length).toBeLessThan(1_000_000);
  });
});
