// Tejados y habitaciones (pedido por Mikel el 2026-10-21).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { moodOf } from '../src/sim/needs';
import { roofed, roofTodo, roomInfoAt } from '../src/sim/roofs';
import { startEvent } from '../src/sim/events';
import { loadWorld, serializeWorld } from '../src/sim/save';
import type { World } from '../src/sim/world';

/** Un cuarto de 3×3 por dentro (paredes de 10 a 14) con una puerta; `wall`: qué muro. */
function room(w: World, wall = 'muro_madera'): void {
  for (let x = 10; x <= 14; x++) {
    for (let y = 10; y <= 14; y++) {
      if (x !== 10 && x !== 14 && y !== 10 && y !== 14) continue;
      const id = x === 12 && y === 14 ? 'puerta_madera' : wall;
      expect(w.structures.place(x, y, id)).toBe(true);
      w.completeStructure(w.structures.at(x, y)!);
    }
  }
}

describe('tejados', () => {
  it('una habitación cerrada con paredes pide tejado; con muros altos, no', () => {
    const w = flatWorld(0);
    room(w);
    expect(roofTodo(w).length).toBe(9);
    const w2 = flatWorld(0);
    room(w2, 'empalizada_alta');
    expect(roofTodo(w2).length).toBe(0);
  });

  it('los colonos ponen el tejado; bajo techo no llueve', () => {
    const w = flatWorld(1);
    room(w);
    let t = 0;
    for (; t < 6000 && roofTodo(w).length > 0; t++) w.step();
    expect(roofTodo(w).length).toBe(0);
    expect(roofed(w, 12, 12)).toBe(true);
    // Bajo techo, la lluvia ácida no quema.
    const [c] = w.colonists;
    c.tile = { x: 12, y: 12 };
    c.pos = { x: 12.5, y: 12.5 };
    c.health = 1;
    startEvent(w, 'lluvia_acida');
    expect(c.health).toBe(1);
    // Se guarda.
    expect(roofed(loadWorld(serializeWorld(w)), 12, 12)).toBe(true);
    // Si se abre la habitación, se cae el tejado.
    w.breakStructure(w.structures.at(10, 12)!);
    w.step();
    for (let k = 0; k < 40; k++) w.step();
    expect(roofed(w, 12, 12)).toBe(false);
  });

  it('cada habitación tiene su belleza y su limpieza, que cambian el ánimo de quien está dentro', () => {
    const w = flatWorld(1);
    room(w);
    for (const p of roofTodo(w)) w.roofs.add(p.y * w.map.width + p.x);
    // Sin suelo: sucia y fea.
    let info = roomInfoAt(w, 12, 12)!;
    expect(info.clean).toBeLessThan(0.6);
    expect(info.beauty).toBeLessThan(0.15);
    const [c] = w.colonists;
    c.tile = { x: 12, y: 12 };
    c.pos = { x: 12.5, y: 12.5 };
    c.drafted = true; // que se quede quieto dentro
    for (let k = 0; k < 31; k++) w.step();
    expect(moodOf(c, w.tick).reasons.map((r) => r.text)).toContain('Habitación sucia');
    // Con suelo y muebles: limpia y bonita.
    for (let x = 11; x <= 13; x++) for (let y = 11; y <= 13; y++) {
      w.structures.place(x, y, 'suelo_madera');
      w.completeStructure(w.structures.floorAt(x, y)!);
    }
    w.structures.place(11, 11, 'cama');
    w.completeStructure(w.structures.at(11, 11)!);
    info = roomInfoAt(w, 12, 12)!;
    expect(info.clean).toBeGreaterThanOrEqual(0.95);
    expect(info.beauty).toBeGreaterThanOrEqual(0.6);
    for (let k = 0; k < 31; k++) w.step();
    const texts = moodOf(c, w.tick).reasons.map((r) => r.text);
    expect(texts).toContain('Habitación bonita');
    expect(texts).toContain('Habitación limpia');
  });
});
