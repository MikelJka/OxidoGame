import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { Terrain } from '../src/sim/map';
import { updatePower } from '../src/sim/power';
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

describe('molino de agua', () => {
  it('cuesta 🪵25 🔩10 ⚙️3, ocupa 1×2, da 500 W y pide «Hidráulica»', () => {
    const d = buildingDef('molino_agua');
    expect(d.cost).toEqual({ madera: 25, chatarra: 10, componentes: 3 });
    expect(d.size).toEqual([1, 2]);
    expect(d.power).toBe(500);
    expect(d.research).toBe('hidraulica');
    const w = flatWorld(0);
    expect(w.canBuild('molino_agua')).toBe(false);
    w.research.done.push('puentes', 'hidraulica');
    expect(w.canBuild('molino_agua')).toBe(true);
  });

  it('solo va en el río (agua poco profunda o normal), entero dentro', () => {
    const w = flatWorld(0);
    river(w);
    expect(w.structures.place(5, 5, 'molino_agua')).toBe(false); // tierra
    expect(w.structures.place(9, 5, 'molino_agua', 1)).toBe(false); // mitad en la orilla
    expect(w.structures.place(12, 5, 'molino_agua')).toBe(false); // profunda
    expect(w.structures.place(11, 4, 'molino_agua', 1)).toBe(false); // una casilla en la profunda
    expect(w.structures.place(10, 5, 'molino_agua')).toBe(true);
    expect(w.structures.place(11, 5, 'molino_agua')).toBe(true);
    expect(w.structures.place(10, 6, 'molino_agua')).toBe(false); // ocupado
    expect(w.structures.place(10, 10, 'molino_agua', 1)).toBe(true); // girado, 2 casillas de ancho
  });

  it('ni sobre un puente ni sobre una plataforma', () => {
    const w = flatWorld(0);
    river(w);
    expect(w.structures.place(10, 5, 'puente_madera')).toBe(true);
    expect(w.structures.place(10, 4, 'molino_agua')).toBe(false);
    expect(w.structures.place(11, 8, 'plataforma_madera')).toBe(true);
    w.completeStructure(w.structures.floorAt(11, 8)!);
    expect(w.structures.place(11, 8, 'molino_agua')).toBe(false);
  });

  it('da 500 W fijos, de día y de noche y sin viento, a un cable de la orilla', () => {
    const w = flatWorld(0);
    river(w);
    expect(w.structures.place(10, 5, 'molino_agua')).toBe(true);
    const mill = w.structures.mainAt(10, 5)!;
    w.completeStructure(mill);
    for (let x = 6; x <= 9; x++) {
      expect(w.structures.place(x, 5, 'cable')).toBe(true);
      w.completeStructure(w.structures.cableAt(x, 5)!);
    }
    expect(w.structures.place(6, 6, 'lampara')).toBe(true);
    const lamp = w.structures.mainAt(6, 6)!;
    w.completeStructure(lamp);
    for (const env of [{ hour: 2, wind: 0 }, { hour: 13, wind: 1 }]) {
      const [net] = updatePower(w.structures, 1, env);
      expect(net.production).toBe(500);
      expect(mill.output).toBe(500);
      expect(lamp.powered).toBe(true);
    }
  });

  it('se guarda y se carga', () => {
    const w = flatWorld(0);
    river(w);
    expect(w.structures.place(11, 5, 'molino_agua')).toBe(true);
    w.completeStructure(w.structures.mainAt(11, 5)!);
    const back = loadWorld(serializeWorld(w));
    const m = back.structures.mainAt(11, 6);
    expect(m?.def.id).toBe('molino_agua');
    expect(m?.built).toBe(true);
  });
});
