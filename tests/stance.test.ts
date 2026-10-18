import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/world';
import { activityLabel, type Colonist } from '../src/sim/colonist';

type W = ReturnType<typeof flatWorld>;

function raiderAt(w: W, x: number, y: number): Colonist {
  const r = w.makePawn('saqueador');
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
  w.others.push(r);
  return r;
}

/** Deja a un saqueador clavado en su sitio y sin pegar (para medir lo que hace el colono). */
function pin(r: Colonist, x: number, y: number): void {
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  r.path = [];
  r.attackCooldown = 999;
}

function run(w: W, ticks: number, each?: () => void): void {
  for (let i = 0; i < ticks; i++) {
    each?.();
    w.step();
  }
}

describe('posturas del reclutado', () => {
  it('sin postura va a por un enemigo cercano; «mantener posición» no se mueve', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    const r = raiderAt(w, 12, 5);
    w.setDrafted(c.id, true);
    run(w, 60, () => pin(r, 12, 5));
    expect(c.tile.x).toBeGreaterThan(5); // va a por él

    const w2 = flatWorld(1);
    const c2 = w2.colonists[0];
    const r2 = raiderAt(w2, 12, 5);
    expect(w2.setStance(c2.id, 'mantener')).toBe(true);
    expect(c2.drafted).toBe(true); // ponerle una postura lo recluta
    run(w2, 200, () => pin(r2, 12, 5));
    expect(c2.tile).toEqual({ x: 5, y: 5 });
    expect(activityLabel(c2)).toContain('manteniendo');
  });

  it('«mantener posición» pega a lo que tiene a tiro', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    const r = raiderAt(w, 6, 5);
    w.setStance(c.id, 'mantener');
    run(w, 200, () => pin(r, 6, 5));
    expect(r.health).toBeLessThan(1);
    expect(c.tile).toEqual({ x: 5, y: 5 });
  });

  it('«atacar a…» va solo a por su objetivo, ignora a otro más cercano y al caer o huir vuelve a la normal', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.skills.combate = 20;
    const near = raiderAt(w, 8, 5);
    const target = raiderAt(w, 5, 15);
    expect(w.setStance(c.id, 'atacar', near.id + 1000)).toBe(false); // objetivo que no existe
    expect(w.setStance(c.id, 'atacar', target.id)).toBe(true);
    run(w, 3000, () => {
      pin(near, 8, 5);
      if (!target.downed) pin(target, 5, 15);
      target.attackCooldown = 999;
    });
    expect(near.health).toBe(1); // al cercano ni lo toca
    // Herido, el objetivo cae o huye; entonces deja de atacar y espera órdenes.
    expect(target.health).toBeLessThan(1);
    expect(c.stance).toBeUndefined();
    expect(w.log.some((l) => l.text.includes('espera órdenes'))).toBe(true);
  });

  it('«atacar a…» deja de perseguir si el objetivo huye', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    const target = raiderAt(w, 5, 15);
    w.setStance(c.id, 'atacar', target.id);
    run(w, 10, () => pin(target, 5, 15));
    target.raider!.fleeing = true;
    run(w, 2, () => pin(target, 5, 15));
    expect(c.stance).toBeUndefined();
    expect(c.attackTarget).toBeUndefined();
  });

  it('«retirarse» va a la cama más cercana y no pelea aunque tenga un enemigo al lado', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    expect(w.structures.place(15, 5, 'cama')).toBe(true);
    w.completeStructure(w.structures.at(15, 5)!);
    const r = raiderAt(w, 6, 5);
    expect(w.setStance(c.id, 'retirarse')).toBe(true);
    expect(c.path.length).toBeGreaterThan(0);
    run(w, 400, () => {
      r.attackCooldown = 999;
      r.path = [];
    });
    expect(r.health).toBe(1);
    expect(Math.abs(c.tile.x - 15) + Math.abs(c.tile.y - 5)).toBeLessThanOrEqual(1);
    expect(activityLabel(c)).toContain('retirado');
  });

  it('mandarlo a un sitio quita «atacar» y «retirarse», pero no «mantener»; liberarlo quita la postura', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    w.setStance(c.id, 'retirarse');
    expect(w.orderMove(c.id, { x: 10, y: 10 })).toBe(true);
    expect(c.stance).toBeUndefined();
    w.setStance(c.id, 'mantener');
    expect(w.orderMove(c.id, { x: 12, y: 10 })).toBe(true);
    expect(c.stance).toBe('mantener');
    w.setDrafted(c.id, false);
    expect(c.stance).toBeUndefined();
    expect(w.setStance(c.id, null)).toBe(true);
    expect(c.drafted).toBe(true);
    expect(c.stance).toBeUndefined();
  });

  it('se guarda con la partida; las partidas antiguas no tienen postura', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    const r = raiderAt(w, 20, 20);
    w.setStance(a.id, 'mantener');
    w.setStance(b.id, 'atacar', r.id);
    const loaded = loadWorld(serializeWorld(w));
    const [la, lb] = loaded.colonists;
    expect(la.stance).toBe('mantener');
    expect(lb.stance).toBe('atacar');
    expect(lb.attackTarget).toBe(r.id);

    const old = JSON.parse(JSON.stringify(serializeWorld(w)));
    for (const s of old.colonists) {
      delete s.stance;
      delete s.attackTarget;
    }
    const fromOld = loadWorld(old);
    expect(fromOld.colonists.every((k) => k.stance === undefined)).toBe(true);
  });
});
