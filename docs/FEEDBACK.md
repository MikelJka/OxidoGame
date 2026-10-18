# Feedback de Mikel

Escribe aquí lo que quieras, o usa el botón 🐞 del juego: abre una incidencia en GitHub con la etiqueta `feedback` y cada sesión la pasa a esta lista.

## Pendiente

- [ ] **Armas** (2026-10-17, aprobado por Mikel): cuerpo a cuerpo (cuchillo, tubería, lanza, machete) y a distancia (arco; pistola casera, escopeta y rifle). Decidido con Mikel: cada colono coge solo la mejor arma libre y en su ficha se le puede fijar una o dejarlo desarmado; munición en dos tipos, flechas (madera + fibra) para el arco y balas (chatarra + componentes) para las de fuego; ahora se fabrican en el banco las de cuerpo a cuerpo y el arco, y **las de fuego se desbloquean con investigación (fase 5)**; los saqueadores llegan armados según el día (palos y cuchillos al principio, arcos y armas de fuego más adelante) y al caer sueltan el arma. Incluye los armeros de pared (fase 3). **Hechas** las de cuerpo a cuerpo, el arco, las flechas y el armero; faltan, con la investigación, las de fuego y las balas.

- [ ] **Electricidad** (2026-10-17, aprobada por Mikel): cables por el suelo casilla a casilla (🔩1, también bajo suelos y muros); lo conectado forma una red con producción, consumo y baterías; un cable roto corta la red. Primera versión con todo: generador de leña, placas solares (de día), molino de viento y baterías; lámparas (de noche, con luz se trabaja a velocidad normal, sin luz −20 %, y sube el ánimo); versiones eléctricas de horno, cocina y banco (el doble de rápidas), y recicladora y depuradora con corriente; puertas automáticas que se cierran ante un raid (las torretas, con la investigación). Números aprobados: generador de leña 1 000 W, gasta 1 🪵 cada 2 h, 🔩20 ⚙️2, 2×2; placa solar 600 W de día, 🔩15 ⚙️3, 2×2; molino de viento 0–900 W según el viento, 🪵20 🔩10 ⚙️2, 1×1 sin nada alrededor; batería 6 000 Wh, 🔩10 ⚙️2; cable 🔩1 por casilla. Consumo: lámpara 50 W (ilumina 3 casillas); horno, cocina y banco eléctricos 300 W (el doble de rápidos); recicladora 250 W y depuradora 150 W (**pasan a necesitar corriente**, también en las partidas guardadas: sin red, paradas); puerta automática 20 W. Sin corriente suficiente se apaga primero lo último que se conectó. **Hechos**: cables, generador de leña, batería y lámparas (con la luz de noche), placa solar, molino de viento y recicladora y depuradora con corriente; faltan las máquinas eléctricas (horno, cocina y banco), las puertas automáticas y que la luz suba el ánimo.

- [ ] **Reglas de combate** (2026-10-17, aprobado por Mikel), en este orden: cobertura y alcance (números aprobados: pegado al objetivo, un muro o puerta cerrada impide dispararle; barricada o roca grande −50 % de acierto; árbol, coche, chatarra o valla −30 %; dentro de una zanja −25 %; desde una torre de vigía +2 de alcance y +15 % de acierto; −6 % por casilla de distancia; cuerpo a cuerpo sin cobertura; los reclutados con arco buscan solos cobertura a 3 casillas o menos; **hecho**) (muros, barricadas, rocas y árboles quitan acierto; la precisión baja con la distancia y sube con Combate); armadura (números aprobados: se fabrica en el banco y se equipa sola como las armas, con selector en la ficha; un hueco de chaleco y otro de casco; chaleco de cuero 🧵8 −15 % de daño, de chapa 🔩12 −25 % y −5 % al andar, de metal 🔗8 ⚙️1 −35 % y −10 % al andar; casco de chapa 🔩6 −10 %, de metal 🔗4 −15 %; se suman; saqueadores con chalecos de cuero o chapa desde el día 10; **hecho**); moral y huida (números aprobados: cada raid tiene un líder, el de más Combate, marcado con ★; huyen todos al caer la mitad del grupo o el líder; uno solo huye por debajo del 45 % de salud; colonos con ánimo < 15 % y heridos, o que ven caer a un compañero a 5 casillas, entran en pánico con un 20 % de probabilidad: sueltan lo que hacen y corren a su cama o habitación más cercana durante 1 h; reclutados solo con ánimo < 5 %; «duro» nunca, «pesimista» el doble; **hecha**, con el líder ★ de los saqueadores y el pánico de los colonos); fuego amigo y posturas (mantener posición, atacar a un objetivo, retirarse).

