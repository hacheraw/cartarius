/* Cartarius · generador de preguntas del Quiz (lo usa la pantalla del anfitrión).
   Cada pregunta: { type, key, text, flag?, shape?, options: [{ k, label }], correct }
   Tipos: flag (bandera), capital (capital de un país / país de una capital), river (dónde nace / desemboca),
   city (país de una ciudad / ciudad de un país), shape (silueta; sin microestados). */
(function () {
  'use strict';
  const G = window.CartariusGeo, I18N = window.CartariusI18n, t = I18N.t;
  const CONTS = ['EU', 'AF', 'AS', 'AM', 'OC'];
  const TYPES = ['flag', 'capital', 'river', 'city', 'shape'];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const featName = f => (f.nombres && (f.nombres[I18N.place()] || f.nombres.en)) || f.id;

  // ---------- Siluetas: polígonos de cada país a partir de data/world ----------
  const shapes = {}; // iso -> [Polygon]
  const MIN_POINTS = 16; // con menos puntos el contorno es un triángulo o un rombo (Vaticano, Malta, Luxemburgo…)
  function prepareShapes(world) {
    world.forEach(f => {
      const iso = G.ALIAS[f.i] || f.i;
      f.p.forEach(poly => (shapes[iso] = shapes[iso] || []).push({ type: 'Polygon', coordinates: poly }));
    });
  }
  function shapeParts(iso) {
    const polys = (shapes[iso] || []).map(g => ({ g, a: d3.geoArea(g) })).sort((x, y) => y.a - x.a);
    if (!polys.length) return null;
    const main = polys[0], c = d3.geoCentroid(main.g);
    // se quedan las partes grandes y cercanas (sin territorios de ultramar)
    const keep = polys.filter(p => p.a >= main.a * 0.01 && d3.geoDistance(d3.geoCentroid(p.g), c) < 0.5).map(p => p.g);
    return { keep, c, points: main.g.coordinates[0].length };
  }
  // contornos que con esta resolución salen deformes o irreconocibles
  const BAD_SHAPES = new Set(['HT', 'GM', 'GW', 'EH', 'CY', 'JM', 'TL', 'DJ', 'LB', 'BS', 'BZ']);
  const hasShape = iso => { if (BAD_SHAPES.has(iso)) return false; const s = shapeParts(iso); return !!s && s.points >= MIN_POINTS; };
  // Trazado SVG (viewBox 0 0 400 300) de la parte principal del país
  function shapePath(iso) {
    const s = shapeParts(iso); if (!s) return null;
    const geo = { type: 'GeometryCollection', geometries: s.keep };
    const proj = d3.geoAzimuthalEqualArea().rotate([-s.c[0], -s.c[1]]).fitExtent([[10, 10], [390, 290]], geo);
    return d3.geoPath(proj)(geo);
  }

  // ---------- Opciones ----------
  // Distractores: primero del mismo continente que `cont`, sin repetir etiqueta
  function distractors(keys, n, candidates, labelOf, contOf, cont, exclude) {
    const seen = new Set(keys.map(labelOf)), ex = new Set(keys.concat(exclude || []));
    const ok = candidates.filter(i => !ex.has(i));
    const same = shuffle(ok.filter(i => contOf(i) === cont)), other = shuffle(ok.filter(i => contOf(i) !== cont));
    const out = [];
    for (const i of same.concat(other)) {
      const l = labelOf(i); if (!l || seen.has(l)) continue;
      seen.add(l); out.push(i); if (out.length >= n) break;
    }
    return out;
  }
  function build(q, answer, others, labelOf) {
    const opts = shuffle([answer].concat(others).map(k => ({ k, label: labelOf(k) })));
    q.options = opts; q.correct = opts.findIndex(o => o.k === answer);
    return q;
  }
  const contOf = iso => G.CONT_OF[iso];
  // Pregunta cuya respuesta es un país
  function countryQ(q, iso, n, ctx, exclude) {
    if (!ctx.countries.includes(iso)) return null;
    return build(q, iso, distractors([iso], n - 1, ctx.countries, G.countryName, contOf, contOf(iso), exclude), G.countryName);
  }

  // ---------- Tipos ----------
  // items(ctx): elementos que se pueden preguntar; make(item, n, ctx): la pregunta (o null)
  const KINDS = {
    flag: {
      items: ctx => ctx.countries.filter(iso => G.COUNTRY[iso] && G.COUNTRY[iso].bandera && G.COUNTRY[iso].bandera.svg),
      make: (iso, n, ctx) => countryQ({ type: 'flag', key: iso, text: t('q.flag'), flag: G.COUNTRY[iso].bandera.svg }, iso, n, ctx)
    },
    capital: {
      items: ctx => ctx.countries.filter(iso => G.capitalName(iso)),
      make(iso, n, ctx) {
        if (Math.random() < 0.5) return countryQ({ type: 'capital', key: iso, text: t('q.capitalOf', { x: G.capitalName(iso) }) }, iso, n, ctx);
        const caps = ctx.countries.filter(i => G.capitalName(i));
        return build({ type: 'capital', key: iso, text: t('q.capital', { x: G.countryName(iso) }) }, iso, distractors([iso], n - 1, caps, G.capitalName, contOf, contOf(iso)), G.capitalName);
      }
    },
    river: {
      items: ctx => ctx.feat.rios.filter(r => ctx.regions.includes(r.cont) && ((r.nace || []).length || (r.desemboca || []).length)),
      make(r, n, ctx) {
        const dirs = [['nace', 'q.riverSrc'], ['desemboca', 'q.riverMouth']].filter(([k]) => (r[k] || []).length && ctx.countries.includes(r[k][0]));
        if (!dirs.length) return null;
        const [k, txt] = pick(dirs);
        return countryQ({ type: 'river', key: r.id, text: t(txt, { x: featName(r) }) }, r[k][0], n, ctx, r[k]);
      }
    },
    city: {
      items: ctx => ctx.feat.ciudades.filter(c => ctx.countries.includes(c.iso)),
      make(c, n, ctx) {
        if (Math.random() < 0.5) return countryQ({ type: 'city', key: c.id, text: t('q.cityIn', { x: featName(c) }) }, c.iso, n, ctx);
        // ¿Qué ciudad está en X? Las otras opciones son ciudades de otros países
        const byId = ctx.cityById, others = ctx.feat.ciudades.filter(o => o.iso !== c.iso && ctx.countries.includes(o.iso)).map(o => o.id);
        const label = id => featName(byId[id]);
        const ds = distractors([c.id], n - 1, others, label, id => byId[id].cont, c.cont);
        return build({ type: 'city', key: c.id, text: t('q.cityOf', { x: G.countryName(c.iso) }) }, c.id, ds, label);
      }
    },
    shape: {
      items: ctx => ctx.countries.filter(hasShape),
      make: (iso, n, ctx) => countryQ({ type: 'shape', key: iso, text: t('q.shape'), shape: shapePath(iso) }, iso, n, { countries: ctx.countries.filter(hasShape) })
    }
  };

  // Genera `count` preguntas alternando los tipos elegidos, sin repetir elemento
  function generate({ types, regions, count, nOptions, opts, features }) {
    regions = (regions || CONTS).filter(r => CONTS.includes(r));
    const countries = Object.keys(G.COUNTRY).filter(iso => G.isAskable(iso, opts) && regions.includes(G.CONT_OF[iso]));
    const feat = features || { rios: [], ciudades: [] };
    const ctx = { regions, countries, feat, cityById: Object.fromEntries(feat.ciudades.map(c => [c.id, c])) };
    const bags = {};
    types.filter(k => KINDS[k]).forEach(k => { bags[k] = shuffle(KINDS[k].items(ctx).slice()); });
    let live = Object.keys(bags).filter(k => bags[k].length);
    const out = [], used = new Set();
    let ti = Math.floor(Math.random() * Math.max(1, live.length));
    while (out.length < count && live.length) {
      const type = live[ti % live.length], bag = bags[type];
      let q = null;
      while (!q && bag.length) {
        const item = bag.pop(), id = typeof item === 'string' ? item : item.id;
        if (used.has(type + ':' + id)) continue;
        q = KINDS[type].make(item, nOptions, ctx);
        if (q && q.options.length !== nOptions) q = null;
        if (q) used.add(type + ':' + id);
      }
      if (q) { out.push(q); ti++; }
      live = live.filter(k => bags[k].length);
    }
    return out;
  }

  window.CartariusQuestions = { prepareShapes, generate, shapePath, hasShape, CONTS, TYPES };
})();
