// Sucesos (bloque 9 del catálogo): cada pocos días pasa algo. Los que duran (tormenta de polvo…)
// quedan en `World.weather` hasta que se acaban. Puro y determinista: sin Phaser ni DOM.
import { EVENT_FIRST_DAY, EVENT_GAP, EVENTS, EventDef, eventDef } from '../data/events';
import { RESOURCE_ICONS, ResourceId } from '../data/resources';
import { RESOURCE_VALUES } from '../data/values';
import { isPassable } from './map';
import { findPath, Point } from './pathfinding';
import { Rng } from './rng';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import type { World } from './world';

/** Un suceso que dura: cuál y hasta qué tick. */
export interface ActiveEvent {
  id: string;
  until: number;
}

/** Azar propio de los sucesos (no toca el de la partida): de la semilla y del tick. */
function eventRng(w: World, salt: number): Rng {
  return new Rng(((w.map.seed ^ 0x7e57ab1e) + Math.floor(w.tick / TICKS_PER_HOUR) * 0x27d4eb2d + salt) >>> 0);
}

/** Tick del primer suceso de una partida nueva. */
export function firstEventTick(): number {
  return Math.round(EVENT_FIRST_DAY * TICKS_PER_DAY);
}

/** Lo activo de un tipo (o undefined). */
export function activeEvent(w: World, id: string): ActiveEvent | undefined {
  return w.weather.find((e) => e.id === id && w.tick < e.until);
}

/** Lo que dan ahora las placas solares (×1, o ×0 con una tormenta de polvo). */
export function solarFactor(w: World): number {
  let f = 1;
  for (const e of w.weather) if (w.tick < e.until) f *= eventDef(e.id)?.solar ?? 1;
  return f;
}

/** Por cuánto se multiplica ahora el alcance de los disparos (×0,5 con una tormenta de polvo). */
export function reachFactor(w: World): number {
  let f = 1;
  for (const e of w.weather) if (w.tick < e.until) f *= eventDef(e.id)?.reach ?? 1;
  return f;
}

/** Cada hora: se acaban los que duran y, si toca, llega otro. */
export function runEvents(w: World): void {
  for (const e of [...w.weather]) {
    if (w.tick >= e.until) {
      w.weather.splice(w.weather.indexOf(e), 1);
      w.addLog(`🌤 Se acaba: ${eventDef(e.id)?.name.toLowerCase() ?? e.id}.`, 'info');
    }
  }
  if (w.tick < w.nextEvent) return;
  const rng = eventRng(w, 1);
  w.nextEvent = w.tick + rng.int(Math.round(EVENT_GAP[0] * TICKS_PER_DAY), Math.round(EVENT_GAP[1] * TICKS_PER_DAY));
  const total = EVENTS.reduce((a, e) => a + e.weight, 0);
  let roll = rng.next() * total;
  const ev = EVENTS.find((e) => (roll -= e.weight) < 0) ?? EVENTS[0];
  startEvent(w, ev.id);
}

/** Empieza un suceso. false si no ha podido (p. ej., no hay sitio para el alijo). */
export function startEvent(w: World, id: string): boolean {
  const ev = eventDef(id);
  if (!ev) return false;
  if (ev.id === 'alijo') return dropCache(w, ev);
  if (ev.hours && !activeEvent(w, ev.id)) {
    w.weather.push({ id: ev.id, until: w.tick + Math.round(ev.hours * TICKS_PER_HOUR) });
    if (ev.id === 'tormenta_polvo') w.addLog(`🌪 ¡Tormenta de polvo! Durante un día las placas solares no producen y los disparos llegan a la mitad de lejos.`, 'malo');
    else w.addLog(`🌦 ${ev.name}.`, 'malo');
    return true;
  }
  return false;
}

/** Un alijo de recursos (de 150 a 400 chapas) en un sitio del mapa al que se llega andando. */
function dropCache(w: World, ev: EventDef): boolean {
  const home = w.colonyPoint();
  if (!home || !ev.value || !ev.pool?.length) return false;
  const rng = eventRng(w, 2);
  const m = w.map;
  let at: Point | null = null;
  for (let tries = 0; tries < 60 && !at; tries++) {
    const p = { x: rng.int(2, m.width - 3), y: rng.int(2, m.height - 3) };
    const d = Math.abs(p.x - home.x) + Math.abs(p.y - home.y);
    if (d < 15 || !isPassable(m, p.x, p.y) || w.items.at(p.x, p.y) || w.structures.at(p.x, p.y)) continue;
    if (findPath(m, home, p, 40000)) at = p;
  }
  if (!at) return false;
  const target = rng.int(ev.value[0], ev.value[1]);
  const got: Partial<Record<ResourceId, number>> = {};
  let value = 0;
  for (let k = 0; k < 6 && value < target; k++) {
    const r = ev.pool[rng.int(0, ev.pool.length - 1)];
    const n = Math.max(1, Math.round((target - value) / 2 / RESOURCE_VALUES[r]));
    got[r] = (got[r] ?? 0) + n;
    value += n * RESOURCE_VALUES[r];
  }
  w.items.dropAll(at.x, at.y, got);
  const list = (Object.entries(got) as [ResourceId, number][]).map(([r, n]) => `${n} ${RESOURCE_ICONS[r]}`).join(', ');
  w.addLog(`📦 Alguien ha visto un alijo abandonado: ${list}. Los colonos con «Transportar» lo traerán.`, 'bueno', 'visita', at);
  return true;
}

/** Lee los sucesos de una partida guardada. */
export function restoreWeather(saved: unknown): ActiveEvent[] {
  if (!Array.isArray(saved)) return [];
  return saved
    .filter((e) => e && typeof e === 'object' && typeof e.id === 'string' && eventDef(e.id) && typeof e.until === 'number')
    .map((e) => ({ id: e.id as string, until: e.until as number }));
}
