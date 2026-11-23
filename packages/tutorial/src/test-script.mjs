// The guide's script, checked in Node (a cheap check, run on dev too): the rules of packages/tutorial/src/SPEC.md section C at
// 30 Hz over the whole story and over practice's walks, in story time from SCRIPT and again in real time with the
// built story's NARRATION_SYNC (read from packages/tutorial/main.js: run this again after narrate.mjs or pace.mjs); every key
// inside its chapter; the tags in order; the sound cues in order and no more than 4 onsets in 3 s (a run marked seq
// aside); the network's degrees (the hub 6).
// usage (from the repository root): node packages/tutorial/src/test-script.mjs          -> exits 1 on a broken rule
//                                   node packages/tutorial/src/test-script.mjs --words  -> also counts the spoken words (at most 415)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '../../..');
const require = createRequire(import.meta.url);
const { GUIDE, SCRIPT, compileScript, evalGuide, gPos, moveSpeed, actorTracks, sortG } = require('./sets/script.js');
const bad = [], note = [];
const fail = s => bad.push(s);
const G = compileScript(SCRIPT, GUIDE.CH);
const C = Object.fromEntries(GUIDE.CH.map(c => [c.key, c]));
const T_END = GUIDE.T_END;
if (GUIDE.CH[GUIDE.CH.length - 1].b !== T_END) fail(`the last chapter ends at ${GUIDE.CH[GUIDE.CH.length - 1].b}, not T_END ${T_END}`);
// ---------------------------------------------------------------- every key inside its chapter
for (const c of GUIDE.CH) {
  const s = SCRIPT[c.key], len = c.b - c.a;
  if (!s) { fail(`no script for chapter ${c.key}`); continue; }
  const inside = (t, what) => { if (!(t >= 0 && t <= len + 1e-9)) fail(`${c.key}: ${what} at ${t} is outside the chapter (0 to ${len})`); };
  for (const who of ['g', 'c']) for (const k in s[who] || {}) for (const e of s[who][k]) {
    const t = typeof e === 'number' ? e : e[0];
    inside(t, `${who}.${k}`);
    if (['mv', 'l', 'r', 'tilt'].includes(k)) { inside(e[1], `${who}.${k} (end)`); if (e[1] < e[0]) fail(`${c.key}: ${who}.${k} ends before it starts`); }
  }
  for (const k of ['ray', 'target', 'lit', 'trails', 'card', 'quiet', 'ntag', 'tags', 'copyOn', 'name', 'menu']) for (const e of s[k] || []) { inside(e[0], k); inside(e[1], k + ' (end)'); }
  for (const k of ['dim', 'beads', 'signals']) for (const e of s[k] || []) inside(e[0], k);
}
// ---------------------------------------------------------------- the real clock (the built story's NARRATION_SYNC)
let SYNC = [[0, 0], [T_END, T_END]];
const built = path.join(root, 'packages/tutorial/main.js');
if (fs.existsSync(built)) {
  const m = fs.readFileSync(built, 'utf8').match(/const NARRATION_SYNC = (\[[\s\S]*?\n\]);/);
  if (m) SYNC = Function('return ' + m[1].replace(/\/\/[^\n]*/g, ''))();
} else note.push('no packages/tutorial/main.js yet: real time taken as story time');
const narrT = o => { for (let i = 1; i < SYNC.length; i++) if (o <= SYNC[i][1]) { const [n0, o0] = SYNC[i - 1], [n1, o1] = SYNC[i]; return n0 + (n1 - n0) * (o - o0) / (o1 - o0); } return SYNC[SYNC.length - 1][0] + (o - SYNC[SYNC.length - 1][1]); };
// ---------------------------------------------------------------- the moves: walks at most 0.7 m/s, glides at least 1.6 (story) / 1.3 (real)
function moves(A, who) {
  let from = GUIDE.PLACE.home;
  for (const m of A.mv) {
    const s = moveSpeed(from, m), to = GUIDE.PLACE[m[2]] || m[2];
    if (m[3] === 'walk' && s.L > 0.01) {
      if (s.v > 0.7 + 1e-9) fail(`${who}: the walk at ${m[0].toFixed(1)} s runs at ${s.v.toFixed(2)} m/s in story time (at most 0.7)`);
      const real = s.L / (narrT(m[1]) - narrT(m[0]) - Math.min(0.3, s.T / 2));
      if (real > 0.7 + 1e-9) fail(`${who}: the walk at ${m[0].toFixed(1)} s runs at ${real.toFixed(2)} m/s in real time (at most 0.7)`);
    }
    if (m[3] === 'glide') {
      if (s.v < 1.6) fail(`${who}: the glide at ${m[0].toFixed(1)} s runs at ${s.v.toFixed(2)} m/s in story time (at least 1.6)`);
      const real = s.L / (narrT(m[1]) - narrT(m[0]) - Math.min(0.1, s.T / 2));
      if (real < 1.3) fail(`${who}: the glide at ${m[0].toFixed(1)} s runs at ${real.toFixed(2)} m/s in real time (at least 1.3): lengthen it in story time`);
    }
    from = to;
  }
}
moves(G.g, 'guide'); moves(G.c, 'copy');
// ---------------------------------------------------------------- sampled at 30 Hz: the head's distance and height, the speed band
const LIVE = { head: [0, 1.6, 0], ray: null, panel: null };
function sample(Gc, t0, t1, who, real) {
  let band = 0, minD = Infinity, maxY = 0, prev = null;
  for (let t = t0; t <= t1; t += 1 / 30) {
    const F = evalGuide(Gc, t, LIVE);
    for (const [A, w] of [[F.g, 'guide'], [F.c, 'copy']]) {
      if (!A) continue;
      const d = Math.hypot(A.head[0], A.head[2]);
      if (d < minD) minD = d;
      if (d < 1.2 - 1e-6) fail(`${who}: the ${w}'s head comes ${d.toFixed(2)} m from the viewer's start at ${t.toFixed(2)} s (at least 1.2)`);
      if (A.head[1] > maxY) maxY = A.head[1];
    }
    // (the guide's speed over the last frame, on the story's or the real clock)
    if (prev) {
      const dt = real ? narrT(t) - narrT(t - 1 / 30) : 1 / 30, v = Math.hypot(F.g.p[0] - prev[0], F.g.p[1] - prev[1]) / dt;
      if (v > 0.85 && v < 1.15) { band += dt; if (band > 0.3 + 1e-6) { fail(`${who}: the guide moves between 0.85 and 1.15 m/s for more than 0.3 s at ${t.toFixed(2)} s (${real ? 'real' : 'story'} time)`); band = -1e9; } }
      else band = 0;
    }
    prev = F.g.p.slice();
  }
  if (maxY > 1.02 * 1.62 + 1e-9) fail(`${who}: the head rises to ${maxY.toFixed(3)} m (at most ${(1.02 * 1.62).toFixed(3)})`);
  return { minD, maxY };
}
const st = sample(G, 0, T_END, 'story', false);
sample(G, 0, T_END, 'story, real time', true);
// practice's walks: from home to each marker, and from each marker to each other, at 0.6 m/s (the set's walkTo)
{
  const P = { g: actorTracks(), c: actorTracks(), ray: [], target: [], lit: [], marks: -1e9, line: [-1e9, -1e9], net: { leave: -1e9, grow: [-1e9, -1e9], links: [], sprout: [-1e9, -1e9] },
    dim: [], beads: [], signals: [], menu: [], trails: [], card: [], floor: [], quiet: [], ntag: [], tags: [], copyOn: [], name: [] };
  P.g.mv.push([0, 0, 'home', 'snap']);
  let t = 1, from = GUIDE.PLACE.home;
  for (const i of [0, 4, 1, 3, 2, 0, 2, 4]) {
    const to = GUIDE.MARKS[i], L = Math.hypot(to[0] - from[0], to[1] - from[1]), T = Math.max(0.6, L / 0.6 + 0.3);
    P.g.mv.push([t, t + T, 'm' + i, 'walk']);
    const s = moveSpeed(from, P.g.mv[P.g.mv.length - 1]);
    if (s.v > 0.7) fail(`practice: a walk to marker ${i + 1} runs at ${s.v.toFixed(2)} m/s`);
    t += T + 0.5; from = to;
  }
  sortG(P);
  sample(P, 0, t, 'practice', false);
}
// ---------------------------------------------------------------- tags in order, sounds in order and not too dense
for (let i = 1; i < G.tags.length; i++) if (G.tags[i][0] < G.tags[i - 1][1] - 1e-9) fail(`the tags "${G.tags[i - 1][2]}" and "${G.tags[i][2]}" overlap`);
const e3 = fs.readFileSync(path.join(here, 'engine/e3_story.js'), 'utf8');
const cues = [];
for (const m of e3.matchAll(/^ {2}q\('(\w+)', ([\d.]+), '(\w+)'[^\n]*$/gm)) cues.push({ t: C[m[1]].a + +m[2], name: m[3], seq: /seq: true/.test(m[0]), ch: m[1] });
for (const m of e3.matchAll(/^ {2}\[([\d., ]+)\]\.forEach\(\(?(?:t|t, i)\)? => q\('(\w+)', t, '(\w+)'[^\n]*$/gm)) for (const x of m[1].split(',')) cues.push({ t: C[m[2]].a + +x, name: m[3], seq: /seq: true/.test(m[0]), ch: m[2] });
cues.sort((a, b) => a.t - b.t);
for (const c of cues) if (c.t < C[c.ch].a || c.t > C[c.ch].b) fail(`the sound ${c.name} at ${c.t} is outside its chapter`);
for (const c of cues) {
  const n = cues.filter(d => !d.seq && d.t >= c.t && d.t < c.t + 3).length;
  if (!c.seq && n > 4) fail(`more than 4 sound onsets in 3 s from ${c.t.toFixed(1)} s (${n})`);
}
if (cues.length < 40 || cues.length > 70) fail(`${cues.length} sound cues (planned about 48; sfx-cues.mjs allows 70 here)`);
// ---------------------------------------------------------------- the network's degrees
{
  const deg = i => GUIDE.NET.L.filter(l => l[0] === i || l[1] === i).length;
  const want = [6, 4, 4, 4, 1, 1, 1, 1, 1, 1];
  want.forEach((d, i) => { if (deg(i) !== d) fail(`node ${i} has ${deg(i)} links, not ${d}`); });
  const badge = GUIDE.NET.L.filter(l => l[0] < 4 && l[1] < 4).length;
  if (badge !== 6) fail(`the badge has ${badge} links, not 6`);
}
// ---------------------------------------------------------------- the words
if (process.argv.includes('--words')) {
  const html = e3.slice(e3.indexOf('const html = {'), e3.indexOf('const story = $'));
  let words = 0;
  for (const m of html.matchAll(/<(h1|h2|p)([^>]*)>([\s\S]*?)<\/\1>/g)) {
    if (/class="credits"|data-say=" "/.test(m[2])) continue;
    words += m[3].replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
  }
  console.log(`spoken words, with the titles: ${words} (at most 415)`);
  if (words > 415) fail(`${words} spoken words (at most 415)`);
}
console.log(`script: ${GUIDE.CH.length} chapters, ${T_END} s; the nearest the guide's head comes: ${st.minD.toFixed(2)} m; highest: ${st.maxY.toFixed(3)} m; ${cues.length} sound cues; real time ${narrT(T_END).toFixed(1)} s`);
for (const n of note) console.log('note: ' + n);
if (bad.length) { console.log('FAIL\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('all good');
