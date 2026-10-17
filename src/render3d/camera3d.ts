// Cámara orbital de la vista 3D, sin Three.js: posición a partir de un punto mirado, un giro
// (yaw), una inclinación (pitch) y una distancia. Pura: se puede probar.

export interface OrbitState {
  /** Punto del suelo que se mira (en casillas: x hacia el este, z hacia el sur). */
  tx: number;
  tz: number;
  /** Giro alrededor del eje vertical, en radianes. 0 = mirando al norte (la cámara al sur). */
  yaw: number;
  /** Inclinación sobre el horizonte, en radianes (pequeña = casi de lado, grande = desde arriba). */
  pitch: number;
  /** Distancia al punto mirado, en casillas. */
  dist: number;
}

export const MIN_PITCH = (12 * Math.PI) / 180;
export const MAX_PITCH = (88 * Math.PI) / 180;
export const MIN_DIST = 6;
export const MAX_DIST = 140;

export function clampOrbit(o: OrbitState, mapW: number, mapH: number): OrbitState {
  return {
    tx: Math.max(0, Math.min(mapW, o.tx)),
    tz: Math.max(0, Math.min(mapH, o.tz)),
    yaw: ((o.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
    pitch: Math.max(MIN_PITCH, Math.min(MAX_PITCH, o.pitch)),
    dist: Math.max(MIN_DIST, Math.min(MAX_DIST, o.dist)),
  };
}

/** Posición de la cámara para un estado. `ty` es la altura del punto mirado. */
export function cameraPosition(o: OrbitState, ty = 0): { x: number; y: number; z: number } {
  const h = Math.cos(o.pitch) * o.dist;
  return {
    x: o.tx + Math.sin(o.yaw) * h,
    y: ty + Math.sin(o.pitch) * o.dist,
    z: o.tz + Math.cos(o.yaw) * h,
  };
}

/**
 * Desplaza el punto mirado según un arrastre en pantalla (dx a la derecha, dy hacia abajo, en
 * casillas): lo que estaba bajo el dedo lo sigue, sea cual sea el giro.
 */
export function panOrbit(o: OrbitState, dx: number, dy: number): OrbitState {
  const cos = Math.cos(o.yaw);
  const sin = Math.sin(o.yaw);
  // Derecha en pantalla = (cos, -sin) en el suelo; abajo en pantalla = hacia la cámara (sin, cos).
  // Al inclinar menos, un mismo arrastre vertical recorre más suelo.
  const k = 1 / Math.max(0.35, Math.sin(o.pitch));
  return { ...o, tx: o.tx - dx * cos - dy * sin * k, tz: o.tz + dx * sin - dy * cos * k };
}

/** Punto cardinal que queda arriba de la pantalla para un giro. */
export function northLabel3d(yaw: number): string {
  const names = ['N', 'NO', 'O', 'SO', 'S', 'SE', 'E', 'NE'];
  const k = Math.round(((((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 4))) % 8;
  return names[k];
}
