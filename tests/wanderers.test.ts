import { describe, expect, it } from 'vitest';
import { World, TICKS_PER_DAY } from '../src/sim/world';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { runStoryteller } from '../src/sim/people';
import { FIRST_WANDERER_DAY, WANDERER_GAP } from '../src/sim/storyteller';

// #21 A: más supervivientes. El primero puede llegar el día 2 y luego uno cada 2-4 días.
describe('supervivientes (#21 A)', () => {
  it('el primero llega el día 2 y luego uno cada 2-4 días', () => {
    expect(FIRST_WANDERER_DAY).toBe(2);
    expect(WANDERER_GAP).toEqual([2, 4]);
    const w = new World({ seed: 11, width: 40, height: 40 });
    expect(w.schedule.nextWanderer).toBe(2 * TICKS_PER_DAY);
  });

  it('al llegar uno, el siguiente se programa entre 2 y 4 días después', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const w = new World({ seed, width: 40, height: 40 });
      w.tick = w.schedule.nextWanderer;
      w.schedule.nextRaid = w.schedule.nextTrader = Number.MAX_SAFE_INTEGER;
      runStoryteller(w);
      expect(w.offer?.kind).toBe('superviviente');
      const gap = w.schedule.nextWanderer - w.tick;
      expect(gap).toBeGreaterThanOrEqual(2 * TICKS_PER_DAY);
      expect(gap).toBeLessThanOrEqual(4 * TICKS_PER_DAY);
    }
  });

  it('en una partida guardada con la espera antigua, el próximo no tarda más de 4 días', () => {
    const w = new World({ seed: 7, width: 40, height: 40 });
    w.tick = 3 * TICKS_PER_DAY;
    w.schedule.nextWanderer = w.tick + 8 * TICKS_PER_DAY;
    const back = loadWorld(serializeWorld(w));
    expect(back.schedule.nextWanderer).toBe(w.tick + 4 * TICKS_PER_DAY);
    // Si ya tocaba antes, se respeta.
    w.schedule.nextWanderer = w.tick + TICKS_PER_DAY;
    expect(loadWorld(serializeWorld(w)).schedule.nextWanderer).toBe(w.tick + TICKS_PER_DAY);
  });
});
