// STUB of the scan set (tools/pet/SPEC.md), for engine work before the real set exists: the spec's params, anchors,
// labels, cam views, controls and api, drawn with a few plain meshes. The build uses sets/scan.js once it is there.
SETS.scan = function (K) {
  const { THREE } = K, set = K.newSet('scan'), D2 = Math.PI / 2;
  const mat = (c, o) => K.fade(set, new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.05 }), o || 1);
  const scanner = new THREE.Group(); set.group.add(scanner);
  const add = (geo, m, p, r) => { const o = new THREE.Mesh(geo, m); if (p) o.position.set(...p); if (r) o.rotation.set(...r); scanner.add(o); return o; };
  const gantry = add(new THREE.TorusGeometry(0.72, 0.32, 16, 48), mat(0xeef2f6), [0, 0.02, 0]); gantry.scale.z = 2.4;
  const ring = add(new THREE.TorusGeometry(0.41, 0.025, 8, 48), mat(0x7fb2ff), [0, 0, 0.8]);
  const det = add(new THREE.TorusGeometry(0.45, 0.05, 8, 48), mat(0x1a2638, 0.9), [0, 0, 0]);
  const couch = add(new THREE.BoxGeometry(0.55, 0.07, 2.2), mat(0xf4f6f8), [0, -0.22, 1.5]);
  add(new THREE.BoxGeometry(0.42, 0.75, 1.0), mat(0x8a929c), [0, -0.66, 1.9]);
  const patient = add(new THREE.CylinderGeometry(0.15, 0.15, 1.75, 16), mat(0x8fb4ff, 0.35), [0, -0.08, 1.5], [D2, 0, 0]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), mat(0x0b1018)); floor.rotation.x = -D2; floor.position.y = -1.05; floor.name = 'floor'; set.group.add(floor);
  // events: points at hashed places, a few per second
  const N = 300, g = K.pointsGeo(N), P = g.attributes.position.array, Cc = g.attributes.aCol.array, Sz = g.attributes.aSize.array, A = g.attributes.aA.array;
  for (let i = 0; i < N; i++) { Cc.set([1, 0.85, 0.4], 3 * i); Sz[i] = 0.03; }
  set.group.add(new THREE.Points(g, K.points(set)));
  // the vision row: four glowing boxes to the scanner's right
  const row = new THREE.Group(); set.group.add(row);
  const rowM = [['#ffb43b', 0.4], ['#46d9ff', 1.4], ['#ff5a4b', 2.3], ['#ffe066', 3.0]].map(([c, x]) => { const m = K.fade(set, new THREE.MeshBasicMaterial({ color: c }), 1); const o = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.05), m); o.position.set(x - 1, 0, 0); row.add(o); return m; });
  const h = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  let S0 = { scan_bed: 0, scan_vision: 0 }, last = [0, 0, 0];
  const bedZ = () => 1.5 - 1.3 * S0.scan_bed;
  return Object.assign(set, {
    floorY: -1.05,
    params: { scan_a: 1, scan_bed: 0, scan_cut: 0, scan_events: 0, scan_lines: 0, scan_image: 0, scan_vision: 0 },
    update(S, t) {
      S0 = S;
      scanner.position.x = -2.2 * S.scan_vision; scanner.scale.setScalar(1 - 0.25 * S.scan_vision);
      couch.position.z = bedZ(); patient.position.z = bedZ();
      gantry.visible = S.scan_cut < 0.95; det.visible = S.scan_cut > 0.05;
      patient.material.color.setRGB(0.55 + 0.45 * S.scan_image, 0.7, 1 - 0.6 * S.scan_image);
      const k = Math.floor(t * 25);
      for (let i = 0; i < N; i++) {
        const j = k - i, on = S.scan_events > 0.02 && i < 30 * S.scan_events + S.scan_lines * 200;
        P.set([(h(j) - 0.5) * 0.25, -0.08 + (h(j + 7) - 0.5) * 0.2, bedZ() - 0.8 + h(j + 3) * 1.6], 3 * i); A[i] = on ? 1 - i / N : 0;
        if (i === 0) last = [P[0], P[1], P[2]];
      }
      g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true;
      row.visible = S.scan_vision > 0.02; rowM.forEach((m, i) => { m.opacity = K.smooth(S.scan_vision * 4 - i) * set.uA.value; });
    },
    anchors: { centre: [0, 0, 0], bore: [0, 0, 0.8], ring: [0, 0.5, 0], couch: () => [0, -0.22, bedZ()], patient: () => [0, -0.05, bedZ() - 0.45], head: () => [0, -0.05, bedZ() - 0.8],
      tumour: () => [-0.08, -0.02, bedZ() - 0.5], event: () => last, vision_scan: [-2.2, 0, 0], vision_body: [-0.6, 0, 0], vision_net: [0.4, 0, 0], vision_prog: [1.3, 0.3, 0], vision_med: [2, -0.3, 0], floor: [0, -1.05, 0] },
    labels: [
      { text: ['PET/CT scanner', ''], at: 'bore', alpha: S => (1 - S.scan_cut) * (1 - S.scan_vision) * (S.scan_events < 0.1 ? 1 : 0) },
      { text: ['Detector ring', ''], at: 'ring', cls: 'cyn', alpha: S => K.prog(S.scan_cut, 0.5, 1) * (1 - S.scan_image) },
      { text: ['Two gamma photons', '511 keV'], at: 'event', cls: 'amb', alpha: S => K.prog(S.scan_events, 0.05, 0.2) * (1 - S.scan_lines) },
      { text: ['Line of response', ''], at: 'patient', cls: 'cyn', alpha: S => K.prog(S.scan_lines, 0.1, 0.4) * (1 - S.scan_image) },
      { text: ['FDG in the patient', ''], at: 'patient', cls: 'amb', alpha: S => K.prog(S.scan_image, 0.5, 1) * (1 - S.scan_vision) },
      { text: ['PET scan', ''], at: 'vision_scan', alpha: S => K.prog(S.scan_vision, 0.7, 1) },
      { text: ['One network', ''], at: 'vision_net', alpha: S => K.prog(S.scan_vision, 0.8, 1) },
    ],
    cam: { default: [35, 14, 7.5, 0, -0.2, 0.6], front: [0, 5, 6, 0, 0, 0], ring: [20, 24, 3.4, 0, 0.1, 0], side: [90, 8, 6.2, 0, -0.2, 0.7],
      inside: [180, 4, 1.1, 0, -0.05, 0.9], vision: [0, 4, 12, -0.4, 0, 0], life: [25, 12.7, 2.5, 0, 0, 0] },
    controls: [{ key: 'view', label: 'View', options: [['scanner', 'Scanner'], ['ring', 'Ring'], ['inside', 'Inside'], ['vision', 'Vision']] },
      { key: 'events', label: 'Events', options: [['off', 'Off'], ['on', 'On']] }, { key: 'image', label: 'Image', options: [['lines', 'Lines'], ['image', 'Image']] }],
    explore(c) {
      const ev = c.events === 'on' ? 1 : 0;
      return { scan_bed: c.view === 'vision' ? 0 : 1, scan_cut: c.view === 'ring' || c.view === 'inside' ? 1 : 0, scan_events: ev, scan_lines: ev, scan_image: c.image === 'image' ? 1 : 0, scan_vision: c.view === 'vision' ? 1 : 0 };
    },
    api() { return { floorY: -1.05, setFloor(on) { floor.visible = on; } }; },
  });
};
