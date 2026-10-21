/** Estaciones y frío (bloque 11). Los datos están en `seasons.json`. */
import raw from './seasons.json';

export interface SeasonDef {
  id: 'primavera' | 'verano' | 'otono' | 'invierno';
  name: string;
  icon: string;
}

interface SeasonData {
  daysPerSeason: number;
  seasons: SeasonDef[];
  cold: { mood: number; text: string };
  hypothermia: { afterHours: number; healthPerHour: number; floor: number; mood: number; text: string };
  foliage: { spread: number; stages: { id: FoliageStage; from: number }[] };
  snow: { winterDaysToFull: number; coldWaveHoursToFull: number; meltDays: number };
}

/** Cómo están las hojas de un árbol o matorral. */
export type FoliageStage = 'desnudo' | 'brotes' | 'verde' | 'otono' | 'cayendo';

export const SEASONS: SeasonData = raw as unknown as SeasonData;

/** Estación de un día de juego (el 1 es el primero de la primavera). */
export function seasonOf(day: number): SeasonDef {
  const k = Math.floor((Math.max(1, day) - 1) / SEASONS.daysPerSeason) % SEASONS.seasons.length;
  return SEASONS.seasons[k];
}
