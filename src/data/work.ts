/** Tipos de trabajo de los colonos: los de aprovechar el mapa y los de la colonia. */
import type { Skill } from './colonists';
import { HARVEST_JOB_NAMES, HARVEST_JOB_SKILL, HARVEST_JOB_VERBS, HarvestJob } from './resources';

export type WorkType = HarvestJob | 'transportar' | 'construir' | 'cultivar';

/** Orden en que se muestran (y desempatan) los trabajos. */
export const WORK_TYPES: readonly WorkType[] = ['construir', 'cultivar', 'talar', 'minar', 'saquear', 'transportar'];

export const WORK_NAMES: Record<WorkType, string> = {
  ...HARVEST_JOB_NAMES,
  transportar: 'Transportar',
  construir: 'Construir',
  cultivar: 'Cultivar',
};

export const WORK_VERBS: Record<WorkType, string> = {
  ...HARVEST_JOB_VERBS,
  transportar: 'Transportando',
  construir: 'Construyendo',
  cultivar: 'Cultivando',
};

/** Habilidad que acelera cada trabajo (transportar no depende de ninguna). */
export const WORK_SKILL: Partial<Record<WorkType, Skill>> = {
  ...HARVEST_JOB_SKILL,
  construir: 'construccion',
  cultivar: 'cultivo',
};
