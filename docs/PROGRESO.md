# Progreso

Diario de sesiones, la más reciente arriba.

## 2026-10-17 (tarde, 2) — Órdenes: talar, picar y saquear

- Mikel confirma que lo anterior funciona bien.
- Nuevo botón ⚒ (tecla T) bajo los de girar: abre las órdenes 🪓 Talar, ⛏ Picar, 🔩 Saquear y ✖ Quitar. Con una activa, arrastrar (ratón o un dedo) marca un área y tocar marca una casilla; solo se marcan los objetos de ese trabajo (árboles para talar, rocas y muros para picar, chatarra y coches para saquear). Mientras se arrastra se ve el área y en color lo que se marcaría.
- En el modo de órdenes, dos dedos mueven la cámara y hacen zoom a la vez (un dedo queda para marcar). Esc o volver a tocar el modo lo desactiva; elegir un colono también.
- Las casillas marcadas llevan esquinas y un rombo del color del trabajo; cada botón muestra cuántas hay y la información de casilla dice «orden: talar».
- Lógica en `src/sim/designations.ts` con tests: áreas en cualquier sentido, recortadas al mapa, sin duplicar, quitar por área y quitar sola la marca al aprovechar el objeto. Las comprobaciones de 🐞 avisan de marcas sobre casillas sin nada.
- Los colonos todavía no trabajan: eso es la siguiente tarea (sistema de trabajos).
- Qué probar: en el móvil, marcar un bosquecillo arrastrando con un dedo y moverse con dos; en el PC, arrastrar con el ratón; quitar parte con ✖; comprobar que no se marcan cosas de otro trabajo.
- Siguiente: sistema de trabajos (cola, reserva de tareas, prioridades) para que los colonos vayan a talar, picar y saquear lo marcado.

## 2026-10-17 (tarde) — Inventario de la colonia y montones en el suelo

- Los recursos ya existen como objetos en el suelo: montones de madera, piedra, chatarra y componentes, uno por casilla y con un máximo (75 de madera o chatarra, 50 de piedra, 25 de componentes). Al soltar recursos se completan primero los montones del mismo tipo y luego se ocupan casillas libres cercanas a las que se llega andando; nunca en el agua ni encima de un objeto que bloquee (`src/sim/items.ts`, con tests).
- La colonia llega con provisiones junto al punto de inicio: 60 de madera, 30 de piedra, 20 de chatarra y 5 componentes (`STARTING_SUPPLIES` en `src/data/resources.ts`).
- Inventario arriba a la izquierda (🪵 🪨 🔩 ⚙️): suma lo que hay en el suelo. Cuando existan las zonas de almacén se separará lo guardado de lo suelto.
- Los montones se dibujan en pixel art (troncos, bloques, chapas oxidadas y una caja con engranaje), más pequeños cuanto más vacíos, y semitransparentes detrás del relieve. Al tocar una casilla con un montón se ve, p. ej., «Madera ×60».
- Ya está la función que aprovecha un objeto del mapa y suelta lo obtenido al lado (`World.harvest`); la usarán los trabajos de talar, picar y saquear. Las comprobaciones de 🐞 avisan si un montón queda en una casilla que no lo admite.
- Sin npm en el entorno de la sesión: tests pasados con Bun y tipos comprobados con `tsc`; la prueba completa la hace GitHub Actions.
- Qué probar: al empezar, ver los montones junto a los colonos y el inventario arriba a la izquierda (en el móvil, que no tape los botones de girar); tocar un montón; girar e inclinar la vista y comprobar que los montones siguen en su casilla.
- Siguiente: herramienta de designación (talar, picar, saquear arrastrando un área; en móvil, modo selección).

## 2026-10-17 (mediodía) — Terreno más llano y mapas más grandes

