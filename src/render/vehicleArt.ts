// Dibujo de los vehículos (pixel art). Se dibuja según el id del vehículo para que otro motor
// pueda poner su propio modelo a cada id; aquí no hay reglas de juego.

/** Tamaño del dibujo de un vehículo de 2×2 casillas (ancho × alto en píxeles). */
export const VEHICLE_W = 32;
export const VEHICLE_H = 26;

/** Desde dónde se ve el vehículo: de lado, de frente (baja por la pantalla) o de espaldas (sube). */
export type VehicleView = 'side' | 'front' | 'back';

/** Los buggies tienen dibujo propio de frente y de espaldas; los barcos se siguen viendo de lado. */
function paintVehicleEnd(ctx: CanvasRenderingContext2D, id: string, w: number, h: number, view: 'front' | 'back'): void {
  const px = painter(ctx);
  ctx.save();
  ctx.scale(w / VEHICLE_W, h / VEHICLE_H);
  if (id === 'buggy' || id === 'buggy_saqueador') {
    const raider = id === 'buggy_saqueador';
    const body = raider ? '#8a2e1c' : '#7a6a4a';
    const light = raider ? '#b04a2a' : '#9a8a62';
    const dark = raider ? '#5a2214' : '#4a4032';
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(5, 21, 22, 4);
    // Ruedas a los lados (se ven de canto).
    for (const x of [5, 23]) {
      px(x, 13, 5, 10, '#1a1410');
      px(x + 1, 14, 3, 8, '#2e2a26');
      px(x + 1, 16, 3, 1, '#4a4642');
      px(x + 1, 19, 3, 1, '#4a4642');
    }
    // Chasis visto de frente o de espaldas.
    px(9, 10, 14, 10, '#1a1410');
    px(10, 11, 12, 8, body);
    px(10, 11, 12, 2, light);
    px(10, 17, 12, 2, dark);
    // Jaula antivuelco.
    px(10, 2, 2, 9, '#5c5a56');
    px(20, 2, 2, 9, '#5c5a56');
    px(10, 2, 12, 2, '#5c5a56');
    if (view === 'front') {
      // Parabrisas, faros y parachoques (o el ariete de los saqueadores).
      px(12, 5, 8, 5, '#1a1410');
      px(13, 6, 6, 3, '#6aa0c0');
      px(13, 6, 2, 1, '#a8d0e8');
      px(11, 14, 3, 2, '#f0e0a0');
      px(18, 14, 3, 2, '#f0e0a0');
      if (raider) {
        px(9, 18, 14, 2, '#5c5a56');
        for (let x = 9; x < 23; x += 3) px(x, 20, 1, 2, '#9a9890');
        px(15, 12, 2, 2, '#e8e0c8'); // calavera
      } else {
        px(9, 18, 14, 2, '#3a3836');
        px(15, 15, 2, 1, dark);
      }
    } else {
      // Respaldo de los asientos, pilotos rojos, matrícula y lo que lleva detrás.
      px(12, 6, 3, 5, '#2a2826');
      px(17, 6, 3, 5, '#2a2826');
      px(11, 14, 2, 2, '#c02a1a');
      px(19, 14, 2, 2, '#c02a1a');
      px(14, 15, 4, 2, '#d8d0b8');
      if (raider) {
        px(11, 3, 2, 8, '#3a3836'); // escapes
        px(19, 3, 2, 8, '#3a3836');
        px(11, 1, 2, 2, '#6a6864');
        px(15, 0, 1, 9, '#4a3a2a'); // bandera
        px(16, 0, 4, 3, '#1a1410');
        px(16, 1, 3, 1, '#b02a1a');
      } else {
        px(14, 4, 4, 4, '#2a2826'); // ametralladora
        px(15, 1, 2, 4, '#2a2826');
      }
    }
  } else {
    // Barcos y lo demás: de momento, el dibujo de lado.
    ctx.restore();
    paintVehicle(ctx, id, w, h);
    return;
  }
  ctx.restore();
}

