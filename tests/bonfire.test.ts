// Mutantes (bloque 2 del catálogo, cuarta parte): la hoguera quema los cadáveres (elegido por Mikel el 2026-10-20).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import type { Colonist } from '../src/sim/colonist';
import { isLitBonfire, updateBonfireCheer, updateBonfires } from '../src/sim/bonfire';
import { moodOf } from '../src/sim/needs';
import { litTiles } from '../src/sim/power';
import { TICKS_PER_HOUR } from '../src/sim/time';
import { makeCreature } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';

type W = ReturnType<typeof flatWorld>;

function buildNow(w: W, x: number, y: number, id: string) {
  w.structures.place(x, y, id);
  const s = w.structures.at(x, y)!;
  for (const [r, n] of Object.entries(s.def.cost)) w.structures.deliver(s, r as never, n as number);
  w.completeStructure(s);
  return s;
}

function corpseAt(w: W, x: number, y: number): void {
  const c: Colonist = w.makePawn('saqueador');
  makeCreature(w, c, 'perro_mutante', 1);
  c.tile = { x, y };
  c.pos = { x: x + 0.5, y: y + 0.5 };
  w.others.push(c);
  w.killPawn(c, 'heridas', true);
}

/** Avanza hasta que se cumpla `done` (o `max` ticks). Devuelve si se cumplió. */
function until(w: W, done: () => boolean, max = 20000): boolean {
  for (let t = 0; t < max; t++) {
    w.step();
    if (done()) return true;
  }
  return false;
}

