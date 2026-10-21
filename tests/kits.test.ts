// Kits: desmontar defensas y energía para guardarlas y montarlas en otro sitio (elegido por Mikel el 2026-10-21).
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef, kitOf } from '../src/data/buildings';
import { loadWorld, serializeWorld } from '../src/sim/save';

describe('kits', () => {
  it('las defensas y la energía se desmontan en kit; los muros, no', () => {
    expect(kitOf(buildingDef('torreta_ligera'))).toBe('kit_torreta_ligera');
    expect(kitOf(buildingDef('bateria'))).toBe('kit_bateria');
    expect(kitOf(buildingDef('muro_madera'))).toBeUndefined();
  });

  it('un colono la desmonta, queda el kit, y montarla pide solo el kit', () => {
    const w = flatWorld(1);
    w.structures.place(10, 10, 'torreta_ligera');
    const t = w.structures.at(10, 10)!;
    w.completeStructure(t);
    expect(w.orderPack(t.id)).toBe(true);
    expect(loadWorld(serializeWorld(w)).structures.at(10, 10)?.pack).toBe(true);
    for (let k = 0; k < 6000 && w.structures.at(10, 10); k++) w.step();
    expect(w.structures.at(10, 10)).toBeUndefined();
    expect(w.inventory().kit_torreta_ligera).toBe(1);
    expect(w.inventory().chatarra).toBe(0);
    // Montarla en otro sitio: el plano pide solo el kit (aunque no se haya investigado «Torretas»).
    expect(w.freeKits('torreta_ligera')).toBe(1);
    expect(w.placeBuildArea({ x0: 20, y0: 20, x1: 20, y1: 20 }, 'torreta_ligera', 'relleno')).toBe(1);
    const plan = w.structures.at(20, 20)!;
    expect(plan.fromKit).toBe(true);
    expect(w.structures.needs(plan)).toEqual({ kit_torreta_ligera: 1 });
    expect(w.freeKits('torreta_ligera')).toBe(0);
    for (let k = 0; k < 6000 && !plan.built; k++) w.step();
    expect(plan.built).toBe(true);
    expect(w.inventory().kit_torreta_ligera).toBe(0);
  });
});
