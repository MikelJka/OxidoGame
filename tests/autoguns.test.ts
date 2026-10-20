import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { researchCost } from '../src/sim/research';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/world';
import { recipeDef } from '../src/data/recipes';
import { researchDef } from '../src/data/research';
import { raiderWeaponPool, WEAPONS, weaponScore } from '../src/data/weapons';
import { attack, dropGear, startRaid } from '../src/sim/people';

describe('subfusil y rifle de francotirador («Armas automáticas»)', () => {
  it('tienen los números del catálogo', () => {
    expect(WEAPONS.subfusil).toMatchObject({ damage: 1.3, reach: 7, ammo: 'balas', firearm: true, speedLabel: 'muy rápido' });
    expect(WEAPONS.francotirador).toMatchObject({ damage: 4.5, reach: 18, ammo: 'balas', firearm: true, speedLabel: 'muy lento' });
    // Muy rápido dispara más a menudo que rápido; muy lento, menos que lento.
    expect(WEAPONS.subfusil.cooldown).toBeLessThan(WEAPONS.cuchillo.cooldown);
    expect(WEAPONS.francotirador.cooldown).toBeGreaterThan(WEAPONS.rifle.cooldown);
    expect(recipeDef('fabricar_subfusil')).toMatchObject({ station: 'banco_trabajo', inputs: { metal: 6, componentes: 3 }, outputs: { subfusil: 1 }, research: 'armas_automaticas' });
    expect(recipeDef('fabricar_francotirador')).toMatchObject({ station: 'banco_trabajo', inputs: { metal: 10, componentes: 4, madera: 4 }, outputs: { francotirador: 1 }, research: 'armas_automaticas' });
    expect(researchDef('armas_automaticas')!.requires).toEqual(['armas_largas']);
  });

  it('el subfusil dispara más a menudo y el francotirador espera más entre disparos', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    b.tile = { x: a.tile.x + 3, y: a.tile.y };
    b.pos = { x: b.tile.x + 0.5, y: b.tile.y + 0.5 };
    const wait = (id: 'subfusil' | 'francotirador' | 'pistola') => {
      a.weapon = id;
      a.ammo = 5;
      b.health = 1;
      attack(w, a, b);
      return a.attackCooldown ?? 0;
    };
    const pistol = wait('pistola');
    expect(wait('subfusil')).toBeLessThan(pistol * 0.6);
    expect(wait('francotirador')).toBeGreaterThan(pistol * 1.6);
  });

  it('sin «Armas automáticas» no se encargan; investigada, sí, y el diario lo dice', () => {
    const w = flatWorld(1);
    w.structures.place(8, 8, 'banco_trabajo');
    const s = w.structures.at(8, 8)!;
    w.completeStructure(s);
    const bill = (id: string) => ({ recipe: recipeDef(id)!, target: 1, paused: false, mode: 'count' as const });
    w.research.done.push('polvora', 'armas_largas');
    expect(w.setStationBill(s, bill('fabricar_subfusil'))).toBe(false);
    expect(w.setStationBill(s, bill('fabricar_francotirador'))).toBe(false);
    w.colonists[0].skills.investigacion = 10;
    w.structures.place(4, 8, 'banco_investigacion');
    w.completeStructure(w.structures.at(4, 8)!);
    expect(w.setResearch('armas_automaticas')).toBe(true);
    w.research.progress.armas_automaticas = researchCost(researchDef('armas_automaticas')!) * 0.98;
    for (let t = 0; t < TICKS_PER_HOUR * 3 && !w.research.done.includes('armas_automaticas'); t++) w.step();
    expect(w.log.some((l) => l.text.includes('Ya se puede fabricar: Subfusil, Rifle de francotirador'))).toBe(true);
    expect(w.setStationBill(s, bill('fabricar_subfusil'))).toBe(true);
  });

  it('con balas, un colono los prefiere al rifle; sin balas, no valen más que un machete', () => {
    expect(weaponScore('subfusil', true)).toBeGreaterThan(weaponScore('rifle', true));
    expect(weaponScore('francotirador', true)).toBeGreaterThan(weaponScore('rifle', true));
    expect(weaponScore('francotirador', false)).toBeLessThan(weaponScore('machete', true));
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.weapon = 'rifle';
    c.ammo = 20;
    w.items.drop(6, 5, 'francotirador', 1);
    for (let i = 0; i < 3000 && (c.weapon as string) !== 'francotirador'; i++) w.step();
    expect(c.weapon as string).toBe('francotirador');
    expect(c.ammo).toBeGreaterThan(0);
  });

  it('los saqueadores los traen desde el día 35 (elegido por Mikel), no antes', () => {
    for (const d of [0, 15, 25, 34]) {
      expect(raiderWeaponPool(d)).not.toContain('subfusil');
      expect(raiderWeaponPool(d)).not.toContain('francotirador');
    }
    for (const d of [35, 60]) {
      expect(raiderWeaponPool(d)).toContain('subfusil');
      expect(raiderWeaponPool(d)).toContain('francotirador');
    }
  });

  it('el saqueador llega con 15 balas y, al caer, suelta el arma y las balas', () => {
    const w = flatWorld(1);
    w.tick = 35 * TICKS_PER_DAY;
    const found = new Set<string>();
    let gunner: ReturnType<typeof startRaid>[number] | null = null;
    for (let i = 0; i < 40 && found.size < 2; i++) {
      for (const r of startRaid(w, 6, false)) {
        if (r.weapon === 'subfusil' || r.weapon === 'francotirador') {
          found.add(r.weapon);
          expect(r.ammo).toBe(15);
          gunner = r;
        }
      }
    }
    expect([...found].sort()).toEqual(['francotirador', 'subfusil']);
    const weapon = gunner!.weapon!;
    const before = w.items.totals();
    dropGear(w, gunner!);
    const after = w.items.totals();
    expect((after[weapon] ?? 0) - (before[weapon] ?? 0)).toBe(1);
    expect((after.balas ?? 0) - (before.balas ?? 0)).toBe(15);
  });

  it('se guardan', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.weapon = 'subfusil';
    c.weaponChoice = 'francotirador';
    c.ammo = 7;
    w.items.drop(3, 3, 'francotirador', 1);
    const back = loadWorld(serializeWorld(w));
    expect(back.colonists[0].weapon).toBe('subfusil');
    expect(back.colonists[0].weaponChoice).toBe('francotirador');
    expect(back.colonists[0].ammo).toBe(7);
    expect(back.items.at(3, 3)?.resource).toBe('francotirador');
  });
});
