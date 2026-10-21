# tools/endo: the sources of the endotype story (`stories/endo.js`)

"Endotypes: one disease, many mechanisms", after the ISMB 2026 poster "Introducing EndotypY: a Python package for
network-based disease endotyping" by Chloé Bûcheron, Iker Núñez-Carpintero, Enes Sakalli, Mathilde Meyenberg, Julia
Guthrie and Jörg Menche (LBI Network Medicine), on their run of EndotypY (github.com/menchelab/EndotypY) on
congenital myasthenic syndromes. Built like the muscle story (`tools/nmd/`), with the tour's kit and set contract,
and the muscle story's motor set. Never edit `stories/endo.js` by hand.

```sh
python -I tools/endo/data/gen_data.py run.pkl seeds.xlsx   # the authors' files -> sets/data.js (only after a new run)
node tools/endo/build.mjs                                  # writes stories/endo.js
node tools/endo/build.mjs --check                          # exits 1 if stories/endo.js is out of date
```

| Path | What it is |
| --- | --- |
| `data/gen_data.py` | reads the authors' saved run (network, seeds, endotypes) and the Gene Table's CMS genes, re-runs the steps before the endotypes with EndotypY's defaults, and writes `sets/data.js`; the authors' files stay out of the repository |
| `sets/data.js` | the constant `ENDO_DATA` (generated; its header documents the fields) |
| `sets/syn.js`, `sets/net.js`, `sets/tree.js` | the three 3D sets (the junction close up; the network, seeds and walk; matrix, tree and endotypes), each with a manifest `sets/<name>.md`; the story also uses `tools/nmd/sets/motor.js` |
| `engine/e1_head.js` ... `e7_app.js` | the story engine, adapted from the muscle story |
| `SPEC.md` | what each set and the engine must do; read with `tools/lbi/SPEC.md` |
| `build.mjs` | the assembler (it gives the motor set the muscle story's disease groups) |
| `harness.html`, `shot.mjs`, `sweep.mjs` | one set alone, its screenshots, and screenshots of the whole story (as in `tools/nmd/`) |

The endotypes are the authors' result. The steps before them are re-run here on the same network with the
package's default settings, to illustrate the method (the authors' own settings are not known); the tree is drawn to
agree with their endotypes. No patient data and no variants belong in this story.
