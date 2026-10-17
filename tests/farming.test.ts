import { describe, expect, it } from 'vitest';
import { CROPS, cropDef, validateCrop } from '../src/data/crops';
import { checkWorld } from '../src/sim/diagnostics';
import { canFarm, fertilityAt, GrowZones, plantStage } from '../src/sim/farming';
import { index, Prop, Terrain } from '../src/sim/map';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/world';
import { flatWorld } from './helpers';

describe('cultivos', () => {
  it('hay varios cultivos válidos: comida y fibra', () => {
    expect(CROPS.length).toBeGreaterThanOrEqual(4);
    expect(CROPS.some((c) => c.resource === 'fibra')).toBe(true);
    expect(CROPS.some((c) => c.growsInDark)).toBe(true);
    expect(() => validateCrop({ id: 'x', name: 'X', resource: 'oro', growDays: 1, yield: [1, 2], minFertility: 0, sowWork: 1, harvestWork: 1 })).toThrow();
  });

  it('la tierra es fértil, la arena poco y el agua, la roca y el asfalto nada', () => {
    const world = flatWorld();
    const m = world.map;
    m.moisture.fill(0.5);
    m.terrain[index(m, 1, 1)] = Terrain.Sand;
    m.terrain[index(m, 2, 1)] = Terrain.Concrete;
    m.terrain[index(m, 3, 1)] = Terrain.Water;
    expect(fertilityAt(m, 0, 0)).toBeCloseTo(1);
    expect(fertilityAt(m, 1, 1)).toBeLessThan(0.5);
    expect(fertilityAt(m, 2, 1)).toBe(0);
    expect(fertilityAt(m, 3, 1)).toBe(0);
    m.props[index(m, 4, 4)] = Prop.Bush;
    expect(canFarm(m, 4, 4)).toBe(false); // primero hay que quitar el matorral
  });

  it('las plantas crecen de día y maduran en sus días; las setas también de noche', () => {
    const world = flatWorld();
    world.map.moisture.fill(0.5);
    const farms = new GrowZones(world.map);
    const z = farms.create({ x0: 0, y0: 0, x1: 1, y1: 0 }, cropDef('patata'))!;
    farms.sow(0, 0);
    farms.setCrop(z.id, cropDef('setas')!);
    farms.sow(1, 0);
    // Una noche entera: solo crecen las setas.
    farms.grow(TICKS_PER_DAY * 0.4, false, TICKS_PER_DAY);
    expect(farms.plantAt(0, 0)!.growth).toBe(0);
    expect(farms.plantAt(1, 0)!.growth).toBeGreaterThan(0);
    // Tres días de horas de luz maduran las patatas.
    farms.grow(TICKS_PER_DAY * 3 * (14 / 24), true, TICKS_PER_DAY);
    expect(plantStage(farms.plantAt(0, 0)!)).toBe(3);
    const got = farms.harvest(0, 0, (a) => a);
    expect(got).toEqual({ resource: 'patata', amount: 8 });
    expect(farms.plantAt(0, 0)).toBeUndefined();
  });

  it('los colonos siembran el huerto y, cuando madura, cosechan y lo guardan', () => {
    const world = flatWorld(2);
    world.map.moisture.fill(0.5);
    const z = world.createGrowZone({ x0: 10, y0: 10, x1: 12, y1: 11 })!;
    world.farms.setCrop(z.id, cropDef('setas')!);
    world.createStorageZone({ x0: 3, y0: 12, x1: 5, y1: 14 });
    let sown = false;
    for (let t = 0; t < TICKS_PER_DAY * 3; t++) {
      world.step();
      if (!sown && world.farms.plantList().length === 6) sown = true;
      if (t % 500 === 0) expect(checkWorld(world)).toEqual([]);
      if (sown && world.inventory().setas > 0 && world.items.list().every((s) => world.zones.at(s.x, s.y))) break;
    }
    expect(sown).toBe(true);
    expect(world.inventory().setas).toBeGreaterThan(0);
  });

  it('un almacén y un huerto no se pisan', () => {
    const world = flatWorld();
    world.createGrowZone({ x0: 0, y0: 0, x1: 4, y1: 4 });
    const s = world.createStorageZone({ x0: 2, y0: 2, x1: 6, y1: 6 })!;
    expect(s.tiles.size).toBe(25 - 9);
  });

  it('los huertos y lo plantado se guardan con la partida', () => {
    const world = flatWorld();
    world.map.moisture.fill(0.5);
    const z = world.createGrowZone({ x0: 10, y0: 10, x1: 11, y1: 10 })!;
    world.farms.setCrop(z.id, cropDef('maiz')!);
    world.farms.sow(10, 10);
    world.farms.grow(TICKS_PER_DAY, true, TICKS_PER_DAY);
    const loaded = loadWorld(JSON.stringify(serializeWorld(world)));
    expect(loaded.farms.all().map((f) => [f.name, f.crop.id, f.tiles.size])).toEqual([[z.name, 'maiz', 2]]);
    expect(loaded.farms.plantAt(10, 10)!.growth).toBeCloseTo(world.farms.plantAt(10, 10)!.growth);
  });
});
