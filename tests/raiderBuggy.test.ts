// Vehículos, tercera parte: el buggy de los saqueadores (desde el día 20; si se rompe, chatarra 🔩20).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { vehicleDef } from '../src/data/vehicles';
import { attack, startRaid } from '../src/sim/people';
import { riders, wreckVehicle } from '../src/sim/vehicles';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { checkWorld } from '../src/sim/diagnostics';
import { TICKS_PER_DAY } from '../src/sim/time';
import type { Colonist } from '../src/sim/colonist';

type W = ReturnType<typeof flatWorld>;

function run(w: W, n: number, until: () => boolean): number {
  let i = 0;
  for (; i < n && !until(); i++) w.step();
  return i;
}

/** Golpes previsibles: siempre aciertan y con el daño medio. */
function fixedRng(w: W): void {
  w.rng.chance = () => true;
  w.rng.next = () => 0.5;
  w.rng.int = (a: number) => a;
}

function onFoot(w: W, x: number, y: number): Colonist {
  const r = w.makePawn('saqueador');
  r.tile = { x, y };
  r.pos = { x: x + 0.5, y: y + 0.5 };
  r.raider = { fleeing: false, leaveAt: w.tick + TICKS_PER_DAY };
  r.traits = [];
  r.vest = null;
  r.helmet = null;
  w.others.push(r);
  return r;
}

function plain(c: Colonist): void {
  c.traits = [];
  c.vest = null;
  c.helmet = null;
}

