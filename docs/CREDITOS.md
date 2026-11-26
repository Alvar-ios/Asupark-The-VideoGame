# Créditos de los modelos 3D

Karts añadidos en la v0.0.120. Cada archivo declara licencia CC BY 4.0, que obliga a citar a quien lo subió.
Se han modificado: orientación, escala, ruedas separadas y texturas reducidas (tools/prep-skins.mjs).

| En el juego | Archivo original | Subido por | Enlace |
|---|---|---|---|
| Kart estándar | standard kart | amogusstrikesback2 | https://sketchfab.com/3d-models/standard-kart-2e0996e9b43e4a9385c4e0ee64cbb169 |
| Pizzería (6) | Fnaf SB Go Karts | RISE OF PHOENIX | https://sketchfab.com/3d-models/fnaf-sb-go-karts-db8a1e200ca249b4a690d5e29a50b94b |
| Tarta de chuches, Piruleta, Menta helada, Bizcocho, Pastel de fresa | Sugar rush karts, Storybook | Razy | https://sketchfab.com/3d-models/sugar-rush-karts-storybook-05cffff8f28b4d18965b5b7e0e3b05f3 |

## Circuitos (v0.0.122)

| En el juego | Archivo original | Subido por | Enlace |
|---|---|---|---|
| Misty Cliffs | boom karts misty cliffs | amogusstrikesback2 | https://sketchfab.com/3d-models/boom-karts-misty-cliffs-749d38ab2441491da0759b25863292fc |
| Mario Circuit 3 | Mario Kart 8 Deluxe, SNES Mario Circuit 3 | Fortnite (jkimmel694) | https://sketchfab.com/3d-models/mario-kart-8-deluxe-snes-mario-circuit-3-71ba7c86cd7d475cb5e21a1c87243520 |

Declaran CC BY 4.0. Se han modificado: escala, texturas reducidas, geometría aligerada y piezas de fondo quitadas
(tools/prep-tracks.mjs). Para quitar uno: borrar su tema en `src/themes.js`, su entrada en `src/visible.js` y su
archivo `src/assets/track_*.glb.gz`.

## Aviso antes de abrir la app al público

La etiqueta CC BY la pone quien sube el archivo y solo vale sobre lo que sea suyo. Estos modelos reproducen
diseños de juegos y películas de otras empresas (Mario Kart y Mario Circuit son de Nintendo, Boom Karts es
otro juego comercial, y Five Nights at Freddy's y Sugar Rush, de Disney, también tienen dueño), así que no hay garantía de que se puedan usar. El kart estándar
lleva además el emblema de Mario. El repositorio y la web son públicos: pueden recibir una petición de retirada.
Para uso entre amigos y pruebas el riesgo es bajo; antes de difundir la app o cobrar por algo hay que
sustituirlos por modelos propios o con licencia del titular.

Para quitar uno: borrar su línea en `src/economy.js`, su archivo `src/assets/skin_*.glb.gz` y su miniatura.
