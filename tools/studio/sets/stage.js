// The stage: what a scene stands on when it brings nothing of its own. Life size: 1 unit is 1 m, the floor at y = 0,
// the scene's origin in the middle (in a shared room its circle's spot), -z the way it faces. A dark floor with a faint
// 1 m grid fading out with distance, a small mark at the origin pointing the scene's way, and a soft sky. In
// passthrough nothing of it is drawn (stage_floor 0): the scene stands on your real floor.
SETS.stage = function (K) {
  const group = new THREE.Group(), disposable = [];
  const keep = x => (disposable.push(x), x);
  const R = 40, GRID = 24;
  // the floor (the pointer's dot lands on it, also where it is not drawn)
  const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(R, 96).rotateX(-Math.PI / 2)),
    keep(new THREE.MeshStandardMaterial({ color: 0x0a111e, roughness: 0.95, metalness: 0 })));
  floor.renderOrder = -2;
  group.add(floor);
  // the grid: 1 m lines out to GRID m, each cut into 1 m pieces so it fades with distance (vertex colours, additive)
  const pos = [], col = [], c0 = new THREE.Color(0x3f6f99), fade = (x, z) => Math.max(0, 1 - Math.hypot(x, z) / GRID) ** 1.6;
  const seg = (x0, z0, x1, z1) => {
    pos.push(x0, 0.002, z0, x1, 0.002, z1);
    for (const [x, z] of [[x0, z0], [x1, z1]]) { const f = fade(x, z); col.push(c0.r * f, c0.g * f, c0.b * f); }
  };
  for (let i = -GRID; i <= GRID; i++) for (let j = -GRID; j < GRID; j++) { seg(i, j, i, j + 1); seg(j, i, j + 1, i); }
  const gg = keep(new THREE.BufferGeometry());
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const grid = new THREE.LineSegments(gg, keep(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
  group.add(grid);
  // the origin: a small ring and an arrowhead towards -z (where a scene faces)
  const mark = new THREE.Group(), markMat = keep(new THREE.MeshBasicMaterial({ color: 0x46d9ff, transparent: true, opacity: 0.45, depthWrite: false }));
  mark.add(new THREE.Mesh(keep(new THREE.RingGeometry(0.16, 0.18, 48).rotateX(-Math.PI / 2)), markMat));
  const tri = new THREE.Shape(); tri.moveTo(-0.07, 0); tri.lineTo(0.07, 0); tri.lineTo(0, 0.12); tri.closePath();
  const arrow = new THREE.Mesh(keep(new THREE.ShapeGeometry(tri).rotateX(-Math.PI / 2)), markMat);
  arrow.position.z = -0.2;
  mark.add(arrow);
  mark.position.y = 0.004;
  group.add(mark);
  // the sky: a soft gradient, dark at the horizon's foot, a little lighter above it, night blue overhead
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(300, 32, 16)), keep(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x0a1426) }, mid: { value: new THREE.Color(0x1d2c44) }, low: { value: new THREE.Color(0x05080f) } },
    vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top, mid, low; varying vec3 vP; void main() { float y = vP.y; vec3 c = y > 0.0 ? mix(mid, top, pow(clamp(y, 0.0, 1.0), 0.6)) : mix(mid, low, clamp(-y * 6.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }',
  })));
  sky.renderOrder = -10; sky.frustumCulled = false;
  group.add(sky);
  let alpha = 1;
  return {
    group,
    params: { stage_floor: 1 },
    anchors: { centre: [0, 1, 0], floor: [0, 0, 0] },
    labels: [],
    // [az, el, dist, tx, ty, tz]
    cam: { default: [24, 20, 7, 0, 1, 0], above: [0, 80, 14, 0, 0, 0] },
    solid: [floor],
    setAlpha(a) { alpha = a; group.visible = a > 0.01; },
    update(S) {
      const f = (S.stage_floor === undefined ? 1 : S.stage_floor) * alpha;
      floor.visible = grid.visible = sky.visible = mark.visible = f > 0.01;
    },
    dispose() { for (const x of disposable) x.dispose(); },
  };
};
