// Writes tools/ovary/sets/data.js (OVARY_DATA) for the aging ovary story: the poster's numbers (typed in below, exactly
// as printed), the values the story uses of those read off its figures (data/figures.json: the trend lines, the shares
// of donors with none, the comparison lines' slopes) and the 255 donors' ages in whole years, filling the histogram's
// bars (seeded, so the same every time).
// usage (from the repository root): node tools/ovary/data/gen_data.mjs
// The poster: "Mapping the histological landscape of human ovarian aging", Parijat Chakraborty, Samir Moustafa, André
// Rendeiro (LBI for Network Medicine; CeMM; Faculty of Computer Science, University of Vienna). Public; the owner
// confirmed (2026-10-22) it may be used. No per-donor data exists here: the poster plots one dot per donor, the story
// shows no dots (its charts went in October 2026; until then it drew an illustrative cohort, generated here: in the
// history). The bands and axes read off the figures stay in figures.json, unused.
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
// the order of the trend charts on the poster (2 x 2: top row, then bottom row), for lists
const CHART_ORDER = ['vessel', 'albicans', 'follicle', 'macrophage'];
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
    zero: DECADES.map(d => t.zeroShare.find(q => q.decade === d).share),
  };
}
const COMPARE = {};
for (const c of FIG.compare) COMPARE[c.object] = { slope: c.slope, intercept: c.intercept };

// ------------------------------------------------------------- the donors' ages --
// 255 whole ages filling the poster's bars (each bar spread evenly over its span, a little jittered): the histogram's
// slides stack on them. The poster gives only the bars.
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const R = rng(20261022);
const AGES = [];
HIST.counts.forEach((n, k) => {
  const a0 = HIST.from + HIST.width * k;
  for (let i = 0; i < n; i++) AGES.push(Math.min(70, Math.max(21, Math.round(a0 + HIST.width * (i + 0.5 + 0.6 * (R() - 0.5)) / n))));
});
if (AGES.length !== FACTS.donors) throw new Error(`the histogram sums to ${AGES.length}, not ${FACTS.donors}`);
const COHORT = { note: 'the donors\' ages in whole years, filling the poster\'s histogram bars (it gives only the bars)', age: AGES };

// ------------------------------------------------------------- checks --
const f1 = (p, r) => Math.round(200 * p * r / (p + r)) / 100;
const CHECKS = {
  f1: Object.fromEntries(KINDS.filter(k => k.rf).map(k => [k.key, { printed: k.rf.f1, computed: f1(k.rf.precision, k.rf.recall) }])),
  histSum: HIST.counts.reduce((s, v) => s + v, 0),
  annotated: KINDS.reduce((s, k) => s + (k.annotated || 0), 0),
};

// ------------------------------------------------------------- write --
const D = {
  source: SOURCE, facts: FACTS, hist: HIST, kinds: KINDS, chartOrder: CHART_ORDER, methods: METHODS,
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
//   chartOrder        the order of the poster's 2 x 2 trend charts (vessel, albicans, follicle, macrophage), for lists
//   methods           rf, seg: { short, name, title, dot and line colours (the poster's), steps }
//   trends            read: per kind and method { line: [[age, count]] (the fitted line, every 5 years from 21; a line
//                     with zeroAge falls to 0 there: the lines read as straight lines in counts), zeroAge, zero: per
//                     decade 20s..60s the share of donors (the poster's dots) at 0 }: the ovary's tags and the explore
//                     Age pane give counts on these lines, approximate
//   compare           read: per kind { slope, intercept } (the comparison chart's fitted line, segmentation = intercept
//                     + slope x random forest): a slope below 1 is where the segmentation finds fewer
//   message           the poster's message (why, reserve, approach) and future directions
//   background        textbook numbers (to be said with "about"): follicle stages, follicles at birth, puberty and
//                     menopause, the average age at menopause
//   cohort            age[255]: the donors' ages in whole years, filling the histogram's bars (the poster gives only the
//                     bars; the slides of the Donors chapter stack on them)
//   checks            f1 printed and computed from precision and recall (blood vessel: 0.86 printed, 0.84 computed),
//                     the histogram's sum, the annotated objects' sum
`;
fs.writeFileSync(OUT, head + 'const OVARY_DATA = ' + JSON.stringify(D) + ';\n');
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
console.log('checks', JSON.stringify(CHECKS));
