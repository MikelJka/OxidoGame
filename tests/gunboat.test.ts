// Update del agua: la lancha armada (elegida por Mikel el 2026-10-18: 🔩30 ⚙️4, ⛽, conductor y
// tirador, armadura −30 %, con «Motores»).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { prepName, theName, vehicleDef } from '../src/data/vehicles';
import { Terrain } from '../src/sim/map';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_SECOND } from '../src/sim/world';
import { absorbHit, vehiclePath } from '../src/sim/vehicles';

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

function boatWithDriver(w: W) {
  lake(w);
  buildNow(w, 10, 12, 'lancha_armada');
  const v = w.vehicles[0];
  const [driver] = w.colonists;
  expect(w.boardVehicle(v.id, driver.id, 'conductor')).toBe(true);
  run(w, 3000, () => !!driver.vehicle?.boarded);
  expect(driver.vehicle?.boarded).toBe(true);
  return { v, driver };
}

describe('lancha armada', () => {
  it('los números elegidos por Mikel: 🔩30 ⚙️4, ⛽, blindaje −30 %, con «Motores»', () => {
    const b = buildingDef('lancha_armada');
    expect(b.cost).toEqual({ chatarra: 30, componentes: 4 });
    expect(b.size).toEqual([2, 2]);
    expect(b.category).toBe('vehiculo');
    expect(b.research).toBe('motores');
    expect(b.onWater).toBe(true);
    const d = vehicleDef('lancha_armada')!;
    expect(d.water).toBe(true);
    expect(d.armor).toBe(0.3);
    expect(d.fuelPerHour).toBeGreaterThan(0);
    expect(d.speed).toBeGreaterThan(1);
    const w = flatWorld(0);
    expect(w.canBuild('lancha_armada')).toBe(false);
    w.research.done.push('puentes', 'navegacion', 'polvora', 'motores');
    expect(w.canBuild('lancha_armada')).toBe(true);
  });

  it('se construye en el agua poco profunda o normal, no en tierra ni en la profunda', () => {
    const w = flatWorld(0);
    lake(w);
    expect(w.structures.place(5, 5, 'lancha_armada')).toBe(false);
    expect(w.structures.place(15, 5, 'lancha_armada')).toBe(false);
    expect(w.structures.place(10, 5, 'lancha_armada')).toBe(true);
  });

  it('sin ⛽ no se mueve; con ⛽ en la orilla reposta sola y va por el agua, nunca a tierra', () => {
    const w = flatWorld(1);
    const { v, driver } = boatWithDriver(w);
    expect(v.fuel).toBe(0);
    expect(w.orderVehicleMove(v.id, { x: 18, y: 12 })).toBe('sin-combustible');
    w.items.drop(9, 12, 'combustible', 5);
    run(w, TICKS_PER_SECOND * 2, () => v.fuel > 0);
    expect(v.fuel).toBe(5);
    expect(w.orderVehicleMove(v.id, { x: 3, y: 3 })).toBe('sin-camino');
    expect(w.orderVehicleMove(v.id, { x: 18, y: 12 })).toBe('ok');
    run(w, 6000, () => v.path.length === 0);
    expect(v.x).toBe(18);
    expect(driver.tile).toEqual({ x: v.x + 1, y: v.y + 1 });
    expect(v.fuel).toBeLessThan(5);
  });

  it('va más rápida que un colono andando (×1,5)', () => {
    const w = flatWorld(1);
    const { v } = boatWithDriver(w);
    v.fuel = 10;
    expect(w.orderVehicleMove(v.id, { x: 18, y: 12 })).toBe('ok');
    const ticks = run(w, 6000, () => v.path.length === 0);
    const expected = (8 / (3 * 1.5)) * TICKS_PER_SECOND;
    expect(ticks).toBeGreaterThan(expected * 0.9);
    expect(ticks).toBeLessThan(expected * 1.1 + 2);
  });

  it('el blindaje se lleva el 30 % del golpe a los de dentro', () => {
    const w = flatWorld(1);
    const { v, driver } = boatWithDriver(w);
    const hp = v.hp;
    expect(absorbHit(w, driver, 0.1)).toBeCloseTo(0.07);
    expect(v.hp).toBeLessThan(hp);
  });

  it('no pasa por tierra aunque el camino por agua no exista', () => {
    const w = flatWorld(0);
    lake(w);
    const d = vehicleDef('lancha_armada')!;
    expect(vehiclePath(w, { x: 10, y: 12 }, { x: 17, y: 26 }, d)).not.toBeNull();
    expect(vehiclePath(w, { x: 10, y: 12 }, { x: 5, y: 12 }, d)).toBeNull();
  });

  it('los textos del diario van con su artículo', () => {
    const d = vehicleDef('lancha_armada')!;
    expect(theName(d, true)).toBe('La lancha armada');
    expect(prepName(d, 'a')).toBe('a la lancha armada');
    expect(prepName(vehicleDef('buggy')!, 'de')).toBe('del buggy blindado');
  });

  it('se guarda y se carga con su ⛽', () => {
    const w = flatWorld(1);
    lake(w);
    buildNow(w, 10, 12, 'lancha_armada');
    w.vehicles[0].fuel = 7;
    const back = loadWorld(serializeWorld(w));
    expect(back.vehicles).toHaveLength(1);
    expect(back.vehicles[0].def).toBe('lancha_armada');
    expect(back.vehicles[0].fuel).toBe(7);
  });
});
