// ============================================================== R2 (direct) ==
// A relay that keeps its scenes in a Cloudflare R2 bucket (relay/README.md, "Scenes in Cloudflare R2") says so in its list
// of scenes (linkTtl, and direct: true while the bucket takes its upload links). Its listing of a scene gives each file a
// signed link, which fileUrl hands the loaders and the sound elements: the page fetches the file straight from the
// bucket, from its own origin (no password in it: the link is the permission, for that one file, until it lapses). Those
// links live linkTtl seconds (R2_LINK_TTL, 12 hours by default) from the listing that gave them, so the listing is read
// again once half of that has passed by the wall clock (a device asleep meanwhile, such as a headset taken off, reads it
// as it wakes: looked at every minute, when the page shows again, before a file is fetched, and once more after a link
// the bucket refused: linksFresh, linksAgain). An upload goes straight into the bucket too: upSend hands a .../file
// upload to upDirect, which asks the relay for a signed PUT (.../put, with the file's size), sends the file there with
// its progress, and tells the relay it is there (.../done). The relay answers as for an upload through it ({ ok, path,
// bytes, at }; 409 for a name taken), so the Upload pane, Convert to GLB and the texture buttons work the same either
// way. Should the bucket refuse the PUT (its CORS rule missing, a signed header it will not take) the file goes through
// the relay instead, and so does every upload after it on this page (directOff).
let linksT = 0, linksJob = null, directOff = false;
const linksAge = () => Date.now() - (SRC.linksAt || 0);
const linksOld = () => SRC.linkTtl > 0 && STU.files.some(f => f.url) && linksAge() > SRC.linkTtl * 500;
// the listing just read (no ms) starts the watch over its links' age; ms: look again then
function linksSoon(ms) {
  unlater(linksT); linksT = 0;
  if (!(SRC.linkTtl > 0)) return;
  if (!ms) SRC.linksAt = Date.now();
  linksT = later(() => { linksT = 0; if (linksOld()) linksFresh(); else linksSoon(Math.min(60, SRC.linkTtl / 4) * 1000); }, ms || Math.min(60, SRC.linkTtl / 4) * 1000);
}
// the listing read again now (one at a time); a listing that cannot be read is asked again a minute later
function linksFresh() {
  if (!linksJob) {
    linksJob = refreshFiles(new Set()).finally(() => { linksJob = null; if (linksOld()) linksSoon(60000); });
  }
  return linksJob;
}
// a signed link this page holds: the same file's link after reading the listing again (null: no other one came)
async function linksAgain(url) {
  const f = STU.files.find(x => x.url === url) || [...PV.files.values()].find(x => x.url === url);   // (a model's picture too)
  if (!f) return null;
  await linksFresh();
  const g = STU.fileMap.get(f.path) || PV.files.get(f.path);
  return g && g.url && g.url !== url ? g.url : null;
}
// (the page shown again after a while: links that lapsed meanwhile read again at once)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && linksOld()) linksFresh(); });

// one upload straight into the bucket: url is the .../file address upSend was given (its scene, path and replace=1)
async function upDirect(url, body, onP) {
  if (!SRC.direct || directOff) return upVia(url, body, onP);
  const u = new URL(url, location.href), m = /\/api\/scenes\/([^/]+)\/file$/.exec(u.pathname);
  if (!m || SRC.held) throw SRC.held ? AUTH_ERR() : new Error('not an upload');
  const q = new URLSearchParams(u.search), size = body ? (body.size !== undefined ? body.size : body.byteLength || 0) : 0;
  const api = what => `${SRC.base}/api/scenes/${m[1]}/${what}?path=${encodeURIComponent(q.get('path') || '')}${q.get('replace') === '1' ? '&replace=1' : ''}&size=${size}`;
  let link;
  try { link = await getJSON(api('put'), { method: 'POST' }); } catch (e) {
    if (e.status !== 501) throw e;
    return through(url, body, onP, 'the relay gives no upload links now');
  }
  const st = await new Promise(res => {
    const x = new XMLHttpRequest();
    x.open('PUT', link.url);
    for (const [k, v] of Object.entries((link && link.headers) || {})) x.setRequestHeader(k, v);
    if (onP) x.upload.onprogress = e => { if (e.lengthComputable) onP(e.loaded / Math.max(1, e.total)); };
    x.onload = () => res(x.status);
    x.onerror = () => res(0);
    x.send(body || null);
  });
  // (412, or 409 as R2 may say: a file of that name came meanwhile, as the relay's 409)
  if (st === 412 || st === 409) throw Object.assign(new Error('there is a file by that name'), { status: 409 });
  if (st < 200 || st >= 300) {
    // (not reached (0: the bucket's CORS rule is the likely cause), or refused (400, 403, 501): through the relay)
    if (st === 0 || st === 400 || st === 403 || st === 501) return through(url, body, onP, st ? `the bucket refused it (HTTP ${st})` : 'the bucket could not be reached (is its CORS rule in place? the relay\'s start log says)');
    throw Object.assign(new Error('the scenes\' storage refused it (HTTP ' + st + ')'), { status: st });
  }
  return getJSON(api('done'), { method: 'POST' });
}
// the upload sent through the relay after the bucket refused it, and every one after it on this page
function through(url, body, onP, why) {
  directOff = true;
  console.warn(`The studio sends its uploads through the relay from now on: ${why}.`);
  return upVia(url, body, onP);
}
// through the relay, waiting while it has as many uploads on their way as it takes at once (429)
async function upVia(url, body, onP) {
  for (let k = 0; ; k++) {
    try { return await upPost(url, body, onP); } catch (e) {
      if (e.status !== 429 || k > 8) throw e;
      await new Promise(res => later(res, 1000 * Math.max(2, e.retry || 3)));
    }
  }
}
