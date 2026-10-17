# Feedback de Mikel

Escribe aquí lo que quieras, o usa el botón 🐞 del juego: abre una incidencia en GitHub con la etiqueta `feedback` y cada sesión la pasa a esta lista.

## Pendiente

- [ ] **Mobiliario de almacén** (2026-10-17): estanterías, armarios y soportes de pared (p. ej. armeros para armas). Fase 3.
- [ ] **Muros altos para perímetros y torres de vigía de varios materiales** (2026-10-17). Fase 3.
- [ ] **Materiales nuevos, como el metal** (2026-10-17): para muros y torres más resistentes. Fase 3.
- [ ] **Defensas: pinchos y zanjas** (2026-10-17). Fase 3.
- [ ] **Aplanar el terreno y subir o bajar su nivel** (#2, 2026-10-17): como trabajo de los colonos. Fase 3.

- [ ] **Los árboles vuelven a crecer** (2026-10-17): con el tiempo, para que la madera no se acabe. Va en la fase 2, tras el sistema de trabajos.
- [ ] **Máquinas que generan recursos: canteras y recicladoras** (2026-10-17): para cuando se acaben la piedra y la chatarra iniciales del mapa. Van en la fase 3 (construcción), en el roadmap.

## Hecho

- [x] **Almacenes con filtros y prioridad** (2026-10-17): ⚒ → 📦 Almacén y arrastrar. Al tocar un almacén se elige su prioridad (baja, normal, alta, crítica) y qué recursos acepta. Los colonos llevan ahí lo suelto y pasan las cosas a los almacenes más importantes.
- [x] **Construcción: muros de varios materiales y puertas** (2026-10-17): 🏗 → muro de madera, piedra o chatarra, puerta de madera o de chapa. Los colonos llevan el material al plano y lo levantan; los muros cortan el paso y las puertas se cruzan algo más despacio.

- [x] **Fases 0 y 1 confirmadas** (2026-10-17): Mikel confirma que todo funciona en la URL pública, en móvil y PC (mapa, cámara, colonos, selección y órdenes de movimiento).

- [x] **Alturas menos caóticas** (2026-10-17): el terreno ya no cambia de altura cada dos casillas. Los niveles salen de la elevación suavizada y las manchas de menos de 40 casillas se funden con su entorno: el doble de zonas llanas amplias para construir (del 11 % al 31 % de la tierra en cuadrados de 7×7) y la mitad de bordes de nivel.
- [x] **Mapas más grandes** (2026-10-17): de 100 × 100 a 140 × 140 casillas (casi el doble de superficie).
- [x] **Vista con algo de 3D** (2026-10-17): relieve elevado con paredes, lo alto tapa lo de detrás, vista inclinada, giro en pasos de 90° (⟲ ⟳, girar dos dedos, Q/E) e inclinación ajustable en 4 pasos, de cenital a casi de lado (botón ∠, deslizar dos dedos arriba/abajo, R/F).
- [x] **Las alturas del mapa no se ven bien** (2026-10-17): el terreno se dibuja elevado; cada nivel sube 12 px y en la cara sur de los desniveles se ve una pared: roca oscura en los acantilados, talud claro y rayado en las pendientes y orillas de tierra junto al agua. Los niveles altos son más claros y dejan sombra al pie. Colonos, objetos, toques y caminos siguen la altura.
- [x] **Al escribir en 🐞 no salían W, A, S, D** (2026-10-17): el juego capturaba esas teclas para la cámara. Ahora no las captura y, mientras escribes, el teclado no mueve la cámara ni cambia la velocidad (espacio, 1, 2, 3).
- [x] **Panel de control del desarrollo en el juego** (2026-10-17): ☰ → «📋 Progreso del desarrollo». Muestra la versión publicada, el % total y de la fase actual, qué se hará a continuación, tus peticiones en cola, la próxima sesión automática, los últimos parches y todas las tareas que faltan por fase. Se genera de `ROADMAP.md`, `PROGRESO.md` y `FEEDBACK.md` en cada publicación.

- [x] **Detección de bugs en ejecución** (2026-10-16): se registran excepciones, promesas fallidas, `console.error` y comprobaciones de la simulación cada 2 s (colonos fuera del mapa, sobre casillas no transitables, con caminos rotos o atascados). Aviso en pantalla y contador rojo en 🐞.
- [x] **Botón para registrar bugs, peticiones o cambios con cola** (2026-10-16): botón 🐞 arriba. Abre en GitHub una incidencia ya rellenada (texto, partida, semilla, pantalla y errores) con etiquetas `feedback` + tipo; también se puede guardar en la cola del navegador y copiarla. Cada sesión automática lee las incidencias abiertas con `feedback`, las procesa por orden y las cierra.
- [x] **Control del uso de la suscripción y reservar 25 % semanal para STONKS** (2026-10-16): respondido en el chat. No hay forma de leer el % de uso de Claude desde el juego ni desde una sesión; se controla con la frecuencia de las sesiones programadas (ahora 4 al día). Falta que Mikel decida la frecuencia mirando Ajustes → Uso.
