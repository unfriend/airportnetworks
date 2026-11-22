// The protein models the sets draw (src/models.json, built by tools/mol/build.py into the package's models/ folder;
// drawn by the engine's molMesh and molInstanced). molPrep(names): a set's prep, true once its models have come (the
// first call starts fetching every model the story uses, so they load side by side while the sets build). molCredit:
// a model's credit ('PDB 1GRI (Maignan et al., Science 1995)'). molPts: its residues' anchors (angstroms, the model's
// frame); molAxis: the longest axis of such points (models built with orient: false, cut from one entry, line up).
const MOL_URL = f => pkgUrl('models/' + f);
const MOL_ALL = ['grb2', 'tp53', 'stat3a', 'stat3b', 'stat3dna', 'b2ar', 'ras', 'raf', 'igg', 'bira', 'jak2', 'p300', 'ubq', 'cam', 'actin', 'gapdh', 'tub', 'fxn',
  'egfr', 'erbb2', 'met', 'kit', 'shc1', 'sos1', 'cbl', 'dnm1'];
const molPrep = names => () => { molLoad(MOL_URL, MOL_ALL); return molReady(MOL_URL, names); };
const molHead = n => (MOLS.m[n] && MOLS.m[n].head) || null;
const molCredit = n => (molHead(n) ? molHead(n).credit : '');
const molPts = n => { const m = MOLS.m[n]; return m && m.res ? Array.from({ length: m.res.n }, (_, i) => Array.from(m.res.pos.subarray(3 * i, 3 * i + 3))) : []; };
// the principal axis of a list of points (power iteration on the covariance) and their middle
function molAxis(P) {
  const n = P.length || 1, m = [0, 1, 2].map(j => P.reduce((t, p) => t + p[j], 0) / n), C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of P) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[3 * a + b] += (p[a] - m[a]) * (p[b] - m[b]);
  let v = [1, 0.3, 0.2];
  for (let k = 0; k < 40; k++) { const w = [0, 1, 2].map(a => C[3 * a] * v[0] + C[3 * a + 1] * v[1] + C[3 * a + 2] * v[2]), l = Math.hypot(...w) || 1; v = w.map(x => x / l); }
  let lo = Infinity, hi = -Infinity;
  for (const p of P) { const d = (p[0] - m[0]) * v[0] + (p[1] - m[1]) * v[1] + (p[2] - m[2]) * v[2]; lo = Math.min(lo, d); hi = Math.max(hi, d); }
  return { dir: v, mid: m, span: hi - lo };
}
