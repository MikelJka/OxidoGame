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
}

export function validateVehicle(d: unknown): VehicleDef {
  const v = d as VehicleDef;
  const fail = (why: string) => {
    throw new Error(`Vehículo «${v?.id ?? '?'}» no válido: ${why}`);
  };
  if (!v || !v.id || !v.name) fail('falta id o nombre');
  if (!(v.speed > 0) || !(v.fuelPerHour >= 0) || !(v.fuelCapacity > 0) || !(v.hp > 0)) fail('números');
  if (!(v.armor >= 0 && v.armor < 1) || !(v.runOverDamage >= 0)) fail('armadura o atropello');
  for (const r of Object.keys(v.wreck ?? {})) if (!RESOURCES.includes(r as ResourceId)) fail(`recurso desconocido ${r}`);
  return v;
}

export const VEHICLES: readonly VehicleDef[] = (raw as unknown[]).map(validateVehicle);

export function vehicleDef(id: string): VehicleDef | undefined {
  return VEHICLES.find((v) => v.id === id);
}
