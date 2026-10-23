// Writes tools/pet/sets/data.js (the constant PET_DATA) for the PET story, from:
// - the paper: Geist et al., "The metabolic organ connectome: A novel approach to measure allostatic load during
//   health-to-disease transition", Med 6, 100881 (2025), doi 10.1016/j.medj.2025.100881, CC BY 4.0: its tables
//   (typed in below) and the weight matrices printed in its Figure 2A;
// - tools/pet/data/figures.json: values read off the paper's figures 3 and 4, each read twice independently and
//   reconciled (it also holds readings of the poster's plots, "Shaping a New Era in Nuclear Medicine", Geist et al.:
//   the story no longer shows the poster's one-scan network and results, so they are not used);
// - stand-ins for what is not published (marked so in the data): typical organ uptakes and a synthetic cohort that has
//   the paper's partial correlations.
// No patient data.
// usage (from the repository root): node tools/pet/data/gen_data.mjs
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname);
const FIG = JSON.parse(fs.readFileSync(path.join(here, 'figures.json'), 'utf8'));
const r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------- organs --
// pos: a home point in the frame of the tour's PET body (tools/lbi/sets/body.js: feet at y -0.95, the figure faces
// +z, the person's left is +x; x already narrowed by its XS = 0.9). The organs set's anchors are the exact places.
// suv: a typical uptake normalised to the aorta's blood pool (illustrative, not from the paper).
const ORGANS = [
  ['brain', 'Brain', 'Brain', 'mean of the whole brain', '#a78bfa', [0, 0.738, -0.008], 4.4],
  ['thyroid', 'Thyroid', 'Thyroid', 'mean of the whole gland', '#22d3ee', [0, 0.548, 0.042], 0.95],
  ['lungs', 'Lungs', 'Lungs', 'maximum (left and right averaged)', '#60a5fa', [-0.079, 0.365, -0.01], 0.55],
  ['heart', 'Heart', 'Heart', 'mean of the whole heart', '#f43f5e', [0.038, 0.293, 0.052], 1.8],
  ['liver', 'Liver', 'Liver', 'mean of the whole liver', '#f97316', [-0.074, 0.205, 0.012], 1.35],
  ['spleen', 'Spleen', 'Spleen', 'mean of the whole spleen', '#d946ef', [0.108, 0.2, -0.056], 1.1],
  ['pancreas', 'Pancreas', 'Pancreas', 'mean of the whole pancreas', '#facc15', [0.032, 0.14, -0.01], 0.95],
  ['kidneys', 'Kidneys', 'Kidneys', 'mean (left and right averaged)', '#fb7185', [-0.065, 0.098, -0.066], 1.6],
  ['adrenal', 'Adrenal glands', 'Adrenals', 'maximum', '#a3e635', [-0.054, 0.152, -0.06], 1.2],
  ['intestine', 'Intestine', 'Intestine', 'mean of the whole intestine', '#f9a8d4', [-0.009, 0.02, 0.05], 1.0],
  ['muscle', 'Muscle', 'Muscle', 'mean of the gluteus maximus', '#4ade80', [-0.072, -0.13, -0.085], 0.47],
  ['marrow', 'Bone marrow', 'Marrow', 'maximum between the vertebrae L1 and L5', '#e7e5e4', [0, 0.06, -0.036], 1.3],
  ['fat', 'Subcutaneous fat', 'Fat', 'mean between the vertebrae L1 and L5', '#fdba74', [0, 0.06, 0.1], 0.2],
  ['aorta', 'Aorta (blood pool)', 'Aorta', 'the reference: every organ is divided by it', '#94a3b8', [0.014, 0.25, -0.04], 1.0],
].map(([id, name, short, measure, col, pos, suv]) => ({ id, name, short, measure, col, pos, suv }));
const OI = Object.fromEntries(ORGANS.map((o, i) => [o.id, i]));

