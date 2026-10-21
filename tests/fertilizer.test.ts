// Abono («Agricultura mejorada», bloque 13 del catálogo): 🍄2 + 🪨1 → 3 de abono en el banco de
// trabajo; con «🟤 Abonar» en un huerto, cada casilla sembrada gasta 1 y da un 25 % más.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { cropDef } from '../src/data/crops';
import { RECIPES, recipeDef } from '../src/data/recipes';
import { unlockedBy } from '../src/sim/research';
import { FERTILIZER_DEF, GrowZones } from '../src/sim/farming';
import { loadWorld, serializeWorld } from '../src/sim/save';

const rect = (x0: number, y0: number, x1 = x0, y1 = y0) => ({ x0, y0, x1, y1 });
type Farmer = { finishFarmWork(x: number, y: number, a: 'sembrar' | 'cosechar' | 'arrancar'): void };

describe('abono', () => {
  it('la receta va en el banco de trabajo y pide «Agricultura mejorada»', () => {
    const r = recipeDef('abono')!;
    expect(r.station).toBe('banco_trabajo');
    expect(r.inputs).toEqual({ setas: 2, piedra: 1 });
    expect(r.outputs).toEqual({ abono: 3 });
    expect(r.research).toBe('agricultura');
    expect(unlockedBy(RECIPES, 'agricultura').map((x) => x.id)).toContain('abono');
    const w = flatWorld(1);
    expect(w.canCraft(r)).toBe(false);
    w.research.done.push('agricultura');
    expect(w.canCraft(r)).toBe(true);
  });

  it('sin investigar no se puede encender «Abonar»', () => {
    const w = flatWorld(1);
    const z = w.createGrowZone(rect(4, 4, 6, 6))!;
    expect(w.setFarmFertilize(z.id, true)).toBe(false);
    expect(z.fertilize).toBeUndefined();
    w.research.done.push('agricultura');
    expect(w.setFarmFertilize(z.id, true)).toBe(true);
    expect(z.fertilize).toBe(true);
    expect(w.setFarmFertilize(z.id, false)).toBe(true);
    expect(z.fertilize).toBeUndefined();
  });

  it('al sembrar en un huerto abonado gasta 1 de abono por casilla; sin abono se siembra igual', () => {
    const w = flatWorld(1);
    w.research.done.push('agricultura');
    const z = w.createGrowZone(rect(4, 4, 6, 4))!;
    w.setFarmFertilize(z.id, true);
    w.items.drop(10, 10, 'abono', 1);
    (w as unknown as Farmer).finishFarmWork(4, 4, 'sembrar');
    expect(w.farms.plantAt(4, 4)?.fertilized).toBe(true);
    expect(w.items.totals().abono ?? 0).toBe(0);
    (w as unknown as Farmer).finishFarmWork(5, 4, 'sembrar');
    expect(w.farms.plantAt(5, 4)).toBeTruthy();
    expect(w.farms.plantAt(5, 4)?.fertilized).toBeUndefined();
  });

  it('un huerto sin «Abonar» no gasta abono', () => {
    const w = flatWorld(1);
    w.research.done.push('agricultura');
    w.createGrowZone(rect(4, 4))!;
    w.items.drop(10, 10, 'abono', 5);
    (w as unknown as Farmer).finishFarmWork(4, 4, 'sembrar');
    expect(w.farms.plantAt(4, 4)?.fertilized).toBeUndefined();
    expect(w.items.totals().abono).toBe(5);
  });

  it('la planta abonada da un 25 % más', () => {
    const w = flatWorld(1);
    w.map.moisture.fill(0.5);
    const farms = new GrowZones(w.map);
    farms.create(rect(0, 0, 1, 0), cropDef('patata'));
    farms.sow(0, 0, true);
    farms.sow(1, 0, false);
    for (const { plant } of farms.plantList()) plant.growth = 1;
    const fixed = () => 10;
    const a = farms.harvest(0, 0, fixed)!.amount;
    const b = farms.harvest(1, 0, fixed)!.amount;
    expect(FERTILIZER_DEF.yieldBonus).toBe(0.25);
    expect(a).toBe(Math.round(b * 1.25));
    expect(a).toBeGreaterThan(b);
  });

  it('se guarda: el huerto con «Abonar» y las plantas abonadas', () => {
    const w = flatWorld(1);
    w.research.done.push('agricultura');
    const z = w.createGrowZone(rect(4, 4, 5, 4))!;
    w.setFarmFertilize(z.id, true);
    w.farms.sow(4, 4, true);
    w.farms.sow(5, 4);
    const back = loadWorld(serializeWorld(w));
    expect(back.farms.at(4, 4)?.fertilize).toBe(true);
    expect(back.farms.plantAt(4, 4)?.fertilized).toBe(true);
    expect(back.farms.plantAt(5, 4)?.fertilized).toBeUndefined();
    // Una partida antigua (sin estos campos) carga sin abono.
    const old = JSON.parse(JSON.stringify(serializeWorld(w))) as { farms: { fertilize?: boolean }[]; plants: { fertilized?: boolean }[] };
    for (const f of old.farms) delete f.fertilize;
    for (const p of old.plants) delete p.fertilized;
    const legacy = loadWorld(old);
    expect(legacy.farms.at(4, 4)?.fertilize).toBeUndefined();
    expect(legacy.farms.plantAt(4, 4)?.fertilized).toBeUndefined();
  });
});
