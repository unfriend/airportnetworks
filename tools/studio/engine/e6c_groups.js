
// ================================================================= GROUPS ==
// A group is a named set of items that move together (tools/studio/SPEC.md, "Groups"): objects, sounds and trigger
// cubes (a cut-out belongs to its object and moves with it, so it is never a member). Its record: { name, items } (the
// members' ids). An item is in one group at most: an id two groups name stays in the one with the lower id (groupOf, the
// same on every device); no groups in groups; 50 a scene. A click (the trigger, a pinch) on a member selects its group,
// a second one on the same member, its group selected, that member alone (pressItem, e7_explore.js). A selected group
// moves, turns and sizes as one about its pivot (the middle of the box round its members, on the floor): turns about the
// vertical only (a cube stays level, an object's own turn and a cube's yaw gain it), sizes alike on every axis (places,
// an object's size with its cut-outs and the offsets of the sounds following it, a cube's size, a sound's reach). A
// sound in the group that follows an object in it simply follows; one that follows an object outside it moves as when
// carried by hand (its offset rewritten against its target, soundAt). Every move is one change: one Undo step, every
// member's record written together (one state in a room). A group left with fewer than 2 members (deleted, picked away)
// goes in the same change, unless it is picking its members now. While editing a selected group is drawn as a faint box
// round its members; its name is the selection's label
const GRP = { rev: -1, of: new Map() };
// member id -> its group (groups by id: the lower first, so an id two of them name stays in that one)
function groupMap() {
  if (GRP.rev === STU.rev) return GRP.of;
  GRP.rev = STU.rev; GRP.of = new Map();
  const gs = [...STU.items.values()].filter(g => g.kind === 'g').sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const g of gs) for (const id of g.rec.items) { const it = STU.items.get(id); if (it && GROUP_KINDS.includes(it.kind) && !GRP.of.has(id)) GRP.of.set(id, g); }
  return GRP.of;
}
function groupOf(id) { return groupMap().get(id) || null; }
// a group's members here, in its record's order
function members(g) { return g && g.kind === 'g' ? g.rec.items.map(id => STU.items.get(id)).filter(it => it && groupOf(it.id) === g) : []; }

// ------------------------------------------------------------ the pivot --
// the box round a group's members as they are shown now (the scene's frame): an object's own box (its unseen one; a model
// not here yet, the grey box's 0.4 m), a cube's, a sound's point
const _gb = new THREE.Box3(), _gm = new THREE.Matrix4(), _gm2 = new THREE.Matrix4(), _gp = new THREE.Vector3(), _gsb = new THREE.Box3();
function groupBox(g, out) {
  out.makeEmpty();
  if (!BOX1.boundingBox) BOX1.computeBoundingBox();
  GL.items.updateWorldMatrix(true, false);
  _gm.copy(GL.items.matrixWorld).invert();
  for (const it of members(g)) {
    if (it.kind === 's') { out.expandByPoint(soundPoint(it, _gp)); continue; }
    if (it.kind === 'o' && !it.model) { out.expandByPoint(it.holder.position); out.expandByPoint(_gp.copy(it.holder.position).setY(it.holder.position.y + 0.4)); continue; }
    const t = it.kind === 'o' ? it.proxy : it.holder;
    t.updateWorldMatrix(true, false);
    out.union(_gb.copy(BOX1.boundingBox).applyMatrix4(_gm2.multiplyMatrices(_gm, t.matrixWorld)));
  }
  return out;
}
// where a sound is now: carried or gliding, where it is shown; following something here, where that puts it (soundStep's
// rule, worked out now: right after an Undo its holder waits for the next frame); else its own place
function soundPoint(it, out) {
  const nd = it.carry || it.gl || !it.rec.on ? null : followNode(it);
  return nd ? followAt(it, nd, out) : it.carry || it.gl ? out.copy(it.holder.position) : out.fromArray(it.rec.p);
}
const pivotOf = b => (b.isEmpty() ? new THREE.Vector3() : new THREE.Vector3((b.min.x + b.max.x) / 2, 0, (b.min.z + b.max.z) / 2));
// where a move begins: the pivot, and each member as it stands (its record, and where it is shown: a sound that follows
// something sounds where that puts it); a sound that follows an object of the group rides with it
function groupBase(g) {
  const ms = members(g), ids = new Set(ms.map(m => m.id));
  return { id: g.id, P: pivotOf(groupBox(g, new THREE.Box3())), list: ms.map(m => ({ id: m.id, kind: m.kind, rec: JSON.parse(JSON.stringify(m.rec)),
    pos: m.kind === 's' ? soundPoint(m, new THREE.Vector3()) : m.holder.position.clone(), rides: m.kind === 's' && !!m.rec.on && ids.has(m.rec.on) && !!followOf(m) })) };
}

