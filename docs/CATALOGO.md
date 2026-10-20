# Catálogo de contenido

Todo el contenido que falta para terminar el juego, con números, para que Mikel lo revise **una vez** (orden suya del 2026-10-18: primero definir e implementar todo el contenido; la 3D, aparcada).

**Cómo revisarlo**: cambia los números que no te gusten, tacha (`~~así~~`) lo que no quieras y pon **✅ Aprobado** al lado del título de cada bloque (o dilo por el chat o con 🐞). Lo de un bloque aprobado pasa a «Pendiente» de `FEEDBACK.md` y las sesiones lo implementan sin volver a preguntar. Lo marcado *(opcional)* no está en el diseño: solo entra si lo apruebas.

Escalas que ya usa el juego, para comparar: muro de madera 🪵5 y 150 de vida; puños = daño ×1, machete ×2,8, arco ×1,6 a 8 casillas; un colono con Investigación 10 es la medida de «1 h de investigación»; valores en chapas (madera 1, chatarra 2, componentes 12).

Lo ya aprobado y pendiente (puerta automática, fuego amigo y posturas, combustible ⛽, destilería y buggy) no se repite aquí.

---

## 1. Salud: infecciones y medicinas (fase 4) — ✅ Aprobado (2026-10-18)

- **Infección**: una herida que no se cura en 12 h tiene un 20 % de infectarse (8 % si la curó alguien sin medicina, 2 % con medicina). Infectado: −15 % de ánimo y de velocidad de trabajo; empeora cada día salvo que se le trate con una medicina (1 💊 al día durante 2 días). Sin tratar 3 días seguidos, muere.
- **Nuevo recurso 💊 Medicina** (valor 20). Se fabrica en la **mesa de boticario** (🪵15 🔩6, 2×1, 🏗 → Talleres): 4 🌿 hierba + 1 🧵 → 1 💊 (300 de trabajo, habilidad Medicina). También aparece en ruinas y la venden las caravanas.
- **Nuevo cultivo 🌿 Hierba curativa**: 5 días, cosecha 4–6, tierra media (fertilidad ≥ 0,45).
- Curar con medicina cierra la herida el doble de rápido.

## 2. Mutantes y criaturas (fase 4) — ✅ Aprobado (2026-10-18)

- **Perros mutantes**: manada de 3 a 8 desde el día 8; rápidos (×1,5 al andar), poca vida (60 % de un colono), mordisco ×1,2. Huyen al caer la mitad. No rompen muros ni puertas.
- **Bruto mutante**: desde el día 15, 1 por cada 3 perros; lento (×0,7), el triple de vida, golpe ×3, **rompe muros y puertas** (como un saqueador con tubería).
- Llegan en lugar de un raid de saqueadores 1 de cada 3 veces (1 de cada 2 si la colonia está a menos de 25 casillas de una zona irradiada).
- Al morir dejan **cadáver**: se puede quemar en una hoguera (🪵5) o dejar que se pudra (−5 % de ánimo a quien lo ve a 5 casillas).

## 3. Banco de investigación y árbol (fase 5) — ✅ Aprobado (2026-10-18)

- **Banco de investigación** (🪵20 🔩15 ⚙️2, 2×1, 🏗 → Talleres). Trabajo nuevo «Investigar» (habilidad Investigación). Se elige un proyecto en 📜 → 🔬 Investigación; avanza mientras alguien investiga. Lo construido hasta ahora sigue libre, no hace falta investigarlo.
- **Árbol** (horas para un colono con Investigación 10; entre paréntesis, lo que pide antes):

| Proyecto | Horas | Desbloquea |
| --- | --- | --- |
| Puentes | 4 | Puente de madera y de metal |
| Medicina de campo | 6 | Mesa de boticario, 💊 y la hierba curativa (si se aprueba el bloque 1) |
| Agricultura mejorada | 8 | Abono (🍄2 + 🪨1 → 3 abono; huerto abonado +25 % de cosecha) |
| Pólvora | 8 | Balas y pistola casera |
| Armas largas (Pólvora) | 12 | Escopeta y rifle |
| Hidropónica | 10 | Bandeja hidropónica |
| Blindaje avanzado (Armas largas) | 12 | Chaleco táctico y casco táctico |
| Torretas (Pólvora) | 14 | Torreta ligera |
| Artillería (Torretas) | 20 | Torreta pesada y mortero |
| Radio (Medicina de campo) | 10 | Radio: contactar con facciones (fase 6) |

