// The items' looks (not a set of its own: the engine's items use them). A trigger cube: a see-through box in its
// colour with brighter edges, its name over it and, when selected, a ball at each corner to stretch it by. A sound: a
// small speaker (a ball and a cone) in its colour, a faint ring on the floor where it stops being at full volume and, for
// a sound that follows a model, a faint line to what it follows. A cut-out: a box with dashed red-orange edges and solid
// ticks at its corners, and nothing see-through (v125: its faint fill cost a headset's frame rate, a box round you or
// several large ones filling the view two layers deep each; pointed at or selected its edges light up instead: brighter,
// their dashes denser, its ticks longer). A group (selected, while editing): a faint
// dashed box round all its members, in its colour (its name is the selection's label). A shape: a cube, a ball, a
// cylinder or a plane, lit in its colour, or (hiding things) drawn into the depth only, so it hides what stands behind it
// and is otherwise invisible (while editing a see-through fill and its edges show where it is). An empty: a small axis
// cross and its name, drawn only while editing. A model still loading (or one this device cannot find): a grey box with a
// line of text over it. Each item's colour comes from its id, so it is the same on every device (a cut-out's is one for
// all; a shape's is its record's).
const LOOKS = (function () {
  const PAL = ['#46d9ff', '#ffb43b', '#3ee08f', '#ff5ad9', '#9db4ff', '#ff7a59', '#c3e85a', '#c08cff', '#5fe0c8', '#ffe066'];
  const colOf = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };
  const box = new THREE.BoxGeometry(1, 1, 1), edges = new THREE.EdgesGeometry(box), ball = new THREE.SphereGeometry(1, 16, 12);
  const cone = new THREE.ConeGeometry(0.5, 1, 20, 1, true);
  // a line of text on a canvas, as a sprite (drawn over the scene) or a plain picture; redrawn only when it changes
  function tag(px) {
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv);
    cv.width = 512; cv.height = 64;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sp.renderOrder = 12; sp.center.set(0.5, 0);
    let last = '';
    sp.userData.set = (text, col, h) => {
      const k = text + '|' + col;
      if (k !== last) {
        last = k;
        ctx.font = `700 ${px || 34}px B612, "Segoe UI", Arial, sans-serif`;
        const w = Math.min(1000, Math.ceil(ctx.measureText(text).width) + 36);
        if (cv.width !== w) cv.width = w;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = 'rgba(3,8,16,0.8)'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = col || '#e7eef8'; ctx.fillRect(0, 0, 6, cv.height);
        ctx.font = `700 ${px || 34}px B612, "Segoe UI", Arial, sans-serif`; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f2f6fc';
        ctx.fillText(text, 20, cv.height / 2 + 1);
        tex.needsUpdate = true;
      }
      sp.scale.set((h || 0.09) * cv.width / cv.height, h || 0.09, 1);
    };
    sp.userData.drop = () => { tex.dispose(); sp.material.dispose(); };
    return sp;
  }
  // a cube: its box (scaled to its size) under `body`, the name and the corners under `deco` (not scaled, so they keep
  // their size); both follow the cube's place and yaw
  function cube(id) {
    const col = new THREE.Color(colOf(id));
    const body = new THREE.Group(), deco = new THREE.Group();
    const fill = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    fill.renderOrder = 5;
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: col.clone().lerp(new THREE.Color(1, 1, 1), 0.35), transparent: true, opacity: 0.85, depthWrite: false }));
    line.renderOrder = 6;
    body.add(fill, line);
    const name = tag(30);
    deco.add(name);
    const corners = [];
    for (let k = 0; k < 8; k++) {
      const c = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color(1, 1, 1), 0.5), transparent: true, opacity: 0.9, depthWrite: false }));
      c.scale.setScalar(0.045); c.renderOrder = 7; c.userData.corner = k; c.visible = false;
      deco.add(c); corners.push(c);
    }
    return {
      body, deco, fill, line, name, corners, col: '#' + col.getHexString(),
      // inside: brighter; selected: its corners shown; hot: the pointer on it
      look(o) {
        fill.material.opacity = (o.inside ? 0.3 : 0.16) + (o.hot ? 0.08 : 0);
        line.material.opacity = o.selected || o.hot ? 1 : 0.75;
        for (const c of corners) { c.visible = !!o.selected; c.scale.setScalar(o.hotCorner === c.userData.corner ? 0.065 : 0.045); }
        name.visible = !(o.hot || o.selected);   // (the engine's label names it then: the two overlapped)
      },
      drop() { fill.material.dispose(); line.material.dispose(); for (const c of corners) c.material.dispose(); name.userData.drop(); },
    };
  }
  // a sound: the speaker and its ring (the ring on the floor under it, sized to its full-volume distance), and a thin line
  // from it to the origin of what it follows (a model or one of its bones: link.userData.set(from, to)), drawn over all
  function speaker(id) {
    const col = new THREE.Color(colOf(id)), g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: col });
    const b = new THREE.Mesh(ball, mat); b.scale.setScalar(0.06); g.add(b);
    const c = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    c.scale.set(0.16, 0.14, 0.16); c.rotation.x = -Math.PI / 2; c.position.z = -0.1; g.add(c);
    // what the pointer finds: an unseen ball round it
    const hit = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ visible: false })); hit.scale.setScalar(0.16); g.add(hit);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false }));
    ring.renderOrder = 4;
    const name = tag(30);
    g.add(name); name.position.y = 0.12;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const link = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false }));
    link.renderOrder = 7; link.frustumCulled = false; link.visible = false;
    link.userData.set = (a, z) => { const P = lg.attributes.position; P.setXYZ(0, a.x, a.y, a.z); P.setXYZ(1, z.x, z.y, z.z); P.needsUpdate = true; };
    return {
      group: g, ring, hit, name, link, col: '#' + col.getHexString(),
      look(o) {
        b.scale.setScalar(o.hot || o.selected ? 0.08 : 0.06); c.material.opacity = o.on ? 0.75 : 0.35; link.material.opacity = o.hot || o.selected ? 0.8 : 0.45;
        name.visible = !(o.hot || o.selected);   // (the engine's label names it then, and what it follows: the two overlapped)
      },
      drop() { mat.dispose(); c.material.dispose(); ring.geometry.dispose(); ring.material.dispose(); lg.dispose(); link.material.dispose(); name.userData.drop(); },
    };
  }
  // a cut-out (a box that hides the part of a model inside it): one warm red-orange for all of them, its edges dashed
  // (drawn where they are seen), a solid tick along each edge at every corner (over everything, so a box inside a model
  // still shows), its name over it and, when selected, a ball at each corner to stretch it by; nothing see-through (v125:
  // a fill, however faint, is a layer the size of the box on screen, two where it is seen from outside, and a few large
  // boxes or one round you cost a headset's frame rate while editing). Pointed at or selected, its edges light up:
  // lighter, their dashes denser, its ticks a third of each edge long instead of a fifth. `body` is scaled to its size
  // (its unseen box is what the pointer finds), `deco` is not
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
    plain: { mix: 0, dash: 0.07, gap: 0.05, line: 0.75, tick: 0.8 },
    lit: { mix: 0.4, dash: 0.06, gap: 0.02, line: 1, tick: 1 },
  };
  function cut(id) {
    const col = new THREE.Color(CUT_COL), white = new THREE.Color(1, 1, 1);
    const body = new THREE.Group(), deco = new THREE.Group();
    const hit = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ visible: false }));
    const line = new THREE.LineSegments(cutGeo.dash, new THREE.LineDashedMaterial({ color: col, dashSize: 0.07, gapSize: 0.05, transparent: true, opacity: 0.8, depthWrite: false }));
    line.renderOrder = 6;
    const ticks = new THREE.LineSegments(cutGeo.ticks, new THREE.LineBasicMaterial({ color: col.clone().lerp(white, 0.3), transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }));
    ticks.renderOrder = 8; ticks.frustumCulled = false;
    body.add(hit, line, ticks);
    const name = tag(30);
    deco.add(name);
    const corners = [];
    for (let k = 0; k < 8; k++) {
      const c = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color(1, 1, 1), 0.5), transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
      c.scale.setScalar(0.04); c.renderOrder = 9; c.userData.corner = k; c.visible = false;
      deco.add(c); corners.push(c);
    }
    let lookOf = null;
    return {
      body, deco, hit, line, ticks, name, corners, col: CUT_COL,
      // hot: the pointer on it, selected: its corners shown (either lights its edges up); off: it cuts nothing now
      // (hidden for you, previewed whole, or its object not here), drawn fainter
      look(o) {
        const k = o.off ? 0.45 : 1, L = o.selected || o.hot ? CUT_LOOK.lit : CUT_LOOK.plain;
        if (L !== lookOf) {
          lookOf = L;
          line.material.color.copy(col).lerp(white, L.mix); line.material.dashSize = L.dash; line.material.gapSize = L.gap;
          ticks.material.color.copy(col).lerp(white, 0.3 + L.mix / 2); ticks.geometry = L === CUT_LOOK.lit ? cutGeo.ticksLit : cutGeo.ticks;
        }
        line.material.opacity = L.line * k;
        ticks.material.opacity = L.tick * k;
        for (const c of corners) { c.visible = !!o.selected; c.scale.setScalar(o.hotCorner === c.userData.corner ? 0.06 : 0.04); }
        name.visible = !(o.hot || o.selected);   // (the engine's label names it then)
      },
      drop() { hit.material.dispose(); line.material.dispose(); ticks.material.dispose(); for (const c of corners) c.material.dispose(); name.userData.drop(); },
    };
  }
  // a group: a faint dashed box (about seven dashes an edge, whatever its size) round its members, over everything, in its
  // colour; `deco` is placed at the box's middle and `box` scaled to its size
  function group(id) {
    const col = new THREE.Color(colOf(id)), deco = new THREE.Group();
    const box = new THREE.LineSegments(cutGeo.dash, new THREE.LineDashedMaterial({ color: col.clone().lerp(new THREE.Color(1, 1, 1), 0.25), dashSize: 0.05, gapSize: 0.06, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
    box.renderOrder = 7; box.frustumCulled = false;
    deco.add(box); deco.visible = false;
    return { deco, box, col: '#' + col.getHexString(), drop() { box.material.dispose(); } };
  }
  // a shape: its body (scaled to its size, turned as it is: the item's holder) holds the drawn mesh, a see-through fill
  // and its edges (editing); `deco` (not scaled, following its place and turn) its name and, for a cube, the corner balls
  // to stretch it by. Lit in its colour, or hiding things: drawn into the depth alone (no colour), before the items
  // (renderOrder -1: after the stage's floor and sky, so in VR the stage shows where it stands and in AR the room) so
  // what stands behind it is hidden; a closed shape from its outside only (from inside it hides nothing), a plane both
  // ways. The geometries are shared (unit sized: a 1 m box, a ball and a cylinder 1 m across, a 1 m square upright,
  // facing +z)
  const SHAPE_GEO = { cube: box, sphere: new THREE.SphereGeometry(0.5, 40, 24), cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 40, 1), plane: new THREE.PlaneGeometry(1, 1) };
  const SHAPE_EDGE = {};
  const shapeEdges = k => SHAPE_EDGE[k] || (SHAPE_EDGE[k] = new THREE.EdgesGeometry(SHAPE_GEO[k], 20));   // (a ball: none)
  function shape(id) {
    const body = new THREE.Group(), deco = new THREE.Group();
    const lit = new THREE.MeshStandardMaterial({ color: 0xc9d1dc, roughness: 0.75, metalness: 0 });
    const hide = new THREE.MeshBasicMaterial({ colorWrite: false });
    const mesh = new THREE.Mesh(box, lit);
    const fill = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0xc9d1dc, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
    fill.renderOrder = 5;
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
    line.renderOrder = 6;
    body.add(mesh, fill, line);
    const name = tag(30);
    deco.add(name);
    const corners = [];
    for (let k = 0; k < 8; k++) {
      const c = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: 0xe8eef8, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
      c.scale.setScalar(0.04); c.renderOrder = 9; c.userData.corner = k; c.visible = false;
      deco.add(c); corners.push(c);
    }
    let kind = '', col = '', hides = false, a = -1;
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
          col = r.colour; S.col = col;
          lit.color.set(col); fill.material.color.set(col);
          line.material.color.set(col).lerp(new THREE.Color(1, 1, 1), 0.35);
          for (const c of corners) c.material.color.set(col).lerp(new THREE.Color(1, 1, 1), 0.5);
        }
        if ((r.look === 'hide') !== hides) { hides = r.look === 'hide'; mesh.material = hides ? hide : lit; mesh.renderOrder = hides ? -1 : 0; a = -1; }
      },
      // a: its fade (shown or hidden for you: a colour fades, what hides things switches at one half); editing: its fill and
      // edges for one that hides things (the edges also when pointed at or selected), its corners when selected (a cube)
      look(o) {
        if (Math.abs(o.a - a) > 1e-3) {
          a = o.a;
          if (hides) mesh.visible = a > 0.5;
          else {
            mesh.visible = a > 0.002;
            const full = a >= 0.999;
            lit.transparent = !full; lit.opacity = full ? 1 : a; lit.depthWrite = full;
          }
        }
        fill.visible = !!o.editing && hides;
        fill.material.opacity = (o.hot ? 0.24 : 0.14) * (hides ? 1 : 0) * Math.max(0.35, o.a);
        line.visible = !!o.editing && (hides || o.hot || o.selected) && kind !== 'sphere';
        line.material.opacity = o.selected || o.hot ? 1 : 0.6;
        for (const c of corners) { c.visible = !!o.selected && kind === 'cube'; c.scale.setScalar(o.hotCorner === c.userData.corner ? 0.06 : 0.04); }
        name.visible = !!o.editing && hides && !(o.hot || o.selected);   // (one you cannot see; the engine's label names it when pointed at)
      },
      hides: () => hides,
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
    const axes = new THREE.LineSegments(axGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
    axes.renderOrder = 8; axes.frustumCulled = false;
    const dot = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }));
    dot.scale.setScalar(0.025); dot.renderOrder = 8;
    const hit = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ visible: false })); hit.scale.setScalar(0.12);
    const name = tag(30); name.position.y = 0.2;
    g.add(axes, dot, hit, name);
    return {
      group: g, hit, name, col: '#' + col.getHexString(),
      look(o) { dot.scale.setScalar(o.hot || o.selected ? 0.04 : 0.025); axes.material.opacity = o.hot || o.selected ? 1 : 0.75; name.visible = !(o.hot || o.selected); },
      drop() { axes.material.dispose(); dot.material.dispose(); hit.material.dispose(); name.userData.drop(); },
    };
  }
  // a model that is not here yet (loading, missing or unreadable): a grey box with a line of text over it
  function grey() {
    const g = new THREE.Group();
    const fill = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x6c7d94, roughness: 0.9, transparent: true, opacity: 0.55 }));
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xb8c4d4 }));
    const body = new THREE.Group(); body.add(fill, line); body.scale.setScalar(0.4); body.position.y = 0.2;
    g.add(body);
    const name = tag(28); name.position.y = 0.48;
    g.add(name);
    return { group: g, body, fill, name, drop() { fill.material.dispose(); line.material.dispose(); name.userData.drop(); } };
  }
  return { colOf, cube, speaker, cut, group, shape, empty, grey, tag, CUT_COL, CUT_LOOK,
    dispose() { box.dispose(); edges.dispose(); ball.dispose(); cone.dispose(); cutGeo.dash.dispose(); cutGeo.ticks.dispose(); cutGeo.ticksLit.dispose(); axGeo.dispose(); for (const k of ['sphere', 'cylinder', 'plane']) SHAPE_GEO[k].dispose(); for (const g of Object.values(SHAPE_EDGE)) g.dispose(); } };
})();
