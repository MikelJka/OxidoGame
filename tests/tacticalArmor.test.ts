import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { researchCost } from '../src/sim/research';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_HOUR } from '../src/sim/world';
import { walkSpeedMultiplier } from '../src/sim/colonist';
import { recipeDef } from '../src/data/recipes';
import { researchDef } from '../src/data/research';
import { ARMORS, armorProtection } from '../src/data/armor';

describe('chaleco y casco tácticos («Blindaje avanzado»)', () => {
  it('tienen los números del catálogo', () => {
    expect(ARMORS.chaleco_tactico).toMatchObject({ slot: 'chaleco', protection: 0.45, walk: 0.95 });
    expect(ARMORS.casco_tactico).toMatchObject({ slot: 'casco', protection: 0.2, walk: 1 });
    expect(recipeDef('fabricar_chaleco_tactico')).toMatchObject({ station: 'banco_trabajo', inputs: { metal: 10, componentes: 2, fibra: 6 }, outputs: { chaleco_tactico: 1 }, research: 'blindaje' });
    expect(recipeDef('fabricar_casco_tactico')).toMatchObject({ station: 'banco_trabajo', inputs: { metal: 6, componentes: 1 }, outputs: { casco_tactico: 1 }, research: 'blindaje' });
    expect(researchDef('blindaje')!.requires).toEqual(['armas_largas']);
    expect(armorProtection(['chaleco_tactico', 'casco_tactico'])).toBeCloseTo(0.65);
  });

  it('sin «Blindaje avanzado» no se encargan; investigado, sí, y el diario lo dice', () => {
    const w = flatWorld(1);
    w.structures.place(8, 8, 'banco_trabajo');
    const s = w.structures.at(8, 8)!;
    w.completeStructure(s);
    const bill = (id: string) => ({ recipe: recipeDef(id)!, target: 1, paused: false, mode: 'count' as const });
    w.research.done.push('polvora', 'armas_largas');
    expect(w.setStationBill(s, bill('fabricar_chaleco_tactico'))).toBe(false);
    expect(w.setStationBill(s, bill('fabricar_casco_tactico'))).toBe(false);
    w.colonists[0].skills.investigacion = 10;
    w.structures.place(4, 8, 'banco_investigacion');
    w.completeStructure(w.structures.at(4, 8)!);
    expect(w.setResearch('blindaje')).toBe(true);
    w.research.progress.blindaje = researchCost(researchDef('blindaje')!) * 0.98;
    for (let t = 0; t < TICKS_PER_HOUR * 3 && !w.research.done.includes('blindaje'); t++) w.step();
    expect(w.log.some((l) => l.text.includes('Ya se puede fabricar: Chaleco táctico, Casco táctico'))).toBe(true);
    expect(w.setStationBill(s, bill('fabricar_chaleco_tactico'))).toBe(true);
  });

  it('un colono los prefiere a los de metal, anda un 5 % más despacio y se guardan', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.vest = 'chaleco_metal';
    c.helmet = 'casco_metal';
    w.items.drop(8, 8, 'chaleco_tactico', 1);
    w.items.drop(6, 9, 'casco_tactico', 1);
    for (let i = 0; i < 4000 && !((c.vest as string) === 'chaleco_tactico' && (c.helmet as string) === 'casco_tactico'); i++) w.step();
    expect([c.vest, c.helmet]).toEqual(['chaleco_tactico', 'casco_tactico']);
    expect(walkSpeedMultiplier(c)).toBeCloseTo(0.95 * c.traits.reduce((m, t) => m * (t.walkSpeed ?? 1), 1));
    const l = loadWorld(serializeWorld(w)).colonists[0];
    expect([l.vest, l.helmet]).toEqual(['chaleco_tactico', 'casco_tactico']);
  });
});