## 4. Armas de fuego y balas (fase 5, ya aprobadas; faltan los números) — ✅ Aprobado (2026-10-18)

| Arma | Daño | Ritmo | Alcance | Coste (banco de trabajo) |
| --- | --- | --- | --- | --- |
| Pistola casera | ×2,2 | normal | 9 | 🔩8 ⚙️1 |
| Escopeta | ×3,6 (a 3 casillas o menos; ×1,8 más lejos) | lento | 6 | 🔗6 ⚙️2 |
| Rifle | ×3,0 | lento | 14 | 🔗8 ⚙️3 🪵4 |

- **Balas**: 🔩3 ⚙️1 → 15 balas (cada disparo gasta 1). Los tiradores cogen 20 como con las flechas.
- Saqueadores: pistolas desde el día 15, escopetas y rifles desde el día 25.

## 5. Defensas, agua y construcción (fase 5) — ✅ Aprobado (2026-10-18)

- **Puente** de madera (🪵8 por casilla, se pudre: pierde vida si no se repara en 20 días) y de metal (🔗4 por casilla). Sobre agua de hasta 4 casillas de ancho.
- **Torreta ligera** (🔩25 ⚙️4, 1×1, 120 W): dispara sola como una pistola a 9 casillas sin gastar balas; sin corriente, apagada.
- **Torreta pesada** (🔗30 ⚙️6, 2×2, 300 W): como un rifle a 14 casillas.
- **Mortero** (🔗20 ⚙️4 🔩10, 1×1): lo maneja un colono; cada disparo gasta 🔩2, daña 3×3 a 6–20 casillas, falla un 40 %.
- **Bandeja hidropónica** (🔩10 ⚙️2, 1×2, 100 W): cultiva patatas, maíz o hierba bajo techo y sobre suelo, ×1,5 más rápido, sin fertilidad; sin corriente, no crece.
- **Chaleco táctico** (🔗10 ⚙️2 🧵6: −45 % de daño, −5 % al andar) y **casco táctico** (🔗6 ⚙️1: −20 %).

## 6. Máquinas y drones (fase 5) — ✅ Aprobado (2026-10-18)

- Desde el día 30, 1 de cada 4 ataques. Muy resistentes y sin moral (no huyen).
- **Dron de vigilancia**: vuela (ignora muros, zanjas y barricadas), poca vida, dispara como una pistola. 2–4 por ataque.
- **Araña de chatarra**: el cuádruple de vida que un colono, golpe ×3, armadura −40 %, rompe muros; 1–2 por ataque.
- Al destruirlos dejan 🔩10–20 y ⚙️2–4. Las armas de fuego hacen +25 % a las máquinas.

## 7. Facciones y diplomacia (fase 6) — ✅ Aprobado (2026-10-18)

- Tres asentamientos fijos en cada partida (nombres al azar), con relación de −100 a 100:
  - **Chatarreros** (empiezan en 20): comerciantes; traen las caravanas.
  - **Granjeros del valle** (empiezan en 0): venden comida y semillas; posibles aliados.
  - **Hijos del Óxido** (empiezan en −60): hostiles; sus raids son los saqueadores.
- Sube la relación: regalar (1 punto cada 20 chapas), liberar a sus prisioneros (+15), comerciar (+2 por caravana). Baja: matar o retener a los suyos (−10), negarse a un tributo (−20).
- Con 60 o más, **alianza**: si te atacan, mandan 2–4 combatientes (una vez cada 10 días). Con −50 o menos, guerra: raids propios además de los normales.
- **Tributo**: los Hijos del Óxido pueden pedir recursos (unas 200 chapas); pagar evita su próximo raid.
- Con la **Radio** (investigación), en 📜 → Facciones se puede llamar a una caravana o pedir ayuda.

## 8. Comercio y mercado (fase 6) — ✅ Aprobado (2026-10-18)

