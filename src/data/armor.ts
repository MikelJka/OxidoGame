/**
 * Armaduras: un chaleco y un casco. Son también recursos (se fabrican en el banco y se guardan).
 * Números aprobados por Mikel (2026-10-17); los tácticos, del catálogo (bloque 5, aprobado el 2026-10-18),
 * se fabrican tras investigar «Blindaje avanzado».
 */
export type ArmorId = 'chaleco_cuero' | 'chaleco_chapa' | 'chaleco_metal' | 'chaleco_tactico' | 'casco_chapa' | 'casco_metal' | 'casco_tactico';
export type ArmorSlot = 'chaleco' | 'casco';

export interface ArmorDef {
  id: ArmorId;
  slot: ArmorSlot;
  /** Parte del daño que quita (0,15 = −15 %). */
  protection: number;
  /** Multiplica la velocidad al andar (1 = no frena). */
  walk: number;
}

export const ARMORS: Record<ArmorId, ArmorDef> = {
  chaleco_cuero: { id: 'chaleco_cuero', slot: 'chaleco', protection: 0.15, walk: 1 },
  chaleco_chapa: { id: 'chaleco_chapa', slot: 'chaleco', protection: 0.25, walk: 0.95 },
  chaleco_metal: { id: 'chaleco_metal', slot: 'chaleco', protection: 0.35, walk: 0.9 },
  chaleco_tactico: { id: 'chaleco_tactico', slot: 'chaleco', protection: 0.45, walk: 0.95 },
  casco_chapa: { id: 'casco_chapa', slot: 'casco', protection: 0.1, walk: 1 },
  casco_metal: { id: 'casco_metal', slot: 'casco', protection: 0.15, walk: 1 },
  casco_tactico: { id: 'casco_tactico', slot: 'casco', protection: 0.2, walk: 1 },
};

export const ARMOR_IDS = Object.keys(ARMORS) as ArmorId[];

export function isArmor(r: string): r is ArmorId {
  return Object.prototype.hasOwnProperty.call(ARMORS, r);
}

/** Lo que quita del daño todo lo que lleva puesto (se suma). */
export function armorProtection(pieces: (ArmorId | null)[]): number {
  return Math.min(0.9, pieces.reduce((a, p) => a + (p ? ARMORS[p].protection : 0), 0));
}

/** Cuánto le frena al andar lo que lleva puesto. */
export function armorWalk(pieces: (ArmorId | null)[]): number {
  return pieces.reduce((a, p) => a * (p ? ARMORS[p].walk : 1), 1);
}

/** Chaleco de un saqueador según el día (desde el día 10, de cuero o de chapa). */
export function raiderVestPool(day: number): (ArmorId | null)[] {
  return day < 10 ? [null] : ['chaleco_cuero', 'chaleco_chapa'];
}

