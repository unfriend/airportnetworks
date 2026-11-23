# `scale`: networks across scales, and the institute

File `sets/scale.js` (slides 30-33 and 42). This is a glowing tower of eight length scales, about 2.45 units tall and centred on the origin. Each floor is a holographic disc (concentric rings, a slow radar sweep and a glowing rim) with a small, slowly turning, lit 3D emblem on it. A glassy shell encloses the tower and motes drift up inside it.

From the bottom up, the floors and emblems are:

1. DNA bases, 1 nm: a short right-handed B-DNA double helix with A-T and G-C rungs, in the dna set's base colours (A green, T red, G amber, C blue).
2. Proteins, 10 nm: an AlphaFold-style four-helix bundle in dark and light blue, with yellow and orange floppy ends. All four alpha helices are right-handed.
3. Complexes, 100 nm: ATP synthase as in the earlier chapter, with its c-ring, central stalk, alpha3beta3 head, peripheral stalk and OSCP.
4. Organelles, 1 µm: a mitochondrion. The outer membrane is a glassy capsule. Inside it, the inner membrane is cut open lengthwise, textbook style: a half shell whose folds (cristae) reach in from alternating sides.
5. Cells, 10 µm: a nucleus, mitochondria, Golgi and vesicles inside a glassy membrane.
6. Tissues, 1 mm: a curved sheet of hexagonal columnar cells with nuclei.
7. Organs, 10 cm: a brain with folded hemispheres, cerebellum and brainstem.
8. Body, 1 m: a stylised human figure.

## Params (all 0..1; resting look = defaults)

| param | default | meaning | suggested story keys (as in eng/e3_story.js) |
| --- | --- | --- | --- |
| `scale_a` | 1 | set fade (engine) | in at scales.a-0.5; out at lbi.b; in again for the team |
| `scale_len` | **1** | the floors appear from the bottom up. Each disc spreads out from its centre with a bright wavefront, its rim draws round, its emblem pops up and the shell rises with them. Floor k occupies 0.11k..0.11k+0.23 | scales.a → a+9: 0 → 1 |
| `scale_time` | 0 | an amber spiral time axis (1.75 turns, log10 seconds from 1 µs at the bottom to 80 years at the top) grows up around the tower with a bright head. Decade ticks and nine marked events appear as it passes them; sparks flow upwards along it. It starts on the left (seen from az ~25) and the 1 ms - 1 s marks face right | a+9 → a+15, framed with `time` (see Cam views) |
| `scale_net` | 0 | small glowing networks grow out from a hub at four floors, one after another: protein-protein interactions (cyan, proteins floor), signalling (green, cells, pulses running outwards), inter-organ communication (magenta, organs, pulses both ways) and contagion (amber, body: an infection, shown in red, spreads hop by hop in a 7 s loop). Their floors glow in the network colour | a+15 → a+22 |
| `scale_med` | 0 | a medicine column beside the tower: three glassy green bubbles holding 3D icons (a clipboard with a tick for diagnosis, a pill bottle and capsule for treatment, an apple for prevention). Arrows draw up into the top floor and down into the bottom floor, with pulses running in | a+24 → a+29 |
| `scale_rg` | 0 | the four research groups light up one after another. RG1 is a cyan band around the proteins and complexes floors, RG2 a green band around cells and tissues, RG3 an amber band around the body floor and above it (population). RG4 is a magenta lattice of crossing helices around the whole tower, with data flowing up | lbi.a+2 → a+10 (time, net and med go to 0 over lbi.a → a+2) |
| `scale_syn` | 0 | synergy arcs: 22 nested arcs between the group bands, drawn one after another. Each arc is coloured from one group's colour to the other's and carries pulses. They fan out on one side of the tower, like slide 33 | lbi.a+13 → a+21 |
| `scale_team` | 0 | the tower dissolves into dust and fades by team 0.55. 42 glowing people (four groups in institute blues and teals, with warm heads, the four leads a little larger) appear on the floors of their group's scales and fly out on arcs into a constellation that turns slowly (0.07 rad/s). Each collaboration draws in once both of its people have landed (between team 0.49 and 0.985): blue links inside groups, and warm gold arcs between groups with sparks running both ways, in warm stardust | mission.a-0.5 → a+3 |

