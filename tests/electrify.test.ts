import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { lacksPower, stationSpeed, updatePower } from '../src/sim/power';
import { stationWantsWork } from '../src/sim/jobs';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { recipeDef } from '../src/data/recipes';
import { buildingDef } from '../src/data/buildings';

type W = ReturnType<typeof flatWorld>;

/** Pone y termina una construcción al momento. */
function build(w: W, x: number, y: number, id: string) {
  expect(w.structures.place(x, y, id)).toBe(true);
  const s = id === 'cable' ? w.structures.cableAt(x, y)! : w.structures.mainAt(x, y)!;
  w.completeStructure(s);
  return s;
}

/** Generador con leña de sobra y cable hasta el horno puesto en (14, 10). */
function powerUp(w: W) {
  const gen = build(w, 10, 10, 'generador_lena');
  gen.fuel = 10;
  build(w, 12, 10, 'cable');
  build(w, 13, 10, 'cable');
  return gen;
}

/** Ticks hasta tener `n` de metal fundiendo chatarra en un horno (eléctrico o no, con corriente o no). */
function smeltTicks(electric: boolean, powered: boolean, n = 10): number {
  const w = flatWorld(1);
  const horno = build(w, 14, 10, 'horno');
  if (electric) horno.electric = true;
  const gen = powered ? powerUp(w) : undefined;
  w.items.drop(13, 12, 'chatarra', 40);
  w.structures.setBill(horno, { recipe: recipeDef('fundir_chatarra')!, target: n, paused: false });
  let t = 0;
  for (; t < 40000 && w.inventory().metal < n; t++) {
    if (gen) gen.fuel = 10;
    w.step();
  }
  expect(w.inventory().metal).toBeGreaterThanOrEqual(n);
  return t;
}

describe('electrificar talleres', () => {
  it('horno, cocina y banco se pueden electrificar por 🔩10 ⚙️3 y 300 W; los demás talleres no', () => {
    for (const id of ['horno', 'cocina', 'banco_trabajo']) {
      const e = buildingDef(id).electrify;
      expect(e?.cost).toEqual({ chatarra: 10, componentes: 3 });
      expect(e?.power).toBe(300);
    }
    expect(buildingDef('cantera').electrify).toBeUndefined();
    expect(buildingDef('recicladora').electrify).toBeUndefined();
  });

  it('los colonos traen el material y hacen la obra; mientras, el taller no fabrica', () => {
    const w = flatWorld(1);
    const horno = build(w, 14, 10, 'horno');
    w.structures.setBill(horno, { recipe: recipeDef('fundir_chatarra')!, target: 10, paused: false });
    expect(w.structures.orderElectrify(horno)).toBe(true);
    expect(w.structures.orderElectrify(horno)).toBe(false); // ya pedido
    expect(stationWantsWork(w, horno)).toBe(false);
    expect(w.structures.needs(horno)).toEqual({ chatarra: 10, componentes: 3 });
    w.items.drop(8, 8, 'chatarra', 10);
    w.items.drop(8, 9, 'componentes', 3);
    for (let t = 0; t < 20000 && !horno.electric; t++) w.step();
    expect(horno.electric).toBe(true);
    expect(horno.upgrade).toBeUndefined();
    expect(w.inventory().componentes).toBe(0);
    expect(w.structures.canElectrify(horno)).toBe(false);
    expect(w.log.some((l) => l.text.includes('electrificado'))).toBe(true);
  });

  it('electrificado gasta 300 W de la red; sin corriente no se para', () => {
    const w = flatWorld(1);
    const horno = build(w, 14, 10, 'horno');
    horno.electric = true;
    let nets = updatePower(w.structures, 1);
    expect(horno.powered).toBe(false);
    expect(lacksPower(horno)).toBe(false);
    expect(stationSpeed(horno)).toBe(1);
    powerUp(w);
    nets = updatePower(w.structures, 1);
    expect(nets[0].demand).toBe(300);
    expect(horno.powered).toBe(true);
    expect(stationSpeed(horno)).toBe(2);
    // Sin electrificar no gasta nada aunque esté en la red.
    horno.electric = false;
    nets = updatePower(w.structures, 1);
    expect(nets[0].demand).toBe(0);
    expect(stationSpeed(horno)).toBe(1);
  });

  it('con corriente funde bastante más rápido; electrificado sin corriente, igual que uno normal', () => {
    const normal = smeltTicks(false, false);
    const sinCorriente = smeltTicks(true, false);
    const conCorriente = smeltTicks(true, true);
    expect(sinCorriente).toBe(normal);
    expect(conCorriente).toBeLessThan(normal * 0.8);
  });

  it('cancelar deja a su lado el material traído; demoler devuelve también la mitad de la mejora', () => {
    const w = flatWorld(1);
    const horno = build(w, 14, 10, 'horno');
    w.structures.orderElectrify(horno);
    w.structures.deliver(horno, 'chatarra', 6);
    expect(horno.delivered.chatarra ?? 0).toBe(0); // va a la mejora, no a la tanda
    w.cancelElectrify(horno);
    expect(horno.upgrade).toBeUndefined();
    expect(w.inventory().chatarra).toBe(6);
    w.structures.finishElectrify(horno);
    const back = w.structures.demolish(horno);
    expect(back.chatarra).toBe(Math.floor((10 + 10) * 0.5));
    expect(back.componentes).toBe(1);
  });

  it('se guarda electrificado o a medio electrificar; las partidas antiguas no tienen ninguno', () => {
    const w = flatWorld(1);
    const horno = build(w, 14, 10, 'horno');
    horno.electric = true;
    const cocina = build(w, 14, 14, 'cocina');
    w.structures.orderElectrify(cocina);
    w.structures.deliver(cocina, 'componentes', 2);
    cocina.upgrade!.progress = 50;
    const data = serializeWorld(w);
    const l = loadWorld(JSON.stringify(data));
    expect(l.structures.mainAt(14, 10)?.electric).toBe(true);
    expect(l.structures.mainAt(14, 14)?.upgrade).toEqual({ delivered: { componentes: 2 }, progress: 50 });
    for (const s of data.structures) {
      delete s.electric;
      delete s.upgrade;
    }
    const old = loadWorld(JSON.stringify(data));
    expect(old.structures.mainAt(14, 10)?.electric).toBeUndefined();
    expect(old.structures.mainAt(14, 14)?.upgrade).toBeUndefined();
  });
});
