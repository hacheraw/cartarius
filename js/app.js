/* Cartarius · modo un jugador "Completa el mapa" */
(function () {
  'use strict';
  const G = window.CartariusGeo;
  const W = 1000, H = 520;
  const $ = id => document.getElementById(id);

  const CONT_COLOR = { AM: '#BE8462', EU: '#7F98A6', AF: '#CFA968', AS: '#8FA57A', OC: '#AC8CA2', AN: '#DCDDD4' };
  const OCEAN_COLOR = { pacifico: '#8FAEB0', atlantico: '#9DB8B6', indico: '#88A6AB', artico: '#B3C7C6', antartico: '#A9BFC0' };
  const COUNTRY_PALETTE = ['#CDA96C', '#BB8461', '#93A77D', '#819BAA', '#AE90A4', '#C6B37A', '#A07E5D', '#8DA89F'];
  const CONT_LABEL_AT = { AM: [-98, 40], EU: [18, 52], AF: [20, 6], AS: [92, 46], OC: [134, -25], AN: [40, -79] };

  const store = {
    get(k, d) { try { const v = localStorage.getItem('cartarius:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cartarius:' + k, JSON.stringify(v)); } catch (e) {} }
  };

  // ---------- Datos ----------
  let pieces = [];      // un trozo por polígono: {iso, raw, cont, geom, el}
  let oceans = [];      // features GeoJSON de océanos
  let playableIsos = [];

  function prepare(world) {
    const seen = new Set();
    world.forEach(f => {
      const iso = G.ALIAS[f.i] || f.i;
      f.p.forEach(poly => {
        const ext = poly[0];
        let sx = 0, sy = 0; ext.forEach(([x, y]) => { sx += x; sy += y; });
        const lon = sx / ext.length, lat = sy / ext.length;
        pieces.push({ iso, raw: f.i, en: f.n, cont: G.polygonContinent(f.i, lon, lat), geom: { type: 'Polygon', coordinates: poly } });
      });
      if (!G.NON_PLAYABLE.has(iso) && !seen.has(iso)) { seen.add(iso); playableIsos.push(iso); }
    });
    oceans = G.oceanFeatures(d3);
  }

  function itemsFor(cat) {
    if (cat.kind === 'continents') {
      return [
        ...Object.entries(G.OCEAN_NAMES).map(([k, n]) => ({ key: 'o:' + k, name: n })),
        ...Object.entries(G.CONT_NAMES).map(([k, n]) => ({ key: 'c:' + k, name: n }))
      ];
    }
    return playableIsos.filter(i => !cat.cont || G.CONT_OF[i] === cat.cont).map(i => ({ key: i, name: G.countryName(i) }));
  }

  // ---------- Mapa ----------
  const svg = d3.select('#map');
  let layer, projection, path, zoom, currentK = 1;

  function hash(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
  function colorFor(key) {
    if (key.startsWith('o:')) return OCEAN_COLOR[key.slice(2)];
    if (key.startsWith('c:')) return CONT_COLOR[key.slice(2)];
    return COUNTRY_PALETTE[hash(key) % COUNTRY_PALETTE.length];
  }

  function pieceKey(p, cat) {
    if (cat.kind === 'continents') return p.cont ? 'c:' + p.cont : null;
    if (G.NON_PLAYABLE.has(p.iso)) return null;
    if (cat.cont && G.CONT_OF[p.iso] !== cat.cont) return null;
    return p.iso;
  }

  function drawMap(cat) {
    const view = G.VIEWS[cat.view];
    svg.selectAll('*').remove();
    svg.attr('class', cat.kind === 'continents' ? 'mode-continents' : 'mode-countries');
    projection = d3.geoNaturalEarth1().rotate([view.rotate, 0]).fitExtent([[6, 6], [W - 6, H - 6]], { type: 'Sphere' });
    path = d3.geoPath(projection);
    layer = svg.append('g');
    layer.append('path').attr('class', 'sphere').datum({ type: 'Sphere' }).attr('d', path);
    layer.append('path').attr('class', 'grat').datum(d3.geoGraticule10()).attr('d', path);

    const gO = layer.append('g');
    oceans.forEach(f => {
      f.el = gO.append('path').attr('class', 'ocean').attr('d', path(f)).node();
      f.el.__key = 'o:' + f.id;
    });

    const gL = layer.append('g');
    const areaByKey = {};
    pieces.forEach(p => {
      const key = pieceKey(p, cat);
      const d = path(p.geom);
      p.el = null;
      if (!d) return;
      const el = gL.append('path').attr('d', d).attr('class', 'land ' + (key ? 'play' : 'off')).node();
      el.__key = key; el.__piece = p;
      p.el = el; p.key = key;
      if (key && cat.kind === 'countries') {
        const a = path.area(p.geom);
        const e = areaByKey[key] || (areaByKey[key] = { area: 0, best: null, bestA: -1 });
        e.area += a; if (a > e.bestA) { e.bestA = a; e.best = p; }
      }
    });
    // marcadores para países diminutos
    const gM = layer.append('g');
    Object.entries(areaByKey).forEach(([key, e]) => {
      if (e.area >= 14) return;
      const [x, y] = path.centroid(e.best.geom);
      if (!isFinite(x)) return;
      const c = gM.append('circle').attr('class', 'marker').attr('cx', x).attr('cy', y).attr('r', 4.2).node();
      c.__key = key; c.__marker = true;
      (e.best.markers = e.best.markers || []).push(c);
      state.markers[key] = c;
    });
    layer.append('g').attr('class', 'labels');

    zoom = d3.zoom().scaleExtent([1, 40]).translateExtent([[0, 0], [W, H]])
      .filter(ev => (!ev.ctrlKey || ev.type === 'wheel') && !ev.button)
      .on('zoom', ev => {
        layer.attr('transform', ev.transform);
        currentK = ev.transform.k;
        layer.selectAll('.marker').attr('r', 4.2 / currentK);
        layer.selectAll('.label').attr('font-size', d => d.size / Math.sqrt(currentK)).attr('stroke-width', 3 / currentK);
      });
    svg.call(zoom).on('dblclick.zoom', null);
    fitView(cat, false);
  }

  function viewTransform(cat) {
    const v = G.VIEWS[cat.view];
    const [[x0, y0], [x1, y1]] = v.box;
    if (cat.view === 'WORLD') return d3.zoomIdentity;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) {
      const p = projection([x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * j / 12]);
      if (!p) continue;
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }
    const k = Math.min(40, 0.96 / Math.max((maxX - minX) / W, (maxY - minY) / H));
    const tx = W / 2 - k * (minX + maxX) / 2, ty = H / 2 - k * (minY + maxY) / 2;
    return d3.zoomIdentity.translate(tx, ty).scale(k);
  }
  function fitView(cat, animate) {
    const t = viewTransform(cat);
    (animate ? svg.transition().duration(600) : svg).call(zoom.transform, t);
  }

  function addLabel(key) {
    let at, name, sea = false;
    if (key.startsWith('o:')) { at = G.OCEAN_LABEL_AT[key.slice(2)]; name = G.OCEAN_NAMES[key.slice(2)].replace('Océano ', ''); sea = true; }
    else if (key.startsWith('c:')) { at = CONT_LABEL_AT[key.slice(2)]; name = G.CONT_NAMES[key.slice(2)]; }
    else return;
    const p = projection(at); if (!p) return;
    const d = { size: sea ? 15 : 17 };
    layer.select('.labels').append('text').datum(d).attr('class', 'label' + (sea ? ' sea' : ''))
      .attr('x', p[0]).attr('y', p[1]).attr('font-size', d.size / Math.sqrt(currentK)).attr('stroke-width', 3 / currentK)
      .text(sea ? name.toUpperCase() : name);
  }

  function elementsFor(key) {
    if (key.startsWith('o:')) return oceans.filter(f => 'o:' + f.id === key).map(f => f.el);
    const els = pieces.filter(p => p.el && p.key === key).map(p => p.el);
    if (state.markers[key]) els.push(state.markers[key]);
    return els;
  }
  function paint(key) {
    const c = colorFor(key);
    elementsFor(key).forEach(el => { el.classList.add('painted'); el.classList.remove('hint'); el.style.fill = c; });
    addLabel(key);
  }
  function flash(els) {
    els.forEach(el => { if (el.classList.contains('painted')) return; el.classList.remove('wrong'); void el.getBBox(); el.classList.add('wrong'); setTimeout(() => el.classList.remove('wrong'), 700); });
  }

  // ---------- Partida ----------
  const state = { cat: null, items: [], total: 0, sel: null, found: new Set(), errors: 0, tries: 0, hinted: new Set(), start: 0, timer: null, ended: false, markers: {} };
  let order = store.get('order', 'rand');

  function nameOfKey(key) {
    if (key.startsWith('o:')) return G.OCEAN_NAMES[key.slice(2)];
    if (key.startsWith('c:')) return G.CONT_NAMES[key.slice(2)];
    return G.countryName(key);
  }

  function sortItems(items) {
    if (order === 'alpha') return items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items;
  }

  function startGame(cat) {
    state.cat = cat; state.items = sortItems(itemsFor(cat)); state.total = state.items.length;
    state.found = new Set(); state.errors = 0; state.tries = 0; state.hinted = new Set(); state.start = 0; state.ended = false; state.markers = {};
    clearInterval(state.timer); state.timer = null;
    $('catTitle').textContent = cat.title;
    $('menu').hidden = true; $('modal').hidden = true;
    drawMap(cat);
    state.sel = state.items[0] ? state.items[0].key : null;
    renderList(); renderStats();
    if (location.hash !== '#' + cat.id) history.replaceState(null, '', '#' + cat.id);
  }

  function renderList() {
    const ol = $('list'); ol.innerHTML = '';
    state.items.forEach((it, i) => {
      const li = document.createElement('li');
      if (state.hinted.has(it.key)) li.className = 'hinted';
      const b = document.createElement('button');
      b.innerHTML = '<em>' + (i + 1) + '</em>';
      b.appendChild(document.createTextNode(it.name));
      if (it.key === state.sel) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', () => select(it.key));
      li.dataset.key = it.key; li.appendChild(b); ol.appendChild(li);
    });
    const cur = ol.querySelector('[aria-current="true"]');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
    $('target').textContent = state.sel ? nameOfKey(state.sel) : '—';
    $('pCount').textContent = state.items.length + ' restantes';
  }
  function select(key) {
    if (state.sel === key) return;
    pieces.forEach(p => p.el && p.el.classList.remove('hint'));
    oceans.forEach(o => o.el.classList.remove('hint'));
    state.sel = key; state.tries = 0; renderList();
  }
  function renderStats() {
    $('sFound').textContent = state.found.size + '/' + state.total;
    $('sErr').textContent = state.errors;
    $('pBar').style.width = (state.total ? 100 * state.found.size / state.total : 0) + '%';
    $('sTime').textContent = fmt(elapsed());
  }
  function elapsed() { return state.start ? (state.endAt || Date.now()) - state.start : 0; }
  function fmt(ms) { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function ensureTimer() {
    if (state.start) return;
    state.start = Date.now(); state.endAt = 0;
    state.timer = setInterval(() => { $('sTime').textContent = fmt(elapsed()); }, 500);
  }

  let toastT;
  function toast(msg, kind) {
    const t = $('toast'); t.textContent = msg; t.className = 'toast show ' + (kind || '');
    clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast'), 1400);
  }

  function onMapClick(ev) {
    if (state.ended || !state.sel) return;
    const el = ev.target;
    if (!el || !('__key' in el)) return;
    const key = el.__key;
    if (!key) {
      if (el.__piece && state.cat.kind === 'countries') toast(G.countryName(el.__piece.raw, el.__piece.en) + ' no entra en esta carta');
      return;
    }
    if (state.found.has(key)) { toast('Ya colocado: ' + nameOfKey(key)); return; }
    ensureTimer();
    if (key === state.sel) {
      state.found.add(key); paint(key); toast(nameOfKey(key), 'ok');
      const idx = state.items.findIndex(i => i.key === key);
      const li = $('list').querySelector('li[data-key="' + CSS.escape(key) + '"]');
      state.items.splice(idx, 1);
      state.sel = state.items.length ? state.items[Math.min(idx, state.items.length - 1)].key : null;
      state.tries = 0;
      $('target').textContent = state.sel ? nameOfKey(state.sel) : '—';
      if (li) { li.classList.add('gone'); setTimeout(renderList, 300); } else renderList();
      renderStats();
      if (!state.items.length) finish();
    } else {
      state.errors++; state.tries++;
      flash(elementsFor(key));
      toast('No. Eso es ' + nameOfKey(key), 'bad');
      if (state.tries >= 3) {
        state.hinted.add(state.sel);
        elementsFor(state.sel).forEach(e => e.classList.add('hint'));
        renderList();
      }
      renderStats();
    }
  }

  function finish() {
    state.ended = true; state.endAt = Date.now(); clearInterval(state.timer); renderStats();
    const ms = elapsed();
    const acc = Math.round(100 * state.total / (state.total + state.errors));
    $('mTime').textContent = fmt(ms); $('mErr').textContent = state.errors; $('mAcc').textContent = acc + '%';
    const best = store.get('best:' + state.cat.id, null);
    let msg;
    if (!best || state.errors < best.errors || (state.errors === best.errors && ms < best.ms)) {
      store.set('best:' + state.cat.id, { ms, errors: state.errors });
      msg = best ? 'Nuevo récord en esta carta.' : 'Primera carta completada. Ya tienes marca que batir.';
    } else msg = 'Tu récord: ' + fmt(best.ms) + ' con ' + best.errors + ' errores.';
    $('mRecord').textContent = msg;
    setTimeout(() => { $('modal').hidden = false; }, 700);
  }

  function skip() {
    if (state.items.length < 2) return;
    const idx = state.items.findIndex(i => i.key === state.sel);
    const [it] = state.items.splice(idx, 1); state.items.push(it);
    state.sel = state.items[idx] ? state.items[idx].key : state.items[0].key;
    state.tries = 0; pieces.forEach(p => p.el && p.el.classList.remove('hint')); renderList();
  }

  // Tooltip con el nombre de lo ya pintado o de territorios fuera de la carta
  const tip = $('tip');
  function onMove(ev) {
    const el = ev.target; let name = null;
    if (el && el.classList && el.classList.contains('painted') && el.__key) name = nameOfKey(el.__key);
    else if (el && el.__piece && !el.__key && state.cat && state.cat.kind === 'countries') name = G.countryName(el.__piece.raw, el.__piece.en);
    if (!name) { tip.hidden = true; return; }
    tip.textContent = name; tip.hidden = false;
    tip.style.left = (ev.clientX + 14) + 'px'; tip.style.top = (ev.clientY + 12) + 'px';
  }

  // ---------- Menú ----------
  function renderMenu() {
    const box = $('cards'); box.innerHTML = '';
    G.CATEGORIES.forEach(cat => {
      const n = itemsFor(cat).length;
      const best = store.get('best:' + cat.id, null);
      const b = document.createElement('button'); b.className = 'card';
      b.innerHTML = '<h3></h3><p></p><div class="meta"><span>' + n + ' elementos</span><span>' + (best ? 'Récord <b>' + fmt(best.ms) + ' · ' + best.errors + ' err.</b>' : 'Sin jugar') + '</span></div>';
      b.querySelector('h3').textContent = cat.title; b.querySelector('p').textContent = cat.blurb;
      b.addEventListener('click', () => startGame(cat));
      box.appendChild(b);
    });
    const soon = $('soon'); soon.innerHTML = '';
    G.UPCOMING.forEach(t => {
      const d = document.createElement('div'); d.className = 'card soon';
      d.innerHTML = '<h3></h3><p>En preparación</p>'; d.querySelector('h3').textContent = t; soon.appendChild(d);
    });
  }
  function showMenu() {
    clearInterval(state.timer); state.ended = true;
    renderMenu(); $('menu').hidden = false; $('modal').hidden = true;
    history.replaceState(null, '', location.pathname + location.search);
  }

  // ---------- Arranque ----------
  function wire() {
    svg.on('click', onMapClick).on('mousemove', onMove).on('mouseleave', () => (tip.hidden = true));
    $('home').onclick = showMenu; $('toMenu').onclick = showMenu; $('mMenu').onclick = showMenu;
    $('restart').onclick = () => state.cat && startGame(state.cat);
    $('mAgain').onclick = () => startGame(state.cat);
    $('skip').onclick = skip;
    $('zIn').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1.6);
    $('zOut').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6);
    $('zFit').onclick = () => state.cat && fitView(state.cat, true);
    const setOrder = o => {
      order = o; store.set('order', o);
      $('oRand').setAttribute('aria-pressed', o === 'rand'); $('oAlpha').setAttribute('aria-pressed', o === 'alpha');
      if (state.cat && !state.ended) { sortItems(state.items); state.sel = state.items[0] && state.items[0].key; state.tries = 0; renderList(); }
    };
    $('oRand').onclick = () => setOrder('rand'); $('oAlpha').onclick = () => setOrder('alpha');
    setOrder(order);
    document.addEventListener('keydown', ev => {
      if (!$('menu').hidden || state.ended || !state.items.length) return;
      const idx = state.items.findIndex(i => i.key === state.sel);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); select(state.items[(idx + 1) % state.items.length].key); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); select(state.items[(idx - 1 + state.items.length) % state.items.length].key); }
      else if (ev.key === 's' || ev.key === 'S') skip();
    });
    window.addEventListener('hashchange', route);
  }
  function route() {
    const id = location.hash.slice(1);
    const cat = G.CATEGORIES.find(c => c.id === id);
    if (cat) { if (!state.cat || state.cat.id !== id || state.ended) startGame(cat); }
    else showMenu();
  }

  async function boot() {
    let world = window.CARTARIUS_WORLD;
    if (!world) { const r = await fetch('data/world.json'); world = await r.json(); }
    prepare(world);
    $('loading').remove();
    wire();
    route();
  }
  boot().catch(err => { $('loading').textContent = 'No se pudo cargar el mapa: ' + err.message; console.error(err); });
})();