// ------------------------------------------------------- the full cohort --
// Figure 2A: partial correlations of the 658 scans, organs normalised to the aorta (and to the vena cava)
const F2 = ['adrenal', 'marrow', 'heart', 'intestine', 'kidneys', 'liver', 'lungs', 'muscle', 'pancreas', 'spleen', 'thyroid'];
const AORTA = FIG.fig2.aorta, VENA = FIG.fig2.vena;
const edgesOf = (M, ids) => {
  const e = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (M[i][j]) e.push([ids[i], ids[j], M[i][j]]);
  return e;
};
// the paper's measures: strength = sum of absolute partial correlations; density = all strengths / (N (N - 1));
// disorder = b of a least-squares fit a exp(-b x) to the strengths sorted from high to low
function measures(ids, edges) {
  const s = Object.fromEntries(ids.map(i => [i, 0]));
  for (const [a, b, w] of edges) { s[a] += Math.abs(w); s[b] += Math.abs(w); }
  const v = ids.map(i => s[i]).sort((x, y) => y - x), N = ids.length;
  const density = v.reduce((x, y) => x + y, 0) / (N * (N - 1));
  let best = [Infinity, 0, 0];
  for (let b = 0; b <= 2; b += 0.0005) {
    let num = 0, den = 0;
    v.forEach((y, x) => { const e = Math.exp(-b * x); num += y * e; den += e * e; });
    const a = num / den, err = v.reduce((q, y, x) => q + (y - a * Math.exp(-b * x)) ** 2, 0);
    if (err < best[0]) best = [err, b, a];
  }
  const m = v.reduce((x, y) => x + y, 0) / N, sd = Math.sqrt(v.reduce((q, y) => q + (y - m) ** 2, 0) / N) || 1;
  const hubs = ids.filter(i => (s[i] - m) / sd > 1.7);
  return { density: r3(density), disorder: r3(best[1]), fitA: r3(best[2]), strength: Object.fromEntries(ids.map(i => [i, r3(s[i])])), hubs };
}

// ---------------------------------------------------- a stand-in cohort --
// 658 synthetic people whose organ values have the partial correlations of Figure 2A (precision matrix with unit
// diagonal and -rho off it, inverted, sampled with a seeded Gaussian). For showing what a partial correlation is.
let seed = 658;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
function chol(A) {
  const n = A.length, L = A.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j];
    for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (s <= 0) return null; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
  }
  return L;
}
function inv(A) {
  const n = A.length, M = A.map((r, i) => [...r, ...r.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    for (let k = 0; k < 2 * n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let k = 0; k < 2 * n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map(r => r.slice(n));
}
const n = F2.length, NP = 658;
let shrink = 1, Om;
for (;; shrink -= 0.02) {
  Om = AORTA.map((r, i) => r.map((v, j) => (i === j ? 1 : -v * shrink)));
  if (chol(Om)) break;
}
const Sg = inv(Om), dg = Sg.map((r, i) => Math.sqrt(r[i])), Cr = Sg.map((r, i) => r.map((v, j) => v / dg[i] / dg[j]));
const Lc = chol(Cr), Z = [];
for (let p = 0; p < NP; p++) {
  const g = F2.map(() => gauss());
  Z.push(F2.map((_, i) => Lc[i].reduce((s, l, k) => s + l * g[k], 0)));
}
// sample correlations and partial correlations (from the inverse of the sample correlation matrix)
const mean = F2.map((_, i) => Z.reduce((s, z) => s + z[i], 0) / NP);
const cov = F2.map((_, i) => F2.map((_, j) => Z.reduce((s, z) => s + (z[i] - mean[i]) * (z[j] - mean[j]), 0) / (NP - 1)));
const sd = cov.map((r, i) => Math.sqrt(r[i])), cor = cov.map((r, i) => r.map((v, j) => v / sd[i] / sd[j]));
const P = inv(cor), pcor = P.map((r, i) => r.map((v, j) => (i === j ? 1 : -v / Math.sqrt(P[i][i] * P[j][j]))));
// residuals of organ a after regressing it on all but a and b (ordinary least squares), for the explainer pairs
function residuals(a, b) {
  const others = F2.map((_, i) => i).filter(i => i !== a && i !== b);
  const X = Z.map(z => [1, ...others.map(i => z[i])]);
  const fit = y => {
    const XtX = X[0].map((_, i) => X[0].map((_, j) => X.reduce((s, x) => s + x[i] * x[j], 0)));
    const Xty = X[0].map((_, i) => X.reduce((s, x, k) => s + x[i] * y[k], 0));
    const beta = inv(XtX).map(r => r.reduce((s, v, j) => s + v * Xty[j], 0));
    return y.map((v, k) => v - X[k].reduce((s, x, j) => s + x * beta[j], 0));
  };
  return [fit(Z.map(z => z[a])), fit(Z.map(z => z[b]))];
}
const corr = (x, y) => {
  const mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length;
  let sxy = 0, sxx = 0, syy = 0;
  x.forEach((v, k) => { sxy += (v - mx) * (y[k] - my); sxx += (v - mx) ** 2; syy += (y[k] - my) ** 2; });
  return sxy / Math.sqrt(sxx * syy);
};
const PAIRS = [['liver', 'spleen'], ['heart', 'lungs'], ['lungs', 'liver'], ['intestine', 'marrow']].map(([a, b]) => {
  const ia = F2.indexOf(a), ib = F2.indexOf(b), [ra, rb] = residuals(ia, ib), xy = [];
  Z.forEach((z, k) => xy.push(r2(z[ia]), r2(z[ib]), r2(ra[k]), r2(rb[k])));
  return { a, b, paper: AORTA[ia][ib], r: r2(cor[ia][ib]), pr: r2(corr(ra, rb)), xy };
});
// each person's values in the units of the organ bars (typical normalised uptake, 18% spread), for the matrix
const rows = Z.map(z => F2.map((id, i) => r2(Math.max(0.05, ORGANS[OI[id]].suv * (1 + 0.18 * z[i])))));

// ------------------------------------------------- networks from figures --
const nets = [];
const addNet = (id, d, extra) => {
  const ids = d.organs_shown, edges = d.edges.map(e => [e.a, e.b, r2(e.sign * e.w)]);
  nets.push(Object.assign({ id, title: d.title, n: d.n, density: d.density, organs: ids, isolated: d.isolated || [],
    hubs: d.hubs || [], edges, layout: Object.fromEntries((d.layout || []).map(l => [l.organ, [r3(l.x), r3(l.y)]])),
    computed: measures(ids, edges) }, extra));
};
const lay = o => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, [r3(v[0]), r3(v[1])]]));
nets.push({ id: 'full', title: 'All 658 scans (normalised to the aorta)', fig: '2A', n: 658, density: 12, disorder: 0.17,
  organs: F2, isolated: [], hubs: [], edges: edgesOf(AORTA, F2), layout: lay(FIG.fig2.layout.full), computed: measures(F2, edgesOf(AORTA, F2)), exact: true });
