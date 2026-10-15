# `int` - the interactome (sets/int.js)

A big, glowing human protein interaction network: a dense luminous centre, filaments and tufts towards the rim,
radius about 1. Many looks come from params. The set is built at load from embedded data plus a seeded synthetic
background. Nothing is random between loads.

- About 9,100 proteins and 22,100 interactions (`nodeCount`, `edgeCount`; quote these, not round numbers).
  - **Curated core**: the 254 proteins and 375 interactions of the network-medicine story (`coreCount`, `core`), in
    10 coloured modules at mid-radius. TP53's module (p53 & gene control) sits nearest the centre, and TP53 is the
    biggest curated hub.
  - **Background**: synthetic and anonymous. Degrees are heavy-tailed: 6,100 proteins have 1-5 partners and about
    10 hubs have 100-470. The background forms about 320 small neighbourhoods, with 30 global hubs near the centre and
    tufts and filaments towards the rim.
  - **ATP synthase**: 13 nodes with the 21 contacts from the shared facts, near the centre. They are laid out in 3D
    like the complex seen from the side: alpha and beta across the axis in the head with OSCP as its cap, the two
    assembly factors outside the head at different sides, gamma down the axis to delta and epsilon, the three c
    subunits on a ring around the axis at the bottom (120° apart), subunit a beside the ring and subunit b up the
    side behind. The layout has real depth, so it holds up when walked around in a headset.
  - **Inborn errors of immunity**: 173 nodes in the 19 molecular clusters, with the shared counts and colours, packed
    on one side so that all of them show from `cam.iei`.
  - **Disease modules** (illustrative, after Menche et al. 2015):
    - Multiple sclerosis: 30 nodes.
    - Rheumatoid arthritis: 30 nodes. It shares 8 nodes with multiple sclerosis, and the two modules lie next to each
      other.
    - Peroxisomal disorders: 15 nodes, on the far side.
  - **Rare disease**: one disease gene and its 2-hop neighbourhood (18 proteins). A drug target lies 2 hops away. Its
    own 2-hop "treatment" neighbourhood (13 proteins) overlaps the disease neighbourhood in 4 proteins. Both are
    star-shaped and face the `rare` view, with depth along the view axis.
  - **Patient** (slide 29): 3 seed genes in the NF-κB and chromatin cluster and 12 candidate genes. The seeds are
    picked by farthest-point sampling in the lower-left half of the cluster, so they stand 0.12-0.15 apart and can be
    counted as three. A random walk with restart (restart probability 0.3) runs from the seeds on the whole network.
    The causal gene is in the seeds' cluster and ranks 1st (`info.causalRank`; its heat is 0.91, the next candidate's
    0.33). The other candidates are 2 in other immunity clusters and 9 scattered in the background.

## Params (all 0..1, default in brackets)

