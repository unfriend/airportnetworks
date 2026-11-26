//#use head
// ================================================================== STORY ==
// The chapters, on story time (seconds): a key, the name on the timeline, and where each begins and ends (SPEC.md,
// "Chapters"). The words are src/SCRIPT.md's; every number in them is looked up in the data (XDATA) as the page runs.
const CH = [
  { key: 'cloud', name: 'Substances', a: 0, b: 50 },
  { key: 'reach', name: 'One reaches in', a: 50, b: 115 },
  { key: 'threads', name: 'Threads', a: 115, b: 170 },
  { key: 'sort', name: 'What they do', a: 170, b: 250 },
  { key: 'centre', name: 'Where it hits', a: 250, b: 335 },
  { key: 'disease', name: 'Diseases', a: 335, b: 400 },
  { key: 'europe', name: 'Europe', a: 400, b: 485 },
  { key: 'end', name: 'A map', a: 485, b: 530 },
];
// Narration timing: [time on the clock, story time] pairs; the story is stretched or squeezed between them so each cue
// lands on its sentence. Written with NARRATION_ENDS by node tools/voice/narrate.mjs exposome from the synthetic
// recording it makes (packages/exposome/audio/narration.mp3); run it again after the words change.
const NARRATION_SYNC = [
  [0, 0], [3.3, 3], [13.55, 12], [24.55, 22], [35.23, 31],  // Substances
  [56.13, 50], [57.78, 51.5], [69.54, 61], [78.34, 69], [86.27, 76], [97.37, 86], [122.67, 109],
  [128.79, 114.3],                                    // One reaches in
  [129.56, 115],                                      // Threads
  [190.06, 170], [223.06, 200], [236.43, 212],        // What they do
  [278.23, 250],                                      // Where it hits
  [371.73, 335], [373.38, 336.5], [381.64, 344], [390.44, 352], [400.48, 361],  // Diseases
  [443.38, 400], [463.18, 418], [472.6, 426], [482.7, 435], [498.1, 449], [508.8, 458],  // Europe
  [538.5, 485], [588, 530],                           // A map
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { cloud: 52.9, reach: 128.55, threads: 184.85, sort: 273.25, centre: 368, disease: 436.85, europe: 533.8, end: 578.85 };
//#use storyT narrT T_END
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
// the engine's own params beside the sets' (DEF): none here; none keyed at an even pace or on a log scale (evalTrack)
const DEF_MORE = {}, LIN = new Set(), LOG = new Set();
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view fitShift
// each set's views nudged so they fit beside the side panel on a wide screen: { set: { view: [daz, del, ddist, dtx,
// dty, dtz] } } (added to the set's own view, in story and explore mode alike)
const FIT = {};
// how much further back a view stands on a phone held upright: { set: { view: factor } }
const NARROW = { cloud: { default: 1.15 }, cell: { default: 1.15 }, ppi: { default: 1.15 }, globe: { default: 1.15 } };
//#use narrowOf anchorOf
//#use f2 word listOf
//#use inkCol swCol
const CYAN = '#46d9ff', AMBER = '#ffb43b', MAGENTA = '#ff5ad9', GREEN = '#5be39b', RED = '#ff6b5a';

// ------------------------------------------------------------ numbers in words (the voice rounds; the panel is exact)
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
// a whole number under a thousand in words ('twenty-five', 'seven hundred')
const w999 = n => (n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '') : ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + w999(n % 100) : ''));
// a number rounded as a speaker would and said in words: 1,701 'seventeen hundred', 16,470 'sixteen thousand', 736,470
// 'seven hundred thousand', 1,601,884 'one and a half million', 60,855,804 'sixty million', 9,887 'ten thousand'
function spoken(n) {
  if (n >= 1e6) {
    const m = n / 1e6, h = Math.round(m * 2) / 2;
    if (m >= 10) return w999(Math.round(m / (m >= 20 ? 10 : 1)) * (m >= 20 ? 10 : 1)) + ' million';
    return (Math.floor(h) ? w999(Math.floor(h)) : '') + (h % 1 ? (Math.floor(h) ? ' and a half' : 'half a') : '') + ' million';
  }
  if (n >= 1e5) return w999(Math.round(n / 1e5) * 100) + ' thousand';
  if (n >= 9500) return w999(Math.round(n / 1000)) + ' thousand';
  if (n >= 1000) { const h = Math.round(n / 100); return h % 10 === 0 ? w999(h / 10) + ' thousand' : w999(h) + ' hundred'; }
  return w999(Math.round(n));
}
// a share in words where it is close to a simple one, else so many in a hundred
const shareWords = x => ([[1 / 3, 'a third'], [0.5, 'half'], [2 / 3, 'two thirds'], [0.25, 'a quarter'], [0.75, 'three quarters'], [0.4, 'four in ten'], [0.3, 'three in ten']]
  .find(([v]) => Math.abs(x - v) < 0.035) || [0, `${Math.round(100 * x)} in a hundred`])[1];
