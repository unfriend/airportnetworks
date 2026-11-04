// node tools/studio/test-images.mjs
// The studio's picture reader (tools/studio/engine/images.js) in Node, in seconds, without a browser: the test scene's
// pictures (tools/studio/test/scenes/textures/, written by tools/studio/test/make.mjs) and more kinds made in memory
// (tools/studio/test/pictures.mjs) read back and compared with the pixels they were made from (exactly for TIFF, PSD and
// uncompressed DDS; within the block format's error for DXT1, DXT5 and BC5); the refusals and their sentences; the
// texture names' ladder (texFind), ranking (texRank) and slots (slotOf); an FBX's .psd names renamed and back.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { scenePictures, morePictures, lzw, packbits, psd, tiff, dds } from './test/pictures.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SCENE = path.join(HERE, 'test/scenes/textures');
const makeImages = new Function(fs.readFileSync(path.join(HERE, 'engine/images.js'), 'utf8') + '\nreturn makeImages;')();
// (Node's zlib with the same cap the studio's fflate streams keep: more than wanted is left off)
const cap = n => (n ? { maxOutputLength: n } : {});
const IM = makeImages({ unzlibSync: (b, n) => new Uint8Array(zlib.inflateSync(b, cap(n))), inflateSync: (b, n) => new Uint8Array(zlib.inflateRawSync(b, cap(n))) });
let fails = 0, checks = 0;
const ok = (c, what, more) => { checks++; if (!c) { fails++; console.log('FAIL ' + what + (more ? ': ' + more : '')); } };

// ---- every picture back as it was made
const compare = (name, r, p) => {
  if (!r || r.width !== p.w || r.height !== p.h) { ok(false, name, `size ${r && r.width} x ${r && r.height}, not ${p.w} x ${p.h}`); return; }
  let worst = 0, sum = 0, n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const want = p.px(x, y), i = (y * p.w + x) * 4;
    for (let c = 0; c < 4; c++) { const d = Math.abs(r.data[i + c] - (want[c] === undefined ? 255 : want[c])); worst = Math.max(worst, d); sum += d; n++; }
  }
  const mean = sum / n;
  if (p.lossy) ok(mean <= 6 && worst <= 48, `${name} read back within the block format's error`, `mean ${mean.toFixed(2)}, worst ${worst}`);
  else ok(worst <= (p.near || 1), `${name} read back exactly`, `worst ${worst}, mean ${mean.toFixed(2)}`);   // (near: a PSD's colours blended over white and back, rounded twice)
  console.log(`  ${name.padEnd(22)} ${p.w} x ${p.h}: ${p.lossy ? `mean difference ${mean.toFixed(2)}, worst ${worst} (of 255)` : worst ? `within ${worst}` : 'exact'}`);
};
console.log('the test scene\'s pictures (from the files):');
for (const [f, p] of Object.entries(scenePictures())) {
  const bytes = fs.readFileSync(path.join(SCENE, f));
  ok(Buffer.compare(bytes, p.bytes) === 0, `${f} on disk is what tools/studio/test/pictures.mjs makes (run node tools/studio/test/make.mjs)`);
  const ext = IM.extOf(f);
  if (IM.way(ext) !== 'decode') continue;
  if (p.refused) { let why = ''; try { IM.decodeImage(ext, bytes); } catch (e) { why = e.message; } ok(why === p.refused, `${f} refused with its sentence`, JSON.stringify(why)); console.log(`  ${f.padEnd(22)} refused: ${why}`); continue; }
  let r = null;
  try { r = IM.decodeImage(ext, bytes); } catch (e) { ok(false, f, e.message); continue; }
  compare(f, r, p);
}
console.log('more kinds (made in memory):');
for (const [f, p] of Object.entries(morePictures())) {
  let r = null;
  try { r = IM.decodeImage(IM.extOf(f), p.bytes); } catch (e) { ok(false, f, e.message); continue; }
  compare(f, r, p);
}

// ---- the coders on their own: LZW and PackBits round trips (long runs, every byte, a table that fills and clears)
const rnd = (n, k) => { let s = 12345; return Uint8Array.from({ length: n }, () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 16) % k); };
for (const [name, src] of [['zeros', new Uint8Array(5000)], ['bytes', Uint8Array.from({ length: 2048 }, (_, i) => i & 255)], ['random', rnd(60000, 256)], ['few values', rnd(90000, 4)]]) {
  const back = IM.lzw(lzw(src), src.length);
  ok(Buffer.compare(Buffer.from(back), Buffer.from(src)) === 0, `LZW round trip (${name}, ${src.length} bytes)`);
  const pb = IM.packbits(packbits(src), src.length).o;
  ok(Buffer.compare(Buffer.from(pb), Buffer.from(src)) === 0, `PackBits round trip (${name})`);
}

