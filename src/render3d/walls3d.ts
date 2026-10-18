// Muros de la vista 3D que se unen con los de al lado (sin Three.js, para poder probarlo).

/** Grosor de un muro en la vista 3D (la casilla mide 1). */
export const WALL_THICK = 0.5;

/** Una caja dentro de la casilla, en coordenadas de 0 a 1 (x hacia el este, z hacia el sur). */
export interface WallBox {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Con qué casillas vecinas se une el muro. */
export interface WallJoins {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}

/**
 * Cajas de un muro según con qué vecinos se une: un tramo de este a oeste y brazos hacia
 * el norte y el sur. Las cajas no se solapan (para que sus caras de arriba no parpadeen).
 * Un muro suelto es un tramo de este a oeste de toda la casilla.
 */
export function wallBoxes(j: WallJoins): WallBox[] {
  const a = (1 - WALL_THICK) / 2;
  const b = 1 - a;
  const alone = !j.n && !j.e && !j.s && !j.w;
  const boxes: WallBox[] = [{ x0: j.w || alone ? 0 : a, x1: j.e || alone ? 1 : b, z0: a, z1: b }];
  if (j.n) boxes.push({ x0: a, x1: b, z0: 0, z1: a });
  if (j.s) boxes.push({ x0: a, x1: b, z0: b, z1: 1 });
  return boxes;
}

/** Caras de una caja ya colocada en el mundo, para juntar muchas en una sola malla. */
export interface QuadSink {
  /** Cuatro esquinas en orden antihorario visto desde fuera, con su normal y sus coordenadas de textura. */
  quad(top: boolean, corners: [number, number, number][], normal: [number, number, number], uvs: [number, number][]): void;
}

/**
 * Añade las caras visibles de una caja (sin la de abajo). Las coordenadas de textura salen de
 * la posición en el mundo, así la textura sigue de una casilla a la siguiente sin cortes.
 */
export function boxQuads(sink: QuadSink, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
  // Arriba (+y).
  sink.quad(true, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[x0, -z1], [x1, -z1], [x1, -z0], [x0, -z0]]);
  const h = y1 - y0;
  // Sur (+z).
  sink.quad(false, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [[x0, 0], [x1, 0], [x1, h], [x0, h]]);
  // Norte (−z).
  sink.quad(false, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [[-x1, 0], [-x0, 0], [-x0, h], [-x1, h]]);
  // Este (+x).
  sink.quad(false, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [[-z1, 0], [-z0, 0], [-z0, h], [-z1, h]]);
  // Oeste (−x).
  sink.quad(false, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [[z0, 0], [z1, 0], [z1, h], [z0, h]]);
}
