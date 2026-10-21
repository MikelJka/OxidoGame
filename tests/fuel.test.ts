import { describe, expect, it } from 'vitest';
import { buildingDef } from '../src/data/buildings';
import { recipeDef, recipesFor } from '../src/data/recipes';
import { RESOURCE_ICONS } from '../src/data/resources';
import { checkWorld } from '../src/sim/diagnostics';
import { startTrader } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { flatWorld } from './helpers';

/** Levanta una construcción al momento (con su material) para las pruebas. */
function buildNow(world: ReturnType<typeof flatWorld>, x: number, y: number, id: string) {
  world.structures.place(x, y, id);
  const s = world.structures.at(x, y)!;
  for (const [r, n] of Object.entries(s.def.cost)) world.structures.deliver(s, r as never, n as number);
  world.completeStructure(s);
  return s;
}

describe('⛽ combustible y destilería (decidido por Mikel el 2026-10-19)', () => {
  it('la destilería cuesta 🔩20 ⚙️2, ocupa 2×2, va en Talleres y su tanda es 10 🪵 → 2 ⛽ con el doble de trabajo que un cuchillo', () => {
    const d = buildingDef('destileria');
    expect(d.category).toBe('taller');
    expect(d.cost).toEqual({ chatarra: 20, componentes: 2 });
    expect(d.size).toEqual([2, 2]);
    expect(d.power).toBeUndefined();
    const r = recipeDef('destilar_combustible')!;
    expect(recipesFor('destileria').map((x) => x.id)).toEqual([r.id, 'hacer_napalm']);
    expect(r.inputs).toEqual({ madera: 10 });
    expect(r.outputs).toEqual({ combustible: 2 });
    expect(r.work).toBe(recipeDef('fabricar_cuchillo')!.work * 2);
    expect(RESOURCE_ICONS.combustible).toBe('⛽');
  });

  it('con una orden, un colono lleva madera a la destilería y destila ⛽ hasta el objetivo', () => {
    const world = flatWorld(2);
    world.items.drop(4, 12, 'madera', 40);
    const st = buildNow(world, 12, 8, 'destileria');
    world.structures.setBill(st, { recipe: recipeDef('destilar_combustible')!, target: 4, paused: false });
    let t = 0;
    for (; t < 30000; t++) {
      if (world.inventory().combustible >= 4 && world.colonists.every((c) => !c.job)) break;
      world.step();
      if (t % 250 === 0) expect(checkWorld(world)).toEqual([]);
    }
    expect(t).toBeLessThan(30000);
    expect(world.inventory().combustible).toBe(4);
    expect(world.inventory().madera + (st.delivered.madera ?? 0)).toBe(20);
    // El ⛽ se guarda con la partida.
    expect(loadWorld(JSON.stringify(serializeWorld(world))).inventory().combustible).toBe(4);
  });

  it('las caravanas no traen ⛽: solo sale de la destilería', () => {
    const world = flatWorld();
    for (let i = 0; i < 30; i++) {
      const t = startTrader(world);
      if (t) expect(t.trader!.stock.combustible).toBeUndefined();
    }
  });
});
