/** Mapa del mundo y bases de las facciones. Los datos están en `worldmap.json`. */
import raw from './worldmap.json';

export interface BaseLevel {
  id: string;
  name: string;
  /** Población desde la que una base es de este nivel. */
  population: number;
}

export interface WorldMapRules {
  /** Casillas del mapa del mundo [ancho, alto]. */
  size: [number, number];
  /** Distancia (en casillas del mundo) de cada base a la colonia [mínimo, máximo]. */
  baseDistance: [number, number];
  /** Días de viaje por casilla del mundo. */
  travelDaysPerCell: number;
  start: { population: [number, number]; wealth: [number, number]; defenses: [number, number] };
  /** Cada `everyDays` días: gente y defensas de más, y por cada `wealthPerExtra` chapas de riqueza, otra persona. */
  growth: { everyDays: number; population: [number, number]; defenses: [number, number]; wealthPerExtra: number };
  levels: BaseLevel[];
}

export const WORLD_MAP: WorldMapRules = raw as unknown as WorldMapRules;

/** Nivel de una base según su población. */
export function baseLevel(population: number): BaseLevel {
  let out = WORLD_MAP.levels[0];
  for (const l of WORLD_MAP.levels) if (population >= l.population) out = l;
  return out;
}
