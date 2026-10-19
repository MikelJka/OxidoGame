import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { attack, dropGear, startRaid } from '../src/sim/people';
import { researchCost } from '../src/sim/research';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/world';
import { recipeDef } from '../src/data/recipes';
import { researchDef } from '../src/data/research';
import { raiderWeaponPool, WEAPONS } from '../src/data/weapons';

function workbench(w: ReturnType<typeof flatWorld>, x = 8, y = 8) {
  w.structures.place(x, y, 'banco_trabajo');
  const s = w.structures.at(x, y)!;
  w.completeStructure(s);
  return s;
}

describe('pistola casera y balas (Pólvora)', () => {
  it('tienen los números del catálogo', () => {
    expect(WEAPONS.pistola).toMatchObject({ damage: 2.2, cooldown: 1, reach: 9, ammo: 'balas', firearm: true });
    expect(recipeDef('fabricar_pistola')).toMatchObject({ inputs: { chatarra: 8, componentes: 1 }, outputs: { pistola: 1 }, research: 'polvora' });
    expect(recipeDef('fabricar_balas')).toMatchObject({ inputs: { chatarra: 3, componentes: 1 }, outputs: { balas: 15 }, research: 'polvora' });
  });

  it('sin «Pólvora» no se encargan en el banco de trabajo; investigada, sí', () => {
    const w = flatWorld(1);
    const s = workbench(w);
    const bill = (id: string) => ({ recipe: recipeDef(id)!, target: 1, paused: false, mode: 'count' as const });
    expect(w.setStationBill(s, bill('fabricar_pistola'))).toBe(false);
    expect(s.bill).toBeFalsy();
    // Lo de siempre sigue libre.
    expect(w.setStationBill(s, bill('fabricar_flechas'))).toBe(true);
    w.research.done.push('polvora');
    expect(w.setStationBill(s, bill('fabricar_balas'))).toBe(true);
    expect(s.bill?.recipe.id).toBe('fabricar_balas');
    expect(w.setStationBill(s, null)).toBe(true);
    expect(s.bill).toBeFalsy();
  });

  it('al terminar «Pólvora» el diario dice que ya se fabrican', () => {
    const w = flatWorld(1);
    w.colonists[0].skills.investigacion = 10;
    w.structures.place(4, 8, 'banco_investigacion');
    w.completeStructure(w.structures.at(4, 8)!);
    expect(w.setResearch('polvora')).toBe(true);
    w.research.progress.polvora = researchCost(researchDef('polvora')!) * 0.98;
    for (let t = 0; t < TICKS_PER_HOUR * 3 && !w.research.done.includes('polvora'); t++) w.step();
    expect(w.log.some((l) => l.text.includes('Ya se puede fabricar: Pistola casera, Balas (15)'))).toBe(true);
  });

  it('un colono cambia el machete por la pistola si hay balas, y coge balas (no flechas)', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.weapon = 'machete';
    w.items.drop(6, 5, 'pistola', 1);
    w.items.drop(9, 9, 'flechas', 30);
    // Sin balas no le compensa.
    for (let i = 0; i < 600; i++) w.step();
    expect(c.weapon).toBe('machete');
    w.items.drop(7, 5, 'balas', 30);
    for (let i = 0; i < 3000 && !((c.weapon as string) === 'pistola' && c.ammo > 0); i++) w.step();
    expect(c.weapon as string).toBe('pistola');
    expect(c.ammo).toBe(20);
    expect(w.items.totals().balas).toBe(10);
    expect(w.items.totals().flechas).toBe(30);
    expect(w.items.totals().machete).toBe(1);
  });

  it('al cambiar el arco por la pistola deja las flechas', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.weapon = 'arco';
    c.ammo = 12;
    w.items.drop(6, 5, 'pistola', 1);
    w.items.drop(7, 5, 'balas', 30);
    for (let i = 0; i < 3000 && !((c.weapon as string) === 'pistola' && c.ammo > 0); i++) w.step();
    expect(c.weapon as string).toBe('pistola');
    expect(w.items.totals().flechas).toBe(12);
    expect(c.ammo).toBe(20);
  });

  it('cada disparo gasta una bala; sin balas pelea con los puños', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    a.weapon = 'pistola';
    a.ammo = 2;
    b.tile = { x: a.tile.x + 5, y: a.tile.y };
    b.pos = { x: b.tile.x + 0.5, y: b.tile.y + 0.5 };
    attack(w, a, b);
    attack(w, a, b);
    expect(a.ammo).toBe(0);
    b.health = 1;
    attack(w, a, b);
    expect(a.ammo).toBe(0);
  });

  it('desde el día 15 los saqueadores traen pistolas con balas y al caer las sueltan', () => {
    expect(raiderWeaponPool(14)).not.toContain('pistola');
    expect(raiderWeaponPool(15)).toContain('pistola');
    const w = flatWorld(1);
    w.tick = 15 * TICKS_PER_DAY;
    let gunner = null;
    for (let i = 0; i < 20 && !gunner; i++) gunner = startRaid(w, 6).find((r) => r.weapon === 'pistola') ?? null;
    expect(gunner).not.toBeNull();
    expect(gunner!.ammo).toBe(15);
    const at = { ...gunner!.tile };
    dropGear(w, gunner!);
    expect(w.items.at(at.x, at.y)).toBeTruthy();
    expect(w.items.totals().pistola).toBeGreaterThanOrEqual(1);
    expect(w.items.totals().balas).toBeGreaterThanOrEqual(15);
  });

  it('la pistola y las balas que lleva se guardan', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.weapon = 'pistola';
    c.ammo = 7;
    const back = loadWorld(serializeWorld(w)).colonists[0];
    expect(back.weapon).toBe('pistola');
    expect(back.ammo).toBe(7);
  });
});
