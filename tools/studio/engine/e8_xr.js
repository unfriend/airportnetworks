// ================================================================= WEBXR ==
// Headset mode (built for Meta Quest, works in any WebXR browser). The scene stands life size round you, the side
// panel is redrawn on a canvas you point at, and labels become sprites on top or signs in the scene.
// Editing: point at an item to light it, pull the trigger (or pinch) to select it, and grip it to carry it: it follows
// your hand (and turns with it, moving freely), both grips size an object or a cut-out, the grip on a selected cube's
// or cut-out's corner stretches it; let go, it stays. While something is carried the sticks steer it (holdSticks): the
// left sizes it and turns it, the right pushes it away or pulls it in and turns it too. In VR, nothing carried, the left
// stick walks you through the scene and the right stick turns you (the scene moves, not you). The grip on the panel
// moves the panel. A and X do nothing (play and pause are on the panel). Record its movement (an item's card,
// e6f_path.js) arms the next grip as Hold it does, and what it carries is recorded until it is let go.
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true, lost: false,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), size: 1, globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  baseR: 0.36, R: 0.36, viewH: 1600, hitR: 1, target: new THREE.Vector3(),
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' }, pf: -1, pt: -1, pick: 'from',
  rot: new THREE.Quaternion(), free: false, lm: 'face', signL: new THREE.Quaternion(), signH: new THREE.Vector3(),
  walk: { x: 0, z: 0, yaw: 0 }, floorSpace: null, floorY: null, atSt: false, turnArm: true,
  hold: '',   // (Hold it: the selected item the next grip carries, wherever it points)
  rec: '',   // (Record its movement: the selected item the next grip carries and records, as Hold it; e6f_path.js)
};
const _xd = new THREE.Vector3(), _xp = new THREE.Vector3(), _xq = new THREE.Quaternion();
const _xq2 = new THREE.Quaternion(), _xm = new THREE.Matrix4(), _xinv = new THREE.Matrix4();
const _xa = new THREE.Vector3(), _xb = new THREE.Vector3(), _xc = new THREE.Vector3(), _xz = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------ scene pose --
const _xX = new THREE.Vector3(1, 0, 0), _xY = new THREE.Vector3(0, 1, 0);
// The scene is life size round you: outside a room its origin at the rig's floor point (where you stood as the session
// or the studio began, facing your way, or the anchored place), the floor the session's local-floor where it has one
// (its height in the renderer's local space), else a standing eye height under the rig. At a station in a shared room
// (v125; the owner, 8 November 2026: "align all things to the room marks and have the circle only be the entry") the
// scene's frame is the room's (xrRoomBase: the floor at y = 0, the origin and axes the room's; on a room calibrated on
// its floor spots spot A, x towards spot B), so every item stands at one place in the real room whichever circle shows
// it and wherever that circle stands: the rig (and the panels on it) is the station's spot, and the scene hangs from it
// at the room's origin, so moving or turning the circle moves nothing of the scene. The VR stick walk moves the scene
// (XR.walk, in the rig's frame), never the rig; views do not move it
const XR_EYE = 1.6, XR_AHEAD = 0;
const _xRB = new THREE.Matrix4(), _xRW = new THREE.Matrix4(), _xRS = new THREE.Vector3();
function xrPlace(v) {
  XR.R = 1; XR.hitR = 1; XR.target.set(0, 0, 0);
  const fy = XR.atSt || XR.floorY === null ? -XR_EYE : XR.floorY - GL.rig.position.y;
  GL.world.scale.setScalar(1);
  GL.world.quaternion.setFromAxisAngle(_xY, XR.walk.yaw);
  GL.world.position.set(XR.walk.x, fy, XR.walk.z);
  XR.globeBase.set(0, fy, 0);
  if (XR.atSt && xrRoomBase(_xRB)) {
    _xRW.makeRotationY(XR.walk.yaw).setPosition(XR.walk.x, 0, XR.walk.z).multiply(_xRB);
    _xRW.decompose(GL.world.position, GL.world.quaternion, _xRS);
  }
}
// the room's frame in the rig's (into out), or null: the shell's room matrix (room coordinates to the renderer's space,
// as it places the rig at the station: HOST.room.place) seen from the rig as it stands this frame. A shell without
// HOST.room.matrix: null (the scene at the spot, as before v125)
function xrRoomBase(out) {
  let m = null;
  try { m = HOST.room && HOST.room.matrix ? HOST.room.matrix() : null; } catch (e) { m = null; }
  if (!m) return null;
  GL.rig.updateMatrix();
  return out.copy(GL.rig.matrix).invert().multiply(m);
}
// Recenter (the panel's button and the shell's menu, through recenter in the object the story returns): you in front of
// it again (anchored: Place again); at a station in a shared room the station's scene and panel go back where the story
// puts them instead, for everyone at its circle (the shell's HOST.room.recenter, refused while its story is locked)
function xrRecenterAsk() {
  if (HOST.room && HOST.room.recenter && HOST.room.placing && HOST.room.placing()) return HOST.room.recenter();
  if (HOST.anchor.on) HOST.anchor.again();
  XR.needRecenter = true;
  return true;
}
function xrRecenter() {
  XR.globeOff.set(0, 0, 0); XR.size = 1; XR.rot.identity();
  XR.walk.x = XR.walk.z = XR.walk.yaw = 0;   // (the stick walk goes back too: you where you stand)
  if (XR.panelGroup) xrPanelPose(XR.panelHome.p, XR.panelHome.yaw);
  // anchored: the scene and the panel go back where they were saved with the place
  const s = HOST.anchor.saved();
  if (s) { XR.globeOff.fromArray(s.off); XR.size = s.s || 1; xrSceneRot(s.q); if (XR.panelGroup) xrPanelPose(s.pp, s.pr, s.pq); }
  const yaw = new THREE.Euler().setFromQuaternion(XR.headQ, 'YXZ').y;
  GL.rig.position.copy(XR.head);
  GL.rig.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

// ------------------------------------------------- labels and free moving --
// The shell's headset settings, the same for everyone in a shared room (HOST.xr; read every frame, and a shell
// without them means labels on top and nothing free): the scene's small labels 'face' (on top: sprites turned to you,
// over everything), 'fixed' (in 3D: upright signs in the scene, turned to you) or 'hidden'; the cards (the story panels
// here, the station cards and name tags in the shell) the same three ways, independent of the labels (a shell without
// them: as the labels); free moving holds what the grip takes like a real object.
const xrLabelMode = () => (HOST.xr && HOST.xr.labels ? HOST.xr.labels() : 'face');
const xrCardMode = () => (HOST.xr && HOST.xr.cards ? HOST.xr.cards() : xrLabelMode());
const xrFreeOn = () => !!(HOST.xr && HOST.xr.free && HOST.xr.free());
const xrSig = () => (HOST.xr && HOST.xr.sig ? HOST.xr.sig() : '') + (HOST.panels && HOST.panels.sig ? HOST.panels.sig(XR_HERE) : '') + (xrAllHere() ? 'A' : '');
// the shell moving this headset with the sticks in VR (HOST.xr.walking): the story's own stick use waits meanwhile
const xrWalking = () => !!(HOST.xr && HOST.xr.walking && HOST.xr.walking());
// this story's panels in a headset (the shell's HOST.panels, each story its own; at a station in a shared room the
// station's, for everyone at that circle): 'shown', 'controls' (only the foot bar) or 'hidden' (neither: play and pause
// on the menu's Story tab); a shell without it: shown
const xrPanels = () => (HOST.panels && HOST.panels.get ? HOST.panels.get(XR_HERE) : 'shown');
// a headset in a shared room (the shell's HOST.room): no Stories screen there, a story runs only at its station (reached
// by walking into its circle), and away from one it is hidden, not pointable, paused and silent. A shell without
// HOST.room.away: as before (only at a station is the story the station's)
const xrRoomOnly = () => !!(HOST.room && HOST.room.away && HOST.room.inRoom());
const xrAway = () => !!(HOST.room && HOST.room.away && HOST.room.away());
// an All stories circle in a shared room (the shell's HOST.room: cards, its live station shows its cards; allHere, it is
// one, its cards or a story picked there): the single-player Stories screen there, a card picking for everyone at the
// circle, and the story panel's Stories button back to the cards for them. A shell without them: as before
const xrCards = () => !!(HOST.room && HOST.room.cards && HOST.room.cards());
const xrAllHere = () => !!(HOST.room && HOST.room.allHere && HOST.room.allHere());
// the line on show, for the shell's subtitles in a headset (HOST.xr.subs, drawn by shared.js): the chapter on show's cues
// (ST.items: els with at and out), the story time now, the chapter's end and narrT (to the clock's time); null in
// explore mode, on the Stories screen and away from a station
const xrCaption = () => {
  if (APP.mode !== 'story' || XR.stories || xrAway()) return null;
  const s = storyT(APP.t), c = CH.find(x => s >= x.a && s < x.b) || CH[CH.length - 1], it = ST.items.find(x => x.ch === c);
  return it ? { s, end: c.b, els: it.els, narrT } : null;
};
const _fq = new THREE.Quaternion(), _fv = new THREE.Vector3();
// the yaw of a turn: where its front (+z) points along the floor (def when it points straight up or down)
function yawOf(q, def) { _fv.set(0, 0, 1).applyQuaternion(q); return Math.hypot(_fv.x, _fv.z) < 1e-4 ? +def || 0 : Math.atan2(_fv.x, _fv.z); }
// a turn from the shell or the room ([x, y, z, w] or a quaternion) into q; false when there is none
function xrQ(v, q) {
  if (v && v.isQuaternion) { q.copy(v); return true; }
  if (!Array.isArray(v) || v.length !== 4 || !v.every(Number.isFinite) || !v.some(x => x)) return false;
  q.fromArray(v).normalize();
  return true;
}
// the scene's own turn (free moving only: otherwise it faces you)
function xrSceneRot(q) { if (!(xrFreeOn() && xrQ(q, XR.rot))) XR.rot.identity(); }
// the story panel at p in the rig, upright at yaw, or (free moving) held at the turn q
function xrPanelPose(p, yaw, q) {
  const g = XR.panelGroup;
  if (p && p.isVector3) g.position.copy(p); else if (p) g.position.fromArray(p);
  if (!(xrFreeOn() && xrQ(q, g.quaternion))) g.rotation.set(0, +yaw || 0, 0);
}
// a turn of the hand (in the room) as a turn in the rig's frame, where the scene and the panel hang
function xrRigTurn(q, out) { return out.copy(GL.rig.quaternion).invert().multiply(q).multiply(_fq.copy(GL.rig.quaternion)); }
// the scene's facing, into q: from its placement point (gx, gy, gz) towards you; moving freely, from its home place,
// then turned by XR.rot
function xrFace(q, gx, gy, gz) {
  if (XR.free) _fv.copy(XR.globeBase).negate(); else _fv.set(-gx, -gy, -gz);
  q.setFromUnitVectors(_xz, _fv.normalize());
  if (XR.free) q.premultiply(XR.rot);
  return q;
}
// once a frame: the settings as they are now; free moving turned off gives the scene back its facing and stands the
// panel up again (its yaw kept), and turned on it keeps the scene's facing as it is (no jump)
function xrSettings() {
  XR.lm = xrLabelMode(); XR.cm = xrCardMode();
  const free = xrFreeOn();
  if (free === XR.free) return;
  if (!free) { XR.rot.identity(); XR.panelGroup.rotation.set(0, yawOf(XR.panelGroup.quaternion, 0), 0); }
  else if (XR.globeOff.lengthSq() > 1e-8) {
    _fv.copy(XR.globeBase).add(XR.globeOff).negate().normalize();
    XR.rot.setFromUnitVectors(_xz, _fv).multiply(_fq.setFromUnitVectors(_xz, _fv.copy(XR.globeBase).negate().normalize()).invert());
  } else XR.rot.identity();
  XR.free = free;
}

// ---------------------------------------------------------------- labels --
const LBL_STYLE = { '': ['#f2f6fc', null], mag: ['#ffd2f4', '#ff5ad9'], amb: ['#ffe2b0', '#ffb43b'],
  grn: ['#c9ffe3', '#3ee08f'], cyn: ['#d2f6ff', '#46d9ff'], tip: ['#e7eef8', '#46d9ff'] };
// a label's picture, shared by its sprite and its sign
function labelTex(L) {
  if (L.ltex) return L.ltex;
  let bold, rest, cls;
  if (L.txt) [bold, rest, cls] = L.txt;
  else {
    const b = L.el.querySelector('b');
    bold = b ? b.textContent : ''; rest = L.el.textContent.slice(bold.length).trim();
    cls = ['mag', 'amb', 'grn', 'cyn'].find(k => L.el.classList.contains(k)) || '';
  }
  const px = 34, H = 56, pad = 16, gap = bold && rest ? 10 : 0;
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  ctx.font = vfont(px, 700); const wb = bold ? ctx.measureText(bold).width : 0;
  ctx.font = vfont(px); const wr = rest ? ctx.measureText(rest).width : 0;
  cv.width = Math.ceil(pad * 2 + wb + gap + wr); cv.height = H;
  const [col, acc] = LBL_STYLE[cls] || LBL_STYLE[''];
  ctx.save(); rr(ctx, 0, 0, cv.width, H, 8); ctx.clip();
  ctx.fillStyle = cls === 'tip' ? 'rgba(10,19,34,0.97)' : 'rgba(3,8,16,0.82)'; ctx.fillRect(0, 0, cv.width, H);
  if (acc) { ctx.fillStyle = acc; ctx.fillRect(0, 0, 5, H); }
  ctx.restore();
  ctx.textBaseline = 'middle'; ctx.fillStyle = col;
  ctx.font = vfont(px, 700); ctx.fillText(bold, pad, H / 2 + 1);
  ctx.font = vfont(px); ctx.fillText(rest, pad + wb + gap, H / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return (L.ltex = { tex, aspect: cv.width / H, tip: cls === 'tip' });
}
// labels on top: a sprite turned to you, drawn over everything, beside its point
function labelSprite(L) {
  if (L.sprite) return L.sprite;
  const t = labelTex(L);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.renderOrder = t.tip ? 11 : 10;
  sp.userData.aspect = t.aspect;
  sp.center.set(-0.35 / sp.userData.aspect, 0.5);
  GL.world.add(sp);
  return (L.sprite = sp);
}
// labels in 3D: a flat sign at the sprite's place and size, turned to you each frame, readable from both sides (a quad facing +z and one facing
// -z with its picture flipped, so its text never reads mirrored), in the scene's depth: what stands in front of it
// hides it, and it hides what is behind it (drawn first of the see-through things; its clear corners cut away)
function labelSign(L) {
  if (L.sign) return L.sign;
  const t = labelTex(L), a = 0.35 / t.aspect, b = a + 1;   // (in its width, as the sprite's centre)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a, -0.5, 0, b, -0.5, 0, b, 0.5, 0, a, 0.5, 0, a, -0.5, 0, b, -0.5, 0, b, 0.5, 0, a, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
  const sg = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, alphaTest: 0.1 }));
  sg.renderOrder = -1;
  sg.userData.aspect = t.aspect;
  GL.world.add(sg);
  return (L.sign = sg);
}
function dropSprite(L) {
  if (!L) return;
  for (const k of ['sprite', 'sign']) {
    const o = L[k];
    if (!o) continue;
    if (o.parent) o.parent.remove(o);
    if (k === 'sign') o.geometry.dispose();
    o.material.dispose();
    L[k] = null;
  }
  if (L.ltex) { L.ltex.tex.dispose(); L.ltex = null; }
}
function hideLabelXR(L) { if (L.sprite) L.sprite.visible = false; if (L.sign) L.sign.visible = false; }
function placeLabelXR(L, alpha, S) {
  // on top (a sprite), in 3D (a sign) or hidden, as the shell's setting says; the pointer's tip is always a sprite
  const m = L === XR.tip ? 'face' : XR.lm, fixed = m === 'fixed';
  if (alpha <= 0.001 || m === 'hidden') { hideLabelXR(L); return; }
  if (fixed ? L.sprite : L.sign) (fixed ? L.sprite : L.sign).visible = false;
  const sp = fixed ? labelSign(L) : labelSprite(L), o = alpha;
  sp.visible = o > 0.01;
  sp.material.opacity = o;
  labelPos(L, sp.position);
  const hm = 0.021 * Math.max(1, sp.position.distanceTo(XR.camLocal));   // the same size to the eye, near or far
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
  if (fixed) {
    // upright and turned to you, about the vertical only (the rig's frame): a sign in the scene, not a sprite on top
    _fv.copy(sp.position).applyMatrix4(GL.world.matrix);
    sp.quaternion.copy(XR.signL).multiply(_fq.setFromAxisAngle(_xY, Math.atan2(XR.signH.x - _fv.x, XR.signH.z - _fv.z)));
  }
}
function xrTip() {}

