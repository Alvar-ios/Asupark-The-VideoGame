# Drift Rush (Asupark-The-VideoGame)

Juego de carreras arcade para navegador (three.js). Un solo HTML final, sin servidor.

## Empezar
```bash
npm install
npm run build      # genera dist/index.html (abrirlo en el navegador)
npm run sim        # simulación sin gráficos: comprueba que todas las pistas se completan
```

## Estructura
- `src/car.js` física del coche (pesada, ERS, marchas) · `src/ai.js` rivales y récord de referencia
- `src/track.js` generador de pistas · `src/themes.js` pistas/escenarios · `src/world.js` escena 3D
- `src/game.js` bucle, HUD, menú, sectores, medallas · `src/audio.js` sonido
- `index.template.html` HTML/CSS · `build.mjs` empaqueta todo en `dist/index.html`
- `test/` simulación (`sim.mjs`) y pruebas de navegador con Playwright (`e2e*.cjs`)

## Flujo de trabajo
Ramas por cambio (`git checkout -b mi-cambio`), `npm run sim` antes de subir, y pull request.
Ideas pendientes: ranking online (Supabase), PWA, escenario de juguete en todas las pistas.
