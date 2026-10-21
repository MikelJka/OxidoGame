// Bandeja hidropónica (bloque 5 del catálogo, aprobado por Mikel el 2026-10-18, con «Hidropónica»):
// cultiva sola patatas, maíz o hierba bajo techo y con corriente, ×1,5 más rápido que un huerto y sin
// fertilidad. Al madurar deja la cosecha a su lado y vuelve a sembrar. Sin corriente o sin tejado, no
// crece. Puro y determinista: sin Phaser ni DOM.
import { cropDef, CropDef } from '../data/crops';
import { isPassable } from './map';
import { lacksPower } from './power';
import { roofed } from './roofs';
import type { Structure } from './structures';
import { TICKS_PER_DAY } from './time';
import type { World } from './world';

/** Lo que cultiva una bandeja (lo elegido o, si no, lo primero que admite). */
export function trayCrop(s: Structure): CropDef | undefined {
  const h = s.def.hydroponics;
  if (!h) return undefined;
  const id = s.crop && h.crops.includes(s.crop) ? s.crop : h.crops[0];
  return cropDef(id);
}

/** Cambia a lo siguiente que admite (y empieza de cero). */
export function cycleTrayCrop(s: Structure): CropDef | undefined {
  const h = s.def.hydroponics;
  if (!h) return undefined;
  const now = trayCrop(s);
  const k = now ? h.crops.indexOf(now.id) : -1;
  s.crop = h.crops[(k + 1) % h.crops.length];
  s.growth = 0;
  return trayCrop(s);
}

/** Por qué no crece ahora (o null si crece). */
export function trayBlocked(w: World, s: Structure): string | null {
  if (!s.built) return 'sin terminar';
  if (lacksPower(s)) return 'sin corriente';
  if (!w.structures.tilesOf(s).every((t) => roofed(w, t.x, t.y))) return 'sin tejado (va en una habitación con techo)';
  return null;
}

/** Cada segundo: crecen las bandejas que pueden; al madurar, la cosecha cae a su lado. */
export function updateHydroponics(w: World, ticks: number): void {
  for (const s of w.structures.all()) {
    const h = s.def.hydroponics;
    if (!h || trayBlocked(w, s)) continue;
    const crop = trayCrop(s);
    if (!crop) continue;
    s.growth = Math.min(1, (s.growth ?? 0) + (ticks * h.speed) / (crop.growDays * TICKS_PER_DAY));
    if (s.growth < 1) continue;
    const spot = w.structures.sidesOf(s).find((t) => isPassable(w.map, t.x, t.y) && !w.structures.at(t.x, t.y)?.def.blocks);
    if (!spot) continue;
    let amount = 0;
    for (const _ of w.structures.tilesOf(s)) amount += w.rng.int(crop.yield[0], crop.yield[1]);
    w.items.drop(spot.x, spot.y, crop.resource, amount);
    s.growth = 0;
  }
}
