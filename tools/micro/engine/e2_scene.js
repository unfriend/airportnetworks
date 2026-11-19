//#use head GL
// the sets, in the order they appear in the story
const SET_ORDER = ['body', 'tissue', 'slide', 'atlas', 'hier'];
// sets drawn in another set's frame: the slide's tiles and domains lie on the tour's tissue section, so the two always
// turn together (and show together)
const FRAME = { slide: 'tissue' };
//#use frameOf buildScene buildSet
// once every set is built (a step of the load): what joins them
function sceneJoin() {
  // one colour per domain in every set: the atlas set's (from the talk's figures), handed to the sets that take it
  const dc = GL.sets.atlas.api && GL.sets.atlas.api().domainColour;
  if (dc) for (const k of SET_ORDER) { const A = GL.sets[k].api && GL.sets[k].api(), f = A && (A.useColours || A.recolour); if (f && k !== 'atlas') f(dc); }
  // the network's layout to the atlas, whose sections turn into it in the story (atlas_net: they fly to its nodes)
  const nl = GL.sets.hier.api && GL.sets.hier.api().layout, un = GL.sets.atlas.api && GL.sets.atlas.api().useNetwork;
  if (nl && un) un(nl());
  // the 29 organs of GTEx as points of light in the tour's body (the engine's own, in the body set's frame)
  GL.dots = makeDots();
  GL.sets.body.group.add(GL.dots.group);
}
// The organs' points: MICRO_DATA.organs' home points in the body, under the params dots (0..1, as far as the body shows)
// and dots_pick (an organ's index + 1, 0 none: it grows and glows white, the others dim a little, and the organ's small
// 3D model (ORGAN3D) floats out beside it, turning slowly, once the models are built). They twinkle gently.
const DOT_COL = '#ff9ec4';
function makeDots() {
  const set = K.newSet('dots'), O = MICRO_DATA.organs, n = O.length, g = K.pointsGeo(n);
  const P = g.attributes.position.array, C = g.attributes.aCol.array, Z = g.attributes.aSize.array, A = g.attributes.aA.array;
  O.forEach((o, i) => { P.set(o.pos, 3 * i); C.set(K.rgb(DOT_COL), 3 * i); Z[i] = 0.05; });
  const pts = new THREE.Points(g, K.points(set, { vertex: 'gl_PointSize *= 1.0 + 0.18 * sin(uTime * 2.3 + position.x * 53.0 + position.y * 31.0);' }));
  pts.renderOrder = 4;
  set.group.add(pts);
  let last = -1, pickT = 0;
  const _p = new THREE.Vector3();
  // the model: only the picked organ's (its geometry swapped when the pick changes, as soon as that model is built: it
  // is wanted first), placed and shown by its uniforms
  const oP = [new THREE.Vector4()], oQ = [new THREE.Vector4()], sh = ORGAN3D.shader(1);
  const om = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uP: { value: oP }, uQ: { value: oQ },
    uTint: { value: new THREE.Color(...K.rgb(DOT_COL)) } }, vertexShader: sh.vertex, fragmentShader: sh.fragment, transparent: true }));
  set.mats.push(om.material);
  om.frustumCulled = false; om.renderOrder = 5; om.raycast = () => {}; om.visible = false;
  set.group.add(om);
  let omId = null;
  function model(id, t) {
    if (id !== omId) {
      const M = id && ORGAN3D.mesh(id);
      if (id && !M) return false;   // (wanted: built next)
      om.geometry.dispose();
      if (id && t - pickT > 0 && t - pickT < 9) pickT = t;   // (a model that came late grows from now; not after a seek)
      const mg = om.geometry = new THREE.BufferGeometry();
      if (M) {
        mg.setAttribute('position', new THREE.BufferAttribute(M.pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(M.nrm, 3));
        mg.setAttribute('aCol', new THREE.BufferAttribute(M.col, 3)); mg.setAttribute('aSlot', new THREE.BufferAttribute(new Float32Array(M.pos.length / 3), 1));
        mg.setIndex(new THREE.BufferAttribute(M.idx, 1));
      }
      omId = id;
    }
    return !!id;
  }
  return Object.assign(set, {
    update(S, t) {
      const k = Math.round(S.dots_pick || 0);
      if (k !== last) {
        pickT = last < 0 ? t - 9 : t; last = k;
        O.forEach((o, i) => { const on = k === i + 1; Z[i] = on ? 0.11 : 0.05; A[i] = !k || on ? 1 : 0.45; C.set(K.rgb(on ? '#ffffff' : DOT_COL), 3 * i); });
        g.attributes.aSize.needsUpdate = g.attributes.aA.needsUpdate = g.attributes.aCol.needsUpdate = true;
      }
      if (t < pickT) pickT = t - 9;   // (a seek back: shown at once)
      // the picked organ's model grows out in front of the body, beside its point (left of it: its label runs right)
      const o = O[k - 1];
      om.visible = model(o ? ORGAN3D.idOf(o.name) : null, t);
      if (!om.visible) return;
      const gr = smooth(clamp((t - pickT) / 0.9, 0, 1));
      oQ[0].set(gr, 0.25, t * 0.5, 0);
      oP[0].set(o.pos[0] - 0.19 * gr, o.pos[1] + 0.03, o.pos[2] + 0.16 * gr, 0.075 * (0.3 + 0.7 * gr));
    },
    // the organ a ray passes closest to (within about 0.045 of its point, in the body's units), or -1
    pick(rc) {
      pts.updateMatrixWorld();
      let best = -1, bd = 0.045 * pts.matrixWorld.getMaxScaleOnAxis();
      O.forEach((o, i) => { _p.fromArray(o.pos).applyMatrix4(pts.matrixWorld); const d = rc.ray.distanceToPoint(_p); if (d < bd) { bd = d; best = i; } });
      return best;
    },
  });
}
//#use BUILD
const ORGJOB = { idle: (dt, ms) => { if (ms > 0) GL.orgDone = ORGAN3D.step(ms); return !GL.orgDone; } };
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
  // the organs' 3D models and their pictures build between frames from the start, one organ after another (the one a
  // pane or the body wants first), a job of the build budget's (ORGJOB, by turns with the hidden sets: v136; until then
  // 3 ms a frame in a headset, 4 to 8 elsewhere, on top of theirs). Each picture goes into the HTML chips waiting for it
  // as it is done, and the headset's panels redraw on GL.orgV (at most twice a second while they come)
  if (!GL.orgDone) { ORGAN3D.driven = true; hid.push(ORGJOB); }
  buildTurn(hid, dt);
  primeStep(dt);
  if (!GL.orgDone || GL.orgV !== ORGAN3D.version()) {
    const v = ORGAN3D.version();
    if (v !== GL.orgSeen) { GL.orgSeen = v; fillOrganPics(); }
    const now = performance.now();
    if (GL.orgDone || now - (GL.orgVT || 0) > 500) { GL.orgVT = now; GL.orgV = v; }
  }
  const da = (S.body_a || 0) * (S.dots || 0);
  GL.dots.setAlpha(da);
  if (da > 0.003) GL.dots.update(S, t);
}

//#use _vd viewDir narrowK applyCamera _yA keepCamera resize LV updateLight