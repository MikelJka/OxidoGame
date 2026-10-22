import { describe, expect, it } from 'vitest';
import { TUTORIAL_STEPS } from '../src/data/tutorial';
import { BUILDINGS } from '../src/data/buildings';
import { Prop } from '../src/sim/map';
import { advanceTutorial, tutorialCheckDone } from '../src/sim/tutorial';
import { flatWorld } from './helpers';

describe('Primeros pasos', () => {
  it('tiene los cinco pasos aprobados, en orden, y señala construcciones que existen', () => {
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual(['talar', 'almacen', 'huerto', 'cama', 'muro']);
    for (const s of TUTORIAL_STEPS) {
      if (s.target.build) expect(BUILDINGS.some((b) => b.id === s.target.build && b.category === s.target.category)).toBe(true);
      for (const id of s.check.buildings ?? []) expect(BUILDINGS.some((b) => b.id === id)).toBe(true);
    }
  });

  it('en una partida nueva no hay nada hecho', () => {
    const w = flatWorld();
    expect(advanceTutorial(w, TUTORIAL_STEPS, 0)).toBe(0);
  });

  it('avanza paso a paso según lo que hace el jugador', () => {
    const w = flatWorld();
    const map = w.map;
    map.props[10 * map.width + 10] = Prop.DeadTree;
    map.stock[10 * map.width + 10] = 20;
    expect(w.designations.add(10, 10, 'talar')).toBe(true);
    expect(advanceTutorial(w, TUTORIAL_STEPS, 0)).toBe(1);

    expect(w.zones.create({ x0: 2, y0: 12, x1: 4, y1: 14 })).not.toBeNull();
    expect(advanceTutorial(w, TUTORIAL_STEPS, 1)).toBe(2);

    expect(w.farms.create({ x0: 12, y0: 12, x1: 14, y1: 14 })).not.toBeNull();
    expect(advanceTutorial(w, TUTORIAL_STEPS, 2)).toBe(3);

    expect(w.structures.place(20, 20, 'cama')).toBe(true); // un plano ya cuenta
    expect(advanceTutorial(w, TUTORIAL_STEPS, 3)).toBe(4);

    expect(w.structures.place(25, 5, 'muro_piedra')).toBe(true); // cualquier muro vale
    expect(advanceTutorial(w, TUTORIAL_STEPS, 4)).toBe(TUTORIAL_STEPS.length);
  });

  it('no se salta un paso que no está hecho aunque los siguientes sí lo estén', () => {
    const w = flatWorld();
    expect(w.structures.place(20, 20, 'cama')).toBe(true);
    expect(advanceTutorial(w, TUTORIAL_STEPS, 0)).toBe(0);
    expect(tutorialCheckDone(w, TUTORIAL_STEPS[3].check)).toBe(true);
  });

  it('nunca vuelve atrás aunque se quite lo hecho', () => {
    const w = flatWorld();
    expect(advanceTutorial(w, TUTORIAL_STEPS, 2)).toBe(2);
  });
});
