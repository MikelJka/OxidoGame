import { describe, expect, it } from 'vitest';
import { buildingDef } from '../src/data/buildings';
import { BLUEPRINT_SHARE_RADIUS } from '../src/data/work';
import { checkWorld } from '../src/sim/diagnostics';
import { flatWorld } from './helpers';

const WALL = buildingDef('muro_madera').cost.madera!;

/** Avanza hasta que el colono tenga un transporte a un plano. */
function untilHaul(world: ReturnType<typeof flatWorld>) {
  for (let t = 0; t < 2000; t++) {
    const j = world.colonists[0].job;
    if (j?.haul?.toBlueprint) return j.haul;
    world.step();
  }
  return undefined;
}

describe('llevar material a varios planos de una vez (#20)', () => {
  it('coge lo de los planos cercanos y lo reparte en un solo viaje', () => {
    const world = flatWorld(1);
    world.items.drop(4, 8, 'madera', 40);
    world.structures.placeArea({ x0: 12, y0: 3, x1: 12, y1: 7 }, 'muro_madera', 'contorno');
    const h = untilHaul(world);
    expect(h).toBeDefined();
    expect(h!.amount).toBe(5 * WALL);
    expect(h!.extra).toHaveLength(4);
    let pickups = 0;
    let carrying = false;
    for (let t = 0; t < 30000 && world.structures.blueprints().some((s) => world.structures.needsAny(s)); t++) {
      world.step();
      const now = !!world.colonists[0].carrying;
      if (now && !carrying) pickups++;
      carrying = now;
      if (t % 250 === 0) expect(checkWorld(world)).toEqual([]);
    }
    expect(pickups).toBe(1);
    for (let t = 0; t < 30000 && world.structures.blueprints().length > 0; t++) world.step();
    expect(world.structures.blueprints()).toHaveLength(0);
    expect(world.inventory().madera).toBe(40 - 5 * WALL);
    expect(checkWorld(world)).toEqual([]);
  });

  it('no coge más de lo que hay ni pasa del radio', () => {
    const world = flatWorld(1);
    world.items.drop(4, 8, 'madera', 2 * WALL);
    world.structures.place(12, 5, 'muro_madera');
    world.structures.place(12, 7, 'muro_madera');
    world.structures.place(12, 9, 'muro_madera');
    world.structures.place(12 + BLUEPRINT_SHARE_RADIUS + 3, 5, 'muro_madera');
    const h = untilHaul(world);
    expect(h!.amount).toBe(2 * WALL);
    expect(h!.extra).toHaveLength(1);
  });

  it('con dos colonos no llevan lo mismo al mismo plano', () => {
    const world = flatWorld(2);
    world.items.drop(4, 8, 'madera', 30);
    world.items.drop(4, 12, 'madera', 30);
    world.structures.placeArea({ x0: 12, y0: 3, x1: 12, y1: 10 }, 'muro_madera', 'contorno');
    for (let t = 0; t < 40000 && world.structures.blueprints().length > 0; t++) {
      world.step();
      if (t % 100 === 0) expect(checkWorld(world)).toEqual([]);
    }
    expect(world.structures.blueprints()).toHaveLength(0);
    expect(world.inventory().madera).toBe(60 - 8 * WALL);
  });
});
