// Incendio grande (pedido por Mikel el 2026-10-21).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { burning, fuelAt, ignite, updateFires } from '../src/sim/fire';
import { startEvent } from '../src/sim/events';
import { Prop } from '../src/sim/map';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_SECOND } from '../src/sim/time';
import type { World } from '../src/sim/world';

const at = (w: World, x: number, y: number) => y * w.map.width + x;

describe('fuego', () => {
  it('arde lo que tiene combustible: árboles, matorrales, tierra seca, madera; el agua y la roca, no', () => {
    const w = flatWorld(0);
    w.map.props[at(w, 10, 10)] = Prop.DeadTree;
    expect(fuelAt(w, 10, 10)).toBe('tree');
    expect(fuelAt(w, 12, 12)).toBe('soil');
    expect(fuelAt(w, 1, 1)).toBeNull(); // la charca
    w.items.drop(14, 14, 'madera', 10);
    expect(fuelAt(w, 14, 14)).toBe('item');
  });

  it('se extiende por el monte y, consumido, deja la tierra quemada', () => {
    const w = flatWorld(0);
    for (let x = 5; x < 25; x++) for (let y = 5; y < 25; y++) w.map.props[at(w, x, y)] = Prop.DeadTree;
    expect(ignite(w, 15, 15)).toBe(true);
    let max = 0;
    for (let s = 0; s < 400 && w.fires.size > 0; s++) {
      w.tick += TICKS_PER_SECOND;
      updateFires(w);
      max = Math.max(max, w.fires.size);
    }
    expect(max).toBeGreaterThan(20);
    expect(w.map.props[at(w, 15, 15)]).toBe(Prop.None);
    expect(w.burnt.has(at(w, 15, 15))).toBe(true);
  });

  it('quema lo construido con madera y a quien está dentro', () => {
    const w = flatWorld(1);
    expect(w.structures.place(20, 20, 'muro_madera')).toBe(true);
    const wall = w.structures.at(20, 20)!;
    w.completeStructure(wall);
    ignite(w, 20, 20);
    const [c] = w.colonists;
    w.fires.set(at(w, c.tile.x, c.tile.y), 0);
    const hp = wall.hp;
    w.tick += TICKS_PER_SECOND;
    updateFires(w);
    expect(wall.hp).toBeLessThan(hp);
    expect(c.health).toBeLessThan(1);
  });

  it('cerca de la colonia, los colonos lo apagan', () => {
    const w = flatWorld(2);
    w.map.start = { x: 6, y: 6 };
    w.map.props[at(w, 9, 9)] = Prop.Stones; // que no arda la tierra de alrededor
    for (const [x, y] of [[8, 9], [10, 9], [9, 8], [9, 10]]) w.map.props[at(w, x, y)] = Prop.Stones;
    w.map.props[at(w, 9, 9)] = Prop.DeadTree;
    ignite(w, 9, 9);
    let t = 0;
    for (; t < 3000 && burning(w, 9, 9); t++) w.step();
    expect(burning(w, 9, 9)).toBe(false);
    // No se ha consumido solo: sigue el árbol.
    expect(w.map.props[at(w, 9, 9)]).toBe(Prop.DeadTree);
  });

  it('suceso: empieza lejos de la colonia y se guarda', () => {
    const w = flatWorld(0);
    w.map.start = { x: 2, y: 2 };
    for (let x = 20; x < 29; x++) for (let y = 20; y < 29; y++) w.map.props[at(w, x, y)] = Prop.Bush;
    expect(startEvent(w, 'incendio')).toBe(true);
    expect(w.fires.size).toBeGreaterThan(0);
    const back = loadWorld(serializeWorld(w));
    expect(back.fires.size).toBe(w.fires.size);
  });
});