- [ ] **Vehículos de asedio y de combate** (2026-10-17, pedido por Mikel), de los colonos y de los asaltantes. Antes de hacerlo hay que proponerle a Mikel cómo funcionan (qué vehículos, combustible, cómo se fabrican, qué pueden romper).

- [ ] **Menús de la partida más accesibles e intuitivos** (2026-10-17): rehacer los menús dentro de la partida (☰, 🏗, ⚒, 📜, fichas y paneles) para que se entiendan mejor y funcionen bien en el móvil en vertical y en horizontal. Hechos el menú de inicio, ☰, 🏗 Construir, ⚒ Órdenes y 📜 Colonia; faltan la ficha del colono y los paneles de almacén, huerto y taller.

- [ ] **Girar la vista libremente** (2026-10-17): pivotar la cámara a cualquier ángulo e inclinación con el botón central del ratón (y con dos dedos en el móvil), no solo los 4 giros fijos. Decidido: pasar a 3D real con Three.js. Primera versión jugable en ☰ → 🧊 Vista 3D (en pruebas); falta pulirla antes de que sea la vista por defecto.


## Propuestas para Mikel

Lo que una sesión quiere meter y necesita su visto bueno (responde por el chat o con 🐞).

- **Horno, cocina y banco eléctricos** (2026-10-18): ya está aprobado que gastan 300 W y van el doble de rápido; falta decidir cómo se consiguen y cuánto cuestan. Opciones:
  1. **Construcciones aparte** (🏗 → Electricidad), del mismo tamaño que las normales: horno eléctrico 🔩20 ⚙️4, cocina eléctrica 🔩15 ⚙️3, banco eléctrico 🔩15 🪵10 ⚙️3. Sin corriente, paradas.
  2. **Mejora de la que ya tienes**: al tocar un horno, cocina o banco, «⚡ Electrificar» por 🔩10 ⚙️3. Con corriente va el doble de rápido; sin ella, a velocidad normal (no se para nunca).
  3. Como la 1, pero más baratas (🔩10 ⚙️2 cada una) y sin corriente funcionan a velocidad normal.

- **Puertas automáticas y luz que sube el ánimo** (2026-10-18): de la electricidad está aprobado que la puerta automática gasta 20 W y se cierra ante un raid, y que la luz sube el ánimo, pero no cuánto cuesta la puerta ni cuánto ánimo da la luz. Opciones:
  1. **Puerta automática** 🔩10 ⚙️2 (como una de chapa, 1×1); **ánimo** +5 % «Habitación con luz» a quien duerme o trabaja junto a una lámpara encendida de noche.
  2. Puerta 🔗4 ⚙️2 (de metal, aguanta como la blindada); ánimo +8 % durante la noche a quien pase la mayor parte de ella cerca de una lámpara.
  3. Puerta 🔩8 ⚙️1 (más barata, aguanta como la de chapa); ánimo: sin luz de noche −5 % «A oscuras», con luz nada (castiga en lugar de premiar).

- **Fuego amigo y posturas** (2026-10-18): es la última regla de combate aprobada, pero falta decidir cómo funciona. Opciones:
  1. **Fuego amigo**: un disparo que falla puede dar a un colono que esté en la línea de tiro a 1 casilla del objetivo (25 % de las veces que falla). **Posturas** en la ficha y en la barra del reclutado: «Mantener posición» (no se mueve; dispara a lo que tenga a tiro), «Atacar a…» (tocar un enemigo: va solo a por él) y «Retirarse» (vuelve a la cama/habitación más cercana sin pelear).
  2. Fuego amigo solo con las armas de fuego (cuando lleguen); el arco nunca da a los tuyos. Mismas posturas que la 1.
  3. Sin fuego amigo por ahora; solo las posturas de la 1, más «Defender» (se queda a 5 casillas de donde se le manda y ataca a quien entre).

