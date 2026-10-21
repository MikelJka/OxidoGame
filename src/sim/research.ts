// Investigación (fase 5, bloque 3 del catálogo): se elige un proyecto y avanza mientras un
// colono con el trabajo «Investigar» está en un banco de investigación. Determinista: sin azar.
import { RESEARCH, RESEARCH_REFERENCE_SKILL, ResearchDef, researchDef, Researchable, researchNeeds } from '../data/research';

export type { Researchable };
import { TICKS_PER_HOUR } from './time';

export interface ResearchState {
  /** Proyecto en marcha (o null si no se investiga nada). */
  current: string | null;
  /** Trabajo hecho en cada proyecto empezado (se guarda aunque se cambie de proyecto). */
  progress: Record<string, number>;
  /** Proyectos terminados, en el orden en que se terminaron. */
  done: string[];
}

export function newResearch(): ResearchState {
  return { current: null, progress: {}, done: [] };
}

/** Velocidad de un colono con Investigación `ref` (la misma fórmula que `workSpeed`, sin necesidades). */
const REFERENCE_SPEED = 0.6 + RESEARCH_REFERENCE_SKILL * 0.05;

/** Trabajo total de un proyecto: sus horas para un colono con la Investigación de referencia. */
export function researchCost(p: ResearchDef): number {
  return p.hours * TICKS_PER_HOUR * REFERENCE_SPEED;
}

export function isResearched(r: ResearchState, id: string): boolean {
  return r.done.includes(id);
}

/** Por cuánto se multiplica lo que guarda cada batería con lo investigado («Baterías mejoradas»: ×2). */
export function batteryMultiplier(r: ResearchState): number {
  let m = 1;
  for (const id of r.done) m *= researchDef(id)?.batteryMultiplier ?? 1;
  return m;
}

/** Por cuánto se multiplica el tiempo que tardan en cerrarse las heridas («Medicina avanzada»: ×0,75). */
export function woundHealTimeFactor(r: ResearchState): number {
  let m = 1;
  for (const id of r.done) m *= researchDef(id)?.woundHealTime ?? 1;
  return m;
}

/** Por cuánto se multiplica la probabilidad de que una herida se infecte («Medicina avanzada»: ×0,5). */
export function infectionChanceFactor(r: ResearchState): number {
  let m = 1;
  for (const id of r.done) m *= researchDef(id)?.infectionChance ?? 1;
  return m;
}

/** Por cuánto se multiplican los ⚙️ que sueltan las máquinas destruidas («Desguace de máquinas»: ×2). */
export function machinePartsMultiplier(r: ResearchState): number {
  let m = 1;
  for (const id of r.done) m *= researchDef(id)?.machineParts ?? 1;
  return m;
}

/** Las zanjas que tocan el agua se inundan (foso con agua): ya está terminado un proyecto que lo hace («Hidráulica»). */
export function trenchesFlood(r: ResearchState): boolean {
  return r.done.some((id) => !!researchDef(id)?.floodsTrenches);
}

/** Ya se puede usar: no pide investigación, o ya está hecha toda la que pide (planos nuevos, recetas…). */
export function unlocked(r: ResearchState, thing: Researchable): boolean {
  return researchNeeds(thing).every((q) => isResearched(r, q));
}

/** La primera investigación que aún le falta (para decir qué hay que investigar), o undefined. */
export function missingResearch(r: ResearchState, thing: Researchable): ResearchDef | undefined {
  const q = researchNeeds(thing).find((id) => !isResearched(r, id));
  return q ? researchDef(q) : undefined;
}

/**
 * Lo que desbloquea un proyecto (para avisar al terminarlo). Con `r`, solo lo que ya no pide nada más
 * (la mina casera pide «Trampas» y «Pólvora»: se avisa al terminar la segunda).
 */
export function unlockedBy<T extends Researchable>(list: readonly T[], id: string, r?: ResearchState): T[] {
  return list.filter((b) => researchNeeds(b).includes(id) && (!r || unlocked(r, b)));
}

/** Se puede empezar: existe, no está hecho y lo que pide antes ya está terminado. */
export function canResearch(r: ResearchState, id: string): boolean {
  const p = researchDef(id);
  return !!p && !isResearched(r, id) && p.requires.every((q) => isResearched(r, q));
}

/** Elige el proyecto en marcha (null para parar). Devuelve false si no se puede. */
export function chooseResearch(r: ResearchState, id: string | null): boolean {
  if (id !== null && !canResearch(r, id)) return false;
  r.current = id;
  return true;
}

/** Fracción hecha de un proyecto (0 a 1). */
export function researchFraction(r: ResearchState, id: string): number {
  if (isResearched(r, id)) return 1;
  const p = researchDef(id);
  return p ? Math.min(1, (r.progress[id] ?? 0) / researchCost(p)) : 0;
}

/**
 * Suma trabajo al proyecto en marcha. Devuelve el proyecto si con esto se termina
 * (queda en `done` y ya no hay proyecto en marcha).
 */
export function addResearch(r: ResearchState, amount: number): ResearchDef | null {
  const p = r.current ? researchDef(r.current) : undefined;
  if (!p || isResearched(r, p.id)) {
    r.current = null;
    return null;
  }
  r.progress[p.id] = (r.progress[p.id] ?? 0) + amount;
  if (r.progress[p.id] < researchCost(p)) return null;
  delete r.progress[p.id];
  r.done.push(p.id);
  r.current = null;
  return p;
}

/** Lee el estado guardado; lo que no se entienda se descarta (partidas antiguas: sin nada investigado). */
export function loadResearch(d: unknown): ResearchState {
  const out = newResearch();
  if (!d || typeof d !== 'object') return out;
  const s = d as Partial<ResearchState>;
  // Se recorre el árbol en orden para que lo terminado respete lo que pide antes.
  const done = Array.isArray(s.done) ? s.done : [];
  for (const p of RESEARCH) if (done.includes(p.id) && p.requires.every((q) => out.done.includes(q))) out.done.push(p.id);
  if (s.progress && typeof s.progress === 'object') {
    for (const [id, v] of Object.entries(s.progress)) {
      if (researchDef(id) && !out.done.includes(id) && typeof v === 'number' && Number.isFinite(v) && v > 0) out.progress[id] = v;
    }
  }
  if (typeof s.current === 'string' && canResearch(out, s.current)) out.current = s.current;
  return out;
}
