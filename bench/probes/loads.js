// A bench probe (tools/bench/SPEC.md 10): the story on show's load steps and their times (its LOAD.ms: each step's
// label and ms as the story built it), slowest first, with the total. Run it right after an open step. A story without
// LOAD (a hand-written one) says so.
HOST.bench.probe('loads', async (api) => {
  const ms = api.peek("typeof LOAD !== 'undefined' && LOAD.ms ? LOAD.ms : null");
  if (!ms || typeof ms !== 'object') return { story: api.story(), why: 'this story keeps no load steps (LOAD.ms)' };
  const steps = Object.entries(ms).map(([k, v]) => ({ step: Array.isArray(v) ? String(v[0]) : k, ms: Math.round((Array.isArray(v) ? +v[1] : +v) || 0) }));
  const total = steps.reduce((a, s) => a + s.ms, 0);
  steps.sort((a, b) => b.ms - a.ms);
  return { story: api.story(), total, n: steps.length, steps: steps.slice(0, 60) };
});
