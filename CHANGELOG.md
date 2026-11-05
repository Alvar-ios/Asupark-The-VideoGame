# Historial de versiones

Cada actualización sube la versión en `package.json`; el menú la muestra arriba a la derecha.

## 0.0.49
- Selector de circuitos: globo terráqueo 3D que oscila de lado a lado (también se arrastra). Pines con la bandera de cada circuito y panel por continente (Europa, América, Asia) con la lista de circuitos; al elegir continente el globo gira y se acerca.
- Corregido el ancho del selector en pantallas medianas (se salía por la derecha).

## 0.0.48
- Garaje: cada stat lleva su número (km/h, aceleración, giro y agarre) para comparar. Kart algo más lento.
- Fórmula 0: la salida está justo tras la horquilla donde empezaba el sector 3, con la bandera a la izquierda, y el primer giro es a izquierdas. Neumáticos hasta el doble de altos en las curvas, y ya no se colocan neumáticos dentro de la pista en las curvas cerradas.
- Asupark: invertido, ahora sale hacia la derecha.
- Logos de Fórmula 0 y Asupark (mejorados de calidad) en la publicidad del trazado, en grandes carteles y en el selector.
- Entorno propio: Fórmula 0 con boxes, gradas, torres de focos, contenedores apilados y cartel gigante; Asupark con noria giratoria, carpa de circo, globos aerostáticos, boxes y gradas.
- Una sola bandera grande y elegante (mástil, tela ondulada) junto a la salida, en vez de varias.
- Minimapa sin círculo: solo el trazado, con viñeta de transparencia.
- Selector de circuitos rediseñado al estilo Gran Turismo: ficha grande con trazado, logo y récord, mapa mundi y carrusel con flechas (también teclado).
- Motor al elegir coche: acelerón suave con revoluciones aleatorias y, al bajar, otro más fuerte.
- Ruedas del kart: giro visual más lento para evitar el efecto estroboscópico.

## 0.0.47
- Música: solo los 6 temas de TeteCovers (fuera los sintetizados y la versión larga de Drifting after Baptism). Fade out muy suave al final de cada tema, el siguiente entra solapado y aparece un aviso con el título al cambiar de canción (también conduciendo). La música ya no se corta al entrar o salir de un circuito (se atenúa y sigue) y el primer tema se descarga al abrir el juego.
- Kart: miniatura nueva en el garaje; ruedas traseras corregidas (giraban descentradas); petardeo fuerte al soltar el gas con llamita en el escape.
- Fórmula 0: nuevo trazado muy revirado (el de la foto isométrica, ~820 m) y neumáticos de guardarraíl más realistas (negros, desgastados, algunos pintados, con irregularidades).
- Nuevo circuito Asupark (karting, ~910 m) basado en el trazado azul.
- Selector de circuitos: mapa mundi interactivo con cada circuito en su país y zoom a Europa.
- Menú de pausa: opciones Cambiar de coche y Cambiar de circuito.
- Garaje: al elegir un coche suena su motor (arranque, acelerones, desacelera y ralentí bajito).
- Minimapa: ahora gira contigo por defecto, más cerca, más nítido y con mejor diseño (circular al seguirte, con norte).
- Fantasmas: ya no van a tirones (usan la misma interpolación que tu coche) y el nombre no lleva reborde.
- Menú de inicio con el fondo y los paneles más translúcidos.
- Banderas del país del circuito en dos zonas de cada trazado.

## 0.0.46
- Música: 7 temas grabados de TeteCovers (Borja Riñón on the Piano, Calamare en la M40, Drifting after Baptism en dos versiones, Paco Galaxia, Roadtrip a la BoyBerry, Susurro de Bruno Pérez). Salen en el selector con autor y en la rotación aleatoria; se descargan solo al sonar.
- Kart: nuevo modelo 3D de kart 125cc (optimizado de 103 MB a 3,5 MB). Un único kart, con color libre y dorsal (0-99) editables en el garaje. Suspensión rígida: no cabecea ni balancea.
- Circuito Fórmula 0 (antes Kartódromo): guardarraíles de neumáticos apilados en rojo, blanco y negro, y pianos más altos.

