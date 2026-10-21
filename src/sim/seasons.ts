// Estaciones, frío y abrigo (bloque 11 del catálogo): cada 10 días cambia la estación. En invierno
// no crece nada al aire libre y de noche hace frío: quien no está en una habitación con tejado y una
// estufa encendida, ni lleva abrigo, pasa frío (−10 % de ánimo) y, si dura, coge hipotermia.
// Puro y determinista: sin Phaser ni DOM.
import { eventDef } from '../data/events';
import { SEASONS, seasonOf } from '../data/seasons';
import { isDaylight } from './power';
import { roofed } from './roofs';
import { TICKS_PER_HOUR } from './time';
import type { World } from './world';

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
    const freezing = cold && !c.coat && !c.vehicle?.boarded && !warm.has(c.tile.y * w.map.width + c.tile.x);
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
