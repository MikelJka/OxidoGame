// Criterio de «terminado» de la fase 4: una partida en la que se puede morir de hambre,
// de sed o por un raid.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { startRaid } from '../src/sim/people';
import { TICKS_PER_DAY } from '../src/sim/world';

function runUntilOver(w: ReturnType<typeof flatWorld>, days: number): void {
  for (let i = 0; i < TICKS_PER_DAY * days && !w.gameOver; i++) w.step();
}

describe('criterio de la fase 4', () => {
  it('con agua pero sin comida, el colono muere de hambre', () => {
    const w = flatWorld(1, { needs: true });
    w.colonists[0].needs.food = 0;
    runUntilOver(w, 6);
    expect(w.gameOver?.cause).toBe('hambre');
  });

  it('con comida pero sin agua, el colono muere de sed', () => {
    const w = flatWorld(1, { needs: true });
    w.map.terrain[1 * w.map.width + 1] = w.map.terrain[0]; // sin la charca
    w.items.dropAll(6, 5, { patata: 60 });
    w.colonists[0].needs.water = 0;
    runUntilOver(w, 6);
    expect(w.gameOver?.cause).toBe('sed');
  });

  it('un raid fuerte acaba con un colono solo', () => {
    const w = flatWorld(1);
    w.colonists[0].skills.combate = 0;
    const raid = startRaid(w, 6);
    raid.forEach((r) => (r.skills.combate = 20));
    runUntilOver(w, 4);
    expect(w.gameOver).not.toBeNull();
    expect(w.graveyard[0].cause).not.toMatch(/hambre|sed/);
  });
});
