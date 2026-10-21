// Más barcos y comercio por barco (pedido por Mikel el 2026-10-21).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { vehicleDef } from '../src/data/vehicles';
import { BOAT_TRADE, boatBuyPrice, boatDays, boatSellPrice, startBoatTrip, tradeBoats, updateBoatTrips } from '../src/sim/boatTrade';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { Terrain } from '../src/sim/map';
import { TICKS_PER_DAY } from '../src/sim/time';
import type { World } from '../src/sim/world';

function boat(w: World, def: string) {
  const v = { id: w.nextVehicleId++, def, x: 20, y: 20, pos: { x: 20, y: 20 }, path: [], fuel: 5, hp: vehicleDef(def)!.hp, facing: 1 as const };
  w.vehicles.push(v);
  return v;
}

describe('barcos y comercio por barco', () => {
  it('la barcaza carga mucho y la lancha blindada aguanta más', () => {
    expect(vehicleDef('barcaza')!.cargo).toBe(600);
    expect(vehicleDef('barcaza')!.water).toBe(true);
    expect(vehicleDef('lancha_blindada')!.armor).toBe(0.5);
    expect(vehicleDef('lancha_blindada')!.hp).toBeGreaterThan(vehicleDef('lancha_armada')!.hp);
  });

  it('un barco lleva mercancía a una base, la vende y vuelve con lo pedido', () => {
    const w = flatWorld(3);
    w.map.start = { x: 15, y: 15 };
    // Un río al este (para dejar el barco a la vuelta).
    for (let y = 0; y < 30; y++) for (let x = 24; x < 28; x++) w.map.terrain[y * 30 + x] = Terrain.Water;
    const f = w.factions.find((k) => k.id === 'granjeros')!;
    expect(f.base).toBeDefined();
    const b = boat(w, 'barcaza');
    expect(tradeBoats(w)).toContain(b);
    w.items.drop(5, 8, 'chatarra', 75);
    w.items.drop(6, 8, 'chatarra', 75);
    const before = f.relation;
    // No se puede ir sin carga, sin tripulación o dejando la colonia vacía.
    expect(startBoatTrip(w, b.id, [w.colonists[0].id], 'granjeros', {}, 'patata')).not.toBeNull();
    expect(startBoatTrip(w, b.id, [], 'granjeros', { chatarra: 10 }, 'patata')).not.toBeNull();
    expect(startBoatTrip(w, b.id, w.colonists.map((c) => c.id), 'granjeros', { chatarra: 10 }, 'patata')).not.toBeNull();
    expect(startBoatTrip(w, b.id, [w.colonists[0].id], 'piratas_oxido', { chatarra: 10 }, 'patata')).not.toBeNull();
    const value = 100 * boatSellPrice(w, 'granjeros', 'chatarra');
    expect(boatSellPrice(w, 'granjeros', 'chatarra')).toBeGreaterThan(boatSellPrice(w, 'granjeros', 'madera') * 0); // los Granjeros necesitan chatarra
    expect(startBoatTrip(w, b.id, [w.colonists[0].id], 'granjeros', { chatarra: 100 }, 'patata')).toBeNull();
    expect(w.colonists.length).toBe(2);
    expect(w.vehicles).not.toContain(b);
    expect(w.inventory().chatarra).toBe(50);
    expect(boatDays(w, 'granjeros')).toBeGreaterThan(0);
    // Se guarda mientras va.
    const back = loadWorld(serializeWorld(w));
    expect(back.boatTrips.length).toBe(1);
    expect(back.boatTrips[0].crew[0].name).toBe(w.boatTrips[0].crew[0].name);
    // Llega, vende y vuelve.
    const price = boatBuyPrice(w, 'granjeros', 'patata');
    w.tick = w.boatTrips[0].arriveAt;
    updateBoatTrips(w);
    expect(w.boatTrips[0].phase).toBe('vuelta');
    expect(f.relation).toBe(before + BOAT_TRADE.relation);
    const got = w.boatTrips[0].back.patata ?? 0;
    expect(got).toBeGreaterThan(0);
    expect(got).toBeLessThanOrEqual(Math.floor(value / price) + 1);
    w.tick = w.boatTrips[0].arriveAt;
    updateBoatTrips(w);
    expect(w.boatTrips.length).toBe(0);
    expect(w.colonists.length).toBe(3);
    expect(w.vehicles.some((v) => v.def === 'barcaza')).toBe(true);
    expect(w.inventory().patata).toBe(got);
  });

  it('las partidas antiguas no tienen barcos fuera', () => {
    const w = flatWorld(1);
    const old = JSON.parse(JSON.stringify(serializeWorld(w)));
    delete old.boatTrips;
    expect(loadWorld(old).boatTrips).toEqual([]);
    void TICKS_PER_DAY;
  });
});
