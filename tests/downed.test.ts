// #22: a los saqueadores se les derriba, no se les mata; en el suelo se elige capturar o rematar.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { attack } from '../src/sim/people';
import { hurt, SPARED_HEALTH } from '../src/sim/health';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/world';
import type { Colonist } from '../src/sim/colonist';
import { moodOf } from '../src/sim/needs';
import { TICKS_PER_HOUR } from '../src/sim/world';

function raiderAt(w: ReturnType<typeof flatWorld>, x: number, y: number): Colonist {
  const r = w.makePawn('saqueador');
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
  w.others.push(r);
  return r;
}

function prisonBed(w: ReturnType<typeof flatWorld>, x: number, y: number): void {
  w.structures.place(x, y, 'cama_prision');
  w.completeStructure(w.structures.at(x, y)!);
}

function runTicks(w: ReturnType<typeof flatWorld>, n: number, until: () => boolean): void {
  for (let i = 0; i < n && !until(); i++) w.step();
}

describe('derribar en vez de matar (#22)', () => {
  it('un golpe que mataría solo deja en el suelo (si se pide perdonar)', () => {
    const w = flatWorld(1);
    const r = raiderAt(w, 9, 5);
    hurt(r, 5, 'el pecho', true);
    expect(r.health).toBeCloseTo(SPARED_HEALTH);
    expect(r.downed).toBe(true);
    // Ya por debajo del mínimo, otro golpe no lo baja más.
    r.health = 0.02;
    hurt(r, 1, 'la cabeza', true);
    expect(r.health).toBeCloseTo(0.02);
  });

  it('los colonos dejan a los saqueadores en el suelo, sin matarlos', () => {
    const w = flatWorld(1);
    const a = w.colonists[0];
    a.skills.combate = 20;
    const b = raiderAt(w, 6, 5);
    b.health = 0.16;
    for (let i = 0; i < 30; i++) attack(w, a, b);
    expect(b.downed).toBe(true);
    expect(b.health).toBeGreaterThan(0);
    expect(w.others).toContain(b);
  });

  it('a los colonos un golpe sí puede matarlos (no cambia)', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    hurt(c, 5, 'el pecho');
    expect(c.health).toBe(0);
  });

  it('con «rematar», el carcelero acaba con él en vez de capturarlo', () => {
    const w = flatWorld(1);
    const r = raiderAt(w, 9, 5);
    hurt(r, 0.95, 'la pierna izquierda', true);
    expect(w.setDownedFate(r.id, 'rematar')).toBe(true);
    runTicks(w, 2000, () => !w.others.includes(r));
    expect(w.others).not.toContain(r);
    expect(w.log.some((l) => l.text.includes('rematado'))).toBe(true);
  });

  it('se puede volver a «capturar» y entonces se lo lleva preso', () => {
    const w = flatWorld(1);
    const r = raiderAt(w, 9, 5);
    hurt(r, 0.95, 'la pierna izquierda', true);
    prisonBed(w, 12, 10);
    w.setDownedFate(r.id, 'rematar');
    expect(w.setDownedFate(r.id, 'capturar')).toBe(true);
    expect(r.raider?.finish).toBeUndefined();
    runTicks(w, 2000, () => r.role === 'prisionero');
    expect(r.role).toBe('prisionero');
  });

  it('solo vale con saqueadores en el suelo', () => {
    const w = flatWorld(1);
    const r = raiderAt(w, 9, 5);
    expect(w.setDownedFate(r.id, 'rematar')).toBe(false);
    expect(w.setDownedFate(w.colonists[0].id, 'rematar')).toBe(false);
  });

  it('la orden de rematar se guarda con la partida', () => {
    const w = flatWorld(1);
    const r = raiderAt(w, 9, 5);
    hurt(r, 0.95, 'la cabeza', true);
    w.setDownedFate(r.id, 'rematar');
    const w2 = loadWorld(serializeWorld(w));
    expect(w2.others.find((o) => o.id === r.id)?.raider?.finish).toBe(true);
  });
});

