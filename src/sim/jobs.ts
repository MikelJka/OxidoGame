// Sistema de trabajos: convierte designaciones, montones sueltos y planos en tareas,
// las reserva para un colono y elige la siguiente según sus prioridades y la distancia.
// Determinista: sin azar.
import type { Skill } from '../data/colonists';
import { eventDef } from '../data/events';
import { FIRE } from '../data/fire';
import { TAMING } from '../data/creatures';
import { ROOMS } from '../data/roomRules';
import { depositOf } from '../data/buildings';
import { MAX_STACK, RESOURCES, ResourceId } from '../data/resources';
import { BLUEPRINT_SHARE_RADIUS, FINISH_WORK, WORK_SKILL, WORK_TYPES, WorkType } from '../data/work';
import { Colonist, ColonistJob } from './colonist';
import { RESEARCH_BENCH, RESEARCH_CHUNK_HOURS } from '../data/research';
import type { ResearchState } from './research';
import { Designations } from './designations';
import { GroundItems } from './items';
import { GameMap, index, isPassable, PROP_INFO, Prop } from './map';
import { findPath, Point } from './pathfinding';
import { harvestAt, Stockpile } from './resources';
import { isFood, needsWorkFactor } from './needs';
import { needsDose } from './health';
import { lacksPower } from './power';
import { isLitBonfire } from './bonfire';
import type { Corpse } from './corpses';
import { TICKS_PER_HOUR } from './time';

/** Horas entre charlas con un prisionero. */
export const TALK_HOURS = 6;

/** Puede tocarle charla a un prisionero. */
export function canTalk(tick: number, o: Colonist): boolean {
  return !!o.prisoner && o.prisoner.mode === 'convencer' && !o.downed && tick - o.prisoner.lastTalk >= TALK_HOURS * TICKS_PER_HOUR;
}
import { billPending, buildWork, Structure, Structures } from './structures';
import { StorageZones } from './zones';
import { GrowZones } from './farming';
import { TERRAIN_WORK, terrainBlocker, TerrainOrders } from './terrain';

/** Cuántas tareas candidatas (las más cercanas) de cada prioridad se prueban con el buscador de caminos. */
const CANDIDATES_PER_SEARCH = 8;
/** Límite de nodos del buscador de caminos al buscar trabajo. */
export const JOB_PATH_NODES = 12000;

const SIDES: readonly Point[] = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }];

/** Velocidad de trabajo de un colono (1 = normal): de ×0,6 con habilidad 0 a ×1,6 con 20. */
export function workSpeed(c: Colonist, kind: WorkType, skillOverride?: Skill, range?: readonly [number, number]): number {
  const skill = skillOverride ?? WORK_SKILL[kind];
  if (skill && range) return (range[0] + (range[1] - range[0]) * (c.skills[skill] / 20)) * needsWorkFactor(c);
  return (skill ? 0.6 + c.skills[skill] * 0.05 : 1) * needsWorkFactor(c);
}

/** Trabajo de desmontar (y otro tanto de montar) un mueble que se mueve: un cuarto de construirlo. */
export function moveWork(buildWork: number): number {
  return Math.max(30, Math.ceil(buildWork / 4));
}

/** Huecos de reserva de una casilla: el trabajo en ella, recoger su montón o dejar algo en ella. */
export type ReservationSlot = 'work' | 'pickup' | 'drop';
const SLOTS: readonly ReservationSlot[] = ['work', 'pickup', 'drop'];

/** Reservas de tareas: cada hueco de cada casilla lo tiene como mucho un colono. */
export class Reservations {
  private byKey = new Map<number, number>();

  constructor(readonly map: GameMap) {}

  private key(x: number, y: number, slot: ReservationSlot): number {
    return index(this.map, x, y) * SLOTS.length + SLOTS.indexOf(slot);
  }

  holder(x: number, y: number, slot: ReservationSlot = 'work'): number | undefined {
    return this.byKey.get(this.key(x, y, slot));
  }

  /** Reserva un hueco para un colono. false si ya lo tiene otro. */
  reserve(x: number, y: number, colonistId: number, slot: ReservationSlot = 'work'): boolean {
    const k = this.key(x, y, slot);
    const h = this.byKey.get(k);
    if (h !== undefined && h !== colonistId) return false;
    this.byKey.set(k, colonistId);
    return true;
  }

  release(x: number, y: number, colonistId: number, slot: ReservationSlot = 'work'): void {
    const k = this.key(x, y, slot);
    if (this.byKey.get(k) === colonistId) this.byKey.delete(k);
  }

  /** Suelta todas las reservas de un colono. */
  releaseAll(colonistId: number): void {
    for (const [k, id] of this.byKey) if (id === colonistId) this.byKey.delete(k);
  }

  list(): { x: number; y: number; slot: ReservationSlot; colonistId: number }[] {
    return [...this.byKey].map(([k, colonistId]) => {
      const i = Math.floor(k / SLOTS.length);
      return { x: i % this.map.width, y: Math.floor(i / this.map.width), slot: SLOTS[k % SLOTS.length], colonistId };
    });
  }
}

