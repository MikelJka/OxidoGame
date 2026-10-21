// Mapa del mundo (bases de las facciones, primera parte; elegido por Mikel el 2026-10-21): la
// colonia en el centro y la base de cada facción a unos días de viaje. Las bases crecen cada pocos
// días (gente y defensas) y más deprisa cuanto más ricas son: se enriquecen al comerciar con la
// colonia, al cobrar tributo y con los raids que les salen bien. Puro y determinista.
import { baseLevel, WORLD_MAP } from '../data/worldmap';
import { EXTRA_FACTIONS, factionDef, FACTIONS, NEW_FACTIONS } from '../data/factions';
import { Rng } from './rng';
import { TICKS_PER_DAY } from './time';
import type { FactionState } from './factions';
import type { World } from './world';

export interface FactionBase {
  /** Casilla del mapa del mundo. */
  x: number;
  y: number;
  population: number;
  /** Chapas que tiene ahorradas (hacen crecer la base). */
  wealth: number;
  /** Muros, torres y talleres que tiene (de defensa). */
  defenses: number;
  /** Tick de la última vez que creció. */
  grownAt: number;
}

/** Casilla de la colonia en el mapa del mundo (el centro). */
export function colonyCell(): { x: number; y: number } {
  return { x: Math.floor(WORLD_MAP.size[0] / 2), y: Math.floor(WORLD_MAP.size[1] / 2) };
}

/** Pone las bases de las facciones que no tienen (partida nueva o guardada antes de que hubiera). */
export function placeBases(factions: FactionState[], seed: number, tick: number): void {
  const rng = new Rng((seed ^ 0x5b0a5e5) >>> 0);
  const home = colonyCell();
  const taken = new Set<string>([`${home.x},${home.y}`]);
  for (const f of factions) if (f.base) taken.add(`${f.base.x},${f.base.y}`);
  for (const f of factions) {
    if (f.base) continue;
    let spot = { x: 0, y: 0 };
    for (let tries = 0; tries < 200; tries++) {
      const angle = rng.next() * Math.PI * 2;
      const d = rng.int(WORLD_MAP.baseDistance[0], WORLD_MAP.baseDistance[1]);
      const x = Math.max(0, Math.min(WORLD_MAP.size[0] - 1, Math.round(home.x + Math.cos(angle) * d)));
      const y = Math.max(0, Math.min(WORLD_MAP.size[1] - 1, Math.round(home.y + Math.sin(angle) * d * 0.6)));
      spot = { x, y };
      if (!taken.has(`${x},${y}`) && Math.abs(x - home.x) + Math.abs(y - home.y) >= WORLD_MAP.baseDistance[0]) break;
    }
    taken.add(`${spot.x},${spot.y}`);
    const S = WORLD_MAP.start;
    f.base = {
      ...spot,
      population: rng.int(S.population[0], S.population[1]),
      wealth: rng.int(S.wealth[0], S.wealth[1]),
      defenses: rng.int(S.defenses[0], S.defenses[1]),
      grownAt: tick,
    };
  }
}

/** Días de viaje de la colonia a la base. */
export function travelDays(b: FactionBase): number {
  const home = colonyCell();
  return Math.max(1, Math.round(Math.hypot(b.x - home.x, b.y - home.y) * WORLD_MAP.travelDaysPerCell * 2) / 2);
}

/** La base de una facción gana riqueza (comercio, tributo, botín de un raid). */
export function enrichBase(w: World, factionId: string | undefined, value: number): void {
  const f = factionId ? w.faction(factionId) : undefined;
  if (!f?.base || !(value > 0)) return;
  f.base.wealth += Math.round(value);
}

/** Cada día: las bases que llevan 5 días sin crecer crecen (más si son ricas). */
export function growBases(w: World): void {
  const G = WORLD_MAP.growth;
  for (const f of w.factions) {
    const b = f.base;
    if (!b || w.tick - b.grownAt < G.everyDays * TICKS_PER_DAY) continue;
    const rng = new Rng(((w.map.seed ^ 0x6a09e667) + Math.floor(w.tick / TICKS_PER_DAY) * 0x9e3779b1 + f.id.length * 7919) >>> 0);
    const before = baseLevel(b.population);
    const extra = Math.floor(b.wealth / G.wealthPerExtra);
    b.wealth -= extra * G.wealthPerExtra;
    b.population += rng.int(G.population[0], G.population[1]) + extra;
    b.defenses += rng.int(G.defenses[0], G.defenses[1]) + (extra > 0 ? 1 : 0);
    b.grownAt = w.tick;
    const after = baseLevel(b.population);
    if (after.id !== before.id) {
      const def = factionDef(f.id);
      w.addLog(`🗺 ${def?.icon ?? ''} ${f.settlement}, la base de ${def?.name ?? f.id}, ha crecido: ahora es ${after.name.toLowerCase()} (${b.population} habitantes).`, 'info');
    }
  }
}

/**
 * Facciones nuevas (opción 4B de Mikel): si quedan menos de 3, a los 3–6 días llega una de la lista
 * (que no haya estado ya) y monta su base en el mapa del mundo.
 */
export function checkNewFaction(w: World): void {
  if (w.factions.length >= NEW_FACTIONS.minFactions) {
    w.newFactionAt = null;
    return;
  }
  const rng = new Rng(((w.map.seed ^ 0x3c6ef372) + Math.floor(w.tick / TICKS_PER_DAY) * 0x85ebca6b) >>> 0);
  if (w.newFactionAt === null) {
    w.newFactionAt = w.tick + rng.int(NEW_FACTIONS.days[0], NEW_FACTIONS.days[1]) * TICKS_PER_DAY;
    return;
  }
  if (w.tick < w.newFactionAt) return;
  w.newFactionAt = null;
  const gone = new Set([...w.factions.map((f) => f.id), ...w.ruins.map((r) => r.faction)]);
  const pool = [...EXTRA_FACTIONS, ...FACTIONS].filter((d) => !gone.has(d.id));
  if (!pool.length) return;
  const def = pool[rng.int(0, pool.length - 1)];
  const f: FactionState = { id: def.id, settlement: def.settlements[rng.int(0, def.settlements.length - 1)], relation: def.start };
  w.factions.push(f);
  placeBases(w.factions, (w.map.seed + w.tick) >>> 0, w.tick);
  w.addLog(`🗺 Llega una facción nueva: ${def.icon} ${def.name}, que monta su base en ${f.settlement}. ${def.description}`, 'info');
}
