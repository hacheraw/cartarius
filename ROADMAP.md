# Cartarius · Roadmap

Juego web de geografía. Estética: carta náutica, pergamino, toques regios.

## Tramo 1 · Completa el mapa (un jugador) ✅
- [x] Mapamundi en blanco (solo fronteras) a partir de `countries.csv` (WKT simplificado → `data/world.js`).
- [x] Lista lateral con scroll; primer elemento seleccionado; se puede elegir otro.
- [x] Clic correcto: se pinta y desaparece de la lista. Clic erróneo: error + aviso con lo que has señalado.
- [x] Pista opcional tras X fallos seguidos.
- [x] Zoom/arrastre, marcadores para microestados e islas.
- [x] Categorías: Océanos y continentes · Países por continente · Todos los países.
- [x] Tiempo, aciertos, errores, precisión. Récords (top 10 por carta) con nombre del jugador, en localStorage.
- [x] Opciones: mostrar país pulsado, pistas tras X errores (ambas desactivadas por defecto), reconocimiento limitado, territorios dependientes.
- [x] Pausa con desenfoque; partida guardada y "¿Quieres continuar donde lo dejaste?".

## Tramo 2 · Menú principal y estructura
- [ ] Pantalla de inicio: elegir modo (Completa el mapa / Quiz).
- [ ] Ajustes: idioma de nombres, sonido, dificultad (sin marcadores, sin pista).
- [ ] Repositorio Git y despliegue (GitHub Pages o similar).

## Tramo 3 · Más pruebas de "Completa el mapa"
- [x] Banderas: mapa a todo el ancho, dock inferior con scroll horizontal; al acertar el país se rellena con su bandera.
- [ ] Capitales (punto en el mapa; clic en el país o en la ciudad).
- [ ] Ríos, montañas y cordilleras (requiere nuevas capas: Natural Earth rivers/geography).
- [ ] Provincias/comunidades de España y otros países (capas admin-1).
- [ ] Ciudades, lenguas, personajes famosos (datos propios).

## Tramo 4 · Quiz multijugador
- [ ] Pantalla principal (anfitrión): crea sala, muestra QR y código de 4 caracteres.
- [ ] Móviles: entrar por QR o URL + código, poner nombre.
- [ ] Preguntas de las mismas categorías ("¿De qué país es esta bandera?").
- [ ] Configuración: tiempo por pregunta (5 s por defecto), 2–4 opciones, nº de preguntas.
- [ ] Respuestas en tiempo real y marcador final: aciertos, más rápido, más lento.
- [ ] Requiere servidor en tiempo real (WebSocket: Node + Socket.IO, o servicio tipo Supabase/Firebase).

## Decisiones técnicas
- Datos de países: REST Countries v5 descargado una vez a `data/raw/restcountries-v5.json` (`tools/fetch-countries.mjs`, gasta 3 peticiones). `tools/build-data.py` + `data/overrides.json` generan `data/countries.json`/`.js` (nombres en español, continente, estatus, capitales, bandera, población, idiomas, monedas, fronteras…). La clave no va en el juego.
- Banderas: 250 SVG locales en `data/flags/` (`tools/fetch-flags.mjs`, CDN gratuito sin clave).
- Pendiente para la prueba de capitales: los nombres de capitales vienen en inglés; habrá que traducirlos en `overrides.json`.
- HTML + CSS + JS sin compilador; D3 (local en `js/vendor/`) para la proyección Natural Earth y el zoom.
- Nombres en español con `Intl.DisplayNames` + correcciones propias.
- Límites de océanos simplificados (inspirados en la OHI); el Mediterráneo cuenta como Atlántico.