// ----------------------------------------------------------- controllers --
function xrController(i) {
  const g = GL.renderer.xr.getController(i);
  const c = { i, g, src: null, hover: null, press: null, grab: null, wantPress: false, o: new THREE.Vector3(), d: new THREE.Vector3() };
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  c.ray = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
  c.ray.renderOrder = 60;
  g.add(c.ray);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
  g.add(tip);
  c.dot = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
  c.dot.renderOrder = 61; c.dot.visible = false;
  GL.scene.add(c.dot);
  g.visible = false;
  g.addEventListener('connected', e => { c.src = e.data; c.ray.visible = e.data.targetRayMode !== 'screen'; });
  g.addEventListener('disconnected', () => { c.src = null; c.press = null; xrLetGo(c); c.hover = null; c.wantPress = false; c.dot.visible = false; });
  // presses are handled on the next frame, once the ray has its fresh pose
  g.addEventListener('selectstart', () => { c.wantPress = true; });
  g.addEventListener('selectend', () => { if (c.wantPress) { c.wantPress = false; xrPress(c); } xrRelease(c); });
  g.addEventListener('squeezestart', () => xrGrab(c, true));
  g.addEventListener('squeezeend', () => xrGrab(c, false));
  GL.scene.add(g);
  XR.ctrls.push(c);
}
function buzz(c, s, ms) {
  try {
    const a = c.src && c.src.gamepad && c.src.gamepad.hapticActuators;
    if (a && a[0] && a[0].pulse) a[0].pulse(s || 0.3, ms || 18);
  } catch (e) { /* no haptics */ }
}
function xrPress(c) {
  const h = c.hover;
  c.press = null;
  if (!h) { if (editOn() && !XR.stories && !STU.pick && !STU.txp && !STU.follow && !STU.gpick && APP.mode === 'explore') select(''); return; }   // (pointing at nothing: no selection)
  if (h.kind === 'shell') { HOST.collab.press(c.i); return; }   // the shared room's panel, previews, calibration
  if (h.kind === 'panel') {
    const r = h.P.at(h.x, h.y);
    if (!r) return;
    c.press = { kind: 'panel', P: h.P, id: r.id, r };
    if (r.drag) { r.drag(h.x, h.y); buzz(c, 0.2, 12); }
  } else if (h.kind === 'item' && !XR.stories) {   // the trigger (or a pinch) on an item selects it (or, picking for a cube, puts it on the cube's list)
    c.press = { kind: 'item' };
    pressItem(h.id, h.ray); buzz(c, 0.4, 30);
  } else if (h.kind === 'floor' && editOn() && !STU.pick && !STU.txp && !STU.follow && !STU.gpick) select('');
}
function xrRelease(c) {
  const p = c.press;
  c.press = null;
  if (!p) return;
  if (p.kind === 'panel') {
    if (p.r.drag) return;
    const h = c.hover;
    if (h && h.kind === 'panel' && h.P === p.P) {
      const r = h.P.at(h.x, h.y);
      // (a soft click at the button, unless the press made a sound of its own: the shell's rule for page buttons)
      if (r && r.id === p.id && r.fn) { buzz(c); const n = sfxN(); r.fn(); if (sfxN() === n) sfxPlay('click', 'world', h.point); }
    }
  }
}
const _gw = new THREE.Vector3(), _gwq = new THREE.Quaternion();
// the items move in the scene's own frame, never the rig: an anchored place (HOST.anchor.locked outside a room) leaves
// them free to edit; in a shared room the room's word on the grip holds them (away from its station, its story locked)
const itemGripLocked = () => { try { return !!(HOST.room && HOST.room.inRoom && HOST.room.inRoom() && HOST.room.gripLocked && HOST.room.gripLocked()); } catch (e) { return false; } };
function xrGrab(c, on) {
  xrLetGo(c);
  const h = on ? holdHover(c) : c.hover;
  if (!on || !h) return;
  if (XR.stories || h.menu || (h.kind === 'item' ? itemGripLocked() : HOST.anchor.locked(h.kind))) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  if (h.kind === 'item') {   // an item (editing), taken where it is: it keeps its offset from the hand; a cube's corner stretches it
    const it = STU.items.get(h.id);
    if (!it || !editOn()) return;
    // (taken where it stands, not where its motion draws it; a sound or a cut-out with what it is on: e6e_motion.js)
    poseRest(it); if ((it.kind === 's' || it.kind === 'x') && STU.items.get(it.rec.on)) poseRest(STU.items.get(it.rec.on));
    GL.world.updateMatrixWorld(true);
    const q0 = new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert();
    // (locked in place: refused, with a short buzz and a knock, and said on its card; e6d_shapes.js)
    const refuse = x => { buzz(c, 0.15, 12); lockRefused(x); };
    if (it.kind === 'g') { if (lockWhy(it)) refuse(it); else groupGrab(c, it, q0); return; }   // (a group selected, held by Hold it: the whole group)
    // (a group's member, unless it is selected on its own: its whole group. The other hand carrying its group: this one
    // joins it, a corner too. The other hand carrying a member of its group on its own (or by a corner): this one alone,
    // never the group round what that hand holds)
    const gOf = GROUP_KINDS.includes(it.kind) ? groupOf(it.id) : null, other = XR.ctrls.filter(k => k !== c && k.grab);
    if (REC && REC.id === it.id) { buzz(c, 0.15, 12); return; }   // (recording its path: one hand carries it, a path has no size)
    const solo = !!gOf && other.some(k => (k.grab.target === 'item' || k.grab.target === 'corner') && (k.grab.id === it.id || groupOf(k.grab.id) === gOf));
    const grp = gOf && (other.some(k => k.grab.target === 'group' && k.grab.id === gOf.id) || (h.corner === undefined && STU.sel !== it.id && !solo)) ? gOf : null;
    if (grp) { if (lockWhy(grp)) refuse(grp); else groupGrab(c, grp, q0); return; }
    if (lockWhy(it)) { refuse(it); return; }
    if (h.corner !== undefined && it.kind === 'c') {
      const k = h.corner, sg = [k & 1 ? 1 : -1, k & 2 ? 1 : -1, k & 4 ? 1 : -1], r = it.rec;
      // the opposite corner stays where it is (the scene's frame); the hand keeps its offset from the corner it took
      const opp = new THREE.Vector3(-sg[0] * r.size[0] / 2, -sg[1] * r.size[1] / 2, -sg[2] * r.size[2] / 2).applyAxisAngle(_xY, r.yaw).add(_gw.fromArray(r.p));
      const cor = new THREE.Vector3(sg[0] * r.size[0] / 2, sg[1] * r.size[1] / 2, sg[2] * r.size[2] / 2).applyAxisAngle(_xY, r.yaw).add(_gw.fromArray(r.p));
      c.grab = { target: 'corner', id: it.id, sg, opp, off: cor.sub(GL.world.worldToLocal(c.o.clone())), at: 0 };
    } else if (h.corner !== undefined && (it.kind === 'x' || it.kind === 'p')) {
      // a cut-out's corner (or a shape's, a cube): as a cube's, its box turned as it is (a full turn), the turn kept while it
      // stretches
      const k = h.corner, sg = [k & 1 ? 1 : -1, k & 2 ? 1 : -1, k & 4 ? 1 : -1], q = it.holder.quaternion.clone(), s = it.holder.scale, P = it.holder.position;
      const opp = new THREE.Vector3(-sg[0] * s.x / 2, -sg[1] * s.y / 2, -sg[2] * s.z / 2).applyQuaternion(q).add(P);
      const cor = new THREE.Vector3(sg[0] * s.x / 2, sg[1] * s.y / 2, sg[2] * s.z / 2).applyQuaternion(q).add(P);
      c.grab = { target: 'corner', id: it.id, sg, opp, q, off: cor.sub(GL.world.worldToLocal(c.o.clone())), at: 0 };
    } else {
      c.grab = { target: 'item', id: it.id, q0, o0: c.o.clone(), p0: it.holder.getWorldPosition(new THREE.Vector3()), r0: it.holder.getWorldQuaternion(new THREE.Quaternion()), reach: 1, at: 0,
        s0: it.holder.scale.clone(), rr: it.kind === 's' ? it.rec.r : 0, kz: 1, sth: 0 };   // (the sticks' size and turn from here: holdSticks)
    }
    beginChange([it.id]);
    it.carry = true; it.gl = null;
    select(it.id);   // (carried, it rests where it is placed, its path and motion too: motionRests)
    // (Record its movement armed: what this hand carries is recorded until it lets go, unless the other hand holds it too)
    if (h.rec && c.grab.target === 'item' && !other.some(k => k.grab.id === it.id)) recBegin(it, 'xr', c);
    buzz(c, 0.4, 25); sfxAct('grab', 'world', c.grab.p0 || null);   // (sound effects: picked up)
    return;
  }
  if (h.kind !== 'panel') return;   // the scene stays where it is: only the panel and the items move
  const p0 = XR.panelGroup.getWorldPosition(new THREE.Vector3());
  c.grab = { target: 'panel', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0, reach: 1, r0: XR.panelGroup.quaternion.clone() };
  buzz(c, 0.4, 25);
}
// Hold it (a selected item's card, in a headset): the next grip of either hand, wherever it points, carries the selected
// item as a grip on it would (from where it stands: it keeps its offset from the hand), so a thing too big or too far to
// point at (a room scan you stand in) can be carried; once, then disarmed. Not at the shell's menu or a station (the
// shell takes those grips itself) or at the studio's own panel (the grip moves it): it stays armed then. Disarmed by
// another selection, editing off, or the session's end
// (Record its movement, XR.rec, arms it the same way, and what it carries is recorded: rec)
function holdHover(c) {
  const h = c.hover, rec = !!XR.rec, id = XR.rec || XR.hold;
  if (!id || (h && (h.kind === 'shell' || h.kind === 'panel' || h.menu))) return h;   // (the grip on a panel moves the panel)
  XR.hold = XR.rec = '';
  dirty(true);
  const it = STU.items.get(id);
  return it && id === STU.sel && editOn() ? { kind: 'item', id, hold: true, rec } : h;
}
const holdStep = () => {
  if (XR.hold && (XR.hold !== STU.sel || !editOn() || !XR.on)) { XR.hold = ''; dirty(true); }
  if (XR.rec && (XR.rec !== STU.sel || !editOn() || !XR.on)) { XR.rec = ''; dirty(true); }
};
// let go of an item (the grip up, the controller gone, or locked meanwhile): it stays where it is (its record written),
// unless the other hand still holds it
function xrLetGo(c) {
  const G = c.grab;
  c.grab = null;
  if (G && G.target === 'group') { groupLetGo(c, G); return; }
  if (!G || (G.target !== 'item' && G.target !== 'corner')) return;
  const o = XR.ctrls.find(k => k !== c && k.grab && k.grab.id === G.id);
  if (o) { if (o.grab.target === 'item') xrRegrip(o); return; }
  const it = STU.items.get(G.id);
  // (recording its path: kept, its place as it was; e6f_path.js. Else where the hand left it)
  if (it) { if (REC && REC.id === it.id && REC.by === 'xr') recEnd(true); else carryWrite(it, true); it.carry = false; it.carryR = 0; sfxAct('drop', 'world', it.holder.getWorldPosition(new THREE.Vector3()).toArray()); }
  // (one Undo step for both hands: it ends once neither carries anything)
  if (!xrHeld()) endChange();
}
// a hand's hold taken from it (what it held removed, here or from the room: removeItem; gone as it was carried): its
// change ends once nothing else is held, so Undo and Unsaved changes work again at once (its grip coming up finds nothing
// to let go). Once a frame, after the hands, never inside a change
function xrHeld() { return XR.ctrls.some(k => k.grab && ['item', 'corner', 'group'].includes(k.grab.target)); }
function xrLost() {
  if (!XR.lost) return;
  XR.lost = false;
  if (SNAP && !xrHeld() && !X.tcDrag) endChange();
}
// the grip on a group's member: the whole group, taken where it stands (its members carried, one change); the other hand
// on a member of the same group joins it (both size it about its pivot)
function groupGrab(c, g, q0) {
  const o = XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'group' && k.grab.id === g.id);
  if (!o) groupHold(g);
  const B = g.base, P = GL.items.localToWorld(B.P.clone().add(g.T.t));
  c.grab = { target: 'group', id: g.id, q0, o0: c.o.clone(), p0: P, reach: 1, th0: g.T.th, k0: g.T.k, kz: 1, sth: 0, at: 0, base: B };
  select(g.id);
  buzz(c, 0.4, 25); sfxAct('grab', 'world', P.toArray());
}
// one hand lets go of a group: the other, if it holds the group too, carries on from there; else it stays where it is
// (every member's record written), and the change ends once nothing is carried
function groupLetGo(c, G) {
  const g = STU.items.get(G.id), o = XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'group' && k.grab.id === G.id);
  if (o) { groupRegrip(o); return; }
  if (g && g.kind === 'g' && g.base) { groupMove(g.base, g.T.t, g.T.th, g.T.k, true); sfxAct('drop', 'world', GL.items.localToWorld(g.base.P.clone().add(g.T.t)).toArray()); groupRelease(g); }
  else groupRelease(null, G.base);
  if (!xrHeld()) endChange();
}
// a hand that holds a group alone again carries on from where it is now
function groupRegrip(c) {
  const G = c.grab, g = STU.items.get(G.id);
  if (!g || !g.base) return;
  G.two = null; G.q0.setFromRotationMatrix(c.g.matrix).invert(); G.o0.copy(c.o); G.reach = 1; G.th0 = g.T.th; G.k0 = g.T.k; G.kz = 1; G.sth = 0;
  G.p0.copy(GL.items.localToWorld(g.base.P.clone().add(g.T.t)));
}
// a hand that holds an item alone again (the other let go) carries on from where it is now
function xrRegrip(c) {
  const G = c.grab, it = STU.items.get(G.id);
  if (!it) return;
  G.two = null; G.q0.setFromRotationMatrix(c.g.matrix).invert(); G.o0.copy(c.o); G.reach = 1;
  it.holder.getWorldPosition(G.p0); it.holder.getWorldQuaternion(G.r0);
  G.s0 = it.holder.scale.clone(); G.kz = 1; G.sth = 0; if (it.kind === 's') G.rr = it.carryR || it.rec.r;   // (the sticks from here)
}
// what a carried item's holder shows, into its record (at most ten times a second while it moves, and as it is let go)
function carryWrite(it, now) {
  const t = performance.now();
  if (!now && t - (it.wrote || 0) < 100) return;
  it.wrote = t;
  const h = it.holder;
  if (it.kind === 'o') setObj(it.id, { p: h.position.toArray(), q: h.quaternion.toArray(), s: h.scale.x });   // (sized by both grips: its sounds keep their place on it)
  else if (it.kind === 'c') setRec(it.id, { p: h.position.toArray(), yaw: new THREE.Euler().setFromQuaternion(h.quaternion, 'YXZ').y, size: h.scale.toArray() });
  else if (it.kind === 'x') setRec(it.id, cutRecOf(it));   // (in the frame of the object it cuts)
  else if (it.kind === 'p') setRec(it.id, { p: h.position.toArray(), q: h.quaternion.toArray(), size: h.scale.toArray().map(v => clamp(v, 0.01, 100)) });
  else if (it.kind === 'e') setRec(it.id, { p: h.position.toArray(), q: h.quaternion.toArray() });
  else setRec(it.id, Object.assign(soundAt(it, h.position), it.carryR ? { r: it.carryR } : {}));   // (a sound that follows a model: its offset from where the hand puts it; its reach as the left stick sizes it)
}
const _gq = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gh = new THREE.Vector3(), _gr = new THREE.Quaternion();
// the grabbed object keeps its offset from the controller, so moving or turning your hand carries it (moving freely,
// it also turns with your hand, about it: what you hold stays in your hand)
function carry(c, dt) {
  const G = c.grab, gp = c.src.gamepad;
  // both hands on the scene resize it (xrResize, once a frame); when one lets go, the other carries on from there
  if ((G.target === 'item' || G.target === 'corner' || G.target === 'group') ? itemGripLocked() || !editOn() || !!lockWhy(STU.items.get(G.id)) : HOST.anchor.locked(G.target === 'panel' ? 'panel' : 'globe')) { xrLetGo(c); return; }   // locked meanwhile (a shared room's story lock: Lock this story; the item locked in place)
  if (G.target === 'item') { carryItem(c, dt); return; }
  if (G.target === 'group') { carryGroup(c, dt); return; }
  if (G.target === 'corner') { stretchCube(c); return; }
  const o = G.target === 'globe' ? XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'globe' && k.src && k.g.visible) : null;
  if (o) { if (c.i > o.i) xrResize(o, c); return; }
  if (G.two) { G.two = null; G.q0.setFromRotationMatrix(c.g.matrix).invert(); G.o0.copy(c.o); G.p0.copy(GL.rig.localToWorld(XR.globeBase.clone().add(XR.globeOff))); G.reach = 1; G.r0.copy(XR.rot); }
  if (gp && gp.axes.length >= 4 && Math.abs(gp.axes[3]) > 0.2) G.reach = clamp(G.reach * Math.exp(gp.axes[3] * dt * 1.5), 0.15, 6);
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  const lenMax = 4;
  if (_gv.length() > lenMax) _gv.setLength(lenMax);
  _gv.applyQuaternion(_gq).add(c.o);
  GL.rig.worldToLocal(_gv);
  if (G.target === 'globe') {
    XR.globeOff.copy(_gv).sub(XR.globeBase);
    if (XR.free) XR.rot.copy(xrRigTurn(_gq, _gr)).multiply(G.r0);
  } else {
    XR.panelGroup.position.copy(_gv);
    if (XR.free) { XR.panelGroup.quaternion.copy(xrRigTurn(_gq, _gr)).multiply(G.r0); return; }   // held as it is: it may tilt
    GL.rig.worldToLocal(_gh.copy(XR.head));
    XR.panelGroup.rotation.set(0, Math.atan2(_gh.x - _gv.x, _gh.z - _gv.z), 0); // keep it upright, facing you
  }
}
// both hands on the scene: it grows and shrinks with the distance between them (a quarter to four times the
// story's own size) and moves with their middle; moving freely, the line between them turns it about their middle
function xrResize(a, b) {
  const d = a.o.distanceTo(b.o);
  _gv.copy(a.o).add(b.o).multiplyScalar(0.5);
  GL.rig.worldToLocal(_gv);
  _gh.copy(b.o).sub(a.o).applyQuaternion(_gr.copy(GL.rig.quaternion).invert()).normalize();   // (in the rig's frame)
  const T = a.grab.two || (a.grab.two = b.grab.two = { d0: Math.max(0.05, d), s0: XR.size, m0: _gv.clone(), off0: XR.globeOff.clone(), l0: _gh.clone(), r0: XR.rot.clone() });
  XR.size = clamp(T.s0 * d / T.d0, 0.25, 4);
  XR.globeOff.copy(T.off0).add(_gv).sub(T.m0);
  if (!XR.free) return;
  _gq.setFromUnitVectors(T.l0, _gh);
  XR.rot.copy(_gq).multiply(T.r0);
  XR.globeOff.copy(XR.globeBase).add(T.off0).sub(T.m0).applyQuaternion(_gq).add(_gv).sub(XR.globeBase);
}
// The sticks while something is carried (the owner, 6 November 2026: "Things in edit mode should be turnable and zoomable
// with the sticks once grabbed like the models in the stories"; "left stick up down is zoom, left stick right left is turn,
// right stick up down is move away, move to me, right stick left right is also turn for now"), whichever hand carries it:
// the left stick up sizes it up (twice the size in 1.5 s held fully) and down sizes it down, about its middle (a group
// about its pivot), within what both grips and the size steps allow (a twentieth to twenty times, and each record's own
// limits: an object's cut-outs and the sounds following it keep their place on it, scaleFollowers; a shape's, a cube's
// and a cut-out's sides, a sound's reach); left and right turn it about the vertical (90 degrees a second, pushed right
// its near side goes right); the right stick up pushes it away along the carrying ray and down pulls it in, and left and
// right turn it too. A hand that carries something else itself steers that with its own stick. A dead zone of 0.2, then
// the rate rises with the push (its square). All of it part of the carry: written with its records, one Undo step
const HOLD = { dz: 0.2, grow: Math.LN2 / 1.5, turn: Math.PI / 2, push: 1.5 };
const steers = k => !!(k.grab && (k.grab.target === 'item' || k.grab.target === 'group'));
// a hand's stick ([x, y] past the dead zone, each -1 to 1) for the carry of hand c: its own, or the other hand's while
// that one carries nothing else (both hands on one thing: either)
function holdStick(c, hand) {
  const k = XR.ctrls.find(x => x.src && x.g.visible && x.src.handedness === hand), gp = k && k.src.gamepad;
  if (!gp || !gp.axes || gp.axes.length < 4 || (k !== c && steers(k) && k.grab.id !== c.grab.id)) return [0, 0];
  return [gp.axes[2], gp.axes[3]].map(v => { const m = (Math.abs(v) - HOLD.dz) / (1 - HOLD.dz); return m > 0 ? Math.sign(v) * m * m : 0; });
}
// once a frame, by the carrying hand: G.kz (its size since it took hold, held within lo and hi), G.sth (the turn) and
// G.reach (the push)
function holdSticks(c, G, dt, lo, hi) {
  const [lx, ly] = holdStick(c, 'left'), [rx, ry] = holdStick(c, 'right');
  if (ly) G.kz = clamp(G.kz * Math.exp(-ly * HOLD.grow * dt), Math.min(lo, 1), Math.max(hi, 1));
  G.sth += (lx + rx) * HOLD.turn * dt;
  if (ry) G.reach = clamp(G.reach * Math.exp(-ry * HOLD.push * dt), 0.15, 8);
}
// how far the sticks may size an item from where it was taken: a twentieth to twenty times, and within its record's own
// limits (an empty has no size)
function holdRange(it, G) {
  const s = G.s0, mn = Math.min(s.x, s.y, s.z), mx = Math.max(s.x, s.y, s.z);
  const [a, b] = it.kind === 'o' ? [1e-4 / mx, 1e4 / mx] : it.kind === 'c' ? [0.05 / mn, 100 / mx] : it.kind === 'p' ? [0.01 / mn, 100 / mx]
    : it.kind === 'x' ? [0.01 / mn, 50 / mx] : it.kind === 's' ? [0.1 / G.rr, 20 / G.rr] : [1, 1];
  return [Math.max(1 / 20, a), Math.min(20, b)];
}
// the sticks' size and turn on the pose the hand gives it: about its middle (an object's own box's; the others' holders
// stand at their middles), the turn about the scene's vertical; a sound's reach instead of a size
const _hm = new THREE.Vector3(), _hq = new THREE.Quaternion();
function holdApply(it, G) {
  const H = it.holder, k = G.kz, th = G.sth;
  if (it.kind === 's') { it.carryR = clamp(r2(G.rr * k), 0.1, 20); return; }
  const off = it.kind === 'o' && it.model ? _hm.copy(it.proxy.position).multiply(G.s0).applyQuaternion(H.quaternion) : _hm.set(0, 0, 0);
  if (it.kind !== 'e') H.scale.copy(G.s0).multiplyScalar(k);
  H.position.add(off).sub(off.multiplyScalar(it.kind === 'e' ? 1 : k).applyAxisAngle(_xY, th));
  if (th) H.quaternion.premultiply(_hq.setFromAxisAngle(_xY, th));
}
// an item in the hand: where the hand puts it (an object, a cut-out, a shape or an empty, moving freely, turns with the
// hand as a real object would; else, and a cube always, it turns only about the vertical; a sound only moves); both hands
// on an object, a cut-out or a shape size it (a twentieth to twenty times; a cut-out and a shape every side alike) and move
// it with their middle; one hand on it, the sticks steer it (holdSticks)
const _mq = new THREE.Quaternion(), _mi = new THREE.Quaternion(), _mv = new THREE.Vector3(), _me = new THREE.Euler();
function carryItem(c, dt) {
  const G = c.grab, it = STU.items.get(G.id);
  if (!it) { c.grab = null; XR.lost = true; return; }
  const o = XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'item' && k.grab.id === G.id && k.src && k.g.visible);
  GL.world.updateMatrixWorld(true);
  _mi.copy(GL.world.getWorldQuaternion(_mq)).invert();
  if (o && (it.kind === 'o' || it.kind === 'x' || it.kind === 'p')) {
    if (c.i < o.i) return;   // (once a frame, by the second hand)
    const d = c.o.distanceTo(o.o), vec = it.kind === 'x' || it.kind === 'p';
    _mv.copy(c.o).add(o.o).multiplyScalar(0.5);
    const W = G.two || (G.two = o.grab.two = { d0: Math.max(0.05, d), s0: vec ? it.holder.scale.clone() : it.holder.scale.x, m0: _mv.clone(), p0: it.holder.getWorldPosition(new THREE.Vector3()) });   // (as shown: the sticks may have sized it since its record was last written)
    it.holder.position.copy(GL.world.worldToLocal(W.p0.clone().add(_mv).sub(W.m0)));
    if (vec) it.holder.scale.copy(W.s0).multiplyScalar(clamp(d / W.d0, 1 / 20, 20));   // (every side alike: its shape kept)
    else it.holder.scale.setScalar(clamp(W.s0 * d / W.d0, W.s0 / 20, W.s0 * 20));
    carryWrite(it);
    return;
  }
  if (o) { if (c.i < o.i) return; }
  if (G.two) xrRegrip(c);
  const rec = !!REC && REC.id === it.id;   // (recording its path: the sticks turn and push it, never size it; e6f_path.js)
  holdSticks(c, G, dt, ...(rec ? [1, 1] : holdRange(it, G)));
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);   // the hand's turn since it took hold
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  if (_gv.length() > 30) _gv.setLength(30);
  _gv.applyQuaternion(_gq).add(c.o);
  it.holder.position.copy(GL.world.worldToLocal(_gv));
  if (it.kind !== 's') {
    let q;
    if (XR.free && it.kind !== 'c') q = _mq.copy(_gq).multiply(G.r0);
    else { _me.setFromQuaternion(_gq, 'YXZ'); q = _mq.setFromAxisAngle(_xY, _me.y).multiply(G.r0); }
    it.holder.quaternion.copy(q.premultiply(_mi));
  }
  holdApply(it, G);
  if (it.kind === 'c') it.holder.rotation.set(0, new THREE.Euler().setFromQuaternion(it.holder.quaternion, 'YXZ').y, 0);
  if (rec) recStep(); else carryWrite(it);   // (recording: nothing written until it is let go, its pose sampled now)
}
// a group in the hand: its pivot where the hand puts it, its members keeping their places about it; level, taking only a
// yaw from the hand's turn while free moving is on; both hands size it about its pivot (a twentieth to twenty times) and
// move it with their middle; one hand on it, the sticks size it and turn it about its pivot and push or pull it
// (holdSticks). Records written ten times a second (and as it is let go: groupLetGo), the members shown where the hand
// puts them meanwhile
function carryGroup(c, dt) {
  const G = c.grab, g = STU.items.get(G.id);
  if (!g || g.kind !== 'g' || !g.base) { c.grab = null; groupLetGo(c, G); return; }   // (gone meanwhile, as from the room: its members let go)
  const T = g.T, o = XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'group' && k.grab.id === G.id && k.src && k.g.visible);
  GL.world.updateMatrixWorld(true);
  if (o) {
    if (c.i < o.i) return;   // (once a frame, by the second hand)
    const d = c.o.distanceTo(o.o);
    _mv.copy(c.o).add(o.o).multiplyScalar(0.5);
    const W = G.two || (G.two = o.grab.two = { d0: Math.max(0.05, d), m0: GL.items.worldToLocal(_mv.clone()), t0: T.t.clone(), k0: T.k });
    T.k = clamp(W.k0 * d / W.d0, 1 / 20, 20);
    T.t.copy(W.t0).add(GL.items.worldToLocal(_mv.clone())).sub(W.m0);
  } else {
    if (G.two) groupRegrip(c);
    holdSticks(c, G, dt, 1 / 20 / G.k0, 20 / G.k0);   // (the group a twentieth to twenty times its size as it began)
    _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);   // the hand's turn since it took hold
    _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
    if (_gv.length() > 30) _gv.setLength(30);
    _gv.applyQuaternion(_gq).add(c.o);
    T.t.copy(GL.items.worldToLocal(_gv)).sub(g.base.P);
    T.th = G.th0 + (XR.free ? _me.setFromQuaternion(_gq, 'YXZ').y : 0) + G.sth;
    T.k = G.k0 * G.kz;
  }
  const t = performance.now(), write = t - (g.wrote || 0) >= 100;
  if (write) g.wrote = t;
  groupMove(g.base, T.t, T.th, T.k, write);
}
// the grip on a selected cube's corner: the opposite corner stays, this one follows the hand (each side at least 10 cm)
function stretchCube(c) {
  const G = c.grab, it = STU.items.get(G.id);
  if (!it) { c.grab = null; XR.lost = true; return; }
  if (it.kind === 'x' || it.kind === 'p') { stretchCut(c, G, it); return; }   // (a shape's corners: a cube's)
  GL.world.updateMatrixWorld(true);
  const r = it.rec, cor = GL.world.worldToLocal(_mv.copy(c.o)).add(G.off).sub(G.opp).applyAxisAngle(_xY, -r.yaw);
  const size = [0, 1, 2].map(i => Math.max(0.1, cor.getComponent(i) * G.sg[i]));
  const mid = new THREE.Vector3(G.sg[0] * size[0] / 2, G.sg[1] * size[1] / 2, G.sg[2] * size[2] / 2).applyAxisAngle(_xY, r.yaw).add(G.opp);
  it.holder.position.copy(mid); it.holder.scale.fromArray(size);
  carryWrite(it);
}
// the grip on a selected cut-out's corner: the opposite corner stays, this one follows the hand, its turn kept (each side
// at least 1 cm)
function stretchCut(c, G, it) {
  GL.world.updateMatrixWorld(true);
  const iq = _mq.copy(G.q).invert(), cor = GL.world.worldToLocal(_mv.copy(c.o)).add(G.off).sub(G.opp).applyQuaternion(iq);
  const size = [0, 1, 2].map(i => Math.max(0.01, cor.getComponent(i) * G.sg[i]));
  it.holder.position.set(G.sg[0] * size[0] / 2, G.sg[1] * size[1] / 2, G.sg[2] * size[2] / 2).applyQuaternion(G.q).add(G.opp);
  it.holder.quaternion.copy(G.q); it.holder.scale.fromArray(size);
  carryWrite(it);
}
// a stick pushed up or down while its ray is on the studio's panel (its own, or its copy on the menu's Story tab) scrolls
// the pane there when it is taller than the panel: up shows what is above. A dead zone, then faster the further it is
// pushed, and faster still the longer it is held (from a third of the speed to all of it in 0.8 s); held at the ends as
// Up and More are. Never while something is carried (the sticks steer it then: holdSticks)
const SCROLL = { dz: 0.2, slow: 0.25, fast: 1.6, ramp: 0.8 };   // (speeds in the pane's heights a second)
function stickScroll(c, gp, dt) {
  const h = c.hover, y = gp && gp.axes.length >= 4 ? gp.axes[3] : 0;
  if (!h || h.kind !== 'panel' || h.P !== XR.main || c.grab || XR.ctrls.some(steers) || XR.stories || APP.mode !== 'explore' || Math.abs(y) < SCROLL.dz) { c.scrollT = 0; return; }
  const tab = X.tab, max = X.scrollMax[tab] || 0, view = X.scrollView || 1000;
  if (!(max > 0)) { c.scrollT = 0; return; }
  c.scrollT = (c.scrollT || 0) + dt;
  const m = (Math.abs(y) - SCROLL.dz) / (1 - SCROLL.dz), ramp = Math.min(1, 1 / 3 + c.scrollT / SCROLL.ramp * 2 / 3);
  const v = (SCROLL.slow + (SCROLL.fast - SCROLL.slow) * m * m) * ramp * view;
  // (the stick's fraction kept between frames; Up or More pressed meanwhile: from where they put it)
  const F = X.scrollF;
  if (F.tab !== tab || F.at !== (X.scroll[tab] || 0)) { F.tab = tab; F.v = X.scroll[tab] || 0; }
  F.v = clamp(F.v + Math.sign(y) * v * dt, 0, max);
  F.at = X.scroll[tab] = Math.round(F.v);
}
// VR (not passthrough), nothing carried: the left stick walks you through the scene (it moves, not the rig), the right
// stick turns you 30 degrees a flick, about where you stand. Not a stick whose ray is on the studio's panel (it scrolls
// there: stickScroll); a turn held there waits for the stick to come back to the middle
function stickWalk(c, gp, dt) {
  if (!XR.clear || APP.mode !== 'explore' || XR.stories || xrAway() || XR.ctrls.some(k => k.grab) || !gp || gp.axes.length < 4) return;
  const ax = gp.axes[2], ay = gp.axes[3], hand = c.src.handedness;
  if (c.hover && c.hover.kind === 'panel') { if (hand === 'right' && Math.abs(ax) >= 0.3) XR.turnArm = false; return; }
  if (hand === 'left') {
    const m = Math.hypot(ax, ay);
    if (m < 0.15) return;
    GL.rig.updateMatrixWorld(true);
    _gh.set(0, 0, -1).applyQuaternion(XR.headQ).applyQuaternion(_gr.copy(GL.rig.quaternion).invert());
    _gh.y = 0;
    if (_gh.lengthSq() < 1e-6) return;
    _gh.normalize();
    const v = 1.5 * dt * Math.min(1, (m - 0.15) / 0.85) / m, fx = -ay * v, sx = ax * v;   // (forward and to the side)
    XR.walk.x -= _gh.x * fx - _gh.z * sx; XR.walk.z -= _gh.z * fx + _gh.x * sx;
  } else if (hand === 'right') {
    if (Math.abs(ax) < 0.3) { XR.turnArm = true; return; }
    if (!XR.turnArm || Math.abs(ax) < 0.7) return;
    XR.turnArm = false;
    const th = ax > 0 ? Math.PI / 6 : -Math.PI / 6, h = GL.rig.worldToLocal(_gv.copy(XR.head)), cs = Math.cos(th), sn = Math.sin(th);
    const dx = XR.walk.x - h.x, dz = XR.walk.z - h.z;
    XR.walk.x = h.x + cs * dx + sn * dz; XR.walk.z = h.z - sn * dx + cs * dz; XR.walk.yaw += th;
    buzz(c, 0.2, 12);
  }
}
function xrPoint(c, dt) {
  const g = c.g;
  if (!c.src || !g.visible) { c.hover = null; c.dot.visible = false; xrLetGo(c); return; }   // (a controller gone lets go)
  c.o.setFromMatrixPosition(g.matrix);
  c.d.set(0, 0, -1).transformDirection(g.matrix);
  let hit = null, dist = 2.5;
  // panels first: they are drawn on top of everything
  XR.raycaster.set(c.o, c.d);
  const hs = XR.raycaster.intersectObjects(XR.panelMeshes.filter(m => m.visible), false);
  // then the shared room's own things (its panel, the other stations, a calibration), if nearer than a panel
  const sh = HOST.collab.ray(c.i, c.o, c.d, hs.length ? hs[0].distance : Infinity);
  if (sh && sh.panel && XR[sh.panel]) { const P = XR[sh.panel]; hit = { kind: 'panel', P, x: sh.u * P.w, y: (1 - sh.v) * P.h, point: sh.point, menu: true }; dist = sh.dist; }   // (this panel in the shell's menu, its Story tab)
  else if (sh) { hit = sh; dist = sh.dist; }
  else if (xrAway()) hit = null;   // away from its station in a shared room: nothing of the story to point at
  else if (hs.length) {
    const h = hs[0], P = XR.panels.find(q => q.mesh === h.object);
    hit = { kind: 'panel', P, x: h.uv.x * P.w, y: (1 - h.uv.y) * P.h, point: h.point };
    dist = h.distance;
  } else if (!XR.stories && APP.mode === 'explore') {
    // an item (editing: lit, its name shown), else the floor (the dot only)
    // (nothing else found, and the controller inside an object's unseen box: that object, as you stand in a room scan)
    const ih = editOn() ? rayPick(XR.raycaster, { inside: true }) : null;
    if (ih) { hit = { kind: 'item', id: ih.id, corner: ih.corner, point: ih.point, ray: ih.ray, inside: !!ih.inside }; dist = ih.dist; }
    else {
      const ts = XR.raycaster.intersectObjects(XR.solid, false);
      if (ts.length && ts[0].distance < 30) { hit = { kind: 'floor', point: ts[0].point.clone() }; dist = ts[0].distance; }
    }
  }
  c.hover = hit;
  // a soft tick as the ray comes onto a button of the story's panels (as on the shell's menu)
  const hr = hit && hit.kind === 'panel' && hit.P.at(hit.x, hit.y), hk = hr && hr.fn ? XR.panels.indexOf(hit.P) + '.' + hr.id : '';
  if (hk && hk !== c.hk) sfxPlay('hover', 'world', hit.point);
  c.hk = hk;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  // the sticks walk and turn (VR)
  const gp = c.src.gamepad;
  if (gp) {
    stickScroll(c, gp, dt);
    stickWalk(c, gp, dt);
  }
  c.ray.scale.z = dist;
  if (hit) {
    c.dot.visible = true;
    c.dot.position.copy(hit.point);
    c.dot.lookAt(XR.head);
    c.dot.scale.setScalar(0.005 * Math.max(0.3, c.dot.position.distanceTo(XR.head)));
  } else c.dot.visible = false;
}

