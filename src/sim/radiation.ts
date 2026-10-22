// Fugas de radiación (propuesta B de Mikel, 2026-10-22): al saquear un barril tóxico, la casilla
// queda irradiada unos días. Mientras dura, la radiación de la casilla sube (cuenta como zona
// irradiada: el huerto da la mitad y atrae a las manadas) y hay un charco radiactivo encima; al
// acabar, la radiación vuelve a lo que era y el charco se seca. Lógica pura y determinista.
import { RADIATION_LEAK } from '../data/radiation';
import { GameMap, inBounds, index, isWater, Prop, Terrain } from './map';

export interface RadiationLeak {
  x: number;
  y: number;
  /** Tick en el que se acaba. */
  until: number;
  /** Casillas afectadas y la radiación que tenían antes de la fuga. */
  tiles: { i: number; rad: number }[];
}

/** ¿Alguna fuga activa, aparte de `skip`, cubre la casilla `i`? Devuelve la radiación original guardada. */
function coveredBy(leaks: readonly RadiationLeak[], i: number, skip?: RadiationLeak): number | undefined {
  for (const l of leaks) {
    if (l === skip) continue;
    const t = l.tiles.find((k) => k.i === i);
    if (t) return t.rad;
  }
  return undefined;
}

/**
 * Empieza una fuga en (x, y): sube la radiación de la casilla (y de las de alrededor, según el
 * radio) durante `RADIATION_LEAK.days` días. Devuelve las casillas que han cambiado.
 */
export function startLeak(map: GameMap, leaks: RadiationLeak[], x: number, y: number, now: number, ticksPerDay: number): number[] {
  const R = Math.max(0, Math.floor(RADIATION_LEAK.radius));
  const tiles: { i: number; rad: number }[] = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!inBounds(map, tx, ty)) continue;
      const i = index(map, tx, ty);
      if (isWater(map.terrain[i] as Terrain)) continue;
      // Si otra fuga ya la cubre, lo que se guarda es lo que había antes de las dos.
      const rad = coveredBy(leaks, i) ?? map.radiation[i];
      tiles.push({ i, rad });
      map.radiation[i] = Math.max(map.radiation[i], RADIATION_LEAK.level);
    }
  }
  leaks.push({ x, y, until: now + Math.round(RADIATION_LEAK.days * ticksPerDay), tiles });
  return tiles.map((t) => t.i);
}

/**
 * Acaba las fugas que han cumplido su tiempo: la radiación vuelve a lo que era (si no la cubre
 * otra fuga) y el charco del barril se seca. Devuelve las casillas que han cambiado.
 */
export function updateLeaks(map: GameMap, leaks: RadiationLeak[], now: number): number[] {
  const changed: number[] = [];
  for (let k = leaks.length - 1; k >= 0; k--) {
    const l = leaks[k];
    if (now < l.until) continue;
    leaks.splice(k, 1);
    for (const t of l.tiles) {
      if (coveredBy(leaks, t.i, l) !== undefined) continue;
      map.radiation[t.i] = t.rad;
      changed.push(t.i);
    }
    if (inBounds(map, l.x, l.y)) {
      const i = index(map, l.x, l.y);
      if (map.props[i] === Prop.GlowPuddle) {
        map.props[i] = Prop.None;
        map.stock[i] = 0;
        if (!changed.includes(i)) changed.push(i);
      }
    }
  }
  return changed;
}
