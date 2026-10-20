// Giro de la vista en pasos de 90°. La simulación siempre usa las coordenadas reales del mapa;
// el dibujado trabaja sobre una copia girada del mapa («mapa de vista») y convierte posiciones
// entre ambos sistemas. Sin Phaser: se puede probar.
import { GameMap } from '../sim/map';

/** Cuartos de vuelta en sentido horario: 0 = norte arriba, 1 = oeste arriba, 2 = sur, 3 = este. */
export type Rotation = 0 | 1 | 2 | 3;

export function normalizeRotation(r: number): Rotation {
  return ((((Math.round(r) % 4) + 4) % 4) as Rotation);
}

/** Ancho y alto del mapa visto con un giro. */
export function viewSize(w: number, h: number, r: Rotation): { width: number; height: number } {
  return r % 2 === 0 ? { width: w, height: h } : { width: h, height: w };
}

/**
 * Posición continua (en casillas, 0..w × 0..h) del mapa real a la vista girada.
 * Sirve para colonos (que están entre casillas) y, sumando 0,5, para centros de casilla.
 */
export function toView(x: number, y: number, w: number, h: number, r: Rotation): { x: number; y: number } {
  switch (r) {
    case 0: return { x, y };
    case 1: return { x: h - y, y: x };
    case 2: return { x: w - x, y: h - y };
    case 3: return { x: y, y: w - x };
  }
}

/** Inversa de `toView`: posición continua de la vista al mapa real. `w`, `h` son del mapa real. */
export function fromView(vx: number, vy: number, w: number, h: number, r: Rotation): { x: number; y: number } {
  switch (r) {
    case 0: return { x: vx, y: vy };
    case 1: return { x: vy, y: h - vx };
    case 2: return { x: w - vx, y: h - vy };
    case 3: return { x: w - vy, y: vx };
  }
}

/** Casilla de la vista que corresponde a una casilla real. */
export function tileToView(tx: number, ty: number, w: number, h: number, r: Rotation): { x: number; y: number } {
  const p = toView(tx + 0.5, ty + 0.5, w, h, r);
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

/** Casilla real que corresponde a una casilla de la vista. */
export function tileFromView(vx: number, vy: number, w: number, h: number, r: Rotation): { x: number; y: number } {
  const p = fromView(vx + 0.5, vy + 0.5, w, h, r);
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

type CellArray = Uint8Array | Float32Array;

function rotateArray<T extends CellArray>(src: T, w: number, h: number, r: Rotation, make: (n: number) => T): T {
  const { width: vw } = viewSize(w, h, r);
  const out = make(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = tileToView(x, y, w, h, r);
      out[v.y * vw + v.x] = src[y * w + x];
    }
  }
  return out;
}

/** Copia del mapa girada para dibujarla. Con giro 0 devuelve el propio mapa. */
export function rotateMap(map: GameMap, r: Rotation): GameMap {
  if (r === 0) return map;
  const { width, height } = viewSize(map.width, map.height, r);
  const u8 = (a: Uint8Array) => rotateArray(a, map.width, map.height, r, (n) => new Uint8Array(n));
  const f32 = (a: Float32Array) => rotateArray(a, map.width, map.height, r, (n) => new Float32Array(n));
  return {
    width,
    height,
    seed: map.seed,
    terrain: u8(map.terrain),
    props: u8(map.props),
    elevation: f32(map.elevation),
    moisture: f32(map.moisture),
    radiation: f32(map.radiation),
    contaminated: u8(map.contaminated),
    level: u8(map.level),
    cliff: u8(map.cliff),
    slope: u8(map.slope),
    stock: u8(map.stock),
    blocked: u8(map.blocked),
    bridge: u8(map.bridge),
    trench: u8(map.trench),
    start: tileToView(map.start.x, map.start.y, map.width, map.height, r),
  };
}

/** Letra del punto cardinal que queda arriba de la pantalla. */
export function northLabel(r: Rotation): string {
  return ['N', 'O', 'S', 'E'][r];
}
