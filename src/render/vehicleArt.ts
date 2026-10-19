// Dibujo de los vehículos (pixel art). Se dibuja según el id del vehículo para que otro motor
// pueda poner su propio modelo a cada id; aquí no hay reglas de juego.

/** Tamaño del dibujo de un vehículo de 2×2 casillas (ancho × alto en píxeles). */
export const VEHICLE_W = 32;
export const VEHICLE_H = 26;

function painter(ctx: CanvasRenderingContext2D) {
  return (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
}

/**
 * Pinta un vehículo de perfil-cenital (mirando a la derecha) en un lienzo de `w` × `h`.
 */
export function paintVehicle(ctx: CanvasRenderingContext2D, id: string, w = VEHICLE_W, h = VEHICLE_H): void {
  const px = painter(ctx);
  ctx.clearRect(0, 0, w, h);
  // Escala el dibujo base (32 × 26) al lienzo.
  ctx.save();
  ctx.scale(w / VEHICLE_W, h / VEHICLE_H);
  if (id === 'buggy') {
    // Sombra.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(3, 21, 26, 4);
    // Ruedas.
    for (const x of [3, 21]) {
      px(x, 15, 8, 8, '#1a1410');
      px(x + 1, 16, 6, 6, '#2e2a26');
      px(x + 3, 18, 2, 2, '#8a8780');
    }
    // Chasis y blindaje de chapa.
    px(2, 9, 28, 9, '#1a1410');
    px(3, 10, 26, 7, '#7a6a4a');
    px(3, 10, 26, 2, '#9a8a62');
    for (let x = 6; x < 28; x += 6) px(x, 13, 1, 1, '#4a4032'); // remaches
    px(26, 12, 3, 3, '#d8c27a'); // faro
    // Jaula antivuelco.
    px(9, 2, 2, 8, '#5c5a56');
    px(19, 2, 2, 8, '#5c5a56');
    px(9, 2, 12, 2, '#5c5a56');
    // Parabrisas.
    px(21, 5, 4, 5, '#1a1410');
    px(22, 6, 2, 3, '#6aa0c0');
    // Ametralladora atrás.
    px(4, 5, 4, 4, '#2a2826');
    px(1, 6, 4, 1, '#2a2826');
  } else {
    px(2, 4, VEHICLE_W - 4, VEHICLE_H - 8, '#7a6a4a');
  }
  ctx.restore();
}
