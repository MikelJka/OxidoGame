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
  ballesta: 28,
  lanza_metal: 22,
  pistola: 32,
  escopeta: 42,
  rifle: 50,
  subfusil: 46,
  francotirador: 64,
  balas: 1.2,
  granadas: 9,
  chaleco_cuero: 14,
  chaleco_chapa: 26,
  chaleco_metal: 45,
  chaleco_tactico: 75,
  casco_chapa: 13,
  casco_metal: 20,
  casco_tactico: 38,
  medicina: 20,
  combustible: 6,
  hierba: 3,
  pescado: 2,
  abrigo: 18,
};

/** Valor de una persona en venta (un esclavo) según sus habilidades. */
export function personValue(skillSum: number): number {
  return Math.round(120 + skillSum * 6);
}
