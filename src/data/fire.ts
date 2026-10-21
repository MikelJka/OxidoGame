/** Fuego (incendio grande). Los datos están en `fire.json`. */
import raw from './fire.json';
import { RESOURCES, ResourceId } from './resources';

export type FuelKind = 'tree' | 'bush' | 'tires' | 'soil' | 'plant' | 'structure' | 'item';

export interface FireRules {
  /** Probabilidad, cada segundo, de que el fuego de una casilla pase a una de al lado con ese combustible. */
  spread: Record<FuelKind, number>;
  /** Segundos que arde cada combustible. */
  burnSeconds: Record<FuelKind, number>;
  /** Montones que arden. */
  flammableItems: ResourceId[];
  /** Cuánto más se extiende con viento fuerte (×1 + esto × viento). */
  windSpread: number;
  /** Con lluvia, se extiende esto (×0,2). */
  rainSpread: number;
  /** Salud que pierde cada segundo quien está en una casilla que arde. */
  harmPerSecond: number;
  /** Casillas de la colonia (o de algo construido) a las que el fuego ya es una amenaza: los colonos lo apagan. */
  threatRange: number;
  /** Ticks que tarda un colono en apagar una casilla. */
  extinguishWork: number;
  /** Casillas ardiendo a la vez como mucho. */
  maxFires: number;
  /** Días que la tierra quemada tarda en poder volver a arder. */
  noRegrowDays: number;
  /** Cuánto más (o menos) se extiende según la estación. */
  seasonSpread: Record<string, number>;
  /** Hacia donde sopla el viento se extiende ×`downwind`; en contra, ×`upwind`. */
  downwind: number;
  upwind: number;
  /** Montones que explotan al arder. */
  explosiveItems: ResourceId[];
  /** Explosión: radio, daño (×granada) y parte de la vida que quita a muros y puertas. */
  explosion: { radius: number; damage: number; structureDamage: number };
  /** Vida que pierde cada segundo un vehículo encima del fuego. */
  vehicleBurnPerSecond: number;
  /** Suceso: peso, distancia mínima a la colonia y radio del foco. */
  event: { weight: number; minDistance: number; startRadius: number };
}

function validateFire(d: unknown): FireRules {
  const f = d as FireRules;
  const fail = (why: string) => {
    throw new Error(`Fuego no válido: ${why}`);
  };
  if (!f?.spread || !f.burnSeconds) fail('sin propagación o duración');
  for (const r of f.flammableItems ?? []) if (!RESOURCES.includes(r)) fail(`recurso desconocido ${r}`);
  if (!(f.extinguishWork > 0) || !(f.maxFires > 0) || !(f.threatRange > 0)) fail('números');
  return f;
}

export const FIRE: FireRules = validateFire(raw);
