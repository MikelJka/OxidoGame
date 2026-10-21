// Salud: heridas localizadas que sangran hasta que se curan, daño por hambre y sed,
// recuperación con el tiempo (más rápida durmiendo), infecciones y muerte. Puro: el azar de
// las infecciones llega de fuera (`Rng`).
import type { Colonist } from './colonist';
import type { Rng } from './rng';
import { INFECTION, SELF_CARE_HEAL } from '../data/medicine';

/** Una herida en una parte del cuerpo. */
export interface Wound {
  part: string;
  /** 0–1: cuánto le queda por cerrar. */
  severity: number;
  /** Sangra hasta que alguien la cura. */
  bleeding: boolean;
  /** Ya la ha curado alguien (cierra más deprisa). */
  treated: boolean;
  /** La curó alguien con medicina 💊 (cierra el doble de rápido y casi no se infecta). */
  medicine?: boolean;
  /** Se la curó él mismo: se cierra más despacio y se infecta más. */
  self?: boolean;
  /** Ticks que lleva abierta. */
  age?: number;
  /** Ya se ha mirado si se infecta (a las 12 h). */
  infectRolled?: boolean;
}

/** Infección de una herida: empeora cada día que pasa sin medicina y mata al tercero. */
export interface Infection {
  /** Parte del cuerpo de la herida que se infectó. */
  part: string;
  /** Ticks del día de infección en curso. */
  dayTicks: number;
  /** Días seguidos sin tratar (a los 3, muere). */
  untreatedDays: number;
  /** Dosis de 💊 recibidas (con 2, en días distintos, se cura). */
  doses: number;
  /** Ya ha tomado su dosis en el día en curso. */
  dosedToday: boolean;
}

export const BODY_PARTS = ['la cabeza', 'el pecho', 'el brazo izquierdo', 'el brazo derecho', 'la pierna izquierda', 'la pierna derecha', 'el abdomen'];

/** Por debajo de esto, cae al suelo y no puede hacer nada. */
export const DOWNED = 0.15;
/** Sangrado máximo que cuenta (varias heridas no suman sin fin). */
export const BLEED_CAP = 1.2;
/** En el suelo se sangra a este ritmo. */
export const DOWNED_BLEED = 0.4;
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
 *
 * `healTime` multiplica el tiempo que tardan en cerrarse las heridas («Medicina avanzada»: 0,75).
 */
export function tickHealth(c: Colonist, ticks: number, ticksPerDay: number, asleep: boolean, healTime = 1): HealthTickResult {
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
    // Equilibrio (2026-10-21, partidas simuladas): el sangrado no pasa de BLEED_CAP y, en el suelo
    // y quieto, se desangra más despacio (×DOWNED_BLEED): da tiempo a que alguien le cure.
    loss += (Math.min(BLEED_CAP, bleed) * (c.downed ? DOWNED_BLEED : 1) * 0.8 * ticks) / day;
    cause = 'heridas';
  }
  const fed = c.needs.food > 0.2 && c.needs.water > 0.2;
  if (fed && bleed === 0) {
    const regen = ((asleep ? 0.6 : 0.2) * ticks) / day;
    c.health = Math.min(1, c.health + regen);
    for (const w of c.wounds) w.severity -= (w.medicine ? INFECTION.medicineHealFactor * 2 : w.treated ? 2 : 1) * (w.self ? SELF_CARE_HEAL : 1) * regen / healTime;
    c.wounds = c.wounds.filter((w) => w.severity > 0);
  }
  c.health = Math.max(0, c.health - loss);
  if (c.health <= 0) return { died: true, cause: cause || 'heridas' };
  if (c.health < DOWNED) c.downed = true;
  // Un saqueador caído no se levanta (#22): sigue en el suelo hasta que se le capture o se le remate.
  else if (c.downed && c.health >= STANDS_UP && c.role !== 'saqueador') c.downed = false;
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

