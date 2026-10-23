# tools/ovary: the sources of the aging ovary story (`stories/ovary.js`)

"The aging ovary: what 255 ovaries show about aging", after the poster "Mapping the histological landscape of human
ovarian aging" (Parijat Chakraborty, Samir Moustafa, André Rendeiro; LBI for Network Medicine, CeMM, Faculty of Computer
Science, University of Vienna; support CeMM and the ERC; data GTEx). Built like the microanatomy story (`tools/micro/`):
the tour's kit and body set, the microanatomy story's organ models, and three sets of its own. Everything is drawn as lit
3D objects; no GTEx image and no image from the poster is used. American spelling in this story only. Never edit
`stories/ovary.js` by hand.

```sh
node tools/ovary/data/gen_data.mjs      # -> sets/data.js (OVARY_DATA)
node tools/ovary/build.mjs              # writes stories/ovary.js
node tools/ovary/build.mjs --check      # exits 1 if out of date
```

| Path | What it is |
| --- | --- |
| `data/figures.json` | the poster's figures as read (two readers, reconciled; disagreements decided by a third reading, in `resolved`) |
| `data/gen_data.mjs` | the poster's numbers (typed in exactly), the readings and an illustrative cohort of 255 donors -> `sets/data.js` |
| `sets/data.js` | `OVARY_DATA` (generated; its header documents the fields) |
| `sets/look.js` | `OVARY_TREND` (the poster's lines and numbers looked up) and `OVARY_LOOK` (colors, the lit material for merged objects by age, masks, shapes, surface nets) |
| `sets/organ.js`, `sets/section.js`, `sets/charts.js` | the 3D sets (the cut-away ovary; a drawn H&E section with the method and the network; the donors' slides and age histogram), each with a manifest `sets/<name>.md` |
| `engine/e1_head.js` ... `e7_app.js` | the story engine, adapted from the microanatomy story's: the six chapters, the explore tabs (Objects, Age, Methods, Scenes) and the headset panels |
| `SPEC.md` | what each set and the engine must do, the chapters, explore mode; read with `tools/lbi/SPEC.md` |
| `build.mjs` | the assembler |
| `harness.html`, `shot.mjs`, `sweep.mjs` | one set alone (`with=body` draws the body behind it; `cam=` a view by name or six numbers; `nofinish=1` leaves what builds between frames unbuilt), its screenshots, and screenshots of the whole story (`SHOTS=<dir>` and `PORT=<port>` for both tools) |

The story draws no trend or comparison charts (the owner's rule against 2D graphs): the trends are told on the ovary,
whose tags give each method's count on the poster's lines (read off its figures: approximate), and in words. The
illustrative cohort in `OVARY_DATA.cohort` (drawn to follow the poster's lines, bands and shares at
zero, and to give about its r) is no longer drawn, apart from its ages filling the histogram's bars; the lines, r and p
are the poster's. The network of the last chapter is the poster's next
step, drawn as an illustration.
