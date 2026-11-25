/* Cartarius · datos geográficos auxiliares: continentes, océanos, nombres y categorías */
(function () {
  'use strict';

  // Los datos de cada país vienen de data/countries.json (REST Countries + data/overrides.json).
  // init() se llama al arrancar, cuando ya están cargados.
  const COUNTRY = {};   // iso2 -> registro de countries.json
  const CONT_OF = {};   // iso2 -> EU | AF | AS | AM | OC | AN
  const I18N = window.CartariusI18n;
  const t = (k, v) => I18N.t(k, v);
  const CONT_IDS = ['AM', 'EU', 'AF', 'AS', 'OC', 'AN'];
  // Océanos y continentes no tienen nombre "local": con esa opción se usa el idioma del juego
  const placeT = key => { const p = I18N.place(); const l = I18N.STR[p] ? p : I18N.lang; return (I18N.STR[l] && I18N.STR[l][key]) || t(key); };
  const contName = k => placeT('cont.' + k);
  const CONT_NAMES = {}; CONT_IDS.forEach(k => Object.defineProperty(CONT_NAMES, k, { get: () => contName(k), enumerable: true }));
  const LIMITED = new Set();   // reconocimiento limitado + observadores (salvo el Vaticano)
  const DEPENDENT = new Set(); // territorios dependientes
  const NEVER = new Set(['AQ', 'XG']); // Antártida (solo como continente) y glaciar de Siachen
  // Zonas del mapa sin código ISO que se cuentan como parte de otro país
  const ALIAS = { XC: 'CY', XS: 'SO' };

  function init(data) {
    (data.paises || []).forEach(c => {
      COUNTRY[c.iso2] = c;
      if (c.continente) CONT_OF[c.iso2] = c.continente;
      if (c.estatus === 'reconocimiento_limitado' || (c.estatus === 'observador' && c.iso2 !== 'VA')) LIMITED.add(c.iso2);
      if (c.estatus === 'dependiente' && !NEVER.has(c.iso2)) DEPENDENT.add(c.iso2);
    });
    Object.entries(ALIAS).forEach(([a, b]) => { if (CONT_OF[b]) CONT_OF[a] = CONT_OF[b]; });
    CONT_OF.XG = 'AS';
  }
  function isAskable(iso, opts) {
    if (NEVER.has(iso)) return false;
    if (LIMITED.has(iso)) return !!opts.limited;
    if (DEPENDENT.has(iso)) return !!opts.territories;
    return true;
  }
  const dns = {};
  function displayNames(l) {
    if (!(l in dns)) { try { dns[l] = new Intl.DisplayNames([l], { type: 'region' }); } catch (e) { dns[l] = null; } }
    return dns[l];
  }
  // Nombre del país en el idioma de lugares elegido (es | en | local), con el inglés de respaldo
  function countryName(iso, fallback) {
    const c = COUNTRY[iso], p = I18N.place();
    if (c) return (c.nombres && (c.nombres[p] || c.nombres.en)) || c.nombre;
    try { const d = displayNames(p === 'local' ? 'en' : p), n = d && d.of(iso); if (n && n !== iso) return n; } catch (e) {}
    return fallback || iso;
  }
  function capitalName(iso) {
    const c = COUNTRY[iso] && COUNTRY[iso].capital; if (!c) return null;
    const p = I18N.place();
    return (c.nombres && (c.nombres[p] || c.nombres.en)) || c.nombre;
  }
  function ownerName(iso) { const c = COUNTRY[iso]; return c && c.soberano ? countryName(c.soberano) : null; }

  // Continente de un polígono concreto (territorios de ultramar, Rusia asiática, Hawái)
  function polygonContinent(iso, lon, lat) {
    if (iso === 'RU' && (lon >= 60 || lon < -100)) return 'AS';
    if (iso === 'FR' && lon < -30) return 'AM';
    if (iso === 'FR' && lon > 40) return 'AF';
    if (iso === 'NL' && lon < -30) return 'AM';
    if (iso === 'US' && lon < -150 && lat < 30) return 'OC';
    if (iso === 'TF' || iso === 'HM' || iso === 'GS') return null;
    return CONT_OF[iso] || null;
  }

  // ---------- Océanos (límites simplificados, inspirados en la OHI) ----------
  const AP = [ // Atlántico | Pacífico, de sur a norte
    [-67, -60], [-67, -56], [-68.5, -54.5], [-71, -51], [-69, -40], [-68, -25], [-69, -17], [-74, -8], [-75, 0], [-76, 5],
    [-77.6, 7.8], [-79.6, 9.0], [-84, 10.3], [-86, 13], [-89.5, 15], [-94.5, 17.2], [-99, 21], [-103, 28], [-105, 40], [-100, 55], [-95, 66.5]
  ];
  const AI = [ // Atlántico | Índico, de sur a norte (hasta Suez)
    [20, -60], [20, -34.8], [25, 0], [28, 15], [31.5, 29], [32.5, 30.2], [34.8, 30.4]
  ];
  const ATL_EAST_N = [[37, 33], [40, 37], [44.5, 42], [45, 46], [48, 50], [55, 58], [60, 66.5]]; // sur→norte
  const IND_NORTH = [[37, 33], [45, 35], [56, 38], [70, 36], [90, 30], [100, 25]]; // oeste→este
  const IP = [ // Índico | Pacífico, de norte a sur
    [100, 25], [98.8, 16], [99.3, 11], [102, 4], [103.5, 1.5], [104, 1], [103.6, -1.6], [105.8, -5.9], [106.5, -6.8], [114.4, -8.0],
    [116.3, -8.6], [118.7, -8.7], [121, -8.7], [124.5, -9.3], [127, -8.6], [131.5, -12.5], [137, -20], [146, -38], [146.5, -41.8], [146.9, -43.6], [146.9, -60]
  ];
  const PAC_WEST_N = [[100, 25], [105, 40], [120, 55], [140, 66.5]]; // sur→norte

  const rev = a => a.slice().reverse();
  function densify(ring) {
    // desenrolla longitudes para que cada tramo vaya por el camino corto, densifica cada ~1° y normaliza
    const u = [ring[0].slice()];
    for (let i = 1; i < ring.length; i++) {
      let [x, y] = ring[i]; const px = u[i - 1][0];
      while (x - px > 180) x -= 360;
      while (x - px < -180) x += 360;
      u.push([x, y]);
    }
    const out = [];
    for (let i = 0; i < u.length - 1; i++) {
      const [x0, y0] = u[i], [x1, y1] = u[i + 1];
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let k = 0; k < n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
    }
    out.push(u[u.length - 1]);
    const norm = x => { let r = ((x + 180) % 360 + 360) % 360 - 180; if (r === -180 && x > 0) r = 180; return r; };
    return out.map(([x, y]) => [norm(x), y]);
  }
  function closeRing(pts) { const r = pts.slice(); r.push(r[0]); return r; }

  const OCEAN_RINGS = {
    atlantico: [...AP, [60, 66.5], ...rev(ATL_EAST_N), ...rev(AI), [-67, -60]],
    indico: [...AI, ...IND_NORTH.slice(0), ...IP.slice(1), [20, -60]],
    pacifico: [[146.9, -60], ...rev(IP).slice(1), ...PAC_WEST_N.slice(1), [180, 66.5], [265, 66.5], ...rev(AP), [40, -60], [146.9, -60]],
    artico: [[-180, 66.5], [-90, 66.5], [0, 66.5], [90, 66.5], [180, 66.5]],
    antartico: [[-180, -60], [-90, -60], [0, -60], [90, -60], [180, -60]]
  };
  // Atlántico: el borde norte va por el paralelo 66.5 de -95 a 60 (el array AP termina en -95, se añade [60,66.5])
  // Pacífico: el borde sur va por el paralelo -60 de -67 (=293) a 146.9+360; se normaliza al densificar.

  const OCEAN_IDS = ['pacifico', 'atlantico', 'indico', 'artico', 'antartico'];
  const OCEAN_NAMES = {}, OCEAN_SHORT = {};
  OCEAN_IDS.forEach(k => {
    Object.defineProperty(OCEAN_NAMES, k, { get: () => placeT('ocean.' + k), enumerable: true });
    Object.defineProperty(OCEAN_SHORT, k, { get: () => placeT('oceanShort.' + k), enumerable: true });
  });
  const OCEAN_LABEL_AT = { pacifico: [-140, 5], atlantico: [-35, 25], indico: [78, -22], artico: [0, 82], antartico: [0, -66] };

  function oceanFeatures(d3) {
    return Object.keys(OCEAN_RINGS).map(id => {
      let ring = densify(closeRing(OCEAN_RINGS[id]));
      let f = { type: 'Feature', id, properties: { id }, geometry: { type: 'Polygon', coordinates: [ring] } };
      if (d3.geoArea(f) > 2 * Math.PI) f.geometry.coordinates = [ring.slice().reverse()];
      return f;
    });
  }

  // ---------- Categorías del modo "Completa el mapa" ----------
  const VIEWS = { // [[lonO, latS], [lonE, latN]], rotación
    WORLD: { box: [[-170, -58], [180, 84]], rotate: 0 },
    EU: { box: [[-25, 34], [48, 71.5]], rotate: -10 },
    AF: { box: [[-26, -36], [60, 38]], rotate: -15 },
    AS: { box: [[25, -11], [150, 56]], rotate: -90 },
    AM: { box: [[-170, -56], [-30, 75]], rotate: 90 },
    OC: { box: [[110, -50], [200, 15]], rotate: -160 }
  };

  // Títulos, textos y grupos se calculan en el idioma del juego (getters)
  const CONTS = ['EU', 'AF', 'AS', 'AM', 'OC'];
  const GROUP_OF = { continents: 'group.world', countries: 'group.countries', flags: 'group.flags', capitals: 'group.capitals', rivers: 'group.rivers', cities: 'group.cities' };
  const PREFIX = { countries: 'paises', flags: 'banderas', capitals: 'capitales', rivers: 'rios', cities: 'ciudades' };
  const ALL_SUFFIX = { countries: 'todos', flags: 'todas', capitals: 'todas', rivers: 'todos', cities: 'todas' };
  const CONT_SLUG = { EU: 'europa', AF: 'africa', AS: 'asia', AM: 'america', OC: 'oceania' };
  function makeCat(kind, cont) {
    const id = kind === 'continents' ? 'continentes' : PREFIX[kind] + '-' + (cont ? CONT_SLUG[cont] : ALL_SUFFIX[kind]);
    const c = { id, kind, cont: cont || null, view: cont || 'WORLD' };
    Object.defineProperties(c, {
      group: { get: () => t(GROUP_OF[kind]), enumerable: true },
      title: { get: () => kind === 'continents' ? t('cat.continents') : cont ? t('cat.' + kind, { cont: t('cont.of.' + cont) }) : t('cat.' + kind + '.all'), enumerable: true },
      blurb: { get: () => kind === 'continents' ? t('blurb.continents') : kind === 'countries' ? t('blurb.countries.' + (cont || 'all')) : t('blurb.' + kind + (cont ? '' : '.all')), enumerable: true }
    });
    return c;
  }
  const CATEGORIES = [makeCat('continents')];
  ['countries', 'flags', 'capitals', 'rivers', 'cities'].forEach(k => { CONTS.forEach(c => CATEGORIES.push(makeCat(k, c))); CATEGORIES.push(makeCat(k, null)); });
  const UPCOMING = { get list() { return t('soon.list').split('|'); } };

  window.CartariusGeo = {
    init, COUNTRY, CONT_OF, CONT_NAMES, LIMITED, DEPENDENT, ownerName, isAskable, ALIAS, countryName, capitalName, polygonContinent,
    oceanFeatures, OCEAN_NAMES, OCEAN_SHORT, OCEAN_LABEL_AT, VIEWS, CATEGORIES, UPCOMING
  };
})();
