import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { describeTile, isPassable, Terrain, tileMoveCost, TRENCH_DRY, TRENCH_FLOODED } from '../src/sim/map';
import { findPath } from '../src/sim/pathfinding';
import { updateFlooding } from '../src/sim/terrain';
import { loadWorld, serializeWorld } from '../src/sim/save';
import type { World } from '../src/sim/world';

/** Un lago en la columna 5 (agua) y una zanja de oeste a este en la fila 10, de la columna 6 a la 20. */
function moatWorld(colonists = 0): World {
  const w = flatWorld(colonists);
  const m = w.map;
  for (let y = 0; y < m.height; y++) m.terrain[y * m.width + 5] = Terrain.Water;
  for (let x = 6; x <= 20; x++) m.trench[10 * m.width + x] = TRENCH_DRY;
  w.terrainVersion++;
  return w;
}

const at = (w: World, x: number, y: number): number => w.map.trench[y * w.map.width + x];

describe('foso con agua («Hidráulica»)', () => {
  it('sin «Hidráulica» las zanjas siguen secas aunque toquen el agua', () => {
    const w = moatWorld();
    w.step();
    expect(at(w, 6, 10)).toBe(TRENCH_DRY);
    expect(isPassable(w.map, 6, 10)).toBe(true);
  });

  it('con «Hidráulica» se inunda toda zanja unida al agua por un lado, y no se cruza andando', () => {
    const w = moatWorld();
    // Una zanja suelta, sin tocar el agua: se queda seca.
    w.map.trench[25 * w.map.width + 25] = TRENCH_DRY;
    w.research.done.push('puentes', 'hidraulica');
    w.step();
    expect(at(w, 6, 10)).toBe(TRENCH_FLOODED);
    expect(at(w, 20, 10)).toBe(TRENCH_FLOODED);
    expect(at(w, 25, 25)).toBe(TRENCH_DRY);
    expect(isPassable(w.map, 12, 10)).toBe(false);
    expect(tileMoveCost(w.map, 12, 10)).toBe(Infinity);
    expect(describeTile(w.map, 12, 10)).toContain('Foso con agua');
    // De norte a sur hay que rodear el foso (por el este, pasada la columna 20).
    const path = findPath(w.map, { x: 12, y: 8 }, { x: 12, y: 12 });
    expect(path).not.toBeNull();
    expect(path!.every((p) => w.map.trench[p.y * w.map.width + p.x] !== TRENCH_FLOODED)).toBe(true);
    expect(path!.some((p) => p.x > 20)).toBe(true);
  });

  it('solo se inunda pegada por un lado: en diagonal no', () => {
    const w = flatWorld(0);
    const m = w.map;
    m.terrain[5 * m.width + 5] = Terrain.Water;
    m.trench[6 * m.width + 6] = TRENCH_DRY;
    updateFlooding(m, true);
    expect(m.trench[6 * m.width + 6]).toBe(TRENCH_DRY);
    m.trench[6 * m.width + 5] = TRENCH_DRY;
    updateFlooding(m, true);
    expect(m.trench[6 * m.width + 5]).toBe(TRENCH_FLOODED);
    expect(m.trench[6 * m.width + 6]).toBe(TRENCH_FLOODED);
  });

  it('una zanja recién cavada junto al foso se inunda al terminarla; al rellenar el enlace, lo de detrás se seca', () => {
    const w = moatWorld();
    w.research.done.push('puentes', 'hidraulica');
    w.step();
    w.finishTerrainWork(21, 10, 'zanja');
    expect(at(w, 21, 10)).toBe(TRENCH_FLOODED);
    w.finishTerrainWork(6, 10, 'rellenar');
    expect(at(w, 6, 10)).toBe(0);
    expect(at(w, 7, 10)).toBe(TRENCH_DRY);
    expect(at(w, 21, 10)).toBe(TRENCH_DRY);
  });

  it('se cruza por un puente puesto encima del foso', () => {
    const w = moatWorld();
    w.research.done.push('puentes', 'hidraulica');
    w.step();
    expect(w.structures.place(12, 10, 'puente_madera')).toBe(true);
    // Sobre una zanja seca no se puede tender un puente.
    w.map.trench[25 * w.map.width + 25] = TRENCH_DRY;
    expect(w.structures.place(25, 25, 'puente_madera')).toBe(false);
    w.completeStructure(w.structures.floorAt(12, 10)!);
    expect(isPassable(w.map, 12, 10)).toBe(true);
    expect(tileMoveCost(w.map, 12, 10)).toBeLessThan(2);
    const path = findPath(w.map, { x: 12, y: 8 }, { x: 12, y: 12 });
    expect(path!.some((p) => p.x === 12 && p.y === 10)).toBe(true);
  });

  it('quien está dentro de la zanja cuando se inunda sale a una casilla libre', () => {
    const w = moatWorld(1);
    const c = w.colonists[0];
    c.tile = { x: 12, y: 10 };
    c.pos = { x: 12.5, y: 10.5 };
    c.path = [];
    w.research.done.push('puentes', 'hidraulica');
    w.step();
    expect(at(w, 12, 10)).toBe(TRENCH_FLOODED);
    expect(isPassable(w.map, c.tile.x, c.tile.y)).toBe(true);
  });

  it('se guarda y se carga con la partida', () => {
    const w = moatWorld();
    w.research.done.push('puentes', 'hidraulica');
    w.step();
    const back = loadWorld(serializeWorld(w));
    expect(back.map.trench[10 * back.map.width + 12]).toBe(TRENCH_FLOODED);
    expect(isPassable(back.map, 12, 10)).toBe(false);
  });
});
