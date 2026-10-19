// Prioridad médica tras los combates (pedida por Mikel el 2026-10-19), primera parte:
// sin saqueadores en pie, cualquier colono no reclutado atiende antes que nada a un colono que sangra.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { hurt } from '../src/sim/health';
import { TICKS_PER_DAY } from '../src/sim/world';
import type { Colonist } from '../src/sim/colonist';

type W = ReturnType<typeof flatWorld>;

function raiderAt(w: W, x: number, y: number): Colonist {
  const r = w.makePawn('saqueador');
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
  w.others.push(r);
  return r;
}

function place(c: Colonist, x: number, y: number): void {
  c.tile = { x, y };
  c.pos = { x: x + 0.5, y: y + 0.5 };
  c.path = [];
}

const bleeds = (c: Colonist) => c.wounds.some((k) => k.bleeding);

function runTicks(w: W, n: number, until: () => boolean): void {
  for (let i = 0; i < n && !until(); i++) w.step();
}

describe('prioridad médica tras los combates', () => {
  it('un colono que no es médico cura al herido cuando no quedan saqueadores en pie', () => {
    const w = flatWorld(2);
    const [helper, patient] = w.colonists;
    helper.priorities.curar = 0;
    patient.priorities.curar = 0;
    place(patient, 14, 12);
    hurt(patient, 0.3, 'el brazo izquierdo');
    expect(bleeds(patient)).toBe(true);
    expect(w.fightOver()).toBe(true);
    runTicks(w, 3000, () => !bleeds(patient));
    expect(bleeds(patient)).toBe(false);
    // Le ha curado el otro: no se ha curado él mismo.
    expect(patient.wounds[0].self).toBeUndefined();
    expect(w.log.some((e) => e.text.includes('se cura él mismo'))).toBe(false);
  });

  it('mientras queda un saqueador en pie, quien no es médico no cura', () => {
    const w = flatWorld(2);
    const [helper, patient] = w.colonists;
    helper.priorities.curar = 0;
    patient.priorities.curar = 0;
    place(patient, 14, 12);
    hurt(patient, 0.3, 'el brazo izquierdo');
    raiderAt(w, 28, 28);
    expect(w.fightOver()).toBe(false);
    runTicks(w, 300, () => helper.job?.kind === 'curar');
    expect(helper.job?.kind).not.toBe('curar');
    // Cuando el saqueador cae, va a curarle.
    w.others[0].downed = true;
    expect(w.fightOver()).toBe(true);
    runTicks(w, 300, () => helper.job?.kind === 'curar');
    expect(helper.job?.pid).toBe(patient.id);
  });

  it('un saqueador que huye no cuenta como combate', () => {
    const w = flatWorld(1);
    const r = raiderAt(w, 28, 28);
    expect(w.fightOver()).toBe(false);
    r.raider!.fleeing = true;
    expect(w.fightOver()).toBe(true);
  });

  it('deja lo que está haciendo para ir a curar', () => {
    const w = flatWorld(2);
    const [helper, patient] = w.colonists;
    patient.priorities.curar = 0;
    place(patient, 20, 20);
    w.items.drop(8, 8, 'madera', 30);
    w.structures.place(12, 5, 'muro_madera');
    runTicks(w, 400, () => !!helper.job && helper.job.kind !== 'curar');
    expect(helper.job).toBeTruthy();
    expect(helper.job!.kind).not.toBe('curar');
    hurt(patient, 0.3, 'la pierna derecha');
    runTicks(w, 120, () => helper.job?.kind === 'curar');
    expect(helper.job?.kind).toBe('curar');
    expect(helper.job?.pid).toBe(patient.id);
    expect(w.log.some((e) => e.text.includes('deja lo que hace para atender'))).toBe(true);
  });

  it('primero el colono herido, aunque haya un saqueador caído más cerca', () => {
    const w = flatWorld(2);
    const [doc, patient] = w.colonists;
    doc.priorities.curar = 3;
    patient.priorities.curar = 0;
    place(doc, 5, 5);
    place(patient, 20, 20);
    const r = raiderAt(w, 6, 6);
    hurt(r, 0.95, 'el pecho', true);
    hurt(patient, 0.3, 'el brazo derecho');
    expect(bleeds(r)).toBe(true);
    runTicks(w, 120, () => doc.job?.kind === 'curar');
    expect(doc.job?.pid).toBe(patient.id);
  });

  it('un reclutado no deja su puesto para curar (el herido se cura él mismo)', () => {
    const w = flatWorld(2);
    const [helper, patient] = w.colonists;
    helper.drafted = true;
    place(patient, 14, 12);
    hurt(patient, 0.3, 'el brazo izquierdo');
    runTicks(w, 300, () => false);
    expect(helper.job).toBeNull();
    expect(bleeds(patient)).toBe(false);
    expect(patient.wounds[0].self).toBe(true);
  });
});

