// The studio's scenes (tools/studio/SPEC.md, "Where scenes come from"): the listing rules that the relay (--scenes) and
// tools/studio/scan.mjs share, so a plain folder's index.json and files.json say exactly what the relay's API answers.
// Each subfolder of the scenes folder is a scene; its files may sit in subfolders up to 4 levels deep. Dot files and
// folders (.history/, the relay's own temporary file) and other temporary files are left out, and so are a scene's own
// layout.json (said apart: layout, layoutAt) and the files.json scan.mjs writes. Node's own modules only (the relay
// needs no packages).
import fs from 'node:fs';
import path from 'node:path';

export const SCENE_NAME = /^[A-Za-z0-9_][A-Za-z0-9 _.-]{0,63}$/;
export const RESERVED = new Set(['watch']);   // GET /api/scenes/watch is the change stream, not a scene
export const MAX_FILES = 2000, MAX_DEPTH = 4, MAX_SCENES = 200, MAX_LAYOUT = 2 << 20;
const MAX_WALK = 20000;   // files looked at in one scene before giving up (a folder of a million files must not stall)
export const LAYOUT = 'layout.json', LISTING = 'files.json', INDEX = 'index.json';
const KINDS = {
  model: ['.glb', '.gltf', '.fbx'],
  audio: ['.mp3', '.ogg', '.oga', '.wav', '.m4a', '.aac', '.flac', '.opus', '.webm'],
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.tga', '.bmp', '.tif', '.tiff', '.psd', '.psb', '.dds', '.avif'],   // (TIFF, PSD and DDS read by the studio itself)
  data: ['.bin'],
};
const KIND = new Map(Object.entries(KINDS).flatMap(([k, exts]) => exts.map(e => [e, k])));
export const kindOf = p => KIND.get(path.extname(String(p)).toLowerCase()) || 'other';
// a scene's file's type as it is served (from the folder, or stored in R2): a model's, picture's, sound's or data's own;
// anything else (a page or a script kept in originals/) plain bytes to save, never run
export const SCENE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.fbx': 'application/octet-stream', '.bin': 'application/octet-stream', '.tga': 'image/x-tga',
  '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.psd': 'image/vnd.adobe.photoshop', '.psb': 'image/vnd.adobe.photoshop', '.dds': 'image/vnd-ms.dds',
  '.avif': 'image/avif', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.webm': 'audio/webm' };
export const typeOf = p => (kindOf(p) === 'other' ? 'application/octet-stream' : SCENE_TYPES[path.extname(String(p)).toLowerCase()] || 'application/octet-stream');
// a model's picture for the studio's Add pane: previews/<the model's path>.jpg, a JPEG the studio makes with each GLB it
// writes (and on Make pictures), at most 200 KB. Listed with a kind of its own, 'preview' (never a picture a texture could
// be, never a model), so the studio knows which models have one; anything else in previews/ is listed as 'other'. An
// upload under previews/ takes only such a picture (uploadPath)
export const PREVIEWS = 'previews', MAX_PREVIEW = 200 << 10;
export const isPreview = rel => { rel = String(rel); return rel.startsWith(PREVIEWS + '/') && rel.endsWith('.jpg') && rel.length > PREVIEWS.length + 5; };
export const kindAt = rel => (String(rel).startsWith(PREVIEWS + '/') ? (isPreview(rel) ? 'preview' : 'other') : kindOf(rel));
// an editor's or a download's temporary file (a copy in progress, a swap file): never listed, never told
export const TEMP = /(~|\.(tmp|temp|part|partial|crdownload|download|swp|swx))$/i;
// a name a listing leaves out: dot files, temporary files, and names no URL path could carry back here
const skip = n => n.startsWith('.') || TEMP.test(n) || /[\\/\0]/.test(n);
// a file's path in a scene that a listing shows (an object's key in R2, by the same rules as a folder's walk): no empty
// part, none left out by name, at most 4 folders deep
export const listable = rel => { const segs = String(rel).split('/'); return segs.length <= MAX_DEPTH + 1 && segs.every(n => n && !skip(n)); };
// R2's own: the hidden object that keeps a scene made empty in the listing (a dot file: never listed as a file)
export const MARKER = '.scene';
export const validName = n => typeof n === 'string' && SCENE_NAME.test(n) && !RESERVED.has(n);
// a new scene's name (POST /api/scenes) also keeps to the rule for uploaded names (below): no name ending in a space or a
// dot and none of Windows' device names, so the folder can be copied to any computer (folders made by hand are listed as
// before)
export const newSceneName = n => validName(n) && !/[ .]$/.test(n) && !DEVICE.test(n);
export const inside = (dir, real) => real === dir || real.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);   // (code units: the same order everywhere)

