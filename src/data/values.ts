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
  comida: 5,
  palo: 5,
  cuchillo: 12,
  tuberia: 16,
  lanza: 14,
  machete: 28,
  arco: 22,
  flechas: 0.6,
  pistola: 32,
  escopeta: 42,
  rifle: 50,
  balas: 1.2,
  chaleco_cuero: 14,
  chaleco_chapa: 26,
  chaleco_metal: 45,
  casco_chapa: 13,
  casco_metal: 20,
  medicina: 20,
  combustible: 6,
  hierba: 3,
};

/** Valor de una persona en venta (un esclavo) según sus habilidades. */
export function personValue(skillSum: number): number {
  return Math.round(120 + skillSum * 6);
}
