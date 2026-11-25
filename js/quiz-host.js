/* Cartarius · Quiz, pantalla del anfitrión: ajustes, sala con QR, preguntas, puntuación, pausa, resultados e historial.
   El anfitrión manda: genera las preguntas, controla el tiempo y calcula los puntos. Los móviles solo ven "pub".
   La sala se guarda en el navegador (código + clave) y se vuelve a abrir al recargar o al volver a esta página. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const G = window.CartariusGeo, I18N = window.CartariusI18n, t = I18N.t, Net = window.CartariusNet, Q = window.CartariusQuestions;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('cartarius:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cartarius:' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('cartarius:' + k); } catch (e) {} }
  };
  const ROOM_KEY = 'quizRoom:' + Net.name; // la sala local y la de Firebase no se mezclan
  const gameOpts = Object.assign({ limited: true, territories: false, placeLang: 'auto' }, store.get('options', {}));
  I18N.placePref = gameOpts.placeLang;
  const settings = Object.assign({ types: ['flag', 'capital'], regions: Q.CONTS.slice(), count: 10, time: 5, gap: 8, nOptions: 4 }, store.get('quiz', {}));
  // ajustes de versiones anteriores
  if (settings.region) { settings.regions = settings.region === 'all' ? Q.CONTS.slice() : [settings.region]; delete settings.region; }
  settings.types = settings.types.filter(k => Q.TYPES.includes(k));
  if (!settings.types.length) settings.types = ['flag', 'capital'];

  const S = { code: null, players: {}, questions: [], i: -1, scores: {}, answers: {}, timer: null, unsubAns: null, startedAt: 0,
    phase: 'setup', deadline: 0, advance: null, paused: null, lastPub: null, history: {} };

  // ---------- Ajustes ----------
  function renderSettings() {
    $('sTypes').querySelectorAll('input').forEach(c => { c.checked = settings.types.includes(c.value); });
    const reg = $('sRegions'); reg.innerHTML = '';
    Q.CONTS.forEach(c => {
      const l = document.createElement('label');
      l.innerHTML = '<input type="checkbox"> <span></span>';
      const cb = l.querySelector('input'); cb.value = c; cb.checked = settings.regions.includes(c);
      l.querySelector('span').textContent = t('cont.' + c);
      reg.appendChild(l);
    });
    [['sCount', 'count'], ['sTime', 'time'], ['sGap', 'gap'], ['sOpts', 'nOptions']].forEach(([id, key]) => {
      const box = $(id); box.innerHTML = '';
      box.dataset.values.split(',').map(Number).forEach(v => {
        const b = document.createElement('button'); b.type = 'button';
        b.textContent = (id === 'sTime' || id === 'sGap') ? (v ? t('quiz.seconds', { n: v }) : t('quiz.manual')) : v;
        b.setAttribute('aria-pressed', settings[key] === v);
        b.onclick = () => { settings[key] = v; saveSettings(); renderSettings(); };
        box.appendChild(b);
      });
    });
  }
  function readSettings() {
    settings.types = [...$('sTypes').querySelectorAll('input:checked')].map(c => c.value);
    settings.regions = [...$('sRegions').querySelectorAll('input:checked')].map(c => c.value);
    saveSettings();
  }
  function saveSettings() { store.set('quiz', settings); checkStart(); }
  function checkStart() {
    const msg = !settings.types.length ? t('quiz.needType') : !settings.regions.length ? t('quiz.needRegion') : '';
    $('sErr').hidden = !msg; $('sErr').textContent = msg;
    $('startBtn').disabled = !!msg || !Object.keys(S.players).length;
  }

  // ---------- Sala ----------
  function roomMsg(msg) { $('roomMsg').textContent = msg || ''; $('roomMsg').hidden = !msg; }
  async function createRoom() {
    $('createBtn').disabled = true; $('createErr').hidden = true;
    let r;
    try { r = await Net.host.create(); } catch (e) {
      $('createErr').textContent = t('quiz.err.room', { msg: e.message }); $('createErr').hidden = false; $('createBtn').disabled = false; return;
    }
    store.set(ROOM_KEY, r);
    openRoom(r.code);
  }
  async function resumeRoom(saved) {
    $('createBtn').hidden = true; roomMsg(t('quiz.resuming'));
    let ok = false;
    try { ok = await Net.host.resume(saved.code, saved.key); } catch (e) { ok = false; }
    $('createBtn').hidden = false;
    if (!ok) { store.del(ROOM_KEY); roomMsg(t('quiz.lost', { code: saved.code })); return; }
    roomMsg('');
    openRoom(saved.code);
  }
  function openRoom(code) {
    S.code = code;
    const url = new URL('play.html?sala=' + code, location.href).href;
    $('roomCode').textContent = code;
    $('joinUrl').textContent = url.replace(/^https?:\/\//, '').replace(/\?sala=.*/, '');
    $('barCodeVal').textContent = code; $('barCode').hidden = false;
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 1, scalable: true });
    $('qr').setAttribute('aria-label', url);
    if (Net.name === 'local') { $('localNote').textContent = t('quiz.localMode', { url: 'play.html?sala=' + code }); $('localNote').hidden = false; }
    $('roomEmpty').hidden = true; $('roomOpen').hidden = false;
    Net.host.onPlayers(p => { S.players = p; renderPlayers(); });
    Net.host.onHistory(h => { S.history = h; renderHistory(); });
    Net.host.setPublic({ phase: 'lobby' });
  }
  async function newRoom() {
    if (!confirm(t('quiz.newRoomConfirm', { code: S.code }))) return;
    try { await Net.host.close(); } catch (e) {}
    store.del(ROOM_KEY);
    S.code = null; S.players = {}; S.history = {};
    $('roomOpen').hidden = true; $('roomEmpty').hidden = false; $('barCode').hidden = true;
    $('createBtn').disabled = false;
    createRoom();
  }
  function renderPlayers() {
    const ul = $('players'); ul.innerHTML = '';
    const list = Object.entries(S.players);
    $('pCount').textContent = list.filter(([, p]) => p.on !== false).length;
    if (!list.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = t('quiz.noPlayers'); ul.appendChild(li); }
    list.sort((a, b) => (b[1].on !== false) - (a[1].on !== false)).forEach(([, p]) => { const li = document.createElement('li'); li.textContent = p.name; if (p.on === false) li.className = 'off'; ul.appendChild(li); });
    checkStart();
    if (S.phase === 'question') renderAnswered();
  }
  const fmtDate = ts => new Intl.DateTimeFormat(I18N.lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
  const sec = ms => (ms / 1000).toFixed(1) + ' s';
  function renderHistory() {
    const ul = $('history'); ul.innerHTML = '';
    const list = Object.values(S.history || {}).filter(h => h && h.at).sort((a, b) => b.at - a.at);
    if (!list.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = t('quiz.noHistory'); ul.appendChild(li); return; }
    list.slice(0, 30).forEach(h => {
      const li = document.createElement('li'), det = document.createElement('details'), sum = document.createElement('summary');
      const r = h.ranking || [], win = r[0];
      sum.innerHTML = '<time></time><b></b><small></small>';
      sum.querySelector('time').textContent = fmtDate(h.at);
      sum.querySelector('b').textContent = win ? '🏆 ' + win.name + ' · ' + win.pts + ' ' + t('quiz.pts') : '—';
      sum.querySelector('small').textContent = t('quiz.histLine', { n: h.n, p: r.length }) + (h.types ? ' · ' + h.types.map(k => t('qt.' + k)).join(', ') : '');
      det.appendChild(sum);
      det.appendChild(rankTable(r.map(x => Object.assign({}, x, { avg: x.avg == null ? null : x.avg }))));
      li.appendChild(det); ul.appendChild(li);
    });
  }
  function rankTable(r) {
    const tb = document.createElement('table'); tb.className = 'rank q-rank';
    const head = document.createElement('tr');
    head.innerHTML = '<th></th><th></th><th class="num"></th><th class="num"></th><th class="num"></th>';
    ['', t('quiz.col.player'), t('quiz.col.points'), t('quiz.col.hits'), t('quiz.col.avg')].forEach((x, k) => { head.children[k].textContent = x; });
    tb.appendChild(head);
    r.forEach((x, k) => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="n"></td><td class="who"></td><td class="num"></td><td class="num"></td><td class="num"></td>';
      const c = tr.children; c[0].textContent = k + 1; c[1].textContent = x.name; c[2].textContent = x.pts; c[3].textContent = x.hits; c[4].textContent = x.avg != null ? sec(x.avg) : '—';
      tb.appendChild(tr);
    });
    return tb;
  }

  // ---------- Partida ----------
  function show(id) { ['setup', 'play', 'final'].forEach(x => ($(x).hidden = x !== id)); }
  async function startGame() {
    readSettings();
    S.questions = Q.generate({ types: settings.types, regions: settings.regions, count: settings.count, nOptions: settings.nOptions, opts: gameOpts, features: window.CARTARIUS_FEATURES });
    if (!S.questions.length) { $('sErr').textContent = t('quiz.fewItems'); $('sErr').hidden = false; return; }
    S.scores = {}; S.paused = null;
    await Net.host.clearAnswers();
    Net.host.touch();
    show('play');
    ask(0);
  }
  const online = () => Object.entries(S.players).filter(([, p]) => p.on !== false).map(([u]) => u);
  const nameOf = uid => (S.players[uid] && S.players[uid].name) || '?';
  const scoreOf = uid => S.scores[uid] || (S.scores[uid] = { pts: 0, hits: 0, times: [] });
  function publish(pub) { S.lastPub = pub; return Net.host.setPublic(pub); }

  function ask(i) {
    clearTimeout(S.advance); clearTimeout(S.timer);
    S.i = i; S.answers = {}; S.phase = 'question';
    const q = S.questions[i], dur = settings.time * 1000;
    S.startedAt = Net.now() + 400; // margen para que llegue a los móviles
    S.deadline = S.startedAt + dur;
    $('play').classList.remove('revealed'); $('qReveal').hidden = true;
    $('qProg').textContent = t('quiz.qOf', { i: i + 1, n: S.questions.length });
    $('qText').textContent = q.text;
    const pr = $('qPrompt'); pr.innerHTML = '';
    if (q.flag) { const img = document.createElement('img'); img.src = q.flag; img.alt = ''; pr.appendChild(img); }
    if (q.shape) pr.innerHTML = '<svg viewBox="0 0 400 300" aria-hidden="true"><path d="' + q.shape + '"/></svg>';
    $('play').classList.toggle('no-prompt', !q.flag && !q.shape);
    const ol = $('qOptions'); ol.innerHTML = '';
    q.options.forEach((o, k) => {
      const li = document.createElement('li');
      li.innerHTML = '<b></b><span></span><span class="n"></span>';
      li.querySelector('b').textContent = 'ABCD'[k]; li.querySelector('span').textContent = o.label;
      ol.appendChild(li);
    });
    publish({ phase: 'question', i, n: S.questions.length, type: q.type, text: q.text, options: q.options.map(o => o.label), startedAt: S.startedAt, dur });
    renderAnswered();
    // barra de tiempo
    const bar = $('qTimer');
    bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)'; void bar.offsetWidth;
    const left = S.deadline - Net.now();
    bar.style.transition = 'transform ' + Math.max(0, left) + 'ms linear'; bar.style.transform = 'scaleX(0)';
    if (S.unsubAns) S.unsubAns();
    S.unsubAns = Net.host.onAnswers(i, a => {
      S.answers = a; renderAnswered();
      const on = online();
      if (S.phase === 'question' && on.length && on.every(u => a[u])) endQuestion();
    });
    S.timer = setTimeout(endQuestion, Math.max(0, left) + 250);
  }
  function renderAnswered() {
    const n = online().length, a = Object.keys(S.answers || {}).length;
    $('qAnswered').textContent = t('quiz.answered', { a, n });
  }

  function endQuestion() {
    if (S.phase !== 'question') return;
    S.phase = 'reveal';
    clearTimeout(S.timer); if (S.unsubAns) { S.unsubAns(); S.unsubAns = null; }
    const q = S.questions[S.i], dur = settings.time * 1000;
    const results = {}, counts = q.options.map(() => 0), hits = [];
    Object.keys(S.players).forEach(uid => scoreOf(uid));
    Object.entries(S.answers || {}).forEach(([uid, a]) => {
      const ms = Math.max(0, Math.min(dur, (a.t || 0) - S.startedAt));
      if ((a.t || 0) - S.startedAt > dur + 1500) return; // fuera de tiempo
      if (a.c >= 0 && a.c < counts.length) counts[a.c]++;
      const ok = a.c === q.correct, sc = scoreOf(uid);
      const pts = ok ? Math.round(1000 * (1 - 0.5 * ms / dur)) : 0;
      sc.pts += pts; if (ok) { sc.hits++; sc.times.push(ms); hits.push([uid, ms]); }
      results[uid] = { ok, pts, c: a.c };
    });
    const ranking = rank();
    ranking.forEach((r, k) => { results[r.uid] = Object.assign(results[r.uid] || { ok: false, pts: 0, c: -1 }, { total: r.pts, pos: k + 1 }); });
    S.revealPub = { phase: 'reveal', i: S.i, n: S.questions.length, text: q.text, options: q.options.map(o => o.label), correct: q.correct, results, players: ranking.length };
    // pantalla
    $('play').classList.add('revealed');
    [...$('qOptions').children].forEach((li, k) => { li.classList.toggle('ok', k === q.correct); li.querySelector('.n').textContent = counts[k]; });
    const hb = $('qHits'); hb.innerHTML = '';
    if (!hits.length) { const p = document.createElement('p'); p.textContent = t('quiz.nobody'); hb.appendChild(p); }
    hits.sort((a, b) => a[1] - b[1]).forEach(([uid, ms]) => {
      const s = document.createElement('span'); s.textContent = nameOf(uid);
      const sm = document.createElement('small'); sm.textContent = sec(ms); s.appendChild(sm); hb.appendChild(s);
    });
    const top = $('qTop'); top.innerHTML = '';
    ranking.slice(0, 5).forEach(r => { const li = document.createElement('li'); li.textContent = r.name; const sp = document.createElement('span'); sp.textContent = r.pts + ' ' + t('quiz.pts'); li.appendChild(sp); top.appendChild(li); });
    $('nextBtn').textContent = isLast() ? t('quiz.results') : t('quiz.next');
    $('qReveal').hidden = false;
    scheduleNext(settings.gap * 1000);
  }
  const isLast = () => S.i >= S.questions.length - 1;
  // Cuenta atrás hasta la siguiente pregunta (gap 0 = manual)
  function scheduleNext(ms) {
    clearTimeout(S.advance);
    S.deadline = ms ? Net.now() + ms : 0;
    if (ms) S.advance = setTimeout(next, ms);
    publish(Object.assign({}, S.revealPub, { nextAt: S.deadline || null, last: isLast() }));
  }
  function next() {
    if (S.paused) return;
    clearTimeout(S.advance);
    if (!isLast()) ask(S.i + 1); else finish();
  }

  // ---------- Pausa ----------
  function pause() {
    if (S.paused || (S.phase !== 'question' && S.phase !== 'reveal')) return;
    S.paused = { phase: S.phase, left: S.phase === 'reveal' && S.deadline ? Math.max(1000, S.deadline - Net.now()) : 0 };
    clearTimeout(S.timer); clearTimeout(S.advance);
    if (S.unsubAns) { S.unsubAns(); S.unsubAns = null; }
    const bar = $('qTimer'); bar.style.transition = 'none';
    S.phase = 'paused';
    $('paused').hidden = false; $('resumeBtn').focus();
    Net.host.setPublic({ phase: 'paused', i: S.i, n: S.questions.length });
  }
  async function resume() {
    const p = S.paused; if (!p) return;
    S.paused = null; $('paused').hidden = true;
    if (p.phase === 'question') { await Net.host.clearAnswers(S.i); ask(S.i); } // se repite la pregunta
    else { S.phase = 'reveal'; scheduleNext(settings.gap ? p.left : 0); }
  }
  async function stopGame() {
    S.paused = null; S.phase = 'setup'; S.i = -1;
    $('paused').hidden = true;
    clearTimeout(S.timer); clearTimeout(S.advance);
    show('setup');
    await Net.host.setPublic({ phase: 'lobby' });
    renderPlayers();
  }

  // ---------- Final ----------
  function rank() {
    return Object.keys(S.players).filter(uid => S.scores[uid]).map(uid => {
      const s = scoreOf(uid), avg = s.times.length ? s.times.reduce((a, b) => a + b, 0) / s.times.length : null;
      return { uid, name: nameOf(uid), pts: s.pts, hits: s.hits, avg };
    }).sort((a, b) => b.pts - a.pts || b.hits - a.hits);
  }
  function finish() {
    S.phase = 'end'; clearTimeout(S.timer); clearTimeout(S.advance);
    const r = rank();
    const timed = r.filter(x => x.avg != null);
    const most = r.slice().sort((a, b) => b.hits - a.hits)[0];
    const fast = timed.slice().sort((a, b) => a.avg - b.avg)[0];
    const slow = timed.slice().sort((a, b) => b.avg - a.avg)[0];
    publish({ phase: 'end', n: S.questions.length, ranking: r.map(x => ({ uid: x.uid, name: x.name, pts: x.pts, hits: x.hits })) });
    Net.host.addHistory({ n: S.questions.length, types: settings.types, regions: settings.regions,
      ranking: r.map(x => ({ name: x.name, pts: x.pts, hits: x.hits, avg: x.avg == null ? null : Math.round(x.avg) })) });
    Net.host.touch();
    show('final');
    const st = $('fStats'); st.innerHTML = '';
    [['quiz.stat.most', most, most && most.hits + ' / ' + S.questions.length], ['quiz.stat.fast', fast, fast && sec(fast.avg)], ['quiz.stat.slow', slow, slow && sec(slow.avg)]].forEach(([k, who, val]) => {
      const d = document.createElement('div');
      d.innerHTML = '<small></small><b></b><span></span>';
      d.querySelector('small').textContent = t(k); d.querySelector('b').textContent = who ? who.name : t('quiz.stat.none'); d.querySelector('span').textContent = who ? val : '';
      st.appendChild(d);
    });
    const tb = $('fTable'); tb.replaceWith(Object.assign(rankTable(r), { id: 'fTable' }));
  }
  async function playAgain() { show('setup'); S.phase = 'setup'; S.i = -1; await Net.host.setPublic({ phase: 'lobby' }); renderPlayers(); }

  // ---------- Reloj ----------
  function tick() {
    const showClock = S.phase === 'question' || (S.phase === 'reveal' && S.deadline);
    const s = showClock ? Math.max(0, Math.ceil((S.deadline - Net.now()) / 1000)) : null;
    const clock = $('qClock');
    clock.textContent = S.phase === 'question' ? s : '';
    clock.classList.toggle('low', S.phase === 'question' && s <= 3);
    $('qNextIn').textContent = S.phase === 'reveal' && S.deadline ? t(isLast() ? 'quiz.resultsIn' : 'quiz.nextIn', { s }) : '';
  }

  // ---------- Arranque ----------
  function boot() {
    I18N.apply();
    G.init(window.CARTARIUS_COUNTRIES);
    Q.prepareShapes(window.CARTARIUS_WORLD);
    renderSettings(); checkStart();
    $('sTypes').addEventListener('change', readSettings);
    $('sRegions').addEventListener('change', readSettings);
    $('createBtn').onclick = createRoom;
    $('newRoomBtn').onclick = newRoom;
    $('startBtn').onclick = startGame;
    $('nextBtn').onclick = next;
    $('againBtn').onclick = playAgain;
    $('pauseBtn').onclick = pause;
    $('resumeBtn').onclick = resume;
    $('stopBtn').onclick = stopGame;
    document.addEventListener('keydown', ev => {
      if ($('play').hidden || ev.target.closest('input, select, textarea')) return;
      if ((ev.key === 'p' || ev.key === 'P' || ev.key === 'Escape') && !S.paused) { ev.preventDefault(); pause(); return; }
      if (S.paused) { if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'p' || ev.key === 'P') { ev.preventDefault(); resume(); } return; }
      if ((ev.key === 'Enter' || ev.key === ' ') && S.phase === 'reveal') { ev.preventDefault(); next(); }
    });
    setInterval(tick, 200);
    const saved = store.get(ROOM_KEY, null);
    if (saved && saved.code) resumeRoom(saved);
  }
  boot();
})();
