// ========================================================= EXAMPLE SCENES ==
// Scenes that ship with the app (v137; tools/studio/SPEC.md, "Example scenes"): a folder examples/ at the app's root holding
// scene folders and their listings exactly as tools/studio/scan.mjs writes them (examples/index.json and
// examples/<name>/files.json; &examples=<a relative folder> picks another, as the tests do). The first is bliss-xp, the XP
// room (tools/studio/xp/make.mjs). The Scene pane lists them, page and headset:
// - Open: the scene from that folder, read only, as &scenes=examples&scene=<name> opens it (editing works on this device;
//   Download layout.json keeps what was changed); Back to your scenes returns to where scenes came from before;
// - at a shared room's circle (v137b; the owner, 12 November 2026, at a studio circle on the test place: "bliss is greyed
//   out, why"): the scene there is the room's, so the example's button opens it from the relay for everyone at the circle:
//   the relay's copy of it (a scene of its name there that is whole: its layout and at least the example's files), else
//   it is copied there first under its name (exAt). A scene of its name that is not whole is never opened as it: while
//   its listing changes (a copy under way, here or on another device) the button waits ("Being copied..."), else (a copy
//   broken off) a press finishes it there (only the files it lacks, its layout when it has none). Greyed only while the
//   story is locked or the room has no relay that takes uploads (a sentence says which). A device that had an example
//   open as it came to a circle goes back to the relay first (exLeave): the example's folder is this device's;
// - Copy to the relay (with a relay that takes uploads, page and headset since v137b): a free scene name (the example's,
//   else numbered), POST /api/scenes, every listed file fetched from the example and uploaded to the same path through the
//   studio's own upload path (upSend: straight into R2 where it can), its pictures too, then its layout.json saved through
//   the layout endpoint, the progress on the pane; then the copy opened from the relay (with editing on, away from a
//   circle; at a circle for everyone there, as the circle it was pressed at is still this device's, and only once every
//   file came through). A name taken meanwhile (the listing was old: the relay says 409) takes the next free one.
// Nothing of it in the layout or the room (no FORMAT change).
const EX = { list: null, got: false, note: '', noteC: 'muted', noteAt: null, busy: '', to: '', done: 0, of: 0, p: 0, path: '', prev: null,
  seen: new Map(), quiet: 60000, own: null };   // (seen: each example's scene on the relay, its listing and when it last
