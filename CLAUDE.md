# Óxido — instrucciones para Claude

Juego de gestión de colonia postapocalíptica para navegador (estilo RimWorld), pixel art, vista cenital, un jugador. Jugable completo en móvil y PC. El diseño completo está en `docs/DISENO.md`.

Idioma: el código (nombres de variables, funciones, tipos) en inglés; comentarios, textos del juego, commits y documentación en español.

## Tecnología

- TypeScript estricto + Phaser 3 + Vite. Tests con Vitest.
- Publicación automática en GitHub Pages al subir a `main` (`.github/workflows/deploy.yml`). URL: https://mikeljka.github.io/OxidoGame/
- Sin backend. Todo corre en el navegador. Los compradores, facciones y enemigos "con IA" son agentes simulados dentro del juego, nunca llamadas a servicios externos.

## Arquitectura

- `src/sim/` — simulación pura: sin Phaser, sin DOM, determinista con semilla (`Rng`). Todo lo que se pueda probar va aquí y lleva tests.
- `src/render/` — escenas y dibujado con Phaser. Lee el estado de la simulación; no contiene reglas de juego.
- `src/data/` — definiciones en JSON (objetos, edificios, investigaciones) cuando existan.
- `tests/` — tests de Vitest de `src/sim/`.
- Nunca uses `Math.random()` dentro de `src/sim/`: usa `Rng`.

## Móvil y PC

Cada función nueva debe funcionar con ratón y con dedo: arrastrar = mover cámara, pellizcar = zoom, tocar = seleccionar, mantener pulsado = menú de órdenes. Botones de al menos 36 px. Probar mentalmente en una pantalla de 380 px de ancho.

## Cómo trabaja cada sesión automática

1. Lee `docs/FEEDBACK.md`, `docs/PROGRESO.md` y `docs/ROADMAP.md`.
   Procesa la cola del botón 🐞: `gh api "repos/MikelJka/OxidoGame/issues?labels=feedback&state=open&sort=created&direction=asc"` (usa `gh api`, no `gh issue`: GraphQL está bloqueado). Por cada incidencia, añádela a «Pendiente» de `FEEDBACK.md` (con el número `#N`), comenta en ella qué se hará y ciérrala (`gh api -X PATCH repos/MikelJka/OxidoGame/issues/N -f state=closed`). Los bugs van antes que el resto.
2. Elige UNA tarea: primero los puntos pendientes de `FEEDBACK.md` (bugs primero), después la siguiente tarea sin marcar de la fase actual del roadmap. Si una tarea es grande, pártela y haz solo la primera parte.
3. Impleméntala con tests cuando toque `src/sim/`.
4. Ejecuta `npm test` y `npm run build`. No subas nada que falle. Si npm no puede descargar paquetes en el entorno, sube primero una rama `sesion/AAAA-MM-DD-tema`: el workflow «Probar rama» la prueba; cuando pase, llévala a `main`.
5. Marca la tarea en `ROADMAP.md` (y el punto de `FEEDBACK.md` como hecho) y añade una entrada al principio de `PROGRESO.md`: fecha, qué se hizo, qué probar, qué sigue.
6. Haz commit y push a `main` con un mensaje en español que diga qué cambia para el jugador.

El panel «📋 Progreso del desarrollo» del juego se genera de `ROADMAP.md`, `PROGRESO.md` y `FEEDBACK.md`: mantén su formato (fases con `## `, tareas con `- [ ]`/`- [x]`, entradas del diario con `## fecha — título` y viñetas). Si cambia el horario de la sesión programada, actualiza `SESSION_HOURS` en `src/ui/devPanel.ts`.

Límites para no gastar la suscripción: una o dos tareas por sesión, como máximo unos 45 minutos de trabajo. Si algo se atasca tras dos intentos, anótalo en `PROGRESO.md` como bloqueo y para.

No pases a la fase siguiente hasta que el criterio de "terminado" de la fase actual se cumpla y esté anotado en `PROGRESO.md`.