nets.push({ id: 'vena', title: 'All 658 scans (normalised to the vena cava)', fig: '2A', n: 658, density: 12, disorder: 0.21,
  organs: F2, isolated: [], hubs: [], edges: edgesOf(VENA, F2), layout: lay(FIG.fig2.layout.vena), computed: measures(F2, edgesOf(VENA, F2)), exact: true });
for (const p of (FIG.fig3 || [])) addNet(p.id, p, { fig: '3' + p.id[0] });
for (const p of (FIG.fig4 || [])) addNet(p.id, p, { fig: '4' });
// Figure 2B, the same 21 people at three doses: the links' signs and relative widths are firm, their absolute
// weights scaled so each gives its printed density (uncertain by about a third)
for (const d of (FIG.fig2.dose || [])) {
  const edges = d.edges.map(e => [e.a, e.b, r2(e.sign * e.w)]);
  nets.push({ id: 'dose_' + d.id, title: `${d.title[0].toUpperCase() + d.title.slice(1)} (21 people)`, fig: '2B', n: d.n, density: d.density,
    organs: d.organs, isolated: [], hubs: [], edges, layout: lay(d.layout), computed: measures(d.organs, edges), approx: true });
}

// --------------------------------------------------------- tables 1 to 3 --
const TABLE1 = {
  cols: ['Full FDG cohort', 'Healthy FDG cohort', 'Cancer FDG cohort', 'GTEx cohort'],
  rows: [['Subjects', '658', '241', '417', '946'], ['Male (%)', '63', '53', '69', '67'],
    ['Blood glucose (mg/dL)', '105 ± 34', '83 ± 6', '115 ± 38', '–'], ['BMI (kg/m²)', '26 ± 6', '25 ± 5', '27 ± 6', '27 ± 4'],
    ['Age (years)', '54 ± 17', '34 ± 12', '61 ± 11', '53 ± 13'], ['Leukocytes (10⁹/L)', '8.2 ± 2.9', '6 ± 2', '9.1 ± 2.8', '–'],
    ['CRP (mg/dL)', '1.7 ± 3.8', '0.2 ± 0.5', '3.1 ± 4.8', '–'], ['Norepinephrine (ng/L)', '–', '271 ± 114 (40 people)', '–', '–'],
    ['Tumour load, TLG (SUV × mL)', '–', '–', '265 ± 677', '–'], ['Tumour stage', '–', '–', '4 (3–4)', '–'],
    ['Survival (months)', '–', '–', '42 ± 32', '–']],
};
// Table 2: [what, cohort, part ('test' establishing the method, 'health' the health-to-disease transition),
//   groups [label, n, density %, disorder], density p, disorder p, density different, disorder different, note (optional)]
const T2 = [
  ['Test-retest', '2 scans within 6 weeks, no intervention', 'test', [['first scan', 47, 14, 0.06], ['second scan', 47, 16, 0.04]], 'p = 0.12', 'p = 0.2', 0, 0],
  ['Cold exposure', '2 scans within 2 weeks, cold exposure at the second', 'test', [['first scan', 63, 7, 0.15], ['second scan', 63, 8, 0.20]], 'p = 0.3', 'p = 0.2', 0, 0],
  ['Dose', '2 consecutive scans, 3 doses', 'test', [['standard dose', 21, 20, 0.09], ['ultra-low dose', 21, 24, 0.07], ['virtual low dose', 21, 23, 0.08]], 'all p > 0.5', 'all p > 0.2', 0, 0],
  ['Blood pool', 'full cohort, normalised to', 'test', [['aorta', 658, 12, 0.17], ['vena cava', 658, 12, 0.21]], 'p = 0.97', 'p = 0.97', 0, 0],
  ['Scanner', '2 PET/CT systems', 'test', [['Biograph TruePoint 64', 61, 8, 0.17], ['Biograph Vision', 61, 11, 0.15]], 'p = 0.3', 'p = 0.4', 0, 0],
  ['Sex', '55 people each, matched health', 'test', [['male', 55, 27, 0.21], ['female', 55, 21, 0.29]], 'p = 0.4', 'p = 0.4', 0, 0],
  ['Age', 'full cohort, split at the median', 'test', [['under 56 years', 302, 17, 0.13], ['56 or older', 283, 13, 0.16]], 'p = 0.8', 'p = 1.0', 0, 0],
  ['Cancer', 'full cohort', 'health', [['healthy', 241, 30, 0.19], ['cancer', 417, 7, 0.29]], 'p < 0.001', 'p = 0.014', 1, 1],
  ['BMI', 'full cohort, split at the median', 'health', [['BMI under 25.3', 303, 33, 0.14], ['BMI 25.3 or more', 303, 14, 0.27]], 'p = 0.024', 'p = 0.04', 1, 1],
  ['BMI', 'healthy people, split at the median', 'health', [['BMI under 24.4', 94, 27, 0.13], ['BMI 24.4 or more', 95, 7, 0.17]], 'p < 0.001', 'p = 0.02', 1, 1],
  ['BMI', 'people with cancer, split at the median', 'health', [['BMI under 26.0', 203, 15, 0.18], ['BMI 26.0 or more', 214, 11, 0.20]], 'p = 0.3', 'p = 0.4', 0, 0],
  ['Leukocytes', 'full cohort, split at the median', 'health', [['under 7.9 × 10⁹/L', 117, 10, 0.12], ['7.9 × 10⁹/L or more', 118, 6, 0.16]], 'p = 0.12', 'p = 0.12', 0, 0,
    'As printed in Table 2; the paper\'s text gives p = 0.012 for this split.'],
  ['Leukocytes', 'healthy people, split at the median', 'health', [['under 6.5 × 10⁹/L', 36, 5, 0.09], ['6.5 × 10⁹/L or more', 37, 3, 0.17]], 'p = 0.3', 'p = 0.07', 0, 0],
  ['Leukocytes', 'people with cancer, split at the median', 'health', [['under 9.3 × 10⁹/L', 63, 11, 0.12], ['9.3 × 10⁹/L or more', 63, 6, 0.21]], 'p = 0.03', 'p = 0.07', 1, 0],
  ['CRP', 'full cohort, split at the median', 'health', [['under 0.5 mg/dL', 190, 12, 0.11], ['0.5 mg/dL or more', 115, 6, 0.19]], 'p = 0.018', 'p = 0.018', 1, 1],
  ['CRP', 'healthy people, split at the median', 'health', [['under 0.08 mg/dL', 75, 10, 0.11], ['0.08 mg/dL or more', 69, 10, 0.12]], 'p = 0.9', 'p = 0.8', 0, 0],
  ['CRP', 'people with cancer, split at the median', 'health', [['under 1.25 mg/dL', 81, 6, 0.23], ['1.25 mg/dL or more', 80, 3, 0.43]], 'p = 0.16', 'p = 0.2', 0, 0],
  ['CRP', 'full cohort, in thirds', 'health', [['under 0.11 mg/dL', 95, 11, 0.10], ['0.11 to 0.74 mg/dL', 108, 7, 0.17], ['0.74 to 40.1 mg/dL', 102, 3, 0.27]], 'p = 0.02, then p = 0.09', 'p = 0.01, then p = 0.13', 1, 1],
  ['Blood glucose', 'full cohort, split at the median', 'health', [['under 93 mg/dL', 104, 16, 0.12], ['93 mg/dL or more', 114, 8, 0.14]], 'p = 0.025', 'p = 0.08', 1, 0],
  ['Norepinephrine', 'healthy people, split at the median', 'health', [['under 270 ng/L', 20, 14, 0.11], ['270 ng/L or more', 20, 4, 0.21]], 'p = 0.04', 'p = 0.12', 1, 0],
  ['Tumour load', 'people with cancer, split at the median TLG', 'health', [['TLG under 23', 174, 18, 0.17], ['TLG 23 or more', 174, 8, 0.30]], 'p = 0.028', 'p = 0.04', 1, 1],
  ['Tumour stage', 'people with cancer', 'health', [['stage below III', 99, 20, 0.16], ['stage IV', 98, 13, 0.19]], 'p = 0.1', 'p = 0.2', 0, 0],
  // printed so in the paper's Table 2 (the shorter survivors' network the denser one)
  ['Survival', 'people with cancer, split at the median', 'health', [['under 34 months', 208, 23, 0.14], ['34 months or more', 208, 7, 0.23]], 'p < 0.001', 'p = 0.005', 1, 1,
    'As printed in Table 2: here the shorter survivors\' network is the denser one, unlike the paper\'s other results; the paper does not discuss it.'],
].map(([what, cohort, part, groups, pD, pO, sigD, sigO, note]) => Object.assign({ what, cohort, part,
  groups: groups.map(([label, n, density, disorder]) => ({ label, n, density, disorder })), pD, pO, sigD: !!sigD, sigO: !!sigO }, note ? { note } : {}));
