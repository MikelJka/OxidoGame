import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { updatePower } from '../src/sim/power';
import { batteryMultiplier } from '../src/sim/research';
import { loadWorld, serializeWorld } from '../src/sim/save';

/** Pone y termina una construcción al momento. */
function build(w: ReturnType<typeof flatWorld>, x: number, y: number, id: string) {
  expect(w.structures.place(x, y, id)).toBe(true);
  const s = id === 'cable' ? w.structures.cableAt(x, y)! : w.structures.mainAt(x, y)!;
  w.completeStructure(s);
  return s;
}

describe('Baterías mejoradas', () => {
  it('sin investigar, cada batería guarda 6 000 Wh; con «Baterías mejoradas», el doble', () => {
    const w = flatWorld(1);
    const bat = build(w, 13, 10, 'bateria');
    expect(batteryMultiplier(w.research)).toBe(1);
    expect(w.batteryCapacity(bat)).toBe(6000);
    w.research.done.push('baterias');
    expect(batteryMultiplier(w.research)).toBe(2);
    expect(w.batteryCapacity(bat)).toBe(12000);
  });

  it('con la investigación, la batería se sigue cargando por encima de 6 000 Wh', () => {
    const w = flatWorld(1);
    const gen = build(w, 10, 10, 'generador_lena');
    build(w, 12, 10, 'cable');
    const bat = build(w, 13, 10, 'bateria');
    gen.fuel = 100;
    let [net] = updatePower(w.structures, 10); // 10 h a 1 000 W: se llena a 6 000
    expect(bat.stored).toBeCloseTo(6000);
    expect(net.capacity).toBe(6000);
    [net] = updatePower(w.structures, 10, { hour: 12, wind: 0.5, batteryMultiplier: 2 });
    expect(bat.stored).toBeCloseTo(12000);
    expect(net.capacity).toBe(12000);
  });

  it('el mundo usa lo investigado al repartir la corriente', () => {
    const w = flatWorld(1);
    build(w, 12, 10, 'cable');
    const bat = build(w, 13, 10, 'bateria');
    w.research.done.push('baterias');
    bat.stored = 9000;
    for (let i = 0; i < 40; i++) w.step();
    expect(bat.stored).toBeCloseTo(9000);
    expect(w.powerNetOf(bat)?.capacity).toBe(12000);
  });

  it('la carga por encima de 6 000 Wh se guarda con la partida si está investigado', () => {
    const w = flatWorld(1);
    const bat = build(w, 13, 10, 'bateria');
    w.research.done.push('baterias');
    bat.stored = 10000;
    const l = loadWorld(JSON.stringify(serializeWorld(w)));
    expect(l.structures.mainAt(13, 10)?.stored).toBeCloseTo(10000);
    // Sin la investigación, no cabe más de lo normal.
    const w2 = flatWorld(1);
    const b2 = build(w2, 13, 10, 'bateria');
    b2.stored = 10000;
    const l2 = loadWorld(JSON.stringify(serializeWorld(w2)));
    expect(l2.structures.mainAt(13, 10)?.stored).toBeCloseTo(6000);
  });
});
