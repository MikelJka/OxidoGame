// Update del agua: la balsa (elegida por Mikel el 2026-10-18: 🪵20, 2 colonos, la mitad de rápida).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { vehicleDef } from '../src/data/vehicles';
import { Terrain } from '../src/sim/map';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_SECOND } from '../src/sim/world';
import { canFloat, vehiclePath } from '../src/sim/vehicles';

type W = ReturnType<typeof flatWorld>;

/** Un lago en x 10–19 (todo el alto): orilla poco profunda en x 10, agua en 11–14, profunda en 15–19. */
function lake(w: W): void {
  const m = w.map;
  for (let y = 0; y < m.height; y++) {
    m.terrain[y * m.width + 10] = Terrain.ShallowWater;
    for (let x = 11; x <= 14; x++) m.terrain[y * m.width + x] = Terrain.Water;
    for (let x = 15; x <= 19; x++) m.terrain[y * m.width + x] = Terrain.DeepWater;
  }
}

function buildNow(w: W, x: number, y: number, id: string) {
  expect(w.structures.place(x, y, id)).toBe(true);
  const s = w.structures.mainAt(x, y)!;
  for (const [r, n] of Object.entries(s.def.cost)) w.structures.deliver(s, r as never, n as number);
  w.completeStructure(s);
  return s;
}

function run(w: W, n: number, until: () => boolean): number {
  let i = 0;
  for (; i < n && !until(); i++) w.step();
  return i;
}

function raftWithRower(w: W) {
  lake(w);
  buildNow(w, 10, 12, 'balsa');
  const v = w.vehicles[0];
  const [rower] = w.colonists;
  expect(w.boardVehicle(v.id, rower.id, 'conductor')).toBe(true);
  run(w, 3000, () => !!rower.vehicle?.boarded);
  expect(rower.vehicle?.boarded).toBe(true);
  return { v, rower };
}

describe('balsa', () => {
  it('los números elegidos por Mikel: 🪵20, la mitad de rápida, sin ⛽, con «Navegación»', () => {
    const b = buildingDef('balsa');
    expect(b.cost).toEqual({ madera: 20 });
    expect(b.size).toEqual([2, 2]);
    expect(b.category).toBe('vehiculo');
    expect(b.research).toBe('navegacion');
    const d = vehicleDef('balsa')!;
    expect(d.water).toBe(true);
    expect(d.speed).toBe(0.5);
    expect(d.fuelPerHour).toBe(0);
    expect(d.armor).toBe(0);
    const w = flatWorld(0);
    expect(w.canBuild('balsa')).toBe(false);
    w.research.done.push('puentes', 'navegacion');
    expect(w.canBuild('balsa')).toBe(true);
  });

  it('se construye en el agua poco profunda o normal, no en tierra ni en la profunda', () => {
    const w = flatWorld(0);
    lake(w);
    expect(w.structures.place(5, 5, 'balsa')).toBe(false); // tierra
    expect(w.structures.place(9, 5, 'balsa')).toBe(false); // mitad en la orilla
    expect(w.structures.place(15, 5, 'balsa')).toBe(false); // profunda
    expect(w.structures.place(10, 5, 'balsa')).toBe(true);
  });

  it('al terminarla pasa a ser un vehículo de agua; sin ⛽ y sin remero no se mueve', () => {
    const w = flatWorld(0);
    lake(w);
    buildNow(w, 10, 12, 'balsa');
    expect(w.structures.mainAt(10, 12)).toBeUndefined();
    expect(w.vehicles).toHaveLength(1);
    expect(w.vehicles[0].def).toBe('balsa');
    expect(w.orderVehicleMove(w.vehicles[0].id, { x: 16, y: 20 })).toBe('sin-conductor');
  });

  it('va solo por el agua (también la profunda) y nunca por tierra', () => {
    const w = flatWorld(0);
    lake(w);
    const d = vehicleDef('balsa')!;
    expect(vehiclePath(w, { x: 10, y: 12 }, { x: 17, y: 26 }, d)).not.toBeNull();
    expect(vehiclePath(w, { x: 10, y: 12 }, { x: 5, y: 12 }, d)).toBeNull();
    expect(canFloat(w, 5, 5)).toBe(false);
    expect(canFloat(w, 16, 5)).toBe(true);
  });

  it('el remero se sube desde la orilla y la lleva al otro lado del lago, sin ⛽', () => {
    const w = flatWorld(1);
    const { v, rower } = raftWithRower(w);
    expect(v.fuel).toBe(0);
    expect(w.orderVehicleMove(v.id, { x: 18, y: 12 })).toBe('ok');
    run(w, 6000, () => v.path.length === 0);
    expect(v.x).toBe(18);
    expect(rower.tile).toEqual({ x: v.x + 1, y: v.y + 1 });
    // No se puede mandar a tierra.
    expect(w.orderVehicleMove(v.id, { x: 3, y: 3 })).toBe('sin-camino');
  });

  it('va a la mitad de la velocidad de un colono andando', () => {
    const w = flatWorld(1);
    const { v } = raftWithRower(w);
    expect(w.orderVehicleMove(v.id, { x: 18, y: 12 })).toBe('ok');
    const ticks = run(w, 6000, () => v.path.length === 0);
    // 8 casillas a la mitad de lo que anda un colono (3 casillas por segundo): 1,5 por segundo.
    const expected = (8 / (3 * 0.5)) * TICKS_PER_SECOND;
    expect(ticks).toBeGreaterThan(expected * 0.9);
    expect(ticks).toBeLessThan(expected * 1.1 + 2);
  });

  it('no pasa por debajo de un puente', () => {
    const w = flatWorld(0);
    lake(w);
    for (let x = 11; x <= 19; x++) {
      expect(w.structures.place(x, 20, x >= 15 ? 'puente_metal' : 'puente_madera')).toBe(true);
      w.completeStructure(w.structures.floorAt(x, 20)!);
    }
    const d = vehicleDef('balsa')!;
    expect(vehiclePath(w, { x: 12, y: 12 }, { x: 12, y: 26 }, d)).toBeNull();
  });

  it('en medio del lago, quien se baja va nadando a la orilla más cercana', () => {
    const w = flatWorld(1);
    const { v, rower } = raftWithRower(w);
    expect(w.orderVehicleMove(v.id, { x: 16, y: 12 })).toBe('ok');
    run(w, 6000, () => v.path.length === 0);
    w.leaveVehicle(rower);
    expect(w.map.terrain[rower.tile.y * w.map.width + rower.tile.x]).not.toBe(Terrain.DeepWater);
    expect(w.map.terrain[rower.tile.y * w.map.width + rower.tile.x]).not.toBe(Terrain.Water);
  });

  it('se guarda y se carga', () => {
    const w = flatWorld(1);
    lake(w);
    buildNow(w, 10, 12, 'balsa');
    const back = loadWorld(serializeWorld(w));
    expect(back.vehicles).toHaveLength(1);
    expect(back.vehicles[0].def).toBe('balsa');
  });
});
