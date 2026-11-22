# tools/mol: protein models for the stories

`build.py` turns entries of the Protein Data Bank into models a story draws in a headset at full frame rate: a smooth
molecular surface with baked ambient occlusion, a cartoon (helices as ribbons, strands as arrows, coils as tubes, DNA
and RNA as a backbone tube with rungs) and one ball per residue, each at three levels of detail, in one small binary
file per model (`<name>.mol`, `SPEC.md`). The engine's model parts (`tools/engine/e2_scene.js`: `MOLS`, `molLoad`,
`molParse`, `molMaterial`, `molMesh`, `molInstanced`) load those files and draw them with one cheap material, so any
built story or package gets them with one `//#use` line. `view.html` shows a model's every look and level.

Nothing here goes into the app but the `.mol` files and their `index.json`: the Python environment and the entries'
mmCIF files stay outside the repository.

## Setup (once)

A Python 3.10 or newer with numpy, scikit-image (marching cubes; it brings scipy) and fast-simplification (quadric
decimation), in a virtual environment outside the repository:

```sh
python3 -m venv ~/molenv
~/molenv/bin/pip install numpy scikit-image fast-simplification
```

The entries' files are downloaded from <https://files.rcsb.org/download/> the first time they are needed, into
`~/molcache` (or the folder in `MOL_CACHE`), and kept there.

## The workflow

