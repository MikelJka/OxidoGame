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
  /** Su relación no cambia nunca (los Piratas del Óxido, siempre hostiles). */
  fixed?: boolean;
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

/** Ayuda de los aliados: cuántos combatientes mandan y cada cuántos días como mucho. */
export interface AllyHelp {
  fighters: [number, number];
  everyDays: number;
}

/** Guerra: días hasta su primer raid propio. */
export interface WarRules {
  firstRaidDays: number;
}

/** Tributo: desde qué día, 1 de cada cuántos raids, cuántas chapas piden y cuántas horas esperan. */
export interface TributeRules {
  fromDay: number;
  every: number;
  value: number;
  hours: number;
}

/** Radio: qué investigación pide y cómo se llama a una caravana. */
export interface RadioRules {
  research: string;
  caravanHours: number;
  caravanEveryDays: number;
  caravanMinRelation: number;
}

interface FactionData {
  extraFactions: FactionDef[];
  newFactions: { minFactions: number; days: [number, number] };
  allyHelp: AllyHelp;
  radio: RadioRules;
  tribute: TributeRules;
  war: WarRules;
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
  const h = data.allyHelp;
  if (!h || !Array.isArray(h.fighters) || !(h.fighters[0] >= 1 && h.fighters[1] >= h.fighters[0]) || !(h.everyDays > 0)) fail('ayuda de los aliados');
  const t = data.tribute;
  if (!t || !(t.fromDay >= 0) || !(t.every >= 1) || !(t.value > 0) || !(t.hours > 0)) fail('tributo');
  const ra = data.radio;
  if (!ra || !ra.research || !(ra.caravanHours >= 0) || !(ra.caravanEveryDays > 0)) fail('radio');
  if (!data.war || !(data.war.firstRaidDays >= 0)) fail('guerra');
  if (!ids.has(data.traderFaction) || !ids.has(data.raiderFaction)) fail('facción de las caravanas o de los raids');
  return data;
}

const DATA = validateFactions(raw);

/** Las de cada partida nueva. */
export const FACTIONS: readonly FactionDef[] = DATA.factions;
/** Las que pueden llegar después, si quedan pocas (opción 4B de Mikel). */
export const EXTRA_FACTIONS: readonly FactionDef[] = DATA.extraFactions ?? [];
export const NEW_FACTIONS = DATA.newFactions;
export const RELATION: RelationRules = DATA.relation;
export const ALLY_HELP: AllyHelp = DATA.allyHelp;
export const WAR: WarRules = DATA.war;
export const TRIBUTE: TributeRules = DATA.tribute;
export const RADIO: RadioRules = DATA.radio;
/** De quién son las caravanas. */
export const TRADER_FACTION = DATA.traderFaction;
/** De quién son los saqueadores. */
export const RAIDER_FACTION = DATA.raiderFaction;

/** Ids antiguos de facciones (partidas guardadas): los Hijos del Óxido pasaron a ser los Piratas del Óxido el 2026-10-21. */
const OLD_IDS: Record<string, string> = { hijos_oxido: 'piratas_oxido' };

/** Id actual de una facción (traduce los antiguos). */
export function factionId(id: string): string {
  return OLD_IDS[id] ?? id;
}

export function factionDef(id: string): FactionDef | undefined {
  const real = factionId(id);
  return FACTIONS.find((f) => f.id === real) ?? EXTRA_FACTIONS.find((f) => f.id === real);
}