/** Lo que necesita el sistema de trabajos (lo cumple `World`). */
export interface JobContext {
  map: GameMap;
  designations: Designations;
  reservations: Reservations;
  items: GroundItems;
  zones: StorageZones;
  structures: Structures;
  farms: GrowZones;
  terrain: TerrainOrders;
  /** Lo que tiene la colonia (para saber si un taller tiene que seguir fabricando). */
  inventory(): Stockpile;
  colonists: Colonist[];
  /** Saqueadores, prisioneros y comerciantes. */
  others: Colonist[];
  /** Cadáveres de criaturas en el suelo (se llevan a una hoguera encendida). */
  corpses: readonly Corpse[];
  tick: number;
  /** Camas de prisionero libres que no tiene ya apalabradas otro carcelero (para capturar hace falta una, #22). */
  prisonBedsFree(): number;
  /** Investigación: el proyecto en marcha (si no hay, nadie investiga). */
  research: ResearchState;
  /** No queda ningún saqueador en pie que no huya: toca lo médico antes que nada. */
  fightOver(): boolean;
  /** Colono en el suelo, fuera de la cama, al que hay que llevar a una cama libre tras el combate. */
  wantsCarryToBed(p: Colonist): boolean;
  /** Casillas que arden cerca de la colonia (hay que apagarlas). */
  fireThreats(): Point[];
  /** Casillas de habitaciones cerradas que piden tejado. */
  roofTodo(): Point[];
}

/** Colono que necesita que le atiendan ya: sangra. */
export const needsUrgentCare = (k: Colonist): boolean => k.role === 'colono' && k.wounds.some((w) => w.bleeding);

/** Un taller tiene que seguir: orden activa y la colonia aún no tiene lo que pide. */
export function stationWantsWork(ctx: JobContext, s: Structure): boolean {
  const b = s.bill;
  // Mientras se electrifica, no se fabrica.
  if (!s.built || !b || b.paused || s.demolish || s.upgrade) return false;
  // La recicladora sin corriente está parada.
  if (lacksPower(s)) return false;
  return billPending(b, ctx.inventory());
}

/** Casillas desde las que se puede trabajar un objeto: la suya si se pisa, si no las de los lados. */
export function standTiles(map: GameMap, x: number, y: number): Point[] {
  if (isPassable(map, x, y)) return [{ x, y }];
  return sideTiles(map, x, y);
}

/** Casillas transitables a los lados (no en diagonal). */
export function sideTiles(map: GameMap, x: number, y: number): Point[] {
  return SIDES.map((d) => ({ x: x + d.x, y: y + d.y })).filter((p) => isPassable(map, p.x, p.y));
}

/** Ya está en un sitio desde el que puede trabajar la casilla. */
export function canWorkFrom(map: GameMap, at: Point, x: number, y: number): boolean {
  if (at.x === x && at.y === y) return true;
  if (isPassable(map, x, y)) return false; // si el objeto se pisa, hay que estar encima
  return isBeside(at, x, y);
}

/** Está justo al lado (no en diagonal). Así se construye: desde fuera del plano. */
export function isBeside(at: Point, x: number, y: number): boolean {
  return Math.abs(at.x - x) + Math.abs(at.y - y) === 1;
}

export interface JobPlan {
  job: ColonistJob;
  path: Point[];
}

interface Candidate {
  kind: WorkType;
  x: number;
  y: number;
  dist: number;
  make: () => JobPlan | null;
  /** Va por delante de todo lo demás (curar a un colono herido tras el combate). */
  urgent?: boolean;
}

const manhattan = (a: Point, x: number, y: number) => Math.abs(a.x - x) + Math.abs(a.y - y);

/** Camino hasta la casilla más cercana de una lista a la que se pueda llegar. */
export function pathToNearest(map: GameMap, from: Point, targets: Point[]): { stand: Point; path: Point[] } | null {
  const sorted = [...targets].sort((a, b) => manhattan(from, a.x, a.y) - manhattan(from, b.x, b.y));
  for (const t of sorted) {
    if (t.x === from.x && t.y === from.y) return { stand: { ...t }, path: [] };
    const path = findPath(map, from, t, JOB_PATH_NODES);
    if (path) return { stand: t, path };
  }
  return null;
}

/**
 * Mejor casilla de almacén para un recurso que está ahora con prioridad `current`:
 * la zona de más prioridad (mayor que la actual) con sitio, y en ella la casilla más cercana,
 * prefiriendo completar montones del mismo recurso.
 */
export function bestStorageTile(ctx: JobContext, resource: ResourceId, current: number, near: Point): Point | null {
  const zones = ctx.zones
    .all()
    .filter((z) => z.accepts[resource] && z.priority > current)
    .sort((a, b) => b.priority - a.priority || a.id - b.id);
  let level = -1;
  let best: Point | null = null;
  let bestScore = Infinity;
  for (const z of zones) {
    if (best && z.priority < level) break; // ya hay sitio en una zona más importante
    for (const i of z.tiles) {
      const x = i % ctx.map.width;
      const y = Math.floor(i / ctx.map.width);
      if (ctx.items.room(x, y, resource) <= 0) continue;
      if (ctx.reservations.holder(x, y, 'drop') !== undefined) continue;
      if (ctx.structures.at(x, y)?.built === false) continue; // no se guarda encima de un plano
      const merge = ctx.items.at(x, y) ? -0.5 : 0;
      const score = manhattan(near, x, y) + merge;
      if (score < bestScore || (score === bestScore && best && (y < best.y || (y === best.y && x < best.x)))) {
        best = { x, y };
        bestScore = score;
        level = z.priority;
      }
    }
  }
  return best;
}

