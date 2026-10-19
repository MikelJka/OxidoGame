// Construir junto a los acantilados (pedido por Mikel el 2026-10-19): los muros, puertas y defensas
// se pueden poner en las pendientes y en el borde del acantilado, para no dejar huecos.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { index, isPassable } from '../src/sim/map';
import { findPath } from '../src/sim/pathfinding';
import { checkWorld } from '../src/sim/diagnostics';
import { buildingDef as st_def } from '../src/data/buildings';

type W = ReturnType<typeof flatWorld>;

/**
 * Meseta (nivel 3) a la derecha de x = 20, con su borde en x = 20: acantilado salvo una pendiente
 * en (20, 15), que es por donde se sube.
 */
function plateau(w: W): void {
  const m = w.map;
  for (let y = 0; y < m.height; y++) {
    for (let x = 20; x < m.width; x++) m.level[index(m, x, y)] = 3;
    m.cliff[index(m, 20, y)] = 1;
  }
  m.cliff[index(m, 20, 15)] = 0;
  m.slope[index(m, 20, 15)] = 1;
}

function runUntil(w: W, done: () => boolean, maxTicks = 40000): void {
  for (let i = 0; i < maxTicks && !done(); i++) w.step();
}

describe('construir junto a los acantilados', () => {
  it('muros, puertas, portones y defensas van en las pendientes; los muebles no', () => {
    const w = flatWorld();
    plateau(w);
    const st = w.structures;
    expect(st.canPlaceDef(st_def('muro_madera'), 20, 15)).toBe(true);
    expect(st.canPlaceDef(st_def('muro_alto_chatarra'), 20, 15)).toBe(true);
    expect(st.canPlaceDef(st_def('puerta_madera'), 20, 15)).toBe(true);
    expect(st.canPlaceDef(st_def('barricada_madera'), 20, 15)).toBe(true);
    expect(st.canPlaceDef(st_def('cama'), 20, 15)).toBe(false);
  });

  it('en el acantilado van muros y defensas, pero no puertas ni muebles', () => {
    const w = flatWorld();
    plateau(w);
    const st = w.structures;
    expect(st.canPlaceDef(st_def('muro_piedra'), 20, 10)).toBe(true);
    expect(st.canPlaceDef(st_def('barricada_madera'), 20, 10)).toBe(true);
    expect(st.canPlaceDef(st_def('puerta_madera'), 20, 10)).toBe(false);
    expect(st.canPlaceDef(st_def('cama'), 20, 10)).toBe(false);
  });

  it('una línea de muro pegada al acantilado sigue por él sin huecos', () => {
    const w = flatWorld();
    plateau(w);
    expect(w.structures.placeArea({ x0: 20, y0: 12, x1: 20, y1: 18 }, 'muro_madera', 'contorno')).toBe(7);
  });

  it('los colonos levantan el muro en la pendiente y ya no se sube por ahí', () => {
    const w = flatWorld(2);
    plateau(w);
    expect(findPath(w.map, { x: 5, y: 5 }, { x: 25, y: 15 })).not.toBeNull();
    w.items.drop(4, 8, 'madera', 40);
    expect(w.structures.place(20, 15, 'muro_madera')).toBe(true);
    // Y otro en el acantilado, de paso.
    expect(w.structures.place(20, 14, 'muro_madera')).toBe(true);
    runUntil(w, () => w.structures.blueprints().length === 0);
    expect(w.structures.blueprints()).toHaveLength(0);
    expect(w.structures.at(20, 15)!.built).toBe(true);
    expect(w.structures.at(20, 14)!.built).toBe(true);
    expect(isPassable(w.map, 20, 15)).toBe(false);
    expect(findPath(w.map, { x: 5, y: 5 }, { x: 25, y: 15 })).toBeNull();
    expect(checkWorld(w)).toEqual([]);
  });

  it('una puerta en la pendiente deja pasar a los colonos', () => {
    const w = flatWorld(1);
    plateau(w);
    w.items.drop(4, 8, 'madera', 40);
    expect(w.structures.place(20, 15, 'puerta_madera')).toBe(true);
    runUntil(w, () => w.structures.blueprints().length === 0);
    expect(w.structures.at(20, 15)!.built).toBe(true);
    expect(findPath(w.map, { x: 5, y: 5 }, { x: 25, y: 15 })).not.toBeNull();
  });
});
