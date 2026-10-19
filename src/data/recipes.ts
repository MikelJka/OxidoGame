/** Recetas de los talleres. Los datos están en `recipes.json`; aquí, sus tipos y la validación. */
import raw from './recipes.json';
import { BUILDINGS } from './buildings';
import { RESOURCES, ResourceId } from './resources';

export interface RecipeDef {
  id: string;
  name: string;
  /** Construcción (taller) donde se hace. */
  station: string;
  inputs: Partial<Record<ResourceId, number>>;
  outputs: Partial<Record<ResourceId, number>>;
  /** Ticks de trabajo de un colono normal. */
  work: number;
  description: string;
  /** Investigación que hay que terminar para poder encargarla (id de `research.json`). */
  research?: string;
}

export function validateRecipe(d: unknown): RecipeDef {
  const r = d as RecipeDef;
  const fail = (why: string) => {
    throw new Error(`Receta «${r?.id ?? '?'}» no válida: ${why}`);
  };
  if (!r || !r.id || !r.name) fail('falta id o nombre');
  if (!BUILDINGS.some((b) => b.id === r.station && b.category === 'taller')) fail(`taller desconocido ${r.station}`);
  // Las de extracción (cantera, recicladora) pueden no tener entradas; todas tienen salida.
  if (!r.outputs || Object.keys(r.outputs).length === 0) fail('sin salidas');
  if (!r.inputs) fail('sin entradas');
  for (const part of [r.inputs, r.outputs]) {
    for (const [res, n] of Object.entries(part)) {
      if (!RESOURCES.includes(res as ResourceId)) fail(`recurso desconocido ${res}`);
      if (!Number.isInteger(n) || (n as number) <= 0) fail(`cantidad de ${res}`);
    }
  }
  if (!(r.work > 0)) fail('trabajo');
  if (r.research !== undefined && (typeof r.research !== 'string' || !r.research)) fail('investigación no válida');
  return r;
}

export const RECIPES: readonly RecipeDef[] = (raw as unknown[]).map(validateRecipe);

export function recipeDef(id: string): RecipeDef | undefined {
  return RECIPES.find((r) => r.id === id);
}

export function recipesFor(station: string): RecipeDef[] {
  return RECIPES.filter((r) => r.station === station);
}