const pc = (a, b) => Math.round(100 * a / b);

// the three top-level groups named as their labels come up in chapter sort (the authors' ids; builder B's scene labels
// the same three at that moment)
const SORT_EXAMPLES = ['3', '9', '16'];
// ------------------------------------------------------------ the story's facts, all from the data
function storyFacts() {
  const M = XDATA.meta, E = XDATA.ex, cl = M.classes, pat = M.pattern, cty = M.countries;
  const fam = nm => cl.count[cl.names.indexOf(nm)];
  const it = XDATA.countries.find(c => c.name === 'Italy');
  const crc = E.endrinItaly.gbd['Colon and rectum cancer'];
  const big = M.levels.big;
  // the three groups the scene names in chapter sort (SORT_EXAMPLES): their plain words, from src/data/labels.json
  const ex3 = SORT_EXAMPLES.map(id => XDATA.comm.words(XDATA.comm.find(0, id)));
  return {
    ex3,
    M, E, N: M.nSubst, NN: M.nNet, genes: M.nGenes, links: M.nPairs, median: M.medianGenes, bap: M.bapGenes,
    g1: M.topGenes[0], g2: M.topGenes[1], g3: M.topGenes[2], edges: M.nEdges, pairsAll: M.nPairsAll,
    tenth: M.nSignificant ? M.nEdges / M.nSignificant : 0.1,
    organic: fam('Organic Chemicals'), hetero: fam('Heterocyclic Compounds'), poly: fam('Polycyclic Compounds'),
    rho: M.cited.chemVsGenes.pearson,
    big, bigMin: M.levels.bigMin, bigShare: M.levels.bigShare, raw: M.levels.raw, clotN: E.clot.members.length,
    f2n: (E.clot.genes.find(g => g[0] === 'F2') || ['F2', 0])[1], drawn: M.drawn,
    P: M.ppi.proteins, L: M.ppi.links, Pdrawn: M.ppi.drawn, hazN: M.hazard.n, zCut: M.dis.zClose,
    pubmed: M.cited.pubmed.records, years: [M.cited.eprtr.from, M.cited.eprtr.to],
    share: [0, 1, 2, 3].map(k => pat.count[k] / pat.of), haz: M.hazard.n / M.hazard.of, r: M.hazard.r,
    D: M.dis.n, tested: M.dis.tested, near: M.dis.near, overlap: M.dis.overlap, oz: E.ozoneAsthma,
    C: cty.n, airMean: cty.airMean, waterMean: cty.waterMean, it: it.risk[0], crc,
    a: cty.airSig, A: cty.airOf, b: cty.waterSig, B: cty.waterOf, crho: Math.abs(cty.rho),
  };
}