function painter(ctx: CanvasRenderingContext2D) {
  return (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
}

/**
 * Pinta un vehículo de perfil-cenital (mirando a la derecha) en un lienzo de `w` × `h`.
 */
export function paintVehicle(ctx: CanvasRenderingContext2D, id: string, w = VEHICLE_W, h = VEHICLE_H, view: VehicleView = 'side'): void {
  const px = painter(ctx);
  ctx.clearRect(0, 0, w, h);
  if (view !== 'side') {
    paintVehicleEnd(ctx, id, w, h, view);
    return;
  }
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
  } else if (id === 'buggy_saqueador') {
    // Buggy de los saqueadores: chatarra oxidada pintada de rojo, ariete de pinchos delante,
    // calavera en el capó, tubos de escape y bandera rota; rueda trasera grande.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(2, 21, 28, 4);
    // Ruedas: la de atrás más grande.
    px(2, 13, 10, 10, '#1a1410');
    px(3, 14, 8, 8, '#2e2a26');
    px(6, 17, 2, 2, '#6e4a2a');
    px(21, 16, 7, 7, '#1a1410');
    px(22, 17, 5, 5, '#2e2a26');
    px(24, 19, 1, 1, '#6e4a2a');
    // Chasis de chapas desiguales.
    px(4, 10, 24, 7, '#1a1410');
    px(5, 11, 22, 5, '#8a2e1c');
    px(5, 11, 22, 1, '#b04a2a');
    px(9, 12, 4, 3, '#6e5a40'); // parche de chapa sin pintar
    px(18, 13, 3, 2, '#5a2214'); // óxido
    // Calavera en el capó.
    px(21, 11, 3, 3, '#e8e0c8');
    px(21, 12, 1, 1, '#1a1410');
    px(23, 12, 1, 1, '#1a1410');
    // Ariete de pinchos delante.
    px(28, 11, 2, 6, '#5c5a56');
    for (const y of [11, 14]) px(30, y, 2, 1, '#9a9890');
    // Tubos de escape y humo.
    px(6, 4, 2, 6, '#3a3836');
    px(9, 6, 2, 4, '#3a3836');
    px(6, 2, 2, 2, '#6a6864');
    // Asiento del tirador con arpón.
    px(13, 6, 5, 4, '#2a2826');
    px(16, 5, 7, 1, '#4a4844');
    px(23, 4, 2, 2, '#9a9890');
    // Bandera rota.
    px(3, 0, 1, 10, '#4a3a2a');
    px(4, 0, 4, 3, '#1a1410');
    px(4, 1, 3, 1, '#b02a1a');
  } else if (id === 'balsa' || id === 'balsa_saqueadores') {
    // Balsa: troncos atados con cuerda, un remo y ondas en el agua alrededor (la de los saqueadores, con un trapo rojo).
    ctx.fillStyle = 'rgba(200,230,240,0.35)';
    ctx.fillRect(0, 20, 32, 2);
    ctx.fillRect(2, 23, 28, 1);
    for (let i = 0; i < 5; i++) {
      const y = 8 + i * 3;
      px(2, y, 28, 3, '#1a1410');
      px(3, y, 26, 2, i % 2 ? '#8a6a3e' : '#9a7a4a');
      px(3, y, 26, 1, '#b08e5a');
      px(2, y + 1, 1, 1, '#5e4630'); // corte del tronco
      px(29, y + 1, 1, 1, '#5e4630');
    }
    // Cuerdas.
    for (const x of [7, 24]) px(x, 8, 2, 15, '#c8b88a');
    // Remo cruzado.
    px(12, 3, 2, 10, '#5e4630');
    px(11, 1, 4, 3, '#7a5a38');
    if (id === 'balsa_saqueadores') {
      px(25, 0, 1, 9, '#4a3a2a');
      px(26, 0, 4, 3, '#1a1410');
      px(26, 1, 3, 1, '#b02a1a');
    }
  } else if (id === 'lancha_armada') {
    // Lancha armada: casco de chapa en punta, motor fuera borda atrás, ametralladora delante y estela.
    ctx.fillStyle = 'rgba(200,230,240,0.4)';
    ctx.fillRect(0, 21, 30, 2);
    ctx.fillRect(0, 12, 3, 1);
    ctx.fillRect(0, 17, 2, 1);
    // Casco (de perfil-cenital, la proa a la derecha).
    px(3, 10, 22, 11, '#1a1410');
    px(25, 12, 3, 7, '#1a1410');
    px(28, 14, 2, 3, '#1a1410');
    px(4, 11, 21, 9, '#5c5e58');
    px(25, 13, 3, 5, '#5c5e58');
    px(4, 11, 24, 1, '#8a8c84');
    px(4, 18, 21, 2, '#3a3c38'); // línea de flotación
    px(9, 14, 3, 2, '#7a4a2a'); // óxido
    px(19, 16, 2, 1, '#7a4a2a');
    // Chapas de blindaje en la borda.
    for (const x of [7, 13, 19]) px(x, 9, 4, 3, '#44463f');
    // Motor fuera borda.
    px(1, 11, 3, 6, '#2a2a26');
    px(0, 12, 1, 4, '#c8a020');
    // Puesto del tirador con ametralladora hacia la proa.
    px(16, 5, 5, 5, '#2a2826');
    px(20, 6, 8, 1, '#1a1410');
    px(27, 5, 2, 3, '#4a4844');
  } else if (id === 'barcaza') {
    // Barcaza de carga: casco ancho de tablas, cajas y sacos encima, mástil con vela remendada.
    ctx.fillStyle = 'rgba(200,230,240,0.35)';
    ctx.fillRect(0, 22, 32, 2);
    px(1, 9, 30, 13, '#1a1410');
    px(2, 10, 28, 11, '#7a5a38');
    for (let y = 11; y < 20; y += 3) px(2, y, 28, 1, '#5e4630');
    px(2, 10, 28, 1, '#a07a4a');
    px(4, 12, 5, 4, '#a07a4a'); // cajas
    px(4, 12, 5, 1, '#c8a070');
    px(10, 13, 4, 3, '#c8b88a'); // sacos
    px(22, 12, 6, 5, '#8a6a3e');
    px(22, 12, 6, 1, '#b08e5a');
    px(17, 0, 1, 14, '#4a3a2a'); // mástil
    px(18, 1, 7, 9, '#d8d0b8'); // vela
    px(20, 4, 2, 2, '#b0a890'); // remiendo
  } else if (id === 'lancha_blindada') {
    // Lancha blindada: casco gris oscuro con planchas remachadas, cabina cerrada y doble motor.
    ctx.fillStyle = 'rgba(200,230,240,0.4)';
    ctx.fillRect(0, 21, 30, 2);
    px(3, 9, 22, 12, '#1a1410');
    px(25, 11, 4, 8, '#1a1410');
    px(4, 10, 21, 10, '#4a4e54');
    px(25, 12, 3, 6, '#4a4e54');
    for (let x = 6; x < 25; x += 4) px(x, 12, 1, 1, '#8a9098'); // remaches
    for (let x = 6; x < 25; x += 4) px(x, 17, 1, 1, '#8a9098');
    px(12, 4, 8, 7, '#1a1410'); // cabina
    px(13, 5, 6, 5, '#2e3236');
    px(14, 6, 4, 1, '#7ad0ff'); // tronera
    px(20, 6, 8, 1, '#1a1410'); // cañón
    px(0, 11, 3, 3, '#2a2a26'); // motores
    px(0, 16, 3, 3, '#2a2a26');
  } else {
    px(2, 4, VEHICLE_W - 4, VEHICLE_H - 8, '#7a6a4a');
  }
  ctx.restore();
}
