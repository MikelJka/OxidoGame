/** Tejados y habitaciones. Los datos están en `rooms.json`. */
import raw from './rooms.json';

interface MoodRule {
  atLeast?: number;
  below?: number;
  value: number;
  text: string;
}

export interface RoomRules {
  /** Ticks de trabajo de poner el tejado en una casilla. */
  roofWork: number;
  /** Puntos de belleza por casilla: con suelo, con mueble, con luz y con cosas tiradas; `scale` los pasa a 0–1. */
  beauty: { floor: number; furniture: number; light: number; clutter: number; scale: number };
  /** Lo que resta a la limpieza (0–1) la parte de casillas sin suelo y la de cosas tiradas. */
  cleanliness: { noFloor: number; clutter: number };
  mood: { beautiful: MoodRule; ugly: MoodRule; dirty: MoodRule; clean: MoodRule; quality: { min: number; max: number } };
  /** Tamaño: con menos de `small` casillas, menos belleza; con `big` o más, más. */
  size: { small: number; smallPoints: number; big: number; bigPoints: number };
  /** Ratos libres: sin ninguno en `days` días, `mood`; cuentan a `radius` casillas de una mesa de juego u hoguera; buscan uno pasadas `dueHours` horas. */
  leisure: { days: number; mood: number; text: string; radius: number; dueHours: number; funText: string };
}

export const ROOMS: RoomRules = raw as RoomRules;