// changed here; quiet: a scene not whole whose listing has not changed for that long is a copy broken off, tests shorten
// it; own: the scene this device's last copy went to and until when a listing of it still counts as this copy's)
const exBase = () => OPT.examples;
// the source is the examples' folder now (an example open)
const exHere = () => SRC.kind === 'folder' && SRC.folder === OPT.examples;
// the examples' listing, read once (none: no examples next to this copy of the app)
async function exLoad() {
  if (EX.got) return;
  EX.got = true;
  try {
    const j = await getJSON(exBase() + '/index.json');
    EX.list = (j && Array.isArray(j.scenes) ? j.scenes : []).filter(s => s && okScene(s.name)).map(s => ({ name: s.name, files: +s.files || 0, bytes: +s.bytes || 0, layout: !!s.layout }));
  } catch (e) { EX.list = []; }
  dirty(true);
}
// Open: the scenes from the examples' folder, this one opened (read only); where they came from kept for Back
function exOpen(name) {
  if (atStation()) return exAt(name);
  if (!exOf(name) || (exHere() && STU.scene === name)) return;
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
const exCan = () => !OPT.visit && canWrite() && !exHere();
const exOf = name => (EX.list && EX.list.find(s => s.name === name)) || null;
// the relay's scene of an example's name, as its listing says (none while the relay is not listed, or wants its password)
const exRel = name => (SRC.kind === 'relay' && SRC.state === 'ok' && !SRC.held && SRC.scenes.find(s => s.name === name)) || null;
// the relay's copy of an example (at a circle the one opened): a scene of its name there that is whole, with its layout
// (a copy writes it last) and at least the example's files. A copy under way (the relay lists the scene as soon as it is
// made, before its files) or broken off (a refused file, a lost connection) is not, so it never opens for everyone
function exOnRelay(name) {
  const s = exRel(name), e = exOf(name);
  return !!(s && e && (s.layout || !e.layout) && s.files >= e.files);
}
// a scene of the example's name on the relay that is not whole: 'busy' (a copy under way: this device's, or its listing
// changed here within EX.quiet), else 'broken' (a copy broken off: at a circle a press finishes it); '' none, or whole.
// (A scene first seen not whole has not been seen to change: one broken off yesterday is finished at once, and a press
// that meets another device's copy before its next file is seen finishes it with that device, which is harmless)
function exPart(name) {
  if (EX.busy && EX.to === name) return 'busy';
  if (!exRel(name) || exOnRelay(name)) return '';
  const o = EX.seen.get(name);
  return o && performance.now() - o.t < EX.quiet ? 'busy' : 'broken';
}
// (each frame: the examples' scenes on the relay, when their listing last changed; this device's own copy's changes count
// for nothing, also those a listing asked for during it brings for 3 s after it ended)
function exSaw() {
  if (!EX.list || SRC.kind !== 'relay' || SRC.state !== 'ok') return;
  const now = performance.now();
  for (const e of EX.list) {
    const s = exRel(e.name), sig = s ? `${s.files}:${s.at}:${+s.layout}` : '', o = EX.seen.get(e.name);
    const mine = (EX.busy && EX.to === e.name) || (EX.own && EX.own.name === e.name && now < EX.own.until);
    if (!sig) EX.seen.delete(e.name);
    else if (!o) EX.seen.set(e.name, { sig, t: -Infinity });
    else if (o.sig !== sig) { o.sig = sig; o.t = mine ? -Infinity : now; }
  }
}
// why an example cannot be put on the relay here, in words ('' it can)
function exWhy() {
  if (OPT.visit) return 'this is a visitor\'s page';
  if (SRC.kind !== 'relay') return 'this room has no relay with scenes (it runs peer to peer, or on this device)';
  if (SRC.state === 'auth' || SRC.held) return 'the relay wants its password';
  if (SRC.state !== 'ok') return 'the relay\'s scenes are not listed yet';
  if (!SRC.upload || !SRC.save) return 'this relay takes no uploads';
  return '';
}
// at a circle: the example opened for everyone there from the relay (its copy there, else copied there first)
function exAt(name) {
  exLeave();
  if (!atStation() || editLocked() || EX.busy || !exOf(name)) return;
  // (an example still open here, the relay not yet back: exLeave has asked for it)
  if (exHere()) { Object.assign(EX, { note: 'Going back to the relay\'s scenes first: press it again in a moment.', noteC: 'muted', noteAt: null }); dirty(true); return; }
  if (exOnRelay(name)) {
    if (STU.scene !== name) { openScene(name, 'pick'); sfxAct('whoosh', 'stage', 'centre', { dur: 0.8 }); }
    Object.assign(EX, { note: `Opened ${name} for everyone at this circle.`, noteC: 'green', noteAt: name });
    dirty(true);
    return;
  }
  if (exPart(name) === 'busy') return;   // (being copied: it can open once it is whole)
  exCopy(name, name);   // (made there under its name, or a copy broken off finished)
}
// an example open (its folder this device's) as this device comes to a circle: back to the relay, the scene left to the
// room's (collabApply opens it). From collabApply before it applies the room's state, from collabState (the shell polls it
// on its own timer, before the studio's next frame) and every frame (a circle whose state is still empty: what goes out to
// it is then no scene, never the example's). Once: the folder stays the source until the relay has answered, so a call
// meanwhile (OPT.scenes no longer the examples') asks nothing again, which would throw a slow answer away every frame
function exLeave() {
  if (!exHere() || !atStation() || OPT.scenes !== OPT.examples) return;
  OPT.scenes = EX.prev && EX.prev.scenes !== OPT.examples ? EX.prev.scenes : ''; OPT.scene = ''; EX.prev = null;
  openScene('', 'room');
  findSource();
}
// (each frame: back to the relay at a circle, the examples' scenes on the relay seen, and a note about a scene opened
// gone once another scene is open)
function exStep() {
  exLeave();
  exSaw();
  if (EX.note && EX.noteAt !== null && EX.noteAt !== STU.scene && !EX.busy) { EX.note = ''; EX.noteAt = null; dirty(true); }
}
// what the relay has of a scene already (its files' paths, whether it has a layout); null: no such scene
async function exHave(to) {
  try {
    const j = await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(to)}`);
    return { files: new Set((j && Array.isArray(j.files) ? j.files : []).map(f => f && f.path)), layout: !!(j && j.layout) };
  } catch (e) { if (e.status === 404) return null; throw e; }
}
// Copy to the relay: made there file by file, its layout last, then opened from the relay (with editing on away from a
// circle; at the circle it was pressed at, for everyone there, once every file came through). into (a circle's press of
// the example: its own name): made there, or a scene of that name there already (a copy broken off, or made by another
// device at the same moment: the relay says 409) finished: only the files it has not got, its layout when it has none
async function exCopy(name, into) {
  if (!exCan() || EX.busy || !exOf(name)) return;
  if (atStation() && editLocked()) return;
  let to = into || exFree(name);
  const from = `${exBase()}/${encodeURIComponent(name)}/`, sid = stationId();
  Object.assign(EX, { busy: name, to, note: `Copying ${name} to the relay as ${to}...`, noteC: 'muted', noteAt: null, done: 0, of: 0, p: 0, path: '' });
  dirty(true);
  const failed = [];
  let have = null;
  try {
    const j = await getJSON(from + 'files.json');
    const files = (j && Array.isArray(j.files) ? j.files : []).filter(f => f && okFile(f.path)).map(f => f.path);
    let layout = null;
    if (+(j && j.layoutAt) > 0) { try { layout = await getJSON(from + 'layout.json'); } catch (e) { layout = null; } }
    EX.of = files.length + (layout ? 1 : 0);
    if (into && exRel(into)) have = await exHave(into);
    for (let k = 0; !have; k++) {
      try { await getJSON(`${SRC.base}/api/scenes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: to }) }); break; } catch (e) {
        if (e.status !== 409 || k > 2) throw e;
        // (there already: at a circle the example's own, made by another device meanwhile, finished with it; else the
        // listing was old, so the next free name)
        if (into) { have = await exHave(into); if (!have) throw e; break; }
        await listScenes(SRC.gen);
        to = EX.to = exFree(name); EX.note = `Copying ${name} to the relay as ${to}...`; dirty(true);
      }
    }
    if (have) { EX.note = `Finishing the relay's copy of ${name}...`; dirty(true); }
    for (const p of files) {
      if (GL.gone) return;
      if (have && have.files.has(p)) { EX.done++; continue; }
      EX.path = p; EX.p = 0; dirty(true);
      try {
        const bytes = await getBytes(from + encPath(p));
        await upSend(fileApi(to, p), bytes, f => { EX.p = f; dirty(); });
      } catch (e) {
        if (e.status === 401) throw e;
        if (e.status !== 409) failed.push(`${p} (${e.message})`);   // (409: there meanwhile, another device's copy of it)
      }
      EX.done++;
    }
    if (layout) {
      if (!(have && have.layout)) {
        EX.path = 'layout.json'; dirty(true);
        layout.scene = to;
        await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(to)}/layout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(layout) });
      }
      EX.done++;
    }
    await listScenes(SRC.gen);
    if (GL.gone) return;
    exSaw(); const o = EX.seen.get(to); if (o) o.t = -Infinity;   // (its listing as this copy left it: not a copy under way)
    // (opened where it was pressed: away from a circle with editing on; at the same circle for everyone there, whole; a
    // device that walked into or out of a circle meanwhile opens nothing, the scene there being the room's)
    const at = !!sid, open = !editLocked() && stationId() === sid && !(at && failed.length);
    if (open) { openScene(to, 'pick'); if (!at && !STU.edit) setEdit(true); }
    const n = failed.length, what = have ? (n ? `Copied more of ${name} to the relay` : `Finished copying ${name} to the relay`) : `Copied ${name} to the relay as ${to}`;
    EX.note = what + (open && at ? ' and opened it for everyone at this circle' : '')
      + (n ? `, but ${n} file${n > 1 ? 's' : ''} could not be copied: ${failed.slice(0, 3).join('; ')}${n > 3 ? '...' : ''}.` + (at && to === name ? ` Not opened here: press ${name} again to copy the rest.` : at ? ' Not opened here.' : '')
        : open ? (at ? '.' : ': it is yours to change and save.') : '. Pick it above to open it.');
    EX.noteC = n ? 'amber' : 'green';
    EX.noteAt = open ? to : null;
    sfxAct('ping', 'stage', 'centre', { gain: 0.6 });
  } catch (e) {
    EX.note = e.status === 401 ? AUTH_NOTE : e.status === 403 ? 'This relay takes no uploads (it runs with --scenes-readonly).' : `${name} could not be copied: ${e.message}`;
    EX.noteC = 'red'; EX.noteAt = null;
  } finally { EX.own = { name: EX.to, until: performance.now() + 3000 }; EX.busy = ''; EX.to = ''; EX.path = ''; dirty(true); }
}
// the Scene pane's Examples (page and headset)
function exBlocks(B) {
  if (!EX.list || !EX.list.length) return;
  const here = exHere(), st = atStation(), can = exCan(), lock = st && editLocked(), why = exWhy();
  B.push({ label: 'Examples (they come with the app)', p: st ? 'At a circle the scene is for everyone here: an example opens from the relay, its copy there' + (can ? ' (the first press copies it there).' : '.')
    : here ? 'An example is open, read only: what you change stays on this device (Download layout.json keeps it).' : 'Scenes to try. Open one as it is, read only' + (can ? ', or copy it to the relay to make it yours.' : '.'), c: 'faint' });
  const parts = [];
  for (const s of EX.list) {
    const rel = st && exOnRelay(s.name), part = st && !rel ? exPart(s.name) : '', open = (here || rel) && STU.scene === s.name;
    if (part && EX.busy !== s.name) parts.push([s.name, part]);
    B.push({ row: [{ id: 'exopen:' + s.name, label: EX.busy === s.name && st && !rel ? 'Copying...' : part === 'busy' ? 'Being copied...' : (open ? '✓ ' : '') + s.name, act: 'exopen', v: s.name, on: open,
      dis: !!EX.busy || (st && (lock || open || part === 'busy' || (!rel && !can))) },
      { id: 'excopy:' + s.name, label: EX.busy === s.name ? 'Copying...' : 'Copy to the relay', act: 'excopy', v: s.name, dis: !can || !!EX.busy || lock, primary: can && here && open }] });
  }
  if (st && lock) B.push({ p: 'This circle\'s story is locked: unlock it (Lock this story) to change its scene.', c: 'amber' });
  else if (st && !can && why && EX.list.some(s => !exOnRelay(s.name))) B.push({ p: `An example cannot open at this circle: it has to be on the relay first, and ${why}.`, c: 'amber' });
  if (st && !lock) for (const [name, part] of parts) {
    if (part === 'busy') B.push({ p: `${name} is being copied to the relay: it can open here once all of it is there.`, c: 'muted' });
    else if (can) B.push({ p: `The relay's ${name} is not all there (a copy that broke off): pressing it copies the rest and opens it here.`, c: 'muted' });
  }
  if (here && EX.prev) B.push({ row: [{ id: 'exback', label: 'Back to your scenes', act: 'exback', dis: !!EX.busy }] });
  if (EX.busy) B.push({ p: `Copying ${EX.busy}: ${EX.done} of ${EX.of} files` + (EX.path ? ` (${EX.path}${EX.p > 0 && EX.p < 1 ? ', ' + Math.round(EX.p * 100) + ' %' : ''})` : '') + '.', c: 'muted' });
  else if (EX.note) B.push({ p: EX.note, c: EX.noteC });
}
const exSig = () => [EX.list ? EX.list.length : -1, EX.busy, EX.done, EX.of, EX.path, Math.round(EX.p * 20), EX.note, !!EX.prev, exHere(), exCan(), atStation(), exWhy(), EX.list ? EX.list.map(s => +exOnRelay(s.name) + exPart(s.name)).join('') : ''].join(',');
// for tests (STUDIO.examples): the list, what is open, a copy under way or its note, and (parts) the examples' scenes on
// the relay that are not whole: 'busy' or 'broken'
const exState = () => ({ list: EX.list ? EX.list.map(s => s.name) : null, here: exHere(), folder: OPT.examples, busy: EX.busy, done: EX.done, of: EX.of, note: EX.note, prev: !!EX.prev, can: exCan(), at: atStation(), why: exWhy(), relay: EX.list ? EX.list.filter(s => exOnRelay(s.name)).map(s => s.name) : [],
  parts: Object.fromEntries((EX.list || []).map(s => [s.name, exPart(s.name)]).filter(x => x[1])) });
