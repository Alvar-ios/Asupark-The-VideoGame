# Drift Rush

Juego de carreras arcade 3D para navegador, desarrollado con Three.js. El juego se ejecuta en el navegador; no hay un servidor de juego ni backend online por ahora.

## Desarrollo local

```bash
npm install
npm run serve
```

Abre la URL que imprime el servidor (normalmente `http://localhost:4173`). Si ese puerto ya está ocupado, probará automáticamente el siguiente, por ejemplo `4174`. Déjalo abierto mientras juegas y usa `Ctrl+C` para cerrarlo. `npm run serve` compila y sirve `dist/` para que el navegador pueda cargar los modelos y sonidos locales. No abras `dist/index.html` con doble clic: los navegadores bloquean algunas cargas de archivos locales.

`npm run build` compila el HTML, el bundle JavaScript y los modelos en `dist/`. La interfaz se mantiene en `index.template.html`, el juego en `src/` y los modelos se cargan bajo demanda desde `src/assets/`.

## Despliegue

`vercel.json` configura `npm run build` como compilación y `dist` como salida estática. Al desplegar en Vercel, se accede desde una URL web; los tiempos y récords siguen guardándose localmente en el navegador. Ligas y clasificaciones compartidas requerirán un backend futuro.

## Estructura

- `src/car.js`: coches y física.
- `src/ai.js`: rivales y perfiles de referencia.
- `src/track.js`: generación de circuitos.
- `src/themes.js` y `src/world.js`: climas, superficies y mundo 3D.
- `src/game.js`: cámara, carrera, interfaz y efectos.
- `src/audio.js`: audio del juego.
- `src/assets/`: modelos GLB comprimidos, cargados bajo demanda.
- `build.mjs` y `serve.mjs`: compilación y servidor de desarrollo local.
- `PROJECT_PLAN.md`: visión y decisiones del proyecto.

## Coches 3D

Los modelos se preparan desde archivos `.glb` optimizados con varios niveles de detalle para reducir la descarga inicial y mostrar primero una versión ligera. `tools/optimize-glb.mjs` y `tools/prep-car.mjs` contienen utilidades para preparar modelos; algunas requieren dependencias adicionales descritas en sus cabeceras.

## Verificación

`npm run build` comprueba que el bundle se compile. `npm run sim` ejecuta una simulación sin gráficos.