describe('fuego completo (elegido por Mikel el 2026-10-21)', () => {
  it('el fuego corre a favor del viento y en verano más que en invierno', async () => {
    const { windDirection } = await import('../src/sim/fire');
    const { FIRE } = await import('../src/data/fire');
    expect(FIRE.seasonSpread.verano).toBeGreaterThan(FIRE.seasonSpread.invierno);
    // Con el mismo viento, en verano arde más casillas que en invierno.
    const burnt = (day: number) => {
      const w = flatWorld(0);
      w.tick = (day - 1) * 21600;
      for (let x = 2; x < 28; x++) for (let y = 2; y < 28; y++) w.map.props[at(w, x, y)] = Prop.DeadTree;
      ignite(w, 15, 15);
      for (let s = 0; s < 30; s++) {
        w.tick += TICKS_PER_SECOND;
        updateFires(w);
      }
      return { w, n: w.fires.size + w.burnt.size };
    };
    const summer = burnt(12);
    const winter = burnt(32);
    expect([0, 1, 2, 3]).toContain(windDirection(summer.w));
    expect(summer.n).toBeGreaterThan(winter.n);
  });

  it('un montón de ⛽ que arde explota y hiere a quien está al lado', async () => {
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.tile = { x: 11, y: 10 };
    c.pos = { x: 11.5, y: 10.5 };
    w.items.drop(10, 10, 'combustible', 10);
    expect(fuelAt(w, 10, 10)).toBe('item');
    ignite(w, 10, 10);
    const before = c.health;
    w.tick += TICKS_PER_SECOND;
    updateFires(w);
    expect(w.items.at(10, 10)).toBeUndefined();
    expect(c.health).toBeLessThan(before);
    expect(w.log.some((l) => l.text.includes('Explota'))).toBe(true);
  });

  it('un vehículo con ⛽ que se rompe explota; la tormenta eléctrica trae rayos', async () => {
    const { wreckVehicle } = await import('../src/sim/vehicles');
    const w = flatWorld(1);
    const v = { id: w.nextVehicleId++, def: 'buggy', x: 12, y: 12, pos: { x: 12, y: 12 }, path: [], fuel: 5, hp: 0, facing: 1 as const };
    w.vehicles.push(v);
    wreckVehicle(w, v, 'roto', true);
    expect(w.log.some((l) => l.text.includes('Explota el depósito'))).toBe(true);
    expect(w.fires.size).toBeGreaterThan(0);
    // Tormenta: en sus 6 horas cae algún rayo.
    const w2 = flatWorld(0);
    const { runEvents } = await import('../src/sim/events');
    expect(startEvent(w2, 'tormenta_electrica')).toBe(true);
    w2.nextEvent = Infinity;
    for (let h = 0; h < 6; h++) {
      w2.tick += 1;
      w2.tick = Math.ceil(w2.tick / 900) * 900;
      runEvents(w2);
    }
    expect(w2.log.filter((l) => l.text.includes('rayo')).length).toBeGreaterThan(0);
  });

  it('el lanzallamas gasta napalm y prende fuego a la casilla del objetivo', async () => {
    const { WEAPONS } = await import('../src/data/weapons');
    const { attack } = await import('../src/sim/people');
    const { recipeDef } = await import('../src/data/recipes');
    expect(WEAPONS.lanzallamas).toMatchObject({ ammo: 'napalm', ignites: true, reach: 4 });
    expect(recipeDef('fabricar_lanzallamas')!.research).toBe('explosivos');
    expect(recipeDef('hacer_napalm')!.station).toBe('destileria');
    const w = flatWorld(1);
    const c = w.colonists[0];
    c.weapon = 'lanzallamas';
    c.weaponChoice = 'lanzallamas';
    c.ammo = 10;
    c.skills.combate = 20;
    const [r] = (await import('../src/sim/people')).startRaid(w, 1);
    r.tile = { x: c.tile.x + 2, y: c.tile.y };
    r.pos = { x: r.tile.x + 0.5, y: r.tile.y + 0.5 };
    let lit = false;
    for (let k = 0; k < 20 && !lit; k++) {
      if (attack(w, c, r)) lit = burning(w, r.tile.x, r.tile.y);
    }
    expect(lit).toBe(true);
    expect(c.ammo).toBeLessThan(10);
  });
});
