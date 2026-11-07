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
// opened by a stick's click or two pinches of the left hand, with the story's panels, Exit, the settings, Sound check
// and the shared room inside).
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
  const FORMAT = 'networks-35';   // the shared state's format (keys, the stories' state()): bump when it changes shape
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
  // A copy of the app that offers a relay of its own (v116): on a host listed here, while no relay is in use, the Shared
  // dialog and the headset menu offer it (homeOffer), and the studio asks it for its scenes (relayFind); its password
  // entered and accepted (there, or where a 401 of its asked for it), this device keeps it and uses that relay from then
  // on, as a relay typed in (homeTry, authSaw); without it rooms run peer to peer, and Forget the password (out of a room)
  // goes back to that. Keyed by the page's host, so never this machine, a LAN or the tests (HOST.collab.homeRelay(url)
  // offers one there). v120 (the owner, 6 November 2026): the main site on GitHub Pages (branch main) offers the relay the
  // owner's Coolify runs from main as well, at main.lab.lbi-netmed.com (--proxy 1 --public --scenes r2 and a password;
  // its --public allows https://stories.lbi-netmed.com). The test place (branch dev, stories.lab.lbi-netmed.com) is
  // served by its own relay and needs no entry; until v120 the table was empty and the main site's rooms peer to peer
  const HOME_RELAY = { 'stories.lbi-netmed.com': 'https://main.lab.lbi-netmed.com' };
  const HOME = { o: null, state: '' };   // o: a test's own offer (null: the table's); state: '', 'checking', 'wrong', 'limit', 'away'
  const homeRelay = () => { if (HOME.o !== null) return HOME.o; try { return HOME_RELAY[location.hostname] || ''; } catch (e) { return ''; } };
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
  const meta = key => KINDS[key] || (HOST.meta ? HOST.meta(key) : HOST.list.find(s => s.key === key)) || (HOST.unknown ? HOST.unknown(key) : undefined);
  // Two kinds of circle that are the shell's own, not stories (v104; the owner, 2 November 2026: "a circle with all stories
  // that looks exactly like the single player story menu", and "a 'back to the lobby' circle where the headsets go back to
  // the lobby"). All stories: st.<id> = { story: 'all' (its cards show) or the story picked there, kind: 'all', sync, x, z,
  // yaw, and for the room's first one arc: true while it is the room's arc, false once it became a circle (v109: arcStep) };
  // Back to the lobby: { story: 'lobby', kind: 'lobby', x, z, yaw }. Never in stories/list.js and never started:
  // their key names their look (title, colour, icon) wherever a station's is taken
  const KINDS = {
    all: { key: 'all', kind: 'all', kick: 'Every story', title: 'All stories', col: '#cfeeff', icon: 'all.stories', desc: 'Every story, chosen here by whoever stands in the circle' },
    lobby: { key: 'lobby', kind: 'lobby', kick: 'The lobby', title: 'Back to the lobby', col: '#9fe5bf', icon: 'all.lobby', desc: 'Walk in to leave your story and see every circle again' },
  };
  const ALL = 'all', LOBBY_ST = 'lobby';
  const lookKey = s => s.kind || s.story;   // (a station's look: its kind's, else its story's)
  // the story a station runs ('' none: an All stories circle showing its cards, the lobby)
  const runs = s => (s && !(s.kind && s.story === s.kind) ? s.story : '');
  // a station's title in lines and lists: "All stories" (with the story picked there), "Back to the lobby", a story's
  // (a studio circle whose state names a scene: "Studio: <scene>", sceneOf below)
  const stTitle = s => (s.kind === ALL ? 'All stories' + (runs(s) ? ': ' + meta(s.story).title : '') : sceneOf(s) ? 'Studio: ' + sceneOf(s) : meta(lookKey(s)).title);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mmss = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const fwd = yaw => [-Math.sin(yaw), -Math.cos(yaw)];   // a yaw's forward on the floor (x, z): yaw 0 faces -z

  // the relay's password: whether one is wanted, and the one being tried (below, "the relay's password"; here, as the log
  // reads it)
  const AUTH = { at: '', base: '', state: '', tryT: '', tryAt: '', t401: 0 };
  // ------------------------------------------------------------------ log --
  const LOG = window.__collabLog = [];
  LOG.n = 0;   // entries are numbered (the relay's copy goes on from the last one sent)
  let DEBUG = get('collabDebug') === '1';
  function log(ev, data) {
    data = data ? secretless(data) : data;   // (never a relay's password: this log goes to the relay with a headset's)
    LOG.push(Object.assign({ t: Math.round(performance.now()), n: ++LOG.n, ev }, data || {}));
    if (LOG.length > 1000) LOG.splice(0, LOG.length - 1000);
    if (DEBUG) console.log('[shared]', ev, data || '');
  }
  // the shell's sound effects (sfx.js, HOST.sfx; on unless turned off): in a headset each comes from where it happens
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
    cur: null, hook: null, ready: false, guard: 0, hush: false, pumpAt: 0,
    // the All stories circles: the live station's story and session as last applied, a page showing its Stories screen for
    // one, and the first headset's circle and a page's arc (autoAll: tests turn both off, with HOST.collab.autoAll(false) or
    // localStorage collabAutoAll = off before the page loads; allpFor: the room it was tried in, allpAt: since when)
    liveSig: '', cardsOpen: false, autoAll: get('collabAutoAll') !== 'off', allpFor: '', allpAt: 0,
    // the room's arc (arcStep): a page's own (arcFor: the room it was made in, arcAt: since when), this page leaving it by
    // hand ('code|id': not followed again by itself) and the live station taken as the arc ('': walked into, or followed)
    arcFor: '', arcAt: 0, arcOff: '', arcd: '',
  };
  // what is shown for a key: our own unacknowledged write, else the room's value
  const val = k => { const p = C.pending.get(k); if (p) return p.v; const e = C.keys.get(k); return e ? e.v : undefined; };
  // a value as echo suppression compares it: a moving thing's (a station, its scene, panel and view: SM_RE) without when it
  // was written and whether it was still held (ts, h: smoothing, below), so the same place written again is no change
  const SM_RE = /^st\.([\w-]{1,32})(?:\.(place|panel|view))?$/;
  const bare = v => { if (!v || typeof v !== 'object' || Array.isArray(v) || !('ts' in v || 'h' in v)) return v; const o = Object.assign({}, v); delete o.ts; delete o.h; return o; };
  const sig = (k, v) => J(SM_RE.test(k) ? bare(v) : v);
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
  const FRESH_TEXT = 'Moved to a fresh shared space. Start AR on one headset first and wait for "Room ready", then the others, one by one.';
  const liveSt = () => (C.live ? C.stById.get(C.live) || null : null);

  // ------------------------------------------------------- the relay's password --
  // A relay may want a password (relay/server.mjs: COLLAB_TOKEN or --token, as asdf10k-collab-backend's; the owner, 3
  // November 2026: "one word ... that i can use and enter on each client if i want it to be able to use the relay, no other
  // way to use it"). Each device enters it once (the page's Shared dialog, or the headset menu's Relay password): kept
  // here per relay origin (localStorage relayTokens = { origin: password }), never in a room's keys, a link, the address or
  // a log. It goes with every call to that relay: Authorization: Bearer on its API, ?token= on its socket and /api/watch,
  // PeerJS's key on its introduction server. A relay that wants one (401, a socket closed 4401) is not unreachable: the
  // room meant for it never goes peer to peer or onto this device instead, nothing is joined by itself, and while it waits
  // the relay is asked at most once a minute (authWait) until a password is given. Accepted once a call with it succeeds.
  // AUTH.state: '' (none wanted), 'need', 'wrong' (the one tried is not it), 'stale' (the one kept here is no longer it),
  // 'checking', 'limit' (too many wrong ones from this network), 'away' (the relay did not answer the check)
  const originOf = u => { try { return new URL(u).origin; } catch (e) { return ''; } };
  const tokens = () => { try { const o = JSON.parse(get('relayTokens') || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } };
  function tokenKeep(o, t) { const all = tokens(); if (t) all[o] = t; else delete all[o]; put('relayTokens', Object.keys(all).length ? JSON.stringify(all) : ''); }
  // the password for a relay's address ('' none): the one being tried, else the one kept for its origin
  const tokenFor = base => { const o = originOf(base); if (!o) return ''; if (AUTH.tryT && AUTH.tryAt === o) return AUTH.tryT; const t = tokens()[o]; return typeof t === 'string' ? t : ''; };
  // the relay at base wants a password this device has not got (the dialog and the menu ask for it)
  const authAsk = () => !!AUTH.state && !!AUTH.at;
  // ... and has said so within the last minute: not asked again meanwhile (each answer would only say it again)
  const authWait = base => !!AUTH.state && AUTH.state !== 'checking' && AUTH.at === originOf(base) && performance.now() - AUTH.t401 < 60000;
  const AUTH_TEXT = 'This relay needs its password.';
  // what a relay answered (status: an HTTP status, 401 also for a socket closed 4401; sent: the password sent, '' none)
  function authSaw(base, status, sent, j) {
    const o = originOf(base);
    if (!o) return;
    if (status === 401) {
      const now = tokenFor(base);
      if (now && sent !== now) return;   // (an answer to a call sent before the password it has now)
      const was = AUTH.at === o ? AUTH.state : '';
      let st = 'need';
      if (sent && AUTH.tryT === sent && AUTH.tryAt === o) { st = 'wrong'; AUTH.tryT = ''; }
      else if (sent && tokens()[o] === sent) { tokenKeep(o, ''); st = 'stale'; }   // (the relay's password changed: entered again)
      else if (was === 'wrong' || was === 'stale' || was === 'limit') st = was;
      Object.assign(AUTH, { at: o, base: was ? AUTH.base || base : base, state: st, t401: performance.now() });
      if (st !== was) { log('relay password', { state: st }); changed(); }
      return;
    }
    if (AUTH.at !== o) return;
    if (status === 429 && j && /failed attempts/.test(j.error || '')) {
      if (AUTH.tryT === sent) AUTH.tryT = '';
      Object.assign(AUTH, { state: 'limit', t401: performance.now() });
      log('relay password', { state: 'limit' }); changed(); return;
    }
    if (status < 200 || status >= 300) return;
    const t = sent && AUTH.tryT === sent && AUTH.tryAt === o ? sent : '';
    if (t) tokenKeep(o, t);   // (accepted: kept for this relay)
    const ho = t ? homeOffer() : '';   // (the relay this page offers, its password given where its 401 asked: used from now on)
    Object.assign(AUTH, { at: '', base: '', state: '', tryT: '', tryAt: '', t401: 0 });
    if (ho && originOf(ho) === o) setRelay(ho, 'offered');
    log('relay password', { state: t ? 'accepted' : 'not needed' });
    if (PNL.page === 'pass') { PNL.page = 'main'; PNL.pass = ''; }
    const f = document.getElementById('shPass');
    if (f) f.value = '';
    if (t && HOST.live && HOST.live.watch) HOST.live.watch();   // (a relay that watches the app's files: followed now)
    setTimeout(authResume, 0);
    changed();
  }
  // a password typed in (the dialog's Use, the menu's keypad): tried on the relay that asked; kept once it is accepted
  function authTry(t) {
    t = String(t || '').trim();
    if (!t || !AUTH.at || AUTH.state === 'checking') return false;
    const base = AUTH.base || AUTH.at, ab = new AbortController(), to = setTimeout(() => ab.abort(), 8000);
    Object.assign(AUTH, { tryT: t, tryAt: AUTH.at, state: 'checking' });
    log('relay password', { state: 'checking' });
    changed();
    fetch(base.replace(/\/+$/, '') + '/api/ping', { cache: 'no-store', headers: { Authorization: 'Bearer ' + t }, signal: ab.signal }).finally(() => clearTimeout(to))
      .then(async r => { let j = null; try { j = await r.json(); } catch (e) { /* not JSON */ } authSaw(base, r.status, t, j); if (AUTH.state === 'checking') { AUTH.state = 'away'; AUTH.tryT = ''; changed(); } },
        () => { if (AUTH.tryT === t) { Object.assign(AUTH, { tryT: '', state: 'away' }); changed(); } });
    return true;
  }
  // the relay this page offers (HOME_RELAY), its address without a trailing slash, while no relay is in use here (none
  // known, none serving the page); '' otherwise
  const homeOffer = () => (!C.relay && !C.served && homeRelay() ? norm(homeRelay()) : '');
  const homeLine = () => ({ wrong: 'That is not the relay\'s password.', limit: 'Too many wrong passwords from this network: wait a minute, then try again.',
    checking: 'Checking...', away: 'The relay did not answer: try again in a moment. Rooms run peer to peer meanwhile.' }[HOME.state] || '');
  // the offered relay's password typed in (the dialog's field, the menu's keypad): tried on its /api/ping; accepted, this
  // device keeps it for that relay and uses the relay from now on (setRelay, kept as a relay typed in is); else it says why
  // and rooms stay peer to peer. A room joined meanwhile stays as it runs (a peer-to-peer room never moves to a relay)
  function homeTry(t) {
    t = String(t || '').trim();
    const base = homeOffer();
    if (!t || !base || HOME.state === 'checking') return false;
    const ab = new AbortController(), to = setTimeout(() => ab.abort(), 8000);
    HOME.state = 'checking';
    log('relay password', { state: 'checking', offered: true });
    changed();
    fetch(base + '/api/ping', { cache: 'no-store', headers: { Authorization: 'Bearer ' + t }, signal: ab.signal }).finally(() => clearTimeout(to))
      .then(async r => {
        let j = null;
        try { j = await r.json(); } catch (e) { /* not JSON */ }
        if (r.ok && j && j.proto) {
          tokenKeep(originOf(base), t);
          HOME.state = '';
          log('relay password', { state: 'accepted', offered: true });
          const f = document.getElementById('shHome');
          if (f) f.value = '';
          if (PNL.page === 'pass') { PNL.page = 'main'; PNL.pass = ''; PNL.home = false; }
          setRelay(base, 'offered');
        } else HOME.state = r.status === 401 ? 'wrong' : r.status === 429 ? 'limit' : 'away';
        changed();
      }, () => { HOME.state = 'away'; changed(); });
    return true;
  }
  // Forget the password (the dialog's relay part): this device asks for it again; for the offered relay, out of a room,
  // it also stops using it (rooms peer to peer again, the offer back)
  function authForget() {
    const o = originOf(C.relay) || AUTH.at;
    if (!o) return false;
    tokenKeep(o, '');
    Object.assign(AUTH, { at: '', base: '', state: '', tryT: '', tryAt: '', t401: 0 });
    log('relay password', { state: 'forgotten' });
    if (!C.code && C.relay && homeRelay() && C.relay === norm(homeRelay()) && !C.served) { C.linked = false; setRelay('', 'forget'); }
    if (!C.code && C.relay) { listRooms(); nearFind('forget'); }
    changed();
    return true;
  }
  // accepted: what waited for it goes on (the room's socket, a room to start, rooms joined again by itself, the lists)
  function authResume() {
    if (C.code && C.want && !C.ws && C.status === 'auth') { C.tries = 0; connect(); }
    else if (C.code && C.local) probe(performance.now(), true);
    if (C.wantCreate && !C.code) { C.wantCreate = false; create(); return; }
    C.wantCreate = false;
    if (!C.code) { netAgain('password'); if (C.listing.dialog || C.listing.menu) { listRooms(); nearFind('password'); } }
    changed();
  }
  // what is said about it (the dialog and the menu)
  const authLine = () => ({ need: 'Whoever runs the relay has it. This device keeps it for this relay, so it is entered once.',
    wrong: 'That is not this relay\'s password.', stale: 'The password this device kept is no longer this relay\'s: enter the new one.',
    limit: 'Too many wrong passwords from this network: wait a minute, then try again.', checking: 'Checking...',
    away: 'The relay did not answer: try again in a moment.' }[AUTH.state] || '');
  // never a password in a log line (the passwords known here, ?token= and key= in a URL, a Bearer header)
  function secretless(data) {
    const known = Object.values(tokens()).concat(AUTH.tryT).filter(t => typeof t === 'string' && t.length >= 3);
    const one = v => {
      if (typeof v !== 'string') return v;
      v = v.replace(/([?&](?:token|key)=)[^&#\s"']*/gi, '$1***').replace(/(Bearer\s+)\S+/gi, '$1***');
      for (const t of known) if (v.includes(t)) v = v.split(t).join('***');
      return v;
    };
    if (typeof data !== 'object' || Array.isArray(data)) return data;
    let out = null;
    for (const k in data) {
      const v = data[k];
      if (typeof v === 'string') { const w = one(v); if (w !== v) (out = out || Object.assign({}, data))[k] = w; }
      else if (v && typeof v === 'object' && !Array.isArray(v)) for (const k2 in v) if (typeof v[k2] === 'string' && one(v[k2]) !== v[k2]) { out = out || Object.assign({}, data); out[k] = Object.assign({}, v, { [k2]: one(v[k2]) }); }
    }
    return out || data;
  }

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
    if (AUTH.at && AUTH.at !== originOf(s)) Object.assign(AUTH, { at: '', base: '', state: '', tryT: '', tryAt: '', t401: 0 });   // (another relay: asked afresh)
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
    // (a relay that wants a password answers 401 with its own words: it serves the page, and asks for it)
    const base = appRoot(), t = tokenFor(base);
    C.detecting = fetch(base + 'api/ping', { cache: 'no-store', headers: t ? { Authorization: 'Bearer ' + t } : {} })
      // (and one holding this address back for a minute, 429 with its own JSON: still the relay that serves the page, so a
      // room started here waits for it rather than going peer to peer, which would split it)
      .then(async r => { const j = await r.json().catch(() => null); return r.ok ? j : r.status === 401 && j && j.error === 'missing or wrong token' ? { proto: PROTO, auth: true } :
        r.status === 429 && j && typeof j.error === 'string' ? { proto: PROTO, limited: true } : null; })
      .catch(() => null).then(j => {
      C.served = !!(j && j.proto);
      if (C.served && !C.linked) setRelay(base, 'served');
      if (j && !j.limited) authSaw(base, j.auth ? 401 : 200, t);
      log('served', { served: C.served, password: !!(j && j.auth), limited: !!(j && j.limited) });
      changed();
      return C.served;
    });
    return C.detecting;
  }
  // The studio's relay (stories/studio.js: its scenes, files and saved layouts come from the relay's --scenes): the relay
  // this page knows, else the page's own server when it is a relay; { base: its address without a trailing slash, token:
  // its password ('' none) }, or null when no relay is known or found. A page the relay serves may not know it yet: asked
  // first (5 s at most); a page that found none asks again next time (a relay started since)
  async function relayFind() {
    if (!C.linked && C.served !== true) {
      if (C.served === false && !C.relay) C.detecting = null;
      await Promise.race([detect(), new Promise(r => setTimeout(r, 5000))]);
    }
    const base = C.relay ? norm(C.relay) : homeOffer();   // (the relay this page offers: a 401 there asks for its password)
    return base ? { base, token: tokenFor(base) } : null;
  }
  // what a call to that relay answered (the studio's scenes and their files: they want the password when the API does), so
  // a 401 brings up the shell's own prompts (the Shared dialog's field, the menu's Relay password row), and an answer
  // with it accepted keeps it; sent: the password the call carried ('' none); j: its JSON, when it had any
  function relaySaw(base, status, sent, j) {
    status = +status;
    if (!base || !Number.isFinite(status)) return;
    authSaw(norm(base), status, typeof sent === 'string' ? sent : '', j || null);
  }
  const mixed = () => (location.protocol === 'https:' && /^http:/.test(C.relay) && !/^http:\/\/(localhost|127\.)/.test(C.relay)
    ? ' This page is on https, so the relay must be too (wss://).' : '');
  async function api(path, body, ms) {
    const base = C.relay;
    if (authWait(base)) return { ok: false, status: 401, j: null, held: true };   // (it wants a password not given yet)
    // (an address nobody answers at can take half a minute to fail: given up after 8 s)
    const ab = new AbortController(), to = setTimeout(() => ab.abort(), ms || 8000), t = tokenFor(base), auth = t ? { Authorization: 'Bearer ' + t } : {};
    const r = await fetch(base + '/api/' + path, body === undefined ? { cache: 'no-store', headers: auth, signal: ab.signal } :
      { method: 'POST', cache: 'no-store', headers: Object.assign({ 'Content-Type': 'application/json' }, auth), body: JSON.stringify(body), signal: ab.signal }).finally(() => clearTimeout(to));
    let j = null;
    try { j = await r.json(); } catch (e) { /* not JSON */ }
    authSaw(base, r.status, t, j);
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
      C.roomsErr = r.ok ? '' : r.status === 401 ? AUTH_TEXT : 'The relay at ' + host() + ' answered ' + r.status + '.';
      changed(); return C.rooms;
    }, () => { C.rooms = []; C.roomsErr = unreachable(); changed(); return null; });
  }
  const peopleIn = r => (r.members ? `${r.members} ${r.members === 1 ? 'person' : 'people'}${r.names && r.names.length ? ': ' + r.names.join(', ') : ''}` : 'empty');
  // a room on this network: who started it (the relay: the first one in it; peer to peer: its host), people, stations
  const nearLine = r => [r.name ? (C.relay ? 'with ' : 'hosted by ') + r.name : '', r.members ? `${r.members} ${r.members === 1 ? 'person' : 'people'}` : 'empty',
    r.stations ? `${r.stations} station${r.stations === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
  // no room on this network to show: why
  function nearNone() {
    if (C.relay && authAsk()) return AUTH_TEXT;
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
    if (r.status === 401) { C.wantCreate = true; log('create: the relay wants its password'); changed(); return; }   // (started once it is given)
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
      mine: '', live: '', follow: '', zone: '', cand: '', refill: null, xb: null, rm: null, hereSet: null, who: '', whoSt: '', whoGone: 0, whoLeft: '', liveSig: '', allpAt: 0, arcOff: '' });   // (arcOff: the arc left by hand, for this visit only)
    C.cardsOpen = false;   // (the page's Stories screen an All stories circle opened stays: in no room it is the landing page)
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
      if (peerBase() && authWait(peerBase())) { C.status = 'auth'; changed(); return; }   // (its introduction server wants a password)
      C.peerTok = peerBase() ? tokenFor(peerBase()) : '';
      ws = new PeerSocket(C.code, { id: C.id, create: C.peerNew, wait: C.peerWait, retake: C.peerRetake, take: C.welcomed ? takeCopy : null });
      C.peerWait = C.peerRetake = 0;
    } else {
      // a relay that wants a password: the room waits for it (never peer to peer or on this device: it is the relay's)
      if (authWait(C.relay)) { C.status = 'auth'; changed(); return; }
      const t = C.wsTok = tokenFor(C.relay);
      try { ws = new WebSocket(C.relay.replace(/^http/, 'ws') + '/api/ws?room=' + C.code + '&id=' + C.id + '&proto=' + PROTO + (t ? '&token=' + encodeURIComponent(t) : '')); } catch (e) {
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
    // the relay (or its introduction server) wants its password: asked for, and the room waits (no peer to peer, no room on
    // this device: it is the relay's), until it is given (authResume)
    if (code === 4401) {
      clearTimeout(C.openTimer);
      const peer = C.via === 'peer';
      authSaw(peer ? peerBase() : C.relay, 401, peer ? C.peerTok : C.wsTok);
      C.status = 'auth';
      if (!HOST.session && !C.welcomed) dialog(true);
      changed(); return;
    }
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
    // a relay's limits (4429, as asdf10k-collab-backend's; 4029 from a relay of v109: --public): too many wrong passwords,
    // unknown codes or new rooms from this network in a minute, too many sockets from it: the relay again a little later,
    // never peer to peer (the room would split in two)
    if ((code === 4029 || code === 4429) && (C.via === 'relay' || C.via === 'peer')) {
      C.note = reason === 'busy' ? 'Too many devices on this network are connected to the relay: trying again in a moment.' :
        'The relay is holding this network back for a minute (too many wrong passwords or room codes tried): trying again in a moment.';
      log('relay limit', { reason });
      changed(); later(); return;
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
    if (C.via === 'relay' && C.wsTok) authSaw(C.relay, 200, C.wsTok);
    else if (C.via === 'peer' && C.peerTok) authSaw(peerBase(), 200, C.peerTok);
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
    for (const [k, e] of C.keys) C.synced.set(k, sig(k, e.v));
    BUF.clear();   // (others' moves start again from what comes next)
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
      const s = sig(k, v);
      if (!force && C.synced.get(k) === s && !C.pending.has(k)) continue;   // echo suppression by value
      if (v === null) C.synced.delete(k); else C.synced.set(k, s);
      out.push([k, v]);
    }
    if (!out.length) return false;
    const cid = ++C.cid;
    for (const [k, v] of out) C.pending.set(k, { cid, v });
    const sent = send({ t: 'set', batch: out, cid });
    if (!out.every(p => p[1] && p[1].h === 1)) log('publish', { cid, keys: out.map(p => p[0]), sent });   // (a move still held, 15 a second: not logged)
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
        if (p.cid === m.cid && J(p.v) === J(v)) { C.pending.delete(k); const L = sesSt(); if (L && k === kX(L.id)) C.xb = { id: L.id, v }; }
        continue;
      }
      // our own later write is on its way: it wins everywhere. Not for an explore state: that merges (stateApply),
      // or the other person's change to another control would be lost
      if (p && !X_RE.test(k)) { log('kept', { k, seq: m.seq, by: m.by }); continue; }
      if (!p) { if (v === null) C.synced.delete(k); else C.synced.set(k, sig(k, v)); }
      if (!me) smoothIn(k, v);   // (someone else's move: its samples, drawn smoothly)
      keys.push(k);
    }
    if (!(m.batch || []).every(p => p && p[1] && p[1].h === 1)) log('recv', { seq: m.seq, by: m.by, keys: (m.batch || []).map(p => p[0]) });
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
      if (e) C.synced.set(k, sig(k, e.v)); else C.synced.delete(k);
      back.push(k);
    }
    if (back.length) roomChanged(back, false, true);   // shown as the room has them (no merge: ours was refused)
  }
  // a change of the room's keys (null: all of them), applied in order: stations, clock, explore state, panel, frame
  function roomChanged(keys, local, plain) {
    const all = !keys, has = re => all || keys.some(k => re.test(k));
    if (has(/^st\.[\w-]+$/)) stationsChanged();
    const L = sesSt();
    if (!local && L && C.ready && L.story === HOST.curKey) {
      // (not while our own clock write waits for its turn: it follows, and wins as an unacknowledged write would)
      if ((all || keys.includes(kPlay(L.id))) && !C.clockT) clockApply(true);
      if (all || keys.includes(kX(L.id))) stateApply(!all && !plain);
    }
    if (!local && has(/^r[fs]\./)) R.recAt = 0;   // a frame published for a shared space, or one found split: checked on the next frame
    if (has(/^sg$/)) spaceMove();
    if (has(/^look$/)) { const L = look(); if (L && HOST.xr && HOST.xr.keep) HOST.xr.keep(L); }   // (kept after leaving the room)
    // (a move still held, 15 a second, changes nothing the dialog says: the room map follows it from the pump)
    if (all || !keys.every(k => { const v = SM_RE.test(k) && val(k); return v && v.h === 1; })) changed();
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
  // the introduction server's origin ('' PeerJS's public one): a relay's own, at /peerjs, takes the relay's password as
  // PeerJS's key (its default, peerjs, is refused while the relay has one)
  const peerBase = () => { const o = peerServer().opts; return o.host ? (o.secure ? 'https://' : 'http://') + o.host + ':' + o.port : ''; };
  const peerKey = () => (peerBase() && tokenFor(peerBase())) || '';
  const peerOpts = () => Object.assign({}, peerServer().opts, peerKey() ? { key: peerKey() } : {}, { config: { iceServers: ICE }, debug: 0 });
  // does the introduction server answer? (a room on this device asks before it goes peer to peer again)
  function peerUp() {
    const o = Object.assign({ host: '0.peerjs.com', port: 443, path: '/', secure: true }, peerServer().opts), ab = new AbortController(), to = setTimeout(() => ab.abort(), 5000);
    const url = (o.secure ? 'https://' : 'http://') + o.host + ':' + o.port + o.path.replace(/\/?$/, '/') + encodeURIComponent(peerKey() || 'peerjs') + '/id?ts=' + Date.now();
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
      if (t === 'invalid-key') return this.fail(4401, 'password');   // (an introduction server that wants the relay's password)
      // (the relay's introduction server holding this address back for a minute: its limit, as on the relay's own socket)
      if (t === 'server-error' && /too many failed attempts/.test((e && e.message) || '')) return this.fail(4429, 'limit');
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
    if (p && p.status === 401) return true;   // (it answered, and wants its password: this room goes there once it is given)
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
        C.unlisted = !!(r && r.ok && r.j && r.j.unlisted);   // (a public relay lists no rooms: joined by code, link or network)
        if (r && r.ok) return r.j && NET_RE.test(r.j.net || '') ? [r.j.net, 'relay'] : ['', ''];   // (an older relay does not say)
        if (r && r.status === 401) return ['', ''];   // (it wants its password: asked again once it is given, authResume)
      }
      C.unlisted = false;
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
      if (HOST.session) notice('Back in room ' + r.code, 'This headset was in it on this network, so it joined it again. To leave it, open the menu (' + menuWhere() + '): Leave is under Circles.', 9000);
      else toast(r.code);
    };
    if (!C.relay) { go(); return true; }
    C.rejoining = true;
    api('rooms/' + r.code, undefined, 5000).then(x => {
      // (a public relay holding this network back: the room's id cannot be checked, so not joined now: again in a minute)
      if (x.status === 429) { C.rejoining = false; log('rejoin: relay busy', { code: r.code }); setTimeout(() => rejoin('again'), 60000); return; }
      if (x.status === 401) { C.rejoining = false; log('rejoin: the relay wants its password', { code: r.code }); return; }   // (again once it is given: authResume)
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
        if (!r.ok || !r.j || !Array.isArray(r.j.rooms)) { C.near = []; C.nearErr = r.status === 404 ? 'This relay does not list rooms by network (an older relay).' : r.status === 401 ? AUTH_TEXT : 'The relay answered ' + r.status + '.'; changed(); return; }
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
  // the page's notice after a rejoin (a headset in a session gets the shell's notice instead): Leave at hand. Shown and
  // hidden by its display (its own display: flex outranks the hidden attribute, so that alone left it up for good)
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
      '<button class="btn" type="button" data-toast="open">Shared</button><button class="btn" type="button" data-toast="leave">Leave</button>' +
      '<button class="btn" type="button" data-toast="close" aria-label="Close" title="Close">\u00d7</button>';
    TOAST.el.hidden = false; TOAST.el.style.display = 'flex';
    log('notice', { title: 'Back in room' });
    sfx('notice');
    clearTimeout(TOAST.timer); TOAST.timer = setTimeout(toastOff, 20000);
  }
  function toastOff() { clearTimeout(TOAST.timer); if (TOAST.el) { TOAST.el.hidden = true; TOAST.el.style.display = 'none'; } }

  // ------------------------------------------------ the menu shown to your circle --
  // My menu: my circle (the menu's Settings tab; this headset's own, kept as xrMenuShare, off by default, never the room's;
  // the owner, 6 November 2026: "the menu window of each person should optionally be visible for everyone so that i can
  // explain it easier", then "menu shown to others in my circle"). While it is on, the menu open and this headset lined up
  // at a live station in a shared room, the other headsets at that station see a picture of the menu where it floats here.
  // It goes to them as quiet effects on the station's channel (e.<station>, type MSH.type: the shell's own, never passed
  // to the story): the menu's pose in room coordinates (its top edge's middle, which it hangs from, its turn, its width and
  // height), at most every MSH.poseMs while it moves, once more as it comes to rest and every MSH.beat while still; a
  // picture of what it shows (the drawn part of its canvas, the Story tab's copies of the story's panels drawn in) as a
  // JPEG, made smaller and coarser step by step (MSH.steps) until it fits MSH.max (the relay refuses effects over 64 KB),
  // only when what it shows changed and at most every MSH.picMs, or when only the light of the button pointed at changed
  // at most every MSH.hovMs (a ray moving over the buttons redraws the menu all the time, and the relay sends every
  // effect to everyone in the room: about 45 KB each); and 'closed' once when the menu closes, the setting goes off, the
  // station changes or the session ends. A headset at the station that lacks the picture a pose names asks for it
  // ('want', at most every MSH.ask) and gets the last one made without its being made again (also when a newer one did
  // not fit). Only a headset at that station keeps a picture (the others ask once they come). Drawn by drawMenus; pages
  // draw nothing (the Shared dialog's people list says who shows their menu)
  const MSH = { type: '@menu', on: get('xrMenuShare') === 'circle', max: 48 * 1024 - 1024, picMs: 1500, hovMs: 4000, poseMs: 200, beat: 1000, gone: 3000, ask: 1500, order: 49.5,
    steps: [[540, 0.75], [480, 0.66], [420, 0.58], [360, 0.5], [300, 0.42], [240, 0.35], [180, 0.3]],
    st: '', sig: '', full: '', picAt: 0, busy: false, n: 0, img: '', step: 0, want: false, poseAt: 0, last: null, moving: false, master: null, cv: null, failed: '',
    sent: { pics: 0, poses: 0, closed: 0, most: 0, bytes: 0, at: [], ns: [], cv: [] }, got: 0 };   // (got: pictures taken from others, for tests; at, ns and cv: when each picture went, its number, a want's answer an old one, and the menu's cver it shows)
  const MENUS = new Map();   // others' menus shown to their circle, by member: { code, st, at, n, nWant, img, dec, buf, pose, o, ... }
  const menuShareOn = () => MSH.on;
  function setMenuShare(on) { MSH.on = !!on; put('xrMenuShare', MSH.on ? 'circle' : null); log('menu share', { on: MSH.on }); changed(); }
  // where this headset's menu goes: its live station's id, or '' (off, closed, no room, not lined up, no station; and while
  // the relay's password page is open, which shows the password as it is typed: closed for the others meanwhile)
  function menuShareTo() {
    const L = liveSt();
    return MSH.on && PNL.open && PNL.page !== 'pass' && OV.panelG && OV.panelG.visible && HOST.session && C.code && R.aligned && L && !away() ? L.id : '';
  }
  function menuOut(st, data) {
    const v = { type: MSH.type, data, q: 1 }, n = J(v).length;
    MSH.sent.most = Math.max(MSH.sent.most, n); MSH.sent.bytes += n;
    return fx('e.' + st, v);
  }
  // the menu's pose in room coordinates: its top edge's middle, its turn, its width and height (m)
  function menuPose() {
    const G = OV.panelG;
    _v.copy(G.position).applyMatrix4(R.mi);
    _q.setFromRotationMatrix(_m.extractRotation(R.mi)).multiply(G.quaternion);
    return { p: [r3(_v.x), r3(_v.y), r3(_v.z)], q: qOut([_q.x, _q.y, _q.z, _q.w]), w: r3(OV.panel.mw * G.scale.x), h: r3(menuH()) };
  }
  // what the menu shows now: its canvas as drawn (cver: the light of what is pointed at aside, drawPanel), the part
  // shown, and the Story tab's copies of the story's panels
  function menuSig() {
    const ms = Object.values(OV.mirror).map(m => (m.visible && m.material.map ? m.material.map.uuid + ':' + m.material.map.version : ''));
    return (OV.panel.cver || 0) + '|' + OV.panel.vis + '|' + ms.join('|');
  }
  // each frame (the shell's tick, after the overlay is drawn, so the menu stands where it shows): the pose, the picture,
  // or 'closed'
  function menuShareStep(t) {
    const to = menuShareTo();
    if (!C.code) { MSH.st = ''; MSH.last = null; }
    if (MSH.st && MSH.st !== to) menuShareEnd(!MSH.on ? 'off' : !PNL.open ? 'closed' : PNL.page === 'pass' ? 'password' : 'station');
    if (!to) return;
    if (!MSH.st) { MSH.st = to; MSH.want = !!MSH.img; MSH.poseAt = 0; MSH.last = null; MSH.moving = false; log('menu share', { to }); }
    // the picture: what it shows changed, at most every picMs, or only what is lit where a ray points, at most every
    // hovMs (full: as drawn, with that light); or someone at the station lacks it
    const sig = menuSig(), full = sig + '|' + OV.panel.tex.version;
    if (!MSH.busy && t - MSH.picAt >= MSH.picMs) {
      const due = sig !== MSH.sig || (full !== MSH.full && t - MSH.picAt >= MSH.hovMs);
      if (due && full !== MSH.failed) {
        menuPicture().then(P => {
          if (!P) { MSH.failed = full; return; }
          // (the same picture as the last one: nothing goes out. What the menu draws from, people walking between
          // circles among it, changes more often than what a tab shows, and each picture goes to everyone in the room)
          if (P === MSH.img) { MSH.sig = sig; MSH.full = full; MSH.same = (MSH.same || 0) + 1; return; }
          MSH.n++; MSH.img = P; MSH.sig = sig; MSH.full = full;
          if (MSH.st && menuShareTo() === MSH.st) picOut();
        });
        return;
      }
      if (MSH.want && MSH.img) { picOut(); return; }   // (asked for again: the last one made, also when a newer one did not fit)
    }
    // the pose: while it moves at most every poseMs (held), once more as it comes to rest, and now and then while still
    const ps = menuPose(), L = MSH.last;
    const moved = !L || Math.hypot(ps.p[0] - L.p[0], ps.p[1] - L.p[1], ps.p[2] - L.p[2]) > 0.003 || qAng(ps.q, L.q) > 0.005 || Math.abs(ps.h - L.h) > 0.002 || ps.w !== L.w;
    if (moved ? t - MSH.poseAt >= MSH.poseMs : MSH.moving ? t - MSH.poseAt >= MSH.poseMs : t - MSH.poseAt >= MSH.beat) {
      MSH.moving = moved && !!L;
      MSH.last = ps; MSH.poseAt = t; MSH.sent.poses++;
      menuOut(MSH.st, Object.assign({ k: 'pose', n: MSH.n }, ps, { ts: Math.round(now()) }, MSH.moving ? { m: 1 } : {}));
    }
  }
  function picOut() {
    const t = performance.now(), ps = menuPose();
    MSH.picAt = t; MSH.want = false; MSH.last = ps; MSH.poseAt = t; MSH.moving = false;
    const S = MSH.sent;   // (cv: the cver the picture shows, the first field of its menuSig)
    S.pics++; S.at.push(t); S.ns.push(MSH.n); S.cv.push(parseInt(MSH.sig, 10) || 0); if (S.at.length > 40) { S.at.shift(); S.ns.shift(); S.cv.shift(); }
    menuOut(MSH.st, Object.assign({ k: 'pic', n: MSH.n, img: MSH.img }, ps, { ts: Math.round(now()) }));
  }
  // 'closed' to the station it went to (the menu closed, the setting off, another station, the session's end)
  function menuShareEnd(why) {
    if (!MSH.st) return;
    if (C.code) menuOut(MSH.st, { k: 'closed' });
    MSH.sent.closed++;
    log('menu share', { closed: MSH.st, why });
    MSH.st = ''; MSH.last = null; MSH.moving = false; MSH.want = false;
  }
  // the picture: the menu's canvas (the part shown) with the story's panels drawn in where the Story tab shows them, onto a
  // dark ground (a JPEG has no see-through corners: the others cut them round), then a JPEG at each step until one fits
  // (the next starts at the step that fitted, a step finer when it came well under). A data URL, or '' when none fits
  const jpeg = (cv, q) => new Promise(res => { try { cv.toBlob(b => res(b), 'image/jpeg', q); } catch (e) { res(null); } });
  const dataUrl = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = () => res(''); r.readAsDataURL(b); });
  async function menuPicture() {
    MSH.busy = true;
    try {
      const S = OV.panel, vis = Math.max(1, Math.min(S.h, Math.round(S.vis))), M = MSH.master || (MSH.master = document.createElement('canvas'));
      M.width = S.w; M.height = vis;
      const c = M.getContext('2d'), g = PNL.mirror;
      c.fillStyle = '#080f1c'; c.fillRect(0, 0, S.w, vis);
      c.drawImage(S.cv, 0, 0, S.w, vis, 0, 0, S.w, vis);
      if (g) for (const which of ['main', 'foot']) {
        const m = OV.mirror[which], img = m.visible && m.material.map && m.material.map.image;
        if (!img) continue;
        const h = which === 'main' ? g.hm : g.hf, top = which === 'main' ? g.y0 : g.y0 + g.hm + g.gap;
        try { c.drawImage(img, g.x, top, g.w, h); } catch (e) { /* not drawable */ }
      }
      const cv = MSH.cv || (MSH.cv = document.createElement('canvas'));
      for (let k = Math.min(MSH.step, MSH.steps.length - 1); k < MSH.steps.length; k++) {
        const [W, q] = MSH.steps[k];
        cv.width = W; cv.height = Math.max(1, Math.round(vis * W / S.w));
        const x = cv.getContext('2d');
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        x.drawImage(M, 0, 0, cv.width, cv.height);
        const b = await jpeg(cv, q);
        if (!b) break;
        const len = 23 + 4 * Math.ceil(b.size / 3);   // (its data URL's length: 'data:image/jpeg;base64,' and the bytes)
        if (len > MSH.max) continue;
        const u = await dataUrl(b);
        if (!u.startsWith('data:image/jpeg;base64,') || u.length > MSH.max) break;
        MSH.step = k > 0 && len < MSH.max * 0.45 ? k - 1 : k;
        return u;
      }
      log('menu share', { picture: 'none fits' });
      return '';
    } finally { MSH.busy = false; }
  }
  // someone's menu, as it comes (every page keeps it, for the Shared dialog's people list; only a headset at that station
  // draws it, and only it asks for a picture it lacks)
  const v3 = a => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite) && a.every(x => Math.abs(x) < 1e4);
  function menuIn(st, d, by) {
    if (!by || by === C.id || !d || typeof d !== 'object') return;
    let E = MENUS.get(by);
    // ('closed' for another station than the copy's, or with no copy here: said in the log, so a copy that stays after its
    // closed can be told from one that never heard it)
    if (d.k === 'closed') { if (E && E.st === st) menuDrop(by, 'closed'); else log('menu closed ignored', { by, st, have: E ? E.st : null }); return; }
    if (d.k === 'want') { if (d.to === C.id && MSH.st === st && MSH.img) MSH.want = true; return; }
    if (d.k !== 'pose' && d.k !== 'pic') return;
    if (!v3(d.p) || !validQ(d.q) || !(d.w > 0.05 && d.w < 4) || !(d.h > 0.02 && d.h < 8)) return;
    if (!E) { MENUS.set(by, (E = { code: C.code, st, at: 0, n: 0, nWant: 0, img: '', dec: '', buf: { s: [], seed: false }, pose: null, o: null, asked: 0, pics: 0, bytes: 0 })); changed(); }
    if (E.st !== st || E.code !== C.code) { E.st = st; E.code = C.code; E.buf = { s: [], seed: false }; E.n = 0; E.img = ''; E.dec = ''; E.drawn = false; }   // (another station: anew)
    E.at = performance.now();
    E.pose = { p: d.p.slice(), q: d.q.slice(), w: d.w, h: d.h };
    if (Number.isFinite(d.ts)) bufPush(E.buf, d.ts, E.pose, d.m === 1); else E.buf.s.length = 0;
    if (Number.isInteger(d.n)) E.nWant = d.n;
    // (the picture kept only by a headset at that station, which draws it: drawMenus; one that comes later asks for it)
    const L = liveSt();
    if (d.k === 'pic' && Number.isInteger(d.n) && typeof d.img === 'string' && d.img.startsWith('data:image/jpeg;base64,') && d.img.length <= 64 * 1024 && HOST.session && L && L.id === st) {
      E.n = d.n; E.img = d.img; E.pics++; E.bytes = d.img.length; MSH.got++;
    }
  }
  // (why, in the log: 'closed' as they said, 'quiet' after MSH.gone without a sample, 'room' another room)
  function menuDrop(id, why) {
    const E = MENUS.get(id);
    if (!E) return;
    MENUS.delete(id);
    log('menu gone', { by: id, why: why || '' });
    if (E.o) { E.o.g.parent && E.o.g.parent.remove(E.o.g); E.o.g.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); E.o.tex.dispose(); E.o.tagTex.dispose(); }
    changed();
  }
  // gone MSH.gone after its last sample (a headset taken off, gone from the room), or once the room is another
  function menusExpire(t) {
    for (const [id, E] of MENUS) if (t - E.at > MSH.gone || E.code !== C.code) menuDrop(id, E.code !== C.code ? 'room' : 'quiet');
  }
  // who shows their menu at a station now (the Shared dialog's people list)
  const showsMenu = id => { const E = MENUS.get(id); return !!E && E.code === C.code && performance.now() - E.at <= MSH.gone; };

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
      // (where the head and hands were when it was sent: drawn smoothly from the samples, drawPeople; always moving, so held)
      if (P.head && Number.isFinite(v.ts)) bufPush(P.buf || (P.buf = { s: [], seed: false }), v.ts, { head: P.head, hands: P.hands }, true); else P.buf = null;
      // how it lines up with the room (the room setup guide's lineUp), for the pages' list; an older headset sends none
      // (and one before v109 no ck: this session's check that stood, kept undefined then, so nothing is said about it)
      const lu = v.lu && typeof v.lu === 'object' ? v.lu : null, s8 = s => (typeof s === 'string' ? s.slice(0, 8) : '');
      P.lu = lu ? { k: s8(lu.k), h: s8(lu.h), w: s8(lu.w), c: Number.isFinite(lu.c) ? Math.round(lu.c) : null, ck: typeof lu.ck === 'string' ? lu.ck.slice(0, 2) : undefined } : null;
    } else if (m.k === 'q.frame') { R.asked(m.v, m.by);   // someone's Re-align: the room's frame written into the space again
    } else if (m.k === 'q.check') { checkIn(m.v, m.by);   // someone's Touch the spot: where their room puts the spot
    } else if (m.k.startsWith('e.')) {
      const L = sesSt(), v = m.v || {};   // (the station's session: an All stories circle in sync mode shares its effects)
      if (v.type === MSH.type) { menuIn(m.k.slice(2), v.data, m.by); return; }   // (someone's menu shown to their circle: the shell's)
      if (!v.q) log('effect in', { st: m.k.slice(2), type: v.type, by: m.by });
      if (L && m.k === 'e.' + L.id && C.ready && L.story === HOST.curKey && C.hook && C.hook.effect) {
        try { C.hook.effect(v.type, v.data, m.by); } catch (e) { log('effect failed', { e: e.message }); }   // (by: who sent it, as the relay says)
      }
    }
  }
  // a one-shot effect the story caused here (a falcon sent, crumbs spilled): the others at the station play it too.
  // quiet: one sent often (where the flock is, twice a second), kept out of the log on both sides
  function effect(type, data, quiet) {
    const L = sesSt();
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
      // (the shell's own kinds: the lobby shows only itself; an All stories circle its cards or a story of the list)
      const kd = v.kind === LOBBY_ST || v.story === LOBBY_ST ? LOBBY_ST : v.kind === ALL || v.story === ALL ? ALL : '';
      if (kd === LOBBY_ST ? v.story !== LOBBY_ST : kd === ALL ? v.story !== ALL && KINDS[v.story] : false) continue;
      // (a studio circle made for a scene by Add's scene entries is marked so in its record, sc: never the room's plain one)
      out.push(Object.assign({ id: m[1], story: v.story, x: +v.x || 0, z: +v.z || 0, yaw: +v.yaw || 0 }, kd ? { kind: kd } : {}, kd === ALL ? { sync: v.sync === true, arc: v.arc === true } : {},
        !kd && v.story === STUDIO && v.sc === true ? { sc: true } : {}));
    }
    // (the pages that are not stories after the stories, in their list's order: the design room's, the studio's; then the
    // All stories circles and the lobby)
    const extra = k => { const e = (self.STORY_EXTRA || []).findIndex(x => x && x.key === k); return e < 0 || e > 8 ? 0.9 : e / 10; };
    const order = s => { if (s.kind) return HOST.list.length + (s.kind === ALL ? 1 : 2); const i = HOST.list.findIndex(x => x.key === s.story); return i < 0 ? HOST.list.length + extra(s.story) : i; };
    out.sort((a, b) => order(a) - order(b) || a.id.localeCompare(b.id));
    C.st = out; C.stById = new Map(out.map(s => [s.id, s]));
    // a station that is missing for a moment (a relay restart: the room comes back empty, then refilled) stays
    // chosen here; while it is missing it is simply not live
    for (const f of ['zone', 'cand']) if (C[f] && !C.stById.has(C[f])) C[f] = '';
    // someone gave the live station another story: it changes here too
    const L = liveSt();
    if (L && L.story !== HOST.curKey && (C.mine === L.id || C.follow === L.id)) goTo(L);
    // the live station's story or its session changed with the story already here (an All stories circle given the story
    // on show, or its switch turned): the room's clock and state apply at once, as on arriving
    const S = sesSt(), ls = L ? [L.id, L.story, S.id].join('|') : '';
    if (ls !== C.liveSig) {
      const was = C.liveSig.split('|');
      C.liveSig = ls;
      // (an All stories circle whose linked circle went, was removed or given another story: its own keys go on from where
      // the story is here, so the people at it stay together; each of them may write it, the same values)
      if (L && L.kind === ALL && S.id === L.id && was[0] === L.id && was[1] === L.story && was[2] && was[2] !== L.id && !playOf(L) &&
        C.ready && C.hook && C.hook.APP && HOST.curKey === L.story && (C.mine === L.id || C.follow === L.id)) {
        const A = C.hook.APP, playing = A.mode === 'story' && !!A.playing, pairs = [[kPlay(L.id), { mode: A.mode, t: r3(A.t), playing, at: playing ? Math.round(now()) : 0 }]];
        try { const x = C.hook.state ? C.hook.state() : null; if (x !== undefined && x !== null) pairs.push([kX(L.id), x]); } catch (e) { /* story not ready */ }
        publish(pairs, true);
        log('all stories alone again', { st: L.id, was: was[2] });
      }
      pageCards();
      if (synced(S) && C.ready) { clockApply(true); stateApply(); PL.id = ''; VW.id = ''; }
    }
  }
  // The session a station runs (whose keys hold its clock, explore state, view, scene place, panel, panels and lock, and
  // its effects): the station's own, or for an All stories circle with its switch on (sync: "With the room's circles"),
  // the room's circle of the story picked there (not another All stories circle; the first by id), so the people at both
  // circles see the same moment and what one changes the others see. The people at the All stories circle still stand
  // at its own spot (their rig, the sound zone, their presence's station)
  function sessOf(s) {
    if (!s || s.kind !== ALL || !s.sync || !runs(s)) return s;
    const O = C.st.find(o => !o.kind && o.story === s.story);   // (C.st: by the list's order, then by id)
    return O ? Object.assign({}, s, { id: O.id, at: s.id }) : s;
  }
  const sesSt = () => sessOf(liveSt());
  // a page following an All stories circle: its Stories screen while the circle shows its cards (a pick there is the
  // circle's), closed again once a story is picked
  function pageCards() {
    if (HOST.session) { C.cardsOpen = false; return; }
    const L = liveSt(), on = !!(L && C.follow === L.id && L.kind === ALL && !runs(L));
    if (on && !C.cardsOpen) { C.cardsOpen = true; log('cards', { st: L.id }); HOST.openPicker(); }
    else if (!on && C.cardsOpen) { C.cardsOpen = false; HOST.closePicker(); }
  }
  // the room asks for a story here (HOST.go): remembered, so HOST.start can tell it from a person's own choice
  function goTo(s) {
    if (!runs(s) || HOST.curKey === s.story) return;   // (an All stories circle's cards and the lobby run nothing)
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
      if (L.arc) C.arcOff = C.code + '|' + L.id;   // (the room's arc: not followed again by itself)
      C.follow = ''; C.mine = ''; C.live = ''; C.picked = false; C.liveSig = ''; C.cardsOpen = false;
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
    // ('arc': the room's arc, taken without walking in or following by hand: arcStep)
    const fol = how === 'follow' || how === 'person' || (how === 'arc' && !HOST.session);
    // Back to the lobby: walking into it ends the headset's station (no story: away, the room as before any circle);
    // never a station of its own, so nothing follows it
    if (s.kind === LOBBY_ST) {
      if (how !== 'walk') return;
      log('lobby', { st: id, was: C.live });
      C.mine = ''; C.live = ''; C.picked = false; VW.id = '';
      // the story loaded hears it (the studio forgets what this headset has seen there: its cubes start afresh)
      try { if (HOST.cur && typeof HOST.cur.lobby === 'function') HOST.cur.lobby(); } catch (e) { log('lobby hook failed', { e: e && e.message }); }
      changed();
      return;
    }
    if (how !== 'person' && how !== 'arc') { C.whoLeft = ''; if (C.who) whoStop(how === 'follow' ? 'a station followed by hand' : how); }
    C.mine = id; C.live = id; C.picked = how === 'pick';
    C.arcd = how === 'arc' ? id : '';
    if (how === 'follow') C.arcOff = '';
    VW.id = '';   // (the room's view is taken again on arriving: one turned here while away is not the room's)
    if (fol) C.follow = id;
    log('station', { st: id, story: s.story, how });
    // following from a page shows the station: its Stories screen closes (while it shows, the pump stands still); an All
    // stories circle's cards open it again just below (pageCards: not taken for open already)
    if (fol) { HOST.closePicker(); C.cardsOpen = false; }
    C.liveSig = [s.id, s.story, sesSt().id].join('|');
    pageCards();
    if (runs(s) && HOST.curKey !== s.story) goTo(s);
    else if (C.ready) { clockApply(true); stateApply(); PL.id = ''; }
    changed();
  }
  // A story picked at an All stories circle (its cards, on a headset there or on a page following it; the page's dialog):
  // the circle's pick, for everyone there. Its story, and with its own keys (Own stories, or no circle of that story in
  // the room) its clock from the start, playing, in the same batch (the relay drops the circle's other keys as its story
  // changes), so every headset and page there switches to it from its start, as a story starts in single player. In sync
  // mode with a circle of that story, only its story: it joins that circle's session (never restarts its clock). 'all':
  // back to its cards
  function allPickAt(id, key) {
    const s = C.stById.get(id), cur = s && val('st.' + id);
    if (!C.code || !s || s.kind !== ALL || !cur || (key !== ALL && !HOST.list.some(m => m.key === key))) return false;
    const v = Object.assign({}, bare(cur), { story: key, kind: ALL, sync: s.sync === true }), next = Object.assign({}, s, { story: key });
    delete v.ts; delete v.h;
    const pairs = [['st.' + id, v]];
    if (key !== ALL && sessOf(next).id === id) pairs.push([kPlay(id), { mode: 'story', t: 0, playing: true, at: Math.round(now()) }]);
    log('all stories', { st: id, story: key, sync: v.sync });
    publish(pairs, true);
    changed();
    return true;
  }
  // HOST.start asks first: a person's story at an All stories circle (a card, the page's Stories screen) is its pick; a
  // story the room asked for (goTo), the one it runs already, or no such circle here: false, and HOST.start goes on
  function allPick(key) {
    const L = liveSt();
    // (the room only ever asks for the circle's own story, so L.story === key covers its switches: an older request that
    // never ran, C.going, must not turn a person's pick into this device's alone)
    if (!L || L.kind !== ALL || L.story === key || (C.mine !== L.id && C.follow !== L.id) || !HOST.list.some(m => m.key === key)) return false;
    return allPickAt(L.id, key);
  }
  // the switch (Own stories, or With the room's circles): never refused by either lock. Turned off with a story running in
  // a linked session, the circle's own clock and explore state start where that session is, so the story goes on
  function setAllSync(id, on) {
    const s = C.stById.get(id), cur = s && val('st.' + id);
    if (!C.code || !s || s.kind !== ALL || !cur) return false;
    const v = Object.assign({}, bare(cur), { sync: !!on }), pairs = [['st.' + id, v]], O = sessOf(s);
    delete v.ts; delete v.h;
    if (!on && O.id !== id) {
      const P = playOf(O), x = val(kX(O.id));
      if (P) pairs.push([kPlay(id), { mode: P.mode, t: r3(expected(P)), playing: !!P.playing, at: P.playing ? Math.round(now()) : 0 }]);
      if (x !== undefined && x !== null) pairs.push([kX(id), x]);
      // (and where its scene, panel and view are, its panels and its lock, so nothing jumps as it goes on alone; what the
      // other circle does not have, the circle's own earlier values, goes)
      for (const k of [kPlace, kPanel, kView, kUi]) {
        const w = val(k(O.id)), own = val(k(id));
        if (w !== undefined && w !== null && typeof w === 'object') { const c = Object.assign({}, w, 'story' in w ? { story: s.story } : {}); delete c.ts; delete c.h; pairs.push([k(id), c]); }
        else if (own !== undefined && own !== null) pairs.push([k(id), null]);
      }
    }
    log('all stories sync', { st: id, on: !!on });
    publish(pairs, true);
    changed();
    return true;
  }
  function unfollow() {
    log('unfollow', { st: C.follow, who: C.who });
    if ((C.stById.get(C.follow) || {}).arc) C.arcOff = C.code + '|' + C.follow;   // (the room's arc: not followed again by itself)
    C.follow = ''; C.mine = ''; C.live = ''; C.picked = false; C.who = ''; C.whoLeft = ''; C.liveSig = '';
    if (HOST.cur) pageCards(); else C.cardsOpen = false;   // (no story here yet: the Stories screen stays open, as before)
    changed();
  }
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
    return 'Following ' + name + (at ? ` (at ${stTitle(at)})` : L ? ` (last at ${stTitle(L)}; in no circle now)` : ' (not at a station yet)') +
      (m ? '' : ': not in the room just now');
  }
  // the stories' station: its spot (x, z), facing yaw; the content floats 1.4 m ahead
  const content = s => { const [fx, fz] = fwd(s.yaw); return [s.x + AHEAD * fx, s.z + AHEAD * fz]; };
  // where a station is drawn and placed in a headset: it glides to where the room has it, and the one carried here follows
  // the hand at once. One someone else carries (its writes have ts) moves as they moved it, a moment later (smoothing)
  const SHOWN = new Map();
  const shown = s => SHOWN.get(s.id) || s;
  function easeStations(dt) {
    const k = 1 - Math.exp(-dt * 12);
    for (const id of SHOWN.keys()) if (!C.stById.has(id)) SHOWN.delete(id);
    for (const s of C.st) {
      let E = SHOWN.get(s.id);
      if (!E) { SHOWN.set(s.id, { id: s.id, story: s.story, x: s.x, z: s.z, yaw: s.yaw }); continue; }
      E.story = s.story;
      if (MV.id === s.id) {   // (carried here: someone else's last move must not pull it back once put down)
        BUF.delete('st.' + s.id);
        if (MV.pose) { Object.assign(E, MV.pose); continue; }
      }
      const B = BUF.get('st.' + s.id);
      if (B && B.story === s.story) {
        bufSeed(B, { x: E.x, z: E.z, yaw: E.yaw });
        const v = bufAt(B, MIX.station);
        if (v) { E.x = v.x; E.z = v.z; E.yaw = v.yaw; if (bufDone(B)) BUF.delete('st.' + s.id); continue; }
      }
      let a = (s.yaw - E.yaw) % (2 * Math.PI);
      if (a > Math.PI) a -= 2 * Math.PI; else if (a < -Math.PI) a += 2 * Math.PI;
      if (Math.hypot(s.x - E.x, s.z - E.z) < 0.002 && Math.abs(a) < 0.002) { E.x = s.x; E.z = s.z; E.yaw = s.yaw; continue; }
      E.x += (s.x - E.x) * k; E.z += (s.z - E.z) * k; E.yaw += a * k;
    }
  }

  // ------------------------------------------------- moving a station by hand --
  // In a headset the grip on a station's ring or card picks it up: it swings round you as you point, goes further
  // as you raise the controller and comes nearer as you lower it, turns as you twist your wrist, and goes out to
  // the room 15 times a second while it moves (with ts and h, smoothing), so everybody sees it move; letting go of the
  // grip puts it down. The grip comes from the session itself (controller i is session.inputSources[i] in three.js), so
  // the stories need nothing
  const MV = { id: '', src: null, a: null, pose: null, at: 0, sent: '', moved: false };
  function pulse(src, v, ms) { try { const a = src && src.gamepad && src.gamepad.hapticActuators; if (a && a[0] && a[0].pulse) a[0].pulse(v, ms); } catch (e) { /* no haptics */ } }
  function grabStation(e) {
    if (grabMenu(e)) return;   // (the menu, when the grip is on it)
    const s = R.session;
    if (!s || !C.code || !R.aligned || MV.src || !e || !e.inputSource) return;
    let i = -1;
    try { i = [...s.inputSources].indexOf(e.inputSource); } catch (err) { /* gone */ }
    const h = i >= 0 ? hovOf(i) : null, arc = !h && i >= 0 ? arcHit(i) : null;   // (the room's arc: the grip on its cards, or round them)
    if (!arc && (!h || h.target.kind !== 'station' || !C.stById.has(h.target.id))) return;
    if (refused('grab')) { notice('The circles are locked', 'Unlock them in the menu (' + menuWhere() + '), under Circles, to move the circles.', 3000); pulse(e.inputSource, 0.15, 10); return; }
    Object.assign(MV, { id: arc ? arc.id : h.target.id, src: e.inputSource, a: null, pose: null, at: 0, sent: '', moved: false, t0: performance.now(), off: arc ? arc.off : null });
    log('station grab', { st: MV.id, arc: !!arc });
    pulse(e.inputSource, 0.4, 25);
    { const s = C.stById.get(MV.id); sfx('grab', arc ? roomAt(arc.p.x, arc.p.y, arc.p.z) : roomAt(s.x, 1, s.z)); }
    changed();
  }
  function dropStation(e) {
    if (MG.src && (!e || e.inputSource === MG.src)) menuPut();
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
    if (circlesLocked()) {   // someone locked it meanwhile: it stays where it was last sent (and lands there for the others)
      log('station locked while carried', { st: MV.id });
      const k = 'st.' + MV.id, v = val(k);
      if (v && v.h === 1) publish([[k, Object.assign(bare(v), { ts: Math.round(now()) })]], true);
      Object.assign(MV, { id: '', src: null, a: null, pose: null }); changed(); return;
    }
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
    if (!A) {   // the first frame: where the station is (the point held: the arc's), seen from the hand
      const [ox, oz] = offAt(s.yaw), dx = s.x + ox - o[0], dz = s.z + oz - o[2], d0 = Math.hypot(dx, dz);
      MV.a = { phi, phi1: phi, pitch, roll, twist: 0, d: Math.max(0.05, d0), da: d0 > 0.05 ? Math.atan2(-dx, -dz) - phi : 0, yaw: s.yaw - phi };
      MV.pose = { x: s.x, z: s.z, yaw: s.yaw };
      return;
    }
    A.phi1 = phi;
    if (roll !== null) { if (A.roll !== null) A.twist += turnTo(roll - A.roll); A.roll = roll; }   // (a twist counts from the first one known)
    const d = Math.min(12, Math.max(Math.min(0.3, A.d), A.d * Math.exp(2 * (pitch - A.pitch)))), al = phi + A.da, yaw = turnTo(phi + A.yaw - A.twist), [ox, oz] = offAt(yaw);
    MV.pose = { x: o[0] - d * Math.sin(al) - ox, z: o[2] - d * Math.cos(al) - oz, yaw };
    if (t - MV.at >= SMOOTH.SEND) sendStation(false, t);
  }
  // the point held from the spot, along the floor, for a station facing yaw (the arc's cards: MV.off, in its frame; a ring: none)
  const offAt = yaw => { const o = MV.off; if (!o) return [0, 0]; const c = Math.cos(yaw), s = Math.sin(yaw); return [o[0] * c + o[1] * s, -o[0] * s + o[1] * c]; };
  // held: out while it moves, and once more when it comes to rest (so the others see it stop there rather than carry on);
  // let go: once more without h, where it lands (always after a write that had h)
  function sendStation(final, t) {
    const s = C.stById.get(MV.id), P = MV.pose;
    if (!s || !P) return;
    const v = stVal(s, P), k = J(v), moved = k !== MV.sent;
    if (final ? !MV.sent && k === J(stVal(s, s)) : !moved && !MV.moved) return;
    MV.moved = !final && moved; MV.sent = k; MV.at = t || performance.now();
    v.ts = Math.round(now());
    if (!final) v.h = 1;
    publish([['st.' + MV.id, v]], true);
    if (final) log('station moved', { st: MV.id, x: v.x, z: v.z, yaw: v.yaw });
  }
  // a station's value at a pose: its story and, for the shell's own kinds, its kind (and an All stories circle's switch and
  // whether it is the room's arc), as the room has them now (a circle carried while someone picks a story there must not
  // write the old pick back: the relay would take it as another story and drop the pick's clock; an arc carried while
  // someone adds a circle must not turn back into an arc)
  const stVal = (s, P) => {
    const cur = s && s.id ? val('st.' + s.id) : null, b = cur && typeof cur === 'object' && typeof cur.story === 'string' ? cur : s;
    return Object.assign({ story: b.story }, s.kind ? { kind: s.kind } : {}, s.kind === ALL ? { sync: b.sync === true } : {}, s.kind === ALL && typeof b.arc === 'boolean' ? { arc: b.arc } : {},
      !s.kind && b.story === STUDIO && b.sc === true ? { sc: true } : {}, { x: r3(P.x), z: r3(P.z), yaw: r3(P.yaw) });
  };
  // a new station's clock: a story at its start, paused; a page that is not a story (the design room, the studio: no
  // chapters) in explore mode, at its table or its scene
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
  // the headsets' four settings (HOST.xr: the scenes' small labels and the cards (story panels, station cards, name tags),
  // each on top, in 3D (turned to you, in the scene) or hidden; free moving on or off; subtitles on or off) and the two
  // sound switches for pages and headsets alike (sound effects and narration on or off) are the room's in a room, for
  // everyone in it (key look: { labels, cards, free, subs, sfx, voice, by, at }; a room without it: labels on top, cards in
  // 3D, no subtitles; FORMAT networks-27 for cards, sfx and voice), set from a headset's menu or the page's dialog, and
  // never refused by either lock. A sound switch the room never wrote stays each device's own (HOST.xr.mine), so a device
  // that turned it off keeps it off. Null outside a room (the device's own). Beside them the room's circles: asked first
  // (ask true, the default since v120, FORMAT networks-35: walking in does nothing, a press on a circle asks) or walked into
  // (ask false; v118, FORMAT networks-33, askFirst below), a setting of the room's only (outside a room there are no
  // circles). Tests that walk into circles start as before (localStorage collabAskDefault = walk before the page loads,
  // as collabAutoAll; HOST.collab.askDefault(on)): a room that never wrote ask then walks in
  const LOOKS = ['face', 'fixed', 'hidden'], LOOK0 = { labels: 'face', cards: 'fixed', free: true, subs: false, sfx: true, voice: true, ask: get('collabAskDefault') !== 'walk' };
  const SOUNDS = ['sfx', 'voice'], mine = k => (HOST.xr && HOST.xr.mine ? HOST.xr.mine(k) !== false : LOOK0[k]);
  function look() {
    if (!C.code || !C.welcomed) return null;
    const v = val('look'), b = k => (v && typeof v[k] === 'boolean' ? v[k] : SOUNDS.includes(k) ? mine(k) : LOOK0[k]), m = k => (v && LOOKS.includes(v[k]) ? v[k] : LOOK0[k]);
    return { labels: m('labels'), cards: m('cards'), free: b('free'), subs: b('subs'), sfx: b('sfx'), voice: b('voice'), ask: b('ask') };
  }
  const freeNow = () => (HOST.xr && HOST.xr.free ? HOST.xr.free() : true);
  function setLook(o) {
    const L = look(), was = val('look');
    if (!L) return false;
    const bo = k => (typeof o[k] === 'boolean' ? o[k] : L[k]), mo = k => (LOOKS.includes(o[k]) ? o[k] : L[k]);
    const v = { labels: mo('labels'), cards: mo('cards'), free: bo('free'), subs: bo('subs'), sfx: bo('sfx'), voice: bo('voice'), ask: bo('ask') };
    // (a sound switch neither set now nor written before stays out: another setting must not hand this device's own to all)
    for (const k of SOUNDS) if (typeof o[k] !== 'boolean' && !(was && typeof was[k] === 'boolean')) delete v[k];
    const pairs = [['look', Object.assign({}, v, { by: C.id, at: Math.round(now()) })]];
    // free moving off: every station's scene and panel stand as without it (no turn, the panel upright at its yaw)
    if (L.free && !v.free) {
      for (const k of new Set([...C.keys.keys(), ...C.pending.keys()])) {
        const x = /^st\.[\w-]+\.(place|panel)$/.test(k) && val(k);
        if (x && typeof x === 'object' && x.q !== undefined) { const y = Object.assign({}, bare(x)); delete y.q; pairs.push([k, y]); }   // (a plain write: no ts, no h)
      }
    }
    publish(pairs);
    log('look', v);
    changed();
    return true;
  }
  // The circles: asked first (the default since v120; the owner, 6 November 2026: "Circles should be ask first by default
  // for everyone") or walked into (until v120 the default; v118, the owner, 5 November 2026: "a switch for the circles so
  // that they are only accessible by clicking a circle's card or the icon, then a dialogue asks if you want to go into
  // that story, works better in tight rooms"): the room's (look's ask, for everyone in it, set by anyone from a headset's
  // menu or a page's dialog, never refused by either lock; a room that never wrote it asks first). On, walking into a
  // circle does nothing (zoneStep), and the trigger or a pinch on another circle's card, ring or icon asks in a small
  // panel in front of you (ASK): Go in does what walking in does, the story staying at its circle. Pages are as ever
  const askFirst = () => { const L = look(); return !!(L && L.ask); };
  function setAsk(on) { if (!setLook({ ask: !!on })) return false; log('circles ask', { on: !!on }); return true; }
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
  // Recenter at a station (the story panel's button and the menu's; the owner, 30 October 2026: "Recenter in ar room mode
  // with the circles should bring panel and 3d model to the starting position"): the station's place and panel keys go
  // (absent, they are where the story puts them), so its scene (offset, size, turn) and its panel glide back there for
  // everyone at its circle, as any move from the room does; in explore mode the view goes back to where the story itself
  // put it here (VW.home) and goes out as a view after a flight does. Refused while its story is locked, as the grip is
  function recenterStation() {
    const L = sesSt();
    if (!L || !placing()) return false;
    if (stLocked(L)) { notice('This story is locked', 'Unlock it in the menu, under Circles (Story locked: unlock), to recenter it.', 3500); return false; }
    BUF.delete(kPlace(L.id)); BUF.delete(kPanel(L.id));
    publish([[kPlace(L.id), null], [kPanel(L.id), null]]);
    const H = VW.home, A = C.hook && C.hook.APP;
    if (H && H.id === L.id && H.story === L.story && A && A.mode === 'explore' && C.hook.setView) guarded(() => { try { C.hook.setView(H.v.slice()); } catch (e) { /* not now */ } });
    log('recenter', { st: L.id });
    return true;
  }
  // for HOST.panels: at a station of this story (a headset in its circle, a page following it), the station's; else null
  const panelsAt = key => { const L = sesSt(); return C.code && L && L.story === key ? stPanels(L) : null; };   // (kept while a link moves or reconnects)
  const setPanels = (key, v) => !!panelsAt(key) && setStPanels(sesSt().id, v);
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
      const old = C.st.find(s => s.story === m.key && !s.kind && !used.has(s.id)), id = old ? old.id : rid(5);
      used.add(id);
      pairs.push(['st.' + id, { story: m.key, x: r3(b.x + ahead * fx + side * rx), z: r3(b.z + ahead * fz + side * rz), yaw: r3(b.yaw) }]);
      if (!old) pairs.push([kPlay(id), startClock()]);
    });
    // (a second station of a story goes; one of a story this device does not know, of a page that is not a story, such
    // as the design room's table or the studio, and the shell's own kinds, All stories and Back to the lobby, stay where
    // they are: never part of Arrange all)
    for (const s of C.st) if (!used.has(s.id) && !s.kind && HOST.list.some(m => m.key === s.story)) pairs.push(['st.' + s.id, null]);
    log('arrange', { stations: n });
    publish(pairs.concat(arcEnd()));   // (the room's arc becomes a circle where it stands, in the same batch)
    // a soft thunk at each new spot, one after another along the rows (on a screen from left to right)
    pairs.filter(([k, v]) => ST_RE.test(k) && v).forEach(([, v], i) => {
      const side = (i % front - (front - 1) / 2) / Math.max(1, front / 2);
      sfx('place', roomAt(v.x, 0.05, v.z), { delay: i * 0.07, gain: 0.7, force: true, pan: side * 0.5 });
    });
  }
  // what Add offers (the page's picker, the headset's Add page): every story, then the pages that are not stories (the
  // design room's table, the studio), which only Add and the menu's Design room and Studio buttons place, never Arrange all
  // (and then the shell's own kinds: All stories and Back to the lobby)
  // (and after the studio its relay's scenes, one entry each: SCN, below)
  const addable = () => {
    const ex = (self.STORY_EXTRA || []).filter(m => m && m.key && !HOST.list.some(x => x.key === m.key)), st = meta(STUDIO);
    const sc = st && !st.unknown && ex.some(m => m.key === STUDIO) ? SCN.list.map(n => ({ key: STUDIO, scene: n, title: 'Studio: ' + n, kick: st.kick, col: st.col })) : [];
    const k = ex.findIndex(m => m.key === STUDIO) + 1;
    return HOST.list.concat(ex.slice(0, k), sc, ex.slice(k), [KINDS.all, KINDS.lobby]);
  };
  const addName = m => (HOST.list.includes(m) || m.kind || m.scene ? m.title : m.kick || m.title);
  // an entry's value in the page's picker and its button's id in the headset's (add:<it>): a scene's 'scene:<name>'
  const addVal = m => (m.scene ? 'scene:' + m.scene : m.key);
  const addOne = (v, b) => (/^scene:/.test(v) ? addScene(v.slice(6), b) : add(v, b));
  // Studio scenes as circles (v118; the owner, 5 November 2026: "add scenes as possible circles"). Add (the page's picker,
  // the headset's Add here page) lists after the studio one entry per scene of the studio's relay (relayFind, then GET
  // /api/scenes with its password: asked again whenever the picker or the page opens, at most every 3 s; none without a
  // relay, from a relay without scenes or one that refuses). Such an entry makes a studio circle for that scene in one
  // batch: st.<id> = { story: 'studio', sc: true, x, z, yaw } (sc: made for a scene, the shell's own mark, kept by every
  // move: stVal), its clock and its state, st.<id>.x = { scene } (the studio's own field and nothing else: the studio at a
  // station whose state names a scene and holds no items opens it and writes its saved layout, every device alike).
  // Several studio circles may stand in a room; each one's title wherever the shell names a station is "Studio: <scene>"
  // while its state names one (sceneOf: also a plain circle's once a scene is picked there)
  const SCN = { list: [], at: -1e9, busy: null };
  function scenesFetch() {
    if (SCN.busy) return SCN.busy;
    if (performance.now() - SCN.at < 3000) return Promise.resolve(SCN.list);
    const m = meta(STUDIO);
    if (!m || m.unknown || !C.code) return Promise.resolve(SCN.list);
    SCN.busy = (async () => {
      let list = [];
      try {
        const f = await relayFind();
        if (f && C.relay) {
          const r = await api('scenes');
          if (r.ok && r.j && Array.isArray(r.j.scenes)) list = r.j.scenes.map(x => (x && typeof x.name === 'string' ? x.name : '')).filter(n => n && n.length <= 64).slice(0, 200);
        }
      } catch (e) { /* none: no relay, or it did not answer */ }
      const was = SCN.list.join('/');
      SCN.list = list; SCN.at = performance.now(); SCN.busy = null;
      if (list.join('/') !== was) { log('scenes', { n: list.length }); changed(); }
      return list;
    })();
    return SCN.busy;
  }
  // the scene a studio circle's state names ('' none, or not a studio circle)
  function sceneOf(s) {
    if (!s || s.kind || s.story !== STUDIO) return '';
    const v = val(kX(s.id));
    return v && typeof v === 'object' && typeof v.scene === 'string' ? v.scene.slice(0, 64) : '';
  }
  function addScene(name, b) {
    const m = meta(STUDIO);
    name = String(name || '');
    if (!C.code || !m || m.unknown || !name || name.length > 64 || refused('add')) return '';
    b = b || base();
    const id = rid(5);
    // (the station, its clock and the scene in one batch; the room's arc becomes a circle where it stands, as for any Add)
    publish([['st.' + id, { story: STUDIO, sc: true, x: r3(b.x), z: r3(b.z), yaw: r3(b.yaw) }], [kPlay(id), startClock(STUDIO)], [kX(id), { scene: name }]].concat(arcEnd()));
    sfx('place', roomAt(b.x, 0.05, b.z));
    log('studio scene added', { st: id, scene: name });
    return id;
  }
  // Add a station here: one story at your feet, facing where you face (or an All stories circle, showing its cards, Own
  // stories; or a lobby circle)
  function add(story, b) {
    const kd = KINDS[story];
    if (!meta(story) || meta(story).unknown || refused('add')) return '';
    b = b || base();
    const id = rid(5);
    // (the first other circle: the room's arc becomes a circle where it stands, in the same batch)
    publish((kd ? [['st.' + id, stVal({ story, kind: story, sync: false }, b)]] : [['st.' + id, { story, x: r3(b.x), z: r3(b.z), yaw: r3(b.yaw) }], [kPlay(id), startClock(story)]]).concat(arcEnd()));
    sfx('place', roomAt(b.x, 0.05, b.z));
    return id;
  }
  function move(id, b) {
    const s = C.stById.get(id);
    if (!s || refused('move')) return;
    b = b || base();
    publish([['st.' + id, stVal(s, b)]]);
    sfx('place', roomAt(b.x, 0.05, b.z));
  }
  function remove(id) { if (C.stById.has(id) && !refused('remove')) publish([['st.' + id, null]]); }
  // a page that is not a story here (the menu's Design room and Studio buttons in a room): a station of it at your feet,
  // facing your way, or the room's one moved here when it has one (one props table, not a pile of them); refused while the
  // circles are locked. The studio (v118: a room may hold several studio circles, one for each scene, from Add): the room's
  // plain studio circle (one not made for a scene, sc; told by how it was made, never by its state, which names a scene as
  // soon as one is picked there) moved here, the first by id when there are several, whatever circles of scenes stand
  // beside it; else a new plain studio circle at your feet
  const DESIGN = 'design', STUDIO = 'studio';
  const pageOne = key => C.st.find(s => s.story === key && !s.kind && !s.sc) || null;
  function pageHere(key, b) {
    const has = pageOne(key);
    if (!C.code || refused(has ? 'move' : 'add')) return '';
    if (!has) { const id = add(key, b); if (id) log(key + ' here', { st: id, added: true }); return id; }
    move(has.id, b);
    log(key + ' here', { st: has.id, moved: true });
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
    const L = sesSt();
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
    const L = sesSt();
    if (!synced(L) || C.guard || C.hush) return;
    const t = performance.now();
    if (t - C.clockAt < 100) {
      if (!C.clockT) C.clockT = setTimeout(() => { C.clockT = 0; const M = sesSt(); if (M && M.id === L.id) clockPublish(); }, 100 - (t - C.clockAt));
      return;
    }
    C.clockAt = t;
    const A = C.hook.APP, playing = A.mode === 'story' && !!A.playing;
    publish([[kPlay(L.id), { mode: A.mode, t: r3(A.t), playing, at: playing ? Math.round(now()) : 0 }]]);
  }
  // play pressed on a story that is paused here only (the Stories screen, a headset taken off) while its
  // station plays: join the station's clock instead of starting it again from here
  function catchUp() {
    const L = sesSt();
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
    const L = sesSt();
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
    const L = sesSt();
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
    const L = sesSt();
    if (!synced(L) || !C.hook.state) return;
    let s;
    try { s = C.hook.state(); } catch (e) { return; }
    if (s !== undefined) publish([[kX(L.id), s]]);
  }
  // The station's panel (relative to its spot: x, y over the floor, z, yaw, and with free moving its rotation q) and its
  // scene (moved from where the story puts it, x, y, z, sized, s, and with free moving turned, q), moved here with the
  // grip (both hands on the scene resize it): they go out to the room 15 times a second while they move and are held
  // (with ts and h: 1), once more as they come to rest and once more when let go (no h), so the others see them move;
  // someone else's moves come in smoothly (below), and otherwise they glide to the room's values (and are put there at
  // once when a station is reached). Every frame, from the shell's tick.
  const PL = { id: '', held: { panel: false, globe: false }, moved: { panel: false, globe: false }, quiet: { panel: 0, globe: 0 }, at: 0 };
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
  // the room's explore view at a station: { v: [...], story } (an array alone, or one written for another story: none)
  const viewOf = (raw, L) => { const v = raw && typeof raw === 'object' && !Array.isArray(raw) ? (ofStory(raw, L) ? raw.v : null) : raw; return Array.isArray(v) && v.length && v.every(Number.isFinite) ? v : null; };

  // ------------------------------------------------------- others' moves, smooth --
  // Snapshot interpolation (the owner, 30 October 2026: "my colleague spun that and it was a bit jerky on my side"). What
  // someone moves by hand (a station's scene and panel and the explore view there, a station carried by the grip, a
  // person's head and hands) goes out at most 15 times a second (SEND), each write stamped with the relay's time (ts,
  // whole ms) and, while still held, h: 1 (the write on letting go has none). Every device keeps the last few samples of
  // each thing someone else moves and draws it where it was DELAY ago, between the two samples around that moment, so it
  // moves at the sender's own pace. (A new value chased by a glide sped up and slowed down at every arrival, and inside a
  // large network a small step of a spin is a big jump at its far side.) DELAY is two send intervals and a little: the
  // next sample is nearly always here already, even one 25 ms late. Past the last sample a held thing carries on as it
  // went for at most CARRY, then holds; one let go lands exactly where it was let go, and its samples are done with. A
  // grip here drops someone else's samples of the same thing (or letting go would pull it back). A value without ts (a
  // write by hand: Arrange all, the map, a view after a flight), a new station, its story changed or nothing newer than
  // LIVE leave it to the glide as before. Moves inside a story's collab.state() (the pass story's sea, the design room's
  // miniatures) are not smoothed here: they come with the state, five times a second, and the story's own glide.
  const SMOOTH = { DELAY: 120, SEND: 66, KEEP: 8, GAP: 1000, LIVE: 1000, CARRY: 100 };
  const BUF = new Map();   // a moving key's samples (st.<id> carried, st.<id>.place, .panel, .view): { s: [{ ts, v, h }], seed, story }
  function bufPush(B, ts, v, h) {
    const s = B.s, last = s[s.length - 1];
    if (last && ts <= last.ts) {   // (late, or twice: older than the newest; but a let-go always lands, even stamped no later
      if (!h && last.h) s[s.length - 1] = { ts: last.ts, v, h: false };   // than the last held one by a clock measured again)
      return;
    }
    if (last && ts - last.ts > SMOOTH.GAP) s.length = 0;   // (a new move after a pause)
    if (!s.length) B.seed = true;
    s.push({ ts, v, h: !!h });
    if (s.length > SMOOTH.KEEP) s.shift();
  }
  // a new move starts from where the thing is shown here (one send interval before its first sample), not with a jump
  function bufSeed(B, v) { if (B.seed && B.s.length && v) B.s.unshift({ ts: B.s[0].ts - SMOOTH.SEND, v, h: true }); B.seed = false; }
  // the value at the render time (RT.t), mixed by mix(a, b, f) (f past 1 carries on as it went), or null: nothing newer than LIVE
  function bufAt(B, mix) {
    const s = B && B.s, n = s ? s.length : 0, t = RT.t;
    if (!n || t - s[n - 1].ts > SMOOTH.LIVE) return null;
    const last = s[n - 1];
    if (t >= last.ts) return !last.h || n < 2 ? last.v : mix(s[n - 2].v, last.v, 1 + Math.min(t - last.ts, SMOOTH.CARRY) / Math.max(1, last.ts - s[n - 2].ts));
    let i = n - 1;
    while (i > 0 && s[i - 1].ts > t) i--;
    return i ? mix(s[i - 1].v, s[i].v, (t - s[i - 1].ts) / (s[i].ts - s[i - 1].ts)) : s[0].v;
  }
  const bufDone = B => { const L = B.s[B.s.length - 1]; return !!L && !L.h && RT.t >= L.ts; };   // (landed where it was let go)
  // the render time: the relay's clock DELAY ago, run on by each frame's own time and eased towards that by at most 2 ms
  // a frame, so a new measure of the relay's clock never jolts what moves (more than 250 ms off: at once). Every frame
  const RT = { at: 0, t: 0 };
  function renderStep() {
    const p = performance.now(), want = now() - SMOOTH.DELAY;
    let t = RT.t + (p - RT.at);
    if (!RT.at || Math.abs(want - t) > 250) t = want; else t += Math.max(-2, Math.min(2, (want - t) * 0.1));
    RT.at = p; RT.t = t;
  }
  // how two samples mix: places in a straight line, sizes geometrically, turns by slerp (the shortest way), yaws by the
  // shortest angle, a view component by component (its angles in degrees in [-180, 180): unwrapped where they cross)
  const lerp = (a, b, f) => a + (b - a) * f;
  const turnBy = (a, b) => { const d = (b - a) % (2 * Math.PI); return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d; };
  const MIX = {
    place: (a, b, f) => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f), s: a.s * Math.pow(b.s / a.s, f), q: a.q || b.q ? qSlerp(a.q || Q1, b.q || Q1, f) : null }),
    panel: (a, b, f) => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f), yaw: a.yaw + turnBy(a.yaw, b.yaw) * f,
      q: a.q || b.q ? qSlerp(a.q || yawQ(a.yaw), b.q || yawQ(b.yaw), f) : null }),
    station: (a, b, f) => ({ x: lerp(a.x, b.x, f), z: lerp(a.z, b.z, f), yaw: a.yaw + turnBy(a.yaw, b.yaw) * f }),
    menu: (a, b, f) => ({ p: a.p.map((x, k) => lerp(x, b.p[k], f)), q: qSlerp(a.q, b.q, f), w: lerp(a.w, b.w, f), h: lerp(a.h, b.h, f) }),   // (someone's menu shown to their circle)
    view: (a, b, f) => a.map((x, k) => { const y = b[k], w = Math.abs(x) <= 180 && Math.abs(y) <= 180 ? (y - x > 180 ? -360 : x - y > 180 ? 360 : 0) : 0; return lerp(x, y + w, f); }),
    person: (a, b, f) => ({ head: [lerp(a.head[0], b.head[0], f), lerp(a.head[1], b.head[1], f), lerp(a.head[2], b.head[2], f), ...qSlerp(a.head.slice(3), b.head.slice(3), f)],
      hands: b.hands.map((H, i) => {
        const A = a.hands[i];
        if (!A) return H;
        const d = [lerp(A[3], H[3], f), lerp(A[4], H[4], f), lerp(A[5], H[5], f)], l = Math.hypot(...d) || 1;
        return [lerp(A[0], H[0], f), lerp(A[1], H[1], f), lerp(A[2], H[2], f), d[0] / l, d[1] / l, d[2] / l, lerp(A[6], H[6], f)];
      }) }),
  };
  // a moving key's value as it is drawn (its story is checked where it is used), or null: not a move (no ts), so the glide
  const SAMPLE = {
    place: v => (validPlace(v, v) ? { x: v.x, y: v.y, z: v.z, s: clampS(v.s), q: roomQ(v) } : null),
    panel: v => (validPanel(v, v) ? { x: v.x, y: v.y, z: v.z, yaw: v.yaw, q: roomQ(v) } : null),
    view: v => (Array.isArray(v.v) && v.v.length && v.v.every(Number.isFinite) ? v.v.slice() : null),
    station: v => (['x', 'z', 'yaw'].every(k => Number.isFinite(v[k])) ? { x: v.x, z: v.z, yaw: v.yaw } : null),
  };
  // someone else's write of a moving key (onSet): a sample, or the end of its samples
  function smoothIn(k, v) {
    const m = SM_RE.exec(k), w = m && (m[2] || 'station');
    if (!w) return;
    const p = v && typeof v === 'object' && Number.isFinite(v.ts) ? SAMPLE[w](v) : null;
    if (!p) { BUF.delete(k); return; }
    let B = BUF.get(k);
    if (!B || B.story !== v.story) BUF.set(k, (B = { s: [], seed: false, story: v.story }));   // (another story: anew)
    bufPush(B, v.ts, p, v.h === 1);
  }

  function placeSync(dt, t) {
    const L = sesSt();
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
    const room = { panel: roomPanel(L), globe: roomPlace(L) }, key = { panel: kPanel(L.id), globe: kPlace(L.id) };
    const put = (w, v) => {
      try { if (w === 'panel') C.hook.panel([v.x, v.y - EYE, v.z], v.yaw, v.q || null); else if (C.hook.place) C.hook.place([v.x, v.y, v.z], v.s, v.q || null); } catch (e) { /* story not ready */ }
    };
    if (PL.id !== L.id) {   // a station reached: as the room has it
      Object.assign(PL, { id: L.id, held: { panel: false, globe: false }, moved: { panel: false, globe: false } });
      BUF.delete(key.panel); BUF.delete(key.globe);
      put('panel', room.panel); put('globe', room.globe);
      return;
    }
    const lk = stLocked(L), hs = String(p.held || ''), out = [], ts = Math.round(now());   // held: what a grip holds there ('panel', 'globe'); lk: this story's lock
    for (const w of ['panel', 'globe']) {
      const held = !lk && hs.includes(w), a = cur[w], b = room[w];
      // the turns compared and eased: the panel's upright at its yaw when it has none, the scene's none
      const qa = a.q || (w === 'panel' ? yawQ(a.yaw) : Q1), qb = b.q || (w === 'panel' ? yawQ(b.yaw) : Q1), dq = qAng(qa, qb);
      // held: out to the room 15 times a second while it moves and once more as it comes to rest (h: 1: the others see
      // where it stopped rather than carry it on), and once more without h when let go (locked meanwhile: it lands where
      // it was last sent, and goes back there here); the other one, not held, goes on following the room
      if (held || PL.held[w]) {
        BUF.delete(key[w]);   // (held here: someone else's last move must not pull it back once let go)
        PL.held[w] = held;
        if (!held) PL.quiet[w] = t + 400;   // (our last write on its way)
        const was = val(key[w]);
        if (!held && lk) { if (was && was.h === 1) out.push([key[w], Object.assign(bare(was), { ts })]); continue; }   // (locked: it lands where it was last sent)
        if (held && t - PL.at < SMOOTH.SEND) continue;
        const v = w === 'panel' ? { x: r3(a.x), y: r3(a.y), z: r3(a.z), yaw: r3(a.yaw) } : { x: r3(a.x), y: r3(a.y), z: r3(a.z), s: r3(a.s) };
        if (a.q) v.q = qOut(a.q);
        const moved = Math.hypot(v.x - b.x, v.y - b.y, v.z - b.z) > 0.002 || dq > 0.004 || (w === 'panel' ? Math.abs(v.yaw - b.yaw) > 0.004 : Math.abs(v.s - b.s) > 0.002);
        if (held ? !moved && !PL.moved[w] : !moved && !(was && was.h === 1)) continue;
        PL.moved[w] = held && moved;
        out.push([key[w], Object.assign(v, { story: L.story, ts }, held ? { h: 1 } : {})]);
        continue;
      }
      if (t < PL.quiet[w]) continue;
      // someone else moving it: where they had it DELAY ago, exactly, every frame (no glide on top)
      const B = BUF.get(key[w]);
      if (B && B.story === L.story) {
        bufSeed(B, a);
        const v = bufAt(B, w === 'panel' ? MIX.panel : MIX.place);
        if (v) { put(w, v); if (bufDone(B)) BUF.delete(key[w]); continue; }   // (landed: the room's value from now on)
      }
      // the room's value glides in (the last couple of millimetres at once); a turn by slerp
      const k = 1 - Math.exp(-dt * 12), d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), q = a.q || b.q ? qSlerp(qa, qb, k) : null;
      if (w === 'panel') {
        const y = turnBy(a.yaw, b.yaw);
        if (d < 1e-6 && Math.abs(y) < 1e-6 && dq < 1e-6) continue;
        put(w, d < 0.002 && Math.abs(y) < 0.003 && dq < 0.003 ? b : { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: a.yaw + y * k, q });
      } else {
        const ds = Math.abs(Math.log(b.s / a.s));
        if (d < 1e-6 && ds < 1e-6 && dq < 1e-6) continue;
        put(w, d < 0.002 && ds < 0.001 && dq < 0.003 ? b : { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, s: a.s * Math.pow(b.s / a.s, k), q });
      }
    }
    if (out.length) { PL.at = t; publish(out, true); }   // (the rest and the letting go are no new value: forced)
  }

  // The scene's view at a station in a headset (explore mode: how the story turns and sizes its scene, which is where it
  // stands in the room): shared by the headsets there, so they see it alike. A view turned here goes out while it changes
  // frame by frame (at most 15 times a second, with ts and h: 1) and once more without h when it rests; someone else's
  // comes in smoothly (put exactly where it was DELAY ago, every frame, through the story's setView(v, true), and nothing
  // goes out meanwhile, so nothing applied from the room is written back; once it has landed, turns made here go out
  // again). A view that changed at once here (after a flight: collabView is null while the camera flies) goes out plain,
  // and one from the room without ts glides in (the story's own 0.25 s glide). Screens keep their own camera; story mode
  // follows the clock. Every frame, from the shell's tick.
  // (home: where this story itself put the view here, for Recenter: the first view after none, that is explore mode begun
  // or a flight of its own landed, never one glided to from the room (glide) or turned by hand)
  const VW = { id: '', seen: '', at: 0, moving: false, gap: true, here: '', none: true, glide: '', home: null };
  function viewSync(t) {
    const L = sesSt();
    if (!synced(L) || !R.placing() || HOST.picking || !C.hook.view || !C.hook.setView) { VW.id = ''; return; }
    const k = kView(L.id), room = viewOf(val(k), L);
    const set = (v, at) => { if (!at) VW.glide = J(v); guarded(() => { try { C.hook.setView(v, at); } catch (e) { log('view failed', { e: e.message }); } }); };
    if (VW.id !== L.id) { Object.assign(VW, { id: L.id, seen: '', at: 0, moving: false, gap: true, here: '', none: true, glide: '', home: null }); BUF.delete(k); }   // a station reached: as the room has it
    let cur = null;
    try { cur = C.hook.view(); } catch (e) { return; }
    if (!cur) VW.gap = true;   // (flying, or in story mode: what comes after is no turn)
    if (cur && VW.none && !VW.glide) VW.home = { id: L.id, story: L.story, v: cur.slice() };   // (none while a view from the room glides in)
    if (cur && (VW.none || VW.glide === J(cur))) VW.glide = '';
    VW.none = !cur;
    const B = BUF.get(k);
    if (B && B.story === L.story && !C.pending.has(k)) {   // someone else turning it
      if (cur) bufSeed(B, cur);
      const v = bufAt(B, MIX.view);
      VW.seen = k + J(room); VW.moving = false; VW.gap = !cur;
      if (v && !bufDone(B)) { set(v, true); return; }
      // landed: exactly where it was let go, and the buffer done with (a turn here goes out again from the next frame).
      // What the story shows then is the room's view here (here), never a turn made here, even if it reads a little
      // differently. Nothing newer (lapsed): it glides to the room's
      BUF.delete(k); VW.here = '';
      if (v) { set(v, true); try { VW.here = J(C.hook.view()); } catch (e) { /* not now */ } } else if (room) set(room);
      return;
    }
    // from the room without ts (a view after a flight, the first at a station, a write by hand): it glides in
    const seen = k + J(room);
    if (room && seen !== VW.seen && !C.pending.has(k)) { VW.seen = seen; VW.moving = false; if (J(cur) !== J(room)) { log('view', { st: L.id }); set(room); } return; }
    // turned here
    if (!cur || t - VW.at < SMOOTH.SEND) return;
    const moved = J(cur) !== J(room) && J(cur) !== VW.here;
    if (VW.gap) {   // (after a flight, or the first here: plain, the others glide to it)
      VW.gap = false; VW.moving = false;
      if (moved) { VW.at = t; VW.here = ''; publish([[k, { v: cur, story: L.story }]]); VW.seen = k + J(cur); }
      return;
    }
    if (!moved && !VW.moving) return;
    VW.at = t; VW.moving = moved; VW.here = '';
    publish([[k, Object.assign({ v: cur, story: L.story, ts: Math.round(now()) }, moved ? { h: 1 } : {})]], true);
    VW.seen = k + J(cur);
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
    arcStep(t);   // (the room's arc: everyone at it)
    const L = liveSt(), S = sesSt();
    if (synced(S) && !HOST.picking) { if (!C.clockT) clockApply(false); statePoll(); }   // (the view: every frame, viewSync)
    // a switch the room asked for that got lost (a story still loading drops a second request): ask again
    else if (L && runs(L) && L.story !== HOST.curKey && (C.mine === L.id || C.follow === L.id) && !HOST.busy && t - C.goAt > 3000) goTo(L);
    for (const [id, P] of C.pres) if (t - P.at > (P.head ? 3000 : 8000)) C.pres.delete(id);
    menusExpire(t);   // (someone's menu shown to their circle, not heard of for a while: gone)
    // a desktop says which station it follows, now and then (headsets say it with their presence)
    if (!HOST.session && t - C.deskAt > 2000) { C.deskAt = t; fx('p.' + C.id, { st: C.follow || '' }); }
    if (DLG.open) { drawMap(); guideList(); }
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
    // (a switch, drawn lit or not: its press sounds as turning it off or on (o.tog, when that is not what lit says: true
    // sounds as off); tog null: a plain button)
    if (fn) S.regions.push({ id, x, y, w, h, fn, tog: typeof o.tog === 'boolean' ? o.tog : o.tog === null ? null : typeof o.on === 'boolean' ? o.on : null });
  }
  function build() {
    if (OV.root) return;
    OV.root = new THREE.Group(); OV.root.name = 'shared';
    OV.room = new THREE.Group(); OV.room.matrixAutoUpdate = false;
    OV.root.add(OV.room);
    OV.panelG = new THREE.Group();
    OV.panel = sheet(720, 1920, 0.42, 53);   // (the tallest it gets: a room on this headset with a three-line note, at a station, 1885 px)
    OV.panelG.add(OV.panel.mesh); OV.root.add(OV.panelG);
    OV.panel.mesh.userData.shell = { kind: 'panel' };
    // the Story tab: the story's own two panels (its text and explore panes, its play bar), their textures shown on
    // planes of the menu's, over its canvas; pointing at them points at the story's panel (storyPanels, mirrorStep)
    OV.mirror = {};
    for (const which of ['main', 'foot']) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }));
      m.renderOrder = 54; m.visible = false; m.userData.shell = { kind: 'storypanel', which };
      OV.panelG.add(m); OV.mirror[which] = m;
    }
    OV.note = sheet(720, 170, 0.5, 54);
    OV.root.add(OV.note.mesh); OV.note.mesh.visible = false;
    // the question whether to go into a circle (circles asked first: ASK), over everything, pointable; and the frame-rate
    // read-out (HOST.xr.fps: drawFps), over the story and the subtitles, under the menu and the notices
    OV.ask = sheet(720, 300, 0.42, 55);
    OV.ask.mesh.userData.shell = { kind: 'ask' };
    OV.root.add(OV.ask.mesh); OV.ask.mesh.visible = false;
    // the check by eye's question (EYEQ: are both crosses on your spots?), the same way
    OV.eye = sheet(720, 290, 0.42, 55);
    OV.eye.mesh.userData.shell = { kind: 'eye' };
    OV.root.add(OV.eye.mesh); OV.eye.mesh.visible = false;
    OV.fps = sheet(800, 120, 0.36, 52);
    OV.root.add(OV.fps.mesh); OV.fps.mesh.visible = false; OV.fps.text = '';
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
    // (drawn over everything: on the floor the room's own depth, or the scene, would hide a cross a little under it,
    // and the check by eye is about where they are; under the menu, 54, and the sheets, 55, so their buttons stay readable)
    OV.marks.traverse(m => { if (m.material) Object.assign(m.material, { depthTest: false, depthWrite: false, transparent: true }); m.renderOrder = 53; });
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
  // (not while the trigger takes the controller's tip: a calibration, or a check, goes to the spot itself, not to where
  // this headset puts it)
  function drawMarks() {
    const eye = eyeShown(), mk = eye ? roomMk() : R.mk, t = performance.now();   // (asked by eye: where this headset puts the room's spots)
    OV.marks.visible = OV.room.visible && !!mk && !tipMode() && (eye || PNL.open || t < R.showUntil);
    if (OV.marks.visible) {
      OV.crossA.position.set(0, mk[0], 0); OV.crossB.position.set(mk[1], mk[2], 0);
      OV.crossA.visible = OV.crossB.visible = true;
      const a = OV.markLine.geometry.attributes.position;
      a.setXYZ(0, 0, mk[0], 0); a.setXYZ(1, mk[1], mk[2], 0); a.needsUpdate = true;
      OV.markLine.geometry.computeBoundingSphere();
    }
    for (let i = 0; i < 2; i++) {
      const h = C.rays.get(i), A = OV.aims[i];
      A.visible = !!(tipMode() && h && C.frameN - h.n <= 2);
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
  // not the cards: it is part of the station, not a card, and with cards hidden it is all that tells the circles
  // apart. While lowpoly.js loads, and for a key without a miniature, a glowing polyhedron in the story's colour stands
  // there, so a new story needs only its icon in the list.
  // y: its middle over the floor (above the heads of people in the circle and the card's top edge, 1.6 m, so it
  // covers neither from across the room); size: 1 model unit in metres (miniDef fits each miniature); turn: s; tint:
  // how far the miniature's colours go to the story's
  const ICON = { y: 2.1, size: 0.3, ball: 0.2, turn: 12, tint: 0.55, defs: new Map(), mat: null, see: null, tex: null, halos: new Map(), models: null, askAt: 0, built: -1 };
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
  // you; seen false). Its miniature takes
  // the fallback's place once built (also while it is hidden, so showing it again costs no build)
  function iconStep(o, S, seen, dt) {
    const I = o.icon;
    if (!I.model && iconOf(I.key)) { const D = iconDef(I.key, true); if (D !== I.D) iconUse(I, D); }
    I.k += ((seen ? 1 : 0) - I.k) * (1 - Math.exp(-dt * 6));
    I.g.visible = I.k > 0.02;
    if (!I.g.visible) return;
    I.g.scale.setScalar(I.k); I.g.position.y = ICON.y / o.g.scale.y;
    let yaw = 0, lean = 0.3;
    if (R.session && R.headOK) {   // (this headset in its session, lined up: its head now)
      const dx = R.hr.x - S.x, dz = R.hr.z - S.z;
      yaw = Math.atan2(dx, dz) - S.yaw; lean = Math.min(0.7, Math.max(0.1, Math.atan2(ICON.y - R.hr.y, Math.hypot(dx, dz)) + 0.2));
    }
    poseIcon(I, yaw, lean, performance.now() / 1000);
  }

  // a preview of a station that is not live here: a ring at its spot in the story's colour, floating RING.y over the
  // floor (the owner, 31 October 2026: "Circles sollten ca 50 cm in der luft sein": a headset that puts the floor a
  // little wrong sinks a ring on the floor into it or lifts it off it, while one in the air reads as floating anyway), its
  // icon over it, and a small upright card over its middle, under the icon (title, who is there, playing at 1:23 /
  // exploring)
  function ringFor(s) {
    let o = OV.rings.get(s.id);
    if (!o) {
      const col = new THREE.Color(meta(lookKey(s)).col), g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.52, 48), mat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = RING.y;
      const tip = new THREE.Mesh(new THREE.CircleGeometry(0.09, 3), mat);   // a triangle at the front: which way it faces
      tip.rotation.set(-Math.PI / 2, 0, Math.PI / 2); tip.position.set(0, RING.y + 0.001, -0.62);
      g.add(ring, tip);
      ring.userData.shell = { kind: 'station', id: s.id };
      // an unseen ball round its icon: pointed at like the ring (in a circle the icon stands for the station: the ring is
      // gone there until you come near it)
      const ball = new THREE.Mesh(new THREE.SphereGeometry(ICON.ball, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
      ball.position.y = ICON.y; ball.userData.shell = ring.userData.shell;
      g.add(ball);
      // its icon turns in its own phase (not in step with the others)
      o = { g, ring, tip, ball, mat, story: lookKey(s), icon: makeIcon(lookKey(s), [...s.id].reduce((a, ch) => a + ch.charCodeAt(0) * 2.39996, 0) % (2 * Math.PI), true) };
      g.add(o.icon.g);
      OV.rings.set(s.id, o); OV.room.add(g);
    }
    if (o.story !== lookKey(s)) {   // (an All stories circle keeps its own look whatever story it shows)
      o.mat.color.set(meta(lookKey(s)).col); o.story = lookKey(s);
      const I = makeIcon(o.story, o.icon.ph, true);
      I.k = o.icon.k; o.g.remove(o.icon.g); o.g.add(I.g); o.icon = I;
    }
    const S = shown(s), held = MV.id === s.id;
    o.g.position.set(S.x, 0, S.z); o.g.rotation.set(0, S.yaw, 0); o.g.scale.setScalar(held ? 1.12 : 1);
    return o;
  }
  function cardFor(s, cm) {
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
    // cards in 3D (HOST.xr.cards): in the scene as the labels' signs are (drawn first of the see-through things, writing
    // depth, its clear corners cut away), so a glowing or glass model in front hides it; on top: drawn after the scenes.
    // Set only when the mode changes (a new alphaTest needs the material built again)
    const fixed = cm === 'fixed';
    if (o.fixed !== fixed) {
      const m = o.mesh.material;
      o.fixed = m.depthWrite = fixed; m.alphaTest = fixed ? 0.1 : 0; m.needsUpdate = true;
      o.mesh.renderOrder = o.back.renderOrder = fixed ? -1 : 49;
    }
    // over the middle of its ring, under its icon (the owner, 31 October 2026: "Circle card soll mittig ueber circle
    // sein"; it stood where the content floats, 1.4 m ahead); turned to you, upright (seen from another row it would be
    // back to front), on top or in 3D alike: it is a card in the room either way; without a head, facing back, where
    // people come from (Arrange all faces its stations away from you)
    const S = shown(s), cx = S.x, cz = S.z;
    o.mesh.position.set(cx, CARD_Y, cz); o.mesh.rotation.set(0, R.headOK ? Math.atan2(R.hr.x - cx, R.hr.z - cz) : S.yaw, 0);
    return o;
  }
  function stationLine(s) {
    if (s.kind === LOBBY_ST) return askFirst() ? 'Walk in or press: back to every circle' : 'Walk in: back to every circle';
    if (s.kind === ALL && !runs(s)) return 'Choosing a story';
    const P = playOf(sessOf(s));
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
    const m = meta(lookKey(s)), who = whoAt(s.id), held = MV.id === s.id, lk = circlesLocked(), title = stTitle(s), sig = [s.story, stationLine(s), who.join(','), o.hover, held, lk, s.sync, askFirst(), title].join('|');
    if (sig === o.sig) return;
    o.sig = sig;
    const ctx = o.ctx, W = o.w, H = o.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    rr(ctx, 4, 4, W - 8, H - 8, 22); ctx.fillStyle = 'rgba(8,15,28,0.92)'; ctx.fill();
    ctx.lineWidth = o.hover ? 6 : 3; ctx.strokeStyle = o.hover ? m.col : 'rgba(140,170,210,0.35)'; ctx.stroke();
    ctx.fillStyle = m.col; ctx.fillRect(4, 4, W - 8, 9);
    ctx.font = FONT(24, 700); ctx.fillStyle = m.col; ctx.fillText(fit(ctx, m.kick.toUpperCase(), W - 64), 32, 36);
    let tp = 54;   // a long title smaller (down to 44 px, on the same baseline: B612's is 0.8 of its size down), else cut short
    // (a studio circle for one scene: "Studio: <scene>"; an All stories circle: its own title, the story picked below)
    const big = s.kind === ALL ? m.title : title;
    for (; ; tp--) { ctx.font = FONT(tp, 700); if (tp <= 44 || ctx.measureText(big).width <= W - 64) break; }
    ctx.fillStyle = INK; ctx.fillText(fit(ctx, big, W - 64), 30, 70 + Math.round((54 - tp) * 0.8));
    // (an All stories circle: the story picked there, and whether it runs with the room's circle of it)
    const line = s.kind === ALL && runs(s) ? meta(s.story).title + (sessOf(s).id !== s.id ? ' (with its circle)' : '') + ': ' + stationLine(s) : stationLine(s);
    ctx.font = FONT(28); ctx.fillStyle = INK; ctx.fillText(fit(ctx, line, W - 64), 32, 150);
    ctx.fillStyle = MUTED; ctx.fillText(fit(ctx, who.length ? 'Here: ' + who.join(', ') : 'Nobody here yet', W - 64), 32, 194);
    ctx.font = FONT(22); ctx.fillStyle = held ? INK : FAINT;
    const tip = held ? ['Moving: point, raise or lower, twist to turn.', 'Let go of the grip to put it down.'] :
      [askFirst() ? (s.kind === LOBBY_ST ? 'Walk in, or press here, to leave your story.' : s.kind === ALL ? 'Point here and press to choose a story.' : 'Point here and press to go in.') :
        s.kind === LOBBY_ST ? 'Walk in to leave your story.' : s.kind === ALL ? 'Walk in to choose a story.' : 'Walk into its circle to see it.', lk ? 'The circles are locked.' : 'Hold the grip to move it.'];
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
    // cards in 3D: the tag as a sign turned with the head, two faces back to back (each reads the right way round),
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
  // the cards' mode (HOST.xr.cards: the station cards and the name tags with the story panels; an older shell: its labels)
  const cardMode = () => (HOST.xr.cards ? HOST.xr.cards() : HOST.xr.labels());
  function drawPeople(dt) {
    const k0 = 1 - Math.exp(-dt / 0.06);   // without ts: eased towards the latest presence (time constant 60 ms)
    const vr = HOST.mode !== 'immersive-ar', cm = cardMode();
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
      // where they were DELAY ago, between the samples around that moment (smoothing), exactly; else eased to the latest
      const S = bufAt(P.buf, MIX.person), k = S ? 1 : k0, h = S ? S.head : P.head, hands = S ? S.hands : P.hands;
      if (!o.e) o.e = { p: new THREE.Vector3(h[0], h[1], h[2]), q: new THREE.Quaternion(h[3], h[4], h[5], h[6]), hands: [] };
      o.e.p.lerp(_v.set(h[0], h[1], h[2]), k); o.e.q.slerp(_q.set(h[3], h[4], h[5], h[6]), k);
      o.avatar.position.copy(o.e.p); o.avatar.quaternion.copy(o.e.q);
      o.avatar.visible = vr || !m.here;
      // the name, a card as the station cards are (HOST.xr.cards): on top of everything (a sprite), in 3D (a sign over the
      // head, upright and turned to you, hidden by what stands in front of it) or hidden
      o.tag.position.set(o.e.p.x, o.e.p.y + 0.24, o.e.p.z);
      o.tag.visible = cm === 'face'; o.sign.visible = cm === 'fixed';
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
  // the previews of the stations that are not live here (the live one has no card and no icon, and its ring only with
  // Show all rings). In a circle (a live station here) the others show their icons only (the owner, 30 October 2026,
  // after v100: "Once inside a story hide the circles and show only the 3d icons, show circle once a person moves close
  // to the 3d icon of that story"; before, 29 October, rings only): another station's ring comes back within RING.near of
  // its spot, so you see where to step in, and a ray resting on an icon, a ring or the card it brought up shows that
  // station's card for as long as it points, fading about 2 s after (PEEK), so you can tell which story it is without
  // walking over. Your own station's ring is hidden as long as it is yours, wherever you walk (the owner, 31 October:
  // "just hide it once i am inside, only show it if i turn on the show all rings in the menu"): not drawn and not
  // pointable. Show all rings (the menu's Circles tab; this headset's own, kept here and never in the room) shows every
  // ring at any distance, yours too. Before any circle everything shows
  // With the circles asked first (the room's setting) no ring is drawn at all, the lobby's and your own too, unless Show all
  // rings is on (the owner, 6 November 2026: "Circles should not show at all when not in all circles on mode since entering
  // them is now done via selection by clicking the card and accepting"): the cards and icons stay, they are what you press
  const RINGS = { all: get('collabRings') === 'all' }, ringsAll = () => RINGS.all;
  function setRingsAll(on) { RINGS.all = !!on; put('collabRings', on ? 'all' : null); log('rings', { all: !!on }); changed(); }
  // The other circles hidden (HOST.collab.hideOthers, for the studio: a scene of its own in the room): while on and this
  // headset is at a studio station, every other station's ring, card and icon is neither drawn nor pointable (people stay
  // as they are); it lapses when the live station or its story changes (sig: what it was asked for). Pages are as ever
  const HIDE = { on: false, sig: '' };
  const hideSig = () => { const L = liveSt(); return L ? L.id + '|' + L.story : ''; };
  function hideOthers(on) {
    on = !!on;
    if (on !== HIDE.on || (on && HIDE.sig !== hideSig())) log('hide others', { on, st: C.live });
    HIDE.on = on; HIDE.sig = on ? hideSig() : '';
    return hidingOthers();
  }
  function hidingOthers() {
    if (HIDE.on && HIDE.sig !== hideSig()) { HIDE.on = false; HIDE.sig = ''; log('hide others', { on: false, why: 'station' }); }
    const L = HIDE.on && liveSt();
    return !!(L && L.story === STUDIO && HOST.session);
  }
  const HOV = [];   // what the controllers point at, this frame
  const PEEK = { hold: 2000, in: 12, out: 5 };   // (ms shown after the pointing stops; how fast it comes and goes, per s)
  const RING = { y: 0.5, near: 2, far: 2.2, in: 6, out: 4 };   // (its height over the floor; m from its spot: in a circle a ring shows within near and goes beyond far; how fast)
  const CARD_Y = 1.45;   // a station's card: its middle over the floor (its top edge at 1.6 m, under the icon at ICON.y)
  // the card fades as your head comes within CARD_NEAR of its ring's middle (walking in, it would be in your face)
  const CARD_NEAR = [0.45, 0.8];
  function drawPreviews(dt) {
    const ids = new Set(C.st.map(s => s.id)), cm = cardMode(), L = liveSt(), t = performance.now();
    for (const [id, o] of OV.rings) if (!ids.has(id)) {
      o.g.remove(o.icon.g);   // (its model and glow are the story's, kept for the next station of it)
      o.g.parent.remove(o.g); o.g.traverse(x => { if (x.geometry) x.geometry.dispose(); }); o.mat.dispose(); OV.rings.delete(id);
    }
    const yours = s => s.id === C.live && (s.story === HOST.curKey || cards());   // (your live station: its story, or an All stories circle's cards, in front of you)
    for (const [id, o] of OV.cards) if (!ids.has(id) || yours(C.stById.get(id))) {
      o.mesh.parent.remove(o.mesh); o.mesh.geometry.dispose(); o.tex.dispose(); o.mesh.material.dispose(); OV.cards.delete(id);
    }
    const noRings = askFirst() && !RINGS.all, hide = hidingOthers();
    for (const s of C.st) {
      const r = ringFor(s), live = yours(s), hov = HOV.some(h => h.target.kind === 'station' && h.target.id === s.id);
      // its ring: always before any circle, with Show all rings and while carried; in a circle another station's only
      // near its spot, your own never
      // (the room's arc, in a headset at it: nothing, its cards are the circle; one that became a circle while this headset
      // was at it, never walked into: its ring while you stand outside it, so you see where it is)
      // (circles asked first: none, unless Show all rings; the others hidden at a studio station: none of theirs, nor their
      // cards and icons, nothing of them to point at: r.hid, r.noRing)
      const S = shown(s), d = R.headOK ? Math.hypot(R.hr.x - S.x, R.hr.z - S.z) : 0, own = !!L && s.id === L.id, arc = s.arc && here();
      r.hid = hide && !own; r.noRing = r.hid || noRings;
      const nw = arc || r.noRing ? 0 : !L || RINGS.all || MV.id === s.id || (own && C.arcd === s.id && d > NEAR) || (!own && d < (r.near > 0.5 ? RING.far : RING.near)) ? 1 : 0;
      if (r.near === undefined) r.near = nw;
      r.near += (nw - r.near) * (1 - Math.exp(-dt * (nw ? RING.in : RING.out)));
      if (Math.abs(nw - r.near) < 0.01) r.near = nw;
      r.mat.opacity = (live ? 0.3 : MV.id === s.id ? 1 : 0.75) * r.near;
      r.ring.visible = r.tip.visible = r.near > 0.02;
      r.ring.userData.shell = r.ball.userData.shell = { kind: 'station', id: s.id, live };   // (the live one: only to move it)
      // in a circle, another station's card and icon only while pointed at (or carried), fading after
      if (hov || MV.id === s.id || ASK.id === s.id) r.seenAt = t;   // (and while you are asked whether to go into it)
      const peek = !L || s.id === L.id || t - (r.seenAt || -1e9) < PEEK.hold, want = peek ? 1 : 0;
      if (r.peek === undefined) r.peek = want;
      r.peek += (want - r.peek) * (1 - Math.exp(-dt * (peek ? PEEK.in : PEEK.out)));
      if (Math.abs(want - r.peek) < 0.01) r.peek = want;
      // its icon in every mode (not a card: with cards hidden it tells the circles apart), but not over your own station
      iconStep(r, S, !live && !arc && !r.hid, dt);
      if (live || arc || r.hid) { const c = OV.cards.get(s.id); if (c) c.mesh.visible = false; continue; }
      // cards hidden: no card (the ring stays, to walk up to, point at and move); in a circle none unless pointed at
      const c = cardFor(s, cm), k = r.peek * Math.min(1, Math.max(0, ((R.headOK ? d : 9) - CARD_NEAR[0]) / (CARD_NEAR[1] - CARD_NEAR[0])));
      c.mesh.visible = cm !== 'hidden' && k > 0.02;
      c.mesh.material.opacity = k;
      if (!c.mesh.visible) continue;
      c.hover = hov;
      drawCard(c, s);
    }
  }

  // ------------------------------------------------------- the headset's menu --
  // The menu opens and closes with a click of either stick, or with tracked hands two quick pinches of the left hand
  // pointing at no panel (the owner, 31 October 2026: "Clock menu nur aufmachen mit stick click", "only left double
  // pinch"; the clock on the wrist that opened it until then went in v103: "watch can be totally hidden now"; the time
  // is in the menu's header), and closes by itself after IDLE.ms unused (not while calibrating). It floats in front of you
  // ("just make it float in front of the headset"; 1 November: "further away from the face by default, also should be
  // movable with grabbing": FLOAT, MG), in four tabs ("a tab in clock menu that shows the current circle story menu
  // card"; "a tab in clock menu for debug settings etc, one that shows the current circles menu"): Story (the story on
  // show's own panels, usable there), Settings (Exit, Recenter, the slideshow for every story, the headsets' settings,
  // the story's panels, the sound switches, the design room and the studio), Circles (the shared room: join one from the
  // list or by its code, the stations, the locks, Show all rings, the people, your name and colour, leave) and Debug (the
  // alignment and calibration, People, Sound check, the version, the connection, the browser and the frame rate).
  // It is closed at the start of every session (a notice says how to open it), and opens by itself (on Circles) for the
  // question in VR and the first time in a room with no stations.
  const TABS = [['story', 'Story'], ['settings', 'Settings'], ['circles', 'Circles'], ['debug', 'Debug']];
  const PEOPLE_ROWS = 6;   // people listed under Circles at most (the rest as a count): the menu floats in front of you
  const SCN_ROWS = 8;   // the studio relay's scenes listed on the headset's Add here page at most (a page lists them all)
  const FPS = { v: 0, n: 0, t0: 0, last: 0, k: 0, sum: 0, wmax: 0, mean: 0, worst: 0 };   // the headset's frame rate, for the Debug tab and the read-out
  const tab0 = () => { const t = get('xrMenuTab'); return TABS.some(x => x[0] === t) ? t : 'story'; };
  // where it floats: its middle pos.d m ahead of your eyes along the floor and pos.h m above them (below: negative),
  // turned to you, at scale (the panel is 0.42 m wide at 1: about 44 cm, read as the 28 cm one at 0.5 m was; too far for
  // a fingertip, the ray reaches it); pos is where you last left it with the grip (kept on this headset, xrMenuAt), else
  // 0.8 m ahead and 12 cm below your eyes. It stays put while you use it and glides back in front once your head has
  // turned more than turn (rad) from it, gone further than far or nearer than near (m, along the floor) or moved up or
  // down by rise (m); left somewhere by hand (pinned) it stays there until it closes
  const FLOAT = { scale: 1.05, turn: 30 * Math.PI / 180, far: 1.4, near: 0.35, rise: 0.25, ease: 6, pos: menuAt0(),
    placed: false, glide: false, pinned: false, y: 0, at: new THREE.Vector3() };
  function menuAt0() {
    let o = null;
    try { o = JSON.parse(get('xrMenuAt') || 'null'); } catch (e) { /* none kept */ }
    return o && Number.isFinite(o.d) && Number.isFinite(o.h) ? { d: Math.min(2, Math.max(0.3, o.d)), h: Math.min(0.6, Math.max(-0.8, o.h)) } : { d: 0.8, h: -0.12 };
  }
  // the menu carried by the grip (MG): the controller it follows, how far along its ray it was taken, and where the
  // menu's top edge was from that point
  const MG = { src: null, i: -1, dist: 0, off: new THREE.Vector3(), at: 0 };
  const PNL = { open: false, page: 'main', asked: '', empty: '', code: '', pass: '', home: false, tab: tab0(), used: 0, self: false, gs: 0, kp: null };   // (code: the letters typed on its keypad page; pass: the relay's password typed on its own, home: for the relay offered; gs: the room setup guide's page; kp: a keypad waiting for a word, HOST.collab.keypad)
  const IDLE = { ms: 20000 }, _vs = new THREE.Vector3();   // the menu closes by itself after this long unused (a press, or a ray or fingertip on it)
  function menuOpen(on, why) {
    on = !!on;
    if (on !== PNL.open) log('menu', { open: on, by: why || '' });
    // (opened or closed by hand: a sound from where it floats, or will; not when it opens or closes by itself, or for a test)
    if (on !== PNL.open && HOST.session && /^(stick|pinch|close)$/.test(why || '')) {
      const at = PNL.open && FLOAT.placed ? OV.panelG.position : HD.ok ? _vs.set(0, 0, -FLOAT.pos.d).applyQuaternion(HD.q).add(HD.p) : null;
      sfx(on ? 'open' : 'close', at);
    }
    kpEnd(null);   // (a keypad waiting for a word: cancelled)
    if (on) askClose('menu');   // (the question whether to go into a circle goes when the menu opens)
    PNL.open = on; PNL.page = 'main'; PNL.code = ''; PNL.pass = ''; PNL.home = false; C.listing.menu = on; PNL.used = performance.now(); FLOAT.placed = false; FLOAT.pinned = false;
    if (!on && MG.src) menuPut();   // (closed while carried)
    PNL.self = on && /^(question|empty|guide)$/.test(why || '');   // (opened by itself, for the room: on Circles, and kept open until used)
    if (PNL.self) PNL.tab = 'circles';
    if (on && !C.code) { listRooms(); nearFind('menu'); }
  }
  const toggleMenu = why => menuOpen(!PNL.open, why);
  // the tabs, and the one it opens on: the one used last (kept on this headset)
  function setTab(t) { if (!TABS.some(x => x[0] === t)) return; kpEnd(null); PNL.tab = t; PNL.page = 'main'; PNL.code = ''; PNL.pass = ''; PNL.home = false; put('xrMenuTab', t); }
  // where a press on the open menu sounds from (a headset; null on a screen)
  function menuAt() { return HOST.session && PNL.open && OV.panelG && OV.panelG.visible ? OV.panelG.position : null; }
  // how the menu opens, for the notices, and how it closes, for its header
  const menuWhere = () => (HAND.hand ? 'pinch twice with your left hand' : 'click a stick');
  const menuHint = () => (HAND.hand ? 'Pinch twice (left hand)' : 'Click a stick') + ' to close; unused, it closes after ' + Math.round(IDLE.ms / 1000) + ' s';
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
  // the time for the menu's header (hours and minutes, as the watch showed them)
  const timeNow = () => { const d = new Date(); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
  // the story on show's two panels for the Story tab (its panels hook: { main, foot }, each with its canvas texture and
  // size), or null (no story on show, a story without the hook, away from every station)
  function storyPanels() {
    if (!showing()) return null;
    let sp = null;
    try { sp = HOST.cur.panels ? HOST.cur.panels() : null; } catch (e) { /* not ready */ }
    return sp && sp.main && sp.foot && sp.main.tex && sp.foot.tex && sp.main.w && sp.foot.w ? sp : null;
  }
  // each frame: the Story tab's planes over the menu's canvas where drawPanel left room for them (PNL.mirror), showing
  // the story's own panel textures; hidden on any other tab, page, or with the menu closed
  function mirrorStep() {
    const g = PNL.mirror, sp = OV.panelG.visible && PNL.tab === 'story' && g ? storyPanels() : null, k = OV.panel.mw / OV.panel.w;
    for (const which of ['main', 'foot']) {
      const m = OV.mirror[which], P = sp && sp[which];
      if (!P) { m.visible = false; continue; }
      if (m.material.map !== P.tex) { m.material.map = P.tex; m.material.needsUpdate = true; }
      const h = which === 'main' ? g.hm : g.hf, top = which === 'main' ? g.y0 : g.y0 + g.hm + g.gap;
      m.scale.set(g.w * k, h * k, 1);
      m.position.set((g.x + g.w / 2 - OV.panel.w / 2) * k, -(top + h / 2) * k, 0.002);
      m.visible = true;
    }
  }
  // (hov: what is pointed at, lit; null: the same without it, what the menu shows to your circle goes by: menuSig)
  function panelSig(hov = OV.panel.hover) {
    return J([C.code, C.status, C.note, PNL.open, PNL.page, hov, C.name, C.color, C.hereSet, here(), askHere(), R.status(), C.mine, C.live, armed(C.mine),
      C.st.map(s => s.id + s.story + (s.sync ? 's' : '')), C.members.map(m => m.id + m.name + m.color + m.kind + m.here + (m.host ? 'h' : '')), [...C.pres].map(([id, P]) => id + P.st), C.via, hosting(), C.takeover, C.peer,
      C.code ? 0 : (C.rooms || []).map(r => r.code + r.members), C.roomsErr, C.relay, C.code ? nearShown() : [(C.near || []).map(r => r.code + r.members + r.name), C.netState, C.nearBusy, C.nearErr, (offer() || {}).code], sharedLine(), sourceLine(), versionNote(), scanNote(), fullNote(), floorNote(), forgetArmed(), freshArmed(), canFresh(), !!(R.saved || R.frame), R.sharedAlign, circlesLocked(), stLocked(sesSt()), peopleAll(),
      C.local, C.code ? 0 : localRooms().map(r => r.code + r.stations), !!R.again, HOST.slides ? HOST.slides.sig() : '', menuHint(), HOST.xr.sig(), showing(), showing() && HOST.panels.sig(showing()),
      PNL.page === 'sound' ? Math.floor(performance.now() / 500) + HOST.audio.pref : '', HOST.curKey, HOST.sfx ? HOST.sfx.sig() : '', HOST.xr.voice ? HOST.xr.voice() : '', HOST.audio.muted, HOST.anchor && HOST.anchor.on, HOST.repeat,
      PNL.code, PNL.pass, PNL.kp && [PNL.kp.title, PNL.kp.value], askFirst(), fpsOn(), MSH.on, SCN.list.join('/'), AUTH.state, AUTH.at, PNL.home, HOME.state, homeOffer(), (r => r.label + !!r.fn)(recenterRow()), PNL.tab, ringsAll(), timeNow(), PNL.tab === 'story' ? !!storyPanels() : '', HOST.occlusion && HOST.occlusion.sig ? HOST.occlusion.sig() : '', PNL.tab === 'debug' ? [FPS.v, Math.round(C.rtt / 10), HOST.shell && HOST.shell.n] : '',
      PNL.tab === 'story' || PNL.tab === 'settings' ? '' : [PNL.gs, guideOn(), (L => L.text + L.c)(lineUp()), checkState().text, CK.arm, CK.self, linedUp(), R.calib && R.calib.step,
        GD.fl, GD.red && GD.red.d, !!GD.ok, PNL.page === 'guide' ? [lineCase(), !!roomMk()] : '']]);
  }
  // the menu's Recenter (the owner, 30 October 2026): as the story panel's (its recenter hook: you in front again, or
  // Place again while anchored); at a station its scene and panel back where the story puts them, for everyone at its
  // circle, greyed while its story is locked (a story without the hook: the station's alone). Greyed away from every
  // station or with no story on show
  function recenterRow() {
    const cur = HOST.cur, own = !!(cur && typeof cur.recenter === 'function');
    if (placing()) return { label: 'Recenter', fn: stLocked(sesSt()) ? null : () => (own ? cur.recenter() : recenterStation()) };
    if (!HOST.session || !own || away()) return { label: 'Recenter', fn: null };
    return { label: HOST.anchor && HOST.anchor.on ? 'Place again' : 'Recenter', fn: () => cur.recenter() };
  }
  // a room by its code (the owner, 30 October 2026: "Joining a room with code not possible in ar/vr?"): a keypad of the
  // 26 letters, the code so far, Delete, Join (three letters) and Back; joined as a code typed on a page is (a code with
  // no room says so on the menu, as on the page). In a room it joins another one
  function codePage(S, x, y, w) {
    const ctx = S.ctx, code = PNL.code || '', bw = (w - 16) / 2;
    ctx.font = FONT(28, 700); ctx.fillStyle = INK; ctx.fillText(C.code ? 'Join another room' : 'Join a room by its code', x, y); y += 42;
    ctx.font = FONT(21); ctx.fillStyle = MUTED;
    y += wrapText(ctx, 'Its three letters, as a screen\'s Shared dialog shows them, or a link after #s=' + (C.code ? '. You leave room ' + C.code + '.' : '.'), x, y, w, 28, 2) + 14;
    for (let i = 0; i < 3; i++) {   // the code: three boxes, the next one lit
      const bx = x + i * 112;
      rr(ctx, bx, y, 96, 96, 12); ctx.fillStyle = i === code.length ? 'rgba(70,217,255,0.20)' : 'rgba(149,166,189,0.13)'; ctx.fill();
      if (i === code.length) { ctx.lineWidth = 2; ctx.strokeStyle = CYAN; ctx.stroke(); }
      ctx.font = FONT(56, 700); ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(code[i] || '', bx + 48, y + 50);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    }
    y += 116;
    const kw = (w - 60) / 7, kh = 66;   // seven keys to a row
    for (let i = 0; i < 26; i++) {
      const ch = String.fromCharCode(65 + i);
      button(S, 'key:' + ch, x + (i % 7) * (kw + 10), y + Math.floor(i / 7) * (kh + 10), kw, kh, ch, code.length < 3 ? () => { PNL.code = (PNL.code || '') + ch; } : null, { px: 30 });
    }
    y += 4 * (kh + 10) + 8;
    const ok = code.length === 3 && code !== C.code;
    button(S, 'code:del', x, y, bw, 60, 'Delete', code ? () => { PNL.code = code.slice(0, -1); } : null);
    button(S, 'code:join', x + bw + 16, y, bw, 60, ok ? 'Join ' + code : 'Join', ok ? () => { PNL.page = 'main'; PNL.code = ''; log('code', { code }); join(code); } : null, { primary: ok });
    y += 76;
    button(S, 'code:back', x, y, bw, 58, 'Back', () => { PNL.page = 'main'; PNL.code = ''; }, { px: 23 });
    return y + 58 + 24;
  }
  // the relay's password (relay --token, COLLAB_TOKEN; the owner, 3 November 2026), in place of the rest of the Circles tab
  // as the code's page: what is typed so far, a keypad of the 26 lower-case letters and the ten digits (headsets cannot
  // type, and the password is case-sensitive: whoever runs the relay picks a lower-case word with digits), Delete, Use
  // (greyed while nothing is typed) and Back; a refusal is said here. Kept on this headset once the relay accepts it
  function passPage(S, x, y, w) {
    // (the offered relay's, while no relay wants one: PNL.home; homeTry instead of authTry)
    const home = !!PNL.home && !authAsk() && !!homeOffer(), at = home ? homeOffer() : AUTH.at;
    const ctx = S.ctx, t = PNL.pass || '', bw = (w - 16) / 2, checking = home ? HOME.state === 'checking' : AUTH.state === 'checking';
    ctx.font = FONT(28, 700); ctx.fillStyle = INK; ctx.fillText('The relay\'s password', x, y); y += 42;
    ctx.font = FONT(21); ctx.fillStyle = MUTED;
    y += wrapText(ctx, 'Lower-case letters and digits, as whoever runs the relay gave it. This headset keeps it for ' + (at.replace(/^https?:\/\//, '') || 'this relay') + ', so it is entered once' + (home ? ', and its rooms run on that relay.' : '.'), x, y, w, 28, 3) + 14;
    rr(ctx, x, y, w, 80, 12); ctx.fillStyle = 'rgba(70,217,255,0.12)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = CYAN; ctx.stroke();
    ctx.textBaseline = 'middle';
    if (t) { ctx.font = FONT(40, 700); ctx.fillStyle = INK; ctx.fillText(fit(ctx, t, w - 40), x + 20, y + 42); }
    else { ctx.font = FONT(24); ctx.fillStyle = MUTED; ctx.fillText('Type it below', x + 20, y + 42); }
    ctx.textBaseline = 'top';
    y += 96;
    const note = home ? homeLine() : AUTH.state === 'need' ? '' : authLine();
    if (note) { ctx.font = FONT(23, 700); ctx.fillStyle = checking ? MUTED : '#ffb43b'; y += wrapText(ctx, note, x, y, w, 30, 2) + 10; }
    const keys = 'abcdefghijklmnopqrstuvwxyz0123456789', kw = (w - 80) / 9, kh = 64;   // nine keys to a row
    for (let i = 0; i < keys.length; i++) {
      const ch = keys[i];
      button(S, 'pk:' + ch, x + (i % 9) * (kw + 10), y + Math.floor(i / 9) * (kh + 10), kw, kh, ch, t.length < 64 ? () => { PNL.pass = (PNL.pass || '') + ch; } : null, { px: 30 });
    }
    y += 4 * (kh + 10) + 8;
    const ok = !!t && !checking;
    button(S, 'pass:del', x, y, bw, 60, 'Delete', t ? () => { PNL.pass = t.slice(0, -1); } : null);
    button(S, 'pass:use', x + bw + 16, y, bw, 60, checking ? 'Checking...' : 'Use', ok ? () => (home ? homeTry(t) : authTry(t)) : null, { primary: ok });
    y += 76;
    button(S, 'pass:back', x, y, bw, 58, 'Back', () => { PNL.page = 'main'; PNL.pass = ''; PNL.home = false; }, { px: 23 });
    return y + 58 + 24;
  }
  // A keypad for a word (HOST.collab.keypad({ title, hint, value, max }): a promise of the text typed, or null), in place
  // of the tab shown: headsets cannot type, so pages that need a name (the studio's scenes) ask the shell. The text so far,
  // the 26 lower-case letters and the ten digits, space, '_', '.' and '-', Delete, OK (greyed while there is nothing but
  // spaces) and Back. OK gives the text as typed; Back, another tab, the menu closing, another keypad or the session's end
  // give null. The menu opens for it (and closes after it, when it was closed before); it does not close by itself while
  // the keypad waits
  const KP_KEYS = 'abcdefghijklmnopqrstuvwxyz0123456789';
  function keypad(o) {
    o = o && typeof o === 'object' ? o : {};
    return new Promise(res => {
      if (!HOST.session || !R.session || !OV.root || !OV.root.parent) { res(null); return; }   // (no headset menu to show it)
      const close = PNL.kp ? PNL.kp.close : !PNL.open, max = Math.max(1, Math.min(200, Math.floor(+o.max) || 60));   // (one waiting: its own close carried over)
      menuOpen(true, 'keypad');   // (cancels a keypad already waiting)
      PNL.kp = { title: String(o.title || 'Type a word').slice(0, 80), hint: String(o.hint || '').slice(0, 240), value: String(o.value || '').slice(0, max), max, res, close };
      log('keypad', { title: PNL.kp.title });
      if (OV.panel) OV.panel.sig = '';
    });
  }
  // the keypad's answer (null: cancelled), given once
  function kpEnd(v) {
    const K = PNL.kp;
    if (!K) return null;
    PNL.kp = null;
    log('keypad done', { ok: v !== null });
    try { K.res(v); } catch (e) { /* the asker's */ }
    if (OV.panel) OV.panel.sig = '';
    return K;
  }
  function kpDone(v) { const K = kpEnd(v); if (K && K.close) menuOpen(false, 'keypad'); }
  function keyPage(S, x, y, w) {
    const ctx = S.ctx, K = PNL.kp, t = K.value, bw = (w - 16) / 2, more = t.length < K.max, add = ch => (more ? () => { K.value = (K.value + ch).slice(0, K.max); } : null);
    ctx.font = FONT(28, 700); ctx.fillStyle = INK; ctx.fillText(fit(ctx, K.title, w), x, y); y += 42;
    if (K.hint) { ctx.font = FONT(21); ctx.fillStyle = MUTED; y += wrapText(ctx, K.hint, x, y, w, 28, 3) + 14; }
    rr(ctx, x, y, w, 80, 12); ctx.fillStyle = 'rgba(70,217,255,0.12)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = CYAN; ctx.stroke();
    ctx.textBaseline = 'middle';
    if (t) { ctx.font = FONT(40, 700); ctx.fillStyle = INK; ctx.fillText(fit(ctx, t.replace(/ /g, '\u00a0') + '|', w - 40), x + 20, y + 42); }
    else { ctx.font = FONT(24); ctx.fillStyle = MUTED; ctx.fillText('Type it below', x + 20, y + 42); }
    ctx.textBaseline = 'top';
    y += 96;
    const kw = (w - 80) / 9, kh = 64;   // nine keys to a row, then space and the three signs
    for (let i = 0; i < KP_KEYS.length; i++) {
      const ch = KP_KEYS[i];
      button(S, 'kp:' + ch, x + (i % 9) * (kw + 10), y + Math.floor(i / 9) * (kh + 10), kw, kh, ch, add(ch), { px: 30 });
    }
    y += 4 * (kh + 10);
    const sw = 3 * kw + 20;
    button(S, 'kp:space', x, y, sw, kh, 'space', add(' '), { px: 26 });
    ['_', '.', '-'].forEach((ch, i) => button(S, 'kp:' + ch, x + sw + 10 + i * (kw + 10), y, kw, kh, ch, add(ch), { px: 34 }));
    y += kh + 18;
    const ok = !!t.trim();
    button(S, 'kp:del', x, y, bw, 60, 'Delete', t ? () => { K.value = K.value.slice(0, -1); } : null);
    button(S, 'kp:ok', x + bw + 16, y, bw, 60, 'OK', ok ? () => kpDone(t) : null, { primary: ok });
    y += 76;
    button(S, 'kp:back', x, y, bw, 58, 'Back', () => kpDone(null), { px: 23 });
    return y + 58 + 24;
  }
  // the room setup guide (the owner, 2 November 2026: a group starts a shared room from zero and knows whether the headsets
  // line up; 3 November, part of every headset's start, on two fixed spots: the startup flow, GD): four pages in place of
  // the rest of the Circles tab, with Back, Next and Close (Skip for now while the flow shows it), the step's text short
  // and plain, a drawing where it helps, and over them a live status (the room, this headset's lineUp, the headsets lined
  // up and checked). Line up and Check say what this headset needs now (lineCase, roomMk)
  const GUIDE_T = ['Before you start', 'Line up', 'Check that you line up', 'Not lined up?'];
  function guidePage(S, x, y, w) {
    const ctx = S.ctx, k = Math.max(0, Math.min(GUIDE_T.length - 1, PNL.gs | 0)), bw = (w - 16) / 2, b3 = (w - 32) / 3;
    const para = (s, col, px) => { ctx.font = FONT(px || 22); ctx.fillStyle = col || INK; y += wrapText(ctx, s, x, y, w, Math.round((px || 22) * 1.32), 5) + 12; };
    const cal = !!R.calib, calBtn = (xx, ww, primary) => button(S, 'guide:cal', xx, y, ww, 60, cal ? 'Stop calibrating' : 'Calibrate', guideCal, { primary: primary && !cal, on: cal, px: 23 });
    const turn = n => () => { GD.touched = true; PNL.gs = n; };
    ctx.font = FONT(28, 700); ctx.fillStyle = INK; ctx.fillText('Room setup', x, y);
    ctx.font = FONT(21); ctx.fillStyle = MUTED; ctx.textAlign = 'right'; ctx.fillText(`Step ${k + 1} of ${GUIDE_T.length}`, x + w, y + 6); ctx.textAlign = 'left';
    y += 42;
    ctx.font = FONT(25, 700); ctx.fillStyle = CYAN; ctx.fillText(fit(ctx, GUIDE_T[k], w), x, y); y += 42;
    y = guideStatus(ctx, x, y, w) + 18;
    if (k === 0) {
      para('Each Quest scans this room once: Settings, Physical space, Space setup (with Physical space features on).');
      para('Every headset: the same Quest Browser version, the same bookmarked address, the same Wi-Fi.');
      para('Two tape crosses on the floor, A and B, about 2 m apart (1 m at least; an arrow from A to B helps). Every headset calibrates on them and checks on them, the controller\'s tip on the floor: they set the room and its floor.');
      drawTape(ctx, x, y, w, 150); y += 168;
    } else if (k === 1) {
      // Line up: what to do now (lineCase), and why after a check that was out
      const c = lineCase(), L = lineUp(), red = GD.red;
      if (red && c !== 'calib') para(red.spot === 'p' ? `Your last check was ${Math.round(red.d * 100)} cm out against someone else's tip.` : red.spot === 'e' ? 'You said the orange crosses are not on your spots.' :
        `Your last check: spot ${red.spot.toUpperCase()} was ${Math.round(red.d * 100)} cm from where this headset puts it.`, RED);
      if (c === 'calib') {
        para(R.calib.step === 'a' ? 'Hold your controller pointing down, the bright ring at its tip on spot A on the floor: hold still and pull the trigger.' : 'Now spot B on the floor, a metre or more from A: hold still and pull the trigger.');
        calBtn(x, bw, false); y += 76;
      } else if (c === 'check') {
        para(L.h === 'marks' ? 'Lined up from the room\'s two spots. Now check it: one touch on spot A.' : 'Lined up from the room\'s two spots, through the shared space. Now check it: one touch on spot A.');
        button(S, 'guide:tocheck', x, y, bw, 60, 'Check', turn(2), { primary: true, px: 23 });
        calBtn(x + bw + 16, bw, false); y += 76;
      } else if (c === 'room') {
        para('This room has two spots, A and B: tape crosses on the floor. Calibrate on them: hold your controller pointing down, its tip on spot A, and pull the trigger; then spot B.');
        drawTape(ctx, x, y, w, 120); y += 136;
        calBtn(x, bw, true); y += 76;
        para('Spots gone? Put two new tape crosses on the floor and calibrate on them: they become the room\'s, and the others calibrate on them too.', MUTED, 21);
      } else if (c === 'first') {
        para('This room has no spots yet, and this headset is its first. Put two tape crosses on the floor, at least 1 m apart, about 2 m is best. Hold your controller pointing down, its tip on spot A, and pull the trigger; then spot B.');
        drawTape(ctx, x, y, w, 120); y += 136;
        calBtn(x, bw, true); y += 76;
        para('They set the room and its floor for everyone, today and next time: the other headsets calibrate on the same two spots.', MUTED, 21);
      } else {   // 'none': no spots yet, another headset is first
        para(L.k === 'ok' ? 'No spots in this room yet: the first headset picks them, then everyone calibrates on them. Lined up through the shared space for now: check it with someone.' :
          'No spots in this room yet. Put two tape crosses on the floor, about 2 m apart, and calibrate on them: they become the room\'s, and the others calibrate on them too.');
        button(S, 'guide:tocheck', x, y, bw, 60, 'Check with someone', L.k === 'ok' ? turn(2) : null, { primary: L.k === 'ok', px: 23 });
        calBtn(x + bw + 16, bw, L.k !== 'ok'); y += 76;
      }
      if (L.k === 'no' && c === 'none') { button(S, 'guide:fix', x, y, bw, 58, 'What to do', turn(3), { px: 23, color: '#ffb43b' }); y += 74; }   // (with spots: Calibrate is what to do)
    } else if (k === 2) {
      // Check: on its own at the room's spot A (or B) once the room has its spots; with someone always
      if (roomMk()) {
        para('Press Check at A, then put the bright ring at your controller\'s tip on spot A on the floor (not on an orange cross), hold still and pull the trigger. Spot B works too.');
        y = selfRow(S, x, y, w);
        para('Or with someone: both touch one spot, and each presses Check here within 20 s of the other.', MUTED, 21);
        y = checkRow(S, x, y, w, 'guide:check', true);
      } else {
        para('Lined up is what the app believes, so check it. A quick look: everyone\'s name tag floats just above their real head.');
        para('Touch the spot: two people hold a controller\'s tip on one spot, one after the other (or touch tips), and each presses Check here within 20 s of the other. Once the room has its two spots, one touch on spot A is enough.');
        drawTips(ctx, x, y, w, 150); y += 168;
        y = checkRow(S, x, y, w, 'guide:check');
      }
    } else {
      para('1. Re-align: the shared space is asked for again and the room\'s frame taken again. Then check again.');
      button(S, 'guide:realign', x, y, bw, 58, R.again ? 'Re-aligning...' : 'Re-align', R.session && !cal ? () => realignNow() : null, { on: !!R.again, px: 23 });
      button(S, 'guide:again', x + bw + 16, y, bw, 58, 'Check again', turn(2), { px: 23 });
      y += 76;
      para('2. Calibrate on the two spots, on every headset: the bright ring at the controller\'s tip on spot A on the floor, hold still, pull the trigger; then spot B. Nothing overrides it, and it is found again next time.');
      calBtn(x, bw, false);
      y += 76;
      const fr = canFresh(), fa = freshArmed();
      para('3. Still out: check that each headset has scanned this room and runs the same browser version. Then a fresh shared space: everyone leaves AR, one headset enters first, the others after Room ready.');
      if (fr) { button(S, 'guide:fresh', x, y, bw, 58, fa ? 'Sure? Press again' : 'Fresh shared space', freshAsk, { px: 22, color: fa ? '#ffb43b' : undefined, on: fa }); y += 76; }
      else { ctx.font = FONT(21); ctx.fillStyle = MUTED; y += wrapText(ctx, 'A fresh shared space needs the laptop relay serving this page.', x, y, w, 28, 2) + 14; }
    }
    // Back, Next (Done on the last page: back to the Circles tab) and Close (Skip for now while the startup flow shows it)
    y += 4;
    const last = k === GUIDE_T.length - 1;
    button(S, 'guide:back', x, y, b3, 60, 'Back', k ? turn(k - 1) : null, { px: 23 });
    button(S, 'guide:next', x + b3 + 16, y, b3, 60, last ? 'Done' : 'Next', last ? guideClose : turn(k + 1), { primary: k === 0 || last, px: 23 });
    if (GD.fl === 1) button(S, 'guide:skip', x + 2 * (b3 + 16), y, b3, 60, 'Skip for now', guideClose, { px: 22 });
    else button(S, 'guide:close', x + 2 * (b3 + 16), y, b3, 60, 'Close', guideClose, { px: 23 });
    return y + 60 + 26;
  }
  // the guide's live status, in a box: the room, how this headset lines up (in its colour), the headsets lined up and
  // checked, and a note that matters (another browser version here, no room scan)
  function guideStatus(ctx, x, y, w) {
    const L = lineUp(), [n, of, ck] = linedUp(), note = L.k === 'ok' || L.k === 'wait' ? versionNote() || scanNote() : '', h = note ? 162 : 132;
    rr(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(149,166,189,0.10)'; ctx.fill();
    ctx.font = FONT(21); ctx.fillStyle = MUTED; ctx.fillText(fit(ctx, `Room ${C.code} · ${connLine()}`, w - 32), x + 18, y + 14);
    ctx.fillStyle = luCol(L); ctx.beginPath(); ctx.arc(x + 28, y + 61, 9, 0, 2 * Math.PI); ctx.fill();
    ctx.font = FONT(24, 700); ctx.fillText(fit(ctx, L.text || 'Lining up with the room...', w - 66), x + 46, y + 47);
    ctx.font = FONT(21); ctx.fillStyle = MUTED;
    ctx.fillText(fit(ctx, of > 1 ? `Headsets lined up: ${n} of ${of}, ${ck} checked` : 'No other headset in the room yet' + (GD.ok ? ' · checked' : ''), w - 36), x + 18, y + 94);
    if (note) { ctx.fillStyle = '#ffb43b'; ctx.fillText(fit(ctx, note, w - 36), x + 18, y + 124); }
    return y + h;
  }
  // Check at A and Check at B (a check on its own at the room's spot) and what the check says; returns the new y
  function selfRow(S, x, y, w) {
    const ctx = S.ctx, bw = (w - 16) / 2, can = canCheck() && !!roomMk(), cs = checkState();
    for (const [i, sp] of [[0, 'a'], [1, 'b']]) {
      const on = CK.arm && CK.self === sp, A = sp.toUpperCase();
      button(S, 'guide:self' + A, x + i * (bw + 16), y, bw, 64, on ? 'Stop checking' : 'Check at ' + A, on || can ? () => { GD.touched = true; checkArm(!on, sp); } : null,
        { primary: sp === 'a' && can && !CK.arm, on, px: 25 });
    }
    y += 80;
    if (!can && !CK.arm) { ctx.font = FONT(21); ctx.fillStyle = MUTED; y += wrapText(ctx, R.calib ? 'Not while calibrating' : 'Once this headset is lined up', x, y, w, 28, 1) + 10; }
    if (cs.text) { ctx.font = FONT(cs.s === 'done' ? 25 : 22, cs.s === 'done' ? 700 : 400); ctx.fillStyle = cs.col; y += wrapText(ctx, cs.text, x, y, w, cs.s === 'done' ? 33 : 29, 3) + 14; }
    return y;
  }
  // Check here (with someone) and what the check says (the guide's check page; the Debug tab has its own button); returns
  // the new y. quiet: below Check at A and B (not the page's main button; what the check says is said above it)
  function checkRow(S, x, y, w, id, quiet) {
    const ctx = S.ctx, bw = (w - 16) / 2, can = canCheck(), cs = checkState(), on = CK.arm && !CK.self;
    button(S, id, x, y, bw, 64, on ? 'Stop checking' : 'Check here', on || can ? () => { GD.touched = true; checkArm(!on); } : null, { primary: !quiet && !CK.arm && can, on, px: 25 });
    ctx.font = FONT(21); ctx.fillStyle = MUTED;
    wrapText(ctx, on ? 'Touch the spot, hold still, pull the trigger' : can ? 'Then touch the spot and pull the trigger' : R.calib ? 'Not while calibrating' : 'Once this headset is lined up', x + bw + 16, y + 4, bw, 28, 2);
    y += 80;
    if (!quiet && cs.text) { ctx.font = FONT(cs.s === 'done' ? 25 : 22, cs.s === 'done' ? 700 : 400); ctx.fillStyle = cs.col; y += wrapText(ctx, cs.text, x, y, w, cs.s === 'done' ? 33 : 29, 3) + 14; }
    return y;
  }
  // the two spots, A and B, tape crosses on the floor about 2 m apart, with an arrow from A to B (seen from above)
  function drawTape(ctx, x, y, w, h) {
    rr(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(149,166,189,0.08)'; ctx.fill();
    const ax = x + w * 0.24, bx = x + w * 0.76, cy = y + h * (h < 140 ? 0.36 : 0.42), s = h < 140 ? 20 : 26, org = '#ffb43b';
    const tape = c => { ctx.fillStyle = org; ctx.fillRect(c - s, cy - 5, 2 * s, 10); ctx.fillRect(c - 5, cy - s, 10, 2 * s); };
    tape(ax); tape(bx);
    ctx.strokeStyle = org; ctx.lineWidth = 4; ctx.setLineDash([12, 9]);
    ctx.beginPath(); ctx.moveTo(ax + s + 14, cy); ctx.lineTo(bx - s - 26, cy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = org; ctx.beginPath(); ctx.moveTo(bx - s - 10, cy); ctx.lineTo(bx - s - 30, cy - 12); ctx.lineTo(bx - s - 30, cy + 12); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = FONT(h < 140 ? 26 : 32, 700); ctx.fillStyle = INK; ctx.fillText('A', ax, cy + s + 10); ctx.fillText('B', bx, cy + s + 10);
    ctx.font = FONT(20); ctx.fillStyle = MUTED; ctx.fillText('about 2 m', (ax + bx) / 2, cy - (h < 140 ? 34 : 42));
    ctx.fillText(fit(ctx, 'tape crosses on the floor', w * 0.5), (ax + bx) / 2, cy + 18);
    ctx.textAlign = 'left';
  }
  // two controllers held tip to tip just over spot A (seen from the side), the bright ring where the tips meet
  function drawTips(ctx, x, y, w, h) {
    rr(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(149,166,189,0.08)'; ctx.fill();
    const cx = x + w / 2, fy = y + h - 40, ty = fy - 12, org = '#ffb43b';
    ctx.fillStyle = 'rgba(149,166,189,0.45)'; ctx.fillRect(x + 18, fy, w - 36, 2);   // (the floor)
    ctx.fillStyle = org; ctx.fillRect(cx - 40, fy - 5, 80, 5);   // (the tape at mark A)
    ctx.font = FONT(24, 700); ctx.fillStyle = org; ctx.fillText('A', cx + 50, fy - 28);
    // (each controller in its own frame: the tip at the origin, its ring just above it, the handle further up and out)
    const one = (dir, col) => {
      ctx.save(); ctx.translate(cx + dir * 6, ty); ctx.rotate(dir * 0.7);
      ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, -23, 16, 0, 2 * Math.PI); ctx.stroke();
      rr(ctx, -12, -96, 24, 58, 11); ctx.fillStyle = col; ctx.fill();
      ctx.restore();
    };
    one(-1, '#46d9ff'); one(1, '#ff5ad9');
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, ty - 2, 8, 0, 2 * Math.PI); ctx.stroke();
    ctx.font = FONT(20); ctx.fillStyle = MUTED; ctx.textAlign = 'center';
    ctx.fillText(fit(ctx, 'tip to tip over spot A, or one after the other', w - 36), cx, fy + 10); ctx.textAlign = 'left';
  }
  // the menu's Design room and Studio buttons, side by side: each one's label, what a press does (or null: greyed), a note
  // under it and its colour. Outside a room a press opens it; in a room it puts its circle at your feet (pageHere)
  const PAGE_ROW = {
    design: { open: 'Design room', here: 'Design room here', at: 'You are at the props table', what: 'Every story\'s props on one table',
      moves: 'Moves the room\'s props table to your feet', adds: 'The props table as a circle at your feet' },
    studio: { open: 'Studio', here: 'Studio here', at: 'You are in the studio', what: 'Your own models, trigger cubes and sounds',
      moves: 'Moves the room\'s studio to your feet', adds: 'The studio as a circle at your feet', another: 'Another studio circle at your feet' },
  };
  function pageRow(key) {
    const m = meta(key), w = PAGE_ROW[key];
    if (!m || m.unknown) return { label: w.open, fn: null, note: 'Not in this version of the app', col: '' };
    if (!C.code) {
      const at = HOST.curKey === key;
      return { label: w.open, fn: at ? null : () => { menuOpen(false, key); log(key, { open: true }); HOST.go(key); }, note: at ? w.at : w.what, col: m.col };
    }
    const lk = circlesLocked(), has = !!pageOne(key);
    return { label: w.here, fn: lk ? null : () => pageHere(key), note: lk ? 'Not while the circles are locked' : has ? w.moves : key === STUDIO && C.st.some(s => s.story === key && !s.kind) ? w.another : w.adds, col: m.col };
  }
  function drawPanel() {
    const S = OV.panel, sig = panelSig();
    if (sig === S.sig) return;
    S.sig = sig;
    { const c = S.hover ? panelSig(null) : sig; if (c !== S.csig) { S.csig = c; S.cver = (S.cver || 0) + 1; } }   // (what it shows, the light of what is pointed at aside)
    const ctx = S.ctx, W = S.w, x = 34, w = W - 68, bw = (w - 16) / 2, tw = (w - 16 * (TABS.length - 1)) / TABS.length;
    const YOU = 36 + 70 + 46 + 28;   // the You section at the bottom (its label, name, colours and margin): kept free
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, S.h); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    S.regions = [];
    // the header: Menu and the time (the watch's, gone), how it closes again, and Close
    ctx.font = FONT(34, 700); ctx.fillStyle = INK; ctx.fillText('Menu', x, 24);
    { const mw = ctx.measureText('Menu').width; ctx.font = FONT(30); ctx.fillStyle = MUTED; ctx.fillText(timeNow(), x + mw + 22, 27); }
    ctx.font = FONT(20); ctx.fillStyle = MUTED; ctx.fillText(fit(ctx, menuHint(), w - 170), x, 72);
    button(S, 'close', W - 34 - 150, 26, 150, 60, 'Close', () => menuOpen(false, 'close'));
    let y = 118;
    const line = () => { ctx.fillStyle = 'rgba(149,166,189,0.22)'; ctx.fillRect(x, y, w, 2); y += 18; };
    const label = (s, col) => { ctx.font = FONT(22, 700); ctx.fillStyle = col || MUTED; ctx.fillText(s.toUpperCase(), x, y); y += 36; };
    const note = (s, at) => { ctx.font = FONT(21); ctx.fillStyle = MUTED; wrapText(ctx, s, x + bw + 16, at + 2, bw, 28, 2); };   // (beside a button)
    // as tall as what it shows (it hangs from its top edge, so the tabs stay put): the background goes in behind
    const finish = y => {
      const H = Math.min(S.h, Math.ceil(y));
      ctx.globalCompositeOperation = 'destination-over';
      rr(ctx, 0, 0, W, H, 24); ctx.fillStyle = 'rgba(8,15,28,0.95)'; ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      rr(ctx, 1, 1, W - 2, H - 2, 24); ctx.lineWidth = 2; ctx.strokeStyle = C.code ? 'rgba(70,217,255,0.5)' : 'rgba(140,170,210,0.3)'; ctx.stroke();
      showTop(S, H);
      S.tex.needsUpdate = true;
    };
    // the tabs (a press shows the tab's first page; the one used last is kept on this headset)
    TABS.forEach(([k, l], i) => button(S, 'tab:' + k, x + i * (tw + 16), y, tw, 60, l, () => setTab(k), { on: PNL.tab === k, tog: null, px: 24 }));
    y += 76;
    line();
    PNL.mirror = null;
    // a keypad waiting for a word (HOST.collab.keypad), whatever the tab: in place of it
    if (PNL.kp) { finish(keyPage(S, x, y, w)); return; }
    if (PNL.tab === 'story') {
      // the story on show's own two panels (its text and explore panes, its play bar), drawn by the story and shown on
      // planes over this canvas in the room this leaves for them (mirrorStep); pointing there points at the story's
      // panel, so every button and slider works as it does there. None on the Stories screen or away from a station
      const sp = storyPanels(), m = sp && meta(HOST.curKey);
      if (!sp) {
        ctx.font = FONT(24); ctx.fillStyle = MUTED;
        y += wrapText(ctx, away() ? 'No story here yet: walk into a circle to see its story.' : 'No story on show: pick one on the Stories screen first.', x, y, w, 32, 3) + 20;
        finish(y);
        return;
      }
      const L0 = liveSt(), tt = L0 && runs(L0) === HOST.curKey && !L0.kind ? stTitle(L0) : (m && m.title) || '';   // (a studio circle's: its scene)
      ctx.font = FONT(22, 700); ctx.fillStyle = (m && m.col) || MUTED; ctx.fillText(fit(ctx, tt.toUpperCase(), w), x, y); y += 38;
      const hm = w * sp.main.h / sp.main.w, hf = w * sp.foot.h / sp.foot.w;
      PNL.mirror = { x, w, y0: y, hm, hf, gap: 12 };
      y += hm + 12 + hf + 26;
      finish(y);
      return;
    }
    if (PNL.tab === 'settings') {
      // Exit (leave VR or AR), Recenter (as the story panel's: at a station its scene and panel back where the story puts
      // them, for everyone at its circle; greyed while its story is locked) and Anchor (the Stories screen's until v109:
      // the scenes and panels kept at this spot in the room, for every story; anchored, Recenter is Place again. In a
      // shared room the room places everything: there it can be turned off, not on), then the slideshow and Repeat for
      // every story (this headset's own)
      const rc = recenterRow(), b3 = (w - 32) / 3, an = !!(HOST.anchor && HOST.anchor.on);
      button(S, 'exit', x, y, b3, 60, 'Exit', () => { if (HOST.session && HOST.session.end) HOST.session.end(); });
      button(S, 'recenter', x + b3 + 16, y, b3, 60, rc.label, rc.fn);
      if (HOST.anchor) button(S, 'set:anchor', x + 2 * (b3 + 16), y, b3, 60, an ? 'Anchor: on' : 'Anchor: off', an || !C.code ? () => HOST.anchor.set(!an) : null, { on: an });
      y += 76;
      if (HOST.slides) {
        const on = !!HOST.slides.global();
        button(S, 'slides', x, y, bw, 60, on ? 'Slideshow: on' : 'Slideshow: off', () => HOST.slides.setGlobal(!on), { on, px: 23 });
        note('Every story waits at the end of each chapter', y);
        y += 76;
      }
      // Repeat, each press the next (off, all, one): at a story's end the next story (after the last, the first) or the
      // same one again; never at a shared room's circle (a story's end there opens explore mode)
      if (HOST.setRepeat) {
        const rp = /^(all|one)$/.test(HOST.repeat) ? HOST.repeat : 'off', nr = { off: 'all', all: 'one', one: 'off' }[rp];
        button(S, 'set:repeat', x, y, bw, 60, 'Repeat: ' + rp, () => HOST.setRepeat(nr), { on: rp !== 'off', tog: nr === 'off', px: 23 });
        note(C.code ? 'Not in a shared room: a story\'s end opens explore mode there' : { off: 'At a story\'s end: explore mode', all: 'Every story, one after another', one: 'The same story again and again' }[rp], y);
        y += 76;
      }
      // the scenes' small labels and the cards (the story panels, station cards and name tags), each on top, in 3D or hidden
      // (each press the next, from its default: labels on top, cards in 3D; lit while shown, and a press that hides sounds
      // as turning off), free moving and subtitles, for every story; in a room the room's
      const lm = HOST.xr.labels(), cm = cardMode(), fr = HOST.xr.free(), su = HOST.xr.subs(), SAY = { fixed: 'in 3D', hidden: 'hidden', face: 'on top' };
      const nl = { face: 'fixed', fixed: 'hidden', hidden: 'face' }[lm], nc = { fixed: 'face', face: 'hidden', hidden: 'fixed' }[cm];
      button(S, 'labels', x, y, bw, 60, 'Labels: ' + SAY[lm], () => HOST.xr.setLabels(nl), { on: lm !== 'hidden', tog: nl === 'hidden' });
      if (HOST.xr.setCards) button(S, 'cards', x + bw + 16, y, bw, 60, 'Cards: ' + SAY[cm], () => HOST.xr.setCards(nc), { on: cm !== 'hidden', tog: nc === 'hidden' });
      y += 76;
      button(S, 'free', x, y, bw, 60, fr ? 'Moving: free' : 'Moving: facing you', () => HOST.xr.setFree(!fr), { on: fr });
      button(S, 'subs', x + bw + 16, y, bw, 60, su ? 'Subtitles: on' : 'Subtitles: off', () => HOST.xr.setSubs(!su), { on: su });
      y += 76;
      // the frame-rate read-out low in your view (this headset's own, never the room's)
      if (HOST.xr.setFps) {
        const fo = fpsOn();
        button(S, 'fps', x, y, bw, 60, fo ? 'Frame rate: on' : 'Frame rate: off', () => HOST.xr.setFps(!fo), { on: fo });
        note('This headset\'s own: frames a second, triangles and draw calls', y);
        y += 76;
      }
      // your menu shown to the people at your circle while it is open, to explain it to them (this headset's own, never the
      // room's: MSH)
      button(S, 'menushare', x, y, bw, 60, MSH.on ? 'My menu: my circle' : 'My menu: only me', () => setMenuShare(!MSH.on), { on: MSH.on, px: 23 });
      note(!C.code ? 'In a shared room: shown to the people at your circle' : MSH.on ? 'The people at your circle see it while it is open' : 'Only you see it. This headset\'s own', y);
      y += 76;
      // real-world occlusion in AR (occlusion.js): what real things hide (the room scan's walls and furniture, and people,
      // hands and anything moving, from the headset's depth), each press the next; this headset's own, unless the story
      // on show asks for its own (a studio scene)
      if (HOST.occlusion && HOST.occlusion.set) {
        const O = HOST.occlusion, om = O.own(), nx = O.next(om), ov = O.over();
        button(S, 'occl', x, y, w, 60, 'Real world hides: ' + O.say(om), () => O.set(nx), { on: om !== 'off', tog: nx === 'off', px: 23 });
        y += 68;
        ctx.font = FONT(21); ctx.fillStyle = MUTED;
        y += wrapText(ctx, ov ? 'This scene asks for its own: ' + O.say(ov) + '. Yours again in the next story.' : !O.ar() ? 'Only in AR: real things in front of a scene hide it. This headset\'s own.' :
          'Real things in front of a scene hide it, as in the room. This headset\'s own.', x + 4, y, w - 8, 28, 2) + 14;
      }
      // the story on show's panels (shown, controls only, hidden: each press the next), that story's alone; in a room its
      // station's, for everyone at that circle. No row on the Stories screen or away from a station (no story on show)
      const pk = showing(), pm = pk ? HOST.panels.get(pk) : '';
      if (pm) {
        button(S, 'panels', x, y, bw, 60, 'Panels: ' + PANELS_SAY[pm], () => HOST.panels.set(pk, HOST.panels.next(pk)), { on: pm === 'shown' });
        ctx.font = FONT(21); ctx.fillStyle = MUTED;
        wrapText(ctx, C.code ? 'Panels for this circle, the rest for the room' : 'Panels: for ' + ((meta(pk) || {}).title || 'this story') + ' only', x + bw + 16, y + 2, bw, 28, 2);
        y += 76;
      } else if (C.code) {
        ctx.font = FONT(21); ctx.fillStyle = MUTED;
        ctx.fillText(fit(ctx, 'These four and the two sound switches: for everyone here', w), x, y - 4); y += 30;   // (Sound is this headset's own)
      }
      // the sound on this headset (the Sound button's mute: off until turned on, the owner, November 2026: "Default to sound
      // off in all modes"; this headset's own; a press here counts as a tap, so it starts the engines too), then the sound
      // switches for every story: sound effects (sfx.js) and narration on or off (the owner, 30 October 2026); in a room the
      // room's, for everyone in it (pages too), else this headset's own. The effects' volume (each press the next step) is
      // always this headset's own
      const mu = !!HOST.audio.muted;
      button(S, 'set:sound', x, y, bw, 60, mu ? 'Sound: off' : 'Sound: on', () => (HOST.audio.mute ? HOST.audio.mute(!mu) : HOST.audio.toggle()), { on: !mu, px: 23 });
      note(mu ? 'Nothing plays on this headset until it is on' : 'This headset\'s own: narration and effects', y);
      y += 76;
      if (HOST.sfx) {
        const so = HOST.sfx.on(), vo = !HOST.xr.voice || HOST.xr.voice();
        button(S, 'sfx', x, y, bw, 60, so ? 'Sound effects: on' : 'Sound effects: off', () => HOST.sfx.set(!so), { on: so, px: 23 });
        if (HOST.xr.setVoice) button(S, 'voice', x + bw + 16, y, bw, 60, vo ? 'Narration: on' : 'Narration: off', () => HOST.xr.setVoice(!vo), { on: vo, px: 23 });
        y += 76;
        button(S, 'sfxvol', x, y, bw, 60, 'Effects volume: ' + Math.round(HOST.sfx.volume() * 100) + '%', () => HOST.sfx.setVolume(HOST.sfx.nextVolume()), { px: 22 });
        ctx.font = FONT(21); ctx.fillStyle = MUTED; wrapText(ctx, C.code ? 'The volume is this headset\'s own; both switches the room\'s' : 'The volume: this headset\'s own', x + bw + 16, y + 2, bw, 28, 2);
        y += 76;
      }
      // the design room and the studio, side by side: outside a room each opens (the props table, your own scenes); in a
      // room each puts its circle at your feet, facing your way (the room's one moved here when it has one), as Add does:
      // not while the circles are locked. Each one's note under it
      const dz = pageRow(DESIGN), sz = pageRow(STUDIO);
      button(S, 'design', x, y, bw, 60, dz.label, dz.fn, { px: 24, color: dz.col || '#f0d58c' });
      button(S, 'studio', x + bw + 16, y, bw, 60, sz.label, sz.fn, { px: 24, color: sz.col || '#e6d3b8' });
      y += 68;
      ctx.font = FONT(21); ctx.fillStyle = MUTED;
      y += Math.max(wrapText(ctx, dz.note, x + 4, y, bw - 8, 28, 2), wrapText(ctx, sz.note, x + bw + 20, y, bw - 8, 28, 2)) + 14;
      finish(y);
      return;
    }
    if (PNL.tab === 'debug') {
      // Sound check: in place of the rest of the tab
      if (PNL.page === 'sound') { finish(soundPage(S, x, y, w)); return; }
      // the room's alignment: calibrate, re-align, here or elsewhere, the shared space and the frame it rests on
      label('Alignment');
      const cal = R.state === 'mark-a' || R.state === 'mark-b';
      if (!C.code || askHere()) {
        ctx.font = FONT(22); ctx.fillStyle = MUTED;
        ctx.fillText(fit(ctx, !C.code ? 'Only in a shared room: start or join one under Circles.' : 'First answer the question under Circles.', w), x, y); y += 40;
      } else {
        ctx.font = FONT(22); ctx.fillStyle = MUTED;
        ctx.fillText(fit(ctx, C.local ? 'On this headset only: ' + whyLocal() + '.' : here() ? 'You are in the room with the others.' : 'You are elsewhere: the stations stand round you.', w), x, y); y += 36;
        // Calibrate, Re-align (this headset lines up again from the start) and, with others, Check here (Touch the spot:
        // the room setup guide's check) and here or elsewhere (below)
        const b3 = C.local ? bw : (w - 32) / 3, ag = !!R.again;
        if (here()) button(S, 'cal', x, y, b3, 60, cal ? 'Stop calibrating' : 'Calibrate', guideCal, { on: cal, px: C.local ? 24 : 22 });
        else button(S, 'cal', x, y, b3, 60, 'Calibrate', null, { px: 22 });
        button(S, 'realign', x + b3 + 16, y, b3, 60, ag ? 'Re-aligning...' : 'Re-align', R.session && !cal ? () => realignNow() : null, { on: ag, px: C.local ? 24 : 22 });
        if (!C.local) button(S, 'check', x + 2 * (b3 + 16), y, b3, 60, CK.arm ? 'Stop checking' : 'Check here', CK.arm || canCheck() ? () => checkArm(!CK.arm) : null, { on: CK.arm, px: 22 });
        y += 76;
        const cs = C.local ? null : checkState();   // (what the check says: waiting, the distance and its colour)
        if (cs && cs.text) { ctx.font = FONT(21); ctx.fillStyle = cs.col; y += wrapText(ctx, cs.text, x, y, w, 28, 2) + 10; }
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
        if (!C.local) {   // (in the room with the others, or elsewhere: the stations stand round you)
          button(S, 'here', x, y, bw, 56, here() ? 'I am elsewhere' : 'I am in the room', () => setHere(!here()), { px: 21 });
          ctx.font = FONT(21); ctx.fillStyle = MUTED; wrapText(ctx, here() ? 'The steps for lining up: Room setup, under Circles' : 'Elsewhere: nothing to line up', x + bw + 16, y + 2, bw, 27, 2);
          y += 72;
        }
      }
      line();
      // this headset's own: whose figures it draws (people at your circle only, or everyone: for debugging), Sound check
      label('This headset');
      const pa = peopleAll();
      button(S, 'people', x, y, bw, 56, pa ? 'People: everyone' : 'People: same circle', () => setPeopleAll(!pa), { px: 21, on: !pa });
      button(S, 'sound', x + bw + 16, y, bw, 56, 'Sound check', () => { PNL.page = 'sound'; }, { px: 23 });
      y += 72;
      // what to tell someone helping: the release, the room's connection, the browser, the frame rate
      ctx.font = FONT(21); ctx.fillStyle = MUTED;
      for (const l of debugLines()) { ctx.fillText(fit(ctx, l, w), x, y); y += 30; }
      finish(y + 18);
      return;
    }
    // Circles: a room's code typed in (a keypad: headsets cannot type), in place of the rest of the tab
    if (PNL.page === 'code') { finish(codePage(S, x, y, w)); return; }
    // the relay's password likewise (while the relay wants one)
    if (PNL.page === 'pass') { if (authAsk() || (PNL.home && homeOffer())) { finish(passPage(S, x, y, w)); return; } PNL.page = 'main'; PNL.pass = ''; PNL.home = false; }
    // the room setup guide's pages, likewise (only for a headset in the room with the others: else the tab as ever)
    if (PNL.page === 'guide') { if (guideOn()) { finish(guidePage(S, x, y, w)); return; } PNL.page = 'main'; }
    // the shared room: its code, how many are in it, the connection
    const n = C.members.length, title = !C.code ? 'Shared room' : C.local ? `Room ${C.code} · this headset` : `Shared room ${C.code} · ${n} ${n === 1 ? 'person' : 'people'}`;
    ctx.font = FONT(28, 700); ctx.fillStyle = C.code ? CYAN : INK; ctx.fillText(fit(ctx, title, C.code ? w - 216 : w), x, y);
    if (C.code) button(S, 'codepage', x + w - 200, y - 8, 200, 48, 'Another room', () => { PNL.page = 'code'; PNL.code = ''; }, { px: 21 });   // (by its code)
    y += 40;
    ctx.font = FONT(21); ctx.fillStyle = MUTED;
    // (how this headset lines up: here, or in the Room setup row below for a headset in the room with the others)
    ctx.fillText(fit(ctx, C.code ? connLine() + (R.status() && !guideOn() ? ' · ' + R.status() : '') : C.relay ? 'Join others in a room' : 'Place the stories in your room', w), x, y); y += 42;
    if (C.note) { ctx.font = FONT(23); ctx.fillStyle = '#ffb43b'; y += wrapText(ctx, C.note, x, y, w, 31, 3) + 10; }
    // the relay wants its password (no room starts or is joined there without it): its keypad page. A headset that has it
    // already (typed on its 2D page before VR) never sees this
    if (authAsk()) {
      ctx.font = FONT(23); ctx.fillStyle = AUTH.state === 'need' || AUTH.state === 'checking' ? INK : '#ffb43b';
      y += wrapText(ctx, AUTH_TEXT + ' ' + (AUTH.state === 'need' ? 'Enter it once on this headset.' : authLine()), x, y, w, 31, 2) + 10;
      button(S, 'pass', x, y, w, 62, 'Relay password', () => { PNL.page = 'pass'; PNL.pass = ''; PNL.home = false; }, { primary: true, px: 25 });
      y += 78;
    } else if (!C.code && homeOffer()) {
      // the relay this page offers (the main site's), out of a room while no relay is in use: its password, once
      const bad = !!HOME.state && HOME.state !== 'checking';
      ctx.font = FONT(23); ctx.fillStyle = bad ? '#ffb43b' : INK;
      y += wrapText(ctx, bad ? homeLine() : 'Rooms run peer to peer here. With the relay\'s password they run on the relay.', x, y, w, 31, 2) + 10;
      button(S, 'homepass', x, y, w, 62, 'Relay password', () => { PNL.page = 'pass'; PNL.pass = ''; PNL.home = true; }, { px: 25 });
      y += 78;
    }
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
      // (and a room by its code: a keypad, as headsets cannot type)
      const b3 = C.relay ? (w - 32) / 3 : bw;
      button(S, 'start', x, y + 6, b3, 64, C.relay || peerOn() ? 'Start a room' : 'Start a room here', () => create(), { primary: true, px: C.relay ? 22 : 25 });
      button(S, 'codepage', x + b3 + 16, y + 6, b3, 64, 'Join with a code', () => { PNL.page = 'code'; PNL.code = ''; }, { px: C.relay ? 22 : 25 });
      if (C.relay) button(S, 'refresh', x + 2 * (b3 + 16), y + 6, b3, 64, 'Refresh', () => listRooms(), { px: 22 });
      y += 92; line();
    } else if (PNL.page === 'add') {
      label('Add a station here: which story?');
      // (the stories, then the design room, the studio and its relay's scenes, at most SCN_ROWS of them here: all on a page)
      const all = addable(), sc = all.filter(m => m.scene), ad = all.filter(m => !m.scene || sc.indexOf(m) < SCN_ROWS);
      ad.forEach((m, i) => {
        const bx = x + (i % 2) * (bw + 16), by = y + Math.floor(i / 2) * 72;
        button(S, 'add:' + addVal(m), bx, by, bw, 60, addName(m), () => { addOne(addVal(m)); PNL.page = 'main'; }, { color: m.col, px: m.scene ? 22 : 25 });
      });
      y += Math.ceil(ad.length / 2) * 72 + 8;
      if (sc.length > SCN_ROWS) { ctx.font = FONT(21); ctx.fillStyle = MUTED; ctx.fillText(fit(ctx, `And ${sc.length - SCN_ROWS} more scenes: add them from a page's Shared dialog`, w), x, y); y += 36; }
      button(S, 'add:cancel', x, y, 200, 58, 'Cancel', () => { PNL.page = 'main'; });
      y += 82; line();
    } else {
      if (askHere()) {
        // in VR, once per room: are you with the others (calibrate, share their room) or somewhere else?
        label('One question', '#ffb43b');
        ctx.font = FONT(26, 700); ctx.fillStyle = INK; y += wrapText(ctx, 'Are you in the same room as the others?', x, y, w, 34, 2) + 4;
        ctx.font = FONT(21); ctx.fillStyle = MUTED;
        y += wrapText(ctx, 'In this room: calibrate, and the stations stand where the others see them. Somewhere else: they stand round you.', x, y, w, 28, 3) + 12;
        button(S, 'ask:in', x, y, bw, 60, 'In this room', () => setHere(true), { primary: true });
        button(S, 'ask:away', x + bw + 16, y, bw, 60, 'Somewhere else', () => setHere(false));
        y += 84; line();
      }
      // the room setup guide (the steps, the check) and how this headset lines up, in a line beside it
      if (guideOn()) {
        const L = lineUp();
        button(S, 'guide', x, y, bw, 60, 'Room setup', () => guideOpen(PNL.gs, 'hand'), { px: 24 });
        ctx.font = FONT(21, 700); ctx.fillStyle = luCol(L); wrapText(ctx, L.text || 'Lining up with the room...', x + bw + 16, y + 2, bw, 28, 2);
        y += 76;
      }
      label('Stations');
      const mine = C.stById.get(C.mine), arm = mine && armed(mine.id);
      ctx.font = FONT(24); ctx.fillStyle = INK;
      ctx.fillText(fit(ctx, mine ? 'Yours: ' + stTitle(mine) : C.st.length ? (askFirst() ? 'Point at a circle and press to go in' : 'Walk into a circle to see its story') : 'None yet: Arrange all puts every story in front of you', w), x, y); y += 40;
      const lk = circlesLocked();
      button(S, 'move', x, y, bw, 60, 'Move here', mine && !lk ? () => move(mine.id) : null);
      button(S, 'addpage', x + bw + 16, y, bw, 60, 'Add here', lk ? null : () => { PNL.page = 'add'; scenesFetch(); });
      y += 72;
      button(S, 'arrange', x, y, bw, 60, 'Arrange all', lk ? null : () => arrange());
      button(S, 'remove', x + bw + 16, y, bw, 60, arm ? 'Remove for everyone?' : 'Remove', mine && !lk ? () => removeAsk(mine.id) : null, { px: arm ? 21 : 24, color: arm ? '#ffb43b' : undefined, on: arm });
      y += 72;
      // the two locks side by side: the circles (for the whole room) and this story's scene and panels (at a station: for
      // everyone at its circle; never locked with the circles); then every ring at any distance, yours too (this headset's
      // own), and whether the room shows on this network (not locked with the circles)
      const A = liveSt(), L = A && runs(A) ? sesSt() : null, sl = !!L && stLocked(L), ns = nearShown() && !C.local, ra = ringsAll();
      button(S, 'lock', x, y, bw, 56, lk ? 'Circles locked: unlock' : 'Lock circles', () => setLock(!lk), { px: 22, on: lk });
      button(S, 'stlock', x + bw + 16, y, bw, 56, sl ? 'Story locked: unlock' : 'Lock this story', L ? () => setStLock(L.id, !sl) : null, { px: 22, on: sl });
      y += 72;
      // at an All stories circle: its switch (Own stories, or With the room's circles: the room's circle of the story
      // picked here shares its moment; never refused by either lock) and back to its cards, for everyone at the circle
      if (A && A.kind === ALL) {
        button(S, 'allsync', x, y, bw, 56, A.sync ? 'With the room\'s circles' : 'Own stories', () => setAllSync(A.id, !A.sync), { px: 21, on: !!A.sync });
        button(S, 'allback', x + bw + 16, y, bw, 56, 'Back to all stories', runs(A) ? () => allPickAt(A.id, ALL) : null, { px: 21 });
        y += 72;
      }
      button(S, 'rings', x, y, bw, 56, ra ? 'Show all rings: on' : 'Show all rings: off', () => setRingsAll(!ra), { px: 21, on: ra });
      button(S, 'near', x + bw + 16, y, bw, 56, ns ? 'On this network: shown' : 'On this network: hidden', C.local ? null : () => setNear(!nearShown()), { px: 21, on: ns });
      y += 72;
      // the room's circles walked into, or asked first (for everyone here; never refused by either lock)
      const af = askFirst();
      button(S, 'askfirst', x, y, bw, 56, af ? 'Circles: ask first' : 'Circles: walk in', () => setAsk(!af), { px: 21, on: af });
      ctx.font = FONT(21); ctx.fillStyle = MUTED;
      wrapText(ctx, af ? 'For everyone here: press a card or icon to go in; no rings' : 'For everyone here: walk into a circle to go in', x + bw + 16, y + 2, bw, 27, 2);
      y += 72; line();
      if (C.local) {   // nobody else: what a relay would add, and that the room is kept here
        ctx.font = FONT(22); ctx.fillStyle = MUTED;
        y += wrapText(ctx, C.peerFail ? 'Kept on this headset. Once a relay or the peer-to-peer server answers, the room goes there and others can join.' :
          'Kept on this headset. Once a relay answers, the room moves there and others can join.', x, y, w, 30, 2) + 14;
        line();
      } else if (S.h - y - YOU - 26 - 36 >= 38) {   // (as many people as fit above You; none when nothing fits: the title counts them)
        label('People');
        // as many as fit above "You"; the rest as a count
        const fitN = Math.max(1, Math.min(PEOPLE_ROWS, Math.floor((S.h - y - YOU - 26 - 36) / 38))), shown = C.members.length > fitN ? fitN - 1 : fitN;
        for (const m of C.members.slice(0, Math.max(0, shown))) {
          const P = m.id === C.id ? { st: C.mine } : C.pres.get(m.id), s = P && C.stById.get(P.st);
          ctx.fillStyle = m.color || INK; rr(ctx, x, y + 4, 22, 22, 6); ctx.fill();
          ctx.font = FONT(24, m.id === C.id ? 700 : 400); ctx.fillStyle = INK;
          ctx.fillText(fit(ctx, (m.name || 'Someone') + (m.id === C.id ? ' (you)' : ''), 250), x + 36, y);
          ctx.font = FONT(21); ctx.fillStyle = MUTED;
          const bv = m.id === C.id ? BROWSER : (P && P.bv) || '';   // (Quest Browser's version: the same on every headset, or no shared space)
          ctx.fillText(fit(ctx, ({ ar: 'headset', vr: 'headset (VR)', desktop: 'screen' }[m.kind] || '') + (bv ? ' ' + bv : '') + (m.kind !== 'desktop' ? (m.here ? ', here' : ', elsewhere') : '') + (m.host ? ', host' : '') + (s ? ' · ' + stTitle(s) : ''), w - 300), x + 300, y + 2);
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
  // the Debug tab's read-outs
  function debugLines() {
    const sh = HOST.shell || {}, via = C.local ? 'this headset only' : C.via === 'peer' ? 'peer to peer' : C.relay ? 'relay ' + String(C.relay).replace(/^\w+:\/\//, '').replace(/\/.*$/, '') : 'no relay known';
    const ua = (/(Chrome|Firefox|Safari)\/\d+/.exec(navigator.userAgent) || [''])[0];
    return [
      'App: release ' + (sh.n || '?') + ' · rooms ' + FORMAT,
      'Room: ' + (C.code ? C.code + ' · ' + via + ' · ' + connLine() + (C.rtt > 0 ? ' · ' + Math.round(C.rtt) + ' ms' : '') : 'none · ' + via),
      'Browser: ' + (BROWSER ? 'Quest Browser ' + BROWSER : ua || 'unknown'),
      'Frame rate: ' + (FPS.v ? FPS.v + (FPS.v === 1 ? ' frame' : ' frames') + ' a second' : 'measuring...'),
    ].concat(HOST.occlusion && HOST.occlusion.line ? ['Real world: ' + HOST.occlusion.line()] : []);
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
  function connLine() {
    if (C.local) return 'on this device';
    if (C.via === 'peer') {   // (peer to peer: who hosts it)
      if (C.status !== 'open') return C.status === 'refused' ? 'peer to peer · refused' : C.status === 'auth' ? 'peer to peer · waiting for the password' : C.takeover ? 'peer to peer · the host has gone: taking over' : 'peer to peer · connecting...';
      const h = C.members.find(m => m.host);
      return 'peer to peer · ' + (hosting() ? 'hosted here' : h ? 'hosted by ' + (h.name || 'someone') : 'connected');
    }
    return { open: 'connected', connecting: 'connecting...', refused: 'refused', off: 'not connected', auth: 'waiting for the relay\'s password' }[C.status] || C.status;
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

  // notices: a small panel in front of you that closes by itself ("Lined up through the shared space", "Calibrate the room")
  const NOTE = { title: '', text: '', until: 0, sig: '' }, NOTES = [];
  function notice(title, text, ms) {
    // (a soft chime from where it shows, a metre ahead; not again for the same notice within 2 s)
    const t = performance.now();
    if (HOST.session && HD.ok && !(NOTE.title === title && t - (NOTE.at || -1e9) < 2000)) sfx('notice', new THREE.Vector3(0, -0.22, -1).applyQuaternion(HD.q).add(HD.p));
    NOTE.at = t;
    NOTE.title = title; NOTE.text = text || ''; NOTE.until = ms === 0 ? Infinity : t + (ms || 4500);
    NOTES.push({ title, text: NOTE.text }); if (NOTES.length > 8) NOTES.shift();   // (the last few, for tests; kept on this page only)
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

  // ------------------------------------------------- circles asked first --
  // Circles asked first (askFirst, the room's setting): a press on another circle's card, ring or icon asks in a small
  // panel in front of you (the owner, 5 November 2026: "a small panel in front of you with the story's title in its
  // colour, Go in / Not now, gone after 10 s"): put there as it opens, about 0.9 m ahead and a little below your eyes,
  // turned to you, drawn over everything, pointed at by the ray or pressed by the right index fingertip. It goes after
  // ASK.ms, on Not now, when the menu opens, when the circle goes or you are in it, when the switch goes off or the session
  // ends. Go in does what walking into the circle does (choose 'walk', the swell, your presence there), for a story's
  // circle, an All stories circle and Back to the lobby (which ends your station); the story stays at its circle
  const ASK = { id: '', until: 0, ms: 10000, placed: false, poke: { armed: true, hov: null } };
  function askOpen(id) {
    const s = C.stById.get(id);
    if (!s || !HOST.session || !OV.ask) return;
    if (PNL.open) menuOpen(false, 'ask');   // (never both up: the question takes the menu's place)
    ASK.id = id; ASK.until = performance.now() + ASK.ms; ASK.placed = false; OV.ask.sig = ''; ASK.poke.armed = true;
    log('ask open', { st: id });
    sfx('notice', HD.ok ? new THREE.Vector3(0, -0.06, -0.9).applyQuaternion(HD.q).add(HD.p) : null);
  }
  function askClose(why) {
    if (!ASK.id) return;
    log('ask closed', { st: ASK.id, why });
    ASK.id = ''; ASK.poke.hov = null;
    if (OV.ask) { OV.ask.regions = []; OV.ask.sig = ''; OV.ask.mesh.visible = false; }
  }
  function askGo() {
    const s = C.stById.get(ASK.id);
    askClose('go');
    if (!s || !C.code) return;
    C.zone = s.id; C.cand = ''; C.lobbyArm = false;   // (standing in the lobby as you go in somewhere: not taken back there until you step out of it)
    log('zone', { st: s.id, asked: true });
    choose(s.id, 'walk');
    sfx('enter');   // (as walking in: a gentle swell all round you)
  }
  function drawAsk() {
    const S = OV.ask, t = performance.now(), s = ASK.id ? C.stById.get(ASK.id) : null;
    if (ASK.id && (!s || t > ASK.until || !C.code || !askFirst() || s.id === C.live)) askClose(!s ? 'gone' : t > ASK.until ? 'time' : s.id === C.live ? 'in it' : 'off');
    S.mesh.visible = !!ASK.id && (ASK.placed || HD.ok);
    if (!S.mesh.visible) return;
    const m = meta(lookKey(s)) || {}, left = Math.max(1, Math.ceil((ASK.until - t) / 1000)), title = stTitle(s);
    const sig = [s.id, title, S.hover, left].join('|');
    if (sig !== S.sig) {
      S.sig = sig;
      const ctx = S.ctx, W = S.w, col = m.col || CYAN;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, S.h); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      S.regions = [];
      rr(ctx, 3, 3, W - 6, S.h - 6, 24); ctx.fillStyle = 'rgba(8,15,28,0.95)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
      ctx.font = FONT(22, 700); ctx.fillStyle = col; ctx.fillText(fit(ctx, String(m.kick || '').toUpperCase(), W - 60), 30, 26);
      ctx.font = FONT(40, 700); ctx.fillStyle = INK; ctx.fillText(fit(ctx, title, W - 60), 30, 58);
      ctx.font = FONT(22); ctx.fillStyle = MUTED;
      ctx.fillText(fit(ctx, s.kind === LOBBY_ST ? 'Leave your story and see every circle again?' : s.kind === ALL ? 'Go into this circle and choose a story there?' :
        'Go into this circle? Its story plays where the circle is.', W - 60), 30, 114);
      const bw = (W - 60 - 16) / 2;
      button(S, 'ask:go', 30, 156, bw, 76, 'Go in', askGo, { primary: true, px: 30, tog: null });
      button(S, 'ask:not', 30 + bw + 16, 156, bw, 76, 'Not now', () => askClose('not now'), { px: 28, tog: null });
      ctx.font = FONT(19); ctx.fillStyle = FAINT; ctx.fillText(`Closes by itself in ${left} s`, 30, 250);
      S.tex.needsUpdate = true;
    }
    // put there as it opens (it does not follow the head: the ray lands where it aims), turned to you
    if (!ASK.placed && HD.ok) {
      _v.set(0, 0, -1).applyQuaternion(HD.q); _v.y = 0;
      if (_v.lengthSq() < 1e-6) _v.set(0, 0, -1);
      _v.normalize().multiplyScalar(0.9).add(HD.p); _v.y -= 0.06;
      S.mesh.position.copy(_v); S.mesh.lookAt(HD.p); ASK.placed = true;
    }
  }
  // the right index fingertip presses its buttons as it does the menu's (within 1.5 cm of the panel over one, again once
  // pulled back 3 cm; a pinch on the ray at the same button within 0.7 s counts once with it)
  // (the check by eye's panel, below, the same way)
  const pokeAsk = () => pokeSheet(OV.ask, ASK.poke, 'ask');
  function pokeSheet(S, P, what) {
    if (!POKE.ok || !S || !S.mesh.visible) { P.armed = true; P.hov = null; return; }
    const lp = S.mesh.worldToLocal(_v2.copy(POKE.tip)), u = lp.x / S.mw + 0.5, v = 0.5 - lp.y / (S.mw * S.h / S.w), dz = lp.z;
    const on = u >= 0 && u <= 1 && v >= 0 && v <= 1, r = on && dz > -0.03 && dz < 0.05 ? S.at(u * S.w, v * S.vis) : null;
    if (r && r.fn && r.id !== P.hov) sfx('hover', POKE.tip);
    P.hov = r ? r.id : null;
    if (dz > 0.03 || (!on && dz > 0)) P.armed = true;
    else if (P.armed && dz < 0.015 && r && r.fn) { P.armed = false; if (!twice(r.id, 'finger')) { log(what, { id: r.id, by: 'finger' }); const n = sfxN(); r.fn(); S.sig = ''; pressSound(r, n, POKE.tip); } }
  }

  // ------------------------------------------------------ the check by eye --
  // The check by eye (v119; the owner, 6 November 2026: "At the beginning of every session and on wakeup etc we need an
  // alignment flow where it shows the two marks and where it thinks they are in the room and ask the user to align again
  // when they are not there"; "it should run anytime there could be misalignment"). In AR, in a room whose two spots are
  // known (roomMk), whenever the alignment may have slipped (eyeWant: the session's start once lined up by the spots,
  // waking, a reset of the floor, Re-align, the spots' anchors lost or found again, the room's frame jumping by more than
  // 5 cm or 2 degrees or taken from elsewhere), the orange crosses show where this headset puts the two spots and a small
  // panel in front asks: Are both crosses on your spots? Yes stands as a check (GD.ok, how 'e': the startup flow is done,
  // the pages' list says checked by eye); No opens the room setup guide at Line up, to calibrate on the spots (GD.red,
  // spot 'e'). A burst of reasons asks once: EYEQ.quiet ms after the last, at most EYEQ.most ms after the first. Never while
  // calibrating or checking, nor over the menu or the circles question, nor while re-aligning (it waits, and comes back
  // when they are done); a check made since (Check at A or B, with someone) answers it. Its opening by itself follows the
  // guide's (autoGuide). A headset elsewhere, in VR, in a room on this device or one without spots: nothing
  const EYEQ = { due: 0, first: 0, why: '', since: 0, ask: false, placed: false, quiet: 3000, most: 10000, s: null, code: '', poke: { armed: true, hov: null } };
  const EYEQ_WHY = { start: 'A new session.', spots: 'The room has its spots now.', wake: 'The headset was off or asleep.', reset: 'The headset moved its floor.',
    realign: 'Re-aligned.', lost: 'The spots\' anchors were lost.', found: 'The spots\' anchors were found again.', frame: 'The room moved in this headset.' };
  const eyeRoom = () => !!(R.session && C.code && !C.local && kind() === 'ar' && here());
  const eyeCan = () => !!(eyeRoom() && C.welcomed && R.aligned && R.frame && roomMk());
  // a reason to ask (why): the question comes once things settle
  function eyeWant(why) {
    if (!eyeRoom()) return;
    const t = performance.now();
    if (!EYEQ.due) { EYEQ.first = t; if (!EYEQ.ask) EYEQ.since = now(); }
    if (!EYEQ.ask && (!EYEQ.due || why === 'start')) EYEQ.why = why;   // (the first reason of a burst says why; a new session's says it best)
    EYEQ.due = t + EYEQ.quiet;
    log('eye wanted', { why });
  }
  // on show now: asked, and nothing else in the way
  const eyeShown = () => !!(EYEQ.ask && GD.auto && eyeCan() && !R.calib && !R.again && !tipMode() && !PNL.open && !ASK.id && OV.root && OV.root.visible);
  function eyeStep(t) {
    if (EYEQ.s !== R.session || EYEQ.code !== C.code) Object.assign(EYEQ, { s: R.session, code: C.code, due: 0, ask: false, why: '', placed: false });
    if (!eyeRoom()) { EYEQ.due = 0; EYEQ.ask = false; return; }
    if (EYEQ.due && (t >= EYEQ.due || t - EYEQ.first >= EYEQ.most)) { EYEQ.due = 0; if (!EYEQ.ask) EYEQ.chimed = false; EYEQ.ask = true; log('eye asks', { why: EYEQ.why }); }
    if (!EYEQ.ask) return;
    // answered meanwhile by a check made since it was asked for, or the room has no spots (lined up, none known): not asked
    if (GD.ok && GD.ok.at >= EYEQ.since) { EYEQ.ask = false; log('eye answered', { by: GD.ok.how }); return; }
    if (R.aligned && R.frame && !roomMk()) { EYEQ.ask = false; log('eye dropped', { why: 'no spots' }); }
  }
  function eyeYes() {
    EYEQ.ask = false; EYEQ.due = 0;
    CK.res = null; CK.mine = null;   // (by eye now: an older distance would say otherwise)
    log('eye', { said: 'yes', why: EYEQ.why });
    checkDone('e', 0);
    notice('Checked by eye', 'Both crosses on the spots: the room is lined up here.', 3500);
    changed();
  }
  function eyeNo() {
    EYEQ.ask = false; EYEQ.due = 0;
    log('eye', { said: 'no', why: EYEQ.why });
    GD.ok = null; GD.red = { spot: 'e', d: 0 };
    guideOpen(1, 'eye');   // (Line up: calibrate on the room's two spots)
    changed();
  }
  function drawEye() {
    const S = OV.eye, show = eyeShown();
    if (!show) { if (S.mesh.visible) { S.mesh.visible = false; S.regions = []; S.sig = ''; } EYEQ.placed = false; return; }
    const sig = [EYEQ.why, S.hover].join('|');
    if (sig !== S.sig) {
      S.sig = sig;
      const ctx = S.ctx, W = S.w;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, S.h); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      S.regions = [];
      rr(ctx, 3, 3, W - 6, S.h - 6, 24); ctx.fillStyle = 'rgba(8,15,28,0.95)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = AMBER; ctx.stroke();
      ctx.font = FONT(22, 700); ctx.fillStyle = AMBER; ctx.fillText('CHECK BY EYE', 30, 26);
      ctx.font = FONT(38, 700); ctx.fillStyle = INK; ctx.fillText(fit(ctx, 'Are both crosses on your spots?', W - 60), 30, 58);
      ctx.font = FONT(22); ctx.fillStyle = MUTED;
      wrapText(ctx, (EYEQ_WHY[EYEQ.why] || '') + ' The orange crosses show where this headset puts spot A and spot B on the floor.', 30, 110, W - 60, 29, 2);
      const bw = (W - 60 - 16) / 2;
      button(S, 'eye:yes', 30, 180, bw, 76, 'Yes', eyeYes, { primary: true, px: 30, tog: null });
      button(S, 'eye:no', 30 + bw + 16, 180, bw, 76, 'No, calibrate again', eyeNo, { px: 26, tog: null });
      S.tex.needsUpdate = true;
    }
    // put there as it shows, a little nearer than the circles' question and at eye height (the spots are lower down: on
    // the floor); put there again once your head has turned well away from it or you walked off
    if (EYEQ.placed && HD.ok) {
      _v.copy(S.mesh.position).sub(HD.p); const dist = Math.hypot(_v.x, _v.z);
      _v2.set(0, 0, -1).applyQuaternion(HD.q);
      if (dist > 1.6 || Math.abs(Math.atan2(_v.x * _v2.z - _v.z * _v2.x, _v.x * _v2.x + _v.z * _v2.z)) > 0.9) EYEQ.placed = false;
    }
    if (!EYEQ.placed && HD.ok) {
      _v.set(0, 0, -1).applyQuaternion(HD.q); _v.y = 0;
      if (_v.lengthSq() < 1e-6) _v.set(0, 0, -1);
      _v.normalize().multiplyScalar(0.85).add(HD.p); _v.y += 0.02;
      S.mesh.position.copy(_v); S.mesh.lookAt(HD.p); EYEQ.placed = true;
      if (!EYEQ.chimed) { EYEQ.chimed = true; sfx('notice', S.mesh.position); log('eye shown', { why: EYEQ.why }); }   // (once a question, not again as it moves back in front)
    }
    S.mesh.visible = EYEQ.placed;
  }

  // ------------------------------------------------------ the frame rate --
  // The frame-rate read-out (HOST.xr.fps: the menu's Frame rate row, this headset's own, off by default; never the room's):
  // low in your view and a little to the left (FPSV), fixed to the head, over the story and the subtitles and under the
  // menu and the notices, drawn again once a second: frames a second and the time between frames (the mean and the worst
  // of the last second, from the shell's own frame callback), and from the story's frame (HOST.perf in index.html: the
  // renderer's counts while the story's frame loop ran, both eyes, the shell's things in its scene with it) its triangles,
  // draw calls and how long the frame's code took
  const FPSV = { down: 22 * Math.PI / 180, left: 14 * Math.PI / 180, dist: 1 };
  const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _q2 = new THREE.Quaternion();
  const fpsOn = () => !!(HOST.xr && HOST.xr.fps && HOST.xr.fps());
  function drawFps() {
    const S = OV.fps, on = fpsOn() && HD.ok;
    S.mesh.visible = on;
    if (!on) return;
    const st = HOST.perf && HOST.perf.stats(), fresh = !!st && performance.now() - st.at < 2500;
    const l1 = (FPS.v ? FPS.v + ' fps' : 'Measuring') + (FPS.mean ? ` · ${FPS.mean.toFixed(1)} ms a frame, worst ${FPS.worst.toFixed(1)} ms` : '');
    const l2 = fresh ? `${Math.round(st.tri).toLocaleString('en-GB')} triangles · ${Math.round(st.calls)} draw calls · code ${st.js.toFixed(1)} ms` : 'Triangles and draw calls: waiting for the story\'s frames';
    const txt = l1 + '\n' + l2;
    if (txt !== S.text) {
      S.text = txt;
      const ctx = S.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, S.w, S.h); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      rr(ctx, 2, 2, S.w - 4, S.h - 4, 18); ctx.fillStyle = 'rgba(8,15,28,0.8)'; ctx.fill();
      ctx.font = FONT(30, 700); ctx.fillStyle = !FPS.v ? MUTED : FPS.v >= 70 ? '#3ee08f' : FPS.v >= 55 ? '#ffb43b' : '#ff7a59';
      ctx.fillText(fit(ctx, l1, S.w - 44), 22, 18);
      ctx.font = FONT(24); ctx.fillStyle = INK; ctx.fillText(fit(ctx, l2, S.w - 44), 22, 70);
      S.tex.needsUpdate = true;
    }
    _e.set(-FPSV.down, FPSV.left, 0); _q2.setFromEuler(_e);
    S.mesh.quaternion.copy(HD.q).multiply(_q2);
    S.mesh.position.set(0, 0, -FPSV.dist).applyQuaternion(S.mesh.quaternion).add(HD.p);
  }

  // ------------------------------------------------ others' menus at your circle --
  // (MSH, MENUS) every other headset's menu shown to your live station, as the picture they sent, where it floats there (in
  // the room: its top edge's middle at their pose, smoothed as others' moves are, SMOOTH), the picture's own shape; two
  // faces back to back, so it reads the right way round from either side; in the room (depth-tested: what stands in
  // front of it hides it), drawn after the station cards set on top (49) and before the story panels set on top (50), the
  // subtitles, the read-out and your own menu (MSH.order); a tag over it with
  // the person's name by their colour; never pointable. A picture it lacks it asks for (want)
  function drawMenus() {
    const L = liveSt(), t = performance.now();
    menusExpire(t);
    for (const [id, E] of MENUS) {
      const here = !!(L && E.st === L.id && HOST.session);
      if (here && E.n < E.nWant && t - E.asked > MSH.ask) { E.asked = t; menuOut(E.st, { k: 'want', to: id }); }
      if (here && E.img && E.dec !== E.img && !E.decoding) menuDecode(E);
      const o = here && E.drawn ? menuObj(E) : E.o;
      if (!o) continue;
      o.g.visible = here && !!E.drawn;
      if (!o.g.visible) continue;
      const m = member(id) || {}, name = m.name || 'Someone', col = m.color || '#f2f6fc';
      if (o.name !== name || o.color !== col) {
        o.name = name; o.color = col;
        const ctx = o.tagCv.getContext('2d');
        ctx.clearRect(0, 0, 400, 72); rr(ctx, 2, 2, 396, 68, 14); ctx.fillStyle = 'rgba(3,8,16,0.88)'; ctx.fill();
        ctx.fillStyle = col; ctx.fillRect(2, 2, 10, 68);
        ctx.font = FONT(32, 700); ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.fillText(fit(ctx, name + '\'s menu', 360), 26, 38);
        o.tagTex.needsUpdate = true;
      }
      const S = bufAt(E.buf, MIX.menu) || E.pose, w = S.w, h = w * E.ih / E.iw;
      o.g.position.fromArray(S.p); o.g.quaternion.fromArray(S.q).normalize();   // (sent to 4 decimals: made whole again)
      for (const f of [o.front, o.back]) { f.scale.set(w, h, 1); f.position.y = -h / 2; }
      o.tag.position.y = 0.035;
    }
  }
  // a picture as it came (a data URL) into its canvas, its corners cut round as the menu's are
  function menuDecode(E) {
    const src = E.img, im = new Image();
    E.decoding = true;
    im.onload = () => {
      E.decoding = false;
      if (E.img !== src || !im.naturalWidth) return;   // (a newer one came meanwhile: that one next)
      const cv = E.cv || (E.cv = document.createElement('canvas')), W = im.naturalWidth, H = im.naturalHeight, ctx = cv.getContext('2d');
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      ctx.clearRect(0, 0, W, H); ctx.save(); rr(ctx, 0, 0, W, H, 24 * W / 720); ctx.clip(); ctx.drawImage(im, 0, 0); ctx.restore();
      E.dec = src; E.iw = W; E.ih = H; E.drawn = true;
      if (E.o) E.o.tex.needsUpdate = true;
    };
    im.onerror = () => { E.decoding = false; E.dec = src; };
    im.src = src;
  }
  function menuObj(E) {
    if (E.o) return E.o;
    const tex = new THREE.CanvasTexture(E.cv), geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
    const g = new THREE.Group(), front = new THREE.Mesh(geo, mat), back = new THREE.Mesh(geo, mat);
    back.rotation.y = Math.PI;
    const tagCv = document.createElement('canvas'); tagCv.width = 400; tagCv.height = 72;
    const tagTex = new THREE.CanvasTexture(tagCv), tm = new THREE.MeshBasicMaterial({ map: tagTex, transparent: true, depthTest: true, depthWrite: false }), tg = new THREE.PlaneGeometry(0.2, 0.036);
    const tag = new THREE.Group();
    for (const ry of [0, Math.PI]) { const f = new THREE.Mesh(tg, tm); f.rotation.y = ry; tag.add(f); }   // (over the top edge's middle, both ways round)
    g.add(front, back, tag);
    g.traverse(x => { if (x.isMesh) x.renderOrder = MSH.order; });   // (meshes only: a group's renderOrder sorts all it holds first, three.js's groupOrder)
    OV.room.add(g);
    E.o = { g, front, back, tag, tex, tagCv, tagTex, name: null, color: '' };
    return E.o;
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
    // a line's own spoken words (data-say: what a live number would show wrongly; empty, no caption), as the voice says it
    if (el.hasAttribute('data-say')) s = el.dataset.say || '';
    else {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const p = n.parentElement;
        if (!p || p.closest('svg, script, style, button') || p.closest('[data-at]') !== el) continue;
        const x = n.textContent.replace(/\s+/g, ' ');
        if (!x.trim()) { s += ' '; continue; }
        // a bold name into its text: a colon (a bold that starts with a number, not a numbered step's '1 · Copy': a
        // space); a number into its small caption: a space; the items of one list: a comma
        if (lp && lp !== p && /^(B|STRONG)$/.test(lp.tagName) && /^[\p{L}\p{N}(]/u.test(x) && /[\p{L}\p{N})%]$/u.test(s)) s += /^\s*\d/.test(lp.textContent) && !/·/.test(lp.textContent) ? ' ' : ': ';
        else if (lp && lp !== p && p.closest('li') && lp.closest('li') && p.closest('li') !== lp.closest('li') && !/[,.;:!?]\s*$/.test(s)) s += ', ';
        else if (lp && lp !== p && p.tagName === 'SMALL' && /^[\p{L}\p{N}(]/u.test(x) && /[\p{L}\p{N})%]$/u.test(s)) s += ' ';
        s += x; lp = p;
      }
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
  // the caption on show now for the story on show (its hook read, split and timed as above): [text, id], both '' when there
  // is none. The one source of the captions: the headsets' strip (drawSubs) and the page's in focus mode (index.html,
  // through HOST.collab.caption) show the same words at the same moment
  function captionNow(t) {
    let c = null;
    if (HOST.cur && typeof HOST.cur.caption === 'function') { try { c = HOST.cur.caption(); } catch (e) { c = null; } }
    if (c && c.els && c.narrT) { try { return subNow(c, t); } catch (e) { /* none */ } }
    SUB.res[0] = SUB.res[1] = '';
    return SUB.res;
  }
  function drawSubs(dt) {
    const S = OV.sub, on = !!(HOST.xr && HOST.xr.subs && HOST.xr.subs()) && HD.ok && !away(), t = performance.now();
    let want = '', id = '';
    if (on) { const r = captionNow(t); want = r[0]; id = r[1]; }
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
    h.o.copy(o); h.d.copy(d); h.at = performance.now(); h.n = C.frameN; h.near = near != null ? near : Infinity;   // (near: a story panel on the ray)
    (h.hist = h.hist || []).push([h.at, o.x, o.y, o.z]);   // the last half second, for a calibration mark (steady)
    while (h.hist.length && h.at - h.hist[0][0] > 500) h.hist.shift();
    if (!OV.root || !OV.root.visible || !OV.root.parent) return null;
    RC.set(o, d); RC.far = 30;   // a station across a large room can be picked too
    const tip = tipMode();
    const hits = RC.intersectObjects(tip ? OV.hit.filter(m => m === OV.panel.mesh) : OV.hit, false);
    // (the question whether to go into a circle is drawn over everything: on the ray, it is what the ray points at)
    for (const top of [OV.ask.mesh, OV.eye.mesh]) { const ah = hits.findIndex(x => x.object === top); if (ah > 0) hits.unshift(hits.splice(ah, 1)[0]); }
    for (const x of hits) {
      const t = x.object.userData.shell;
      if (!t) continue;
      if (!tip && near != null && x.distance > near && t.kind !== 'ask' && t.kind !== 'eye') break;   // the story's own panel is in front
      // the Story tab: the story's own panel there (the story takes it as its panel, at u, v of its canvas: its buttons,
      // sliders and hover tick as on the panel itself)
      if (t.kind === 'storypanel') { C.hov.set(i, { target: t, at: h.at, p: x.point }); h.hk = ''; return { kind: 'shell', panel: t.which, u: x.uv.x, v: x.uv.y, point: x.point, dist: x.distance }; }
      const S = x.object.userData.sheet, hx = S && x.uv ? x.uv.x * S.w : 0, hy = S && x.uv ? (1 - x.uv.y) * S.vis : 0;
      C.hov.set(i, { target: t, x: hx, y: hy, at: h.at, p: x.point });
      // a soft tick as the pointer comes onto something new: a button of the menu, a station
      const sh = t.kind === 'panel' || t.kind === 'ask' || t.kind === 'eye', r = sh && S ? S.at(hx, hy) : null, key = sh ? (r && r.fn ? t.kind[0] + ':' + r.id : '') : t.kind === 'station' ? 's:' + t.id : t.kind;
      if (key && key !== h.hk) sfx('hover', x.point);
      h.hk = key;
      return { kind: 'shell', point: x.point, dist: x.distance };
    }
    h.hk = '';
    // calibrating (or Touch the spot): the trigger anywhere else takes a mark (or the spot) at the controller's tip
    if (tip) { C.hov.set(i, { target: { kind: R.calib ? 'mark' : 'check' }, at: h.at }); return { kind: 'shell', point: _v2.copy(d).multiplyScalar(0.03).add(o).clone(), dist: 0.03 }; }
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
    if (h.target.kind === 'check') { checkTake(i); return; }   // Touch the spot (its Stop checking still works)
    if (h.target.kind === 'panel') { PNL.used = performance.now(); const r = OV.panel.at(h.x, h.y); if (r && r.fn && !twice(r.id, 'ray')) { log('panel', { id: r.id }); const n = sfxN(); r.fn(); OV.panel.sig = ''; pressSound(r, n, h.p); } }
    else if (h.target.kind === 'ask' || h.target.kind === 'eye') { const S = OV[h.target.kind], r = S.at(h.x, h.y); if (r && r.fn && !twice(r.id, 'ray')) { log(h.target.kind, { id: r.id }); const n = sfxN(); r.fn(); S.sig = ''; pressSound(r, n, h.p); } }
    // a station runs only where it stands: the trigger on its card or ring says so (the grip still moves it); with the
    // circles asked first (the room's setting) it asks, in a small panel in front of you, whether to go in (not your own
    // station, nor the room's arc, which everyone here is at)
    else if (h.target.kind === 'station' && !h.target.live && !MV.src) {
      const s = C.stById.get(h.target.id);
      if (askFirst() && s && s.id !== C.live && !(s.arc && here())) askOpen(s.id);
      else notice('Walk into its circle', 'A story plays where its station stands: walk up to it to see it.', 3500);
    }
  }
  // the right index fingertip presses the open menu's buttons: within 1.5 cm of the panel over one, again once pulled
  // back 3 cm; a pinch on the ray at the button the fingertip has just pressed (or the other way round, within 0.7 s)
  // counts once. (Touching the clock no longer opens the menu: the owner, 31 October 2026, "nur aufmachen mit stick
  // click"; a stick's click or two pinches of the left hand do, below.)
  const POKE = { armed: true, hov: null, ok: false, near: false, tip: new THREE.Vector3() }, LASTP = { id: '', by: '', at: 0 };
  function twice(id, by) {
    const t = performance.now();
    if (LASTP.id === id && LASTP.by !== by && t - LASTP.at < 700) return true;
    Object.assign(LASTP, { id, by, at: t });
    return false;
  }
  function touch(f, local) {
    let src = null;
    POKE.ok = false;
    if (R.session && f && local) {
      try { for (const x of R.session.inputSources) if (x && x.handedness === 'right') { src = x; break; } } catch (e) { /* gone */ }
      if (src && src.hand) {
        let jp = null;
        try { jp = f.getJointPose(src.hand.get('index-finger-tip'), local); } catch (e) { /* not tracked now */ }
        if (jp) { const q = jp.transform.position; POKE.tip.set(q.x, q.y, q.z); POKE.ok = true; }
      }
    }
    poke();
    pokeAsk();
    pokeSheet(OV.eye, EYEQ.poke, 'eye');
  }
  // the menu opens and closes with a click of either stick (xr-standard button 3; no story uses it: they use the stick's
  // axes and button 4), a stick held down as its controller appears being no click. The frame-rate read-out turns on and
  // off with a double press of B or Y (button 5; the owner, 6 November 2026: "Fps counter should start with a hotkey like
  // double press b or y"; no story uses it): two presses of one controller's within BY.gap ms, a button held as its
  // controller appears counting nothing
  const STK = new WeakMap(), BY = { m: new WeakMap(), gap: 400 };
  const pressed = (gp, i) => !!(gp && gp.buttons && gp.buttons[i] && gp.buttons[i].pressed);
  function sticks() {
    let list = [];
    try { list = R.session ? [...R.session.inputSources] : []; } catch (e) { /* gone */ }
    let click = false, twice2 = false;
    const t = performance.now();
    for (const src of list) {
      const gp = src && !src.hand && src.gamepad, b = pressed(gp, 3);
      if (!src) continue;
      const was = STK.get(src);
      STK.set(src, b);
      if (b && was === false) click = true;
      const y = pressed(gp, 5), w = BY.m.get(src) || { b: undefined, at: 0 };
      if (y && w.b === false) { if (w.at && t - w.at < BY.gap) { twice2 = true; w.at = 0; } else w.at = t; }
      w.b = y; BY.m.set(src, w);
    }
    if (click && HOST.session) toggleMenu('stick');   // (both sticks clicked at once: one toggle)
    if (twice2 && HOST.session && HOST.xr && HOST.xr.setFps) {
      const on = !fpsOn();
      HOST.xr.setFps(on);
      log('fps', { on, by: 'B or Y' });
      sfx(on ? 'toggleOn' : 'toggleOff', null);
      notice(on ? 'Frame rate: on' : 'Frame rate: off', on ? 'Press B or Y twice to hide it again.' : 'Press B or Y twice to show it again.', 2500);
      changed();
    }
  }
  // with tracked hands, two quick pinches of the left hand (the clock's) open and close it (the owner, 31 October 2026:
  // "only left double pinch"), but only while its ray points at none of the panels: not at the menu, a station or a
  // story panel (the stories get the pinches too, so two meant for a panel's button stay the button's). The scene
  // counts as nothing: in the flock, the robots and the pass story's sea the scene is everywhere the ray goes, so a
  // double pinch there reaches the story too (two falcons in the flock's explore mode)
  const PINCH = { at: 0, gap: 400 };
  function pinched(e) {
    const src = e && e.inputSource, s = R.session;
    if (!src || !src.hand || src.handedness !== 'left' || !s || !HOST.session) return;
    let i = -1;
    try { i = [...s.inputSources].indexOf(src); } catch (e2) { /* gone */ }
    const t = performance.now(), h = C.rays.get(i), panel = !!h && t - h.at < 250 && h.near < Infinity;
    if (i < 0 || hovOf(i) || panel || tipMode()) { PINCH.at = 0; return; }   // (pointing at a panel: the story's, or the shell's)
    if (PINCH.at && t - PINCH.at < PINCH.gap) { PINCH.at = 0; toggleMenu('pinch'); return; }
    PINCH.at = t;
  }
  function poke() {
    const S = OV.panel;
    if (!POKE.ok || !PNL.open || !OV.panelG.visible) { POKE.armed = true; POKE.hov = null; POKE.near = false; return; }
    const lp = S.mesh.worldToLocal(_v2.copy(POKE.tip)), u = lp.x / S.mw + 0.5, v = 0.5 - lp.y / (S.mw * S.h / S.w), dz = lp.z * OV.panelG.scale.x;
    const on = u >= 0 && u <= 1 && v >= 0 && v <= 1, r = on && dz > -0.03 && dz < 0.05 ? S.at(u * S.w, v * S.vis) : null;
    POKE.near = on && dz > -0.03 && dz < 0.08;   // (a fingertip at the menu: it is in use)
    if (r && r.fn && r.id !== POKE.hov) sfx('hover', POKE.tip);   // (the fingertip over a new button)
    POKE.hov = r ? r.id : null;
    if (dz > 0.03 || (!on && dz > 0)) POKE.armed = true;   // (pulled back, or beside it in front: not from behind)
    else if (POKE.armed && dz < 0.015 && r && r.fn) { POKE.armed = false; PNL.used = performance.now(); if (!twice(r.id, 'finger')) { log('panel', { id: r.id, by: 'finger' }); const n = sfxN(); r.fn(); S.sig = ''; pressSound(r, n, POKE.tip); } }
  }

  // ---------------------------------------------------------- every frame --
  // From the shell's own frame callback in a headset (and from HOST.anchor.frame, which every story calls):
  // the room frame, your head in the room, your station, presence, the sound zone and the overlay
  const HD = { p: new THREE.Vector3(), q: new THREE.Quaternion(), ok: false };
  // the left controller (or hand) in the story's space: whether it is a tracked hand (how the menu opens, and the notices
  // say so) and where its wrist is (a pose only guessed, or none for a moment, keeps the last one for half a second)
  const HAND = { m: new THREE.Matrix4(), c: new THREE.Vector3(), ok: false, at: 0, i: -1, src: null, hand: false };
  function leftHand(f, local) {
    const s = R.session, t = performance.now();
    let src = null, p = null;
    HAND.i = -1;
    if (s && f && local) {
      try { [...s.inputSources].forEach((x, k) => { if (!src && x && x.handedness === 'left') { src = x; HAND.i = k; } }); } catch (e) { /* gone */ }
      if (src && src.hand) try { p = f.getJointPose(src.hand.get('wrist'), local); } catch (e) { /* not tracked now */ }
      else if (src) try { p = f.getPose(src.gripSpace || src.targetRaySpace, local); } catch (e) { /* not tracked now */ }
    }
    HAND.src = src;
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
  }
  function tick(f) {
    const t = performance.now(), dt = Math.min(0.1, (t - (C.tickAt || t)) / 1000);
    C.tickAt = t; C.frameN = (C.frameN || 0) + 1;
    // (the frame rate, and the time between frames: the mean and the worst of each second, for the Debug tab and the
    // frame-rate read-out)
    if (HOST.session) {
      FPS.n++;
      if (FPS.last) { const d = t - FPS.last; FPS.sum += d; FPS.wmax = Math.max(FPS.wmax, d); FPS.k++; }
      FPS.last = t;
      if (t - FPS.t0 >= 1000) {
        FPS.v = FPS.t0 ? Math.round(FPS.n * 1000 / (t - FPS.t0)) : 0;
        FPS.mean = FPS.t0 && FPS.k ? FPS.sum / FPS.k : 0; FPS.worst = FPS.t0 ? FPS.wmax : 0;
        FPS.n = FPS.k = FPS.sum = FPS.wmax = 0; FPS.t0 = t;
      }
    } else FPS.t0 = FPS.last = 0;
    if (C.code) renderStep();   // (the time others' moves are drawn at, smoothed)
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
      allFirst(t);
      arcStep(t);
      presenceOut(t);
    } else if (C.code && R.session) statusOut(t);   // (not lined up yet, or no head pose: the pages' list still hears how it goes)
    if (C.code && R.session) { guideStep(t); eyeStep(t); }
    soundZone();
    // in VR, once per room: the shell's panel opens with its question (in the room with the others, or elsewhere?)
    if (HOST.session && askHere() && PNL.asked !== C.code && OV.root && OV.root.visible) {
      PNL.asked = C.code; menuOpen(true, 'question');
      notice('One question', 'Are you in the same room as the others? Answer in the menu in front of you.', 9000);
    }
    // the first time in a room with no stations yet (nothing to see but the menu): the menu opens by itself, with Arrange
    // all in it (once per room)
    if (HOST.session && C.code && C.welcomed && !C.st.length && PNL.empty !== C.code && OV.root && OV.root.visible && !(C.autoAll && here() && val('allp') === undefined)) { PNL.empty = C.code; menuOpen(true, 'empty'); }   // (not when this headset makes the room's arc in a moment)
    if (MV.src && f) carryStation(f, t);
    if (C.code) { placeSync(dt, t); viewSync(t); }
    leftHand(f, local);
    sticks();
    touch(f, local);
    easeStations(dt);
    drawOverlay(dt);
    menuShareStep(performance.now());   // (your menu shown to your circle: where it now floats)
    pump();
  }
  // your station by where you stand: the nearest within 1.1 m for a second. You stay in its story wherever you walk
  // (the owner, 29 October 2026, after ten headsets: "one should only exit a story when walking into a new circle"): it
  // stays live here, shown, on the station's clock and in step with the room, until you walk into another circle (or
  // leave the room, or a new session starts). A headset that has walked into no circle yet is away (HOST.room.away)
  function zoneStep(t) {
    const x = R.hr.x, z = R.hr.z, dist = s => Math.hypot(s.x - x, s.z - z), ask = askFirst();
    // (circles asked first, the room's setting: walking into a story's circle does nothing, no dwell and no swell; the
    // station you are at is the live one, so walking about with it on enters nothing, and turned off again it is where
    // walking in starts. The lobby alone is still walked into (the owner, 6 November 2026: its ring hidden, "the headsets
    // shall go to the lobby automatically"), once you have stood outside every lobby since Go in last took you somewhere:
    // C.lobbyArm, so Go in pressed while standing in the lobby is not undone a second later)
    if (ask) { const Z0 = C.stById.get(C.zone); if (!(Z0 && Z0.kind === LOBBY_ST && !C.live)) C.zone = C.live; }
    // (the other circles hidden by the studio's scene, hideOthers: none of them walked into, as none is seen, but the
    // lobby, where the headsets charge, and the station you are at)
    let best = null, bd = NEAR;
    const hid = hidingOthers();
    for (const s of C.st) { if (s.id === MV.id || (s.arc && here()) || (ask && s.kind !== LOBBY_ST) || (hid && s.id !== C.live && s.kind !== LOBBY_ST)) continue; const d = dist(s); if (d < bd) { bd = d; best = s; } }   // (the room's arc: not walked into)
    if (ask && !best) C.lobbyArm = true;
    const Z = C.stById.get(C.zone) || C.stById.get(C.live), zd = Z ? dist(Z) : Infinity;   // (the station you are at: walked into, or live here)
    const cand = best && best.id !== (Z && Z.id) && bd < zd && (!ask || C.lobbyArm !== false) ? best.id : '';
    if (cand !== C.cand) { C.cand = cand; C.candAt = t; }
    if (cand && t - C.candAt >= DWELL) {
      C.zone = cand; C.cand = '';
      log('zone', { st: cand });
      choose(cand, 'walk');
      sfx('enter');   // (a gentle swell all round you)
    }
  }
  // The first headset in a room adds an All stories circle right in front of itself (the owner, 2 November 2026: "the
  // default for new shared rooms in ar and vr, placed directly in front of the player"; "rooms started on a laptop do not
  // need it but the first headset should add it"): a headset in the room with the others (AR, or VR answered "in this
  // room"), aligned, in its session, the circles not locked, in a room that has never had one put there by itself (key
  // allp: { by, at }, written in the same batch, so it happens once per room and a removed one does not come back). Its
  // spot 1.2 m ahead of your head along the floor (just outside its 1.1 m: one step forward and you are in it), facing
  // away from you (its cards then float ahead, as on the Stories screen), Own stories. The conditions must hold for a moment (a room refilled after a relay restart comes
  // back empty first), and a page tries it once per room. Since v109 it is the room's arc when the room has no other circle
  // (below), and a page's arc still where the page put it (allp with pg: never moved since) is moved in front of it instead
  // (also after this headset placed it, when a page's arc written at the same moment came after: the page writes its once)
  const AUTO = { ahead: 1.2, hold: 1500 };
  function allFirst(t) {
    const P = val('allp'), A = arcSt(), pg = !!(P && P.pg && A && A.id === ARC.id && !A.x && !A.z && !A.yaw);
    const ok = C.autoAll && C.code && C.welcomed && R.session && R.aligned && R.headOK && here() && !circlesLocked() && (C.allpFor !== C.code || (pg && P.by !== C.id)) &&
      (P === undefined ? !C.st.some(s => s.kind === ALL) : pg) &&   // (one placed by hand already: none more)
      // (not while the startup flow asks this headset, the room's first, to calibrate on two spots, nor while it is about
      // to open and ask so: that calibration moves the room's origin to spot A, and an arc placed before it would end up
      // elsewhere in the real room; Skip places it)
      !((guideShown() || (GD.auto && !GD.fl && guideOn())) && (R.calib || lineCase() === 'first'));
    if (!ok) {
      if (C.allpAt) log('all stories not yet', { aligned: R.aligned, head: R.headOK, here: here(), locked: circlesLocked(), allp: !!P, pg, arc: !!A });   // (it waited, and something changed)
      C.allpAt = 0; return;
    }
    if (!C.allpAt) { C.allpAt = t; return; }
    if (t - C.allpAt < AUTO.hold) return;
    C.allpFor = C.code; C.allpAt = 0;
    // (the room's arc stands where this headset stands, so its cards float as close as on the single-player Stories screen,
    // about 1.25 m ahead; a circle 1.2 m ahead, one step from you)
    const arc = pg || !C.st.length, ahead = arc ? 0 : AUTO.ahead;
    const b = base(), [fx, fz] = fwd(b.yaw), id = ARC.id, x = r3(b.x + ahead * fx), z = r3(b.z + ahead * fz);
    const allp = ['allp', { by: C.id, at: Math.round(now()) }];
    if (pg) publish([['st.' + id, stVal(A, { x, z, yaw: b.yaw })], allp]);
    // (one id for the room's first, so two headsets that place it at the same moment place one circle: the last writer's)
    else publish([['st.' + id, { story: ALL, kind: ALL, sync: false, arc, x, z, yaw: r3(b.yaw) }], allp]);
    log('all stories added', { st: id, x, z, arc, moved: pg });
    sfx('place', roomAt(x, 0.05, z));
  }
  // The room's arc (v109; the owner, 3 November 2026: "Change it so that the room behaves like a shared version of the
  // single player room and the players can move the story arc around by dragging it, change it to a circle once a player
  // places the first other circle or arrange all"). A room starts with one All stories circle, st.all01 with arc: true:
  // the first headset's (allFirst), or a page's at the room's origin when a page starts a room or joins one with no
  // stations (pageArc; allp with pg, so the first headset moves it in front of itself, and once per room as the first
  // headset's is). While it is the room's only station everyone is at it without walking in: every aligned headset in
  // the room with the others (not one elsewhere: it walks in, as into any circle) has it as its live station, so its cards
  // show where it stands (place: the rig at its spot) and a pick there plays for everyone at it (allPickAt), and every page
  // follows it and shows its Stories screen (unless it left it by hand: Stop following, a story of its own). Nothing of it
  // is drawn in a headset at it (drawPreviews: its cards are the circle); the grip on its cards, or in an unseen volume
  // round them (arcHit), carries it for everyone as a station is carried (refused while the circles are locked), and Move
  // here and the page's map move it too. The first other circle (Add, Add here, Design room here, the lobby) or Arrange
  // all writes it with arc: false in the same batch (arcEnd): an ordinary All stories circle where it stands, walk-in from
  // then on; the headsets and pages at it stay with it (a station is left only by walking into another), and a headset
  // that took it as the arc sees its ring while it stands outside it. Removing every other circle leaves it a circle. A
  // room kept from before v109 (all01 without arc) whose only station it is becomes the arc as it is joined, and an arc
  // beside another circle (two writes crossing) becomes a circle
  const ARC = { id: 'all01', hold: 1500,
    // the grip's volume round its cards, in its rig's frame (its spot at eye height, facing its way): from r0 to r1 m from
    // the spot along the floor, within side rad of its facing, from lo to hi m about the eyes, from m along the ray on
    // (generous: the cards may stand in one arc about 2.6 m away or in two rows about 1.25 m away)
    r0: 0.7, r1: 3.1, side: 1.35, lo: -0.95, hi: 0.75, from: 0.25 };
  const arcSt = () => C.st.find(s => s.kind === ALL && s.arc) || null;
  // the arc as a circle where it stands, for the batch that adds the first other circle or arranges all
  function arcEnd() {
    const A = arcSt(), v = A && val('st.' + A.id);
    if (!v || typeof v !== 'object') return [];
    log('arc to circle', { st: A.id });
    return [['st.' + A.id, Object.assign({}, bare(v), { arc: false })]];
  }
  // from the pump, and every frame in a headset
  function arcStep(t) {
    if (!C.code || !C.welcomed) return;
    pageArc(t);
    const A = arcSt();
    if (A && C.st.length > 1) { if (!C.pending.has('st.' + A.id)) publish(arcEnd()); return; }   // (beside another circle: a circle)
    if (!A) {   // (a room kept from before: its first All stories circle, alone, is the arc)
      const s = C.st.length === 1 ? C.st[0] : null, v = s && s.id === ARC.id && s.kind === ALL ? val('st.' + s.id) : null;
      if (v && typeof v === 'object' && v.arc === undefined && !C.pending.has('st.' + s.id)) { log('arc again', { st: s.id }); publish([['st.' + s.id, Object.assign({}, bare(v), { arc: true })]]); }
      return;
    }
    if (HOST.session) { if (R.session && R.aligned && here() && C.live !== A.id) choose(A.id, 'arc'); }
    else if (C.follow !== A.id && C.arcOff !== C.code + '|' + A.id && !C.who) choose(A.id, 'arc');
  }
  // a page that starts a room, or joins one with no stations, makes the arc at the room's origin facing -z (where the
  // headset that made the shared space began, looking ahead), once per room (allp with pg: the first headset moves it
  // in front of itself while it stays there), once the room has been empty for a moment (a room refilled after a relay
  // restart comes back empty first)
  function pageArc(t) {
    const ok = !HOST.session && C.autoAll && C.status === 'open' && !C.st.length && val('allp') === undefined && C.arcFor !== C.code && !circlesLocked();
    if (!ok) { C.arcAt = 0; return; }
    if (!C.arcAt) { C.arcAt = t; return; }
    if (t - C.arcAt < ARC.hold) return;
    C.arcFor = C.code; C.arcAt = 0;
    log('arc added', { st: ARC.id });
    publish([['st.' + ARC.id, { story: ALL, kind: ALL, sync: false, arc: true, x: 0, z: 0, yaw: 0 }], ['allp', { by: C.id, at: Math.round(now()), pg: 1 }]]);
  }
  // the grip of controller i on the arc this headset is at, showing its cards: its ray resting on one of them (the story's
  // panels: near), else passing through the volume round them. { id, p: the point held, in the room, off: that point from
  // the spot along the floor, in the arc's frame [x, z] } (carryStation keeps it under the ray), or null
  function arcHit(i) {
    const A = liveSt(), h = C.rays.get(i);
    if (!A || !A.arc || !cards() || !h || performance.now() - h.at > 250) return null;
    const S = shown(A), c = Math.cos(S.yaw), sn = Math.sin(S.yaw), o = h.o.clone().applyMatrix4(R.mi), d = h.d.clone().transformDirection(R.mi);
    let p = h.near < 12 ? o.clone().addScaledVector(d, h.near) : null;
    for (let k = ARC.from; !p && k <= 6; k += 0.04) {
      const x = o.x + d.x * k - S.x, y = o.y + d.y * k - EYE, z = o.z + d.z * k - S.z, lx = x * c - z * sn, f = -(x * sn + z * c), r = Math.hypot(lx, f);
      if (r > ARC.r0 && r < ARC.r1 && Math.abs(Math.atan2(lx, f)) < ARC.side && y > ARC.lo && y < ARC.hi) p = new THREE.Vector3(S.x + x, EYE + y, S.z + z);
    }
    if (!p) return null;
    const x = p.x - S.x, z = p.z - S.z;
    return { id: A.id, p, off: [x * c - z * sn, x * sn + z * c] };
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
    fx('p.' + C.id, { st: C.mine || '', head, hands, bv: BROWSER, sp: (R.sharedOK && R.sharedId) || '', al: R.aligned && !R.aloneAt ? R.src : '', lu: luOut(), ts: Math.round(now()) });
  }
  // the heads of the people in a headset at this device's live station, this headset's own among them, for a story that
  // reacts to people (the studio's behaviours): { st: { id, x, z, yaw } (the station's spot as this device draws it),
  // list: [{ id, me, head: [x, y, z, qx, qy, qz, qw] in room coordinates, ts: the relay's time it was there }] }, or null
  // (no room, or no live station). Others' from their presence (heard in the last 2 s; a page sends no head), this
  // headset's own as it is now
  function heads() {
    const L = liveSt();
    if (!C.code || !L) return null;
    const S = shown(L), list = [], t = performance.now();
    if (R.session && R.headOK) {   // (this headset in its session, lined up: its head now)
      _q.setFromRotationMatrix(_m.extractRotation(R.mi)).multiply(HD.q);
      list.push({ id: C.id, me: true, head: [R.hr.x, R.hr.y, R.hr.z, _q.x, _q.y, _q.z, _q.w], ts: Math.round(now()) });
    }
    for (const [id, P] of C.pres) {
      if (!P.head || P.st !== L.id || t - P.at > 2000) continue;
      const s = P.buf && P.buf.s.length ? P.buf.s[P.buf.s.length - 1] : null;
      list.push({ id, me: false, head: P.head.slice(), ts: s ? s.ts : Math.round(now()) });
    }
    return { st: { id: L.id, x: S.x, z: S.z, yaw: S.yaw }, list };
  }
  // a headset in a room that is not lined up yet: a presence without a head, once a second, so the pages' list says how it
  // goes (lu) and the others know its browser's version; older pages keep it as they keep a page's
  function statusOut(t) {
    if (t - C.presAt < 1000) return;
    C.presAt = t;
    fx('p.' + C.id, { st: C.mine || '', bv: BROWSER, sp: (R.sharedOK && R.sharedId) || '', al: R.aligned && !R.aloneAt ? R.src : '', lu: luOut(), ts: Math.round(now()) });
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
      drawMenus();   // (the others' menus shown to your circle)
    }
    drawMarks();
    // the menu floats in front of you (FLOAT, floatMenu; carried by the grip, MG). It is drawn first, so it is placed by
    // its height this frame. Without a relay too: a room on this headset places the stories
    const t = performance.now(), atMenu = h => h.target.kind === 'panel' || h.target.kind === 'storypanel';
    OV.panelG.visible = PNL.open && (HD.ok || FLOAT.placed);
    const inUse = OV.panelG.visible && (POKE.near || HOV.some(atMenu) || !!MG.src);
    if (OV.panelG.visible) {
      OV.panel.hover = POKE.hov;
      for (const h of HOV) if (h.target.kind === 'panel') { const r = OV.panel.at(h.x, h.y); if (r) OV.panel.hover = r.id; }
      drawPanel();
      if (!C.code && t - C.roomsAt > 4000) listRooms();
      // in use while a ray or a fingertip is at it, it is carried, or while calibrating (the tip goes to the tape marks);
      // unused for IDLE.ms, it closes by itself, but not while it asks its once-per-room question, nor when it opened by
      // itself (the question, a room with no stations) until it has been used: neither opens again by itself
      if (inUse) PNL.self = false;
      if (inUse || tipMode() || askHere() || PNL.self || PNL.kp) PNL.used = t;   // (nor while its keypad waits for a word)
      else if (t - PNL.used > IDLE.ms) menuOpen(false, 'idle');
    } else if (OV.panel.regions.length) { OV.panel.regions = []; OV.panel.sig = ''; }   // (closed: nothing on it to press)
    if (OV.panelG.visible) { if (MG.src) carryMenu(); else floatMenu(dt, inUse); }
    mirrorStep();
    drawNote(HD.ok ? HD.p : null, HD.q);
    drawSubs(dt);
    // the question whether to go into a circle (its hover: the ray's, else the fingertip's), and the frame rate
    OV.ask.hover = ASK.poke.hov; OV.eye.hover = EYEQ.poke.hov;
    for (const h of HOV) if (h.target.kind === 'ask' || h.target.kind === 'eye') { const S = OV[h.target.kind], r = S.at(h.x, h.y); if (r) S.hover = r.id; }
    drawAsk();
    drawEye();
    drawFps();
    // what the controllers can point at
    OV.hit.length = 0;
    if (OV.ask.mesh.visible) OV.hit.push(OV.ask.mesh);
    if (OV.eye.mesh.visible) OV.hit.push(OV.eye.mesh);
    if (OV.panelG.visible) OV.hit.push(OV.panel.mesh);
    for (const m of Object.values(OV.mirror)) if (m.visible) OV.hit.push(m);   // (the Story tab's: the story's panels)
    if (OV.room.visible) {
      for (const o of OV.cards.values()) if (o.mesh.visible) OV.hit.push(o.mesh, o.back);
      for (const o of OV.rings.values()) {
        if (o.ring.visible && o.ring.userData.shell && !o.noRing) OV.hit.push(o.ring);
        if (o.icon.g.visible && o.icon.k > 0.5 && !o.hid) OV.hit.push(o.ball);
      }
    }
    OV.root.updateMatrixWorld(true);
  }
  // the menu floats in front of you (the owner, 31 October 2026: "just make it float in front of the headset"; 1 November:
  // "further away from the face by default"): put there as it opens (its middle FLOAT.pos.d ahead of your eyes along the
  // floor, FLOAT.pos.h above them; it hangs from its top edge, so the tabs stay put while the tab below them changes
  // height; turned to you about its middle), it stays put while you use it, so the ray lands where it aims, and glides
  // back in front (FLOAT.ease) once your head has turned more than FLOAT.turn from it, walked off, come too near or moved
  // up or down a lot; never while a ray or a fingertip is at it, nor after you have put it somewhere by hand (pinned)
  function floatMenu(dt, inUse) {
    const G = OV.panelG, F = FLOAT;
    G.scale.setScalar(F.scale);
    if (!HD.ok) return;
    _v.set(0, 0, -1).applyQuaternion(HD.q);
    const hy = Math.atan2(-_v.x, -_v.z), h = menuH();
    const want = () => {
      F.at.set(-Math.sin(hy), 0, -Math.cos(hy)).multiplyScalar(F.pos.d).add(HD.p);
      F.at.y += F.pos.h + h / 2;   // (its top edge, from which it hangs)
      return F.at;
    };
    if (!F.placed) {
      G.position.copy(want()); menuFace(); F.placed = true; F.glide = false; F.y = HD.p.y; return;
    }
    if (!F.glide && !inUse && !F.pinned) {
      const dx = G.position.x - HD.p.x, dz = G.position.z - HD.p.z, dist = Math.hypot(dx, dz);
      let da = Math.atan2(-dx, -dz) - hy; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > F.turn || dist > F.far || dist < F.near || Math.abs(HD.p.y - F.y) > F.rise) F.glide = true;
    }
    if (F.glide) {
      const W = want(), k = 1 - Math.exp(-dt * F.ease);
      G.position.lerp(W, k); menuFace(); F.y = HD.p.y;
      if (G.position.distanceTo(W) < 0.01) F.glide = false;
    }
  }
  const menuH = () => OV.panel.mw * OV.panel.vis / OV.panel.w * FLOAT.scale;   // (the menu's height now, m)
  // turned to your eyes about its middle (upright: its top edge level)
  function menuFace() {
    const G = OV.panelG;
    if (!HD.ok) return;
    _v2.copy(G.position); _v2.y -= menuH() / 2;
    G.quaternion.setFromRotationMatrix(_m.lookAt(HD.p, _v2, _Y));
  }
  // the grip on the menu (on its canvas or the Story tab's panels) picks it up (MG): it stays where it was on the
  // controller's ray, as far along it as where it was taken, turned to you, and stays where you let go, for the rest of
  // the time it is open (pinned); the distance and height you left it at are where it opens next time (xrMenuAt). From
  // grabStation, before a station is looked for; true if it took the grip
  function grabMenu(e) {
    const s = R.session;
    if (!s || !PNL.open || !OV.panelG.visible || MG.src || !e || !e.inputSource) return false;
    let i = -1;
    try { i = [...s.inputSources].indexOf(e.inputSource); } catch (err) { /* gone */ }
    const h = i >= 0 ? hovOf(i) : null, r = i >= 0 ? C.rays.get(i) : null;
    if (!h || !h.p || !r || !(h.target.kind === 'panel' || h.target.kind === 'storypanel')) return false;
    MG.src = e.inputSource; MG.i = i; MG.at = performance.now();
    MG.dist = h.p.distanceTo(r.o);
    MG.off.copy(OV.panelG.position).sub(h.p);
    FLOAT.glide = false; FLOAT.pinned = true;
    log('menu grab', {});
    pulse(e.inputSource, 0.4, 25);
    sfx('grab', h.p);
    return true;
  }
  function carryMenu() {
    const r = C.rays.get(MG.i);
    let gone = !r || performance.now() - r.at > 500;
    try { gone = gone || ![...R.session.inputSources].includes(MG.src); } catch (e) { gone = true; }
    if (gone) { menuPut(); return; }
    OV.panelG.scale.setScalar(FLOAT.scale);
    OV.panelG.position.copy(r.d).multiplyScalar(MG.dist).add(r.o).add(MG.off);
    menuFace();
    PNL.used = performance.now();
  }
  function menuPut() {
    if (!MG.src) return;
    const G = OV.panelG;
    if (HD.ok) {   // (where it opens next time: its middle's distance along the floor and height from your eyes)
      const d = Math.hypot(G.position.x - HD.p.x, G.position.z - HD.p.z), hh = G.position.y - menuH() / 2 - HD.p.y;
      FLOAT.pos = { d: Math.min(2, Math.max(0.3, d)), h: Math.min(0.6, Math.max(-0.8, hh)) };
      put('xrMenuAt', JSON.stringify({ d: +FLOAT.pos.d.toFixed(3), h: +FLOAT.pos.h.toFixed(3) }));
      FLOAT.y = HD.p.y;
    }
    log('menu put', { d: +FLOAT.pos.d.toFixed(2), h: +FLOAT.pos.h.toFixed(2) });
    pulse(MG.src, 0.25, 15);
    sfx('drop', G.position);
    MG.src = null; MG.i = -1;
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
    scanFloor: null, sfAt: 0,   // the room scan's floor plane over this headset's floor (scanFloorAt; null: none at hand)
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
  // The room's floor under the marks (v122, floor spots; the owner, 7 November 2026: "is it possible to make the floor
  // also set by the two points for calibration? ... the floor was off so many times now in various headsets"). The two
  // spots are tape crosses on the floor, touched with the controller's tip on the floor, so a calibration's floor is the
  // floor under its spots: mark A's touch height less FLOOR_TIP, whatever this headset's own (Guardian) floor says, and
  // every headset that calibrates on the spots gets the same floor. Its saved marks say so (f: 1), and the room's key
  // rm says so to the others ({ a: FLOOR_TIP, d, f: 1 }: older devices read a and d as before, so they get the same
  // floor; no FORMAT change). A calibration from before v122 (no f: its spots may be table corners) keeps the old rule:
  // the first calibration in the room says how high mark A stands over the floor (rm), and a headset whose own floor
  // differs stands the room on the marks instead (its frame's origin that far above its floor); other marks (another
  // distance): its own floor. Headsets lined up through the shared space keep their own floor (reconcile)
  const SAME = 0.1;   // marks measured within 10 cm of the same distance apart are the same marks (touched by hand)
  // the height of the controller's target-ray origin (where a mark is taken) over the floor when its tip touches the
  // floor, held pointing down. A guess until measured on a Quest: the headsets' logs say 'floor spots' with the touch
  // heights over their own floor and, with a room scan, over its floor plane
  const FLOOR_TIP = 0.02;
  // floor spots: at most 4 cm apart in height (the tip's height moves with how the controller is tilted; a guess until
  // tuned from the logs: 'mark refused' and 'floor spots' carry dh). How high spot A stands over this headset's own floor
  // is never limited: a headset's floor that is off, by however much, is what floor spots are for (the owner, 7 November
  // 2026, after a Quest whose floor put spot A 92 cm up was refused by v122's first 45 cm limit)
  const SPOTS_DH = 0.04;
  const onFloor = () => !!(R.saved && R.saved.f);   // this headset's marks are floor spots (a calibration since v122)
  const floorUnder = (a, b) => {
    if (onFloor()) return a[1] - FLOOR_TIP;
    const M = val('rm'); return M && Number.isFinite(M.a) && Math.abs(M.d - Math.hypot(b[0] - a[0], b[2] - a[2])) <= SAME ? a[1] - M.a : 0;
  };
  const fromMarks = (a, b) => ({ o: [a[0], floorUnder(a, b), a[2]], x: level([b[0] - a[0], 0, b[2] - a[2]]) });
  const marksMk = (a, b) => { const y = floorUnder(a, b); return [r3(a[1] - y), r3(Math.hypot(b[0] - a[0], b[2] - a[2])), r3(b[1] - y)]; };
  // our marks set the room's floor (key rm). Floor spots: whenever the room has none, its are not on the floor (no f),
  // other spots (another distance) or whoever set them has left; two headsets on the same spots never write it in turn.
  // Older marks (no f): when nobody's do yet, when the room's are our own older ones or other marks, or when whoever set
  // them has left; never over the room's floor spots while whoever set them is here. Asked when a calibration is made or
  // found again, and twice a second while the room's floor is missing, its writer gone, or (floor spots) not on the floor
  function claimFloor(a, b) {
    const M = val('rm'), d = Math.hypot(b[0] - a[0], b[2] - a[2]), ok = !!(M && Number.isFinite(M.a) && Number.isFinite(M.d)), same = ok && Math.abs(M.d - d) <= SAME;
    const here = ok && (M.by === C.id || member(M.by));
    if (onFloor()) {
      if (ok && M.f && same && here) return;
      publish([['rm', { a: FLOOR_TIP, d: r3(d), f: 1, by: C.id, at: Math.round(now()) }]]);
      log('floor claimed', { a: FLOOR_TIP, d: r3(d), f: 1, was: M ? M.by : '' });
      return;
    }
    if (ok && M.f && here) return;
    if (same && M.by !== C.id && member(M.by)) return;
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
    const was = R.src, old = R.frame;
    if (src !== was) R.wakeHold = 0;
    if (src === 'marks' || src === 'anchor') { R.aloneAt = 0; R.notJoined = false; }
    R.frame = { o: [fr.o[0], Number.isFinite(fr.o[1]) ? fr.o[1] : 0, fr.o[2]], x };
    // a check (Touch the spot) stands for the frame it was made in: another source, or one moved by 5 cm or 2 degrees, needs a new one
    // (and the session's check that stood with it, GD.ok: the guide's flow asks again when the room gets its spots)
    const [fd, fa] = old ? apart(old, R.frame) : [1, 0], moved = src !== was || fd > 0.05 || fa > 0.035 || (!!old && Math.abs(old.o[1] - R.frame.o[1]) > 0.05);
    if ((CK.res || CK.mine || GD.ok || GD.red) && moved) { CK.res = null; CK.mine = null; GD.ok = null; GD.red = null; log('check cleared', { src }); }
    // the check by eye: the room jumped here, or comes from elsewhere now (not the first frame, which the startup flow asks
    // about, nor spots just touched by hand: they are where the tip was)
    if (old && moved && src !== 'marks') eyeWant('frame');
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
      scanAt: 0, scanFrom: performance.now(), scanSeen: false, scanFloor: null, sfAt: 0, scanN: -1, noScan: false, scanTold: false, badSince: 0, tries: 0, retryAt: 0, retryFrom: 0,
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
    eyeWant('reset');
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
      notice('Calibrate again', 'The headset moved its origin while you were calibrating: touch spot A and spot B again.', 9000);
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
      notice('Calibrate again', 'The headset moved its origin (a recentre?) and has no anchors to find the spots by: touch spot A and spot B again.', 9000);
    }
  }
  const savedHandles = () => !!(R.saved && R.saved.anchors.length === 2);
  // this headset's marks are not found in this session (after standby, or the origin moved with no anchors to
  // follow): the frame held so far stays, the orange crosses show, and the panel asks to leave AR and enter it again
  function lostMarks(why) {
    R.showUntil = performance.now() + 30000;
    if (R.reenter) return;
    R.reenter = true; log('marks lost', { why });
    eyeWant('lost');
    notice('Leave AR and enter it again', 'Leave AR and enter it again: the headset finds your spots then (after standby it does not, in the same session). Until then things may stand off the two spots.', 12000);
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
  // the room scan's floor (the lowest plane labelled floor) in this headset's floor's coordinates, read every 2 s while the
  // session has plane detection: logged with floor spots (null: none)
  function scanFloorAt(f, t) {
    if (t - R.sfAt < 2000) return;
    R.sfAt = t;
    const feats = R.session && R.session.enabledFeatures ? [...R.session.enabledFeatures] : [];
    if (!R.floor || !feats.includes('plane-detection')) { R.scanFloor = null; return; }
    let y = null;
    try {
      for (const pl of f.detectedPlanes || []) {
        if (!pl || pl.semanticLabel !== 'floor' || !pl.planeSpace) continue;
        const P = f.getPose(pl.planeSpace, R.floor), py = P && P.transform.position.y;
        if (Number.isFinite(py) && (y === null || py < y)) y = py;
      }
    } catch (e) { /* not now */ }
    R.scanFloor = y;
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
      setFrame(F, 'adopted', again ? 'Re-aligned' : 'Lined up through the shared space', 'This headset took the room from the shared space. Check it: Room setup in the menu (Circles), Touch the spot.');
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
        if (R.tries) { log('anchors found again', { tries: R.tries }); notice('Spots found again', 'The headset found the two spots again: things are back where they were calibrated.', 6000); eyeWant('found'); }
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
  // without anchors: the room's floor (key rm) may change for older marks (floor spots: the floor under them, which
  // stays); the marks stay where they were touched
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
    if (!(GD.auto && eyeCan())) notice('Check the spots', 'The headset was off: the orange crosses should sit on the two spots. If they do not, calibrate again.', 8000);   // (else the check by eye asks)
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
      'The stations stand round you as they stand in the room. In the room with the others after all? Say so in the menu (' + menuWhere() + '), under Debug.');
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
      if (t - R.recAt > 500) { R.recAt = t; followAnchors(f); refloor(); compare(); publishOwn(); if (!validFloor() || !member(val('rm').by) || (onFloor() && !val('rm').f)) claimFloor(...marksNow()); }
      // back from standby (or asked by someone's Re-align): our marks' frame written into the space again once settled
      if (R.refresh && !R.woke && R.shared && R.sharedOK && R.sharedId && settled() && !R.sharedOwn) {
        R.refresh = 0;
        const P = val(kFrame(R.sharedId));
        if (validFrame(P) && P.by === C.id) { R.pubAt = 0; publishFrame('marks', (R.saved && R.saved.at) || 0); }
      }
      if (R.again) {   // Re-align: the marks found again by their anchors (the frame moves to them), or not
        if (R.anchors && R.anchorsOK) { R.again = 0; notice('Re-aligned', 'Found your spots again. Check: the orange crosses sit on the two spots.', 6000); changed(); }
        else if (t - R.again > 10000 || (R.anchorTried && !R.anchorBusy && !R.anchors)) {
          R.again = 0; notice('Spots not found', 'The headset did not find your spots in this session. Leave AR and enter it again: they come back then. If the orange crosses are still off the two spots, calibrate again.', 12000); changed();
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
        setFrame(fromMarks(P[0], P[1]), 'anchor', 'Lined up from the two spots', 'Found the spots this headset saved last time. Check: the orange crosses sit on them.');
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
      const text = 'Calibrated headsets here found that the shared space puts them apart. Calibrate this headset on the room\'s two spots.';
      if (R.again) { R.again = 0; changed(); notice('Shared space not usable', text, 9000); }
      if (!R.frame && R.state !== 'restoring') { setState('calibrate'); if (R.noticed !== 'split') { R.noticed = 'split'; notice('Shared space not usable', text, 9000); } }
      return;
    }
    if (notJoined && R.frame && !R.again) {   // the frame held so far stays (moved by the floor's resets) until it joins
      if (R.wakeHold && R.notJoined && R.noticed !== 'alone') { R.noticed = 'alone'; notice('Not in the shared space', 'Back from standby, this headset has not found the others\' shared space: the room stays where it was. If it looks off, press Re-align, or calibrate on the two spots.', 9000); }
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
      notice(was === 'floor' ? 'Room ready' : 'Re-aligned', 'The room stays where it is, written into this shared space for the others.', 6000); changed();
      return;
    }
    // (3) nobody (still here) published for this space: its own origin, published (unless the others are elsewhere)
    if (sp && (!R.frame || R.again) && !othersElsewhere() && !notJoined) {
      R.mk = null;
      const F = fromShared({ o: [0, 0, 0], x: [1, 0, 0] }), again = !!R.frame;
      F.o[1] = 0; R.hS = -sharedY();   // the space's origin need not lie on the floor: this headset's floor is the room's
      R.again = 0;
      setFrame(F, 'shared', again ? 'Re-aligned' : 'Room ready', 'This headset is the room\'s origin: the others line up through its shared space, one by one.');
    }
    if (sp && R.src === 'shared' && (!validFrame(P0) || stale) && t - R.pubAt > 2000) publishFrame('shared');
    // back from standby: the room's frame, if this headset wrote it, is written into the space again once settled, so
    // the others know it is current (wakeOK)
    if (R.refresh && !R.wakeHold && sp && settled() && !R.sharedOwn && R.src === 'shared' && validFrame(P0) && P0.by === C.id) { R.refresh = 0; R.pubAt = 0; publishFrame('shared'); }
    if (R.again && R.frame) {   // Re-align found nothing better: the frame stays as it was
      R.again = 0; changed();
      if (notJoined) notice('Not in the shared space', 'Check on every headset: the same Quest Browser version, the WebXR experiments flag, Enhanced spatial services, the same address. Then restart both headsets and start one after the other, or calibrate both on the same two spots.', 9000);
      else notice('Nothing to re-align to', C.local ? 'No shared space here: the stations stay where they are. Calibrate on two tape crosses on the floor to keep them in place.' : 'No frame came through the shared space: things stay where they are. Calibrate on the room\'s two spots to line up with the others.', 9000);
      return;
    }
    if (R.again && !R.frame && R.state !== 'restoring') { R.again = 0; changed(); }   // Re-align with no frame: as at the start (below)
    if (!R.frame && R.state !== 'restoring') {
      // on this headset alone there is nobody to line up with: the stations stand on its floor (where the session
      // began) until it is calibrated, which keeps them in place next time
      if (C.local && R.lfOK) { R.mk = null; setFrame({ o: [0, 0, 0], x: [1, 0, 0] }, 'floor', 'On your floor', 'The stations stand where you put them, for this session. To keep them in place next time, calibrate on two tape crosses on the floor (Calibrate, under Debug in the menu).'); return; }
      setState('calibrate');
      if (notJoined && R.noticed !== 'alone') { R.noticed = 'alone'; notice('Not in the shared space', 'Check on every headset: the same Quest Browser version, the WebXR experiments flag, Enhanced spatial services, the same address. Then restart both headsets and start one after the other, or calibrate both on the same two spots.', 9000); }
      else if (!notJoined && R.noticed !== 'calibrate') { R.noticed = 'calibrate'; notice('Calibrate the room', 'Press Calibrate in the menu (' + menuWhere() + '): Room setup, under Circles. Then touch spot A and spot B with a controller\'s tip: two tape crosses on the floor, a metre or more apart.', 9000); }
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
      notice('Lost its place', 'The headset lost its place while it was off: press Re-align in the menu (' + menuWhere() + '), under Debug, or calibrate on the two spots.', 12000);
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
    scanFloorAt(f, performance.now());
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
    CK.arm = false; CK.self = ''; CK.res = null; CK.mine = null; GD.ok = null;   // (a check made before stands for the frame this replaces)
    setState('mark-a');
    notice('Calibrate the room', 'Hold a controller pointing down, the bright ring at its tip on spot A, the tape cross on the floor: hold still and pull the trigger.', 0);
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
    CK.res = null; CK.mine = null; GD.ok = null; GD.red = null;   // (a check stands for the frame it was made in)
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
    CK.res = null; CK.mine = null; GD.ok = null; GD.red = null;   // (the room setup guide: Re-align, then check again)
    eyeWant('realign');   // (by eye too, once it has re-aligned: EYEQ waits while R.again)
    if (R.sharedId) fx('q.frame', { id: R.sharedId });   // whoever wrote the room's frame writes it into the space again
    if (!here()) { R.again = 0; R.frame = null; R.src = ''; R.aligned = false; notice('Re-aligned', 'The stations stand round you again, as they stand in the room.', 5000); changed(); return; }
    reshared('realign');
    if (own()) {
      if (R.saved && R.saved.anchors.length === 2) { releaseAnchors(); Object.assign(R, { anchorTried: false, anchorBusy: false, tries: 0, retryAt: 0, retryFrom: 0 }); }   // found again by their saved handles
      else { R.again = 0; notice('No anchors to look for', 'This calibration has no saved anchors. If the orange crosses are off the two spots, calibrate again.', 9000); }
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
    if (R.notJoined) return 'Not in the others\' shared space: restart both headsets, or calibrate both on the same two spots';
    if (!R.sharedAlign && !own()) return 'Shared space switched off here: switch it on, or calibrate';
    if (!own() && R.sharedId && splitHere()) { const Q = val(kSplit(R.sharedId)); return `The shared space puts calibrated headsets here ${Math.round(Q.d * 100)} cm apart: calibrate on the two spots`; }
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
    if (M && Number.isFinite(M.d) && Math.abs(M.d - d) > SAME) return `Your marks are ${Math.round(Math.abs(M.d - d) * 100)} cm ${d > M.d ? 'further apart' : 'closer'} than the room's: other spots?`;
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
    if (R.calib.step === 'a') { R.calib.a = p; R.calib.step = 'b'; setState('mark-b'); notice('Spot A taken', 'Now spot B on the floor, a metre or more from A (about 2 m is best): the ring at the tip on it, hold still and pull the trigger.', 0); return; }
    const a = R.calib.a, dx = p.x - a.x, dz = p.z - a.z, dh = p.y - a.y;
    if (Math.hypot(dx, dz) < 0.5) { notice('Spots too close', 'Spot B must be at least 50 cm from spot A (a metre or more is better). Touch spot B again.', 0); return; }
    // both on the floor, so as high as each other: one higher is a tip held off the floor, or a spot that is not on it
    if (Math.abs(dh) > SPOTS_DH) {
      log('mark refused', { why: 'heights', a: r3(a.y), b: r3(p.y), dh: r3(dh) });
      R.calib = { step: 'a', a: null }; setState('mark-a');
      notice('Spots at different heights', `Spot B is ${Math.round(Math.abs(dh) * 100)} cm ${dh > 0 ? 'higher' : 'lower'} than spot A. Both spots must be on the floor: touch them again, the controller's tip on the floor.`, 0);
      return;
    }
    R.calib = null;
    dropAnchors();   // the old marks' anchors go now: they would pull the new frame back to the old marks
    R.mgen++; R.anchorBusy = false; R.tries = 0; R.retryAt = 0; R.retryFrom = 0; R.reenter = false; R.afterSleep = false;
    R.saved = { v: 2, a: a.toArray().map(r3), b: p.toArray().map(r3), at: Math.round(now()), anchors: [], f: 1 };   // (f: floor spots)
    storeSaved();   // kept once its anchors are made
    // the touch heights over this headset's floor and over the room scan's floor plane, to measure FLOOR_TIP and the
    // headsets' floors from the logs later
    const sf = R.scanFloor;
    log('floor spots', { a: R.saved.a[1], b: R.saved.b[1], dh: r3(dh), scan: sf === null ? null : [r3(a.y - sf), r3(p.y - sf)], tip: FLOOR_TIP });
    claimFloor(R.saved.a, R.saved.b);
    R.mk = marksMk(R.saved.a, R.saved.b); R.cmp = null; R.pubAt = 0; R.recAt = 0;
    setFrame(fromMarks(R.saved.a, R.saved.b), 'marks', 'Room calibrated', 'The orange crosses should sit on the two spots, and the room\'s floor on the floor. Everyone who calibrates on the same spots sees the stations in the same places.' + (guideOn() ? ' Now check it: Check at A, in the menu.' : ''));
    R.wantAnchors = true;   // made in the next frame, at the marks as they are then
  }
  function status() {
    if (!C.code) return '';
    if (!R.session) return kind() === 'desktop' ? '' : 'starting';
    return { waiting: 'asking the headset...', 'shared-wait': 'lining up with the room...', restoring: 'finding last time\'s marks...',
      adopted: 'lined up through the shared space', shared: 'room ready (its origin)', marks: 'lined up from your two spots',
      anchor: 'lined up from your two spots', own: 'elsewhere: the room is round you', calibrate: 'not lined up: calibrate', floor: 'on your floor (this session)',
      'mark-a': 'touch spot A', 'mark-b': 'touch spot B' }[R.state] || R.state;
  }

  // ===================================================== the room setup guide ==
  // The owner, 2 November 2026: a guided room setup and an alignment check, so a group can start a shared room from zero
  // and know whether the headsets line up. lineUp says in plain words what the alignment above rests on (how it works does
  // not change). "Lined up" is only what the app believes, so Touch the spot (CK) checks it: two people hold a controller's
  // tip on the same spot (the cross at mark A, or their tips together) and each takes it within CK.win of the other; each
  // headset sends where its room puts that spot (q.check: a one-off message, as q.frame is, nothing stored) and both show
  // how far apart the two are. How it lines up and the last check ride on presence (lu) for the pages' list; older
  // devices ignore the field (no FORMAT change)
  const LU_WHY = { space: 'no shared space', other: 'not in the others\' shared space', split: 'the shared space puts headsets apart',
    scan: 'no room scan', version: 'another Quest Browser version', off: 'shared space switched off', marks: 'its spots not found this session',
    none: 'nothing to line up with', time: 'nothing after 20 s', eye: 'its crosses off the spots, by eye' };
  const GREEN = '#3ee08f', AMBER = '#ffb43b', RED = '#ff6b6b';
  // Touch the spot: ok and red (m) the limits of green and amber; win (ms) how far apart in time two checks pair; late (ms)
  // how long after entering AR a headset not lined up gets the guide's last page; arm: the next trigger takes the spot;
  // self: armed for a check on its own at the room's spot 'a' or 'b' ('' with someone); mine: this headset's last check
  // with someone ({ p in room coordinates, at in relay time, n, with: whom it paired with }); theirs: the others' last ones
  // (used: paired with one of mine); res: the last result ({ d m, by, at; spot: a check on its own }) until the next check
  // or frame
  const CK = { ok: 0.1, red: 0.25, win: 20000, late: 20000, keep: 300000, armFor: 30000, arm: false, self: '', armAt: 0, mine: null, theirs: new Map(), res: null, n: 0 };
  const tipMode = () => !!(R.calib || CK.arm);   // (the trigger takes the controller's tip: a mark, or the spot)
  // the room's frame came from a headset with another Quest Browser version (two versions never shared one space)
  const otherVersion = () => { const P = R.sharedId ? val(kFrame(R.sharedId)) : null, W = validFrame(P) && P.by !== C.id ? C.pres.get(P.by) : null; return !!(BROWSER && W && W.bv && W.bv !== BROWSER); };
  // how this headset lines up with the room, in plain words: k 'ok' (lined up), 'wait' (lining up), 'no' (not lined up, w
  // says why: LU_WHY, or 'check': a check over CK.red), 'away' (elsewhere: nothing to line up), 'alone' (a room on this
  // headset), 'off' (no room, no session); h how ('origin': its shared space's origin is the room's, 'shared': taken through
  // the shared space, 'marks': its own tape marks); c the last check's distance in cm while it stands
  function lineUp() {
    const o = { k: 'off', h: '', w: '', c: null, text: '' };
    if (!C.code || !R.session) return o;
    if (askHere()) return Object.assign(o, { k: 'wait', w: 'ask', text: 'First the question: in this room, or somewhere else?' });
    if (!here()) return Object.assign(o, { k: 'away', text: 'Elsewhere: the stations stand round you' });
    if (C.local) return Object.assign(o, { k: 'alone', h: own() ? 'marks' : '', text: own() ? 'On this headset only, from your two spots' : 'On this headset only: nobody to line up with' });
    if (R.calib) return Object.assign(o, { k: 'wait', w: 'calib', text: R.calib.step === 'a' ? 'Calibrating: touch spot A' : 'Calibrating: touch spot B' });
    const late = !!GD.from && performance.now() - GD.from > CK.late, split = !!R.sharedId && splitHere();
    let k = 'wait', h = '', w = '';
    if (R.aligned && R.frame && own()) { h = 'marks'; if (R.reenter) w = 'marks'; }
    else if (R.aligned && R.frame && (R.src === 'shared' || R.src === 'adopted')) {
      h = R.src === 'shared' ? 'origin' : 'shared';
      w = R.notJoined ? 'other' : split ? 'split' : R.src === 'adopted' && R.noScan ? 'scan' : R.src === 'adopted' && otherVersion() ? 'version' : '';
    } else if (R.state === 'restoring' && !late) {   // its own tape marks still being found: lining up
    } else {   // not lined up yet: a reason known now, else after 20 s
      w = !R.sharedAlign ? 'off' : R.sharedNo ? 'space' : R.notJoined ? 'other' : split ? 'split' : '';
      if (!w && (late || R.state === 'calibrate')) w = R.noScan ? 'scan' : versionNote() ? 'version' : othersElsewhere() ? 'other' : late ? 'time' : 'none';
    }
    if (h) k = w ? 'no' : 'ok'; else if (w) k = 'no';
    // a check is the better word: within the limits lined up (whatever was doubted), beyond them not
    if (CK.res && (performance.now() - CK.res.t > CK.keep || /^(split|other|marks|version|scan)$/.test(w))) CK.res = null;
    const r = h && CK.res;
    if (r) { o.c = Math.round(r.d * 100); if (r.d > CK.red) { k = 'no'; w = 'check'; } else { k = 'ok'; w = ''; } }
    else if (h && GD.red && GD.red.spot === 'e') { k = 'no'; w = 'eye'; }   // (No, said to the check by eye: the crosses are off the spots)
    o.k = k; o.h = h; o.w = w;
    o.text = k === 'ok' ? { origin: 'Room ready: this headset is the room\'s origin', shared: R.mk ? 'Lined up from the room\'s spots (shared space)' : 'Lined up through the shared space',
      marks: R.src === 'anchor' ? 'Lined up from the room\'s spots, found again' : 'Lined up from the two spots you touched' }[h] :
      k === 'wait' ? (R.state === 'restoring' ? 'Lining up: finding your spots again...' : 'Lining up with the room...') : w === 'check' ? `${o.c} cm out: not lined up` :
        w === 'eye' ? 'Not lined up: the crosses are off the spots' : 'Not lined up yet: ' + LU_WHY[w];
    return o;
  }
  const luCol = L => (L.k === 'ok' ? (L.c > CK.ok * 100 ? AMBER : GREEN) : L.k === 'wait' ? CYAN : L.k === 'no' ? (L.w === 'check' || L.w === 'eye' ? RED : AMBER) : MUTED);
  // what goes out with presence: { k, h, w, c (cm, while a check stands), ck (this session's check that stood, green or
  // amber: 'a' or 'b' at that spot, 'p' with someone, 'e' by eye; '' none yet) }
  const luOut = () => { const L = lineUp(), o = { k: L.k, h: L.h, w: L.w, ck: GD.ok ? GD.ok.how : '' }; if (L.c !== null) o.c = L.c; return o; };
  // a person in a headset as the pages' list says it ([colour class, words]): from their presence's lu; an older app sends
  // none, only what aligns it (al) while it is aligned (and no ck: nothing said about a check it may have made)
  function luLine(m, P) {
    const L = P && P.lu, how = L && { origin: 'the room\'s origin', shared: 'shared space', marks: 'the room\'s spots' }[L.h];
    const at = L && (L.ck === 'a' || L.ck === 'b') ? ' at spot ' + L.ck.toUpperCase() : '';
    const chk = !L ? '' : Number.isFinite(L.c) ? `checked ${L.c} cm${at}` : L.ck === 'e' ? 'checked by eye' : L.ck ? 'checked' : L.ck === '' ? 'not checked yet' : '';
    if (!L && m.here === false) return ['away', 'elsewhere: nothing to line up'];
    if (!L) return P && P.al ? ['ok', 'lined up (' + ({ adopted: 'shared space', shared: 'the room\'s origin', marks: 'the room\'s spots', anchor: 'the room\'s spots' }[P.al] || P.al) + ')'] : ['wait', 'no word yet (lining up, or an older app)'];
    if (L.k === 'ok') return [L.c > CK.ok * 100 ? 'mid' : 'ok', (L.h === 'origin' ? 'room ready (' : 'lined up (') + [how, chk].filter(Boolean).join(', ') + ')' + (L.c > CK.ok * 100 ? ': fine for walking about; calibrate on the spots for close work' : '')];
    if (L.k === 'wait') return ['wait', L.w === 'calib' ? 'calibrating on the spots...' : L.w === 'ask' ? 'answering: in this room, or somewhere else?' : 'lining up...'];
    if (L.k === 'no') return ['bad', L.w === 'check' ? `not lined up (checked ${L.c} cm out${at})` : 'not lined up' + (LU_WHY[L.w] ? ' (' + LU_WHY[L.w] + ')' : '')];
    if (L.k === 'away') return ['away', 'elsewhere: nothing to line up'];
    return ['wait', 'starting...'];
  }
  // the headsets in the room with the others (this one too), and how many of them are lined up, and lined up and checked
  // this session: [lined up, headsets, checked]
  function linedUp() {
    let n = 0, of = 0, ck = 0;
    for (const m of C.members) {
      if ((m.kind !== 'ar' && m.kind !== 'vr') || m.here === false) continue;
      of++;
      const me = m.id === C.id, P = me ? null : C.pres.get(m.id), ok = me ? lineUp().k === 'ok' : /^(ok|mid)$/.test(luLine(m, P)[0]);
      if (ok) n++;
      if (ok && (me ? !!GD.ok : !!(P && P.lu && (P.lu.ck || Number.isFinite(P.lu.c))))) ck++;
    }
    return [n, of, ck];
  }
  const whoName = id => (member(id) || {}).name || 'someone';
  const canCheck = () => !!(guideOn() && R.aligned && R.frame && !R.calib);
  // the room's two spots in room coordinates, as this headset puts them: [height of A, A to B, height of B] (spot A at the
  // origin and B on the x axis: a frame from the spots has its origin at spot A and its x axis towards B). This headset's
  // own spots, or those of the frame it took through the shared space (R.mk), else the room's (key rm: spot A's height
  // over the room's floor and how far apart the two are; B as high as A); null: the room has no spots yet
  function roomMk() {
    if (R.mk && R.mk.length === 3 && R.mk.every(Number.isFinite) && (own() || R.src === 'adopted')) return R.mk;
    if (!validFloor()) return null;
    const M = val('rm');
    return [M.a, M.d, M.a];
  }
  // this headset's frame rests on the room's spots: its own (touched, or found again by their anchors), or taken through
  // the shared space from a headset that calibrated on them
  const byMarks = () => !!(R.aligned && R.frame && R.mk && (own() || R.src === 'adopted'));
  // the room has its two spots (someone calibrated on them: key rm), or this headset is lined up by them
  const roomSpots = () => validFloor() || byMarks();
  // Check here: the next trigger (not on the menu) takes the spot where the controller's tip is held still, as a calibration
  // mark is taken (steady); pressed again, it stops. spot 'a' or 'b': a check on its own at the room's spot A or B (once
  // the room's spots are known: selfCheck), else Touch the spot with someone
  function checkArm(on, spot) {
    on = !!on;
    const self = on && (spot === 'a' || spot === 'b') ? spot : '';
    if (on && (!canCheck() || (self && !roomMk()))) return;
    if (on === CK.arm && self === CK.self) return;
    CK.arm = on; CK.armAt = on ? performance.now() : 0; CK.self = self;
    log('check', { arm: on, self });
    // (the orange crosses hide while it is armed: the tip goes to the spot itself, not to where this headset puts it)
    if (on && self) notice('Touch spot ' + self.toUpperCase(), `Put the bright ring at your controller's tip on spot ${self.toUpperCase()} itself (the tape cross on the floor), hold still and pull the trigger.`, 0);
    else if (on) notice('Touch the spot', 'Put the bright ring at your controller\'s tip on the spot (spot A, or the other person\'s tip), hold still and pull the trigger.', 0);
    else checkNoteOff();
    changed();
  }
  function checkTake(i) {
    const h = C.rays.get(i);
    if (!CK.arm || !h || !R.aligned) return;
    const p = steady(h).applyMatrix4(R.mi), self = CK.self;   // (the controller's target-ray origin held still, in room coordinates)
    CK.arm = false; CK.self = ''; CK.res = null;
    if (self) { selfCheck(p, self); return; }
    CK.mine = { p: [r3(p.x), r3(p.y), r3(p.z)], at: Math.round(now()), t: performance.now(), n: ++CK.n, with: new Set() };
    fx('q.check', { p: CK.mine.p, at: CK.mine.at, n: CK.mine.n });
    log('check taken', { p: CK.mine.p, n: CK.n, at: CK.mine.at });
    if (!checkPair()) notice('Spot taken', `Waiting for someone else to press Check here, within ${Math.round(CK.win / 1000)} s.`, 4000);
    changed();
  }
  // a check on its own (the guide's Check page): the tip held still on the room's spot A (or B) against where this headset
  // puts that spot (roomMk), with the limits and words of Touch the spot. Green or amber: lined up, and the startup flow is
  // done; red: back to Line up, to calibrate on the spots. Nothing is sent: it pairs with nobody
  function selfCheck(p, spot) {
    const mk = roomMk();
    if (!mk) return;
    const q = spot === 'b' ? [mk[1], mk[2], 0] : [0, mk[0], 0], d = Math.hypot(p.x - q[0], p.y - q[1], p.z - q[2]), cm = Math.round(d * 100), S = spot.toUpperCase();
    const h = Math.abs(p.y - q[1]), hp = hPart(h);   // (the height part: this headset's floor against the room's, as a rule)
    CK.mine = null;
    CK.res = { d, h, by: '', spot, at: Math.round(now()), t: performance.now() };
    log('check self', { spot, d: r3(d), h: r3(h), p: [r3(p.x), r3(p.y), r3(p.z)], q: q.map(r3), src: R.src });
    if (d <= CK.ok) { notice(`Lined up: ${cm} cm${hp}`, `Your tip on spot ${S}, and where this headset puts it.`, 6000); checkDone(spot, d); }
    else if (d <= CK.red) { notice(`${cm} cm out${hp}`, 'Fine for walking about; calibrate on the spots for close work.', 9000); checkDone(spot, d); }
    else { notice(`${cm} cm out${hp}: not lined up`, `Spot ${S} is ${cm} cm from where this headset puts it: calibrate on the room's two spots (Line up, in the menu).`, 9000); checkRed(spot, d); }
    changed();
  }
  // the height part of a check's distance, said when it is 2 cm or more: the spots are on the floor, so it is mostly how
  // this headset's floor differs from the room's (one lined up through the shared space keeps its own floor)
  const hPart = h => (Number.isFinite(h) && Math.round(h * 100) >= 2 ? ` (${Math.round(h * 100)} cm in height)` : '');
  // another headset's check (q.check, with who sent it as the relay says)
  function checkIn(v, by) {
    if (!v || typeof by !== 'string' || by === C.id || !Array.isArray(v.p) || v.p.length !== 3 || !v.p.every(c => Number.isFinite(c) && Math.abs(c) < 1e4) || !Number.isFinite(v.at)) return;
    CK.theirs.set(by, { p: v.p.slice(), at: v.at, t: performance.now() - Math.max(0, now() - v.at), used: false });
    log('check in', { by });
    if (R.session) checkPair();
    changed();
  }
  // this headset's last check and another's within CK.win of it (the nearest in time; each pairs once with each person):
  // both headsets get the same two points, so both show the same distance. Over CK.red the guide opens again: at Line up
  // once the room has its spots (calibrate on them), else at its last page
  function checkPair() {
    const M = CK.mine;
    if (!M || !R.session) return false;
    let best = null;
    for (const [by, T] of CK.theirs) {
      if (T.used || M.with.has(by) || Math.abs(T.at - M.at) > CK.win || !member(by)) continue;
      if (!best || Math.abs(T.at - M.at) < Math.abs(best[1].at - M.at)) best = [by, T];
    }
    if (!best) return false;
    const [by, T] = best, d = Math.hypot(M.p[0] - T.p[0], M.p[1] - T.p[1], M.p[2] - T.p[2]), cm = Math.round(d * 100), h = Math.abs(M.p[1] - T.p[1]), hp = hPart(h);
    T.used = true; M.with.add(by);
    CK.res = { d, h, by, at: Math.max(M.at, T.at), t: performance.now() };
    log('check result', { with: by, d: r3(d), h: r3(h) });
    if (d <= CK.ok) { notice(`Lined up: ${cm} cm${hp}`, `Where your room and ${whoName(by)}'s put the spot.`, 6000); checkDone('p', d); }
    else if (d <= CK.red) { notice(`${cm} cm out${hp}`, 'Fine for walking about; calibrate on the spots for close work.', 9000); checkDone('p', d); }
    else { notice(`${cm} cm out${hp}: not lined up`, roomSpots() ? 'The menu shows what to do: calibrate on the room\'s two spots.' : 'The menu shows what to do: Re-align, then check again; or calibrate on two tape crosses on the floor.', 9000); checkRed('p', d); }
    changed();
    return true;
  }
  // a check that stood (green or amber), with someone ('p') or on its own at a spot ('a', 'b'): this session's (presence's
  // lu.ck, the pages' list) until the frame it was made in changes. The startup flow is done: the guide closes (the menu too,
  // when the flow opened it)
  function checkDone(how, d) {
    GD.ok = { how, d: r3(d), at: Math.round(now()) }; GD.red = null;
    log('guide', { flow: 'done', how, d: r3(d) });
    if (GD.fl === 1 && guideShown()) { if (GD.menu) menuOpen(false, 'guide'); else PNL.page = 'main'; }
    GD.fl = 2; GD.menu = false; GD.cal = -1;
  }
  // a check over CK.red: no check of this session stands, and the guide opens again (Line up once the room has its spots,
  // where Calibrate is; else its last page), at once when it is on show
  function checkRed(how, d) {
    GD.ok = null; GD.red = { spot: how, d: r3(d) };
    if (guideOn() && !R.calib) flowAgain(roomSpots() ? 1 : 3, how === 'p' ? 'check' : 'red');
  }
  // what the check says now ({ s, text, col }): 'armed' (touch the spot), 'wait' (taken, waiting for another's: the seconds
  // left), 'late' (nobody else within CK.win), 'done' (the distance, in its colour), 'theirs' (someone else's is waiting for
  // yours), '' nothing. (The seconds left on this headset's own clock: two checks pair by the relay's, checkPair)
  function checkState() {
    const M = CK.mine, t = performance.now(), s = Math.round(CK.win / 1000);
    if (CK.arm) return { s: 'armed', text: CK.self ? `Put the bright ring at your controller's tip on spot ${CK.self.toUpperCase()} itself, hold still and pull the trigger.` : 'Put the bright ring at your controller\'s tip on the spot, hold still and pull the trigger.', col: CYAN };
    for (const [by, T] of CK.theirs) {   // (someone checked after this headset's last check: its turn)
      const left = Math.ceil((CK.win - (t - T.t)) / 1000);
      if (!T.used && left > 0 && member(by) && (!M || T.at > M.at)) return { s: 'theirs', text: `${whoName(by)} pressed Check here: touch the same spot and press it too (${left} s)`, col: CYAN };
    }
    if (CK.res) {
      const d = Math.round(CK.res.d * 100), at = CK.res.spot ? ' at spot ' + CK.res.spot.toUpperCase() : '', hp = hPart(CK.res.h);
      return CK.res.d <= CK.ok ? { s: 'done', text: `Lined up: ${d} cm` + (CK.res.spot ? at : ` (with ${whoName(CK.res.by)})`) + hp, col: GREEN } :
        CK.res.d <= CK.red ? { s: 'done', text: `${d} cm out${at}${hp}: fine for walking about; calibrate on the spots for close work`, col: AMBER } :
          { s: 'done', text: `${d} cm out${at}${hp}: not lined up`, col: RED };
    }
    if (M && !M.with.size) {
      const left = Math.ceil((CK.win - (t - M.t)) / 1000);
      return left > 0 ? { s: 'wait', text: `Waiting for someone else to press Check here (${left} s)`, col: CYAN } :
        { s: 'late', text: `Nobody else pressed Check here within ${s} s: try again together.`, col: AMBER };
    }
    return { s: '', text: '', col: MUTED };
  }
  // the check's notice off (only while it is the one on show: it stands until then)
  const checkNoteOff = () => { if (/^Touch (the )?spot/.test(NOTE.title || '')) NOTE.until = 0; };
  const checkReset = () => { if (CK.arm) checkNoteOff(); CK.arm = false; CK.self = ''; CK.armAt = 0; CK.mine = null; CK.res = null; CK.theirs.clear(); };
  // The startup flow (v109; the owner, 3 November 2026: "just do the calibrated marks but make it part of the startup flow
  // to check and make people check and calibrate if needed"; two fixed spots are more accurate than two people touching
  // controllers; since v122 two tape crosses on the floor, which set the room's floor too). Every time a headset enters AR (or VR, answered "In this room") in
  // a shared room, the guide opens by itself (FLOW.wait in) at Line up: how this headset lines up now and what to do
  // (lineCase): calibrate on the room's two spots, or, as the room's first headset while it has none, pick two and
  // calibrate (that sets the room for everyone); lined up by the spots already (its own found again, or through the shared
  // space from them), straight on to Check, as after a calibration made there. Check: touch spot A (or B) and press Check
  // at A (selfCheck), or with someone, Touch the spot (the only check while the room has no spots). Green or amber: done
  // for this session (GD.ok), and the guide closes; red: back to Line up. Skip for now (or closing it any way) leaves it
  // until a red check or being late. It also opens at its last page when this headset is not lined up 20 s after entering
  // while the flow is not on show (once a session), and once more when the room gets its spots later (no check of this
  // headset's standing). Never for a headset in a room on this device or one elsewhere, never while calibrating or
  // checking, never over the once-per-room question (it waits for the answer), and not while the menu is in use for
  // something else (it waits). Tests that do not look at it turn its opening by itself off (auto: autoGuide(false))
  const FLOW = { wait: 1500 };
  const GD = { s: null, code: '', from: 0, due: 0, why: '', late: false, auto: true,
    fl: 0,   // the startup flow this session: 0 not shown yet, 1 on show, 2 done (a check stood), 3 skipped (closed)
    menu: false,   // the flow opened the menu itself (which closes with it once done)
    cal: -1,   // a calibration started from the guide (R.mgen then): once it is made, on to Check
    touched: false,   // a press on the guide's pages since the flow opened (no page turns by itself then)
    red: null,   // the last check over CK.red ({ spot: 'a', 'b' or 'p', d }): Line up says why
    ok: null,   // this session's check that stood ({ how: 'a', 'b' or 'p', d, at }) until the frame it was made in changes
    spots: null };   // whether the room had its spots as the flow first opened (false: when they come, it asks once more)
  put('roomGuide', null);   // (v107 opened it once per device)
  const guideOn = () => !!(HOST.session && C.code && !C.local && here() && !askHere());
  const othersIn = () => C.members.some(m => m.id !== C.id && (m.kind === 'ar' || m.kind === 'vr') && m.here !== false);
  const guideShown = () => !!(PNL.open && PNL.tab === 'circles' && PNL.page === 'guide' && guideOn());
  // what Line up says to do: 'calib' (calibrating now), 'check' (lined up by the room's spots: on to Check), 'room' (the
  // room has its spots and this headset is not lined up by them, or its last check was out: calibrate on them), 'first'
  // (no spots yet and this headset is the room's first: nobody else here, or its origin; pick two and calibrate), 'none'
  // (no spots yet and another headset is first: check with someone, or calibrate on two)
  function lineCase() {
    if (R.calib) return 'calib';
    if (byMarks() && !GD.red && lineUp().k === 'ok') return 'check';
    if (roomSpots()) return 'room';
    return !othersIn() || lineUp().h === 'origin' ? 'first' : 'none';
  }
  function guideStep(t) {
    if (GD.s !== R.session || GD.code !== C.code) Object.assign(GD, { s: R.session, code: C.code, from: 0, due: 0, why: '', late: false, fl: 0, menu: false, cal: -1, touched: false, red: null, ok: null, spots: null });
    // an armed check stops by itself (it takes the trigger everywhere but the menu): once it cannot be made, when the menu
    // closes, after CK.armFor; the others' old checks go
    if (CK.arm && (!canCheck() || !PNL.open || t - CK.armAt > CK.armFor)) checkArm(false);
    for (const [by, T] of CK.theirs) if (t - T.t > 3 * CK.win) CK.theirs.delete(by);
    if (!guideOn() || !C.welcomed) { if (!here()) GD.due = 0; return; }
    if (!GD.from) GD.from = t;   // (entering AR in this room, or answering "In this room" in VR)
    const shown = guideShown();
    if (!shown && GD.fl === 1) { GD.fl = 3; GD.menu = false; log('guide', { flow: 'skipped' }); }   // (closed: Skip for now, Close, the menu closed, another tab)
    // a calibration started from the guide, made: on to Check (the guide opens again there if it was closed meanwhile; not
    // after Skip for now); stopped: nothing
    if (GD.cal >= 0 && !R.calib) {
      const made = R.mgen !== GD.cal && own() && R.src === 'marks';
      GD.cal = -1;
      if (made) { GD.red = null; GD.ok = null; if (shown) { GD.fl = 1; guideGo(2, 'calibrated'); } else { GD.due = 2; GD.why = 'calibrated'; } }
    }
    // in the flow, before any press on its pages: once this headset is lined up by the room's spots, the question by eye
    // in AR (the guide closes), else on to Check
    if (shown && GD.fl === 1 && PNL.gs === 1 && !GD.touched && lineCase() === 'check') { if (eyeCan()) eyeInstead('start'); else guideGo(2, 'lined up'); }
    // the startup flow, once a session: lined up by the room's spots already, the question by eye in AR (EYEQ: are both
    // crosses on your spots?; GD.fl 4), else at Check; not lined up by them, at Line up
    if (!GD.fl && !GD.due && t - GD.from > FLOW.wait) {
      if (lineCase() === 'check' && eyeCan()) eyeInstead('start'); else { GD.due = lineCase() === 'check' ? 2 : 1; GD.why = 'start'; }
    }
    // the room got its spots since (someone calibrated on them) and no check of this headset's stands: once more
    if (GD.spots === false && GD.fl >= 2 && !GD.ok && !GD.due && validFloor() && !own() && !R.calib) {
      GD.spots = true;
      if (lineCase() === 'check' && eyeCan()) eyeWant('spots'); else { GD.due = lineCase() === 'check' ? 2 : 1; GD.why = 'spots'; }
    }
    if (!GD.late && othersIn() && t - GD.from > CK.late) { GD.late = true; if (lineUp().k !== 'ok' && GD.fl !== 1) GD.due = 3; }   // not lined up 20 s in
    if (!GD.due || !GD.auto || tipMode() || !OV.root || !OV.root.visible || (PNL.open && !PNL.self && PNL.page !== 'guide' && t - PNL.used < 5000)) return;
    const k = GD.due, why = GD.why || (k === 3 ? 'late' : 'start');
    GD.due = 0; GD.why = '';
    guideOpen(k, why);
  }
  // the startup flow asks by eye instead of at Check (GD.fl 4): the guide closes if the flow showed it (its menu too)
  function eyeInstead(why) {
    if (GD.fl === 1 && guideShown()) { if (GD.menu) menuOpen(false, 'guide'); else PNL.page = 'main'; }
    GD.fl = 4; GD.menu = false; GD.due = 0;
    log('guide', { flow: 'eye', why });
    eyeWant(why);
  }
  // the guide on show turns to page k by itself (kept open until used, as when it opened by itself)
  function guideGo(k, why) {
    PNL.gs = k; PNL.self = true; GD.touched = false;
    log('guide', { step: k, why });
    if (OV.panel) OV.panel.sig = '';
  }
  // the flow again, at page k: at once when the guide is on show, else when it may open (guideStep)
  function flowAgain(k, why) {
    if (guideShown()) { GD.fl = 1; guideGo(k, why); } else { GD.due = k; GD.why = why; }
  }
  // the guide at page k: by itself (the flow: why 'start', 'red', 'check', 'late', 'spots', 'calibrated'; the menu opened
  // with it if it was closed), or by hand ('hand': Room setup) or a test ('api'), which leave the flow as it is
  function guideOpen(k, why) {
    const was = PNL.open, auto = !/^(hand|api)$/.test(why);
    if (!PNL.open) menuOpen(true, auto ? 'guide' : 'api');
    PNL.tab = 'circles'; PNL.page = 'guide'; PNL.code = ''; PNL.gs = Math.max(0, Math.min(GUIDE_T.length - 1, k | 0));
    PNL.used = performance.now();   // (a menu open for a while would otherwise close as unused on the next frame)
    if (auto) { GD.fl = 1; GD.menu = !was; GD.touched = false; }
    if (GD.spots === null) GD.spots = roomSpots();
    log('guide', { step: PNL.gs, why });
    if (OV.panel) OV.panel.sig = '';
  }
  // Close, Done or Skip for now: in the flow, skipped for now (the menu closes too when the flow opened it)
  function guideClose() {
    const flow = GD.fl === 1;
    if (flow) { GD.fl = 3; GD.cal = -1; log('guide', { flow: 'skipped' }); }
    if (flow && GD.menu) menuOpen(false, 'guide'); else PNL.page = 'main';
    GD.menu = false;
  }
  // Calibrate (or Stop calibrating) on the guide's pages: once it is made, on to Check (guideStep)
  function guideCal() {
    if (R.calib) { R.cancel(); return; }
    GD.cal = R.mgen; GD.touched = true;
    R.calibrate();
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
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429 && r.status !== 401) || r.status === 507) UP.n = last;   // sent, or never will be
      if (r.status === 404 || r.status === 405 || r.status === 507) { UP.off = true; log('log upload off', { status: r.status }); }
    }, () => { /* the relay is away: next time */ }).then(() => { UP.busy = false; });
  }
  function place(f) {
    if (!C.code || !R.session) return null;
    if (f) update(f);
    const L = liveSt();
    if (!R.aligned || !L || (L.story !== HOST.curKey && !cards())) return null;   // (an All stories circle's cards stand at its spot too)
    const S = shown(L);
    _v.set(S.x, EYE, S.z).applyMatrix4(R.m);
    return { p: [_v.x, _v.y, _v.z], yaw: R.yaw + S.yaw, room: true };
  }
  const placing = () => { const L = liveSt(); return !!(C.code && R.session && R.aligned && L && L.story === HOST.curKey); };
  // a headset in a shared room away from a station (in no circle yet since the session began, its story not yet loaded,
  // or the room not yet aligned): a story only runs at its station, so the stories hide theirs and pause it, and only the
  // shell's things show. A headset that walked into a circle stays at that station wherever it walks after
  const away = () => !!(C.code && R.session) && !placing() && !cards();
  // an All stories circle (allHere: the headset's live station is one, its cards or a story picked there; cards: showing
  // its cards): the story on show hosts the single-player Stories screen there (the stories open it while cards() is
  // true, and a card picks for everyone at the circle: allPick), with the scene hidden and nothing synced
  const allHere = () => { const L = liveSt(); return !!(C.code && R.session && L && L.kind === ALL); };
  const cards = () => { const L = liveSt(); return !!(allHere() && R.aligned && !runs(L)); };
  // back to its cards, for everyone at the circle (the story panel's Stories button there)
  const allBack = () => { const L = liveSt(); return !!(L && L.kind === ALL && runs(L) && allPickAt(L.id, ALL)); };
  // the station's panel and scene as the room has them, in its story's rig (the station's spot at eye height)
  function panelPose(L) {
    const v = L ? roomPanel(L) : panelHome(), q = L ? roomPlace(L) : PLACE0;
    return { pp: [v.x, v.y - EYE, v.z], pr: v.yaw, pq: v.q, off: [q.x, q.y, q.z], s: q.s, q: q.q };
  }
  // for a story starting in a running session at a station (HOST.start): its rig, panel and scene there
  function adopt(key) {
    const L = liveSt();
    if (!C.code || !R.session || !R.aligned || !L || L.story !== key) return null;
    const P = panelPose(sessOf(L));   // (an All stories circle in sync mode: the linked circle's panel and scene, from its own spot)
    return { rp: new THREE.Vector3(L.x, EYE, L.z).applyMatrix4(R.m), rq: new THREE.Quaternion().setFromAxisAngle(_Y, R.yaw + L.yaw),
      off: new THREE.Vector3().fromArray(P.off), s: P.s, pp: new THREE.Vector3().fromArray(P.pp), pr: P.pr,
      rot: new THREE.Quaternion().fromArray(P.q || Q1), pq: P.pq ? new THREE.Quaternion().fromArray(P.pq) : new THREE.Quaternion().setFromAxisAngle(_Y, P.pr) };
  }
  // the headset session started (or ended): the shell's own frame callback, the spaces, the lifecycle guard
  function watch(s) {
    if (s === R.session) return;
    R.session = s; R.begun = null; R.aligned = false; R.frame = null; R.src = ''; R.calib = null; checkReset();
    if (MG.src) menuPut();   // (a menu carried as the session ends: where it was let go is where it opens next time)
    menuShareEnd('session');   // (your menu shown to your circle: closed for them)
    PNL.open = false; PNL.page = 'main'; FLOAT.placed = false; FLOAT.pinned = false; PINCH.at = 0; MG.src = null; C.listing.menu = false;   // the menu starts closed
    kpEnd(null); askClose('session');   // (a keypad waiting for a word, a question about a circle: gone with the session)
    // nothing on the wrist says how to open it any more: a notice says so once, a moment into the session (when the
    // controllers or hands are known), unless it is open by then
    if (s) setTimeout(() => { if (R.session === s && !PNL.open) notice('The menu', HAND.hand ? 'Pinch twice with your left hand, pointing at nothing, to open the menu.' : 'Click a stick to open the menu.', 6000); }, 2500);
    // what a story does by itself when a session starts or a headset wakes is not a person's action: not published
    holdTask();
    if (!s) { dropStation(null); letGo(); setState('off'); HOST.audio.zone(null); if (HOST.sfx) HOST.sfx.listen(null); if (C.code) { upload(performance.now(), true); hello(); connect(); } changed(); return; }
    // in a headset a station is reached only by walking into its circle: one this page followed (or a session ended at)
    // is not its station
    if (C.live || C.follow) { log('station dropped for the headset', { st: C.live || C.follow }); C.follow = ''; C.mine = ''; C.live = ''; C.picked = false; C.zone = ''; C.cand = ''; C.liveSig = ''; C.cardsOpen = false; }
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
        eyeWant('wake');   // (the check by eye: are both crosses still on the spots?)
      }
      if (s.visibilityState === 'visible' && C.code) wake('headset');
    }));
    quiet(() => { s.addEventListener('squeezestart', grabStation); s.addEventListener('squeezeend', dropStation); s.addEventListener('selectstart', pinched); });
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
    inRoom: () => !!(C.code && R.session), away, cards, allHere, allBack,
    // in a shared room the grip moves a scene or a panel only at the headset's station, and not while its story is
    // locked (Lock this story; the circles lock never locks them): what it moves goes out to the room, so everybody sees
    // it alike (placeSync)
    gripLocked: () => !placing() || stLocked(sesSt()),
    // Recenter at the headset's station (the story panel's button and the menu's): its scene and panel back where the
    // story puts them, for everyone at its circle; refused while its story is locked (says so). False when not at one
    recenter: () => recenterStation(),
    get gripHint() {
      // (the flock and the robots are life size: only their panel moves)
      const m = meta(HOST.curKey) || {};
      return 'Trigger (or pinch): use buttons. A or X: play and pause. ' + (!placing() ? 'Grip on a station\'s ring or card: move the station.' : stLocked(sesSt()) ?
        'This story is locked: unlock it in the menu to move things.' : m.life ? 'Grip: move this panel for everyone.' : 'Grip: move the scene or this panel for everyone; both grips resize the scene.');
    },
    get moving() { return MV.id; },
    sharedAlign(on) { if (on !== undefined) setSharedAlign(on); return R.sharedAlign; }, floorNote,
    handles: () => ((R.saved && R.saved.anchors) || []).concat(R.anchorIds || []).filter(Boolean),   // kept by HOST.anchor's tidy-up
    get marks() { return R.mk; }, get cmp() { return R.cmp; }, frameKey: kFrame,
    // the station's panel and scene, for a story's xrRecenter while placed (off, s, pp, pr in its rig; q the scene's
    // turn and pq the panel's rotation, [x, y, z, w] or null: none)
    saved: () => { const P = panelPose(sesSt()); return placing() ? { off: P.off, s: P.s, pp: P.pp, pr: P.pr, q: P.q, pq: P.pq } : null; },
    joined() { if (R.session) { begin(); loop(R.session); } },
    left() { R.begun = null; R.frame = null; R.src = ''; R.aligned = false; R.calib = null; checkReset(); setState('off'); },
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
    if (C.code) scenesFetch().then(() => renderDialog());   // (the studio relay's scenes, for Add)
    renderDialog();
    setTimeout(() => { const f = $(C.code ? '[data-sh="close"]' : C.relay ? '[data-sh="start"]' : homeOffer() ? '#shHome' : '#shRelay'); if (f) f.focus(); }, 50);
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
      else if (act === 'pass') { const f = $('#shPass'); if (f && f.value.trim()) authTry(f.value); }
      else if (act === 'forget') authForget();
      else if (act === 'home') { const f = $('#shHome'); if (f && f.value.trim()) homeTry(f.value); }
      else if (act === 'relay2') { const v = $('#shRelay2') && $('#shRelay2').value; if (v) { setRelay(v, 'typed'); probe(performance.now(), true); } }
      else if (act === 'refresh') { listRooms(); nearFind('refresh'); }
      else if (act === 'start') create();
      else if (act === 'join' || act === 'again') join(arg);
      else if (act === 'near') setNear(!nearShown());
      else if (act === 'open') join(arg, true);
      else if (act === 'code') join($('#shCode').value);
      else if (act === 'leave') leave(false, true);
      else if (act === 'follow') { choose(arg, 'follow'); dialog(false); if (!C.cardsOpen) HOST.closePicker(); }   // (an All stories circle's cards: its Stories screen stays)
      else if (act === 'unfollow') unfollow();
      else if (act === 'who') { if (followPerson(arg) && C.whoSt) dialog(false); }   // (not at a station yet: the dialog stays, saying so)
      else if (act === 'remove') removeAsk(arg);
      else if (act === 'arrange') arrange({ x: 0, z: 0, yaw: 0 });
      else if (act === 'lock') setLock(!circlesLocked());
      else if (act === 'free') HOST.xr.setFree(!HOST.xr.free());
      else if (act === 'subs') HOST.xr.setSubs(!HOST.xr.subs());
      else if (act === 'ask') setAsk(!askFirst());
      else if (act === 'sfx') { if (HOST.sfx) HOST.sfx.set(!HOST.sfx.on()); }   // (in a room the room's; turned on, the click's own sound says so)
      else if (act === 'voice') HOST.xr.setVoice(!HOST.xr.voice());
      else if (act === 'panels') { const S = sessOf(C.stById.get(arg)), v = stPanels(S); if (S) setStPanels(S.id, PANELS[(PANELS.indexOf(v) + 1) % 3]); }   // (not locked with the circles; an All stories circle's: its session's)
      else if (act === 'stlock') { const S = sessOf(C.stById.get(arg)); if (S) setStLock(S.id, !stLocked(S)); }   // (a story's lock: neither is the circles')
      else if (act === 'allsync') { const s = C.stById.get(arg); if (s) setAllSync(arg, !s.sync); }   // (an All stories circle's switch: never locked)
      else if (act === 'fresh') { freshAsk(); setTimeout(renderDialog, 3050); }
      else if (act === 'add') { const k = $('#shAdd').value, id = addOne(k, freeSpot()); if (id) log('added', { st: id, story: k }); }
      else if (act === 'color') setMe({ color: arg });
      else if (act === 'copy') { try { navigator.clipboard.writeText(link()); b.textContent = 'Copied'; } catch (e) { /* no clipboard */ } }
      renderDialog();
    });
    $('#shName').addEventListener('change', ev => setMe({ name: ev.target.value.trim() || C.name }));
    // an All stories circle's story, picked in its row (Choosing a story: back to its cards), for everyone there
    DLG.el.addEventListener('change', ev => { const q = ev.target.closest('[data-sh-pick]'); if (q && q.value) { allPickAt(q.dataset.shPick, q.value); renderDialog(); } });
    $('#shLabels').addEventListener('change', ev => { HOST.xr.setLabels(ev.target.value); renderDialog(); });
    $('#shCards').addEventListener('change', ev => { HOST.xr.setCards(ev.target.value); renderDialog(); });
    $('#shRelay').addEventListener('keydown', ev => { if (ev.key === 'Enter') { typed(ev.target.value); renderDialog(); } });
    $('#shPass').addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.value.trim()) authTry(ev.target.value); });
    $('#shHome').addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.value.trim()) homeTry(ev.target.value); });
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
        peerOn() ? `No relay known: a room you start runs peer to peer. The devices talk to each other directly; ${peerServer().name} only introduces them. Start the room on a laptop or desktop page that stays awake, and send the others its link. ${homeOffer() ? 'With the relay\'s password (below), rooms run on the relay instead.' : 'Or enter a relay\'s address.'}` :
          (homeOffer() ? 'Shared rooms need a relay: enter the relay\'s password below, or another relay\'s address. Without one (peer to peer is off), a room works on this device alone.' :
            'Shared rooms need a relay: a small server on your network that keeps a room in step. Enter its address. Without one (peer to peer is off), a room works on this device alone.'));
    st.classList.toggle('warn', !!C.note);
    // the relay's password: asked for while the relay wants one (in a room too: it waits for it); Forget the password in the
    // relay's part while this device keeps one for it
    const pw = $('.sh-pass'), kept = !!(C.relay && tokens()[originOf(C.relay)]);
    if (pw) {
      pw.hidden = !authAsk();
      const pn = $('.sh-passnote'), bad = /^(wrong|stale|limit|away)$/.test(AUTH.state);
      if (pn) { pn.textContent = authLine(); pn.classList.toggle('warn', bad); }
      const pb = $('[data-sh="pass"]');
      if (pb) pb.disabled = AUTH.state === 'checking';
    }
    // the relay this page offers (HOME_RELAY): its password, out of a room while no relay is in use here
    const ho = homeOffer(), hb = $('.sh-home');
    if (hb) {
      hb.hidden = !ho || joined || authAsk();   // (a 401 of its asked already: This relay needs its password, above)
      const hw = $('.sh-homewhat');
      if (hw) hw.textContent = `Have the password for ${ho.replace(/^https?:\/\//, '')}? Enter it once, and this device's rooms run on that relay (people elsewhere can join, and the studio's scenes are there). Without it, rooms run ${peerOn() ? 'peer to peer' : 'on this device alone'}.`;
      const hn = $('.sh-homenote');
      if (hn) { hn.textContent = homeLine(); hn.classList.toggle('warn', /^(wrong|limit|away)$/.test(HOME.state)); }
      const hk = $('[data-sh="home"]');
      if (hk) hk.disabled = HOME.state === 'checking';
    }
    $('.sh-relay').hidden = !!C.served && !C.note && !kept;
    const fg = $('[data-sh="forget"]');
    if (fg) fg.hidden = !kept;
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
        : `<li class="none">${esc(C.roomsErr || (C.rooms ? (near.length ? 'No other open rooms.' : (C.unlisted ? 'This relay lists no rooms: join one by its code or link, or under Rooms on this network.' : 'No open rooms yet. Start one, and others join it here or from a headset.')) : 'Looking for rooms...'))}</li>`) +
        kept.map(r => `<li class="empty"><b>${esc(r.code)}</b><span>Kept on this device · ${r.stations} station${r.stations === 1 ? '' : 's'}</span><button class="btn" type="button" data-sh="open:${esc(r.code)}">Open</button></li>`).join('');
      const rf = $('[data-sh="refresh"]');
      if (rf) rf.hidden = !C.relay && !peerOn();
    } else {
      const L = C.stById.get(C.follow);
      $('.sh-room').innerHTML = `<b>${esc(C.code)}</b><span>${C.who ? esc(whoLine()) : L ? 'Following ' + esc(stTitle(L)) + ' on this page' + (C.whoLeft ? ` (${esc(C.whoLeft)} has left the room)` : '') : 'Follow a station or a person in a headset to see the story here, in step with the room'}</span>
        ${C.local ? '' : '<button class="btn" type="button" data-sh="copy">Copy link</button>'}<button class="btn" type="button" data-sh="leave">Leave</button>` +
        (C.local ? `<div class="row"><input id="shRelay2" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="wss://relay.example.org" aria-label="Relay address" value="${esc(C.relay.replace(/^http/, 'ws'))}"><button class="btn" type="button" data-sh="relay2">Move to this relay</button></div>` : '');
      $('.sh-stations').innerHTML = C.st.length ? C.st.map(s => {
        // (the lobby: no Follow, no panels, no lock; an All stories circle: its story picked here, back to its cards, and
        // its switch; its panels and lock are its session's)
        const m = Object.assign({}, meta(lookKey(s)), { title: stTitle(s) }), on = C.follow === s.id, who = whoAt(s.id).filter(w => w !== 'you'), ss = sessOf(s), pm = stPanels(ss), sl = stLocked(ss), lob = s.kind === LOBBY_ST;
        const all = s.kind !== ALL ? '' : `<select class="pk" data-sh-pick="${s.id}" aria-label="The story at this All stories circle"><option value="all"${runs(s) ? '' : ' selected'}>Choosing a story</option>${
          HOST.list.map(k => `<option value="${esc(k.key)}"${k.key === s.story ? ' selected' : ''}>${esc(k.title)}</option>`).join('')}</select>
          <button class="btn al${s.sync ? ' on' : ''}" type="button" data-sh="allsync:${s.id}" aria-pressed="${!!s.sync}" title="Own stories: this circle runs its own. With the room's circles: a story picked here joins the room's circle of that story, at the same moment">${s.sync ? 'With the room\'s circles' : 'Own stories'}</button>`;
        // (the room's arc: everyone's Stories screen, until another circle is added or Arrange all)
        return `<li class="${on ? 'on' : ''}"><i style="background:${m.col}"></i><b>${esc(m.title)}</b><span>${s.arc ? 'For everyone in the room until another circle is added · ' : ''}${esc(stationLine(s))}${who.length ? ' · ' + esc(who.join(', ')) : ''}</span>
          ${lob ? '' : on ? '<button class="btn" type="button" data-sh="unfollow">Stop following</button>' : `<button class="btn primary" type="button" data-sh="follow:${s.id}">Follow</button>`}${all}
          ${lob ? '' : `<button class="btn pn" type="button" data-sh="panels:${s.id}" aria-pressed="${pm === 'shown'}" title="What the headsets at this circle show of its story's panels: shown, controls only (the foot bar) or hidden. Press for the next" aria-label="Panels at the ${esc(m.title)} station: ${PANELS_SAY[pm]}. Press for ${PANELS_SAY[PANELS[(PANELS.indexOf(pm) + 1) % 3]]}">Panels: ${PANELS_SAY[pm]}</button>
          <button class="btn lk${sl ? ' on' : ''}" type="button" data-sh="stlock:${s.id}" aria-pressed="${sl}" title="Locked: nobody at this circle can move, turn or resize its scene or move its panel (the circle itself is the circles lock's)" aria-label="${sl ? 'The ' + esc(m.title) + ' story is locked: press to unlock it' : 'Lock the ' + esc(m.title) + ' story'}">${sl ? 'Story locked' : 'Lock story'}</button>`}
          <button class="btn rm${armed(s.id) ? ' armed' : ''}" type="button" data-sh="remove:${s.id}" aria-label="${armed(s.id) ? 'Remove the ' + esc(m.title) + ' station for everyone? Press again to remove it' : 'Remove the ' + esc(m.title) + ' station'}">${armed(s.id) ? 'Remove for everyone?' : 'Remove'}</button></li>`;
      }).join('') : '<li class="none">No stations yet. Arrange all puts every story in two rows; a headset in the room can then move them.</li>';
      const sel = $('#shAdd'), lk = circlesLocked(), lb = $('[data-sh="lock"]');
      const ad = addable(), adk = ad.map(addVal).join('\n');   // (the stories, then the design room, the studio and its relay's scenes)
      if (sel.dataset.k !== adk) { const was = sel.value; sel.innerHTML = ad.map(m => `<option value="${esc(addVal(m))}">${esc(addName(m))}</option>`).join(''); sel.dataset.k = adk; if (ad.some(m => addVal(m) === was)) sel.value = was; }
      if (lb) { lb.textContent = lk ? 'Unlock circles' : 'Lock circles'; lb.setAttribute('aria-pressed', String(lk)); lb.classList.toggle('on', lk); }
      // shown on this network or not: the room's (anyone sets it; not locked with the circles); a room on this device is on no network
      const nb = $('[data-sh="near"]'), ns = nearShown();
      if (nb) { nb.hidden = C.local; nb.textContent = ns ? 'Show on this network: on' : 'Show on this network: off'; nb.setAttribute('aria-pressed', String(ns)); }
      // the headsets' labels, cards, moving and subtitles, the room's (not locked with the circles)
      const sl = $('#shLabels'), sc = $('#shCards'), fb2 = $('[data-sh="free"]'), sb = $('[data-sh="subs"]'), lm = HOST.xr.labels(), cm = cardMode(), fr = HOST.xr.free(), su = HOST.xr.subs();
      if (sl && sl.value !== lm) sl.value = lm;
      if (sc && sc.value !== cm) sc.value = cm;
      if (fb2) { fb2.textContent = fr ? 'Moving: free' : 'Moving: facing you'; fb2.setAttribute('aria-pressed', String(fr)); }
      if (sb) { sb.textContent = su ? 'Subtitles: on' : 'Subtitles: off'; sb.setAttribute('aria-pressed', String(su)); }
      // the room's circles: walked into, or asked first (headsets; not locked with the circles)
      const ab = $('[data-sh="ask"]'), af = askFirst();
      if (ab) { ab.textContent = af ? 'Circles: ask first' : 'Circles: walk in'; ab.setAttribute('aria-pressed', String(af)); }
      const fb = $('[data-sh="fresh"]'), fa = freshArmed();
      if (fb) { fb.hidden = !canFresh(); fb.textContent = fa ? 'Fresh space for everyone? Press again' : 'Fresh shared space'; fb.classList.toggle('armed', fa); }
      for (const q of DLG.el.querySelectorAll('[data-sh="arrange"], [data-sh="add"], #shAdd, [data-sh^="remove:"]')) q.disabled = lk;
      $('.sh-people').innerHTML = C.local ? `<li class="none">Only you: others can join once the room is on a relay${C.peerFail ? ' or peer to peer' : ''}.</li>` : C.members.map(m => {
        const P = m.id === C.id ? { st: C.follow } : C.pres.get(m.id), s = P && C.stById.get(P.st), bv = m.id === C.id ? BROWSER : (P && P.bv) || '';
        // Follow: a person in a headset, followed from this page (a headset walks); the one followed: Stop following
        const on = C.who === m.id, nm = m.name || 'Someone', fb = m.id === C.id || HOST.session ? '' : on ? '<button class="btn" type="button" data-sh="unfollow">Stop following</button>' :
          m.kind === 'ar' || m.kind === 'vr' ? `<button class="btn primary" type="button" data-sh="who:${esc(m.id)}" title="This page follows whichever station ${esc(nm)} stands at, switching as they walk" aria-label="Follow ${esc(nm)}">Follow</button>` : '';
        return `<li class="${on ? 'on' : ''}"><i style="background:${esc(m.color || '#888')}"></i><b>${esc(nm)}${m.id === C.id ? ' (you)' : ''}</b><span>${
          { ar: 'headset', vr: 'headset (VR)', desktop: 'screen' }[m.kind] || ''}${bv ? ' (Quest Browser ' + esc(bv) + ')' : ''}${m.kind && m.kind !== 'desktop' ? (m.here ? ', in the room' : ', elsewhere') : ''}${m.host ? ', hosts the room' : ''}${s ? ' · at ' + esc(stTitle(s)) : ''}${showsMenu(m.id) ? ' · showing their menu' : ''}${on ? ' · followed here' : ''}</span>${fb}</li>`;
      }).join('');
      drawMap();
      guideList();
    }
    // the sound switches, for every story: in a room the room's (anyone sets them; not locked with the circles), else this device's
    const sfb = $('[data-sh="sfx"]'), vob = $('[data-sh="voice"]'), sso = $('.sh-sound span');
    if (sso) sso.textContent = joined ? 'For everyone in this room, pages and headsets:' : 'On this device (in a shared room, the room\'s):';
    if (sfb) { const on = !!HOST.sfx && HOST.sfx.on(); sfb.hidden = !HOST.sfx; sfb.textContent = on ? 'Sound effects: on' : 'Sound effects: off'; sfb.setAttribute('aria-pressed', String(on)); }
    if (vob) { const on = HOST.xr.voice(); vob.textContent = on ? 'Narration: on' : 'Narration: off'; vob.setAttribute('aria-pressed', String(on)); }
    $('.sh-colors').innerHTML = COLORS.map(c => `<button type="button" data-sh="color:${c}" style="background:${c}" aria-label="Colour ${c}" aria-pressed="${c === C.color}"></button>`).join('');
  }
  // Setting up a room (the room setup guide, as text on a page): every headset in the room and how it lines up, from its
  // presence (luLine), and how many are lined up and checked this session. Written again only when it changes (the pump
  // asks five times a second)
  function guideList() {
    const ul = DLG.el && C.code ? $('.sh-lu') : null;
    if (!ul) return;
    const hs = C.members.filter(m => m.id !== C.id && (m.kind === 'ar' || m.kind === 'vr')), rows = hs.map(m => [m, luLine(m, C.pres.get(m.id))]);
    const inRoom = rows.filter(r => r[1][0] !== 'away'), lined = inRoom.filter(r => r[1][0] === 'ok' || r[1][0] === 'mid'), ok = lined.length;
    const ck = lined.filter(([m]) => { const L = (C.pres.get(m.id) || {}).lu; return !!(L && (L.ck || Number.isFinite(L.c))); }).length;
    const html = !hs.length ? '<li class="none">No headset in the room yet: start AR on one headset first, then the others one by one.</li>' :
      rows.map(([m, [c, s]]) => `<li class="${c}"><i style="background:${esc(m.color || '#888')}"></i><b>${esc(m.name || 'Someone')}</b><span>${esc(s)}</span></li>`).join('') +
        (inRoom.length ? `<li class="none">${ok} of ${inRoom.length} ${inRoom.length === 1 ? 'headset' : 'headsets'} in the room lined up, ${ck} checked.</li>` : '');
    if (DLG.lu !== html || !ul.firstChild) { DLG.lu = html; ul.innerHTML = html; }
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
      const m = Object.assign({}, meta(lookKey(s)), { title: stTitle(s) }), [qx, qz] = content(s), on = s.id === C.follow;
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
    const v = stVal(s, P), k = J(v);
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
    arc: () => arcSt(),   // the room's arc (its first All stories circle while it has no other: everyone at it), or null
    // a person followed from this page (their member id; '' none): whichever station they stand at, switching as they walk
    followPerson: id => followPerson(id), followingWho: () => C.who,
    val, now, publish: pairs => publish(pairs), fx, setRelay: s => setRelay(s, 'typed'), detect, list: listRooms, create, join,
    // the studio's relay ({ base, token } or null) and what a call to it answered (a 401 brings up the password prompts)
    relayFind: () => relayFind(), relaySaw: (base, status, sent, j) => relaySaw(base, status, sent, j),
    leave: () => leave(false, true),   // (on purpose: not joined again by itself until joined again by hand)
    // a page that is not a story at your feet as a circle (the menu's Design room and Studio buttons in a room), or the
    // room's one moved there: its station's id ('' refused: no room, or the circles locked)
    arrange, add, move, remove, design: b => pageHere(DESIGN, b), studio: b => pageHere(STUDIO, b), follow: id => choose(id, 'follow'), pick: id => choose(id, 'pick'), unfollow, me: setMe, setHere,
    mapView: () => MAP.tf,   // the room map's room <-> pixel transform (X, Y, ix, iz), once drawn
    // the circles lock (no circle moved, added or removed) and a station's own lock (its scene and panels, at its circle)
    lock: on => setLock(on), get locked() { return circlesLocked(); },
    stationLock: id => stLocked(C.stById.get(id)), setStationLock: (id, on) => setStLock(id, on),
    // whose figures this headset draws: false, the people at its circle (or everyone before any circle); true, everyone
    seeAll: on => { if (on !== undefined) setPeopleAll(on); return peopleAll(); },
    allRings: on => { if (on !== undefined) setRingsAll(on); return ringsAll(); },   // Show all rings (this headset's own)
    menuShare: on => { if (on !== undefined) setMenuShare(on); return menuShareOn(); },   // My menu: my circle (this headset's own)
    // for tests: what this headset sent of its menu (got: the pictures it took from others), and the others' menus it
    // holds (lit: the share of a sample of the picture's pixels that are not dark, low: below its top quarter and inside
    // its edges; hit: pointable, which they never are; full: each picture as a PNG too, url; px false: no lit and low, so
    // a test polling whether one is there reads no pixels back)
    menuShot: master => menuPicture().then(u => (master && MSH.master ? MSH.master.toDataURL('image/png') : u)),   // (the picture as made now; master: before the JPEG)
    // (cur: the last picture made shows what the menu shows now, the light of what is pointed at aside, and none is being made)
    menuSent: () => ({ on: MSH.on, st: MSH.st, n: MSH.n, step: MSH.step, img: MSH.img.length, pics: MSH.sent.pics, poses: MSH.sent.poses, closed: MSH.sent.closed, most: MSH.sent.most, bytes: MSH.sent.bytes, at: MSH.sent.at.slice(), ns: MSH.sent.ns.slice(), cv: MSH.sent.cv.slice(), got: MSH.got, same: MSH.same || 0,
      cur: !!OV.panel && !MSH.busy && MSH.sig === menuSig() }),
    menus: (full, px = true) => [...MENUS].map(([id, E]) => {
      const o = E.o, g = o && o.g;
      let lit = 0, low = 0;
      if (px && E.cv && E.cv.width) {
        const W = E.cv.width, H = E.cv.height, d = E.cv.getContext('2d').getImageData(0, 0, W, H).data;
        let n = 0, k = 0, nl = 0, kl = 0;
        for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) {
          const i = 4 * (y * W + x), on = d[i + 3] > 0 && d[i] + d[i + 1] + d[i + 2] > 150;
          n++; if (on) k++;
          if (y >= H / 4 && x >= W * 0.05 && x <= W * 0.95) { nl++; if (on) kl++; }   // (inside its edges)
        }
        lit = n ? k / n : 0; low = nl ? kl / nl : 0;
      }
      return { id, st: E.st, n: E.n, want: E.nWant, pics: E.pics, bytes: E.bytes, drawn: !!(g && g.visible), p: g ? g.position.toArray() : null, q: g ? g.quaternion.toArray() : null,
        pose: E.pose, w: o ? o.front.scale.x : 0, h: o ? o.front.scale.y : 0, iw: E.iw || 0, ih: E.ih || 0, lit, low, order: o ? o.front.renderOrder : null, gorder: g ? g.renderOrder : null, depth: o ? o.front.material.depthTest : null,
        hit: !!(o && OV.hit.some(x => x === o.front || x === o.back)), name: o ? o.name : null, age: Math.round(performance.now() - E.at), url: full && E.cv ? E.cv.toDataURL('image/png') : undefined };
    }),
    // for tests: the menu's tab (and its first page), how long it waits unused before it closes, and a button by its id
    // on whichever tab has it (that tab shown; null when none has it, or it is greyed: a greyed button has no region)
    menuTab: t => { if (t !== undefined) { setTab(t); OV.panel && (OV.panel.sig = ''); } return PNL.tab; },
    menuIdle: ms => { if (ms !== undefined) IDLE.ms = +ms; return IDLE.ms; },
    menuFind: id => {
      if (!PNL.open || !OV.panel) return null;
      const S = OV.panel, find = () => { S.sig = ''; drawPanel(); return S.regions.find(r => r.id === id) || null; };
      let r = find();
      if (r) return r;
      const tab = PNL.tab, page = PNL.page, code = PNL.code;
      for (const [k] of TABS) { if (k === tab) continue; PNL.tab = k; PNL.page = 'main'; if ((r = find())) return r; }
      PNL.tab = tab; PNL.page = page; PNL.code = code; find();
      return null;
    },
    // for tests: the ids of every button the open menu has, on the page shown and on the other tabs' first pages
    menuIds: () => {
      if (!PNL.open || !OV.panel) return [];
      const S = OV.panel, draw = () => { S.sig = ''; drawPanel(); return S.regions.map(r => r.id); }, tab = PNL.tab, page = PNL.page, code = PNL.code;
      const ids = new Set(draw());
      for (const [k] of TABS) { if (k === tab) continue; PNL.tab = k; PNL.page = 'main'; for (const i of draw()) ids.add(i); }
      PNL.tab = tab; PNL.page = page; PNL.code = code; draw();
      return [...ids];
    },
    // the room's headset settings and sound switches ({ labels, cards, free, subs, sfx, voice, ask }; null outside a room),
    // set for everyone there (HOST.xr calls these)
    look, setLook,
    // the room's circles walked into (false) or asked first (true: walking in does nothing, a press on a circle asks), set
    // for everyone in the room (false outside a room: nothing is set); the question a headset shows now ({ id, left: ms }
    // or null) and how long it shows (tests). askDefault(on): what a room that never wrote ask does here (true, asked
    // first, since v120; tests that walk into circles turn it off, also by localStorage collabAskDefault = walk)
    askFirst: () => askFirst(), setAsk: on => setAsk(on), askDefault: on => { if (on !== undefined) { LOOK0.ask = !!on; changed(); } return LOOK0.ask; },
    // the other stations' rings, cards and icons hidden while this headset is at a studio station (the studio's switch;
    // it lapses when the live station or its story changes); without an argument, whether they are hidden now
    hideOthers: on => (on === undefined ? hidingOthers() : hideOthers(on)),
    asking: () => (ASK.id ? { id: ASK.id, left: Math.round(ASK.until - performance.now()) } : null), askMs: ms => { if (ms > 0) ASK.ms = +ms; return ASK.ms; },
    // a keypad for a word in the headset's menu (headsets cannot type): a promise of the text typed, or null when cancelled
    // or when no headset menu can show it ({ title, hint, value, max })
    keypad: o => keypad(o),
    // the studio relay's scenes (a promise of their names, asked again at most every 3 s), a studio circle for one of them
    // (its station's id; '' refused), and the scene a studio station's state names ('' none)
    scenes: () => scenesFetch(), addScene: (name, b) => addScene(name, b), sceneOf: id => sceneOf(C.stById.get(id)),
    // panels per story (HOST.panels calls the first two): at a station of the story, the station's (null elsewhere), set for
    // everyone at its circle; any station's, read and set by its id (the page's dialog)
    panels: key => panelsAt(key), setPanels, stationPanels: id => stPanels(C.stById.get(id)), setStationPanels: (id, v) => setStPanels(id, v),
    fresh: () => freshAsk(), get gen() { return SG; },   // a fresh shared space (two calls: the first arms it); this page's generation
    ray, press, effect, detach, hash, dialog, people: () => C.pres, log,
    // the heads of the people in a headset at this device's live station, its own among them, in room coordinates with the
    // relay's time of each (the studio's behaviours react to one of them): { st, list } or null
    heads: () => heads(),
    // rooms on this network: this device's network (its id, never the address; '' unknown), the rooms found on it (null:
    // looking), looked for again; whether this room shows there (the room's switch); the room to rejoin by itself and the
    // one offered again; a pretend network (tests: #net=<word>); the page's hash of an address (tests: as the relay's)
    get net() { return C.net; }, nearby: () => C.near, findNear: () => nearFind('api'), get nearOn() { return nearShown(); }, setNear: on => setNear(on),
    rejoinable: () => rejoinable(), offer: () => offer(), netAgain: why => netAgain(why || 'api'), pretendNet: w => pretendNet(w), netHash: a => netHash(netName(a)),
    panelOpen(on) { menuOpen(on, 'api'); }, get menu() { return PNL.open; },   // the headset's menu, open or closed
    // the relay's password: whether one is wanted ({ state, at, kept: one kept here for this relay }), one tried, forgotten
    auth: () => ({ state: AUTH.state, at: AUTH.at, kept: !!(C.relay && tokens()[originOf(C.relay)]), waiting: C.status === 'auth', create: !!C.wantCreate, home: HOME.state, offer: homeOffer() }),
    // the relay this page offers (HOME_RELAY), for tests: homeRelay(url) offers another (null: the table's again); its
    // address while offered, else ''
    homeRelay(u) { if (u !== undefined) { HOME.o = u === null ? null : String(u); HOME.state = ''; changed(); } return homeOffer(); },
    authTry: t => authTry(t), authForget: () => authForget(),
    notes: () => NOTES.slice(),   // (for tests: the last few notices, oldest first)
    get menuGrab() { return !!MG.src; }, menuPos: () => Object.assign({ pinned: FLOAT.pinned }, FLOAT.pos),   // (the menu carried by the grip; where it opens)
    // the room setup guide: what it shows ({ open, step, status: how this headset lines up, check: what the check says,
    // lined: [headsets lined up, headsets, checked], flow: the startup flow this session ('' not yet, 'on', 'done',
    // 'skipped'), case: what Line up says to do (lineCase), ok: this session's check that stood, red: the last one out,
    // spots: the room's spots as this headset puts them, menu: the flow opened the menu }), opened at a step (the menu
    // too), Check here armed or not (spot 'a' or 'b': on its own at that spot), and (tests) its windows shortened:
    // { win: ms two checks pair within, late: ms before not lined up opens it }
    guide: () => ({ open: guideShown(), step: PNL.gs, status: lineUp(), check: checkState(), lined: linedUp(), flow: ['', 'on', 'done', 'skipped', 'eye'][GD.fl],
      case: lineCase(), ok: GD.ok, red: GD.red, spots: roomMk(), menu: GD.menu }),
    guideOpen: k => guideOpen(k, 'api'), checkArm: (on, spot) => checkArm(on !== false, spot), autoGuide: on => { if (on !== undefined) GD.auto = !!on; return GD.auto; },
    guideTimes: o => { if (o && o.win > 0) CK.win = +o.win; if (o && o.late > 0) CK.late = +o.late; return { win: CK.win, late: CK.late }; },
    // the check by eye (for tests): whether it asks, is on show, why, and when it is due; its two times (ms) to shorten
    eye: () => ({ ask: EYEQ.ask, shown: eyeShown(), why: EYEQ.why, due: EYEQ.due ? Math.round(EYEQ.due - performance.now()) : 0, can: eyeCan() }),
    eyeTimes: o => { if (o && o.quiet > 0) EYEQ.quiet = +o.quiet; if (o && o.most > 0) EYEQ.most = +o.most; return { quiet: EYEQ.quiet, most: EYEQ.most }; },
    overlay: () => OV,   // for tests: the overlay's objects (panel, cards, rings and their icons, people)
    subtitles: { split: s => subSplit(s), state: () => SUB },   // for tests: how a line is cut into captions, and where the strip is
    // the caption on show now ({ text, id }: '' none), the headsets' subtitles' words: the page's subtitles in focus mode
    // (HOST.focus in index.html) show these
    caption: () => { const r = captionNow(performance.now()); return { text: r[0], id: r[1] }; },
    // a station's icon on its own (tools/icons.html, after HOST.lowpoly()): { g, lean, spin, mesh, see, halo, model: its
    // miniature's key ('' the fallback) }, posed with pose(yaw, lean, t in s)
    icon: key => { const I = makeIcon(key); I.pose = (yaw, lean, t) => poseIcon(I, yaw, lean, t); return I; },
    // a story is about to start (HOST.start): in a headset at its station, it takes the station's place and panel
    starting,
    // All stories circles: HOST.start asks allPick first (a person's story there is the circle's pick, for everyone at it);
    // any one's story picked by its id ('all': back to its cards), its switch; the shell's own kinds (their look); the
    // first headset's circle and a page's arc (tests turn both off: autoAll(false), or localStorage collabAutoAll = off)
    allPick: key => allPick(key), allPickAt, setAllSync, session: () => sesSt(), kinds: () => KINDS, autoAll: on => { if (on !== undefined) C.autoAll = !!on; return C.autoAll; },
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
    smooth: () => ({ SMOOTH, BUF, RT }),   // (for tests: others' moves, smoothed)
  };
})();
