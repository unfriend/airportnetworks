# mac: more than the sum of its parts

File `sets/mac.js` defines `SETS.mac`. It covers slides 3 to 5: a Macintosh Classic, Todd McLellan's teardown
photo of all its parts, then the Apple I schematic.

The set has three looks:

- **The computer.** A classic beige all-in-one computer in the 1990 style. It has a tall rounded case, a sloping
  screen surround, a floppy slot, a separate keyboard (80 key caps and a power key) and a mouse. There are no brand
  marks anywhere.
  - The case has a carrying handle and vents on top, vents on the sides, and a port panel and five case screws at
    the back.
  - The screen glows with a light grey desktop: a menu bar (File Edit View Special), a window called "Network"
    holding a small network, a hard disk icon, a bin (labelled "Bin") and a pointer. It is drawn on a canvas, so it
    is crisp, with scan lines only when seen close.
  - The glow spills beyond the picture: a soft halation in the glass round the picture, and light on the sloping
    screen surround and the bezel just round it. Both go out with the picture when the screen switches off.
- **The teardown.** Every part flies on a slight arc and lands flat, in neat rows on a pale grey table. Soft contact
  shadows make it read like the photo. Parts are sorted by kind and size.
  - **Back row:** the two boards, the open rear case, the front bezel (face up) and the picture tube (face down,
    neck up). Then the floppy drive, with the power supply, fan and speaker below it.
  - **Under the tube:** the analogue board's big parts (flyback transformer, mains transformer, two heat sinks).
  - **Middle:** the chips in two rows, largest first. Then the 40 resistors by value, then the capacitors,
    crystals, fuse, battery and trimmers. Each row is spread evenly.
  - **Left:** the memory modules, the ribbon cable, the keyboard cable coiled into a flat spiral, the anode lead and
    a wire harness.
  - **Front:** the keyboard case, with its key caps spread out in the keyboard's own layout. Below that, one long
    line of 53 screws, longest first.
  - **Right:** the mouse in pieces (shell, base plate, button, ball, rollers, coiled cable). Then rows of feet,
    springs, washers, standoffs, clips and brackets.
- **Wiring, then network.** Glowing cyan wires connect the laid-out chips, resistors, capacitors and crystals like a
  schematic: four long bus lines run along the gaps between the rows, and many taps and point-to-point wires join
  them, with junction dots. Wire width is in local units; seen from further away than the `wiring` cam the wires
  widen a little (up to 1.6 times), so the schematic still reads from the `table` cam and on a phone. Then the
  parts shrink away into glowing nodes, the wires straighten into edges, and the graph lifts off the table into a
  3D network (106 nodes, 209 links).

Layout:

- y is up. The table top is at y = -0.30. The table is 1.76 x 1.48, so its corners reach radius about 1.15.
- The assembled computer stands on the table area near the centre. Its front faces +z, the keyboard is in front
  of it and the mouse is to the right.
- The network floats centred on (0, -0.14, 0), with radius about 0.6.

## Params

All params run from 0 to 1. `mac_a` is the set fade (engine). Every param morphs smoothly, and every in-between
value looks right.

| param | default | meaning |
| --- | --- | --- |
| `mac_explode` | 0 | 0: the assembled computer. 1: everything laid out on the table. Timing is described below the table. |
| `mac_wire` | 0 | The schematic wiring grows wire by wire. It only draws over the laid-out parts, so it is multiplied by `prog(mac_explode, 0.75, 1)` (unless the network has already lifted). Timing is described below the table. |
| `mac_net` | 0 | Parts become a network. Timing is described below the table. |

**`mac_explode` timing:**

- **0 to 0.11.** The screen switches off like a CRT: the picture squeezes to a white line, then to a dot, then
  fades.
- **0 to 0.3.** The table fades in.
- **Order of a real teardown:**
  - The five case screws come out of the back (from 0).
  - The rear case slides off (0.05 to 0.47).
  - The keys are plucked off row by row (0.08 to 0.6).
  - The mouse comes apart (0.12 to 0.6).
  - The picture tube lifts out backwards and flips face down (0.25 to 0.65).
  - The boards and the drive leave (0.26 to 0.82).
  - The front bezel goes last of the big parts (0.38 to 0.8).
  - The chips, resistors and capacitors fly off the boards (0.24 to 0.91).
- **Screws** unscrew (they spin) as they fly. Parts from inside that land in front of the computer wait until the
  bezel has lifted, so nothing flies through it.
- **Cables.** The keyboard and mouse cables coil up as they land (a morph).
- **Landing.** Everything is down by 0.92.

**`mac_wire` timing:**

- **0 to 0.1.** The bus lines draw first.
- **Then until about 1.** The other wires grow from the processor outwards. Each wire grows along its length with
  a bright tip, and its junction dot lights when it lands.
- **Pulses.** Small comet-shaped light pulses run along the wires (driven by `t`), each wire with its own phase, so
  they never flash on every wire at once (also once the wires are straight network edges).
