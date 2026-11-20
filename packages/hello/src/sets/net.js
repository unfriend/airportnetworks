// The example's network, after Watts and Strogatz (Nature, 1998): N people on a ring, each knowing the K/2 nearest on
// either side; each of those links may be rewired, keeping one end and moving the other to someone anywhere on the ring
// (a seeded draw, so every device and every run shows the same network). A link is rewired at probability p when its
// own draw u is below p, so raising p only adds shortcuts and lowering it takes them back. Every number the story and
// the panes quote is computed here, on this example (HELLO.stats, HELLO.path), never typed in.
const HELLO = (() => {
  const N = 60, K = 4, SEED = 20251119;
  // a small seeded generator (mulberry32)
  const rng = s => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = rng(SEED), ringD = (a, b) => { const d = Math.abs(a - b) % N; return Math.min(d, N - d); };
  // the links, in Watts and Strogatz's order (the nearest neighbours round the ring, then the next): i to j0 = i + d; u,
  // the draw that says when it is rewired; t, the new far end (never i, never one of i's own ring neighbours)
  const links = [];
  for (let d = 1; d <= K / 2; d++) for (let i = 0; i < N; i++) {
    const u = r();
    let t;
    do t = Math.floor(r() * N); while (ringD(i, t) <= K / 2);
    links.push({ i, j0: (i + d) % N, u, t });
  }
  // the rewiring level r (0..1, what the story keys and eases) and the probability p: p = (1000^r - 1) / 999, so the
  // small p where the change happens take most of the way (r 0.33 is about 1 %, 0.5 about 3 %, 0.67 about 10 %)
  const pOf = lv => (lv <= 0 ? 0 : lv >= 1 ? 1 : (Math.pow(1000, lv) - 1) / 999);
  const levelOf = p => (p <= 0 ? 0 : p >= 1 ? 1 : Math.log(1 + 999 * p) / Math.log(1000));
  links.forEach(L => { L.lv = levelOf(L.u); });
  // the network at p: each person's friends (sorted, no repeats), cached by how many links are rewired
  const cache = new Map();
  function graph(p) {
    const on = links.map(L => L.u < p), id = on.reduce((s, x, k) => (x ? s + ',' + k : s), '');
    if (cache.has(id)) return cache.get(id);
    const adj = Array.from({ length: N }, () => new Set());
    links.forEach((L, k) => { const j = on[k] ? L.t : L.j0; adj[L.i].add(j); adj[j].add(L.i); });
    const g = { adj: adj.map(s => [...s].sort((a, b) => a - b)), rewired: on.filter(Boolean).length, m: 0 };
    g.m = g.adj.reduce((s, a) => s + a.length, 0) / 2;
    cache.set(id, g);
    return g;
  }
  // hops from person a to everyone (breadth first); -1 where no chain of friends reaches
  function hops(g, a, prev) {
    const d = new Array(N).fill(-1), q = [a];
    d[a] = 0;
    for (let h = 0; h < q.length; h++) for (const j of g.adj[q[h]]) if (d[j] < 0) { d[j] = d[q[h]] + 1; if (prev) prev[j] = q[h]; q.push(j); }
    return d;
  }
  // the network's numbers at p: the average number of handshakes between two people (over the pairs that are linked at
  // all), the most (the network's diameter), how many pairs no chain links, and how often two of a person's friends know
  // each other (the clustering coefficient, averaged over everyone with two friends or more)
  const stats = p => {
    const g = graph(p);
    if (g.stats) return g.stats;
    let sum = 0, n = 0, most = 0, apart = 0, cl = 0, cn = 0;
    for (let a = 0; a < N; a++) {
      const d = hops(g, a);
      for (let b = a + 1; b < N; b++) if (d[b] < 0) apart++; else { sum += d[b]; n++; most = Math.max(most, d[b]); }
      const f = g.adj[a], k = f.length;
      if (k >= 2) {
        let t = 0;
        for (let x = 0; x < k; x++) for (let y = x + 1; y < k; y++) if (g.adj[f[x]].includes(f[y])) t++;
        cl += t / (k * (k - 1) / 2); cn++;
      }
    }
    return (g.stats = { avg: n ? sum / n : 0, most, apart, clust: cn ? cl / cn : 0, rewired: g.rewired, links: links.length, m: g.m });
  };
  // the shortest chain of friends from a to b at p (the first found, friends taken in order, so the same on every device),
  // as a list of people from a to b; null when there is none
  function path(p, a, b) {
    if (!(a >= 0 && a < N && b >= 0 && b < N)) return null;
    const g = graph(p), prev = new Array(N).fill(-1), d = hops(g, a, prev);
    if (d[b] < 0) return null;
    const out = [b];
    while (out[0] !== a) out.unshift(prev[out[0]]);
    return out;
  }
  // where person i stands: on a ring of radius 1, the first at the front, going round anticlockwise seen from above
  const pos = i => { const th = 2 * Math.PI * i / N; return [Math.sin(th), 0, Math.cos(th)]; };
  // the shape of a link from i to j, n + 1 points: a ring link stays on the ring (a chord), a shortcut arches over it,
  // the higher the longer
  function arc(i, j, n) {
    const a = pos(i), b = pos(j), c = Math.hypot(b[0] - a[0], b[2] - a[2]), up = ringD(i, j) <= K / 2 ? 0 : 0.75 * c, out = [];
    for (let s = 0; s <= n; s++) {
      const f = s / n;
      out.push([a[0] + (b[0] - a[0]) * f, up * 2 * f * (1 - f), a[2] + (b[2] - a[2]) * f]);
    }
    return out;
  }
  return { N, K, links, pOf, levelOf, graph, stats, path, pos, arc, ringD };
})();
if (typeof module !== 'undefined') module.exports = HELLO;
