import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { updatePower, windStrength } from '../src/sim/power';
import { Prop } from '../src/sim/map';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_HOUR } from '../src/sim/world';
import { recipeDef } from '../src/data/recipes';
import { LIGHT_MOOD, moodOf } from '../src/sim/needs';

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

  it('de noche, quien duerme junto a una lámpara encendida gana ánimo («Habitación con luz»)', () => {
    const w = flatWorld(1, { needs: true });
    w.tick = TICKS_PER_HOUR * 23 - 7 * TICKS_PER_HOUR; // las 23:00
    const gen = build(w, 10, 10, 'generador_lena');
    gen.fuel = 5;
    build(w, 9, 10, 'cable');
    build(w, 8, 10, 'cable');
    build(w, 7, 10, 'lampara');
    const c = w.colonists[0];
    const sleepAt = (x: number, y: number) => {
      c.tile = { x, y };
      c.pos = { x: x + 0.5, y: y + 0.5 };
      c.path = [];
      c.needs.rest = 0.1;
      c.need = { type: 'dormir', x, y, bed: false, progress: 0 };
      c.activity = 'sleeping';
    };
    sleepAt(6, 9);
    for (let i = 0; i < 40; i++) w.step();
    expect(c.activity).toBe('sleeping');
    const lit = moodOf(c, w.tick);
    expect(lit.reasons.some((r) => r.text === 'Habitación con luz' && r.value === LIGHT_MOOD)).toBe(true);
    // Lejos de la lámpara, nada.
    sleepAt(20, 20);
    for (let i = 0; i < 40; i++) w.step();
    expect(moodOf(c, w.tick).reasons.some((r) => r.text === 'Habitación con luz')).toBe(false);
    expect(moodOf(c, w.tick).mood).toBeCloseTo(lit.mood - LIGHT_MOOD);
    // De día no cuenta, aunque esté junto a la lámpara.
    w.tick = TICKS_PER_HOUR * 12 - 7 * TICKS_PER_HOUR;
    sleepAt(6, 9);
    for (let i = 0; i < 40; i++) w.step();
    expect(c.needs.inLight).toBeUndefined();
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

  it('la placa solar da 600 W de día y nada de noche', () => {
    const w = flatWorld(1);
    const sol = build(w, 10, 10, 'placa_solar');
    build(w, 12, 10, 'cable');
    const lamp = build(w, 13, 10, 'lampara');
    let [net] = updatePower(w.structures, 1, { hour: 13, wind: 0 });
    expect(net.production).toBe(600);
    expect(sol.output).toBe(600);
    expect(lamp.powered).toBe(true);
    [net] = updatePower(w.structures, 1, { hour: 22, wind: 1 });
    expect(net.production).toBe(0);
    expect(sol.powered).toBe(false);
    expect(lamp.powered).toBe(false);
  });

  it('el molino da de 0 a 900 W según el viento y nada si tiene algo alrededor', () => {
    const w = flatWorld(1);
    const mill = build(w, 10, 10, 'molino_viento');
    build(w, 10, 11, 'cable'); // un cable pegado no le quita viento
    let [net] = updatePower(w.structures, 1, { hour: 3, wind: 1 });
    expect(net.production).toBe(900);
    [net] = updatePower(w.structures, 1, { hour: 3, wind: 0.5 });
    expect(mill.output).toBe(450);
    [net] = updatePower(w.structures, 1, { hour: 3, wind: 0 });
    expect(net.production).toBe(0);
    w.map.props[9 * w.map.width + 11] = Prop.DeadTree;
    [net] = updatePower(w.structures, 1, { hour: 3, wind: 1 });
    expect(mill.sheltered).toBe(true);
    expect(net.production).toBe(0);
  });

  it('el viento sube y baja entre 0 y 1 y es el mismo con la misma semilla', () => {
    const vals = Array.from({ length: 24 * 10 }, (_, h) => windStrength(h, 7));
    expect(vals.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.4);
    expect(windStrength(37.5, 7)).toBe(windStrength(37.5, 7));
  });
});

describe('máquinas que necesitan corriente', () => {
  it('la depuradora solo da agua limpia con corriente', () => {
    const w = flatWorld(1);
    const m = w.map;
    const water = m.terrain[1 * m.width + 1];
    m.terrain[20 * m.width + 21] = water;
    m.contaminated[20 * m.width + 21] = 1;
    build(w, 20, 20, 'depuradora');
    updatePower(w.structures, 1);
    expect(w.drinkAt(20, 19)).toBeNull();
    const gen = build(w, 16, 19, 'generador_lena');
    gen.fuel = 5;
    build(w, 18, 20, 'cable');
    build(w, 19, 20, 'cable');
    updatePower(w.structures, 1);
    expect(w.drinkAt(20, 19)).toBe('limpia');
  });

  it('la recicladora sin corriente está parada; con corriente, saca chatarra', () => {
    const w = flatWorld(1);
    const rec = build(w, 14, 10, 'recicladora');
    w.structures.setBill(rec, { recipe: recipeDef('reciclar_restos')!, target: 4, paused: false });
    for (let t = 0; t < 4000; t++) w.step();
    expect(rec.powered).toBe(false);
    expect(w.inventory().chatarra).toBe(0);
    const gen = build(w, 10, 10, 'generador_lena');
    build(w, 12, 10, 'cable');
    build(w, 13, 10, 'cable');
    for (let t = 0; t < 20000 && w.inventory().chatarra < 4; t++) {
      gen.fuel = 10;
      w.step();
    }
    expect(rec.powered).toBe(true);
    expect(w.inventory().chatarra).toBeGreaterThanOrEqual(4);
  });
});