function buildStory() {
  const F = storyFacts(), R = F.raw;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  // a param that picks something (a step: never eased) jumps from one value to the next at time t
  const jump = (n, t, v0, v1) => { key(n, t, v0); key(n, t, v1); };
  const step = (at, out, col, b, text, say) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''}${say !== undefined ? ` data-say="${esc(say)}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // Each chapter's text: data-at is when a line appears (seconds into the chapter), data-out when it goes. The headset's
  // panel cannot scroll, so no chapter shows more than fits at once: parts that take turns in one place (turns).
  // The voice has its own words (data-say: tools/voice/narrate.mjs speaks them, the headset's subtitles show them); the
  // panel keeps the key points and the exact numbers. Titles and small print are silent.
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const sy = s => ` data-say="${esc(s.replace(/\s+/g, ' ').trim())}"`, mute = ' data-say=""';
  const sh = F.share, Cap = w => w[0].toUpperCase() + w.slice(1);
  const html = {
    cloud: `<h1 data-at="0.6"${mute}>${esc(XR_TITLE)}</h1>
      <p class="lede" data-at="1.6"${mute}>The chemicals around us and the diseases they touch</p>
      ${turns(`<p data-at="3" data-out="21.5"${sy('Take a breath. With it comes exhaust from the street, a trace of smoke, perhaps a little perfume. Now add your breakfast, your coffee, and the pill you took this morning.')}>Air, water, food, medicines, cosmetics, the workplace: what reaches the body from outside.</p>
        <p data-at="12" data-out="21.5"${sy('Scientists have a word for all of it together: the exposome. Everything that reaches your body from the outside, over a whole life.')}>The <b>exposome</b>: every exposure of a lifetime. Here, its chemical part.</p>`,
      `<p data-at="22" data-out="49.5"${sy(`Here is its chemical part. Every dot around you is one substance. There are nearly ${spoken(F.N)} of them: pollutants, pesticides, medicines, things in our food.`)}>${fmt(F.N)} substances with a known effect on human genes (the Comparative Toxicogenomics Database).</p>
        <p data-at="31" data-out="49.5"${sy('How do you put ten thousand substances in order? A chemist sorts them by what they are made of. Each colour here is one chemical family.')}>Sorted by chemistry, on our shelves: the largest families are ${fmt(F.organic)} organic chemicals, ${fmt(F.hetero)} heterocyclic compounds and ${fmt(F.poly)} polycyclic compounds; a substance can belong to several.</p>
        <p data-at="42" class="amber"${sy('It is tidy. But it does not tell us what we most want to know. What does each of them do to us?')}>The question: not what a substance is, but what it does.</p>`)}`,
    reach: `<h2 data-at="0.6"${mute}>One substance reaches in</h2>
      ${turns(`<p data-at="1.5" data-out="25.5"${sy('To find out, we follow one substance into the body. This one is called benzo-a-pyrene. It is in cigarette smoke, in car exhaust, and in the black crust of a grilled steak.')}><b>Benzo(a)pyrene</b>: from burning; in smoke, exhaust and charred food.</p>
        <p data-at="11" data-out="25.5"${sy('And this is a human cell, with its rooms. Every small dot is one of its proteins: the workers that our genes hold the plans for.')}>A model cell; each dot a protein, placed where it works.</p>
        <p data-at="19" data-out="25.5"${sy('When the substance arrives, some genes are switched up and others down. Watch. Every thread is one gene it disturbs.')}>A thread: an experiment in which the substance changed a gene's activity or its protein.</p>`,
      `<p data-at="26" data-out="48.5"${sy(`This is one of the most studied chemicals of all, and it has been seen to touch about ${spoken(F.bap)} genes. Most substances touch far fewer: half of them ${spoken(F.median)} or fewer.`)}>Benzo(a)pyrene: ${fmt(F.bap)} genes, the most of any substance here. Half of all substances: ${fmt(F.median)} or fewer.</p>
        <p data-at="36" data-out="48.5"${sy(`Curators read thousands of studies like this, one paper at a time, and gathered them in one public collection. More than half a million threads, between ten thousand substances and ${spoken(F.genes)} genes.`)}>${fmt(F.links)} curated links between ${fmt(F.N)} substances and ${fmt(F.genes)} genes.</p>`,
      `<p data-at="49"${sy(`Now turn it round, and take one gene. This is caspase 3, a protein that tells a damaged cell to die. About ${spoken(F.g1[1])} different substances pull on it.`)}><b>${esc(F.g1[0])}</b>, a switch for cell death: disturbed by ${fmt(F.g1[1])} substances, the most of any gene; then ${esc(F.g2[0])} (${fmt(F.g2[1])}) and ${esc(F.g3[0])} (${fmt(F.g3[1])}).</p>
        <p data-at="59" class="amber"${sy('So here is a thought. If two substances pull on the same genes, should we not tie them together?')}>Two substances, the same genes?</p>`)}`,
    threads: `<h2 data-at="0.6"${mute}>Tying the threads</h2>
      ${turns(`<p data-at="1.5" data-out="24.5"${sy('That is the idea behind this map. We take two substances and compare the genes they disturb. If they share many more than chance would give, we tie a thread between them.')}>A link between two substances: the genes they share are more than chance explains (tested for every pair).</p>
        <p data-at="13" data-out="24.5"${sy(`We do that for every pair, and there are nearly ${spoken(F.pairsAll)} pairs. We keep only the strongest threads, about ${spoken(F.edges)}.`)}>${fmt(F.NN)} substances, ${fmt(F.edges)} links kept in this map: the strongest ${F.tenth > 0.085 && F.tenth < 0.125 ? 'tenth' : `${pc(F.tenth, 1)} %`} of the significant ones (the ${fmt(F.drawn)} strongest drawn).</p>`,
      `<p data-at="25" data-out="54.5"${sy('And now we let the threads pull. Substances that share a lot move close together. Watch the chemist\'s tidy shelves fall apart.')}>The same substances, now arranged by the genes they share.</p>
        <p data-at="37" data-out="54.5"${sy('Look at the colours. The chemical families are mixed right through. What a substance is made of tells you almost nothing about which genes it disturbs.')}>Alike in chemistry and alike in effect: almost unrelated in this map (correlation ${f2(F.rho)}, where 1 would be a perfect match).</p>
        <p data-at="48" class="amber"${sy('So what do these new neighbours have in common?')}>New neighbours.</p>`)}`,
    sort: `<h2 data-at="0.6"${mute}>Sorted by what they do</h2>
      ${turns(`<p data-at="1.5" data-out="29.5"${sy('The network falls into groups, where the threads are dense. Here are the largest, each in its own colour. And every group has a theme.')}>Communities: groups of substances with many links inside and few outside. Here, ${fmt(F.big)} large ones (${fmt(F.bigMin)} substances or more) hold ${pc(F.bigShare, 1)} % of the substances.</p>
        <p data-at="12" data-out="29.5"${sy(`This one disturbs ${F.ex3[0]}. This one, ${F.ex3[1]}. This one, ${F.ex3[2]}.`)}>Each community with what its genes do (the processes its shared genes are known for), in plain words.</p>
        <p data-at="22" data-out="29.5"${sy('Inside each group there are smaller groups, and smaller ones again. Let us go down into one.')}>Three levels: ${fmt(R[0])}, ${fmt(R[1])} and ${fmt(R[2])} communities, from broad to fine.</p>`,
      `<p data-at="30" data-out="53.5"${sy(`${Cap(spoken(F.clotN))} substances. One is heparin, a blood thinner you get in hospital. One is a hormone from the contraceptive pill. One is a contrast dye for X-ray pictures. And one is a sedative.`)}>A fine community of ${fmt(F.clotN)}: heparins and other blood thinners, hormones of the pill, the contrast agent ioxaglic acid, the sedative clobazam.</p>
        <p data-at="42" data-out="53.5"${sy('A chain of sugars, a hormone, a dye, a sedative. As chemicals they have nothing in common. But they all pull on the same few genes, and those genes control how our blood clots.')}>All four touch <b>SERPINC1</b> (antithrombin, a brake on clotting); ${fmt(F.f2n)} of the ${fmt(F.clotN)} touch <b>F2</b> (prothrombin, which makes the clot). The group's shared genes belong to blood clotting.</p>`,
      `<p data-at="54" data-out="79.5"${sy('That is the heart of it. The body does not care what a molecule looks like. It reacts to which of its systems is disturbed.')}>Not what it is: what it disturbs.</p>
        <p data-at="63" data-out="79.5"${sy('And that is useful. When a new substance that nobody has studied well lands in this group, we have a first guess at what it may do.')}>A new substance's neighbours give a first guess at its effect.</p>
        <p data-at="73" class="amber"${sy('But which disturbances are the dangerous ones?')}>Which ones are dangerous?</p>`)}`,
    centre: `<h2 data-at="0.6"${mute}>Where it hits</h2>
      ${turns(`<p data-at="1.5" data-out="22.5"${sy('For that, we go back into the cell. Its proteins do not work alone. They touch each other, pass signals on, and build machines together. Draw every known contact and you get another network.')}>The human interactome: ${fmt(F.P)} proteins, ${fmt(F.L)} physical contacts (${fmt(F.Pdrawn)} drawn).</p>
        <p data-at="13" data-out="22.5"${sy('Let us take it out of the cell and sort it. The proteins with the most contacts go to the middle. The loners go out to the rim.')}>The same proteins, sorted by how many contacts they have (our arrangement): hubs in the middle.</p>`,
      `<ul class="steps">${step(23, 52.5, CYAN, 'A central module', ` (${pc(sh[0], 1)} % here): targets that touch each other, among the hubs`, `Now we can ask where a substance hits. There are four patterns. Some hit a tight group right in the middle. More than ${shareWords(sh[0])} do this.`)}
        ${step(31, 52.5, AMBER, 'Hubs', ` (${pc(sh[1], 1)} % here): well connected targets that do not touch each other much`, 'Some hit a few big hubs and little else.')}
        ${step(37, 52.5, MAGENTA, 'A module at the edge', ` (${pc(sh[2], 1)} % here): targets that touch each other, without hubs`, 'Some hit a tight group far out at the rim.')}
        ${step(43, 52.5, '#9aa7b8', 'Scattered', ` (${pc(sh[3], 1)} % here): no group, no hubs. The map of contacts is incomplete.`, `And for ${shareWords(sh[3])}, the hits are scattered, with no pattern we can see. Perhaps partly because our map of the cell is not finished.`)}</ul>`,
      `<p data-at="53" data-out="84.5"${sy(`Now compare this with what toxicologists know. For about ${shareWords(F.haz)} of the substances there is a hazard score, from harmless to very harmful.`)}>A hazard score from 0 to 1 for ${pc(F.haz, 1)} % of the substances here (${fmt(F.hazN)}; the NORMAN network's list); those without one are mostly natural compounds.</p>
        <p data-at="62" data-out="84.5"${sy('The substances that hit the middle score highest, on average. The more central the target, the greater the harm.')}>Most harmful on average: a central module, then hubs. Harm rises with the best connected target (a weak but clear trend in this map, r = ${f2(F.r)}).</p>
        <p data-at="71" data-out="84.5"${sy('It makes sense. Pull a thread at the edge of a web and little happens. Pull one in the middle and the whole web moves.')}>A hit in the middle spreads.</p>
        <p data-at="79" class="amber"${sy('And what if the part that moves matters for a disease?')}>And disease?</p>`)}`,
    disease: `<h2 data-at="0.6"${mute}>Disease neighbourhoods</h2>
      ${turns(`<p data-at="1.5" data-out="30.5"${sy('Diseases have their place in this network too. The genes behind asthma, for example, sit close together, like a neighbourhood.')}>A disease's genes cluster in the interactome: its module. ${fmt(F.D)} diseases here.</p>
        <p data-at="9" data-out="30.5"${sy('So we can measure a distance. From the proteins a substance hits, how many steps is it to the neighbourhood of the disease?')}>Distance: from each target, the steps to the nearest disease protein, averaged, and compared with chance.</p>
        <p data-at="17" data-out="30.5"${sy('Here is ozone, the gas of summer smog. Its targets lie right beside the asthma neighbourhood. And doctors have long known that ozone makes asthma worse.')}><b>Ozone and asthma</b>: close in the map (z = ${f2(F.oz.z)}: far closer than chance, where below ${f2(F.zCut).replace('.00', '')} counts as very close), and well known in medicine; ${fmt(F.oz.cit)} PubMed records name both.</p>
        <p data-at="26" class="amber" data-out="30.5"${sy('The map did not know that. It only counted steps.')}>The map only counts steps.</p>`,
      `<p data-at="31" data-out="64.5"${sy(`We measured ${spoken(F.tested)} pairs of substance and disease. About ${spoken(F.near)} came out close: closer than chance allows.`)}>${fmt(F.tested)} pairs tested, ${fmt(F.near)} significantly close. Shared proteins alone would find ${fmt(F.overlap)}.</p>
        <p data-at="42" data-out="64.5"${sy('Can we trust it? One test is the medical literature. The closer a pair sits in the network, the more often the two are written about together.')}>Checked against ${fmt(Math.round(F.pubmed / 1e6))} million PubMed records: the closer the pair, the more papers name both.</p>
        <p data-at="55" class="amber"${sy('But papers are not people. Does any of this show up in real populations?')}>And in real populations?</p>`)}`,
    europe: `<h2 data-at="0.6"${mute}>Out into the world</h2>
      ${turns(`<p data-at="1.5" data-out="25.5"${sy('For that we leave the cell and go up. A long way up. This is Europe.')}>${fmt(F.C)} European countries, ${F.years[0]} to ${F.years[1]}.</p>
        <p data-at="9" data-out="25.5"${sy('Factories here must report what they release into the air and into water. So for every country we know which substances stand out.')}>Industrial releases reported to the European Environment Agency: per country, the substances far above the European level (about ${spoken(Math.round(F.airMean))} to air, ${spoken(Math.round(F.waterMean))} to water).</p>
        <p data-at="18" data-out="25.5"${sy('Take Italy. One substance that stands out there is endrin, an insecticide that was banned long ago, but still turns up in the reports.')}><b>Italy</b>: ${fmt(F.it)} substances stand out. One is <b>endrin</b>, a long-banned insecticide.</p>`,
      `<p data-at="26" data-out="48.5"${sy('From endrin we follow the threads: to its genes, to their proteins, and on to the diseases that sit close by. One of them is cancer of the colon.')}>Diseases close to endrin's targets in the map; among them cancer of the colon and rectum.</p>
        <p data-at="35" data-out="48.5"${sy('And in Italy that cancer is more common: about four times the world\'s average, and a little above the rest of western Europe.')}>Colon and rectum cancer in Italy: ${f2(F.crc[0])} times the global rate, ${f2(F.crc[1])} times western Europe's (Global Burden of Disease).</p>`,
      `<p data-at="49" data-out="84.5"${sy('One case proves nothing. Italy is richer and older than most of the world, and that alone means more cancer. So we did it for every country and every substance.')}>One case is not proof: age and wealth differ too.</p>
        <p data-at="58" data-out="84.5"${sy(`In about ${shareWords((F.a + F.b) / (F.A + F.B))} of the countries, the diseases close to a country's chemicals are more common there than the diseases far from them.`)}>Close diseases more frequent than distant ones in ${fmt(F.a)} of ${fmt(F.A)} countries for air, ${fmt(F.b)} of ${fmt(F.B)} for water. A modest trend overall (correlation ${f2(F.crho)}).</p>
        <p data-at="67" data-out="84.5" class="amber"${sy('It is a tendency, not a proof. The map cannot say that a chemical caused a disease. It says where to look.')}>A link in the data, not a cause.</p>
        <p data-at="75"${sy('Each column here is a country\'s score: how much it releases, counted more when the targets are central.')}>A country's score: its elevated releases, weighted by how well connected their targets are (the authors' risk score, as a share of the total).</p>`)}`,
    end: `<h2 data-at="0.6"${mute}>A map to look with</h2>
      ${turns(`<p data-at="1.5" data-out="22.5"${sy('So that is the map. From a molecule, to a gene, to a cell, to a continent, all tied together by threads you cannot see.')}>Molecule, gene, cell, population: one map.</p>
        <p data-at="10" data-out="22.5"${sy('It leaves a lot out. It does not know the dose. It does not know how long you were exposed, or how substances add up. And it only knows what somebody has already studied.')}>Not in the map: dose, duration, mixtures, how the body breaks a substance down; and whatever has not been studied yet.</p>`,
      `<p data-at="23"${sy('But it gives ten thousand substances a place. And when the next new chemical comes along, we can ask who its neighbours are.')}>A place for every substance, and a first guess for the next one.</p>
        <p data-at="32"${sy('Now it is yours. Pick a substance, a disease or a country, and follow the threads.')}>Explore: substances, groups, diseases, countries.</p>
        <p data-at="36"${mute}><button class="btn primary" id="btnGoExplore" type="button">Explore</button></p>
        <p data-at="38" class="credits"${mute}>Lombardo, Hütter, Unterlass and Menche, <i>A network-based map of the chemical exposome connects molecular interactions to public health</i>, Nature Communications 17, 5754 (2026), doi 10.1038/s41467-026-72402-y. Data: the authors' deposit (Zenodo, doi 10.5281/zenodo.18793297, CC BY 4.0), built on the Comparative Toxicogenomics Database, DisGeNET, the NORMAN network, the European Environment Agency and the Global Burden of Disease study (IHME). The model cell from <i>Back into the cell</i>. The narration is a synthetic voice (Kokoro). Nothing here is medical advice.</p>`)}`,
  };

  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });

  // ------------------------------------------------------------ timeline keys: each builder's chapters (SPEC.md)
  const wp = [];
  // a camera waypoint at time t: a set's named view, turned by spin degrees, optionally nudged
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  const T = { C, F, show, start, jump, key, ramp, cam, label, sfxCue };
  trackSubstances(T);   // chapters cloud, threads, sort, end (engine/e3b_substances.js: builder B)
  trackWorld(T);        // chapters reach, centre, disease, europe and the start of end (engine/e3c_world.js: builder C)
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  wp.sort((x, y) => x[0] - y[0]);
  buildCamera(wp);
}
// no set turns into another at a hand-over (buildCamera's MORPH)
const MORPH = {};
//#use buildCamera setYaw smoothSeg spinEase storyCam LBL labelEl label sfxSpan buildSetLabels labelText
//#use setLabelAlpha~2 _v labelPos _placed placeLabels curCh updateStoryDOM trackHTML buildTimeline ICON_PLAY ICON_PAUSE
//#use lastTick updateTimeline
