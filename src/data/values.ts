/** Valor de cada recurso para el trueque y la riqueza de la colonia (unidades: «chapas»). */
import type { ResourceId } from './resources';

export const RESOURCE_VALUES: Record<ResourceId, number> = {
  madera: 1,
  piedra: 1,
  chatarra: 2,
  componentes: 12,
  patata: 1.5,
  maiz: 1.5,
  setas: 1.5,
  fibra: 1.5,
  metal: 4,
  hormigon: 2.5,
};

/** Valor de una persona en venta (un esclavo) según sus habilidades. */
export function personValue(skillSum: number): number {
  return Math.round(120 + skillSum * 6);
}
