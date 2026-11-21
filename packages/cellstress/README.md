# Cell stress test (a story package)

A measuring tool, not a story: the cell map story's model cell (`stories/spatial.js`), with its membrane, nucleus, ER,
Golgi, mitochondria, small organelles and cytoskeleton drawn with the same shaders, filled with as many made-up
proteins and links as explore mode asks. It answers "how many proteins and links could a spatial interactome hold in a
headset at 72 fps?" before a story is designed around a bigger cell.

- Made by: the app's authors (hidden: open it with `#cellstress`, or from the Stories screen in developer mode).
- Data: none. Places, copies and links come from a seeded random draw (`src/sets/cell.js`), shaped like the cell map's:
  proteins shared between the thirteen places roughly as in the Human Protein Atlas, about a third in two or more places
  (a copy in each), about two thirds of the links inside one place, and a few hubs. Nothing to ask permission for.
- Narration: none.

## Two ways to show the links

- *Top links + cables* (the default, after the first headset test: 20,000 dots are fine, more than about 2,000 links
  are too heavy inside the cell and too much to read anywhere): every link between two places becomes part of one
  cable for that pair (a tube as wide as the square root of its links; a pair with under 3 % of the busiest pair's links
  gets none), and inside each place only its most important links are drawn, *Top links at most* (1k, 2k, 3k) in all,
  shared between the places by the square root of how many links each has. "Important" is a made-up evidence score,
  higher between well-connected proteins, with noise (with real data: a database's score). Each place's cables meet at
  one fixed spot inside it (illustrative). Links are straight by default.
- *All links*: every link of the network, as in the first test.

## What it draws, and why that is the cell's cost

The same way as the cell map: every copy of every protein in one `THREE.Points` draw, every link in one
`THREE.LineSegments` draw (each a curve of 14 pieces bending away from its place's centre, every vertex carrying the
cell's attributes, blended additively), and the see-through organelle skins (double-sided, a rim shader, the ER's
sheets and the mitochondria's cristae). Picking, labels and the proximity lens are left out: they run on hover only.

## Measuring on a Quest

1. Open `#cellstress&explore` (or the card in developer mode), enter the headset.
2. Turn on the frame rate read-out: press B or Y twice (or the menu: Settings, *Frame rate*). It shows frames a
   second against the refresh rate, frame times, triangles, draw calls and the story's own script time.
3. Turn *automatic quality* off for a fair reading (the menu's Settings), or it lowers the resolution and the refresh
   rate to keep up, and the read-out then shows 72 fps at a smaller picture.
4. Step up *Proteins* and *Links* until it drops below 72; try *Pieces per link* and *Organelles: off* to see which
   part costs. Look from outside, then make the cell big with both grips and put your head inside: the inside is the
   hard case (every see-through line and skin covers the whole view).

The pane says what is drawn (dots, links, line pieces, vertices) and how long the last build took (a rebuild of the
biggest sizes stalls a frame or two: that is the test, not the story).

Links: `#cellstress&explore&np=20000&nl=80000&budget=3000`, `&show=all`, `&curve=14`, `&shells=0`, `&view=inside`.

## Building it

`src/` is a copy of `tools/packages/template` with its own set (`src/sets/cell.js`), a one-chapter story
(`src/engine/e3_story.js`) and the pane's count of what is drawn (`statsLine` in `e4_explore.js`, its twin in
`e6_panels.js`).

```
node packages/cellstress/src/build.mjs
node tools/packages/scan.mjs
node tools/packages/check.mjs packages/cellstress --load
```
