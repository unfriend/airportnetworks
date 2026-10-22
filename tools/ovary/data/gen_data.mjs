// Writes tools/ovary/sets/data.js (OVARY_DATA) for the aging ovary story: the poster's numbers (typed in below, exactly
// as printed), the values read off its figures (data/figures.json) and an illustrative cohort of 255 donors drawn to
// follow them (seeded, so the same every time).
// usage (from the repository root): node tools/ovary/data/gen_data.mjs
// The poster: "Mapping the histological landscape of human ovarian aging", Parijat Chakraborty, Samir Moustafa, André
// Rendeiro (LBI for Network Medicine; CeMM; Faculty of Computer Science, University of Vienna). Public; the owner
// confirmed (2026-10-22) it may be used. No per-donor data exists here: the poster plots one dot per donor, the story
// draws dots generated to match its trend lines, bands and shares at zero (and about its r), and says so.
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname);
const FIG = JSON.parse(fs.readFileSync(path.join(here, 'figures.json'), 'utf8'));
const OUT = path.join(here, '../sets/data.js');

// ------------------------------------------------------------- the poster (typed in) --
const SOURCE = {
  poster: 'Chakraborty P, Moustafa S, Rendeiro A. Mapping the histological landscape of human ovarian aging (poster).',
  title: 'Mapping the histological landscape of human ovarian aging',
  authors: [
    { name: 'Parijat Chakraborty', aff: [1] },
    { name: 'Samir Moustafa', aff: [2, 3] },
    { name: 'André Rendeiro', aff: [1, 3] },
  ],
  affiliations: [
    'Ludwig Boltzmann Institute for Network Medicine at the University of Vienna',
    'CeMM Research Center for Molecular Medicine of the Austrian Academy of Sciences',
    'Faculty of Computer Science, University of Vienna',
  ],
  support: ['CeMM', 'the European Research Council (ERC)'],
  data: 'GTEx (the Genotype-Tissue Expression project)',
};
const FACTS = {
  donors: 255, ages: [20, 70], data: ['H&E histology', 'bulk RNA-seq', 'clinical and demographic information'],
  scale: { young: '1.58 mm', old: '791 µm' },
};
// the donors' ages: 20 bars from 21 to 70, each 2.45 years wide
const HIST = { from: 21, width: 2.45, counts: [9, 6, 10, 5, 7, 6, 3, 5, 13, 10, 9, 25, 15, 25, 15, 14, 12, 21, 25, 20] };
// the four kinds of object (the poster's table and colors), and the cyst, which only the segmentation has
const KINDS = [
  { key: 'vessel', name: 'blood vessel', plural: 'blood vessels', title: 'Blood vessels', color: '#8e9dba', annotated: 8706,
    rf: { precision: 0.81, recall: 0.88, f1: 0.86 }, iou: 0.84,
    trend: { rf: { r: -0.24, p: 2.1e-4 }, seg: { r: -0.43, p: 8.3e-12 } }, compare: { r: 0.78, p: 2.2e-47 } },
  { key: 'macrophage', name: 'macrophage', plural: 'macrophages', title: 'Macrophage', color: '#a4b58a', annotated: 5540,
    rf: { precision: 0.96, recall: 0.79, f1: 0.87 }, iou: 0.95,
    trend: { rf: { r: 0.05, p: 0.497 }, seg: { r: -0.29, p: 7.8e-6 } }, compare: { r: 0.51, p: 3.7e-16 } },
  { key: 'albicans', name: 'corpus albicans', plural: 'corpora albicantia', title: 'Corpus albicans', color: '#ad60bf', annotated: 421,
    rf: { precision: 0.87, recall: 0.89, f1: 0.88 }, iou: 0.97,
    trend: { rf: { r: 0.40, p: 5.7e-10 }, seg: { r: 0.25, p: 1.2e-4 } }, compare: { r: 0.41, p: 1.2e-10 } },
  { key: 'follicle', name: 'follicle', plural: 'follicles', title: 'Follicle', color: '#402580', annotated: 274,
    rf: { precision: 0.87, recall: 0.80, f1: 0.83 }, iou: 0.70,
    trend: { rf: { r: -0.48, p: 1.5e-14 }, seg: { r: -0.48, p: 1.8e-14 } }, compare: { r: 0.94, p: 1.4e-13 } },
  // (the poster gives no colour for cysts: this one is the story's own)
  { key: 'cyst', name: 'cyst', plural: 'cysts', title: 'Cyst', color: '#d9a05b', segOnly: true, iou: 0.15 },
];
// the order of the trend and comparison charts on the poster (2 x 2: top row, then bottom row)
const CHART_ORDER = ['vessel', 'albicans', 'follicle', 'macrophage'];
// the trend charts' y axes as printed (a log scale with a row for 0 at the place of 0.5) and the comparison charts'
// linear axes (maxima as read)
const AXES = {
  vessel: { ticks: [50, 100, 200, 500, 1000, 2000], min: 25, max: 3200, cmpTicks: [0, 500, 1000, 1500, 2000] },
  albicans: { ticks: [0, 2, 10, 50, 200, 1000], min: 0, max: 1500, cmpTicks: [0, 200, 400, 600, 800] },
  follicle: { ticks: [0, 2, 10, 50, 200], min: 0, max: 300, cmpTicks: [0, 40, 80, 120, 160] },
  macrophage: { ticks: [0, 1, 5, 20, 100, 500], min: 0, max: 600, cmpTicks: [0, 100, 200, 300] },
};
const METHODS = {
  rf: { key: 'rf', short: 'RF', name: 'random forest', title: 'Tile-level classification', dot: '#4078b0', line: '#004898',
    steps: ['tissue tiling', 'label assignment', 'feature extraction with UNI2 (a pathology foundation model)', 'random forest classification', 'tile prediction'] },
  seg: { key: 'seg', short: 'Seg', name: 'segmentation', title: 'Semantic segmentation', dot: '#c87060', line: '#b03828',
    steps: ['label assignment', 'semantic segmentation with SegFormer', 'mask prediction'] },
};
const MESSAGE = {
  why: 'The ovary is highly susceptible to age-related decline (loss of follicles, profound morphological changes), which shapes female reproductive lifespan.',
  reserve: 'The ovarian reserve cannot be measured directly; AMH and FSH, widely used as indirect markers, cannot accurately reflect the true follicle reserve.',
  approach: 'Histology with deep learning maps the ovary\'s microanatomy and finds features linked to ovarian fitness.',
  future: [
    'study the spatial relationships between ovarian features',
    'monitor how age affects the positional distribution of the microanatomical domains',
    'validate in independent cohorts',
  ],
};
// textbook background (to be worded with "about")
const BACKGROUND = {
  stages: ['primordial', 'primary', 'secondary', 'antral'],
  atBirth: [1e6, 2e6], atPuberty: [300000, 400000], atMenopause: 1000, menopauseAge: 51,
  notes: [
    'follicles mature from primordial to primary, secondary and antral follicles',
    'after ovulation the follicle becomes a corpus luteum, which shrinks to a pale scar of collagen, the corpus albicans, so scars accumulate over the years',
    'AMH comes from the granulosa cells of growing follicles; FSH rises as the reserve falls',
  ],
};

