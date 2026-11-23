# `motor` - the motor unit, from nerve to sarcomere, and the heart (sets/motor.js)

Slide 2 of the talk, in real 3D. One scene read from left to right, about 2.5 units long (x -1.18 to 1.27,
y -0.5 to 0.7; the heart above the muscle reaches the top):

- **Spinal cord** (x about -1.0): a short slab of cord (its axis along z, the cut face towards +z), glassy white
  matter with the grey-matter butterfly inside (central canal, anterior horns pointing right, slender posterior
  horns reaching the surface at the left). In this frame ventral points right (+x, towards the muscle) and lateral
  points down (-y).
- **Motor neuron**: a large multipolar soma (nucleus and nucleolus seen through it) in the lower anterior horn,
  seven branching dendrites, an axon hillock and initial segment, then the axon leaves through the ventral root.
- **Sensory neuron**: a pseudo-unipolar cell body in the **dorsal root ganglion** (glassy swelling below-left
  of the cord), its stem joining the axon at a T. The central branch runs up the dorsal root into the dorsal horn
  and on to the motor neuron (the monosynaptic stretch reflex); the peripheral branch runs with the motor axon in
  the spinal nerve (glass sheath, the epineurium) and ends as an annulospiral coil round a **muscle spindle**
  (thin capsule with two striated intrafusal fibres) on the lower front of the fascicle.
- **Axons**: both myelinated (glossy translucent internodes with rounded paranodal ends, **nodes of Ranvier**
  between them). Inside the cord the motor axon is myelinated too; the initial segment is bare.
- **Neuromuscular junctions**: in front of the fascicle the motor axon branches (at a node) into three primary
  branches and six terminals, one to each of six fibres (its motor unit). Each ends in a shallow cupped end plate
  with junctional folds, wrapped onto the fibre, holding an en-plaque terminal of three swollen branches with
  synaptic vesicles (tiny dots) above the synaptic cleft.
- **Muscle**: a fascicle of 20 cylindrical fibres (x -0.25 to 0.55) in a glass perimysium, striated in a shader
  (I-band light, A-band dark, H-zone, M-line, Z-line; period 0.018, in register; the pattern fades smoothly where
  it would alias). One front fibre opens (`motor_open`) along its distal part to show 19 hex-packed striated
  **myofibrils**, which protrude from its cut end; one ends where the magnified sarcomere grows out of its last
  sarcomere (with thin magnifier lines from the small sarcomere's Z-lines to the big one).
- **Sarcomere** (centred at x 1.0): 37 thick filaments (myosin: backbone, bare zone, heads in a three-stranded
  helix, every crown turned 40 degrees, pointing towards their own Z-disc, bipolar) in a **hexagonal lattice**
  (spacing 0.054) with 54 thin filaments per half at the trigonal positions (actin: two beaded strands twisting
  round each other), so every thin filament sits between three thick ones and every thick filament is ringed by
  six thin ones. **Z-discs** (x +-0.27): two zigzag strut layers joining the thin filaments' ends, posts, and a
  hexagonal frame. **Titin**: one spring per thick filament per half, coiled through the I-band from the Z-disc to
  the thick filament's tip, then lying along the thick filament to the **M-band** (cross-links between neighbouring
  thick filaments at x 0). The heads are kept small (about 0.007 long, reaching 0.015 from the thick filament's
  axis, so they lean towards the thin filaments but leave the corridors open). Colours: actin cyan, myosin amber with orange heads, titin green, Z-disc violet, M-band
  pale violet.