| param | meaning | suggested keys |
| --- | --- | --- |
| `int_a` | fade | |
| `int_reveal` (1) | the network grows from the centre out, with a bright growth front | 0 to 1 over ~6 s at the start |
| `int_edges` (1) | interaction brightness | |
| `int_dim` (0) | dims everything that is not highlighted. Highlight looks already dim the rest on their own | |
| `int_path0..9` (0) | curated module k lights up in its own colour (no white wash-out): nodes flare, internal edges become ribbons with soft travelling pulses that keep the hue, and the rest dims to ~40%. A ribbon between two modules glows only while both are lit. In city mode the module's district glows in its colour too. Several can be on together. With more than 6 lit at once, the module names fade out | one after another, 1.5 s ramps; use `cam.paths` |
| `int_atp` (0) | the 13 ATP synthase nodes glow blue with their 21 contacts inside a faint blue bubble. The rest dims. On the map the complex gets a district of its own (radius 0.08) and its contacts thin to half width, so the 21 contacts stay readable from the map `atp` view | 0 to 1 when the atp set hands over |
| `int_flat` (0) | city morph: the network flattens onto a disc (radius 1.12) and stays together by neighbourhood. TP53's district is downtown, the sparse rim becomes the suburbs. The centre lands first. Interactions turn into warm streets and proteins into street lights | 0 to 1 over ~6 s |
| `int_build` (0) | lit buildings with windows rise on the 254 curated proteins. Height grows with the number of curated partners, so hubs are skyscrapers (TP53 is the tallest) | after `int_flat` is most of the way |
| `int_hub` (0) | centrality: hubs and essential curated proteins glow hot (amber to red) and grow, the rest cools to blue. Each interaction takes the colour of its bigger end, and the spokes of the ~10 hubs with 100+ partners brighten, so the top hubs burst out as amber-red starbursts (slides 18-19). In city mode the buildings glow too | |
| `int_hood` (0) | neighbourhoods: every node takes its district's colour (the 10 module colours plus a muted palette for the background), and buildings take their module colour | |
| `int_pins` (0) | two map pins (with a dark dot on each face of the head) drop and bounce: red on TP53, blue on MCL1, a non-essential protein with 2 curated partners at the map's rim (`info.pins`). On roofs in city mode. The `pinRed` / `pinBlue` anchors sit on the pin heads | 0 to 1 over ~2 s |
| `int_route` (0) | the shortest path between the pins lights up hop by hop as an orange route with stops: TP53 > CREBBP > a hub > MCL1, 3 steps (`info.routeLength`). It lies on the ground in city mode, in 3D otherwise | 0 to 1 over ~4 s |
| `int_dis` (0) | the 3 disease modules glow in their colours inside rim bubbles (domes on the map). MS and RA visibly overlap; peroxisomal disorders lie far away | |
| `int_rare` (0) | the rare disease: the red gene (big ring), its red 2-hop bubble, the drug target (teal ring) and its teal bubble overlapping the red one | |
| `int_iei` (0) | the 19 immunity clusters light up in their colours with rim bubbles. The names come in two steps: the 6 biggest (Complement, NF-κB, Cell death, RNA, Transcription factors, Steroid) at 0.5-0.8, the 4 smaller ones (Proteasome, Vesicular, TCR/BCR, Interleukin) at 0.85-1 | hold at 0.8 on narrow (phone) screens |
| `int_drugs` (0) | drug capsules fly in. 9 green-white "targeted" capsules dock one after another into the clusters (Complement, NF-κB, Interleukin, TCR/BCR, Cell death, Proteasome, Steroid, Transcription factors, RNA). 6 grey "unspecific" capsules drift through without docking. Only the targeted ones follow `int_drugs`; the drifting ones use `t`. With `int_flat` their paths morph onto the map: they come down from the sky into the cluster domes, and the drifting ones cross the patch low over the ground | 0 to 1 over ~8 s |
| `int_heat` (0) | network propagation: heat spreads out from the 3 white-hot seeds (crisp white discs) hop by hop, to its steady state. Nodes go red, amber, white; edges warm. The cold network stays a dim silhouette (so it does not vanish in AR). In city mode the towers go dark, their windows go out, and they glow with their own heat. 0 to 0.2 brings the look in; the front reaches the whole network at 1 | 0 to 1 over ~9 s |
| `int_cand` (0) | the 12 candidates show as rings (warmer rings get more heat). The causal gene gets a double gold ring and pulses | after the heat has spread |
| `int_spin` (0) | turns the network about y, in turns. Optional: the story turns the camera instead | |

Every param morphs smoothly and was checked at 0, 0.5 and 1. `update` is pure: the node test checks that the same
`S` and `t` give the same scene. Continuous motion uses `t`: node shimmer, pulses on ribbons, drifting capsules,
roof beacons. The explore fades of `select()` and `route()` also run on `t`: the call only notes the request, and
the fade starts at the `t` of the next frame (in explore mode the engine passes the wall clock as `t`). They restart
if `t` jumps back.

## Anchors

- `core`: the centre.
- `mod0`..`mod9`: module centroids. In city mode they sit at the district's mean roof height.
- `atp`: the ATP synthase centroid.
- `pinRed`, `pinBlue`: the pin heads (the bounce left out), so a label points at the pin. Without pins they are the
  proteins themselves (on the roof in city mode). During an explore route they follow the route's ends.
