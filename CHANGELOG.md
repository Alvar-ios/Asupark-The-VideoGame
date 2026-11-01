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

## 0.0.7
- IA con las mismas stats que tu coche (sin trucos de potencia): línea de carrera óptima y conducción más suave.
- Diez pilotos con nombre, país y nivel (de Senna a Woods), repartidos al azar entre los coches rivales en cada carrera.
- Torre de posiciones en tiempo real durante la carrera.
- Contrarreloj con salida lanzada: el crono arranca al cruzar la meta.
- Gran Premio: 3 vueltas de clasificación, parrilla según tu mejor vuelta y 5 vueltas de carrera contra 9 pilotos.
- Peraltes corregidos: la superficie sube con la inclinación, empujan hacia dentro y dan más agarre y giro.

## 0.0.8
- Carreras y Gran Premio: los rivales son siempre del mismo grupo que tu coche, al azar y pudiendo repetirse.
- Diferencias de la torre siempre sobre ti (− va por delante, + por detrás).
- Al terminar: resultados completos con todos los pilotos, podio y confeti; se espera a que acaben los demás.
- Salida lanzada con piloto automático y cuenta atrás 3-2-1 hasta la meta.
- Clasificación del Gran Premio con los tiempos de los rivales en directo.
- Mónaco: pista más ancha, menos edificios y sin edificios dentro de las curvas.

## 0.0.9
- Piloto automático de la salida lanzada rehecho: parte más lento, respeta la línea de carrera y llega a la meta sin chocar en todos los circuitos y coches (`node test/autopilot.mjs`). La cuenta atrás dura 5 s.
- Los sectores ya no tapan la pantalla: el tiempo y la diferencia salen dentro de su casilla, arriba junto al cronómetro, y el resultado de la vuelta aparece en la línea del cronómetro.

## 0.0.10
- Efecto suelo: el apoyo aerodinámico crece con el cuadrado de la velocidad (Aston muy alto, McLaren y Lotus medio, supercoches algo). En curvas lentas agarran como un coche normal; a alta velocidad se pegan al suelo, giran más y se aplastan visualmente contra el asfalto.
- Tracción por coche: delantera (subvira al acelerar en curva), trasera (se descoloca) y total (el S4; pierde menos tracción en nieve, hielo y tierra).
- Frenada por grupo: los F1 y la competición frenan mucho más fuerte.
- Peraltes: el coche se inclina con la superficie, la IA los tiene en cuenta y empujan hacia dentro.

## 0.0.11
- Música estable: cada tema se pre-renderiza fuera del hilo principal y se reproduce como un buffer, así no se ralentiza ni se acelera cuando el juego va justo de rendimiento.

## 0.0.12
- Peraltes integrados: vallas, bordillos, líneas, charcos y carteles siguen la inclinación de la pista (antes quedaban rectos).
- Peraltes, rampas, rodillos y zonas de superficie más suaves (entrada y salida graduales, menos altura y menos extremos).
- Reto del día en grande en el menú: mismo circuito y mismo coche para todos los jugadores cada día.
- Casillas de sector bajo el diferencial: color y diferencial propio, en vivo mientras corres y fijo al cerrar el sector.

## 0.0.13
- Arreglado el HUD de sectores en móvil: los colores (morado, verde, amarillo) no se veían por un conflicto de estilos, y ahora además se muestra el diferencial de cada sector.
