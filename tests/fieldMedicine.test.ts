// «Medicina de campo» (opción A, elegida por Mikel el 2026-10-20): la mesa de boticario y la
// hierba curativa la piden; la 💊 de ruinas y caravanas sigue saliendo.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { buildingDef } from '../src/data/buildings';
import { CROPS, cropDef } from '../src/data/crops';
import { researchDef } from '../src/data/research';
import { researchCost } from '../src/sim/research';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_HOUR } from '../src/sim/world';

const rect = (x0: number, y0: number, x1 = x0, y1 = y0) => ({ x0, y0, x1, y1 });

describe('«Medicina de campo»', () => {
  it('la mesa de boticario y la hierba curativa la piden; los demás cultivos, no', () => {
    expect(buildingDef('mesa_boticario').research).toBe('medicina_campo');
    expect(cropDef('hierba')!.research).toBe('medicina_campo');
    expect(CROPS.filter((c) => c.research).map((c) => c.id)).toEqual(['hierba']);
  });

  it('sin investigar no se pone la mesa ni se elige la hierba; investigada, sí', () => {
    const w = flatWorld(1);
    expect(w.canBuild('mesa_boticario')).toBe(false);
    expect(w.placeBuildArea(rect(10, 10), 'mesa_boticario', 'relleno')).toBe(0);
    const z = w.createGrowZone(rect(4, 4, 6, 6))!;
    expect(z).toBeTruthy();
    const hierba = cropDef('hierba')!;
    expect(w.canPlant(hierba)).toBe(false);
    expect(w.setFarmCrop(z.id, hierba)).toBe(false);
    expect(z.crop.id).not.toBe('hierba');
    // Otro cultivo, sin problema.
    expect(w.setFarmCrop(z.id, cropDef('maiz')!)).toBe(true);
    expect(z.crop.id).toBe('maiz');

    w.research.done.push('medicina_campo');
    expect(w.canBuild('mesa_boticario')).toBe(true);
    expect(w.placeBuildArea(rect(10, 10), 'mesa_boticario', 'relleno')).toBe(1);
    expect(w.setFarmCrop(z.id, hierba)).toBe(true);
    expect(z.crop.id).toBe('hierba');
  });

  it('al terminarla, el diario dice que ya se puede construir la mesa y plantar la hierba', () => {
    const w = flatWorld(1);
    w.colonists[0].skills.investigacion = 10;
    w.structures.place(8, 8, 'banco_investigacion');
    w.completeStructure(w.structures.at(8, 8)!);
    expect(w.setResearch('medicina_campo')).toBe(true);
    w.research.progress.medicina_campo = researchCost(researchDef('medicina_campo')!) * 0.98;
    for (let t = 0; t < TICKS_PER_HOUR * 3 && !w.research.done.includes('medicina_campo'); t++) w.step();
    expect(w.research.done).toContain('medicina_campo');
    const line = w.log.find((l) => l.text.includes('Medicina de campo'))!.text;
    expect(line).toContain('Ya se puede construir: Mesa de boticario');
    expect(line).toContain('Ya se puede plantar: Hierba curativa');
  });

  it('en una partida empezada, la mesa construida y el huerto de hierba se quedan', () => {
    const w = flatWorld(1);
    w.structures.place(10, 10, 'mesa_boticario');
    w.completeStructure(w.structures.at(10, 10)!);
    const z = w.createGrowZone(rect(4, 4, 6, 6))!;
    w.farms.setCrop(z.id, cropDef('hierba')!); // como lo dejó una versión anterior
    const back = loadWorld(serializeWorld(w));
    expect(back.structures.at(10, 10)?.def.id).toBe('mesa_boticario');
    expect(back.structures.at(10, 10)?.built).toBe(true);
    const bz = back.farms.at(5, 5)!;
    expect(bz.crop.id).toBe('hierba');
    // Se sigue sembrando hierba ahí, pero no se pueden poner mesas nuevas hasta investigar.
    expect(back.farms.sow(5, 5)).toBe(true);
    expect(back.canBuild('mesa_boticario')).toBe(false);
  });
});
