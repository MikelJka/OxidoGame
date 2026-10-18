// Pánico de los colonos (moral y huida, segunda parte; números aprobados por Mikel el 2026-10-17).
// Con el ánimo por debajo del 15 % y herido, o al ver caer a un compañero a 5 casillas o menos,
// un colono puede entrar en pánico (20 %): suelta lo que hace y corre a la cama o habitación más
// cercana, donde se queda 1 h. Los reclutados solo con ánimo < 5 %; «duro» nunca; «pesimista», el doble.
import type { Colonist } from './colonist';
import { moodOf } from './needs';
import type { Point } from './pathfinding';
import { TICKS_PER_HOUR } from './time';
import type { World } from './world';

/** Probabilidad de entrar en pánico cuando se da la causa. */
export const PANIC_CHANCE = 0.2;
/** Ánimo por debajo del cual un herido puede entrar en pánico. */
export const PANIC_MOOD = 0.15;
/** Ánimo por debajo del cual un reclutado puede entrar en pánico. */
export const PANIC_MOOD_DRAFTED = 0.05;
/** Distancia (casillas) a la que ver caer a un compañero asusta. */
export const PANIC_WITNESS_RANGE = 5;
/** Lo que dura el pánico. */
export const PANIC_TICKS = TICKS_PER_HOUR;
/** Hasta dónde busca una habitación si no llega a ninguna cama. */
const ROOM_SEARCH = 25;

export type PanicCause = 'herido' | 'compañero';

/** Probabilidad de que `c` entre en pánico por esa causa (0 si no puede). */
export function panicChance(c: Colonist, cause: PanicCause, tick: number): number {
  if (c.role !== 'colono' || c.downed || c.panic) return 0;
  if (c.traits.some((t) => t.id === 'duro')) return 0;
  const { mood } = moodOf(c, tick);
  if (c.drafted && mood >= PANIC_MOOD_DRAFTED) return 0;
  if (cause === 'herido' && (mood >= PANIC_MOOD || c.wounds.length === 0)) return 0;
  return Math.min(1, PANIC_CHANCE * (c.traits.some((t) => t.id === 'pesimista') ? 2 : 1));
}

/** Tira el dado y, si toca, mete a `c` en pánico. true si ha entrado. */
export function maybePanic(w: World, c: Colonist, cause: PanicCause): boolean {
  const p = panicChance(c, cause, w.tick);
  if (p <= 0 || !w.rng.chance(p)) return false;
  startPanic(w, c, cause);
  return true;
}

/** Un colono acaba de caer: quienes lo ven a 5 casillas o menos pueden entrar en pánico. */
export function witnessFall(w: World, fallen: Colonist): void {
  if (fallen.role !== 'colono') return;
  for (const c of w.colonists) {
    if (c === fallen) continue;
    const d = Math.max(Math.abs(c.tile.x - fallen.tile.x), Math.abs(c.tile.y - fallen.tile.y));
    if (d <= PANIC_WITNESS_RANGE) maybePanic(w, c, 'compañero');
  }
}

/** Entra en pánico: deja lo que hace y corre a refugiarse. */
export function startPanic(w: World, c: Colonist, cause: PanicCause): void {
  if (c.job) w.dropJob(c);
  if (c.need) w.endNeed(c);
  c.gearTask = undefined;
  w.coverMoves.delete(c.id);
  const refuge = findRefuge(w, c);
  c.panic = { until: w.tick + PANIC_TICKS };
  c.path = refuge?.path ?? [];
  c.activity = 'moving';
  const why = cause === 'herido' ? 'herido y hundido' : 'al ver caer a un compañero';
  const where = refuge ? (refuge.bed ? 'corre a una cama' : 'corre a encerrarse') : 'se queda encogido donde está';
  w.addLog(`😱 ${c.name} entra en pánico ${why}: suelta lo que hacía y ${where}.`, 'malo', 'panico', c.tile);
}

/** Un tick de un colono en pánico: corre a su refugio y se queda ahí hasta que se le pasa. */
export function updatePanic(w: World, c: Colonist): void {
  if (!c.panic) return;
  if (w.tick >= c.panic.until) {
    c.panic = undefined;
    c.path = [];
    c.activity = 'idle';
    c.waitTicks = 10;
    w.addLog(`${c.name} se calma.`, 'info');
    return;
  }
  if (c.path.length > 0) w.moveAlongPath(c);
  else c.activity = 'idle';
}

/** La cama más cercana a la que llega; si no, la casilla de habitación más cercana. */
export function findRefuge(w: World, c: Colonist): { path: Point[]; bed: boolean } | null {
  const dist = (p: Point) => Math.abs(p.x - c.tile.x) + Math.abs(p.y - c.tile.y);
  const beds = w.structures
    .all()
    .filter((s) => s.built && s.def.id === 'cama')
    .map((s) => ({ x: s.x, y: s.y }))
    .sort((a, b) => dist(a) - dist(b));
  for (const b of beds.slice(0, 4)) {
    const route = w.routeTo(c, [b]);
    if (route) return { path: route.path, bed: true };
  }
  const rooms: Point[] = [];
  for (let dy = -ROOM_SEARCH; dy <= ROOM_SEARCH; dy++) {
    for (let dx = -ROOM_SEARCH; dx <= ROOM_SEARCH; dx++) {
      const x = c.tile.x + dx;
      const y = c.tile.y + dy;
      if (w.rooms.at(x, y)) rooms.push({ x, y });
    }
  }
  rooms.sort((a, b) => dist(a) - dist(b));
  for (const p of rooms.slice(0, 4)) {
    const route = w.routeTo(c, [p]);
    if (route) return { path: route.path, bed: false };
  }
  return null;
}
