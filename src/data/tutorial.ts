/**
 * Primeros pasos (propuesta D, aprobada por Mikel el 2026-10-22): guía corta y opcional al empezar
 * una partida nueva. Los pasos, sus textos, cuándo cuentan como hechos (`check`) y a qué botón
 * señala la flecha (`target`) están en `tutorial.json`.
 */
import data from './tutorial.json';
import { BuildingCategory } from './buildings';

/** Cuándo cuenta un paso como hecho (basta con que se cumpla una de las condiciones puestas). */
export interface TutorialCheck {
  /** Hay alguna casilla designada con este trabajo (talar, minar o saquear). */
  designation?: string;
  /** Hay alguna zona de almacén. */
  storageZone?: boolean;
  /** Hay algún huerto. */
  growZone?: boolean;
  /** Hay alguna de estas construcciones (en plano o terminada). */
  buildings?: string[];
  /** Hay alguna construcción de esta categoría (en plano o terminada). */
  category?: BuildingCategory;
}

/** A qué señala la flecha: el botón de la barra, la orden o la construcción dentro de su hoja. */
export interface TutorialTarget {
  menu: 'orders' | 'build';
  mode?: string;
  category?: BuildingCategory;
  build?: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  check: TutorialCheck;
  target: TutorialTarget;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = data.steps as TutorialStep[];
