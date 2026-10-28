# tools/topo: the sources of the tissue topology story (`stories/topo.js`)

"The shape of tissue: topology of cells in the liver", after the poster "topocyte: scale-resolved topological
phenotyping of tissue architecture across spatial modalities" by Simon Schindler, André Rendeiro and Jörg Menche
(Ludwig Boltzmann Institute for Network Medicine at the University of Vienna; University of Vienna; CeMM Research Center
for Molecular Medicine of the Austrian Academy of Sciences; Medical University of Vienna; Max Perutz Labs, Vienna
BioCenter), shown at the Evaluation of the LBI for Network Medicine 2026, and the package's documentation
(topocyte.lab.lbi-netmed.com). Built like the mutation story (`tools/mutation/`), with the tour's kit and set contract.
**Every number is topocyte's** (`TOPO_DATA`, written by the generator from the authors' run on the GTEx liver cohort):
the story only looks them up (`TDATA`), counts stored bars and adds stored shares; it computes nothing scientific.
British spelling, English only. Never edit `stories/topo.js` by hand.

```sh
node tools/topo/test-data.mjs       # checks that the data and its decoders give the poster's numbers (a second)
node tools/topo/build.mjs           # writes stories/topo.js
node tools/topo/build.mjs --check   # exits 1 if out of date
```

| Path | What it is |
| --- | --- |
| `data/gen_data.py` | the generator: runs topocyte and the poster's own figure scripts on the authors' data (the cells' AnnData and the figure folder, kept out of the repository) and writes `sets/data.js`. Its header says what each field holds |
| `sets/data.js` | `TOPO_DATA`: the 123 slides' curves, scores, classifiers and held-out results (pieces and loops), the shares of the gap by radius, the poster's patch (110 cells, its alpha complex, bars, joins and loops), a healthy tile round it and the new slide's window (6,716 cells with their scores, the complex among them and every cell's own bars). Generated: never edit |
| `sets/tdata.js` | `TDATA`: decodes `TOPO_DATA` once and gives the lookups the sets and the engine share (the log ruler of radii, bars alive at a radius, sums of stored shares, the poster's colours); no science |
| `test-data.mjs` | the data's checks: the poster's counts, shares, gap and held-out test from the stored numbers |
| `sets/look.js` | `TLOOK`: the story's look, from the mutation story's `MLOOK`: lit tubes, rings, balls, boxes, halos, glass discs for the growing balls (overlapping ones read as one union), a sheet of glass triangles, ribbons (a curve as a lit strip standing in space), glass slides and cells drawn in H&E or as beads |
| `sets/slide.js`, `sets/map.js`, `sets/tower.js`, `sets/cohort.js` | the 3D sets (the healthy tile and the new slide's window drawn in H&E from their cells, the modalities, the fixed scales and the overview; one cell's neighbourhood, its bars and score, the map of every cell, the two groups and the sketches; the poster's patch, its balls, the tower of scales and its barcode; the 123 slides, their curves and shapes, the cube of scores, the classifier's wall, the held-out stacks and the weight per radius), each with a manifest `sets/<name>.md`. `map` is drawn in `slide`'s frame. The build adds the tour's `body` set and the microanatomy story's organ models (`ORGAN3D`, only the liver) |
| `engine/e1_head.js` ... `e7_app.js` | the story engine, adapted from the mutation story's (its shared lines kept identical): the liver lifting out of the body and its slice falling flat as the tile (`makeLiver` in `e2_scene.js`), the chapters and their text (`e3_story.js`, with `FACTS` from `TOPO_DATA`; the tower's radius eased on the log ruler; the tower standing tall in a headset in chapters 3 and 4, `standView`), explore's Patch, Cohort, Scales, Cells and Scenes tabs (`e4_explore.js`, canvas twins in `e6_panels.js`) |
| `SPEC.md` | what the data, the sets and the engine must do (with the owner's and the author's decisions); read with `tools/lbi/SPEC.md` |
| `build.mjs` | the assembler |
| `harness.html`, `shot.mjs`, `sweep.mjs` | one set alone (`cam=` a view by name or six numbers; `&with=<set>` adds a second set; the data, its decoders, the look, the body and the organ models always loaded), its screenshots, and screenshots of the whole story (`SHOTS=<dir>` and `PORT=<port>` for both tools) |

Explore hashes: `#topo&t=100`, `#topo&explore&tab=patch&r=13.5&tower=on` (`tower=off`: the balls; `view=bars`: the
barcode; `lit=loops`), `#topo&explore&tab=cohort&dim=1&view=space&slide=17` (`dim=0`: pieces; `view=rack|space|held`),
`#topo&explore&tab=scales&dim=1&from=5&to=15` (`to=above`: and above), `#topo&explore&tab=cells&cell=1234&r=4.8&delta=50`
(`show=map|split|genes|proteins`, `delta=100`), `#topo&explore&scene=slide&mode=points` (`piece=window|both|whole`,
`look=he|spots|fluo|points`, `scale=patch|six|radius`), `#topo&explore&scene=body&liver=slice`,
`#topo&explore&scene=tower&view=up` (a camera of the tower's own: `up`, `stand`), `&now=1` skips the glide.

What a shared room shares (`collab.state()`): the tab, the scene, every scene's controls (the liver; the slide's tissue,
look and scale; the tower's view and what is lit; the cohort's view and its curves, pieces or loops; the map's show and
its δ, 50 or 100 µm), the patch's radius (`r`, µm to the hundredth), a cell's network radius (`mr`), the slide picked
(`slide`, -1 none), the window of radii (`from`, `to`, on the 0.5 µm grid; `to` 100.5 is "and above") and the cell
picked (`cell`, -1 the poster's cell v). Never the camera or anything per device.

Slides are numbered, never named: no GTEx sample or donor id, no donor details, never a GTEx image or the poster's
pictures. The tissue is drawn from the cells' positions and the cell classifier's types. The local radius is 50 µm; the
poster's 100 µm appears only in small print. No patient data.
