/**
 * Hoguera (bloque 2 del catálogo; elegido por Mikel el 2026-10-20). Se construye con 🪵5 y tiene un
 * depósito interior de leña que los colonos rellenan como el del generador. Mientras le queda leña
 * está encendida y la va gastando (unos dos días el depósito lleno); con ella encendida, un colono con
 * «Transportar» lleva cada cadáver de criatura y lo quema. Sin leña se apaga y no quema.
 * Los números están en `src/data/buildings.json` (`hoguera`).
 */
import type { Structure, Structures } from './structures';

/** Hoguera construida, sin orden de demoler y con leña: se le pueden llevar cadáveres. */
export function isLitBonfire(s: Structure): boolean {
  return !!s.def.burnsCorpses && s.built && !s.demolish && (s.fuel ?? 0) > 0;
}

/**
 * Cada segundo (`hours` de juego): la leña que han traído pasa al depósito y la que arde se gasta.
 * `powered` queda a true mientras está encendida (lo lee el dibujo y la información de la casilla).
 */
export function updateBonfires(st: Structures, hours: number): void {
  for (const s of st.all()) {
    const f = s.def.fuel;
    if (!s.def.burnsCorpses || !f || !s.built) continue;
    if (s.delivered[f.resource]) {
      s.fuel = Math.min(f.capacity, (s.fuel ?? 0) + (s.delivered[f.resource] ?? 0));
      delete s.delivered[f.resource];
    }
    if ((s.fuel ?? 0) > 0) s.fuel = Math.max(0, (s.fuel ?? 0) - hours / f.hoursPerUnit);
    s.powered = (s.fuel ?? 0) > 0;
  }
}
