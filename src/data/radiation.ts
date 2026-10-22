/**
 * Barriles tóxicos y ☢ uranio (propuesta B de Mikel, 2026-10-22). Los números están en `radiation.json`:
 * - toxicBarrel.uranium: ☢ que sale al saquear un barril [mínimo, máximo]; toxicBarrel.work: trabajo de saquearlo.
 * - leak: la casilla queda irradiada `days` días (y `radius` casillas alrededor) con radiación `level`.
 */
import data from './radiation.json';

export const TOXIC_BARREL = {
  uranium: [data.toxicBarrel.uranium[0], data.toxicBarrel.uranium[1]] as const,
  work: data.toxicBarrel.work,
};

export const RADIATION_LEAK: Readonly<typeof data.leak> = data.leak;
