// Bloque 10 del catálogo: animales y caza.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { CREATURES } from '../src/data/creatures';
import { recipeDef } from '../src/data/recipes';
import { animalsOnMap, makeAnimal, spawnAnimals, toggleHunt, updateAnimal } from '../src/sim/animals';
import { attack } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/time';
import type { World } from '../src/sim/world';

function put(w: World, kind: Parameters<typeof makeAnimal>[1], x: number, y: number) {
  const a = makeAnimal(w, kind);
  a.tile = { x, y };
  a.pos = { x: x + 0.5, y: y + 0.5 };
  w.others.push(a);
  return a;
}

describe('animales y caza', () => {
  it('llegan cada día por los bordes, sin pasar de 8', () => {
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    for (let d = 0; d < 10; d++) {
      w.tick = d * TICKS_PER_DAY;
      spawnAnimals(w);
    }
    expect(animalsOnMap(w).length).toBe(8);
    expect(animalsOnMap(w).every((a) => CREATURES[a.creature!].animal)).toBe(true);
  });

  it('marcado, un cazador va a por él y deja carne y cuero', () => {
    const w = flatWorld(1);
    const [c] = w.colonists;
    c.weapon = 'rifle';
    c.weaponChoice = 'rifle';
    c.ammo = 50;
    c.skills.combate = 15;
    const a = put(w, 'ciervo_mutado', 20, 20);
    expect(toggleHunt(a)).toBe(true);
    expect(loadWorld(serializeWorld(w)).others.find((o) => o.id === a.id)?.huntMarked).toBe(true);
    let t = 0;
    for (; t < 20000 && w.others.includes(a); t++) w.step();
    expect(w.others.includes(a)).toBe(false);
    expect(w.inventory().carne).toBeGreaterThanOrEqual(8);
    expect(w.inventory().cuero).toBeGreaterThanOrEqual(3);
  });

  it('el jabalí herido ataca', () => {
    const w = flatWorld(1);
    const [c] = w.colonists;
    const b = put(w, 'jabali', 6, 5);
    c.skills.combate = 20;
    for (let k = 0; k < 20 && b.role === 'animal' && w.others.includes(b); k++) {
      c.attackCooldown = 0;
      attack(w, c, b);
    }
    expect(b.role).toBe('saqueador');
  });

  it('la rata gigante se come la comida que no está tras muros', () => {
    const w = flatWorld(0);
    w.items.drop(10, 10, 'patata', 20);
    const r = put(w, 'rata_gigante', 10, 10);
    updateAnimal(w, r, () => {});
    expect(w.inventory().patata).toBe(15);
  });

  it('carne asada en la cocina y el chaleco de cuero con cuero («Sastrería»)', () => {
    expect(recipeDef('carne_asada')!.inputs).toEqual({ carne: 4 });
    expect(recipeDef('fabricar_chaleco_cuero')!.inputs).toEqual({ cuero: 8 });
    expect(recipeDef('fabricar_chaleco_cuero')!.research).toBe('sastreria');
  });
});

describe('animales de carga', () => {
  it('al tocarlo: cazar → domar → nada', async () => {
    const { cycleAnimalMark } = await import('../src/sim/animals');
    const w = flatWorld(0);
    const a = put(w, 'ciervo_mutado', 10, 10);
    expect(cycleAnimalMark(a)).toBe('cazar');
    expect(cycleAnimalMark(a)).toBe('domar');
    expect(cycleAnimalMark(a)).toBeNull();
    const r = put(w, 'rata_gigante', 12, 12);
    expect(cycleAnimalMark(r)).toBe('cazar');
    expect(cycleAnimalMark(r)).toBeNull(); // las ratas no se doman
  });

  it('un colono con comida lo doma; luego come cada día y va en las expediciones (+30 kg la cabra)', async () => {
    const { packAnimals } = await import('../src/sim/animals');
    const { expeditionCapacity } = await import('../src/sim/expedition');
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    w.items.drop(4, 4, 'patata', 75);
    w.colonists[0].skills.supervivencia = 20;
    const a = put(w, 'cabra_salvaje', 12, 12);
    a.tameMarked = true;
    for (let t = 0; t < 30000 && !a.tamed; t++) {
      w.step();
      if (w.others.includes(a)) a.leaveAt = Infinity;
    }
    expect(a.tamed).toBe(true);
    expect(packAnimals(w)).toContain(a);
    expect(expeditionCapacity(w, 1, [], [a.id])).toBe(35 + 30);
    expect(loadWorld(serializeWorld(w)).others.find((o) => o.id === a.id)?.tamed).toBe(true);
    // Sin comida se escapa.
    for (const s of w.items.list()) w.items.take(s.x, s.y, s.amount);
    w.tick += 3 * TICKS_PER_DAY;
    w.tick -= w.tick % 450;
    w.step();
    for (let k = 0; k < 450; k++) w.step();
    expect(a.tamed).toBe(false);
  });

  it('cada animal se doma con más o menos dificultad y carga distinto', async () => {
    const { tameChance, animalCargo, tameDifficulty, CREATURES } = await import('../src/data/creatures');
    expect(tameDifficulty('cabra_salvaje')).toBe('fácil');
    expect(tameDifficulty('vaca_dos_cabezas')).toBe('media');
    expect(tameDifficulty('caballo_salvaje')).toBe('difícil');
    expect(tameDifficulty('jabali')).toBe('muy difícil');
    expect(tameChance('cabra_salvaje')).toBeGreaterThan(tameChance('ciervo_mutado'));
    expect(tameChance('ciervo_mutado')).toBeGreaterThan(tameChance('jabali'));
    expect(animalCargo('caballo_salvaje')).toBeGreaterThan(animalCargo('mula'));
    for (const d of Object.values(CREATURES)) if (d.tamable) expect(d.tame).toBeDefined();
    // Con la misma habilidad, la cabra se doma en menos intentos que el jabalí.
    const { tryTame } = await import('../src/sim/animals');
    const tries = (kind: 'cabra_salvaje' | 'jabali') => {
      const w = flatWorld(3);
      w.map.start = { x: 15, y: 15 };
      w.items.drop(4, 4, 'patata', 75);
      w.items.drop(5, 4, 'patata', 75);
      w.items.drop(6, 4, 'patata', 75);
      let n = 0;
      let total = 0;
      for (let k = 0; k < 20; k++) {
        const a = put(w, kind, 12, 12);
        n = 0;
        while (!a.tamed && n < 200) {
          n++;
          w.items.drop(4, 4, 'patata', 2);
          tryTame(w, w.colonists[0], a);
          if (a.role !== 'animal') break;
        }
        total += n;
      }
      return total;
    };
    expect(tries('cabra_salvaje')).toBeLessThan(tries('jabali'));
  });

  it('las caravanas de los Granjeros venden mulas', async () => {
    const { startTrader, makeDeal } = await import('../src/sim/people');
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    w.factions.splice(w.factions.findIndex((f) => f.id === 'chatarreros'), 1);
    w.items.drop(6, 6, 'componentes', 25);
    const t = startTrader(w)!;
    expect(t.faction).toBe('granjeros');
    expect(t.trader!.mules).toBeGreaterThanOrEqual(1);
    expect(makeDeal(w, t, { buy: {}, sell: { componentes: 10 }, slaves: [], sellPrisoners: [], mules: 1 })).toBeNull();
    expect(w.others.filter((o) => o.tamed && o.creature === 'mula').length).toBe(1);
  });
});
