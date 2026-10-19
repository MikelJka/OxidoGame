// Salud: heridas localizadas que sangran hasta que se curan, daño por hambre y sed,
// recuperación con el tiempo (más rápida durmiendo) y muerte. Puro y sin azar.
import type { Colonist } from './colonist';

/** Una herida en una parte del cuerpo. */
export interface Wound {
  part: string;
  /** 0–1: cuánto le queda por cerrar. */
  severity: number;
  /** Sangra hasta que alguien la cura. */
  bleeding: boolean;
  /** Ya la ha curado alguien (cierra más deprisa). */
  treated: boolean;
}

export const BODY_PARTS = ['la cabeza', 'el pecho', 'el brazo izquierdo', 'el brazo derecho', 'la pierna izquierda', 'la pierna derecha', 'el abdomen'];

/** Por debajo de esto, cae al suelo y no puede hacer nada. */
export const DOWNED = 0.15;
/** Por encima de esto, se levanta. */
export const STANDS_UP = 0.3;

export interface HealthTickResult {
  /** Ha muerto en este paso. */
  died: boolean;
  /** Causa, si ha muerto. */
  cause?: string;
}

/** Sangrado total (0 si no sangra). */
export function bleedRate(c: Colonist): number {
  return c.wounds.reduce((a, w) => a + (w.bleeding ? w.severity : 0), 0);
}

/**
 * Avanza la salud `ticks` ticks. Hambre y sed a cero dañan; las heridas que sangran, también;
 * bien comido y bebido, se recupera (más deprisa durmiendo) y las heridas se cierran.
 */
export function tickHealth(c: Colonist, ticks: number, ticksPerDay: number, asleep: boolean): HealthTickResult {
  const day = ticksPerDay;
  let loss = 0;
  let cause = '';
  if (c.needs.food <= 0) {
    loss += ticks / (2 * day);
    cause = 'hambre';
  }
  if (c.needs.water <= 0) {
    loss += ticks / day;
    cause = 'sed';
  }
  const bleed = bleedRate(c);
  if (bleed > 0) {
    loss += (bleed * 0.8 * ticks) / day;
    cause = 'heridas';
  }
  const fed = c.needs.food > 0.2 && c.needs.water > 0.2;
  if (fed && bleed === 0) {
    const regen = ((asleep ? 0.6 : 0.2) * ticks) / day;
    c.health = Math.min(1, c.health + regen);
    for (const w of c.wounds) w.severity -= (w.treated ? 2 : 1) * regen;
    c.wounds = c.wounds.filter((w) => w.severity > 0);
  }
  c.health = Math.max(0, c.health - loss);
  if (c.health <= 0) return { died: true, cause: cause || 'heridas' };
  if (c.health < DOWNED) c.downed = true;
  else if (c.downed && c.health >= STANDS_UP) c.downed = false;
  return { died: false };
}

/** Salud mínima que deja un golpe a un saqueador: se le derriba, no se le mata (#22). */
export const SPARED_HEALTH = 0.05;

/**
 * Recibe un golpe: baja la salud y deja una herida que sangra. Con `spare`, el golpe no mata:
 * como mucho lo deja en el suelo con `SPARED_HEALTH` (si ya estaba por debajo, no baja más).
 */
export function hurt(c: Colonist, amount: number, part: string, spare = false): void {
  const floor = spare ? Math.min(c.health, SPARED_HEALTH) : 0;
  c.health = Math.max(floor, c.health - amount);
  c.wounds.push({ part, severity: Math.min(1, amount * 2.5), bleeding: true, treated: false });
  if (c.health < DOWNED) c.downed = true;
}

/** Cura las heridas que sangran (trabajo de un médico). */
export function treatWounds(c: Colonist): number {
  let n = 0;
  for (const w of c.wounds) {
    if (!w.bleeding) continue;
    w.bleeding = false;
    w.treated = true;
    n++;
  }
  return n;
}

/** Texto de la salud para la ficha. */
export function healthLabel(c: Colonist): string {
  if (c.downed) return 'En el suelo, sin poder moverse';
  if (c.health < 0.5) return 'Malherido';
  if (c.wounds.length) return 'Herido';
  return 'Sano';
}
