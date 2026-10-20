/**
 * Mutantes y criaturas (bloque 2 del catálogo, aprobado por Mikel el 2026-10-18).
 * Los números están en `creatures.json`: perros mutantes, brutos mutantes y sus cadáveres, y las
 * máquinas del bloque 6 (la araña de chatarra).
 */
import data from './creatures.json';

export type CreatureId = 'perro_mutante' | 'bruto_mutante' | 'arana_chatarra';

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
  /** Vida que quita cada golpe a un muro o una puerta (0 si no los rompe). */
  wallDamage: number;
  /** Parte del daño que se quita (la araña de chatarra, 0,4 = −40 %). */
  armor?: number;
  /** Máquina (bloque 6): sin moral, no deja cadáver y suelta chatarra y componentes. */
  machine?: boolean;
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
  /** Desde el día del bruto, 1 bruto por cada tantos perros de la manada. */
  dogsPerBrute: data.packs.dogsPerBrute,
};

/** Ataques de máquinas (bloque 6 del catálogo): cuándo llegan, cuántas y qué sueltan. */
export const MACHINES = {
  fromDay: data.machines.fromDay,
  /** 1 de cada tantos ataques es de máquinas. */
  every: data.machines.every,
  spiders: [data.machines.spiders[0], data.machines.spiders[1]] as const,
  scrap: [data.machines.scrap[0], data.machines.scrap[1]] as const,
  parts: [data.machines.parts[0], data.machines.parts[1]] as const,
  /** Daño de más que les hacen las armas de fuego (0,25 = +25 %). */
  firearmBonus: data.machines.firearmBonus,
};

/** Si es una máquina (araña de chatarra…). */
export function isMachine(id: CreatureId | undefined): boolean {
  return !!id && !!CREATURES[id].machine;
}

/** Cadáveres de las criaturas: cuánto tardan en pudrirse y cuánto ánimo quitan a quien los ve. */
export const CORPSES = {
  /** Días hasta que se pudre del todo y desaparece. */
  rotDays: data.corpses.rotDays,
  /** Ánimo que quita a quien lo ve. */
  moodPenalty: data.corpses.moodPenalty,
  /** Casillas a las que se ve. */
  viewRadius: data.corpses.viewRadius,
  /** Horas que dura el mal rato después de dejar de verlo. */
  moodHours: data.corpses.moodHours,
};
