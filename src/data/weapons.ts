/**
 * Armas. Son también recursos (se fabrican, se guardan en el almacén y se apilan); aquí, lo que
 * hacen en el combate. Números aprobados por Mikel (2026-10-17). Las de fuego llegarán con la
 * investigación (fase 5).
 */
import type { ResourceId } from './resources';

export type WeaponId = 'palo' | 'cuchillo' | 'tuberia' | 'lanza' | 'machete' | 'arco';
export type AmmoId = 'flechas';

export interface WeaponDef {
  id: WeaponId;
  /** Multiplica el daño de los puños. */
  damage: number;
  /** Multiplica el tiempo entre golpes (rápido < 1 < lento). */
  cooldown: number;
  /** Casillas de alcance (1 = pegado). */
  reach: number;
  /** Munición que gasta cada disparo. */
  ammo?: AmmoId;
  /** Rápido, normal o lento (para la interfaz). */
  speedLabel: 'rápido' | 'normal' | 'lento';
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  palo: { id: 'palo', damage: 1.4, cooldown: 1, reach: 1, speedLabel: 'normal' },
  cuchillo: { id: 'cuchillo', damage: 1.8, cooldown: 0.75, reach: 1, speedLabel: 'rápido' },
  tuberia: { id: 'tuberia', damage: 2.2, cooldown: 1.35, reach: 1, speedLabel: 'lento' },
  lanza: { id: 'lanza', damage: 2.0, cooldown: 1, reach: 2, speedLabel: 'normal' },
  machete: { id: 'machete', damage: 2.8, cooldown: 1, reach: 1, speedLabel: 'normal' },
  arco: { id: 'arco', damage: 1.6, cooldown: 1.35, reach: 8, ammo: 'flechas', speedLabel: 'lento' },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

/** Flechas que coge un arquero de una vez y por debajo de cuántas vuelve a por más. */
export const AMMO_CARRY = 20;
export const AMMO_LOW = 5;

export function isWeapon(r: string): r is WeaponId {
  return Object.prototype.hasOwnProperty.call(WEAPONS, r);
}

/** Armas y munición: no se comen, no van a las caravanas (por ahora). */
export function isGear(r: ResourceId): boolean {
  return isWeapon(r) || r === 'flechas';
}

/**
 * Lo bueno que es un arma para elegirla sola: daño por tiempo; el arco solo vale si hay flechas
 * (si no, se usa como un palo malo).
 */
export function weaponScore(id: WeaponId | null, hasAmmo: boolean): number {
  if (!id) return 1;
  const w = WEAPONS[id];
  if (w.ammo && !hasAmmo) return 0.5;
  return (w.damage / w.cooldown) * (w.reach > 1 ? (w.ammo ? 2.5 : 1.1) : 1);
}

/** Arma de un saqueador según el día del raid (sin arma = puños). */
export function raiderWeaponPool(day: number): (WeaponId | null)[] {
  if (day < 8) return [null, 'palo', 'palo', 'cuchillo'];
  if (day < 12) return ['palo', 'cuchillo', 'tuberia', 'lanza'];
  return ['cuchillo', 'tuberia', 'lanza', 'arco', 'arco'];
}
