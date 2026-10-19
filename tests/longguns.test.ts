import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { attack, startRaid } from '../src/sim/people';
import { researchCost } from '../src/sim/research';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/world';
import { recipeDef } from '../src/data/recipes';
import { researchDef } from '../src/data/research';
import { damageAt, raiderWeaponPool, WEAPONS, weaponScore } from '../src/data/weapons';

describe('escopeta y rifle («Armas largas»)', () => {
  it('tienen los números del catálogo', () => {
    expect(WEAPONS.escopeta).toMatchObject({ damage: 3.6, closeRange: 3, farDamage: 1.8, reach: 6, ammo: 'balas', firearm: true, speedLabel: 'lento' });
    expect(WEAPONS.rifle).toMatchObject({ damage: 3.0, reach: 14, ammo: 'balas', firearm: true, speedLabel: 'lento' });
    expect(WEAPONS.rifle.closeRange).toBeUndefined();
    expect(recipeDef('fabricar_escopeta')).toMatchObject({ station: 'banco_trabajo', inputs: { metal: 6, componentes: 2 }, outputs: { escopeta: 1 }, research: 'armas_largas' });
    expect(recipeDef('fabricar_rifle')).toMatchObject({ station: 'banco_trabajo', inputs: { metal: 8, componentes: 3, madera: 4 }, outputs: { rifle: 1 }, research: 'armas_largas' });
  });

  it('la escopeta pega ×3,6 a 3 casillas o menos y ×1,8 más lejos; el rifle, igual a cualquier distancia', () => {
    expect(damageAt(WEAPONS.escopeta, 1)).toBe(3.6);
    expect(damageAt(WEAPONS.escopeta, 3)).toBe(3.6);
    expect(damageAt(WEAPONS.escopeta, 4)).toBe(1.8);
    expect(damageAt(WEAPONS.rifle, 2)).toBe(3.0);
    expect(damageAt(WEAPONS.rifle, 14)).toBe(3.0);
  });

  it('en combate, la escopeta hace el doble de daño de cerca que de lejos', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    a.weapon = 'escopeta';
    a.skills.combate = 10;
    const avg = (dist: number) => {
      b.tile = { x: a.tile.x + dist, y: a.tile.y };
      b.pos = { x: b.tile.x + 0.5, y: b.tile.y + 0.5 };
      let sum = 0;
      let hits = 0;
      for (let i = 0; i < 400; i++) {
        a.ammo = 5;
        b.health = 1;
        b.downed = false;
        b.wounds = [];
        if (attack(w, a, b)) {
          sum += 1 - b.health;
          hits++;
        }
      }
      expect(hits).toBeGreaterThan(30);
      return sum / hits;
    };
    const near = avg(2);
    const far = avg(5);
    expect(near / far).toBeGreaterThan(1.7);
    expect(near / far).toBeLessThan(2.3);
  });

  it('sin «Armas largas» no se encargan; investigada, sí, y el diario lo dice', () => {
    const w = flatWorld(1);
    w.structures.place(8, 8, 'banco_trabajo');
    const s = w.structures.at(8, 8)!;
    w.completeStructure(s);
    const bill = (id: string) => ({ recipe: recipeDef(id)!, target: 1, paused: false, mode: 'count' as const });
    w.research.done.push('polvora');
    expect(w.setStationBill(s, bill('fabricar_escopeta'))).toBe(false);
    expect(w.setStationBill(s, bill('fabricar_rifle'))).toBe(false);
    w.colonists[0].skills.investigacion = 10;
    w.structures.place(4, 8, 'banco_investigacion');
    w.completeStructure(w.structures.at(4, 8)!);
    expect(w.setResearch('armas_largas')).toBe(true);
    w.research.progress.armas_largas = researchCost(researchDef('armas_largas')!) * 0.98;
    for (let t = 0; t < TICKS_PER_HOUR * 3 && !w.research.done.includes('armas_largas'); t++) w.step();
    expect(w.log.some((l) => l.text.includes('Ya se puede fabricar: Escopeta, Rifle'))).toBe(true);
    expect(w.setStationBill(s, bill('fabricar_rifle'))).toBe(true);
  });

  it('un colono prefiere el rifle a la pistola, y cualquiera de las dos al machete, si hay balas', () => {
    expect(weaponScore('rifle', true)).toBeGreaterThan(weaponScore('pistola', true) + 0.05);
    expect(weaponScore('escopeta', true)).toBeGreaterThan(weaponScore('machete', true));
    expect(weaponScore('escopeta', false)).toBeLessThan(weaponScore('machete', true));
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.weapon = 'pistola';
    c.ammo = 20;
    w.items.drop(6, 5, 'rifle', 1);
    for (let i = 0; i < 3000 && (c.weapon as string) !== 'rifle'; i++) w.step();
    expect(c.weapon as string).toBe('rifle');
    // Las balas le sirven igual: no las suelta.
    expect(c.ammo).toBeGreaterThan(0);
  });

  it('desde el día 25 los saqueadores traen escopetas y rifles con balas', () => {
    expect(raiderWeaponPool(24)).not.toContain('escopeta');
    expect(raiderWeaponPool(24)).not.toContain('rifle');
    expect(raiderWeaponPool(25)).toContain('escopeta');
    expect(raiderWeaponPool(25)).toContain('rifle');
    const w = flatWorld(1);
    w.tick = 25 * TICKS_PER_DAY;
    let gunner = null;
    for (let i = 0; i < 30 && !gunner; i++) gunner = startRaid(w, 6).find((r) => r.weapon === 'rifle' || r.weapon === 'escopeta') ?? null;
    expect(gunner).not.toBeNull();
    expect(gunner!.ammo).toBe(15);
  });

  it('la escopeta se guarda', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.weapon = 'escopeta';
    c.weaponChoice = 'rifle';
    c.ammo = 9;
    const back = loadWorld(serializeWorld(w)).colonists[0];
    expect(back.weapon).toBe('escopeta');
    expect(back.weaponChoice).toBe('rifle');
    expect(back.ammo).toBe(9);
  });
});
