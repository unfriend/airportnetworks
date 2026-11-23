// The harnesses' loader (harness-a.html, harness-b.html; tools/packages/SPEC.md, "Miniatures"): every miniature's source
// put together as tools/lowpoly/build.mjs puts it (the kit its "// kit:" line names, then the source, inside one
// function), the shell's own (tools/lowpoly/shell.js) and each package's in packages/index.json (packages/<key>/src/
// minis.js), so a source can be edited and the page reloaded without a build. Loaded at once, by synchronous requests
// (a tool page, not the app). LOWPOLY_KIT, set before this script: only the sources of that kit ('a' or 'b'; unset:
// every one). Query: pkg=<key>,<key> only those packages (not the shell's); built: the built files instead (lowpoly.js
// and each package's minis file, as the app loads them; a package with no source shows its built file either way).
var LOWPOLY_MODELS = LOWPOLY_MODELS || {};
(function () {
  'use strict';
  const Q = new URLSearchParams(location.search), root = '../../', kits = {}, want = self.LOWPOLY_KIT || '';
  const only = Q.get('pkg') ? Q.get('pkg').split(',') : null, built = Q.has('built');
  const get = u => { try { const x = new XMLHttpRequest(); x.open('GET', root + u + '?t=' + Date.now(), false); x.send(); return x.status === 200 ? x.responseText : null; } catch (e) { return null; } };
  const run = (text, name) => { try { (0, eval)(text + '\n//# sourceURL=' + name); } catch (e) { console.error(name + ': ' + e.message); } };
  const strip = t => t.replace(/^(\/\/.*\n)+/, '');
  let idx = null;
  try { idx = JSON.parse(get('packages/index.json')); } catch (e) { /* no packages: the shell's only */ }
  const list = only ? [] : [['tools/lowpoly/shell.js', 'lowpoly.js']];
  for (const m of (idx && idx.packages) || []) if (m.minis && (!only || only.includes(m.key))) list.push([`packages/${m.key}/src/minis.js`, m.minis ? `packages/${m.key}/${m.minis}` : '']);
  for (const [src, out] of list) {
    const t = built ? null : get(src);
    if (!t) { const b = out && (built || !want) ? get(out) : null; if (b) run(b, out); continue; }
    const kit = (/^\/\/ kit: ([a-z0-9-]+)\s*$/m.exec(t) || [])[1];
    if (!kit || (want && kit !== want)) continue;
    const k = kits[kit] || (kits[kit] = get(`tools/lowpoly/kit-${kit}.js`));
    if (!k) { console.error(`${src}: no kit ${kit}`); continue; }
    run('var LOWPOLY_MODELS = LOWPOLY_MODELS || {};\n(function () {\n' + strip(k).trimEnd() + '\n\n' + strip(t).trimEnd() + '\n})();\n', src);
  }
})();
