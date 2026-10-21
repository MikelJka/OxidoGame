// Bloque 8 del catálogo: el mercado (precios que suben y bajan) y lo que necesitan las caravanas.
import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { MARKET } from '../src/data/market';
import { RESOURCE_VALUES } from '../src/data/values';
import { marketDay, marketMult, marketTrade, marketTrend, newMarket } from '../src/sim/market';
import { buyPrice, dealBalance, makeDeal, nextCaravanNeeds, sellPrice, startTrader, TRADER_MARGIN } from '../src/sim/people';
import { loadWorld, serializeWorld } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/sim/time';

describe('mercado', () => {
  it('los números del catálogo', () => {
    expect(MARKET.min).toBe(0.5);
    expect(MARKET.max).toBe(2);
    expect(MARKET.recoveryPerDay).toBe(0.1);
    expect(MARKET.needPremium).toBe(0.5);
    expect(MARKET.surplusDiscount).toBe(0.3);
    expect(MARKET.needs).toEqual([2, 3]);
    expect(MARKET.surplus).toEqual([2, 3]);
  });

  it('vender mucho baja el precio y comprar lo sube, entre el 50 % y el 200 %', () => {
    const m = newMarket();
    marketTrade(m, 'madera', 50); // 50 chapas: −10 %
    expect(marketMult(m, 'madera')).toBeCloseTo(0.9);
    marketTrade(m, 'componentes', 1000);
    expect(marketMult(m, 'componentes')).toBe(0.5);
    marketTrade(m, 'piedra', -10000);
    expect(marketMult(m, 'piedra')).toBe(2);
  });

  it('cada día se recupera un 10 % hacia su valor, y se ve si sube o baja', () => {
    const m = newMarket();
    m.mult.madera = 0.5;
    marketDay(m, 1, 2);
    // Puede haberle tocado un cambio al azar del día; si no, 0,55.
    const v = marketMult(m, 'madera');
    expect(v).toBeGreaterThanOrEqual(0.5);
    expect(v).toBeLessThanOrEqual(0.55 * 1.3 + 1e-9);
    m.prev.piedra = 1;
    m.mult.piedra = 1.2;
    expect(marketTrend(m, 'piedra')).toBe(1);
    m.mult.piedra = 0.9;
    expect(marketTrend(m, 'piedra')).toBe(-1);
    // Siempre igual con la misma semilla y el mismo día.
    const a = newMarket();
    const b = newMarket();
    marketDay(a, 5, 7);
    marketDay(b, 5, 7);
    expect(a).toEqual(b);
  });

  it('la caravana paga +50 % por lo que necesita (y no lo vende) y rebaja un 30 % lo que le sobra', () => {
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    const t = startTrader(w)!;
    const info = t.trader!;
    expect(info.needs!.length).toBeGreaterThanOrEqual(2);
    expect(info.needs!.length).toBeLessThanOrEqual(3);
    for (const r of info.needs!) {
      expect(info.stock[r] ?? 0).toBe(0);
      expect(sellPrice(w, t, r)).toBeCloseTo(RESOURCE_VALUES[r] * 1.5);
    }
    for (const r of info.surplus!) {
      expect(info.stock[r]).toBeGreaterThan(0);
      expect(buyPrice(w, t, r)).toBeCloseTo(RESOURCE_VALUES[r] * TRADER_MARGIN * 0.7);
    }
    // Lo que se vende baja de precio en el mercado.
    w.items.drop(6, 6, 'madera', 75);
    info.needs = [];
    info.surplus = [];
    const deal = { sell: { madera: 50 }, buy: {}, sellPrisoners: [], slaves: [] };
    expect(dealBalance(w, t, deal)).toBeCloseTo(50);
    expect(makeDeal(w, t, deal)).toBeNull();
    expect(marketMult(w.market, 'madera')).toBeCloseTo(0.9);
  });

  it('con «Rutas comerciales» se sabe antes qué necesitará la próxima caravana', () => {
    const w = flatWorld(1);
    w.map.start = { x: 15, y: 15 };
    w.schedule.nextTrader = w.tick + 2 * TICKS_PER_DAY;
    const next = nextCaravanNeeds(w)!;
    expect(next.day).toBe(w.day + 2);
    w.tick = w.schedule.nextTrader;
    const t = startTrader(w)!;
    expect(t.trader!.needs).toEqual(next.needs);
  });

  it('se guarda (y las partidas antiguas empiezan con todo a su valor)', () => {
    const w = flatWorld(1);
    w.market.mult.metal = 1.4;
    w.market.prev.metal = 1.2;
    const back = loadWorld(serializeWorld(w));
    expect(back.market.mult.metal).toBeCloseTo(1.4);
    expect(back.market.prev.metal).toBeCloseTo(1.2);
    const old = JSON.parse(JSON.stringify(serializeWorld(w)));
    delete old.market;
    expect(loadWorld(old).market).toEqual({ mult: {}, prev: {} });
  });
});