## 0.0.45
- Cuentas: nuevo botón Perfil en el menú. Crear cuenta o entrar con usuario y contraseña (sin correo). Con la sesión iniciada, tus tiempos, fantasmas, bandera y casco se guardan con tu cuenta y tu nombre es tu usuario. Requiere ejecutar supabase/accounts.sql y tener «Confirm email» desactivado.
- Estadísticas: vueltas, circuitos, carreras, victorias, podios y récords. Las victorias y podios se registran al acabar cada carrera.
- Vitrina de logros: Rey de cada circuito y categoría, el más rápido en contrarreloj, jugador con más victorias, primera victoria, 10 victorias, trotamundos, etc.
- Amigos: añadir por nombre de usuario, aceptar o rechazar solicitudes y quitar amigos.
- Rivalidad: comparación circuito a circuito con un amigo (tu mejor tiempo por categoría contra el suyo, diferencia y marcador).
- Salón de la fama: ranking global de más récords y más victorias.

## 0.0.44
- Fantasma dorado online arreglado: la migración de Supabase nunca se había aplicado y la tabla no guardaba recorridos. Ahora se aplica (supabase/ghost-migration.sql, v2) y la base de datos solo da el fantasma si es EXACTAMENTE el de la mejor vuelta (guarda ghost_ms = lap_ms, comprueba que el recorrido dura lo mismo que la vuelta y borra el fantasma antiguo si el tiempo mejora sin él).
- La mejor vuelta real de cada categoría se consulta con una función propia (best_lap): si el mejor tiempo no tiene fantasma todavía, no se enseña el de otro piloto.
- El nombre del piloto flota translúcido sobre cada fantasma (dorado con corona = récord de la categoría; azul = tu mejor vuelta).
- Un fallo de red ya no desactiva el envío de fantasmas durante toda la sesión.

## 0.0.43
- Móvil: la tarjeta del reto del día ya no se solapa con la imagen del coche ni corta la fecha.
- Clasificación: las categorías vuelven a ser una cuadrícula de botones grandes (antes se deslizaban y cortaban la última).
- Asfalto: brillo húmedo suave en la Selva Amazónica y en Valle Verde, sin coste de rendimiento (solo parámetros del material).

## 0.0.42
- Nueva categoría Karts con 4 karts (Iniciación 100cc, Alquiler 200cc, Competición KZ y Superkart 250): modelo 3D propio con piloto y casco, mucho agarre, giro rápido y motores monocilíndricos agudos.
- Nuevo circuito: Kartódromo, pista estrecha y técnica (horquillas, eses y chicane) de unos 770 m con muros de neumáticos.
- Carteles de patrocinio con una marca local por circuito junto a los patrocinadores globales (Estrella Galicia, Hôtel de Paris, Spa Monopole, Inca Kola…).

## 0.0.41
- Cámara de PC más baja y más cerca del coche por defecto; en Ajustes hay dos deslizadores (distancia y altura). En móvil no cambia.
- Motores menos estridentes: menos agudos, silbidos de turbo/compresor y petardeos más suaves, filtro más redondo y una ligera inestabilidad natural del régimen.
- Minimapa: flecha del jugador orientada, rivales con borde y, al tocarlo o hacer clic, modo seguimiento (gira contigo y se acerca).
- Selva Amazónica (Perú): curvas más cerradas y complicadas (horquilla doble a la derecha, eses a ambos lados) manteniendo las rectas largas. Los tiempos del trazado anterior no cuentan (supabase/cleanup-layout-records.sql los borra online).

