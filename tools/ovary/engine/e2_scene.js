//#use head GL
// the sets, in the order they appear in the story
const SET_ORDER = ['body', 'organ', 'section', 'charts'];
// sets drawn in another set's frame: the ovary sits small in the tour's body before it grows out of it, so the two
// always turn together (and the story shows them together)
const FRAME = { body: 'organ' };
//#use frameOf buildScene buildSet
// while a set fades in or out, nothing of it writes depth: a faint model that wrote depth hid what stood behind it (the
// next model, coming in at the same place), and in a headset the order the two are drawn in flips as the head moves, so
// they flickered (the owner, 2 November 2026: "ovary section and more still overlaps on transitions"). Each material's
// own choice comes back once its set is fully in; the materials the kit's setAlpha fades see to it themselves.
function fadeDepth(s, a) {
  const solid = a > 0.97;
  if (a <= 0.003 || (solid && s.depthOK)) return;
  s.depthOK = solid;
  const own = new Set(s.fades || []);
  s.group.traverse(o => {
    if (!o.material) return;
    for (const m of [].concat(o.material)) {
      if (own.has(m)) continue;
      if (m.userData.dw === undefined) m.userData.dw = m.depthWrite;
      m.depthWrite = solid && m.userData.dw;
    }
  });
}
//#use sceneJoin BUILD buildMs buildTurn PRIME primeCheck primeStep
// show each set as far as S fades it in, and let the visible ones update (the hidden ones idle); in the story a set
// may be turned to meet the camera (see buildCamera)
function updateSets(S, t, dt, story) {
  const hid = [];
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.group.rotation.y = story ? setYaw(k, t) * D2R : 0;
    s.setAlpha(a);
    fadeDepth(s, a);
    if (a > 0.003) s.update(S, t, dt);
    else { if (s.idle) hid.push(s); primeCheck(s); }   // a hidden set may build in slices (buildTurn, below), and is sent to the card when done (primeStep)
  }
  buildTurn(hid, dt);
  primeStep(dt);
}

//#use _vd viewDir narrowK applyCamera _yA keepCamera resize LV updateLight