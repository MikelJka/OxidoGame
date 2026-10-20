import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { researchCost } from '../src/sim/research';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_HOUR } from '../src/sim/world';
import { recipeDef } from '../src/data/recipes';
import { researchDef } from '../src/data/research';
import { raiderWeaponPool, WEAPONS, weaponScore } from '../src/data/weapons';

describe('ballesta («Ballesta») y lanza de metal («Forja»)', () => {
  it('tienen los números del catálogo', () => {
    expect(WEAPONS.ballesta).toMatchObject({ damage: 2.4, reach: 10, ammo: 'flechas', speedLabel: 'lento' });
    expect(WEAPONS.ballesta.firearm).toBeFalsy();
    expect(WEAPONS.lanza_metal).toMatchObject({ damage: 2.6, reach: 2, speedLabel: 'normal' });
    expect(WEAPONS.lanza_metal.ammo).toBeUndefined();
    expect(recipeDef('fabricar_ballesta')).toMatchObject({ station: 'banco_trabajo', inputs: { madera: 6, chatarra: 4, fibra: 3 }, outputs: { ballesta: 1 }, research: 'ballesta' });
    expect(recipeDef('fabricar_lanza_metal')).toMatchObject({ station: 'banco_trabajo', inputs: { metal: 4, madera: 2 }, outputs: { lanza_metal: 1 }, research: 'forja' });
    expect(researchDef('ballesta')!.requires).toEqual([]);
    expect(researchDef('forja')!.requires).toEqual([]);
  });

  it('sin investigar no se encargan; investigada, sí, y el diario lo dice', () => {
    const w = flatWorld(1);
    w.structures.place(8, 8, 'banco_trabajo');
    const s = w.structures.at(8, 8)!;
    w.completeStructure(s);
    const bill = (id: string) => ({ recipe: recipeDef(id)!, target: 1, paused: false, mode: 'count' as const });
    expect(w.setStationBill(s, bill('fabricar_ballesta'))).toBe(false);
    expect(w.setStationBill(s, bill('fabricar_lanza_metal'))).toBe(false);
    w.colonists[0].skills.investigacion = 10;
    w.structures.place(4, 8, 'banco_investigacion');
    w.completeStructure(w.structures.at(4, 8)!);
    expect(w.setResearch('ballesta')).toBe(true);
    w.research.progress.ballesta = researchCost(researchDef('ballesta')!) * 0.98;
    for (let t = 0; t < TICKS_PER_HOUR * 3 && !w.research.done.includes('ballesta'); t++) w.step();
    expect(w.log.some((l) => l.text.includes('Ya se puede fabricar: Ballesta'))).toBe(true);
    expect(w.setStationBill(s, bill('fabricar_ballesta'))).toBe(true);
    expect(w.setStationBill(s, bill('fabricar_lanza_metal'))).toBe(false);
    w.research.done.push('forja');
    expect(w.setStationBill(s, bill('fabricar_lanza_metal'))).toBe(true);
  });

  it('con flechas, la ballesta vale más que el arco; la lanza de metal, más que la de madera', () => {
    expect(weaponScore('ballesta', true)).toBeGreaterThan(weaponScore('arco', true));
    expect(weaponScore('ballesta', false)).toBeLessThan(weaponScore('palo', true));
    expect(weaponScore('lanza_metal', true)).toBeGreaterThan(weaponScore('lanza', true));
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.weapon = 'arco';
    c.ammo = 20;
    w.items.drop(6, 5, 'ballesta', 1);
    for (let i = 0; i < 3000 && (c.weapon as string) !== 'ballesta'; i++) w.step();
    expect(c.weapon as string).toBe('ballesta');
    expect(c.ammo).toBeGreaterThan(0); // las flechas del arco le sirven
  });

  it('los saqueadores no las traen (el catálogo no lo dice)', () => {
    for (const d of [0, 15, 25, 60]) {
      expect(raiderWeaponPool(d)).not.toContain('ballesta');
      expect(raiderWeaponPool(d)).not.toContain('lanza_metal');
    }
  });

  it('se guardan', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.weapon = 'ballesta';
    c.weaponChoice = 'lanza_metal';
    c.ammo = 9;
    w.items.drop(3, 3, 'lanza_metal', 1);
    const back = loadWorld(serializeWorld(w));
    expect(back.colonists[0].weapon).toBe('ballesta');
    expect(back.colonists[0].weaponChoice).toBe('lanza_metal');
    expect(back.colonists[0].ammo).toBe(9);
    expect(back.items.at(3, 3)?.resource).toBe('lanza_metal');
  });
});
