/* Cartarius · conexión del modo Quiz.
   Todo lo que depende del servicio en tiempo real está en este archivo. Hay dos motores con la misma interfaz:
   - Firebase Realtime Database (si js/firebase-config.js trae configuración).
   - Local: pestañas del mismo navegador vía BroadcastChannel. Sirve para probar sin conexión (o con ?local en la URL).
   Para usar un servidor propio (WebSocket en un VPS) basta con escribir un tercer motor con estos mismos métodos.

   Estructura:
     rooms/{CODE}/host           uid del anfitrión
     rooms/{CODE}/created, seen  marcas de tiempo (creación y último uso)
     rooms/{CODE}/players/{uid}  { name, on }
     rooms/{CODE}/pub            estado público que ven los móviles (fase, pregunta sin la respuesta, resultados)
     rooms/{CODE}/answers/{i}/{uid}  { c: opción elegida, t: hora del servidor }
     rooms/{CODE}/history/{id}   partidas terminadas { at, n, types, regions, ranking: [{ name, pts, hits, avg }] }
     hostKeys/{CODE}             clave secreta del anfitrión (nadie puede leerla)
     claims/{CODE}/{uid}         copia de la clave: permite recuperar la sala con otra cuenta anónima
   La clave se guarda en el navegador del anfitrión. Así la sala sigue siendo suya aunque Firebase borre su cuenta anónima.
*/
(function () {
  'use strict';
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O, 1/I/L
  const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const newKey = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join('');
  const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

  // ---------------- Firebase ----------------
  function firebaseEngine(cfg) {
    const app = firebase.initializeApp(cfg);
    const db = firebase.database(app);
    let offset = 0;
    db.ref('.info/serverTimeOffset').on('value', s => { offset = s.val() || 0; });
    let uidP = null;
    const uid = () => uidP || (uidP = firebase.auth(app).signInAnonymously().then(c => c.user.uid));
    const room = code => db.ref('rooms/' + code);
    const TS = firebase.database.ServerValue.TIMESTAMP;

    return {
      name: 'firebase',
      now: () => Date.now() + offset,
      host: {
        async create() {
          const me = await uid();
          for (let i = 0; i < 20; i++) {
            const code = newCode();
            const r = await room(code).transaction(cur => (cur ? undefined : { host: me, created: TS, seen: TS }));
            if (r.committed) {
              let key = newKey();
              try { await db.ref('hostKeys/' + code).set(key); } catch (e) { key = null; } // reglas antiguas: la sala funciona, pero sin recuperación
              this.code = code;
              return { code, key };
            }
          }
          throw new Error('no-code');
        },
        // Vuelve a abrir una sala ya creada. Devuelve false si ya no existe o no es nuestra.
        async resume(code, key) {
          const me = await uid();
          const host = await room(code).child('host').get();
          if (!host.exists()) return false;
          if (host.val() !== me) {
            if (!key) return false;
            try {
              await db.ref('claims/' + code + '/' + me).set(key);
              await room(code).child('host').set(me);
            } catch (e) { return false; }
          }
          this.code = code;
          await room(code).child('seen').set(TS);
          return true;
        },
        touch() { return room(this.code).child('seen').set(TS); },
        onPlayers(cb) { room(this.code).child('players').on('value', s => cb(s.val() || {})); },
        onAnswers(i, cb) {
          const ref = room(this.code).child('answers/' + i);
          const h = ref.on('value', s => cb(s.val() || {}));
          return () => ref.off('value', h);
        },
        setPublic(pub) { return room(this.code).child('pub').set(pub); },
        clearAnswers(i) { return room(this.code).child(i == null ? 'answers' : 'answers/' + i).remove(); },
        addHistory(entry) { return room(this.code).child('history').push(Object.assign({}, entry, { at: TS })); },
        onHistory(cb) { room(this.code).child('history').on('value', s => cb(s.val() || {})); },
        async close() { // borra la sala para siempre
          if (!this.code) return;
          const code = this.code; this.code = null;
          room(code).child('players').off(); room(code).child('history').off();
          await db.ref('hostKeys/' + code).remove();
          await room(code).remove();
        }
      },
      player: {
        async join(code, name) {
          code = cleanCode(code);
          const me = await uid();
          const r = room(code);
          const host = await r.child('host').get();
          if (!host.exists()) throw new Error('no-room');
          const p = r.child('players/' + me);
          await p.update({ name, on: true });
          p.child('on').onDisconnect().set(false);
          this.code = code; this.uid = me;
          return me;
        },
        onPublic(cb) { room(this.code).child('pub').on('value', s => cb(s.val())); },
        onRoomGone(cb) { room(this.code).child('host').on('value', s => { if (!s.exists()) cb(); }); },
        answer(i, c) { return room(this.code).child('answers/' + i + '/' + this.uid).set({ c, t: TS }); }
      }
    };
  }

  // ---------------- Local (BroadcastChannel) ----------------
  function localEngine() {
    const id = () => Math.random().toString(36).slice(2, 10);
    let myId = null;
    try { myId = sessionStorage.getItem('cartarius:localId'); } catch (e) {}
    if (!myId) { myId = id(); try { sessionStorage.setItem('cartarius:localId', myId); } catch (e) {} }
    const chan = code => new BroadcastChannel('cartarius-quiz-' + code);
    const hist = {
      get(code) { try { return JSON.parse(localStorage.getItem('cartarius:localHistory:' + code)) || {}; } catch (e) { return {}; } },
      set(code, v) { try { localStorage.setItem('cartarius:localHistory:' + code, JSON.stringify(v)); } catch (e) {} }
    };

    return {
      name: 'local',
      now: () => Date.now(),
      host: {
        open(code) {
          this.code = code; this.players = {}; this.answers = {}; this.pub = null; this.ansCbs = {};
          const ch = this.ch = chan(code);
          ch.onmessage = ({ data: m }) => {
            if (m.type === 'join') { this.players[m.uid] = { name: m.name, on: true }; this.playersCb && this.playersCb(Object.assign({}, this.players)); ch.postMessage({ type: 'joined', uid: m.uid }); if (this.pub) ch.postMessage({ type: 'pub', pub: this.pub }); }
            if (m.type === 'hello' && this.pub) ch.postMessage({ type: 'pub', pub: this.pub });
            if (m.type === 'answer') {
              const a = this.answers[m.i] || (this.answers[m.i] = {});
              if (!a[m.uid]) { a[m.uid] = { c: m.c, t: Date.now() }; (this.ansCbs[m.i] || []).forEach(cb => cb(Object.assign({}, a))); }
            }
          };
          ch.postMessage({ type: 'roll' }); // tras recargar, los jugadores vuelven a presentarse
        },
        async create() { const code = newCode(); this.open(code); return { code, key: 'local' }; },
        async resume(code) { this.open(code); return true; },
        touch() { return Promise.resolve(); },
        onPlayers(cb) { this.playersCb = cb; cb(Object.assign({}, this.players)); },
        onAnswers(i, cb) {
          (this.ansCbs[i] = this.ansCbs[i] || []).push(cb); cb(Object.assign({}, this.answers[i] || {}));
          return () => { this.ansCbs[i] = (this.ansCbs[i] || []).filter(f => f !== cb); };
        },
        setPublic(pub) { this.pub = JSON.parse(JSON.stringify(pub)); this.ch.postMessage({ type: 'pub', pub: this.pub }); return Promise.resolve(); },
        clearAnswers(i) { if (i == null) this.answers = {}; else delete this.answers[i]; return Promise.resolve(); },
        addHistory(entry) {
          const h = hist.get(this.code); h['h' + Date.now()] = Object.assign({}, entry, { at: Date.now() }); hist.set(this.code, h);
          if (this.histCb) this.histCb(h);
          return Promise.resolve();
        },
        onHistory(cb) { this.histCb = cb; cb(hist.get(this.code)); },
        close() {
          if (this.ch) { this.ch.postMessage({ type: 'gone' }); this.ch.close(); }
          try { localStorage.removeItem('cartarius:localHistory:' + this.code); } catch (e) {}
          return Promise.resolve();
        }
      },
      player: {
        join(code, name) {
          code = cleanCode(code);
          return new Promise((res, rej) => {
            const ch = this.ch = chan(code);
            this.code = code; this.uid = myId;
            const to = setTimeout(() => rej(new Error('no-room')), 1500);
            ch.onmessage = ({ data: m }) => {
              if (m.type === 'joined' && m.uid === myId) { clearTimeout(to); res(myId); }
              if (m.type === 'pub' && this.pubCb) this.pubCb(m.pub);
              if (m.type === 'gone' && this.goneCb) this.goneCb();
              if (m.type === 'roll') ch.postMessage({ type: 'join', uid: myId, name });
            };
            ch.postMessage({ type: 'join', uid: myId, name });
          });
        },
        onPublic(cb) { this.pubCb = cb; this.ch.postMessage({ type: 'hello' }); },
        onRoomGone(cb) { this.goneCb = cb; },
        answer(i, c) { this.ch.postMessage({ type: 'answer', i, c, uid: this.uid }); return Promise.resolve(); }
      }
    };
  }

  const cfg = window.CARTARIUS_FIREBASE;
  const forceLocal = /[?&]local\b/.test(location.search);
  const engine = (!forceLocal && cfg && cfg.apiKey && window.firebase) ? firebaseEngine(cfg) : localEngine();
  window.CartariusNet = Object.assign(engine, { cleanCode });
})();