// ------------------------------------------------------------- the figures (read off) --
const DECADES = ['20s', '30s', '40s', '50s', '60s'];
const TRENDS = {};
for (const t of FIG.trends) {
  const o = TRENDS[t.object] || (TRENDS[t.object] = {});
  o[t.method] = {
    line: t.line.filter(p => p.count !== null).map(p => [p.age, p.count]),
    zeroAge: t.zeroAge,
    band: DECADES.map(d => { const b = t.band.find(q => q.decade === d); return [b.lo, b.mid, b.hi]; }),
    zero: DECADES.map(d => t.zeroShare.find(q => q.decade === d).share),
  };
}
const COMPARE = {};
for (const c of FIG.compare) COMPARE[c.object] = { slope: c.slope, intercept: c.intercept, xMax: c.xMax, yMax: c.yMax };

// the fitted line at an age: the lines read as straight lines in counts (drawn on the log axis), so linear between the
// readings; a line with a zero age falls to 0 there and stays at 0
function lineAt(o, m, age) {
  const T = TRENDS[o][m], L = T.line.slice();
  if (T.zeroAge) L.push([T.zeroAge, 0]);
  if (age <= L[0][0]) return L[0][1];
  for (let i = 1; i < L.length; i++) if (age <= L[i][0]) { const [a0, c0] = L[i - 1], [a1, c1] = L[i]; return c0 + (c1 - c0) * (age - a0) / (a1 - a0); }
  return T.zeroAge ? 0 : L[L.length - 1][1];
}

