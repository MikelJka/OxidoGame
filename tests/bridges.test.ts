import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { isPassable, Terrain, tileMoveCost } from '../src/sim/map';
import { findPath } from '../src/sim/pathfinding';
import { addResearch, chooseResearch, unlocked } from '../src/sim/research';
import { loadWorld, serializeWorld } from '../src/sim/save';
import type { World } from '../src/sim/world';

/** Un río de norte a sur en las columnas 10–12: agua, agua profunda y agua. */
function river(w: World): void {
  const m = w.map;
  for (let y = 0; y < m.height; y++) {
    m.terrain[y * m.width + 10] = Terrain.Water;
    m.terrain[y * m.width + 11] = Terrain.DeepWater;
    m.terrain[y * m.width + 12] = Terrain.Water;
  }
}

function bridgeRow(w: World, id: string, y: number): void {
  for (let x = 10; x <= 12; x++) {
    expect(w.structures.place(x, y, id)).toBe(true);
    w.completeStructure(w.structures.floorAt(x, y)!);
  }
}

describe('puentes', () => {
  it('de madera (🪵8) y de metal (🔗4), con «Puentes»; la madera aguanta un tercio', () => {
    const wood = buildingDef('puente_madera');
    const metal = buildingDef('puente_metal');
    expect(wood.cost).toEqual({ madera: 8 });
    expect(metal.cost).toEqual({ metal: 4 });
    expect(wood.hp * 3).toBe(metal.hp);
    expect(wood.research).toBe('puentes');
    expect(metal.research).toBe('puentes');
    const w = flatWorld(0);
    expect(unlocked(w.research, wood)).toBe(false);
    chooseResearch(w.research, 'puentes');
    addResearch(w.research, 1e9);
    expect(unlocked(w.research, wood)).toBe(true);
  });

  it('solo van sobre el agua, de cualquier tipo', () => {
    const w = flatWorld(0);
    river(w);
    expect(w.structures.place(5, 5, 'puente_madera')).toBe(false);
    expect(w.structures.place(10, 5, 'puente_madera')).toBe(true);
    expect(w.structures.place(11, 5, 'puente_metal')).toBe(true);
    w.map.terrain[3 * w.map.width + 4] = Terrain.ShallowWater;
    expect(w.structures.place(4, 3, 'puente_madera')).toBe(true);
    // Ni dos en la misma casilla ni un suelo normal en el agua.
    expect(w.structures.place(10, 5, 'puente_metal')).toBe(false);
    expect(w.structures.place(12, 5, 'suelo_madera')).toBe(false);
  });

  it('en el agua profunda cuestan el doble', () => {
    const w = flatWorld(0);
    river(w);
    w.structures.place(10, 5, 'puente_madera');
    w.structures.place(11, 5, 'puente_madera');
    w.structures.place(11, 6, 'puente_metal');
    expect(w.structures.needs(w.structures.floorAt(10, 5)!)).toEqual({ madera: 8 });
    expect(w.structures.needs(w.structures.floorAt(11, 5)!)).toEqual({ madera: 16 });
    expect(w.structures.needs(w.structures.floorAt(11, 6)!)).toEqual({ metal: 8 });
  });

  it('terminados, el río se cruza andando como suelo normal; al quitarlos, ya no', () => {
    const w = flatWorld(0);
    river(w);
    expect(findPath(w.map, { x: 5, y: 8 }, { x: 15, y: 8 })).toBeNull();
    w.structures.place(10, 8, 'puente_madera');
    expect(isPassable(w.map, 10, 8)).toBe(false); // el plano todavía no se pisa
    w.completeStructure(w.structures.floorAt(10, 8)!);
    w.structures.place(11, 8, 'puente_metal');
    w.completeStructure(w.structures.floorAt(11, 8)!);
    w.structures.place(12, 8, 'puente_madera');
    w.completeStructure(w.structures.floorAt(12, 8)!);
    expect(tileMoveCost(w.map, 11, 8)).toBeCloseTo(tileMoveCost(w.map, 5, 8));
    const path = findPath(w.map, { x: 5, y: 8 }, { x: 15, y: 8 });
    expect(path).not.toBeNull();
    expect(path!.some((p) => p.x === 11 && p.y === 8)).toBe(true);
    w.structures.demolish(w.structures.floorAt(11, 8)!);
    expect(isPassable(w.map, 11, 8)).toBe(false);
    expect(findPath(w.map, { x: 5, y: 8 }, { x: 15, y: 8 })).toBeNull();
  });

  it('un colono lo construye desde la orilla con la madera del almacén', () => {
    const w = flatWorld(1);
    river(w);
    w.items.drop(8, 6, 'madera', 10);
    expect(w.structures.place(10, 5, 'puente_madera')).toBe(true);
    const s = w.structures.floorAt(10, 5)!;
    for (let i = 0; i < 20000 && !s.built; i++) w.step();
    expect(s.built).toBe(true);
    expect(isPassable(w.map, 10, 5)).toBe(true);
  });

  it('se guardan con la partida y se siguen cruzando', () => {
    const w = flatWorld(0);
    river(w);
    bridgeRow(w, 'puente_metal', 8);
    const loaded = loadWorld(JSON.stringify(serializeWorld(w)));
    expect(loaded.structures.floorAt(11, 8)?.def.id).toBe('puente_metal');
    expect(isPassable(loaded.map, 11, 8)).toBe(true);
    expect(findPath(loaded.map, { x: 5, y: 8 }, { x: 15, y: 8 })).not.toBeNull();
  });
});