/** Prioridad de almacén más alta que acepta cada recurso (0 si ninguna). */
function maxStoragePriority(ctx: JobContext): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {};
  for (const z of ctx.zones.all()) {
    for (const r of Object.keys(z.accepts) as ResourceId[]) {
      if (z.accepts[r]) out[r] = Math.max(out[r] ?? 0, z.priority);
    }
  }
  return out;
}

function harvestCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  const out: Candidate[] = [];
  for (const d of ctx.designations.list()) {
    if (c.priorities[d.job] === 0) continue;
    const holder = ctx.reservations.holder(d.x, d.y);
    if (holder !== undefined && holder !== c.id) continue;
    out.push({
      kind: d.job, x: d.x, y: d.y, dist: manhattan(c.tile, d.x, d.y),
      make: () => {
        const h = harvestAt(ctx.map, d.x, d.y);
        if (!h) return null;
        const here = canWorkFrom(ctx.map, c.tile, d.x, d.y);
        const route = here ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, standTiles(ctx.map, d.x, d.y));
        if (!route) return null;
        return { job: { kind: d.job, x: d.x, y: d.y, stand: route.stand, progress: 0, work: h.work }, path: route.path };
      },
    });
  }
  return out;
}

function haulCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  if (c.priorities.transportar === 0 || ctx.zones.all().length === 0) return [];
  const maxPrio = maxStoragePriority(ctx);
  const out: Candidate[] = [];
  for (const s of ctx.items.list()) {
    const current = ctx.zones.priorityFor(s.x, s.y, s.resource);
    if ((maxPrio[s.resource] ?? 0) <= current) continue;
    if (ctx.reservations.holder(s.x, s.y, 'pickup') !== undefined) continue;
    out.push({
      kind: 'transportar', x: s.x, y: s.y, dist: manhattan(c.tile, s.x, s.y),
      make: () => {
        const to = bestStorageTile(ctx, s.resource, current, s);
        if (!to) return null;
        const amount = Math.min(s.amount, ctx.items.room(to.x, to.y, s.resource), MAX_STACK[s.resource]);
        if (amount <= 0) return null;
        const route = pathToNearest(ctx.map, c.tile, [{ x: s.x, y: s.y }]);
        if (!route) return null;
        return {
          job: {
            kind: 'transportar', x: s.x, y: s.y, stand: route.stand, progress: 0, work: 0,
            haul: { resource: s.resource, amount, from: { x: s.x, y: s.y }, to, toBlueprint: false, picked: false },
          },
          path: route.path,
        };
      },
    });
  }
  return out;
}

/** Montón más cercano a `near` de alguno de los recursos que pide un plano. */
function nearestMaterial(ctx: JobContext, s: Structure, near: Point): { x: number; y: number; resource: ResourceId; amount: number } | null {
  const needs = ctx.structures.needs(s);
  let best: { x: number; y: number; resource: ResourceId; amount: number } | null = null;
  let bestDist = Infinity;
  for (const st of ctx.items.list()) {
    const want = needs[st.resource] ?? 0;
    if (want <= 0) continue;
    if (ctx.reservations.holder(st.x, st.y, 'pickup') !== undefined) continue;
    const d = manhattan(near, st.x, st.y);
    if (d < bestDist) {
      bestDist = d;
      best = { x: st.x, y: st.y, resource: st.resource, amount: Math.min(want, st.amount, MAX_STACK[st.resource]) };
    }
  }
  return best;
}

/**
 * Reparto de material (#20): otros planos cerca de `s` que piden el mismo recurso y no tiene otro
 * colono, en el orden en que se recorren (siempre el más cercano al anterior). Con ellos, la carga
 * crece hasta lo que cabe en las manos o lo que queda en el montón.
 */
export function shareBlueprints(ctx: JobContext, c: Colonist, s: Structure, resource: ResourceId, first: number, stack: number): { amount: number; extra: { sid: number; x: number; y: number }[] } {
  const cap = Math.min(stack, MAX_STACK[resource]);
  let amount = Math.min(first, cap);
  const extra: { sid: number; x: number; y: number }[] = [];
  const pool = ctx.structures.blueprints().filter((o) => {
    if (o.id === s.id || manhattan(s, o.x, o.y) > BLUEPRINT_SHARE_RADIUS) return false;
    const holder = ctx.reservations.holder(o.x, o.y);
    if (holder !== undefined && holder !== c.id) return false;
    return (ctx.structures.needs(o)[resource] ?? 0) > 0;
  });
  let at: Point = s;
  while (amount < cap && pool.length > 0) {
    let k = 0;
    for (let i = 1; i < pool.length; i++) {
      const d = manhattan(at, pool[i].x, pool[i].y) - manhattan(at, pool[k].x, pool[k].y);
      if (d < 0 || (d === 0 && (pool[i].y < pool[k].y || (pool[i].y === pool[k].y && pool[i].x < pool[k].x)))) k = i;
    }
    const o = pool.splice(k, 1)[0];
    amount = Math.min(cap, amount + (ctx.structures.needs(o)[resource] ?? 0));
    extra.push({ sid: o.id, x: o.x, y: o.y });
    at = o;
  }
  return { amount, extra };
}

