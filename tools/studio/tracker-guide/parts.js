// The tracker guide's parts (tools/studio/tracker-guide/README.md): the models of examples/tracker-guide/, built in the
// generator's page with the Bliss XP room's kit (XP.*), the studio tour's signs (TOUR.signs) and the app's own solver
// (ik.js) and mannequin (bodies.js: the tutorial's robot, the people's 'street armour' figure, exported as a skinned model
// with Mixamo's bone names).
//
// Every motion is the solver's, not drawn by hand: a performer (the same mannequin, never drawn but at the T-pose stand)
// moves by a few simple turns of its joints; each tracker, headset, controller or tracked wrist is fixed to one of its
// bones (a rigid offset, as a strap holds it); their poses each frame are the targets, which ik.js's match (from the
// T-pose: each device tied to the part it is nearest to; fit first with no headset), calibrate and solve (its 'any' setup,
// v201) turn into the robot's bones, taken 20 times a second with sample and made a clip with clipOf.
// The pucks drawn are the targets themselves (bones of their own, a second skin), so where the robot's limbs miss them is
// where the solver guessed. Deterministic: no random numbers at all.
(function () {
  const T = THREE;
  const GD = window.GUIDE = { parts: [] };
  const IK = makeIK(T), M = HOST.bodies.mannequin();
  const V = (x, y, z) => new T.Vector3(x || 0, y || 0, z || 0), Qy = a => new T.Quaternion().setFromAxisAngle(V(0, 1, 0), a);
  const AT = n => V(...M.at[M.BI[n]]);   // (a bone's place at rest, the mannequin standing in its T-pose)
  const HZ = 60, FPS = 20;              // (solved 60 times a second, taken 20 times)
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, k) => a + (b - a) * k;

  // ------------------------------------------------------------------ the looks --
  // the tutorial's guide's colour (pearl) and its copy's (orange: the character being worn, at the T-pose stand); the
  // armour's undersuit and plates in a deep shade of it, the lights in the colour itself (unlit), the visor dark glass
  const LOOK = {
    robot: { light: [0.91, 0.93, 0.97], plate: [0.3, 0.32, 0.36], suit: [0.06, 0.065, 0.08] },
    char: { light: [1, 0.7, 0.28], plate: [0.42, 0.25, 0.1], suit: [0.09, 0.055, 0.03] },
  };
  const GLASS = [0.02, 0.025, 0.04];
  // each part's colour (the pucks and their tags), shared by the signs
  const COL = GD.COL = { head: '#ffd34d', chest: '#ff8a3d', hips: '#ff5a4b', hand: '#46d9ff', elbow: '#3ee08f', knee: '#c08cff', foot: '#5aa9ff', hmd: '#e7eef8', ctl: '#9fb3c8', wrist: '#46d9ff' };

  // a figure: the mannequin's bones (names with a prefix in place of mixamorig, or Mixamo's own) and its body as one
  // skinned mesh, every vertex on one bone, two materials (lit plates, suit and glass; the lights unlit)
  function figure(look, prefix) {
    const name = n => (prefix ? prefix + n.replace('mixamorig', '') : n);
    const bones = M.bones.map(b => { const o = new T.Bone(); o.name = name(b.name); o.position.fromArray(b.p); return o; });
    M.bones.forEach((b, i) => { if (b.parent) bones[M.BI[b.parent.replace('mixamorig', '')]].add(bones[i]); });
    const g0 = M.geometry, P = g0.attributes.position, N = g0.attributes.normal, B = g0.attributes.aBone, G = g0.attributes.aGlow, Mt = g0.attributes.aMat, I = g0.index.array;
    const n = P.count, col = new Float32Array(n * 3), si = new Uint8Array(n * 4), sw = new Float32Array(n * 4);
    const mat = i => Math.round(Mt.getX(i)) % 4;
    for (let i = 0; i < n; i++) {
      const m = mat(i), c = m === 0 ? look.suit : m === 1 ? look.plate : m === 2 ? GLASS : look.light;
      col.set(c, i * 3); si[i * 4] = Math.round(B.getX(i)); sw[i * 4] = 1;
    }
    const lit = [], glow = [];
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2], g = (G.getX(a) + G.getX(b) + G.getX(c)) / 3;
      (g >= 0.5 || mat(a) === 3 ? glow : lit).push(a, b, c);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(P.array.slice(), 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(N.array.slice(), 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new T.Uint8BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
    geo.setIndex(lit.concat(glow));
    geo.addGroup(0, lit.length, 0); geo.addGroup(lit.length, glow.length, 1);
    const mesh = new T.SkinnedMesh(geo, [XP.lit({ roughness: 0.45, metalness: 0.15 }), new T.MeshBasicMaterial({ color: new T.Color().fromArray(look.light) })]);
    mesh.name = name('body');
    return { bones, mesh, by: n2 => bones[M.BI[n2]] };
  }
  // a holder for a figure: root (its place and size) > armature (its own size, k) > the hips and the body, bound at rest
  function holder(name, fig, k) {
    const arm = XP.group(name + 'Armature'), root = XP.group(name);
    arm.scale.setScalar(k || 1);
    arm.add(fig.bones[0], fig.mesh); root.add(arm);
    root.updateMatrixWorld(true);
    fig.mesh.bind(new T.Skeleton(fig.bones), fig.mesh.matrixWorld);
    return root;
  }

  // ------------------------------------------------------------------ what is worn --
  // a point on the body's surface: from o (inside) along d, the furthest place the ray leaves the named bones' pieces,
  // plus a gap (where a puck sits on its strap)
  function surf(bones, o, d, r, gap) {
    d = d.clone().normalize();
    const want = new Set(bones.map(b => M.BI[b])), P = M.geometry.attributes.position, B = M.geometry.attributes.aBone, I = M.geometry.index.array;
    const ray = new T.Ray(o, d), a = V(), b = V(), c = V(), hit = V();
    let best = -Infinity;
    for (let t = 0; t < I.length; t += 3) {
      if (![0, 1, 2].every(k => want.has(Math.round(B.getX(I[t + k]))))) continue;
      a.fromBufferAttribute(P, I[t]); b.fromBufferAttribute(P, I[t + 1]); c.fromBufferAttribute(P, I[t + 2]);
      if (ray.intersectTriangle(a, b, c, false, hit)) best = Math.max(best, hit.sub(o).dot(d));
    }
    if (!isFinite(best)) throw new Error(`surf: nothing of ${bones.join(', ')} along that line`);
    return o.clone().addScaledVector(d, best + (gap || 0));
  }
  const up = d => new T.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());   // (a puck's face, its +y, along d)
  // the devices: id (a tracker's serial-like name: assign finds their parts from where they are, not from these), the
  // slot it should be found as, its tag, the bone it is strapped to, its pose at rest (on the T-posed mannequin), its kind
  // and colour, and where its tag hangs from it (at rest, in the figure's frame)
  const KNEE = { l: AT('LeftUpLeg').lerp(AT('LeftLeg'), 0.8), r: AT('RightUpLeg').lerp(AT('RightLeg'), 0.8) };   // (the thigh, just above the knee: an assumption, GD.KNEE_AT)
  GD.KNEE_AT = 0.8; GD.HEAD_AT = 'front';
  const DEV = {};
  const dev = (id, slot, label, bone, p, q, kind, col, tag) => { DEV[id] = { id, slot, label, bone, p, q, kind, col, tag: V(...tag) }; };
  (function () {
    const pk = (id, slot, label, bones, o, d, col, tag) => dev(id, slot, label, bones[0], surf(bones, V(...o), V(...d), 0.06, 0.013), up(V(...d)), 'puck', col, tag);
    // (the head's on the front of the head, the forehead above the visor: the owner, 25 November 2026)
    pk('trk07', 'head', 'Head', ['Head'], [0, 1.695, 0], [0, 0, 1], COL.head, [0, 0.085, 0.02]);
    pk('trk03', 'chest', 'Chest', ['Spine2'], [0, 1.31, 0], [0, 0, 1], COL.chest, [0.15, 0.01, 0.02]);
    pk('trk10', 'hips', 'Hips', ['Hips'], [0, 1.0, 0], [0, 0, -1], COL.hips, [0, -0.075, -0.02]);
    for (const [s, k, a, b, c, e, S] of [['l', 1, 'trk01', 'trk05', 'trk09', 'trk02', 'Left'], ['r', -1, 'trk11', 'trk04', 'trk06', 'trk08', 'Right']]) {
      pk(a, s + 'hand', S + ' hand', [S + 'Hand'], [k * 0.78, 1.41, 0], [0, 1, 0], COL.hand, [k * 0.16, 0.03, 0]);
      pk(b, s + 'elbow', S + ' elbow', [S + 'Arm'], [k * 0.4, 1.41, 0], [0, 1, 0], COL.elbow, [0, 0.075, 0]);
      const kn = KNEE[s];
      pk(c, s + 'knee', S + ' knee', [S + 'UpLeg'], [kn.x, kn.y, kn.z], [0, 0, 1], COL.knee, [k * 0.13, 0, 0.02]);
      const an = AT(S + 'Foot');
      pk(e, s + 'foot', S + ' foot', [S + 'Foot', S + 'ToeBase'], [an.x, 0.05, an.z + 0.08], [0, 1, 0.3], COL.foot, [k * 0.13, 0.03, 0.05]);
    }
    // the headset over the eyes (its middle 4.5 cm in front of the helmet at eye height); the controllers held in the fists
    // (the middle of a fist 5.5 cm out from the wrist and 1.5 cm down, as bodies.js has it); a tracked hand's wrist
    dev('hmd', 'head', 'Headset', 'Head', surf(['Head'], V(0, 1.625, 0), V(0, 0, 1), 0.03, 0.045), new T.Quaternion(), 'headset', COL.hmd, [0, 0.12, 0]);
    for (const [s, k, S] of [['l', 1, 'Left'], ['r', -1, 'Right']]) {
      const w = AT(S + 'Hand');
      dev(s + 'ctl', s + 'hand', S + ' controller', S + 'Hand', w.clone().add(V(k * 0.055, -0.015, 0)), new T.Quaternion(), 'controller', COL.ctl, [k * 0.17, -0.05, 0]);
      dev(s + 'wst', s + 'hand', S + ' hand, tracked', S + 'Hand', w.clone(), new T.Quaternion(), 'wrist', COL.wrist, [k * 0.04, 0.08, 0]);
    }
  })();
  const ELEVEN = ['trk07', 'trk03', 'trk10', 'trk01', 'trk11', 'trk05', 'trk04', 'trk09', 'trk06', 'trk02', 'trk08'];
  const SIX = ['trk07', 'trk10', 'trk01', 'trk11', 'trk02', 'trk08'];
  GD.DEV = DEV;

  // the devices drawn: one skinned mesh over bones of their own (dev_<id>, the pose; under it dev_<id>_on, the puck in its
  // colour and its tag, and for the T-pose stand dev_<id>_off, the puck in grey: a step of their sizes switches them),
  // two draws in all (the pucks lit, the tags unlit from one picture)
  function devices(ids, o) {
    o = o || {};
    const lines = o.lines || {};
    const root = XP.group('devices'), bones = [], lit = [], tags = [], labels = ids.map(id => DEV[id]);
    // the tags' picture: a row each, 384 x 64 px (in a 512 px wide canvas), dark with a bar of the part's colour
    const rows = labels.length, H = Math.pow(2, Math.ceil(Math.log2(rows * 64))), { cv, g } = XP.canvas(512, Math.max(64, H));
    g.fillStyle = '#10161f'; g.fillRect(0, 0, cv.width, cv.height);
    const width = labels.map((d, i) => {
      g.font = `bold 32px ${XP.F.ui}`;
      const w = Math.min(384, Math.ceil(g.measureText(d.label).width) + 44), y = i * 64;
      g.fillStyle = '#10161f'; g.fillRect(0, y, 512, 64);
      g.fillStyle = d.col; g.fillRect(0, y, 12, 64);
      XP.text(g, d.label, 26, y + 44, { size: 32, weight: 'bold', color: '#ffffff', max: 384 - 34 });
      return w;
    });
    const tex = XP.tex(cv);
    const bone = (name, p, q, parent) => { const b = new T.Bone(); b.name = name; b.position.copy(p); b.quaternion.copy(q); (parent || root).add(b); bones.push(b); return b; };
    const at = (b, list, geo, col) => list.push({ geo, bi: bones.indexOf(b), col });   // (shapeOf puts each piece where its device is at rest)
    labels.forEach((d, i) => {
      const b = bone('dev_' + d.id, d.p, d.q), on = bone('dev_' + d.id + '_on', V(), new T.Quaternion(), b);
      const off = o.off ? bone('dev_' + d.id + '_off', V(), new T.Quaternion(), b) : null;
      root.updateMatrixWorld(true);
      const parts = shapeOf(d);
      for (const [geo, c] of parts) at(on, lit, geo, c);
      if (off) for (const [geo] of shapeOf(d)) at(off, lit, geo, '#dfe6ee');   // (pale: a tracker not yet given its part)
      // (the T-pose stand: a line from the puck to the part it is tied to, on a bone of its own, ln_<id>, shown by its size)
      if (lines[d.id]) {
        const [a, b2] = lines[d.id], ln = bone('ln_' + d.id, V(), new T.Quaternion()), len = a.distanceTo(b2);
        const cg = new T.CylinderGeometry(0.008, 0.008, len, 6, 1, true);
        cg.applyMatrix4(new T.Matrix4().compose(a.clone().add(b2).multiplyScalar(0.5), new T.Quaternion().setFromUnitVectors(V(0, 1, 0), b2.clone().sub(a).normalize()), V(1, 1, 1)));
        root.updateMatrixWorld(true);
        at(ln, lit, cg, d.col);
      }
      // the tag: upright, facing +z at rest (and a copy back to back, so it reads from both sides), its picture's row i
      const h = 0.05, w = h * width[i] / 64, v0 = 1 - (i * 64 + 64) / cv.height, v1 = 1 - (i * 64) / cv.height, u1 = width[i] / 512;
      for (const back of [0, 1]) {
        const pg = new T.PlaneGeometry(w, h), uv = pg.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * u1, v0 + uv.getY(k) * (v1 - v0));
        if (back) pg.rotateY(Math.PI);
        pg.translate(d.p.x + d.tag.x, d.p.y + d.tag.y, d.p.z + d.tag.z + (back ? -0.001 : 0.001));
        tags.push({ geo: pg, bi: bones.indexOf(on) });
      }
    });
    root.updateMatrixWorld(true);
    // one geometry: the pucks (lit, their colour in their corners), then the tags (their picture)
    const P = [], N = [], C = [], U = [], SI = [], I = [];
    const put = (list, colour) => {
      const start = I.length;
      for (const it of list) {
        const g2 = it.geo;
        if (!g2.attributes.normal) g2.computeVertexNormals();
        const p = g2.attributes.position, nn = g2.attributes.normal, uv = g2.attributes.uv, c = new T.Color(it.col || '#ffffff');
        const base = P.length / 3;
        for (let k = 0; k < p.count; k++) {
          P.push(p.getX(k), p.getY(k), p.getZ(k)); N.push(nn.getX(k), nn.getY(k), nn.getZ(k));
          U.push(uv && !colour ? uv.getX(k) : 0, uv && !colour ? uv.getY(k) : 0);
          C.push(c.r, c.g, c.b); SI.push(it.bi, 0, 0, 0);
        }
        if (g2.index) for (const ix of g2.index.array) I.push(base + ix); else for (let k = 0; k < p.count; k++) I.push(base + k);
      }
      return [start, I.length - start];
    };
    const [a0, a1] = put(lit, true), [b0, b1] = put(tags, false);
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
    geo.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    geo.setAttribute('skinIndex', new T.Uint8BufferAttribute(SI, 4));
    geo.setAttribute('skinWeight', new T.Float32BufferAttribute(SI.map((x, k) => (k % 4 ? 0 : 1)), 4));
    geo.setIndex(I);
    geo.addGroup(a0, a1, 0); geo.addGroup(b0, b1, 1);
    const mesh = new T.SkinnedMesh(geo, [XP.lit({ roughness: 0.5 }), new T.MeshBasicMaterial({ map: tex })]);
    mesh.name = 'pucks';
    root.add(mesh);
    root.updateMatrixWorld(true);
    // (bound with the bones as they stand: the geometry is already where they put it, so each bone's inverse undoes it)
    const sk = new T.Skeleton(bones);
    mesh.bind(sk, mesh.matrixWorld);
    return { root, bones, mesh };
  }
  // a device's pieces, at its pose at rest: [geometry in the figure's frame, colour]
  function shapeOf(d) {
    const out = [], m = new T.Matrix4().compose(d.p, d.q, V(1, 1, 1));
    const piece = (geo, c, x, y, z, rx, ry, rz) => { geo.applyMatrix4(XP.at(null, x, y, z, rx, ry, rz).m); geo.applyMatrix4(m); out.push([geo, c]); };
    if (d.kind === 'puck') {
      // a puck 7 cm across and 2 cm deep on its strap, its face along +y, a pale dot in the middle of its face
      piece(new T.CylinderGeometry(0.035, 0.037, 0.02, 14), d.col, 0, -0.002, 0);
      piece(new T.CylinderGeometry(0.012, 0.012, 0.004, 10), '#f1efe9', 0, 0.009, 0);
      piece(new T.BoxGeometry(0.03, 0.006, 0.09), '#2a3340', 0, -0.013, 0);   // (the strap's buckle under it)
    } else if (d.kind === 'headset') {
      piece(new T.BoxGeometry(0.19, 0.105, 0.09), '#1d222b', 0, 0, 0);
      piece(new T.BoxGeometry(0.17, 0.085, 0.012), '#3a4352', 0, 0, 0.05);
      piece(new T.BoxGeometry(0.2, 0.025, 0.012), d.col, 0, 0.0, -0.045);   // (the band at its back edge)
    } else if (d.kind === 'controller') {
      const k = d.id[0] === 'l' ? 1 : -1;
      piece(new T.CylinderGeometry(0.019, 0.017, 0.11, 10), '#2a3340', 0, -0.02, 0.01, Math.PI / 2 - 0.4, 0, 0);
      piece(new T.TorusGeometry(0.042, 0.007, 6, 16), d.col, k * 0.005, 0.03, 0.06, 0, Math.PI / 2, 0);
    } else if (d.kind === 'wrist') {
      piece(new T.TorusGeometry(0.048, 0.009, 6, 18), d.col, 0, 0, 0, 0, Math.PI / 2, 0);
    }
    return out;
  }

  // ------------------------------------------------------------------ the performer's moves --
  // each a loop of len seconds: the hips' place and heading, and turns of the joints (x, y, z in radians, in each bone's
  // own frame: the mannequin stands in a T-pose, every turn nothing at rest); its arms down by DOWN
  const DOWN = 1.25;
  const arms = (P, sl, sr) => { P.LeftArm = [sl || 0, 0, -DOWN]; P.RightArm = [sr || 0, 0, DOWN]; P.LeftForeArm = [0, -0.35, 0]; P.RightForeArm = [0, 0.35, 0]; };
  const waveR = (P, t, k) => {   // (the right arm up, waving, by k)
    const R = P.RightArm || [0, 0, DOWN];
    P.RightArm = [lerp(R[0], -0.3, k), 0, lerp(R[2], -0.9, k)];
    P.RightForeArm = [0, lerp(0.35, 0, k), k * (-0.45 - 0.35 * Math.sin(2 * Math.PI * 1.5 * t))];
  };
  const MOVES = {
    idle: { len: 6, at(t) {
      const P = { hips: [0, 0, 0], yaw: 0 };
      arms(P, 0.03 * Math.sin(2 * Math.PI * t / 6), -0.03 * Math.sin(2 * Math.PI * t / 6));
      P.Spine2 = [0.025 * Math.sin(2 * Math.PI * t / 3), 0, 0]; P.Head = [0.06 * Math.sin(2 * Math.PI * t / 6 + 1), 0.3 * Math.sin(2 * Math.PI * t / 6), 0];
      return P;
    } },
    wave: { len: 4, at(t) {
      const P = MOVES.idle.at(t * 1.5);
      waveR(P, t, 1); P.Head = [0, 0.15 * Math.sin(2 * Math.PI * t / 4), 0.08];
      return P;
    } },
    // marching on the spot (a step a second, the thighs lifted 43 degrees and the shins folded under), the arms swinging,
    // the head and chest turning; from 2 s the right arm goes up and waves, back down by 8 s
    march: { len: 8, at(t) {
      const ph = Math.PI * t, l = Math.max(0, Math.sin(ph)), r = Math.max(0, -Math.sin(ph)), P = { hips: [0, 0, 0], yaw: 0 };
      P.LeftUpLeg = [-0.75 * l, 0, 0]; P.LeftLeg = [1.3 * l, 0, 0]; P.LeftFoot = [-0.5 * l, 0, 0];
      P.RightUpLeg = [-0.75 * r, 0, 0]; P.RightLeg = [1.3 * r, 0, 0]; P.RightFoot = [-0.5 * r, 0, 0];
      P.Hips = [0, 0, 0.04 * Math.sin(ph)];
      arms(P, 0.4 * Math.sin(ph), 0.4 * Math.sin(ph));
      P.Spine1 = [0, 0.15 * Math.sin(2 * Math.PI * t / 8), 0];
      P.Head = [0.08 * Math.sin(2 * Math.PI * t / 4), 0.35 * Math.sin(2 * Math.PI * t / 8 + 0.6), 0];
      waveR(P, t, smooth(1.5, 2.5, t) * (1 - smooth(6.5, 7.6, t)));
      return P;
    } },
    // a lean to each side (0 to 3 s), then a walk round a circle 0.8 m across, turning left (3 to 11 s), then still
    walk: { len: 12, at(t) {
      const P = { hips: [0, 0, 0], yaw: 0 }, R = 0.4, u = smooth(3, 11, t), th = 2 * Math.PI * u, moving = Math.sin(Math.PI * u);
      P.hips = [R - R * Math.cos(th), -0.025 * moving * Math.abs(Math.sin(2 * Math.PI * t)), R * Math.sin(th)];
      P.yaw = th;
      const ph = 2 * Math.PI * t;
      arms(P, 0.35 * moving * Math.sin(ph), 0.35 * moving * Math.sin(ph));
      P.Spine = [0.05 * moving, 0, 0.28 * Math.sin(2 * Math.PI * t / 3) * (1 - smooth(2.4, 3, t))];
      P.Head = [0.1, 0.25 * Math.sin(2 * Math.PI * t / 6), 0];
      return P;
    } },
    // the hands up in front as if pinching and pointing, a lean to the left and to the right, the head looking about
    hands: { len: 8, at(t) {
      const P = { hips: [0, 0, 0], yaw: 0 }, g = 0.5 - 0.5 * Math.cos(2 * Math.PI * t / 4), sw = Math.sin(2 * Math.PI * t / 8);
      P.LeftArm = [-0.9 * g, 0, -lerp(DOWN, 1.0, g)]; P.RightArm = [-0.9 * g, 0, lerp(DOWN, 1.0, g)];
      P.LeftForeArm = [0, -lerp(0.35, 1.3, g), 0]; P.RightForeArm = [0, lerp(0.35, 1.3, g), 0];
      P.LeftHand = [0, 0, 0.3 * g * Math.sin(2 * Math.PI * t)]; P.RightHand = [0, 0, -0.3 * g * Math.sin(2 * Math.PI * t + 1)];
      P.Spine = [0, 0, 0.22 * sw]; P.Spine1 = [0, 0.12 * sw, 0];
      P.Head = [0.15 * g, 0.3 * Math.sin(2 * Math.PI * t / 8 + 2), -0.1 * sw];
      return P;
    } },
  };
  // a performer: the mannequin's bones (never drawn but at the T-pose stand) posed by a move at t, weighted by w (0: the
  // T-pose); then each device's pose (its bone's pose times its offset at rest)
  function performer(fig, rootNode) {
    const rest = fig.bones.map(b => b.position.clone()), E = new T.Euler(), q = new T.Quaternion(), hip = fig.by('Hips');
    const off = {};
    for (const id in DEV) {
      const d = DEV[id], b = AT(d.bone);
      off[id] = new T.Matrix4().compose(d.p.clone().sub(b), d.q, V(1, 1, 1));
    }
    const pose = (P, w) => {
      fig.bones.forEach((b, i) => { b.position.copy(rest[i]); b.quaternion.identity(); });
      for (const k in P) {
        if (k === 'hips' || k === 'yaw') continue;
        const b = fig.by(k);
        b.quaternion.setFromEuler(E.set(P[k][0] * w, P[k][1] * w, P[k][2] * w));
      }
      hip.position.add(V(P.hips[0] * w, P.hips[1] * w, P.hips[2] * w));
      hip.quaternion.premultiply(q.setFromAxisAngle(V(0, 1, 0), (P.yaw || 0) * w));
      rootNode.updateMatrixWorld(true);
    };
    const targets = ids => {
      const out = {};
      for (const id of ids) {
        const m = new T.Matrix4().multiplyMatrices(fig.by(DEV[id].bone).matrixWorld, off[id]), p = V(), qq = new T.Quaternion(), s = V();
        m.decompose(p, qq, s);
        out[id] = { p: p.toArray(), q: qq.toArray() };
      }
      return out;
    };
    return { pose, targets };
  }

  // ------------------------------------------------------------------ baking --
  // the solver worn as the studio lines it up (v201): the performer in the T-pose at t = 0, every device it wears tied to
  // the part it is nearest to (ik.js's match). With a headset the figure stands where it does, sized so its eyes are as
  // high as the headset; with none, fit sizes it (and says where to move it: t, which a robot standing where its
  // performer does leaves to the offsets, a few cm, and the T-pose stand's character slides to). Then calibrate ('any').
  // The build fails if any device is tied to another part than the one it is worn on (an honest check of the matching)
  function lineUp(rig, root, T0, ids, move) {
    const floor = 0;
    let k = 1, t = [0, 0, 0], f = null;
    if (ids.includes('hmd')) {
      root.scale.setScalar(1); root.updateMatrixWorld(true);
      k = +((T0.hmd.p[1] - floor) / (IK.restPose(rig, 'eye').p.y - floor)).toFixed(4);
    } else {
      root.scale.setScalar(1); root.updateMatrixWorld(true);
      f = IK.fit(rig, T0, { floor });
      if (!f.k) throw new Error('fit: ' + f.why);
      k = f.k; t = f.t;
    }
    root.scale.setScalar(k); if (move) root.position.set(t[0], 0, t[2]);
    root.updateMatrixWorld(true);
    const m = IK.match(rig, T0, { floor });
    if (!m.ok) throw new Error('match: ' + m.why);
    for (const id of ids) if (m.map[DEV[id].slot] !== id) throw new Error(`match tied ${id} (${DEV[id].label}) to ${Object.keys(m.map).find(s => m.map[s] === id) || 'nothing'}`);
    const cal = IK.calibrate(rig, T0, m.map, 'any', { floor, scale: false });
    if (!cal.ok) throw new Error('calibrate: ' + cal.why);
    cal.s = k; cal.t = t; cal.at = m.at;
    cal.order = Object.keys(m.map).map(s => m.map[s]);   // (the order the matching gives: ik.js's parts)
    return cal;
  }
  const vtrack = (name, times, vals, step) => new T.VectorKeyframeTrack(name, times, vals, step ? T.InterpolateDiscrete : undefined);
  const qtrack = (name, times, qs) => {
    const v = [];
    qs.forEach((q, i) => { let [x, y, z, w] = q; if (i) { const n = v.length; if (x * v[n - 4] + y * v[n - 3] + z * v[n - 2] + w * v[n - 1] < 0) { x = -x; y = -y; z = -z; w = -w; } } v.push(x, y, z, w); });
    return new T.QuaternionKeyframeTrack(name, times, v);
  };
  const devTracks = (ids, times, dp, dq) => ids.flatMap(id => [vtrack(`dev_${id}.position`, times, dp[id]), qtrack(`dev_${id}.quaternion`, times, dq[id])]);
  const s3 = v => [v, v, v], GONE = 1e-4;
  // a move solved through a setup: the robot's clip (its bones, by Mixamo's names: it binds to robot.glb) and the
  // devices' tracks (their poses: they bind to the stand's pucks), each once (the parts share them)
  const BAKED = {};
  function bake(key, move, setup, ids) {
    if (BAKED[key]) return BAKED[key];
    const fig = figure(LOOK.robot, ''), root = holder('robot', fig);
    const pf = figure(LOOK.robot, 'perf'), pr = holder('performer', pf), PF = performer(pf, pr);
    const rig = IK.rigOf(root);
    if (!rig.ok) throw new Error(rig.why);
    const mv = MOVES[move];
    PF.pose(mv.at(0), 0);
    const cal = lineUp(rig, root, PF.targets(ids), ids);
    BAKED.moved = Math.max(BAKED.moved || 0, Math.hypot(cal.t[0], cal.t[2]));   // (how far fit would move a robot: left to the offsets)
    const st = {}, samples = [], times = [], dp = {}, dq = {}, N = Math.round(mv.len * HZ);
    // (one loop first, unrecorded, so a stepping solver's state comes round as it will on the second)
    for (let pass = 0; pass < 2; pass++) for (let f = 0; f <= N; f++) {
      const t = f / HZ;
      PF.pose(mv.at(t), 1);
      const tg = PF.targets(ids), r = IK.solve(rig, cal, tg, 1 / HZ, st);
      if (!r.ok) throw new Error(`${key}: solve at ${t}: ${r.why}`);
      if (pass && f % (HZ / FPS) === 0) {
        samples.push(IK.sample(rig, t)); times.push(t);
        for (const id of ids) { (dp[id] = dp[id] || []).push(...tg[id].p); (dq[id] = dq[id] || []).push(tg[id].q); }
      }
    }
    return (BAKED[key] = { clip: IK.clipOf(samples, key, FPS), dev: devTracks(ids, times, dp, dq), ids, s: cal.s, map: cal.map, steps: st.n || 0, setup });
  }

  // the T-pose stand (v201): the character (orange, smaller: its own armature 0.8 of the mannequin) stands beside the robot
  // in its T-pose, and the robot (the performer, wearing 11 trackers and no headset, grey) copies it; a 5 s countdown; the
  // character comes to the performer and is sized to it (ik.js's fit: no headset); a line from each tracker to the part it
  // is tied to (match), each lit in turn; the lines go, the performer's body goes (its trackers stay) and the character
  // follows the performer's moves (marching, from the T-pose and back to it). Three items of the scene, one clock: the
  // robot (robot.glb, its clip Line up: the performer's own joints), the character (character.glb) and the pucks
  const TP = GD.TP = { len: 16, count: 0.5, slide: [5.7, 7.2], light: 7.4, gap: 0.15, beside: -1.3, k: 0.8, go: 10, ramp: [10.1, 11.1, 15, 15.9] };
  function bakeLineup() {
    if (BAKED.lineup) return BAKED.lineup;
    const pf = figure(LOOK.robot, ''), pr = holder('performer', pf), PF = performer(pf, pr);
    const fig = figure(LOOK.char, ''), charRoot = holder('character', fig, TP.k);
    const rig = IK.rigOf(charRoot);
    if (!rig.ok) throw new Error(rig.why);
    const ids = ELEVEN;
    PF.pose(MOVES.march.at(0), 0);
    const cal = lineUp(rig, charRoot, PF.targets(ids), ids, true), mv = V(...cal.t);
    const order = cal.order, T0 = PF.targets(ids), lines = {};
    for (const id of ids) lines[id] = [V(...T0[id].p), V(...cal.at[DEV[id].slot])];
    const N = Math.round(TP.len * HZ), st = {}, samples = [], pq = {}, pp = [], times = [], dp = {}, dq = {};
    for (let f = 0; f <= N; f++) {
      const t = f / HZ, w = smooth(TP.ramp[0], TP.ramp[1], t) * (1 - smooth(TP.ramp[2], TP.ramp[3], t));
      PF.pose(MOVES.march.at(Math.max(0, t - TP.ramp[0])), w);
      const tg = PF.targets(ids);
      if (t >= TP.go) {
        charRoot.scale.setScalar(cal.s); charRoot.position.copy(mv); charRoot.updateMatrixWorld(true);
        const r = IK.solve(rig, cal, tg, 1 / HZ, st);
        if (!r.ok) throw new Error(`lineup: solve at ${t}: ${r.why}`);
      } else rig.toRest();
      if (f % (HZ / FPS) === 0) {
        samples.push(IK.sample(rig, t)); times.push(t);
        for (const b of pf.bones) (pq[b.name] = pq[b.name] || []).push(b.quaternion.toArray());
        pp.push(...pf.by('Hips').position.toArray());
        for (const id of ids) { (dp[id] = dp[id] || []).push(...tg[id].p); (dq[id] = dq[id] || []).push(tg[id].q); }
      }
    }
    const E = TP.len;
    // the performer (robot.glb): its joints, and its body gone as the character is in place (its hips' size, so every bone)
    const perf = new T.AnimationClip('Line up', -1, Object.keys(pq).map(n => qtrack(n + '.quaternion', times, pq[n])).concat(
      vtrack('mixamorigHips.position', times, pp), vtrack('mixamorigHips.scale', [0, TP.go, E], [...s3(1), ...s3(GONE), ...s3(GONE)], true)));
    // the character (character.glb): the solver's bones, sliding in and sized
    const chr = IK.clipOf(samples, 'Line up', FPS);
    chr.tracks.push(vtrack('character.position', [0, TP.slide[0], TP.slide[1], E], [TP.beside, 0, 0, TP.beside, 0, 0, mv.x, 0, mv.z, mv.x, 0, mv.z]),
      vtrack('character.scale', [0, TP.slide[0], TP.slide[1], E], [...s3(1), ...s3(1), ...s3(cal.s), ...s3(cal.s)]));
    chr.resetDuration();
    // the pucks: their poses, the countdown (5 to 1, a second each), each lit with its line to its part in the matching's
    // order, the lines gone as the character starts to follow
    const dev = devTracks(ids, times, dp, dq);
    for (let i = 0; i < 5; i++) { const a = TP.count + i; dev.push(vtrack(`cd${5 - i}.scale`, [0, a, a + 1, E], [...s3(GONE), ...s3(1), ...s3(GONE), ...s3(GONE)], true)); }
    order.forEach((id, i) => {
      const a = TP.light + i * TP.gap;
      dev.push(vtrack(`dev_${id}_on.scale`, [0, a, E], [...s3(GONE), ...s3(1), ...s3(1)], true), vtrack(`dev_${id}_off.scale`, [0, a, E], [...s3(1), ...s3(GONE), ...s3(GONE)], true),
        vtrack(`ln_${id}.scale`, [0, a, TP.go, E], [...s3(GONE), ...s3(1), ...s3(GONE), ...s3(GONE)], true));
    });
    return (BAKED.lineup = { perf, chr, dev, ids, order, lines, s: cal.s, t: cal.t, map: cal.map });
  }
  // the countdown board: 5 to 1 on tiles, a bone each (a step of its size shows it), above and between the two figures
  function countdown() {
    const bones = [], { cv, g } = XP.canvas(512, 128);
    g.fillStyle = '#0d1b2a'; g.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = '#178f86'; XP.rr(g, i * 102 + 4, 4, 94, 120, 12); g.fill();
      XP.text(g, String(5 - i), i * 102 + 51, 104, { size: 100, weight: 'bold', align: 'center', color: '#ffffff', font: XP.F.title });
    }
    const root = XP.group('countdown'), P = [], U = [], S = [], I = [], at = [TP.beside / 2, 2.15, 0];
    for (let i = 0; i < 5; i++) {
      const b = new T.Bone(); b.name = 'cd' + (5 - i); b.position.set(...at); root.add(b); bones.push(b);
      for (const back of [0, 1]) {
        const pg = new T.PlaneGeometry(0.24, 0.3), uv = pg.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (i * 102 + 4 + uv.getX(k) * 94) / 512, (4 + uv.getY(k) * 120) / 128);
        if (back) pg.rotateY(Math.PI);
        pg.translate(at[0], at[1], at[2] + (back ? -0.001 : 0.001));
        const nb = P.length / 3, p = pg.attributes.position, u = pg.attributes.uv;
        for (let k = 0; k < p.count; k++) { P.push(p.getX(k), p.getY(k), p.getZ(k)); U.push(u.getX(k), u.getY(k)); S.push(i, 0, 0, 0); }
        for (const ix of pg.index.array) I.push(nb + ix);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
    geo.setAttribute('skinIndex', new T.Uint8BufferAttribute(S, 4)); geo.setAttribute('skinWeight', new T.Float32BufferAttribute(S.map((x, k) => (k % 4 ? 0 : 1)), 4));
    geo.setIndex(I);
    const mesh = new T.SkinnedMesh(geo, new T.MeshBasicMaterial({ map: XP.tex(cv) })); mesh.name = 'countdownBoard';
    root.add(mesh); root.updateMatrixWorld(true); mesh.bind(new T.Skeleton(bones), mesh.matrixWorld);
    return root;
  }

  // ------------------------------------------------------------------ the parts --
  // the stands: key (the clip's name, on robot.glb and on the stand's pucks), the move, the setup, the devices worn
  // (the setup: the one the stand's devices made before v201, kept for its name; every stand is solved by 'any' now)
  const STANDS = GD.STANDS = [
    ['Eleven trackers', 'march', 'full', ELEVEN, 1],
    ['Six trackers', 'march', 'full', SIX, 3],
    ['Feet and headset', 'march', 'feet', ['trk02', 'trk08', 'hmd', 'lctl', 'rctl'], 4],
    ['Headset and controllers', 'walk', 'head', ['hmd', 'lctl', 'rctl'], 5],
    ['Headset and hands', 'hands', 'head', ['hmd', 'lwst', 'rwst'], 6],
  ];
  const ROBOT = [['Idle', 'idle'], ['Wave', 'wave']];
  const part = (name, file, build, view) => { XP.part(name, { file, build, view: view || { dir: [0.45, 0.3, 1] } }); GD.parts.push(name); };
  // the robot: every clip of its own (Idle and Wave from 11 trackers; each stand's; the performer's at the T-pose stand)
  part('robot', 'models/robot.glb', () => {
    const fig = figure(LOOK.robot, ''), root = holder('robot', fig);
    const clips = ROBOT.map(([k, mv]) => bake(k, mv, 'full', ELEVEN).clip).concat(STANDS.map(([k, mv, setup, ids]) => bake(k, mv, setup, ids).clip), [bakeLineup().perf]);
    return { root: XP.group('guide-robot', root), clips };
  });
  part('character', 'models/character.glb', () => {
    const fig = figure(LOOK.char, ''), root = holder('character', fig, TP.k);
    return { root: XP.group('guide-character', root), clips: [bakeLineup().chr] };
  });
  for (const [k, mv, setup, ids, n] of STANDS) {
    part('pucks-' + n, `models/pucks-${n}-${k.toLowerCase().replace(/[^a-z]+/g, '-')}.glb`, () => {
      const B = bake(k, mv, setup, ids), D = devices(ids);
      return { root: XP.group('pucks', D.root), clips: [new T.AnimationClip(k, -1, B.dev)] };
    });
  }
  part('pucks-2', 'models/pucks-2-line-up.glb', () => {
    const B = bakeLineup(), D = devices(B.ids, { off: true, lines: B.lines });
    return { root: XP.group('pucks', D.root, countdown()), clips: [new T.AnimationClip('Line up', -1, B.dev)] };
  });
  GD.info = () => {
    const sc = {};
    for (const k in BAKED) if (BAKED[k] && BAKED[k].map) sc[k] = { s: BAKED[k].s, map: BAKED[k].map, steps: BAKED[k].steps };
    return { order: BAKED.lineup ? BAKED.lineup.order.map(id => DEV[id].slot) : [], moved: BAKED.moved || 0, slid: BAKED.lineup ? BAKED.lineup.t : null, cal: sc, knee: GD.KNEE_AT, head: GD.HEAD_AT,
      devices: Object.values(DEV).map(d => ({ id: d.id, slot: d.slot, label: d.label, p: d.p.toArray().map(v => +v.toFixed(3)) })) };
  };
})();
