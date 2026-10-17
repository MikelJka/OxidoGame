/** Definiciones de construcciones. Los datos están en `buildings.json`; aquí, sus tipos y la validación. */
import raw from './buildings.json';
import { RESOURCES, ResourceId } from './resources';

export type BuildingCategory = 'muro' | 'puerta' | 'porton' | 'torre' | 'suelo' | 'defensa' | 'mueble' | 'produccion';

export const BUILDING_CATEGORY_NAMES: Record<BuildingCategory, string> = {
  muro: 'Muros',
  puerta: 'Puertas',
  porton: 'Portones',
  torre: 'Torres de vigía',
  suelo: 'Suelos',
  defensa: 'Defensas',
  mueble: 'Muebles',
  produccion: 'Producción',
};

export interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  /** Materiales que hay que llevar al plano. */
  cost: Partial<Record<ResourceId, number>>;
  /** Ticks de trabajo de un colono normal. */
  work: number;
  /** Resistencia (para los ataques, más adelante). */
  hp: number;
  /** Impide el paso una vez construido. */
  blocks: boolean;
  /** Coste de paso si no bloquea: 1,3 puerta, 0,8 suelo (más rápido), 2 barricada… */
  moveCost?: number;
  /** Altura en «pisos» de muro: 1 muro normal, 2 muro alto, 3 torre. */
  height: number;
  /** Casillas de vista desde lo alto (torres; servirá para ver venir a los enemigos). */
  sight?: number;
  /** Colores del dibujo: cara de arriba, frente y sombra. */
  colors: { top: string; face: string; dark: string };
  /** Estación de trabajo: lo que se fabrica en ella una vez construida (p. ej. el horno funde chatarra). */
  recipe?: Recipe;
}

/** Receta de una estación de trabajo: con `input` (llevado por los colonos) sale `amount` de `output`. */
export interface Recipe {
  name: string;
  /** Texto de la actividad del colono mientras trabaja («Fundiendo»). */
  verb: string;
  input: Partial<Record<ResourceId, number>>;
  output: ResourceId;
  amount: number;
  /** Ticks de trabajo de un colono normal por tanda. */
  work: number;
}

/** Comprueba una definición leída del JSON. Lanza un error con el motivo si no vale. */
export function validateBuilding(d: unknown): BuildingDef {
  const b = d as BuildingDef;
  const fail = (why: string) => {
    throw new Error(`Construcción «${b?.id ?? '?'}» no válida: ${why}`);
  };
  if (!b || typeof b.id !== 'string' || !b.id) fail('falta id');
  if (typeof b.name !== 'string' || !b.name) fail('falta nombre');
  if (!(b.category in BUILDING_CATEGORY_NAMES)) fail(`categoría desconocida ${b.category}`);
  if (!b.cost || Object.keys(b.cost).length === 0) fail('sin coste');
  for (const [r, n] of Object.entries(b.cost)) {
    if (!RESOURCES.includes(r as ResourceId)) fail(`recurso desconocido ${r}`);
    if (!Number.isInteger(n) || (n as number) <= 0) fail(`cantidad de ${r} no válida`);
  }
  if (!(b.work > 0) || !(b.hp > 0)) fail('trabajo o resistencia no válidos');
  if (typeof b.blocks !== 'boolean') fail('falta «blocks»');
  if (b.height === undefined) b.height = 1;
  if (!Number.isInteger(b.height) || b.height < 0 || b.height > 4) fail('altura no válida');
  if (b.moveCost !== undefined && !(b.moveCost >= 0.5 && b.moveCost <= 5)) fail('coste de paso no válido');
  if (b.category === 'torre' && b.blocks) fail('una torre se tiene que poder subir (no bloquea)');
  if (!b.colors?.top || !b.colors.face || !b.colors.dark) fail('faltan colores');
  if (b.recipe) {
    const r = b.recipe;
    if (!b.blocks) fail('una estación de trabajo ocupa su casilla (bloquea)');
    if (!r.name || !r.verb) fail('receta sin nombre');
    if (!r.input || Object.keys(r.input).length === 0) fail('receta sin ingredientes');
    for (const [k, n] of Object.entries(r.input)) {
      if (!RESOURCES.includes(k as ResourceId)) fail(`ingrediente desconocido ${k}`);
      if (!Number.isInteger(n) || (n as number) <= 0) fail(`cantidad de ${k} no válida`);
    }
    if (!RESOURCES.includes(r.output)) fail(`producto desconocido ${r.output}`);
    if (!Number.isInteger(r.amount) || r.amount <= 0) fail('cantidad de producto no válida');
    if (!(r.work > 0)) fail('trabajo de la receta no válido');
  } else if (b.category === 'produccion') fail('una construcción de producción necesita receta');
  return b;
}

export const BUILDINGS: readonly BuildingDef[] = (raw as unknown[]).map(validateBuilding);

const BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));

export function buildingDef(id: string): BuildingDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`Construcción desconocida: ${id}`);
  return d;
}
