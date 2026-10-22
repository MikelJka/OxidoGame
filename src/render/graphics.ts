// Calidad gráfica (propuesta C, aprobada por Mikel el 2026-10-22): «Gráficos: alta / media / baja» en ☰,
// para que el juego vaya fluido en móviles flojos. Solo cambia el dibujo; las reglas no se tocan.
// - Alta: todo (muebles, talleres, defensas… a doble resolución, mapa de luz y partículas del tiempo).
// - Media: igual, pero el mapa de luz a la mitad de resolución y con la mitad de luces, y la mitad de
//   gotas de lluvia, copos de nieve, polvo y motas.
// - Baja: sin doble resolución (se dibuja a la resolución normal), sin lluvia ni nieve ni polvo de
//   partículas y sin mapa de luz (la noche es una capa oscura con el halo de cada luz encima).
// Es una preferencia de este navegador (no va en la partida guardada).

export type GraphicsQuality = 'alta' | 'media' | 'baja';

export const GRAPHICS_LEVELS: readonly GraphicsQuality[] = ['alta', 'media', 'baja'];

export interface GraphicsSettings {
  /** Muebles, talleres, defensas, electricidad, agua y cantera a doble resolución. */
  hiRes: boolean;
  /** Resolución del mapa de luz respecto a la pantalla; 0 = sin mapa de luz. */
  lightmapRes: number;
  /** Luces que se dibujan como mucho a la vez. */
  maxLights: number;
  /** Cuántas partículas del tiempo (lluvia, nieve, polvo, motas): 1 todas, 0 ninguna. */
  weather: number;
}

const SETTINGS: Record<GraphicsQuality, GraphicsSettings> = {
  alta: { hiRes: true, lightmapRes: 0.25, maxLights: 160, weather: 1 },
  media: { hiRes: true, lightmapRes: 0.125, maxLights: 80, weather: 0.5 },
  baja: { hiRes: false, lightmapRes: 0, maxLights: 40, weather: 0 },
};

const KEY = 'oxido-graficos';

function isQuality(v: unknown): v is GraphicsQuality {
  return v === 'alta' || v === 'media' || v === 'baja';
}

function load(): GraphicsQuality {
  try {
    const v = localStorage.getItem(KEY);
    return isQuality(v) ? v : 'alta';
  } catch {
    return 'alta';
  }
}

let current: GraphicsQuality = load();

export function graphicsQuality(): GraphicsQuality {
  return current;
}

/** Lo que dibuja la calidad elegida. */
export function graphics(): GraphicsSettings {
  return SETTINGS[current];
}

export function setGraphicsQuality(q: GraphicsQuality): void {
  current = q;
  try {
    localStorage.setItem(KEY, q);
  } catch {
    /* sin almacenamiento: vale para esta partida */
  }
}

/** La siguiente en el botón: alta → media → baja → alta. */
export function nextGraphicsQuality(q: GraphicsQuality = current): GraphicsQuality {
  return GRAPHICS_LEVELS[(GRAPHICS_LEVELS.indexOf(q) + 1) % GRAPHICS_LEVELS.length];
}
