// ======================================================== FEWER TRIANGLES ==
// An object's card, page and headset alike (tools/studio/SPEC.md, "Fewer triangles" and "Change texture"; the owner, 6
// November 2026: "models need to be way less triangles", "a percentage ... adjustable per model with a preview", "20
// percent by default for everything", "preview in ar/vr would really be helpful", and "a change texture button on models
// placed in the scene").
// Fewer triangles: a share of its triangles kept (2 to 100 %, 20 % to start), shown at once in place on this device only
// (the object's own model given the lighter geometry by the converter's reduce; nothing shared until saved; Cancel puts it
// back); Save makes models/<name>.glb as Convert to GLB does (made again from the original a GLB stands for, when the
// scene has it, else from itself, the old one kept under originals/; every object of that file switched where it stands,
// one Undo step, for everyone at a station). The share is of what Save makes it from, so a model made too light comes
// back up from its original; the preview shows at most what the model placed has.
// Change texture: a material, a slot and a picture of the scene (or, on a page, one from this computer), shown at once on
// this device; Save bakes it into the model's GLB (texGo: asset.extras.studio.tex records it, objects switched where they
// stand); Cancel puts it back. Both save from a headset too, with a relay that takes uploads. Never in the layout or
// collab.state(): what is shared is the switch to the GLB, as for Convert to GLB.
const FT_DEFAULT = 0.2, FT_PICKS = [0.1, 0.2, 0.5];
const FT = { id: '', keep: FT_DEFAULT, pv: null, busy: false, gen: 0, t: 0, note: '', noteC: 'muted', saving: false, after: 0 };
const CT = { id: '', mat: 0, slot: 'map', pic: null, tex: null, saved: null, busy: false, gen: 0, note: '', noteC: 'muted', page: 0, saving: false, after: 0, light: '', model: null };
const CT_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];
const pct = v => (v * 100 >= 10 || v === 0 ? Math.round(v * 100) : +(v * 100).toPrecision(2)) + ' %';
// an object these work on: a model of the scene, in, editing on (never a visitor's kiosk)
const canLite = it => !!(it && it.kind === 'o' && editOn() && !OPT.visit && it.model && it.E && it.E.state === 'ready' && it.E.info && STU.fileMap.has(it.rec.file) && MODEL_EXT.includes(extOf(it.rec.file)));
// why Save cannot write now ('' it can): another conversion under way, or a headset with no relay to write to
const liteWhy = () => (CV.busy ? 'A model is being converted: a moment.' : XR.on && !canUpload() ? 'Saving from a headset needs a relay that takes uploads (on a page the GLB is downloaded).' : '');
// what Save makes it from: the original a GLB was made from, when the scene still has it (into that GLB), else the file
// itself (a GLB in models/ made again where it is; anything else as Convert to GLB: models/<name>.glb); n0: the
// triangles of what it is made from, the share's base; cur: the model placed
function liteSrc(it) {
  const f = it.rec.file, E = it.E, rec = extOf(f) === 'glb' ? glbRec(f) || E.record || null : null, cur = E.info.tris;
  if (rec && rec.from && rec.from !== f && STU.fileMap.has(rec.from) && MODEL_EXT.includes(extOf(rec.from))) return { src: rec.from, into: f, n0: rec.tris ? rec.tris.from : cur, cur, rec };
  return { src: f, into: extOf(f) === 'glb' && /^models\//i.test(f) ? f : '', n0: cur, cur, rec };
}

// ---- Fewer triangles: the card's part
function ftBlocks(it, B) {
  if (!canLite(it)) return;
  const b = liteSrc(it), busy = !!CV.busy;
  if (FT.id !== it.id) {
    B.push({ label: 'Triangles', row: [{ id: 'ft:open', label: 'Fewer triangles...', act: 'ft:open', v: it.id, dis: busy || FT.saving }] },
      { p: `${fmt(b.cur)} triangles` + (b.rec && b.rec.tris && b.src !== it.rec.file ? ` (${pct(b.rec.tris.keep)} of the ${fmt(b.rec.tris.from)} in ${baseName(b.src)})` : '') + '. Fewer make it lighter for a headset: pick a share and see it here before you save it.', c: 'faint' });
    return;
  }
  const k = FT.keep, T = Math.round(b.n0 * k), pv = FT.pv, sv = FT.saving;
  B.push({ page: true, label: 'Fewer triangles: the share kept', range: { id: 'stuRangeFT', act: 'ft:set', min: 2, max: 100, value: Math.round(k * 100), out: pct(k), dis: sv } },
    { xr: true, label: `Fewer triangles: ${pct(k)} kept`, row: [{ id: 'ft:-', label: '− 5 %', act: 'ft:step', v: -0.05, dis: sv || k <= CONV.KEEP_MIN }, { id: 'ft:+', label: '+ 5 %', act: 'ft:step', v: 0.05, dis: sv || k >= 1 }]
      .concat(FT_PICKS.map(v => ({ id: 'ft:' + Math.round(v * 100), label: pct(v), act: 'ft:set', v: Math.round(v * 100), on: Math.round(k * 100) === Math.round(v * 100), dis: sv }))) },
    { p: `${b.src !== it.rec.file ? baseName(b.src) + ' has' : 'It has'} ${fmt(b.n0)} triangles: about ${fmt(T)} kept.`, c: 'muted' });
  if (FT.busy) B.push({ p: 'Working out the preview...', c: 'faint' });
  else if (pv) {
    if (pv.k >= 0.995 && T > b.cur * 1.005) B.push({ p: `The model here has only ${fmt(b.cur)}, so the preview shows it as it is: Save makes it again from ${baseName(b.src)} with about ${fmt(T)}.`, c: 'amber' });
    else if (pv.k < 0.995 && pv.to >= pv.from * 0.98) B.push({ p: 'Its parts have too few triangles to come down further: it stays as it is.', c: 'amber' });
    else B.push({ p: pv.k >= 0.995 ? (k >= 0.995 ? 'All its triangles: shown as it is.' : 'It has about that many already: shown as it is.') : `Shown here with ${fmt(pv.to)} triangles, on this device only: look at it close up before you save it.`, c: 'green' });
    for (const n of pv.notes.slice(1)) B.push({ p: n.charAt(0).toUpperCase() + n.slice(1) + '.', c: 'faint' });
  }
  if (FT.note) B.push({ p: FT.note, c: FT.noteC });
  const why = liteWhy();
  B.push({ row: [{ id: 'ft:save', label: sv ? 'Saving...' : 'Save', act: 'ft:save', primary: true, dis: !!why || FT.busy || sv }, { id: 'ft:cancel', label: 'Cancel', act: 'ft:cancel', dis: sv }] },
    { p: why || liteSaveWords(it, b, `with about ${fmt(T)} triangles`), c: why ? 'amber' : 'faint' });
  if (XR.on && CV.note && CV.item === it.id) B.push({ xr: true, p: CV.note, c: CV.noteC });
}
// what Save does, in words
function liteSaveWords(it, b, what) {
  if (!canUpload()) return `Save downloads ${stem(b.src)}.glb ${what}: put it in the scene's models/ folder.`;
  if (b.into && b.into !== b.src) return `Save makes ${b.into} again from ${baseName(b.src)} ${what}; every object placed from it shows the new one where it stands.`;
  if (b.into) return `Save makes ${b.into} again ${what} (the one it has now is kept in originals/); the objects stay where they stand.`;
  return `Save makes models/${stem(b.src)}.glb ${what} (textures at most ${fmt(maxTexNow())} px), and every object placed from ${baseName(b.src)} switches to it where it stands.`;
}
function ftOpen(id) {
  const it = STU.items.get(id);
  if (!canLite(it) || FT.saving) return;
  ctClose(); ftClose();
  const b = liteSrc(it);
  FT.id = id; FT.keep = b.rec && b.rec.tris && b.src !== it.rec.file ? Math.round(b.rec.tris.keep * 100) / 100 : FT_DEFAULT;
  ftPreview();
}
// a share asked: previewed at once (a slider let go), else a moment after the last change (a button pressed again)
function ftSet(v, now) {
  if (!FT.id || FT.saving) return;
  v = Math.min(1, Math.max(CONV.KEEP_MIN, Math.round(v * 100) / 100));
  const same = v === FT.keep;
  FT.keep = v; FT.note = '';
  unlater(FT.t); FT.t = 0;
  if (same && FT.pv && FT.pv.keep === v) { dirty(); return; }
  if (now) ftPreview(); else FT.t = later(() => { FT.t = 0; ftPreview(); }, 350);
  dirty();
}
// the preview: the object's own model given the lighter geometries (the converter's reduce on its file's model, which
// stays as loaded: the other objects of that file keep theirs)
async function ftPreview() {
  const it = STU.items.get(FT.id);
  if (!it || !it.model || !it.E || !it.E.root) return;
  const gen = ++FT.gen, b = liteSrc(it), keep = FT.keep, k = Math.min(1, Math.round(b.n0 * keep) / Math.max(1, b.cur));
  ftUnswap(); ftDispose();
  if (k >= 0.995) { FT.pv = { keep, k: 1, from: b.cur, to: b.cur, geos: null, sw: [], notes: [], model: it.model }; FT.busy = false; dirty(true); return; }
  FT.busy = true; FT.note = ''; dirty(true);
  await new Promise(r => later(r, 40));   // (the note shows before the work holds the page)
  if (gen !== FT.gen) return;
  try {
    const r = await CONV.reduce(it.E.root, k);
    if (gen !== FT.gen || FT.id !== it.id || !it.model) { for (const g of r.geos.values()) g.dispose(); return; }
    FT.pv = { keep, k, from: r.from, to: r.to, geos: r.geos, sw: [], notes: r.notes, ms: r.ms, model: it.model };
    for (const m of it.model.meshes) { const g = r.geos.get(m.geometry); if (g) { FT.pv.sw.push([m, m.geometry]); m.geometry = g; } }
    sfxAct('step', 'stage', 'centre', { gain: 0.4 });
  } catch (e) { if (gen === FT.gen) { FT.note = 'The preview could not be made: ' + e.message; FT.noteC = 'red'; } }
  finally { if (gen === FT.gen) FT.busy = false; dirty(true); }
}
const ftUnswap = () => { if (FT.pv) for (const [m, g] of FT.pv.sw) if (m.geometry !== g) m.geometry = g; };
const ftDispose = () => { if (FT.pv && FT.pv.geos) for (const g of FT.pv.geos.values()) g.dispose(); if (FT.pv) FT.pv.geos = null; FT.pv = null; };
function ftClose() {
  FT.gen++; unlater(FT.t); FT.t = 0;
  ftUnswap(); ftDispose();
  FT.id = ''; FT.busy = false; FT.note = ''; FT.after = 0;
  dirty(true);
}
// Save: the GLB made with that share (convertFile, as Convert to GLB; through the relay or straight into R2, else
// downloaded on a page); the preview stays until the object's model is built again from it
async function ftSave() {
  const it = STU.items.get(FT.id);
  if (!canLite(it) || FT.saving || FT.busy || liteWhy()) return;
  const b = liteSrc(it), keep = FT.keep, up = canUpload();
  FT.saving = true; FT.note = ''; CV.item = it.id; dirty(true);
  let ok = false;
  try { ok = await convertFile(b.src, { into: b.into, keep: keep < 0.995 ? keep : 0, any: true, label: `Making ${baseName(b.into || b.src)} lighter` }); } finally { FT.saving = false; }
  if (ok && FT.id === it.id) { if (up) FT.after = Date.now(); else ftClose(); }
  dirty(true);
}

// ---- Change texture: the card's part
// the model's materials with texture coordinates (CONV.matsOf on its file's model: the order E.mats has), each with the
// pictures in its slots by name
function ctMats(it) {
  const E = it.E;
  if (!E || !E.root) return [];
  if (E.ctMemo && E.ctMemo[0] === E.root) return E.ctMemo[1];
  const L = CONV.matsOf(E.root).map((e, i) => ({ e, i, key: e.key, name: e.name, pics: Object.fromEntries(CT_SLOTS.filter(k => e.m[k] && e.m[k].isTexture).map(k => [k, texName(e.m[k])])), uv: e.uv })).filter(x => x.uv);
  E.ctMemo = [E.root, L];
  return L;
}
const texName = t => t.name || (t.image && typeof t.image.src === 'string' && !/^(blob|data):/i.test(t.image.src) ? (() => { try { return decodeURIComponent(baseName(t.image.src.split(/[?#]/)[0])); } catch (e) { return baseName(t.image.src); } })() : '') || 'inside the file';
// the object's own materials for one of its file's (its clone's, libClone: the same order of meshes), lit and as scanned
function ctTargets(it, x) {
  const rm = [], out = [];
  it.E.root.traverse(n => { if (n.material) rm.push(n); });
  rm.forEach((n, i) => {
    const c = it.model.meshes[i];
    if (!c) return;
    const lit = [].concat(c.userData.lit || []), scan = [].concat(c.userData.scan || []);
    [].concat(n.material).forEach((m, j) => { if (m === x.e.m) { if (lit[j]) out.push({ mat: lit[j], scan: false, mesh: c }); if (scan[j]) out.push({ mat: scan[j], scan: true, mesh: c }); } });
  });
  return out;
}
function ctBlocks(it, B) {
  if (!canLite(it)) return;
  const ms = ctMats(it);
  if (!ms.length) return;   // (no texture coordinates: its textures' lines say so)
  if (CT.id !== it.id) {
    B.push({ label: 'Pictures', row: [{ id: 'ct:open', label: 'Change texture...', act: 'ct:open', v: it.id, dis: !!CV.busy || CT.saving }] },
      { p: 'Change texture: put another picture of the scene in one of its materials\' slots, see it here, then save it into the model.', c: 'faint' });
    return;
  }
  const m = ms[CT.mat] || ms[0], cur = m.pics[CT.slot], sv = CT.saving, colourFirst = (a, b) => CT_SLOTS.indexOf(a[0]) - CT_SLOTS.indexOf(b[0]);
  B.push({ label: `Change texture: its material${ms.length > 1 ? 's' : ''}`, list: ms.map((x, i) => ({ id: 'ct:mat:' + i, label: matLabel(x), sub: Object.entries(x.pics).sort(colourFirst).map(([k, n]) => `${SLOT_NAME[k]}: ${n}`).join(' · ') || 'no pictures', act: 'ct:mat', v: i, on: x === m, dis: sv })) },
    { label: 'Slot', row: CT_SLOTS.map(k => ({ id: 'ct:slot:' + k, label: SLOT_NAME[k] + (m.pics[k] ? ' •' : ''), act: 'ct:slot', v: k, on: CT.slot === k, dis: sv })) },
    { kv: [['Now', cur || 'none'], ['New', CT.pic ? CT.pic.name + (CT.busy ? ' (reading it...)' : '') : 'pick a picture below']] });
  // the scene's pictures, likeliest first (by the picture it has, else the material's or the model's name); a page lists
  // them all and offers one from this computer, a headset eight at a time
  const pics = CONV.texRank(cur && cur !== 'inside the file' ? cur : m.name || stem(it.rec.file), scenePictures(), { dir: dirOf(it.E.path) }, 1000);
  const row = p => ({ id: 'ct:pic:' + p, label: baseName(p), sub: (dirOf(p) || 'the scene\'s top') + ' · ' + SLOT_NAME[CONV.slotOf(p)].toLowerCase(), act: 'ct:pic', v: p, on: !!(CT.pic && CT.pic.path === p), dis: sv || CT.busy });
  const per = 8, pages = Math.max(1, Math.ceil(pics.length / per)), pg = Math.min(CT.page, pages - 1);
  if (!pics.length) B.push({ p: 'The scene has no pictures: put some in its folder' + (XR.on ? '' : ', or choose one from this computer') + '.', c: 'faint' });
  else B.push({ page: true, label: `The scene's pictures (${pics.length})`, list: pics.map(row) }, { xr: true, label: `The scene's pictures (${pics.length})`, list: pics.slice(pg * per, pg * per + per).map(row) });
  if (pages > 1) B.push({ xr: true, label: `${pg * per + 1} to ${Math.min(pics.length, pg * per + per)} of ${pics.length}`, row: [{ id: 'ct:pg:-', label: '◂ Previous', act: 'ct:page', v: -1, dis: pg <= 0 }, { id: 'ct:pg:+', label: 'Next ▸', act: 'ct:page', v: 1, dis: pg >= pages - 1 }] });
  B.push({ page: true, row: [{ id: 'ct:file', label: 'Choose a picture...', act: 'ct:file', dis: sv || CT.busy }] });
  if (CT.note) B.push({ p: CT.note, c: CT.noteC });
  if (CT.saved && CT.saved.length) {
    B.push({ p: `${CT.pic.name} shown as the ${SLOT_NAME[CT.slot].toLowerCase()} picture of ${matLabel(m)}, on this device only.`, c: 'green' });
    if (['roughnessMap', 'metalnessMap'].includes(CT.slot) && !CT.saved.some(x => x.mat.isMeshStandardMaterial)) B.push({ p: 'Its material shows no roughness or metalness here: they show once it is saved (a GLB\'s material).', c: 'faint' });
  }
  const why = liteWhy();
  B.push({ row: [{ id: 'ct:save', label: sv ? 'Saving...' : 'Save', act: 'ct:save', primary: true, dis: !!why || !CT.tex || CT.busy || sv }, { id: 'ct:cancel', label: 'Cancel', act: 'ct:cancel', dis: sv }] },
    { p: why || liteSaveWords(it, liteSrc(it), 'with this picture in it'), c: why ? 'amber' : 'faint' });
  if (XR.on && CV.note && CV.item === it.id) B.push({ xr: true, p: CV.note, c: CV.noteC });
}
function ctOpen(id) {
  const it = STU.items.get(id);
  if (!canLite(it) || CT.saving || !ctMats(it).length) return;
  ftClose(); ctClose();
  const ms = ctMats(it);
  CT.id = id; CT.mat = Math.max(0, ms.findIndex(x => x.pics.map)); CT.slot = 'map'; CT.pic = null; CT.page = 0; CT.note = '';
  dirty(true);
}
// a picture picked (a path of the scene, or a file from this computer): read, and shown at once
async function ctPick(path, file) {
  const it = STU.items.get(CT.id);
  if (!canLite(it) || CT.saving) return;
  const gen = ++CT.gen, name = file ? file.name : baseName(path);
  CT.pic = { path: path || '', file: file || null, name }; CT.busy = true; CT.note = ''; dirty(true);
  let url = '';
  try {
    url = file ? URL.createObjectURL(file) : fileUrl(path, true);
    const img = await CONV.picture(url, { max: maxTexNow(), ext: extOf(name) });
    if (gen !== CT.gen || CT.id !== it.id || !it.model) return;
    const t = new THREE.Texture(img), old = CT.tex;
    t.name = name; t.flipY = !['glb', 'gltf'].includes(extOf(it.rec.file)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.LinearEncoding; t.needsUpdate = true;
    ctUnshow(); if (old) old.dispose();
    CT.tex = t; ctShow(it);
    sfxAct('pick', 'stage', 'centre', { gain: 0.5 });
  } catch (e) { if (gen === CT.gen) { CT.note = `${name} could not be read: ${e.message}.`; CT.noteC = 'red'; CT.pic = null; } }
  finally { if (file && url) URL.revokeObjectURL(url); if (gen === CT.gen) CT.busy = false; dirty(true); }
}
// the picture on the object's own materials (what each had kept, to put back)
function ctShow(it) {
  const m = ctMats(it)[CT.mat];
  if (!m || !CT.tex || !it.model) return;
  const slot = CT.slot, saved = [];
  for (const x of ctTargets(it, m)) {
    if (x.scan && slot !== 'map') continue;   // (as scanned shows only its colour picture)
    const mt = x.mat, k = { mat: mt, slot, was: mt[slot] || null, r: mt.roughness, me: mt.metalness, em: mt.emissive ? mt.emissive.clone() : null, tr: mt.transparent, bt: mt.userData.base ? mt.userData.base.t : undefined };
    mt[slot] = CT.tex;
    if (slot === 'aoMap') { const g = x.mesh.geometry; if (g && g.attributes.uv && !g.attributes.uv2) g.setAttribute('uv2', g.attributes.uv); }
    if (slot === 'emissiveMap' && mt.emissive && mt.emissive.r + mt.emissive.g + mt.emissive.b === 0) mt.emissive.setRGB(1, 1, 1);
    if (slot === 'alphaMap') { mt.transparent = true; if (mt.userData.base) mt.userData.base.t = true; }
    if (slot === 'roughnessMap' && 'roughness' in mt) mt.roughness = 1;   // (the picture says how rough: its factor multiplies it)
    if (slot === 'metalnessMap' && 'metalness' in mt) mt.metalness = 1;
    mt.needsUpdate = true;
    saved.push(k);
  }
  CT.saved = saved; CT.light = it.light; CT.model = it.model; it.aSet = -1;
}
function ctUnshow() {
  for (const k of CT.saved || []) {
    const mt = k.mat;
    mt[k.slot] = k.was;
    if ('roughness' in mt) mt.roughness = k.r;
    if ('metalness' in mt) mt.metalness = k.me;
    if (k.em && mt.emissive) mt.emissive.copy(k.em);
    mt.transparent = k.tr;
    if (mt.userData.base && k.bt !== undefined) mt.userData.base.t = k.bt;
    mt.needsUpdate = true;
  }
  CT.saved = null;
  const it = STU.items.get(CT.id);
  if (it) it.aSet = -1;
}
function ctClose() {
  CT.gen++;
  ctUnshow();
  if (CT.tex) CT.tex.dispose();
  Object.assign(CT, { id: '', tex: null, pic: null, busy: false, note: '', page: 0, after: 0, model: null });
  dirty(true);
}
function ctAgain() { const it = STU.items.get(CT.id); ctUnshow(); if (it && CT.tex) ctShow(it); }
// Save: the picture baked into the model's GLB (texGo, as Add a texture: a picture from this computer goes to originals/
// first; a GLB made from an original still in the scene made again from it)
async function ctSave() {
  const it = STU.items.get(CT.id), m = it && ctMats(it)[CT.mat];
  if (!canLite(it) || !m || !CT.pic || !CT.tex || CT.busy || CT.saving || liteWhy()) return;
  const em = (it.E.mats || [])[m.i] || { key: m.key, name: m.name, meshes: [] }, up = canUpload();
  CT.saving = true; CT.note = ''; CV.item = it.id; dirty(true);
  let ok = false;
  try { ok = await texGo(it.id, [{ name: '', mat: em.key, mname: em.name, meshes: em.meshes || [], slot: CT.slot, from: CT.pic.path || '', file: CT.pic.file || undefined }], { any: true }); } finally { CT.saving = false; }
  if (ok && CT.id === it.id) { if (up) CT.after = Date.now(); else ctClose(); }
  dirty(true);
}

// ---- each frame: a preview ends with its object (gone, not selected, editing off), and follows its model when that is
// built again (a changed file; after Save, the GLB it was saved into: then it is done)
function liteStep() {
  if (FT.id) {
    const it = STU.items.get(FT.id);
    if (!FT.saving && (!it || STU.sel !== FT.id || !editOn() || (FT.after && Date.now() - FT.after > 30000))) ftClose();
    else if (it && FT.pv && FT.pv.model !== it.model) {
      ftUnswap(); ftDispose();   // (its geometries were on the model that went)
      if (FT.after) ftClose(); else if (it.model) ftPreview();
    }
  }
  if (CT.id) {
    const it = STU.items.get(CT.id);
    if (!CT.saving && (!it || STU.sel !== CT.id || !editOn() || (CT.after && Date.now() - CT.after > 30000))) ctClose();
    else if (it && CT.model !== it.model) { CT.saved = null; if (CT.after || !it.model) ctClose(); else { CT.model = it.model; ctAgain(); } }
    else if (it && CT.saved && CT.light !== it.light) ctAgain();   // (lit or as scanned: the other materials)
  }
}
const liteSig = () => [FT.id, FT.keep, FT.busy, FT.saving, FT.note, FT.pv ? FT.pv.to : -1, CT.id, CT.mat, CT.slot, CT.pic ? CT.pic.name : '', CT.busy, CT.saving, CT.note, CT.page, !!(CT.saved && CT.saved.length)].join(',');
const LITE_ACT = {
  'ft:open': v => ftOpen(v),
  'ft:set': v => ftSet(+v / 100, false),
  'ft:step': v => ftSet(FT.keep + +v, false),
  'ft:save': () => ftSave(),
  'ft:cancel': () => ftClose(),
  'ct:open': v => ctOpen(v),
  'ct:mat': v => { if (CT.saving) return; ctUnshow(); CT.mat = +v; ctAgain(); },
  'ct:slot': v => { if (CT.saving || !CT_SLOTS.includes(v)) return; ctUnshow(); CT.slot = v; ctAgain(); },
  'ct:pic': v => { if (STU.fileMap.has(v)) ctPick(v); },
  'ct:file': () => { if (!XR.on && CT.id) chooseTex({ kind: 'ct', id: CT.id }); },
  'ct:page': v => { CT.page = Math.max(0, CT.page + +v); },
  'ct:save': () => ctSave(),
  'ct:cancel': () => ctClose(),
};
// a slider on a page (data-range): its words follow it as it moves; Fewer triangles previews a moment after it rests and
// at once when let go; an Upload row keeps its share
const LITE_RANGE = {
  'ft:set': (v, _, done) => { if (editOn()) ftSet(v / 100, done); },
  'up:keep': (v, ri, done) => { const r = UP.rows[+ri]; if (r && r.kind === 'model' && r.state === 'plan' && !UP.busy) { r.keep = Math.min(1, Math.max(CONV.KEEP_MIN, v / 100)); if (done) upChanged(); } },
};
function liteBind() {
  const ex = $('#explore');
  // (no drawing the pane again while a slider is held: it would take it from under the pointer)
  ex.addEventListener('pointerdown', ev => { if (ev.target && ev.target.matches && ev.target.matches('input[type="range"]')) X.sliding = true; });
  const up = () => { if (X.sliding) { X.sliding = false; dirty(); } };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  const go = (ev, done) => {
    const t = ev.target;
    if (!t || !t.dataset || !t.dataset.range) return;
    const o = t.parentNode && t.parentNode.querySelector('[data-range-out]');
    if (o) o.textContent = t.value + ' %';
    if (!OPT.visit && LITE_RANGE[t.dataset.range]) LITE_RANGE[t.dataset.range](+t.value, t.dataset.v, done);
  };
  ex.addEventListener('input', ev => go(ev, false));
  ex.addEventListener('change', ev => go(ev, true));
}

// ---- the Upload pane: each model's share (20 % to start), its triangles about (read from its bytes: CONV.triCount),
// and a picture of it with all its triangles and with the share kept, one row at a time
function liteRow(r, ri) {
  const can = r.state === 'plan' && !UP.busy, k = r.keep === undefined ? FT_DEFAULT : r.keep, n = r.tris, pv = r.pv;
  const busy = !!(UP.pvRow && UP.pvRow.pv && UP.pvRow.pv.busy);
  let h = `<span class="stu-range lite"><label for="stuRangeUp${ri}">Triangles kept</label><input type="range" id="stuRangeUp${ri}" data-range="up:keep" data-v="${ri}" min="2" max="100" step="1" value="${Math.round(k * 100)}"${can ? '' : ' disabled'}><b data-range-out>${Math.round(k * 100)} %</b>` +
    `<button class="btn" type="button" data-act="up:pv" data-v="${ri}"${can && !busy ? '' : ' disabled'}>${pv && pv.busy ? 'Working...' : 'Preview'}</button></span>`;
  h += `<small class="x">${n ? `About ${fmt(Math.round(n * (k < 0.995 ? k : 1)))} of its ${fmt(n)} triangles${k >= 0.995 ? ' (all of them)' : ''}.` : 'Its triangles are counted when it is read (Preview).'}</small>`;
  if (pv && pv.img) h += `<img class="stu-pv" src="${pv.img}" alt="${esc(`${r.main.name}: all its triangles, and ${Math.round(pv.keep * 100)} % kept`)}"><small class="x">${esc(pv.words)}${pv.keep !== k ? ' (a preview of ' + Math.round(pv.keep * 100) + ' %: press Preview again)' : ''}</small>`;
  else if (pv && pv.note) h += `<small class="n">${esc(pv.note)}</small>`;
  return h;
}
async function upPreview(ri) {
  const r = UP.rows[ri];
  if (!r || r.kind !== 'model' || UP.busy || r.state !== 'plan' || (UP.pvRow && UP.pvRow.pv && UP.pvRow.pv.busy)) return;
  for (const x of UP.rows) if (x !== r) x.pv = null;   // (one at a time: a picture each is enough memory)
  const keep = r.keep === undefined ? FT_DEFAULT : r.keep, gen = UP.gen;
  r.pv = { busy: true, keep }; UP.pvRow = r; upChanged();
  let m = null;
  try {
    await new Promise(res => later(res, 30));
    m = (await upLoad(r)).m;
    if (gen !== UP.gen) return;
    // (stood up as the studio will stand it: its guess's turn; framed on what it is)
    const wrap = new THREE.Group(), size = new THREE.Box3().setFromObject(m.root).getSize(new THREE.Vector3()), g = CONV.guessFor(m.guess, size);
    wrap.quaternion.fromArray(g.q); wrap.add(m.root);
    const before = thumbOf(wrap, 240, 180), red = keep < 0.995 ? await CONV.reduce(m.root, keep, { inPlace: true }) : null;
    const n = red ? red.from : CONV.stats(m.root, []).tris, to = red ? red.to : n, after = red ? thumbOf(wrap, 240, 180) : before;
    r.tris = n;
    r.pv = { keep, img: pairPic(before, after, `All: ${fmt(n)}`, `${Math.round(keep * 100)} %: ${fmt(to)}`), words: red ? `${fmt(n)} triangles became ${fmt(to)}` + (red.notes.length > 1 ? ': ' + red.notes.slice(1).join('; ') : '') + '.' : `${fmt(n)} triangles, all kept.` };
  } catch (e) { r.pv = { note: 'No preview: ' + (e.message || e) }; }
  finally { if (m) CONV.disposeTree(m.root); r.main.buf = null; upChanged(); }
}
// two pictures side by side with their words
function pairPic(a, b, la, lb) {
  const c = document.createElement('canvas'), w = a.width, h = a.height;
  c.width = w * 2 + 4; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#04070d'; x.fillRect(0, 0, c.width, h);
  x.drawImage(a, 0, 0); x.drawImage(b, w + 4, 0);
  x.font = '600 13px B612, "Segoe UI", Arial, sans-serif'; x.textBaseline = 'top';
  for (const [t, ox] of [[la, 0], [lb, w + 4]]) { x.fillStyle = 'rgba(4,7,13,0.75)'; x.fillRect(ox + 4, 4, Math.ceil(x.measureText(t).width) + 10, 20); x.fillStyle = '#e7eef8'; x.fillText(t, ox + 9, 7); }
  return c.toDataURL('image/png');
}
// a small picture of a model, drawn by the page's renderer into a target of its own (the scene's frame untouched): a
// three-quarter view, lit evenly, the edges of its triangles drawn faintly over it (so how many shows)
function thumbOf(root, w, h, wired = true) {
  const R = GL.renderer, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, w / h, 0.001, 1e5), rt = new THREE.WebGLRenderTarget(w, h);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x404858, 1.1));
  const d = new THREE.DirectionalLight(0xffffff, 0.7); d.position.set(1, 2, 1.5); sc.add(d);
  const parent = root.parent;
  sc.add(root); root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3()), rad = Math.max(1e-4, box.getSize(new THREE.Vector3()).length() / 2);
  cam.position.copy(c).add(new THREE.Vector3(0.8, 0.55, 1).normalize().multiplyScalar(rad * 2.7)); cam.near = rad / 100; cam.far = rad * 20; cam.lookAt(c); cam.updateProjectionMatrix();
  const was = R.getRenderTarget(), xr = R.xr.enabled, ac = R.autoClear, cc = R.getClearColor(new THREE.Color()), ca = R.getClearAlpha();
  const wire = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, wireframe: true, transparent: true, opacity: 0.25 }), px = new Uint8Array(w * h * 4);
  try {
    R.xr.enabled = false; R.setRenderTarget(rt); R.setClearColor(0x101a2a, 1); R.clear(); R.render(sc, cam);
    if (wired) { R.autoClear = false; sc.overrideMaterial = wire; R.render(sc, cam); sc.overrideMaterial = null; }
    R.readRenderTargetPixels(rt, 0, 0, w, h, px);
  } finally {
    R.setRenderTarget(was); R.xr.enabled = xr; R.autoClear = ac; R.setClearColor(cc, ca);
    sc.remove(root); if (parent) parent.add(root);
    rt.dispose(); wire.dispose();
  }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const x = cv.getContext('2d'), im = x.createImageData(w, h);
  for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);   // (a target is read bottom up)
  x.putImageData(im, 0, 0);
  return cv;
}
// for tests and the console: where both stand, and how many triangles an object's model draws now
const liteState = () => ({
  ft: { id: FT.id, keep: FT.keep, busy: FT.busy, saving: FT.saving, note: FT.note, after: !!FT.after, pv: FT.pv && { keep: FT.pv.keep, k: FT.pv.k, from: FT.pv.from, to: FT.pv.to, swapped: FT.pv.sw.length, ms: FT.pv.ms } },
  ct: { id: CT.id, mat: CT.mat, slot: CT.slot, pic: CT.pic && CT.pic.name, shown: !!(CT.saved && CT.saved.length), busy: CT.busy, saving: CT.saving, note: CT.note, after: !!CT.after },
});
const trisOf = id => { const it = STU.items.get(id); let n = 0; if (it && it.model) for (const m of it.model.meshes) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } return Math.round(n); };
