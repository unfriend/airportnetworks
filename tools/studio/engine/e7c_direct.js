// ============================================================== R2 (direct) ==
// A relay that keeps its scenes in a Cloudflare R2 bucket (relay/README.md, "Scenes in Cloudflare R2") says so in its list
// of scenes (direct: true, linkTtl). Its listing of a scene gives each file a signed link, which fileUrl hands the loaders
// and the sound elements: the page fetches the file straight from the bucket, from its own origin (no password in it: the
// link is the permission, for that one file, until it lapses). Those links live linkTtl seconds (R2_LINK_TTL, 12 hours by
// default), so the listing is read again before half of that has passed (linksSoon). An upload goes straight into the
// bucket too: upSend hands a .../file upload to upDirect, which asks the relay for a signed PUT (.../put, with the file's
// size: the bucket refuses a body of another size), sends the file there with its progress, and tells the relay it is
// there (.../done). The relay answers as for an upload through it ({ ok, path, bytes, at }; 409 for a name taken), so
// the Upload pane, Convert to GLB and the texture buttons work the same either way.
let linksT = 0;
function linksSoon(ms) {
  unlater(linksT); linksT = 0;
  if (!(SRC.linkTtl > 0)) return;
  // (a listing that could not be read is asked again a minute later: setFiles, which calls this, did not run)
  linksT = later(async () => { linksT = 0; await refreshFiles(new Set()); if (!linksT && STU.files.some(f => f.url)) linksSoon(60000); }, ms || Math.max(60, SRC.linkTtl / 2) * 1000);
}
// one upload straight into the bucket: url is the .../file address upSend was given (its scene, path and replace=1)
function upDirect(url, body, onP) {
  const u = new URL(url, location.href), m = /\/api\/scenes\/([^/]+)\/file$/.exec(u.pathname);
  if (!m || SRC.held) return Promise.reject(SRC.held ? AUTH_ERR() : new Error('not an upload'));
  const q = new URLSearchParams(u.search), size = body ? (body.size !== undefined ? body.size : body.byteLength || 0) : 0;
  const api = what => `${SRC.base}/api/scenes/${m[1]}/${what}?path=${encodeURIComponent(q.get('path') || '')}${q.get('replace') === '1' ? '&replace=1' : ''}&size=${size}`;
  return getJSON(api('put'), { method: 'POST' })
    .then(link => new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open('PUT', link.url);
      for (const [k, v] of Object.entries((link && link.headers) || {})) x.setRequestHeader(k, v);
      if (onP) x.upload.onprogress = e => { if (e.lengthComputable) onP(e.loaded / Math.max(1, e.total)); };
      // (412: a file of that name came meanwhile, as the relay's 409)
      x.onload = () => (x.status >= 200 && x.status < 300 ? res() : rej(Object.assign(new Error(x.status === 412 ? 'there is a file by that name' : 'the scenes\' storage refused it (HTTP ' + x.status + ')'), { status: x.status === 412 ? 409 : x.status })));
      x.onerror = () => rej(Object.assign(new Error('the scenes\' storage could not be reached'), { status: 0 }));
      x.send(body || null);
    }))
    .then(() => getJSON(api('done'), { method: 'POST' }));
}
