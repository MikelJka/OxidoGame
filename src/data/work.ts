/** Tipos de trabajo de los colonos: los de aprovechar el mapa y los de la colonia. */
import type { Skill } from './colonists';
import { HARVEST_JOB_NAMES, HARVEST_JOB_SKILL, HARVEST_JOB_VERBS, HarvestJob } from './resources';

export type WorkType = HarvestJob | 'transportar' | 'construir' | 'cultivar' | 'cazar' | 'terreno' | 'fabricar' | 'cocinar' | 'investigar' | 'curar' | 'carcelero';

/** Orden en que se muestran (y desempatan) los trabajos. */
export const WORK_TYPES: readonly WorkType[] = ['curar', 'carcelero', 'construir', 'cultivar', 'cazar', 'cocinar', 'fabricar', 'investigar', 'terreno', 'talar', 'minar', 'saquear', 'transportar'];

export const WORK_NAMES: Record<WorkType, string> = {
  ...HARVEST_JOB_NAMES,
  transportar: 'Transportar',
  construir: 'Construir',
  cultivar: 'Cultivar',
  cazar: 'Cazar',
  terreno: 'Obras de terreno',
  fabricar: 'Fabricar',
  cocinar: 'Cocinar',
  investigar: 'Investigar',
  curar: 'Curar',
  carcelero: 'Carcelero',
};

export const WORK_VERBS: Record<WorkType, string> = {
  ...HARVEST_JOB_VERBS,
  transportar: 'Transportando',
  construir: 'Construyendo',
  cultivar: 'Cultivando',
  cazar: 'Cazando',
  terreno: 'Moviendo tierra',
  fabricar: 'Fabricando',
  cocinar: 'Cocinando',
  investigar: 'Investigando',
  curar: 'Curando',
  carcelero: 'Con los prisioneros',
};

/** Habilidad que acelera cada trabajo (transportar no depende de ninguna). */
export const WORK_SKILL: Partial<Record<WorkType, Skill>> = {
  ...HARVEST_JOB_SKILL,
  construir: 'construccion',
  cultivar: 'cultivo',
  cazar: 'combate',
  terreno: 'mineria',
  fabricar: 'construccion',
  cocinar: 'cocina',
  investigar: 'investigacion',
  curar: 'medicina',
  carcelero: 'social',
};

/**
 * Reparto de material (#20): al llevar material a un plano, el colono coge también lo que piden
 * los planos cercanos (a esta distancia en casillas, sin diagonales, del primero) y lo reparte.
 */
export const BLUEPRINT_SHARE_RADIUS = 8;

/** Trabajo (en ticks, como capturar = 90) de rematar a un saqueador en el suelo (#22). */
export const FINISH_WORK = 30;
