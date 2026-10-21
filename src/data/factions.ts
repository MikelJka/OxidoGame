/** Facciones (bloque 7 del catálogo). Los datos están en `factions.json`; aquí, sus tipos y la validación. */
import raw from './factions.json';

export interface FactionDef {
  id: string;
  name: string;
  icon: string;
  /** Relación con la que empieza cada partida (−100 a 100). */
  start: number;
  description: string;
  /** Nombres posibles de su asentamiento (sale uno al azar en cada partida). */
  settlements: string[];
}

export interface RelationRules {
  min: number;
  max: number;
  /** Con esto o más, alianza. */
  ally: number;
  /** Con esto o menos, guerra. */
  war: number;
  /** Chapas regaladas por cada punto de relación. */
  giftValuePerPoint: number;
  releasePrisoner: number;
  tradeCaravan: number;
  killOrHold: number;
  refuseTribute: number;
}

interface FactionData {
  factions: FactionDef[];
  relation: RelationRules;
  traderFaction: string;
  raiderFaction: string;
}

export function validateFactions(d: unknown): FactionData {
  const data = d as FactionData;
  const fail = (why: string) => {
    throw new Error(`Facciones no válidas: ${why}`);
  };
  if (!data || !Array.isArray(data.factions) || data.factions.length === 0) fail('sin facciones');
  const r = data.relation;
  if (!r || !(r.min < r.war && r.war < r.ally && r.ally <= r.max)) fail('umbrales de relación');
  if (!(r.giftValuePerPoint > 0)) fail('valor del regalo');
  const ids = new Set<string>();
  for (const f of data.factions) {
    if (!f.id || !f.name || ids.has(f.id)) fail(`id repetido o sin nombre: ${f.id}`);
    ids.add(f.id);
    if (!(f.start >= r.min && f.start <= r.max)) fail(`relación inicial de ${f.id}`);
    if (!Array.isArray(f.settlements) || f.settlements.length === 0) fail(`asentamientos de ${f.id}`);
  }
  if (!ids.has(data.traderFaction) || !ids.has(data.raiderFaction)) fail('facción de las caravanas o de los raids');
  return data;
}

const DATA = validateFactions(raw);

export const FACTIONS: readonly FactionDef[] = DATA.factions;
export const RELATION: RelationRules = DATA.relation;
/** De quién son las caravanas. */
export const TRADER_FACTION = DATA.traderFaction;
/** De quién son los saqueadores. */
export const RAIDER_FACTION = DATA.raiderFaction;

export function factionDef(id: string): FactionDef | undefined {
  return FACTIONS.find((f) => f.id === id);
}
