# Óxido: documento de diseño

Copia de trabajo del documento de diseño (versión editable original: https://claude.ai/code/artifact/2f4d0515-d7c8-4770-91a5-92e8a8573fc2). Si cambia el diseño, actualiza este archivo.

## Resumen

Juego de gestión de colonia para navegador, de un jugador, en pixel art y vista cenital, inspirado en RimWorld. Sobrevives en un mundo postapocalíptico con un grupo de colonos que recogen recursos, construyen, investigan y defienden la base de saqueadores, mutantes y máquinas.

| Decisión | Elección |
| --- | --- |
| Plataforma | Web (navegador), jugable completo en móvil y PC; versión publicada desde el primer día |
| Modo | Un jugador |
| Estilo visual | Pixel art, vista cenital |
| Ambientación | Postapocalíptica |
| Control de colonos | Mixto: trabajan solos por prioridades; en combate se pueden controlar directamente |
| Tono | Supervivencia dura: escasez, muerte permanente |
| Mapa | Generado al azar en cada partida (100 × 100 casillas), 3 colonos iniciales |

Pilares de diseño:

1. Cada recurso cuesta: la escasez obliga a elegir entre construir, investigar o defenderse.
2. Los colonos son personas: necesidades, habilidades y ánimo que cambian sus decisiones.
3. Historias emergentes: los sistemas chocan entre sí y generan situaciones no guionizadas.
4. Siempre jugable: cada sesión de trabajo deja una versión publicada que funciona.

## Mundo y mapa

Décadas después de un colapso, el mundo es un páramo de ruinas, bosques muertos y zonas irradiadas. La colonia empieza con 3 supervivientes y pocos recursos.

- Mapa de casillas generado con ruido procedural a partir de una semilla; la misma semilla genera siempre el mismo mapa.
- Suelo continuo con transiciones suaves (tierra, arena, pedregal, roca, asfalto viejo, agua). La variedad viene de objetos encima, no de bloques de color: árboles secos, tocones, matorrales, rocas, piedras, chatarra, coches abandonados, muros derruidos, escombros, barriles tóxicos, charcos radiactivos, manantiales, huesos y neumáticos.
- Zonas irradiadas: tinte suave del suelo más barriles y charcos; carreteras viejas con edificios en ruinas.
- Agua: ríos que cruzan el mapa, lagos, manantiales y acuíferos subterráneos para pozos; parte del agua está contaminada y hay que filtrarla.
- Geografía variada que condiciona la construcción: colinas, acantilados, cañones, mesetas, pasos estrechos y llanuras. Los ríos se cruzan con puentes y el terreno alto da ventaja defensiva.
- Ruinas con chatarra, componentes y restos saqueables; yacimientos de piedra y metal.

| Grupo | Comportamiento |
| --- | --- |
| Saqueadores | Raids armados que buscan robar recursos y secuestrar colonos |
| Mutantes y criaturas | Ataques en manada, más frecuentes cerca de zonas irradiadas |
| Máquinas y drones | Restos autónomos de la guerra; muy resistentes, dejan componentes valiosos |
| Facciones con diplomacia | Asentamientos con relación variable: comercio, alianza, tributo o guerra |

## Sistemas de juego

La primera versión jugable incluye colonos, recursos, construcción, necesidades y combate; investigación y facciones llegan después.

**Colonos**
- Habilidades (construcción, minería, cultivo, cocina, combate, investigación, medicina) con nivel 0–20 que sube con la práctica.
- Rasgos de personalidad que afectan ánimo y rendimiento.
- Control mixto: el jugador fija prioridades de trabajo y los colonos eligen tareas solos; en combate se pueden seleccionar y mover directamente.
- Muerte permanente. Nuevos colonos llegan como refugiados, prisioneros reclutados o aliados.

**Recursos y trabajos**
- Recursos: madera, piedra, chatarra, componentes, comida, agua potable, combustible, medicinas, munición. El agua es escasa y crítica; el combustible alimenta generadores y algunas armas.
- Trabajos: talar, minar, saquear ruinas, transportar a zonas de almacén, cultivar, cocinar, fabricar.

**Construcción**
- Planos colocados por el jugador que los colonos construyen gastando recursos.
- Muros, puertas, suelos, camas, almacenes, bancos de trabajo, cultivos, defensas (barricadas, torretas).

**Necesidades**
- Hambre, sed, sueño, salud y ánimo. Con ánimo bajo, los colonos trabajan peor y pueden sufrir crisis.
- Heridas localizadas que necesitan tratamiento; infecciones si no hay medicinas.

**Combate y raids**
- Raids periódicos cuya fuerza escala con la riqueza de la colonia.
- Niveles de dificultad configurables al empezar: días sin raids (de 0 a unos 10) y dureza general.
- Armas cuerpo a cuerpo y a distancia. Cobertura tras muros, barricadas y rocas: reduce la probabilidad de recibir impactos y da bonificación de precisión al disparar desde ella.

**Tiempo**
- Pausa, x1, x2 y x3.

**Investigación** (fase 5)
- Árbol tecnológico en un banco de investigación: puentes, torretas, cañones, cultivos hidropónicos, energía.

**Facciones y economía** (fase 6)
- Caravanas comerciales con trueque sin moneda: cada objeto tiene un valor y se intercambia por otros de valor equivalente.
- Mercado global simulado: el valor de cada recurso cambia según la oferta y la demanda. Compradores y facciones simulados compran, venden y acaparan según sus propias necesidades.
- Relaciones con facciones: comercio, alianza, tributo o guerra.

**Guardado**
- Manual y automático en el navegador, con exportar e importar a archivo. En el futuro, guardado online en la nube.

## Tecnología

TypeScript + Phaser 3 + Vite, tests con Vitest, publicado en GitHub Pages. Simulación separada del dibujado; definiciones de contenido en JSON. Interfaz adaptable a móvil y PC: arrastrar = mover cámara, pellizcar = zoom, tocar = seleccionar, mantener pulsado = órdenes.

Prioridad (Mikel, 2026-10-18): primero todo el contenido (catálogo en `docs/CATALOGO.md`); la vista 3D queda aparcada. La simulación y el contenido se mantienen independientes del motor de dibujado para poder pasar más adelante a uno con mejor 3D.
