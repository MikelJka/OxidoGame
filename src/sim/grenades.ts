/**
 * Granadas caseras (bloque 13 del catálogo; elegido por Mikel el 2026-10-20, opción B). Se fabrican
 * en el banco de trabajo tras investigar «Explosivos». Cada colono coge 2 del almacén y las lleva
 * aparte de su arma. En combate lanza una (como mucho una cada 10 s, a 6 casillas o menos) cuando hay
 * 2 o más enemigos en un 3×3 sin ningún colono dentro. Tarda un momento en estallar: hace daño ×3 a
 * todos los que estén entonces en el 3×3, también a un colono que haya entrado en el último momento,
 * y quita un poco de vida a muros y puertas. Los números están en `src/data/weapons.json` (`grenade`).
 * Desde el día 30 algunos saqueadores traen una y la lanzan igual, a un grupo de colonos.
 */
import { armorProtection } from '../data/armor';
import { GRENADE } from '../data/weapons';
import type { Colonist } from './colonist';
import { BODY_PARTS, hurt } from './health';
import type { Point } from './pathfinding';
import { creatureFallText, foeLabel, hurtFoe } from './people';
import { witnessFall } from './panic';
import { absorbHit } from './vehicles';
import { TICKS_PER_SECOND } from './time';
import type { World } from './world';

/** Daño medio de un puñetazo (los golpes quitan de 0,08 a 0,18 de salud): la granada pega ×3. */
export const GRENADE_FIST_DAMAGE = 0.13;

/** Una granada en el aire: sale de `from` y estalla en `to` en el tick `explodeAt`. */
export interface Grenade {
  from: Point;
  to: Point;
  thrownAt: number;
  explodeAt: number;
  /** Quién la lanzó (para el diario). */
  by: string;
  /** La lanzó un saqueador (contra los colonos). */
  foe?: boolean;
  /** Es un proyectil de mortero (`by` es quien lo maneja). */
  shell?: boolean;
}

/** Explosión reciente (solo para el dibujado; no se guarda). */
export interface Blast {
  x: number;
  y: number;
  tick: number;
}

/** Ticks que se ve el fogonazo de una explosión. */
export const BLAST_TICKS = 18;

const hostile = (c: Colonist) => c.role === 'saqueador' && !c.downed && !c.raider?.fleeing;
/** Saqueador en pie (los suyos: no lanza si hay alguno en el 3×3). */
const raiderUp = (c: Colonist) => c.role === 'saqueador' && !c.downed;

const within = (p: Point, q: Point, r: number) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) <= r;

/** Granadas que lleva encima. */
export function grenadesOf(c: Colonist): number {
  return c.grenades ?? 0;
}

/**
 * Dónde lanzaría ahora una granada: la casilla de un enemigo a su alcance con más enemigos en pie en
 * su 3×3 (al menos 2) y ninguno de los suyos. Un colono no la lanza si hay un colono (ni en el suelo);
 * un saqueador apunta a colonos en pie y no la lanza si hay un saqueador en pie. A igualdad, la más
 * cercana. null si no hay.
 */
export function grenadeTarget(w: World, c: Colonist): Point | null {
  const r = GRENADE.radius;
  const foe = c.role === 'saqueador';
  const enemies = foe ? w.colonists.filter((m) => !m.downed) : w.others.filter(hostile);
  if (enemies.length < GRENADE.minTargets) return null;
  const mates = foe ? w.others.filter((o) => o !== c && raiderUp(o)) : w.colonists;
  let best: { p: Point; n: number; d: number } | null = null;
  for (const e of enemies) {
    const d = Math.max(Math.abs(e.tile.x - c.tile.x), Math.abs(e.tile.y - c.tile.y));
    if (d > GRENADE.reach) continue;
    if (mates.some((m) => within(m.tile, e.tile, r))) continue;
    if (foe && within(c.tile, e.tile, r)) continue;
    const n = enemies.filter((o) => within(o.tile, e.tile, r)).length;
    if (n < GRENADE.minTargets) continue;
    if (!best || n > best.n || (n === best.n && d < best.d)) best = { p: { x: e.tile.x, y: e.tile.y }, n, d };
  }
  return best?.p ?? null;
}

