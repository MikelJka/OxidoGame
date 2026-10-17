// Narrador: decide cuándo pasan cosas (llega un superviviente, un raid, una caravana).
// Determinista con el `Rng` de la partida. Lo que pasa lo aplican las funciones de cada sistema.

/** Día en que puede llegar el primer superviviente, el primer raid y la primera caravana. */
export const FIRST_WANDERER_DAY = 3;
export const FIRST_RAID_DAY = 5;
export const FIRST_TRADER_DAY = 4;

export interface StorySchedule {
  /** Tick del próximo superviviente que pide unirse. */
  nextWanderer: number;
  /** Tick del próximo raid. */
  nextRaid: number;
  /** Tick de la próxima caravana. */
  nextTrader: number;
}

export function initialSchedule(ticksPerDay: number, startTick: number): StorySchedule {
  return {
    nextWanderer: startTick + FIRST_WANDERER_DAY * ticksPerDay,
    nextRaid: startTick + FIRST_RAID_DAY * ticksPerDay,
    nextTrader: startTick + FIRST_TRADER_DAY * ticksPerDay,
  };
}

/** Días entre sucesos (mínimo y máximo). */
export const WANDERER_GAP: [number, number] = [4, 8];
export const RAID_GAP: [number, number] = [3, 6];
export const TRADER_GAP: [number, number] = [4, 7];

/** Tamaño de un raid según el día y la riqueza de la colonia (valor de lo que tiene). */
export function raidSize(day: number, wealth: number, colonists: number): number {
  const base = 1 + Math.floor(day / 6) + Math.floor(wealth / 1500);
  return Math.max(1, Math.min(colonists + 3, base));
}