- **Lights.** The room lights dim (0 to 0.35), so the wiring glows.

**`mac_net` timing:**

- **Parts shrink away.** Parts with no wires go first (0.02 to 0.34). The wired parts then shrink into nodes
  (0.06 to 0.36). Node colours: chips amber, resistors cyan, capacitors magenta, crystals green, bus hubs white.
- **Junction dots go out** (0.12 to 0.28), before the wires move, so none is left floating on its own.
- **Wires straighten** into straight edges (0.28 to 0.6). Each straight edge fades softly into its two nodes
  instead of ending in a hard cut.
- **The table fades** (0.25 to 0.55).
- **The graph lifts** into its 3D layout (0.45 to 1).
- **Sway.** Once lifted, the network sways gently about its centre, ±26° (driven by `t`, so scrubbing is safe).

Suggested story keyframes (these are what the integrator already uses):

- `mac_explode` 0 to 1 over about 5 s.
- `mac_wire` 0 to 1 over about 7 s. Move the camera from `table` to the closer `wiring` cam while it ramps: from
  `table` the schematic fills only a band across the middle of the frame.
- `mac_net` 0 to 1 over about 4.5 s.

Give the computer a second or two to be admired before it comes apart.

## Anchors

All anchors are in local coordinates. The ones marked "follows" move with their part (assembled, in flight and
laid out).

| anchor | where |
| --- | --- |
| `screen` | Centre of the glass, just in front of it (follows the tube). As the tube flies and lies face down, it moves up to the middle of the tube, 0.27 above the table. |
| `board` | The logic board (follows). |
| `chips` | Mean of the 8 big chips (follows). |
| `resistors` | Mean of the resistors (follows). |
| `screws` | Mean of the short screws (follows). |
| `keys` | Mean of the key caps (follows). |
| `wires` | The middle of the bus lines on the table. It glides to the network's centre as the graph lifts (`mac_net` 0.45 to 1). |
| `computer` | Centre of the assembled computer, (0, -0.054, -0.09). |
| `crt` | The picture tube (follows). |
| `keyboard` | The keyboard case (follows). |
| `mouse` | The mouse shell (follows). |
| `table` | (0, -0.3, 0). |
| `network` | (0, -0.14, 0). |

## Labels

Labels show when the computer is taken apart (`mac_explode` > 0.82).

| label | anchor | class | fades out |
| --- | --- | --- | --- |
| **Screws** 53 of them | `screws` | (plain) | as the wiring starts |
| **Resistors** 40, by value | `resistors` | cyn | as the wiring starts |
| **Chips** transistors inside | `chips` | amb | as the network forms |
| **Keys** 81 caps | `keys` | grn | as the wiring starts |

The counts in the label text are computed from the model. The classes match the node colours of the network
(chips amber, resistors cyan), because the Chips label is still showing while the nodes appear.

## Other exports

`counts`: { parts 293, screws 53, resistors 40, chips 22, keys 81, wires 217, nodes 106, links 209 }, for the
story text.

## Cam views

`[az, el, dist, tx, ty, tz]`

| view | value | shows |
| --- | --- | --- |
| `default` / `computer` | [32, 13, 2.25, 0.06, -0.09, 0.06] | Three-quarter view of the computer, keyboard and mouse. |
| `table` / `apart` | [8, 55, 3.45, 0, -0.32, 0.02] | Above the teardown (el 55). The whole table fills the view. |
| `wiring` | [2, 60, 2.6, 0.17, -0.3, -0.06] | Closer over the wired middle rows. |
| `network` | [18, 20, 2.4, 0, -0.14, 0] | The lifted network. |
| `screen` | [12, 6, 1.0, 0, 0.036, 0.12] | Close on the screen. |

## Explore

Control **View**: Computer / Taken apart / Wiring / Network.

`explore(c)` returns these targets (explode, wire, net):

| view | targets |
| --- | --- |
| Computer | (0, 0, 0) |
| Taken apart | (1, 0, 0) |
| Wiring | (1, 1, 0) |
| Network | (1, 1, 1) |

A jump from Network straight to Computer eases all three params down together. The parts are posed with
`max(mac_explode, prog(mac_net, 0, 0.3))`, so the nodes first turn back into parts on the table and only then fly
home. The story is not affected, because there `mac_net` rises only after `mac_explode` has reached 1.

## Budget (measured in the harness)

- **Draw calls:** 16 for the shut computer (the parts inside it are not drawn). 32 to 33 taken apart and wired,
  up to 36 while the set fades (the depth prepass, see below). 2 for the network.
- **Triangles:** about 57k for the shut computer, about 109k taken apart, under 1k for the network.
- **Hidden parts:** an instanced kind, a single mesh or the shadows are not drawn while all their parts are at scale 0
  (inside the shut case, or gone into the network).