/** Cura las heridas que sangran (trabajo de un médico); con `medicine`, usando 💊; con `self`, se las cura él mismo. */
export function treatWounds(c: Colonist, medicine = false, self = false): number {
  let n = 0;
  for (const w of c.wounds) {
    if (!w.bleeding) continue;
    w.bleeding = false;
    w.treated = true;
    if (medicine) w.medicine = true;
    if (self) w.self = true;
    n++;
  }
  return n;
}

export interface InfectionTickResult {
  /** Parte del cuerpo que se acaba de infectar. */
  infected?: string;
  /** Ha empeorado (un día más sin tratar). */
  worse?: boolean;
  /** Muere de la infección. */
  died?: boolean;
  /** El cuerpo la ha vencido solo. */
  recovered?: boolean;
}

/**
 * Avanza `ticks` las heridas y la infección: una herida que sigue abierta a las 12 h puede
 * infectarse (20 %; 8 % si la curaron sin medicina; 2 % con medicina). Cada día sin su dosis
 * de 💊 la infección empeora; al tercero seguido, muere. `chanceFactor` multiplica esas
 * probabilidades («Medicina avanzada»: la mitad).
 */
export function tickInfection(c: Colonist, ticks: number, ticksPerDay: number, rng: Rng, chanceFactor = 1): InfectionTickResult {
  const out: InfectionTickResult = {};
  const limit = (INFECTION.checkHours / 24) * ticksPerDay;
  for (const w of c.wounds) {
    w.age = (w.age ?? 0) + ticks;
    if (w.infectRolled || w.age < limit) continue;
    w.infectRolled = true;
    const p = w.self
      ? (w.medicine ? INFECTION.chanceSelfMedicine : INFECTION.chanceSelf)
      : w.medicine ? INFECTION.chanceMedicine : w.treated ? INFECTION.chanceTreated : INFECTION.chanceUntreated;
    if (!c.infection && rng.chance(p * chanceFactor)) {
      c.infection = { part: w.part, dayTicks: 0, untreatedDays: 0, doses: 0, dosedToday: false };
      out.infected = w.part;
    }
  }
  const inf = c.infection;
  // La que acaba de empezar no cuenta todavía su primer día.
  if (inf && !out.infected) {
    inf.dayTicks += ticks;
    if (inf.dayTicks >= ticksPerDay) {
      inf.dayTicks -= ticksPerDay;
      if (inf.dosedToday) inf.untreatedDays = 0;
      else if (c.needs.food > 0.3 && c.needs.water > 0.3 && rng.chance(INFECTION.naturalRecovery ?? 0)) {
        // Bien comido y bebido, el cuerpo a veces la vence solo (equilibrio, 2026-10-21).
        delete c.infection;
        out.recovered = true;
      } else {
        inf.untreatedDays++;
        out.worse = true;
        if (inf.untreatedDays >= INFECTION.deadlyDays) out.died = true;
      }
      inf.dosedToday = false;
    }
  }
  return out;
}

/** Le hace falta su dosis de 💊 de hoy. */
export function needsDose(c: Colonist): boolean {
  return !!c.infection && !c.infection.dosedToday;
}

/** Le da la dosis de 💊 del día. true si con ella se cura. */
export function giveDose(c: Colonist): boolean {
  const inf = c.infection;
  if (!inf || inf.dosedToday) return false;
  inf.dosedToday = true;
  inf.doses++;
  if (inf.doses >= INFECTION.dosesToCure) {
    delete c.infection;
    return true;
  }
  return false;
}

/** Texto de la infección para la ficha (vacío si no tiene). */
export function infectionLabel(c: Colonist): string {
  const inf = c.infection;
  if (!inf) return '';
  const stage = ['infección', 'infección que empeora', 'infección grave'][Math.min(2, inf.untreatedDays)];
  return `🦠 ${stage} en ${inf.part} (${inf.doses}/${INFECTION.dosesToCure} 💊${inf.dosedToday ? ', hoy ya tomada' : ''})`;
}

/** Texto de la salud para la ficha. */
export function healthLabel(c: Colonist): string {
  if (c.downed) return 'En el suelo, sin poder moverse';
  if (c.infection) return 'Infectado';
  if (c.health < 0.5) return 'Malherido';
  if (c.wounds.length) return 'Herido';
  return 'Sano';
}
