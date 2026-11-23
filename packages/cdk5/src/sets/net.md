# `net` - the interactome in the authors' six arrangements (sets/net.js)

The 16,376 proteins of the human interactome as glowing points that flow from one of the authors' arrangements to the
next (the CDK5_analytics VR project's six scenes: the map of processes, the activators, Signalling by NTRK2, calpain,
the Alzheimer's pathway, the disease landscape), each scene's links cross-fading with their ends following the moving
points, and the story's highlights. Adapted from the soil story's `net` set (its point shader, glow, twinkle, depth
cue, picking, labels, links with per-vertex colour), rebuilt round `CDATA`. Shares its frame with `core`
(`FRAME = { core: 'net' }`): the map of processes is a sphere of radius about 1 round the origin.

- **Data** (all `CDK5_DATA` through `CDATA`, nothing decoded here, nothing computed beyond drawing): every scene's
  places (`CDATA.layout(k)`), colours (`CDATA.colours(k)`, RGBA as the authors' textures hold them), centre proteins
  (`scene(k).centre`) and links by class (`scene(k).links`, each with its colour); CDK5's partners (`nb`), the CDK family
  and its angles, the activators' angles, the hub, the counts (`facts`); the pathways' members; the 88 terms' proteins;
  the 30 nearest and `nearTop` (`diseases`). Every number in a tag is read from there.
- **The move** (`net_scene` 0..5, eased by the engine): the pair of scenes round it (a = floor, b = a + 1; 5 is the end of
  the pair 4..5) and the fraction f between them. Each protein moves after its own delay, at most a third of the move
  (`D = 1/3`; its own progress e = smoothstep((f - delay) * 1.5)), so the map flows rather than jumps; the delay is a
  function of the protein and the pair only, so seeking works. Delays: 0..1, 1..2, 2..3 seeded at random; 3..4 (the map
  recoloured by disease) a wave over the sphere from CDK5's side; 4..5 (the sphere opening into the landscape) from the
  front (the default view's direction) backwards. Paths: a straight line with a sideways bow about the vertical (all
  bows turn the same way: a swirl); on 4..5 also a **peel**: the front of the sphere moves away from the line of sight as
  it goes, so a window opens towards the viewer and the landscape gathers inside, then everything settles (the grey
  proteins out to the landscape's walls, the ones with a disease into its bulk). Colours mix with each protein's own
  progress. Worked out on the graphics card from the pair's places (refilled only when the pair changes: about 1 ms);
  the same function on the CPU (`placeAt`) for anchors, halos, rings, arcs and picking, so they sit on the points.
- **Links**: the pair's two sets in one `LineSegments` with per-vertex colour (the class's RGBA), the ends moving with
  their proteins. A link in both scenes in the same colour stays; one only in the first fades as either end leaves;
  one only in the second appears once both ends have nearly arrived (so nothing is drawn between flying ends). Alpha
  the class's alpha × 0.32 (the map's 3,964 green links otherwise drown the points). Links among the current scene's
  centre proteins step aside with `net_core` (the core set draws them as tubes).
- **Points**: additive glowing discs (the soil set's fragment shader). The authors' alpha (100, 90, 80, 50 of 255, their
  highlights 200 to 240) becomes brightness (0.36 + 1.25 × alpha) and a little size (0.011 + 0.016 × alpha, + up to
  0.007 by degree, highlights × 1.35), so the grey proteins are faint but there. Those with a GO process twinkle a little
  (`t`). The landscape's points are 42 % smaller (its bulk is dense). No point is ever more than about 1.1 degrees across
  (close views and a headset at arm's length), and points within about 0.15 of the eye fade (no pops when standing
  inside). Depth cue: brighter in front of the map's centre, darker behind (off near the centre, so standing inside is
  even).
- **The knots of the map** (`net_clouds`): the process names come from a **current GO release** (`CDATA.go`: releases
  2026-07-26), not from the authors' own GO matrix (not in their repository). Today's GO shows the map's big dense clouds
  mixing many processes, so the honest picture is small labelled knots (4 to 10 proteins each) where one process gathers,
  not labels on the big clouds: say so wherever the tags show ("a few spots where one process gathers").
- **The veil** (`net_veil`): worked out in each view's own space, so it follows the engine's camera and each eye of a
  headset by itself: the points and lines in front of the map's centre, inside a cone round the line of sight to the
  centre (0.62 wide at the centre's depth, fading out to 1.7 times that), fade to 6 %. `api().eye(x, y, z)` is kept (the
  engine may call it every frame) and used on the CPU: picking skips veiled points, CDK5's halo and the rings keep a
  steady size on screen, back-facing tags hide. The set also takes the eye from the camera that draws it each frame
  (`onBeforeRender`), so it is right in the harness too.

## Params (the engine eases them; step params are integers, never eased)

| param | meaning | story |
| --- | --- | --- |
| `net_a` | fade | |
| `net_scene` | 0..5: the authors' scene (0 map of processes, 1 activators, 2 NTRK2, 3 calpain, 4 Alzheimer's, 5 disease landscape); eased between integers | 0, then 0 → 1 (ch. 3), 1 → 2 (ch. 4), 2 → 3 (ch. 5), 3 → 4 (ch. 6), 4 → 5 over 6 to 9 s (ch. 7) |
| `net_grow` | the map grows from the centre (each protein by its radius and a seeded share), the links after (from 0.7); default 1 | 0 → 1 over about 6 s (ch. 1) |
| `net_shell` | the outer shell (proteins without a known process) on the sphere: 1 shown, 0 faint (18 %); default 1 | explore |
| `net_links` | the scene's links on or off; default 1 | explore |
| `net_cdk5` | CDK5 findable: its point in its state's colour, a halo (pulsing slowly), a ring facing the eye, its tag | 0 → 1 (ch. 1), then 1 |
| `net_hyper` | CDK5's state colour: green `CLOOK.C.cdk5` → red `CLOOK.C.hyper` (pulse faster); its tag gains "hyperactive" past 0.5 | 0 → 1 (ch. 5) |
| `net_partners` | lines shoot from CDK5 to its 205 partners (each at its own moment, pale green: `C.partner` mixed 45 % with CDK5's state colour), the partners brighten; tag "205 partners" | ch. 2, ch. 7 |
| `net_pick` | step: -1, or a protein index: its ring (cyan), halo, tag "SYMBOL · n partners", its partners' lines in `C.pick` (alpha by degree) and the partners in `C.partner`; the rest steps back a little | story: -1; explore |
| `net_family` | the CDK family lights (pale lime halos); tags: "Its cousins · kinases of cell division" above the crowd within 5° of CDK5 and "CDK2, 3, 4, 6, 7, 8, 9 · within 5° of it" below it, "CDK1 · 73° away", and the other cousins' names (minor, only while on the side facing the eye) | ch. 2 (view `cdk5`) |
| `net_homes` | p35 and p39 light where they are, with great-circle arcs from CDK5 drawn out over the sphere; tags "p35 · 99 degrees away", "p39 · 172 degrees away" (", round the back" and moved onto its arc when the protein is on the far side from the eye) | ch. 3, before 0 → 1 |
| `net_path` | step: -1, 0 Signalling by NTRK2 (cyan), 1 the Alzheimer's pathway (orange): its members brighten wherever they are, with small halos | explore (and ch. 4, 6 if wanted) |
| `net_term` | step: -1, or an index into `CDATA.terms` | explore |
| `net_termA` | the term's proteins light magenta (`C.term`), the rest steps back to half; tag "name · n proteins" at its member nearest the middle | explore |
| `net_near` | CDK5's 30 nearest in the landscape light (amber halos); tag "27 of its 30 nearest · share its brain-development terms" (`nearTop[0].k`) above them, and "YWHAE, ACTB, TUBA1A · among them" (the three best linked) below | ch. 7 (view `landCdk5`) |
| `net_hub` | APP lights; tag "APP · 2,123 partners" | ch. 2 |
| `net_veil` | the points between the eye and the centre fade (above) | ch. 3 to 6 while the core shows |
| `net_core` | the current scene's centre proteins' own points and their links among each other fade (the core set draws them) | with `core_scene` |
| `net_dim` | everything not highlighted dims (to 12 %); links to 15 % | with the partners, a term, a pathway, the near ones |
| `net_shells` | tags "13,003 with a known process" (inner shell) and "3,373 without" (outer shell) | ch. 1 |
| `net_clouds` | the map of processes' knots (`CDATA.clouds`, 14): each knot's proteins brighter and a little larger in the scene's own colours (no new hue), a soft glow at its centre in their mean colour, and a tag at its `centre`: a short name (a small map in the set for the long GO names, e.g. "Sugar import", "Glutamate synapses"; else the name, cut at 30 characters) and " · 7 of 15 here" (the GO name in explore, not on the tag: it ran off narrow screens). Only knots facing the eye are tagged, at most six, the most squarely facing first, none within 24° of one shown (tags run to the right). Scene 0 only: they fade as `net_scene` leaves 0 (gone by 0.35) | ch. 1 if wanted; explore |
| `net_landTags` | tags "Proteins with a disease · 6,538" (the bulk's top) and "None known · pushed to the walls" | ch. 7 |

## Anchors, labels, views

- Anchors (functions follow the moving points): `centre` [0, 0, 0], `top` [0, 1.32, 0], `cdk5`, `p35`, `p39`, `capn1`,
  `app`, `near` (the 30 near ones' middle), `pick` (the picked protein, else CDK5), `term` (the term's member nearest its
  proteins' middle, in the current layout), and the tags' own: `partners` (just over CDK5, steady on screen), `famNear`, `famList`
  (above and below the cousins' crowd, steady on screen), `fam_<CDKn>` (each cousin), `p35tag`, `p39tag` (on the
  protein, or on its arc when it is round the back), `nearTag`, `nearNames`, `clouds` (the middle of the knots facing the default view), `cloud(i)` (a function: knot i's
  centre) and `cloud0..cloud13` (the knots' tags), `shellIn`, `shellOut` (a protein on each
  shell, front right), `landDis`, `landWall`.
- Labels: as in the params table; at most about six at once in any chapter as the SPEC keys them. Every number from
  `CDATA` (`facts`, `diseases`, the terms). Minor (give way on narrow screens): the cousins' list, the far cousins'
  names but CDK1, the near ones' names.
- Views (from the data: CDK5's direction on the sphere is az -31°, el 16°): `default` (the whole sphere from the front,
  CDK5's side, 14° above), `side`, `cdk5` (1.3 from CDK5 on the sphere, its cousins round it), `centre` (1.85 from the
  centre: the core, about 0.85 across, fills the view through the veil), `inside` (the camera at the origin looking out
  at CDK5's side), `land` (the whole landscape: its bulk and walls), `landCore` (the landscape's bulk), `landCdk5`
  (0.55 from CDK5 in the landscape, seen from its own side of the bulk, the near ones round it).
- **The landscape's frame**: `CDATA.layout('disease')` centres the box of the proteins with a disease on the origin; their
  bulk (the mean, most within 0.4 of it) sits at about (0, 0.16, 0.34), and the proteins without a disease lie on a
  sphere of radius 1.2 round that mean (the authors' walls; not cube faces). The landscape views target the bulk.

## Explore and api()

- Controls: `links` (On, Off), `shell` (Shown, Faint) and `clouds` (label Processes: Shown, Hidden; marked `scenes: [0]`,
  for the engine to offer on the map of processes only); `explore(c)` gives `net_links`, `net_shell` and `net_clouds`. The scene, the
  pick, the term and the pathway are the engine's (step params).
- `api()` (one object, the same every call):
  - `pick(rc)`: rc a `THREE.Raycaster`, a `THREE.Ray` or `{ origin, direction }` (vectors or arrays), **in world
    coordinates**; the protein nearest the ray within about 0.7° that is shown (grown in, not veiled, not handed to
    the core), preferring nearer ones; -1 none. Brute force over 16,376 places: about 4 ms in headless Chromium.
  - `pos(i, out)`: protein i's place now in the set's frame (into `out`, else a new array).
  - `eye(x, y, z)`: the camera's or the head's place in the set's frame.
  - `scene()`: the eased scene now (0..5).
  - `term(i, out)`: term i's middle now (the current term without i).
  - `n`: 16,376.

## Cost (headless Chromium, software GL)

- Build 60 to 125 ms (the six layouts and colours from `CDATA`, the five moves' link lists, the buffers).
- Draw calls: 2 at rest (points, links); +1 CDK5's halo and ring each (halos and rings are one pool each: 2), +1 the
  partners' lines (only while `net_partners` or a pick shows), +1 the arcs (while `net_homes`): at most 6.
- Points 16,376 (+ up to 92 halos); lines: the pair's links (at most 4,041), + 205 partners' lines, + a pick's (up to
  2,123), + 96 arc segments; triangles 640 per ring (at most 2).
- `update`: about 0.08 ms a frame with everything on and the scene moving (uniforms, ~80 halos placed, two rings, the
  arcs); no allocation per frame. A new pair of scenes refills the points (5 attributes) and the links (about 1 ms); a
  pick or a term refills one attribute of 16,376 pairs; a pick also the partners' lines.

## Untested

Everything in a headset: the veil following the head, the point-size cap and the near-eye fade at arm's length and when
standing inside, how the 4..5 move reads life size, the rings and halos' sizes. Only seen in headless Chromium.
