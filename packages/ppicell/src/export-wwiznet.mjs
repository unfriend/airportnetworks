// The story's network as a dataset for wwiznet (asdf10k), the Menche lab's 3D network explorer, from the command line
// (SPEC.md, "Export for wwiznet"): the same files the Network tab's *Export for wwiznet* makes, from the same code. The
// cell set itself runs here (three.js r128 and the kit, no drawing) so every dot stands where the page draws it; then
// src/sets/pwiz.js writes the files.
// usage: node packages/ppicell/src/export-wwiznet.mjs <out folder> [options]
//   --links 500|1000|2000|4000|8000   links drawn (marks drawn_c; the hairball follows them)        (the address's &links=)
//   --support 1..4                    the least support (kinds of evidence, or a chosen network's score steps)  (&support=)
//   --rel esau                        the Atlas's reliability levels counted (letters)               (&rel=)
//   --places 0,1,...,12               the places counted                                              (&places=)
//   --group on|off                    communities                                                     (&group=off)
//   --sides carried|named|none        membrane sides (default carried, the story's)
//   --faces strict|generous           the reading of unknown sides (default strict)
//   --show possible|gates|impossible|all  what counts as drawn (default impossible: the three verdicts)
//   --edges judged|all|drawn          the links written (default judged: every contact link judged)
//   --copies all|main                 a node per protein and place (default) or per protein at its main place
//   --net <pairs file>                a network of your own (the Network tab's format), mapped with data/lookup.json
//   --key <key> --label <text>        the dataset's key (folder name) and label
// Writes <out folder>/nodes.tsv, edges.tsv, config.json, custom_windows/, data_description.txt; and data/index.json
// beside it when the out folder's parent has none (wwiznet needs one: data-folder-setup.md, section 1), else prints the
// line to add. The same inputs give the same files, byte for byte.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..', '..', '..');

// the cell set in a context of its own: three.js, the kit, the data and the sets the cell needs
export function loadCell() {
  const ctx = { console, performance, TextEncoder, Buffer, atob: s => Buffer.from(s, 'base64').toString('binary'), SETS: {} };
  ctx.self = ctx;
  vm.createContext(ctx);
  const run = (file, name) => vm.runInContext(fs.readFileSync(file, 'utf8').replace(/^if \(typeof module !== 'undefined'\) module\.exports = .*\n/m, ''), ctx, { filename: name });
  run(path.join(root, 'three.min.js'), 'three.min.js');
  run(path.join(root, 'tools', 'engine', 'kit.js'), 'kit.js');
  for (const f of ['data', 'pdata', 'sides', 'psides', 'pnet', 'pwiz', 'cell']) run(path.join(here, 'sets', f + '.js'), f + '.js');
  const set = vm.runInContext('SETS.cell(makeKit(THREE))', ctx);
  const g = n => vm.runInContext(n, ctx);
  return { api: set.api(), params: set.params, PNET: g('PNET'), PWIZ: g('PWIZ'), PDATA: g('PDATA') };
}

const ARGS = { links: 1, support: 1, rel: 1, places: 1, group: 1, sides: 1, faces: 1, show: 1, edges: 1, copies: 1, net: 1, key: 1, label: 1 };
export function parseArgs(argv) {
  const o = { out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (!ARGS[k] || i + 1 >= argv.length) throw new Error(`Unknown option or no value: ${a}`);
      o[k] = argv[++i];
    } else if (!o.out) o.out = a; else throw new Error(`One out folder only: ${a}`);
  }
  return o;
}