1. **Write the story's `models.json`** (beside its sources: `packages/<key>/src/models.json`, or
   `tools/<key>/models.json`). A list of models, each named, with its entry, its chains, its colours and its credit
   (`SPEC.md`, "models.json", has every field):

   ```json
   [
     { "name": "grb2", "title": "GRB2, full length", "pdb": "1GRI", "chains": ["A"],
       "colour": { "by": "domain", "default": "#c8c8c8", "domains": [
         ["A", 1, 58, "#73ccff", "SH3"], ["A", 60, 152, "#ffbf59", "SH2"], ["A", 156, 217, "#73ccff", "SH3"]] },
       "credit": "PDB 1GRI (Maignan et al., Science 1995)" },
     { "name": "stat3", "title": "STAT3 as a pair on DNA", "pdb": "1BG1", "assembly": 1,
       "colour": { "by": "chain", "chains": { "A": "#73ccff", "A-2": "#8fd98f" } },
       "credit": "PDB 1BG1 (Becker et al., Nature 1998)" },
     { "name": "b2ar", "pdb": "2RH1", "chains": ["A"], "residues": 999, "looks": ["surface", "cartoon"],
       "colour": { "by": "uniform", "default": "#ff9f80" }, "credit": "PDB 2RH1 (Cherezov et al., Science 2007)" }
   ]
   ```

   An entry's biological assembly (`"assembly": 1`) is its own file at the PDB, whose copies of a chain are named
   `A-2`, `B-2` ...; a rule for `A` also covers `A-2` unless `A-2` has its own. `residues` drops a crystallised
   partner (2RH1's T4 lysozyme, numbered from 1000). Only the looks a story uses need building (`looks`), and a crowd's
   lowest level can be made smaller (`"lods": [30000, 9000, 500]`).

2. **Build:**

   ```sh
   ~/molenv/bin/python tools/mol/build.py packages/<key>/src/models.json packages/<key>/models
   ```

   It writes `<name>.mol` for each model and `index.json` (each model's title, credit, size, residues, its levels'
   triangle counts and the file's fingerprint), and says for each what it made and how long it took. A model whose
   inputs (its entry in models.json, its mmCIF file, this tool) have not changed is kept as it is; `--force` rebuilds
   all, `--only grb2,ubq` only those. `--check` exits 1 when a model is not current (the release's cheap checks may run
   it). The output is the same, byte for byte, every run on the same machine.

3. **Look at it:** serve the repository's folder (`python3 -m http.server 8123`) and open
   `http://127.0.0.1:8123/tools/mol/view.html?dir=../../packages/<key>/models&model=grb2`. "Looking at a model" below.

4. **Use it in a set.** Name the parts on the story's `e2_scene.js` `//#use` line (in a package's
   `src/engine/e2_scene.js`, or a built story's `tools/<key>/engine/e2_scene.js`):

   ```js
   //#use MOLS molLoad molParse molMaterial molMesh molInstanced
   ```

   then, in the set (`src/sets/<name>.js`):

   ```js
   SETS.close = function (K) {
     const set = K.newSet('close'), { THREE } = K;
     const grb2 = molMesh(set, 'grb2', { look: 'surface', width: 0.5 });   // 0.5 scene units along its longest axis
     set.group.add(grb2.group);
     const tag = grb2.anchor('A', 89);                                      // a residue's place, for a label
     return Object.assign(set, {
       update(S, t) { grb2.setHighlight(S.sh2 > 0 ? 'A:60' : null, 'A:152', '#ffd24d', S.sh2); },
     });
   };
   // the models load before the set is built: buildSet runs prep again (a load step, frames go on) until it is true
   SETS.close.prep = () => molReady(f => pkgUrl('models/' + f), ['grb2', 'stat3']);
   ```

   A crowd of one model in one draw:

   ```js
   const crowd = molInstanced(set, 'ubq', { look: 'surface', lod: 2, count: 400, width: 0.04 });
   for (let i = 0; i < 400; i++) crowd.setAt(i, place[i], turn[i], 0.8 + 0.4 * r());
   set.group.add(crowd.mesh);
   ```

   `molMesh` picks its level by the model's size on screen (on a page or in a headset) unless given `lod: 0 | 1 | 2`;
   its material follows the set's fade as the kit's materials do. The whole API is in `SPEC.md`, "The runtime".

5. **Serve the files.** A package's `models/` folder works as it is: `node tools/packages/scan.mjs` fingerprints the
   files, `pkgUrl` gives each its address, and the service worker keeps them with the package. A built story
   (`stories/<key>.js`) that loads models needs their folder in `sw.js` `SHELL` (each file) and in `relay/server.mjs`
   `APP_DIRS`, or the relay serving the app answers 404 for them; and its addresses are fingerprinted by hand (`?v=`
   the file's `fp` from `index.json`).

6. **Credit** each model where the story shows it (`head.credit` in the file, `credit` in `index.json`): the PDB's data
   are free of rights (CC0), but the entry's paper is cited, as in "PDB 1GRI (Maignan et al., Science 1995)".

## Looking at a model

`tools/mol/view.html` (not part of the app) takes the parts out of `tools/engine/e2_scene.js` as it loads and runs them
as a story does, so it shows what a story draws. Its address takes `dir` (the folder with `index.json` and the `.mol`
files: relative to the page, or an absolute path on the same server) and `model`; `view=grid` (the default) shows every
look at every level side by side with their triangle counts, `view=single` one look (`look=surface|cartoon|balls`,
`lod=auto|0|1|2`), `hl=A:60-A:152` lights a range, `crowd=300` draws copies of the lowest level in one draw, `yaw` and
`pitch` turn it (degrees). Drag turns it, the wheel zooms. The bottom line says the file's size, how long it took to
load and parse, and what was drawn (triangles, draws).

## Quality and cost

- **The surface** is a Gaussian density of every heavy atom (each a Gaussian of its van der Waals radius) on a grid of
  0.8 Å (coarser for big assemblies, at most 5 million points), its level set by marching cubes, cavities inside and
  crumbs dropped, then decimated (quadric) to each level's target. Normals come from the density's gradient, so even
  the lowest level shades smoothly. Its ambient occlusion: 48 rays over each vertex's hemisphere marched through the
  density, near blocks counting more. `sharpness` (0.8 by default) trades smoothness (lower) for atomic bumps
  (higher, 1.6 shows single atoms).
- **The cartoon** follows a Catmull-Rom spline through the alpha carbons (strands straightened), each ribbon turned by
  its residues' carbonyls; helices and strands from the entry's own records (`_struct_conf`, `_struct_sheet_range`;
  a rough guess from the alpha carbons where it has none). Its occlusion is cheap: how crowded it is just outside.
- **Measured** (this machine, `tools/mol/test/models.json`; triangles at LOD 0 / 1 / 2):

  | Model | Residues | Surface | Cartoon | File | Build |
  | --- | --- | --- | --- | --- | --- |
  | 1GRI, GRB2 | 211 | 31,346 / 9,402 / 2,350 | 25,360 / 10,256 / 4,320 | 1,069 KB (surface 547) | 1.4 s |
  | 1BG1 assembly 1, two STAT3 on DNA | 1,154 | 114,266 / 34,278 / 8,568 | 74,536 / 28,452 / 12,340 | 3,518 KB | 6 s |
  | 2RH1 chain A to 999, the beta-2 adrenergic receptor | 282 | 38,338 / 11,500 / 2,874 | 33,640 / 13,472 / 5,620 | 1,347 KB | 1.6 s |
  | 1UBQ, ubiquitin | 76 | 14,176 / 4,252 / 1,062 | 9,120 / 3,696 / 1,560 | 436 KB | 0.5 s |

  A file loads and parses in 5 to 40 ms on a desktop (views on its own buffer, nothing copied).
- **The budget on a Quest 3** (72 to 120 Hz): a close-up may have about 150,000 to 200,000 triangles of models in view
  (one or two models at LOD 0); a model further off takes LOD 1 or 2 by itself (`lodPx`, the radii in pixels where it
  changes: 260 and 70); crowds are `molInstanced` at LOD 2, one draw each, a few hundred copies of a model of 500 to
  1,000 triangles. Each `molMesh` is one draw call per look (the balls: one instanced draw). These are guides, not
  measurements: frame rates only show on a headset.
- The material is one ShaderMaterial (no textures, no derivatives, no fog): sky light times the baked occlusion, a key
  light from the scene's sun (`LV`), a little specular, a soft rim, the highlight's glow.

## Files

- `build.py` - the builder (`SPEC.md` for its input and output).
- `view.html` - the harness above.
- `SPEC.md` - models.json, the `.mol` format, the runtime API.
- `test/models.json` - four test entries (1GRI by domain, 1BG1's assembly, 2RH1's receptor, 1UBQ); build them into a
  folder outside the repository: `~/molenv/bin/python tools/mol/build.py tools/mol/test/models.json /tmp/mol-test`.
