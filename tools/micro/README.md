# tools/micro: the sources of the microanatomy story (`stories/micro.js`)

"Tissue and time: how organs are built, and how they age", after the preprint "Systematic mapping of human tissue
microanatomy reveals age-associated remodeling and resilience" (Iva Buljan, Zsuzsanna Bago-Horvath, André F.
Rendeiro; bioRxiv 2025, doi 10.1101/2025.10.13.682110, CC BY-NC), the poster "Microanatomical organization of the
human body and its changes with age" and the talk "Microanatomical principles of tissue organization and their change
with age" (Iva Buljan, Rendeiro group; LBI for Network Medicine, CeMM, Medical University of Vienna). Built like the
PET story (`tools/pet/`), with the tour's kit, set contract, body and tissue sets, and the PET story's organ icons.
Never edit `stories/micro.js` by hand.

```sh
node tools/micro/data/gen_data.mjs network_with_tissue_types_hierarchical.graphml   # -> sets/data.js
node tools/micro/build.mjs                                                         # writes stories/micro.js
node tools/micro/build.mjs --check                                                 # exits 1 if out of date
```

| Path | What it is |
| --- | --- |
| `data/gen_data.mjs` | reads Iva Buljan's network of organ architecture (GraphML; kept out of the repository), the preprint's numbers (typed in) and `data/figures.json`, and writes `sets/data.js` |
| `data/figures.json` | values read off the talk's figures (the atlas of sections, the volcano, trajectories, contact networks) |
| `sets/data.js` | the constant `MICRO_DATA` (generated; its header documents the fields) and the small `PET_DATA` shim the PET story's icons read |
| `sets/slide.js`, `sets/atlas.js`, `sets/hier.js` | the 3D sets (tiles, features, neighbours and domains over the tour's tissue section; the slide library, the atlas, the tile cloud, the volcano and the trajectories; the network of organ architecture and the domain contacts), each with a manifest `sets/<name>.md`; the story also uses `tools/lbi/sets/body.js`, `tools/lbi/sets/tissue.js` and `tools/pet/sets/icons.js` |
| `engine/e1_head.js` ... `e7_app.js` | the story engine, adapted from the PET story |
| `SPEC.md` | what each set and the engine must do; read with `tools/lbi/SPEC.md` |
| `build.mjs` | the assembler |
| `harness.html`, `shot.mjs`, `sweep.mjs` | one set alone (the body and tissue sets and the icons always loaded), its screenshots, and screenshots of the whole story |

The slides, sections and tiles are drawn, never the GTEx images. Where the talk's figures give no numbers (the shape
of a section, the volcano's unlabelled points, most contact networks), the story's pictures are illustrative and it
says so; the numbers it states are the preprint's.
