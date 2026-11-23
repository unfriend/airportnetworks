//#use head
// ================================================================== STORY ==
// The chapters, on story time (seconds): a key, the name on the timeline, and where each begins and ends.
const CH = [
  { key: 'map', name: 'No place', a: 0, b: 60 },
  { key: 'crowd', name: 'Crowds', a: 60, b: 115 },
  { key: 'walls', name: 'Walls', a: 115, b: 180 },
  { key: 'back', name: 'Into the cell', a: 180, b: 255 },
  { key: 'judge', name: 'Can they meet?', a: 255, b: 325 },
  { key: 'red', name: 'Why red?', a: 325, b: 440 },
  { key: 'moments', name: 'Moments', a: 440, b: 510 },
  { key: 'next', name: 'What next', a: 510, b: 575 },
];
// Narration timing: [time in the recording, story time] pairs; the story is stretched or squeezed between them so
// each cue lands on its sentence. Without a recording (the default: captions only) the story keeps its own clock.
// With one (audio/narration.mp3 in the package: e7_app.js, narrationFile) put the pairs here, and where each chapter's
// words end in it as NARRATION_ENDS = { title: 19.5, ... } (the slideshow lets the voice finish there).
const NARRATION_SYNC = [
  [0, 0], [3.3, 3], [17.69, 10],                      // No place
  [72.69, 60], [82.59, 69], [98.22, 81], [112.52, 94], [120.76, 101],  // Crowds
  [136.16, 115], [137.81, 116.5], [160.86, 129], [208.16, 172], [220.1, 179.3],  // Walls
  [220.87, 180], [222.52, 181.5], [239.58, 196],      // Into the cell
  [304.48, 255], [306.79, 257.1], [316.83, 258], [361.49, 298.6], [377.35, 305],  // Can they meet?
  [399.35, 325], [420.25, 344], [442.41, 356], [455.61, 368], [475.8, 380], [489.29, 391],
  [508.95, 401], [528.75, 419], [549.77, 430],        // Why red?
  [560.77, 440], [600.37, 476], [615.25, 485], [634.96, 494], [651.46, 502],  // Moments
  [660.26, 510], [662.57, 512.1], [672.33, 515], [719.63, 558], [734.81, 565], [752.21, 574.3],
  [752.98, 575],                                      // What next
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { map: 69.8, crowd: 125.45, walls: 219.9, back: 291.35, judge: 382.55, red: 556.6, moments: 658.05, next: 752 };
//#use storyT narrT T_END
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
// the engine's own params beside the sets' (DEF): none here; GRB2's turns at its domains run at an even pace (evalTrack)
const DEF_MORE = {}, LIN = new Set(['sites_cyc']), LOG = new Set();
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view fitShift
// each set's views nudged so they fit beside the side panel on a wide screen: { set: { view: [daz, del, ddist, dtx,
// dty, dtz] } } (added to the set's own view, in story and explore mode alike); none here
const FIT = {};
// how much further back a view stands on a phone held upright: { set: { view: factor } }
const NARROW = { cell: { default: 1.15 }, ball: { default: 1.5, ball: 1.15, cell: 1.15 }, walls: { default: 1.15 }, lens: { default: 1.45 }, next: { default: 1.15, high: 1.15 },
  sites: { default: 1.2, shuttle: 1.3 } };
//#use narrowOf anchorOf
//#use f2 word listOf
//#use inkCol swCol
const CYAN = '#46d9ff', AMBER = '#ffb43b', MAGENTA = '#ff5ad9', RED = '#ff5a4b', GREEN = '#3ee08f';
// ------------------------------------------------------------------ facts --
// Every number the story quotes, computed from PDATA (and the cell's own counting) as the page runs.
const pc1 = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0');
function storyFacts() {
  const P = PDATA, cell = GL.sets.cell.api(), N = P.N, E = P.E, KN = P.kinds;
  const pop = m => { let c = 0; for (; m; m &= m - 1) c++; return c; };
  let placed = 0, one = 0, two = 0, more = 0, degSum = 0;
  for (let p = 0; p < N; p++) { const c = pop(P.pl[p]); if (c) placed++; if (c === 1) one++; else if (c === 2) two++; else if (c > 2) more++; degSum += cell.deg(p); }
  // the judgement in both readings (a protein's spaces once each; PDATA.judge only where no space is shared), by kind
  const sp = [new Uint16Array(N), new Uint16Array(N)];
  for (let p = 0; p < N; p++) { sp[0][p] = P.spaces(P.pl[p], false); sp[1][p] = P.spaces(P.pl[p], true); }
  const T = [[0, 0, 0], [0, 0, 0]], kJ = new Array(7).fill(0), kR = new Array(7).fill(0);
  let notC = 0, unpl = 0;
  for (let i = 0; i < E; i++) {
    const a = P.la[i], b = P.lb[i];
    if (!P.contact(i)) { notC++; continue; }
    if (!P.pl[a] || !P.pl[b]) { unpl++; continue; }
    for (let g = 0; g < 2; g++) {
      const j = sp[g][a] & sp[g][b] ? 0 : P.judge(P.pl[a], P.pl[b], g === 1);
      T[g][j]++;
      if (!g) for (let k = 0; k < 7; k++) if (P.kind[i] >> k & 1) { kJ[k]++; if (j === 2) kR[k]++; }
    }
  }
  // (regulatory and metabolic evidence alone says nothing of contact: the few contact links that also carry it are left
  // out of the shares by kind)
  const byKind = KN.map((n, k) => ({ n, k, pct: pc1(kR[k], kJ[k]), v: kJ[k] ? kR[k] / kJ[k] : 0 })).filter(o => kJ[o.k] && o.n !== 'regulatory' && o.n !== 'metabolic').sort((x, y) => x.v - y.v);
  // the examples: their links, places, and how their partners' links are judged (strict)
  const ex = s => {
    const p = cell.find(s), t = [0, 0, 0], pl = [];
    for (let k = 0; k < 13; k++) if (P.pl[p] >> k & 1) pl.push(cell.places[k].toLowerCase());
    let nuc = 0, cyt = 0;
    for (let i = 0; i < E; i++) {
      if (P.la[i] !== p && P.lb[i] !== p) continue;
      const q = P.la[i] === p ? P.lb[i] : P.la[i];
      if (q === p || !P.contact(i) || !P.pl[q]) continue;
      t[P.judge(P.pl[p], P.pl[q], false)]++;
      if (P.pl[q] >> 1 & 1) nuc++;
      if (P.pl[q] & 1) cyt++;
    }
    // (its links found in papers, and its rank by links from binary screens: the publication bias)
    let lit = 0;
    for (let i = 0; i < E; i++) if ((P.la[i] === p || P.lb[i] === p) && P.kind[i] & LIT) lit++;
    return { p, sym: s, deg: cell.deg(p), places: pl, t, nuc, cyt, lit, binRank: 1 + binN.filter(n => n > binN[p]).length };
  };
  // links by protein: all, from binary screens, from papers alone (a link of a protein with itself counted once)
  const LIT = 1 << KN.indexOf('literature'), BIN = 1 << KN.indexOf('binary'), allN = new Uint32Array(N), binN = new Uint32Array(N), litOnly = new Uint32Array(N);
  for (let i = 0; i < E; i++) for (const q of P.la[i] === P.lb[i] ? [P.la[i]] : [P.la[i], P.lb[i]]) { allN[q]++; if (P.kind[i] & BIN) binN[q]++; if (P.kind[i] === LIT) litOnly[q]++; }
  const hubs = [...allN.keys()].sort((x, y) => allN[y] - allN[x] || x - y).slice(0, 100), sum = (ids, a) => ids.reduce((t, q) => t + a[q], 0);
  const litTop = (100 * sum(hubs, litOnly) / sum(hubs, allN)).toFixed(0), litAll = (100 * litOnly.reduce((t, x) => t + x, 0) / allN.reduce((t, x) => t + x, 0)).toFixed(0);
  const kindName = n => ({ signaling: 'signalling' }[n] || n);
  return { N, E, placed, unplaced: N - placed, L: P.L, one, two, more, mean: degSum / N, places: cell.places.length,
    s: T[0], g: T[1], judged: T[0][0] + T[0][1] + T[0][2], notC, unpl, byKind, kind: n => byKind.find(o => KN[o.k] === n), kindName,
    litTop, litAll, GRB2: ex('GRB2'), TP53: ex('TP53'), STAT3: ex('STAT3'), RELA: ex('RELA') };
}

// 1st, 2nd, 3rd, 48th
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

function buildStory() {
  const F = storyFacts(), cell = GL.sets.cell.api(), net = cell.net(2), drawn = net.ab.length / 2;
  const [s0, s1, s2] = F.s, g2 = F.g[2], J = F.judged, bin = F.kind('binary'), cx = F.kind('complexes'), lo = F.byKind[0], hi = F.byKind[F.byKind.length - 1];
  const { GRB2, TP53, STAT3, RELA } = F, quarter = Math.round(100 * F.unplaced / F.N);
  // what is drawn, in round numbers (about 2,000 links; the red ones raised so they show), and the crowd's molecules
  const about = fmt(Math.round(drawn / 100) * 100), redDrawn = Array.from(net.cls).filter(c => c === 2).length, crowdN = GL.sets.crowd.stats().n;
  // the Protein Data Bank's entries, credited in small print (the models' credits, models.json: 'PDB 1ABC (Someone et al., 2000)')
  const cite = k => molCredit(k), pdbId = k => cite(k).split(' ')[1] || '', crowdK = GL.sets.crowd.stats().kinds;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  // a param that picks something (a step: never eased) jumps from one value to the next at time t
  const jump = (n, t, v0, v1) => { key(n, t, v0); key(n, t, v1); };
  const step = (at, out, col, b, text, say) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''}${say ? ` data-say="${esc(say)}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // Each chapter's text: data-at is when a line appears (seconds into the chapter), data-out when it goes. The headset's
  // panel cannot scroll, so no chapter shows more than fits at once: parts that take turns in one place (turns), each
  // fading out as the next comes.
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  // The voice has its own words (data-say: tools/voice/narrate.mjs speaks them, the headset's subtitles show them): a
  // scientist talking to a general audience, a cell as a house (spaces as rooms, membranes as walls, gates as doors),
  // round numbers. The panel keeps the key points and the exact numbers (the owner, 23 November 2026).
  const sy = s => ` data-say="${esc(s.replace(/\s+/g, ' ').trim())}"`, mute = ' data-say=""';
  const near = (n, k) => fmt(Math.round(n / k) * k), in100 = (x, n) => Math.round(100 * x / n);
  const html = {
    map: `<h1 data-at="0.6"${mute}>${esc(XR_TITLE)}</h1>
      <p class="lede" data-at="1.6"${mute}>An interactome put back into a cell</p>
      ${turns(`<p data-at="3" data-out="20.5"${sy(`This is a map of which human proteins stick to which. Biologists call it an interactome. Every dot is a protein, about ${near(F.N, 500)} of them, and every line means: these two have been seen to bind.`)}>An interactome: a map of which proteins bind which. ${fmt(F.N)} human proteins, ${fmt(F.E)} links.</p>
        <p data-at="10" data-out="20.5"${sy(`There are more than ${fmt(Math.floor(F.E / 10000) * 10000)} lines, far too many to draw at once. So you just saw them sweep past, a couple of thousand at a time. What stays are the best supported ones.`)}>One dot per protein. About ${about} links drawn at a time.</p>
        <p data-at="4" data-out="20.5" class="credits">Menche and colleagues, 2015: ${word(PDATA.kinds.length)} kinds of evidence. Most suggest physical contact; ${fmt(F.notC)} links do not.</p>`,
      `<p data-at="21" data-out="40.5"${sy(`A few proteins have a huge number of partners. We call them hubs. This one, GRB2, has ${fmt(GRB2.deg)}. Most proteins have far fewer: about ${Math.round(F.mean)} on average.`)}>Hubs are proteins with many links. GRB2 has ${fmt(GRB2.deg)}; the average protein ${Math.round(F.mean)}.</p>`,
      `<p data-at="41"${sy(`It is a beautiful object. But notice what is missing. The map tells us who binds whom. It does not tell us where.`)}>The map says who binds whom, not where.</p>
        <p data-at="48" class="amber"${sy(`And in a real cell, two proteins can only bind if they actually meet. So let's put this map back into a cell, the empty one waiting beside it, and see what survives.`)}>In a real cell two proteins can bind only if they meet.</p>`)}`,
    crowd: `<h2 data-at="0.6"${mute}>Billions and thousands</h2>
      ${turns(`<p data-at="1.5" data-out="20.5"${sy(`But first: what does one dot stand for? Let's pick one spot in the cytosol, the watery inside of the cell, and zoom in.`)}>One spot of the cytosol, the watery inside of the cell.</p>
        <p data-at="9" data-out="20.5"${sy(`This cube is about a hundred nanometres across, a thousandth of the width of a hair. Even in this speck there are a few thousand protein molecules, packed shoulder to shoulder. Here ${fmt(crowdN)} are drawn, each simplified to a few balls.`)}>About 100 nanometres across: a few thousand protein molecules, filling a quarter to a third of the space.</p>`,
      `<p data-at="21" data-out="33.5"${sy(`A whole human cell holds billions of protein molecules, of about ten thousand different kinds. It is a very crowded place.`)}>A whole cell: 1 to 10 billion protein molecules, of about ten thousand kinds.</p>
        <p data-at="22" data-out="33.5" class="credits">Molecules: ubiquitin, calmodulin, actin, GAPDH and tubulin from the Protein Data Bank (${['ubq', 'cam', 'actin', 'gapdh', 'tub'].map(pdbId).join(', ')}), each simplified to a few balls (its residues grouped). Sizes to scale, packed about as densely as a real cytoplasm.</p>`,
      `<p data-at="34"${sy(`So a dot on our map is not one molecule. It is every copy of one kind of protein, in one place. Like the bright ones here.`)}>One dot: all the copies of one kind of protein in one place.</p>
        <p data-at="41" class="amber"${sy(`One dot per kind, per place. Keep that in mind. It will matter in a moment.`)}>${fmt(F.L)} dots for the ${fmt(F.placed)} proteins with a place.</p>
        <p data-at="37" class="credits">The bright ones: the ${fmt(crowdK.find(k => k[0] === 'cam')[1])} calmodulins drawn.</p>`)}`,
    walls: `<h2 data-at="0.6"${mute}>Spaces and walls</h2>
      ${turns(`<p data-at="1.5" data-out="26.5"${sy(`A cell is not a bag of soup. It is more like a house with rooms. The cytosol is one room. The inside of the nucleus is another. The endoplasmic reticulum and the Golgi, where proteins are made and shipped, have rooms of their own. Then come the mitochondria, the cell's power stations, and small organelles such as lysosomes. And the last room is the world outside.`)}>A cell is a house with rooms. Membranes are the walls; each space is a room.</p>
        <p data-at="14" data-out="26.5" class="amber"${sy(`Two proteins in different rooms cannot touch, however well they would fit. And every single mitochondrion is a room of its own.`)}>Two proteins can bind only where they share a space. Each mitochondrion, lysosome, endosome and peroxisome is its own.</p>`,
      `<p data-at="27" data-out="44.5"${sy(`Some proteins sit in a wall and reach into both rooms. This receptor crosses the cell's outer membrane. Outside, it catches a signal. Inside, it passes the message on to a partner.`)}>A protein in a membrane can reach into both sides: a receptor meets a signal outside and a partner inside.</p>
        <p data-at="29" data-out="44.5" class="credits">The receptor: the beta-2 adrenergic receptor, its chain as ribbons, ${cite('b2ar')}. Its seven helices cross the membrane.</p>`,
      `<p data-at="45"${sy(`And there are doors. Biologists call them gates. Nuclear pores let proteins in and out of the nucleus.`)}>Gates are the doors: nuclear pores, and import into the endoplasmic reticulum, the mitochondria and the peroxisomes.</p>
        <p data-at="57"${sy(`A mitochondrion pulls its proteins in through a narrow channel, unfolded, like thread through the eye of a needle. And small bubbles called vesicles carry cargo between the other rooms.`)}>Into a mitochondrion a protein goes unfolded. Vesicles carry others between the endoplasmic reticulum, the Golgi, endosomes, lysosomes and the outside.</p>
        <p data-at="58" class="caption"${mute}>Close-ups not to scale.</p>
        <p data-at="48" class="credits">Crossing the pore: TP53's core domain, PDB ${pdbId('tp53')}; threading into the mitochondrion: frataxin, ${cite('fxn')}, its chain drawn as beads; their surfaces. The pore and the import gates are simple shapes.</p>`)}`,
    back: `<h2 data-at="0.6"${mute}>Back into the cell</h2>
      ${turns(`<p data-at="1.5" data-out="15.5"${sy(`Now we need an address for every protein. For that we use the Human Protein Atlas, a large public project. Its teams stained human cells for one protein at a time, with an antibody that sticks to it, and photographed under a microscope where the cell lights up.`)}>Each protein goes where the Human Protein Atlas finds it: cells stained with an antibody for one protein at a time, and photographed. ${word(F.places)[0].toUpperCase() + word(F.places).slice(1)} places in this model cell.</p>`,
      `<p data-at="16" data-out="42.5"${sy(`Now watch every dot fly home. Many proteins live in more than one place. In our picture, such a protein splits into copies on the way, one dot for each address.`)}>In this picture a protein in several places splits into copies: ${fmt(F.one)} proteins have one place, ${fmt(F.two)} two and ${fmt(F.more)} three or more.</p>
        <p data-at="28" data-out="42.5"${sy(`Inside each room, proteins that are linked settle close together, so their lines stay short. And each mitochondrion keeps its links to itself.`)}>Linked proteins gather together. Each mitochondrion keeps its own links.</p>`,
      `<p data-at="43"${sy(`The lines now take on colours. We will come to what they mean in a moment.`)}>The links take the colour of their verdict.</p>
        <p data-at="55" class="amber"${sy(`But about ${quarter > 22 && quarter < 28 ? 'a quarter' : `${quarter} in a hundred`} of the proteins have no address at all. The Atlas has no reliable picture of them yet. They wait outside the cell, in grey.`)}>${fmt(F.unplaced)} proteins have no place in the Atlas yet. They wait outside the cell, grey.</p>`)}`,
    judge: `<h2 data-at="0.6"${mute}>Can they meet?</h2>
      ${turns(`<p data-at="1.5" data-out="42.5"${sy(`Now the test. For every link we ask: can these two proteins actually meet? We take the links where both partners have an address, about ${near(J, 1000)} of them.`)}>The ${fmt(J)} links that suggest contact, between proteins that both have a place, judged strictly:</p>
        <ul class="steps">${step(3, 42.5, CYAN, `${fmt(s0)} possible`, ` (${pc1(s0, J)} %): a shared space`, `${word(Math.round(10 * s0 / J))[0].toUpperCase() + word(Math.round(10 * s0 / J)).slice(1)} in ten pass. Both partners share a room, so nothing stands between them. These keep the colour of their room.`)}
          ${step(16, 42.5, AMBER, `${fmt(s1)} through a gate`, ` (${pc1(s1, J)} %): one known crossing apart`, `About ${in100(s1, J)} in a hundred are one door apart. Say, one partner is in the cytosol and the other in the nucleus, with the pores between them. Those we colour amber.`)}
          ${step(30, 42.5, RED, `${fmt(s2)} impossible`, ` (${pc1(s2, J)} %): no shared space, no known crossing`, `And about ${near(s2, 100)} links should be impossible. Their partners share no room, and no door connects them. Those are red.`)}</ul>`,
      `<p data-at="43"${sy(`Look at one protein, RELA. It is half of a famous alarm switch called N F kappa B. The Atlas photographed resting cells, and in a resting cell RELA sits in the cytosol. But raise the alarm, and it moves into the nucleus to switch genes on.`)}>RELA, half of NF-κB, is listed only in the cytosol: the Atlas photographs resting cells. Signalled, it moves into the nucleus.</p>
        <p data-at="50" class="amber"${sy(`So its ${fmt(RELA.t[1])} amber links are not mistakes. They are moments nobody photographed.`)}>${fmt(RELA.t[1])} of its links pass a gate: moments the Atlas did not photograph.</p>
        <p data-at="58" class="caption"${mute}>Counted apart: ${fmt(F.notC)} links that are not contacts and ${fmt(F.unpl)} with an end without a place. About ${about} links are drawn, and the red ones are raised to ${fmt(redDrawn)} so that they show in this picture.</p>`)}`,
    red: `<h2 data-at="0.6"${mute}>Why red?</h2>
      ${turns(`<p data-at="1.5" data-out="13.5"${sy(`So what about the red ones? As drawn, those partners could never meet.`)}>Red links: no shared space, and no gate between.</p>
        <p data-at="7" data-out="13.5" class="amber"${sy(`So either the link is wrong, or an address is. To see how that can happen, we have to look at how links are found in the first place. There are three main ways.`)}>Either the link is wrong, or a place is missing. Where do links come from?</p>`,
      `<ul class="steps">${step(19, 42.5, CYAN, 'Two-hybrid', ` Both proteins are made in one yeast cell, each with half of a switch. If they stick, the yeast shows it. It tells you a pair can stick, not whether they meet in our cells.`, `The first is called two-hybrid. You take two human proteins and make them both inside a yeast cell. Each carries half of a switch. If the two stick together, the halves meet, the switch turns on, and the yeast shows it. It is clever, and it can test thousands of pairs. But think about what it tells you: that two proteins can stick. Not that they ever meet in a human cell.`)}</ul>
        <p data-at="31" data-out="42.5" class="amber"${sy(`And indeed, of the links found this way, about ${Math.round(+bin.pct)} in a hundred are red.`)}>Binary links, mostly from such tests: ${bin.pct} % impossible.</p>
        <p data-at="21" data-out="42.5" class="credits">H-Ras and Raf: PDB ${pdbId('ras')}, their surfaces. Not to scale.</p>`,
      `<ul class="steps">${step(43, 65.5, AMBER, 'Purification', ' Cells are broken open, one protein is caught with a molecular hook, and what comes up with it is identified. In the tube, proteins from different spaces can meet.', `The second way works like fishing. You break cells open, catch one protein with a molecular hook, and see what comes up with it. A machine called a mass spectrometer identifies the catch. But notice: once the cell is broken, the walls are gone. Proteins from different rooms can meet in the tube, though they never would in life.`)}</ul>
        <p data-at="55" data-out="65.5" class="amber"${sy(`Even so, the best-behaved links in our map are the complexes. These are proteins known to work together as stable machines, checked by hand across many studies. ${+cx.pct < 1 ? 'Fewer than one in a hundred of their links is red.' : `Only about ${Math.round(+cx.pct)} in a hundred of their links are red.`}`)}>Complexes, stable machines gathered by hand from many studies: only ${cx.pct} % impossible.</p>`,
      `<ul class="steps">${step(66, 83.5, GREEN, 'Proximity labelling', ' In living cells: the bait carries an enzyme that tags every protein within about 10 nanometres. It tells you who was near, not who held on.', `The third way is the newest, and it works inside living cells. You pick a protein, the bait, and attach an enzyme to it that sprays a small tag onto everything within about ten nanometres. Then you collect whatever got tagged. That tells you who was nearby, in the right room. Not necessarily who was holding on.`)}</ul>
        <p data-at="76" data-out="83.5"${sy(`The big maps made this way came after the interactome we are looking at.`)}>Large maps made this way came after this interactome.</p>
        <p data-at="68" data-out="83.5" class="credits">The antibody: PDB ${pdbId('igg')}. BirA: PDB ${pdbId('bira')}. Their surfaces; the other proteins simplified. Not to scale.</p>`,
      `<p data-at="84" data-out="93.5"${sy(`So how often a link turns out red depends on how it was found. That is a pattern. It is not proof that the method is to blame.`)}>By kind of evidence: from ${lo.pct} % impossible (${F.kindName(lo.n)}) to ${hi.pct} % (${F.kindName(hi.n)}). A pattern, not proof.</p>
        <p data-at="85" data-out="93.5" class="credits">Of the ${word(F.byKind.length)} kinds of evidence that suggest contact; a link found in several ways counts under each.</p>`,
      `<p data-at="94" data-out="104.5"${sy(`Part of the problem is the Atlas itself. It tells us that a protein belongs to an organelle, but not on which side of the wall it sits. If we assume every such protein is inside, we get our ${near(s2, 100)} red links. If we allow it to face outwards as well, ${g2 ? `only ${fmt(g2)} are left` : 'every one of them becomes possible'}. The truth lies somewhere in between.`)}>Which side of the membrane? The Atlas does not say. Inside only: ${fmt(s2)} impossible. Either side: ${g2 ? fmt(g2) : 'none'}.</p>`,
      `<p data-at="105" class="amber"${sy(`And remember the proteins waiting outside. Their links, about ${near(F.unpl, 1000)} of them, we cannot judge at all.`)}>${fmt(F.unplaced)} proteins have no place: their ${fmt(F.unpl)} links cannot be judged.</p>`)}`,
    moments: `<h2 data-at="0.6"${mute}>Not all at once</h2>
      ${turns(`<p data-at="1.5" data-out="35.5"${sy(`Now suppose a link is right, and both partners share a room. Even then, it is not a wire. Take GRB2 again. It has ${fmt(GRB2.deg)} partners, but only three hands: three small domains, each of which holds one partner at a time.`)}>GRB2: ${fmt(GRB2.deg)} links, but three binding domains, an SH2 and two SH3s.</p>
        <p data-at="18" data-out="35.5" class="amber"${sy(`So its partners have to take turns. A link in the map is a moment in time, not a permanent connection.`)}>Partners take turns. A link is a moment in time, not a permanent wire.</p>
        <p data-at="3" data-out="35.5" class="credits">GRB2: PDB 1GRI (Maignan et al., 1995), its surface. Partners: parts of them as surfaces (PDB 1M17, 3PP0, 1R0P, 1T46, 1MIL, 2II0, 2CBL, 2X2E), smaller than to scale, each with its docking stretch as a chain of amino acids.</p>`,
      `<p data-at="36" data-out="44.5"${sy(`Or take TP53, the cell's best-known guardian against cancer. It has ${fmt(TP53.deg)} links, and it travels to and fro through the nuclear pores. Some of its partners wait in the nucleus, others in the cytosol.`)}>TP53: ${fmt(TP53.deg)} links. It goes to and fro through the nuclear pores: ${fmt(TP53.nuc)} partners are listed in the nucleoplasm, ${fmt(TP53.cyt)} in the cytosol (some in both).</p>
        <p data-at="37" data-out="44.5" class="credits">TP53's core domain: PDB 1TSR (Cho et al., 1994), its surface. Not to scale against the pores.</p>`,
      `<p data-at="45" data-out="53.5" class="amber"${sy(`But be a little careful with that number. TP53 is one of the most studied proteins there is, and ${fmt(TP53.lit)} of its links come from individual papers. The more people look at a protein, the more partners they find. In systematic screens, which test every pair alike, it only ranks ${ordinal(TP53.binRank)}.`)}>Part of that is fame: ${fmt(TP53.lit)} of its links in this interactome come from papers. In systematic two-hybrid screens it ranks ${ordinal(TP53.binRank)}.</p>`,
      `<p data-at="54"${sy(`One last traveller: STAT3. It waits in the cytosol until a signal arrives at a receptor, where an enzyme called JAK2 switches it on. Two copies pair up, pass through a pore, and in the nucleus they bind D N A and new partners.`)}>STAT3 waits in the cytosol until JAK2 switches it on at a receptor; it pairs up, passes a pore and binds DNA and partners such as EP300.</p>
        <p data-at="62" class="amber"${sy(`Its ${fmt(STAT3.deg)} links happen in different places, at different times. Our map shows them all at once.`)}>Its ${fmt(STAT3.deg)} links are in ${word(STAT3.places.length)} places; when each happens is not in this map.</p>
        <p data-at="56" class="credits">STAT3: PDB 1BG1 (Becker et al., 1998); JAK2: ${pdbId('jak2')}; p300: ${pdbId('p300')}; their surfaces. Not to scale.</p>`)}`,
    next: `<h2 data-at="0.6"${mute}>What it would take</h2>
      ${turns(`<p data-at="1.5" data-out="47.5"${sy(`So what would it take to draw a map that is true to a real cell? We would need to know where, and when, each pair really meets. Three kinds of experiment are getting us there.`)}>A map true to a real cell needs where and when each pair meets.</p>
        <ul class="steps">${step(5, 47.5, GREEN, 'Proximity maps', ' hundreds to thousands of baits show who is near whom, place by place', `Proximity maps repeat the tagging trick with hundreds, even thousands of baits. They chart who is near whom, room by room.`)}
          ${step(22, 47.5, CYAN, 'Cryo-electron tomography', ' cuts frozen cells thin and shows single molecules where they are', `Cryo-electron tomography freezes a cell in an instant, cuts it into thin slices, and shows single molecules exactly where they were.`)}
          ${step(37, 47.5, MAGENTA, 'Whole-cell volumes', ' map every organelle of a whole cell in 3D', `And whole-cell imaging maps every organelle of an entire cell in three dimensions.`)}</ul>`,
      `<p data-at="48" data-out="54.5"${sy(`It would also take fairer maps. Famous proteins collect links, and unstudied ones look lonely. Among the hundred biggest hubs, ${F.litTop} in a hundred links come from papers alone. A map of binding is also a map of our attention.`)}>And fairer maps: among the 100 biggest hubs, ${F.litTop} % of links come from papers alone, against ${F.litAll} % across the map.</p>`,
      `<p data-at="55"${sy(`Until then, this is the honest picture. Dense networks inside each room. Thin traffic through the doors. And a red remainder that nobody can explain yet. Which of those links are mistakes, and which are biology we have not understood? That is still open. Have a look around.`)}>Until then, the honest cell: dense networks inside each space, thin traffic through the gates, and a red remainder still to explain.</p>
        <p data-at="59"><button class="btn primary" id="btnGoExplore" type="button">Explore the cell</button></p>
        <p class="credits" data-at="60">The interactome of J. Menche and colleagues, Science 347, 1257601 (2015); the places from the Human Protein Atlas (proteinatlas.org). The judgement is this story's own.</p>`)}`,
  };

  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });

  // ------------------------------------------------------------ timeline keys
  const wp = [];
  // a camera waypoint at time t: a set's named view, turned by spin degrees, optionally nudged
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  const lbl = [];   // story labels, placed once the camera is built: [set, at, html, tIn, tOut, cls]
  const L = (...a) => lbl.push(a);
  start({ cell_shell: 1, cell_net: 0, cell_amb: 1, cell_red: 1, cell_show: 2, cell_faces: 0, cell_kind: -1, cell_pp: -1, cell_pc: -1,
    ball_move: 0, ball_morph: 0, ball_tint: 0, ball_in: 1, ball_out: 1, ball_hi: -1, ball_hl: 0, ball_sweep: 0, cell_ties: 1, crowd_open: 0, crowd_mark: 0, walls_lit: 0, walls_wall: 0, walls_parts: 0,
    lens_open: 0, lens_focus: 0, sites_act: 0, sites_cyc: 0, sites_tp: 0, sites_move: 0, next_halo: 0, next_slab: 0, next_vol: 0 });
  let a, b;
  // 1. A map without a place: the hairball turns beside the empty cell
  a = C.map.a; b = C.map.b;
  show('ball', 0.2, 2);
  show('cell', 1, 4);
  cam(a, 'ball', 'ball', -25);
  cam(a + 18, 'ball', 'ball', 5);
  cam(a + 40, 'ball', 'default', 0);
  cam(b, 'ball', 'default', 14, 'spin');
  L('ball', 'top', `<b>${fmt(F.N)} proteins</b> · about ${about} links drawn`, a + 6, a + 20, 'cyn');
  L('ball', 'hub', `<b>GRB2</b> · ${fmt(GRB2.deg)} links`, a + 22, a + 39, 'amb');
  // (as the text names GRB2: its links stand out in the hairball, the rest dims; the owner, 22 November 2026)
  // (as the text gives the map's number of links, every one of them lights once, 2,000 at a time, from the hubs out)
  ramp('ball_sweep', a + 4, a + 9.5, 0, 1);
  // (ball_hl's first third lights GRB2's dot, the rest its links)
  jump('ball_hi', a + 21, -1, GRB2.p); ramp('ball_hl', a + 21, a + 25, 0, 1);
  ramp('ball_hl', a + 38.5, a + 40.5, 1, 0); jump('ball_hi', a + 41, GRB2.p, -1);
  L('cell', 'nucleus', '<b>An empty cell</b> · no proteins yet', a + 42, b - 1, '');
  sfxCue(a + 0.5, 'grow', 'ball', 'ball', { dur: 3, gain: 0.35 });
  // 2. Billions and thousands: one dot opens into its crowd
  a = C.crowd.a; b = C.crowd.b;
  ramp('ball_a', a, a + 3, 1, 0);
  show('crowd', a + 1, a + 3, b - 3, b - 0.5);
  ramp('crowd_open', a + 5, a + 13, 0, 1);
  ramp('crowd_mark', a + 33, a + 37, 0, 1);
  ramp('crowd_open', b - 9, b - 3, 1, 0);
  ramp('cell_shell', a + 6, a + 12, 1, 0.45); ramp('cell_shell', b - 8, b - 2, 0.45, 1);
  cam(a + 3, 'cell', 'default', 10);
  cam(a + 12, 'crowd', 'default', -10);
  cam(a + 33, 'crowd', 'close', 0);
  cam(b - 9, 'crowd', 'default', 25, 'spin');
  cam(b, 'cell', 'default', 30);
  L('crowd', 'dot', '<b>One dot</b> · in the cytosol', a + 2, a + 6, 'cyn');
  L('crowd', 'cube', `<b>About 100 nm</b> · ${fmt(crowdN)} molecules, simplified`, a + 14, a + 33, '');
  L('crowd', 'mark', '<b>One kind, one place</b> · one dot', a + 37, b - 9, 'cyn');
  sfxCue(a + 5, 'whoosh', 'crowd', 'dot', { dur: 2, pitch: 0.9 });
  sfxCue(a + 9, 'patter', 'crowd', 'cube', { dur: 4, gain: 0.3 });
  sfxCue(a + 33, 'ping', 'crowd', 'mark', { gain: 0.4 });
  // 3. Spaces and walls: the spaces light one by one, the walls glow, then a receptor, a pore and an import site
  a = C.walls.a; b = C.walls.b;
  show('walls', a, a + 2, b - 2, b);
  // (six spaces, one every 3.2 s: the cytosol, the nucleoplasm, the ER's and the Golgi's lumens, the mitochondria, the
  // small organelles, outside)
  const SPACES = ['cytosol', 'nucleus', 'lumen', 'mito', 'small', 'outside'], litAt = i => a + 4 + 3.2 * i;
  ramp('walls_lit', a + 2, litAt(0), 0, 1);
  for (let i = 1; i < SPACES.length; i++) ramp('walls_lit', litAt(i) - 1.4, litAt(i), i, i + 1);
  ramp('walls_lit', a + 23, a + 26, SPACES.length, 0);
  ramp('walls_wall', a + 14, a + 18, 0, 1);
  ramp('walls_parts', a + 26, a + 29, 0, 1);
  ramp('walls_wall', b - 5, b - 2, 1, 0);
  ramp('cell_shell', a + 27, a + 30, 1, 0.35); ramp('cell_shell', b - 3, b, 0.35, 1);   // (the close-ups clear of the organelles' skins)
  cam(a + 1, 'walls', 'default', 30);
  cam(a + 24, 'walls', 'default', 55, 'spin');
  cam(a + 31, 'walls', 'receptor', 0);
  cam(a + 43, 'walls', 'receptor', 25, 'spin');
  cam(a + 48, 'walls', 'pore', 0);
  cam(a + 54, 'walls', 'pore', 20, 'spin');
  cam(a + 58, 'walls', 'import', 0);
  cam(a + 62, 'walls', 'import', 12, 'spin');   // (held while the protein threads in)
  cam(b, 'walls', 'default', 60);
  SPACES.forEach((k, i) => L('walls', k, `<b>${['The cytosol', 'The nucleoplasm', 'The endoplasmic reticulum and Golgi lumens', 'Mitochondria', 'Lysosomes, endosomes, peroxisomes', 'Outside'][i]}</b>${i === 3 || i === 4 ? ' · each its own space' : ''}`, litAt(i) - 1, litAt(i) + 2.2, 'cyn'));
  L('walls', 'recOut', '<b>Outside</b> · meets a signal', a + 32, a + 44, 'amb');
  L('walls', 'recIn', '<b>Inside</b> · meets a partner', a + 34, a + 44, 'grn');
  L('walls', 'pore', '<b>A nuclear pore</b> · a gate', a + 49, a + 56, 'amb');
  L('walls', 'import', '<b>An import site</b> · into a mitochondrion', a + 59, b - 1, 'amb');
  SPACES.forEach((k, i) => sfxCue(litAt(i) - 1, 'ping', 'walls', k, { gain: 0.3, pitch: Math.pow(2, i / 12) }));
  sfxCue(a + 31, 'whoosh', 'walls', 'receptor', { dur: 2 });
  sfxCue(a + 48, 'whoosh', 'walls', 'pore', { dur: 2 });
  // 4. Back into the cell: the hairball moves over the cell, every dot flies to its place, the cell's own take over
  a = C.back.a; b = C.back.b;
  show('ball', a + 1, a + 3);
  ramp('ball_move', a + 5, a + 13, 0, 1);
  ramp('ball_morph', a + 15, a + 43, 0, 1);
  ramp('ball_tint', a + 43, a + 49, 0, 1);
  ramp('cell_net', a + 51, a + 57, 0, 1);
  ramp('ball_in', a + 52, a + 58, 1, 0);
  cam(a + 2, 'ball', 'default', 0);
  cam(a + 13, 'ball', 'cell', -10);
  cam(a + 43, 'ball', 'cell', 50, 'spin');
  cam(a + 58, 'cell', 'default', 30, null, [0, 6, 1.4]);   // (standing back: the proteins without a place round the cell)
  cam(b - 1, 'cell', 'default', 70);
  L('ball', 'outside', `<b>${fmt(F.unplaced)} proteins</b> · no place in the Atlas`, a + 55, b - 1, '');
  L('cell', CELL_MITO(), '<b>A mitochondrion</b> · its own links', a + 30, a + 42, 'mag');
  sfxCue(a + 5, 'whoosh', 'ball', 'ball', { dur: 4, pitch: 0.8 });
  sfxCue(a + 15, 'rush', 'ball', 'ball', { dur: 6, gain: 0.35 });
  sfxCue(a + 43, 'spark', 'cell', 'centre', { gain: 0.4 });
  // 5. Can they meet? The verdicts in turn, then RELA's links through the pores
  a = C.judge.a; b = C.judge.b;
  ramp('ball_out', a + 1, a + 5, 1, 0);
  ramp('ball_a', a + 5, a + 6, 1, 0);
  // (the cell drew all three since the morph: the amber and the red ones fade out, then come back one kind at a time)
  ramp('cell_amb', a + 1, a + 3, 1, 0); ramp('cell_red', a + 1, a + 3, 1, 0);
  ramp('cell_amb', a + 16, a + 18, 0, 1);
  ramp('cell_red', a + 30, a + 32, 0, 1);
  // (red is on show only while the story talks about it: the owner, 23 November 2026; out again for RELA's amber links,
  // in for 'Why red?', out under the lenses, in for the shares by kind and the two readings, out with the proteins
  // without a place, in again for the last picture's red remainder)
  ramp('cell_red', a + 42, a + 44, 1, 0);
  const rela = RELA.p, relaAt = dotOf(net, rela);
  jump('cell_pp', a + 43, -1, rela);
  jump('cell_pp', b - 1, rela, -1);
  cam(a + 2, 'cell', 'default', 70);
  cam(a + 42, 'cell', 'default', 130, 'spin');
  cam(a + 47, 'cell', 'default', 150, null, [0, 4, -1.0, CELL_NUC()[0], CELL_NUC()[1], CELL_NUC()[2]]);
  cam(b, 'cell', 'default', 185, 'spin', [0, 4, -1.0, CELL_NUC()[0], CELL_NUC()[1], CELL_NUC()[2]]);
  L('cell', 'edge', `<b>Possible</b> · ${fmt(s0)}, read strictly`, a + 4, a + 16, 'cyn');
  L('cell', 'nucleus', `<b>Through a gate</b> · ${fmt(s1)}, read strictly`, a + 17, a + 30, 'amb');
  L('cell', [0.1, -0.6, 0.45], `<b>Impossible</b> · ${fmt(s2)}, read strictly`, a + 31, a + 42, 'mag');
  if (relaAt) L('cell', relaAt, `<b>RELA</b> · cytosol only, ${fmt(RELA.t[1])} links through a gate`, a + 45, b - 1, 'amb');
  sfxCue(a + 3, 'link', 'cell', 'edge', { gain: 0.35 });
  sfxCue(a + 16, 'link', 'cell', 'nucleus', { gain: 0.35, pitch: 0.9 });
  sfxCue(a + 30, 'knock', 'cell', 'centre', { gain: 0.35 });
  sfxCue(a + 43, 'clink', 'cell', 'centre', { gain: 0.4 });
  // 6. Why red? What red means, on the cell (the others dimmed); the lenses one by one, each explained; the shares; the
  // faces, strict then generous; the proteins without a place
  a = C.red.a; b = C.red.b;
  ramp('cell_amb', a + 1, a + 3, 1, 0.15); ramp('cell_amb', a + 12, a + 14, 0.15, 1);
  ramp('cell_red', a + 0.5, a + 2.5, 0, 1); ramp('cell_red', a + 13, a + 15, 1, 0); ramp('cell_red', a + 84, a + 86, 0, 1);
  show('lens', a + 13, a + 15, a + 84, a + 86);
  ramp('lens_open', a + 14, a + 19, 0, 1);
  ramp('lens_focus', a + 19, a + 21, 0, 1); ramp('lens_focus', a + 43, a + 45, 1, 2); ramp('lens_focus', a + 66, a + 68, 2, 3);
  jump('cell_faces', a + 97, 0, 1);
  jump('cell_faces', a + 104, 1, 0);
  jump('cell_show', a + 104, 2, 3);
  jump('cell_show', C.moments.a + 2.5, 3, 2);   // (as the cell fades out, nearly unseen: a hidden set is not updated, so later it would build as it comes back)
  cam(a + 1, 'cell', 'default', 190, null, [0, 4, -1.0, CELL_NUC()[0], CELL_NUC()[1], CELL_NUC()[2]]);
  cam(a + 12, 'cell', 'default', 215, 'spin', [0, 4, -1.0, CELL_NUC()[0], CELL_NUC()[1], CELL_NUC()[2]]);
  cam(a + 14, 'lens', 'default', 0);
  cam(a + 21, 'lens', 'yeast', 0);
  cam(a + 42, 'lens', 'yeast', 8, 'spin');
  cam(a + 45, 'lens', 'apms', 0);
  cam(a + 65, 'lens', 'apms', 8, 'spin');
  cam(a + 68, 'lens', 'prox', 0);
  cam(a + 83, 'lens', 'prox', 6, 'spin');
  cam(a + 86, 'cell', 'default', 20);
  cam(a + 104, 'cell', 'default', 60, 'spin');
  cam(b, 'cell', 'default', 85, 'spin', [0, 4, 1.4]);
  L('cell', [0.1, -0.6, 0.45], `<b>Impossible</b> · ${fmt(s2)}, read strictly`, a + 2, a + 13, 'mag');
  L('lens', 'yeastTag', `<b>Binary</b> · ${bin.pct} % impossible, of those with both places known`, a + 31, a + 44, 'cyn');
  L('lens', 'apmsTag', `<b>Complexes</b> · stable machines, gathered by hand · ${cx.pct} % impossible`, a + 55, a + 67, 'amb');
  L('lens', 'proxTag', '<b>Proximity</b> · large maps came after this one', a + 76, a + 86, 'grn');
  L('cell', [0.1, -0.6, 0.45], `<b>Strict: inside only</b> · ${fmt(s2)} impossible`, a + 94, a + 97, 'mag');
  L('cell', [0.1, -0.6, 0.45], `<b>Generous: either side</b> · ${fmt(g2)} impossible, too generous to rule any out`, a + 98, a + 104, 'cyn');
  L('cell', [-0.3, -1.25, 0.3], `<b>${fmt(F.unplaced)} without a place</b> · ${fmt(F.unpl)} links unjudged`, a + 105, b - 1, '');
  sfxCue(a + 2, 'knock', 'cell', 'centre', { gain: 0.3 });
  [19, 43, 66].forEach(d => sfxCue(a + d, 'pick', 'lens', d === 19 ? 'yeast' : d === 43 ? 'apms' : 'prox', { gain: 0.35 }));
  sfxCue(a + 97, 'snap', 'cell', 'centre', { gain: 0.35 });
  // 7. Not all at once: GRB2's domains and partners in turn; TP53 to and fro; STAT3 through a pore
  a = C.moments.a; b = C.moments.b;
  ramp('cell_a', a, a + 3, 1, 0); ramp('cell_red', a, a + 2.5, 1, 0);
  show('sites', a + 1, a + 4, b - 2, b);
  ramp('sites_cyc', a + 6, a + 35, 0, 7);
  ramp('sites_act', a + 35, a + 39, 0, 1);
  ramp('sites_tp', a + 39, a + 41, 0, 1); ramp('sites_tp', a + 52, a + 54, 1, 0);
  ramp('sites_move', a + 54, a + 68, 0, 1);
  cam(a + 2, 'sites', 'default', -20);
  cam(a + 12, 'sites', 'close', 0);
  cam(a + 34, 'sites', 'close', 25, 'spin');
  cam(a + 39, 'sites', 'shuttle', 0);
  cam(b, 'sites', 'shuttle', 25, 'spin');
  L('sites', 'grb2', `<b>GRB2</b> · ${fmt(GRB2.deg)} links`, a + 4, a + 12, 'amb');
  L('sites', 'shell', `<b>${fmt(GRB2.deg)} partners</b> · not all at once`, a + 20, a + 34, '');
  L('sites', 'tp53', `<b>TP53</b> · ${fmt(TP53.deg)} links`, a + 41, a + 53, 'mag');
  L('sites', 'cytosol', '<b>Cytosol</b>', a + 40, b - 1, '');
  L('sites', 'nucleus', '<b>Nucleus</b>', a + 40, b - 1, '');
  L('sites', 'stat3', `<b>STAT3</b> · ${fmt(STAT3.deg)} links`, a + 55, b - 1, 'cyn');
  L('sites', 'jak2', '<b>JAK2</b> · at a receptor', a + 55, a + 60, 'amb');
  L('sites', 'ep300', '<b>EP300</b> · in the nucleus', a + 64, b - 1, 'grn');
  sfxCue(a + 6, 'click', 'sites', 'grb2', { gain: 0.3 });
  sfxCue(a + 54, 'whoosh', 'sites', 'pore', { dur: 2, pitch: 1.1 });
  // 8. What it would take: proximity maps, a tomogram's slab, a whole-cell volume; then the honest cell
  a = C.next.a; b = C.next.b;
  ramp('cell_a', a, a + 3, 0, 1);
  show('next', a + 2, a + 4, a + 50, a + 52);
  ramp('cell_net', a + 2, a + 5, 1, 0.25); ramp('cell_net', a + 49, a + 53, 0.25, 1);   // (the cell's links dimmed under the methods)
  ramp('cell_red', a + 52, a + 54, 0, 1);   // (the red remainder, back for the last picture)
  ramp('next_halo', a + 5, a + 11, 0, 1); ramp('next_halo', a + 20, a + 22, 1, 0);
  ramp('next_slab', a + 22, a + 28, 0, 1); ramp('next_slab', a + 35, a + 37, 1, 0);
  ramp('next_vol', a + 37, a + 43, 0, 1); ramp('next_vol', a + 49, a + 51, 1, 0);
  cam(a + 2, 'cell', 'default', 0);
  cam(a + 20, 'next', 'default', 30, 'spin');
  cam(a + 26, 'next', 'slab', 0);
  cam(a + 35, 'next', 'slab', 18, 'spin');
  cam(a + 41, 'next', 'high', 0);
  cam(a + 51, 'next', 'high', 20, 'spin');
  cam(b, 'cell', 'default', 50, 'spin');
  L('next', 'halo', '<b>Proximity maps</b> · near a bait', a + 7, a + 21, 'grn');
  L('next', 'slab', '<b>A tomogram</b> · molecules in place', a + 25, a + 36, 'cyn');
  L('next', 'vol', '<b>A whole-cell volume</b>', a + 40, a + 50, 'mag');
  L('cell', 'edge', '<b>Dense inside each space</b>', a + 52, b - 0.5, 'cyn');
  L('cell', 'nucleus', '<b>Thin traffic through gates</b>', a + 53, b - 0.5, 'amb');
  L('cell', [0.1, -0.6, 0.45], `<b>A red remainder</b> · ${fmt(s2)} links`, a + 54, b - 0.5, 'mag');
  sfxCue(a + 5, 'bubble', 'next', 'halo', { gain: 0.3 });
  sfxCue(a + 22, 'whoosh', 'next', 'slab', { dur: 2 });
  sfxCue(a + 37, 'grow', 'next', 'vol', { dur: 3, gain: 0.3 });
  sfxCue(a + 52, 'rise', 'cell', 'centre', { dur: 2.5, gain: 0.4 });
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  for (const l of lbl) label(...l);
}
// a protein's first dot in the cell's background (its position, in the cell's frame), or null
function dotOf(net, p) { for (let i = 0; i < net.n; i++) if (net.prot[i] === p) return Array.from(net.pos.subarray(3 * i, 3 * i + 3)); return null; }
// the cell's nucleus and first mitochondrion (for views and labels)
const CELL_NUC = () => GL.sets.cell.api().CELL.nuc.c, CELL_MITO = () => GL.sets.cell.api().CELL.mitos[0].c;
// no set turns into another at a hand-over (buildCamera's MORPH): the ball, the crowd, the walls, the lenses and what
// comes next share the cell's frame (FRAME)
const MORPH = {};
//#use buildCamera setYaw smoothSeg spinEase storyCam LBL labelEl label sfxSpan buildSetLabels labelText
//#use setLabelAlpha~2 _v labelPos _placed placeLabels curCh updateStoryDOM trackHTML buildTimeline ICON_PLAY ICON_PAUSE
//#use lastTick updateTimeline
