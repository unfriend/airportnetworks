# packages/cdk5/src: the sources of the CDK5 story package (`packages/cdk5/main.js`)

"The switch that sticks": CDK5, a kinase of neurons, among 16,376 human proteins, after the Menche lab's repository
**CDK5_data** (github.com/menchelab/CDK5_data, Christiane Hütter): its **CDK5_analytics** VR project, six scenes on the
whole human interactome made with the lab's cartoGRAPHs. The repository is the lab's own and public; only derived
numbers go into ours. Built like the soil story (`packages/soil/src/`), with the tour's kit, set contract and the shared
engine parts (`tools/engine/`). British spelling, English only. Never edit `packages/cdk5/main.js` by hand. Made on a fork
of the app at v135 (as `tools/cdk5/` and `stories/cdk5.js`) and brought into the app as a package at v189.

**Working on it** (editing, the preview, publishing to the test site with one command): `docs/working-on-a-story.md`.
In short: `node relay/server.mjs --static . --watch --build` and http://localhost:8787/#cdk5 while editing, then
`node tools/packages/publish.mjs cdk5 "<what changed>"`.

```sh
node packages/cdk5/src/test-data.mjs       # checks the data and its decoders (a second)
node packages/cdk5/src/build.mjs           # writes packages/cdk5/main.js
node packages/cdk5/src/build.mjs --check   # exits 1 if out of date
node tools/packages/scan.mjs               # then the package index (packages/index.json)
# the data, from a clone of CDK5_data (kept out of the repository), in a Python with numpy, Pillow, scipy, scikit-learn:
python3 -I packages/cdk5/src/data/gen_data.py <folder of the CDK5_data clone> --keep-clouds packages/cdk5/src/sets/data.js
#   (or --go <folder with a GO release> to name the process knots afresh)                    # sets/data.js (seconds)
# the structures, in tools/mol's Python (tools/mol/README.md):
python3 tools/mol/build.py packages/cdk5/src/models.json packages/cdk5/models
```

| Path | What it is |
| --- | --- |
| `models.json` | the PDB structures the core draws (built into `packages/cdk5/models/`: nine `.mol` files and `index.json`, about 2 MB) |
| `data/gen_data.py` | the generator: decodes the analytics project's textures (every protein's place and colour in each of the six scenes, the scenes' links) and input files (the interactome, gene symbols, the two Reactome pathways, the Disease Ontology associations) and computes the over-representation counts. Its header says where every field comes from |
| `sets/data.js` | `CDK5_DATA` (about 1.1 MB). Generated: never edit, never read whole |
| `sets/cdata.js` | `CDATA`: decodes `CDK5_DATA` once and gives the lookups the sets and the engine share (its header is the data's API); no science |
| `sets/look.js` | `CLOOK`: the story's palette (the authors' colours: CDK5 green, hyperactive red, NTRK2 cyan, calpain yellow, the Alzheimer's pathway orange) |
| `sets/net.js` | the interactome in the authors' six arrangements: points that flow from one to the next, the scenes' links, CDK5's halo, its partners, cousins and nearest, the veil, picking (builder A; manifest `net.md`) |
| `sets/core.js` | the close-up at the map's centre: each scene's centre proteins as lit balls with their names, the links among them as tubes, the PDB structures in place of their balls (loaded on demand), the signal's pulses, the cut, the phosphate tags on Tau and CDK5 turning red (manifest `core.md`). The build adds the tissue topology story's look (`TLOOK`), unchanged |
| `engine/e1_head.js` ... `e7_app.js` | the story's own parts of the engine; each `//#use` line is replaced by those parts of `tools/engine/<the same file name>.js` (the engine the built stories share, `node tools/engine/parts.mjs` lists who uses what). The story's own: the two sets in one frame and the core following the net's points (`e2_scene.js`); the ten chapters and the close, their text from `CDATA` (`FACTS`), keys, cameras, cues and the pace (`NARRATION_SYNC`, `NARRATION_ENDS`: `node tools/voice/narrate.mjs cdk5` writes both) in `e3_story.js`
(chapters, keys, cues and lines are authored in seconds and run at `K_T`, 1, of them, by its own `key`; each spoken line is a `data-say`, a line with no key point of its own an empty `vo` mark; small print carries `data-say=""`
so the narration leaves it out); explore's tabs Scenes, Proteins, Diseases and About, the shared state (`COLLAB_V`) and picking in `e4_explore.js`; the headset's placement (its own `xrPlace` and `xrCap`: the default size, clearance from the eyes, standing inside; its own `xrTip`, `xrBallHit` and `xrMinD`, the net's frame) in `e5_xr.js`; the headset twins of the panes in `e6_panels.js`; explore's start, the links and its own `frame` (the shared one with explore's views as the net's, `sceneCam`, and `XR.inW`) in `e7_app.js` |
| `SPEC.md` | what the data, the sets and the engine must do (with the owner's decisions: the v191 rework; the v189 brief it overrides is `docs/history/specs/cdk5-superseded.md`); read with `packages/lbi/src/SPEC.md` |
| `build.mjs` | the assembler |
| `harness.html`, `shot.mjs`, `sweep.mjs` | one set alone (`&with=<set>` adds the other), its screenshots, and screenshots of the whole story (`SHOTS=<dir>`, `PORT=<port>`) |

**The authors'**: the interactome (16,376 proteins, 309,355 links), every layout of the nine scenes (the map of
processes, a sphere by Gene Ontology biological processes; the centres of scenes 1 to 4; the disease landscape by
Disease Ontology associations), every colour and every link drawn, the two pathways' members (Reactome) and the
proteins' disease associations. The one link the authors added, CDK5 - calpain in scene 3, is not an interaction of the
interactome: the story says so. **Ours**: the close-ups at the centre (balls, tubes and names, at the authors' relative
places scaled up), the tags with numbers, the signal's pulses, and the over-representation counts (hypergeometric, over
the 6,538 proteins with any disease association; said "in this map", with the caveat that well-studied proteins have
more known partners and diseases).

Explore links: `#cdk5&t=100` (a story time), `#cdk5&explore&scene=disease` (`bioproc`, `subunits`, `partners`, `ntrk2`,
`sema`, `npas4`, `calpain`, `alzheimer`, `disease`, or 0 to 8), `&links=off`, `&shell=faint`, `&cousins=on`, `&near=on`, `&view=<a net view>`,
`&tab=scenes|proteins|diseases|about`, `&q=CDK5R1` (a protein by its symbol), `&term=lissencephaly` (a term by name or
id), `&path=ntrk2|alzheimer|sema|npas4`, `&inside` (Stand inside: the map of processes only), `&now=1` (no glide).
