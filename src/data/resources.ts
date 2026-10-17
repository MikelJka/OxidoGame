/** Recursos de la colonia y trabajos para obtenerlos del mapa. Ampliar aquí, no en la lógica. */
import type { Skill } from './colonists';

export const RESOURCES = ['madera', 'piedra', 'chatarra', 'componentes'] as const;

export type ResourceId = (typeof RESOURCES)[number];

export const RESOURCE_NAMES: Record<ResourceId, string> = {
  madera: 'Madera',
  piedra: 'Piedra',
  chatarra: 'Chatarra',
  componentes: 'Componentes',
};

/** Icono corto para la interfaz. */
export const RESOURCE_ICONS: Record<ResourceId, string> = {
  madera: '🪵',
  piedra: '🪨',
  chatarra: '🔩',
  componentes: '⚙️',
};

/** Tipo de trabajo con el que se aprovecha un objeto del mapa. */
export type HarvestJob = 'talar' | 'minar' | 'saquear';

export const HARVEST_JOBS: readonly HarvestJob[] = ['talar', 'minar', 'saquear'];

/** Habilidad que acelera cada trabajo. */
export const HARVEST_JOB_SKILL: Record<HarvestJob, Skill> = {
  talar: 'cultivo',
  minar: 'mineria',
  saquear: 'construccion',
};

/** Texto de la actividad de un colono mientras hace el trabajo. */
export const HARVEST_JOB_VERBS: Record<HarvestJob, string> = {
  talar: 'Talando',
  minar: 'Picando',
  saquear: 'Saqueando',
};

export const HARVEST_JOB_NAMES: Record<HarvestJob, string> = {
  talar: 'Talar',
  minar: 'Picar',
  saquear: 'Saquear',
};

/** Rango [mínimo, máximo] de unidades, ambos incluidos. */
export type AmountRange = readonly [number, number];

/** Máximo de unidades de un recurso en un montón (una casilla del suelo). */
export const MAX_STACK: Record<ResourceId, number> = {
  madera: 75,
  piedra: 50,
  chatarra: 75,
  componentes: 25,
};

/** Provisiones con las que llega la colonia: se dejan en el suelo junto al punto de inicio. */
export const STARTING_SUPPLIES: Partial<Record<ResourceId, number>> = {
  madera: 60,
  piedra: 30,
  chatarra: 20,
  componentes: 5,
};