- El trueque por valor ya existe; se añade un **mercado**: el valor de cada recurso va del 50 % al 200 % de su base según lo que hay en el mundo. Si vendes mucho de algo, baja; si escasea, sube. Se recupera un 10 % al día hacia su valor base.
- Cada caravana viene con **necesidades** (2–3 recursos que paga a +50 %) y **sobrantes** (que vende a −30 %), según su facción.
- 📜 → Comercio muestra la tendencia de cada recurso (▲ ▼).

## 9. Sucesos (fase 6) — ✅ Aprobado (2026-10-18)

| Suceso | Efecto |
| --- | --- |
| Tormenta de polvo | 1 día: las placas solares no producen y el alcance de los disparos baja a la mitad |
| Lluvia ácida | 6 h: daña los cultivos al aire libre (−30 % de cosecha) y a quien está fuera |
| Plaga | Un huerto pierde la mitad de sus plantas si no se arrancan las enfermas en 1 día |
| Avería | Una máquina eléctrica se para hasta que un colono la arregla (⚙️1) |
| Alijo | Aparece un alijo de recursos en el mapa (valor 150–400) |
| Refugiado herido | Pide ayuda; si se le cura, se une o se marcha (+relación con su facción) |
| Ola de frío | *(Solo si se aprueba el bloque 11)* |

## 10. Animales y caza *(opcional)* — ✅ Aprobado (2026-10-18)

- Ciervos mutados, jabalíes y ratas gigantes por el mapa. Orden ⚒ → 🎯 Cazar: dan **🥩 carne** (cruda, se cocina como lo demás) y **🟫 cuero**; el chaleco de cuero pasaría a pedir cuero en vez de fibra.
- Los jabalíes heridos atacan; las ratas gigantes roban comida de los almacenes sin muros.

## 11. Temperatura, estaciones y ropa *(opcional)* — ✅ Aprobado (2026-10-18)

- Estaciones de 10 días (primavera, verano, otoño, invierno). En invierno no crece nada al aire libre y hace frío de noche: sin estar en una habitación con **estufa** (🪨10 🔩6, gasta 🪵1 cada 3 h) o con **abrigo** (🧵10), −10 % de ánimo y riesgo de hipotermia.

## 12. Ocio y habitaciones *(opcional)* — ✅ Aprobado (2026-10-18)

- Calidad de las habitaciones según su tamaño y muebles (mesa, sillas, alfombra, cuadro): de −5 % a +10 % de ánimo.
- Ocio: mesa de juego (🪵15) y hoguera para reunirse; sin ratos libres en 2 días, −8 % de ánimo.

## 13. Árbol de investigación completo (fases 5 y 6) — ✅ Aprobado (2026-10-19)

Pedido y elegido por Mikel en el chat el 2026-10-19. Junta en un solo árbol los 10 proyectos del bloque 3 y lo que piden los bloques aprobados, más el contenido nuevo que eligió (trampas, armas, fosos y construcciones). Lo que ya se puede construir sigue libre, salvo lo que se diga aquí. Horas para un colono con Investigación 10 (Mikel: «como están»); entre paréntesis, lo que pide antes. **Negrita**: proyecto nuevo, que no estaba en el bloque 3.

### Rama de supervivencia

| Proyecto | Horas | Pide | Desbloquea |
| --- | --- | --- | --- |
| Medicina de campo | 6 | — | Según lo que elija Mikel en «Propuestas para Mikel» (A: mesa de boticario y hierba; B: curar con 💊 un 25 % más rápido) |
| **Medicina avanzada** | 12 | Medicina de campo | Las heridas se curan un 25 % antes y la infección sale la mitad de veces |
| Agricultura mejorada | 8 | — | Abono (🍄2 + 🪨1 → 3 abono; huerto abonado +25 % de cosecha) |
| Hidropónica | 10 | Agricultura mejorada | Bandeja hidropónica |
| **Sastrería** | 6 | — | Abrigo (🧵10) y, con la caza, el chaleco de cuero con 🟫 cuero (bloques 10 y 11) |
| **Calefacción** | 8 | Sastrería | Estufa (🪨10 🔩6, gasta 🪵1 cada 3 h) (bloque 11) |
| **Baterías mejoradas** | 8 | — | Las baterías guardan el doble |