// ------------------------------------------------------------- the illustrative cohort --
// 255 donors with the poster's ages (each bar of the histogram filled with whole ages in its span) and, per kind of
// object and method, a count drawn from the bands read off the charts: per decade a quantile function through 0 (as
// many as the share at zero), the 10th, 50th and 90th percentiles (lo, mid, hi) and a top, in log counts, eased
// between decades. The two methods' counts of a donor are tied by a correlation chosen so that the comparison chart
// gives about the poster's r, and the spread around each decade's median is scaled so that the trend chart gives about
// the poster's r. Both are Pearson's r on counts: the poster does not say which r it uses (an open question), but its
// fitted lines are straight lines in counts, and with the bands as read (spread unscaled) Pearson's r on counts comes
// closest to the printed ones (ranks or log counts give follicle r of -0.7 and more).
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const R = rng(20261022);
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
// the standard normal distribution function (Abramowitz and Stegun 7.1.26)
const Phi = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2); return 0.5 * (1 + Math.sign(x) * y); };
const AGES = [];
HIST.counts.forEach((n, k) => {
  const a0 = HIST.from + HIST.width * k;
  for (let i = 0; i < n; i++) AGES.push(Math.min(70, Math.max(21, Math.round(a0 + HIST.width * (i + 0.5 + 0.6 * (R() - 0.5)) / n))));
});
const N = AGES.length;
if (N !== FACTS.donors) throw new Error(`the histogram sums to ${N}, not ${FACTS.donors}`);
// a donor's place in its decade's distribution: u in [0, 1) -> count, eased between decade centres (25, 35, ...)
const L10 = Math.log10;
function knots(o, m, d, cap) {
  const [lo, mid, hi] = TRENDS[o][m].band[d], z = TRENDS[o][m].zero[d];
  const top = Math.min(cap, hi * Math.max(1.6, Math.sqrt(hi / Math.max(mid, 1))));
  const first = lo > 0 && z < 0.1 ? Math.max(1, lo * 0.45) : 1;
  const K = [[z, first], [0.1, lo], [0.5, mid], [0.9, hi], [1, top]].filter(([u, v]) => u >= z && (u === z || v > 0));
  for (let i = 1; i < K.length; i++) K[i][1] = Math.max(K[i][1], K[i - 1][1] * 1.02);   // (increasing)
  return { z, K: K.map(([u, v]) => [u, L10(v)]) };
}
function quantile(Q, u) {
  if (u < Q.z) return -Infinity;
  const K = Q.K;
  if (u <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (u <= K[i][0]) return K[i - 1][1] + (K[i][1] - K[i - 1][1]) * (u - K[i - 1][0]) / (K[i][0] - K[i - 1][0]);
  return K[K.length - 1][1];
}
const decAt = age => { const x = Math.min(4, Math.max(0, (age - 25) / 10)), d = Math.min(3, Math.floor(x)); return [d, x - d]; };
function countOf(o, m, age, u, k, cap) {
  const [d, f] = decAt(age), A = knots(o, m, d, cap), B = knots(o, m, d + 1, cap);
  const z = A.z + (B.z - A.z) * f;
  if (u < z) return 0;
  // (u rescaled into each decade's part above zero, so the share at zero eases too)
  const ua = A.z + (u - z) / (1 - z) * (1 - A.z), ub = B.z + (u - z) / (1 - z) * (1 - B.z);
  const qa = quantile(A, ua), qb = quantile(B, ub), q = qa + (qb - qa) * f;
  const mid = L10(Math.max(1, TRENDS[o][m].band[d][1])) * (1 - f) + L10(Math.max(1, TRENDS[o][m].band[d + 1][1])) * f;
  const v = Math.pow(10, mid + k * (q - mid));
  return Math.max(1, Math.min(cap, Math.round(v)));
}
// ranks (ties averaged), Spearman and Pearson
function ranks(a) {
  const ix = a.map((v, i) => i).sort((i, j) => a[i] - a[j]), r = new Array(a.length);
  for (let i = 0; i < ix.length;) { let j = i; while (j + 1 < ix.length && a[ix[j + 1]] === a[ix[i]]) j++; for (let q = i; q <= j; q++) r[ix[q]] = (i + j) / 2 + 1; i = j + 1; }
  return r;
}
function pearson(x, y) {
  const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy || 1);
}
const spearman = (x, y) => pearson(ranks(x), ranks(y));
// bisection on a monotone quantity
function solve(f, target, a, b, inc) {
  let fa = f(a), fb = f(b);
  if ((inc ? fa : -fa) >= (inc ? target : -target)) return a;
  if ((inc ? fb : -fb) <= (inc ? target : -target)) return b;
  for (let it = 0; it < 30; it++) { const m = (a + b) / 2, fm = f(m); if ((inc ? fm < target : fm > target)) a = m; else b = m; }
  return (a + b) / 2;
}
const COHORT = { note: 'illustrative: drawn to follow the poster\'s trend lines, bands and shares at zero, not the donors\' values', age: AGES, rho: {}, k: {}, r: {} };
for (const o of CHART_ORDER) {
  const capRF = Math.min(AXES[o].max, COMPARE[o].xMax), capSeg = Math.min(AXES[o].max, COMPARE[o].yMax);
  const z1 = AGES.map(() => gauss(R)), e = AGES.map(() => gauss(R));
  const kd = KINDS.find(q => q.key === o);
  let rho = 0.6, kRF = 1, kSeg = 1;
  const draw = (rh, k1, k2) => {
    const rf = [], seg = [];
    for (let i = 0; i < N; i++) {
      const z2 = rh * z1[i] + Math.sqrt(1 - rh * rh) * e[i];
      rf.push(countOf(o, 'rf', AGES[i], Phi(z1[i]), k1, capRF)); seg.push(countOf(o, 'seg', AGES[i], Phi(z2), k2, capSeg));
    }
    return { rf, seg };
  };
  // (three rounds: the methods' correlation for the comparison, then the spreads for the trends; the trends' r falls
  // as the spread grows, the comparison's r rises with the correlation)
  for (let round = 0; round < 3; round++) {
    rho = solve(rh => { const D = draw(rh, kRF, kSeg); return pearson(D.rf, D.seg); }, kd.compare.r, 0, 0.995, true);
    for (const m of ['rf', 'seg']) {
      const target = kd.trend[m].r;
      const f = k => { const D = draw(rho, m === 'rf' ? k : kRF, m === 'seg' ? k : kSeg); return pearson(AGES, D[m]); };
      // |r| falls as k grows: solve -|r| (increasing in k) for -|target|
      const k = solve(kk => -Math.sign(target || 1) * f(kk), -Math.abs(target), 0.2, 2.2, true);
      if (m === 'rf') kRF = k; else kSeg = k;
    }
  }
  const D = draw(rho, kRF, kSeg);
  COHORT[o] = D;
  const r3 = x => Math.round(x * 1000) / 1000;
  COHORT.rho[o] = r3(rho); COHORT.k[o] = { rf: r3(kRF), seg: r3(kSeg) };
  COHORT.r[o] = { rf: r3(pearson(AGES, D.rf)), seg: r3(pearson(AGES, D.seg)), compare: r3(pearson(D.rf, D.seg)), rfRank: r3(spearman(AGES, D.rf)), segRank: r3(spearman(AGES, D.seg)) };
}