describe('buggy de los saqueadores', () => {
  it('es distinto del de los colonos: más flojo, algo más lento y deja 🔩20', () => {
    const r = vehicleDef('buggy_saqueador')!;
    const c = vehicleDef('buggy')!;
    expect(r.hostile).toBe(true);
    expect(r.fromDay).toBe(20);
    expect(r.speed).toBeLessThan(c.speed);
    expect(r.armor).toBeLessThan(c.armor);
    expect(r.hp).toBeLessThan(c.hp);
    expect(r.wreck).toEqual({ chatarra: 20 });
    expect(r.fuelPerHour).toBe(0);
  });

  it('antes del día 20 los saqueadores vienen a pie; desde el 20, dos llegan en buggy', () => {
    const w = flatWorld(1);
    startRaid(w, 3);
    expect(w.vehicles).toHaveLength(0);
    w.others.length = 0;
    w.tick = 20 * TICKS_PER_DAY;
    const raid = startRaid(w, 3);
    expect(w.vehicles).toHaveLength(1);
    const v = w.vehicles[0];
    expect(v.def).toBe('buggy_saqueador');
    const crew = riders(w, v);
    expect(crew.map((c) => c.vehicle!.seat).sort()).toEqual(['conductor', 'tirador']);
    // El líder ★ va a pie.
    expect(crew.some((c) => c.raider?.leader)).toBe(false);
    expect(raid.filter((c) => !c.vehicle)).toHaveLength(1);
    expect(w.log.some((l) => l.text.includes('buggy saqueador'))).toBe(true);
  });

  it('un raid de uno solo no trae buggy', () => {
    const w = flatWorld(1);
    w.tick = 25 * TICKS_PER_DAY;
    startRaid(w, 1);
    expect(w.vehicles).toHaveLength(0);
  });

  it('va a por el colono más cercano y lo atropella', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    startRaid(w, 2, true);
    expect(w.vehicles).toHaveLength(1);
    const t = run(w, 6000, () => w.log.some((l) => l.text.includes('atropella a')));
    expect(t).toBeLessThan(6000);
    expect(c.health).toBeLessThan(1);
    expect(checkWorld(w)).toEqual([]);
  });

  it('los colonos no pueden subirse ni manejarlo', () => {
    const w = flatWorld(1);
    startRaid(w, 2, true);
    const v = w.vehicles[0];
    expect(w.boardVehicle(v.id, w.colonists[0].id, 'conductor')).toBe(false);
    expect(w.orderVehicleMove(v.id, { x: 10, y: 10 })).toBe('sin-camino');
  });

  it('el blindaje para un 30 % de los golpes a los de dentro y pierde esa vida', () => {
    const w = flatWorld(1);
    fixedRng(w);
    const c = w.colonists[0];
    plain(c);
    startRaid(w, 2, true);
    const v = w.vehicles[0];
    const [rider] = riders(w, v);
    plain(rider);
    const walker = onFoot(w, 20, 20);
    const hp0 = v.hp;
    attack(w, c, walker);
    c.attackCooldown = 0;
    attack(w, c, rider);
    const full = 1 - walker.health;
    expect(1 - rider.health).toBeCloseTo(full * 0.7, 5);
    expect(hp0 - v.hp).toBeCloseTo(full * 0.3 * 1000, 3);
  });

  it('si se rompe, los de dentro se bajan y queda chatarra 🔩20', () => {
    const w = flatWorld(1);
    startRaid(w, 2, true);
    const v = w.vehicles[0];
    const crew = riders(w, v);
    wreckVehicle(w, v, 'prueba');
    expect(w.vehicles).toHaveLength(0);
    expect(crew.every((c) => !c.vehicle)).toBe(true);
    expect(w.inventory().chatarra).toBe(20);
  });

  it('a golpes también se rompe', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.skills.combate = 20;
    startRaid(w, 2, true);
    const v = w.vehicles[0];
    const [rider] = riders(w, v);
    v.hp = 1;
    rider.health = 1;
    for (let i = 0; i < 50 && w.vehicles.length > 0; i++) {
      c.attackCooldown = 0;
      attack(w, c, rider);
    }
    expect(w.vehicles).toHaveLength(0);
    expect(w.log.some((l) => l.text.includes('queda destrozado'))).toBe(true);
  });

  it('si cae el conductor, el tirador coge el volante', () => {
    const w = flatWorld(1);
    // De 4, para que al caer uno no huyan todos.
    startRaid(w, 4, true);
    const v = w.vehicles[0];
    const driver = riders(w, v).find((c) => c.vehicle!.seat === 'conductor')!;
    const gunner = riders(w, v).find((c) => c.vehicle!.seat === 'tirador')!;
    driver.health = 0.05;
    driver.downed = true;
    run(w, 5, () => false);
    expect(driver.vehicle).toBeUndefined();
    expect(gunner.vehicle?.seat).toBe('conductor');
    expect(w.vehicles).toHaveLength(1);
  });

  it('sin nadie dentro, lo abandonan y queda como chatarra', () => {
    const w = flatWorld(1);
    startRaid(w, 2, true);
    const v = w.vehicles[0];
    for (const c of riders(w, v)) w.leaveVehicle(c);
    run(w, 3, () => false);
    expect(w.vehicles).toHaveLength(0);
    expect(w.log.some((l) => l.text.includes('abandonan'))).toBe(true);
  });

  it('al huir se va por el borde con los de dentro', () => {
    const w = flatWorld(1);
    startRaid(w, 2, true);
    const crew = riders(w, w.vehicles[0]);
    for (const c of crew) c.raider!.fleeing = true;
    run(w, 6000, () => w.vehicles.length === 0);
    expect(w.vehicles).toHaveLength(0);
    for (const c of crew) expect(w.others).not.toContain(c);
    expect(w.log.some((l) => l.text.includes('huye del mapa'))).toBe(true);
  });

  it('se guarda y se carga con su tripulación', () => {
    const w = flatWorld(1);
    startRaid(w, 2, true);
    w.vehicles[0].hp = 123;
    const back = loadWorld(serializeWorld(w));
    expect(back.vehicles).toHaveLength(1);
    expect(back.vehicles[0].def).toBe('buggy_saqueador');
    expect(back.vehicles[0].hp).toBe(123);
    expect(riders(back, back.vehicles[0])).toHaveLength(2);
  });
});

describe('el buggy de los colonos también pierde vida', () => {
  it('los golpes a los de dentro le quitan vida al blindaje', () => {
    const w = flatWorld(1);
    w.addVehicle('buggy', 10, 10);
    const v = w.vehicles[0];
    const c = w.colonists[0];
    c.vehicle = { id: v.id, seat: 'conductor', boarded: true };
    const r = onFoot(w, 12, 12);
    r.skills.combate = 10;
    const hp0 = v.hp;
    for (let i = 0; i < 40 && v.hp === hp0; i++) {
      r.attackCooldown = 0;
      attack(w, r, c);
    }
    expect(v.hp).toBeLessThan(hp0);
  });
});
