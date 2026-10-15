// Decode NET_B64 from stories/airports.js and write airports.json plus a compact
// lat/lon string (0.1 degree, 4 base-64 chars per airport) and its decoder.
// Usage: node extract_airports.mjs [path/to/airports.js] [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] || path.join(here, '../../../stories/airports.js');
const out = process.argv[3] || here;

// Pull the NET_B64 literal out without evaluating the story file.
const js = fs.readFileSync(src, 'utf8');
const m = js.match(/const NET_B64="([A-Za-z0-9+/=]+)"/);
if (!m) throw new Error('NET_B64 not found');
const u8 = new Uint8Array(Buffer.from(m[1], 'base64'));
const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

// Same layout as the NET decoder in stories/airports.js (little endian):
// u32 N, u32 E, u32 K | i16 lat*100 [N] | i16 lon*100 [N] | u16 degree [N] |
// f32 betweenness [N] | u8 community [N] | (u16 u, u16 v) [E] | u16 random-removal list [K] |
// UTF-8 text: code, city, country, name blocks split by \0, entries by \n.
const N = dv.getUint32(0, true), E = dv.getUint32(4, true), K = dv.getUint32(8, true);
let o = 12;
const lat = [], lon = [], deg = [], btw = [], comm = [];
for (let i = 0; i < N; i++, o += 2) lat.push(dv.getInt16(o, true) / 100);
for (let i = 0; i < N; i++, o += 2) lon.push(dv.getInt16(o, true) / 100);
for (let i = 0; i < N; i++, o += 2) deg.push(dv.getUint16(o, true));
for (let i = 0; i < N; i++, o += 4) btw.push(dv.getFloat32(o, true));
for (let i = 0; i < N; i++) comm.push(u8[o++]);
const routes = [];
for (let e = 0; e < E; e++, o += 4) routes.push([dv.getUint16(o, true), dv.getUint16(o + 2, true)]);
o += 2 * K;
const [code, city, country, name] = new TextDecoder().decode(u8.subarray(o)).split('\0').map(p => p.split('\n'));

// Sanity checks: degree column matches the edge list, text blocks have N entries.
const d2 = new Array(N).fill(0);
routes.forEach(([a, b]) => { d2[a]++; d2[b]++; });
const degOk = d2.every((d, i) => d === deg[i]);
const r2 = x => Math.round(x * 100) / 100;

fs.writeFileSync(path.join(out, 'airports.json'),
  JSON.stringify({ airports: lat.map((la, i) => [r2(la), r2(lon[i]), deg[i], code[i]]), routes }));

// Compact form: per airport 2 chars lat + 2 chars lon, each a 12-bit value in a
// 64-char alphabet. lat -> round(lat*10)+900 (0..1800), lon -> round(lon*10)+1800 (0..3600).
const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const enc12 = v => AL[v >> 6] + AL[v & 63];
let s = '';
for (let i = 0; i < N; i++) {
  const a = Math.round(lat[i] * 10) + 900, b = Math.round(lon[i] * 10) + 1800;
  if (a < 0 || a > 4095 || b < 0 || b > 4095) throw new Error('out of range at ' + i);
  s += enc12(a) + enc12(b);
}
fs.writeFileSync(path.join(out, 'airports_compact.txt'), `'${s}'`);

const decoder = `// Decodes the airports_compact.txt string: 4 chars per airport (2 lat, 2 lon),
// 0.1 degree steps, same order (and indices) as airports.json and NET in stories/airports.js.
function decodeLatLon(s) {
  const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const v = k => AL.indexOf(s[k]) * 64 + AL.indexOf(s[k + 1]);
  const n = s.length / 4, lat = new Float32Array(n), lon = new Float32Array(n);
  for (let i = 0; i < n; i++) { lat[i] = (v(4 * i) - 900) / 10; lon[i] = (v(4 * i + 2) - 1800) / 10; }
  return { n, lat, lon };
}
if (typeof module !== 'undefined') module.exports = { decodeLatLon };
`;
fs.writeFileSync(path.join(out, 'airports_decoder.js'), decoder);

// Round-trip check through the decoder file itself.
const mod = { exports: {} };
new Function('module', decoder)(mod);
const lit = fs.readFileSync(path.join(out, 'airports_compact.txt'), 'utf8');
const dec = mod.exports.decodeLatLon(lit.slice(1, -1));
let maxErr = 0;
for (let i = 0; i < N; i++) maxErr = Math.max(maxErr, Math.abs(dec.lat[i] - lat[i]), Math.abs(dec.lon[i] - lon[i]));

const dup = code.filter((c, i) => code.indexOf(c) !== i);
const ord = deg.map((d, i) => i).sort((a, b) => deg[b] - deg[a]);
console.log(JSON.stringify({
  N, E, K, textEntries: [code.length, city.length, country.length, name.length], degOk,
  latRange: [Math.min(...lat), Math.max(...lat)], lonRange: [Math.min(...lon), Math.max(...lon)],
  maxDeg: Math.max(...deg), dupCodes: [...new Set(dup)].slice(0, 10), nDup: dup.length,
  communities: Math.max(...comm) + 1,
  top5: ord.slice(0, 5).map(i => `${code[i]} ${city[i]} (${country[i]}) deg ${deg[i]}`),
  sample0: [code[0], city[0], country[0], name[0], lat[0], lon[0]],
  bytes: Object.fromEntries(['airports.json', 'airports_compact.txt', 'airports_decoder.js']
    .map(f => [f, fs.statSync(path.join(out, f)).size])),
  roundTrip: { n: dec.n, maxErr: +maxErr.toFixed(4), ok: dec.n === N && maxErr <= 0.06 },
}, null, 1));
