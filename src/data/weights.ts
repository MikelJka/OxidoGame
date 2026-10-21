/**
 * Peso de cada recurso y lo que se puede llevar en una expedición (elegido por Mikel el
 * 2026-10-21: por peso; cada colono 35 kg, el buggy +300, la balsa +120, la lancha +250 y un
 * animal de carga +80). Los pesos de cada cosa los ha puesto la sesión del 2026-10-21.
 */
import type { ResourceId } from './resources';

/** Kilos por unidad (lo que no está aquí, 1 kg). */
export const WEIGHTS: Partial<Record<ResourceId, number>> = {
  madera: 1, piedra: 2, chatarra: 1, componentes: 0.5, patata: 0.5, maiz: 0.5, setas: 0.3, fibra: 0.3,
  metal: 2, hormigon: 3, comida: 0.5, palo: 1, cuchillo: 0.5, tuberia: 2, lanza: 2, machete: 1, arco: 1,
  ballesta: 3, lanza_metal: 3, flechas: 0.05, pistola: 1.5, escopeta: 3.5, lanzallamas: 6, napalm: 0.2, rifle: 4, subfusil: 3,
  francotirador: 6, balas: 0.05, granadas: 0.5, chaleco_cuero: 3, chaleco_chapa: 6, chaleco_metal: 9,
  chaleco_tactico: 5, casco_chapa: 2, casco_metal: 3, casco_tactico: 1.5, medicina: 0.2, combustible: 1,
  hierba: 0.2, pescado: 0.5, abrigo: 2, carne: 0.5, cuero: 1, abono: 1, leche: 1, huevos: 0.1,
  // Kits: lo que pesa su material, un poco menos (va desmontado y bien atado).
  kit_barricada_madera: 4.8,
  kit_barricada_chatarra: 4.8,
  kit_barricada_metal: 8.0,
  kit_barricada_hormigon: 9.6,
  kit_sacos_arena: 5.3,
  kit_torreta_ligera: 21.6,
  kit_torreta_pesada: 50.4,
  kit_torreta_rotativa: 43.2,
  kit_mortero: 41.6,
  kit_generador_lena: 16.8,
  kit_placa_solar: 13.2,
  kit_molino_viento: 24.8,
  kit_bateria: 8.8,
  kit_lampara: 2.8,
};

/** Lo que lleva un colono a pie. */
export const CARRY_PER_COLONIST = 35;

export function weightOf(r: ResourceId): number {
  return WEIGHTS[r] ?? 1;
}

/** Peso de un montón de recursos. */
export function loadWeight(load: Partial<Record<ResourceId, number>>): number {
  let kg = 0;
  for (const [r, n] of Object.entries(load) as [ResourceId, number][]) kg += weightOf(r) * (n ?? 0);
  return Math.round(kg * 10) / 10;
}