describe('🔥 hoguera', () => {
  it('cuesta 🪵5, es un mueble de 1×1 y su depósito de 🪵20 dura un par de días', () => {
    const d = buildingDef('hoguera');
    expect(d.category).toBe('mueble');
    expect(d.cost).toEqual({ madera: 5 });
    expect(d.size).toBeUndefined();
    expect(d.power).toBeUndefined();
    expect(d.burnsCorpses).toBe(true);
    expect(d.fuel).toMatchObject({ resource: 'madera', capacity: 20 });
    expect(d.fuel!.capacity * d.fuel!.hoursPerUnit).toBe(48);
  });

  it('recién hecha está apagada; los colonos la rellenan de leña y se enciende', () => {
    const w = flatWorld(1);
    w.items.drop(4, 10, 'madera', 30);
    const s = buildNow(w, 10, 10, 'hoguera');
    expect(isLitBonfire(s)).toBe(false);
    expect(until(w, () => (s.fuel ?? 0) >= 15)).toBe(true);
    expect(isLitBonfire(s)).toBe(true);
    expect(s.powered).toBe(true);
  });

  it('gasta la leña aunque no queme nada y, sin ella, se apaga', () => {
    const w = flatWorld(1);
    const s = buildNow(w, 10, 10, 'hoguera');
    s.fuel = 20;
    for (let h = 0; h < 47; h++) updateBonfires(w.structures, 1);
    expect(isLitBonfire(s)).toBe(true);
    updateBonfires(w.structures, 1.01);
    expect(s.fuel).toBe(0);
    expect(isLitBonfire(s)).toBe(false);
    expect(s.powered).toBe(false);
  });

  it('con la hoguera encendida, un colono lleva el cadáver y lo quema', () => {
    const w = flatWorld(1);
    const s = buildNow(w, 15, 15, 'hoguera');
    s.fuel = 20;
    corpseAt(w, 8, 12);
    expect(w.corpses).toHaveLength(1);
    let carried = false;
    const burned = until(w, () => {
      if (w.colonists[0].job?.corpse?.body) carried = true;
      return w.corpses.length === 0 && !w.colonists[0].job;
    });
    expect(burned).toBe(true);
    expect(carried).toBe(true);
    expect(w.log.some((e) => e.text.includes('🔥') && e.text.includes('perro mutante'))).toBe(true);
  });

  it('apagada no quema: el cadáver se queda donde está', () => {
    const w = flatWorld(1);
    buildNow(w, 15, 15, 'hoguera');
    corpseAt(w, 8, 12);
    until(w, () => false, 3000);
    expect(w.corpses.map((c) => [c.x, c.y])).toEqual([[8, 12]]);
  });

  it('un colono sin «Transportar» no lleva cadáveres', () => {
    const w = flatWorld(1);
    w.colonists[0].priorities.transportar = 0;
    const s = buildNow(w, 15, 15, 'hoguera');
    s.fuel = 20;
    corpseAt(w, 8, 12);
    until(w, () => false, 3000);
    expect(w.corpses).toHaveLength(1);
  });

  it('si se apaga por el camino, suelta el cadáver donde esté (y se guarda con la partida)', () => {
    const w = flatWorld(1);
    const s = buildNow(w, 25, 25, 'hoguera');
    s.fuel = 20;
    corpseAt(w, 6, 6);
    const c = w.colonists[0];
    expect(until(w, () => !!c.job?.corpse?.body)).toBe(true);
    const diedAt = c.job!.corpse!.body!.diedAt;
    // A cuestas, se guarda donde está quien lo lleva.
    const saved = loadWorld(serializeWorld(w));
    expect(saved.corpses.map((k) => [k.x, k.y])).toEqual([[c.tile.x, c.tile.y]]);
    for (let i = 0; i < 5; i++) w.step();
    s.fuel = 0;
    w.step();
    expect(c.job).toBeNull();
    expect(w.corpses).toHaveLength(1);
    expect(w.corpses[0]).toMatchObject({ x: c.tile.x, y: c.tile.y, diedAt });
  });

  it('el depósito de leña se guarda con la partida', () => {
    const w = flatWorld(1);
    const s = buildNow(w, 10, 10, 'hoguera');
    s.fuel = 12.5;
    const t = loadWorld(serializeWorld(w)).structures.at(10, 10)!;
    expect(t.fuel).toBeCloseTo(12.5);
  });

  it('se apaga y, con 🪵 en el almacén, los colonos la vuelven a llenar', () => {
    const w = flatWorld(1);
    const z = w.zones.create({ x0: 2, y0: 12, x1: 4, y1: 14 })!;
    expect(z).toBeTruthy();
    w.items.drop(3, 13, 'madera', 25);
    const s = buildNow(w, 12, 12, 'hoguera');
    s.fuel = 0;
    updateBonfires(w.structures, 1);
    expect(isLitBonfire(s)).toBe(false);
    expect(until(w, () => (s.fuel ?? 0) >= 15)).toBe(true);
    expect(isLitBonfire(s)).toBe(true);
  });

  it('encendida da luz como una lámpara (3 casillas); apagada, no', () => {
    const w = flatWorld(1);
    const s = buildNow(w, 10, 10, 'hoguera');
    const at = (x: number, y: number) => y * w.map.width + x;
    expect(litTiles(w.structures).has(at(10, 10))).toBe(false);
    s.fuel = 10;
    updateBonfires(w.structures, 0.01);
    const lit = litTiles(w.structures);
    expect(lit.has(at(13, 10))).toBe(true);
    expect(lit.has(at(14, 10))).toBe(false);
  });

  it('de noche, quien está a 3 casillas o menos gana un 5 % de ánimo que le dura 2 horas', () => {
    const w = flatWorld(2);
    const [near, far] = w.colonists;
    const s = buildNow(w, 10, 10, 'hoguera');
    s.fuel = 10;
    near.tile = { x: 13, y: 12 };
    far.tile = { x: 14, y: 10 };
    const warm = (c: Colonist, t: number) => moodOf(c, t).reasons.find((r) => r.text === 'Junto a la hoguera');
    updateBonfireCheer(w.structures, w.colonists, w.tick, TICKS_PER_HOUR, false);
    expect(warm(near, w.tick)).toBeUndefined();
    updateBonfireCheer(w.structures, w.colonists, w.tick, TICKS_PER_HOUR, true);
    expect(warm(near, w.tick)?.value).toBe(0.05);
    expect(warm(far, w.tick)).toBeUndefined();
    expect(warm(near, w.tick + 2 * TICKS_PER_HOUR - 1)).toBeTruthy();
    expect(warm(near, w.tick + 2 * TICKS_PER_HOUR)).toBeUndefined();
    // Se guarda con la partida.
    const t = loadWorld(serializeWorld(w)).colonists.find((k) => k.id === near.id)!;
    expect(t.needs.fireUntil).toBe(near.needs.fireUntil);
    // Apagada, nada.
    far.tile = { x: 11, y: 10 };
    s.fuel = 0;
    updateBonfires(w.structures, 0.01);
    updateBonfireCheer(w.structures, w.colonists, w.tick, TICKS_PER_HOUR, true);
    expect(warm(far, w.tick)).toBeUndefined();
  });
});