- `ms`, `ra`: the centroids of the genes that each module does not share, so their labels stay apart. On the map
  each moves to the far side of its own dome, away from the other module, so the two names never touch.
- `perox`: the peroxisomal module.
- `rare`: the disease gene. `treat`: the drug target.
- `iei0`..`iei18`: the immunity cluster centroids.
- `seed`: the 3 seeds' centroid. `causal`: the causal gene.
- `protein(sym)`, plus `'p:SYM'` for every curated and ATP synthase symbol. In city mode a curated protein's anchor
  is on its roof (TP53: 0.336 up), so story labels point at the top of the tower, not its foot.

All anchors follow `int_flat`, `int_build` and `int_spin`.

## Labels (the set's own)

- The 10 module names while their `int_pathK` > ~0.5. They fade out when more than 6 pathways are lit at once.
- Multiple sclerosis (ink stripe: there is no red label class, and magenta clashed with the red module), Rheumatoid
  arthritis (amber) and Peroxisomal disorders (cyan) when `int_dis` > 0.5.
- The 10 immunity clusters with 7 or more genes: the 6 with 15 or more at `int_iei` 0.5-0.8, the 4 smaller ones at
  0.85-1 (at most 6 names at `int_iei` 0.8). On the map the immunity patch is small, so as `int_flat` rises only the
  three biggest (Complement, NF-κB and chromatin, Cell death and survival) keep their names.

All of these wait for `int_reveal` to reach their group. The story's own labels already cover `atp`, `pinRed`,
`pinBlue`, `rare`, `treat`, `seed` and `causal`, so the set has no labels of its own there, to avoid doubles.

## Cam views

| view | value | what it shows |
| --- | --- | --- |
| `default` | `[25, 12, 3.6, 0, 0, 0]` | the whole network |
| `paths` | `[195, 15, 3.6, 0, 0, 0]` | **the pathways chapter.** 7 of the 10 modules face this side, including the four the opening chapter lights (Proteasome, Growth-factor signalling, TNF & cell death, DNA break repair). From `default` (az 25) most modules sit behind the dense core. **For the integrator:** `eng/e3_story.js` still uses `cam(a, 'int', 'default', -20, …)` for the intro's pathways (lines 218-219) and for the finale where all 10 light up (lines 384-385); switch those to `'paths'` |
| `atp` | `[25, 12, 1.3, …atp centroid]` | close on the ATP synthase cluster, face on |
| `city` | `[20, 35, 3.1, 0, -0.08, 0]` | low oblique over the map. Downtown and the blue pin both stay in view from az 20 to 120 |
| `dis` | `[125, 16, 3.2, 0, 0, 0]` | MS and RA on the left, peroxisomal disorders on the right. In city mode the az 90-120 views show the same layout |
| `rare` | `[110, 30, 1.45, …]` | between the gene and the drug target |
| `iei` | `[-40, 6, 2.3, …]` | all 19 clusters face on |
| `heat` | `[-40, 14, 2.9, …]` | seeds, causal gene and candidates |

`paths`, `atp`, `dis`, `rare`, `iei` and `heat` are getters. While the network lies flat (`int_flat` > 0.5) they
return a view over the same look on the map, from higher up (el 32-45), for example `iei` = `[-40, 40, 1.7, …]` on the
flat immunity patch. Explore flies to the view named like a chosen option, so City + Immunity now looks down on the
patch instead of skimming the map edge-on. The story reads its views once at load (flat 0), so it always gets the 3D
values in the table.

## Explore

- **View**: Network / City.
- **Colour**:
  - Pathways: all modules lit softly, and every 3.5 s the next one flares with its name.
  - Hubs.
  - Neighbourhoods.
  - Diseases.
  - Immunity: the clusters, then the drugs fly in.
  - Spread: the heat spreads over 7 s, then the candidates show.
- **Show**: Nothing / ATP synthase / Route / Rare disease. This is a third control, added so the remaining looks can
  be reached.

