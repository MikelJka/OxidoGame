# Progreso

Diario de sesiones, la más reciente arriba.

## 2026-10-17 (noche, 5) — Menú principal y modo Dios

- **Menú principal** (Mikel): sale al abrir el juego, con la partida en pausa detrás, y desde ☰ → 🏠 Menú principal. Continuar, Nueva partida (semilla con número o palabra, de 1 a 6 colonos, con o sin raids, caravanas y supervivientes, y modo Dios), cargar una partida desde archivo y ver el progreso del desarrollo.
- **Modo Dios 🪄** (se activa en el menú principal; aparece un botón 🪄 junto al de 3D). Tocando el mapa: dejar recursos (10, 50 o 200 de cualquiera), hacer aparecer un colono, un saqueador, un prisionero o un comerciante, herir, matar o despejar una casilla. Al momento: raid, caravana, superviviente, terminar todas las obras, curar y saciar a todos, madurar los cultivos, avanzar 1 h, 6 h o un día, y activar o quitar los sucesos y las necesidades. Funciona en 2D y en 3D.
- Qué probar: activar el modo Dios, dejar materiales, poner a un saqueador junto a un colono reclutado y ver cómo pelean; capturarlo y convencerlo avanzando el tiempo.

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
