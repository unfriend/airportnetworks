# The LBI story: 3D sets spec

We are adding a fourth story to the web app in `/home/user/airportnetworks` (read its `AGENTS.md` once for
context and conventions). The story, `stories/lbi.js`, turns a 43-slide institute presentation
("Welcome to the Ludwig Boltzmann Institute for Network Medicine", Jörg Menche, LBG visit 2026; PDF at
not in the repository; read it with the Read tool,
`pages` at most 20 per call, if you want to see your slides) into a narrated, about seven-minute 3D tour, followed by an
explore mode. It must run on desktop, phones and in VR/AR headsets (Meta Quest Browser, WebXR, stereo at 72-90 fps).

The story is built from **sets**: self-contained 3D scenes that the story engine fades in and out, flies the
camera around, and drives through numeric **params** keyed on a timeline. You are building one or more sets.
The story engine, panel text, timeline, camera paths, labels on screen, explore UI and headset code are written
separately by the integrator, using what your set exports. Be bold and beautiful: this is the showpiece of the
app. Prefer real 3D (depth, parallax, things moving through space) over flat diagrams. Illustrative is fine
where real data would be too much, but whatever the science says must be correct.

## Runtime and code rules

- three.js **r128** is the global `THREE` (vendored `three.min.js`; no examples/addons such as BufferGeometryUtils,
  OrbitControls, TextGeometry, post-processing). No other libraries, no network fetches, no ES modules.
- Style: 2-space indent, single quotes, semicolons, compact helpers, short comments that say why. Plain British English
  in any text. Deterministic: use `K.rng(seed)`, never `Math.random()`.
- Your file `sets/<name>.js` defines `SETS.<key> = function (K) { ... }` (one or more sets per file). It will be
  pasted inside the story's closure, so define nothing global besides the `SETS.<key>` assignments, and keep
  every helper inside the function.
- `K` is the shared kit in `kit.js` (read it; it is short). It gives `THREE`, `smooth`, `clamp`, `lerp`, `prog`,
  `rng`, `gauss`, `v3`, `unit`, `rgb`, `ramp`, shared uniforms `K.U` (`uPx`, `uTime`), materials `K.points`, `K.lines`,
  `K.rim`, `K.fade` (for built-in lit materials), `K.newSet`, geometry helpers `pointsGeo`, `linesGeo`, `tube`,
  `merge`, `paint`. Write custom `THREE.ShaderMaterial`s where you need them, but then: include `uA: set.uA` in the
  uniforms and multiply the final alpha by it, use `K.GLSL`'s `pointPx()` for point sizes (sizes in local units), and
  push the material into `set.mats`. Built-in materials (MeshStandardMaterial, MeshLambertMaterial, MeshBasicMaterial,
  LineBasicMaterial ...) are fine: register each with `K.fade(set, mat, baseOpacity)` so it fades with the set.
- Lighting in the scene (do not add your own lights): a `HemisphereLight(0xdde8ff, 0x1a2233, 0.85)` and a
  `DirectionalLight(0xffffff, 0.85)` that comes from over the viewer's left shoulder. Background is near-black blue
  `#040912` (in AR it is the real room, so do not rely on a black background for meaning; additive glow is fine).
- Coordinates: y is up. Your set is centred on the origin and, unless your spec says otherwise, fits inside a sphere of
  radius about 1.1. The camera orbits a target: camera views are `[az, el, dist, tx, ty, tz]` in degrees and local units:
  camera position = target + dist * (cos(el) sin(az), sin(el), cos(el) cos(az)); az 0 looks from +z towards -z; vertical
  field of view 32°; dist 3.6 frames the whole radius-1 set. Sets are seen from many angles and, in a headset, from
  very close: no fake 2D billboards that break when the view turns (point sprites are fine), no z-fighting.
- **Pure update**: `update(S, t, dt)` must make the scene a function of `S` (param values) and `t` (seconds) alone, so
  scrubbing the story to any moment shows the right picture. Caches are fine; accumulated state is not. Continuous
  motion (spinning rotors, flowing particles) uses `t`.
