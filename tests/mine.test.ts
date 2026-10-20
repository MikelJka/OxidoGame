import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { addResearch, chooseResearch, missingResearch, unlocked, unlockedBy } from '../src/sim/research';
import { BUILDINGS } from '../src/data/buildings';
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

function mine(w: World, x: number): void {
  expect(w.structures.place(x, 10, 'mina_casera')).toBe(true);
  w.completeStructure(w.structures.at(x, 10)!);
}

function research(w: World, id: string): void {
  chooseResearch(w.research, id);
  addResearch(w.research, 1e9);
}

describe('mina casera', () => {
  it('cuesta 🔩6 ⚙️1 y pide «Trampas» y «Pólvora»', () => {
    const d = buildingDef('mina_casera');
    expect(d.category).toBe('defensa');
    expect(d.cost).toEqual({ chatarra: 6, componentes: 1 });
    expect(d.blocks).toBe(false);
    expect(d.mine).toEqual({ damage: 4, radius: 1 });

    const w = flatWorld(0);
    expect(unlocked(w.research, d)).toBe(false);
    expect(missingResearch(w.research, d)?.id).toBe('trampas');
    research(w, 'trampas');
    // Con «Trampas» sola aún no: falta «Pólvora», y al terminar «Trampas» no se anuncia.
    expect(unlocked(w.research, d)).toBe(false);
    expect(missingResearch(w.research, d)?.id).toBe('polvora');
    expect(unlockedBy(BUILDINGS, 'trampas', w.research).map((b) => b.id)).not.toContain('mina_casera');
    expect(w.canBuild('mina_casera')).toBe(false);
    research(w, 'polvora');
    expect(unlocked(w.research, d)).toBe(true);
    expect(missingResearch(w.research, d)).toBeUndefined();
    expect(unlockedBy(BUILDINGS, 'polvora', w.research).map((b) => b.id)).toContain('mina_casera');
    expect(w.canBuild('mina_casera')).toBe(true);
  });

  it('estalla al pisarla un saqueador: daña a los enemigos del 3×3 y se gasta', () => {
    const w = flatWorld(1);
    mine(w, 10);
    const r = w.makePawn('saqueador');
    const near = w.makePawn('saqueador');
    const far = w.makePawn('saqueador');
    w.others.push(r, near, far);
    near.tile = { x: 11, y: 11 };
    far.tile = { x: 13, y: 10 };
    // Un colono pegado a la mina no se lleva nada.
    const c = w.colonists[0];
    c.tile = { x: 9, y: 9 };
    walk(w, r, 5, 15);
    expect(w.structures.mainAt(10, 10)).toBeUndefined();
    expect(r.health).toBeLessThan(0.6);
    expect(near.health).toBeLessThan(0.6);
    expect(far.health).toBe(1);
    expect(c.health).toBe(1);
    expect(w.log.some((l) => l.text.includes('estalla'))).toBe(true);
  });

  it('los colonos la cruzan sin que estalle', () => {
    const w = flatWorld(1);
    mine(w, 10);
    const c = w.colonists[0];
    walk(w, c, 5, 15);
    expect(c.tile).toEqual({ x: 15, y: 10 });
    expect(c.health).toBe(1);
    expect(w.structures.mainAt(10, 10)?.def.id).toBe('mina_casera');
  });

  it('un saqueador muy herido cae en la mina sin morir y se queda allí', () => {
    const w = flatWorld(0);
    mine(w, 10);
    const r = w.makePawn('saqueador');
    w.others.push(r);
    r.health = 0.3;
    walk(w, r, 5, 15);
    expect(r.downed).toBe(true);
    expect(r.health).toBeGreaterThan(0);
    expect(r.tile).toEqual({ x: 10, y: 10 });
  });
});