const T3 = [
  ['FDG (the 241 scans of healthy volunteers)', 'fdg', 9, '', null, ''],
  ['Glucose-6-phosphatase 2 (G6PC2)', 'metabolism', 9, 'p = 1.0', -0.2, 'very different'],
  ['Glucose-6-phosphatase 3 (G6PC3)', 'metabolism', 12, 'p = 0.9', -0.1, 'very different'],
  ['Glucose-6-phosphate dehydrogenase (G6PD)', 'metabolism', 11, 'p = 1.0', 0.0, 'very different'],
  ['Glucose transporters GLUT1 to 4 (together)', 'metabolism', 16, 'p = 0.1', -0.1, 'very different'],
  ['Glucose-6-phosphate isomerase (GPI)', 'metabolism', 12, 'p = 0.8', -0.1, 'very different'],
  ['Hexose-6-phosphate dehydrogenase (H6PD)', 'metabolism', 13, 'p = 1.0', -0.4, 'very different'],
  ['Hexokinase 2 (HK2)', 'metabolism', 7, 'p = 1.0', 0.42, 'similar (p = 0.01)'],
  ['Glucose-6-phosphate exchanger 1 (SLC37A1)', 'metabolism', 7, 'p = 1.0', 0.0, 'very different'],
  ['Glucose-6-phosphate exchanger 2 (SLC37A2)', 'metabolism', 8, 'p = 0.8', -0.2, 'very different'],
  ['Glucose-6-phosphate exchanger 4 (SLC37A4)', 'metabolism', 12, 'p = 0.7', -0.1, 'very different'],
  ['Interleukin-6 (IL-6)', 'inflammation', 14, 'p = 0.12', 0.1, 'very different'],
  ['Interleukin-1β (IL-1β)', 'inflammation', 13, 'p = 0.15', 0.22, 'very different'],
  ['Tumour necrosis factor α (TNF-α)', 'inflammation', 10, 'p = 0.8', 0.2, 'very different'],
  ['C-reactive protein (CRP)', 'inflammation', 10, 'p = 0.4', 0.0, 'very different'],
  ['COX4I1', 'ageing', 7, 'p = 0.8', -0.1, 'very different'],
  ['CDKN1A', 'ageing', 18, 'p = 0.004', -0.3, 'very different'],
  ['HSP90AA1', 'ageing', 17, 'p = 0.06', 0.1, 'very different'],
  ['EGR1', 'ageing', 10, 'p = 0.5', 0.22, 'very different'],
].map(([name, kind, density, p, r, similar]) => ({ name, kind, density, p, r, similar }));

