/**
 * Investigación (bloque 3 del catálogo, aprobado por Mikel el 2026-10-18).
 * Los números están en `research.json`:
 * - bench: id del edificio donde se investiga.
 * - referenceSkill: un colono con esta Investigación tarda `hours` horas en cada proyecto.
 * - chunkHours: horas seguidas que investiga un colono antes de volver a mirar qué hacer.
 * - projects: el árbol; `requires` son los proyectos que tienen que estar terminados antes.
 */
import data from './research.json';
import { BUILDINGS } from './buildings';

export interface ResearchDef {
  id: string;
  name: string;
  hours: number;
  requires: string[];
  /** Qué desbloquea, en palabras (para la interfaz). */
  unlocks: string;
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
    // Lo que pide antes tiene que ir antes en la lista (así no hay ciclos).
    for (const r of p.requires) if (!ids.has(r)) fail(`${p.id} pide ${r}, que no existe o va después`);
    ids.add(p.id);
  }
  // Lo que una construcción pide investigar tiene que existir en el árbol.
  for (const b of BUILDINGS) if (b.research !== undefined && !ids.has(b.research)) fail(`${b.id} pide la investigación ${b.research}, que no existe`);
  return data.projects;
}

export const RESEARCH: readonly ResearchDef[] = validate();
export const RESEARCH_BENCH: string = data.bench;
export const RESEARCH_REFERENCE_SKILL: number = data.referenceSkill;
export const RESEARCH_CHUNK_HOURS: number = data.chunkHours;

export function researchDef(id: string): ResearchDef | undefined {
  return RESEARCH.find((p) => p.id === id);
}
