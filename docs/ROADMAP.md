# Roadmap de Óxido

Cada sesión toma la primera tarea sin marcar de la fase actual. Una fase solo termina cuando se cumple su criterio de "terminado".

## Fase 0 — Base del proyecto

Terminado: la URL pública muestra el mapa generado y se puede mover y hacer zoom en móvil y PC.

- [x] Proyecto Vite + Phaser 3 + TypeScript estricto
- [x] Tests con Vitest y publicación automática en GitHub Pages
- [x] Generador de mapas con semilla: lagos, ríos, colinas, roca, bosque muerto, ruinas, zonas irradiadas, manantiales, agua contaminada
- [x] Dibujado pixel art del mapa y cámara (arrastrar, rueda, pellizco, teclado)
- [x] Indicador de terreno al tocar o pasar el ratón; botón "Nuevo mapa"; semilla en la URL
- [x] Comprobar en la URL pública que funciona en móvil y PC (lo confirma Mikel en FEEDBACK.md)

## Fase 1 — Mapa y colonos

Terminado: puedo mover la cámara y ver a 3 colonos caminar por el mapa; el tiempo se pausa y acelera.

- [x] Bucle de simulación por ticks independiente del dibujado (`src/sim/world.ts`), con velocidades pausa/x1/x2/x3
- [x] Botones de velocidad en el HUD (táctiles) y teclas espacio/1/2/3
- [x] Modelo de colono: nombre, posición, habilidades 0–20, rasgos (datos en `src/data/`)
- [x] Pathfinding A* sobre el mapa respetando `walkable` y `moveCost`, con tests
- [x] 3 colonos que aparecen en el inicio y deambulan por destinos aleatorios alcanzables
- [x] Sprites pixel art provisionales de colonos (generados por código) y animación de paso
- [x] Seleccionar un colono tocándolo y ver su ficha en un panel adaptable a móvil
- [x] Ordenar a un colono seleccionado que vaya a una casilla (control directo)
- [x] Suelo continuo con transiciones suaves y variedad mediante objetos (árboles secos, matorrales, rocas, chatarra, coches, muros, barriles tóxicos, charcos radiactivos, manantiales, huesos, neumáticos); carreteras viejas con ruinas; vados en los ríos
- [x] Más geografía: terrazas de altura (llano bajo, llano, loma, meseta), acantilados, pendientes, pasos estrechos y vados garantizados; tests de variedad y conectividad
- [x] Comprobar en la URL pública que los colonos caminan, se seleccionan y se mueven en móvil y PC (lo confirma Mikel)

## Fase 2 — Trabajos y recursos

Terminado: marco árboles y los colonos los talan y guardan la madera solos.

- [x] Recursos en el mapa: árboles muertos (madera), rocas (piedra), chatarra en ruinas
- [x] Inventario de la colonia y objetos en el suelo
- [x] Herramienta de designación: talar, minar, saquear (arrastrar un área; en móvil, modo selección)
- [x] Sistema de trabajos: cola, reserva de tareas, prioridades por colono
- [x] Zonas de almacén (con filtro de recursos y prioridad) y transporte
- [x] Panel de prioridades de trabajo
- [x] Los árboles vuelven a crecer con el tiempo (los tocones rebrotan y aparecen árboles nuevos cerca de otros)
- [x] Agua: beber de ríos, lagos y manantiales; el agua contaminada sienta mal y se puede depurar (depuradora) o sacar limpia de un pozo
- [x] Guardado manual y automático en el navegador, exportar/importar archivo

## Fase 3 — Construcción

Terminado: diseño un refugio cerrado y los colonos lo construyen con recursos.

