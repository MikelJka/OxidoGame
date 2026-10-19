// Bloque 1 del catálogo, segunda parte: mesa de boticario y hierba curativa.
import { describe, expect, it } from 'vitest';
import { buildingDef } from '../src/data/buildings';
import { cropDef } from '../src/data/crops';
import { recipeDef, recipesFor } from '../src/data/recipes';
import { RESOURCE_ICONS } from '../src/data/resources';
import { workSpeed } from '../src/sim/jobs';
import { checkWorld } from '../src/sim/diagnostics';
import { flatWorld } from './helpers';

function buildNow(world: ReturnType<typeof flatWorld>, x: number, y: number, id: string) {
  world.structures.place(x, y, id);
  const s = world.structures.at(x, y)!;
  for (const [r, n] of Object.entries(s.def.cost)) world.structures.deliver(s, r as never, n as number);
  world.completeStructure(s);
  return s;
}

describe('mesa de boticario y hierba curativa', () => {
  it('los números del catálogo', () => {
    const m = buildingDef('mesa_boticario');
    expect(m.category).toBe('taller');
    expect(m.cost).toEqual({ madera: 15, chatarra: 6 });
    expect(m.size).toEqual([2, 1]);
    expect(m.workSkill).toBe('medicina');
    const r = recipeDef('preparar_medicina')!;
    expect(recipesFor('mesa_boticario')).toEqual([r]);
    expect(r.inputs).toEqual({ hierba: 4, fibra: 1 });
    expect(r.outputs).toEqual({ medicina: 1 });
    expect(r.work).toBe(300);
    const h = cropDef('hierba')!;
    expect(h.resource).toBe('hierba');
    expect(h.growDays).toBe(5);
    expect(h.yield).toEqual([4, 6]);
    expect(h.minFertility).toBe(0.45);
    expect(RESOURCE_ICONS.hierba).toBe('🌿');
  });

  it('en la mesa se trabaja con la habilidad Medicina', () => {
    const world = flatWorld(1);
    const [c] = world.colonists;
    c.skills.medicina = 15;
    c.skills.construccion = 0;
    expect(workSpeed(c, 'fabricar', 'medicina')).toBeGreaterThan(workSpeed(c, 'fabricar'));
  });

  it('con una orden, un colono lleva hierba y fibra a la mesa y prepara 💊', () => {
    const world = flatWorld(2);
    world.items.drop(4, 12, 'hierba', 12);
    world.items.drop(5, 12, 'fibra', 5);
    const st = buildNow(world, 12, 8, 'mesa_boticario');
    world.structures.setBill(st, { recipe: recipeDef('preparar_medicina')!, target: 2, paused: false });
    let t = 0;
    for (; t < 30000; t++) {
      if (world.inventory().medicina >= 2 && world.colonists.every((c) => !c.job)) break;
      world.step();
      if (t % 250 === 0) expect(checkWorld(world)).toEqual([]);
    }
    expect(t).toBeLessThan(30000);
    expect(world.inventory().medicina).toBe(2);
    expect(world.inventory().hierba + (st.delivered.hierba ?? 0)).toBe(4);
  });
});
