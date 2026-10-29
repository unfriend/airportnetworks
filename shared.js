'use strict';
// ================================================================= shared space ==
// Shared rooms (docs/shared-space-plan.md; the rules come from docs/multiplayer.md and docs/shared-spaces.md).
// Headsets and desktop browsers join a room on the relay (relay/server.mjs), or, without one, peer to peer (one page
// hosts the room with the relay's rules, the others link to it: PeerSocket), or on this device alone. A room holds stations: a story
// at a spot in the room, each with its own clock and explore state, the same on every device. A headset runs
// live the station whose circle it walked into last, wherever it walks after (the others show as rings on the floor),
// placed at that station for everybody and with its narration coming from there; before it has walked into any circle it
// shows only the room (no Stories screen in a room: a story is reached by walking into its circle); desktop operators
// follow a station from a room map.
// Nobody outside a room is affected: until you join, only the Shared buttons show (and, in a headset, the menu:
// a clock on the left wrist that opens it, with Exit, the slideshow, Sound check and the shared room inside).
//
//  HOST.collab  the session: relay, room, keys (echo suppression by value, optimistic writes, apply order),
//               members, the relay's clock, stations, the story hooks, presence, effects, the overlay hung in the
//               story's scene (previews, people, the shell's headset panel, notices) and the page's dialog
//  HOST.room    the room frame in a headset: its own local-floor and shared spaces, the alignment state
//               machine, two-point calibration, the saved frame with an anchor at mark A, reconciliation
//
// A story takes part with one object and two lines (section 7 of the plan): its factory returns
//   collab: { APP, scene: () => GL.scene, state, apply, view, setView, effect, hover, panel(p, yaw, q), place(o, s, q) }
// and its headset pointer code asks HOST.collab.ray(i, o, d) before its own raycast (a hit is the hover, kind
// 'shell'; a press then goes to HOST.collab.press(i)). It calls HOST.collab.effect(type, data) where it causes
// a one-shot effect itself. Debugging: window.__collabLog (the last 1000 events), localStorage collabDebug = 1
// (or #debug in a link) prints them as well.
(function () {
  const PROTO = 1;
  const FORMAT = 'networks-25';   // the shared state's format (keys, the stories' state()): bump when it changes shape
  const BROWSER = (/OculusBrowser\/(\d+)/.exec(navigator.userAgent) || [])[1] || '';   // Quest Browser's version (shared spaces differ by it)
  const EYE = 1.6;               // a standing eye height (m): a station's rig hangs this high over its spot
  const AHEAD = 1.4;             // a station's content floats this far in front of its spot
  // your station: within 1.1 m of its spot for a second, kept until you walk into another one. Arrange all's spots are
  // 2.4 m apart, so two stations never compete for one person
  const NEAR = 1.1, DWELL = 1000;
  const DRIFT = 0.25;            // a story further than this from its station's clock jumps
  // Arrange all: two rows in front of you (sixteen stories: 8, and 8 right behind them; a shorter second row stands in the gaps), spots 2.4 m apart, the first row
  // 1.2 m ahead, the second 2.6 m behind it (about 17 m x 4 m of floor); every station faces away from you, so its content
  // floats beyond its spot
  const ROW = { gap: 2.4, ahead: 1.2, back: 2.6 };
  const PANEL_HOME = { p: [-0.56, 0.04, -0.86], yaw: Math.atan2(0.56, 0.86) };   // where every story hangs its panel
  const COLORS = ['#46d9ff', '#ff5ad9', '#3ee08f', '#ffb43b', '#9db4ff', '#ff7a59', '#c3e85a', '#f2f6fc'];
  const NAMES = ['Ada', 'Alan', 'Barbara', 'Dorothy', 'Emmy', 'Erwin', 'Grace', 'Hedy', 'Karl', 'Lise', 'Marie',
    'Niels', 'Paul', 'Rosalind', 'Tim', 'Vera'];
  const ST_RE = /^st\.([\w-]{1,32})$/;
  // peer to peer (no relay): PeerJS's introduction server knows the room by an id with this app's prefix and the shared
  // state's format (devices of another version never meet); Cloudflare's STUN server is the only ICE server (no TURN:
  // the devices share a network that lets them link directly). The device holding the id hosts the room.
  const PEER_PREFIX = 'lbinet-', ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }];
  const PEER_LIMIT = 8000;       // the introduction server must answer within this as a room is joined, else this device only
  const SILENT = 6000;           // a host not heard from for this long may have gone (guests ping it every 2 s)
  const TAKE = 1500;             // taking over: each waits this long for every member in the room longer than it
  const WHO_GONE = 15000;        // a person followed (a page) gone from the members this long while this page is connected has left
  const IS_HEADSET = /OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent);
  const DEV = IS_HEADSET ? 'headset' : /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'phone' : 'screen';   // (a headset hosting hands over to a screen)
  const peerId = code => PEER_PREFIX + FORMAT + '-' + code;
  const kPlay = id => 'st.' + id + '.play', kX = id => 'st.' + id + '.x', kPanel = id => 'st.' + id + '.panel', kView = id => 'st.' + id + '.view';
  const kPlace = id => 'st.' + id + '.place';   // where the station's scene floats ({ x, y, z } from where the story puts it) and its size (s)

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
  // a story's entry in the list (HOST.meta: also a page that is not one of the stories, as the design room); one this
  // device does not know yet (a newer copy of the app put it in the room) gets a stand-in whose card says this device
  // needs an update (HOST.unknown; HOST.live offers the update)
  const meta = key => (HOST.meta ? HOST.meta(key) : HOST.list.find(s => s.key === key)) || (HOST.unknown ? HOST.unknown(key) : undefined);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mmss = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const fwd = yaw => [-Math.sin(yaw), -Math.cos(yaw)];   // a yaw's forward on the floor (x, z): yaw 0 faces -z

  // ------------------------------------------------------------------ log --
  const LOG = window.__collabLog = [];
  LOG.n = 0;   // entries are numbered (the relay's copy goes on from the last one sent)
  let DEBUG = get('collabDebug') === '1';
  function log(ev, data) {
    LOG.push(Object.assign({ t: Math.round(performance.now()), n: ++LOG.n, ev }, data || {}));
    if (LOG.length > 1000) LOG.splice(0, LOG.length - 1000);
    if (DEBUG) console.log('[shared]', ev, data || '');
  }
  // the shell's sound effects (sfx.js, HOST.sfx; off until turned on): in a headset each comes from where it happens
  // (scene coordinates: the menu, a station's spot, a person), on a screen plain stereo (pan, -1 .. 1). sfxN counts the
  // sounds played, so a press that made a sound of its own (a lock, the menu closing) gets no click on top
  const sfx = (name, at, o) => {
    if (!HOST.sfx) return null;
    try { return HOST.sfx.play(name, Object.assign({ at: HOST.session && at ? [at.x, at.y, at.z] : null }, o)); } catch (e) { return null; }
  };
  const sfxN = () => (HOST.sfx ? HOST.sfx.count() : 0);
  // a point in room coordinates in the headset's scene (null on a screen, or before the room is aligned)
  const roomAt = (x, y, z) => (HOST.session && R.aligned ? new THREE.Vector3(x, y, z).applyMatrix4(R.m) : null);

  // -------------------------------------------------------------- session --
  const C = {
    id: rid(12), relay: get('collabRelay') || '', linked: false, served: null, detecting: null,
    code: '', ws: null, status: 'off', note: '', want: false, welcomed: false, refill: null, tries: 0, timer: 0, heard: 0, pingAt: 0,
    local: false, probeAt: 0, probing: false, openTimer: 0, creating: false,   // a room on this device (no relay reached): see LocalSocket
    // how the room runs: 'relay', 'peer' (peer to peer: see PeerSocket) or 'local' (C.local: this device only); peer: the
    // introduction server ('' PeerJS's public one, 'off', or host[:port][/path]); the rest: a peer-to-peer room's host change
    via: '', peer: get('collabPeer') || '', peerNew: false, newTries: 0, peerFail: false, peerWait: 0, peerRetake: 0, lastRole: '',
    takeover: false, next: '', spare: null, spareAt: 0, spareN: 0, seqMax: 0, busy: 0,
    keys: new Map(), synced: new Map(), pending: new Map(), cid: 0, members: [], xb: null, clockAt: 0, clockT: 0, rm: null,
    offset: 0, samples: [], rtt: 0,
    name: get('collabName') || any(NAMES), color: get('collabColor') || any(COLORS), hereSet: null,
    rooms: null, roomsErr: '', roomsAt: 0,
    // rooms on this network: the network's id (a short hash, never the address; where it came from: 'relay', 'stun' or
    // 'pretend'; whether it was found: '', 'finding', 'found' or 'none'), the rooms found on it, and the room this device
    // joined by itself (auto: its code)
    net: '', netSrc: '', netState: '', netBusy: null, netAt: 0, pretend: '', near: null, nearErr: '', nearAt: 0, nearBusy: false, auto: '', autoRid: '', made: '', rejoining: false, stranger: '',
    listing: { dialog: false, menu: false },   // (the dialog and the headset's menu, open: what pump may update)
    st: [], stById: new Map(), mine: '', live: '', picked: false, follow: '', zone: '', cand: '', candAt: 0, going: new Map(), goAt: 0,
    // a person followed (a page only): their member id and name, where their presence last put them, since when they are
    // gone from the members (0: there), and the name of one who left (said in the dialog while their last station stays)
    who: '', whoName: '', whoSt: '', whoGone: 0, whoLeft: '',
    pres: new Map(), rays: new Map(), hov: new Map(), presAt: 0, deskAt: 0,
    cur: null, hook: null, ready: false, guard: 0, hush: false, pumpAt: 0, viewSeen: '',
  };
  // what is shown for a key: our own unacknowledged write, else the room's value
  const val = k => { const p = C.pending.get(k); if (p) return p.v; const e = C.keys.get(k); return e ? e.v : undefined; };
  const now = () => clock() + C.offset;   // the relay's clock
  const kind = () => (HOST.session ? (HOST.mode === 'immersive-ar' ? 'ar' : 'vr') : 'desktop');
  // in the room with the others, or elsewhere (a desktop always): only people here calibrate. Passthrough (AR)
  // counts as here; in VR the shell's panel asks once per room (askHere), and the answer is kept per room code
  // (in a room on this device there are no others: a headset is always here)
  const here = () => { const k = kind(); return k !== 'desktop' && (C.local || (C.hereSet !== null ? C.hereSet : k === 'ar')); };
  const askHere = () => !!(C.code && !C.local && kind() === 'vr' && C.hereSet === null);
  const heres = () => { try { return JSON.parse(get('collabHere') || '{}') || {}; } catch (e) { return {}; } };
  const member = id => C.members.find(m => m.id === id);
  // A fresh shared space (key sg, { n, by, at }): Quest Browser keeps one shared space per page address, and two
  // Quest 3s each kept their own copy of one (2.6 to 3.4 m apart by the tape, session after session). The relay
  // also serves the app under s/<n>/, so a room can move every page to a new address, where the headsets make a new
  // space together. SG: this page's generation (0: the app's own address); appRoot: that address
  const SG = (() => { const m = /\/s\/(\d{1,4})\/(?:index\.html)?$/.exec(location.pathname); return m ? +m[1] : 0; })();
  const appRoot = () => new URL(SG ? '../../' : './', location.href).href;
  // this page has just moved to a fresh shared space (spaceMove): said once on the page and once in the headset
  const FRESH = { page: false, xr: false };
  try { FRESH.page = FRESH.xr = sessionStorage.getItem('collabFresh') === String(SG); sessionStorage.removeItem('collabFresh'); } catch (e) { /* storage blocked */ }
  const FRESH_TEXT = 'Moved to a fresh shared space. Start AR on one headset first and wait for "Shared space found", then the others, one by one.';
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
    Object.assign(C, { net: '', netSrc: '', netState: '', near: null, nearErr: '' });   // (the network as this relay sees it: asked again)
    if (why !== 'served') put('collabRelay', s);
    log('relay', { relay: s, why });
    if (C.local && C.code && s) setTimeout(() => probe(performance.now(), true), 0);   // a room on this device: to this relay?
    // a room kept here to rejoin through it? And the rooms on this network as this relay sees them, if they show
    setTimeout(() => { netAgain('relay'); if (!C.code && (C.listing.dialog || C.listing.menu)) { listRooms(); nearFind('relay'); } }, 0);
    changed();
  }
  // does the relay serve this page? Asked once, and only when the shared space is used
  function detect() {
    if (C.detecting) return C.detecting;
    C.detecting = fetch(appRoot() + 'api/ping', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null).then(j => {
      C.served = !!(j && j.proto);
      if (C.served && !C.linked) setRelay(appRoot(), 'served');
      log('served', { served: C.served });
      changed();
      return C.served;
    });
    return C.detecting;
  }
  const mixed = () => (location.protocol === 'https:' && /^http:/.test(C.relay) && !/^http:\/\/(localhost|127\.)/.test(C.relay)
    ? ' This page is on https, so the relay must be too (wss://).' : '');
  async function api(path, body, ms) {
    // (an address nobody answers at can take half a minute to fail: given up after 8 s)
    const ab = new AbortController(), to = setTimeout(() => ab.abort(), ms || 8000);
    const r = await fetch(C.relay + '/api/' + path, body === undefined ? { cache: 'no-store', signal: ab.signal } :
      { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ab.signal }).finally(() => clearTimeout(to));
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
  // a room on this network: who started it (the relay: the first one in it; peer to peer: its host), people, stations
  const nearLine = r => [r.name ? (C.relay ? 'with ' : 'hosted by ') + r.name : '', r.members ? `${r.members} ${r.members === 1 ? 'person' : 'people'}` : 'empty',
    r.stations ? `${r.stations} station${r.stations === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
  // no room on this network to show: why
  function nearNone() {
    if (C.nearErr) return C.nearErr;
    if (!C.relay && !peerOn()) return 'No relay is known and peer to peer is off, so no rooms are found on this network.';
    if (C.netState === 'none') return C.relay ? 'The relay did not say which network this is, so no rooms are listed here and none is joined again by itself.' :
      'This device\'s network could not be found (the STUN server did not answer), so no rooms are listed here and none is joined again by itself.';
    if (C.near === null || C.nearBusy || C.netState === 'finding') return 'Looking for rooms on this network...';
    return C.relay ? 'No rooms on this network yet.' : 'No rooms on this network yet: a room shows here while its host\'s page is open.';
  }
  // a new room: on the relay; peer to peer when no relay is known or it cannot be reached (or this device only, when
  // peer to peer cannot be had either)
  async function create() {
    // a page the relay serves may not know it yet (a quick click, or a test): asked first (5 s at most), else the
    // room starts without it
    if (C.creating) return;
    C.creating = true; C.newTries = 0;
    if (!C.relay && C.served === null) await Promise.race([detect(), new Promise(r => setTimeout(r, 5000))]);
    if (!C.relay) { C.creating = false; join(freeCode(), 'new'); return; }
    C.note = 'Asking the relay for a room...'; changed();
    let r = null;
    try { r = await api('rooms', { app: 'networks', version: FORMAT }, 5000); } catch (e) { log('create failed', { e: e.message }); C.creating = false; join(freeCode(), 'new'); return; }
    C.creating = false; C.note = '';
    if (!r.ok || !r.j || !r.j.code) { C.note = 'Could not start a room: the relay answered ' + r.status + '.'; changed(); return; }
    log('created', { code: r.j.code });
    C.made = r.j.code;   // (this page made it: it gives the room its id, rid)
    join(r.j.code);
  }
  // how: none (a room by its code or a link: on the relay when one is known, else peer to peer, else this device only),
  // 'new' (a room started without a relay: peer to peer under a code nobody holds, else this device only), true (a room
  // kept on this device: opened here when a relay is known, and taken to it once it answers; else peer to peer) or 'auto'
  // (joined again by itself, as by its code: rejoin)
  // rid: a room joined by itself (how 'auto') is known by its own id, set before the socket opens (welcome checks it)
  function join(code, how, rid) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return false;
    if (C.code) leave(true);
    C.auto = how === 'auto' ? code : ''; C.autoRid = how === 'auto' && typeof rid === 'string' ? rid : ''; C.stranger = '';
    if (how === 'new') C.made = code;
    const h = heres()[code], via = how === 'new' ? (peerOn() ? 'peer' : 'local') : C.relay ? (how === true ? 'local' : 'relay') : peerOn() ? 'peer' : 'local';
    Object.assign(C, { code, via, local: via === 'local', peerNew: how === 'new' && via === 'peer', peerFail: false, takeover: false, next: '', seqMax: 0, lastRole: '', spareN: 0,
      probeAt: 0, want: true, welcomed: false, note: '', tries: 0, status: 'connecting', keys: new Map(), synced: new Map(), pending: new Map(),
      members: [], st: [], stById: new Map(), mine: '', live: '', picked: false, follow: '', zone: '', cand: '', xb: null, rm: null,
      hereSet: typeof h === 'boolean' ? h : null });
    C.pres.clear();
    log('join', { code, relay: C.relay, via });
    HOST.setUrl(HOST.picking);
    connect();
    R.joined();
    changed();
    return true;
  }
  // purpose: left on purpose (Leave: the dialog, the menu, the notice, HOST.collab.leave): not joined again by itself until
  // it is joined again by hand (rejoin)
  function leave(switching, purpose) {
    if (!C.code) return;
    log('leave', { code: C.code, purpose: !!purpose });
    C.want = false; clearTimeout(C.timer); clearTimeout(C.openTimer);
    const ws = C.ws, sp = C.spare;
    C.ws = null; C.spare = null;
    for (const s of [ws, sp]) if (s) try { s.close(1000); } catch (e) { /* closed */ }   // (a host lets go of the room's id at once)
    slotDrop();
    if (purpose) keptMark(C.code, { left: true });
    C.auto = ''; toastOff();
    if (C.stranger === C.code) LOC.mirror = false;   // (another room under this code: nothing of it kept)
    locFlush();
    Object.assign(C, { code: '', status: 'off', local: false, via: '', peerNew: false, peerFail: false, takeover: false, next: '', welcomed: false, keys: new Map(), synced: new Map(), pending: new Map(), members: [], st: [], stById: new Map(),
      mine: '', live: '', follow: '', zone: '', cand: '', refill: null, xb: null, rm: null, hereSet: null, who: '', whoSt: '', whoGone: 0, whoLeft: '' });
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
    if (!C.want || !C.code || (C.via === 'relay' && !C.relay) || (C.ws && C.ws.readyState < 2) || C.spare) return;
    clearTimeout(C.timer); clearTimeout(C.openTimer);
    let ws;
    if (C.via === 'local') ws = new LocalSocket(new Hub(C.code, locLoad(C.code)), C.id, true);
    else if (C.via === 'peer') {
      // (a page that has the room takes it over with its copy, should it get the id)
      ws = new PeerSocket(C.code, { id: C.id, create: C.peerNew, wait: C.peerWait, retake: C.peerRetake, take: C.welcomed ? takeCopy : null });
      C.peerWait = C.peerRetake = 0;
    } else {
      try { ws = new WebSocket(C.relay.replace(/^http/, 'ws') + '/api/ws?room=' + C.code + '&id=' + C.id + '&proto=' + PROTO); } catch (e) {
        log('socket failed', { e: e.message });
        if (!C.welcomed) { fallback('socket failed'); return; }
        C.note = 'Could not reach the relay.' + mixed(); later(); return;
      }
      // a relay that does not answer as the room is joined: the room goes on, peer to peer or on this device (closed)
      if (!C.welcomed) C.openTimer = setTimeout(() => { if (C.ws !== ws || C.welcomed || ws.readyState !== 0) return; log('no answer', {}); drop('no answer'); }, 6000);
    }
    C.ws = ws; C.status = 'connecting'; C.heard = clock();
    log('connect', { code: C.code, via: C.via });
    wire(ws);
    changed();
  }
  // a socket's events (the relay's WebSocket, a room on this device, a peer-to-peer link)
  function wire(ws) {
    // pings: a few at once, then every 2 s for 20 s (a page that is busy loading a story delays them all), then every 15 s
    ws.onopen = () => {
      if (C.ws !== ws) return;
      log('open', { role: ws.role || '' }); hello(); ping(); C.openAt = performance.now();
      for (const ms of [300, 900]) setTimeout(() => { if (C.ws === ws) ping(); }, ms);
    };
    ws.onmessage = ev => {
      if (C.ws !== ws) return;
      C.heard = clock();
      let m = null;
      try { m = JSON.parse(ev.data); } catch (e) { /* not JSON */ }
      if (m && m.t) recv(m);
    };
    ws.onclose = ev => { if (C.ws !== ws) return; C.ws = null; C.lastRole = ws.role || ''; closed(ev.code, ev.reason); };
  }
  // give up on the socket now (it would not say so itself): one that did not answer in time, or fell silent
  function drop(why) {
    const ws = C.ws;
    C.ws = null; C.lastRole = (ws && ws.role) || '';
    if (ws) try { ws.close(); } catch (e) { /* gone */ }
    closed(1006, why);
  }
  // reconnect with backoff: 1, 2, 4, 8, 15 s (and at once when the page or the headset comes back)
  function later() {
    if (!C.want) return;
    clearTimeout(C.timer);
    C.timer = setTimeout(connect, Math.min(15000, 1000 * Math.pow(2, Math.min(4, C.tries++))));
  }
  function closed(code, reason) {
    log('close', { code, reason, via: C.via });
    if (!C.want) { C.status = 'off'; changed(); return; }
    C.status = 'connecting';
    // no such room: after a relay restart (this page was in it) bring it back; on a first join (a mistyped code,
    // an old link) say so and stop, rather than making an empty room of that name
    if (code === 4004) {
      // (a room this device keeps a copy of: the relay forgot it, overnight or in a restart, and it comes back from here)
      if (C.welcomed || localRooms().some(r => r.code === C.code)) { revive(); return; }
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
    if (C.via === 'relay') {
      // never reached the relay in this room: peer to peer, else on this device (the relay is asked again, probe)
      if (!C.welcomed) { fallback(reason || 'no relay'); return; }
    } else if (C.via === 'peer') {
      if (!C.welcomed) {
        // a new room under a code someone holds: another code. No introduction server (or no PeerJS): this device only
        // (asked again, probe)
        if (code === 4009 && C.peerNew && C.newTries++ < 5) { log('code taken', { code: C.code }); join(freeCode(), 'new'); return; }
        // the server answered, but no link to the room's host opened (it is busy, or the networks block direct links), or
        // its holder has just gone (the next try takes the id): again, later and later
        if (reason === 'no link to the host' || reason === 'no host') {
          if (reason !== 'no host') C.note = 'No link to the room\'s host yet: trying again. Devices on networks that block direct links cannot meet peer to peer.';
          later(); changed(); return;
        }
        goLocal(reason || 'no introduction server', true); return;
      }
      if (peerLost(code)) return;
    }
    later(); changed();
  }
  // the relay restarted and forgot the room: bring it back under its code, with what this page knew
  async function revive() {
    try {
      const r = await api('rooms', { app: 'networks', version: FORMAT, code: C.code });
      if (!r.ok && r.status !== 409) throw new Error('answer ' + r.status);   // 409: someone else brought it back first
      // what this page knew goes back in where the room lacks it (a page that was never in it: this device's copy)
      C.refill = new Map(C.keys.size ? C.keys : locLoad(C.code).keys);
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
      drop('no answer');
    }, 3000);
  }
  // (dev: a headset, a phone or a screen; a headset hosting a peer-to-peer room hands it to a screen)
  function hello() {
    send({ t: 'hello', name: C.name, color: C.color, kind: kind(), here: here(), version: FORMAT, proto: PROTO, dev: DEV });
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
    else if (m.t === 'members') { const was = C.members; C.members = m.members || []; comeGo(was, C.members); changed(); }
    else if (m.t === 'pong') pong(m);
    else if (m.t === 'error') onError(m);
    else if (m.t === 'host') { C.next = typeof m.to === 'string' ? m.to : ''; log('handing over', { to: C.next }); }   // (peer to peer: who takes the room next)
  }
  // someone joined or left the room (not this page; at most three sounds at once): soft notes from where they stand in a
  // headset (a newcomer's place once its presence has come, a second later; one who left where they were last seen)
  function comeGo(was, is) {
    if (!C.welcomed || !HOST.sfx) return;
    const ids = a => new Set(a.map(m => m.id)), w = ids(was), n = ids(is);
    const at = id => { const P = C.pres.get(id); return P && P.head ? roomAt(P.head[0], P.head[1], P.head[2]) : null; };
    is.filter(m => m.id !== C.id && !w.has(m.id)).slice(0, 3).forEach((m, k) => setTimeout(() => { if (C.members.some(x => x.id === m.id)) sfx('join', at(m.id)); }, 1000 + k * 450));
    was.filter(m => m.id !== C.id && !n.has(m.id)).slice(0, 3).forEach((m, k) => { const p = at(m.id); setTimeout(() => sfx('leave', p), k * 450); });
  }
  // dependencies first: stations, then their clocks, their explore states, their panels, then the rest
  const rank = k => (ST_RE.test(k) ? 0 : /\.play$/.test(k) ? 1 : /\.x$/.test(k) ? 2 : /\.panel$/.test(k) ? 3 : 4);
  // the whole room, first on every socket (a reconnect refetches everything): the room's values win
  function welcome(m) {
    C.status = 'open'; C.tries = 0; C.note = ''; C.welcomed = true; C.takeover = false; C.next = ''; C.spareN = 0; C.peerNew = false; C.lastRole = '';
    C.seqMax = Math.max(C.seqMax, +m.seq || 0);
    if (FRESH.page) { FRESH.page = false; C.note = FRESH_TEXT; }
    C.keys = new Map(Object.entries(m.keys || {}));
    // a room joined by itself that turns out to be another room under the same code (its rid), or one joined by itself
    // with no id to tell it by (never: rejoinable asks for one): left at once, and nothing of it is kept here (this
    // device's copy of its own room stays). No rid there yet is the room come back from a copy (revive): joined
    const rk0 = C.keys.get('rid');
    if (C.auto === C.code && (!C.autoRid || (rk0 && rk0.v !== C.autoRid))) { C.stranger = C.code; LOC.mirror = false; const c = C.code; setTimeout(() => notMine(c), 0); return; }
    C.pending.clear();
    C.synced = new Map();
    for (const [k, e] of C.keys) C.synced.set(k, J(e.v));
    C.members = m.members || [];
    // a new socket (perhaps after a sleep, or to another relay): the clock is measured again from its pings
    C.samples = [];
    if (typeof m.now === 'number') C.offset = m.now - clock();
    log('welcome', { seq: m.seq, keys: C.keys.size, members: C.members.length });
    // after a relay restart every page back fills in what the room lacks of what it knew, stations first (kept for
    // the relay's welcome: a room on this device that failed to reach it keeps it for the next try)
    const old = C.local ? null : C.refill;
    if (!C.local) C.refill = null;
    if (old && old.size) {
      const pairs = [...old].filter(([k]) => !C.keys.has(k)).map(([k, e]) => [k, e.v]).sort((a, b) => rank(a[0]) - rank(b[0]));
      for (let i = 0; i < pairs.length; i += 400) publish(pairs.slice(i, i + 400), true);
      log('refilled', { keys: pairs.length });
    }
    roomChanged(null, false);
    mirror();
    // the network this room is used on, kept with it (rejoin): found once per room, or again a minute after none was
    if (!C.net && !C.netBusy && (C.netState !== 'none' || performance.now() - C.netAt > 60000)) netFind('room');
    // the room's own id (key rid), written once by the page that made it or holds it: a room joined again by itself can be
    // told from another room under the same code (a code given again by a relay that forgot the room; someone elsewhere
    // peer to peer). One joined by itself that turns out to be another room is left at once
    const rk = C.keys.get('rid');
    if (!rk && !C.pending.has('rid') && (C.made === C.code || C.local || hosting())) publish([['rid', rid(10)]]);
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
    C.seqMax = Math.max(C.seqMax, +m.seq || 0);
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
    mirror();
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
      if (all || keys.includes(kView(L.id))) viewSync();
    }
    if (!local && has(/^r[fs]\./)) R.recAt = 0;   // a frame published for a shared space, or one found split: checked on the next frame
    if (has(/^sg$/)) spaceMove();
    if (has(/^look$/)) { const L = look(); if (L && HOST.xr && HOST.xr.keep) HOST.xr.keep(L); }   // (kept after leaving the room)
    changed();
  }

  // ----------------------------------------------------- a room on this device --
  // A room works without a relay too: peer to peer (below), or on this device alone when that cannot be had either (no
  // introduction server answers, or peer to peer is off). Then the relay's part is played in the page (a Hub with only
  // this page in it: the same messages and the same rules for keys, a station's epoch and stale writes; nobody else gets
  // presence or effects). Its keys are kept in localStorage (collabRoom.<code>), so the stations, their layout, the lock
  // and the room's floor survive a reload, and a room joined through a relay or peer to peer is kept there too (as last
  // seen), so its layout is still there on a day nobody else is. A room on this device goes to the relay when one
  // answers (probe): made there from this copy when the relay has no such room, else joined as the relay has it; with no
  // relay, it goes peer to peer once the introduction server answers (when that is what failed).
  // Each room kept also says when it was last used, on which network (net, a hash) and through which relay ('' none), and
  // whether it was left on purpose: what rejoin needs (a room used within a week on this network is joined again by itself).
  const LR = 'collabRoom.', LR_MAX = 8;   // the last few rooms are kept
  const LKEY = /^[\w-]+(?:\.[\w:-]+)*$/, LST = /^st\.([\w-]{1,32})(?:\.|$)/;   // as the relay's KEY and STATION
  const LOC = { code: '', seq: 0, keys: new Map(), timer: 0, mirror: false, list: null, net: '', relay: '', left: false, gone: false };
  function locLoad(code) {
    if (LOC.code === code) return LOC;
    locFlush();
    let o = null;
    try { o = JSON.parse(get(LR + code) || 'null'); } catch (e) { o = null; }
    const keys = new Map();
    if (o && o.keys && typeof o.keys === 'object') {
      for (const [k, e] of Object.entries(o.keys)) if (LKEY.test(k) && e && typeof e === 'object' && e.v !== undefined && e.v !== null) keys.set(k, { v: e.v, seq: +e.seq || 0, by: String(e.by || '') });
    }
    Object.assign(LOC, { code, seq: (o && +o.seq) || 0, keys, mirror: false, net: o && typeof o.net === 'string' ? o.net : '',
      relay: o && typeof o.relay === 'string' ? o.relay : '', left: !!(o && o.left), gone: !!(o && o.gone) });
    return LOC;
  }
  function locSave() { if (!LOC.timer) LOC.timer = setTimeout(locFlush, 400); }
  function locFlush() {
    clearTimeout(LOC.timer); LOC.timer = 0;
    if (!LOC.code) return;
    if (LOC.mirror && !C.local && !hosting() && C.code === LOC.code) {   // a relay's room or a guest's: as this page has it now
      LOC.keys = new Map([...C.keys].map(([k, e]) => [k, { v: e.v, seq: +e.seq || 0, by: e.by || '' }]));
      for (const e of LOC.keys.values()) if (e.seq > LOC.seq) LOC.seq = e.seq;
    }
    LOC.mirror = false;
    // in the room now: used now, on this network, through this relay, and no longer left (joined again by hand)
    if (C.code === LOC.code && C.want && C.welcomed && C.stranger !== C.code) { LOC.left = LOC.gone = false; LOC.relay = C.relay; if (C.net) LOC.net = C.net; }
    put(LR + LOC.code, J({ seq: LOC.seq, at: Date.now(), keys: Object.fromEntries(LOC.keys), net: LOC.net || undefined, relay: LOC.relay || undefined, left: LOC.left || undefined, gone: LOC.gone || undefined }));
    LOC.list = null;
    for (const r of localRooms().slice(LR_MAX)) put(LR + r.code, null);
    LOC.list = null;
  }
  // a room kept here, marked (left on purpose): only one this device has kept
  function keptMark(code, o) {
    if (LOC.code === code) { Object.assign(LOC, o); locSave(); return; }
    let r = null;
    try { r = JSON.parse(get(LR + code) || 'null'); } catch (e) { r = null; }
    if (!r || typeof r !== 'object' || !r.keys) return;
    put(LR + code, J(Object.assign(r, o, { at: Date.now() })));
    LOC.list = null;
  }
  // the rooms kept on this device, the last used first: [{ code, stations, at, net, relay, left }]
  function localRooms() {
    if (LOC.list) return LOC.list;
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i), code = k && k.startsWith(LR) ? k.slice(LR.length) : '';
        if (!/^[A-Z]{3}$/.test(code)) continue;
        let o = null;
        try { o = JSON.parse(localStorage.getItem(k)); } catch (e) { /* broken */ }
        if (o && o.keys && typeof o.keys === 'object') out.push({ code, stations: Object.keys(o.keys).filter(x => ST_RE.test(x)).length, at: +o.at || 0,
          net: typeof o.net === 'string' ? o.net : '', relay: typeof o.relay === 'string' ? o.relay : '', left: !!o.left, gone: !!o.gone, rid: o.keys.rid && typeof o.keys.rid.v === 'string' ? o.keys.rid.v : '' });
      }
    } catch (e) { /* storage blocked */ }
    return (LOC.list = out.sort((a, b) => b.at - a.at));
  }
  // a code for a new room on this device: none of the kept ones (peer to peer, also none whose id someone holds: 4009)
  function freeCode() {
    const kept = new Set(localRooms().map(r => r.code));
    let code = '';
    do { code = ''; for (const b of crypto.getRandomValues(new Uint8Array(3))) code += String.fromCharCode(65 + b % 26); } while (kept.has(code));
    return code;
  }
  // a relay's room (or a peer-to-peer guest's) is kept here as it changes (written at most every 0.4 s); a host's hub
  // keeps its own
  function mirror() {
    if (C.local || hosting() || !C.code || !C.welcomed || C.stranger === C.code) return;
    locLoad(C.code);
    LOC.mirror = true;
    locSave();
  }
  // the page goes: its copy is written, and a peer-to-peer host lets go of the room's id at once (the others take over)
  window.addEventListener('pagehide', () => { locFlush(); slotDrop(); for (const s of [C.ws, C.spare]) if (s && s.bye) s.bye(); });
  window.addEventListener('pageshow', e => { if (e.persisted) wake('page'); });
  // another tab wrote a room kept here: the list is read again, and a room on this device open here takes its copy
  // (its own writes still on their way win)
  window.addEventListener('storage', e => {
    if (!e.key || !e.key.startsWith(LR)) return;
    LOC.list = null;
    if (C.local && C.code && e.key === LR + C.code && LOC.code === C.code && !LOC.timer) {
      LOC.code = '';
      const ws = C.ws;
      C.ws = null;
      if (ws) try { ws.close(1000); } catch (er) { /* closed */ }
      log('local room from another tab', { code: C.code });
      connect();
    }
    changed();
  });

  // --------------------------------------------------------------- the hub --
  // The relay's part played in a page (relay/server.mjs): for a room on this device (this page alone) and for a
  // peer-to-peer room's host (its own page through an in-page socket, every guest through its link). The relay's rules:
  // a welcome with the keys and the members; a batch stored as one seq; a station's state keys need the station (and its
  // story, when they name one); a station given another story, or removed, loses its state keys in the same seq;
  // refusals that name the keys; members on every hello and leave; fx passed on to the others with by; pong with the
  // room's time; and the relay's limits on sizes and rates. Its keys are LOC: kept in localStorage as a room on this
  // device is.
  const LIM = { value: 256 << 10, fx: 64 << 10, batch: 500, keys: 5000, fxRate: 60, setRate: 120 };
  const over = (r, cap) => { const t = Date.now(); if (t - r.t0 >= 1000) { r.t0 = t; r.n = 0; } return ++r.n > cap; };   // a one-second window
  class Hub {
    // off: the room's clock against this page's (a host taking over keeps the old host's, so stations play on without a
    // jump); since: when the members came (kept across a host change: the order in which they take over)
    constructor(code, L, off, since) {
      Object.assign(this, { code, L, off: off || 0, since: since || new Map(), members: new Map(), host: '', stopped: false, mute: false, tickAt: Date.now() });
      L.mirror = false;
      this.iv = setInterval(() => this.tick(), 2000);
    }
    now() { return Date.now() + this.off; }
    people() { return [...this.members.values()].map(m => Object.assign({ id: m.id, name: m.name, color: m.color, kind: m.kind, here: m.here, version: m.version, since: m.since }, m.id === this.host ? { host: true } : {})); }
    to(m, msg) { if (!this.mute) m.out(JSON.stringify(msg)); }
    cast(msg, except) { if (this.mute) return; const s = JSON.stringify(msg); for (const m of this.members.values()) if (m !== except) m.out(s); }
    // w: { id, out(text), end() }. The same page again (a new link while its old one hangs on): the new one wins
    join(w) {
      const old = this.members.get(w.id);
      if (old) { this.to(old, { t: 'error', code: 'replaced', text: 'connected again elsewhere' }); this.members.delete(w.id); old.end(); }
      const m = Object.assign(w, { name: '', color: '', kind: 'desktop', here: false, version: '', dev: '', since: this.since.get(w.id) || this.now(), fx: { n: 0, t0: 0 }, sets: { n: 0, t0: 0 }, heard: Date.now() });
      this.since.set(m.id, m.since);
      this.members.set(m.id, m);
      this.to(m, { t: 'welcome', you: m.id, room: this.code, app: 'networks', version: FORMAT, seq: this.L.seq, keys: Object.fromEntries(this.L.keys), members: this.people(), now: this.now(), proto: PROTO });
      this.cast({ t: 'members', members: this.people() }, m);
      return m;
    }
    leave(m) {
      if (this.members.get(m.id) !== m) return;
      this.members.delete(m.id);
      if (!this.stopped) this.cast({ t: 'members', members: this.people() });
    }
    kick(m, code, text) { this.to(m, { t: 'error', code, text }); this.leave(m); m.end(); }
    refuse(m, cid, keys, text, code) { this.to(m, { t: 'error', code: code || 'refused', text, cid, keys }); }
    message(m, text) {
      if (this.stopped || this.mute || this.members.get(m.id) !== m) return;
      m.heard = Date.now();
      let msg = null;
      try { msg = JSON.parse(text); } catch (e) { /* not JSON */ }
      if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return this.refuse(m, null, [], 'bad message', 'bad');
      if (msg.t === 'set') return this.set(m, msg);
      if (msg.t === 'fx') {
        if (typeof msg.k !== 'string' || msg.k.length > 128 || !LKEY.test(msg.k) || msg.v === undefined || text.length > LIM.fx) return this.refuse(m, null, [], 'bad fx', 'bad');
        if (!over(m.fx, LIM.fxRate)) this.cast({ t: 'fx', k: msg.k, v: msg.v, by: m.id }, m);
        return;
      }
      if (msg.t === 'ping') return this.to(m, { t: 'pong', c: Number.isFinite(msg.c) ? msg.c : null, now: this.now() });
      if (msg.t === 'hello') {
        if (msg.proto !== undefined && msg.proto !== PROTO) return this.kick(m, 'proto', 'this room speaks protocol ' + PROTO);
        const version = typeof msg.version === 'string' ? msg.version.slice(0, 64) : '';
        if (version && version !== FORMAT) return this.kick(m, 'version', 'the room runs version ' + FORMAT);
        Object.assign(m, { name: typeof msg.name === 'string' ? msg.name.trim().slice(0, 32) : '', color: /^#[0-9a-f]{3,8}$/i.test(msg.color) ? msg.color : '',
          kind: ['ar', 'vr', 'desktop'].includes(msg.kind) ? msg.kind : 'desktop', here: msg.here === true, version, dev: typeof msg.dev === 'string' ? msg.dev.slice(0, 8) : '' });
        this.cast({ t: 'members', members: this.people() });
        if (this.onhello) this.onhello(m);
        return;
      }
      this.refuse(m, null, [], 'bad message: unknown t', 'bad');
    }
    // a batch as the relay stores it: one seq; a station's state keys need the station (and its story, when they name
    // one); a station given another story, or removed, loses its state keys in the same seq
    set(m, msg) {
      const L = this.L, cid = typeof msg.cid === 'string' || Number.isFinite(msg.cid) ? msg.cid : null, all = msg.batch;
      if (!Array.isArray(all) || !all.length || all.length > LIM.batch) return this.refuse(m, cid, [], 'bad batch', 'bad');
      const named = all.map(p => (Array.isArray(p) ? String(p[0]).slice(0, 128) : '?'));
      if (over(m.sets, LIM.setRate)) return this.refuse(m, cid, named, 'more than ' + LIM.setRate + ' writes a second', 'rate');
      const good = [], bad = [], st = new Map();
      for (const p of all) {
        const [k, v] = Array.isArray(p) && p.length === 2 ? p : [], s = typeof k === 'string' ? LST.exec(k) : null;
        const bare = !!s && k === 'st.' + s[1];
        const why = typeof k !== 'string' || k.length > 128 || !LKEY.test(k) || (k.startsWith('st.') && !s) || v === undefined ? 'bad' :
          v === null ? (/^(st|pose)\./.test(k) ? '' : 'bad') : bare && !(typeof v === 'object' && !Array.isArray(v) && typeof v.story === 'string' && v.story) ? 'bad' :
            J(v).length > LIM.value ? 'too big' : '';
        if (why) { bad.push(typeof k === 'string' ? k.slice(0, 128) : '?'); continue; }
        good.push([k, v]);
        if (bare) st.set(s[1], v);
      }
      const ok = good.filter(([k, v]) => {
        const s = LST.exec(k);
        if (!s || k === 'st.' + s[1] || v === null) return true;
        const station = st.has(s[1]) ? st.get(s[1]) : (L.keys.get('st.' + s[1]) || {}).v;
        const fine = !!station && !(v && typeof v === 'object' && typeof v.story === 'string' && v.story !== station.story);
        if (!fine) bad.push(k);
        return fine;
      });
      const gone = [];
      for (const [id, v] of st) {
        const old = L.keys.get('st.' + id);
        if (old && v && old.v.story === v.story) continue;
        for (const k of L.keys.keys()) if (k.startsWith('st.' + id + '.')) gone.push(k);
      }
      const more = ok.filter(([k, v]) => v !== null && !L.keys.has(k)).length;
      if (more && L.keys.size + more > LIM.keys) return this.refuse(m, cid, named, 'the room is full');
      if (ok.length) {
        const seq = ++L.seq, out = [];
        for (const k of gone) { L.keys.delete(k); out.push([k, null]); }
        for (const [k, v] of ok) { if (v === null) L.keys.delete(k); else L.keys.set(k, { v, seq, by: m.id }); out.push([k, v]); }
        this.cast({ t: 'set', batch: out, seq, by: m.id, cid });
        locSave();
      }
      if (bad.length) this.refuse(m, cid, bad, 'not stored');
    }
    // a guest silent for 30 s is dropped (guests ping every 2 s; a page busy loading a story pings late); after a busy
    // spell here (or a hidden tab) none is
    tick() {
      const t = Date.now(), busy = t - this.tickAt > 5000;
      this.tickAt = t;
      for (const m of [...this.members.values()]) {
        if (busy || m.id === this.host) m.heard = t;
        else if (t - m.heard > 30000) { this.leave(m); m.end(); }
      }
    }
    stop() {
      if (this.stopped) return;
      this.stopped = true; clearInterval(this.iv);
      for (const m of [...this.members.values()]) if (m.id !== this.host) m.end();
      this.members.clear();
    }
    // a guest's link (PeerJS): its member id is in the link's metadata; long texts come in pieces
    link(c) {
      const id = String((c.metadata && c.metadata.id) || ''), rx = { buf: '', skip: false };
      if (this.stopped || this.mute || !/^[\w-]{1,64}$/.test(id) || id === this.host) { try { c.close(); } catch (e) { /* gone */ } return; }
      let m = null;
      const w = { id, out: s => pieces(c, s), end: () => { try { c.close(); } catch (e) { /* gone */ } } };
      c.on('open', () => { if (!this.stopped && !this.mute) m = this.join(w); });
      c.on('data', d => { const s = whole(rx, d, 1 << 20); if (m && s !== null) this.message(m, s); });
      c.on('close', () => { if (m) this.leave(m); });
      c.on('error', () => w.end());
    }
  }
  // a page's own link to the hub in it (a room on this device; a peer-to-peer host's own page), with a WebSocket's face.
  // owns: the hub is this socket's alone (a room on this device), and stops with it
  class LocalSocket {
    constructor(hub, id, owns) {
      Object.assign(this, { readyState: 0, hub, owns });
      hub.host = hub.host || id;
      this.me = { id, out: s => setTimeout(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data: s }); }, 0), end: () => this.close(1000) };
      setTimeout(() => {
        if (this.readyState !== 0) return;
        this.readyState = 1;
        hub.join(this.me);   // (its welcome comes next)
        if (this.onopen) this.onopen();
      }, 0);
    }
    send(text) { if (this.readyState !== 1) throw new Error('not open'); this.hub.message(this.me, text); }
    close(code, reason) {
      if (this.readyState > 1) return;
      this.readyState = 3;
      if (this.owns) this.hub.stop(); else this.hub.leave(this.me);
      setTimeout(() => { if (this.onclose) this.onclose({ code: code || 1000, reason: reason || '' }); }, 0);
    }
  }

  // --------------------------------------------------------- peer to peer --
  // Without a relay (a copy on GitHub Pages, or a relay that cannot be reached as a room is joined) a room runs peer to
  // peer: PeerJS (vendored, loaded only then) and its introduction server (PeerJS's public one, or &peer=host[:port][/path]
  // in a link, such as the relay's own at /peerjs) introduce the devices, which then talk directly (WebRTC data channels).
  // The room's id there is peerId(code): the device that holds it hosts the room (a Hub, with the relay's rules) and the
  // others link to it as guests with the relay's messages (PeerSocket), so the rest of the shell hardly knows the
  // difference.
  //  - The host goes (Leave, the page closed): it lets go of the id at once, the guests' links close, and the one longest
  //    in the room takes the id over with its copy of the room and its measure of the room's clock (so stations play on
  //    without a jump); the others wait a moment each, find the id taken and link to whoever took it. Meanwhile the room
  //    stays as it is on every page and writes wait.
  //  - A host not heard from for 6 s (a headset taken off and asleep): the guests keep their link and try now and then to
  //    take the id over the same way, which works once the introduction server lets go of it (PeerJS's public server: up
  //    to about a minute after the host vanished; until then the id is taken and the host cannot be reached).
  //  - A headset that hosts hands the room to the first screen that joins (a laptop or desktop page: a headset sleeps
  //    when taken off).
  //  - What needs the relay stays off: a fresh shared space and the headsets' logs. A room that runs peer to peer stays
  //    so until everyone has left it (a relay found later is used for the next room).
  const hosting = () => !!(C.ws && C.ws.role === 'host' && C.ws.readyState === 1);
  const peerOn = () => C.peer !== 'off' && typeof RTCPeerConnection === 'function';
  // the introduction server: '' (PeerJS's public one; also typed as public), 'off' (no peer to peer: this device only),
  // or host[:port][/path] (kept like the relay's address; a room's link carries it)
  function setPeer(s, why) {
    s = String(s || '').trim().replace(/^peer:\s*/i, '');
    if (/^(public|default|0\.peerjs\.com)$/i.test(s)) s = '';
    if (/^off$/i.test(s)) s = 'off';
    if (s === C.peer) return;
    C.peer = s; put('collabPeer', s);
    log('peer server', { peer: s || 'public', why });
    changed();
  }
  // the introduction server as PeerJS takes it ({} for its public one), and its name; a page on https needs wss
  function peerServer() {
    const m = C.peer && C.peer !== 'off' ? /^(?:(https?|wss?):\/\/)?(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9.-]+)(?::(\d{1,5}))?(\/[^?#\s]*)?$/.exec(C.peer) : null;
    if (!m) return { name: '0.peerjs.com', opts: {} };
    const secure = m[1] ? /s$/.test(m[1]) : location.protocol === 'https:', port = m[3] ? +m[3] : secure ? 443 : 80, path = m[4] || '/peerjs';
    return { name: m[2] + (m[3] ? ':' + m[3] : '') + path, opts: { host: m[2], port, path, secure } };
  }
  const peerOpts = () => Object.assign({}, peerServer().opts, { config: { iceServers: ICE }, debug: 0 });
  // does the introduction server answer? (a room on this device asks before it goes peer to peer again)
  function peerUp() {
    const o = Object.assign({ host: '0.peerjs.com', port: 443, path: '/', secure: true }, peerServer().opts), ab = new AbortController(), to = setTimeout(() => ab.abort(), 5000);
    const url = (o.secure ? 'https://' : 'http://') + o.host + ':' + o.port + o.path.replace(/\/?$/, '/') + 'peerjs/id?ts=' + Date.now();
    return fetch(url, { cache: 'no-store', signal: ab.signal }).then(r => r.ok, () => false).finally(() => clearTimeout(to));
  }
  // PeerJS, loaded the first time a room goes peer to peer. Its links must outlive every story: the shell removes the
  // listeners added while a story is current when it goes, and PeerJS adds its links' own (a data channel's messages)
  // later, from the network's callbacks, so these two classes add theirs as the shell's (HOST.quiet)
  let PJ = null;
  function peerLib() {
    if (window.Peer) return Promise.resolve(window.Peer);
    if (PJ) return PJ;
    for (const K of [window.RTCPeerConnection, window.RTCDataChannel]) {
      if (!K || Object.prototype.hasOwnProperty.call(K.prototype, 'addEventListener')) continue;
      const add = K.prototype.addEventListener;
      K.prototype.addEventListener = function () { return quiet(() => add.apply(this, arguments)); };
    }
    return (PJ = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = appRoot() + 'peerjs.min.js'; s.async = true;
      s.onload = () => (window.Peer ? res(window.Peer) : rej(new Error('PeerJS did not load')));
      s.onerror = () => rej(new Error('PeerJS did not load'));
      document.head.appendChild(s);
    }).catch(e => { PJ = null; throw e; }));
  }
  // a link carries texts of any length: one longer than PIECE goes in pieces, '+' before each but the last and '=' before
  // the last (the relay's messages are JSON objects, which start with neither)
  const PIECE = 16000;
  function pieces(c, s) {
    if (s.length <= PIECE) { c.send(s); return; }
    for (let i = 0; i < s.length; i += PIECE) c.send((i + PIECE >= s.length ? '=' : '+') + s.slice(i, i + PIECE));
  }
  function whole(rx, d, max) {
    if (typeof d !== 'string') return null;
    if (d[0] !== '+' && d[0] !== '=') { rx.buf = ''; rx.skip = false; return d; }
    if (!rx.skip) { rx.buf += d.slice(1); if (rx.buf.length > max) { rx.buf = ''; rx.skip = true; } }   // (too long: dropped whole)
    if (d[0] === '+') return null;
    const s = rx.skip ? null : rx.buf;
    rx.buf = ''; rx.skip = false;
    return s;
  }
  // A peer-to-peer room's link, with a WebSocket's face (readyState, send, close, onopen, onmessage, onclose) and the
  // relay's messages. It takes the room's id and hosts (role 'host': this page through its own socket to the hub), or
  // finds the id taken and links to whoever holds it (role 'guest'). o: id (this page's member id), create (a new room: a
  // taken id fails with 4009), wait (ms before it starts), retake (more tries for the id, 0.4 s apart, before linking: a
  // host that has just let go of it), take (taking over: this page's copy of the room and its measure of the clock)
  class PeerSocket {
    constructor(code, o) {
      Object.assign(this, { readyState: 0, code, o, role: '', peer: null, conn: null, hub: null, inner: null, rx: { buf: '', skip: false }, kick: 0, tries: 0, handT: 0, hush: false,
        spent: 0, last: performance.now(), limit: (o.wait || 0) + PEER_LIMIT, why: 'no introduction server' });
      this.timer = setInterval(() => this.tick(), 250);
      this.waitT = setTimeout(() => peerLib().then(() => this.claim(), e => this.fail(1006, e.message)), o.wait || 0);
    }
    // how long it has tried, counting only the time this page was awake (a page busy loading a story links slowly)
    tick() {
      const t = performance.now(), d = t - this.last;
      this.last = t;
      if (d < 1500) this.spent += d;
      if (this.spent > this.limit) this.fail(1006, this.why);
    }
    mine(p) { return this.readyState < 2 && this.peer === p; }
    drop() { const p = this.peer; this.peer = null; if (p) try { p.destroy(); } catch (e) { /* gone */ } }
    claim() {
      if (this.readyState !== 0) return;
      this.drop();
      let p;
      try { p = this.peer = new Peer(peerId(this.code), peerOpts()); } catch (e) { this.fail(1006, 'PeerJS: ' + e.message); return; }
      p.on('open', () => { if (this.mine(p)) this.host(); });
      p.on('connection', c => { if (this.mine(p) && this.hub) this.hub.link(c); else try { c.close(); } catch (e) { /* gone */ } });
      p.on('error', e => this.error(p, e));
      p.on('disconnected', () => this.lost(p));
    }
    error(p, e) {
      if (!this.mine(p)) return;
      const t = (e && e.type) || 'error';
      log('peer error', { type: t, role: this.role, open: this.readyState === 1 });
      if (t === 'unavailable-id') {
        if (this.role === 'host') return this.fail(4010, 'superseded');   // (its id lapsed while the server was away, and someone took it)
        if (this.o.create) return this.fail(4009, 'taken');
        if (this.tries++ < (this.o.retake || 0)) { this.drop(); setTimeout(() => this.claim(), 400); return; }
        return this.guest();
      }
      if (this.readyState === 0) this.fail(1006, t === 'peer-unavailable' ? 'no host' : t);   // (once open, the links go on without the server)
    }
    // the host lost the introduction server: the links go on, and it asks again every few seconds (new guests need it)
    lost(p) {
      if (!this.mine(p) || this.role !== 'host' || this.hush) return;
      log('peer server lost');
      setTimeout(() => { if (this.mine(p) && !this.hush && p.disconnected && !p.destroyed) try { p.reconnect(); } catch (e) { /* not yet */ } }, 3000);
    }
    host() {
      const t = this.o.take && this.o.take(), L = locLoad(this.code);
      if (t) { L.keys = new Map([...t.keys].map(([k, e]) => [k, { v: e.v, seq: +e.seq || 0, by: e.by || '' }])); for (const e of L.keys.values()) L.seq = Math.max(L.seq, e.seq); L.seq = Math.max(L.seq, t.seq); locSave(); }
      const H = this.hub = new Hub(this.code, L, t ? t.off : 0, t ? t.since : null);
      H.host = this.o.id;
      H.onhello = m => this.handover(m);
      this.role = 'host';
      log('hosting', { code: this.code, took: !!t, keys: L.keys.size, off: Math.round(H.off) });
      const S = this.inner = new LocalSocket(H, this.o.id, false);
      S.onopen = () => this.opened();
      S.onmessage = ev => { if (this.readyState === 1 && this.onmessage) this.onmessage(ev); };
      S.onclose = ev => this.fail(ev.code, ev.reason);
    }
    guest() {
      if (this.readyState !== 0) return;
      this.drop(); this.role = 'guest';
      this.limit = this.spent + 15000; this.why = 'no link to the host';   // (the server answered: the host may be busy, or slow to reach)
      let p;
      try { p = this.peer = new Peer(peerOpts()); } catch (e) { this.fail(1006, 'PeerJS: ' + e.message); return; }
      p.on('open', () => {
        if (!this.mine(p)) return;
        const c = this.conn = p.connect(peerId(this.code), { reliable: true, serialization: 'raw', metadata: { id: this.o.id } });
        c.on('open', () => { if (this.conn === c) this.opened(); });
        c.on('data', d => {
          if (this.conn !== c || this.readyState > 1) return;
          if (this.readyState === 0) this.opened();
          const s = whole(this.rx, d, 16 << 20);
          if (s === null) return;
          if (s.startsWith('{"t":"error"')) this.fatal(s);
          if (this.onmessage) this.onmessage({ data: s });
        });
        c.on('close', () => { if (this.conn === c) this.fail(this.kick || 1006, this.readyState === 1 ? 'host gone' : 'no host'); });
        c.on('error', () => { if (this.conn === c && this.readyState === 0) this.fail(1006, 'no link'); });
      });
      p.on('error', e => this.error(p, e));
    }
    // the hub's last word before it closes the link (as the relay's close codes)
    fatal(s) { try { this.kick = { proto: 4005, version: 4006, replaced: 4008 }[JSON.parse(s).code] || this.kick; } catch (e) { /* not JSON */ } }
    opened() {
      if (this.readyState !== 0) return;
      clearInterval(this.timer);
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }
    send(text) {
      if (this.readyState !== 1) throw new Error('not open');
      if (this.inner) this.inner.send(text); else pieces(this.conn, text);
    }
    close(code, reason) { this.fail(code || 1000, reason || ''); }
    bye() { this.fail(1001, 'page gone'); }   // (pagehide: a host's id goes at once)
    fail(code, reason) {
      if (this.readyState > 1) return;
      this.readyState = 3;
      clearInterval(this.timer); clearTimeout(this.waitT); clearTimeout(this.handT);
      const S = this.inner, H = this.hub, c = this.conn;
      this.inner = this.hub = this.conn = null;
      if (S) { S.onclose = null; S.close(); }
      if (H) H.stop();
      if (c) try { c.close(); } catch (e) { /* gone */ }
      this.drop();   // (a host's id: let go of at once)
      log('peer link closed', { role: this.role, code, reason });
      setTimeout(() => { if (this.onclose) this.onclose({ code, reason }); }, 0);
    }
    // a headset that hosts gives the room to the first screen that joins (a laptop or desktop page stays awake, a headset
    // sleeps when taken off): it says who is next, lets go of the id, and that screen takes it over at once with its copy
    handover(m) {
      if (!IS_HEADSET || m.dev !== 'screen' || this.handT || this.readyState !== 1) return;
      log('hand over', { to: m.id });
      this.handT = setTimeout(() => {
        if (this.readyState !== 1 || !this.hub || this.hub.members.get(m.id) !== m) { this.handT = 0; return; }
        this.hub.cast({ t: 'host', to: m.id });
        this.handT = setTimeout(() => this.fail(4011, 'handed over'), 600);
      }, 1500);
    }
    vanish() { this.hush = true; if (this.hub) this.hub.mute = true; }   // (for tests: a host gone without a word, its id still held)
  }
  // what this page hands a hub when it takes a peer-to-peer room over: its copy of the room, the highest seq seen, its
  // measure of the room's clock and when the others came
  const takeCopy = () => ({ keys: C.keys, seq: C.seqMax, off: C.offset, since: new Map(C.members.map(m => [m.id, +m.since || 0])) });
  // the order in which pages take a room over: those longest in it first (a page that let go of it last; the screen a
  // headset hands it to first)
  function takeRank() {
    if (C.lastRole === 'host') return C.members.length;
    const me = member(C.id), since = m => +m.since || 0;
    const r = me ? C.members.filter(m => !m.host && m.id !== C.id && (since(m) < since(me) || (since(m) === since(me) && m.id < C.id))).length : 0;
    return C.next ? (C.next === C.id ? 0 : r + 1) : r;
  }
  // a peer-to-peer room's link has closed (its host has gone, or this page let go of the room): the first try takes the
  // room over in order, or links to whoever did; later tries back off. True when handled here
  function peerLost(code) {
    if (code === 1001) { changed(); return true; }   // (this page goes: back with it, pageshow)
    if (C.spare) { changed(); return true; }         // (a try is on its way already: the host had fallen silent)
    if (C.takeover) return false;
    const r = takeRank();
    Object.assign(C, { takeover: true, peerWait: r * TAKE, peerRetake: r ? 0 : 4 });
    if (C.lastRole !== 'host') C.note = 'The host has gone: taking over. The room stays as it is meanwhile.';
    log('take over', { rank: r, code });
    connect(); changed();
    return true;
  }
  // a guest that has not heard its host for 6 s keeps its link and tries now and then (in takeRank's order, then backing
  // off) to take the room's id over, or to link to whoever holds it now: a new link that opens replaces the old one, and
  // its welcome brings the room as it is there
  function spareTry(t) {
    if (C.spare || !C.want || t < C.spareAt) return;
    const first = !C.takeover, r = first ? takeRank() : 0;
    if (first) { C.takeover = true; C.note = 'The host is not answering: taking over if it has gone. The room stays as it is meanwhile.'; changed(); }
    log('host silent', { rank: r, tries: C.spareN });
    const S = C.spare = new PeerSocket(C.code, { id: C.id, wait: r * TAKE, retake: first && !r ? 4 : 0, take: takeCopy });
    S.onopen = () => {
      if (C.spare !== S) return;
      C.spare = null;
      const old = C.ws;
      if (old) { old.onopen = old.onmessage = old.onclose = null; try { old.close(); } catch (e) { /* gone */ } }
      log('link replaced', { role: S.role });
      C.ws = S; C.heard = clock(); wire(S); S.onopen();
    };
    S.onclose = () => {
      if (C.spare !== S) return;
      C.spare = null; C.spareAt = performance.now() + Math.min(15000, 1000 * Math.pow(2, Math.min(4, C.spareN++)));
      if (!C.ws && C.want) later();   // (the old link closed meanwhile)
    };
  }
  // the host answers again (it was busy): a try not yet linked is called off
  function spareOff() {
    const S = C.spare;
    if (!S || S.readyState !== 0) return;
    C.spare = null; S.onopen = S.onclose = null; S.close();
    C.takeover = false; C.spareAt = 0; C.spareN = 0;
    if (/^The host/.test(C.note)) C.note = '';
    log('host answers again'); changed();
  }
  // the relay cannot be reached as the room is joined: peer to peer, else on this device (as last kept here)
  const fallback = why => (peerOn() ? goPeer(why) : goLocal(why));
  function goPeer(why) {
    log('peer to peer', { code: C.code, why });
    clearTimeout(C.openTimer);
    Object.assign(C, { via: 'peer', local: false, note: '', tries: 0 });
    connect(); changed();
  }
  // failed: peer to peer could not be had (asked again, probe)
  function goLocal(why, failed) {
    log('local room', { code: C.code, why });
    clearTimeout(C.openTimer);
    Object.assign(C, { via: 'local', local: true, peerNew: false, peerFail: !!failed && peerOn(), note: '', tries: 0, probeAt: performance.now() });
    connect(); changed();
  }
  // a room on this device: does a relay answer now? Asked every 15 s, and at once when an address is entered. Then
  // the room goes there: made from this device's copy when the relay has no such room, else joined as it is there
  // (a room there of another version of the app is left alone). With no relay, peer to peer once its introduction
  // server answers (when that is what failed)
  function probe(t, now) {
    if (!C.local || !C.code || C.probing || (!now && t - C.probeAt < 15000)) return;
    C.probeAt = t; C.probing = true;
    const code = C.code;
    if (!C.relay) C.detecting = null;   // a page from a relay that was away: is it back?
    (C.relay ? Promise.resolve() : detect()).then(async () => {
      if (C.relay && await relayBack(code)) return;
      if (C.peerFail && peerOn() && await peerUp() && C.local && C.code === code) toPeer();
    }).catch(e => log('probe failed', { e: e && e.message })).then(() => { C.probing = false; });
  }
  // true when the relay answered (and the room went there, or stays here: another version of the app there)
  async function relayBack(code) {
    const p = await api('ping').catch(() => null);
    if (!p || !p.ok || !p.j || !p.j.proto) return false;
    const r = await api('rooms/' + code);
    if (r.ok && r.j && r.j.version && r.j.version !== FORMAT) {   // another version of the app there: asked again in 2 minutes
      log('relay back', { code, other: r.j.version }); C.probeAt = performance.now() + 105000;
      C.note = 'The relay has a room ' + code + ' of another version of the app: this one stays on this device.'; changed(); return true;
    }
    let made = false;
    if (r.status === 404) {
      const c = await api('rooms', { app: 'networks', version: FORMAT, code });
      if (!c.ok && c.status !== 409) return true;
      made = c.ok;
    } else if (!r.ok) return true;
    // a room there with no stations (made by an earlier try that did not get through) gets this device's copy too
    else if (!Object.keys((r.j && r.j.keys) || {}).some(k => ST_RE.test(k))) made = true;
    if (C.local && C.code === code) toRelay(made);
    return true;
  }
  function toRelay(made) {
    log('relay back', { code: C.code, made });
    locFlush();
    C.refill = made ? new Map(C.keys) : null;   // a room made there gets this device's keys (welcome)
    const ws = C.ws;
    C.ws = null; Object.assign(C, { via: 'relay', local: false, peerFail: false, welcomed: false, tries: 0 });
    if (C.hereSet === null) C.hereSet = true;   // (placed in this room alone so far: not asked whether it is with the others)
    if (ws) try { ws.close(1000); } catch (e) { /* closed */ }
    connect(); changed();   // (the placement stays: a 'floor' frame gives way once the shared space gives one, align)
  }
  // the introduction server answers again: the room goes peer to peer (this copy hosts it, or the host's room is joined)
  function toPeer() {
    log('peer to peer again', { code: C.code });
    locFlush();
    const ws = C.ws;
    C.ws = null; Object.assign(C, { via: 'peer', local: false, peerFail: false, peerNew: false, welcomed: false, tries: 0 });
    if (C.hereSet === null) C.hereSet = true;
    if (ws) try { ws.close(1000); } catch (e) { /* closed */ }
    connect(); changed();
  }

  // ------------------------------------------------- rooms on this network --
  // Browsers cannot search the local network, so devices meet through the address they share on the internet (the owner,
  // 29 October 2026). A network's id is a short hash of it, never the address itself (kept only on this device, with the
  // rooms it keeps, and never logged): with a relay the relay's (it hashes the address it sees, /api/ping and /api/near; a
  // private address stands for its /24); without one the hash, with the relay's salt, of the public address Cloudflare's
  // STUN server reports (a throwaway connection's own address as seen from outside), so the two agree; for tests a pretend
  // one (#net=<word>, as a link: no internet). None found: nothing listed and nothing joined by itself.
  //  - Rooms on this network (the Shared dialog and the headset's menu; one press joins): the relay lists the rooms with
  //    someone on this network; peer to peer, a room's host holds one of eight slots named after the network on the
  //    introduction server (slotId) and answers whoever asks there (its code and name, people, stations). A room shows
  //    there unless it says otherwise (key near, { on, by, at }: Show on this network, on by default).
  //  - Rejoin by itself, never join something new by itself (the owner's priority): a device in no room joins again by
  //    itself the room it used last on this network (through the same relay, or none) within a week, at page load and when
  //    the network or the relay becomes known. With a relay by its code (a relay that forgot it gets it back from this
  //    device's copy: revive); peer to peer by its id, which is unique: linked to whoever holds it, else hosted here from
  //    this device's copy, so the others find it (two at once never split it: the second links to the first). Not after
  //    Leave until it is joined again by hand, and never a room this device was never in. Used last on another network
  //    (or none found): nothing by itself, but one button, Start room XYZ again.
  const NET_SALT = 'networks-near-1', WEEK = 7 * 86400000, SLOTS = 8;
  const NET_RE = /^[0-9a-f]{6}$/;
  const slotId = (net, k) => PEER_PREFIX + 'near-' + FORMAT + '-' + net + '-' + k;
  const LOBBY = { slot: null, slotAt: 0, seeker: null };
  try { C.pretend = sessionStorage.getItem('collabNet') || ''; } catch (e) { /* storage blocked */ }
  // a network's name, as the relay makes it from an address (server.mjs, netName): the address itself, a private one's
  // /24, an IPv6 address's /64
  function netName(a) {
    a = String(a || '').trim().replace(/^\[|\](:\d+)?$/g, '').replace(/%.*$/, '').replace(/^::ffff:(?=\d+\.)/i, '').replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, '$1');
    const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
    if (v4) {
      const b0 = +v4[1], b1 = +v4[2];
      if (b0 === 127) return 'loopback';
      if (b0 === 10 || (b0 === 172 && b1 >= 16 && b1 < 32) || (b0 === 192 && b1 === 168) || (b0 === 169 && b1 === 254)) return `${+v4[1]}.${+v4[2]}.${+v4[3]}.0/24`;
      return v4.slice(1).map(Number).join('.');
    }
    if (!a.includes(':')) return '';
    if (a === '::1') return 'loopback';
    const [h, t] = a.split('::'), hs = h ? h.split(':') : [], ts = t === undefined ? [] : t ? t.split(':') : [];
    const all = t === undefined ? hs : hs.concat(Array(Math.max(0, 8 - hs.length - ts.length)).fill('0'), ts);
    if (all.length !== 8 || !all.every(g => /^[0-9a-f]{1,4}$/i.test(g))) return '';
    return all.slice(0, 4).map(g => parseInt(g, 16).toString(16)).join(':') + '::/64';
  }
  // the id: the first 24 bits of SHA-256 of the salt and the name (one id stands for about 256 public addresses)
  async function netHash(name) {
    if (!name || !(window.crypto && crypto.subtle)) return '';
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(NET_SALT + '|' + name)));
    return [...d.slice(0, 3)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // this page's public address as the STUN server sees it: a throwaway connection's srflx candidate (IPv4 first), '' none
  function stunAddr(ms) {
    return new Promise(res => {
      let pc = null, v6 = '', done = false;
      const end = a => { if (done) return; done = true; clearTimeout(to); try { if (pc) pc.close(); } catch (e) { /* closed */ } res(a || v6); };
      const to = setTimeout(() => end(''), ms);
      try {
        pc = new RTCPeerConnection({ iceServers: ICE });
        quiet(() => pc.addEventListener('icecandidate', e => {
          if (!e.candidate) { end(''); return; }   // (all gathered)
          const c = e.candidate, m = / typ srflx /.test(c.candidate + ' ') ? /^\S+ \d+ \S+ \d+ (\S+) /.exec(c.candidate) : null, a = m ? c.address || m[1] : '';
          if (a && a.includes(':')) v6 = v6 || a; else if (a) end(a);
        }));
        pc.createDataChannel('n');
        pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => end(''));
      } catch (e) { end(''); }
    });
  }
  // the network this device is on (C.net): the relay's word for it, else (no relay, or it does not answer) a pretend one,
  // else the STUN server's address hashed. One question at a time; asked again when the relay changes
  function netFind(why) {
    if (C.netBusy) return C.netBusy;
    const relay = C.relay;
    C.netState = 'finding'; changed();
    return (C.netBusy = (async () => {
      if (relay) {
        const r = await api('ping', undefined, 5000).catch(() => null);
        if (r && r.ok) return r.j && NET_RE.test(r.j.net || '') ? [r.j.net, 'relay'] : ['', ''];   // (an older relay does not say)
      }
      if (C.pretend) return [await netHash('pretend:' + C.pretend), 'pretend'];
      if (!peerOn()) return ['', ''];
      return [await netHash(netName(await stunAddr(6000))), 'stun'];
    })().catch(() => ['', '']).then(([net, src]) => {
      C.netBusy = null;
      if (C.relay !== relay) return netFind(why);   // (another relay meanwhile: asked again)
      netSet(net, src, why);
      return C.net;
    }));
  }
  function netSet(net, src, why) {
    const was = C.net;
    Object.assign(C, { net: net || '', netSrc: net ? src : '', netState: net ? 'found' : 'none', netAt: performance.now() });
    if (net !== was) {
      log('network', { found: !!net, src, why });   // (never the id: this log goes to the relay with a headset's)
      C.near = null;
      if (C.code && C.welcomed && LOC.code === C.code) locSave();   // (the room kept with this network)
    }
    changed();
  }
  // the relay or the network may have changed: in a room, the network is found again (kept with the room); in none, a
  // room kept here may be joined again by itself (only asked when one was used in the last week)
  function netAgain(why) {
    if (C.code) { if (C.welcomed) netFind(why); return; }
    if (!localRooms().some(r => Date.now() - r.at < WEEK)) return;
    netFind(why).then(() => { rejoin(why); changed(); });
  }
  // the room this device would join again by itself: the one it used last on this network (through this relay, or none),
  // within a week, unless it was left on purpose, and only when its copy here has the room's own id (rid): without it
  // another room given the same code could not be told from it, so it is offered instead (a page that went before its
  // id came back)
  const sameHere = r => !!C.net && r.net === C.net && r.relay === C.relay;
  function rejoinable() {
    if (!C.net) return null;
    const r = localRooms().find(o => sameHere(o) && Date.now() - o.at < WEEK);
    return r && !r.left && !r.gone && r.rid ? r : null;
  }
  // the room to offer again (Start room XYZ again): the one used last, within a week, when it is not joined by itself here
  // (not one whose code turned out to be another room's: gone)
  function offer() {
    if (C.code) return null;
    const r = localRooms().find(o => Date.now() - o.at < WEEK);
    return r && !r.left && !r.gone && !(sameHere(r) && r.rid) ? r : null;
  }
  // with a relay the room is looked at first: one there under this code with another id (rid) is another room (the relay
  // forgot this one and gave its code again), never joined by itself; none there: joined, and it comes back from this
  // device's copy (revive). Peer to peer the first answer is the welcome (welcome: notMine)
  function rejoin(why) {
    if (C.code || C.creating || C.rejoining) return false;
    const r = rejoinable();
    if (!r) return false;
    log('rejoin', { code: r.code, why });
    const go = () => {
      C.rejoining = false;
      if (C.code || C.creating || !rejoinable() || rejoinable().code !== r.code) return;
      join(r.code, 'auto', r.rid);
      if (HOST.session) notice('Back in room ' + r.code, 'This headset was in it on this network, so it joined it again. To leave it, open the menu: ' + menuWhere() + '.', 9000);
      else toast(r.code);
    };
    if (!C.relay) { go(); return true; }
    C.rejoining = true;
    api('rooms/' + r.code, undefined, 5000).then(x => {
      const there = x.ok && x.j && x.j.keys && x.j.keys.rid ? x.j.keys.rid.v : '';
      if (there && there !== r.rid) { C.rejoining = false; notMine(r.code); return; }
      go();
    }, go);
    return true;
  }
  // a room kept here whose code is now another room's: not joined by itself again, nor offered (still kept, and opened by hand)
  function notMine(code) {
    log('rejoin: another room', { code });
    if (C.code === code && C.auto === code) leave();
    keptMark(code, { gone: true });
    C.note = 'Room ' + code + ', which this device was in, is not there any more: its code is another room\'s now, so it was not joined by itself.';
    changed();
  }
  const ago = at => { const h = (Date.now() - at) / 3600000; return h < 1 ? 'less than an hour ago' : h < 24 ? Math.floor(h) + (h < 2 ? ' hour ago' : ' hours ago') : h < 48 ? 'yesterday' : Math.floor(h / 24) + ' days ago'; };
  // why a room kept here is offered rather than joined by itself
  const offerWhy = r => (!C.net ? 'this device\'s network is not known' : r.relay !== C.relay ? (r.relay ? 'it was on another relay' : 'it was used without a relay') :
    r.net !== C.net ? (r.net ? 'it was used on another network' : 'its network is not known') : 'this device did not keep its id');
  // the room's own switch (key near): shown on its network unless switched off; anyone in the room sets it
  const nearShown = () => { const v = val('near'); return !(v && typeof v === 'object' && v.on === false); };
  function setNear(on) {
    if (!C.code || C.local) return false;
    publish([['near', { on: !!on, by: C.id, at: now() }]]);
    log('near', { on: !!on });
    return true;
  }
  // the rooms on this network, for the dialog and the menu (C.near: [{ code, name, members, stations }]; null: looking)
  function nearFind(why) {
    if (C.code) return;
    C.nearAt = performance.now(); C.nearErr = '';
    // (a page the relay may serve asks first whether it does: a headset's menu can open before that is known)
    if (!C.relay && C.served === null) { C.nearBusy = true; changed(); detect().then(() => { C.nearBusy = false; nearFind(why); }); return; }
    if (C.relay) {
      C.nearBusy = true; changed();
      api('near', undefined, 6000).then(r => {
        C.nearBusy = false;
        if (C.code) return;
        if (!r.ok || !r.j || !Array.isArray(r.j.rooms)) { C.near = []; C.nearErr = r.status === 404 ? 'This relay does not list rooms by network (an older relay).' : 'The relay answered ' + r.status + '.'; changed(); return; }
        const list = r.j.rooms.filter(o => o && /^[A-Z]{3}$/.test(o.code) && (!o.version || o.version === FORMAT))
          .map(o => ({ code: o.code, name: String(o.name || '').slice(0, 32), members: +o.members || 0, stations: +o.stations || 0 }));
        const net = NET_RE.test(r.j.net || '') ? r.j.net : '';
        if (net !== C.net || C.netState !== 'found') netSet(net, 'relay', why);   // (the network as the relay sees it: known now)
        C.near = list;
        if (rejoin('near')) return;
        changed();
      }, () => { C.nearBusy = false; C.near = []; C.nearErr = unreachable(); changed(); });
      return;
    }
    if (!peerOn()) { C.near = []; changed(); return; }
    C.nearBusy = true; changed();
    (C.net && performance.now() - C.netAt < 300000 ? Promise.resolve(C.net) : netFind(why))   // (a network found lately stands)
      .then(net => { if (net && !C.code) seek(); else { C.nearBusy = false; C.near = []; changed(); } });
  }
  // peer to peer: whoever holds one of this network's slots says who it is (a throwaway peer asks all eight at once; a slot
  // nobody holds answers after the introduction server's 5 s)
  function seek() {
    if (LOBBY.seeker || C.code || !C.net || !peerOn()) { C.nearBusy = !!LOBBY.seeker; changed(); return; }
    const net = C.net, found = new Map(), waiting = new Set([...Array(SLOTS).keys()].map(k => slotId(net, k)));
    const S = LOBBY.seeker = { p: null, t: 0 };
    C.nearBusy = true; changed();
    const show = () => { if (!C.code && C.net === net) { C.near = [...found.values()]; changed(); } };
    const done = () => {
      if (LOBBY.seeker !== S) return;
      LOBBY.seeker = null; clearTimeout(S.t);
      try { if (S.p) S.p.destroy(); } catch (e) { /* gone */ }
      C.nearBusy = false; show();
    };
    S.t = setTimeout(done, 9000);
    const one = id => { waiting.delete(id); if (!waiting.size) done(); };
    peerLib().then(() => {
      if (LOBBY.seeker !== S) return;
      const p = S.p = new Peer(peerOpts());
      p.on('open', () => {
        if (LOBBY.seeker !== S) return;
        for (const id of [...waiting]) {
          const c = p.connect(id, { reliable: true, serialization: 'raw', metadata: { seek: 1 } });
          c.on('data', d => {
            let o = null;
            try { o = JSON.parse(d); } catch (e) { /* not JSON */ }
            if (o && /^[A-Z]{3}$/.test(o.code) && o.version === FORMAT) { found.set(o.code, { code: o.code, name: String(o.name || '').slice(0, 32), members: +o.members || 0, stations: +o.stations || 0 }); show(); }
            try { c.close(); } catch (e) { /* gone */ }
            one(id);
          });
          c.on('close', () => one(id));
          c.on('error', () => one(id));
        }
      });
      p.on('error', e => { const m = e && e.type === 'peer-unavailable' && /(\S+)$/.exec(String(e.message || '')); if (m) one(m[1]); else if (!p.open) done(); });
    }, done);
  }
  // a peer-to-peer room's host holds the first free slot of its network while the room shows on it (all taken, or no
  // introduction server: again in half a minute), and lets go when it no longer hosts, the room is hidden or left, or the
  // page goes (pump, pagehide)
  function slotStep(t) {
    const base = hosting() && C.welcomed && C.net && nearShown() ? slotId(C.net, '') : '';
    if (LOBBY.slot && LOBBY.slot.base !== base) slotDrop();
    if (!base || LOBBY.slot || t < LOBBY.slotAt || !window.Peer) return;
    slotTake(base, 0);
  }
  function slotTake(base, k) {
    let p = null;
    try { p = new Peer(base + k, peerOpts()); } catch (e) { LOBBY.slotAt = performance.now() + 30000; return; }
    const S = LOBBY.slot = { base, k, p, open: false };
    p.on('open', () => { if (LOBBY.slot === S) { S.open = true; log('shown on this network', { slot: k }); } });
    p.on('connection', c => {
      if (LOBBY.slot !== S) { try { c.close(); } catch (e) { /* gone */ } return; }
      c.on('open', () => {
        try { c.send(J({ code: C.code, name: C.name, members: C.members.length, stations: C.st.length, version: FORMAT })); } catch (e) { /* gone */ }
        setTimeout(() => { try { c.close(); } catch (e) { /* gone */ } }, 3000);
      });
      c.on('error', () => {});
    });
    p.on('error', e => {
      if (LOBBY.slot !== S) return;
      const taken = !!e && e.type === 'unavailable-id';
      if (taken && k + 1 < SLOTS) { slotDrop(); slotTake(base, k + 1); return; }
      if (taken || !S.open) { slotDrop(); LOBBY.slotAt = performance.now() + 30000; }
    });
    p.on('disconnected', () => setTimeout(() => { if (LOBBY.slot === S && p.disconnected && !p.destroyed) try { p.reconnect(); } catch (e) { /* not yet */ } }, 3000));
  }
  function slotDrop() { const S = LOBBY.slot; LOBBY.slot = null; if (S) try { S.p.destroy(); } catch (e) { /* gone */ } }
  // pretend to be on a network (#net=<word>, kept for this tab; off: the real one), for tests without the internet
  function pretendNet(w) {
    w = String(w || '').trim();
    C.pretend = /^[\w-]{1,32}$/.test(w) && w !== 'off' ? w : '';
    try { if (C.pretend) sessionStorage.setItem('collabNet', C.pretend); else sessionStorage.removeItem('collabNet'); } catch (e) { /* storage blocked */ }
    if (!C.relay) { C.net = ''; C.netState = ''; C.near = null; }
  }
  // the page's notice after a rejoin (a headset in a session gets the shell's notice instead): Leave at hand
  const TOAST = { el: null, timer: 0 };
  function toast(code) {
    if (!document.body) return;
    if (!TOAST.el) {
      const el = TOAST.el = document.createElement('div');
      el.id = 'shToast'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top, 0px) + 62px);transform:translateX(-50%);z-index:13;display:flex;flex-wrap:wrap;align-items:center;' +
        'gap:8px 12px;width:max-content;max-width:min(560px, calc(100% - 32px));box-sizing:border-box;padding:10px 14px;background:rgba(8,15,28,0.96);color:#e7eef8;' +
        'border:1px solid rgba(70,217,255,0.55);border-radius:10px;font:14px/1.4 B612, "Segoe UI", Arial, sans-serif;box-shadow:0 8px 28px rgba(0,0,0,0.45)';
      quiet(() => el.addEventListener('click', ev => {
        const b = ev.target.closest('[data-toast]');
        if (!b) return;
        if (b.dataset.toast === 'leave') leave(false, true); else if (b.dataset.toast === 'open') dialog(true);
        toastOff();
      }));
      document.body.appendChild(el);
    }
    TOAST.el.innerHTML = `<span style="flex:1 1 240px">Back in room <b>${esc(code)}</b>: this device was in it on this network, so it joined it again by itself.</span>` +
      '<button class="btn" type="button" data-toast="open">Shared</button><button class="btn" type="button" data-toast="leave">Leave</button>';
    TOAST.el.hidden = false;
    log('notice', { title: 'Back in room' });
    sfx('notice');
    clearTimeout(TOAST.timer); TOAST.timer = setTimeout(toastOff, 20000);
  }
  function toastOff() { clearTimeout(TOAST.timer); if (TOAST.el) TOAST.el.hidden = true; }

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
      P.bv = typeof v.bv === 'string' ? v.bv.slice(0, 8) : '';   // its Quest Browser version (versionNote)
      P.sp = typeof v.sp === 'string' ? v.sp.slice(0, 64) : ''; P.al = typeof v.al === 'string' ? v.al.slice(0, 8) : '';   // its shared space and what aligns it (alignedHere)
      P.head = Array.isArray(v.head) && v.head.length === 7 && v.head.every(Number.isFinite) ? v.head : null;
      P.hands = Array.isArray(v.hands) ? v.hands.filter(h => Array.isArray(h) && h.length === 7 && h.every(Number.isFinite)).slice(0, 2) : [];
    } else if (m.k === 'q.frame') { R.asked(m.v, m.by);   // someone's Re-align: the room's frame written into the space again
    } else if (m.k.startsWith('e.')) {
      const L = liveSt(), v = m.v || {};
      if (!v.q) log('effect in', { st: m.k.slice(2), type: v.type, by: m.by });
      if (L && m.k === 'e.' + L.id && C.ready && L.story === HOST.curKey && C.hook && C.hook.effect) {
        try { C.hook.effect(v.type, v.data); } catch (e) { log('effect failed', { e: e.message }); }
      }
    }
  }
  // a one-shot effect the story caused here (a falcon sent, crumbs spilled): the others at the station play it too.
  // quiet: one sent often (where the flock is, twice a second), kept out of the log on both sides
  function effect(type, data, quiet) {
    const L = liveSt();
    if (!L || L.story !== HOST.curKey || !C.code) return false;
    if (!quiet) log('effect out', { st: L.id, type });
    return fx('e.' + L.id, Object.assign({ type, data: data === undefined ? null : data }, quiet ? { q: 1 } : {}));
  }

  // ------------------------------------------------------------ stations --
  function stationsChanged() {
    const out = [];
    for (const k of new Set([...C.keys.keys(), ...C.pending.keys()])) {
      const m = ST_RE.exec(k), v = m && val(k);
      if (!v || typeof v !== 'object' || !meta(v.story)) continue;
      out.push({ id: m[1], story: v.story, x: +v.x || 0, z: +v.z || 0, yaw: +v.yaw || 0 });
    }
    const order = s => { const i = HOST.list.findIndex(x => x.key === s.story); return i < 0 ? HOST.list.length : i; };   // (the design room's after the stories)
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
    // (following a person not yet at a station: a story picked by hand stops it too)
    if (!asked && C.who && key !== HOST.curKey) whoStop('own story');
    return adopt(key);
  }
  // make a station yours (walking into its circle in a headset, Follow on a page, or the station of a person this page
  // follows: 'person'): its story runs live here
  function choose(id, how) {
    const s = C.stById.get(id);
    if (!s) return;
    const fol = how === 'follow' || how === 'person';
    if (how !== 'person') { C.whoLeft = ''; if (C.who) whoStop(how === 'follow' ? 'a station followed by hand' : how); }
    C.mine = id; C.live = id; C.picked = how === 'pick';
    C.viewSeen = '';   // (the room's view is taken again on arriving: one turned here while away is not the room's)
    if (fol) C.follow = id;
    log('station', { st: id, story: s.story, how });
    // following from a page shows the station: its Stories screen closes (while it shows, the pump stands still)
    if (fol) HOST.closePicker();
    if (HOST.curKey !== s.story) goTo(s);
    else if (C.ready) { clockApply(true); stateApply(); PL.id = ''; }
    changed();
  }
  function unfollow() { log('unfollow', { st: C.follow, who: C.who }); C.follow = ''; C.mine = ''; C.live = ''; C.picked = false; C.who = ''; C.whoLeft = ''; changed(); }
  // follow a person (a page only; the owner, 29 October 2026: a laptop for people who do not want to wear a headset follows
  // along): this page follows whichever station that person's headset runs, as their presence says (st: the circle they
  // walked into last, which stays theirs out of every circle), switching as they walk into the next circle (their
  // presence quiet, a headset taken off: the last one stays). It stops when they leave the room (the station stays
  // followed, as by hand), or when this page follows a station by hand, picks a story by hand, stops following, leaves
  // the room or starts a headset session
  function followPerson(id) {
    const m = member(id);
    if (!m || id === C.id || HOST.session || !C.code || (m.kind !== 'ar' && m.kind !== 'vr')) return false;   // (a person in a headset, as the dialog offers)
    C.who = id; C.whoName = m.name || 'Someone'; C.whoSt = ''; C.whoGone = 0; C.whoLeft = '';
    log('follow person', { who: id, kind: m.kind });
    whoStep(performance.now());
    changed();
    return true;
  }
  function whoStop(why) {
    if (!C.who) return;
    log('follow person off', { who: C.who, why });
    if (why === 'left the room') C.whoLeft = C.whoName;
    C.who = ''; C.whoSt = ''; C.whoGone = 0;
    changed();
  }
  // every pump: the followed person's station, from their presence (gone from the members for WHO_GONE while this page
  // is connected: they have left; a socket of theirs back within it, as after a relay restart, keeps them followed)
  function whoStep(t) {
    if (!C.who) return;
    if (HOST.session) { whoStop('headset'); return; }
    const m = member(C.who);
    if (m) { C.whoGone = 0; C.whoName = m.name || C.whoName; }
    else if (C.status === 'open' && C.welcomed) {
      if (!C.whoGone) { C.whoGone = t; changed(); } else if (t - C.whoGone > WHO_GONE) { whoStop('left the room'); return; }
    }
    const P = C.pres.get(C.who), id = P && P.st && C.stById.has(P.st) ? P.st : '';
    if (id !== C.whoSt) { C.whoSt = id; log('person moved', { who: C.who, st: id }); changed(); }
    if (id && C.follow !== id) choose(id, 'person');
  }
  // the dialog's line: "Following Ann (at The flock)"; out of every circle, where they were last
  function whoLine() {
    const m = member(C.who), name = (m && m.name) || C.whoName || 'Someone', at = C.stById.get(C.whoSt), L = C.stById.get(C.follow);
    return 'Following ' + name + (at ? ` (at ${meta(at.story).title})` : L ? ` (last at ${meta(L.story).title}; in no circle now)` : ' (not at a station yet)') +
      (m ? '' : ': not in the room just now');
  }
  // the stories' station: its spot (x, z), facing yaw; the content floats 1.4 m ahead
  const content = s => { const [fx, fz] = fwd(s.yaw); return [s.x + AHEAD * fx, s.z + AHEAD * fz]; };
  // where a station is drawn and placed in a headset: it glides to where the room has it (a station someone moves
  // by hand arrives ten times a second), and the one carried here follows the hand at once
  const SHOWN = new Map();
  const shown = s => SHOWN.get(s.id) || s;
  function easeStations(dt) {
    const k = 1 - Math.exp(-dt * 12);
    for (const id of SHOWN.keys()) if (!C.stById.has(id)) SHOWN.delete(id);
    for (const s of C.st) {
      let E = SHOWN.get(s.id);
      if (!E) { SHOWN.set(s.id, { id: s.id, story: s.story, x: s.x, z: s.z, yaw: s.yaw }); continue; }
      E.story = s.story;
      if (MV.id === s.id && MV.pose) { Object.assign(E, MV.pose); continue; }
      let a = (s.yaw - E.yaw) % (2 * Math.PI);
      if (a > Math.PI) a -= 2 * Math.PI; else if (a < -Math.PI) a += 2 * Math.PI;
      if (Math.hypot(s.x - E.x, s.z - E.z) < 0.002 && Math.abs(a) < 0.002) { E.x = s.x; E.z = s.z; E.yaw = s.yaw; continue; }
      E.x += (s.x - E.x) * k; E.z += (s.z - E.z) * k; E.yaw += a * k;
    }
  }

  // ------------------------------------------------- moving a station by hand --
  // In a headset the grip on a station's ring or card picks it up: it swings round you as you point, goes further
  // as you raise the controller and comes nearer as you lower it, turns as you twist your wrist, and goes out to
  // the room ten times a second, so everybody sees it move; letting go of the grip puts it down. The grip comes
  // from the session itself (controller i is session.inputSources[i] in three.js), so the stories need nothing
  const MV = { id: '', src: null, a: null, pose: null, at: 0, sent: '' };
  function pulse(src, v, ms) { try { const a = src && src.gamepad && src.gamepad.hapticActuators; if (a && a[0] && a[0].pulse) a[0].pulse(v, ms); } catch (e) { /* no haptics */ } }
  function grabStation(e) {
    const s = R.session;
    if (!s || !C.code || !R.aligned || MV.src || !e || !e.inputSource) return;
    let i = -1;
    try { i = [...s.inputSources].indexOf(e.inputSource); } catch (err) { /* gone */ }
    const h = i >= 0 ? hovOf(i) : null;
    if (!h || h.target.kind !== 'station' || !C.stById.has(h.target.id)) return;
    if (refused('grab')) { notice('The circles are locked', 'Unlock them in the menu (' + menuWhere() + ') to move the circles.', 3000); pulse(e.inputSource, 0.15, 10); return; }
    Object.assign(MV, { id: h.target.id, src: e.inputSource, a: null, pose: null, at: 0, sent: '', t0: performance.now() });
    log('station grab', { st: MV.id });
    pulse(e.inputSource, 0.4, 25);
    { const s = C.stById.get(MV.id); sfx('grab', roomAt(s.x, 1, s.z)); }
    changed();
  }
  function dropStation(e) {
    if (!MV.src || (e && e.inputSource !== MV.src)) return;
    if (MV.pose) sendStation(true);
    log('station put', { st: MV.id, at: MV.pose ? [r3(MV.pose.x), r3(MV.pose.z), r3(MV.pose.yaw)] : null });
    if (MV.pose) { pulse(MV.src, 0.25, 15); sfx('drop', roomAt(MV.pose.x, 0.3, MV.pose.z)); }
    Object.assign(MV, { id: '', src: null, a: null, pose: null });
    changed();
  }
  const _mc = new THREE.Matrix4();
  const turnTo = a => { a %= 2 * Math.PI; return a > Math.PI ? a - 2 * Math.PI : a <= -Math.PI ? a + 2 * Math.PI : a; };
  // each frame while held: the controller in room coordinates (position, pointing direction, twist about it)
  function carryStation(f, t) {
    const s = C.stById.get(MV.id), local = refSpace();
    if (!s || !R.aligned || !local || !R.session) { dropStation(null); return; }
    if (circlesLocked()) { log('station locked while carried', { st: MV.id }); Object.assign(MV, { id: '', src: null, a: null, pose: null }); changed(); return; }   // someone locked it meanwhile: it stays where it was last sent
    // put down when its controller is gone or its grip is up, though no squeezeend came (the controller slept, or
    // the headset was taken off with the grip held)
    let here = false;
    try { here = [...R.session.inputSources].includes(MV.src); } catch (e) { /* gone */ }
    const gp = MV.src.gamepad, open = !!(gp && gp.buttons && gp.buttons[1] && !gp.buttons[1].pressed && t - MV.t0 > 300);
    if (!here || open) { log('station let go', { gone: !here, open }); dropStation(null); return; }
    let p = null;
    try { p = f.getPose(MV.src.targetRaySpace, local); } catch (e) { /* not now */ }
    if (!p) return;
    const e = _mc.fromArray(p.transform.matrix).premultiply(R.mi).elements;
    const o = [e[12], e[13], e[14]], fw = [-e[8], -e[9], -e[10]], up = [e[4], e[5], e[6]];
    const A = MV.a, flat = Math.hypot(fw[0], fw[2]), pitch = Math.atan2(fw[1], flat);
    const phi = flat < 0.2 && A ? A.phi1 : Math.atan2(-fw[0], -fw[2]);   // pointing nearly straight up or down: no swing
    // the twist: the controller's up against the world's up, both across the pointing direction (not when the
    // controller points nearly straight up or down)
    const wu = [-fw[1] * fw[0], 1 - fw[1] * fw[1], -fw[1] * fw[2]], wl = Math.hypot(wu[0], wu[1], wu[2]);
    let roll = null;
    if (wl > 0.3) {
      const w = wu.map(v => v / wl), c = [w[1] * up[2] - w[2] * up[1], w[2] * up[0] - w[0] * up[2], w[0] * up[1] - w[1] * up[0]];
      roll = Math.atan2(c[0] * fw[0] + c[1] * fw[1] + c[2] * fw[2], w[0] * up[0] + w[1] * up[1] + w[2] * up[2]);
    }
    if (!A) {   // the first frame: where the station is, seen from the hand
      const dx = s.x - o[0], dz = s.z - o[2], d0 = Math.hypot(dx, dz);
      MV.a = { phi, phi1: phi, pitch, roll, twist: 0, d: Math.max(0.05, d0), da: d0 > 0.05 ? Math.atan2(-dx, -dz) - phi : 0, yaw: s.yaw - phi };
      MV.pose = { x: s.x, z: s.z, yaw: s.yaw };
      return;
    }
    A.phi1 = phi;
    if (roll !== null) { if (A.roll !== null) A.twist += turnTo(roll - A.roll); A.roll = roll; }   // (a twist counts from the first one known)
    const d = Math.min(12, Math.max(Math.min(0.3, A.d), A.d * Math.exp(2 * (pitch - A.pitch)))), al = phi + A.da;
    MV.pose = { x: o[0] - d * Math.sin(al), z: o[2] - d * Math.cos(al), yaw: turnTo(phi + A.yaw - A.twist) };
    if (t - MV.at > 100) sendStation(false, t);
  }
  function sendStation(final, t) {
    const s = C.stById.get(MV.id), P = MV.pose;
    if (!s || !P) return;
    const v = { story: s.story, x: r3(P.x), z: r3(P.z), yaw: r3(P.yaw) }, k = J(v);
    if (k === MV.sent) return;
    MV.sent = k; MV.at = t || performance.now();
    publish([['st.' + MV.id, v]]);
    if (final) log('station moved', { st: MV.id, x: v.x, z: v.z, yaw: v.yaw });
  }
  // a new station's clock: a story at its start, paused; a page that is not a story (the design room: no chapters) at
  // its table, in explore mode
  const startClock = story => ({ mode: !story || HOST.list.some(m => m.key === story) ? 'story' : 'explore', t: 0, playing: false, at: 0 });
  // where you are in the room and which way you face: a headset's head, a desktop's room origin
  function base() {
    if (R.aligned && R.headOK) return { x: R.hr.x, z: R.hr.z, yaw: R.hyaw };
    return { x: 0, z: 0, yaw: 0 };
  }
  // Two locks (the owner, 29 October 2026: "one toggle for locking the circles' movement globally and one toggle per room
  // for locking its panels and story elements"). The circles lock (Lock circles; key lock: { on, by, at }, the layout lock
  // of v96, which locked the scenes and panels too: a locked room from then needs its stories locked once): once the
  // stations are in place anyone can lock them, so nobody moves one by accident (the grip on a ring or card, the map's
  // drag and turn, Arrange all, Add, Move here, Remove and Design room here are refused); anyone unlocks. It never locks
  // a scene or a panel: that is each station's own lock (Lock this story: stLocked, below)
  const circlesLocked = () => { const v = val('lock'); return !!(v && v.on); };
  function setLock(on) {
    publish([['lock', { on: !!on, by: C.id, at: Math.round(now()) }]]);
    log('circles lock', { on: !!on });
    sfx(on ? 'lock' : 'unlock', menuAt());
    changed();
  }
  const refused = what => { if (!circlesLocked()) return false; log('circles locked', { what }); return true; };
  // the headsets' three settings (HOST.xr: labels in 3D (turned to you, in the scene), on top or hidden; free moving on or off;
  // subtitles on or off) are the room's in a room, for everyone in it (key look: { labels, free, subs, by, at }; a room
  // without it: everything in 3D, no subtitles), set from a headset's menu or the page's dialog, and never refused by
  // either lock. Null outside a room (the device's own)
  const LOOKS = ['face', 'fixed', 'hidden'], LOOK0 = { labels: 'fixed', free: true, subs: false };
  function look() {
    if (!C.code || !C.welcomed) return null;
    const v = val('look'), b = k => (v && typeof v[k] === 'boolean' ? v[k] : LOOK0[k]);
    return { labels: v && LOOKS.includes(v.labels) ? v.labels : LOOK0.labels, free: b('free'), subs: b('subs') };
  }
  const freeNow = () => (HOST.xr && HOST.xr.free ? HOST.xr.free() : true);
  function setLook(o) {
    const L = look();
    if (!L) return false;
    const v = { labels: LOOKS.includes(o.labels) ? o.labels : L.labels, free: typeof o.free === 'boolean' ? o.free : L.free, subs: typeof o.subs === 'boolean' ? o.subs : L.subs };
    const pairs = [['look', { labels: v.labels, free: v.free, subs: v.subs, by: C.id, at: Math.round(now()) }]];
    // free moving off: every station's scene and panel stand as without it (no turn, the panel upright at its yaw)
    if (L.free && !v.free) {
      for (const k of new Set([...C.keys.keys(), ...C.pending.keys()])) {
        const x = /^st\.[\w-]+\.(place|panel)$/.test(k) && val(k);
        if (x && typeof x === 'object' && x.q !== undefined) { const y = Object.assign({}, x); delete y.q; pairs.push([k, y]); }
      }
    }
    publish(pairs);
    log('look', v);
    changed();
    return true;
  }
  // Panels per story (HOST.panels: shown, controls only or hidden) and each story's lock: in a room each station's, for
  // everyone at its circle (key st.<id>.ui: { panels, lock, story, by, at }; a station without it, or with one written for
  // its story before it changed: shown, not locked), set from a headset's menu at that station or from the page's dialog
  // for any station, and never refused by the circles lock. A station given another story loses it with its other keys
  // (the relay's epoch rule). The story's lock (Lock this story): the grip moving, turning or resizing the station's scene
  // and moving or tilting its panel is refused for everyone at its circle (HOST.room.gripLocked there, and its panels say
  // so); the circles stay as the circles lock has them
  const PANELS = ['shown', 'controls', 'hidden'], kUi = id => 'st.' + id + '.ui';
  const uiOf = s => { const v = s && val(kUi(s.id)); return v && typeof v === 'object' && ofStory(v, s) ? v : null; };
  function stPanels(s) {
    const v = uiOf(s);
    return v && PANELS.includes(v.panels) ? v.panels : 'shown';
  }
  const stLocked = s => { const v = uiOf(s); return !!(v && v.lock === true); };
  // (one key for both: a write keeps the other's value)
  function setUi(id, o, what) {
    const s = C.stById.get(id);
    if (!C.code || !s) return false;
    const v = { panels: o.panels || stPanels(s), lock: typeof o.lock === 'boolean' ? o.lock : stLocked(s), story: s.story, by: C.id, at: Math.round(now()) };
    publish([[kUi(id), v]]);
    log(what, { st: id, panels: v.panels, lock: v.lock });
    changed();
    return true;
  }
  const setStPanels = (id, v) => PANELS.includes(v) && setUi(id, { panels: v }, 'panels');
  const setStLock = (id, on) => { const ok = setUi(id, { lock: !!on }, 'story lock'); if (ok) sfx(on ? 'lock' : 'unlock', menuAt()); return ok; };
  // for HOST.panels: at a station of this story (a headset in its circle, a page following it), the station's; else null
  const panelsAt = key => { const L = liveSt(); return C.code && L && L.story === key ? stPanels(L) : null; };   // (kept while a link moves or reconnects)
  const setPanels = (key, v) => !!panelsAt(key) && setStPanels(C.live, v);
  // Arrange all: every story in two rows in front of you (half, rounded up, in front), spots 2.4 m apart,
  // every station facing away from you, so its content floats beyond its spot and faces your side; a story that
  // already has a station keeps it (moved, its state kept)
  function arrange(b) {
    if (refused('arrange')) return;
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
    // (a second station of a story goes; one of a story this device does not know, or of a page that is not a story, such
    // as the design room's table, stays where it is: never part of Arrange all)
    for (const s of C.st) if (!used.has(s.id) && HOST.list.some(m => m.key === s.story)) pairs.push(['st.' + s.id, null]);
    log('arrange', { stations: n });
    publish(pairs);
    // a soft thunk at each new spot, one after another along the rows (on a screen from left to right)
    pairs.filter(([k, v]) => ST_RE.test(k) && v).forEach(([, v], i) => {
      const side = (i % front - (front - 1) / 2) / Math.max(1, front / 2);
      sfx('place', roomAt(v.x, 0.05, v.z), { delay: i * 0.07, gain: 0.7, force: true, pan: side * 0.5 });
    });
  }
  // what Add offers (the page's picker, the headset's Add page): every story, then the pages that are not stories (the
  // design room's table), which only Add and the menu's Design room button place, never Arrange all
  const addable = () => HOST.list.concat((self.STORY_EXTRA || []).filter(m => m && m.key && !HOST.list.some(x => x.key === m.key)));
  const addName = m => (HOST.list.includes(m) ? m.title : m.kick || m.title);
  // Add a station here: one story at your feet, facing where you face
  function add(story, b) {
    if (!meta(story) || meta(story).unknown || refused('add')) return '';
    b = b || base();
    const id = rid(5);
    publish([['st.' + id, { story, x: r3(b.x), z: r3(b.z), yaw: r3(b.yaw) }], [kPlay(id), startClock(story)]]);
    sfx('place', roomAt(b.x, 0.05, b.z));
    return id;
  }
  function move(id, b) {
    const s = C.stById.get(id);
    if (!s || refused('move')) return;
    b = b || base();
    publish([['st.' + id, { story: s.story, x: r3(b.x), z: r3(b.z), yaw: r3(b.yaw) }]]);
    sfx('place', roomAt(b.x, 0.05, b.z));
  }
  function remove(id) { if (C.stById.has(id) && !refused('remove')) publish([['st.' + id, null]]); }
  // the design room's table here (the menu's Design room button in a room): a station of it at your feet, facing your
  // way, or the room's one moved here when it has one (one table, not a pile of them); refused while the circles are locked
  const DESIGN = 'design';
  function designHere(b) {
    const has = C.st.find(s => s.story === DESIGN);
    if (!C.code || refused(has ? 'move' : 'add')) return '';
    if (!has) { const id = add(DESIGN, b); if (id) log('design here', { st: id, added: true }); return id; }
    move(has.id, b);
    log('design here', { st: has.id, moved: true });
    return has.id;
  }

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
    if (L && L.story === HOST.curKey) { clockApply(true); stateApply(); PL.id = ''; }
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
  // The station's panel (relative to its spot: x, y over the floor, z, yaw, and with free moving its rotation q) and its
  // scene (moved from where the story puts it, x, y, z, sized, s, and with free moving turned, q), moved here with the
  // grip (both hands on the scene resize it): they go out to the room ten times a second while held and once more when
  // let go, so the others see them move; otherwise they glide to the room's values (and are put there at once when a
  // station is reached). Every frame, from the shell's tick.
  const PL = { id: '', held: { panel: false, globe: false }, quiet: { panel: 0, globe: 0 }, at: 0 };
  const PLACE0 = { x: 0, y: 0, z: 0, s: 1, q: null };
  const SIZE = [0.25, 4];   // a scene's size: a quarter to four times the story's own
  const clampS = v => Math.min(SIZE[1], Math.max(SIZE[0], v));
  const panelHome = () => ({ x: PANEL_HOME.p[0], y: PANEL_HOME.p[1] + EYE, z: PANEL_HOME.p[2], yaw: PANEL_HOME.yaw, q: null });
  // turns (free moving) as [x, y, z, w]: the scene's (q of the place; none: not turned) and the panel's (q of the panel;
  // none: upright at its yaw). They go out to 4 decimals, w never negative (q and -q are one turn); with free moving
  // off the room's are not taken (turning it off takes them out of the room: setLook)
  const r4 = x => Math.round(x * 10000) / 10000;
  const Q1 = [0, 0, 0, 1];
  const validQ = q => Array.isArray(q) && q.length === 4 && q.every(Number.isFinite) && Math.abs(Math.hypot(...q) - 1) < 0.01;
  const qOf = q => (!q ? null : Array.isArray(q) ? (validQ(q) ? q.slice() : null) : Number.isFinite(q.w) ? [q.x, q.y, q.z, q.w] : null);   // a story's (a quaternion)
  const qOut = q => { const n = Math.hypot(...q) || 1, k = q[3] < 0 ? -1 : 1; return q.map(c => r4(k * c / n) + 0); };
  const qAng = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));
  const yawQ = y => [0, Math.sin(y / 2), 0, Math.cos(y / 2)];
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
  const qSlerp = (a, b, k) => _qa.fromArray(a).slerp(_qb.fromArray(b), k).toArray();
  // (each value names its story: one written for the station's story before it changed is no longer taken)
  const ofStory = (v, L) => !v.story || v.story === L.story;
  const validPanel = (v, L) => !!(v && typeof v === 'object' && ['x', 'y', 'z', 'yaw'].every(k => Number.isFinite(v[k])) && ofStory(v, L));
  const validPlace = (v, L) => !!(v && typeof v === 'object' && ['x', 'y', 'z', 's'].every(k => Number.isFinite(v[k])) && v.s > 0 && ofStory(v, L));
  const roomQ = v => (freeNow() && validQ(v.q) ? v.q.slice() : null);
  const roomPanel = L => { const v = val(kPanel(L.id)); return validPanel(v, L) ? { x: v.x, y: v.y, z: v.z, yaw: v.yaw, q: roomQ(v) } : panelHome(); };
  const roomPlace = L => { const v = val(kPlace(L.id)); return validPlace(v, L) ? { x: v.x, y: v.y, z: v.z, s: clampS(v.s), q: roomQ(v) } : PLACE0; };
  function placeSync(dt, t) {
    const L = liveSt();
    if (!synced(L) || !R.placing() || HOST.picking || !C.hook.panel) { PL.id = ''; return; }
    let p = null;
    try { p = HOST.cur.xrPose(); } catch (e) { /* not in a headset */ }
    if (!p) return;
    // (as they are here; rounded only when they go out, or easing would stall a few millimetres short). The panel's
    // yaw is its heading (its rotation's own y is not, once it is tilted or turned past 90 degrees); a turn only when
    // there is one: the scene turned, the panel tilted
    const pq = qOf(p.pq), rot = qOf(p.rot);
    let pyaw = p.pr;
    if (pq) { _v.set(0, 0, 1).applyQuaternion(_q.fromArray(pq)); if (Math.hypot(_v.x, _v.z) > 0.1) pyaw = Math.atan2(_v.x, _v.z); }
    const cur = { panel: { x: p.pp.x, y: p.pp.y + EYE, z: p.pp.z, yaw: pyaw, q: pq && qAng(pq, yawQ(pyaw)) > 0.001 ? pq : null },
      globe: { x: p.off.x, y: p.off.y, z: p.off.z, s: clampS(+p.s || 1), q: rot && qAng(rot, Q1) > 0.001 ? rot : null } };
    const room = { panel: roomPanel(L), globe: roomPlace(L) };
    const put = (w, v) => {
      try { if (w === 'panel') C.hook.panel([v.x, v.y - EYE, v.z], v.yaw, v.q || null); else if (C.hook.place) C.hook.place([v.x, v.y, v.z], v.s, v.q || null); } catch (e) { /* story not ready */ }
    };
    if (PL.id !== L.id) { PL.id = L.id; PL.held = { panel: false, globe: false }; put('panel', room.panel); put('globe', room.globe); return; }   // a station reached: as the room has it
    const lk = stLocked(L), hs = String(p.held || ''), out = [];   // held: what a grip holds there ('panel', 'globe'); lk: this story's lock
    for (const w of ['panel', 'globe']) {
      const held = !lk && hs.includes(w), a = cur[w], b = room[w];
      // the turns compared and eased: the panel's upright at its yaw when it has none, the scene's none
      const qa = a.q || (w === 'panel' ? yawQ(a.yaw) : Q1), qb = b.q || (w === 'panel' ? yawQ(b.yaw) : Q1), dq = qAng(qa, qb);
      // held: out to the room ten times a second, and once more when let go (locked meanwhile: nothing more goes out,
      // and it goes back to where the room has it); the other one, not held, goes on following the room
      if (held || PL.held[w]) {
        PL.held[w] = held;
        if (!held) PL.quiet[w] = t + 400;   // (our last write on its way)
        if ((held && t - PL.at < 100) || (!held && lk)) continue;
        if (w === 'panel') {
          const v = { x: r3(a.x), y: r3(a.y), z: r3(a.z), yaw: r3(a.yaw) };
          if (a.q) v.q = qOut(a.q);
          if (Math.hypot(v.x - b.x, v.y - b.y, v.z - b.z) > 0.002 || Math.abs(v.yaw - b.yaw) > 0.004 || dq > 0.004) out.push([kPanel(L.id), Object.assign(v, { story: L.story })]);
        } else {
          const v = { x: r3(a.x), y: r3(a.y), z: r3(a.z), s: r3(a.s) };
          if (a.q) v.q = qOut(a.q);
          if (Math.hypot(v.x - b.x, v.y - b.y, v.z - b.z) > 0.002 || Math.abs(v.s - b.s) > 0.002 || dq > 0.004) out.push([kPlace(L.id), Object.assign(v, { story: L.story })]);
        }
        continue;
      }
      if (t < PL.quiet[w]) continue;
      // the room's value glides in (the last couple of millimetres at once); a turn by slerp
      const k = 1 - Math.exp(-dt * 12), d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), q = a.q || b.q ? qSlerp(qa, qb, k) : null;
      if (w === 'panel') {
        let y = (b.yaw - a.yaw) % (2 * Math.PI);
        if (y > Math.PI) y -= 2 * Math.PI; else if (y < -Math.PI) y += 2 * Math.PI;
        if (d < 1e-6 && Math.abs(y) < 1e-6 && dq < 1e-6) continue;
        put(w, d < 0.002 && Math.abs(y) < 0.003 && dq < 0.003 ? b : { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: a.yaw + y * k, q });
      } else {
        const ds = Math.abs(Math.log(b.s / a.s));
        if (d < 1e-6 && ds < 1e-6 && dq < 1e-6) continue;
        put(w, d < 0.002 && ds < 0.001 && dq < 0.003 ? b : { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, s: a.s * Math.pow(b.s / a.s, k), q });
      }
    }
    if (out.length) { PL.at = t; publish(out); }
  }

  // the scene's view at a station in a headset (explore mode: how the story turns and sizes its scene, which is
  // where it stands in the room): shared by the headsets there, so they see it alike (a view from the room glides
  // in; one turned here goes out). Screens keep their own camera; story mode follows the clock.
  function viewSync() {
    const L = liveSt();
    if (!synced(L) || !R.placing() || !C.hook.view || !C.hook.setView) return;
    const k = kView(L.id), room = val(k), seen = k + J(room);
    let cur = null;
    try { cur = C.hook.view(); } catch (e) { return; }
    if (room != null && seen !== C.viewSeen && !C.pending.has(k)) {   // new from the room (or a station just reached)
      C.viewSeen = seen;
      if (J(cur) !== J(room)) { log('view', { st: L.id }); guarded(() => { try { C.hook.setView(room); } catch (e) { log('view failed', { e: e.message }); } }); }
      return;
    }
    if (cur != null && J(cur) !== J(room)) { publish([[k, cur]]); C.viewSeen = k + J(cur); }
  }

  // ------------------------------------------- the pump: five times a second --
  function pump() {
    const t = performance.now();
    if (t - C.pumpAt < 190) return;
    if (t - C.pumpAt > 1500) C.busy = clock();   // (this page was busy, or hidden: nothing heard meanwhile is no sign of silence)
    C.pumpAt = t;
    attachCheck();
    // (in no room, with the dialog or the menu open: the rooms on this network looked for again now and then)
    if (!C.code) { if ((C.listing.dialog || (C.listing.menu && HOST.session)) && C.nearAt && t - C.nearAt > 15000 && !C.nearBusy) nearFind('again'); return; }
    if (C.local) probe(t);
    slotStep(t);   // (a peer-to-peer host: shown on its network)
    if (C.ws && C.ws.readyState === 1) {
      // (peer to peer every 2 s: a guest knows within 6 s that its host has stopped answering)
      const peer = C.via === 'peer', still = clock() - Math.max(C.heard, C.busy);
      if (t - C.pingAt > (peer || t - C.openAt < 20000 ? 2000 : 15000)) ping();
      if (peer && C.ws.role === 'guest' && still > SILENT) spareTry(t);
      else if (C.spare && still < SILENT) spareOff();
      if (clock() - C.heard > 40000) { log('silent socket'); drop('silent'); }
    }
    whoStep(t);   // (a person followed: their station first)
    const L = liveSt();
    if (synced(L) && !HOST.picking) { if (!C.clockT) clockApply(false); statePoll(); viewSync(); }
    // a switch the room asked for that got lost (a story still loading drops a second request): ask again
    else if (L && L.story !== HOST.curKey && (C.mine === L.id || C.follow === L.id) && !HOST.busy && t - C.goAt > 3000) goTo(L);
    for (const [id, P] of C.pres) if (t - P.at > (P.head ? 3000 : 8000)) C.pres.delete(id);
    // a desktop says which station it follows, now and then (headsets say it with their presence)
    if (!HOST.session && t - C.deskAt > 2000) { C.deskAt = t; fx('p.' + C.id, { st: C.follow || '' }); }
    if (DLG.open) drawMap();
  }
  // from a timer and from the page's frames: a page whose frames take long (software WebGL, a slow phone) can starve
  // its timers for seconds while it draws, and a page following a station then fell behind its clock
  setInterval(pump, 200);
  (function frame() { pump(); requestAnimationFrame(frame); })();

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
    // (a switch, drawn lit or not: its press sounds as turning it off or on; tog null: a plain button)
    if (fn) S.regions.push({ id, x, y, w, h, fn, tog: typeof o.on === 'boolean' ? o.on : null });
  }
  function build() {
    if (OV.root) return;
    OV.root = new THREE.Group(); OV.root.name = 'shared';
    OV.room = new THREE.Group(); OV.room.matrixAutoUpdate = false;
    OV.root.add(OV.room);
    OV.panelG = new THREE.Group();
    OV.panel = sheet(720, 1716, 0.42, 53);   // (the tallest it gets: a room on this headset with a three-line note, at a station, 1687 px)
    OV.panelG.add(OV.panel.mesh); OV.root.add(OV.panelG);
    OV.panel.mesh.userData.shell = { kind: 'panel' };
    // the menu's clock: the group's origin is the face's middle
    OV.clockG = new THREE.Group();
    OV.clock = sheet(CLOCK.w, CLOCK.h, CLOCK.mw, 53);
    OV.clock.mesh.position.y = -(CLOCK.h / 2 - CLOCK.cy) * CLOCK.mw / CLOCK.w;
    OV.clockG.add(OV.clock.mesh); OV.root.add(OV.clockG);
    OV.clock.mesh.userData.shell = { kind: 'clock' };
    OV.note = sheet(720, 170, 0.5, 54);
    OV.root.add(OV.note.mesh); OV.note.mesh.visible = false;
    // the subtitles' strip (drawSubs): over the story's panels, under the menu and the notices
    OV.sub = sheet(SUBS.w, SUBS.h, SUBS.mw, 51);
    OV.root.add(OV.sub.mesh); OV.sub.mesh.visible = false; OV.sub.text = ''; OV.sub.want = '';
    // the tape marks where this headset puts them (in the room), and while calibrating a bright ring at each
    // controller's ray origin (the point a mark takes) and a cross at mark A once taken (scene coordinates)
    OV.marks = new THREE.Group(); OV.marks.visible = false;
    OV.crossA = cross(); OV.crossB = cross();
    OV.markLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]),
      new THREE.LineBasicMaterial({ color: MARK, transparent: true, opacity: 0.8 }));
    OV.marks.add(OV.crossA, OV.crossB, OV.markLine); OV.room.add(OV.marks);
    OV.aims = [aim(), aim()]; OV.calA = cross();
    OV.root.add(OV.aims[0], OV.aims[1], OV.calA);
    OV.root.visible = false;
  }
  const MARK = 0xffb43b;
  function cross() {
    const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: MARK });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.004, 0.01), m), new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.004, 0.14), m),
      new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), m));
    g.visible = false;
    return g;
  }
  function aim() {
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide });
    const g = new THREE.Group(), ring = new THREE.Mesh(new THREE.RingGeometry(0.013, 0.018, 32), m), dot = new THREE.Mesh(new THREE.CircleGeometry(0.0035, 16), m);
    ring.renderOrder = dot.renderOrder = 75;
    g.add(ring, dot); g.visible = false;
    return g;
  }
  function drawMarks() {
    const mk = R.mk, t = performance.now();
    OV.marks.visible = OV.room.visible && !!mk && !R.calib && (PNL.open || t < R.showUntil);
    if (OV.marks.visible) {
      OV.crossA.position.set(0, mk[0], 0); OV.crossB.position.set(mk[1], mk[2], 0);
      OV.crossA.visible = OV.crossB.visible = true;
      const a = OV.markLine.geometry.attributes.position;
      a.setXYZ(0, 0, mk[0], 0); a.setXYZ(1, mk[1], mk[2], 0); a.needsUpdate = true;
      OV.markLine.geometry.computeBoundingSphere();
    }
    for (let i = 0; i < 2; i++) {
      const h = C.rays.get(i), A = OV.aims[i];
      A.visible = !!(R.calib && h && C.frameN - h.n <= 2);
      if (A.visible) { A.position.copy(h.o); if (HD.ok) A.lookAt(HD.p); }
    }
    OV.calA.visible = !!(R.calib && R.calib.a && R.lfOK);
    if (OV.calA.visible) OV.calA.position.copy(R.calib.a).applyMatrix4(R.lf);
  }
  function hang(sc) { build(); if (OV.root.parent !== sc) sc.add(OV.root); }

  // ------------------------------------------------------------ station icons --
  // Over each station's ring its story's main miniature (the icon of its entry in stories/list.js: a key of
  // LOWPOLY_MODELS, lowpoly.js, loaded once through HOST.lowpoly()), small, in the story's colour and slowly turning, so
  // people can tell from across the room which circle is which story (in a room a story is reached only by walking into
  // its circle). Each story's is built once, the first time a station of it shows (one a frame), and kept: the
  // miniature's parts merged into one mesh (one draw call; its see-through parts, glass and haze, in a second), with a
  // soft glow behind it, and lit by its own shader (a light from over your shoulder and a rim, in view space), so it
  // looks the same in every story's scene whatever lights that has. Its colours are the miniature's own drawn towards the
  // story's (ICON.tint: by lightness, from a dark tone of it through the colour to a lighter one). It follows the rings,
  // not the cards: it is part of the station, not a label, and with labels hidden it is all that tells the circles
  // apart. While lowpoly.js loads, and for a key without a miniature, a glowing polyhedron in the story's colour stands
  // there, so a new story needs only its icon in the list.
  // y: its middle over the floor (above the heads of people in the circle and the card's top edge, 1.6 m, so it
  // covers neither from across the room); size: 1 model unit in metres (miniDef fits each miniature); turn: s; tint:
  // how far the miniature's colours go to the story's
  const ICON = { y: 2.1, size: 0.3, turn: 12, tint: 0.55, defs: new Map(), mat: null, see: null, tex: null, halos: new Map(), models: null, askAt: 0, built: -1 };
  // the miniatures, once lowpoly.js is here (asked for the first time an icon wants one; a failed load again 30 s later)
  function iconModels() {
    if (ICON.models) return ICON.models;
    const M = self.LOWPOLY_MODELS;
    if (M && Object.keys(M).length) return (ICON.models = M);
    if (HOST.lowpoly && performance.now() >= ICON.askAt) {
      ICON.askAt = performance.now() + 30000;
      HOST.lowpoly().then(L => { ICON.models = L; }, e => log('icons', { err: String(e && e.message || e) }));
    }
    return null;
  }
  const iconOf = key => { const m = meta(key); return (m && typeof m.icon === 'string' && m.icon) || ''; };
  // the story's tones: its colour, a dark one and a nearly white one
  function tones(key) {
    const m = meta(key), b = new THREE.Color((m && m.col) || CYAN), white = new THREE.Color(1, 1, 1);
    return { b, l: b.clone().lerp(white, 0.4), w: b.clone().lerp(white, 0.75), d: b.clone().multiplyScalar(0.42) };
  }
  // the glow behind it, in the story's colour (one material per colour)
  function haloFor(col) {
    const k = col.getHex();
    if (!ICON.halos.has(k)) ICON.halos.set(k, new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    return ICON.halos.get(k);
  }
  // geometry from parts { g (non-indexed: position, normal), c (a colour, or per vertex as an array), e (glow 0 lit to 1
  // glowing), a (see-through: opacity), m (a matrix) }, merged into one; null when there are none
  function mergeParts(parts, see) {
    if (!parts.length) return null;
    let n = 0;
    for (const p of parts) n += p.g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), glow = new Float32Array(n), alpha = see ? new Float32Array(n) : null;
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    let o = 0;
    for (const p of parts) {
      const P = p.g.attributes.position, N = p.g.attributes.normal, c = p.g.attributes.color, cnt = P.count;
      nm.getNormalMatrix(p.m);
      for (let i = 0; i < cnt; i++, o++) {
        v.fromBufferAttribute(P, i).applyMatrix4(p.m).toArray(pos, o * 3);
        v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize().toArray(nor, o * 3);
        if (p.c) p.c.toArray(col, o * 3); else { col[o * 3] = c.getX(i); col[o * 3 + 1] = c.getY(i); col[o * 3 + 2] = c.getZ(i); }
        glow[o] = p.e; if (alpha) alpha[o] = p.a;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
    if (alpha) geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    geo.computeBoundingSphere();
    return geo;
  }
  // a story's icon from its miniature: every mesh of it, centred and sized as the first models were (its box in a ball of
  // 0.6, its longest side at most 0.9: a globe about 0.2 m across), its colours drawn towards the story's; the parts
  // that glow (emissive) stay nearly unlit; the see-through ones (glass, haze) apart
  function miniDef(key, mk, model) {
    const grp = model.build(THREE), T = tones(key), solid = [], see = [], c = new THREE.Color(), t = new THREE.Color();
    grp.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(grp), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const s = Math.min(0.9 / Math.max(1e-6, size.x, size.y, size.z), 0.6 / Math.max(1e-6, size.length() / 2)), fit = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-mid.x, -mid.y, -mid.z));
    // its own colour by lightness to the story's tones (dark, the colour, a lighter one: white parts too take the
    // story's colour), then mixed in by ICON.tint
    const tint = (r, g, b) => {
      const L = Math.min(1, 0.2126 * r + 0.7152 * g + 0.0722 * b + 0.1);
      if (L < 0.45) t.copy(T.d).lerp(T.b, L / 0.45); else t.copy(T.b).lerp(T.l, (L - 0.45) / 0.55);
      return c.setRGB(r, g, b).lerp(t, ICON.tint);
    };
    grp.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material, g0 = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      if (!g0.attributes.normal) g0.computeVertexNormals();
      const vc = g0.attributes.color, cnt = g0.attributes.position.count, own = m.color || new THREE.Color(1, 1, 1);
      // per vertex: its colour tinted (a copy, so the miniature's own stays as it was built)
      const tc = new THREE.BufferAttribute(new Float32Array(cnt * 3), 3);
      for (let i = 0; i < cnt; i++) { const k = tint(vc ? vc.getX(i) : own.r, vc ? vc.getY(i) : own.g, vc ? vc.getZ(i) : own.b); tc.setXYZ(i, k.r, k.g, k.b); }
      g0.setAttribute('color', tc);
      const e = m.emissive && m.emissive.getHex() ? Math.min(1, m.emissiveIntensity || 0) : 0, a = m.transparent ? Math.max(0.12, m.opacity) : 1;
      (a < 1 || m.blending === THREE.AdditiveBlending ? see : solid).push({ g: g0, c: null, e, a: Math.min(a, 0.6), m: fit.clone().multiply(o.matrixWorld), own: g0 !== o.geometry });
    });
    const geo = mergeParts(solid, false), seeGeo = mergeParts(see, true);
    for (const p of solid.concat(see)) if (p.own) p.g.dispose();
    grp.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    // the flat ones (a slide, a room) lean back further, so their top always shows: by how low they are
    const flat = Math.max(0, Math.min(0.95, 1.6 * (0.6 - size.y / Math.max(size.x, size.z, 1e-6))));
    return { model: mk, geo: geo || new THREE.BufferGeometry(), see: seeGeo, flat, halo: haloFor(T.b) };
  }
  // any key without its miniature (or before lowpoly.js is here): a glowing polyhedron with a ring round it
  function fallbackDef(key) {
    const T = tones(key), parts = [];
    const add = (g, col, e, mx) => { const n = g.toNonIndexed(); n.computeVertexNormals(); parts.push({ g: n, c: col, e, a: 1, m: mx || new THREE.Matrix4() }); g.dispose(); };
    add(new THREE.DodecahedronGeometry(0.3), T.b, 0.3);
    add(new THREE.TorusGeometry(0.42, 0.013, 3, 28), T.l, 0.9, new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(1.2, 0, 0.3)));
    const geo = mergeParts(parts, false);
    for (const p of parts) p.g.dispose();
    return { model: '', geo, see: null, flat: 0, halo: haloFor(T.b) };
  }
  // a story's icon, built the first time asked and kept: its miniature once lowpoly.js is here, else the fallback. soon:
  // a miniature only if none was built this frame (a room's first view would build every one at once)
  function iconDef(key, soon) {
    const mk = iconOf(key), M = mk ? iconModels() : null, want = M && M[mk] ? mk : '', f = C.frameN || 0;
    let D = ICON.defs.get(key + '|' + want);
    if (D) return D;
    if (!want || (soon && ICON.built === f)) {   // (the miniature, if any, next frame)
      if (!ICON.defs.has(key + '|')) ICON.defs.set(key + '|', fallbackDef(key));
      return ICON.defs.get(key + '|');
    }
    try {
      D = miniDef(key, mk, M[mk]);
      log('icon built', { key, model: mk, tris: D.geo.attributes.position.count / 3 + (D.see ? D.see.attributes.position.count / 3 : 0) });
    } catch (e) { log('icon failed', { key, model: mk, err: String(e && e.message || e) }); D = fallbackDef(key); }   // (kept: not tried every frame)
    ICON.built = f;
    ICON.defs.set(key + '|' + want, D);
    return D;
  }
  // one material for every icon: the tone lit from over your shoulder (view space, so every side looks alike), glowing
  // parts nearly unlit, and a rim in a paler tone all round (the rings' glow); see: the see-through parts' (their
  // opacity, more at the rim, written after the rest without depth)
  function iconMat(see) {
    const k = see ? 'see' : 'mat';
    return ICON[k] || (ICON[k] = new THREE.ShaderMaterial({
      vertexColors: true, side: THREE.DoubleSide, transparent: !!see, depthWrite: !see, defines: see ? { SEE: '' } : {},
      vertexShader: `attribute float glow; varying vec3 vN, vV, vC; varying float vG;
        #ifdef SEE
        attribute float alpha; varying float vA;
        #endif
        void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -p.xyz; vC = color; vG = glow;
          #ifdef SEE
          vA = alpha;
          #endif
          gl_Position = projectionMatrix * p; }`,
      fragmentShader: `varying vec3 vN, vV, vC; varying float vG;
        #ifdef SEE
        varying float vA;
        #endif
        void main() {
          vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), v = normalize(vV);
          float d = max(dot(n, normalize(vec3(-0.45, 0.7, 0.55))), 0.0), rim = pow(1.0 - abs(dot(n, v)), 2.0);
          vec3 c = mix(vC * (0.24 + 0.16 * n.y + 0.72 * d), vC * 1.15, vG) + mix(vC, vec3(1.0), 0.3) * rim * 0.7;
          #ifdef SEE
          gl_FragColor = vec4(c, clamp(vA * (0.6 + 1.4 * rim), 0.0, 0.9));
          #else
          gl_FragColor = vec4(c, 1.0);
          #endif
        }`,
    }));
  }
  // the soft glow behind it: a white blur tinted with the story's colour, added to what is behind
  function glowTex() {
    if (ICON.tex) return ICON.tex;
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    cv.width = cv.height = 64;
    const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);
    return (ICON.tex = new THREE.CanvasTexture(cv));
  }
  // an icon: g turned to you (the glow behind the model, from where you are), lean tipping the model's top towards
  // you, spin turning it about its own axis. soon: as iconDef (the fallback until its miniature is built)
  function makeIcon(key, ph, soon) {
    const I = { key, g: new THREE.Group(), lean: new THREE.Group(), spin: new THREE.Group(), mesh: new THREE.Mesh(undefined, iconMat(false)), see: null,
      halo: new THREE.Sprite(), flat: 0, ph: ph || 0, k: 1, D: null, model: '' };
    I.mesh.scale.setScalar(ICON.size); I.halo.scale.setScalar(ICON.size * 2.3); I.halo.position.z = -ICON.size * 0.6;
    I.spin.add(I.mesh); I.lean.add(I.spin); I.g.add(I.halo, I.lean);
    iconUse(I, iconDef(key, soon));
    return I;
  }
  // an icon takes a def (its miniature in place of the fallback, once built)
  function iconUse(I, D) {
    I.D = D; I.model = D.model; I.flat = D.flat; I.mesh.geometry = D.geo; I.halo.material = D.halo;
    if (I.see) { I.spin.remove(I.see); I.see = null; }
    if (D.see) { I.see = new THREE.Mesh(D.see, iconMat(true)); I.see.scale.setScalar(ICON.size); I.spin.add(I.see); }
  }
  function poseIcon(I, yaw, lean, t) {
    I.g.rotation.y = yaw; I.lean.rotation.x = lean + I.flat; I.spin.rotation.y = I.ph + t * 2 * Math.PI / ICON.turn;
  }
  // over a station's ring (o its ring's group, at its spot, turned its way): turned to your head and leant back as far
  // as you look up at it, plus a little, so its top shows; it shrinks away at your own station (its story is in front of
  // you) and over the other stations while you are in a circle (seen: grown back while pointed at). Its miniature takes
  // the fallback's place once built (also while it is hidden, so showing it again costs no build)
  function iconStep(o, S, seen, dt) {
    const I = o.icon;
    if (!I.model && iconOf(I.key)) { const D = iconDef(I.key, true); if (D !== I.D) iconUse(I, D); }
    I.k += ((seen ? 1 : 0) - I.k) * (1 - Math.exp(-dt * 6));
    I.g.visible = I.k > 0.02;
    if (!I.g.visible) return;
    I.g.scale.setScalar(I.k); I.g.position.y = ICON.y / o.g.scale.y;
    let yaw = 0, lean = 0.3;
    if (R.headOK) {
      const dx = R.hr.x - S.x, dz = R.hr.z - S.z;
      yaw = Math.atan2(dx, dz) - S.yaw; lean = Math.min(0.7, Math.max(0.1, Math.atan2(ICON.y - R.hr.y, Math.hypot(dx, dz)) + 0.2));
    }
    poseIcon(I, yaw, lean, performance.now() / 1000);
  }

  // a preview of a station that is not live here: a ring on the floor at its spot in the story's colour, its icon over
  // it, and a small upright card where its content would float (title, who is there, playing at 1:23 / exploring)
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
      // its icon turns in its own phase (not in step with the others)
      o = { g, ring, mat, story: s.story, icon: makeIcon(s.story, [...s.id].reduce((a, ch) => a + ch.charCodeAt(0) * 2.39996, 0) % (2 * Math.PI), true) };
      g.add(o.icon.g);
      OV.rings.set(s.id, o); OV.room.add(g);
    }
    if (o.story !== s.story) {
      o.mat.color.set(meta(s.story).col); o.story = s.story;
      const I = makeIcon(s.story, o.icon.ph, true);
      I.k = o.icon.k; o.g.remove(o.icon.g); o.g.add(I.g); o.icon = I;
    }
    const S = shown(s), held = MV.id === s.id;
    o.g.position.set(S.x, 0, S.z); o.g.rotation.set(0, S.yaw, 0); o.g.scale.setScalar(held ? 1.12 : 1);
    return o;
  }
  function cardFor(s, lm) {
    let o = OV.cards.get(s.id);
    if (!o) {
      o = sheet(560, 330, 0.5, 49);   // on top: drawn before the story's panels (50), so a panel in front stays on top
      o.mesh.material.depthTest = true;
      // two faces back to back, so it reads the right way round from behind too (the card in 3D stays put)
      o.mesh.material.side = THREE.FrontSide;
      o.back = new THREE.Mesh(o.mesh.geometry, o.mesh.material);
      o.back.rotation.y = Math.PI; o.back.renderOrder = 49;
      o.mesh.userData.shell = o.back.userData.shell = { kind: 'station', id: s.id };
      o.mesh.add(o.back);
      OV.cards.set(s.id, o); OV.room.add(o.mesh);
    }
    // labels in 3D: in the scene as the labels' signs are (drawn first of the see-through things, writing depth, its
    // clear corners cut away), so a glowing or glass model in front hides it; on top: drawn after the scenes. Set only
    // when the mode changes (a new alphaTest needs the material built again)
    const fixed = lm === 'fixed';
    if (o.fixed !== fixed) {
      const m = o.mesh.material;
      o.fixed = m.depthWrite = fixed; m.alphaTest = fixed ? 0.1 : 0; m.needsUpdate = true;
      o.mesh.renderOrder = o.back.renderOrder = fixed ? -1 : 49;
    }
    const S = shown(s), [cx, cz] = content(S);
    // turned to you, upright (seen from another row it would be back to front), on top or in 3D alike: it is a card in
    // the room either way; without a head, facing back to its spot
    o.mesh.position.set(cx, 1.45, cz); o.mesh.rotation.set(0, R.headOK ? Math.atan2(R.hr.x - cx, R.hr.z - cz) : S.yaw, 0);
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
    const m = meta(s.story), who = whoAt(s.id), held = MV.id === s.id, lk = circlesLocked(), sig = [s.story, stationLine(s), who.join(','), o.hover, held, lk].join('|');
    if (sig === o.sig) return;
    o.sig = sig;
    const ctx = o.ctx, W = o.w, H = o.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    rr(ctx, 4, 4, W - 8, H - 8, 22); ctx.fillStyle = 'rgba(8,15,28,0.92)'; ctx.fill();
    ctx.lineWidth = o.hover ? 6 : 3; ctx.strokeStyle = o.hover ? m.col : 'rgba(140,170,210,0.35)'; ctx.stroke();
    ctx.fillStyle = m.col; ctx.fillRect(4, 4, W - 8, 9);
    ctx.font = FONT(24, 700); ctx.fillStyle = m.col; ctx.fillText(fit(ctx, m.kick.toUpperCase(), W - 64), 32, 36);
    let tp = 54;   // a long title smaller (down to 44 px, on the same baseline: B612's is 0.8 of its size down), else cut short
    for (; ; tp--) { ctx.font = FONT(tp, 700); if (tp <= 44 || ctx.measureText(m.title).width <= W - 64) break; }
    ctx.fillStyle = INK; ctx.fillText(fit(ctx, m.title, W - 64), 30, 70 + Math.round((54 - tp) * 0.8));
    ctx.font = FONT(28); ctx.fillStyle = INK; ctx.fillText(stationLine(s), 32, 150);
    ctx.fillStyle = MUTED; ctx.fillText(fit(ctx, who.length ? 'Here: ' + who.join(', ') : 'Nobody here yet', W - 64), 32, 194);
    ctx.font = FONT(22); ctx.fillStyle = held ? INK : FAINT;
    const tip = held ? ['Moving: point, raise or lower, twist to turn.', 'Let go of the grip to put it down.'] :
      ['Walk into its circle to see it.', lk ? 'The circles are locked.' : 'Hold the grip to move it.'];
    tip.forEach((l, k) => ctx.fillText(fit(ctx, l, W - 64), 32, H - 76 + 30 * k));
    o.tex.needsUpdate = true;
  }
  // the other people, in room coordinates: rays with a bright dot at the end, a name tag over the head and, for
  // people who are not in this room (or for everyone in VR, where you cannot see the room), a simple avatar. Drawn only
  // for the people at your circle (their presence's station is your live one: the owner, 29 October 2026, with ten
  // headsets in a room), or for everyone before you have walked into a circle; People: everyone in the menu draws them
  // all (this headset's own setting, kept here and never in the room: for debugging). Pages' room maps show everyone
  const PEOPLE = { all: get('collabPeople') === 'all' }, peopleAll = () => PEOPLE.all;
  function setPeopleAll(on) { PEOPLE.all = !!on; put('collabPeople', on ? 'all' : null); log('people', { all: !!on }); changed(); }
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
    // labels in 3D: the tag as a sign turned with the head, two faces back to back (each reads the right way round),
    // in the scene as the labels' signs are (drawn first of the see-through things, writing depth, corners cut away)
    const sm = new THREE.MeshBasicMaterial({ map: o.tagTex, transparent: true, alphaTest: 0.1 }), sg = new THREE.PlaneGeometry(0.3, 0.066);
    o.sign = new THREE.Group(); o.sign.visible = false;
    for (const ry of [0, Math.PI]) { const f = new THREE.Mesh(sg, sm); f.rotation.y = ry; f.renderOrder = -1; o.sign.add(f); }
    o.g.add(o.avatar, o.tag, o.sign);
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
    const vr = HOST.mode !== 'immersive-ar', lm = HOST.xr.labels();
    for (const id of OV.people.keys()) if (!C.pres.has(id) || !C.pres.get(id).head) dropPerson(id);
    const L = liveSt(), all = !L || peopleAll();
    for (const [id, P] of C.pres) {
      if (!P.head) continue;
      const o = personFor(id), m = member(id) || {}, col = m.color || '#f2f6fc', name = m.name || 'Someone';
      o.g.visible = all || P.st === L.id;
      if (!o.g.visible) { o.e = null; continue; }   // (shown again where they are then, not gliding from where they were)
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
      // the name: on top of everything (a sprite), in 3D (a sign over the head, upright and turned to you, hidden by
      // what stands in front of it) or hidden
      o.tag.position.set(o.e.p.x, o.e.p.y + 0.24, o.e.p.z);
      o.tag.visible = lm === 'face'; o.sign.visible = lm === 'fixed';
      if (o.sign.visible) {
        o.sign.position.copy(o.tag.position);
        if (R.headOK) o.sign.rotation.set(0, Math.atan2(R.hr.x - o.sign.position.x, R.hr.z - o.sign.position.z), 0);
        else { _v.set(0, 0, -1).applyQuaternion(o.e.q); o.sign.rotation.set(0, Math.atan2(-_v.x, -_v.z) + Math.PI, 0); }   // (turned with the person)
      }
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
  // the previews of the stations that are not live here (the live one keeps only its ring, fainter). In a circle (a live
  // station here) the others show their rings only (the owner, 29 October 2026: "when you are in a circle the other
  // circles' cards and 3D models should not be visible, just the circles"): a ray resting on a ring (or on the card it
  // brought up) shows its card and icon for as long as it points, and they fade about 2 s after (PEEK), so you can tell
  // which story it is without walking over. Before any circle everything shows
  const HOV = [];   // what the controllers point at, this frame
  const PEEK = { hold: 2000, in: 12, out: 5 };   // (ms shown after the pointing stops; how fast it comes and goes, per s)
  function drawPreviews(dt) {
    const ids = new Set(C.st.map(s => s.id)), lm = HOST.xr.labels(), L = liveSt(), t = performance.now();
    for (const [id, o] of OV.rings) if (!ids.has(id)) {
      o.g.remove(o.icon.g);   // (its model and glow are the story's, kept for the next station of it)
      o.g.parent.remove(o.g); o.g.traverse(x => { if (x.geometry) x.geometry.dispose(); }); o.mat.dispose(); OV.rings.delete(id);
    }
    for (const [id, o] of OV.cards) if (!ids.has(id) || (id === C.live && C.stById.get(id).story === HOST.curKey)) {
      o.mesh.parent.remove(o.mesh); o.mesh.geometry.dispose(); o.tex.dispose(); o.mesh.material.dispose(); OV.cards.delete(id);
    }
    for (const s of C.st) {
      const r = ringFor(s), live = s.id === C.live && s.story === HOST.curKey, hov = HOV.some(h => h.target.kind === 'station' && h.target.id === s.id);
      r.mat.opacity = live ? 0.3 : MV.id === s.id ? 1 : 0.75;
      r.ring.userData.shell = { kind: 'station', id: s.id, live };   // (the live one: only to move it)
      // in a circle, another station's card and icon only while pointed at (or carried), fading after
      if (hov || MV.id === s.id) r.seenAt = t;
      const peek = !L || s.id === L.id || t - (r.seenAt || -1e9) < PEEK.hold, want = peek ? 1 : 0;
      if (r.peek === undefined) r.peek = want;
      r.peek += (want - r.peek) * (1 - Math.exp(-dt * (peek ? PEEK.in : PEEK.out)));
      if (Math.abs(want - r.peek) < 0.01) r.peek = want;
      // its icon in every label mode, as the ring (not a label: with labels hidden it tells the circles apart)
      iconStep(r, shown(s), !live && peek, dt);
      if (live) continue;
      // labels hidden: no card (the ring stays, to walk up to, point at and move); in a circle none unless pointed at
      const c = cardFor(s, lm);
      c.mesh.visible = lm !== 'hidden' && r.peek > 0.02;
      c.mesh.material.opacity = r.peek;
      if (!c.mesh.visible) continue;
      c.hover = hov;
      drawCard(c, s);
    }
  }

  // ------------------------------------------------------- the headset's menu --
  // A clock over the back of the left wrist (a controller's grip, or a tracked hand's wrist; beside the story panel
  // without either) opens the menu: touch it with the other controller's tip or index fingertip, click the left
  // stick, or point at it and pull the trigger (or pinch). The menu stands above the clock: Exit, the slideshow for
  // every story and Sound check, the headsets' settings, the story's panels, the design room (opened, or in a room its
  // table put at your feet), then the shared room: join one from the list (no typing), leave, your name and colour,
  // calibrate, the alignment, the stations (Arrange all, Add a station here, Move here, Remove) and the people.
  // It is closed at the start of every session, and opens by itself the first time in a room with no stations.
  const PNL = { open: false, page: 'main', asked: '', empty: '' };
  // the clock's canvas (px) and its width in the room (m): a face 6.5 cm across with "Open menu" under it; top and
  // below: how far its face reaches above its middle and its caption below it (m)
  const CLOCK = { w: 300, h: 380, cy: 150, r: 140, mw: 0.07 };
  CLOCK.top = CLOCK.r * CLOCK.mw / CLOCK.w; CLOCK.below = (CLOCK.h - CLOCK.cy) * CLOCK.mw / CLOCK.w;
  function menuOpen(on, why) {
    on = !!on;
    if (on !== PNL.open) log('menu', { open: on, by: why || '' });
    // (opened or closed by hand: a sound from the clock; not when it opens by itself or for a test)
    if (on !== PNL.open && HOST.session && /^(trigger|touch|finger|stick|close)$/.test(why || '')) sfx(on ? 'open' : 'close', OV.clockG && OV.clockG.position);
    PNL.open = on; PNL.page = 'main'; C.listing.menu = on;
    if (on && !C.code) { listRooms(); nearFind('menu'); }
  }
  const toggleMenu = why => menuOpen(!PNL.open, why);
  // where a press on the open menu sounds from (a headset; null on a screen)
  function menuAt() { return HOST.session && PNL.open && OV.panelG && OV.panelG.visible ? OV.panelG.position : null; }
  // where the menu is and how it closes, for the notices and its header
  const menuWhere = () => (HAND.ok ? 'the clock on your left wrist' : away() ? 'the clock in front of you' : 'the clock beside the story panel');
  const menuHint = () => (!HAND.ok ? 'Point at the clock to close it' : HAND.hand ? 'Touch the clock to close it' : 'Touch the clock or click the left stick to close');
  // Remove takes two presses (page and headset): the first arms it for 3 s ("Remove for everyone?")
  const armed = id => !!(C.rm && C.rm.id === id && performance.now() < C.rm.until);
  function removeAsk(id) {
    if (circlesLocked()) return false;
    if (armed(id)) { C.rm = null; remove(id); return true; }
    C.rm = { id, until: performance.now() + 3000 };
    setTimeout(changed, 3050);
    changed();
    return false;
  }
  // the story on show in this headset (the menu's Panels row): none on its Stories screen or away from every station in
  // a room
  const showing = () => (HOST.session && HOST.panels && HOST.cur && HOST.curKey && !HOST.onStories && !away() ? HOST.curKey : '');
  const PANELS_SAY = { shown: 'shown', controls: 'controls only', hidden: 'hidden' };
  function panelSig() {
    return J([C.code, C.status, C.note, PNL.open, PNL.page, OV.panel.hover, C.name, C.color, C.hereSet, here(), askHere(), R.status(), C.mine, C.live, armed(C.mine),
      C.st.map(s => s.id + s.story), C.members.map(m => m.id + m.name + m.color + m.kind + m.here + (m.host ? 'h' : '')), [...C.pres].map(([id, P]) => id + P.st), C.via, hosting(), C.takeover, C.peer,
      C.code ? 0 : (C.rooms || []).map(r => r.code + r.members), C.roomsErr, C.relay, C.code ? nearShown() : [(C.near || []).map(r => r.code + r.members + r.name), C.netState, C.nearBusy, C.nearErr, (offer() || {}).code], sharedLine(), sourceLine(), versionNote(), scanNote(), fullNote(), floorNote(), forgetArmed(), freshArmed(), canFresh(), !!(R.saved || R.frame), R.sharedAlign, circlesLocked(), stLocked(liveSt()), peopleAll(),
      C.local, C.code ? 0 : localRooms().map(r => r.code + r.stations), !!R.again, HOST.slides ? HOST.slides.sig() : '', menuHint(), HOST.xr.sig(), showing(), showing() && HOST.panels.sig(showing()),
      PNL.page === 'sound' ? Math.floor(performance.now() / 500) + HOST.audio.pref : '', HOST.curKey, HOST.sfx ? HOST.sfx.sig() : '']);
  }
  // the menu's Design room row: its button (label, what a press does, or null) and a note beside it
  function designRow() {
    const m = meta(DESIGN);
    if (!m || m.unknown) return { label: 'Design room', fn: null, note: 'Not in this version of the app' };
    if (!C.code) {
      const at = HOST.curKey === DESIGN;
      return { label: 'Design room', fn: at ? null : () => { menuOpen(false, 'design'); log('design', { open: true }); HOST.go(DESIGN); },
        note: at ? 'You are at the props table' : 'Every story\'s props on one table' };
    }
    const lk = circlesLocked(), has = C.st.some(s => s.story === DESIGN);
    return { label: 'Design room here', fn: lk ? null : () => designHere(), note: lk ? 'Not while the circles are locked' : has ? 'Moves the room\'s props table to your feet' : 'The props table as a circle at your feet' };
  }
  function drawPanel() {
    const S = OV.panel, sig = panelSig();
    if (sig === S.sig) return;
    S.sig = sig;
    const ctx = S.ctx, W = S.w, x = 34, w = W - 68, bw = (w - 16) / 2;
    const YOU = 36 + 70 + 46 + 28;   // the You section at the bottom (its label, name, colours and margin): kept free
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, S.h); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    S.regions = [];
    // the header: Menu, how it closes again, and Close
    ctx.font = FONT(34, 700); ctx.fillStyle = INK; ctx.fillText('Menu', x, 24);
    ctx.font = FONT(21); ctx.fillStyle = MUTED; ctx.fillText(fit(ctx, menuHint(), w - 180), x, 72);
    button(S, 'close', W - 34 - 150, 26, 150, 60, 'Close', () => menuOpen(false, 'close'));
    let y = 118;
    const line = () => { ctx.fillStyle = 'rgba(149,166,189,0.22)'; ctx.fillRect(x, y, w, 2); y += 18; };
    const label = (s, col) => { ctx.font = FONT(22, 700); ctx.fillStyle = col || MUTED; ctx.fillText(s.toUpperCase(), x, y); y += 36; };
    // as tall as what it shows (it hangs from its top edge): the background goes in behind
    const finish = y => {
      const H = Math.min(S.h, Math.ceil(y));
      ctx.globalCompositeOperation = 'destination-over';
      rr(ctx, 0, 0, W, H, 24); ctx.fillStyle = 'rgba(8,15,28,0.95)'; ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      rr(ctx, 1, 1, W - 2, H - 2, 24); ctx.lineWidth = 2; ctx.strokeStyle = C.code ? 'rgba(70,217,255,0.5)' : 'rgba(140,170,210,0.3)'; ctx.stroke();
      showTop(S, H);
      S.tex.needsUpdate = true;
    };
    line();
    // Sound check: in place of the rest of the menu
    if (PNL.page === 'sound') { finish(soundPage(S, x, y, w)); return; }
    // Exit (leave VR or AR), the slideshow for every story and Sound check: at hand on the left wrist, not on the story
    // panels (Sound check is here too because a shared room never shows the Stories screen, where the stories have theirs)
    const ew = 150, sw = (w - ew - 32) / 2;
    button(S, 'exit', x, y, ew, 60, 'Exit', () => { if (HOST.session && HOST.session.end) HOST.session.end(); });
    if (HOST.slides) { const on = !!HOST.slides.global(); button(S, 'slides', x + ew + 16, y, sw, 60, on ? 'Slideshow: on' : 'Slideshow: off', () => HOST.slides.setGlobal(!on), { on, px: 23 }); }
    button(S, 'sound', x + ew + sw + 32, y, sw, 60, 'Sound check', () => { PNL.page = 'sound'; }, { px: 23 });
    y += 76;
    // labels (in 3D, hidden, on top: each press the next), free moving and subtitles, for every story; in a room the room's
    const lm = HOST.xr.labels(), fr = HOST.xr.free(), su = HOST.xr.subs(), LBL = { fixed: 'in 3D', hidden: 'hidden', face: 'on top' };
    button(S, 'labels', x, y, bw, 60, 'Labels: ' + LBL[lm], () => HOST.xr.setLabels({ fixed: 'hidden', hidden: 'face', face: 'fixed' }[lm]), { on: lm === 'fixed' });
    button(S, 'free', x + bw + 16, y, bw, 60, fr ? 'Moving: free' : 'Moving: facing you', () => HOST.xr.setFree(!fr), { on: fr });
    y += 76;
    button(S, 'subs', x, y, bw, 60, su ? 'Subtitles: on' : 'Subtitles: off', () => HOST.xr.setSubs(!su), { on: su });
    // the story on show's panels (shown, controls only, hidden: each press the next), that story's alone; in a room its
    // station's, for everyone at that circle. No row on the Stories screen or away from a station (no story on show)
    const pk = showing(), pm = pk ? HOST.panels.get(pk) : '';
    if (pm) button(S, 'panels', x + bw + 16, y, bw, 60, 'Panels: ' + PANELS_SAY[pm], () => HOST.panels.set(pk, HOST.panels.next(pk)), { on: pm === 'shown' });
    else if (C.code) { ctx.font = FONT(21); ctx.fillStyle = MUTED; wrapText(ctx, 'Labels, moving and subtitles: the same for everyone in this room', x + bw + 16, y + 2, bw, 28, 2); }
    y += 76;
    if (pm) {
      ctx.font = FONT(21); ctx.fillStyle = MUTED;
      ctx.fillText(fit(ctx, C.code ? 'Panels for this circle, the rest for the room' : 'Panels: for ' + ((meta(pk) || {}).title || 'this story') + ' only', w), x, y - 4);
      y += 30;
    }
    // sound effects (sfx.js): on or off and their volume (each press the next step), this headset's own, never the room's
    if (HOST.sfx) {
      const so = HOST.sfx.on();
      button(S, 'sfx', x, y, bw, 60, so ? 'Sound effects: on' : 'Sound effects: off', () => HOST.sfx.set(!so), { on: so, px: 23 });
      button(S, 'sfxvol', x + bw + 16, y, bw, 60, 'Effects volume: ' + Math.round(HOST.sfx.volume() * 100) + '%', () => HOST.sfx.setVolume(HOST.sfx.nextVolume()), { px: 22 });
      y += 76;
    }
    // the design room: outside a room it opens (the props table); in a room it puts the table at your feet as a circle,
    // facing your way (the room's one moved here when it has one), as Add does: not while the circles are locked
    const dz = designRow();
    button(S, 'design', x, y, bw, 60, dz.label, dz.fn, { px: 24, color: '#f0d58c' });
    ctx.font = FONT(21); ctx.fillStyle = MUTED; wrapText(ctx, dz.note, x + bw + 16, y + 2, bw, 28, 2);
    y += 76;
    line();
    // the shared room: its code, how many are in it, the connection
    const n = C.members.length, title = !C.code ? 'Shared room' : C.local ? `Room ${C.code} · this headset` : `Shared room ${C.code} · ${n} ${n === 1 ? 'person' : 'people'}`;
    ctx.font = FONT(28, 700); ctx.fillStyle = C.code ? CYAN : INK; ctx.fillText(fit(ctx, title, w), x, y); y += 40;
    ctx.font = FONT(21); ctx.fillStyle = MUTED;
    ctx.fillText(fit(ctx, C.code ? connLine() + (R.status() ? ' · ' + R.status() : '') : C.relay ? 'Join others in a room' : 'Place the stories in your room', w), x, y); y += 42;
    if (C.note) { ctx.font = FONT(23); ctx.fillStyle = '#ffb43b'; y += wrapText(ctx, C.note, x, y, w, 31, 3) + 10; }
    if (!C.code) {
      // rooms on this network first (and the room used last, when it is not joined by itself here: Start again), then the
      // relay's other open rooms and the rooms kept here (six rows at most in all, so a note above them still leaves room
      // for You below)
      const near = (C.near || []).slice(0, 3), off = offer(), left = 6 - near.length - (off ? 1 : 0);
      const rooms = (C.rooms || []).filter(r => !near.some(o => o.code === r.code)).slice(0, C.relay ? Math.min(3, Math.max(1, left - 1)) : 0);
      const kept = localRooms().filter(r => !rooms.some(o => o.code === r.code) && !near.some(o => o.code === r.code) && !(off && off.code === r.code)).slice(0, Math.max(0, left - rooms.length - (C.relay && !rooms.length ? 1 : 0)));
      label('On this network');
      if (off) {
        ctx.font = FONT(30, 700); ctx.fillStyle = INK; ctx.fillText(off.code, x, y + 8);
        ctx.font = FONT(21); ctx.fillStyle = MUTED;
        wrapText(ctx, 'Used ' + ago(off.at) + '; ' + offerWhy(off), x + 90, y + 2, w - 90 - 236, 26, 2);
        button(S, 'again:' + off.code, x + w - 220, y, 220, 56, (C.relay ? 'Join' : 'Start') + ' again', () => join(off.code), { primary: true, px: 23 });
        y += 70;
      }
      if (!near.length) { ctx.font = FONT(22); ctx.fillStyle = MUTED; y += wrapText(ctx, nearNone(), x, y, w, 29, 2) + 12; }
      for (const r of near) {
        ctx.font = FONT(30, 700); ctx.fillStyle = INK; ctx.fillText(r.code, x, y + 8);
        ctx.font = FONT(21); ctx.fillStyle = MUTED;
        ctx.fillText(fit(ctx, nearLine(r), w - 260), x + 90, y + 14);
        button(S, 'near:' + r.code, x + w - 150, y, 150, 56, 'Join', () => join(r.code), { primary: true });
        y += 70;
      }
      if (C.relay) {
        label(near.length ? 'Other open rooms' : 'Open rooms');
        if (!rooms.length) { ctx.font = FONT(22); ctx.fillStyle = MUTED; y += wrapText(ctx, C.roomsErr || (C.rooms ? (near.length ? 'No other open rooms.' : 'No open rooms. Start one.') : 'Looking for rooms...'), x, y, w, 29, 2) + 12; }
      } else {
        ctx.font = FONT(22); ctx.fillStyle = MUTED;
        y += wrapText(ctx, peerOn() ? 'No relay known: a room you start runs peer to peer, and others join it with its link or code. Best started on a laptop page, which stays awake.' :
          'No relay known and peer to peer is off, so nobody else can join: a room still places the stories in your room, on this headset, and keeps them.', x, y, w, 29, 3) + 14;
      }
      for (const r of rooms) {
        ctx.font = FONT(30, 700); ctx.fillStyle = INK; ctx.fillText(r.code, x, y + 8);
        ctx.font = FONT(21); ctx.fillStyle = MUTED;
        ctx.fillText(fit(ctx, peopleIn(r), w - 260), x + 90, y + 14);
        button(S, 'join:' + r.code, x + w - 150, y, 150, 56, 'Join', () => join(r.code), { primary: true });
        y += 70;
      }
      // rooms kept on this headset: opened here (and taken to the relay when it answers)
      if (kept.length) label('Kept on this headset');
      for (const r of kept) {
        ctx.font = FONT(30, 700); ctx.fillStyle = INK; ctx.fillText(r.code, x, y + 8);
        ctx.font = FONT(21); ctx.fillStyle = MUTED;
        ctx.fillText(fit(ctx, r.stations + (r.stations === 1 ? ' station' : ' stations'), w - 260), x + 90, y + 14);
        button(S, 'open:' + r.code, x + w - 150, y, 150, 56, 'Open', () => join(r.code, true));
        y += 70;
      }
      button(S, 'start', x, y + 6, (w - 16) / 2, 64, C.relay || peerOn() ? 'Start a room' : 'Start a room here', () => create(), { primary: true, px: 25 });
      if (C.relay) button(S, 'refresh', x + (w + 16) / 2, y + 6, (w - 16) / 2, 64, 'Refresh', () => listRooms(), { px: 25 });
      y += 92; line();
    } else if (PNL.page === 'add') {
      label('Add a station here: which story?');
      const ad = addable();   // (the stories, then the design room)
      ad.forEach((m, i) => {
        const bx = x + (i % 2) * (bw + 16), by = y + Math.floor(i / 2) * 72;
        button(S, 'add:' + m.key, bx, by, bw, 60, addName(m), () => { add(m.key); PNL.page = 'main'; }, { color: m.col, px: 25 });
      });
      y += Math.ceil(ad.length / 2) * 72 + 8;
      button(S, 'add:cancel', x, y, 200, 58, 'Cancel', () => { PNL.page = 'main'; });
      y += 82; line();
    } else {
      const cal = R.state === 'mark-a' || R.state === 'mark-b';
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
        ctx.fillText(fit(ctx, C.local ? 'On this headset only: ' + whyLocal() + '.' : here() ? 'You are in the room with the others.' : 'You are elsewhere: the stations stand round you.', w), x, y); y += 36;
        // Calibrate, Re-align (this headset lines up again from the start) and, with others, here or elsewhere
        const b3 = C.local ? bw : (w - 32) / 3, ag = !!R.again;
        if (here()) button(S, 'cal', x, y, b3, 60, cal ? 'Stop calibrating' : 'Calibrate', () => (cal ? R.cancel() : R.calibrate()), { on: cal, px: C.local ? 24 : 22 });
        else button(S, 'cal', x, y, b3, 60, 'Calibrate', null, { px: 22 });
        button(S, 'realign', x + b3 + 16, y, b3, 60, ag ? 'Re-aligning...' : 'Re-align', R.session && !cal ? () => realignNow() : null, { on: ag, px: C.local ? 24 : 22 });
        if (!C.local) button(S, 'here', x + 2 * (b3 + 16), y, b3, 60, here() ? 'I am elsewhere' : 'I am in the room', () => setHere(!here()), { px: 21 });
        y += 76;
        if (here()) {
          ctx.font = FONT(21); ctx.fillStyle = MUTED; ctx.fillText(fit(ctx, sharedLine(), w), x, y); y += 30;
          const fl = versionNote() || scanNote() || fullNote() || floorNote(), src = fl || sourceLine();   // a floor that differs matters more than what the frame rests on
          if (src) { ctx.fillStyle = fl || R.notJoined || (!own() && (!R.sharedAlign || splitHere())) || (own() && R.reenter) || (R.cmp && (R.cmp.d > 0.05 || R.cmp.a > 2)) ? '#ffb43b' : MUTED; ctx.fillText(fit(ctx, src, w), x, y); y += 30; }
          y += 4;
          // (with a relay that serves the page, a third: a fresh shared space for everyone, two presses)
          const fa = forgetArmed(), fr = canFresh(), fx = freshArmed(), c3 = fr ? (w - 32) / 3 : bw, px = fr ? 20 : 22;
          button(S, 'forget', x, y, c3, 56, fa ? 'Forget? Press again' : 'Forget calibration', R.saved || R.frame ? forgetAsk : null,
            { px, color: fa ? '#ffb43b' : undefined, on: fa });
          button(S, 'sharedalign', x + c3 + 16, y, c3, 56, R.sharedAlign ? 'Shared space: on' : 'Shared space: off', () => setSharedAlign(!R.sharedAlign),
            { px, on: R.sharedAlign });
          if (fr) button(S, 'fresh', x + 2 * (c3 + 16), y, c3, 56, fx ? 'Sure? Press again' : 'Fresh shared space', freshAsk, { px, color: fx ? '#ffb43b' : undefined, on: fx });
          y += 72;
        }
      }
      label('Stations');
      const mine = C.stById.get(C.mine), arm = mine && armed(mine.id);
      ctx.font = FONT(24); ctx.fillStyle = INK;
      ctx.fillText(fit(ctx, mine ? 'Yours: ' + meta(mine.story).title : C.st.length ? 'Walk into a circle to see its story' : 'None yet: Arrange all puts every story in front of you', w), x, y); y += 40;
      const lk = circlesLocked();
      button(S, 'move', x, y, bw, 60, 'Move here', mine && !lk ? () => move(mine.id) : null);
      button(S, 'addpage', x + bw + 16, y, bw, 60, 'Add here', lk ? null : () => { PNL.page = 'add'; });
      y += 72;
      button(S, 'arrange', x, y, bw, 60, 'Arrange all', lk ? null : () => arrange());
      button(S, 'remove', x + bw + 16, y, bw, 60, arm ? 'Remove for everyone?' : 'Remove', mine && !lk ? () => removeAsk(mine.id) : null, { px: arm ? 21 : 24, color: arm ? '#ffb43b' : undefined, on: arm });
      y += 72;
      // the two locks side by side: the circles (for the whole room) and this story's scene and panels (at a station: for
      // everyone at its circle; never locked with the circles); then whether the room shows on this network (not locked
      // with the circles) and whose figures this headset draws (people at your circle only, or everyone: this headset's
      // own, for debugging)
      const L = liveSt(), sl = !!L && stLocked(L), ns = nearShown() && !C.local, pa = peopleAll();
      button(S, 'lock', x, y, bw, 56, lk ? 'Circles locked: unlock' : 'Lock circles', () => setLock(!lk), { px: 22, on: lk });
      button(S, 'stlock', x + bw + 16, y, bw, 56, sl ? 'Story locked: unlock' : 'Lock this story', L ? () => setStLock(L.id, !sl) : null, { px: 22, on: sl });
      y += 72;
      button(S, 'near', x, y, bw, 56, ns ? 'On this network: shown' : 'On this network: hidden', C.local ? null : () => setNear(!nearShown()), { px: 21, on: ns });
      button(S, 'people', x + bw + 16, y, bw, 56, pa ? 'People: everyone' : 'People: same circle', () => setPeopleAll(!pa), { px: 21, on: !pa });
      y += 72; line();
      if (C.local) {   // nobody else: what a relay would add, and that the room is kept here
        ctx.font = FONT(22); ctx.fillStyle = MUTED;
        y += wrapText(ctx, C.peerFail ? 'Kept on this headset. Once a relay or the peer-to-peer server answers, the room goes there and others can join.' :
          'Kept on this headset. Once a relay answers, the room moves there and others can join.', x, y, w, 30, 2) + 14;
        line();
      } else if (S.h - y - YOU - 26 - 36 >= 38) {   // (as many people as fit above You; none when nothing fits: the title counts them)
        label('People');
        // as many as fit above "You"; the rest as a count
        const fitN = Math.max(1, Math.floor((S.h - y - YOU - 26 - 36) / 38)), shown = C.members.length > fitN ? fitN - 1 : fitN;
        for (const m of C.members.slice(0, Math.max(0, shown))) {
          const P = m.id === C.id ? { st: C.mine } : C.pres.get(m.id), s = P && C.stById.get(P.st);
          ctx.fillStyle = m.color || INK; rr(ctx, x, y + 4, 22, 22, 6); ctx.fill();
          ctx.font = FONT(24, m.id === C.id ? 700 : 400); ctx.fillStyle = INK;
          ctx.fillText(fit(ctx, (m.name || 'Someone') + (m.id === C.id ? ' (you)' : ''), 250), x + 36, y);
          ctx.font = FONT(21); ctx.fillStyle = MUTED;
          const bv = m.id === C.id ? BROWSER : (P && P.bv) || '';   // (Quest Browser's version: the same on every headset, or no shared space)
          ctx.fillText(fit(ctx, ({ ar: 'headset', vr: 'headset (VR)', desktop: 'screen' }[m.kind] || '') + (bv ? ' ' + bv : '') + (m.kind !== 'desktop' ? (m.here ? ', here' : ', elsewhere') : '') + (m.host ? ', host' : '') + (s ? ' · ' + meta(s.story).title : ''), w - 300), x + 300, y + 2);
          y += 38;
        }
        if (C.members.length > shown) { ctx.font = FONT(21); ctx.fillStyle = MUTED; ctx.fillText(`and ${C.members.length - shown} more`, x + 36, y + 2); y += 38; }
        y += 8; line();
      }
    }
    // you: your name and colour (headsets cannot type: Another name picks one)
    label('You');
    ctx.font = FONT(26, 700); ctx.fillStyle = C.color; ctx.fillText(fit(ctx, C.name, 260), x, y + 14);
    button(S, 'name', x + 280, y, 220, 56, 'Another name', () => setMe({ name: any(NAMES.filter(s => s !== C.name)) }), { px: 22 });
    if (C.code) button(S, 'leave', x + w - 140, y, 140, 56, 'Leave', () => leave(false, true), { px: 22 });
    y += 70;
    COLORS.forEach((c, i) => {
      const bx = x + i * 78;
      rr(ctx, bx, y, 62, 46, 10); ctx.fillStyle = c; ctx.fill();
      if (c === C.color || OV.panel.hover === 'col:' + i) { ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); }
      S.regions.push({ id: 'col:' + i, x: bx, y, w: 62, h: 46, fn: () => setMe({ color: c }) });
    });
    y += 46 + 28;
    finish(y);
  }
  // Sound check in the menu, as the stories have it on their Stories screen (which a shared room never shows): a beep
  // through each engine, the engine choice and what the sound system is doing (HOST.audio.report(), redrawn twice a
  // second while it shows)
  function soundPage(S, x, y, w) {
    const ctx = S.ctx, A = HOST.audio, bw = (w - 16) / 2, cw = (w - 32) / 3;
    ctx.font = FONT(28, 700); ctx.fillStyle = INK; ctx.fillText('Sound check', x, y); y += 42;
    ctx.font = FONT(21); ctx.fillStyle = MUTED;
    y += wrapText(ctx, 'No narration? Press both beeps. If you hear only one, choose that way to play.', x, y, w, 28, 2) + 12;
    button(S, 'snd:beepW', x, y, bw, 60, 'Beep: Web Audio', () => A.beep('webaudio'), { px: 22 });
    button(S, 'snd:beepM', x + bw + 16, y, bw, 60, 'Beep: audio element', () => A.beep('media'), { px: 22 });
    y += 76;
    [['auto', 'Automatic'], ['webaudio', 'Web Audio'], ['media', 'Audio element']].forEach(([k, l], i) =>
      button(S, 'snd:' + k, x + i * (cw + 16), y, cw, 56, l, () => A.setEngine(k), { on: A.pref === k, px: 22 }));
    y += 74;
    // the sound effects, all of them in turn (only when they are on: Sound effects in the menu)
    if (HOST.sfx) {
      button(S, 'snd:sfxtry', x, y, bw, 56, 'Try the sound effects', HOST.sfx.on() ? () => HOST.sfx.demo() : null, { px: 22 });
      ctx.font = FONT(21); ctx.fillStyle = MUTED; wrapText(ctx, HOST.sfx.on() ? 'Every sound, one after another' : 'Turn Sound effects on in the menu first', x + bw + 16, y + 2, bw, 27, 2);
      y += 72;
    }
    ctx.font = FONT(19); ctx.fillStyle = MUTED;
    for (const l of A.report()) { if (y > S.h - 160) break; y += wrapText(ctx, l, x, y, w, 25, 3) + 6; }
    y += 12;
    button(S, 'snd:back', x, y, bw, 58, 'Back', () => { PNL.page = 'main'; }, { px: 23 });
    button(S, 'snd:reset', x + bw + 16, y, bw, 58, 'Reset the sound', () => A.reset(), { px: 23 });
    return y + 58 + 28;
  }
  // the clock: the local time (hour ticks, hour and minute hands) in the app's cyan rim, on a dark face that stands
  // out against the room and a dark scene alike, "Open menu" or "Close menu" under it; drawn again only when the
  // minute or what it shows changes
  function drawClock() {
    const S = OV.clock, d = new Date(), hot = !!(S.hover || TCH.near), sig = [d.getHours(), d.getMinutes(), hot, PNL.open].join('|');
    if (sig === S.sig) return;
    S.sig = sig;
    const ctx = S.ctx, cx = CLOCK.w / 2, cy = CLOCK.cy;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, S.w, S.h); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, CLOCK.r - 7, 0, 2 * Math.PI);
    ctx.fillStyle = hot ? 'rgba(18,40,58,0.97)' : 'rgba(8,15,28,0.94)'; ctx.fill();
    ctx.lineWidth = hot ? 14 : 11; ctx.strokeStyle = hot ? '#8ce9ff' : CYAN; ctx.stroke();
    ctx.strokeStyle = INK;
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, q = k % 3 === 0, sx = Math.sin(a), sy = -Math.cos(a), r0 = q ? 90 : 104;
      ctx.lineWidth = q ? 9 : 5; ctx.beginPath(); ctx.moveTo(cx + sx * r0, cy + sy * r0); ctx.lineTo(cx + sx * 118, cy + sy * 118); ctx.stroke();
    }
    const hand = (a, len, lw) => { ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(cx - Math.sin(a) * 14, cy + Math.cos(a) * 14); ctx.lineTo(cx + Math.sin(a) * len, cy - Math.cos(a) * len); ctx.stroke(); };
    const m = d.getMinutes();
    hand((d.getHours() % 12 + m / 60) * Math.PI / 6, 62, 13);
    hand(m * Math.PI / 30, 100, 8);
    ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 2 * Math.PI); ctx.fillStyle = CYAN; ctx.fill();
    const cap = PNL.open ? 'Close menu' : 'Open menu';
    ctx.font = FONT(34, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = Math.min(S.w - 8, ctx.measureText(cap).width + 44);
    rr(ctx, cx - tw / 2, 302, tw, 66, 33); ctx.fillStyle = 'rgba(8,15,28,0.92)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = hot ? '#8ce9ff' : 'rgba(70,217,255,0.55)'; ctx.stroke();
    ctx.fillStyle = hot ? '#8ce9ff' : INK; ctx.fillText(cap, cx, 336);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    S.tex.needsUpdate = true;
  }
  function connLine() {
    if (C.local) return 'on this device';
    if (C.via === 'peer') {   // (peer to peer: who hosts it)
      if (C.status !== 'open') return C.status === 'refused' ? 'peer to peer · refused' : C.takeover ? 'peer to peer · the host has gone: taking over' : 'peer to peer · connecting...';
      const h = C.members.find(m => m.host);
      return 'peer to peer · ' + (hosting() ? 'hosted here' : h ? 'hosted by ' + (h.name || 'someone') : 'connected');
    }
    return { open: 'connected', connecting: 'connecting...', refused: 'refused', off: 'not connected' }[C.status] || C.status;
  }
  // a room on this device: why (shown in the dialog and the headset's menu)
  const whyLocal = () => (C.peer === 'off' && !C.relay ? 'peer to peer is off and no relay is known' : C.peerFail ? 'neither a relay nor the peer-to-peer introduction server answered' : 'no relay was reached');
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
    // (a soft chime from where it shows, a metre ahead; not again for the same notice within 2 s)
    const t = performance.now();
    if (HOST.session && HD.ok && !(NOTE.title === title && t - (NOTE.at || -1e9) < 2000)) sfx('notice', new THREE.Vector3(0, -0.22, -1).applyQuaternion(HD.q).add(HD.p));
    NOTE.at = t;
    NOTE.title = title; NOTE.text = text || ''; NOTE.until = ms === 0 ? Infinity : t + (ms || 4500);
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

  // ------------------------------------------------------------- subtitles --
  // HOST.xr.subs() (the menu's Subtitles row; in a room the room's): the narration's words in a strip low in the view,
  // about 1.4 m away and 0.9 m wide, white on a dark band, drawn on top of everything in every label mode (subtitles
  // are their own setting), over whatever story runs; only in a headset, in story mode, with a line on show (nothing in
  // explore mode, on the Stories screen, away from a station, or for a story without the hook). The story gives its
  // line through its caption hook (HOST.cur.caption(): the chapter on show's cues as ST.items keeps them, the story time
  // now, the chapter's end and narrT); the words are read here as tools/narration.mjs reads the panel (so a recording
  // and the captions say the same), split into captions of at most two lines of about 42 characters (at sentence, then
  // clause ends) and spread over the stretch until the next cue at reading pace, 2.1 words a second, or faster only
  // where the stretch is shorter than that (as the narration goes there; a chapter's last line ends before a slideshow's
  // stop): the last caption of a stretch holds until the next cue. It follows the head with lag: still while you look
  // round within 15 degrees, eased back in front of you beyond
  const SUBS = { w: 1280, h: 200, mw: 0.9, dist: 1.4, drop: 16 * Math.PI / 180, turn: 15 * Math.PI / 180, rate: 2.1, chars: 42, px: 56 };   // (42 characters of B612 at 56 px: about 1,090 of the 1,280)
  const SUB = { key: '', keyA: NaN, caps: null, capsW: null, W: 0, res: ['', ''], id: '', idAt: NaN, idK: -1, want: '', wantId: '', shown: '', shownId: '', a: 0, txt: new WeakMap(), dir: new THREE.Vector3(), o: new THREE.Vector3(), placed: false, turning: false, moving: false };
  // one cue's words as tools/narration.mjs reads them (not inside an svg, a button or a cue of its own; a bold name run
  // straight into its text gets a colon), kept a quarter of a second (a live number in a line is read again)
  function subText(el, t) {
    const k = SUB.txt.get(el);
    if (k && t - k.at < 250) return k.s;
    let s = '', lp = null;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement;
      if (!p || p.closest('svg, script, style, button') || p.closest('[data-at]') !== el) continue;
      const x = n.textContent.replace(/\s+/g, ' ');
      if (!x.trim()) { s += ' '; continue; }
      if (lp && lp !== p && /^(B|STRONG)$/.test(lp.tagName) && /^[A-Za-z0-9(]/.test(x) && /[A-Za-z0-9)]$/.test(s)) s += ': ';
      s += x; lp = p;
    }
    s = s.replace(/\s+/g, ' ').trim();
    if (!/\p{L}{2}/u.test(s)) s = '';   // (a chart's numbers are not read)
    SUB.txt.set(el, { s, at: t });
    return s;
  }
  // a line (its cues' texts joined by a new line, which always breaks) in captions: as few as fit two lines each, broken
  // where it reads best (a sentence's end, then a clause's, then any word); each with its words counted
  function subSplit(text) {
    const tok = [], MAX = 2 * SUBS.chars;
    text.split('\n').forEach((part, i) => part.split(' ').filter(Boolean).forEach((w, j) => tok.push({ w, hard: i > 0 && j === 0 })));
    const n = tok.length;
    // how well a caption ends before token j: a new cue or a sentence's end, a clause's, or only a word's
    const cost = j => j >= n || tok[j].hard || /[.!?…]["'”’)]?$/.test(tok[j - 1].w) ? 0 : /[,;:]$/.test(tok[j - 1].w) || /^[–—-]$/.test(tok[j].w) ? 3 : 10;
    const best = [0], from = [0];
    for (let j = 1; j <= n; j++) {
      best[j] = Infinity;
      for (let i = j - 1, L = -1; i >= 0; i--) {
        L += tok[i].w.length + 1;
        if (i < j - 1 && (L > MAX || tok[i + 1].hard)) break;   // (a word longer than two lines goes alone)
        const c = best[i] + 4 + cost(j) + ((MAX - Math.min(MAX, L)) / MAX) ** 2;
        if (c < best[j]) { best[j] = c; from[j] = i; }
      }
    }
    const caps = [];
    for (let j = n; j > 0; j = from[j]) { const ws = tok.slice(from[j], j).map(x => x.w); caps.unshift({ s: ws.join(' '), words: Math.max(1, ws.filter(x => /[\p{L}\p{N}]/u.test(x)).length) }); }
    return caps;
  }
  // the caption on show now from the story's hook, or '' (and which one it is, so a live number in it redraws in place)
  // (one result array and the split's key kept between frames: this runs every frame while subtitles are on)
  function subNow(c, t) {
    const res = SUB.res;
    res[0] = res[1] = '';
    let at = -Infinity;
    for (const e of c.els) if (e.at <= c.s + 1e-6 && e.at > at && subText(e.el, t)) at = e.at;
    if (at === -Infinity) return res;
    let next = c.end, out = Infinity, text = '', n = 0;
    for (const e of c.els) {
      if (e.at === at) { const s = subText(e.el, t); if (s) { text = n++ ? text + '\n' + s : s; out = Math.min(out, e.out); } }
      else if (e.at > at && e.at < next && subText(e.el, t)) next = e.at;
    }
    if (c.s >= out) return res;   // (its line went early: data-out)
    // the stretch on the clock: a chapter's last line ends before a slideshow would stop it (0.7 s before the end)
    const T = c.narrT, a = T(at), b = Math.max(a + 0.1, T(Math.min(out, next === c.end ? c.end - 0.75 : next)));
    if (a !== SUB.keyA || text !== SUB.key) { SUB.keyA = a; SUB.key = text; SUB.caps = subSplit(text); }
    const caps = SUB.caps, W = SUB.capsW !== caps ? (SUB.capsW = caps, SUB.W = caps.reduce((s, x) => s + x.words, 0)) : SUB.W;
    const r = Math.max(SUBS.rate, W / (b - a)), now = T(c.s);
    let k = 0;
    for (let i = 1, w = caps[0].words; i < caps.length; w += caps[i].words, i++) if (a + w / r <= now + 1e-6) k = i;
    if (SUB.idAt !== at || SUB.idK !== k) { SUB.idAt = at; SUB.idK = k; SUB.id = at + ':' + k; }
    res[0] = caps[k].s; res[1] = SUB.id;
    return res;
  }
  // the strip: one canvas, drawn again only when the caption changes; white text on a dark band as wide as the text, its
  // lower edge kept (a second line goes above), two lines balanced
  function subDraw(s) {
    const S = OV.sub, ctx = S.ctx, pad = 36, lw = S.w - 2 * pad - 40;
    S.text = s;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, S.w, S.h);
    if (s) {
      let px = SUBS.px, lines = [s];
      for (;;) {
        ctx.font = FONT(px, 400);
        const ws = s.split(' ');
        lines = [s];
        if (ctx.measureText(s).width > lw && ws.length > 1) {
          let bi = 1, bw = Infinity;
          for (let i = 1; i < ws.length; i++) { const m = Math.max(ctx.measureText(ws.slice(0, i).join(' ')).width, ctx.measureText(ws.slice(i).join(' ')).width) + (/[,;:.!?]$/.test(ws[i - 1]) ? -30 : 0); if (m < bw) { bw = m; bi = i; } }
          lines = [ws.slice(0, bi).join(' '), ws.slice(bi).join(' ')];
        }
        if (px <= 34 || lines.every(l => ctx.measureText(l).width <= lw)) break;
        px -= 2;
      }
      const lh = Math.round(px * 1.3), bw = Math.min(S.w - 4, Math.max(...lines.map(l => ctx.measureText(l).width)) + 2 * pad), bh = lines.length * lh + 26;
      rr(ctx, (S.w - bw) / 2, S.h - 2 - bh, bw, bh, 22); ctx.fillStyle = 'rgba(8,15,28,0.74)'; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(fit(ctx, l, S.w - 2 * pad), S.w / 2, S.h - 2 - bh + 13 + lh * (i + 0.5)));
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    }
    S.tex.needsUpdate = true;
  }
  function drawSubs(dt) {
    const S = OV.sub, on = !!(HOST.xr && HOST.xr.subs && HOST.xr.subs()) && HD.ok && !away(), t = performance.now();
    let c = null;
    if (on && HOST.cur && typeof HOST.cur.caption === 'function') { try { c = HOST.cur.caption(); } catch (e) { c = null; } }
    let want = '', id = '';
    if (c && c.els && c.narrT) { try { const r = subNow(c, t); want = r[0]; id = r[1]; } catch (e) { want = id = ''; } }
    S.want = want; S.wantId = id;
    // fading between captions (a live number changing in the one on show redraws it in place)
    if (want && want !== SUB.shown && id === SUB.shownId) { subDraw(want); SUB.shown = want; }
    if (want !== SUB.shown) { SUB.a = Math.max(0, SUB.a - dt / 0.15); if (SUB.a === 0) { subDraw(want); SUB.shown = want; SUB.shownId = id; } }
    else if (want) SUB.a = Math.min(1, SUB.a + dt / 0.2);
    S.mesh.visible = SUB.a > 0 && !!SUB.shown;
    S.mesh.material.opacity = SUB.a * SUB.a * (3 - 2 * SUB.a);
    if (!on) { SUB.placed = false; return; }
    // where: low in the view (16 degrees under the gaze), still while the gaze stays within 15 degrees of it and the head
    // within 12 cm, eased back beyond, until nearly in front again (so small head moves never shake it)
    _v2.set(0, -Math.sin(SUBS.drop), -Math.cos(SUBS.drop)).applyQuaternion(HD.q);
    if (!SUB.placed) { SUB.dir.copy(_v2); SUB.o.copy(HD.p); SUB.placed = true; SUB.turning = SUB.moving = false; }
    const ang = SUB.dir.angleTo(_v2), far = SUB.o.distanceTo(HD.p), k = 1 - Math.exp(-dt * 4);
    if (ang > SUBS.turn) SUB.turning = true;
    if (SUB.turning) { SUB.dir.lerp(_v2, k).normalize(); if (SUB.dir.angleTo(_v2) < 0.02) SUB.turning = false; }
    if (far > 0.12) SUB.moving = true;
    if (SUB.moving) { SUB.o.lerp(HD.p, k); if (SUB.o.distanceTo(HD.p) < 0.01) SUB.moving = false; }
    S.mesh.position.copy(SUB.o).addScaledVector(SUB.dir, SUBS.dist);
    S.mesh.lookAt(SUB.o);
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
    (h.hist = h.hist || []).push([h.at, o.x, o.y, o.z]);   // the last half second, for a calibration mark (steady)
    while (h.hist.length && h.at - h.hist[0][0] > 500) h.hist.shift();
    if (!OV.root || !OV.root.visible || !OV.root.parent) return null;
    RC.set(o, d); RC.far = 30;   // a station across a large room can be picked too
    const hits = RC.intersectObjects(R.calib ? OV.hit.filter(m => m === OV.panel.mesh || m === OV.clock.mesh) : OV.hit, false);
    for (const x of hits) {
      const t = x.object.userData.shell;
      if (!t) continue;
      if ((x.object === OV.panel.mesh || x.object === OV.clock.mesh) && OV.onHand && i === HAND.i && x.distance < 0.4) continue;   // the left hand's own menu and clock
      if (!R.calib && near != null && x.distance > near) break;   // the story's own panel is in front
      const S = x.object.userData.sheet, hx = S && x.uv ? x.uv.x * S.w : 0, hy = S && x.uv ? (1 - x.uv.y) * S.vis : 0;
      C.hov.set(i, { target: t, x: hx, y: hy, at: h.at, p: x.point });
      // a soft tick as the pointer comes onto something new: a button of the menu, the clock, a station
      const r = t.kind === 'panel' && S ? S.at(hx, hy) : null, key = t.kind === 'panel' ? (r && r.fn ? 'p:' + r.id : '') : t.kind === 'station' ? 's:' + t.id : t.kind;
      if (key && key !== h.hk) sfx('hover', x.point);
      h.hk = key;
      return { kind: 'shell', point: x.point, dist: x.distance };
    }
    h.hk = '';
    // calibrating: the trigger anywhere else takes a mark at the controller's tip
    if (R.calib) { C.hov.set(i, { target: { kind: 'mark' }, at: h.at }); return { kind: 'shell', point: _v2.copy(d).multiplyScalar(0.03).add(o).clone(), dist: 0.03 }; }
    C.hov.set(i, null);
    return null;
  }
  // a press on the menu: a click, or a switch turned on or off, unless the press made a sound of its own (n: the count
  // before it)
  function pressSound(r, n, at) { if (sfxN() === n) sfx(r.tog === true ? 'toggleOff' : r.tog === false ? 'toggleOn' : 'click', at); }
  // what controller i points at now (a hover older than a few frames is gone: the controller left)
  const hovOf = i => { const h = C.hov.get(i); return h && performance.now() - h.at < 250 ? h : null; };
  function press(i) {
    const h = hovOf(i);
    if (!h) return;
    if (h.target.kind === 'mark') { R.mark(i); return; }   // calibrating (the panel's Stop calibrating still works)
    if (h.target.kind === 'clock') {
      // the tip touching the clock as the trigger is pulled: the touch has opened (or closed) it already, or must not now
      if (TCH.near) { if (!TCH.armed) return; TCH.armed = false; }
      toggleMenu('trigger'); return;
    }
    if (h.target.kind === 'panel') { const r = OV.panel.at(h.x, h.y); if (r && r.fn && !twice(r.id, 'ray')) { log('panel', { id: r.id }); const n = sfxN(); r.fn(); OV.panel.sig = ''; pressSound(r, n, h.p); } }
    // a station runs only where it stands: the trigger on its card or ring says so (the grip still moves it)
    else if (h.target.kind === 'station' && !h.target.live && !MV.src) notice('Walk into its circle', 'A story plays where its station stands: walk up to it to see it.', 3500);
  }
  // touching the clock opens and closes the menu: the right controller's tip (the first 4 cm of its ray) or the right
  // index fingertip within 4 cm of the clock's middle; it takes another touch only once moved 7 cm away. A fingertip
  // also presses the open menu's buttons: within 1.5 cm of the panel over one, again once pulled back 3 cm; a pinch
  // on the ray at the button the fingertip has just pressed (or the other way round, within 0.7 s) counts once
  const TCH = { armed: false, near: false }, POKE = { armed: true, hov: null, ok: false, tip: new THREE.Vector3() }, LASTP = { id: '', by: '', at: 0 };
  const _to = new THREE.Vector3(), _td = new THREE.Vector3(), _tm = new THREE.Matrix4();
  function twice(id, by) {
    const t = performance.now();
    if (LASTP.id === id && LASTP.by !== by && t - LASTP.at < 700) return true;
    Object.assign(LASTP, { id, by, at: t });
    return false;
  }
  function touch(f, local) {
    let src = null, d = Infinity;
    POKE.ok = false;
    if (R.session && f && local && OV.clockG && OV.clockG.visible) {
      try { for (const x of R.session.inputSources) if (x && x.handedness === 'right') { src = x; break; } } catch (e) { /* gone */ }
      const c = OV.clockG.position;
      if (src && src.hand) {
        let jp = null;
        try { jp = f.getJointPose(src.hand.get('index-finger-tip'), local); } catch (e) { /* not tracked now */ }
        if (jp) { const q = jp.transform.position; POKE.tip.set(q.x, q.y, q.z); POKE.ok = true; d = POKE.tip.distanceTo(c); }
      } else if (src) {
        let rp = null;
        try { rp = f.getPose(src.targetRaySpace, local); } catch (e) { /* not tracked now */ }
        if (rp) {
          _tm.fromArray(rp.transform.matrix); _to.setFromMatrixPosition(_tm); _td.set(0, 0, -1).transformDirection(_tm);
          const k = Math.max(0, Math.min(0.04, _v2.copy(c).sub(_to).dot(_td)));
          d = _v2.copy(_to).addScaledVector(_td, k).distanceTo(c);
        }
      }
    }
    const sc = OV.clockG ? OV.clockG.scale.x : 1;   // (beside the story panel the clock is twice the size)
    // not while that hand is busy: its grip held (carrying a station, the scene or a panel; both grips resizing the
    // scene bring the hands together) or calibrating (its tip goes to the tape marks); a touch begun busy waits
    // until the hand has moved away
    const gp = src && src.gamepad, busy = !!(R.calib || (src && MV.src === src) || (gp && gp.buttons && gp.buttons[1] && gp.buttons[1].pressed));
    TCH.near = d < 0.07 * sc;
    if (!TCH.near) TCH.armed = true;
    else if (busy) TCH.armed = false;
    else if (TCH.armed && d < 0.04 * sc) { TCH.armed = false; pulse(src, 0.4, 25); toggleMenu(src.hand ? 'finger' : 'touch'); }
    poke();
  }
  function poke() {
    const S = OV.panel;
    if (!POKE.ok || !PNL.open || !OV.panelG.visible) { POKE.armed = true; POKE.hov = null; return; }
    const lp = S.mesh.worldToLocal(_v2.copy(POKE.tip)), u = lp.x / S.mw + 0.5, v = 0.5 - lp.y / (S.mw * S.h / S.w), dz = lp.z * OV.panelG.scale.x;
    const on = u >= 0 && u <= 1 && v >= 0 && v <= 1, r = on && dz > -0.03 && dz < 0.05 ? S.at(u * S.w, v * S.vis) : null;
    if (r && r.fn && r.id !== POKE.hov) sfx('hover', POKE.tip);   // (the fingertip over a new button)
    POKE.hov = r ? r.id : null;
    if (dz > 0.03 || (!on && dz > 0)) POKE.armed = true;   // (pulled back, or beside it in front: not from behind)
    else if (POKE.armed && dz < 0.015 && r && r.fn) { POKE.armed = false; if (!twice(r.id, 'finger')) { log('panel', { id: r.id, by: 'finger' }); const n = sfxN(); r.fn(); S.sig = ''; pressSound(r, n, POKE.tip); } }
  }

  // ---------------------------------------------------------- every frame --
  // From the shell's own frame callback in a headset (and from HOST.anchor.frame, which every story calls):
  // the room frame, your head in the room, your station, presence, the sound zone and the overlay
  const HD = { p: new THREE.Vector3(), q: new THREE.Quaternion(), ok: false };
  // the left controller (or hand) in the story's space: the menu's clock sits on its wrist, the menu above it
  // (a pose only guessed, or none for a moment, keeps the last one for half a second: no jumping to the story
  // panel and back when tracking drops briefly)
  const HAND = { m: new THREE.Matrix4(), c: new THREE.Vector3(), ok: false, at: 0, i: -1, src: null, hand: false, b3: true }, HAND_SCALE = 0.62;
  function leftHand(f, local) {
    const s = R.session, t = performance.now();
    let src = null, p = null;
    HAND.i = -1;
    if (s && f && local) {
      try { [...s.inputSources].forEach((x, k) => { if (!src && x && x.handedness === 'left') { src = x; HAND.i = k; } }); } catch (e) { /* gone */ }
      if (src && src.hand) try { p = f.getJointPose(src.hand.get('wrist'), local); } catch (e) { /* not tracked now */ }
      else if (src) try { p = f.getPose(src.gripSpace || src.targetRaySpace, local); } catch (e) { /* not tracked now */ }
    }
    if (src !== HAND.src) { HAND.src = src; HAND.b3 = true; }   // (a stick held down as the controller appears is no click)
    HAND.hand = !!(src && src.hand);
    if (p && !p.emulatedPosition) {
      HAND.m.fromArray(p.transform.matrix); HAND.at = t;
      // like a watch: off the back of a hand's wrist (its +y leaves the back of the hand, +z runs up the forearm, for
      // either hand: the Hand Input spec has a joint's -y go into the palm and its -z along the bone, away from the wrist);
      // with a controller a little behind the grip (+z runs back to the wrist) and above it
      if (HAND.hand) HAND.c.set(0, 0.03, 0.035).applyMatrix4(HAND.m);
      else { HAND.c.set(0, 0, 0.05).applyMatrix4(HAND.m); HAND.c.y += 0.05; }
    }
    HAND.ok = !!src && t - HAND.at < 500;
    // the left stick's click (xr-standard button 3: the stories use the stick's axes and button 4) opens and closes it
    const gp = src && !src.hand && src.gamepad, b3 = !!(gp && gp.buttons && gp.buttons[3] && gp.buttons[3].pressed);
    if (b3 && !HAND.b3 && HOST.session) toggleMenu('stick');
    HAND.b3 = b3;
  }
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
    if (HD.ok && HOST.sfx) HOST.sfx.listen(HD.p, HD.q);   // (the sound effects hear from your head)
    if (C.code) R.update(f);
    if (C.code && R.session && R.lfOK && HD.ok) { R.originCheck(t); R.sample(t); }
    if (C.code && R.session) R.upload(t);
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
      PNL.asked = C.code; menuOpen(true, 'question');
      notice('One question', 'Are you in the same room as the others? Answer in the menu, ' + (HAND.ok ? 'above the clock on your left wrist.' : away() ? 'under the clock in front of you.' : 'left of the story panel.'), 9000);
    }
    // the first time in a room with no stations yet (nothing to see but the menu): the menu opens by itself, with Arrange
    // all in it (once per room)
    if (HOST.session && C.code && C.welcomed && !C.st.length && PNL.empty !== C.code && OV.root && OV.root.visible) { PNL.empty = C.code; menuOpen(true, 'empty'); }
    if (MV.src && f) carryStation(f, t);
    if (C.code) placeSync(dt, t);
    leftHand(f, local);
    touch(f, local);
    easeStations(dt);
    drawOverlay(dt);
    pump();
  }
  // your station by where you stand: the nearest within 1.1 m for a second. You stay in its story wherever you walk
  // (the owner, 29 October 2026, after ten headsets: "one should only exit a story when walking into a new circle"): it
  // stays live here, shown, on the station's clock and in step with the room, until you walk into another circle (or
  // leave the room, or a new session starts). A headset that has walked into no circle yet is away (HOST.room.away)
  function zoneStep(t) {
    const x = R.hr.x, z = R.hr.z, dist = s => Math.hypot(s.x - x, s.z - z);
    let best = null, bd = NEAR;
    for (const s of C.st) { if (s.id === MV.id) continue; const d = dist(s); if (d < bd) { bd = d; best = s; } }
    const Z = C.stById.get(C.zone) || C.stById.get(C.live), zd = Z ? dist(Z) : Infinity;   // (the station you are at: walked into, or live here)
    const cand = best && best.id !== (Z && Z.id) && bd < zd ? best.id : '';
    if (cand !== C.cand) { C.cand = cand; C.candAt = t; }
    if (cand && t - C.candAt >= DWELL) {
      C.zone = cand; C.cand = '';
      log('zone', { st: cand });
      choose(cand, 'walk');
      sfx('enter');   // (a gentle swell all round you)
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
    fx('p.' + C.id, { st: C.mine || '', head, hands, bv: BROWSER, sp: (R.sharedOK && R.sharedId) || '', al: R.aligned && !R.aloneAt ? R.src : '' });
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
      drawPreviews(dt);
      drawPeople(dt);
    }
    drawMarks();
    // the menu: its clock on the left wrist when there is a left controller or hand (always at hand), else beside
    // the story's panel (in front of you away from a station in a shared room, the story hidden); open, the menu above
    // the clock. Drawn first, so it is placed by its height this frame (it hangs from its top edge, and its height
    // follows what it shows). Without a relay too: a room on this headset places the stories
    const t = performance.now(), aw = away();
    let p = null;
    if (!HAND.ok && !aw) { try { p = HOST.cur && HOST.cur.xrPose(); } catch (e) { /* not ready */ } }
    OV.clockG.visible = HAND.ok || !!p || (aw && HD.ok);
    OV.panelG.visible = OV.clockG.visible && PNL.open;
    if (OV.panelG.visible) {
      OV.panel.hover = POKE.hov;
      for (const h of HOV) if (h.target.kind === 'panel') { const r = OV.panel.at(h.x, h.y); if (r) OV.panel.hover = r.id; }
      drawPanel();
      if (!C.code && t - C.roomsAt > 4000) listRooms();
    } else if (OV.panel.regions.length) { OV.panel.regions = []; OV.panel.sig = ''; }   // (closed: nothing on it to press)
    if (OV.clockG.visible) { OV.clock.hover = HOV.some(h => h.target.kind === 'clock'); drawClock(); }
    const S = OV.panel;
    if (OV.clockG.visible && HAND.ok) {
      // the clock turned to your eyes, eased a little (a shaking hand does not shake it); the menu above it, its lower
      // edge 6.5 cm over the clock's middle, at about two thirds of its size
      if (!OV.onHand) OV.clockG.position.copy(HAND.c); else OV.clockG.position.lerp(HAND.c, 1 - Math.exp(-dt * 30));
      if (HD.ok) OV.clockG.quaternion.setFromRotationMatrix(_m.lookAt(HD.p, OV.clockG.position, _Y));
      OV.clockG.scale.setScalar(1);
      const sc = HAND_SCALE, vh = S.mw * S.vis / S.w * sc;
      OV.panelG.position.copy(OV.clockG.position); OV.panelG.position.y += 0.065 + vh;
      if (HD.ok) OV.panelG.quaternion.setFromRotationMatrix(_m.lookAt(HD.p, OV.panelG.position, _Y));
      OV.panelG.scale.setScalar(sc);
      OV.onHand = true;
    } else if (OV.clockG.visible && p) {
      OV.onHand = false;
      // to the left of the story panel (0.62 m wide), turned a little more towards you: the clock (twice its size,
      // as it is further away) with its top where the closed menu's tab used to be, the menu hanging below it
      const a = 0.42;
      _v.set(-0.31 - 0.02 - 0.21 * Math.cos(a), 0.36, 0.21 * Math.sin(a)).applyAxisAngle(_Y, p.pr).add(p.pp);
      _v.applyQuaternion(p.rq).add(p.rp);
      OV.clockG.quaternion.copy(p.rq).multiply(_q.setFromAxisAngle(_Y, p.pr + a));
      OV.clockG.position.copy(_v).add(_v2.set(0, -2 * CLOCK.top, 0).applyQuaternion(OV.clockG.quaternion));
      OV.clockG.scale.setScalar(2);
      OV.panelG.quaternion.copy(OV.clockG.quaternion); OV.panelG.scale.setScalar(1);
      OV.panelG.position.copy(OV.clockG.position).add(_v2.set(0, -2 * CLOCK.below - 0.015, 0).applyQuaternion(OV.clockG.quaternion));
    } else if (OV.clockG.visible) {
      // away from a station in a shared room the story and its panel are hidden: without a left controller or hand the
      // clock (twice its size) hangs in front of you, a little to the left, and follows you gently (not while the menu
      // is open below it, so its buttons stay put)
      _v.set(0, 0, -1).applyQuaternion(HD.q);
      const hy = Math.atan2(-_v.x, -_v.z);   // (where you face along the floor)
      _v.set(-0.3, 0.1, -0.65).applyAxisAngle(_Y, hy).add(HD.p);
      if (!OV.ahead) OV.clockG.position.copy(_v); else if (!PNL.open) OV.clockG.position.lerp(_v, 1 - Math.exp(-dt * 3));
      OV.clockG.quaternion.setFromRotationMatrix(_m.lookAt(HD.p, OV.clockG.position, _Y));
      OV.clockG.scale.setScalar(2);
      OV.panelG.quaternion.copy(OV.clockG.quaternion); OV.panelG.scale.setScalar(1);
      OV.panelG.position.copy(OV.clockG.position).add(_v2.set(0, -2 * CLOCK.below - 0.015, 0).applyQuaternion(OV.clockG.quaternion));
      OV.onHand = false;
    } else OV.onHand = false;
    OV.ahead = OV.clockG.visible && !HAND.ok && !p;
    drawNote(HD.ok ? HD.p : null, HD.q);
    drawSubs(dt);
    // what the controllers can point at
    OV.hit.length = 0;
    if (OV.clockG.visible) OV.hit.push(OV.clock.mesh);
    if (OV.panelG.visible) OV.hit.push(OV.panel.mesh);
    if (OV.room.visible) {
      for (const o of OV.cards.values()) if (o.mesh.visible) OV.hit.push(o.mesh, o.back);
      for (const o of OV.rings.values()) if (o.ring.userData.shell) OV.hit.push(o.ring);
    }
    OV.root.updateMatrixWorld(true);
  }
  const refSpace = () => { try { return HOST.renderer && HOST.renderer.xr.getReferenceSpace(); } catch (e) { return null; } };

  // =========================================================== the room frame ==
  // HOST.room. The renderer keeps the 'local' reference space; the shell asks the session for 'local-floor'
  // and 'shared' spaces of its own. The room frame (an origin on the floor and a level x axis) is kept in
  // local-floor coordinates and turned into room -> local every frame. Where it comes from, first found first
  // (shared-spaces.md, section 4):
  //  1. this headset's own calibration, which nothing overrides: two tape marks touched with a controller this
  //     session ('marks'), or last time's, found again by the two anchors made at them ('anchor')
  //  2. a frame published for this headset's shared space (Quest Browser's experimental 'shared' reference
  //     space, key rf.<space>): a calibrated headset's, or the first one's in the space ('adopted'), followed
  //     when it moves by more than 3 cm or a degree
  //  3. a shared space nobody has published for: the space's own origin ('shared'), published for the others
  //  4. else calibrate: touch mark A with a controller and pull the trigger, then mark B
  // The shared space only aligns headsets without marks of their own; a calibrated headset just reports how far
  // the shared space puts another headset's marks from its own (R.cmp). Coordinates are never kept without
  // anchors: on the Quest local-floor starts where the headset does, so they would be wrong next time, and a
  // recentre moves it within a session (a calibration without anchors then asks to be done again).
  // People elsewhere (VR, `here` false) and desktops never calibrate: their room is their own floor, facing
  // where they faced when they joined.
  const R = {
    session: null, begun: null, loopFor: null, floor: null, noFloor: false, shared: null, sharedNo: false, sharedId: '', sharedAt: 0, sharedAsked: 0, sharedOK: false,
    frame: null, src: '', state: 'off', aligned: false, calib: null, recAt: 0, pubAt: 0, noticed: '',
    // the marks ({ v: 2, a, b in local-floor, at, anchors: [handle A, handle B] }) and their anchors this session
    saved: null, anchors: null, anchorIds: null, anchorsOK: false, anchorBusy: false, anchorTried: false, anchorSince: 0, wantAnchors: null, anchorP: null,
    mgen: 0,   // the marks' generation: anchors that arrive for older marks (forgotten, replaced) are thrown away
    mk: null,  // the marks in room coordinates, to draw: [height of A, A to B, height of B] (null: none known)
    cmp: null, showUntil: 0, prev: null, sampleAt: 0, oldAnchor: '', markAt: 0,
    hiddenAt: 0, sleptAt: 0, visibleAt: 0, woke: 0, anchorSeen: 0, resetAt: 0,   // the headset off (or the origin moved): the marks are checked again
    sharedPose: false, sharedHead: false, sharedOwn: null,   // the shared space's pose this frame: there, at the head, this headset's own floor
    full: false,   // the store of saved anchors refused their handles: the marks hold for this session only
    // after waking, a frame taken from the shared space holds until the space agrees with it again (wakeOK); its
    // height is kept in the shared space (hS); the space's pose in our floor last moved at stillSince
    wakeHold: 0, wakeLog: 0, hS: null, stillSince: 0, lastS: null, aloneAt: 0, notJoined: false, firstHere: null, firstFor: new Map(), ownId: '', ownFor: new Map(),
    scanAt: 0, scanFrom: 0, scanSeen: false, scanN: -1, noScan: false, scanTold: false, badSince: 0, tries: 0, retryAt: 0, retryFrom: 0,
    reenter: false, afterSleep: false,
    again: 0, againRel: 0,   // Re-align pressed (when; relay time): the frame is decided again as at the start, the old one kept until then
    reasked: 0,   // the wake (visibleAt) after which the shared space was asked for again
    sleptRel: 0, refresh: 0,   // when this headset went to sleep (relay time); a wake whose frame is still to be written again
    blind: false,   // since waking the floor moved with no transform: the frame held is no better than the space
    qAsk: 0,   // the wake after which the room's frame was asked for (q.frame)
    // aligning from the shared space is on unless switched off on the panel: it lined two Quest 3s up once both ran
    // the same browser (with different versions they were in two spaces under one id, see shared-spaces.md). Not
    // remembered: switched off once, it left one headset unaligned in every room of an evening (the relay's logs)
    sharedAlign: true,
    lf: new THREE.Matrix4(), lfi: new THREE.Matrix4(), ls: new THREE.Matrix4(), fr: new THREE.Matrix4(), m: new THREE.Matrix4(), mi: new THREE.Matrix4(),
    yaw: 0, hr: new THREE.Vector3(), hyaw: 0, headOK: false, lfOK: false,
  };
  put('collabSharedAlign', '');   // (older versions remembered the switch)
  try {
    const s = JSON.parse(get('roomFrame') || 'null');
    // only marks with their two anchors are kept (older versions kept coordinates, and one anchor at mark A)
    if (s && s.v === 2 && Array.isArray(s.a) && Array.isArray(s.b) && Array.isArray(s.anchors) && s.anchors.length === 2 && s.anchors.every(u => typeof u === 'string' && u)) R.saved = s;
    else if (s) { R.oldAnchor = (s && typeof s.anchor === 'string' && s.anchor) || ''; put('roomFrame', null); }
  } catch (e) { R.saved = null; }
  if (R.oldAnchor && HOST.anchor && HOST.anchor.drop) { HOST.anchor.drop(R.oldAnchor); R.oldAnchor = ''; }   // deleted at the next session
  const storeSaved = () => put('roomFrame', R.saved && R.saved.anchors.length === 2 && R.saved.anchors.every(Boolean) ? J(R.saved) : null);
  const sharedIdOf = s => (s && (s.UUId || s.uuid || s.UUID)) || '';
  const kFrame = id => 'rf.' + (String(id).replace(/[^\w-]/g, '').slice(0, 64) || 'x');   // the frame published for a shared space
  const kSplit = id => 'rs.' + (String(id).replace(/[^\w-]/g, '').slice(0, 64) || 'x');   // a shared space found split (splitCheck)
  const level = x => { const l = Math.hypot(x[0], x[2]); return l > 1e-6 ? [x[0] / l, 0, x[2] / l] : null; };
  const yawOfX = x => Math.atan2(-x[2], x[0]);   // the x axis (cos a, 0, -sin a) of a turn by a about y
  // the room's floor under the marks: the first calibration in the room says how high mark A stands over the floor
  // (key rm), and a headset whose own floor differs (a Guardian floor set wrong, or one that jumped) stands the room
  // on the marks instead: its frame's origin is that far above its floor. Other marks (another distance): its floor.
  const SAME = 0.1;   // marks measured within 10 cm of the same distance apart are the same marks (touched by hand)
  const floorUnder = (a, b) => { const M = val('rm'); return M && Number.isFinite(M.a) && Math.abs(M.d - Math.hypot(b[0] - a[0], b[2] - a[2])) <= SAME ? a[1] - M.a : 0; };
  const fromMarks = (a, b) => ({ o: [a[0], floorUnder(a, b), a[2]], x: level([b[0] - a[0], 0, b[2] - a[2]]) });
  const marksMk = (a, b) => { const y = floorUnder(a, b); return [r3(a[1] - y), r3(Math.hypot(b[0] - a[0], b[2] - a[2])), r3(b[1] - y)]; };
  // our marks set the room's floor when nobody's do yet, when the room's are our own older ones or other marks, or
  // when whoever set them has left (asked when a calibration is made or found again, not every frame)
  function claimFloor(a, b) {
    const M = val('rm'), d = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (M && Number.isFinite(M.a) && Math.abs(M.d - d) <= SAME && M.by !== C.id && member(M.by)) return;
    publish([['rm', { a: r3(a[1]), d: r3(d), by: C.id, at: Math.round(now()) }]]);
    log('floor claimed', { a: r3(a[1]), d: r3(d), was: M ? M.by : '' });
  }
  const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const own = () => R.src === 'marks' || R.src === 'anchor';
  // how far apart two frames are: [metres between the origins, radians between the x axes]
  function apart(F, G) {
    let a = Math.abs(yawOfX(F.x) - yawOfX(G.x)) % (2 * Math.PI);
    if (a > Math.PI) a = 2 * Math.PI - a;
    return [Math.hypot(F.o[0] - G.o[0], F.o[2] - G.o[2]), a];
  }
  // floor <- room, from the frame's origin and x axis (y up, z = x cross y)
  function basis(fr, out) {
    const x = _v.fromArray(fr.x), z = _v2.crossVectors(x, _Y);
    return out.makeBasis(x, _Y, z).setPosition(fr.o[0], fr.o[1], fr.o[2]);
  }
  function setState(s) { if (R.state !== s) { R.state = s; log('align', { state: s }); changed(); } }
  function setFrame(fr, src, title, text) {
    const x = fr && fr.x && level(fr.x);
    if (!x) return;
    const was = R.src;
    if (src !== was) R.wakeHold = 0;
    if (src === 'marks' || src === 'anchor') { R.aloneAt = 0; R.notJoined = false; }
    R.frame = { o: [fr.o[0], Number.isFinite(fr.o[1]) ? fr.o[1] : 0, fr.o[2]], x };
    R.src = src;
    setState(src);
    log('frame', { src, o: R.frame.o.map(r3), x: x.map(r3) });
    if (title) { notice(title, text); R.showUntil = performance.now() + 30000; }   // the marks show for a while
    if (src !== was) changed();
  }
  // the session's spaces: asked when a headset session runs in a room
  function begin() {
    const s = R.session;
    if (!s || !C.code || R.begun === s) return;
    // spaces asked for by an earlier join (leave and join again in one session) stop reporting here
    try { if (R.floor && R.floor.removeEventListener) R.floor.removeEventListener('reset', floorReset); } catch (e) { /* gone */ }
    try { if (R.shared && R.shared.removeEventListener) R.shared.removeEventListener('reset', sharedReset); } catch (e) { /* gone */ }
    letGo();
    Object.assign(R, { begun: s, floor: null, noFloor: false, shared: null, sharedNo: false, sharedId: '', sharedAt: 0, sharedAsked: performance.now(), sharedOK: false,
      sharedPose: false, sharedHead: false, sharedOwn: null, ownId: '', ownFor: new Map(), visibleAt: 0, wakeHold: 0, hS: null, stillSince: 0, lastS: null, aloneAt: 0, notJoined: false, firstHere: null, firstFor: new Map(), again: 0,
      frame: null, src: '', aligned: false, calib: null, anchorBusy: false, anchorTried: false, wantAnchors: null, noticed: '', mgen: R.mgen + 1,
      mk: null, cmp: null, prev: null, pubAt: 0, recAt: 0, full: false,
      scanAt: 0, scanFrom: performance.now(), scanSeen: false, scanN: -1, noScan: false, scanTold: false, badSince: 0, tries: 0, retryAt: 0, retryFrom: 0,
      reenter: false, afterSleep: false });
    if (R.oldAnchor && HOST.anchor.drop) { HOST.anchor.drop(R.oldAnchor); R.oldAnchor = ''; }   // an older version's anchor
    setState('waiting');
    const feats = s.enabledFeatures ? [...s.enabledFeatures] : null;
    let kept = null;
    try { kept = s.persistentAnchors ? [...s.persistentAnchors].length : null; } catch (e) { /* not here */ }
    log('session', { mode: HOST.mode, features: feats, format: FORMAT, ua: navigator.userAgent, browser: BROWSER, page: location.origin + location.pathname, search: location.search, sg: SG, persisted: kept });
    if (FRESH.xr) { FRESH.xr = false; notice('A fresh shared space', FRESH_TEXT, 12000); }   // the first headset makes it, the others join
    if (HOST.anchor.tidied) HOST.anchor.tidied().then(rep => { if (rep && R.session === s) log('anchors tidied', rep); }, () => {});
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
    // without a transform the origin may have moved (a recentre): anchors and the shared space put things right,
    // a calibration without anchors is asked again
    if (!tr) {
      log('reset', { space: 'local-floor', transform: false });
      if (R.wakeHold) R.blind = true;   // after waking: the frame held is no better than the space now (wakeOK)
      originMoved('reset'); return;
    }
    // Quest Browser's transform carries points from the old coordinates into the new ones (not the other way, as
    // the spec reads: its inverse turned the room the wrong way when a headset woke, -126 instead of +126 degrees,
    // measured against a calibration on the same tape right after), and its height is the head's change, not the
    // floor's: only its turn about the vertical and its move along the floor count
    const e = new THREE.Matrix4().fromArray(tr.matrix).elements, yaw = Math.atan2(-e[2], e[0]);
    _m.makeRotationY(yaw).setPosition(e[12], 0, e[14]);
    log('reset', { space: 'local-floor', transform: true, p: [e[12], e[13], e[14]].map(r3), yaw: r3(yaw) });
    const move = fr => { const o = _v.fromArray(fr.o).applyMatrix4(_m), x = _v2.fromArray(fr.x).transformDirection(_m).toArray(); fr.o = [o.x, fr.o[1], o.z]; fr.x = level(x) || fr.x; };
    if (R.frame) move(R.frame);
    const lev = a => { const p = _v.set(a[0], 0, a[2]).applyMatrix4(_m); return [r3(p.x), a[1], r3(p.z)]; };
    if (R.saved) for (const k of ['a', 'b']) R.saved[k] = lev(R.saved[k]);
    if (R.calib && R.calib.a) R.calib.a.fromArray(lev(R.calib.a.toArray()));
    R.prev = null; R.resetAt = performance.now();
  }
  function sharedReset(ev) {
    const id = sharedIdOf(R.shared);
    log('reset', { space: 'shared', id, transform: !!(ev && ev.transform) });
    if (id !== R.sharedId) { R.sharedId = id; R.sharedAt = performance.now(); R.recAt = 0; R.hS = null; R.firstHere = null; }
  }
  // the head seems to jump when the origin moves without a word (a recentre: Quest Browser fires no reset then)
  function originCheck(t) {
    const p = _v.copy(HD.p).applyMatrix4(R.lfi).toArray(), q = _q.setFromRotationMatrix(_m.extractRotation(R.lfi)).multiply(HD.q).toArray();
    const P = R.prev;
    R.prev = { p, q, t };
    if (!P || !P.q || t <= P.t || t - P.t > 250) return;
    const a = 2 * Math.acos(Math.min(1, Math.abs(q[0] * P.q[0] + q[1] * P.q[1] + q[2] * P.q[2] + q[3] * P.q[3]))), dt = (t - P.t) / 1000;
    if (dist3(p, P.p) / dt > 6 || a / dt > 20) originMoved('jump');   // 6 m/s, or 1150 degrees a second
  }
  function originMoved(why) {
    log('origin moved', { why, src: R.src, anchors: !!(R.anchors && R.anchorsOK) });
    R.recAt = 0; R.cmp = null;
    if (R.calib) {   // a mark taken before the move is somewhere else now
      R.calib = null; NOTE.until = 0; setState(R.frame ? R.src : 'calibrate');
      notice('Calibrate again', 'The headset moved its origin while you were calibrating: touch mark A and mark B again.', 9000);
    }
    if (own() && R.anchors && R.anchorsOK && !R.woke) R.woke = performance.now();   // the anchors must answer again
    if (own() && !(R.anchors && R.anchorsOK)) {
      // marks with saved anchors stay: a new AR session finds them again at once (after standby two Quest 3s did not
      // find them within the session for ten minutes, and did on entering AR again), so that is what is asked
      if (savedHandles()) {
        if (!R.anchors && !R.anchorBusy && !R.retryAt) { R.anchorTried = false; R.retryFrom = 0; }   // looked for again now (unless tries are under way), then on the retries' schedule
        lostMarks(why); return;
      }
      R.frame = null; R.src = ''; R.aligned = false; R.mk = null; R.noticed = 'calibrate';
      setState('calibrate');
      notice('Calibrate again', 'The headset moved its origin (a recentre?) and has no anchors to find the marks by: touch mark A and mark B again.', 9000);
    }
  }
  const savedHandles = () => !!(R.saved && R.saved.anchors.length === 2);
  // this headset's marks are not found in this session (after standby, or the origin moved with no anchors to
  // follow): the frame held so far stays, the orange crosses show, and the panel asks to leave AR and enter it again
  function lostMarks(why) {
    R.showUntil = performance.now() + 30000;
    if (R.reenter) return;
    R.reenter = true; log('marks lost', { why });
    notice('Leave AR and enter it again', 'Leave AR and enter it again: the headset finds your marks then (after standby it does not, in the same session). Until then things may stand off the tape marks.', 12000);
    changed();
  }
  // floor <- shared, this frame (only inside the frame callback). This reading of getPose is right: it keeps a
  // headset's own marks in one place in the shared space across its resets, to 2 cm (the inverse, as Quest's
  // reset transforms need, is out by 80 cm there)
  function floorFromShared(out) { return out.multiplyMatrices(R.lfi, R.ls); }
  // a shared space that is exactly this headset's own floor: the default one before the real one is found, or this
  // headset was the first in it (its origin is the space's, by design). In the relay logs one of two Quest 3s (the
  // older browser) had that every session, under the same id as the other, whose space was 1 to 2.6 m and 19 to 84
  // degrees away: it had not joined
  // Also when the space last moved in this headset's floor (more than 2 cm or half a degree): after waking, one that
  // holds still is trusted again
  const _mo = new THREE.Matrix4();
  function ownFloorCheck(t) {
    // (along the floor only: a floor estimated again after waking, 12 to 17 cm, must not make a space this headset's
    // own floor look like the others')
    // Once this headset's own floor, a space stays so while within 15 cm and 2 degrees: such a space drifted up to 8 cm
    // (its turn under half a degree) in the relay's logs, and a judgement flapping at 2 cm took the room through it.
    // Judged afresh for an id not seen in this session (the default space gives way to the real one, which may be
    // the others'), and as it was for an id seen before (the id may flick to a default space and back)
    if (R.sharedId && R.sharedId !== R.ownId) { R.sharedOwn = R.ownFor.has(R.sharedId) ? R.ownFor.get(R.sharedId) : null; R.ownId = R.sharedId; }
    const e = floorFromShared(_mo).elements, y = Math.atan2(-e[2], e[0]), d = Math.hypot(e[12], e[14]);
    const mine = R.sharedOwn ? d < 0.15 && Math.abs(y) < 0.035 : d < 0.02 && Math.abs(y) < 0.026;
    if (mine !== R.sharedOwn) { R.sharedOwn = mine; log('shared own floor', { own: mine }); changed(); }
    if (R.sharedId) R.ownFor.set(R.sharedId, mine);
    const L = R.lastS;
    let a = L ? Math.abs(y - L[3]) % (2 * Math.PI) : 0;
    if (a > Math.PI) a = 2 * Math.PI - a;
    // (along the floor only: a floor estimated again moves it up or down, and that is allowed for)
    if (!L || Math.hypot(e[12] - L[0], e[14] - L[2]) > 0.02 || a > 0.0087) { R.lastS = [e[12], e[13], e[14], y]; R.stillSince = t; }
  }
  // A headset with no scan of the room (Space Setup not run, or Physical space features off in the developer
  // settings): the shared space and the anchors rest on that scan. Two Quest 3s running with it off were in two
  // shared spaces 2.6 m apart under one id. Told by the detected planes and meshes: none 20 s into a session, and none
  // since (only when the session has those features; otherwise this headset cannot tell)
  function scanCheck(f, t) {
    if (t - R.scanAt < 1000) return;
    R.scanAt = t;
    if (R.noScan && !R.scanTold && C.code && here()) { R.scanTold = true; notice('No room scan', 'This headset has no scan of the room, and the shared space and the saved calibration need one. Run Space Setup in the headset\'s settings, and leave Physical space features on (developer settings).', 12000); }
    if (R.scanSeen) return;
    const feats = R.session && R.session.enabledFeatures ? [...R.session.enabledFeatures] : [];
    if (!feats.includes('plane-detection') && !feats.includes('mesh-detection')) return;
    let n = 0;
    try { if (f.detectedPlanes) n += f.detectedPlanes.size || 0; } catch (e) { /* not now */ }
    try { if (f.detectedMeshes) n += f.detectedMeshes.size || 0; } catch (e) { /* not now */ }
    R.scanN = n;
    if (n) R.scanSeen = true;
    const none = !n && t - R.scanFrom > 20000;
    if (none !== R.noScan) { R.noScan = none; R.scanAt = 0; log('room scan', { found: n, none }); changed(); }
  }
  const sharedY = () => floorFromShared(_mo).elements[13];   // the space's origin over this headset's floor (both level)
  // a frame given in shared coordinates, in ours (floor)
  function fromShared(P) {
    const M = floorFromShared(new THREE.Matrix4());
    return { o: new THREE.Vector3().fromArray(P.o).applyMatrix4(M).toArray(), x: new THREE.Vector3().fromArray(P.x).transformDirection(M).toArray() };
  }
  function toShared(fr) {
    const M = floorFromShared(new THREE.Matrix4()).invert();
    return { o: new THREE.Vector3().fromArray(fr.o).applyMatrix4(M).toArray().map(r3), x: new THREE.Vector3().fromArray(fr.x).transformDirection(M).toArray().map(r3) };
  }
  // our frame for our shared space: g 'marks' (a calibration, at: when) or 'shared' (the space's own origin)
  // nothing is published or compared through the shared space within 20 s of waking (its pose was the head's then)
  const settled = () => !R.visibleAt || performance.now() - R.visibleAt > 20000;
  // nor through a space that is just this headset's own floor while the others are in one under its id (not joined:
  // the others would take this headset's frame through their real space)
  const notInIt = () => !!(R.sharedOwn && R.firstHere === false && (validFrame(val(kFrame(R.sharedId))) || alignedHere()));
  // two calibrated headsets here found that this space id puts their tape marks apart: two spaces under one id
  // (2.6 m and 11 degrees on two Quest 3s with Quest Browser 152, neither space its headset's own floor). Nothing is
  // taken through it while both of them are in the room and one of them still finds it so (written again every minute;
  // older than 3 minutes, it lapses: a page reloaded is a new member, and a new session may be in one space)
  function splitHere() {
    const Q = R.sharedId ? val(kSplit(R.sharedId)) : null;
    return !!(Q && Q.bad === true && Q.uuid === R.sharedId && Number.isFinite(Q.d) && member(Q.by) && member(Q.with) && now() - (+Q.at || 0) < 180000);
  }
  // another headset here aligned through a shared space with this headset's id (it took the room from the space,
  // or is its origin), from its presence. In the relay's logs a Quest that left AR and entered it again got its
  // space back under the same id but as its own floor, while the other headset's stayed where it was: two spaces.
  // Its own frame from before, taken through the new one, put the room somewhere else for it alone
  function alignedHere() {
    if (!R.sharedId) return false;
    const t = performance.now();
    for (const [id, P] of C.pres) {
      const m = member(id);
      if (m && m.here && m.kind !== 'desktop' && t - P.at < 3000 && P.sp === R.sharedId && (P.al === 'adopted' || P.al === 'shared')) return true;
    }
    return false;
  }
  // was this headset the first in its space? Decided once its id is known and the room's keys are in: not when
  // someone here had already published for that id, or is aligned through it (null: not decided yet)
  // (a frame from someone who has left counts as nobody's: last time's, from a page since reloaded. Counting other
  // headsets in the room instead stopped alignment when a headset that joined the room later was first in the space)
  // Decided once a session per id: asked again (Re-align, the space asked for again after waking, the id flicking to
  // a default space and back) it stays as it was, since the first headset's space is its own floor too and the
  // others are aligned through it by then
  function firstCheck(t) {
    if (R.firstHere !== null || !R.sharedId || !C.welcomed || !(C.ws && C.ws.readyState === 1 && t - C.openAt > 1000)) return;
    if (R.firstFor.has(R.sharedId)) { R.firstHere = R.firstFor.get(R.sharedId); return; }
    const Q = val(kFrame(R.sharedId)), al = alignedHere();
    R.firstHere = !((validFrame(Q) && Q.by !== C.id && member(Q.by)) || al);
    R.firstFor.set(R.sharedId, R.firstHere);
    log('shared first', { first: R.firstHere, id: R.sharedId, aligned: al });
  }
  // someone pressed Re-align: if this headset wrote the room's frame for that space, it writes it again as it is now
  // (even through a space that is just its own floor: asked for), so the other takes the room as this headset shows it
  function asked(v, by) {
    if (!v || v.id !== R.sharedId || !R.frame || !here() || C.local) return;
    const P = val(kFrame(R.sharedId));
    if (!validFrame(P) || P.by !== C.id) return;
    const can = R.sharedOK && settled() && !notInIt();
    log('frame asked', { by, hold: !!R.wakeHold, can });
    if (!can) return;   // (not now: right after waking, say; the hold stays, and the asker takes what there is)
    R.wakeHold = 0; R.pubAt = 0; R.refresh = 0;
    publishFrame(gradeOf(P), P.g === 'marks' ? P.at : 0);
  }
  function publishFrame(g, at) {
    if (!R.frame || !R.sharedId || !R.sharedOK || !settled() || notInIt() || (g === 'shared' && splitHere())) return;
    const S = toShared(R.frame);
    R.pubAt = performance.now();
    // (p: when it was written into the space as it is now; after a standby only a frame written since counts, wakeOK)
    publish([[kFrame(R.sharedId), { uuid: R.sharedId, o: S.o, x: S.x, g, by: C.id, at: at || Math.round(now()), p: Math.round(now()), m: R.mk }]]);
    log('frame published', { uuid: R.sharedId, g });
  }
  const validFrame = P => !!(P && typeof P === 'object' && Array.isArray(P.o) && P.o.length === 3 && Array.isArray(P.x) && P.x.length === 3 &&
    P.o.concat(P.x).every(Number.isFinite));
  const gradeOf = P => (P.g === 'marks' || P.g === 'shared' ? P.g : /^(marks|anchor|saved)$/.test(P.src) ? 'marks' : 'shared');
  // a calibrated headset publishes its frame for its shared space, so headsets without marks there can take it;
  // a newer calibration of someone still in the room stays
  function publishOwn() {
    if (!R.shared || !R.sharedOK || !R.sharedId || !R.frame || !settled() || performance.now() - R.pubAt < 1000) return;
    const P = val(kFrame(R.sharedId)), at = (R.saved && R.saved.at) || 0, mine = validFrame(P) && P.by === C.id;
    if (validFrame(P) && !mine && gradeOf(P) === 'marks' && member(P.by) && (+P.at || 0) >= at) return;
    if (mine && P.at === at && P.g === 'marks') { const F = fromShared(P), [d, a] = apart(F, R.frame); if (d < 0.01 && a < 0.003 && Math.abs(F.o[1] - R.frame.o[1]) < 0.01) return; }
    publishFrame('marks', at);
  }
  // with marks of our own: how far the shared space puts another headset's calibration from ours
  function compare() {
    const P = R.sharedOK && R.sharedId && settled() && !notInIt() ? val(kFrame(R.sharedId)) : null;
    if (!validFrame(P) || P.by === C.id || gradeOf(P) !== 'marks' || !R.frame) { R.cmp = null; R.badSince = 0; return; }
    const F = fromShared(P);
    if (!level(F.x)) { R.cmp = null; R.badSince = 0; return; }
    const [d, a] = apart(F, R.frame), was = R.cmp;
    R.cmp = { d: r3(d), a: Math.round(a * 1800 / Math.PI) / 10, by: P.by };
    if (!was || Math.abs(was.d - R.cmp.d) > 0.005 || Math.abs(was.a - R.cmp.a) > 0.2) { log('compare', R.cmp); changed(); }
    splitCheck(performance.now());
  }
  // the comparison said to the room: marks more than 10 cm or 3 degrees apart for 5 s mark this space id as split (a
  // working space kept two calibrations on the same tape within 1 to 2 cm); within 5 cm and 2 degrees it is whole again
  // (only the pair that measured it says it is whole again, or writes it again: a third calibrated headset may be
  // in one space with one of them)
  function splitCheck(t) {
    const c = R.cmp, Q = val(kSplit(R.sharedId)), split = !!(Q && Q.bad === true), ours = split && (Q.by === C.id || Q.with === C.id);
    const bad = !!c && (c.d > 0.1 || c.a > 3), good = !!c && c.d < 0.05 && c.a < 2;
    if (!bad) R.badSince = 0; else if (!R.badSince) R.badSince = t;
    const live = split && member(Q.by) && member(Q.with) && now() - (+Q.at || 0) < 120000;
    if (bad && t - R.badSince > 5000 && (!live || (ours && now() - (+Q.at || 0) > 60000))) {
      publish([[kSplit(R.sharedId), { uuid: R.sharedId, bad: true, d: c.d, a: c.a, by: C.id, with: c.by, at: Math.round(now()) }]]);
      if (!live) log('shared split', { d: c.d, a: c.a, with: c.by });
    } else if (good && ours) {
      publish([[kSplit(R.sharedId), { uuid: R.sharedId, bad: false, d: c.d, a: c.a, by: C.id, with: c.by, at: Math.round(now()) }]]);
      log('shared whole', { d: c.d, a: c.a, with: c.by });
    }
  }
  // without marks: keep to the frame published for our shared space (adopt it when ours differs by more than
  // 3 cm or a degree)
  function reconcile(P) {
    const F = fromShared(P), x = level(F.x);
    if (!x) return;
    // the height: this headset's own floor when it first takes the room (two headsets' floors were 44 cm apart
    // through two spaces that were not one), then held in the shared space, so a floor estimated again (12 to 17 cm
    // after waking, in the logs) does not move the room up or down
    const ys = sharedY();
    // a jump of more than 30 cm is no floor estimated again (12 to 17 cm) but a space made again under the same id
    // (the room keeps its height then: the floor under this headset may be the one estimated wrong)
    if (R.hS !== null && R.frame && Math.abs(R.hS + ys - R.frame.o[1]) > 0.3) { log('shared height again', { was: r3(R.frame.o[1]), now: r3(R.hS + ys) }); R.hS = R.frame.o[1] - ys; }
    if (R.hS === null) R.hS = -ys;
    F.x = x; F.o[1] = R.hS + ys;
    const mk = Array.isArray(P.m) && P.m.length === 3 && P.m.every(Number.isFinite) ? P.m : null;
    const ours = R.src === 'shared' && P.by === C.id;   // our own space's origin
    if (!R.frame || (R.again && !ours)) {
      const again = !!R.frame;
      R.again = 0; R.mk = mk;
      setFrame(F, 'adopted', again ? 'Re-aligned' : 'Aligned automatically', 'This headset took the room from the shared space. Check: the orange crosses sit on the tape marks.');
      if (again) changed();
      return;
    }
    const [d, a] = apart(F, R.frame), h = Math.abs(F.o[1] - R.frame.o[1]);
    if (ours) {   // kept on the space (a recentre moves local-floor)
      if (R.again || d > 0.03 || a > Math.PI / 180 || h > 0.02) { log('reconcile', { own: true, d: r3(d), a: r3(a), h: r3(h) }); setFrame(F, 'shared', R.again ? 'Re-aligned' : '', 'Back on the shared space\'s origin, where the others have the room.'); }
      if (R.again) { R.again = 0; changed(); }
      return;
    }
    if (d <= 0.03 && a <= Math.PI / 180 && h <= 0.02 && R.src === 'adopted') { R.mk = mk; return; }
    log('reconcile', { d: r3(d), a: r3(a), h: r3(h), by: P.by, g: gradeOf(P) });
    R.mk = mk;
    if (d <= 0.03 && a <= Math.PI / 180 && R.src === 'adopted') { setFrame(F, 'adopted'); return; }   // the height only: no notice
    setFrame(F, 'adopted', 'Re-aligned', 'The room frame changed: things moved to where the others see them.');
  }
  // ------------------------------------------------------------ the marks' anchors --
  // Two anchors, at mark A and mark B: only their positions are used (an anchor's turn is not trusted), they
  // keep the frame on the marks when the origin moves, and their saved handles find the marks next time.
  function releaseAnchors() {
    if (R.anchors) for (const a of R.anchors) { try { a.delete(); } catch (e) { /* gone */ } }
    R.anchors = null; R.anchorIds = null; R.anchorsOK = false; R.anchorP = null;
  }
  // at the end of a session (or when the marks are given up): new anchors not yet checked lose their handles too
  function letGo() { if (R.anchorIds && !R.anchorsOK) dropAnchors(); else releaseAnchors(); }
  function dropAnchors() {   // and their saved handles
    const ids = new Set([...(R.anchorIds || []), ...((R.saved && R.saved.anchors) || [])].filter(Boolean));
    releaseAnchors();
    if (HOST.anchor.drop) for (const u of ids) HOST.anchor.drop(u);
  }
  function anchorsAt(f) {
    if (!R.anchors || !R.floor) return null;
    const P = [];
    for (const a of R.anchors) {
      if (f.trackedAnchors && !f.trackedAnchors.has(a)) return null;
      let p = null;
      try { p = f.getPose(a.anchorSpace, R.floor); } catch (e) { /* lost */ }
      if (!p) return null;
      const t = p.transform.position;
      P.push([t.x, t.y, t.z]);
    }
    R.anchorSeen = performance.now();
    return (R.anchorP = P);
  }
  // are the anchors where the marks are? New ones: within 5 cm of where they were asked for; found again: as
  // far apart as the marks were (else they are someone else's, or lost: the marks are calibrated again)
  function anchorsFit(P) {
    const S = R.saved;
    if (!S) return false;
    const ok = R.anchorIds ? dist3(P[0], S.a) <= 0.05 && dist3(P[1], S.b) <= 0.05 : Math.abs(dist3(P[0], P[1]) - dist3(S.a, S.b)) <= 0.05;
    log(ok ? 'anchors fit' : 'anchors off', { made: !!R.anchorIds, a: P[0].map(r3), b: P[1].map(r3) });
    if (!ok) {
      dropAnchors();
      if (S) { S.anchors = []; storeSaved(); }
      if (R.reenter) { R.reenter = false; changed(); }   // no handles left: a new AR session would not find the marks either
      R.afterSleep = false;
      return false;
    }
    R.anchorsOK = true;
    if (R.reenter) { R.reenter = false; changed(); }   // found after all: nothing to leave AR for
    R.afterSleep = false;
    if (R.anchorIds && R.anchorIds.every(Boolean)) { S.anchors = R.anchorIds.slice(); storeSaved(); }
    return true;
  }
  // the browser's store of saved anchors was full ("Maximum number of anchors reached", on one Quest 3 with 9 listed
  // while another saved with 11): the leftovers nobody here knows are deleted and the handles asked once more; if
  // it is still full the marks hold for this session only, and the panel says so (a restart asks to calibrate)
  function handlesAgain(s, g) {
    if (!HOST.anchor.tidy || !HOST.anchor.handle) { R.full = true; return; }
    let ids = null, as = null;   // the anchors whose handles are asked (others may replace them meanwhile: a wake)
    HOST.anchor.tidy().then(rep => {
      log('anchors tidied', rep || { none: true });
      if (R.session !== s || R.mgen !== g || !R.anchors || !R.anchorIds) return null;
      as = R.anchors; ids = R.anchorIds.slice();
      return Promise.all(as.map((a, i) => (ids[i] ? { uuid: ids[i] } : HOST.anchor.handle(a))));
    }).then(rs => {
      if (!rs) return;
      if (R.session !== s || R.mgen !== g || R.anchors !== as) { rs.forEach((r, i) => { if (r.uuid && !ids[i] && HOST.anchor.drop) HOST.anchor.drop(r.uuid); }); return; }
      R.anchorIds = rs.map(r => r.uuid || '');
      const ok = R.anchorIds.every(Boolean);
      log('handles again', { saved: ok, err: rs.map(r => r.err || '').filter(Boolean) });
      R.full = !ok;
      if (ok && R.anchorsOK && R.saved) { R.saved.anchors = R.anchorIds.slice(); storeSaved(); }
      if (!ok) notice('Anchors not saved', 'The headset\'s store of saved anchors is full: the marks hold until the app closes, then it asks to calibrate. Clearing the browser\'s site data may free the store.', 12000);
      changed();
    }).catch(e => { log('handles again', { saved: false, err: [String(e && e.message)] }); if (R.session === s && R.mgen === g) { R.full = true; changed(); } });
  }
  // last time's marks, found again by their anchors. Not found (after 5 and 15 minutes asleep two Quest 3s did not
  // find them on waking, and found them again once AR was entered anew): looked for again every 10 s for two minutes,
  // then every minute up to ten (retryDue); the frame held meanwhile stays
  function restore(t) {
    R.anchorTried = true;
    if (!HOST.anchor.find) return;
    R.anchorBusy = true;
    if (!R.tries) R.anchorSince = t;   // (a retry does not hold the room in 'restoring')
    const s = R.session, g = R.mgen;
    Promise.all(R.saved.anchors.map(u => HOST.anchor.find(u).then(a => a, () => null))).then(as => {
      if (R.session === s && R.mgen === g && as.every(Boolean)) {
        R.anchors = as; R.anchorIds = null; R.anchorsOK = false; R.anchorSince = performance.now();
        if (R.tries) { log('anchors found again', { tries: R.tries }); notice('Marks found again', 'The headset found the tape marks again: things are back where they were calibrated.', 6000); }
        R.tries = 0; R.retryAt = 0; R.retryFrom = 0; R.reenter = false; R.afterSleep = false;
      } else {
        for (const a of as) if (a) { try { a.delete(); } catch (e) { /* gone */ } }
        if (R.mgen === g) {
          log('anchors not found', { found: as.filter(Boolean).length, tries: R.tries });
          if (R.afterSleep && own() && R.frame) lostMarks('wake');   // (looked for by their handles after waking)
          const now2 = performance.now();
          if (!R.retryFrom) R.retryFrom = now2;
          R.tries++;
          R.retryAt = now2 - R.retryFrom < 600000 ? now2 + (now2 - R.retryFrom < 120000 ? 10000 : 60000) : 0;
        }
      }
    }).then(() => { if (R.mgen === g) R.anchorBusy = false; });
  }
  // time to look for the marks' anchors again (restore): the next try is asked for as at the start
  function retryDue(t) {
    if (!R.retryAt || t < R.retryAt || R.anchorBusy || R.anchors || !R.saved || R.saved.anchors.length !== 2) return;
    R.retryAt = 0; R.anchorTried = false;
  }
  // with marks of our own: the anchors keep the frame on them (a recentre moves local-floor, not the marks)
  function followAnchors(f) {
    const P = anchorsAt(f);
    if (!P) return;
    if (!R.anchorsOK && !anchorsFit(P)) return;
    const F = fromMarks(P[0], P[1]);
    if (!F.x) return;
    const [d, a] = apart(F, R.frame), h = Math.abs(F.o[1] - R.frame.o[1]);
    if (d > 0.02 || a > 0.005 || h > 0.02) { log('anchors moved', { d: r3(d), a: r3(a), h: r3(h) }); R.mk = marksMk(P[0], P[1]); setFrame(F, R.src); }
  }
  // without anchors: the room's floor (key rm) may change; the marks stay where they were touched
  function refloor() {
    if (R.anchors && R.anchorsOK || !R.saved || !R.frame) return;
    const y = floorUnder(R.saved.a, R.saved.b);
    if (Math.abs(y - R.frame.o[1]) > 0.01) { log('floor', { y: r3(y) }); R.mk = marksMk(R.saved.a, R.saved.b); R.frame.o[1] = y; }
  }
  const validFloor = () => { const M = val('rm'); return !!(M && Number.isFinite(M.a) && Number.isFinite(M.d)); };
  const marksNow = () => (R.anchors && R.anchorsOK && R.anchorP ? R.anchorP : [R.saved.a, R.saved.b]);   // in local-floor now
  // back from being off (or the origin moved): Quest moves the origin and says so with a reset (applied in
  // floorReset); anchors made this session were not tracked again after a sleep, so they are looked for again by
  // their saved handles while the frame stays (the frame is never dropped here: a woken headset that asked to
  // calibrate every time was worse), and the orange crosses show for a while, so a frame off the tape is seen
  function afterWake(f, t) {
    if (R.anchors && R.anchorsOK && anchorsAt(f)) { log('marks tracked again', { after: Math.round(t - R.woke) }); R.woke = 0; R.recAt = 0; R.reenter = false; return true; }
    if (t - R.woke < 5000) return true;
    const reset = R.resetAt >= R.sleptAt, anchors = !!R.anchors, ids = !!(R.saved && R.saved.anchors.length === 2);
    log('marks unanswered', { reset, anchors, handles: ids });
    R.woke = 0;
    if (anchors && ids) { releaseAnchors(); R.anchorTried = false; R.afterSleep = true; }   // looked for again by their handles (align)
    if (!reset && !anchors) return true;   // nothing moved, as far as the headset says (the system menu)
    R.showUntil = t + 30000;
    notice('Check the marks', 'The headset was off: the orange crosses should sit on the tape marks. If they do not, calibrate again.', 8000);
    return true;
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
    R.mk = null;
    setFrame({ o: [hp.x, 0, hp.z], x: [Math.cos(yaw), 0, -Math.sin(yaw)] }, 'own', askHere() ? '' : 'Joined from elsewhere',
      'The stations stand round you as they stand in the room. In the room with the others after all? Say so in the menu (' + menuWhere() + ').');
  }
  // is the room calibrated in a shared space other than ours, by someone still here? (then our space's own
  // origin would make another room: calibrate instead)
  // someone here published a frame for another shared space (calibrated there, or its first headset): this headset
  // is not in theirs, so its own space must not become the room
  function othersElsewhere() {
    for (const [k, e] of C.keys) {
      const P = e && e.v;
      if (/^rf\./.test(k) && validFrame(P) && P.uuid !== R.sharedId && P.by !== C.id && member(P.by)) return true;
    }
    return false;
  }
  function align(f, local) {
    const t = performance.now();
    if (R.calib) return;   // calibrating: the old frame (if any) holds until both marks are in
    if (!here()) { ownFrame(f, local); return; }
    if (R.src === 'own') { R.frame = null; R.src = ''; }
    // (1) our own marks: nothing overrides them; their anchors keep the frame on them
    if (own() && R.frame) {
      if (R.woke && !afterWake(f, t)) return;
      retryDue(t);
      if (R.saved && R.saved.anchors.length === 2 && !R.anchorTried && !R.anchors) restore(t);   // after waking, or Re-align
      if (t - R.recAt > 500) { R.recAt = t; followAnchors(f); refloor(); compare(); publishOwn(); if (!validFloor() || !member(val('rm').by)) claimFloor(...marksNow()); }
      // back from standby (or asked by someone's Re-align): our marks' frame written into the space again once settled
      if (R.refresh && !R.woke && R.shared && R.sharedOK && R.sharedId && settled() && !R.sharedOwn) {
        R.refresh = 0;
        const P = val(kFrame(R.sharedId));
        if (validFrame(P) && P.by === C.id) { R.pubAt = 0; publishFrame('marks', (R.saved && R.saved.at) || 0); }
      }
      if (R.again) {   // Re-align: the marks found again by their anchors (the frame moves to them), or not
        if (R.anchors && R.anchorsOK) { R.again = 0; notice('Re-aligned', 'Found your marks again. Check: the orange crosses sit on the tape marks.', 6000); changed(); }
        else if (t - R.again > 10000 || (R.anchorTried && !R.anchorBusy && !R.anchors)) {
          R.again = 0; notice('Marks not found', 'The headset did not find your marks in this session. Leave AR and enter it again: they come back then. If the orange crosses are still off the tape marks, calibrate again.', 12000); changed();
        }
      }
      return;
    }
    retryDue(t);
    if (R.saved && R.saved.anchors.length === 2 && !R.anchorTried && !R.anchors) restore(t);
    if (R.anchors) {
      const P = anchorsAt(f);
      if (P && (R.anchorsOK || anchorsFit(P))) {
        claimFloor(P[0], P[1]);
        R.mk = marksMk(P[0], P[1]);
        setFrame(fromMarks(P[0], P[1]), 'anchor', 'Room calibration from last time', 'Found the marks this headset saved. Check: the orange crosses sit on the tape marks.');
        return;
      }
    }
    if ((R.anchorBusy || R.anchors) && t - R.anchorSince < 8000) { setState('restoring'); return; }
    if (R.anchors && !R.anchorsOK) { log('anchors not tracked'); letGo(); }
    // back from standby and still not in the others' shared space 15 s later (its own floor while they published, or
    // no pose at all): it is asked for once more (a new request may join it); Re-align does the same by hand
    if (R.visibleAt && R.reasked !== R.visibleAt && t - R.visibleAt > 15000 && R.shared && (R.notJoined || !R.sharedOK)) { R.reasked = R.visibleAt; reshared('wake'); }
    // (2) a frame published for our shared space (unless switched off on the panel)
    firstCheck(t);
    const sp = !!(R.sharedAlign && R.shared && R.sharedOK && R.sharedId), P0 = sp ? val(kFrame(R.sharedId)) : null;
    // A space that is just this headset's own floor is either the first headset's (its origin is the space's) or,
    // when someone here had already published for it as its id appeared, not joined (the default space, or one
    // Quest 3 every session under the others' id): their frame through it would put the room where this headset
    // began, so it is not taken. A frame from someone who has left may be last time's (the id stayed the same across
    // days): it is taken only after the wait, and the first headset replaces it with its own space then. Not right
    // after connecting (the members may not be known yet)
    const other = validFrame(P0) && P0.by !== C.id, known = !!(C.ws && C.ws.readyState === 1 && t - C.openAt > 5000);
    const gone = other && known && !member(P0.by), mine = !!(other && R.sharedOwn);
    // (also a frame this headset published itself, before it left AR: the others may still be in that space)
    const alone = !!R.sharedOwn && R.firstHere === false && (validFrame(P0) || alignedHere()), stale = mine && R.firstHere === true && gone;
    // Re-align (R.again): decided again as at the start, while the frame held so far stays until another is found.
    // A 'floor' frame (a room on this device, now on a relay) is kept only until the shared space gives a frame
    const fresh = !R.frame || !!R.again || (R.src === 'floor' && !C.local);
    // (also while the room's members are not known: a session begun after a night may still have last night's keys,
    // its socket not yet back)
    const early = other && (gone || !known) && fresh && t - (R.sharedAt || 0) < 8000;
    // nothing published for this space while someone here published for another one: the others are elsewhere
    const away = !validFrame(P0) && fresh && sp && othersElsewhere();
    // two calibrated headsets here found this space id split (splitHere): nothing is taken through it
    const split = sp && splitHere();
    const notJoined = alone || away, P = alone || early || stale || split ? null : P0;
    if (notJoined !== !!R.aloneAt) { R.aloneAt = notJoined ? t : 0; log(notJoined ? 'shared not joined' : 'shared joined', notJoined ? { by: P0 && P0.by, away } : {}); }
    const shown = notJoined && t - R.aloneAt > 2000;   // the panel says so after 2 s (a default space passes)
    if (shown !== R.notJoined) { R.notJoined = shown; changed(); }
    // Re-align asked the others to write the room's frame into the space again (q.frame): a moment for it to come
    if (R.again && validFrame(P) && P.by !== C.id && (+P.p || 0) < R.againRel && t - R.again < 3000) return;
    if (validFrame(P)) {
      if (R.frame && R.wakeHold && !wakeOK(P, t)) return;   // after waking: the frame the floor's resets carried over holds
      if (fresh || t - R.recAt > 500) { R.recAt = t; reconcile(P); }
      if (R.frame && !R.again) return;
    }
    if (split) {   // a frame held so far stays (taking nothing more through the space); without one, calibrate
      const text = 'Calibrated headsets here found that the shared space puts them apart. Calibrate this headset on the same tape marks.';
      if (R.again) { R.again = 0; changed(); notice('Shared space not usable', text, 9000); }
      if (!R.frame && R.state !== 'restoring') { setState('calibrate'); if (R.noticed !== 'split') { R.noticed = 'split'; notice('Shared space not usable', text, 9000); } }
      return;
    }
    if (notJoined && R.frame && !R.again) {   // the frame held so far stays (moved by the floor's resets) until it joins
      if (R.wakeHold && R.notJoined && R.noticed !== 'alone') { R.noticed = 'alone'; notice('Not in the shared space', 'Back from standby, this headset has not found the others\' shared space: the room stays where it was. If it looks off, press Re-align, or calibrate on the tape marks.', 9000); }
      return;
    }
    // waiting a little for the shared space's id, or for someone's published frame
    if (R.sharedAlign && R.shared && fresh && t - (R.sharedId ? R.sharedAt : R.sharedAsked) < 8000) { if (!R.frame) setState('shared-wait'); return; }
    // a frame this headset holds and nobody published for this space: Re-align on the headset whose frame is the
    // room's (a new id), or the 'floor' of a room on this device now on a relay. The room stays where it is and goes
    // into this space for the others (taking the space's origin would move it for this headset alone)
    const keep = R.frame && ((R.again && R.src === 'shared') || (R.src === 'floor' && !C.local));
    if (sp && keep && !validFrame(P0) && !othersElsewhere() && !notJoined) {
      const was = R.src;
      R.again = 0; R.pubAt = 0; R.mk = null; R.hS = R.frame.o[1] - sharedY();
      if (was === 'floor') setFrame(R.frame, 'shared');
      publishFrame('shared');
      notice(was === 'floor' ? 'Shared space found' : 'Re-aligned', 'The room stays where it is, written into this shared space for the others.', 6000); changed();
      return;
    }
    // (3) nobody (still here) published for this space: its own origin, published (unless the others are elsewhere)
    if (sp && (!R.frame || R.again) && !othersElsewhere() && !notJoined) {
      R.mk = null;
      const F = fromShared({ o: [0, 0, 0], x: [1, 0, 0] }), again = !!R.frame;
      F.o[1] = 0; R.hS = -sharedY();   // the space's origin need not lie on the floor: this headset's floor is the room's
      R.again = 0;
      setFrame(F, 'shared', again ? 'Re-aligned' : 'Shared space found', 'This headset defines the room for the others in its shared space.');
    }
    if (sp && R.src === 'shared' && (!validFrame(P0) || stale) && t - R.pubAt > 2000) publishFrame('shared');
    // back from standby: the room's frame, if this headset wrote it, is written into the space again once settled, so
    // the others know it is current (wakeOK)
    if (R.refresh && !R.wakeHold && sp && settled() && !R.sharedOwn && R.src === 'shared' && validFrame(P0) && P0.by === C.id) { R.refresh = 0; R.pubAt = 0; publishFrame('shared'); }
    if (R.again && R.frame) {   // Re-align found nothing better: the frame stays as it was
      R.again = 0; changed();
      if (notJoined) notice('Not in the shared space', 'Check on every headset: the same Quest Browser version, the WebXR experiments flag, Enhanced spatial services, the same address. Then restart both headsets and start one after the other, or calibrate both on the same tape marks.', 9000);
      else notice('Nothing to re-align to', C.local ? 'No shared space here: the stations stay where they are. Calibrate on two tape marks to keep them in place.' : 'No frame came through the shared space: things stay where they are. Calibrate on the tape marks to line up with the others.', 9000);
      return;
    }
    if (R.again && !R.frame && R.state !== 'restoring') { R.again = 0; changed(); }   // Re-align with no frame: as at the start (below)
    if (!R.frame && R.state !== 'restoring') {
      // on this headset alone there is nobody to line up with: the stations stand on its floor (where the session
      // began) until it is calibrated, which keeps them in place next time
      if (C.local && R.lfOK) { R.mk = null; setFrame({ o: [0, 0, 0], x: [1, 0, 0] }, 'floor', 'On your floor', 'The stations stand where you put them, for this session. To keep them in place next time, calibrate on two tape marks (Calibrate, in the menu).'); return; }
      setState('calibrate');
      if (notJoined && R.noticed !== 'alone') { R.noticed = 'alone'; notice('Not in the shared space', 'Check on every headset: the same Quest Browser version, the WebXR experiments flag, Enhanced spatial services, the same address. Then restart both headsets and start one after the other, or calibrate both on the same tape marks.', 9000); }
      else if (!notJoined && R.noticed !== 'calibrate') { R.noticed = 'calibrate'; notice('Calibrate the room', 'Press Calibrate in the menu (' + menuWhere() + '), then touch mark A and mark B with a controller\'s tip: tape crosses a metre or more apart.', 9000); }
    }
  }
  // After waking, the frame the floor's resets carried over (the room as it was; Quest's transforms were right to
  // 1-1.5 cm) holds until the shared space agrees with it again (10 cm and 3 degrees along the floor; the height may
  // have moved with the floor; not in the first 3 s, while the resets come in). Right after waking the space gave the head's pose
  // for up to 15 s, and after a night it may come back made again under the same id (around whichever headset woke
  // first), so a space that still disagrees once it has held still for 5 s is not simply believed:
  //  - our own publication (this headset wrote the room's frame): written into the space again as the frame is now
  //    (taken back through a space made again, it would move the room for this headset alone), but not into a space
  //    that is just this headset's own floor (nobody else is known to be in it: the frame holds)
  //  - someone else's: followed only once written since this headset fell asleep (its writer awake again, its frame
  //    put into the space as it is now: refresh), or when the floor moved with no transform (R.blind), and never
  //    through a space that is just this headset's own floor. Until then the room stays where it was
  // (one of two headsets was offset after a long standby: by the logs' rules, the one that followed last night's
  // frame through a space made again around the other)
  function wakeOK(P, t) {
    const [d, a] = apart(fromShared(P), R.frame), agree = d <= 0.1 && a <= 0.05, steady = t - R.stillSince > 5000;
    const out = why => { log('shared after wake', Object.assign({ d: r3(d), a: r3(a), after: Math.round(t - R.wakeHold) }, why)); R.wakeHold = 0; };
    const held = () => { if (t - R.wakeLog > 2000) { R.wakeLog = t; log('shared held after wake', { d: r3(d), a: r3(a), own: !!R.sharedOwn, blind: R.blind, settling: !settled() }); } return false; };
    // a space that agrees is trusted once the floor's resets are in (they come just after waking); one that disagrees
    // only once settled (20 s: the space gave the head's pose for up to 15 s)
    if (t - R.visibleAt < 3000) return held();
    if (agree) { out({ agree }); return true; }
    if (!settled()) return held();
    if (steady && P.by === C.id && !R.sharedOwn) {   // our own frame, written into the space this headset is in now
      out({ republished: true }); R.pubAt = 0; R.refresh = 0;
      publishFrame(gradeOf(P), P.g === 'marks' ? P.at : 0);
      return false;
    }
    // someone else's, written since this headset fell asleep; or the floor moved with no transform to carry the frame
    // (then the carried frame is no better than the space)
    if (steady && P.by !== C.id && !R.sharedOwn && ((+P.p || 0) > R.sleptRel || R.blind)) { out({ fresh: (+P.p || 0) > R.sleptRel, blind: R.blind }); return true; }
    // still held: whoever wrote the room's frame is asked once (per wake) to write it into the space as it is now
    if (steady && P.by !== C.id && R.qAsk !== R.visibleAt) { R.qAsk = R.visibleAt; fx('q.frame', { id: R.sharedId }); log('frame asked for', { by: P.by }); }
    if (R.blind && R.sharedOwn && steady && R.noticed !== 'lost') {
      R.noticed = 'lost';
      notice('Lost its place', 'The headset lost its place while it was off: press Re-align in the menu (' + menuWhere() + '), or calibrate on the tape marks.', 12000);
    }
    return held();
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
      if (id && id !== R.sharedId) { R.sharedId = id; R.sharedAt = performance.now(); R.hS = null; R.firstHere = null; log('shared id', { id }); }
      let p = null;
      try { p = f.getPose(R.shared, local); } catch (e) { /* not now */ }
      R.sharedPose = !!p;
      if (p) {
        R.ls.fromArray(p.transform.matrix);
        // right after waking Quest gave the head's pose as the shared space's for up to 15 s (relay logs: frames
        // published and compared then were metres out): such a pose is not used (and see settled)
        const q = p.transform.position, atHead = HD.ok && Math.hypot(q.x - HD.p.x, q.y - HD.p.y, q.z - HD.p.z) < 0.05;
        if (atHead !== R.sharedHead) { R.sharedHead = atHead; log(atHead ? 'shared at head' : 'shared off head', {}); }
        R.sharedOK = !atHead;
        if (R.sharedOK) ownFloorCheck(performance.now());
      }
    }
    scanCheck(f, performance.now());
    align(f, local);
    // new anchors at mark A and mark B (asked inside a frame, as WebXR wants)
    if (R.wantAnchors && R.saved && R.floor && HOST.anchor.keep) {
      const w = R.saved, s = R.session, g = R.mgen, q = { x: 0, y: 0, z: 0, w: 1 };
      R.wantAnchors = null;
      const one = p => HOST.anchor.keep(f, R.floor, { x: p[0], y: p[1], z: p[2] }, q, '').then(r => r, e => { log('no anchor', { e: e && e.message }); return null; });
      Promise.all([one(w.a), one(w.b)]).then(rs => {
        if (R.session !== s || R.mgen !== g || !rs[0] || !rs[1]) {   // the marks were forgotten or replaced meanwhile, or one failed
          for (const r of rs) if (r) { try { r.anchor.delete(); } catch (e) { /* gone */ } if (r.uuid && HOST.anchor.drop) HOST.anchor.drop(r.uuid); }
          return;
        }
        releaseAnchors();
        R.anchors = rs.map(r => r.anchor); R.anchorIds = rs.map(r => r.uuid || ''); R.anchorsOK = false; R.recAt = 0;
        log('anchors made', { saved: rs.every(r => r.uuid), err: rs.map(r => r.err || '').filter(Boolean) });
        if (rs.some(r => !r.uuid && /maximum/i.test(r.err || ''))) handlesAgain(s, g); else R.full = false;
      });
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
    R.calib = { step: 'a', a: null }; R.again = 0;
    setState('mark-a');
    notice('Calibrate the room', 'Put the bright ring at the front of a controller on mark A, hold still and pull the trigger.', 0);
    log('calibrate');
  }
  function cancel() { if (!R.calib) return; R.calib = null; NOTE.until = 0; setState(R.frame ? R.src : 'calibrate'); log('calibrate cancelled'); }
  // Forget calibration: this headset's marks and their anchors go, and it aligns again from the start (from the
  // frame published for its shared space, if there is one; else it asks to calibrate)
  function forgetMarks() {
    dropAnchors();
    R.saved = null; storeSaved();
    Object.assign(R, { frame: null, src: '', aligned: false, anchorBusy: false, anchorTried: false, wantAnchors: null, calib: null, noticed: '', recAt: 0,
      mgen: R.mgen + 1, mk: null, cmp: null, tries: 0, retryAt: 0, retryFrom: 0, reenter: false, afterSleep: false });
    const t = performance.now(); R.sharedAsked = t; if (R.sharedId) R.sharedAt = t;
    setState('waiting');
    notice('Calibration forgotten', 'This headset lines up again: from the frame the room holds for its shared space, else it asks you to calibrate.', 6000);
    log('forget marks');
  }
  // Re-align (in the menu): this headset lines up again from the start, as when it joined, without leaving the
  // session and without forgetting its marks. The shared space is asked for again (a headset back from standby may
  // have lost the others' space), what was held since waking is dropped, its own marks are looked for again by their
  // anchors (the orange crosses show), and otherwise the room's frame is taken afresh through the shared space. The
  // frame held so far stays until another is found (align, fresh)
  function realignNow() {
    if (!R.session || !C.code) return;
    const t = performance.now();
    log('realign', { src: R.src, state: R.state, wakeHold: !!R.wakeHold, notJoined: R.notJoined, own: R.sharedOwn, id: R.sharedId });
    if (R.calib) cancel();
    Object.assign(R, { again: t, againRel: now(), wakeHold: 0, hS: null, aloneAt: 0, notJoined: false, firstHere: null, cmp: null, recAt: 0, prev: null, noticed: '', woke: 0 });
    if (R.sharedId) fx('q.frame', { id: R.sharedId });   // whoever wrote the room's frame writes it into the space again
    if (!here()) { R.again = 0; R.frame = null; R.src = ''; R.aligned = false; notice('Re-aligned', 'The stations stand round you again, as they stand in the room.', 5000); changed(); return; }
    reshared('realign');
    if (own()) {
      if (R.saved && R.saved.anchors.length === 2) { releaseAnchors(); Object.assign(R, { anchorTried: false, anchorBusy: false, tries: 0, retryAt: 0, retryFrom: 0 }); }   // found again by their saved handles
      else { R.again = 0; notice('No anchors to look for', 'This calibration has no saved anchors. If the orange crosses are off the tape marks, calibrate again.', 9000); }
      R.showUntil = t + 30000;
      if (R.again) notice('Re-aligning', 'Looking for your marks again...', 12000);
    } else notice('Re-aligning', 'Asking the shared space again...', 12000);
    changed();
  }
  // the shared space asked for again: a new request may join the space the others are in. Its id and pose are
  // waited for as at the start (the old space reports nothing more here)
  function reshared(why) {
    const s = R.session, old = R.shared;
    if (!s || R.begun !== s || !old) return;
    let p = null;
    try { p = Promise.resolve(s.requestReferenceSpace('shared')); } catch (e) { log('shared asked again', { why, e: e.message }); return; }
    p.then(sp => {
      if (R.session !== s || R.shared !== old || !sp) return;
      if (sp !== old) {
        try { if (old.removeEventListener) old.removeEventListener('reset', sharedReset); } catch (e) { /* gone */ }
        R.shared = sp;
        if (sp.addEventListener) quiet(() => sp.addEventListener('reset', sharedReset));
      }
      const t = performance.now();
      // (whether it is this headset's own floor carries over: a space that joined the others jumps away from it)
      Object.assign(R, { sharedId: sharedIdOf(sp), sharedAt: t, sharedAsked: t, hS: null, firstHere: null, lastS: null, stillSince: t, recAt: 0, sharedOK: false });
      log('shared asked again', { why, id: R.sharedId, same: sp === old });
    }, e => log('shared asked again', { why, e: e && e.message }));
  }
  // the shared space, to compare headsets: the same id on each means they share one room
  function sharedLine() {
    if (!R.session || !C.code) return '';
    // the id alone proves little (two headsets had the same id and different spaces), so the browser's version is
    // shown too: the headset with the older one never joined the other's space
    if (R.sharedId) return 'Shared space ' + R.sharedId.slice(0, 8) + (BROWSER ? ' (browser ' + BROWSER + ')' : '') +
      (R.sharedOwn ? ': your own floor (first here, or not joined)' : ': the same on every headset?');
    if (R.shared) return 'Shared space: waiting for its id...';
    return R.sharedNo ? 'No shared space (check the WebXR flag, spatial services)' : 'Shared space: asking...';
  }
  // what the room frame rests on, in a line: the check that tells whether the shared space can be trusted
  function sourceLine() {
    if (!R.session || !C.code || !here()) return '';
    if (R.notJoined) return 'Not in the others\' shared space: restart both headsets, or calibrate both on the tape marks';
    if (!R.sharedAlign && !own()) return 'Shared space switched off here: switch it on, or calibrate';
    if (!own() && R.sharedId && splitHere()) { const Q = val(kSplit(R.sharedId)); return `The shared space puts calibrated headsets here ${Math.round(Q.d * 100)} cm apart: calibrate on the tape marks`; }
    if (R.cmp) return `The shared space puts ${whose(R.cmp.by)} marks ${Math.round(R.cmp.d * 100)} cm, ${R.cmp.a}° from yours` + (R.sharedAlign ? '' : ' (not used)');
    if (R.src === 'adopted') { const P = R.sharedId && val(kFrame(R.sharedId)); return P && gradeOf(P) === 'marks' ? `From ${whose(P.by)} marks, through the shared space` : 'From the shared space\'s own origin'; }
    if (own() && R.reenter) return 'Marks not found in this session: leave AR and enter it again';
    if (own()) return (R.anchors && R.anchorsOK ? 'Your own marks, held by two anchors' : R.anchors ? 'Your own marks (checking their anchors...)' : 'Your own marks (no anchors: calibrate after a recentre)');
    if (R.src === 'floor') return 'Your floor, as this session began: calibrate to keep the stations in place';
    return '';
  }
  // two Quest 3s on different Quest Browser versions had the same shared space id and never one space (the relay's
  // logs): said on the panel when another headset here runs another version than this one
  function versionNote() {
    if (!BROWSER || !here()) return '';
    for (const [id, P] of C.pres) {
      const m = member(id);
      if (P.bv && P.bv !== BROWSER && m && m.kind !== 'desktop' && m.here) return `Quest Browser ${BROWSER} here, ${P.bv} on ${m.name || 'another headset'}: update both (one shared space needs one version)`;
    }
    return '';
  }
  // no room scan on this headset (scanCheck): the shared space and the saved calibration rest on one
  const scanNote = () => (R.noScan && R.session && here() ? 'No room scan here: run Space Setup, with Physical space features on' : '');
  // how this headset's floor compares with the room's (the marks' height), for the panel
  const fullNote = () => (R.full && own() && R.frame ? 'Anchors not saved (the store is full): a restart asks to calibrate' : '');
  function floorNote() {
    if (R.frame && !own()) {   // from the shared space: the floor this headset had when it took the room, held there
      const y = R.frame.o[1];
      return Math.abs(y) > 0.03 ? `Your floor moved ${Math.round(Math.abs(y) * 100)} cm ${y > 0 ? 'down' : 'up'} since you joined (allowed for)` : '';
    }
    if (!own() || !R.frame || !R.saved) return '';
    const M = val('rm'), [a, b] = marksNow(), d = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (M && Number.isFinite(M.d) && Math.abs(M.d - d) > SAME) return `Your marks are ${Math.round(Math.abs(M.d - d) * 100)} cm ${d > M.d ? 'further apart' : 'closer'} than the room's: other tape?`;
    const y = R.frame.o[1];
    return Math.abs(y) > 0.03 ? `Your floor is ${Math.round(Math.abs(y) * 100)} cm ${y > 0 ? 'lower' : 'higher'} than the room's (allowed for)` : '';
  }
  function setSharedAlign(on) {
    R.sharedAlign = !!on; log('shared align', { on: R.sharedAlign });
    if (!on && (R.src === 'adopted' || R.src === 'shared')) { R.frame = null; R.src = ''; R.aligned = false; R.wakeHold = 0; }
    R.recAt = 0; R.sharedAt = R.sharedAsked = performance.now(); changed();
  }
  const whose = id => { const m = member(id); return id === C.id ? 'your' : ((m && m.name) || 'someone') + '\'s'; };
  // A fresh shared space for everyone (two presses, like Remove): the room's generation goes up by one, and every
  // page in the room moves to the app's address for it (sg, SG above). Only where the relay serves the page, and only
  // when the new address answers (an older relay does not serve s/<n>/)
  const FR = { until: 0 };
  const freshArmed = () => performance.now() < FR.until;
  const canFresh = () => !!(C.code && C.via === 'relay' && C.served);   // (the relay serves the app at s/<n>/: never peer to peer)
  const roomGen = () => { const G = val('sg'); return G && Number.isInteger(G.n) && G.n >= 0 && G.n < 10000 ? G.n : 0; };
  function freshAsk() {
    if (!canFresh()) return;
    if (!freshArmed()) { FR.until = performance.now() + 3000; setTimeout(changed, 3050); changed(); return; }
    FR.until = 0;
    const n = Math.max(roomGen(), SG) + 1;
    log('fresh space asked', { n });
    publish([['sg', { n, by: C.id, at: Math.round(now()) }]]);
  }
  function spaceMove() {
    // a room with no generation yet (a relay restarted, a room made again from a page that kept no copy): the page
    // stays where it is, and one at a fresh address gives the room its generation, so the others come there too
    const G = val('sg');
    if (!G || !Number.isInteger(G.n)) {
      if (SG && C.code && C.via === 'relay' && C.welcomed && C.genSent !== C.code) { C.genSent = C.code; publish([['sg', { n: SG, by: C.id, at: Math.round(now()) }]]); }
      return;
    }
    const n = roomGen();
    if (!C.code || C.via !== 'relay' || n === SG || C.moving === n) return;
    if (C.served === null) { detect().then(() => spaceMove()); return; }
    if (!C.served) return;
    C.moving = n;
    const to = appRoot() + (n ? 's/' + n + '/' : '') + location.search + location.hash;
    fetch(appRoot() + (n ? 's/' + n + '/' : '') + 'shared.js', { method: 'HEAD', cache: 'no-store' }).then(r => r.ok, () => false).then(ok => {
      log('fresh space', { from: SG, to: n, ok });
      if (!ok || roomGen() !== n || !C.code) { C.moving = null; return; }
      try { sessionStorage.setItem('collabFresh', String(n)); } catch (e) { /* storage blocked */ }
      upload(performance.now(), true);   // the log so far, before the page goes
      setTimeout(() => location.replace(to), 400);
    });
  }
  const FG = { until: 0 };   // Forget calibration takes two presses: the first arms it for 3 s
  const forgetArmed = () => performance.now() < FG.until;
  function forgetAsk() {
    if (forgetArmed()) { FG.until = 0; forgetMarks(); return; }
    FG.until = performance.now() + 3000; setTimeout(changed, 3050); changed();
  }
  // where controller i pointed just before the press: pulling the trigger moves the hand a little
  // (a controller that only just arrived, more than 5 cm away a moment ago, is taken where it is)
  function steady(h) {
    const t = performance.now(), H = (h.hist || []).filter(e => t - e[0] >= 70);
    let S = H.filter(e => t - e[0] <= 260);
    if (!S.length && H.length) S = H.slice(-1);   // few frames (a slow page): the last one before the pull
    if (!S.length) return h.o.clone();
    const p = new THREE.Vector3();
    for (const e of S) { p.x += e[1]; p.y += e[2]; p.z += e[3]; }
    p.multiplyScalar(1 / S.length);
    return p.distanceTo(h.o) > 0.05 ? h.o.clone() : p;
  }
  function mark(i) {
    const h = C.rays.get(i), t = performance.now();
    if (!R.calib || !h || !R.lfOK) return;
    if (t - R.markAt < 600) { log('mark ignored', { why: 'too soon' }); return; }   // a double pull (or a bouncing trigger)
    R.markAt = t;
    const s = steady(h), p = s.clone().applyMatrix4(R.lfi);   // the controller's target-ray origin, in local-floor coordinates
    log('mark', { step: R.calib.step, p: p.toArray().map(r3), moved: r3(s.distanceTo(h.o)) });
    if (R.calib.step === 'a') { R.calib.a = p; R.calib.step = 'b'; setState('mark-b'); notice('Mark A taken', 'Now put the ring on mark B, a metre or more from A, hold still and pull the trigger.', 0); return; }
    const a = R.calib.a, dx = p.x - a.x, dz = p.z - a.z;
    if (Math.hypot(dx, dz) < 0.5) { notice('Marks too close', 'Mark B must be at least 50 cm from mark A (a metre or more is better). Touch mark B again.', 0); return; }
    R.calib = null;
    dropAnchors();   // the old marks' anchors go now: they would pull the new frame back to the old marks
    R.mgen++; R.anchorBusy = false; R.tries = 0; R.retryAt = 0; R.retryFrom = 0; R.reenter = false; R.afterSleep = false;
    R.saved = { v: 2, a: a.toArray().map(r3), b: p.toArray().map(r3), at: Math.round(now()), anchors: [] };
    storeSaved();   // kept once its anchors are made
    claimFloor(R.saved.a, R.saved.b);
    R.mk = marksMk(R.saved.a, R.saved.b); R.cmp = null; R.pubAt = 0; R.recAt = 0;
    const dh = R.saved.b[1] - R.saved.a[1];
    if (Math.abs(dh) > 0.05) setFrame(fromMarks(R.saved.a, R.saved.b), 'marks', 'Marks at different heights',
      `Mark B is ${Math.round(Math.abs(dh) * 100)} cm ${dh > 0 ? 'higher' : 'lower'} than mark A. If both are on one table or the floor, calibrate again, holding the controller the same way at both.`);
    else setFrame(fromMarks(R.saved.a, R.saved.b), 'marks', 'Room calibrated', 'Check: the orange crosses sit on the tape marks. Everyone who calibrates with the same marks sees the stations in the same places.');
    R.wantAnchors = true;   // made in the next frame, at the marks as they are then
  }
  function status() {
    if (!C.code) return '';
    if (!R.session) return kind() === 'desktop' ? '' : 'starting';
    return { waiting: 'asking the headset...', 'shared-wait': 'looking for the shared space...', restoring: 'finding last time\'s marks...',
      adopted: 'aligned automatically', shared: 'aligned to the shared space', marks: 'calibrated',
      anchor: 'calibrated last time', own: 'elsewhere: the room is round you', calibrate: 'not aligned: calibrate', floor: 'on your floor (this session)',
      'mark-a': 'touch mark A', 'mark-b': 'touch mark B' }[R.state] || R.state;
  }
  // a line a minute (and at every change): what the alignment rests on, for the relay's log (sample, below)
  function sample(t) {
    if (t - R.sampleAt < 5000) return;
    R.sampleAt = t;
    const S = { src: R.src, state: R.state, sid: R.sharedId, sharedOK: R.sharedOK, here: here() };
    if (R.frame) S.frame = { o: R.frame.o.map(r3), x: R.frame.x.map(r3) };
    if (R.lfOK) { const e = R.lf.elements; S.lf = { p: [e[12], e[13], e[14]].map(r3), yaw: r3(Math.atan2(-e[2], e[0])) }; }
    if (R.sharedPose) { const M = floorFromShared(new THREE.Matrix4()), e = M.elements; S.shared = { p: [e[12], e[13], e[14]].map(r3), yaw: r3(Math.atan2(-e[2], e[0])) }; }
    if (R.sharedOwn) S.sharedOwn = true;
    if (R.wakeHold) S.wakeHold = Math.round(t - R.wakeHold);
    if (R.blind) S.blind = true;
    if (R.notJoined) S.notJoined = true;
    if (R.reenter) S.reenter = true;
    if (R.hS !== null) S.hS = r3(R.hS);
    if (R.sharedHead) S.sharedHead = true;
    if (R.scanN >= 0) S.scan = R.scanN;   // planes and meshes detected (scanCheck)
    const Qs = R.sharedId ? val(kSplit(R.sharedId)) : null;
    if (Qs) S.split = { bad: Qs.bad, d: Qs.d, a: Qs.a, by: Qs.by, with: Qs.with, here: splitHere() };
    const bvs = [...C.pres.values()].map(P => P.bv).filter(Boolean);
    if (bvs.length) S.others = bvs;   // the other headsets' Quest Browser versions
    const al = [...C.pres.values()].filter(P => P.sp || P.al).map(P => [(P.sp || '').slice(0, 8), P.al]);
    if (al.length) S.peers = al;   // their shared spaces and what aligns them (alignedHere)
    if (HD.ok && R.lfOK) { const p = _v.copy(HD.p).applyMatrix4(R.lfi); S.head = p.toArray().map(r3); }
    if (R.anchorP) { S.anchors = R.anchorP.map(p => p.map(r3)); S.anchorsAge = Math.round(t - R.anchorSeen); }
    if (R.saved) S.marks = { a: R.saved.a, b: R.saved.b, at: R.saved.at, kept: R.saved.anchors.length === 2 };
    if (R.cmp) S.cmp = R.cmp;
    if (validFloor()) S.rm = val('rm');
    S.sharedAlign = R.sharedAlign;
    const P = R.sharedId ? val(kFrame(R.sharedId)) : null;
    if (validFrame(P)) S.pub = { by: P.by, g: gradeOf(P), at: P.at };
    log('sample', S);
  }
  // the log goes to the relay every 10 s while a headset is in a room (kept in relay/logs/ with --lan or --logs):
  // whether two headsets line up can only be judged from both headsets' numbers
  const UP = { n: 0, at: 0, off: false, busy: false };
  function upload(t, now) {
    if (UP.off || UP.busy || !C.code || !C.relay || C.via !== 'relay' || (!now && t - UP.at < 10000)) return;   // (only a relay keeps them)
    UP.at = t;
    const entries = LOG.filter(e => e.n > UP.n);
    if (!entries.length) return;
    const last = entries[entries.length - 1].n;
    UP.busy = true;
    api('log', { room: C.code, id: C.id, name: C.name, kind: kind(), entries }).then(r => {
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429) || r.status === 507) UP.n = last;   // sent, or never will be
      if (r.status === 404 || r.status === 405 || r.status === 507) { UP.off = true; log('log upload off', { status: r.status }); }
    }, () => { /* the relay is away: next time */ }).then(() => { UP.busy = false; });
  }
  function place(f) {
    if (!C.code || !R.session) return null;
    if (f) update(f);
    const L = liveSt();
    if (!R.aligned || !L || L.story !== HOST.curKey) return null;
    const S = shown(L);
    _v.set(S.x, EYE, S.z).applyMatrix4(R.m);
    return { p: [_v.x, _v.y, _v.z], yaw: R.yaw + S.yaw, room: true };
  }
  const placing = () => { const L = liveSt(); return !!(C.code && R.session && R.aligned && L && L.story === HOST.curKey); };
  // a headset in a shared room away from a station (in no circle yet since the session began, its story not yet loaded,
  // or the room not yet aligned): a story only runs at its station, so the stories hide theirs and pause it, and only the
  // shell's things show. A headset that walked into a circle stays at that station wherever it walks after
  const away = () => !!(C.code && R.session) && !placing();
  // the station's panel and scene as the room has them, in its story's rig (the station's spot at eye height)
  function panelPose(L) {
    const v = L ? roomPanel(L) : panelHome(), q = L ? roomPlace(L) : PLACE0;
    return { pp: [v.x, v.y - EYE, v.z], pr: v.yaw, pq: v.q, off: [q.x, q.y, q.z], s: q.s, q: q.q };
  }
  // for a story starting in a running session at a station (HOST.start): its rig, panel and scene there
  function adopt(key) {
    const L = liveSt();
    if (!C.code || !R.session || !R.aligned || !L || L.story !== key) return null;
    const P = panelPose(L);
    return { rp: new THREE.Vector3(L.x, EYE, L.z).applyMatrix4(R.m), rq: new THREE.Quaternion().setFromAxisAngle(_Y, R.yaw + L.yaw),
      off: new THREE.Vector3().fromArray(P.off), s: P.s, pp: new THREE.Vector3().fromArray(P.pp), pr: P.pr,
      rot: new THREE.Quaternion().fromArray(P.q || Q1), pq: P.pq ? new THREE.Quaternion().fromArray(P.pq) : new THREE.Quaternion().setFromAxisAngle(_Y, P.pr) };
  }
  // the headset session started (or ended): the shell's own frame callback, the spaces, the lifecycle guard
  function watch(s) {
    if (s === R.session) return;
    R.session = s; R.begun = null; R.aligned = false; R.frame = null; R.src = ''; R.calib = null;
    PNL.open = false; PNL.page = 'main'; TCH.armed = false; C.listing.menu = false;   // the menu starts closed: only its clock shows
    // what a story does by itself when a session starts or a headset wakes is not a person's action: not published
    holdTask();
    if (!s) { dropStation(null); letGo(); setState('off'); HOST.audio.zone(null); if (HOST.sfx) HOST.sfx.listen(null); if (C.code) { upload(performance.now(), true); hello(); connect(); } changed(); return; }
    // in a headset a station is reached only by walking into its circle: one this page followed (or a session ended at)
    // is not its station
    if (C.live || C.follow) { log('station dropped for the headset', { st: C.live || C.follow }); C.follow = ''; C.mine = ''; C.live = ''; C.picked = false; C.zone = ''; C.cand = ''; }
    whoStop('headset');   // (a headset walks: following a person is for pages)
    quiet(() => s.addEventListener('visibilitychange', () => {
      holdTask();
      log('headset', { visibility: s.visibilityState });
      const t = performance.now();
      if (s.visibilityState === 'hidden') { if (!R.hiddenAt) { R.hiddenAt = t; R.sleptRel = now(); } dropStation(null); }
      else if (R.hiddenAt) {   // back from off (or the system menu): the origin may have moved under the frame
        log('woke', { away: Math.round(t - R.hiddenAt), src: R.src, anchors: !!(R.anchors && R.anchorsOK) });
        R.sleptAt = R.hiddenAt; R.hiddenAt = 0; R.prev = null; R.visibleAt = t; R.stillSince = t; R.lastS = null; R.blind = false;
        if (own() && R.frame) R.woke = t;
        else if (R.frame && (R.src === 'adopted' || R.src === 'shared')) R.wakeHold = t;   // from the shared space: held until it agrees again
        R.refresh = t;   // the room's frame, if this headset wrote it, is written into the space again once settled (align)
      }
      if (s.visibilityState === 'visible' && C.code) wake('headset');
    }));
    quiet(() => { s.addEventListener('squeezestart', grabStation); s.addEventListener('squeezeend', dropStation); });
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
    watch, update: f => update(f), place, placing, adopt, calibrate, cancel, mark, status, forget: forgetMarks, sharedLine, sourceLine, realignNow,
    // a headset in a shared room: the stories show no Stories screen and no Stories button then (a story is reached by
    // walking into its station's circle), and away from a station (away: no circle walked into yet) they hide their story
    // and pause it
    inRoom: () => !!(C.code && R.session), away,
    // in a shared room the grip moves a scene or a panel only at the headset's station, and not while its story is
    // locked (Lock this story; the circles lock never locks them): what it moves goes out to the room, so everybody sees
    // it alike (placeSync)
    gripLocked: () => !placing() || stLocked(liveSt()),
    get gripHint() {
      // (the flock and the robots are life size: only their panel moves)
      const m = meta(HOST.curKey) || {};
      return 'Trigger (or pinch): use buttons. A or X: play and pause. ' + (!placing() ? 'Grip on a station\'s ring or card: move the station.' : stLocked(liveSt()) ?
        'This story is locked: unlock it in the menu to move things.' : m.life ? 'Grip: move this panel for everyone.' : 'Grip: move the scene or this panel for everyone; both grips resize the scene.');
    },
    get moving() { return MV.id; },
    sharedAlign(on) { if (on !== undefined) setSharedAlign(on); return R.sharedAlign; }, floorNote,
    handles: () => ((R.saved && R.saved.anchors) || []).concat(R.anchorIds || []).filter(Boolean),   // kept by HOST.anchor's tidy-up
    get marks() { return R.mk; }, get cmp() { return R.cmp; }, frameKey: kFrame,
    // the station's panel and scene, for a story's xrRecenter while placed (off, s, pp, pr in its rig; q the scene's
    // turn and pq the panel's rotation, [x, y, z, w] or null: none)
    saved: () => { const L = liveSt(), P = panelPose(L); return placing() ? { off: P.off, s: P.s, pp: P.pp, pr: P.pr, q: P.q, pq: P.pq } : null; },
    joined() { if (R.session) { begin(); loop(R.session); } },
    left() { R.begun = null; R.frame = null; R.src = ''; R.aligned = false; R.calib = null; setState('off'); },
    realign() { R.cmp = null; R.again = 0; if (R.src === 'own' || R.src === 'adopted' || R.src === 'shared' || (R.src === 'floor' && !C.local) || !here()) { R.frame = null; R.src = ''; R.aligned = false; R.recAt = 0; } },
    tick, toRoom: v => v.clone().applyMatrix4(R.mi), toLocal: v => v.clone().applyMatrix4(R.m), matrix: () => R.m.clone(),
    get recAt() { return R.recAt; }, set recAt(v) { R.recAt = v; },
    internals: () => R,
  };
  // the session code above reaches the room frame through R
  Object.assign(R, { joined: HOST.room.joined, left: HOST.room.left, realign: HOST.room.realign, placing, status, update, calibrate, cancel, mark, originCheck, sample, upload, asked });

  // ============================================================ the page's dialog ==
  // The Shared button (top bar and Stories screen): the relay, the open rooms, your name and colour, and when
  // joined the room map (stations and people from above), Follow per station, Arrange all, Add, Remove.
  const DLG = { open: false, el: null, map: null };
  const $ = s => DLG.el.querySelector(s);
  function dialog(open) {
    DLG.el = DLG.el || document.getElementById('shared');
    if (!DLG.el) return;
    DLG.open = open; C.listing.dialog = open;
    DLG.el.hidden = !open;
    document.querySelectorAll('[data-open-shared]').forEach(b => b.setAttribute('aria-expanded', open ? 'true' : 'false'));
    if (!open) return;
    if (!DLG.bound) quiet(bindDialog);   // (the shell's listeners: a story change must not remove them)
    $('#shRelay').value = C.relay.replace(/^http/, 'ws');
    $('#shName').value = C.name;
    detect().then(() => { if (!C.code) { listRooms(); nearFind('dialog'); } renderDialog(); });
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
      else if (act === 'relay') typed($('#shRelay').value);
      else if (act === 'relay2') { const v = $('#shRelay2') && $('#shRelay2').value; if (v) { setRelay(v, 'typed'); probe(performance.now(), true); } }
      else if (act === 'refresh') { listRooms(); nearFind('refresh'); }
      else if (act === 'start') create();
      else if (act === 'join' || act === 'again') join(arg);
      else if (act === 'near') setNear(!nearShown());
      else if (act === 'open') join(arg, true);
      else if (act === 'code') join($('#shCode').value);
      else if (act === 'leave') leave(false, true);
      else if (act === 'follow') { choose(arg, 'follow'); dialog(false); HOST.closePicker(); }
      else if (act === 'unfollow') unfollow();
      else if (act === 'who') { if (followPerson(arg) && C.whoSt) dialog(false); }   // (not at a station yet: the dialog stays, saying so)
      else if (act === 'remove') removeAsk(arg);
      else if (act === 'arrange') arrange({ x: 0, z: 0, yaw: 0 });
      else if (act === 'lock') setLock(!circlesLocked());
      else if (act === 'free') HOST.xr.setFree(!HOST.xr.free());
      else if (act === 'subs') HOST.xr.setSubs(!HOST.xr.subs());
      else if (act === 'panels') { const v = stPanels(C.stById.get(arg)); setStPanels(arg, PANELS[(PANELS.indexOf(v) + 1) % 3]); }   // (not locked with the circles)
      else if (act === 'stlock') setStLock(arg, !stLocked(C.stById.get(arg)));   // (a story's lock: neither is the circles')
      else if (act === 'fresh') { freshAsk(); setTimeout(renderDialog, 3050); }
      else if (act === 'add') { const k = $('#shAdd').value, id = add(k, freeSpot()); if (id) log('added', { st: id, story: k }); }
      else if (act === 'color') setMe({ color: arg });
      else if (act === 'copy') { try { navigator.clipboard.writeText(link()); b.textContent = 'Copied'; } catch (e) { /* no clipboard */ } }
      renderDialog();
    });
    $('#shName').addEventListener('change', ev => setMe({ name: ev.target.value.trim() || C.name }));
    $('#shLabels').addEventListener('change', ev => { HOST.xr.setLabels(ev.target.value); renderDialog(); });
    $('#shRelay').addEventListener('keydown', ev => { if (ev.key === 'Enter') { typed(ev.target.value); renderDialog(); } });
    $('#shCode').addEventListener('keydown', ev => { if (ev.key === 'Enter') join(ev.target.value); });
    DLG.map = $('#shMap');
    DLG.map.style.touchAction = 'none';
    // a station's dot dragged moves it, its square dragged turns it (out to the room ten times a second, so the
    // headsets see it move); a click on either follows it
    const at = ev => { const r = DLG.map.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    DLG.map.addEventListener('pointerdown', ev => {
      if (MAP.drag || ev.button !== 0) return;
      const [px, py] = at(ev), g = mapGrab(px, py), s = g && C.stById.get(g.id);
      if (!s || !MAP.tf) return;
      MAP.drag = { id: g.id, turn: g.turn, pid: ev.pointerId, px, py, moved: false, tf: MAP.tf, ox: s.x - MAP.tf.ix(px), oz: s.z - MAP.tf.iz(py),
        from: { x: s.x, z: s.z, yaw: s.yaw }, pose: null, at: 0, sent: '', locked: circlesLocked() };   // (locked: a click still follows)
      try { DLG.map.setPointerCapture(ev.pointerId); } catch (e) { /* a pointer the page made up */ }
      ev.preventDefault();
    });
    DLG.map.addEventListener('pointermove', ev => {
      const D = MAP.drag;
      if (!D || ev.pointerId !== D.pid) return;
      const s = C.stById.get(D.id);
      if (!s) { MAP.drag = null; return; }
      if (!ev.buttons) { end(ev); return; }   // the button came up where we did not hear it
      const r = DLG.map.getBoundingClientRect(), [qx, qy] = at(ev), px = Math.max(0, Math.min(r.width, qx)), py = Math.max(0, Math.min(r.height, qy));
      if (!D.moved && Math.hypot(px - D.px, py - D.py) < 4) return;
      D.moved = true;
      if (D.locked) return;   // a drag, not a click, but nothing moves
      const x = D.tf.ix(px), z = D.tf.iz(py);
      D.pose = D.turn ? { x: s.x, z: s.z, yaw: Math.atan2(-(x - s.x), -(z - s.z)) } : { x: x + D.ox, z: z + D.oz, yaw: s.yaw };
      mapSend(D, false);
      drawMap();
    });
    function end(ev) {
      const D = MAP.drag;
      if (!D || ev.pointerId !== D.pid) return;
      MAP.drag = null;
      if (ev.type === 'pointercancel' || ev.type === 'lostpointercapture') {   // interrupted: back where it was
        if (D.moved) { D.pose = D.from; D.sent = ''; mapSend(D, true); }
      } else if (D.moved) { mapSend(D, true); if (!D.locked) sfx('place', null, { pan: (ev.clientX / Math.max(1, innerWidth) * 2 - 1) * 0.35 }); }
      else if (ev.type === 'pointerup') { choose(D.id, 'follow'); renderDialog(); }   // a click
      drawMap();
    }
    DLG.map.addEventListener('pointerup', end);
    DLG.map.addEventListener('pointercancel', end);
    DLG.map.addEventListener('lostpointercapture', end);
  }
  // the relay field: a relay's address, or peer:host[:port][/path] (another introduction server for peer to peer; peer:off
  // turns it off, peer:public goes back to PeerJS's own)
  function typed(v) {
    if (/^\s*peer:/i.test(v)) { setPeer(v, 'typed'); $('#shRelay').value = C.relay.replace(/^http/, 'ws'); return; }
    setRelay(v, 'typed'); listRooms();
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
    const n = C.members.length, people = `${n} ${n === 1 ? 'person' : 'people'} in it.`;
    const back = joined && C.auto === C.code ? ' This device joined it again by itself: it was in it on this network.' : '';
    st.textContent = C.note || (joined ? (C.local ? `Room ${C.code} is on this device only: ${whyLocal()}. Its stations and their places are kept here, and the room moves to the relay once it answers${C.peerFail ? ' (or peer to peer, once its server does)' : ''}.` :
      C.via === 'peer' ? `Room ${C.code} · ${connLine()} · ${people} The devices talk to each other directly.${hosting() && IS_HEADSET ? ' A laptop or desktop page that joins takes the room over: a headset sleeps when taken off.' : ' Best hosted by a laptop or desktop page that stays awake, not a headset.'}${back}` :
        `Room ${C.code}: ${connLine()}. ${people}${back}`) :
      C.relay ? (C.served ? 'This page comes from the relay, so it knows where the rooms are.' : 'Rooms on ' + host() + '.') :
        peerOn() ? `No relay known: a room you start runs peer to peer. The devices talk to each other directly; ${peerServer().name} only introduces them. Start the room on a laptop or desktop page that stays awake, and send the others its link. Or enter a relay's address.` :
          'Shared rooms need a relay: a small server on your network that keeps a room in step. Enter its address. Without one (peer to peer is off), a room works on this device alone.');
    st.classList.toggle('warn', !!C.note);
    $('.sh-relay').hidden = !!C.served && !C.note;
    if (!joined) {
      // rooms on this network (and the room used last, when it is not joined by itself here), then the relay's other open
      // rooms, then the rooms kept here
      const near = C.near || [], off = offer(), nl = $('.sh-near');
      if (nl) {
        nl.innerHTML = (off ? `<li class="again"><b>${esc(off.code)}</b><span>Used ${esc(ago(off.at))}. Not joined by itself here: ${esc(offerWhy(off))}.</span><button class="btn primary" type="button" data-sh="again:${esc(off.code)}">${C.relay ? 'Join' : 'Start'} room ${esc(off.code)} again</button></li>` : '') +
          (near.length ? near.map(r => `<li><b>${esc(r.code)}</b><span>${esc(nearLine(r))}</span><button class="btn primary" type="button" data-sh="join:${esc(r.code)}">Join</button></li>`).join('') :
            `<li class="none">${esc(nearNone())}</li>`);
      }
      const rooms = (C.rooms || []).filter(r => !near.some(o => o.code === r.code)), kept = localRooms().filter(r => !rooms.some(o => o.code === r.code) && !near.some(o => o.code === r.code) && !(off && off.code === r.code));
      $('.sh-rooms').innerHTML = (!C.relay ? '' : rooms.length ? rooms.map(r => `<li${r.members ? '' : ' class="empty"'}><b>${esc(r.code)}</b><span>${esc(peopleIn(r))}${r.stations ? ` · ${r.stations} station${r.stations === 1 ? '' : 's'}` : ''}</span><button class="btn${r.members ? ' primary' : ''}" type="button" data-sh="join:${esc(r.code)}">Join</button></li>`).join('')
        : `<li class="none">${esc(C.roomsErr || (C.rooms ? (near.length ? 'No other open rooms.' : 'No open rooms yet. Start one, and others join it here or from a headset.') : 'Looking for rooms...'))}</li>`) +
        kept.map(r => `<li class="empty"><b>${esc(r.code)}</b><span>Kept on this device · ${r.stations} station${r.stations === 1 ? '' : 's'}</span><button class="btn" type="button" data-sh="open:${esc(r.code)}">Open</button></li>`).join('');
      const rf = $('[data-sh="refresh"]');
      if (rf) rf.hidden = !C.relay && !peerOn();
    } else {
      const L = C.stById.get(C.follow);
      $('.sh-room').innerHTML = `<b>${esc(C.code)}</b><span>${C.who ? esc(whoLine()) : L ? 'Following ' + esc(meta(L.story).title) + ' on this page' + (C.whoLeft ? ` (${esc(C.whoLeft)} has left the room)` : '') : 'Follow a station or a person in a headset to see the story here, in step with the room'}</span>
        ${C.local ? '' : '<button class="btn" type="button" data-sh="copy">Copy link</button>'}<button class="btn" type="button" data-sh="leave">Leave</button>` +
        (C.local ? `<div class="row"><input id="shRelay2" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="wss://relay.example.org" aria-label="Relay address" value="${esc(C.relay.replace(/^http/, 'ws'))}"><button class="btn" type="button" data-sh="relay2">Move to this relay</button></div>` : '');
      $('.sh-stations').innerHTML = C.st.length ? C.st.map(s => {
        const m = meta(s.story), on = C.follow === s.id, who = whoAt(s.id).filter(w => w !== 'you'), pm = stPanels(s), sl = stLocked(s);
        return `<li class="${on ? 'on' : ''}"><i style="background:${m.col}"></i><b>${esc(m.title)}</b><span>${esc(stationLine(s))}${who.length ? ' · ' + esc(who.join(', ')) : ''}</span>
          ${on ? '<button class="btn" type="button" data-sh="unfollow">Stop following</button>' : `<button class="btn primary" type="button" data-sh="follow:${s.id}">Follow</button>`}
          <button class="btn pn" type="button" data-sh="panels:${s.id}" aria-pressed="${pm === 'shown'}" title="What the headsets at this circle show of its story's panels: shown, controls only (the foot bar) or hidden. Press for the next" aria-label="Panels at the ${esc(m.title)} station: ${PANELS_SAY[pm]}. Press for ${PANELS_SAY[PANELS[(PANELS.indexOf(pm) + 1) % 3]]}">Panels: ${PANELS_SAY[pm]}</button>
          <button class="btn lk${sl ? ' on' : ''}" type="button" data-sh="stlock:${s.id}" aria-pressed="${sl}" title="Locked: nobody at this circle can move, turn or resize its scene or move its panel (the circle itself is the circles lock's)" aria-label="${sl ? 'The ' + esc(m.title) + ' story is locked: press to unlock it' : 'Lock the ' + esc(m.title) + ' story'}">${sl ? 'Story locked' : 'Lock story'}</button>
          <button class="btn rm${armed(s.id) ? ' armed' : ''}" type="button" data-sh="remove:${s.id}" aria-label="${armed(s.id) ? 'Remove the ' + esc(m.title) + ' station for everyone? Press again to remove it' : 'Remove the ' + esc(m.title) + ' station'}">${armed(s.id) ? 'Remove for everyone?' : 'Remove'}</button></li>`;
      }).join('') : '<li class="none">No stations yet. Arrange all puts every story in two rows; a headset in the room can then move them.</li>';
      const sel = $('#shAdd'), lk = circlesLocked(), lb = $('[data-sh="lock"]');
      const ad = addable();   // (the stories, then the design room)
      if (sel.options.length !== ad.length) sel.innerHTML = ad.map(m => `<option value="${m.key}">${esc(addName(m))}</option>`).join('');
      if (lb) { lb.textContent = lk ? 'Unlock circles' : 'Lock circles'; lb.setAttribute('aria-pressed', String(lk)); lb.classList.toggle('on', lk); }
      // shown on this network or not: the room's (anyone sets it; not locked with the circles); a room on this device is on no network
      const nb = $('[data-sh="near"]'), ns = nearShown();
      if (nb) { nb.hidden = C.local; nb.textContent = ns ? 'Show on this network: on' : 'Show on this network: off'; nb.setAttribute('aria-pressed', String(ns)); }
      // the headsets' labels, moving and subtitles, the room's (not locked with the circles)
      const sl = $('#shLabels'), fb2 = $('[data-sh="free"]'), sb = $('[data-sh="subs"]'), lm = HOST.xr.labels(), fr = HOST.xr.free(), su = HOST.xr.subs();
      if (sl && sl.value !== lm) sl.value = lm;
      if (fb2) { fb2.textContent = fr ? 'Moving: free' : 'Moving: facing you'; fb2.setAttribute('aria-pressed', String(fr)); }
      if (sb) { sb.textContent = su ? 'Subtitles: on' : 'Subtitles: off'; sb.setAttribute('aria-pressed', String(su)); }
      const fb = $('[data-sh="fresh"]'), fa = freshArmed();
      if (fb) { fb.hidden = !canFresh(); fb.textContent = fa ? 'Fresh space for everyone? Press again' : 'Fresh shared space'; fb.classList.toggle('armed', fa); }
      for (const q of DLG.el.querySelectorAll('[data-sh="arrange"], [data-sh="add"], #shAdd, [data-sh^="remove:"]')) q.disabled = lk;
      $('.sh-people').innerHTML = C.local ? `<li class="none">Only you: others can join once the room is on a relay${C.peerFail ? ' or peer to peer' : ''}.</li>` : C.members.map(m => {
        const P = m.id === C.id ? { st: C.follow } : C.pres.get(m.id), s = P && C.stById.get(P.st), bv = m.id === C.id ? BROWSER : (P && P.bv) || '';
        // Follow: a person in a headset, followed from this page (a headset walks); the one followed: Stop following
        const on = C.who === m.id, nm = m.name || 'Someone', fb = m.id === C.id || HOST.session ? '' : on ? '<button class="btn" type="button" data-sh="unfollow">Stop following</button>' :
          m.kind === 'ar' || m.kind === 'vr' ? `<button class="btn primary" type="button" data-sh="who:${esc(m.id)}" title="This page follows whichever station ${esc(nm)} stands at, switching as they walk" aria-label="Follow ${esc(nm)}">Follow</button>` : '';
        return `<li class="${on ? 'on' : ''}"><i style="background:${esc(m.color || '#888')}"></i><b>${esc(nm)}${m.id === C.id ? ' (you)' : ''}</b><span>${
          { ar: 'headset', vr: 'headset (VR)', desktop: 'screen' }[m.kind] || ''}${bv ? ' (Quest Browser ' + esc(bv) + ')' : ''}${m.kind && m.kind !== 'desktop' ? (m.here ? ', in the room' : ', elsewhere') : ''}${m.host ? ', hosts the room' : ''}${s ? ' · at ' + esc(meta(s.story).title) : ''}${on ? ' · followed here' : ''}</span>${fb}</li>`;
      }).join('');
      drawMap();
    }
    $('.sh-colors').innerHTML = COLORS.map(c => `<button type="button" data-sh="color:${c}" style="background:${c}" aria-label="Colour ${c}" aria-pressed="${c === C.color}"></button>`).join('');
  }
  // the room from above: stations (dots in their colours, a line to where the content floats, titles), people
  // (arrows where they stand and look, their rays); north (forward, -z) is up
  const MAP = { tf: null, drag: null };
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
    // while a station is dragged the map keeps its scale (it would grow and shrink under the pointer)
    MAP.tf = MAP.drag ? MAP.drag.tf : { X: x => W / 2 + (x - cx) * sc, Y: z => H / 2 + (z - cz) * sc, ix: px => cx + (px - W / 2) / sc, iz: py => cz + (py - H / 2) / sc };
    const { X, Y } = MAP.tf, D = MAP.drag, st = C.st.map(s => (D && D.pose && D.id === s.id ? Object.assign({}, s, D.pose) : s));
    // a metre grid
    ctx.strokeStyle = 'rgba(149,166,189,0.10)'; ctx.lineWidth = 1;
    for (let gx = Math.ceil(cx - W / 2 / sc); gx <= cx + W / 2 / sc; gx++) { ctx.beginPath(); ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), H); ctx.stroke(); }
    for (let gz = Math.ceil(cz - H / 2 / sc); gz <= cz + H / 2 / sc; gz++) { ctx.beginPath(); ctx.moveTo(0, Y(gz)); ctx.lineTo(W, Y(gz)); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(149,166,189,0.45)'; ctx.beginPath(); ctx.moveTo(X(0) - 6, Y(0)); ctx.lineTo(X(0) + 6, Y(0)); ctx.moveTo(X(0), Y(0) - 6); ctx.lineTo(X(0), Y(0) + 6); ctx.stroke();
    ctx.font = '12px B612, "Segoe UI", Arial, sans-serif'; ctx.textBaseline = 'middle';
    // titles: beside their dot, right or left, else below or above, where they overlap no other title or dot
    const boxes = st.map(s => [X(s.x) - 8, Y(s.z) - 8, 16, 16]), free = b => b[0] >= 2 && b[0] + b[2] <= W - 2 && b[1] >= 2 && b[1] + b[3] <= H - 2 &&
      !boxes.some(o => b[0] < o[0] + o[2] && o[0] < b[0] + b[2] && b[1] < o[1] + o[3] && o[1] < b[1] + b[3]);
    for (const s of st) {
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
  // the station whose dot (to move it) or square (to turn it) is under the pointer
  function mapGrab(px, py) {
    if (!MAP.tf) return null;
    let best = null, bd = 16;
    for (const s of C.st) {
      const [qx, qz] = content(s), d = Math.hypot(MAP.tf.X(s.x) - px, MAP.tf.Y(s.z) - py), q = Math.hypot(MAP.tf.X(qx) - px, MAP.tf.Y(qz) - py);
      if (d < bd) { bd = d; best = { id: s.id, turn: false }; }
      if (q + 4 < bd) { bd = q + 4; best = { id: s.id, turn: true }; }   // a dot wins over a square at the same spot
    }
    return best;
  }
  function mapSend(D, final) {
    const s = C.stById.get(D.id), P = D.pose, t = performance.now();
    if (!s || !P || (!final && t - D.at < 100) || circlesLocked()) return;   // (locked meanwhile: it stays as last sent)
    const v = { story: s.story, x: r3(P.x), z: r3(P.z), yaw: r3(P.yaw) }, k = J(v);
    if (k === D.sent) return;
    D.sent = k; D.at = t;
    publish([['st.' + D.id, v]]);
    if (final) log('station moved', { st: D.id, x: v.x, z: v.z, yaw: v.yaw, on: 'map' });
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
    const peer = C.peer ? '&peer=' + encodeURIComponent(C.peer).replace(/%3A/gi, ':').replace(/%2F/gi, '/') : '';   // (another introduction server, or off)
    return '#s=' + C.code + relay + peer;
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
  // (and, in no room, the network is found again: a laptop that woke elsewhere, a phone that changed networks)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { wake('page'); if (!C.code && C.netAt && performance.now() - C.netAt > 60000) netAgain('page'); } });
  window.addEventListener('online', () => { wake('network'); netAgain('network'); });

  HOST.collab = {
    get id() { return C.id; }, get code() { return C.code; }, get joined() { return !!C.code; }, get status() { return C.status; },
    get relay() { return C.relay; }, get members() { return C.members; }, get name() { return C.name; }, get color() { return C.color; },
    get local() { return C.local; }, kept: () => localRooms(),   // a room on this device (no relay reached); the rooms kept here
    // how the room runs ('relay', 'peer' or 'local'), this page's part in a peer-to-peer room ('host' or 'guest') and the
    // introduction server ('' PeerJS's public one, 'off', or host[:port][/path])
    get via() { return C.via; }, get role() { return (C.ws && C.ws.role) || ''; }, get peer() { return C.peer; }, setPeer: s => setPeer(s, 'typed'),
    stations: () => C.st, station: id => C.stById.get(id) || null, mine: () => C.mine, live: () => liveSt(), following: () => C.follow,
    // a person followed from this page (their member id; '' none): whichever station they stand at, switching as they walk
    followPerson: id => followPerson(id), followingWho: () => C.who,
    val, now, publish: pairs => publish(pairs), fx, setRelay: s => setRelay(s, 'typed'), detect, list: listRooms, create, join,
    leave: () => leave(false, true),   // (on purpose: not joined again by itself until joined again by hand)
    arrange, add, move, remove, design: b => designHere(b), follow: id => choose(id, 'follow'), pick: id => choose(id, 'pick'), unfollow, me: setMe, setHere,
    mapView: () => MAP.tf,   // the room map's room <-> pixel transform (X, Y, ix, iz), once drawn
    // the circles lock (no circle moved, added or removed) and a station's own lock (its scene and panels, at its circle)
    lock: on => setLock(on), get locked() { return circlesLocked(); },
    stationLock: id => stLocked(C.stById.get(id)), setStationLock: (id, on) => setStLock(id, on),
    // whose figures this headset draws: false, the people at its circle (or everyone before any circle); true, everyone
    seeAll: on => { if (on !== undefined) setPeopleAll(on); return peopleAll(); },
    // the room's labels and moving ({ labels, free }; null outside a room), set for everyone there (HOST.xr calls these)
    look, setLook,
    // panels per story (HOST.panels calls the first two): at a station of the story, the station's (null elsewhere), set for
    // everyone at its circle; any station's, read and set by its id (the page's dialog)
    panels: key => panelsAt(key), setPanels, stationPanels: id => stPanels(C.stById.get(id)), setStationPanels: (id, v) => setStPanels(id, v),
    fresh: () => freshAsk(), get gen() { return SG; },   // a fresh shared space (two calls: the first arms it); this page's generation
    ray, press, effect, detach, hash, dialog, people: () => C.pres, log,
    // rooms on this network: this device's network (its id, never the address; '' unknown), the rooms found on it (null:
    // looking), looked for again; whether this room shows there (the room's switch); the room to rejoin by itself and the
    // one offered again; a pretend network (tests: #net=<word>); the page's hash of an address (tests: as the relay's)
    get net() { return C.net; }, nearby: () => C.near, findNear: () => nearFind('api'), get nearOn() { return nearShown(); }, setNear: on => setNear(on),
    rejoinable: () => rejoinable(), offer: () => offer(), netAgain: why => netAgain(why || 'api'), pretendNet: w => pretendNet(w), netHash: a => netHash(netName(a)),
    panelOpen(on) { menuOpen(on, 'api'); }, get menu() { return PNL.open; },   // the headset's menu, open or closed
    overlay: () => OV,   // for tests: the overlay's objects (panel, cards, rings and their icons, people)
    subtitles: { split: s => subSplit(s), state: () => SUB },   // for tests: how a line is cut into captions, and where the strip is
    // a station's icon on its own (tools/icons.html, after HOST.lowpoly()): { g, lean, spin, mesh, see, halo, model: its
    // miniature's key ('' the fallback) }, posed with pose(yaw, lean, t in s)
    icon: key => { const I = makeIcon(key); I.pose = (yaw, lean, t) => poseIcon(I, yaw, lean, t); return I; },
    // a story is about to start (HOST.start): in a headset at its station, it takes the station's place and panel
    starting,
    debug(on) { DEBUG = !!on; put('collabDebug', on ? '1' : null); },
    // links: #s=XYZ joins room XYZ (&relay=wss://host:port when the relay is elsewhere; &peer=host[:port][/path] another
    // introduction server for peer to peer, &peer=off none); #net=<word> pretends a network (tests, no relay); #debug logs to
    // the console. With no room in the link, a room used on this network in the last week is joined again by itself
    boot(hp) {
      if (hp.has('debug')) DEBUG = true;
      if (hp.get('relay')) setRelay(hp.get('relay'), 'link');
      if (hp.has('peer')) setPeer(hp.get('peer'), 'link');
      if (hp.has('net')) pretendNet(hp.get('net'));   // (a pretend network, for tests: #net=<word>, off)
      const code = (hp.get('s') || '').toUpperCase();
      // no room in the link: a room this device used on this network in the last week is joined again by itself
      if (!/^[A-Z]{3}$/.test(code)) { if (localRooms().some(r => Date.now() - r.at < WEEK)) detect().then(() => netAgain('load')); return; }
      log('boot', { code });
      // (no relay known: peer to peer, else the room on this device, as last kept here; it goes to a relay once one is entered)
      detect().then(() => {
        join(code);
        if (!HOST.session && !/OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent)) setTimeout(() => { if (C.code && !C.follow) dialog(true); }, 600);
      });
    },
    internals: () => C,
  };
})();
