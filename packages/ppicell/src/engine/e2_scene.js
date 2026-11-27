//#use head GL
// the sets, in the order they appear in the story (each sets/<name>.js defines SETS.<name>; list the files in build.mjs)
// (the cell first: the others read its shapes and its background, and explore mode opens on it)
const SET_ORDER = ['cell', 'ball', 'crowd', 'walls', 'lens', 'sites', 'next'];
// sets drawn in the cell's frame (they turn with it): all but GRB2's close-up and the shuttle
const FRAME = { ball: 'cell', crowd: 'cell', walls: 'cell', lens: 'cell', next: 'cell' };
// on a small screen held sideways the scene stands back to fit the strip above the panel (resize)
const STRIP_FIT = 0.9;
//#use frameOf buildScene sceneJoin updateSets~2 _vd viewDir narrowK lowK applyCamera _yA keepCamera resize
//#use LV updateLight
// the protein models (src/models.json, built by tools/mol/build.py into models/; sets/models.js)
//#use MOLS molLoad molParse molMaterial molMesh molInstanced
// (v225) The sets whose models come after the load: the lenses' (chapter 6, 442 s) and the sites' (chapter 8, 581 s),
// 3.6 MB of the 5.8 MB of models the load waited for. Their models are fetched from the load on (molPrep: the walls'
// first, which the load still waits for: its views come from its models); until they are in, a stand-in takes the set's
// place: made by the set's own code without the models (as when they fail to load), for what the load reads (params,
// views, controls, labels, anchors), its group empty. Once they have come, the set itself is made in a frame of its own
// while it is hidden (idle: the stand-in's group holds it, at the same place in the scene), its materials compiled in
// the next (compileLate); a set asked to show before then (a seek, explore mode) is made at once if its models are in.
// Everything the story asks of the set goes to the set itself once it is made, to the stand-in until then.
const LATE = { lens: true, sites: true };
function buildSet(k) {
  if (LATE[k] && !SETS[k].prep(25)) {
    const s = lateSet(k);
    GL.sets[k] = s;
    GL.world.add(s.group);
    s.setAlpha(0);
    return;
  }
  if (SETS[k].prep && !SETS[k].prep(25)) return true;
  const s = SETS[k](K);
  GL.sets[k] = s;
  GL.world.add(s.group);
  s.setAlpha(0);
}
function lateSet(k) {
  const W = { dry: SETS[k](K), real: null, a: 0, compiled: false }, group = new THREE.Group();
  group.name = k;
  const of = () => W.real || W.dry, fwd = (o, key) => (typeof o[key] === 'function' ? (...a) => (W.real || W.dry)[key](...a) : o[key]);
  const make = () => {
    const s = SETS[k](K);
    // (what the load took from the stand-in must be the set's own: its views and params do not depend on its models)
    if (JSON.stringify([s.cam, s.params]) !== JSON.stringify([W.dry.cam, W.dry.params])) console.warn(`${k}: its views differ with its models`);
    W.real = s; W.dry = null;
    group.add(s.group);
    s.setAlpha(W.a);
  };
  const ready = () => SETS[k].prep(25);
  const w = Object.assign({}, W.dry, {
    group, late: true,
    setAlpha(a) { W.a = a; group.visible = a > 0.003; if (W.real) W.real.setAlpha(a); },
    update(S, t, dt) {
      if (!W.real && ready()) { make(); compileLate(W.real.group); W.compiled = true; }   // (asked for before it was made: at once)
      if (W.real) W.real.update(S, t, dt);
    },
    // hidden: made once its models are in (a frame), compiled (the next); idle(dt, 0) only asks whether work is left
    idle(dt, ms) {
      if (W.real && W.compiled) return false;
      if (ms === 0 || !ready()) return true;
      if (!W.real) make(); else { compileLate(W.real.group); W.compiled = true; }
      return !W.compiled;
    },
    labels: (W.dry.labels || []).map((L, i) => { const o = {}; for (const key in L) o[key] = typeof L[key] === 'function' ? (...a) => of().labels[i][key](...a) : L[key]; return o; }),
    anchors: new Proxy(W.dry.anchors || {}, { get: (o, key) => (of().anchors || {})[key] }),
    dispose() { if (W.real && W.real.dispose) W.real.dispose(); },
  });
  for (const key in W.dry) if (typeof W.dry[key] === 'function' && !(key in { setAlpha: 1, update: 1, idle: 1, dispose: 1 })) w[key] = fwd(W.dry, key);
  return w;
}
