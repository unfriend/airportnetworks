# Protein models: models.json, the .mol format, the runtime

The contract between `tools/mol/build.py` (writes), the engine's model parts in `tools/engine/e2_scene.js` (read and
draw) and a story's sets (use). How to work with it: `README.md`.

## models.json

A list of models (or `{ "models": [...] }`). Each:

| Field | | |
| --- | --- | --- |
| `name` | required | the file's name (`<name>.mol`) and the model's key: lower-case letters, digits, `-`, `_` |
| `pdb` | required | a PDB id (`"1GRI"`: fetched from files.rcsb.org into `MOL_CACHE`) or a local `.cif` path (relative to models.json) |
| `assembly` | | a biological assembly's number: `<ID>-assembly<N>.cif` is fetched instead (its chain copies are `A-2`, `B-2` ...) |
| `chains` | | the author chain ids kept, in this order (default: every polymer chain, in the file's order) |
| `residues` | | a number (the highest residue number kept), `[from, to]`, or `{ "A": either, ... }` per chain |
| `ligands` | | residue names of non-polymer groups to keep (`["HEM"]`); waters, ions and other ligands are always left out |
| `colour` | | `{ by, chains, domains, default }`, below |
| `looks` | | which to build, of `["surface", "cartoon", "balls"]` (default: all three) |
| `lods` | | the surface's triangle targets `[lod0, lod1, lod2]` (default 40,000 / 12,000 / 3,000 for 2,400 heavy atoms, scaled by atoms^0.75, LOD 0 at most 120,000, LOD 2 at least 800) |
| `sharpness` | | the surface's Gaussian sharpness B (0.8; higher shows more single atoms) |
| `step` | | the surface's finest grid step in Å (0.8; made coarser for a big model, at most 5 million grid points) |
| `orient` | | `true` (default): centred and turned to its own axes (longest along x, then y); `false`: the entry's own coordinates (models cut from one entry then line up: draw them with `centred: false`) |
| `title`, `credit` | | shown by the story; credit cites the entry and its paper: `"PDB 1GRI (Maignan et al., Science 1995)"` |

Kept atoms: model 1, alternate location `.` or `A`, no hydrogens, polymer residues only (those with a `label_seq_id`:
modified residues in the chain such as PTR, SEP, TPO and MSE are kept) plus `ligands`. A residue is protein when it has
a CA, nucleic when it has a P or C1', otherwise a ligand. Its anchor is its CA (protein), P or C4' (nucleic), or its
atoms' middle (ligand). Secondary structure from `_struct_conf` (`HELX*`) and `_struct_sheet_range`, by author chain
(a copy `A-2` takes `A`'s) and number; a rough guess from the alpha carbons when the file has neither.

**colour.** `by`: `chain` (default: `chains[id]`, else the palette in chain order; nucleic chains `#d9ccb3`),
`domain` (`domains: [[chain or '*', from, to, '#hex', 'name'], ...]`, the first that matches; others `default`, else
their chain's colour), or `uniform` (`default` for all; a chain named in `chains` keeps its own). A rule for `A` covers
`A-2` unless `A-2` has its own. A residue's colour is per vertex in every look.

## index.json

`{ "v": 1, "models": [ { name, title, credit, file, fp, bytes, radius, size, residues, chains, looks, src } ] }` in
models.json's order. `fp`: the first 16 hex digits of the file's SHA-256; `radius` (Å): of the bounding sphere around
the box's middle; `size` (Å): the box's sides (x the longest when oriented); `looks`: `{ surface: [triangles at LOD 0,
1, 2], cartoon: [...], balls: true }`; `src`: a hash of the model's entry in models.json, its mmCIF file and build.py,
which `--check` and the incremental build compare.

## The .mol format (version 1)

Little-endian. Bytes 0-3 `MOL1`; 4-7 the version (uint32, 1); 8-11 the header's length n (uint32, a multiple of 4);
12 to 12+n the header, UTF-8 JSON (padded with spaces); then the data. Every array starts at a multiple of 4 bytes
into the data, at the offset the header gives (`o`: from 12 + n).

Header: `v`, `name`, `title`, `credit`, `chains` (ids, the residue table's chain index points here), `domains` (names,
for `dom`), `radius`, `size`, `centre` (the box's middle, Å, model frame), `frame` (`rot`: 3x3 row-major, `origin`:
model = rot (pdb - origin); identity and 0 when not oriented), `q` (`off`: [x, y, z], `scale`: positions are
`off + int16 * scale`, Å; one for every look and level), `res` and `looks`.

`res` (n residues, in chain order, then file order): `chain` uint8, `num` int32 (author number), `one` uint8 (the
one-letter code, ASCII; X unknown), `kind` uint8 (0 protein, 1 nucleic, 2 ligand), `ss` uint8 (0 coil, 1 helix,
2 strand), `dom` uint8 (domain index, 255 none), `pos` float32 x3 (the anchor, Å, model frame), `col` uint8 x4 (colour
and the ball's occlusion).

`looks.surface` and `looks.cartoon`: three levels, each `{ v, t, pos, nrm, col, res, idx, i32 }`: v vertices, t
triangles; `pos` int16 x3 per vertex (quantised as `q`), `nrm` int8 x2 (octahedral normal: x, y in -127..127), `col`
uint8 x4 (red, green, blue, ambient occlusion 0..255), `res` uint16 (the residue's index in `res`), `idx` 3t indices,
uint32 when `i32` (65,536 vertices or more) else uint16. Triangles wound counter-clockwise seen from outside.
`looks.balls`: `true` when built (drawn from `res`: no mesh in the file).

The same input gives the same bytes (on the same machine and library versions). A reader refuses a version above
its own.

## The runtime (tools/engine/e2_scene.js)

Parts: `MOLS molLoad molParse molMaterial molMesh molInstanced` (name all six on the `//#use` line; they need the kit,
`K`, and use `LV`, `GL` and `XR` where the story has them).

- `molLoad(urlOf, names)` starts fetching `<name>.mol` for each name not asked for before (`urlOf(file)` gives its
  address: `f => pkgUrl('models/' + f)` in a package). `molWait()` is true while any is loading.
  `molReady(urlOf, names)` calls molLoad and is true once those have come or failed: a set's `prep`, which `buildSet`
  runs as a load step again until it says true, without holding frames up. A file that fails logs a warning and its
  model draws nothing (`ok: false`).
- `MOLS.m[name]`: `{ head, res, geo }` once parsed (`head` the header; `res` the residue table as typed arrays plus
  `chains` and `domains`), `{ pend: true }` while loading, `{ err }` on failure.
- `molMesh(set, name, opts)` returns `{ group, ok, s, res, mat, levels, find, anchor, setHighlight, lod }`.
  opts: `look` (`'surface'` default, `'cartoon'`, `'balls'`), the size: `width` (scene units along the model's x, its
  longest axis when oriented; 1 by default), or `radius` (of its bounding sphere), or `scale` (scene units per Å),
  `lod` (`'auto'` default, or 0, 1, 2), `lodPx` (`[260, 70]`: the model's radius on screen in pixels above which
  LOD 0, then LOD 1, is drawn; a 12% margin keeps it from flickering), `centred` (true: the box's middle at the
  group's origin).
  - `s`: scene units per Å. `find(chain, num, after)`: a residue's index (the one before a number that is missing; the
    one after with `after`), -1 if none. `anchor(chain, num, v)`: its anchor in the group's frame (scene units), into
    `v` if given. `setHighlight(from, to, colour, strength)`: lights residues from..to (`'B:60'`, or a number in the
    first chain; `to` defaults to `from`) with a steady glow in `colour` (`'#ffd24d'` ...) at `strength` 0..1;
    `setHighlight(null)` turns it off. `lod()`: the level drawn.
  - One draw per look (the balls: one instanced draw); auto levels are a `THREE.LOD` whose choice is the model's
    radius on screen (the page's drawing buffer, or `XR.viewH` in a headset).
- `molInstanced(set, name, opts)` returns `{ mesh, s, setAt(i, pos, quat, k) }`: `opts.count` copies of one level
  (`lod`, 2 by default; `look`, `'surface'`) in one InstancedMesh; `setAt` places copy i (`THREE.Vector3`,
  `THREE.Quaternion`, its size k times the model's); `mesh.setColorAt(i, colour)` tints a copy (multiplied). Not
  culled (three.js r128 would cull it by the one model's bounds).
- `molMaterial(set, opts)`: the material all of them use (`opts.balls` for the instanced balls). Uniforms `uA` (the
  set's fade: see-through and no depth written only while under 1, as the kit's `fade` and `solid`), `uL` (the key
  light, `LV`), `uHi`, `uHiC`, `uHiK` (the highlight), `uTime`. Pushed onto `set.mats`.
- Geometry stays quantised on the graphics card (int16 positions, int8 normals, uint8 colours): the mesh's own scale
  and position turn positions back into Å, and its bounding sphere is right for culling and ray casting.