### Rama de armas

| Proyecto | Horas | Pide | Desbloquea |
| --- | --- | --- | --- |
| Pólvora | 8 | — | Balas y pistola casera ✔ hecho |
| Armas largas | 12 | Pólvora | Escopeta y rifle |
| **Armas automáticas** | 14 | Armas largas | Subfusil (×1,3, muy rápido, 7 casillas, gasta balas; 🔗6 ⚙️3) y rifle de francotirador (×4,5, muy lento, 18 casillas; 🔗10 ⚙️4 🪵4) |
| **Explosivos** | 6 | Armas largas | Granadas caseras (🔩2 ⚙️1 → 2): se lanzan a 6 casillas, daño ×3 en 3×3 |
| **Ballesta** | 8 | — | Ballesta (×2,4, lenta, 10 casillas, gasta flechas; 🪵6 🔩4 🧵3) |
| **Forja** | 8 | — | Lanza de metal (×2,6, alcance 2; 🔗4 🪵2) |
| Blindaje avanzado | 12 | Armas largas | Chaleco táctico y casco táctico |

### Rama de defensa

| Proyecto | Horas | Pide | Desbloquea |
| --- | --- | --- | --- |
| Torretas | 14 | Pólvora | Torreta ligera ✔ hecho |
| Artillería | 20 | Torretas | Torreta pesada ✔ hecho y mortero ✔ hecho |
| **Ametralladoras** | 16 | Artillería | Torreta rotativa ✔ hecho (🔗25 ⚙️8, 1×1, 400 W, sin munición): ×1,2 por disparo, 3 veces más rápida que la ligera, 10 casillas |
| **Trampas** | 8 | — | Mina casera (🔩6 ⚙️1, pide también Pólvora: explota en 3×3, daño ×4, se gasta) y trampa eléctrica (🔩6 ⚙️2, 50 W, pide también Baterías mejoradas: aturde 5 s a quien la pisa mientras tiene corriente) |
| **Fortificación** | 8 | — | Alambre de espino (🔩2 por casilla: frena ×3 y hace un poco de daño a quien lo cruza) y muro con aspilleras (de piedra o metal: se dispara desde detrás con cobertura del 75 %) |
| **Desguace de máquinas** | 10 | Torretas | Los drones y arañas destruidos dejan el doble de ⚙️ |

**Libres, sin investigar**: sacos de arena (🧵2 🪨3 por casilla, se ponen en un momento, cobertura del 50 %, 100 de vida; al demolerlos devuelven todo).

### Rama del agua (update del agua)

| Proyecto | Horas | Pide | Desbloquea |
| --- | --- | --- | --- |
| Puentes | 4 | — | Puente de madera y de metal, plataformas y muelle (la pesca y las trampas de pesca, libres con el muelle) |
| **Hidráulica** | 10 | Puentes | Molino de agua (500 W), puente levadizo y **foso con agua** (una zanja que toca el agua se inunda; nadie la cruza andando, solo por un puente o un puente levadizo) |
| **Navegación** | 8 | Puentes | Balsa |
| **Motores** | 14 | Navegación, Pólvora | Lancha armada (⛽) |

### Rama de contacto (fase 6)

| Proyecto | Horas | Pide | Desbloquea |
| --- | --- | --- | --- |
| Radio | 10 | Medicina de campo (o nada, según la propuesta C) | Radio: llamar a una caravana o pedir ayuda a los aliados |
| **Rutas comerciales** | 8 | Radio | En 📜 → Comercio, ver la tendencia de precios (▲ ▼) y las necesidades de la próxima caravana antes de que llegue |

Total: 26 proyectos y 256 h para un colono con Investigación 10 (unos 26–32 días de juego con un investigador que dedique 8–10 h al día; con dos, la mitad).

- **Descartado** por Mikel: la munición perforante, el cepo, la fosa de estacas, la maza de chatarra, el revólver y la escopeta recortada.
- **Lanzallamas**: aprobado, pero va con el **fuego** (aparcado): se hará cuando se haga el fuego.
- Los demás proyectos nuevos se hacen cuando toque su contenido, en el orden de «Pendiente» de `FEEDBACK.md`.
