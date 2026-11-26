// Where each of the app's stories is (docs/packages-migration.md, G2): the one way the tests and tools find a story's
// file, its sources, its build and its narrations, whether it is still a file of stories/ (stories/list.js) or has moved
// into a story package (packages/<key>/, named in packages/order.json). A story that moves stays in every check.
//   import { stories } from './stories.mjs';
//   const S = stories(root);   // root: the app's folder (default: this file's parent's parent)
//   S.list    the stories in the Stories screen's order (packages/order.json, else stories/list.js's, then the app's
//             packages): { key, pkg, file, src, build, narrations, narration(lang), meta }
//   S.extra   the pages that are not stories (STORY_EXTRA: the studio; the design room until v217, parked), the same shape
//   S.all     both; S.get(key) one of them (or a package of anyone's, by its folder), or null
//   S.keys    S.list's keys; S.order: packages/order.json's list (empty when there is none)
// file: the story's built or hand-written file (stories/<key>.js or packages/<key>/main.js), relative to root;
// src: its sources' folder (tools/<key> or packages/<key>/src; null for a hand-written story, whose src/ holds only its
// miniatures' sources); build: its build script or
// null; narrations: its recordings that are there (the first language first); narration(lang): where its recording in
// that language is or would go (audio/narration[-<key>][-<lang>].mp3, or packages/<key>/audio/narration[-<lang>].mp3).
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const HERE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch (e) { return null; } };

export function stories(root = HERE) {
  const at = (...p) => path.join(root, ...p), has = (...p) => fs.existsSync(at(...p));
  const ctx = { self: {} };
  try { vm.runInNewContext(fs.readFileSync(at('stories', 'list.js'), 'utf8'), ctx, { filename: 'stories/list.js' }); } catch (e) { /* none */ }
  const L = Array.isArray(ctx.self.STORY_LIST) ? ctx.self.STORY_LIST : [], X = Array.isArray(ctx.self.STORY_EXTRA) ? ctx.self.STORY_EXTRA : [];
  const oj = json(at('packages', 'order.json')), order = oj && Array.isArray(oj.order) ? oj.order.filter(k => typeof k === 'string') : [];
  const pkgMeta = k => json(at('packages', k, 'story.json'));
  function one(key, meta, pkg) {
    const file = pkg ? `packages/${key}/main.js` : `stories/${key}.js`;
    const src = pkg ? (has('packages', key, 'src', 'build.mjs') ? `packages/${key}/src` : null) : (has('tools', key, 'build.mjs') ? `tools/${key}` : null);
    const build = src && has(src, 'build.mjs') ? `${src}/build.mjs` : null;
    const narration = lang => (pkg ? `packages/${key}/audio/narration${lang ? '-' + lang : ''}.mp3`
      : key === 'airports' && !lang ? 'audio/narration.mp3' : `audio/narration-${key}${lang ? '-' + lang : ''}.mp3`);
    // (the first language's file, then the others: narration-<lang>.mp3 beside it)
    const dir = pkg ? `packages/${key}/audio` : 'audio';
    const first = narration(), re = pkg ? /^narration(-[a-z]+)?\.mp3$/ : new RegExp(`^narration-${key}(-[a-z]+)?\\.mp3$`);
    const others = has(dir) ? fs.readdirSync(at(dir)).filter(f => re.test(f) && `${dir}/${f}` !== first).sort().map(f => `${dir}/${f}`) : [];
    const narrations = (has(first) ? [first] : []).concat(others);
    return { key, pkg, file, src, build, narrations, narration, meta: meta || {} };
  }
  const list = [], seen = new Set();
  const add = (k, m, pkg) => { if (!seen.has(k)) { seen.add(k); list.push(one(k, m, pkg)); } };
  const inList = k => L.find(m => m && m.key === k);
  // order.json first (every story, moved or not), then any listed story it leaves out, in stories/list.js's order
  for (const k of order) { if (inList(k)) add(k, inList(k), false); else if (has('packages', k, 'story.json')) add(k, pkgMeta(k), true); }
  for (const m of L) if (m && m.key) add(m.key, m, false);
  const extra = X.filter(m => m && m.key).map(m => one(m.key, m, false));
  const all = list.concat(extra);
  return {
    list, extra, all, order, keys: list.map(s => s.key),
    get: key => all.find(s => s.key === key) || (has('packages', key, 'story.json') ? one(key, pkgMeta(key), true) : null),
  };
}
