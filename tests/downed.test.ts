// #22: a los saqueadores se les derriba, no se les mata; en el suelo se elige capturar o rematar.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { attack } from '../src/sim/people';
import { hurt, SPARED_HEALTH } from '../src/sim/health';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/world';
import type { Colonist } from '../src/sim/colonist';

function raiderAt(w: ReturnType<typeof flatWorld>, x: number, y: number): Colonist {
  const r = w.makePawn('saqueador');
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
  w.others.push(r);
  return r;
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
