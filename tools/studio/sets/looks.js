// The items' looks (not a set of its own: the engine's items use them). Nothing of them is see-through (v131; the owner,
// 10 November 2026: "All transparent things are problematic when it comes to framerate in edit mode i feel, can we
// somehow reduce them?"): a see-through layer is drawn again over what is behind it, and a box round you or a few large
// ones fill a headset's view several layers deep. So every look is opaque lines, small opaque meshes and opaque tags; what
// lit up by opacity lights up by colour. A trigger cube: its edges in its colour (its own colour while you are in it,
// lighter pointed at or selected, else darker) and its name over it, an unseen box where its fill was (what the pointer
// finds, from inside too) and, when selected, a ball at each corner to stretch it by. A sound: a small speaker (a ball
// and a cone) in its colour, a thin ring on the floor where it stops being at full volume and, for a sound that follows
// a model, a thin line to what it follows. A cut-out: a box with dashed red-orange edges and solid ticks at its corners
// (v125: its faint fill cost a headset's frame rate; pointed at or selected its edges light up: lighter, their dashes
// denser, its ticks longer; cutting nothing, darker). A group (selected, while editing): a dashed box round all its
// members, in its colour (its name is the selection's label). A shape: a cube, a ball, a cylinder or a plane, lit in its
// colour, or (hiding things) drawn into the depth only, so it hides what stands behind it and is otherwise invisible
// (while editing its edges show where it is: a ball's three great circles, a cylinder's rims and four lines along it, a
// plane's outline; an unseen fill for the pointer). An empty: a small axis cross and its name, drawn only while editing.
// A model still loading (or one this device cannot find): a grey box with a line of text over it. Each item's colour
// comes from its id, so it is the same on every device (a cut-out's is one for all; a shape's is its record's).
const LOOKS = (function () {
  const PAL = ['#46d9ff', '#ffb43b', '#3ee08f', '#ff5ad9', '#9db4ff', '#ff7a59', '#c3e85a', '#c08cff', '#5fe0c8', '#ffe066'];
  const colOf = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };
  const box = new THREE.BoxGeometry(1, 1, 1), edges = new THREE.EdgesGeometry(box), ball = new THREE.SphereGeometry(1, 16, 12);
  const cone = new THREE.ConeGeometry(0.5, 1, 20, 1, true);
  // ---- drawn together (v136; the owner, of editing: "The edit mode still has worse framerates than not editing, why?").
  // Every look below is its own objects, as the engine and the tests know them (where they are, shown or not, their
  // colours), but the tags and the lines are not drawn one by one: each marked (userData.bt) and put on a layer no camera
  // sees (BT.layer), and each time the scene is drawn (its onBeforeRender, after three.js has made every matrix current
  // and before it lists what to draw) the ones shown are gathered (traverseVisible: what is hidden, or under something
  // hidden, is left out) and drawn in a few draws: every tag in one (their pictures on one canvas, BT.atlas, an instanced
  // quad each, turned to the eye as a sprite is), the lines in one a kind (each drawn as before: in the scene's depth or
  // over everything, by its order; a dashed one as its dashes). Until then each tag, edge, tick and cross was a draw of its
  // own, twice in a headset (one an eye): about a hundred more a frame while editing a scene of forty items
  const BT = { layer: 31, scene: null, renderer: null, tagMesh: null, atlas: null, lines: new Map(), dash: new Map(), stats: { tags: 0, lines: 0, draws: 0, uploads: 0, grew: 0 } };
  const _bm = new THREE.Matrix4(), _bv = new THREE.Vector3(), _bc = new THREE.Color(), _bcam = new THREE.Vector3();
  function batched(o, kind) { o.userData.bt = kind; o.layers.set(BT.layer); return o; }
  // the tags' canvas: rows 64 px tall (8 px apart, and 8 px between tags, so their smaller pictures keep apart), 2,048 px
  // wide, as tall as needed (512 to 4,096 px, doubling); each tag a place on it while it has words to show, drawn there
  // and sent on its own when its words change (texSubImage2D, as the panels' patches), the whole canvas only when it grows
  const AT = { w: 2048, row: 64, gap: 8, max: 4096 };
  function atlas() {
    if (BT.atlas) return BT.atlas;
    const cv = document.createElement('canvas'); cv.width = AT.w; cv.height = 512;
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    return (BT.atlas = { cv, ctx: cv.getContext('2d'), tex, rows: [], sent: [] });
  }
  // a place of width w (rows of places, first fit in their gaps); null when the canvas is full at its largest
  function atPlace(w) {
    const A = atlas(), rh = AT.row + AT.gap, n = Math.floor(A.cv.height / rh);
    for (let r = 0; r < n; r++) {
      const row = A.rows[r] || (A.rows[r] = []);
      let x = 0;
      for (const p of row) { if (p.x - x >= w + AT.gap) break; x = p.x + p.w + AT.gap; }
      if (x + w <= A.cv.width) { const p = { r, x, y: r * rh, w }; row.push(p); row.sort((a, b) => a.x - b.x); return p; }
    }
    if (A.cv.height >= AT.max) return null;
    // grown: a canvas twice as tall with what the old one held, sent whole
    const old = A.cv, cv = document.createElement('canvas'); cv.width = old.width; cv.height = old.height * 2;
    cv.getContext('2d').drawImage(old, 0, 0);
    A.cv = cv; A.ctx = cv.getContext('2d'); A.tex.image = cv; A.tex.needsUpdate = true; A.sent.length = 0; BT.stats.grew++;
    return atPlace(w);
  }
  function atFree(p) { if (!p || !BT.atlas) return; const row = BT.atlas.rows[p.r]; const k = row ? row.indexOf(p) : -1; if (k >= 0) row.splice(k, 1); }
  // a tag's picture on the canvas, at its place (a new place when its width changed), and to be sent
  function atDraw(T) {
    const A = atlas(), cv = T.cv;
    if (!T.at || T.at.w !== cv.width) { atFree(T.at); T.at = atPlace(cv.width); if (!T.at) return; }
    const p = T.at;
    A.ctx.clearRect(p.x, p.y, p.w, AT.row); A.ctx.drawImage(cv, p.x, p.y);
    A.sent.push([cv, p.x, p.y]);
  }
  // the canvas's changed places sent (or, not on the GPU yet or grown, the whole canvas as it goes there)
  function atSend() {
    const A = BT.atlas, R = BT.renderer;
    if (!A || !A.sent.length) return;
    const T = A.tex, list = A.sent.splice(0);
    try {
      const gl = R.getContext(), pr = R.properties.get(T), wt = pr && pr.__webglTexture;
      if (!wt || pr.__version !== T.version) return;   // (its upload to come carries the canvas as it is now)
      if (!R.capabilities.isWebGL2) { T.needsUpdate = true; return; }
      R.state.bindTexture(gl.TEXTURE_2D, wt);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, T.flipY); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, T.premultiplyAlpha); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      for (const [cv, x, y] of list) gl.texSubImage2D(gl.TEXTURE_2D, 0, x, T.flipY ? A.cv.height - y - cv.height : y, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.generateMipmap(gl.TEXTURE_2D);
      BT.stats.uploads += list.length;
    } catch (e) { T.needsUpdate = true; }
  }
  // every tag: an instanced quad at the tag's place, its size the sprite's (as three.js sizes a sprite: its scale in the
  // world, in the eye's frame), its bottom's middle at that place (the sprites' centre, 0.5, 0), its picture its place on
  // the canvas; opaque, its clear corners cut away (as the sprites' alphaTest 0.5), over everything (no depth test), after
  // the items (renderOrder 12)
  const TAG_VS = 'attribute vec3 iPos; attribute vec2 iSize; attribute vec4 iUV; varying vec2 vUv;\n' +
    'void main() { vec4 mv = viewMatrix * vec4(iPos, 1.0); mv.xy += vec2(position.x, position.y + 0.5) * iSize; vUv = mix(iUV.xy, iUV.zw, uv); gl_Position = projectionMatrix * mv; }';
  const TAG_FS = 'uniform sampler2D map; varying vec2 vUv;\nvoid main() { vec4 t = texture2D(map, vUv); if (t.a < 0.5) discard; gl_FragColor = t; }';
  function tagMesh(n) {
    const M = BT.tagMesh;
    if (M && M.cap >= n) return M;
    if (M) { M.mesh.parent && M.mesh.parent.remove(M.mesh); M.mesh.geometry.dispose(); }
    const cap = Math.max(64, (M ? M.cap : 0) * 2, n), g = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1);
    g.setIndex(q.index); g.setAttribute('position', q.attributes.position); g.setAttribute('uv', q.attributes.uv);
    const A = { iPos: 3, iSize: 2, iUV: 4 };
    for (const k in A) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(cap * A[k]), A[k]).setUsage(THREE.DynamicDrawUsage));
    const mat = M ? M.mesh.material : new THREE.ShaderMaterial({ uniforms: { map: { value: atlas().tex } }, vertexShader: TAG_VS, fragmentShader: TAG_FS, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 12; mesh.matrixAutoUpdate = false; mesh.visible = false; mesh.userData.btMesh = 'tags';
    BT.scene.add(mesh);
    return (BT.tagMesh = { mesh, cap });
  }
  // a dashed line as its dashes (as LineDashedMaterial draws it: along the line's own distance, dash on, gap off), once
  // for each geometry and dash
  function dashed(g, dash, gap) {
    const k = g.uuid + '|' + dash + '|' + gap;
    if (BT.dash.has(k)) return BT.dash.get(k);
    const P = g.attributes.position, D = g.attributes.lineDistance, out = [], a = new THREE.Vector3(), b = new THREE.Vector3(), all = dash + gap;
    for (let i = 0; i + 1 < P.count; i += 2) {
      a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1);
      const d0 = D ? D.getX(i) : 0, d1 = D ? D.getX(i + 1) : a.distanceTo(b), L = d1 - d0;
      if (L <= 0) continue;
      for (let s = Math.floor(d0 / all) * all; s < d1; s += all) {
        const u0 = Math.max(s, d0), u1 = Math.min(s + dash, d1);
        if (u1 > u0) out.push(a.x + (b.x - a.x) * (u0 - d0) / L, a.y + (b.y - a.y) * (u0 - d0) / L, a.z + (b.z - a.z) * (u0 - d0) / L, a.x + (b.x - a.x) * (u1 - d0) / L, a.y + (b.y - a.y) * (u1 - d0) / L, a.z + (b.z - a.z) * (u1 - d0) / L);
      }
    }
    const r = new Float32Array(out);
    BT.dash.set(k, r);
    return r;
  }
  // the lines of one kind (in the scene's depth or over everything, and their order): one LineSegments with each line's
  // points in the world and its colour, as large as needed
  function lineBatch(depth, order, n) {
    const key = (depth ? 'd' : 'o') + order;
    let B = BT.lines.get(key);
    if (B && B.cap >= n) return B;
    const cap = Math.max(4096, B ? B.cap * 2 : 0, n), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    if (B) { B.mesh.geometry.dispose(); B.mesh.geometry = g; B.cap = cap; return B; }
    const mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: depth, depthWrite: depth }));
    mesh.frustumCulled = false; mesh.renderOrder = order; mesh.matrixAutoUpdate = false; mesh.visible = false; mesh.userData.btMesh = 'lines ' + key;
    BT.scene.add(mesh);
    B = { mesh, cap, key };
    BT.lines.set(key, B);
    return B;
  }
  // a line's points (pairs of them) in its geometry's frame: a dashed one's dashes, else its points' numbers (kept for
  // each geometry while its points and range stay)
  const PTS = new WeakMap();
  function linePts(o) {
    const m = o.material, g = o.geometry;
    if (m.isLineDashedMaterial) return dashed(g, m.dashSize, m.gapSize);
    const P = g.attributes.position, I = g.index, s = g.drawRange.start, e = Math.min(I ? I.count : P.count, s + g.drawRange.count);
    const k = (o.isLineSegments ? 's' : 'l') + s + ':' + e + ':' + P.count + ':' + (I ? I.version : -1), c = PTS.get(g);
    if (c && c.k === k) return c.a;
    const out = [], at = q => (I ? I.getX(q) : q);
    if (o.isLineSegments) for (let q = s; q + 1 < e; q += 2) out.push(at(q), at(q + 1));
    else for (let q = s; q + 1 < e; q++) out.push(at(q), at(q + 1));
    PTS.set(g, { k, a: out });
    return out;
  }
  const TAGS = [], LINES = [];
  function fill(renderer, scene, camera) {
    if (scene !== BT.scene) return;
    TAGS.length = 0; LINES.length = 0;
    scene.traverseVisible(o => { const b = o.userData.bt; if (b === 'tag') TAGS.push(o); else if (b === 'line') LINES.push(o); });
    BT.stats.tags = TAGS.length; BT.stats.lines = LINES.length; BT.stats.draws = 0;
    // the tags: drawn back to front (over everything, so the nearest on top), each its picture's place
    const M = tagMesh(TAGS.length), g = M.mesh.geometry, iP = g.attributes.iPos.array, iS = g.attributes.iSize.array, iU = g.attributes.iUV.array;
    for (const sp of TAGS) { const T = sp.userData.bt$; if (T.dirty || !T.at) { T.dirty = false; atDraw(T); } }
    const A = atlas(), W = A.cv.width, H = A.cv.height;
    _bcam.setFromMatrixPosition(camera.matrixWorld);
    let n = 0;
    const L = TAGS.filter(sp => sp.userData.bt$.at).map(sp => [sp, _bv.setFromMatrixPosition(sp.matrixWorld).distanceToSquared(_bcam)]).sort((a, b) => b[1] - a[1]);
    for (const [sp] of L) {
      const e = sp.matrixWorld.elements, p = sp.userData.bt$.at, cw = sp.userData.bt$.cv.width;
      iP[n * 3] = e[12]; iP[n * 3 + 1] = e[13]; iP[n * 3 + 2] = e[14];
      iS[n * 2] = Math.hypot(e[0], e[1], e[2]); iS[n * 2 + 1] = Math.hypot(e[4], e[5], e[6]);
      iU[n * 4] = (p.x + 0.5) / W; iU[n * 4 + 1] = 1 - (p.y + AT.row - 0.5) / H; iU[n * 4 + 2] = (p.x + cw - 0.5) / W; iU[n * 4 + 3] = 1 - (p.y + 0.5) / H;
      n++;
    }
    g.instanceCount = n;
    for (const k of ['iPos', 'iSize', 'iUV']) { const a = g.attributes[k]; a.updateRange.offset = 0; a.updateRange.count = n * a.itemSize; a.needsUpdate = n > 0; }
    M.mesh.visible = n > 0;
    if (n) BT.stats.draws++;
    atSend();
    // the lines: by kind, each line's points in the world, in its colour (times its points' own, where it has them)
    const by = new Map();
    for (const o of LINES) { const k = (o.material.depthTest ? 'd' : 'o') + o.renderOrder; if (!by.has(k)) by.set(k, []); by.get(k).push(o); }
    for (const B of BT.lines.values()) if (!by.has(B.key)) B.mesh.visible = false;
    for (const [k, list] of by) {
      const pts = list.map(o => linePts(o)), cnt = pts.reduce((a, p, i) => a + (p instanceof Float32Array ? p.length / 3 : p.length), 0);
      const B = lineBatch(k[0] === 'd', +k.slice(1), cnt), pos = B.mesh.geometry.attributes.position, col = B.mesh.geometry.attributes.color, PA = pos.array, CA = col.array;
      let v = 0;
      list.forEach((o, i) => {
        const m = o.material, P = pts[i], G = o.geometry.attributes.position, VC = m.vertexColors && o.geometry.attributes.color;
        _bm.copy(o.matrixWorld); _bc.copy(m.color);
        const put = (x, y, z, ci) => {
          _bv.set(x, y, z).applyMatrix4(_bm);
          PA[v * 3] = _bv.x; PA[v * 3 + 1] = _bv.y; PA[v * 3 + 2] = _bv.z;
          CA[v * 3] = _bc.r * (VC && ci >= 0 ? VC.getX(ci) : 1); CA[v * 3 + 1] = _bc.g * (VC && ci >= 0 ? VC.getY(ci) : 1); CA[v * 3 + 2] = _bc.b * (VC && ci >= 0 ? VC.getZ(ci) : 1);
          v++;
        };
        if (P instanceof Float32Array) for (let q = 0; q < P.length; q += 3) put(P[q], P[q + 1], P[q + 2], -1);
        else for (const k2 of P) put(G.getX(k2), G.getY(k2), G.getZ(k2), k2);
      });
      B.mesh.geometry.setDrawRange(0, v);
      for (const a of [pos, col]) { a.updateRange.offset = 0; a.updateRange.count = v * 3; a.needsUpdate = v > 0; }
      B.mesh.visible = v > 0;
      if (v) BT.stats.draws++;
    }
  }
  // the engine's: where they are drawn together (the scene the studio draws), and to draw a line of its own that way
  function batch(scene, renderer) {
    BT.scene = scene; BT.renderer = renderer;
    scene.onBeforeRender = fill;
  }

  // a line of text on a canvas, as a sprite (drawn over the scene, with every other tag: BT) or a plain picture; redrawn
  // only when it changes. Its band is opaque and drawn with the opaque things (v131: no blending), after the items
  // (renderOrder 12) and without a depth test, so it still shows over everything they draw
  const white = new THREE.Color(1, 1, 1);
  function tag(px) {
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    cv.width = 512; cv.height = 64;
    const sp = batched(new THREE.Sprite(new THREE.SpriteMaterial({ transparent: false, alphaTest: 0.5, depthTest: false, depthWrite: false })), 'tag');
    sp.renderOrder = 12; sp.center.set(0.5, 0);
    const T = sp.userData.bt$ = { cv, at: null, dirty: false };
    let last = '';
    sp.userData.set = (text, col, h) => {
      const k = text + '|' + col;
      if (k !== last) {
        last = k;
        ctx.font = `700 ${px || 34}px B612, "Segoe UI", Arial, sans-serif`;
        const w = Math.min(1000, Math.ceil(ctx.measureText(text).width) + 36);
        if (cv.width !== w) cv.width = w;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = '#0a121e'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = col || '#e7eef8'; ctx.fillRect(0, 0, 6, cv.height);
        ctx.font = `700 ${px || 34}px B612, "Segoe UI", Arial, sans-serif`; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f2f6fc';
        ctx.fillText(text, 20, cv.height / 2 + 1);
        T.dirty = true;   // (put on the tags' canvas when it is next drawn)
      }
      sp.userData.text = text;   // (what it says: the tests read it)
      sp.scale.set((h || 0.09) * cv.width / cv.height, h || 0.09, 1);
    };
    sp.userData.drop = () => { atFree(T.at); T.at = null; sp.material.dispose(); };
    return sp;
  }
  // a cube: its box (scaled to its size) under `body`, the name and the corners under `deco` (not scaled, so they keep
  // their size); both follow the cube's place and yaw. Its edges only (v131: no see-through walls) and, where its fill
  // was, an unseen box both ways round (`fill`: the pointer finds it from outside and from inside, as before)
  const CUBE_EDGE = { plain: 0.7, inside: 1, lit: 0.6 };   // (its colour darker; as it is; towards white by this much)
  function cube(id) {
    const col = new THREE.Color(colOf(id));
    const body = new THREE.Group(), deco = new THREE.Group();
    const fill = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    const line = batched(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: col.clone().multiplyScalar(CUBE_EDGE.plain) })), 'line');
    line.renderOrder = 6;
    body.add(fill, line);
    const name = tag(30);
    deco.add(name);
    const corners = [];
    for (let k = 0; k < 8; k++) {
      const c = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: col.clone().lerp(white, 0.5) }));
      c.scale.setScalar(0.045); c.renderOrder = 7; c.userData.corner = k; c.visible = false;
      deco.add(c); corners.push(c);
    }
    let lk = '';
    return {
      body, deco, fill, line, name, corners, col: '#' + col.getHexString(),
      // inside: its edges in its own colour (else darker); selected or hot (the pointer on it): lighter; selected: its
      // corners shown
      look(o) {
        const k = o.selected || o.hot ? 'lit' : o.inside ? 'inside' : 'plain';
        if (k !== lk) { lk = k; if (k === 'lit') line.material.color.copy(col).lerp(white, CUBE_EDGE.lit); else line.material.color.copy(col).multiplyScalar(CUBE_EDGE[k]); }
        for (const c of corners) { c.visible = !!o.selected; c.scale.setScalar(o.hotCorner === c.userData.corner ? 0.065 : 0.045); }
        name.visible = !(o.hot || o.selected);   // (the engine's label names it then: the two overlapped)
      },
      drop() { fill.material.dispose(); line.material.dispose(); for (const c of corners) c.material.dispose(); name.userData.drop(); },
    };
  }
  // a sound: the speaker and its ring (the ring on the floor under it, sized to its full-volume distance), and a thin line
  // from it to the origin of what it follows (a model or one of its bones: link.userData.set(from, to)), drawn over all;
  // all of it opaque, in its colour darker or lighter
  function speaker(id) {
    const col = new THREE.Color(colOf(id)), g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: col });
    const b = new THREE.Mesh(ball, mat); b.scale.setScalar(0.06); g.add(b);
    const c = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.45), side: THREE.DoubleSide }));
    c.scale.set(0.16, 0.14, 0.16); c.rotation.x = -Math.PI / 2; c.position.z = -0.1; g.add(c);
    // what the pointer finds: an unseen ball round it
    const hit = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ visible: false })); hit.scale.setScalar(0.16); g.add(hit);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.45), depthWrite: false }));
    ring.renderOrder = 4;
    const name = tag(30);
    g.add(name); name.position.y = 0.12;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const link = batched(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: col.clone().multiplyScalar(0.55), depthTest: false, depthWrite: false })), 'line');
    link.renderOrder = 7; link.frustumCulled = false; link.visible = false;
    link.userData.set = (a, z) => { const P = lg.attributes.position; P.setXYZ(0, a.x, a.y, a.z); P.setXYZ(1, z.x, z.y, z.z); P.needsUpdate = true; };
    return {
      group: g, ring, hit, name, link, col: '#' + col.getHexString(),
      // (playing: its cone brighter; pointed at or selected: its ball bigger, the line to what it follows lighter)
      look(o) {
        b.scale.setScalar(o.hot || o.selected ? 0.08 : 0.06); c.material.color.copy(col).multiplyScalar(o.on ? 0.8 : 0.45); link.material.color.copy(col).multiplyScalar(o.hot || o.selected ? 1 : 0.55);
        name.visible = !(o.hot || o.selected);   // (the engine's label names it then, and what it follows: the two overlapped)
      },
      drop() { mat.dispose(); c.material.dispose(); ring.geometry.dispose(); ring.material.dispose(); lg.dispose(); link.material.dispose(); name.userData.drop(); },
    };
  }
  // a cut-out (a box that hides the part of a model inside it): one warm red-orange for all of them, its edges dashed
  // (drawn where they are seen), a solid tick along each edge at every corner (over everything, so a box inside a model
  // still shows), its name over it and, when selected, a ball at each corner to stretch it by; nothing see-through (v125:
  // a fill, however faint, is a layer the size of the box on screen, two where it is seen from outside, and a few large
  // boxes or one round you cost a headset's frame rate while editing; v131: its lines opaque too). Pointed at or selected,
  // its edges light up: lighter, their dashes denser, its ticks a third of each edge long instead of a fifth; cutting
  // nothing, darker (CUT_OFF). `body` is scaled to its size (its unseen box is what the pointer finds), `deco` is not
  const CUT_COL = '#ff5a36';
  const cutGeo = (function () {
    const dash = new THREE.EdgesGeometry(box);
    new THREE.LineSegments(dash).computeLineDistances();   // (each edge 1 long: about seven dashes on every edge, whatever its size)
    // the corners' ticks: from each corner a share of the way along each of its three edges
    const ticksOf = f => {
      const P = [];
      for (let k = 0; k < 8; k++) {
        const c = [k & 1 ? 0.5 : -0.5, k & 2 ? 0.5 : -0.5, k & 4 ? 0.5 : -0.5];
        for (let a = 0; a < 3; a++) { const e = c.slice(); e[a] -= Math.sign(c[a]) * f; P.push(...c, ...e); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      return g;
    };
    return { dash, ticks: ticksOf(0.2), ticksLit: ticksOf(1 / 3) };
  })();
  // its edges and ticks as they are drawn: plain, or lit (pointed at or selected)
  const CUT_LOOK = {
    plain: { mix: 0, dash: 0.07, gap: 0.05 },
    lit: { mix: 0.4, dash: 0.06, gap: 0.02 },
  };
  const CUT_OFF = 0.5;   // (cutting nothing: its colours times this)
  function cut(id) {
    const col = new THREE.Color(CUT_COL), white = new THREE.Color(1, 1, 1);
    const body = new THREE.Group(), deco = new THREE.Group();
    const hit = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ visible: false }));
    const line = batched(new THREE.LineSegments(cutGeo.dash, new THREE.LineDashedMaterial({ color: col, dashSize: 0.07, gapSize: 0.05 })), 'line');
    line.renderOrder = 6;
    const ticks = batched(new THREE.LineSegments(cutGeo.ticks, new THREE.LineBasicMaterial({ color: col.clone().lerp(white, 0.3), depthTest: false, depthWrite: false })), 'line');
    ticks.renderOrder = 8; ticks.frustumCulled = false;
    body.add(hit, line, ticks);
    const name = tag(30);
    deco.add(name);
    const corners = [];
    for (let k = 0; k < 8; k++) {
      const c = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: col.clone().lerp(white, 0.5), depthWrite: false, depthTest: false }));
      c.scale.setScalar(0.04); c.renderOrder = 9; c.userData.corner = k; c.visible = false;
      deco.add(c); corners.push(c);
    }
    let lookOf = null, offOf = null;
    return {
      body, deco, hit, line, ticks, name, corners, col: CUT_COL,
      // hot: the pointer on it, selected: its corners shown (either lights its edges up); off: it cuts nothing now
      // (hidden for you, previewed whole, or its object not here), drawn darker
      look(o) {
        const off = !!o.off, L = o.selected || o.hot ? CUT_LOOK.lit : CUT_LOOK.plain;
        if (L !== lookOf || off !== offOf) {
          lookOf = L; offOf = off;
          const k = off ? CUT_OFF : 1;
          line.material.color.copy(col).lerp(white, L.mix).multiplyScalar(k); line.material.dashSize = L.dash; line.material.gapSize = L.gap;
          ticks.material.color.copy(col).lerp(white, 0.3 + L.mix / 2).multiplyScalar(k); ticks.geometry = L === CUT_LOOK.lit ? cutGeo.ticksLit : cutGeo.ticks;
        }
        for (const c of corners) { c.visible = !!o.selected; c.scale.setScalar(o.hotCorner === c.userData.corner ? 0.06 : 0.04); }
        name.visible = !(o.hot || o.selected);   // (the engine's label names it then)
      },
      drop() { hit.material.dispose(); line.material.dispose(); ticks.material.dispose(); for (const c of corners) c.material.dispose(); name.userData.drop(); },
    };
  }
  // a group: a dashed box (about seven dashes an edge, whatever its size) round its members, over everything, in its
  // colour a little darker; `deco` is placed at the box's middle and `box` scaled to its size
  function group(id) {
    const col = new THREE.Color(colOf(id)), deco = new THREE.Group();
    const box = batched(new THREE.LineSegments(cutGeo.dash, new THREE.LineDashedMaterial({ color: col.clone().lerp(white, 0.25).multiplyScalar(0.6), dashSize: 0.05, gapSize: 0.06, depthTest: false, depthWrite: false })), 'line');
    box.renderOrder = 7; box.frustumCulled = false;
    deco.add(box); deco.visible = false;
    return { deco, box, col: '#' + col.getHexString(), drop() { box.material.dispose(); } };
  }
  // a shape: its body (scaled to its size, turned as it is: the item's holder) holds the drawn mesh, an unseen fill (what
  // the pointer finds, from outside and from inside, also while the mesh is not drawn) and its edges (editing); `deco`
  // (not scaled, following its place and turn) its name and, for a cube, the corner balls to stretch it by. Lit in its
  // colour, or hiding things: drawn into the depth alone (no colour), before the items (renderOrder -1: after the stage's
  // floor and sky, so in VR the stage shows where it stands and in AR the room) so what stands behind it is hidden; a
  // closed shape from its outside only (from inside it hides nothing), a plane both ways. The geometries are shared (unit
  // sized: a 1 m box, a ball and a cylinder 1 m across, a 1 m square upright, facing +z)
  const SHAPE_GEO = { cube: box, sphere: new THREE.SphereGeometry(0.5, 40, 24), cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 40, 1), plane: new THREE.PlaneGeometry(1, 1) };
  // its edges (v131: all that shows of one that hides things while editing): a box's twelve and a plane's outline (three.js
  // finds them), a ball's three great circles and a cylinder's two rims and four lines along it (it finds none on a ball
  // and only the rims on a cylinder)
  const ringPts = (n, f) => { const P = []; for (let i = 0; i < n; i++) P.push(...f(i / n * 2 * Math.PI), ...f((i + 1) / n * 2 * Math.PI)); return P; };
  const lineGeo = P => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); return g; };
  const SHAPE_LINES = {
    sphere: () => lineGeo([].concat(ringPts(64, a => [0.5 * Math.cos(a), 0.5 * Math.sin(a), 0]), ringPts(64, a => [0.5 * Math.cos(a), 0, 0.5 * Math.sin(a)]), ringPts(64, a => [0, 0.5 * Math.cos(a), 0.5 * Math.sin(a)]))),
    cylinder: () => lineGeo([].concat(ringPts(40, a => [0.5 * Math.cos(a), 0.5, 0.5 * Math.sin(a)]), ringPts(40, a => [0.5 * Math.cos(a), -0.5, 0.5 * Math.sin(a)]),
      ...[0, 1, 2, 3].map(i => { const x = 0.5 * Math.cos(i * Math.PI / 2), z = 0.5 * Math.sin(i * Math.PI / 2); return [x, 0.5, z, x, -0.5, z]; }))),
  };
  const SHAPE_EDGE = {}, SHAPE_TRIS = {};
  const shapeEdges = k => SHAPE_EDGE[k] || (SHAPE_EDGE[k] = SHAPE_LINES[k] ? SHAPE_LINES[k]() : new THREE.EdgesGeometry(SHAPE_GEO[k] || box, 20));
  // its triangles (its tag says them: what it costs drawn, also as one that hides things)
  const shapeTris = k => SHAPE_TRIS[k] || (SHAPE_TRIS[k] = (g => Math.round((g.index ? g.index.count : g.attributes.position.count) / 3))(SHAPE_GEO[k] || box));
  function shape(id) {
    const body = new THREE.Group(), deco = new THREE.Group();
    const lit = new THREE.MeshStandardMaterial({ color: 0xc9d1dc, roughness: 0.75, metalness: 0 });
    const hide = new THREE.MeshBasicMaterial({ colorWrite: false });
    const mesh = new THREE.Mesh(box, lit);
    const fill = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0xc9d1dc, visible: false, side: THREE.DoubleSide }));
    const line = batched(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff })), 'line');
    line.renderOrder = 6;
    body.add(mesh, fill, line);
    const name = tag(30);
    deco.add(name);
    const corners = [];
    for (let k = 0; k < 8; k++) {
      const c = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: 0xe8eef8, depthWrite: false, depthTest: false }));
      c.scale.setScalar(0.04); c.renderOrder = 9; c.userData.corner = k; c.visible = false;
      deco.add(c); corners.push(c);
    }
    let kind = '', col = '', hides = false, a = -1, hid = false, lk = '';
    const S = {
      body, deco, mesh, fill, line, name, corners, col: '#c9d1dc',
      // its record's shape, colour and look
      set(r) {
        if (r.shape !== kind) {
          kind = r.shape;
          mesh.geometry = fill.geometry = SHAPE_GEO[kind] || box;
          line.geometry = shapeEdges(kind);
          lit.side = kind === 'plane' ? THREE.DoubleSide : THREE.FrontSide; hide.side = lit.side;
          lit.needsUpdate = hide.needsUpdate = true;
        }
        if (r.colour !== col) {
          col = r.colour; S.col = col; lk = '';
          lit.color.set(col); fill.material.color.set(col);
          for (const c of corners) c.material.color.set(col).lerp(white, 0.5);
        }
        if ((r.look === 'hide') !== hides) { hides = r.look === 'hide'; mesh.material = hides ? hide : lit; mesh.renderOrder = hides ? -1 : 0; a = -1; }
      },
      // a: its fade (shown or hidden for you: a colour fades, see-through only while not editing; what hides things
      // switches at one half); hid: hidden for you while editing (not drawn: its edges show where it is); editing: its
      // edges for one that hides things or is hidden (also when pointed at or selected, then lighter), its corners when
      // selected (a cube), its name (with its triangles) unless pointed at or selected (the engine's label names it then)
      look(o) {
        if (Math.abs(o.a - a) > 1e-3 || !!o.hid !== hid) {
          a = o.a; hid = !!o.hid;
          if (hides) mesh.visible = a > 0.5 && !hid;
          else {
            mesh.visible = a > 0.002 && !hid;
            const full = a >= 0.999;
            lit.transparent = !full; lit.opacity = full ? 1 : a; lit.depthWrite = full;
          }
        }
        line.visible = !!o.editing && (hides || hid || o.hot || o.selected);
        const k = o.selected || o.hot ? 'lit' : 'plain';
        if (k !== lk) { lk = k; line.material.color.set(col || S.col); if (k === 'lit') line.material.color.lerp(white, 0.6); else line.material.color.lerp(white, 0.15).multiplyScalar(0.8); }
        for (const c of corners) { c.visible = !!o.selected && kind === 'cube'; c.scale.setScalar(o.hotCorner === c.userData.corner ? 0.06 : 0.04); }
        name.visible = !!o.editing && !(o.hot || o.selected);
      },
      hides: () => hides,
      tris: () => shapeTris(kind),
      drop() { lit.dispose(); hide.dispose(); fill.material.dispose(); line.material.dispose(); for (const c of corners) c.material.dispose(); name.userData.drop(); },
    };
    return S;
  }
  // an empty: a point with a turn, seen only while editing: a small axis cross (x red, y green, z blue, drawn over
  // everything so it shows inside a model), a ball in its colour, its name, and an unseen ball round it for the pointer
  const axGeo = (function () {
    const g = new THREE.BufferGeometry(), L = 0.16;
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, L, 0, 0, 0, 0, 0, 0, L, 0, 0, 0, 0, 0, 0, L], 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute([1, 0.35, 0.29, 1, 0.35, 0.29, 0.24, 0.88, 0.56, 0.24, 0.88, 0.56, 0.27, 0.85, 1, 0.27, 0.85, 1], 3));
    return g;
  })();
  function empty(id) {
    const col = new THREE.Color(colOf(id)), g = new THREE.Group();
    const axes = batched(new THREE.LineSegments(axGeo, new THREE.LineBasicMaterial({ vertexColors: true, color: 0xbfbfbf, depthTest: false, depthWrite: false })), 'line');
    axes.renderOrder = 8; axes.frustumCulled = false;
    const dot = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: col, depthTest: false, depthWrite: false }));
    dot.scale.setScalar(0.025); dot.renderOrder = 8;
    const hit = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ visible: false })); hit.scale.setScalar(0.12);
    const name = tag(30); name.position.y = 0.2;
    g.add(axes, dot, hit, name);
    return {
      group: g, hit, name, col: '#' + col.getHexString(),
      look(o) { dot.scale.setScalar(o.hot || o.selected ? 0.04 : 0.025); axes.material.color.setScalar(o.hot || o.selected ? 1 : 0.75); name.visible = !(o.hot || o.selected); },
      drop() { axes.material.dispose(); dot.material.dispose(); hit.material.dispose(); name.userData.drop(); },
    };
  }
  // a model that is not here yet (loading, missing or unreadable): a grey box with a line of text over it (opaque)
  function grey() {
    const g = new THREE.Group();
    const fill = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x4f5d70, roughness: 0.9 }));
    const line = batched(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xb8c4d4 })), 'line');
    const body = new THREE.Group(); body.add(fill, line); body.scale.setScalar(0.4); body.position.y = 0.2;
    g.add(body);
    const name = tag(28); name.position.y = 0.48;
    g.add(name);
    return { group: g, body, fill, name, drop() { fill.material.dispose(); line.material.dispose(); name.userData.drop(); } };
  }
  // a model a trigger cube hides from you, while editing (v131; the owner, 10 November 2026: a room scan drawn faint was a
  // see-through layer over the whole view): not drawn, its unseen box's edges instead, in a muted grey-blue (one material
  // for all of them; the engine puts it where the model's unseen box is)
  const HID_MAT = new THREE.LineBasicMaterial({ color: 0x7d8ca2 });
  const hidBox = () => { const l = batched(new THREE.LineSegments(edges, HID_MAT), 'line'); l.visible = false; l.renderOrder = 6; return l; };
  return { colOf, cube, speaker, cut, group, shape, empty, grey, tag, hidBox, shapeTris, CUT_COL, CUT_LOOK, CUT_OFF, CUBE_EDGE, batch, batched, BT,
    dispose() { if (BT.atlas) BT.atlas.tex.dispose(); BT.dash.clear(); box.dispose(); edges.dispose(); ball.dispose(); cone.dispose(); cutGeo.dash.dispose(); cutGeo.ticks.dispose(); cutGeo.ticksLit.dispose(); axGeo.dispose(); HID_MAT.dispose(); for (const k of ['sphere', 'cylinder', 'plane']) SHAPE_GEO[k].dispose(); for (const g of Object.values(SHAPE_EDGE)) g.dispose(); } };
})();
