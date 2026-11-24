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
  return { loaded: !!F, on: gogOn(), hide: gogHide(), items: [...STU.items.values()].filter(isGoggles).map(it => ({ id: it.id, wearable: wearable(it), p: it.rec.p.slice(), size: it.rec.size.slice() })), flight: F ? F.state() : null };
}
