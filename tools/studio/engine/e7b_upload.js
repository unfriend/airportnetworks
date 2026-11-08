// ================================================================= UPLOAD ==
// GLB first (tools/studio/SPEC.md, "GLB first, and converting" and "The upload page"). What the studio makes goes into
// folders of the scene: models/ (GLB), sounds/ and originals/ (the files as they were given, so a model can be converted
// again). A GLB the converter wrote records what it was made from (asset.extras.studio): read from its head (a byte
// range) so the Add list shows the GLB and folds the original under Originals. Convert to GLB (an object's card, and
// Convert every model under Add) converts a model of the scene in this page and, with a relay that takes uploads, puts it
// in models/ and switches every object placed from the original to it where it stands (s' = s / b, q' = q * r^-1: one
// change, one Undo step); else it is downloaded. The Upload pane (pages only) takes files and folders dropped onto it,
// shows the plan (one row per thing it will make), then converts and uploads them: models to models/<name>.glb, sounds
// to sounds/ (mono: short ones WAV, long ones MP3 through the relay's ffmpeg), and everything given to originals/.

// ---------------------------------------------------------- GLB records --
const GLBREC = new Map();   // path -> { at, rec (null: none), p (a read under way) }
// a GLB's record: the object (from, s, q, at, scan), null (none), or undefined (not read yet: a read starts)
function glbRec(path) {
  const f = STU.fileMap.get(path);
  if (!f || extOf(path) !== 'glb') return undefined;
  const c = GLBREC.get(path);
  if (c && c.at === f.at) return c.p ? undefined : c.rec;
  if (SRC.held || STU.listing !== 'ok') return undefined;
  const e = { at: f.at, rec: null, p: null }, scene = STU.scene;
  GLBREC.set(path, e);
  e.p = glbHead(path).then(j => { e.rec = CONV.glbRecord(j); }, () => { /* none read: by its name */ })
    .then(() => { e.p = null; if (scene === STU.scene) { STU.libRev++; dirty(); } });
  return undefined;
}
// a GLB's JSON chunk, from its first bytes (a range: a scan's GLB is megabytes, its JSON a few KB)
async function glbHead(path) {
  const part = async (a, b) => {
    const r = await call(fileUrl(path), { headers: { Range: `bytes=${a}-${b}` }, cache: 'no-cache' });
    if (!r.body || !r.body.getReader) return new Uint8Array(await r.arrayBuffer()).subarray(r.status === 206 ? 0 : a);
    // (a server that sends the whole file anyway: read only as far as needed)
    const rd = r.body.getReader(), want = b - a + 1, from = r.status === 206 ? 0 : a, parts = [];
    let n = 0;
    while (n < from + want) { const { done, value } = await rd.read(); if (done) break; parts.push(value); n += value.length; }
    try { rd.cancel(); } catch (e) { /* done */ }
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out.subarray(from, from + want);
  };
  let u8 = await part(0, 65535);
  if (u8.length < 20) return null;
  const len = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(12, true);
  if (len > 8 << 20) return null;
  if (20 + len > u8.length) { const rest = await part(u8.length, 19 + len), all = new Uint8Array(20 + len); all.set(u8); all.set(rest, u8.length); u8 = all; }
  return CONV.glbJSON(u8.slice(0, 20 + len).buffer);
}
// the scene's models a GLB stands for: original path -> GLB path. A GLB's record names what it was made from; a GLB
// without one (or not read yet) stands for a model of the same base name. GLBs under originals/ stand for nothing
function glbFor() {
  const map = new Map(), glbs = STU.files.filter(f => extOf(f.path) === 'glb' && !inOriginals(f.path));
  for (const g of glbs) { const r = glbRec(g.path); if (r && r.from && r.from !== g.path && STU.fileMap.has(r.from)) map.set(r.from, g.path); }
  for (const g of glbs) {
    const r = glbRec(g.path);
    if (r && r.from) continue;
    const st = stem(g.path).toLowerCase();
    for (const f of STU.files) if (f.kind === 'model' && extOf(f.path) !== 'glb' && stem(f.path).toLowerCase() === st && !map.has(f.path)) map.set(f.path, g.path);
  }
  return map;
}
const inOriginals = p => /^originals\//i.test(p);
// what the scene's folders hold: models and sounds to place (models/, sounds/, anything outside originals/; an original a
// GLB stands for goes under Originals, with the GLB placed for it), and the Originals fold
function sceneLists() {
  const stands = glbFor(), models = [], sounds = [], orig = [];
  for (const f of STU.files) {
    const o = inOriginals(f.path);
    if (o || (f.kind === 'model' && stands.has(f.path))) orig.push(f);
    else if (f.kind === 'model') models.push(f);
    else if (f.kind === 'audio') sounds.push(f);
  }
  return { models, sounds, orig, stands };
}

