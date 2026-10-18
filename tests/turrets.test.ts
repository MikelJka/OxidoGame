import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { TICKS_PER_HOUR } from '../src/sim/world';

function build(w: ReturnType<typeof flatWorld>, x: number, y: number, id: string) {
  expect(w.structures.place(x, y, id)).toBe(true);
  const s = id === 'cable' ? w.structures.cableAt(x, y)! : w.structures.mainAt(x, y)!;
  w.completeStructure(s);
  return s;
}

/** Torreta en (14, 10) conectada a un generador de leña lleno. */
function poweredTurret(id = 'torreta_ligera', withPower = true) {
  const w = flatWorld(0);
  if (withPower) {
    const gen = build(w, 10, 10, 'generador_lena');
    gen.fuel = 50;
    build(w, 12, 10, 'cable');
    build(w, 13, 10, 'cable');
  }
  const t = build(w, 14, 10, id);
  return { w, t };
}

/** Un saqueador quieto en (x, y). */
function raider(w: ReturnType<typeof flatWorld>, x: number, y: number) {
  const r = w.makePawn('saqueador');
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  r.raider = { fleeing: false, leaveAt: w.tick + 999999 };
  r.skills.combate = 5;
  w.others.push(r);
  return r;
}

describe('torretas', () => {
  it('los números del catálogo: ligera 120 W y alcance 9; pesada 2×2, 300 W y alcance 14', () => {
    const l = buildingDef('torreta_ligera');
    const p = buildingDef('torreta_pesada');
    expect(l.cost).toEqual({ chatarra: 25, componentes: 4 });
    expect(l.power).toBe(-120);
    expect(l.turret).toEqual({ damage: 2.2, cooldown: 1, reach: 9 });
    expect(p.cost).toEqual({ metal: 30, componentes: 6 });
    expect(p.size).toEqual([2, 2]);
    expect(p.power).toBe(-300);
    expect(p.turret).toEqual({ damage: 3.0, cooldown: 1.35, reach: 14 });
  });

  it('con corriente dispara sola al saqueador a su alcance hasta que cae o huye', () => {
    const { w, t } = poweredTurret();
    const r = raider(w, 20, 10);
    for (let i = 0; i < TICKS_PER_HOUR * 2 && !r.downed && !r.raider?.fleeing; i++) {
      w.step();
      r.path = [];
      r.tile = { x: 20, y: 10 };
      r.pos = { x: 20.5, y: 10.5 };
    }
    expect(t.powered).toBe(true);
    expect(r.health).toBeLessThan(1);
    expect(r.downed || r.raider?.fleeing).toBe(true);
    expect(w.colonists.length).toBe(0); // nadie más ha disparado
  });

  it('sin corriente, fuera de alcance o detrás de un muro, no dispara', () => {
    for (const setup of ['sin corriente', 'lejos', 'muro'] as const) {
      const { w } = poweredTurret('torreta_ligera', setup !== 'sin corriente');
      const x = setup === 'lejos' ? 24 : 20;
      if (setup === 'muro') build(w, 19, 10, 'muro_piedra');
      const r = raider(w, x, 10);
      for (let i = 0; i < TICKS_PER_HOUR / 2; i++) {
        w.step();
        r.path = [];
        r.tile = { x, y: 10 };
        r.pos = { x: x + 0.5, y: 10.5 };
      }
      expect(r.health, setup).toBe(1);
      expect(w.turretShots.length, setup).toBe(0);
    }
  });

  it('la pesada llega a 14 casillas', () => {
    const { w } = poweredTurret('torreta_pesada');
    const r = raider(w, 28, 11); // 13 casillas desde su lado derecho (x = 15)
    let shots = 0;
    for (let i = 0; i < TICKS_PER_HOUR; i++) {
      w.step();
      shots += w.turretShots.filter((k) => k.tick === w.tick).length;
      r.path = [];
      r.tile = { x: 28, y: 11 };
      r.pos = { x: 28.5, y: 11.5 };
    }
    expect(shots).toBeGreaterThan(0);
  });
});
