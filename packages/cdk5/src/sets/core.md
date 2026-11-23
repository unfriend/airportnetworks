# core: the close-up at the map's centre

Each scene's centre proteins (`CDATA.scene(k).centre`, at their places in `CDATA.layout(k)`: the authors' spring layouts
scaled up about CDK5's middle place to radius `CDATA.CENTRE_R`, 0.42) as lit balls (TLOOK balls) in their scene's
colours with their names, and the scene's links among them as lit tubes in the links' colours (CDATA's, the authors'
exactly). Drawn in the net set's frame (`FRAME = { core: 'net' }`). Ours: the drawing itself (balls, tubes, names), the
pulses and the cut's tags; the places and colours are the authors'.

## Params

| Param | Range | What |
| --- | --- | --- |
| `core_a` | 0..1 | fade (the engine's) |
| `core_scene` | 0..5, eased | the scene; the engine keys it with `net_scene`. Between two scenes the balls move from one place to the next and a protein leaving or joining the centre fades with the move; scenes 0 and 5 have no centre |
| `core_names` | 0..1 | 1 every name, 0.5 the key ones only (BDNF, NTRK2, p35, p39, calpain, APP, LMNB1, FOXO3, GOLGA2, PRDX1, with short roles) |
| `core_hyper` | 0..1 | CDK5's ball green to red, its halo brighter and pulsing faster (two oscillators mixed, a function of `t`) |
| `core_cut` | 0..1 | the CDK5 - calpain link the authors drew comes in and flashes once (a function of the param alone); tags "p35 cut into p25 · CDK5 stays on" and "Drawn by the authors · calpain acts on p35" while the calpain scene shows |
| `core_flow` | 0..1 | pulses run along the pathway's links level by level (breadth-first): NTRK2's from BDNF and NTF4 in cyan (scene 2), the Alzheimer's from CDK5 in orange (scene 4); each protein brightens as the wave reaches it; a function of `t` |

Defaults: `core_scene` 1 (the activators), every other 0, names 1.

Colours: CDK5 `CLOOK.C.cdk5` to `hyper`; p35 and p39 `activator` wherever they are named; others by the scene's colour
lists (cyan the pathway, yellow calpain, orange the Alzheimer's pathway). A protein at the centre that the scene does
not colour (p39 in scenes 2 and 4) is a faint small ball without a name. Sizes: CDK5 0.045, named 0.028, faint 0.016.

## Anchors, labels, views

Anchors: `centre`, `cdk5`, `capn1`, `bdnf`, `ntrk2`, `app` (each its ball now), `top`, `cutTag` (under CDK5), `cutMid`
(the drawn link's middle). Labels: every centre protein but CDK5 (the net names it), the key ones with roles; the rest
are `minor` (they give way on narrow screens). Views: `default` (the centre close-up, 1.9 away), `low` (from below).

## api()

`pick(rc)` (a THREE.Raycaster in world coordinates: the nearest ball it passes through, a protein index, or -1),
`pos(i, out)` (a centre protein's ball now, in the net's frame, or null), `posFrom(fn)` (the engine hands the net's
places over, `fn(i, out)`, so a ball follows its point and the net's stagger; without it, the harness, the balls move
straight between the two layouts), `eye(x, y, z, clr)` (the viewer in the set's frame and how near nothing may be drawn,
in the set's units: the engine passes 0.35 m in a headset; a ball, tube or glow fades out between clr and 1.6 clr of the
eye), `proteins()` (every centre protein).

## Cost

Three draw calls (balls, tubes, halos). At most about 50 balls (352 triangles each), 160 tubes and 220 glows: about
20k triangles. Builds in about 15 ms; nothing allocated per frame (pools refilled, the link twins between scenes
precomputed).