// --------------------------------------------------------- Convert to GLB --
// A model of the scene converted in this page (the converter, engine/convert.js): fetched again and loaded afresh (the
// placed one is left alone), given the studio's guess, its textures at most 2,048 px (For Quest) or 4,096, written as a
// GLB, loaded back and checked. With a relay that takes uploads it goes to models/<base name>.glb (again for one made
// from this file before, else a free name) and every object placed from the original switches to it; else it is
// downloaded. A failure changes nothing. Pictures laid on by hand (o.tex: [{ name, mat, slot, from, url }], "Textures:
// found, added, converted" in tools/studio/SPEC.md) are baked in and recorded in the GLB (asset.extras.studio.tex), so
// converting the original again lays them on again; o.into: the GLB to write (an object's own: replaced where it is,
// the old one first kept under originals/ when it is made again from itself); o.label: the note's first words; o.keep: the
// share of its triangles kept (Fewer triangles: the converter's reduce; 0 or none, all); o.any: from a headset too
const CV = { busy: '', note: '', noteC: 'muted', done: [], all: null, item: '' };
// (any: Fewer triangles and Change texture, which write from a headset too; Convert to GLB and the texture buttons are a page's)
const canConvert = (p, any) => STU.fileMap.has(p) && MODEL_EXT.includes(extOf(p)) && editOn() && (any || !XR.on);
const canUpload = () => SRC.kind === 'relay' && SRC.upload && SRC.save && !SRC.held && !OPT.visit;
const maxTexNow = () => (UP.quest ? 2048 : 4096);
// (only the pictures chosen by hand, or by the Upload pane's own rungs, are laid on again: the ladder finds the rest)
const BY_HAND = ['chosen', 'only', 'stem'];
async function convertFile(path, o = {}) {
  if (!canConvert(path, o.any) || CV.busy) return false;
  const name = stem(path), scene = STU.scene, gen = STU.gen, lab = o.label || `Converting ${baseName(path)}`, self = o.into === path;
  CV.busy = path; CV.note = `${lab}: reading it...`; CV.noteC = 'muted'; dirty(true);
  let ok = false;
  try {
    // where it goes, and what was laid on before (the record of the GLB made from this file)
    let out = o.into || 'models/' + safeSeg(name) + '.glb', replace = !!o.into, prev = null;
    if (STU.fileMap.has(out)) {
      prev = glbRec(out) || (await glbHead(out).then(j => CONV.glbRecord(j), () => null));
      if (!o.into) { if (prev && prev.from === path) replace = true; else { out = freeName(out, p => STU.fileMap.has(p)); prev = null; } }
    }
    const keyT = x => (x.name ? 'n:' + x.name.toLowerCase() : 'm:' + x.mat + ':' + x.slot), tex = new Map();
    if (prev && !self) for (const x of prev.tex || []) if (BY_HAND.includes(x.how) && STU.fileMap.has(x.from)) tex.set(keyT(x), x);
    for (const x of o.tex || []) tex.set(keyT(x), Object.assign({ name: '', mat: '', slot: '', how: 'chosen' }, x));
    const byName = new Map([...tex.values()].filter(x => x.name).map(x => [x.name.toLowerCase(), x])), urlOf = x => x.url || fileUrl(x.from, true);
    const buf = await getBytes(fileUrl(path));
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '', base = sceneUrl(scene) + encPath(dir), found = new Map();
    await new Promise(r => later(r, 30));
    const url = u => {
      if (/^(blob|data):/i.test(u)) return u;
      let b = baseName(CONV.IM.psdBack(u.split(/[?#]/)[0]));
      try { b = decodeURIComponent(b); } catch (e) { /* as it is */ }
      const x = byName.get(b.toLowerCase());
      return x ? urlOf(x) : resolveUrl(u, base, dir, new Set(), found);
    };
    const m = await CONV.load({ ext: extOf(path), data: buf, base, name, maxTex: maxTexNow(), url });
    // a slot added on a GLB's material, laid on its original: that material found there by its meshes' names, else its
    // own name (the two need not have the same materials in the same order), the record then keyed as the original has it
    if (!self) {
      const ms = CONV.matsOf(m.root), again = new Map();
      for (const [k, x] of tex) {
        if (!x.name && ((x.meshes && x.meshes.length) || x.mname)) {
          const hit = ms.find(e => x.meshes && e.meshes.some(n => x.meshes.includes(n.name)) && (!x.mname || e.name === x.mname)) || ms.find(e => x.meshes && e.meshes.some(n => x.meshes.includes(n.name))) || (x.mname ? ms.find(e => e.name === x.mname) : null);
          if (hit) x.mat = hit.key;
          delete x.meshes; delete x.mname;
          again.delete(keyT(x)); again.set(keyT(x), x);
        } else again.set(k, x);
      }
      tex.clear();
      for (const [k, x] of again) tex.set(k, x);
    }
    // (its materials as the studio lists them, to find a trigger cube's material again in the GLB: e6i_tex.js)
    const mats0 = texMatsOf(m.root);
    // pictures laid on in slots: fetched, read and put on their materials (the GLB made again from itself has the earlier
    // ones in it already)
    const gltf = ['glb', 'gltf'].includes(extOf(path));
    for (const x of (self ? o.tex || [] : [...tex.values()]).filter(q => !q.name)) {
      CV.note = `${lab}: laying ${baseName(x.from)} on...`; dirty();
      const image = await CONV.picture(urlOf(x), { max: maxTexNow(), ext: extOf(x.from) });
      const r = CONV.addTextures(m.root, [{ mat: x.mat, slot: x.slot, image, name: baseName(x.from) }], { gltf });
      if (!r.done) throw new Error(r.why[0] || 'it has no material to lay it on');
    }
    // (made again from itself: the old one kept under originals/, and the new one says so)
    const keepOld = self && canUpload() && /^models\//i.test(path) ? freeName('originals/' + baseName(path), p => STU.fileMap.has(p)) : '';
    const recTex = self ? [...new Map([...((prev && prev.tex) || []), ...(o.tex || [])].map(x => [keyT(x), x])).values()] : [...[...found].filter(([n]) => !m.missing.includes(n)).map(([n, f]) => ({ name: n, mat: '', slot: '', from: f.path, how: f.how })), ...tex.values()];
    // (made again from its original into a GLB that was made lighter: as light again, unless a share is asked; made again
    // from itself, it is as light as it is)
    const keep = o.keep !== undefined ? o.keep : prev && prev.tris && !self && prev.from === path ? prev.tris.keep : 0;
    // (with its picture for the Add pane, drawn from the GLB as loaded back: e7e_pics.js)
    const r = await CONV.toGLB(m, { name, maxTex: maxTexNow(), from: keepOld || path, tex: recTex, keep, picture: pvShotSoon, step: l => { CV.note = `${lab}: ${l.toLowerCase()}...`; dirty(); } });
    CONV.disposeTree(m.root);
    STUDIO.lastGLB = { name: name + '.glb', glb: r.glb, record: r.record, ok: r.ok, why: r.why, notes: r.notes, before: r.before, after: r.after, picture: !!r.picture, mats0, mats: r.mats };
    const info = r.record && r.record.size ? { size: r.record.size, n: r.record.n } : null;
    if (gen !== STU.gen || GL.gone) return false;
    if (!r.ok) { CV.note = `${baseName(path)} was not converted (nothing changed): ${r.why}.`; CV.noteC = 'red'; return false; }
    const size = mb(r.glb.byteLength) + (r.reduced ? `, ${fmt(r.reduced.to)} of ${fmt(r.reduced.from)} triangles` : ''), lost = r.missing.length ? ` It lacks ${r.missing.join(', ')}.` : '';
    if (canUpload()) {
      if (keepOld) { CV.note = `${lab}: keeping the old one as ${keepOld}...`; dirty(); await upSend(fileApi(scene, keepOld, false), new Blob([buf], { type: 'model/gltf-binary' })); }
      CV.note = `${lab}: uploading ${out} (${size})...`; dirty();
      const j = await upSend(fileApi(scene, out, replace), new Blob([r.glb], { type: 'model/gltf-binary' }), p => { CV.note = `${lab}: uploading ${out} (${Math.round(p * 100)} %)...`; dirty(); });
      out = (j && j.path) || out;
      if (gen !== STU.gen) return false;
      await refreshFiles(new Set([out]));
      const f = STU.fileMap.get(out);
      GLBREC.set(out, { at: f ? f.at : 0, rec: CONV.glbRecord({ asset: { extras: { studio: r.record } } }), p: null });
      // (a recorded path kept as a file, turned into a new file first: e6j_voice.js; an object whose file could not be
      // turned is not switched, and the note says why)
      const pm = out === path ? null : await pathFilesTurned(path, r.record), n = out === path ? 0 : switchToGLB(path, out, r.record, texRemap(mats0, r.mats), pm), held = heldWords(pm, path, out);
      CV.note = `${baseName(path)} is now ${out} (${size}, textures at most ${fmt(maxTexNow())} px)` + (n ? `: ${n} object${n === 1 ? '' : 's'} switched to it where ${n === 1 ? 'it stands' : 'they stand'}.` : '.') + (keepOld ? ` The old one is ${keepOld}.` : '') + lost + (held ? ' ' + held : '');
      CV.noteC = held ? 'amber' : 'green';
      CV.done.push(out);
      // its picture, into the scene beside it (previews/<out>.jpg); a picture that could not go is kept for this page
      // only, and is never a reason the conversion failed
      if (r.picture) { try { await pvKeep(out, r.picture, info, gen); } catch (e) { /* Make pictures makes it again */ } }
    } else {
      saveFile(r.glb, name + '.glb', 'model/gltf-binary');
      CV.note = `${baseName(path)} converted (${size}) and downloaded as ${name}.glb: ` + (SRC.kind === 'relay' ? 'this relay does not take uploads; ' : '') + 'put it in the scene\'s models/ folder.' + lost;
      CV.noteC = 'green';
      CV.done.push(name + '.glb');
      // (its picture, for this page only, on the card of the model it was made from)
      if (r.picture) { try { await pvKeep(path, r.picture, info, gen); } catch (e) { /* none */ } }
    }
    ok = true;
    sfxAct('ping', 'stage', 'centre', { gain: 0.6 });
  } catch (e) {
    if (gen === STU.gen) { CV.note = `${baseName(path)} was not converted (nothing changed): ${e.status === 401 ? AUTH_NOTE : e.message}`; CV.noteC = 'red'; }
  } finally { CV.busy = ''; dirty(true); }
  return ok;
}
// A texture added to an object (its card): a picture of the scene, or one from this computer (into originals/ with a
// relay, else used from memory and the GLB downloaded), baked into the GLB at once. list: [{ name (a missing name) | mat
// and slot (a slot added), from, file }]. An object on a GLB made from an original still in the scene is made again from
// that original into the same GLB; a GLB that has none is made again from itself
async function texGo(id, list, o = {}) {
  const it = STU.items.get(id);
  if (!it || it.kind !== 'o' || CV.busy || !canConvert(it.rec.file, o.any)) return false;
  const file = it.rec.file, x0 = list[0], pic = x0.file ? x0.file.name : baseName(x0.from), lab = `Adding ${pic}`, mem = [], gen = STU.gen;
  CV.item = id;
  try {
    for (const x of list) {
      x.how = 'chosen';
      if (!x.file) continue;
      if (canUpload()) {
        const p = freeName('originals/' + safeSeg(x.file.name), q => STU.fileMap.has(q));
        CV.busy = file; CV.note = `${lab}: uploading it to ${p}...`; CV.noteC = 'muted'; dirty(true);
        const j = await upSend(fileApi(STU.scene, p, false), x.file);
        x.from = (j && j.path) || p;
        await refreshFiles(new Set([x.from]));
        CV.busy = '';
        // (the scene changed, editing went off or the story was locked meanwhile: the picture stays in originals/, said)
        if (gen !== STU.gen) return false;
        if (!canConvert(file, o.any)) { CV.note = `${pic} is in ${x.from}, but ${baseName(file)} was not converted: editing is off or this scene is locked. Use it from the card again.`; CV.noteC = 'amber'; dirty(true); return false; }
      } else { x.url = URL.createObjectURL(x.file); mem.push(x.url); x.from = 'originals/' + safeSeg(x.file.name); }
      delete x.file;
    }
    let src = file, into = '';
    if (extOf(file) === 'glb') {
      const r = glbRec(file) || (it.E && it.E.record);
      if (r && r.from && r.from !== file && STU.fileMap.has(r.from) && MODEL_EXT.includes(extOf(r.from))) { src = r.from; into = file; } else if (/^models\//i.test(file)) into = file;
    }
    return await convertFile(src, { tex: list, into, label: lab, any: o.any });
  } catch (e) {
    CV.busy = ''; CV.note = `${pic} was not added (nothing changed): ${e.status === 401 ? AUTH_NOTE : e.message}`; CV.noteC = 'red'; dirty(true);
    return false;
  } finally { for (const u of mem) later(() => URL.revokeObjectURL(u), 1000); }
}
// Convert every model (Add): each model to place that is not a GLB, one after another
async function convertAll() {
  if (CV.busy || CV.all) return;
  const list = sceneLists().models.filter(f => extOf(f.path) !== 'glb').map(f => f.path);
  CV.all = { i: 0, n: list.length, ok: 0 };
  try { for (const p of list) { CV.all.i++; if (await convertFile(p)) CV.all.ok++; if (!editOn()) break; } } finally {
    const a = CV.all;
    CV.all = null;
    if (a.n > 1) { CV.note = `Converted ${a.ok} of ${a.n} models.` + (a.ok < a.n ? ' ' + CV.note : ''); CV.noteC = a.ok === a.n ? 'green' : 'amber'; }
    dirty(true);
  }
}
// Every object placed from `orig` now placed from the GLB where it stands: the GLB holds the original turned by r and
// scaled by b (its record), so the object's own scale and turn become s / b and q * r^-1 (one change, one Undo step,
// for everyone at a station). A GLB with no record is taken as the studio's own guess for the original made into metres
// and Y up. A sound that follows such an object's whole model has its offset turned by r in the same change (o' = r o:
// the holder's turn is q r^-1, so where it sounds stays put); one on a bone keeps its offset (the GLB's bones stand where
// the original's did, and a name the loader tidied is still found). Its cut-outs likewise: middle and turn turned by r
// (p' = r p, q' = r q; sizes are metres, kept), so each hole stays where it was. The new scale is kept to 4 significant
// figures, so where s / b is not exact (b not a power of ten) the model is drawn k = s' b / s times its old size (within
// 5e-4): its cut-outs' middles and sizes and its sounds' offsets are scaled by k too, so they stay on the same part of it.
// A recorded path's keys are turned too (d' = r d, q' = r q r^-1: switchedRec), so it moves along the same path; one kept as
// a file was turned into a new file before (pmap, pathFilesTurned: e6j_voice.js), and an object whose file could not be
// (pmap gives why, a string) is left on its original, where it plays as before, its card saying why (it.swNote). A trigger
// cube's texture changes on such an object keep it (its id is the same); their materials are found again in the GLB when
// the conversion says how its materials came out (tmap, texRemap: e6i_tex.js), else they keep their index
function switchToGLB(orig, glb, rec, tmap, pmap) {
  if (!editOn()) return 0;
  const E = LIB.get(orig), g = rec || (E && E.guess) || { s: 1, q: [0, 0, 0, 1] };
  const all = [...STU.items.values()].filter(it => it.kind === 'o' && it.rec.file === orig), held = id => !!pmap && typeof pmap.get(id) === 'string';
  for (const it of all) it.swNote = held(it.id) ? `Not switched to ${glb}: ${pmap.get(it.id)}. It stays on ${baseName(orig)}, where it plays as before; Switch to the GLB tries again.` : '';
  const list = all.filter(it => !held(it.id));
  dirty(true);
  if (!list.length) return 0;
  change(() => {
    // (the sounds on its whole model, also those naming a bone its model here lacks, which follow the whole model too;
    // told before the objects switch, while their models are still the original's; a model not here: taken as on its bone)
    const ids = new Set(list.map(it => it.id)), r = new THREE.Quaternion().fromArray(g.q).normalize();
    const whole = f => { const ob = STU.items.get(f.rec.on); return !f.rec.bone || !!(ob && ob.model && !nodeOf(ob, f.rec.bone)); };
    const turn = [...STU.items.values()].filter(f => f.kind === 's' && ids.has(f.rec.on) && f.rec.o && whole(f));
    // (and their cut-outs, in the object's frame turned but not scaled: turned the same way, so each stays where it was)
    const cuts = [...STU.items.values()].filter(x => x.kind === 'x' && ids.has(x.rec.on));
    const bone = [...STU.items.values()].filter(f => f.kind === 's' && ids.has(f.rec.on) && f.rec.o && !turn.includes(f));
    const K = new Map(), s0 = new Map(list.map(it => [it.id, it.rec.s]));
    for (const it of list) { const ok = setRec(it.id, switchedRec(it.rec, glb, g, pmap && pmap.get(it.id))), k = ok ? it.rec.s * (g.s || 1) / s0.get(it.id) : 1; K.set(it.id, Math.abs(k - 1) > 1e-9 ? k : 1); }
    const kOf = id => K.get(id) || 1, keep = (v, a) => clamp(v, -a, a);
    for (const f of turn) setRec(f.id, { o: new THREE.Vector3().fromArray(f.rec.o).applyQuaternion(r).multiplyScalar(kOf(f.rec.on)).toArray().map(v => keep(v, 1000)) });
    for (const f of bone) if (kOf(f.rec.on) !== 1) setRec(f.id, { o: f.rec.o.map(v => keep(v * kOf(f.rec.on), 1000)) });
    for (const x of cuts) {
      const k = kOf(x.rec.on);
      setRec(x.id, { p: new THREE.Vector3().fromArray(x.rec.p).applyQuaternion(r).multiplyScalar(k).toArray().map(v => keep(v, 1000)), q: r.clone().multiply(new THREE.Quaternion().fromArray(x.rec.q)).toArray(), size: x.rec.size.map(v => clamp(v * k, 0.01, 50)) });
    }
    texSwitched(ids, tmap);   // (a trigger cube's texture changes on them, on the same materials in the GLB)
  });
  sfxAct('rise', 'stage', 'centre', { dur: 0.5, gain: 0.5 });
  return list.length;
}
const switchedRec = (r, glb, g, P) => {
  const ri = new THREE.Quaternion().fromArray(g.q).normalize().invert(), q = new THREE.Quaternion().fromArray(r.q).multiply(ri).normalize();
  // (a recorded path turned likewise, so it moves as before: e6f_path.js, pathTurned; one kept as a file, its new file: P)
  return Object.assign({ file: glb, s: r.s / (g.s || 1), q: q.toArray() }, r.path ? { path: P && typeof P === 'object' ? P : pathTurned(r.path, g.q) } : {});
};
// a file for this computer (the converted GLB without a relay; the Upload pane's outputs)
function saveFile(data, name, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  later(() => URL.revokeObjectURL(url), 60000);
}

// ------------------------------------------------------------- the relay --
// a scene's file, as the upload endpoint takes it (the relay's rules: relay/scenes.mjs, uploadPath)
const fileApi = (scene, p, replace) => `${SRC.base}/api/scenes/${encodeURIComponent(scene)}/file?path=${encodeURIComponent(p)}${replace ? '&replace=1' : ''}`;
const soundApi = (scene, p, replace) => `${SRC.base}/api/scenes/${encodeURIComponent(scene)}/sound?path=${encodeURIComponent(p)}${replace ? '&replace=1' : ''}`;
// one upload, with its progress (an XMLHttpRequest: fetch says nothing of what has gone); the password as a header, a
// refusal told to the shell once (authHold, as every call). R2: a file straight into the bucket, else through the relay
// waiting while it is busy (e7c_direct.js)
function upSend(url, body, onP) {
  if (SRC.linkTtl > 0 && /\/file\?path=/.test(url)) return upDirect(url, body, onP);
  return upPost(url, body, onP);
}
function upPost(url, body, onP) {
  return new Promise((res, rej) => {
    if (SRC.held) { rej(AUTH_ERR()); return; }
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    if (SRC.token) x.setRequestHeader('Authorization', 'Bearer ' + SRC.token);
    if (onP) x.upload.onprogress = e => { if (e.lengthComputable) onP(e.loaded / Math.max(1, e.total)); };
    x.onload = () => {
      let j = null;
      try { j = JSON.parse(x.responseText); } catch (e) { /* not JSON */ }
      if (x.status === 401) { if (!SRC.held) { saw(401, SRC.token, j); authHold(); } rej(AUTH_ERR()); return; }
      saw(x.status, SRC.token, x.status < 300 ? null : j);
      if (x.status >= 200 && x.status < 300) res(j);
      else rej(Object.assign(new Error((j && j.error) || 'HTTP ' + x.status), { status: x.status, retry: +x.getResponseHeader('Retry-After') || 0 }));
    };
    x.onerror = () => rej(Object.assign(new Error('the relay could not be reached'), { status: 0 }));
    x.send(body);
  });
}
// a path part the relay takes as it is (no characters a common file system cannot keep, no dot at the start, none of
// its device names, nothing that reads as a temporary file)
function safeSeg(s) {
  s = String(s).replace(/[\0-\x1f\x7f\\/:*?"<>|]/g, '_');
  // (a long name shortened keeps its extension: what kind of file it is goes by it)
  if (s.length > 90) { const dot = s.lastIndexOf('.'), ext = dot > 0 && s.length - dot <= 12 ? s.slice(dot) : ''; s = s.slice(0, 90 - ext.length) + ext; }
  s = s.replace(/^[. ]+/, m => '_'.repeat(m.length)).replace(/[. ]+$/, m => '_'.repeat(m.length));
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(s)) s = '_' + s;
  if (/(~|\.(tmp|temp|part|partial|crdownload|download|swp|swx))$/i.test(s)) s += '_';
  return s || '_';
}
// the next free name: "eva_001.glb", "eva_001 2.glb", ...
function freeName(p, taken) {
  if (!taken(p)) return p;
  const i = p.lastIndexOf('/'), dir = p.slice(0, i + 1), f = p.slice(i + 1), dot = f.lastIndexOf('.'), b = dot > 0 ? f.slice(0, dot) : f, e = dot > 0 ? f.slice(dot) : '';
  for (let n = 2; ; n++) { const q = `${dir}${b} ${n}${e}`; if (!taken(q)) return q; }
}

// ---------------------------------------------------------------- sounds --
// A sound's own sample rate, from its header (WAV, FLAC, AIFF, Ogg, MP3, ADTS AAC, MP4/M4A): a short one is written at
// it (at most 48 kHz); 0 when it cannot be told
function rateOf(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), str = (o, n) => String.fromCharCode.apply(null, u8.subarray(o, o + n));
  try {
    if (str(0, 4) === 'RIFF' && str(8, 4) === 'WAVE') for (let o = 12; o + 16 <= u8.length;) { const n = dv.getUint32(o + 4, true); if (str(o, 4) === 'fmt ') return dv.getUint32(o + 12, true); o += 8 + n + (n & 1); }
    if (str(0, 4) === 'fLaC') return (u8[18] << 12) | (u8[19] << 4) | (u8[20] >> 4);
    if (str(0, 4) === 'FORM' && /^AIF[FC]$/.test(str(8, 4))) for (let o = 12; o + 26 <= u8.length;) {
      const n = dv.getUint32(o + 4, false);
      if (str(o, 4) === 'COMM') { const e = dv.getUint16(o + 16, false) & 0x7fff, m = dv.getUint32(o + 18, false); return Math.round(m * Math.pow(2, e - 16383 - 31)); }
      o += 8 + n + (n & 1);
    }
    const head = str(0, Math.min(u8.length, 4096));
    if (head.startsWith('OggS')) { const v = head.indexOf('\x01vorbis'); if (v >= 0) return dv.getUint32(v + 12, true); if (head.includes('OpusHead')) return 48000; }
    const mp4 = head.indexOf('mp4a');
    if (mp4 > 4 && mp4 + 32 <= u8.length && /ftyp/.test(head)) return dv.getUint32(mp4 + 28, false) >>> 16;
    let o = 0;
    if (str(0, 3) === 'ID3') o = 10 + ((u8[6] & 127) << 21 | (u8[7] & 127) << 14 | (u8[8] & 127) << 7 | (u8[9] & 127));
    for (const end = Math.min(u8.length - 4, o + 65536); o < end; o++) {
      if (u8[o] !== 0xff || (u8[o + 1] & 0xe0) !== 0xe0) continue;
      const b1 = u8[o + 1], b2 = u8[o + 2];
      if ((b1 & 0xf6) === 0xf0) { const r = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350][(b2 >> 2) & 15]; if (r) return r; continue; }   // ADTS (AAC)
      const ver = (b1 >> 3) & 3, layer = (b1 >> 1) & 3, ri = (b2 >> 2) & 3;
      if (ver === 1 || layer === 0 || ri === 3) continue;
      return [[11025, 12000, 8000], null, [22050, 24000, 16000], [44100, 48000, 32000]][ver][ri];
    }
  } catch (e) { /* not told */ }
  return 0;
}
// a sound decoded and mixed to mono at `rate` (an OfflineAudioContext only decodes: it opens no output, so the rule that
// sound is the shell's is kept), as a 16-bit WAV
async function monoWav(bytes, rate) {
  let ctx;
  try { ctx = new OfflineAudioContext(1, 1, rate); } catch (e) { ctx = new OfflineAudioContext(1, 1, 44100); }
  const b = await ctx.decodeAudioData(bytes.slice(0)), n = b.length, ch = b.numberOfChannels, mix = new Float32Array(n);
  for (let c = 0; c < ch; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) mix[i] += d[i] / ch; }
  const out = new ArrayBuffer(44 + n * 2), dv = new DataView(out), w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, b.sampleRate, true); dv.setUint32(28, b.sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, mix[i])) * 32767), true);
  return { wav: out, rate: b.sampleRate, dur: b.duration, ch };
}
// how long a dropped sound is, from an <audio> element's metadata (NaN: this browser cannot read it)
function probeFile(file) {
  return new Promise(res => {
    const el = new Audio(), url = URL.createObjectURL(file);
    let done = false;
    const end = d => { if (done) return; done = true; unlater(t); el.removeAttribute('src'); try { el.load(); } catch (e) { /* gone */ } URL.revokeObjectURL(url); res(d); };
    const t = later(() => end(NaN), 15000);
    el.preload = 'metadata';
    el.addEventListener('loadedmetadata', () => end(el.duration));
    el.addEventListener('error', () => end(NaN));
    el.src = url;
  });
}

