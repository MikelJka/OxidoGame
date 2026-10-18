import { describe, expect, it, vi } from 'vitest';
import { flatWorld } from './helpers';
import { findRefuge, maybePanic, panicChance, PANIC_TICKS, witnessFall } from '../src/sim/panic';
import { attack } from '../src/sim/people';
import { hurt } from '../src/sim/health';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/world';
import { TRAITS } from '../src/data/colonists';
import type { Colonist } from '../src/sim/colonist';

type W = ReturnType<typeof flatWorld>;

function buildNow(w: W, x: number, y: number, id: string) {
  expect(w.structures.place(x, y, id)).toBe(true);
  const s = w.structures.at(x, y)!;
  w.completeStructure(s);
  return s;
}

/** Ánimo casi por los suelos (0). */
function sink(c: Colonist): void {
  c.traits = [];
  c.needs.water = 0;
  c.needs.food = 0;
}

const trait = (id: string) => TRAITS.find((t) => t.id === id)!;

describe('pánico de los colonos', () => {
  it('herido y con el ánimo < 15 %: 20 %; con buen ánimo o sin heridas, nunca', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.traits = [];
    hurt(c, 0.05, 'el brazo izquierdo');
    expect(panicChance(c, 'herido', w.tick)).toBe(0); // ánimo normal
    sink(c);
    expect(panicChance(c, 'herido', w.tick)).toBeCloseTo(0.2);
    c.wounds = [];
    expect(panicChance(c, 'herido', w.tick)).toBe(0);
  });

  it('ver caer a un compañero asusta con cualquier ánimo; «duro» nunca y «pesimista» el doble', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.traits = [];
    expect(panicChance(c, 'compañero', w.tick)).toBeCloseTo(0.2);
    c.traits = [trait('duro')];
    expect(panicChance(c, 'compañero', w.tick)).toBe(0);
    c.traits = [trait('pesimista')];
    expect(panicChance(c, 'compañero', w.tick)).toBeCloseTo(0.4);
  });

  it('un reclutado solo entra en pánico con el ánimo < 5 %', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.traits = [];
    c.drafted = true;
    hurt(c, 0.05, 'el pecho');
    // Ánimo alrededor del 7 %: deshidratado, cansado y durmió en el suelo.
    c.needs.water = 0;
    c.needs.rest = 0.2;
    c.needs.sleptIn = 'suelo';
    expect(panicChance(c, 'compañero', w.tick)).toBe(0);
    expect(panicChance(c, 'herido', w.tick)).toBe(0);
    sink(c);
    expect(panicChance(c, 'compañero', w.tick)).toBeCloseTo(0.2);
    expect(panicChance(c, 'herido', w.tick)).toBeCloseTo(0.2);
  });

  it('al ver caer a un compañero cerca, suelta lo que hace, corre a la cama, no obedece y se calma a la hora', () => {
    const w = flatWorld(3);
    const [fallen, near, far] = w.colonists;
    near.traits = [];
    far.traits = [];
    far.tile = { x: 20, y: 5 };
    far.pos = { x: 20.5, y: 5.5 };
    buildNow(w, 5, 15, 'cama');
    vi.spyOn(w.rng, 'chance').mockReturnValue(true);
    witnessFall(w, fallen);
    vi.restoreAllMocks();
    expect(near.panic).toBeDefined();
    expect(far.panic).toBeUndefined(); // a más de 5 casillas no lo ve
    expect(fallen.panic).toBeUndefined();
    expect(w.log.some((l) => l.text.includes('pánico'))).toBe(true);
    expect(w.orderMove(near.id, { x: 10, y: 10 })).toBe(false);
    for (let i = 0; i < PANIC_TICKS / 2; i++) w.step();
    expect(near.panic).toBeDefined();
    expect(near.tile).toEqual({ x: 5, y: 15 });
    for (let i = 0; i < PANIC_TICKS; i++) w.step();
    expect(near.panic).toBeUndefined();
    expect(w.orderMove(near.id, { x: 10, y: 10 })).toBe(true);
  });

  it('sin camas busca la habitación más cercana', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    for (let y = 10; y <= 14; y++) for (let x = 10; x <= 14; x++) {
      if (x === 10 || x === 14 || y === 10 || y === 14) buildNow(w, x, y, x === 12 && y === 10 ? 'puerta_madera' : 'muro_piedra');
    }
    const r = findRefuge(w, c)!;
    expect(r.bed).toBe(false);
    const end = r.path[r.path.length - 1];
    expect(w.rooms.at(end.x, end.y)).not.toBeNull();
  });

  it('un golpe a un colono hundido y herido puede meterlo en pánico', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    sink(c);
    const r = w.makePawn('saqueador');
    r.tile = { x: 6, y: 5 };
    r.pos = { x: 6.5, y: 5.5 };
    r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
    r.weapon = null;
    w.others.push(r);
    vi.spyOn(w.rng, 'chance').mockReturnValue(true);
    vi.spyOn(w.rng, 'next').mockReturnValue(0); // golpe flojo: no lo tumba
    attack(w, r, c);
    vi.restoreAllMocks();
    expect(c.downed).toBe(false);
    expect(c.panic).toBeDefined();
  });

  it('el pánico se guarda con la partida; las antiguas cargan sin pánico', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.traits = [];
    vi.spyOn(w.rng, 'chance').mockReturnValue(true);
    expect(maybePanic(w, c, 'compañero')).toBe(true);
    vi.restoreAllMocks();
    const data = JSON.parse(JSON.stringify(serializeWorld(w)));
    const back = loadWorld(data);
    expect(back.colonists[0].panic?.until).toBe(c.panic!.until);
    delete data.colonists[0].panic;
    expect(loadWorld(data).colonists[0].panic).toBeUndefined();
  });
});
