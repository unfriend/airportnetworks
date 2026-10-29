// The props table (manifest: table.md). Life size: 1 unit is 1 m, the floor at y = 0, the table round the origin with
// its top at 0.86 m. Round its rim a plate per story in the story's colour, a place card at its edge naming the story,
// and the story's miniatures standing on it (12 cm, turned to face out); in the middle the stage, where the picked prop
// stands 40 cm tall and turns slowly. The models come from lowpoly.js (feed); they are built a few per frame
// (update -> buildSome), so the table fills in without a stall. A miniature moved by hand keeps a record of where it
// was put (rec: [x, y, z, qx, qy, qz, qw, s] in this frame, rounded; s its size, 1 its own), the room's in a shared
// room; without one it stands at home on its plate. Anything else glides to where it should be.
SETS.table = function (K) {
  const group = new THREE.Group();
  const TOP = 0.86, R = 1.15, PLATE = 0.012, MINI = 0.12, STAGE_R = 0.28, STAGE_Y = TOP + 0.05, BIG = 0.4;
  const RINGS = [0.98, 0.82, 0.66, 0.5], STEP = 0.16, CARD_R = 1.105, CARD_H = 0.062, CARD_W = 0.25;
  const disposable = [];
  const keep = x => (disposable.push(x), x);
  const std = o => keep(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0.12 }, o)));
  const basic = o => keep(new THREE.MeshBasicMaterial(o));
  const mesh = (geo, mat, p) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); return m; };
  const flat = g => g.rotateX(-Math.PI / 2);   // a shape in the x-y plane laid on the floor, facing up
  const NAVY = new THREE.Color('#15233b');
  // a soft round glow (additive), for the stage and the highlights
  const glowTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d'), g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    return keep(new THREE.CanvasTexture(cv));
  })();
  const glowMat = (col, o) => basic({ map: glowTex, color: col, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });

  // ---- the floor (hidden in passthrough: table_floor 0) and the table
  const floor = new THREE.Group(), floorDisc = mesh(flat(new THREE.CircleGeometry(5, 72)), std({ color: 0x070d19, roughness: 0.95, metalness: 0 }));
  floor.add(floorDisc);
  for (const [r, o] of [[1.6, 0.3], [2.7, 0.16]]) { const m = mesh(flat(new THREE.RingGeometry(r, r + 0.014, 120)), basic({ color: 0x46d9ff, transparent: true, opacity: o, depthWrite: false })); m.position.y = 0.002; floor.add(m); }
  group.add(floor);
  const table = new THREE.Group(), tableTop = mesh(new THREE.CylinderGeometry(R, R, 0.045, 96), std({ color: NAVY, roughness: 0.55, metalness: 0.2 }), [0, TOP - 0.0225, 0]);
  table.add(tableTop);
  table.add(mesh(new THREE.CylinderGeometry(R + 0.004, R + 0.004, 0.01, 96, 1, true), basic({ color: 0x2397c4 }), [0, TOP - 0.006, 0]));   // the glowing rim
  table.add(mesh(new THREE.CylinderGeometry(0.11, 0.17, TOP - 0.07, 24), std({ color: 0x0e1828 }), [0, (TOP - 0.07) / 2 + 0.03, 0]));
  table.add(mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.03, 48), std({ color: 0x0e1828 }), [0, 0.015, 0]));
  table.add(mesh(flat(new THREE.RingGeometry(0.4, 0.406, 96)), basic({ color: 0x2397c4, transparent: true, opacity: 0.5 }), [0, TOP + 0.001, 0]));
  // the stage: a dark drum with a glowing edge and a soft light on it
  table.add(mesh(new THREE.CylinderGeometry(STAGE_R, STAGE_R + 0.012, 0.05, 64), std({ color: 0x0f1b2e, roughness: 0.4, metalness: 0.3 }), [0, TOP + 0.025, 0]));
  table.add(mesh(flat(new THREE.RingGeometry(STAGE_R - 0.012, STAGE_R, 64)), basic({ color: 0x46d9ff }), [0, STAGE_Y + 0.001, 0]));
  const stageGlow = mesh(flat(new THREE.PlaneGeometry(1.1, 1.1)), glowMat(0x46d9ff, 0.22), [0, STAGE_Y + 0.002, 0]);
  table.add(stageGlow);
  group.add(table);

  // ---- the plates, their place cards and the miniatures' homes (layout)
  const minis = new Map(), plates = [], order = [];
  let cardsCv = null, cardsTex = null, groups = [];
  const angleOf = (x, z) => Math.atan2(x, z);
  const at = (r, a, y) => new THREE.Vector3(r * Math.sin(a), y, r * Math.cos(a));
  // an annular sector of the table top (angles a0..a1, x = r sin a, z = r cos a), h thick, standing on y = 0
  function sector(r0, r1, a0, a1, h) {
    const sh = new THREE.Shape(), n = Math.max(6, Math.round((a1 - a0) * 40));
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; sh[i ? 'lineTo' : 'moveTo'](r1 * Math.sin(a), -r1 * Math.cos(a)); }
    for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; sh.lineTo(r0 * Math.sin(a), -r0 * Math.cos(a)); }
    return new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2);
  }
  // the place cards: one canvas, a row per story (512 x 128 for a card 0.25 m wide; a narrower card shows part of it)
  function drawCards() {
    if (!cardsCv) return;
    const c = cardsCv.getContext('2d'), W = 512, H = 128, font = (px, w) => `${w || 400} ${px}px B612, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    c.clearRect(0, 0, cardsCv.width, cardsCv.height);
    groups.forEach((G, i) => {
      const y = i * H, w = Math.round(W * G.cardW / CARD_W);
      c.fillStyle = '#0b1526'; c.fillRect(0, y, w, H);
      c.fillStyle = G.col; c.fillRect(0, y, w, 8);
      c.textBaseline = 'top'; c.textAlign = 'center';
      const fit = (t, px, wt, maxW) => { let s = px; for (; s > 14; s--) { c.font = font(s, wt); if (c.measureText(t).width <= maxW) break; } return s; };
      fit(G.kick.toUpperCase(), 28, 700, w - 24); c.fillStyle = G.col; c.fillText(G.kick.toUpperCase(), w / 2, y + 20);
      fit(G.title, 50, 700, w - 24); c.fillStyle = '#e7eef8'; c.fillText(G.title, w / 2, y + 58);
    });
    cardsTex.needsUpdate = true;
  }
  // groups: [{ key, col, kick, title, keys: [miniature keys] }] in their order round the table, from the front (+z),
  // the viewer's side, round to the left. Each story's share of the rim grows with its count; its miniatures stand on
  // rings from the rim inwards, 16 cm apart
  function layout(G) {
    groups = G;
    const W = G.reduce((a, g) => a + g.keys.length + 1.2, 0), unit = Math.PI * 2 / W;
    cardsCv = document.createElement('canvas'); cardsCv.width = 512; cardsCv.height = 128 * Math.max(1, G.length);
    cardsTex = keep(new THREE.CanvasTexture(cardsCv)); cardsTex.anisotropy = 4;
    const cardMat = basic({ map: cardsTex }), backMat = std({ color: 0x0b1526 });
    let a = unit * (G[0] ? (G[0].keys.length + 1.2) / 2 : 0);   // the first story's middle at the front
    G.forEach((g, gi) => {
      const span = unit * (g.keys.length + 1.2), a1 = a, a0 = a - span, mid = (a0 + a1) / 2, m = 0.018;
      a -= span;
      // fill the rings from the rim inwards
      const slots = [];
      let left = g.keys.length, ri = 0, rin = RINGS[0];
      while (left > 0 && ri < RINGS.length) {
        const r = RINGS[ri], cap = Math.max(1, Math.floor(((span - 2 * m) * r - 0.02) / STEP) + 1), n = Math.min(left, cap);
        for (let j = 0; j < n; j++) slots.push([r, mid + (j - (n - 1) / 2) * STEP / r]);
        left -= n; rin = r; ri++;
      }
      const col = new THREE.Color(g.col), plate = mesh(sector(rin - 0.085, R - 0.075, a0 + m, a1 - m, PLATE), std({ color: col.clone().lerp(NAVY, 0.7), roughness: 0.5 }), [0, TOP, 0]);
      group.add(plate);
      const edge = mesh(flat(new THREE.RingGeometry(R - 0.083, R - 0.075, Math.max(8, Math.round(span * 40)), 1, a0 + m - Math.PI / 2, span - 2 * m)), basic({ color: col }), [0, TOP + PLATE + 0.0008, 0]);
      group.add(edge);
      // the place card at the rim, leaning back, facing out
      const cw = Math.min(CARD_W, (span - 2 * m) * CARD_R - 0.02);
      g.cardW = cw;
      const geo = new THREE.PlaneGeometry(cw, CARD_H), uv = geo.attributes.uv, v0 = 1 - (gi + 1) / G.length, v1 = 1 - gi / G.length, u1 = cw / CARD_W;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u1, v0 + (v1 - v0) * uv.getY(i));
      const card = new THREE.Group(), lean = 0.42;
      card.position.copy(at(CARD_R, mid, TOP + PLATE + Math.cos(lean) * CARD_H / 2));
      card.rotation.set(-lean, mid, 0, 'YXZ');
      card.add(new THREE.Mesh(geo, cardMat));
      const back = new THREE.Mesh(new THREE.PlaneGeometry(cw, CARD_H), backMat); back.rotation.y = Math.PI; card.add(back);
      group.add(card);
      plates.push({ key: g.key, mid, r: (rin + R) / 2, plate, card });
      g.keys.forEach((k, j) => {
        const [r, sa] = slots[j], home = at(r, sa, TOP + PLATE), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sa);
        const holder = new THREE.Group();
        holder.position.copy(home); holder.quaternion.copy(q); holder.scale.setScalar(MINI);
        // its home: a dark disc ringed in the story's colour (seen while the miniature is built, or moved away)
        const mark = mesh(flat(new THREE.CircleGeometry(0.058, 28)), std({ color: 0x0a1424, roughness: 0.7 }), [home.x, TOP + PLATE + 0.0006, home.z]);
        mark.add(mesh(flat(new THREE.RingGeometry(0.054, 0.06, 28)), basic({ color: col, transparent: true, opacity: 0.7 }), [0, 0.0004, 0]));
        group.add(mark);
        // what the pointer finds: an unseen box round the model (sized once it is built)
        const proxy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), basic({ visible: false }));
        proxy.position.y = 0.5; proxy.userData.key = k;
        holder.add(proxy);
        group.add(holder);
        minis.set(k, { key: k, holder, proxy, home, homeQ: q, rec: null, carry: false, s: 1, model: null, h: 1, hover: 0 });
        order.push(k);
      });
    });
    drawCards();
  }

  // ---- the models
  let MODELS = null;
  const queue = [];
  const feed = M => { MODELS = M; queue.length = 0; for (const k of order) if (M[k] && !minis.get(k).model) queue.push(k); };
  function buildOne(k) {
    const m = minis.get(k);
    if (!m || m.model || !MODELS || !MODELS[k]) return false;
    const g = MODELS[k].build(THREE);
    const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    m.proxy.scale.set(Math.max(0.35, sz.x), Math.max(0.35, sz.y), Math.max(0.35, sz.z)); m.proxy.position.copy(c);
    m.h = Math.max(0.2, bb.max.y);
    m.holder.add(g); m.model = g;
    const i = queue.indexOf(k); if (i >= 0) queue.splice(i, 1);
    return true;
  }
  // build for up to ms milliseconds (at least one); the picked one first
  function buildSome(ms) {
    const t0 = performance.now();
    let n = 0;
    if (pick && !minis.get(pick).model && buildOne(pick)) n++;
    while (queue.length && (n === 0 || performance.now() - t0 < ms)) if (buildOne(queue[0])) n++; else queue.shift();
    return n;
  }
  const built = () => order.filter(k => minis.get(k).model).length;

  // ---- hover, pick and the stage
  let hover = null, pick = null, stageModel = null, stageGrow = 0, stageTurn = 0;
  const stage = new THREE.Group();
  stage.position.set(0, STAGE_Y, 0);
  group.add(stage);
  const ring = (col, o) => { const m = mesh(flat(new THREE.RingGeometry(0.068, 0.082, 40)), basic({ color: col, transparent: true, opacity: o, depthWrite: false }), [0, 0, 0]); m.visible = false; group.add(m); return m; };
  const hoverRing = ring(0x9fe8ff, 0.95), pickRing = ring(0xffffff, 0.9);
  const hoverGlow = mesh(flat(new THREE.PlaneGeometry(0.26, 0.26)), glowMat(0x46d9ff, 0.5));
  hoverGlow.visible = false; group.add(hoverGlow);
  function setPick(k) {
    k = k && minis.has(k) ? k : null;
    if (k === pick && (stageModel || !k)) return;
    pick = k;
    if (stageModel) { stage.remove(stageModel); stageModel = null; }
    if (!k) return;
    buildOne(k);
    const m = minis.get(k);
    if (m.model) { stageModel = m.model.clone(); stage.add(stageModel); stageGrow = 0; }
    pickRing.material.color.set(storyCol(k));
  }
  let storyCol = () => '#ffffff';

  // ---- moved miniatures: records, glides and carrying
  const r3 = v => Math.round(v * 1000) / 1000, r2 = v => Math.round(v * 100) / 100;
  const okRec = a => Array.isArray(a) && a.length === 8 && a.every(Number.isFinite) && Math.abs(a[0]) <= 6 && Math.abs(a[2]) <= 6 && a[1] >= 0 && a[1] <= 3 &&
    a[7] >= 0.25 && a[7] <= 4 && Math.hypot(a[3], a[4], a[5], a[6]) > 0.5;
  const poseRec = m => { const p = m.holder.position, q = m.holder.quaternion; return [r3(p.x), r3(p.y), r3(p.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w), r2(m.s)]; };
  // a miniature's record: where it was put, as the room has it (while carried here, where it is now)
  const recOf = k => { const m = minis.get(k); return !m ? null : m.carry ? poseRec(m) : m.rec; };
  function setRec(k, a) { const m = minis.get(k); if (m) m.rec = okRec(a) ? a.slice() : null; }
  // carried by a hand: placed straight where it is (p and q in this frame), s its size
  function carryTo(k, p, q, s) {
    const m = minis.get(k);
    if (!m) return;
    m.carry = true; m.holder.position.copy(p); m.holder.quaternion.copy(q); m.s = clamp(s, 0.25, 4);
    if (m.holder.position.y < 0) m.holder.position.y = 0;
  }
  // let go: it stays where it is (rounded, as the room keeps it)
  function drop(k) { const m = minis.get(k); if (!m || !m.carry) return; m.carry = false; m.rec = poseRec(m); }
  function tidy() { for (const m of minis.values()) { m.carry = false; m.rec = null; } }
  const _tp = new THREE.Vector3(), _tq = new THREE.Quaternion();
  function glide(dt) {
    const k = 1 - Math.exp(-dt * 8);
    for (const m of minis.values()) {
      if (!m.carry) {
        if (m.rec) { _tp.fromArray(m.rec, 0); _tq.fromArray(m.rec, 3).normalize(); } else { _tp.copy(m.home); _tq.copy(m.homeQ); }
        const ts = m.rec ? m.rec[7] : 1;
        m.holder.position.lerp(_tp, k); m.holder.quaternion.slerp(_tq, k); m.s += (ts - m.s) * k;
      }
      m.hover += ((m.key === hover ? 1 : 0) - m.hover) * (1 - Math.exp(-dt * 12));
      m.holder.scale.setScalar(MINI * m.s * (1 + 0.15 * m.hover));
    }
  }
  // the rings and the glow under the hovered and the picked miniature, wherever it stands
  function marks() {
    for (const [r, k] of [[hoverRing, hover], [pickRing, pick]]) {
      const m = k && minis.get(k);
      r.visible = !!(m && m.model);
      if (!r.visible) continue;
      r.position.set(m.holder.position.x, m.holder.position.y + 0.0015, m.holder.position.z);
      r.scale.setScalar(m.s * (r === hoverRing ? 1.12 : 1));
    }
    hoverGlow.visible = hoverRing.visible;
    if (hoverGlow.visible) { hoverGlow.position.copy(hoverRing.position); hoverGlow.position.y += 0.001; hoverGlow.scale.setScalar(minis.get(hover).s); }
  }

  const params = { table_a: 1, table_floor: 1 };
  return {
    group, params,
    setAlpha(a) { group.visible = a > 0.01; },
    update(S, t, dt) {
      floor.visible = (S.table_floor === undefined ? 1 : S.table_floor) > 0.5;
      if (MODELS && queue.length) buildSome(5);
      glide(dt || 0);
      marks();
      if (stageModel) {
        stageGrow = Math.min(1, stageGrow + (dt || 0) * 2.2);
        stageTurn += (dt || 0) * 0.45;
        stageModel.scale.setScalar(BIG * smooth(stageGrow));
        stageModel.rotation.y = stageTurn;
      }
      stageGlow.material.opacity = 0.14 + 0.1 * (stageModel ? smooth(stageGrow) : 0);
    },
    anchors: {
      centre: [0, TOP, 0],
      // over the hovered miniature, and over the prop on the stage
      hover: () => { const m = hover && minis.get(hover); return m ? [m.holder.position.x, m.holder.position.y + MINI * m.s * (1 + 0.15 * m.hover) * m.h + 0.012, m.holder.position.z] : [0, TOP, 0]; },
      stage: () => [0, STAGE_Y + BIG * (pick && minis.get(pick) ? minis.get(pick).h : 1) + 0.03, 0],
    },
    labels: [],
    // views [az, el, dist, tx, ty, tz]: the whole table from the front, the stage close, from above
    cam: { default: [0, 34, 3.5, 0, 0.72, 0.1], stage: [0, 16, 1.35, 0, STAGE_Y + 0.17, 0], above: [0, 78, 3.6, 0, TOP, 0] },
    controls: [], explore: () => ({}),
    // the table's own
    layout, feed, buildSome, built, total: () => order.length, keys: () => order.slice(), drawCards,
    colours(fn) { storyCol = fn; },
    pickables: () => order.map(k => minis.get(k)).filter(m => m.model).map(m => m.proxy),
    setHover(k) { hover = k && minis.has(k) ? k : null; }, hovered: () => hover,
    setPick, picked: () => pick, stageModel: () => stageModel,
    mini: k => minis.get(k), recOf, setRec, carryTo, drop, tidy, okRec,
    moved: () => order.filter(k => recOf(k)),
    // a close view of a story's plate, from outside the table
    groupView(key) { const p = plates.find(x => x.key === key); if (!p) return null; const d = p.mid / D2R; return [d, 36, 1.05, Math.sin(p.mid) * p.r * 0.92, TOP + 0.04, Math.cos(p.mid) * p.r * 0.92]; },
    plateOf: key => plates.find(x => x.key === key) || null,
    dispose() { for (const x of disposable) x.dispose(); },
    solid: [tableTop, floorDisc],   // (the pointer's dot lands on these)
    TOP, STAGE_Y,
  };
};