- [x] Definiciones de edificios en JSON (coste, tiempo, terreno permitido)
- [x] Planos: colocar, cancelar y demoler (ratón y táctil)
- [x] Muros, puertas, portones, suelos, camas y banco de trabajo
- [x] Construcción como trabajo que consume recursos
- [x] Llevar material a varios planos cercanos en un solo viaje (#20)
- [x] Habitaciones cerradas detectadas (para ánimo y temperatura futura)
- [x] Máquinas de producción: cantera (piedra) y recicladora (chatarra a partir de basura y restos), para cuando se agoten los del mapa
- [x] Materiales: metal (se funde chatarra en el horno) y hormigón
- [x] Muros altos para perímetros y torres de vigía (madera, piedra y chatarra; las de metal, con el metal)
- [x] Defensas: pinchos, barricadas y zanjas
- [x] Mobiliario de almacén: estanterías, armarios y armeros
- [x] Terreno: aplanar y subir o bajar el nivel de las casillas (trabajo de los colonos) y rampas en los acantilados

## Fase 4 — Necesidades y raids (primera versión jugable)

Terminado: una partida de 30 minutos en la que se puede morir de hambre, de sed o por un raid.

- [x] Hambre, sed, sueño, ánimo; colonos que comen, beben y duermen solos
- [x] Cultivos (patatas, maíz, setas y cáñamo) y cocina
- [x] Salud: heridas localizadas, tratamiento, infecciones, 💊 Medicina, mesa de boticario y hierba curativa
- [x] Dificultad configurable al empezar (días sin raids, dureza)
- [x] Raids de saqueadores y mutantes que escalan con la riqueza (hechos los saqueadores, los perros mutantes, el bruto mutante, sus cadáveres y la hoguera para quemarlos)
- [x] Combate: armas cuerpo a cuerpo y a distancia, cobertura con bonificaciones, control directo (hecho: control con 🎖, armas cuerpo a cuerpo y arco, cobertura y alcance, armadura, la moral de los raids con su líder ★ y el pánico de los colonos y el fuego amigo y las posturas; hecha la pistola casera con balas, que pide «Pólvora», y la escopeta y el rifle, con «Armas largas»)
- [x] Muerte permanente y fin de partida
- [x] Avisos en pantalla de raids, peleas, heridos, caídos, muertes, pánico, visitas y caravanas (#17, #18)
- [x] Supervivientes que piden unirse, prisioneros (capturar, retener, convencer, liberar) y caravanas con esclavos
- [x] Más colonos (#21): el primer superviviente el día 2 y luego uno cada 2-4 días, y la radio de llamada (uno más cada 3 días con corriente)
- [x] Vehículos: ⛽ y destilería, el buggy de los colonos y el de los saqueadores (desde el día 20)
- [x] Prioridad médica tras los combates: sin saqueadores en pie, cualquier colono no reclutado cura primero a los colonos que sangran y lleva al caído a una cama; sin nadie libre, el herido se cura él mismo (peor); el malherido en pie guarda cama hasta el 80 %
- [x] Derribar en vez de matar; capturar, saquear o rematar (#22): los golpes derriban sin matar; en el suelo sueltan lo que llevan y se elige ⛓ Capturar (con cama de prisionero libre) o 🗡 Rematar (baja el ánimo); el médico los cura donde están

## Fase 5 — Investigación y máquinas

- [x] Banco de investigación y árbol tecnológico en JSON (hechos el banco, el árbol en `src/data/research.json` y la pestaña 📜 → 🔬 Investigación; las torretas ya piden «Torretas» y «Artillería», la pistola y las balas, «Pólvora», la escopeta y el rifle, «Armas largas», el subfusil y el rifle de francotirador, «Armas automáticas», la ballesta, «Ballesta», y la lanza de metal, «Forja»; la mesa de boticario y la hierba curativa, «Medicina de campo»; ya hay sacos de arena, libres, el alambre de espino y los muros con aspilleras piden «Fortificación», la mina casera, «Trampas» y «Pólvora», y la trampa eléctrica, «Trampas» y «Baterías mejoradas», y la torreta rotativa, «Ametralladoras», y las granadas caseras, «Explosivos» (desde el día 30 también las traen algunos saqueadores); desde el día 35 los saqueadores traen también subfusiles y rifles de francotirador; con «Baterías mejoradas» las baterías guardan el doble; con «Medicina avanzada» las heridas se curan un 25 % antes y la infección sale la mitad de veces; el chaleco y el casco tácticos piden «Blindaje avanzado»; el mortero, «Artillería»; con «Desguace de máquinas» las máquinas destruidas dejan el doble de ⚙️; con «Agricultura mejorada» el abono y con «Hidropónica» la bandeja hidropónica: los 26 proyectos desbloquean lo suyo, salvo el lanzallamas, que va con el fuego, aparcado)
- [x] Puentes, torretas, cañones, filtros de agua, pozos, generadores de combustible (pozo, depuradora y generadores ya estaban; hechos los puentes de madera y de metal y las plataformas de madera y de metal y el muelle (🪵10, se pesca 🐟 con la habilidad Supervivencia) y la trampa de pesca (1 🐟 al día), con «Puentes», y el molino de agua (500 W fijos en un río) y el puente levadizo (4×2, se alza solo ante un raid) y el foso con agua (las zanjas que tocan el agua se inundan y solo se cruzan por un puente), con «Hidráulica»; la balsa (🪵20, con «Navegación»), primer barco, y la lancha armada (🔩30 ⚙️4, ⛽, blindaje −30 %, con «Motores»); desde el día 15, saqueadores que llegan en balsa por el río; hechas las torretas eléctricas ligera, pesada y rotativa, pedidas por Mikel antes de la investigación, y la destilería de ⛽ combustible)
- [x] Enemigos máquina y drones (la araña de chatarra y el dron de vigilancia, 2026-10-20; y «Desguace de máquinas», que dobla los ⚙️ que sueltan)

## Fase 6 — Facciones y economía

- [x] Facciones con relaciones y diplomacia (tres facciones con su asentamiento y su relación, la pestaña 📜 → 🏳 Facciones, la alianza, la guerra, el tributo de los Hijos del Óxido y la radio para llamar a una caravana o pedir ayuda)
- [x] Bases de las facciones en un mapa del mundo (pedido por Mikel): el mapa con las bases y su crecimiento, el ataque con mapa de batalla, las facciones nuevas y ocupar las ruinas como otra colonia
- [x] Animales y granja (pedido por Mikel): domar con dificultad por animal (cabra, mula, vaca de dos cabezas, caballo, ciervo, jabalí), vallas, puertas de valla, postes con cuerda y establos
- [x] Caravanas y trueque por valor (caravanas de varias facciones; el trato cuadra por valor en chapas, lo que se da de más cuenta como regalo, y los precios cambian con el mercado)
- [x] Mercado global simulado con oferta y demanda (precios del 50 % al 200 % que bajan al vender y suben al comprar, se recuperan un 10 % al día y cambian por lo que pasa en el mundo; necesidades y sobrantes de cada caravana; tendencia ▲ ▼ y próxima caravana con «Rutas comerciales»)
- [ ] Eventos, arte definitivo y equilibrio (sucesos cada 2–4 días: hechos la tormenta de polvo, el alijo, la avería, la lluvia ácida, la plaga, el refugiado herido, el incendio, la ola de frío y la tormenta eléctrica; arte 2D hecho: personas, criaturas, props, luz, tiempo, suelo, sombras, desgaste, agua, muros, muebles y talleres, montones del suelo, defensas, electricidad, pozo, depuradora, cantera, muelle y trampa de pesca hechos, los efectos de combate, explosiones y fuego, y la luz pulida; calidad gráfica alta, media o baja en ☰ para móviles; guía de primeros pasos al empezar partida)