Exports for the explore search:

- `core` = `[{sym, name, role, module, essential, degree}]`, where `degree` counts curated partners.
- `partners(i)`: the indices of the curated proteins that bind curated protein i, biggest hubs first. Its length
  equals `degree`.
- `select(i)`: rings protein i and lights its partners (curated and background) as white ribbons; the rest dims.
  -1 clears.
- `route(i, j)`: the fewest steps over the whole network. Among equally short paths it takes the one that is
  shortest on the map. It returns `[{id, sym}]`, where `sym` is null for unnamed proteins, or null when there is no
  route or for `route(-1, -1)`. It is lit like the map route, with the pins on its ends.
- `pick(origin, dir)`: takes arrays or `THREE.Vector3`s in the set's local coordinates. In city mode a ray through a
  building picks that building. It returns -1 for a miss.

Also exported: `modules` (`name`, `colour`, `css`, `size`), `iei` (`name`, `short`, `colour`, `count`), `nodeCount`,
`edgeCount`, `coreCount`, and `info`. `info` holds the pins, the route length, the seeds, the candidates, the causal
rank, the sizes of the rare neighbourhoods, the shared MS/RA count, the maximum degree and the hub degrees.

## For the narrator

- **Say:**
  - "an illustrative map".
  - "in this map" for any statistic.
  - "the 254 named proteins come from the network-medicine story".
- **Do not say:**
  - That the background proteins, the disease modules, the rare disease, the patient, the candidates or the drugs are
    real data. They are illustrative.
  - That the 173 immunity genes sit where they do in the real interactome. Only the counts and cluster names come
    from Guthrie et al.
  - That MCL1 is unimportant. It was picked because it sits at the edge of this map and has few curated partners.
- The ATP synthase contacts are illustrative but plausible.
- Building heights and hub glow use the number of partners in this map.

## Sources

- The curated proteins, interactions, modules and essential flags come from the app's network-medicine story
  (`proteins.json`).
- Inborn errors of immunity: Guthrie et al., Science Advances 2023 (counts and clusters).
- Disease modules after Menche et al., Science 2015.
- Hubs and essentiality after Jeong et al., Nature 2001.
- The patient and the network propagation follow slide 29, after Buphamalai et al., Nature Communications 2021:
  a random walk with restart (restart 0.3) from the symptom genes, computed at load on this map.

## Performance (headless Chromium, SwiftShader)

| measure | value |
| --- | --- |
| build time | Chromium 210-320 ms at load ~1 on 4 CPUs (the first page of a fresh browser is the slowest); node cold 230-290 ms, warm 145-175 ms. Under load ~10 it was 200-840 ms |
| points | 9.7k |
| line segments | 22.1k |
| triangles | 2.4k at rest; up to 59k with every layer on (immunity bubbles and capsules) |
| draw calls | 5 at rest, 9 for the city with pins, 12 for the city with pins, route and disease domes, 14 with every layer on at once |
| per-frame buffer updates | the 25 bubble matrices only while bubbles show, and the 15 capsules only while drugs show. Selection and route buffers change only when called |

## Files

- `tools/gen_int.mjs` regenerates the embedded data block (`// <data>` … `// </data>`, about 16.6 KB) from
  `proteins.json`, including the module layouts and the ATP synthase layout.
- `tools/test_int.cjs` is the node test. It checks the data, the exports, the anchors, the labels, `pick`, `route`,
  `select`, `partners`, purity, the param sweep and the build time.
- `tools/int_explore.html` with `tools/shot_explore.mjs` renders `select`, `route` and `pick` in the browser.
- `tools/int_explore.html` takes `?lbl=pinRed,p:TP53` to draw extra labels on anchors (stand-ins for the story's
  labels), and runs on the wall clock with `anim=1`, as the engine's explore mode does.
