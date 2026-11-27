// Stores the cell's layout in packages/spatial/main.js (LAYOUT_DATA), so the page need not solve it as it loads.
// usage (from the repository root): node packages/spatial/src/layout.mjs          -> writes LAYOUT_DATA when it changed
//                                   node packages/spatial/src/layout.mjs --check  -> writes nothing; exits 1 when it is not current
// Needs Playwright with Chromium, as tools/smoke.mjs does (PLAYWRIGHT_MODULE, CHROMIUM_PATH).
// It runs main.js's own data, network, cell and solveLayout() (the code from '// Spatial interactome data' up to the
// LAYOUT_DATA line) in headless Chromium and writes the result as base64 with layoutSig(): the page uses the stored
// layout only while that signature still matches, and solves it again otherwise. Why a browser and not Node: the
// layout's 380 relaxation steps magnify last-digit differences in sin, cos and acos, and Node 22 and Chromium 158 differ
// there (the cell moved by up to 0.11 of its radius between them), so the stored layout is the one Chromium itself makes.
// After it writes, rebuild the pass story (node packages/pass/src/build.mjs), which pastes this part of main.js.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const file = path.join(root, 'packages/spatial/main.js');
const src = fs.readFileSync(file, 'utf8');
const LINE = /^const LAYOUT_DATA = .*;$/m;
const a = src.indexOf('// Spatial interactome data'), m = LINE.exec(src);
if (a < 0 || !m) { console.error('layout.mjs: main.js has no "// Spatial interactome data" or LAYOUT_DATA line'); process.exit(2); }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const r = await page.evaluate(code => {
  const { sig, L } = new Function('document', 'getComputedStyle', code + '\nreturn { sig: layoutSig(), L: solveLayout() };')({}, () => ({}));
  return { sig, pos: Array.from(L.pos), inst: Array.from(L.inst), pores: Array.from(L.pores) };
}, src.slice(a, m.index));
const by = 'Chromium ' + browser.version();
await browser.close();
const b64 = t => Buffer.from(t.buffer, t.byteOffset, t.byteLength).toString('base64');
const line = `const LAYOUT_DATA = ${JSON.stringify({ sig: r.sig, by, pos: b64(Float32Array.from(r.pos)), inst: b64(Int32Array.from(r.inst)), pores: r.pores })};`;
const same = (x, y) => x.replace(/"by":"[^"]*",/, '') === y.replace(/"by":"[^"]*",/, '');   // (a newer Chromium that makes the same layout is current)
if (same(m[0], line)) { console.log(`packages/spatial/main.js LAYOUT_DATA is current (${by})`); process.exit(0); }
if (process.argv.includes('--check')) { console.log(`packages/spatial/main.js LAYOUT_DATA is out of date (${by} makes another layout): run node packages/spatial/src/layout.mjs`); process.exit(1); }
fs.writeFileSync(file, src.slice(0, m.index) + line + src.slice(m.index + m[0].length));
console.log(`packages/spatial/main.js LAYOUT_DATA written by ${by} (${line.length} bytes); rebuild the pass story: node packages/pass/src/build.mjs`);
