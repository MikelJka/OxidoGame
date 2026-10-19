// Vehículos, segunda parte: el buggy de los colonos (elegido por Mikel el 2026-10-18).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { vehicleDef } from '../src/data/vehicles';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { checkWorld } from '../src/sim/diagnostics';
import { TICKS_PER_DAY, TICKS_PER_HOUR, TICKS_PER_SECOND } from '../src/sim/world';
import { attack, makeCreature } from '../src/sim/people';
import { vehiclePath } from '../src/sim/vehicles';

type W = ReturnType<typeof flatWorld>;

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

function buggyWithDriver(w: W) {
  buildNow(w, 12, 12, 'buggy');
  const v = w.vehicles[0];
  const [driver] = w.colonists;
  expect(w.boardVehicle(v.id, driver.id, 'conductor')).toBe(true);
  run(w, 2000, () => !!driver.vehicle?.boarded);
  expect(driver.vehicle?.boarded).toBe(true);
  return { v, driver };
}

describe('buggy blindado', () => {
  it('los números elegidos por Mikel', () => {
    const b = buildingDef('buggy');
    expect(b.cost).toEqual({ chatarra: 40, metal: 10, componentes: 6 });
    expect(b.size).toEqual([2, 2]);
    expect(b.category).toBe('vehiculo');
    const d = vehicleDef('buggy')!;
    expect(d.speed).toBe(2);
    expect(d.fuelPerHour).toBe(1);
    expect(d.armor).toBe(0.4);
  });

  it('al terminarlo deja de ser una construcción y pasa a ser un vehículo', () => {
    const w = flatWorld(1);
    buildNow(w, 12, 12, 'buggy');
    expect(w.structures.mainAt(12, 12)).toBeUndefined();
    expect(w.vehicles).toHaveLength(1);
    expect(w.vehicleAt(13, 13)?.id).toBe(w.vehicles[0].id);
    expect(w.vehicles[0].fuel).toBe(0);
  });

  it('el conductor va andando, se sube y se ve dentro', () => {
    const w = flatWorld(2);
    const { v, driver } = buggyWithDriver(w);
    expect(driver.tile).toEqual({ x: v.x + 1, y: v.y + 1 });
    expect(w.log.some((e) => e.text.includes('se sube al buggy blindado de conductor'))).toBe(true);
  });

  it('sin ⛽ no arranca; parado junto a un montón de ⛽, reposta', () => {
    const w = flatWorld(2);
    const { v } = buggyWithDriver(w);
    expect(w.orderVehicleMove(v.id, { x: 20, y: 20 })).toBe('sin-combustible');
    w.items.drop(11, 12, 'combustible', 30);
    run(w, 200, () => v.fuel > 0);
    expect(v.fuel).toBe(10);
    expect(w.inventory().combustible).toBe(20);
  });

  it('sin conductor no se mueve', () => {
    const w = flatWorld(1);
    buildNow(w, 12, 12, 'buggy');
    w.vehicles[0].fuel = 5;
    expect(w.orderVehicleMove(w.vehicles[0].id, { x: 20, y: 20 })).toBe('sin-conductor');
  });

  it('corre el doble que un colono y gasta 1 ⛽ por hora en marcha', () => {
    const w = flatWorld(2);
    const { v } = buggyWithDriver(w);
    v.fuel = 10;
    expect(w.orderVehicleMove(v.id, { x: 25, y: 12 })).toBe('ok');
    const ticks = run(w, 5000, () => v.path.length === 0);
    expect(v.x).toBe(25);
    // 13 casillas a 6 casillas/s = 2,2 s (un colono, a 3 casillas/s, tardaría el doble).
    expect(ticks / TICKS_PER_SECOND).toBeLessThan(2.5);
    expect(ticks / TICKS_PER_SECOND).toBeGreaterThan(2);
    expect(10 - v.fuel).toBeCloseTo(ticks / TICKS_PER_HOUR, 5);
    expect(checkWorld(w)).toEqual([]);
  });

  it('el camino solo pasa por donde cabe entero (2×2)', () => {
    const w = flatWorld(1);
    // Un muro con un hueco de una casilla: el buggy no cabe, tiene que rodear.
    for (let y = 0; y < 26; y++) if (y !== 10) buildNow(w, 18, y, 'muro_madera');
    buildNow(w, 12, 9, 'buggy');
    const v = w.vehicles[0];
    const p = vehiclePath(w, { x: v.x, y: v.y }, { x: 22, y: 9 })!;
    expect(p).not.toBeNull();
    expect(p.some((t) => t.y >= 26)).toBe(true);
  });

  it('atropella a los saqueadores: los deja en el suelo, no los mata', () => {
    const w = flatWorld(2);
    const { v } = buggyWithDriver(w);
    v.fuel = 10;
    const r = w.makePawn('saqueador');
    // Pegado al morro del buggy.
    r.tile = { x: 14, y: 12 };
    r.pos = { x: 14.5, y: 12.5 };
    r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
    r.health = 0.3;
    w.others.push(r);
    expect(w.orderVehicleMove(v.id, { x: 27, y: 12 })).toBe('ok');
    run(w, 3000, () => r.downed);
    expect(r.downed).toBe(true);
    expect(w.others).toContain(r);
    expect(w.log.some((e) => e.text.includes('atropella'))).toBe(true);
  });

  it('a un perro mutante atropellado lo mata', () => {
    const w = flatWorld(2);
    const { v } = buggyWithDriver(w);
    v.fuel = 10;
    const d = w.makePawn('saqueador');
    makeCreature(w, d, 'perro_mutante', 1);
    d.tile = { x: 14, y: 12 };
    d.pos = { x: 14.5, y: 12.5 };
    d.health = 0.3;
    w.others.push(d);
    expect(w.orderVehicleMove(v.id, { x: 27, y: 12 })).toBe('ok');
    run(w, 3000, () => !w.others.includes(d));
    expect(w.others).not.toContain(d);
    expect(w.log.some((e) => e.text.includes('atropella a Perro mutante 1: muere'))).toBe(true);
  });

  it('dentro, los golpes hacen un 40 % menos', () => {
    const dmg = (inside: boolean) => {
      const w = flatWorld(2);
      const { v, driver } = buggyWithDriver(w);
      if (!inside) w.leaveVehicle(driver);
      const r = w.makePawn('saqueador');
      r.tile = { x: driver.tile.x + 1, y: driver.tile.y };
      r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
      w.others.push(r);
      void v;
      driver.health = 1;
      driver.vest = null;
      driver.helmet = null;
      // Mismo azar: el golpe sale igual.
      w.rng.setState(12345);
      const before = driver.health;
      for (let i = 0; i < 20 && driver.health === before; i++) attack(w, r, driver);
      return before - driver.health;
    };
    const out = dmg(false);
    const inn = dmg(true);
    expect(inn).toBeCloseTo(out * 0.6, 5);
  });

  it('el tirador dispara desde dentro', () => {
    const w = flatWorld(2);
    const { v } = buggyWithDriver(w);
    const gunner = w.colonists[1];
    gunner.weapon = 'arco';
    gunner.ammo = 20;
    w.boardVehicle(v.id, gunner.id, 'tirador');
    run(w, 2000, () => !!gunner.vehicle?.boarded);
    const r = w.makePawn('saqueador');
    r.tile = { x: v.x + 5, y: v.y + 1 };
    r.pos = { x: r.tile.x + 0.5, y: r.tile.y + 0.5 };
    r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
    w.others.push(r);
    const ammo = gunner.ammo;
    run(w, 600, () => gunner.ammo < ammo);
    expect(gunner.ammo).toBeLessThan(ammo);
    expect(gunner.vehicle?.boarded).toBe(true);
  });

  it('se baja para comer y al mandarle a pie', () => {
    const w = flatWorld(2, { needs: true });
    const { driver } = buggyWithDriver(w);
    driver.needs.food = 0.05;
    w.step();
    expect(driver.vehicle).toBeUndefined();
    expect(w.vehicles[0].x).toBe(12);
    const { v } = { v: w.vehicles[0] };
    w.boardVehicle(v.id, driver.id, 'conductor');
    driver.needs.food = 1;
    run(w, 2000, () => !!driver.vehicle?.boarded);
    expect(w.orderMove(driver.id, { x: 3, y: 3 })).toBe(true);
    expect(driver.vehicle).toBeUndefined();
  });

  it('se guarda con la partida, con su ⛽ y quién va dentro', () => {
    const w = flatWorld(2);
    const { v, driver } = buggyWithDriver(w);
    v.fuel = 7;
    const back = loadWorld(serializeWorld(w));
    expect(back.vehicles).toHaveLength(1);
    expect(back.vehicles[0]).toMatchObject({ def: 'buggy', x: 12, y: 12, fuel: 7 });
    expect(back.colonists.find((c) => c.id === driver.id)?.vehicle).toEqual({ id: v.id, seat: 'conductor', boarded: true });
    expect(back.nextVehicleId).toBe(2);
  });
});
