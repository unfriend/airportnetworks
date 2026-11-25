// The example scenes' own checks of what stands where (v203; the owner's headset notes of 25 November 2026: "lots of
// tables are too small", and floor strips that flickered where two lay at the same height). Used by the studio tour's and
// the tracker guide's layout.mjs; a failure is a layout error, so their make.mjs writes nothing.
//   flatClashes(surfaces): every pair of faces facing up (the floor's tiles, pads, the tops of boxes and cylinders, the
//     stage's own floor at y = 0) that overlap seen from above must be at least STEP apart in height, or a headset's depth
//     buffer cannot tell them apart and they flicker as the head moves
//   overhangs(items, supports): every item standing on a table (its foot at a table's top, within reach of it) stands
//     wholly on it, at least MARGIN in from each edge
// Shapes in the floor's plane are convex polygons [[x, z], ...].
export const STEP = 0.01, MARGIN = 0.02;
const r3 = v => Math.round(v * 1e3) / 1e3 || 0;
// the yaw of a record's turn (a turn about the vertical alone: [0, sin(a/2), 0, cos(a/2)])
export const yawOf = q => (q ? 2 * Math.atan2(q[1], q[3]) : 0);
// a rectangle w (its own x) by d (its own z) turned by yaw about its middle (three.js's turn: x goes to (cos, -sin))
export const rect = (cx, cz, w, d, yaw = 0) => {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]);
};
export const disc = (cx, cz, r, n = 16) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i / n * 2 * Math.PI), cz + r * Math.sin(i / n * 2 * Math.PI)]);
// two convex polygons overlap by more than eps (separating axes; touching edges do not count)
export function overlap(A, B, eps = 1e-3) {
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % P.length], l = Math.hypot(x1 - x0, z1 - z0);
    if (l < 1e-9) continue;
    const nx = (z0 - z1) / l, nz = (x1 - x0) / l, pr = Q => Q.map(([x, z]) => x * nx + z * nz);
    const a = pr(A), b = pr(B);
    if (Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b)) <= eps) return false;
  }
  return true;
}
// the faces facing up of a scene's shapes: flat planes (laid on the floor) and the tops of boxes and cylinders
export function shapeTops(shapes) {
  const out = [];
  for (const s of shapes) {
    const [x, y, z] = s.p, [sx, sy, sz] = s.size;
    if (s.shape === 'plane' && s.q && Math.abs(s.q[0] + 0.7071) < 1e-3 && Math.abs(s.q[3] - 0.7071) < 1e-3) out.push({ id: s.id, y, poly: rect(x, z, sx, sy) });
    else if (s.shape === 'cube' && (!s.q || (Math.abs(s.q[0]) < 1e-6 && Math.abs(s.q[2]) < 1e-6))) out.push({ id: s.id, y: y + sy / 2, poly: rect(x, z, sx, sz, yawOf(s.q)) });
    else if (s.shape === 'cylinder') out.push({ id: s.id, y: y + sy / 2, poly: disc(x, z, sx / 2) });
  }
  return out;
}
export function flatClashes(surfaces, step = STEP) {
  const errors = [];
  for (let i = 0; i < surfaces.length; i++) for (let j = i + 1; j < surfaces.length; j++) {
    const a = surfaces[i], b = surfaces[j];
    if (Math.abs(a.y - b.y) < step - 1e-9 && overlap(a.poly, b.poly)) errors.push(`${a.id} (top ${r3(a.y)} m) and ${b.id} (top ${r3(b.y)} m) overlap ${Math.abs(a.y - b.y) < 1e-6 ? 'at the same height' : 'less than ' + step * 100 + ' cm apart'}: they would flicker in a headset`);
  }
  return errors;
}
const NEAR = 0.5;
// how far in from a table's edge a point is (negative: beyond it)
function inset(s, x, z) {
  if (s.kind === 'disc') return s.r - Math.hypot(x - s.x, z - s.z);
  const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), dx = x - s.x, dz = z - s.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c;
  return Math.min(s.w / 2 - Math.abs(lx), s.d / 2 - Math.abs(lz));
}
// items: { id, foot (its lowest point, m), poly }; supports: { id, top, kind: 'rect' | 'disc', x, z, w, d, yaw, r }
export function overhangs(items, supports, margin = MARGIN) {
  const errors = [];
  for (const it of items) for (const s of supports) {
    if (s.id === it.id || Math.abs(s.top - it.foot) > 0.03) continue;   // (its foot at the table's top, or just over it)
    // (meant to stand on it: its middle over the table or within NEAR of its edge; another stand's table at the same
    // height is further)
    const mx = it.poly.reduce((a, p) => a + p[0], 0) / it.poly.length, mz = it.poly.reduce((a, p) => a + p[1], 0) / it.poly.length;
    if (inset(s, mx, mz) < -NEAR) continue;
    let worst = Infinity;
    for (const [x, z] of it.poly) worst = Math.min(worst, inset(s, x, z));
    if (worst < margin - 1e-6) errors.push(`${it.id} stands on ${s.id} but ${worst < 0 ? 'overhangs it by ' + r3(-worst * 100) + ' cm' : 'only ' + r3(worst * 100) + ' cm from its edge'} (at least ${margin * 100} cm in)`);
  }
  return errors;
}