## 0.0.40
- Nuevo circuito: Selva Amazónica (Perú). Figura de ocho con un puente del propio circuito sobre sí mismo, curvas rápidas y dos eses, horquillas más anchas y tramos normales más estrechos, lagos, árboles gigantes y selva muy frondosa. Sin barro ni charcos y con un chaparrón local en un tramo.
- Ancho de pista variable (más ancho en curvas cerradas) y microclima de lluvia por tramos como nuevas capacidades del trazado.
- Se quitan el balanceo de copas y los mapas de relieve de la carretera (no se apreciaban) y baja la densidad de lluvia y hojas para ir más fluido.
- Spa: asfalto más oscuro y mate en vez de gris brillante; parches y grietas en el asfalto de todos los circuitos.
- Faros: haz largo y estrecho y charco intenso justo delante del coche; foco real más potente.

## 0.0.39
- Mejor vuelta en directo: un error de la última versión cortaba la actualización del récord en el HUD. Corregido.
- Delta: la referencia es la mejor vuelta guardada con su perfil de tiempos, y los tiempos empiezan en 0 en meta.
- Lluvia: más gotas, más rápidas y con estela según la velocidad; más salpicaduras y sonido de lluvia más presente. Nieve más abundante.
- Carretera: relieve de asfalto con mapas de normales y rugosidad generados, y capa brillante en lluvia (escritorio).
- Diseño de circuito: puente de carretera sobre la pista en Valle, Desierto y Pruebas, y torres de focos en Neón.

## 0.0.38
- Mario Circuit y Spa en F1: se ocultan los tiempos anteriores al cambio de trazado (y se borran los guardados en este navegador). Para borrar también los de la base de datos, ejecutar supabase/cleanup-layout-records.sql.
- Colinas exteriores colocadas siempre fuera del circuito.
- Delta de la cabecera: la referencia propia solo se usa si coincide con el tiempo de su vuelta, y los perfiles se corrigen para que no retrocedan.
- HUD de escritorio más grande, con última vuelta y barra de progreso de la vuelta.
- Exteriores: copas que se mueven con el viento, hojas sueltas en los bosques, textura de follaje y sombras.

## 0.0.37
- Móvil: el control vuelve a mitades (sin flechas) una vez para todos los dispositivos que tenían guardado el modo de botones; los botones de girar muestran IZQ/DER en vez de flechas.
- Cactus: textura con costillas, espinas y tonos de sol, y puntas y codos redondeados.

## 0.0.36
- Clasificación: nombres más grandes, diferencias desde el segundo puesto y el primero marcado en dorado (las cabeceras de categoría quedan neutras).
- Fantasmas por categoría: gris = tu mejor vuelta de tu categoría, dorado = la mejor de tu categoría entre todos los jugadores (requiere ghost-migration.sql).
- Mónaco: las ventanas sobresalen de la fachada con marco y alféizar.
- Exteriores: más poblados y casas, árboles de copa redonda, palmeras y arbustos, y sombras proyectadas.

## 0.0.35
- Móvil: el control por mitades ya no muestra iconos, y aparece un botón de FRENO en un lateral para frenar mientras giras. Se bloquea el menú «Copiar» de iPhone.
- Clasificación: se abre en la categoría de tu coche, con las categorías como botones grandes en cuadrícula y sin deslizar.
- Contrarreloj: el fantasma gris es tu mejor vuelta del circuito y el dorado la mejor de todos los jugadores. Ajustes permite desactivar cada uno. Para el dorado online hay que ejecutar `supabase/ghost-migration.sql`.
- Paisaje fuera de las vallas: colinas, rocas, mesetas y cactus en el desierto, bosques y colinas en Spa y Cumbre Nevada, y pequeños poblados.

## 0.0.34
- Corregida la orientación del Ford GT Heritage: ya no aparece circulando marcha atrás.
- Cañón Prisma sustituido por un trazado compacto original, con una vuelta exterior y una sección interior de curvas enlazadas; asfalto más neutro.