- Feedback de Mikel tras probar los recursos: alturas demasiado cambiantes para construir, mapas pequeños, árboles que no vuelven a crecer y máquinas (canteras, recicladoras). Las dos últimas quedan anotadas en `FEEDBACK.md` y en el roadmap (fases 2 y 3).
- Alturas: los niveles se calculan sobre la elevación suavizada y las manchas de un mismo nivel de menos de 40 casillas se funden con el nivel de alrededor (salvo orillas y vados). Resultado en 20 semillas: zonas llanas de 7×7 del 11 % al 31 % de la tierra, bordes de nivel del 30 % al 15 %, sin manchas sueltas. Sigue habiendo mesetas, acantilados y pendientes, pero en tramos largos.
- Mapas de 140 × 140 (antes 100 × 100). Generar uno tarda como mucho medio segundo; el 99 % del terreno transitable se alcanza desde el inicio. Los tests del mapa usan ya ese tamaño.
- Qué probar: generar varios mapas nuevos (☰ → Nuevo mapa) y comprobar que hay llanos grandes; que el móvil va fluido con el mapa más grande, también al girar o inclinar la vista.
- Siguiente: inventario de la colonia y objetos en el suelo; después designaciones y trabajos (talar, picar, saquear) y que los árboles vuelvan a crecer.

## 2026-10-17 (mañana, 3) — Fase 2: recursos en el mapa

- Empieza la fase 2 a petición de Mikel (las fases 0 y 1 siguen a falta de su confirmación en móvil y PC).
- Los objetos del mapa tienen recursos: árboles secos, tocones y matorrales dan madera (talar); rocas grandes, piedras y muros derruidos dan piedra (picar); montones de chatarra, coches, escombros y neumáticos dan chatarra (saquear), y los coches y montones de chatarra pueden dar componentes.
- Cada objeto tiene una cantidad propia (con la semilla) y, al terminar de aprovecharlo, deja otra cosa: un árbol deja un tocón, una roca grande deja piedras y un muro deja escombros. Los que bloqueaban el paso dejan de hacerlo. Definiciones en `PROP_INFO` (`src/sim/map.ts`) y `src/data/resources.ts`; lógica en `src/sim/resources.ts`, con tests (todas las semillas de prueba tienen madera, piedra y chatarra al alcance; la chatarra es la más escasa).
- La información de casilla muestra cuánto queda (p. ej. «Árbol seco (madera 23)») y el menú ☰ dice cuántos recursos hay al alcance de la colonia.
- Todavía no se pueden recoger: eso llega con las designaciones y los trabajos.
- Qué probar: tocar árboles, rocas, coches y escombros y ver su recurso; abrir ☰ y ver los recursos al alcance.
- Siguiente: inventario de la colonia y objetos en el suelo.

## 2026-10-17 (mañana, 2) — Inclinación ajustable

- La vista tiene 4 inclinaciones: cenital (desde arriba, paredes bajas), alta, inclinada (la de antes, por defecto) y baja (casi de lado, paredes altas). Se cambia con el botón ∠ junto a los de girar (recorre las cuatro), deslizando dos dedos a la vez hacia arriba o abajo, o con las teclas R y F. Se mantiene centrado lo que se miraba.
- Toques, selección, caminos y ocultación detrás del relieve se ajustan a cada inclinación (`setTilt` en `src/render/projection.ts`, con tests para todas).
- Con esto queda hecho el feedback de la vista con algo de 3D.
- Qué probar: pasar por las 4 inclinaciones en el móvil y en el PC; con la inclinación baja, comprobar que tocar una casilla detrás de una meseta selecciona la meseta y que los colonos detrás se ven como silueta.
- Siguiente: no queda feedback pendiente. Fases 0 y 1 a falta de tu confirmación en móvil y PC; mientras tanto se empieza la fase 2 (recursos en el mapa: árboles, rocas y chatarra).

## 2026-10-17 (mañana) — Girar la vista

- La vista se gira en pasos de 90°: botones ⟲ ⟳ arriba a la derecha, girando dos dedos sobre la pantalla (cada 45° de giro, un cuarto de vuelta) o con las teclas Q y E. Al girar se mantiene centrado lo que se estaba mirando.
- Una brújula junto a los botones indica qué punto cardinal queda arriba (↑N, ↑O, ↑S, ↑E). El giro se conserva al generar un mapa nuevo.
- El relieve, las paredes y la ocultación detrás de las mesetas se recalculan con la vista girada: lo que antes quedaba escondido detrás de una meseta se ve girando. Toques, órdenes, caminos y selección funcionan igual en cualquier giro; los colonos miran hacia donde se mueven en pantalla (`src/render/rotation.ts`, con tests).
- La simulación no cambia: solo se gira el dibujado.
- Qué probar: girar con los botones y con dos dedos en el móvil; con la vista girada, seleccionar un colono, mandarlo a una casilla y comprobar que va a la casilla tocada.
- Siguiente: inclinación ajustable (último paso de la vista 3D) y después confirmar las fases 0 y 1 para empezar la fase 2.

