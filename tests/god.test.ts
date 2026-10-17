import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { godClear, godDrop, godFinishWork, godGrowAll, godHealAll, godKill, godSpawn, godWound, pawnNear } from '../src/sim/god';
import { Prop } from '../src/sim/map';

describe('modo Dios', () => {
  it('deja recursos y hace aparecer gente', () => {
    const w = flatWorld(1);
    godDrop(w, 10, 10, 'metal', 40);
    expect(w.inventory().metal).toBe(40);
    expect(godSpawn(w, 'colono', 12, 12)).not.toBeNull();
    expect(w.colonists.length).toBe(2);
    expect(new Set(w.colonists.map((c) => c.id)).size).toBe(2);
    godSpawn(w, 'saqueador', 20, 20);
    godSpawn(w, 'prisionero', 21, 20);
    const t = godSpawn(w, 'comerciante', 22, 20);
    expect(w.others.map((o) => o.role).sort()).toEqual(['comerciante', 'prisionero', 'saqueador']);
    expect(t?.tile).toEqual({ x: 22, y: 20 });
    expect(pawnNear(w, 20, 20)?.role).toBe('saqueador');
  });

  it('termina las obras al momento', () => {
    const w = flatWorld(1);
    w.structures.place(10, 10, 'muro_madera');
    w.structures.place(11, 10, 'muro_madera');
    expect(godFinishWork(w)).toBe(2);
    expect(w.structures.at(10, 10)?.built).toBe(true);
  });

  it('hiere, cura, mata y madura', () => {
    const w = flatWorld(2);
    const [a, b] = w.colonists;
    godWound(a);
    expect(a.downed).toBe(true);
    godHealAll(w);
    expect(a.downed).toBe(false);
    expect(a.health).toBe(1);
    godKill(w, b);
    expect(w.colonists.length).toBe(1);
    w.createGrowZone({ x0: 15, y0: 15, x1: 16, y1: 16 });
    w.farms.sow(15, 15);
    godGrowAll(w);
    expect(w.farms.plantAt(15, 15)?.growth).toBe(1);
  });

  it('despeja una casilla', () => {
    const w = flatWorld(1);
    w.map.props[3 * w.map.width + 3] = Prop.DeadTree;
    expect(godClear(w, 3, 3)).toBe(true);
    expect(w.map.props[3 * w.map.width + 3]).toBe(Prop.None);
  });
});
