import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { coverAt } from '../src/sim/people';
import { buildingDef } from '../src/data/buildings';

describe('sacos de arena', () => {
  it('cuestan 🧵2 🪨3, se ponen en un momento, aguantan 100 y no piden investigación', () => {
    const d = buildingDef('sacos_arena');
    expect(d.category).toBe('defensa');
    expect(d.cost).toEqual({ fibra: 2, piedra: 3 });
    expect(d.hp).toBe(100);
    expect(d.research).toBeUndefined();
    expect(d.work).toBeLessThan(buildingDef('barricada_madera').work / 2);
    expect(d.blocks).toBe(false);
  });

  it('dan un 50 % de cobertura a quien está detrás', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    a.tile = { x: 4, y: 10 };
    b.tile = { x: 10, y: 10 };
    expect(coverAt(w, a.tile, b.tile)).toBe(0);
    expect(w.structures.place(9, 10, 'sacos_arena')).toBe(true);
    w.completeStructure(w.structures.at(9, 10)!);
    expect(coverAt(w, a.tile, b.tile)).toBeCloseTo(0.5);
    // Desde el otro lado no le tapan.
    a.tile = { x: 16, y: 10 };
    expect(coverAt(w, a.tile, b.tile)).toBe(0);
  });

  it('al demolerlos devuelven todo el material (una barricada, la mitad)', () => {
    const w = flatWorld(0);
    w.structures.place(10, 10, 'sacos_arena');
    const s = w.structures.at(10, 10)!;
    w.completeStructure(s);
    w.demolishStructure(s);
    expect(w.items.totals().fibra).toBe(2);
    expect(w.items.totals().piedra).toBe(3);

    w.structures.place(14, 10, 'barricada_madera');
    const b = w.structures.at(14, 10)!;
    w.completeStructure(b);
    w.demolishStructure(b);
    expect(w.items.totals().madera).toBe(3);
  });
});