// ------------------------------------------------------------- moving --
// the members moved together from where they stood (B, groupBase): by t (the scene's frame), a turn th about the vertical
// and a size k, about the pivot (x' = P + t + turn(k (x - P))). With write their records take it (setObj: an object's
// cut-outs and the sounds following it keep their place on it as it is sized); a member being carried (the arrows, a
// grip) is shown there at once, its record written at most ten times a second and as it is let go. A value past what
// a record takes is held at the limit and said on the group's card (sizing back does not undo that; Undo does)
const _gpy = new THREE.Vector3(0, 1, 0), _gpq = new THREE.Quaternion(), _gpv = new THREE.Vector3();
function groupAt(B, x, t, th, k, out) { return out.copy(x).sub(B.P).multiplyScalar(k).applyAxisAngle(_gpy, th).add(B.P).add(t); }
function groupMove(B, t, th, k, write) {
  const g = STU.items.get(B.id), held = [];
  if (!g || g.kind !== 'g') return;
  const lim = (v, a, b, it) => { const c = clamp(v, a, b); if (Math.abs(c - v) > 1e-9 && !held.includes(it.rec.name)) held.push(it.rec.name); return c; };
  _gpq.setFromAxisAngle(_gpy, th);
  for (const m of B.list) {
    const it = STU.items.get(m.id), r = m.rec;
    if (!it || it.kind !== m.kind) continue;
    if (m.kind === 'o') {
      const p = groupAt(B, _gpv.fromArray(r.p), t, th, k, new THREE.Vector3()), q = _gpq.clone().multiply(new THREE.Quaternion().fromArray(r.q)).normalize(), s = lim(r.s * k, 1e-4, 1e4, it);
      if (write) setObj(it.id, { p: p.toArray(), q: q.toArray(), s });
      if (it.carry) { it.holder.position.copy(p); it.holder.quaternion.copy(q); it.holder.scale.setScalar(s); }
    } else if (m.kind === 'c') {
      const p = groupAt(B, _gpv.fromArray(r.p), t, th, k, new THREE.Vector3()), yaw = r.yaw + th, size = r.size.map(v => lim(v * k, 0.05, 100, it));
      if (write) setRec(it.id, { p: p.toArray(), yaw, size });
      if (it.carry) { it.holder.position.copy(p); it.holder.quaternion.setFromAxisAngle(_gpy, yaw); it.holder.scale.fromArray(size); }
    } else {
      const rr = lim(r.r * k, 0.1, 20, it);
      if (m.rides) { if (write) setRec(it.id, { r: rr }); continue; }   // (carried by its object)
      const p = groupAt(B, m.pos, t, th, k, new THREE.Vector3());
      if (write) setRec(it.id, Object.assign(soundAt(it, p), { r: rr }));
      if (it.carry) it.holder.position.copy(p);
    }
  }
  if (write) g.note = held.length ? `Sized this far, ${held.join(', ')} ${held.length > 1 ? 'are' : 'is'} held at the limit (an object a ten-thousandth to 10,000 times, a cube's side 5 cm to 100 m, a sound's full volume within 10 cm to 20 m): sizing back does not undo that; Undo does.` : '';
}
// the group's lowest point onto the floor
function groupFloor(g) {
  const b = groupBox(g, new THREE.Box3());
  if (!b.isEmpty() && Math.abs(b.min.y) > 5e-4) groupMove(groupBase(g), new THREE.Vector3(0, -b.min.y, 0), 0, 1, true);
}
// a move by hand begins (the page's arrows, a grip): the members as they stand, carried until it ends (the room's records
// wait), one change; and ends: carried no more, each where its record puts it
function groupHold(g) {
  const B = g.base = groupBase(g);
  g.T = { t: new THREE.Vector3(), th: 0, k: 1 };
  beginChange([g.id].concat(B.list.map(m => m.id)));
  for (const m of B.list) if (!m.rides) { const it = STU.items.get(m.id); it.carry = true; it.gl = null; }
  g.carry = true;
  g.holder.position.copy(B.P); g.holder.quaternion.identity(); g.holder.scale.set(1, 1, 1);
  return B;
}
function groupRelease(g, B) {
  B = B || g.base;
  if (g) { g.base = null; g.T = null; g.carry = false; }
  if (!B) return;
  for (const m of B.list) {
    const it = STU.items.get(m.id);
    if (!it || m.rides || it.kind !== m.kind) continue;
    it.carry = false;
    if (it.kind !== 's' || !it.rec.on) { poseOf(it); it.holder.position.copy(_pp); it.holder.quaternion.copy(_pq); it.holder.scale.copy(_ps); }
  }
}

