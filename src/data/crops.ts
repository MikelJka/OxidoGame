/** Cultivos. Los datos están en `crops.json`; aquí, sus tipos y la validación. */
import raw from './crops.json';
import { RESOURCES, ResourceId } from './resources';

export interface CropDef {
  id: string;
  name: string;
  /** Recurso que se cosecha. */
  resource: ResourceId;
  /** Días de juego que tarda en madurar con fertilidad 1 (de día; de noche no crece salvo `growsInDark`). */
  growDays: number;
  /** Unidades al cosecharlo [mínimo, máximo]. */
  yield: [number, number];
  /** Fertilidad mínima del suelo para sembrarlo. */
  minFertility: number;
  sowWork: number;
  harvestWork: number;
  growsInDark: boolean;
  description: string;
  colors: { leaf: string; dark: string; fruit: string };
  /** Investigación que pide para elegirlo en un huerto (la hierba curativa, «Medicina de campo»). */
  research?: string;
}

export function validateCrop(d: unknown): CropDef {
  const c = d as CropDef;
  const fail = (why: string) => {
    throw new Error(`Cultivo «${c?.id ?? '?'}» no válido: ${why}`);
  };
  if (!c || !c.id || !c.name) fail('falta id o nombre');
  if (!RESOURCES.includes(c.resource)) fail(`recurso desconocido ${c.resource}`);
  if (!(c.growDays > 0)) fail('días de crecimiento');
  if (!Array.isArray(c.yield) || c.yield.length !== 2 || !(c.yield[0] > 0) || c.yield[1] < c.yield[0]) fail('cosecha');
  if (!(c.minFertility >= 0 && c.minFertility <= 1)) fail('fertilidad mínima');
  if (!(c.sowWork > 0) || !(c.harvestWork > 0)) fail('trabajo');
  return c;
}

export const CROPS: readonly CropDef[] = (raw as unknown[]).map(validateCrop);

const BY_ID = new Map(CROPS.map((c) => [c.id, c]));

export function cropDef(id: string): CropDef | undefined {
  return BY_ID.get(id);
}
