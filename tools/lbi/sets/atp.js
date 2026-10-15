// ATP synthase (slides 13-16): the 13 parts as folded chains, the assembled rotary motor in the inner
// mitochondrial membrane, protons turning the rotor while the head makes ATP, and the complex as a network.
SETS.atp = function (K) {
  const { THREE, v3, prog, lerp, clamp } = K;
  const set = K.newSet('atp');
  const D = Math.PI / 180, TAU = 2 * Math.PI;
  // azimuth phi around the rotor axis (y); phi grows the way the rotor turns when it makes ATP
  // (anticlockwise seen from the matrix, i.e. from above), which is a positive rotation about +y
  const az = (r, phi, y) => [r * Math.cos(phi), y, -r * Math.sin(phi)];
  const er = phi => [Math.cos(phi), 0, -Math.sin(phi)], et = phi => [-Math.sin(phi), 0, -Math.cos(phi)], EY = [0, 1, 0];
  const rotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]]; };
  const V = p => new THREE.Vector3(p[0], p[1], p[2]);
  const C3 = c => new THREE.Color(...K.rgb(c));
  // quadratic Bezier from a to c with control point b
  const bez = (a, b, c, u) => {
    const p = (1 - u) * (1 - u), q = 2 * u * (1 - u), s = u * u;
    return [p * a[0] + q * b[0] + s * c[0], p * a[1] + q * b[1] + s * c[1], p * a[2] + q * b[2] + s * c[2]];
  };
  // the complex is laid out in its own frame (about 25 nm = 1.06 units), then scaled to 1.2 units and centred
  const Z = 1.13, OY = 0.075, toSet = p => [Z * p[0], Z * p[1] + OY, Z * p[2]];
  // membrane mid-plane, head centre, azimuths of subunit a and of the rotor's bulge, membrane radius
  const YM = -0.4, YH = 0.17, PA = -15 * D, PG = -100 * D, MR = 0.86;
  const cx = new THREE.Group();
  cx.scale.setScalar(Z); cx.position.y = OY;
  set.group.add(cx);

  // ------------------------------------------------------------------ the 13 parts
  // symbol (old, as on the slides), short role, colour group (slide 14), colour in the assembled complex, fold recipe
  // (b brown and a dark brown at the colour step, as on slide 14)
  const GRP = { f1: '#36c8b9', af: '#e2b179', b: '#a8625b', oscp: '#9283d0', a: '#5e3027', c: '#efa3af' };
  const GREY = C3('#5aaca7');
  const COMP = [
    ['ATP5A1', 'α', 'f1', '#1db0a2', 'T26 D0,30,0,12 E6 L3 E6 L3 E6 L3 E6 L3 E6 D0,2,0,17 L5 H12 L4 E5 L3 H14 L4 E5 L3 H12 L4 ' +
      'E6 L3 H15 L4 E5 L3 H11 L5 E5 L4 H12 D2,-28,0,13 L6 H17 L4 H15 L4 H19 L4 H14 L4 H12 T10'],
    ['ATP5B', 'β', 'f1', '#3184dc', 'T32 D0,29,0,12 E6 L3 E6 L3 E6 L3 E5 L3 E6 D0,1,0,17 L5 H13 L4 E5 L3 H12 L4 E6 L3 H14 L4 ' +
      'E5 L3 H12 L4 E5 L4 H13 D-2,-27,0,12 L6 H16 L4 H18 L4 H14 L4 H15 T8'],
    ['ATPAF1', 'helper', 'af', '#d9a066', 'T22 D0,0,0,15 H10 L4 E5 L3 E5 L3 H12 L4 H14 L4 E6 L3 E6 L4 H10 L4 H16 ' +
      'D12,8,0,9 L6 H12 L4 H10 T18'],
    ['ATPAF2', 'helper', 'af', '#d9a066', 'T18 D0,0,0,14 H14 L4 H12 L4 E5 L3 E5 L3 E5 L4 H16 L4 H10 L4 H12 L5 H11 T14'],
    ['ATP5C1', 'γ', 'f1', '#5adcc7', 'T14 P0,40,0 X44:0,-1,0 D7,-14,0,10 L4 H10 L4 E5 L3 E5 L3 H12 L4 E5 L4 H10 G9,-12,3:5 X52:0,1,0 T6'],
    ['ATP5D', 'δ', 'f1', '#3ebfaf', 'T14 D0,0,0,11 E5 L3 E5 L3 E5 L3 E5 L3 E5 L3 E5 D0,-14,0,9 L5 H16 L4 H16 T5'],
    ['ATP5E', 'ε', 'f1', '#86e8d6', 'T3 D0,0,0,7 H12 L5 H10 L4 E4 L3 E4 T5'],
    ['ATP5F1', 'b', 'b', '#a33d4b', 'T24 P0,-40,0 X18:0.15,1,0 G4,-12,0:4 X18:-0.15,-1,0 G6,-34,4:5 X92:0,1,0.06 D8,108,6,7 L4 H12 T8'],
    ['ATP5O', 'OSCP', 'oscp', '#9283d0', 'T14 D0,10,0,11 H14 L4 H12 L4 H14 L4 H12 L4 H10 D4,-14,0,9 L6 E5 L3 E5 L3 H12 L4 E5 L3 H10 T7'],
    ['MT-ATP6', 'a', 'a', '#7e4a3c', 'T3 D0,0,0,13 H22 L5 H20 L5 H24 L5 H22 L5 H20 L5 H18 T5'],
    ['ATP5G1', 'c', 'c', '#ec8396', 'T30 P0,-22,0 X30:0,1,0 G9,24,0:5 X31:0,-1,0 T3'],
    ['ATP5G2', 'c', 'c', '#ec8396', 'T34 P0,-22,0 X30:0,1,0 G9,24,0:5 X31:0,-1,0 T3'],
    ['ATP5G3', 'c', 'c', '#ec8396', 'T32 P0,-22,0 X31:0,1,0 G9,25,0:5 X31:0,-1,0 T3'],
  ].map(([s, role, g, cc, recipe], i) => ({ s, role, g, gcol: C3(GRP[g]), ccol: C3(cc), recipe, i, copies: [] }));
  const SYM = COMP.map(c => c.s), ci = s => SYM.indexOf(s);
  // the grid of slide 13: four rows, labels above each chain
  [[0, 1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]].forEach((row, i) => row.forEach((c, j) => {
    COMP[c].grid = [(j - (row.length - 1) / 2) * 0.5, 0.7 - 0.47 * i, 0];
  }));

  // An AlphaFold-like chain: a C-alpha trace in Å from a recipe. D x,y,z,R domain; H n helix across the domain;
  // E n strand (a strand after a loop joins the current sheet, antiparallel after a hairpin, parallel after a
  // helix); L n loop; X n:dx,dy,dz straight helix along a direction; P x,y,z jump; G x,y,z:n loop to a point;
  // T n floppy tail (a leading T is the N-terminal tail, grown backwards from the first residue).
  function fold(recipe, seed) {
    const rr = K.rng(seed), tok = recipe.split(' '), pts = [], typ = [];
    let C = [0, 0, 0], R = 12, p = null, sheet = null, pend = null, prev = '', nTail = 0;
    const put = (q, k) => { pts.push(q); typ.push(k); };
    const perp = d => { const e = v3.norm(v3.cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])); return [e, v3.cross(d, e)]; };
    const start = () => { if (!p) p = v3.add(C, v3.mul(K.unit(rr), R * 0.8)); };
    const across = () => {
      const q = v3.add(C, v3.mul(v3.norm(v3.add(v3.norm(v3.sub(C, p)), v3.mul(K.unit(rr), 0.8))), R * 0.7));
      return v3.norm(v3.sub(q, p));
    };
    const loop = (q, n) => {
      const m = v3.lerp(p, q, 0.5), ctrl = v3.add(v3.add(m, v3.mul(v3.sub(m, C), 0.45)), v3.mul(K.unit(rr), 2.5));
      for (let i = 1; i <= n; i++) put(bez(p, ctrl, q, i / (n + 1)), 'L');
      p = q;
    };
    const walk = (from, n, out) => {
      let q = from, d = v3.norm(v3.add(out, v3.mul(K.unit(rr), 0.6)));
      const l = [];
      for (let i = 0; i < n; i++) {
        d = v3.norm(v3.add(v3.add(v3.mul(d, 0.6), v3.mul(K.unit(rr), 0.62)), v3.mul(out, 0.12)));
        q = v3.add(q, v3.mul(d, 3.8)); l.push(q);
      }
      return l;
    };
    for (let ti = 0; ti < tok.length; ti++) {
      const s = tok[ti], ty = s[0], [a, b] = s.slice(1).split(':'), n = parseInt(a, 10);
      if (ty === 'D') { const v = a.split(',').map(Number); C = v.slice(0, 3); R = v[3]; sheet = null; }
      else if (ty === 'P') p = a.split(',').map(Number);
      else if (ty === 'T') {
        if (!pts.length) { nTail = n; continue; }
        for (const q of walk(p, n, v3.norm(v3.sub(p, C)))) put(q, 'T');
        p = pts[pts.length - 1];
      } else if (ty === 'H' || ty === 'X') {
        start();
        const d = ty === 'X' ? v3.norm(b.split(',').map(Number)) : across(), [e1, e2] = perp(d), ph = rr() * TAU;
        for (let i = 0; i < n; i++) {
          const w = ph + i * 100 * D;
          put(v3.add(v3.add(p, v3.mul(d, 1.5 * i)), v3.add(v3.mul(e1, 2.3 * Math.cos(w)), v3.mul(e2, 2.3 * Math.sin(w)))), 'H');
        }
        p = v3.add(p, v3.mul(d, 1.5 * n));
      } else if (ty === 'E') {
        start();
        let d;
        if (pend) d = pend; else { d = across(); sheet = { d0: d, e: perp(d)[0] }; }
        pend = null;
        const nn = v3.cross(d, sheet.e), a0 = p;
        for (let i = 0; i < n; i++) put(v3.add(v3.add(p, v3.mul(d, 3.3 * i)), v3.mul(nn, i % 2 ? 0.9 : -0.9)), 'E');
        const b0 = v3.add(p, v3.mul(d, 3.3 * (n - 1)));
        sheet.last = { a: a0, b: b0, d };
        p = v3.add(b0, v3.mul(d, 1.6));
      } else if (ty === 'L' || ty === 'G') {
        start();
        let q;
        if (ty === 'G') q = a.split(',').map(Number);
        else if (sheet && sheet.last && tok[ti + 1] && tok[ti + 1][0] === 'E') {
          const L = sheet.last;
          if (prev === 'E') { pend = v3.mul(L.d, -1); q = v3.add(L.b, v3.mul(sheet.e, 4.8)); }
          else { pend = sheet.d0; q = v3.add(v3.dot(L.d, sheet.d0) > 0 ? L.a : L.b, v3.mul(sheet.e, 4.8)); }
        } else {
          let best = 1e9;
          for (let k = 0; k < 6; k++) {
            const c = v3.add(C, v3.mul(K.unit(rr), R * 0.75)), e = Math.abs(v3.dist(c, p) - n * 2.6);
            if (e < best) { best = e; q = c; }
          }
        }
        loop(q, ty === 'G' ? parseInt(b, 10) : n);
      }
      prev = ty;
    }
    if (nTail) {
      let c = [0, 0, 0];
      for (const q of pts) c = v3.add(c, v3.mul(q, 1 / pts.length));
      const l = walk(pts[0], nTail, v3.norm(v3.sub(pts[0], c))).reverse();
      pts.unshift(...l); typ.unshift(...l.map(() => 'T'));
    }
    return { pts, typ };
  }
  // principal axes of a point set
  function pca(P) {
    const n = P.length, c = [0, 0, 0], M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const p of P) { c[0] += p[0] / n; c[1] += p[1] / n; c[2] += p[2] / n; }
    for (const p of P) { const d = v3.sub(p, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[3 * i + j] += d[i] * d[j]; }
    const mul = v => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
      M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
    let e1 = v3.norm([1, 0.31, 0.17]), e2 = [0, 1, 0];
    for (let i = 0; i < 40; i++) e1 = v3.norm(mul(e1));
    e2 = v3.norm(v3.cross(e1, [0.13, 0.29, 1]));
    for (let i = 0; i < 40; i++) { e2 = mul(e2); e2 = v3.norm(v3.sub(e2, v3.mul(e1, v3.dot(e2, e1)))); }
    return { c, e: [e1, e2, v3.cross(e1, e2)] };
  }
  const basisQ = e => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(e[0]), V(e[1]), V(e[2])));
  const _v = new THREE.Vector3();
  for (const C of COMP) {
    const f = fold(C.recipe, 101 + 17 * C.i);
    const core = f.pts.filter((p, i) => f.typ[i] !== 'T'), pc = pca(core), pa = pca(f.pts);
    // in the grid the chain's long axis lies across its cell, turned a little so it reads as 3D
    const qg = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.45, 0.3, C.i % 2 ? 0.14 : -0.12)).multiply(basisQ(pa.e).invert());
    const loc = f.pts.map(p => v3.sub(p, pc.c)), rot = loc.map(p => _v.set(p[0], p[1], p[2]).applyQuaternion(qg).toArray());
    const box = only => {
      const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      rot.forEach((p, i) => {
        if (!only || f.typ[i] !== 'T') for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
      });
      return [lo, hi];
    };
    const [lo, hi] = box(false), [cl, ch] = box(true);
    // fill the cell with the folded core; floppy ends may reach to its edges
    const s = Math.min(0.3 / (ch[0] - cl[0]), 0.24 / (ch[1] - cl[1]), 0.46 / (hi[0] - lo[0]), 0.36 / (hi[1] - lo[1]), 0.012);
    // buried residues (many neighbours within 10 Å) are shaded darker, so the folded cores read dark as on slide 13
    const n = f.pts.length, nb = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
      const a = f.pts[i];
      for (let j = i + 1; j < n; j++) {
        const b = f.pts[j], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
        if (dx * dx + dy * dy + dz * dz < 100) { nb[i]++; nb[j]++; }
      }
    }
    C.ao = Array.from(nb, k => clamp(1.15 - 0.016 * (k - 8), 0.42, 1.12));
    C.res = loc.map(p => v3.mul(p, s));
    C.typ = f.typ;
    C.q0 = qg;
    C.p0 = v3.sub(C.grid, v3.mul(v3.lerp(lo, hi, 0.5), s));
    C.axes = pc.e;
    C.tubeR = clamp(3.1 * s, 0.008, 0.013);
    C.label = [C.grid[0] - 0.19, C.grid[1] + 0.17, 0];
  }

  // a tube along a chain (radius in grid units): a Catmull-Rom curve through the residues, two rings per residue,
  // parallel-transported frames (same layout and winding as THREE.TubeGeometry, but much cheaper to build);
  // aU = position along the chain for the reveal
  function chainGeo(C) {
    const P = C.res, n = P.length, per = 2, rad = 5, R = C.tubeR, S = [];
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      for (let k = 0; k < per; k++) {
        const u = k / per, u2 = u * u, u3 = u2 * u, q = [0, 0, 0];
        for (let j = 0; j < 3; j++) {
          q[j] = 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 +
            (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * u3);
        }
        S.push(q);
      }
    }
    S.push(P[n - 1]);
    const m = S.length, nv = m * (rad + 1), pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
    const uu = new Float32Array(nv), tl = new Float32Array(nv), col = new Float32Array(nv * 3);
    // shade by structure (helices bright, loops dark) and by burial
    const rr = K.rng(C.i + 3), shade = { H: 1.05, E: 0.95, L: 0.7, T: 0.85 }, rs = P.map(() => 0.92 + 0.16 * rr());
    let N = null;
    for (let i = 0; i < m; i++) {
      const T = v3.norm(v3.sub(S[Math.min(i + 1, m - 1)], S[Math.max(i - 1, 0)]));
      N = N ? v3.sub(N, v3.mul(T, v3.dot(N, T))) : v3.cross(T, Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
      N = v3.norm(N);
      const B = v3.cross(T, N), ri = Math.min(n - 1, Math.round(i / per)), k = shade[C.typ[ri]] * rs[ri] * C.ao[ri];
      for (let j = 0; j <= rad; j++) {
        const v = j / rad * TAU, c = -Math.cos(v), sn = Math.sin(v), o = i * (rad + 1) + j;
        const nx = c * N[0] + sn * B[0], ny = c * N[1] + sn * B[1], nz = c * N[2] + sn * B[2];
        nor[3 * o] = nx; nor[3 * o + 1] = ny; nor[3 * o + 2] = nz;
        pos[3 * o] = S[i][0] + R * nx; pos[3 * o + 1] = S[i][1] + R * ny; pos[3 * o + 2] = S[i][2] + R * nz;
        uu[o] = i / (m - 1); tl[o] = C.typ[ri] === 'T' ? 1 : 0; col[3 * o] = col[3 * o + 1] = col[3 * o + 2] = k;
      }
    }
    const idx = new Uint32Array((m - 1) * rad * 6);
    let w = 0;
    for (let i = 1; i < m; i++) for (let j = 1; j <= rad; j++) {
      const a = (rad + 1) * (i - 1) + (j - 1), b = (rad + 1) * i + (j - 1), c = (rad + 1) * i + j, d = (rad + 1) * (i - 1) + j;
      idx[w++] = a; idx[w++] = b; idx[w++] = d; idx[w++] = b; idx[w++] = c; idx[w++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aU', new THREE.BufferAttribute(uu, 1)); g.setAttribute('aK', new THREE.BufferAttribute(tl, 1));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }
  // chains: lit tubes that draw themselves along their length (uRev) and thin away once the surface has formed
  // (uThin; the floppy ends, aK = 1, go first, uThinT, right after the chain has docked)
  const chainCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aU, aK; varying float vU; uniform float uThin, uThinT;')
      .replace('#include <begin_vertex>', 'vec3 transformed = position - normal * max(uThin, aK * uThinT); vU = aU;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vU; uniform float uRev;')
      .replace('#include <clipping_planes_fragment>', 'if (vU > uRev) discard;\n#include <clipping_planes_fragment>');
  };

  // ------------------------------------------------------------------ the assembled complex
  // Every copy of every part becomes a cluster of overlapping spheres (a molecular surface). Domains are
  // ellipsoids sampled on their surface; helices are rods of spheres. Spheres buried in another domain of the
  // same body (stator, rotor or helper) are dropped.
  const COPIES = [], DOM = [], RAW = [];
  const addCopy = (c, o) => {
    const cp = Object.assign({ comp: c, i: COPIES.length, rotor: false, body: 's', s0: 0 }, o);
    COPIES.push(cp); COMP[c].copies.push(cp);
    return cp;
  };
  const H = 0.036;
  const fib = (n, i) => {
    const y = 1 - 2 * (i + 0.5) / n, s = Math.sqrt(1 - y * y), t = i * 2.399963;
    return [s * Math.cos(t), y, s * Math.sin(t)];
  };
  const srng = K.rng(4242);
  function ell(cp, c, ax, rad, tint) {
    const [a, b, d] = rad, k = 1.6;
    const area = 4 * Math.PI * Math.pow((Math.pow(a * b, k) + Math.pow(a * d, k) + Math.pow(b * d, k)) / 3, 1 / k);
    const n = Math.max(8, Math.round(area / (H * H * 0.92))), dom = { c, ax, rad, cp, i: DOM.length };
    DOM.push(dom);
    for (let i = 0; i < n; i++) {
      const u = fib(n, i), s = 1 + (srng() - 0.62) * 0.4 * H / Math.min(a, b, d);
      const q = v3.add(c, v3.add(v3.add(v3.mul(ax[0], a * u[0] * s), v3.mul(ax[1], b * u[1] * s)), v3.mul(ax[2], d * u[2] * s)));
      RAW.push({ p: q, r: H * (0.8 + 0.32 * srng()), cp, dom: dom.i, tint: tint || 1 });
    }
  }
  // a helix as a rod of spheres along an axis through points; off = helix radius, rise per residue
  function rod(cp, axis, o = {}) {
    const curve = new THREE.CatmullRomCurve3(axis.map(V)), L = curve.getLength(), rise = o.rise || 0.0115;
    const n = Math.max(2, Math.round(L / rise)), off = o.off || 0.016, ph = srng() * TAU;
    for (let i = 0; i <= n; i++) {
      const u = i / n, A = curve.getPointAt(u).toArray(), T = curve.getTangentAt(u).toArray();
      const N = v3.norm(v3.cross(T, Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), B = v3.cross(T, N), w = ph + i * 100 * D;
      const p = v3.add(A, v3.add(v3.mul(N, off * Math.cos(w)), v3.mul(B, off * Math.sin(w))));
      RAW.push({ p, r: (o.r || 0.029) * (0.88 + 0.24 * srng()), cp, dom: -1, tint: o.tint || 1 });
    }
  }
  const arc = (r, p0, p1, y0, y1, n = 7) =>
    Array.from({ length: n }, (x, i) => az(r, lerp(p0, p1, i / (n - 1)), lerp(y0, y1, i / (n - 1))));

  // head: alpha3beta3, alternating around the central shaft; each subunit has a crown, a nucleotide-binding
  // domain and a helical C-terminal domain
  for (let k = 0; k < 6; k++) {
    const phi = PA + (30 + 60 * k) * D, beta = k % 2 === 1, tw = (beta ? 6 : -6) * D;
    const cp = addCopy(beta ? 1 : 0, { k, phi, t1: EY, t2: er(phi), s0: 0.012 * k, beta });
    const at = (r, y) => az(r, phi, y), ax = [er(phi + tw), EY, et(phi + tw)];
    ell(cp, at(0.135, YH + 0.15), ax, [0.064, 0.068, 0.062], 1.08);
    ell(cp, at(0.168, YH + 0.025), ax, [0.094, 0.1, 0.086], 1);
    ell(cp, at(0.15, YH - 0.115), ax, beta ? [0.076, 0.08, 0.072] : [0.072, 0.078, 0.074], 0.94);
  }
  const ALPHA_F = COPIES[4], BETA_F = COPIES[5];   // the front alpha and beta (the helpers dock on these)
  // assembly factors dock on the outside of a beta (ATPAF1) and an alpha (ATPAF2), then leave
  const af = (c, host, s0) => {
    const phi = host.phi, drift = v3.add(v3.mul(er(phi + 10 * D), 0.42), [0, 0.3, 0]);
    const cp = addCopy(c, { phi, t1: EY, t2: er(phi), s0, body: 'h', drift });
    ell(cp, az(0.34, phi, YH + 0.03), [er(phi), EY, et(phi)], [0.058, 0.078, 0.072]);
    ell(cp, az(0.37, phi + 12 * D, YH + 0.11), [er(phi), EY, et(phi)], [0.04, 0.04, 0.04]);
    return cp;
  };
  const AF1 = af(2, BETA_F, 0.0), AF2 = af(3, ALPHA_F, 0.02);
  // central stalk (rotor): gamma's coiled coil and foot, delta and epsilon, an asymmetric mass on the c-ring
  const G = addCopy(4, { rotor: true, body: 'r', t1: EY, t2: er(PG), s0: 0.07 });
  rod(G, [[0.018, -0.13, 0.004], [0.02, -0.04, 0.012], [0.016, 0.06, 0.02]], { off: 0.014, r: 0.024 });
  rod(G, [[-0.016, -0.12, -0.012], [-0.02, -0.03, -0.004], [-0.018, 0.05, 0.008]], { off: 0.014, r: 0.024 });
  ell(G, az(0.04, PG, -0.125), [er(PG), EY, et(PG)], [0.07, 0.045, 0.062]);
  const DL = addCopy(5, { rotor: true, body: 'r', t1: EY, t2: er(PG + 115 * D), s0: 0.08 });
  ell(DL, az(0.075, PG + 115 * D, -0.165), [er(PG + 115 * D), EY, et(PG + 115 * D)], [0.06, 0.045, 0.055]);
  ell(DL, az(0.055, PG + 165 * D, -0.11), [er(PG + 165 * D), EY, et(PG + 165 * D)], [0.042, 0.04, 0.04]);
  const EP = addCopy(6, { rotor: true, body: 'r', t1: et(PG - 70 * D), t2: EY, s0: 0.09 });
  ell(EP, az(0.07, PG - 70 * D, -0.205), [er(PG - 70 * D), EY, et(PG - 70 * D)], [0.042, 0.032, 0.042]);
  // c-ring: 8 hairpins of two helices, inner (N-terminal) and outer (C-terminal, carries the proton site);
  // the three genes make the same mature subunit, so the ring mixes them
  const CPHI = j => (-135 + 45 * j) * D, RIN = 0.088, ROUT = 0.148;
  for (let j = 0; j < 8; j++) {
    const c = 10 + (j % 3), phi = CPHI(j), po = phi + 22.5 * D;
    const cp = addCopy(c, { j, phi, rotor: true, body: 'r', t1: EY, t2: er(phi), s0: 0.12 + 0.008 * j, shade: j % 2 ? 0.76 : 1 });
    rod(cp, [az(RIN, phi, YM - 0.155), az(RIN, phi + 4 * D, YM), az(RIN, phi, YM + 0.15)], { off: 0.014, r: 0.03, rise: 0.016 });
    rod(cp, [az(ROUT, po, YM + 0.15), az(ROUT, po - 3 * D, YM), az(ROUT, po, YM - 0.155)], { off: 0.016, r: 0.029 });
    rod(cp, [az(RIN, phi, YM + 0.165), az((RIN + ROUT) / 2, phi + 11 * D, YM + 0.19), az(ROUT, po, YM + 0.165)],
      { off: 0.008, r: 0.026, rise: 0.016 });
  }
  // subunit a: long, nearly horizontal helices wrapped around the c-ring
  const AS = addCopy(9, { t1: et(PA), t2: EY, s0: 0.17 }), AR = { rise: 0.0135, r: 0.031 };
  rod(AS, arc(0.236, PA - 50 * D, PA + 46 * D, YM + 0.075, YM + 0.095), AR);
  rod(AS, arc(0.236, PA + 48 * D, PA - 48 * D, YM - 0.01, YM + 0.01), AR);
  rod(AS, arc(0.236, PA - 46 * D, PA + 50 * D, YM - 0.1, YM - 0.085), AR);
  rod(AS, arc(0.29, PA + 40 * D, PA - 40 * D, YM + 0.06, YM + 0.035), AR);
  rod(AS, arc(0.29, PA - 38 * D, PA + 36 * D, YM - 0.065, YM - 0.04), AR);
  rod(AS, [az(0.3, PA + 44 * D, YM - 0.13), az(0.3, PA + 46 * D, YM), az(0.29, PA + 42 * D, YM + 0.13)], AR);
  // peripheral stalk, subunit b: two helices in the membrane beside a, then one long helix up the side of the head
  const BS = addCopy(7, { t1: v3.norm([0, 1, 0]), t2: er(PA), s0: 0.19 });
  rod(BS, [az(0.355, PA + 8 * D, YM - 0.13), az(0.35, PA + 7 * D, YM + 0.13)], AR);
  rod(BS, [az(0.36, PA - 6 * D, YM + 0.12), az(0.355, PA - 5 * D, YM - 0.12)], AR);
  // the long helix with its partners in the stalk (d and F6, not among the 13) as a twisted bundle
  const stalk = [az(0.36, PA, YM + 0.13), az(0.36, PA - 2 * D, -0.12), az(0.335, PA - 4 * D, 0.05), az(0.31, PA - 5 * D, 0.2),
    az(0.27, PA - 4 * D, 0.33), az(0.2, PA - 2 * D, 0.405)];
  const twist = (k, w) => stalk.map((p, i) =>
    v3.add(p, v3.mul(v3.add(v3.mul(er(PA), Math.cos(i * 1.3 + k)), v3.mul(et(PA), Math.sin(i * 1.3 + k))), w)));
  rod(BS, twist(0, 0.018), { off: 0.016, r: 0.03, rise: 0.013 });
  rod(BS, twist(Math.PI, 0.018), { off: 0.016, r: 0.028, rise: 0.016 });
  ell(BS, az(0.37, PA + 3 * D, -0.17), [er(PA), EY, et(PA)], [0.045, 0.075, 0.048]);
  // OSCP caps the peripheral stalk on top of the head
  const OS = addCopy(8, { t1: er(PA), t2: EY, s0: 0.21 });
  ell(OS, az(0.05, PA, YH + 0.245), [er(PA), EY, et(PA)], [0.072, 0.048, 0.062]);
  ell(OS, az(0.17, PA, YH + 0.23), [er(PA), EY, et(PA)], [0.055, 0.05, 0.05]);

  // drop buried spheres (inside another domain of the same body; helpers never bury anything)
  const inside = (d, p) => {
    const q = v3.sub(p, d.c);
    let s = 0;
    for (let k = 0; k < 3; k++) { const x = v3.dot(q, d.ax[k]) / d.rad[k]; s += x * x; }
    return s < 0.9;
  };
  const SPH = RAW.filter(s => !DOM.some(d => d.i !== s.dom && d.cp.body === s.cp.body && d.cp.body !== 'h' && inside(d, s.p)) &&
    !(s.cp.body === 'h' && DOM.some(d => d.cp.body === 's' && inside(d, s.p))));
  // ambient occlusion from the number of near neighbours: spheres in grooves are darker
  const occ = new Float32Array(SPH.length);
  {
    const cell = 0.075, c2 = cell * cell, hash = new Map(), xyz = new Float32Array(SPH.length * 3);
    const key = (a, b, c) => (a + 64) * 16384 + (b + 64) * 128 + (c + 64), fl = x => Math.floor(x / cell);
    SPH.forEach((s, i) => {
      xyz.set(s.p, 3 * i);
      const k = key(fl(s.p[0]), fl(s.p[1]), fl(s.p[2]));
      (hash.get(k) || hash.set(k, []).get(k)).push(i);
    });
    for (let i = 0; i < SPH.length; i++) {
      const x = xyz[3 * i], y = xyz[3 * i + 1], z = xyz[3 * i + 2], gx = fl(x), gy = fl(y), gz = fl(z);
      let n = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const l = hash.get(key(gx + a, gy + b, gz + c));
        if (l) for (let q = 0; q < l.length; q++) {
          const j = 3 * l[q], dx = xyz[j] - x, dy = xyz[j + 1] - y, dz = xyz[j + 2] - z;
          if (dx * dx + dy * dy + dz * dz < c2) n++;
        }
      }
      occ[i] = n;
    }
  }
  // dock each chain copy on its cluster: centre, scale along the main axis, and which residue each sphere grows from
  for (const cp of COPIES) {
    cp.sph = SPH.filter(s => s.cp === cp);
    let c = [0, 0, 0];
    for (const s of cp.sph) c = v3.add(c, v3.mul(s.p, 1 / cp.sph.length));
    const C = COMP[cp.comp], t1 = v3.norm(cp.t1), t2 = v3.norm(v3.sub(cp.t2, v3.mul(t1, v3.dot(cp.t2, t1))));
    const t3 = v3.cross(t1, t2), pr = cp.sph.map(s => v3.dot(v3.sub(s.p, c), t1)), rp = C.res.map(p => v3.dot(p, C.axes[0]));
    const span = a => Math.max(...a) - Math.min(...a);
    cp.P1 = c; cp.s1 = 0.92 * span(pr) / span(rp.filter((x, i) => C.typ[i] !== 'T'));
    cp.q1 = basisQ([t1, t2, t3]).multiply(basisQ(C.axes).invert());
    // spheres grow out of the folded core, in order along the main axis; never from the floppy ends, which
    // thin away first (spheres starting out there would spray around the complex mid-build)
    const ord = cp.sph.map((s, i) => i).sort((a, b) => pr[a] - pr[b]);
    const ro = C.res.map((p, i) => i).filter(i => C.typ[i] !== 'T').sort((a, b) => rp[a] - rp[b]);
    ord.forEach((si, rank) => {
      const s = cp.sph[si], ri = ro[Math.floor(rank / ord.length * ro.length)];
      s.from = v3.add(c, V(C.res[ri]).multiplyScalar(cp.s1).applyQuaternion(cp.q1).toArray());
      s.t0 = cp.s0 + 0.3 + 0.14 * rank / ord.length + 0.05 * srng();
    });
    cp.r0 = 0.6 * C.tubeR * cp.s1;
  }
  // in order of growth, so that only the spheres that have started are drawn (instanceCount)
  SPH.forEach((s, i) => { s.occ = occ[i]; });
  SPH.sort((a, b) => a.t0 - b.t0);
  const T0 = Float32Array.from(SPH, s => s.t0);
  const started = b => {
    let lo = 0, hi = T0.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (T0[m] <= b) lo = m + 1; else hi = m; }
    return lo;
  };

  // ------------------------------------------------------------------ sphere surface (one instanced draw)
  const NS = SPH.length, NC = COPIES.length;
  // an indexed icosphere (42 vertices instead of 240, so the vertex shader runs far less often)
  function icosphere(detail, scale) {
    const src = new THREE.IcosahedronGeometry(1, detail).attributes.position, map = new Map(), pos = [], idx = [];
    for (let i = 0; i < src.count; i++) {
      const x = src.getX(i), y = src.getY(i), z = src.getZ(i), k = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
      if (!map.has(k)) { map.set(k, pos.length / 3); pos.push(x, y, z); }
      idx.push(map.get(k));
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos).map(v => v * scale), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    return g;
  }
  const sg = icosphere(1, 1), pg = icosphere(0, 0.9);
  sg.instanceCount = pg.instanceCount = NS;
  const aTo = new Float32Array(NS * 4), aFrom = new Float32Array(NS * 4), aMeta = new Float32Array(NS * 4);
  const aC0 = new Float32Array(NS * 3), aC1 = new Float32Array(NS * 3);
  SPH.forEach((s, i) => {
    const cp = s.cp, C = COMP[cp.comp];
    aTo.set([...s.p, s.r], 4 * i); aFrom.set([...s.from, cp.r0], 4 * i);
    // weight of the copy offset: beta subunits hinge at the top (the lower half swings), helpers move whole
    const w = cp.beta ? clamp((YH + 0.12 - s.p[1]) / 0.3, 0, 1) : 1;
    aMeta.set([cp.i, cp.rotor ? 1 : 0, w, s.t0], 4 * i);
    const ao = clamp(1.42 - 0.021 * s.occ, 0.5, 1.12), j = 0.93 + 0.14 * srng(), k = ao * j * s.tint * (cp.shade || 1);
    const k0 = j * (0.75 + 0.25 * ao);
    aC0.set([C.gcol.r * k0, C.gcol.g * k0, C.gcol.b * k0], 3 * i);
    aC1.set([C.ccol.r * k, C.ccol.g * k, C.ccol.b * k], 3 * i);
  });
  sg.setAttribute('aTo', new THREE.InstancedBufferAttribute(aTo, 4));
  sg.setAttribute('aFrom', new THREE.InstancedBufferAttribute(aFrom, 4));
  sg.setAttribute('aMeta', new THREE.InstancedBufferAttribute(aMeta, 4));
  sg.setAttribute('aC0', new THREE.InstancedBufferAttribute(aC0, 3));
  sg.setAttribute('aC1', new THREE.InstancedBufferAttribute(aC1, 3));
  for (const k of ['aTo', 'aFrom', 'aMeta', 'aC0', 'aC1']) pg.setAttribute(k, sg.attributes[k]);
  const SU = {
    uBuild: { value: 0 }, uColour: { value: 0 }, uAng: { value: 0 }, uGrey: { value: GREY }, uRim: { value: 0.32 },
    uCp: { value: COPIES.map(() => new THREE.Vector4(0, 0, 0, 1)) },
  };
  const sphVert = `
attribute vec4 aTo, aFrom, aMeta; attribute vec3 aC0, aC1;
uniform float uBuild, uColour, uAng; uniform vec4 uCp[${NC}]; uniform vec3 uGrey;
varying vec3 vCol;`;
  const sphBegin = `
float m = clamp((uBuild - aMeta.w) / 0.22, 0.0, 1.0); m = m * m * (3.0 - 2.0 * m);
vec4 cp = uCp[int(aMeta.x + 0.5)];
vec3 ctr = mix(aFrom.xyz, aTo.xyz, m) + vec3(0.0, 0.05, 0.0) * m * (1.0 - m) + cp.xyz * aMeta.z;
float an = aMeta.y * uAng, ca = cos(an), sa = sin(an);
ctr = vec3(ca * ctr.x + sa * ctr.z, ctr.y, -sa * ctr.x + ca * ctr.z);
float rad = mix(aFrom.w, aTo.w, m) * cp.w * step(aMeta.w, uBuild - 0.0001);
vec3 transformed = ctr + position * rad;
vCol = mix(mix(uGrey, aC0, uColour), aC1, m);`;
  const sphMat = K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.66, metalness: 0 }), 1);
  sphMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, SU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + sphVert)
      .replace('#include <begin_vertex>', sphBegin);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCol; uniform float uRim;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vCol;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' +
        'totalEmissiveRadiance += vCol * uRim * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.2);');
  };
  const sph = new THREE.Mesh(sg, sphMat);
  sph.frustumCulled = false; sph.renderOrder = 2;
  cx.add(sph);
  // depth-only pre-pass (low-poly spheres just inside the real ones), so the faint ghost of the network view
  // shows only the outer surface. It also cuts a complex-shaped hole into whatever other sets draw later, so
  // it runs only while the set is (nearly) fully in and not shrinking; the ghost fades out before it stops
  // (shrink 0..0.12, set fade 1..0.7), so neither a hole nor a pop shows in the hand-over or in explore.
  const preMat = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
  preMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, SU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + sphVert)
      .replace('#include <begin_vertex>', sphBegin);
  };
  const pre = new THREE.Mesh(pg, preMat);
  pre.frustumCulled = false; pre.renderOrder = 1;
  cx.add(pre);

  // ------------------------------------------------------------------ chain meshes (one per part, one instance per copy)
  for (const C of COMP) {
    const mat = K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, vertexColors: true }), 1);
    const uRev = { value: 0 }, uThin = { value: 0 }, uThinT = { value: 0 };
    mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, { uRev, uThin, uThinT }); chainCompile(sh); };
    const mesh = new THREE.InstancedMesh(chainGeo(C), mat, C.copies.length);
    mesh.frustumCulled = false;
    set.group.add(mesh);
    const s0 = Math.min(...C.copies.map(cp => cp.s0)), s1 = Math.max(...C.copies.map(cp => cp.s0));
    Object.assign(C, { mat, mesh, uRev, uThin, uThinT, s0, s1, d0: 0.04 * C.i });
  }

  // ------------------------------------------------------------------ membrane: two leaflets of lipid heads, a dim core between
  const memA = { value: 0 };
  let mem, haze;
  {
    const rr = K.rng(77), heads = [], fill = [], sp = 0.032;
    // how strongly lipids show at (x, z): none inside the complex, fainter right next to it (so the ring and
    // subunit a show through the bilayer) and towards the rim
    const lipid = (x, z) => {
      const r = Math.hypot(x, z);
      if (r > MR || r < 0.205) return 0;
      const phi = Math.atan2(-z, x), dp = Math.abs(((phi - PA) / D + 540) % 360 - 180);
      if (dp < 56 && r < 0.335) return 0;                                                   // subunit a
      if (Math.hypot(x - 0.355 * Math.cos(PA), z + 0.355 * Math.sin(PA)) < 0.06) return 0;  // b's helices
      return (1 - K.smooth((r - 0.55) / (MR - 0.55))) * (0.3 + 0.7 * K.smooth((r - 0.24) / 0.22));
    };
    for (const side of [1, -1]) for (let i = -30; i <= 30; i++) for (let j = -30; j <= 30; j++) {
      const x = (i + (j & 1) * 0.5) * sp + (rr() - 0.5) * 0.02, z = j * sp * 0.866 + (rr() - 0.5) * 0.02, w = lipid(x, z);
      if (w > 0) heads.push([x, YM + side * (0.093 + (rr() - 0.5) * 0.012), z, w, rr()]);
    }
    // the hydrophobic core between the leaflets: a sparse, dim, warm fill, so that from the side the bilayer
    // reads as one sheet rather than two bands with a gap
    for (let i = 0; i < 2600; i++) {
      const r = Math.sqrt(lerp(0.04, MR * MR, rr())), ph = rr() * TAU, x = r * Math.cos(ph), z = -r * Math.sin(ph), w = lipid(x, z);
      if (w > 0) fill.push([x, YM + (rr() * 2 - 1) * 0.07, z, w, rr()]);
    }
    const g = K.pointsGeo(heads.length + fill.length), A = g.attributes;
    heads.concat(fill).forEach((h, i) => {
      const core = i >= heads.length;
      A.position.array.set(h.slice(0, 3), 3 * i);
      A.aCol.array.set(core ? [0.66, 0.52, 0.36] : h[4] > 0.5 ? [0.84, 0.74, 0.52] : [0.76, 0.68, 0.54], 3 * i);
      A.aSize.array[i] = core ? 0.05 + 0.02 * h[4] : 0.03;
      A.aA.array[i] = (core ? 0.13 : 0.6) * h[3];
    });
    mem = new THREE.Points(g, K.points(set, { additive: false, uniforms: { uM: memA }, head: 'uniform float uM;', vertex: 'vA *= uM;' }));
    mem.renderOrder = 3;
    cx.add(mem);
  }

  // ------------------------------------------------------------------ protons and ATP
  // protons: a dim haze on both sides (more in the intermembrane space below), and the bright stream through
  // subunit a, which must stand out from it
  const hazeA = { value: 0 };
  {
    const rr = K.rng(9), n = 260, g = K.pointsGeo(n), mouth = az(0.3, PA + 12 * D, YM - 0.24);
    for (let i = 0; i < n; i++) {
      const low = i < 230, r = (low ? 0.15 : 0.36) + rr() * (low ? 0.68 : 0.46), ph = rr() * TAU;
      const p = az(r, ph, low ? YM - 0.15 - rr() * 0.33 : YM + 0.15 + rr() * 0.5);
      g.attributes.position.array.set(p, 3 * i);
      g.attributes.aCol.array.set([0.4, 0.68, 1], 3 * i);
      g.attributes.aSize.array[i] = 0.022;
      // dimmer still where the stream enters, under subunit a
      g.attributes.aA.array[i] = 0.3 * (1 - K.smooth((r - 0.6) / 0.25)) * (0.3 + 0.7 * K.smooth(v3.dist(p, mouth) / 0.3));
    }
    const m = K.points(set, { uniforms: { uF: hazeA }, head: 'uniform float uF;', vertex: `vA *= uF;
  vec3 q = pos + 0.025 * vec3(sin(uTime * 0.9 + pos.x * 41.0 + pos.y * 13.0), sin(uTime * 0.7 + pos.z * 37.0),
    sin(uTime * 0.8 + pos.y * 43.0 + pos.x * 7.0));
  mv = modelViewMatrix * vec4(q, 1.0); gl_Position = projectionMatrix * mv;` });
    haze = new THREE.Points(g, m);
    haze.renderOrder = 3;
    cx.add(haze);
  }
  // the stream: NPR protons, each a white-hot head with a fading trail of NTR points behind it (the same closed
  // form a little earlier on its path), then the ATP: 4 points each
  const NPR = 16, NTR = 3, NP = NPR * (1 + NTR), NATP = 6, TRD = 0.021, TRA = [1, 0.55, 0.32, 0.16], NM = NP + NATP * 4;
  const dynG = K.pointsGeo(NM + 2), dyn = new THREE.Points(dynG, K.points(set));
  dyn.frustumCulled = false; dyn.renderOrder = 4; cx.add(dyn);
  for (let k = 0; k <= NTR; k++) for (let i = 0; i < NPR; i++) {
    dynG.attributes.aCol.array.set(k ? [0.5, 0.9, 1] : [0.92, 1, 1], 3 * (k * NPR + i));
    dynG.attributes.aSize.array[k * NPR + i] = k ? 0.058 - 0.008 * k : 0.066;
  }
  for (let i = 0; i < NATP * 4; i++) dynG.attributes.aCol.array.set(i % 4 ? [1, 0.82, 0.4] : [1, 0.62, 0.16], 3 * (NP + i));
  // protons enter from the intermembrane side through a's lower half-channel and bind a c subunit at PIN, ride
  // the ring almost a full turn and leave through a's upper half-channel at POUT: 8 protons per turn
  const PIN = PA + 20 * D, POUT = PA - 20 * D, RIDE = 1 - 40 / 360, APP = 0.4, EXI = 0.32, RPR = 0.205;
  // the mouths of the two half-channels glow faintly while protons flow, and flash as each proton passes
  // (u at which a proton passes the mouth: into a from below, out of a at the top)
  const MOUTH = [[az(0.25, PA + 16 * D, YM - 0.17), -0.4 * APP], [az(0.275, POUT - 6 * D, YM + 0.17), RIDE + 0.4 * EXI]];
  MOUTH.forEach(([p], i) => {
    dynG.attributes.position.array.set(p, 3 * (NM + i)); dynG.attributes.aCol.array.set([0.45, 0.85, 1], 3 * (NM + i));
    dynG.attributes.aSize.array[NM + i] = 0.13;
  });
  const TAU0 = ((((PIN - CPHI(0) - 22.5 * D) / TAU) % 0.125) + 0.125) % 0.125;
  // ATP leaves each beta once per turn, when the bulge of the rotating central stalk faces it: 3 per turn
  const BETAS = COPIES.filter(cp => cp.beta), BBASE = BETAS.map(cp => ((((cp.phi - PG) / TAU) % 1) + 1) % 1);
  const hash = (m, k) => { const r = K.rng(m * 7919 + k * 104729 + 17); r(); return r(); };
  // proton m, u turns after it binds the ring (negative: still on its way in): [position, alpha] or null
  const proton = (m, u) => {
    if (u < -APP || u > RIDE + EXI) return null;
    if (u < 0) {
      const s = (u + APP) / APP, from = az(0.3 + 0.3 * hash(m, 1), PA + (hash(m, 2) * 100 - 40) * D, YM - 0.36 - 0.1 * hash(m, 5));
      return [bez(from, az(0.3, PA + 12 * D, YM - 0.24), az(RPR, PIN, YM), K.smooth(s)), K.smooth(s / 0.3)];
    }
    if (u < RIDE) return [az(RPR, PIN + TAU * u, YM + 0.006 * Math.sin(u * 40)), 1];
    const s = (u - RIDE) / EXI, h2 = hash(m, 4), to = az(0.38 + 0.18 * hash(m, 3), POUT - (10 + 40 * h2) * D, YM + 0.45 + 0.1 * h2);
    return [bez(az(RPR, POUT, YM), az(0.29, POUT - 4 * D, YM + 0.2), to, K.smooth(s)), 1 - K.smooth((s - 0.45) / 0.55)];
  };
  const ZERO = [0, 0, 0];
  function protons(T, flow) {
    const P = dynG.attributes.position.array, A = dynG.attributes.aA.array, SZ = dynG.attributes.aSize.array;
    let slot = 0;
    const m0 = Math.ceil((T - RIDE - EXI - TAU0) * 8), m1 = Math.floor((T + APP - TAU0) * 8);
    for (let m = m0; m <= m1 && slot < NPR; m++, slot++) {
      const u = T - (TAU0 + m / 8);
      for (let k = 0; k <= NTR; k++) {
        const q = proton(m, u - TRD * k), o = k * NPR + slot;
        P.set(q ? q[0] : ZERO, 3 * o);
        A[o] = q ? q[1] * flow * TRA[k] : 0;
      }
    }
    for (; slot < NPR; slot++) for (let k = 0; k <= NTR; k++) { P.set(ZERO, 3 * (k * NPR + slot)); A[k * NPR + slot] = 0; }
    // ATP: an adenosine dot with its three phosphates, drifting out into the matrix
    let n = 0;
    BETAS.forEach((cp, b) => {
      for (let k = Math.floor(T - BBASE[b]); k >= Math.ceil(T - BBASE[b] - 1.25) && n < NATP; k--) {
        const age = T - BBASE[b] - k, g = 1 - Math.pow(1 - Math.min(age, 1), 2), i0 = NP + 4 * n;
        const c = az(0.24 + 0.4 * g, cp.phi - (24 + 12 * age) * D, YH - 0.05 + 0.1 * g + 0.06 * age);
        const al = K.smooth(age / 0.04) * (1 - K.smooth((age - 0.8) / 0.45)) * flow;
        const w = age * 4 + k * 1.7 + b, dir = v3.norm([Math.cos(w), 0.6 * Math.sin(w * 0.7), Math.sin(w)]);
        P.set(c, 3 * i0); A[i0] = al; SZ[i0] = 0.065 * (1 + 1.6 * Math.exp(-age * 10));
        for (let q = 1; q < 4; q++) { P.set(v3.add(c, v3.mul(dir, 0.02 + 0.02 * q)), 3 * (i0 + q)); A[i0 + q] = al; SZ[i0 + q] = 0.03; }
        n++;
      }
    });
    for (; n < NATP; n++) for (let q = 0; q < 4; q++) { P.set(ZERO, 3 * (NP + 4 * n + q)); A[NP + 4 * n + q] = 0; }
    MOUTH.forEach(([p, u], i) => {
      const ph = ((((T - TAU0 - u) * 8) % 1) + 1) % 1;
      A[NM + i] = flow * (0.22 + 0.35 * Math.exp(-ph * 5));
    });
    dynG.attributes.position.needsUpdate = dynG.attributes.aA.needsUpdate = dynG.attributes.aSize.needsUpdate = true;
  }

  // ------------------------------------------------------------------ network of contacts (slide 15)
  const EDGES = ('ATP5A1-ATP5B ATP5A1-ATP5C1 ATP5B-ATP5C1 ATP5C1-ATP5D ATP5C1-ATP5E ATP5D-ATP5E ATP5C1-ATP5G1 ATP5E-ATP5G1 ' +
    'ATP5D-ATP5G2 ATP5G1-ATP5G2 ATP5G2-ATP5G3 ATP5G1-ATP5G3 ATP5G3-MT-ATP6 ATP5G2-MT-ATP6 MT-ATP6-ATP5F1 ' +
    'ATP5F1-ATP5O ATP5O-ATP5A1 ATP5O-ATP5B ATP5F1-ATP5A1 ATPAF1-ATP5B ATPAF2-ATP5A1').split(' ').map(e => {
    const a = SYM.find(s => e.startsWith(s + '-') && SYM.includes(e.slice(s.length + 1)));
    return [ci(a), ci(e.slice(a.length + 1))];
  });
  const centre = cp => cp.P1;
  // where each part's node sits (rest pose; rotor nodes turn with the rotor, c nodes stay at the front of the ring)
  const NODE = COMP.map(() => null);
  NODE[0] = v3.add(centre(ALPHA_F), v3.mul(er(ALPHA_F.phi), 0.05));
  NODE[1] = v3.add(centre(BETA_F), v3.mul(er(BETA_F.phi), 0.05));
  NODE[2] = v3.add(centre(AF1), v3.mul(AF1.drift, 0.45));
  NODE[3] = v3.add(centre(AF2), v3.mul(AF2.drift, 0.45));
  NODE[4] = az(0.05, PG, -0.1); NODE[5] = centre(DL); NODE[6] = centre(EP);
  NODE[7] = az(0.36, PA - 2 * D, -0.1); NODE[8] = centre(OS); NODE[9] = az(0.27, PA, YM);
  NODE[10] = az(0.2, -122 * D, YM + 0.02); NODE[11] = az(0.2, -90 * D, YM - 0.03); NODE[12] = az(0.2, -58 * D, YM + 0.02);
  const ROTN = [4, 5, 6], HOME = [0, -OY / Z, 0];
  // nodes and edges draw without depth test and after everything else in the set (surface 2, membrane and
  // haze 3, protons 4), so they sit on top of the ghost and fade in evenly with atp_net
  const netA = { value: 0 }, netOpts = { uniforms: { uN: netA }, head: 'uniform float uN;', vertex: 'vA *= uN;' };
  const npG = K.pointsGeo(26 + 42), npM = K.points(set, netOpts), NA = npG.attributes;
  npM.depthTest = false;
  for (let i = 0; i < 13; i++) {
    NA.aCol.array.set([0.3, 0.58, 1], 6 * i); NA.aSize.array[2 * i] = 0.085; NA.aA.array[2 * i] = 0.95;
    NA.aCol.array.set([0.85, 0.93, 1], 6 * i + 3); NA.aSize.array[2 * i + 1] = 0.03;
  }
  for (let i = 26; i < 68; i++) { NA.aCol.array.set([0.6, 0.8, 1], 3 * i); NA.aSize.array[i] = 0.026; }
  const netPts = new THREE.Points(npG, npM);
  netPts.frustumCulled = false;
  const elG = K.linesGeo(21), elM = K.lines(set, netOpts);
  elM.depthTest = false;
  for (let i = 0; i < 21; i++) {
    elG.attributes.aCol.array.set([0.36, 0.62, 1, 0.36, 0.62, 1], 6 * i); elG.attributes.aA.array.set([0.85, 0.85], 2 * i);
  }
  const netLines = new THREE.LineSegments(elG, elM);
  netLines.frustumCulled = false;
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uN: netA, uC: { value: C3('#4d94ff') } },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN, vV;
void main() {
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform float uA, uN; uniform vec3 uC; varying vec3 vN, vV;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV))); f *= f;
  gl_FragColor = vec4(uC * (0.5 + 0.8 * f), uA * uN * 0.55 * f);
}`,
  });
  set.mats.push(glowMat);
  const glow = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), glowMat, 21);
  glow.frustumCulled = false;
  netLines.renderOrder = glow.renderOrder = netPts.renderOrder = 6;
  cx.add(netLines, glow, netPts);

  // ------------------------------------------------------------------ update
  const cur = { build: 0, net: 0, shrink: 0, ang: 0, f: COMP.map(() => 0) };
  const nodePos = i => {
    let p = ROTN.includes(i) ? rotY(NODE[i], cur.ang) : NODE[i];
    return v3.lerp(p, HOME, prog(cur.shrink, 0, 0.8));
  };
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Qa = new THREE.Quaternion(), Qs = new THREE.Quaternion();
  const YAX = new THREE.Vector3(0, 1, 0), PV = new THREE.Vector3(), SV = new THREE.Vector3();
  function update(S, t) {
    const parts = S.atp_parts, colour = S.atp_colour, build = S.atp_build, turns = S.atp_turns, flow = S.atp_flow;
    const net = S.atp_net, shrink = S.atp_shrink, ang = TAU * turns;
    Object.assign(cur, { build, net, shrink, ang });
    // chains: draw themselves in the grid, float, fly to their places, thin away as the surface grows
    for (const C of COMP) {
      const rev = Math.max(prog(parts, C.d0, C.d0 + 0.45), prog(build, 0, 0.06)), thin = prog(build, C.s1 + 0.32, C.s1 + 0.6);
      cur.f[C.i] = prog(build, C.s0, C.s0 + 0.32);
      // (hidden once thinned to an eighth of its radius: sub-pixel, and under the surface by then)
      C.mesh.visible = rev > 0.002 && thin < 0.88;
      if (!C.mesh.visible) continue;
      // thinning by exactly the tube radius collapses a ring to its centre line (zero-area triangles, nothing drawn)
      C.uRev.value = rev * 1.01; C.uThin.value = thin * C.tubeR;
      C.uThinT.value = prog(build, C.s1 + 0.24, C.s1 + 0.42) * C.tubeR;
      C.mat.color.copy(GREY).lerp(C.gcol, colour).lerp(C.ccol, 0.85 * cur.f[C.i]);
      const n = build > 0 ? C.copies.length : 1;
      C.mesh.count = n;
      for (let k = 0; k < n; k++) {
        const cp = C.copies[k], f = prog(build, cp.s0, cp.s0 + 0.32), fl = 1 - f;
        const sw = Math.sin(t * 0.4 + C.i * 1.3) * 0.35 * fl, bob = Math.sin(t * 0.7 + C.i) * 0.012 * fl;
        const P0 = v3.add(C.p0, [0, bob, 0]), P1 = toSet(cp.rotor ? rotY(cp.P1, ang) : cp.P1);
        const ctrl = v3.add(v3.lerp(P0, P1, 0.5), [(k - (n - 1) / 2) * 0.3, 0.18, 0.5]);
        PV.set(...bez(P0, ctrl, P1, f));
        Qs.setFromAxisAngle(YAX, sw).multiply(C.q0);
        Q.copy(cp.q1);
        if (cp.rotor) Q.premultiply(Qa.setFromAxisAngle(YAX, ang));
        Qs.slerp(Q, f);
        SV.setScalar(lerp(1, Z * cp.s1, f) * (0.8 + 0.2 * rev));
        C.mesh.setMatrixAt(k, M4.compose(PV, Qs, SV));
      }
      C.mesh.instanceMatrix.needsUpdate = true;
    }
    // surface: grows from the docked chains; beta subunits breathe as the rotor's bulge passes; helpers leave
    // (only the spheres that have started growing are drawn)
    const a = set.uA.value, ns = started(build - 0.0001);
    const sOp = (1 - 0.86 * net) * (1 - prog(shrink, 0, 0.12)) * (1 - net * (1 - prog(a, 0.7, 1)));
    sg.instanceCount = pg.instanceCount = Math.max(1, ns);
    sph.visible = ns > 0 && sOp > 0.002;
    sphMat.opacity = a * sOp;
    sphMat.depthWrite = sphMat.opacity > 0.97;
    pre.visible = sph.visible && sOp < 0.97 && shrink < 0.12 && a > 0.7;
    SU.uBuild.value = build; SU.uColour.value = colour; SU.uAng.value = ang;
    SU.uRim.value = 0.32 + 0.4 * net;
    for (const cp of BETAS) {
      const o = Math.pow(Math.max(0, Math.cos(PG + ang - cp.phi)), 3);
      SU.uCp.value[cp.i].set(...v3.mul(er(cp.phi - 25 * D), 0.018 * o), 1);
    }
    for (const cp of [AF1, AF2]) {
      const d = prog(build, 0.7, 0.96);
      SU.uCp.value[cp.i].set(...v3.mul(cp.drift, d), 1 - prog(build, 0.78, 0.99));
    }
    // membrane, protons, ATP
    memA.value = prog(build, 0.5, 0.92) * (1 - 0.9 * net) * (1 - prog(shrink, 0, 0.45));
    mem.visible = memA.value > 0.002;
    hazeA.value = flow * (1 - net);
    haze.visible = hazeA.value > 0.002;
    dyn.visible = flow * (1 - net) > 0.002 && build > 0.5;
    if (dyn.visible) protons(turns, flow * (1 - net) * prog(build, 0.85, 1));
    // network
    netA.value = net * (1 - prog(shrink, 0.35, 0.7));
    netPts.visible = netLines.visible = glow.visible = netA.value > 0.002;
    if (netPts.visible) {
      const P = npG.attributes.position.array, E = elG.attributes.position.array, A = npG.attributes.aA.array;
      const nodes = COMP.map((c, i) => nodePos(i)), hot = 1 + 0.8 * prog(shrink, 0.4, 0.9);
      nodes.forEach((p, i) => { P.set(p, 6 * i); P.set(p, 6 * i + 3); A[2 * i + 1] = Math.min(1, 0.9 * hot); });
      EDGES.forEach(([a, b], i) => {
        const pa = nodes[a], pb = nodes[b], l = v3.dist(pa, pb);
        E.set([...pa, ...pb], 6 * i);
        PV.set(...v3.lerp(pa, pb, 0.5));
        Q.setFromUnitVectors(YAX, _v.set(...v3.sub(pb, pa)).normalize());
        glow.setMatrixAt(i, M4.compose(PV, Q, SV.set(0.011, Math.max(l, 1e-4), 0.011)));
        for (let h = 0; h < 2; h++) {
          const u = (t * 0.32 + i * 0.137 + h * 0.5) % 1, k = 26 + 2 * i + h;
          P.set(v3.lerp(pa, pb, u), 3 * k); A[k] = Math.sin(Math.PI * u) * 0.8 * (1 - prog(shrink, 0, 0.5));
        }
      });
      npG.attributes.position.needsUpdate = npG.attributes.aA.needsUpdate = elG.attributes.position.needsUpdate = true;
      glow.instanceMatrix.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ anchors, labels, views, explore
  // a part's anchor: above its chain in the grid, then on its node in the complex
  const partAt = i => () => {
    const c = toSet(nodePos(i)), g = COMP[i].label;
    return v3.lerp(g, c, Math.max(cur.f[i], prog(cur.build, 0, 0.3)));
  };
  const anchors = {
    head: toSet(az(0.27, -150 * D, YH + 0.1)), rotor: toSet(az(0.21, -150 * D, YM + 0.06)),
    membrane: toSet(az(0.72, -165 * D, YM)), stalk: toSet(az(0.36, PA - 3 * D, -0.05)), shaft: toSet(az(0.07, -90 * D, -0.15)),
    ring: toSet(az(0.2, -90 * D, YM)), matrix: toSet(az(0.62, -140 * D, YH)), ims: toSet(az(0.55, -135 * D, YM - 0.22)),
    atpOut: toSet(az(0.5, BETA_F.phi - 32 * D, YH + 0.1)), protonsIn: toSet(az(0.36, PIN, YM - 0.25)), centre: [0, 0, 0],
  };
  COMP.forEach((c, i) => { anchors[c.s] = partAt(i); });
  const built = S => K.prog(S.atp_build, 0.86, 1) * (1 - S.atp_net);
  const labels = COMP.map(c => ({ text: [c.s, c.role], at: c.s, cls: '', alpha: S => S.atp_parts * (1 - K.prog(S.atp_build, 0, 0.1)) }))
    .concat([
      { text: ['Head', '(makes ATP)'], at: 'head', cls: 'cyn', alpha: built },
      { text: ['Rotor', ''], at: 'rotor', cls: 'mag', alpha: built },
      { text: ['Membrane', ''], at: 'membrane', cls: '', alpha: built },
      { text: ['Protons', 'flow in'], at: 'protonsIn', cls: 'cyn', alpha: S => K.prog(S.atp_flow, 0.5, 1) * built(S) },
      { text: ['ATP', 'out'], at: 'atpOut', cls: 'amb', alpha: S => K.prog(S.atp_flow, 0.5, 1) * built(S) },
    ]);
  // explore: while running the rotor keeps turning from wherever it was; on leaving it coasts a little and
  // stops (rather than easing back to 0, which would spin it backwards). Only this mapping keeps memory;
  // update() itself stays a pure function of the params. The base angle is taken from the first update()
  // after a change of view (or a reopening): until then S0 may be stale (the set was not drawn while the
  // story or another scene changed atp_turns), so the target simply holds the last known angle.
  const S0 = { turns: 0, fresh: false };
  let base = 0, lastView = '', lastT = 0, coast = 0, pending = true;
  function explore(c) {
    const v = c.view;
    if (v !== lastView || c.t < lastT) { coast = lastView === 'running' ? 0.1 : 0; pending = true; S0.fresh = false; }
    if (pending && S0.fresh) { base = S0.turns; pending = false; }
    lastView = v; lastT = c.t;
    return {
      atp_parts: 1, atp_colour: 1, atp_build: v === 'parts' ? 0 : 1, atp_flow: v === 'running' ? 1 : 0,
      atp_turns: pending ? S0.turns : v === 'running' ? base + c.t * 0.35 : base + coast,
      atp_net: v === 'network' ? 1 : 0, atp_shrink: 0,
    };
  }
  const upd = (S, t, dt) => { S0.turns = S.atp_turns; S0.fresh = true; update(S, t, dt); };
  // for panel text and explore: the parts with their current HGNC symbols, what they are and how many copies
  const INFO = {
    ATP5A1: ['ATP5F1A', 'subunit alpha (head)'], ATP5B: ['ATP5F1B', 'subunit beta (head, makes ATP)'],
    ATPAF1: ['ATPAF1', 'assembly factor, binds beta'], ATPAF2: ['ATPAF2', 'assembly factor, binds alpha'],
    ATP5C1: ['ATP5F1C', 'subunit gamma (central stalk)'], ATP5D: ['ATP5F1D', 'subunit delta (central stalk)'],
    ATP5E: ['ATP5F1E', 'subunit epsilon (central stalk)'], ATP5F1: ['ATP5PB', 'subunit b (peripheral stalk)'],
    ATP5O: ['ATP5PO', 'OSCP (caps the peripheral stalk)'], 'MT-ATP6': ['MT-ATP6', 'subunit a (mitochondrial DNA)'],
    ATP5G1: ['ATP5MC1', 'subunit c (rotor ring)'], ATP5G2: ['ATP5MC2', 'subunit c (rotor ring)'],
    ATP5G3: ['ATP5MC3', 'subunit c (rotor ring)'],
  };
  const parts = COMP.map(c => ({ sym: c.s, hgnc: INFO[c.s][0], name: INFO[c.s][1], copies: c.copies.length }));
  return Object.assign(set, {
    parts, contacts: EDGES.map(([a, b]) => [SYM[a], SYM[b]]),
    params: { atp_a: 1, atp_parts: 1, atp_colour: 0, atp_build: 0, atp_turns: 0, atp_flow: 0, atp_net: 0, atp_shrink: 0 },
    update: upd, anchors, labels,
    cam: {
      default: [0, 4, 3.5, 0, 0, 0], parts: [0, 4, 3.5, 0, 0, 0], complex: [-10, -8, 2.9, 0, 0.02, 0],
      top: [-25, 40, 2.8, 0, -0.05, 0], running: [-28, -4, 2.4, 0, -0.12, 0], network: [15, 8, 2.9, 0, 0.02, 0],
    },
    controls: [{
      key: 'view', label: 'View', options: [['parts', 'Parts'], ['complex', 'Complex'], ['running', 'Running'], ['network', 'Network']],
    }],
    explore,
  });
};
