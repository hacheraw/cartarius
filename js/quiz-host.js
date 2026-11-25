/* Cartarius · Quiz, pantalla del anfitrión: ajustes, sala con QR, preguntas, puntuación y resultados.
   El anfitrión manda: genera las preguntas, controla el tiempo y calcula los puntos. Los móviles solo ven "pub". */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const G = window.CartariusGeo, I18N = window.CartariusI18n, t = I18N.t, Net = window.CartariusNet, Q = window.CartariusQuestions;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('cartarius:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cartarius:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const gameOpts = Object.assign({ limited: true, territories: false, placeLang: 'auto' }, store.get('options', {}));
  I18N.placePref = gameOpts.placeLang;
  const settings = Object.assign({ types: ['flag', 'capital'], region: 'all', count: 10, time: 5, nOptions: 4 }, store.get('quiz', {}));

  const S = { code: null, players: {}, questions: [], i: -1, scores: {}, timer: null, unsubAns: null, startedAt: 0, ended: false, advance: null };

  // ---------- Ajustes ----------
  function renderSettings() {
    $('sTypes').querySelectorAll('input').forEach(c => { c.checked = settings.types.includes(c.value); });
    const reg = $('sRegion'); reg.innerHTML = '';
    [['all', t('region.all')]].concat(Q.CONTS.map(c => [c, t('cont.' + c)])).forEach(([v, l]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = l; reg.appendChild(o);
    });
    reg.value = settings.region;
    [['sCount', 'count'], ['sTime', 'time'], ['sOpts', 'nOptions']].forEach(([id, key]) => {
      const box = $(id); box.innerHTML = '';
      box.dataset.values.split(',').map(Number).forEach(v => {
        const b = document.createElement('button'); b.type = 'button';
        b.textContent = id === 'sTime' ? t('quiz.seconds', { n: v }) : v;
        b.setAttribute('aria-pressed', settings[key] === v);
        b.onclick = () => { settings[key] = v; saveSettings(); renderSettings(); };
        box.appendChild(b);
      });
    });
  }
  function readSettings() {
    settings.types = [...$('sTypes').querySelectorAll('input:checked')].map(c => c.value);
    settings.region = $('sRegion').value;
    saveSettings();
  }
  function saveSettings() { store.set('quiz', settings); checkStart(); }
  function checkStart() {
    const ok = settings.types.length > 0;
    $('sErr').hidden = ok; $('sErr').textContent = ok ? '' : t('quiz.needType');
    $('startBtn').disabled = !ok || !Object.keys(S.players).length;
  }

  // ---------- Sala ----------
  async function createRoom() {
    $('createBtn').disabled = true; $('createErr').hidden = true;
    try {
      S.code = await Net.host.create();
    } catch (e) {
      $('createErr').textContent = t('quiz.err.room', { msg: e.message }); $('createErr').hidden = false; $('createBtn').disabled = false; return;
    }
    const url = new URL('play.html?sala=' + S.code, location.href).href;
    $('roomCode').textContent = S.code;
    $('joinUrl').textContent = url.replace(/^https?:\/\//, '').replace(/\?sala=.*/, '');
    $('barCodeVal').textContent = S.code; $('barCode').hidden = false;
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 1, scalable: true });
    $('qr').setAttribute('aria-label', url);
    if (Net.name === 'local') { $('localNote').textContent = t('quiz.localMode', { url: 'play.html?sala=' + S.code }); $('localNote').hidden = false; }
    $('roomEmpty').hidden = true; $('roomOpen').hidden = false;
    Net.host.onPlayers(p => { S.players = p; renderPlayers(); });
    Net.host.setPublic({ phase: 'lobby' });
    window.addEventListener('pagehide', () => Net.host.close());
  }
  function renderPlayers() {
    const ul = $('players'); ul.innerHTML = '';
    const list = Object.entries(S.players);
    $('pCount').textContent = list.length;
    if (!list.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = t('quiz.noPlayers'); ul.appendChild(li); }
    list.forEach(([, p]) => { const li = document.createElement('li'); li.textContent = p.name; if (p.on === false) li.className = 'off'; ul.appendChild(li); });
    checkStart();
    if (S.i >= 0 && !S.ended) renderAnswered();
  }

  // ---------- Partida ----------
  function show(id) { ['setup', 'play', 'final'].forEach(x => ($(x).hidden = x !== id)); }
  async function startGame() {
    readSettings();
    S.questions = Q.generate({ types: settings.types, region: settings.region, count: settings.count, nOptions: settings.nOptions, opts: gameOpts });
    if (!S.questions.length) { $('sErr').textContent = t('quiz.fewItems'); $('sErr').hidden = false; return; }
    S.scores = {}; S.ended = false;
    await Net.host.clearAnswers();
    show('play');
    ask(0);
  }
  const online = () => Object.entries(S.players).filter(([, p]) => p.on !== false).map(([u]) => u);
  const nameOf = uid => (S.players[uid] && S.players[uid].name) || '?';
  const scoreOf = uid => S.scores[uid] || (S.scores[uid] = { pts: 0, hits: 0, times: [] });

  function ask(i) {
    clearTimeout(S.advance);
    S.i = i; S.answers = {};
    const q = S.questions[i], dur = settings.time * 1000;
    S.startedAt = Net.now() + 400; // margen para que llegue a los móviles
    $('play').classList.remove('revealed'); $('qReveal').hidden = true;
    $('qProg').textContent = t('quiz.qOf', { i: i + 1, n: S.questions.length });
    $('qText').textContent = q.text;
    const pr = $('qPrompt'); pr.innerHTML = '';
    if (q.flag) { const img = document.createElement('img'); img.src = q.flag; img.alt = ''; pr.appendChild(img); }
    if (q.shape) pr.innerHTML = '<svg viewBox="0 0 400 300" aria-hidden="true"><path d="' + q.shape + '"/></svg>';
    const ol = $('qOptions'); ol.innerHTML = '';
    q.options.forEach((o, k) => {
      const li = document.createElement('li');
      li.innerHTML = '<b></b><span></span><span class="n"></span>';
      li.querySelector('b').textContent = 'ABCD'[k]; li.querySelector('span').textContent = o.label;
      ol.appendChild(li);
    });
    Net.host.setPublic({ phase: 'question', i, n: S.questions.length, type: q.type, text: q.text, options: q.options.map(o => o.label), startedAt: S.startedAt, dur });
    renderAnswered();
    // barra de tiempo
    const bar = $('qTimer');
    bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)'; void bar.offsetWidth;
    const left = S.startedAt + dur - Net.now();
    bar.style.transition = 'transform ' + Math.max(0, left) + 'ms linear'; bar.style.transform = 'scaleX(0)';
    if (S.unsubAns) S.unsubAns();
    S.unsubAns = Net.host.onAnswers(i, a => {
      S.answers = a; renderAnswered();
      const on = online();
      if (on.length && on.every(u => a[u])) endQuestion();
    });
    clearTimeout(S.timer);
    S.timer = setTimeout(endQuestion, Math.max(0, left) + 250);
  }
  function renderAnswered() {
    const n = online().length, a = Object.keys(S.answers || {}).length;
    $('qAnswered').textContent = t('quiz.answered', { a, n });
  }

  function endQuestion() {
    if ($('play').classList.contains('revealed')) return;
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
    Net.host.setPublic({ phase: 'reveal', i: S.i, n: S.questions.length, text: q.text, options: q.options.map(o => o.label), correct: q.correct, results, players: ranking.length });
    // pantalla
    $('play').classList.add('revealed');
    [...$('qOptions').children].forEach((li, k) => { li.classList.toggle('ok', k === q.correct); li.querySelector('.n').textContent = counts[k]; });
    const hb = $('qHits'); hb.innerHTML = '';
    if (!hits.length) { const p = document.createElement('p'); p.textContent = t('quiz.nobody'); hb.appendChild(p); }
    hits.sort((a, b) => a[1] - b[1]).forEach(([uid, ms]) => {
      const s = document.createElement('span'); s.textContent = nameOf(uid);
      const sm = document.createElement('small'); sm.textContent = (ms / 1000).toFixed(1) + ' s'; s.appendChild(sm); hb.appendChild(s);
    });
    const top = $('qTop'); top.innerHTML = '';
    ranking.slice(0, 5).forEach(r => { const li = document.createElement('li'); li.textContent = r.name; const sp = document.createElement('span'); sp.textContent = r.pts + ' ' + t('quiz.pts'); li.appendChild(sp); top.appendChild(li); });
    const last = S.i >= S.questions.length - 1;
    $('nextBtn').textContent = last ? t('quiz.results') : t('quiz.next');
    $('qReveal').hidden = false;
    S.advance = setTimeout(next, 8000);
  }
  function next() { clearTimeout(S.advance); if (S.i < S.questions.length - 1) ask(S.i + 1); else finish(); }

  function rank() {
    return Object.keys(S.players).map(uid => {
      const s = scoreOf(uid), avg = s.times.length ? s.times.reduce((a, b) => a + b, 0) / s.times.length : null;
      return { uid, name: nameOf(uid), pts: s.pts, hits: s.hits, avg };
    }).sort((a, b) => b.pts - a.pts || b.hits - a.hits);
  }
  function finish() {
    S.ended = true; clearTimeout(S.timer); clearTimeout(S.advance);
    const r = rank();
    const timed = r.filter(x => x.avg != null);
    const most = r.slice().sort((a, b) => b.hits - a.hits)[0];
    const fast = timed.slice().sort((a, b) => a.avg - b.avg)[0];
    const slow = timed.slice().sort((a, b) => b.avg - a.avg)[0];
    Net.host.setPublic({ phase: 'end', n: S.questions.length, ranking: r.map(x => ({ uid: x.uid, name: x.name, pts: x.pts, hits: x.hits })) });
    show('final');
    const sec = ms => (ms / 1000).toFixed(1) + ' s';
    const st = $('fStats'); st.innerHTML = '';
    [['quiz.stat.most', most, most && most.hits + ' / ' + S.questions.length], ['quiz.stat.fast', fast, fast && sec(fast.avg)], ['quiz.stat.slow', slow, slow && sec(slow.avg)]].forEach(([k, who, val]) => {
      const d = document.createElement('div');
      d.innerHTML = '<small></small><b></b><span></span>';
      d.querySelector('small').textContent = t(k); d.querySelector('b').textContent = who ? who.name : t('quiz.stat.none'); d.querySelector('span').textContent = who ? val : '';
      st.appendChild(d);
    });
    const tb = $('fTable'); tb.innerHTML = '';
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
  }
  async function playAgain() { show('setup'); S.i = -1; await Net.host.setPublic({ phase: 'lobby' }); renderPlayers(); }
  async function newRoom() { await Net.host.close(); location.reload(); }

  // ---------- Arranque ----------
  function boot() {
    I18N.apply();
    G.init(window.CARTARIUS_COUNTRIES);
    Q.prepareShapes(window.CARTARIUS_WORLD);
    renderSettings(); checkStart();
    $('sTypes').addEventListener('change', readSettings);
    $('sRegion').addEventListener('change', readSettings);
    $('createBtn').onclick = createRoom;
    $('startBtn').onclick = startGame;
    $('nextBtn').onclick = next;
    $('againBtn').onclick = playAgain;
    $('newRoomBtn').onclick = newRoom;
    document.addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && !$('qReveal').hidden && !$('play').hidden) { ev.preventDefault(); next(); } });
  }
  boot();
})();