// ------------------------------------------------------------- output --
const D = {
  source: {
    paper: 'Geist BK, Guthrie J, Kertesz H, Kiefer FW, Kulterer OC, Nakuz T, Nics L, Patronas E-M, Rendeiro A, Vraka C, Yu J, Grünert S, Hacker M. The metabolic organ connectome: A novel approach to measure allostatic load during health-to-disease transition. Med 6, 100881 (2025). doi:10.1016/j.medj.2025.100881 (CC BY 4.0)',
    poster: 'Geist BK, Grentner A, Fischer J, Yu J, Tsomaia D, Smajlovic A, Grünert S, Hacker M. Shaping a New Era in Nuclear Medicine. Division of Nuclear Medicine, Medical University of Vienna; LBI for Network Medicine.',
  },
  organs: ORGANS,
  cohort: { scans: 658, subjects: 548, healthy: 241, cancer: 417, lung: 165, hnscc: 252, retest6w: 47, cold2w: 63, dose: 21,
    norepi: 40, gtex: 946, gtexSamples: 17382, gtexProteins: 13, table1: TABLE1 },
  protocol: { fasting: 6, dose: [250, 300], rest: 60, segmentation: 'MOOSE (nnU-Net)', software: 'JASP 0.19.0', p: 0.05, hub: 1.7 },
  f2: { organs: F2, aorta: AORTA, vena: VENA },
  nets,
  table2: T2, table3: T3,
  strength: FIG.fig3D || null,
  synth: { n: NP, organs: F2, shrink: r2(shrink), rows, pcor: pcor.map(r => r.map(r2)), cor: cor.map(r => r.map(r2)), pairs: PAIRS },
};
const head = `// PET_DATA: generated by tools/pet/data/gen_data.mjs; never edit by hand.
// Sources: the paper (${D.source.paper}) and the poster (${D.source.poster}).
// Fields:
//   source            citations
//   organs[]          { id, name, short, measure (how the paper measures it), col (its colour everywhere), pos (a home
//                     point in the frame of the tour's PET body set), suv (typical uptake / aorta, illustrative) }; 13
//                     organs, then the aorta (the reference)
//   cohort, protocol  the paper's cohorts (table1: its Table 1) and scan protocol
//   f2                Figure 2A's two 11 x 11 partial-correlation matrices (organs in f2.organs order)
//   nets[]            networks: { id, title, fig, n, density (%, as printed), disorder (as printed, if any), organs (ids
//                     drawn), isolated, hubs, edges [[a, b, signed weight]], layout { organ: [x, y] in the figure, 0..1,
//                     y down }, computed (density, disorder, strengths and hubs computed from the edges), exact (true for
//                     the printed matrices; the others are read off the figures; approx: weights scaled) }: full and
//                     vena (Figure 2A), A_low, A_high, B_low, B_high, C_low, C_mid, C_high (Figure 3), FDG_healthy, HK2,
//                     GLUT (Figure 4), dose_standard, dose_ultra, dose_virtual (Figure 2B, approx)
//   table2[]          every comparison of the paper's Table 2: { what, cohort, part ('test' or 'health'), groups [{ label,
//                     n, density, disorder }], pD, pO (p values as printed), sigD, sigO (significant), note (when the
//                     row needs a word: an oddity of the printed table) }
//   table3[]          the protein networks of Table 3: { name, kind, density, p, r (weight-matrix correlation with FDG), similar }
//   strength          Figure 3D's strength distributions (high and low density) and Figure 2C's (test-retest), read off
//   synth             a stand-in cohort of 658 people with Figure 2A's partial correlations: rows (values in organ-bar
//                     units, f2 order), cor and pcor (its correlations and partial correlations), pairs (for the
//                     explainer: { a, b, paper, r, pr, xy: per person [a, b, a's residual, b's residual] in z units })
`;
const out = path.join(here, '../sets/data.js');
fs.writeFileSync(out, head + 'const PET_DATA = ' + JSON.stringify(D) + ';\n');
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0), 'KB');
console.log('full cohort computed', JSON.stringify(nets[0].computed), 'shrink', r2(shrink));
console.log('pairs', PAIRS.map(p => `${p.a}-${p.b} paper ${p.paper} r ${p.r} partial ${p.pr}`).join('; '));
for (const x of nets.slice(2)) console.log(x.id, 'printed', x.density, 'computed', x.computed.density * 100, 'disorder', x.computed.disorder, 'hubs', x.computed.hubs.join(' '));
