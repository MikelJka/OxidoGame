// Facciones (bloque 7 del catálogo, primera parte): tres asentamientos con su relación con la
// colonia (−100 a 100), que sube al comerciar, regalar o liberar a los suyos y baja al matarlos o
// retenerlos. Puro y determinista: sin Phaser ni DOM.
import { FACTIONS, factionDef, RELATION } from '../data/factions';
import { Rng } from './rng';

export interface FactionState {
  id: string;
  /** Nombre de su asentamiento en esta partida. */
  settlement: string;
  /** −100 a 100. */
  relation: number;
  /** Tick de la última vez que mandaron ayuda (aliados). */
  helpAt?: number;
}

export type RelationLevel = 'guerra' | 'hostil' | 'neutral' | 'amistosa' | 'alianza';

/** Las facciones de una partida nueva: nombres sacados de la semilla del mapa (sin tocar el azar de la partida). */
export function createFactions(seed: number): FactionState[] {
  const rng = new Rng((seed ^ 0x6fac7105) >>> 0);
  return FACTIONS.map((f) => ({ id: f.id, settlement: f.settlements[rng.int(0, f.settlements.length - 1)], relation: f.start }));
}

export function clampRelation(v: number): number {
  return Math.max(RELATION.min, Math.min(RELATION.max, Math.round(v)));
}

export function relationLevel(v: number): RelationLevel {
  if (v <= RELATION.war) return 'guerra';
  if (v >= RELATION.ally) return 'alianza';
  if (v < -10) return 'hostil';
  if (v > 10) return 'amistosa';
  return 'neutral';
}

export const RELATION_LEVEL_NAMES: Record<RelationLevel, string> = {
  guerra: 'En guerra',
  hostil: 'Hostil',
  neutral: 'Neutral',
  amistosa: 'Amistosa',
  alianza: 'Alianza',
};

/**
 * Cambia la relación con una facción. Devuelve el nivel nuevo si ha cambiado de nivel
 * (para avisar en el diario), o null.
 */
export function shiftRelation(list: FactionState[], id: string, delta: number): { faction: FactionState; from: RelationLevel; to: RelationLevel } | null {
  const f = list.find((k) => k.id === id);
  if (!f || !factionDef(id) || delta === 0) return null;
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
export function restoreFactions(saved: unknown, seed: number): FactionState[] {
  const base = createFactions(seed);
  if (!Array.isArray(saved)) return base;
  for (const f of base) {
    const s = saved.find((k) => k && typeof k === 'object' && (k as FactionState).id === f.id) as Partial<FactionState> | undefined;
    if (!s) continue;
    if (typeof s.settlement === 'string' && s.settlement) f.settlement = s.settlement;
    if (typeof s.relation === 'number' && Number.isFinite(s.relation)) f.relation = clampRelation(s.relation);
    if (typeof s.helpAt === 'number' && Number.isFinite(s.helpAt)) f.helpAt = s.helpAt;
  }
  return base;
}