/** Tipo de trabajo de un taller: en la cocina se cocina (habilidad Cocina); en los demás, se fabrica. */
export function stationWork(s: Structure): 'fabricar' | 'cocinar' {
  return s.def.id === 'cocina' ? 'cocinar' : 'fabricar';
}

function fabricateCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  if (c.priorities.fabricar === 0 && c.priorities.cocinar === 0) return [];
  const out: Candidate[] = [];
  for (const s of ctx.structures.stations()) {
    const kind = stationWork(s);
    if (c.priorities[kind] === 0) continue;
    const holder = ctx.reservations.holder(s.x, s.y);
    if ((holder !== undefined && holder !== c.id) || !stationWantsWork(ctx, s)) continue;
    out.push({
      kind, x: s.x, y: s.y, dist: manhattan(c.tile, s.x, s.y),
      make: () => {
        const sides = ctx.structures.sidesOf(s);
        if (ctx.structures.needsAny(s)) {
          // Primero, traer los materiales de la tanda.
          const mat = nearestMaterial(ctx, s, c.tile);
          if (!mat) return null;
          const route = pathToNearest(ctx.map, c.tile, [{ x: mat.x, y: mat.y }]);
          if (!route || !pathToNearest(ctx.map, { x: mat.x, y: mat.y }, sides)) return null;
          return {
            job: {
              kind, sid: s.id, x: s.x, y: s.y, stand: route.stand, progress: 0, work: 0,
              haul: { resource: mat.resource, amount: mat.amount, from: { x: mat.x, y: mat.y }, to: { x: s.x, y: s.y }, toBlueprint: true, picked: false },
            },
            path: route.path,
          };
        }
        const here = ctx.structures.isBesideStructure(c.tile, s);
        const route = here ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, sides);
        if (!route) return null;
        return { job: { kind, sid: s.id, x: s.x, y: s.y, stand: route.stand, progress: 0, work: s.bill!.recipe.work }, path: route.path };
      },
    });
  }
  return out;
}

/** Banco de investigación libre con un proyecto en marcha: alguien con «Investigar» va a él. */
export function researchBenchReady(ctx: JobContext, s: Structure): boolean {
  return s.built && s.def.id === RESEARCH_BENCH && !s.demolish && !s.upgrade && !s.moveTo && ctx.research.current !== null;
}

function researchCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  if (c.priorities.investigar === 0 || ctx.research.current === null) return [];
  const out: Candidate[] = [];
  for (const s of ctx.structures.stations()) {
    if (!researchBenchReady(ctx, s)) continue;
    const holder = ctx.reservations.holder(s.x, s.y);
    if (holder !== undefined && holder !== c.id) continue;
    out.push({
      kind: 'investigar', x: s.x, y: s.y, dist: manhattan(c.tile, s.x, s.y),
      make: () => {
        const here = ctx.structures.isBesideStructure(c.tile, s);
        const route = here ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, ctx.structures.sidesOf(s));
        if (!route) return null;
        // Investiga un rato seguido y luego vuelve a mirar qué hacer.
        return { job: { kind: 'investigar', sid: s.id, x: s.x, y: s.y, stand: route.stand, progress: 0, work: RESEARCH_CHUNK_HOURS * TICKS_PER_HOUR }, path: route.path };
      },
    });
  }
  return out;
}

/** Generadores con menos de la mitad de combustible: alguien con «Transportar» les lleva más. */
function refuelCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  if (c.priorities.transportar === 0) return [];
  const out: Candidate[] = [];
  for (const s of ctx.structures.all()) {
    const f = depositOf(s.def);
    if (!f || !s.built || s.demolish) continue;
    if ((s.fuel ?? 0) + (s.delivered[f.resource] ?? 0) >= f.capacity / 2) continue;
    out.push({
      kind: 'transportar', x: s.x, y: s.y, dist: manhattan(c.tile, s.x, s.y),
      make: () => {
        const mat = nearestMaterial(ctx, s, c.tile);
        if (!mat) return null;
        const route = pathToNearest(ctx.map, c.tile, [{ x: mat.x, y: mat.y }]);
        if (!route || !pathToNearest(ctx.map, { x: mat.x, y: mat.y }, ctx.structures.sidesOf(s))) return null;
        return {
          job: {
            kind: 'transportar', sid: s.id, x: s.x, y: s.y, stand: route.stand, progress: 0, work: 0,
            haul: { resource: mat.resource, amount: mat.amount, from: { x: mat.x, y: mat.y }, to: { x: s.x, y: s.y }, toBlueprint: true, picked: false },
          },
          path: route.path,
        };
      },
    });
  }
  return out;
}

/**
 * Cadáveres en el suelo con una hoguera encendida: alguien con «Transportar» va a por uno (que no
 * lleve ya otro colono) y lo lleva a la hoguera más cercana a la que se pueda llegar desde él.
 */
function corpseCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  if (c.priorities.transportar === 0 || ctx.corpses.length === 0) return [];
  const fires = ctx.structures.all().filter(isLitBonfire);
  if (fires.length === 0) return [];
  const out: Candidate[] = [];
  for (const body of ctx.corpses) {
    if (ctx.colonists.some((k) => k !== c && k.job?.corpse?.id === body.id)) continue;
    out.push({
      kind: 'transportar', x: body.x, y: body.y, dist: manhattan(c.tile, body.x, body.y),
      make: () => {
        const route = pathToNearest(ctx.map, c.tile, [{ x: body.x, y: body.y }]);
        if (!route) return null;
        const from = { x: body.x, y: body.y };
        const fire = [...fires]
          .sort((a, b) => manhattan(from, a.x, a.y) - manhattan(from, b.x, b.y) || a.id - b.id)
          .find((s) => pathToNearest(ctx.map, from, ctx.structures.sidesOf(s)));
        if (!fire) return null;
        return {
          job: { kind: 'transportar', sid: fire.id, x: body.x, y: body.y, stand: route.stand, progress: 0, work: 0, corpse: { id: body.id } },
          path: route.path,
        };
      },
    });
  }
  return out;
}

/** Trabajo junto a una persona: el médico o el carcelero va hasta ella. */
function pawnJob(ctx: JobContext, c: Colonist, o: Colonist, kind: 'curar' | 'carcelero', work: number, warden?: NonNullable<ColonistJob['warden']>): JobPlan | null {
  const near = Math.max(Math.abs(c.tile.x - o.tile.x), Math.abs(c.tile.y - o.tile.y)) <= 1;
  const route = near ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, [o.tile]);
  if (!route) return null;
  return { job: { kind, x: o.tile.x, y: o.tile.y, pid: o.id, stand: route.stand, progress: 0, work, warden }, path: route.path };
}

const reservedByOther = (ctx: JobContext, c: Colonist, o: Colonist) =>
  ctx.colonists.some((k) => k !== c && k.job?.pid === o.id);

/**
 * Médico: cura las heridas que sangran y da su 💊 a los infectados (colonos y prisioneros).
 * A los saqueadores en el suelo les cierra las heridas donde están, para que no se desangren (#22).
 */
function doctorCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  // Tras el combate, cualquier colono no reclutado atiende antes que nada a los colonos heridos,
  // aunque no sea médico (prioridad médica, pedida por Mikel el 2026-10-19).
  const urgentOn = !c.drafted && ctx.fightOver();
  if (c.priorities.curar === 0) {
    if (!urgentOn) return [];
    return ctx.colonists
      .filter((p) => p !== c && (needsUrgentCare(p) || ctx.wantsCarryToBed(p)) && !reservedByOther(ctx, c, p))
      .map((p) => ({ kind: 'curar' as const, x: p.tile.x, y: p.tile.y, dist: manhattan(c.tile, p.tile.x, p.tile.y), urgent: true, make: () => pawnJob(ctx, c, p, 'curar', 120) }));
  }
  const downedFoe = (k: Colonist) => k.role === 'saqueador' && k.downed && k.carriedBy === undefined && !k.raider?.finish;
  const patients = [...ctx.colonists.filter((k) => k !== c), ...ctx.others.filter((k) => k.role === 'prisionero' || downedFoe(k))];
  const pills = ctx.inventory().medicina > 0;
  return patients
    .filter((p) => (p.wounds.some((w) => w.bleeding) || (pills && p.role !== 'saqueador' && needsDose(p)) || (urgentOn && ctx.wantsCarryToBed(p))) && !reservedByOther(ctx, c, p))
    .map((p) => ({
      kind: 'curar' as const, x: p.tile.x, y: p.tile.y, dist: manhattan(c.tile, p.tile.x, p.tile.y),
      urgent: urgentOn && (needsUrgentCare(p) || ctx.wantsCarryToBed(p)), make: () => pawnJob(ctx, c, p, 'curar', 120),
    }));
}

/** Carcelero: captura a los saqueadores caídos, da de comer a los prisioneros y habla con ellos. */
function wardenCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  if (c.priorities.carcelero === 0) return [];
  const out: Candidate[] = [];
  const inv = ctx.inventory();
  const food = RESOURCES.filter(isFood).reduce((a, r) => a + inv[r], 0);
  // Para capturar hace falta una cama de prisionero libre (#22); sin ella, el caído sigue en el suelo.
  const beds = ctx.prisonBedsFree();
  for (const o of ctx.others) {
    if (o.carriedBy !== undefined || reservedByOther(ctx, c, o)) continue;
    const add = (work: number, warden: NonNullable<ColonistJob['warden']>) =>
      out.push({ kind: 'carcelero', x: o.tile.x, y: o.tile.y, dist: manhattan(c.tile, o.tile.x, o.tile.y), make: () => pawnJob(ctx, c, o, 'carcelero', work, warden) });
    if (o.role === 'saqueador' && o.downed) {
      if (o.raider?.finish) add(FINISH_WORK, 'rematar');
      else if (beds > 0) add(90, 'capturar');
    }
    if (o.role !== 'prisionero' || !o.prisoner || o.prisoner.mode === 'liberar') continue;
    if (food > 0 && (o.needs.food < 0.45 || o.needs.water < 0.45)) add(60, 'alimentar');
    else if (canTalk(ctx.tick, o)) add(150, 'convencer');
  }
  return out;
}

function buildCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  if (c.priorities.construir === 0) return [];
  const out: Candidate[] = [];
  // Tejados: los colonos cubren las habitaciones cerradas, casilla a casilla.
  for (const t of ctx.roofTodo()) {
    const holder = ctx.reservations.holder(t.x, t.y);
    if (holder !== undefined && holder !== c.id) continue;
    out.push({
      kind: 'construir', x: t.x, y: t.y, dist: manhattan(c.tile, t.x, t.y),
      make: () => {
        const route = c.tile.x === t.x && c.tile.y === t.y ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, [t]);
        if (!route) return null;
        return { job: { kind: 'construir', x: t.x, y: t.y, stand: route.stand, progress: 0, work: ROOMS.roofWork, roof: true }, path: route.path };
      },
    });
  }
  for (const s of ctx.structures.toDemolish()) {
    const holder = ctx.reservations.holder(s.x, s.y);
    if (holder !== undefined && holder !== c.id) continue;
    out.push({
      kind: 'construir', x: s.x, y: s.y, dist: manhattan(c.tile, s.x, s.y),
      make: () => {
        const here = ctx.structures.isBesideStructure(c.tile, s);
        const route = here ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, ctx.structures.sidesOf(s));
        if (!route) return null;
        return { job: { kind: 'construir', sid: s.id, x: s.x, y: s.y, stand: route.stand, progress: 0, work: Math.ceil(s.def.work / 2), demolish: true }, path: route.path };
      },
    });
  }
  // Mover muebles: ir a desmontarlo (luego el mismo colono lo lleva y lo monta en el destino).
  for (const s of ctx.structures.toMove()) {
    const holder = ctx.reservations.holder(s.x, s.y);
    if (holder !== undefined && holder !== c.id) continue;
    out.push({
      kind: 'construir', x: s.x, y: s.y, dist: manhattan(c.tile, s.x, s.y),
      make: () => {
        const here = ctx.structures.isBesideStructure(c.tile, s);
        const route = here ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, ctx.structures.sidesOf(s));
        if (!route) return null;
        return { job: { kind: 'construir', sid: s.id, x: s.x, y: s.y, stand: route.stand, progress: 0, work: moveWork(s.def.work), move: 'desmontar' }, path: route.path };
      },
    });
  }
  // Arreglar máquinas averiadas: traer lo que piden (⚙️1) y hacer la obra, como un plano.
  for (const s of ctx.structures.repairs()) {
    const holder = ctx.reservations.holder(s.x, s.y);
    if (holder !== undefined && holder !== c.id) continue;
    out.push({
      kind: 'construir', x: s.x, y: s.y, dist: manhattan(c.tile, s.x, s.y),
      make: () => {
        const sides = ctx.structures.sidesOf(s);
        if (ctx.structures.needsAny(s)) {
          const mat = nearestMaterial(ctx, s, c.tile);
          if (!mat) return null;
          const route = pathToNearest(ctx.map, c.tile, [{ x: mat.x, y: mat.y }]);
          if (!route || !pathToNearest(ctx.map, { x: mat.x, y: mat.y }, sides)) return null;
          return {
            job: {
              kind: 'construir', sid: s.id, x: s.x, y: s.y, stand: route.stand, progress: 0, work: 0, repair: true,
              haul: { resource: mat.resource, amount: mat.amount, from: { x: mat.x, y: mat.y }, to: { x: s.x, y: s.y }, toBlueprint: true, picked: false },
            },
            path: route.path,
          };
        }
        const here = ctx.structures.isBesideStructure(c.tile, s);
        const route = here ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, sides);
        if (!route) return null;
        return { job: { kind: 'construir', sid: s.id, x: s.x, y: s.y, stand: route.stand, progress: s.repair?.progress ?? 0, work: s.repair?.work ?? 1, repair: true }, path: route.path };
      },
    });
  }
  // Electrificar talleres: traer el material de la mejora y hacer la obra, como un plano.
  for (const s of ctx.structures.upgrades()) {
    const holder = ctx.reservations.holder(s.x, s.y);
    if (holder !== undefined && holder !== c.id) continue;
    out.push({
      kind: 'construir', x: s.x, y: s.y, dist: manhattan(c.tile, s.x, s.y),
      make: () => {
        const sides = ctx.structures.sidesOf(s);
        if (ctx.structures.needsAny(s)) {
          const mat = nearestMaterial(ctx, s, c.tile);
          if (!mat) return null;
          const route = pathToNearest(ctx.map, c.tile, [{ x: mat.x, y: mat.y }]);
          if (!route || !pathToNearest(ctx.map, { x: mat.x, y: mat.y }, sides)) return null;
          return {
            job: {
              kind: 'construir', sid: s.id, x: s.x, y: s.y, stand: route.stand, progress: 0, work: 0, upgrade: true,
              haul: { resource: mat.resource, amount: mat.amount, from: { x: mat.x, y: mat.y }, to: { x: s.x, y: s.y }, toBlueprint: true, picked: false },
            },
            path: route.path,
          };
        }
        const here = ctx.structures.isBesideStructure(c.tile, s);
        const route = here ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, sides);
        if (!route) return null;
        const work = s.def.electrify?.work ?? 1;
        return { job: { kind: 'construir', sid: s.id, x: s.x, y: s.y, stand: route.stand, progress: s.upgrade?.progress ?? 0, work, upgrade: true }, path: route.path };
      },
    });
  }
  for (const s of ctx.structures.blueprints()) {
    const holder = ctx.reservations.holder(s.x, s.y);
    if (holder !== undefined && holder !== c.id) continue;
    out.push({
      kind: 'construir', x: s.x, y: s.y, dist: manhattan(c.tile, s.x, s.y),
      make: () => {
        // Hay que poder llegar al lado del plano.
        const sides = ctx.structures.sidesOf(s);
        if (ctx.structures.needsAny(s)) {
          const mat = nearestMaterial(ctx, s, c.tile);
          if (!mat) return null;
          const route = pathToNearest(ctx.map, c.tile, [{ x: mat.x, y: mat.y }]);
          if (!route) return null;
          if (!pathToNearest(ctx.map, { x: mat.x, y: mat.y }, sides)) return null;
          // Coge también lo que piden los planos de alrededor y lo reparte (#20).
          const first = ctx.structures.needs(s)[mat.resource] ?? 0;
          const share = shareBlueprints(ctx, c, s, mat.resource, first, ctx.items.at(mat.x, mat.y)?.amount ?? mat.amount);
          const haul = { resource: mat.resource, amount: share.amount, from: { x: mat.x, y: mat.y }, to: { x: s.x, y: s.y }, toBlueprint: true, picked: false };
          return {
            job: {
              kind: 'construir', sid: s.id, x: s.x, y: s.y, stand: route.stand, progress: 0, work: 0,
              haul: share.extra.length ? { ...haul, extra: share.extra } : haul,
            },
            path: route.path,
          };
        }
        const here = ctx.structures.isBesideStructure(c.tile, s);
        const route = here ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, sides);
        if (!route) return null;
        return { job: { kind: 'construir', sid: s.id, x: s.x, y: s.y, stand: route.stand, progress: s.progress, work: buildWork(s) }, path: route.path };
      },
    });
  }
  return out;
}

