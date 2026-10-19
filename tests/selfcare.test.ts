// Prioridad médica tras los combates, lo que faltaba (decidido el 2026-10-19):
// curarse uno mismo (opción A) y el herido en pie que guarda cama (opción C).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { hurt, tickHealth, tickInfection, treatWounds } from '../src/sim/health';
import { TICKS_PER_DAY } from '../src/sim/world';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { createColonist, type Colonist } from '../src/sim/colonist';
import { Rng } from '../src/sim/rng';
import { BED_REST, INFECTION } from '../src/data/medicine';

type W = ReturnType<typeof flatWorld>;

function place(c: Colonist, x: number, y: number): void {
  c.tile = { x, y };
  c.pos = { x: x + 0.5, y: y + 0.5 };
  c.path = [];
}

function buildNow(w: W, x: number, y: number, id: string) {
  w.structures.place(x, y, id);
  const s = w.structures.at(x, y)!;
  for (const [r, n] of Object.entries(s.def.cost)) w.structures.deliver(s, r as never, n as number);
  w.completeStructure(s);
  return s;
}

function runTicks(w: W, n: number, until: () => boolean): void {
  for (let i = 0; i < n && !until(); i++) w.step();
}

const bleeds = (c: Colonist) => c.wounds.some((k) => k.bleeding);

describe('curarse uno mismo', () => {
  it('sin nadie libre, el herido en pie se cura él mismo', () => {
    const w = flatWorld(1);
    const [c] = w.colonists;
    c.priorities.curar = 0;
    hurt(c, 0.3, 'el brazo derecho');
    runTicks(w, 600, () => !bleeds(c));
    expect(bleeds(c)).toBe(false);
    expect(c.wounds[0].self).toBe(true);
    expect(w.log.some((e) => e.text.includes('se cura él mismo'))).toBe(true);
  });

  it('el que está en el suelo no puede curarse solo', () => {
    const w = flatWorld(1);
    const [c] = w.colonists;
    hurt(c, 0.3, 'el pecho');
    c.health = 0.1;
    c.downed = true;
    for (let i = 0; i < 300; i++) w.step();
    expect(bleeds(c)).toBe(true);
  });

  it('las heridas que se cura uno mismo se cierran a la mitad de velocidad', () => {
    const rng = new Rng(1);
    const a = createColonist(1, { x: 0, y: 0 }, rng);
    const b = createColonist(2, { x: 0, y: 0 }, rng);
    for (const k of [a, b]) {
      k.needs.food = k.needs.water = 1;
      hurt(k, 0.2, 'el brazo');
    }
    treatWounds(a);
    treatWounds(b, false, true);
    tickHealth(a, 100, TICKS_PER_DAY, false);
    tickHealth(b, 100, TICKS_PER_DAY, false);
    const closedA = 0.5 - a.wounds[0].severity;
    const closedB = 0.5 - b.wounds[0].severity;
    expect(closedB).toBeCloseTo(closedA / 2, 6);
  });

  it('y se infectan más: 12 % (4 % con 💊)', () => {
    expect(INFECTION.chanceSelf).toBe(0.12);
    expect(INFECTION.chanceSelfMedicine).toBe(0.04);
    const rate = (self: boolean) => {
      const rng = new Rng(9);
      let n = 0;
      for (let i = 0; i < 4000; i++) {
        const k = createColonist(i, { x: 0, y: 0 }, rng);
        hurt(k, 0.2, 'el brazo');
        treatWounds(k, false, self);
        tickInfection(k, TICKS_PER_DAY, TICKS_PER_DAY, rng);
        if (k.infection) n++;
      }
      return n / 4000;
    };
    expect(rate(true)).toBeGreaterThan(0.1);
    expect(rate(true)).toBeLessThan(0.14);
    expect(rate(false)).toBeLessThan(0.1);
  });

  it('la marca de curado por uno mismo se guarda con la partida', () => {
    const w = flatWorld(1);
    hurt(w.colonists[0], 0.2, 'el brazo');
    treatWounds(w.colonists[0], false, true);
    const back = loadWorld(serializeWorld(w));
    expect(back.colonists[0].wounds[0].self).toBe(true);
  });
});

describe('el herido en pie guarda cama', () => {
  it('por debajo del 50 % se acuesta en una cama y se queda hasta el 80 %', () => {
    const w = flatWorld(1, { needs: true });
    const [c] = w.colonists;
    buildNow(w, 12, 12, 'cama');
    c.needs.food = c.needs.water = c.needs.rest = 1;
    c.health = 0.4;
    runTicks(w, 400, () => c.activity === 'sleeping');
    expect(c.need?.type).toBe('reposar');
    expect(c.tile).toEqual({ x: 12, y: 12 });
    expect(c.resting).toBe(true);
    expect(w.log.some((e) => e.text.includes('se acuesta hasta recuperarse'))).toBe(true);
    // A 0,6 sigue en la cama (no se levanta hasta el 80 %).
    c.health = 0.6;
    for (let i = 0; i < 30; i++) w.step();
    expect(c.need?.type).toBe('reposar');
    c.health = BED_REST.untilHealth;
    w.step();
    expect(c.need).toBeNull();
    expect(c.resting).toBe(false);
    expect(w.log.some((e) => e.text.includes('se ha recuperado'))).toBe(true);
  });

  it('se levanta a comer y vuelve a la cama aunque ya pase del 50 %', () => {
    const w = flatWorld(1, { needs: true });
    const [c] = w.colonists;
    buildNow(w, 12, 12, 'cama');
    w.items.drop(20, 20, 'comida', 10);
    c.needs.food = c.needs.water = c.needs.rest = 1;
    c.health = 0.4;
    runTicks(w, 400, () => c.activity === 'sleeping');
    expect(c.need?.type).toBe('reposar');
    c.health = 0.6;
    c.needs.food = 0.05;
    runTicks(w, 2000, () => c.need?.type === 'comer');
    expect(c.need?.type).toBe('comer');
    runTicks(w, 3000, () => c.need?.type === 'reposar');
    expect(c.need?.type).toBe('reposar');
    expect(c.needs.food).toBeGreaterThan(0.3);
  });

  it('con heridas que sangran, primero se cura; sin cama, reposa en el suelo', () => {
    const w = flatWorld(1, { needs: true });
    const [c] = w.colonists;
    c.needs.food = c.needs.water = c.needs.rest = 1;
    hurt(c, 0.2, 'la pierna');
    c.health = 0.4;
    expect(w.wantsBedRest(c)).toBe(false);
    runTicks(w, 1500, () => c.need?.type === 'reposar');
    expect(bleeds(c)).toBe(false);
    expect(c.need?.type).toBe('reposar');
    expect(c.need?.bed).toBe(false);
  });

  it('no se acuesta mientras queda un saqueador en pie, ni reclutado', () => {
    const w = flatWorld(1, { needs: true });
    const [c] = w.colonists;
    c.health = 0.4;
    c.drafted = true;
    expect(w.wantsBedRest(c)).toBe(false);
    c.drafted = false;
    const r = w.makePawn('saqueador');
    place(r, 25, 25);
    r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
    w.others.push(r);
    expect(w.wantsBedRest(c)).toBe(false);
    r.raider.fleeing = true;
    expect(w.wantsBedRest(c)).toBe(true);
  });

  it('guardar cama se guarda con la partida', () => {
    const w = flatWorld(1, { needs: true });
    w.colonists[0].resting = true;
    expect(loadWorld(serializeWorld(w)).colonists[0].resting).toBe(true);
  });
});
