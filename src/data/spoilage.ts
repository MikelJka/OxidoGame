/** Comida que se pone mala: parte de cada montón que se pierde al día (`spoilage.json`). */
import data from './spoilage.json';
import { RESOURCES, ResourceId } from './resources';

export const SPOIL_PER_DAY: Partial<Record<ResourceId, number>> = Object.fromEntries(
  Object.entries(data.perDay).filter(([r, n]) => (RESOURCES as readonly string[]).includes(r) && n > 0 && n < 1),
) as Partial<Record<ResourceId, number>>;
