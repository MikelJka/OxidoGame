/**
 * Mutantes y criaturas (bloque 2 del catálogo, aprobado por Mikel el 2026-10-18).
 * Los números están en `creatures.json`: perros mutantes, brutos mutantes y sus cadáveres, y las
 * máquinas del bloque 6 (la araña de chatarra y el dron de vigilancia).
 */
import data from './creatures.json';
import type { ResourceId } from './resources';

export type CreatureId = 'perro_mutante' | 'bruto_mutante' | 'arana_chatarra' | 'dron_vigilancia' | 'ciervo_mutado' | 'jabali' | 'rata_gigante' | 'cabra_salvaje' | 'vaca_dos_cabezas' | 'caballo_salvaje' | 'gallina_mutada' | 'mula';

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
  /** Vuela (el dron): pasa por encima de muros, zanjas, barricadas, agua y trampas, y nada le cubre. */
  flies?: boolean;
  /** Arma (id de `weapons.json`) con la que dispara, sin gastar munición ni soltarla al caer. */
  gun?: string;
  /** Para los textos: «la araña… queda destrozada». */
  female?: boolean;
  /** Animal (bloque 10): va por libre por el mapa, se caza y deja carne y cuero [mín, máx]. */
  animal?: boolean;
  meat?: [number, number];
  leather?: [number, number];
  /** Herido, ataca (el jabalí). */
  fightsBack?: boolean;
  /** Roba comida de los almacenes sin muros (la rata gigante). */
  stealsFood?: boolean;
  /** Se puede domar como animal de carga. */
  tamable?: boolean;
  /** Doma: probabilidad base de cada intento y kilos que carga en una expedición. */
  tame?: { chance: number; cargo: number; produces?: { resource: ResourceId; amount: number } };
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
  /** El máximo de la manada sube 1 cada tantos días desde el primer perro. */
  growDays: data.packs.growDays,
};

/** Ataques de máquinas (bloque 6 del catálogo): cuándo llegan, cuántas y qué sueltan. */
export const MACHINES = {
  fromDay: data.machines.fromDay,
  /** 1 de cada tantos ataques es de máquinas. */
  every: data.machines.every,
  spiders: [data.machines.spiders[0], data.machines.spiders[1]] as const,
  drones: [data.machines.drones[0], data.machines.drones[1]] as const,
  scrap: [data.machines.scrap[0], data.machines.scrap[1]] as const,
  parts: [data.machines.parts[0], data.machines.parts[1]] as const,
  /** Daño de más que les hacen las armas de fuego (0,25 = +25 %). */
  firearmBonus: data.machines.firearmBonus,
};

/** Si vuela (el dron de vigilancia). */
export function flies(id: CreatureId | undefined): boolean {
  return !!id && !!CREATURES[id].flies;
}

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

/** Animales (bloque 10): cuántos como mucho, cuántos llegan al día, de qué tipo, cuánto se quedan y cuánto roba una rata. */
export const ANIMALS = data.animals as unknown as { max: number; perDay: [number, number]; weights: Partial<Record<CreatureId, number>>; stayDays: number; ratSteals: number };

/** Animales de carga: domarlos, darles de comer y lo que llevan. */
export const TAMING = data.taming as unknown as {
  chance: number; chancePerSkill: number; maxChance: number; foodPerTry: number; workPerTry: number;
  foodPerDay: number; cargo: number; leash: number; hungryDays: number; enrageOnFail: number;
  mulePrice: number; mulesForSale: [number, number];
};

/** Probabilidad base de domar a este animal en un intento (sin la habilidad). */
export function tameChance(id: CreatureId | undefined): number {
  return (id && CREATURES[id]?.tame?.chance) ?? TAMING.chance;
}

/** Kilos que lleva este animal de carga en una expedición. */
export function animalCargo(id: CreatureId | undefined): number {
  return (id && CREATURES[id]?.tame?.cargo) ?? TAMING.cargo;
}

/** Lo difícil que es domarlo, para los textos. */
export function tameDifficulty(id: CreatureId | undefined): string {
  const c = tameChance(id);
  return c >= 0.25 ? 'fácil' : c >= 0.12 ? 'media' : c >= 0.05 ? 'difícil' : 'muy difícil';
}
