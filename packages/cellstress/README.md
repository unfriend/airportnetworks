# Cell stress test (a story package)

A test bed, not a story: the cell map story's model cell (`packages/spatial/main.js`), with its membrane, nucleus, ER,
Golgi, mitochondria, small organelles and cytoskeleton drawn with the same shaders, filled with made-up proteins and a
made-up database of links. It first answered "how many proteins and links can a headset show at 72 fps?" (about 20,000
dots, about 2,000 links); now it tries out a method for putting an interactome back into the cell, on made-up data
whose truth is known, before trying it on a real interactome.

- Made by: the app's authors (hidden: open it with `#cellstress`, or from the Stories screen in developer mode).
- Data: none. Places, copies and links come from a seeded random draw (`src/sets/cell.js`), shaped like the cell map's:
  proteins shared between the thirteen places roughly as in the Human Protein Atlas, about a third in two or more places
  (a copy in each), a few hubs. Nothing to ask permission for.
- Narration: none.

## The method

Two proteins can bind only where they share a **space**: a body of water bounded by membranes (the cytosol, the
nucleoplasm, the ER's, the Golgi's, a mitochondrion's, a lysosome's, an endosome's or a peroxisome's inside, or outside
the cell). A soluble protein is in its place's space; a membrane protein (all of the plasma membrane's and the nuclear
envelope's, part of each organelle's) sits in the membrane and faces its inner side, its outer side or both, nudged
that way (a receptor faces outside and the cytosol; the nuclear envelope's inner membrane faces the nucleoplasm).

- **The truth** (made up, so known): every real link joins two locations that share a space. Each mitochondrion,
  lysosome, endosome and peroxisome is a space of its own. Two membrane proteins of different places meet only at a
  contact site (ER with the plasma membrane, mitochondria, lysosomes, endosomes, peroxisomes, the Golgi and the nuclear
  envelope; mitochondria with lysosomes).
- **Modules**: proteins come in modules of 3 to about 40 (as complexes and pathways), most of a module's members in
  the module's place; four in five true links stay inside a module, and those score higher (a complex's members are
  found together again and again), so they lead the links on show.
- **Where a link is drawn**: a dot stands for a protein where it meets others. In a large place each module gathers round
  its own spot (on its membrane, or at its distance from the nucleus); a link inside one place that is still longer than
  0.12 (in the cell's radius) gets a dot of the less connected partner beside the other, so hubs stay put and partners
  gather round them. Each listed location has its own dot; a
  link inside one of the many organelles is drawn inside one of them (the partner gets a dot there too: a protein of the
  mitochondria is in all of them), a soluble protein meeting a membrane gets a dot beside it, and at a contact site one
  membrane protein moves to the point of its membrane nearest the other (an ER protein, or a lysosome's beside a
  mitochondrion's, is drawn beside its partner: this model's ER only wraps the nucleus, a real one reaches everywhere). So no link joins two mitochondria, and links
  to membranes are short. The pane counts the dots at listed places and the ones added where proteins meet.
- **The database** sees proteins, not copies, and not cleanly: *Artefacts* (none, 10 %, 30 %: links between proteins
  that never meet, as a two-hybrid screen or a broken-open cell can give) and *Missing locations* (none, 10 %, 30 %: a
  place left out of a protein's list; one is always kept; the dots are the listed copies only). *None* and *None* hide
  both: the database is then the truth.
- **The judgement**, from the lists alone, by the membranes between the two proteins' closest listed copies:
  *possible* (a shared space, and for two membrane proteins of different places a contact site: drawn there, in its
  places' colours), *through a gate* (amber: one known crossing apart:
  nuclear pores; import into the ER, mitochondria and peroxisomes; vesicles between the ER, Golgi, lysosomes, endosomes
  and outside; drawn bending over the inner organelle's surface), *impossible* (red, straight: more crossings, or no
  gate).
- **The truth's answer**: the pane says how many of the amber and red links are artefacts and how many real links with a
  missing location, and how many artefacts look possible (two random proteins often both touch the cytosol).
- *Show*: possible only (the default), + through gates, + impossible; *Links at most* (1k, 2k, 3k): the most important
  of the kinds on show, shared between the kinds and the possible ones between the places by the square root of their
  counts. "Important" is a made-up evidence score, higher between well-connected proteins, with noise. Amber and red are
  a draw of their own at full strength, or the pale cytosol's links hide them.
- *Pick* (a tab): click a dot (in a headset: point and press) to pick a protein: its places and faces, the places truly
  missing from its list, every database link of it in its colour, dotted ties between its copies; its partners stay
  bright, the rest dims. Or pick a place: its possible links inside it, the most important first, 2,000 at most, the
  other places dimmed. The more lines a pick draws, the fainter each.

## What it draws, and why that is the cell's cost

As the cell map: every listed copy in one `THREE.Points` draw, the possible links in one `THREE.LineSegments` draw
(straight, every vertex carrying the cell's attributes, blended additively), the amber and red ones in another (a link
through a gate in 8 pieces), and the see-through organelle skins (double-sided, a rim shader, the ER's
sheets and the mitochondria's cristae). Picking, labels and the proximity lens are left out: they run on hover only.

## Measuring on a Quest

1. Open `#cellstress&explore` (or the card in developer mode), enter the headset.
2. Turn on the frame rate read-out: press B or Y twice (or the menu: Settings, *Frame rate*). It shows frames a
   second against the refresh rate, frame times, triangles, draw calls and the story's own script time.
3. Turn *automatic quality* off for a fair reading (the menu's Settings), or it lowers the resolution and the refresh
   rate to keep up, and the read-out then shows 72 fps at a smaller picture.
4. Step up *Proteins*, *Links in the database* and *Links at most* until it drops below 72; try *Organelles: off* to
   see which part costs. Look from outside, then make the cell big with both grips and put your head inside: the inside is the
   hard case (every see-through line and skin covers the whole view).

The pane says what is drawn (dots, links, line pieces, vertices) and how long the last build took (a rebuild of the
biggest sizes stalls a frame or two: that is the test, not the story).

Links: `#cellstress&explore&show=2` (all three kinds), `&art=0&miss=0` (the truth), `&art=0.3&miss=0.3`,
`&tab=pick&pp=1` (protein 1), `&pc=4` (a place: 0 Cytosol to 12 Vesicles, in the Pick tab's order), `&np=20000&nl=80000&budget=3000`,
`&shells=0`, `&view=inside`.

## Building it

`src/` is a copy of `tools/packages/template` with its own set (`src/sets/cell.js`), a one-chapter story
(`src/engine/e3_story.js`), the panes' tally and the truth's answer (`statsLine`, `truthLine` in `e4_explore.js`) and the
Pick tab (`renderPick`, `pickLine`; the headset twins in `e6_panels.js`).

```
node packages/cellstress/src/build.mjs
node tools/packages/scan.mjs
node tools/packages/check.mjs packages/cellstress --load
```
