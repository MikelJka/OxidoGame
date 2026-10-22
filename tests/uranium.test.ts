import { describe, expect, it } from 'vitest';
import { TOXIC_BARREL, RADIATION_LEAK } from '../src/data/radiation';
import { checkWorld } from '../src/sim/diagnostics';
import { canDesignate } from '../src/sim/designations';
import { fertilityAt } from '../src/sim/farming';
import { generateMap, index, Prop, RADIATION_THRESHOLD } from '../src/sim/map';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_SECOND } from '../src/sim/world';
import { flatWorld } from './helpers';

/** Partida llana sin radiación y con un barril tóxico en (12, 12). */
function barrelWorld() {
  const w = flatWorld(1);
  w.map.radiation.fill(0.2);
  const i = index(w.map, 12, 12);
  w.map.props[i] = Prop.ToxicBarrel;
  w.map.stock[i] = TOXIC_BARREL.uranium[0];
  return { w, i };
}

function seconds(w: ReturnType<typeof flatWorld>, n: number): void {
  for (let k = 0; k < n * TICKS_PER_SECOND; k++) w.step();
}

describe('barriles tóxicos y ☢ uranio', () => {
  it('el barril se saquea y da entre 1 y 2 de ☢', () => {
    const { w } = barrelWorld();
    expect(canDesignate(w.map, 12, 12, 'saquear')).toBe(true);
    const gains = w.harvest(12, 12)!;
    expect(gains.uranio).toBeGreaterThanOrEqual(TOXIC_BARREL.uranium[0]);
    expect(gains.uranio).toBeLessThanOrEqual(TOXIC_BARREL.uranium[1]);
    expect(w.inventory().uranio).toBe(gains.uranio);
    expect(checkWorld(w)).toEqual([]);
  });

  it('la casilla queda irradiada unos días con un charco, y luego vuelve a como estaba', () => {
    const { w, i } = barrelWorld();
    const fertBefore = fertilityAt(w.map, 12, 12);
    w.tick -= w.tick % TICKS_PER_SECOND;
    w.harvest(12, 12);
    expect(w.map.props[i]).toBe(Prop.GlowPuddle);
    expect(w.map.radiation[i]).toBeGreaterThan(RADIATION_THRESHOLD);
    expect(fertilityAt(w.map, 12, 12)).toBeCloseTo(fertBefore * 0.5);
    expect(w.radiationLeaks).toHaveLength(1);
    // Justo antes de acabar sigue irradiada.
    const until = w.radiationLeaks[0].until;
    expect(until - w.tick).toBe(Math.round(RADIATION_LEAK.days * TICKS_PER_DAY));
    w.tick = until - TICKS_PER_SECOND * 2;
    w.tick -= w.tick % TICKS_PER_SECOND;
    seconds(w, 1);
    expect(w.map.radiation[i]).toBeGreaterThan(RADIATION_THRESHOLD);
    seconds(w, 2);
    expect(w.radiationLeaks).toHaveLength(0);
    expect(w.map.radiation[i]).toBeCloseTo(0.2);
    expect(w.map.props[i]).toBe(Prop.None);
  });

  it('se guarda en la partida; en las viejas los barriles traen su ☢', () => {
    const { w, i } = barrelWorld();
    const j = index(w.map, 20, 20);
    w.map.props[j] = Prop.ToxicBarrel;
    w.harvest(12, 12);
    const saved = serializeWorld(w);
    const back = loadWorld(saved);
    expect(back.radiationLeaks).toEqual(w.radiationLeaks);
    expect(back.map.radiation[i]).toBeCloseTo(w.map.radiation[i]);
    // Una partida de antes: sin fugas, y los barriles (que tenían 0) se pueden saquear.
    const old = JSON.parse(JSON.stringify(saved));
    delete old.radiationLeaks;
    const oldBack = loadWorld(old);
    expect(oldBack.radiationLeaks).toEqual([]);
    expect(oldBack.map.stock[j]).toBe(TOXIC_BARREL.uranium[0]);
    expect(canDesignate(oldBack.map, 20, 20, 'saquear')).toBe(true);
  });

  it('los mapas nuevos traen barriles con ☢ y la misma semilla da el mismo mapa', () => {
    const a = generateMap({ width: 80, height: 80, seed: 5 });
    const b = generateMap({ width: 80, height: 80, seed: 5 });
    expect(a.stock).toEqual(b.stock);
    for (let k = 0; k < a.props.length; k++) if (a.props[k] === Prop.ToxicBarrel) expect(a.stock[k]).toBe(TOXIC_BARREL.uranium[0]);
  });
});