// ---- refusals: other formats, broken files
const refuse = (bytes, ext, re, what) => { let m = ''; try { IM.decodeImage(ext, bytes); } catch (e) { m = e.message; } ok(re.test(m), what, JSON.stringify(m)); };
refuse(Buffer.from([0x76, 0x2f, 0x31, 0x01, 0, 0, 0, 0]), 'exr', /^an HDR picture \(EXR\): save it as PNG or JPEG$/, 'an EXR refused');
refuse(Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n'), 'hdr', /^an HDR picture \(Radiance HDR\)/, 'a Radiance HDR refused');
refuse(Buffer.from('\xabKTX 20\xbb\r\n\x1a\n', 'latin1'), 'ktx2', /^a KTX2 texture/, 'a KTX2 refused');
refuse(Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]), 'heic', /^a HEIC photo: save it as JPEG$/, 'a HEIC refused');
const bc7 = Buffer.alloc(148); bc7.write('DDS ', 0, 'ascii'); bc7.writeUInt32LE(124, 4); bc7.writeUInt32LE(4, 12); bc7.writeUInt32LE(4, 16); bc7.writeUInt32LE(4, 80); bc7.write('DX10', 84, 'ascii'); bc7.writeUInt32LE(98, 128);
refuse(bc7, 'dds', /^a DDS of BC7: save it as PNG$/, 'a BC7 DDS refused');
const p32 = Buffer.from(scenePictures()['panel_albedo.psd'].bytes); p32.writeUInt16BE(32, 22);
refuse(p32, 'psd', /^a 32-bit PSD \(an HDR picture\)/, 'a 32-bit PSD refused');
refuse(Buffer.from('not a picture at all'), 'tif', /^not a TIFF file$/, 'a TIFF that is not one');
const zero = psd({ w: 6, h: 4, raw: true, px: () => [0, 0, 0, 0] }); zero.fill(0, 26 + 12 + 2);   // (nothing at all in it, not even alpha)
refuse(zero, 'psd', /merged picture is empty/, 'a PSD whose merged picture is all zero');

// ---- forged and broken files: said in words, quickly, without asking for the memory their headers claim
const quick = (bytes, ext, re, what) => { const t = Date.now(); refuse(bytes, ext, re, what); ok(Date.now() - t < 2000, what + ' (quickly)', (Date.now() - t) + ' ms'); };
const tag = (b, id, v) => { const n = b.readUInt16LE(b.readUInt32LE(4)); for (let i = 0; i < n; i++) { const e = b.readUInt32LE(4) + 2 + i * 12; if (b.readUInt16LE(e) === id) { if (b.readUInt16LE(e + 2) === 3) b.writeUInt16LE(v, e + 8); else b.writeUInt32LE(v, e + 8); } } return b; };
const t8 = () => tiff({ w: 16, h: 16, spp: 3, bits: 8, photo: 2, comp: 1, le: true, px: () => [1, 2, 3] });
{ const t = Date.now(); let r = null; try { r = IM.decodeImage('tif', tag(t8(), 278, 0)); } catch (e) { /* none */ } ok(r && r.data[0] === 1 && Date.now() - t < 2000, 'a TIFF whose strips say 0 rows: read as one strip (the rule\'s "all of them"), quickly'); }
const tiled = tag(tag(t8(), 278, 0), 273, 8); { const n = tiled.readUInt16LE(tiled.readUInt32LE(4)), e0 = tiled.readUInt32LE(4) + 2; for (let i = 0; i < n; i++) if (tiled.readUInt16LE(e0 + i * 12) === 273) tiled.writeUInt16LE(324, e0 + i * 12); }
quick(tiled, 'tif', /strips or tiles have no proper size/, 'a TIFF of tiles with no width');
quick(tag(tag(t8(), 256, 16384), 257, 16384), 'tif', /too large|cut short/, 'a small TIFF that says it is 16,384 px square');
quick(tag(tag(t8(), 256, 8000), 257, 8000), 'tif', /cut short|missing some/, 'a small TIFF that says it is 8,000 px square');
quick(t8().subarray(0, 40), 'tif', /^a TIFF cut short or damaged|cut short/, 'a TIFF cut short');
const bigDds = Buffer.from(dds({ w: 8, h: 8, kind: 'dxt1', px: () => [0, 0, 0, 255] })); bigDds.writeUInt32LE(8192, 12); bigDds.writeUInt32LE(8192, 16);
quick(bigDds, 'dds', /^a DDS cut short$/, 'a small DDS that says it is 8,192 px square');
const rle = Buffer.from(psd({ w: 8, h: 8, alpha: false, px: () => [1, 2, 3] })); rle.writeUInt16BE(65535, 26 + 12 + 2);   // (a row's count far past the file)
quick(rle, 'psd', /cut short/, 'a PSD whose RLE counts run past its end');
const two = Buffer.from(psd({ w: 4, h: 4, raw: true, alpha: false, px: () => [1, 2, 3] })); two.writeUInt16BE(2, 12);
quick(two, 'psd', /fewer channels/, 'an RGB PSD with two channels');
quick(Buffer.from(psd({ w: 8, h: 8, raw: true, px: () => [1, 2, 3, 4] })).subarray(0, 60), 'psd', /cut short/, 'a PSD cut short');
const bomb = tiff({ w: 64, h: 64, spp: 1, bits: 8, photo: 1, comp: 8, le: true, px: () => [7] });   // (its strip made a stream that unpacks to 64 MB)
{ const z = zlib.deflateSync(Buffer.alloc(64 << 20, 7)), fb = Buffer.concat([bomb, z]); tag(tag(fb, 273, bomb.length), 279, z.length);
  let r = null, m = ''; try { r = IM.decodeImage('tif', fb); } catch (e) { m = e.message; }
  ok(r ? r.width === 64 && r.data[0] === 7 : /cut short|damaged/.test(m), 'a Deflate strip that unpacks far past its size: no more than it needs', m); }
