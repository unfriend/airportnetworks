//#use head GL
// the sets, in the order they appear in the story
const SET_ORDER = ['body', 'slide', 'map', 'tower', 'cohort'];
// sets drawn in another set's frame: the map lies on the slide's window, so the two always turn together
const FRAME = { map: 'slide' };
//#use frameOf buildScene buildSet
// once every set is built (a step of the load): what joins them
function sceneJoin() {
  // the liver lifting out of the body (the engine's own, in the body set's frame); its model is wanted first, and
  // built now where the harness and the sweep ask the sets to finish
  GL.liver = makeLiver();
  GL.world.add(GL.liver.group);
  ORGAN3D.want(LIVER);
  GL.sets.body.finish = () => { ORGAN3D.geo(LIVER); };
}
// The liver (chapter 1 and the Liver scene): the microanatomy story's model (ORGAN3D, built between frames) lifts out of
// the tour's body, grows and turns in front of it; a thin slice of it stands inside it as it fades, drawn from the
// healthy tile's own cells (where they sit and what the cell classifier called them: drawing, as the slide set's H&E);
// then the slice falls flat and grows into the tile, 1.6 across at the origin, where the slide set lies it on its
// glass. Params (DEF, the engine's): liver_a (its fade), liver_lift (0 in the body, 1 out in front of it), liver_slice
// (0 none; to 0.45 the slice shows and the liver turns to a ghost; 0.45 to 0.55 the liver goes; to 1 the slice falls
// flat and grows into the tile).
const LIVER = 'liver';
const LIVER_OUT = [0, 0.2, 0.7];   // where the lifted liver turns, in the body's frame (in front of its belly)
function makeLiver() {
  const set = K.newSet('liver'), uP = [new THREE.Vector4()], uQ = [new THREE.Vector4()], sh = ORGAN3D.shader(1);
  const lm = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uP: { value: uP }, uQ: { value: uQ },
    uTint: { value: new THREE.Color(0.55, 0.23, 0.18) } }, vertexShader: sh.vertex, fragmentShader: sh.fragment, transparent: true }));
  set.mats.push(lm.material);
  lm.frustumCulled = false; lm.raycast = () => {};
  set.group.add(lm);
  let built = false;
  // the slice: the tile's cells as nuclei on a pink ground (a canvas drawn once), on a thin slab whose front faces +z
  // while it stands in the liver and +y once it lies flat (the tile's far edge, y = 0, at its top, then away from you)
  const T = TDATA.tile, side = TOPO_DATA.tile.side, px = 512, cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const cx = cv.getContext('2d'), LK = TLOOK(K, set), hex = c => `rgb(${c.map(v => Math.round(255 * clamp(v, 0, 1))).join(',')})`;
  const g0 = cx.createRadialGradient(px / 2, px / 2, px * 0.1, px / 2, px / 2, px * 0.75);
  g0.addColorStop(0, hex(LK.EOSIN)); g0.addColorStop(1, hex(LK.EOSINPALE));
  cx.fillStyle = g0; cx.fillRect(0, 0, px, px);
  const s = px / side;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < T.n; i++) {
    const kd = LK.kindOf(T.types[T.type[i]]), [cy, nu] = LK.CELLCOL[kd], x = T.x[i] * s, y = T.y[i] * s, a = (i * 2.399) % Math.PI;
    cx.beginPath();
    if (!pass) { cx.fillStyle = hex(cy); cx.ellipse(x, y, kd === 2 ? 9 * s * 1.4 : 9 * s, kd === 2 ? 3 * s * 1.4 : 9 * s, a, 0, 7); }
    else { cx.fillStyle = hex(nu); cx.ellipse(x, y, kd === 2 ? 5 * s : kd === 3 ? 3.2 * s : 3.8 * s, kd === 2 ? 1.6 * s : kd === 3 ? 3.2 * s : 3.8 * s, a, 0, 7); }
    cx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const face = K.fade(set, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0, side: THREE.DoubleSide }));
  const edge = K.fade(set, new THREE.MeshStandardMaterial({ color: new THREE.Color(...LK.EOSIN), roughness: 0.6 }));
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [edge, edge, edge, edge, face, face]);
  slab.raycast = () => {};
  set.group.add(slab);
  slab.renderOrder = 1; lm.renderOrder = 2;   // (the liver drawn after the slice, so the slice shows through it as it fades)
  const qUp = new THREE.Quaternion(), qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), _h = [0, 0, 0], _p = [0, 0, 0];
  const lerp3 = (a, b, x, o) => { for (let j = 0; j < 3; j++) o[j] = a[j] + (b[j] - a[j]) * x; return o; };
  // where the story's labels point (the liver, the slice), as last drawn
  const at = { liver: [0, 0, 0], slice: [0, 0, 0] };
  return Object.assign(set, {
    at,
    update(S, t) {
      if (!built && ORGAN3D.has(LIVER)) {
        const M = ORGAN3D.mesh(LIVER), g = lm.geometry;
        g.setAttribute('position', new THREE.BufferAttribute(M.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(M.nrm, 3));
        g.setAttribute('aCol', new THREE.BufferAttribute(M.col, 3)); g.setAttribute('aSlot', new THREE.BufferAttribute(new Float32Array(M.pos.length / 3), 1));
        g.setIndex(new THREE.BufferAttribute(M.idx, 1));
        built = true;
      }
      const L = smooth(clamp(S.liver_lift, 0, 1)), sl = clamp(S.liver_slice, 0, 1);
      const home = GL.sets.body.anchors.liver, h = typeof home === 'function' ? home() : home || [-0.085, 0.215, 0.025];
      const p = lerp3(h, LIVER_OUT, L, _p), size = 0.085 + (0.3 - 0.085) * L;
      // (it turns slowly once out, by story time: the same picture at the same moment)
      const ghost = 1 - 0.62 * smooth(sl / 0.45), gone = 1 - smooth((sl - 0.45) / 0.1);
      uQ[0].set(ghost * gone, 0.15 + 0.3 * L, L * (0.35 * t - 0.6), 0.25 * (1 - L));
      uP[0].set(p[0], p[1], p[2], size);
      lm.visible = built && ghost * gone > 0.01;
      // the slice: standing in the liver's middle as it shows, then falling flat and growing into the tile at the origin
      const sv = smooth(sl / 0.3), f = smooth((sl - 0.55) / 0.45), w = (0.26 * size / 0.3 + (TW_TILE - 0.26 * size / 0.3) * f) * (0.4 + 0.6 * sv);
      slab.visible = sv > 0.01;
      slab.scale.set(w, w, 0.012 - 0.008 * f);
      slab.quaternion.copy(qUp).slerp(qFlat, f);
      _h[0] = p[0] * (1 - f); _h[1] = p[1] + (-0.002 - p[1]) * f; _h[2] = (p[2] + 0.02) * (1 - f);
      slab.position.set(_h[0], _h[1], _h[2]);
      at.liver[0] = p[0] - 0.75 * size; at.liver[1] = p[1] + 0.45 * size; at.liver[2] = p[2];
      at.slice[0] = _h[0] + slab.scale.x * 0.5; at.slice[1] = _h[1] + slab.scale.y * 0.5 * (1 - f); at.slice[2] = _h[2];
      face.userData.base = edge.userData.base = sv;
      set.setAlpha(set.uA.value);
    },
  });
}
const TW_TILE = 1.6;   // the tile as the slide set lies it (its TW)
//#use BUILD
const LIVJOB = { idle: (dt, ms) => { if (ms > 0) { ORGAN3D.step(ms); GL.livDone = ORGAN3D.has(LIVER); } return !GL.livDone; } };
//#use buildMs buildTurn PRIME primeCheck primeStep
// show each set as far as S fades it in, and let the visible ones update (the hidden ones idle); in the story a set
// may be turned to meet the camera (see buildCamera)
function updateSets(S, t, dt, story) {
  const hid = [];
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.group.rotation.y = story ? setYaw(k, t) * D2R : 0;
    s.setAlpha(a);
    if (a > 0.003) s.update(S, t, dt);
    else { if (s.idle) hid.push(s); primeCheck(s); }   // a hidden set may build in slices (buildTurn, below), and is sent to the card when done (primeStep)
  }
  // the liver's model builds between frames from the start, a job of the build budget's (LIVJOB, by turns with the
  // hidden sets: v136; until then 3 ms a frame in a headset, 4 to 8 elsewhere): only the liver, wanted first, so the
  // queue of the other organs is left alone
  if (!GL.livDone) { ORGAN3D.driven = true; ORGAN3D.want(LIVER); hid.push(LIVJOB); }
  buildTurn(hid, dt);
  primeStep(dt);
  const la = S.liver_a || 0;
  GL.liver.group.rotation.y = story ? setYaw('body', t) * D2R : 0;
  GL.liver.setAlpha(la);
  if (la > 0.003) GL.liver.update(S, t);
}

// on a small screen held sideways the scene stands back to fit the strip above the panel (resize)
const STRIP_FIT = 0.9;
//#use _vd viewDir narrowK lowK applyCamera _yA keepCamera resize LV updateLight