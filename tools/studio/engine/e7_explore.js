
// ================================================================ EXPLORE ==
// Explore mode is the studio itself: the scene, and four panes (Scene, Add, Item, Items), each described once as a
// list of blocks (paneBlocks) that the page draws as HTML (renderPanes) and the headset as its canvas twin
// (drawExplorePane), so both say the same; on pages a fifth, Upload (e7b_upload.js), which a headset never shows. On a
// page the camera goes round the scene (Orbit) or walks in it at 1.6 m
// (Walk: where cubes trigger on a page); editing, a click selects and the arrows (TransformControls) move, turn and
// size what is selected.
const TABS = [['scene', 'Scene'], ['add', 'Add'], ['item', 'Item'], ['items', 'Items'], ['upload', 'Upload']];
const X = { tab: 'scene', view: 'orbit', tcMode: 'translate', dirty: false, drawn: 0, tcDrag: false, tcUp: 0, scroll: {}, scrollMax: {}, scrollView: 0, scrollF: { tab: '', v: 0, at: -1 }, orig: false, texAdd: null, texFor: null, sliding: false };
const XS = {};
const orbit = { cur: [24, 20, 7, 0, 1, 0], from: null, to: null, t0: 0, dur: 1.2 };
const WALK = { pos: new THREE.Vector3(0, 1.6, 3), yaw: 0, pitch: -0.08, to: null };
const KEYS = new Set();

