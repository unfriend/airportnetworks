// ================================================================================ THE VR GOGGLES (v197) ==
// A shape of kind 'goggles' (e6_items.js, e6d_shapes.js; our own low-poly pair, looks.js gogglesGeo): placed, moved,
// locked and grouped as any shape while editing. In a headset, with editing off, the grip takes them (the ray finds them
// as it finds what anyone may move) and carries them here alone: nothing is written, nobody else sees them move. Brought
// within the shell's WEAR.on of your head (flight.js, HOST.flight.WEAR) they go on: they are back where they stand at once
// and the shell's game is drawn over everything for you alone (HOST.flight: the cell of Back into the cell). While it is
// drawn the scene and the studio's panels are hidden for you (not unloaded), nothing of the studio is pointable, its sticks
// move nothing, the other circles are hidden and nothing real hides the game (the shell's occlusion asked for 'off'; depth
// sensing runs on). Taken off by the shell (the gesture, the menu's Goggles off, the session's end), or here: the goggles
// gone from the scene, editing turned on, the studio gone. Wearing is this device's own: never in state() or the layout.
const GOG_CARD = 'VR goggles: in a headset, with editing off, take them with the grip and bring them to your face to fly through the cell. Grip near your face and pull away to take them off. Each person\'s own.';
const GOG_ADD = 'A pair of goggles to put on in a headset: they fly you through the cell of Back into the cell, a game for one, sitting or standing still.';
const GOG = { asked: false, hid: false, last: '' };
const isGoggles = it => !!(it && it.kind === 'p' && it.rec && it.rec.shape === 'goggles');
// what a headset may put on here: goggles shown to you, editing off, the scene's own (a locked pair too: nothing moves)
const wearable = it => isGoggles(it) && XR.on && !editOn() && !!STU.scene && !!it.shown && !it.notHere && !it.hid;
// worn here, by this page
const gogOn = () => !!(HOST.flight && HOST.flight.on && HOST.flight.on() && HOST.flight.owner() === 'studio');
// the game drawn over the room now: the scene, its panels and pointing hidden
const gogHide = () => gogOn() && !!HOST.flight.shown();
// taken by the grip: the shell's game and its data fetched now, so they are ready at the face
function gogTaken(it) {
  if (HOST.flight) HOST.flight.prepare();
  else if (HOST.flightLoad) HOST.flightLoad().then(F => { if (F) F.prepare(); });
  plog('goggles taken', { id: it.id });
}
// carried (e8_xr.js carryItem, each frame): within the shell's reach of the head they go on
const _gg = new THREE.Vector3();
function gogCarry(c, it) {
  const F = HOST.flight;
  if (!F) return;
  it.holder.getWorldPosition(_gg);
  if (_gg.distanceTo(XR.head) > F.WEAR.on) return;
  // (v198: refused here, camera mode, a phone or no right controller: they stay in the hand, said once a carry)
  const why = F.whyNot();
  if (why) { if (!c.grab.said) { c.grab.said = true; F.wear({ owner: 'studio', id: it.id }); } return; }
  c.grab = null;
  gogBack(it, true);
  if (F.wear({ owner: 'studio', id: it.id })) { buzz(c, 0.6, 60); plog('goggles worn', { id: it.id }); }
  if (!xrHeld()) endChange();
}
// let go (or put on): back where their record stands, for you as for everyone
function gogBack(it, quiet) {
  it.carry = false; it.carryR = 0; it.gl = null;
  applyRec(it, it.rec, false);
  if (!quiet) sfxAct('drop', 'world', it.holder.getWorldPosition(new THREE.Vector3()).toArray());
}
// once a frame (e10_app.js, before the scene is drawn): the shell's module loaded once goggles are in the scene; taken off
// when they go, when editing is turned on or the scene changes; a page's preview stepped (tests: HOST.flight.debug.page)
function gogStep(dt) {
  try { gogScreens(performance.now()); } catch (e) { if (!GOGS.err) { GOGS.err = String(e.message || e); console.warn('the game screen:', e); } }
  let any = false;
  for (const it of STU.items.values()) if (isGoggles(it)) { any = true; break; }
  if (any && !HOST.flight && !GOG.asked && HOST.flightLoad) { GOG.asked = true; HOST.flightLoad().then(F => { if (!F) GOG.asked = false; }); }
  const F = HOST.flight;
  if (!F || F.owner() !== 'studio') { if (!XR.on && GOG.hid) { GOG.hid = false; GL.world.visible = true; } return; }
  if (gogOn() && !F.page()) {
    const it = STU.items.get(F.id());
    const why = !isGoggles(it) ? 'gone' : editOn() ? 'editing' : !STU.scene ? 'scene' : '';
    if (why) F.off(why);
  }
  if (!XR.on) {
    // (a page: the preview drawn from the page's camera; the scene hidden while it is drawn)
    if (F.on() && F.page()) F.pageFrame(GL.camera, dt);
    const hide = F.on() && F.shown();
    if (hide !== GOG.hid) { GOG.hid = hide; GL.world.visible = !hide; }
  }
}
function gogState() {
  const F = HOST.flight;
  return { loaded: !!F, on: gogOn(), hide: gogHide(), items: [...STU.items.values()].filter(isGoggles).map(it => ({ id: it.id, wearable: wearable(it), p: it.rec.p.slice(), size: it.rec.size.slice() })), flight: F ? F.state() : null,
    screen: { mats: GOGS.n, shows: GOGS.shows, lines: GOGS.lines.slice(), heard: GOGS.heard.size, sent: GOGS.sentN, err: GOGS.err } };
}