// ----------------------------------------------------------- the Upload pane --
// UP.entries: what was dropped ({ path in the dropped folders, file, ext, name }); UP.rows: the plan, one row per thing it
// will make ({ kind: 'model' | 'sound' | 'keep', main, src: entries, out: paths, notes, state, p, msg, dl })
const UP = { scene: '', newOpen: false, newName: '', making: false, newNote: '', entries: [], rows: [], left: [], quest: true, replace: false, busy: false, ran: false, note: '', gen: 0, have: null, haveFor: '', planning: false, rev: 0, blobs: [], sent: new Set(), given: new Map() };
const SOUND_EXT = ['mp3', 'ogg', 'oga', 'wav', 'm4a', 'aac', 'flac', 'opus', 'webm', 'aif', 'aiff', 'aifc'];
const KEEP_AS_IS = ['mp3', 'm4a', 'aac', 'ogg', 'oga'];
const JUNK = /^(\.|thumbs\.db$|desktop\.ini$)/i;
const upRelay = () => SRC.kind === 'relay' && SRC.upload && SRC.state === 'ok';
const upChanged = () => { UP.rev++; dirty(); };
// files dropped or chosen: [{ path, file }] (a dropped folder's structure kept in path)
function upTake(list) {
  if (UP.busy) return;
  const out = [], left = [];
  for (const x of list) {
    const path = String(x.path || x.file.name).replace(/\\/g, '/').replace(/^\/+/, ''), name = baseName(path);
    if (!name || path.split('/').some(s => JUNK.test(s))) { left.push(name || path); continue; }
    if (out.length >= 2000) break;
    out.push({ path, file: x.file, ext: extOf(name), name, buf: null });
  }
  UP.entries = out; UP.left = left; UP.ran = false; UP.note = ''; UP.sent = new Set();
  for (const u of UP.blobs) URL.revokeObjectURL(u);
  UP.blobs = [];
  if (!UP.scene) UP.scene = STU.scene || (SRC.scenes.length === 1 ? SRC.scenes[0].name : '');
  X.tab = 'upload';
  upPlan();
}
// the plan: each model with the files it names (an OBJ's MTL, a glTF's .bin: by name, case aside, anywhere in what was
// dropped; its textures by the ladder, CONV.texFind: the path it gives, the name, another kind of picture of the same
// name, a name of the same words), each sound on its own, and anything left kept as it is. Then the rung only the plan
// has: exactly one model lacking exactly one texture, and exactly one picture no model uses, are put together ('only')
async function upPlan() {
  const gen = ++UP.gen, E = UP.entries, byName = new Map(), byPath = new Map(E.map(e => [e.path, e])), pics = E.filter(e => CONV.IM.isPicture(e.path)).map(e => e.path);
  UP.planning = true; upChanged();
  if (UP.haveFor !== UP.scene || !UP.have) await upHave();   // (names numbered against what the scene holds, from the first plan)
  if (gen !== UP.gen) return;
  for (const e of E) { const k = e.name.toLowerCase(); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(e); }
  // (the nearest of several by that name: in the model's own folder first)
  const find = (n, near) => { const L = byName.get(baseName(n).toLowerCase()); if (!L) return null; const dir = near.path.slice(0, near.path.lastIndexOf('/') + 1); return L.find(e => e.path.startsWith(dir) && e.path.slice(dir.length) === baseName(n)) || L.find(e => e.path.startsWith(dir)) || L[0]; };
  const rows = [];
  for (const e of E.filter(x => MODEL_EXT.includes(x.ext))) {
    const r = { kind: 'model', main: e, src: [e], deps: [], names: [], adds: [], out: [], notes: [], notes0: [], state: 'plan', p: 0, msg: '', dl: [], title: e.path, keep: FT_DEFAULT, tris: null, pv: null };
    try {
      if (!e.buf) e.buf = await e.file.arrayBuffer();
      if (gen !== UP.gen) return;
      r.tris = CONV.triCount(e.ext, e.buf);   // (its triangles about, from its bytes: the share's words)
      const N = CONV.namesIn(e.ext, e.buf), lost = [];
      const dep = n => { const f = find(n, e); if (f) { if (!r.deps.includes(f)) r.deps.push(f); return f; } if (!lost.includes(n)) lost.push(n); return null; };
      const tex = n => {
        if (r.names.some(x => x.name.toLowerCase() === baseName(n).toLowerCase())) return;
        if (!CONV.IM.isPicture(n)) { dep(n); return; }
        const hit = CONV.texFind(n, pics, { dir: dirOf(e.path) });
        r.names.push({ name: baseName(n), entry: hit ? byPath.get(hit.path) : null, how: hit ? hit.how : '' });
      };
      for (const n of N.mtl) {
        const f = dep(n);
        if (f) { const txt = await f.file.text(); for (const t of CONV.mtlNames(txt)) tex(t); }
      }
      for (const n of N.buffers) dep(n);
      for (const n of N.textures) tex(n);
      if (lost.length) r.notes0.push(`Missing ${lost.join(', ')}: converted without ${lost.length > 1 ? 'them' : 'it'}`);
    } catch (err) { r.notes0.push('It could not be read: ' + err.message); }
    finally { e.buf = null; }   // (read again when its row runs: a folder of large scans is never all in memory at once)
    rows.push(r);
  }
  const taken = new Set(rows.flatMap(r => [r.main, ...r.deps, ...r.names.map(x => x.entry).filter(Boolean)]));
  for (const e of E.filter(x => SOUND_EXT.includes(x.ext) && !taken.has(x))) { taken.add(e); rows.push({ kind: 'sound', main: e, src: [e], out: [], notes: [], state: 'plan', p: 0, msg: 'Measuring...', dl: [], title: e.path, dur: undefined, rate: 0 }); }
  // ('only': one model lacking one texture, one picture left over)
  const lacking = rows.filter(r => r.kind === 'model' && r.names.filter(x => !x.entry).length === 1), left = E.filter(x => CONV.IM.isPicture(x.path) && CONV.IM.way(x.ext) !== 'refuse' && !taken.has(x));
  // (and of the same kind: a normal map left over never stands in for a missing colour picture; it is still offered)
  const gap = lacking.length === 1 ? lacking[0].names.find(x => !x.entry) : null;
  if (gap && left.length === 1 && CONV.slotOf(left[0].path) === CONV.slotOf(gap.name)) Object.assign(gap, { entry: left[0], how: 'only' });
  if (gen !== UP.gen) return;
  UP.rows = rows;
  upRebuild();
  UP.planning = false; upChanged();
  // the sounds' lengths and rates (an element's metadata, the header's first bytes), then the names again
  for (const r of rows.filter(x => x.kind === 'sound')) {
    const [dur, head] = await Promise.all([probeFile(r.main.file), r.main.file.slice(0, 1 << 18).arrayBuffer()]);
    if (gen !== UP.gen) return;
    r.dur = dur; r.rate = rateOf(new Uint8Array(head)); r.msg = '';
    upNames(); upChanged();
  }
}
// each model's files (the model, what it needs, its pictures), and a row kept as it is for anything no row uses (a
// picture a model takes goes to originals/ as that model's file, not on its own); its notes; the names again
function upRebuild() {
  const used = new Set();
  for (const r of UP.rows) {
    if (r.kind === 'sound') used.add(r.main);
    if (r.kind !== 'model') continue;
    if (r.state === 'plan') {
      r.src = [r.main, ...r.deps];
      for (const e of [...r.names.map(x => x.entry), ...r.adds.map(a => a.entry)]) if (e && !r.src.includes(e)) r.src.push(e);
      const miss = r.names.filter(x => !x.entry).map(x => x.name);
      r.notes = r.notes0.concat(miss.length ? [r.main.ext === 'fbx' ? `Names ${miss.join(', ')}, not among the files (perhaps inside the FBX: the row says after converting)` : `Missing ${miss.join(', ')}: converted without ${miss.length > 1 ? 'them' : 'it'}, unless you give ${miss.length > 1 ? 'them' : 'it'} a picture`] : []);
    }
    for (const e of r.src) used.add(e);
  }
  const keepOf = new Map(UP.rows.filter(r => r.kind === 'keep').map(r => [r.main, r]));
  const keeps = UP.entries.filter(e => !used.has(e)).map(e => keepOf.get(e) || { kind: 'keep', main: e, src: [e], out: [], notes: [], state: 'plan', p: 0, msg: '', dl: [], title: e.path });
  UP.rows = UP.rows.filter(r => r.kind !== 'keep' || (r.state !== 'plan' && !keeps.includes(r))).concat(keeps);
  upNames();
}
// the pictures no model uses (the Use buttons' choice, the convert-time rung)
const upLeft = () => { const used = new Set(UP.rows.filter(r => r.kind !== 'keep').flatMap(r => r.src)); return UP.entries.filter(e => CONV.IM.isPicture(e.path) && CONV.IM.way(e.ext) !== 'refuse' && !used.has(e)); };
// pictures given to a model row (dropped onto it, or Choose a file): for a texture it lacks (name, else the first), else
// laid on as a slot of their own (by their name, or a normal map's colour; changeable on the row)
function upGive(ri, files, name) {
  const r = UP.rows[ri];
  if (!r || r.kind !== 'model' || UP.busy || r.state !== 'plan') return;
  for (const f of files) {
    if (!CONV.IM.isPicture(f.name)) continue;
    let p = f.name, k = 2;
    while (UP.entries.some(x => x.path === p)) p = `added ${k++}/${f.name}`;
    const e = { path: p, file: f, ext: extOf(f.name), name: f.name, buf: null };
    UP.entries.push(e);
    const miss = r.names.find(x => !x.entry && (!name || x.name === name)) || r.names.find(x => !x.entry);
    if (miss) Object.assign(miss, { entry: e, how: 'chosen' });
    else { const a = { entry: e, slot: CONV.slotOf(f.name), why: '' }; r.adds.push(a); upMean(a); }
  }
  upRebuild(); upChanged();
}
async function upMean(a) {
  const u = URL.createObjectURL(a.entry.file);
  try { const img = await CONV.picture(u, { max: 128, ext: a.entry.ext }); if (a.slot === 'map' && CONV.slotOf(a.entry.name, CONV.meanOf(img)) === 'normalMap') a.slot = 'normalMap'; }
  catch (e) { a.why = e.message; }
  finally { URL.revokeObjectURL(u); upChanged(); }
}
// where each row's files go in the scene, against what the scene holds (numbered unless Replace) and each other
async function upHave() {
  const name = UP.scene;
  if (!name || !upRelay()) { UP.have = []; UP.haveFor = name; return; }
  if (name === STU.scene && STU.listing === 'ok') { UP.have = STU.files.map(f => f.path); UP.haveFor = name; return; }
  try { const j = await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(name)}`); if (UP.scene === name) { UP.have = (j.files || []).map(f => f.path); UP.haveFor = name; } } catch (e) { UP.have = []; UP.haveFor = name; }
}
function origPath(path) {
  const segs = path.split('/').map(safeSeg), file = segs.pop(), dirs = segs.slice(-3);   // (the relay keeps 4 folders: originals/ and 3 of the dropped ones)
  const p = ['originals', ...dirs, file].join('/');
  return p.length <= 200 ? p : 'originals/' + file.slice(0, 180);
}
function upNames() {
  const have = new Set((UP.have || []).map(p => p.toLowerCase())), mine = new Set(), given = new Map();
  const taken = p => mine.has(p.toLowerCase()) || (!UP.replace && have.has(p.toLowerCase()));
  const claim = p => { const q = freeName(p, taken); mine.add(q.toLowerCase()); return q; };
  const orig = e => { if (!given.has(e)) given.set(e, claim(origPath(e.path))); return given.get(e); };
  UP.given = given;   // (where each given file goes: a GLB's record names its pictures there)
  const relay = upRelay() && !!UP.scene;
  // a row already run (made, or failed and run again) keeps its names: what it made is not renamed, and what it sent is
  // not sent again under another name (the files this upload wrote are in the scene's listing by now)
  for (const r of UP.rows) {
    if (r.state === 'plan') continue;
    for (const p of r.out) mine.add(p.toLowerCase());
    const kept = r.kind === 'model' ? r.src.map((e, i) => [e, r.out[i + 1]]) : [[r.main, r.out[r.out.length - 1]]];
    for (const [e, p] of kept) if (p && !given.has(e)) given.set(e, p);
  }
  for (const r of UP.rows) {
    if (r.state !== 'plan') continue;
    r.out = []; r.how = '';
    const st = safeSeg(r.main.name.replace(/\.[^.]*$/, ''));
    if (r.kind === 'model') { r.out.push(claim(`models/${st}.glb`)); r.from = orig(r.main); for (const e of r.src) r.out.push(orig(e)); }
    else if (r.kind === 'sound') {
      const d = r.dur;
      if (d === undefined) r.how = 'measuring';
      else if (!(d > 0) || !isFinite(d)) { r.how = 'unread'; r.out.push(orig(r.main)); continue; }
      else if (d <= STREAM_S) r.how = 'wav';
      else if (relay && SRC.ffmpeg) r.how = 'mp3';
      else if (KEEP_AS_IS.includes(r.main.ext)) r.how = 'keep';
      else r.how = 'wav22';
      if (r.how !== 'measuring') r.out.push(claim(`sounds/${st}.${r.how === 'mp3' ? 'mp3' : r.how === 'keep' ? r.main.ext : 'wav'}`));
      r.out.push(orig(r.main));
    } else r.out.push(orig(r.main));
  }
}
// what a row says it will make, in words
function rowPlan(r) {
  const d = r.dur, len = d > 0 && isFinite(d) ? (d >= 60 ? `${Math.floor(d / 60)} min ${Math.round(d % 60)} s` : `${d.toFixed(d < 10 ? 1 : 0)} s`) : '';
  if (r.kind === 'model') {
    const more = r.src.length - 1;
    return `A model: ${r.out[0]} (metres, Y up, textures at most ${fmt(maxTexNow())} px)` + (more ? `, with ${more} file${more === 1 ? '' : 's'} it names` : '') + '; the given files to originals/.';
  }
  if (r.kind === 'sound') {
    const rate = Math.min(48000, r.rate || 44100);
    return r.how === 'measuring' ? 'A sound: measuring its length...'
      : r.how === 'unread' ? 'This browser cannot read this sound: kept as it is in originals/.'
      : r.how === 'wav' ? `A short sound (${len}): ${r.out[0]}, mono, 16-bit, ${(rate / 1000).toFixed(rate % 1000 ? 2 : 0)} kHz (loops without a gap).`
      : r.how === 'mp3' ? `A long sound (${len}): ${r.out[0]}, made mono MP3 by the relay's ffmpeg (streamed when played).`
      : r.how === 'keep' ? `A long sound (${len}): ${r.out[0]} kept as it is (a stereo file plays from one point; no ffmpeg on ${upRelay() ? 'this relay' : 'a page alone'}).`
      : `A long sound (${len}): ${r.out[0]}, mono WAV at ${r.rate && r.rate < 22050 ? (r.rate / 1000).toFixed(r.rate % 1000 ? 2 : 0) : '22.05'} kHz (no ffmpeg ${upRelay() ? 'on this relay' : 'without a relay'} to make an MP3).`;
  }
  return 'Kept as it is: to originals/ (no model names it).';
}
// a new scene (POST /api/scenes): its folder made, then picked
async function upMake() {
  const name = UP.newName.trim(), why = sceneNameWhy(name);   // (the relay's rule for a new scene)
  if (why) { UP.newNote = why; dirty(true); return; }
  if (!upRelay() || UP.making) return;
  UP.making = true; UP.newNote = ''; dirty(true);
  try {
    await getJSON(`${SRC.base}/api/scenes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    UP.scene = name; UP.newOpen = false; UP.newName = '';
    await listScenes(SRC.gen);
    await upHave(); upNames();
  } catch (e) { UP.newNote = e.status === 409 ? `There is a scene called ${name} already: pick it above.` : 'The scene could not be made: ' + e.message; }
  finally { UP.making = false; dirty(true); }
}
async function upPick(name) { if (UP.busy) return; UP.scene = name; UP.rev++; await upHave(); upNames(); dirty(true); }
// Convert and upload (or, with no relay that takes uploads, Convert: the outputs offered as downloads)
async function upRun() {
  if (UP.busy || !UP.rows.length) return;
  const relay = upRelay();
  if (relay && !UP.scene) { UP.note = 'Pick a scene first, or make a new one.'; dirty(true); return; }
  UP.busy = true; UP.ran = true; UP.note = ''; dirty(true);
  const gen = UP.gen, scene = UP.scene, sent = UP.sent;   // (what this upload has sent, across runs: a run again sends only the rest)
  try {
    if (relay) { await upHave(); upNames(); }
    for (const r of UP.rows) {
      if (gen !== UP.gen || GL.gone) return;
      if (r.state === 'done') continue;
      r.state = 'work'; r.p = 0; r.msg = ''; r.dl = []; upChanged();
      try { await upRow(r, relay, scene, sent); }
      catch (e) { r.state = 'failed'; r.msg = e.status === 401 ? AUTH_NOTE : (r.msg ? r.msg + ' ' : '') + 'It failed: ' + e.message; if (e.status === 401) break; }
      upChanged();
    }
    const bad = UP.rows.filter(r => r.state === 'failed').length;
    UP.note = relay ? (bad ? `Done, with ${bad} row${bad === 1 ? '' : 's'} not made (said in each).` : `Done: everything is in the scene ${scene}.`)
      : 'Converted here: download what was made (nothing was uploaded: no relay takes uploads here).';
    if (relay && scene === STU.scene) refreshFiles(new Set());
    if (relay) listScenes(SRC.gen);
  } finally { UP.busy = false; dirty(true); }
}
// a model row's model read, with the files it names among those given (by its plan: a texture name given a picture is
// that picture, whatever its name): for converting, and for its preview (Fewer triangles' picture)
async function upLoad(r) {
  const e = r.main, urls = new Map();
  for (const f of r.src) { const u = URL.createObjectURL(f.file); UP.blobs.push(u); urls.set(f.path.toLowerCase(), u); if (!urls.has(f.name.toLowerCase())) urls.set(f.name.toLowerCase(), u); }
  const dir = e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/') + 1) : '', base = 'upload:/' + dir;
  const blobFor = f => { const u = urls.get(f.path.toLowerCase()); if (u) return u; const v = URL.createObjectURL(f.file); UP.blobs.push(v); urls.set(f.path.toLowerCase(), v); return v; };
  const named = new Map(r.names.filter(x => x.entry).map(x => [x.name.toLowerCase(), x.entry]));
  const url = u => {
    let rel = u.startsWith(base) ? u.slice(base.length) : u;
    try { rel = decodeURIComponent(rel); } catch (err) { /* as it is */ }
    rel = CONV.IM.psdBack(rel.split(/[?#]/)[0].replace(/\\/g, '/').replace(/^(\.\/)+/, ''));
    const x = named.get(baseName(rel).toLowerCase());
    if (x) return blobFor(x);
    return urls.get((dir + rel).toLowerCase()) || urls.get(baseName(rel).toLowerCase()) || null;
  };
  if (!e.buf) e.buf = await e.file.arrayBuffer();
  const nm = e.name.replace(/\.[^.]*$/, ''), m = await CONV.load({ ext: e.ext, data: e.buf, base, name: nm, maxTex: maxTexNow(), url });
  return { m, nm, gltf: ['glb', 'gltf'].includes(e.ext), blobFor };
}
// one row: converted (a model, a sound) and its files uploaded, the given ones to originals/ (each once a run)
async function upRow(r, relay, scene, sent) {
  const prog = (a, b) => f => { r.p = a + (b - a) * f; dirty(); };
  const keep = async (e, p) => {
    const key = scene + '\0' + p;
    if (!relay || !p || sent.has(key)) return;
    r.msg = `Uploading ${p}...`; upChanged();
    const j = await upFile(scene, p, e.file, prog(r.p, Math.min(1, r.p + 0.15)));
    sent.add(key);
    return (j && j.path) || p;   // (where it went: a name taken gets a number)
  };
  if (r.kind === 'keep' || (r.kind === 'sound' && r.how === 'unread')) {
    if (relay) await keep(r.main, r.out[0]);
    r.state = 'done'; r.p = 1; r.msg = relay ? `In ${r.out[0]}.` : 'Kept as it is (with a relay it goes to originals/).';
    return;
  }
  if (r.kind === 'model') {
    const e = r.main, glbPath = r.out[0];
    r.msg = 'Reading it...'; r.p = 0.02; upChanged();
    if (!e.buf) e.buf = await e.file.arrayBuffer();
    await new Promise(res => later(res, 30));
    let res = null;
    const op = f => (UP.given && UP.given.get(f)) || origPath(f.path), tex = r.names.filter(x => x.entry).map(x => ({ name: x.name, mat: '', slot: '', from: op(x.entry), how: x.how }));
    try {
      const { m, nm, gltf, blobFor } = await upLoad(r);
      // pictures given as slots of their own, then (no colour picture at all) a left-over one whose name matches the
      // model's or a material's
      const lay = async (f, slot, how) => {
        const image = await CONV.picture(blobFor(f), { max: maxTexNow(), ext: f.ext }), d = CONV.addTextures(m.root, [{ mat: '*', slot, image, name: f.name }], { gltf });
        if (d.done) tex.push({ name: '', mat: '*', slot, from: op(f), how }); else r.notes.push(`${f.name} was not laid on: ${d.why[0] || 'every material has that picture already'}.`);
        return d.done;
      };
      for (const a of r.adds) await lay(a.entry, a.slot, 'chosen');
      const mats = CONV.matsOf(m.root);
      if (mats.length && !mats.some(x => x.m.map)) {
        const want = new Set([nm, ...mats.map(x => x.name)].map(x => CONV.normStem(x)).filter(Boolean)), c = upLeft().filter(f => want.has(CONV.normStem(f.name)) && CONV.slotOf(f.name) === 'map');
        if (c.length === 1 && await lay(c[0], 'map', 'stem')) r.notes.push(`It had no colour picture: ${c[0].name} laid on (its name matches the model's).`);
      }
      const keep = r.keep === undefined ? FT_DEFAULT : r.keep;   // (Triangles kept: 20 % unless the row says otherwise)
      res = await CONV.toGLB(m, { name: nm, maxTex: maxTexNow(), from: r.from, tex, keep: keep < 0.995 ? keep : 0, picture: pvShotSoon, step: (l, f) => { r.msg = l + '...'; r.p = 0.05 + f * 0.5; dirty(); } });
      CONV.disposeTree(m.root);
      for (const [n, w] of Object.entries(m.why || {})) r.notes.push(`Texture ${n}: ${w}.`);
    } catch (err) { res = { ok: false, why: whyFailed(err).replace(/\.$/, ''), notes: [], missing: [] }; }
    e.buf = null;
    for (const m of res.missing || []) r.notes.push(`Converted without its texture ${m}.`);
    if (res.notes) for (const n of res.notes) if (/^made opaque|^no normals/.test(n)) r.notes.push(n.charAt(0).toUpperCase() + n.slice(1) + '.');
    r.notes = [...new Set(r.notes.filter(n => !/^Names .* not among the files/.test(n) || !res.ok))];
    // the given files kept whether or not it converted (a failure is said; the original can be tried again)
    r.p = 0.55;
    for (const f of r.src) await keep(f, r.out[r.src.indexOf(f) + 1]);
    if (!res.ok) { r.state = 'failed'; r.msg = `Not converted: ${res.why}.` + (relay ? ' Its files are kept in originals/.' : ''); return; }
    const size = mb(res.glb.byteLength) + (res.reduced ? `, ${fmt(res.reduced.to)} of ${fmt(res.reduced.from)} triangles` : `, ${fmt(res.after.tris)} triangles`);
    if (res.reduced) r.tris = res.reduced.from;
    if (relay) {
      r.msg = `Uploading ${glbPath} (${size})...`; upChanged();
      const j = await upFile(scene, glbPath, new Blob([res.glb], { type: 'model/gltf-binary' }), prog(0.85, 1));
      r.out[0] = (j && j.path) || glbPath;
      r.msg = `Made ${r.out[0]} (${size}).`;
    } else { r.dl.push({ name: baseName(glbPath), url: blobOf(res.glb, 'model/gltf-binary') }); r.msg = `Converted (${size}).`; }
    // its picture for the Add pane (e7e_pics.js): shown in the row, and with a relay kept in the scene beside the GLB
    // (previews/<its path>.jpg); one that could not go is only said
    const pb = res.picture ? await pvJpeg(res.picture).catch(() => null) : null;
    if (pb) {
      r.pic = blobOf(pb, 'image/jpeg');
      if (relay) { try { await pvSend(scene, r.out[0], pb); } catch (err) { r.notes.push(`Its picture for the Add pane was not kept (${err.status === 401 ? AUTH_NOTE : err.message}): Make pictures under Add makes it again.`); } }
    }
    r.state = 'done'; r.p = 1;
    return;
  }
  // a sound
  const e = r.main, out = r.out[0];
  if (r.how === 'mp3') {
    r.msg = `The relay's ffmpeg is making ${out}...`; r.p = 0.1; upChanged();
    let j = null;
    // (R2: the original goes straight into the bucket first, then the relay makes the MP3 from it there: from=)
    const from = SRC.direct && r.out[1] ? await keep(e, r.out[1]) : '';
    if (from) { r.msg = `The relay's ffmpeg is making ${out} from ${from}...`; upChanged(); }
    for (let k = 0; ; k++) {
      try { j = await upSend(soundApi(scene, out, UP.replace) + (from ? '&from=' + encodeURIComponent(from) : ''), from ? null : e.file, prog(0.1, 0.7)); break; }
      catch (err) { if (err.status !== 429 || k > 8) throw err; await new Promise(res => later(res, 1000 * Math.max(2, err.retry || 3))); }
    }
    r.out[0] = (j && j.path) || out;
  } else if (r.how === 'keep') {
    if (relay) await upFile(scene, out, e.file, prog(0.1, 0.7));
  } else {
    r.msg = 'Decoding it...'; r.p = 0.1; upChanged();
    const w = await monoWav(await e.file.arrayBuffer(), Math.min(r.how === 'wav' ? 48000 : 22050, Math.max(8000, r.rate || 44100)));
    if (relay) { r.msg = `Uploading ${out} (${mb(w.wav.byteLength)})...`; upChanged(); await upFile(scene, out, new Blob([w.wav], { type: 'audio/wav' }), prog(0.3, 0.7)); }
    else r.dl.push({ name: baseName(out), url: blobOf(w.wav, 'audio/wav') });
    r.made = `mono, ${w.rate} Hz, ${w.dur.toFixed(1)} s` + (w.ch > 1 ? ` (from ${w.ch} channels)` : '');
  }
  r.p = 0.75;
  await keep(e, r.out[1]);
  r.state = 'done'; r.p = 1;
  r.msg = r.how === 'keep' && !relay ? 'Kept as it is (nothing to convert here).' : relay ? `Made ${r.out[0]}` + (r.made ? ` (${r.made}).` : '.') : `Converted (${r.made}).`;
}
// one file to the scene (409 for a name taken meanwhile: the next free one)
async function upFile(scene, p, body, onP) {
  for (let k = 0; k < 6; k++) {
    try { return await upSend(fileApi(scene, p, UP.replace), body, onP); }
    catch (e) { if (e.status !== 409 || UP.replace) throw e; const was = p; p = freeName(p, q => q === was || (UP.have || []).includes(q)); (UP.have || (UP.have = [])).push(was); }
  }
  throw new Error('no free name for ' + p);
}
// a file the relay would refuse (over its --max-upload), said before anything is sent
const tooBig = r => (upRelay() && SRC.maxUpload ? r.src.filter(e => e.file.size > SRC.maxUpload).map(e => `${e.name} is ${mb(e.file.size)}: more than this relay takes (${mb(SRC.maxUpload)}; --max-upload).`) : []);
const blobOf = (data, type) => { const u = URL.createObjectURL(new Blob([data], { type })); UP.blobs.push(u); return u; };
function upClear() { if (UP.busy) return; UP.gen++; UP.entries = []; UP.rows = []; UP.left = []; UP.ran = false; UP.note = ''; UP.planning = false; UP.sent = new Set(); for (const u of UP.blobs) URL.revokeObjectURL(u); UP.blobs = []; dirty(true); }
function upOpen() {
  const name = UP.scene;
  if (!name) return;
  if (name !== STU.scene) openScene(name, 'pick'); else refreshFiles(new Set());
  if (!OPT.visit && !STU.edit) setEdit(true);
  X.tab = 'add'; dirty(true);
}
// a folder dropped: every file in it (its path kept), read through the browser's entries (at most 2,000 files)
async function readDropped(dt) {
  const out = [], walk = async (en, pre) => {
    if (out.length >= 2000) return;
    if (en.isFile) { try { out.push({ path: pre + en.name, file: await new Promise((res, rej) => en.file(res, rej)) }); } catch (e) { /* unreadable */ } return; }
    if (!en.isDirectory) return;
    const rd = en.createReader();
    for (;;) { const batch = await new Promise(res => rd.readEntries(res, () => res([]))); if (!batch.length) break; for (const c of batch) await walk(c, pre + en.name + '/'); }
  };
  const ents = [...(dt.items || [])].map(i => (i.kind === 'file' && i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
  if (ents.length && ents.every(Boolean)) { for (const en of ents) await walk(en, ''); return out; }
  return [...(dt.files || [])].map(f => ({ path: f.webkitRelativePath || f.name, file: f }));
}
// the pane's blocks (pages only: a headset shows no Upload tab)
function uploadBlocks(B) {
  const relay = upRelay(), busy = UP.busy;
  B.push({ h: 'Upload', sub: 'Studio' });
  B.push({ p: 'Drop models, textures and sounds here (files or whole folders). Each model is converted to a GLB (metres, Y up, light enough for a headset), each sound made mono, everything sorted into the scene\'s models/, sounds/ and originals/ folders.', c: 'muted' });
  if (relay) {
    B.push({ label: 'Into the scene', row: SRC.scenes.map(s => ({ id: 'up:scene:' + s.name, label: s.name, act: 'up:scene', v: s.name, on: s.name === UP.scene, dis: busy }))
      .concat({ id: 'up:new', label: 'New scene', act: 'up:new', on: UP.newOpen, dis: busy }) });
    if (UP.newOpen) B.push({ input: { id: 'stuNewName', value: UP.newName, ph: 'The new scene\'s name' }, row: [{ id: 'up:make', label: UP.making ? 'Making...' : 'Make it', act: 'up:make', primary: true, dis: UP.making || !UP.newName.trim() }] });
    if (UP.newNote) B.push({ p: UP.newNote, c: 'red' });
    if (!UP.scene) B.push({ p: 'Pick a scene, or make a new one.', c: 'amber' });
  } else {
    B.push({ p: SRC.state === 'auth' ? AUTH_NOTE : SRC.kind === 'relay' && SRC.state === 'ok' ? 'This relay does not take uploads (it runs with --scenes-readonly): you can still convert here and download what is made.'
      : 'No relay that takes uploads: you can still drop files to see the plan, and convert here to download what is made. To upload, run a relay on a computer here:', c: 'amber' });
    if (!(SRC.kind === 'relay' && SRC.state === 'ok')) B.push({ code: 'node relay/server.mjs --lan --scenes <folder>' }, { p: 'Then open its address /upload (each folder in <folder> is a scene; it saves layouts and takes uploads; with ffmpeg installed it makes long sounds MP3).', c: 'faint' });
  }
  B.push({ drop: true, dis: busy });
  B.push({ row: [
    { id: 'up:quest', label: 'For Quest: ' + (UP.quest ? 'on' : 'off'), act: 'up:quest', on: UP.quest, dis: busy },
    { id: 'up:replace', label: 'Replace files with the same name: ' + (UP.replace ? 'on' : 'off'), act: 'up:replace', on: UP.replace, dis: busy || !relay },
  ] }, { p: `For Quest: textures at most ${UP.quest ? '2,048' : '4,096'} px. Replace off: a name taken gets a number (eva_001 2.glb).`, c: 'faint' });
  if (UP.planning) B.push({ p: 'Reading what was dropped...', c: 'faint' });
  if (UP.rows.length) {
    const n = k => UP.rows.filter(r => r.kind === k).length;
    B.push({ label: `The plan: ${n('model')} model${n('model') === 1 ? '' : 's'}, ${n('sound')} sound${n('sound') === 1 ? '' : 's'}, ${n('keep')} kept as ${n('keep') === 1 ? 'it is' : 'they are'}`, plan: UP.rows });
    if (UP.left.length) B.push({ p: `Left out: ${UP.left.length} hidden or system file${UP.left.length === 1 ? '' : 's'} (${UP.left.slice(0, 4).join(', ')}${UP.left.length > 4 ? '...' : ''}).`, c: 'faint' });
    const todo = UP.rows.some(r => r.state !== 'done');
    B.push({ row: [
      { id: 'up:run', label: busy ? 'Working...' : relay ? 'Convert and upload' : 'Convert', act: 'up:run', primary: todo, dis: busy || !todo || (relay && !UP.scene) || UP.rows.some(r => r.how === 'measuring') },
      { id: 'up:clear', label: 'Clear', act: 'up:clear', dis: busy },
      relay && UP.ran && !busy && UP.scene ? { id: 'up:open', label: 'Open the scene', act: 'up:open', primary: !todo } : null,
    ].filter(Boolean) });
  }
  if (UP.note) B.push({ p: UP.note, c: /not made|failed/.test(UP.note) ? 'amber' : 'green' });
  B.push({ p: 'Models: GLB is best (one file, its textures and animations inside); FBX, OBJ with its MTL, glTF, PLY and STL are converted. Textures: JPEG for photos and scans, PNG only where see-through. Sounds: mono places best; short loops become WAV, long ones (over 20 s, streamed) MP3.', c: 'faint' });
}
// the page's HTML for the pane's own blocks: the drop zone, a text field, the plan
function uploadHTML(b) {
  if (b.drop) return `<div class="stu-drop${b.dis ? ' off' : ''}" data-drop="1"><b>Drop files or folders here</b><span>or</span><div class="actions"><button class="btn" type="button" data-act="up:choose" data-v=""${b.dis ? ' disabled' : ''}>Choose files</button><button class="btn" type="button" data-act="up:folder" data-v=""${b.dis ? ' disabled' : ''}>Choose a folder</button></div></div>`;
  if (b.input) return `<div class="actions stu-in"><input type="text" id="${b.input.id}" value="${esc(b.input.value)}" placeholder="${esc(b.input.ph)}" maxlength="64" autocomplete="off">${b.row.map(x => `<button class="btn${x.primary ? ' primary' : ''}" type="button" data-act="${x.act}" data-v=""${x.dis ? ' disabled' : ''} data-id="${esc(x.id)}">${esc(x.label)}</button>`).join('')}</div>`;
  if (b.plan) return `<p class="stu-l">${esc(b.label)}</p><ul class="stu-plan">${b.plan.map((r, ri) => {
    const st = { plan: '', work: 'working', done: 'done', failed: 'failed' }[r.state] || '';
    return `<li class="${st}" data-kind="${r.kind}"${r.kind === 'model' && r.state === 'plan' ? ` data-row="${ri}"` : ''}><span class="k">${{ model: 'Model', sound: 'Sound', keep: 'Kept' }[r.kind]}</span><span class="t">${esc(r.title)}${r.src.length > 1 ? `<small> + ${r.src.slice(1).map(e => esc(e.name)).join(', ')}</small>` : ''}</span>
      <small class="w">${esc(rowPlan(r))}</small>${r.kind === 'model' ? liteRow(r, ri) + texRows(r, ri) : ''}${r.notes.concat(tooBig(r)).map(n => `<small class="n">${esc(n)}</small>`).join('')}
      ${r.state === 'work' || r.state === 'done' ? `<span class="bar"><i style="width:${Math.round(r.p * 100)}%"></i></span>` : ''}${r.msg ? `<small class="m">${esc(r.msg)}</small>` : ''}
      ${r.pic ? `<img class="stu-pv sm" src="${r.pic}" alt="${esc(r.title)}">` : ''}${r.dl.map(d => `<a class="btn" href="${d.url}" download="${esc(d.name)}">Download ${esc(d.name)}</a>`).join('')}</li>`;
  }).join('')}</ul>`;
  return '';
}
// a model row's textures: each name it gives and the picture it will have (and how it was found), or for one it lacks
// the pictures no model uses (likeliest first) and Choose a file; pictures laid on as slots of their own, their slot
// changeable. (Drop a picture onto the row: the same as Choose a file)
const UP_HOW = { path: 'by its path', name: 'by its name', ext: 'the same name as another kind of picture', similar: 'a picture of a similar name', only: 'the only picture left over', chosen: 'chosen by hand' };
function texRows(r, ri) {
  const can = r.state === 'plan' && !UP.busy, left = upLeft(), J = v => esc(JSON.stringify(v));
  const btn = (act, v, label, primary) => `<button class="btn${primary ? ' primary' : ''}" type="button" data-act="${act}" data-v="${J(v)}"${can ? '' : ' disabled'}>${esc(label)}</button>`;
  let h = '';
  for (const x of r.names) {
    if (x.entry) h += `<small class="x">Texture ${esc(x.name)}: ${esc(x.entry.path)}${x.how === 'path' || x.how === 'name' ? '' : ` (${esc(UP_HOW[x.how] || '')})`}${x.how === 'chosen' || x.how === 'only' ? ' ' + btn('up:unuse', [ri, x.name], 'Not this') : ''}</small>`;
    else {
      const c = CONV.texRank(x.name, left.map(e => e.path), { dir: dirOf(r.main.path) }, 3);
      h += `<small class="n">Texture ${esc(x.name)}: not among the files</small><span class="tx">${c.map((q, i) => btn('up:use', [ri, x.name, q], 'Use ' + baseName(q), i === 0)).join('')}${btn('up:file', [ri, x.name], 'Choose a file...')}</span>`;
    }
  }
  r.adds.forEach((a, i) => { h += `<small class="x">Laid on: ${esc(a.entry.name)} as ${btn('up:slot', [ri, i], SLOT_NAME[a.slot] + ' ▸')} ${btn('up:unadd', [ri, i], 'Not this')}${a.why ? ` <b class="n">${esc(a.why)}</b>` : ''}</small>`; });
  if (r.state === 'plan') h += `<small class="h">Drop a picture on this row to lay it on${r.names.some(x => !x.entry) ? ' (it takes the missing texture first)' : ''}, or ${btn('up:file', [ri, ''], 'choose one...')}</small>`;
  return h;
}
// the page's listeners: files dropped anywhere on the studio's page (the Upload pane opens with them), the file choosers,
// the new scene's name as it is typed
function uploadBind() {
  const ex = $('#explore'), over = ev => !!(ev.dataTransfer && [...(ev.dataTransfer.types || [])].includes('Files'));
  const zone = on => document.querySelectorAll('#explore .stu-drop').forEach(z => z.classList.toggle('hot', on));
  document.addEventListener('dragover', ev => { if (!over(ev) || XR.on || OPT.visit || UP.busy) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; zone(true); });
  document.addEventListener('dragleave', ev => { if (!ev.relatedTarget) zone(false); });
  document.addEventListener('drop', ev => {
    if (!over(ev) || XR.on || OPT.visit) return;
    ev.preventDefault(); zone(false);
    if (UP.busy) return;
    // (pictures dropped onto a model's row: that model's)
    const li = ev.target && ev.target.closest && ev.target.closest('.stu-plan li[data-row]'), fl = [...((ev.dataTransfer && ev.dataTransfer.files) || [])];
    if (li && fl.length && fl.every(f => CONV.IM.isPicture(f.name))) { upGive(+li.dataset.row, fl); return; }
    if (APP.mode !== 'explore') APP.enterExplore();
    readDropped(ev.dataTransfer).then(upTake);
  });
  ex.addEventListener('input', ev => {
    if (ev.target.id === 'stuNewName') { UP.newName = ev.target.value; const b = ex.querySelector('[data-act="up:make"]'); if (b) b.disabled = UP.making || !UP.newName.trim(); }
    if (ev.target.id === 'stuSceneName') { NS.name = ev.target.value; const b = ex.querySelector('[data-act="scenemake"]'); if (b) b.disabled = NS.making || !NS.name.trim(); }   // (the Scene pane's New scene)
  });
  ex.addEventListener('keydown', ev => {
    if (ev.target.id === 'stuNewName' && ev.key === 'Enter') { ev.preventDefault(); upMake(); }
    if (ev.target.id === 'stuSceneName' && ev.key === 'Enter') { ev.preventDefault(); sceneMake(NS.name); }
  });
  ex.addEventListener('change', ev => {
    const t = ev.target;
    if (t.id !== 'stuFiles' && t.id !== 'stuFolder') return;
    const list = [...(t.files || [])].map(f => ({ path: f.webkitRelativePath || f.name, file: f }));
    t.value = '';
    if (list.length) upTake(list);
  });
}
const UP_ACT = {
  'up:scene': v => upPick(v),
  'up:new': () => { UP.newOpen = !UP.newOpen; UP.newNote = ''; if (UP.newOpen) later(() => { const i = $('#stuNewName'); if (i) i.focus(); }, 50); },
  'up:make': () => upMake(),
  'up:choose': () => { const i = $('#stuFiles'); if (i) i.click(); },
  'up:folder': () => { const i = $('#stuFolder'); if (i) i.click(); },
  'up:quest': () => { UP.quest = !UP.quest; upChanged(); },
  'up:replace': () => { UP.replace = !UP.replace; upNames(); upChanged(); },
  'up:run': () => upRun(),
  'up:pv': v => { const r = UP.rows[+v]; if (r && r.kind === 'model' && r.state === 'plan' && !UP.busy) vwOpen({ kind: 'up', ri: +v }); },   // (the viewer, over the whole window: e7f_viewer.js)
  'up:clear': () => upClear(),
  'up:open': () => upOpen(),
  'up:use': v => { const [ri, n, q] = JSON.parse(v), r = UP.rows[ri], x = r && r.names.find(y => y.name === n), e = UP.entries.find(y => y.path === q); if (x && e && r.state === 'plan') { Object.assign(x, { entry: e, how: 'chosen' }); upRebuild(); upChanged(); } },
  'up:unuse': v => { const [ri, n] = JSON.parse(v), r = UP.rows[ri], x = r && r.names.find(y => y.name === n); if (x && r.state === 'plan') { Object.assign(x, { entry: null, how: '' }); upRebuild(); upChanged(); } },
  'up:file': v => { const [ri, n] = JSON.parse(v); chooseTex({ kind: 'up', ri, name: n }); },
  'up:slot': v => { const [ri, i] = JSON.parse(v), a = UP.rows[ri] && UP.rows[ri].adds[i]; if (a) { a.slot = SLOTS_ADD[(SLOTS_ADD.indexOf(a.slot) + 1) % SLOTS_ADD.length]; upChanged(); } },
  'up:unadd': v => { const [ri, i] = JSON.parse(v), r = UP.rows[ri]; if (r && r.adds[i] && r.state === 'plan') { r.adds.splice(i, 1); upRebuild(); upChanged(); } },
};
