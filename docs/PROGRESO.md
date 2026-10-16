# Progreso

Diario de sesiones, la más reciente arriba.

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
