/** Recursos de la colonia y trabajos para obtenerlos del mapa. Ampliar aquí, no en la lógica. */

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

export const HARVEST_JOB_NAMES: Record<HarvestJob, string> = {
  talar: 'Talar',
  minar: 'Picar',
  saquear: 'Saquear',
};

/** Rango [mínimo, máximo] de unidades, ambos incluidos. */
export type AmountRange = readonly [number, number];
