# atp: putting the pieces together (ATP synthase)

File `sets/atp.js` defines `SETS.atp`. Slides 13-16 plus the WEHI animation (Drew Berry and Franck Tétaz).

The set has three parts:

- **Parts grid.** The 13 components laid out as on slide 13. Each is one AlphaFold-like chain: a chunky lit backbone
  tube with helices, sheets, loops and floppy ends, shaded by structure and by burial so the folded cores read dark.
- **Assembled complex.** Every copy of every part is a cluster of overlapping spheres, which together read as a
  molecular surface. The complex sits in a lipid bilayer. Protons turn the rotor and ATP pops out of the head.
- **Contact network.** The 13 parts and their 21 contacts, drawn on top of a faint ghost of the complex.

Layout:

- The complex is 1.2 units tall, centred on the origin, with the rotor axis on y. The head is at the top (matrix
  side) and the membrane is at y about -0.38.
- Subunit a and the peripheral stalk are on +x, a little towards +z. They show on the right in the `complex`
  view, as on slide 14.
- The parts grid lies in the z = 0 plane and spans about x ±1.0, y ±0.9.

## Params

All params run from 0 to 1 unless noted. `atp_a` is the set fade (engine).

| param | default | meaning |
| --- | --- | --- |
| `atp_parts` | 1 | The 13 chains draw themselves along their length, one after another, then float gently in the grid. 1 is the resting look. |
| `atp_colour` | 0 | Grey-teal (slide 13) changes to the group colours of slide 14: α, β, γ, δ, ε teal; ATPAF1/2 beige; ATP5F1 brown (#a8625b); ATP5O purple; MT-ATP6 dark brown (#5e3027); ATP5G1-3 pink. |
| `atp_build` | 0 | Assembly, described in stages below the table. |
| `atp_turns` | 0 | Rotor angle in **turns**, unbounded. The c-ring and the central stalk turn; the head and the peripheral stalk stay still. Protons, ATP and the head's motion are tied to this value, not to time. |
| `atp_flow` | 0 | Shows the protons and ATP, described below the table. |
| `atp_net` | 0 | Network view (slide 15). The surface fades to a faint ghost (with a depth pre-pass, so only the outer skin shows) and the membrane dims. One blue node (#4d94ff, as `int_atp` uses) per part sits at its place in the complex. The 21 contacts show as glowing lines with small pulses. Nodes and edges draw on top of everything in the set (render order 6, no depth test), so they fade in evenly with the param. |
| `atp_shrink` | 0 | The ghost fades out first (0 to 0.12), then the network shrinks into one bright point at the set's origin and fades; the membrane goes by 0.45. This is the hand-over to the interactome. |

**`atp_build` stages:**

- **0 to 0.3.** Each chain flies on an arc from the grid to its place, turning to line up with its slot.
- **Copies.** Chains with copies split on the way: α ×3, β ×3, and c ×8 (ATP5G1 ×3, ATP5G2 ×3, ATP5G3 ×2,
  mixed around the ring).
- **0.3 to 0.9.** Each docked chain grows into its sphere surface. The floppy ends thin away first; every sphere
  grows out of the folded core of its chain (never from a floppy end), so nothing sprays around the complex.
- **Order.** The head and the helpers form first, then the central stalk, the c-ring, subunit a, b and OSCP.
- **Helpers.** ATPAF1 docks on a β and ATPAF2 on an α. They sit there while the head forms, then drift away and
  vanish (0.7 to 0.99).
- **Membrane.** It fades in from 0.5 to 0.92.
- **Colours.** β turns from teal to blue as it flies in.

**`atp_flow` contents:**

- **Proton haze.** A dim blue haze of protons, dense below the membrane (intermembrane space) and sparse above it
  (matrix), dimmer still where the stream enters under subunit a.
- **Proton stream.** Eight protons per turn, each a white-hot dot with a short fading trail (so it stands out from the
  haze), rise from below into subunit a. Each binds the outer helix of a c subunit and rides the ring for 320°
  (visibly locked to that subunit). It then leaves upwards from a into the matrix.
- **Half-channels.** The mouths of a's two half-channels (below a, and at its top next to the stalk) glow faintly
  cyan and flash as each proton passes.
- **ATP.** Each β releases one ATP per turn, when the bulge of the turning central stalk faces it. That makes 3 ATP
  per turn, one every third of a turn: a bright pop at the α/β cleft, then an amber dot with its three phosphates
  drifting into the matrix.
- **Head motion.** Each β's lower half swings out a little at the same moment. This motion is always there; it
  depends only on `atp_turns`.

**Suggested story keys.** The current `e3_story.js` timing works well:

- parts a..a+2, colour a+5..a+7, build a+9..a+16.5 (6 s or more reads best).
- flow on at a+18 and off at a+29..a+31.
- turns 0 to 4.5 between a+18 and a+30. Any range works; about 0.3-0.6 turns/s reads well.
- net a+30..a+33, shrink a+37.5..a+41. With these keys the ghost is gone by about a+38.3, before `int` shows.

The rotor can stop at any angle. The c nodes of the network stay at the front of the ring.

## Anchors

All anchors are in set coordinates.

**Per part:** `ATP5A1`, `ATP5B`, `ATPAF1`, `ATPAF2`, `ATP5C1`, `ATP5D`, `ATP5E`, `ATP5F1`, `ATP5O`, `MT-ATP6`, `ATP5G1`,
`ATP5G2`, `ATP5G3`. These are functions. In the grid they sit at the top-left of the part's cell, where its label
goes. They fly with the part, and in the complex or network they sit on the part's node, turning with the rotor
for γ, δ and ε.

**Fixed points:**

- `head`: left side of the head.
- `rotor`: front-left of the c-ring.
- `membrane`: left part of the bilayer.
- `stalk`: the **peripheral** stalk, half way up.
- `shaft`: the central stalk, front.
- `ring`: c-ring front.
- `matrix`: beside the head.
- `ims`: below the membrane.
- `atpOut`: where ATP from the front β drifts.
- `protonsIn`: below subunit a.
- `centre`: [0, 0, 0], where the network shrinks to.

## Labels

- **Parts grid.** 13 part labels, bold symbol plus a short role: α, β, helper, γ, δ, ε, b, OSCP, a, c. Shown while
  `atp_parts` is on and the build has not started.
- **Built complex.** `Head (makes ATP)` (cyn), `Rotor` (mag) and `Membrane`. Shown once built (`atp_build` > 0.86)
  and hidden in the network view.
- **Running.** `Protons flow in` (cyn, at `protonsIn`, below subunit a where the stream enters) and `ATP out`
  (amb). Shown while running (`atp_flow` > 0.5). These two are extras, not in the spec.
- **Narrow screens.** The part labels can touch; the engine's nudge handles it.

## Camera views

| name | view | notes |
| --- | --- | --- |
| `default` = `parts` | `[0, 4, 3.5, 0, 0, 0]` | the grid |
| `complex` | `[-10, -8, 2.9, 0, 0.02, 0]` | side view, slightly from below |
| `top` | `[-25, 40, 2.8, 0, -0.05, 0]` | the c-ring and subunit a show under the head, so `Rotor` points at the ring |
| `running` | `[-28, -4, 2.4, 0, -0.12, 0]` | close on ring, a and stalk |
| `network` | `[15, 8, 2.9, 0, 0.02, 0]` | |

The `complex` view stays good from az -40 to +60 (story spins).

Explore flies to `parts`, `complex`, `running` and `network` because they share the option names.

## Explore

One control: **View** (Parts / Complex / Running / Network).

- **Parts.** Coloured parts.
- **Complex.** Built and still.
- **Running.** Flow on; the rotor turns at 0.35 turns/s using `c.t`.
- **Network.** The contact network.

`explore()` keeps a tiny memory: the turns value seen in the last `update()`. With it, Running continues from the
current angle, and leaving Running coasts 0.1 turn and stops. Without it, the eased `atp_turns` would spin the
rotor backwards to 0. After a change of view or a reopening, the base angle is taken only from the first
`update()` that follows (until then the target holds the last known angle), so a stale memory (the set was not
drawn while the story or another scene changed `atp_turns`) can no longer whirl the rotor. `update()` itself stays
a pure function of the params and `t` (checked).

## Extra exports

- `parts`: one entry `{ sym, hgnc, name, copies }` per part, for panel or explore text. For example
  `{ sym: 'ATP5F1', hgnc: 'ATP5PB', name: 'subunit b (peripheral stalk)', copies: 1 }`.
- `contacts`: the 21 contact pairs (Shared facts list).

## Narration: say / do not say

**Say:**

- About 13 kinds of protein; the head is three α and three β, and β makes the ATP.
- The helpers ATPAF1 and ATPAF2 hold the α and β subunits while the head is built, then leave. They are not part
  of the finished machine.
- Protons flow from the intermembrane space to the matrix, through the gap between subunit a and the c-ring.
- They turn the ring and the central stalk; the head is held still by the peripheral stalk.
- One full turn takes 8 protons and makes 3 ATP (in mammals, which have 8 c subunits).
- ATP5G1, G2 and G3 are three genes for the same c subunit.
- MT-ATP6 is encoded in mitochondrial DNA.

**Do not say:**

- That the head spins. It is the stator.
- That the c-ring has 10 or more subunits. That is yeast and bacteria; mammals have 8.
- That the shown speed is real. The real enzyme turns of the order of 100 times per second; here it is slowed
  right down.
- That the shapes are the real structures. The chains and the surface are illustrative, in the style of AlphaFold
  models and of slide 14.
- That the peripheral stalk is subunit b alone. In reality it is b, d and F6, capped by OSCP. The second, twisted
  helix in the drawn stalk stands for d and F6, which are not among the 13.
- That this is the whole complex. The other small membrane subunits (e, f, g, A6L and others) and the dimers in the
  cristae are not shown.

**Rotation sense.** It is correct for ATP synthesis: anticlockwise seen from the matrix (from above). Noji et al.
saw ATP-driven rotation anticlockwise from the membrane side; synthesis runs the other way. Each proton is carried
almost a full turn, from a's entry half-channel to its exit half-channel.

## Performance (headless Chromium, SwiftShader; the machine was shared and heavily loaded)

| look | tris | draw calls | points | lines |
| --- | --- | --- | --- | --- |
| parts grid | 41.5k | 13 | | |
| built | 168k | 2 | 7.25k membrane | |
| running | 168k | 4 | 7.6k | |
| network | 210k | 6 (incl. the depth pre-pass, 42k tris) | 7.3k | 21 |
| peak during the build (chains and surface together, build about 0.58) | 214k | ≤ 14 | | |

- **Build time.** 130-230 ms in the harness at a load average of 6-11 on 4 CPUs; in Node it is on par with the
  previous version (minimum about 80 ms under the same load).
- **Per-frame work.** Up to 24 instance matrices, 90 dynamic points, 21 edges and a few uniforms.
- **Surface.** 2,101 sphere instances on an indexed icosphere (42 vertices, 80 triangles), sorted by the moment
  they start to grow, so during the build only the started ones are drawn (`instanceCount`). The morph, rotor
  rotation, β motion and helper drift run in the vertex shader. A chain mesh is hidden once its tube has thinned
  to an eighth of its radius (sub-pixel and covered by the surface by then).
- **Membrane.** Two leaflets of lipid-head points plus a dim warm fill between them; no line segments.
- **Tests.** No page errors besides the expected favicon 404. `tools/atp/test.cjs` checks the build time, that
  update is pure, that anchors and labels resolve, that explore never turns the rotor backwards, and that a stale
  explore memory does not whirl the rotor. `tools/atp/tris.cjs` gives the triangle peak over the build.

## Deviations from the spec

- **Extra labels:** `Protons flow in` and `ATP out`.
- **Extra anchors:** `shaft`, `ring`, `atpOut`, `protonsIn` and `centre`.
- **Extra views:** `running` and `network`.
- **Extra exports:** `parts` and `contacts`.
- **`stalk`** means the peripheral stalk; the central stalk is `shaft`.
- **ATP5B colour.** ATP5B is teal at the colour step (as on slide 14) and becomes blue only in the assembled head
  (as the spec asks).
- **Peripheral stalk.** Drawn as a two-helix bundle so that it has the thickness of the real stalk (see the note
  above).
- **Explore memory.** `explore()` keeps the small memory described in Explore; `update()` keeps none.
- **Half-channel glows.** Two faint glows at the mouths of subunit a's half-channels (an extra, so the path of
  the protons reads).
- **Depth pre-pass.** It runs only for the in-set ghost: while `atp_shrink` < 0.12 and the set's fade is above 0.7.
  Review 1 suggested switching it off as soon as the shrink starts or the fade drops below 0.98. That leaves a
  visible pop (the 14% skin-only ghost turns, in one frame, into a much brighter many-layer ghost), so instead the
  ghost itself fades to nothing over those ranges (shrink 0 to 0.12; fade 1 to 0.7 in the network view) and the
  pre-pass stops only once nothing is left to draw. The hole it cuts in other sets is then limited to moments
  when the incoming set is still below about 2% (story) or 30% (explore, for about 0.1 s). A solid complex
  (Complex view) fading out never uses the pre-pass.

## Changes after review 1

- Network nodes, edges and glow draw after the surface, membrane and protons (render order 6), so `atp_net`
  morphs in evenly and is not dimmed by the ghost.
- Depth pre-pass limited to the in-set ghost, with the ghost fading out first (see Deviations), so no hole is cut
  into the interactome during the hand-over or into the next scene in explore.
- Proton stream: brighter, whiter, bigger heads with fading trails; dimmer, bluer haze, halved near the entry;
  glowing half-channel mouths; a slightly longer, closer approach from below.
- `Protons flow in` moved to the `protonsIn` anchor below subunit a.
- MT-ATP6 darker at the colour step (#5e3027), distinct from ATP5F1.
- Parts grid: tubes about 1.4 times thicker (0.008-0.013), stronger shading by structure and burial, cam dist 3.5.
- Mid-build spheres grow only from core residues, so no spray from the floppy ends.
- `top` cam lowered to el 40.
- Explore memory takes its base only after a fresh `update()`.
- Membrane tails (9.5k line segments) replaced by a dim point fill between the leaflets.
- Triangle peak during the build down from 244k to 214k; long lines wrapped at 140 characters.
- Untested here: the look and comfort in a headset, and frame rate at 72-90 fps in stereo.

## Sources

- Abrahams et al., Nature 370, 621 (1994): structure of F1, α3β3 with γ.
- Boyer, Annu. Rev. Biochem. 66, 717 (1997): binding change mechanism.
- Noji et al., Nature 386, 299 (1997): rotation.
- Watt et al., PNAS 107, 16823 (2010): bovine c8-ring, 2.7 protons per ATP.
- Spikes et al., PNAS 117, 23519 (2020) and Pinke et al., Nat. Struct. Mol. Biol. 27, 1077 (2020): structure of the
  whole mammalian complex.
- Ackerman and Tzagoloff, Prog. Nucleic Acid Res. Mol. Biol. 80, 95 (2005); Wang et al., J. Biol. Chem. 276, 30773 (2001):
  ATPAF1/Atp11 binds β, ATPAF2/Atp12 binds α.
- Animation "ATP synthase" by Drew Berry and Franck Tétaz, WEHI.
- HGNC for the current symbols.