// (a PSD's fourth channel is its transparency only when nothing names it: a saved selection is not)
{ const named = Buffer.from(psd({ w: 2, h: 2, raw: true, px: () => [200, 100, 50, 0] })), res = Buffer.alloc(12 + 12); res.write('8BIM', 0, 'ascii'); res.writeUInt16BE(1053, 4); res.writeUInt32BE(4, 8);
  named.writeUInt32BE(0, 30); const withRes = Buffer.concat([named.subarray(0, 30), (() => { const l = Buffer.alloc(4); l.writeUInt32BE(16, 0); return l; })(), res.subarray(0, 16), named.subarray(34)]);
  const r = IM.decodeImage('psd', withRes); ok(r.data[3] === 255 && r.data[0] === 255, 'a PSD whose fourth channel is a named alpha channel: opaque, colours as stored', JSON.stringify([...r.data.slice(0, 4)])); }

// ---- what a picture is by its bytes, and how it is read
const sn = Object.fromEntries(Object.entries(scenePictures()).map(([f, p]) => [f, IM.sniff(p.bytes)]));
ok(sn['tex/wood.tif'] === 'tif' && sn['panel_albedo.psd'] === 'psd' && sn['Stone-BaseColor.dds'] === 'dds' && sn['paint.png'] === 'png', 'sniffed by their bytes', JSON.stringify(sn));
ok(IM.way('png') === 'browser' && IM.way('tga') === 'tga' && IM.way('tif') === 'decode' && IM.way('exr') === 'refuse' && IM.way('bin') === '', 'how each kind is read');
// a TIFF named .png is read as a TIFF
ok(IM.decodeImage('png', scenePictures()['brick.tif'].bytes).width === 24, 'a TIFF under another name read by its bytes');

