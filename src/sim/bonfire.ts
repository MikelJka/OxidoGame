/**
 * Hoguera (bloque 2 del catálogo; elegido por Mikel el 2026-10-20). Se construye con 🪵5 y tiene un
 * depósito interior de leña que los colonos rellenan como el del generador. Mientras le queda leña
 * está encendida y la va gastando (unos dos días el depósito lleno); con ella encendida, un colono con
 * «Transportar» lleva cada cadáver de criatura y lo quema. Sin leña se apaga y no quema.
 * Encendida da luz como una lámpara y, de noche, ánimo a quien está cerca.
 * Los números están en `src/data/buildings.json` (`hoguera`).
 */
import type { Colonist } from './colonist';
import type { Structure, Structures } from './structures';

/** Hoguera construida, sin orden de demoler y con leña: se le pueden llevar cadáveres. */
export function isLitBonfire(s: Structure): boolean {
  return !!s.def.burnsCorpses && s.built && !s.demolish && (s.fuel ?? 0) > 0;
}

/**
 * Cada segundo (`hours` de juego): la leña que han traído pasa al depósito y la que arde se gasta.
 * `powered` queda a true mientras está encendida (lo lee el dibujo y la información de la casilla).
 */
export function updateBonfires(st: Structures, hours: number, heating = false): void {
  for (const s of st.all()) {
    const f = s.def.fuel;
    if ((!s.def.burnsCorpses && !s.def.heater) || !f || !s.built) continue;
    // La estufa solo gasta leña cuando hace frío (de noche en invierno); mientras, la guarda.
    if (s.def.heater && !heating) {
      if (s.delivered[f.resource]) {
        s.fuel = Math.min(f.capacity, (s.fuel ?? 0) + (s.delivered[f.resource] ?? 0));
        delete s.delivered[f.resource];
      }
      s.powered = false;
      continue;
    }
    if (s.delivered[f.resource]) {
      s.fuel = Math.min(f.capacity, (s.fuel ?? 0) + (s.delivered[f.resource] ?? 0));
      delete s.delivered[f.resource];
    }
    if ((s.fuel ?? 0) > 0) s.fuel = Math.max(0, (s.fuel ?? 0) - hours / f.hoursPerUnit);
    s.powered = (s.fuel ?? 0) > 0;
  }
}

/**
 * Cada segundo, de noche: a los colonos despiertos y en pie a `cheer.radius` casillas o menos de una
 * hoguera encendida les dura el ánimo de más `cheer.hours` horas desde ahora.
 */
export function updateBonfireCheer(st: Structures, colonists: Colonist[], tick: number, ticksPerHour: number, night: boolean): void {
  if (!night) return;
  const fires = st.all().filter((s) => s.def.cheer && isLitBonfire(s));
  if (fires.length === 0) return;
  for (const k of colonists) {
    if (k.downed || k.activity === 'sleeping') continue;
    const near = fires.find((s) => Math.max(Math.abs(s.x - k.tile.x), Math.abs(s.y - k.tile.y)) <= s.def.cheer!.radius);
    if (near) k.needs.fireUntil = tick + near.def.cheer!.hours * ticksPerHour;
  }
}