- Performance budget per set when fully shown: at most ~60k points, ~60k line segments, ~250k triangles, ~40 draw
  calls; use `InstancedMesh` or merged geometry for many objects. Do not rebuild big buffers every frame (updating a
  few hundred values is fine; `needsUpdate` on a big attribute every frame is not). No shadows, no render targets.
  Build time at load below ~400 ms in headless Chromium (software GL is slow, so the harness's frame time is not a
  guide to real speed; the build time is). Each set is built as a step of the load of its own (`buildSet`, then its
  shaders compiled, `warm`), and a headset draws the shell's loading scene only between steps, so keep a set's build
  short; a slow part can be built in slices instead (`idle` and `finish`, see `tools/nmd/SPEC.md`).
- Text inside the 3D scene: avoid it (labels are drawn by the engine, see `labels`). A small amount of canvas-texture
  text is allowed where the text is part of an object (a computer screen), but no paragraphs.

## What a set exports

```js
SETS.atp = function (K) {
  const { THREE } = K;
  const set = K.newSet('atp');            // set.group, set.uA, set.mats, set.fades, set.setAlpha(a)
  // ... build meshes into set.group ...
  return Object.assign(set, {
    params: { atp_a: 1, atp_build: 0 },   // every param this set reads, with its resting default; names start with '<key>_'
    update(S, t, dt) { },                // called every frame while S.atp_a > 0 (after setAlpha)
    anchors: { rotor: [0, 0.3, 0], head: () => [x, y, z] },   // named points (local coords) for labels and camera targets
    labels: [ { text: ['Bold part', 'rest of the label'], at: 'rotor', cls: 'cyn', alpha: S => K.prog(S.atp_build, 0.8, 1) } ],
    cam: { default: [20, 12, 3.6, 0, 0, 0], close: [...] },   // good views; 'default' is required
    controls: [ { key: 'view', label: 'Show', options: [['parts', 'Parts'], ['complex', 'Complex']] } ],
    explore(c) { return { atp_build: c.view === 'parts' ? 0 : 1 }; },  // control values -> param targets
  });
};
```