// a scene's folder (its real path: a linked scene folder is the owner's choice) or '' when there is none by that name
export async function sceneDir(root, name) {
  if (!validName(name)) return '';
  try {
    const dir = await fs.promises.realpath(path.join(root, name));
    return (await fs.promises.stat(dir)).isDirectory() ? dir : '';
  } catch { return ''; }
}

// one scene's files: [{ path, bytes, at, kind }] sorted by path (at most MAX_FILES), and its layout.json's stat (or null).
// A link is followed only when it leads to somewhere inside the scene's folder.
export async function sceneFiles(dir) {
  const out = [];
  let layout = null, seen = 0;
  async function walk(abs, rel, depth) {
    let ents;
    try { ents = await fs.promises.readdir(abs, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (seen >= MAX_WALK) return;
      const n = e.name;
      if (skip(n)) continue;
      const a = path.join(abs, n), r = rel ? rel + '/' + n : n;
      let st;
      try {   // (lstat, not the entry's type: some file systems do not say which entries are links)
        st = await fs.promises.lstat(a);
        if (st.isSymbolicLink()) {
          if (!inside(dir, await fs.promises.realpath(a))) continue;
          st = await fs.promises.stat(a);
        }
      } catch { continue; }
      if (st.isDirectory()) { if (depth < MAX_DEPTH) await walk(a, r, depth + 1); continue; }
      if (!st.isFile()) continue;
      seen++;
      if (!rel && n === LAYOUT) { layout = st; continue; }
      if (!rel && n === LISTING) continue;
      out.push({ path: r, bytes: st.size, at: Math.floor(st.mtimeMs), kind: kindAt(r), ino: st.ino });
    }
  }
  await walk(dir, '', 0);
  return finishListing(out, layout);
}
// a scene's files sorted by path, at most MAX_FILES (the folder's walk and R2's listing alike)
export function finishListing(out, layout) {
  out.sort(byPath);
  // (past MAX_FILES the files a scene places, models, sounds, pictures and data, are kept before originals/, which sort
  // first but are only what was given, and those before previews/, which the studio can make again)
  if (out.length > MAX_FILES) {
    const rank = f => (f.path.startsWith(PREVIEWS + '/') ? 2 : f.path.startsWith(ORIGINALS + '/') ? 1 : 0);
    return { files: out.slice().sort((a, b) => rank(a) - rank(b) || byPath(a, b)).slice(0, MAX_FILES).sort(byPath), layout };
  }
  return { files: out, layout };
}
// the scenes in a list of objects (R2: { key, size, etag, at } under a prefix), by the same rules as allScenes: a scene is
// a first-level name with any object under it (MARKER keeps an empty one); its files by listable, its layout.json and
// files.json at its top said apart; said(name) hears each name that cannot be a scene's. [{ name, files, layout }]
export function scenesOf(objs, prefix, said = () => {}) {
  const by = new Map();
  for (const o of objs) {
    const rest = o.key.slice(prefix.length), i = rest.indexOf('/');
    if (!o.key.startsWith(prefix) || i <= 0) continue;   // (an object at the top is not a scene)
    const name = rest.slice(0, i);
    if (!by.has(name)) by.set(name, []);
    by.get(name).push({ ...o, rel: rest.slice(i + 1) });
  }
  const out = [];
  for (const name of [...by.keys()].sort()) {
    if (name.startsWith('.') || out.length >= MAX_SCENES) continue;
    if (!validName(name)) { said(name); continue; }
    const files = [];
    let layout = null, seen = 0;
    for (const o of by.get(name)) {
      if (seen >= MAX_WALK) break;
      if (!listable(o.rel)) continue;
      seen++;
      if (o.rel === LAYOUT) { layout = { size: o.size, mtimeMs: o.at, etag: o.etag }; continue; }
      if (o.rel === LISTING) continue;
      files.push({ path: o.rel, bytes: o.size, at: o.at, kind: kindAt(o.rel), etag: o.etag });
    }
    out.push({ name, ...finishListing(files, layout) });
  }
  return out;
}
// a file as the listing gives it (ino is the watch's own: a file replaced by another of the same size and time)
export const fileOut = f => ({ path: f.path, bytes: f.bytes, at: f.at, kind: f.kind });

// every scene: [{ name, dir, files, layout }] by name. said(name) hears each folder whose name cannot be a scene's
export async function allScenes(root, said = () => {}) {
  let ents = [];
  try { ents = await fs.promises.readdir(root, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of ents.map(x => x.name).sort()) {
    if (e.startsWith('.') || out.length >= MAX_SCENES) continue;
    const dir = await sceneDir(root, e);
    if (!dir) {
      // (a file at the top, index.json among them, is not a scene and is not said)
      let folder = false;
      try { folder = (await fs.promises.stat(path.join(root, e))).isDirectory(); } catch { /* gone */ }
      if (folder) said(e);
      continue;
    }
    out.push({ name: e, dir, ...(await sceneFiles(dir)) });
  }
  return out;
}

// what GET /api/scenes lists for a scene: how many files, their size, the newest one's time (ms), whether it has a layout
export const summary = s => ({ name: s.name, files: s.files.length, bytes: s.files.reduce((n, f) => n + f.bytes, 0),
  at: s.files.reduce((n, f) => Math.max(n, f.at), 0), layout: !!s.layout });
export const layoutAt = st => (st ? Math.floor(st.mtimeMs) : null);

// ---- uploads (SPEC "The upload page": POST /api/scenes/<name>/file and .../sound). A path the relay may write: inside the
// scene by the listing's own rules, so whatever is written is listed (no dot or temporary names, at most 4 folders deep),
// never the scene's own files at its top, and outside originals/ (where the files go as they were given) only a model,
// sound, image or data file; under previews/ only a model's picture (.jpg), which is at most MAX_PREVIEW (max: the
// relay takes the smaller of it and --max-upload). Names a common file system could not keep as given are refused too (Windows' reserved
// characters and device names, a name ending in a space or a dot), so a scene copied to another computer stays whole.
export const ORIGINALS = 'originals', MAX_PATH = 200;
const UPLOAD_KINDS = new Set(['model', 'audio', 'image', 'data']);
const OWN = new Set([LAYOUT, LISTING, INDEX]);
const BAD_CHAR = /[\0-\x1f\x7f\\:*?"<>|]/, DEVICE = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;
// { rel, segs, kind, max (previews/ only) } or { error } (said to the page as it is)
export function uploadPath(p) {
  if (typeof p !== 'string' || !p) return { error: 'path=<the file\'s path in the scene> is needed' };
  if (p.length > MAX_PATH) return { error: `a path is at most ${MAX_PATH} characters` };
  const segs = p.split('/');
  if (segs.some(s => !s)) return { error: 'a path has no empty parts (no // and no / at either end)' };
  if (segs.some(s => s.startsWith('.'))) return { error: 'no part of a path may start with a dot (.., .history/, dot files)' };
  if (segs.some(s => BAD_CHAR.test(s) || DEVICE.test(s) || /[ .]$/.test(s))) return { error: 'no backslashes, control characters or : * ? " < > |, no name ending in a space or a dot, no device names (con, nul...)' };
  if (segs.some(s => TEMP.test(s))) return { error: 'not a temporary file\'s name (~ .tmp .part ...): the listing leaves those out' };
  if (segs.length > MAX_DEPTH + 1) return { error: `at most ${MAX_DEPTH} folders deep` };
  if (segs.length === 1 && OWN.has(p.toLowerCase())) return { error: `${p} is the scene's own (the studio's Save writes the layout)` };
  if (segs[0] === PREVIEWS) {
    if (!isPreview(p)) return { error: `${PREVIEWS}/ takes only the studio's pictures of its models: ${PREVIEWS}/<the model's path>.jpg` };
    return { rel: p, segs, kind: 'preview', max: MAX_PREVIEW };
  }
  // (only in lower case: on a file system that ignores case, as Windows' and macOS's do, Previews/ is that same folder,
  // and a file put there would land among the pictures past their rule, listed as an ordinary image)
  if (segs[0].toLowerCase() === PREVIEWS) return { error: `${PREVIEWS}/ is written in lower case: no other folder at the top of a scene has that name` };
  const kind = kindOf(p);
  if (!(segs.length > 1 && segs[0] === ORIGINALS) && !UPLOAD_KINDS.has(kind)) return { error: 'outside originals/ only models (.glb .gltf .fbx), sounds, images and data (.bin)' };
  return { rel: p, segs, kind };
}

// a scene's layout.json, parsed (an object), or null (none, too big, not JSON, not an object)
export async function readLayout(dir) {
  try {
    const f = path.join(dir, LAYOUT), st = await fs.promises.stat(f);
    if (!st.isFile() || st.size > MAX_LAYOUT) return null;
    const v = JSON.parse(await fs.promises.readFile(f, 'utf8'));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
}
// a layout the studio may save: an object with studio: 1
export const isLayout = v => !!v && typeof v === 'object' && !Array.isArray(v) && v.studio === 1;
// layout.json as people read it (and compare in git): a top-level field a line, each item of a list on a line of its own
export function layoutText(o) {
  const lines = Object.entries(o).map(([k, v]) => {
    const key = '  ' + JSON.stringify(k) + ': ';
    if (Array.isArray(v) && v.length && v.every(x => x && typeof x === 'object')) return key + '[\n' + v.map(x => '    ' + JSON.stringify(x)).join(',\n') + '\n  ]';
    return key + JSON.stringify(v);
  });
  return lines.length ? '{\n' + lines.join(',\n') + '\n}\n' : '{}\n';
}
