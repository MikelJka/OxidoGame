/** Sucesos (bloque 9 del catálogo). Los datos están en `events.json`; aquí, sus tipos y la validación. */
import raw from './events.json';
import { RESOURCES, ResourceId } from './resources';

export interface EventDef {
  id: string;
  name: string;
  /** Cuánto pesa al sortear el siguiente suceso. */
  weight: number;
  /** Desde qué día puede tocar (equilibrio, 2026-10-21). */
  fromDay?: number;
  /** Solo en estas estaciones (ids de `seasons.json`). */
  seasons?: string[];
  /** Lo que dura (los que duran). */
  hours?: number;
  /** Ola de frío: mientras dura hace frío a todas horas (como una noche de invierno) y no crece nada al aire libre. */
  coldWave?: boolean;
  /** Tormenta eléctrica: rayos que caen mientras dura [mínimo, máximo]. */
  lightning?: [number, number];
  /** Tormenta de polvo: lo que dan las placas solares (0) y el alcance de los disparos (×0,5). */
  solar?: number;
  reach?: number;
  /** Alijo: lo que vale en chapas [mínimo, máximo] y de qué recursos sale. */
  value?: [number, number];
  pool?: ResourceId[];
  /** Avería: lo que hace falta para arreglar la máquina (⚙️1) y el trabajo que lleva. */
  repair?: Partial<Record<ResourceId, number>>;
  repairWork?: number;
  /** Lluvia ácida: cosecha que queda de lo que estaba plantado al aire libre (×0,7) y daño cada hora a quien está fuera (sin bajar de `harmFloor`). */
  cropYield?: number;
  harmPerHour?: number;
  harmFloor?: number;
  /** Plaga: parte de las plantas de un huerto que enferma, lo que se pierde si no se arrancan a tiempo, plantas mínimas y trabajo de arrancar una. */
  sickShare?: number;
  loss?: number;
  minPlants?: number;
  uprootWork?: number;
  /** Refugiado herido: horas que espera respuesta, salud con la que llega, salud a la que se da por curado, probabilidad de quedarse y relación que sube con su facción. */
  waitHours?: number;
  health?: number;
  healedAt?: number;
  stayChance?: number;
  relation?: number;
}

interface EventData {
  firstDay: number;
  gapDays: [number, number];
  events: EventDef[];
}

export function validateEvents(d: unknown): EventData {
  const e = d as EventData;
  const fail = (why: string) => {
    throw new Error(`Sucesos no válidos: ${why}`);
  };
  if (!e || !(e.firstDay >= 0) || !Array.isArray(e.gapDays) || !(e.gapDays[0] > 0 && e.gapDays[1] >= e.gapDays[0])) fail('calendario');
  if (!Array.isArray(e.events) || e.events.length === 0) fail('sin sucesos');
  for (const ev of e.events) {
    if (!ev.id || !ev.name || !(ev.weight > 0)) fail(`suceso ${ev.id}`);
    if (ev.hours !== undefined && !(ev.hours > 0)) fail(`duración de ${ev.id}`);
    for (const r of ev.pool ?? []) if (!RESOURCES.includes(r)) fail(`recurso desconocido ${r}`);
    if (ev.value && !(ev.value[0] > 0 && ev.value[1] >= ev.value[0])) fail(`valor de ${ev.id}`);
  }
  return e;
}

const DATA = validateEvents(raw);
export const EVENTS: readonly EventDef[] = DATA.events;
export const EVENT_FIRST_DAY = DATA.firstDay;
export const EVENT_GAP: [number, number] = DATA.gapDays;

export function eventDef(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}