function exploreTargets() {
  const out = {};
  for (const n in DEF) out[n] = n.endsWith('_a') ? 0 : XS[n];
  out.stage_a = 1;
  return out;
}
function exploreStep(dt) {
  const tg = exploreTargets(), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = XS[n] + (tg[n] - XS[n]) * k;
  return XS;
}
function openScene_() { /* (the engine's scene list has one entry: the stage) */ }
function flyTo(v) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = v.slice();
  orbit.to[0] = v[0] + 360 * Math.round((c[0] - v[0]) / 360);
  orbit.t0 = performance.now();
}
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / (orbit.dur * 1000)), f = orbit.from, t = orbit.to;
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) orbit.to = null;
}
// the whole scene in view (once a scene's models are in, and on View: Orbit)
function frameScene(now) {
  const b = new THREE.Box3();
  for (const it of STU.items.values()) {
    if (it.kind === 'o') { const ob = objBox(it); if (ob) b.union(ob); else b.expandByPoint(_sv.fromArray(it.rec.p)); }
    else if (it.kind === 'c') { b.expandByPoint(_sv.fromArray(it.rec.p).addScalar(-0.5)); b.expandByPoint(_sv.fromArray(it.rec.p).addScalar(0.5)); }
    else if (it.kind === 's' || it.kind === 'e') b.expandByPoint(_sv.fromArray(it.rec.p));   // (a cut-out is within its object)
    else if (it.kind === 'p') b.union(shapeBox(it, new THREE.Box3(), true));
  }
  if (b.isEmpty()) b.set(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 2, 2));
  const c = b.getCenter(new THREE.Vector3()), r = Math.max(1, b.getSize(new THREE.Vector3()).length() / 2);
  const v = [orbit.cur[0], 24, clamp(r * 2.1, 2.5, 80), c.x, clamp(c.y, 0.5, 3), c.z];
  if (now) flyTo(v); else { orbit.cur = v; orbit.to = null; }
}
function setView(name) {
  if (name !== 'orbit' && name !== 'walk') return;
  if (name !== X.view) sfxAct('whoosh', 'stage', 'centre', { dur: 0.6 });
  X.view = name;
  KEYS.clear(); WALK.to = null;
  if (name === 'orbit') frameScene(true);
  document.querySelectorAll('[data-ctl="view"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === name));
  dirty(true);
}

// ------------------------------------------------------------ the panes --
// A pane is a list of blocks: { h, sub } a heading; { p, c } a line (c: muted, faint, amber, red, green); { code } a
// command; { kv: [[name, value]] }; { label, row: [buttons] }; { label, list: [rows] }; { label, grid: [cards] } (the Add
// pane's models: a card is a row with pic, the models whose picture it shows, first that has one, kind, the plain tile's
// word, sub2 a second line, and title, the page's tooltip; the Items pane's cards (item: true) also tile, a tile drawn for
// what has no file, sel and pk (selected; picked for a cube's list or a group), lock and moves (marks), tags (an object's
// cut-outs: buttons) and ticks (Shows and Hides: [[list, on]])); { label, gh } (a group's heading in the Items pane: a
// button). A button or a row: { id, label,
// sub, act, v, on, dis, primary, warn, col, page (page only), xr (headset only) }
const SOUND_NOTE = 'The scene\'s sounds follow this device\'s Sound button (not the Sound effects or Narration switches: they are the scene\'s own).';
const hhmm = ms => { const d = new Date(ms), t = d.toTimeString().slice(0, 5); return d.toDateString() === new Date().toDateString() ? t : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + t; };
const mb = n => (n >= 1 << 20 ? (n / 1048576).toFixed(n >= 10 << 20 ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const metres = v => (v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3)).replace(/\.?0+$/, '') + ' m';
function srcLine() {
  if (SRC.state === 'looking') return 'Looking for scenes...';
  if (SRC.kind === 'relay') return `Scenes from the relay at ${SRC.base.replace(/^https?:\/\//, '')}` + (SRC.save ? ' (it saves layouts).' : ' (read only).');
  if (SRC.state === 'none') return SRC.noScenes ? 'The relay serves no scenes, and there is no folder of scenes next to the app.' : 'No relay and no folder of scenes found.';
  return `Scenes from the folder ${SRC.folder} (read only).`;
}
function savedLine() {
  if (STU.listing !== 'ok') return '';
  const by = STU.savedBy && !(HOST.collab && HOST.collab.name === STU.savedBy) ? ' by ' + STU.savedBy : '';
  if (unsaved()) return 'Unsaved changes' + (STU.savedAt ? ` (saved ${hhmm(STU.savedAt)}${by})` : '') + (SRC.kind !== 'relay' ? ': this folder is read only, Download layout.json and put it in the scene\'s folder.' : '.');
  return STU.savedAt ? `Saved ${hhmm(STU.savedAt)}${by}.` : 'Nothing placed or saved yet.';
}
// the Quest's budget, said (never refused): triangles in the scene and in one model, big textures
function budget() {
  let tris = 0;
  const big = new Set(), heavy = [];
  for (const it of STU.items.values()) {
    if (it.kind !== 'o' || !it.E || !it.E.info) continue;
    tris += it.E.info.tris;
    if (it.E.info.tris > 300000 && !heavy.includes(it.rec.file)) heavy.push(it.rec.file);
    for (const t of it.E.info.textures) if ((t.to || Math.max(t.w, t.h)) > 2048) big.add(it.rec.file + '|' + t.name);
  }
  const out = [];
  if (tris > 500000) out.push(`${fmt(tris)} triangles in the scene: more than a Quest draws smoothly (about 500,000).`);
  for (const f of heavy) out.push(`${baseName(f)} has more than 300,000 triangles: heavy for a Quest.`);
  if (big.size > 6) out.push(`${big.size} textures over 2,048 px: a Quest may run short of memory.`);
  return { tris, notes: out };
}
function paneBlocks(tab) {
  const B = [], ed = editOn(), lock = editLocked(), st = atStation();
  if (tab === 'scene') {
    B.push({ h: STU.scene || 'Your own scenes', sub: 'Studio' }, { p: srcLine(), c: 'muted' });
    if (SRC.state === 'auth') B.push({ p: AUTH_NOTE, c: 'amber' });
    if (SRC.state === 'error') B.push({ p: 'The scenes could not be listed: ' + SRC.note, c: 'red' });
    if (SRC.state === 'ok') {
      if (SRC.scenes.length) B.push({ label: st ? 'Scenes (the scene here is for everyone at this circle)' : 'Scenes', row: SRC.scenes.map(s => ({ id: 'scene:' + s.name, label: s.name, act: 'scene', v: s.name, on: s.name === STU.scene, dis: lock && s.name !== STU.scene })) });
      else B.push({ p: 'No scenes yet: each folder in ' + (SRC.kind === 'relay' ? 'the relay\'s scenes folder' : SRC.folder) + ' is a scene.', c: 'muted' });
      if (!STU.scene && SRC.scenes.length) B.push({ p: 'Pick a scene.' });
      // a new scene, made on the relay and opened (a page names it in a field, a headset on the shell's keypad)
      if (canMake()) {
        B.push({ row: [{ id: 'newscene', label: NS.making ? 'Making...' : XR.on ? (NS.asking ? 'Naming it...' : 'New scene...') : 'New scene' + (NS.open ? ' ▾' : ''), act: 'newscene', on: (NS.open && !XR.on) || NS.asking, dis: NS.making || NS.asking }] });
        if (NS.open && !XR.on) B.push({ page: true, input: { id: 'stuSceneName', value: NS.name, ph: 'The new scene\'s name' }, row: [{ id: 'scenemake', label: NS.making ? 'Making...' : 'Make it', act: 'scenemake', primary: true, dis: NS.making || !NS.name.trim() }] });
      }
      if (NS.note) B.push({ p: NS.note, c: 'red' });
    }
    if (['none', 'error', 'auth'].includes(SRC.state)) B.push({ row: [{ id: 'again', label: 'Look again', act: 'again' }] });
    if (STU.listing === 'loading' || STU.listing === 'waiting') B.push({ p: 'Reading the scene...', c: 'faint' });
    if (STU.note) B.push({ p: STU.note, c: 'amber' });
    if (STU.bad) B.push({ p: `${STU.bad} item${STU.bad === 1 ? '' : 's'} in layout.json could not be read.`, c: 'amber' });
    if (STU.badTex) B.push({ p: `${STU.badTex} of the trigger cubes' texture changes in layout.json could not be read.`, c: 'amber' });
    if (STU.scene && !OPT.visit) {
      B.push({ row: [
        { id: 'edit', label: 'Edit: ' + (STU.edit && !lock ? 'on' : 'off'), act: 'edit', on: STU.edit && !lock, dis: lock },
        SRC.kind === 'relay' ? { id: 'save', label: STU.saving ? 'Saving...' : 'Save', act: 'save', primary: canSave() && unsaved(), dis: !canSave() || STU.saving || !ed } : null,
        { id: 'undo', label: 'Undo' + (UNDO.length ? ` (${UNDO.length})` : ''), act: 'undo', dis: !UNDO.length || !ed },
        { id: 'load', label: STU.loadAsk ? 'Press again to load' : 'Load saved', act: 'load', dis: STU.listing !== 'ok' || !ed, warn: !!STU.loadAsk },
      ].filter(Boolean) });
      if (lock) B.push({ p: 'This scene is locked (Lock this story): unlock it in the menu or the Shared dialog to edit.', c: 'amber' });
      const sl = savedLine();
      if (sl) B.push({ p: sl, c: unsaved() ? 'amber' : 'muted' });
      if (STU.saveNote) B.push({ p: STU.saveNote, c: 'red' });
    }
    if (STU.draft) B.push({ p: `Your unsaved changes from ${hhmm(STU.draft.at)}:`, c: 'amber' }, { row: [{ id: 'restore', label: 'Restore', act: 'restore', primary: true }, { id: 'discard', label: 'Discard', act: 'discard' }] });
    if (STU.scene && ed && STU.listing === 'ok') { pauseBlocks(B, true); settingsBlocks(B, st); }   // (Pause, this device's: e6h_ghost.js; the scene's settings, saved with it: e6d_shapes.js)
    if (STU.scene) {
      B.push({ row: [
        { id: 'seen', label: 'Reset what I have seen', act: 'seen', dis: !STU.seen.size },
        { id: 'download', label: 'Download layout.json', act: 'download', page: true, dis: STU.listing !== 'ok' },
        OPT.visit ? null : { id: 'upload', label: 'Upload', act: 'upload', page: true, dis: !ed },
      ].filter(Boolean) });
      if (STU.upNote) B.push({ p: STU.upNote, c: 'muted' });
      for (const n of budget().notes) B.push({ p: n, c: 'amber' });
      if ([...STU.items.values()].some(it => it.kind === 's')) B.push({ p: SOUND_NOTE, c: 'faint' });
    }
    if (SRC.kind !== 'relay' && SRC.state !== 'looking') {
      B.push({ p: 'To serve your own scenes and save their layouts, run a relay on a computer here:', c: 'muted' }, { code: 'node relay/server.mjs --lan --scenes <folder>' },
        { p: 'Each folder in it is a scene: models, their textures, sounds, and layout.json. Its page /upload (the Upload tab here) converts and sorts what you drop into it.', c: 'faint' });
    }
    // which files to use (the formats guide, short; tools/studio/README.md has it all), where no scene is found
    if (SRC.state !== 'looking' && !STU.scene && (!SRC.scenes.length || ['none', 'error'].includes(SRC.state))) {
      B.push({ label: 'Which files', p: 'Models: GLB (one file, textures and animations inside); FBX works, but converted to GLB it loads faster and sits right without guessing (the Upload tab converts it). Textures: JPEG for photos and scans, PNG only where see-through, at most 4,096 px (2,048 safer on a Quest). A Quest draws about 300,000 triangles a model, 500,000 a scene. Sounds: mono; short loops as WAV, long ones as MP3.', c: 'faint' });
    }
    if (!OPT.visit) B.push({ p: ed ? (XR.on ? 'Trigger: select (on a group\'s member: the group; again: that member; standing inside a model and pointing at nothing: that model). Grip: carry (both grips size an object, a cut-out or a group; a corner of a cube or a cut-out stretches it; Hold it on a card: the next grip carries it wherever you point). Left stick: walk; right stick: turn; pointing at this panel, a stick scrolls it.' : 'Click: select (on a group\'s member: the group; again: that member). W, E, R: move, turn, size. D: duplicate. Delete. Ctrl+Z: undo. P: pause what moves. Walk view: W A S D to walk; standing inside a model, a click on nothing (not the floor) selects it.') : 'Turn on Edit to place things.', c: 'faint' });
  } else if (tab === 'add') {
    B.push({ h: 'Add', sub: STU.scene || 'No scene' });
    if (!ed) { B.push({ p: OPT.visit ? 'Nothing to add here.' : !STU.scene ? 'Pick a scene first (under Scene).' : lock ? 'This scene is locked (Lock this story).' : 'Turn on Edit (under Scene) to place things.', c: 'muted' }); return B; }
    if (STU.listing !== 'ok') { B.push({ p: 'Reading the scene...', c: 'faint' }); return B; }
    B.push({ p: 'A press places it 1.5 m in front of you, on the floor, selected.', c: 'muted' });
    const L = sceneLists(), full = k => countOf(k) >= LIMITS[k], froms = new Map([...L.stands].map(([o, g]) => [g, o]));
    // a model as a card: its picture (an original a GLB stands for shows the GLB's, else its own; e7e_pics.js), its name
    // (models/ left out), its size in metres and triangles where known, else its bytes, and what it was made from or into
    const modelCard = (f, orig) => {
      const E = LIB.get(f.path), w = (E && (E.state === 'failed' || (E.info && E.info.tris > 300000) || E.missing.size)) || f.bytes > 60 << 20, g = L.stands.get(f.path);
      return { id: 'add:' + f.path, label: orig ? f.path.replace(/^originals\//i, '') : f.path.replace(/^models\//i, ''), title: f.path, act: 'add', v: f.path, warn: w && !g, dis: full('o'), look: true,
        pic: g ? [g, f.path] : [f.path], kind: extOf(f.path).toUpperCase(), sub: modelWords(g ? STU.fileMap.get(g) || f : f),
        sub2: g ? `converted: ${baseName(g)}` : froms.has(f.path) ? `from ${baseName(froms.get(f.path))}` : '' };
    };
    B.push({ label: `Models (${L.models.length})`, grid: L.models.map(f => modelCard(f, false)) });
    if (!L.models.length) B.push({ p: 'No models in the scene\'s folder: put .glb (best), .gltf, .fbx, .obj, .ply or .stl files there, or drop them under Upload.', c: 'faint' });
    // (the page makes the pictures the cards lack: e7e_pics.js)
    const lack = XR.on ? [] : pvMissing();
    if (!XR.on && (lack.length || PV.make)) B.push({ page: true, row: [
      { id: 'pics', label: PV.make ? `Making pictures: ${PV.make.i} of ${PV.make.n}` + (PV.make.path ? ` (${baseName(PV.make.path)})...` : '...') : `Make pictures (${lack.length})`, act: 'pics', dis: !!PV.make || !!CV.busy },
      PV.make ? { id: 'picstop', label: PV.make.stop ? 'Stopping...' : 'Stop', act: 'picstop', dis: PV.make.stop } : null,
    ].filter(Boolean) }, { page: true, p: 'A picture of each model that has none, one after another' + (canUpload() ? ', kept in the scene (previews/) for everyone.' : ', for this page only (a relay that takes uploads keeps them in the scene).'), c: 'faint' });
    if (PV.note && !XR.on) B.push({ page: true, p: PV.note, c: PV.noteC });
    // (the page converts: every model to place that is not a GLB yet)
    const conv = L.models.filter(f => extOf(f.path) !== 'glb');
    if (!XR.on && conv.length) B.push({ page: true, row: [{ id: 'convertAll', label: CV.all ? `Converting ${CV.all.i} of ${CV.all.n}...` : `Convert every model to GLB (${conv.length})`, act: 'convertAll', dis: !!CV.busy || !!CV.all }] },
      { page: true, p: `GLB loads faster and sits right without guessing; textures at most ${fmt(maxTexNow())} px (For Quest, under Upload). ` + (canUpload() ? 'Each goes into models/, and what is placed from it switches to it.' : 'Without a relay that takes uploads, each is downloaded.'), c: 'faint' });
    else if (XR.on && conv.length) B.push({ p: `${conv.length} model${conv.length === 1 ? '' : 's'} could be converted to GLB (faster to load): convert on a laptop, under Add or Upload.`, c: 'faint' });
    if (CV.note && !XR.on) B.push({ page: true, p: CV.note, c: CV.noteC });
    B.push({ label: `Sounds (${L.sounds.length})`, list: L.sounds.map(f => ({ id: 'adds:' + f.path, label: f.path, sub: mb(f.bytes) + (SND.get(f.path) && SND.get(f.path).stream ? ' · streamed' : ''), act: 'adds', v: f.path, dis: full('s') })) });
    if (!L.sounds.length) B.push({ p: 'No sounds in the scene\'s folder (.mp3, .ogg, .wav, .m4a...).', c: 'faint' });
    if (L.orig.length) {
      B.push({ row: [{ id: 'orig', label: `Originals (${L.orig.length}) ${X.orig ? '▾' : '▸'}`, act: 'orig', on: X.orig }] });
      if (X.orig) {
        const om = L.orig.filter(f => f.kind === 'model'), ot = L.orig.filter(f => f.kind !== 'model');
        if (om.length) B.push({ grid: om.map(f => modelCard(f, true)) });
        if (ot.length) B.push({ list: ot.map(f => ({ id: 'orig:' + f.path, label: f.path.replace(/^originals\//i, ''), sub: mb(f.bytes) + ' · kept as given', act: f.kind === 'audio' ? 'adds' : 'none', v: f.path, dis: f.kind !== 'audio' || full('s') })) });
        B.push({ p: 'The files as they were given (kept so a model can be converted again). A model a GLB was made from places the GLB.', c: 'faint' });
      }
    }
    fromBlocks(B, full);
    B.push({ label: 'Trigger cube', row: [{ id: 'cube', label: 'Trigger cube', act: 'cube', dis: full('c') }] }, { p: 'A see-through cube: walking into it shows or hides the objects, sounds and cut-outs you pick for it.', c: 'faint' });
    // shapes and empties (e6d_shapes.js)
    B.push({ label: 'Shapes', row: SHAPE_KINDS.map(k => ({ id: 'shape:' + k, label: SHAPE_WORD[k], act: 'shape', v: k, dis: full('p') })) },
      { p: 'A plain shape in a colour, or one that hides things: invisible, it hides the scene behind it (in AR your room shows through it), as a real table or wall would.', c: 'faint' },
      { label: 'Empty', row: [{ id: 'empty', label: 'Empty', act: 'empty', dis: full('e') }] },
      { p: 'A point seen only while editing: a sound can follow it (a voice in mid-air), and it moves and groups as anything else.', c: 'faint' });
    // a cut-out on the selected model (or the model of the selected cut-out)
    const so = selModel();
    B.push({ label: 'Cut-out box', row: [{ id: 'cutbox', label: so ? `Cut-out box on ${so.rec.name}` : 'Cut-out box: select a model first', act: 'cutbox', dis: !canCut(so) }] },
      { p: 'A box that hides the part of a model inside it (a door in a wall), without changing the model\'s file.', c: 'faint' });
    if (so && cutsOn(so.id).length >= CUT_MAX) B.push({ p: `${so.rec.name} has ${CUT_MAX} cut-outs: the most one model takes.`, c: 'amber' });
    if (so && so.rec.cutsLocked) B.push({ p: `${so.rec.name}'s cut-outs are locked: unlock them on its card to add one.`, c: 'amber' });
    for (const k of ['o', 'c', 's', 'x', 'p', 'e']) if (full(k)) B.push({ p: `The scene has ${LIMITS[k]} ${KIND_PLURAL[k]}: the most it can hold.`, c: 'amber' });
  } else if (tab === 'upload') {
    uploadBlocks(B);
  } else if (tab === 'item') {
    const it = STU.items.get(STU.sel);
    if (!it) { B.push({ h: 'Item' }, { p: ed ? (XR.on ? 'Point at something in the scene and pull the trigger, or pick it under Items.' : 'Click something in the scene, or pick it under Items.') : 'Pick something under Items to see its card.', c: 'muted' }); return B; }
    itemBlocks(it, B, ed);
  } else {
    // the Items pane as cards, the Add pane's look (the owner, 7 November 2026: "items need a preview in the items list
    // tab, should show the same image and look like the add item part"): groups first, a heading each (a press selects the
    // group) with its members' cards under it; then what is in no group, by kind. An object's cut-outs are tags on its card
    const all = [...STU.items.values()], P = STU.pick && STU.items.get(STU.pick.id), GP = STU.gpick && STU.items.get(STU.gpick.id);
    B.push({ h: 'Items', sub: `${countOf('o')} objects · ${countOf('c')} cubes · ${countOf('s')} sounds` + (countOf('x') ? ` · ${countOf('x')} cut-outs` : '') + (countOf('p') ? ` · ${countOf('p')} shapes` : '') + (countOf('e') ? ` · ${countOf('e')} empties` : '') + (countOf('g') ? ` · ${countOf('g')} groups` : '') });
    if (P) B.push({ p: `Picking what ${P.rec.name} ${STU.pick.list === 'show' ? 'shows' : 'hides'}: press items to add or remove them (a group's name: all of its members).`, c: 'amber' }, { row: [{ id: 'pickdone', label: 'Done', act: 'pickdone', primary: true }] });
    if (GP) B.push({ p: `Picking what is in ${GP.rec.name}: press items to put them in or take them out.`, c: 'amber' }, { row: [{ id: 'gpickdone', label: 'Done', act: 'gpickdone', primary: true }] });
    if (!all.length) B.push({ p: STU.scene ? 'Nothing placed yet.' : 'No scene open.', c: 'muted' });
    const selCube = ed && STU.items.get(STU.sel) && STU.items.get(STU.sel).kind === 'c' ? STU.items.get(STU.sel) : null;
    if (selCube) B.push({ p: `Shows and Hides under each card: what ${selCube.rec.name} shows and hides (a press puts it on that list, again takes it off).`, c: 'faint' });
    // (which GLB stands for which original: worked out once a render, and only when an object's card asks)
    let S = null;
    const C = { P, GP, selCube, stands: f => (S || (S = glbFor())).get(f) };
    // (groups first, each with its members under it; picking for a cube, a group's name puts all of its members in or out)
    const gs = all.filter(it => it.kind === 'g'), grouped = new Set();
    for (const g of gs) {
      const ms = members(g), inAll = !!P && ms.some(m => m.kind !== 'c') && ms.filter(m => m.kind !== 'c').every(m => P.rec.show.includes(m.id) || P.rec.hide.includes(m.id));
      for (const m of ms) grouped.add(m.id);
      B.push({ label: g === gs[0] ? `Groups (${gs.length})` : '', gh: { id: 'sel:' + g.id, label: (inAll ? '✓ ' : '') + '▣ ' + g.rec.name, sub: itemSub(g), act: P ? 'linkg' : 'sel', v: g.id, on: g.id === STU.sel || (!!GP && GP === g), sel: g.id === STU.sel, lock: !!g.rec.locked, col: g.look.col } });
      if (ms.length) B.push({ grid: ms.map(m => itemCard(m, C)) });
    }
    // (each object's cut-outs on its card; cut-outs whose object is not here on their own)
    for (const [k, title] of [['o', 'Objects'], ['p', 'Shapes'], ['e', 'Empties'], ['c', 'Trigger cubes'], ['s', 'Sounds'], ['x', 'Cut-outs cutting nothing']]) {
      const L = all.filter(it => it.kind === k && !grouped.has(it.id) && (k !== 'x' || !cutObj(it)));
      if (L.length) B.push({ label: title + ` (${L.length})`, grid: L.map(it => itemCard(it, C)) });
    }
  }
  return B;
}
// From another scene... (the Add pane, page and headset): the relay's other scenes, then the one picked's models and sounds
// (models/ and sounds/ first, its originals folded); a press copies one in and places it (copyIn, e4_files.js)
function fromBlocks(B, full) {
  const F = FROM, others = SRC.scenes.filter(s => s.name !== STU.scene);
  if (!canCopy()) { F.open = false; return; }
  B.push({ label: 'From another scene', row: [{ id: 'from', label: F.open ? 'From another scene ▾' : 'From another scene...', act: 'from', on: F.open }] });
  if (!F.open) { B.push({ p: 'A model or a sound of another of the relay\'s scenes, copied into this one and placed.', c: 'faint' }); return; }
  B.push({ row: others.map(s => ({ id: 'froms:' + s.name, label: s.name, act: 'fromScene', v: s.name, on: s.name === F.scene, dis: !!F.busy })) });
  if (!F.scene) B.push({ p: 'Pick the scene to copy from.', c: 'muted' });
  else if (F.loading) B.push({ p: `Reading ${F.scene}...`, c: 'faint' });
  else if (F.files) {
    const L = fromLists(F.files), row = (f, orig) => ({ id: 'fromf:' + f.path, label: orig ? f.path.replace(/^originals\//i, '') : f.path, sub: (F.busy === f.path ? 'copying · ' : '') + mb(f.bytes),
      act: 'fromFile', v: f.path, on: F.busy === f.path, dis: !!F.busy || full(f.kind === 'audio' ? 's' : 'o') });
    B.push({ label: `Models in ${F.scene} (${L.models.length})`, list: L.models.map(f => row(f)) }, { label: `Sounds in ${F.scene} (${L.sounds.length})`, list: L.sounds.map(f => row(f)) });
    if (L.orig.length) {
      B.push({ row: [{ id: 'fromorig', label: `Its originals (${L.orig.length}) ${F.orig ? '▾' : '▸'}`, act: 'fromOrig', on: F.orig }] });
      if (F.orig) B.push({ list: L.orig.map(f => row(f, true)) });
    }
  }
  if (F.note) B.push({ p: F.note, c: F.noteC });
  B.push({ p: 'A press copies the file into this scene at the same path (a new name when that is taken), with the files a model names (its MTL, textures, a glTF\'s .bin), and places it 1.5 m in front of you. Each scene keeps its own copy.', c: 'faint' });
}
function itemSub(it) {
  if (it.kind === 'g') { const n = members(it).length; return `${n} item${n === 1 ? '' : 's'}` + (STU.gpick && STU.gpick.id === it.id ? ' · picking' : ''); }
  if (it.kind === 'x') { const ob = cutObj(it); return (ob ? 'cuts ' + ob.rec.name : 'cuts nothing') + ` · ${it.rec.size.map(metres).join(' × ')}` + (ob ? cutWords(it, ob).replace(' · whole', ' · previewed whole').replace(/^ · cut$/, ' · previewed cut') : ''); }
  const r = it.rec, me = (r.motion ? ' · ' + MOTION[r.motion.kind].does : '') + (r.path ? (recording(it) ? ' · recording' : ' · recorded path') : '') + (r.locked ? ' · locked' : '') + (it.kind !== 'c' ? ((it.kind === 's' ? it.heard : it.shown) ? '' : ' · hidden for you') : '');
  if (it.kind === 'o') return baseName(r.file) + me;
  if (it.kind === 'p') return SHAPE_WORD[r.shape] + (r.look === 'hide' ? ' · hides things' : '') + me;
  if (it.kind === 'e') { const n = followersOf(it.id).length; return 'empty' + (n ? ` · ${n} sound${n > 1 ? 's' : ''}` : '') + me; }
  if (it.kind === 's') return baseName(r.file) + ` · ${Math.round(r.vol * 100)} %` + (r.on ? ' · → ' + followWords(it) : '') + me;
  return `shows ${r.show.length}, hides ${r.hide.length}` + (r.mode === 'stay' ? ' · stays' : '') + (it.act ? ' · active for you' : '');
}
// an item as a card of the Items pane (C: the pane's picks, the selected cube and which GLB stands for a file): an object
// its model's picture (as the Add pane shows it for that file: an original a GLB stands for shows the GLB's), else the plain
// tile with its kind; what has no file a tile drawn for it (tileFor, e7e_pics.js); its name, a short line and a faint one
// (which also says what moves it, the headset having no tooltip); marks for a lock and for moving (a motion, a recorded
// path or a behaviour); an object's cut-outs as tags (a press selects one; picking for a cube, green or red on its list as
// a card is); with a cube selected, Shows and Hides under it. A press does what the row did: selects it, or picking, picks it
const kTris = n => (n < 1000 ? String(n) : n < 9950 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : n < 999500 ? Math.round(n / 1000) + 'k' : (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M');
function itemCard(it, C) {
  const r = it.rec, { P, GP, selCube } = C;
  const pkOf = id => (P ? (P.rec.show.includes(id) ? 'show' : P.rec.hide.includes(id) ? 'hide' : '') : '');
  const inP = it.kind !== 'c' ? pkOf(it.id) : '', inG = !!GP && it.kind !== 'x' && groupOf(it.id) === GP;
  const ticks = id => (selCube && id !== selCube.id ? [['show', selCube.rec.show.includes(id)], ['hide', selCube.rec.hide.includes(id)]] : null);
  const card = { id: 'sel:' + it.id, item: true, label: (inP || inG ? '✓ ' : '') + r.name, title: tagName(r) + ' · ' + KIND_NAME[it.kind], act: GP ? 'gtog' : P && it.kind !== 'c' ? 'link' : 'sel', v: it.id,
    on: it.id === STU.sel || !!inP || inG, sel: it.id === STU.sel, pk: inP || (inG ? 'in' : ''), lock: !!r.locked, moves: !!(r.motion || r.path || r.behaviour), ticks: it.kind !== 'c' ? ticks(it.id) : null };
  // (the faint line: what moves it, as the rows said before the cards, then whether it is hidden for you)
  const moving = [r.motion && MOTION[r.motion.kind] ? MOTION[r.motion.kind].does : '', recording(it) ? 'recording' : r.path ? 'recorded path' : '', r.behaviour ? BEH_DOES[r.behaviour.kind] || '' : ''];
  const state = moving.concat((it.kind === 's' ? it.heard : it.shown) || it.kind === 'c' || it.kind === 'x' ? '' : 'hidden for you');
  if (it.kind === 'o') {
    const E = it.E, info = E && E.info, f = STU.fileMap.get(r.file), g = C.stands(r.file);
    card.pic = g ? [g, r.file] : [r.file]; card.kind = extOf(r.file).toUpperCase();
    if (info) { const sz = placedBox(E, r.q, r.s).getSize(new THREE.Vector3()); card.sub = metres(Math.max(sz.x, sz.y, sz.z)) + ` · ${kTris(info.tris)} triangles`; }
    else card.sub = !E || !f || E.state === 'missing' ? 'Its file is not in the scene' : E.state === 'failed' ? 'Could not be read' : E.state === 'loading' ? `Loading: ${Math.round(E.p * 100)} %` : E.state === 'parsing' ? 'Reading the file...' : modelWords(g ? STU.fileMap.get(g) || f : f);
    // (its file's name where its name does not say it)
    state.unshift(r.name.toLowerCase().startsWith(stem(r.file).toLowerCase()) ? '' : baseName(r.file));
    // its cut-outs as tags: a press selects one (picking for a cube, puts it on the list); a cube selected, their Shows and Hides
    const xs = cutsOn(it.id);
    if (xs.length && r.cutsLocked) card.tags = [{ id: 'cutl:' + it.id, label: `🔒 ✂ ${xs.length} cut-out${xs.length > 1 ? 's' : ''} locked`, title: 'Its cut-outs are locked: unlock them on its card', act: 'sel', v: it.id, on: false, sel: false, pk: '', ticks: null }];
    else if (xs.length) card.tags = xs.map(x => { const k = pkOf(x.id); return { id: 'sel:' + x.id, label: (k ? '✓ ' : '') + '✂ ' + tagName(x.rec), title: 'Cut-out: ' + itemSub(x), act: GP ? 'gtog' : P ? 'link' : 'sel', v: x.id, on: x.id === STU.sel || !!k, sel: x.id === STU.sel, pk: k, ticks: ticks(x.id) }; });
  } else if (it.kind === 'p') { card.tile = { k: r.shape, col: r.colour, hide: r.look === 'hide' }; card.sub = SHAPE_WORD[r.shape] + (r.look === 'hide' ? ' · hides things' : ''); }
  else if (it.kind === 'e') { const n = followersOf(it.id).length; card.tile = { k: 'empty', col: it.look.col }; card.sub = 'Empty' + (n ? ` · ${n} sound${n > 1 ? 's' : ''}` : ''); }
  else if (it.kind === 's') { card.tile = { k: 'sound', col: it.look.col }; card.sub = 'Sound · ' + (r.on ? 'follows ' + followWords(it) : `${Math.round(r.vol * 100)} %`); state.unshift(baseName(r.file)); }
  else if (it.kind === 'c') { card.tile = { k: 'trigger', col: it.look.col }; card.sub = `Cube · shows ${r.show.length}, hides ${r.hide.length}` + (r.tex ? `, textures ${r.tex.length}` : ''); state.push(r.mode === 'stay' ? 'stays once entered' : '', it.act ? 'active for you' : ''); }
  else { card.tile = { k: 'cut', col: it.look.col }; card.sub = 'Cut-out · its object is not here'; state.push(r.size.map(metres).join(' × ')); }
  card.sub2 = state.filter(Boolean).join(' · ');
  return card;
}
function itemBlocks(it, B, ed) {
  // (locked in place: what moves, turns, sizes or deletes it is greyed, mv and dl; e6d_shapes.js)
  // (recording a path here: its size steps off, rs; e6f_path.js)
  const r = it.rec, dis = !ed, mv = dis || !!lockWhy(it), dl = dis || !!lockWhy(it, true), rs = mv || recording(it);
  if (it.kind === 'g') { groupBlocks(it, B, dis, ed); return; }
  if (it.kind === 'o') {
    const E = it.E, info = E && E.info, f = STU.fileMap.get(r.file);
    B.push({ h: r.name, sub: 'Object' + (it.shown ? '' : ' · hidden for you now') });
    const st = !E ? 'Waiting for the scene\'s files.' : E.state === 'loading' ? `Loading: ${Math.round(E.p * 100)} %.` : E.state === 'parsing' ? 'Reading the file...' : E.state === 'failed' ? E.err : E.state === 'idle' && !f ? 'Its file is not in the scene\'s folder.' : E.state === 'missing' ? 'Its file is not in the scene\'s folder any more.' : '';
    if (st) B.push({ p: st, c: E && E.state === 'failed' ? 'red' : 'muted' });
    const kv = [['File', r.file + (f ? ' · ' + mb(f.bytes) : '')]];
    if (info) {
      const b = placedBox(E, r.q, r.s), sz = b.getSize(new THREE.Vector3());
      // (the scale it started at, and why: what the file says of its units and up axis, and what was made of it)
      const gw = guessWords(E.guess), g0 = r.s === E.guess.s;
      kv.push(['Size', `${metres(sz.x)} × ${metres(sz.y)} × ${metres(sz.z)} (x, height, z)`], ['Scale', String(r.s) + (gw ? (g0 ? ` (${gw})` : ` (placed first at ${E.guess.s}: ${gw})`) : '')],
        ['Triangles', fmt(info.tris)], ['Textures', info.textures.length ? info.textures.map(t => `${t.name} ${t.w} × ${t.h}${t.to ? ` (drawn at ${fmt(t.to)})` : ''}`).join('; ') : 'none'],
        ['Animations', info.clips.length ? info.clips.map(c => `${c[0]} (${c[1].toFixed(1)} s)`).join('; ') : 'none']);
    }
    B.push({ kv });
    if (E) texBlocks(it, E, B);
    if (info) {
      if (info.solid) B.push({ p: 'Its material says it is fully see-through (opacity 0, a habit of 3ds Max\'s exports): drawn solid.', c: 'faint' });
      if (!info.normals) B.push({ p: 'It has no normals (as a scan\'s mesh often has none): as scanned it shows its own colours; lit, its faces are shaded flat.', c: 'faint' });
      for (const t of info.textures) if (t.to) B.push({ p: `${t.name} is ${fmt(Math.max(t.w, t.h))} px: drawn at ${fmt(t.to)} px to spare the headset's memory.`, c: 'faint' });
      if (info.tris > 300000) B.push({ p: `More than 300,000 triangles: heavy for a Quest.`, c: 'amber' });
    }
    // GLB first: a GLB of this file in the scene (switch to it), or Convert to GLB (pages; a headset says where)
    const g = extOf(r.file) !== 'glb' ? glbFor().get(r.file) : '';
    if (g) B.push({ p: `A converted GLB is in the scene (${g}): switch to it.`, c: 'amber' }, { row: [{ id: 'switch', label: 'Switch to the GLB', act: 'switch', v: r.file, primary: true, dis }] });
    else if (MODEL_EXT.includes(extOf(r.file)) && extOf(r.file) !== 'glb') {
      if (XR.on) B.push({ p: 'Convert on a laptop: as a GLB it loads faster and sits right without guessing (Convert to GLB on this card, on a page).', c: 'faint' });
      else B.push({ page: true, row: [{ id: 'convert', label: CV.busy === r.file ? 'Converting...' : 'Convert to GLB', act: 'convert', v: r.file, dis: dis || !!CV.busy }] },
        { page: true, p: `As a GLB it loads faster and sits right without guessing (textures at most ${fmt(maxTexNow())} px). ` + (canUpload() ? 'It goes into models/, and every object placed from this file switches to it where it stands.' : 'It is downloaded: put it in the scene\'s models/ folder.'), c: 'faint' });
    }
    if (CV.note && !XR.on && (CV.busy === r.file || CV.item === it.id || CV.note.includes(baseName(r.file)))) B.push({ page: true, p: CV.note, c: CV.noteC });
    B.push({ label: 'Light', row: [{ id: 'light:lit', label: 'Lit', act: 'i:light', v: 'lit', on: r.light === 'lit', dis }, { id: 'light:scan', label: 'As scanned', act: 'i:light', v: 'scan', on: r.light === 'scan', dis }] });
    // its faces (this object's own: another of the same file keeps its own)
    B.push({ label: 'Faces', row: [['file', 'As in the file'], ['both', 'Both sides'], ['inside', 'Inside out']].map(([v, n]) => ({ id: 'faces:' + v, label: n, act: 'i:faces', v, on: (r.faces || 'file') === v, dis })) },
      { p: 'Inside out: for a model whose faces point the wrong way, or to see a room from inside. Both sides: thin walls and leaves seen from behind too.', c: 'faint' });
    tintBlocks([it], B, dis);   // (its tint and brightness: this object's own)
    if (info && info.clips.length) {
      B.push({ label: 'Animation', row: [{ id: 'clip', label: (r.clip || 'none') + (info.clips.length > 1 ? ' ▸' : ''), act: 'i:clip', dis: dis || info.clips.length < 2 },
        { id: 'anim:loop', label: 'Loop', act: 'i:anim', v: 'loop', on: r.anim === 'loop', dis }, { id: 'anim:once', label: 'Once', act: 'i:anim', v: 'once', on: r.anim === 'once', dis }, { id: 'anim:off', label: 'Off', act: 'i:anim', v: 'off', on: r.anim === 'off', dis }] },
      { row: [{ id: 'start:always', label: 'Always', act: 'i:start', v: 'always', on: r.start === 'always', dis }, { id: 'start:shown', label: 'When shown', act: 'i:start', v: 'shown', on: r.start === 'shown', dis }] });
    }
    B.push({ label: 'Place', row: [{ id: 'turn', label: 'Turn 90°', act: 'i:turn', dis: mv }, { id: 'stand', label: 'Stand up', act: 'i:stand', dis: mv || !info }, { id: 'floor', label: 'On the floor', act: 'i:floor', dis: mv || !info }] },
      { label: 'Size', row: [0.5, 0.9, 1.1, 2].map(k => ({ id: 'size:' + k, label: '×' + k, act: 'i:size', v: k, dis: rs })) });
    ftBlocks(it, B);   // (Fewer triangles and Change texture: e7d_lite.js, page and headset; under its place and size,
    ctBlocks(it, B);   // which a headset's card keeps in sight)
    // its cut-outs (boxes that hide the part of the model inside them), and a new one
    const cuts = cutsOn(it.id), cfull = cuts.length >= CUT_MAX, cl = !!r.cutsLocked;
    B.push({ label: `Cut-outs (${cuts.length})`, row: [{ id: 'cut', label: 'Cut out a part', act: 'i:cut', dis: dis || !canCut(it) }]
      .concat(cuts.length || cl ? [{ id: 'cutslock', label: cl ? '🔒 Cut-outs locked' : 'Lock cut-outs', act: 'i:cutslock', on: cl, dis }] : []) });
    if (it.cutNote) B.push({ p: it.cutNote, c: 'amber' });
    if (cl) B.push({ p: 'Its cut-outs are locked: they cut as before, but their boxes are hidden and they cannot be moved, sized or deleted (for everyone, and saved). Press again to unlock and show them.', c: 'amber' });
    else if (cuts.length) B.push({ list: cuts.map(x => ({ id: 'sel:' + x.id, label: '✂ ' + x.rec.name, sub: itemSub(x), act: 'sel', v: x.id, col: x.look.col })) });
    B.push({ p: cfull ? `${CUT_MAX} cut-outs on ${r.name}: the most one model takes.` : 'A cut-out is a box that hides the part of the model inside it (a door in a wall), for everyone; the model\'s file is not changed.', c: cfull ? 'amber' : 'faint' });
    behaveBlocks(it, B, dis);   // (a behaviour: what it does when people come close, e6g_behave.js)
    motionBlocks(it, B, dis);   // (a motion drawn over where it stands: e6e_motion.js)
    pathBlocks(it, B, dis, mv);   // (a recorded path, played from where it stands: e6f_path.js)
  } else if (it.kind === 'x') {
    const ob = cutObj(it), picking = STU.cutTo === it.id, objs = [...STU.items.values()].filter(o => o.kind === 'o'), pv = STU.whole.has(it.id) ? 'whole' : STU.cutF.has(it.id) ? 'cut' : 'seen';
    B.push({ h: r.name, sub: 'Cut-out' + (it.shown ? '' : ' · hidden for you now') },
      { kv: [['Cuts', ob ? ob.rec.name : 'an object not in the scene'], ['Size', r.size.map(metres).join(' × ') + ' (x, height, z)']] },
      { p: `It hides whatever of ${ob ? ob.rec.name : 'its object'} lies inside the box, for everyone here; the model's file is not changed. Not editing, only the hole shows.`, c: 'faint' });
    if (!ob) B.push({ p: 'The object it cuts is not in the scene: it cuts nothing until that object is back.', c: 'amber' });
    else if (!ob.model) B.push({ p: `${ob.rec.name}'s model is not here yet: it cuts once it is.`, c: 'faint' });
    if (it.over) B.push({ p: `${ob.rec.name} has more than ${CUT_MAX} cut-outs (from the room or a layout): the ${CUT_MAX} with the lowest ids cut, this one does not.`, c: 'amber' });
    if (!it.shown) B.push({ p: 'A trigger cube hides it from you now: the model is whole until a cube shows it' + (pv === 'cut' ? ' (Preview: Cut shows the hole here while you edit).' : ' (Preview: Cut shows the hole while you edit).'), c: 'muted' });
    B.push({ label: 'Cuts', row: [{ id: 'cutto', label: picking ? 'Cancel' : 'Move onto another object...', act: 'i:cutPick', on: picking, dis: mv || !objs.some(o => o.id !== r.on) }] });
    if (picking) {
      B.push({ p: (XR.on ? 'Point at an object and pull the trigger' : 'Click an object, or pick it here') + ': the box goes onto it, staying where it is.', c: 'amber' },
        { list: objs.map(o => { const n = cutsOn(o.id).length; return { id: 'cuton:' + o.id, label: o.rec.name, sub: baseName(o.rec.file) + (n >= CUT_MAX && o.id !== r.on ? ` · ${CUT_MAX} cut-outs: full` : ''), act: 'i:cutOn', v: o.id, on: o.id === r.on, dis: dis || o.id === r.on || n >= CUT_MAX }; }) });
    }
    B.push({ label: 'Size (5 cm a press)', row: ['x', 'height', 'z'].flatMap((n, i) => [{ id: `cgrow:${i}:-`, label: n + ' −', act: 'i:cgrow', v: i + ':-0.05', dis: mv }, { id: `cgrow:${i}:+`, label: n + ' +', act: 'i:cgrow', v: i + ':0.05', dis: mv }]) },
      { label: 'Size, every side', row: [0.5, 0.9, 1.1, 2].map(k => ({ id: 'csize:' + k, label: '×' + k, act: 'i:csize', v: k, dis: mv })) },
      { label: 'Place', row: [{ id: 'turn', label: 'Turn 90°', act: 'i:turn', dis: mv }] },
      { label: 'Preview (this device only, while editing)', row: [{ id: 'preview:seen', label: 'As seen', act: 'i:preview', v: 'seen', on: pv === 'seen', dis }, { id: 'preview:cut', label: 'Cut', act: 'i:preview', v: 'cut', on: pv === 'cut', dis }, { id: 'preview:whole', label: 'Whole', act: 'i:preview', v: 'whole', on: pv === 'whole', dis }] });
  } else if (it.kind === 'c') {
    B.push({ h: r.name, sub: 'Trigger cube' + (it.act ? ' · active for you' : '') }, { kv: [['Size', r.size.map(metres).join(' × ') + ' (x, height, z)']] });
    // what it shows and hides, each a button (it flashes in the scene), its card, and ✕ (off the list) (the owner, 5 November 2026)
    for (const [l, word] of [['show', 'Shows'], ['hide', 'Hides']]) {
      if (!r[l].length) { B.push({ kv: [[word, 'nothing']] }); continue; }
      r[l].forEach((id, k) => B.push({ label: k ? '' : `${word} (${r[l].length})`, row: [
        { id: `flash:${l}:${id}`, label: (l === 'show' ? '✓ ' : '✕ ') + nameOf(id), act: 'i:flash', v: id, col: l === 'hide' ? 'red' : undefined },
        { id: `open:${l}:${id}`, label: 'Its card', act: 'i:open', v: id, dis: !STU.items.has(id) },
        { id: `unlist:${l}:${id}`, label: '✕', act: 'i:unlist', v: l + ':' + id, dis }] }));
    }
    B.push({ label: 'Size (10 cm a press)', row: ['x', 'height', 'z'].flatMap((n, i) => [{ id: `grow:${i}:-`, label: n + ' −', act: 'i:grow', v: i + ':-0.1', dis: mv }, { id: `grow:${i}:+`, label: n + ' +', act: 'i:grow', v: i + ':0.1', dis: mv }]) },
      { label: 'Active', row: [{ id: 'mode:while', label: 'While inside', act: 'i:mode', v: 'while', on: r.mode === 'while', dis }, { id: 'mode:stay', label: 'Stays once entered', act: 'i:mode', v: 'stay', on: r.mode === 'stay', dis }] },
      { label: `Shows ${r.show.length} · hides ${r.hide.length}`, row: [{ id: 'pick:show', label: STU.pick && STU.pick.id === it.id && STU.pick.list === 'show' ? 'Done' : 'Pick what it shows', act: 'i:pickFor', v: 'show', on: !!(STU.pick && STU.pick.id === it.id && STU.pick.list === 'show'), dis },
        { id: 'pick:hide', label: STU.pick && STU.pick.id === it.id && STU.pick.list === 'hide' ? 'Done' : 'Pick what it hides', act: 'i:pickFor', v: 'hide', on: !!(STU.pick && STU.pick.id === it.id && STU.pick.list === 'hide'), dis }] });
    if (STU.pick && STU.pick.id === it.id) B.push({ p: XR.on ? 'Point at objects and sounds and pull the trigger to add or remove them; Done when finished.' : 'Click objects and sounds (or their names under Items) to add or remove them; Done when finished.', c: 'amber' });
    texCubeBlocks(it, B, dis);   // (the pictures it puts on objects while you are in it: e6i_tex.js)
    B.push({ p: 'Lines from the cube: green to what it shows, red to what it hides, amber to what it changes the pictures of.', c: 'faint' });
  } else if (it.kind === 'p') {
    // a shape (e6d_shapes.js): its kind, look and colour, its size per side or every side, its place
    const hides = r.look === 'hide';
    B.push({ h: r.name, sub: 'Shape' + (it.shown ? '' : ' · hidden for you now') }, { kv: [['Shape', SHAPE_WORD[r.shape]], ['Size', r.size.map(metres).join(' × ') + ' (x, height, z)'], ['Look', hides ? 'hides what is behind it' : 'in its colour']] },
      { label: 'Shape', row: SHAPE_KINDS.map(k => ({ id: 'pshape:' + k, label: SHAPE_WORD[k], act: 'i:shape', v: k, on: r.shape === k, dis })) },
      { label: 'Look', row: [{ id: 'look:colour', label: 'Colour', act: 'i:look', v: 'colour', on: !hides, dis }, { id: 'look:hide', label: 'Hides things', act: 'i:look', v: 'hide', on: hides, dis }] },
      { p: hides ? 'Invisible: it hides the scene behind it (in AR your room shows through it; in VR the floor and sky). Seen only while editing, as a see-through fill.' : 'Drawn in its colour, lit as the objects are.', c: 'faint' },
      { label: 'Colour' + (hides ? ' (seen only while editing)' : ''), row: SHAPE_COLS.map(([c, n]) => ({ id: 'colour:' + c, label: n, act: 'i:colour', v: c, on: r.colour === c, sw: c, dis })) },
      { label: 'Size (10 cm a press)', row: ['x', 'height', 'z'].flatMap((n, i) => [{ id: `pgrow:${i}:-`, label: n + ' −', act: 'i:pgrow', v: i + ':-0.1', dis: rs }, { id: `pgrow:${i}:+`, label: n + ' +', act: 'i:pgrow', v: i + ':0.1', dis: rs }]) },
      { label: 'Size, every side', row: [0.5, 0.9, 1.1, 2].map(k => ({ id: 'psize:' + k, label: '×' + k, act: 'i:psize', v: k, dis: rs })) },
      { label: 'Place', row: [{ id: 'turn', label: 'Turn 90°', act: 'i:turn', dis: mv }, { id: 'floor', label: 'On the floor', act: 'i:floor', dis: mv }] });
    if (r.shape === 'plane') B.push({ p: 'A plane stands upright: its z size is not used.', c: 'faint' });
    behaveBlocks(it, B, dis);
    motionBlocks(it, B, dis);
    pathBlocks(it, B, dis, mv);
  } else if (it.kind === 'e') {
    // an empty (e6d_shapes.js): where it is, the sounds that follow it, its place
    const fs = followersOf(it.id);
    B.push({ h: r.name, sub: 'Empty' + (it.shown ? '' : ' · hidden for you now') }, { kv: [['Place', r.p.map(v => v.toFixed(2)).join(', ') + ' (x, height, z, m)'], ['Followed by', fs.length ? fs.map(f => f.rec.name).join(', ') : 'nothing yet']] },
      { p: 'A point seen only while editing: a sound can follow it (on the sound\'s card: Follow an object..., then point at it), a cube can show or hide it (and so the sounds that follow it), and it moves and groups as anything else.', c: 'faint' });
    if (fs.length) B.push({ list: fs.map(f => ({ id: 'sel:' + f.id, label: f.rec.name, sub: 'sound · follows it', act: 'sel', v: f.id, col: f.look.col })) });
    B.push({ label: 'Place', row: [{ id: 'turn', label: 'Turn 90°', act: 'i:turn', dis: mv }] });
    behaveBlocks(it, B, dis);
    motionBlocks(it, B, dis);   // (the sounds that follow it move with it)
    pathBlocks(it, B, dis, mv);
  } else {
    const F = it.F;
    B.push({ h: r.name, sub: 'Sound' + (it.heard ? '' : ' · hidden for you now') }, { kv: [['File', r.file + (STU.fileMap.get(r.file) ? ' · ' + mb(STU.fileMap.get(r.file).bytes) : '')], ['Volume', Math.round(r.vol * 100) + ' %'], ['Full volume within', metres(r.r)], ['Plays', (r.loop ? 'in a loop, ' : 'once, ') + (r.start === 'always' ? 'always' : 'when a cube shows it')],
      ['Follows', r.on ? followWords(it) + (r.o ? `, ${cmOrM(Math.hypot(...r.o))} from it` : ', on it') : 'nothing']] });
    followBlocks(it, B, dis);
    if (F && (F.state === 'failed' || F.state === 'over')) B.push({ p: F.err, c: 'amber' });
    else if (F && F.stream) B.push({ p: `Streamed (${Math.floor(F.dur / 60)} min ${Math.round(F.dur % 60)} s: longer than 20 s), so it is not held in memory.`, c: 'faint' });
    else if (!(HOST.audio && HOST.audio.fx && HOST.audio.fx())) B.push({ p: 'No sound yet: tap anywhere, or turn on the Sound button.', c: 'faint' });
    else if (HOST.audio.muted) B.push({ p: 'The Sound button is off on this device: nothing plays.', c: 'faint' });
    B.push({ p: 'Mono files place best: a stereo one is played from its point, mixed (Upload makes sounds mono).', c: 'faint' });
    B.push({ label: 'Volume', row: [{ id: 'vol:-', label: 'Quieter', act: 'i:vol', v: -1, dis }, { id: 'vol:+', label: 'Louder', act: 'i:vol', v: 1, dis }] },
      { label: 'Full volume within', row: [{ id: 'reach:-', label: 'Nearer', act: 'i:reach', v: -1, dis }, { id: 'reach:+', label: 'Further', act: 'i:reach', v: 1, dis }] },
      { label: 'Plays', row: [{ id: 'loop:on', label: 'Loop', act: 'i:loop', v: 'on', on: r.loop, dis }, { id: 'loop:off', label: 'Once', act: 'i:loop', v: 'off', on: !r.loop, dis },
        { id: 'start:always', label: 'Always', act: 'i:start', v: 'always', on: r.start === 'always', dis }, { id: 'start:shown', label: 'When shown', act: 'i:start', v: 'shown', on: r.start === 'shown', dis }] },
      { p: SOUND_NOTE, c: 'faint' });
    pathBlocks(it, B, dis, mv);   // (a recorded path: a sound may move along one too)
  }
  // (a cut-out's copy goes on its object: refused once that object has 16, or the scene 100)
  const full = it.kind === 'x' && !canCut(cutObj(it));
  if (full && cutObj(it) && !dis) B.push({ p: cutsOn(r.on).length >= CUT_MAX ? `${CUT_MAX} cut-outs on ${cutObj(it).rec.name}: the most one model takes.` : `The scene has ${LIMITS.x} cut-outs: the most it can hold.`, c: 'amber' });
  // a group: Make a group... (this item, then pointing at the others), and, in one, which (at the card's top)
  if (GROUP_KINDS.includes(it.kind)) {
    const grp = groupOf(it.id);
    B.push({ label: 'Group', row: [{ id: 'mkgroup', label: grp ? 'Make a new group...' : 'Make a group...', act: 'i:mkgroup', dis: dis || !canAdd('g') }] });
    if (grp) B.splice(1, 0, { p: `In group ${grp.rec.name}: it moves with it. Selected on its own, it moves alone.`, c: 'muted' }, { row: [{ id: 'selgroup', label: 'Select the group', act: 'sel', v: grp.id }] });
    if (!canAdd('g') && !dis && countOf('g') >= LIMITS.g) B.push({ p: `The scene has ${LIMITS.g} groups: the most it can hold.`, c: 'amber' });
  }
  holdBlocks(it, B, mv);
  lockBlocks(it, B, dis);   // (Lock in place: e6d_shapes.js)
  B.push({ row: [{ id: 'dup', label: 'Duplicate', act: 'i:dup', dis: dis || full }, { id: 'del', label: 'Delete', act: 'i:del', dis: dl, col: 'red' }] });
  if (!XR.on && ed) B.push({ label: 'Arrows (W, E, R)', page: true, row: [['translate', 'Move'], ['rotate', 'Turn'], ['scale', 'Size']].map(([m, n]) => ({ id: 'tc:' + m, label: n, act: 'tc', v: m, on: X.tcMode === m, dis: mv || (it.kind === 's' && m !== 'translate') || (it.kind === 'e' && m === 'scale') || (m === 'scale' && recording(it)) })) });
  B.splice(1, 0, ...lockTop(it));   // (what holds it in place, at the card's top)
}
// Hold it (a headset's card only): the next grip of either hand carries the selected item from where it stands, wherever
// it points (holdHover in e8_xr.js); pressed again, not
function holdBlocks(it, B, dis) {
  const on = XR.hold === it.id;
  B.push({ xr: true, label: 'Carry it', row: [{ id: 'hold', label: on ? 'Now press a grip (again: cancel)' : 'Hold it', act: 'i:hold', on, dis }] },
    { xr: true, p: on ? 'The next grip of either hand carries it from where it stands, wherever you point.' : 'Hold it: then a grip of either hand carries it from where it stands, wherever you point (a room scan you stand in, or something too far to point at).', c: on ? 'amber' : 'faint' },
    // (the sticks while it is carried: holdSticks in e8_xr.js)
    { xr: true, p: 'Carried, the sticks steer it: ' + (it.kind === 's' ? 'the left stick up or down sizes its reach (full volume within); the right stick up pushes it away, down pulls it in.'
      : it.kind === 'e' ? 'left or right on either stick turns it; the right stick up pushes it away, down pulls it in.'
      : 'the left stick up makes it larger and down smaller, left or right turns it; the right stick up pushes it away and down pulls it in, left or right turns it too.'), c: 'faint' });
}
const nameOf = id => { const it = STU.items.get(id); return it ? it.rec.name : '?'; };
// ---- a group's card (tools/studio/SPEC.md, "Groups"): its members (each selects it on its own; picking, puts it out), Add
// or remove items... (a pick mode), its place and size (about its pivot, the middle of its members on the floor),
// Duplicate, Ungroup and Delete (every member)
function groupBlocks(g, B, dis, ed) {
  const mv = dis || !!lockWhy(g), dl = dis || !!lockWhy(g, true), ms = members(g), picking = !!(STU.gpick && STU.gpick.id === g.id), b = atPlaced(groupMeasured(g), () => groupBox(g, new THREE.Box3())), sz = b.isEmpty() ? null : b.getSize(new THREE.Vector3());
  const n = k => ms.filter(m => m.kind === k).length, parts = [['o', 'object'], ['s', 'sound'], ['c', 'cube']].filter(([k]) => n(k)).map(([k, w]) => `${n(k)} ${w}${n(k) > 1 ? 's' : ''}`);
  B.push({ h: g.rec.name, sub: 'Group' }, { kv: [['Members', ms.length ? `${ms.length}: ${parts.join(', ')}` : 'none here']].concat(sz ? [['Size', `${metres(sz.x)} × ${metres(sz.y)} × ${metres(sz.z)} (x, height, z)`]] : []) },
    { p: 'Its members move, turn and size together, about the middle of the group on the floor. A click on a member selects the group; a second click on it selects that member alone.', c: 'faint' });
  B.push({ label: `Members (${ms.length})`, row: [{ id: 'gpick', label: picking ? 'Done' : 'Add or remove items...', act: 'i:gpick', on: picking, primary: picking, dis }] });
  if (picking) B.push({ p: (XR.on ? 'Point at objects, sounds and cubes and pull the trigger' : 'Click objects, sounds and cubes, or their names under Items') + ' to put them in or take them out; Done when finished. One in another group moves into this one.', c: 'amber' });
  if (ms.length) B.push({ list: ms.map(m => ({ id: (picking ? 'gout:' : 'sel:') + m.id, label: (picking ? '✓ ' : '') + m.rec.name, sub: KIND_NAME[m.kind] + (picking ? ' · press to take it out' : ''), act: picking ? 'gtog' : 'sel', v: m.id, col: m.kind !== 'o' ? m.look.col : '' })) });
  if (ms.length < 2 && !picking) B.push({ p: 'A group needs two items or more: add some (Add or remove items...), or Ungroup.', c: 'amber' });
  B.push({ label: 'Place', row: [{ id: 'turn', label: 'Turn 90°', act: 'i:turn', dis: mv || !ms.length }, { id: 'floor', label: 'On the floor', act: 'i:floor', dis: mv || !ms.length }] },
    { label: 'Size', row: [0.5, 0.9, 1.1, 2].map(k => ({ id: 'size:' + k, label: '×' + k, act: 'i:size', v: k, dis: mv || !ms.length })) });
  if (g.note) B.push({ p: g.note, c: 'amber' });
  if (n('o')) tintBlocks(ms.filter(m => m.kind === 'o'), B, dis);   // (every object of the group at once)
  // (a group has no recorded path: e6f_path.js)
  B.push({ p: 'A group has no recorded path of its own: record its members one by one (each plays its own, from where it stands, and moves with the group).', c: 'faint' });
  const why = ed ? groupDupWhy(g) : '';
  if (why && ms.length) B.push({ p: why, c: 'amber' });
  holdBlocks(g, B, mv || !ms.length);
  lockBlocks(g, B, dis);
  B.push({ row: [{ id: 'dup', label: 'Duplicate', act: 'i:dup', dis: dis || !!why || !canAdd('g') }, { id: 'ungroup', label: 'Ungroup', act: 'i:ungroup', dis: dis || !!g.rec.locked }, { id: 'del', label: 'Delete', act: 'i:del', dis: dl, col: 'red' }] },
    { p: 'Ungroup: the group goes, its members stay. Delete: every member goes with it.', c: 'faint' });
  if (!XR.on && ed) B.push({ label: 'Arrows (W, E, R)', page: true, row: [['translate', 'Move'], ['rotate', 'Turn'], ['scale', 'Size']].map(([m, w]) => ({ id: 'tc:' + m, label: w, act: 'tc', v: m, on: X.tcMode === m, dis: mv })) });
  B.splice(1, 0, ...lockTop(g));
}
// ---- an object's tint and brightness (v125; a group's objects all at once): None or a swatch (the shapes' ten), on a page
// any colour too; Darker and Brighter (×0.8, ×1.25, 25 % to 400 %) and Reset; one Undo step each, never refused by a lock
// in place (it moves nothing), shared and saved
const brightPct = b => Math.round(b * 100) + ' %';
function tintBlocks(objs, B, dis) {
  const one = (f, d) => { const v = objs.map(o => o.rec[f] || d); return v.every(x => x === v[0]) ? v[0] : null; };
  const t = one('tint', ''), k = one('bright', 1), many = objs.length > 1;
  B.push({ label: 'Tint' + (many && t === null ? ' (they differ)' : ''), row: [{ id: 'tint:none', label: 'None', act: 'i:tint', v: '', on: t === '', dis }]
    .concat(SHAPE_COLS.map(([c, n]) => ({ id: 'tint:' + c, label: n, act: 'i:tint', v: c, on: t === c, sw: c, dis }))) },
  { page: true, colour: { id: 'stuTint', act: 'i:tint', value: t || '#ffffff', label: 'Any colour', dis } },
  { label: 'Brightness: ' + (k === null ? 'they differ' : brightPct(k)), row: [
    { id: 'bright:-', label: 'Darker', act: 'i:bright', v: 0.8, dis: dis || (k !== null && k <= 0.25) },
    { id: 'bright:+', label: 'Brighter', act: 'i:bright', v: 1.25, dis: dis || (k !== null && k >= 4) },
    { id: 'bright:reset', label: 'Reset', act: 'i:bright', v: 'reset', dis: dis || k === 1 }] },
  { p: (many ? 'Every object of the group: its' : 'Its') + ' colours times the tint, times the brightness (above 100 % its texture brightens too); ' + (many ? 'each object\'s own' : 'this object\'s own: another of the same file keeps its own') + ', for everyone and saved.', c: 'faint' });
}
// the model a new cut-out would go on: the one selected, or the one the selected cut-out cuts
const selModel = () => { const it = STU.items.get(STU.sel); return !it ? null : it.kind === 'o' ? it : it.kind === 'x' ? cutObj(it) : null; };
const cmOrM = d => (d < 1 ? Math.max(1, Math.round(d * 100)) + ' cm' : metres(d));
// ---- a sound's card: what it follows (tools/studio/SPEC.md, "Sounds that follow a model"): an object, picked by pointing
// at it (or from a list), then one of its bones (the short list where the model has them, then every bone; a model with
// no bones offers the parts its animation moves), Move onto it and Stop following; each keeps the sound where it is now
function followBlocks(it, B, dis) {
  const r = it.rec, ob = followOf(it), picking = STU.follow === it.id, objs = [...STU.items.values()].filter(x => FOLLOW_KINDS.includes(x.kind));
  B.push({ row: [
    { id: 'follow', label: picking ? 'Cancel' : r.on ? 'Follow another object...' : 'Follow an object...', act: 'i:followPick', on: picking, dis: dis || !objs.length },
    r.on ? { id: 'onto', label: 'Move onto it', act: 'i:onto', dis: dis || !ob || !!lockWhy(it) } : null,
    r.on ? { id: 'unfollow', label: 'Stop following', act: 'i:unfollow', dis } : null,
  ].filter(Boolean) });
  if (!objs.length && !r.on) B.push({ p: 'A sound can follow an object, a shape or an empty placed here (a voice at a figure\'s head, or in mid-air): place one first.', c: 'faint' });
  if (picking) {
    B.push({ p: (XR.on ? 'Point at an object, a shape or an empty and pull the trigger' : 'Click an object, a shape or an empty, or pick it here') + ': the sound follows it from where it is now.', c: 'amber' },
      { list: objs.map(o => ({ id: 'followon:' + o.id, label: o.rec.name, sub: o.kind === 'o' ? baseName(o.rec.file) : KIND_NAME[o.kind], act: 'i:follow', v: o.id, on: o.id === r.on, dis })) });
  }
  if (r.on && !ob) B.push({ p: 'The object it follows is not in the scene: it stands at its own place until the object is back.', c: 'amber' });
  if (!ob || ob.kind !== 'o') return;   // (a shape or an empty: where it is, no bones)
  const E = ob.E, Bn = bonesOf(E);
  if (!E || !E.root || !ob.model) { B.push({ p: `${ob.rec.name}'s bones show once its model is in.`, c: 'faint' }); return; }
  if (r.bone && !nodeOf(ob, r.bone)) B.push({ p: `${ob.rec.name} has no bone ${r.bone} here: the sound follows the whole model.`, c: 'amber' });
  if (!Bn.list.length) { B.push({ p: `${ob.rec.name} has no bones and no moving parts: the sound follows the whole model.`, c: 'faint' }); return; }
  const cur = r.bone ? boneKey(r.bone) : '', open = STU.bones === it.id, part = Bn.kind === 'part';
  B.push({ label: part ? 'Moving part' : 'Bone', row: [{ id: 'bone:', label: 'Whole model', act: 'i:bone', v: '', on: !r.bone, dis }]
    .concat(Bn.slots.map(([lab, n]) => ({ id: 'bone:' + lab, label: lab, act: 'i:bone', v: n, on: boneKey(n) === cur, dis })),
      { id: 'bones', label: (part ? 'Moving parts' : 'More bones') + (open ? ' ▾' : '...'), act: 'i:bones', on: open, dis }) });
  if (!open) return;
  // every bone by name: all of them on a page, a page of 8 at a time in a headset
  const all = Bn.list.map(n => ({ id: 'bonen:' + n, label: n, act: 'i:bone', v: n, on: boneKey(n) === cur, dis }));
  const per = 8, pages = Math.ceil(all.length / per), pg = Math.min(STU.bonePage, pages - 1);
  B.push({ page: true, list: all }, { xr: true, list: all.slice(pg * per, pg * per + per) });
  if (pages > 1) B.push({ xr: true, label: `${pg * per + 1} to ${Math.min(all.length, pg * per + per)} of ${all.length}`, row: [{ id: 'bonepg:-', label: '◂ Previous', act: 'i:bonePage', v: -1, dis: pg <= 0 }, { id: 'bonepg:+', label: 'Next ▸', act: 'i:bonePage', v: 1, dis: pg >= pages - 1 }] });
}
// ---- an object's textures (tools/studio/SPEC.md, "Textures: found, added, converted"): what is missing, each with
// pictures of the scene to use (the ladder's and the likeliest by name) or one from this computer; what the ladder found
// under another name or read from a TIFF, PSD or DDS; and Add a texture (a picture, a material, a slot). A press
// converts at once (texGo): the pictures are baked into the model's GLB, never stored in the layout. Pages only: a
// headset says to do it on a laptop
const SLOT_NAME = { map: 'Colour', normalMap: 'Normal', roughnessMap: 'Roughness', metalnessMap: 'Metalness', aoMap: 'Occlusion', emissiveMap: 'Glow', alphaMap: 'Opacity', orm: 'Packed (ORM)' };
const SLOTS_ADD = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'orm'];
const HOW_WORDS = { ext: f => `the same name as a ${CONV.IM.FMT[extOf(f)] || extOf(f).toUpperCase()}`, similar: () => 'a picture of a similar name', only: () => 'the only picture left over', chosen: () => 'chosen by hand', stem: () => 'its name matches the model\'s' };
const dirOf = p => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
const matLabel = m => m.name || 'material ' + (Number(m.key) + 1);
function texBlocks(it, E, B) {
  const can = canConvert(it.rec.file) && !OPT.visit, busy = !!CV.busy, pics = scenePictures(), dir = dirOf(E.path);
  let laptop = false;
  for (const m of E.missing) {
    const w = E.why && E.why[m];
    B.push({ p: `Missing texture ${m}: ` + (w ? w + '.' : 'put it in the scene\'s folder' + (can ? ', or pick a picture for it here.' : '.')), c: 'amber' });
    if (can) {
      const f = E.found.get(m), used = [...LIB.values()].filter(x => x !== E).flatMap(x => [...x.texPaths]), cands = CONV.texRank(m, pics, { dir, not: f ? [f.path] : [], used }, 3);
      B.push({ page: true, row: cands.map((q, i) => ({ id: 'texuse:' + m + ':' + q, label: 'Use ' + baseName(q), act: 'tex:use', v: JSON.stringify([it.id, m, q]), primary: i === 0, dis: busy }))
        .concat({ id: 'texfile:' + m, label: 'Choose a picture...', act: 'tex:choose', v: JSON.stringify([it.id, m]), dis: busy }) });
    } else laptop = true;
  }
  for (const [n, f] of E.found) if (HOW_WORDS[f.how]) B.push({ p: `Texture ${n}: using ${f.path}, ${HOW_WORDS[f.how](f.path)}.`, c: 'faint' });
  for (const d of E.decoded || []) B.push({ p: `Texture ${d.name}: read from its ${d.fmt} file in the page (a browser cannot show it itself).`, c: 'faint' });
  if (E.record) for (const x of E.record.tex || []) if (HOW_WORDS[x.how]) B.push({ p: `${x.name ? 'Texture ' + x.name : SLOT_NAME[x.slot] + ' picture'}: ${baseName(x.from)}, ${HOW_WORDS[x.how](x.from)} (in this GLB).`, c: 'faint' });
  // (the converter filled the gaps between its pictures' pieces: CONV.fillModel)
  if (E.record && E.record.fill) B.push({ p: `Textures: the gaps between the pieces of ${E.record.fill === 1 ? 'its picture are' : 'its ' + E.record.fill + ' pictures are'} filled with the colours round them (in this GLB), so it shows no black seams when made lighter.`, c: 'faint' });
  const uvs = (E.mats || []).filter(m => m.uv);
  if (E.info && (E.mats || []).length) {
    if (!can) laptop = laptop || !!uvs.length;
    else if (!uvs.length) B.push({ page: true, p: 'Textures: it has no texture coordinates (UVs), so a picture cannot be laid on it.', c: 'faint' });
    else {
      const A = X.texAdd && X.texAdd.id === it.id ? X.texAdd : null;
      if (!A) B.push({ page: true, label: 'Textures', row: [{ id: 'texadd', label: 'Add a texture...', act: 'tex:add', v: it.id, dis: busy }] });
      else if (!A.pic) {
        B.push({ page: true, label: 'Add a texture: pick a picture', row: CONV.texRank(stem(E.path), pics, { dir }, 12).map(q => ({ id: 'texpick:' + q, label: baseName(q), act: 'tex:pick', v: q }))
          .concat({ id: 'texpickfile', label: 'Choose a picture...', act: 'tex:pickfile' }, { id: 'texcancel', label: 'Cancel', act: 'tex:cancel' }) });
      } else {
        const mat = uvs[A.mat % uvs.length];
        B.push({ page: true, p: `Adding ${A.pic.name}` + (A.pic.why ? `: ${A.pic.why}.` : ''), c: A.pic.why ? 'red' : 'muted' },
          { page: true, label: 'On', row: [{ id: 'texmat', label: matLabel(mat) + (uvs.length > 1 ? ' ▸' : ''), act: 'tex:mat', dis: uvs.length < 2 }] },
          { page: true, label: 'As', row: SLOTS_ADD.map(k => ({ id: 'texslot:' + k, label: SLOT_NAME[k], act: 'tex:slot', v: k, on: A.slot === k })) });
        if (mat.slots.includes(A.slot)) B.push({ page: true, p: `${matLabel(mat)} has a ${SLOT_NAME[A.slot].toLowerCase()} picture already: this one takes its place.`, c: 'faint' });
        B.push({ page: true, row: [{ id: 'texgo', label: 'Add and convert', act: 'tex:go', primary: true, dis: busy || !!A.pic.why }, { id: 'texcancel', label: 'Cancel', act: 'tex:cancel' }] },
          { page: true, p: `It is converted to a GLB with the picture in it at once (textures at most ${fmt(maxTexNow())} px)` + (canUpload() ? ': into models/, and what is placed from it switches to it.' : ': downloaded, to put in the scene\'s models/ folder.'), c: 'faint' });
      }
    }
  }
  if (laptop && XR.on) B.push({ p: 'Add a texture on a laptop: this card there offers pictures for what is missing, or lays a new one on, and makes the model a GLB with them.' + (canLite(it) && ctMats(it).length ? ' Change texture (below) works here too.' : ''), c: 'faint' });
}
// a picture's mean colour, to tell a normal map that says nothing in its name (its bluish purple): the slot set again
async function texMean(A) {
  try {
    const u = A.pic.file ? URL.createObjectURL(A.pic.file) : fileUrl(A.pic.path, true);
    try {
      const img = await CONV.picture(u, { max: 128, ext: extOf(A.pic.name) });
      if (X.texAdd === A && A.slot === 'map' && !A.slotSet && CONV.slotOf(A.pic.name, CONV.meanOf(img)) === 'normalMap') A.slot = 'normalMap';
    } finally { if (A.pic.file) URL.revokeObjectURL(u); }
  } catch (e) { if (X.texAdd === A) A.pic.why = e.message; }
  dirty(true);
}
// a picture from this computer (the card's chooser, #stuTex): for a missing name, for Add a texture, or for an Upload row
function texFile(f) {
  const F = X.texFor;
  X.texFor = null;
  if (!F || !f) return;
  if (F.kind === 'up') { upGive(F.ri, [f], F.name); return; }
  if (F.kind === 'add') { if (X.texAdd && X.texAdd.id === F.id) { X.texAdd.pic = { file: f, name: f.name }; X.texAdd.slot = CONV.slotOf(f.name); X.texAdd.slotSet = false; texMean(X.texAdd); } return; }
  if (F.kind === 'ct') { if (CT.id === F.id) ctPick('', f); return; }   // (Change texture's picture from this computer)
  texGo(F.id, [{ name: F.name, mat: '', slot: '', from: '', file: f }]);
}
const chooseTex = F => { X.texFor = F; const i = $('#stuTex'); if (i) i.click(); };
const TEX_ACT = {
  'tex:use': v => { const [id, n, q] = JSON.parse(v); texGo(id, [{ name: n, mat: '', slot: '', from: q }]); },
  'tex:choose': v => { const [id, n] = JSON.parse(v); chooseTex({ kind: 'card', id, name: n }); },
  'tex:add': v => { X.texAdd = { id: v, pic: null, mat: 0, slot: 'map' }; },
  'tex:pick': v => { if (X.texAdd) { X.texAdd.pic = { path: v, name: baseName(v) }; X.texAdd.slot = CONV.slotOf(v); X.texAdd.slotSet = false; texMean(X.texAdd); } },
  'tex:pickfile': () => { if (X.texAdd) chooseTex({ kind: 'add', id: X.texAdd.id }); },
  'tex:mat': () => { if (X.texAdd) X.texAdd.mat++; },
  'tex:slot': v => { if (X.texAdd && SLOTS_ADD.includes(v)) { X.texAdd.slot = v; X.texAdd.slotSet = true; } },   // (chosen: its colour no longer changes it)
  'tex:go': () => {
    const A = X.texAdd, it = A && STU.items.get(A.id), uvs = it && it.E ? (it.E.mats || []).filter(m => m.uv) : [];
    if (!A || !A.pic || !uvs.length || CV.busy || !canConvert(it.rec.file)) return;   // (kept as chosen until it can go)
    X.texAdd = null;
    // the material by its key here, and by its name and its meshes' names for the original a GLB is made again from
    // (whose materials need not be the GLB's: one shared Phong material becomes one per mesh)
    const m = uvs[A.mat % uvs.length];
    texGo(A.id, [{ name: '', mat: m.key, mname: m.name, meshes: m.meshes || [], slot: A.slot, from: A.pic.path || '', file: A.pic.file }]);
  },
  'tex:cancel': () => { X.texAdd = null; },
};
// a pane's button or row pressed (page and headset)
function act(a, v) {
  if (a.startsWith('i:')) { itemAct(a.slice(2), v); return; }
  if (UP_ACT[a]) { if (!XR.on && !OPT.visit) UP_ACT[a](v); dirty(true); return; }
  if (LITE_ACT[a]) { if (!OPT.visit && editOn()) LITE_ACT[a](v); dirty(true); return; }   // (page and headset alike)
  if (TEX_ACT[a]) { if (!XR.on && !OPT.visit && editOn()) TEX_ACT[a](v); dirty(true); return; }
  if (PV_ACT[a]) { if (!XR.on && !OPT.visit && editOn()) PV_ACT[a](v); dirty(true); return; }   // (Make pictures: a page's)
  const lock = editLocked();
  ({
    scene: () => { if (!lock && v !== STU.scene) { openScene(v, 'pick'); sfxAct('whoosh', 'stage', 'centre', { dur: 0.8 }); } },
    again: () => findSource(),
    edit: () => setEdit(!STU.edit),
    save: () => saveLayout(),
    undo: () => undo(),
    load: () => loadSaved(),
    restore: () => draftRestore(),
    discard: () => draftDiscard(),
    seen: () => resetSeen(),
    download: () => downloadLayout(),
    upload: () => { const u = $('#stuUpload'); if (u && editOn()) u.click(); },
    add: () => addModel(glbFor().get(v) || v),
    look: () => { if (!XR.on && !OPT.visit) vwOpen({ kind: 'add', path: v }); },   // (an Add card's Look: the viewer, e7f_viewer.js)
    convert: () => { CV.item = STU.sel; convertFile(v); },
    convertAll: () => convertAll(),
    switch: () => { const g = glbFor().get(v); if (g) { const rec = glbRec(g); switchToGLB(v, g, rec || null); } },
    orig: () => { X.orig = !X.orig; },
    adds: () => addSound(v),
    cube: () => addCube(),
    shape: () => addShape(v),
    empty: () => addEmpty(),
    setting: () => setSetting(v),
    pause: () => pauseSet(!MPAUSE.on),
    cutbox: () => { const ob = selModel(); if (ob) itemAct('cut', null, ob.id); },
    newscene: () => sceneAsk(),
    scenemake: () => sceneMake(NS.name),
    from: () => { FROM.open = !FROM.open && canCopy(); const o = SRC.scenes.filter(s => s.name !== STU.scene); if (FROM.open && !FROM.scene && o.length === 1) fromScene(o[0].name); },
    fromScene: () => fromScene(v),
    fromFile: () => copyIn(v),
    fromOrig: () => { FROM.orig = !FROM.orig; },
    sel: () => select(v === STU.sel ? '' : v),
    link: () => { if (STU.pick) toggleLink(STU.pick.id, STU.pick.list, v); },
    tick: () => { const [l, id] = String(v).split(':'); if (l === 'show' || l === 'hide') toggleLink(STU.sel, l, id); },   // (the Items pane's Shows and Hides: the selected cube's lists)
    linkg: () => { const g = STU.items.get(v); if (STU.pick && g) toggleLinks(STU.pick.id, STU.pick.list, members(g).map(m => m.id)); },
    pickdone: () => { STU.pick = null; },
    gtog: () => { if (STU.gpick) groupToggle(STU.gpick.id, v); },
    gpickdone: () => { if (STU.gpick) gpickEnd(); },
    tc: () => tcSetMode(v),
    tab: () => pickTab(v),
  }[a] || (() => {}))();
  dirty(true);
}
// (a headset shows no Upload tab, and nor does a visitor's kiosk: &visit offers no editing and no uploads)
function pickTab(k) { if (!TABS.some(t => t[0] === k) || (k === 'upload' && (XR.on || OPT.visit))) return; X.tab = k; dirty(true); }
// the panes on the page: drawn again (at most about 7 times a second) when something they show changed
function dirty(now) { X.dirty = true; if (now === true) renderPanes(); }
function paneSig() { return [X.tab, liteSig(), XR.hold, PV.rev, PV.make && PV.make.i + PV.make.path + PV.make.stop, PV.note, NS.open, NS.making, NS.asking, NS.note, canMake(), FROM.open, FROM.scene, FROM.loading, !!FROM.files, FROM.busy, FROM.note, FROM.orig, canCopy(), UP.rev, UP.busy, UP.scene, CV.note, CV.busy, JSON.stringify(X.texAdd && [X.texAdd.id, X.texAdd.mat, X.texAdd.slot, X.texAdd.pic && X.texAdd.pic.name, X.texAdd.pic && X.texAdd.pic.why]), X.orig, SRC.upload, STU.files.length, STU.rev, STU.libRev, STU.sel, STU.edit, STU.listing, SRC.state, SRC.scenes.length, STU.saving, STU.savedAt, STU.loadAsk, !!STU.draft, UNDO.length, STU.pick && STU.pick.id + STU.pick.list, STU.txp && [STU.txp.id, STU.txp.step, STU.txp.on, STU.txp.mat, STU.txp.slot, STU.txp.page].join(), STU.badTex, STU.gpick && STU.gpick.id, STU.follow, STU.bones, STU.bonePage, STU.cutTo, [...STU.whole].join(), [...STU.cutF].join(), editLocked(), X.tcMode, STU.seen.size, STU.note, STU.saveNote, STU.upNote, recSig(), [...STU.items.values()].map(it => +it.shown + +it.act + +it.heard + +!!it.model + +!!it.cutting + +!!it.over + (it.cutNote || it.note ? 'n' : '')).join('')].join('|'); }
function buildExplore() {
  $('#explore').innerHTML = `<style>
    .stu-list { list-style: none; padding: 0; margin: 4px 0 14px; }
    .stu-list li { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; align-items: center; padding: 6px 8px; border-radius: 4px; cursor: pointer; border-left: 3px solid transparent; }
    .stu-list li:hover { background: var(--chip); }
    .stu-list li[aria-pressed="true"] { background: var(--chip); outline: 1px solid var(--line); }
    .stu-list li[aria-disabled="true"] { opacity: 0.45; cursor: default; }
    .stu-list li small { grid-column: 1; color: var(--muted); font-size: 12.5px; }
    .stu-list li > span:first-child { overflow-wrap: anywhere; min-width: 0; }
    .stu-warn { color: var(--amber); margin-left: 6px; }
    .stu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(calc((100% - 16px) / 3), max(104px, calc((100% - 32px) / 5))), 1fr)); gap: 8px; margin: 4px 0 14px; }
    .stu-card { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 5px 5px 6px; border-radius: 6px; border: 1px solid var(--line); background: var(--chip); color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
    .stu-card:hover { border-color: var(--cyan); }
    .stu-card[disabled] { opacity: 0.45; cursor: default; }
    .stu-card .pic { display: grid; place-items: center; aspect-ratio: 1 / 1; border-radius: 4px; overflow: hidden; background: #0b1322; margin-bottom: 3px; }
    .stu-card .pic img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .stu-card .pic b { color: var(--faint); font-size: 15px; letter-spacing: 0.08em; }
    .stu-card .nm { font-size: 13px; line-height: 1.25; overflow-wrap: anywhere; }
    .stu-card small { color: var(--muted); font-size: 11.5px; line-height: 1.25; }
    .stu-card small.f { color: var(--faint); }
    .stu-ic { padding: 0; cursor: default; gap: 0; }
    .stu-ic:hover { border-color: var(--line); }
    .stu-ic .cm { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 5px 5px 6px; border: 0; border-radius: 6px; background: none; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
    .stu-ic .cm:hover { background: rgba(149, 166, 189, 0.12); }
    .stu-ic.sel { border-color: var(--cyan); box-shadow: 0 0 0 2px var(--cyan); }
    .stu-ic.pk-show:not(.sel) { border-color: var(--green); box-shadow: 0 0 0 1px var(--green); }
    .stu-ic.pk-hide:not(.sel) { border-color: var(--red); box-shadow: 0 0 0 1px var(--red); }
    .stu-ic.pk-in:not(.sel) { border-color: var(--cyan); }
    .stu-card .pic { position: relative; }
    .stu-cw { position: relative; display: flex; min-width: 0; } .stu-cw > .stu-card { flex: 1; }
    .stu-look { position: absolute; left: 9px; top: 9px; font: inherit; font-size: 11.5px; line-height: 1; padding: 4px 7px; border-radius: 4px; border: 1px solid var(--line); background: rgba(4, 10, 20, 0.82); color: var(--ink); cursor: pointer; }
    .stu-look:hover, .stu-look:focus-visible { border-color: var(--cyan); color: var(--cyan); }
    .stu-card .mks { position: absolute; top: 4px; right: 4px; display: flex; gap: 3px; }
    .stu-card .mk { font-style: normal; font-size: 11px; line-height: 1; padding: 3px 5px; border-radius: 4px; background: rgba(4, 10, 20, 0.8); color: var(--ink); }
    .stu-card .mk.mv { color: var(--cyan); font-weight: 700; }
    .stu-ic .tg, .stu-ic .tks { display: flex; gap: 4px; padding: 0 5px 5px; min-width: 0; }
    .stu-ic .tg button, .stu-ic .tks button { font: inherit; font-size: 11.5px; line-height: 1.2; padding: 3px 6px; border-radius: 4px; border: 1px solid var(--line); background: rgba(149, 166, 189, 0.1); color: var(--ink); cursor: pointer; min-width: 0; }
    .stu-ic .tg { flex-wrap: wrap; }
    .stu-ic .tg .tag { flex: 1 1 100%; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .stu-ic .tks .tk { flex: 1; }
    .stu-ic .tg .tks { padding: 0; flex: 1 1 100%; } .stu-ic .tg .tks .tk { font-size: 11px; padding: 2px 4px; }
    .stu-ic .tg button[aria-pressed="true"], .stu-ic .tks button[aria-pressed="true"] { border-color: var(--cyan); color: var(--cyan); background: rgba(70, 217, 255, 0.14); }
    .stu-ic .tg .tag.sel { box-shadow: 0 0 0 1px var(--cyan); }
    .stu-ic .tg .tag.pk-show:not(.sel) { border-color: var(--green); color: var(--green); background: rgba(62, 224, 143, 0.14); }
    .stu-ic .tg .tag.pk-hide:not(.sel) { border-color: var(--red); color: var(--red); background: rgba(255, 90, 75, 0.14); }
    .stu-gh { display: flex; align-items: center; gap: 8px; width: 100%; margin: 6px 0 6px; padding: 7px 10px; border-radius: 6px; border: 1px solid var(--line); background: var(--chip); color: var(--ink); font: inherit; font-weight: 700; text-align: left; cursor: pointer; }
    .stu-gh:hover { border-color: var(--cyan); }
    .stu-gh[aria-pressed="true"] { border-color: var(--cyan); }
    .stu-gh.sel { box-shadow: 0 0 0 2px var(--cyan); }
    .stu-gh span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .stu-gh small { color: var(--muted); font-weight: 400; font-size: 12.5px; }
    .stu-gh .stu-sw { margin: 0; }
    .stu-sw { display: inline-block; width: 14px; height: 14px; border-radius: 3px; margin: 0 7px -2px 0; box-shadow: 0 0 0 1px var(--line); }
    .stu-code { font-family: ui-monospace, Menlo, monospace; font-size: 13px; background: var(--chip); padding: 6px 8px; border-radius: 4px; display: block; margin: 0 0 10px; overflow-x: auto; white-space: nowrap; }
    #explore .actions .btn[aria-pressed="true"] { border-color: var(--cyan); color: var(--cyan); }
    #explore .actions .btn.red { color: var(--red); }
    #explore .actions .btn.warn { border-color: var(--amber); color: var(--amber); }
    .stu-k { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); font-weight: 700; margin: 0 0 4px; }
    .pane p.stu-l { margin: 10px 0 2px; font-size: 13px; color: var(--muted); }
    .stu-drop { border: 2px dashed var(--line); border-radius: 8px; padding: 18px 12px 8px; text-align: center; margin: 8px 0 12px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .stu-drop.hot { border-color: var(--cyan); background: var(--chip); }
    .stu-drop.off { opacity: 0.5; }
    .stu-drop span { color: var(--muted); font-size: 13px; }
    .stu-in input { flex: 1; min-width: 0; font: inherit; padding: 6px 8px; border-radius: 4px; border: 1px solid var(--line); background: var(--chip); color: var(--ink); }
    .stu-plan { list-style: none; padding: 0; margin: 4px 0 12px; }
    .stu-plan li { display: grid; grid-template-columns: 56px 1fr; gap: 2px 8px; padding: 7px 8px; border-left: 3px solid var(--line); margin-bottom: 4px; background: var(--chip); border-radius: 4px; }
    .stu-plan li > small, .stu-plan li > .bar, .stu-plan li > a { grid-column: 2; }
    .stu-plan li .k { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); font-weight: 700; padding-top: 2px; }
    .stu-plan li .t { word-break: break-all; }
    .stu-plan li .t small, .stu-plan li small { color: var(--muted); font-size: 12.5px; }
    .stu-plan li small.n { color: var(--amber); }
    .stu-plan li small.x, .stu-plan li small.h { color: var(--muted); } .stu-plan li small.h { font-size: 12px; }
    .stu-plan li .tx { grid-column: 2; display: flex; flex-wrap: wrap; gap: 4px; margin: 2px 0 4px; }
    .stu-plan li .btn { font-size: 12.5px; padding: 2px 8px; }
    .stu-plan li small.m { color: var(--ink); }
    .stu-plan li.done { border-left-color: var(--green); } .stu-plan li.failed { border-left-color: var(--red); } .stu-plan li.failed small.m { color: var(--red); } .stu-plan li.working { border-left-color: var(--cyan); }
    .stu-plan .bar { height: 4px; background: var(--line); border-radius: 2px; overflow: hidden; margin: 3px 0; }
    .stu-plan .bar i { display: block; height: 100%; background: var(--cyan); }
    .stu-plan a.btn { justify-self: start; margin-top: 4px; font-size: 13px; padding: 4px 10px; text-decoration: none; }
    .stu-col { display: inline-flex; align-items: center; gap: 8px; margin: 2px 0 8px; font-size: 13px; color: var(--muted); cursor: pointer; }
    .stu-col input { width: 40px; height: 28px; padding: 0 2px; border: 1px solid var(--line); border-radius: 4px; background: var(--chip); cursor: pointer; }
    .stu-range { display: flex; align-items: center; gap: 10px; margin: 2px 0 8px; }
    .stu-range input { flex: 1; min-width: 80px; accent-color: var(--cyan); }
    .stu-range b { min-width: 48px; text-align: right; font-variant-numeric: tabular-nums; }
    .stu-plan li .stu-range { grid-column: 2; margin: 4px 0 2px; font-size: 13px; } .stu-plan li .stu-range label { color: var(--muted); }
    .stu-plan li img.stu-pv { grid-column: 2; max-width: 100%; border-radius: 4px; margin: 4px 0 2px; }
    .stu-plan li img.stu-pv.sm { width: 96px; height: 96px; }
    .pane p.amber { color: var(--amber); } .pane p.red { color: var(--red); } .pane p.faint { color: var(--faint); font-size: 13px; } .pane p.muted { color: var(--muted); } .pane p.green { color: var(--green); }
  </style>
    <div class="tabs" role="tablist">${TABS.filter(([k]) => k !== 'upload' || !OPT.visit).map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}
    <input type="file" id="stuUpload" accept=".json,application/json" hidden>
    <input type="file" id="stuTex" accept="image/*,.tga,.tif,.tiff,.psd,.psb,.dds" hidden>
    <input type="file" id="stuFiles" multiple hidden><input type="file" id="stuFolder" webkitdirectory multiple hidden>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  $('#explore').addEventListener('click', ev => {
    const t = ev.target.closest('[data-act]');
    if (!t || t.getAttribute('aria-disabled') === 'true' || t.disabled) return;
    act(t.dataset.act, t.dataset.n ? +t.dataset.v : t.dataset.v);
  });
  $('#explore').addEventListener('change', ev => {
    const t = ev.target;
    if (t.id === 'stuUpload') { const f = t.files && t.files[0]; if (f) f.text().then(uploadLayout).catch(() => {}); t.value = ''; return; }
    if (t.id === 'stuTex') { const f = t.files && t.files[0]; t.value = ''; texFile(f); return; }
    if (t.dataset && t.dataset.colour && !t.disabled) { t.blur(); act(t.dataset.colour, String(t.value).toLowerCase()); return; }   // (a colour field: the tint, once chosen)
  });
  $('#viewctl').innerHTML = `<div class="grp"><span>View</span><div class="seg" data-ctl="view" role="group" aria-label="View">${[['orbit', 'Orbit'], ['walk', 'Walk']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.view === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (b) setView(b.dataset.v); });
  uploadBind();
  liteBind();
  renderPanes();
}
function showTab(k) { pickTab(k); }
// an Items card on the page: a box holding the press that selects it (its picture or tile, marks, name, lines), its cut-outs'
// tags and, a cube selected, its Shows and Hides (buttons of their own, so a press there neither selects nor picks it)
const MOVES_TIP = 'It moves: a motion, a recorded path or a behaviour';
function itemCardHTML(x) {
  const P = x.pic ? pvAny(x.pic) : null, T = !P && x.tile ? tileUrl(x.tile) : '';
  const mk = (x.lock ? '<i class="mk" title="Locked in place">🔒</i>' : '') + (x.moves ? `<i class="mk mv" title="${MOVES_TIP}">moves</i>` : '');
  const tk = (L, v) => `<span class="tks">${L.map(([l, on]) => `<button type="button" class="tk" data-act="tick" data-v="${l}:${esc(v)}" data-id="tick:${l}:${esc(v)}" aria-pressed="${!!on}" title="${l === 'show' ? 'On its Shows list' : 'On its Hides list'}">${l === 'show' ? 'Shows' : 'Hides'}</button>`).join('')}</span>`;
  return `<div class="stu-card stu-ic${x.sel ? ' sel' : ''}${x.pk ? ' pk-' + x.pk : ''}" data-card="${esc(x.v)}">` +
    `<button type="button" class="cm" data-act="${x.act}" data-v="${esc(x.v)}" data-id="${esc(x.id)}" aria-pressed="${!!x.on}" title="${esc(x.title || x.label)}"${x.dis ? ' disabled' : ''}>` +
    `<span class="pic">${P ? `<img src="${P.url}" alt="">` : T ? `<img src="${T}" alt="" data-tile="${esc(x.tile.k)}">` : `<b>${esc(x.kind || '')}</b>`}${mk ? `<span class="mks">${mk}</span>` : ''}</span>` +
    `<span class="nm">${esc(x.label)}</span>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}${x.sub2 ? `<small class="f">${esc(x.sub2)}</small>` : ''}</button>` +
    (x.tags || []).map(g => `<span class="tg"><button type="button" class="tag${g.sel ? ' sel' : ''}${g.pk ? ' pk-' + g.pk : ''}" data-act="${g.act}" data-v="${esc(g.v)}" data-id="${esc(g.id)}" aria-pressed="${!!g.on}" title="${esc(g.title || g.label)}">${esc(g.label)}</button>${g.ticks ? tk(g.ticks, g.v) : ''}</span>`).join('') +
    (x.ticks ? tk(x.ticks, x.v) : '') + '</div>';
}
function blockHTML(b) {
  if (b.xr) return '';
  if (b.drop || b.input || b.plan) return uploadHTML(b);
  if (b.label && b.p !== undefined) return `<p class="stu-l">${esc(b.label)}</p><p class="${b.c || ''}">${esc(b.p)}</p>`;
  const btn = x => `<button class="btn${x.primary ? ' primary' : ''}${x.col === 'red' ? ' red' : ''}${x.warn ? ' warn' : ''}" type="button" data-act="${x.act}" data-v="${esc(x.v === undefined ? '' : x.v)}"${typeof x.v === 'number' ? ' data-n="1"' : ''} aria-pressed="${!!x.on}"${x.dis ? ' disabled' : ''} data-id="${esc(x.id)}">${x.sw ? `<i class="stu-sw" style="background:${esc(x.sw)}"></i>` : ''}${esc(x.label)}</button>`;
  if (b.h !== undefined) return `${b.sub ? `<p class="stu-k">${esc(b.sub)}</p>` : ''}<h3>${esc(b.h)}</h3>`;
  if (b.p !== undefined) return `<p class="${b.c || ''}">${esc(b.p)}</p>`;
  if (b.code !== undefined) return `<code class="stu-code">${esc(b.code)}</code>`;
  if (b.kv) return `<dl class="stats">${b.kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  const lab = b.label ? `<p class="stu-l">${esc(b.label)}</p>` : '';
  // (a slider: Fewer triangles' share; its words follow it as it moves, liteBind)
  if (b.range) { const r = b.range; return lab + `<div class="stu-range"><input type="range" id="${esc(r.id)}" data-range="${esc(r.act)}" data-v="${esc(r.v === undefined ? '' : r.v)}" min="${r.min}" max="${r.max}" step="${r.step || 1}" value="${r.value}" aria-label="${esc(r.aria || b.label || '')}"${r.dis ? ' disabled' : ''}><b data-range-out>${esc(r.out)}</b></div>`; }
  if (b.row) return lab + `<div class="actions">${b.row.filter(x => !x.xr).map(btn).join('')}</div>`;
  // (a colour field: any colour, taken once it is chosen: its 'change' event, buildExplore)
  if (b.colour) { const q = b.colour; return lab + `<label class="stu-col"><input type="color" id="${esc(q.id)}" data-colour="${esc(q.act)}" value="${esc(q.value)}"${q.dis ? ' disabled' : ''}><span>${esc(q.label || '')}</span></label>`; }
  // (the Add pane's models: a card each, its picture or a plain tile with its kind; e7e_pics.js fetches what it lacks)
  // (a group's heading in the Items pane: a press selects the group)
  if (b.gh) { const x = b.gh; return lab + `<button type="button" class="stu-gh${x.sel ? ' sel' : ''}" data-act="${x.act}" data-v="${esc(x.v)}" data-id="${esc(x.id)}" aria-pressed="${!!x.on}"><i class="stu-sw" style="background:${esc(x.col || '')}"></i><span>${esc(x.label)}${x.lock ? ' 🔒' : ''}</span><small>${esc(x.sub || '')}</small></button>`; }
  if (b.grid && b.grid.some(x => x.item)) return lab + `<div class="stu-grid">${b.grid.map(itemCardHTML).join('')}</div>`;
  // (an Add card's Look: the model over the whole window, e7f_viewer.js; a button of its own over the picture's corner, so
  // a press on the card still places it)
  if (b.grid) return lab + `<div class="stu-grid">${b.grid.map(x => { const P = pvAny(x.pic || []); const card = `<button type="button" class="stu-card" data-act="${x.act}" data-v="${esc(x.v)}" data-id="${esc(x.id)}" title="${esc(x.title || x.label)}"${x.dis ? ' disabled' : ''}>` +
    `<span class="pic">${P ? `<img src="${P.url}" alt="">` : `<b>${esc(x.kind || '')}</b>`}</span><span class="nm">${esc(x.label)}${x.warn ? '<span class="stu-warn" title="See its card">⚠</span>' : ''}</span>` +
    `${x.sub ? `<small>${esc(x.sub)}</small>` : ''}${x.sub2 ? `<small class="f">${esc(x.sub2)}</small>` : ''}</button>`;
    return x.look ? `<div class="stu-cw">${card}<button type="button" class="stu-look" data-act="look" data-v="${esc(x.v)}" data-id="look:${esc(x.v)}" title="Look at ${esc(x.label)} over the whole window, spun about">Look</button></div>` : card; }).join('')}</div>`;
  if (b.list) return lab + `<ul class="stu-list">${b.list.map(x => `<li data-act="${x.act}" data-v="${esc(x.v)}" data-id="${esc(x.id)}" aria-pressed="${!!x.on}"${x.dis ? ' aria-disabled="true"' : ''} style="${x.col ? `border-left-color:${x.col};` : ''}">
    <span>${esc(x.label)}${x.warn ? '<span class="stu-warn" title="See its card">⚠</span>' : ''}</span>
    ${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</li>`).join('')}</ul>`;
  return '';
}
function renderPanes() {
  if (X.sliding || (document.activeElement && document.activeElement.id === 'stuTint')) { X.dirty = true; return; }   // (a slider held, or the colour field's picker open: drawn again once let go)
  X.dirty = false; X.drawn = performance.now();
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === X.tab));
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + X.tab));
  const pane = $('#pane-' + X.tab);
  if (!pane) return;
  const ae = document.activeElement, fid = ae && (['stuNewName', 'stuSceneName'].includes(ae.id) || /^stuRange/.test(ae.id)) ? ae.id : '', fo = fid ? [ae.selectionStart, ae.selectionEnd] : null;
  pane.innerHTML = paneBlocks(X.tab).map(blockHTML).join('');
  if (fo) { const i = $('#' + fid); if (i) { i.focus(); try { if (i.type === 'text') i.setSelectionRange(fo[0], fo[1]); } catch (e) { /* gone */ } } }   // (a slider keeps the keyboard's focus too)
  for (const [k] of TABS) if (k !== X.tab) { const p = $('#pane-' + k); if (p && p.innerHTML) p.innerHTML = ''; }
  const vb = $('#viewctl [data-ctl="view"]');
  if (vb) vb.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === X.view));
}
let paneLast = '';
function paneStep(now) {
  if (GL.tc && GL.tc.object && (!editOn() || (!X.tcDrag && lockWhy(STU.items.get(STU.sel))))) tcAttach();   // (a lock, the end of editing or an item locked in place: the arrows go)
  liteStep();   // (Fewer triangles' and Change texture's previews follow their object)
  if (APP.mode !== 'explore') return;
  const s = paneSig();
  if (s !== paneLast) { paneLast = s; X.dirty = true; }
  if (X.dirty && now - X.drawn > 150) renderPanes();
}
// the two labels: the name of what you point at, and of what is selected
function updateExtraLabels() {
  const [Lh, Ls] = LBL.extra;
  if (!Lh) return;
  const ed = editOn(), h = ed && STU.hover !== STU.sel ? STU.items.get(STU.hover) : null, s = ed ? STU.items.get(STU.sel) : null;
  // (a sound that follows a model names it: "Voice → Dancer · Head"; a group's member its group: "Group 2 · Dancer")
  const to = it => (it.kind === 'g' ? `group of ${members(it).length}` : it.kind === 's' && it.rec.on ? '→ ' + followWords(it) : it.kind === 'x' ? 'cuts ' + (cutObj(it) ? cutObj(it).rec.name : 'nothing') : '');
  const gOf = it => (GROUP_KINDS.includes(it.kind) ? groupOf(it.id) : null), hg = h && gOf(h), sg = s && gOf(s);
  labelSet(Lh, h ? [hg ? tagName(hg.rec) + ' · ' + tagName(h.rec) : tagName(h.rec), to(h) || KIND_NAME[h.kind] + (h.kind === 'p' && h.rec.look === 'hide' ? ' · hides things' : '')] : null);
  labelSet(Ls, s ? [tagName(s.rec), (to(s) ? to(s) + ' · ' : '') + (sg ? 'in ' + sg.rec.name + ' · ' : '') + (s.rec.locked ? 'locked · ' : '') + 'selected'] : null);
  Lh.show = h ? 1 : 0; Ls.show = s ? 1 : 0;
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _rp = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
// what the pointer can find while editing: objects (their unseen boxes, or a grey box), sounds, cubes (behind the others:
// you often stand inside a cube) and the selected cube's corners
function pickables() {
  const L = [];
  for (const it of STU.items.values()) {
    if (it.kind === 'o') { if (it.model && it.holder.visible) L.push(it.proxy); else if (it.grey.group.visible) L.push(it.greyHit); }
    else if (it.kind === 's') { if (it.holder.visible) L.push(it.look.hit); }
    else if (it.kind === 'x') { if (it.holder.visible && !cutsHid(it)) { L.push(it.look.hit); if (STU.sel === it.id) for (const c of it.look.corners) L.push(c); } }
    else if (it.kind === 'c' && it.holder.visible) { L.push(it.look.fill); if (STU.sel === it.id) for (const c of it.look.corners) L.push(c); }   // (a group: nothing of its own; its members are found)
    else if (it.kind === 'p' && it.holder.visible) { L.push(it.look.mesh.visible ? it.look.mesh : it.look.fill); if (STU.sel === it.id && it.rec.shape === 'cube') for (const c of it.look.corners) L.push(c); }
    else if (it.kind === 'e' && it.holder.visible) L.push(it.look.hit);
  }
  return L.concat(ghostHits());   // (a ghost, where a moving item is placed, is pointed at as the item: e6h_ghost.js)
}
// the nearest thing a ray finds: a corner first, then the nearest object, sound or cut-out, a cube only when nothing
// else is hit. A cut-out lies within its object's unseen box, so that box is passed over when the ray goes on into one
// of the object's own cut-outs (a nearer object or sound is still found first); picking the object a sound follows or a
// cut-out cuts (STU.follow, STU.cutTo), cut-outs are passed through. An object found carries the ray: the click (or the
// trigger) that selects it keeps it (pressItem, cutRay), and a new cut-out goes where it met the model. o.inside: when the
// ray finds nothing at all and starts inside an object's unseen box (you stand in a room scan: its box's faces point away
// from you, so the ray meets none of them), that object, the smallest such box if several (insidePick)
function rayPick(ray, o) {
  GL.world.updateMatrixWorld(true);
  const hs = ray.intersectObjects(pickables(), false), itOf = h => STU.items.get(h.object.userData.id), kind = h => { const it = itOf(h); return it ? it.kind : ''; };
  const objOnly = !!(STU.follow || STU.cutTo || STU.gpick || STU.txp), xs = objOnly ? [] : hs.filter(h => kind(h) === 'x'), own = h => xs.some(x => itOf(x).rec.on === h.object.userData.id);
  const c = hs.find(h => h.object.userData.corner !== undefined) || hs.find(h => { const k = kind(h); return !!k && k !== 'c' && !(k === 'x' && objOnly) && !(k === 'o' && own(h)); }) || hs[0];
  if (!c) return o && o.inside ? insidePick(ray.ray) : null;
  const gh = !!c.object.userData.ghost;   // (its ghost: the ray met it where it is placed, not where it is drawn)
  return { id: c.object.userData.id, corner: c.object.userData.corner, point: c.point.clone(), dist: c.distance, ray: kind(c) === 'o' ? Object.assign(ray.ray.clone(), { ghost: gh }) : null, ghost: gh };
}
// the object whose unseen box holds the ray's origin (the controller, or a page's camera in Walk view), the smallest if
// several (a figure standing in a room scan: the figure); the point where the ray leaves that box (the pointer's dot)
const _ib = new THREE.Matrix4(), _ir = new THREE.Ray(), _iv = new THREE.Vector3(), UNIT = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
function insidePick(r) {
  let best = null, bv = Infinity;
  for (const it of STU.items.values()) {
    if (it.kind !== 'o' || !it.model || !it.holder.visible) continue;
    const m = it.proxy.matrixWorld;
    _iv.copy(r.origin).applyMatrix4(_ib.copy(m).invert());
    if (Math.abs(_iv.x) > 0.5 || Math.abs(_iv.y) > 0.5 || Math.abs(_iv.z) > 0.5) continue;
    const v = Math.abs(m.determinant());   // (the box's volume)
    if (v < bv) { bv = v; best = it; }
  }
  if (!best) return null;
  const m = best.proxy.matrixWorld, p = _ir.copy(r).applyMatrix4(_ib.copy(m).invert()).intersectBox(UNIT, new THREE.Vector3());
  const point = p ? p.applyMatrix4(m) : r.origin.clone();
  return { id: best.id, corner: undefined, point, dist: point.distanceTo(r.origin), ray: r.clone(), inside: true };
}
function pointerRay(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return _rc;
}
function bindCanvas() {
  const cv = GL.canvas, pts = new Map();
  let down = null, pinch = 0;
  cv.style.cursor = 'grab';
  cv.addEventListener('pointerdown', ev => {
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    down = { x: ev.clientX, y: ev.clientY, moved: false, b: ev.button, shift: ev.shiftKey, tc: !!(GL.tc && (GL.tc.dragging || GL.tc.axis)) };
    if (!down.tc) cv.setPointerCapture(ev.pointerId);
    orbit.held = true;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  cv.addEventListener('pointermove', ev => {
    if (!pts.has(ev.pointerId)) {
      // pointing without a button (editing): what is under the mouse lights up and shows its name
      if (APP.mode === 'explore' && ev.pointerType !== 'touch' && editOn() && !(GL.tc && GL.tc.axis)) {
        const ray = pointerRay(ev.clientX, ev.clientY), h = rayPick(ray, { inside: walkInside(ray) });
        STU.hover = h ? h.id : ''; cv.style.cursor = h ? 'pointer' : 'grab';
      }
      return;
    }
    if (APP.mode !== 'explore' || (down && down.tc) || X.tcDrag) return;
    const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0 && X.view === 'orbit') orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.5, 120);
      pinch = d; down.moved = true; return;
    }
    if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
    if (!down || !down.moved) return;
    if (X.view === 'walk') { WALK.yaw += dx * 0.004; WALK.pitch = clamp(WALK.pitch + dy * 0.004, -1.3, 1.3); WALK.to = null; return; }
    orbit.to = null;
    if (down.b === 2 || down.shift) {
      // pan: the target slides along the floor (right button or Shift)
      const a = orbit.cur[0] * D2R, k = orbit.cur[2] * 0.0016;
      orbit.cur[3] -= (Math.cos(a) * dx - Math.sin(a) * dy) * k; orbit.cur[5] -= (-Math.sin(a) * dx - Math.cos(a) * dy) * k;
    } else { orbit.cur[0] -= dx * 0.3; orbit.cur[1] = clamp(orbit.cur[1] + dy * 0.25, -10, 86); }
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && !down.tc && ev.type === 'pointerup' && performance.now() - X.tcUp > 200) clickAt(ev.clientX, ev.clientY);
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('contextmenu', ev => ev.preventDefault());
  cv.addEventListener('pointerleave', () => { if (!pts.size) STU.hover = ''; });
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    if (X.view === 'walk') { const f = -ev.deltaY * 0.004; WALK.pos.x -= Math.sin(WALK.yaw) * f; WALK.pos.z -= Math.cos(WALK.yaw) * f; return; }
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.5, 120);
  }, { passive: false });
  document.addEventListener('keydown', ev => {
    if (ev.target && ev.target.closest && ev.target.closest('input, textarea, select')) return;
    if (APP.mode !== 'explore' || XR.on || HOST.picking) return;
    const k = ev.key.toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && k === 'z') { if (editOn()) { undo(); ev.preventDefault(); } return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (X.view === 'walk' && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { KEYS.add(k); WALK.to = null; ev.preventDefault(); return; }
    if (k === 'escape' && (STU.pick || STU.txp || STU.follow || STU.cutTo || STU.gpick || STU.sel)) { if (STU.pick) STU.pick = null; else if (STU.txp) STU.txp = null; else if (STU.follow) STU.follow = ''; else if (STU.cutTo) STU.cutTo = ''; else if (STU.gpick) gpickEnd(); else select(''); dirty(true); return; }
    if (!editOn() || ev.repeat) return;   // (a key held down adds or deletes once, not one a frame)
    if ((k === 'delete' || k === 'backspace') && STU.sel) { deleteItem(STU.sel); ev.preventDefault(); }
    else if (k === 'd' && STU.sel) duplicateItem(STU.sel);
    else if ({ w: 1, e: 1, r: 1 }[k]) tcSetMode({ w: 'translate', e: 'rotate', r: 'scale' }[k]);
    else if (k === 'p') pauseSet(!MPAUSE.on);   // (Pause: everything at its placed pose; e6h_ghost.js)
  });
  document.addEventListener('keyup', ev => KEYS.delete(ev.key.toLowerCase()));
  window.addEventListener('blur', () => KEYS.clear());
}
// a click: editing, what is under it is selected (or, picking for a cube, goes in or out of its list); in Walk view a
// click on the floor walks there
function clickAt(mx, my) {
  const ray = pointerRay(mx, my), h = editOn() ? rayPick(ray, { inside: walkInside(ray) }) : null;
  if (h) { pressItem(h.id, h.ray); return; }
  if (X.view === 'walk') {
    const p = walkFloor(ray);
    if (p) { WALK.to = p; sfxAct('step', 'world', p.toArray()); return; }
  }
  if (editOn() && !STU.pick && !STU.txp && !STU.follow && !STU.cutTo && !STU.gpick) select('');
}
// the trigger (or a click) on an item: picking for a cube, in or out of its list; else selected (an object with the
// ray that found it kept: a new cut-out goes where it met the model, not where the pointer passed over it since)
// A group's member: its group, or (its group selected) that member alone; picking for a cube, all of its group's members
// in or out of its list; picking a group's members, in or out of that group (Ctrl- or Shift-click as a click)
function pressItem(id, ray) {
  const it = STU.items.get(id);
  if (!it || !editOn()) return;
  const g = GROUP_KINDS.includes(it.kind) ? groupOf(id) : null;
  // (a cube picking what it shows or hides: an item in a group puts in all of its group's members a cube can list (not its
  // cubes); a cube in a group of cubes alone, nothing to list, is selected as an ungrouped cube is (its group, as a click
  // on any member), which ends the pick)
  const gl = g && STU.pick ? members(g).filter(m => m.kind !== 'c' && m.id !== STU.pick.id).map(m => m.id) : [];
  if (STU.pick && id !== STU.pick.id && (it.kind !== 'c' || gl.length)) { if (gl.length) toggleLinks(STU.pick.id, STU.pick.list, gl); else toggleLink(STU.pick.id, STU.pick.list, id); return; }
  if (STU.follow && id !== STU.follow) { if (FOLLOW_KINDS.includes(it.kind)) itemAct('follow', id, STU.follow); return; }   // (a sound picking what it follows: an object, a shape or an empty)
  if (STU.cutTo && id !== STU.cutTo) { if (it.kind === 'o') itemAct('cutOn', id, STU.cutTo); return; }   // (a cut-out picking the object it cuts)
  if (STU.txp && id !== STU.txp.id) { if (it.kind === 'o') itemAct('txOn', id, STU.txp.id); return; }   // (a cube picking the object it changes a picture of: e6i_tex.js)
  if (STU.gpick && id !== STU.gpick.id) { groupToggle(STU.gpick.id, id); return; }   // (a group picking its members)
  select(g && STU.sel !== g.id && STU.sel !== id ? g.id : id);
  if (ray && it.kind === 'o') cutRay(id, ray);
  sfxAct('pick', 'world', null);
}
// Walk view: where a click on the floor walks to (within 60 m), or null; standing inside a model's unseen box (a room
// scan), a click that finds nothing and not the floor selects that model (rayPick's inside: the floor is for walking)
function walkFloor(ray) { const p = ray.ray.intersectPlane(_rp, new THREE.Vector3()); return p && p.distanceTo(WALK.pos) < 60 ? p : null; }
const walkInside = ray => X.view === 'walk' && !walkFloor(ray);
// Walk view: W A S D or the arrows walk (Shift faster), a click on the floor walks there; the camera at 1.6 m
function walkStep(dt) {
  const f = (KEYS.has('w') || KEYS.has('arrowup') ? 1 : 0) - (KEYS.has('s') || KEYS.has('arrowdown') ? 1 : 0);
  const sd = (KEYS.has('d') ? 1 : 0) - (KEYS.has('a') ? 1 : 0), turn = (KEYS.has('arrowright') ? 1 : 0) - (KEYS.has('arrowleft') ? 1 : 0);
  const v = 1.6 * dt;
  WALK.yaw -= turn * 1.6 * dt;
  WALK.pos.x += (-Math.sin(WALK.yaw) * f + Math.cos(WALK.yaw) * sd) * v;
  WALK.pos.z += (-Math.cos(WALK.yaw) * f - Math.sin(WALK.yaw) * sd) * v;
  if (WALK.to) {
    const dx = WALK.to.x - WALK.pos.x, dz = WALK.to.z - WALK.pos.z, d = Math.hypot(dx, dz), step = Math.min(d, 2 * dt);
    if (d < 0.02) WALK.to = null; else { WALK.pos.x += dx / d * step; WALK.pos.z += dz / d * step; }
  }
  WALK.pos.y = 1.6;
  const c = GL.camera;
  c.position.copy(WALK.pos);
  c.rotation.set(WALK.pitch, WALK.yaw, 0, 'YXZ');
}

// -------------------------------------------------------- the page's arrows --
// TransformControls on the selected item (page, editing): move, turn and size; a cube stays level and takes its size
// per axis, a sound only moves, an object sizes as a whole, a cut-out turns freely and takes its size per axis, a group
// (its pivot, the middle of its members on the floor) turns about the vertical only and sizes as a whole. A drag is one
// change (Undo), and while it lasts the room's records do not move the item (a group's members) here. An item that moves
// (a motion, a recorded path, a behaviour) has them on its ghost, where it is placed (TCP, e6h_ghost.js): each change goes
// into its placed pose as a drag of the item itself would, and it rests there while dragged
function tcSetup() {
  if (!THREE.TransformControls) return;
  const tc = new THREE.TransformControls(GL.camera, GL.canvas);
  tc.setSize(0.85);
  tc.addEventListener('dragging-changed', e => {
    X.tcDrag = !!e.value;
    const it = tc.object && STU.items.get(tc.object.userData.id);
    if (e.value) { if (it) { it.carry = true; it.gl = null; if (it.kind === 'g') groupHold(it); else beginChange([it.id]); } }
    else { if (it) { it.carry = false; tcRead(it); if (it.kind === 'g') groupRelease(it); } if (!(REC && REC.by === 'page')) endChange(); X.tcUp = performance.now(); }   // (a page's recording: one change from Record to Stop)
  });
  tc.addEventListener('objectChange', () => {
    const it = tc.object && STU.items.get(tc.object.userData.id);
    if (!it) return;
    const px = tc.object === TCP;
    if (px) { it.holder.position.copy(TCP.position); it.holder.quaternion.copy(TCP.quaternion); it.holder.scale.copy(TCP.scale); }
    tcRead(it);
    if (px) tcProxy(it);   // (what tcRead made of it: a cube's yaw, an object's one size)
  });
  GL.scene.add(tc);
  GL.tc = tc;
}
function tcRead(it) {
  const h = it.holder;
  if (it.kind === 'g') {
    // (from where its members stood as the drag began: a move, a turn about the vertical, a size alike on every axis)
    const B = it.base;
    if (!B) return;
    let k = 1;
    if (GL.tc.mode === 'scale') { const v = [h.scale.x, h.scale.y, h.scale.z], d = v.map(x => Math.abs(x - 1)); k = clamp(v[d.indexOf(Math.max(...d))], 1e-3, 1e3); }
    h.scale.setScalar(k);
    const th = new THREE.Euler().setFromQuaternion(h.quaternion, 'YXZ').y;
    h.rotation.set(0, th, 0);
    groupMove(B, h.position.clone().sub(B.P), th, k, true);
  } else if (it.kind === 'o') {
    let s = it.rec.s;
    if (GL.tc.mode === 'scale') { const v = [h.scale.x, h.scale.y, h.scale.z], d = v.map(x => Math.abs(x - s)); s = Math.max(1e-4, v[d.indexOf(Math.max(...d))]); h.scale.setScalar(s); }
    setObj(it.id, { p: h.position.toArray(), q: h.quaternion.toArray(), s });   // (the sounds that follow it keep their place on it)
  } else if (it.kind === 'c') {
    const yaw = new THREE.Euler().setFromQuaternion(h.quaternion, 'YXZ').y;
    h.rotation.set(0, yaw, 0);
    setRec(it.id, { p: h.position.toArray(), yaw, size: h.scale.toArray().map(v => Math.max(0.05, Math.abs(v))) });
  } else if (it.kind === 'x') {
    h.scale.set(...h.scale.toArray().map(v => Math.max(0.01, Math.abs(v))));
    setRec(it.id, cutRecOf(it));   // (in the frame of the object it cuts)
  } else if (it.kind === 'p') {
    h.scale.set(...h.scale.toArray().map(v => clamp(Math.abs(v), 0.01, 100)));
    setRec(it.id, { p: h.position.toArray(), q: h.quaternion.toArray(), size: h.scale.toArray() });
  } else if (it.kind === 'e') { h.scale.set(1, 1, 1); setRec(it.id, { p: h.position.toArray(), q: h.quaternion.toArray() }); }
  else setRec(it.id, soundAt(it, h.position));   // (a sound that follows a model: its offset too, from where it was put)
}
function tcSetMode(m) {
  X.tcMode = m;
  tcAttach();
  dirty(true);
}
function tcAttach() {
  const tc = GL.tc;
  if (!tc) return;
  const it = STU.items.get(STU.sel);
  // (locked in place: no arrows; recording a path: no Size)
  if (!it || !editOn() || XR.on || APP.mode !== 'explore' || lockWhy(it)) { if (tc.object) tc.detach(); return; }
  const m = it.kind === 's' || ((it.kind === 'e' || recording(it)) && X.tcMode === 'scale') ? 'translate' : X.tcMode;
  tc.setMode(m);
  tc.setSpace((it.kind === 'c' || it.kind === 'x' || it.kind === 'p') && m !== 'translate' ? 'local' : 'world');
  tc.showX = tc.showZ = !((it.kind === 'c' || it.kind === 'g') && m === 'rotate');
  tc.showY = true;
  // (its own holder, or its ghost's stand-in while it moves: e6h_ghost.js; never switched in the middle of a drag)
  const T = X.tcDrag && (tc.object === it.holder || (tc.object === TCP && TCP.userData.id === it.id)) ? tc.object : tcTarget(it);
  if (T === TCP) tcProxy(it);
  if (tc.object !== T) tc.attach(T);
}
