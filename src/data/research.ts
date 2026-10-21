/**
 * Investigación (bloque 3 del catálogo, aprobado por Mikel el 2026-10-18).
 * Los números están en `research.json`:
 * - bench: id del edificio donde se investiga.
 * - referenceSkill: un colono con esta Investigación tarda `hours` horas en cada proyecto.
 * - chunkHours: horas seguidas que investiga un colono antes de volver a mirar qué hacer.
 * - projects: el árbol; `requires` son los proyectos que tienen que estar terminados antes.
 *   `batteryMultiplier` (opcional): al terminarlo, lo que guarda cada batería se multiplica por él.
 *   `woundHealTime` (opcional): al terminarlo, el tiempo que tardan en cerrarse las heridas se multiplica por él.
 *   `infectionChance` (opcional): al terminarlo, la probabilidad de que una herida se infecte se multiplica por él.
 *   `machineParts` (opcional): al terminarlo, los ⚙️ que sueltan las máquinas destruidas se multiplican por él.
 *   `floodsTrenches` (opcional): al terminarlo, las zanjas que tocan el agua se inundan (foso con agua).
 */
import data from './research.json';
import { BUILDINGS } from './buildings';
import { RECIPES } from './recipes';
import { CROPS } from './crops';

export interface ResearchDef {
  id: string;
  name: string;
  hours: number;
  requires: string[];
  /** Qué desbloquea, en palabras (para la interfaz). */
  unlocks: string;
  /** Al terminarlo, lo que guarda cada batería se multiplica por esto («Baterías mejoradas»: ×2). */
  batteryMultiplier?: number;
  /** Al terminarlo, el tiempo que tardan en cerrarse las heridas se multiplica por esto («Medicina avanzada»: ×0,75). */
  woundHealTime?: number;
  /** Al terminarlo, la probabilidad de que una herida se infecte se multiplica por esto («Medicina avanzada»: ×0,5). */
  infectionChance?: number;
  /** Al terminarlo, los ⚙️ que sueltan las máquinas destruidas se multiplican por esto («Desguace de máquinas»: ×2). */
  machineParts?: number;
  /** Al terminarlo, las zanjas que tocan el agua se inundan y ya no se cruzan andando («Hidráulica»: foso con agua). */
  floodsTrenches?: boolean;
}

/** Lo que puede pedir investigaciones: una (`research`) y a veces una segunda (`researchAlso`). */
export interface Researchable {
  research?: string;
  researchAlso?: string;
}

/** Todas las investigaciones que pide algo (0, 1 o 2). */
export function researchNeeds(thing: Researchable): string[] {
  return [thing.research, thing.researchAlso].filter((q): q is string => !!q);
}

function validate(): ResearchDef[] {
  const fail = (m: string): never => {
    throw new Error(`research.json: ${m}`);
  };
  if (!BUILDINGS.some((b) => b.id === data.bench && b.category === 'taller')) fail(`banco desconocido ${data.bench}`);
  if (!(data.referenceSkill >= 0 && data.referenceSkill <= 20) || !(data.chunkHours > 0)) fail('números generales no válidos');
  const ids = new Set<string>();
  for (const p of data.projects) {
    if (!p.id || ids.has(p.id)) fail(`id repetido o vacío ${p.id}`);
    if (!p.name || !(p.hours > 0) || typeof p.unlocks !== 'string') fail(`proyecto ${p.id} no válido`);
    const bm = (p as { batteryMultiplier?: number }).batteryMultiplier;
    if (bm !== undefined && !(bm >= 1)) fail(`${p.id}: batteryMultiplier no válido`);
    const mp = (p as { machineParts?: number }).machineParts;
    if (mp !== undefined && !(mp >= 1)) fail(`${p.id}: machineParts no válido`);
    for (const k of ['woundHealTime', 'infectionChance'] as const) {
      const v = (p as { woundHealTime?: number; infectionChance?: number })[k];
      if (v !== undefined && !(v > 0 && v <= 1)) fail(`${p.id}: ${k} no válido`);
    }
    // Lo que pide antes tiene que ir antes en la lista (así no hay ciclos).
    for (const r of p.requires) if (!ids.has(r)) fail(`${p.id} pide ${r}, que no existe o va después`);
    ids.add(p.id);
  }
  // Lo que una construcción pide investigar tiene que existir en el árbol.
  for (const b of [...BUILDINGS, ...RECIPES, ...CROPS]) for (const q of researchNeeds(b)) if (!ids.has(q)) fail(`${b.id} pide la investigación ${q}, que no existe`);
  return data.projects;
}

export const RESEARCH: readonly ResearchDef[] = validate();
export const RESEARCH_BENCH: string = data.bench;
export const RESEARCH_REFERENCE_SKILL: number = data.referenceSkill;
export const RESEARCH_CHUNK_HOURS: number = data.chunkHours;

export function researchDef(id: string): ResearchDef | undefined {
  return RESEARCH.find((p) => p.id === id);
}