- `params`: `<key>_a` (the set's fade, 0..1) is applied by the engine through `set.setAlpha`; do not apply it yourself.
  Other params are 0..1 progress values unless said otherwise. With every param at its default (and `_a` 1) the set
  should show its calm "resting" look. The engine eases params smoothly, so each param must look good at in-between
  values (morphs, not jumps).
- `labels`: on-screen labels (HTML on desktop, sprites in the headset). `text` is `[bold, rest]`; `cls` one of
  `''`, `'mag'` (magenta), `'amb'` (amber), `'grn'` (green), `'cyn'` (cyan); `at` an anchor name, a point, or a
  function; `alpha(S)` when to show it (0..1). Keep labels few (at most ~6 visible at once) and short (bold 1-3 words,
  rest under ~30 characters). The engine also places its own story labels on your anchors, so expose anchors for
  everything a narrator might point at.
- `controls` / `explore(c)`: explore mode shows each control as a row of buttons; `c` holds the chosen value per
  control key plus `c.t` (seconds since the set was opened in explore mode, for set-specific timed effects). Return
  the param targets. 2-4 controls with 2-5 options each.
- `cam`: `default` frames the set; add named close-ups your spec asks for.

## Testing your set

Serve the repository root on port 8123 (`npx http-server -p 8123 -c-1 .`). The harness renders one set:
`http://127.0.0.1:8123/tools/lbi/harness.html?set=<key>&p=name:value,name:value&t=<seconds>&cam=az,el,dist,tx,ty,tz`
(labels drawn too; stats in the corner). Screenshots: from `tools/lbi` run
`node shot.mjs <key> "<query>|<query>" <prefix>` (writes `shots/<prefix>-<k>.png`, prints build time, draw calls,
triangles, points, lines and page errors; set PLAYWRIGHT_MODULE and CHROMIUM_PATH as for the smoke test). Keep
screenshots small and few: each image viewed costs tokens (see "Working economically" in AGENTS.md).
A 404 for favicon.ico is expected. There must be no other page errors or warnings.

Deliverables for each set: `sets/<file>.js`, and `sets/<file>.md` (short manifest: params with meaning and suggested
story keyframes, anchors, labels, cam views, controls, anything the narrator should say or must not say, sources).
Leave your final screenshots in `shots/` named `<key>-final-<k>.png`.

## Palette and look

Dark scene, luminous content. Story accents: cyan `#46d9ff`, magenta `#ff5ad9`, amber `#ffb43b`, green `#3ee08f`,
red `#ff5a4b`, ink `#e7eef8`, muted `#95a6bd`. The institute's colours are a deep blue `#1d5bbf` and teal `#14a3a3`
(use them for institute-themed sets). Protein structures in the AlphaFold style use the AlphaFold DB confidence colours:
very high `#0053d6`, confident `#65cbf3`, low `#ffdb13`, very low `#ff7d45`.

## Shared facts (use exactly)

ATP synthase components (slide 13-15, old gene symbols as on the slides, current HGNC symbol in brackets):
ATP5A1 (ATP5F1A, subunit alpha, 3 copies in the head), ATP5B (ATP5F1B, beta, 3 copies, makes ATP),
ATPAF1 and ATPAF2 (assembly factors: chaperones that help put the alpha3beta3 head together, then leave; ATPAF1 binds
beta, ATPAF2 binds alpha), ATP5C1 (ATP5F1C, gamma, the central shaft), ATP5D (ATP5F1D, delta), ATP5E (ATP5F1E,
epsilon; gamma, delta and epsilon form the central stalk, the foot of which sits on the c-ring), ATP5F1 (ATP5PB,
subunit b, the long peripheral stalk), ATP5O (ATP5PO, OSCP, caps the peripheral stalk on top of the head),
MT-ATP6 (subunit a, encoded in mitochondrial DNA; protons pass between it and the c-ring), ATP5G1, ATP5G2, ATP5G3
(ATP5MC1-3: three genes for the same mature subunit c; 8 copies form the c-ring in mammals).
Mechanism: protons flowing from the intermembrane space to the matrix through the a/c interface turn the c-ring and
the central stalk; each full turn takes 8 protons and makes 3 ATP (one per beta subunit, 120° per ATP); the head
(alpha3beta3) is held still by the peripheral stalk. It sits in the inner mitochondrial membrane, head in the matrix.
The 13-node network used in both the atp set and the int set (undirected contacts, illustrative but plausible):
```
ATP5A1-ATP5B ATP5A1-ATP5C1 ATP5B-ATP5C1 ATP5C1-ATP5D ATP5C1-ATP5E ATP5D-ATP5E ATP5C1-ATP5G1 ATP5E-ATP5G1
ATP5D-ATP5G2 ATP5G1-ATP5G2 ATP5G2-ATP5G3 ATP5G1-ATP5G3 ATP5G3-MT-ATP6 ATP5G2-MT-ATP6 MT-ATP6-ATP5F1
ATP5F1-ATP5O ATP5O-ATP5A1 ATP5O-ATP5B ATP5F1-ATP5A1 ATPAF1-ATP5B ATPAF2-ATP5A1
```
Inborn errors of immunity (slide 27, Guthrie et al., Science Advances 2023): 173 disease genes; 9 clinical categories
and 19 interactome clusters (molecular endotypes) with these counts, in this order:
clinical: Autoinflammatory disorders 40; Combined immunodeficiencies with associated or syndromic features 19;
Immunodeficiencies affecting cellular and humoral immunity 27; Phenocopies of inborn errors of immunity 4; Diseases of
immune dysregulation 33; Predominantly antibody deficiencies 10; Congenital defects of phagocyte number or function 9;
Defects in intrinsic and innate immunity 3; Complement deficiencies 28.
molecular: c23 1; RNA remodelling and nucleotide 19; Proteasome complex 8; Calcium 2; NF-κB and chromatin 22;
Regulation of cell death and survival 21; c4 3; Meiosis, antigen presentation 3; Vesicular traffic 9; Actin
regulation 5; Transcription factors, DNA binding complex 19; TCR and BCR 9; CD28 costimulation 4; Interleukin and
cytokine 7; Steroid resistant inflammation 15; c19 1; c9 1; Complement 23; c3 1.
Molecular cluster colours (use these everywhere): c23 `#8a8f98`, RNA `#9b6bd6`, Proteasome `#e0453a`, Calcium `#3fae5a`,
NF-κB `#2f9e44`, Cell death `#8c3b2e`, c4 `#6d7784`, Meiosis `#c84fd0`, Vesicular `#d9c63a`, Actin `#2d8fd6`,
TF `#7d6b5d`, TCR/BCR `#a855d8`, CD28 `#c73fa0`, Interleukin `#1f7ac2`, Steroid `#8a4b2a`, c19 `#5aa86c`,
c9 `#9aa4ad`, Complement `#d6303a`, c3 `#c0c4c9`. Clinical colours: Autoinflammatory `#4bb8d6`, Combined syndromic
`#f39a3c`, Cellular and humoral `#e3534c`, Phenocopies `#b07fd9`, Dysregulation `#43b6c6`, Antibody `#a2544f`,
Phagocyte `#8d8d8d`, Innate `#e2c64a`, Complement `#e0535b`.

---

## The sets

### `int` - the interactome (file `sets/int.js`)

The heart of the story: a big, glowing, spinning human protein interaction network (the "interactome"), used in
eight chapters. One set, many looks driven by params.

Data (build at load, deterministic):
- **Curated core**: the 254 proteins and 375 interactions of the app's network-medicine story, extracted to
  `data/proteins.json` (made by `data/extract_proteins.mjs`; fields documented in it; 10 named, coloured modules such as "Proteasome", "DNA break
  repair", "Growth-factor signalling", "TNF & cell death"; essential flags; two disease gene sets: breast cancer 16
  genes, Alzheimer's 6; drugs). Embed what you need in your set file as compact constants (write a small Node
  script that generates them; keep the embedded data under ~25 KB; symbols, names, module, essential, edges).
- **Background**: about 8,000 further proteins and about 22,000 interactions, synthetic: heavy-tailed degrees (a few
  hubs with hundreds of partners, most proteins with 1-5), modular (many small neighbourhoods), a dense core and a
  sparse rim, hubs towards the centre. The curated core is woven in (its modules are compact neighbourhoods at
  mid-radius, joined to background proteins). This must look like the classic interactome hairball (slides 16-23):
  dense luminous centre, filaments and tufts towards the edge, beautiful from any angle. Radius about 1.
- **ATP synthase**: 13 extra named nodes (see Shared facts) with the 21 contacts, near the centre, joined to the rest.
- **Inborn errors of immunity**: 173 nodes in the 19 molecular clusters with the counts and colours above (clusters of
  1-3 nodes are fine), spread over one side of the network so all are visible at once from one view (`cam.iei`).
- **Disease modules for the map chapter** (after Menche et al., Science 2015; illustrative, anonymous nodes):
  "Multiple sclerosis" (red `#ff5a4b`, about 30 nodes) and "Rheumatoid arthritis" (amber `#ffb43b`, about 30 nodes)
  that overlap (share about 8 nodes and are adjacent), and "Peroxisomal disorders" (blue `#4d94ff`, about 15 nodes)
  far from both.
- **A rare disease** (slide 24): one red disease gene with its network neighbourhood (radius 2 hops), and a separate
  "treatment" neighbourhood (teal) around the target of a drug, overlapping the disease neighbourhood partly.
- **A patient** for network propagation (slide 29): 3 seed genes from one IEI cluster (genes matching the patient's
  symptoms), and 12 candidate genes carrying the patient's rare variants; random walk with restart from the seeds
  ranks the candidates; the top one (in the same IEI cluster) is the causal gene. Compute the heat on all nodes at
  load (RWR, restart 0.3) and store per-node heat; propagation progress reveals it outwards by hop distance.

Looks (params; all 0..1 unless said):
- `int_a` fade. `int_reveal` the network grows from the centre outwards (0 nothing, 1 all). `int_edges` interaction
  brightness (default 1). `int_dim` dims everything not highlighted (focus).
- `int_path0` ... `int_path9`: light up curated module k ("pathways lighting up", slide 2): nodes take the module colour
  and flare; its internal edges glow with pulses travelling along them (use `t`). Several can be on at once.
- `int_atp`: the 13 ATP synthase nodes glow blue (`#4d94ff`) with their contacts, rest dims a little (slide 16).
- `int_flat` the city morph (slides 17-23: "the interactome as a map"): the 3D network flattens onto a horizontal disc
  (y ~ 0, radius ~1.1) keeping neighbourhoods together, like a map of a city: interactions become streets, background
  proteins become street lights, and `int_build` raises buildings (instanced boxes, lit) on the curated proteins, height
  by number of partners (hubs are skyscrapers). Both must morph smoothly from the 3D look.
- `int_hub` "centrality indicates importance": hubs and essential curated proteins glow hot (red/amber), the rest
  cools. `int_hood` "neighbourhoods related to function": every node takes its neighbourhood's colour (the 10 curated
  module colours plus a muted palette for background neighbourhoods), like districts on a map.
