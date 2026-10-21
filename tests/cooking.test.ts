import { describe, expect, it } from 'vitest';
import { buildingDef } from '../src/data/buildings';
import { recipeDef, recipesFor } from '../src/data/recipes';
import { WORK_SKILL } from '../src/data/work';
import { checkWorld } from '../src/sim/diagnostics';
import { stationWork } from '../src/sim/jobs';
import { moodOf, NUTRITION } from '../src/sim/needs';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { flatWorld } from './helpers';

function buildNow(world: ReturnType<typeof flatWorld>, x: number, y: number, id: string) {
  world.structures.place(x, y, id);
  const s = world.structures.at(x, y)!;
  for (const [r, n] of Object.entries(s.def.cost)) world.structures.deliver(s, r as never, n as number);
  world.completeStructure(s);
  return s;
}

describe('cocina', () => {
  it('la cocina es un taller con recetas para cada cultivo, y cocinar usa la habilidad Cocina', () => {
    expect(buildingDef('cocina').category).toBe('taller');
    const outs = recipesFor('cocina').map((r) => Object.keys(r.inputs)[0]);
    expect(outs.sort()).toEqual(['carne', 'huevos', 'maiz', 'patata', 'pescado', 'setas']);
    expect(WORK_SKILL.cocinar).toBe('cocina');
    // Cocinado alimenta más que lo mismo crudo.
    for (const r of recipesFor('cocina')) {
      const [[raw, n]] = Object.entries(r.inputs) as [keyof typeof NUTRITION, number][];
      expect((r.outputs.comida ?? 0) * NUTRITION.comida!).toBeGreaterThan(n * NUTRITION[raw]!);
    }
  });

  it('con una orden, un colono lleva patatas a la cocina y hace guiso hasta el objetivo', () => {
    const world = flatWorld(1);
    world.items.drop(4, 12, 'patata', 40);
    const cocina = buildNow(world, 12, 8, 'cocina');
    expect(stationWork(cocina)).toBe('cocinar');
    world.structures.setBill(cocina, { recipe: recipeDef('guiso_patatas')!, target: 6, paused: false });
    let t = 0;
    for (; t < 20000 && world.inventory().comida < 6; t++) {
      world.step();
      if (t % 250 === 0) expect(checkWorld(world)).toEqual([]);
    }
    expect(world.inventory().comida).toBe(6);
    expect(world.inventory().patata + (cocina.delivered.patata ?? 0)).toBe(25);
  });

  it('con la prioridad de Cocinar a 0 no cocina, aunque sí fabrique', () => {
    const world = flatWorld(1);
    const c = world.colonists[0];
    c.priorities.cocinar = 0;
    world.items.drop(4, 12, 'patata', 40);
    const cocina = buildNow(world, 12, 8, 'cocina');
    world.structures.setBill(cocina, { recipe: recipeDef('guiso_patatas')!, target: 6, paused: false });
    for (let i = 0; i < 4000; i++) world.step();
    expect(world.inventory().comida).toBe(0);
  });

  it('prefiere comer cocinado aunque lo crudo esté algo más cerca, y le sienta mejor', () => {
    const world = flatWorld(1, { needs: true });
    const c = world.colonists[0];
    world.items.addAt(c.tile.x + 2, c.tile.y, 'patata', 20);
    world.items.addAt(c.tile.x + 8, c.tile.y, 'comida', 5);
    c.needs.food = 0.25;
    for (let t = 0; t < 3000 && c.needs.lastMeal === null; t++) world.step();
    expect(c.needs.lastMeal).toBe('cocinada');
    expect(world.inventory().patata).toBe(20);
    expect(world.inventory().comida).toBeLessThan(5);
    const cooked = moodOf(c).mood;
    c.needs.lastMeal = 'cruda';
    expect(moodOf(c).mood).toBeLessThan(cooked);
    expect(moodOf(c).reasons.some((r) => r.text === 'Comió crudo')).toBe(true);
  });

  it('si solo hay crudo, lo come y lo apunta; se guarda con la partida', () => {
    const world = flatWorld(1, { needs: true });
    const c = world.colonists[0];
    world.items.addAt(c.tile.x + 3, c.tile.y, 'maiz', 20);
    c.needs.food = 0.25;
    for (let t = 0; t < 3000 && c.needs.lastMeal === null; t++) world.step();
    expect(c.needs.lastMeal).toBe('cruda');
    const loaded = loadWorld(JSON.stringify(serializeWorld(world)));
    expect(loaded.colonists[0].needs.lastMeal).toBe('cruda');
    // Partida antigua: sin el dato, empieza sin comida anotada.
    const old = serializeWorld(world) as unknown as { colonists: { needs: Record<string, unknown> }[] };
    delete old.colonists[0].needs.lastMeal;
    expect(loadWorld(JSON.stringify(old)).colonists[0].needs.lastMeal).toBeNull();
  });
});
