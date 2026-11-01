# Drift Rush — visión y plan del proyecto

Documento de contexto compartido para el equipo y para cualquier IA que colabore en el repositorio. Resume la visión acordada hasta ahora; las decisiones marcadas como **por decidir** siguen abiertas.

## Visión

Crear un juego de carreras arcade para navegador, gratuito y abierto a cualquiera, al que apetezca volver cada día para mejorar tiempos y competir con amigos. Los coches tienen diseños reconocibles y una conducción divertida; los circuitos mezclan trazados emocionantes con mundos visuales sorprendentes, desde Halloween y Navidad hasta pixel art, Minecraft o circuitos de F1 reinterpretados.

La competición principal será asíncrona: cada jugador corre cuando puede y compara su resultado con los demás. El multijugador en tiempo real no es requisito ni prioridad inicial.

## Principios de diseño

- **Arcade primero:** controles inmediatos, velocidad, derrapes satisfactorios y errores recuperables.
- **Coches con personalidad:** vehículos visualmente realistas, con sensaciones y estadísticas diferenciadas.
- **Mundos con contraste:** coches realistas pueden correr en entornos estilizados, absurdos o inspirados en referencias populares.
- **Retos que invitan a volver:** eventos diarios y temporadas cortas, con progreso claro y competición entre amigos.
- **Accesible:** jugar desde ordenador y móvil; desarrollar y probar primero en ordenador.
- **Evolución gradual:** priorizar una experiencia pulida antes de invertir tiempo en cuentas, servidores y funciones online.
- **Coste mínimo:** preferir herramientas gratuitas y una infraestructura sencilla. Vercel es el destino inicial previsto para la web.

## Juego imaginado

- Carreras contrarreloj individuales con intentos ilimitados en la primera versión competitiva.
- Una temporada puede durar una semana y otorgar puntos por resultados.
- Como idea, cada día puede ofrecer entre dos y tres eventos con objetivos diferentes. La puntuación podría combinar los resultados de varios eventos.
- Los jugadores pueden elegir coche. Se quieren tablas separadas por coche o evento para que las diferencias entre vehículos formen parte de la estrategia. Otra opción por decidir es asignar un coche distinto a cada evento.
- Circuitos diarios para la temporada, además de pistas permanentes para jugar en modo arcade o sandbox.
- A largo plazo, los puntos de temporada podrían dar monedas del juego para adquirir contenido en una tienda.
- Inicio de sesión previsto para una versión más completa. Para prototipos de liga se contempla entrar con un nombre, al estilo de Playus, y conservarlo durante la temporada.
- Anuncios y una posible aportación de 0,99 € por jugador para crear temporadas son ideas de monetización futura, todavía sin definir.

## Creación de circuitos y contenido

La meta es que el equipo diseñe circuitos con ayuda de IA: generar propuestas mediante prompts y refinarlas manualmente. También se quiere poder proporcionar imágenes de ambientes, referencias visuales y dibujos de trazados para orientar la creación. La IA puede ayudar con el trazado y la ambientación; el equipo revisa y ajusta el resultado antes de incorporarlo al juego.

Las referencias mencionadas incluyen Halloween, Navidad, pixel art, Minecraft, Mario Kart y F1. La intención es que cada tema sea reconocible y contraste con los coches realistas. La calidad y variedad de los trazados importa especialmente: se quieren curvas interesantes, cambios de ritmo y personalidad, evitando circuitos que se sientan demasiado rectos o genéricos.

## Estado actual del repositorio

El proyecto ya es un juego 3D para navegador hecho con Three.js. `npm run build` empaqueta el juego en un HTML autocontenido; la configuración existente apunta a un despliegue estático en Vercel. Actualmente incluye:

- Física arcade propia, derrape, saltos, colisiones y controles de teclado y táctiles.
- Coches con estadísticas diferentes y varios modelos 3D.
- Circuitos generados a partir de semillas, temas visuales y una pista diaria determinista.
- Contrarreloj, fantasmas, sectores, récords locales y sincronización remota opcional, rachas y rivales controlados por IA.
- Una carrera contra rivales simulados.

La clasificación de tiempos admite Supabase cuando se configura y conserva el almacenamiento local como alternativa. Aún no hay cuentas de jugador, temporadas compartidas ni carreras multijugador; la pista diaria se calcula en el cliente, no se publica desde un flujo editorial.

## Plan por etapas

### 1. Experiencia de juego — prioridad actual

