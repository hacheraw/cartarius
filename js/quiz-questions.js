/* Cartarius · generador de preguntas del Quiz (lo usa la pantalla del anfitrión).
   Cada pregunta: { type, key, text, flag?, shape?, options: [{ k, label }], correct } */
(function () {
  'use strict';
  const G = window.CartariusGeo, I18N = window.CartariusI18n, t = I18N.t;
  const CONTS = ['EU', 'AF', 'AS', 'AM', 'OC'];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- Siluetas: polígonos de cada país a partir de data/world ----------
  const shapes = {}; // iso -> [{ coords, area }]
  function prepareShapes(world) {
    world.forEach(f => {
      const iso = G.ALIAS[f.i] || f.i;
      f.p.forEach(poly => (shapes[iso] = shapes[iso] || []).push({ type: 'Polygon', coordinates: poly }));
    });
  }
  // Devuelve el trazado SVG (viewBox 0 0 400 300) de la parte principal del país
  function shapePath(iso) {
    const polys = (shapes[iso] || []).map(g => ({ g, a: d3.geoArea(g) })).sort((x, y) => y.a - x.a);
    if (!polys.length) return null;
    const main = polys[0].g, c = d3.geoCentroid(main);
    // se quedan las partes grandes y cercanas (sin territorios de ultramar)
    const keep = polys.filter(p => p.a >= polys[0].a * 0.01 && d3.geoDistance(d3.geoCentroid(p.g), c) < 0.5).map(p => p.g);
    const geo = { type: 'GeometryCollection', geometries: keep };
    const proj = d3.geoAzimuthalEqualArea().rotate([-c[0], -c[1]]).fitExtent([[10, 10], [390, 290]], geo);
    return d3.geoPath(proj)(geo);
  }

  // ---------- Conjunto de países que se pueden preguntar ----------
  function pool(region, opts) {
    return Object.keys(G.COUNTRY).filter(iso => G.isAskable(iso, opts) && CONTS.includes(G.CONT_OF[iso]) && (region === 'all' || G.CONT_OF[iso] === region));
  }
  // Distractores: primero del mismo continente, sin repetir etiqueta
  function distractors(key, n, candidates, labelOf) {
    const cont = G.CONT_OF[key], seen = new Set([labelOf(key)]);
    const same = shuffle(candidates.filter(i => i !== key && G.CONT_OF[i] === cont));
    const other = shuffle(candidates.filter(i => i !== key && G.CONT_OF[i] !== cont));
    const out = [];
    for (const i of same.concat(other)) {
      const l = labelOf(i); if (!l || seen.has(l)) continue;
      seen.add(l); out.push(i); if (out.length >= n) break;
    }
    return out;
  }
  function withOptions(q, keys, labelOf) {
    const opts = shuffle(keys.map(k => ({ k, label: labelOf(k) })));
    q.options = opts; q.correct = opts.findIndex(o => o.k === q.key);
    return q;
  }

  const MAKERS = {
    flag(iso, n, cands) {
      const c = G.COUNTRY[iso]; if (!c || !c.bandera || !c.bandera.svg) return null;
      return withOptions({ type: 'flag', key: iso, text: t('q.flag'), flag: c.bandera.svg }, [iso].concat(distractors(iso, n - 1, cands, G.countryName)), G.countryName);
    },
    capital(iso, n, cands) {
      if (!G.capitalName(iso)) return null;
      const capCands = cands.filter(i => G.capitalName(i));
      return withOptions({ type: 'capital', key: iso, text: t('q.capital', { x: G.countryName(iso) }) }, [iso].concat(distractors(iso, n - 1, capCands, G.capitalName)), G.capitalName);
    },
    shape(iso, n, cands) {
      const d = shapePath(iso); if (!d) return null;
      return withOptions({ type: 'shape', key: iso, text: t('q.shape'), shape: d }, [iso].concat(distractors(iso, n - 1, cands.filter(i => shapes[i]), G.countryName)), G.countryName);
    },
    continent(iso, n) {
      const cont = G.CONT_OF[iso];
      const others = shuffle(CONTS.filter(c => c !== cont)).slice(0, n - 1);
      const q = { type: 'continent', key: iso, text: t('q.continent', { x: G.countryName(iso) }) };
      const opts = shuffle([cont].concat(others).map(k => ({ k, label: G.CONT_NAMES[k] })));
      q.options = opts; q.correct = opts.findIndex(o => o.k === cont);
      return q;
    }
  };

  // Genera `count` preguntas mezclando los tipos elegidos, sin repetir país
  function generate({ types, region, count, nOptions, opts }) {
    const cands = pool(region, opts);
    const order = shuffle(cands.slice());
    const out = []; let ti = Math.floor(Math.random() * types.length);
    for (const iso of order) {
      if (out.length >= count) break;
      const type = types[ti % types.length];
      const q = MAKERS[type](iso, nOptions, cands);
      if (q && q.options.length === nOptions) { out.push(q); ti++; }
    }
    return out;
  }

  window.CartariusQuestions = { prepareShapes, generate, CONTS };
})();
