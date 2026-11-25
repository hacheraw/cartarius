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
- [x] Multilingüe: interfaz en español e inglés (`js/i18n.js`, según el navegador; si no, inglés) con selector en el menú. Nombres de lugares en español, inglés o local (Opciones; por defecto, el idioma del juego).
- [ ] Pantalla de inicio: elegir modo (Completa el mapa / Quiz).
- [ ] Ajustes: sonido, dificultad (sin marcadores, sin pista).
- [ ] Repositorio Git y despliegue (GitHub Pages o similar).

## Tramo 3 · Más pruebas de "Completa el mapa"
- [x] Banderas: mapa a todo el ancho, dock inferior con scroll horizontal; al acertar el país se rellena con su bandera.
- [x] Capitales: se señala el país; al acertar aparece la capital con estrella y nombre (el nombre se oculta con el mapa muy alejado).
- [x] Ríos: 134 ríos elegidos a mano (`data/curated/rios.json`) con trazado de Natural Earth; se pulsa la línea del río.
- [x] Ciudades: las más pobladas de cada continente (y 80 del mundo), puntos en el mapa; al acertar aparece el nombre.
- [ ] Montañas y cordilleras, monumentos (Natural Earth geography + Wikidata).
- [ ] Provincias/comunidades de España y otros países (capas admin-1).
- [ ] Lenguas, personajes famosos (Wikidata; personajes mejor en el Quiz).

## Tramo 4 · Quiz multijugador
- [ ] Pantalla principal (anfitrión): crea sala, muestra QR y código de 4 caracteres.
- [ ] Móviles: entrar por QR o URL + código, poner nombre.
- [ ] Preguntas de las mismas categorías ("¿De qué país es esta bandera?").
- [ ] Configuración: tiempo por pregunta (5 s por defecto), 2–4 opciones, nº de preguntas.
- [ ] Respuestas en tiempo real y marcador final: aciertos, más rápido, más lento.
- [ ] Requiere servidor en tiempo real (WebSocket: Node + Socket.IO, o servicio tipo Supabase/Firebase).

## Decisiones técnicas
- Datos de países: REST Countries v5 descargado una vez a `data/raw/restcountries-v5.json` (`tools/fetch-countries.mjs`, gasta 3 peticiones). `tools/build-data.py` + `data/overrides.json` generan `data/countries.json`/`.js` (nombres en español, continente, estatus, capitales, bandera, población, idiomas, monedas, fronteras…). La clave no va en el juego.
- Ríos y ciudades: Natural Earth 10m (dominio público) en `data/raw/ne/` (`tools/fetch-ne.sh`); `tools/build-features.py` (requiere `pip install pyshp shapely`) genera `data/features.json`/`.js`.
- Banderas: 250 SVG locales en `data/flags/` (`tools/fetch-flags.mjs`, CDN gratuito sin clave).
- Capitales: nombre en español en `overrides.json` (`capitales`), una por país (la primera si hay varias: Bolivia → Sucre, Sudáfrica → Pretoria). Campo `capital` en `countries.json`.
- HTML + CSS + JS sin compilador; D3 (local en `js/vendor/`) para la proyección Natural Earth y el zoom.
- Nombres de lugares: `nombres: {es, en, local}` en `countries.json` (y en `capital`). El local sale de REST Countries (`names.native`) y de `overrides.json` (`nombres_local`, `capitales_local`). Para añadir un idioma de interfaz: un bloque nuevo en `STR` de `js/i18n.js`.
- Límites de océanos simplificados (inspirados en la OHI); el Mediterráneo cuenta como Atlántico.
