// PNET: the method in the page (the Network tab, "Your own network" in SPEC.md), shared by the cell and checked in Node
// by src/data/test-pnet.mjs. What src/data/gen_data.py does once for the story, done again live: the limits (the least
// support a link needs, the Atlas's reliability levels and the places that count), the judgement of every link, the
// links drawn (the most important first, a share of each verdict and place) and the communities within each place
// (label propagation, seeded, the generator's own method). And a network chosen on the page: read (pairs of
// identifiers, an optional score and kind), mapped onto the map's proteins and the lookup's (data/lookup.json, loaded
// only then), made into a network the cell draws as its own. Nothing here sends anything anywhere.
const PNET = (() => {
  const P0 = typeof PDATA !== 'undefined' ? PDATA : require('./pdata.js');
  const S0 = typeof PSIDES !== 'undefined' ? PSIDES : require('./psides.js');
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // time slicing: a generator below yields (its share done, 0 to 1) once T.until has passed, so a long step is spread
  // over frames and never holds one up (T.until Infinity: run straight through)
  const T = { until: Infinity };
  const late = () => T.until !== Infinity && now() > T.until;
  // a generator run to its end at once
  const run = g => { let r; while (!(r = g.next()).done); return r.value; };
  const pop = x => { let c = 0; for (; x; x &= x - 1) c++; return c; };

  // ---------------------------------------------------------------- limits
  // the Atlas's reliability levels (PDATA.rel: 1 Uncertain, 2 Approved, 3 Supported, 4 Enhanced; 0 none given, always
  // counted) as bits of a mask; the default counts all
  const REL = ['', 'Uncertain', 'Approved', 'Supported', 'Enhanced'];
  const LIM0 = { sup: 0, rel: 31, pls: 8191 };
  const isDefault = lim => lim.sup === 0 && (lim.rel | 1) === 31 && lim.pls === 8191;
  // the support steps a network offers (the least support a link needs): the map's, by kinds of evidence (1 to 4: 412
  // links have four, 17 five, none more); a chosen network's, by its scores where it has them
  const SUP_KINDS = [1, 2, 3, 4].map(v => ({ v, label: v === 1 ? 'Any (1 kind)' : `${v} kinds` }));
  const steps = P => P.supSteps || SUP_KINDS;
  // a network within limits: its links with enough support, each protein's places those counted (none if its
  // reliability is not counted: the Atlas gives one level for all a protein's places); the same proteins in the same
  // order, so a pick keeps its number. com null: the communities have to be found again. base: { P, S }
  // (a generator: it yields between its steps, so the page spreads them over frames; limit() runs it at once)
  function* limitGen(base, lim) {
    if (isDefault(lim)) return base;
    const P = base.P, S = base.S, st = steps(P), sv = (st[lim.sup] || st[0]).v;
    let n = 0;
    const keep = new Uint32Array(P.E);
    for (let i = 0; i < P.E; i++) if (P.sup[i] >= sv) keep[n++] = i;
    const pick = a => { const o = new a.constructor(n); for (let j = 0; j < n; j++) o[j] = a[keep[j]]; return o; };
    const pl = new Uint16Array(P.N), main = new Uint16Array(P.N);
    for (let p = 0; p < P.N; p++) if (lim.rel >> P.rel[p] & 1 || !P.rel[p]) { pl[p] = P.pl[p] & lim.pls; main[p] = P.main[p] & pl[p]; }
    yield;
    const Q = P.make({ sym: P.sym, pl, main, rel: P.rel, la: pick(P.la), lb: pick(P.lb), kind: pick(P.kind), sup: pick(P.sup), supSteps: P.supSteps, kinds: P.kinds, kindNames: P.kindNames, noncontact: P.NONCONTACT, com: null });
    yield;
    // each new location's sides: its protein's at the same place in the base
    const cls = new Uint8Array(Q.L), lay = [], ev = [], by = [];
    for (let l = 0; l < Q.L; l++) {
      const p = Q.lProt[l], k = Q.lPlace[l];
      let b = P.lOf[p];
      while (P.lPlace[b] !== k) b++;
      cls[l] = S.cls[b]; lay.push(S.lay[b]); ev.push(S.ev[b]); by.push(S.by[b]);
    }
    return { P: Q, S: S.of(Q, { cls, lay, ev, by, acc: S.acc, cx: S.cx }), base };
  }
  const limit = (base, lim) => run(limitGen(base, lim));

  // ---------------------------------------------------------------- communities
  // gen_data.py's communities(), the same to the last tie: label propagation over the contact links within each place
  // (a location in place k joins only links whose other end is in place k too), proteins visited in an order shuffled
  // by a fixed linear congruential generator, each taking the label that gains most (its links to the label's members,
  // weighted by their kinds of evidence, less GAMMA times its degree times the label's total degree over twice the
  // place's links), its own label kept among equals, else the smallest; at most 60 rounds. Per location (P's order), its
  // community in its place, numbered by size (0 the largest; ties by first member). Yields its share done.
  const GAMMA = 2;
  function* communities(P) {
    const N = P.N, out = new Uint16Array(P.L), nc = P.NONCONTACT;
    // the links each place holds (both ends there): per place, a list of link numbers
    const byPl = Array.from({ length: 13 }, () => []);
    for (let i = 0; i < P.E; i++) {
      const a = P.la[i], b = P.lb[i];
      if (a === b || !(P.kind[i] & ~nc)) continue;
      for (let m = P.pl[a] & P.pl[b] & 8191; m; m &= m - 1) byPl[31 - Math.clz32(m & -m)].push(i);
    }
    const loc = new Int32Array(N).fill(-1);
    let done = 0;
    for (let k = 0; k < 13; k++) {
      const members = [];
      for (let p = 0; p < N; p++) if (P.pl[p] >> k & 1) members.push(p);
      const n = members.length;
      members.forEach((p, j) => { loc[p] = j; });
      // each member's neighbours and weights (a pair's links added up), as lists
      const nbs = Array.from({ length: n }, () => new Map());
      for (const i of byPl[k]) {
        const a = loc[P.la[i]], b = loc[P.lb[i]], w = pop(P.kind[i] & ~nc);
        nbs[a].set(b, (nbs[a].get(b) || 0) + w); nbs[b].set(a, (nbs[b].get(a) || 0) + w);
      }
      const nbI = nbs.map(m => Int32Array.from(m.keys())), nbW = nbs.map(m => Float64Array.from(m.values()));
      const deg = new Float64Array(n);
      let m2 = 0;
      for (let j = 0; j < n; j++) { let s = 0; for (const w of nbW[j]) s += w; deg[j] = s; m2 += s; }
      m2 = m2 || 1;
      const label = Int32Array.from({ length: n }, (_, j) => j), vol = Float64Array.from(deg), order = Int32Array.from({ length: n }, (_, j) => j);
      const sc = new Float64Array(n), seen = new Uint8Array(n), touched = [];
      let seed = 12345 + k;
      for (let round = 0; round < 60; round++) {
        for (let j = n - 1; j > 0; j--) {   // (Fisher-Yates with the generator's LCG: its low 31 bits, exactly)
          seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
          const r = seed % (j + 1), t = order[j]; order[j] = order[r]; order[r] = t;
        }
        let changed = 0;
        for (let q = 0; q < n; q++) {
          if ((q & 1023) === 0 && late()) yield (done + n * round / 60 * 0.3) / P.L;
          const i = order[q], ni = nbI[i];
          if (!ni.length) continue;
          const own = label[i], ki = deg[i];
          touched.length = 0;
          sc[own] = 0; seen[own] = 1; touched.push(own);
          for (let x = 0; x < ni.length; x++) { const l = label[ni[x]]; if (!seen[l]) { seen[l] = 1; sc[l] = 0; touched.push(l); } sc[l] += nbW[i][x]; }
          let best = -Infinity, bl = -1, ownGain = 0;
          for (const l of touched) {
            const g = sc[l] * m2 - GAMMA * ki * (vol[l] - (l === own ? ki : 0));
            if (l === own) ownGain = g;
            if (g > best || (g === best && l < bl)) { best = g; bl = l; }
            seen[l] = 0;
          }
          const nw = ownGain === best ? own : bl;
          if (nw !== own) { vol[own] -= ki; vol[nw] += ki; label[i] = nw; changed++; }
        }
        if (!changed) break;
      }
      // numbered by size, ties by first member (the members are in protein order)
      const size = new Int32Array(n), first = new Int32Array(n).fill(-1);
      for (let j = 0; j < n; j++) { size[label[j]]++; if (first[label[j]] < 0) first[label[j]] = j; }
      const labs = [];
      for (let j = 0; j < n; j++) if (size[j]) labs.push(j);
      labs.sort((x, y) => size[y] - size[x] || first[x] - first[y]);
      const num = new Int32Array(n);
      labs.forEach((l, c) => { num[l] = c; });
      for (let j = 0; j < n; j++) {
        const p = members[j];
        let l = P.lOf[p];
        while (P.lPlace[l] !== k) l++;
        out[l] = num[label[j]];
      }
      members.forEach(p => { loc[p] = -1; });
      done += n;
      if (late()) yield done / P.L;
    }
    return out;
  }

  // ---------------------------------------------------------------- the judgement and what is drawn
  // the locations the cell draws: P's, then one more for each protein without a place (place 13, outside the cell)
  function locs(P) {
    const unplaced = [];
    for (let p = 0; p < P.N; p++) if (!P.pl[p]) unplaced.push(p);
    const NALL = P.L + unplaced.length, lProt = new Uint16Array(NALL), lPlace = new Uint8Array(NALL), uLoc = new Int32Array(P.N).fill(-1);
    lProt.set(P.lProt); lPlace.set(P.lPlace);
    unplaced.forEach((p, u) => { lProt[P.L + u] = p; lPlace[P.L + u] = 13; uLoc[p] = P.L + u; });
    const l0 = p => (P.pl[p] ? P.lOf[p] : uLoc[p]), l1 = p => (P.pl[p] ? P.lOf[p + 1] : uLoc[p] + 1);
    return { NALL, lProt, lPlace, uLoc, unplaced, l0, l1 };
  }
  // two locations' judgement from their spaces (10 bits: PDATA's nine and the mitochondria's gap): 0 a shared space, 1
  // one gate apart, 2 neither (each pair of masks worked out once)
  const GJ = new Int8Array(1 << 20).fill(-1);
  const pairJ = (a, b) => { if (a & b) return 0; const k = a << 10 | b; if (GJ[k] < 0) GJ[k] = S0.gated(a, b) ? 1 : 2; return GJ[k]; };
  // every link judged (g: 0 strict, 1 generous; sd: sides 0 none, 1 named, 2 carried): its two locations (the best pair
  // of its proteins' locations; among equals one in a single place, the shortest to draw), its class (0 possible, 1
  // through a gate, 2 impossible, 3 grey) and why grey (1 not a contact, 2 an end without a place); lSp each location's
  // spaces. The same as PSIDES.judge (and PDATA.judge without sides) on the proteins' whole lists.
  function* judge(P, S, LC, g, sd) {
    const E = P.E, a = new Int32Array(E), b = new Int32Array(E), cls = new Uint8Array(E), why = new Uint8Array(E), lSp = new Uint16Array(LC.NALL);
    for (let l = 0; l < LC.NALL; l++) lSp[l] = LC.lPlace[l] >= 13 ? 0 : sd ? S.locMask(l, g === 1, sd === 2) : P.spaces(1 << LC.lPlace[l], g);
    for (let i = 0; i < E; i++) {
      if ((i & 4095) === 0 && late()) yield i / E;
      const u = P.la[i], v = P.lb[i];
      why[i] = !P.contact(i) ? 1 : !P.pl[u] || !P.pl[v] ? 2 : 0;
      if (!P.pl[u] || !P.pl[v]) { a[i] = LC.l0(u); b[i] = LC.l0(v); cls[i] = 3; continue; }
      let best = 9, ba = 0, bb = 0;
      for (let x = LC.l0(u); x < LC.l1(u); x++) for (let y = LC.l0(v); y < LC.l1(v); y++) {
        const c = pairJ(lSp[x], lSp[y]) * 2 + (LC.lPlace[x] === LC.lPlace[y] ? 0 : 1);
        if (c < best) { best = c; ba = x; bb = y; }
      }
      a[i] = ba; b[i] = bb; cls[i] = why[i] ? 3 : best >> 1;
    }
    return { a, b, cls, why, lSp };
  }
  // every link, the most important first: the most support (kinds of evidence, or a chosen network's score), ties by
  // its place in the list
  function order(P) {
    const s = P.sup, E = P.E;
    // (support in whole numbers 0 to 7, the kinds of evidence: counted out, the fastest; a chosen network's scores sorted)
    let small = true;
    for (let i = 0; i < E && small; i++) small = s[i] >= 0 && s[i] <= 7 && s[i] === Math.floor(s[i]);
    if (small) {
      const n = new Uint32Array(8), at = new Uint32Array(8), o = new Uint32Array(E);
      for (let i = 0; i < E; i++) n[s[i]]++;
      for (let c = 6; c >= 0; c--) at[c] = at[c + 1] + n[c + 1];
      for (let i = 0; i < E; i++) o[at[s[i]]++] = i;
      return o;
    }
    return Uint32Array.from({ length: E }, (_, i) => i).sort((x, y) => s[y] - s[x] || x - y);
  }
  // share n among groups by the square root of their sizes; a group smaller than its share gives the rest to the others
  function share(sizes, n) {
    const take = sizes.map(() => 0), open = new Set(sizes.map((s, k) => k).filter(k => sizes[k]));
    let left = n;
    for (let changed = true; changed && open.size;) {
      changed = false;
      const w = [...open].reduce((s, k) => s + Math.sqrt(sizes[k]), 0);
      for (const k of [...open]) if (sizes[k] <= left * Math.sqrt(sizes[k]) / w) { take[k] = sizes[k]; left -= take[k]; open.delete(k); changed = true; }
      if (!changed) for (const k of open) take[k] = Math.floor(left * Math.sqrt(sizes[k]) / w);
    }
    return take;
  }
  // share n between the kinds of judgement in proportion to their counts, each kind that has any taking at least
  // KIND_MIN (so the rare red ones still show), the rest to the possible ones (0); what a kind cannot use goes to the others
  const KIND_MIN = 100;
  function shareKinds(sizes, n) {
    const tot = sizes.reduce((s, x) => s + x, 0), take = sizes.map(() => 0);
    if (!tot) return take;
    for (let k = 1; k < sizes.length; k++) take[k] = Math.min(sizes[k], Math.max(KIND_MIN, Math.floor(n * sizes[k] / tot)));
    take[0] = Math.min(sizes[0], Math.max(0, n - take.reduce((s, x) => s + x, 0)));
    for (let left = n - take.reduce((s, x) => s + x, 0), k = 1; left > 0 && k < sizes.length; k++) { const d = Math.min(left, sizes[k] - take[k]); take[k] += d; left -= d; }
    return take;
  }
  // what is drawn: the counts of the kind on show (kind -1: every kind) and the most important links of the verdicts
  // on show (show 0 possible ... 3 grey too), n at most, shared between the verdicts (shareKinds) and the possible ones
  // between the places (by the square root of theirs): list the pale draw (possible and grey), flagged the amber and red
  function select(P, J, ORDER, lPlace, show, kind, n) {
    const tally = [0, 0, 0], groups = [[], [], [], []];
    let notC = 0, unpl = 0;
    for (let o = 0; o < P.E; o++) {
      const i = ORDER[o];
      if (kind >= 0 && !(P.kind[i] >> kind & 1)) continue;
      if (J.why[i] === 1) notC++; else if (J.why[i] === 2) unpl++; else tally[J.cls[i]]++;
      if (J.cls[i] <= show) groups[J.cls[i]].push(i);
    }
    const tk = shareKinds(groups.map(x => x.length), n), byPl = Array.from({ length: 14 }, () => []);
    for (const i of groups[0]) byPl[lPlace[J.a[i]]].push(i);
    const tp = share(byPl.map(x => x.length), tk[0]), list = [];
    byPl.forEach((x, k) => list.push(...x.slice(0, tp[k])));
    list.push(...groups[3].slice(0, tk[3]));   // (the grey ones in the same pale draw)
    const flagged = [...groups[1].slice(0, tk[1]), ...groups[2].slice(0, tk[2])];
    return { list, flagged, tally, notC, unpl, drawnBy: [tp.reduce((s, x) => s + x, 0), tk[1], tk[2], tk[3]] };
  }

  // ---------------------------------------------------------------- a network chosen on the page
  // The format (the Network tab says it in a few lines): one pair a line, two identifiers (HGNC symbols, any case;
  // UniProt accessions; NCBI gene numbers; Ensembl gene ids), then optionally a score (a number) and a kind (a word), in
  // any order after the two; separated by tabs, commas, semicolons or spaces; '#' starts a comment line; a first line
  // that names no protein is a header. A self-link is kept, as the map keeps its own; a pair given twice is one link
  // (its best score, its kinds joined). Nothing but the pairs, scores and kinds is read.
  const MAX_LINES = 250000, MAX_BYTES = 20e6, MAX_KINDS = 7;
  const RE = {
    acc: /^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})(?:-\d+)?$/,
    ens: /^ENSG\d{11}(?:\.\d+)?$/i, gid: /^\d{1,9}$/, num: /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i,
  };
  const ID_NAME = { sym: 'gene symbols', acc: 'UniProt accessions', gid: 'NCBI gene numbers', ens: 'Ensembl gene ids' };
  const idKind = s => (RE.ens.test(s) ? 'ens' : RE.acc.test(s) ? 'acc' : RE.gid.test(s) ? 'gid' : 'sym');
  // the text read into rows: { rows: [[line, a, b, score (NaN none), kind ('' none)]], ... } or { error }
  function parse(text) {
    if (typeof text !== 'string') return { error: 'Nothing to read.' };
    if (text.length > MAX_BYTES) return { error: `The file is ${(text.length / 1e6).toFixed(1)} MB: this page takes at most ${MAX_BYTES / 1e6} MB (about ${MAX_LINES.toLocaleString('en-GB')} pairs).` };
    const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/), rows = [], errors = [];
    let read = 0, comments = 0, sep = null;
    for (let n = 0; n < lines.length; n++) {
      const t = lines[n].trim();
      if (!t) continue;
      if (t[0] === '#') { comments++; continue; }
      read++;
      if (read > MAX_LINES) return { error: `More than ${MAX_LINES.toLocaleString('en-GB')} pairs: this page takes at most that many (more would not stay fluent).` };
      if (!sep) sep = t.includes('\t') ? '\t' : t.includes(',') ? ',' : t.includes(';') ? ';' : /\s+/;
      const f = t.split(sep).map(x => x.trim().replace(/^"(.*)"$/, '$1').trim());
      if (f.length < 2 || !f[0] || !f[1]) { errors.push([n + 1, 'only one identifier']); continue; }
      rows.push([n + 1, f[0], f[1], f.slice(2).filter(x => x !== '')]);
    }
    if (!rows.length) return { error: errors.length ? `No pair read: line ${errors[0][0]} has ${errors[0][1]}.` : 'No pair read: one pair a line, two identifiers.' };
    // the columns after the two: a score where most are numbers, else a kind (the first row left out: it may be a header)
    const extra = Math.max(0, ...rows.map(r => r[3].length)), body = rows.length > 1 ? rows.slice(1) : rows;
    const isNum = c => { let y = 0, n = 0; for (const r of body) if (r[3][c] !== undefined) { n++; if (RE.num.test(r[3][c])) y++; } return n && y > 0.5 * n; };
    let scoreCol = -1, kindCol = -1;
    for (let c = 0; c < Math.min(extra, 4); c++) { if (scoreCol < 0 && isNum(c)) scoreCol = c; else if (kindCol < 0 && !isNum(c)) kindCol = c; }
    // the columns' identifiers, by what most of them look like
    const kinds = [1, 2].map(c => { const n = { sym: 0, acc: 0, gid: 0, ens: 0 }; for (const r of body) n[idKind(r[c])]++; return Object.keys(n).reduce((x, y) => (n[y] > n[x] ? y : x), 'sym'); });
    // a header: a first row whose score is no number (else fromRows takes a first row naming no protein for one)
    let header = 0;
    if (rows.length > 1 && scoreCol >= 0 && rows[0][3][scoreCol] !== undefined && !RE.num.test(rows[0][3][scoreCol])) header = rows.shift()[0];
    const out = rows.map(r => {
      const sc = scoreCol >= 0 && r[3][scoreCol] !== undefined ? r[3][scoreCol] : '';
      if (sc !== '' && !RE.num.test(sc)) errors.push([r[0], `the score ${JSON.stringify(sc.slice(0, 20))} is not a number (the pair is kept without it)`]);
      return [r[0], r[1], r[2], sc !== '' && RE.num.test(sc) ? parseFloat(sc) : NaN, kindCol >= 0 ? String(r[3][kindCol] || '').toLowerCase().slice(0, 24) : ''];
    });
    return { rows: out, read, comments, errors, header, idKinds: kinds, hasScore: scoreCol >= 0, hasKind: kindCol >= 0 };
  }
  // the identifiers to the map's proteins (0 to N - 1) and the lookup's (N + its number): the map's own tables (its
  // symbols, its UniProt accessions), then the lookup's (gene numbers, Ensembl ids, its genes outside the map, unique
  // former symbols); LK the decoded lookup, or null (not loaded: only the map's own tables)
  function tables(LK) {
    const T2 = { sym: new Map(), acc: new Map(), gid: new Map(), ens: new Map(), syn: new Map() };
    const put = (m, k, v) => { if (k && !m.has(k)) m.set(k, v); };
    P0.sym.forEach((s, p) => put(T2.sym, s.toUpperCase(), p));
    S0.acc.forEach((a, p) => put(T2.acc, a, p));
    if (LK) {
      LK.gid.forEach((g, p) => put(T2.gid, g, p)); LK.ens.forEach((e, p) => put(T2.ens, e, p));
      LK.x.sym.forEach((s, j) => put(T2.sym, s.toUpperCase(), P0.N + j));
      LK.x.acc.forEach((a, j) => put(T2.acc, a, P0.N + j)); LK.x.gid.forEach((g, j) => put(T2.gid, g, P0.N + j)); LK.x.ens.forEach((e, j) => put(T2.ens, e, P0.N + j));
      for (const [s, r] of LK.syn) put(T2.syn, s.toUpperCase(), r);
    }
    return T2;
  }
  const ensNum = s => String(parseInt(s.slice(4), 10));
  function find(T2, s) {
    const k = idKind(s);
    if (k === 'ens') return T2.ens.get(ensNum(s.toUpperCase()));
    if (k === 'acc') { const a = T2.acc.get(s.split('-')[0]); if (a !== undefined) return a; }
    if (k === 'gid') { const g = T2.gid.get(s); if (g !== undefined) return g; }
    const u = s.toUpperCase();
    return T2.sym.has(u) ? T2.sym.get(u) : T2.syn.get(u);
  }
  // the lookup (data/lookup.json, gen_lookup.py) decoded: the map's proteins' gene numbers and Ensembl ids, and the
  // Atlas's genes outside the map with their places, reliability, sides and complexes
  function decodeLookup(J) {
    const sp = s => (s ? s.split('|') : []), x = J.extra, b64 = s => (typeof atob === 'function' ? Uint8Array.from(atob(s), c => c.charCodeAt(0)) : new Uint8Array(Buffer.from(s, 'base64')));
    const u16 = s => { const b = b64(s); return new Uint16Array(b.buffer, b.byteOffset, b.length / 2); };
    const cx = new Map();
    for (const [n, js] of J.extra.cx) for (const j of js) (cx.get(j) || cx.set(j, []).get(j)).push(n);
    return { J, gid: sp(J.gid), ens: sp(J.ens), syn: J.syn.map(([s, r]) => [s, r]), x: { sym: sp(x.sym), acc: sp(x.acc), gid: sp(x.gid), ens: sp(x.ens), pl: u16(x.pl), main: u16(x.main), rel: Uint8Array.from(x.rel, c => +c), cls: x.cls, lay: x.lay, ev: x.ev, by: x.by, cx } };
  }
  // the rows mapped and made into a network: { model: { P, S } (null when nothing is left), report }
  function fromRows(R, LK, name) {
    const T2 = tables(LK), ref = new Map(), miss = new Map();
    const look = s => { if (ref.has(s)) return ref.get(s); const r = find(T2, s); ref.set(s, r === undefined ? -1 : r); if (r === undefined) miss.set(s, (miss.get(s) || 0) + 1); return r === undefined ? -1 : r; };
    // the kinds: every word, or with more than seven the six commonest and 'other' (a bit each)
    const freq = new Map();
    if (R.hasKind) for (const r of R.rows) { const w = r[4] || 'unnamed'; freq.set(w, (freq.get(w) || 0) + 1); }
    const words = [...freq].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).map(x => x[0]);
    const kindNames = words.length > MAX_KINDS ? words.slice(0, MAX_KINDS - 1).concat('other') : R.hasKind ? words : ['listed'];
    const kindIx = new Map(words.map((w, i) => [w, Math.min(i, MAX_KINDS - 1)]));
    const pairs = new Map();
    let dropped = 0, header = R.header;
    // (a first line naming no protein at all: a header)
    if (!header && R.rows.length > 1 && find(T2, R.rows[0][1]) === undefined && find(T2, R.rows[0][2]) === undefined) header = R.rows[0][0];
    for (const [n, a, b, sc, kw] of R.rows) {
      if (n === header) continue;
      const x = look(a), y = look(b);
      if (x < 0 || y < 0) { dropped++; continue; }
      const bit = R.hasKind ? 1 << kindIx.get(kw || 'unnamed') : 1;
      const key = x < y ? x * 1048576 + y : y * 1048576 + x, o = pairs.get(key);
      if (o) { o.k |= bit; if (!(o.s >= sc)) o.s = Number.isNaN(sc) ? o.s : sc; } else pairs.set(key, { a: Math.min(x, y), b: Math.max(x, y), k: bit, s: sc });
    }
    const report = { name, read: R.read, comments: R.comments, header, errors: R.errors, idKinds: R.idKinds, hasScore: R.hasScore, hasKind: R.hasKind, kinds: kindNames,
      pairs: pairs.size, dropped, found: 0, inMap: 0, missing: [...miss.keys()], placed: 0, judged: 0, lookup: !!LK };
    if (!pairs.size) return { model: null, report };
    return { model: run(build([...pairs.values()], kindNames, R.hasScore, LK, report)), report };
  }
  // links ({ a, b: the map's protein numbers, N + the lookup's; k: kind bits; s: score, NaN none }, in order) made into
  // a network: { P, S, score } (a generator: it yields between its steps, so a shared network is built between frames)
  function* build(links, kindNames, hasScore, LK, report) {
    const N0 = P0.N;
    const prots = [...new Set(links.flatMap(q => [q.a, q.b]))].sort((x, y) => x - y), at = new Map(prots.map((r, i) => [r, i]));
    const N = prots.length, E = links.length;
    report.found = N; report.inMap = prots.filter(r => r < N0).length;
    const sym = [], pl = new Uint16Array(N), main = new Uint16Array(N), rel = new Uint8Array(N);
    prots.forEach((r, i) => {
      if (r < N0) { sym.push(P0.sym[r]); pl[i] = P0.pl[r]; main[i] = P0.main[r]; rel[i] = P0.rel[r]; }
      else { const j = r - N0; sym.push(LK.x.sym[j]); pl[i] = LK.x.pl[j]; main[i] = LK.x.main[j]; rel[i] = LK.x.rel[j]; }
    });
    const la = new Uint16Array(E), lb = new Uint16Array(E), kind = new Uint8Array(E), sup = new Float32Array(E);
    for (let e = 0; e < E; e++) { const q = links[e]; la[e] = at.get(q.a); lb[e] = at.get(q.b); kind[e] = q.k; sup[e] = hasScore ? (Number.isNaN(q.s) ? -Infinity : q.s) : pop(q.k); }
    if (late()) yield 0.3;
    // the least support: by score where there is one (any, then its median, upper quarter and top tenth), else by kinds
    let supSteps;
    if (hasScore) {
      const s = Float32Array.from(sup).filter(Number.isFinite).sort(), q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))];
      // (each step that leaves something out, with how many links it keeps)
      supSteps = [{ v: -Infinity, label: 'Any score' }];
      const keep = v => { let n = 0; for (let i = 0; i < E; i++) if (sup[i] >= v) n++; return n; };
      if (s.length) for (const f of [0.5, 0.75, 0.9]) { const v = q(f), n = keep(v); if (n < E && !supSteps.some(x => x.v === v)) supSteps.push({ v, label: `≥ ${+v.toPrecision(3)} (${n.toLocaleString('en-US')} links)` }); }
    } else {
      let top = 1;
      for (let i = 0; i < E; i++) if (sup[i] > top) top = sup[i];   // (a loop: a quarter of a million arguments would overflow the stack)
      supSteps = [1, 2, 3, 4].filter(v => v <= top).map(v => ({ v, label: v === 1 ? 'Any (1 kind)' : `${v} kinds` }));
    }
    const KN = kindNames.map(w => w.charAt(0).toUpperCase() + w.slice(1));
    const P = P0.make({ sym, pl, main, rel, la, lb, kind, sup, supSteps, kinds: kindNames, kindNames: KN, noncontact: 0, com: null });
    if (late()) yield 0.5;
    // each location's side: the map's (PSIDES) for its proteins, the lookup's for the rest
    const cls = new Uint8Array(P.L), lay = [], ev = [], by = [], acc = [];
    for (let l = 0; l < P.L; l++) {
      const r = prots[P.lProt[l]], k = P.lPlace[l];
      if (r < N0) { let b = P0.lOf[r]; while (P0.lPlace[b] !== k) b++; cls[l] = S0.cls[b]; lay.push(S0.lay[b]); ev.push(S0.ev[b]); by.push(S0.by[b]); }
      else {
        const j = r - N0, x = LK.x;
        let b = LK.xOf[j];   // (the lookup's locations: its genes in order, each its places in order)
        for (let kk = 0; kk < k; kk++) if (x.pl[j] >> kk & 1) b++;
        const c = x.cls[b];
        cls[l] = c === '.' ? 255 : +c; lay.push(x.lay[b]); ev.push(x.ev[b]); by.push(x.by[b]);
      }
    }
    prots.forEach(r => acc.push(r < N0 ? S0.acc[r] : LK.x.acc[r - N0]));
    if (late()) yield 0.7;
    // the Complex Portal's complexes with two members or more in this network
    const cxm = new Map();
    S0.cx.forEach((c, n) => { for (const r of c.members) if (at.has(r)) (cxm.get(n) || cxm.set(n, []).get(n)).push(at.get(r)); });
    if (LK) for (const [j, ns] of LK.x.cx) if (at.has(N0 + j)) for (const n of ns) (cxm.get(n) || cxm.set(n, []).get(n)).push(at.get(N0 + j));
    const cx = [];
    for (const [n, m] of [...cxm].sort((x, y) => x[0] - y[0])) {
      if (m.length < 2) continue;
      const c = S0.cx[n], all = c.members.length + c.missing;
      cx.push({ ac: c.ac, name: c.name, members: [...new Set(m)].sort((x, y) => x - y), missing: Math.max(0, all - new Set(m).size) });
    }
    const S = S0.of(P, { cls, lay, ev, by, acc, cx });
    for (let p = 0; p < N; p++) if (pl[p]) report.placed++;
    for (let i = 0; i < E; i++) if (pl[la[i]] && pl[lb[i]]) report.judged++;
    report.complexes = cx.length;
    return { P, S, score: !!hasScore };
  }

  // ---------------------------------------------------------------- a network shared through the relay
  // (stage 3, SPEC.md) The shared form: what was read, mapped and joined, nothing else: { v: 1, name (the file's), prot:
  // [the proteins' symbols, the map's or the lookup's, in the network's order], kinds: [its kinds' words, at most 7],
  // a, b: [each link's two proteins, numbers into prot], k: [each link's kind bits, 1 to 127], s: [each link's score or
  // null] only when it has scores }. The relay keeps it as sent, checked (relay/nets.mjs), under an id made from it.
  const DOC_MAX_PROT = 65535, DOC_MAX_NAME = 120;
  const f32 = v => +Math.fround(v).toPrecision(9);   // (a Float32 written so it reads back the same)
  function toDoc(model, name) {
    const P = model.P, E = P.E, doc = { v: 1, name: String(name || 'a network').slice(0, DOC_MAX_NAME), prot: Array.from(P.sym), kinds: Array.from(P.kinds),
      a: Array.from(P.la), b: Array.from(P.lb), k: Array.from(P.kind) };
    if (model.score) { const s = new Array(E); for (let i = 0; i < E; i++) s[i] = Number.isFinite(P.sup[i]) ? f32(P.sup[i]) : null; doc.s = s; }
    return doc;
  }
  // a shared network's shape checked as the relay checks it: '' when it is one, else why not (in words)
  function docError(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d) || d.v !== 1) return 'not a shared network (v 1)';
    if (typeof d.name !== 'string' || !d.name || d.name.length > DOC_MAX_NAME) return 'name: 1 to 120 characters';
    if (!Array.isArray(d.prot) || !d.prot.length || d.prot.length > DOC_MAX_PROT || d.prot.some(x => typeof x !== 'string' || !x || x.length > 40)) return 'prot: 1 to 65,535 names';
    if (!Array.isArray(d.kinds) || !d.kinds.length || d.kinds.length > MAX_KINDS || d.kinds.some(x => typeof x !== 'string' || !x || x.length > 24)) return 'kinds: 1 to 7 words';
    const E = Array.isArray(d.a) ? d.a.length : -1, N = d.prot.length, KM = (1 << d.kinds.length) - 1;
    if (E < 1 || E > MAX_LINES || !Array.isArray(d.b) || d.b.length !== E || !Array.isArray(d.k) || d.k.length !== E) return `a, b, k: 1 to ${MAX_LINES} links each`;
    for (let i = 0; i < E; i++) {
      const a = d.a[i], b = d.b[i], k = d.k[i];
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= N || b >= N) return `link ${i}: a protein not in prot`;
      if (!Number.isInteger(k) || k < 1 || k > KM) return `link ${i}: kind bits`;
    }
    if (d.s !== undefined && (!Array.isArray(d.s) || d.s.length !== E || d.s.some(x => x !== null && (typeof x !== 'number' || !Number.isFinite(x))))) return 's: a score (or null) a link';
    return '';
  }
  // a shared network made into the cell's: its proteins found again by their symbols (the map's, then the lookup's:
  // LK null when it is not needed or could not be had; a name not found leaves its links out, counted; one given twice
  // is the map's protein of that name given twice, by its order), its links in
  // their order. A generator, as build: { model, report }
  function* fromDoc(d, LK) {
    // (a symbol the map gives twice, HBD and TEC: its n-th time in prot is the map's n-th protein of that name)
    const by = new Map(), put = (s, r) => (by.get(s) || by.set(s, []).get(s)).push(r), seenN = new Map();
    P0.sym.forEach((s, p) => put(s, p));
    if (LK) LK.x.sym.forEach((s, j) => put(s, P0.N + j));
    const ref = d.prot.map(s => { const n = seenN.get(s) || 0, l = by.get(s); seenN.set(s, n + 1); return l && n < l.length ? l[n] : -1; });
    const missing = d.prot.filter((s, i) => ref[i] < 0);
    const links = [], seen = new Set();
    let dropped = 0;
    for (let i = 0; i < d.a.length; i++) {
      const x = ref[d.a[i]], y = ref[d.b[i]];
      if (x < 0 || y < 0) { dropped++; continue; }
      const key = x < y ? x * 1048576 + y : y * 1048576 + x;
      if (seen.has(key)) { dropped++; continue; }
      seen.add(key);
      links.push({ a: Math.min(x, y), b: Math.max(x, y), k: d.k[i], s: d.s ? (d.s[i] === null ? NaN : d.s[i]) : NaN });
      if ((i & 16383) === 16383 && late()) yield 0.1 * i / d.a.length;
    }
    const kindNames = d.kinds.slice(), report = { name: d.name, shared: true, pairs: links.length, dropped, found: 0, inMap: 0, missing, placed: 0, judged: 0, lookup: !!LK,
      read: 0, comments: 0, header: 0, errors: [], idKinds: [], hasScore: !!d.s, hasKind: !(kindNames.length === 1 && kindNames[0] === 'listed'), kinds: kindNames };
    if (!links.length) return { model: null, report };
    const model = yield* build(links, kindNames, !!d.s, LK, report);
    return { model, report };
  }
  // whether a shared network names proteins outside the map (then the lookup is needed)
  const docNeedsLookup = d => { const m = new Set(P0.sym); return d.prot.some(s => !m.has(s)); };
  // the lookup's locations' first index per gene (its genes in order, each its places in order)
  function lookupIndex(LK) {
    const n = LK.x.sym.length, of = new Uint32Array(n + 1);
    for (let j = 0; j < n; j++) of[j + 1] = of[j] + pop(LK.x.pl[j] & 8191);
    LK.xOf = of;
    return LK;
  }
  return { T, late, run, REL, LIM0, isDefault, steps, limit, limitGen, communities, locs, pairJ, judge, order, share, shareKinds, KIND_MIN, select,
    MAX_LINES, MAX_BYTES, ID_NAME, idKind, parse, tables, find, decodeLookup: J => lookupIndex(decodeLookup(J)), fromRows, build, toDoc, docError, fromDoc, docNeedsLookup };
})();
if (typeof module !== 'undefined') module.exports = PNET;
