// Duración del tiempo de juego (aparte para que cualquier módulo la use sin dependencias circulares).
/** Ticks de simulación por segundo real a velocidad x1. */
export const TICKS_PER_SECOND = 30;
/** Un día de juego dura 6 minutos reales a x1. */
export const TICKS_PER_DAY = TICKS_PER_SECOND * 60 * 6;
export const TICKS_PER_HOUR = TICKS_PER_DAY / 24;
