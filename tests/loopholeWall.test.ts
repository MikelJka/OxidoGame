import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { canHit, coverAt, seekCover } from '../src/sim/people';
import { isPassable } from '../src/sim/map';
import { addResearch, chooseResearch, unlocked } from '../src/sim/research';
import { loadWorld, serializeWorld } from '../src/sim/save';
import type { World } from '../src/sim/world';

function wall(w: World, x: number, id: string): void {
  expect(w.structures.place(x, 10, id)).toBe(true);
  w.completeStructure(w.structures.at(x, 10)!);
}

/** Dos colonos con arco en la fila 10, uno en `ax` y otro en `bx`. */
function archers(w: World, ax: number, bx: number) {
  const [a, b] = w.colonists;
  for (const c of [a, b]) {
    c.weapon = 'arco';
    c.ammo = 20;
  }
  a.tile = { x: ax, y: 10 };
  b.tile = { x: bx, y: 10 };
  return [a, b] as const;
}

describe('muro con aspilleras', () => {
  it('de piedra (🪨7) y de metal (🔗6), con 4/5 de la vida del muro normal y con «Fortificación»', () => {
    const stone = buildingDef('muro_aspilleras_piedra');
    const metal = buildingDef('muro_aspilleras_metal');
    expect(stone.cost).toEqual({ piedra: 7 });
    expect(metal.cost).toEqual({ metal: 6 });
    expect(stone.hp).toBe(Math.round(buildingDef('muro_piedra').hp * 0.8));
    expect(metal.hp).toBe(Math.round(buildingDef('muro_metal').hp * 0.8));
    for (const d of [stone, metal]) {
      expect(d.category).toBe('muro');
      expect(d.blocks).toBe(true);
      expect(d.loophole).toBe(0.75);
      expect(d.research).toBe('fortificacion');
    }
    const w = flatWorld(1);
    expect(unlocked(w.research, stone)).toBe(false);
    chooseResearch(w.research, 'fortificacion');
    addResearch(w.research, 1e9);
    expect(unlocked(w.research, stone)).toBe(true);
    expect(unlocked(w.research, metal)).toBe(true);
  });

  it('bloquea el paso y se dispara a través desde los dos lados, con 75 % para quien está pegado', () => {
    const w = flatWorld(2);
    wall(w, 9, 'muro_aspilleras_piedra');
    expect(isPassable(w.map, 9, 10)).toBe(false);
    const [a, b] = archers(w, 8, 14);
    // Desde dentro (pegado) a fuera: se dispara, y el de fuera no tiene cobertura.
    expect(canHit(w, a, b)).toBe(true);
    expect(coverAt(w, a.tile, b.tile)).toBe(0);
    // Desde fuera a dentro: también, pero el de dentro tiene un 75 %.
    expect(canHit(w, b, a)).toBe(true);
    expect(coverAt(w, b.tile, a.tile)).toBeCloseTo(0.75);
    // Pegados los dos, uno a cada lado.
    b.tile = { x: 10, y: 10 };
    expect(canHit(w, a, b)).toBe(true);
    expect(canHit(w, b, a)).toBe(true);
    expect(coverAt(w, a.tile, b.tile)).toBeCloseTo(0.75);
  });

  it('por un muro normal no se dispara desde ningún lado', () => {
    const w = flatWorld(2);
    wall(w, 9, 'muro_piedra');
    const [a, b] = archers(w, 8, 14);
    expect(canHit(w, a, b)).toBe(false);
    expect(canHit(w, b, a)).toBe(false);
    // Lejos del muro, los dos del mismo lado, sí.
    b.tile = { x: 4, y: 10 };
    expect(canHit(w, a, b)).toBe(true);
  });

  it('el arquero reclutado busca cobertura detrás de las aspilleras, no detrás de un muro normal', () => {
    const w = flatWorld(2);
    wall(w, 9, 'muro_aspilleras_metal');
    // Un muro normal dos filas más abajo: detrás de él estaría a salvo, pero no podría disparar.
    expect(w.structures.place(9, 12, 'muro_piedra')).toBe(true);
    w.completeStructure(w.structures.at(9, 12)!);
    const [a, b] = archers(w, 7, 16);
    expect(seekCover(w, a, b)).toBe(true);
    const end = a.path[a.path.length - 1];
    expect(end).toEqual({ x: 8, y: 10 });
  });

  it('se guarda y se carga', () => {
    const w = flatWorld(1);
    wall(w, 9, 'muro_aspilleras_metal');
    const back = loadWorld(serializeWorld(w));
    expect(back.structures.at(9, 10)?.def.id).toBe('muro_aspilleras_metal');
    expect(back.structures.at(9, 10)?.built).toBe(true);
  });
});
