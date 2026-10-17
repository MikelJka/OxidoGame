import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { Prop } from '../src/sim/map';
import { checkWorld } from '../src/sim/diagnostics';
import { TICKS_PER_HOUR } from '../src/sim/world';

describe('nadie se queda encerrado', () => {
  it('un colono rodeado de árboles sale solo y se apunta la causa', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.tile = { x: 10, y: 10 };
    c.pos = { x: 10.5, y: 10.5 };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) w.setProp(10 + dx, 10 + dy, Prop.DeadTree);
    w.setProp(9, 9, Prop.Boulder);
    for (let i = 0; i < TICKS_PER_HOUR / 6; i++) w.step();
    expect(c.tile.x !== 10 || c.tile.y !== 10).toBe(true);
    expect(w.incidents[0]).toContain('Árbol seco');
    expect(checkWorld(w).some((p) => p.message.includes('estaba encerrado'))).toBe(true);
    expect(checkWorld(w).some((p) => p.key.startsWith('trapped'))).toBe(false);
  });

  it('quien tiene sitio no se mueve', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    const before = { ...c.tile };
    expect(w.rescueTrapped()).toBe(0);
    expect(c.tile).toEqual(before);
  });
});
