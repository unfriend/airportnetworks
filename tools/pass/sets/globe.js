// The airports story's globe (stories/airports.js: its land, 3,214 airports, 18,858 routes, pillars and look, cut out
// of that story at build time as PASS_AIRPORTS and built by its own buildScene, unchanged) behind the set contract,
// and an outbreak on its route network: a seeded discrete-time model in which every city (airport) is susceptible,
// exposed, infectious or recovered (S, E, I, R). Each day a susceptible city is reached over a route from each of its
// infectious neighbours with a chance set by the spread and the share of flights kept; it is exposed for its
// incubation time, infectious for a while, then recovered. The same start and settings always give the same
// outbreak (every chance comes from a hash of the seed, the city and the day). A simple model, not a forecast.
// Radius 1, centred on the origin, as in the airports story (y up, lon 0 towards +x, lon 90 E towards -z).
SETS.globe = function (K) {
  const { THREE, clamp, smooth } = K;
  const set = K.newSet('globe');
  let LANG = 'en';
  const T = (en, de) => (LANG === 'de' ? de : en);

  // ---------------------------------------------------------------- the original, built as in its own story
  // (its renderer stands in for the engine's, which owns the canvas: the original only asks it how big a land texture
  // the GPU takes; its stars go into a scene of their own that is never drawn, the engine has its own)
  const caps = K.renderer ? K.renderer.capabilities : { maxTextureSize: 4096, getMaxAnisotropy: () => 4 };
  const O = PASS_AIRPORTS({ makeRenderer: () => ({ xr: {}, setPixelRatio() {}, capabilities: caps }) });
  O.buildScene(null);
  const G = O.GL, NET = O.NET, { N, P, deg, maxDeg, adjS, adj } = NET;
  set.group.add(G.world);
  // every shader of the original fades with the set: its alpha times the set's fade, appended to its fragment shader
  // before it is first compiled (the original's own code stays as it is)
  const faded = new WeakSet();
  function fadeMat(m) {
    if (!m || !m.isShaderMaterial || faded.has(m)) return;
    faded.add(m);
    m.uniforms.uSetA = set.uA;
    m.fragmentShader = 'uniform float uSetA;\n' + m.fragmentShader.replace(/\}\s*$/, '  gl_FragColor.a *= uSetA;\n}\n');
    m.transparent = true;   // (the globe itself was opaque: now it fades too, drawn first of the set's see-through parts)
  }
  G.world.traverse(o => fadeMat(o.material));
  const highlight = (key, pairs, color, opts) => { const m = O.setHighlight(key, pairs, color, opts); if (m) fadeMat(m.material); return m; };

  // the original's updateLight, for this set: the light from over the viewer's left shoulder (on a screen it turns
  // with the camera; in a headset it stays put in the room, with the rig), and the dots' size (on a screen it follows
  // the camera's distance; in a headset they keep their size on the globe). Run just before the set is drawn, for
  // each eye, so it needs nothing from the engine.
  const LV = new THREE.Vector3(), _q = new THREE.Quaternion(), _c = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
  function look(renderer, cam) {
    const xr = !!(renderer.xr && renderer.xr.isPresenting), mw = G.world.matrixWorld, s = _s.setFromMatrixScale(mw).x;
    G.atmMat.uniforms.uCenter.value.setFromMatrixPosition(mw);
    G.atmMat.uniforms.uRadius.value = s;
    const rig = set.group.parent && set.group.parent.parent;   // (the engine's GL.rig > GL.world > this set)
    if (xr && rig) rig.getWorldQuaternion(_q); else cam.getWorldQuaternion(_q);
    LV.set(-0.55, 0.42, 1.0).normalize().applyQuaternion(_q);
    G.globeMat.uniforms.uL.value.copy(LV);
    if (xr) { G.U.uScale.value = 1; G.U.uPx.value = 0.0028 * K.U.uPx.value * set.group.scale.x; return; }
    G.U.uPx.value = 0;
    _c.setFromMatrixPosition(cam.matrixWorld).applyMatrix4(_m.copy(mw).invert());
    G.U.uScale.value = renderer.getPixelRatio() * clamp(3.6 / Math.max(_c.length(), 1e-3), 0.75, 2.4);
  }
  const probe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  probe.frustumCulled = false; probe.renderOrder = -100;
  probe.onBeforeRender = (renderer, scene, cam) => look(renderer, cam);
  set.group.add(probe);

  // ---------------------------------------------------------------- the outbreak
  const NEVER = 1e6, MAXDAY = 730;
  const tE = new Float32Array(N), tI = new Float32Array(N), tR = new Float32Array(N), src = new Int32Array(N);
  const OB = { start: -1, inc: 5, inf: 7, spread: 'medium', kept: 1, seed: 1, end: 0, series: null, key: '' };
  const SPREAD = { low: 0.025, medium: 0.06, high: 0.14 };   // chance per day that an infectious city passes it to one neighbour
  // a number in [0, 1) for (a, b, c), the same on every device
  const hash = (a, b, c) => {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x1b873593, 0x27d4eb2f);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };
  function run() {
    tE.fill(NEVER); tI.fill(NEVER); tR.fill(NEVER); src.fill(-1);
    OB.end = 0;
    const s0 = OB.start;
    if (s0 < 0) { OB.series = { S: [N], E: [0], I: [0], R: [0] }; return; }
    const p = SPREAD[OB.spread] * clamp(OB.kept, 0, 1), sd = OB.seed | 0;
    const dur = (j, base, k) => Math.max(1, Math.round(base * (0.7 + 0.6 * hash(sd, j, k))));   // a little different in every city
    const expose = (j, d, from) => { tE[j] = d; tI[j] = d + dur(j, OB.inc, 1); tR[j] = tI[j] + dur(j, OB.inf, 2); src[j] = from; };
    expose(s0, 0, -1);
    const cnt = new Int32Array(N), best = new Float32Array(N), bestFrom = new Int32Array(N), touched = [];
    let active = [s0];   // exposed or infectious
    for (let d = 0; d < MAXDAY && active.length; d++) {
      // every infectious city tries each susceptible neighbour (one draw per city and day for all its infectious neighbours)
      for (const i of active) {
        if (!(tI[i] <= d && d < tR[i])) continue;
        for (let k = adjS[i]; k < adjS[i + 1]; k++) {
          const j = adj[k];
          if (tE[j] !== NEVER) continue;
          if (!cnt[j]) { touched.push(j); best[j] = -1; }
          cnt[j]++;
          const w = hash(sd, i * 7919 + j, d);   // which neighbour it came from, if it comes
          if (w > best[j]) { best[j] = w; bestFrom[j] = i; }
        }
      }
      for (const j of touched) {
        if (hash(sd + 101, j, d) < 1 - Math.pow(1 - p, cnt[j])) { expose(j, d + 1, bestFrom[j]); active.push(j); }
        cnt[j] = 0;
      }
      touched.length = 0;
      active = active.filter(i => tR[i] > d + 1);
      OB.end = d + 1;
    }
    for (let i = 0; i < N; i++) if (tR[i] < NEVER) OB.end = Math.max(OB.end, tR[i]);
    // the chart's series: cities in each state, day by day
    const S = [], E = [], I = [], R = [];
    for (let d = 0; d <= OB.end; d++) {
      let e = 0, ii = 0, r = 0;
      for (let j = 0; j < N; j++) { if (tE[j] > d) continue; if (tI[j] > d) e++; else if (tR[j] > d) ii++; else r++; }
      S.push(N - e - ii - r); E.push(e); I.push(ii); R.push(r);
    }
    OB.series = { S, E, I, R };
  }

  // drawn on the airports: exposed amber, infectious red (with a flash as they turn), recovered grey; susceptible ones
  // show the original's own dots. Sizes and the pillars' heights follow the original's (its uniforms are shared).
  const og = new THREE.BufferGeometry(), op = new Float32Array(N * 3);
  for (let i = 0; i < 3 * N; i++) op[i] = P[i] * (1 + O.LIFT + 0.0016);
  og.setAttribute('position', new THREE.BufferAttribute(op, 3));
  const aE = new THREE.BufferAttribute(tE, 1), aI = new THREE.BufferAttribute(tI, 1), aR = new THREE.BufferAttribute(tR, 1);
  og.setAttribute('aE', aE); og.setAttribute('aI', aI); og.setAttribute('aR', aR);
  og.setAttribute('aSize', new THREE.BufferAttribute(G.attr.aSize, 1)); og.setAttribute('aHDeg', new THREE.BufferAttribute(G.attr.aHDeg, 1));
  og.setAttribute('aIdx', new THREE.BufferAttribute(G.attr.aIdx, 1));
  const OU = { uDay: { value: 0 }, uOut: { value: 0 }, uSel: { value: -1 } };
  const outMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime, uScale: G.U.uScale, uPx: G.U.uPx, uDegH: G.U.uDegH }, OU),
    transparent: true, depthWrite: false,
    vertexShader: `attribute float aE, aI, aR, aSize, aHDeg, aIdx;
uniform float uDay, uOut, uScale, uPx, uDegH, uA, uTime, uSel;
varying vec3 vCol; varying float vA, vRing, vE;
void main() {
  vec4 mv = modelViewMatrix * vec4(position * (1.0 + aHDeg * uDegH), 1.0);
  gl_Position = projectionMatrix * mv;
  float e = smoothstep(aE, aE + 0.6, uDay), i = smoothstep(aI, aI + 0.4, uDay), r = smoothstep(aR, aR + 3.0, uDay);
  vec3 col = mix(mix(vec3(1.0, 0.71, 0.23), vec3(1.0, 0.27, 0.2), i), vec3(0.5, 0.55, 0.63), r);
  float flash = i * (1.0 - smoothstep(aI + 0.4, aI + 2.5, uDay));       // a flash as a city turns infectious
  float pulse = i * (1.0 - r) * (0.5 + 0.5 * sin(uTime * 5.0 + aIdx));
  vCol = col * (1.0 + 0.9 * flash);
  vRing = 1.0 - step(0.5, abs(aIdx - uSel)); vE = e;
  vA = uOut * uA * max(e * (1.0 - 0.4 * r), vRing);
  float att = uPx > 0.0 ? uPx * projectionMatrix[1][1] / max(-mv.z, 0.05) : 1.0;
  float sz = (aSize * (1.15 + 0.35 * pulse + 1.2 * flash) * (1.0 - 0.3 * r) + 1.5) * (1.0 + vRing * 1.4);
  gl_PointSize = max(sz * uScale * att, uPx > 0.0 ? 1.6 : 0.0);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vCol; varying float vA, vRing, vE;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.30, d) * step(0.001, vE);   // (a selected city not reached yet: only its ring)
  float ring = vRing * smoothstep(0.5, 0.44, d) * (1.0 - smoothstep(0.38, 0.30, d));
  gl_FragColor = vec4(mix(vCol, vec3(0.6, 0.95, 1.0) * 1.6, ring), vA * max(core, ring));
}`,
  });
  set.mats.push(outMat);
  const outDots = new THREE.Points(og, outMat);
  outDots.renderOrder = 3; outDots.frustumCulled = false;
  set.group.add(outDots);

  // and on the routes as it travels: from the city it came from, over the day before it arrives; a faint trace stays
  const arcMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, OU), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aT, aD0;
