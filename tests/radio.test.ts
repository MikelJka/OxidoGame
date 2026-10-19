// #21 C: radio de llamada (elegida por Mikel el 2026-10-19).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { runStoryteller } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_HOUR, TICKS_PER_SECOND } from '../src/sim/world';

type W = ReturnType<typeof flatWorld>;

function withRadio(): { w: W; radio: NonNullable<ReturnType<W['structures']['mainAt']>> } {
  const w = flatWorld(1);
  expect(w.structures.place(12, 12, 'radio')).toBe(true);
  const radio = w.structures.mainAt(12, 12)!;
  w.completeStructure(radio);
  const far = Number.MAX_SAFE_INTEGER;
  w.schedule.nextWanderer = w.schedule.nextRaid = w.schedule.nextTrader = far;
  return { w, radio };
}

/** Avanza el narrador hora a hora durante `days` días (sin mover el resto de la partida). */
function hours(w: W, days: number, each?: () => void): void {
  for (let h = 0; h < days * 24; h++) {
    w.tick += TICKS_PER_HOUR;
    runStoryteller(w);
    each?.();
  }
}

describe('radio de llamada', () => {
  it('cuesta 🔩20 ⚙️4 y gasta 100 W', () => {
    const d = buildingDef('radio');
    expect(d.cost).toEqual({ chatarra: 20, componentes: 4 });
    expect(d.power).toBe(-100);
  });

  it('con corriente, atrae un superviviente cada 3 días', () => {
    const { w, radio } = withRadio();
    radio.powered = true;
    expect(w.radioOn()).toBe(true);
    let offers = 0;
    hours(w, 9.1, () => {
      if (w.offer) {
        offers++;
        w.rejectOffer();
      }
    });
    expect(offers).toBe(3);
    expect(w.log.some((e) => e.text.includes('ha oído la 📻 radio'))).toBe(true);
  });

  it('sin corriente no atrae a nadie y el plazo vuelve a empezar', () => {
    const { w, radio } = withRadio();
    radio.powered = false;
    expect(w.radioOn()).toBe(false);
    hours(w, 6);
    expect(w.offer).toBeNull();
    radio.powered = true;
    hours(w, 2);
    radio.powered = false;
    hours(w, 0.5);
    expect(w.schedule.nextRadio).toBeUndefined();
    radio.powered = true;
    hours(w, 2.9);
    expect(w.offer).toBeNull();
    hours(w, 0.2);
    expect(w.offer?.kind).toBe('superviviente');
  });

  it('se enciende de verdad con un generador y el plazo se guarda con la partida', () => {
    const { w, radio } = withRadio();
    const gen = w.structures.place(9, 12, 'generador_lena') && w.structures.mainAt(9, 12)!;
    w.completeStructure(gen as never);
    (gen as { fuel?: number }).fuel = 5;
    for (const x of [11]) {
      w.structures.place(x, 12, 'cable');
      w.completeStructure(w.structures.cableAt(x, 12)!);
    }
    for (let i = 0; i < TICKS_PER_SECOND; i++) w.step();
    expect(radio.powered).toBe(true);
    runStoryteller(w);
    expect(w.schedule.nextRadio).toBe(w.tick + 3 * TICKS_PER_DAY);
    expect(loadWorld(serializeWorld(w)).schedule.nextRadio).toBe(w.schedule.nextRadio);
  });
});
