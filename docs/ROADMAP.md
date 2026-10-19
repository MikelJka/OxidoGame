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
- [ ] Salud: heridas localizadas, tratamiento, infecciones (hechas heridas, curas, infecciones y 💊 Medicina; faltan la mesa de boticario y la hierba curativa)
- [x] Dificultad configurable al empezar (días sin raids, dureza)
- [ ] Raids de saqueadores y mutantes que escalan con la riqueza (hechos los saqueadores; faltan los mutantes)
- [ ] Combate: armas cuerpo a cuerpo y a distancia, cobertura con bonificaciones, control directo (hecho: control con 🎖, armas cuerpo a cuerpo y arco, cobertura y alcance, armadura, la moral de los raids con su líder ★ y el pánico de los colonos y el fuego amigo y las posturas; faltan las armas de fuego, con la investigación)
- [x] Muerte permanente y fin de partida
- [x] Avisos en pantalla de raids, peleas, heridos, caídos, muertes, pánico, visitas y caravanas (#17, #18)
- [x] Supervivientes que piden unirse, prisioneros (capturar, retener, convencer, liberar) y caravanas con esclavos
- [ ] Más colonos (#21): hecho que el primer superviviente llegue el día 2 y luego uno cada 2-4 días; falta la radio de llamada
- [ ] Prioridad médica tras los combates (hecho: sin saqueadores en pie, cualquier colono no reclutado deja lo que hace y cura primero a los colonos que sangran, y al que está en el suelo lo lleva a una cama libre; faltan que el herido que sigue en pie vaya él a la cama y curarse uno mismo)
- [x] Derribar en vez de matar; capturar, saquear o rematar (#22): los golpes derriban sin matar; en el suelo sueltan lo que llevan y se elige ⛓ Capturar (con cama de prisionero libre) o 🗡 Rematar (baja el ánimo); el médico los cura donde están

## Fase 5 — Investigación y máquinas

- [ ] Banco de investigación y árbol tecnológico en JSON
- [ ] Puentes, torretas, cañones, filtros de agua, pozos, generadores de combustible (hechas las torretas eléctricas ligera y pesada, pedidas por Mikel antes de la investigación, y la destilería de ⛽ combustible)
- [ ] Enemigos máquina y drones

## Fase 6 — Facciones y economía

- [ ] Facciones con relaciones y diplomacia
- [ ] Caravanas y trueque por valor
- [ ] Mercado global simulado con oferta y demanda
- [ ] Eventos, arte definitivo y equilibrio
