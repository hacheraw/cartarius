/* Cartarius · idiomas
   - Idioma del juego (textos de la interfaz): español o inglés. Por defecto, el del navegador; si no está, inglés.
   - Idioma de los lugares (países, capitales…): "auto" (el del juego), "local" (nombre original), "en" o "es".
   Para añadir un idioma: copiar el bloque "en" de STR con su código y añadirlo a LANGS (y los nombres de lugares en data/). */
(function () {
  'use strict';

  const LANGS = { es: 'Español', en: 'English' };
  const PLACE_LANGS = ['auto', 'local', 'en', 'es'];

  const STR = {
    es: {
      'home.title': 'Volver a las categorías',
      'app.sub': 'Completa el mapa',
      'lang.label': 'Idioma',
      'stat.time': 'Tiempo', 'stat.found': 'Aciertos', 'stat.errors': 'Errores',
      'btn.pause': 'Pausa', 'btn.pauseTitle': 'Pausa (P)', 'btn.resume': 'Continuar', 'btn.restart': 'Reiniciar', 'btn.categories': 'Categorías',
      'map.aria': 'Mapa del mundo en blanco', 'loading': 'Desplegando la carta…', 'load.error': 'No se pudo cargar el mapa: {msg}',
      'zoom.in': 'Acercar', 'zoom.out': 'Alejar', 'zoom.fit': 'Encuadrar',
      'panel.index': 'Índice', 'panel.remaining': '{n} restantes', 'panel.find': 'Busca en el mapa',
      'panel.order': 'Orden', 'order.rand': 'Aleatorio', 'order.alpha': 'A–Z',
      'skip': 'Saltar ›', 'skip.title': 'Pasar al siguiente (tecla S)',
      'dock.flags': 'banderas', 'flag.aria': 'Bandera',
      'menu.options': 'Opciones', 'menu.records': 'Récords', 'menu.soon': 'Próximamente', 'soon.prep': 'En preparación',
      'card.items': '{n} elementos', 'card.record': 'Récord', 'card.unplayed': 'Sin jugar', 'card.saved': 'Partida a medias',
      'end.title': 'Carta completa', 'end.accuracy': 'Precisión', 'end.namePh': 'Tu nombre', 'end.nameAria': 'Nombre del jugador',
      'end.save': 'Guardar', 'end.again': 'Repetir', 'end.other': 'Otra categoría',
      'end.first': 'Primera carta completada. Ya tienes marca que batir.', 'end.newRecord': 'Nuevo récord en esta carta.',
      'end.rank': 'Entras en el puesto {pos} de la tabla.', 'end.out': 'Te quedas fuera de los {n} mejores.',
      'end.anon': 'Anónimo', 'end.savedAs': 'Guardado como {name}.', 'end.savedOut': 'Guardado, pero no entra en los {n} mejores.',
      'pause.title': 'En pausa', 'pause.exit': 'Guardar y salir al menú', 'pause.prog': '{found} de {total} · {err} errores',
      'resume.title': 'Partida a medias', 'resume.q': '¿Quieres continuar donde lo dejaste?', 'resume.yes': 'Continuar',
      'resume.no': 'Empezar de nuevo', 'resume.info': '{cat}: {found} de {total} colocados, {time}, {err} errores.', 'cancel': 'Cancelar',
      'exit.title': 'Salir', 'exit.q': '¿Salir de la partida? (se guardará el progreso)', 'exit.yes': 'Salir', 'exit.no': 'Seguir jugando',
      'toast.notInCatName': '{name} no entra en esta carta', 'toast.notInCat': 'Eso no entra en esta carta',
      'toast.already': 'Ya colocado: {name}', 'toast.no': 'No. Eso es {name}', 'toast.wrong': 'Incorrecto',
      'opt.title': 'Opciones', 'opt.lang': 'Idioma', 'opt.placeLang': 'Nombres de lugares',
      'opt.placeLang.help': 'Cómo se escriben países, capitales, océanos y continentes. «Local» usa el nombre en el idioma del propio país.',
      'place.auto': 'Como el juego', 'place.local': 'Local (original)', 'place.en': 'Inglés', 'place.es': 'Español',
      'opt.aids': 'Ayudas', 'opt.show': 'Mostrar país pulsado',
      'opt.show.help': 'Al fallar, dice qué has señalado. También muestra el nombre al pasar por encima de lo que no entra en la carta.',
      'opt.hints.pre': 'Activar pistas después de', 'opt.hints.post': 'errores',
      'opt.hints.help': 'Tras ese número de fallos seguidos en el mismo elemento, la respuesta parpadea en el mapa.',
      'opt.aided': 'Los récords conseguidos con ayudas llevan un punto (·) junto al nombre.',
      'opt.map': 'Mapa', 'opt.marker': 'Tamaño de los puntos de países pequeños',
      'opt.marker.help': 'Afecta a los círculos de Andorra, Malta, las islas del Caribe y del Pacífico, etc.',
      'opt.ask': 'Qué se pregunta', 'opt.limited': 'Estados de reconocimiento limitado', 'opt.terr': 'Territorios dependientes',
      'opt.seeList': 'Ver lista', 'opt.ask.note': 'Siempre se preguntan los 193 miembros de la ONU y el Vaticano. Estos cambios se aplican al empezar una carta.',
      'opt.data': 'Datos', 'opt.wipe': 'Borrar récords y partidas', 'opt.wipe.confirm': 'Pulsa otra vez para borrar todo', 'opt.wipe.done': 'Borrado',
      'done': 'Hecho', 'close': 'Cerrar',
      'rec.title': 'Récords', 'rec.note': 'Orden: menos errores primero, luego menor tiempo. (·) = con ayudas.', 'rec.empty': 'Aún no hay marcas.',
      'rec.err': 'err.', 'rec.aided': 'Con ayudas activadas',
      'group.world': 'El mundo', 'group.countries': 'Países', 'group.flags': 'Banderas', 'group.capitals': 'Capitales',
      'cat.continents': 'Océanos y continentes', 'cat.countries': 'Países de {cont}', 'cat.countries.all': 'Todos los países',
      'cat.flags': 'Banderas de {cont}', 'cat.flags.all': 'Todas las banderas', 'cat.capitals': 'Capitales de {cont}', 'cat.capitals.all': 'Todas las capitales',
      'blurb.continents': 'Los cinco océanos y los seis continentes.',
      'blurb.countries.EU': 'De Portugal a Rusia.', 'blurb.countries.AF': 'Del Magreb al cabo de Buena Esperanza.', 'blurb.countries.AS': 'De Turquía a Japón.',
      'blurb.countries.AM': 'De Canadá a Tierra del Fuego.', 'blurb.countries.OC': 'Australia y las islas del Pacífico.', 'blurb.countries.all': 'El mundo entero.',
      'blurb.flags': 'Lleva cada bandera a su país.', 'blurb.flags.all': 'Todas las banderas del mundo.',
      'blurb.capitals': 'Señala el país de cada capital.', 'blurb.capitals.all': 'Todas las capitales del mundo.',
      'group.rivers': 'Ríos', 'group.cities': 'Ciudades',
      'cat.rivers': 'Ríos de {cont}', 'cat.rivers.all': 'Todos los ríos', 'cat.cities': 'Ciudades de {cont}', 'cat.cities.all': 'Grandes ciudades del mundo',
      'blurb.rivers': 'Señala cada río en el mapa.', 'blurb.rivers.all': 'Los grandes ríos del planeta.',
      'blurb.cities': 'Las ciudades más pobladas.', 'blurb.cities.all': 'Las grandes urbes del planeta.',
      'hint.label': 'pista',
      'soon.list': 'Montañas|Lenguas|Monumentos|Personajes',
      'cont.of.EU': 'Europa', 'cont.of.AF': 'África', 'cont.of.AS': 'Asia', 'cont.of.AM': 'América', 'cont.of.OC': 'Oceanía',
      'cont.AM': 'América', 'cont.EU': 'Europa', 'cont.AF': 'África', 'cont.AS': 'Asia', 'cont.OC': 'Oceanía', 'cont.AN': 'Antártida',
      'ocean.pacifico': 'Océano Pacífico', 'ocean.atlantico': 'Océano Atlántico', 'ocean.indico': 'Océano Índico', 'ocean.artico': 'Océano Ártico', 'ocean.antartico': 'Océano Antártico',
      'oceanShort.pacifico': 'Pacífico', 'oceanShort.atlantico': 'Atlántico', 'oceanShort.indico': 'Índico', 'oceanShort.artico': 'Ártico', 'oceanShort.antartico': 'Antártico'
    },
    en: {
      'home.title': 'Back to categories',
      'app.sub': 'Complete the map',
      'lang.label': 'Language',
      'stat.time': 'Time', 'stat.found': 'Correct', 'stat.errors': 'Mistakes',
      'btn.pause': 'Pause', 'btn.pauseTitle': 'Pause (P)', 'btn.resume': 'Resume', 'btn.restart': 'Restart', 'btn.categories': 'Categories',
      'map.aria': 'Blank world map', 'loading': 'Unfolding the chart…', 'load.error': 'Could not load the map: {msg}',
      'zoom.in': 'Zoom in', 'zoom.out': 'Zoom out', 'zoom.fit': 'Fit view',
      'panel.index': 'Index', 'panel.remaining': '{n} left', 'panel.find': 'Find on the map',
      'panel.order': 'Order', 'order.rand': 'Random', 'order.alpha': 'A–Z',
      'skip': 'Skip ›', 'skip.title': 'Go to the next one (S key)',
      'dock.flags': 'flags', 'flag.aria': 'Flag',
      'menu.options': 'Options', 'menu.records': 'Records', 'menu.soon': 'Coming soon', 'soon.prep': 'In preparation',
      'card.items': '{n} items', 'card.record': 'Best', 'card.unplayed': 'Not played', 'card.saved': 'Game in progress',
      'end.title': 'Chart complete', 'end.accuracy': 'Accuracy', 'end.namePh': 'Your name', 'end.nameAria': 'Player name',
      'end.save': 'Save', 'end.again': 'Play again', 'end.other': 'Another category',
      'end.first': 'First chart completed. Now you have a score to beat.', 'end.newRecord': 'New record for this chart.',
      'end.rank': 'You take place {pos} on the table.', 'end.out': 'Not in the top {n} this time.',
      'end.anon': 'Anonymous', 'end.savedAs': 'Saved as {name}.', 'end.savedOut': 'Saved, but not in the top {n}.',
      'pause.title': 'Paused', 'pause.exit': 'Save and exit to menu', 'pause.prog': '{found} of {total} · {err} mistakes',
      'resume.title': 'Game in progress', 'resume.q': 'Do you want to continue where you left off?', 'resume.yes': 'Continue',
      'resume.no': 'Start over', 'resume.info': '{cat}: {found} of {total} placed, {time}, {err} mistakes.', 'cancel': 'Cancel',
      'exit.title': 'Exit', 'exit.q': 'Leave this game? (your progress will be saved)', 'exit.yes': 'Exit', 'exit.no': 'Keep playing',
      'toast.notInCatName': '{name} is not part of this chart', 'toast.notInCat': 'That is not part of this chart',
      'toast.already': 'Already placed: {name}', 'toast.no': 'No. That is {name}', 'toast.wrong': 'Wrong',
      'opt.title': 'Options', 'opt.lang': 'Language', 'opt.placeLang': 'Place names',
      'opt.placeLang.help': 'How countries, capitals, oceans and continents are written. "Local" uses the name in the country’s own language.',
      'place.auto': 'Same as the game', 'place.local': 'Local (original)', 'place.en': 'English', 'place.es': 'Spanish',
      'opt.aids': 'Assists', 'opt.show': 'Show clicked country',
      'opt.show.help': 'When you miss, it tells you what you clicked. It also shows names when hovering over places outside the chart.',
      'opt.hints.pre': 'Enable hints after', 'opt.hints.post': 'mistakes',
      'opt.hints.help': 'After that many misses in a row on the same item, the answer blinks on the map.',
      'opt.aided': 'Records set with assists get a dot (·) next to the name.',
      'opt.map': 'Map', 'opt.marker': 'Size of the dots for small countries',
      'opt.marker.help': 'Affects the circles for Andorra, Malta, the Caribbean and Pacific islands, etc.',
      'opt.ask': 'What is asked', 'opt.limited': 'States with limited recognition', 'opt.terr': 'Dependent territories',
      'opt.seeList': 'See list', 'opt.ask.note': 'The 193 UN members and the Vatican are always asked. These changes apply when you start a chart.',
      'opt.data': 'Data', 'opt.wipe': 'Delete records and saved games', 'opt.wipe.confirm': 'Click again to delete everything', 'opt.wipe.done': 'Deleted',
      'done': 'Done', 'close': 'Close',
      'rec.title': 'Records', 'rec.note': 'Order: fewest mistakes first, then shortest time. (·) = with assists.', 'rec.empty': 'No records yet.',
      'rec.err': 'err.', 'rec.aided': 'With assists enabled',
      'group.world': 'The world', 'group.countries': 'Countries', 'group.flags': 'Flags', 'group.capitals': 'Capitals',
      'cat.continents': 'Oceans and continents', 'cat.countries': 'Countries of {cont}', 'cat.countries.all': 'All countries',
      'cat.flags': 'Flags of {cont}', 'cat.flags.all': 'All flags', 'cat.capitals': 'Capitals of {cont}', 'cat.capitals.all': 'All capitals',
      'blurb.continents': 'The five oceans and the six continents.',
      'blurb.countries.EU': 'From Portugal to Russia.', 'blurb.countries.AF': 'From the Maghreb to the Cape of Good Hope.', 'blurb.countries.AS': 'From Turkey to Japan.',
      'blurb.countries.AM': 'From Canada to Tierra del Fuego.', 'blurb.countries.OC': 'Australia and the Pacific islands.', 'blurb.countries.all': 'The whole world.',
      'blurb.flags': 'Match each flag to its country.', 'blurb.flags.all': 'Every flag in the world.',
      'blurb.capitals': 'Point to the country of each capital.', 'blurb.capitals.all': 'Every capital in the world.',
      'group.rivers': 'Rivers', 'group.cities': 'Cities',
      'cat.rivers': 'Rivers of {cont}', 'cat.rivers.all': 'All rivers', 'cat.cities': 'Cities of {cont}', 'cat.cities.all': 'Major world cities',
      'blurb.rivers': 'Find each river on the map.', 'blurb.rivers.all': 'The great rivers of the planet.',
      'blurb.cities': 'The most populous cities.', 'blurb.cities.all': 'The great cities of the planet.',
      'hint.label': 'hint',
      'soon.list': 'Mountains|Languages|Monuments|Famous people',
      'cont.of.EU': 'Europe', 'cont.of.AF': 'Africa', 'cont.of.AS': 'Asia', 'cont.of.AM': 'the Americas', 'cont.of.OC': 'Oceania',
      'cont.AM': 'America', 'cont.EU': 'Europe', 'cont.AF': 'Africa', 'cont.AS': 'Asia', 'cont.OC': 'Oceania', 'cont.AN': 'Antarctica',
      'ocean.pacifico': 'Pacific Ocean', 'ocean.atlantico': 'Atlantic Ocean', 'ocean.indico': 'Indian Ocean', 'ocean.artico': 'Arctic Ocean', 'ocean.antartico': 'Southern Ocean',
      'oceanShort.pacifico': 'Pacific', 'oceanShort.atlantico': 'Atlantic', 'oceanShort.indico': 'Indian', 'oceanShort.artico': 'Arctic', 'oceanShort.antartico': 'Southern'
    }
  };

  const KEY = 'cartarius:lang';
  function detect() {
    try { const s = localStorage.getItem(KEY); if (s && LANGS[JSON.parse(s)]) return JSON.parse(s); } catch (e) {}
    const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
    for (const l of list) { const c = String(l).toLowerCase().split('-')[0]; if (LANGS[c]) return c; }
    return 'en';
  }

  const I = {
    LANGS, PLACE_LANGS, STR,
    lang: detect(),
    placePref: 'auto',
    setLang(l) {
      if (!LANGS[l]) return;
      I.lang = l;
      try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {}
      I.apply();
    },
    // idioma efectivo de los nombres de lugares
    place() { return I.placePref === 'auto' || !I.placePref ? I.lang : I.placePref; },
    // idioma para ordenar/comparar nombres de lugares (para "local" se usa el del juego)
    collator() { const p = I.place(); return p === 'local' ? I.lang : p; },
    has(key) { return key in (STR[I.lang] || {}) || key in STR.en; },
    t(key, vars) {
      let s = (STR[I.lang] && STR[I.lang][key]);
      if (s == null) s = STR.en[key];
      if (s == null) return key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
      return s;
    },
    // Traduce el HTML estático: data-i18n (texto), data-i18n-title, data-i18n-aria, data-i18n-ph (placeholder)
    apply(root) {
      root = root || document;
      document.documentElement.lang = I.lang;
      document.documentElement.style.setProperty('--hint-label', JSON.stringify(I.t('hint.label')));
      root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = I.t(el.dataset.i18n); });
      root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = I.t(el.dataset.i18nTitle); });
      root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', I.t(el.dataset.i18nAria)); });
      root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = I.t(el.dataset.i18nPh); });
    }
  };
  window.CartariusI18n = I;
})();