- `int_pins` two map pins drop onto two curated proteins (a red pin on a central hub such as TP53, a blue pin on a
  peripheral protein); `int_route` the shortest path between them lights up hop by hop like a route on a map (on the
  ground in city mode, in 3D otherwise).
- `int_dis` the three disease modules glow in their colours with soft rim domes/bubbles; the MS and RA modules visibly
  overlap, peroxisomal disorders sit far away (slide 23: "distance determines relatedness").
- `int_rare` the rare disease: red gene, red neighbourhood bubble, teal treatment bubble overlapping it (slides 24-25).
- `int_iei` the 19 IEI clusters light up in their colours with rim bubbles; `int_drugs` drug capsules (small lit
  capsules) fly in from outside: "targeted" ones (green) dock into specific clusters, "unspecific" ones (grey) drift
  through without docking (slide 28: drugs used in a cluster sit closer to it).
- `int_heat` network propagation: heat spreads from the 3 seeds (glowing white-hot) outwards by hop distance to its
  steady state (ramp black-red-amber-white on nodes, edges warm); `int_cand` the 12 candidates show as rings/flags,
  the causal gene glows brightest (rank 1).
Anchors: `core` (centre), `mod0`..`mod9`, `atp`, `pinRed`, `pinBlue`, `ms`, `ra`, `perox`, `rare`, `treat`, `iei0`..`iei18`,
`seed`, `causal`, plus `p:<SYMBOL>` for every curated protein via a function `anchors.protein(sym)`; also export
`modules` (names, colours), `iei` (names, colours, counts), and `nodeCount`, `edgeCount`, `coreCount` for the story text.
Labels: the module name at its centroid when its `int_pathK` is on; disease module names when `int_dis` > 0.5; IEI
cluster names (only the big ones, >= 7 genes) when `int_iei` > 0.5.
Cam views: `default` (whole network), `atp` (close on the ATP cluster), `city` (low oblique over the flat map, el ~35),
`dis`, `rare`, `iei`, `heat`.
Explore: controls View (Network / City), Colour (Pathways / Hubs / Neighbourhoods / Diseases / Immunity / Spread).
Also export, for the explore search: `core` = [{sym, name, role, module, essential, degree}], `select(i)` (ring the
curated protein i and light its partners; -1 clears), `route(i, j)` (shortest path between curated proteins i and j
over the whole network, lit like the map route; returns the list of node ids with curated symbols or null), and
`pick(origin, dir)` returning the curated protein index nearest a ray in local coordinates (or -1).

