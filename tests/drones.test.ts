// Máquinas (bloque 6 del catálogo, segunda parte): el dron de vigilancia, que vuela y dispara.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { CREATURES, flies, isMachine, MACHINES } from '../src/data/creatures';
import type { Colonist } from '../src/sim/colonist';
import { canHit, makeCreature, reachOf, startMachines, updateOthers, usableWeapon } from '../src/sim/people';
import { flightPath } from '../src/sim/pathfinding';
import { loadWorld, serializeWorld } from '../src/sim/save';

type W = ReturnType<typeof flatWorld>;

function droneAt(w: W, x: number, y: number): Colonist {
  const c = w.makePawn('saqueador');
  makeCreature(w, c, 'dron_vigilancia', 1);
  c.tile = { x, y };
  c.pos = { x: x + 0.5, y: y + 0.5 };
  w.others.push(c);
  return c;
}

function wall(w: W, x: number, y: number): void {
  expect(w.structures.place(x, y, 'muro_madera')).toBe(true);
  w.completeStructure(w.structures.mainAt(x, y)!);
}

function run(w: W, ticks: number, until?: () => boolean): void {
  for (let i = 0; i < ticks && !until?.(); i++) {
    w.tick++;
    updateOthers(w);
  }
}

describe('dron de vigilancia', () => {
  it('tiene los números del catálogo y dispara como una pistola sin gastar munición', () => {
    const d = CREATURES.dron_vigilancia;
    expect(d.fromDay).toBe(30);
    expect(d.health).toBeLessThan(1);
    expect(flies('dron_vigilancia')).toBe(true);
    expect(flies('arana_chatarra')).toBe(false);
    expect(isMachine('dron_vigilancia')).toBe(true);
    expect(MACHINES.drones).toEqual([2, 4]);
    const w = flatWorld(1);
    const drone = droneAt(w, 3, 3);
    expect(drone.name).toBe('Dron de vigilancia 1');
    expect(drone.weapon).toBeNull();
    expect(usableWeapon(drone)?.id).toBe('pistola');
    expect(reachOf(drone, w)).toBe(9);
  });

  it('el vuelo va en línea recta, de casilla en casilla', () => {
    const path = flightPath({ x: 2, y: 3 }, { x: 9, y: 6 });
    expect(path.at(-1)).toEqual({ x: 9, y: 6 });
    expect(path).toHaveLength(7);
    let prev = { x: 2, y: 3 };
    for (const p of path) {
      expect(Math.max(Math.abs(p.x - prev.x), Math.abs(p.y - prev.y))).toBe(1);
      prev = p;
    }
    expect(flightPath({ x: 4, y: 4 }, { x: 4, y: 4 })).toEqual([]);
  });

  it('cruza volando un muro que corta todo el mapa y dispara sin gastar munición', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.tile = { x: 25, y: 10 };
    c.pos = { x: 25.5, y: 10.5 };
    for (let y = 0; y < w.map.height; y++) wall(w, 12, y);
    const drone = droneAt(w, 3, 10);
    run(w, 4000, () => c.health < 1);
    expect(drone.tile.x).toBeGreaterThan(12);
    expect(c.health).toBeLessThan(1);
    expect(drone.ammo).toBe(0);
    expect(drone.raider!.fleeing).toBe(false);
  });

  it('dispara por encima de un muro pegado y a él no le cubre ninguno', () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.tile = { x: 10, y: 10 };
    c.pos = { x: 10.5, y: 10.5 };
    c.weapon = 'pistola';
    c.ammo = 10;
    // El dron, encima de un muro y con otro muro delante: aun así se le ve y él dispara.
    wall(w, 15, 10);
    wall(w, 14, 10);
    const drone = droneAt(w, 15, 10);
    expect(canHit(w, drone, c)).toBe(true);
    expect(canHit(w, c, drone)).toBe(true);
  });

  it('no pisa minas ni alambre: vuela por encima', () => {
    const w = flatWorld(1);
    expect(w.structures.place(8, 10, 'alambre_espino')).toBe(true);
    w.completeStructure(w.structures.mainAt(8, 10)!);
    const drone = droneAt(w, 6, 10);
    drone.path = [{ x: 7, y: 10 }, { x: 8, y: 10 }, { x: 9, y: 10 }];
    for (let i = 0; i < 400 && drone.path.length > 0; i++) w.moveAlongPath(drone);
    expect(drone.tile).toEqual({ x: 9, y: 10 });
    expect(drone.health).toBe(1);
  });

  it('el ataque de máquinas trae arañas y drones; al destruirlo suelta chatarra', () => {
    const w = flatWorld(1);
    const out = startMachines(w, 1, 3);
    expect(out).toHaveLength(4);
    expect(out.filter((o) => o.creature === 'arana_chatarra')).toHaveLength(1);
    expect(out.filter((o) => o.creature === 'dron_vigilancia').map((o) => o.name)).toEqual(['Dron de vigilancia 1', 'Dron de vigilancia 2', 'Dron de vigilancia 3']);
    expect(w.raidGroups.at(-1)!.size).toBe(4);
    expect(w.log.some((l) => l.text.includes('una araña de chatarra y 3 drones de vigilancia'))).toBe(true);
    const d = out[1];
    w.killPawn(d, 'abatido');
    expect(w.corpses).toHaveLength(0);
    expect(w.items.list().some((i) => i.resource === 'chatarra')).toBe(true);
    expect(w.items.list().some((i) => i.resource === 'pistola')).toBe(false);
    expect(w.log.some((l) => l.text.includes('Dron de vigilancia 1 queda destrozado'))).toBe(true);
  });

  it('se guarda y se carga', () => {
    const w = flatWorld(1);
    droneAt(w, 4, 4);
    const w2 = loadWorld(serializeWorld(w));
    const d = w2.others.find((o) => o.creature === 'dron_vigilancia');
    expect(d?.name).toBe('Dron de vigilancia 1');
    expect(usableWeapon(d!)?.id).toBe('pistola');
  });
});
