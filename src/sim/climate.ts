// Temperatura (pedido por Mikel el 2026-10-21): grados al aire libre según la estación y la hora
// (y la ola de frío), y dentro de cada habitación con tejado según su aislamiento, las estufas de
// leña y los calefactores y aires acondicionados, que llevan la habitación a la temperatura que se
// elija y solo gastan corriente mientras trabajan. Con calor fuerte, peor ánimo; si es extremo y
// dura, golpe de calor. El frío sigue en `seasons.ts` (usa estos grados).
// Puro y determinista: sin Phaser ni DOM.
import raw from '../data/climate.json';
import { seasonOf } from '../data/seasons';
import { roofed } from './roofs';
import type { Structure } from './structures';
import { TICKS_PER_HOUR } from './time';
import type { World } from './world';
import { coldWave } from './seasons';

interface ClimateData {
  seasons: Record<string, { base: number; swing: number }>;
  warmestHour: number;
  /** Con frío fuera, por debajo de estos grados se pasa frío aunque se esté bajo techo. */
  coldBelow: number;
  coldWaveMax: number;
  roofed: { buffer: number; shelter: number };
  stoveDegrees: number;
  refRoomTiles: number;
  target: { default: number; min: number; max: number };
  hot: { above: number; mood: number; text: string };
  heatstroke: { above: number; healthPerHour: number; floor: number; text: string };
}

export const CLIMATE: ClimateData = raw as unknown as ClimateData;

/** Media del día al aire libre (°C). */
function dayMean(w: World): number {
  const s = CLIMATE.seasons[seasonOf(w.day).id];
  return s.base;
}

/** Grados al aire libre ahora: más calor a media tarde y más frío de madrugada; la ola de frío los tumba. */
export function outdoorTemp(w: World): number {
  const s = CLIMATE.seasons[seasonOf(w.day).id];
  const t = s.base + s.swing * Math.cos((2 * Math.PI * (w.hour - CLIMATE.warmestHour)) / 24);
  return coldWave(w) ? Math.min(t - 15, CLIMATE.coldWaveMax) : t;
}

/** Temperatura que quiere un calefactor o un aire acondicionado (la elegida o la de por defecto). */
export function targetOf(s: Structure): number {
  return s.target ?? CLIMATE.target.default;
}

/** Cambia la temperatura elegida (entre el mínimo y el máximo). */
export function setTarget(s: Structure, degrees: number): void {
  s.target = Math.max(CLIMATE.target.min, Math.min(CLIMATE.target.max, Math.round(degrees)));
}

/** Habitaciones a las que da una construcción (la suya y las de sus lados, para las que bloquean). */
function roomsOf(w: World, s: Structure): Map<number, number> {
  const out = new Map<number, number>();
  const tiles = s.def.blocks ? w.structures.sidesOf(s) : w.structures.tilesOf(s);
  for (const t of tiles) {
    const r = w.rooms.at(t.x, t.y);
    if (r && roofed(w, t.x, t.y)) out.set(r.id, r.tiles.length);
  }
  return out;
}

/**
 * Cada segundo: la temperatura de cada habitación con tejado y qué aparatos trabajan.
 * Un aparato solo trabaja (y pide corriente) si la habitación está lejos de su temperatura.
 */
export function updateClimate(w: World): void {
  const sheltered = shelteredTemp(w);
  const temps = new Map<number, number>();
  const sizes = new Map<number, number>();
  // Habitaciones con tejado: su temperatura sin aparatos (amortiguan el frío y el calor de fuera).
  const seen = new Set<number>();
  const roomTemp = (id: number, size: number) => {
    if (!temps.has(id)) {
      temps.set(id, sheltered);
      sizes.set(id, size);
    }
  };
  const devices: { s: Structure; rooms: Map<number, number> }[] = [];
  for (const s of w.structures.all()) {
    if (!s.built) continue;
    const stove = s.def.heater && (s.fuel ?? 0) > 0;
    if (!stove && !s.def.climate) {
      delete s.climateOn;
      continue;
    }
    const rooms = roomsOf(w, s);
    for (const [id, size] of rooms) {
      if (seen.has(id)) continue;
      seen.add(id);
      roomTemp(id, size);
    }
    if (stove) {
      for (const id of rooms.keys()) temps.set(id, temps.get(id)! + CLIMATE.stoveDegrees * sizeFactor(sizes.get(id)!));
    } else devices.push({ s, rooms });
  }
  // Calefactores y aires acondicionados: si les llega corriente, acercan la habitación a lo elegido.
  for (const { s, rooms } of devices) {
    const c = s.def.climate!;
    const goal = targetOf(s);
    let on = false;
    for (const id of rooms.keys()) {
      const t = temps.get(id)!;
      const need = c.mode === 'calor' ? goal - t : t - goal;
      if (need <= 0.5) continue;
      on = true;
      if (!s.powered) continue;
      const step = Math.min(need, c.degrees * sizeFactor(sizes.get(id)!));
      temps.set(id, c.mode === 'calor' ? t + step : t - step);
    }
    s.climateOn = on || undefined;
  }
  w.roomTemps = temps;
}

/** Cuánto le cuesta a un aparato calentar o enfriar una habitación según su tamaño. */
function sizeFactor(tiles: number): number {
  return Math.max(0.3, Math.min(1.5, Math.sqrt(CLIMATE.refRoomTiles / Math.max(1, tiles))));
}

/** Grados de una habitación con tejado sin estufa ni aparatos: amortigua el frío y el calor de fuera. */
function shelteredTemp(w: World): number {
  const out = outdoorTemp(w);
  const mean = coldWave(w) ? Math.min(dayMean(w) - 15, CLIMATE.coldWaveMax) : dayMean(w);
  return out + (mean - out) * CLIMATE.roofed.buffer + CLIMATE.roofed.shelter;
}

/** Grados en una casilla: los de su habitación con tejado o, al aire libre, los de fuera. */
export function tileTemp(w: World, x: number, y: number): number {
  if (!roofed(w, x, y)) return outdoorTemp(w);
  const r = w.rooms.at(x, y);
  if (!r) return outdoorTemp(w);
  return w.roomTemps.get(r.id) ?? shelteredTemp(w);
}

/**
 * Cada segundo: quien está en un sitio de mucho calor lo nota en el ánimo; si pasa del límite del
 * golpe de calor, pierde salud poco a poco (sin bajar del suelo marcado).
 */
export function updateHeat(w: World, ticks: number): void {
  const H = CLIMATE.heatstroke;
  for (const c of w.colonists) {
    const n = c.needs;
    const t = c.vehicle?.boarded ? outdoorTemp(w) : tileTemp(w, c.tile.x, c.tile.y);
    if (t <= CLIMATE.hot.above) {
      delete n.hot;
      continue;
    }
    n.hot = true;
    if (t > H.above) c.health = Math.max(Math.min(c.health, H.floor), c.health - (H.healthPerHour * ticks) / TICKS_PER_HOUR);
  }
}
