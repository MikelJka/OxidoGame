import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { RECIPES } from '../src/data/recipes';
import { GRENADE, isGear } from '../src/data/weapons';
import { buildingDef } from '../src/data/buildings';
import { addResearch, chooseResearch } from '../src/sim/research';
import { BLAST_TICKS, grenadeTarget, tryThrowGrenade, updateGrenades } from '../src/sim/grenades';
import { dropGear, startRaid } from '../src/sim/people';
import { TICKS_PER_DAY } from '../src/sim/time';
import { loadWorld, serializeWorld } from '../src/sim/save';
import type { World } from '../src/sim/world';
import type { Colonist } from '../src/sim/colonist';

function raider(w: World, x: number, y: number): Colonist {
  const r = w.makePawn('saqueador');
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  w.others.push(r);
  return r;
}

function place(c: Colonist, x: number, y: number): void {
  c.tile = { x, y };
  c.pos = { x: x + 0.5, y: y + 0.5 };
  c.path = [];
}

/** Avanza las granadas hasta que estallen. */
function fuse(w: World): void {
  for (let i = 0; i <= GRENADE.fuseTicks; i++) {
    w.tick++;
    updateGrenades(w);
  }
}

describe('granadas caseras', () => {
  it('se fabrican en el banco (🔩2 ⚙️1 → 2) tras investigar «Explosivos»', () => {
    const r = RECIPES.find((k) => k.id === 'fabricar_granadas')!;
    expect(r.station).toBe('banco_trabajo');
    expect(r.inputs).toEqual({ chatarra: 2, componentes: 1 });
    expect(r.outputs).toEqual({ granadas: 2 });
    expect(r.research).toBe('explosivos');
    const w = flatWorld(0);
    expect(w.canCraft(r)).toBe(false);
    w.research.done.push('polvora', 'armas_largas');
    chooseResearch(w.research, 'explosivos');
    addResearch(w.research, 1e9);
    expect(w.canCraft(r)).toBe(true);
    // Van al armero, como las armas y la munición.
    expect(isGear('granadas')).toBe(true);
  });

  it('cada colono coge 2 del almacén, aparte de su arma', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    place(c, 10, 10);
    w.items.drop(12, 10, 'granadas', 5);
    expect(w.wantedGear(c)).toBe('granadas');
    for (let i = 0; i < 3000 && (c.grenades ?? 0) < 2; i++) w.step();
    expect(c.grenades).toBe(2);
    expect(w.items.at(12, 10)?.amount).toBe(3);
    expect(w.wantedGear(c)).toBeNull();
    // Desarmado del todo: las suelta.
    w.setWeaponChoice(c, 'ninguna');
    expect(c.grenades).toBe(0);
    expect(w.wantedGear(c)).toBeNull();
  });

  it('solo apunta a un 3×3 con 2 o más enemigos, a 6 casillas o menos y sin colonos', () => {
    const w = flatWorld(2);
    const [c, mate] = w.colonists;
    place(c, 10, 10);
    place(mate, 30, 30);
    const a = raider(w, 15, 10);
    expect(grenadeTarget(w, c)).toBeNull(); // uno solo
    raider(w, 16, 11);
    expect(grenadeTarget(w, c)).not.toBeNull();
    // Un colono pegado a los enemigos: no.
    place(mate, 16, 10);
    expect(grenadeTarget(w, c)).toBeNull();
    place(mate, 30, 30);
    // Más lejos de 6 casillas: no.
    place(c, 5, 10);
    expect(grenadeTarget(w, c)).toBeNull();
    place(c, 10, 10);
    // Caídos o huyendo no cuentan.
    a.downed = true;
    expect(grenadeTarget(w, c)).toBeNull();
  });

  it('estalla al rato: ×3 a todos los del 3×3, también a un colono que entra en el último momento', () => {
    const w = flatWorld(2);
    const [c, mate] = w.colonists;
    place(c, 10, 10);
    place(mate, 30, 30);
    const a = raider(w, 15, 10);
    const b = raider(w, 15, 11);
    const far = raider(w, 18, 10);
    c.grenades = 2;
    expect(tryThrowGrenade(w, c)).toBe(true);
    expect(c.grenades).toBe(1);
    expect(w.grenades).toHaveLength(1);
    // No lanza otra hasta pasados 10 s.
    expect(tryThrowGrenade(w, c)).toBe(false);
    // Aún no ha estallado.
    expect(a.health).toBe(1);
    place(mate, 14, 10);
    fuse(w);
    expect(w.grenades).toHaveLength(0);
    expect(w.blasts).toHaveLength(1);
    expect(a.health).toBeLessThan(0.7);
    expect(b.health).toBeLessThan(0.7);
    expect(mate.health).toBeLessThan(0.7);
    expect(far.health).toBe(1);
    expect(c.health).toBe(1);
    // El fogonazo se apaga.
    for (let i = 0; i <= BLAST_TICKS + 1; i++) {
      w.tick++;
      updateGrenades(w);
    }
    expect(w.blasts).toHaveLength(0);
  });

  it('en combate, el colono la lanza solo y luego espera 10 s para la siguiente', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    place(c, 10, 10);
    c.drafted = true;
    c.stance = 'mantener';
    c.grenades = 2;
    raider(w, 14, 10);
    raider(w, 14, 11);
    for (let i = 0; i < 5; i++) w.step();
    expect(c.grenades).toBe(1);
    expect(c.grenadeReadyAt).toBeGreaterThan(w.tick);
  });

  it('dañan un poco muros y puertas', () => {
    const w = flatWorld(0);
    expect(w.structures.place(15, 10, 'muro_madera')).toBe(true);
    const s = w.structures.at(15, 10)!;
    w.completeStructure(s);
    const hp = s.hp;
    w.grenades.push({ from: { x: 10, y: 10 }, to: { x: 15, y: 11 }, thrownAt: w.tick, explodeAt: w.tick + 1, by: 'Prueba' });
    fuse(w);
    expect(s.hp).toBe(hp - Math.max(1, Math.round(buildingDef('muro_madera').hp * GRENADE.structureDamage)));
  });

  it('se guardan las que lleva cada colono y las que están en el aire; al caer, las suelta', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    place(c, 10, 10);
    c.grenades = 2;
    raider(w, 14, 10);
    raider(w, 14, 11);
    expect(tryThrowGrenade(w, c)).toBe(true);
    const back = loadWorld(serializeWorld(w));
    expect(back.colonists[0].grenades).toBe(1);
    expect(back.colonists[0].grenadeReadyAt).toBe(c.grenadeReadyAt);
    expect(back.grenades).toEqual(w.grenades);
    const bc = back.colonists[0];
    dropGear(back, bc);
    expect(bc.grenades).toBe(0);
    expect(back.items.at(10, 10)?.resource).toBe('granadas');
  });

  it('los saqueadores traen alguna desde el día 30 (1 cada uno, no todos)', () => {
    const w = flatWorld(1);
    const count = () => {
      let with1 = 0;
      let total = 0;
      for (let i = 0; i < 12; i++) {
        for (const r of startRaid(w, 3, false)) {
          total++;
          if ((r.grenades ?? 0) > 0) {
            expect(r.grenades).toBe(GRENADE.raiderCarry);
            with1++;
          }
        }
        w.others.splice(0);
      }
      return { with1, total };
    };
    w.tick = (GRENADE.raiderFromDay - 2) * TICKS_PER_DAY;
    expect(w.day).toBeLessThan(GRENADE.raiderFromDay);
    expect(count().with1).toBe(0);
    w.tick = GRENADE.raiderFromDay * TICKS_PER_DAY;
    expect(w.day).toBeGreaterThanOrEqual(GRENADE.raiderFromDay);
    const { with1, total } = count();
    expect(total).toBeGreaterThan(20);
    expect(with1).toBeGreaterThan(0);
    expect(with1).toBeLessThan(total);
  });

  it('un saqueador la lanza a 2 colonos juntos, nunca si hay otro saqueador en pie en el 3×3', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    place(a, 15, 10);
    place(b, 15, 11);
    const r = raider(w, 10, 10);
    r.grenades = 1;
    expect(grenadeTarget(w, r)).not.toBeNull();
    // Un compañero suyo en pie junto a los colonos: no.
    const mate = raider(w, 16, 10);
    expect(grenadeTarget(w, r)).toBeNull();
    // Caído, ya no le importa.
    mate.downed = true;
    expect(grenadeTarget(w, r)).not.toBeNull();
    // Un colono caído no cuenta como objetivo.
    b.downed = true;
    expect(grenadeTarget(w, r)).toBeNull();
    b.downed = false;
    expect(tryThrowGrenade(w, r)).toBe(true);
    expect(r.grenades).toBe(0);
    expect(w.grenades[0].foe).toBe(true);
    const back = loadWorld(serializeWorld(w));
    expect(back.grenades[0].foe).toBe(true);
    fuse(w);
    expect(a.health).toBeLessThan(1);
    expect(b.health).toBeLessThan(1);
    expect(r.health).toBe(1);
  });

  it('en el raid, el saqueador con granada la lanza solo', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    place(a, 15, 10);
    place(b, 15, 11);
    a.drafted = b.drafted = true;
    a.stance = b.stance = 'mantener';
    const r = raider(w, 10, 10);
    r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
    r.weapon = null;
    r.grenades = 1;
    for (let i = 0; i < 5 && w.grenades.length === 0; i++) w.step();
    expect(r.grenades).toBe(0);
    expect(w.grenades).toHaveLength(1);
  });
});