## 0.0.33
- Jersey 10 aplicada a toda la interfaz, el HUD y las rotulaciones del circuito.
- Cañón Prisma rediseñado como kartódromo original compacto, con horquillas, eses y escapatorias de arena.

## 0.0.32
- Nueva fuente local Jersey 10 para la marca, botones y títulos del menú, basada en la referencia pixel-art.

## 0.0.31
- Menú principal rediseñado con jerarquía arcade, tipografía más contundente y botones de modo alineados.
- Corregida la orientación visual del BMW E30, Jaguar E-Type y Ford GT Heritage.
- Nuevo circuito original Cañón Prisma, con barreras de colores y paisaje de karting.
- Spa con lluvia más oscura y sombras ampliadas en árboles, montañas, barreras y edificios.

## 0.0.30
- Menú principal más directo, compacto y arcade; se retiraron el acceso duplicado al reto y varios textos redundantes.
- Asfalto de lluvia con reflejo más visible; árboles de bosque variados, montañas lejanas más orgánicas y edificios urbanos con ventanas y balcones.
- Manchas de barro un 20 % más pequeñas; los grupos hasta 200 CV reciben menos frenada, sin cambios para Competición ni F1.
- Siete coches nuevos con LOD comprimidos: E30, E-Type, Z8, 550 Barchetta, Ford GT Heritage, XJ13 y Ferrari 312 T.

## 0.0.29
- Charcos y barro con contornos orgánicos, bordes difuminados y textura; la forma visual coincide con la zona que afecta al agarre.
- La textura brillante de lluvia se limita al asfalto; hierba, grava y tierra conservan sus propios colores y materiales.
- Spa mantiene tonos verdes de Ardenas y los colores belgas de los pianos bajo lluvia; las zonas sin piano junto a la pista son grava, no asfalto.
- Los pianos de Spa se pueden pisar con agarre de carretera y conservan una sacudida ligera.

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

## 0.0.14
- Rampas: despegue con pendiente suave pero real y gravedad reducida en el aire; los coches vuelan unos 1,4 s (unos 60 m a 150 km/h) en lugar de caer a plomo.
- Pianos: solo en el interior de las curvas, más anchos y sin frenar. Al pisarlos te lanzan suavemente hacia el centro de la pista y alinean el morro, lo que ayuda a cerrar la curva. Fuera de las curvas hay arcén de asfalto.

## 0.0.15
- Primera rampa de Pruebas arreglada: estaba en una bajada y no despegaba. Ahora el terreno se aplana antes de cada rampa y la detección de despegue es más fiable (todas las rampas vuelan ~1-1,5 s con cualquier coche).
- Pianos más naturales: más bajos, franjas más largas con desgaste y colores menos saturados, y nacen y mueren poco a poco fundiéndose con el asfalto.
- Perfil: nacionalidad (bandera) y casco personalizable (colores y dibujo). Se ven en la torre, resultados, podio y clasificación. Los pilotos de la IA llevan su propio casco.
- Gran Premio con 5 rivales (antes 9) para ir más fluido.
- Pantallas finales en móvil: en horizontal se reparten en dos columnas y ya no se cortan los botones.
- La música elige siempre una canción al azar (distinta de la anterior).


## 0.0.16
- Casco mucho más simple: 12 cascos para elegir con un toque (sin colores sueltos). Dibujo del casco más fino.
- Ajustes en móvil más compactos.

## 0.0.17
- Cinco canciones nuevas, tranquilas (jazz suave y aire de consola clásica), con batería más suave.
- Selector de música (botón «Música» del menú): eliges qué suena y después sigue en aleatorio. Todas las canciones tienen nombres graciosos.

## 0.0.18
- Fuera «Luna Llena de Gasolina». Tres canciones con más ritmo y cada una con sus instrumentos: house jazz (órgano de club y bajo redondo), robots de discoteca (arpegios con filtro, voz robótica y bajo funk) y synthwave oscuro (colchón de sintes, arpegio en semicorcheas y bajo pulsante).