// ---------------------------------------------------------------- frames --
const _xUp = new THREE.Vector3(0, 1, 0);
function xrBegin(frame, dt) {
  xrSettings();
  const ref = GL.renderer.xr.getReferenceSpace();
  const pose = frame && ref ? frame.getViewerPose(ref) : null;
  if (pose) {
    const p = pose.transform.position, q = pose.transform.orientation;
    XR.head.set(p.x, p.y, p.z); XR.headQ.set(q.x, q.y, q.z, q.w);
    if (XR.needRecenter) { if (!HOST.anchor.held()) xrRecenter(); XR.needRecenter = false; } // an anchored place stays put
    // anchored: the spot in the room carries the frame that holds the panels, the Stories screen and the scene
    // (asked only once the headset has a pose, so a new anchor goes where things really are)
    const A = HOST.anchor.frame(frame, ref);
    if (A) { GL.rig.position.fromArray(A.p); GL.rig.quaternion.setFromAxisAngle(_xUp, A.yaw); }
    XR.atSt = !!(A && A.room);   // (at a station the rig is its spot, 1.6 m over the room's floor; the scene the room's: xrPlace)
    // the real floor: the session's local-floor, as a height in the renderer's local space
    if (XR.floorSpace) { try { const fp = frame.getPose(XR.floorSpace, ref); if (fp) XR.floorY = fp.transform.position.y; } catch (e) { XR.floorSpace = null; } }
    // in a shared room no Stories screen: a story is reached by walking into its station's circle, and at its station it
    // is the station's (a shell without HOST.room.away: only there); leaving the room brings it back, as for a new wearer
    const roomOnly = xrRoomOnly();
    if (XR.inRoom && !roomOnly) xrFreshStart();
    XR.inRoom = roomOnly;
    // (at an All stories circle its cards are the Stories screen, opened as the panel's Stories button opens it, and they
    // close once a story is picked there or the headset walks into another circle)
    if (xrCards() && !XR.stories) { XR.stories = true; XR.inStory = false; XR.kbd.open = false; APP.playing = false; }
    if (XR.stories && !xrCards() && (roomOnly || (HOST.collab.mine() && HOST.room.placing()))) xrLandingClose();
  }
  const bl = XR.session && XR.session.renderState.baseLayer;
  if (bl) {
    if (bl.framebufferHeight) XR.viewH = bl.framebufferHeight;
    if (!XR.fov) {
      XR.fov = true;
      try { if ('fixedFoveation' in bl) bl.fixedFoveation = 0.5; } catch (e) { /* not supported */ }
    }
  }
  GL.rig.updateMatrixWorld(true);
  _xinv.copy(GL.world.matrixWorld).invert();
  for (const c of XR.ctrls) xrPoint(c, dt);
  xrLost();
  holdStep();
  // away from its station in a shared room the story waits, silent (hidden in xrUpdate, not pointable in xrPoint); a
  // pause made here is not the room's (the shell takes no clock or state from a headset that is not at a station)
  if (xrAway() || xrCards()) { APP.playing = false; SLIDE.tail = null; }
  for (const P of XR.panels) {
    let hv = null;
    for (const c of XR.ctrls) {
      if (c.hover && c.hover.kind === 'panel' && c.hover.P === P) { const r = P.at(c.hover.x, c.hover.y); if (r) hv = r.id; }
    }
    P.hover = hv;
  }
  // the item a controller points at (or holds) lights up and shows its name; a cube's corner too
  const ch = XR.ctrls.find(c => c.grab && c.grab.id) || XR.ctrls.find(c => c.hover && c.hover.kind === 'item');
  STU.hover = ch ? (ch.grab ? ch.grab.id : ch.hover.id) : '';
  const cc = XR.ctrls.find(c => c.grab && c.grab.target === 'corner') || XR.ctrls.find(c => c.hover && c.hover.kind === 'item' && c.hover.corner !== undefined);
  STU.hotCorner = cc ? { id: (cc.grab || cc.hover).id, k: cc.grab && cc.grab.target === 'corner' ? [0, 1, 2].reduce((k, i) => k + (cc.grab.sg[i] > 0 ? 1 << i : 0), 0) : cc.hover.corner } : null;
}
function xrUpdate(S) {
  // the Stories screen replaces the story's panels and hides the story
  const land = !!XR.stories, away = xrAway();   // (away from its station in a shared room: the story hidden, only the shell's things)
  if (XR.land) {
    if (XR.landRev !== HOST.listRev) xrLandingCards();   // a story added while the app runs: its card joins the rows
    for (const P of XR.land) P.mesh.visible = land;
    // cards hidden: no story panel at all, in story and explore mode (the Stories screen, the shell's menu and its
    // clock stay, and its Story tab plays); cards in 3D: the panels stand in the scene, as the labels' signs do (the
    // labels have their own setting). And this story's panels (xrPanels): controls only keeps just the foot bar, hidden
    // neither
    const pm = xrPanels(), pv = !land && !away && XR.cm !== 'hidden';
    XR.main.mesh.visible = pv && pm === 'shown';
    XR.foot.mesh.visible = pv && pm !== 'hidden';
    panelDepth(XR.main, XR.cm === 'fixed'); panelDepth(XR.foot, XR.cm === 'fixed');
  }
  GL.world.visible = !land && !away;
  if (land !== XR.landShown) { XR.landShown = land; HOST.setUrl(land); }
  GL.rig.updateMatrixWorld(true);
  XR.camLocal.copy(XR.head);
  GL.world.worldToLocal(XR.camLocal);
  // labels in 3D: each sign turns to you (placeLabelXR) from the world's frame back to the rig's, where your head is
  XR.signL.copy(GL.world.quaternion).invert();
  GL.rig.worldToLocal(XR.signH.copy(XR.head));
  const story = APP.mode === 'story';
  for (const L of ST.labels) {
    if (story) placeLabelXR(L, fadeVal(storyT(APP.t), L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0), S);
    else hideLabelXR(L);
  }
  for (const L of LBL.sets) placeLabelXR(L, setLabelAlpha(L, S), S);
  for (const L of LBL.extra) {
    if (!story && L.txt) placeLabelXR(L, L.show, S);
    else hideLabelXR(L);
  }
  xrTip(S);
  const now = performance.now();
  for (const P of XR.panels) panelTick(P, now);
}

