# Progreso

Diario de sesiones, la más reciente arriba.

## 2026-10-21 — Decisiones de Mikel anotadas (sin cambiar el juego)

- Mikel contestó en el chat el muelle y la pesca, los saqueadores en balsa y la fase 5; todo queda en «Pendiente» de `FEEDBACK.md`, sin propuestas abiertas.
- Siguiente: muelle y pesca, saqueadores en balsa y, después, facciones (fase 6).

## 2026-10-21 (29) — Propuesta: cómo seguir con la fase 5 parada

- Sin incidencias nuevas en 🐞 y la última publicación (foso con agua) pasó bien. No hay nada aprobado y decidido por hacer: el muelle y los saqueadores en balsa esperan a Mikel, y lo demás de la fase 5 espera a las estaciones, al mercado o al fuego.
- Esta sesión **no ha tocado el juego**: ha dejado en «Propuestas para Mikel» de `FEEDBACK.md` la pregunta de si se da la fase 5 por terminada y se sigue con las facciones o con los opcionales, se espera, o la sesión elige por él lo del agua.
- Qué probar: nada nuevo en el juego (sigue el foso con agua de la sesión 28).
- Siguiente: lo que Mikel elija en esa propuesta o en las del muelle y los saqueadores en balsa.

## 2026-10-21 (28) — Foso con agua: las zanjas junto al río se inundan

- Sin incidencias nuevas en 🐞. Los saqueadores en balsa y el muelle siguen esperando a Mikel (en «Propuestas para Mikel»); se hace lo que quedaba aprobado y con sus reglas de «Hidráulica» (bloque 13): el **foso con agua**.
- Tras investigar **«Hidráulica»**, toda **zanja que toca el agua** por un lado (no en diagonal) **se inunda**, y con ella las zanjas unidas a ella. Se ve con agua turbia en el fondo y al tocarla dice «Foso con agua».
- **Nadie lo cruza andando** (ni colonos ni saqueadores: lo rodean, o si no llegan dan vueltas y se marchan); los drones vuelan por encima. Se cruza **solo por un puente** (de madera o de metal, al precio normal) **o un puente levadizo** puestos encima; sobre una zanja seca no se tiende puente.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): la zanja se inunda **en el momento** en que se termina de cavar (o al terminar «Hidráulica»); si se rellena la zanja que la unía al agua, **lo de detrás se seca**; quien estuviera dentro al inundarse sale a la casilla libre más cercana. Las barcas no entran en el foso.
- Qué probar: investigar «Puentes» e «Hidráulica» en 📜 → 🔬 Investigación (🪄 acelera), cavar con ⚒ → ▭ Zanja una zanja que salga de la orilla de un río alrededor de la colonia: debe llenarse de agua; los colonos ya no la cruzan; poner un puente de madera encima y ver que lo usan.
- Sin npm en el entorno: tests con Bun (576, 7 nuevos en `tests/moat.test.ts`) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: lo que Mikel elija de los saqueadores en balsa o del muelle. Sin respuesta, las sesiones solo podrán dejar propuestas (la fase 5 no se cierra sin ellas, ni sin lo que espera a las estaciones, el mercado o el fuego).

## 2026-10-21 (27) — Propuesta: saqueadores en balsa

- Sin incidencias nuevas en 🐞. Lo siguiente aprobado de la update del agua son los **saqueadores en balsa** desde el día 15, pero no está decidido cuántos llegan, cada cuánto ni qué hacen al llegar: son reglas que cambian la dificultad, así que esta sesión **no ha tocado el juego** y ha dejado la propuesta con opciones en «Propuestas para Mikel» de `FEEDBACK.md`.
- El muelle y la pesca siguen esperando también su respuesta (propuesta del 2026-10-20).
- La fase 5 no está terminada (faltan esas dos partes del agua y los proyectos que esperan a las estaciones, el mercado o el fuego), así que tampoco se puede empezar la fase 6.
- Qué probar: nada nuevo en el juego.
- Siguiente: lo que Mikel elija de los saqueadores en balsa o del muelle. Sin respuesta, las sesiones solo podrán dejar propuestas; si Mikel quiere avanzar igualmente, puede dar por terminada la fase 5 a falta de eso y abrir la fase 6 (facciones, bloque 7).

## 2026-10-21 (26) — La lancha armada: el barco con motor