// --------------------------------------------------------- membership --
// a group's members it may no longer hold (one it named moved into another): the groups left with fewer than 2 go (not
// the one picking its members now: it may take more)
function groupTidy(gs) {
  for (const h of gs) if (STU.items.get(h.id) === h && members(h).length < 2 && !(STU.gpick && STU.gpick.id === h.id)) removeItem(h.id);
}
// an item out of every group that names it (but except)
function groupLeave(id, except) {
  const gs = [...STU.items.values()].filter(h => h.kind === 'g' && h.id !== except && h.rec.items.includes(id));
  for (const h of gs) setRec(h.id, { items: h.rec.items.filter(i => i !== id) });
  groupTidy(gs);
}
// Make a group... (an item's card, within its change): a group of that item, selected, picking its members
function makeGroup(id) {
  const it = STU.items.get(id);
  if (!it || !GROUP_KINDS.includes(it.kind) || !canAdd('g')) return '';
  const gid = newId();
  groupLeave(id);
  if (!putItem(gid, 'g', norm('g', { name: nameFor('Group'), items: [id] }))) return '';
  select(gid);
  STU.gpick = { id: gid, made: true, step: null };
  return gid;
}
// picking a group's members: an item pointed at (a click, the trigger, a pinch; a cut-out stands for its object) goes in,
// or out if it is in (one change each); one in another group moves into this one
function groupToggle(gid, id) {
  const g = STU.items.get(gid);
  let it = STU.items.get(id);
  if (!g || g.kind !== 'g' || !it || !editOn()) return;
  if (it.kind === 'x') it = cutObj(it);
  if (!it || !GROUP_KINDS.includes(it.kind)) return;
  const inIt = groupOf(it.id) === g, mid = it.id;
  change(() => {
    if (inIt) setRec(gid, { items: g.rec.items.filter(i => i !== mid) });
    else { groupLeave(mid, gid); setRec(gid, { items: g.rec.items.filter(i => i !== mid).concat(mid) }); }
  });
  sfxAct(inIt ? 'snap' : 'link', 'world', null);
}
// picking ends (Done, another selection, Escape, editing off): a group of fewer than 2 goes; one made just now with
// nothing done since is taken back as if never made (the group its item left with it)
function gpickEnd() {
  const G = STU.gpick;
  STU.gpick = null;
  dirty(true);
  const g = G && STU.items.get(G.id);
  if (!g || g.kind !== 'g' || members(g).length >= 2) return;
  if (G.made && G.step && UNDO[UNDO.length - 1] === G.step && !SNAP) { UNDO.pop(); undoList(G.step); return; }
  change(() => removeItem(g.id));
}

