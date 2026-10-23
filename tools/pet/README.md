# tools/pet: the sources of the PET story (`stories/pet.js`)

"One scan, one system: the body as a metabolic network", after the paper "The metabolic organ connectome: A novel
approach to measure allostatic load during health-to-disease transition" (Barbara Katharina Geist, Julia Guthrie,
Hunor Kertesz, Florian W. Kiefer, Oana C. Kulterer, Thomas Nakuz, Lukas Nics, Eva-Maria Patronas, Andre Rendeiro,
Chrysoula Vraka, Josef Yu, Stefan Grünert, Marcus Hacker; Med 6, 100881, 2025; CC BY 4.0), the poster "Shaping a New
Era in Nuclear Medicine" (Barbara K Geist, Alexander Grentner, Joel Fischer, Josef Yu, Dato Tsomaia, Adna Smajlovic,
Stefan Grünert, Marcus Hacker; Medical University of Vienna and LBI for Network Medicine) and their vision slide "One
Scan, One System". Built like the endotype story (`tools/endo/`), with the tour's kit, set contract and PET body set.
Never edit `stories/pet.js` by hand.

```sh
node tools/pet/data/gen_data.mjs     # the paper's tables + data/figures.json -> sets/data.js
node tools/pet/build.mjs             # writes stories/pet.js
node tools/pet/build.mjs --check     # exits 1 if stories/pet.js is out of date
```

| Path | What it is |
| --- | --- |
| `data/gen_data.mjs` | the paper's tables (typed in), the two weight matrices printed in its Figure 2A, the figures' readings, and the stand-ins (typical organ uptakes, a synthetic cohort with Figure 2A's partial correlations) -> `sets/data.js` |
| `data/figures.json` | values read off the paper's Figures 3 and 4, each read twice independently and reconciled; it also holds readings of the poster's plots (its patients only as group summaries), which the story no longer uses |
| `sets/data.js` | the constant `PET_DATA` (generated; its header documents the fields) |
| `sets/icons.js` | `PET_ICONS`: line icons of the 13 organs and the aorta, for canvases and as a texture atlas |
| `sets/scan.js`, `sets/organs.js` | the 3D sets (the scanner, how PET sees and the vision row; organs, uptake and the paper's networks over the tour's body), each with a manifest `sets/<name>.md`; the story also uses `tools/lbi/sets/body.js` |
| `engine/e1_head.js` ... `e7_app.js` | the story engine, adapted from the endotype story |
| `SPEC.md` | what each set and the engine must do; read with `tools/lbi/SPEC.md` |
| `build.mjs` | the assembler |
| `harness.html`, `shot.mjs`, `sweep.mjs` | one set alone (the body set and the icons always loaded), its screenshots, and screenshots of the whole story |

No patient data belongs in this story. The authors' VR viewer (`Network_VR`) holds a patient's CT surface and PET/CT
volume: none of it is used here; its idea of the organ network in the body is redrawn from scratch.

The poster's one-scan network (its index, survival and the immunotherapy test) and an organ as a network of patches
were in the story until October 2026, as the sets `people` and `liver` and explore's One scan and People tabs. They
were taken out because they did not match the poster; git history has them.