## 2026-10-17 (madrugada, 3) — Vista inclinada

- El suelo se ve inclinado, como desde un lado: cada casilla mide 16 × 12 en pantalla, mientras que paredes, árboles, objetos y colonos siguen de pie con su tamaño. Junto con el relieve elevado da una vista de tres cuartos.
- Caminos, marcas de destino, selección y toques ajustados a la nueva proyección (`TILE_H` en `src/render/projection.ts`, con tests).
- Qué probar: moverse por el mapa, tocar casillas y colonos y comprobar que se selecciona lo que está bajo el dedo.
- Siguiente: girar la vista en pasos de 90° e inclinación ajustable (punto 3 de la vista 3D).

## 2026-10-17 (madrugada, 2) — Lo alto tapa lo de detrás

- Incidencia #1 (enviada con 🐞) cerrada: era el mismo aviso de las alturas, ya resuelto.
- Los objetos (árboles, rocas, coches…) se pintan fila a fila junto con el terreno: una meseta o pared que está delante tapa lo que hay detrás, y un árbol al pie de un acantilado ya no se dibuja encima de la pared.
- Los colonos que quedan detrás de terreno más alto se ven como silueta azulada y translúcida, para no perderlos de vista; el círculo de selección sigue visible.
- Qué probar: mandar un colono a la parte de atrás (norte) de una meseta y ver que se vuelve silueta; mirar bosquecillos junto a acantilados.
- Siguiente: inclinar la vista (casillas más bajas que anchas), último paso del punto 2 de la vista 3D.

## 2026-10-17 (madrugada) — Relieve elevado, teclado y panel de progreso

- A petición de Mikel (las alturas no se veían): el terreno se dibuja elevado. Cada nivel sube 12 px y bajo los desniveles se ve la pared: roca en los acantilados, talud rayado en las pendientes y orilla de tierra junto al agua. Cuanto más alto, más claro; sombra al pie de las paredes. Colonos, objetos, caminos y toques siguen la altura (`src/render/projection.ts`, con tests).
- Arreglado: en el formulario 🐞 no se podían escribir W, A, S, D, y espacio/1/2/3 cambiaban la velocidad mientras se escribía.
- Nuevo panel ☰ → «📋 Progreso del desarrollo»: versión publicada, % total y de la fase, siguiente tarea, peticiones en cola, próxima sesión automática, últimos parches y tareas que faltan. Se genera de los documentos en cada publicación.
- Arreglado tras probar la versión publicada: si el juego se abría con la ventana a 0×0 (pestaña o panel oculto) Phaser fallaba al crear el lienzo y no cargaba nada; ahora espera a que la ventana tenga tamaño.
- Qué probar: ver el mapa en el móvil con poco zoom y comprobar que se distinguen las alturas; tocar una meseta y su pared; escribir en 🐞 con WASD; abrir el panel de progreso.
- Siguiente: inclinar la vista y que lo alto tape lo de detrás (paso 2 de la vista 3D), después girar la vista.

## 2026-10-16 (noche, 3) — Relieve: mesetas, acantilados y vados

