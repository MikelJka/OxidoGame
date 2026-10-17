import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { attack, startRaid, updateOthers } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/world';
import { recipesFor } from '../src/data/recipes';
import { raiderWeaponPool, WEAPON_IDS } from '../src/data/weapons';
import type { Colonist } from '../src/sim/colonist';

function raiderAt(w: ReturnType<typeof flatWorld>, x: number, y: number): Colonist {
  const r = w.makePawn('saqueador');
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
  w.others.push(r);
  return r;
}

describe('armas', () => {
  it('todas se fabrican en el banco, y las flechas también', () => {
    const outs = recipesFor('banco_trabajo').flatMap((r) => Object.keys(r.outputs));
    for (const id of WEAPON_IDS) expect(outs).toContain(id);
    expect(outs).toContain('flechas');
  });

  it('un colono coge solo la mejor arma libre y deja la que llevaba', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    w.items.drop(8, 8, 'palo', 1);
    w.items.drop(12, 5, 'machete', 1);
    for (let i = 0; i < 3000 && c.weapon !== 'machete'; i++) w.step();
    expect(c.weapon).toBe('machete');
    expect(w.items.totals().palo).toBe(1);
    expect(w.items.totals().machete).toBe(0);
  });

  it('en la ficha se le puede fijar un arma o dejarlo sin ninguna', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    w.items.drop(8, 8, 'palo', 1);
    w.items.drop(12, 5, 'machete', 1);
    w.setWeaponChoice(c, 'palo');
    for (let i = 0; i < 3000 && c.weapon !== 'palo'; i++) w.step();
    expect(c.weapon).toBe('palo');
    w.setWeaponChoice(c, 'ninguna');
    expect(c.weapon).toBeNull();
    for (let i = 0; i < 600; i++) w.step();
    expect(c.weapon).toBeNull();
  });

  it('un arquero coge flechas y dispara de lejos, gastándolas', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    w.items.drop(6, 5, 'arco', 1);
    w.items.drop(7, 5, 'flechas', 30);
    for (let i = 0; i < 3000 && !(c.weapon === 'arco' && c.ammo > 0); i++) w.step();
    expect(c.weapon).toBe('arco');
    expect(c.ammo).toBe(20);
    w.setDrafted(c.id, true);
    const r = raiderAt(w, c.tile.x + 5, c.tile.y);
    const from = { ...c.tile };
    for (let i = 0; i < 200; i++) {
      w.step();
      // El saqueador se queda a 5 casillas (lo devolvemos a su sitio cada tick).
      r.path = [];
      r.tile = { x: from.x + 5, y: from.y };
      r.pos = { x: from.x + 5.5, y: from.y + 0.5 };
      r.health = 1;
      r.downed = false;
      r.wounds = [];
    }
    expect(c.ammo).toBeLessThan(20);
    expect(c.tile).toEqual(from);
  });

  it('el machete hace más daño que los puños', () => {
    const dmg = (weapon: 'machete' | null) => {
      const w = flatWorld(2);
      const [a, b] = w.colonists;
      a.weapon = weapon;
      a.skills.combate = 20;
      let lost = 0;
      for (let i = 0; i < 40; i++) {
        const before = b.health;
        attack(w, a, b);
        lost += before - b.health;
        b.health = 1;
        b.wounds = [];
        b.downed = false;
      }
      return lost;
    };
    expect(dmg('machete')).toBeGreaterThan(dmg(null) * 2);
  });

  it('los saqueadores llegan armados según el día y sueltan el arma al caer', () => {
    expect(raiderWeaponPool(2)).not.toContain('arco');
    expect(raiderWeaponPool(14)).toContain('arco');
    const w = flatWorld(1);
    w.tick = 14 * TICKS_PER_DAY;
    const raiders = startRaid(w, 6);
    expect(raiders.some((r) => r.weapon !== null)).toBe(true);
    const r = raiders.find((k) => k.weapon)!;
    const weapon = r.weapon!;
    r.downed = true;
    updateOthers(w);
    expect(r.weapon).toBeNull();
    expect(w.items.totals()[weapon]).toBeGreaterThan(0);
  });

  it('el arma se guarda con la partida; las antiguas empiezan sin arma', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.weapon = 'arco';
    c.ammo = 12;
    c.weaponChoice = 'arco';
    const loaded = loadWorld(JSON.stringify(serializeWorld(w)));
    const l = loaded.colonists[0];
    expect([l.weapon, l.ammo, l.weaponChoice]).toEqual(['arco', 12, 'arco']);
    const old = serializeWorld(w) as unknown as { colonists: Record<string, unknown>[] };
    for (const k of ['weapon', 'ammo', 'weaponChoice']) delete old.colonists[0][k];
    const l2 = loadWorld(JSON.stringify(old)).colonists[0];
    expect([l2.weapon, l2.ammo, l2.weaponChoice]).toEqual([null, 0, 'auto']);
  });
});

describe('armero', () => {
  it('guarda solo armas y munición, el triple por casilla', () => {
    const w = flatWorld(1);
    w.items.drop(15, 15, 'madera', 10);
    expect(w.structures.place(15, 15, 'armero')).toBe(true);
    const s = w.structures.at(15, 15)!;
    w.completeStructure(s);
    // La madera que había sale a un lado.
    expect(w.items.at(15, 15)).toBeUndefined();
    expect(w.items.totals().madera).toBe(10);
    expect(w.items.room(15, 15, 'madera')).toBe(0);
    expect(w.items.room(16, 15, 'cuchillo')).toBe(30);
    expect(w.items.room(16, 15, 'flechas')).toBe(300);
  });
});
