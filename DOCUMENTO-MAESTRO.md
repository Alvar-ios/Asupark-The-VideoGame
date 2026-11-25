# Documento maestro: KartlosApp como juego de karts reales

Estado: **borrador aprobado en entrevista** (decisiones tomadas). Pendiente de verificación de circuitos y de datos reales de los karts.

## 1. Visión

KartlosApp deja de ser un juego de coches y circuitos variados y pasa a ser **un juego solo de karting**:

- **Karts reales** en circuitos reales de España, en primer lugar.
- **Campeonatos de liga** con amigos o públicos, donde se corre cada día en un circuito distinto y se compite por la mejor vuelta.
- **Reto diario ficticio** igual para todos, generado cada día, y pensado para Instagram.
- **Personalización** del piloto y del kart, con una tienda y cajas que se abren jugando.

## 2. Qué se oculta y qué se queda

- **Se ocultan** (no se borran) todos los coches que no son kart y todos los circuitos que no son de karting: Palomring, África, etc. No aparecen en menús, ligas ni reto. El código y los datos se conservan por si se quieren reactivar.
- **Karts ficticios:** se mantiene **Asupark Fórmula 0** como kart propio de la casa. El kart «Arabia Saudí» (falso) se oculta.
- **Exterior de Asupark y Fórmula 0:** hay que rehacerlo. Ahora está demasiado verde y no se parece a un karting real. Se editará junto con la lista de circuitos.

## 3. Bloque A: campeonatos de liga (funcionalidad principal)

**Tipo de competición**
- Cada liga corre **un circuito por día**. El día dura 24 horas.
- Dentro de un día no hay libres, ni clasificación, ni carrera: se dan **todas las vueltas que se quiera** y se busca el mejor tiempo. Uso ilimitado.
- El mejor tiempo del día determina el resultado del día.

**Circuito del día**
- Cada campeonato tiene un **pool** de circuitos reales (España, Madrid, Burgos, etc.). Cada día sale uno, en **rotación** sin repetir hasta agotar el pool.

**Puntuación**
- Puntos tipo Fórmula 1 por día: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1 para los diez primeros.
- La suma de los días da la clasificación de la temporada.
- Duración por defecto: **7 días** (un circuito cada día). El creador puede cambiarla más adelante.

**Tipos de liga**
- **Pública (abierta):** cualquiera puede unirse desde la lista de ligas.
- **Privada:** solo se entra con **código de invitación**.

**Validación de tiempos**
- Los tiempos los envía el móvil, así que pueden manipularse.
- Cada día se **guarda la repetición de los tres primeros** y se revisa si hay anomalías.

**Categorías**
- Los karts se agrupan por **cilindrada (cc)**. Cada campeonato puede elegir una o varias categorías. Ver la propuesta en la sección 7.

**Campeonatos temáticos**
- Se pueden crear campeonatos distintos: solo Madrid, toda España, circuitos ficticios, etc.

## 4. Bloque B: reto diario ficticio (funcionalidad para nuevos usuarios)

- **Un solo reto al día, igual para todos.** Es el que se publica en Instagram.
- El circuito se **genera cada día**: el código crea el trazado a partir de una semilla, y la IA elige el **tema** (espacio, Polo Norte en Navidad, bajo el agua, etc.) y las reglas.
- Puede ser **más largo** que un circuito real y **muy técnico**, pero siempre jugable en móvil.
- Cada jugador compite con su **nick, personaje y card**.
- Hay un **leaderboard global diario** que se actualiza en tiempo real.

**Instagram** (publicación manual al principio):
- Vídeos de las repeticiones y del mejor tiempo del día.
- Vídeos promocionales y vistas de dron de los circuitos reales.
- Vueltas comentadas y tabla del leaderboard con los perfiles de los mejores tiempos.

## 5. Bloque C: piloto, personalización y tienda

**Piloto**
- Piloto **3D sobre el kart** en el juego y en la página de personalización.
- Editable: casco, ropa, zapatos y colores del kart.
- Estilo «un poco falso y gracioso», no realista.

**Monedas**
- **Puntos:** se ganan con objetivos y vueltas. Se gastan en **cajas normales**.
- **Gemas:** se ganan en campeonatos y eventos. Se gastan en **cajas especiales**.
- Las cajas especiales también pueden desbloquearse ganando campeonatos o eventos concretos.

**Cajas y tienda**
- **Caja diaria gratis** al entrar.
- Los objetos son **solo estéticos**: nadie gana vueltas por tener un objeto.

**Dinero real**
- **Fuera por ahora.** Se desarrolla solo con puntos de juego.
- Más adelante puede añadirse la compra de **paquetes de puntos**. Eso requiere pasarela de pago, política de reembolsos y revisar las normas de cajas (loot boxes) y menores en España y la UE.

## 6. Lista candidata de circuitos reales

Estado: **candidatos a verificar**. Las fuentes encontradas son guías y artículos, no un listado oficial. Cada circuito necesita **foto aérea o mapa** para extraer el trazado, igual que se hizo con Magarigawa. Se refinarán uno a uno con la ayuda de imágenes.

