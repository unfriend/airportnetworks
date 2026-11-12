// ====================================================== CUBES THAT RE-TEXTURE ==
// A trigger cube may change pictures on objects while it is active for you (the owner, 8 November 2026: "trigger cube
// replace texture mode so that it can replace a texture on a model in the scene", then "no crossfade needed";
// tools/studio/SPEC.md, "Trigger cubes that change textures"). Its record's tex: up to 16 entries { on, mat, slot, file }:
// the object it changes (an object's id; models only), one of its materials (its index as Change texture lists the
// object's materials: those with texture coordinates, ctMats), a slot (three.js's names: map, normalMap, roughnessMap,
// metalnessMap, aoMap, emissiveMap, alphaMap) and a picture of the scene (its path in the listing). For each object,
// material and slot, of the active cubes' entries the one from the cube entered last wins (show and hide's rule, c.since);
// with none, the object's own picture is back. A switch, no fade; each person's own, as every cube is (only the cube's
// record goes to the room). As scanned shows only a colour picture (map); the other slots apply when lit. The pictures
// are read as the scene opens or an entry arrives (drawn down to 2,048 px, or the studio's own limit if lower) and sent to
// the GPU then, so the switch is at once; freed when no entry names them. On the object's own materials (its clones,
// libClone): another object of the same file never changes with it. Change texture's and Fewer triangles' previews on
// the same object win while they are open (its own pictures put back as they open), then the cubes' state applies again
const TXS_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'], TXS_MAX = 16, TXS_PX = 2048;
// (pics: each picture named, by its path: { state, img, t: [flipY off, on], gen, at, err }; want: each picture's flips
// wanted, by the formats of the objects it goes on; sig, files: what texNeed last looked at)
const TXS = { pics: new Map(), want: new Map(), sig: '', files: null, rev: 0, any: false, live: false };
const isGltf = f => ['glb', 'gltf'].includes(extOf(f));
// a cube's entries as a record keeps them: each one an object's id, a material's index (0 to 255), a slot and a picture
// of the scene; one that is not is dropped, as is a second for the same object, material and slot; at most 16
function normTex(list) {
  const out = [], seen = new Set();
  for (const e of list) {
    if (out.length >= TXS_MAX) break;
    if (!e || typeof e !== 'object' || Array.isArray(e) || !okId(e.on) || !Number.isInteger(e.mat) || e.mat < 0 || e.mat > 255 || !TXS_SLOTS.includes(e.slot) || !okFile(e.file) || !CONV.IM.isPicture(e.file)) continue;
    const k = e.on + '|' + e.mat + '|' + e.slot;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ on: e.on, mat: e.mat, slot: e.slot, file: e.file });
  }
  return out;
}
// an entry in words: "Box · Colour → paint.png" (the material's name too when its object has more than one)
function texWords(e) {
  const o = STU.items.get(e.on), ms = o && o.kind === 'o' && o.model ? ctMats(o) : [], m = ms[e.mat];
  return `${o ? o.rec.name : 'an object not here'}${ms.length > 1 && m ? ' · ' + matLabel(m) : ''} · ${SLOT_NAME[e.slot]} → ${baseName(e.file)}`;
}

