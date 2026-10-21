/** Vehículos (buggy…). Los datos están en `vehicles.json`; aquí, sus tipos y la validación. */
import raw from './vehicles.json';
import { RESOURCES, ResourceId } from './resources';

export interface VehicleDef {
  id: string;
  name: string;
  /** Velocidad respecto a un colono andando. */
  speed: number;
  /** ⛽ que gasta cada hora en marcha. */
  fuelPerHour: number;
  /** ⛽ que caben en el depósito. */
  fuelCapacity: number;
  /** Parte del daño que se ahorran los que van dentro (0,4 = −40 %). */
  armor: number;
  hp: number;
  /** Salud que quita al atropellar a un saqueador (le derriba, no le mata). */
  runOverDamage: number;
  /** Lo que queda si se rompe. */
  wreck: Partial<Record<ResourceId, number>>;
  /**
   * Vida que pierde por cada punto de salud que ahorra a los de dentro: el blindaje se lleva su
   * parte del golpe (con 1000, un golpe que habría quitado un 10 % de salud y del que el blindaje
   * para un 30 % le quita 30).
   */
  damageScale: number;
  /**
   * Barco (update del agua): solo va por el agua (cualquiera, sin puente ni plataforma encima) y
   * se sube y se baja desde la orilla o el agua poco profunda.
   */
  water?: boolean;
  /** El nombre es femenino («la balsa»): para los textos del diario. */
  feminine?: boolean;
  /** Es de los saqueadores (no lo maneja el jugador). */
  hostile?: boolean;
  /** De los saqueadores: día desde el que llega con los raids y probabilidad de que traigan uno. */
  fromDay?: number;
  raidChance?: number;
  /**
   * Balsa de los saqueadores (elegido por Mikel el 2026-10-21): solo llega si la colonia está a
   * `nearRiver` casillas o menos del agua; 1 balsa por cada `raidersPerRaft` saqueadores del raid;
   * al huir, vuelven a ella si la tienen a `reboardRange` casillas o menos.
   */
  raft?: { nearRiver: number; raidersPerRaft: number; reboardRange: number };
  /** Kilos de más que lleva en una expedición (elegido por Mikel el 2026-10-21). */
  cargo?: number;
  /** En una expedición, el viaje dura esto (el buggy: la mitad). */
  travel?: number;
}

export function validateVehicle(d: unknown): VehicleDef {
  const v = d as VehicleDef;
  const fail = (why: string) => {
    throw new Error(`Vehículo «${v?.id ?? '?'}» no válido: ${why}`);
  };
  if (!v || !v.id || !v.name) fail('falta id o nombre');
  if (!(v.speed > 0) || !(v.fuelPerHour >= 0) || !(v.fuelCapacity >= 0) || !(v.hp > 0)) fail('números');
  // Sin depósito solo si no gasta ⛽ (la balsa se rema).
  if (v.fuelCapacity === 0 && v.fuelPerHour > 0) fail('gasta ⛽ y no tiene depósito');
  if (v.water !== undefined && v.water !== true) fail('«water» no válido');
  if (v.feminine !== undefined && v.feminine !== true) fail('«feminine» no válido');
  if (!(v.armor >= 0 && v.armor < 1) || !(v.runOverDamage >= 0)) fail('armadura o atropello');
  if (!(v.damageScale >= 0)) fail('damageScale');
  if (v.hostile && !(v.fromDay! >= 0 && v.raidChance! >= 0 && v.raidChance! <= 1)) fail('día o probabilidad del raid');
  if (v.raft !== undefined && (!v.hostile || !v.water || !(v.raft.nearRiver > 0) || !(v.raft.raidersPerRaft >= 2) || !(v.raft.reboardRange >= 0))) fail('balsa de saqueadores no válida');
  for (const r of Object.keys(v.wreck ?? {})) if (!RESOURCES.includes(r as ResourceId)) fail(`recurso desconocido ${r}`);
  return v;
}

export const VEHICLES: readonly VehicleDef[] = (raw as unknown[]).map(validateVehicle);

/** El buggy con el que llegan los saqueadores (si hay). */
export const RAIDER_VEHICLE: VehicleDef | undefined = VEHICLES.find((v) => v.hostile && !v.water);
/** La balsa con la que llegan algunos saqueadores por el río (si hay). */
export const RAIDER_RAFT: VehicleDef | undefined = VEHICLES.find((v) => v.hostile && v.water && v.raft);

/** Gasta ⛽ (si no, anda siempre: la balsa se rema). */
export function usesFuel(d: VehicleDef): boolean {
  return d.fuelPerHour > 0;
}

export function vehicleDef(id: string): VehicleDef | undefined {
  return VEHICLES.find((v) => v.id === id);
}

/** «el buggy blindado» / «la lancha armada» (con «El»/«La» si `capital`). */
export function theName(d: VehicleDef, capital = false): string {
  const art = d.feminine ? 'la' : 'el';
  return `${capital ? art[0].toUpperCase() + art.slice(1) : art} ${d.name.toLowerCase()}`;
}

/** «del buggy blindado» / «de la balsa», «al buggy blindado» / «a la balsa». */
export function prepName(d: VehicleDef, prep: 'de' | 'a'): string {
  const n = d.name.toLowerCase();
  return d.feminine ? `${prep} la ${n}` : `${prep === 'de' ? 'del' : 'al'} ${n}`;
}