- **Heart** (centre (0.30, 0.29, -0.12); local frame x the patient's left, y up, z forward): one smooth surface,
  a signed distance field of round cones and ellipsoids blended softly (so the parts merge with grooves instead of
  seams), polygonised by surface nets on a 6.5 mm grid (local units), watertight, about 52k triangles, its
  creases darkened by an occlusion term read from the field. Ventricles: the left a blunt cone ending in the apex
  (left, down and forward), the right wrapped round its front, the interventricular groove between them fading out
  towards the apex; their base is a plane across the axis, on which the atria sit; the right ventricle's outflow
  tract rises to the pulmonary trunk. Right atrium between the venae cavae, left atrium at the back, each with a
  flat auricle (the right over the aortic root, the left along the trunk's left side). Ascending aorta behind the
  trunk, arch with its three branches (brachiocephalic, left common carotid, left subclavian), descending aorta
  behind the left atrium; pulmonary trunk dividing under the arch, the right pulmonary artery passing behind the
  aorta and the superior vena cava; superior and inferior venae cavae; four pulmonary veins. Open vessel ends are
  cut flat, the wider ones with their lumen. Colours: muscle warm crimson, atria a little darker, oxygenated blood
  red (aorta, pulmonary veins), deoxygenated blue (venae cavae, pulmonary trunk and arteries, a little more
  violet). Coronary vessels are tubes laid into the grooves (pulled onto the crease between two parts), tapering
  and sinking into the surface at their ends: anterior descending to the apex with a diagonal branch and the
  anterior interventricular vein beside it, circumflex under the left auricle, right coronary in the right
  atrioventricular groove. A round window cut into the right ventricle's front wall (cut muscle walls, a dark
  floor) shows branched, striated heart muscle cells with intercalated discs lying on its floor and running on
  into its walls. With `motor_groups` the disease colour shows mostly at the rim, so the anatomy stays readable.
  The surface is built after loading, in slices between frames (`idle(dt)` while the set is hidden, about 1-2 ms
  a frame; 12 ms a frame once `motor_heart` is above 0; `finish()` builds it at once), about 0.6 s of work in
  headless Chromium; it fades in when ready.

Draw calls at most 14 (the merged meshes: neurites, nuclei, fibres, sarcomere, heart, coronary vessels, heart
window, grey matter, somata, myelin, glass, rings, points, magnifier lines). Heaviest look (`motor_open` 1,
`motor_heart` 1): about 285k triangles (over the tour's ~250k guideline because of the heart; untested on a
headset), 1,254 points, 28 line segments. Build at load 210-260 ms in headless Chromium (the heart comes later,
see above; the sarcomere is about a third of the build).

## Params

| param | default | meaning |
| --- | --- | --- |
| `motor_a` | 1 | fade (engine) |
| `motor_build` | 1 | The scene appears along the path from left to right (a cut that moves along x with a cyan edge glow): cord and neurons, roots, nerve, junctions, fibres. The heart needs build > 0.75, the sarcomere > 0.85. 0 shows nothing. |
| `motor_signal` | 0 | Impulses, all from `t` (a 1.7 s cycle, the stretch reflex): the spindle fires and a cyan impulse runs up the sensory axon (bright flashes at the nodes) to the T, the dorsal root and the motor neuron (0 to 0.37 s; it bypasses the sensory cell body); the motor neuron flashes (0.5 s) and a warm impulse runs down the axon (saltatory: flashes at each node) and the terminals; the vesicles flash at each junction (about 1.08 s), transmitter dots light the cleft, and the six fibres of the motor unit twitch (shorter, thicker, a flash; peak about 1.24 s). The axon surface itself lights as the impulse passes. 0 is still; in-between values dim it all. |
| `motor_open` | 0 | 0-0.5: one front fibre's sheath opens along its distal part (a widening wedge, its far cap goes) and the myofibrils grow in; 0.3-0.55 the sarcomere fades in at the tip of one myofibril; 0.35-1 it magnifies (scale 1/30 to 1) and flies out to its place at the right, the magnifier lines drawing on. |
| `motor_contract` | 0 | Sarcomere contraction: thin filaments and Z-discs slide towards the M-band (by 0.055 of 0.27; the H-zone nearly closes, titin springs compress) and the myosin heads cycle (lean towards the M-band). With `motor_signal` > 0.5 it pulses with the twitches instead of holding. |
| `motor_heart` | 0 | 0-0.3 a magenta glow, 0.2-0.75 the heart fades in from it and grows (scale 0.55 to 1 over 0.1-1), the rim glow settling; it beats at 69 per minute (atria first, then the ventricles, the window's fibres with them; each vertex is weighted between ventricles and atria, so the surface stretches smoothly where they meet). Above 0 the heart's build gets more time per frame; until it is built, only the glow shows. |
| `motor_groups` | 0 | Every disease group's colour lights its site (colours and sites from `NMD_DATA.groups`): rings with a running highlight and soft halos, and the part's surfaces take the colour (a tint plus rim light). Neuron: three rings round the motor neuron (motor neuron diseases, ataxias, paraplegias), one round the ganglion (ataxias' colour); the grey matter, white matter and dendrites tinted. Nerve: three rings on the spinal nerve and the axons (motor and sensory neuropathies). Junction: a ring round each end plate (myasthenic syndromes). Muscle: one ring per muscle group along the fascicle (7) and each fibre in one of their colours. Heart: two rings and the heart (cardiomyopathies). The sarcomere glows for both muscle (thin filaments, Z-discs, titin) and heart (thick filaments, M-band), since they share it. |
| `motor_site` | 0 | 0 all sites alike; 1 neuron, 2 nerve, 3 junction, 4 muscle, 5 heart: that site glows and the rest dims to 30 %. In-between values cross-fade between the two neighbouring sites (at whole numbers this is the rounded value), so an eased change from 1 to 3 passes briefly through 2. Dimming works without `motor_groups` too (a focus). The sarcomere dims only when neither muscle nor heart is chosen. |

Suggested keyframes for the slide-2 chapter: build 0 to 1 over about 6 s (story label on each part as it
appears), signal 0 to 1 for a few seconds (the reflex loop), heart 0 to 1 while saying it shares the sarcomere,
open 0 to 1 then contract 0 to 1 (a cam flight `fibre`, then `sarcEnd` turning to `sarcSide`), groups 0 to 1 with site 1..5 stepping
through the five sites while the narrator names the groups, then site back to 0.

## Anchors

`cord` (top of the cord), `soma` (motor neuron), `ganglion` (dorsal root ganglion), `axon` (a node of Ranvier on
the nerve), `myelin` (an internode on the nerve), `nerve` (the spinal nerve), `junction` (an end plate),
`spindle`, `fibre` (top of the fascicle), `myofibril` (the protruding myofibril that ends in the sarcomere),
`sarcomere`, `zdisc` (right Z-disc, follows the contraction), `mband` (all three follow the magnification, so use
them only with `motor_open` near 1), `heart` (above the heart).

## Labels

At most five at once. `motor_site` 0: Spinal cord (hidden when open or heart), Motor neuron, Axon (hidden when
open), Neuromuscular junction, Muscle fibre, Sarcomere (when open), Heart (when heart). Site 1: Spinal cord,
Motor neuron, Sensory neuron. Site 2: Motor neuron, Sensory neuron, Axon. Site 3: Neuromuscular junction, Muscle
fibre. Site 4: Muscle fibre, Sarcomere (when open). Site 5: Heart (when heart), Sarcomere (when open). All wait
for `motor_build` to reach their part.

## Cam views

- `default` [-20, 14, 3.35, 0.05, 0.05, 0]: the whole unit, three-quarter view from the front left.
- `cord` [-24, 12, 0.95, -0.95, -0.15, 0]: the cord's cut face, the motor neuron, roots and ganglion.
- `junction` [20, 26, 0.42, ...]: close on the third end plate (vesicles visible; best with `motor_signal`).
- `fibre` [32, 16, 1.0, 0.5, -0.2, 0.08]: the opened fibre, its myofibrils and the sarcomere growing out.
- `sarcomere`: inside the lattice, in the bare zone beside the M-band, in a corridor between two thick
  filaments, looking along the filaments of the inner half towards its Z-disc's honeycomb and the fibre beyond it:
  [92.24, -2.68, 0.2565, 0.73, -0.011, 0.01]. The camera sits at x -0.014 from the sarcomere's middle (past the M-band
  struts, which cross the corridor at x 0, and 0.014 before the first crown of heads); the nearest geometry is about
  0.012 away, so nothing is cut by a near plane of 0.01 at world scale 1. The two thin filaments beside the corridor
  form its walls and look large and slightly faceted that close. It looks towards the fibre (not away from it, as it
  did before) so that in a headset the rest of the unit lies beyond the sarcomere instead of behind your head: kept
  clear of your head, the view keeps a scale of about 1.6 (four times the default view's) instead of 0.37, the
  default view's own (`keepClear` below). Explore only. Needs `motor_open` 1.
- `sarcEnd` [75, 10, 0.9, 1.05, -0.05, 0]: the magnified sarcomere from outside, down its filaments from beyond the
  outer Z-disc (the camera 0.55 past it), the rest of the unit behind it. The muscle story's first sarcomere shot.
- `sarcSide` [15, 14, 1.15, 0.97, -0.05, 0]: the sarcomere from the side, a little from above, for the filaments
  sliding (the story turns from `sarcEnd` to here). Both keep the camera at least 0.6 from any geometry.
- `heart` [-10, 8, 1.35, 0.30, 0.34, -0.12]: the heart from the front, a little from its right: right atrium,
  right ventricle with the window, the anterior descending artery in its groove and the left border, the trunk and
  the aortic arch.

Views along the unit from its left (the cord's) side put, in a headset, the whole unit between the view's target and
you: kept clear of your head, such a view shrinks to about the default view's scale. Close views are best taken
across the unit (from the front) or from its right end, past the sarcomere.

`keepClear: true`: the set is drawn where its geometry is (the twitch, the heart's beat and the build cut aside), so in
a headset the engine keeps it at least 0.35 m from your head (`xrClear`, in the muscle and endotype stories'
`e5_xr.js`).

## Explore

- View: Motor unit (`default`: open 1, heart 1), Junction (open 0, heart 0), Sarcomere (open 1), Heart (heart 1,
  open 1). The option keys are the cam names, so the engine flies there.
- Show: Diseases off / Diseases on (groups 1; site 0 for the motor unit, 3 junction, 4 sarcomere, 5 heart).
- Motion: Still / Impulses (signal 1) / Contraction (signal 1, contract 1).

## For the narrator

May say: the motor unit is one motor neuron and the muscle fibres it supplies; the motor neuron sits in the
anterior horn of the spinal cord's grey matter, the sensory neuron in a dorsal root ganglion; myelin speeds the
impulse, which jumps from node to node (saltatory conduction); at the neuromuscular junction the nerve releases
acetylcholine from vesicles and the fibre contracts; muscle fibres are packed with myofibrils, chains of
sarcomeres; in a sarcomere thin actin filaments slide along thick myosin filaments, pulled by the myosin heads,
and titin acts as a spring; heart muscle is striated too and shares the sarcomere with skeletal muscle. The shared
facts: motor neuron diseases, hereditary ataxias and paraplegias strike the nerve cells; hereditary motor and
sensory neuropathies the nerves; congenital myasthenic syndromes the junction; myopathies and muscular
dystrophies the muscle fibres; hereditary cardiomyopathies the heart muscle.

Must not say: that the six junctions, 20 fibres, 37 thick filaments or any proportion are real numbers (a real
motor unit has tens to thousands of fibres; a real myofibril has hundreds of thick filaments; sizes here are not to
scale); that the sarcomere's colour split (thin filaments glowing for the muscle groups, thick for the heart)
assigns genes or diseases to filaments - it only shows that both kinds of muscle share the structure; that the
stretch-reflex loop or the impulse timings are measured. The amber ring at the ganglion stands for the ataxias
(dorsal root ganglion neurons are affected in some ataxias, for example Friedreich ataxia); say no more than that.
No patient data, no variants, nothing about zebrafish.

## Sources

Standard anatomy and physiology (motor unit, spinal cord cross-section, pseudo-unipolar sensory neurons and the
stretch reflex, myelin and nodes of Ranvier, the neuromuscular junction with junctional folds, muscle spindle with
annulospiral ending, sarcomere bands and the hexagonal 2:1 thin:thick filament lattice of vertebrate muscle,
bipolar thick filaments with a bare zone and a three-stranded crown repeat, titin from Z-disc to M-band, coronary
anatomy, intercalated discs), as in Kandel et al., Principles of Neural Science, and Alberts et al., Molecular
Biology of the Cell. Disease groups, their colours and sites: `NMD_DATA.groups` (Gene Table of Neuromuscular
Disorders, 2024, as grouped for the talk).