// --------------------------------------------------------------- session --
function xrMsg(text) {
  const el = $('#xrmsg');
  el.textContent = text; el.style.display = 'block';
  clearTimeout(xrMsg.t);
  xrMsg.t = setTimeout(() => { el.style.display = 'none'; }, 6000);
}
async function xrStart(mode) {
  if (XR.session || !navigator.xr) return;
  let session;
  try {
    session = await (HOST.xr.request ? HOST.xr.request(mode) : navigator.xr.requestSession(mode, { optionalFeatures: HOST.xr.features(mode) }));
  } catch (err) {
    HOST.landingVR = false;
    xrMsg(`Could not start ${mode === 'immersive-ar' ? 'AR' : 'VR'}: ${err && err.message ? err.message : err}`);
    return;
  }
  XR.session = session; XR.mode = mode;
  HOST.session = session; HOST.mode = mode;
  session.addEventListener('visibilitychange', xrVisibility);
  xrEnterScene();
  try {
    GL.renderer.xr.setReferenceSpaceType('local');
    await GL.renderer.xr.setSession(session);
    const ref = GL.renderer.xr.getReferenceSpace();
    if (ref && ref.addEventListener) ref.addEventListener('reset', () => { XR.needRecenter = true; });
    xrFloor(session);
  } catch (err) {
    console.error(err);
    xrMsg('Could not start the headset view: ' + (err && err.message ? err.message : err));
    try { await session.end(); } catch (e) { /* already ended */ }
    if (XR.on) xrEnded();
  }
}
function xrEnterScene() {
  XR.stories = false;
  XR.on = true; XR.needRecenter = true; XR.fov = false; XR.tipI = -1;
  XR.free = xrFreeOn(); XR.lm = xrLabelMode(); XR.cm = xrCardMode();   // (as the shell has them: nothing to turn off or on at the first frame)
  document.body.classList.add('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  tcAttach();   // (the page's arrows are not drawn in a headset)
  XR.clear = !(XR.session.environmentBlendMode && XR.session.environmentBlendMode !== 'opaque') && XR.mode !== 'immersive-ar';
  applyTheme();
  GL.stars.material.size = 2.2;
  for (const P of XR.panels) { P.mesh.visible = true; P.last = ''; }
  XR.kbd.open = false;
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) L.o = -1;
  // every headset session starts the story from the top; entered from the start screen, it shows the Stories menu first
  // (not in a shared room: there a story is reached by walking into its station's circle)
  XR.inRoom = xrRoomOnly();
  const fromStart = (HOST.picking || HOST.landingVR) && !XR.inRoom;
  HOST.landingVR = false;
  HOST.closePicker();
  if (fromStart) { APP.enterStory(0); APP.playing = false; XR.stories = true; XR.inStory = false; audioSync(); }
  else { XR.inStory = true; if (APP.mode === 'story') APP.playing = true; } // already in a story: carry on where you were
  $('#tip').style.opacity = 0;
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) L.el.style.opacity = 0;
  if (document.fonts && !XR.fontOK) {
    Promise.all([document.fonts.load(vfont(30, 700)), document.fonts.load(vfont(30))]).then(() => {
      XR.fontOK = 1;
      [...ST.labels, ...LBL.sets, ...LBL.extra].forEach(dropSprite);
    }).catch(() => {});
  }
}
// Headset taken off (or put to sleep) for more than a few seconds: treat the next
// wearer as a new visitor. Restart the story and place everything in front of them
// (when anchored, everything stays at its spot in the room).
const XR_AWAY_MS = 3000;
function xrVisibility() {
  const v = XR.session && XR.session.visibilityState;
  if (v === 'hidden') { if (!XR.hiddenAt) XR.hiddenAt = performance.now(); }
  else if (v === 'visible' && XR.hiddenAt) {
    const away = performance.now() - XR.hiddenAt;
    XR.hiddenAt = 0;
    if (away > XR_AWAY_MS) xrFreshStart();
  }
  audioSync();
}
function xrFreshStart() {
  XR.kbd.open = false; XR.kbd.q = '';
  for (const c of XR.ctrls) { c.press = null; xrLetGo(c); c.wantPress = false; }
  xrLost();
  // in a shared room the story and its place stay (at its station the room's clock and state go on applying; away from
  // one a new wearer walks up to a station: no Stories screen in a room)
  if (HOST.collab.mine() || xrRoomOnly()) { lastNow = 0; return; }
  APP.enterStory(0); APP.playing = false; audioSync();
  XR.stories = true; XR.inStory = false; // a new wearer lands in the Stories screen
  XR.needRecenter = true; // uses the new wearer's head position and direction on the next frame
  lastNow = 0;
}
// a story picked inside the headset takes over the running session
function xrAdopt() {
  XR.session = HOST.session; XR.mode = HOST.mode;
  XR.session.addEventListener('visibilitychange', xrVisibility);
  XR.ctrls.forEach((c, i) => { const s = HOST.inputs[i]; if (s) { c.src = s; c.ray.visible = s.targetRayMode !== 'screen'; } });
  xrEnterScene();
  // keep the cell and the panel where they were in the story before
  const p = HOST.xrPose;
  if (p) {
    XR.needRecenter = false;
    GL.rig.position.copy(p.rp); GL.rig.quaternion.copy(p.rq);
    XR.globeOff.copy(p.off); XR.size = p.s || 1; xrSceneRot(p.rot || p.q);
    xrPanelPose(p.pp, p.pr, p.pq);
  }
  const ref = GL.renderer.xr.getReferenceSpace();
  if (ref && ref.addEventListener) ref.addEventListener('reset', () => { XR.needRecenter = true; });
  xrFloor(XR.session);
}
// the session's own local-floor (asked for as an optional feature): where the real floor is, for objects to stand on
function xrFloor(session) {
  XR.floorSpace = null; XR.floorY = null;
  if (!session || !session.requestReferenceSpace) return;
  session.requestReferenceSpace('local-floor').then(s => { if (XR.session === session) XR.floorSpace = s; }, () => { /* none: 1.6 m under the eyes */ });
}
function xrEnded() {
  if (!XR.on) return;
  const away = xrAway();   // (asked while the session is still the shell's)
  XR.on = false; XR.session = null; XR.mode = null; XR.hiddenAt = 0;
  HOST.session = null;
  document.body.classList.remove('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  GL.world.position.set(0, 0, 0); GL.world.quaternion.identity(); GL.world.scale.setScalar(1);
  for (const P of XR.panels) P.mesh.visible = false;
  for (const c of XR.ctrls) { c.g.visible = false; c.dot.visible = false; c.press = null; xrLetGo(c); c.hover = null; c.src = null; }
  xrLost();
  STU.hover = ''; STU.hotCorner = null; XR.floorSpace = null; XR.floorY = null; XR.atSt = false; XR.hold = XR.rec = '';
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) { hideLabelXR(L); L.o = -1; }
  if (XR.tip) dropSprite(XR.tip);
  XR.tip = null; XR.tipI = -1;
  XR.clear = true;
  GL.stars.visible = false;   // (the room has no stars)
  GL.world.visible = true;
  for (const P of XR.land || []) P.mesh.visible = false;
  // left the headset from the Stories screen, or away from a station in a shared room (its story hidden and paused
  // there): back to the Stories screen on the page
  if (XR.stories || away) { XR.stories = false; HOST.openPicker(); }
  applyTheme();
  resize();
  tcAttach();
}
function xrSetup() {
  XR.raycaster = new THREE.Raycaster();
  // panel 0.62 m wide, about 40 degrees to the left and facing you
  const mw = 0.62, px = -0.56, py = 0.04, pz = -0.86, yaw = Math.atan2(-px, -pz);
  XR.main = makePanel(1024, 1200, mw, drawMain, sigMain);
  XR.foot = makePanel(1024, 176, mw, drawFoot, sigFoot);
  XR.panelGroup = new THREE.Group();
  XR.panelHome = { p: new THREE.Vector3(px, py, pz), yaw };
  XR.panelGroup.position.copy(XR.panelHome.p); XR.panelGroup.rotation.y = yaw;
  GL.rig.add(XR.panelGroup);
  XR.foot.mesh.position.set(0, -(mw * 1200 / 1024) / 2 - 0.012 - (mw * 176 / 1024) / 2, 0);
  for (const P of [XR.main, XR.foot]) { XR.panelGroup.add(P.mesh); XR.panels.push(P); }
  XR.panelMeshes = XR.panels.map(P => P.mesh);
  XR.solid = GL.sets.stage.solid;   // what the pointer's dot lands on when it misses an item: the floor
  xrLandingSetup();
  for (let i = 0; i < 2; i++) xrController(i);
  GL.renderer.xr.addEventListener('sessionend', xrEnded);
  $('#btnVR').addEventListener('click', () => xrStart('immersive-vr'));
  $('#btnAR').addEventListener('click', () => xrStart('immersive-ar'));
  if (!navigator.xr) {
    if (/OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent)) xrMsg('Open this page over https:// to view it in VR.');
    return;
  }
  navigator.xr.isSessionSupported('immersive-vr').then(vr => {
    if (vr) $('#btnVR').hidden = false;
    // headsets support both; phones only AR, which this layout is not made for
    return navigator.xr.isSessionSupported('immersive-ar').then(ar => { if (ar && vr) $('#btnAR').hidden = false; });
  }).catch(() => {});
}