// ------------------------------------------------------------- checks --
const f1 = (p, r) => Math.round(200 * p * r / (p + r)) / 100;
const CHECKS = {
  f1: Object.fromEntries(KINDS.filter(k => k.rf).map(k => [k.key, { printed: k.rf.f1, computed: f1(k.rf.precision, k.rf.recall) }])),
  histSum: HIST.counts.reduce((s, v) => s + v, 0),
  annotated: KINDS.reduce((s, k) => s + (k.annotated || 0), 0),
};

// ------------------------------------------------------------- write --
const D = {
  source: SOURCE, facts: FACTS, hist: HIST, kinds: KINDS, chartOrder: CHART_ORDER, axes: AXES, methods: METHODS,
  trends: TRENDS, compare: COMPARE, message: MESSAGE, background: BACKGROUND, cohort: COHORT, checks: CHECKS,
};
const head = `// OVARY_DATA: generated by tools/ovary/data/gen_data.mjs; never edit by hand.
// Source: ${SOURCE.poster} ${SOURCE.affiliations.map((a, i) => `(${i + 1}) ${a}`).join('; ')}. Support: ${SOURCE.support.join(' and ')}. Data: ${SOURCE.data}.
// Fields (numbers typed in exactly as the poster prints them; "read" = read off its figures, tools/ovary/data/figures.json):
//   source            the poster's title, authors (aff: indexes into affiliations, from 1), affiliations, support, data
//   facts             donors (255), ages ([20, 70]), data (what GTEx gives), scale (the example sections' scale bars)
//   hist              the age histogram: from (21), width (2.45 years), counts (20 bars, sum 255)
//   kinds[]           { key, name, plural, title (as on the charts), color (the poster's), annotated (training labels),
//                     rf { precision, recall, f1 } (random forest performance), iou (SegFormer), trend { rf, seg: { r, p } }
//                     (count against age), compare { r, p } (segmentation against random forest) }: vessel, macrophage,
//                     albicans, follicle (the poster's table order), then cyst (segOnly: only the segmentation has it; its
//                     colour is the story's own, the poster gives none)
//   chartOrder        the 2 x 2 order of the trend and comparison charts (vessel, albicans, follicle, macrophage)
//   axes              per kind: the trend chart's y ticks as printed (a log scale; 0 is drawn as a row at the place of
//                     0.5), min and max (read), and the comparison chart's ticks (linear)
//   methods           rf, seg: { short, name, title, dot and line colours (the poster's), steps }
//   trends            read: per kind and method { line: [[age, count]] (the fitted line, every 5 years from 21; a line
//                     with zeroAge falls to 0 there: the lines read as straight lines in counts), zeroAge, band: per
//                     decade 20s..60s [lo, mid, hi] (about the 10th, 50th and 90th percentiles of the dots), zero: per
//                     decade the share of dots at 0 }
//   compare           read: per kind { slope, intercept (the fitted line, segmentation = intercept + slope x random
//                     forest), xMax, yMax (axis maxima) }
//   message           the poster's message (why, reserve, approach) and future directions
//   background        textbook numbers (to be said with "about"): follicle stages, follicles at birth, puberty and
//                     menopause, the average age at menopause
//   cohort            ILLUSTRATIVE, not the donors' values: age[255] (whole years, filling the histogram's bars), and per
//                     kind { rf[255], seg[255] } counts per section drawn to follow the bands, shares at zero and lines;
//                     rho (the methods' tie), k (the spread's scale), r (what the drawn dots give: Pearson's r with age per
//                     method, rfRank and segRank Spearman's, compare Pearson's between the methods; compare with
//                     kinds[].trend and kinds[].compare)
//   checks            f1 printed and computed from precision and recall (blood vessel: 0.86 printed, 0.84 computed),
//                     the histogram's sum, the annotated objects' sum
`;
fs.writeFileSync(OUT, head + 'const OVARY_DATA = ' + JSON.stringify(D) + ';\n');
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
for (const o of CHART_ORDER) console.log(o, 'rho', COHORT.rho[o], 'k', JSON.stringify(COHORT.k[o]), 'r', JSON.stringify(COHORT.r[o]), 'poster', JSON.stringify({ rf: KINDS.find(k => k.key === o).trend.rf.r, seg: KINDS.find(k => k.key === o).trend.seg.r, compare: KINDS.find(k => k.key === o).compare.r }));
console.log('checks', JSON.stringify(CHECKS));
