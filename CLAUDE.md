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
- Partidas guardadas (`src/sim/save.ts`): no las rompas. Si añades estado a la simulación, guárdalo en `serializeWorld` y léelo en `loadWorld` con un valor por defecto para partidas antiguas; si un cambio no se puede leer así, sube `SAVE_VERSION` y añade la migración.

## Contenido primero; 3D aparcada (orden de Mikel del 2026-10-18)

- No se trabaja en la vista 3D (`src/render3d/`) salvo para arreglar algo que rompa el juego. Lo nuevo se dibuja solo en 2D.
- El contenido que falta está en `docs/CATALOGO.md`. Un bloque marcado «✅ Aprobado» por Mikel pasa a «Pendiente» de `FEEDBACK.md` (por fases) y se implementa sin volver a preguntar; lo no aprobado, no.
- La simulación debe poder llevarse a otro motor con mejor 3D (Babylon.js, PlayCanvas, Godot…), así que:
  - Todas las reglas van en `src/sim/` (TypeScript puro, sin Phaser, Three.js ni DOM). El dibujado y la interfaz solo leen el estado y llaman a métodos de `World`; nunca deciden reglas.
  - El contenido nuevo (objetos, edificios, recetas, armas, enemigos, investigaciones, sucesos) va en JSON en `src/data/`, con su `id`, sus números y su nombre. Nada de números de juego sueltos en el código de dibujado.
  - El dibujado se basa en ids de contenido (p. ej. `def.id`), no en reglas, para que otro motor pueda poner su modelo a cada id.
  - La partida guardada (`serializeWorld`) es JSON sin nada propio del navegador.

## Móvil y PC

Cada función nueva debe funcionar con ratón y con dedo: arrastrar = mover cámara, pellizcar = zoom, tocar = seleccionar, mantener pulsado = menú de órdenes. Botones de al menos 36 px. Probar mentalmente en una pantalla de 380 px de ancho.

## Cómo trabaja cada sesión automática

1. Lee `docs/FEEDBACK.md`, `docs/PROGRESO.md` y `docs/ROADMAP.md`.
   Procesa la cola del botón 🐞: `gh api "repos/MikelJka/OxidoGame/issues?labels=feedback&state=open&sort=created&direction=asc"` (usa `gh api`, no `gh issue`: GraphQL está bloqueado). Por cada incidencia, añádela a «Pendiente» de `FEEDBACK.md` (con el número `#N`), comenta en ella qué se hará y ciérrala (`gh api -X PATCH repos/MikelJka/OxidoGame/issues/N -f state=closed`). Los bugs van antes que el resto.
2. Elige UNA tarea: primero los bugs, después los puntos de «Pendiente» de `FEEDBACK.md` en su orden. **Mikel aprueba todo lo nuevo** (orden suya del 2026-10-17): solo se implementa lo que está en «Pendiente» de `FEEDBACK.md` (lo ha pedido o aprobado él) y los arreglos de bugs. Nada de funciones, contenidos o reglas nuevas por iniciativa propia, aunque estén en el roadmap. Si lo siguiente no está aprobado, o hay que decidir cómo funciona algo (qué contiene, números, reglas), no lo implementes: si Mikel está en la conversación, pregúntale con opciones; si es una sesión automática, escribe la propuesta con opciones en «## Propuestas para Mikel» de `FEEDBACK.md`, súbela y avísale con una notificación. Si una tarea aprobada es grande, pártela y haz solo la primera parte.
3. Impleméntala con tests cuando toque `src/sim/`.
4. Ejecuta `npm test` y `npm run build`. No subas nada que falle. Si npm no puede descargar paquetes en el entorno, sube primero una rama `sesion/AAAA-MM-DD-tema`: el workflow «Probar rama» la prueba; cuando pase, llévala a `main`.
5. Marca la tarea en `ROADMAP.md` (y el punto de `FEEDBACK.md` como hecho) y añade una entrada al principio de `PROGRESO.md`: fecha, qué se hizo, qué probar, qué sigue.
6. Haz commit y push a `main` con un mensaje en español que diga qué cambia para el jugador.

El panel «📋 Progreso del desarrollo» del juego se genera de `ROADMAP.md`, `PROGRESO.md` y `FEEDBACK.md`: mantén su formato (fases con `## `, tareas con `- [ ]`/`- [x]`, entradas del diario con `## fecha — título` y viñetas). Si cambia el horario de la sesión programada, actualiza `SESSION_HOURS` en `src/ui/devPanel.ts`.

Límites para no gastar la suscripción: una o dos tareas por sesión, como máximo unos 45 minutos de trabajo. Si algo se atasca tras dos intentos, anótalo en `PROGRESO.md` como bloqueo y para.

No pases a la fase siguiente hasta que el criterio de "terminado" de la fase actual se cumpla y esté anotado en `PROGRESO.md`.
