//#use GL
// the sets: the interactome in the authors' six arrangements (every chapter) and the close-up at its centre (chapters 3
// to 6, and explore's scenes with a centre)
const SET_ORDER = ['net', 'core'];
// the core is drawn in the net's frame (its balls are the net's centre proteins, scaled up as CDATA places them), so
// the two always turn together
const FRAME = { core: 'net' };
//#use frameOf buildScene buildSet
// once every set is built (a step of the load): what joins them. The core's balls follow the net's own points (its
// api().pos: each protein's current place, the net's stagger included), so a ball and its point never part; and how far
// each of the six layouts reaches from the map's middle (XR_BOUND, the headset's clearance: xrPlace)
const XR_BOUND = [];
function sceneJoin() {
  const na = GL.sets.net.api ? GL.sets.net.api() : null, ca = GL.sets.core.api ? GL.sets.core.api() : null;
  if (na && na.pos && ca && ca.posFrom) ca.posFrom(na.pos);
  for (const k of CDATA.SCENES) {
    const L = CDATA.layout(k);
    let r = 0;
    for (let i = 0; i < L.length; i += 3) r = Math.max(r, L[i] * L[i] + L[i + 1] * L[i + 1] + L[i + 2] * L[i + 2]);
    XR_BOUND.push(Math.sqrt(r));
  }
}
// show each set as far as S fades it in, and let the visible ones update (the hidden ones idle); in the story a set
// may be turned to meet the camera (see buildCamera)
// (the net set hears where the viewer is every frame, in its own frame: the camera on a screen, the head in a headset;
// its veil fades the points between the viewer and the map's centre so the close-up reads through the sphere)
const _eye = new THREE.Vector3();
function updateSets(S, t, dt, story) {
  for (const k of SET_ORDER) GL.sets[k].group.rotation.y = story ? setYaw(k, t) * D2R : 0;
  const net = GL.sets.net, na = net.api ? api('net') : null;
  if (na && na.eye && (S.net_a || 0) > 0.003) {
    GL.world.updateMatrixWorld(true);
    net.group.worldToLocal(_eye.copy(XR.on && GL.renderer.xr.isPresenting ? XR.head : GL.camera.position));
    na.eye(_eye.x, _eye.y, _eye.z);
    // (the core too, with how near nothing may be drawn: 0.35 m in a headset, in the sets' units, else a little)
    const ca = api('core');
    if (ca.eye) ca.eye(_eye.x, _eye.y, _eye.z, XR.on && GL.renderer.xr.isPresenting ? 0.35 / Math.max(XR.R, 1e-3) : 0.06);
  }
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.setAlpha(a);
    if (a > 0.003) s.update(S, t, dt);
    else if (s.idle) s.idle(dt);   // a hidden set may build in slices
  }
}

// on a small screen held sideways the scene stands back to fit the strip above the panel (resize)
const STRIP_FIT = 0.9;
//#use _vd viewDir narrowK lowK applyCamera _yA keepCamera resize LV updateLight