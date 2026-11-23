// Checks CDK5_DATA (sets/data.js) and its decoders (sets/cdata.js) against the authors' numbers (the CDK5_data
// repository's notebook outputs and textures). A second, no browser.
// usage (from the repository root): node packages/cdk5/src/test-data.mjs
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = { Buffer, module: undefined };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, 'sets/data.js'), 'utf8') + '\nthis.CDK5_DATA = CDK5_DATA;', ctx);
vm.runInContext(fs.readFileSync(path.join(here, 'sets/cdata.js'), 'utf8') + '\nthis.CDATA = CDATA;', ctx);
const C = ctx.CDATA, D = ctx.CDK5_DATA;
let bad = 0;
const ok = (cond, what) => { if (!cond) { bad++; console.log('FAIL', what); } };
const near = (a, b, eps, what) => ok(Math.abs(a - b) <= eps, `${what}: ${a} against ${b}`);
const t0 = Date.now();
ok(C.n === 16376 && C.e === 309355, 'the interactome: 16,376 proteins, 309,355 links');
let sum = 0; for (let i = 0; i < C.n; i++) sum += C.deg(i);
ok(sum === 2 * C.e, 'every link decoded once each way');
ok(C.sym[C.cdk5] === 'CDK5' && C.sym[C.r1] === 'CDK5R1' && C.sym[C.r2] === 'CDK5R2' && C.sym[C.capn1] === 'CAPN1', 'the four named proteins');
ok(C.deg(C.cdk5) === 205, 'CDK5 has 205 partners (the notebook: 205 links)');
ok(C.linked(C.cdk5, C.r1) && C.linked(C.cdk5, C.r2) && !C.linked(C.r1, C.r2), 'CDK5 - p35, CDK5 - p39, no p35 - p39');
ok(!C.linked(C.cdk5, C.capn1), 'no CDK5 - calpain link in the interactome (the authors add it in their scene)');
ok(C.facts.hub.sym === 'APP' && C.facts.hub.deg === 2123, 'the best-linked protein: APP, 2,123');
let nbp = 0, nds = 0; for (let i = 0; i < C.n; i++) { nbp += C.bp(i); nds += C.dis(i); }
ok(nbp === 13003 && nds === 6538, `13,003 with a GO process, 6,538 with a disease (${nbp}, ${nds})`);
const links = k => C.scene(k).links.reduce((a, l) => a + l.pairs.length / 2, 0);
const want = { bioproc: 3964, subunits: 3966, partners: 205, ntrk2: 83, sema: 125, npas4: 44, calpain: 3958, alzheimer: 39, disease: 1283 };
for (const k in want) ok(links(k) === want[k], `${k}: ${want[k]} links shown (${links(k)})`);
ok(C.SCENES.join() === 'bioproc,subunits,partners,ntrk2,sema,npas4,calpain,alzheimer,disease', 'the nine scenes in order');
// layouts: the sphere, the centres, the landscape
const L0 = C.layout('bioproc');
let rIn = [], rOut = [];
for (let i = 0; i < C.n; i++) (C.bp(i) ? rIn : rOut).push(Math.hypot(L0[3 * i], L0[3 * i + 1], L0[3 * i + 2]));
rIn.sort((a, b) => a - b); rOut.sort((a, b) => a - b);
near(rIn[rIn.length >> 1], 1.0, 0.08, 'the inner shell at radius about 1');
near(rOut[rOut.length >> 1], 1.2, 0.01, 'the outer shell at radius 1.2');
for (const k of ['subunits', 'partners', 'ntrk2', 'sema', 'npas4', 'calpain', 'alzheimer']) {
  const L = C.layout(k), s = C.scene(k);
  let r = 0; for (const i of s.moved) r = Math.max(r, Math.hypot(L[3 * i], L[3 * i + 1], L[3 * i + 2]));
  near(r, C.CENTRE_R, 1e-6, `${k}: its centre scaled to radius ${C.CENTRE_R}`);
  ok(s.centre.includes(C.cdk5), `${k}: CDK5 in its centre`);
}
ok(Math.hypot(...C.layout('subunits').slice(3 * C.cdk5, 3 * C.cdk5 + 3)) < 1e-3, 'CDK5 at the middle with its activators');
ok(C.scene('subunits').centre.length === 3 && C.scene('calpain').centre.length === 2, 'the activators\' and calpain\'s centres');
ok(C.scene('ntrk2').centre.length === 26 && C.scene('alzheimer').centre.length === 22, 'NTRK2: 25 members and p39 placed; Alzheimer\'s: 22 shown');
const LL = C.layout('disease');
let mx = 0; for (let i = 0; i < C.n; i++) if (C.dis(i)) mx = Math.max(mx, Math.abs(LL[3 * i]), Math.abs(LL[3 * i + 1]), Math.abs(LL[3 * i + 2]));
ok(mx < 1.0, `the landscape's proteins with a disease within 1 of the origin (${mx.toFixed(3)})`);
// colours as the textures hold them
const at = (k, i) => Array.from(C.colours(k).slice(4 * i, 4 * i + 4)).map(v => Math.round(v * 255));
ok(at('subunits', C.cdk5).join() === '42,255,0,240', 'CDK5 bright green with its activators');
ok(at('calpain', C.cdk5).join() === '255,0,0,200' && at('calpain', C.capn1).join() === '255,255,0,200', 'CDK5 red, calpain yellow');
ok(at('alzheimer', C.find('APP')).join() === '255,165,0,240', 'APP orange in the Alzheimer\'s pathway');
ok(at('disease', C.cdk5).join() === '255,0,0,200', 'CDK5 red in the landscape');
ok(at('bioproc', C.find('APP')).join() === '255,255,229,100', 'APP light yellow by its degree on the sphere');
// lookups, pathways, diseases, facts
ok(C.find('cdk5') === C.cdk5 && C.search('cdk5')[0] === C.cdk5, 'find and search');
ok(C.pathways.ntrk2.members.length === 25 && C.pathways.alzheimer.members.length === 22, 'the two pathways\' members');
// the second project's three scenes (CDK5_minimal_new): the star, Semaphorin interactions, NPAS4
const P2 = C.scene('partners');
ok(P2.moved.length === 206 && P2.moved.every(i => i === C.cdk5 || C.linked(C.cdk5, i)), 'partners: CDK5 and its 205 partners');
ok(P2.centre.join() === String(C.cdk5), 'partners: only CDK5 at the close-up');
ok(at('partners', C.cdk5).join() === '144,255,143,200' && at('partners', C.r1).join() === '53,112,11,160', 'partners: CDK5 mint, its activators olive');
ok(C.pathways.sema.members.length === 63 && C.pathways.sema.shown.length === 56 && C.scene('sema').moved.length === 56, 'Semaphorin interactions: 63 in the map, 56 linked in one piece');
ok(C.pathways.npas4.members.length === 33 && C.pathways.npas4.shown.length === 26 && C.pathways.npas4.members.includes(C.cdk5), 'NPAS4: 33 in the map (CDK5 among them), 26 shown');
ok(C.sym[C.npas4] === 'NPAS4' && !C.linked(C.cdk5, C.npas4), 'no CDK5 - NPAS4 link in the interactome (the authors add it)');
ok(C.scene('npas4').links.some(l => { for (let k = 0; k < l.pairs.length; k += 2) if ((l.pairs[k] === C.cdk5 && l.pairs[k + 1] === C.npas4) || (l.pairs[k + 1] === C.cdk5 && l.pairs[k] === C.npas4)) return true; return false; }), 'NPAS4: the authors\' CDK5 - NPAS4 link drawn');
for (const k of ['sema', 'npas4']) {
  const s = C.scene(k); let nl = 0, out = 0;
  for (const l of s.links) for (let j = 0; j < l.pairs.length; j += 2) { nl++; const a = l.pairs[j], b = l.pairs[j + 1]; if (!C.linked(a, b) && !(k === 'npas4' && (a === C.cdk5 || b === C.cdk5))) out++; }
  ok(out === 0, `${k}: every link the interactome's (${out} not)`);
}
ok(C.ambiguous.length === 6 && C.ambiguous.every(p => p.length === 2), 'six pairs the second project does not tell apart');
ok(at('sema', C.find('SEMA4D')).join() === '0,255,224,100', 'SEMA4D teal in its scene');
ok(C.diseases.cdk5Terms.includes('lissencephaly') && C.diseases.cdk5Terms.includes('intellectual disability'), 'CDK5\'s own terms');
ok(C.diseases.partnersAnnotated === 126, '126 of CDK5\'s partners have a disease');
const pd = C.terms.find(t => t.name === "Parkinson's disease");
ok(pd && pd.partners === 9 && pd.pP < 0.001, `Parkinson's disease: 9 partners (${pd && pd.partners}, p ${pd && pd.pP})`);
ok(C.diseases.near.length === 30 && C.diseases.nearTop[0].k === 27, 'the landscape: 27 of CDK5\'s 30 nearest share its rarest terms');
ok(C.terms.every(t => t.genes.length === t.n), 'every term\'s genes decoded');
ok(C.termsOf(C.cdk5).length === C.terms.filter(t => t.cdk5).length, 'termsOf');
const fam = Object.fromEntries(C.facts.family.map(f => [f.sym, f.deg]));
ok(fam.CDK2 < 5 && fam.CDK4 < 5 && fam.CDK6 < 5 && C.facts.activators.p35 > 90 && C.facts.activators.p39 > 170, 'the CDK family near CDK5, its activators far');
// the process knots (named from a current GO release: packages/cdk5/src/data/gen_data.py --go)
ok(C.clouds.length >= 8 && C.clouds.length <= 14 && C.go && /GO|Gene Ontology/.test(C.go.source), `the map's process knots (${C.clouds.length})`);
ok(C.clouds.every(c => c.knot.length === c.n && c.members.length === c.size && c.fold >= 5 && c.knot.every(i => C.bp(i))), 'every knot decoded, at least 5 times chance, on the inner shell');
ok(C.clouds.every(c => { const r = Math.hypot(...c.centre); return r > 0.75 && r < 1.15; }), 'every knot on the sphere');
ok(C.clouds.some(c => /synaptic/.test(c.name)), 'a knot of the synapse among them');
console.log(bad ? `${bad} failed` : 'all good', `(${Date.now() - t0} ms)`);
process.exit(bad ? 1 : 0);
