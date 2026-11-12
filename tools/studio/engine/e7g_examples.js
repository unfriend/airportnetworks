// ========================================================= EXAMPLE SCENES ==
// Scenes that ship with the app (v137; tools/studio/SPEC.md, "Example scenes"): a folder examples/ at the app's root holding
// scene folders and their listings exactly as tools/studio/scan.mjs writes them (examples/index.json and
// examples/<name>/files.json; &examples=<a relative folder> picks another, as the tests do). The first is bliss-xp, the XP
// room (tools/studio/xp/make.mjs). The Scene pane lists them, page and headset:
// - Open: the scene from that folder, read only, as &scenes=examples&scene=<name> opens it (editing works on this device;
//   Download layout.json keeps what was changed); Back to your scenes returns to where scenes came from before. Not at a
//   shared room's circle (its scene is the room's, and the others' relay may not have it): copy it to the relay there;
// - Copy to the relay (a page only, with a relay that takes uploads): a free scene name (the example's, else numbered),
//   POST /api/scenes, every listed file fetched from the example and uploaded to the same path through the studio's own
//   upload path (upSend: straight into R2 where it can), its pictures too, then its layout.json saved through the layout
//   endpoint, the progress on the pane; then the copy opened from the relay with editing on.
// Nothing of it in the layout or the room (no FORMAT change).
const EX = { list: null, got: false, note: '', noteC: 'muted', busy: '', done: 0, of: 0, p: 0, path: '', prev: null };
const exBase = () => OPT.examples;
// the source is the examples' folder now (an example open)
const exHere = () => SRC.kind === 'folder' && SRC.folder === OPT.examples;
// the examples' listing, read once (none: no examples next to this copy of the app)
async function exLoad() {
  if (EX.got) return;
  EX.got = true;
  try {
    const j = await getJSON(exBase() + '/index.json');
    EX.list = (j && Array.isArray(j.scenes) ? j.scenes : []).filter(s => s && okScene(s.name)).map(s => ({ name: s.name, files: +s.files || 0, bytes: +s.bytes || 0 }));
  } catch (e) { EX.list = []; }
  dirty(true);
}
// Open: the scenes from the examples' folder, this one opened (read only); where they came from kept for Back
function exOpen(name) {
  if (atStation() || !EX.list || !EX.list.some(s => s.name === name) || (exHere() && STU.scene === name)) return;
  if (!EX.prev) EX.prev = { scenes: OPT.scenes, scene: STU.scene };
  OPT.scenes = OPT.examples; OPT.scene = name;
  openScene('', 'pick');
  findSource();
  sfxAct('whoosh', 'stage', 'centre', { dur: 0.8 });
}
// Back to your scenes: the source as it was before the first example was opened
function exBack() {
  if (!EX.prev) return;
  OPT.scenes = EX.prev.scenes; OPT.scene = EX.prev.scene || ''; EX.prev = null;
  openScene('', 'pick');
  findSource();
}
// a scene name the relay has not got: the example's, else numbered ("bliss-xp 2")
function exFree(name) {
  const taken = new Set(SRC.scenes.map(s => s.name.toLowerCase()));
  let to = name, k = 2;
  while (taken.has(to.toLowerCase()) || !okScene(to)) to = `${name.slice(0, 58)} ${k++}`;
  return to;
}
const exCan = () => !XR.on && !OPT.visit && canWrite() && !exHere();
// Copy to the relay: made there file by file, its layout last, then opened from the relay with editing on
async function exCopy(name) {
  if (!exCan() || EX.busy || !EX.list || !EX.list.some(s => s.name === name)) return;
  const to = exFree(name), from = `${exBase()}/${encodeURIComponent(name)}/`;
  Object.assign(EX, { busy: name, note: `Copying ${name} to the relay as ${to}...`, noteC: 'muted', done: 0, of: 0, p: 0, path: '' });
  dirty(true);
  const failed = [];
  try {
    const j = await getJSON(from + 'files.json');
    const files = (j && Array.isArray(j.files) ? j.files : []).filter(f => f && okFile(f.path)).map(f => f.path);
    let layout = null;
    if (+(j && j.layoutAt) > 0) { try { layout = await getJSON(from + 'layout.json'); } catch (e) { layout = null; } }
    EX.of = files.length + (layout ? 1 : 0);
    await getJSON(`${SRC.base}/api/scenes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: to }) });
    for (const p of files) {
      if (GL.gone) return;
      EX.path = p; EX.p = 0; dirty(true);
      try {
        const bytes = await getBytes(from + encPath(p));
        await upSend(fileApi(to, p), bytes, f => { EX.p = f; dirty(); });
      } catch (e) {
        if (e.status === 401) throw e;
        failed.push(`${p} (${e.message})`);
      }
      EX.done++;
    }
    if (layout) {
      EX.path = 'layout.json'; dirty(true);
      layout.scene = to;
      await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(to)}/layout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(layout) });
      EX.done++;
    }
    await listScenes(SRC.gen);
    if (GL.gone) return;
    if (!editLocked() && !atStation()) { openScene(to, 'pick'); if (!STU.edit) setEdit(true); }
    EX.note = `Copied ${name} to the relay as ${to}` + (failed.length ? `, but ${failed.length} file${failed.length > 1 ? 's' : ''} could not be: ${failed.slice(0, 3).join('; ')}${failed.length > 3 ? '...' : ''}` : ': it is yours to change and save.');
    EX.noteC = failed.length ? 'amber' : 'green';
    sfxAct('ping', 'stage', 'centre', { gain: 0.6 });
  } catch (e) {
    EX.note = e.status === 401 ? AUTH_NOTE : e.status === 409 ? `The relay has a scene called ${to} already: pick it above.` : e.status === 403 ? 'This relay takes no uploads (it runs with --scenes-readonly).' : `${name} could not be copied: ${e.message}`;
    EX.noteC = 'red';
  } finally { EX.busy = ''; EX.path = ''; dirty(true); }
}
// the Scene pane's Examples (page and headset; Copy to the relay a page's only)
function exBlocks(B) {
  if (!EX.list || !EX.list.length) return;
  const here = exHere(), st = atStation(), can = exCan();
  B.push({ label: 'Examples (they come with the app)', p: here ? 'An example is open, read only: what you change stays on this device (Download layout.json keeps it).' : 'Scenes to try. Open one as it is, read only' + (can ? ', or copy it to the relay to make it yours.' : '.'), c: 'faint' });
  for (const s of EX.list) {
    const open = here && STU.scene === s.name;
    B.push({ row: [{ id: 'exopen:' + s.name, label: (open ? '✓ ' : '') + s.name, act: 'exopen', v: s.name, on: open, dis: st || !!EX.busy },
      { id: 'excopy:' + s.name, label: EX.busy === s.name ? 'Copying...' : 'Copy to the relay', act: 'excopy', v: s.name, page: true, dis: !can || !!EX.busy, primary: can && open }] });
  }
  if (st) B.push({ p: 'At a circle the scene is for everyone here: copy an example to the relay (on a page) and pick it above.', c: 'muted' });
  if (here && EX.prev) B.push({ row: [{ id: 'exback', label: 'Back to your scenes', act: 'exback', dis: !!EX.busy }] });
  if (EX.busy) B.push({ p: `Copying ${EX.busy}: ${EX.done} of ${EX.of} files` + (EX.path ? ` (${EX.path}${EX.p > 0 && EX.p < 1 ? ', ' + Math.round(EX.p * 100) + ' %' : ''})` : '') + '.', c: 'muted' });
  else if (EX.note) B.push({ p: EX.note, c: EX.noteC });
}
const exSig = () => [EX.list ? EX.list.length : -1, EX.busy, EX.done, EX.of, EX.path, Math.round(EX.p * 20), EX.note, !!EX.prev, exHere(), exCan()].join(',');
// for tests (STUDIO.examples): the list, what is open, and a copy under way or its note
const exState = () => ({ list: EX.list ? EX.list.map(s => s.name) : null, here: exHere(), folder: OPT.examples, busy: EX.busy, done: EX.done, of: EX.of, note: EX.note, prev: !!EX.prev, can: exCan() });