Pulir el juego antes de añadir online:

- Mejorar controles y respuesta de conducción según las estadísticas y personalidad de cada coche.
- Afinar física, derrapes y sensación de velocidad.
- Mejorar animaciones y efectos de impactos, aterrizajes y conducción al límite.
- Rediseñar menús, HUD y resultados para que la interfaz sea atractiva, clara y fácil de usar.
- Elevar la calidad visual de circuitos y escenarios, y dar más carácter a los trazados.
- Mantener ordenador y móvil en el horizonte; probar primero en ordenador y revisar la experiencia móvil al evolucionar cada función.

**Primera entrega de esta etapa:** se rediseñó la portada como centro de juego, con acceso directo al contrarreloj de la pista diaria, fecha y mejor tiempo local del coche seleccionado. Se reorganizaron visualmente las secciones de pistas y garaje y se mantuvieron los modos y controles existentes.

**Segunda entrega:** se afinó la autoridad de giro a alta velocidad y la corrección de dirección con freno de mano; se suavizaron la inclinación, la vibración de cámara, la reacción a impactos y el rebote sobre pianos. Se añadieron mensajes y sonidos para iniciar un derrape, saltar y cambiar de marcha, y se reforzaron humo y chispas. Los escenarios ahora incluyen señales de curva, nubes agrupadas de bajo coste, un cielo con más profundidad y textura sutil en el terreno; también se renovaron los paneles del HUD y de resultados. Estos cambios necesitan validación de conducción y ajuste con pruebas manuales en distintos circuitos y coches.

**Tercera entrega:** el menú principal se simplificó con jerarquía más clara, tipografía arcade y menos microtexto redundante. La lluvia ahora da más brillo al asfalto y los charcos de barro ocupan un 20 % menos; coches de hasta 200 CV pierden menos velocidad en ellos, mientras Competición y F1 conservan la frenada anterior. Spa y los demás circuitos de bosque ganan árboles de siluetas variadas y montañas lejanas suavizadas por la niebla. Mónaco incorpora ventanas, cornisas y balcones instanciados en sus edificios. Se sumaron siete coches de `Carmodels/`, clasificados por tipo, con modelos optimizados para escritorio y móvil. La escenografía es procedural y no depende de imágenes externas.

### 2. Contenido y ritmo de juego

- Definir el formato de los eventos diarios y la puntuación semanal.
- Añadir circuitos permanentes de arcade/sandbox junto a los eventos de temporada.
- Establecer un proceso práctico para diseñar, generar, revisar y publicar circuitos.
- Probar variedad de coches, trazados y objetivos para que los eventos diarios se sientan distintos.

### 3. Ligas asíncronas online

Cuando la experiencia individual esté sólida, diseñar la capa online de coste bajo:

- Identidad de jugador y nombre persistente.
- Temporadas, grupos de amigos, eventos, resultados, puntos y clasificación compartida.
- Publicación de circuitos y reglas del evento desde una fuente común, no desde el reloj local de cada navegador.
- Guardado y comprobación de resultados para reducir tiempos manipulados.
- Elegir una solución gratuita o de bajo coste que encaje con el volumen inicial; revisar límites y costes antes de depender de ella.

El sistema de cuentas, la arquitectura de backend y el proveedor de datos quedan **por decidir**. Las carreras simultáneas pueden evaluarse más adelante si alguna vez aportan valor.

### 4. Progresión y sostenibilidad

Explorar recompensas de temporada, monedas y tienda cuando el bucle principal y las ligas funcionen. Definir entonces si habrá anuncios y cómo encaja la idea de cobrar 0,99 € a quienes creen temporadas. El acceso al juego se quiere gratuito y abierto.

## Forma de trabajar

- Dos personas, con una disponibilidad aproximada conjunta de dos horas al día y mejora continua.
- No hay fecha límite para publicar la versión final: primero importa la calidad de la experiencia.
- Trabajar en cambios pequeños, revisables y fáciles de retomar por otra IA o por cualquier miembro del equipo.
- Antes de programar una función grande, explicar su objetivo y cómo encaja en estas etapas; registrar aquí las decisiones duraderas.
- No asumir que las ideas marcadas **por decidir** ya están aprobadas. Actualizar este documento cuando el equipo cambie o concrete el plan.

## Preguntas abiertas

