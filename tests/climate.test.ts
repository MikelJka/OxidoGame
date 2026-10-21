// Temperatura, calefactores y aires acondicionados (pedido por Mikel el 2026-10-21).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { CLIMATE, outdoorTemp, setTarget, targetOf, tileTemp, updateClimate, updateHeat } from '../src/sim/climate';
import { updateCold } from '../src/sim/seasons';
import { powerOf } from '../src/sim/power';
import { moodOf } from '../src/sim/needs';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/time';
import type { World } from '../src/sim/world';

/** Pone el reloj en un día y una hora (la partida empieza a las 7:00). */
function at(w: World, day: number, hour: number): void {
  w.tick = (day - 1) * TICKS_PER_DAY + (hour - 7) * TICKS_PER_HOUR;
}

/** Habitación cerrada con tejado de 3×3 por dentro (de 11,11 a 13,13), con un aparato en 11,11. */
function roomWith(w: World, id: string) {
  for (let x = 10; x <= 14; x++) for (let y = 10; y <= 14; y++) {
    if (x !== 10 && x !== 14 && y !== 10 && y !== 14) continue;
    w.structures.place(x, y, x === 12 && y === 14 ? 'puerta_madera' : 'muro_madera');
    w.completeStructure(w.structures.at(x, y)!);
  }
  for (let x = 11; x <= 13; x++) for (let y = 11; y <= 13; y++) w.roofs.add(y * w.map.width + x);
  w.structures.place(11, 11, id);
  const s = w.structures.at(11, 11)!;
  w.completeStructure(s);
  return s;
}

describe('temperatura', () => {
  it('fuera hace más calor en verano por la tarde que en invierno de madrugada, y la ola de frío hiela', () => {
    const w = flatWorld(0);
    at(w, 15, 15);
    const summer = outdoorTemp(w);
    at(w, 35, 4);
    const winter = outdoorTemp(w);
    expect(summer).toBeGreaterThan(28);
    expect(winter).toBeLessThan(2);
    at(w, 15, 15);
    w.weather.push({ id: 'ola_frio', until: w.tick + 10 * TICKS_PER_HOUR });
    expect(outdoorTemp(w)).toBeLessThanOrEqual(CLIMATE.coldWaveMax);
  });

  it('un calefactor con corriente calienta la habitación hasta lo elegido y quien está dentro no pasa frío', () => {
    const w = flatWorld(1, { needs: true });
    const heater = roomWith(w, 'calefactor');
    at(w, 35, 2); // invierno, de noche
    expect(targetOf(heater)).toBe(CLIMATE.target.default);
    updateClimate(w);
    expect(heater.climateOn).toBe(true);
    expect(powerOf(heater)).toBeLessThan(0); // trabajando, pide corriente
    heater.powered = true;
    updateClimate(w);
    expect(tileTemp(w, 12, 12)).toBeCloseTo(21, 5);
    const [c] = w.colonists;
    c.tile = { x: 12, y: 12 };
    updateCold(w, 30);
    expect(c.needs.cold).toBeUndefined();
    // Sin corriente no calienta: dentro se pasa frío.
    heater.powered = false;
    updateClimate(w);
    updateCold(w, 30);
    expect(c.needs.cold).toBe(true);
  });

  it('en reposo no gasta corriente', () => {
    const w = flatWorld(1);
    const heater = roomWith(w, 'calefactor');
    at(w, 15, 15); // verano por la tarde: ya hace más de 21 °C
    updateClimate(w);
    expect(heater.climateOn).toBeUndefined();
    expect(powerOf(heater)).toBe(0);
  });

  it('el aire acondicionado enfría en verano y se deja de pasar calor', () => {
    const w = flatWorld(1, { needs: true });
    const ac = roomWith(w, 'aire_acondicionado');
    at(w, 15, 15);
    const [c] = w.colonists;
    c.tile = { x: 12, y: 12 };
    // Sin corriente: calor.
    updateClimate(w);
    updateHeat(w, 30);
    expect(tileTemp(w, 12, 12)).toBeGreaterThan(CLIMATE.hot.above);
    expect(moodOf(c, w.tick).reasons.map((r) => r.text)).toContain(CLIMATE.hot.text);
    ac.powered = true;
    setTarget(ac, 19);
    updateClimate(w);
    updateHeat(w, 30);
    expect(tileTemp(w, 12, 12)).toBeCloseTo(19, 5);
    expect(c.needs.hot).toBeUndefined();
  });

  it('la temperatura elegida se guarda y no sale de los límites', () => {
    const w = flatWorld(1);
    const heater = roomWith(w, 'calefactor');
    setTarget(heater, 99);
    expect(heater.target).toBe(CLIMATE.target.max);
    setTarget(heater, 24);
    const back = loadWorld(serializeWorld(w)).structures.at(11, 11)!;
    expect(back.target).toBe(24);
  });
});