/** Cazar los animales marcados (🎯): quien tenga «Cazar». */
function huntCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  if (c.priorities.cazar === 0) return [];
  const out: Candidate[] = [];
  for (const a of ctx.others) {
    if ((!a.huntMarked && !(a.tameMarked && !a.tamed)) || a.downed) continue;
    if (ctx.colonists.some((k) => k !== c && k.job?.kind === 'cazar' && k.job.pid === a.id)) continue;
    const tame = !a.huntMarked;
    out.push({
      kind: 'cazar', x: a.tile.x, y: a.tile.y, dist: manhattan(c.tile, a.tile.x, a.tile.y),
      make: () => {
        const route = pathToNearest(ctx.map, c.tile, [a.tile, ...sideTiles(ctx.map, a.tile.x, a.tile.y)]);
        if (!route) return null;
        return { job: { kind: 'cazar', pid: a.id, x: a.tile.x, y: a.tile.y, stand: route.stand, progress: 0, work: tame ? TAMING.workPerTry : 1, ...(tame ? { tame: true } : {}) }, path: [] };
      },
    });
  }
  return out;
}

/** Apagar el fuego que amenaza la colonia: lo urgente, para cualquier colono. */
function fireCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  const out: Candidate[] = [];
  for (const f of ctx.fireThreats()) {
    const h = ctx.reservations.holder(f.x, f.y);
    if (h !== undefined && h !== c.id) continue;
    out.push({
      kind: 'construir', x: f.x, y: f.y, dist: manhattan(c.tile, f.x, f.y), urgent: true,
      make: () => {
        const here = isBeside(c.tile, f.x, f.y) || (c.tile.x === f.x && c.tile.y === f.y);
        const route = here ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, sideTiles(ctx.map, f.x, f.y));
        if (!route) return null;
        return { job: { kind: 'construir', x: f.x, y: f.y, stand: route.stand, progress: 0, work: FIRE.extinguishWork, fire: true }, path: route.path };
      },
    });
  }
  return out;
}

/** Trabajo de arrancar una planta enferma (plaga). */
const UPROOT_WORK = eventDef('plaga')?.uprootWork ?? 60;

function farmCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  if (c.priorities.cultivar === 0) return [];
  const out: Candidate[] = [];
  const free = (x: number, y: number) => {
    const h = ctx.reservations.holder(x, y);
    return h === undefined || h === c.id;
  };
  const plan = (x: number, y: number, farm: 'sembrar' | 'cosechar' | 'arrancar', work: number): JobPlan | null => {
    const route = c.tile.x === x && c.tile.y === y ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, [{ x, y }]);
    if (!route) return null;
    return { job: { kind: 'cultivar', x, y, stand: route.stand, progress: 0, work, farm }, path: route.path };
  };
  // Arrancar las plantas enfermas (plaga) y cosechar lo maduro.
  for (const { x, y, plant } of ctx.farms.plantList()) {
    if (plant.sick && free(x, y)) {
      out.push({ kind: 'cultivar', x, y, dist: manhattan(c.tile, x, y) - 20, make: () => plan(x, y, 'arrancar', UPROOT_WORK) });
      continue;
    }
    if (plant.growth < 1 || !free(x, y)) continue;
    out.push({ kind: 'cultivar', x, y, dist: manhattan(c.tile, x, y), make: () => plan(x, y, 'cosechar', plant.crop.harvestWork) });
  }
  // Sembrar las casillas vacías de los huertos.
  for (const z of ctx.farms.all()) {
    for (const i of z.tiles) {
      const x = i % ctx.map.width;
      const y = Math.floor(i / ctx.map.width);
      if (ctx.farms.plantAt(x, y) || !free(x, y) || !ctx.farms.canSow(x, y, z.crop) || ctx.structures.at(x, y)) continue;
      out.push({ kind: 'cultivar', x, y, dist: manhattan(c.tile, x, y), make: () => plan(x, y, 'sembrar', z.crop.sowWork) });
    }
  }
  return out;
}