| Comunidad | Circuito | Tipo | Notas | Fuente |
|---|---|---|---|---|
| Madrid | Carlos Sainz Karting (Las Rozas) | Indoor/outdoor | Circuito de Carlos Sainz; también aparece en Európolis | [Motorpasión](https://www.motorpasion.com/otras-competiciones/los-22-mejores-circuitos-indoor-de-karts-en-espana) |
| Madrid | Circuito Torrejón Henakart | Por confirmar | Aparece como circuito de karting | [Yumping](https://www.yumping.com/en/karting/circuito-torrejon-henakart--e234) |
| Madrid | Karting Club Los Santos | Por confirmar | Mencionado en guía de IFEMA | [IFEMA](https://www.ifema.es/visita-madrid/turismo/mejores-circuitos-de-karts-en-madrid) |
| Málaga | KartCenter Campillos | Outdoor | Según la fuente, homologado FIA y sede de una ronda del Campeonato de España | [Malagacar](https://www.malagacar.com/sp/blog/ocio/karting-en-malaga/) |
| Málaga | Karting Mijas / Funny Hill (Marbella) | Por confirmar | Costa del Sol | [Malagacar](https://www.malagacar.com/sp/blog/ocio/karting-en-malaga/) |
| Granada | Fórmula Karting Granada | Indoor | Tiene puente y túnel | [Motorpasión](https://www.motorpasion.com/otras-competiciones/los-22-mejores-circuitos-indoor-de-karts-en-espana) |
| La Rioja | Karting Indoor Logroño | Indoor | Tres variantes de trazado | [Motorpasión](https://www.motorpasion.com/otras-competiciones/los-22-mejores-circuitos-indoor-de-karts-en-espana) |
| Tarragona | Karting Vendrell | Outdoor | Descrito como uno de los mayores de Cataluña | [Barcelona Secreta](https://barcelonasecreta.com/pt/karting-circuito-karting-barcelona-catalunha/) |
| Barcelona | Sant Feliu de Llobregat | Indoor | Sede de rondas del Campeonato de España (año sin confirmar) | [Autofácil](https://www.autofacil.es/mejores-circuitos-kart-espana/) |
| Galicia | Racing Dakart (Sanxenxo) | Por confirmar | Más de 30 años en el sector | [Emprendedores](https://emprendedores.es/noticias-de-empresa/la-emocion-de-ser-piloto-de-carreras-en-el-circuito-de-karting-de-sanxenxo) |
| Valencia | Kartódromo Internacional Lucas Guerrero (Chiva) | Outdoor | Aparece en calendarios IAME | [IAME](https://www.iame-motorsport.com/round-4-chiva) |
| Valencia | Los Bestias (Playa de Gandía) | Por confirmar | Citado entre los mejores de España | [Motor16](https://www.motor16.com/noticias/mejores-circuitos-karts-espana/) |
| Toledo | Recas | Por confirmar | Ronda del Campeonato de España según una noticia | [Comarcas / noticia](https://www.lacomarca.net/campeonato-espana-karting-aterriza-motorland-aragon-proxima-semana/) |
| Aragón | Motorland Aragón (Alcañiz) | Outdoor | Ha acogido rondas del Campeonato de España de Karting (fuentes de 2024 y 2025) | [Motorland](https://www.motorlandaragon.com/es/node/6567) |
| Menorca | CS55 Racing Karting Academy | Por confirmar | Academia con temporadas propias | [Menorca.info](https://www.menorca.info/deportes/polideportivo/2025/02/24/2333075/cs55-racing-karting-academy-abre-inscripciones-para-segunda-temporada.html) |
| Burgos | Por definir | — | Mencionado por el equipo; sin candidato todavía | — |

**Lo que falta:** Andalucía, Castilla y León (Burgos) y otras comunidades casi no aparecen en las fuentes. Hay que buscar sedes concretas, idealmente con la RFEDA y con fotos del equipo.

## 7. Categorías de kart (propuesta, a validar)

Propuesta de agrupación por cilindrada. Se ajustará con los karts reales que se elijan.

- **Mini (60 cc):** karts pequeños para principiantes.
- **Cadete (125 cc, 2 tiempos):** categoría de entrada.
- **Senior (125 cc, alto rendimiento):** karts más rápidos.
- **Gran Premio (200 cc):** karts de máxima potencia.

Los karts reales son preferibles a los genéricos. Los modelos de marcas (Sodi, Tony Kart, etc.) se decidirán cuando se revisen los karts disponibles.

## 8. Fases de desarrollo propuestas

1. **Limpieza:** ocultar coches y circuitos no-kart. Ocultar el kart de Arabia.
2. **Circuitos reales:** refinar la lista de la sección 6 con el equipo (fotos, trazados, exterior).
3. **Liga con rotación:** pool de circuitos, un circuito por día, puntos F1, repetición del top 3.
4. **Reto diario procedural:** semilla diaria, tema elegido por la IA y leaderboard global.
5. **Personalización:** piloto 3D, edición de casco, ropa, zapatos y colores del kart.
6. **Tienda y cajas:** puntos, gemas, caja diaria y cajas especiales. Solo estética.
7. **Instagram:** generación de vídeos y tablas, publicación manual.
8. **Más adelante:** compra de paquetes de puntos (pagos y normativa).

## 9. Preguntas abiertas

- Confirmar la lista de circuitos reales (sección 6) y añadir Burgos y Andalucía.
- Definir las categorías por cilindrada y los karts reales por categoría.
- Decidir el número máximo de jugadores por liga privada.
- Rediseñar el exterior de Asupark y Fórmula 0.
