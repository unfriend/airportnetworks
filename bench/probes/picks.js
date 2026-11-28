// A bench probe (tools/bench/SPEC.md 10): what explore mode's picking costs a frame while pretend controller rays sweep
// over the story (v231's fault: cdk5's and the exposome's pick caches refilled every frame, 18 ms of script a frame on the
// owner's Quest 3). The story's pickWith is timed for the probe's length by fixed expressions only (put back after), so
// the figures are the pick's own: ms a frame, picks a frame, the slowest pick. args: { sec (10), preset ('sweep') }.
// Needs a headset session and explore mode (open the story and press explore first); a story without pickWith (the
// hand-written ones) says so.
HOST.bench.probe('picks', async (api, args) => {
  const a = args && typeof args === 'object' ? args : {};
  const story = api.story();
  if (!api.peek("typeof pickWith === 'function'")) return { story, pick: null, why: 'this story has no explore pick (pickWith)' };
  if (!api.session()) return { story, pick: null, why: 'needs a headset session (the rays are pretend controllers)' };
  const mode = api.app().mode;
  api.peek("(function () { if (window.__benchPick) return 0; var f = pickWith; window.__benchPick = { f: f, ms: 0, n: 0, max: 0 }; pickWith = function (rc) { var t = performance.now(); try { return f(rc); } finally { var d = performance.now() - t, B = window.__benchPick; if (B) { B.ms += d; B.n++; if (d > B.max) B.max = d; } } }; return 1; })()");
  let r;
  try {
    r = await api.rays({ preset: a.preset || 'sweep', sec: +a.sec || 10, measure: true });
  } finally {
    var B = api.peek("(function () { var B = window.__benchPick; if (!B) return null; pickWith = B.f; delete window.__benchPick; return { ms: B.ms, n: B.n, max: B.max }; })()");
  }
  const frames = r.frames || 0, seg = r.seg || {};
  const r2 = v => Math.round(v * 100) / 100;
  api.log(`${story} in ${mode} mode: ${B ? B.n : 0} picks over ${frames} frames, ${B && frames ? r2(B.ms / frames) : 0} ms a frame`);
  return {
    story, mode, frames, hovers: r.hovers,
    pick: B ? { msFrame: frames ? r2(B.ms / frames) : null, perFrame: frames ? r2(B.n / frames) : null, worst: r2(B.max), total: r2(B.ms), n: B.n } : null,
    frame: { mean: seg.mean, p95: seg.p95, js: seg.js, miss: seg.miss, calls: seg.calls },
  };
});
