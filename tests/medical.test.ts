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

  it('un reclutado no deja su puesto para curar', () => {
    const w = flatWorld(2);
    const [helper, patient] = w.colonists;
    helper.drafted = true;
    place(patient, 14, 12);
    hurt(patient, 0.3, 'el brazo izquierdo');
    runTicks(w, 300, () => false);
    expect(helper.job).toBeNull();
    expect(bleeds(patient)).toBe(true);
  });
});
