'use strict';
// ================================================================= shared space ==
// Shared rooms (docs/shared-space-plan.md; the rules come from docs/multiplayer.md and docs/shared-spaces.md).
// Headsets and desktop browsers join a room on the relay (relay/server.mjs). A room holds stations: a story
// at a spot in the room, each with its own clock and explore state, the same on every device. A headset runs
// live the station it stands at (the others show as previews on the floor), placed at that station for
// everybody and with its narration coming from there; desktop operators follow a station from a room map.
// Nobody outside a room is affected: until you join, only the Shared buttons show (and, in a headset, a small
// tab beside the story panel once a relay is known).
//
//  HOST.collab  the session: relay, room, keys (echo suppression by value, optimistic writes, apply order),
//               members, the relay's clock, stations, the story hooks, presence, effects, the overlay hung in the
//               story's scene (previews, people, the shell's headset panel, notices) and the page's dialog
//  HOST.room    the room frame in a headset: its own local-floor and shared spaces, the alignment state
//               machine, two-point calibration, the saved frame with an anchor at mark A, reconciliation
//
// A story takes part with one object and two lines (section 7 of the plan): its factory returns
//   collab: { APP, scene: () => GL.scene, state, apply, effect, hover, panel }
// and its headset pointer code asks HOST.collab.ray(i, o, d) before its own raycast (a hit is the hover, kind
// 'shell'; a press then goes to HOST.collab.press(i)). It calls HOST.collab.effect(type, data) where it causes
// a one-shot effect itself. Debugging: window.__collabLog (the last 1000 events), localStorage collabDebug = 1
// (or #debug in a link) prints them as well.
(function () {
  const PROTO = 1;
  const FORMAT = 'networks-2';   // the shared state's format (keys, the stories' state()): bump when it changes shape
  const EYE = 1.6;               // a standing eye height (m): a station's rig hangs this high over its spot
  const AHEAD = 1.4;             // a station's content floats this far in front of its spot
  // your station: within 1.1 m of its spot for a second; left beyond 1.5 m. Arrange all's spots are 2.4 m apart,
  // so two stations never compete for one person
  const NEAR = 1.1, FAR = 1.5, DWELL = 1000;
  const DRIFT = 0.25;            // a story further than this from its station's clock jumps
  // Arrange all: two rows in front of you (4, then 3 in the gaps), spots 2.4 m apart, the first row 1.2 m ahead,
  // the second 2.6 m behind it; every station faces away from you, so its content floats beyond its spot
  const ROW = { gap: 2.4, ahead: 1.2, back: 2.6 };
  const PANEL_HOME = { p: [-0.56, 0.04, -0.86], yaw: Math.atan2(0.56, 0.86) };   // where every story hangs its panel
  const COLORS = ['#46d9ff', '#ff5ad9', '#3ee08f', '#ffb43b', '#9db4ff', '#ff7a59', '#c3e85a', '#f2f6fc'];
  const NAMES = ['Ada', 'Alan', 'Barbara', 'Dorothy', 'Emmy', 'Erwin', 'Grace', 'Hedy', 'Karl', 'Lise', 'Marie',
    'Niels', 'Paul', 'Rosalind', 'Tim', 'Vera'];
  const ST_RE = /^st\.([\w-]{1,32})$/;
  const kPlay = id => 'st.' + id + '.play', kX = id => 'st.' + id + '.x', kPanel = id => 'st.' + id + '.panel';

  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
  // listeners added here belong to the shell: a story change must not remove them
  const quiet = fn => { const q = HOST.quiet; HOST.quiet = true; try { return fn(); } finally { HOST.quiet = q; } };
  const J = v => JSON.stringify(v === undefined ? null : v);
  const any = a => a[Math.floor(Math.random() * a.length)];
  const rid = n => { const a = 'abcdefghijkmnopqrstuvwxyz0123456789'; let s = ''; for (const b of crypto.getRandomValues(new Uint8Array(n))) s += a[b % a.length]; return s; };
  // wall-clock ms (a monotonic clock may stand still while a device sleeps; the relay's offset absorbs any jump)
  const clock = () => Date.now();
  const r3 = x => Math.round(x * 1000) / 1000;
  const meta = key => HOST.list.find(s => s.key === key);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mmss = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const fwd = yaw => [-Math.sin(yaw), -Math.cos(yaw)];   // a yaw's forward on the floor (x, z): yaw 0 faces -z

  // ------------------------------------------------------------------ log --
  const LOG = window.__collabLog = [];
  let DEBUG = get('collabDebug') === '1';
  function log(ev, data) {
    LOG.push(Object.assign({ t: Math.round(performance.now()), ev }, data || {}));
    if (LOG.length > 1000) LOG.splice(0, LOG.length - 1000);
    if (DEBUG) console.log('[shared]', ev, data || '');
  }

  // -------------------------------------------------------------- session --
  const C = {
    id: rid(12), relay: get('collabRelay') || '', linked: false, served: null, detecting: null,
    code: '', ws: null, status: 'off', note: '', want: false, welcomed: false, refill: null, tries: 0, timer: 0, heard: 0, pingAt: 0,
    keys: new Map(), synced: new Map(), pending: new Map(), cid: 0, members: [], xb: null, clockAt: 0, clockT: 0, rm: null,
    offset: 0, samples: [], rtt: 0,
    name: get('collabName') || any(NAMES), color: get('collabColor') || any(COLORS), hereSet: null,
    rooms: null, roomsErr: '', roomsAt: 0,
    st: [], stById: new Map(), mine: '', live: '', picked: false, follow: '', zone: '', cand: '', candAt: 0, going: new Map(), goAt: 0,
    pres: new Map(), rays: new Map(), hov: new Map(), presAt: 0, deskAt: 0,
    cur: null, hook: null, ready: false, guard: 0, hush: false, pumpAt: 0, panelSeen: '', panelAt: 0,
  };
  // what is shown for a key: our own unacknowledged write, else the room's value
  const val = k => { const p = C.pending.get(k); if (p) return p.v; const e = C.keys.get(k); return e ? e.v : undefined; };
  const now = () => clock() + C.offset;   // the relay's clock
  const kind = () => (HOST.session ? (HOST.mode === 'immersive-ar' ? 'ar' : 'vr') : 'desktop');
  // in the room with the others, or elsewhere (a desktop always): only people here calibrate. Passthrough (AR)
  // counts as here; in VR the shell's panel asks once per room (askHere), and the answer is kept per room code
  const here = () => { const k = kind(); return k !== 'desktop' && (C.hereSet !== null ? C.hereSet : k === 'ar'); };
  const askHere = () => !!(C.code && kind() === 'vr' && C.hereSet === null);
  const heres = () => { try { return JSON.parse(get('collabHere') || '{}') || {}; } catch (e) { return {}; } };
  const member = id => C.members.find(m => m.id === id);
  const liveSt = () => (C.live ? C.stById.get(C.live) || null : null);

  // the relay's address: http(s)://host[:port][/path]; typed as wss://..., https://... or host:port
  function norm(s) {
    s = String(s || '').trim();
    if (!s) return '';
    if (!/^[a-z]+:\/\//i.test(s)) s = (location.protocol === 'https:' ? 'https://' : 'http://') + s;
    return s.replace(/^ws(s?):\/\//i, 'http$1://').replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/\/api(\/ws)?$/, '');
  }
  function setRelay(s, why) {
    s = norm(s);
    if (why === 'link') C.linked = !!s;
    if (s === C.relay) return;
    C.relay = s; C.rooms = null; C.roomsErr = '';
    if (why !== 'served') put('collabRelay', s);
    log('relay', { relay: s, why });
    changed();
  }
  // does the relay serve this page? Asked once, and only when the shared space is used
  function detect() {
    if (C.detecting) return C.detecting;
    C.detecting = fetch('api/ping', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null).then(j => {
      C.served = !!(j && j.proto);
      if (C.served && !C.linked) setRelay(new URL('.', location.href).href, 'served');
      log('served', { served: C.served });
      changed();
      return C.served;
    });
    return C.detecting;
  }
  const mixed = () => (location.protocol === 'https:' && /^http:/.test(C.relay) && !/^http:\/\/(localhost|127\.)/.test(C.relay)
    ? ' This page is on https, so the relay must be too (wss://).' : '');
  async function api(path, body) {
    const r = await fetch(C.relay + '/api/' + path, body === undefined ? { cache: 'no-store' } :
      { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let j = null;
    try { j = await r.json(); } catch (e) { /* not JSON */ }
    return { ok: r.ok, status: r.status, j };
  }
  const host = () => C.relay.replace(/^https?:\/\//, '');
  const unreachable = () => 'The relay at ' + host() + ' cannot be reached.' + mixed();
  // the open rooms, those with people first (an empty room stays listed for 6 hours)
  function listRooms() {
    if (!C.relay) return Promise.resolve(null);
    C.roomsAt = performance.now();
    return api('rooms').then(r => {
      C.rooms = r.ok && Array.isArray(r.j) ? r.j.slice().sort((a, b) => (b.members > 0) - (a.members > 0)) : [];
      C.roomsErr = r.ok ? '' : 'The relay at ' + host() + ' answered ' + r.status + '.';
      changed(); return C.rooms;
    }, () => { C.rooms = []; C.roomsErr = unreachable(); changed(); return null; });
  }
  const peopleIn = r => (r.members ? `${r.members} ${r.members === 1 ? 'person' : 'people'}${r.names && r.names.length ? ': ' + r.names.join(', ') : ''}` : 'empty');
  async function create() {
    if (!C.relay) { C.note = 'Enter the relay address first.'; changed(); return; }
    let r = null;
    try { r = await api('rooms', { app: 'networks', version: FORMAT }); } catch (e) { C.note = 'Could not start a room. ' + unreachable(); changed(); return; }
    if (!r.ok || !r.j || !r.j.code) { C.note = 'Could not start a room: the relay answered ' + r.status + '.'; changed(); return; }
    log('created', { code: r.j.code });
    join(r.j.code);
  }
  function join(code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return false;
    if (!C.relay) { C.note = 'Enter the relay address first.'; changed(); return false; }
    if (C.code) leave(true);
    const h = heres()[code];
    Object.assign(C, { code, want: true, welcomed: false, note: '', tries: 0, status: 'connecting', keys: new Map(), synced: new Map(), pending: new Map(),
      members: [], st: [], stById: new Map(), mine: '', live: '', picked: false, follow: '', zone: '', cand: '', xb: null, rm: null,
      hereSet: typeof h === 'boolean' ? h : null });
    C.pres.clear();
    log('join', { code, relay: C.relay });
    HOST.setUrl(HOST.picking);
    connect();
    R.joined();
    changed();
    return true;
  }
  function leave(switching) {
    if (!C.code) return;
    log('leave', { code: C.code });
    C.want = false; clearTimeout(C.timer);
    const ws = C.ws;
    C.ws = null;
    if (ws) try { ws.close(1000); } catch (e) { /* closed */ }
    Object.assign(C, { code: '', status: 'off', welcomed: false, keys: new Map(), synced: new Map(), pending: new Map(), members: [], st: [], stById: new Map(),
      mine: '', live: '', follow: '', zone: '', cand: '', refill: null, xb: null, rm: null, hereSet: null });
    C.pres.clear();
    R.left();
    HOST.audio.zone(null);
    if (!switching) { HOST.setUrl(HOST.picking); changed(); }
  }
  function send(m) {
    if (!C.ws || C.ws.readyState !== 1) return false;
    try { C.ws.send(JSON.stringify(m)); return true; } catch (e) { return false; }
  }
  function connect() {
    if (!C.want || !C.code || !C.relay || (C.ws && C.ws.readyState < 2)) return;
    clearTimeout(C.timer);
    let ws;
    try { ws = new WebSocket(C.relay.replace(/^http/, 'ws') + '/api/ws?room=' + C.code + '&id=' + C.id + '&proto=' + PROTO); } catch (e) {
      log('socket failed', { e: e.message }); C.note = 'Could not reach the relay.' + mixed(); later(); return;
    }
    C.ws = ws; C.status = 'connecting'; C.heard = clock();
    log('connect', { code: C.code });
    // pings: a few at once, then every 2 s for 20 s (a page that is busy loading a story delays them all), then every 15 s
    ws.onopen = () => {
      if (C.ws !== ws) return;
      log('open'); hello(); ping(); C.openAt = performance.now();
      for (const ms of [300, 900]) setTimeout(() => { if (C.ws === ws) ping(); }, ms);
    };
    ws.onmessage = ev => {
      if (C.ws !== ws) return;
      C.heard = clock();
      let m = null;
      try { m = JSON.parse(ev.data); } catch (e) { /* not JSON */ }
      if (m && m.t) recv(m);
    };
    ws.onclose = ev => { if (C.ws !== ws) return; C.ws = null; closed(ev.code, ev.reason); };
    changed();
  }
  // reconnect with backoff: 1, 2, 4, 8, 15 s (and at once when the page or the headset comes back)
  function later() {
    if (!C.want) return;
    clearTimeout(C.timer);
    C.timer = setTimeout(connect, Math.min(15000, 1000 * Math.pow(2, Math.min(4, C.tries++))));
  }
  function closed(code, reason) {
    log('close', { code, reason });
    if (!C.want) { C.status = 'off'; changed(); return; }
    C.status = 'connecting';
    // no such room: after a relay restart (this page was in it) bring it back; on a first join (a mistyped code,
    // an old link) say so and stop, rather than making an empty room of that name
    if (code === 4004) {
      if (C.welcomed) { revive(); return; }
      const c = C.code;
      leave();
      C.note = 'There is no room ' + c + ' on this relay (any more). Start a room, or join one from the list.';
      listRooms();
      if (!HOST.session) dialog(true);
      changed(); return;
    }
    if (code === 4005 || code === 4006 || code === 4000) {
      C.want = false; C.status = 'refused';
      C.note = code === 4000 ? 'The relay refused this room code.' : 'This room runs another version of the app. Reload the page on every device, then join again.';
      changed(); return;
    }
    later(); changed();
  }
  // the relay restarted and forgot the room: bring it back under its code, with what this page knew
  async function revive() {
    try {
      const r = await api('rooms', { app: 'networks', version: FORMAT, code: C.code });
      if (!r.ok && r.status !== 409) throw new Error('answer ' + r.status);   // 409: someone else brought it back first
      C.refill = new Map(C.keys);   // what this page knew goes back in where the room lacks it
      log('revived', { code: C.code, keys: C.refill.size, first: r.ok });
    } catch (e) { log('revive failed', { e: e.message }); later(); return; }
    if (!C.want) return;
    C.tries = 0; connect();
  }
  // the page, the headset or the network comes back: a socket that still looks open may be dead (a sleep), so
  // it must answer a ping within 3 s or a new one is opened
  function wake(why) {
    if (!C.code || !C.want) return;
    C.tries = 0;
    const ws = C.ws;
    if (!ws || ws.readyState > 1) { connect(); return; }
    if (ws.readyState !== 1) return;
    const h = C.heard;
    ping();
    setTimeout(() => {
      if (C.ws !== ws || C.heard !== h) return;
      log('no answer after waking', { why });
      C.ws = null;
      try { ws.close(); } catch (e) { /* gone */ }
      closed(1006, 'no answer');
    }, 3000);
  }
  function hello() {
    send({ t: 'hello', name: C.name, color: C.color, kind: kind(), here: here(), version: FORMAT, proto: PROTO });
  }
  function ping() { if (send({ t: 'ping', c: clock() })) C.pingAt = performance.now(); }
  // the relay's clock: of the last few round trips, the shortest gives the offset (half of it each way). A
  // long one was held up somewhere (a busy page, a slow network), most likely on one side only.
  function pong(m) {
    if (typeof m.c !== 'number' || typeof m.now !== 'number') return;
    const t = clock(), rtt = t - m.c;
    if (rtt < 0 || rtt > 10000) return;
    C.samples.push([rtt, m.now + rtt / 2 - t]);
    if (C.samples.length > 8) C.samples.shift();
    const best = C.samples.reduce((a, b) => (b[0] < a[0] ? b : a));
    C.offset = best[1]; C.rtt = best[0];
  }
  function recv(m) {
    if (m.t === 'welcome') welcome(m);
    else if (m.t === 'set') onSet(m);
    else if (m.t === 'fx') onFx(m);
    else if (m.t === 'members') { C.members = m.members || []; changed(); }
    else if (m.t === 'pong') pong(m);
    else if (m.t === 'error') onError(m);
  }
  // dependencies first: stations, then their clocks, their explore states, their panels, then the rest
  const rank = k => (ST_RE.test(k) ? 0 : /\.play$/.test(k) ? 1 : /\.x$/.test(k) ? 2 : /\.panel$/.test(k) ? 3 : 4);
  // the whole room, first on every socket (a reconnect refetches everything): the room's values win
  function welcome(m) {
    C.status = 'open'; C.tries = 0; C.note = ''; C.welcomed = true;
    C.keys = new Map(Object.entries(m.keys || {}));
    C.pending.clear();
    C.synced = new Map();
    for (const [k, e] of C.keys) C.synced.set(k, J(e.v));
    C.members = m.members || [];
    // a new socket (perhaps after a sleep, or to another relay): the clock is measured again from its pings
    C.samples = [];
    if (typeof m.now === 'number') C.offset = m.now - clock();
    log('welcome', { seq: m.seq, keys: C.keys.size, members: C.members.length });
    // after a relay restart every page back fills in what the room lacks of what it knew, stations first
    const old = C.refill;
    C.refill = null;
    if (old && old.size) {
      const pairs = [...old].filter(([k]) => !C.keys.has(k)).map(([k, e]) => [k, e.v]).sort((a, b) => rank(a[0]) - rank(b[0]));
      for (let i = 0; i < pairs.length; i += 400) publish(pairs.slice(i, i + 400), true);
      log('refilled', { keys: pairs.length });
    }
    roomChanged(null, false);
  }
  // stored writes: one batch, one seq; the value shown here at once (optimistic), acknowledged when it comes back
  function publish(pairs, force) {
    const out = [];
    for (const [k, v] of pairs) {
      const s = J(v);
      if (!force && C.synced.get(k) === s && !C.pending.has(k)) continue;   // echo suppression by value
      if (v === null) C.synced.delete(k); else C.synced.set(k, s);
      out.push([k, v]);
    }
    if (!out.length) return false;
    const cid = ++C.cid;
    for (const [k, v] of out) C.pending.set(k, { cid, v });
    const sent = send({ t: 'set', batch: out, cid });
    log('publish', { cid, keys: out.map(p => p[0]), sent });
    roomChanged(out.map(p => p[0]), true);
    return true;
  }
  const X_RE = /^st\.[\w-]+\.x$/;
  function onSet(m) {
    const me = m.by === C.id, keys = [];
    for (const [k, v] of m.batch || []) {
      if (v === null) C.keys.delete(k); else C.keys.set(k, { v, seq: m.seq, by: m.by });
      const p = C.pending.get(k);
      if (me && p) {   // our acknowledgement: the room now has our value (an explore state's new base)
        if (p.cid === m.cid && J(p.v) === J(v)) { C.pending.delete(k); const L = liveSt(); if (L && k === kX(L.id)) C.xb = { id: L.id, v }; }
        continue;
      }
      // our own later write is on its way: it wins everywhere. Not for an explore state: that merges (stateApply),
      // or the other person's change to another control would be lost
      if (p && !X_RE.test(k)) { log('kept', { k, seq: m.seq, by: m.by }); continue; }
      if (!p) { if (v === null) C.synced.delete(k); else C.synced.set(k, J(v)); }
      keys.push(k);
    }
    log('recv', { seq: m.seq, by: m.by, keys: (m.batch || []).map(p => p[0]) });
    if (keys.length) roomChanged(keys, false);
  }
  // writes the relay did not store: drop them here, and show the room's value again
  function onError(m) {
    log('error', { code: m.code, text: m.text, cid: m.cid, keys: m.keys });
    if (!Array.isArray(m.keys) || (m.code !== 'refused' && m.code !== 'rate')) return;
    const back = [];
    for (const k of m.keys) {
      const p = C.pending.get(k);
      if (!p || (m.cid != null && p.cid !== m.cid)) continue;
      C.pending.delete(k);
      const e = C.keys.get(k);
      if (e) C.synced.set(k, J(e.v)); else C.synced.delete(k);
      back.push(k);
    }
    if (back.length) roomChanged(back, false, true);   // shown as the room has them (no merge: ours was refused)
  }
  // a change of the room's keys (null: all of them), applied in order: stations, clock, explore state, panel, frame
  function roomChanged(keys, local, plain) {
    const all = !keys, has = re => all || keys.some(k => re.test(k));
    if (has(/^st\.[\w-]+$/)) stationsChanged();
    const L = liveSt();
    if (!local && L && C.ready && L.story === HOST.curKey) {
      // (not while our own clock write waits for its turn: it follows, and wins as an unacknowledged write would)
      if ((all || keys.includes(kPlay(L.id))) && !C.clockT) clockApply(true);
      if (all || keys.includes(kX(L.id))) stateApply(!all && !plain);
      if (all || keys.includes(kPanel(L.id))) panelApply();
    }
    if (!local && has(/^roomFrameShared$/)) R.recAt = 0;   // check it on the next frame
    changed();
  }

  // ----------------------------------------------------------- ephemeral --
  function fx(k, v) { return send({ t: 'fx', k, v }); }
  function onFx(m) {
    if (typeof m.k !== 'string') return;
    if (m.k.startsWith('p.')) {
      const id = m.k.slice(2), v = m.v || {};
      if (id === C.id) return;
      let P = C.pres.get(id);
      if (!P) C.pres.set(id, (P = { id }));
      P.at = performance.now(); P.st = typeof v.st === 'string' ? v.st : '';
      P.head = Array.isArray(v.head) && v.head.length === 7 && v.head.every(Number.isFinite) ? v.head : null;
      P.hands = Array.isArray(v.hands) ? v.hands.filter(h => Array.isArray(h) && h.length === 7 && h.every(Number.isFinite)).slice(0, 2) : [];
    } else if (m.k.startsWith('e.')) {
      const L = liveSt(), v = m.v || {};
      log('effect in', { st: m.k.slice(2), type: v.type, by: m.by });
      if (L && m.k === 'e.' + L.id && C.ready && L.story === HOST.curKey && C.hook && C.hook.effect) {
        try { C.hook.effect(v.type, v.data); } catch (e) { log('effect failed', { e: e.message }); }
      }
    }
  }
  // a one-shot effect the story caused here (a falcon sent, crumbs spilled): the others at the station play it too
  function effect(type, data) {
    const L = liveSt();
    if (!L || L.story !== HOST.curKey || !C.code) return false;
    log('effect out', { st: L.id, type });
    return fx('e.' + L.id, { type, data: data === undefined ? null : data });
  }

  // ------------------------------------------------------------ stations --
  function stationsChanged() {
    const out = [];
    for (const k of new Set([...C.keys.keys(), ...C.pending.keys()])) {
      const m = ST_RE.exec(k), v = m && val(k);
      if (!v || typeof v !== 'object' || !meta(v.story)) continue;
      out.push({ id: m[1], story: v.story, x: +v.x || 0, z: +v.z || 0, yaw: +v.yaw || 0 });
    }
    const order = s => HOST.list.findIndex(x => x.key === s.story);
    out.sort((a, b) => order(a) - order(b) || a.id.localeCompare(b.id));
    C.st = out; C.stById = new Map(out.map(s => [s.id, s]));
    // a station that is missing for a moment (a relay restart: the room comes back empty, then refilled) stays
    // chosen here; while it is missing it is simply not live
    for (const f of ['zone', 'cand']) if (C[f] && !C.stById.has(C[f])) C[f] = '';
    // someone gave the live station another story: it changes here too
    const L = liveSt();
    if (L && L.story !== HOST.curKey && (C.mine === L.id || C.follow === L.id)) goTo(L);
  }
  // the room asks for a story here (HOST.go): remembered, so HOST.start can tell it from a person's own choice
  function goTo(s) {
    if (HOST.curKey === s.story) return;
    log('switch', { st: s.id, story: s.story });
    C.going.set(s.story, C.goAt = performance.now());
    HOST.go(s.story);
  }
  // HOST.start is about to run a story: one the person picked themselves (the Stories screen, a headset's
  // menu) takes them away from their station, which stops following it here
  function starting(key) {
    const asked = C.going.has(key), t = performance.now();
    C.going.delete(key);
    for (const [k, at] of C.going) if (t - at > 60000) C.going.delete(k);
    const L = liveSt();
    if (!asked && L && L.story !== key && (C.mine === L.id || C.follow === L.id || C.live === L.id)) {
      log('own story', { story: key, st: L.id });
      C.follow = ''; C.mine = ''; C.live = ''; C.picked = false;
      changed();
    }
    return adopt(key);
  }
  // make a station yours (walking up to it, pointing at its preview, Follow on a page): its story runs live here
  function choose(id, how) {
    const s = C.stById.get(id);
    if (!s) return;
    C.mine = id; C.live = id; C.picked = how === 'pick';
    if (how === 'follow') C.follow = id;
    log('station', { st: id, story: s.story, how });
    // following from a page shows the station: its Stories screen closes (while it shows, the pump stands still)
    if (how === 'follow') HOST.closePicker();
    if (HOST.curKey !== s.story) goTo(s);
    else if (C.ready) { clockApply(true); stateApply(); panelApply(); }
    changed();
  }
  function unfollow() { log('unfollow', { st: C.follow }); C.follow = ''; C.mine = ''; C.live = ''; C.picked = false; changed(); }
  // the stories' station: its spot (x, z), facing yaw; the content floats 1.4 m ahead
  const content = s => { const [fx, fz] = fwd(s.yaw); return [s.x + AHEAD * fx, s.z + AHEAD * fz]; };
  const startClock = () => ({ mode: 'story', t: 0, playing: false, at: 0 });
  // where you are in the room and which way you face: a headset's head, a desktop's room origin
  function base() {
    if (R.aligned && R.headOK) return { x: R.hr.x, z: R.hr.z, yaw: R.hyaw };
    return { x: 0, z: 0, yaw: 0 };
  }
  // Arrange all: the seven stories in two rows in front of you (4, then 3 in the gaps behind), spots 2.4 m apart,
  // every station facing away from you, so its content floats beyond its spot and faces your side; a story that
  // already has a station keeps it (moved, its state kept)
  function arrange(b) {
    b = b || base();
    const n = HOST.list.length, front = Math.ceil(n / 2), pairs = [], used = new Set(), [fx, fz] = fwd(b.yaw), rx = -fz, rz = fx;
    HOST.list.forEach((m, i) => {
      const row = i < front ? 0 : 1, k = row ? n - front : front, j = row ? i - front : i;
      const side = (j - (k - 1) / 2) * ROW.gap, ahead = ROW.ahead + row * ROW.back;
      const old = C.st.find(s => s.story === m.key && !used.has(s.id)), id = old ? old.id : rid(5);
      used.add(id);
      pairs.push(['st.' + id, { story: m.key, x: r3(b.x + ahead * fx + side * rx), z: r3(b.z + ahead * fz + side * rz), yaw: r3(b.yaw) }]);
      if (!old) pairs.push([kPlay(id), startClock()]);
    });
    for (const s of C.st) if (!used.has(s.id)) pairs.push(['st.' + s.id, null]);
    log('arrange', { stations: n });
    publish(pairs);
  }
  // Add a station here: one story at your feet, facing where you face
  function add(story, b) {
    if (!meta(story)) return '';
    b = b || base();
    const id = rid(5);
    publish([['st.' + id, { story, x: r3(b.x), z: r3(b.z), yaw: r3(b.yaw) }], [kPlay(id), startClock()]]);
    return id;
  }
  function move(id, b) {
    const s = C.stById.get(id);
    if (!s) return;
    b = b || base();
    publish([['st.' + id, { story: s.story, x: r3(b.x), z: r3(b.z), yaw: r3(b.yaw) }]]);
  }
  function remove(id) { if (C.stById.has(id)) publish([['st.' + id, null]]); }

  // ----------------------------------------------------- the story's hooks --
  // A story's object: collab: { APP, scene, state, apply, effect, hover, panel }. The shell wraps APP's
  // seek, togglePlay, enterExplore and enterStory to publish the station's clock, applies the room's clock,
  // polls state() five times a second and publishes it when it changed, and passes remote values to apply().
  function attachCheck() {
    const cur = HOST.cur;
    if (cur !== C.cur) { C.cur = cur; C.hook = (cur && cur.collab) || null; C.ready = false; }
    if (!C.hook || C.ready) return;
    let sc = null;
    try { sc = C.hook.scene(); } catch (e) { /* not built yet */ }
    if (!sc) return;
    C.ready = true;
    wrap(C.hook.APP);
    hang(sc);
    const L = liveSt();
    log('attach', { story: HOST.curKey, st: L ? L.id : '' });
    if (L && L.story === HOST.curKey) { clockApply(true); stateApply(); panelApply(); }
  }
  // the shell calls this before a story is disposed: take the overlay out of its scene
  function detach() {
    if (OV.root && OV.root.parent) OV.root.parent.remove(OV.root);
    C.cur = null; C.hook = null; C.ready = false;
  }
  const guarded = fn => { C.guard++; try { return fn(); } finally { C.guard--; } };
  function wrap(A) {
    if (!A || A.__shared) return;
    A.__shared = true;
    for (const name of ['seek', 'togglePlay', 'enterExplore', 'enterStory']) {
      const f = A[name];
      if (typeof f !== 'function') continue;
      A[name] = function (...args) {
        if (name === 'togglePlay' && !C.guard && catchUp()) return undefined;
        const r = f.apply(A, args);
        clockPublish();
        return r;
      };
    }
  }
  const synced = L => !!(L && C.ready && C.hook && L.story === HOST.curKey);
  const playOf = L => { const v = val(kPlay(L.id)); return v && typeof v === 'object' && (v.mode === 'story' || v.mode === 'explore') ? v : null; };
  // the story time a station's clock says now: at relay time `at` it was at `t`, and runs on while playing
  const expected = P => (P.mode === 'story' && P.playing ? (+P.t || 0) + Math.max(0, now() - (+P.at || 0)) / 1000 : +P.t || 0);
  // a person's action (play, pause, a jump, a mode change): the station's new clock, for everybody.
  // Not while applying the room's clock, and not for what a headset does by itself when it starts or wakes.
  // At most one write every 100 ms (a drag along the timeline), the last one always sent a moment later.
  function clockPublish() {
    const L = liveSt();
    if (!synced(L) || C.guard || C.hush) return;
    const t = performance.now();
    if (t - C.clockAt < 100) {
      if (!C.clockT) C.clockT = setTimeout(() => { C.clockT = 0; const M = liveSt(); if (M && M.id === L.id) clockPublish(); }, 100 - (t - C.clockAt));
      return;
    }
    C.clockAt = t;
    const A = C.hook.APP, playing = A.mode === 'story' && !!A.playing;
    publish([[kPlay(L.id), { mode: A.mode, t: r3(A.t), playing, at: playing ? Math.round(now()) : 0 }]]);
  }
  // play pressed on a story that is paused here only (the Stories screen, a headset taken off) while its
  // station plays: join the station's clock instead of starting it again from here
  function catchUp() {
    const L = liveSt();
    if (!synced(L)) return false;
    const P = playOf(L), A = C.hook.APP;
    if (!P || !P.playing || P.mode !== 'story' || A.mode !== 'story' || A.playing) return false;
    guarded(() => { A.playing = true; A.seek(expected(P)); });
    log('catch up', { st: L.id });
    return true;
  }
  // the room's clock, applied here: the mode, playing or paused, and the time if it drifted more than 0.25 s.
  // remote: a new value from the room (applied in full); else the five-times-a-second check, which leaves a
  // pause made here alone (the Stories screen, the page's start screen) but stops a story that plays by itself
  function clockApply(remote) {
    const L = liveSt();
    if (!synced(L)) return;
    const P = playOf(L), A = C.hook.APP;
    if (!P) return;
    const want = expected(P);
    let did = '';
    guarded(() => {
      if (P.mode === 'explore') {
        if (A.mode !== 'explore') { A.t = +P.t || 0; A.enterExplore(); did = 'explore'; }
        return;
      }
      if (A.mode !== 'story') { A.enterStory(want); A.playing = !!P.playing; did = 'story'; return; }
      // a page on its Stories screen keeps its story paused (play there would start the narration behind it)
      if (A.playing !== !!P.playing && (remote || A.playing) && !(P.playing && HOST.picking)) { A.playing = !!P.playing; did = P.playing ? 'play' : 'pause'; }
      if (A.playing === !!P.playing && Math.abs(A.t - want) > DRIFT) { A.seek(want); did = did || 'jump'; }
    });
    if (did) {
      log('clock', { st: L.id, did, to: r3(want), remote: !!remote });
      // a mode change here was the room's: the room's explore state goes with it (what entering a mode did to the
      // controls here is not this page's to publish)
      if (did === 'explore' || did === 'story') { if (val(kX(L.id)) !== undefined) stateApply(); else rebase(L); }
    }
  }
  function rebase(L) {
    try { if (C.hook.state) { const s = C.hook.state(); C.synced.set(kX(L.id), J(s)); C.xb = { id: L.id, v: s }; } } catch (e) { /* story not ready */ }
  }
  // the station's explore state, applied here. A new value from the room (remote) merges, field by field (the
  // top level of state()), with what changed here since the last value both knew (C.xb, the base): our changes
  // stay, and the merged state goes out, so two people changing different controls at once both keep theirs.
  // Otherwise (a station chosen, a story attached, a mode change) the room's value is shown as it is.
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  function stateApply(remote) {
    const L = liveSt();
    if (!synced(L) || !C.hook.apply) return;
    const k = kX(L.id), e = C.keys.get(k), v = remote ? (e ? e.v : undefined) : val(k);
    if (v === undefined || v === null) return;
    let M = v, mine = [];
    if (remote && C.xb && C.xb.id === L.id && isObj(v) && isObj(C.xb.v) && C.hook.state) {
      let cur;
      try { cur = C.hook.state(); } catch (err) { cur = null; }
      if (isObj(cur)) {
        for (const f of Object.keys(cur)) if (J(cur[f]) !== J(C.xb.v[f]) && J(cur[f]) !== J(v[f])) mine.push(f);
        if (mine.length) { M = Object.assign({}, v); for (const f of mine) M[f] = cur[f]; }
      }
    }
    C.xb = { id: L.id, v: e ? e.v : v };
    guarded(() => { try { C.hook.apply(M); } catch (err) { log('apply failed', { e: err.message }); } });
    // our own write still on its way lands after this one, so it must carry the merged state too
    const p = remote && C.pending.get(k);
    if (mine.length || (p && J(p.v) !== J(M))) { log('state merged', { st: L.id, kept: mine }); publish([[k, M]], true); }
    else C.synced.set(k, J(v));   // a remote value becomes the last synced value
    log('state', { st: L.id });
  }
  function statePoll() {
    const L = liveSt();
    if (!synced(L) || !C.hook.state) return;
    let s;
    try { s = C.hook.state(); } catch (e) { return; }
    if (s !== undefined) publish([[kX(L.id), s]]);
  }
  // the station's panel (relative to its spot: x, y over the floor, z, yaw), moved here with the grip
  function panelPoll() {
    const L = liveSt();
    if (!synced(L) || !R.placing()) return;
    let p = null;
    try { p = HOST.cur.xrPose(); } catch (e) { /* not in a headset */ }
    if (!p) return;
    const v = { x: r3(p.pp.x), y: r3(p.pp.y + EYE), z: r3(p.pp.z), yaw: r3(p.pr) }, s = J(v), t = performance.now();
    if (s !== C.panelSeen) { C.panelSeen = s; C.panelAt = t; return; }
    if (t - C.panelAt < 300) return;   // still moving: publish once it rests
    const o = val(kPanel(L.id)) || { x: PANEL_HOME.p[0], y: PANEL_HOME.p[1] + EYE, z: PANEL_HOME.p[2], yaw: PANEL_HOME.yaw };
    if (Math.hypot(v.x - o.x, v.y - o.y, v.z - o.z) > 0.002 || Math.abs(v.yaw - o.yaw) > 0.004) publish([[kPanel(L.id), v]]);
  }
  function panelApply() {
    const L = liveSt();
    if (!synced(L) || !C.hook.panel || !R.placing()) return;
    const v = val(kPanel(L.id));
    if (!v || performance.now() - C.panelAt < 500) return;   // a panel moved here wins while it moves
    try { C.hook.panel([v.x, v.y - EYE, v.z], v.yaw); } catch (e) { return; }
    C.panelSeen = J({ x: v.x, y: v.y, z: v.z, yaw: v.yaw });
  }

  // ------------------------------------------- the pump: five times a second --
  function pump() {
    const t = performance.now();
    if (t - C.pumpAt < 190) return;
    C.pumpAt = t;
    attachCheck();
    if (!C.code) return;
    if (C.ws && C.ws.readyState === 1) {
      if (t - C.pingAt > (t - C.openAt < 20000 ? 2000 : 15000)) ping();
      if (clock() - C.heard > 40000) { log('silent socket'); const ws = C.ws; C.ws = null; try { ws.close(); } catch (e) { /* gone */ } closed(1006, 'silent'); }
    }
    const L = liveSt();
    if (synced(L) && !HOST.picking) { if (!C.clockT) clockApply(false); statePoll(); panelPoll(); }
    // a switch the room asked for that got lost (a story still loading drops a second request): ask again
    else if (L && L.story !== HOST.curKey && (C.mine === L.id || C.follow === L.id) && !HOST.busy && t - C.goAt > 3000) goTo(L);
    for (const [id, P] of C.pres) if (t - P.at > (P.head ? 3000 : 8000)) C.pres.delete(id);
    // a desktop says which station it follows, now and then (headsets say it with their presence)
    if (!HOST.session && t - C.deskAt > 2000) { C.deskAt = t; fx('p.' + C.id, { st: C.follow || '' }); }
    if (DLG.open) drawMap();
  }
  setInterval(pump, 200);

  // ------------------------------------------------------------ the overlay --
  // One group hung in the story's scene (scene coordinates are the story's local reference space): the room
  // group (its matrix is room -> local) with the previews and the other people, the shell's headset panel and
  // the notices. Shown only in a headset.
  const OV = { root: null, room: null, rings: new Map(), cards: new Map(), people: new Map(), hit: [], panel: null, note: null };
  const RC = new THREE.Raycaster();
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);
  const FONT = (px, w) => `${w || 400} ${px}px B612, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  const INK = '#e7eef8', MUTED = '#95a6bd', FAINT = '#6c7d94', CYAN = '#46d9ff';
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fit(ctx, s, w) { s = String(s); if (ctx.measureText(s).width <= w) return s; while (s.length > 1 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }
  function wrapText(ctx, s, x, y, w, lh, max) {
    const words = String(s).split(/\s+/).filter(Boolean), lines = [];
    let cur = '';
    for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (cur && ctx.measureText(t).width > w) { lines.push(cur); cur = wd; } else cur = t; }
    if (cur) lines.push(cur);
    const L = max ? lines.slice(0, max) : lines;
    if (max && lines.length > max) L[max - 1] = fit(ctx, L[max - 1] + '…', w);
    L.forEach((l, k) => ctx.fillText(l, x, y + k * lh));
    return L.length * lh;
  }
  // a canvas on a plane, drawn again only when what it shows changes
  function sheet(w, h, mw, order) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const tex = new THREE.CanvasTexture(cv);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mw, mw * h / w),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    mesh.renderOrder = order || 52;
    const S = { w, h, mw, cv, ctx: cv.getContext('2d'), tex, mesh, regions: [], hover: null, sig: '', vis: h };
    S.at = (x, y) => { for (let k = S.regions.length - 1; k >= 0; k--) { const r = S.regions[k]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r; } return null; };
    mesh.userData.sheet = S;
    return S;
  }
  // only the top `vis` pixels of the canvas show (the panel's closed tab), its top edge staying put
  function showTop(S, vis) {
    if (S.vis === vis && S.mesh.userData.visSet) return;
    S.vis = vis; S.mesh.userData.visSet = true;
    const f = vis / S.h;
    S.tex.repeat.set(1, f); S.tex.offset.set(0, 1 - f);
    S.mesh.scale.y = f; S.mesh.position.y = -(S.mw * S.h / S.w) * f / 2;
  }
  function button(S, id, x, y, w, h, label, fn, o = {}) {
    const ctx = S.ctx, hov = S.hover === id && fn;
    rr(ctx, x, y, w, h, o.r || 10);
    ctx.fillStyle = o.primary ? (hov ? '#8ce9ff' : CYAN) : o.on ? 'rgba(70,217,255,0.20)' : hov ? 'rgba(149,166,189,0.30)' : 'rgba(149,166,189,0.13)';
    ctx.fill();
    if (o.on || hov) { ctx.lineWidth = 2; ctx.strokeStyle = o.on ? CYAN : 'rgba(149,166,189,0.55)'; ctx.stroke(); }
    ctx.font = FONT(o.px || 24, o.primary || o.on ? 700 : 400);
    ctx.fillStyle = o.primary ? '#04131c' : fn ? o.color || INK : FAINT;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(fit(ctx, label, w - 16), x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    if (fn) S.regions.push({ id, x, y, w, h, fn });
  }
  function build() {
    if (OV.root) return;
    OV.root = new THREE.Group(); OV.root.name = 'shared';
    OV.room = new THREE.Group(); OV.room.matrixAutoUpdate = false;
    OV.root.add(OV.room);
    OV.panelG = new THREE.Group();
    OV.panel = sheet(720, 960, 0.42, 53);
    OV.panelG.add(OV.panel.mesh); OV.root.add(OV.panelG);
    OV.panel.mesh.userData.shell = { kind: 'panel' };
    OV.note = sheet(720, 170, 0.5, 54);
    OV.root.add(OV.note.mesh); OV.note.mesh.visible = false;
    OV.root.visible = false;
  }
  function hang(sc) { build(); if (OV.root.parent !== sc) sc.add(OV.root); }

  // a preview of a station that is not live here: a ring on the floor at its spot in the story's colour, and a
  // small upright card where its content would float (title, who is there, playing at 1:23 / exploring)
  function ringFor(s) {
    let o = OV.rings.get(s.id);
    if (!o) {
      const col = new THREE.Color(meta(s.story).col), g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.52, 48), mat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01;
      const tip = new THREE.Mesh(new THREE.CircleGeometry(0.09, 3), mat);   // a triangle at the front: which way it faces
      tip.rotation.set(-Math.PI / 2, 0, Math.PI / 2); tip.position.set(0, 0.011, -0.62);
      g.add(ring, tip);
      ring.userData.shell = { kind: 'station', id: s.id };
      o = { g, ring, mat, story: s.story };
      OV.rings.set(s.id, o); OV.room.add(g);
    }
    if (o.story !== s.story) { o.mat.color.set(meta(s.story).col); o.story = s.story; }
    o.g.position.set(s.x, 0, s.z); o.g.rotation.set(0, s.yaw, 0);
    return o;
  }
  function cardFor(s) {
    let o = OV.cards.get(s.id);
    if (!o) {
      o = sheet(560, 330, 0.5, 49);   // drawn before the story's panels (50), so a panel in front stays on top
      o.mesh.material.depthTest = true;
      o.mesh.userData.shell = { kind: 'station', id: s.id };
      OV.cards.set(s.id, o); OV.room.add(o.mesh);
    }
    const [cx, cz] = content(s);
    // turned to you (seen from another row it would be back to front), else facing back to its spot
    o.mesh.position.set(cx, 1.45, cz); o.mesh.rotation.set(0, R.headOK ? Math.atan2(R.hr.x - cx, R.hr.z - cz) : s.yaw, 0);
    return o;
  }
  function stationLine(s) {
    const P = playOf(s);
    if (!P) return 'Not started yet';
    if (P.mode === 'explore') return 'Exploring';
    const t = expected(P);
    return (P.playing ? 'Playing at ' : t < 0.5 ? 'Ready to start' : 'Paused at ') + (P.playing || t >= 0.5 ? mmss(t) : '');
  }
  function whoAt(id) {
    const out = [];
    if (C.mine === id) out.push('you');
    for (const [pid, P] of C.pres) if (P.st === id) { const m = member(pid); if (m && m.name) out.push(m.name); }
    return out;
  }
  function drawCard(o, s) {
    const m = meta(s.story), who = whoAt(s.id), sig = [s.story, stationLine(s), who.join(','), o.hover].join('|');
    if (sig === o.sig) return;
    o.sig = sig;
    const ctx = o.ctx, W = o.w, H = o.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    rr(ctx, 4, 4, W - 8, H - 8, 22); ctx.fillStyle = 'rgba(8,15,28,0.92)'; ctx.fill();
    ctx.lineWidth = o.hover ? 6 : 3; ctx.strokeStyle = o.hover ? m.col : 'rgba(140,170,210,0.35)'; ctx.stroke();
    ctx.fillStyle = m.col; ctx.fillRect(4, 4, W - 8, 9);
    ctx.font = FONT(24, 700); ctx.fillStyle = m.col; ctx.fillText(m.kick.toUpperCase(), 32, 36);
    ctx.font = FONT(54, 700); ctx.fillStyle = INK; ctx.fillText(fit(ctx, m.title, W - 64), 30, 70);
    ctx.font = FONT(28); ctx.fillStyle = INK; ctx.fillText(stationLine(s), 32, 150);
    ctx.fillStyle = MUTED; ctx.fillText(fit(ctx, who.length ? 'Here: ' + who.join(', ') : 'Nobody here yet', W - 64), 32, 194);
    ctx.font = FONT(22); ctx.fillStyle = FAINT; ctx.fillText('Walk up to it, or point here and pull the trigger', 32, H - 62);
    o.tex.needsUpdate = true;
  }
  // the other people, in room coordinates: rays with a bright dot at the end, a name tag over the head and, for
  // people who are not in this room (or for everyone in VR, where you cannot see the room), a simple avatar
  function personFor(id) {
    let o = OV.people.get(id);
    if (o) return o;
    const mk = (geo, col) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col }));
    o = { g: new THREE.Group(), avatar: new THREE.Group(), rays: [], dots: [], hands: [], color: '', name: null, e: null };
    const head = mk(new THREE.SphereGeometry(0.1, 20, 14), 0xffffff);
    head.scale.set(1, 1.18, 1.08);
    const visor = mk(new THREE.BoxGeometry(0.17, 0.065, 0.06), 0x0b1220);
    visor.position.set(0, 0.015, -0.085);
    o.avatar.add(head, visor); o.head = head;
    for (let i = 0; i < 2; i++) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false }));
      line.renderOrder = 58;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false }));
      dot.renderOrder = 59;
      const hand = mk(new THREE.SphereGeometry(0.04, 12, 10), 0xffffff);
      o.rays.push(line); o.dots.push(dot); o.hands.push(hand);
      o.g.add(line, dot, hand);
    }
    o.tagCv = document.createElement('canvas'); o.tagCv.width = 384; o.tagCv.height = 84;
    o.tagTex = new THREE.CanvasTexture(o.tagCv);
    o.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: o.tagTex, transparent: true, depthTest: false, depthWrite: false }));
    o.tag.renderOrder = 57; o.tag.scale.set(0.3, 0.066, 1);
    o.g.add(o.avatar, o.tag);
    OV.room.add(o.g); OV.people.set(id, o);
    return o;
  }
  function dropPerson(id) {
    const o = OV.people.get(id);
    if (!o) return;
    o.g.parent.remove(o.g);
    o.g.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) { if (x.material.map) x.material.map.dispose(); x.material.dispose(); } });
    OV.people.delete(id);
  }
  function drawPeople(dt) {
    const k = 1 - Math.exp(-dt / 0.06);   // ease towards the latest presence (time constant 60 ms)
    const vr = HOST.mode !== 'immersive-ar';
    for (const id of OV.people.keys()) if (!C.pres.has(id) || !C.pres.get(id).head) dropPerson(id);
    for (const [id, P] of C.pres) {
      if (!P.head) continue;
      const o = personFor(id), m = member(id) || {}, col = m.color || '#f2f6fc', name = m.name || 'Someone';
      if (o.color !== col) {
        o.color = col;
        for (const x of [o.head, ...o.hands, ...o.rays, ...o.dots]) x.material.color.set(col);
        o.dots.forEach(d => d.material.color.lerp(new THREE.Color(0xffffff), 0.5));
      }
      if (o.name !== name) {
        o.name = name;
        const ctx = o.tagCv.getContext('2d');
        ctx.clearRect(0, 0, 384, 84); rr(ctx, 2, 2, 380, 80, 16); ctx.fillStyle = 'rgba(3,8,16,0.85)'; ctx.fill();
        ctx.fillStyle = col; ctx.fillRect(2, 2, 10, 80);
        ctx.font = FONT(40, 700); ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.fillText(fit(ctx, name, 340), 28, 44);
        o.tagTex.needsUpdate = true;
      }
      const h = P.head, hands = P.hands;
      if (!o.e) o.e = { p: new THREE.Vector3(h[0], h[1], h[2]), q: new THREE.Quaternion(h[3], h[4], h[5], h[6]), hands: [] };
      o.e.p.lerp(_v.set(h[0], h[1], h[2]), k); o.e.q.slerp(_q.set(h[3], h[4], h[5], h[6]), k);
      o.avatar.position.copy(o.e.p); o.avatar.quaternion.copy(o.e.q);
      o.avatar.visible = vr || !m.here;
      o.tag.position.set(o.e.p.x, o.e.p.y + 0.24, o.e.p.z);
      for (let i = 0; i < 2; i++) {
        const H = hands[i], on = !!H;
        o.rays[i].visible = o.dots[i].visible = on; o.hands[i].visible = on && o.avatar.visible;
        if (!on) { o.e.hands[i] = null; continue; }
        let E = o.e.hands[i];
        if (!E) E = o.e.hands[i] = { o: new THREE.Vector3(H[0], H[1], H[2]), d: new THREE.Vector3(H[3], H[4], H[5]), len: H[6] };
        E.o.lerp(_v.set(H[0], H[1], H[2]), k); E.d.lerp(_v.set(H[3], H[4], H[5]), k).normalize(); E.len += (H[6] - E.len) * k;
        const len = E.len > 0.05 ? E.len : 1.2;
        // the line runs along its +z: turned to the ray's direction in room coordinates (lookAt would want world ones)
        o.rays[i].position.copy(E.o); o.rays[i].quaternion.setFromUnitVectors(_Z, E.d); o.rays[i].scale.set(1, 1, len);
        o.dots[i].position.copy(E.o).addScaledVector(E.d, len);
        o.hands[i].position.copy(E.o);
      }
    }
  }
  // the previews of the stations that are not live here (the live one keeps only its ring, fainter)
  const HOV = [];   // what the controllers point at, this frame
  function drawPreviews() {
    const ids = new Set(C.st.map(s => s.id));
    for (const [id, o] of OV.rings) if (!ids.has(id)) { o.g.parent.remove(o.g); o.g.traverse(x => { if (x.geometry) x.geometry.dispose(); }); o.mat.dispose(); OV.rings.delete(id); }
    for (const [id, o] of OV.cards) if (!ids.has(id) || (id === C.live && C.stById.get(id).story === HOST.curKey)) {
      o.mesh.parent.remove(o.mesh); o.mesh.geometry.dispose(); o.tex.dispose(); o.mesh.material.dispose(); OV.cards.delete(id);
    }
    for (const s of C.st) {
      const r = ringFor(s), live = s.id === C.live && s.story === HOST.curKey;
      r.mat.opacity = live ? 0.3 : 0.75;
      r.ring.userData.shell = live ? null : { kind: 'station', id: s.id };
      if (live) continue;
      const c = cardFor(s);
      c.hover = HOV.some(h => h.target.kind === 'station' && h.target.id === s.id);
      drawCard(c, s);
    }
  }

  // ------------------------------------------------- the shell's headset panel --
  // Beside the story panel: "Shared: XYZ · 4 people" when joined, a small "Shared space" tab when not (shown
  // once a relay is known). Join a room from the list (no typing), leave, your name and colour, calibrate, the
  // alignment, the stations (Arrange all, Add a station here, Move here, Remove) and the people.
  const PNL = { open: false, page: 'main', asked: '' };
  // Remove takes two presses (page and headset): the first arms it for 3 s ("Remove for everyone?")
  const armed = id => !!(C.rm && C.rm.id === id && performance.now() < C.rm.until);
  function removeAsk(id) {
    if (armed(id)) { C.rm = null; remove(id); return true; }
    C.rm = { id, until: performance.now() + 3000 };
    setTimeout(changed, 3050);
    changed();
    return false;
  }
  function panelSig() {
    return J([C.code, C.status, C.note, PNL.open, PNL.page, OV.panel.hover, C.name, C.color, C.hereSet, here(), askHere(), R.status(), C.mine, C.live, armed(C.mine),
      C.st.map(s => s.id + s.story), C.members.map(m => m.id + m.name + m.color + m.kind + m.here), [...C.pres].map(([id, P]) => id + P.st),
      C.code ? 0 : (C.rooms || []).map(r => r.code + r.members), C.roomsErr, C.relay, sharedLine(), forgetArmed(), !!(R.saved || R.frame)]);
  }
  function drawPanel() {
    const S = OV.panel, sig = panelSig();
    if (sig === S.sig) return;
    S.sig = sig;
    const ctx = S.ctx, W = S.w, x = 34, w = W - 68;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, S.h); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    S.regions = [];
    const n = C.members.length, title = C.code ? `Shared: ${C.code} · ${n} ${n === 1 ? 'person' : 'people'}` : 'Shared space';
    let y = 0;
    const tab = !PNL.open, H = tab ? 112 : S.h;
    rr(ctx, 0, 0, W, H, 24); ctx.fillStyle = 'rgba(8,15,28,0.95)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = C.code ? 'rgba(70,217,255,0.5)' : 'rgba(140,170,210,0.3)'; ctx.stroke();
    ctx.font = FONT(32, 700); ctx.fillStyle = INK; ctx.fillText(fit(ctx, title, w - 170), x, 26);
    ctx.font = FONT(21); ctx.fillStyle = MUTED;
    ctx.fillText(fit(ctx, C.code ? connLine() + (R.status() ? ' · ' + R.status() : '') : C.relay ? 'Join others in a room' : 'No relay known', w - 170), x, 70);
    button(S, 'open', W - 34 - 150, 26, 150, 60, tab ? 'Open' : 'Close', () => { PNL.open = !PNL.open; PNL.page = 'main'; if (PNL.open && !C.code) listRooms(); });
    showTop(S, H);
    if (tab) { S.tex.needsUpdate = true; return; }
    y = 118;
    const line = () => { ctx.fillStyle = 'rgba(149,166,189,0.22)'; ctx.fillRect(x, y, w, 2); y += 18; };
    const label = (s, col) => { ctx.font = FONT(22, 700); ctx.fillStyle = col || MUTED; ctx.fillText(s.toUpperCase(), x, y); y += 36; };
    line();
    if (C.note) { ctx.font = FONT(23); ctx.fillStyle = '#ffb43b'; y += wrapText(ctx, C.note, x, y, w, 31, 3) + 10; }
    if (!C.code) {
      label('Open rooms');
      const rooms = (C.rooms || []).slice(0, 5);
      if (!rooms.length) { ctx.font = FONT(24); ctx.fillStyle = MUTED; y += wrapText(ctx, C.roomsErr || (C.rooms ? 'No open rooms. Start one.' : 'Looking for rooms...'), x, y, w, 32, 2) + 12; }
      for (const r of rooms) {
        ctx.font = FONT(30, 700); ctx.fillStyle = INK; ctx.fillText(r.code, x, y + 8);
        ctx.font = FONT(21); ctx.fillStyle = MUTED;
        ctx.fillText(fit(ctx, peopleIn(r), w - 260), x + 90, y + 14);
        button(S, 'join:' + r.code, x + w - 150, y, 150, 56, 'Join', () => join(r.code), { primary: true });
        y += 70;
      }
      button(S, 'start', x, y + 6, (w - 16) / 2, 64, 'Start a room', () => create(), { primary: true, px: 25 });
      button(S, 'refresh', x + (w + 16) / 2, y + 6, (w - 16) / 2, 64, 'Refresh', () => listRooms(), { px: 25 });
      y += 92; line();
    } else if (PNL.page === 'add') {
      label('Add a station here: which story?');
      const bw = (w - 16) / 2;
      HOST.list.forEach((m, i) => {
        const bx = x + (i % 2) * (bw + 16), by = y + Math.floor(i / 2) * 72;
        button(S, 'add:' + m.key, bx, by, bw, 60, m.title, () => { add(m.key); PNL.page = 'main'; }, { color: m.col, px: 25 });
      });
      y += Math.ceil(HOST.list.length / 2) * 72 + 8;
      button(S, 'add:cancel', x, y, 200, 58, 'Cancel', () => { PNL.page = 'main'; });
      y += 82; line();
    } else {
      const bw = (w - 16) / 2, cal = R.state === 'mark-a' || R.state === 'mark-b';
      if (askHere()) {
        // in VR, once per room: are you with the others (calibrate, share their room) or somewhere else?
        label('One question', '#ffb43b');
        ctx.font = FONT(26, 700); ctx.fillStyle = INK; y += wrapText(ctx, 'Are you in the same room as the others?', x, y, w, 34, 2) + 4;
        ctx.font = FONT(21); ctx.fillStyle = MUTED;
        y += wrapText(ctx, 'In this room: calibrate, and the stations stand where the others see them. Somewhere else: they stand round you.', x, y, w, 28, 3) + 12;
        button(S, 'ask:in', x, y, bw, 60, 'In this room', () => setHere(true), { primary: true });
        button(S, 'ask:away', x + bw + 16, y, bw, 60, 'Somewhere else', () => setHere(false));
        y += 84; line();
      } else {
        label('The room');
        ctx.font = FONT(22); ctx.fillStyle = MUTED;
        ctx.fillText(fit(ctx, here() ? 'You are in the room with the others.' : 'You are elsewhere: the stations stand round you.', w), x, y); y += 36;
        if (here()) button(S, 'cal', x, y, bw, 60, cal ? 'Stop calibrating' : 'Calibrate', () => (cal ? R.cancel() : R.calibrate()), { on: cal });
        else button(S, 'cal', x, y, bw, 60, 'Calibrate', null);
        button(S, 'here', x + bw + 16, y, bw, 60, here() ? 'Say I am elsewhere' : 'Say I am in this room', () => setHere(!here()), { px: 22 });
        y += 76;
        if (here()) {
          ctx.font = FONT(21); ctx.fillStyle = MUTED; ctx.fillText(fit(ctx, sharedLine(), w), x, y); y += 34;
          const fa = forgetArmed();
          button(S, 'forget', x, y, bw, 56, fa ? 'Forget? Press again' : 'Forget calibration', R.saved || R.frame ? forgetAsk : null,
            { px: 22, color: fa ? '#ffb43b' : undefined, on: fa });
          y += 72;
        }
      }
      label('Stations');
      const mine = C.stById.get(C.mine), arm = mine && armed(mine.id);
      ctx.font = FONT(24); ctx.fillStyle = INK;
      ctx.fillText(fit(ctx, mine ? 'Yours: ' + meta(mine.story).title : C.st.length ? 'Walk up to one, or point at its card' : 'None yet: Arrange all puts the seven stories in front of you', w), x, y); y += 40;
      button(S, 'move', x, y, bw, 60, 'Move here', mine ? () => move(mine.id) : null);
      button(S, 'addpage', x + bw + 16, y, bw, 60, 'Add here', () => { PNL.page = 'add'; });
      y += 72;
      button(S, 'arrange', x, y, bw, 60, 'Arrange all', () => arrange());
      button(S, 'remove', x + bw + 16, y, bw, 60, arm ? 'Remove for everyone?' : 'Remove', mine ? () => removeAsk(mine.id) : null, { px: arm ? 21 : 24, color: arm ? '#ffb43b' : undefined, on: arm });
      y += 84; line();
      label('People');
      // as many as fit above "You" (152 px); the rest as a count
      const fitN = Math.max(1, Math.floor((S.h - y - 152 - 26) / 38)), shown = C.members.length > fitN ? fitN - 1 : fitN;
      for (const m of C.members.slice(0, Math.max(0, shown))) {
        const P = m.id === C.id ? { st: C.mine } : C.pres.get(m.id), s = P && C.stById.get(P.st);
        ctx.fillStyle = m.color || INK; rr(ctx, x, y + 4, 22, 22, 6); ctx.fill();
        ctx.font = FONT(24, m.id === C.id ? 700 : 400); ctx.fillStyle = INK;
        ctx.fillText(fit(ctx, (m.name || 'Someone') + (m.id === C.id ? ' (you)' : ''), 250), x + 36, y);
        ctx.font = FONT(21); ctx.fillStyle = MUTED;
        ctx.fillText(fit(ctx, ({ ar: 'headset', vr: 'headset (VR)', desktop: 'screen' }[m.kind] || '') + (m.kind !== 'desktop' ? (m.here ? ', here' : ', elsewhere') : '') + (s ? ' · ' + meta(s.story).title : ''), w - 300), x + 300, y + 2);
        y += 38;
      }
      if (C.members.length > shown) { ctx.font = FONT(21); ctx.fillStyle = MUTED; ctx.fillText(`and ${C.members.length - shown} more`, x + 36, y + 2); y += 38; }
      y += 8; line();
    }
    // you: your name and colour (headsets cannot type: Another name picks one)
    label('You');
    ctx.font = FONT(26, 700); ctx.fillStyle = C.color; ctx.fillText(fit(ctx, C.name, 260), x, y + 14);
    button(S, 'name', x + 280, y, 220, 56, 'Another name', () => setMe({ name: any(NAMES.filter(s => s !== C.name)) }), { px: 22 });
    if (C.code) button(S, 'leave', x + w - 140, y, 140, 56, 'Leave', () => leave(), { px: 22 });
    y += 70;
    COLORS.forEach((c, i) => {
      const bx = x + i * 78;
      rr(ctx, bx, y, 62, 46, 10); ctx.fillStyle = c; ctx.fill();
      if (c === C.color || OV.panel.hover === 'col:' + i) { ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); }
      S.regions.push({ id: 'col:' + i, x: bx, y, w: 62, h: 46, fn: () => setMe({ color: c }) });
    });
    S.tex.needsUpdate = true;
  }
  function connLine() {
    return { open: 'connected', connecting: 'connecting...', refused: 'refused', off: 'not connected' }[C.status] || C.status;
  }
  function setMe(o) {
    if (o.name) { C.name = String(o.name).slice(0, 32); put('collabName', C.name); }
    if (o.color) { C.color = o.color; put('collabColor', C.color); }
    hello(); changed();
  }
  // in the room with the others or elsewhere, kept for this room code (asked once in VR)
  function setHere(on) {
    C.hereSet = !!on; log('here', { here: C.hereSet });
    if (C.code) { const H = heres(), keep = Object.keys(H).filter(k => k !== C.code).slice(-19); const o = {}; for (const k of keep) o[k] = H[k]; o[C.code] = C.hereSet; put('collabHere', J(o)); }
    hello(); R.realign(); changed();
  }

  // notices: a small panel in front of you that closes by itself ("Aligned automatically", "Calibrate the room")
  const NOTE = { title: '', text: '', until: 0, sig: '' };
  function notice(title, text, ms) {
    NOTE.title = title; NOTE.text = text || ''; NOTE.until = ms === 0 ? Infinity : performance.now() + (ms || 4500);
    log('notice', { title });
  }
  function drawNote(head, hq) {
    const S = OV.note, on = performance.now() < NOTE.until && !!head;
    S.mesh.visible = on;
    if (!on) return;
    const sig = NOTE.title + NOTE.text;
    if (sig !== S.sig) {
      S.sig = sig;
      const ctx = S.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, S.w, S.h); ctx.textBaseline = 'top';
      rr(ctx, 0, 0, S.w, S.h, 24); ctx.fillStyle = 'rgba(8,15,28,0.94)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = CYAN; ctx.stroke();
      ctx.font = FONT(34, 700); ctx.fillStyle = INK; ctx.fillText(fit(ctx, NOTE.title, S.w - 60), 30, 24);
      ctx.font = FONT(24); ctx.fillStyle = MUTED; wrapText(ctx, NOTE.text, 30, 76, S.w - 60, 31, 3);
      S.tex.needsUpdate = true;
    }
    // a metre ahead and a little below eye level, turned to you (eased, so it does not shake with your head)
    _v.set(0, -0.22, -1).applyQuaternion(hq).add(head);
    if (!S.placed) { S.mesh.position.copy(_v); S.placed = true; } else S.mesh.position.lerp(_v, 0.08);
    S.mesh.lookAt(head);
  }

  // ----------------------------------------- pointing (the stories' pointer code) --
  // HOST.collab.ray(i, o, d, near): controller i's ray (scene coordinates), after the story has raycast its own
  // panels (near: how far the nearest one is along the ray, or Infinity) and before its scene. A hit on the
  // shell's things nearer than that returns { kind: 'shell', point, dist } (the story draws its dot there and
  // sends the press to HOST.collab.press(i)); a story panel in front wins, and the shell's things always beat
  // the scene behind them. While calibrating, a ray that misses the shell's panel marks the room.
  function ray(i, o, d, near) {
    let h = C.rays.get(i);
    if (!h) C.rays.set(i, (h = { o: new THREE.Vector3(), d: new THREE.Vector3(), at: 0 }));
    h.o.copy(o); h.d.copy(d); h.at = performance.now(); h.n = C.frameN;
    if (!OV.root || !OV.root.visible || !OV.root.parent) return null;
    RC.set(o, d); RC.far = 30;   // a station across a large room can be picked too
    const hits = RC.intersectObjects(R.calib ? OV.hit.filter(m => m === OV.panel.mesh) : OV.hit, false);
    for (const x of hits) {
      const t = x.object.userData.shell;
      if (!t) continue;
      if (!R.calib && near != null && x.distance > near) break;   // the story's own panel is in front
      const S = x.object.userData.sheet;
      C.hov.set(i, { target: t, x: S && x.uv ? x.uv.x * S.w : 0, y: S && x.uv ? (1 - x.uv.y) * S.vis : 0, at: h.at });
      return { kind: 'shell', point: x.point, dist: x.distance };
    }
    // calibrating: the trigger anywhere else takes a mark at the controller's tip
    if (R.calib) { C.hov.set(i, { target: { kind: 'mark' }, at: h.at }); return { kind: 'shell', point: _v2.copy(d).multiplyScalar(0.03).add(o).clone(), dist: 0.03 }; }
    C.hov.set(i, null);
    return null;
  }
  // what controller i points at now (a hover older than a few frames is gone: the controller left)
  const hovOf = i => { const h = C.hov.get(i); return h && performance.now() - h.at < 250 ? h : null; };
  function press(i) {
    const h = hovOf(i);
    if (R.calib && !(h && h.target.kind === 'panel')) { R.mark(i); return; }   // the panel's Stop calibrating still works
    if (!h) return;
    if (h.target.kind === 'panel') { const r = OV.panel.at(h.x, h.y); if (r && r.fn) { log('panel', { id: r.id }); r.fn(); OV.panel.sig = ''; } }
    else if (h.target.kind === 'station') choose(h.target.id, 'pick');
  }

  // ---------------------------------------------------------- every frame --
  // From the shell's own frame callback in a headset (and from HOST.anchor.frame, which every story calls):
  // the room frame, your head in the room, your station, presence, the sound zone and the overlay
  const HD = { p: new THREE.Vector3(), q: new THREE.Quaternion(), ok: false };
  function tick(f) {
    const t = performance.now(), dt = Math.min(0.1, (t - (C.tickAt || t)) / 1000);
    C.tickAt = t; C.frameN = (C.frameN || 0) + 1;
    attachCheck();
    const local = refSpace();
    HD.ok = false;
    if (f && local) {
      let vp = null;
      try { vp = f.getViewerPose(local); } catch (e) { /* not in this frame */ }
      if (vp) { const p = vp.transform.position, q = vp.transform.orientation; HD.p.set(p.x, p.y, p.z); HD.q.set(q.x, q.y, q.z, q.w); HD.ok = true; }
    }
    if (C.code) R.update(f);
    R.headOK = false;
    if (C.code && R.aligned && HD.ok) {
      R.hr.copy(HD.p).applyMatrix4(R.mi);
      _v.set(0, 0, -1).applyQuaternion(HD.q).transformDirection(R.mi);
      R.hyaw = Math.atan2(-_v.x, -_v.z); R.headOK = true;
      zoneStep(t);
      presenceOut(t);
    }
    soundZone();
    // in VR, once per room: the shell's panel opens with its question (in the room with the others, or elsewhere?)
    if (HOST.session && askHere() && PNL.asked !== C.code && OV.root && OV.root.visible) {
      PNL.asked = C.code; PNL.open = true; PNL.page = 'main';
      notice('One question', 'Are you in the same room as the others? Answer on the Shared panel, left of the story panel.', 9000);
    }
    drawOverlay(dt);
    pump();
  }
  // your station by where you stand: the nearest within 1.1 m for a second (or one you picked) until you
  // walk into another one; you leave it beyond 1.5 m (the live story stays where it is)
  function zoneStep(t) {
    const x = R.hr.x, z = R.hr.z, dist = s => Math.hypot(s.x - x, s.z - z);
    const Z = C.zone && C.stById.get(C.zone);
    if (Z && dist(Z) > FAR) { C.zone = ''; if (!C.picked) C.mine = ''; log('zone left', { st: Z.id }); changed(); }
    let best = null, bd = NEAR;
    for (const s of C.st) { const d = dist(s); if (d < bd) { bd = d; best = s; } }
    const zd = C.zone && C.stById.get(C.zone) ? dist(C.stById.get(C.zone)) : Infinity;
    const cand = best && best.id !== C.zone && bd < zd ? best.id : '';
    if (cand !== C.cand) { C.cand = cand; C.candAt = t; }
    if (cand && t - C.candAt >= DWELL) {
      C.zone = cand; C.cand = '';
      log('zone', { st: cand });
      choose(cand, 'walk');
    }
  }
  function presenceOut(t) {
    if (t - C.presAt < 66) return;   // 15 a second
    C.presAt = t;
    _q.setFromRotationMatrix(_m.extractRotation(R.mi)).multiply(HD.q);
    const head = [r3(R.hr.x), r3(R.hr.y), r3(R.hr.z), r3(_q.x), r3(_q.y), r3(_q.z), r3(_q.w)], hands = [];
    for (const [i, h] of C.rays) {
      if (C.frameN - h.n > 2) continue;   // a controller the story no longer points with (counted in frames: a slow frame is no reason)
      let len = 0;
      try { len = C.hook && C.hook.hover ? +C.hook.hover(i) || 0 : 0; } catch (e) { /* story not ready */ }
      _v.copy(h.o).applyMatrix4(R.mi); _v2.copy(h.d).transformDirection(R.mi);
      hands.push([r3(_v.x), r3(_v.y), r3(_v.z), r3(_v2.x), r3(_v2.y), r3(_v2.z), r3(len)]);
    }
    fx('p.' + C.id, { st: C.mine || '', head, hands });
  }
  // the narration comes from the live station's content and fades with distance (nothing changes outside a room)
  const ZN = { p: [0, 0, 0], head: [0, 0, 0], f: [0, 0, 0], u: [0, 0, 0] }, _u = new THREE.Vector3();
  function soundZone() {
    const L = liveSt();
    if (!C.code || !HD.ok || !R.placing() || !L) { HOST.audio.zone(null); return; }
    const [cx, cz] = content(L);
    _v.set(cx, 1.4, cz).applyMatrix4(R.m).toArray(ZN.p);
    HD.p.toArray(ZN.head);
    _v2.set(0, 0, -1).applyQuaternion(HD.q).toArray(ZN.f);
    _u.set(0, 1, 0).applyQuaternion(HD.q).toArray(ZN.u);
    HOST.audio.zone(ZN);
  }
  function drawOverlay(dt) {
    if (!OV.root) return;
    const xr = !!HOST.session && !!OV.root.parent;
    OV.root.visible = xr;
    if (!xr) return;
    OV.room.visible = !!C.code && R.aligned;
    HOV.length = 0;
    for (const i of C.hov.keys()) { const h = hovOf(i); if (h) HOV.push(h); }
    if (OV.room.visible) {
      OV.room.matrix.copy(R.m);
      drawPreviews();
      drawPeople(dt);
    }
    // the panel, beside the story's own (its pose from the story, every frame)
    const t = performance.now();
    const showPanel = !!(C.code || C.relay);
    if (showPanel) {
      let p = null;
      try { p = HOST.cur && HOST.cur.xrPose(); } catch (e) { /* not ready */ }
      OV.panelG.visible = !!p;
      if (p) {
        // to the left of the story panel (0.62 m wide), turned a little more towards you
        const a = 0.42;
        _v.set(-0.31 - 0.02 - 0.21 * Math.cos(a), 0.36, 0.21 * Math.sin(a)).applyAxisAngle(_Y, p.pr).add(p.pp);
        OV.panelG.position.copy(_v).applyQuaternion(p.rq).add(p.rp);
        OV.panelG.quaternion.copy(p.rq).multiply(_q.setFromAxisAngle(_Y, p.pr + a));
      }
    } else OV.panelG.visible = false;
    if (OV.panelG.visible) {
      OV.panel.hover = null;
      for (const h of HOV) if (h.target.kind === 'panel') { const r = OV.panel.at(h.x, h.y); if (r) OV.panel.hover = r.id; }
      drawPanel();
      if (PNL.open && !C.code && t - C.roomsAt > 4000) listRooms();
    }
    drawNote(HD.ok ? HD.p : null, HD.q);
    // what the controllers can point at
    OV.hit.length = 0;
    if (OV.panelG.visible) OV.hit.push(OV.panel.mesh);
    if (OV.room.visible) {
      for (const o of OV.cards.values()) OV.hit.push(o.mesh);
      for (const o of OV.rings.values()) if (o.ring.userData.shell) OV.hit.push(o.ring);
    }
    OV.root.updateMatrixWorld(true);
  }
  const refSpace = () => { try { return HOST.renderer && HOST.renderer.xr.getReferenceSpace(); } catch (e) { return null; } };

  // =========================================================== the room frame ==
  // HOST.room. The renderer keeps the 'local' reference space; the shell asks the session for 'local-floor'
  // and 'shared' spaces of its own. The room frame (an origin on the floor and a level x axis) is kept in
  // local-floor coordinates and turned into room -> local every frame. Alignment (shared-spaces.md, section 4):
  //  1. a shared space: adopt the frame published for its id; if none comes within 8 s, publish ours (our
  //     saved marks, else the space's own origin); reconcile twice a second (3 cm / 1 degree)
  //  2. else this headset's marks from last time: the persistent anchor made at mark A, else the saved coordinates
  //  3. else calibrate: touch mark A with a controller and pull the trigger, then mark B
  // People elsewhere (VR, `here` false) and desktops never calibrate: their room is their own floor, facing
  // where they faced when they joined.
  const R = {
    session: null, begun: null, loopFor: null, floor: null, noFloor: false, shared: null, sharedId: '', sharedAt: 0, sharedAsked: 0, sharedOK: false,
    frame: null, src: '', state: 'off', aligned: false, calib: null, recAt: 0, pubAt: 0, noticed: '',
    saved: null, anchor: null, anchorBusy: false, anchorTried: false, anchorSince: 0, wantAnchor: null,
    mgen: 0,   // the marks' generation: an anchor that arrives for older marks (forgotten, replaced) is thrown away
    lf: new THREE.Matrix4(), lfi: new THREE.Matrix4(), ls: new THREE.Matrix4(), fr: new THREE.Matrix4(), m: new THREE.Matrix4(), mi: new THREE.Matrix4(),
    yaw: 0, hr: new THREE.Vector3(), hyaw: 0, headOK: false, lfOK: false,
  };
  try { R.saved = JSON.parse(get('roomFrame') || 'null'); } catch (e) { R.saved = null; }
  const storeSaved = () => put('roomFrame', R.saved ? J(R.saved) : null);
  const sharedIdOf = s => (s && (s.UUId || s.uuid || s.UUID)) || '';
  const level = x => { const l = Math.hypot(x[0], x[2]); return l > 1e-6 ? [x[0] / l, 0, x[2] / l] : null; };
  const yawOfX = x => Math.atan2(-x[2], x[0]);   // the x axis (cos a, 0, -sin a) of a turn by a about y
  // floor <- room, from the frame's origin and x axis (y up, z = x cross y)
  function basis(fr, out) {
    const x = _v.fromArray(fr.x), z = _v2.crossVectors(x, _Y);
    return out.makeBasis(x, _Y, z).setPosition(fr.o[0], fr.o[1], fr.o[2]);
  }
  function setState(s) { if (R.state !== s) { R.state = s; log('align', { state: s }); changed(); } }
  function setFrame(fr, src, title, text) {
    const x = level(fr.x);
    if (!x) return;
    R.frame = { o: [fr.o[0], 0, fr.o[2]], x };
    R.src = src;
    setState(src);
    log('frame', { src, o: R.frame.o.map(r3), x: x.map(r3) });
    if (title) notice(title, text);
  }
  // the session's spaces: asked when a headset session runs in a room
  function begin() {
    const s = R.session;
    if (!s || !C.code || R.begun === s) return;
    // spaces asked for by an earlier join (leave and join again in one session) stop reporting here
    try { if (R.floor && R.floor.removeEventListener) R.floor.removeEventListener('reset', floorReset); } catch (e) { /* gone */ }
    try { if (R.shared && R.shared.removeEventListener) R.shared.removeEventListener('reset', sharedReset); } catch (e) { /* gone */ }
    Object.assign(R, { begun: s, floor: null, noFloor: false, shared: null, sharedNo: false, sharedId: '', sharedAt: 0, sharedAsked: performance.now(), sharedOK: false,
      frame: null, src: '', aligned: false, calib: null, anchor: null, anchorBusy: false, anchorTried: false, wantAnchor: null, noticed: '', mgen: R.mgen + 1 });
    setState('waiting');
    const feats = s.enabledFeatures ? [...s.enabledFeatures] : null;
    log('session', { mode: HOST.mode, features: feats });
    const ask = type => new Promise((res, rej) => { try { Promise.resolve(s.requestReferenceSpace(type)).then(res, rej); } catch (e) { rej(e); } });
    ask('local-floor').then(sp => {
      if (R.session !== s) return;
      R.floor = sp;
      if (sp && sp.addEventListener) quiet(() => sp.addEventListener('reset', floorReset));
      log('space', { type: 'local-floor' });
    }, e => { if (R.session !== s) return; R.noFloor = true; log('space refused', { type: 'local-floor', e: e && e.message }); });
    if (!feats || feats.includes('shared')) ask('shared').then(sp => {
      if (R.session !== s || !sp) return;
      R.shared = sp;
      if (sp.addEventListener) quiet(() => sp.addEventListener('reset', sharedReset));
      R.sharedId = sharedIdOf(sp); if (R.sharedId) R.sharedAt = performance.now();
      let props = [];
      try { props = Object.getOwnPropertyNames(Object.getPrototypeOf(sp)).concat(Object.keys(sp)); } catch (e) { /* host object */ }
      log('space', { type: 'shared', id: R.sharedId, props });
    }, e => { if (R.session === s) R.sharedNo = true; log('space refused', { type: 'shared', e: e && e.message }); });
    else { R.sharedNo = true; log('space', { type: 'shared', granted: false }); }
  }
  function floorReset(ev) {
    const sp = ev && (ev.referenceSpace || ev.target);
    if (sp && sp !== R.floor) return;   // an older space of ours
    const tr = ev && ev.transform;
    log('reset', { space: 'local-floor', transform: !!tr });
    if (!tr) return;   // without a transform nothing moves (local-floor is the room's own origin)
    // the frame (and the saved marks) in the new coordinates: the transform is the new origin seen from the old
    _m.fromArray(tr.inverse ? tr.inverse.matrix : new THREE.Matrix4().fromArray(tr.matrix).invert().toArray());
    const move = fr => { const o = _v.fromArray(fr.o).applyMatrix4(_m).toArray(), x = _v.fromArray(fr.x).transformDirection(_m).toArray(); fr.o = [o[0], 0, o[2]]; fr.x = level(x) || fr.x; };
    if (R.frame) move(R.frame);
    if (R.saved && /^(marks|saved|anchor)$/.test(R.src)) { move(R.saved); storeSaved(); }
  }
  function sharedReset(ev) {
    const id = sharedIdOf(R.shared);
    log('reset', { space: 'shared', id, transform: !!(ev && ev.transform) });
    if (id !== R.sharedId) { R.sharedId = id; R.sharedAt = performance.now(); R.recAt = 0; }
  }
  // floor <- shared, this frame (only inside the frame callback)
  function floorFromShared(out) { return out.multiplyMatrices(R.lfi, R.ls); }
  // a frame given in shared coordinates, in ours (floor)
  function fromShared(P) {
    const M = floorFromShared(new THREE.Matrix4());
    return { o: new THREE.Vector3().fromArray(P.o).applyMatrix4(M).toArray(), x: new THREE.Vector3().fromArray(P.x).transformDirection(M).toArray() };
  }
  function toShared(fr) {
    const M = floorFromShared(new THREE.Matrix4()).invert();
    return { o: new THREE.Vector3().fromArray(fr.o).applyMatrix4(M).toArray().map(r3), x: new THREE.Vector3().fromArray(fr.x).transformDirection(M).toArray().map(r3) };
  }
  const marksAt = () => (/^(marks|saved|anchor)$/.test(R.src) && R.saved ? R.saved.at || 0 : 0);
  function publishFrame() {
    if (!R.frame || !R.sharedId || !R.sharedOK) return;
    const S = toShared(R.frame);
    R.pubAt = performance.now();
    publish([['roomFrameShared', { uuid: R.sharedId, o: S.o, x: S.x, by: C.id, at: marksAt() || Math.round(now()), src: R.src }]]);
    log('frame published', { uuid: R.sharedId, src: R.src });
  }
  // keep to the frame published for our shared space: adopt it when ours differs by more than 3 cm or a
  // degree, unless our own marks are newer, in which case ours goes out and the others follow
  function reconcile(P) {
    const F = fromShared(P), x = level(F.x);
    if (!x) return;
    if (!R.frame) { setFrame(F, 'adopted', 'Aligned automatically', 'This headset found the shared space and took the room from it.'); return; }
    const d = Math.hypot(F.o[0] - R.frame.o[0], F.o[2] - R.frame.o[2]);
    let a = Math.abs(yawOfX(x) - yawOfX(R.frame.x)) % (2 * Math.PI);
    if (a > Math.PI) a = 2 * Math.PI - a;
    if (d <= 0.03 && a <= Math.PI / 180) return;
    if (marksAt() > (+P.at || 0) && P.by !== C.id) { log('reconcile', { keep: 'ours', d: r3(d), a: r3(a) }); publishFrame(); return; }
    if (P.by === C.id && performance.now() - R.pubAt < 3000) return;   // our own, just published
    log('reconcile', { keep: 'theirs', d: r3(d), a: r3(a) });
    setFrame(F, 'adopted', 'Re-aligned', 'The room frame changed: things moved to where the others see them.');
  }
  function anchorFrame(f) {
    if (!R.anchor || !R.floor) return null;
    if (f.trackedAnchors && !f.trackedAnchors.has(R.anchor)) return null;
    let p = null;
    try { p = f.getPose(R.anchor.anchorSpace, R.floor); } catch (e) { /* lost */ }
    if (!p) return null;
    const t = p.transform.position, q = p.transform.orientation, yaw = Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));
    return { o: [t.x, 0, t.z], x: [Math.cos(yaw), 0, -Math.sin(yaw)] };
  }
  // this headset's marks from last time: the anchor at mark A (it survives a moved Guardian), else the coordinates
  function fromSaved(f, t) {
    const S = R.saved;
    if (S.anchor && !R.anchorTried && HOST.anchor.find) {
      R.anchorTried = true; R.anchorBusy = true; R.anchorSince = t;
      const s = R.session, g = R.mgen;
      HOST.anchor.find(S.anchor).then(a => { if (R.session === s && R.mgen === g) R.anchor = a; else try { a.delete(); } catch (e) { /* gone */ } },
        e => log('anchor not found', { e: e && e.message })).then(() => { if (R.mgen === g) R.anchorBusy = false; });
    }
    const A = anchorFrame(f);
    if (A) { setFrame(A, 'anchor', 'Room calibration from last time', 'Found the mark this headset saved.'); return; }
    if ((R.anchorBusy || R.anchor) && t - R.anchorSince < 8000) { setState('restoring'); return; }
    setFrame({ o: S.o, x: S.x }, 'saved', 'Room calibration from last time', 'If things look out of place, calibrate again.');
  }
  // remote people and VR: their own floor, centred where they stand, facing where they face
  function ownFrame(f, local) {
    if (R.src === 'own' && R.frame) return;
    let vp = null;
    try { vp = f.getViewerPose(local); } catch (e) { /* not now */ }
    if (!vp) return;
    const p = vp.transform.position, q = vp.transform.orientation;
    const hp = _v.set(p.x, p.y, p.z).applyMatrix4(R.lfi);
    const d = _v2.set(0, 0, -1).applyQuaternion(_q.set(q.x, q.y, q.z, q.w)).transformDirection(R.lfi), yaw = Math.atan2(-d.x, -d.z);
    setFrame({ o: [hp.x, 0, hp.z], x: [Math.cos(yaw), 0, -Math.sin(yaw)] }, 'own', askHere() ? '' : 'Joined from elsewhere',
      'The stations stand round you as they stand in the room. In the room with the others after all? Say so on the Shared panel.');
  }
  function align(f, local) {
    const t = performance.now();
    if (R.calib) return;   // calibrating: the old frame (if any) holds until both marks are in
    if (!here()) { ownFrame(f, local); return; }
    if (R.src === 'own') { R.frame = null; R.src = ''; }
    const sp = !!(R.shared && R.sharedOK && R.sharedId), P = val('roomFrameShared');
    // (1) a frame published for our shared space
    if (sp && P && P.uuid === R.sharedId && Array.isArray(P.o) && Array.isArray(P.x)) {
      // our marks are newer: they go out (once restored: the anchor may take a few seconds)
      if (!R.frame && R.saved && (R.saved.at || 0) > (+P.at || 0)) { fromSaved(f, t); if (!R.frame) return; }
      if (t - R.recAt > 500) { R.recAt = t; reconcile(P); }
      return;
    }
    // (2) our marks from last time
    if (!R.frame && R.saved && Array.isArray(R.saved.o) && Array.isArray(R.saved.x)) fromSaved(f, t);
    else if (R.frame && /^(anchor|saved|marks)$/.test(R.src) && R.anchor && t - R.recAt > 500) {
      // the anchor keeps the frame where the marks are, even if the Guardian origin moved
      R.recAt = t;
      const A = anchorFrame(f);
      if (A && (Math.hypot(A.o[0] - R.frame.o[0], A.o[2] - R.frame.o[2]) > 0.03 || Math.abs(yawOfX(A.x) - yawOfX(R.frame.x)) > Math.PI / 180)) setFrame(A, R.src);
    }
    // waiting a little for the shared space's id, or for someone's published frame
    if (R.shared && !R.frame && t - (R.sharedId ? R.sharedAt : R.sharedAsked) < 8000) { setState('shared-wait'); return; }
    // (1b) nobody published for this space (or the publisher left): ours goes out, or the space's own origin
    if (sp && t - R.pubAt > 2000) {
      const other = P && P.uuid !== R.sharedId && P.by !== C.id && !!member(P.by);   // another group, still here: leave it
      if (!other) {
        if (!R.frame) setFrame(fromShared({ o: [0, 0, 0], x: [1, 0, 0] }), 'shared', 'Shared space found', 'This headset defines the room for the others.');
        publishFrame();
      }
    }
    if (!R.frame && R.state !== 'restoring') {
      setState('calibrate');
      if (R.noticed !== 'calibrate') { R.noticed = 'calibrate'; notice('Calibrate the room', 'Open the Shared panel and press Calibrate: touch mark A, then mark B, with the tip of a controller. Tape crosses on a table or the floor work well.', 9000); }
    }
  }
  function update(f) {
    if (!R.session || !C.code || !f) return;
    begin();
    const local = refSpace();
    if (!local) return;
    // the floor: local-floor's pose in the story's local space (or 1.6 m below where the session began)
    R.lfOK = false;
    if (R.floor) {
      let p = null;
      try { p = f.getPose(R.floor, local); } catch (e) { /* not now */ }
      if (!p) return;
      R.lf.fromArray(p.transform.matrix);
    } else if (R.noFloor) R.lf.makeTranslation(0, -EYE, 0);
    else return;   // still asking
    R.lfi.copy(R.lf).invert(); R.lfOK = true;
    R.sharedOK = false;
    if (R.shared) {
      const id = sharedIdOf(R.shared);
      if (id && id !== R.sharedId) { R.sharedId = id; R.sharedAt = performance.now(); log('shared id', { id }); }
      let p = null;
      try { p = f.getPose(R.shared, local); } catch (e) { /* not now */ }
      if (p) { R.ls.fromArray(p.transform.matrix); R.sharedOK = true; }
    }
    align(f, local);
    // a new anchor at mark A (asked inside a frame, as WebXR wants)
    if (R.wantAnchor && R.floor && HOST.anchor.keep) {
      const w = R.wantAnchor, s = R.session, g = R.mgen;
      R.wantAnchor = null;
      HOST.anchor.keep(f, R.floor, w.p, w.q, '').then(r => {
        if (R.session !== s || R.mgen !== g) {   // the marks were forgotten or replaced meanwhile
          try { r.anchor.delete(); } catch (e) { /* gone */ }
          if (r.uuid) HOST.anchor.drop(r.uuid);
          return;
        }
        R.anchor = r.anchor;
        if (r.uuid && R.saved) { R.saved.anchor = r.uuid; storeSaved(); }
        log('anchor made', { saved: !!r.uuid });
      }, e => log('no anchor', { e: e && e.message }));
    }
    if (!R.frame) { R.aligned = false; return; }
    basis(R.frame, R.fr);
    R.m.multiplyMatrices(R.lf, R.fr); R.mi.copy(R.m).invert();
    R.yaw = Math.atan2(-R.m.elements[2], R.m.elements[0]);
    if (!R.aligned) { R.aligned = true; log('aligned', { src: R.src }); changed(); }
  }
  // two-point calibration: mark A gives the origin, A -> B the direction, gravity the rest
  function calibrate() {
    if (!R.session || !C.code || !here()) return;
    R.calib = { step: 'a', a: null };
    setState('mark-a');
    notice('Calibrate the room', 'Touch mark A with the tip of a controller and pull the trigger.', 0);
    log('calibrate');
  }
  function cancel() { if (!R.calib) return; R.calib = null; NOTE.until = 0; setState(R.frame ? R.src : 'calibrate'); log('calibrate cancelled'); }
  // Forget calibration: this headset's saved marks and their anchor go, and it aligns again from the start
  // (the shared space first, if there is one; else it asks to calibrate)
  function forgetMarks() {
    if (R.saved && R.saved.anchor) HOST.anchor.drop(R.saved.anchor);
    if (R.anchor) { try { R.anchor.delete(); } catch (e) { /* gone */ } }
    R.saved = null; storeSaved();
    Object.assign(R, { frame: null, src: '', aligned: false, anchor: null, anchorBusy: false, anchorTried: false, wantAnchor: null, calib: null, noticed: '', recAt: 0, mgen: R.mgen + 1 });
    const t = performance.now(); R.sharedAsked = t; if (R.sharedId) R.sharedAt = t;
    setState('waiting');
    notice('Calibration forgotten', 'This headset lines up again: from the frame the room holds for its shared space, else it asks you to calibrate.', 6000);
    log('forget marks');
  }
  // the shared space, to compare headsets: the same id on each means they share one room
  function sharedLine() {
    if (!R.session || !C.code) return '';
    if (R.sharedId) return 'Shared space ' + R.sharedId.slice(0, 8) + ': the same on every headset?';
    if (R.shared) return 'Shared space: waiting for its id...';
    return R.sharedNo ? 'No shared space (check the WebXR flag, spatial services)' : 'Shared space: asking...';
  }
  const FG = { until: 0 };   // Forget calibration takes two presses: the first arms it for 3 s
  const forgetArmed = () => performance.now() < FG.until;
  function forgetAsk() {
    if (forgetArmed()) { FG.until = 0; forgetMarks(); return; }
    FG.until = performance.now() + 3000; setTimeout(changed, 3050); changed();
  }
  function mark(i) {
    const h = C.rays.get(i);
    if (!R.calib || !h || !R.lfOK) return;
    const p = h.o.clone().applyMatrix4(R.lfi);   // the controller's target-ray origin, in local-floor coordinates
    log('mark', { step: R.calib.step, p: p.toArray().map(r3) });
    if (R.calib.step === 'a') { R.calib.a = p; R.calib.step = 'b'; setState('mark-b'); notice('Mark A taken', 'Now touch mark B, as far from A as you can, and pull the trigger.', 0); return; }
    const a = R.calib.a, dx = p.x - a.x, dz = p.z - a.z;
    if (Math.hypot(dx, dz) < 0.3) { notice('Marks too close', 'Mark B must be at least 30 cm from mark A. Touch mark B again.', 0); return; }
    R.calib = null;
    const fr = { o: [a.x, 0, a.z], x: level([dx, 0, dz]) };
    // the old marks' anchor goes now: it would pull the new frame back to the old mark A until the new one is made
    if (R.saved && R.saved.anchor) HOST.anchor.drop(R.saved.anchor);
    if (R.anchor) { try { R.anchor.delete(); } catch (e) { /* gone */ } }
    R.anchor = null; R.anchorBusy = false; R.mgen++;
    R.saved = { o: fr.o.map(r3), x: fr.x.map(r3), a: a.toArray().map(r3), b: p.toArray().map(r3), at: Math.round(now()), anchor: '' };
    storeSaved();
    setFrame(R.saved, 'marks', 'Room calibrated', 'Everyone who calibrated with the same marks sees the stations in the same places.');
    R.wantAnchor = { p: { x: a.x, y: a.y, z: a.z }, q: new THREE.Quaternion().setFromAxisAngle(_Y, yawOfX(fr.x)) };
    if (R.shared && R.sharedId) publishFrame();
  }
  function status() {
    if (!C.code) return '';
    if (!R.session) return kind() === 'desktop' ? '' : 'starting';
    return { waiting: 'asking the headset...', 'shared-wait': 'looking for the shared space...', restoring: 'finding last time\'s marks...',
      adopted: 'aligned automatically', shared: 'aligned to the shared space', marks: 'calibrated', saved: 'calibration from last time',
      anchor: 'calibration from last time', own: 'elsewhere: the room is round you', calibrate: 'not aligned: calibrate',
      'mark-a': 'touch mark A', 'mark-b': 'touch mark B' }[R.state] || R.state;
  }
  // the station's place for the story's rig: the spot at eye height, facing the station's way (local space)
  function place(f) {
    if (!C.code || !R.session) return null;
    if (f) update(f);
    const L = liveSt();
    if (!R.aligned || !L || L.story !== HOST.curKey) return null;
    _v.set(L.x, EYE, L.z).applyMatrix4(R.m);
    return { p: [_v.x, _v.y, _v.z], yaw: R.yaw + L.yaw };
  }
  const placing = () => { const L = liveSt(); return !!(C.code && R.session && R.aligned && L && L.story === HOST.curKey); };
  function panelPose(L) {
    const v = L && val(kPanel(L.id));
    return v ? { pp: [v.x, v.y - EYE, v.z], pr: v.yaw } : { pp: PANEL_HOME.p.slice(), pr: PANEL_HOME.yaw };
  }
  // for a story starting in a running session at a station (HOST.start): its rig and panel there
  function adopt(key) {
    const L = liveSt();
    if (!C.code || !R.session || !R.aligned || !L || L.story !== key) return null;
    const P = panelPose(L);
    return { rp: new THREE.Vector3(L.x, EYE, L.z).applyMatrix4(R.m), rq: new THREE.Quaternion().setFromAxisAngle(_Y, R.yaw + L.yaw),
      off: new THREE.Vector3(), pp: new THREE.Vector3().fromArray(P.pp), pr: P.pr };
  }
  // the headset session started (or ended): the shell's own frame callback, the spaces, the lifecycle guard
  function watch(s) {
    if (s === R.session) return;
    R.session = s; R.begun = null; R.aligned = false; R.frame = null; R.src = ''; R.calib = null;
    // what a story does by itself when a session starts or a headset wakes is not a person's action: not published
    holdTask();
    if (!s) { setState('off'); HOST.audio.zone(null); if (C.code) { hello(); connect(); } changed(); return; }
    quiet(() => s.addEventListener('visibilitychange', () => {
      holdTask();
      log('headset', { visibility: s.visibilityState });
      if (s.visibilityState === 'visible' && C.code) wake('headset');
    }));
    // the stories set HOST.mode just after HOST.session: say who we are once both are known
    setTimeout(() => { if (R.session === s && C.code) { hello(); connect(); begin(); } }, 0);
    if (!C.relay || C.served === null) detect();
    loop(s);
    changed();
  }
  function holdTask() { C.hush = true; setTimeout(() => { C.hush = false; }, 0); }
  function loop(s) {
    if (R.loopFor === s || typeof s.requestAnimationFrame !== 'function') return;
    R.loopFor = s;
    const cb = (time, f) => {
      if (R.session !== s) { R.loopFor = null; return; }
      s.requestAnimationFrame(cb);
      try { tick(f); } catch (e) { log('frame failed', { e: e.message }); }
    };
    try { s.requestAnimationFrame(cb); } catch (e) { R.loopFor = null; }
  }

  HOST.room = {
    get state() { return R.state; }, get aligned() { return R.aligned; }, get frame() { return R.frame; }, get src() { return R.src; },
    watch, update: f => update(f), place, placing, adopt, calibrate, cancel, mark, status, forget: forgetMarks, sharedLine,
    // the station's panel, for a story's xrRecenter while placed (off, pp, pr in its rig)
    saved: () => { const L = liveSt(), P = panelPose(L); return placing() ? { off: [0, 0, 0], pp: P.pp, pr: P.pr } : null; },
    joined() { if (R.session) { begin(); loop(R.session); } },
    left() { R.begun = null; R.frame = null; R.src = ''; R.aligned = false; R.calib = null; setState('off'); },
    realign() { if (R.src === 'own' || R.src === 'adopted' || R.src === 'shared' || !here()) { R.frame = null; R.src = ''; R.aligned = false; R.recAt = 0; } },
    tick, toRoom: v => v.clone().applyMatrix4(R.mi), toLocal: v => v.clone().applyMatrix4(R.m), matrix: () => R.m.clone(),
    get recAt() { return R.recAt; }, set recAt(v) { R.recAt = v; },
    internals: () => R,
  };
  // the session code above reaches the room frame through R
  Object.assign(R, { joined: HOST.room.joined, left: HOST.room.left, realign: HOST.room.realign, placing, status, update, calibrate, cancel, mark });

  // ============================================================ the page's dialog ==
  // The Shared button (top bar and Stories screen): the relay, the open rooms, your name and colour, and when
  // joined the room map (stations and people from above), Follow per station, Arrange all, Add, Remove.
  const DLG = { open: false, el: null, map: null };
  const $ = s => DLG.el.querySelector(s);
  function dialog(open) {
    DLG.el = DLG.el || document.getElementById('shared');
    if (!DLG.el) return;
    DLG.open = open;
    DLG.el.hidden = !open;
    document.querySelectorAll('[data-open-shared]').forEach(b => b.setAttribute('aria-expanded', open ? 'true' : 'false'));
    if (!open) return;
    if (!DLG.bound) bindDialog();
    $('#shRelay').value = C.relay.replace(/^http/, 'ws');
    $('#shName').value = C.name;
    detect().then(() => { if (!C.code) listRooms(); renderDialog(); });
    renderDialog();
    setTimeout(() => { const f = $(C.code ? '[data-sh="close"]' : C.relay ? '[data-sh="start"]' : '#shRelay'); if (f) f.focus(); }, 50);
  }
  function bindDialog() {
    DLG.bound = true;
    DLG.el.addEventListener('click', ev => {
      if (ev.target === DLG.el) { dialog(false); return; }
      const b = ev.target.closest('[data-sh]');
      if (!b) return;
      const [act, arg] = b.dataset.sh.split(':');
      if (act === 'close') dialog(false);
      else if (act === 'relay') { setRelay($('#shRelay').value, 'typed'); listRooms(); }
      else if (act === 'refresh') listRooms();
      else if (act === 'start') create();
      else if (act === 'join') join(arg);
      else if (act === 'code') join($('#shCode').value);
      else if (act === 'leave') leave();
      else if (act === 'follow') { choose(arg, 'follow'); dialog(false); HOST.closePicker(); }
      else if (act === 'unfollow') unfollow();
      else if (act === 'remove') removeAsk(arg);
      else if (act === 'arrange') arrange({ x: 0, z: 0, yaw: 0 });
      else if (act === 'add') { const k = $('#shAdd').value, id = add(k, freeSpot()); if (id) log('added', { st: id, story: k }); }
      else if (act === 'color') setMe({ color: arg });
      else if (act === 'copy') { try { navigator.clipboard.writeText(link()); b.textContent = 'Copied'; } catch (e) { /* no clipboard */ } }
      renderDialog();
    });
    $('#shName').addEventListener('change', ev => setMe({ name: ev.target.value.trim() || C.name }));
    $('#shRelay').addEventListener('keydown', ev => { if (ev.key === 'Enter') { setRelay(ev.target.value, 'typed'); listRooms(); } });
    $('#shCode').addEventListener('keydown', ev => { if (ev.key === 'Enter') join(ev.target.value); });
    DLG.map = $('#shMap');
    DLG.map.addEventListener('click', ev => {
      const r = DLG.map.getBoundingClientRect(), hit = mapHit(ev.clientX - r.left, ev.clientY - r.top);
      if (hit) { choose(hit, 'follow'); renderDialog(); }
    });
  }
  // a desktop's new station: on the arc's free side, so it does not land on another one
  function freeSpot() {
    for (let k = 0; k < 24; k++) {
      const a = k * 0.9, r = 2.4 + 0.5 * k, p = { x: r3(r * Math.sin(a)), z: r3(-r * Math.cos(a)), yaw: r3(a + Math.PI) };
      if (!C.st.some(s => Math.hypot(s.x - p.x, s.z - p.z) < ROW.gap)) return p;   // as far apart as Arrange all
    }
    return { x: 0, z: 0, yaw: 0 };
  }
  function link() {
    return location.href.replace(/#.*$/, '') + hash();
  }
  function renderDialog() {
    if (!DLG.open || !DLG.el) return;
    const joined = !!C.code;
    DLG.el.classList.toggle('joined', joined);
    const st = $('.sh-status');
    st.textContent = C.note || (joined ? `Room ${C.code}: ${connLine()}. ${C.members.length} ${C.members.length === 1 ? 'person' : 'people'} in it.` :
      C.relay ? (C.served ? 'This page comes from the relay, so it knows where the rooms are.' : 'Rooms on ' + host() + '.') :
        'Shared rooms need a relay: a small server on your network that keeps a room in step. Enter its address.');
    st.classList.toggle('warn', !!C.note);
    $('.sh-relay').hidden = !!C.served && !C.note;
    if (!joined) {
      const rooms = C.rooms || [];
      $('.sh-rooms').innerHTML = !C.relay ? '' : rooms.length ? rooms.map(r => `<li${r.members ? '' : ' class="empty"'}><b>${esc(r.code)}</b><span>${esc(peopleIn(r))}${r.stations ? ` · ${r.stations} station${r.stations === 1 ? '' : 's'}` : ''}</span><button class="btn${r.members ? ' primary' : ''}" type="button" data-sh="join:${esc(r.code)}">Join</button></li>`).join('')
        : `<li class="none">${esc(C.roomsErr || (C.rooms ? 'No open rooms yet. Start one, and others join it here or from a headset.' : 'Looking for rooms...'))}</li>`;
      for (const b of DLG.el.querySelectorAll('[data-sh="start"], [data-sh="code"]')) b.disabled = !C.relay;
    } else {
      const L = C.stById.get(C.follow);
      $('.sh-room').innerHTML = `<b>${esc(C.code)}</b><span>${L ? 'Following ' + esc(meta(L.story).title) + ' on this page' : 'Follow a station to see its story here, in step with the room'}</span>
        <button class="btn" type="button" data-sh="copy">Copy link</button><button class="btn" type="button" data-sh="leave">Leave</button>`;
      $('.sh-stations').innerHTML = C.st.length ? C.st.map(s => {
        const m = meta(s.story), on = C.follow === s.id, who = whoAt(s.id).filter(w => w !== 'you');
        return `<li class="${on ? 'on' : ''}"><i style="background:${m.col}"></i><b>${esc(m.title)}</b><span>${esc(stationLine(s))}${who.length ? ' · ' + esc(who.join(', ')) : ''}</span>
          ${on ? '<button class="btn" type="button" data-sh="unfollow">Stop following</button>' : `<button class="btn primary" type="button" data-sh="follow:${s.id}">Follow</button>`}
          <button class="btn rm${armed(s.id) ? ' armed' : ''}" type="button" data-sh="remove:${s.id}" aria-label="${armed(s.id) ? 'Remove the ' + esc(m.title) + ' station for everyone? Press again to remove it' : 'Remove the ' + esc(m.title) + ' station'}">${armed(s.id) ? 'Remove for everyone?' : 'Remove'}</button></li>`;
      }).join('') : '<li class="none">No stations yet. Arrange all puts the seven stories in two rows; a headset in the room can then move them.</li>';
      const sel = $('#shAdd');
      if (!sel.options.length) sel.innerHTML = HOST.list.map(m => `<option value="${m.key}">${esc(m.title)}</option>`).join('');
      $('.sh-people').innerHTML = C.members.map(m => {
        const P = m.id === C.id ? { st: C.follow } : C.pres.get(m.id), s = P && C.stById.get(P.st);
        return `<li><i style="background:${esc(m.color || '#888')}"></i><b>${esc(m.name || 'Someone')}${m.id === C.id ? ' (you)' : ''}</b><span>${
          { ar: 'headset', vr: 'headset (VR)', desktop: 'screen' }[m.kind] || ''}${m.kind && m.kind !== 'desktop' ? (m.here ? ', in the room' : ', elsewhere') : ''}${s ? ' · at ' + esc(meta(s.story).title) : ''}</span></li>`;
      }).join('');
      drawMap();
    }
    $('.sh-colors').innerHTML = COLORS.map(c => `<button type="button" data-sh="color:${c}" style="background:${c}" aria-label="Colour ${c}" aria-pressed="${c === C.color}"></button>`).join('');
  }
  // the room from above: stations (dots in their colours, a line to where the content floats, titles), people
  // (arrows where they stand and look, their rays); north (forward, -z) is up
  const MAP = { tf: null };
  function drawMap() {
    const cv = DLG.map;
    if (!cv || !C.code || cv.offsetParent === null) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#071021'; ctx.fillRect(0, 0, W, H);
    const pts = [[0, 0]];
    for (const s of C.st) pts.push([s.x, s.z], content(s));
    for (const P of C.pres.values()) if (P.head) pts.push([P.head[0], P.head[2]]);
    let x0 = Math.min(...pts.map(p => p[0])) - 1.2, x1 = Math.max(...pts.map(p => p[0])) + 1.2;
    let z0 = Math.min(...pts.map(p => p[1])) - 1.2, z1 = Math.max(...pts.map(p => p[1])) + 1.2;
    const sc = Math.min(W / (x1 - x0), H / (z1 - z0)), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const X = x => W / 2 + (x - cx) * sc, Y = z => H / 2 + (z - cz) * sc;
    MAP.tf = { X, Y };
    // a metre grid
    ctx.strokeStyle = 'rgba(149,166,189,0.10)'; ctx.lineWidth = 1;
    for (let gx = Math.ceil(cx - W / 2 / sc); gx <= cx + W / 2 / sc; gx++) { ctx.beginPath(); ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), H); ctx.stroke(); }
    for (let gz = Math.ceil(cz - H / 2 / sc); gz <= cz + H / 2 / sc; gz++) { ctx.beginPath(); ctx.moveTo(0, Y(gz)); ctx.lineTo(W, Y(gz)); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(149,166,189,0.45)'; ctx.beginPath(); ctx.moveTo(X(0) - 6, Y(0)); ctx.lineTo(X(0) + 6, Y(0)); ctx.moveTo(X(0), Y(0) - 6); ctx.lineTo(X(0), Y(0) + 6); ctx.stroke();
    ctx.font = '12px B612, "Segoe UI", Arial, sans-serif'; ctx.textBaseline = 'middle';
    // titles: beside their dot, right or left, else below or above, where they overlap no other title or dot
    const boxes = C.st.map(s => [X(s.x) - 8, Y(s.z) - 8, 16, 16]), free = b => b[0] >= 2 && b[0] + b[2] <= W - 2 && b[1] >= 2 && b[1] + b[3] <= H - 2 &&
      !boxes.some(o => b[0] < o[0] + o[2] && o[0] < b[0] + b[2] && b[1] < o[1] + o[3] && o[1] < b[1] + b[3]);
    for (const s of C.st) {
      const m = meta(s.story), [qx, qz] = content(s), on = s.id === C.follow;
      ctx.strokeStyle = m.col; ctx.globalAlpha = 0.6; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(s.x), Y(s.z)); ctx.lineTo(X(qx), Y(qz)); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = m.col; ctx.fillRect(X(qx) - 4, Y(qz) - 4, 8, 8);
      ctx.beginPath(); ctx.arc(X(s.x), Y(s.z), 7, 0, Math.PI * 2); ctx.fill();
      if (on) { ctx.strokeStyle = '#f2f6fc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(s.x), Y(s.z), 12, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#e7eef8';
      const tw = ctx.measureText(m.title).width, px = X(s.x), py = Y(s.z);
      const tries = [[px + 14, py - 8], [px - 14 - tw, py - 8], [px - tw / 2, py + 12], [px - tw / 2, py - 28]].map(([bx, by]) => [bx, by, tw, 16]);
      const b = tries.find(free) || tries[0];
      boxes.push(b);
      ctx.fillText(m.title, b[0], b[1] + 8);
    }
    for (const [id, P] of C.pres) {
      if (!P.head) continue;
      const m = member(id) || {}, col = m.color || '#f2f6fc', h = P.head;
      ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      for (const r of P.hands) { const len = r[6] > 0.05 ? r[6] : 1.2; ctx.beginPath(); ctx.moveTo(X(r[0]), Y(r[2])); ctx.lineTo(X(r[0] + r[3] * len), Y(r[2] + r[5] * len)); ctx.stroke(); }
      const fq = new THREE.Vector3(0, 0, -1).applyQuaternion(_q.set(h[3], h[4], h[5], h[6])), a = Math.atan2(fq.x, -fq.z);
      ctx.save(); ctx.translate(X(h[0]), Y(h[2])); ctx.rotate(a);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 7); ctx.lineTo(0, 3); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = col; ctx.fillText(m.name || 'Someone', X(h[0]) + 12, Y(h[2]) + 12);
    }
  }
  function mapHit(px, py) {
    if (!MAP.tf) return '';
    let best = '', bd = 18;
    for (const s of C.st) { const d = Math.hypot(MAP.tf.X(s.x) - px, MAP.tf.Y(s.z) - py); if (d < bd) { bd = d; best = s.id; } }
    return best;
  }
  // the address while joined: the same on every headset in the room (Quest shared spaces are per page URL)
  function hash() {
    if (!C.code) return '';
    const relay = C.linked || (!C.served && C.relay) ? '&relay=' + encodeURIComponent(C.relay.replace(/^http/, 'ws')) : '';
    return '#s=' + C.code + relay;
  }
  // the UI follows the session: the page's dialog and the Shared buttons, at most a few times a second
  let changing = 0;
  function changed() {
    if (changing) return;
    changing = setTimeout(() => {
      changing = 0;
      renderDialog();
      document.querySelectorAll('[data-open-shared]').forEach(b => {
        b.classList.toggle('on', !!C.code);
        b.textContent = C.code ? 'Shared: ' + C.code : 'Shared';
      });
    }, 60);
  }
  // reconnect at once when the page or the headset comes back, or the network does
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake('page'); });
  window.addEventListener('online', () => wake('network'));

  HOST.collab = {
    get id() { return C.id; }, get code() { return C.code; }, get joined() { return !!C.code; }, get status() { return C.status; },
    get relay() { return C.relay; }, get members() { return C.members; }, get name() { return C.name; }, get color() { return C.color; },
    stations: () => C.st, station: id => C.stById.get(id) || null, mine: () => C.mine, live: () => liveSt(), following: () => C.follow,
    val, now, publish: pairs => publish(pairs), fx, setRelay: s => setRelay(s, 'typed'), detect, list: listRooms, create, join, leave,
    arrange, add, move, remove, follow: id => choose(id, 'follow'), pick: id => choose(id, 'pick'), unfollow, me: setMe, setHere,
    ray, press, effect, detach, hash, dialog, people: () => C.pres, log,
    panelOpen(on) { PNL.open = !!on; PNL.page = 'main'; },
    overlay: () => OV,   // for tests: the overlay's objects (panel, cards, rings, people)
    // a story is about to start (HOST.start): in a headset at its station, it takes the station's place and panel
    starting,
    debug(on) { DEBUG = !!on; put('collabDebug', on ? '1' : null); },
    // links: #s=XYZ joins room XYZ (&relay=wss://host:port when the relay is elsewhere); #debug logs to the console
    boot(hp) {
      if (hp.has('debug')) DEBUG = true;
      if (hp.get('relay')) setRelay(hp.get('relay'), 'link');
      const code = (hp.get('s') || '').toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) return;
      log('boot', { code });
      detect().then(() => {
        if (C.relay) join(code);
        else { C.note = 'This link is for shared room ' + code + ', but this page does not know the relay. Enter its address.'; dialog(true); $('#shCode').value = code; }
        if (C.relay && !HOST.session && !/OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent)) setTimeout(() => { if (C.code && !C.follow) dialog(true); }, 600);
      });
    },
    internals: () => C,
  };
})();
