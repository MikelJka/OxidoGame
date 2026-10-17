/** Recursos de la colonia y trabajos para obtenerlos del mapa. Ampliar aquí, no en la lógica. */
import type { Skill } from './colonists';

export const RESOURCES = ['madera', 'piedra', 'chatarra', 'componentes', 'metal', 'patata', 'maiz', 'setas', 'fibra'] as const;

export type ResourceId = (typeof RESOURCES)[number];

export const RESOURCE_NAMES: Record<ResourceId, string> = {
  madera: 'Madera',
  piedra: 'Piedra',
  chatarra: 'Chatarra',
  componentes: 'Componentes',
  metal: 'Metal',
  patata: 'Patatas',
  maiz: 'Maíz',
  setas: 'Setas',
  fibra: 'Fibra',
};

/** Recursos que se muestran siempre en el inventario (los demás, solo si hay). */
export const BASE_RESOURCES: readonly ResourceId[] = ['madera', 'piedra', 'chatarra', 'componentes'];
/** Comida cruda (las necesidades de la fase 4 la usarán). */
export const FOOD_RESOURCES: readonly ResourceId[] = ['patata', 'maiz', 'setas'];

/** Icono corto para la interfaz. */
export const RESOURCE_ICONS: Record<ResourceId, string> = {
  madera: '🪵',
  piedra: '🪨',
  chatarra: '🔩',
  componentes: '⚙️',
  metal: '⛓️',
  patata: '🥔',
  maiz: '🌽',
  setas: '🍄',
  fibra: '🧵',
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
  metal: 50,
  patata: 75,
  maiz: 75,
  setas: 75,
  fibra: 75,
};

/** Provisiones con las que llega la colonia: se dejan en el suelo junto al punto de inicio. */
export const STARTING_SUPPLIES: Partial<Record<ResourceId, number>> = {
  madera: 60,
  piedra: 30,
  chatarra: 20,
  componentes: 5,
};