// ------------------------------------------------------------ pictures --
// the pictures the cubes' entries name for objects here: read once (each kept by the scene's opening and the file's
// time, so a picture changed on the relay is read again), sent to the GPU in the flips the objects need (a glTF's
// pictures are not flipped, the other loaders' are), freed when nothing names them
function texNeed() {
  const want = new Map();
  if (STU.listing === 'ok') for (const c of STU.items.values()) {
    if (c.kind !== 'c' || !c.rec.tex) continue;
    for (const e of c.rec.tex) {
      const o = STU.items.get(e.on);
      if (!o || o.kind !== 'o' || !STU.fileMap.has(e.file)) continue;
      if (!want.has(e.file)) want.set(e.file, new Set());
      want.get(e.file).add(!isGltf(o.rec.file));
    }
  }
  TXS.want = want;
  TXS.any = [...STU.items.values()].some(c => c.kind === 'c' && c.rec.tex);
  for (const [p, P] of [...TXS.pics]) { const f = STU.fileMap.get(p); if (!want.has(p) || P.gen !== STU.gen || P.at !== (f ? f.at : 0)) texFree(p); }
  for (const [p, flips] of want) {
    const P = TXS.pics.get(p);
    if (!P) texLoad(p);
    else if (P.state === 'ready') for (const fl of flips) texOf(p, fl);
  }
}
async function texLoad(p) {
  const f = STU.fileMap.get(p), P = { state: 'loading', img: null, t: [null, null], gen: STU.gen, at: f ? f.at : 0, err: '' };
  TXS.pics.set(p, P);
  try {
    const img = await CONV.picture(fileUrl(p, true), { max: Math.min(TXS_PX, OPT.maxtex), ext: extOf(p) });
    if (TXS.pics.get(p) !== P || GL.gone) return;   // (freed meanwhile)
    P.img = img; P.state = 'ready';
    for (const fl of TXS.want.get(p) || []) texOf(p, fl);
  } catch (e) { if (TXS.pics.get(p) === P) { P.state = 'failed'; P.err = String((e && e.message) || e); } }
  TXS.rev++; dirty();
}
// a picture as a texture in one flip (made once, and sent to the GPU at once: the switch then shows it in the same frame)
function texOf(p, flip) {
  const P = TXS.pics.get(p);
  if (!P || P.state !== 'ready') return null;
  const i = flip ? 1 : 0;
  if (!P.t[i]) {
    const t = P.t[i] = new THREE.Texture(P.img);
    t.name = baseName(p); t.flipY = !!flip; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.LinearEncoding; t.needsUpdate = true;   // (as Change texture's: the renderer's output is linear)
    try { GL.renderer.initTexture(t); } catch (e) { /* sent when first drawn */ }
  }
  return P.t[i];
}
function texFree(p) {
  const P = TXS.pics.get(p);
  TXS.pics.delete(p);
  if (P) { for (const t of P.t) if (t) t.dispose(); P.img = null; }
}
const texReady = p => { const P = TXS.pics.get(p); return !!(P && P.state === 'ready'); };

// ------------------------------------------------------------ each frame --
// once the cubes are worked out for this frame (triggerStep) and every object's model is built: what each object wants
// (per material and slot, the entry of the active cube entered last), put on its materials only when that changed (its
// pictures ready, lit or as scanned, its model built again: its signature); while Change texture or Fewer triangles is
// open on it, nothing (their previews win)
function texStep() {
  const s0 = STU.gen + '|' + STU.rev + '|' + STU.listing;
  if (TXS.sig !== s0 || TXS.files !== STU.files) { TXS.sig = s0; TXS.files = STU.files; texNeed(); }
  if (!TXS.any && !TXS.live) return;   // (no cube changes a picture and none is on: nothing to do)
  const want = new Map();
  let live = false;
  for (const c of STU.items.values()) {
    if (c.kind !== 'c' || !c.act || !c.rec.tex) continue;
    for (const e of c.rec.tex) {
      let m = want.get(e.on);
      if (!m) want.set(e.on, (m = new Map()));
      const k = e.mat + '|' + e.slot, w = m.get(k);
      if (!w || enteredLater(c, w)) m.set(k, { e, since: c.since, id: c.id });   // (ties by the cube's id, alike everywhere)
    }
  }
  for (const it of STU.items.values()) {
    if (it.kind !== 'o') continue;
    const held = CT.id === it.id || FT.id === it.id, m = !held && it.model ? want.get(it.id) : null, list = m ? [...m.values()].map(w => w.e) : [];
    const sig = held ? 'held' : !it.model ? '' : list.map(e => `${e.mat}|${e.slot}|${e.file}|${+texReady(e.file)}`).sort().join(',') + '|' + it.light + '|' + it.built;
    if (sig !== it.txSig) {
      it.txSig = sig;
      texOff(it);
      if (list.length) texOn(it, list);
    }
    if (it.txOn && it.txOn.length) live = true;
  }
  TXS.live = live;
}
// an entry's picture on the object's own materials (lit and, for a colour picture, as scanned), what each had kept to put
// back: as Change texture's preview puts one on (ctShow)
function texOn(it, list) {
  const ms = ctMats(it), flip = !isGltf(it.rec.file), out = [];
  for (const e of list) {
    const x = ms[e.mat], t = texOf(e.file, flip), slot = e.slot;
    if (!x || !t) continue;
    for (const g of ctTargets(it, x)) {
      if (g.scan && slot !== 'map') continue;   // (as scanned shows only its colour picture)
      const mt = g.mat;
      if (!(slot in mt)) continue;   // (a slot its kind of material has not: Phong has no roughness or metalness)
      const k = { mat: mt, slot, scan: g.scan, was: mt[slot] || null, r: mt.roughness, me: mt.metalness, em: mt.emissive ? mt.emissive.clone() : null, tr: mt.transparent, bt: mt.userData.base ? mt.userData.base.t : undefined };
      mt[slot] = t;
      if (slot === 'aoMap') { const gm = g.mesh.geometry; if (gm && gm.attributes.uv && !gm.attributes.uv2) gm.setAttribute('uv2', gm.attributes.uv); }
      if (slot === 'emissiveMap' && mt.emissive && mt.emissive.r + mt.emissive.g + mt.emissive.b === 0) mt.emissive.setRGB(1, 1, 1);
      if (slot === 'alphaMap') { mt.transparent = true; if (mt.userData.base) mt.userData.base.t = true; }
      if (slot === 'roughnessMap' && 'roughness' in mt) mt.roughness = 1;   // (the picture says how rough: its factor multiplies it)
      if (slot === 'metalnessMap' && 'metalness' in mt) mt.metalness = 1;
      if (!k.was || slot === 'alphaMap') mt.needsUpdate = true;   // (a slot filled, or emptied below, changes its program; one swapped for another does not)
      out.push(k);
    }
  }
  it.txOn = out; it.aSet = -1;
}
// its own pictures back
function texOff(it) {
  const L = it.txOn;
  it.txOn = null;
  if (!L) return;
  for (const k of L) {
    const mt = k.mat;
    mt[k.slot] = k.was;
    if ('roughness' in mt) mt.roughness = k.r;
    if ('metalness' in mt) mt.metalness = k.me;
    if (k.em && mt.emissive) mt.emissive.copy(k.em);
    mt.transparent = k.tr;
    if (mt.userData.base && k.bt !== undefined) mt.userData.base.t = k.bt;
    if (!k.was || k.slot === 'alphaMap') mt.needsUpdate = true;
  }
  it.aSet = -1;
}
// a preview of the object's own opens (Change texture, Fewer triangles): its own pictures back first, the cubes' left
// until it closes (texStep sees it held)
function texHold(it) { if (it && it.kind === 'o') { texOff(it); it.txSig = 'held'; } }

