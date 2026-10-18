import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { World, TICKS_PER_DAY } from '../src/sim/world';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { attack, startRaid } from '../src/sim/people';
import { DIFFICULTIES, makeDifficulty, MAX_GRACE_DAYS, raidGap, raidSize, scaledSupplies } from '../src/sim/storyteller';
import { STARTING_SUPPLIES } from '../src/data/resources';

describe('dificultad', () => {
  it('por defecto es Normal con 5 días sin raids, y normaliza valores raros', () => {
    expect(makeDifficulty()).toEqual({ level: 'normal', graceDays: 5 });
    expect(makeDifficulty({ level: 'brutal' })).toEqual({ level: 'brutal', graceDays: DIFFICULTIES.brutal.graceDays });
    expect(makeDifficulty({ level: 'toString', graceDays: -3 })).toEqual({ level: 'normal', graceDays: 0 });
    expect(makeDifficulty({ level: 'dura', graceDays: 99 }).graceDays).toBe(MAX_GRACE_DAYS);
  });

  it('los días sin raids retrasan el primer raid', () => {
    const w = new World({ seed: 3, width: 40, height: 40, difficulty: { level: 'normal', graceDays: 12 } });
    expect(w.schedule.nextRaid).toBe(12 * TICKS_PER_DAY);
    const w0 = new World({ seed: 3, width: 40, height: 40, difficulty: { level: 'normal', graceDays: 0 } });
    expect(w0.schedule.nextRaid).toBe(0);
  });

  it('la dureza cambia el tamaño de los raids y los días entre ellos', () => {
    expect(raidSize(30, 6000, 4, DIFFICULTIES.brutal.raidScale)).toBeGreaterThan(raidSize(30, 6000, 4));
    expect(raidSize(30, 6000, 4, DIFFICULTIES.tranquila.raidScale)).toBeLessThan(raidSize(30, 6000, 4));
    expect(raidSize(1, 0, 1, 0.6)).toBe(1);
    expect(raidGap('tranquila')[0]).toBeGreaterThan(raidGap('brutal')[0]);
    expect(raidGap('normal')).toEqual([3, 6]);
  });

  it('las provisiones iniciales dependen de la dureza', () => {
    const easy = scaledSupplies(STARTING_SUPPLIES, 'tranquila');
    const hard = scaledSupplies(STARTING_SUPPLIES, 'brutal');
    expect(easy.patata).toBeGreaterThan(STARTING_SUPPLIES.patata!);
    expect(hard.patata).toBeLessThan(STARTING_SUPPLIES.patata!);
    const total = (w: World) => w.inventory().patata;
    const a = new World({ seed: 5, width: 60, height: 60, difficulty: { level: 'tranquila' } });
    const b = new World({ seed: 5, width: 60, height: 60, difficulty: { level: 'brutal' } });
    expect(total(a)).toBeGreaterThan(total(b));
  });

  it('se empieza con el doble de comida que antes en cada dureza (#13)', () => {
    // Antes eran 60 patatas en Normal (90 / 60 / 45 / 30 según la dureza).
    const before: Record<string, number> = { tranquila: 90, normal: 60, dura: 45, brutal: 30 };
    for (const level of ['tranquila', 'normal', 'dura', 'brutal'] as const) {
      expect(scaledSupplies(STARTING_SUPPLIES, level).patata, level).toBe(before[level] * 2);
      const w = new World({ seed: 7, width: 60, height: 60, difficulty: { level } });
      expect(w.inventory().patata, level).toBe(before[level] * 2);
    }
  });

  it('en Brutal los saqueadores pegan más fuerte', () => {
    const avg = (level: 'tranquila' | 'brutal') => {
      const w = flatWorld(1);
      w.difficulty = makeDifficulty({ level });
      const c = w.colonists[0];
      const [r] = startRaid(w, 1);
      r.skills.combate = 20; // acierta casi siempre
      let lost = 0;
      for (let i = 0; i < 40; i++) {
        const before = c.health;
        attack(w, r, c);
        lost += before - c.health;
        c.health = 1;
        c.wounds = [];
        c.downed = false;
      }
      return lost;
    };
    expect(avg('brutal')).toBeGreaterThan(avg('tranquila'));
  });

  it('se guarda con la partida; las antiguas cargan en Normal', () => {
    const w = flatWorld(1);
    w.difficulty = { level: 'dura', graceDays: 9 };
    const loaded = loadWorld(JSON.stringify(serializeWorld(w)));
    expect(loaded.difficulty).toEqual({ level: 'dura', graceDays: 9 });
    const old = serializeWorld(w) as unknown as Record<string, unknown>;
    delete old.difficulty;
    expect(loadWorld(JSON.stringify(old)).difficulty).toEqual({ level: 'normal', graceDays: 5 });
  });
});