### `mac` - more than the sum of its parts (file `sets/mac.js`)

Slides 3-5: a Macintosh Classic next to Todd McLellan's teardown photo of all its parts, then the Apple I schematic.
Build an illustrative classic beige all-in-one computer (1990-style: tall box, small CRT with a glowing screen showing a
simple window on a light-grey desktop, floppy slot, separate keyboard and mouse). No brand marks or logos. Make it from
many real parts (instanced): shell halves, CRT tube and yoke, analogue board, logic board (green) with chips (black, with
pins), RAM sticks, resistors (striped), capacitors, crystal, power supply, speaker, floppy drive, fan, screws (lots),
springs, cables, keyboard base and every key cap, mouse shell and ball.
Params: `mac_a`; `mac_explode` 0 assembled, 1 every part laid out flat in neat rows on a pale table (the teardown
photo: parts sorted by kind and size; screws lined up), with a flying, slightly arcing motion in between;
`mac_wire` glowing wires of a circuit diagram connect the laid-out chips, resistors and capacitors, appearing one
after another (a netlist: each chip has several connections, a few long bus lines), like the schematic on slide 5;
`mac_net` the parts shrink and fade into glowing nodes while the wires stay: an abstract network remains (the bridge
to "networks are everywhere").
Anchors: `screen`, `board`, `chips`, `resistors`, `screws`, `keys`, `wires`. Labels when exploded: Screws,
Resistors, Chips ("transistors inside"), Keys. Cam: `default` (three-quarter view of the computer), `table` (above
the teardown, el ~55).
Explore: View (Computer / Taken apart / Wiring / Network).

