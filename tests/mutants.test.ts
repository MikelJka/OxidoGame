// Mutantes (bloque 2 del catálogo, primera parte): perros mutantes en manada.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { CREATURES, PACKS } from '../src/data/creatures';
import { groupSummary, walkSpeedMultiplier } from '../src/sim/colonist';
import type { Colonist } from '../src/sim/colonist';
import { attack, checkRaidMorale, makeCreature, nearRadiation, packOdds, runStoryteller, startPack, startRaid, updateOthers } from '../src/sim/people';
import { hurt } from '../src/sim/health';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/time';

type W = ReturnType<typeof flatWorld>;

/** Golpes previsibles: siempre aciertan y con el daño medio. */
function fixedRng(w: W): void {
  w.rng.chance = () => true;
  w.rng.next = () => 0.5;
  w.rng.int = (a: number) => a;
}

function pawnAt(w: W, x: number, y: number, dog: boolean): Colonist {
  const c = w.makePawn('saqueador');
  if (dog) makeCreature(w, c, 'perro_mutante', 1);
  else c.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
  c.tile = { x, y };
  c.pos = { x: x + 0.5, y: y + 0.5 };
  c.traits = [];
  c.vest = null;
  c.helmet = null;
  c.weapon = null;
  c.skills.combate = 5;
  w.others.push(c);
  return c;
}