/** Si puede y le conviene, lanza una granada. true si la ha lanzado. */
export function tryThrowGrenade(w: World, c: Colonist): boolean {
  if (grenadesOf(c) <= 0 || c.downed || w.tick < (c.grenadeReadyAt ?? 0)) return false;
  const to = grenadeTarget(w, c);
  if (!to) return false;
  c.grenades = grenadesOf(c) - 1;
  c.grenadeReadyAt = w.tick + Math.round(GRENADE.cooldownSeconds * TICKS_PER_SECOND);
  const dx = to.x - c.tile.x;
  if (dx !== 0) c.facing = dx > 0 ? 1 : -1;
  const foe = c.role === 'saqueador';
  const by = foe ? foeLabel(c) : c.name;
  w.grenades.push({ from: { x: c.tile.x, y: c.tile.y }, to, thrownAt: w.tick, explodeAt: w.tick + GRENADE.fuseTicks, by, ...(foe ? { foe } : {}) });
  if (foe) w.addLog(`💣 ¡${by} lanza una granada! Apartaos.`, 'malo', 'combate', to);
  else w.combatAlert(c, 'combate', `💣 ${c.name} lanza una granada.`);
  return true;
}

/** Cada tick: estallan las granadas a las que les toca y se olvidan los fogonazos viejos. */
export function updateGrenades(w: World): void {
  const old = w.blasts.findIndex((b) => w.tick - b.tick <= BLAST_TICKS);
  w.blasts.splice(0, old < 0 ? w.blasts.length : old);
  if (w.grenades.length === 0) return;
  const due = w.grenades.filter((g) => g.explodeAt <= w.tick);
  if (due.length === 0) return;
  w.grenades.splice(0, w.grenades.length, ...w.grenades.filter((g) => g.explodeAt > w.tick));
  for (const g of due) explodeGrenade(w, g);
}

/** Estalla: daño a todos los que están en pie en el 3×3 (enemigos y colonos) y a muros y puertas. */
export function explodeGrenade(w: World, g: Grenade): void {
  w.addLog(g.shell ? `💥 Cae el proyectil del mortero de ${g.by}.` : `💥 Estalla la granada de ${g.by}.`, g.foe ? 'malo' : 'bueno', 'combate', g.to);
  blastAt(w, g.to, GRENADE.radius, GRENADE.damage, GRENADE.structureDamage, g.shell ? 'El mortero' : 'La granada', g.shell ? 'el proyectil' : 'la granada');
}

/**
 * Una explosión (granada, mortero, un vehículo o un depósito que revientan): hiere a todos a `r`
 * casillas (daño ×`damage` los puños de una granada) y daña muros, puertas y portones.
 */
export function blastAt(w: World, to: Point, r: number, damage: number, structureDamage: number, what: string, cause: string): void {
  w.blasts.push({ x: to.x, y: to.y, tick: w.tick });
  for (const p of w.pawns()) {
    if (p.downed || !within(p.tile, to, r)) continue;
    const tough = p.traits.some((t) => t.id === 'duro') ? 0.75 : 1;
    const armor = 1 - armorProtection([p.vest, p.helmet]);
    const dmg = absorbHit(w, p, GRENADE_FIST_DAMAGE * damage * tough * armor);
    const part = BODY_PARTS[w.rng.int(0, BODY_PARTS.length - 1)];
    if (p.role === 'colono') {
      hurt(p, dmg, part);
      if (p.downed) {
        w.addLog(`🩸 ${p.name} cae herido por ${cause} (${part}).`, 'malo', 'caido', p.tile);
        witnessFall(w, p);
      } else w.combatAlert(p, 'herido', `🩸 ${p.name} está herido por ${cause} (${part}).`);
    } else if (p.role === 'saqueador' && hurtFoe(w, p, dmg, part)) {
      w.addLog(p.creature ? creatureFallText(p) : `${foeLabel(p)} cae al suelo.`, 'bueno');
    }
    if (p.downed) p.path = [];
  }
  // Muros, puertas y portones: un poco de daño a cada uno (una vez aunque ocupe varias casillas).
  const hit = new Set<number>();
  for (let y = to.y - r; y <= to.y + r; y++) {
    for (let x = to.x - r; x <= to.x + r; x++) {
      const s = w.structures.mainAt(x, y);
      if (!s?.built || hit.has(s.id)) continue;
      const cat = s.def.category;
      if (cat !== 'muro' && cat !== 'puerta' && cat !== 'porton') continue;
      hit.add(s.id);
      s.hp -= Math.max(1, Math.round(s.def.hp * structureDamage));
      if (s.hp <= 0) {
        w.breakStructure(s);
        w.addLog(`💥 ${what} derriba: ${s.def.name.toLowerCase()}.`, 'malo', 'combate', { x: s.x, y: s.y });
      }
    }
  }
}
