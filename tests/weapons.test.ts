import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { attack, canHit, coverAt, FRIENDLY_FIRE, reachOf, seekCover, startRaid, strayVictim, updateOthers } from '../src/sim/people';
import { Prop } from '../src/sim/map';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/world';
import { recipesFor } from '../src/data/recipes';
import { raiderWeaponPool, WEAPON_IDS } from '../src/data/weapons';
import { walkSpeedMultiplier, type Colonist } from '../src/sim/colonist';

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

describe('cobertura y alcance', () => {
  it('un muro pegado al objetivo impide dispararle; una barricada o un árbol quitan acierto', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    a.tile = { x: 5, y: 10 };
    b.tile = { x: 10, y: 10 };
    a.weapon = 'arco';
    a.ammo = 10;
    expect(canHit(w, a, b)).toBe(true);
    expect(coverAt(w, a.tile, b.tile)).toBe(0);
    w.setProp(9, 10, Prop.DeadTree);
    expect(coverAt(w, a.tile, b.tile)).toBeCloseTo(0.3);
    w.setProp(9, 10, Prop.Boulder);
    expect(coverAt(w, a.tile, b.tile)).toBeCloseTo(0.5);
    w.setProp(9, 10, Prop.None);
    w.structures.place(9, 10, 'muro_madera');
    w.completeStructure(w.structures.at(9, 10)!);
    expect(canHit(w, a, b)).toBe(false);
    // Desde el otro lado, el muro no le tapa.
    a.tile = { x: 14, y: 10 };
    expect(canHit(w, a, b)).toBe(true);
  });

  it('en una zanja se acierta menos y desde una torre se llega más lejos', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    a.tile = { x: 5, y: 10 };
    b.tile = { x: 15, y: 10 };
    a.weapon = 'arco';
    a.ammo = 10;
    w.map.trench[10 * w.map.width + 15] = 1;
    expect(coverAt(w, a.tile, b.tile)).toBeCloseTo(0.25);
    expect(canHit(w, a, b)).toBe(false); // a 10 casillas, el arco llega a 8
    w.structures.place(5, 10, 'torre_madera');
    w.completeStructure(w.structures.at(5, 10)!);
    expect(reachOf(a, w)).toBe(10);
    expect(canHit(w, a, b)).toBe(true);
  });

  it('un arquero reclutado al descubierto busca cobertura cerca', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.tile = { x: 10, y: 10 };
    c.pos = { x: 10.5, y: 10.5 };
    c.weapon = 'arco';
    c.ammo = 20;
    w.setDrafted(c.id, true);
    w.structures.place(12, 11, 'barricada_madera');
    w.completeStructure(w.structures.at(12, 11)!);
    const e = w.makePawn('saqueador');
    e.tile = { x: 17, y: 11 };
    e.pos = { x: 17.5, y: 11.5 };
    e.raider = { fleeing: false, leaveAt: w.tick + 100000 };
    expect(seekCover(w, c, e)).toBe(true);
    expect(c.path[c.path.length - 1]).toEqual({ x: 11, y: 11 });
  });
});

describe('fuego amigo', () => {
  it('solo cuenta quien está pegado al objetivo y en la línea de tiro', () => {
    const w = flatWorld(3);
    const [a, b, c] = w.colonists;
    a.tile = { x: 5, y: 10 };
    const e = raiderAt(w, 12, 10);
    b.tile = { x: 11, y: 10 }; // delante del objetivo
    c.tile = { x: 12, y: 12 }; // a 2 casillas: no
    expect(strayVictim(w, a, e)).toBe(b);
    b.tile = { x: 13, y: 10 }; // detrás del objetivo, también en la línea
    expect(strayVictim(w, a, e)).toBe(b);
    b.tile = { x: 12, y: 11 }; // al lado, fuera de la línea
    expect(strayVictim(w, a, e)).toBeNull();
    b.tile = { x: 11, y: 10 };
    b.downed = true; // en el suelo no
    expect(strayVictim(w, a, e)).toBeNull();
  });

  it('una cuarta parte de los disparos fallados da al colono de la línea de tiro', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    a.tile = { x: 2, y: 10 };
    a.pos = { x: 2.5, y: 10.5 };
    a.weapon = 'arco';
    a.skills.combate = 0;
    b.tile = { x: 9, y: 10 };
    b.traits = [];
    const e = raiderAt(w, 10, 10); // a 8 casillas: se falla mucho
    let misses = 0;
    let stray = 0;
    for (let i = 0; i < 4000; i++) {
      a.ammo = 5;
      const before = b.health;
      const eBefore = e.health;
      if (!attack(w, a, e)) {
        misses++;
        if (b.health < before) stray++;
      }
      expect(e.health <= eBefore).toBe(true);
      b.health = 1;
      b.wounds = [];
      b.downed = false;
      e.health = 1;
      e.wounds = [];
      e.downed = false;
    }
    expect(misses).toBeGreaterThan(1000);
    expect(stray / misses).toBeGreaterThan(FRIENDLY_FIRE - 0.04);
    expect(stray / misses).toBeLessThan(FRIENDLY_FIRE + 0.04);
  });

  it('cuerpo a cuerpo no hay fuego amigo', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    a.tile = { x: 9, y: 10 };
    a.weapon = null;
    b.tile = { x: 11, y: 10 };
    const e = raiderAt(w, 10, 10);
    for (let i = 0; i < 300; i++) {
      attack(w, a, e);
      e.health = 1;
      e.wounds = [];
      e.downed = false;
    }
    expect(b.health).toBe(1);
  });
});

describe('armadura', () => {
  it('se pone solo el mejor chaleco y el mejor casco libres, y quitan daño', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    w.items.drop(8, 8, 'chaleco_cuero', 1);
    w.items.drop(12, 5, 'chaleco_metal', 1);
    w.items.drop(6, 9, 'casco_chapa', 1);
    for (let i = 0; i < 4000 && !(c.vest === 'chaleco_metal' && c.helmet === 'casco_chapa'); i++) w.step();
    expect([c.vest, c.helmet]).toEqual(['chaleco_metal', 'casco_chapa']);
    expect(walkSpeedMultiplier(c)).toBeCloseTo(0.9 * c.traits.reduce((m, t) => m * (t.walkSpeed ?? 1), 1));
    w.setArmorChoice(c, 'ninguna');
    expect([c.vest, c.helmet]).toEqual([null, null]);
  });

  it('con chaleco y casco de metal se recibe la mitad de daño', () => {
    const lost = (armored: boolean) => {
      const w = flatWorld(2);
      const [a, b] = w.colonists;
      a.skills.combate = 20;
      if (armored) {
        b.vest = 'chaleco_metal';
        b.helmet = 'casco_metal';
      }
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const before = b.health;
        attack(w, a, b);
        n += before - b.health;
        b.health = 1;
        b.wounds = [];
        b.downed = false;
      }
      return n;
    };
    expect(lost(true)).toBeCloseTo(lost(false) * 0.5, 5);
  });

  it('se guarda con la partida y los saqueadores llevan chaleco desde el día 10', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.vest = 'chaleco_chapa';
    c.helmet = 'casco_metal';
    c.armorChoice = 'ninguna';
    const l = loadWorld(JSON.stringify(serializeWorld(w))).colonists[0];
    expect([l.vest, l.helmet, l.armorChoice]).toEqual(['chaleco_chapa', 'casco_metal', 'ninguna']);
    w.tick = 11 * TICKS_PER_DAY;
    const raiders = startRaid(w, 4);
    expect(raiders.every((r) => r.vest === 'chaleco_cuero' || r.vest === 'chaleco_chapa')).toBe(true);
  });
});
