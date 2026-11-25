/* Cartarius · datos geográficos auxiliares: continentes, océanos, nombres y categorías */
(function () {
  'use strict';

  const CONTINENTS = {
    EU: 'AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK XC',
    AF: 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG ZA ZM ZW XS',
    AS: 'AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IO IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE XG',
    AM: 'AG AI AR AW BB BL BM BO BR BS BZ CA CL CO CR CU CW DM DO EC FK GD GL GS GT GY HN HT JM KN KY LC MF MS MX NI PA PE PM PR PY SR SV SX TC TT US UY VC VE VG VI',
    OC: 'AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TO TV VU WF WS',
    AN: 'AQ'
  };
  const CONT_OF = {};
  for (const [c, list] of Object.entries(CONTINENTS)) list.split(' ').forEach(i => (CONT_OF[i] = c));

  const CONT_NAMES = { AM: 'América', EU: 'Europa', AF: 'África', AS: 'Asia', OC: 'Oceanía', AN: 'Antártida' };

  // Qué se puede preguntar. Por defecto: 193 miembros de la ONU + Vaticano (siempre)
  // + estados de reconocimiento limitado (opción) + territorios dependientes (opción).
  const LIMITED = new Set('XK TW PS EH'.split(' '));
  const DEPENDENT = new Set('AI AS AW AX BL BM CK CW FK FO GG GL GS GU HK HM IM IO JE KY MF MO MP MS NC NF NU PF PM PN PR SH SX TC TF VG VI WF'.split(' '));
  const NEVER = new Set(['AQ', 'XG']); // Antártida (solo como continente) y glaciar de Siachen
  const TERR_OWNER = {
    AI: 'Reino Unido', AS: 'EE. UU.', AW: 'Países Bajos', AX: 'Finlandia', BL: 'Francia', BM: 'Reino Unido', CK: 'Nueva Zelanda',
    CW: 'Países Bajos', FK: 'Reino Unido', FO: 'Dinamarca', GG: 'Reino Unido', GL: 'Dinamarca', GS: 'Reino Unido', GU: 'EE. UU.',
    HK: 'China', HM: 'Australia', IM: 'Reino Unido', IO: 'Reino Unido', JE: 'Reino Unido', KY: 'Reino Unido', MF: 'Francia',
    MO: 'China', MP: 'EE. UU.', MS: 'Reino Unido', NC: 'Francia', NF: 'Australia', NU: 'Nueva Zelanda', PF: 'Francia',
    PM: 'Francia', PN: 'Reino Unido', PR: 'EE. UU.', SH: 'Reino Unido', SX: 'Países Bajos', TC: 'Reino Unido', TF: 'Francia',
    VG: 'Reino Unido', VI: 'EE. UU.', WF: 'Francia'
  };
  function isAskable(iso, opts) {
    if (NEVER.has(iso)) return false;
    if (LIMITED.has(iso)) return !!opts.limited;
    if (DEPENDENT.has(iso)) return !!opts.territories;
    return true;
  }
  // Zonas que se cuentan como parte de otro país
  const ALIAS = { XC: 'CY', XS: 'SO' };

  // Nombres en español: Intl + correcciones
  const NAME_FIX = {
    CI: 'Costa de Marfil', PS: 'Palestina', CD: 'República Democrática del Congo', CG: 'República del Congo',
    US: 'Estados Unidos', MM: 'Myanmar', SZ: 'Esuatini', CZ: 'Chequia', VA: 'Ciudad del Vaticano',
    TL: 'Timor Oriental', CV: 'Cabo Verde', FM: 'Micronesia', KR: 'Corea del Sur', KP: 'Corea del Norte',
    MK: 'Macedonia del Norte', BA: 'Bosnia y Herzegovina', TW: 'Taiwán', XK: 'Kosovo', GB: 'Reino Unido',
    ST: 'Santo Tomé y Príncipe', KN: 'San Cristóbal y Nieves', VC: 'San Vicente y las Granadinas',
    AG: 'Antigua y Barbuda', TT: 'Trinidad y Tobago', CF: 'República Centroafricana', DO: 'República Dominicana',
    AE: 'Emiratos Árabes Unidos', SA: 'Arabia Saudí', GQ: 'Guinea Ecuatorial', SS: 'Sudán del Sur', MH: 'Islas Marshall', SB: 'Islas Salomón',
    HK: 'Hong Kong', MO: 'Macao', AX: 'Islas Åland', EH: 'Sáhara Occidental', BL: 'San Bartolomé', MF: 'San Martín (Francia)',
    SX: 'San Martín (Países Bajos)', PM: 'San Pedro y Miquelón', SH: 'Santa Elena', GS: 'Islas Georgias del Sur', HM: 'Islas Heard y McDonald',
    TF: 'Tierras Australes Francesas', IO: 'Territorio Británico del Océano Índico', NF: 'Isla Norfolk', CK: 'Islas Cook',
    VG: 'Islas Vírgenes Británicas', VI: 'Islas Vírgenes de EE. UU.', FO: 'Islas Feroe', FK: 'Islas Malvinas', KY: 'Islas Caimán', TC: 'Islas Turcas y Caicos',
    MP: 'Islas Marianas del Norte', AS: 'Samoa Americana', PF: 'Polinesia Francesa', NC: 'Nueva Caledonia', WF: 'Wallis y Futuna', PN: 'Islas Pitcairn'
  };
  let dn = null;
  try { dn = new Intl.DisplayNames(['es'], { type: 'region' }); } catch (e) { /* sin Intl */ }
  function countryName(iso, fallback) {
    if (NAME_FIX[iso]) return NAME_FIX[iso];
    try { const n = dn && dn.of(iso); if (n && n !== iso) return n; } catch (e) {}
    return fallback || iso;
  }

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

  const OCEAN_NAMES = { pacifico: 'Océano Pacífico', atlantico: 'Océano Atlántico', indico: 'Océano Índico', artico: 'Océano Ártico', antartico: 'Océano Antártico' };
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

  const CATEGORIES = [
    { id: 'continentes', title: 'Océanos y continentes', kind: 'continents', view: 'WORLD', blurb: 'Los cinco océanos y los seis continentes.' },
    { id: 'paises-europa', title: 'Países de Europa', kind: 'countries', cont: 'EU', view: 'EU', blurb: 'De Portugal a Rusia.' },
    { id: 'paises-africa', title: 'Países de África', kind: 'countries', cont: 'AF', view: 'AF', blurb: 'Del Magreb al cabo de Buena Esperanza.' },
    { id: 'paises-asia', title: 'Países de Asia', kind: 'countries', cont: 'AS', view: 'AS', blurb: 'De Turquía a Japón.' },
    { id: 'paises-america', title: 'Países de América', kind: 'countries', cont: 'AM', view: 'AM', blurb: 'De Canadá a Tierra del Fuego.' },
    { id: 'paises-oceania', title: 'Países de Oceanía', kind: 'countries', cont: 'OC', view: 'OC', blurb: 'Australia y las islas del Pacífico.' },
    { id: 'paises-todos', title: 'Todos los países', kind: 'countries', cont: null, view: 'WORLD', blurb: 'El mundo entero.' }
  ];
  const UPCOMING = ['Banderas', 'Capitales', 'Ríos', 'Montañas', 'Lenguas', 'Ciudades'];

  window.CartariusGeo = {
    CONT_OF, CONT_NAMES, LIMITED, DEPENDENT, TERR_OWNER, isAskable, ALIAS, countryName, polygonContinent,
    oceanFeatures, OCEAN_NAMES, OCEAN_LABEL_AT, VIEWS, CATEGORIES, UPCOMING
  };
})();