- `tools/int_final.sh` re-shoots the final screenshots (small batches).
- Final screenshots are `shots/int-final-0..18.png`:
  - 0-3: rest, the reveal, four pathways from `cam.paths`, ATP synthase.
  - 4-7: the city mid-morph, hubs with pins, neighbourhoods with the route, diseases with the route.
  - 8-11: diseases in 3D, the rare disease, immunity with drugs, heat with candidates.
  - 12-13: explore `select(TP53)` and a route on the map.
  - 14-15: City + Immunity from the map `iei` view (capsules docked in the domes), City + Pathways (lit district).
  - 16-18: City + Spread (dark towers glowing with heat), hubs in 3D (starburst spokes), the three seeds close up.

## Review round 1: what changed

- **Ribbons**: both ends of a curated ribbon share one visibility (the module of each end is packed into `aR.y`), so a
  ribbon is a whole quad or hidden, never a corner flung off screen. Checked with near plane 0.1 at 0.45 units: no
  streaks. Ribbons are now double-sided (their winding flips with the view).
- **City anchors**: proteins, modules and pins are lifted to roof and pin-head height (see Anchors).
- **Capsules** follow `int_flat` (paths on the map), and the immunity names thin out on the map (see Labels).
- **ATP synthase and the rare disease** have real depth (generator layout and `gs()` depth of 0.04-0.045).
- **Pathways**: module colour without overdrive and with little white core; the rest dims to ~40%; new `cam.paths`;
  lit districts glow in city mode.
- **Route** lies flat on the ground as a road in city mode (side vector blends to the ground plane), camera-facing
  in 3D.
- **Labels**: MS and RA apart on the map; MS has the ink stripe.
- **Purity**: explore fades run on `t` (see Params).
- **Per-frame work**: bubbles are only rewritten while shown.
- Not changed: the immunity patch scale on the map (`IS` 0.45). Raising it to 0.6-0.7 moves the districts enough to
  change the blue pin (MCL1 to EIF4E) and the tuned city views, while it helps the labels less than thinning them.
- Not checked: anything on a real headset (comfort, controller picking, how the map reads at true scale).

## Review round 2: what changed

- **Ribbon pulses**: the sawtooth pulse (hard cut, burnt to white) is now a soft Gaussian that keeps the ribbon's hue
  (`0.75 + 0.8 * pulse`, alpha `0.75 + 0.35 * pulse`, depth cue capped at 1.1). Pulses run along the ribbon's current
  length, and the last 0.006 units at each end fade out inside the node sprites (`aX.w` carries the ribbon's length).
  Checked at `cam.atp`, at 0.45 and 0.25 units from the ATP cluster, on the rare disease up close, and on the immunity
  clusters: no hard-edged blocks.
- **Seeds**: farthest-point sampling (see Patient); the seed marker is 0.05 across with a crisp white core. The causal
  gene still ranks 1st.
- **Pins**: the dark dots sit on the head faces (z ±0.0262, flattened); pin and dots are one mesh per pin, so the pins
  cost 2 draw calls instead of 6.
- **Spread in the city**: per-building heat (`iHeat`: heat and hop distance, revealed with the same front as the
  nodes); towers go near-black and glow with their heat, windows off.
- **Hubs**: interactions take the colour of their bigger end and the top hubs' spokes brighten (`aE.w`).
- **Heat floor**: the cold network keeps 12% of its rest colour.
- **ATP synthase on the map**: district radius 0.045 to 0.08, contacts thinned to half width on the map. The city layout
  moved a little; the pins (TP53, MCL1), the 3-step route and every tuned city view were re-checked.
- **Immunity names**: staggered (see Labels).
- **Build time**: big districts now meet the small ones through the grid; the background grid is a typed array, the
  five nearest neighbourhoods come from one pass, the edge attributes are written without inner loops, and the
  pins share one merged geometry. All of these give the same network (checked by a checksum of positions, map and
  heat). The gain was about 5-10%: the old big-versus-all pass was not the slow part. I did not cut the city layout to
  30 iterations: that would move the districts and the tuned views for ~10 ms. Idle figures are in Performance.
- **Integration**: the `paths` note for `eng/e3_story.js` is in Cam views; I did not edit the engine (not my file).
- Not checked: anything on a real headset.
