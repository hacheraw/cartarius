# Cartarius · Roadmap

Juego web de geografía. Estética: carta náutica, pergamino, toques regios.

## Tramo 1 · Completa el mapa (un jugador) ✅ en curso
- [x] Mapamundi en blanco (solo fronteras) a partir de `countries.csv` (WKT simplificado → `data/world.js`).
- [x] Lista lateral con scroll; primer elemento seleccionado; se puede elegir otro.
- [x] Clic correcto: se pinta y desaparece de la lista. Clic erróneo: error + aviso con lo que has señalado.
- [x] Pista automática tras 3 fallos seguidos en el mismo elemento.
- [x] Zoom/arrastre, marcadores para microestados e islas.
- [x] Categorías: Océanos y continentes · Países por continente · Todos los países.
- [x] Tiempo, aciertos, errores, precisión y récord por categoría (guardado en el navegador).

## Tramo 2 · Menú principal y estructura
- [ ] Pantalla de inicio: elegir modo (Completa el mapa / Quiz).
- [ ] Ajustes: idioma de nombres, sonido, dificultad (sin marcadores, sin pista).
- [ ] Repositorio Git y despliegue (GitHub Pages o similar).

## Tramo 3 · Más pruebas de "Completa el mapa"
- [ ] Banderas (se muestra la bandera en la lista; clic en el país).
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
- HTML + CSS + JS sin compilador; D3 (local en `js/vendor/`) para la proyección Natural Earth y el zoom.
- Nombres en español con `Intl.DisplayNames` + correcciones propias.
- Límites de océanos simplificados (inspirados en la OHI); el Mediterráneo cuenta como Atlántico.
