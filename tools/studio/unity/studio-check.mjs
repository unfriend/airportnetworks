// node tools/studio/unity/studio-check.mjs <app address> <scene> [<cube name> ...]
//   (Playwright as for tools/studio/convert.mjs: PLAYWRIGHT_MODULE)
// An imported scene opened in the studio, headless, and what the studio makes of it: whether it is ready, the records it
// refused (bad, badTex, badPlay, badSeq), the models and sounds it loaded, the items of each kind against layout.json,
// every recorded path there, and per trigger cube how many of the items it shows are shown: at the start and after
// walking into each cube named (in that order; entering is marked the way a head does, STU.seen, so a check of the
// cubes' rule, not of walking). The scene is served from tools/studio/test/local/ by a local relay:
//   node relay/server.mjs --port 8799 --static . --scenes tools/studio/test/local
//   node tools/studio/unity/studio-check.mjs http://127.0.0.1:8799 dancequest2 trigger/activate_kistencontent resetlevel
// Exit 1 when it is not ready, refused a record, failed a model or the page had errors.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [base, scene, ...doors] = process.argv.slice(2);
if (!base || !scene || !process.env.PLAYWRIGHT_MODULE) {
  console.log('usage: PLAYWRIGHT_MODULE=<playwright index.mjs> node tools/studio/unity/studio-check.mjs <app address> <scene> [<cube name> ...]');
  process.exit(1);
}
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const L = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/studio/test/local', scene, 'layout.json'), 'utf8'));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', e => errors.push('page: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
const peek = s => page.evaluate(s => HOST.cur.peek(s), s);
await page.goto(`${base}/index.html#studio&scene=${encodeURIComponent(scene)}`);
await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 120000 });
const t0 = Date.now();
const ready = await page.waitForFunction(() => HOST.cur.peek('STUDIO.ready()'), null, { timeout: 420000, polling: 2000 }).then(() => true, () => false);
const st = await peek('STUDIO.state()');
const models = Object.values(st.models), sounds = Object.values(st.sounds), badSeq = await peek('STU.badSeq');
console.log('ready', ready, 'in', ((Date.now() - t0) / 1000).toFixed(0), 's | scene', st.scene, '| items', st.items, '| bad', st.bad, '| badTex', st.badTex, '| badPlay', st.badPlay, '| badSeq', badSeq);
const failed = models.filter(m => m.state === 'failed');
console.log('models', models.length, JSON.stringify(models.reduce((o, m) => (o[m.state] = (o[m.state] || 0) + 1, o), {})), failed.length ? '| failed: ' + failed.map(m => m.err).slice(0, 3).join(' / ') : '');
console.log('sounds', sounds.length, JSON.stringify(sounds.reduce((o, s) => (o[s.state] = (o[s.state] || 0) + 1, o), {})));
const want = { o: L.objects.length, c: L.cubes.length, s: L.sounds.length, e: (L.empties || []).length, q: (L.sequences || []).length };
const kinds = (await peek('STUDIO.items()')).reduce((o, it) => (o[it.kind] = (o[it.kind] || 0) + 1, o), {});
console.log('items in the studio', JSON.stringify(kinds), '| in layout.json', JSON.stringify(want));
// every object with a path in the layout has one in the studio, and a path in a file has its keys
const withPath = L.objects.filter(o => o.path).map(o => o.id);
if (withPath.length) console.log('paths', JSON.stringify(await peek(`${JSON.stringify(withPath)}.map(id => { const it = STU.items.get(id); return [id, !!(it && it.rec.path), it && it.rec.path && it.rec.path.src ? !!pathK(it.rec.path) : 'inline'] })`)));
// what each cube shows, shown now
const report = async label => {
  await page.waitForTimeout(1500);
  const shown = new Set(await peek('[...STU.items.values()].filter(it => it.shown).map(it => it.id)'));
  console.log(label, L.cubes.map(c => `${c.name} ${c.show.filter(i => shown.has(i)).length}/${c.show.length}`).join(' | '));
};
await report('at the start, shown:');
for (const door of doors) {
  const c = L.cubes.find(x => x.name === door);
  if (!c) { console.log(`no cube named ${door}`); continue; }
  await peek(`(() => { const c = STU.items.get('${c.id}'); STU.seen.add(c.id); c.act = false; return 1; })()`);
  await report(`after walking into ${door}, shown:`);
}
console.log('errors', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
process.exit(!ready || st.bad || st.badTex || st.badPlay || badSeq || failed.length || errors.length ? 1 : 0);
