import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef, BUILDINGS } from '../src/data/buildings';
import { addResearch, chooseResearch, missingResearch, unlockedBy } from '../src/sim/research';
import { ATTACK_COOLDOWN } from '../src/sim/people';
import { TICKS_PER_HOUR } from '../src/sim/world';

type W = ReturnType<typeof flatWorld>;

function build(w: W, x: number, y: number, id: string) {
  expect(w.structures.place(x, y, id)).toBe(true);
  const s = id === 'cable' ? w.structures.cableAt(x, y)! : w.structures.mainAt(x, y)!;
  w.completeStructure(s);
  return s;
}

function research(w: W, id: string): void {
  expect(chooseResearch(w.research, id)).toBe(true);
  addResearch(w.research, 1e9);
}

/** Torreta en (14, 10) conectada a un generador de leña lleno. */
function poweredTurret(id: string) {
  const w = flatWorld(0);
  const gen = build(w, 10, 10, 'generador_lena');
  gen.fuel = 50;
  build(w, 12, 10, 'cable');
  build(w, 13, 10, 'cable');
  const t = build(w, 14, 10, id);
  return { w, t };
}

function raider(w: W, x: number, y: number) {
  const r = w.makePawn('saqueador');
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  r.raider = { fleeing: false, leaveAt: w.tick + 999999 };
  r.skills.combate = 5;
  w.others.push(r);
  return r;
}

/** Disparos de la torreta durante `ticks` contra un saqueador quieto e incansable. */
function shotsIn(id: string, x: number, ticks: number): number {
  const { w } = poweredTurret(id);
  const r = raider(w, x, 10);
  let shots = 0;
  for (let i = 0; i < ticks; i++) {
    w.step();
    shots += w.turretShots.filter((k) => k.tick === w.tick).length;
    r.health = 1;
    r.downed = false;
    if (r.raider) r.raider.fleeing = false;
    r.path = [];
    r.tile = { x, y: 10 };
    r.pos = { x: x + 0.5, y: 10.5 };
  }
  return shots;
}

describe('torreta rotativa', () => {
  it('los números del catálogo: 🔗25 ⚙️8, 1×1, 400 W, ×1,2, 10 casillas, sin munición', () => {
    const d = buildingDef('torreta_rotativa');
    expect(d.category).toBe('defensa');
    expect(d.cost).toEqual({ metal: 25, componentes: 8 });
    expect(d.size).toBeUndefined();
    expect(d.power).toBe(-400);
    expect(d.turret!.damage).toBe(1.2);
    expect(d.turret!.reach).toBe(10);
    // Tres veces más rápida que la ligera.
    const light = buildingDef('torreta_ligera').turret!;
    expect(Math.round(ATTACK_COOLDOWN * d.turret!.cooldown) * 3).toBe(Math.round(ATTACK_COOLDOWN * light.cooldown));
  });

  it('pide investigar «Ametralladoras»', () => {
    const w = flatWorld(0);
    const d = buildingDef('torreta_rotativa');
    expect(missingResearch(w.research, d)?.id).toBe('ametralladoras');
    expect(w.canBuild('torreta_rotativa')).toBe(false);
    for (const id of ['polvora', 'torretas', 'artilleria', 'ametralladoras']) research(w, id);
    expect(unlockedBy(BUILDINGS, 'ametralladoras', w.research).map((b) => b.id)).toContain('torreta_rotativa');
    expect(w.canBuild('torreta_rotativa')).toBe(true);
  });

  it('con corriente dispara tres veces más seguido que la ligera, y llega a 10 casillas', () => {
    const ticks = TICKS_PER_HOUR / 2;
    const light = shotsIn('torreta_ligera', 20, ticks);
    const rotary = shotsIn('torreta_rotativa', 20, ticks);
    expect(light).toBeGreaterThan(0);
    expect(rotary).toBeGreaterThanOrEqual(light * 3 - 3);
    expect(rotary).toBeLessThanOrEqual(light * 3 + 3);
    expect(shotsIn('torreta_rotativa', 24, ticks)).toBeGreaterThan(0); // a 10 casillas
    expect(shotsIn('torreta_rotativa', 25, ticks)).toBe(0); // a 11, no
    expect(shotsIn('torreta_ligera', 24, ticks)).toBe(0); // la ligera no llega
  });

  it('sin corriente no dispara', () => {
    const w = flatWorld(0);
    build(w, 14, 10, 'torreta_rotativa');
    const r = raider(w, 18, 10);
    for (let i = 0; i < TICKS_PER_HOUR / 4; i++) {
      w.step();
      r.path = [];
      r.tile = { x: 18, y: 10 };
      r.pos = { x: 18.5, y: 10.5 };
    }
    expect(r.health).toBe(1);
    expect(w.turretShots.length).toBe(0);
  });
});