// ------------------------------------------------------------ copies, deletions, conversions --
// an object's copy (Duplicate): beside each of the original's entries, in every cube, one for the copy (a cube's 16 kept)
function texCopy(from, to) {
  for (const c of [...STU.items.values()]) {
    if (c.kind !== 'c' || !c.rec.tex || !c.rec.tex.some(e => e.on === from)) continue;
    setRec(c.id, { tex: texWithCopies(c.rec.tex, e => (e.on === from ? to : '')) });
  }
}
// a cube's entries and, after them, a copy of each entry whose item was copied (to(e): the copy's id, '' none), only as
// many as its most (max: 16) leave room for: its own entries are never pushed out (the review of v124). Its texture
// changes' (texWithCopies) and what it starts (e6n_plays.js)
function withCopies(L, to, max) {
  const out = L.slice();
  for (const e of L) { const t = to(e); if (t && out.length < max) out.push(Object.assign({}, e, { on: t })); }
  return out;
}
const texWithCopies = (L, to) => withCopies(L, to, TXS_MAX);
// what a model's materials are, for a conversion (CONV.matsOf's, with texture coordinates: Change texture's order) by
// their names and their meshes' names
const texMatsOf = root => CONV.matsOf(root).filter(e => e.uv).map(e => ({ name: e.name || '', meshes: [...new Set(e.meshes.map(n => n.name).filter(Boolean))] }));
// each material of the original found again in its GLB (null: not known): by its meshes' names and its own name, else
// its meshes', else its name when only one has it, else the same place when the GLB has as many (the converter keeps
// the order but for a mesh with several materials, whose parts glTF may list in another order)
function texRemap(before, after) {
  if (!before || !after) return null;
  return before.map((b, i) => {
    const has = a => b.meshes.length && a.meshes.some(n => b.meshes.includes(n));
    let j = after.findIndex(a => has(a) && a.name === b.name);
    if (j < 0 && b.meshes.length) { const L = after.filter(has); if (L.length === 1) j = after.indexOf(L[0]); }
    if (j < 0 && b.name && after.filter(a => a.name === b.name).length === 1) j = after.findIndex(a => a.name === b.name);
    if (j < 0 && before.length === after.length) j = i;
    return j;
  });
}
// the entries on objects switched to their GLB (switchToGLB: in its change), their materials found again there
function texSwitched(ids, map) {
  if (!map) return;
  for (const c of [...STU.items.values()]) {
    if (c.kind !== 'c' || !c.rec.tex || !c.rec.tex.some(e => ids.has(e.on) && map[e.mat] >= 0 && map[e.mat] !== e.mat)) continue;
    setRec(c.id, { tex: c.rec.tex.map(e => (ids.has(e.on) && map[e.mat] >= 0 ? Object.assign({}, e, { mat: map[e.mat] }) : e)) });
  }
}