## Hecho

- [x] **#10 «No se pudo abrir la vista 3D» tras publicar una versión nueva** (2026-10-17, 🐞): con la página abierta desde antes de una publicación, el archivo de la 3D de la versión vieja ya no existía. Ahora el juego guarda la partida, se recarga solo con la versión nueva y vuelve a abrir la 3D, sin pasar por el menú de inicio (como mucho una vez por minuto, para no quedarse recargando).

- [x] **Mobiliario de almacén** (2026-10-17): estanterías, armarios y, ahora, el armero (🏗 → Muebles, 2×1, 🪵15 🔩8): dentro de un almacén guarda solo armas y munición, 30 armas o 300 flechas por casilla.

- [x] **#9 Óscar encerrado otra vez y la 3D que se cae en el móvil** (2026-10-17, 🐞): no se pudo saber qué lo encerró (la partida no viene en el aviso). Ahora, cada 10 minutos de juego, quien solo llegue a unas pocas casillas sale solo a la más cercana desde la que se llega lejos («🧗 … sale como puede» en el diario), y el aviso de 🐞 dice qué lo rodeaba para encontrar la causa. Si el móvil se queda sin memoria gráfica en 3D, se vuelve a la 2D con un aviso (y la 3D se dibuja a menos resolución en pantallas pequeñas).

- [x] **Bug: en el móvil no se veía la previsualización al construir** (2026-10-17): con el dedo, tocar o arrastrar deja el fantasma blanco y en la barra salen ✔ Colocar y ✖; antes de confirmar se puede girar o tocar en otro sitio para moverlo (también en 3D).

- [x] **Nuevo menú de inicio** (2026-10-17): pantalla de inicio rehecha, con botones grandes, adaptada al móvil en vertical y en horizontal, y la nueva partida por apartados (mapa, colonia, dificultad, opciones).

- [x] **Menú principal y modo Dios** (2026-10-17): menú al abrir el juego (continuar, nueva partida con opciones, cargar) y modo Dios 🪄 para aparecer cosas y probar.

- [x] **La 3D se ve fea** (2026-10-17): suelo con textura, taludes, agua translúcida, muros con su material, sombras y mejor luz.

- [x] **Más colonos, prisioneros y comerciantes con esclavos** (2026-10-17): llegan supervivientes que piden unirse (aceptar o rechazar); los saqueadores caídos se capturan y se pueden retener, convencer o liberar; las caravanas venden recursos y esclavos y compran prisioneros. Menú completo en 📜 → Prisioneros y 📜 → Comercio.
- [x] **No veo la 3D** (2026-10-17): botón «3D» junto a los giros de la vista, y el botón central del ratón en la vista 2D también pasa a la 3D. Si el navegador no tiene WebGL (aceleración por hardware desactivada) avisa de ello.
- [x] **#8 Colono encerrado** (2026-10-17, 🐞): Tania se quedaba encerrada en una fila de 6 casillas al cerrarse una construcción a su alrededor. Ahora, quien está dentro de un hueco que se cierra al terminar una obra sale fuera.

- [x] **Construir encima de los suelos** (2026-10-17): los suelos van en su propia capa; encima se puede poner de todo (muros, camas, talleres…) menos lo del agua (pozo, depuradora), y los huertos no van sobre suelo. Al demoler lo de encima, el suelo sigue ahí.

- [x] **Vista previa en blanco de lo que se construye y girar con R** (2026-10-17): al elegir algo en 🏗 se ve un fantasma blanco bajo el ratón y en todo el área arrastrada (2D y 3D); R gira camas, talleres, puertas…

- [x] **Construcciones de varias casillas** (2026-10-17): cama y banco de trabajo 2×1, armario 2×1, horno y recicladora 2×2, cantera 3×3. Se giran con ↻ Girar (tecla X) en 🏗; al arrastrar se ve en verde dónde cabe (o en rojo si no). Necesitan suelo llano y libre en todas sus casillas.

- [x] **Máquinas que generan recursos: canteras y recicladoras** (2026-10-17): 🏗 → Talleres. La cantera saca piedra y la recicladora chatarra (y componentes), sin materiales, despacio.