// ---- the ladder: path, name, ext, similar; slots never mixed; nothing for nothing
const pics = ['tex/wood.tif', 'brick.tif', 'Stone-BaseColor.dds', 'panel_albedo.psd', 'panel_nrm.dds', 'paint.png', 'textures/stone_normal.png', 'a/x.png', 'b/X.PNG', 'leaf.png', 'leaf.jpg', 'hdr/sky.exr'];
const F = (n, dir) => { const r = IM.texFind(n, pics, { dir: dir || '' }); return r ? r.how + ' ' + r.path : 'none'; };
const L = [
  [F('tex/wood.tif'), 'path tex/wood.tif'], [F('../tex/wood.tif', 'm/'), 'path tex/wood.tif'], [F('C:\\art\\Panel_Albedo.PSD'), 'name panel_albedo.psd'],
  [F('brick.tga'), 'ext brick.tif'], [F('leaf.tga'), 'ext leaf.png'], [F('stone_diffuse.jpg'), 'similar Stone-BaseColor.dds'], [F('StoneAlbedo.png'), 'similar Stone-BaseColor.dds'],
  [F('stone_normal.tga'), 'ext textures/stone_normal.png'], [F('stone_nrm.png'), 'none'], [F('x.png', 'b/'), 'name b/X.PNG'], [F('x.png', 'a/'), 'path a/x.png'],
  [F('rust_old.png'), 'none'], [F('diffuse.png'), 'none'], [F('../../out.png', 'a/'), 'none'], [F('sky.png'), 'none'],
];
for (const [got, want] of L) ok(got === want, 'the ladder', `${got} (wanted ${want})`);
// 'similar' needs exactly one: two stems of the same words are not taken
ok(IM.texFind('rock_diffuse.png', ['rock-albedo.png', 'Rock_BaseColor.jpg'], {}) === null, 'two pictures of the same words: none taken');
ok(IM.texFind('rock_diffuse.png', ['rock-albedo.png', 'rock-albedo.jpg'], {}).path === 'rock-albedo.png', 'one picture in two kinds: the preferred kind');
// slots
const S = { 'wood_n.png': 'normalMap', 'n.png': 'map', 'Bricks_Normal.jpg': 'normalMap', 'metal_rough.png': 'roughnessMap', 'gold_metallic.png': 'metalnessMap', 'wall_ORM.png': 'orm', 'leaf_opacity.png': 'alphaMap', 'lamp-emissive.png': 'emissiveMap', 'stone_AO.png': 'aoMap', 'StoneBaseColor.png': 'map', 'm.png': 'map', 'wood_d.png': 'map',
  'Arm_Diffuse.png': 'map', 'Metal_Door_Albedo.jpg': 'map', 'Rough_Stone_BaseColor.png': 'map', 'Mask_Face_Color.png': 'map', 'Rough_Stone.png': 'map', 'arm.png': 'map', 'stone_rough_2k.png': 'roughnessMap', 'brick_normal_gl.png': 'normalMap', 'Metal_Plate_Normal.png': 'normalMap' };
for (const [n, want] of Object.entries(S)) ok(IM.slotOf(n) === want, `slotOf(${n})`, IM.slotOf(n));
ok(IM.slotOf('blue.png', [0.5, 0.5, 0.95]) === 'normalMap' && IM.slotOf('blue.png', [0.2, 0.3, 0.9]) === 'map', 'a normal map told by its colour');
ok(IM.normStem('Stone-BaseColor.dds') === 'stone' && IM.normStem('stone_diffuse.jpg') === 'stone' && IM.normStem('stoneBaseColour.png') === 'stone' && IM.normStem('stone_normal.png') === 'stone normal', 'normalised names', [IM.normStem('Stone-BaseColor.dds'), IM.normStem('stoneBaseColour.png')].join());
const R = IM.texRank('rust_old.png', ['paint.png', 'rust_new.png', 'tex/old_rust.jpg', 'sky.exr', 'rust_normal.png'], { dir: '' }, 3);
ok(R[0] === 'tex/old_rust.jpg' && R.length === 3 && !R.includes('sky.exr'), 'texRank: the likeliest first, no refused kinds', R.join());

// ---- an FBX's .psd names (ASCII: quoted strings; binary: string records only) and back
const asc = Buffer.from('Texture: 1, "T", "" {\n\tFileName: "C:\\\\a\\\\x.PSD"\n\tRelativeFilename: "x.psd"\n}\n; a.psd in a comment\n');
const ra = IM.renamePsd(asc), at = Buffer.from(ra.bytes).toString('latin1');
ok(ra.count === 2 && at.includes('"C:\\\\a\\\\x.PS~"') && at.includes('"x.ps~"') && at.includes('a.psd in a comment') && at.length === asc.length, 'an ASCII FBX\'s .psd names made .ps~', at);
const rec = s => { const b = Buffer.alloc(5 + s.length); b[0] = 0x53; b.writeUInt32LE(s.length, 1); b.write(s, 5, 'latin1'); return b; };
const bin = Buffer.concat([Buffer.from('Kaydara FBX Binary  \0\x1a\0', 'latin1'), Buffer.alloc(4), rec('C:\\art\\Skin.psd'), rec('Skin.psd.backup'), Buffer.from('xx.psd'), rec('tex/b.PSD')]);
const rb = IM.renamePsd(bin), bt = Buffer.from(rb.bytes).toString('latin1');
ok(rb.count === 2 && bt.includes('C:\\art\\Skin.ps~') && bt.includes('Skin.psd.backup') && bt.includes('xx.psd') && bt.includes('tex/b.PS~') && bt.length === bin.length, 'a binary FBX\'s .psd string records made .ps~ (and nothing else)', JSON.stringify(bt.slice(27)));
ok(IM.psdBack('http://h/s/x.ps~?v=2') === 'http://h/s/x.psd?v=2' && IM.psdBack('C:/a/X.PS%7E') === 'C:/a/X.PSD' && IM.psdBack('x.psd') === 'x.psd', 'and back');

console.log(`\n${checks - fails} of ${checks} checks passed`);
if (fails) process.exit(1);
