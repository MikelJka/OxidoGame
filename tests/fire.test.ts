// Incendio grande (pedido por Mikel el 2026-10-21).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { burning, fuelAt, ignite, updateFires } from '../src/sim/fire';
import { startEvent } from '../src/sim/events';
import { Prop } from '../src/sim/map';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_SECOND } from '../src/sim/time';
import type { World } from '../src/sim/world';

const at = (w: World, x: number, y: number) => y * w.map.width + x;

describe('fuego', () => {
  it('arde lo que tiene combustible: árboles, matorrales, tierra seca, madera; el agua y la roca, no', () => {
    const w = flatWorld(0);
    w.map.props[at(w, 10, 10)] = Prop.DeadTree;
    expect(fuelAt(w, 10, 10)).toBe('tree');
    expect(fuelAt(w, 12, 12)).toBe('soil');
    expect(fuelAt(w, 1, 1)).toBeNull(); // la charca
    w.items.drop(14, 14, 'madera', 10);
    expect(fuelAt(w, 14, 14)).toBe('item');
  });

  it('se extiende por el monte y, consumido, deja la tierra quemada', () => {
    const w = flatWorld(0);
    for (let x = 5; x < 25; x++) for (let y = 5; y < 25; y++) w.map.props[at(w, x, y)] = Prop.DeadTree;
    expect(ignite(w, 15, 15)).toBe(true);
    let max = 0;
    for (let s = 0; s < 400 && w.fires.size > 0; s++) {
      w.tick += TICKS_PER_SECOND;
      updateFires(w);
      max = Math.max(max, w.fires.size);
    }
    expect(max).toBeGreaterThan(20);
    expect(w.map.props[at(w, 15, 15)]).toBe(Prop.None);
    expect(w.burnt.has(at(w, 15, 15))).toBe(true);
  });

  it('quema lo construido con madera y a quien está dentro', () => {
    const w = flatWorld(1);
    expect(w.structures.place(20, 20, 'muro_madera')).toBe(true);
    const wall = w.structures.at(20, 20)!;
    w.completeStructure(wall);
    ignite(w, 20, 20);
    const [c] = w.colonists;
    w.fires.set(at(w, c.tile.x, c.tile.y), 0);
    const hp = wall.hp;
    w.tick += TICKS_PER_SECOND;
    updateFires(w);
    expect(wall.hp).toBeLessThan(hp);
    expect(c.health).toBeLessThan(1);
  });

  it('cerca de la colonia, los colonos lo apagan', () => {
    const w = flatWorld(2);
    w.map.start = { x: 6, y: 6 };
    w.map.props[at(w, 9, 9)] = Prop.Stones; // que no arda la tierra de alrededor
    for (const [x, y] of [[8, 9], [10, 9], [9, 8], [9, 10]]) w.map.props[at(w, x, y)] = Prop.Stones;
    w.map.props[at(w, 9, 9)] = Prop.DeadTree;
    ignite(w, 9, 9);
    let t = 0;
    for (; t < 3000 && burning(w, 9, 9); t++) w.step();
    expect(burning(w, 9, 9)).toBe(false);
    // No se ha consumido solo: sigue el árbol.
    expect(w.map.props[at(w, 9, 9)]).toBe(Prop.DeadTree);
  });

  it('suceso: empieza lejos de la colonia y se guarda', () => {
    const w = flatWorld(0);
    w.map.start = { x: 2, y: 2 };
    for (let x = 20; x < 29; x++) for (let y = 20; y < 29; y++) w.map.props[at(w, x, y)] = Prop.Bush;
    expect(startEvent(w, 'incendio')).toBe(true);
    expect(w.fires.size).toBeGreaterThan(0);
    const back = loadWorld(serializeWorld(w));
    expect(back.fires.size).toBe(w.fires.size);
  });
});
