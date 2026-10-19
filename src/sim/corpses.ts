/**
 * Cadáveres de las criaturas (bloque 2 del catálogo, aprobado por Mikel el 2026-10-18).
 * Al morir, un perro o un bruto mutante deja su cadáver donde cae. Se pudre: quien lo ve cerca
 * pierde ánimo y, a los días, desaparece. Los números están en `src/data/creatures.json`.
 * La hoguera para quemarlos llega en la parte siguiente.
 */
import { CORPSES, CreatureId } from '../data/creatures';
import type { Colonist } from './colonist';

export interface Corpse {
  id: number;
  /** De qué criatura es (el dibujo va por este id). */
  creature: CreatureId;
  x: number;
  y: number;
  /** Tick en que murió. */
  diedAt: number;
}

/** Cuánto se ha podrido: 0 recién muerto, 1 podrido del todo. */
export function rotOf(c: Corpse, tick: number, ticksPerDay: number): number {
  return Math.max(0, Math.min(1, (tick - c.diedAt) / (CORPSES.rotDays * ticksPerDay)));
}

/**
 * Cada segundo: quita los cadáveres ya podridos (devuelve cuántos) y a los colonos despiertos
 * y en pie que tienen uno a `viewRadius` casillas o menos les pesa durante `moodHours` horas.
 */
export function updateCorpses(corpses: Corpse[], colonists: Colonist[], tick: number, ticksPerHour: number, ticksPerDay: number): number {
  let rotted = 0;
  for (let i = corpses.length - 1; i >= 0; i--) {
    if (rotOf(corpses[i], tick, ticksPerDay) < 1) continue;
    corpses.splice(i, 1);
    rotted++;
  }
  if (corpses.length === 0) return rotted;
  const until = tick + CORPSES.moodHours * ticksPerHour;
  const r = CORPSES.viewRadius;
  for (const k of colonists) {
    if (k.downed || k.activity === 'sleeping') continue;
    if (corpses.some((c) => Math.max(Math.abs(c.x - k.tile.x), Math.abs(c.y - k.tile.y)) <= r)) k.needs.sawCorpseUntil = until;
  }
  return rotted;
}
