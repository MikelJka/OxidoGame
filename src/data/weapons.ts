/**
 * Armas. Son también recursos (se fabrican, se guardan en el almacén y se apilan); aquí, lo que
 * hacen en el combate. Los números están en `weapons.json` (aprobados por Mikel el 2026-10-17;
 * la pistola casera, la escopeta, el rifle y las balas, en el bloque 4 del catálogo, el 2026-10-18;
 * el subfusil, el rifle de francotirador, la ballesta y la lanza de metal, en el bloque 13, el 2026-10-19). Ritmos: muy rápido 0,5,
 * rápido 0,75, normal 1, lento 1,35 y muy lento 1,8.
 * - weapons: daño (× los puños), ritmo (× el tiempo entre golpes), alcance en casillas,
 *   munición que gasta cada disparo y si es de fuego. La escopeta pega su daño a `closeRange`
 *   casillas o menos y `farDamage` más lejos.
 * - ammoCarry / ammoLow: munición que coge un tirador de una vez y por debajo de cuánta vuelve.
 * - raiderAmmo: munición con la que llega un saqueador tirador.
 * - grenade: granadas caseras (bloque 13, elegido por Mikel el 2026-10-20, opción B): cuántas lleva
 *   cada colono, alcance, radio de la explosión (1 = el 3×3), daño (× los puños), enemigos que tiene
 *   que haber en el 3×3, segundos entre lanzamientos, ticks que tarda en estallar y parte de la vida
 *   que quita a muros y puertas.
 * - raiderPools: armas de los saqueadores desde cada día (sin arma = puños, `null`).
 */
import data from './weapons.json';
import type { ResourceId } from './resources';

export type WeaponId = 'palo' | 'cuchillo' | 'tuberia' | 'lanza' | 'machete' | 'arco' | 'ballesta' | 'lanza_metal' | 'pistola' | 'escopeta' | 'rifle' | 'subfusil' | 'francotirador' | 'lanzallamas';
export type AmmoId = 'flechas' | 'balas' | 'napalm';
export const AMMO_IDS: readonly AmmoId[] = ['flechas', 'balas', 'napalm'];

export interface WeaponDef {
  id: WeaponId;
  /** Multiplica el daño de los puños. */
  damage: number;
  /** Si existe, `damage` solo se hace a esta distancia o menos; más lejos, `farDamage`. */
  closeRange?: number;
  /** Daño más allá de `closeRange` (la escopeta, ×1,8). */
  farDamage?: number;
  /** Multiplica el tiempo entre golpes (rápido < 1 < lento). */
  cooldown: number;
  /** Casillas de alcance (1 = pegado). */
  reach: number;
  /** Munición que gasta cada disparo. */
  ammo?: AmmoId;
  /** Arma de fuego (pistola, escopeta, rifle). */
  firearm?: boolean;
  /** Prende fuego a la casilla del objetivo (el lanzallamas). */
  ignites?: boolean;
  /** Rápido, normal o lento (para la interfaz). */
  speedLabel: 'muy rápido' | 'rápido' | 'normal' | 'lento' | 'muy lento';
}

const IDS: readonly WeaponId[] = ['palo', 'cuchillo', 'tuberia', 'lanza', 'machete', 'arco', 'ballesta', 'lanza_metal', 'pistola', 'escopeta', 'rifle', 'subfusil', 'francotirador', 'lanzallamas'];

export interface GrenadeDef {
  carry: number;
  reach: number;
  radius: number;
  damage: number;
  minTargets: number;
  cooldownSeconds: number;
  fuseTicks: number;
  structureDamage: number;
  /** Desde qué día traen granadas los saqueadores. */
  raiderFromDay: number;
  /** Probabilidad de que un saqueador (no una criatura) llegue con granadas. */
  raiderChance: number;
  /** Cuántas trae el que llega con ellas. */
  raiderCarry: number;
}

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
    if ((d.closeRange === undefined) !== (d.farDamage === undefined)) fail(`${d.id}: closeRange y farDamage van juntos`);
    if (d.closeRange !== undefined && !(Number.isInteger(d.closeRange) && d.closeRange >= 1 && d.closeRange < d.reach && d.farDamage! > 0)) fail(`${d.id}: daño por distancia no válido`);
    if (!['muy rápido', 'rápido', 'normal', 'lento', 'muy lento'].includes(d.speedLabel)) fail(`${d.id}: ritmo no válido`);
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
  const g = data.grenade as GrenadeDef;
  const int = (n: number, min: number) => Number.isInteger(n) && n >= min;
  if (!int(g.carry, 1) || !int(g.reach, 2) || !int(g.radius, 0) || !(g.damage > 0) || !int(g.minTargets, 1) || !(g.cooldownSeconds > 0) || !int(g.fuseTicks, 1) || !(g.structureDamage >= 0 && g.structureDamage <= 1) || !int(g.raiderFromDay, 0) || !(g.raiderChance >= 0 && g.raiderChance <= 1) || !int(g.raiderCarry, 1) || g.raiderCarry > g.carry) fail('granadas: números no válidos');
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

/** Granadas caseras: cuántas lleva cada colono, alcance, explosión… */
export const GRENADE: GrenadeDef = data.grenade;

export function isAmmo(r: string): r is AmmoId {
  return (AMMO_IDS as readonly string[]).includes(r);
}

/** Armas, munición y granadas: no se comen, no van a las caravanas (por ahora); van al armero. */
export function isGear(r: ResourceId): boolean {
  return isWeapon(r) || isAmmo(r) || r === 'granadas';
}

/** Daño (× los puños) del arma a `dist` casillas: la escopeta pega menos lejos. */
export function damageAt(w: WeaponDef, dist: number): number {
  return w.closeRange !== undefined && dist > w.closeRange ? w.farDamage! : w.damage;
}

/** Munición que gasta el arma que lleva (o null si no gasta). */
export function ammoFor(id: WeaponId | null): AmmoId | null {
  return (id && WEAPONS[id].ammo) || null;
}

/**
 * Lo bueno que es un arma para elegirla sola: daño por tiempo; las de disparo solo valen si hay
 * su munición (si no, se usan como un palo malo), y entre ellas cuenta algo el alcance (el rifle
 * antes que la pistola). La escopeta cuenta con el daño medio entre cerca y lejos.
 */
export function weaponScore(id: WeaponId | null, hasAmmo: boolean): number {
  if (!id) return 1;
  const w = WEAPONS[id];
  if (w.ammo && !hasAmmo) return 0.5;
  const dmg = w.farDamage !== undefined ? (w.damage + w.farDamage) / 2 : w.damage;
  return (dmg / w.cooldown) * (w.reach > 1 ? (w.ammo ? 2.5 * (1 + w.reach / 50) : 1.1) : 1);
}

/** Arma de un saqueador según el día del raid (sin arma = puños). */
export function raiderWeaponPool(day: number): (WeaponId | null)[] {
  let pool = data.raiderPools[0].weapons;
  for (const p of data.raiderPools) if (day >= p.fromDay) pool = p.weapons;
  return pool as (WeaponId | null)[];
}
