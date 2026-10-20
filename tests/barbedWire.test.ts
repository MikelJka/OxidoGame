import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { coverAt } from '../src/sim/people';
import { tileMoveCost } from '../src/sim/map';
import { addResearch, chooseResearch, unlocked } from '../src/sim/research';
import type { World } from '../src/sim/world';
import type { Colonist } from '../src/sim/colonist';

/** Hace andar a alguien en línea recta por la fila 10, desde x0 hasta x1. */
function walk(w: World, c: Colonist, x0: number, x1: number): void {
  c.tile = { x: x0, y: 10 };
  c.pos = { x: x0 + 0.5, y: 10.5 };
  c.path = [];
  for (let x = x0 + 1; x <= x1; x++) c.path.push({ x, y: 10 });
  for (let i = 0; i < 2000 && c.path.length > 0; i++) w.moveAlongPath(c);
}

function wire(w: World, x: number): void {
  expect(w.structures.place(x, 10, 'alambre_espino')).toBe(true);
  w.completeStructure(w.structures.at(x, 10)!);
}

describe('alambre de espino', () => {
  it('cuesta 🔩2, pide «Fortificación», se pisa y no da cobertura', () => {
    const d = buildingDef('alambre_espino');
    expect(d.category).toBe('defensa');
    expect(d.cost).toEqual({ chatarra: 2 });
    expect(d.research).toBe('fortificacion');
    expect(d.blocks).toBe(false);

    const w = flatWorld(2);
    expect(unlocked(w.research, d)).toBe(false);
    chooseResearch(w.research, 'fortificacion');
    addResearch(w.research, 1e9);
    expect(unlocked(w.research, d)).toBe(true);

    wire(w, 9);
    const [a, b] = w.colonists;
    a.tile = { x: 4, y: 10 };
    b.tile = { x: 10, y: 10 };
    expect(coverAt(w, a.tile, b.tile)).toBe(0);
  });

  it('frena ×3 a quien lo cruza', () => {
    const w = flatWorld(0);
    const base = tileMoveCost(w.map, 10, 10);
    wire(w, 10);
    expect(tileMoveCost(w.map, 10, 10)).toBeCloseTo(base * 3);
  });

  it('hace un poco de daño a los saqueadores que lo cruzan, no a los colonos', () => {
    const w = flatWorld(1);
    wire(w, 10);
    wire(w, 11);
    const r = w.makePawn('saqueador');
    w.others.push(r);
    walk(w, r, 5, 15);
    expect(r.tile).toEqual({ x: 15, y: 10 });
    expect(r.health).toBeCloseTo(1 - 2 * buildingDef('alambre_espino').stepDamage!);
    expect(r.wounds).toHaveLength(2);
    expect(r.downed).toBe(false);

    const c = w.colonists[0];
    walk(w, c, 5, 15);
    expect(c.health).toBe(1);
    expect(c.wounds).toHaveLength(0);
  });

  it('un saqueador muy herido cae en el alambre (sin morir) y se queda allí', () => {
    const w = flatWorld(0);
    wire(w, 10);
    const r = w.makePawn('saqueador');
    w.others.push(r);
    r.health = 0.18;
    walk(w, r, 5, 15);
    expect(r.downed).toBe(true);
    expect(r.health).toBeGreaterThan(0);
    expect(r.tile).toEqual({ x: 10, y: 10 });
  });
});
