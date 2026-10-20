/**
 * Mortero (bloque 5 del catálogo, con «Artillería»): 🔗20 ⚙️4 🔩10, 1×1. Lo maneja un colono
 * reclutado que esté pegado a él (en una de las 8 casillas de alrededor) y no se haya retirado.
 * Tira por encima de los muros a un enemigo a 6–20 casillas: elige la casilla con más enemigos en pie
 * en su 3×3 y ningún colono. Cada disparo gasta 🔩2 de su depósito, que los colonos con «Transportar»
 * rellenan como el combustible de un generador. Falla un 40 %: entonces cae hasta 2 casillas al lado.
 * El proyectil estalla como una granada (3×3, también a colonos que estén allí, y daña muros).
 * Los números están en `src/data/buildings.json` (`mortero`).
 */
import type { Colonist } from './colonist';
import type { Point } from './pathfinding';
import { ATTACK_COOLDOWN } from './people';
import type { Structure } from './structures';
import { TICKS_PER_SECOND } from './time';
import type { World } from './world';

const hostile = (c: Colonist) => c.role === 'saqueador' && !c.downed && !c.raider?.fleeing;
const cheb = (p: Point, q: Point) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));

/** Morteros construidos (sin orden de demoler). */
export function mortars(w: World): Structure[] {
  return w.structures.all().filter((s) => s.built && !!s.def.mortar && !s.demolish);
}

/** Disparos que le quedan en el depósito. */
export function mortarShots(s: Structure): number {
  const m = s.def.mortar;
  return m ? Math.floor((s.fuel ?? 0) / m.ammoPerShot) : 0;
}

/** ¿Puede este colono manejar un mortero ahora? (reclutado, en pie, a pie y sin retirarse) */
function canMan(c: Colonist): boolean {
  return c.role === 'colono' && c.drafted && !c.downed && !c.vehicle && c.stance !== 'retirarse';
}

/** El mortero que maneja este colono (pegado a él), o undefined. */
export function mortarManned(w: World, c: Colonist): Structure | undefined {
  if (!canMan(c)) return undefined;
  return mortars(w).find((s) => cheb(s, c.tile) <= 1);
}

/** Quién maneja este mortero: el colono apto pegado a él (el de id más bajo si hay varios). */
export function mortarCrew(w: World, s: Structure): Colonist | undefined {
  return w.colonists.filter((c) => canMan(c) && cheb(s, c.tile) <= 1).sort((a, b) => a.id - b.id)[0];
}

/**
 * A dónde tiraría: la casilla de un enemigo a `minReach`–`reach` del mortero con más enemigos en pie
 * en su 3×3 y ningún colono (ni caído). A igualdad, el más cercano. null si no hay.
 */
export function mortarTarget(w: World, s: Structure): Point | null {
  const m = s.def.mortar;
  if (!m) return null;
  const enemies = w.others.filter(hostile);
  let best: { p: Point; n: number; d: number } | null = null;
  for (const e of enemies) {
    const d = cheb(s, e.tile);
    if (d < m.minReach || d > m.reach) continue;
    if (w.colonists.some((c) => cheb(c.tile, e.tile) <= 1)) continue;
    const n = enemies.filter((o) => cheb(o.tile, e.tile) <= 1).length;
    if (!best || n > best.n || (n === best.n && d < best.d)) best = { p: { x: e.tile.x, y: e.tile.y }, n, d };
  }
  return best?.p ?? null;
}

/**
 * Cada tick: la munición que han traído pasa al depósito y cada mortero manejado, cargado y listo
 * dispara a su objetivo. El proyectil va por `w.grenades` (estalla igual que una granada).
 */
export function updateMortars(w: World): void {
  const list = mortars(w);
  if (list.length === 0) return;
  for (const s of list) {
    const m = s.def.mortar!;
    const r = m.ammo.resource;
    if (s.delivered[r]) {
      s.fuel = Math.min(m.ammo.capacity, (s.fuel ?? 0) + (s.delivered[r] ?? 0));
      delete s.delivered[r];
    }
    if (mortarShots(s) <= 0 || w.turretCooldown.has(s.id)) continue;
    const crew = mortarCrew(w, s);
    if (!crew) continue;
    const aim = mortarTarget(w, s);
    if (!aim) continue;
    s.fuel = Math.max(0, (s.fuel ?? 0) - m.ammoPerShot);
    w.turretCooldown.set(s.id, Math.round(m.cooldownSeconds * TICKS_PER_SECOND));
    crew.attackCooldown = ATTACK_COOLDOWN;
    let to = aim;
    if (w.rng.chance(m.missChance)) {
      // Falla: cae a 1–`missSpread` casillas del objetivo, dentro del mapa.
      for (let i = 0; i < 8; i++) {
        const x = aim.x + w.rng.int(-m.missSpread, m.missSpread);
        const y = aim.y + w.rng.int(-m.missSpread, m.missSpread);
        if ((x === aim.x && y === aim.y) || x < 0 || y < 0 || x >= w.map.width || y >= w.map.height) continue;
        to = { x, y };
        break;
      }
    }
    const dx = aim.x - crew.tile.x;
    if (dx !== 0) crew.facing = dx > 0 ? 1 : -1;
    w.grenades.push({ from: { x: s.x, y: s.y }, to, thrownAt: w.tick, explodeAt: w.tick + m.flightTicks, by: crew.name, shell: true });
    w.combatAlert(crew, 'combate', `💣 ${crew.name} dispara el mortero.`);
  }
}
