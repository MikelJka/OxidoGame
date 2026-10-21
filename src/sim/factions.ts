// Facciones (bloque 7 del catálogo, primera parte): tres asentamientos con su relación con la
// colonia (−100 a 100), que sube al comerciar, regalar o liberar a los suyos y baja al matarlos o
// retenerlos. Puro y determinista: sin Phaser ni DOM.
import { FACTIONS, factionDef, factionId, RELATION } from '../data/factions';
import { Rng } from './rng';
import type { FactionBase } from './worldmap';

export interface FactionState {
  id: string;
  /** Nombre de su asentamiento en esta partida. */
  settlement: string;
  /** −100 a 100. */
  relation: number;
  /** Tick de la última vez que mandaron ayuda (aliados). */
  helpAt?: number;
  /** En guerra: tick de su próximo raid propio. */
  warRaidAt?: number;
  /** Tick de la última vez que se les llamó por radio para que manden una caravana. */
  calledAt?: number;
  /** Su base en el mapa del mundo. */
  base?: FactionBase;
}

/** Las facciones de una partida nueva: nombres sacados de la semilla del mapa (sin tocar el azar de la partida). */
export function createFactions(seed: number): FactionState[] {
  const rng = new Rng((seed ^ 0x6fac7105) >>> 0);
  return FACTIONS.map((f) => ({ id: f.id, settlement: f.settlements[rng.int(0, f.settlements.length - 1)], relation: f.start }));
}

export function clampRelation(v: number): number {
  return Math.max(RELATION.min, Math.min(RELATION.max, Math.round(v)));
}

/** Hostiles (−50 o menos: en guerra), neutrales o aliados (60 o más). */
export type RelationLevel = 'hostil' | 'neutral' | 'aliado';

export function relationLevel(v: number): RelationLevel {
  if (v <= RELATION.war) return 'hostil';
  if (v >= RELATION.ally) return 'aliado';
  return 'neutral';
}

export const RELATION_LEVEL_NAMES: Record<RelationLevel, string> = {
  hostil: 'Hostiles',
  neutral: 'Neutrales',
  aliado: 'Aliados',
};

/**
 * Cambia la relación con una facción. Devuelve el nivel nuevo si ha cambiado de nivel
 * (para avisar en el diario), o null.
 */
export function shiftRelation(list: FactionState[], id: string, delta: number): { faction: FactionState; from: RelationLevel; to: RelationLevel } | null {
  const f = list.find((k) => k.id === id);
  // La de los Piratas del Óxido no cambia nunca: siempre hostiles.
  if (!f || !factionDef(id) || factionDef(id)!.fixed || delta === 0) return null;
  const from = relationLevel(f.relation);
  f.relation = clampRelation(f.relation + delta);
  const to = relationLevel(f.relation);
  return from === to ? null : { faction: f, from, to };
}

/** Puntos de relación por un regalo de `value` chapas. */
export function giftPoints(value: number): number {
  return Math.max(0, Math.floor(value / RELATION.giftValuePerPoint));
}

/** Lee las facciones de una partida guardada; lo que falte (partidas antiguas) sale como en una nueva. */
export function restoreFactions(saved: unknown, seed: number, destroyed: readonly string[] = []): FactionState[] {
  const base = createFactions(seed).filter((f) => !destroyed.includes(f.id));
  if (!Array.isArray(saved)) return base;
  // Las que llegaron después (no son de las de partida nueva).
  for (const k of saved) {
    const id = k && typeof k === 'object' ? factionId(String((k as FactionState).id)) : '';
    const def = factionDef(id);
    if (!def || base.some((f) => f.id === id) || FACTIONS.some((f) => f.id === id) || destroyed.includes(id)) continue;
    base.push({ id, settlement: def.settlements[0], relation: def.start });
  }
  for (const f of base) {
    const s = saved.find((k) => k && typeof k === 'object' && factionId(String((k as FactionState).id)) === f.id) as Partial<FactionState> | undefined;
    if (!s) continue;
    const fb = s.base as Partial<FactionBase> | undefined;
    if (fb && [fb.x, fb.y, fb.population, fb.wealth, fb.defenses, fb.grownAt].every((v) => typeof v === 'number' && Number.isFinite(v))) f.base = { ...(fb as FactionBase) };
    if (typeof s.settlement === 'string' && s.settlement) f.settlement = s.settlement;
    // Los que no cambian (los Piratas del Óxido) siguen con la suya de siempre.
    if (factionDef(f.id)?.fixed) continue;
    if (typeof s.relation === 'number' && Number.isFinite(s.relation)) f.relation = clampRelation(s.relation);
    if (typeof s.helpAt === 'number' && Number.isFinite(s.helpAt)) f.helpAt = s.helpAt;
    if (typeof s.warRaidAt === 'number' && Number.isFinite(s.warRaidAt)) f.warRaidAt = s.warRaidAt;
    if (typeof s.calledAt === 'number' && Number.isFinite(s.calledAt)) f.calledAt = s.calledAt;
  }
  return base;
}