describe('cama para capturar, curar en el suelo y rematar pesa (#22, segunda parte)', () => {
  it('sin cama de prisionero libre no se captura: sigue en el suelo', () => {
    const w = flatWorld(1);
    const r = raiderAt(w, 9, 5);
    hurt(r, 0.95, 'la pierna izquierda', true);
    r.wounds.forEach((k) => (k.bleeding = false));
    expect(w.prisonBedsFree()).toBe(0);
    runTicks(w, 2000, () => r.role === 'prisionero');
    expect(r.role).toBe('saqueador');
    expect(r.downed).toBe(true);
    // En cuanto hay una cama, el carcelero lo captura y lo lleva a ella.
    prisonBed(w, 12, 10);
    expect(w.prisonBedsFree()).toBe(1);
    runTicks(w, 4000, () => r.role === 'prisionero' && r.carriedBy === undefined);
    expect(r.role).toBe('prisionero');
    expect(r.tile).toEqual({ x: 12, y: 10 });
    expect(w.prisonBedsFree()).toBe(0);
  });

  it('con una cama y dos caídos, solo se captura a uno', () => {
    const w = flatWorld(2);
    prisonBed(w, 12, 10);
    const a = raiderAt(w, 9, 5);
    const b = raiderAt(w, 9, 7);
    for (const r of [a, b]) {
      hurt(r, 0.95, 'el pecho', true);
      r.wounds.forEach((k) => (k.bleeding = false));
    }
    runTicks(w, 5000, () => false);
    expect([a, b].filter((r) => r.role === 'prisionero').length).toBe(1);
    expect([a, b].filter((r) => r.role === 'saqueador' && r.downed).length).toBe(1);
  });

  it('el médico cura en el suelo al saqueador que se desangra, sin gastar 💊', () => {
    const w = flatWorld(1);
    const r = raiderAt(w, 9, 5);
    hurt(r, 0.95, 'el brazo derecho', true);
    w.items.drop(3, 3, 'medicina', 2);
    expect(r.wounds.some((k) => k.bleeding)).toBe(true);
    runTicks(w, 2000, () => !r.wounds.some((k) => k.bleeding));
    expect(r.wounds.some((k) => k.bleeding)).toBe(false);
    expect(w.others).toContain(r);
    expect(r.tile).toEqual({ x: 9, y: 5 });
    expect(w.items.at(3, 3)?.amount).toBe(2);
  });

  it('curado, el saqueador caído no se levanta', () => {
    const w = flatWorld(1);
    const r = raiderAt(w, 9, 5);
    hurt(r, 0.95, 'el brazo derecho', true);
    r.wounds.forEach((k) => (k.bleeding = false));
    r.health = 0.9;
    w.colonists[0].priorities.carcelero = 0;
    runTicks(w, 200, () => false);
    expect(r.downed).toBe(true);
  });

  it('rematar baja el ánimo a quien remata y a quien lo ve, salvo a los duros', () => {
    const w = flatWorld(3);
    const [killer, witness, tough] = w.colonists;
    for (const k of w.colonists) k.traits = [];
    tough.traits = [{ id: 'duro', name: 'Duro', description: '' }];
    witness.priorities.carcelero = 0;
    tough.priorities.carcelero = 0;
    const r = raiderAt(w, 9, 5);
    hurt(r, 0.95, 'la cabeza', true);
    w.setDownedFate(r.id, 'rematar');
    runTicks(w, 2000, () => !w.others.includes(r));
    expect(w.others).not.toContain(r);
    const val = (k: Colonist, text: string) => moodOf(k, w.tick).reasons.find((m) => m.text === text)?.value;
    expect(val(killer, 'Remató a un saqueador')).toBeCloseTo(-0.05);
    expect(val(witness, 'Vio rematar a un saqueador')).toBeCloseTo(-0.03);
    expect(val(tough, 'Vio rematar a un saqueador')).toBeUndefined();
    expect(val(tough, 'Remató a un saqueador')).toBeUndefined();
    // Se guarda con la partida y se pasa al día siguiente.
    const w2 = loadWorld(serializeWorld(w));
    const k2 = w2.colonists.find((k) => k.id === killer.id)!;
    expect(moodOf(k2, w2.tick).reasons.some((m) => m.text === 'Remató a un saqueador')).toBe(true);
    expect(moodOf(k2, w2.tick + 25 * TICKS_PER_HOUR).reasons.some((m) => m.text === 'Remató a un saqueador')).toBe(false);
  });
});
