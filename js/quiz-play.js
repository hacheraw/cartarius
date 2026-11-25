/* Cartarius · Quiz, pantalla del móvil: unirse con código y nombre, responder y ver el resultado. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const I18N = window.CartariusI18n, t = I18N.t, Net = window.CartariusNet;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cartarius:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cartarius:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const P = { uid: null, name: '', lastI: -1, answered: {}, timerId: null };

  function show(id) { ['join', 'wait', 'question', 'result', 'end'].forEach(x => ($(x).hidden = x !== id)); }
  function err(msg) { $('jErr').textContent = msg; $('jErr').hidden = !msg; }

  async function join() {
    const code = Net.cleanCode($('jCode').value), name = $('jName').value.trim().slice(0, 24);
    if (code.length !== 4 || !name) { err(t('play.err.fields')); return; }
    err(''); $('jBtn').disabled = true;
    try {
      P.uid = await Net.player.join(code, name);
    } catch (e) {
      $('jBtn').disabled = false;
      err(e.message === 'no-room' ? t('play.err.room') : t('play.err.net', { msg: e.message })); return;
    }
    P.name = name; store.set('player', name);
    history.replaceState(null, '', '?sala=' + code + (/[?&]local\b/.test(location.search) ? '&local' : ''));
    $('hName').textContent = name;
    $('wHello').textContent = t('play.hello', { name });
    show('wait');
    Net.player.onRoomGone(() => { show('wait'); $('wHello').textContent = t('play.gone'); });
    Net.player.onPublic(onPub);
  }

  function onPub(pub) {
    if (!pub || pub.phase === 'lobby') { show('wait'); $('hScore').textContent = ''; return; }
    if (pub.phase === 'question') return renderQuestion(pub);
    if (pub.phase === 'reveal') return renderReveal(pub);
    if (pub.phase === 'end') return renderEnd(pub);
  }

  function renderQuestion(q) {
    show('question');
    $('pProg').textContent = t('quiz.qOf', { i: q.i + 1, n: q.n });
    $('pText').textContent = q.text;
    const box = $('pOptions');
    const mine = P.answered[q.i];
    if (P.lastI !== q.i || !box.children.length) {
      box.innerHTML = ''; box.classList.remove('locked');
      (q.options || []).forEach((label, k) => {
        const b = document.createElement('button'); b.type = 'button';
        b.innerHTML = '<b></b><span></span>'; b.querySelector('b').textContent = 'ABCD'[k]; b.querySelector('span').textContent = label;
        b.onclick = () => answer(q, k, b);
        box.appendChild(b);
      });
      P.lastI = q.i;
    }
    if (mine != null) lock(mine, t('play.sent'));
    else $('pStatus').hidden = true;
    // cuenta atrás
    const bar = $('pTimer'), left = q.startedAt + q.dur - Net.now();
    bar.style.transition = 'none'; bar.style.transform = 'scaleX(' + Math.max(0, Math.min(1, left / q.dur)) + ')'; void bar.offsetWidth;
    bar.style.transition = 'transform ' + Math.max(0, left) + 'ms linear'; bar.style.transform = 'scaleX(0)';
    clearTimeout(P.timerId);
    P.timerId = setTimeout(() => { if (P.answered[q.i] == null) lock(-1, t('play.late')); }, Math.max(0, left));
  }
  function lock(k, msg) {
    const box = $('pOptions'); box.classList.add('locked');
    [...box.children].forEach((b, i) => { b.disabled = true; b.classList.toggle('mine', i === k); });
    $('pStatus').textContent = msg; $('pStatus').hidden = false;
  }
  function answer(q, k) {
    if (P.answered[q.i] != null) return;
    P.answered[q.i] = k;
    lock(k, t('play.sent'));
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
    Net.player.answer(q.i, k);
  }

  function renderReveal(r) {
    clearTimeout(P.timerId);
    show('result');
    const me = (r.results || {})[P.uid] || { ok: false, pts: 0 };
    const v = $('rVerdict');
    v.className = 'p-verdict ' + (me.ok ? 'ok' : 'bad');
    v.textContent = me.ok ? t('play.ok') : t('play.bad');
    if (me.ok) { const s = document.createElement('small'); s.textContent = '+' + me.pts + ' ' + t('quiz.pts'); v.appendChild(s); }
    $('rWas').textContent = me.ok ? '' : t('play.was', { x: r.options[r.correct] });
    $('rTotal').textContent = me.pos ? t('play.total', { p: me.total, pos: me.pos, n: r.players }) : '';
    $('hScore').textContent = me.total != null ? me.total + ' ' + t('quiz.pts') : '';
  }
  function renderEnd(e) {
    show('end');
    const list = e.ranking || [], k = list.findIndex(x => x.uid === P.uid);
    $('ePos').textContent = k >= 0 ? k + 1 + 'º' : '—';
    $('eHits').textContent = k >= 0 ? t('play.endPos', { pos: k + 1, n: list.length }) + '. ' + t('play.endHits', { h: list[k].hits, p: list[k].pts }) : '';
    P.answered = {}; P.lastI = -1;
  }

  function boot() {
    I18N.apply();
    const q = new URLSearchParams(location.search);
    if (q.get('sala')) $('jCode').value = Net.cleanCode(q.get('sala'));
    $('jName').value = store.get('player', '');
    $('jCode').addEventListener('input', () => { $('jCode').value = Net.cleanCode($('jCode').value); });
    $('jBtn').onclick = join;
    [$('jCode'), $('jName')].forEach(i => i.addEventListener('keydown', ev => { if (ev.key === 'Enter') join(); }));
    ($('jCode').value ? $('jName') : $('jCode')).focus();
  }
  boot();
})();
