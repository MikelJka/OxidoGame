import { describe, expect, it } from 'vitest';
import { World, TICKS_PER_DAY } from '../src/sim/world';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { callingRadio, radioHoursLeft, runStoryteller } from '../src/sim/people';
import { buildingDef } from '../src/data/buildings';

// #21 C: radio de llamada. Con corriente atrae a un superviviente más cada 3 días.
function setup(seed = 3) {
  const w = new World({ seed, width: 40, height: 40 });
  // Sin los sucesos normales para ver solo los de la radio.
  w.schedule.nextWanderer = w.schedule.nextRaid = w.schedule.nextTrader = Number.MAX_SAFE_INTEGER;
  return w;
}

function addRadio(w: World, powered: boolean) {
  const def = buildingDef('radio');
  for (let y = 5; y < 35; y++) {
    for (let x = 5; x < 35; x++) {
      if (!w.structures.canPlaceDef(def, x, y)) continue;
      const placed = w.structures.restore(def, x, y, true, {}, 1, def.hp);
      if (placed) {
        placed.powered = powered;
        return placed;
      }
    }
  }
  throw new Error('no se pudo colocar la radio');
}

/** Pasa `hours` horas de narrador. */
function hours(w: World, n: number) {
  for (let i = 0; i < n; i++) {
    w.tick += TICKS_PER_DAY / 24;
    runStoryteller(w);
  }
}

describe('radio de llamada (#21 C)', () => {
  it('cuesta 🔩20 ⚙️4, gasta 100 W y llama cada 3 días', () => {
    const d = buildingDef('radio');
    expect(d.cost).toEqual({ chatarra: 20, componentes: 4 });
    expect(d.power).toBe(-100);
    expect(d.callWanderers?.days).toBe(3);
  });

  it('sin radio no llega nadie más', () => {
    const w = setup();
    hours(w, 24 * 4);
    expect(w.offer).toBeNull();
    expect(radioHoursLeft(w)).toBeNull();
  });

  it('con corriente, a los 3 días llega un superviviente que la ha oído', () => {
    const w = setup();
    addRadio(w, true);
    expect(callingRadio(w)).toBeDefined();
    hours(w, 24 * 3 - 1);
    expect(w.offer).toBeNull();
    expect(radioHoursLeft(w)).toBe(1);
    hours(w, 1);
    expect(w.offer?.kind).toBe('superviviente');
    expect(w.log.some((l) => l.text.includes('radio'))).toBe(true);
    expect(w.schedule.radioHours).toBe(0);
  });

  it('sin corriente no cuenta', () => {
    const w = setup();
    const r = addRadio(w, false);
    hours(w, 24 * 4);
    expect(w.offer).toBeNull();
    expect(w.schedule.radioHours).toBe(0);
    r.powered = true;
    hours(w, 10);
    expect(w.schedule.radioHours).toBe(10);
  });

  it('si hay una oferta abierta, espera a que se resuelva', () => {
    const w = setup();
    addRadio(w, true);
    hours(w, 24 * 3 - 1);
    w.offer = { kind: 'superviviente', pawn: w.makePawn('colono'), until: Number.MAX_SAFE_INTEGER };
    hours(w, 5);
    expect(w.schedule.radioHours).toBeGreaterThanOrEqual(72);
    w.offer = null;
    hours(w, 1);
    expect(w.offer).not.toBeNull();
    expect(w.schedule.radioHours).toBe(0);
  });

  it('las horas de la radio se guardan; las partidas viejas empiezan en 0', () => {
    const w = setup();
    addRadio(w, true);
    hours(w, 20);
    const data = serializeWorld(w);
    expect(loadWorld(data).schedule.radioHours).toBe(20);
    const old = JSON.parse(JSON.stringify(data));
    delete old.schedule.radioHours;
    expect(loadWorld(old).schedule.radioHours).toBe(0);
  });
});