### `web` - networks are everywhere (file `sets/web.js`)

Slides 6-7. Two looks in one set:
1. **The internet** (`web_net`): a map of the internet in 3D: a huge branching, radial, tree-like network (fractal
   tufts and long filaments, a few giant hubs), glowing yellow-white at the hubs, orange to deep red towards the leaves
   (slide 6), about 15k nodes, growing outwards as the param rises.
2. **Friendships around the world** (`web_globe`, `web_ties`): a dark globe (radius 1) with glowing city lights at the
   real locations of the 3,214 airports of the app's airport story (made by `data/extract_airports.mjs`:
   `airports_compact.txt` + `airports_decoder.js`, or `airports.json` for degree/IATA; embed the compact string, it is
   13 KB), and blue friendship ties: mostly short ties to nearby cities (most friendships are local), fewer long arcs
   between big cities, drawn as arcs above the surface, in the blue-white glow of the famous Facebook friendship map
   (Paul Butler, December 2010). Continents should read clearly through the density of lights and ties. Do not draw
   country borders or a texture map.
Params: `web_a`, `web_net`, `web_globe`, `web_ties`, `web_spin` (globe rotation in turns, story keyframes it).
Anchors: `hub` (biggest internet hub), `europe`, `americas`, `asia`. Cam: `net`, `globe` (Europe/Atlantic facing).
Explore: View (Internet / Friendships).

### `dna` - the basic building blocks of life (file `sets/dna.js`)

Slides 9-12: the human genome (23 chromosomes, 3 billion base pairs, about 20,000 genes), then AlphaFold structures for
the proteins they encode, and a zoom out over all of them.
Params: `dna_a`; `dna_helix` a long, slowly turning DNA double helix (two sugar-phosphate backbones as glossy tubes,
base pairs as rungs coloured by A-T and G-C), seen in perspective, with a stream of letters suggested by colour, not
text; `dna_chrom` the helix coils up into 23 condensed chromosomes (X shapes made of coiled fibre, sizes in proportion
to the real lengths of chromosomes 1-22 and X, chromosome 1 = 248 Mb, chromosome 21 = 47 Mb), arranged like a
karyotype; `dna_fold` 25 folded protein chains in a 5 x 5 grid, AlphaFold style (backbone tubes with helices and
strands and loops, coloured by confidence: mostly dark and light blue with yellow-orange floppy ends), slowly turning,
each different (seeded); the first three are SRP9, LENEP and GNG5 (anchors for their names; SRP9 a compact
alpha/beta fold, LENEP short and mostly disordered (orange/yellow), GNG5 a single helix with floppy ends);
`dna_field` zoom out: the 25 become a tiny patch in a field of about 20,000 proteins (instanced mini-structures near
the camera path, points further away), filling a huge volume, "there are really a lot of them".
Anchors: `helix`, `chrom1`, `chrom21`, `fold0` (SRP9), `fold1` (LENEP), `fold2` (GNG5), `grid`, `field`.
Cam: `helix` (along the helix), `chrom`, `fold` (the 5x5 grid fills the view), `field` (far out, dist ~12-20; the field
may extend well beyond radius 1 in this look only).
Explore: View (DNA / Chromosomes / Proteins / All proteins).

### `atp` - putting the pieces together (file `sets/atp.js`)