// ================================================================ THE GAME SCREEN (v203) ==
// The owner, 25 November 2026, in the studio tour's shuttle: "why don't we have a screen here?" A model's material named
// GameScreen (the tour's shuttle has one: tools/studio/tour/parts.js; any model of the owner's may) shows the goggles'
// flight for everyone here: this device's own while it wears them (a page's preview too), else the newest flight heard
// from the others at this station. A wearer's device sends the game's status as the ephemeral effect 'gog' (its counts,
// the protein scanned last, the next partner and their places, how far: never a pose, never in state() or the layout): on
// a change at most every GOGS.gap ms, again every GOGS.keep ms while on, and { on: 0 } as they come off; one not heard
// for GOGS.fresh ms is gone. Every such material on this device shares one picture, drawn again only when what it says
// changes (mipmapped, as a screen's card: e6q_screens.js scrTex). Older versions ignore the effect: nothing else changes.
const GOGS = { cv: null, tex: null, sig: '', lines: [], shows: '', heard: new Map(), sent: '', sentAt: 0, sentN: 0, wasOn: false, mine: null, last: null, mats: new WeakMap(), n: 0, err: '',
  keep: 3000, fresh: 8000, gap: 500 };
const GOG_NAME = /^gamescreen$/i;
// a model's GameScreen materials (its own clone's, lit and as scanned), found once a model
function gogScreenMats(it) {
  const m = it.model;
  if (!m || !m.meshes) return [];
  let L = GOGS.mats.get(m);
  if (L) return L;
  L = [];
  for (const n of m.meshes) for (const k of ['lit', 'scan']) for (const x of [].concat(n.userData[k] || [])) if (x && GOG_NAME.test(x.name || '') && !L.includes(x)) L.push(x);
  GOGS.mats.set(m, L);
  return L;
}
// the status this device sends and shows: its own flight's (the shell's game worn by this page), or null
function gogOwn() {
  const F = HOST.flight;
  if (!F || F.owner() !== 'studio' || !F.on() || !F.status) return null;
  return F.status();
}
const gogClip = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, n) : '');
const gogInt = v => (Number.isInteger(v) && v >= -1 && v <= 1e6 ? v : 0);
// the effect's data from a status (short keys; the same on every device: counts and names from the shared data)
function gogData(S) {
  return { on: 1, pa: S.paused ? 1 : 0, sc: S.scanned, fo: S.followed, bu: S.bumps, cur: S.cur, pl: S.place, nx: S.next, np: S.nextPlace, d: S.dist };
}
// another device's flight heard (studioEffect): kept by who sent it, checked field by field; { on: 0 } ends it
function gogHeard(data, by) {
  if (!data || typeof data !== 'object' || typeof by !== 'string' || !by) return;
  let me = '';
  try { me = HOST.collab.id || ''; } catch (e) { /* not in a room */ }
  if (by === me) return;
  const was = GOGS.heard.get(by);
  if (data.on !== 1) { if (was) GOGS.last = { who: by, d: was.d }; GOGS.heard.delete(by); return; }
  const d = { pa: data.pa === 1, sc: gogInt(data.sc), fo: gogInt(data.fo), bu: gogInt(data.bu), cur: gogClip(data.cur, 24), pl: gogClip(data.pl, 40), nx: gogClip(data.nx, 24), np: gogClip(data.np, 40), d: gogInt(data.d) };
  GOGS.heard.set(by, { at: performance.now(), d });
}
const gogWho = by => { try { const m = (HOST.collab.members || []).find(x => x && x.id === by); return m && m.name ? gogClip(String(m.name), 24) : 'Someone'; } catch (e) { return 'Someone'; } };
// once a frame (gogStep): send this device's flight, forget the silent ones, and put the picture on every GameScreen
function gogScreens(now) {
  const own = gogOwn();
  // (sent only at a station in a room: HOST.collab.effect says no elsewhere)
  if (own) {
    const d = gogData(own), sig = JSON.stringify(d);
    if ((sig !== GOGS.sent && now - GOGS.sentAt >= GOGS.gap) || now - GOGS.sentAt >= GOGS.keep) {
      GOGS.sent = sig; GOGS.sentAt = now;
      try { if (atStation() && HOST.collab.effect('gog', d, true) !== false) GOGS.sentN++; } catch (e) { /* not in a room now */ }
    }
    GOGS.wasOn = true; GOGS.mine = d;
  } else if (GOGS.wasOn) {
    GOGS.wasOn = false; GOGS.sent = ''; GOGS.sentAt = 0;
    if (GOGS.mine) GOGS.last = { who: '', d: { sc: GOGS.mine.sc, fo: GOGS.mine.fo, bu: GOGS.mine.bu } };
    try { if (atStation()) HOST.collab.effect('gog', { on: 0 }, true); } catch (e) { /* not in a room now */ }
  }
  for (const [by, h] of GOGS.heard) if (now - h.at > GOGS.fresh) { GOGS.last = { who: by, d: h.d }; GOGS.heard.delete(by); }
  // the materials (none: nothing drawn)
  let n = 0;
  for (const it of STU.items.values()) {
    if (it.kind !== 'o' || !it.model) continue;
    for (const m of gogScreenMats(it)) {
      n++;
      if (!GOGS.tex) { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; GOGS.cv = c; GOGS.tex = scrTex(c); }
      if (m.map !== GOGS.tex) { m.map = GOGS.tex; m.needsUpdate = true; }
    }
  }
  GOGS.n = n;
  if (n) gogDraw(own);
}
// what the screen says: the flight shown (this device's, else the newest heard), or nobody flying and the last flight
function gogDraw(own) {
  let who = '', d = own ? gogData(own) : null, more = 0;
  if (!d) {
    let best = null;
    for (const [by, h] of GOGS.heard) if (!best || h.at > best[1].at) best = [by, h];
    if (best) { who = gogWho(best[0]); d = best[1].d; d = { pa: d.pa ? 1 : 0, sc: d.sc, fo: d.fo, bu: d.bu, cur: d.cur, pl: d.pl, nx: d.nx, np: d.np, d: d.d }; more = GOGS.heard.size - 1; }
  } else more = GOGS.heard.size;
  let L;
  if (d) L = [who ? (d.pa ? who + ' has paused' : who + ' is flying') : (d.pa ? 'Your flight is paused' : 'You are flying'),
    'Scanned ' + d.sc + '   Links followed ' + d.fo + '   Drones hit ' + d.bu,
    d.cur ? 'Scanned last: ' + d.cur + (d.pl ? ' · ' + d.pl : '') : 'Nothing scanned yet: point the nose at a protein and pull the trigger.',
    d.nx ? 'Next: ' + d.nx + (d.np ? ' in ' + d.np : '') + (d.d >= 0 ? ', ' + d.d + ' m away' : '') : d.cur ? 'No partner left to visit from there: scan another protein.' : '',
    more > 0 ? (more === 1 ? 'And 1 more person flying.' : 'And ' + more + ' more people flying.') : ''];
  else {
    const P = GOGS.last;
    L = ['Nobody is flying now.', P ? 'Last flight' + (P.who ? ' (' + gogWho(P.who) + ')' : '') + ': scanned ' + P.d.sc + ', links followed ' + P.d.fo + ', drones hit ' + P.d.bu + '.' : '',
      'Put on the goggles from the shelf:', 'your flight shows here for everyone in the room.', ''];
  }
  const sig = L.join('|');
  if (sig === GOGS.sig) return;
  GOGS.sig = sig; GOGS.lines = L; GOGS.shows = d ? (own ? 'own' : 'heard') : 'nobody';
  const x = GOGS.cv.getContext('2d'), W = 1024, H = 512, F = '"Segoe UI", Arial, sans-serif';
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1b2740'); g.addColorStop(1, '#0a101c');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = '#7a4fd0'; x.fillRect(0, 0, W, 70);
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  const fit = (s, px, wt, col, y) => { let f = px; x.font = `${wt} ${f}px B612, ${F}`; while (x.measureText(s).width > W - 80 && f > 18) { f -= 2; x.font = `${wt} ${f}px B612, ${F}`; } x.fillStyle = col; x.fillText(s, 40, y); };
  fit('VR goggles: the flight through the cell', 34, '700', '#ffffff', 47);
  if (d) { fit(L[0], 52, '700', '#f2f6fc', 150); fit(L[1], 40, '700', '#ffd27a', 230); fit(L[2], 34, '600', '#dfe8f4', 310); fit(L[3], 34, '600', '#8ff0b4', 380); fit(L[4], 28, '600', '#9fb0c4', 460); }
  else { fit(L[0], 52, '700', '#f2f6fc', 170); fit(L[1], 34, '600', '#ffd27a', 250); fit(L[2], 36, '400', '#b8c6dc', 340); fit(L[3], 36, '400', '#b8c6dc', 390); }
  GOGS.tex.needsUpdate = true;
}
