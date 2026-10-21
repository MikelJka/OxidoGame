import { describe, expect, it } from 'vitest';
import { checkWorld } from '../src/sim/diagnostics';
import { moodOf, needsWorkFactor, restGain } from '../src/sim/needs';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/world';
import { flatWorld } from './helpers';
import { index, Terrain } from '../src/sim/map';

function buildNow(world: ReturnType<typeof flatWorld>, x: number, y: number, id: string) {
  world.structures.place(x, y, id);
  const s = world.structures.at(x, y)!;
  for (const [r, n] of Object.entries(s.def.cost)) world.structures.deliver(s, r as never, n as number);
  world.completeStructure(s);
  return s;
}

describe('necesidades', () => {
  it('con hambre, un colono va a por comida y se la come', () => {
    const world = flatWorld(1, { needs: true });
    const c = world.colonists[0];
    world.items.addAt(10, 10, 'patata', 20);
    c.needs.food = 0.2;
    let ate = false;
    for (let t = 0; t < 3000 && !ate; t++) {
      world.step();
      ate = c.needs.food > 0.9;
    }
    expect(ate).toBe(true);
    expect(world.inventory().patata).toBeLessThan(20);
    expect(c.need).toBeNull();
    expect(world.reservations.list()).toEqual([]);
  });

  it('sin comida no se queda atascado: sigue con su vida y lo intenta de nuevo', () => {
    const world = flatWorld(1, { needs: true });
    const c = world.colonists[0];
    c.needs.food = 0.2;
    for (let t = 0; t < 2000; t++) world.step();
    expect(c.need).toBeNull();
    expect(checkWorld(world)).toEqual([]);
  });

  it('cansado, duerme en una cama libre y se despierta descansado', () => {
    const world = flatWorld(1, { needs: true });
    const c = world.colonists[0];
    buildNow(world, 12, 12, 'cama');
    c.needs.rest = 0.1;
    c.needs.food = 1;
    let slept = false;
    for (let t = 0; t < TICKS_PER_HOUR * 12; t++) {
      world.step();
      if (c.activity === 'sleeping') {
        slept = true;
        expect(c.tile).toEqual({ x: 12, y: 12 });
      }
      if (slept && !c.need) break;
    }
    expect(slept).toBe(true);
    expect(c.needs.rest).toBeGreaterThan(0.84);
    expect(c.needs.sleptIn).toBe('cama');
  });

  it('se recupera del todo en 6 h en cama y en 8 h en el suelo (#15, opción A)', () => {
    expect(restGain(true, TICKS_PER_HOUR) * 6 * TICKS_PER_HOUR).toBeCloseTo(1);
    expect(restGain(false, TICKS_PER_HOUR) * 8 * TICKS_PER_HOUR).toBeCloseTo(1);
    // Una noche: de vacío a lleno en cama tarda menos de 6,5 h de juego.
    const world = flatWorld(1, { needs: true });
    const c = world.colonists[0];
    buildNow(world, c.tile.x, c.tile.y, 'cama');
    c.needs.rest = 0.05;
    c.needs.food = 1;
    c.needs.water = 1;
    let asleep = -1;
    let t = 0;
    for (; t < TICKS_PER_HOUR * 12; t++) {
      world.step();
      if (asleep < 0 && c.activity === 'sleeping') asleep = t;
      if (asleep >= 0 && c.activity !== 'sleeping') break;
    }
    expect(asleep).toBeGreaterThanOrEqual(0);
    expect((t - asleep) / TICKS_PER_HOUR).toBeLessThan(6.5);
  });

  it('sin cama duerme en el suelo, y eso baja el ánimo', () => {
    const world = flatWorld(1, { needs: true });
    const c = world.colonists[0];
    c.needs.rest = 0.1;
    c.needs.food = 1;
    for (let t = 0; t < TICKS_PER_HOUR * 12 && c.needs.sleptIn === null; t++) world.step();
    expect(c.needs.sleptIn).toBe('suelo');
    expect(moodOf(c).reasons.some((r) => r.value < 0 && r.text.includes('suelo'))).toBe(true);
  });

  it('el hambre y el cansancio bajan el ánimo y el ritmo de trabajo', () => {
    const world = flatWorld(1, { needs: true });
    const c = world.colonists[0];
    c.traits = [];
    c.needs = { food: 1, water: 1, badWaterUntil: 0, rest: 1, sleptIn: null, lastMeal: null };
    const good = moodOf(c).mood;
    const fast = needsWorkFactor(c);
    c.needs = { food: 0.05, water: 1, badWaterUntil: 0, rest: 0.05, sleptIn: 'suelo', lastMeal: null };
    expect(moodOf(c).mood).toBeLessThan(good);
    expect(needsWorkFactor(c)).toBeLessThan(fast);
  });

  it('en una partida de varios días con comida y camas, nadie pasa hambre y no se rompe nada', () => {
    const world = flatWorld(3, { needs: true });
    world.items.drop(4, 20, 'patata', 150);
    for (const y of [14, 16, 18]) buildNow(world, 10, y, 'cama'); // camas de 2×1
    for (let t = 0; t < TICKS_PER_DAY * 3; t++) {
      world.step();
      if (t % 600 === 0) expect(checkWorld(world)).toEqual([]);
      for (const c of world.colonists) expect(c.needs.food).toBeGreaterThan(0.05);
    }
    expect(world.colonists.every((c) => c.needs.sleptIn === 'cama')).toBe(true);
  });

  it('las necesidades se guardan con la partida', () => {
    const world = flatWorld(1, { needs: true });
    world.colonists[0].needs = { food: 0.33, water: 0.5, badWaterUntil: 0, rest: 0.44, sleptIn: 'cama', lastMeal: 'cocinada' };
    const loaded = loadWorld(JSON.stringify(serializeWorld(world)));
    expect(loaded.colonists[0].needs).toEqual({ food: 0.33, water: 0.5, badWaterUntil: 0, rest: 0.44, sleptIn: 'cama', lastMeal: 'cocinada', funAt: world.tick });
  });
});

