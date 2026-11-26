# Economía de KartlosApp (propuesta para validar)

Las cifras de este documento ya están puestas en el juego (v0.0.118) para probarlas. Se cambian en `src/economy.js`.

## Dos monedas

| Moneda | Cómo se consigue | Para qué sirve |
|---|---|---|
| **Puntos** | Racha, misiones, caja diaria y objetos repetidos | Caja de boxes y compra directa |
| **Gemas** | Pocas: día 7 de racha, completar las tres misiones y caja diaria | Caja podio y compra de legendarias (cuando se pongan a la venta) |

## Racha de conexión

Si se falla un día, vuelve al día 1. Tras el día 7 empieza otra vez.

| Día | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Puntos | 50 | 60 | 70 | 80 | 100 | 120 | 150 |
| Gemas | | | | | | | 10 |

Una semana completa: 630 puntos y 10 gemas.

## Misiones diarias

Tres al día, una de cada nivel, y nunca dos de la misma clase. Se renuevan a las 4:00, como el reto.

| Nivel | Premio | Posibles |
|---|---|---|
| Fácil | 50 puntos | 5 vueltas válidas, salir 3 veces a pista, terminar la práctica del reto |
| Media | 80 puntos | 15 vueltas válidas, rodar en 2 circuitos |
| Difícil | 120 puntos | Mejorar tu mejor vuelta, marcar tiempo en la clasificación del reto, 30 vueltas válidas |

Completar las tres da además 3 gemas. En total, 250 puntos y 3 gemas al día.

## Cajas

| Caja | Precio | Común | Rara | Épica | Legendaria |
|---|---|---|---|---|---|
| Diaria | Gratis, 1 al día | 28 % | 8 % | 1,7 % | 0,3 % |
| De boxes | 600 puntos | 55 % | 30 % | 12 % | 3 % |
| Podio | 60 gemas | | 60 % | 32 % | 8 % |

El resto de la caja diaria (62 %) son monedas: 50 puntos (30 %), 100 puntos (18 %), 250 puntos (6 %) y 3 gemas (8 %).

El premio se decide y se guarda al pulsar «Abrir», antes de la animación. La ruleta se rellena con las mismas probabilidades que el premio: no se colocan objetos raros al lado para simular que «casi» tocan.

## Compra directa y repetidos

Las cajas no dan objetos repetidos: dentro de la rareza que toca, sale uno que todavía no tengas. Solo cuando ya tienes todos los de esa rareza puede salir uno repetido, que se cambia por puntos.

La tienda ofrece cada día un objeto común, uno raro y uno épico. Las legendarias solo salen en cajas.

| Rareza | Compra directa | Si sale repetido |
|---|---|---|
| Común | 500 puntos | 100 puntos |
| Rara | 1.200 puntos | 250 puntos |
| Épica | 3.000 puntos | 700 puntos |
| Legendaria | No se vende todavía (150 gemas previstas) | 2.000 puntos |

## Ritmo que sale con estas cifras

Medias calculadas sin contar los puntos de los repetidos, que solo aparecen al completar una rareza.

| Jugador | Puntos por semana | Gemas por semana | Cajas de boxes | Caja podio | Una legendaria cada |
|---|---|---|---|---|---|
| Entra cada día y hace las misiones | unos 2.700 | unas 33 | 4 o 5 por semana | cada 2 semanas | unas 5 semanas |
| Entra cada día sin hacer misiones | unos 970 | unas 12 | 1 o 2 por semana | cada 5 semanas | unas 12 semanas |

## Qué hay en las cajas ahora

66 objetos. Ninguno cambia las prestaciones: todos los karts corren igual.

De salida solo se tiene el Kart de alquiler en rojo, el mono de serie y los 12 cascos de siempre.

| Rareza | Objetos | Contenido |
|---|---|---|
| Común | 23 | 10 colores lisos, 4 pinturas mate, 5 cascos y 4 monos |
| Rara | 23 | 8 calcomanías, 6 karts, 3 pinturas metalizadas, 3 cascos y 3 monos |
| Épica | 14 | 5 karts, 3 cascos, 2 calcomanías, 2 pinturas neón y 2 monos |
| Legendaria | 6 | Kart «Turbo rojo», calcomanía «Nebulosa», pinturas cromo y oro, 1 casco y 1 mono |

Dentro de cada rareza, todos los objetos que aún no tienes salen con la misma probabilidad. Para quien juega a diario y hace las misiones, una legendaria concreta (por ejemplo, el kart «Turbo rojo») sale de media hacia las 18 semanas, y como no se repiten, las seis se completan en unas 30. Si parece demasiado, se puede dar más peso a los karts dentro de su rareza.

Quien introduce el código de cuenta completa en Ajustes lo tiene todo en ese dispositivo, sin que cambie lo conseguido de verdad. Es solo para probar: el código viaja dentro de la app como huella y habrá que sustituirlo por un permiso de cuenta en el servidor.

## Antes de dar valor real al saldo

1. **Pasarlo al servidor.** Ahora se guarda en el móvil: se puede trucar, se pierde al borrar datos y no se comparte entre dispositivos. El servidor tendrá que decidir saldos, premios y fechas. Los saldos de prueba se borrarán.
2. **Revisar la parte legal antes de vender puntos o gemas.** Pagar dinero por algo que luego se gasta en cajas al azar cuenta como caja botín. Hay países que las restringen, en España se ha planteado regularlas (hay que comprobar en qué estado está) y las tiendas de aplicaciones exigen publicar las probabilidades. Mientras no se venda nada, las probabilidades ya se muestran junto a cada caja.

## Pendiente de decidir

- Premios por posición al terminar un campeonato (necesita servidor).
- Garantía tras varias cajas seguidas sin nada épico o mejor.
- Qué objetos entran en la primera temporada.