- ¿La temporada dura siempre una semana? ¿Cómo se puntúan los dos o tres eventos diarios y qué pasa si alguien se pierde uno?
- ¿Las tablas se separan por coche, se fija el coche por evento o se ofrecen ambas modalidades?
- ¿Cómo se crean grupos privados y cómo se evita que un nombre repetido o un resultado manipulado cause problemas?
- ¿Qué parte de un circuito puede generar la IA y qué herramientas se usarán para pasar de una imagen o dibujo a una pista jugable?
- ¿Qué recompensas y contenido desbloquea la moneda del juego?
- ¿Qué proveedor online ofrece el mejor equilibrio entre gratuidad, sencillez y límites adecuados para el lanzamiento?

### Tercera entrega: superficies, pianos y audio

- La nieve reduce el agarre en pista y especialmente fuera de ella; tambien reduce autoridad de direccion y capacidad de frenada. La salida a nieve genera una nube fria clara.
- El desierto tiene respuesta propia al salir del asfalto: traccion, frenada, resistencia y direccion ajustadas, con polvo rojizo.
- Los pianos tienen una ligera elevacion fisica y el circuito muestra lineas continuas de borde ademas de los pianos y marcas existentes.
- Los coches usan perfiles de motor procedural diferenciados por tono, regimen, aspereza y silbido de turbo. Al acelerar aparecen emisiones sutiles en el escape; reciben un tono gris discreto.
- La compilacion de produccion (`npm run build`) funciona. Falta validar manualmente el tacto de los coches y ajustar los valores de las superficies segun pruebas de conduccion.


### Siguiente entrega: superficie y clima

- Quitamos el ERS, sus zonas de impulso y los controles asociados. Las vueltas dependen de la entrega de potencia, el agarre y el trazado.
- Puerto Urbano y Noche Neon tienen lluvia; la lluvia oscurece el cielo, moja el asfalto, crea charcos reflectantes que reducen agarre, genera pulverizacion y tiene sonido ambiente.
- Cumbre Nevada produce nieve y huellas; Desierto Rojo levanta polvo y sus superficies fuera del asfalto tienen traccion, direccion y frenada propias.
- Los sectores y vueltas muestran tiempos en una tarjeta lateral animada. Los choques aplican impulso segun masa y transmiten un movimiento corto a la camara.
- La geometria de los charcos, la meteorologia, el audio y los efectos son procedurales y ligeros; faltan ajustes visuales y de conduccion tras pruebas manuales.

### Estado actual: cámara, exteriores, audio y empaquetado

- El garaje ofrece 20 vehículos seleccionables en seis grupos, incluidos modelos reales y variantes toon. Los GLB se cargan bajo demanda; el usuario prepara más modelos para incorporarlos en la siguiente tanda.
- Los motores usan fragmentos de grabaciones de coches deportivos del paquete CC0 de muted.io, remuestreados a mono y con perfiles de pitch/filtro/volumen por coche. Los archivos fuente seleccionados y la atribución están en `src/assets/audio/`.
- La cámara de carrera se guía principalmente por la tangente del trazado, no por el giro del coche; el plano de presentación del menú ya no orbita sin parar.
- El Circuito de Pruebas usa asfalto, arcenes, luz y vegetación de pista natural en vez de bloques de juguete. Árboles y hierba se mueven con viento; el menú también muestra precipitación en pistas de lluvia y nieve.
- La adherencia, velocidad, resistencia y dirección se mezclan gradualmente al pisar el arcén. Charcos y barro tienen contornos orgánicos y bordes difuminados que coinciden con la zona de efecto físico; las marcas de neumático usan una textura de huella.
- En lluvia, la textura y los reflejos del asfalto no se aplican a los arcenes; Spa conserva verdes de Ardenas, grava diferenciada y colores belgas visibles en los pianos. Los pianos se pueden pisar con agarre de carretera y una sacudida ligera.
- La salida se divide en `index.html`, `game.js` y activos estáticos cargados bajo demanda. Para desarrollo local: `npm run serve` y abrir `http://localhost:4173`. Vercel publica la versión estática mediante `npm run build` y `dist/`.
- La clasificación remota de tiempos usa Supabase opcionalmente; si no está configurado, el juego mantiene los récords locales. Cuentas, temporadas y multijugador siguen pendientes.
- `npm run build`, la simulación de conducción y la prueba específica de superficies/pianos pasan. La apariencia de Spa bajo lluvia se ha revisado en navegador de escritorio; queda ajustar conducción manual y revisar móvil.