// --------------------------------------------------------- duplicate --
// why a group cannot be copied now ('' it can): the scene's limits, its copies and its objects' cut-outs counted
function groupDupWhy(g) {
  const ms = members(g), need = { o: 0, c: 0, s: 0, x: 0, g: 1 };
  if (!ms.length) return 'It has no members here.';
  for (const m of ms) { need[m.kind]++; if (m.kind === 'o') need.x += cutsOn(m.id).length; }
  const k = Object.keys(need).find(q => need[q] && countOf(q) + need[q] > LIMITS[q]);
  return k ? `No room for its copy: a scene holds ${LIMITS[k]} ${KIND_NAME[k]}s at most.` : '';
}
// every member copied as a new group, beside it (along x, past its width): an object's cut-outs onto its copy; a cube in
// the group lists the copies of what it listed in the group (the rest as it was); a sound that follows an object in the
// group follows its copy; each copy also joins the lists of the cubes outside the group its original is in (as cubeCopy)
function duplicateGroup(g) {
  if (!editOn() || groupDupWhy(g)) return '';
  const ms = members(g), ids = new Set(ms.map(m => m.id)), b = groupBox(g, new THREE.Box3());
  const d = new THREE.Vector3(b.isEmpty() ? 1 : r3(b.max.x - b.min.x + 0.5), 0, 0), add = v => v.map((x, i) => x + d.getComponent(i));
  const used = new Set(), fresh = () => { let id; do id = newId(); while (used.has(id)); used.add(id); return id; };
  const map = new Map(), base = n => nameFor(n.replace(/ \d+$/, '')), nid = fresh();
  change(() => {
    for (const m of ms) { map.set(m.id, fresh()); if (m.kind === 'o') for (const x of cutsOn(m.id)) map.set(x.id, fresh()); }
    for (const m of ms) if (m.kind === 'o') {
      putItem(map.get(m.id), 'o', norm('o', Object.assign({}, m.rec, { name: base(m.rec.name), p: add(m.rec.p) })));
      for (const x of cutsOn(m.id)) putItem(map.get(x.id), 'x', norm('x', Object.assign({}, x.rec, { on: map.get(m.id), name: base(x.rec.name) })));
    }
    const mapL = l => [...new Set(l.map(i => map.get(i) || i))];
    for (const m of ms) if (m.kind === 'c') putItem(map.get(m.id), 'c', norm('c', Object.assign({}, m.rec, { name: base(m.rec.name), p: add(m.rec.p), show: mapL(m.rec.show), hide: mapL(m.rec.hide) })));
    for (const m of ms) if (m.kind === 's') {
      const r = m.rec, nr = Object.assign({}, r, { name: base(r.name), p: add(r.p) });
      if (r.on && ids.has(r.on)) nr.on = map.get(r.on);   // (it follows the copy of its object: the same bone and offset)
      else if (r.on) { const nd = measureNode(m), at = m.holder.position.clone().add(d); nr.p = at.toArray(); if (nd) nr.o = offsetAt(nd, at, followK(followOf(m))); }   // (what it followed, beside where it is)
      putItem(map.get(m.id), 's', norm('s', nr));
    }
    for (const c of [...STU.items.values()]) {
      if (c.kind !== 'c' || ids.has(c.id) || used.has(c.id)) continue;
      const more = l => l.concat([...map].filter(([a]) => l.includes(a)).map(([, z]) => z));
      const sh = more(c.rec.show), hi = more(c.rec.hide);
      if (sh.length !== c.rec.show.length || hi.length !== c.rec.hide.length) setRec(c.id, { show: sh, hide: hi });
    }
    putItem(nid, 'g', norm('g', { name: base(g.rec.name), items: ms.map(m => map.get(m.id)) }));
  });
  select(nid);
  sfxAct('place', 'world', null);
  return nid;
}

// --------------------------------------------------------- every frame --
// a selected group (editing): its pivot where the arrows hold it (not while it moves), and its faint box round its members
function groupsStep(editing) {
  for (const g of STU.items.values()) {
    if (g.kind !== 'g') continue;
    const sel = editing && STU.sel === g.id, L = g.look;
    if (!sel && !g.carry) { L.deco.visible = false; continue; }
    const b = groupBox(g, _gsb);
    if (!g.carry) { g.holder.position.copy(pivotOf(b)); g.holder.quaternion.identity(); g.holder.scale.set(1, 1, 1); }
    L.deco.visible = sel && !b.isEmpty();
    if (!L.deco.visible) continue;
    const m = 0.04;   // (a little outside its members)
    L.deco.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
    L.box.scale.set(b.max.x - b.min.x + 2 * m, b.max.y - b.min.y + 2 * m, b.max.z - b.min.z + 2 * m);
  }
}

// the card's actions (page and headset alike): Make a group... (an item's card), Add or remove items... (the group's: a
// pick mode, this device's own), Ungroup (the group goes, its members stay)
Object.assign(ITEM_ACT, {
  mkgroup: it => { if (GROUP_KINDS.includes(it.kind)) makeGroup(it.id); },
  gpick: g => { if (g.kind !== 'g') return; if (STU.gpick && STU.gpick.id === g.id) gpickEnd(); else STU.gpick = { id: g.id, made: false, step: null }; },
  ungroup: g => { if (g.kind === 'g') removeItem(g.id); },
});
