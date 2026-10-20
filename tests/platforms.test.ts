import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { canFarm } from '../src/sim/farming';
import { isPassable, Terrain, tileMoveCost } from '../src/sim/map';
import { loadWorld, serializeWorld } from '../src/sim/save';
import type { World } from '../src/sim/world';

/** Un río en las columnas 10–12: poco profunda, agua y profunda. */
function river(w: World): void {
  const m = w.map;
  for (let y = 0; y < m.height; y++) {
    m.terrain[y * m.width + 10] = Terrain.ShallowWater;
    m.terrain[y * m.width + 11] = Terrain.Water;
    m.terrain[y * m.width + 12] = Terrain.DeepWater;
  }
}

function platform(w: World, x: number, y: number, id: string): void {
  expect(w.structures.place(x, y, id)).toBe(true);
  w.completeStructure(w.structures.floorAt(x, y)!);
}

describe('plataformas', () => {
  it('de madera (🪵12) y de metal (🔩10 ⚙️1), con «Puentes»', () => {
    const wood = buildingDef('plataforma_madera');
    const metal = buildingDef('plataforma_metal');
    expect(wood.cost).toEqual({ madera: 12 });
    expect(metal.cost).toEqual({ chatarra: 10, componentes: 1 });
    expect(wood.research).toBe('puentes');
    expect(metal.research).toBe('puentes');
  });

  it('la de madera va en agua poco profunda o normal; la de metal, también en la profunda', () => {
    const w = flatWorld(0);
    river(w);
    expect(w.structures.place(5, 5, 'plataforma_madera')).toBe(false); // en tierra, no
    expect(w.structures.place(10, 5, 'plataforma_madera')).toBe(true);
    expect(w.structures.place(11, 5, 'plataforma_madera')).toBe(true);
    expect(w.structures.place(12, 5, 'plataforma_madera')).toBe(false);
    expect(w.structures.place(12, 6, 'plataforma_metal')).toBe(true);
    expect(w.structures.place(10, 5, 'plataforma_metal')).toBe(false); // ya hay una
    // El precio no cambia en la profunda (eso es de los puentes).
    expect(w.structures.needs(w.structures.floorAt(12, 6)!)).toEqual({ chatarra: 10, componentes: 1 });
  });

  it('terminada, se pisa y encima se construye como en tierra; en un plano o en un puente, no', () => {
    const w = flatWorld(0);
    river(w);
    expect(w.structures.place(11, 5, 'plataforma_madera')).toBe(true);
    expect(w.structures.place(11, 5, 'muro_madera')).toBe(false); // la plataforma aún es un plano
    w.completeStructure(w.structures.floorAt(11, 5)!);
    expect(isPassable(w.map, 11, 5)).toBe(true);
    expect(tileMoveCost(w.map, 11, 5)).toBeCloseTo(tileMoveCost(w.map, 5, 5));
    expect(w.structures.place(11, 5, 'muro_madera')).toBe(true);
    w.completeStructure(w.structures.mainAt(11, 5)!);
    expect(isPassable(w.map, 11, 5)).toBe(false);
    // Encima no va otro suelo, y sobre un puente no se construye.
    platform(w, 11, 7, 'plataforma_madera');
    expect(w.structures.place(11, 7, 'suelo_madera')).toBe(false);
    expect(w.structures.place(11, 9, 'puente_madera')).toBe(true);
    w.completeStructure(w.structures.floorAt(11, 9)!);
    expect(w.structures.place(11, 9, 'muro_madera')).toBe(false);
  });

  it('una cama de 2×1 cabe entre la orilla y la plataforma', () => {
    const w = flatWorld(0);
    river(w);
    platform(w, 10, 5, 'plataforma_madera');
    const bed = buildingDef('cama');
    expect(bed.size).toEqual([2, 1]);
    expect(w.structures.canPlaceDef(bed, 9, 5, 0)).toBe(true);
    expect(w.structures.canPlaceDef(bed, 10, 5, 0)).toBe(false); // la otra mitad, en el agua sin plataforma
  });

  it('en una plataforma no se cultiva', () => {
    const w = flatWorld(0);
    river(w);
    platform(w, 10, 5, 'plataforma_madera');
    expect(canFarm(w.map, 10, 5)).toBe(false);
  });

  it('al quitar la plataforma, lo de encima se viene abajo y se recupera material', () => {
    const w = flatWorld(0);
    river(w);
    platform(w, 11, 5, 'plataforma_madera');
    w.structures.place(11, 5, 'muro_madera');
    w.completeStructure(w.structures.mainAt(11, 5)!);
    const back = w.structures.demolish(w.structures.floorAt(11, 5)!);
    expect(w.structures.mainAt(11, 5)).toBeUndefined();
    expect(isPassable(w.map, 11, 5)).toBe(false);
    expect(back.madera ?? 0).toBeGreaterThan(Math.floor(12 / 2) - 1);
  });

  it('un colono la construye desde la orilla con la madera del almacén', () => {
    const w = flatWorld(1);
    river(w);
    w.items.drop(8, 6, 'madera', 14);
    expect(w.structures.place(10, 5, 'plataforma_madera')).toBe(true);
    const s = w.structures.floorAt(10, 5)!;
    for (let i = 0; i < 20000 && !s.built; i++) w.step();
    expect(s.built).toBe(true);
  });

  it('se guardan con lo de encima', () => {
    const w = flatWorld(0);
    river(w);
    platform(w, 12, 5, 'plataforma_metal');
    w.structures.place(12, 5, 'muro_madera');
    w.completeStructure(w.structures.mainAt(12, 5)!);
    const loaded = loadWorld(JSON.stringify(serializeWorld(w)));
    expect(loaded.structures.floorAt(12, 5)?.def.id).toBe('plataforma_metal');
    expect(loaded.structures.mainAt(12, 5)?.def.id).toBe('muro_madera');
    expect(loaded.structures.onPlatform(12, 5)).toBe(true);
  });
});
