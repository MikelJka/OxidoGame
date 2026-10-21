// Estaciones, frío y abrigo (bloque 11 del catálogo): cada 10 días cambia la estación. En invierno
// no crece nada al aire libre y de noche hace frío: quien no está en una habitación con tejado y una
// estufa encendida, ni lleva abrigo, pasa frío (−10 % de ánimo) y, si dura, coge hipotermia.
// Puro y determinista: sin Phaser ni DOM.
import { eventDef } from '../data/events';
import { FoliageStage, SEASONS, seasonOf } from '../data/seasons';
import { isDaylight } from './power';
import { CLIMATE, tileTemp } from './climate';
import { roofed } from './roofs';
import { TICKS_PER_HOUR } from './time';
import type { World } from './world';

/** Fracción del año (0 = primer instante de la primavera, 1 = fin del invierno). */
export function yearFraction(day: number, hour: number): number {
  const len = SEASONS.daysPerSeason * SEASONS.seasons.length;
  const t = (Math.max(1, day) - 1 + hour / 24) / len;
  return t - Math.floor(t);
}

/**
 * Hojas de una planta en ese momento del año. `jitter` (0–1, fijo para cada planta) la adelanta o
 * retrasa un poco: así un bosque cambia de color poco a poco y no todo a la vez.
 */
export function foliageAt(day: number, hour: number, jitter: number): FoliageStage {
  const { spread, stages } = SEASONS.foliage;
  let t = yearFraction(day, hour) - jitter * spread;
  if (t < 0) t += 1;
  let stage = stages[0].id;
  for (const s of stages) if (t >= s.from) stage = s.id;
  return stage;
}

/** Nieve que cubre el suelo (0–1): sube en invierno y con la ola de frío; se funde en primavera. */
export function snowCover(w: World): number {
  const S = SEASONS.snow;
  const days = SEASONS.daysPerSeason;
  const season = seasonOf(w.day).id;
  const intoSeason = ((Math.max(1, w.day) - 1) % days) + w.hour / 24;
  let cover = 0;
  if (season === 'invierno') cover = Math.min(1, intoSeason / S.winterDaysToFull);
  // Lo que queda de la nieve del invierno al empezar la primavera (si hubo invierno antes).
  else if (season === 'primavera' && w.day > days) cover = Math.max(0, 1 - intoSeason / S.meltDays);
  for (const e of w.weather) {
    if (w.tick >= e.until || !eventDef(e.id)?.coldWave) continue;
    const def = eventDef(e.id);
    const started = e.until - (def?.hours ?? 48) * TICKS_PER_HOUR;
    cover = Math.max(cover, Math.min(1, (w.tick - started) / TICKS_PER_HOUR / S.coldWaveHoursToFull));
  }
  return cover;
}

/** Es invierno. */
export function isWinter(w: World): boolean {
  return seasonOf(w.day).id === 'invierno';
}

/** Hay una ola de frío (suceso de 48 h). */
export function coldWave(w: World): boolean {
  return w.weather.some((e) => w.tick < e.until && eventDef(e.id)?.coldWave);
}

/** Ahora hace frío (invierno y de noche, o una ola de frío). */
export function coldNow(w: World): boolean {
  return (isWinter(w) && !isDaylight(w.hour)) || coldWave(w);
}

/** No crece nada al aire libre (invierno u ola de frío). */
export function frostNow(w: World): boolean {
  return isWinter(w) || coldWave(w);
}

/** Casillas calientes: las de las habitaciones con tejado que tienen una estufa encendida. */
export function warmTiles(w: World): Set<number> {
  const out = new Set<number>();
  for (const s of w.structures.all()) {
    if (!s.built || !s.def.heater || (s.fuel ?? 0) <= 0) continue;
    for (const t of w.structures.sidesOf(s)) {
      const room = w.rooms.at(t.x, t.y);
      if (!room || !roofed(w, t.x, t.y)) continue;
      for (const i of room.tiles) out.add(i);
    }
  }
  return out;
}

/**
 * Cada segundo: quien pasa frío lo nota en el ánimo y va sumando tiempo; con 4 horas seguidas,
 * hipotermia (pierde salud cada hora, sin bajar del 15 %). Al entrar en calor se le pasa.
 */
export function updateCold(w: World, ticks: number): void {
  const cold = coldNow(w);
  const warm = cold ? warmTiles(w) : new Set<number>();
  const H = SEASONS.hypothermia;
  for (const c of w.colonists) {
    const n = c.needs;
    // Con frío fuera, se libra quien está en una habitación caliente: con estufa o con su calefactor
    // a una temperatura agradable (pedido por Mikel el 2026-10-21).
    const here = c.tile.y * w.map.width + c.tile.x;
    const heated = warm.has(here) || (cold && tileTemp(w, c.tile.x, c.tile.y) >= CLIMATE.coldBelow);
    const freezing = cold && !c.coat && !c.vehicle?.boarded && !heated;
    if (!freezing) {
      delete n.cold;
      delete n.coldTicks;
      continue;
    }
    n.cold = true;
    const before = n.coldTicks ?? 0;
    n.coldTicks = before + ticks;
    const limit = H.afterHours * TICKS_PER_HOUR;
    if (n.coldTicks >= limit) {
      if (before < limit) w.addLog(`🥶 ${c.name} tiene hipotermia: necesita una habitación con estufa o un abrigo.`, 'malo', 'herido', c.tile);
      c.health = Math.max(Math.min(c.health, H.floor), c.health - (H.healthPerHour * ticks) / TICKS_PER_HOUR);
    }
  }
}
