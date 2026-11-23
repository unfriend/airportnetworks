// Cage layout search for the body set's organ nodes: projects every node from the story's usual views and
// scores how much the label boxes (as the harness draws them: at node + (8, -10) px, ~22 px tall) cover each
// other or another node's dot. usage: node tools/body_cage.cjs [search [iterations]]
const ORG = [
  // key, label, organ y, angle (deg), cage y, r, allowed angle range, allowed y range
  ['brain', 'Brain', 0.745, 0, 0.8, 0.3, [0, 0], [0.8, 0.8]],
  ['thyroid', 'Thyroid', 0.548, -36, 0.68, 0.42, [-60, -20], [0.5, 0.72]],
  ['lungs', 'Lungs', 0.375, -60, 0.43, 0.42, [-110, -60], [0.3, 0.6]],
  ['heart', 'Heart', 0.29, 38, 0.55, 0.34, [20, 80], [0.25, 0.55]],
  ['liver', 'Liver', 0.215, -60, 0.34, 0.46, [-130, -60], [0.1, 0.4]],
  ['stomach', 'Stomach', 0.2, 110, 0.26, 0.4, [60, 110], [0.05, 0.4]],
  ['spleen', 'Spleen', 0.2, 120, -0.08, 0.46, [100, 170], [-0.08, 0.35]],
  ['pancreas', 'Pancreas', 0.14, -10, 0.2, 0.46, [-10, 60], [-0.05, 0.3]],
  ['kidneys', 'Kidneys', 0.098, -129, -0.07, 0.46, [-175, -110], [-0.12, 0.25]],
  ['intestine', 'Intestine', 0.02, -39, -0.09, 0.46, [-60, 30], [-0.2, 0.15]],
  ['marrow', 'Bone marrow', -0.005, 99, -0.42, 0.45, [90, 230], [-0.42, 0.05]],
  ['bladder', 'Bladder', -0.112, 2, -0.38, 0.46, [-30, 30], [-0.38, -0.15]],
];
const W = 1100, H = 700, F = 1 / Math.tan(16 * Math.PI / 180);
function project(p, cam) {
  const [az, el, d, tx, ty, tz] = cam, A = az * Math.PI / 180, E = el * Math.PI / 180;
  const c = [tx + d * Math.cos(E) * Math.sin(A), ty + d * Math.sin(E), tz + d * Math.cos(E) * Math.cos(A)];
  const f = [tx - c[0], ty - c[1], tz - c[2]], fl = Math.hypot(...f); f.forEach((v, i) => f[i] = v / fl);
  let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map(v => v / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const q = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], z = q[0] * f[0] + q[1] * f[1] + q[2] * f[2];
  const x = (q[0] * r[0] + q[1] * r[1] + q[2] * r[2]) / z * F / (W / H), y = (q[0] * u[0] + q[1] * u[1] + q[2] * u[2]) / z * F;
  return [(x * 0.5 + 0.5) * W, (-y * 0.5 + 0.5) * H];
}
// views and weights: front-ish story views count most, then the sides, the back least
const VIEWS = [];
for (const az of [-40, -20, 0, 14, 30, 45, 60]) for (const el of [4, 12, 25]) {
  VIEWS.push([[az, el, 2.9, 0, 0.22, 0], 2]); VIEWS.push([[az, el, 3.75, 0, 0, 0], 2]);
}
for (const az of [-120, -90, -75, 75, 90, 120]) for (const el of [4, 12]) {
  VIEWS.push([[az, el, 3.2, 0, 0.15, 0], 1.2]); VIEWS.push([[az, el, 3.75, 0, 0, 0], 1.2]);
}
for (const az of [150, 180, -150]) VIEWS.push([[az, 8, 3.2, 0, 0.15, 0], 0.5]);
const cage = o => [o[5] * Math.sin(o[3] * Math.PI / 180), o[4], o[5] * Math.cos(o[3] * Math.PI / 180)];
function viewCost(org, v, bad) {
  const B = org.map(o => { const s = project(cage(o), v), w = 7.6 * o[1].length + 22; return [s[0] + 6, s[1] - 12, s[0] + 10 + w, s[1] + 14, s, w * 22]; });
  let tot = 0;
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const ox = Math.min(B[i][2], B[j][2]) - Math.max(B[i][0], B[j][0]), oy = Math.min(B[i][3], B[j][3]) - Math.max(B[i][1], B[j][1]);
    const dot = (b, s) => (s[0] > b[0] - 5 && s[0] < b[2] && s[1] > b[1] - 5 && s[1] < b[3] + 5 ? 0.25 : 0);
    // fraction of the smaller label covered (squared: a label hidden outright is far worse than two that touch)
    const fr = ox > 0 && oy > 0 ? ox * oy / Math.min(B[i][5], B[j][5]) : 0;
    const c = fr * fr * 4 + fr + dot(B[i], B[j][4]) + dot(B[j], B[i][4]);
    if (c > 0) { tot += c; if (bad) { const k = org[i][0] + '/' + org[j][0]; bad[k] = (bad[k] || 0) + c; } }
  }
  return tot;
}
const cost = (org, bad) => VIEWS.reduce((s, [v, w]) => s + w * viewCost(org, v, bad), 0);
// stay close to the organ: angle and height drift cost a little
const pen = org => org.reduce((s, o, i) => s + 0.002 * (o[3] - ORG[i][3]) ** 2 * 0 + 6 * (o[4] - o[2]) ** 2, 0);
function report(org, title) {
  const bad = {}, c = cost(org, bad);
  console.log(title, 'cost', c.toFixed(1), 'pen', pen(org).toFixed(2));
  console.log('  worst pairs:', Object.entries(bad).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', '));
  for (const az of [0, 14, 30, -40, 90, -90]) {
    const v = az === 90 || az === -90 ? [az, 4, 3.2, 0, 0.15, 0] : [az, 12, 2.9, 0, 0.22, 0], b = {};
    const c1 = viewCost(org, v, b);
    console.log(`  az ${az}: ${c1.toFixed(2)} ${Object.keys(b).join(' ')}`);
  }
}
report(ORG, 'current');
if (process.argv[2] === 'search') {
  let seed = +(process.argv[4] || 11); const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let cur = ORG.map(o => o.slice()), cc = cost(cur) + pen(cur), best = cur, bc = cc;
  const IT = +(process.argv[3] || 30000);
  for (let it = 0; it < IT; it++) {
    const T = 2 * (1 - it / IT) + 0.01;
    const cand = cur.map(o => o.slice()), i = 1 + Math.floor(rnd() * 11), o = cand[i], m = rnd();
    if (m < 0.55) o[4] = Math.round((o[4] + (rnd() - 0.5) * 0.1) * 100) / 100;
    else if (m < 0.85) o[3] = Math.round(o[3] + (rnd() - 0.5) * 24);
    else o[5] = Math.round((o[5] + (rnd() - 0.5) * 0.06) * 100) / 100;
    o[3] = Math.max(o[6][0], Math.min(o[6][1], o[3])); o[4] = Math.max(o[7][0], Math.min(o[7][1], o[4]));
    o[5] = Math.max(0.34, Math.min(0.46, o[5]));
    const c = cost(cand) + pen(cand);
    if (c < cc || rnd() < Math.exp((cc - c) / T)) { cur = cand; cc = c; if (c < bc) { bc = c; best = cand; } }
  }
  report(best, 'best');
  console.log(best.map(o => `['${o[0]}', ${o[3]}, ${o[4]}, ${o[5]}]`).join(', '));
}