- [x] **#7 Óscar encerrado en una casilla** (aviso automático, 2026-10-17): lo más probable es que rebrotaran árboles en los tocones de alrededor de un colono quieto (reclutado o descansando). Ahora no nace nada a menos de 2 casillas de un colono ni en su camino. Para sacarlo de esa partida: elegirlo y tocar uno de los árboles de al lado (lo tala desde dentro), o ⚒ → Rampa/Rebajar.

- [x] **Zanjas** (2026-10-17): ⚒ → ▭ Zanja (se cruza cuatro veces más despacio; frenará a los enemigos) y ▬ Rellenar.
- [x] **Estanterías** (2026-10-17): 🏗 → Muebles → estantería de madera (cabe el triple) o de metal (el cuádruple). Se ponen dentro de un almacén.

- [x] **Materiales nuevos: el metal** (2026-10-17): horno de fundición (🏗 → Talleres): 10 de chatarra dan 5 de metal. Con metal: muros normales y altos, puerta y portón blindados, torre de vigía, barricada y pinchos. Banco de trabajo para montar componentes y prensar fibra en madera.

- [x] **#4 Reclutar colonos y darles órdenes concretas** (2026-10-17): 🎖 Reclutar (o tecla G) en la ficha: deja de trabajar y deambular y solo obedece. Grupo: 👥 en la lista, o mantener pulsado un nombre (Mayús+clic en PC); tocar el suelo los manda juntos, cada uno a una casilla. Con un colono elegido, tocar algo con trabajo (un árbol, roca, plano, cosecha madura, obra) hace que lo haga ya, aunque esté reclutado. En la ficha, prioridades de cada trabajo (1 primero … 4, — no lo hace).
- [x] **#5 Demoler construcciones** (2026-10-17): 🏗 → ⛏ Demoler y arrastrar. Un colono la derriba y se recupera la mitad del material; en un plano, se quita y se devuelve todo lo llevado.
- [x] **#2 y #6 Subir y bajar el terreno; colono atrapado entre desniveles** (2026-10-17): ⚒ → ⬇ Rebajar (sale piedra; también pica roca), ⬆ Elevar y ◢ Rampa (un acantilado pasa a pendiente). Los desniveles nuevos son pendientes, así que no encierran. Las comprobaciones de 🐞 avisan si un colono queda encerrado.
- [x] **Los árboles vuelven a crecer** (2026-10-17): los tocones rebrotan y junto a los árboles nacen matorrales y árboles nuevos (no en almacenes, huertos ni construcciones).

- [x] **Portones grandes para los muros** (2026-10-17): 🏗 → portón de madera o de chapa, tan alto como los muros altos; se colocan en línea y las casillas se juntan en una sola hoja.
- [x] **Cultivo con varias cosechas** (2026-10-17): ⚒ → 🌱 Huerto y arrastrar sobre tierra. Al tocar el huerto se elige qué plantar: patatas, maíz, setas (crecen de noche y en suelo pobre) o cáñamo (fibra). Los colonos siembran y cosechan solos; lo cosechado va al almacén.
- [x] **Más construcciones** (2026-10-17): suelos (madera, losas de piedra, chapa; se anda más rápido), barricadas (madera, chatarra), pinchos de madera y cama.

- [x] **#3 Al talar un árbol o arbusto seguía viéndose** (2026-10-17): los objetos se pintaban una sola vez en la imagen del mapa. Ahora, al talar, picar o saquear, se repinta solo esa columna del mapa: el árbol pasa a tocón y el matorral desaparece, sin tirones.
- [x] **Muros altos y torres de vigía** (2026-10-17): 🏗 → empalizada alta, muralla de piedra y muro alto de chatarra (el doble de alto y de resistentes); torres de vigía de madera, piedra y chatarra, a las que se puede subir. Las de metal llegarán con el metal.

- [x] **Guardar la partida aunque se publiquen versiones nuevas** (2026-10-17): se guarda sola cada 30 s y al cerrar o esconder la pestaña, y al recargar se sigue donde estabas, también tras una actualización. ☰ → 💾 Guardar, ⬇ Exportar, ⬆ Importar y ↶ Partida anterior. «Nuevo mapa» pide confirmación.

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
