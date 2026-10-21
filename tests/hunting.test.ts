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