Slides 13-16 and the WEHI animation (D. Berry & F. Tétaz) "the complex in action". See Shared facts.
Params: `atp_a`; `atp_parts` the 13 components (one chain each, AlphaFold-like folded backbones as for `dna_fold`,
grey-teal like slide 13) float in a grid with room for name labels; `atp_colour` they take their group colours (slide
14: alpha/beta/gamma/delta/epsilon teal, ATPAF1/2 beige, ATP5F1 brown, ATP5O purple, MT-ATP6 dark brown, c subunits
pink); `atp_build` assembly: parts fly into place and grow into the assembled complex rendered as a molecular surface
(clusters of overlapping spheres, instanced; head = ring of 3 alpha (teal) and 3 beta (blue) around the gamma shaft,
central stalk, c-ring of 8 pink subunits in a membrane slab, subunit a beside it, the peripheral stalk b up the side to
OSCP on top). The assembly factors ATPAF1/2 dock onto beta/alpha during the build and then drift away. About 1.2 units
tall. A lipid membrane (two leaflets of points, or a thin translucent slab with lipid heads) at the c-ring;
`atp_turns` rotor angle in turns (the story ramps it, e.g. 0 to 4); `atp_flow` protons (small bright dots) stream in
through subunit a from the intermembrane side, ride the c-ring and leave into the matrix; ATP molecules (small glowing
amber dots) pop out of each beta subunit once per third of a turn (tie them to `atp_turns`, not to time);
`atp_net` the network view (slide 15): one node per component at its place in the complex, the 21 contacts as glowing
edges, the surface fades to a faint ghost; `atp_shrink` the network shrinks to a point at the centre and fades (hand-over
to the interactome).
Anchors: one per component symbol (`ATP5A1` ... `MT-ATP6`), `head`, `rotor`, `membrane`, `stalk`, `matrix`, `ims`.
Labels: component names in the parts grid; 'Rotor', 'Membrane', 'Head (makes ATP)' when built.
Cam: `parts`, `complex` (side view, slightly from below), `top`.
Explore: View (Parts / Complex / Running / Network).

### `scale` - networks across scales, and the institute (file `sets/scale.js`)

Slides 30-33 and 42. A tall 3D tower of length scales, a time axis, networks at four scales, medicine, the four research
groups and the team.
Params: `scale_a`; `scale_len` eight glowing floors appear from the bottom up (from DNA bases 1 nm to the body 1 m:
DNA bases, proteins, complexes, organelles, cells, tissues, organs, body; each floor a translucent disc with a small 3D
emblem of its scale: a bit of helix, a protein blob, a complex, a mitochondrion, a cell, a sheet of cells, a brain, a
human figure), floors spaced evenly (log scale); `scale_time` a spiral time axis winding up around the tower with marks
from a microsecond to a lifetime (electron transfer in cytochromes 1 µs, neurons firing 1 ms, enzyme turnover ~10 ms,
protein folding ~1 s, translating a protein ~1 min, protein half-life ~1 day, circadian clock 1 day, red blood cell
life span 4 months, human life span 80 years); `scale_net` small glowing networks at four floors with labels: protein-
protein interactions (proteins), signalling (cells), inter-organ communication (organs), contagion (body/people);
`scale_med` medicine: three icons/rings outside the tower (diagnosis, treatment, prevention: nutrition and lifestyle)
with arrows feeding into the top and the bottom floors; `scale_rg` the four research groups light up as glowing rings at
the scales they work on: RG1 "The geometry of molecular networks in health and disease" (proteins/complexes), RG2
"Intra- and inter-cellular networks" (cells/tissues), RG3 "Population-level analysis of disease patterns and treatment
outcome" (body/population), RG4 "The DataDiVR data exploration platform" (virtual reality, machine learning, AI; spans
all floors: a frame or helix around the whole tower); `scale_syn` synergy arcs between the groups (many glowing arcs
connecting the rings, slide 33); `scale_team` the tower dissolves into a constellation of 42 glowing people-nodes
(institute colours, four groups) joined by collaborations, slowly rotating.
Anchors: `floor0`..`floor7`, `time0`..`time8`, `rg1`..`rg4`, `med0`..`med2`, `top`, `bottom`, `team`.
Labels: floor names with their length (e.g. 'Proteins', '10 nm'); time marks; network kinds; group short names
(RG1 Molecular networks, RG2 Cellular networks, RG3 Population health, RG4 DataDiVR).
Cam: `tower` (whole tower), `low`, `high`, `team`. The tower may be up to ~2.4 units tall; centre it on the origin.
Explore: View (Scales / Groups / Team), Show (Time / Networks / Medicine as toggles: options on/off per control).

### `body` - whole-body networks (file `sets/body.js`)

