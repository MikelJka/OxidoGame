/** Mercado (bloque 8 del catálogo). Los datos están en `market.json`; aquí, sus tipos y la validación. */
import raw from './market.json';
import { RESOURCES, ResourceId } from './resources';
import { factionDef } from './factions';

export interface MarketRules {
  /** Lo que puede bajar y subir el precio (× su valor). */
  min: number;
  max: number;
  /** Parte de la distancia a su valor que recupera cada día. */
  recoveryPerDay: number;
  /** Lo que baja (al vender) o sube (al comprar) por cada chapa de valor. */
  perChapa: number;
  /** Cambios al azar de cada día (lo que pasa en el resto del mundo): cuántos y de cuánto. */
  shocks: { perDay: [number, number]; size: [number, number] };
  /** Lo que paga de más por lo que necesita (+50 %) y lo que rebaja lo que le sobra (−30 %). */
  needPremium: number;
  surplusDiscount: number;
  /** Cuántas necesidades y sobrantes trae cada caravana. */
  needs: [number, number];
  surplus: [number, number];
  /** Investigación con la que se ve la tendencia (▲ ▼) de los precios. */
  trendResearch: string;
  /** Por facción: de qué recursos salen sus necesidades y sus sobrantes. */
  caravans: Record<string, { needs: ResourceId[]; surplus: ResourceId[] }>;
}

export function validateMarket(d: unknown): MarketRules {
  const m = d as MarketRules;
  const fail = (why: string) => {
    throw new Error(`Mercado no válido: ${why}`);
  };
  if (!m || !(m.min > 0 && m.min < 1 && m.max > 1)) fail('límites');
  if (!(m.recoveryPerDay > 0 && m.recoveryPerDay <= 1) || !(m.perChapa > 0)) fail('recuperación o efecto de las ventas');
  if (!(m.needPremium > 0) || !(m.surplusDiscount > 0 && m.surplusDiscount < 1)) fail('necesidades o sobrantes');
  for (const [f, c] of Object.entries(m.caravans ?? {})) {
    if (!factionDef(f)) fail(`facción desconocida ${f}`);
    for (const r of [...c.needs, ...c.surplus]) if (!RESOURCES.includes(r)) fail(`recurso desconocido ${r}`);
  }
  return m;
}

export const MARKET: MarketRules = validateMarket(raw);
