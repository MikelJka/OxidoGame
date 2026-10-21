// Mercado (bloque 8 del catálogo): cada recurso tiene un precio entre el 50 % y el 200 % de su
// valor. Baja al vender mucho, sube al comprar, cambia un poco cada día por lo que pasa en el resto
// del mundo y se recupera un 10 % al día hacia su valor. Las caravanas pagan más por lo que
// necesitan y rebajan lo que les sobra. Puro y determinista: sin Phaser ni DOM.
import { MARKET } from '../data/market';
import { RESOURCES, ResourceId } from '../data/resources';
import { RESOURCE_VALUES } from '../data/values';
import { Rng } from './rng';

export interface MarketState {
  /** Precio de cada recurso respecto a su valor (1 = su valor). Lo que falta, 1. */
  mult: Partial<Record<ResourceId, number>>;
  /** El de ayer (para la tendencia ▲ ▼). */
  prev: Partial<Record<ResourceId, number>>;
}

export function newMarket(): MarketState {
  return { mult: {}, prev: {} };
}

const clamp = (v: number) => Math.max(MARKET.min, Math.min(MARKET.max, v));

/** Precio de mercado de un recurso respecto a su valor. */
export function marketMult(m: MarketState, r: ResourceId): number {
  return m.mult[r] ?? 1;
}

/** Valor de mercado de una unidad, en chapas. */
export function marketValue(m: MarketState, r: ResourceId): number {
  return RESOURCE_VALUES[r] * marketMult(m, r);
}

/** Tendencia desde ayer: 1 sube, −1 baja, 0 igual (cambios de menos del 2 %). */
export function marketTrend(m: MarketState, r: ResourceId): -1 | 0 | 1 {
  const d = marketMult(m, r) - (m.prev[r] ?? 1);
  return d > 0.02 ? 1 : d < -0.02 ? -1 : 0;
}

/** La colonia vende (`n` > 0) o compra (`n` < 0) unidades: el precio baja o sube. */
export function marketTrade(m: MarketState, r: ResourceId, n: number): void {
  if (n === 0) return;
  m.mult[r] = clamp(marketMult(m, r) - n * RESOURCE_VALUES[r] * MARKET.perChapa);
}

/** Un día más: cada precio se acerca un 10 % a su valor y alguno cambia por lo que pasa en el mundo. */
export function marketDay(m: MarketState, seed: number, day: number): void {
  m.prev = { ...m.mult };
  for (const r of RESOURCES) {
    const v = marketMult(m, r);
    const next = v + (1 - v) * MARKET.recoveryPerDay;
    if (Math.abs(next - 1) < 0.005) delete m.mult[r];
    else m.mult[r] = next;
  }
  // Azar propio de cada día (no toca el de la partida).
  const rng = new Rng(((seed ^ 0x3a7c5e11) + day * 0x9e3779b1) >>> 0);
  const shocks = rng.int(MARKET.shocks.perDay[0], MARKET.shocks.perDay[1]);
  for (let i = 0; i < shocks; i++) {
    const r = RESOURCES[rng.int(0, RESOURCES.length - 1)];
    const size = MARKET.shocks.size[0] + rng.next() * (MARKET.shocks.size[1] - MARKET.shocks.size[0]);
    m.mult[r] = clamp(marketMult(m, r) * (rng.chance(0.5) ? 1 + size : 1 - size));
  }
}

/** Lee el mercado de una partida guardada (las antiguas empiezan con todo a su valor). */
export function restoreMarket(saved: unknown): MarketState {
  const out = newMarket();
  if (!saved || typeof saved !== 'object') return out;
  const s = saved as { mult?: Record<string, unknown>; prev?: Record<string, unknown> };
  for (const key of ['mult', 'prev'] as const) {
    for (const [r, v] of Object.entries(s[key] ?? {})) {
      if (RESOURCES.includes(r as ResourceId) && typeof v === 'number' && Number.isFinite(v)) out[key][r as ResourceId] = clamp(v);
    }
  }
  return out;
}
