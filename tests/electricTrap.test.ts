import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef, BUILDINGS } from '../src/data/buildings';
import { addResearch, chooseResearch, missingResearch, unlocked, unlockedBy } from '../src/sim/research';
import { updateOthers } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_SECOND } from '../src/sim/time';
import type { World } from '../src/sim/world';
import type { Colonist } from '../src/sim/colonist';

/** Pone a andar a alguien en línea recta por la fila 10, desde x0 hasta x1. */
function route(c: Colonist, x0: number, x1: number): void {
  c.tile = { x: x0, y: 10 };
  c.pos = { x: x0 + 0.5, y: 10.5 };
  c.path = [];
  for (let x = x0 + 1; x <= x1; x++) c.path.push({ x, y: 10 });
}

function walk(w: World, c: Colonist, x0: number, x1: number): void {
  route(c, x0, x1);
  for (let i = 0; i < 2000 && c.path.length > 0; i++) w.moveAlongPath(c);
}

function trap(w: World, x: number, powered: boolean) {
  expect(w.structures.place(x, 10, 'trampa_electrica')).toBe(true);
  const s = w.structures.at(x, 10)!;
  w.completeStructure(s);
  s.powered = powered;
  return s;
}

function research(w: World, id: string): void {
  chooseResearch(w.research, id);
  addResearch(w.research, 1e9);
}

describe('trampa eléctrica', () => {
  it('cuesta 🔩6 ⚙️2, gasta 50 W y pide «Trampas» y «Baterías mejoradas»', () => {
    const d = buildingDef('trampa_electrica');
    expect(d.category).toBe('defensa');
    expect(d.cost).toEqual({ chatarra: 6, componentes: 2 });
    expect(d.power).toBe(-50);
    expect(d.stunSeconds).toBe(5);
    expect(d.blocks).toBe(false);

    const w = flatWorld(0);
    expect(missingResearch(w.research, d)?.id).toBe('trampas');
    research(w, 'trampas');
    expect(unlocked(w.research, d)).toBe(false);
    expect(missingResearch(w.research, d)?.id).toBe('baterias');
    expect(w.canBuild('trampa_electrica')).toBe(false);
    research(w, 'baterias');
    expect(unlockedBy(BUILDINGS, 'baterias', w.research).map((b) => b.id)).toContain('trampa_electrica');
    expect(w.canBuild('trampa_electrica')).toBe(true);
  });

  it('con corriente aturde 5 s al saqueador que la pisa y no se gasta', () => {
    const w = flatWorld(1);
    trap(w, 10, true);
    const r = w.makePawn('saqueador');
    w.others.push(r);
    walk(w, r, 5, 15);
    expect(r.tile).toEqual({ x: 10, y: 10 });
    expect(r.path).toEqual([]);
    expect(r.stunnedUntil).toBe(w.tick + 5 * TICKS_PER_SECOND);
    expect(r.health).toBe(1);
    expect(w.structures.mainAt(10, 10)?.def.id).toBe('trampa_electrica');
    expect(w.log.some((l) => l.text.includes('aturdido'))).toBe(true);

    // Mientras dura, no se mueve aunque tenga camino; se guarda con la partida.
    expect(loadWorld(serializeWorld(w)).others[0].stunnedUntil).toBe(r.stunnedUntil);
    r.path = [{ x: 11, y: 10 }];
    for (let i = 0; i < 4 * TICKS_PER_SECOND; i++) {
      w.tick++;
      updateOthers(w);
    }
    expect(r.tile).toEqual({ x: 10, y: 10 });
    // Pasados los 5 s, se le pasa (y vuelve a moverse).
    const until = r.stunnedUntil!;
    while (w.tick < until) {
      w.tick++;
      updateOthers(w);
    }
    expect(r.stunnedUntil).toBeUndefined();
  });

  it('sin corriente no hace nada', () => {
    const w = flatWorld(1);
    trap(w, 10, false);
    const r = w.makePawn('saqueador');
    w.others.push(r);
    walk(w, r, 5, 15);
    expect(r.tile).toEqual({ x: 15, y: 10 });
    expect(r.stunnedUntil).toBeUndefined();
  });

  it('a los colonos no les afecta', () => {
    const w = flatWorld(1);
    trap(w, 10, true);
    const c = w.colonists[0];
    walk(w, c, 5, 15);
    expect(c.tile).toEqual({ x: 15, y: 10 });
    expect(c.stunnedUntil).toBeUndefined();
  });

  it('se enciende con un generador y un cable', () => {
    const w = flatWorld(1);
    const s = trap(w, 12, false);
    expect(w.structures.place(9, 12, 'generador_lena')).toBe(true);
    const gen = w.structures.mainAt(9, 12)!;
    w.completeStructure(gen);
    gen.fuel = 5;
    for (const [x, y] of [[11, 12], [11, 11], [11, 10]] as const) {
      w.structures.place(x, y, 'cable');
      w.completeStructure(w.structures.cableAt(x, y)!);
    }
    for (let i = 0; i < TICKS_PER_SECOND; i++) w.step();
    expect(s.powered).toBe(true);
  });
});
