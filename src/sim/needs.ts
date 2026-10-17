// Necesidades de los colonos: comida y descanso, y el ánimo que sale de ellas.
// Funciones puras (sin azar): la decisión de ir a comer o a dormir la toma `World`.
import { FOOD_RESOURCES, ResourceId } from '../data/resources';
import type { Colonist } from './colonist';

/** Días de juego que tarda un colono en pasar de lleno a vacío. */
export const FOOD_DAYS = 1.5;
/** Horas despierto que tarda en agotarse el descanso. */
export const AWAKE_HOURS = 18;
/** Horas de sueño para recuperarse del todo: en cama y en el suelo. */
export const SLEEP_HOURS_BED = 7;
export const SLEEP_HOURS_GROUND = 10;
/** Comida que da cada unidad de un alimento crudo (de 0 a 1). */
export const NUTRITION: Partial<Record<ResourceId, number>> = { patata: 0.1, maiz: 0.1, setas: 0.08 };
/** Por debajo de esto, va a comer (si hay comida). */
export const HUNGRY = 0.3;
/** Por debajo de esto, deja lo que esté haciendo para comer o dormir. */
export const STARVING = 0.12;
export const TIRED = 0.25;
export const EXHAUSTED = 0.08;
/** Ticks que tarda en comer. */
export const EAT_TICKS = 90;

export interface Needs {
  /** 1 lleno, 0 muerto de hambre. */
  food: number;
  /** 1 descansado, 0 agotado. */
  rest: number;
  /** Último sitio donde durmió: cuenta para el ánimo. */
  sleptIn: 'cama' | 'suelo' | 'habitacion' | null;
}

export function defaultNeeds(): Needs {
  return { food: 0.8, rest: 0.85, sleptIn: null };
}

export function isFood(r: ResourceId): boolean {
  return FOOD_RESOURCES.includes(r) && (NUTRITION[r] ?? 0) > 0;
}

/** Cuánto baja la comida por tick (los glotones gastan más). */
export function foodDecay(c: Colonist, ticksPerDay: number): number {
  const glutton = c.traits.some((t) => t.id === 'glotón') ? 1.3 : 1;
  return glutton / (FOOD_DAYS * ticksPerDay);
}

export function restDecay(ticksPerHour: number): number {
  return 1 / (AWAKE_HOURS * ticksPerHour);
}

export function restGain(inBed: boolean, ticksPerHour: number): number {
  return 1 / ((inBed ? SLEEP_HOURS_BED : SLEEP_HOURS_GROUND) * ticksPerHour);
}

/** Motivo del ánimo, con su efecto (positivo o negativo). */
export interface MoodReason {
  text: string;
  value: number;
}

/** Ánimo de 0 a 1 y sus motivos. */
export function moodOf(c: Colonist): { mood: number; reasons: MoodReason[] } {
  const reasons: MoodReason[] = [];
  const n = c.needs;
  if (n.food < STARVING) reasons.push({ text: 'Muerto de hambre', value: -0.3 });
  else if (n.food < HUNGRY) reasons.push({ text: 'Hambriento', value: -0.12 });
  if (n.rest < EXHAUSTED) reasons.push({ text: 'Agotado', value: -0.25 });
  else if (n.rest < TIRED) reasons.push({ text: 'Cansado', value: -0.1 });
  if (n.sleptIn === 'suelo') reasons.push({ text: 'Durmió en el suelo', value: -0.08 });
  else if (n.sleptIn === 'habitacion') reasons.push({ text: 'Durmió en una cama bajo techo', value: 0.08 });
  else if (n.sleptIn === 'cama') reasons.push({ text: 'Durmió en una cama', value: 0.04 });
  if (c.traits.some((t) => t.id === 'optimista')) reasons.push({ text: 'Optimista', value: 0.1 });
  if (c.traits.some((t) => t.id === 'pesimista')) reasons.push({ text: 'Pesimista', value: -0.1 });
  const mood = Math.max(0, Math.min(1, 0.55 + reasons.reduce((a, r) => a + r.value, 0)));
  return { mood, reasons };
}

/** Efecto del ánimo y del cansancio en la velocidad de trabajo. */
export function needsWorkFactor(c: Colonist): number {
  const { mood } = moodOf(c);
  let f = 1;
  if (mood < 0.25) f *= 0.8;
  if (c.needs.rest < EXHAUSTED) f *= 0.7;
  if (c.traits.some((t) => t.id === 'trabajador')) f *= 1.15;
  if (c.traits.some((t) => t.id === 'perezoso')) f *= 0.85;
  return f;
}