// ------------------------------------------------------------ the cube's card --
// Changes textures: each entry (a press flashes its object; ✕ takes it off, one Undo step), and Change a texture...: an
// object (pointed at, or from the card's list), then its material (when it has more than one), a slot (Colour first) and
// one of the scene's pictures (as Change texture lists them), which adds the entry (one Undo step)
function texCubeBlocks(c, B, dis) {
  const L = c.rec.tex || [], P = STU.txp && STU.txp.id === c.id ? STU.txp : null, objs = [...STU.items.values()].filter(o => o.kind === 'o'), full = L.length >= TXS_MAX;
  if (!L.length) B.push({ kv: [['Changes textures', 'nothing']] });
  L.forEach((e, k) => B.push({ label: k ? '' : `Changes textures (${L.length})`, row: [
    { id: `txflash:${k}`, label: texWords(e), act: 'i:txFlash', v: e.on },
    { id: `untex:${k}`, label: '✕', act: 'i:untex', v: k, dis }] }));
  B.push({ row: [{ id: 'txpick', label: P ? 'Cancel' : 'Change a texture...', act: 'i:txPick', on: !!P, dis: dis || (!P && (full || !objs.length)) }] });
  if (full) B.push({ p: `${TXS_MAX} texture changes: the most a cube takes.`, c: 'amber' });
  else if (!objs.length && !L.length) B.push({ p: 'A cube can change a picture on an object while you are in it: place one first.', c: 'faint' });
  if (P && P.step === 'obj') {
    B.push({ p: (XR.on ? 'Point at an object and pull the trigger' : 'Click an object, or pick it here') + ': then its material, a slot and a picture.', c: 'amber' },
      { list: objs.map(o => ({ id: 'txon:' + o.id, label: o.rec.name, sub: baseName(o.rec.file), act: 'i:txOn', v: o.id, dis })) });
  } else if (P) {
    const o = STU.items.get(P.on);
    B.push({ kv: [['Object', o ? o.rec.name : 'not in the scene']] }, { row: [{ id: 'txback', label: 'Another object...', act: 'i:txBack', dis }] });
    const ms = o && o.model ? ctMats(o) : [];
    if (!o || !o.model) B.push({ p: `${o ? o.rec.name + '\'s' : 'Its'} model is not here yet: its materials show once it is.`, c: 'faint' });
    else if (!ms.length) B.push({ p: `${o.rec.name} has no texture coordinates (UVs): a picture cannot be laid on it.`, c: 'amber' });
    else {
      const m = ms[P.mat] || ms[0], cur = m.pics[P.slot], colourFirst = (a, b) => TXS_SLOTS.indexOf(a[0]) - TXS_SLOTS.indexOf(b[0]);
      if (ms.length > 1) B.push({ label: 'Its material', list: ms.map((x, i) => ({ id: 'txmat:' + i, label: matLabel(x), sub: Object.entries(x.pics).sort(colourFirst).map(([k, n]) => `${SLOT_NAME[k]}: ${n}`).join(' · ') || 'no pictures', act: 'i:txMat', v: i, on: x === m, dis })) });
      B.push({ label: 'Slot', row: TXS_SLOTS.map(k => ({ id: 'txslot:' + k, label: SLOT_NAME[k] + (m.pics[k] ? ' •' : ''), act: 'i:txSlot', v: k, on: P.slot === k, dis })) },
        { kv: [['Now', cur || 'none']] });
      const pics = CONV.texRank(cur && cur !== 'inside the file' ? cur : m.name || stem(o.rec.file), scenePictures(), { dir: dirOf(o.E.path) }, 1000);
      const row = p => ({ id: 'txpic:' + p, label: baseName(p), sub: (dirOf(p) || 'the scene\'s top') + ' · ' + SLOT_NAME[CONV.slotOf(p)].toLowerCase(), act: 'i:txPic', v: p, dis });
      const per = 8, pages = Math.max(1, Math.ceil(pics.length / per)), pg = Math.min(P.page, pages - 1);
      if (!pics.length) B.push({ p: 'The scene has no pictures: put some in its folder.', c: 'faint' });
      else B.push({ page: true, label: `Pick a picture (${pics.length})`, list: pics.map(row) }, { xr: true, label: `Pick a picture (${pics.length})`, list: pics.slice(pg * per, pg * per + per).map(row) });
      if (pages > 1) B.push({ xr: true, label: `${pg * per + 1} to ${Math.min(pics.length, pg * per + per)} of ${pics.length}`, row: [{ id: 'txpg:-', label: '◂ Previous', act: 'i:txPg', v: -1, dis: pg <= 0 }, { id: 'txpg:+', label: 'Next ▸', act: 'i:txPg', v: 1, dis: pg >= pages - 1 }] });
      if (['roughnessMap', 'metalnessMap'].includes(P.slot) && !ctTargets(o, m).some(x => x.mat.isMeshStandardMaterial)) B.push({ p: 'Its material shows no roughness or metalness here (a GLB\'s does: Convert to GLB first).', c: 'faint' });
    }
  }
  B.push({ p: 'While you are in the cube, its pictures are shown on those objects in place of their own, for you only (as everything a cube does; for everyone here when it works for everyone); they go back as you leave it (a cube that stays keeps them). As scanned shows only a Colour picture.', c: 'faint' });
}
Object.assign(ITEM_ACT, {
  // the pick: on, or off (Cancel); an object chosen (its material with a colour picture, Colour); another object; the
  // material, the slot and a page of pictures; a picture adds the entry (one for that object, material and slot: another
  // there takes its place)
  txPick: c => { if (c.kind === 'c') { STU.txp = STU.txp && STU.txp.id === c.id ? null : { id: c.id, step: 'obj', on: '', mat: 0, slot: 'map', page: 0 }; STU.pick = null; STU.plp = null; } },   // (one pick at a time)
  txOn: (c, oid) => {
    const o = STU.items.get(oid);
    if (!STU.txp || STU.txp.id !== c.id || !o || o.kind !== 'o') return;
    const ms = o.model ? ctMats(o) : [];
    Object.assign(STU.txp, { step: 'pic', on: oid, mat: Math.max(0, ms.findIndex(x => x.pics.map)), slot: 'map', page: 0 });
  },
  txBack: c => { if (STU.txp && STU.txp.id === c.id) Object.assign(STU.txp, { step: 'obj', on: '' }); },
  txMat: (c, i) => { if (STU.txp && STU.txp.id === c.id) STU.txp.mat = Math.max(0, +i || 0); },
  txSlot: (c, k) => { if (STU.txp && STU.txp.id === c.id && TXS_SLOTS.includes(k)) STU.txp.slot = k; },
  txPg: (c, d) => { if (STU.txp && STU.txp.id === c.id) STU.txp.page = Math.max(0, STU.txp.page + (+d || 0)); },
  txPic: (c, p) => {
    const P = STU.txp, o = P && STU.items.get(P.on);
    if (c.kind !== 'c' || !P || P.id !== c.id || P.step !== 'pic' || !o || !o.model || !ctMats(o)[P.mat] || !STU.fileMap.has(p)) return;
    const L = (c.rec.tex || []).filter(e => !(e.on === P.on && e.mat === P.mat && e.slot === P.slot));
    if (L.length >= TXS_MAX) return;
    setRec(c.id, { tex: L.concat({ on: P.on, mat: P.mat, slot: P.slot, file: p }) });
    STU.txp = null;
  },
  untex: (c, k) => { const L = (c.rec.tex || []).slice(); if (!(+k >= 0 && +k < L.length)) return; L.splice(+k, 1); setRec(c.id, { tex: L.length ? L : undefined }); },
  txFlash: (c, id) => { STU.flash = STU.items.has(id) ? { id, at: performance.now(), tex: true } : null; },
});
PANE_ONLY.push('txPick', 'txOn', 'txBack', 'txMat', 'txSlot', 'txPg', 'txFlash');
// for tests: the pictures read, and what an object shows now (per material and slot, by its lit materials)
function texState(id) {
  const out = { pics: Object.fromEntries([...TXS.pics].map(([p, P]) => [p, { state: P.state, w: P.img ? P.img.width : 0, h: P.img ? P.img.height : 0, t: P.t.map(t => !!t), err: P.err }])) };
  const it = id && STU.items.get(id);
  if (it && it.kind === 'o' && it.model) {
    out.on = (it.txOn || []).map(k => [k.slot, k.scan ? 'scan' : 'lit', k.mat[k.slot] ? k.mat[k.slot].name : '']);
    out.sig = it.txSig || '';
    out.mats = ctMats(it).map(x => ctTargets(it, x).map(g => [g.scan ? 'scan' : 'lit', Object.fromEntries(TXS_SLOTS.filter(k => g.mat[k]).map(k => [k, g.mat[k].name || texName(g.mat[k])]))]));
  }
  return out;
}