Slides 34-35: total-body PET scans (Reed et al., NeuroImage 2023; Geist et al., Med 2025) and organ networks.
Params: `body_a`; `body_pet` a standing human figure (arms raised, hands above the head, as in the scans) made of a dense
glowing point cloud in a PET "hot iron" colour map (dark red tissue, orange organs, white-hot brain, heart, kidneys,
bladder; liver and spleen medium; faint skeleton and muscles), translucent like a maximum-intensity projection,
radius about 1 (1.9 units tall); `body_net` an organ network: glowing nodes at about 12 organs (brain, thyroid, heart,
lungs, liver, spleen, stomach, pancreas, kidneys, intestine, bladder, bone marrow) joined by white bands whose width is
the strength of the link; `body_state` 0 healthy network, 1 disease network (different, sparser and rewired links,
slide 35), morphing between them.
Anchors: one per organ, `head`, `feet`. Labels: organ names when `body_net` > 0.5. Cam: `front`, `side`, `net`.
Explore: View (Scan / Network), State (Healthy / Disease).

### `tissue` - from tissue to cells (file `sets/tissue.js`)

Slides 36-41 (Rendeiro et al., Nature 2021; Abila et al., Nature Medicine 2026): an H&E-stained section of stomach wall,
zooming in to cells, a network of neighbouring cells, multiplexed imaging and samples compared in a low-dimensional
space.
Params: `tissue_a`; base look: a thin, gently curved slab (section) about 2 units long, in H&E colours (purple mucosa
with glands along the top edge, pale pink loose submucosa with round vessels, deeper pink muscle layers with striations),
made of cells (pink cytoplasm, purple nuclei) dense enough to hold up when the camera zooms into a patch near the
mucosa/submucosa boundary (cam `zoom`, dist ~0.25); `tissue_graph` a neighbourhood network: thin dark lines join each
nucleus to its nearest neighbours (Delaunay-like, slide 40) in the zoomed region, drawing outwards; `tissue_mark`
multiplexed imaging: the colours switch to a dark-field fluorescence look with cells coloured by type (epithelial
yellow, immune red, stromal green, endothelial magenta, smooth muscle blue); `tissue_embed` cells (or 300 sampled
"regions") lift off the slab into a 3D scatter (a low-dimensional embedding), forming coloured groups, with a few
glowing loading arrows from the origin (slide 41).
Anchors: `mucosa`, `submucosa`, `muscle`, `vessel`, `zoom`, `embed`. Cam: `section` (whole slab), `zoom`, `embed`.
Explore: View (Tissue / Cell network / Markers / Embedding).

### `crowd` and `sankey` - rare diseases (file `sets/clinic.js`)

Slides 24-27.
`crowd`: a crowd of about 400 simple stylised people (instanced: rounded body + head, like the icons on slide 24), in
grey, standing on a dark floor in a gentle arc; `crowd_red` one person (anchor `red`) turns red and glows, the others dim;
`crowd_grow` the crowd extends far into the distance (more rows appear, "6,000 rare diseases"). Cam `default`, `close`.
`sankey`: a 3D Sankey diagram, slide 27: left, 9 clinical categories as stacked blocks; right, 19 molecular clusters;
between them ribbons (smooth bent bands with a little thickness) whose widths are gene counts, coloured by clinical
category; the whole thing standing in space with depth (stagger the ribbons in z so they read in 3D).
Make up a plausible 9 x 19 gene-count matrix whose row sums and column sums match the counts in Shared facts exactly
(for example complement deficiencies flow mostly to the Complement cluster; autoinflammatory disorders to steroid-
resistant inflammation, NF-κB, proteasome and RNA/nucleotide clusters; immune dysregulation to cell death, vesicular
traffic and transcription factors; antibody deficiencies to NF-κB and TCR/BCR); state in the manifest that the flows
are illustrative and only the totals come from the paper. Params: `sankey_a`, `sankey_left`, `sankey_right`,
`sankey_flow` (ribbons sweep across), `sankey_hi` (0 none, k = 1..9 highlight clinical category k and its ribbons).
Anchors: `left0`..`left8`, `right0`..`right18`, `mid`. Labels: every block's name with its count (short forms allowed,
e.g. 'Autoinflammatory 40'), shown when its side is in. Cam: `default` (front, slightly oblique).
Explore: sankey: Highlight (None and the nine categories, short names); crowd: none (return {}).
