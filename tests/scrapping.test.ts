// «Desguace de máquinas» (bloque 13 del catálogo): las máquinas destruidas dejan el doble de ⚙️.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { makeCreature } from '../src/sim/people';
import { machinePartsMultiplier } from '../src/sim/research';
import type { CreatureId } from '../src/data/creatures';

type W = ReturnType<typeof flatWorld>;

/** Destruye una máquina en (5, 5) y cuenta lo que deja alrededor. */
function wreck(w: W, creature: CreatureId) {
  const c = w.makePawn('saqueador');
  makeCreature(w, c, creature, 1);
  c.tile = { x: 5, y: 5 };
  c.pos = { x: 5.5, y: 5.5 };
  w.others.push(c);
  w.killPawn(c, 'destrozada');
  const at = w.items.list().filter((i) => Math.abs(i.x - 5) <= 1 && Math.abs(i.y - 5) <= 1);
  const sum = (r: string) => at.filter((i) => i.resource === r).reduce((a, i) => a + i.amount, 0);
  return { scrap: sum('chatarra'), parts: sum('componentes') };
}

describe('Desguace de máquinas', () => {
  it('sin investigar, el multiplicador es 1; con «Desguace de máquinas», 2', () => {
    const w = flatWorld(1);
    expect(machinePartsMultiplier(w.research)).toBe(1);
    w.research.done.push('desguace');
    expect(machinePartsMultiplier(w.research)).toBe(2);
  });

  for (const creature of ['arana_chatarra', 'dron_vigilancia'] as CreatureId[]) {
    it(`${creature}: con la investigación deja el doble de ⚙️ y la misma 🔩`, () => {
      // Misma semilla con y sin investigar: misma tirada, así que el doble exacto.
      const before = wreck(flatWorld(3), creature);
      const w = flatWorld(3);
      w.research.done.push('desguace');
      const after = wreck(w, creature);
      expect(before.parts).toBeGreaterThanOrEqual(2);
      expect(before.parts).toBeLessThanOrEqual(4);
      expect(after.parts).toBe(before.parts * 2);
      expect(after.scrap).toBe(before.scrap);
    });
  }
});