- Sin incidencias nuevas en 🐞. El muelle sigue esperando la respuesta de Mikel (en «Propuestas para Mikel»); se hace la siguiente parte aprobada de la update del agua: la **lancha armada**.
- Tras investigar **«Motores»** (pide «Navegación» y «Pólvora»), en 🏗 → Vehículos: **lancha armada** (🔩30 ⚙️4, 2×2). Se construye en el agua poco profunda o normal, como la balsa, y al terminarla pasa a ser un vehículo.
- Lleva un **conductor** y un **tirador** (que dispara con su arma) y su **blindaje para un 30 %** del daño a los de dentro (y se lo lleva el casco). Va **solo por el agua** (también la profunda) y gasta **⛽**: sale con el depósito vacío y **reposta sola** si se para a 2 casillas o menos de un montón de ⛽ en la orilla.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): **1 ⛽ cada hora en marcha** y depósito de 10, como el buggy; **1,5 veces lo que anda un colono**; vida 400 y, si se rompe, deja 🔩15; trabajo 1 000; no atropella. Números en `vehicles.json` y `buildings.json` (`lancha_armada`).
- Además, los textos del diario de los vehículos ya llevan su artículo («la balsa», «se sube a la lancha armada»).
- Qué probar: investigar «Puentes», «Navegación», «Pólvora» y «Motores» en 📜 → 🔬 Investigación (🪄 acelera), poner una lancha en la orilla de un río o lago, dejar un montón de ⛽ en la orilla a su lado, tocarla y elegir conductor y tirador; luego tocar el agua para llevarla.
- Sin npm en el entorno: tests con Bun (569, 8 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: los **saqueadores en balsa** desde el día 15 (falta decidir cuántos y cada cuánto: si no está concretado, propuesta para Mikel); o el muelle si Mikel ya ha contestado.

## 2026-10-20 (25) — La balsa: el primer barco

- Sin incidencias nuevas en 🐞. El muelle sigue esperando la respuesta de Mikel (en «Propuestas para Mikel»); se hace la siguiente parte aprobada de la update del agua: la **balsa**.
- Tras investigar **«Navegación»** (pide «Puentes»), en 🏗 → Vehículos: **balsa** (🪵20, 2×2). Se construye **en el agua poco profunda o normal** (pegada a la orilla) y al terminarla pasa a ser un vehículo, como el buggy.
- Lleva **2 colonos**: uno **rema** (el «conductor») y el otro va de **tirador** y dispara con su arma. Va **solo por el agua** (también la profunda), **a la mitad de lo que anda un colono** y **sin ⛽**. No atropella ni tiene blindaje.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): **no pasa por debajo de los puentes ni de las plataformas**; vida 150 y, si se rompe, deja 🪵8; trabajo 500. Si alguien se baja en medio del agua, **va nadando a la orilla más cercana**. Números en `vehicles.json` y `buildings.json` (`balsa`).
- Qué probar: investigar «Puentes» y «Navegación» en 📜 → 🔬 Investigación (🪄 acelera), poner una balsa en la orilla de un río o lago, tocarla y elegir quién rema; luego tocar el agua para llevarla. Probar que no va a tierra.
- Sin npm en el entorno: tests con Bun (561, 9 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: la **lancha armada** (🔩30 ⚙️4 ⛽, con «Motores», conductor y tirador, blindaje −30 %), y luego los saqueadores en balsa desde el día 15; o el muelle si Mikel ya ha contestado.

## 2026-10-20 (24) — Puente levadizo: se alza solo ante un raid

- Sin incidencias nuevas en 🐞. El muelle sigue esperando la respuesta de Mikel (en «Propuestas para Mikel»); se hace la siguiente parte aprobada de la update del agua: el **puente levadizo**.
- Tras investigar **«Hidráulica»**, en 🏗 → Defensas: **puente levadizo** (🔗12 ⚙️3, 4×2, se puede girar, gasta 20 W). **Bajado** se cruza andando como un puente; **alzado** no pasa nadie (ni colonos ni enemigos).
- Con corriente **se alza solo al empezar un raid** y **baja solo al acabar**. Tocándolo sale su panel con **⬆️ Alzar / ⬇️ Bajar**: a mano manda (si lo bajas en un raid, se queda bajado hasta el siguiente; si lo alzas tú, no baja solo).
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): va sobre cualquier agua y **puede apoyarse en la orilla** (al menos una casilla de agua), para que quepa en los ríos estrechos; el botón funciona **también sin corriente** (a mano), lo automático solo con ella; **no se alza con alguien encima**: espera a que quede libre; trabajo 500 y vida 600, como el puente de metal. Números en `buildings.json` (`puente_levadizo`).
- Qué probar: investigar «Puentes» e «Hidráulica» en 📜 → 🔬 Investigación (🪄 acelera), poner un puente levadizo sobre el río con un cable desde la orilla a un generador; tocarlo y alzarlo (nadie cruza), bajarlo, y lanzar ☰ → 🪄 Modo Dios → «⚔️ Raid»: debe alzarse solo y bajar al acabar.
- Sin npm en el entorno: tests con Bun (552, 7 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: los barcos (balsa 🪵20, y lancha armada) y los saqueadores en balsa desde el día 15, por partes; o el muelle si Mikel ya ha contestado.

## 2026-10-20 (23) — Molino de agua: 500 W fijos en el río

- Sin incidencias nuevas en 🐞. El muelle sigue esperando la respuesta de Mikel (en «Propuestas para Mikel»); se hace la siguiente parte aprobada de la update del agua con todos sus números: el **molino de agua**.
- Tras investigar **«Hidráulica»** (pide «Puentes»), en 🏗 → Electricidad: **molino de agua** (🪵25 🔩10 ⚙️3, 1×2, se puede girar). Va **en el río**: sus dos casillas sobre agua poco profunda o normal, sin puente ni plataforma. Da **500 W fijos**, de día y de noche y con o sin viento; se conecta con un cable en la orilla pegado a él.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): **en el agua profunda no va** (los ríos del mapa son de agua poco profunda y normal; la profunda es de los lagos); trabajo 600 y vida 200, como el generador de leña. Números en `buildings.json` (`molino_agua`).
- Qué probar: investigar «Puentes» e «Hidráulica» en 📜 → 🔬 Investigación (🪄 acelera), poner un molino de agua en un río y un cable desde la orilla hasta una lámpara: debe encenderse también de noche.
- Sin npm en el entorno: tests con Bun (545, 5 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: el **puente levadizo** (4×2, 🔗12 ⚙️3, 20 W, con «Hidráulica»), o el muelle si Mikel ya ha contestado.

## 2026-10-20 (22) — «Desguace de máquinas»: el doble de componentes

- Sin incidencias nuevas en 🐞. El muelle sigue esperando la respuesta de Mikel (en «Propuestas para Mikel»); con los drones y las arañas ya en el juego, se hace «Desguace de máquinas» (bloque 13).
- Tras investigar **«Desguace de máquinas»** (10 h, pide «Torretas»), las **arañas de chatarra** y los **drones de vigilancia** destruidos dejan **el doble de ⚙️** (4–8 en vez de 2–4). La 🔩 no cambia.
- Por dentro: `machineParts` en `research.json` y `machinePartsMultiplier` en `src/sim/research.ts`. Las partidas guardadas no cambian.
- Qué probar: investigar «Torretas» y «Desguace de máquinas» en 📜 → 🔬 Investigación (🪄 acelera), lanzar ☰ → 🪄 Modo Dios → «🕷️ Máquinas» y ver en el diario que los restos dejan ⚙️4–8.
- Sin npm en el entorno: tests con Bun (540, 3 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: el muelle y la pesca si Mikel ha contestado. Lo que queda del árbol de investigación espera a la update del agua (muelle, pendiente de Mikel), a las estaciones, al mercado o al fuego (aparcado); si Mikel no ha contestado, la próxima sesión solo podrá dejar propuestas o empezar la fase 6 (facciones, bloque 7) cuando se dé por terminada la fase 5.

## 2026-10-20 (21) — Drones de vigilancia en los ataques de máquinas

- Sin incidencias nuevas en 🐞. El muelle sigue esperando la respuesta de Mikel (en «Propuestas para Mikel»); se termina el bloque 6 (máquinas y drones) con el **dron de vigilancia**.
- Cada **ataque de máquinas** (desde el día 30, 1 de cada 4) trae ahora **1–2 arañas de chatarra y 2–4 drones de vigilancia** (🛸).
- El dron **vuela**: va en línea recta por encima de **muros, zanjas, barricadas, agua y trampas** (no pisa minas ni alambre de espino), y **nada le da cobertura** (ni le tapa el tiro un muro pegado). Tiene **poca vida** y **dispara como una pistola** (alcance 9) sin gastar munición. Es una máquina: no huye, no deja cadáver, al destruirlo suelta 🔩10–20 y ⚙️2–4 (no suelta la pistola) y las armas de fuego le hacen +25 %.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): vida **la mitad de un colono**, sin blindaje, velocidad **1,3** la de un colono; los dos tipos llegan juntos en cada ataque de máquinas. Números en `creatures.json` (`dron_vigilancia` y `machines.drones`).
- Ojo: un colono con arma cuerpo a cuerpo no puede ir a por un dron que esté encima de un muro (no llega); con arco o arma de fuego, sí le dispara.
- Qué probar: ☰ → 🪄 Modo Dios → «🕷️ Máquinas» (2 arañas y 3 drones); ver que los drones pasan por encima de los muros y disparan desde lejos, y que con armas de fuego o torretas caen enseguida.
- Sin npm en el entorno: tests con Bun (537, 7 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: el muelle y la pesca si Mikel ha contestado; si no, «Desguace de máquinas» (bloque 13: los drones y arañas destruidos dejan el doble de ⚙️).

## 2026-10-20 (20) — Ataques de máquinas: la araña de chatarra

- Sin incidencias nuevas en 🐞. Lo siguiente del agua (el muelle con la pesca) **necesita que Mikel decida**: lo aprobado habla de la habilidad «Supervivencia», que no existe, y no dice cómo se come el 🐟. Va en «Propuestas para Mikel» con opciones; mientras, se empieza el bloque 6 (máquinas y drones), aprobado y con sus números.
- Desde el **día 30**, **1 de cada 4 ataques es de máquinas**: llegan **1–2 arañas de chatarra** (🕷️). Tienen el **cuádruple de vida** de un colono, **golpe ×3** y **blindaje −40 %**, **rompen muros y puertas** como el bruto y **no huyen** (ni al caer la mitad, ni malheridas, ni al pasar el día).
- Al destruirlas no dejan cadáver: sueltan **🔩10–20 y ⚙️2–4**. Las **armas de fuego** (pistola, escopeta, rifle, subfusil, francotirador) les hacen **+25 %**.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): andan a 0,8 de un colono; cada golpe a un muro le quita 30 (como el bruto); el +25 % es solo de las armas de fuego de los colonos, no de las torretas; el ataque de máquinas va en lugar de los saqueadores o mutantes de ese día. Números en `creatures.json` (`arana_chatarra` y `machines`).
- Qué probar: ☰ → 🪄 Modo Dios → «🕷️ Máquinas» (llegan 2 arañas); reclutar colonos, ver que aguantan mucho, que rompen muros y que al destruirlas dejan chatarra y componentes. Comparar el daño con un rifle frente a un arco.
- Sin npm en el entorno: tests con Bun (530, 6 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: el **dron de vigilancia** (vuela, poca vida, dispara como una pistola, 2–4 por ataque), o el muelle si Mikel ya ha contestado.

## 2026-10-20 (19) — Plataformas de madera y de metal sobre el agua

- Sin incidencias nuevas en 🐞. Segunda parte de la **update del agua**: las plataformas (opción B elegida por Mikel).
- Tras investigar **«Puentes»**, en 🏗 → Suelos: **plataforma de madera** (🪵12 por casilla, en agua poco profunda o normal) y **plataforma de metal** (🔩10 ⚙️1, también en la profunda). Terminadas, se pisan como suelo y **encima se construye como en tierra** (muros, muebles, talleres, cables…), menos huertos y otros suelos. Una construcción de varias casillas puede quedar mitad en la orilla y mitad en la plataforma.
- Si se derriba una plataforma, lo que tenía encima sobre el agua se viene abajo y se recupera como al demolerlo (primero hay que demoler lo de encima: «Demoler» elige antes la construcción que el suelo).
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): **el mismo precio en el agua profunda** (lo de «el doble» era de los puentes); vida 200 (madera) y 600 (metal), como los puentes; trabajo 200 y 300; hasta que la plataforma no está terminada no se pueden poner planos encima; los almacenes siguen sin poder marcarse sobre el agua.
- Por dentro: `platform` en `buildings.json` (`plataforma_madera`, `plataforma_metal`); usa la misma marca `map.bridge` que los puentes para que se pise, y `Structures.onPlatform` deja construir encima. Las partidas guardadas no cambian.
- Qué probar: investigar «Puentes» en 📜 → 🔬 Investigación (🪄 acelera), tender plataformas desde la orilla de un lago y, ya terminadas, poner encima un muro, una cama o un banco de trabajo.
- Sin npm en el entorno: tests con Bun (524, 8 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: el **muelle** de madera (🪵10 por casilla, pegado a la orilla) con la **pesca** (1 🐟 cada 1–2 h según Supervivencia) y la **trampa de pesca** (🪵6 🧵2, 1 🐟 al día). Puede que haga falta que Mikel decida cómo se come el 🐟 (crudo o en la cocina).

## 2026-10-20 (18) — Puentes de madera y de metal, con «Puentes»

- Sin incidencias nuevas en 🐞. Con los bloques 3, 4 y 5 terminados, se empieza la **update del agua** (primera parte, como pidió Mikel: puentes).
- Tras investigar **«Puentes»** (4 h, sin requisitos; antes salen con 🔒), en 🏗 → Suelos: **puente de madera** (🪵8 por casilla) y **puente de metal** (🔗4). Solo se ponen **sobre el agua, de cualquier tipo**; en el **agua profunda cuestan el doble** (🪵16 / 🔗8). Terminados, el agua se cruza andando como suelo normal (colonos, saqueadores y animales).
- La madera **no se pudre** y aguanta **un tercio** que el metal (vida 200 y 600). Se construyen casilla a casilla desde la orilla: el colono trabaja desde la orilla o desde el tramo ya hecho.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): **sin límite de ancho** (el catálogo decía «hasta 4 casillas», pero Mikel luego pidió puentes en cualquier agua; las plataformas vendrán aparte); trabajo de construcción 150 (madera) y 250 (metal); encima de un puente no se construye nada más (eso será con las plataformas).
- Por dentro: `bridge` en `buildings.json` (`puente_madera`, `puente_metal`), `map.bridge` (lo rehacen las construcciones al cargar; las partidas guardadas no cambian) y `Structures.costOf`.
- Qué probar: investigar «Puentes» en 📜 → 🔬 Investigación (🪄 acelera), poner puentes sobre un río desde la orilla y ver que los colonos lo cruzan; mirar en la información de un plano sobre agua profunda que pide el doble.
- Sin npm en el entorno: tests con Bun (516, 6 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: las **plataformas** (de madera 🪵12 en agua poco profunda o normal, de metal 🔩10 ⚙️1 también en profunda) y el **muelle** de madera (🪵10).

## 2026-10-20 (17) — El mortero, con «Artillería»

- Sin incidencias nuevas en 🐞. Siguiente aprobado con sus números: el mortero (bloque 5).
- Tras investigar **«Artillería»** (antes sale con 🔒), en 🏗 → Defensa: **mortero** (🔗20 ⚙️4 🔩10, 1×1). Lo maneja un **colono reclutado que esté pegado a él** (en una de las 8 casillas de alrededor, sin retirarse); mientras le quede munición se queda a su lado en vez de ir a por el enemigo.
- Tira **por encima de los muros** a un enemigo a **6–20 casillas**, al sitio con más enemigos juntos y nunca donde haya un colono. Cada disparo gasta **🔩2** de su depósito (caben 🔩20, 10 disparos), que los colonos con «Transportar» rellenan solos desde el almacén. **Falla un 40 %**: entonces cae hasta 2 casillas al lado. El proyectil estalla como una granada: daño a todos los del 3×3 (también a un colono que se meta), y un poco a muros y puertas.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): un disparo cada 8 s, el proyectil tarda 2 s en caer, el depósito es de 🔩20, vida 200 y trabajo de construcción 700. Va en `buildings.json` (`mortero`).
- Qué probar: investigar «Torretas» y «Artillería» en 📜 → 🔬 Investigación (🪄 acelera), construir el mortero y esperar a que le lleven chatarra (la información de la casilla dice cuántos disparos tiene). En un raid, reclutar a un colono, ponerlo pegado al mortero y ver los proyectiles caer sobre los saqueadores lejanos.
- Sin npm en el entorno: tests con Bun (510, 5 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: con los bloques 3, 4 y 5 terminados, toca la **update del agua** (primera parte: puentes y plataformas) o las **máquinas y drones** (bloque 6), según el orden de «Pendiente».

## 2026-10-20 (16) — Chaleco y casco tácticos con «Blindaje avanzado»

- Sin incidencias nuevas en 🐞. «Desguace de máquinas» se deja para cuando existan los drones y las arañas (bloque 6), porque hoy no haría nada. Siguiente aprobado con todos sus números: el blindaje táctico (bloque 5).
- En el banco de trabajo, tras investigar **«Blindaje avanzado»** (12 h, pide «Armas largas»; antes salen con 🔒): **chaleco táctico** (🔗10 ⚙️2 🧵6: quita un 45 % del daño, se anda un 5 % más despacio) y **casco táctico** (🔗6 ⚙️1: −20 %). Juntos, −65 %.
- Los colonos se ponen solos lo mejor que haya libre, así que cambian el de metal por el táctico; en la ficha se ve como siempre.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): el trabajo de fabricarlos es el de los de metal (500 y 300), su valor para el trueque es 75 y 38, y los saqueadores siguen sin traerlos.
- Qué probar: investigar «Armas largas» y «Blindaje avanzado» en 📜 → 🔬 Investigación (🪄 acelera), encargar los dos en el banco de trabajo y ver que el colono se los pone y en su ficha sale «−65 % de daño».
- Sin npm en el entorno: tests con Bun (505, 3 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: el **mortero** (🔗20 ⚙️4 🔩10, con «Artillería»: lo maneja un colono, cada disparo gasta 🔩2, daña 3×3 a 6–20 casillas, falla un 40 %).

## 2026-10-20 (15) — «Medicina avanzada»: heridas un 25 % más rápidas y la mitad de infecciones

- Sin incidencias nuevas en 🐞. Siguiente del orden: «Medicina avanzada» (bloque 13, con sus números en el catálogo).
- Al terminar **«Medicina avanzada»** (12 h, pide «Medicina de campo»), las heridas de los colonos **tardan un 25 % menos en cerrarse** y la probabilidad de que **se infecten es la mitad** (sin curar 10 %, curada sin 💊 4 %, con 💊 1 %; curándose uno mismo, 6 % y 2 %).
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): vale para los colonos y los **prisioneros** (los cuida la colonia), no para saqueadores ni comerciantes; solo acelera el cierre de las heridas, no la recuperación general de salud.
- Por dentro: `woundHealTime: 0.75` e `infectionChance: 0.5` en `research.json`; `woundHealTimeFactor` e `infectionChanceFactor` en `src/sim/research.ts`.
- Qué probar: herir a un colono (🪄 o un raid), investigar «Medicina de campo» y «Medicina avanzada» en 📜 → 🔬 Investigación (🪄 acelera) y ver que sus heridas desaparecen antes.
- Sin npm en el entorno: tests con Bun (502, 4 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: «Desguace de máquinas» (los drones y arañas destruidos dejan el doble de ⚙️); como aún no hay drones ni arañas (bloque 6), habrá que ver si se deja para cuando existan.

## 2026-10-20 (14) — La mesa de boticario y la hierba curativa piden «Medicina de campo»

- Sin incidencias nuevas en 🐞. Siguiente del orden: «Medicina de campo» (opción A, elegida por Mikel).
- La **mesa de boticario** (🏗 → Talleres) sale con 🔒 hasta investigar **«Medicina de campo»** (6 h, sin requisitos), y en el panel del huerto la **🌿 Hierba curativa** también sale con 🔒 y dice qué falta. Al terminar el proyecto, el diario dice «Ya se puede construir: Mesa de boticario. Ya se puede plantar: Hierba curativa».
- En las partidas empezadas, las mesas ya construidas o planeadas y los huertos que ya tenían hierba se quedan y siguen plantándola. La 💊 de las ruinas y las caravanas sigue saliendo igual.
- Por dentro: `research` en `mesa_boticario` (`buildings.json`) y en `hierba` (`crops.json`); `World.canPlant` y `World.setFarmCrop` en la simulación.
- Qué probar: en una partida nueva, ver el 🔒 en la mesa de boticario y en la hierba del huerto; investigar «Medicina de campo» en 📜 → 🔬 Investigación (🪄 acelera) y ver que ya se pueden poner las dos.
- Sin npm en el entorno: tests con Bun (498, 4 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: «Medicina avanzada» (las heridas se curan un 25 % antes y la infección sale la mitad de veces).

## 2026-10-20 (13) — Saqueadores con subfusil y francotirador desde el día 35

- Sin incidencias nuevas en 🐞. Siguiente del orden: los **saqueadores con subfusil y rifle de francotirador** (opción A, elegida por Mikel).
- Desde el **día 35**, los saqueadores pueden llegar con **subfusil** o **rifle de francotirador**, con **15 balas**, como los de pistola, escopeta y rifle. Al caer sueltan el arma y las balas, y los colonos las recogen.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): desde el día 35, el reparto de armas de los saqueadores es tubería, lanza, arco, pistola, escopeta, rifle, subfusil y francotirador, a partes iguales (1 de cada 4 con un arma automática). Va en `weapons.json` (`raiderPools`).
- Qué probar: con 🪄 adelantar al día 35 y lanzar varios raids; ver saqueadores que disparan muy seguido (subfusil) o desde muy lejos (francotirador, 18 casillas). Tras el combate, recoger el arma y las balas que sueltan.
- Sin npm en el entorno: tests con Bun (494, 1 nuevo) y tipos con `tsc`; la prueba completa, en GitHub Actions.
- Siguiente: «Medicina de campo» (la mesa de boticario y la hierba curativa pasan a pedirla).

## 2026-10-20 (12) — Muro con aspilleras, de piedra y de metal

- Sin incidencias nuevas en 🐞. Siguiente del orden: el **muro con aspilleras** (opción A, elegida por Mikel). Con él quedan terminados los sacos de arena, el alambre de espino y las aspilleras.
- Dos muros nuevos en 🏗 → Muros, tras investigar **«Fortificación»** (antes salen con 🔒): **de piedra** (🪨7, aguanta 336) y **de metal** (🔗6, aguanta 560), 4/5 de la vida del muro normal. Bloquean el paso como un muro y cierran habitaciones; los brutos y las granadas los rompen igual.
- Por ellos **se dispara desde los dos lados**; quien está pegado tiene un **75 % de cobertura**. Los arqueros y tiradores reclutados los buscan solos para cubrirse. Se ven con dos rendijas en el frente.
- **Cambio de regla que hacía falta para que sirvan** (Mikel puede cambiarlo): hasta ahora quien estaba pegado por dentro a un muro normal disparaba hacia fuera sin que le pudieran dar, así que la aspillera habría sido peor que un muro. Ahora **un muro, puerta, roca o ruina pegado al tirador en la línea de tiro también le impide disparar**, a colonos y saqueadores. Las torretas no cambian (disparan por encima).
- Por dentro: el número va en `buildings.json` (`loophole: 0.75`); la regla, en `shotBlocked` de `src/sim/people.ts`.
- Qué probar: investigar «Fortificación» en 📜 → 🔬 Investigación (🪄 acelera), cerrar un tramo con muro con aspilleras, reclutar a un colono con arco o arma de fuego pegado a él y lanzar un raid con 🪄: dispara a través y a él le dan mucho menos. Pegado a un muro normal, ya no dispara.
- Sin npm en el entorno: tests con Bun (493, 5 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: los saqueadores con subfusil y francotirador desde el día 35 (opción A); después «Medicina de campo».

## 2026-10-20 (11) — Los saqueadores traen granadas desde el día 30 (granadas terminadas)

- Sin incidencias nuevas en 🐞. Siguiente del orden: la segunda parte de las **granadas** (opción B + saqueadores, elegida por Mikel).
- Desde el **día 30**, cada saqueador tiene **1 de cada 3** probabilidades de llegar con **1 granada** (las criaturas no).
- La lanza con las mismas reglas que los colonos, pero al revés: a **2 o más colonos en pie** en un 3×3, a 6 casillas o menos, y **nunca si hay otro saqueador en pie** en ese 3×3 (ni él mismo). Desde dentro del buggy no lanza.
- Aviso en rojo «💣 ¡… (saqueador) lanza una granada! Apartaos.» que lleva al sitio; tarda 1,5 s en estallar, así que da tiempo a mover a los reclutados. Al caer, la suelta en el suelo y los colonos la recogen.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): «alguna» = 1 de cada 3 saqueadores, con 1 granada cada uno. Los números van en `weapons.json` (`grenade.raiderFromDay`, `raiderChance`, `raiderCarry`).
- Qué probar: con 🪄 adelantar al día 30 y lanzar varios raids; poner a dos colonos juntos y ver en el diario «💣 ¡… lanza una granada!» y luego «💥 Estalla…»; apartar a un colono a tiempo y ver que no le daña. Tras el combate, recoger la granada que suelta el caído.
- Sin npm en el entorno: tests con Bun (488, 3 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: el **muro con aspilleras** (opción A, elegida por Mikel); después los saqueadores con subfusil y francotirador (día 35) y «Medicina de campo».

## 2026-10-20 (10) — Granadas caseras con «Explosivos» (primera parte)

- Sin incidencias nuevas en 🐞. Siguiente del orden: las **granadas** que eligió Mikel (opción B + saqueadores). Primera parte: las de los colonos.
- **Granadas caseras** 💣: se fabrican en el banco de trabajo (🔩2 ⚙️1 → 2) tras investigar **«Explosivos»** (antes, la receta sale con 🔒). Van al armero como las armas.
- Cada colono coge **2** del almacén y las lleva aparte de su arma (se ven en su ficha: «· 💣 2»). Quien está puesto «sin arma» no las coge y suelta las que lleva; al caer o morir, las suelta en el suelo.
- En combate lanza una sola cuando hay **2 o más enemigos en pie en un 3×3 sin ningún colono** (ni caído) dentro, a **6 casillas** o menos; como mucho **una cada 10 s**. Tarda 1,5 s en estallar (se ve volar en arco y luego el fogonazo): **daño ×3** a todos los que estén entonces en el 3×3, **también a un colono que haya entrado en el último momento**, y les quita **un 10 % de su vida** a muros, puertas y portones.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): 1,5 s hasta estallar; se lanzan por encima de muros (van en arco); el 10 % de vida a muros y puertas; la armadura y el rasgo «duro» protegen como de un golpe; trabajo de la receta 200 (como las balas).
- Por dentro: los números van en `weapons.json` (`grenade`); la regla, en `src/sim/grenades.ts`. Las que están en el aire y las que lleva cada colono se guardan con la partida.
- Qué probar: investigar Pólvora → Armas largas → Explosivos en 📜 → 🔬 Investigación (🪄 acelera), fabricar granadas en el banco y ver que cada colono coge 2; lanzar un raid con 🪄 y ver que, cuando dos saqueadores van juntos, alguien les lanza una (diario: «💥 Estalla la granada de …»). En el móvil, que se vea la granada volar y el fogonazo.
- Sin npm en el entorno: tests con Bun (485, 7 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: las granadas de los saqueadores (desde el día 30), segunda parte; después «Medicina de campo» y el muro con aspilleras.

## 2026-10-20 (9) — La hoguera da luz y ánimo

- Pedido por Mikel en el chat: la hoguera debe dar luz y ánimo, y rellenarse si se apaga. Números elegidos por él: luz como una lámpara y +5 % de ánimo cerca, de noche.
- Encendida, la hoguera **ilumina 3 casillas** alrededor sin corriente (como una lámpara: de noche se trabaja con luz y cuenta para «Habitación con luz»).
- De noche, quien está despierto a **3 casillas o menos** de una hoguera encendida gana **+5 % de ánimo** («Junto a la hoguera»), que le dura **2 horas** después de alejarse. Se guarda con la partida.
- Relleno: los colonos con «Transportar» le llevan madera del almacén en cuanto baja de la mitad del depósito, y también si se ha apagado del todo (ahora hay un test que lo comprueba).
- Por dentro: los números van en `buildings.json` (`light` y `cheer` de `hoguera`).
- Qué probar: de noche, poner una hoguera con leña, ver la luz alrededor y, en la ficha de un colono que esté cerca, «Junto a la hoguera +5 %». Dejar que se apague con madera en el almacén y ver que alguien la rellena.
- Sin npm en el entorno: tests con Bun (478, 3 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: las granadas, primera parte.

## 2026-10-20 (8) — Hoguera para quemar los cadáveres (mutantes terminados)

- Sin incidencias nuevas en 🐞. Mikel eligió la hoguera esta mañana; es lo primero sin hacer del orden (fase 4, mutantes), así que va antes que lo del árbol.
- **Hoguera** (🏗 → Muebles, 🪵5, 1×1): tiene un **depósito de 🪵20** que los colonos con «Transportar» rellenan como el del generador de leña (cuando baja de la mitad). Mientras le queda leña está **encendida** y la gasta aunque no queme nada: el depósito lleno dura **2 días**. Sin leña se apaga.
- Con la hoguera encendida, un colono con «Transportar» va a por cada cadáver de perro o bruto mutante, se lo carga («Llevando un cadáver a la hoguera») y lo **quema**: el diario dice «🔥 … quema el cadáver de un perro mutante en la hoguera». Si la hoguera se apaga o se quita por el camino, suelta el cadáver donde esté (se sigue pudriendo). El cadáver que lleva a cuestas se guarda con la partida.
- Decidido en esta sesión porque no estaba concretado (Mikel puede cambiarlo): 60 de vida y 120 de trabajo; bloquea el paso; quemar es instantáneo al llegar; la hoguera no da luz ni ánimo (eso iría con «ocio», bloque 12).
- Por dentro: los números van en `buildings.json` (`hoguera`, con `burnsCorpses` y `fuel`); la regla, en `src/sim/bonfire.ts`.
- Qué probar: construir una hoguera con madera en un almacén y ver en su información «apagada: hace falta leña» y luego «encendida… leña n/20»; lanzar con 🪄 una manada de perros mutantes, matarlos y ver que un colono lleva cada cadáver a la hoguera. En el móvil, que el dibujo (corro de piedras con troncos y brasas) se vea.
- Sin npm en el entorno: tests con Bun (475, 8 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguiente: las **granadas** (elegidas por Mikel, opción B + saqueadores), primera parte; después «Medicina de campo» y el muro con aspilleras.

## 2026-10-20 (7) — «Baterías mejoradas»: las baterías guardan el doble

- Sin incidencias nuevas en 🐞 ni respuestas de Mikel a las propuestas. Siguiente del orden del árbol (las granadas y el muro con aspilleras esperan a Mikel): «Baterías mejoradas».
- Al terminar la investigación **«Baterías mejoradas»**, cada batería guarda **el doble**: 12 000 Wh en vez de 6 000. Vale para las que ya estaban construidas y para las nuevas. La información de la batería y de su red muestra la capacidad nueva.
- Por dentro: el multiplicador va en `research.json` (`batteryMultiplier: 2` en «baterias»), no en el código. La carga por encima de 6 000 Wh se guarda con la partida.
- Qué probar: con una batería conectada a un generador, ver en su información «…/6000 Wh»; investigar Baterías mejoradas en 📜 → 🔬 Investigación (🪄 acelera) y ver «…/12000 Wh» y que sigue cargándose por encima de 6 000.
- Sin npm en el entorno: tests con Bun (467, 4 nuevos) y tipos con `tsc` (sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguen esperando la respuesta de Mikel: la hoguera (A-D), «Medicina de campo» (A-C), los saqueadores con las armas nuevas (A-C), las granadas (A-D) y el muro con aspilleras (A-C).
- Siguiente: «Medicina avanzada» (heridas un 25 % antes y la mitad de infecciones), o las granadas o el muro con aspilleras si Mikel ya ha elegido.

## 2026-10-20 (6) — Torreta rotativa con «Ametralladoras»

- Sin incidencias nuevas en 🐞 ni respuestas de Mikel a las propuestas. Siguiente del orden del árbol (las granadas y el muro con aspilleras esperan a Mikel): la torreta rotativa.
- **Torreta rotativa** (🏗 → Defensas, 🔗25 ⚙️8, 1×1, 400 W): pide investigar **«Ametralladoras»** (16 h, que pide «Artillería»); hasta entonces sale con 🔒. Con corriente dispara sola, sin munición, **3 veces más seguido que la ligera**, a **10 casillas**, con ×1,2 de daño por disparo (más flojo que la ligera, ×2,2, pero en total hace más daño por segundo). Sin corriente, apagada. Dibujo propio: un haz de tres cañones finos.
- Decidido en esta sesión porque el catálogo no lo concreta (Mikel puede cambiarlo): 300 de vida y 800 de trabajo (entre la ligera y la pesada), altura 1.
- Qué probar: investigar Pólvora → Torretas → Artillería → Ametralladoras en 📜 → 🔬 Investigación (🪄 acelera), poner la torreta con un cable hasta un generador (400 W: quizá haga falta más de uno) y lanzar un raid con 🪄: dispara ráfagas rápidas a 10 casillas. En el móvil, que se distinga de la ligera.
- Sin npm en el entorno: tests con Bun (463, 4 nuevos) y tipos con `tsc` (sin Phaser, sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguen esperando la respuesta de Mikel: la hoguera (A-D), «Medicina de campo» (A-C), los saqueadores con las armas nuevas (A-C), las granadas (A-D) y el muro con aspilleras (A-C).
- Siguiente: «Baterías mejoradas» (que doble lo que guardan las baterías), o las granadas o el muro con aspilleras si Mikel ya ha elegido.

## 2026-10-20 (5) — Trampa eléctrica con «Trampas» y «Baterías mejoradas» (trampas, segunda parte)

- Sin incidencias nuevas en 🐞 ni respuestas de Mikel a las propuestas. Se sigue con las trampas: segunda parte, la trampa eléctrica. Con ella, las trampas quedan hechas.
- **Trampa eléctrica** (🏗 → Defensas, 🔩6 ⚙️2, 50 W): pide investigar **«Trampas» y «Baterías mejoradas»**; hasta tener las dos sale con 🔒 y el aviso dice cuál falta. Va a ras de suelo, no frena y se conecta con un cable como cualquier aparato. **Con corriente**, al saqueador o mutante que entra en su casilla lo **aturde 5 s**: se queda quieto, sin andar ni atacar. No hace daño y **no se gasta**; sin corriente no hace nada.
- Decidido en esta sesión porque el catálogo no lo concreta (Mikel puede cambiarlo): a los colonos no les afecta (como la mina y el alambre), 60 de vida y 60 de trabajo, y quien vuelve a pisarla tras pasársele vuelve a quedar aturdido (no hay tiempo de recarga).
- «Baterías mejoradas» aún no dobla lo que guardan las baterías: eso es su propio punto del orden (después de la torreta rotativa).
- Qué probar: investigar Trampas y Baterías mejoradas en 📜 → 🔬 Investigación (🪄 acelera), poner una trampa delante de la entrada con un cable hasta un generador y lanzar un raid con 🪄: el diario dice «⚡ … pisa una trampa eléctrica y se queda aturdido» y el saqueador se para 5 s. Sin corriente, pasan sin pararse. En el móvil, que el dibujo (placa de chapa con un rayo amarillo) se distinga de la mina.
- Sin npm en el entorno: tests con Bun (459, 5 nuevos) y tipos con `tsc` (sin Phaser, sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguen esperando la respuesta de Mikel: la hoguera (A-D), «Medicina de campo» (A-C), los saqueadores con las armas nuevas (A-C), las granadas (A-D) y el muro con aspilleras (A-C).
- Siguiente: la torreta rotativa (o el muro con aspilleras o las granadas, si Mikel ya ha elegido).

## 2026-10-20 (4) — Mina casera con «Trampas» y «Pólvora» (trampas, primera parte)

- Sin incidencias nuevas en 🐞 ni respuestas de Mikel a las propuestas. El muro con aspilleras y las granadas esperan su elección; se pasa a lo siguiente del orden, las trampas. Se hace la primera parte, la mina casera.
- **Mina casera** (🏗 → Defensas, 🔩6 ⚙️1): pide investigar **«Trampas»** (8 h) **y «Pólvora»**; hasta tener las dos sale con 🔒 y el aviso dice cuál falta. Va a ras de suelo y no frena. Cuando un saqueador o un mutante entra en su casilla, **estalla**: hace daño ×4 (los puños, de media; unos 0,52 de salud, menos con armadura) a cada enemigo del **3×3** y se gasta (desaparece sin dejar material). A un saqueador muy herido lo deja en el suelo, sin matarlo; un perro mutante sí puede morir.
- Nuevo para el contenido: una construcción puede pedir **dos investigaciones** (`researchAlso` en `buildings.json`); el diario avisa «Ya se puede construir» al terminar la segunda.
- Decidido en esta sesión porque el catálogo no lo concreta (Mikel puede cambiarlo): **a los colonos no les hace daño ni la hacen estallar** (saben dónde está), igual que el alambre de espino y que la opción A de las granadas; 40 de vida y 60 de trabajo.
- Qué probar: investigar Trampas y Pólvora en 📜 → 🔬 Investigación (🪄 acelera), poner unas minas delante de la entrada y lanzar un raid con 🪄: el diario dice «💥 … pisa una mina casera y estalla» y los de alrededor salen heridos. En el móvil, que el dibujo (disco de chapa con la espoleta roja) se vea.
- Sin npm en el entorno: tests con Bun (454, 4 nuevos) y tipos con `tsc` (sin Phaser, sin errores nuevos); la prueba completa, en GitHub Actions.
- Siguen esperando la respuesta de Mikel: la hoguera (A-D), «Medicina de campo» (A-C), los saqueadores con las armas nuevas (A-C), las granadas (A-D) y el muro con aspilleras (A-C).
- Siguiente: la trampa eléctrica (🔩6 ⚙️2, 50 W, «Trampas» y «Baterías mejoradas»; aturde 5 s). Antes habrá que hacer que «Baterías mejoradas» doble lo que guardan las baterías, o que la trampa solo pida «Trampas» hasta entonces (o el muro con aspilleras o las granadas, si Mikel ya ha elegido).

## 2026-10-20 (3) — Alambre de espino con «Fortificación» (fortificación, segunda parte)

- Sin incidencias nuevas en 🐞. Las granadas siguen esperando a Mikel; se sigue con «sacos de arena, alambre de espino y aspilleras»: segunda parte, el alambre de espino.
- **Alambre de espino** (🏗 → Defensas, 🔩2 por casilla): pide investigar **«Fortificación»** (8 h, sin requisitos); hasta entonces sale con 🔒. Va a ras de suelo, no tapa (sin cobertura), se cruza **3 veces más despacio** y cada saqueador o mutante que entra en la casilla se hace **un poco de daño** (5 % de salud, una herida en las piernas que sangra; los puños quitan de media un 13 %). A un saqueador muy herido lo deja en el suelo (sin matarlo, como los golpes); un perro mutante sí puede morir.
- Decidido en esta sesión porque el catálogo no lo concreta (Mikel puede cambiarlo): el daño de un 5 % por casilla, que a los **colonos no les hace daño** (saben dónde está; solo les frena), 60 de vida y 60 de trabajo (la mitad que unos pinchos).
- Qué probar: investigar Fortificación en 📜 → 🔬 Investigación (🪄 acelera), ver que ya no lleva el aviso 🕒, poner una fila de alambre delante de la entrada y lanzar un raid con 🪄: los saqueadores que lo cruzan van despacio y salen heridos. En el móvil, que el dibujo (postes y alambre con púas) se distinga de los pinchos.
- Sin npm en el entorno: tests con Bun (450, 4 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Siguen esperando la respuesta de Mikel: la hoguera (A-D), «Medicina de campo» (A-C), los saqueadores con las armas nuevas (A-C), las granadas (A-D) y ahora el muro con aspilleras (A-C).
- El muro con aspilleras deja sin decidir su coste y desde qué lado se dispara: propuesta A-C en «Propuestas para Mikel».
- Siguiente: el muro con aspilleras o las granadas, según lo que elija Mikel; si no ha contestado, las trampas (mina casera y eléctrica).

## 2026-10-20 (2) — Sacos de arena (fortificación, primera parte)

- Sin incidencias nuevas en 🐞. Las granadas siguen esperando a Mikel; se pasa a lo siguiente del orden: sacos de arena, alambre de espino y aspilleras. Se hace la primera parte, los sacos de arena.
- **Sacos de arena** (🏗 → Defensas, 🧵2 🪨3 por casilla): **libres**, sin investigar. Se ponen en un momento (40 de trabajo, frente a 150 de una barricada de madera), aguantan 100 de vida, dan un **50 % de cobertura** a quien está detrás y se cruzan despacio, como una barricada. Al demolerlos **devuelven todo** el material (lo demás, la mitad).
- Arreglado de paso: el diario decía «ha roto el pinchos de madera»; ahora dice «los pinchos» (y «los sacos de arena»).
- Qué probar: en 🏗 → Defensas, poner una fila de sacos de arena con fibra y piedra en el almacén y ver que se levantan enseguida; demoler uno y ver que deja 🧵2 🪨3. Poner un arquero reclutado detrás y lanzar un raid con 🪄: se le acierta menos. En el móvil, que el dibujo de los sacos se distinga de las barricadas.
- Sin npm en el entorno: tests con Bun (446, 3 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Siguen esperando la respuesta de Mikel: la hoguera (A-D), «Medicina de campo» (A-C), los saqueadores con las armas nuevas (A-C), las granadas (A-D) y ahora el muro con aspilleras (A-C).
- Siguiente: el alambre de espino con «Fortificación» (o las granadas, si Mikel ya ha elegido).

## 2026-10-20 — Ballesta con «Ballesta» y lanza de metal con «Forja»

- Sin incidencias nuevas en 🐞. Lo siguiente del orden, las granadas, deja sin decidir cómo se usan (quién las lanza, cuándo y a quién dañan): propuesta con opciones A-D en «Propuestas para Mikel». Se pasa a lo siguiente aprobado: la ballesta y la lanza de metal.
- **🏹 Ballesta** (banco de trabajo, 🪵6 🔩4 🧵3): ×2,4 de daño, lenta, alcance 10, gasta ➶ flechas (las mismas del arco). Pide investigar **«Ballesta»** (8 h, sin requisitos).
- **🔱 Lanza de metal** (banco de trabajo, 🔗4 🪵2): ×2,6 de daño, pega desde 2 casillas, ritmo normal (como la lanza de madera; el catálogo no dice otro). Pide investigar **«Forja»** (8 h, sin requisitos).
- Hasta investigarlas salen con 🔒 en el banco. Al elegir arma solos, los colonos prefieren la ballesta al arco (si hay flechas) y la lanza de metal a la de madera y al machete. Los saqueadores no las traen (el catálogo no lo dice).
- Qué probar: investigar Ballesta y Forja en 📜 → 🔬 Investigación (🪄 acelera), ver en el diario «Ya se puede fabricar: Ballesta», fabricarlas y ver que un arquero cambia el arco por la ballesta y sigue con sus flechas. En la ficha, «🏹 Ballesta (×2,4, lento, alcance 10)». En 📜 → 🔬, Ballesta y Forja ya no llevan el aviso 🕒.
- Sin npm en el entorno: tests con Bun (443, 5 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Siguen esperando la respuesta de Mikel: la hoguera (A-D), «Medicina de campo» (A-C), los saqueadores con las armas nuevas (A-C), las granadas (A-D) y ahora el muro con aspilleras (A-C).
- Siguiente: sacos de arena, alambre de espino y aspilleras con «Fortificación» (o las granadas, si Mikel ya ha elegido).

## 2026-10-19 (19) — Subfusil y rifle de francotirador con «Armas automáticas»

- Sin incidencias nuevas en 🐞. Siguiente tarea aprobada: el subfusil y el francotirador (bloque 13 del catálogo, primera del orden que queda del árbol).
- **Subfusil** (banco de trabajo, 🔗6 ⚙️3): ×1,3 de daño, muy rápido (dispara el doble de seguido que una pistola), alcance 7. **Rifle de francotirador** (🔗10 ⚙️4 🪵4): ×4,5, muy lento (espera casi el doble que una pistola entre disparos), alcance 18. Los dos gastan ⁍ balas y piden investigar **«Armas automáticas»** (que pide «Armas largas»); hasta entonces salen con 🔒 en el banco.
- Al elegir arma solos, con balas, los colonos prefieren el francotirador y el subfusil al rifle. En la ficha se puede fijar el que se quiera.
- Los saqueadores **no** los traen (el catálogo no lo dice): propuesta para Mikel en FEEDBACK.md.
- Por dentro: dos ritmos nuevos en `weapons.json`, «muy rápido» (×0,5 el tiempo entre disparos) y «muy lento» (×1,8).
- Qué probar: investigar Pólvora, Armas largas y Armas automáticas en 📜 → 🔬 Investigación (🪄 acelera), ver en el diario «Ya se puede fabricar: Subfusil, Rifle de francotirador», fabricarlos y ver que un colono coge el francotirador. En la ficha, «🔫 Rifle de francotirador (×4,5, muy lento, alcance 18)». En el móvil, que esa línea quepa.
- Sin npm en el entorno: tests con Bun (438, 6 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Siguen esperando la respuesta de Mikel: la hoguera (A-D), «Medicina de campo» (A-C) y los saqueadores con las armas nuevas (A-C).
- Siguiente: las granadas caseras con «Explosivos».

## 2026-10-19 (18) — Escopeta y rifle con «Armas largas» (armas de fuego, segunda parte)

- Sin incidencias nuevas en 🐞. Siguiente tarea aprobada: la escopeta y el rifle (bloque 4 del catálogo, primera del orden del árbol completo).
- **Escopeta** (banco de trabajo, 🔗6 ⚙️2): ×3,6 de daño a 3 casillas o menos y ×1,8 más lejos, lenta, alcance 6. **Rifle** (🔗8 ⚙️3 🪵4): ×3,0, lento, alcance 14. Las dos gastan ⁍ balas y piden investigar **«Armas largas»** (que pide «Pólvora»); hasta entonces salen con 🔒 en el banco.
- Al elegir arma solos, los colonos prefieren el rifle a la pistola y la pistola a la escopeta (que cuenta con su daño medio), y cualquiera de las tres al machete si hay balas. En la ficha se puede fijar la que se quiera.
- **Saqueadores con escopeta o rifle** desde el día 25, con 15 balas; al caer las sueltan.
- Por dentro: el daño que baja con la distancia va en `weapons.json` (`closeRange`, `farDamage`) y se calcula con `damageAt`.
- Qué probar: investigar Pólvora y Armas largas en 📜 → 🔬 Investigación (🪄 acelera), ver en el diario «Ya se puede fabricar: Escopeta, Rifle», fabricarlos y ver que un colono coge el rifle. En la ficha, «🔫 Escopeta (×3,6 a 3 o menos, ×1,8 más lejos, lento, alcance 6)». Lanzar un raid con 🪄 pasado el día 25.
- Sin npm en el entorno: tests con Bun (432, 7 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Siguen esperando la respuesta de Mikel: la hoguera (A-D) y «Medicina de campo» (A-C), en «Propuestas para Mikel».
- Siguiente: el subfusil y el rifle de francotirador con «Armas automáticas».

## 2026-10-19 (17) — Pistola casera y balas con «Pólvora» (armas de fuego, primera parte), y plan del árbol de investigación

- Pedido por Mikel en el chat: hacer lo previsto para la siguiente sesión y planificar el árbol de investigación completo.
- **🔫 Pistola casera** (banco de trabajo, 🔩8 ⚙️1): ×2,2 de daño, ritmo normal, 9 casillas, gasta balas. **⁍ Balas** (🔩3 ⚙️1 → 15), una por disparo; los tiradores cogen 20 y vuelven a por más con menos de 5, como con las flechas. Las dos recetas piden **«Pólvora»**: hasta entonces salen con 🔒 en el banco y dicen qué investigar. Al terminar Pólvora, el diario dice «Ya se puede fabricar: Pistola casera, Balas (15)».
- Cada arma coge **su** munición: el arquero, flechas; el de la pistola, balas. Si cambia de arma, deja la munición que ya no le sirve. Un colono prefiere la pistola al machete solo si hay balas.
- **Saqueadores con pistola** desde el día 15 (como dice el catálogo), con 15 balas; al caer la sueltan con las balas que le queden.
- Por dentro: las armas pasan a `src/data/weapons.json` (números y armas de los saqueadores por día), y las recetas pueden pedir investigación (`research`). Los talleres reciben su orden con `World.setStationBill`, que lo comprueba.
- **Árbol de investigación completo**, elegido por Mikel en el chat: bloque 13 de `docs/CATALOGO.md`, con 26 proyectos y 256 h en 5 ramas (supervivencia, armas, defensa, agua y contacto). Entran sus ideas: trampas (mina casera y eléctrica), ballesta, granadas, lanza de metal, subfusil y francotirador, torreta rotativa, foso con agua, alambre de espino, muro con aspilleras y sacos de arena (estos, libres); el lanzallamas espera al fuego.
- Los 26 proyectos ya salen en 📜 → 🔬 Investigación (la hidropónica pide ahora Agricultura mejorada). Los que aún no desbloquean nada lo dicen («llegará en una próxima actualización»); su contenido se hará por orden, una parte por sesión (el orden está en «Pendiente» de FEEDBACK.md).
- Qué probar: en 📜 → 🔬 Investigación, ver el árbol entero y que solo Pólvora, Torretas y Artillería no llevan el aviso 🕒. En el banco de trabajo, ver la pistola y las balas con 🔒; investigar Pólvora (🪄 acelera), fabricarlas y ver que un colono cambia su arma por la pistola y coge balas. En la ficha, ver «🔫 Pistola casera … · ⁍ 20». Lanzar un raid con 🪄 pasado el día 15 y ver pistolas. En el móvil, que las tarjetas con 🔒 se lean.
- Sin npm en el entorno: tests con Bun (425, 8 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Siguiente: la escopeta y el rifle con «Armas largas» (bloque 4, segunda parte).

## 2026-10-19 (16) — Las torretas piden investigación (fase 5, segunda parte)

- Sin incidencias nuevas en 🐞. Siguiente tarea aprobada: que la investigación desbloquee, empezando por las torretas, como decidió Mikel el 2026-10-18.
- **🔒 Torretas**: la **torreta ligera** pide terminar «Torretas» (que pide «Pólvora») y la **pesada**, «Artillería». Hasta entonces su botón de 🏗 → Defensas sale con 🔒 y apagado, y al tocarlo dice qué hay que investigar; no se pueden poner planos. Siguen sin munición: solo gastan corriente.
- **Partidas empezadas**: las torretas ya construidas o con plano puesto se quedan y funcionan; solo no se pueden poner más hasta investigarlas.
- Al terminar un proyecto que desbloquea algo, el diario lo dice: «Ya se puede construir: Torreta ligera».
- Por dentro: las construcciones llevan en `src/data/buildings.json` la investigación que piden (`research`), y los planos se ponen con `World.placeBuildArea`, que la comprueba (el dibujado ya no decide).
- Qué probar: abrir 🏗 → Defensas y ver las torretas con 🔒; tocar una y leer el aviso. Con el banco, investigar Pólvora y luego Torretas (🪄 acelera), ver el aviso del diario y que ya se puede poner la torreta ligera. Cargar una partida con torretas: siguen ahí. En el móvil, que el 🔒 quepa en el botón.
- Sin npm en el entorno: tests con Bun (417, 4 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Espera la respuesta de Mikel: la hoguera (A-D) y «Medicina de campo» (A-C), en «Propuestas para Mikel».
- Siguiente: «Pólvora» desbloquea las balas y la pistola casera (bloque 4, primera parte de las armas de fuego).

## 2026-10-19 (15) — Fin de la fase 4 y banco de investigación (fase 5, primera parte)

- Sin incidencias nuevas en 🐞. Lo siguiente de la fase 4 (la hoguera) espera a que Mikel elija, y lo demás que falta en ella (las armas de fuego) va con la investigación de la fase 5.
- **Fase 4 terminada**: se cumple el criterio («una partida de 30 minutos en la que se puede morir de hambre, de sed o por un raid»), comprobado con tests (`tests/phase4.test.ts`): con agua y sin comida se muere de hambre, con comida y sin agua, de sed, y un raid fuerte acaba con un colono solo. Quedan de la fase 4 la hoguera y las armas de fuego.
- **🔬 Banco de investigación** (🏗 → Talleres, 🪵20 🔩15 ⚙️2, 2×1) y trabajo nuevo **Investigar** (va con la habilidad Investigación; sale en las prioridades). Se elige el proyecto en **📜 → 🔬 Investigación** y avanza mientras alguien investiga en el banco (un rato de 2 h seguidas y vuelve a mirar qué hacer). Un colono con Investigación 10 tarda las horas que dice el catálogo. Lo hecho en un proyecto se guarda aunque se cambie a otro.
- **Árbol** (`src/data/research.json`): los 10 proyectos del catálogo con sus horas y lo que piden antes (Armas largas pide Pólvora, etc.). Al terminar uno sale un aviso en el diario. **Todavía no bloquean ni desbloquean nada**: eso es la segunda parte (primero, que las torretas pidan «Torretas» y «Artillería», como decidió Mikel).
- Qué probar: construir el banco (🪄 → terminar obras va rápido), abrir 📜 → 🔬 Investigación, pulsar «🔬 Investigar» en Puentes y ver que un colono va al banco y la barra sube; al tocar el banco se ve el proyecto en marcha. Guardar y cargar: sigue igual. En el móvil, que las 4 pestañas de 📜 se lean.
- Sin npm en el entorno: tests con Bun (413, 9 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Espera la respuesta de Mikel: qué hace «Medicina de campo», si la mesa de boticario ya es libre (opciones A-C en «Propuestas para Mikel»), y la hoguera (A-D).
- Siguiente: que los proyectos desbloqueen (torretas primero); después, las armas de fuego y balas con «Pólvora».

## 2026-10-19 (14) — Los cadáveres de los mutantes (mutantes, tercera parte)

- Sin incidencias nuevas en 🐞. Siguiente tarea aprobada de la fase 4: los **cadáveres** (bloque 2 del catálogo). Es grande, así que va en dos partes: esta, el cadáver y lo que se pudre; la siguiente, la hoguera para quemarlos.
- **💀 Cadáveres**: al morir, cada perro y bruto mutante deja su cadáver tumbado donde cae (también si lo mata el modo Dios o lo atropella el buggy). Los saqueadores y colonos no dejan cadáver, como hasta ahora.
- **Se pudre**: el colono despierto y en pie que tiene un cadáver a **5 casillas** o menos pierde un **5 % de ánimo** («Vio un cadáver pudriéndose», en su ficha), que le dura 2 horas después de dejar de verlo. Varios cadáveres pesan lo mismo que uno. Se dibuja cada vez más oscuro y con más moscas, y a los **4 días** se ha podrido del todo y desaparece.
- Los números están en `src/data/creatures.json`. Lo que he puesto yo: que se pudra en 4 días, que el mal rato dure 2 horas al dejar de verlo, que no se sume por cada cadáver y que no lo noten los que duermen o están en el suelo. En la vista 3D todavía no se dibujan.
- Qué probar: en 🪄 lanzar 🐕 Manada, matar a los perros cerca de la colonia y ver los cadáveres en el suelo; tocar a un colono que pase cerca y leer en su ánimo «Vio un cadáver pudriéndose». Con la velocidad alta, ver que se oscurecen y a los 4 días desaparecen. Guardar y cargar: siguen ahí.
- Sin npm en el entorno: tests con Bun (404, 7 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Espera la respuesta de Mikel: cómo funciona la hoguera (opciones A-D en «Propuestas para Mikel» de FEEDBACK.md).
- Siguiente: la hoguera (🪵5) para quemar los cadáveres (mutantes, cuarta parte) cuando Mikel elija, y con ella el bloque 2 terminado.

## 2026-10-19 (13) — El bruto mutante (mutantes, segunda parte)

- Sin incidencias nuevas en 🐞. Siguiente tarea aprobada de la fase 4: el **bruto mutante** (bloque 2 del catálogo).
- **👹 Bruto mutante**: desde el día 15, cada manada trae 1 bruto por cada 3 perros (una de 6 perros, 2 brutos). Anda ×0,7, tiene el triple de vida de un colono y pega ×3. Como los perros, no tiene líder, no saquea y al caer muere.
- **Rompe muros y puertas**: si no puede llegar a un colono, se abre paso a golpes por el muro, puerta o portón que le corte el paso (también las puertas automáticas cerradas). Si hay otro camino abierto, por largo que sea, va por él y no rompe nada. Avisa al empezar a romper algo y al romperlo; lo roto desaparece sin dejar material.
- Los números están en `src/data/creatures.json`. Lo que he puesto yo: cada golpe quita **30 de vida** a un muro (uno de madera, 150, cae en 5 golpes; uno de piedra, 420, en 14), golpea al ritmo normal (como los puños) y no rompe talleres, muebles ni torretas, solo muros, puertas y portones. Dibujo propio: una mole verde jorobada con brazos enormes y un ojo rojo.
- Modo Dios: nuevo atajo **👹 Manada con brutos** (6 perros y 2 brutos); 🐕 Manada sigue trayendo solo 5 perros.
- Qué probar: encerrar a un colono con muros de madera, lanzar 👹 Manada con brutos y ver que el bruto rompe un muro y entra (los perros se quedan fuera dando vueltas); con una puerta automática con corriente, ver que también la rompe. En el móvil, tocar al bruto y leer el aviso.
- Sin npm en el entorno: tests con Bun (397, 7 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Siguiente: los cadáveres (mutantes, tercera parte): quemarlos en una hoguera o dejarlos pudrirse.

## 2026-10-19 (12) — El buggy de los saqueadores (vehículos, tercera parte)

- Pedido por Mikel en el chat: el buggy de los saqueadores, como el de los colonos pero con otros números y otro dibujo.
- **🚙 Buggy saqueador**: desde el día 20, cada raid de 2 o más saqueadores trae uno, con dos dentro (conductor y tirador; el líder ★ va a pie). Va a por el colono de pie más cercano para **atropellarlo** (30 % de salud; a los colonos sí los puede dejar en el suelo), y su tirador dispara a los colonos. Si cae el conductor, el tirador coge el volante; cuando el raid huye, se va por el borde con los de dentro.
- **Números** (en `src/data/vehicles.json`): ×1,8 de velocidad (el de los colonos, ×2), blindaje −30 % (−40 %), 400 de vida (600). No gasta ⛽ porque lo traen lleno.
- **Romperlo**: el blindaje se lleva su parte de cada golpe a los de dentro y pierde esa vida (1000 de vida por cada punto de salud que para). Al llegar a 0 queda **chatarra 🔩20** y los de dentro se bajan. Si se quedan sin nadie dentro, lo abandonan y también queda chatarra. **Esto vale también para el buggy de los colonos**: ahora su vida (600) se gasta cuando les pegan a los de dentro.
- Dibujo propio: chapa roja oxidada, ariete de pinchos, calavera en el capó, tubos de escape, bandera y rueda trasera grande. Al tocarlo se ve su vida; con «🎯 Atacar a…», tocarlo es ir a por quien lo conduce.
- Modo Dios: nuevo atajo **🚙 Raid en buggy** (4 saqueadores, dos en el buggy).
- Lo que he puesto yo: todos los números de arriba, que traigan buggy en todos los raids desde el día 20, que lo abandonen al quedarse vacío y que el líder ★ vaya a pie.
- Qué probar: en 🪄 lanzar 🚙 Raid en buggy y ver que el buggy va a por un colono y lo atropella; reclutar colonos y pegarle a los de dentro hasta que el buggy quede destrozado y suelte la chatarra. Con el buggy propio, comprobar que la vida baja en su panel cuando pegan a los de dentro. En el móvil, tocar el buggy saqueador y leer el aviso.
- Sin npm en el entorno: tests con Bun (390, 13 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Siguiente: el bruto mutante (mutantes, segunda parte).

## 2026-10-19 (11) — Muros en los acantilados y las pendientes

- Pedido por Mikel en el chat: al levantar un muro junto a un acantilado no dejaba seguir, y por los huecos de pendiente que tienen los acantilados entraban los enemigos.
- Ahora los **muros (también los altos), puertas, portones y defensas** (barricadas, pinchos y torretas) se pueden poner en las **pendientes**, y los **muros y las defensas**, en el **borde del acantilado**. Una línea de muro pegada al acantilado sigue por él sin huecos. Las puertas en el acantilado no, porque ahí no llevarían a ninguna parte; los muebles y talleres siguen necesitando suelo llano.
- Qué probar: trazar un muro a lo largo de un acantilado que tenga una pendiente y ver que se puede cerrar; poner una puerta en la pendiente y ver que los colonos suben por ella. En el móvil, arrastrar el muro con el dedo.
- Sin npm en el entorno: tests con Bun (377, 5 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Siguiente: el bruto mutante o el buggy de los saqueadores, por el orden de «Pendiente».

## 2026-10-19 (10) — Perros mutantes en manada (mutantes, primera parte)

- Sin incidencias nuevas en 🐞. Esta sesión, la siguiente tarea aprobada de la fase 4: los **mutantes** (bloque 2 del catálogo), primera parte.
- **🐕 Perros mutantes**: desde el día 8, 1 de cada 3 raids es una manada de 3 a 8 perros (1 de cada 2 si la colonia está a menos de 25 casillas de una zona irradiada). Andan ×1,5, tienen el 60 % de la vida de un colono y muerden ×1,2. No tienen líder: huyen al caer la mitad. No rompen muros ni puertas, no saquean y, al caer, mueren (no se capturan).
- Los números están en `src/data/creatures.json`. Lo que he puesto yo: la manada crece con la dureza (como los raids), Combate de 4 a 8, y si no queda ningún colono en pie se marchan.
- El 🚙 buggy, al atropellar a un perro, lo mata (a los saqueadores los sigue derribando).
- Modo Dios: nuevo atajo **🐕 Manada** (5 perros).
- Qué probar: en 🪄, lanzar 🐕 Manada y ver que llegan rápido, que caen antes que un saqueador y que huyen al morir la mitad; que las torretas les disparan y las puertas automáticas se cierran. En el móvil, tocar a un perro: el aviso dice su salud.
- Sin npm en el entorno: tests con Bun (372, 13 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Siguiente: el bruto mutante (desde el día 15, rompe muros y puertas) o el buggy de los saqueadores, por el orden de «Pendiente».

## 2026-10-19 (9) — Medicina cerrada, radio de llamada y buggy blindado

- Sesión larga pedida por Mikel, que me pidió tomar la decisión más lógica para cerrar la medicina. Decidido: **curarse uno mismo, opción A**; **el herido en pie, opción C**.
- **Curarse uno mismo**: tras el combate, si nadie libre puede atender a un colono que sangra y sigue en pie, se cura él mismo («🩹 Nadie puede atender a …: se cura él mismo»). Sus heridas se cierran a la mitad de velocidad y se infectan más (12 %; 4 % con 💊). El que está en el suelo no puede.
- **Guardar cama**: un colono en pie con la salud por debajo del 50 %, sin saqueadores en pie, se acuesta en la cama libre más cercana (o en el suelo si no hay) y se queda hasta el 80 %; se levanta a comer y beber y vuelve. La ficha dice «Herido, reposando en la cama».
- **Mesa de boticario** (🏗 → Talleres, 🪵15 🔩6, 2×1): 4 🌿 + 1 🧵 → 1 💊, 300 de trabajo, más rápido con buena Medicina. Nuevo cultivo **🌿 Hierba curativa** (5 días, 4–6, tierra media). El bloque 1 del catálogo queda terminado.
- **📻 Radio de llamada** (#21 C; 🏗 → Electricidad, 🔩20 ⚙️4, 100 W): con corriente, un superviviente más cada 3 días; si se queda sin corriente, el plazo empieza de nuevo.
- Lo que he puesto yo: la mesa tarda 500 en construirse y aguanta 150; la radio, 500 y 120; la hierba vale 3; trabajo de curarse solo, el mismo que si te cura otro (120).
- Qué probar: con 🪄 lanzar un raid con un solo colono y ver que se cura él mismo; dejar a uno por debajo del 50 % y ver que se acuesta. Sembrar 🌿, construir la mesa y darle una orden de 💊. Construir la radio con un generador y esperar 3 días. En el móvil, que el menú 🏗 y las fichas se lean en 380 px.
- Sin npm en el entorno: tests con Bun (359, 29 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- **🚙 Buggy blindado de los colonos** (vehículos, segunda parte; 🏗 → Vehículos, 🔩40 🔗10 ⚙️6, 2×2): al terminarlo sale a rodar. Al tocarlo se abre su panel: se elige **conductor** y **tirador** (van andando y se suben); con el panel abierto, tocar el suelo lo lleva allí (con ratón, clic derecho). Corre el doble que un colono, gasta 1 ⛽ por hora en marcha, **atropella** a los saqueadores (los derriba, no los mata), el tirador dispara desde dentro y los de dentro reciben un 40 % menos de daño. Sale sin combustible: **reposta solo** aparcado a 2 casillas o menos de un montón de ⛽. Quien va dentro se baja para comer o beber, si cae o si se le manda a pie.
- Lo que he puesto yo en el buggy: depósito de 10 ⛽, 600 de vida (aún no se usa), daño del atropello (35 % de salud), 1200 de trabajo para construirlo, repostar solo junto a un montón de ⛽. En la vista 3D todavía no se dibuja.
- Qué probar (buggy): con 🪄 dar 🔩🔗⚙️, construirlo, elegir conductor y tirador en su panel, destilar ⛽ y dejarlo al lado, llevarlo por el mapa y lanzar un raid para atropellar. En el móvil, que el panel y los desplegables se usen bien en 380 px.
- Siguiente: el buggy de los saqueadores (vehículos, tercera parte).

## 2026-10-19 (8) — Más supervivientes: el primero el día 2 y luego cada 2-4 días (#21, primera parte)

- Sin incidencias nuevas en 🐞. Lo que queda de la prioridad médica espera la respuesta de Mikel, así que esta sesión, la primera parte de **#21** (opción A).
- El primer superviviente que pide unirse puede llegar **el día 2** (antes, el 3) y luego **uno cada 2-4 días** (antes, 4-8). Si hay una oferta abierta sin responder, ese turno se salta, como antes.
- Los números están ahora en `src/data/storyteller.json`.
- En partidas guardadas, si el próximo superviviente estaba programado a más de 4 días, se adelanta a 4 días desde ahora.
- Qué probar: empezar una partida nueva y ver que el día 2 llega un superviviente; seguir jugando y ver que llegan más a menudo. Cargar una partida vieja y ver que llega uno en 4 días como mucho.
- Sin npm en el entorno: tests con Bun (330, 3 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Siguen esperando la respuesta de Mikel: cuánto peor es curarse uno mismo y cuándo se acuesta el herido que sigue en pie («Propuestas para Mikel»).
- Siguiente: la radio de llamada (#21 C).

## 2026-10-19 (7) — Al herido en el suelo se le lleva a una cama

- Sin incidencias nuevas en 🐞. Esta sesión, la segunda parte de la prioridad médica tras los combates.
- Sin saqueadores en pie, al colono que está en el suelo lo atiende el colono libre más cercano (aunque no sea médico): le cura donde está y luego **le lleva a cuestas a la cama libre más cercana** («🛏 … lleva a … a una cama»). Si ya no sangraba, va igual a llevarle. Sin cama libre, se queda curado en el suelo.
- En la cama se recupera como durmiendo (unas tres veces más rápido que tirado en el suelo). Quien va a dormir no se mete en una cama donde hay un herido. La ficha dice «Malherido, le llevan a una cama» o «recuperándose en la cama».
- Qué probar: con 🪄 lanzar un raid con una cama construida, dejar que tumben a un colono y, cuando caigan o huyan los saqueadores, ver que otro le cura y le lleva a la cama. En el móvil, que la ficha se lea bien.
- Sin npm en el entorno: tests con Bun (327, 5 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Esperan la respuesta de Mikel: cuánto peor es curarse uno mismo y cuándo se acuesta el herido que sigue en pie (opciones en «Propuestas para Mikel»).
- Siguiente: #21 A (el primer superviviente el día 2 y luego uno cada 2-4 días).

## 2026-10-19 (6) — Prioridad médica tras los combates (primera parte)

- Sin incidencias nuevas en 🐞. Esta sesión, la primera parte de la prioridad médica que pidió Mikel.
- Cuando no queda ningún saqueador en pie (todos en el suelo o huyendo), a cada colono que sangra va el colono libre más cercano, **aunque no tenga «Médico»**, y si estaba haciendo otra cosa la deja («🩹 … deja lo que hace para atender a …» en el diario). Le cura donde está.
- Los colonos heridos van antes que los saqueadores caídos y los prisioneros. No van los reclutados, los que están en el suelo, en pánico, comiendo o durmiendo. Mientras haya saqueadores en pie, todo sigue como antes (solo cura quien tiene «Médico»).
- Qué probar: con 🪄 lanzar un raid, dejar que hieran a un colono y, cuando caigan o huyan los saqueadores, ver que el colono más cercano deja lo que hace y va a curarle aunque tenga «Médico» a —.
- Sin npm en el entorno: tests con Bun (322, 6 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Espera la respuesta de Mikel: cuánto peor es curarse uno mismo (opciones en «Propuestas para Mikel»).
- Siguiente: la segunda parte (llevar al herido a su cama, o que vaya él o se tumbe en el suelo); después, #21 A.

## 2026-10-19 (5) — Cama para capturar, curar en el suelo y rematar pesa (#22, segunda parte)

- Sin incidencias nuevas en 🐞. Esta sesión, la segunda parte de **#22**, como la eligió Mikel (B y 3, y curar en el suelo).
- **Capturar pide cama**: un carcelero solo va a capturar si hay una cama de prisionero libre (y no la tiene apalabrada otro). Sin cama, en el panel del caído ⛓ sale apagado y dice «Sin cama de prisionero libre: se queda en el suelo»; en cuanto hay una, lo capturan y lo llevan a ella. El saqueador caído ya no se levanta solo.
- **Curar en el suelo**: quien tenga «Médico» va a cerrarle las heridas al saqueador que se desangra, donde está. No gasta 💊 en él (eso lo he decidido yo). El panel dice si se desangra o quién le cura.
- **Rematar pesa**: −5 % de ánimo («Remató a un saqueador») a quien remata y −3 % («Vio rematar a un saqueador») a los colonos despiertos a 8 casillas o menos; a los «duros», nada. Lo que he puesto yo: dura 24 h y las 8 casillas (en `src/data/morale.json`). Se guarda con la partida.
- Qué probar: con 🪄 lanzar un raid sin cama de prisionero, derribar a uno y ver ⛓ apagado y al médico curándolo; construir la cama y ver que lo capturan; rematar a otro y mirar el ánimo en la ficha del colono. En el móvil, que el panel se lea bien en 380 px.
- Sin npm en el entorno: tests con Bun (316, 5 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Siguiente: la prioridad médica tras los combates (primera parte, sin camas de hospital); falta decidir cuánto peor es curarse uno mismo, se propondrá.

## 2026-10-19 (4) — ⛽ Combustible y destilería

- Sin incidencias nuevas en 🐞. Mikel decidió los números del ⛽, así que esta sesión, la primera parte de los vehículos: el combustible y la destilería.
- Nuevo recurso **⛽ Combustible** (valor 6, montones de 50). Solo sale de la destilería: los barriles del mapa no dan y las caravanas no lo traen.
- **Destilería** en 🏗 → Talleres: 🔩20 ⚙️2, 2×2, se puede mover. Con una orden, un colono le lleva madera y cada tanda (10 🪵 → 2 ⛽) lleva 500 de trabajo, el doble que un cuchillo. Lo que he puesto yo: lo que tarda en construirse (700) y su aguante (300), como la recicladora; no se electrifica.
- Qué probar: construir una destilería, darle una orden «hasta tener 10 ⛽» y ver que el colono lleva madera y destila. En el móvil, que el panel del taller se toque bien.
- Sin npm en el entorno: tests con Bun (311, 3 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Mientras tanto Mikel ha decidido #21 (A y C) y la segunda parte de #22, y pidió la prioridad médica tras los combates: ya están en «Pendiente».
- Siguiente: la segunda parte de #22 (cama de prisionero para capturar, curar en el suelo, rematar baja el ánimo), que va antes en la lista.

## 2026-10-19 (3) — Heridas que se infectan y 💊 Medicina

- Sin incidencias nuevas en 🐞. Lo siguiente en «Pendiente» era el ⛽ y la destilería, pero faltan números (cuánto da un barril, qué cuesta la destilería): propuesta con opciones en «Propuestas para Mikel». Esta sesión, la primera parte del bloque 1 del catálogo (infecciones y medicinas, fase 4, la fase actual).
- Una herida que sigue abierta a las 12 h puede infectarse: 20 % sin curar, 8 % curada sin medicina, 2 % curada con medicina. Infectado: −15 % de ánimo («Herida infectada») y de velocidad de trabajo. Cada día sin su dosis empeora (aviso en pantalla); al tercero seguido, muere. Con una 💊 al día durante 2 días, se cura. La ficha dice la infección y las dosis.
- Nuevo recurso **💊 Medicina** (valor 20). El médico la usa solo: da la dosis del día a los infectados (colonos y prisioneros) y, al curar heridas, si hay 💊, gasta una y las cierra el doble de rápido.
- De dónde sale, por ahora: al saquear escombros, un 15 % de las veces 1–2 💊; y las caravanas que traen medicina, 2–8. Estos números los he puesto yo (en `src/data/medicine.json`); la mesa de boticario y la hierba curativa, la próxima parte.
- Las heridas de partidas guardadas antiguas no se infectan.
- Qué probar: con 🪄 lanzar un raid, dejar a un colono herido sin médico 12 h y ver si se infecta; con 🪄 aparecer 💊 y ver que el médico la usa.
- Sin npm en el entorno: tests con Bun (308, 8 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Esperan la respuesta de Mikel: más colonos (#21), segunda parte de #22 y ⛽ y destilería.
- Siguiente: mesa de boticario y hierba curativa (segunda parte del bloque 1).

## 2026-10-19 (2) — Derribar en vez de matar; capturar o rematar (#22, primera parte)

- Sin incidencias nuevas en 🐞. Esta sesión, la primera parte de **#22**.
- Los golpes y disparos de los colonos y de las torretas ya no matan a los saqueadores: como mucho los dejan en el suelo (con un 5 % de salud). A los colonos los golpes les siguen pudiendo matar.
- Al tocar a un saqueador en el suelo sale un panel con **⛓ Capturar** (lo de siempre: un carcelero lo lleva preso) y **🗡 Rematar** (un carcelero acaba con él; suelta lo que llevaba). Dice qué se hará y quién va a ello, o si falta un colono con «Carcelero». La orden se guarda con la partida.
- Qué probar: lanzar un ⚔️ Raid con 🪄, derribar a un saqueador, tocarlo y elegir 🗡 Rematar; con otro, ⛓ Capturar. En el móvil, que los botones del panel se toquen bien.
- Sin npm en el entorno: tests con Bun (300, 7 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Espera la respuesta de Mikel: cómo conseguir más colonos (#21) y la segunda parte de #22 (cama de prisionero para capturar, desangrarse, saquear y si rematar baja el ánimo), con opciones en «Propuestas para Mikel».
- Siguiente: el resto de «Pendiente» en su orden (combustible ⛽ y destilería; luego puentes y plataformas), y #21 y #22 en cuanto Mikel responda.

## 2026-10-19 — Llevar material a varios planos de una vez (#20)

- Sin incidencias nuevas en 🐞. Esta sesión, **#20**.
- Al ir a llevar material a un plano, el colono coge también lo que piden los otros planos que hay a 8 casillas o menos (hasta lo que puede llevar: 75 de madera, 50 de piedra…, o lo que quede en el montón) y lo reparte yendo cada vez al más cercano. Un muro de 5 tramos se abastece en un solo viaje en vez de cinco.
- Esos planos quedan apartados para que otro colono no les lleve lo mismo; si alguno ya no lo necesita (o no se llega), pasa al siguiente, y lo que sobre lo deja en el suelo y luego va al almacén. El radio de 8 casillas lo he puesto yo; se cambia en `BLUEPRINT_SHARE_RADIUS` (`src/data/work.ts`). Solo los planos; los talleres y la electrificación siguen como antes.
- Qué probar: con un solo colono, colocar una fila de muros de madera y ver que coge la madera de una vez y va dejándola tramo a tramo; con dos colonos, que no se pisan.
- Sin npm en el entorno: tests con Bun (293, 3 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Sigue esperando la respuesta de Mikel: cómo conseguir más colonos (#21).
- Siguiente: #22, derribar en vez de matar (primera parte).

## 2026-10-18 (noche, 3) — Avisos en pantalla de raids, peleas y visitas (#17, #18)

- Sin incidencias nuevas en 🐞. Esta sesión, **#17 y #18**: ahora es difícil perderse un raid o una pelea.
- Arriba, en el centro, se apilan avisos (como mucho 4) que se quedan 12 s, o 20 s los raids, los colonos caídos y las muertes; se quitan con ✕. Avisan de: ⚔️ raid, ⚔️ colono que pelea o al que ataca un saqueador, 🩸 colono herido o caído, 💀 muerte, 😱 pánico, 🚶 superviviente que pide unirse y 🐫 caravana. Al tocar uno, la cámara va adonde ha pasado (si no tiene sitio, se abre el diario).
- De peleas y heridas se avisa como mucho una vez por colono y hora de juego. Todo queda en 📜 Diario (también con «❗ Solo lo importante»), con un botón 📍 para ir al sitio. Las partidas guardadas siguen cargando.
- Qué probar: con 🪄 lanzar un ⚔️ Raid y ver el aviso; tocarlo y ver que la cámara va a los saqueadores; reclutar a un colono y mandarlo a pelear; en el móvil en vertical, que los avisos quepan y el ✕ se pueda tocar.
- Sin npm en el entorno: tests con Bun (290, 5 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Sigue esperando la respuesta de Mikel: cómo conseguir más colonos (#21).
- Siguiente: #20, llevar material a varios planos de una vez.

## 2026-10-18 (noche, 2) — Arreglado: aviso «trabaja sin tenerlo reservado» al mover muebles (#19)

- Seis incidencias nuevas en 🐞 (#17 a #22), pasadas a «Pendiente» de `FEEDBACK.md` y cerradas. Esta sesión, el bug **#19**.
- Al mover un mueble, el colono que lo llevaba al sitio nuevo y lo montaba no tenía reservado ese sitio: saltaba el aviso en 🐞 y otro colono podía ponerse a montar lo mismo. Ahora lo reserva (y si ya lo tiene otro, lo suelta y el mueble vuelve a su sitio con la orden en pie). Los avisos de «encerrado» que venían en la incidencia eran de otra partida del 2026-10-17, ya arreglados.
- Qué probar: mover una cama o el banco de trabajo con ✋ Mover y ver que no sale ningún aviso nuevo en 🐞.
- Sin npm en el entorno: tests con Bun (285, 1 nuevo); la prueba completa, en GitHub Actions.
- Pedido por Mikel en el chat: la sesión automática pasa a ser **cada dos horas** (a las :19 de las horas pares, hora de Madrid) y, tras cada subida a `main` que cambie este diario, un workflow nuevo («Resumen a Telegram») manda la última entrada a Telegram. Necesita los secretos `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en el repositorio; sin ellos no hace nada.
- Espera la respuesta de Mikel: cómo conseguir más colonos (#21), con cuatro opciones en «Propuestas para Mikel».
- Siguiente: #17 y #18, avisos en pantalla de raids, combates y visitas.

## 2026-10-18 (noche) — Sesión larga: clics, selección múltiple, zonas, mover muebles y torretas

- Sesión larga pedida por Mikel en el chat. Él eligió hacer los cinco puntos de «Pendiente» que venían ahora, el sueño con la opción A y además las torretas eléctricas.
- **Cancelar construcción**: mientras se coloca algo (o se marcan órdenes), el clic derecho quita el fantasma y sale del modo. En el móvil, el ✖ hace lo mismo.
- **Sueño (#15, A)**: se recuperan en 6 h en cama y en 8 h en el suelo (antes 7 y 10).
- **Clics y elegir varios (#16)**: en el PC, con un colono elegido, el clic izquierdo en el suelo deselecciona (y abre el panel de lo tocado) y el derecho da la orden. Arrastrar con el clic derecho elige a todos los del recuadro; de saqueadores, prisioneros y comerciantes sale un resumen (cuántos, caídos, heridos, líder, salud media). En el móvil (Mikel no eligió cómo), botón ⚒ Órdenes → **⬚ Elegir varios** y arrastrar; tocar el suelo sigue mandando a los elegidos. La ficha del grupo dice heridos y salud media.
- **Despejar zonas (#14)**: al marcar o ampliar un almacén o un huerto, lo que hay dentro que se tala, pica o saquea queda marcado; cuando la casilla queda libre (también tras el tocón o las piedras que deja), entra en la zona. Si se quita la orden o la zona, se olvida. Se guarda con la partida.
- **Mover muebles (B)**: al tocar una cama, armario, estantería, armero o lámpara sale un panel con **✋ Mover**; en los talleres sin electrificar, el botón está en su panel. Se coloca el fantasma (↻ gira) y un colono lo desmonta (un cuarto del trabajo de construirlo), lo lleva y lo monta, sin gastar nada; mientras tanto se ve su fantasma blanco en el destino. Si el destino se ocupa, vuelve a su sitio. El taller conserva su orden. La mesa de boticario aún no existe; se moverá cuando llegue.
- **Torretas** (números del bloque 5 del catálogo): en Construir → Defensa, la **ligera** (🔩25 ⚙️4, 120 W, como una pistola a 9 casillas) y la **pesada** (🔗30 ⚙️6, 2×2, 300 W, como un rifle a 14). Con corriente disparan solas al saqueador más cercano que no esté tras un muro, sin munición; se ve el trazo del disparo. Lo que no decía el catálogo y he puesto yo: apuntan como un colono con Combate 8, sus fallos no dan a los colonos y no disparan a quien huye (como los colonos). Los saqueadores aún no rompen construcciones, así que por ahora no se pueden destruir.
- Qué probar: construir un generador, cable y una torreta, y lanzar un ⚔️ Raid con 🪄; mover una cama y el banco de trabajo; marcar un almacén sobre árboles; en el PC, clic izquierdo y derecho con un colono elegido y arrastrar con el derecho; en el móvil, ⬚ Elegir varios.
- Sin npm en el entorno: tests con Bun (284, 18 nuevos) y tipos con `tsc` (sin Phaser); la prueba completa, en GitHub Actions.
- Espera la respuesta de Mikel: si las torretas pasarán a pedir investigación cuando llegue el banco (propuesta en `FEEDBACK.md`).
- Siguiente: lo que queda en «Pendiente» en su orden: combustible ⛽ y la destilería (primera parte de los vehículos) y, después, puentes y plataformas (primera parte del agua).

## 2026-10-18 (tarde, 9) — El doble de comida al empezar (#13)

- Tres incidencias nuevas en 🐞 (#14, #15, #16), pasadas a «Pendiente» de `FEEDBACK.md` y cerradas. Esta sesión, **#13** con la opción A que eligió Mikel.
- La colonia empieza con el doble de patatas que antes: **Tranquila 180, Normal 120, Dura 90, Brutal 60**. El resto de provisiones no cambia. Las partidas ya empezadas no cambian.
- Qué probar: empezar una partida nueva en Normal y ver que en el inventario hay 120 🥔; que los colonos llegan a la primera cosecha sin pasar hambre.
- Sin npm en el entorno: tests con Bun (267, 1 nuevo); la prueba completa, en GitHub Actions.
- Espera la respuesta de Mikel: cuánto deben dormir los colonos (#15), con cuatro opciones en «Propuestas para Mikel».
- Siguiente: cancelar la construcción con un clic; después, mover muebles, #14 (despejar zonas) y #16 (clics y selección múltiple).

## 2026-10-18 (tarde, 8) — Talleres: fabricar cualquier cantidad o «hasta tener» (#11)

- Sin incidencias nuevas en 🐞. Esta sesión, **#11**.
- Al tocar un taller, abajo hay dos modos: **🔨 Fabricar N** (hace exactamente esas unidades y para, aunque ya tengas de sobra; cada tanda resta lo que sale, p. ej. 5 de metal por tanda de horno) y **🎯 Hasta tener N** (lo de siempre). El número va de 1 en 1 con − y + y se puede escribir tocándolo (hasta 999). Una orden nueva empieza en «Fabricar 1», o sigue el modo y el número de la que había.
- Una orden «Fabricar» terminada ya no hace traer más material al taller. Las órdenes de partidas guardadas siguen siendo «hasta tener».
- Qué probar: en el banco de trabajo, elegir la lanza con «🔨 Fabricar 1» y ver que hace una sola; luego cambiar a «🎯 Hasta tener» y escribir un número. En el móvil, que los botones y el número quepan en vertical.
- Sin npm en el entorno: tests con Bun (266, 2 nuevos) y tipos con `tsc`; la prueba completa, en GitHub Actions.
- Mikel ha respondido en `FEEDBACK.md` a las tres propuestas: hambre del principio (#13) con el doble de comida al empezar, mover muebles con la opción B y los números del agua. Todo pasa a «Pendiente».
- Siguiente: #13, el doble de comida al empezar (es un problema que avisó con 🐞, va primero); después, cancelar la construcción con un clic.

## 2026-10-18 (tarde, 7) — Arreglado: el superviviente aceptado no aparecía (#12)

- Tres incidencias nuevas en 🐞 (#11, #12, #13), pasadas a `FEEDBACK.md` y cerradas. Esta sesión, el bug **#12**.
- La causa: los que llegan (supervivientes, raids, caravanas) buscan un borde desde el que se pueda caminar hasta la casilla de inicio de la partida. Si se ha construido algo encima de esa casilla (un muro, una cama…), no había camino desde ningún borde y el superviviente aceptado se quedaba en la esquina (0, 0) del mapa, a menudo en agua o roca, sin poder llegar a la colonia. Por lo mismo, los raids no llegaban y las caravanas no sabían adónde ir.
- Ahora todos van a la casilla libre más cercana al inicio. Si la colonia está cerrada sin ninguna entrada, el superviviente aparece junto a un colono. En las partidas guardadas, quien se quedó en la esquina aparece junto a la colonia al cargar.
- Qué probar: cargar la partida donde pasó (semilla 504451): el colono que no se veía debe estar junto a la colonia. En otra partida, construir algo en el centro del sitio de inicio y aceptar al siguiente superviviente (con 🪄 se puede hacer venir).
- Mikel ha escrito en `FEEDBACK.md` tres peticiones (cancelar la construcción con un clic, mover muebles y fuego, este último para más adelante), ha elegido las opciones del agua y ha aprobado los 12 bloques del catálogo: todo queda en «Pendiente» (el fuego, en «Aparcado»).
- Esperan su respuesta: cómo evitar el hambre del principio (#13), qué muebles se pueden mover y los números que faltan del agua.
- Sin npm en el entorno: tests con Bun (264, 3 nuevos) y tipos de `src/sim` con `tsc`; la prueba completa, en GitHub Actions.
- Siguiente: #11, fabricar cualquier cantidad y «hasta tener X».

## 2026-10-18 (tarde, 6) — Combate: posturas del reclutado

- Sin incidencias nuevas en 🐞. Último punto aprobado de las reglas de combate: las posturas, tal como las decidió Mikel.
- Con un colono (o un grupo) reclutado, bajo «🏳 Liberar» salen tres botones, también con la ficha recogida: **🛡 Mantener** (no se mueve solo ni busca cobertura; dispara o pega a lo que tenga a tiro; si se le manda a un sitio, va y sigue manteniendo allí), **🎯 Atacar a…** (después se toca a un saqueador: va solo a por él, sin hacer caso a los demás; cuando cae o huye, espera órdenes) y **🏃 Retirarse** (va a la cama o habitación más cercana y no pelea aunque le peguen). Tocar la postura activa la quita; Esc o volver a tocar «Atacar a…» cancela la elección del enemigo.
- Mandarlo a un sitio quita «Atacar» y «Retirarse»; liberarlo quita cualquier postura. Funciona también en la vista 3D.
- La postura se guarda con la partida; las partidas antiguas cargan sin postura (como hasta ahora).
- Qué probar: con 🪄, lanzar un ⚔️ Raid, reclutar a dos colonos, poner a uno en «Mantener» y al otro «Atacar a…» tocando a un saqueador lejano; probar «Retirarse» con una cama construida.
- Con esto quedan terminadas las reglas de combate. Sin npm en el entorno: tests con Bun (261, 7 nuevos) y tipos de `src/sim` con `tsc`; la prueba completa, en GitHub Actions.
- Mikel ha pedido en el chat una update grande del agua (puentes, plataformas, muelles…): queda en «Pendiente» y su propuesta con opciones, en «Propuestas para Mikel», esperando que elija.
- Siguiente: combustible ⛽ y la destilería (primera parte de los vehículos); la update del agua, en cuanto Mikel elija las opciones.

## 2026-10-18 (tarde, 5) — Partida en la nube: la misma partida en varios dispositivos

- Pedido por Mikel en el chat: un login para seguir la misma partida desde varios dispositivos. Elegido por él: **GitHub** por ahora (sencillo; quizá Firebase si escala) y **sincronización automática**.
- ☰ → **☁ Nube**: «Crear un token en GitHub» abre la página de GitHub con solo el permiso «gist» marcado; se pega el token y «Entrar». La partida se guarda en un **gist privado** del jugador, comprimida (unas diez veces menos que el JSON).
- Se sube sola **cada 2 minutos** y al salir de la pestaña o cambiar de app. Al abrir el juego o volver a la pestaña, si otro dispositivo ha subido una partida más nueva, pregunta si seguir con ella (si se cancela, se sigue con la de aquí y se sube encima). Antes de subir comprueba que no haya una más nueva de otro dispositivo, para no pisarla.
- Botones ☁ Subir, ☁ Bajar (carga la de la nube) y 🚪 Salir (olvida el token en ese dispositivo; la de la nube no se borra). La línea de estado dice la cuenta y cuándo se subió.
- Todo va por una interfaz `CloudStore` (`src/ui/cloudSave.ts`): cambiar a Firebase será escribir otra implementación.
- Qué probar: en el PC, ☰ → ☁ Nube, crear el token, pegarlo y entrar; jugar un poco y «☁ Subir». En el móvil, entrar con el mismo token: pregunta si seguir con la partida de la nube.
- Tests nuevos con un GitHub de mentira (subir, recuperar desde otro dispositivo, token malo, gist borrado). Sin npm en el entorno: tests con Bun (251); la prueba completa, en GitHub Actions.
- Siguiente: lo que quede en «Pendiente» (posturas, combustible ⛽ y la destilería) y los bloques de `docs/CATALOGO.md` que Mikel apruebe.

## 2026-10-18 (tarde, 4) — Combate: fuego amigo

- Sin incidencias nuevas en 🐞. Siguiente punto aprobado de «Pendiente»: fuego amigo y posturas; esta sesión, la primera parte (el fuego amigo), con el número que eligió Mikel.
- Cuando un disparo a distancia (arco) **falla**, si hay un colono de pie **pegado al objetivo y en la línea de tiro** (por delante o por detrás), **una de cada cuatro veces** le da a él: recibe el daño normal del arma (con su armadura) y el diario lo avisa («🎯 … falla el disparo y le da a …»). Vale para los disparos de los colonos y de los saqueadores. Cuerpo a cuerpo no hay fuego amigo.
- No cambia el guardado; las partidas antiguas no cambian.
- Qué probar: con 🪄, dar un arco y flechas a un colono, reclutarlo y lanzar un ⚔️ Raid; mandar a otro colono a pelear cuerpo a cuerpo con un saqueador que esté en la línea de tiro del arquero y mirar el diario.
- Sin npm en el entorno: tests con Bun (248) y tipos de `src/sim` con `tsc`; la prueba completa, en GitHub Actions.
- Siguiente: las posturas («Mantener posición», «Atacar a…», «Retirarse») en la ficha y en la barra del reclutado; luego combustible ⛽ y la destilería.

## 2026-10-18 (tarde, 3) — Electricidad: puerta automática

- Sin incidencias nuevas en 🐞. Última parte aprobada de la electricidad: la puerta automática, con los números de Mikel.
- 🏗 → Puertas → **Puerta automática** (🔩10 ⚙️2, 1×1, aguanta como la de chapa). Gasta **20 W** de su red (un cable debajo o pegado).
- Con corriente, **mientras dura un raid se cierra a los saqueadores**: no la cruzan, buscan otro camino y, si no lo hay, se quedan fuera; los colonos la siguen usando. Al acabar el raid (o si todos huyen) se abre. El diario lo avisa («🚪 Las puertas automáticas se cierran…»).
- Sin corriente se queda abierta, como una puerta normal. La información de la casilla dice en cuál de los casos está; en 2D lleva un piloto verde.
- No cambia el guardado (lo de cerrada se calcula solo); las partidas antiguas no cambian.
- Qué probar: con 🪄, cerrar un recinto con muros y una puerta automática, conectarla con un cable a un generador de leña y lanzar un ⚔️ Raid: los saqueadores se quedan fuera. Quitar el cable y repetir: entran.
- Con esto queda terminada la electricidad (las torretas, con la investigación).
- Sin npm en el entorno: tests con Bun (245) y tipos de `src/sim` con `tsc`; la prueba completa, en GitHub Actions.
- Siguiente, en el orden de «Pendiente»: fuego amigo y posturas; luego combustible ⛽ y la destilería, y los bloques de `docs/CATALOGO.md` que Mikel apruebe (la 3D, aparcada).

## 2026-10-18 (tarde, 2) — Contenido primero: catálogo para Mikel y 3D aparcada

- Orden de Mikel: dejar aparcada la 3D, definir e implementar primero todo el contenido y dejar abierta la puerta a otro motor con mejor 3D.
- Nuevo `docs/CATALOGO.md`: todo el contenido que falta, en 12 bloques con números (infecciones y medicinas, mutantes, banco de investigación y árbol, armas de fuego y balas, puentes, torretas, hidropónica, máquinas y drones, facciones, mercado, sucesos y, opcionales, caza, estaciones y ocio). Mikel marca ✅ los bloques que apruebe y pasan a «Pendiente».
- En `CLAUDE.md`, reglas nuevas: no se toca la 3D salvo para arreglarla; reglas solo en `src/sim`, contenido nuevo en JSON de `src/data`, dibujado por ids. La simulación ya no depende de Phaser ni de Three.js (comprobado).
- La vista 3D sigue en ☰ → 🧊 Vista 3D tal como está.
- Siguiente: lo que quedaba aprobado en «Pendiente» (puerta automática, fuego amigo y posturas, combustible y buggy) y los bloques del catálogo que Mikel apruebe.

## 2026-10-18 (tarde) — Electricidad: la luz sube el ánimo

- Sin incidencias nuevas en 🐞. Siguiente parte aprobada de la electricidad: el ánimo de la luz, con el número que eligió Mikel.
- De noche (20:00–6:00), quien **duerme o trabaja** en una casilla iluminada por una lámpara encendida tiene **+5 % de ánimo**: en la ficha sale «Habitación con luz». Se nota mientras sigue ahí; al irse, apagarse la lámpara o hacerse de día, desaparece.
- Se guarda con la partida; las partidas antiguas no cambian.
- Qué probar: con 🪄, poner un generador de leña, un cable y una lámpara junto a una cama; de noche, cuando un colono duerma en ella, tocarlo y ver «▲ Habitación con luz» en los motivos del ánimo.
- Sin npm en el entorno: tests con Bun (241) y tipos con `tsc`; la prueba completa, en GitHub Actions.
- Siguiente, en el orden de «Pendiente»: la puerta automática (🔩10 ⚙️2, se cierra ante un raid); luego fuego amigo y posturas, combustible y buggy, y el rendimiento de la 3D en móviles antiguos.

## 2026-10-18 (mediodía) — Electricidad: horno, cocina y banco con «⚡ Electrificar»

- Sin incidencias nuevas en 🐞. Siguiente parte aprobada de la electricidad, como la eligió Mikel: las máquinas eléctricas son una **mejora** de las que ya hay.
- Al tocar un horno de fundición, una cocina o un banco de trabajo sale **⚡ Electrificar · 🔩10 ⚙️3**. Los colonos (trabajo «construir») traen el material y hacen la obra; mientras, el taller no fabrica. Se puede cancelar y el material traído se deja al lado.
- Electrificado (⚡ junto al nombre), gasta **300 W** de su red: con corriente trabaja **el doble de rápido**; sin cable o si la red no da para él, a velocidad normal (nunca se para). El panel dice en cuál de los dos casos está.
- Al demolerlo se recupera también la mitad de la mejora. Se guarda con la partida; las partidas antiguas no cambian.
- Qué probar: con 🪄 dar chatarra y componentes, tocar un horno y «⚡ Electrificar»; cuando acabe, conectarlo con un cable a un generador de leña y ver en el panel «con corriente: trabaja el doble de rápido» mientras funde chatarra.
- Sin npm en el entorno: tests con Bun (240) y tipos con `tsc`; la prueba completa, en GitHub Actions.
- Siguiente, en el orden de «Pendiente»: puerta automática y ánimo de la luz; luego fuego amigo y posturas, combustible y buggy, y el rendimiento de la 3D en móviles antiguos.

## 2026-10-18 (mañana, 6) — Vista 3D: muros que se unen

- Sin incidencias nuevas en 🐞. Siguiente parte aprobada: pulir la vista 3D (pedida por Mikel).
- En 3D, los **muros ya no son cubos sueltos**: son más finos (media casilla) y se unen con los muros, puertas, portones y torres de al lado, formando tramos rectos, esquinas, cruces y uniones en T. Un muro suelto es un tramo de este a oeste.
- La textura (tablones, sillares, chapa…) sigue de una casilla a la siguiente sin cortes.
- El fantasma blanco al colocar muros también se une, con los que ya hay y con los que estás arrastrando; los planos y los muros marcados para demoler, igual.
- Todos los muros del mismo tipo se dibujan de una vez: menos trabajo para el móvil con colonias grandes (primer paso del rendimiento).
- No cambia ninguna regla del juego.
- Qué probar: pasar a 3D, arrastrar un contorno de muro de piedra (se ve el fantasma unido), dejar que lo levanten y poner una puerta en medio; mirar las esquinas girando la cámara.
- Sin npm en el entorno: tests con Bun (234); la prueba completa (con la de humo en 3D), en GitHub Actions.
- Mikel ha elegido las cuatro propuestas (pasadas a «Pendiente» de FEEDBACK): horno, cocina y banco con «⚡ Electrificar»; puerta automática 🔩10 ⚙️2 y +5 % de ánimo con luz; fuego amigo (25 % de los fallos) y posturas; vehículos con combustible ⛽ y buggy blindado.
- Siguiente, en el orden de «Pendiente»: máquinas eléctricas (Electrificar), luego puerta automática y ánimo de la luz, fuego amigo y posturas, combustible y buggy; y el rendimiento de la 3D en móviles antiguos.

## 2026-10-18 (mañana, 5) — Vista 3D: almacenes, huertos y órdenes más visibles

- Sin incidencias nuevas en 🐞. Siguiente parte aprobada: pulir la vista 3D (pedida por Mikel).
- En 3D, los **almacenes** se pintan del color de su prioridad (como en 2D) y de una pieza, con un **borde** marcado alrededor; los **huertos**, con tierra oscura y borde verde. Se ven bien desde lejos y con la cámara inclinada.
- El almacén o huerto elegido se ve más claro y con el borde más grueso, para saber cuál estás tocando.
- Las órdenes (talar, picar, construir…) y lo que se arrastra van en baldosas algo más pequeñas encima, para que no se confundan con las zonas.
- No cambia ninguna regla del juego.
- Qué probar: pasar a 3D, crear dos almacenes y cambiar la prioridad de uno (cambia de color); tocar un almacén y un huerto y ver que se resaltan; arrastrar una orden de talar encima de un almacén.
- Sin npm en el entorno: tests con Bun (229) y `tsc`; la prueba completa (con la de humo en 3D), en GitHub Actions.
- Siguiente: más pulido de la 3D (muros que se unan, rendimiento en móviles antiguos). Siguen esperando respuesta de Mikel: horno, cocina y banco eléctricos; puerta automática y ánimo de la luz; fuego amigo y posturas; vehículos.

## 2026-10-18 (mañana, 4) — Vista 3D: barras de progreso y de salud

- Sin incidencias nuevas en 🐞. Siguiente parte aprobada: pulir la vista 3D (pedida por Mikel) antes de que sea la vista por defecto.
- En 3D ya se ven, como en 2D: la **barra de progreso** sobre lo que se está talando, picando, construyendo o cosechando (del color de la orden), y la **barra de salud** sobre quien está herido, colonos y saqueadores (verde, amarilla o roja; más baja si está en el suelo). Siempre miran a la cámara y se ven por encima de muros y árboles.
- No cambia ninguna regla del juego.
- Qué probar: pasar a 3D, mandar talar unos árboles y levantar un muro, y ver cómo se llenan las barras al girar la cámara; en el modo Dios 🪄, herir a un colono y lanzar un ⚔️ Raid.
- Sin npm en el entorno: tipos con `tsc`; la prueba completa (con la de humo en 3D), en GitHub Actions.
- Siguiente: más pulido de la 3D (marcas de zona, muros que se unan, rendimiento). Siguen esperando respuesta de Mikel: horno, cocina y banco eléctricos; puerta automática y ánimo de la luz; fuego amigo y posturas; vehículos.

## 2026-10-18 (mañana, 3) — Paneles de almacén, huerto y taller rehechos

- Última parte de «Menús de la partida más accesibles» (aprobado por Mikel): con esto quedan rehechos todos los menús de la partida.
- Los tres paneles pasan a ser hojas como la ficha del colono: en el móvil en vertical, a todo lo ancho encima de la fila de colonos (como mucho el 45 % de la pantalla); en horizontal, una columna a la izquierda; en PC, abajo a la izquierda. ▾ los recoge (solo queda el nombre, para ver el mapa) y ✕ o Esc los cierra.
- **Almacén**: la prioridad en cuatro botones grandes en fila; el filtro, una baldosa por recurso (encendida o apagada) con «☑ Todo» y «☐ Nada»; abajo, lo que hay guardado ahora y cuántas casillas están ocupadas (se actualiza solo).
- **Huerto**: cuántas casillas hay sin sembrar, creciendo y maduras; los cultivos en tarjetas con días, cosecha y descripción, y «✔ Plantando» en el elegido.
- **Taller**: recetas en tarjetas («✔ En marcha» en la elegida y «falta material» si no hay con qué); −5, el objetivo, +5 y Pausar quedan fijos abajo, siempre a la vista.
- Borrar un almacén o un huerto pide un segundo toque.
- No cambia ninguna regla del juego.
- Qué probar: en el móvil en vertical, tocar un almacén y quitar y poner recursos, «Nada» y «Todo», y cambiar la prioridad; tocar un huerto y cambiar de cultivo; tocar un banco o un horno, elegir una receta y subir el objetivo. Recoger con ▾ y girar el móvil a horizontal.
- Sin npm en el entorno: tests con Bun (229) y tipos con `tsc`; maquetas de las hojas en 380×740, 780×360 y PC. La prueba completa, en GitHub Actions.
- Siguiente: nada aprobado sin decidir. Esperan respuesta de Mikel: horno, cocina y banco eléctricos; puerta automática y ánimo de la luz; fuego amigo y posturas. Nueva propuesta: vehículos de asedio y de combate (ariete, buggy con combustible…).

## 2026-10-18 (mañana, 2) — Ficha del colono rehecha

- Siguiente parte de «Menús de la partida más accesibles» (aprobado por Mikel). La ficha del colono pasa a ser una hoja como las de 📜 y ☰: en el móvil en vertical ocupa todo el ancho encima de la fila de colonos (como mucho el 40 % de la pantalla, para que se vea el mapa); en horizontal es una columna a la izquierda; en PC, abajo a la izquierda.
- Arriba, siempre a la vista: nombre, edad, qué está haciendo, sus heridas y un botón grande 🎖 Reclutar. ▾ recoge la ficha (solo queda eso, para ver el mapa) y ✕ la cierra.
- Cuatro pestañas grandes (se recuerda la última): **Estado** (comida, agua, descanso y ánimo, con los motivos del ánimo uno por línea en verde o rojo), **Equipo** (arma y armadura, cada una en su tarjeta con selector grande), **Trabajos** (botones de prioridad de 40 px) y **Perfil** (rasgos: tocar uno muestra qué hace, también en el móvil; habilidades con 🔥 pasión y • interés).
- Con un grupo elegido solo se ve qué hace cada uno y el botón de reclutar.
- No cambia ninguna regla del juego.
- Qué probar: en el móvil en vertical, tocar un colono, pasar por las cuatro pestañas, cambiar una prioridad y el arma, recoger con ▾ y mandarlo a algún sitio tocando el suelo. Girar el móvil a horizontal.
- Siguiente: los paneles de almacén, huerto y taller (última parte de los menús). Siguen esperando respuesta de Mikel: horno, cocina y banco eléctricos; puerta automática y ánimo de la luz; fuego amigo y posturas.

## 2026-10-18 (madrugada, 2) — Menú 📜 Colonia rehecho

- Siguiente parte de «Menús de la partida más accesibles» (aprobado por Mikel). El 📜 pasa a ser una hoja como la de ☰: en el móvil en vertical sale desde abajo, en horizontal es una columna a la derecha, y en PC queda a la derecha. ✕ grande para cerrar (también Esc) y el botón 📜 se ve encendido mientras está abierta; al abrirla se cierra ☰ y al revés.
- Pestañas grandes (Diario, Prisioneros, Comercio) con un globo: cuántos prisioneros hay y «!» si hay caravana.
- **Diario**: agrupado por días («Hoy · día N»), con la hora de cada suceso y un filtro «❗ Solo lo importante» (lo bueno y lo malo). El cementerio va plegado al final.
- **Prisioneros**: botones grandes Retener, Convencer y Liberar con su explicación debajo.
- **Comercio**: una tarjeta por recurso con «Comprar» y «Vender» y botones − y + de 40 px; el saldo, ↺ (vaciar el trato) y 🤝 Cerrar trato quedan fijos abajo, siempre a la vista.
- No cambia ninguna regla del juego.
- Qué probar: en el móvil en vertical, abrir 📜 con una caravana y un prisionero (modo Dios 🪄); comprar y vender con − y +, y ver que el saldo y el botón no se van al bajar la lista. En el diario, probar el filtro.
- Siguiente: la ficha del colono (siguiente parte de los menús). Siguen esperando respuesta de Mikel: horno, cocina y banco eléctricos; puerta automática y ánimo de la luz; fuego amigo y posturas.

## 2026-10-18 (noche) — Pánico de los colonos

- Segunda parte de la moral y huida, con los números aprobados por Mikel.
- Un colono puede **entrar en pánico** (20 %) si le hieren con el ánimo por debajo del 15 %, o si ve caer a un compañero a 5 casillas o menos. Los reclutados, solo con el ánimo por debajo del 5 %; los «duros», nunca; los «pesimistas», el doble (40 %).
- En pánico suelta lo que hace y corre a la cama más cercana (o, si no llega a ninguna, a la habitación más cercana); si no hay, se queda encogido donde está. Dura 1 h: mientras, no trabaja, no pelea y no obedece órdenes. En el diario: «😱 … entra en pánico» y «… se calma»; en su ficha, «😱 En pánico».
- Se guarda con la partida (las antiguas cargan sin nadie en pánico). Tests en `tests/panic.test.ts`.
- Qué probar: en el modo Dios 🪄 → ⚔️ Raid con dos o tres colonos juntos; cuando caiga uno, mirar el diario y ver si otro sale corriendo a una cama. Probar también con un colono hambriento y sediento que reciba golpes.
- Siguiente: fuego amigo y posturas (última regla de combate; hay que proponerle a Mikel cómo funcionan). Siguen esperando respuesta: horno, cocina y banco eléctricos, y la puerta automática y el ánimo de la luz.

## 2026-10-18 (tarde) — Moral de los raids: líder ★ y huida en grupo

- Tercera regla de combate (moral y huida), primera parte, con los números aprobados por Mikel.
- Cada raid tiene un **líder**: el saqueador de más Combate, con una estrella dorada sobre la cabeza (2D y 3D). El diario lo dice al llegar («con X ★ al frente») y al tocarlo sale «líder del raid ★».
- **Huyen todos** los que quedan en pie si cae el líder o la mitad del grupo (en el suelo, muertos o capturados; los que ya se han escapado no cuentan): «🏳 … los saqueadores huyen». Uno solo sigue huyendo por debajo del 45 % de salud, como antes.
- Se guarda con la partida (los raids de partidas antiguas siguen sin líder). Tests en `tests/people.test.ts`.
- Qué probar: en el modo Dios 🪄 → ⚔️ Raid; buscar al de la estrella, tumbarlo con los reclutados y ver que el resto sale corriendo. En otro raid, tumbar a la mitad sin tocar al líder.
- Siguiente: pánico de los colonos (segunda parte de la moral). Esperan respuesta de Mikel: horno, cocina y banco eléctricos, y el coste de la puerta automática y el ánimo de la luz (propuestas en `FEEDBACK.md`).

## 2026-10-18 (mañana) — Electricidad: la recicladora y la depuradora piden corriente

- Como aprobó Mikel, la **recicladora** gasta 250 W y la **depuradora** 150 W, también en las partidas guardadas.
- Sin corriente, la recicladora está parada: nadie la trabaja y, si se va la luz a media tanda, el colono la deja. La depuradora sin corriente no limpia el agua (el pozo sigue sin necesitarla).
- Al tocarlas se ve «en marcha» o «sin corriente: parada» y su red.
- Tests en `tests/power.test.ts`.
- Qué probar: en una partida guardada con depuradora, ver que deja de dar agua limpia; llevarle un cable desde un generador o una placa y comprobar que vuelve. Lo mismo con la recicladora y su orden.
- Siguiente: horno, cocina y banco eléctricos (el doble de rápidos, 300 W). Falta que Mikel diga cuánto cuestan (propuesta en `FEEDBACK.md`).

## 2026-10-18 (madrugada) — Electricidad: placas solares y molinos de viento

- Segunda parte de la electricidad, con los números aprobados por Mikel. En 🏗 → **Electricidad**:
  - **Placa solar** (🔩15 ⚙️3, 2×2): 600 W de 6:00 a 20:00; de noche, nada.
  - **Molino de viento** (🪵20 🔩10 ⚙️2, 1×1): de 0 a 900 W según el viento. Necesita libres las 8 casillas de alrededor (sin construcciones ni árboles, rocas u otros objetos; los cables y los suelos no molestan): si no, no gira.
- El viento sube y baja despacio a lo largo de los días, con rachas de unas horas; sale de la semilla del mapa, así que no cambia nada en las partidas guardadas.
- Al tocar una placa se ve lo que produce o «de noche no produce»; al tocar un molino, sus vatios y el viento en %, o «tapado» si tiene algo alrededor.
- Tests en `tests/power.test.ts`.
- Qué probar: una placa solar y un molino en campo abierto conectados por cable a una batería y unas lámparas; ver que la batería se carga de día y que el molino cambia de vatios con el viento.
- Siguiente: máquinas eléctricas (horno, cocina y banco el doble de rápidos) y que la recicladora y la depuradora pasen a pedir corriente.

## 2026-10-17 (noche, 17) — Arreglo: la 3D no abría tras publicar una versión nueva (#10)

- Bug del botón 🐞 (#10): «Failed to fetch dynamically imported module …/View3D-….js». La vista 3D se descarga aparte al abrirla; si se publica una versión nueva con la página abierta, el archivo viejo desaparece y falla.
- Ahora, si pasa eso, se guarda la partida, la página se recarga sola con la versión nueva y se vuelve a abrir la 3D, sin pasar por el menú de inicio («🔄 Versión nueva cargada: sigues donde estabas»). Si vuelve a fallar en menos de un minuto (sin conexión), no recarga otra vez y avisa de que compruebes la conexión. Ya no culpa a la aceleración por hardware de este error.
- Qué probar: tener el juego abierto en 2D, esperar a que se publique una versión nueva y pulsar «3D»: debe recargar y seguir en 3D con la partida donde estaba.
- Siguiente: placas solares, molino y máquinas eléctricas (segunda parte de la electricidad).

## 2026-10-17 (noche, 16) — Electricidad (primera parte)

- Con los números aprobados por Mikel. Nueva pestaña 🏗 → **Electricidad**:
  - **Cable** (🔩1): va en su propia capa, por debajo de suelos, muros y máquinas, y también por las pendientes. Los cables que se tocan forman una red.
  - **Generador de leña** (🔩20 ⚙️2, 2×2): 1 000 W mientras le quede leña; gasta 1 de madera cada 2 h y caben 10. Cuando le queda menos de la mitad, quien tenga «Transportar» le lleva madera.
  - **Batería** (🔩10 ⚙️2): guarda hasta 6 000 Wh de lo que sobra y lo da cuando falta.
  - **Lámpara** (50 W; coste provisional 🔩3 ⚙️1, no estaba en la tabla): ilumina 3 casillas alrededor.
- Una máquina se conecta con un cable debajo o pegado. Si no llega la corriente para todo, se apaga primero lo último que se conectó.
- **Luz**: de 20:00 a 6:00, sin luz se trabaja un 20 % más despacio; junto a una lámpara encendida, normal.
- Al tocar una casilla se ve el estado: en marcha o sin leña, encendida o sin corriente, carga de la batería y lo que produce y gasta su red.
- Se guardan la carga de las baterías y la leña de los generadores. Tests en `tests/power.test.ts`.
- Qué probar: un generador, una fila de cables hasta un cuarto con dos lámparas y una batería; mirar de noche que se trabaja normal junto a las lámparas y ver cómo se descarga la batería cuando se acaba la leña.
- Siguiente: placas solares, molino y máquinas eléctricas (con recicladora y depuradora pasando a pedir corriente).

## 2026-10-17 (noche, 15) — Armadura

- Segunda regla de combate, con los números aprobados por Mikel. En el banco de trabajo: chaleco de cuero (🧵8, −15 % de daño), de chapa (🔩12, −25 %, −5 % al andar), de metal (🔗8 ⚙️1, −35 %, −10 % al andar), casco de chapa (🔩6, −10 %) y de metal (🔗4, −15 %). Lo que quitan se suma.
- Cada colono se pone solo el chaleco y el casco libres que más protegen (deja los suyos en su lugar). En la ficha se ve lo que lleva y cuánto daño quita, con un selector: «la mejor libre» o «sin armadura».
- Los saqueadores llegan con chaleco de cuero o de chapa desde el día 10 y lo sueltan al caer.
- Se guarda con la partida. Tests en `tests/weapons.test.ts`.
- Decidido con Mikel: los números de la **electricidad** (en `FEEDBACK.md`); la recicladora y la depuradora pasarán a necesitar corriente.
- Qué probar: fabricar un chaleco y un casco en el banco y ver que un colono se los pone; mirar su ficha.
- Siguiente: moral y huida (con sus números para Mikel); la electricidad, en cuanto se decida el orden.

## 2026-10-17 (noche, 14) — Cobertura y alcance

- Primera regla de combate aprobada por Mikel. Al disparar con arco cuenta lo que hay pegado al objetivo en dirección al tirador: un muro, puerta, portón, muro derruido o roca impide el disparo; una barricada o una roca grande quitan un 50 % de acierto; un árbol, coche, chatarra, barril o neumáticos, un 30 %; estar dentro de una zanja, otro 25 %. El acierto baja un 6 % por casilla.
- **Torres de vigía**: disparando desde una, +2 casillas de alcance y +15 % de acierto.
- **Arqueros reclutados**: si están al descubierto, cada segundo miran si a 3 casillas o menos hay un sitio con cobertura desde el que sigan llegando al enemigo y van allí sin dejar de disparar.
- La lanza (alcance 2) no atraviesa muros. Los saqueadores siguen las mismas reglas.
- Tests en `tests/weapons.test.ts`.
- Qué probar: poner barricadas, subir a un arquero a una torre y esperar un raid; ver que los saqueadores con arco no aciertan a quien está tras una barricada tanto como al descubierto.
- Siguiente: armadura (con sus números para Mikel); después, la electricidad.

## 2026-10-17 (noche, 13) — Armero; decididas la cobertura y la electricidad

- **Armero** (🏗 → Muebles, 2×1, 🪵15 🔩8; Mikel lo prefirió libre y de 2×1): se pone dentro de un almacén y guarda solo armas y munición (30 armas o 300 flechas por casilla). Lo que no es arma no cabe: al terminarlo, lo que hubiera encima sale a un lado. Con esto queda hecho el mobiliario de almacén de la fase 3.
- Decidido con Mikel: los números de **cobertura y alcance** (en `FEEDBACK.md`) y la **electricidad** con cables, generadores (leña, solar, viento), baterías, lámparas, máquinas eléctricas y puertas automáticas. Los números de la electricidad se le propondrán antes de hacerla.
- Qué probar: un armero dentro de un almacén; ver que los colonos llevan ahí las armas y no otra cosa.
- Siguiente: cobertura y alcance; después, los números de la electricidad.

## 2026-10-17 (noche, 12) — Armas (primera parte)

- Decidido con Mikel: los colonos cogen solos la mejor arma libre y en la ficha se les puede fijar una o dejarlos sin arma; flechas para el arco y balas para las de fuego; las de fuego, con la investigación (fase 5); saqueadores armados según el día.
- **Armas nuevas** (🏗 → Talleres → banco de trabajo → elegir receta): palo (🪵4, ×1,4), cuchillo (🔩6, ×1,8, rápido), tubería (🔩8, ×2,2, lenta), lanza (🪵6 🔩3, ×2, pega desde 2 casillas), machete (🔗5, ×2,8), arco (🪵8 🧵4, ×1,6, lento, dispara a 8 casillas) y flechas (🪵2 🧵1 → 10). Se guardan en el almacén como cualquier recurso.
- **Equiparse**: entre trabajo y trabajo, cada colono va a por la mejor arma libre (deja la suya en su lugar); quien lleva arco coge hasta 20 flechas y vuelve a por más cuando le quedan menos de 5. Sin flechas, pelea con los puños. En la ficha: qué arma lleva y un selector (la mejor libre, sin arma o una concreta).
- **Combate**: el daño y el tiempo entre golpes dependen del arma; la lanza alcanza 2 casillas; con arco se dispara desde lejos y se acierta menos cuanto más lejos (cada disparo gasta una flecha). Reclutados, se acercan hasta tener al enemigo a su alcance.
- **Saqueadores**: palos y cuchillos hasta el día 8; tuberías y lanzas después; arcos desde el día 12. Al caer sueltan el arma y sus flechas.
- Se guarda con la partida (las antiguas empiezan sin armas y en «la mejor libre»). Tests en `tests/weapons.test.ts`.
- Qué probar: con 🪄 dejar un machete y un arco con flechas junto a los colonos y ver que se los quedan; fijar «Sin arma» en la ficha; esperar un raid y ver cómo pelean.
- Siguiente: armeros de pared, y después las reglas de combate (cobertura y alcance primero).

## 2026-10-17 (noche, 11) — #9: nadie se queda encerrado; la 3D no se cuelga sin memoria

- **#9** (🐞 de Mikel): Óscar volvió a quedarse encerrado en una casilla (semilla 785971, día 6) y la 3D falló en el móvil por falta de memoria gráfica.
- Encerrados: no se puede reproducir sin la partida; el terreno (rebajar, elevar, zanjas) no encierra (comprobado). Arreglo general: cada 10 minutos de juego, quien solo llegue a menos de 30 casillas sale a la casilla más cercana (hasta 8 de distancia) desde la que se llega lejos; se apunta en el diario y en los errores de 🐞 con lo que lo rodeaba (árbol, muro, roca…), para dar con la causa si vuelve a pasar. Tests en `tests/trapped.test.ts`.
- 3D: si el navegador quita el contexto gráfico, se vuelve a la 2D con un aviso y la próxima vez se crea de nuevo; en pantallas pequeñas se dibuja a 1,5× en lugar de 2×.
- Qué probar: seguir la partida de Óscar; si vuelve a pasar, el aviso de 🐞 dirá qué lo encerraba.
- Siguiente: armas (primera parte), tras confirmar con Mikel los detalles.

## 2026-10-17 (noche, 10) — Construir con el dedo: ver antes de colocar; nueva forma de trabajar

- **Bug** (Mikel): en el móvil, al tocar se colocaba la construcción sin verla antes. Ahora, con el dedo, tocar o arrastrar deja el fantasma blanco (verde/rojo si es grande) y en la barra de 🏗 salen **✔ Colocar** y **✖**. Antes de confirmar se puede girar (↻) o tocar en otro sitio para moverlo. Igual en la vista 3D. Con ratón sigue como antes.
- **Nueva forma de trabajar** (orden de Mikel): todo lo nuevo lo aprueba él. Las sesiones solo hacen bugs y lo que está en «Pendiente» de `FEEDBACK.md`; lo demás lo proponen en «Propuestas para Mikel» y le avisan. Actualizados `CLAUDE.md` y la tarea programada.
- Aprobado por Mikel y en cola: **armas** (cuerpo a cuerpo y a distancia con munición, fabricadas en el banco), **reglas de combate** (cobertura y alcance, armadura, moral y huida, fuego amigo y posturas) y **vehículos** de asedio y combate (de colonos y asaltantes; antes hay que proponerle cómo funcionan).
- Qué probar: en el móvil, 🏗 → Muebles → Cama, tocar el suelo, girarla y pulsar ✔ Colocar.
- Siguiente: armas, primera parte (definiciones, fabricación en el banco, equipar la mejor y combate cuerpo a cuerpo con arma).

## 2026-10-17 (noche, 9) — Construir y Órdenes, más claros y cómodos en el móvil

- Segunda parte de rehacer los menús de la partida (Mikel): **🏗 Construir** y **⚒ Órdenes**.
- **Construir**: pestañas por tipo (muros, puertas, portones, torres, suelos, defensas, muebles, talleres, agua) que se deslizan con el dedo; cada construcción es una tarjeta con su nombre, tamaño y coste. Arriba, siempre a mano: ↻ Girar, Contorno/Relleno y ⛏ Demoler.
- **Órdenes**: botones grandes con icono en tres apartados (Recoger, Zonas, Terreno); lo marcado para talar, picar o saquear se ve en un numerito.
- Las dos hojas tienen cabecera con lo elegido y ✕. **En el móvil** (vertical u horizontal), al elegir algo la hoja se recoge en una barra con lo elegido (y Girar/Contorno/Demoler al construir) para dejar libre el mapa; ▴ o tocar la barra la abre otra vez. En vertical sale desde abajo; en horizontal, a la derecha. El aviso de qué hacer pasa arriba para no chocar con la barra.
- La prueba automática elige la pestaña antes de la cama y el muro.
- Qué probar: en el móvil, 🏗 → Muebles → Cama, colocarla con la barra recogida y girarla; ⚒ → Talar y arrastrar.
- Siguiente: 📜 (diario, prisioneros, comercio) y la ficha del colono con el mismo estilo; después los paneles de almacén, huerto y taller.

## 2026-10-17 (noche, 8) — Menú ☰ más claro y cómodo en el móvil

- Primera parte de rehacer los menús de la partida (Mikel): el **menú ☰**.
- Cabecera con ✕ para cerrar (también Esc) y la semilla del mapa; botones grandes con icono en dos apartados: **Partida** (Guardar, Exportar, Importar, Anterior) y **Vista y más** (Vista 3D/2D, Progreso, Inicio, Mapa nuevo). La ayuda larga va recogida en «❓ Cómo se juega», ordenada por temas (cámara, colonos, órdenes, construir, almacenes, 3D, PC).
- **Móvil en vertical**: el menú sale desde abajo, a todo lo ancho, al alcance del pulgar. **Móvil en horizontal**: columna a la derecha de toda la altura. El botón ☰ se ve encendido mientras está abierto.
- Comprobado con capturas en 380×740, 780×360 y PC; tests con Bun (189) y tipos con `tsc`; la prueba completa, en GitHub Actions.
- Qué probar: abrir ☰ con el móvil en vertical y en horizontal, guardar y pasar a 3D desde ahí.
- Siguiente: los paneles 🏗 Construir y ⚒ Órdenes con el mismo estilo (pestañas por categoría y hoja inferior en el móvil).

## 2026-10-17 (noche, 7) — Dificultad al empezar y nuevo menú de inicio

- Sin incidencias nuevas en 🐞. Tarea de la fase 4: **dificultad configurable**.
- En ✚ Nueva partida: **Tranquila, Normal, Dura o Brutal** y **días sin raids** al empezar (de 0 a 20; cada dureza propone los suyos: 8, 5, 4 y 3). La dureza cambia el tamaño de los raids (×0,6 a ×2), los días entre ellos, lo fuerte que pegan los saqueadores (×0,7 a ×1,5) y las provisiones iniciales (×1,5 a ×0,5). Se guarda con la partida (las antiguas cargan en Normal). Tests en `tests/difficulty.test.ts`.
- **Nuevo menú de inicio** (Mikel, a mitad de sesión): botón grande de Continuar con el día, los colonos y la dureza de la partida; cuatro botones grandes (Nueva partida, Cargar, Modo Dios, Progreso); la nueva partida va por apartados, con 🎲 para una semilla al azar y la dureza en botones. En el móvil en horizontal el título va a la izquierda y las opciones a la derecha, sin tener que desplazarse.
- Sin npm en el entorno: tests con Bun (189) y tipos con `tsc`; capturas del menú en 380×740, 780×360 y PC. La prueba completa, en GitHub Actions.
- Qué probar: empezar una partida Brutal con 0 días sin raids y ver llegar el primer raid enseguida; abrir el menú con el móvil girado.
- Siguiente: rehacer los menús de dentro de la partida (☰, construir, órdenes, fichas) para móvil vertical y horizontal; después infecciones y mutantes.

## 2026-10-17 (noche, 6) — Menú principal y modo Dios

- **Menú principal** (Mikel): sale al abrir el juego, con la partida en pausa detrás, y desde ☰ → 🏠 Menú principal. Continuar, Nueva partida (semilla con número o palabra, de 1 a 6 colonos, con o sin raids, caravanas y supervivientes, y modo Dios), cargar una partida desde archivo y ver el progreso del desarrollo.
- **Modo Dios 🪄** (se activa en el menú principal; aparece un botón 🪄 junto al de 3D). Tocando el mapa: dejar recursos (10, 50 o 200 de cualquiera), hacer aparecer un colono, un saqueador, un prisionero o un comerciante, herir, matar o despejar una casilla. Al momento: raid, caravana, superviviente, terminar todas las obras, curar y saciar a todos, madurar los cultivos, avanzar 1 h, 6 h o un día, y activar o quitar los sucesos y las necesidades. Funciona en 2D y en 3D.
- Qué probar: activar el modo Dios, dejar materiales, poner a un saqueador junto a un colono reclutado y ver cómo pelean; capturarlo y convencerlo avanzando el tiempo.

## 2026-10-17 (noche, 5) — Cocina

- Sin incidencias nuevas en 🐞. La vista 3D se pule en paralelo; esta sesión toma la siguiente tarea de la fase 4, la cocina.
- **Cocina** (🏗 → Talleres, 2×1; 🪨15 🔩8 🪵5): al tocarla se elige qué guisar y hasta cuántas raciones: guiso de patatas (🥔5 → 🍲2), tortas de maíz (🌽5 → 🍲2) o setas asadas (🍄6 → 🍲2). Trabajo nuevo **Cocinar** en las prioridades de la ficha, que usa la habilidad Cocina.
- **Comida cocinada** 🍲: una ración alimenta como 3,5 patatas, así que cocinar estira la cosecha un 40 %. Los colonos la prefieren (andan hasta 25 casillas de más por ella) y les sube el ánimo («Comió caliente»); si comen crudo, baja un poco («Comió crudo»). Los carceleros dan a los prisioneros solo lo que necesitan.
- Se guarda con la partida (las antiguas empiezan sin comida anotada). Tests nuevos en `tests/cooking.test.ts`.
- Sin npm en el entorno: tests con Bun (179) y tipos con `tsc`; la prueba completa, en GitHub Actions.
- Qué probar: construir una cocina junto al almacén, ponerle «Guiso de patatas» y ver que los colonos cocinan y luego comen 🍲.
- Siguiente: dificultad configurable al empezar (días sin raids, dureza); después infecciones y mutantes.

## 2026-10-17 (noche, 4) — Vista 3D más bonita

- Mikel: «al mover a 3D se ve así de feo». Cambios:
- **Suelo con textura** pixel art vista desde arriba (granulado, guijarros, matas, arena con ondas, losas con juntas, vetas en la roca) y bordes entre suelos irregulares, en lugar de bloques de un solo color.
- **Taludes** de tierra, arena o roca con estratos donde una casilla está más alta que la de al lado.
- **Agua** translúcida con brillos del sol.
- **Muros y muebles con su material**: tablones de madera, sillares de piedra, chapa remendada con óxido, metal ondulado, bloques de hormigón; las camas se ven con su manta y su almohada.
- **Sombras del sol**, tonos más naturales, niebla en la distancia y noches con luz de luna (se ve menos, pero se ve). Los árboles, rocas y ruinas ya no salen negros a contraluz.
- Qué probar: pasar a 3D con el fuerte de muros de madera y girar la cámara; mirar también de noche.

## 2026-10-17 (noche, 3) — Gente: raids, prisioneros, comercio y muerte

- **Salud**: cada persona tiene salud y heridas en partes del cuerpo; las heridas sangran hasta que las cura alguien con la tarea nueva **Curar** (usa Medicina). Malherido, cae al suelo y no se mueve hasta recuperarse. Sin comer (unos 2 días) o sin beber (1 día) se muere. Si mueren todos, se acaba la partida (con cementerio y botón para empezar otra).
- **Raids**: desde el día 5 llegan saqueadores por el borde, más cuanto más rica es la colonia. Pelean cuerpo a cuerpo; los colonos devuelven los golpes y, reclutados (🎖), van a por los que estén cerca. Heridos, huyen. Barra de salud sobre quien esté herido.
- **Prisioneros**: los saqueadores caídos los captura quien tenga la tarea nueva **Carcelero** (usa Trato, habilidad nueva) y los lleva a una **cama de prisionero** (🏗 → Muebles) si la hay. En 📜 → Prisioneros: Retener, Convencer (charla cada 6 h; baja su resistencia y al final se une) o Liberar. El carcelero les da comida y agua.
- **Supervivientes**: de vez en cuando alguien pide unirse: aceptar o rechazar.
- **Caravanas**: llega un comerciante con recursos y a veces esclavos. Tocarlo (o 📜 → Comercio) abre el trueque: comprar y vender por valor, comprar esclavos (pasan a ser prisioneros para convencer) y vender prisioneros.
- **📜 Diario**: lo que pasa queda apuntado y se avisa en pantalla. Todo se guarda con la partida.
- **3D**: botón «3D» junto a los giros de la vista y el botón central del ratón en 2D pasa a la vista 3D.
- Qué probar: esperar al día 5 (o jugar rápido) para el primer raid; reclutar a los colonos; capturar a un saqueador caído y convencerlo; comerciar con la caravana del día 4.
- Siguiente: cocina, dificultad al empezar, armas y combate a distancia.

## 2026-10-17 (noche, 2) — Sed y agua; construir sobre suelos

- **Construir sobre suelos** (Mikel: no dejaba construir sobre losas de piedra): los suelos son una capa aparte. Encima se puede poner cualquier construcción salvo las de agua; la construcción manda en el paso y, al demolerla, vuelve el suelo. Los huertos no van sobre suelo. Cada trabajo sabe ya a qué construcción va (por su identificador), aunque haya un suelo y un muro en la misma casilla.
- **Sed** (fase 4): nuevo indicador «Agua» en la ficha. Con sed, el colono va a beber al sitio más cercano con agua limpia: un río o lago sin contaminar, un manantial, un pozo o una depuradora; si solo encuentra agua contaminada, la bebe, pero le sienta mal (ánimo −12 durante un día). Sediento y deshidratado bajan el ánimo. Con esto quedan hechas las necesidades de la fase 4 (hambre, sed, sueño y ánimo) y la tarea del agua de la fase 2.
- **Construcciones de agua** (🏗 → Agua): pozo (🪨20 🪵5; agua limpia en cualquier sitio) y depuradora (🔩15 ⚙️2; hay que ponerla junto al agua y la limpia).
- Qué probar: un mapa con el agua lejos o contaminada; construir un pozo junto al campamento; poner un muro y una cama encima de un suelo de losas.
- Siguiente: muerte por hambre o sed (fin de la partida si mueren todos), salud y heridas, y después los raids.

## 2026-10-17 (noche) — Vista 3D en pruebas

- Primer paso de la vista libre que pidió Mikel: ☰ → 🧊 Vista 3D (en pruebas), hecha con Three.js (`src/render3d/`). El mismo mundo, ahora en 3D: terreno en bloques con sus alturas, árboles, rocas y demás de pie (siempre mirando a la cámara), construcciones como bloques de su material (de varias casillas, translúcidas y azuladas si son planos, rojizas si se van a demoler), montones, plantas, colonos (tumbados si duermen, con banderín si están reclutados), almacenes, huertos y órdenes marcados en el suelo, y luz de día y de noche.
- Cámara libre: **botón central del ratón** (o Alt + arrastrar) para pivotar a cualquier ángulo e inclinación; arrastrar (izquierdo o derecho) o WASD para moverse; rueda para el zoom; Q/E giran, R/F inclinan. En el móvil: un dedo mueve, dos dedos hacen zoom, giran (girando los dedos) e inclinan (subiéndolos o bajándolos a la vez). Los botones ⟲ ⟳ giran 45° y ∠ inclina.
- Se juega igual que en 2D: tocar colonos, mandarlos, órdenes concretas, arrastrar áreas de órdenes, almacenes, huertos y construcción (con la vista previa en el suelo), paneles de almacén, huerto y taller. La vista 2D sigue ahí (☰ → Volver a la vista 2D) y el juego recuerda cuál se usó.
- Prueba de humo nueva en GitHub Actions: abre el juego en Chromium sin pantalla, en PC y en móvil, pasa por 2D y 3D, pivota con el botón central y falla si hay algún error; guarda capturas.
- Al construir se ve en blanco translúcido lo que se va a poner (cama, muro, pinchos…), bajo el ratón o en todo el área que se arrastra, en 2D y en 3D. R (o X, o ↻) gira lo que se va a construir; las puertas giradas se cruzan de este a oeste.
- Pendiente de la 3D: barras de progreso, marcas de zona más vistosas, muros que se unan, sombras, y rendimiento en móviles antiguos.
- Qué probar: activar la vista 3D en PC y en el móvil, pivotar, construir un cuarto y hacer un huerto desde ella.

## 2026-10-17 (tarde, 13) — Construcciones de varias casillas

- Petición de Mikel: talleres y camas más grandes que 1×1, y poder girar la vista libremente.
- Cama, banco de trabajo y armario ocupan 2×1; horno y recicladora 2×2; cantera 3×3. En 🏗 hay ↻ Girar (tecla X) para ponerlas en vertical u horizontal; al arrastrar se ve en verde dónde caben o en rojo si no (todas sus casillas tienen que ser suelo llano, libre y a la misma altura). Se construyen y se usan desde cualquier casilla de alrededor; al demolerlas se libera todo lo que ocupaban.
- Partidas guardadas: un taller o una cama de antes que ya no quepa con su tamaño nuevo se quita y devuelve su material al suelo.
- Vista libre: decidido con Mikel pasar a 3D real (Three.js) con órbita libre (botón central, dos dedos). Se hace en varias sesiones con un interruptor; mientras, la vista actual sigue.
- Qué probar: poner un horno 2×2 y una cama girada; comprobar que los colonos la usan.

## 2026-10-17 (tarde, 12) — Fin de la fase 3 y primeras necesidades (fase 4)

- **Habitaciones**: el juego detecta los cuartos cerrados por muros (las puertas y portones los separan); al tocar dentro se ve «Habitación (12 casillas, 1 puerta)». Servirán para el ánimo y la temperatura.
- **Cantera** (🪵20 🪨10) y **recicladora** (🔩20 ⚙️2) en 🏗 → Talleres: sacan piedra y chatarra sin materiales, despacio (para cuando se acaben las del mapa); la recicladora también saca componentes de la chatarra.
- **Hormigón** 🧱: el horno lo hace con piedra y un poco de chatarra. Muro y muro alto de hormigón (muy resistentes y baratos), barricada y suelo de hormigón. **Armario** (caben 2 montones).
- **Fase 3 terminada**: se cumple el criterio («diseño un refugio cerrado y los colonos lo construyen con recursos»), comprobado con un test que pone los planos de un cuarto con puerta, deja que los colonos lo levanten y detecta la habitación. Queda pendiente de la fase 3 solo el armero (llegará con las armas).
- **Fase 4 empieza — necesidades** (`src/sim/needs.ts`, con tests): cada colono tiene comida y descanso. Con hambre va al montón de comida más cercano (patatas, maíz, setas) y come; cansado, o de noche, duerme en una cama libre o, si no hay, en el suelo. Si el hambre o el agotamiento son graves, deja lo que esté haciendo. Ánimo con sus motivos (hambre, cansancio, dónde durmió —mejor en una cama dentro de una habitación—, rasgos optimista/pesimista); el ánimo bajo y el agotamiento hacen trabajar más despacio. Los rasgos «trabajador», «perezoso» y «glotón» ya tienen efecto.
- La colonia empieza con 60 patatas. Aviso en pantalla si alguien pasa hambre y no queda comida. En la ficha del colono: barras de comida, descanso y ánimo, y los motivos. Los que duermen se ven tumbados.
- Todo se guarda con la partida (las anteriores empiezan con los colonos bien comidos y descansados).
- Qué probar: hacer camas dentro de un cuarto y ver que duermen ahí de noche; dejar que se acaben las patatas y ver el aviso; tener un huerto para no pasar hambre.
- Siguiente: sed y agua (recoger agua, filtrar la contaminada), cocina, y después salud, raids y combate.

## 2026-10-17 (tarde, 11) — Colono encerrado por árboles que rebrotan (#7)

- Aviso automático #7 desde el móvil: «Óscar está encerrado: solo llega a 1 casilla». No se reproduce con la partida sola, así que la causa más probable es la novedad de hoy: los tocones que rodeaban a un colono quieto (reclutado o descansando) rebrotaron como árboles y le cerraron el paso.
- Arreglo: no nace ni rebrota nada a menos de 2 casillas de un colono ni en su camino (test con un colono reclutado rodeado de tocones durante 4 días).
- El aviso de encerrado ahora sugiere también talar lo que lo rodea: con el colono elegido, tocar un árbol de al lado hace que lo tale desde dentro.
- Qué probar: en la partida del aviso, elegir a Óscar y tocar un árbol de al lado.

## 2026-10-17 (tarde, 10) — Zanjas, estanterías y repaso de fallos

- **Zanjas**: ⚒ → ▭ Zanja y ▬ Rellenar (trabajo «obras de terreno»). Una zanja se cruza 4 veces más despacio (frenará a los raids de la fase 4); no admite montones, almacenes, huertos ni construcciones. Se ven como un foso oscuro y se guardan con la partida (las partidas anteriores simplemente no tienen).
- **Estanterías** de madera (🪵12, caben 3 montones) y de metal (🔗8, caben 4) en 🏗 → Muebles. Dentro de un almacén, los colonos llenan la estantería antes de ocupar más suelo.
- Repaso del código de pantalla e interfaz (no se puede ejecutar aquí) y arreglos:
  - La lista de prioridades de la ficha se quedaba vacía tras elegir un grupo, y podía editar al colono de un mapa anterior.
  - Los paneles de almacén, huerto y taller se quedaban abiertos (y sin poder cerrarse) tras un mapa nuevo, importar o volver a la partida anterior.
  - Los círculos de grupo seguían dibujados tras un mapa nuevo.
  - Los contadores de 🪓 ⛏ 🔩 no bajaban mientras se trabajaba.
  - En el móvil, deslizar la lista de colonos podía añadir uno al grupo sin querer.
  - Al abrir la ficha de un colono se cierran los menús de órdenes (en un móvil se tapaban); el menú queda por encima de las fichas.
  - Si se levantaba el dedo de un pellizco encima de un panel, el siguiente toque se ignoraba.
  - Si fallaba la carga de una partida importada, se apartaba la que no era.
- Qué probar: cavar una zanja y mandar a un colono a cruzarla; poner una estantería en un almacén y ver cómo se llena; con un grupo elegido y luego un solo colono, ver que salen las prioridades.
- Siguiente: hormigón y armarios; después, fase 4 (comer, beber y dormir).

## 2026-10-17 (tarde, 9) — Talleres y metal

- Sin incidencias nuevas en 🐞.
- **Talleres** (🏗 → Talleres): horno de fundición (🪨25 🔩10) y banco de trabajo (🪵20 🔩10). Al tocar un taller se elige qué fabricar y hasta cuánto («hasta tener 20»), con −5/+5 y pausa; se ve cuánto hay y qué tiene dentro. Trabajo nuevo «fabricar» (habilidad Construcción): los colonos llevan el material de cada tanda al taller y la fabrican; el producto sale al lado y se lleva al almacén. Se para solo al llegar al objetivo. Recetas en `src/data/recipes.json`: fundir chatarra (🔩10 → 🔗5 metal), montar componentes (🔗3 🔩4 → ⚙️1) y recuperar madera (🧵10 → 🪵4).
- **Metal** 🔗 (recurso nuevo): muro de metal (el más resistente), muro alto de metal, puerta y portón blindados, torre de vigía de metal (vista 11), barricada y pinchos de metal.
- Demoler un taller devuelve también lo que tenía dentro. Las órdenes de los talleres se guardan con la partida.
- Qué probar: construir un horno, ponerle «fundir chatarra hasta 10» con chatarra en el almacén y ver cómo funden; con ese metal, un tramo de muro de metal.
- Siguiente: zanjas; mobiliario de almacén (estanterías); hormigón. Después, fase 4 (necesidades: comer y dormir).

## 2026-10-17 (tarde, 8) — Reclutar, demoler, mover tierra y árboles que rebrotan

- Incidencias de 🐞: #4 (reclutar y órdenes concretas), #5 (demoler) y #6 (colono atrapado entre desniveles; con #2, subir y bajar el terreno). Las tres cerradas con comentario.
- **Reclutar** (#4): botón 🎖 en la ficha o tecla G. Un reclutado deja lo que hace (y suelta lo que lleva), no trabaja ni deambula y espera órdenes; lleva un banderín naranja. **Grupos**: 👥 en la lista elige a todos; mantener pulsado un nombre (o Mayús+clic) lo añade o quita. Tocar el suelo con un grupo los manda juntos, cada uno a una casilla libre cercana. **Órdenes concretas**: con un colono elegido, tocar algo con trabajo (árbol, roca o coche, algo marcado, un plano, una construcción a demoler, una cosecha madura, una obra de terreno) hace que lo haga ya, aunque tenga ese trabajo desactivado o esté reclutado (después sigue reclutado). Servirá para el combate.
- **Prioridades de trabajo** en la ficha (tarea de la fase 2): cada trabajo con 1–4 o — (no lo hace); tocar para cambiar.
- **Demoler** (#5): 🏗 → ⛏ Demoler / quitar planos. Las construcciones terminadas se marcan en rojo; un colono (trabajo «construir») las derriba desde el lado y deja la mitad del material. Los planos se quitan al momento.
- **Obras de terreno** (#2, #6; `src/sim/terrain.ts`): ⚒ → ⬇ Rebajar (baja un nivel, deja 3 de piedra; sobre roca, la pica y queda pedregal), ⬆ Elevar (sube un nivel) y ◢ Rampa (un acantilado pasa a pendiente). Trabajo nuevo «obras de terreno» (habilidad Minería). Los desniveles que se crean son pendientes, así que nunca encierran; los acantilados del mapa se respetan hasta que se hace una rampa. El mapa se repinta en el momento.
- Las comprobaciones de 🐞 avisan si un colono queda **encerrado** (solo llega a menos de 30 casillas), con la solución.
- **Los árboles vuelven a crecer**: cada hora de juego, algunos tocones rebrotan y junto a los árboles nacen matorrales y árboles nuevos (nunca en almacenes, huertos, construcciones, montones ni donde hay colonos).
- Todo se guarda con la partida (reclutados, obras pendientes, construcciones a demoler).
- Qué probar: liberar al colono atrapado con una rampa; reclutar a dos, mandarlos juntos y ordenar a uno talar un árbol concreto; demoler un muro; cambiar prioridades; dejar pasar unos días y ver rebrotar los tocones.
- Siguiente: metal (horno para fundir chatarra) con muros y torres de metal; banco de trabajo; zanjas.

## 2026-10-17 (tarde, 7) — Huertos, portones y más construcciones

- Petición de Mikel: portones grandes, cultivo con varias cosechas y más tipos de construcción.
- **Huertos** (`src/sim/farming.ts`, `src/data/crops.json`, con tests): ⚒ → 🌱 Huerto y arrastrar sobre tierra (no sobre arena pura, roca, asfalto ni agua). La fertilidad depende del suelo, la humedad y la radiación (la tierra oscura y húmeda es la mejor); se ve al tocar una casilla. Al tocar el huerto se elige el cultivo: patatas (aguantan casi cualquier tierra), maíz (rinde más, pide buena tierra), setas (rápidas, también de noche y en suelo pobre) y cáñamo (fibra). Las plantas crecen de día y se ven en cuatro fases. Nuevo trabajo «cultivar» (habilidad Cultivo): los colonos siembran, cosechan cuando madura, y lo cosechado se lleva al almacén. Los matorrales hay que talarlos antes.
- Recursos nuevos: patatas 🥔, maíz 🌽, setas 🍄 y fibra 🧵 (salen en el inventario cuando hay). Serán la comida de la fase 4.
- **Portones** de madera (🪵18) y de chapa (🔩18 ⚙️2): altos como los muros altos; se colocan en línea y las casillas se juntan en una sola hoja.
- **Más construcciones**: suelos de madera, losas de piedra y chapa (se anda un 15 % más rápido), barricadas de madera y chatarra (frenan mucho; darán cobertura en los combates), pinchos de madera (frenan mucho; harán daño a los enemigos en la fase 4) y cama (para dormir en la fase 4). El menú 🏗 está agrupado por tipos.
- Cada construcción transitable tiene su propio coste de paso (antes solo existía el de las puertas).
- Las partidas guardadas siguen valiendo: las anteriores simplemente no tienen huertos.
- Qué probar: hacer un huerto de setas (maduran en unos 12 minutos a x1) y otro de patatas, con un almacén cerca; ver cómo siembran y cosechan. Probar portones en un muro alto y un suelo.
- Siguiente: metal (fundir chatarra) con muros y torres de metal; banco de trabajo; aplanar y subir el terreno (y las zanjas).

## 2026-10-17 (tarde, 6) — Árboles talados que no desaparecían; muros altos y torres

- Bug #3 (enviado con 🐞 desde el móvil): al talar un árbol o un matorral seguía viéndose. Los objetos se pintan en la imagen del mapa y no se repintaba. Ahora, cuando cambia un objeto, se repinta solo su columna del mapa (todo lo que se dibuja de una casilla cae en su columna de píxeles), así que no hay tirones. Para que el repintado coincida con el original, la forma de cada objeto y el grano del suelo ya no dependen del orden de pintado (test que compara repintar una columna con pintar el mapa entero).
- Muros altos: empalizada alta (🪵10), muralla de piedra (🪨12) y muro alto de chatarra (🔩10). Miden el doble y aguantan el doble que los normales; se colocan igual (en contorno) para cerrar perímetros.
- Torres de vigía de madera (🪵25), piedra (🪨30 🪵8) y chatarra (🔩25 ⚙️2): se puede subir a ellas (se cruzan algo más despacio) y el colono se ve arriba, en la plataforma. Tienen un alcance de vista (8–10 casillas) que servirá para ver venir los raids y disparar desde lo alto en la fase 4.
- Las partidas guardadas siguen valiendo (solo hay construcciones nuevas).
- Qué probar: talar árboles y matorrales y ver que pasan a tocón o desaparecen (también con la vista girada); levantar un trozo de muralla y una torre, y mandar a un colono a la torre.
- Siguiente: metal (fundir chatarra en un horno) y muros y torres de metal; después defensas (pinchos, zanjas).

## 2026-10-17 (tarde, 5) — La partida se guarda y sobrevive a las actualizaciones

- Petición de Mikel: no perder la partida al recargar ni al publicarse una versión nueva.
- La partida se guarda sola en el navegador cada 30 s, al esconder la pestaña (en el móvil, al cambiar de app) y al cerrarla. Al abrir el juego se carga la última; `?nueva` en la URL empieza un mapa nuevo.
- ☰ → 💾 Guardar (ahora), ⬇ Exportar (archivo .json), ⬆ Importar y ↶ Partida anterior (copia de seguridad del guardado previo). Se ve cuándo se guardó por última vez. «Nuevo mapa» pide confirmación.
- Formato con versión (`src/sim/save.ts`, con tests): se guarda el mapa entero (no solo la semilla, para que un cambio en el generador no altere una partida empezada), los colonos, montones, órdenes, almacenes y construcciones. Se lee de forma tolerante: lo que ya no existe se descarta (rasgos, recursos, construcciones) y lo nuevo toma su valor por defecto (habilidades, prioridades). Los trabajos a medias no se guardan: al cargar, cada colono busca uno nuevo y lo que llevaba en las manos queda a sus pies.
- **Regla para las próximas sesiones**: no romper partidas guardadas. Si un cambio no se puede leer de forma tolerante, subir `SAVE_VERSION` y añadir la migración en `migrate()`.
- Si una partida no se puede cargar, se avisa, se aparta (para no pisarla) y se empieza un mapa nuevo.
- Qué probar: jugar un rato, recargar la página y comprobar que todo sigue (almacenes, muros, órdenes, hora); exportar e importar; en el móvil, cambiar de app y volver.
- Siguiente: muros altos y torres de vigía.

## 2026-10-17 (tarde, 4) — Almacenes y primeras construcciones

- Petición de Mikel: almacenes con filtro y prioridad, mobiliario de almacén, construcción (muros de varios materiales, puertas, muros altos, torres de vigía), materiales nuevos como el metal, pinchos y zanjas, y aplanar o subir el terreno (#2). Todo anotado en `FEEDBACK.md` y en la fase 3 del roadmap; esta sesión hace almacenes, muros y puertas.
- **Almacenes** (`src/sim/zones.ts`): ⚒ → 📦 Almacén y arrastrar (empezando dentro de uno, se amplía); ✖ Quitar almacén recorta. Al tocar un almacén se abre su panel: prioridad (baja, normal, alta, crítica), qué recursos acepta y borrar. Se ven en el suelo con un color por prioridad.
- **Transporte**: nuevo trabajo «transportar». Los colonos llevan lo suelto al almacén más importante que lo acepte y tenga sitio (completando montones), y suben las cosas de un almacén a otro de más prioridad. Lo que llevan se ve sobre la cabeza y cuenta en el inventario.
- **Criterio de la fase 2 cumplido**: se marcan árboles y los colonos los talan y guardan la madera solos (hay un test que lo comprueba). Quedan tareas de la fase 2 (panel de prioridades, rebrote de árboles, agua, guardado), que se harán mientras avanza la fase 3.
- **Construcción** (`src/data/buildings.json`, `src/sim/structures.ts`): 🏗 → muro de madera (🪵5), piedra (🪨6) o chatarra (🔩5); puerta de madera (🪵10) o de chapa (🔩10 ⚙️1). Los muros se colocan en contorno (un rectángulo hace un cuarto; una línea, un muro) y se puede cambiar a relleno; solo en suelo llano y libre. Los colonos llevan el material al plano y lo levantan desde el lado (habilidad de Construcción). Los muros cortan el paso; las puertas se cruzan algo más despacio. Si se termina un muro donde hay un montón o un colono, se apartan. ✖ Quitar planos devuelve el material ya llevado.
- Los planos se ven translúcidos y azulados; la información de casilla dice lo que falta («madera 3/5»).
- Sin npm en este entorno: tests con Bun (100) y tipos de la simulación con `tsc`; el dibujado se comprueba en GitHub Actions.
- Qué probar: hacer un almacén junto al inicio y ver cómo llevan las provisiones; cambiar su filtro y su prioridad; construir un cuarto de muros de madera con una puerta; probar en el móvil que los menús 🏗 y ⚒ caben y no tapan.
- Siguiente: muros altos y torres de vigía; después, metal (fundir chatarra), defensas (pinchos, zanjas), mobiliario de almacén y aplanar o subir el terreno.

## 2026-10-17 (tarde, 3) — Los colonos trabajan solos

- Mikel confirma que todo funciona, también en móvil y PC: **fases 0 y 1 terminadas**.
- Sistema de trabajos (`src/sim/jobs.ts`, con tests): cada colono libre busca trabajo entre lo designado, primero el de mejor prioridad y, dentro de ella, lo más cercano a lo que puede llegar andando. Reserva la casilla (dos colonos nunca hacen la misma), va hasta ella (o al lado si el objeto bloquea el paso, como árboles, rocas y coches), trabaja y, al terminar, los recursos caen al suelo, suben al inventario y la marca desaparece.
- Velocidad de trabajo según la habilidad: talar con Cultivo, picar con Minería y saquear con Construcción (de ×0,6 con 0 puntos a ×1,6 con 20). Un árbol cuesta unos 10 s a x1 a un colono medio.
- Prioridades por colono ya en la simulación (1 a 4, 0 = no lo hace; todas a 3 por ahora). El panel para cambiarlas es una tarea posterior.
- Quitar la orden, o mandar al colono a otra casilla, hace que deje el trabajo y suelte la reserva. Quien deambula lo deja en cuanto aparece trabajo. Si algo no se alcanza, se ignora y se reintenta cada 3 s.
- Se ve: el colono golpea mientras trabaja, encima del objeto hay una barra de progreso del color del trabajo y la ficha dice «Talando (45 %)» o «Yendo a talar». Las comprobaciones de 🐞 vigilan reservas y trabajos.
- Qué probar: marcar unos árboles y rocas junto al inicio y ver cómo se reparten los tres colonos; quitar una orden a medias; mandar a un colono a otro sitio mientras trabaja.
- Siguiente: zonas de almacén y transporte (los colonos llevan los montones a una zona). Con eso se cumple el criterio de la fase 2.

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
