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
- Versiones optimizadas: carrocería `hi` (~183k tris), `mid` (~68k) y `lo` (~20k) + ruedas; gzip, sin WebAssembly.
- `tools/optimize-glb.mjs` regenera esos archivos desde el modelo original (necesita `@gltf-transform/*` y `meshoptimizer` en una carpeta aparte; ver cabecera del script).
- Materiales por rol (PAINT, CHROME, GLASS, LENS…); la pintura (`PAINT`) se recolorea desde el menú.
- Para añadir otro coche: carrocería con el morro hacia +Z, sin ruedas, y una rueda en el origen con el eje en X.

## Despliegue (Vercel)
`vercel.json` ya configura `npm run build` y `dist`. Importar el repositorio en Vercel y listo; cada rama genera una URL de prueba.

## Carga de modelos y CSP
Los .glb van incrustados en gzip (`src/assets/*.glb.gz`) y se leen con `DecompressionStream` + `GLTFLoader.parse` (`src/glbload.js`):
no usan `fetch` ni WebAssembly, así que funcionan también en páginas con CSP estricta (p. ej. artefactos de Claude).
`test/csp_server.py` sirve `dist/` con una CSP restrictiva para comprobarlo.

## Coches y circuitos
- Coches: VW Bora VR6, Porsche 911 (964) Turbo S, Turbo GT, Drifter, Bruiser. Pintura personalizable desde el menú.
- Circuito *Puerto Urbano* (estilo Mónaco): trazado fijo (`fixedNodes`), perfil de altura (`hillPts`), pianos con vibración y cuestas más exigentes.