// the options made into the cell's params (checked as the Network tab checks its buttons) and the export's
export function exportWith(C, o) {
  const p = { cell_live: 0 };
  const pick = (k, map) => { if (o[k] === undefined) return undefined; if (!(o[k] in map)) throw new Error(`--${k}: one of ${Object.keys(map).join(', ')}`); return map[o[k]]; };
  let name = '';
  if (o.net) {
    const text = fs.readFileSync(o.net, 'utf8'), R = C.PNET.parse(text);
    if (R.error) throw new Error(R.error);
    const LK = C.PNET.decodeLookup(JSON.parse(fs.readFileSync(path.join(here, '..', 'data', 'lookup.json'), 'utf8')));
    name = path.basename(o.net);
    const M = C.PNET.fromRows(R, LK, name);
    if (!M.model) throw new Error('No pair of the file names two proteins found.');
    C.api.own(M.model); p.cell_own = 1;
  }
  if (o.links !== undefined) { const v = parseInt(o.links, 10); if (!C.api.tops.includes(v)) throw new Error(`--links: one of ${C.api.tops.join(', ')}`); p.cell_top = v; }
  if (o.support !== undefined) { const v = parseInt(o.support, 10) - 1, n = C.api.steps(!!o.net).length; if (!(v >= 0 && v < n)) throw new Error(`--support: 1 to ${n}`); p.cell_sup = v; }
  if (o.rel !== undefined) { const q = o.rel.toLowerCase(); p.cell_rel = 1 | [['e', 4], ['s', 3], ['a', 2], ['u', 1]].reduce((m, [c, b]) => (q.includes(c) ? m | 1 << b : m), 0); if (!(p.cell_rel & 30)) throw new Error('--rel: letters e s a u'); }
  if (o.places !== undefined) { p.cell_pls = o.places.split(',').map(x => parseInt(x, 10)).filter(k => k >= 0 && k < 13).reduce((m, k) => m | 1 << k, 0); if (!p.cell_pls) throw new Error('--places: place numbers 0 to 12'); }
  const grp = pick('group', { on: 1, off: 0 }), sd = pick('sides', { carried: 2, named: 1, none: 0 }), fc = pick('faces', { strict: 0, generous: 1 }), sh = pick('show', { possible: 0, gates: 1, impossible: 2, all: 3 });
  if (grp !== undefined) p.cell_grp = grp;
  if (sd !== undefined) p.cell_sides = sd;
  if (fc !== undefined) p.cell_faces = fc;
  p.cell_show = sh === undefined ? (o.edges === 'all' ? 3 : 2) : sh;
  pick('edges', { judged: 1, all: 1, drawn: 1 }); pick('copies', { all: 1, main: 1 });
  if (o.key !== undefined && !/^[a-z0-9][a-z0-9_-]*$/.test(o.key)) throw new Error('--key: lower-case letters, digits, _ and -');
  const d = C.api.wiz(p);
  return C.PWIZ.files(d, { copies: o.copies, edges: o.edges, key: o.key, label: o.label, name });
}

export function writeOut(C, out, res) {
  for (const [f, t] of Object.entries(res.files)) { const fp = path.join(out, f); fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, t); }
  const idx = path.join(path.dirname(path.resolve(out)), 'index.json'), entry = Object.assign({}, res.entry, { folder: path.basename(path.resolve(out)) });
  if (!fs.existsSync(idx)) {
    fs.writeFileSync(idx, JSON.stringify({ version: 2, default: entry.key, datasets: [entry] }, null, 2) + '\n');
    return `wrote ${idx} (no index.json there: wwiznet needs one), with this dataset as the default`;
  }
  let listed = false;
  try { listed = (JSON.parse(fs.readFileSync(idx, 'utf8')).datasets || []).some(x => x.key === entry.key); } catch (e) { /* not JSON: say what to add */ }
  return listed ? `${idx} lists ${entry.key} already` : `add to "datasets" in ${idx}:\n  ${JSON.stringify(entry)}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const o = parseArgs(process.argv.slice(2));
    if (!o.out) throw new Error('usage: node packages/ppicell/src/export-wwiznet.mjs <out folder> [options] (the options: this file\'s first lines)');
    const t0 = performance.now(), C = loadCell(), res = exportWith(C, o), t1 = performance.now();
    const msg = writeOut(C, o.out, res), c = res.counts;
    console.log(`${o.out}: ${c.nodes.toLocaleString('en-GB')} nodes, ${c.edges.toLocaleString('en-GB')} edges (${c.links.toLocaleString('en-GB')} links: ${c.possible} possible, ${c.gate} through a gate, ${c.impossible} impossible, ${c.notContact} not a contact, ${c.unplaced} with an end without a place; ${c.ties} ties between copies) in ${((t1 - t0) / 1000).toFixed(1)} s`);
    for (const f of Object.keys(res.files)) console.log(`  ${f} ${(Buffer.byteLength(res.files[f]) / 1024).toFixed(0)} KB`);
    console.log(msg);
  } catch (e) { console.error(e.message); process.exit(1); }
}
