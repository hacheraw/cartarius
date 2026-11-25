/* Cartarius · conexión del modo Quiz.
   Todo lo que depende del servicio en tiempo real está en este archivo. Hay dos motores con la misma interfaz:
   - Firebase Realtime Database (si js/firebase-config.js trae configuración).
   - Local: pestañas del mismo navegador vía BroadcastChannel. Sirve para probar sin conexión (o con ?local en la URL).
   Para usar un servidor propio (WebSocket en un VPS) basta con escribir un tercer motor con estos mismos métodos.

   Estructura de una sala:
     rooms/{CODE}/host           uid del anfitrión
     rooms/{CODE}/created        marca de tiempo
     rooms/{CODE}/players/{uid}  { name, on }
     rooms/{CODE}/pub            estado público que ven los móviles (fase, pregunta sin la respuesta, resultados)
     rooms/{CODE}/answers/{i}/{uid}  { c: opción elegida, t: hora del servidor }
*/
(function () {
  'use strict';
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O, 1/I/L
  const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
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
            const r = await room(code).transaction(cur => (cur ? undefined : { host: me, created: TS }));
            if (r.committed) { this.code = code; return code; }
          }
          throw new Error('no-code');
        },
        onPlayers(cb) { room(this.code).child('players').on('value', s => cb(s.val() || {})); },
        onAnswers(i, cb) {
          const ref = room(this.code).child('answers/' + i);
          const h = ref.on('value', s => cb(s.val() || {}));
          return () => ref.off('value', h);
        },
        setPublic(pub) { return room(this.code).child('pub').set(pub); },
        clearAnswers() { return room(this.code).child('answers').remove(); },
        close() { if (this.code) return room(this.code).remove(); }
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

    return {
      name: 'local',
      now: () => Date.now(),
      host: {
        async create() {
          const code = newCode();
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
          return code;
        },
        onPlayers(cb) { this.playersCb = cb; cb(Object.assign({}, this.players)); },
        onAnswers(i, cb) {
          (this.ansCbs[i] = this.ansCbs[i] || []).push(cb); cb(Object.assign({}, this.answers[i] || {}));
          return () => { this.ansCbs[i] = (this.ansCbs[i] || []).filter(f => f !== cb); };
        },
        setPublic(pub) { this.pub = JSON.parse(JSON.stringify(pub)); this.ch.postMessage({ type: 'pub', pub: this.pub }); return Promise.resolve(); },
        clearAnswers() { this.answers = {}; return Promise.resolve(); },
        close() { if (this.ch) { this.ch.postMessage({ type: 'gone' }); this.ch.close(); } }
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
