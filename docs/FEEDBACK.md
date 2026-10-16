# Feedback de Mikel

Escribe aquí lo que quieras, o usa el botón 🐞 del juego: abre una incidencia en GitHub con la etiqueta `feedback` y cada sesión la pasa a esta lista.

## Pendiente

- [ ] **Vista con algo de 3D** (2026-10-16): no completamente cenital; que se vean las alturas y se pueda mover/girar la vista. Plan por partes:
  1. ~~Relieve visible: sombreado según la elevación y caras de acantilado en los desniveles~~ (hecho 2026-10-16).
  2. Proyección inclinada (2.5D): casillas más bajas que anchas, objetos y colonos dibujados de pie y ordenados por profundidad.
  3. Girar la vista en pasos de 90° (botón y gesto) e inclinación ajustable.

## Hecho

- [x] **Detección de bugs en ejecución** (2026-10-16): se registran excepciones, promesas fallidas, `console.error` y comprobaciones de la simulación cada 2 s (colonos fuera del mapa, sobre casillas no transitables, con caminos rotos o atascados). Aviso en pantalla y contador rojo en 🐞.
- [x] **Botón para registrar bugs, peticiones o cambios con cola** (2026-10-16): botón 🐞 arriba. Abre en GitHub una incidencia ya rellenada (texto, partida, semilla, pantalla y errores) con etiquetas `feedback` + tipo; también se puede guardar en la cola del navegador y copiarla. Cada sesión automática lee las incidencias abiertas con `feedback`, las procesa por orden y las cierra.
- [x] **Control del uso de la suscripción y reservar 25 % semanal para STONKS** (2026-10-16): respondido en el chat. No hay forma de leer el % de uso de Claude desde el juego ni desde una sesión; se controla con la frecuencia de las sesiones programadas (ahora 4 al día). Falta que Mikel decida la frecuencia mirando Ajustes → Uso.
