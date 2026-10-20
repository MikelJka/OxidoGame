// «Medicina avanzada» (bloque 13): las heridas se curan un 25 % antes y la infección sale la mitad de veces.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { hurt, tickHealth, tickInfection, treatWounds } from '../src/sim/health';
import { infectionChanceFactor, woundHealTimeFactor } from '../src/sim/research';
import { TICKS_PER_DAY } from '../src/sim/world';
import { Rng } from '../src/sim/rng';
import type { Colonist } from '../src/sim/colonist';

function fixedRng(v: number): Rng {
  const r = new Rng(1);
  r.next = () => v;
  return r;
}

/** Ticks (de segundo en segundo) hasta que se cierran todas sus heridas, comido y bebido. */
function ticksToHeal(c: Colonist, healTime: number): number {
  let t = 0;
  while (c.wounds.length > 0 && t < TICKS_PER_DAY * 30) {
    c.needs.food = 1;
    c.needs.water = 1;
    tickHealth(c, 10, TICKS_PER_DAY, false, healTime);
    t += 10;
  }
  return t;
}

describe('Medicina avanzada', () => {
  it('sin investigar no cambia nada; con ella, heridas ×0,75 de tiempo e infección ×0,5', () => {
    const w = flatWorld(1);
    expect(woundHealTimeFactor(w.research)).toBe(1);
    expect(infectionChanceFactor(w.research)).toBe(1);
    w.research.done.push('medicina_campo', 'medicina_avanzada');
    expect(woundHealTimeFactor(w.research)).toBe(0.75);
    expect(infectionChanceFactor(w.research)).toBe(0.5);
  });

  it('una herida tarda un 25 % menos en cerrarse', () => {
    const a = flatWorld(1).colonists[0];
    const b = flatWorld(1).colonists[0];
    for (const c of [a, b]) {
      hurt(c, 0.3, 'el brazo izquierdo');
      treatWounds(c);
      c.health = 0.5;
    }
    const normal = ticksToHeal(a, 1);
    const fast = ticksToHeal(b, 0.75);
    expect(fast / normal).toBeCloseTo(0.75, 1);
  });

  it('la infección sale la mitad de veces: 20 % sin curar pasa a 10 %', () => {
    const roll = (v: number, factor: number) => {
      const c = flatWorld(1).colonists[0];
      hurt(c, 0.3, 'la pierna derecha');
      tickInfection(c, TICKS_PER_DAY / 2, TICKS_PER_DAY, fixedRng(v), factor);
      return !!c.infection;
    };
    expect(roll(0.15, 1)).toBe(true);
    expect(roll(0.15, 0.5)).toBe(false);
    expect(roll(0.09, 0.5)).toBe(true);
  });

  it('el mundo lo aplica a sus colonos al pasar el tiempo', () => {
    const run = (researched: boolean) => {
      const w = flatWorld(1);
      if (researched) w.research.done.push('medicina_campo', 'medicina_avanzada');
      const c = w.colonists[0];
      hurt(c, 0.2, 'el brazo izquierdo');
      treatWounds(c);
      const before = c.wounds[0].severity;
      for (let i = 0; i < 600; i++) {
        c.needs.food = 1;
        c.needs.water = 1;
        w.step();
      }
      return before - (c.wounds[0]?.severity ?? 0);
    };
    const normal = run(false);
    const fast = run(true);
    expect(normal).toBeGreaterThan(0);
    expect(fast / normal).toBeCloseTo(1 / 0.75, 1);
  });
});
