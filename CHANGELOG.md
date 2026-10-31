# Historial de versiones

Cada actualización sube la versión en `package.json`; el menú la muestra arriba a la derecha.

## 0.0.1
- Versión visible en el menú.
- Cinco coches nuevos por grupo (Cartoon, 100 CV, 150 CV, 200 CV, Competición y F1) con stats equilibrados por grupo y tres pinturas por coche.
- Modelos 3D con mucha más calidad; miniaturas en el selector (`node tools/thumbs.cjs`).
- Menú en una pantalla: lista de circuitos/coches desplegable a la derecha, circuito 3D de fondo (el del día por defecto) y bandera por país.
- Contrarreloj infinita con récord de grupo y de sectores en el HUD, aviso de sector y fantasma solo con el exterior.
- HUD y controles para móvil en vertical y en horizontal.
- Motor más bajo, limpio y redondo; arreglos de cortes de audio.

## 0.0.2
- Listas del menú con scroll vertical en móvil.
- HUD móvil mínimo: solo datos, sin textos.
- Marca de cada coche en el selector.

## 0.0.3
- Cartoon un 20% más pequeños.
- Circuitos Valle, Desierto, Neón y Nieve rediseñados (estrechos y cortos, estilo Interlagos, México, Suzuka y Alpino) con rasgos propios: túneles, curvas peraltadas y rampas a medida; también en Pruebas, Mónaco y Spa.
- IA calibrada con los tiempos reales de la clasificación (`node test/calib.mjs`).
- Clasificación por circuito y grupo, con diferencia al primero.

## 0.0.4
- Superficies que se notan: asfalto, mojado, tierra, grava, hierba, arena, nieve y hielo, cada una con su agarre, frenada, resistencia, dirección y tracción.
- Clima por circuito: temperatura (el frío enfría los neumáticos y cambia el hielo), humedad y viento con rachas.
- Circuitos de superficie mixta (hielo en Spa, Neón y Nieve; tierra, hierba, grava y arena en otros; tramos secos en los túneles). La pista del día es ahora procedural y estrecha, con dos tramos de otra superficie.
- La IA conoce el agarre de cada tramo. El HUD muestra superficie, temperatura y viento.

## 0.0.5
- Mónaco rehecho: calles estrechísimas, edificios pegados a las vallas, casi sin pianos y mucho más revirado.
- Carrera: arreglado el «cargando coches» que no dejaba empezar (se cargaban unos rivales y se creaban otros).
- Sectores estilo F1: barra fina de colores bajo el cronómetro y aviso compacto que no tapa la carretera.

## 0.0.6
- Mónaco: trazado inspirado en el real (Santa Devota, subida de Beau Rivage, Massenet, Casino, horquilla, túnel, chicane, Tabac, piscina y Rascasse) con sus subidas y bajadas.
- Edificios más bajos, con huecos y no siempre pegados a la valla.
- Túnel cerrado desde el suelo, más alto, con marcos en las bocas y luces dentro.