function terrainCandidates(ctx: JobContext, c: Colonist): Candidate[] {
  if (c.priorities.terreno === 0) return [];
  const out: Candidate[] = [];
  for (const o of ctx.terrain.list()) {
    const h = ctx.reservations.holder(o.x, o.y);
    if (h !== undefined && h !== c.id) continue;
    out.push({
      kind: 'terreno', x: o.x, y: o.y, dist: manhattan(c.tile, o.x, o.y),
      make: () => {
        if (terrainBlocker(ctx.map, o.x, o.y, o.job, !!ctx.structures.at(o.x, o.y))) return null;
        const here = canWorkFrom(ctx.map, c.tile, o.x, o.y);
        const route = here ? { stand: { ...c.tile }, path: [] } : pathToNearest(ctx.map, c.tile, standTiles(ctx.map, o.x, o.y));
        if (!route) return null;
        return { job: { kind: 'terreno', x: o.x, y: o.y, stand: route.stand, progress: 0, work: TERRAIN_WORK[o.job], terrain: o.job }, path: route.path };
      },
    });
  }
  return out;
}

/**
 * Busca el siguiente trabajo para un colono: primero los de mejor prioridad (1 antes que 4;
 * 0 = no lo hace) y dentro de ella los más cercanos a los que puede llegar andando.
 * No reserva nada: lo hace quien acepta el plan.
 */
export function findJob(ctx: JobContext, c: Colonist): JobPlan | null {
  const all = [
    ...fireCandidates(ctx, c), ...doctorCandidates(ctx, c), ...wardenCandidates(ctx, c), ...huntCandidates(ctx, c),
    ...buildCandidates(ctx, c), ...farmCandidates(ctx, c), ...fabricateCandidates(ctx, c), ...researchCandidates(ctx, c), ...terrainCandidates(ctx, c),
    ...harvestCandidates(ctx, c), ...refuelCandidates(ctx, c), ...corpseCandidates(ctx, c), ...haulCandidates(ctx, c),
  ];
  const byPriority = new Map<number, Candidate[]>();
  for (const cand of all) {
    // Lo urgente (prioridad 0) va antes que la prioridad 1.
    const p = cand.urgent ? 0 : c.priorities[cand.kind];
    const list = byPriority.get(p) ?? [];
    list.push(cand);
    byPriority.set(p, list);
  }
  for (const p of [...byPriority.keys()].sort((a, b) => a - b)) {
    // Orden estable: distancia, tipo de trabajo y posición, para que sea determinista.
    const list = byPriority.get(p)!.sort(
      (a, b) => a.dist - b.dist || WORK_TYPES.indexOf(a.kind) - WORK_TYPES.indexOf(b.kind) || a.y - b.y || a.x - b.x,
    );
    for (const cand of list.slice(0, CANDIDATES_PER_SEARCH)) {
      const plan = cand.make();
      if (plan) return plan;
    }
  }
  return null;
}

/**
 * Trabajo concreto en una casilla para un colono (orden directa: «haz esto ahora»).
 * Ignora las prioridades (salvo que no se pueda) y lo que ya tenga reservado otro.
 */
export function findJobAt(ctx: JobContext, c: Colonist, x: number, y: number): JobPlan | null {
  // Para una orden directa vale cualquier tipo de trabajo, aunque tenga la prioridad a 0.
  const forced: Colonist = { ...c, priorities: Object.fromEntries(WORK_TYPES.map((w) => [w, 1])) as Colonist['priorities'] };
  const all = [
    ...doctorCandidates(ctx, forced), ...wardenCandidates(ctx, forced),
    ...buildCandidates(ctx, forced), ...farmCandidates(ctx, forced), ...fabricateCandidates(ctx, forced),
    ...terrainCandidates(ctx, forced), ...harvestCandidates(ctx, forced),
  ].filter((k) => k.x === x && k.y === y);
  for (const cand of all) {
    const plan = cand.make();
    if (plan) return plan;
  }
  return null;
}

/** Reserva lo que necesita un plan de trabajo. false (y nada reservado) si algo ya estaba cogido. */
export function reservePlan(r: Reservations, c: Colonist, job: ColonistJob): boolean {
  const fail = () => {
    r.releaseAll(c.id);
    return false;
  };
  // Los trabajos con personas no reservan casilla (la persona se puede mover): se evita repetir por id.
  if (job.pid !== undefined) return true;
  if (job.kind !== 'transportar' && !r.reserve(job.x, job.y, c.id, 'work')) return fail();
  const h = job.haul;
  if (h) {
    if (!h.picked && !r.reserve(h.from.x, h.from.y, c.id, 'pickup')) return fail();
    if (!h.toBlueprint && !r.reserve(h.to.x, h.to.y, c.id, 'drop')) return fail();
    // Los otros planos del reparto, para que nadie más les lleve lo mismo.
    for (const e of h.extra ?? []) if (!r.reserve(e.x, e.y, c.id, 'work')) return fail();
  }
  return true;
}

/** Nombre del objeto sobre el que se trabaja, para la interfaz. */
export function jobTargetName(map: GameMap, job: ColonistJob): string {
  return PROP_INFO[map.props[index(map, job.x, job.y)] as Prop].name;
}
