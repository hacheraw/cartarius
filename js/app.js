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
  const MAX_RECORDS = 10;

  // ---------- Almacenamiento local ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cartarius:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cartarius:' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('cartarius:' + k); } catch (e) {} }
  };
  const DEFAULT_OPTS = { showClicked: false, hints: false, hintAfter: 3, limited: true, territories: false, order: 'rand' };
  let opts = Object.assign({}, DEFAULT_OPTS, store.get('options', {}));
  const saveOpts = () => store.set('options', opts);

  // ---------- Datos ----------
  const pieces = [];    // un trozo por polígono: {iso, raw, en, cont, geom, el, key}
  let oceans = [];
  const allIsos = [];   // todos los códigos con geometría (tras alias)

  function prepare(world) {
    const seen = new Set();
    world.forEach(f => {
      const iso = G.ALIAS[f.i] || f.i;
      f.p.forEach(poly => {
        const ext = poly[0];
        let sx = 0, sy = 0; ext.forEach(([x, y]) => { sx += x; sy += y; });
        pieces.push({ iso, raw: f.i, en: f.n, cont: G.polygonContinent(f.i, sx / ext.length, sy / ext.length), geom: { type: 'Polygon', coordinates: poly } });
      });
      if (!seen.has(iso)) { seen.add(iso); allIsos.push(iso); }
    });
    oceans = G.oceanFeatures(d3);
  }

  function poolFor(cat) { // códigos que entran en la carta con las opciones actuales
    if (cat.kind === 'continents') return null;
    return allIsos.filter(i => G.isAskable(i, opts) && (!cat.cont || G.CONT_OF[i] === cat.cont));
  }
  function itemsFromPool(cat, pool) {
    if (cat.kind === 'continents') {
      return [
        ...Object.entries(G.OCEAN_NAMES).map(([k, n]) => ({ key: 'o:' + k, name: n })),
        ...Object.entries(G.CONT_NAMES).map(([k, n]) => ({ key: 'c:' + k, name: n }))
      ];
    }
    return pool.map(i => ({ key: i, name: G.countryName(i) }));
  }
  function nameOfKey(key) {
    if (key.startsWith('o:')) return G.OCEAN_NAMES[key.slice(2)];
    if (key.startsWith('c:')) return G.CONT_NAMES[key.slice(2)];
    return G.countryName(key);
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

  function drawMap(cat, poolSet) {
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
      const key = cat.kind === 'continents' ? (p.cont ? 'c:' + p.cont : null) : (poolSet.has(p.iso) ? p.iso : null);
      const d = path(p.geom);
      p.el = null; p.key = key;
      if (!d) return;
      const el = gL.append('path').attr('d', d).attr('class', 'land ' + (key ? 'play' : 'off')).node();
      el.__key = key; el.__piece = p; p.el = el;
      if (key && cat.kind === 'countries') {
        const a = path.area(p.geom);
        const e = areaByKey[key] || (areaByKey[key] = { area: 0, best: null, bestA: -1 });
        e.area += a; if (a > e.bestA) { e.bestA = a; e.best = p; }
      }
    });
    const gM = layer.append('g'); // marcadores para países diminutos
    Object.entries(areaByKey).forEach(([key, e]) => {
      if (e.area >= 14) return;
      const [x, y] = path.centroid(e.best.geom);
      if (!isFinite(x)) return;
      const c = gM.append('circle').attr('class', 'marker').attr('cx', x).attr('cy', y).attr('r', 4.2).node();
      c.__key = key;
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
    if (cat.view === 'WORLD') return d3.zoomIdentity;
    const [[x0, y0], [x1, y1]] = v.box;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) {
      const p = projection([x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * j / 12]);
      if (!p) continue;
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }
    const k = Math.min(40, 0.96 / Math.max((maxX - minX) / W, (maxY - minY) / H));
    return d3.zoomIdentity.translate(W / 2 - k * (minX + maxX) / 2, H / 2 - k * (minY + maxY) / 2).scale(k);
  }
  function fitView(cat, animate) {
    (animate ? svg.transition().duration(600) : svg).call(zoom.transform, viewTransform(cat));
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
  function clearHints() { document.querySelectorAll('#map .hint').forEach(e => e.classList.remove('hint')); }
  function applyHint() {
    clearHints();
    if (!opts.hints || !state.sel || state.tries < opts.hintAfter) return;
    state.hinted.add(state.sel);
    elementsFor(state.sel).forEach(e => e.classList.add('hint'));
  }

  // ---------- Partida ----------
  const state = {
    cat: null, pool: null, items: [], total: 0, sel: null, found: new Set(), errors: 0, tries: 0, hinted: new Set(),
    acc: 0, runStart: 0, started: false, paused: false, ended: true, timer: null, markers: {}, aided: false
  };

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function sortItems(items) { return opts.order === 'alpha' ? items.sort((a, b) => a.name.localeCompare(b.name, 'es')) : shuffle(items); }

  function elapsed() { return state.acc + (state.runStart ? Date.now() - state.runStart : 0); }
  function fmt(ms) { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function startClock() { if (!state.runStart && state.started && !state.paused && !state.ended) state.runStart = Date.now(); }
  function stopClock() { if (state.runStart) { state.acc += Date.now() - state.runStart; state.runStart = 0; } }
  function ensureStarted() { if (!state.started) { state.started = true; startClock(); } }

  function resetState(cat, pool) {
    clearInterval(state.timer);
    Object.assign(state, {
      cat, pool, total: 0, sel: null, found: new Set(), errors: 0, tries: 0, hinted: new Set(),
      acc: 0, runStart: 0, started: false, paused: false, ended: false, markers: {}, aided: false
    });
    state.timer = setInterval(() => { $('sTime').textContent = fmt(elapsed()); }, 500);
    $('catTitle').textContent = cat.title;
    hideAllDialogs(); $('menu').hidden = true; setPaused(false, true);
    drawMap(cat, new Set(pool || []));
    if (location.hash !== '#' + cat.id) history.replaceState(null, '', '#' + cat.id);
  }

  function startGame(cat) {
    store.del('save:' + cat.id);
    const pool = poolFor(cat);
    resetState(cat, pool);
    state.items = sortItems(itemsFromPool(cat, pool));
    state.total = state.items.length;
    state.sel = state.items[0] ? state.items[0].key : null;
    renderList(); renderStats();
  }

  function resumeGame(cat, save) {
    resetState(cat, save.pool);
    state.total = save.total; state.errors = save.errors; state.tries = save.tries || 0;
    state.hinted = new Set(save.hinted || []); state.acc = save.ms || 0; state.started = !!save.started; state.aided = !!save.aided;
    state.items = save.items.map(k => ({ key: k, name: nameOfKey(k) }));
    state.sel = save.sel && save.items.includes(save.sel) ? save.sel : (save.items[0] || null);
    save.found.forEach(k => { state.found.add(k); paint(k); });
    renderList(); renderStats(); applyHint();
    if (state.started) setPaused(true); // vuelve en pausa: el jugador decide cuándo seguir
  }

  function saveGame() {
    if (!state.cat || state.ended || !state.started) return;
    store.set('save:' + state.cat.id, {
      pool: state.pool, total: state.total, items: state.items.map(i => i.key), sel: state.sel, found: [...state.found],
      errors: state.errors, tries: state.tries, hinted: [...state.hinted], ms: elapsed(), started: state.started, aided: state.aided, at: Date.now()
    });
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
    if (state.sel === key || state.paused) return;
    state.sel = key; state.tries = 0; clearHints(); renderList();
  }
  function renderStats() {
    $('sFound').textContent = state.found.size + '/' + state.total;
    $('sErr').textContent = state.errors;
    $('pBar').style.width = (state.total ? 100 * state.found.size / state.total : 0) + '%';
    $('sTime').textContent = fmt(elapsed());
  }

  let toastT;
  function toast(msg, kind) {
    const t = $('toast'); t.textContent = msg; t.className = 'toast show ' + (kind || '');
    clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast'), 1400);
  }

  function onMapClick(ev) {
    if (state.ended || state.paused || !state.sel) return;
    const el = ev.target;
    if (!el || !('__key' in el)) return;
    const key = el.__key;
    if (!key) {
      if (el.__piece && state.cat.kind === 'countries') toast(opts.showClicked ? G.countryName(el.__piece.raw, el.__piece.en) + ' no entra en esta carta' : 'Eso no entra en esta carta');
      return;
    }
    if (state.found.has(key)) { toast('Ya colocado: ' + nameOfKey(key)); return; }
    ensureStarted();
    if (key === state.sel) {
      state.found.add(key); paint(key); toast(nameOfKey(key), 'ok');
      const idx = state.items.findIndex(i => i.key === key);
      const li = $('list').querySelector('li[data-key="' + CSS.escape(key) + '"]');
      state.items.splice(idx, 1);
      state.sel = state.items.length ? state.items[Math.min(idx, state.items.length - 1)].key : null;
      state.tries = 0; clearHints();
      $('target').textContent = state.sel ? nameOfKey(state.sel) : '—';
      if (li) { li.classList.add('gone'); setTimeout(renderList, 300); } else renderList();
      renderStats();
      if (!state.items.length) finish();
    } else {
      state.errors++; state.tries++;
      flash(elementsFor(key));
      if (opts.showClicked) { state.aided = true; toast('No. Eso es ' + nameOfKey(key), 'bad'); }
      else toast('Incorrecto', 'bad');
      if (opts.hints && state.tries >= opts.hintAfter) { state.aided = true; applyHint(); renderList(); }
      renderStats();
    }
  }

  function skip() {
    if (state.paused || state.items.length < 2) return;
    const idx = state.items.findIndex(i => i.key === state.sel);
    const [it] = state.items.splice(idx, 1); state.items.push(it);
    state.sel = state.items[idx] ? state.items[idx].key : state.items[0].key;
    state.tries = 0; clearHints(); renderList();
  }

  // ---------- Pausa ----------
  function setPaused(on, silent) {
    state.paused = on;
    document.body.classList.toggle('is-paused', on);
    $('pause').hidden = !on;
    $('pauseBtn').textContent = on ? 'Continuar' : 'Pausa';
    $('tip').hidden = true;
    if (on) { stopClock(); $('pTime').textContent = fmt(elapsed()); $('pProg').textContent = state.found.size + ' de ' + state.total + ' · ' + state.errors + ' errores'; if (!silent) saveGame(); }
    else startClock();
  }
  function togglePause() { if (state.cat && !state.ended) setPaused(!state.paused); }

  function leaveToMenu() { // guarda la partida si está empezada y vuelve al menú
    if (state.cat && !state.ended) { stopClock(); saveGame(); }
    state.ended = true; clearInterval(state.timer);
    setPaused(false, true); document.body.classList.remove('is-paused');
    showMenu();
  }

  // ---------- Fin y récords ----------
  function recordsOf(id) { return store.get('records:' + id, []); }
  function rankSort(a, b) { return (a.errors - b.errors) || (a.ms - b.ms); }
  let pendingResult = null;

  function finish() {
    stopClock(); state.ended = true; clearInterval(state.timer); renderStats();
    store.del('save:' + state.cat.id);
    const ms = elapsed();
    pendingResult = { cat: state.cat, ms, errors: state.errors, aided: state.aided, opts: { limited: opts.limited, territories: opts.territories }, total: state.total, date: Date.now() };
    $('mTime').textContent = fmt(ms); $('mErr').textContent = state.errors;
    $('mAcc').textContent = Math.round(100 * state.total / (state.total + state.errors)) + '%';
    $('mName').value = store.get('player', '');
    $('mSaveRow').hidden = false; $('mSaved').hidden = true;
    const recs = recordsOf(state.cat.id).slice().sort(rankSort);
    const pos = recs.filter(r => rankSort(r, pendingResult) < 0).length + 1;
    $('mRecord').textContent = !recs.length ? 'Primera carta completada. Ya tienes marca que batir.'
      : pos === 1 ? 'Nuevo récord en esta carta.'
      : pos <= MAX_RECORDS ? 'Entras en el puesto ' + pos + ' de la tabla.'
      : 'Te quedas fuera de los ' + MAX_RECORDS + ' mejores.';
    renderRankTable($('mTable'), recs.slice(0, 5), null);
    setTimeout(() => { $('modal').hidden = false; $('mName').focus(); }, 700);
  }
  function saveResult() {
    if (!pendingResult) return;
    const name = ($('mName').value || '').trim().slice(0, 24) || 'Anónimo';
    store.set('player', name);
    const r = Object.assign({ name }, pendingResult); delete r.cat;
    const recs = recordsOf(pendingResult.cat.id); recs.push(r); recs.sort(rankSort);
    const kept = recs.slice(0, MAX_RECORDS);
    store.set('records:' + pendingResult.cat.id, kept);
    renderRankTable($('mTable'), kept.slice(0, 5), kept.indexOf(r) >= 0 ? r : null);
    $('mSaveRow').hidden = true; $('mSaved').hidden = false;
    $('mSaved').textContent = kept.indexOf(r) >= 0 ? 'Guardado como ' + name + '.' : 'Guardado, pero no entra en los ' + MAX_RECORDS + ' mejores.';
    pendingResult = null;
  }
  function renderRankTable(tbl, recs, highlight) {
    tbl.innerHTML = '';
    if (!recs.length) { tbl.innerHTML = '<tr><td class="empty" colspan="5">Aún no hay marcas.</td></tr>'; return; }
    recs.forEach((r, i) => {
      const tr = document.createElement('tr'); if (r === highlight) tr.className = 'me';
      const d = new Date(r.date);
      tr.innerHTML = '<td class="n">' + (i + 1) + '</td><td class="who"></td><td class="num">' + fmt(r.ms) + '</td><td class="num">' + r.errors + ' err.</td><td class="d">' +
        d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + '</td>';
      tr.querySelector('.who').textContent = r.name + (r.aided ? ' ·' : '');
      if (r.aided) tr.querySelector('.who').title = 'Con ayudas activadas';
      tbl.appendChild(tr);
    });
  }

  // ---------- Menú, opciones y diálogos ----------
  function hideAllDialogs() { ['modal', 'resumeDlg', 'optionsDlg', 'recordsDlg'].forEach(id => ($(id).hidden = true)); }

  function renderMenu() {
    const box = $('cards'); box.innerHTML = '';
    G.CATEGORIES.forEach(cat => {
      const n = cat.kind === 'continents' ? 11 : poolFor(cat).length;
      const best = recordsOf(cat.id).slice().sort(rankSort)[0];
      const saved = store.get('save:' + cat.id, null);
      const b = document.createElement('button'); b.className = 'card';
      b.innerHTML = '<h3></h3><p></p><div class="meta"><span>' + n + ' elementos</span><span class="best"></span></div>';
      b.querySelector('h3').textContent = cat.title; b.querySelector('p').textContent = cat.blurb;
      const bs = b.querySelector('.best');
      if (best) { bs.innerHTML = 'Récord <b></b>'; bs.querySelector('b').textContent = fmt(best.ms) + ' · ' + best.errors + ' err.'; bs.title = best.name; }
      else bs.textContent = 'Sin jugar';
      if (saved) { const s = document.createElement('span'); s.className = 'saved'; s.textContent = 'Partida a medias'; b.appendChild(s); }
      b.addEventListener('click', () => openCategory(cat));
      box.appendChild(b);
    });
    const soon = $('soon'); soon.innerHTML = '';
    G.UPCOMING.forEach(t => {
      const d = document.createElement('div'); d.className = 'card soon';
      d.innerHTML = '<h3></h3><p>En preparación</p>'; d.querySelector('h3').textContent = t; soon.appendChild(d);
    });
  }
  function showMenu() {
    hideAllDialogs(); renderMenu(); $('menu').hidden = false;
    history.replaceState(null, '', location.pathname + location.search);
  }

  let resumeCat = null;
  function openCategory(cat) {
    const save = store.get('save:' + cat.id, null);
    if (!save) return startGame(cat);
    resumeCat = cat;
    $('rInfo').textContent = cat.title + ': ' + save.found.length + ' de ' + save.total + ' colocados, ' + fmt(save.ms) + ', ' + save.errors + ' errores.';
    $('resumeDlg').hidden = false; $('rYes').focus();
  }

  function renderOptions() {
    $('oShow').checked = opts.showClicked;
    $('oHints').checked = opts.hints;
    $('oHintN').value = opts.hintAfter; $('oHintN').disabled = !opts.hints;
    $('oLimited').checked = opts.limited;
    $('oTerr').checked = opts.territories;
    const fmtList = set => [...set].filter(i => allIsos.includes(i)).map(i => G.countryName(i) + (G.TERR_OWNER[i] ? ' (' + G.TERR_OWNER[i] + ')' : ''))
      .sort((a, b) => a.localeCompare(b, 'es')).join(', ');
    $('oLimitedList').textContent = fmtList(G.LIMITED) + '.';
    $('oTerrList').textContent = fmtList(G.DEPENDENT) + '.';
    $('oTerrN').textContent = [...G.DEPENDENT].filter(i => allIsos.includes(i)).length;
    $('oWipe').textContent = 'Borrar récords y partidas'; $('oWipe').dataset.armed = '';
  }
  function readOptions() {
    opts.showClicked = $('oShow').checked;
    opts.hints = $('oHints').checked;
    opts.hintAfter = Math.max(1, Math.min(20, parseInt($('oHintN').value, 10) || 3));
    $('oHintN').disabled = !opts.hints;
    opts.limited = $('oLimited').checked;
    opts.territories = $('oTerr').checked;
    saveOpts();
    if (!$('menu').hidden) renderMenu();
  }
  function wipeData() {
    const b = $('oWipe');
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Pulsa otra vez para borrar todo'; return; }
    try { Object.keys(localStorage).filter(k => k.startsWith('cartarius:records:') || k.startsWith('cartarius:save:')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    b.textContent = 'Borrado'; b.dataset.armed = '';
    if (!$('menu').hidden) renderMenu();
  }

  let recTab = G.CATEGORIES[0].id;
  function renderRecords() {
    const tabs = $('recTabs'); tabs.innerHTML = '';
    G.CATEGORIES.forEach(c => {
      const b = document.createElement('button'); b.textContent = c.title; b.setAttribute('aria-pressed', c.id === recTab);
      b.onclick = () => { recTab = c.id; renderRecords(); };
      tabs.appendChild(b);
    });
    renderRankTable($('recTable'), recordsOf(recTab).slice().sort(rankSort), null);
  }

  // Tooltip con el nombre de lo ya pintado (y de lo que está fuera de la carta si se muestra lo pulsado)
  const tip = $('tip');
  function onMove(ev) {
    const el = ev.target; let name = null;
    if (state.paused) { tip.hidden = true; return; }
    if (el && el.classList && el.classList.contains('painted') && el.__key) name = nameOfKey(el.__key);
    else if (opts.showClicked && el && el.__piece && !el.__key && state.cat && state.cat.kind === 'countries') name = G.countryName(el.__piece.raw, el.__piece.en);
    if (!name) { tip.hidden = true; return; }
    tip.textContent = name; tip.hidden = false;
    tip.style.left = (ev.clientX + 14) + 'px'; tip.style.top = (ev.clientY + 12) + 'px';
  }

  // ---------- Arranque ----------
  function wire() {
    svg.on('click', onMapClick).on('mousemove', onMove).on('mouseleave', () => (tip.hidden = true));
    $('home').onclick = leaveToMenu; $('toMenu').onclick = leaveToMenu;
    $('mMenu').onclick = () => { if (pendingResult && $('mName').value.trim()) saveResult(); showMenu(); };
    $('restart').onclick = () => state.cat && startGame(state.cat);
    $('mAgain').onclick = () => { if (pendingResult && $('mName').value.trim()) saveResult(); startGame(state.cat); };
    $('mSave').onclick = saveResult;
    $('mName').addEventListener('keydown', ev => { if (ev.key === 'Enter') saveResult(); });
    $('pauseBtn').onclick = togglePause;
    $('pResume').onclick = () => setPaused(false);
    $('pExit').onclick = leaveToMenu;
    $('rYes').onclick = () => { const s = store.get('save:' + resumeCat.id, null); s ? resumeGame(resumeCat, s) : startGame(resumeCat); };
    $('rNo').onclick = () => startGame(resumeCat);
    $('rCancel').onclick = () => { $('resumeDlg').hidden = true; };
    $('optBtn').onclick = () => { renderOptions(); $('optionsDlg').hidden = false; };
    $('optClose').onclick = () => { $('optionsDlg').hidden = true; };
    ['oShow', 'oHints', 'oHintN', 'oLimited', 'oTerr'].forEach(id => $(id).addEventListener('change', readOptions));
    $('oWipe').onclick = wipeData;
    $('recBtn').onclick = () => { renderRecords(); $('recordsDlg').hidden = false; };
    $('recClose').onclick = () => { $('recordsDlg').hidden = true; };
    $('skip').onclick = skip;
    $('zIn').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1.6);
    $('zOut').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6);
    $('zFit').onclick = () => state.cat && fitView(state.cat, true);
    const setOrder = o => {
      opts.order = o; saveOpts();
      $('oRand').setAttribute('aria-pressed', o === 'rand'); $('oAlpha').setAttribute('aria-pressed', o === 'alpha');
      if (state.cat && !state.ended && !state.paused) { sortItems(state.items); state.sel = state.items[0] && state.items[0].key; state.tries = 0; clearHints(); renderList(); }
    };
    $('oRand').onclick = () => setOrder('rand'); $('oAlpha').onclick = () => setOrder('alpha');
    setOrder(opts.order);
    document.addEventListener('keydown', ev => {
      if (ev.target && ev.target.tagName === 'INPUT') return;
      if (ev.key === 'Escape') {
        const open = ['optionsDlg', 'recordsDlg', 'resumeDlg'].find(id => !$(id).hidden);
        if (open) { $(open).hidden = true; return; }
      }
      if (!$('menu').hidden || state.ended || !state.cat) return;
      if (ev.key === 'p' || ev.key === 'P' || ev.key === 'Escape') { ev.preventDefault(); togglePause(); return; }
      if (state.paused || !state.items.length) return;
      const idx = state.items.findIndex(i => i.key === state.sel);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); select(state.items[(idx + 1) % state.items.length].key); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); select(state.items[(idx - 1 + state.items.length) % state.items.length].key); }
      else if (ev.key === 's' || ev.key === 'S') skip();
    });
    // si se cierra o se oculta la pestaña, la partida queda guardada
    const persist = () => { if (state.cat && !state.ended && state.started) { const r = state.runStart; stopClock(); saveGame(); if (r && !state.paused) startClock(); } };
    document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
    window.addEventListener('pagehide', persist);
    window.addEventListener('hashchange', route);
  }
  function route() {
    const id = location.hash.slice(1);
    const cat = G.CATEGORIES.find(c => c.id === id);
    if (cat) { if (!state.cat || state.cat.id !== id || state.ended) { showMenu(); openCategory(cat); } }
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
