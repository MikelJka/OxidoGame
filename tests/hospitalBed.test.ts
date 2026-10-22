// Cama de hospital (aprobada por Mikel el 2026-10-22, propuesta A): 🪵15 🔩6 🧵4, 2×1, en Muebles;
// el herido va antes a ella que a su cama, sus heridas se cierran un 50 % antes y se infectan la mitad.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { hurt, treatWounds } from '../src/sim/health';
import { loadWorld, serializeWorld } from '../src/sim/save';
import type { Colonist } from '../src/sim/colonist';
import { BUILDINGS } from '../src/data/buildings';
import { HOSPITAL_BED, HOSPITAL_BED_ID } from '../src/data/medicine';

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

describe('cama de hospital', () => {
  it('es un mueble de 2×1 que cuesta 🪵15 🔩6 🧵4', () => {
    const def = BUILDINGS.find((b) => b.id === HOSPITAL_BED_ID)!;
    expect(def).toBeDefined();
    expect(def.category).toBe('mueble');
    expect(def.size).toEqual([2, 1]);
    expect(def.cost).toEqual({ madera: 15, chatarra: 6, fibra: 4 });
    expect(HOSPITAL_BED.healFactor).toBe(2);
    expect(HOSPITAL_BED.infectionFactor).toBe(0.5);
  });

  it('el herido en pie que guarda cama va antes a la de hospital, aunque la normal esté más cerca', () => {
    const w = flatWorld(1, { needs: true });
    const [c] = w.colonists;
    place(c, 10, 10);
    buildNow(w, 12, 10, 'cama');
    buildNow(w, 20, 18, HOSPITAL_BED_ID);
    c.needs.food = c.needs.water = c.needs.rest = 1;
    c.health = 0.4;
    runTicks(w, 2000, () => c.activity === 'sleeping');
    expect(c.need?.type).toBe('reposar');
    expect(c.tile).toEqual({ x: 20, y: 18 });
    expect(w.inHospitalBed(c)).toBe(true);
  });

  it('el sano duerme en su cama y no ocupa la de hospital', () => {
    const w = flatWorld(1, { needs: true });
    const [c] = w.colonists;
    place(c, 10, 10);
    buildNow(w, 12, 10, HOSPITAL_BED_ID);
    c.needs.rest = 0.05;
    runTicks(w, 300, () => c.need?.type === 'dormir');
    expect(c.need?.type).toBe('dormir');
    expect(c.need?.bed).toBe(false);
    // Con una cama normal, va a ella.
    w.endNeed(c);
    buildNow(w, 20, 18, 'cama');
    c.needs.rest = 0.05;
    runTicks(w, 300, () => c.need?.type === 'dormir');
    expect(c.need).toMatchObject({ type: 'dormir', x: 20, y: 18, bed: true });
  });

  it('al caído se le lleva antes a la cama de hospital que a la normal', () => {
    const w = flatWorld(2);
    const [helper, patient] = w.colonists;
    w.needsEnabled = false;
    patient.priorities.curar = 0;
    place(helper, 10, 10);
    place(patient, 14, 12);
    buildNow(w, 15, 12, 'cama');
    buildNow(w, 24, 20, HOSPITAL_BED_ID);
    patient.health = 0.1;
    patient.downed = true;
    expect(w.wantsCarryToBed(patient)).toBe(true);
    runTicks(w, 8000, () => patient.tile.x === 24 && patient.tile.y === 20 && patient.carriedBy === undefined);
    expect(patient.tile).toEqual({ x: 24, y: 20 });
    expect(w.log.some((e) => e.text.includes('en una cama de hospital para que se recupere'))).toBe(true);
    w.step();
    expect(patient.activity).toBe('sleeping');
    expect(w.inHospitalBed(patient)).toBe(true);
  });

  it('en ella las heridas se cierran en la mitad de tiempo que en una cama normal', () => {
    const w = flatWorld(3);
    const [, a, b] = w.colonists;
    w.needsEnabled = false;
    buildNow(w, 10, 10, 'cama');
    buildNow(w, 10, 14, HOSPITAL_BED_ID);
    place(a, 10, 10);
    place(b, 10, 14);
    for (const k of [a, b]) {
      k.needs.food = k.needs.water = 1;
      hurt(k, 0.2, 'el brazo');
      treatWounds(k);
      k.health = 0.1;
      k.downed = true;
    }
    w.step();
    const start = [a.wounds[0].severity, b.wounds[0].severity];
    for (let i = 0; i < 600; i++) w.step();
    expect(w.inHospitalBed(a)).toBe(false);
    expect(w.inHospitalBed(b)).toBe(true);
    const closedA = start[0] - a.wounds[0].severity;
    const closedB = start[1] - b.wounds[0].severity;
    expect(closedA).toBeGreaterThan(0);
    expect(closedB).toBeCloseTo(closedA * HOSPITAL_BED.healFactor, 4);
  });

  it('se puede guardar y cargar la partida con la cama de hospital', () => {
    const w = flatWorld(1);
    buildNow(w, 10, 14, HOSPITAL_BED_ID);
    const w2 = loadWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    expect(w2.isHospitalBedTile(10, 14)).toBe(true);
    expect(w2.isHospitalBedTile(11, 14)).toBe(true);
    expect(w2.isBedTile(10, 14)).toBe(true);
  });
});