- Primer paso de la vista con algo de 3D y última tarea de la fase 1. El mapa tiene 4 alturas en terrazas (llano bajo, llano, loma y meseta): cada nivel se ve más claro y proyecta sombra hacia abajo-derecha.
- Acantilados en parte de los desniveles: pared de roca que no se puede pisar. El resto son pendientes (se cruzan un 50 % más despacio). Los ríos que atraviesan terreno alto quedan encajados en cañones.
- Pasos estrechos: si un acantilado deja aislada una zona, se abre una pendiente de una casilla. Vados garantizados: antes, en algunas semillas (8, 18) un lago y un río partían el mapa y el inicio quedaba en una franja; ahora se abre un vado por el tramo más corto y la colonia empieza en la zona más grande. Todas las semillas de prueba tienen más del 97 % del terreno alcanzable.
- La información de casilla dice el nivel y si es acantilado o pendiente.
- Qué probar: buscar mesetas y acantilados, mandar a un colono a lo alto de una meseta y ver que rodea los acantilados por las pendientes. Semillas buenas: `?seed=1`, `?seed=8`.
- Fase 1: todas las tareas hechas; falta que Mikel confirme en móvil y PC (y que la fase 0 se confirme) para darla por cerrada.
- Siguiente: paso 2 de la vista 3D (proyección inclinada 2.5D).

## 2026-10-16 (noche, 2) — Detección de bugs y botón 🐞

- Feedback de Mikel ordenado en `FEEDBACK.md`; la vista con algo de 3D queda pendiente, partida en tres pasos.
- Detección de errores en ejecución: excepciones, promesas fallidas, `console.error` y comprobaciones de la simulación cada 2 s (`src/sim/diagnostics.ts`, con tests): colonos con posición inválida, fuera del mapa, sobre casillas no transitables, con caminos rotos o atascados. Aviso en pantalla y contador rojo en el botón 🐞.
- Botón 🐞 en la barra superior: elegir Bug / Petición / Cambio, escribir y «Enviar a la cola» abre una incidencia de GitHub ya rellenada (partida, semilla, pantalla y errores) con etiquetas `feedback` y el tipo. También «Guardar para luego» (cola en el navegador) y «Copiar pendientes». Las sesiones automáticas leen esas incidencias al empezar.
- Nuevo workflow «Probar rama» para probar ramas cuando npm no está disponible en la sesión.
- Uso de la suscripción: no se puede leer desde el juego ni desde las sesiones; se controla con la frecuencia de la sesión programada.
- Qué probar: tocar 🐞, mandar una petición de prueba (hay que tener la sesión de GitHub abierta) y comprobar que aparece en Issues.
- Siguiente: primer paso de la vista 3D (relieve visible y acantilados), que además cubre la tarea de geografía de la fase 1.

## 2026-10-16 (noche) — Colonos y mapa con objetos

- Mapa rehecho a petición de Mikel: el suelo es continuo (tierra, arena, pedregal, roca, asfalto, agua) con bordes suaves; la variedad viene de objetos encima. Zonas irradiadas = tinte suave + barriles y charcos; manantiales = objeto. Carreteras viejas con edificios en ruinas y coches. Ríos con 2–3 vados para cruzarlos a pie.
- Simulación por ticks con pausa/x1/x2/x3 (botones y teclas espacio/1/2/3) y reloj (día y hora).
- 3 colonos con nombre, apodo, edad, habilidades 0–20 con pasiones y rasgos. Deambulan solos con pathfinding A* que respeta agua, roca y objetos.
- Tocar un colono lo selecciona (ficha con habilidades y rasgos); tocar el suelo lo manda allí. En PC también clic derecho. Lista de colonos abajo; tocar dos veces centra la cámara.
- Qué probar: seleccionar colonos y moverlos por el mapa en móvil y PC.
- Siguiente: más geografía (acantilados, pasos estrechos) y luego fase 2 (talar, minar, saquear).

## 2026-10-16 — Fase 0 montada

- Proyecto Vite + Phaser 3 + TypeScript, tests con Vitest y publicación automática en GitHub Pages.
- Generador de mapas con semilla (100 × 100): lagos, 1–2 ríos serpenteantes con orillas de arena, colinas, roca, bosque muerto, ruinas, zonas irradiadas, manantiales y agua contaminada. Tests de determinismo y variedad (20 semillas).
- Dibujado pixel art del mapa, cámara con arrastre, rueda, pellizco táctil y WASD/flechas. Al tocar una casilla se ve su terreno. Botón "Nuevo mapa" y semilla en la URL (`?seed=123`).
- Qué probar: abrir la URL en el móvil y en el PC, moverse, hacer zoom y generar mapas nuevos.
- Siguiente: confirmar fase 0 y empezar la fase 1 (bucle de simulación y velocidades).