describe('sed y agua', () => {
  it('con sed va al agua limpia más cercana y bebe', () => {
    const world = flatWorld(1, { needs: true });
    const m = world.map;
    m.terrain[index(m, 15, 5)] = Terrain.Water;
    const c = world.colonists[0];
    c.needs.water = 0.2;
    c.needs.food = 1;
    for (let t = 0; t < 3000 && c.needs.water < 0.9; t++) world.step();
    expect(c.needs.water).toBeGreaterThan(0.9);
    expect(c.needs.badWaterUntil).toBe(0);
  });

  it('si solo hay agua contaminada, la bebe pero le sienta mal', () => {
    const world = flatWorld(1, { needs: true });
    const m = world.map;
    m.terrain[index(m, 1, 1)] = Terrain.Soil; // sin la charca limpia de la ayuda
    m.terrain[index(m, 15, 5)] = Terrain.Water;
    m.contaminated[index(m, 15, 5)] = 1;
    const c = world.colonists[0];
    c.needs.water = 0.2;
    c.needs.food = 1;
    for (let t = 0; t < 3000 && c.needs.water < 0.9; t++) world.step();
    expect(c.needs.water).toBeGreaterThan(0.9);
    expect(moodOf(c, world.tick).reasons.some((r) => r.text.includes('contaminada'))).toBe(true);
  });

  it('un pozo da agua limpia lejos del río; la depuradora tiene que ir junto al agua', () => {
    const world = flatWorld(1, { needs: true });
    const m = world.map;
    m.terrain[index(m, 1, 1)] = Terrain.Soil;
    m.terrain[index(m, 25, 25)] = Terrain.Water;
    m.contaminated[index(m, 25, 25)] = 1;
    expect(world.structures.place(10, 10, 'depuradora')).toBe(false);
    expect(world.structures.place(24, 25, 'depuradora')).toBe(true);
    world.structures.place(8, 5, 'pozo');
    const pozo = world.structures.at(8, 5)!;
    for (const [r, n] of Object.entries(pozo.def.cost)) world.structures.deliver(pozo, r as never, n as number);
    world.completeStructure(pozo);
    expect(world.drinkAt(7, 5)).toBe('limpia');
    expect(world.drinkAt(25, 24)).toBe('sucia');
    const c = world.colonists[0];
    c.needs.water = 0.2;
    c.needs.food = 1;
    for (let t = 0; t < 3000 && c.needs.water < 0.9; t++) world.step();
    expect(c.needs.badWaterUntil).toBe(0);
  });
});
