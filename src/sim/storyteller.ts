// Narrador: decide cuándo pasan cosas (llega un superviviente, un raid, una caravana).
// Determinista con el `Rng` de la partida. Lo que pasa lo aplican las funciones de cada sistema.
import storyData from '../data/storyteller.json';

/** Día en que puede llegar el primer superviviente, el primer raid y la primera caravana. */
export const FIRST_WANDERER_DAY: number = storyData.wanderers.firstDay;
export const FIRST_RAID_DAY = 5;
export const FIRST_TRADER_DAY = 4;

export interface StorySchedule {
  /** Tick del próximo superviviente que pide unirse. */
  nextWanderer: number;
  /** Tick del próximo raid. */
  nextRaid: number;
  /** Tick de la próxima caravana. */
  nextTrader: number;
  /** Tick del superviviente que atrae la radio de llamada con corriente (sin radio encendida, no hay). */
  nextRadio?: number;
}

export function initialSchedule(ticksPerDay: number, startTick: number, graceDays: number = FIRST_RAID_DAY): StorySchedule {
  return {
    nextWanderer: startTick + FIRST_WANDERER_DAY * ticksPerDay,
    nextRaid: startTick + graceDays * ticksPerDay,
    nextTrader: startTick + FIRST_TRADER_DAY * ticksPerDay,
  };
}

/** Días entre sucesos (mínimo y máximo). */
/** Días entre supervivientes (en `src/data/storyteller.json`). */
export const WANDERER_GAP: [number, number] = [storyData.wanderers.gapDays[0], storyData.wanderers.gapDays[1]];
/** Días entre los supervivientes de más que atrae una radio de llamada con corriente (#21 C). */
export const RADIO_GAP_DAYS: number = storyData.radio.gapDays;
export const RAID_GAP: [number, number] = [3, 6];
export const TRADER_GAP: [number, number] = [4, 7];

/**
 * Tamaño de un raid según el día y la riqueza de la colonia (valor de lo que tiene).
 * `scale` es el multiplicador de la dificultad (1 en Normal).
 */
export function raidSize(day: number, wealth: number, colonists: number, scale = 1): number {
  const base = 1 + Math.floor(day / 6) + Math.floor(wealth / 1500);
  const cap = Math.max(1, Math.ceil((colonists + 3) * scale));
  return Math.max(1, Math.min(cap, Math.round(base * scale)));
}

// --- Dificultad ---------------------------------------------------------------------

export type DifficultyLevel = 'tranquila' | 'normal' | 'dura' | 'brutal';

export interface DifficultyDef {
  label: string;
  /** Explicación corta para el menú. */
  desc: string;
  /** Multiplica el número de saqueadores de cada raid. */
  raidScale: number;
  /** Multiplica los días entre raids (más alto = menos raids). */
  raidGapScale: number;
  /** Multiplica el daño de los golpes de los saqueadores. */
  enemyDamage: number;
  /** Multiplica las provisiones con las que empieza la colonia. */
  supplies: number;
  /** Días sin raids que propone el menú al elegir esta dureza. */
  graceDays: number;
}

export const DIFFICULTIES: Record<DifficultyLevel, DifficultyDef> = {
  tranquila: { label: 'Tranquila', desc: 'Raids pequeños y espaciados, golpes flojos y más provisiones.', raidScale: 0.6, raidGapScale: 1.5, enemyDamage: 0.7, supplies: 1.5, graceDays: 8 },
  normal: { label: 'Normal', desc: 'La partida tal como está pensada.', raidScale: 1, raidGapScale: 1, enemyDamage: 1, supplies: 1, graceDays: FIRST_RAID_DAY },
  dura: { label: 'Dura', desc: 'Raids más grandes y frecuentes; menos provisiones.', raidScale: 1.4, raidGapScale: 0.8, enemyDamage: 1.2, supplies: 0.75, graceDays: 4 },
  brutal: { label: 'Brutal', desc: 'El yermo no perdona: raids el doble de grandes, golpes duros y casi sin provisiones.', raidScale: 2, raidGapScale: 0.6, enemyDamage: 1.5, supplies: 0.5, graceDays: 3 },
};

export const DIFFICULTY_LEVELS = Object.keys(DIFFICULTIES) as DifficultyLevel[];

/** Máximo de días sin raids que se puede elegir. */
export const MAX_GRACE_DAYS = 20;

/** Dificultad de una partida: dureza y días sin raids al empezar. */
export interface Difficulty {
  level: DifficultyLevel;
  graceDays: number;
}

export function isDifficultyLevel(v: unknown): v is DifficultyLevel {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(DIFFICULTIES, v);
}

/** Normaliza una dificultad (de opciones o de una partida guardada); por defecto, Normal. */
export function makeDifficulty(d?: { level?: unknown; graceDays?: unknown } | null): Difficulty {
  const raw = d?.level;
  const level: DifficultyLevel = isDifficultyLevel(raw) ? raw : 'normal';
  const g = d?.graceDays == null ? NaN : Number(d.graceDays);
  const graceDays = Number.isFinite(g) ? Math.max(0, Math.min(MAX_GRACE_DAYS, Math.round(g))) : DIFFICULTIES[level].graceDays;
  return { level, graceDays };
}

/** Días entre raids con la dureza aplicada. */
export function raidGap(level: DifficultyLevel): [number, number] {
  const k = DIFFICULTIES[level].raidGapScale;
  return [Math.max(1, RAID_GAP[0] * k), Math.max(1, RAID_GAP[1] * k)];
}

/** Provisiones iniciales con la dureza aplicada (redondeadas; nunca menos de 0). */
export function scaledSupplies(base: Partial<Record<string, number>>, level: DifficultyLevel): Record<string, number> {
  const k = DIFFICULTIES[level].supplies;
  const out: Record<string, number> = {};
  for (const [r, n] of Object.entries(base)) out[r] = Math.max(0, Math.round((n ?? 0) * k));
  return out;
}
