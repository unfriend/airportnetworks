//#use head GL
// the sets, in the order they appear in the story
const SET_ORDER = ['scan', 'body', 'organs', 'liver'];
// sets drawn in another set's frame: the organs lie in the PET body, so the two always turn together
const FRAME = { body: 'organs' };
//#use frameOf buildScene buildSet sceneJoin BUILD buildMs buildTurn PRIME primeCheck primeStep
// show each set as far as S fades it in, and let the visible ones update (the hidden ones idle); in the story a set
// may be turned to meet the camera (see buildCamera)
function updateSets(S, t, dt, story) {
  const hid = [];
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.group.rotation.y = story ? setYaw(k, t) * D2R : 0;
    if (s.riseTo) s.riseTo.yaw = story ? ST.riseYaw || 0 : 0;   // (where the scanner's patient stands up: the body set's turn less its own)
    s.setAlpha(a);
    if (a > 0.003) s.update(S, t, dt);
    else { if (s.idle) hid.push(s); primeCheck(s); }   // a hidden set may build in slices (buildTurn, below), and is sent to the card when done (primeStep)
  }
  buildTurn(hid, dt);
  primeStep(dt);
}

// on a small screen held sideways the scene stands back to fit the strip above the panel (resize)
const STRIP_FIT = 0.9;
//#use _vd viewDir narrowK lowK applyCamera _yA keepCamera resize LV updateLight