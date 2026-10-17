import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { updatePower } from '../src/sim/power';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_HOUR } from '../src/sim/world';

/** Pone y termina una construcción al momento. */
function build(w: ReturnType<typeof flatWorld>, x: number, y: number, id: string) {
  expect(w.structures.place(x, y, id)).toBe(true);
  const s = id === 'cable' ? w.structures.cableAt(x, y)! : w.structures.mainAt(x, y)!;
  w.completeStructure(s);
  return s;
}

describe('electricidad', () => {
  it('los cables van debajo de suelos y muros, en su propia capa', () => {
    const w = flatWorld(1);
    build(w, 10, 10, 'muro_madera');
    expect(w.structures.canPlace(10, 10, w.structures.mainAt(10, 10)!.def)).toBe(false);
    build(w, 10, 10, 'cable');
    expect(w.structures.cableAt(10, 10)?.built).toBe(true);
    expect(w.structures.mainAt(10, 10)?.def.id).toBe('muro_madera');
  });

  it('un generador con leña enciende las lámparas de su red; sin cable, no', () => {
    const w = flatWorld(1);
    const gen = build(w, 10, 10, 'generador_lena');
    gen.fuel = 2;
    for (let x = 12; x <= 15; x++) build(w, x, 10, 'cable');
    const lamp = build(w, 16, 10, 'lampara');
    const far = build(w, 20, 20, 'lampara');
    const [net] = updatePower(w.structures, 1);
    expect(net.production).toBe(1000);
    expect(lamp.powered).toBe(true);
    expect(far.powered).toBe(false);
    expect(gen.fuel).toBeCloseTo(1.5); // 1 de madera cada 2 h
  });

  it('las baterías guardan lo que sobra y lo dan de noche; sin nada, se apaga lo último que se conectó', () => {
    const w = flatWorld(1);
    const gen = build(w, 10, 10, 'generador_lena');
    gen.fuel = 1;
    build(w, 12, 10, 'cable');
    const bat = build(w, 13, 10, 'bateria');
    const lamps = [build(w, 12, 11, 'lampara'), build(w, 12, 9, 'lampara')];
    updatePower(w.structures, 2); // 2 h a 1 000 W menos 100 W de lámparas
    expect(bat.stored).toBeCloseTo(1800);
    gen.fuel = 0;
    updatePower(w.structures, 1);
    expect(lamps.every((l) => l.powered)).toBe(true);
    expect(bat.stored).toBeCloseTo(1700);
    bat.stored = 60; // llega para una lámpara durante una hora, no para dos
    updatePower(w.structures, 1);
    expect(lamps[0].powered).toBe(true);
    expect(lamps[1].powered).toBe(false);
  });

  it('los colonos llevan leña al generador cuando le queda poca', () => {
    const w = flatWorld(1);
    const gen = build(w, 10, 10, 'generador_lena');
    w.items.drop(6, 6, 'madera', 30);
    for (let i = 0; i < 4000 && (gen.fuel ?? 0) < 5; i++) w.step();
    expect(gen.fuel ?? 0).toBeGreaterThanOrEqual(5);
  });

  it('de noche, sin luz, se trabaja más despacio; con una lámpara encendida, normal', () => {
    const w = flatWorld(1);
    w.tick = TICKS_PER_HOUR * 23 - 7 * TICKS_PER_HOUR; // las 23:00 (el día empieza a las 7)
    expect(w.lightFactor({ x: 5, y: 5 })).toBeCloseTo(0.8);
    const gen = build(w, 10, 10, 'generador_lena');
    gen.fuel = 5;
    build(w, 9, 10, 'cable');
    build(w, 8, 10, 'cable');
    build(w, 7, 10, 'lampara');
    for (let i = 0; i < 40; i++) w.step();
    expect(w.lightFactor({ x: 6, y: 9 })).toBe(1);
  });

  it('la carga y el combustible se guardan con la partida', () => {
    const w = flatWorld(1);
    const gen = build(w, 10, 10, 'generador_lena');
    gen.fuel = 4.5;
    const bat = build(w, 13, 10, 'bateria');
    bat.stored = 1234;
    build(w, 12, 10, 'cable');
    const l = loadWorld(JSON.stringify(serializeWorld(w)));
    expect(l.structures.mainAt(10, 10)?.fuel).toBeCloseTo(4.5);
    expect(l.structures.mainAt(13, 10)?.stored).toBeCloseTo(1234);
    expect(l.structures.cableAt(12, 10)?.built).toBe(true);
  });
});
