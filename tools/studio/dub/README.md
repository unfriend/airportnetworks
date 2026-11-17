# The dub techno desk (example scene)

`examples/dub-techno/`, the studio's second example scene (v158): a mixing desk of bright shapes in a room of about
5 x 5 m round the scene's origin, whose controls are streamed to the output page as MIDI, to play a dub techno patch in
Cardinal (VCV Rack as a plugin). Cardinal plays the groove by itself on its own 120 bpm clock (kick, offbeat hats, a
minor chord stab through a dub delay and a big reverb), with no MIDI at all; the room shapes it. The output page's Tempo
at 120 bpm, 4 beats a bar, with *MIDI clock out* on, is the room's beat (the wobble sphere locks to it): its Start puts
the patch back to bar 1 at the room's downbeat and its Stop stops new notes (Cardinal does not follow MIDI clock ticks:
its Host MIDI gives none). The patch and how to set it up are in `tools/output/cardinal/` (its `README.md`); the MIDI map
below is the contract between them (channel 1; CCs at 0 a quiet, sensible setting).

It is made by `node tools/studio/dub/make.mjs` (plain Node: only studio shapes and trigger cubes, no model, picture or
sound file), which writes `examples/dub-techno/layout.json` and then runs `tools/studio/scan.mjs` on `examples/` (the
listings). Never edit the folder by hand. `node tools/studio/dub/make.mjs --check` says whether the folder is what it
makes, and checks the layout against the studio's limits and record rules for what it uses (ids, streams, sends, the
path, trails, the counts); the engine's own checks run when the page opens it (nothing dropped, nothing counted as bad,
the scene not *Unsaved*).

## Where things are

Start at the scene's middle facing the desk (-z); in a shared room put spot A there. In front of you the desk, its top
at 0.85 m; behind you the dance floor (violet, on the floor) with the wobble sphere circling over it; behind you to the
left the drop zone (red, on the floor); left and right of the desk the dub wand (white) and the orb (violet); two
speaker stacks behind the desk. Names say what each does while editing.

## The controls and the MIDI map (channel 1 for everything)

| In the room | How to play it | Sends | In the patch |
| --- | --- | --- | --- |
| Fader A (cyan knob on rail A, the near one) | carry it along its rail | CC 20, its x across the rail's ends | Filter (the stab's cutoff) |
| Fader B (green knob on rail B, the far one) | carry it along its rail | CC 21 | Echo feedback (capped below runaway) |
| Turntable (amber platter) | turn it about the vertical | CC 22, its yaw -180..180 | Space (reverb) |
| Orb (violet ball) | lift or lower it, 0.8 to 2.0 m | CC 23 | Stab decay |
| Dance floor (violet, a cube for everyone) | stand on it, more people more hats | CC 24, people inside 0..3 | Hats |
| Dub wand (white, an amber trail) | carry it and swing it | CC 25 from its speed 0..2.5 m/s (smoothed); note 51 past 0.7 m/s, its velocity from the speed | Throw (delay send) and Siren |
| Wobble sphere (cyan, over the dance floor) | nothing: it loops 8 beats on the room's beat | CC 26, its x across the circle | Wobble (filter modulation) |
| Pad A (amber) | press it (editing off) | note 48 | Stab |
| Pad B (red) | press it | note 38 | Rim |
| Pad C (violet) | press it | note 51 | Siren |
| Drop zone (red, a cube for everyone) | stand in it | note 36 held while anyone is in it (off once the last has left) | the kick muted: a breakdown |

The knobs, the platter, the orb and the wand can be carried by anyone (`grab`: a headset's grip, or dragged along the
floor on a page, which moves x and z only: the orb's height needs a headset). Nothing holds a knob on its rail: carry it
along. Where they start: fader A at 0.6 of its rail (a half-open filter), fader B at 0.4 (a moderate echo), the platter
straight (Space in the middle), the orb at 1.2 m (a short-ish decay), nobody on the dance floor (no hats yet), the wand
still (no throws). A value at 0 is a quiet, sensible setting in the patch, so the room may be entered anywhere.

The faders, the orb, the wand and the sphere leave trails of light, and the scene's settings turn on people's hand trails
(3 s), for everyone at the circle.

## Playing it

1. Open the studio with this example (Scene pane, *Examples*, *dub-techno*: *Open*, or *Copy to the relay* for a shared
   room; at a circle the example's button opens it for everyone there).
2. Open the output page, choose the MIDI output Cardinal listens on, set its Tempo to 120 with *MIDI clock out* on, and
   press Start: the room has a beat, the wobble sphere locks to it, and Cardinal's own clock starts again at bar 1 with
   it. Press Start again if the two seem to drift apart.
3. Cardinal plays as soon as the patch is loaded; if nothing plays, it was stopped by a MIDI Stop: press Start.
4. Turn editing off to press the pads; carry the knobs, the platter, the orb and the wand.

## Rules

Everything here is our own: shapes made in code, no models, pictures or sounds of anyone else's. Keep it so. After
changing `make.mjs`, run it, then `--check`, and open `#studio&scenes=examples&scene=dub-techno&edit`: the Scene pane must
say nothing about bad entries and the scene must not read as unsaved.

Untested: everything on a headset (carrying the knobs, how the glow and the trails read in AR and VR), the output page
and Cardinal playing it (real MIDI), how it sounds; the patch is in `tools/output/cardinal/`.