`scale_team` also works with `scale_len` 0 (the story's mission chapter). The people then gather from near the centre, not from the floors, and there is no dust.

Each param morphs smoothly. Every look was checked at 0, 0.5 and 1. When the set is fully shown, the most it draws is 18 draw calls, about 98k triangles, 2.7k points and no line segments. Build time in headless Chromium was 150-360 ms, measured while other agents were running (load average 10-20 on 4 CPUs). In Node, the best warm build is about 140 ms at that load; the emblems take about 40% of it. There are no page errors apart from the expected favicon 404. `tools/scale/bench.cjs` checks build time, purity of `update()` (same S and t after different histories give the same visible buffers), NaN and the label count; `tools/scale/prof.cjs` times each section.

## Anchors

- `floor0`..`floor7`: the rim of each floor, on the right as seen from azimuth ~10° (the tower, low and high views).
- Floor, network, medicine and group anchors sit at fixed azimuths (10°, 50°, 50° and 100°), chosen for the story's spins. In free orbit in explore mode, seen from the far side, their labels sit over the tower. The time anchors follow the spiral, so some of them are always on the left.
- `time0`..`time8`: just outside each marked event on the spiral.
- `net0`..`net3`: the rim of the proteins, cells, organs and body floors, on the right as seen from azimuth ~50°. These are extra anchors for the network labels.
- `med0`..`med2`: beside the diagnosis, treatment and prevention bubbles.
- `rg1`..`rg4`: on each band, on the right as seen from azimuth ~100° (the lbi chapter turns from 75° to 125°).
- `top`: above the human figure. `bottom`: below the DNA floor. `team`: the centre of the constellation.
- `team1`..`team4`: group centres of the constellation. These are extra function anchors that follow its rotation.

## Labels (set labels; they hand over so that only one layer is labelled at a time)

- Floors (`cyn`): 'DNA bases 1 nm', 'Proteins 10 nm', 'Complexes 100 nm', 'Organelles 1 µm', 'Cells 10 µm', 'Tissues 1 mm', 'Organs 10 cm', 'Body 1 m'. Each appears with its floor and hides when any of time, networks, medicine, groups or team is on. They form a neat column on the right.
- Hand-over: a layer's labels fade out over the first 10% of the next layer's param (before the next layer's first label is in), so only one layer is labelled at a time, apart from a short cross-fade. At the lbi chapter's hand-over (time, networks and medicine fall to 0, then groups rise), the floor labels come back for about two seconds before the group labels replace them.
- Time (`amb`): 'Electron transfer 1 µs, in cytochromes', 'Neurons fire 1 ms', 'Enzyme turnover ~10 ms', 'Protein folding ~1 s', 'Protein translation ~1 min', 'Protein half-life hours to days', 'Circadian clock 1 day', 'Red blood cell life span 4 months', 'Human life span 80 years'. Each appears as the spiral head reaches it (the last is fully in at scale_time 1). At most six show at once: as each new mark appears, the one six marks below it fades. At scale_time 1 the six top marks (1 s to 80 years) are labelled. They hide when networks, medicine, groups or team come on. Half-life and circadian clock are close in height and both on the front-left, so the engine's overlap nudging has to separate them.
- Networks: 'Protein-protein interactions' (`cyn`), 'Signalling between cells' (`grn`), 'Inter-organ communication' (`mag`), 'Contagion from person to person' (`amb`). Each appears as its network is about half grown, and they hide when medicine, groups or team come on.
- Medicine (`grn`): 'Diagnosis', 'Treatment', 'Prevention nutrition and lifestyle'. They hide with groups or team.
- Groups: 'RG1 Molecular networks' (`cyn`), 'RG2 Cellular networks' (`grn`), 'RG3 Population health' (`amb`), 'RG4 DataDiVR' (`mag`). They hide with team.

## Cam views

| name | value | purpose |
| --- | --- | --- |
| `default` = `tower` | [15, 18, 5.4, 0, 0.02, 0] | the whole tower, from a little above so that every floor reads as a disc |
| `low` | [-8, 3, 2.7, 0, -0.6, 0] | the lowest floors, nearly level |
| `time` | [20, 16, 5.3, 0, 0, 0] | the whole time spiral, from its start at the bottom to the top. Use it (or `tower`) while scale_time ramps |
| `high` | [12, 24, 3.0, 0, 0.42, 0] | the upper floors from above. It crops the lower third, so use it for the spiral only once the head is above the middle (scale_time > 0.5) |
| `groups` | [100, 18, 5.4, 0, 0.02, 0] | the explore Groups view: labels on the right, synergy fan on the left |
| `team` | [0, 12, 3.1, 0, 0, 0] | the constellation |

Label sides assume the story's spins: the scales chapter turns from about -28° to 65°, and the lbi chapter from 75° to 125°. Far larger turns will put some labels over the tower.

## Explore

- View: Scales (`tower`), Groups (`groups`) or Team (`team`). Each value matches a cam view, so the camera flies there.
- Time, Networks and Medicine: on/off toggles, off by default. They apply only in the Scales view; Groups shows just the bands and synergy arcs, and Team turns them off.
- `explore(c)` returns: `scale_len` 1 always; `scale_rg` and `scale_syn` 1 in Groups; `scale_team` 1 in Team; the toggles in Scales. Switching between Team and the other views dissolves and rebuilds the tower.
- With several toggles on, only the highest layer is labelled (medicine over networks over time), to keep the label count low.

## For the narrator

- The lengths are orders of magnitude. 'DNA bases 1 nm' and 'Body 1 m' follow the slide's axis (after Sin and Menche, 2021). The floors are evenly spaced as steps on a log scale; the gaps are not exact decades.
- The time axis is a true log scale. Enzyme turnover, folding and protein half-life vary widely in reality, so say "about" or "typically".
- **Deviation**: SPEC says protein half-life ~1 day. I labelled it 'hours to days' and placed it at about 7 hours, just below the circadian clock at 1 day (as on the slide, where it sits lower). This is so the two marks do not sit on top of each other. Human protein half-lives do range from hours to days.
- The four small networks, the team constellation and its links are illustrative, not data. The 42 people are anonymous ("more than 40 researchers"; slide 42 says 40+). Do not present the links as real collaborations or the group sizes as exact.
- The complex emblem is ATP synthase, the complex built earlier in the story.
- Medicine feeds into the top floor (body) and the bottom floor (DNA), as on slide 31.
- The research group bands follow the spec: RG1 is proteins and complexes; RG2 cells and tissues; RG3 body and population; RG4 (DataDiVR: virtual reality, machine learning and AI) spans every scale.

## Notes for the integrator

- In-scene text: none.
- Materials: custom shaders all include `uA`, and points use `pointPx`. There are two lit `MeshStandardMaterial`s (emblems and icons) through `K.fade` and two `K.rim` membranes.
- Draw order: the emblems, icons and people are 'transparent' only so that they can fade, so they have `renderOrder` -1. They draw before every additive glow, and the depth they write hides only the glow behind them. Without this, three.js sorts them against the merged glow meshes by distance, and glows in front of an emblem pop in and out as the view turns. The people stop writing depth while the set fades (mission hand-over to the interactome).
- Shared state: per-element visibility and reveal live in two shared uniform arrays (`uV`, `uR`).
- Glow geometry: the glowing tubes are merged into a front-face mesh and the glassy shells into a double-sided mesh. Tower meshes switch off (`visible = false`) when they cannot show.
- Purity: `update()` is pure in S and t. Spin, bobbing and pulses all come from t.
- Per-frame cost: CPU work per frame is small. It covers 8 emblem transforms, 3 icon transforms, and, while the team is shown, 42 instance matrices and 42 halo points.
- Headset: behaviour in a headset (stereo, close-up legibility of the emblems) is untested; it was checked only in headless Chromium, including close-ups at 0.6-0.7 units.
- **Story change needed**: as scale_time starts, key `cam(a + 9, 'scale', 'time', 2)` (az 22) instead of `'high'`, which crops the start of the spiral. The tower and groups views are now at el 18 instead of 10, so every story waypoint on them is a little higher.

## Changes after review 1

- DNA and protein emblems are right-handed now. A numeric torsion check confirms it for the DNA and for all four helices.
- `renderOrder` -1 on the emblems, icons and people fixes the glow popping. People stop writing depth while the set fades.
- There is a new `time` cam. The tower and groups views are at el 18.
- The spiral start is rotated (th0 -82°), and there are at most six time labels. Layer hand-overs are faster.
- The Groups view no longer applies the time, network and medicine toggles.
- Team links draw in only after both people have landed.
- The A/T/G/C colours match the dna set, and each rung is an explicit A-T or G-C pair.
- Segment counts are trimmed: brain 36x24, cerebellum 22x14, cell membrane 24x16, fewer sides on small rods and limbs.
- Mitochondrion: I did not follow the suggested closed inner capsule with a zig-zag ribbon. A closed opaque inner shell would hide the folds, so I made the textbook cut-away instead. The inner membrane is opened lengthwise inside the glassy outer capsule, with cristae folding in from alternating sides. There is no axis rod.
- I also found and fixed a bug. The hand-made tube geometry (`ptube`) had inward-facing triangles, so lit tubes showed their far inner wall: dark DNA backbones, grey limbs, a dark rim on the mitochondrion. The winding is fixed and the open ends of lit tubes now have round caps. The glow tubes look the same as before.

Sources: slides 30-33 and 42 of the LBG visit deck (Menche 2026); length and time scales after Sin and Menche (2021); AlphaFold DB confidence colours.
