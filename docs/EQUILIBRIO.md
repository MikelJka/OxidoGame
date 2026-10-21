# Equilibrio con partidas simuladas

Herramienta: `bun scripts/equilibrio.ts <semilla> <dificultad> <días>` juega una partida sin pantalla con
un «jugador» sencillo (almacén, huertos de patata y maíz, camas, cocina con guiso, banco de trabajo con
armas y munición, banco de investigación, hoguera, muros de madera el día 6, recoger madera y chatarra
alrededor, acepta a los supervivientes y recluta a todos y los junta en la colonia ante un ataque) y
devuelve una línea JSON con lo que pasa cada día (colonos vivos, comida, ánimo, riqueza), las muertes y
los raids.

## 2026-10-21 — primera ronda (Normal, 30 días, 8 semillas)

Antes de los cambios, ninguna de las 8 colonias pasaba del día 18; casi todas caían en el primer o el
segundo ataque. Causas encontradas:

| Problema | Qué pasaba | Cambio |
| --- | --- | --- |
| Ola de frío | Podía tocar el día 4, en primavera: hipotermia para todos sin abrigos ni estufas (aún sin investigar) y la colonia llegaba al primer raid con la salud a 0,4 | Solo en otoño e invierno y desde el día 15; la hipotermia ya no baja la salud de 0,35. Tormenta eléctrica e incendio desde el día 8, plaga desde el 6 |
| Caer herido | Un golpe dejaba a 0 y mataba; el caído sangraba unas 2 «unidades» y se desangraba en ~1 h | Un golpe no mata a quien está de pie (como pasa con los saqueadores); el sangrado tiene tope (1,2) y en el suelo va al 40 %: varias horas para curarle |
| Infección | Sin 💊 mataba siempre a los 3 días, y al principio no hay 💊 | Mata al 4.º día sin dosis; cada día, bien comido y bebido, el cuerpo la vence solo con un 30 %; se empieza con 3 💊 |
| Manadas | Desde el día 8 podían llegar hasta 8 perros | El máximo empieza en 3 y sube 1 cada 4 días (8 hacia el día 28) |
| Rendimiento | Con la colonia amurallada, cada saqueador sin camino lo buscaba en cada tic: un día de juego costaba 150 s | Esperan 1,5 s antes de reintentar: el mismo día cuesta unos 4 s |

Después de los cambios (mismas 8 semillas): 7 de 8 colonias llegan al día 30 (de 1 a 16 colonos), con
26 investigaciones en las que tienen banco. Las muertes que quedan son sobre todo en los raids grandes de
los días 16–25 (5–9 saqueadores con armas de fuego o un buggy) y algo de hambre cuando la colonia crece
más que sus huertos. Eso es en buena parte cosa del «jugador» de la simulación (no hace torretas, ni
amplía huertos, ni coloca a los colonos tras los muros), así que no se ha tocado: una persona jugando
debería aguantarlos. Si en las partidas de verdad los raids de mitad de partida se notan demasiado
duros, el siguiente paso sería suavizar `raidSize` (riqueza / 1500) o el día de las armas de fuego.
