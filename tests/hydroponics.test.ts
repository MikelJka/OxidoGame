// Bloque 5 del catálogo: la bandeja hidropónica (con «Hidropónica»).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { cycleTrayCrop, trayBlocked, trayCrop, updateHydroponics } from '../src/sim/hydroponics';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/time';

describe('bandeja hidropónica', () => {
  it('los números del catálogo', () => {
    const d = buildingDef('bandeja_hidroponica')!;
    expect(d.cost).toEqual({ chatarra: 10, componentes: 2 });
    expect(d.size).toEqual([1, 2]);
    expect(d.power).toBe(-100);
    expect(d.research).toBe('hidroponica');
    expect(d.hydroponics).toEqual({ speed: 1.5, crops: ['patata', 'maiz', 'hierba'] });
  });

  it('sin corriente o sin tejado no crece; con las dos, madura ×1,5 más rápido y deja la cosecha al lado', () => {
    const w = flatWorld(1);
    expect(w.structures.place(10, 10, 'bandeja_hidroponica')).toBe(true);
    const s = w.structures.at(10, 10)!;
    w.completeStructure(s);
    expect(trayCrop(s)!.id).toBe('patata');
    expect(trayBlocked(w, s)).toBe('sin corriente');
    updateHydroponics(w, 1000);
    expect(s.growth ?? 0).toBe(0);
    // Con corriente y tejado (se simula), crece.
    s.powered = true;
    const roofs = w as unknown as { roofs: Set<number> };
    for (const t of w.structures.tilesOf(s)) roofs.roofs.add(t.y * w.map.width + t.x);
    expect(trayBlocked(w, s)).toBeNull();
    // La patata tarda 3 días en un huerto: aquí 2.
    updateHydroponics(w, TICKS_PER_DAY);
    expect(s.growth).toBeCloseTo(0.5);
    updateHydroponics(w, TICKS_PER_DAY);
    expect(s.growth).toBe(0);
    const crop = w.items.list().find((x) => x.resource === 'patata');
    expect(crop!.amount).toBeGreaterThanOrEqual(16);
    expect(crop!.amount).toBeLessThanOrEqual(24);
    // Cambiar de cultivo empieza de cero; se guarda.
    s.growth = 0.3;
    expect(cycleTrayCrop(s)!.id).toBe('maiz');
    expect(s.growth).toBe(0);
    s.growth = 0.4;
    const back = loadWorld(serializeWorld(w)).structures.all().find((x) => x.def.hydroponics)!;
    expect(back.crop).toBe('maiz');
    expect(back.growth).toBeCloseTo(0.4);
  });
});
