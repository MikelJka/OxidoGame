/**
 * Armas. Son también recursos (se fabrican, se guardan en el almacén y se apilan); aquí, lo que
 * hacen en el combate. Los números están en `weapons.json` (aprobados por Mikel el 2026-10-17;
 * la pistola casera y las balas, en el bloque 4 del catálogo, el 2026-10-18).
 * - weapons: daño (× los puños), ritmo (× el tiempo entre golpes), alcance en casillas,
 *   munición que gasta cada disparo y si es de fuego.
 * - ammoCarry / ammoLow: munición que coge un tirador de una vez y por debajo de cuánta vuelve.
 * - raiderAmmo: munición con la que llega un saqueador tirador.
 * - raiderPools: armas de los saqueadores desde cada día (sin arma = puños, `null`).
 */
import data from './weapons.json';
import type { ResourceId } from './resources';

export type WeaponId = 'palo' | 'cuchillo' | 'tuberia' | 'lanza' | 'machete' | 'arco' | 'pistola';
export type AmmoId = 'flechas' | 'balas';
export const AMMO_IDS: readonly AmmoId[] = ['flechas', 'balas'];

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
  /** Arma de fuego (pistola, escopeta, rifle). */
  firearm?: boolean;
  /** Rápido, normal o lento (para la interfaz). */
  speedLabel: 'rápido' | 'normal' | 'lento';
}

const IDS: readonly WeaponId[] = ['palo', 'cuchillo', 'tuberia', 'lanza', 'machete', 'arco', 'pistola'];

function validate(): Record<WeaponId, WeaponDef> {
  const fail = (m: string): never => {
    throw new Error(`weapons.json: ${m}`);
  };
  const out = {} as Record<WeaponId, WeaponDef>;
  for (const d of data.weapons as WeaponDef[]) {
    if (!IDS.includes(d.id) || out[d.id]) fail(`arma desconocida o repetida ${d.id}`);
    if (!(d.damage > 0) || !(d.cooldown > 0) || !Number.isInteger(d.reach) || d.reach < 1) fail(`${d.id}: números no válidos`);
    if (d.ammo !== undefined && !AMMO_IDS.includes(d.ammo)) fail(`${d.id}: munición desconocida ${d.ammo}`);
    if (d.firearm && !d.ammo) fail(`${d.id}: un arma de fuego gasta munición`);
    if (!['rápido', 'normal', 'lento'].includes(d.speedLabel)) fail(`${d.id}: ritmo no válido`);
    out[d.id] = d;
  }
  for (const id of IDS) if (!out[id]) fail(`falta el arma ${id}`);
  let last = -1;
  for (const p of data.raiderPools) {
    if (!(p.fromDay > last) || p.weapons.length === 0) fail('armas de los saqueadores: días en orden y con armas');
    for (const id of p.weapons) if (id !== null && !IDS.includes(id as WeaponId)) fail(`saqueadores: arma desconocida ${id}`);
    last = p.fromDay;
  }
  if (data.raiderPools[0]?.fromDay !== 0) fail('armas de los saqueadores: la primera, desde el día 0');
  if (!(data.ammoCarry > data.ammoLow && data.ammoLow >= 0 && data.raiderAmmo > 0)) fail('munición: números no válidos');
  return out;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = validate();

export const WEAPON_IDS = IDS;

/** Munición que coge un tirador de una vez y por debajo de cuánta vuelve a por más. */
export const AMMO_CARRY: number = data.ammoCarry;
export const AMMO_LOW: number = data.ammoLow;
/** Munición con la que llega un saqueador con arco o pistola. */
export const RAIDER_AMMO: number = data.raiderAmmo;

export function isWeapon(r: string): r is WeaponId {
  return Object.prototype.hasOwnProperty.call(WEAPONS, r);
}

export function isAmmo(r: string): r is AmmoId {
  return (AMMO_IDS as readonly string[]).includes(r);
}

/** Armas y munición: no se comen, no van a las caravanas (por ahora). */
export function isGear(r: ResourceId): boolean {
  return isWeapon(r) || isAmmo(r);
}

/** Munición que gasta el arma que lleva (o null si no gasta). */
export function ammoFor(id: WeaponId | null): AmmoId | null {
  return (id && WEAPONS[id].ammo) || null;
}

/**
 * Lo bueno que es un arma para elegirla sola: daño por tiempo; las de disparo solo valen si hay
 * su munición (si no, se usan como un palo malo).
 */
export function weaponScore(id: WeaponId | null, hasAmmo: boolean): number {
  if (!id) return 1;
  const w = WEAPONS[id];
  if (w.ammo && !hasAmmo) return 0.5;
  return (w.damage / w.cooldown) * (w.reach > 1 ? (w.ammo ? 2.5 : 1.1) : 1);
}

/** Arma de un saqueador según el día del raid (sin arma = puños). */
export function raiderWeaponPool(day: number): (WeaponId | null)[] {
  let pool = data.raiderPools[0].weapons;
  for (const p of data.raiderPools) if (day >= p.fromDay) pool = p.weapons;
  return pool as (WeaponId | null)[];
}
