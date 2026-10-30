# Drift Rush

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

## Coches 3D (.glb)
El VW Bora VR6 se carga desde `src/assets/bora_*.glb` (incrustado en el HTML al compilar).
- Versiones optimizadas: carrocería `hi` (~49k tris) y `lo` (~15k) + rueda `hi`/`lo`; compresión meshopt.
- `tools/optimize-glb.mjs` regenera esos archivos desde el modelo original (necesita `@gltf-transform/*` y `meshoptimizer` en una carpeta aparte; ver cabecera del script).
- Materiales por rol (PAINT, CHROME, GLASS, LENS…); la pintura (`PAINT`) se recolorea desde el menú.
- Para añadir otro coche: carrocería con el morro hacia +Z, sin ruedas, y una rueda en el origen con el eje en X.

## Despliegue (Vercel)
`vercel.json` ya configura `npm run build` y `dist`. Importar el repositorio en Vercel y listo; cada rama genera una URL de prueba.
