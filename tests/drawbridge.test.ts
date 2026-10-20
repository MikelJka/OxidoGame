import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { isPassable, Terrain } from '../src/sim/map';
import { updateDrawbridges } from '../src/sim/drawbridge';
import { findPath } from '../src/sim/pathfinding';
import { loadWorld, serializeWorld } from '../src/sim/save';
import type { Structure } from '../src/sim/structures';
import type { World } from '../src/sim/world';

/** Un río de norte a sur en las columnas 10–13: agua, profunda, profunda y agua. */
function river(w: World): void {
  const m = w.map;
  for (let y = 0; y < m.height; y++) {
    m.terrain[y * m.width + 10] = Terrain.Water;
    m.terrain[y * m.width + 11] = Terrain.DeepWater;
    m.terrain[y * m.width + 12] = Terrain.DeepWater;
    m.terrain[y * m.width + 13] = Terrain.Water;
  }
}

/** Un puente levadizo terminado de orilla a orilla en (10, 5)–(13, 6). */
function drawbridge(w: World): Structure {
  expect(w.structures.place(10, 5, 'puente_levadizo')).toBe(true);
  const s = w.structures.mainAt(10, 5)!;
  w.completeStructure(s);
  return s;
}

describe('puente levadizo', () => {
  it('cuesta 🔗12 ⚙️3, ocupa 4×2, gasta 20 W y pide «Hidráulica»', () => {
    const d = buildingDef('puente_levadizo');
    expect(d.cost).toEqual({ metal: 12, componentes: 3 });
    expect(d.size).toEqual([4, 2]);
    expect(d.power).toBe(-20);
    expect(d.research).toBe('hidraulica');
    const w = flatWorld(0);
    expect(w.canBuild('puente_levadizo')).toBe(false);
    w.research.done.push('puentes', 'hidraulica');
    expect(w.canBuild('puente_levadizo')).toBe(true);
  });

  it('va sobre el agua (puede apoyarse en la orilla), nunca del todo en tierra', () => {
    const w = flatWorld(0);
    river(w);
    expect(w.structures.place(2, 10, 'puente_levadizo')).toBe(false); // todo en tierra
    expect(w.structures.place(8, 10, 'puente_levadizo')).toBe(true); // de la orilla al agua
    expect(w.structures.place(11, 20, 'puente_levadizo', 1)).toBe(true); // girado, 2×4
    expect(w.structures.place(10, 11, 'puente_levadizo')).toBe(false); // ocupado
    expect(w.structures.place(12, 2, 'puente_madera')).toBe(true);
    expect(w.structures.place(10, 1, 'puente_levadizo')).toBe(false); // encima de un puente
  });

  it('bajado se cruza el río; alzado no pasa nadie', () => {
    const w = flatWorld(0);
    river(w);
    const s = drawbridge(w);
    expect(isPassable(w.map, 11, 5)).toBe(true);
    expect(findPath(w.map, { x: 8, y: 5 }, { x: 15, y: 5 }, 4000)).not.toBeNull();
    expect(w.toggleDrawbridge(s)).toBe(true);
    expect(s.raised).toBe(true);
    expect(isPassable(w.map, 11, 5)).toBe(false);
    expect(isPassable(w.map, 10, 6)).toBe(false);
    expect(findPath(w.map, { x: 8, y: 5 }, { x: 15, y: 5 }, 4000)).toBeNull();
    w.toggleDrawbridge(s);
    expect(s.raised).toBe(false);
    expect(isPassable(w.map, 11, 5)).toBe(true);
  });

  it('con corriente se alza solo al empezar un raid y baja al acabar; sin corriente, no', () => {
    const w = flatWorld(0);
    river(w);
    const s = drawbridge(w);
    s.powered = false;
    updateDrawbridges(w, true);
    expect(s.raised).toBeFalsy();
    s.powered = true;
    updateDrawbridges(w, true);
    expect(s.raised).toBe(true);
    updateDrawbridges(w, false);
    expect(s.raised).toBe(false);
  });

  it('a mano manda: bajado durante el raid se queda bajado, y alzado a mano no baja al acabar', () => {
    const w = flatWorld(0);
    river(w);
    const s = drawbridge(w);
    s.powered = true;
    updateDrawbridges(w, true);
    w.toggleDrawbridge(s);
    updateDrawbridges(w, true);
    expect(s.raised).toBe(false);
    updateDrawbridges(w, false);
    w.toggleDrawbridge(s);
    expect(s.raised).toBe(true);
    updateDrawbridges(w, false);
    expect(s.raised).toBe(true);
  });

  it('no se alza con alguien encima: espera a que se baje', () => {
    const w = flatWorld(1);
    river(w);
    const s = drawbridge(w);
    const c = w.colonists[0];
    c.tile = { x: 11, y: 6 };
    c.pos = { x: 11.5, y: 6.5 };
    w.toggleDrawbridge(s);
    expect(s.wantUp).toBe(true);
    expect(s.raised).toBeFalsy();
    c.tile = { x: 8, y: 6 };
    c.pos = { x: 8.5, y: 6.5 };
    updateDrawbridges(w, false);
    expect(s.raised).toBe(true);
  });

  it('se guarda alzado y sigue sin dejar pasar al cargar', () => {
    const w = flatWorld(0);
    river(w);
    const s = drawbridge(w);
    w.toggleDrawbridge(s);
    const back = loadWorld(serializeWorld(w));
    const t = back.structures.mainAt(10, 5)!;
    expect(t.def.id).toBe('puente_levadizo');
    expect(t.raised).toBe(true);
    expect(t.wantUp).toBe(true);
    expect(isPassable(back.map, 11, 5)).toBe(false);
    back.toggleDrawbridge(t);
    expect(isPassable(back.map, 11, 5)).toBe(true);
  });
});
