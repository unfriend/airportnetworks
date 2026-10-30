// Checks every story's sound effects cues (phase 2 of the sound effects: sfx.js, and the lines every story keeps, AGENTS.md
// "Sound effects") without listening: each story is loaded headless and its cue table read from inside it (SFXQ.cues and
// SFXQ.spans, filled by sfxCue and sfxHold in buildStory). Checked, per story:
//  - every name is a sound or a continuous sound the shell knows (SFX_LIB.SOUNDS, SFX_LIB.DRONES);
//  - every place resolves to finite numbers (the story's sfxPos), and every time lies within the story (0 to T_END);
//  - how many cues: 6 to 60 (the tour up to 80; the life-size stories and the design room, whose sounds are mostly live
//    or explore's, at least 1);
//  - density: no 3 s with more than 4 onsets, a marked sequence (seq: true in its options) aside, and no two cues of one
//    sound closer than its minimum gap (the engine would drop the second);
//  - overlap: with each cue's length (SFX_LIB.length, a dry run of the recipe with the cue's options), at most 6 cue
//    voices sound at any moment (the engine's limit is 16, with the shell's and explore's sounds besides), and at most 2
//    continuous sounds;
// and prints each story's busiest moment. Fast (no audio): builders run it on their stories while working.
// Usage: serve the folder, then node tools/sfx-cues.mjs [http://127.0.0.1:8123/] [keys, comma separated, or all]
// PLAYWRIGHT_MODULE and CHROMIUM_PATH as in smoke.mjs. Exits 1 on a failed check or a page error.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const args = process.argv.slice(2);
const base = args.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8123/';
const which = args.find(a => !/^https?:/.test(a) && !a.startsWith('--')) || 'all';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const LIMITS = { min: 6, max: 60, window: 3, onsets: 4, voices: 6, drones: 2 };
const FEW = new Set(['flock', 'robots', 'design']);   // life size or not a story: their sounds are mostly live or explore's
const MANY = { lbi: 80 };
// the keys: every story in the list and the pages that are not stories (the design room)
let keys;
{
  const p = await browser.newPage();
  await p.goto(base + '#stories', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof HOST !== 'undefined' && HOST.list && HOST.list.length, null, { timeout: 30000 });
  const all = await p.evaluate(() => HOST.list.map(s => s.key).concat((window.STORY_EXTRA || []).map(s => s.key)));
  keys = which === 'all' ? all : which.split(',').map(s => s.trim()).filter(Boolean);
  const bad = keys.filter(k => !all.includes(k));
  if (bad.length) { console.log('unknown keys: ' + bad.join(', ')); process.exit(1); }
  await p.close();
}
let failed = false;
const rows = [];
for (const key of keys) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const t0 = Date.now();
  await page.goto(base + '#' + key, { waitUntil: 'load' });
  let r;
  try {
    await page.waitForFunction(k => HOST.curKey === k && HOST.cur && HOST.cur.collab.scene(), key, { timeout: 60000 });
    r = await page.evaluate(L => {
      const peek = s => HOST.cur.peek(s), lib = window.SFX_LIB;
      if (!peek('typeof SFXQ !== "undefined"')) return { none: true };
      peek('GL.scene.updateMatrixWorld(true)');
      const T = peek('T_END'), cues = peek('SFXQ.cues.map((c, i) => ({ i, t: c.t, n: c.n, name: c.name, set: c.set, at: typeof c.at === "function" ? "fn" : c.at && c.at.isVector3 ? c.at.toArray() : c.at, o: c.o }))');
      const where = peek('SFXQ.cues.map(c => { const v = new THREE.Vector3(); return sfxPos(c.set, c.at, v) ? [v.x, v.y, v.z] : null; })');
      const spans = peek('SFXQ.spans.map(s => ({ id: s.id, n0: s.n0, n1: s.n1, name: s.name, set: s.set, o: s.o }))');
      const swhere = peek('SFXQ.spans.map(s => { const v = new THREE.Vector3(); return sfxPos(s.set, s.at, v) ? [v.x, v.y, v.z] : null; })');
      // (a named anchor the set does not have would sound from the set's middle: finite, so look it up)
      const lost = peek('typeof GL === "undefined" || !GL.sets ? [] : SFXQ.cues.concat(SFXQ.spans).filter(c => typeof c.at === "string" && !(GL.sets[c.set] && GL.sets[c.set].anchors && c.at in GL.sets[c.set].anchors)).map(c => c.name + " at " + c.set + "." + c.at)');
      const out = { T, n: cues.length, spans: spans.length, bad: lost.map(l => `no such anchor: ${l}`), busy: { t: 0, k: 0 }, dense: { t: 0, k: 0 } };
      const fmtT = t => Math.floor(t / 60) + ':' + (t % 60).toFixed(1).padStart(4, '0');
      const what = c => `${c.name} at ${fmtT(c.n)} (story time ${c.t.toFixed(1)})`;
      cues.forEach((c, i) => {
        if (!lib.SOUNDS[c.name]) out.bad.push(`unknown sound: ${what(c)}`);
        if (!(where[i] && where[i].every(Number.isFinite))) out.bad.push(`no place for ${what(c)} (${c.set}: ${JSON.stringify(c.at)})`);
        if (!(c.n >= 0 && c.n <= T)) out.bad.push(`outside the story (0 to ${T.toFixed(1)}): ${what(c)}`);
      });
      spans.forEach((s, i) => {
        if (!lib.DRONES[s.name]) out.bad.push(`unknown continuous sound: ${s.name} (${s.id})`);
        if (!(swhere[i] && swhere[i].every(Number.isFinite))) out.bad.push(`no place for the span ${s.id} (${s.set})`);
        if (!(s.n0 >= 0 && s.n1 <= T + 0.01 && s.n1 > s.n0)) out.bad.push(`span ${s.id} outside the story or empty (${s.n0.toFixed(1)} to ${s.n1.toFixed(1)})`);
      });
      const ok = cues.filter(c => lib.SOUNDS[c.name]).sort((a, b) => a.n - b.n);
      if (ok.length < L.min || ok.length > L.max) out.bad.push(`${ok.length} cues (expected ${L.min} to ${L.max})`);
      // density: onsets in any 3 s, a marked sequence aside
      const plain = ok.filter(c => !c.o.seq);
      for (const c of plain) {
        const k = plain.filter(d => d.n >= c.n && d.n < c.n + L.window).length;
        if (k > out.dense.k) out.dense = { t: c.n, k };
        if (k > L.onsets) { out.bad.push(`${k} onsets in ${L.window} s from ${fmtT(c.n)}`); break; }
      }
      // two of one sound closer than its gap (the second would not play)
      for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length && ok[j].n - ok[i].n < 1; j++) {
        const a = ok[i], b = ok[j];
        if (a.name === b.name && !b.o.force && (b.n - a.n) * 1000 < (lib.SOUNDS[a.name].gap || 0)) out.bad.push(`two ${a.name} ${((b.n - a.n) * 1000).toFixed(0)} ms apart (its gap is ${lib.SOUNDS[a.name].gap} ms) at ${fmtT(a.n)}`);
      }
      // overlap: the voices sounding at once (from each cue's own length), and the continuous sounds
      const ev = [];
      for (const c of ok) { const len = lib.length(c.name, c.o) + (+c.o.delay || 0); ev.push([c.n, 1], [c.n + len, -1]); }
      ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let k = 0;
      for (const [t, d] of ev) { k += d; if (k > out.busy.k) out.busy = { t, k }; }
      if (out.busy.k > L.voices) out.bad.push(`${out.busy.k} cue voices at once at ${fmtT(out.busy.t)} (at most ${L.voices})`);
      const sv = [];
      for (const s of spans) sv.push([s.n0, 1], [s.n1, -1]);
      sv.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let m = 0, mm = 0;
      for (const [, d] of sv) { m += d; mm = Math.max(mm, m); }
      if (mm > L.drones) out.bad.push(`${mm} continuous sounds at once (at most ${L.drones})`);
      out.busyAt = fmtT(out.busy.t); out.denseAt = fmtT(out.dense.t);
      out.names = [...new Set(ok.map(c => c.name))].join(' ');
      out.every = ok.length > 1 ? T / ok.length : T;
      return out;
    }, Object.assign({}, LIMITS, { min: FEW.has(key) ? 1 : LIMITS.min, max: MANY[key] || LIMITS.max }));
  } catch (e) { r = { bad: ['did not load: ' + String(e).split('\n')[0]] }; }
  if (r.none) r = { bad: ['no sound effects block (SFXQ) in this story yet'] };
  if (errors.length) r.bad = (r.bad || []).concat(errors.map(e => 'page error: ' + e));
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (r.bad.length) failed = true;
  console.log(`${r.bad.length ? 'FAIL' : 'ok  '} ${key.padEnd(9)} ${r.n === undefined ? '' : `${String(r.n).padStart(2)} cues, ${r.spans} spans, one every ${r.every.toFixed(0)} s; busiest ${r.busy.k} voices at ${r.busyAt}, ${r.dense.k} onsets in 3 s at ${r.denseAt}`} (${secs} s)`);
  if (r.names) console.log(`          ${r.names}`);
  for (const b of r.bad) console.log('     ' + b);
  rows.push([key, r]);
  await page.close();
}
await browser.close();
console.log(failed ? 'sound cues: FAILED' : 'sound cues: all good');
process.exit(failed ? 1 : 0);
