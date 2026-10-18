import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { findPath } from '../src/sim/pathfinding';
import { godSpawn } from '../src/sim/god';
import { buildingDef } from '../src/data/buildings';
import { TICKS_PER_SECOND } from '../src/sim/world';

type W = ReturnType<typeof flatWorld>;

function build(w: W, x: number, y: number, id: string) {
  expect(w.structures.place(x, y, id)).toBe(true);
  const s = id === 'cable' ? w.structures.cableAt(x, y)! : w.structures.mainAt(x, y)!;
  w.completeStructure(s);
  return s;
}

/** Un muro de norte a sur en x = 15 con una puerta automática en (15, 10); el generador, al oeste. */
function walledWorld(powered: boolean) {
  const w = flatWorld(1);
  for (let y = 0; y < w.map.height; y++) if (y !== 10) build(w, 15, y, 'muro_madera');
  const door = build(w, 15, 10, 'puerta_auto');
  if (powered) {
    const gen = build(w, 10, 12, 'generador_lena');
    gen.fuel = 5;
    for (let x = 12; x <= 14; x++) build(w, x, 12, 'cable');
    build(w, 14, 11, 'cable');
    build(w, 14, 10, 'cable');
  }
  const c = w.colonists[0];
  c.tile = { x: 5, y: 10 };
  c.pos = { x: 5.5, y: 10.5 };
  return { w, door };
}

describe('puerta automática', () => {
  it('cuesta 🔩10 ⚙️2, es una puerta y gasta 20 W', () => {
    const d = buildingDef('puerta_auto');
    expect(d.cost).toEqual({ chatarra: 10, componentes: 2 });
    expect(d.category).toBe('puerta');
    expect(d.hp).toBe(buildingDef('puerta_chapa').hp);
    expect(d.power).toBe(-20);
    expect(d.blocks).toBe(false);
  });

  it('el camino evita las casillas cerradas', () => {
    const w = flatWorld(1);
    for (let y = 0; y < w.map.height; y++) if (y !== 10) build(w, 15, y, 'muro_madera');
    expect(findPath(w.map, { x: 5, y: 10 }, { x: 25, y: 10 })).not.toBeNull();
    const shut = new Set([10 * w.map.width + 15]);
    expect(findPath(w.map, { x: 5, y: 10 }, { x: 25, y: 10 }, 20000, shut)).toBeNull();
  });

  it('con corriente se cierra a los saqueadores durante un raid; los colonos pasan', () => {
    const { w, door } = walledWorld(true);
    for (let i = 0; i < TICKS_PER_SECOND; i++) w.step();
    expect(door.powered).toBe(true);
    expect(w.shutDoors.size).toBe(0); // sin raid, abierta
    const r = godSpawn(w, 'saqueador', 25, 10)!;
    r.skills.combate = 0;
    for (let i = 0; i < TICKS_PER_SECOND * 2; i++) w.step();
    expect(w.shutDoors.has(10 * w.map.width + 15)).toBe(true);
    expect(w.log.some((l) => l.text.includes('puertas automáticas se cierran'))).toBe(true);
    for (let i = 0; i < TICKS_PER_SECOND * 30; i++) {
      w.step();
      expect(r.tile.x).toBeGreaterThan(15);
    }
    // Un colono sí encuentra camino a través de ella.
    expect(findPath(w.map, { x: 5, y: 10 }, { x: 20, y: 10 })).not.toBeNull();
  });

  it('sin corriente se queda abierta y el saqueador pasa', () => {
    const { w, door } = walledWorld(false);
    godSpawn(w, 'saqueador', 25, 10);
    let crossed = false;
    for (let i = 0; i < TICKS_PER_SECOND * 30 && !crossed; i++) {
      w.step();
      crossed = w.others.some((o) => o.role === 'saqueador' && o.tile.x < 15);
    }
    expect(door.powered).toBe(false);
    expect(w.shutDoors.size).toBe(0);
    expect(crossed).toBe(true);
  });
});
