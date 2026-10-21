// Bloque 12 del catálogo: calidad de las habitaciones y ratos libres.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { moodOf } from '../src/sim/needs';
import { TICKS_PER_DAY } from '../src/sim/time';

describe('ocio y habitaciones', () => {
  it('los muebles nuevos', () => {
    expect(buildingDef('mesa_juego').cost).toEqual({ madera: 15 });
    expect(buildingDef('mesa_juego').recreation).toBe(true);
    for (const id of ['mesa', 'silla', 'alfombra', 'cuadro']) expect(buildingDef(id).beauty).toBeGreaterThan(0);
  });

  it('sin ratos libres en 2 días, −8 % de ánimo; junto a la mesa de juego se distraen', () => {
    const w = flatWorld(1, { needs: true });
    const [c] = w.colonists;
    c.needs.funAt = 0;
    w.tick = 2 * TICKS_PER_DAY + 10;
    expect(moodOf(c, w.tick).reasons.map((r) => r.text)).toContain('Sin ratos libres');
    w.structures.place(8, 5, 'mesa_juego');
    w.completeStructure(w.structures.at(8, 5)!);
    // Va solo a la mesa al pasear y se distrae.
    for (let k = 0; k < 3000 && (c.needs.funAt ?? 0) < 2 * TICKS_PER_DAY; k++) w.step();
    expect(c.needs.funAt).toBeGreaterThanOrEqual(2 * TICKS_PER_DAY);
    expect(moodOf(c, w.tick).reasons.map((r) => r.text)).not.toContain('Sin ratos libres');
  });
});
