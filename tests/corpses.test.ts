// Mutantes (bloque 2 del catálogo, tercera parte): los cadáveres se pudren y pesan a quien los ve.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { CORPSES } from '../src/data/creatures';
import type { Colonist } from '../src/sim/colonist';
import { rotOf, updateCorpses } from '../src/sim/corpses';
import { moodOf } from '../src/sim/needs';
import { makeCreature } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_HOUR, TICKS_PER_SECOND } from '../src/sim/time';

type W = ReturnType<typeof flatWorld>;

function beastAt(w: W, x: number, y: number, kind: 'perro_mutante' | 'bruto_mutante' = 'perro_mutante'): Colonist {
  const c = w.makePawn('saqueador');
  makeCreature(w, c, kind, 1);
  c.tile = { x, y };
  c.pos = { x: x + 0.5, y: y + 0.5 };
  w.others.push(c);
  return c;
}

/** Avanza la partida `seconds` segundos de juego (solo lo que cuenta cada segundo). */
function seconds(w: W, n: number): void {
  for (let i = 0; i < n * TICKS_PER_SECOND; i++) w.step();
}

const sad = (c: Colonist, tick: number) => moodOf(c, tick).reasons.some((r) => r.text === 'Vio un cadáver pudriéndose');

describe('cadáveres', () => {
  it('tienen los números puestos: 5 casillas, −5 % de ánimo, 4 días en pudrirse', () => {
    expect(CORPSES.viewRadius).toBe(5);
    expect(CORPSES.moodPenalty).toBe(0.05);
    expect(CORPSES.rotDays).toBe(4);
  });

  it('un perro o un bruto que muere deja su cadáver donde cae; un saqueador no', () => {
    const w = flatWorld(1);
    const dog = beastAt(w, 20, 20);
    const brute = beastAt(w, 22, 21, 'bruto_mutante');
    w.killPawn(dog, 'heridas', true);
    w.killPawn(brute, 'heridas');
    const raider = w.makePawn('saqueador');
    raider.tile = { x: 25, y: 25 };
    w.others.push(raider);
    w.killPawn(raider, 'heridas');
    expect(w.corpses.map((c) => [c.creature, c.x, c.y])).toEqual([
      ['perro_mutante', 20, 20],
      ['bruto_mutante', 22, 21],
    ]);
    expect(w.others).toHaveLength(0);
  });

  it('quien lo ve a 5 casillas o menos pierde un 5 % de ánimo; más lejos, nada', () => {
    const w = flatWorld(2);
    const [near, far] = w.colonists;
    w.killPawn(beastAt(w, 15, 10), 'heridas');
    near.tile = { x: 10, y: 14 }; // a 5 casillas
    far.tile = { x: 21, y: 10 }; // a 6 casillas
    updateCorpses(w.corpses, w.colonists, w.tick, TICKS_PER_HOUR, TICKS_PER_DAY);
    expect(sad(near, w.tick)).toBe(true);
    expect(sad(far, w.tick)).toBe(false);
    const before = moodOf(near, w.tick).mood;
    near.needs.sawCorpseUntil = 0;
    expect(before).toBeCloseTo(moodOf(near, w.tick).mood - CORPSES.moodPenalty);
  });

  it('el mal rato dura 2 horas después de dejar de verlo', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.tile = { x: 10, y: 10 };
    w.killPawn(beastAt(w, 12, 10), 'heridas');
    seconds(w, 1);
    c.tile = { x: 25, y: 25 };
    const until = c.needs.sawCorpseUntil!;
    expect(until - w.tick).toBe(CORPSES.moodHours * TICKS_PER_HOUR);
    expect(sad(c, until - 1)).toBe(true);
    expect(sad(c, until)).toBe(false);
  });

  it('dormido o en el suelo no lo ve', () => {
    const w = flatWorld(2);
    const [sleeper, down] = w.colonists;
    sleeper.tile = { x: 10, y: 10 };
    sleeper.activity = 'sleeping';
    down.tile = { x: 11, y: 10 };
    down.downed = true;
    w.killPawn(beastAt(w, 12, 10), 'heridas');
    updateCorpses(w.corpses, w.colonists, w.tick, TICKS_PER_HOUR, TICKS_PER_DAY);
    expect(sleeper.needs.sawCorpseUntil).toBeUndefined();
    expect(down.needs.sawCorpseUntil).toBeUndefined();
  });

  it('a los 4 días se ha podrido del todo y desaparece', () => {
    const w = flatWorld(1);
    w.killPawn(beastAt(w, 20, 20), 'heridas');
    const corpse = w.corpses[0];
    expect(rotOf(corpse, w.tick, TICKS_PER_DAY)).toBe(0);
    expect(rotOf(corpse, corpse.diedAt + 2 * TICKS_PER_DAY, TICKS_PER_DAY)).toBeCloseTo(0.5);
    w.tick = corpse.diedAt + 4 * TICKS_PER_DAY - TICKS_PER_SECOND * 2;
    w.tick -= w.tick % TICKS_PER_SECOND;
    seconds(w, 1);
    expect(w.corpses).toHaveLength(1);
    seconds(w, 2);
    expect(w.corpses).toHaveLength(0);
  });

  it('se guardan en la partida; una partida vieja no tiene ninguno', () => {
    const w = flatWorld(1);
    w.killPawn(beastAt(w, 20, 20, 'bruto_mutante'), 'heridas');
    w.colonists[0].needs.sawCorpseUntil = w.tick + 100;
    const saved = serializeWorld(w);
    const back = loadWorld(saved);
    expect(back.corpses).toEqual(w.corpses);
    expect(back.nextCorpseId).toBe(2);
    expect(back.colonists[0].needs.sawCorpseUntil).toBe(w.tick + 100);
    const old = JSON.parse(JSON.stringify(saved));
    delete old.corpses;
    delete old.nextCorpseId;
    delete old.colonists[0].needs.sawCorpseUntil;
    const oldBack = loadWorld(old);
    expect(oldBack.corpses).toEqual([]);
    expect(oldBack.colonists[0].needs.sawCorpseUntil).toBeUndefined();
  });
});
