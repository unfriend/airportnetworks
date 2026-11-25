// People's bodies (HOST.bodies, v164; the owner, 18 November 2026: "body with feet possible for everyone even just
// headset and controllers", then, after a discussion: our own solver now (Quest's WebXR body tracking maybe later, after
// a probe on a headset), a mannequin made in code, "make sure the mannequin looks cool and cyberpunk", your own legs when
// you look down "off by default"). Two designs were made and a judge picked 'street armour' (opaque faceted plates over an
// undersuit, both a deep shade of the person's colour, the colour itself in thick lights), with ideas from the losing
// 'light frame' (a scan climbing the body, circuit traces, gem nodes): docs/history.md.
// A plain script like ships.js and occlusion.js, loaded by shared.js only when a body is first wanted (a person to draw in
// a headset, the preview camera or camera mode, or My body), after ik.js, whose 'head' setup poses every body: the hips
// worked out below the head, the arms reaching for the hands, the feet planted and stepped. Heads and hands are drawn
// meanwhile, and wherever the renderer cannot read floats in a vertex shader (WebGL1 without float textures or vertex
// texture fetch: can()). Nothing here is in a story's state or a room: each device poses the others from their presence.
// What shared.js uses:
//   can(renderer)        whether bodies can be drawn there
//   attach(parent)       the two meshes hung in parent (the shell's overlay root: the renderer's reference space)
//   person(id)           a person's own figure (their skeleton, never drawn, the solver's state, their standing eye
//                        height): kept with the people overlay's object, gone when they go
//   begin(t), add(B, I), end()   each frame: every body drawn in one draw (and their glows in one more), each person's
//                        bones solved on their own skeleton and written into a float texture, a row a person; I: { head,
//                        g: [left, right] grips as [x, y, z, qx, qy, qz, qw] or null, ray: [left, right] { o, d } or
//                        null (a hand from its ray where no grip came), floor, toWorld (a Matrix4 from the frame the
//                        poses are in to the world, or null), rgb, self (your own body: the head and neck folded away),
//                        dt (s), jump (feet planted again under them) }
//   warm(renderer)       its two programs linked ahead of the first body (shared.js calls it as it loads)
//   info(B), stats()     for tests: where a body's feet are, its steps; how many were drawn and in how many draws
// What a story uses for figures of its own (v173, the tutorial's guide; loaded by HOST.needBodies(), shared.js):
//   set(cap)             a draw set of its own, 1 to 8 figures: { attach(parent), begin(t ms: its own clock), add(B, I),
//                        end(), dispose(), stats(), meshes() }; the people's set (above) is untouched by it
//   add's I, besides     hide, dark (bit masks over PARTS: hidden; lights off), power (0 to 1, all the lights and the
//   the above            plates' brightness), flash ([part, amount]: that part's lights towards white), ease (the hands'
//                        easing in s, 0.2; 0 none), warm (solve only: no row, never counted)
//   size(B, eye), grip(side, wrist, aim, out, k), point(B, name, I, out)   a fixed size; the grip that puts a wrist at a
//                        place with the forearm along a direction; a named rest point's place in the world
HOST.bodies = (function () {
  'use strict';
  const T = THREE;
  const CAP = 49;   // (the people overlay's 48, and your own)
  // the parts of a figure (HOST.bodies.set: a story hides or darkens them), packed into the materials' and the halo's
  // kinds as kind + PSTRIDE * part (both only 0 to 3 of their own)
  const PARTS = { body: 0, emblem: 1, spine: 2, visor: 3, helmet: 4, torso: 5, arms: 6, legs: 7, boots: 8 }, PSTRIDE = 4;

  // ---------------------------------------------------------------------------------------------- the mannequin
  // 'Street armour': a person in a headset drawn whole, made once in code (notes in
  // docs/agents/shared-rooms.md, "People's bodies"). Plates (a helmet, a chest plate, shoulder plates, bracers, thigh and
  // shin plates, boots) over a darker undersuit, both a deep shade of the person's colour, the colour itself in glowing
  // edge strips, knee and boot rings, a V visor with a white-hot core, a crest and a band round the helmet, gems at the
  // elbows, circuit traces ending in pads, a network emblem (a hub, three nodes, six links) on the chest and a spine of
  // five nodes down the back; a scan of light climbs the body every 5 s. Every vertex is bound to one bone (rigid, no
  // blending): plates overlap at the joints, and dark joint balls fill what a bend opens. The bones: Mixamo's names as
  // three.js gives them (mixamorigHips ...), a T-pose facing +z with its left at +x, standing on y = 0, 1.75 m tall, the
  // eyes (ik.js's rule: the head bone plus 45 % of the way to the top) at 1.62 m. 2,470 triangles; the halo 840
  function mannequin() {
    // ---- small vector helpers (plain arrays; a corner's 4th number, when there is one, is its own glow)
    const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const len = a => Math.hypot(a[0], a[1], a[2]), unit = a => mul(a, 1 / (len(a) || 1)), lerp = (a, b, t) => add(a, mul(sub(b, a), t));
    const mid = ps => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length);
    const rx = a => p => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)];
    const rz = a => p => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];

    // ---- the skeleton: each bone's place in the world at rest, every turn the identity. The legs stand a little apart
    // (PS) with the knees a little bent (the thigh LA forward, the shin LB back): the slack (2.5 cm) lets a planted foot be
    // reached a while as the hips move on, so a walk takes longer steps, and reads as a stance (before v164 ik.js's
    // stepping hopped without it; it no longer does)
    const PS = 0.045, LA = 0.24, LB = 0.24, HIP = [0.095, 0.92, 0], THL = 0.42;
    const thighR = p => rz(PS)(rx(-LA)(p)), shinR = p => rz(PS)(rx(LB)(p));
    const KNEE = add(HIP, thighR([0, -THL, 0])), SHL = (HIP[1] - 0.085 - THL * Math.cos(LA) * Math.cos(PS)) / (Math.cos(LB) * Math.cos(PS));
    const ANKLE = add(KNEE, shinR([0, -SHL, 0]));
    const SIDE = (S, k) => [
      [S + 'Shoulder', 'Spine2', k * 0.05, 1.41, 0], [S + 'Arm', S + 'Shoulder', k * 0.18, 1.41, 0],
      [S + 'ForeArm', S + 'Arm', k * 0.465, 1.41, 0], [S + 'Hand', S + 'ForeArm', k * 0.725, 1.41, 0],
      [S + 'UpLeg', 'Hips', k * HIP[0], HIP[1], HIP[2]], [S + 'Leg', S + 'UpLeg', k * KNEE[0], KNEE[1], KNEE[2]],
      [S + 'Foot', S + 'Leg', k * ANKLE[0], ANKLE[1], ANKLE[2]], [S + 'ToeBase', S + 'Foot', k * ANKLE[0], 0.025, ANKLE[2] + 0.13]];
    // the leg pieces are made straight (the hip at HIP, the knee at y 0.5, the ankle at y 0.085) and then moved to these
    const onThigh = p => add(HIP, thighR(sub(p, HIP)));
    const onShin = p => { const q = sub(p, [HIP[0], 0.5, 0]); q[1] *= SHL / 0.415; return add(KNEE, shinR(q)); };
    const onFoot = p => add(p, sub(ANKLE, [HIP[0], 0.085, 0]));
    const SK = [['Hips', null, 0, 0.98, 0], ['Spine', 'Hips', 0, 1.08, 0], ['Spine1', 'Spine', 0, 1.2, 0], ['Spine2', 'Spine1', 0, 1.32, 0],
      ['Neck', 'Spine2', 0, 1.44, 0], ['Head', 'Neck', 0, 1.52, 0], ['HeadTop_End', 'Head', 0, 1.75, 0], ...SIDE('Left', 1), ...SIDE('Right', -1)];
    const BI = {}, AT = {};
    SK.forEach((b, i) => { BI[b[0]] = i; AT[b[0]] = [b[2], b[3], b[4]]; });
    const bones = SK.map(b => ({ name: 'mixamorig' + b[0], parent: b[1] ? 'mixamorig' + b[1] : null,
      p: b[1] ? [b[2] - AT[b[1]][0], b[3] - AT[b[1]][1], b[4] - AT[b[1]][2]] : [b[2], b[3], b[4]], q: [0, 0, 0, 1] }));

    // ---- shapes. A section: n corners round c in the plane of u and v, radii [+u, +v, -u, -v], squarer for e < 1 (a
    // superellipse), turned by ph of a step, its +v side pushed out by k (a ridge); f(p, angle) bends it further
    function sec(n, c, u, v, r, o) {
      const e = o.e || 1, out = [];
      for (let i = 0; i < n; i++) {
        const t = ((o.ph || 0) + i) * 2 * Math.PI / n, cs = Math.cos(t), sn = Math.sin(t);
        const a = Math.sign(cs) * Math.pow(Math.abs(cs), e) * (cs >= 0 ? r[0] : r[2]);
        let b = Math.sign(sn) * Math.pow(Math.abs(sn), e) * (sn >= 0 ? r[1] : r[3]);
        if (o.k && sn > 0) b += o.k * Math.pow(sn, o.kp || 8);
        const p = add(c, add(mul(u, a), mul(v, b)));
        out.push(o.f ? o.f(p, t) : p);
      }
      return out;
    }
    // a solid through rings of corners, capped at both ends (fans from the middles; o.a false: no cap at the first ring,
    // o.b false: none at the last, where it is buried in another piece). Each triangle carries a point inside (its 4th
    // entry): it is turned to face away from it
    function loft(rings, ts, o) {
      o = o || {};
      const n = rings[0].length, C = rings.map(mid), tris = [], last = rings.length - 1;
      for (let r = 0; r < last; r++) {
        const ref = lerp(C[r], C[r + 1], 0.5);
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n, a = rings[r][i], b = rings[r][j], c = rings[r + 1][j], d = rings[r + 1][i];
          tris.push([a, b, c, ref], [a, c, d, ref]);
        }
      }
      for (let i = 0; i < n; i++) {
        if (o.a !== false) tris.push([C[0], rings[0][i], rings[0][(i + 1) % n], C[1]]);
        if (o.b !== false) tris.push([C[last], rings[last][i], rings[last][(i + 1) % n], C[last - 1]]);
      }
      return { rings, C, ts, tris };
    }
    // the axes a loft runs along (d) and its sections' plane (u, v)
    const AY = { d: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] }, AX = { d: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] };
    const AZ = { d: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, AB = { d: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] };
    // a loft along A from o: rows [t, r+u, r+v, r-u, r-v, du, dv, k, f] (t along d; du and dv move the section's middle);
    // so: the sections' e, ph, kp and the caps (a, b)
    function along(o, A, n, rows, so) {
      so = so || {};
      const rings = rows.map(r => sec(n, add(o, add(mul(A.d, r[0]), add(mul(A.u, r[5] || 0), mul(A.v, r[6] || 0)))), A.u, A.v,
        [r[1], r[2], r[3] == null ? r[1] : r[3], r[4] == null ? r[2] : r[4]], Object.assign({}, so, { k: r[7] || 0, f: r[8] })));
      return loft(rings, rows.map(r => r[0]), so);
    }
    // where t falls among a loft's rows (a fractional ring), and back
    const rAt = (L, t) => { const s = L.ts; for (let k = 0; k + 1 < s.length; k++) if ((t - s[k]) * (t - s[k + 1]) <= 0) return k + (t - s[k]) / (s[k + 1] - s[k]); return 0; };
    const tAt = (L, r) => { const k = Math.max(0, Math.min(Math.floor(r), L.ts.length - 2)), f = r - k; return L.ts[k] + f * (L.ts[k + 1] - L.ts[k]); };
    // a frame square to a direction
    const frame = nrm => { const u = unit(Math.abs(nrm[1]) < 0.9 ? cross([0, 1, 0], nrm) : cross(nrm, [1, 0, 0])); return { d: nrm, u, v: cross(nrm, u) }; };
    // a short prism (n sides) standing out of a surface at c: its base sunk, its face h out along nrm
    const prism = (c, nrm, r, h, n, o) => { o = o || {}; return along(c, frame(unit(nrm)), n, [[-(o.sink || 0.01), r, r], [h, o.r2 || r, o.r2 || r]], { ph: o.ph || 0, e: o.e || 1, a: false }); };
    // a flat hexagon (4 triangles) h out from c, facing nrm
    const hex = (c, nrm, r, h, ph) => { const F = frame(unit(nrm)), q = add(c, mul(F.d, h)), ref = sub(c, mul(F.d, 0.02));
      const P = [0, 1, 2, 3, 4, 5].map(i => { const t = (i + (ph || 0)) * Math.PI / 3; return add(q, add(mul(F.u, r * Math.cos(t)), mul(F.v, r * Math.sin(t)))); });
      return [1, 2, 3, 4].map(i => [P[0], P[i], P[i + 1], ref]); };
    // a joint ball (a double cone of six sides with true points, 12 triangles; hidden in the joint, it fills what a bend
    // opens) round c along A
    const ball = (c, A, r) => { const R = sec(6, c, A.u, A.v, [r, r, r, r], { ph: 0.5 }), a = add(c, mul(A.d, -r)), b = add(c, mul(A.d, r));
      return R.map((p, i) => [[a, p, R[(i + 1) % 6], c], [b, R[(i + 1) % 6], p, c]]).flat(); };
    // a gem: a pyramid of n sides standing h out of a surface at c (its base sunk out of sight), glowing whole
    const gem = (c, nrm, r, h, n, ph) => { const F = frame(unit(nrm)), top = add(c, mul(F.d, h)), ref = sub(c, mul(F.d, 0.03));
      const P = Array.from({ length: n }, (_, i) => { const t = (i + (ph || 0)) * 2 * Math.PI / n; return add(c, add(mul(F.u, r * Math.cos(t)), mul(F.v, r * Math.sin(t)))); });
      return P.map((p, i) => [p, P[(i + 1) % n], top, ref]); };
    // a strip on a loft's surface, lifted 3 mm (or with h: standing h proud on walls sunk into it): over the rings R
    // (fractional places along the loft; with gR exactly these, one glow a row) and the corners A (fractional, wrapping);
    // o.rf(r, a) moves a row's place by the corner (the visor's V). Returns its triangles and its middle line along its
    // longer way (for the halo)
    function patch(L, R, A, o) {
      o = o || {};
      const n = L.rings[0].length, nr = L.rings.length;
      const fill = s => { const out = [s[0]]; for (let k = 1; k < s.length; k++) { for (let q = Math.floor(s[k - 1]) + 1; q < s[k] - 1e-6; q++) out.push(q); out.push(s[k]); } return out; };
      const at = (r, a, lift) => {
        if (o.rf) r = o.rf(r, a);
        const ri = Math.max(0, Math.min(Math.floor(r), nr - 2)), rf = r - ri, ai = Math.floor(a), af = a - ai, i0 = ((ai % n) + n) % n, i1 = (i0 + 1) % n;
        const p = lerp(lerp(L.rings[ri][i0], L.rings[ri][i1], af), lerp(L.rings[ri + 1][i0], L.rings[ri + 1][i1], af), rf), c = lerp(L.C[ri], L.C[ri + 1], rf);
        return [add(p, mul(unit(sub(p, c)), lift)), c];
      };
      const Rs = o.gR ? R : fill(R), As = fill(A), lift = o.h || 0.003, sink = o.sink || 0.006, closed = As[As.length - 1] - As[0] >= n - 1e-6;
      const gl = i => (o.gR ? o.gR[i] : o.g == null ? 1 : o.g), G = (p, g) => [p[0], p[1], p[2], g], tris = [];
      for (let i = 0; i + 1 < Rs.length; i++) for (let j = 0; j + 1 < As.length; j++) {
        const [p00, c0] = at(Rs[i], As[j], lift), [p01] = at(Rs[i], As[j + 1], lift), [p10, c1] = at(Rs[i + 1], As[j], lift), [p11] = at(Rs[i + 1], As[j + 1], lift);
        const ref = lerp(c0, c1, 0.5);
        tris.push([G(p00, gl(i)), G(p01, gl(i)), G(p11, gl(i + 1)), ref], [G(p00, gl(i)), G(p11, gl(i + 1)), G(p10, gl(i + 1)), ref]);
      }
      if (o.h) {
        const cell = (i, j) => at((Rs[i] + Rs[i + 1]) / 2, (As[j] + As[j + 1]) / 2, (o.h - sink) / 2)[0];
        const wall = (r1, a1, g1, r2, a2, g2, ref) => {
          const P = at(r1, a1, lift)[0], Q = at(r2, a2, lift)[0], P0 = at(r1, a1, -sink)[0], Q0 = at(r2, a2, -sink)[0];
          tris.push([G(P0, g1), G(Q0, g2), G(Q, g2), ref], [G(P0, g1), G(Q, g2), G(P, g1), ref]);
        };
        const ni = Rs.length - 1, nj = As.length - 1;
        for (let j = 0; j < nj; j++) {
          wall(Rs[0], As[j], gl(0), Rs[0], As[j + 1], gl(0), cell(0, j));
          wall(Rs[ni], As[j], gl(ni), Rs[ni], As[j + 1], gl(ni), cell(ni - 1, j));
        }
        if (!closed) for (let i = 0; i < ni; i++) {
          wall(Rs[i], As[0], gl(i), Rs[i + 1], As[0], gl(i + 1), cell(i, 0));
          wall(Rs[i], As[nj], gl(i), Rs[i + 1], As[nj], gl(i + 1), cell(i, nj - 1));
        }
      }
      const rm = (Rs[0] + Rs[Rs.length - 1]) / 2, am = (As[0] + As[As.length - 1]) / 2;
      const la = As.map(a => at(rm, a, lift)[0]), lr = fill([Rs[0], Rs[Rs.length - 1]]).map(r => at(r, am, lift)[0]);
      const pl = ps => ps.slice(1).reduce((s, p, i) => s + len(sub(p, ps[i])), 0), alongA = pl(la) >= pl(lr);
      return { tris, line: alongA ? (closed ? la.slice(0, -1) : la) : lr, closed: alongA && closed };
    }
    // a circuit trace on a loft: straight runs through points [t, corner] (t along the loft, as its rows), w wide and lifted
    // 3.5 mm, split where the loft's facets turn so each piece lies on one, every piece a little longer so the jogs close,
    // ending in a round pad (a hexagon of radius pr). Returns its triangles and the pad's place (for the halo)
    function trace(L, pts, w, pr) {
      const n = L.rings[0].length, nr = L.rings.length;
      const at = (r, a, lift) => {
        const ri = Math.max(0, Math.min(Math.floor(r), nr - 2)), rf = r - ri, ai = Math.floor(a), af = a - ai, i0 = ((ai % n) + n) % n, i1 = (i0 + 1) % n;
        const p = lerp(lerp(L.rings[ri][i0], L.rings[ri][i1], af), lerp(L.rings[ri + 1][i0], L.rings[ri + 1][i1], af), rf), c = lerp(L.C[ri], L.C[ri + 1], rf);
        return [add(p, mul(unit(sub(p, c)), lift)), c];
      };
      const fn = (r, a) => { const [p, c] = at(r, a, 0); let m = unit(cross(sub(at(r + 0.01, a, 0)[0], at(r - 0.01, a, 0)[0]), sub(at(r, a + 0.01, 0)[0], at(r, a - 0.01, 0)[0]))); return dot(m, sub(p, c)) < 0 ? mul(m, -1) : m; };
      const P = pts.map(q => [rAt(L, q[0]), q[1]]), tris = [];
      for (let k = 0; k + 1 < P.length; k++) {
        const [r0, a0] = P[k], [r1, a1] = P[k + 1], cuts = [0, 1];
        for (let q = Math.floor(Math.min(r0, r1)) + 1; q < Math.max(r0, r1) - 1e-6; q++) cuts.push((q - r0) / (r1 - r0));
        for (let q = Math.floor(Math.min(a0, a1)) + 1; q < Math.max(a0, a1) - 1e-6; q++) cuts.push((q - a0) / (a1 - a0));
        cuts.sort((x, y) => x - y);
        for (let j = 0; j + 1 < cuts.length; j++) {
          const u0 = cuts[j], u1 = cuts[j + 1];
          if (u1 - u0 < 1e-4) continue;
          const rr = u => r0 + (r1 - r0) * u, aa = u => a0 + (a1 - a0) * u, um = (u0 + u1) / 2;
          const [p, c0] = at(rr(u0), aa(u0), 0.0035), [q, c1] = at(rr(u1), aa(u1), 0.0035), d = unit(sub(q, p));
          const s = mul(unit(cross(d, fn(rr(um), aa(um)))), w / 2), e = mul(d, w * 0.3), pa = sub(p, e), qb = add(q, e), ref = lerp(c0, c1, 0.5);
          tris.push([add(pa, s), sub(pa, s), sub(qb, s), ref], [add(pa, s), sub(qb, s), add(qb, s), ref]);
        }
      }
      const [re, ae] = P[P.length - 1], pe = at(re, ae, 0.0045)[0];
      tris.push(...hex(pe, fn(re, ae), pr, 0, 0.5));
      return { tris, end: pe };
    }

    // ---- the pieces: triangles bound to a bone (with o.m the material: 0 undersuit, 1 plate, 2 visor glass; o.g the glow),
    // the halo's lines and spots; the left side is made once and mirrored
    // (every item in a part, PARTS: the one of the part() block it is made in, else the body's, 0; a story hides or
    // darkens a figure's parts, HOST.bodies.set)
    const items = [], SUIT = { m: 0, crease: 60 }, PLATE = { m: 1, crease: 30 };
    let PART = 0;
    const part = (p, fn) => { const was = PART; PART = p; try { fn(); } finally { PART = was; } };
    const put = (L, bone, o) => { items.push({ tris: L.tris || L, bone, o: o || PLATE, part: PART }); return L; };
    const spot = (p, bone, w, i) => items.push({ spot: p, bone, w, i, part: PART });
    const glow = (L, R, A, bone, o) => {
      o = o || {};
      const P = patch(L, R, A, o);
      items.push({ tris: P.tris, bone, o: { m: o.m == null ? 1 : o.m, g: 1, crease: o.crease || 30 }, part: PART });
      if (o.hi !== 0) items.push({ line: P.line, closed: P.closed, bone, w: o.hw || 0.03, i: o.hi || 0.32, part: PART });
      return P;
    };
    // the named rest points (HOST.bodies.point): name -> [bone, x, y, z], the place at rest
    const PTS = {}, pt = (name, bone, p) => { PTS[name] = [bone, p[0], p[1], p[2]]; };
    const mx = p => { const q = p.slice(); q[0] = -q[0]; return q; };
    const mirror = it => Object.assign({}, it, { bone: it.bone.replace('Left', 'Right'), tris: it.tris && it.tris.map(t => t.map(mx)),
      line: it.line && it.line.map(mx), spot: it.spot && mx(it.spot), floor: it.floor && it.floor.map(mx) });
    const sided = fn => { const a = items.length; fn(); for (const it of items.slice(a)) items.push(mirror(it)); };
    // every point of the items made since `from` moved by f
    const moved = (from, f) => {
      const g = q => { const r = f(q); if (q.length > 3) r.push(q[3]); return r; };
      for (const it of items.slice(from)) { if (it.tris) it.tris = it.tris.map(t => t.map(g)); if (it.line) it.line = it.line.map(f); if (it.spot) it.spot = f(it.spot); if (it.floor) it.floor = it.floor.map(f); }
    };
    // the network emblem: a hub and three nodes round it, six links, glowing, on a face at c facing nrm (s: its size)
    function emblem(c, nrm, s, bone) {
      const F = frame(unit(nrm)), at = (x, y) => add(c, add(mul(F.u, x * 0.034 * s), mul(F.v, y * 0.034 * s)));
      const nodes = [at(0, 0), at(0, 1), at(-0.866, -0.5), at(0.866, -0.5)];
      nodes.forEach((p, i) => pt('emblem' + i, bone, add(p, mul(F.d, 0.003))));
      nodes.forEach((p, i) => { put(hex(p, F.d, (i ? 0.012 : 0.015) * s, 0.003, 0.5), bone, { m: 1, g: 1, crease: 10 }); spot(add(p, mul(F.d, 0.006)), bone, 0.028 * s, i ? 0.42 : 0.55); });
      const tris = [];
      for (const [i, j] of [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [3, 1]]) {
        const a = add(nodes[i], mul(F.d, 0.002)), b = add(nodes[j], mul(F.d, 0.002)), w = mul(unit(cross(sub(b, a), F.d)), 0.005 * s), ref = sub(mid([a, b]), mul(F.d, 0.02));
        tris.push([add(a, w), sub(a, w), sub(b, w), ref], [add(a, w), sub(b, w), add(b, w), ref]);
      }
      put(tris, bone, { m: 1, g: 1, crease: 10 });
    }

    // HEAD: a faceted helmet with a pointed jaw and a brow over a wide visor band (dark glass, the colour glowing through
    // its middle); comms pods at the ears
    const helmet = put(along([0, 0, 0], AY, 12, [
      [1.512, 0.056, 0.07, 0.056, 0.07, 0, 0.026, 0.024], [1.55, 0.086, 0.098, 0.086, 0.098, 0, 0.016, 0.02],
      [1.588, 0.103, 0.108, 0.103, 0.116, 0, 0.008, 0.006], [1.655, 0.106, 0.11, 0.106, 0.13, 0, 0.002],
      [1.672, 0.106, 0.124, 0.106, 0.13, 0, 0.004], [1.712, 0.094, 0.1, 0.094, 0.122, 0, -0.004], [1.748, 0.06, 0.052, 0.06, 0.08, 0, -0.016]],
    { e: 0.9, kp: 6 }), 'Head', { m: 1, crease: 28 });
    // the visor swept back in a shallow V (its rows 2.6 cm lower in the middle of the face than at the ears), dark glass
    // with a white-hot core; the glass smooth across its facets so the sky's streak runs across it
    const VDIP = a => 0.026 * Math.max(0, 1 - Math.abs(a - 3) / 2.7), vrf = (r, a) => rAt(helmet, tAt(helmet, r) - VDIP(a));
    part(3, () => glow(helmet, [rAt(helmet, 1.592), rAt(helmet, 1.622), rAt(helmet, 1.652)], [0.3, 5.7], 'Head',
      { h: 0.011, sink: 0.012, m: 2, gR: [0.1, 1, 0.1], rf: vrf, hw: 0.05, hi: 0.42, crease: 45 }));
    {   // (the visor's middle, on its glass: the front corner of the helmet, the V's dip below the visor's middle row)
      const r = rAt(helmet, 1.622 - VDIP(3)), ri = Math.floor(r), f = r - ri, p = lerp(helmet.rings[ri][3], helmet.rings[ri + 1][3], f), c = lerp(helmet.C[ri], helmet.C[ri + 1], f);
      pt('visor', 'Head', add(p, mul(unit(sub(p, c)), 0.011)));
    }
    part(4, () => {
    for (const a of [1.55, 4.2]) glow(helmet, [rAt(helmet, 1.528), rAt(helmet, 1.562)], [a, a + 0.25], 'Head', { hw: 0.022, hi: 0.3 });
    // a crest line from the visor over the top to the collar, and a band round the back between the ear pods, so a head
    // reads from behind and from the side
    glow(helmet, [rAt(helmet, 1.636), 6], [2.82, 3.18], 'Head', { hw: 0.03, hi: 0.26 });
    glow(helmet, [rAt(helmet, 1.6), 6], [8.82, 9.18], 'Head', { hw: 0.03, hi: 0.26 });
    {
      const f = helmet.rings[6][3], b = helmet.rings[6][9], y = 1.751, s = 0.0105;
      put([[[s, y, f[2]], [-s, y, f[2]], [-s, y, b[2]], [0, 1.7, -0.02]], [[s, y, f[2]], [-s, y, b[2]], [s, y, b[2]], [0, 1.7, -0.02]]], 'Head', { m: 1, g: 1, crease: 10 });
      items.push({ line: [[0, y, f[2]], [0, y, b[2]]], bone: 'Head', w: 0.03, i: 0.26, part: PART });
    }
    glow(helmet, [rAt(helmet, 1.61), rAt(helmet, 1.632)], [6.25, 11.75], 'Head', { hw: 0.03, hi: 0.3 });
    sided(() => {
      const pod = put(prism([0.1, 1.618, -0.014], [1, 0, 0], 0.04, 0.024, 6, { sink: 0.02, r2: 0.032 }), 'Head', { m: 1, crease: 30 });
      glow(pod, [0.62, 1], [0, 6], 'Head', { hi: 0 });
      put(hex([0.124, 1.618, -0.014], [1, 0, 0], 0.02, 0.003), 'Head', { m: 1, g: 1, crease: 10 });
      spot([0.13, 1.618, -0.014], 'Head', 0.045, 0.5);
    });
    });
    // NECK and COLLAR
    put(along([0, 0, 0], AY, 8, [[1.40, 0.058, 0.062, 0.058, 0.055, 0, 0.004], [1.48, 0.054, 0.058, 0.054, 0.054, 0, 0.006], [1.545, 0.056, 0.06, 0.056, 0.056, 0, 0.008]], { a: false, b: false }), 'Neck', SUIT);
    put(along([0, 0, 0], AY, 10, [[1.40, 0.106, 0.096, 0.106, 0.09], [1.448, 0.088, 0.082, 0.088, 0.08], [1.48, 0.074, 0.072, 0.074, 0.072, 0, 0.004]], { e: 0.9, a: false }), 'Spine2', PLATE);
    // the high collar: a curved plate round the back of the neck, flaring up to the ears, a light along its top (on the
    // inside it frames the helmet from the front)
    part(5, () => {
      const m = 6, a1 = 168 * Math.PI / 180, a2 = 372 * Math.PI / 180, R = [[1.44, 0.09, 0.106], [1.558, 0.142, 0.156], [1.574, 0.148, 0.162]];
      const at = (j, i, k) => { const a = a1 + (a2 - a1) * i / m, r = R[j][k]; return [r * Math.cos(a), R[j][0], -0.02 + 0.9 * r * Math.sin(a)]; };
      const md = (j, i) => mid([at(j, i, 1), at(j, i, 2)]), G = (p, g) => [p[0], p[1], p[2], g], tris = [];
      for (let j = 0; j + 1 < R.length; j++) {
        const g = j === R.length - 2 ? 1 : 0;
        for (let i = 0; i < m; i++) {
          const ref = mid([md(j, i), md(j + 1, i + 1)]);
          for (const k of [1, 2]) tris.push([G(at(j, i, k), g), G(at(j, i + 1, k), g), G(at(j + 1, i + 1, k), g), ref], [G(at(j, i, k), g), G(at(j + 1, i + 1, k), g), G(at(j + 1, i, k), g), ref]);
        }
        for (const [i, n] of [[0, 1], [m, m - 1]]) tris.push([G(at(j, i, 1), g), G(at(j, i, 2), g), G(at(j + 1, i, 2), g), md(j, n)], [G(at(j, i, 1), g), G(at(j + 1, i, 2), g), G(at(j + 1, i, 1), g), md(j, n)]);
      }
      const top = R.length - 1;
      for (let i = 0; i < m; i++) tris.push([G(at(top, i, 1), 1), G(at(top, i + 1, 1), 1), G(at(top, i + 1, 2), 1), md(top - 1, i)], [G(at(top, i, 1), 1), G(at(top, i + 1, 2), 1), G(at(top, i, 2), 1), md(top - 1, i)]);
      put(tris, 'Spine2', { m: 1, crease: 35 });
      items.push({ line: Array.from({ length: m + 1 }, (_, i) => md(top, i)), bone: 'Spine2', w: 0.035, i: 0.32, part: PART });
    });
    // TORSO: a broad chest plate cut in a V at the front (a light along the V), an emblem badge, a pack on the back
    const vcut = (p, t) => { const s = Math.max(0, Math.sin(t)); return [p[0], p[1] - 0.042 * s * s, p[2]]; };
    const chest = put(along([0, 0, 0], AY, 12, [[1.215, 0.135, 0.100, 0.135, 0.086, 0, 0.004, 0, vcut], [1.265, 0.150, 0.116, 0.150, 0.093, 0, 0.006, 0.008],
      [1.335, 0.170, 0.126, 0.170, 0.100, 0, 0.008, 0.011], [1.405, 0.182, 0.115, 0.182, 0.100, 0, 0.006, 0.006],
      [1.445, 0.150, 0.088, 0.150, 0.086, 0, 0.002], [1.472, 0.092, 0.066, 0.092, 0.064]], { e: 0.85, kp: 8, a: false, b: false }), 'Spine2', { m: 1, crease: 25 });
    part(5, () => glow(chest, [0.07, 0.3], [0.55, 5.45], 'Spine2', { hw: 0.035 }));
    const bn = unit([0, 0.25, 1]), bc = [0, 1.372, 0.1355];
    put(prism(bc, bn, 0.058, 0.014, 6, { sink: 0.026, ph: 0.25, r2: 0.054 }), 'Spine2', { m: 1, crease: 30 });
    part(1, () => emblem(add(bc, mul(bn, 0.014)), bn, 1, 'Spine2'));
    pt('chest', 'Spine2', [0, 1.33, 0]);   // (the middle of the chest, inside it)
    put(along([0, 1.33, 0], AB, 8, [[0.07, 0.088, 0.105, 0.088, 0.1], [0.135, 0.088, 0.105, 0.088, 0.1], [0.156, 0.074, 0.09, 0.074, 0.086]], { ph: 0.5, e: 0.55, a: false }), 'Spine2', { m: 1, crease: 30 });
    // the back's spine: a light strip down the pack and on down the back to the belt, five nodes on it (the middle one the
    // hub), and on each side of the pack a circuit trace running out and down to a pad
    {
      const z = -0.1595, s = 0.011, tris = [[[s, 1.418, z], [-s, 1.418, z], [-s, 1.246, z], [0, 1.33, -0.1]], [[s, 1.418, z], [-s, 1.246, z], [s, 1.246, z], [0, 1.33, -0.1]]];
      part(5, () => put(tris, 'Spine2', { m: 1, g: 1, crease: 10 }));
      part(2, () => [[1.398, 0.014], [1.366, 0.012], [1.332, 0.019], [1.298, 0.012], [1.266, 0.014]].forEach(([y, r], i) => {
        put(hex([0, y, -0.156], [0, 0, -1], r, 0.006, 0.5), 'Spine2', { m: 3, g: 1, crease: 10 });
        spot([0, y, -0.168], 'Spine2', r * 2.6, r > 0.015 ? 0.55 : 0.4);
        pt('spine' + i, 'Spine2', [0, y, -0.162]);
      }));
    }
    part(5, () => sided(() => {
      const P = trace(chest, [[1.395, 10.12], [1.395, 10.55], [1.36, 10.85], [1.285, 10.85]], 0.02, 0.014);
      put(P.tris, 'Spine2', { m: 1, g: 1, crease: 10 }); spot(P.end, 'Spine2', 0.035, 0.32);
    }));
    // the waist: the undersuit in three bands, a plate on each (the segments), a belt with a glowing buckle; the spine's
    // strip down the back of each
    const NC = { a: false, b: false };
    const band = (bone, rows, R) => glow(put(along([0, 0, 0], AY, 8, rows, NC), bone, SUIT), R, [5.84, 6.16], bone, { m: 0, hi: 0 });
    const seg = (bone, rows) => glow(put(along([0, 0, 0], AY, 10, rows, { e: 0.9, a: false, b: false }), bone, { m: 1, crease: 28 }), [0, 1], [7.32, 7.68], bone, { hi: 0 });
    part(5, () => {
    band('Spine1', [[1.10, 0.126, 0.094, 0.126, 0.088], [1.30, 0.142, 0.105, 0.142, 0.092]], [0, 0.7]);
    seg('Spine1', [[1.142, 0.134, 0.104, 0.134, 0.094], [1.185, 0.138, 0.108, 0.138, 0.096]]);
    band('Spine', [[1.02, 0.13, 0.092, 0.13, 0.09], [1.16, 0.127, 0.094, 0.127, 0.088]], [0.2, 1]);
    seg('Spine', [[1.088, 0.138, 0.104, 0.138, 0.096], [1.13, 0.136, 0.105, 0.136, 0.095]]);
    });
    put(along([0, 0, 0], AY, 8, [[0.86, 0.118, 0.085, 0.118, 0.092], [0.93, 0.142, 0.098, 0.142, 0.104], [1.07, 0.13, 0.094, 0.13, 0.09]], NC), 'Hips', SUIT);
    put(along([0, 0, 0], AY, 10, [[0.985, 0.152, 0.108, 0.152, 0.108], [1.048, 0.148, 0.105, 0.148, 0.103]], { e: 0.9, a: false, b: false }), 'Hips', { m: 1, crease: 28 });
    part(5, () => {
    put(hex([0, 1.016, -0.103], [0, 0, -1], 0.016, 0.006, 0.5), 'Hips', { m: 3, g: 1, crease: 10 });
    spot([0, 1.016, -0.115], 'Hips', 0.035, 0.4);
    });
    put(prism([0, 1.016, 0.104], [0, 0, 1], 0.03, 0.014, 6, { sink: 0.01, ph: 0.25 }), 'Hips', PLATE);
    part(5, () => {
    put(hex([0, 1.016, 0.118], [0, 0, 1], 0.017, 0.003, 0.5), 'Hips', { m: 1, g: 1, crease: 10 });
    spot([0, 1.016, 0.124], 'Hips', 0.03, 0.4);
    });

    sided(() => {
      // ARMS: a shoulder ball, the upper arm, a big shoulder plate with a light round its rim; the elbow ball, the forearm
      // and a bracer (a ring at the elbow, a display at the wrist); a gloved fist with a knuckle plate
      put(ball([0.18, 1.405, 0], AX, 0.064), 'LeftShoulder', SUIT);
      put(along([0, 1.41, 0], AX, 8, [[0.17, 0.05, 0.054, 0.05, 0.05], [0.30, 0.048, 0.05, 0.048, 0.046], [0.47, 0.04, 0.041, 0.04, 0.038]], NC), 'LeftArm', SUIT);
      part(6, () => {
      const paul = put(along([0, 1.41, 0], AX, 8, [[0.112, 0.055, 0.04, 0.055, 0.03, 0, 0.016], [0.155, 0.088, 0.068, 0.088, 0.056, 0, 0.016],
        [0.25, 0.096, 0.076, 0.096, 0.066, 0, 0.014], [0.312, 0.08, 0.063, 0.08, 0.06, 0, 0.011], [0.328, 0.05, 0.04, 0.05, 0.04, 0, 0.01]], { e: 0.9 }), 'LeftArm', { m: 1, crease: 30 });
      glow(paul, [2.3, 2.75], [0, 8], 'LeftArm');
      });
      put(ball([0.465, 1.41, 0], AX, 0.05), 'LeftForeArm', SUIT);
      put(along([0, 1.41, 0], AX, 6, [[0.46, 0.043, 0.043, 0.043, 0.042], [0.60, 0.042, 0.042, 0.042, 0.04], [0.735, 0.033, 0.032, 0.033, 0.03]], { ph: 0.5, a: false, b: false }), 'LeftForeArm', SUIT);
      part(6, () => {
      const brace = put(along([0, 1.41, 0], AX, 8, [[0.495, 0.05, 0.05, 0.05, 0.046], [0.528, 0.058, 0.06, 0.058, 0.052], [0.682, 0.053, 0.054, 0.053, 0.046], [0.716, 0.046, 0.046, 0.046, 0.04]],
        { ph: 0.5, e: 0.7 }), 'LeftForeArm', { m: 1, crease: 30 });
      // the elbow's node: a gem on the outside of the elbow (up in the T-pose, out when the arm hangs), glowing whole
      put(gem([0.476, 1.448, -0.01], [0, 1, -0.3], 0.028, 0.021, 6, 0.5), 'LeftForeArm', { m: 3, g: 1, crease: 10 });
      spot([0.476, 1.474, -0.017], 'LeftForeArm', 0.045, 0.55);
      glow(brace, [1.45, 1.92], [1.1, 1.9], 'LeftForeArm', { hw: 0.03, hi: 0.25 });
      // a circuit trace along the front of the bracer
      const bt = trace(brace, [[0.536, 7.35], [0.588, 7.35], [0.612, 7.95], [0.668, 7.95]], 0.02, 0.013);
      put(bt.tris, 'LeftForeArm', { m: 1, g: 1, crease: 10 }); spot(bt.end, 'LeftForeArm', 0.03, 0.3);
      // a smaller gloved fist (a plate), its knuckles lit across the back of the hand
      const fist = put(along([0, 1.41, 0], AX, 6, [[0.712, 0.029, 0.025, 0.029, 0.025, 0, -0.004], [0.738, 0.038, 0.032, 0.038, 0.035, 0, -0.007],
        [0.788, 0.037, 0.031, 0.037, 0.034, 0, -0.008], [0.802, 0.025, 0.02, 0.025, 0.023, 0, -0.008]], { e: 0.6, a: false }), 'LeftHand', { m: 1, crease: 40 });
      glow(fist, [rAt(fist, 0.752), 2.8], [0.88, 2.12], 'LeftHand', { hw: 0.03, hi: 0.42 });
      });
      for (const [k, bone] of [[1, 'LeftHand'], [-1, 'RightHand']]) pt(k > 0 ? 'lfist' : 'rfist', bone, [k * 0.757, 1.403, 0]);   // (the middle of the fist)

      // LEGS: the thigh with a plate on its front and outside (a light down the outside), the knee ball and a pointed knee
      // plate ringed with light, the shin with a ridged plate (a light down the ridge), a boot: its shaft on the shin (a
      // ring at the cuff), its foot and a thick sole (a light along each side, near the floor)
      let from = items.length;
      put(along([0.095, 0, 0], AY, 8, [[0.975, 0.082, 0.088, 0.07, 0.09, 0.005], [0.84, 0.082, 0.087, 0.073, 0.085, 0.004, 0.002], [0.52, 0.054, 0.056, 0.05, 0.054]], NC), 'LeftUpLeg', SUIT);
      part(7, () => {
      const thigh = put(along([0.095, 0, 0], AY, 8, [[0.95, 0.07, 0.068, 0.035, 0.04, 0.018, 0.02], [0.82, 0.08, 0.086, 0.045, 0.055, 0.014, 0.018],
        [0.635, 0.056, 0.062, 0.035, 0.04, 0.01, 0.012]], { e: 0.9, a: false, b: false }), 'LeftUpLeg', { m: 1, crease: 30 });
      glow(thigh, [0.3, 1.85], [-0.18, 0.18], 'LeftUpLeg');
      // a circuit trace down the front of the thigh, jogging out towards the side light
      const tt = trace(thigh, [[0.93, 1.75], [0.85, 1.75], [0.815, 1.3], [0.7, 1.3]], 0.021, 0.014);
      put(tt.tris, 'LeftUpLeg', { m: 1, g: 1, crease: 10 }); spot(tt.end, 'LeftUpLeg', 0.035, 0.3);
      });
      moved(from, onThigh); from = items.length;
      put(ball([0.095, 0.5, 0.004], AY, 0.062), 'LeftLeg', SUIT);
      part(7, () => {
      const knee = put(along([0.095, 0.502, 0], AZ, 6, [[0.0, 0.05, 0.06, 0.05, 0.055], [0.05, 0.055, 0.066, 0.055, 0.06], [0.074, 0.04, 0.05, 0.04, 0.045], [0.084, 0.018, 0.022, 0.018, 0.02]],
        { ph: 0.5, a: false }), 'LeftLeg', { m: 1, crease: 30 });
      glow(knee, [1.2, 1.75], [0, 6], 'LeftLeg');
      const calf = put(along([0.095, 0, 0], AY, 8, [[0.50, 0.054, 0.056, 0.05, 0.058], [0.38, 0.054, 0.054, 0.05, 0.068, 0, -0.004], [0.12, 0.038, 0.042, 0.036, 0.042]], NC), 'LeftLeg', SUIT);
      // a bold strip down the back of the calf, so the lower legs keep their colour from behind and far off
      glow(calf, [0.25, 1.62], [5.66, 6.34], 'LeftLeg', { m: 0, hw: 0.032, hi: 0.26 });
      const greave = put(along([0.095, 0, 0], AY, 8, [[0.455, 0.056, 0.058, 0.05, 0.03, 0.003, 0.016, 0.01], [0.41, 0.06, 0.066, 0.055, 0.035, 0.003, 0.016, 0.014],
        [0.27, 0.05, 0.058, 0.046, 0.03, 0.002, 0.014, 0.012], [0.215, 0.046, 0.052, 0.042, 0.028, 0.002, 0.012, 0.01]], { e: 0.9, kp: 6, a: false, b: false }), 'LeftLeg', { m: 1, crease: 30 });
      glow(greave, [0.3, 2.6], [1.6, 2.4], 'LeftLeg', { hw: 0.034 });
      const shaft = put(along([0.095, 0, 0], AY, 8, [[0.06, 0.05, 0.058, 0.048, 0.06], [0.2, 0.052, 0.058, 0.05, 0.058], [0.255, 0.058, 0.064, 0.056, 0.064]], { ph: 0.5, e: 0.8, a: false, b: false }), 'LeftLeg', { m: 1, crease: 30 });
      glow(shaft, [1.45, 1.8], [0, 8], 'LeftLeg');
      });
      moved(from, onShin); from = items.length;
      put(ball([0.095, 0.085, -0.004], AY, 0.055), 'LeftFoot', SUIT);
      put(along([0.095, 0, 0], AZ, 8, [[-0.078, 0.04, 0.04, 0.038, 0.032, 0, 0.075], [-0.05, 0.05, 0.068, 0.048, 0.045, 0, 0.075], [0.05, 0.056, 0.054, 0.052, 0.045, 0.004, 0.068],
        [0.135, 0.054, 0.032, 0.05, 0.036, 0.006, 0.048], [0.182, 0.032, 0.018, 0.03, 0.02, 0.006, 0.036]], { ph: 0.5, e: 0.75 }), 'LeftFoot', { m: 1, crease: 30 });
      part(8, () => {
      const sole = put(along([0.095, 0, 0], AZ, 6, [[-0.088, 0.046, 0.019, 0.044, 0.019, 0, 0.019], [-0.07, 0.06, 0.019, 0.058, 0.019, 0, 0.019], [0.14, 0.066, 0.019, 0.062, 0.019, 0.005, 0.019],
        [0.198, 0.042, 0.015, 0.038, 0.015, 0.006, 0.019]], { e: 0.45 }), 'LeftFoot', { m: 0, crease: 40 });
      glow(sole, [0.4, 2.6], [-0.28, 0.28], 'LeftFoot', { m: 0, hi: 0 });
      glow(sole, [0.4, 2.6], [2.72, 3.28], 'LeftFoot', { m: 0, hi: 0 });
      // (the halo's pool of light on the floor under the boot)
      items.push({ floor: [[0.095 - 0.15, 0, -0.19], [0.095 + 0.15, 0, -0.19], [0.095 + 0.15, 0, 0.32], [0.095 - 0.15, 0, 0.32]], bone: 'LeftFoot', i: 0.5, part: PART });
      });
      moved(from, onFoot);
      for (const [k, bone] of [[1, 'LeftFoot'], [-1, 'RightFoot']]) { const p = onFoot([0.095, 0, 0.055]); pt(k > 0 ? 'lboot' : 'rboot', bone, [k * p[0], p[1], p[2]]); }   // (under the sole's middle, on the floor)
    });

    // ---- the body's geometry: each piece's triangles turned outwards, normals shared within its crease angle, welded
    const VP = [], VN = [], VB = [], VG = [], VM = [], IX = [], vmap = new Map();
    const r5 = x => Math.round(x * 1e5), key = p => r5(p[0]) + ',' + r5(p[1]) + ',' + r5(p[2]);
    // (the part packed into aMat: material + PSTRIDE * part, the materials 0 to 3; the weld never mixes parts)
    function piece(tris, bone, o, pa) {
      if ((o.m || 0) >= PSTRIDE) throw new Error('bodies: a material past ' + (PSTRIDE - 1));
      const bi = BI[bone], g0 = o.g || 0, m = (o.m || 0) + PSTRIDE * (pa || 0), cr = Math.cos((o.crease == null ? 35 : o.crease) * Math.PI / 180), F = [];
      for (const t of tris) {
        let a = t[0], b = t[1], c = t[2], n = cross(sub(b, a), sub(c, a));
        const ar = len(n);
        if (ar < 1e-12) continue;
        if (dot(n, sub(mid([a, b, c]), t[3])) < 0) { const s = b; b = c; c = s; n = mul(n, -1); }
        F.push({ v: [a, b, c], n, u: mul(n, 1 / ar) });
      }
      const at = new Map();
      F.forEach((f, k) => f.v.forEach(p => { const q = key(p); if (!at.has(q)) at.set(q, []); at.get(q).push(k); }));
      F.forEach(f => f.v.forEach(p => {
        let n = [0, 0, 0];
        for (const h of at.get(key(p))) if (dot(F[h].u, f.u) >= cr) n = add(n, F[h].n);
        n = unit(n);
        const g = p.length > 3 ? p[3] : g0, k = key(p) + '|' + n.map(x => Math.round(x * 1e3)).join(',') + '|' + bi + '|' + g + '|' + m;
        let i = vmap.get(k);
        if (i == null) { i = VP.length / 3; vmap.set(k, i); VP.push(p[0], p[1], p[2]); VN.push(n[0], n[1], n[2]); VB.push(bi); VG.push(g); VM.push(m); }
        IX.push(i);
      }));
    }
    for (const it of items) if (it.tris) piece(it.tris, it.bone, it.o, it.part);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(VP, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(VN, 3));
    geometry.setAttribute('aBone', new T.Float32BufferAttribute(VB, 1));
    geometry.setAttribute('aGlow', new T.Float32BufferAttribute(VG, 1));
    geometry.setAttribute('aMat', new T.Float32BufferAttribute(VM, 1));
    geometry.setIndex(IX);

    // ---- the halo's geometry (the bloom the app has no pass for, only round the lights): soft camera-facing spots, in
    // chains along the lights and one at each node, gem, pod and pad, and a light on the floor under each boot. aKind 1 a
    // spot, 2 the floor (plus PSTRIDE times its part); aOff the corner (-1..1); aW a spot's radius; aI its strength
    const HP = [], HB = [], HO = [], HW = [], HI = [], HK = [], HX = [];
    const hv = (p, b, d, o, w, i, k, pa) => { k += PSTRIDE * (pa || 0); HP.push(p[0], p[1], p[2]); HB.push(b); HO.push(o[0], o[1]); HW.push(w); HI.push(i); HK.push(k); return HP.length / 3 - 1; };
    for (const it of items) {
      const b = BI[it.bone];
      if (it.line) {
        // (a light's glow: soft spots every 0.6 of their size along it, overlapping into a line; spots cannot twist or
        // spike where a light turns towards the eye, as camera-facing strips do)
        const P = it.line, n = P.length, step = it.w * 0.6, pts = [];
        for (let k = 0; k < (it.closed ? n : n - 1); k++) { const a = P[k], c = P[(k + 1) % n], m = Math.max(1, Math.ceil(len(sub(c, a)) / step)); for (let j = 0; j < m; j++) pts.push(lerp(a, c, j / m)); }
        if (!it.closed) pts.push(P[n - 1]);
        for (const p of pts) { const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(o => hv(p, b, [0, 0, 0], o, it.w, it.i * 0.6, 1, it.part)); HX.push(c[0], c[1], c[2], c[0], c[2], c[3]); }
      } else if (it.spot) {
        const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(o => hv(it.spot, b, [0, 0, 0], o, it.w, it.i, 1, it.part));
        HX.push(c[0], c[1], c[2], c[0], c[2], c[3]);
      } else if (it.floor) {
        const c = it.floor.map((p, k) => hv(p, b, [0, 0, 0], [[-1, -1], [1, -1], [1, 1], [-1, 1]][k], 0, it.i, 2, it.part));
        HX.push(c[0], c[2], c[1], c[0], c[3], c[2]);
      }
    }
    const hg = new T.BufferGeometry();
    hg.setAttribute('position', new T.Float32BufferAttribute(HP, 3));
    hg.setAttribute('aBone', new T.Float32BufferAttribute(HB, 1));
    hg.setAttribute('aOff', new T.Float32BufferAttribute(HO, 2));
    hg.setAttribute('aW', new T.Float32BufferAttribute(HW, 1));
    hg.setAttribute('aI', new T.Float32BufferAttribute(HI, 1));
    hg.setAttribute('aKind', new T.Float32BufferAttribute(HK, 1));
    hg.setIndex(HX);
    return { bones, BI, at: SK.map(b => [b[2], b[3], b[4]]), pts: PTS, geometry, halo: hg, tris: IX.length / 3, haloTris: HX.length / 3 };
  }

  // ---------------------------------------------------------------------------------------------- the shaders
  // Every body in one draw: the mannequin's geometry instanced, a person an instance. Each person's bones are solved on
  // their own skeleton (never drawn) and written into a float texture, a row a person, three texels a bone (the rows of
  // its matrix: the room's frame and the bind pose folded in), so the TRANSFORM block reads its vertex's bone there; the
  // SHADING and HALO blocks are the design's own, unchanged (their uniforms per person here: an instance's colour, scan
  // phase, self flag and floor)
  const BONES = `
uniform sampler2D uBones;
uniform vec2 uSize;
mat4 boneOf(float row, float b) {
  float y = (row + 0.5) / uSize.y, x = b * 3.0;
  vec4 r0 = texture2D(uBones, vec2((x + 0.5) / uSize.x, y));
  vec4 r1 = texture2D(uBones, vec2((x + 1.5) / uSize.x, y));
  vec4 r2 = texture2D(uBones, vec2((x + 2.5) / uSize.x, y));
  return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}
// (the row's last texel: a story's look for the figure, [hide, dark, power, flash]: bit masks over the parts, the
// lights' strength, a part's flash as part + amount; people's [0, 0, 1, 0]. Bits without integer maths, for WebGL1)
vec4 lookOf(float row) { return texture2D(uBones, vec2((uSize.x - 0.5) / uSize.x, (row + 0.5) / uSize.y)); }
float bitOf(float m, float p) { return mod(floor(m / exp2(p)), 2.0); }
float flashOf(vec4 S, float part) { float fp = floor(S.w); return fp > 0.5 && abs(part - fp) < 0.5 ? S.w - fp : 0.0; }`;
  // (aInst: the person's row, their scan's phase, 1 for your own body, the floor's height in the world; aCol their colour)
  const VERT = `
attribute float aBone;
attribute float aGlow;
attribute float aMat;
attribute vec4 aInst;
attribute vec3 aCol;
varying vec3 vNrm;
varying vec3 vPos;
varying vec3 vObj;
varying float vGlow;
varying float vMat;
varying vec3 vCol;
varying vec2 vPS;
varying vec3 vSet;
${BONES}
void main() {
  // (aMat: the material plus 4 times the part; the figure's look: its lights on and power, flash)
  float part = floor(aMat / 4.0);
  vec4 S = lookOf(aInst.x);
  vSet = vec3((1.0 - bitOf(S.y, part)) * S.z, S.z, flashOf(S, part));
  // ==== TRANSFORM (the app's: the bone's matrix from the bones' texture; the mesh hangs in the world's frame) ====
  mat4 bm = boneOf(aInst.x, aBone);
  vec4 mv = modelViewMatrix * (bm * vec4(position, 1.0));
  vec3 nv = normalize(normalMatrix * (bm * vec4(normal, 0.0)).xyz);
  gl_Position = projectionMatrix * mv;
  // ==== END TRANSFORM ====
  // ==== SHADING, vertex part: the view-space normal and place, the bind-pose place, glow and material ====
  vNrm = nv; vPos = mv.xyz; vObj = position; vGlow = aGlow; vMat = aMat - 4.0 * part;
  // ==== END SHADING ====
  vCol = aCol; vPS = aInst.yz;
  if (bitOf(S.x, part) > 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);   // (a hidden part: behind the far plane)
}`;
  const FRAG = `
uniform float uTime;
varying vec3 vNrm;
varying vec3 vPos;
varying vec3 vObj;
varying float vGlow;
varying float vMat;
varying vec3 vCol;
varying vec2 vPS;
varying vec3 vSet;
#define uColor vCol
#define uPhase vPS.x
#define uSelf vPS.y
// ==== SHADING ====
// Self-lit (scene lights ignored): a key light fixed to the viewer (above their left shoulder), the sky from world up, a
// sheen on the plates, a rim in the person's colour. The plates and the undersuit take the person's colour (a deep shade
// of a strong colour, pearl for a pale one); the visor is dark glass mirroring a streak of sky round a white-hot core;
// the lights glow in the colour (pushed towards white only as far as the colour is strong, so pale colours keep their
// hue), breathing slowly up the body; every 5 s a scan climbs the body, its sharp leading line running over the lights
// and the rims only; the gems glow whole, white at the heart
void main() {
  vec3 n = normalize(vNrm), v = normalize(-vPos);
  vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec3 L = normalize(vec3(-0.45, 0.7, 0.55));
  float ndv = clamp(dot(n, v), 0.0, 1.0), fr = pow(1.0 - ndv, 2.5);
  float hemi = 0.5 + 0.5 * dot(n, up), dif = max(dot(n, L), 0.0), sp = pow(max(dot(n, normalize(L + v)), 0.0), 28.0);
  float plate = step(0.5, vMat) * step(vMat, 1.5), glass = step(1.5, vMat) * step(vMat, 2.5), gem = step(2.5, vMat);
  vec3 col = uColor, W = vec3(1.0);
  float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  vec3 hot = mix(col, W, 0.3 * smoothstep(0.3, 0.8, sat));
  // the scan (by the height at rest, so it rides with the limbs): a soft band trailing a sharp line, once every 5 s
  float d = fract(uTime / 5.0 + uPhase) * 1.4 - 0.2 - vObj.y / 1.75;
  float band = d > 0.0 ? exp(-d / 0.05) : 0.0, edge = exp(-d * d / 0.00004);
  float pulse = 0.9 + 0.1 * sin(uTime * 2.2 - vObj.y * 4.0);
  // the undersuit and the plates
  vec3 alb = mix(mix(vec3(0.028, 0.03, 0.04), col * 0.12, 0.45), mix(vec3(0.088, 0.095, 0.11), col * 0.27, 0.45), plate) * mix(0.45, 1.0, vSet.y);
  vec3 c = alb * (0.26 + 0.6 * hemi) + alb * dif * 1.25 + sp * mix(0.06, 0.32, plate) * mix(vec3(0.88, 0.93, 1.0), col, 0.6);
  c += col * fr * mix(0.55, 0.32, plate) * (1.0 - 0.65 * uSelf) * (1.0 + 1.5 * band + 2.5 * edge) * mix(0.25, 1.0, vSet.y);
  // the visor's glass
  vec3 r = reflect(-v, n);
  float hz = dot(r, up);
  vec3 g = vec3(0.008, 0.01, 0.018) + col * 0.07 * smoothstep(0.1, -0.4, hz) + col * 0.3 * fr + sp * 0.5
    + vec3(0.5, 0.56, 0.66) * exp(-pow((hz - 0.1) / 0.1, 2.0)) * (0.35 + 0.65 * fr);
  c = mix(c, g, glass);
  // the lights (aGlow), the visor's core, the gems
  // (the story's look, HOST.bodies.set: k and the gems times the part's lights on and the power; a flash towards white)
  float k = clamp(vGlow, 0.0, 1.0) * vSet.x;
  c = mix(c, hot * pulse * (1.0 + 0.3 * band) + (W - hot) * edge * 0.7, k * (1.0 - glass) * (1.0 - gem));
  c += (hot + (W - hot) * smoothstep(0.75, 1.0, k) * 0.6) * pow(k, 2.5) * pulse * glass;
  c = mix(c, hot * (0.7 + 0.45 * ndv) + (W - hot) * (pow(ndv, 3.0) * 0.55 + edge * 0.5), gem * vSet.x);
  c = mix(c, W, 0.6 * vSet.z * max(clamp(vGlow, 0.0, 1.0), gem));
  gl_FragColor = vec4(c, 1.0);
}
// ==== END SHADING ====`;
  const HVERT = `
attribute float aBone;
attribute vec2 aOff;
attribute float aW;
attribute float aI;
attribute float aKind;
attribute vec4 aInst;
attribute vec3 aCol;
varying vec2 vOff;
varying float vI;
varying float vKind;
varying vec3 vCol;
varying float vFl;
#define uFloor aInst.w
#define uSelf aInst.z
${BONES}
void main() {
  // (aKind: the kind plus 4 times the part; the figure's look)
  float part = floor(aKind / 4.0), kind = aKind - 4.0 * part;
  vec4 S = lookOf(aInst.x);
  // ==== TRANSFORM (the app's): the world place ====
  mat4 bm = boneOf(aInst.x, aBone);
  vec4 wp = modelMatrix * (bm * vec4(position, 1.0));
  // ==== END TRANSFORM ====
  // ==== HALO: a spot spread across the screen round its middle, or a floor light flattened onto the floor ====
  float I = aI;
  if (kind > 1.5) { I *= clamp(1.0 - (wp.y - uFloor) * 6.0, 0.0, 1.0); wp.y = uFloor + 0.004; }
  vec4 mv = viewMatrix * wp;
  if (kind < 1.5) {
    // (never wider than about 3 degrees, fainter near the eye: your own arms are not smeared across the view; pulled
    // towards the eye so the body does not swallow it)
    float dist = max(-mv.z, 0.05);
    mv.xy += aOff * min(aW, dist * 0.055);
    I *= mix(0.3, 1.0, smoothstep(0.3, 1.2, dist));
    mv.xyz += normalize(-mv.xyz) * min(0.03, dist * 0.3);
  }
  gl_Position = projectionMatrix * mv;
  vOff = aOff; vI = I * (1.0 - 0.55 * uSelf); vKind = kind;
  // ==== END HALO ====
  vCol = aCol; vI *= (1.0 - bitOf(S.y, part)) * S.z; vFl = flashOf(S, part);
  // (a bone folded away, your own head and neck: its spots go too, not gathered under your eyes; a hidden part)
  if (dot(bm[0].xyz, bm[0].xyz) < 1e-6 || bitOf(S.x, part) > 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}`;
  const HFRAG = `
uniform float uTime;
varying vec2 vOff;
varying float vI;
varying float vKind;
varying vec3 vCol;
varying float vFl;
#define uColor vCol
// ==== HALO ====
void main() {
  float r = length(vOff);
  float a = vKind < 1.5 ? pow(max(1.0 - r, 0.0), 1.7) : (1.0 - smoothstep(0.7, 1.0, r)) * (0.35 + 0.65 * (1.0 - r));
  gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.6 * vFl) * a * vI * (1.0 + vFl) * (0.92 + 0.08 * sin(uTime * 2.2)), 1.0);
}
// ==== END HALO ====`;

  // ---------------------------------------------------------------------------------------------- the draw
  // Made the first time a body is drawn (the mannequin, its two base geometries and the calibration, shared; the people's
  // draw set: about 1 MB); then nothing is made a frame. A draw set (the people's, W.def, and a story's own, set()): its
  // bones' texture (70 x cap floats of four: 23 bones of three texels, then the figure's look, a row a figure, sent whole
  // each frame a body shows: 54 KB for the people's 49), its instance attributes, its two materials (the same sources,
  // so the programs are linked once) and two instanced wrappers over the shared geometries' attributes
  const W = { M: null, IK: null, def: null, t0: 0, cal0: null, eye0: 1.62, arm: 0.545, why: '', free: [] };
  const NB = 23, TW = NB * 3 + 1;
  function newSet(cap, name) {
    const M = W.M, S = { cap, n: 0, calls: { body: 0, halo: 0 }, dead: false };
    S.data = new Float32Array(TW * cap * 4);
    const tex = S.tex = new T.DataTexture(S.data, TW, cap, T.RGBAFormat, T.FloatType);
    tex.magFilter = tex.minFilter = T.NearestFilter; tex.generateMipmaps = false; tex.flipY = false; tex.needsUpdate = true;
    S.uni = { uBones: { value: tex }, uSize: { value: new T.Vector2(TW, cap) }, uTime: { value: 0 } };
    // (a disposed set's wrappers and instance attributes taken again: they are never disposed, since disposing a wrapper
    // would free the shared geometries' buffers too)
    const k = W.free.findIndex(f => f.cap === cap), f = k >= 0 ? W.free.splice(k, 1)[0] : null;
    if (f) Object.assign(S, { inst: f.inst, col: f.col, geo: f.geo });
    else {
      S.inst = new T.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(T.DynamicDrawUsage);
      S.col = new T.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(T.DynamicDrawUsage);
      const inst = g => {
        const ig = new T.InstancedBufferGeometry();
        for (const a of Object.keys(g.attributes)) ig.setAttribute(a, g.attributes[a]);
        ig.setIndex(g.index);
        ig.setAttribute('aInst', S.inst); ig.setAttribute('aCol', S.col);
        return ig;
      };
      S.geo = [inst(M.geometry), inst(M.halo)];
    }
    S.geo[0].instanceCount = S.geo[1].instanceCount = 0;
    S.body = new T.Mesh(S.geo[0], new T.ShaderMaterial({ uniforms: S.uni, vertexShader: VERT, fragmentShader: FRAG }));
    // (additive light that leaves the layer's alpha alone, as the ships' ADD, v134; the owner, 24 November 2026: "they are
    // not see-through. They have like a black ... it's like a billboard around it"): HFRAG writes alpha 1, which
    // AdditiveBlending also added, so each spot's whole square went opaque over the passthrough, black where its light
    // fades. Colour added (One, One; HFRAG's colour already carries its fall-off), alpha kept (Zero, One); in VR as before
    S.halo = new T.Mesh(S.geo[1], new T.ShaderMaterial({ uniforms: S.uni, vertexShader: HVERT, fragmentShader: HFRAG,
      transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.CustomBlending, blendEquation: T.AddEquation,
      blendSrc: T.OneFactor, blendDst: T.OneFactor, blendEquationAlpha: T.AddEquation, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor }));
    S.body.name = name; S.halo.name = name + ' halo';
    for (const m of [S.body, S.halo]) { m.frustumCulled = false; m.visible = false; m.matrixAutoUpdate = false; }
    S.halo.renderOrder = 2;
    S.body.onBeforeRender = () => { S.calls.body++; };
    S.halo.onBeforeRender = () => { S.calls.halo++; };
    return S;
  }
  function make() {
    if (W.def) return true;
    if (typeof makeIK !== 'function') { W.why = 'ik.js is not loaded'; return false; }
    W.IK = makeIK(T);
    if (!W.M) W.M = mannequin();
    // the calibration at the mannequin's own size, made once on a figure of it (pose.js's T-pose: no step for it)
    const f = figure();
    if (!f.rig.ok) { W.why = f.rig.why; return false; }
    const R0 = new T.Vector3(), e = W.IK.restPose(f.rig, 'eye').p, tg = { hmd: { p: [e.x, e.y, e.z + AHEAD], q: EYE_Q.toArray() } };
    W.eye0 = e.y - R0.y;
    for (const s of ['l', 'r']) {
      const w = W.IK.restPose(f.rig, s + 'hand').p;
      tg[s] = { p: [w.x + FIST[0] * (s === 'l' ? 1 : -1), w.y + FIST[1], w.z + FIST[2]], q: GRIP_Q[s].toArray() };
    }
    W.arm = W.IK.restPose(f.rig, 'lhand').p.distanceTo(W.IK.restPose(f.rig, 'larm').p);
    const cal = W.IK.calibrate(f.rig, tg, MAP, 'head', { floor: 0, scale: false });
    if (!cal.ok) { W.why = cal.why; return false; }
    W.cal0 = cal;
    W.def = newSet(CAP, 'bodies');
    return true;
  }
  // (a new figure: the mannequin's bones under a root at the origin, at rest)
  function figure() {
    const M = W.M, root = new T.Group(), bs = M.bones.map(b => { const o = new T.Bone(); o.name = b.name; o.position.fromArray(b.p); return o; });
    M.bones.forEach((b, i) => { if (b.parent) bs[M.BI[b.parent.replace('mixamorig', '')]].add(bs[i]); });
    root.add(bs[0]); root.updateMatrixWorld(true);
    return { root, bs, rig: W.IK.rigOf(root) };
  }

  // ---------------------------------------------------------------------------------------------- the poser
  // Posed from a headset and two controllers by ik.js's 'head' setup, calibrated from the mannequin's own T-pose: the
  // headset at its eyes and ahead of them by AHEAD (ik.js's eye point is in the middle of the head, a person's eyes some
  // 8 cm in front of it), the grips where a person holding Quest controllers in a T-pose has them (WebXR's grip space: the
  // origin in the middle of the curled fingers, -z along a rod held in the fist towards the thumb, +x out of the back of
  // the right hand and out of the palm of the left, +y back up the arm), the middle of the fist FIST from the wrist. A
  // person's size follows their standing eye height, so sitting or crouching bends the legs instead of shrinking them
  const V = (x, y, z) => new T.Vector3(x || 0, y || 0, z || 0), UP = V(0, 1, 0);
  const basis = (x, y, z) => new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  const MAP = { head: 'hmd', lhand: 'l', rhand: 'r' };
  const GRIP_Q = { l: basis(V(0, -1, 0), V(-1, 0, 0), V(0, 0, -1)), r: basis(V(0, 1, 0), V(1, 0, 0), V(0, 0, -1)) };   // (a T-pose, palms down)
  const HANG_Q = basis(V(-1, 0, 0), V(0, 1, 0), V(0, 0, -1));   // (hanging: the backs of the hands out, the thumbs forward)
  const EYE_Q = new T.Quaternion().setFromAxisAngle(UP, Math.PI);   // (a headset looking along +z: its own -z)
  const FIST = [0.055, -0.015, 0], AHEAD = 0.08;
  // the standing eye height: a high percentile (EYE.p) of the head's height over the floor, sampled every EYE.dt s over
  // the last EYE.n samples (30 s), clamped; EYE.h0 until EYE.min samples are in. The size eases to it (EYE.tau s)
  const EYE = { dt: 0.5, n: 60, p: 0.9, min: 6, h0: 1.6, lo: 1.0, hi: 2.05, tau: 1 };
  // (a jump: the head more than JUMP.m from where it was a frame before, or faster than JUMP.v m/s over more than JUMP.min m:
  // a person's presence is drawn between its samples, so a leap shows as a few frames' rush; nobody walks at 6 m/s, the sticks
  // move you at 1.5)
  const JUMP = { m: 1, v: 6, min: 0.15 };
  const SORT = new Float32Array(EYE.n);
  // (a steady number from an id, 0 to 1: each person's scan out of step with the others')
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  function person(id) {
    if (!make()) return null;
    const f = figure(), B = { id: String(id || ''), root: f.root, rig: f.rig, bs: f.bs, neck: f.rig.bones.neck, cal: JSON.parse(JSON.stringify(W.cal0)),
      k: 1, st: {}, phase: hash(String(id || '')), drawn: false,
      tg: { hmd: { p: [0, 0, 0], q: [0, 0, 0, 1] }, l: { p: [0, 0, 0], q: [0, 0, 0, 1] }, r: { p: [0, 0, 0], q: [0, 0, 0, 1] } },
      H: [0, 1].map(() => ({ w: 0, has: false, last: { p: [0, 0, 0], q: [0, 0, 0, 1] }, sh: V(), shOK: false })),
      eye: { ring: new Float32Array(EYE.n), n: 0, i: 0, at: EYE.dt, want: EYE.h0, ease: 0, now: 0 }, hp: V(), hpOK: false };
    return B;
  }
  // the size for an eye height h: the calibration's offsets and the figure scaled (ik.js's calibrate gives the same for
  // a T-pose at that height, but makes objects)
  function sizeTo(B, h) {
    const k = h / W.eye0, c0 = W.cal0.cal;
    B.k = k; B.cal.s = k; B.eye.now = h;
    for (const sl in c0) for (let j = 0; j < 3; j++) B.cal.cal[sl][j] = c0[sl][j] * k;
    B.root.scale.setScalar(k); B.root.updateMatrixWorld(true);
  }
  function eyeStep(B, y, dt) {
    const E = B.eye;
    E.at += dt;
    if (E.at >= EYE.dt) {
      E.at = 0; E.ring[E.i] = y; E.i = (E.i + 1) % EYE.n; E.n = Math.min(EYE.n, E.n + 1);
      if (E.n >= EYE.min) {
        SORT.fill(-Infinity); SORT.set(E.ring); if (E.n < EYE.n) SORT.fill(-Infinity, E.n);
        SORT.sort();
        E.want = Math.min(EYE.hi, Math.max(EYE.lo, SORT[EYE.n - E.n + Math.floor(EYE.p * (E.n - 1))]));
      }
    }
    E.ease = E.ease ? E.ease + (E.want - E.ease) * (dt > 0 ? 1 - Math.exp(-dt / EYE.tau) : 1) : E.want;   // (eased; the figure resized once it has moved 2 mm)
    if (!E.now || Math.abs(E.ease - E.now) > 0.002) sizeTo(B, E.ease);
  }
  // a relaxed hanging grip: below the shoulder (last frame's, else worked out from the head), a little out and forward,
  // turned with the hips' heading (the solver's) or else the head's
  const _v = V(), _w = V(), _q = new T.Quaternion(), _r = new T.Quaternion(), _y = new T.Quaternion(), _m = new T.Matrix4(), _s = V();
  const HANG = { p: [0, 0, 0], q: [0, 0, 0, 1] }, FROM = { p: [0, 0, 0], q: [0, 0, 0, 1] };
  function hang(B, i, head, out) {
    const sg = i ? -1 : 1, sc = B.k, H = B.H[i];
    let yaw;
    if (Number.isFinite(B.st.yaw)) yaw = B.st.yaw;
    else { _v.set(0, 0, -1).applyQuaternion(_q.fromArray(head, 3)); yaw = Math.atan2(_v.x, _v.z); }
    _y.setFromAxisAngle(UP, yaw);
    if (H.shOK) _w.copy(H.sh);
    else _w.set(sg * 0.18, -0.21, -0.03).multiplyScalar(sc).applyQuaternion(_y).add(_v.fromArray(head));
    _v.set(sg * 0.035, -(W.arm * 0.94 + 0.05), 0.04).multiplyScalar(sc).applyQuaternion(_y).add(_w);
    _v.toArray(out.p); _q.copy(_y).multiply(HANG_Q).toArray(out.q);
    return out;
  }
  // a hand from its ray where no grip came (an older app): the grip a little behind the ray's start, its -z along the
  // ray, +x to the person's right (out of the back of a right hand holding a controller, out of a left one's palm)
  function fromRay(R, out) {
    _v.copy(R.d).normalize();
    _w.crossVectors(_v, UP);
    if (_w.lengthSq() < 1e-6) _w.set(1, 0, 0);
    _w.normalize();
    _s.crossVectors(_v, _w).negate();   // (y = z x x, with z = -d)
    _m.makeBasis(_w, _s.normalize(), _v.negate());
    _q.setFromRotationMatrix(_m).toArray(out.q);
    _v.copy(R.d).normalize().multiplyScalar(-0.06).add(R.o).toArray(out.p);
    return out;
  }
  const valid = a => !!a && a.length === 7 && a[0] === a[0] && a[1] === a[1] && a[2] === a[2];
  const clamp01 = x => Math.max(0, Math.min(1, x));
  // one figure this frame, into a draw set: its skeleton posed (its hands eased over I.ease s, 0.2 for people, between
  // held and hanging), its bones and its look written into the set's next row. False when nothing is drawn (no room left,
  // no calibration). I.warm: solved only (the solver's state moves on; no row, never counted against the cap)
  function addTo(S, B, I) {
    if (!B || !S || S.dead || !valid(I.head)) return false;
    const only = !!I.warm;
    if (!only && S.n >= S.cap) return false;
    const dt = I.dt > 0 ? Math.min(I.dt, 0.25) : 0, head = I.head, hp = _v.fromArray(head), ease = I.ease == null || !(I.ease >= 0) ? 0.2 : +I.ease;
    // (a jump: a change of station, coming back into view, a head leaping or rushing (JUMP): the feet planted
    // again under it, the hands where they are)
    const moved = B.hpOK ? hp.distanceTo(B.hp) : 0, jump = !!I.jump || moved > JUMP.m || (dt > 0 && moved > JUMP.min && moved / dt > JUMP.v);
    B.hp.copy(hp); B.hpOK = true;
    if (jump) { B.st = {}; for (const H of B.H) H.shOK = false; }
    if (!B.fixed) eyeStep(B, head[1] - I.floor, dt);
    B.cal.floor = I.floor;
    const tg = B.tg;
    for (let k = 0; k < 7; k++) (k < 3 ? tg.hmd.p : tg.hmd.q)[k < 3 ? k : k - 3] = head[k];
    for (let i = 0; i < 2; i++) {
      const H = B.H[i], g = I.g && valid(I.g[i]) ? I.g[i] : null, R = !g && I.ray && I.ray[i], to = i ? tg.r : tg.l;
      if (g) { for (let k = 0; k < 3; k++) H.last.p[k] = g[k]; for (let k = 0; k < 4; k++) H.last.q[k] = g[k + 3]; }
      else if (R) fromRay(R, H.last);
      const want = g || R ? 1 : 0;
      H.has = H.has || !!want;
      H.w = dt && !jump && ease > 0 ? H.w + (want - H.w) * (1 - Math.exp(-dt / ease)) : want;
      hang(B, i, head, HANG);
      if (H.has && H.w > 0.998) { to.p[0] = H.last.p[0]; to.p[1] = H.last.p[1]; to.p[2] = H.last.p[2]; for (let k = 0; k < 4; k++) to.q[k] = H.last.q[k]; }
      else if (H.has && H.w > 0.002) {
        _v.fromArray(HANG.p).lerp(_w.fromArray(H.last.p), H.w).toArray(to.p);
        _q.fromArray(HANG.q).slerp(_r.fromArray(H.last.q), H.w).toArray(to.q);
      } else { to.p[0] = HANG.p[0]; to.p[1] = HANG.p[1]; to.p[2] = HANG.p[2]; for (let k = 0; k < 4; k++) to.q[k] = HANG.q[k]; }
    }
    const r = W.IK.solve(B.rig, B.cal, tg, dt, B.st);
    if (!r.ok) { W.why = r.why; return false; }
    for (let i = 0; i < 2; i++) { B.rig.bones[i ? 'rarm' : 'larm'].getWorldPosition(B.H[i].sh); B.H[i].shOK = true; }
    if (I.self && B.neck) { B.neck.scale.setScalar(1e-4); B.neck.updateMatrixWorld(true); }   // (your own: the head and neck folded away)
    if (only) return true;
    // its bones into its row: the frame's matrix, the bone's, then back from the bind pose (every bone's rest turn the
    // identity, so the bind pose is a translation by the bone's place at rest)
    const row = S.n, d = S.data, AT = W.M.at;
    for (let b = 0; b < NB; b++) {
      const e = I.toWorld ? _m.multiplyMatrices(I.toWorld, B.bs[b].matrixWorld).elements : B.bs[b].matrixWorld.elements, a = AT[b], o = (row * TW + b * 3) * 4;
      d[o] = e[0]; d[o + 1] = e[4]; d[o + 2] = e[8]; d[o + 3] = e[12] - (e[0] * a[0] + e[4] * a[1] + e[8] * a[2]);
      d[o + 4] = e[1]; d[o + 5] = e[5]; d[o + 6] = e[9]; d[o + 7] = e[13] - (e[1] * a[0] + e[5] * a[1] + e[9] * a[2]);
      d[o + 8] = e[2]; d[o + 9] = e[6]; d[o + 10] = e[10]; d[o + 11] = e[14] - (e[2] * a[0] + e[6] * a[1] + e[10] * a[2]);
    }
    // its look, the row's last texel: [hide, dark, power, flash] (people give none: [0, 0, 1, 0], today's look)
    const o = (row * TW + NB * 3) * 4, F = I.flash, fp = F ? Math.round(+F[0]) : 0, fa = F ? Math.min(0.99, clamp01(+F[1] || 0)) : 0;
    d[o] = (+I.hide || 0) & 511; d[o + 1] = (+I.dark || 0) & 511; d[o + 2] = I.power == null ? 1 : clamp01(+I.power || 0);
    d[o + 3] = fp >= 1 && fp <= 8 && fa > 0 ? fp + fa : 0;   // (part 0, the body, has no lights of its own: never flashed)
    // its colour, scan phase, self flag and its floor in the world (where the boots' pools of light lie)
    let fy = I.floor;
    if (I.toWorld) fy = _w.set(head[0], I.floor, head[2]).applyMatrix4(I.toWorld).y;
    const ia = S.inst.array, j = row * 4;
    ia[j] = row; ia[j + 1] = B.phase; ia[j + 2] = I.self ? 1 : 0; ia[j + 3] = fy;
    S.col.array[row * 3] = I.rgb[0]; S.col.array[row * 3 + 1] = I.rgb[1]; S.col.array[row * 3 + 2] = I.rgb[2];
    S.n++; B.drawn = true;
    return true;
  }
  function beginOf(S, t) {
    S.n = 0;
    S.uni.uTime.value = (t / 1000) % 3600;   // (wrapped: float precision; a jump once an hour)
  }
  function endOf(S) {
    if (S.dead) return;
    const n = S.n;
    S.body.visible = S.halo.visible = n > 0;
    S.body.geometry.instanceCount = S.halo.geometry.instanceCount = n;
    if (!n) return;
    S.tex.needsUpdate = true;
    for (const a of [S.inst, S.col]) { a.updateRange.offset = 0; a.updateRange.count = n * a.itemSize; a.needsUpdate = true; }
  }
  function attachTo(S, parent) {
    if (!parent || S.dead) return false;
    for (const m of [S.body, S.halo]) if (m.parent !== parent) parent.add(m);
    return true;
  }
  const statsOf = S => ({ ok: !!S && !S.dead, why: W.why, n: S ? S.n : 0, cap: S ? S.cap : CAP, calls: Object.assign({}, S ? S.calls : { body: 0, halo: 0 }), visible: !!(S && S.body.visible),
    tris: W.M ? W.M.tris : 0, haloTris: W.M ? W.M.haloTris : 0, parent: S && S.body.parent ? S.body.parent.name || 'yes' : '' });
  // the people's set (shared.js: the overlay, only in a session)
  function begin(t) { if (W.def) beginOf(W.def, t || performance.now()); }
  const add = (B, I) => !!W.def && addTo(W.def, B, I);
  function end() { if (W.def) endOf(W.def); }
  function attach(parent) { return !!parent && make() && attachTo(W.def, parent); }
  // a story's own set (v173, the tutorial's guide): cap 1 to 8 figures in one draw (and their glows in one more), hung
  // where the story says, on a page too; begin(t) its own clock (ms: the story's time, so its scan halts when the story
  // pauses). dispose() takes its meshes down and frees its texture and materials, never the geometries (shared with
  // every other set): a story that disposes what is in its scene calls it first
  function set(cap) {
    if (!make()) return null;
    const S = newSet(Math.max(1, Math.min(8, Math.round(+cap) || 2)), 'bodies (story)');
    return { cap: S.cap, attach: p => attachTo(S, p), begin: t => { if (!S.dead) beginOf(S, t == null ? performance.now() : +t || 0); }, add: (B, I) => addTo(S, B, I), end: () => endOf(S),
      stats: () => statsOf(S), meshes: () => ({ body: S.dead ? null : S.body, halo: S.dead ? null : S.halo }),
      dispose() {
        if (S.dead) return;
        S.dead = true;
        for (const m of [S.body, S.halo]) { if (m.parent) m.parent.remove(m); m.material.dispose(); m.visible = false; }
        S.tex.dispose();
        W.free.push({ cap: S.cap, inst: S.inst, col: S.col, geo: S.geo });
      } };
  }
  // the two programs linked before the first body shows (a headset links each in 10 to 100 ms, a hitch): compiled once,
  // on a scene of their own, as shared.js's peopleWarm does the overlay's (a story's set uses the same programs)
  function warm(r) {
    if (!r || !make() || W.warmed === r) return;
    W.warmed = r;
    const D = W.def, sc = new T.Scene(), was = [D.body.parent, D.halo.parent];
    for (const m of [D.body, D.halo]) { m.visible = true; sc.add(m); }
    try { r.compile(sc, new T.PerspectiveCamera()); } finally {
      for (const m of [D.body, D.halo]) { sc.remove(m); m.visible = false; }
      if (was[0]) was[0].add(D.body);
      if (was[1]) was[1].add(D.halo);
    }
  }
  // ---- for a story's figures (v173)
  // a fixed size (eye height in m; 1.62 is the mannequin's own, 1.75 m tall): never sampled or eased again, so a crouch
  // bends the legs and never shrinks it
  function size(B, eye) {
    if (!B || !B.eye || !(eye > 0)) return false;
    sizeTo(B, eye); B.fixed = true; B.eye.ease = B.eye.want = eye;
    return true;
  }
  // the grip pose ([x, y, z, qx, qy, qz, qw]) that puts a hand's wrist at wrist ([x, y, z]) with its forearm along aim:
  // the T-pose's grip turned from the T-pose arm (+x left, -x right) to aim, palms down for a level aim; side 'l' or 'r'
  // (0 or 1); k the figure's size (B.k, 1 at its own size)
  const _ga = V(), _gd = V(), _gq = new T.Quaternion();
  function grip(side, wrist, aim, out, k) {
    const s = side === 'r' || side === 1 || side === 'right' ? 'r' : 'l', sg = s === 'l' ? 1 : -1, sc = k > 0 ? k : 1;
    out = out || [0, 0, 0, 0, 0, 0, 1];
    _ga.fromArray(aim);
    if (!(_ga.lengthSq() > 1e-12)) _ga.set(sg, 0, 0);
    _gq.setFromUnitVectors(_gd.set(sg, 0, 0), _ga.normalize());
    _gd.set(FIST[0] * sg, FIST[1], FIST[2]).multiplyScalar(sc).applyQuaternion(_gq);
    out[0] = wrist[0] + _gd.x; out[1] = wrist[1] + _gd.y; out[2] = wrist[2] + _gd.z;
    _gq.multiply(GRIP_Q[s]);
    out[3] = _gq.x; out[4] = _gq.y; out[5] = _gq.z; out[6] = _gq.w;
    return out;
  }
  // a named rest point's place in the world after the figure's last add (its toWorld again in I, or none): emblem0 (the
  // hub) to emblem3, spine0 (top) to spine4, visor, chest (inside it), lfist, rfist, lboot, rboot (on the floor). Into
  // out (an array or a Vector3), else a new array; null for an unknown name
  const _pp = V();
  function point(B, name, I, out) {
    const P = W.M && W.M.pts[name];
    if (!B || !B.bs || !P) return null;
    const bi = W.M.BI[P[0]], a = W.M.at[bi];
    _pp.set(P[1] - a[0], P[2] - a[1], P[3] - a[2]).applyMatrix4(B.bs[bi].matrixWorld);
    if (I && I.toWorld) _pp.applyMatrix4(I.toWorld);
    return out && out.isVector3 ? out.copy(_pp) : _pp.toArray(out || []);
  }
  // float textures read in a vertex shader: WebGL2, or WebGL1 with OES_texture_float and vertex texture units
  const can = r => { try { const c = r && r.capabilities; return !!(c && c.floatVertexTextures && c.maxVertexTextures > 0); } catch (e) { return false; } };
  function info(B) {
    if (!B || !B.rig) return null;
    const st = B.st, F = st.feet || [];
    return { feet: F.map(f => f.p.slice()), on: F.map(f => f.on), steps: st.n || 0, started: Number.isFinite(st.started) ? st.started : -1, glide: !!st.glide,
      eye: B.eye.now, want: B.eye.want, k: B.k, hips: B.rig.bones.hips.getWorldPosition(V()).toArray(), neck: B.neck ? B.neck.scale.x : 1, hands: B.H.map(H => +H.w.toFixed(3)) };
  }
  const stats = () => statsOf(W.def);
  return { CAP, PARTS, can, attach, warm, person, begin, add, end, info, stats, meshes: () => ({ body: W.def ? W.def.body : null, halo: W.def ? W.def.halo : null }),
    set, size, grip, point,
    // (the mannequin's bones and geometry, made once: the tracker guide's generator, tools/studio/tracker-guide/, exports
    // it as a skinned model; nothing in the app calls it)
    mannequin: () => W.M || (W.M = mannequin()) };
})();
