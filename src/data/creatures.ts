/**
 * Mutantes y criaturas (bloque 2 del catálogo, aprobado por Mikel el 2026-10-18).
 * Los números están en `creatures.json`. Por ahora, los perros mutantes; el bruto y los
 * cadáveres llegan en las partes siguientes.
 */
import data from './creatures.json';

export type CreatureId = 'perro_mutante';

export interface CreatureDef {
  id: CreatureId;
  name: string;
  plural: string;
  emoji: string;
  /** Día desde el que puede llegar. */
  fromDay: number;
  /** Velocidad al andar respecto a un colono. */
  walkSpeed: number;
  /** Vida respecto a un colono (0,6 = cae con el 60 % del daño). */
  health: number;
  /** Daño de su golpe (×1 = puños). */
  damage: number;
  /** Rompe muros y puertas. */
  breaksWalls: boolean;
}

export const CREATURES: Record<CreatureId, CreatureDef> = Object.fromEntries(
  Object.entries(data.creatures).map(([id, d]) => [id, { id, ...d }]),
) as Record<CreatureId, CreatureDef>;

export const CREATURE_IDS = Object.keys(CREATURES) as CreatureId[];

export function isCreature(v: unknown): v is CreatureId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(CREATURES, v);
}

/** Manadas: cada cuántos raids llega una y de qué tamaño. */
export const PACKS = {
  every: data.packs.every,
  everyNearRadiation: data.packs.everyNearRadiation,
  radiationRange: data.packs.radiationRange,
  size: [data.packs.size[0], data.packs.size[1]] as const,
};
