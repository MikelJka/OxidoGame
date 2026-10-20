// Máquinas (bloque 6 del catálogo, primera parte): la araña de chatarra y los ataques de máquinas.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { CREATURES, isMachine, MACHINES } from '../src/data/creatures';
import { walkSpeedMultiplier } from '../src/sim/colonist';
import type { Colonist } from '../src/sim/colonist';
import { attack, checkRaidMorale, hurtFoe, makeCreature, startMachines, updateOthers } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';

type W = ReturnType<typeof flatWorld>;

function spiderAt(w: W, x: number, y: number): Colonist {
  const c = w.makePawn('saqueador');
  makeCreature(w, c, 'arana_chatarra', 1);
  c.tile = { x, y };
  c.pos = { x: x + 0.5, y: y + 0.5 };
  w.others.push(c);
  return c;
}

describe('araña de chatarra', () => {
  it('tiene los números del catálogo', () => {
    const d = CREATURES.arana_chatarra;
    expect(d.fromDay).toBe(30);
    expect(d.health).toBe(4);
    expect(d.damage).toBe(3);
    expect(d.armor).toBe(0.4);
    expect(d.breaksWalls).toBe(true);
    expect(isMachine('arana_chatarra')).toBe(true);
    expect(isMachine('bruto_mutante')).toBe(false);
    expect(MACHINES.every).toBe(4);
    expect(MACHINES.firearmBonus).toBe(0.25);
    const w = flatWorld(1);
    const s = spiderAt(w, 3, 3);
    expect(s.name).toBe('Araña de chatarra 1');
    expect(walkSpeedMultiplier(s)).toBeCloseTo(d.walkSpeed);
  });

  it('su blindaje le quita un 40 % del daño, sobre el cuádruple de vida', () => {
    const w = flatWorld(1);
    const s = spiderAt(w, 3, 3);
    hurtFoe(w, s, 0.1, 'el torso');
    // 0,1 × 0,6 / 4 = 0,015 de su vida.
    expect(1 - s.health).toBeCloseTo(0.015, 3);
  });

  it('al destruirla suelta chatarra y componentes y no deja cadáver', () => {
    const w = flatWorld(1);
    const s = spiderAt(w, 5, 5);
    w.killPawn(s, 'abatida');
    expect(w.others).not.toContain(s);
    expect(w.corpses).toHaveLength(0);
    const at = w.items.list().filter((i) => Math.abs(i.x - 5) <= 1 && Math.abs(i.y - 5) <= 1);
    const scrap = at.filter((i) => i.resource === 'chatarra').reduce((a, i) => a + i.amount, 0);
    const parts = at.filter((i) => i.resource === 'componentes').reduce((a, i) => a + i.amount, 0);
    expect(scrap).toBeGreaterThanOrEqual(10);
    expect(scrap).toBeLessThanOrEqual(20);
    expect(parts).toBeGreaterThanOrEqual(2);
    expect(parts).toBeLessThanOrEqual(4);
  });

  it('el ataque de máquinas trae sus arañas y no huye aunque caiga la mitad', () => {
    const w = flatWorld(1);
    const spiders = startMachines(w, 2);
    expect(spiders).toHaveLength(2);
    expect(spiders.every((s) => s.creature === 'arana_chatarra')).toBe(true);
    expect(w.log.some((l) => l.text.includes('Ataque de máquinas: 2 arañas de chatarra'))).toBe(true);
    w.killPawn(spiders[0], 'abatida', true);
    checkRaidMorale(w);
    expect(spiders[1].raider!.fleeing).toBe(false);
    // Muy dañada tampoco se retira.
    spiders[1].health = 0.2;
    updateOthers(w);
    expect(spiders[1].raider!.fleeing).toBe(false);
  });

  it('las armas de fuego le hacen un 25 % más de daño', () => {
    // Misma semilla y mismo disparo, con y sin el +25 %: la diferencia es exactamente esa.
    const hit = () => {
      const w = flatWorld(1);
      const c = w.colonists[0];
      c.tile = { x: 10, y: 10 };
      c.pos = { x: 10.5, y: 10.5 };
      c.weapon = 'rifle';
      c.ammo = 50;
      const b = spiderAt(w, 11, 10);
      for (let i = 0; i < 40 && b.health === 1; i++) attack(w, c, b);
      return 1 - b.health;
    };
    const withBonus = hit();
    const saved = MACHINES.firearmBonus;
    MACHINES.firearmBonus = 0;
    const without = hit();
    MACHINES.firearmBonus = saved;
    expect(without).toBeGreaterThan(0);
    expect(withBonus / without).toBeCloseTo(1.25, 5);
  });

  it('se guarda y se carga', () => {
    const w = flatWorld(1);
    spiderAt(w, 4, 4);
    const w2 = loadWorld(serializeWorld(w));
    expect(w2.others.find((o) => o.creature === 'arana_chatarra')?.name).toBe('Araña de chatarra 1');
  });
});