## 0.0.19
- Nuevo control táctil por mitades (Ajustes → Control): acelerador automático y solo giras; tocas la mitad izquierda para girar a la izquierda y la derecha para girar a la derecha.
- Reto del día, Clasificación, Música y Ajustes son ahora botones con icono en el menú.

## 0.0.20
- El control por mitades de pantalla es ahora el predeterminado en móvil (se puede volver a los botones en Ajustes).
- Sin sombreado amarillo al tocar: solo un punto tenue abajo, donde pulsas.

## 0.0.21
- Circuito de Bélgica rehecho copiando el trazado de Spa-Francorchamps: La Source, bajada a Eau Rouge y Raidillon en subida, recta de Kemmel, Les Combes, Rivage, Pouhon, Fagnes, Stavelot, Blanchimont y chicane final, con sus desniveles (2,3 km).
- Escapatorias anchas: grava junto al asfalto y hierba segada hasta las vallas, que ahora están mucho más lejos. En la grava el coche pierde agarre y velocidad. En cuatro zonas la escapatoria es aún más ancha y sin árboles.
- Muchos más árboles alrededor de la pista.
- Pianos con los colores de la bandera de Bélgica (negro, amarillo y rojo).

## 0.0.22
- Spa corregido: estaba en espejo. Ahora el circuito va en el sentido real (La Source es una horquilla a derechas).
- Pianos de Spa mucho más altos y rugosos: se ven abultados y los notas al pisarlos (el coche se sacude y frena un poco).
- Árboles pegados a las vallas, más grandes y muchos más (frondoso), asentados sobre el talud de la pista.

## 0.0.23
- Pianos corregidos en todos los circuitos: a ras del asfalto junto a la pista y cada vez más altos hacia fuera, con el escalón en el lado exterior.
- Con lluvia todo el mundo se oscurece, como un día nublado: cielo, niebla, hierba, asfalto, árboles y luz (Spa, Neón y los retos con lluvia).

## 0.0.24
- Faros encendidos cuando está oscuro (noche y lluvia): cuatro estilos de iluminación que valen para todos los coches (halógeno clásico, LED afilado, xenón azulado y faros de rally), con haz de luz sobre la carretera, destellos y pilotos traseros que brillan al frenar. El coche del jugador lleva además un foco real en ordenador.

## 0.0.25
- Faros menos perfectos: charcos de luz desenfocados sobre el suelo (ya no rayos hacia delante), halos velados, titileo leve y cada faro algo distinto.
- Pista mojada con lluvia: asfalto brillante con reflejos del cielo, charcos muy brillantes entre zonas más mates.

## 0.0.26
- En contrarreloj, el fantasma, la mejor vuelta y los sectores propios son por grupo, no por coche: corres contra lo mejor que hayas hecho con cualquier coche de tu grupo (se recogen los datos antiguos por coche).
- Siempre se muestra el récord de la pista de todos los grupos (en dorado, con quién y de qué grupo), aparte del récord de tu grupo (en morado).
- Charcos de luz de los faros sin bordes visibles y asfalto mojado menos blanquecino.

## 0.0.27
- El fantasma tiene la forma del coche con el que se hizo la mejor vuelta (no el que estás conduciendo).
- Segundo fantasma, dorado: el mejor tiempo de la pista entre todos los grupos y coches (de este dispositivo). Si el mejor de tu grupo es también el de la pista, sale uno solo, dorado.

## 0.0.28
- Récords en tiempo real: al batir tu mejor vuelta, el fantasma se actualiza al momento (con la forma de tu coche, y dorado si además es el récord de la pista); el fantasma dorado antiguo desaparece si lo superas.
- Los récords online (de tu grupo y de toda la pista) se consultan al empezar, al acabar una vuelta y cada 45 s mientras corres.
- Al reiniciar (T), los fantasmas se ajustan a los récords actuales.