describe('perros mutantes', () => {
  it('una manada llega junta, sin armas ni líder', () => {
    const w = flatWorld(1);
    const pack = startPack(w, 5);
    expect(pack).toHaveLength(5);
    for (const d of pack) {
      expect(d.creature).toBe('perro_mutante');
      expect(d.role).toBe('saqueador');
      expect(d.weapon).toBeNull();
      expect(d.vest).toBeNull();
      expect(d.traits).toHaveLength(0);
      expect(d.raider?.leader).toBeFalsy();
      expect(d.name).toMatch(/^Perro mutante \d$/);
    }
    const g = w.raidGroups.find((k) => k.id === pack[0].raider!.group)!;
    expect(g.leaderId).toBe(-1);
    expect(g.size).toBe(5);
    expect(w.log.some((l) => l.text.includes('manada de 5 perros mutantes'))).toBe(true);
    expect(groupSummary(pack)).toContain('5 perros mutantes');
  });

  it('andan ×1,5 respecto a un colono', () => {
    const w = flatWorld(1);
    const [d] = startPack(w, 1);
    expect(walkSpeedMultiplier(d)).toBeCloseTo(CREATURES.perro_mutante.walkSpeed);
    expect(CREATURES.perro_mutante.walkSpeed).toBe(1.5);
  });

  it('tienen el 60 % de la vida: el mismo golpe les quita 1/0,6 veces más', () => {
    const w = flatWorld(1);
    fixedRng(w);
    const c = w.colonists[0];
    c.traits = [];
    c.weapon = null;
    const man = pawnAt(w, 6, 5, false);
    const dog = pawnAt(w, 4, 5, true);
    attack(w, c, man);
    c.attackCooldown = 0;
    attack(w, c, dog);
    expect(1 - dog.health).toBeCloseTo((1 - man.health) / 0.6, 5);
  });

  it('su mordisco hace ×1,2 el daño de unos puños', () => {
    const w = flatWorld(2);
    fixedRng(w);
    const [a, b] = w.colonists;
    for (const k of [a, b]) {
      k.traits = [];
      k.vest = null;
      k.helmet = null;
    }
    const man = pawnAt(w, 20, 20, false);
    const dog = pawnAt(w, 22, 22, true);
    attack(w, man, a);
    attack(w, dog, b);
    expect(1 - b.health).toBeCloseTo((1 - a.health) * 1.2, 5);
  });

  it('al caer mueren (no se capturan) y lo dice el diario', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    const dog = pawnAt(w, 6, 5, true);
    c.skills.combate = 20;
    for (let i = 0; i < 200 && w.others.includes(dog); i++) {
      c.attackCooldown = 0;
      attack(w, c, dog);
    }
    expect(w.others.includes(dog)).toBe(false);
    expect(w.log.some((l) => l.text === 'Perro mutante 1 cae muerto.')).toBe(true);
  });

  it('huyen al caer la mitad de la manada (no hay líder)', () => {
    const w = flatWorld(1);
    const pack = startPack(w, 4);
    hurt(pack[0], 0.95, 'el pecho');
    w.killPawn(pack[0], 'abatido', true);
    checkRaidMorale(w);
    expect(pack.slice(1).some((d) => d.raider!.fleeing)).toBe(false);
    w.killPawn(pack[1], 'abatido', true);
    checkRaidMorale(w);
    expect(pack[2].raider!.fleeing).toBe(true);
    expect(pack[3].raider!.fleeing).toBe(true);
    expect(w.log.some((l) => l.text.includes('mitad de la manada'))).toBe(true);
  });

  it('no saquean: si no queda nadie en pie, se marchan', () => {
    const w = flatWorld(1);
    w.items.drop(10, 10, 'madera', 20);
    const dog = pawnAt(w, 12, 12, true);
    w.colonists[0].downed = true;
    updateOthers(w);
    expect(dog.raider!.fleeing).toBe(true);
    expect(dog.carrying).toBeFalsy();
  });

  it('desde el día 8, 1 de cada 3 raids es una manada; antes, ninguno', () => {
    const count = (day: number) => {
      const w = flatWorld(3);
      w.map.radiation.fill(0);
      w.tick = (day - 1) * TICKS_PER_DAY;
      let packs = 0;
      for (let i = 0; i < 150; i++) {
        w.others.length = 0;
        w.raidGroups.length = 0;
        w.schedule.nextRaid = w.tick;
        w.schedule.nextWanderer = w.schedule.nextTrader = w.tick + 10 * TICKS_PER_DAY;
        runStoryteller(w);
        if (w.others.some((o) => o.creature)) packs++;
      }
      return packs / 150;
    };
    expect(count(7)).toBe(0);
    const f = count(9);
    expect(f).toBeGreaterThan(0.2);
    expect(f).toBeLessThan(0.47);
  });

  it('cerca de una zona irradiada llegan más a menudo (1 de cada 2)', () => {
    const w = flatWorld(1);
    w.map.radiation.fill(0);
    expect(nearRadiation(w)).toBe(false);
    expect(packOdds(w)).toBe(PACKS.every);
    const home = w.colonyPoint()!;
    const x = Math.min(w.map.width - 1, home.x + 10);
    w.map.radiation[home.y * w.map.width + x] = 1;
    expect(nearRadiation(w)).toBe(true);
    expect(packOdds(w)).toBe(PACKS.everyNearRadiation);
  });

  it('una manada tiene entre 3 y 8 perros en Normal', () => {
    const w = flatWorld(1);
    w.tick = 9 * TICKS_PER_DAY;
    for (let i = 0; i < 60; i++) {
      w.others.length = 0;
      w.schedule.nextRaid = w.tick;
      w.schedule.nextWanderer = w.schedule.nextTrader = w.tick + 10 * TICKS_PER_DAY;
      runStoryteller(w);
      const n = w.others.filter((o) => o.creature).length;
      if (n) {
        expect(n).toBeGreaterThanOrEqual(3);
        expect(n).toBeLessThanOrEqual(8);
      }
    }
  });

  it('los raids de saqueadores siguen igual', () => {
    const w = flatWorld(1);
    const raid = startRaid(w, 3);
    expect(raid.every((r) => !r.creature)).toBe(true);
    expect(raid.some((r) => r.raider?.leader)).toBe(true);
  });

  it('se guardan y se cargan', () => {
    const w = flatWorld(1);
    const pack = startPack(w, 3);
    const back = loadWorld(serializeWorld(w));
    const dogs = back.others.filter((o) => o.creature === 'perro_mutante');
    expect(dogs).toHaveLength(3);
    expect(back.raidGroups.find((g) => g.id === pack[0].raider!.group)!.leaderId).toBe(-1);
    expect(walkSpeedMultiplier(dogs[0])).toBeCloseTo(1.5);
  });
});
