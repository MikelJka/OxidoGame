// Bloque 11 del catálogo: estaciones, frío, estufa y abrigo.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { seasonOf } from '../src/data/seasons';
import { buildingDef } from '../src/data/buildings';
import { recipeDef } from '../src/data/recipes';
import { moodOf } from '../src/sim/needs';
import { coldNow, updateCold, warmTiles } from '../src/sim/seasons';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/time';
import type { World } from '../src/sim/world';

/** El día 31 (invierno) a medianoche. */
function winterNight(w: World): void {
  w.tick = 30 * TICKS_PER_DAY + 17 * TICKS_PER_HOUR; // empieza a las 7:00: +17 h = 0:00
}

describe('estaciones', () => {
  it('cada 10 días: primavera, verano, otoño e invierno', () => {
    expect(seasonOf(1).id).toBe('primavera');
    expect(seasonOf(11).id).toBe('verano');
    expect(seasonOf(21).id).toBe('otono');
    expect(seasonOf(31).id).toBe('invierno');
    expect(seasonOf(41).id).toBe('primavera');
  });

  it('en invierno no crece nada al aire libre', () => {
    const w = flatWorld(0);
    w.farms.create({ x0: 10, y0: 10, x1: 10, y1: 10 });
    w.farms.sow(10, 10);
    w.tick = 30 * TICKS_PER_DAY;
    const before = w.farms.plantAt(10, 10)!.growth;
    for (let k = 0; k < 2000; k++) w.step();
    expect(w.farms.plantAt(10, 10)!.growth).toBe(before);
  });

  it('ola de frío: 48 h de frío a todas horas, en cualquier estación, y no crece nada al aire libre', async () => {
    const { startEvent } = await import('../src/sim/events');
    const { eventDef } = await import('../src/data/events');
    expect(eventDef('ola_frio')!.hours).toBe(48);
    const w = flatWorld(1, { needs: true });
    w.farms.create({ x0: 10, y0: 10, x1: 10, y1: 10 });
    w.farms.sow(10, 10);
    w.tick = 12 * TICKS_PER_DAY; // verano, de día
    expect(coldNow(w)).toBe(false);
    expect(startEvent(w, 'ola_frio')).toBe(true);
    expect(coldNow(w)).toBe(true);
    expect(w.log.some((l) => l.text.includes('Ola de frío'))).toBe(true);
    const before = w.farms.plantAt(10, 10)!.growth;
    for (let k = 0; k < 2000; k++) w.step();
    expect(w.farms.plantAt(10, 10)!.growth).toBe(before);
    updateCold(w, 30);
    expect(w.colonists[0].needs.cold).toBe(true);
    // Se guarda; a las 48 h se acaba.
    expect(coldNow(loadWorld(serializeWorld(w)))).toBe(true);
    w.tick += 48 * TICKS_PER_HOUR;
    expect(coldNow(w)).toBe(false);
  });

  it('de noche en invierno, sin abrigo ni estufa, se pasa frío y con 4 h, hipotermia', () => {
    const w = flatWorld(1, { needs: true });
    winterNight(w);
    expect(coldNow(w)).toBe(true);
    const [c] = w.colonists;
    c.health = 1;
    updateCold(w, 30);
    expect(c.needs.cold).toBe(true);
    expect(moodOf(c, w.tick).reasons.map((r) => r.text)).toContain('Pasa frío');
    updateCold(w, 4 * TICKS_PER_HOUR);
    updateCold(w, TICKS_PER_HOUR);
    expect(moodOf(c, w.tick).reasons.map((r) => r.text)).toContain('Hipotermia');
    expect(c.health).toBeLessThan(1);
    // Con abrigo, nada.
    c.coat = true;
    updateCold(w, 30);
    expect(c.needs.cold).toBeUndefined();
    expect(loadWorld(serializeWorld(w)).colonists[0].coat).toBe(true);
  });

  it('una habitación con tejado y estufa encendida está caliente', () => {
    const w = flatWorld(1, { needs: true });
    for (let x = 10; x <= 14; x++) for (let y = 10; y <= 14; y++) {
      if (x !== 10 && x !== 14 && y !== 10 && y !== 14) continue;
      w.structures.place(x, y, x === 12 && y === 14 ? 'puerta_madera' : 'muro_madera');
      w.completeStructure(w.structures.at(x, y)!);
    }
    for (let x = 11; x <= 13; x++) for (let y = 11; y <= 13; y++) w.roofs.add(y * w.map.width + x);
    expect(buildingDef('estufa').research).toBe('calefaccion');
    expect(buildingDef('estufa').cost).toEqual({ piedra: 10, chatarra: 6 });
    expect(recipeDef('fabricar_abrigo')!.inputs).toEqual({ fibra: 10 });
    w.structures.place(11, 11, 'estufa');
    const st = w.structures.at(11, 11)!;
    w.completeStructure(st);
    st.fuel = 5;
    expect(warmTiles(w).has(12 * w.map.width + 12)).toBe(true);
    winterNight(w);
    const [c] = w.colonists;
    c.tile = { x: 12, y: 12 };
    updateCold(w, 30);
    expect(c.needs.cold).toBeUndefined();
  });
});