function buildNow(w: W, x: number, y: number, id: string) {
  w.structures.place(x, y, id);
  const s = w.structures.at(x, y)!;
  for (const [r, n] of Object.entries(s.def.cost)) w.structures.deliver(s, r as never, n as number);
  w.completeStructure(s);
  return s;
}

/** Deja a un colono en el suelo con una herida que sangra (sin que se desangre durante el test). */
function knockDown(c: Colonist): void {
  hurt(c, 0.3, 'el pecho');
  c.health = 0.1;
  c.downed = true;
}

describe('prioridad médica tras los combates: llevar al herido a una cama', () => {
  it('tras curarle, lleva al colono caído a la cama libre más cercana', () => {
    const w = flatWorld(2);
    const [helper, patient] = w.colonists;
    w.needsEnabled = false;
    patient.priorities.curar = 0;
    place(helper, 10, 10);
    place(patient, 14, 12);
    buildNow(w, 20, 18, 'cama');
    knockDown(patient);
    runTicks(w, 6000, () => patient.tile.x === 20 && patient.tile.y === 18 && patient.carriedBy === undefined);
    expect(bleeds(patient)).toBe(false);
    expect(patient.tile).toEqual({ x: 20, y: 18 });
    expect(patient.carriedBy).toBeUndefined();
    w.step();
    expect(patient.activity).toBe('sleeping');
    expect(helper.job?.pid).not.toBe(patient.id);
    expect(w.log.some((e) => e.text.includes('en una cama para que se recupere'))).toBe(true);
  });

  it('también lleva a la cama a un caído que ya no sangra, aunque quien vaya no sea médico', () => {
    const w = flatWorld(2);
    const [helper, patient] = w.colonists;
    w.needsEnabled = false;
    helper.priorities.curar = 0;
    patient.priorities.curar = 0;
    place(patient, 14, 12);
    buildNow(w, 6, 6, 'cama');
    patient.health = 0.1;
    patient.downed = true;
    expect(w.wantsCarryToBed(patient)).toBe(true);
    runTicks(w, 6000, () => patient.tile.x === 6 && patient.tile.y === 6 && patient.carriedBy === undefined);
    expect(patient.tile).toEqual({ x: 6, y: 6 });
    expect(w.wantsCarryToBed(patient)).toBe(false);
  });

  it('sin cama libre, se queda curado en el suelo', () => {
    const w = flatWorld(2);
    const [, patient] = w.colonists;
    w.needsEnabled = false;
    patient.priorities.curar = 0;
    place(patient, 14, 12);
    knockDown(patient);
    expect(w.wantsCarryToBed(patient)).toBe(false);
    runTicks(w, 3000, () => !bleeds(patient));
    expect(bleeds(patient)).toBe(false);
    for (let i = 0; i < 60; i++) w.step();
    expect(patient.tile).toEqual({ x: 14, y: 12 });
    expect(patient.carriedBy).toBeUndefined();
  });

  it('mientras queda un saqueador en pie, no se le lleva a la cama', () => {
    const w = flatWorld(2);
    const [, patient] = w.colonists;
    w.needsEnabled = false;
    place(patient, 14, 12);
    buildNow(w, 6, 6, 'cama');
    patient.health = 0.1;
    patient.downed = true;
    raiderAt(w, 28, 28);
    expect(w.wantsCarryToBed(patient)).toBe(false);
  });

  it('quien va a dormir no se mete en la cama donde está tumbado un herido', () => {
    const w = flatWorld(2, { needs: true });
    const [sleeper, patient] = w.colonists;
    buildNow(w, 6, 6, 'cama');
    place(patient, 6, 6);
    patient.health = 0.1;
    patient.downed = true;
    w.step();
    expect(patient.activity).toBe('sleeping');
    expect(w.wantsCarryToBed(patient)).toBe(false);
    sleeper.needs.rest = 0.05;
    runTicks(w, 200, () => sleeper.need?.type === 'dormir');
    expect(sleeper.need?.type).toBe('dormir');
    expect(sleeper.need?.bed).toBe(false);
  });
});