- **Points:** 226.
- **Line segments:** 0. The wires are ribbon meshes of about 800 triangles.
- **Parts:** 293, drawn with instancing and merged geometry.
- **Per-frame updates:** matrices are recomputed only while `mac_explode` or `mac_net` change, and then only for
  the parts that move; an instanced kind is uploaded only when one of its parts moved. Otherwise only a few uniforms
  change per frame. An update takes about 0.1 to 0.2 ms while a param changes.
- **Build time:** 100 to 200 ms when the machine was quiet. It went up to about 400 to 550 ms while other agents
  loaded all 4 CPUs.
- **Page errors:** none (apart from the expected favicon 404).

## Fading the computer

While `mac_a` is below 0.97 and the parts have not yet turned into the network (`mac_net` < 0.06), a depth-only
copy of the two case halves, the picture tube and the screen is drawn first. This holds with the case shut and
while it is taken apart. The case and the tube then fade as solid objects instead of showing the tube, rims, screws
or their own inner walls through them (for example in a cross-fade from 'Taken apart'). Anything drawn later in the
same place (for example another set in a cross-fade) is hidden behind them rather than seen through it. The other
parts, and the network, fade normally.

## What the narrator may say

- The parts list of a computer does not tell you how it works: that comes from how the parts are connected.
- The computer is made of hundreds of parts: screws, resistors, chips (each with thousands of transistors inside),
  keys and so on.
- The circuit diagram of a computer is itself a network.
- Slide 3 shows a Macintosh Classic, and the story text may name it. The model itself carries no brand marks.

## What the narrator must not say

- Do not present the model's counts as the real machine's. 293 parts, 53 screws, 40 resistors and 22 chips are
  this model's counts ("in this model").
- Do not say that the wiring is the Macintosh's (or the Apple I's) real circuit. The netlist is illustrative: real
  buses (power, address, data, ground), plausible taps and links, but not a real schematic.
- Do not say that a chip in the model "is" a particular processor.

## Sources

- **Todd McLellan**, *Things Come Apart* (Thames & Hudson, 2013): the teardown photo style (parts sorted and laid
  out in rows).
- **Apple I schematic** (Steve Wozniak, 1976), slide 5: the look of the wiring.
- **The computer's form** follows the compact Macintosh line (Macintosh Classic, 1990):
  - a 9-inch black-and-white CRT showing 512 x 342 pixels (the screen texture uses that aspect);
  - a floppy slot at the lower right;
  - the logic board lying flat at the bottom and the analogue board standing at the side;
  - the CRT held to the front bezel by four ears.
- **Proportions** are illustrative, and small parts are a little larger than life so they read on the table.

## Changes after review

After review 1 (all 11 minor issues were real and are fixed):

- **Network pulses.** Each wire has its own pulse phase, and the pulse runs along the straight edge. The network no
  longer brightens all at once every 2 s.
- **Beads.** Straightened edges drop their end caps, so their segments no longer overlap into bright beads.
- **`wires` anchor.** It glides with the lift instead of jumping at `mac_net` 0.5.
- **Label colours.** Chips is amber (like the chip nodes) and Screws is plain.
- **Half fade.** A depth prepass of the case and screen stops the X-ray look while the shut computer fades.
- **`screen` anchor.** It no longer sinks below the table: it moves up to the middle of the lying tube.
- **Wire width.** Wires widen with view distance (1 at the `wiring` cam, 1.33 at the `table` cam, at most 1.6).
  Close-ups keep their original width. Bus lines are 2 times as wide on the table (was 1.7) but only 1.3 times as
  network edges. The story should use the `wiring` cam while `mac_wire` ramps.
- **Glowing screen.** Halation in the glass and light spill on the screen surround. Both switch off with the screen.
- **Bin.** The screen says "Bin" (British English).
- **Uploads.** Per-part dirty tracking: only moving parts are recomputed and only their kinds are uploaded.
- **Network cam.** `network` is closer (dist 2.4).
- **Also fixed.** A one-pixel line of the floppy drive showed through the bezel next to the slot while the case was
  open. The drive now sits 2 mm further back. A pulse now has a soft head as well as a soft tail.
- **Known, minor.** In the software renderer (SwiftShader), two isolated pixels on the back of the case show the
  part behind it in one view. This was already there before the review. Check on a real GPU and a headset.

After review 2 (five minor issues, all fixed):

- **Edge ends.** Straight network edges fade softly into their nodes (over 0.004 to 0.02 from the node's centre)
  instead of ending in a hard square cut seen in close-ups.
- **Junction dots.** They go out at `mac_net` 0.12 to 0.28, before the wires start to straighten.
- **Draw calls.** Parts at scale 0 are no longer drawn. The network look went from 31 draw calls and 108k triangles
  to 2 and under 1k. The shut computer went from 32 to 16 draw calls, because the parts inside it are hidden.
- **Half fade of the teardown.** The depth prepass now also covers the picture tube and is on whenever the set
  fades before the network forms, so a cross-fade from 'Taken apart' no longer shows the inner walls of the case
  or the yoke through the tube.
- **Explore jump from Network to Computer.** Nodes turn back into parts on the table before the parts fly home
  (see Explore).