uniform float uDay, uOut, uA;
varying float vA, vH;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float g = (uDay - aD0) / 1.2;                                   // (a flight takes about a day)
  float head = (1.0 - smoothstep(0.0, 0.2, g - aT)) * step(g, 1.25);
  float trail = 0.3 * exp(-max(0.0, uDay - aD0 - 1.2) * 0.22);
  vH = head;
  vA = uOut * uA * step(0.0, g) * step(aT, g) * clamp(head + trail, 0.0, 1.0);
}`,
    fragmentShader: `varying float vA, vH;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(mix(vec3(1.0, 0.42, 0.22), vec3(1.0, 0.86, 0.55), vH), vA); }`,
  });
  set.mats.push(arcMat);
  const arcs = new THREE.LineSegments(new THREE.BufferGeometry(), arcMat);
  arcs.renderOrder = 4; arcs.frustumCulled = false;
  set.group.add(arcs);
  function buildArcs() {
    const list = [];
    let tot = 0, segs = 0;
    for (let j = 0; j < N; j++) if (src[j] >= 0) { const a = O.arcPoints(src[j], j, 2.5, 0.0008); list.push([j, a]); tot += a.length / 3; segs += a.length / 3 - 1; }
    const pos = new Float32Array(tot * 3), at = new Float32Array(tot), d0 = new Float32Array(tot), idx = new Uint32Array(segs * 2);
    let o = 0, io = 0;
    for (const [j, a] of list) {
      const m = a.length / 3;
      pos.set(a, o * 3);
      for (let k = 0; k < m; k++) { at[o + k] = k / (m - 1); d0[o + k] = tE[j] - 1.2; if (k < m - 1) { idx[io++] = o + k; idx[io++] = o + k + 1; } }
      o += m;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aT', new THREE.BufferAttribute(at, 1)); g.setAttribute('aD0', new THREE.BufferAttribute(d0, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    arcs.geometry.dispose(); arcs.geometry = g;
  }
  // the way it took to the selected city, as a glowing tube that grows day by day (the original's highlight)
  let SEL = -1, CHAIN = null;
  function chainTo(i) {
    if (i < 0 || tE[i] === NEVER) return null;
    const c = [i];
    while (src[c[c.length - 1]] >= 0) c.push(src[c[c.length - 1]]);
    return c.reverse();
  }
  function setChain() {
    CHAIN = chainTo(SEL);
    highlight('chain', CHAIN && CHAIN.length > 1 ? CHAIN.slice(0, -1).map((c, k) => [c, CHAIN[k + 1]]) : null, [1.0, 0.78, 0.36],
      { radius: 0.0022, hops: CHAIN ? CHAIN.slice(1).map((_, k) => k + 1) : null });
  }
  function setup(o) {
    const nx = Object.assign({}, OB, o || {});
    nx.inc = clamp(Math.round(nx.inc), 1, 21); nx.inf = clamp(Math.round(nx.inf), 1, 30); nx.kept = clamp(nx.kept, 0, 1);
    if (!SPREAD[nx.spread]) nx.spread = 'medium';
    const k = [nx.start, nx.inc, nx.inf, nx.spread, nx.kept.toFixed(3), nx.seed].join('|');
    Object.assign(OB, nx);
    if (k === OB.key) return summary();
    OB.key = k;
    run();
    aE.needsUpdate = aI.needsUpdate = aR.needsUpdate = true;
    buildArcs(); setChain();
    return summary();
  }
  const reached = () => { let n = 0; for (let j = 0; j < N; j++) if (tE[j] < NEVER) n++; return n; };
  const summary = () => ({ start: OB.start, end: OB.end, reached: reached(), peak: OB.series.I.reduce((b, v, d) => (v > OB.series.I[b] ? d : b), 0) });
  const countAt = d => { const s = OB.series, k = clamp(Math.floor(d), 0, s.S.length - 1); return { S: s.S[k], E: s.E[k], I: s.I[k], R: s.R[k] }; };

  // ---------------------------------------------------------------- picking, places
  const lift = i => 1 + O.LIFT + G.attr.aHDeg[i] * G.U.uDegH.value;
  const pos = (i, up) => { const r = lift(i) + (up || 0); return [P[3 * i] * r, P[3 * i + 1] * r, P[3 * i + 2] * r]; };
  // the airport nearest a ray (a THREE.Raycaster, in world coordinates): the original's pickAirportRay, in this set's frame
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _inv = new THREE.Matrix4();
  function pick(ray) {
    set.group.updateWorldMatrix(true, true);
    _inv.copy(G.world.matrixWorld).invert();
    const o = _o.copy(ray.ray.origin).applyMatrix4(_inv), d = _d.copy(ray.ray.direction).transformDirection(_inv);
    let best = -1, bs = Infinity;
    for (let i = 0; i < N; i++) {
      const px = P[3 * i], py = P[3 * i + 1], pz = P[3 * i + 2];
      if (px * o.x + py * o.y + pz * o.z < 1.0) continue;   // the far side
      const r = lift(i), vx = px * r - o.x, vy = py * r - o.y, vz = pz * r - o.z, t = vx * d.x + vy * d.y + vz * d.z;
      if (t <= 0) continue;
      const ang = Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - t * t)) / t;
      if (ang > 0.026) continue;
      const sc = ang - 0.008 * Math.sqrt(deg[i] / maxDeg);
      if (sc < bs) { bs = sc; best = i; }
    }
    return best;
  }
  const find = code => { const i = O.A(String(code || '').toUpperCase()); return i === undefined ? -1 : i; };
  const info = i => (i < 0 ? null : { i, code: NET.code[i], city: city(i), country: NET.country[i], name: NET.name[i], routes: deg[i],
    lat: NET.lat[i], lon: NET.lon[i], exposed: tE[i] < NEVER ? tE[i] : null, infectious: tI[i] < NEVER ? tI[i] : null, recovered: tR[i] < NEVER ? tR[i] : null,
    from: src[i] >= 0 ? src[i] : null });
  // a view [az, el, dist, 0, 0, 0] that faces the point at (lat, lon)
  const viewOf = (lat, lon, dist, dlat, dlon) => [90 + lon + (dlon || 0), clamp(lat + (dlat || 0), -70, 75), dist, 0, 0, 0];

  // ---------------------------------------------------------------- params, update
  const params = { globe_a: 1, globe_reveal: 1, globe_routes: 1, globe_hubs: 0, globe_pillars: 0, globe_dim: 0, globe_out: 0, globe_day: 0 };
  function update(S) {
    const U = G.U, RU = G.RU, rv = clamp(S.globe_reveal, 0, 1), dim = clamp(S.globe_dim, 0, 1);
    U.uReveal.value = rv; RU.uReveal.value = rv;
    U.uWDeg.value = clamp(S.globe_hubs, 0, 1); U.uDegH.value = clamp(S.globe_pillars, 0, 1);
    U.uAlpha.value = 1 - 0.55 * dim;
    RU.uAlpha.value = 0.2 * clamp(S.globe_routes, 0, 1) * (1 - 0.7 * dim);
    U.uSel.value = SEL;
    G.pillars.visible = S.globe_pillars > 0.002;
    const out = clamp(S.globe_out, 0, 1), day = Math.max(0, S.globe_day);
    OU.uOut.value = OB.start >= 0 ? out : 0; OU.uDay.value = day; OU.uSel.value = SEL;
    outDots.visible = arcs.visible = OU.uOut.value > 0.003;
    const ch = G.highlights.chain;
    if (ch) {
      let n = 0; if (CHAIN) for (let k = 1; k < CHAIN.length; k++) if (tE[CHAIN[k]] <= day) n = k;
      ch.material.uniforms.uProg.value = n + (CHAIN && n < CHAIN.length - 1 ? clamp((day - (tE[CHAIN[n + 1]] - 1.2)) / 1.2, 0, 1) : 0);
      ch.material.uniforms.uAlpha.value = 0.9 * OU.uOut.value; ch.visible = OU.uOut.value > 0.003 && ch.material.uniforms.uProg.value > 0.001;
    }
    DAY = day;
  }
  let DAY = 0;

  // ---------------------------------------------------------------- anchors, labels, views, controls
  const HUBS = ['VIE', 'LHR', 'FRA', 'CDG', 'IST', 'DXB', 'JFK', 'ATL', 'PEK', 'SIN', 'JNB', 'GRU', 'SYD'];
  // (top: north of the start city, a little off the globe, for the day counter: above it in a view that faces it;
  // start, sel: on the cities themselves)
  const north = i => { const la = Math.min(80, NET.lat[i] + 13) * Math.PI / 180, lo = NET.lon[i] * Math.PI / 180, r = 1.08;
    return [Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r]; };
  const anchors = { top: () => (OB.start >= 0 ? north(OB.start) : [0, 1.25, 0]), start: () => (OB.start >= 0 ? pos(OB.start, 0.02) : [0, 1.1, 0]), sel: () => (SEL >= 0 ? pos(SEL, 0.02) : [0, 1.1, 0]) };
  for (const c of HUBS) { const i = find(c); if (i >= 0) anchors[c] = pos(i, 0.02); }
  const num = n => Math.round(n).toLocaleString(LANG === 'de' ? 'de-DE' : 'en-GB');
  // city names as German says them, for the cities a story or a class is most likely to pick (the data's are English)
  const CITY_DE = { Vienna: 'Wien', Munich: 'München', Cologne: 'Köln', Rome: 'Rom', Milan: 'Mailand', Prague: 'Prag', Warsaw: 'Warschau',
    Moscow: 'Moskau', Brussels: 'Brüssel', Copenhagen: 'Kopenhagen', Lisbon: 'Lissabon', Athens: 'Athen', Venice: 'Venedig', Naples: 'Neapel',
    Belgrade: 'Belgrad', Bucharest: 'Bukarest', Kiev: 'Kiew', Beijing: 'Peking', Cairo: 'Kairo', Tokyo: 'Tokio', Geneva: 'Genf', Zurich: 'Zürich',
    Florence: 'Florenz', 'Mexico City': 'Mexiko-Stadt', Singapore: 'Singapur', 'Cape Town': 'Kapstadt', Krakow: 'Krakau', 'St. Petersburg': 'Sankt Petersburg',
    Delhi: 'Delhi', Bangkok: 'Bangkok', Havana: 'Havanna', Tunis: 'Tunis', Tehran: 'Teheran', Bratislava: 'Bratislava', Ljubljana: 'Ljubljana' };
  // (and a few of the data's names that lost their accents or came in the local form, as English says them)
  const CITY_FIX = { 'Sao Paulo': 'São Paulo', Bogota: 'Bogotá', Brasilia: 'Brasília', Duesseldorf: 'Düsseldorf', Malaga: 'Málaga', Cancun: 'Cancún',
    Milano: 'Milan' };
  const city = i => { const c = CITY_FIX[NET.city[i]] || NET.city[i]; return (LANG === 'de' && CITY_DE[c]) || c; };

  const dayText = () => {
    const c = countAt(DAY), r = c.E + c.I + c.R;
    return [T('Day ', 'Tag ') + Math.floor(DAY), T(`${num(r)} of ${num(N)} cities reached`, `${num(r)} von ${num(N)} Städten erreicht`)];
  };
  const labels = [
    { text: dayText, at: 'top', cls: 'amb', alpha: S => (OB.start >= 0 ? K.prog(S.globe_out, 0.5, 1) : 0) },
    { text: () => [OB.start >= 0 ? city(OB.start) : '', T('it starts here', 'hier fängt es an')], at: 'start', cls: 'amb',
      alpha: S => (OB.start >= 0 ? K.prog(S.globe_out, 0.5, 1) * (1 - K.prog(S.globe_day, 8, 12)) : 0) },
    { text: () => { const i = SEL; if (i < 0) return ['', '']; const d = tE[i]; return [city(i), d === NEVER ? T('never reached', 'nie erreicht') : d <= DAY ? T(`reached on day ${d}`, `erreicht an Tag ${d}`) : T('not yet', 'noch nicht')]; },
      at: 'sel', cls: 'cyn', alpha: S => (SEL >= 0 && SEL !== OB.start ? K.prog(S.globe_out, 0.5, 1) : 0) },
  ];
  const cam = {
    default: viewOf(28, 12, 3.6),          // Europe, Africa and Asia in view
    europe: viewOf(46, 14, 2.3),
    world: [60, 18, 4.2, 0, 0, 0],
    atlantic: viewOf(32, -35, 3.4),
    asia: viewOf(28, 100, 3.4),
    start: viewOf(28, 12, 2.6),            // (turned to the start city by start())
  };
  const setStartView = () => { if (OB.start >= 0) cam.start.splice(0, 6, ...viewOf(NET.lat[OB.start] * 0.85, NET.lon[OB.start], 2.6)); };
  const CTL = {
    en: [
      { key: 'view', label: 'View', options: [['default', 'Europe and Asia'], ['atlantic', 'The Atlantic'], ['asia', 'Asia'], ['world', 'From afar']] },
      { key: 'color', label: 'Colour', options: [['plain', 'Plain'], ['hubs', 'Hubs']] },
      { key: 'pillars', label: 'Pillars', options: [['off', 'Off'], ['on', 'Routes per airport']] },
      { key: 'out', label: 'Outbreak', options: [['off', 'Off'], ['on', 'Play']] },
    ],
    de: [
      { key: 'view', label: 'Ansicht', options: [['default', 'Europa und Asien'], ['atlantic', 'Der Atlantik'], ['asia', 'Asien'], ['world', 'Von weit weg']] },
      { key: 'color', label: 'Farbe', options: [['plain', 'Einfach'], ['hubs', 'Drehkreuze']] },
      { key: 'pillars', label: 'Säulen', options: [['off', 'Aus'], ['on', 'Flugrouten je Flughafen']] },
      { key: 'out', label: 'Ausbruch', options: [['off', 'Aus'], ['on', 'Abspielen']] },
    ],
  };
  // (in the Scenes tab the outbreak plays from wherever it was started, four days a second, and starts again)
  function explore(c) {
    const on = c.out === 'on' && OB.start >= 0;
    return { globe_hubs: c.color === 'hubs' ? 1 : 0, globe_pillars: c.pillars === 'on' ? 1 : 0, globe_out: on ? 1 : 0, globe_dim: on ? 1 : 0,
      globe_day: on ? ((c.t || 0) * 4) % (OB.end + 12) : 0 };
  }
  setup({ start: find('VIE') });   // a calm default: Vienna, medium spread (the story and explore set their own)
  setStartView();

  const api = {
    setup: o => { const s = setup(o); setStartView(); return s; },
    start: i => api.setup({ start: typeof i === 'string' ? find(i) : i }),
    settings: () => ({ start: OB.start, inc: OB.inc, inf: OB.inf, spread: OB.spread, kept: OB.kept, seed: OB.seed }),
    end: () => OB.end, series: () => OB.series, count: countAt, summary,
    arrivalDay: i => (i >= 0 && tE[i] < NEVER ? tE[i] : null), chain: i => chainTo(i),
    select: i => { SEL = i >= 0 ? i : -1; setChain(); }, selected: () => SEL,
    pick, find, info, pos, viewOf,
    // airports by code, city, name or country (the airports story's search), and by a city's German name or accents too
    search: (q, n) => {
      const lq = String(q || '').trim().toLowerCase(), out = [];
      const names = [...Object.entries(CITY_FIX), ...Object.entries(CITY_DE)];
      if (lq) for (const [en, nm] of names) if (nm.toLowerCase().startsWith(lq)) for (const i of O.matches(en, n || 8)) if (!out.includes(i)) out.push(i);
      for (const i of O.matches(q, n || 8)) if (!out.includes(i)) out.push(i);
      return out.slice(0, n || 8);
    }, deg: i => deg[i], n: () => N, routes: () => NET.E,
    original: O,   // (the cut-out airports story itself: NET, GL, bestPath, km, STATS ...)
  };
  const out = Object.assign(set, { params, update, anchors, labels, cam, explore, api, setLang: l => { LANG = l === 'de' ? 'de' : 'en'; } });
  Object.defineProperty(out, 'controls', { get: () => CTL[LANG], enumerable: true });
  return out;
};
