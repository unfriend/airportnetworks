# `cell` - the cell map's cell (sets/cell.js)

The cell map story's cell, exactly as it is: built by that story's own `buildScene` from its own lists (`PLACES`,
`PROTEINS`, `LINKS`, `TOGETHER`, `MOVES`), layout and shaders, cut out of `stories/spatial.js` by `build.mjs`
(`PASS_SPATIAL`, see SPEC.md). Radius 1 (a cell about 20 micrometres across; the membrane is a slightly flattened
ellipsoid), centred on the origin. 249 proteins (282 copies, one per place), 252 links, 13 places, 10 organelles, 7
moves (`api.counts()`).

- **Driven as in its own story**: the original's `applyUniforms` (organelles one by one, proteins and links appearing,
  colour by place or by number of places, focus on a path, the moves' presence) and `updateLight` are redone here from
  params; its highlights are the ones its story makes: two proteins meeting (EGF, its receptor and GRB2: `ex`), the
  growth signal from EGF outside to SRF in the nucleus, hand to hand (`path`, 10 hops, ERK moving into the nucleus on
  the way), and the relay TNF starts towards NF-kB (`cue`, 6 hops). Moving proteins travel as the original's bright dots
  (its `exploreStep`): while a move is under way its proteins travel along their way (through a nuclear pore into or out
  of the nucleus), and one that fails (CFTR, in cystic fibrosis) turns red and stops a third of the way. Fading,
  lighting and point sizes as in the globe (see globe.md).
- **German**: the original's place, organelle and move names and texts are English; the set holds German for the 13
  places, 10 organelles and 7 moves (name, title, text). Protein names and roles stay as in the original (open: see
  SPEC.md).

## Params

| param | default | meaning |
| --- | --- | --- |
| `cell_a` | 1 | fade (engine) |
| `cell_org` | 10 | organelles shown: they appear one by one (membrane, nucleus, nucleolus, ER, Golgi, mitochondria, lysosomes, vesicles, peroxisomes, cytoskeleton) |
| `cell_shell` | 1 | the organelles' skins (1 on, 0.35 faint, 0 off) |
| `cell_names` | 0 | the organelles' names as labels (each as it appears) |
| `cell_reveal` | 1 | proteins and links appear |
| `cell_links` | 1 | brightness of the links |
| `cell_ids` | 1 | the dotted links between the copies of one protein |
| `cell_multi` | 0 | colour by number of places instead of by place |
| `cell_focus` | 0 | the rest dims, the growth signal's proteins glow as the signal reaches them |
| `cell_ex` | 0 | two proteins meet: EGF, its receptor and GRB2 (0-1) |
| `cell_path`, `cell_path_a` | 0, 1 | the growth signal, in hops (0-10), and its alpha |
| `cell_cue`, `cell_cue_a` | 0, 1 | the relay from TNF to NF-kB's brake (0-1) and its alpha |
| `cell_nfkb`, `cell_apop`, `cell_tfeb`, `cell_glut4`, `cell_nrf2`, `cell_als`, `cell_cf` | 0 | how far each of the cell map's moves has gone (0-1; its s0 ... s6) |

Suggested story keys (chapter 5): `cell_org` 0 -> 10 over 10 s with `cell_names` 1 (then 0), `cell_ex` 0 -> 1 ("proteins
meet partners in particular places"); the signal: `cell_cue` 0 -> 1 over 4 s, then `cell_nfkb` 0 -> 1 over 4 s (or the
growth signal: `cell_focus` 1, `cell_path` 0 -> 10 over 12 s); the wrong place: `cell_cf` 0 -> 1 over 4 s (CFTR caught in
the ER, never arrives) or `cell_als` (TDP-43 leaves the nucleus; its partners there lose it, red flashes). Ease moves
linearly over about 3-4 s (the travelling dots follow the value).

## API (`set.api`)

`pick(raycaster)` (the copy nearest a world-space ray, as the original's `pickCopyRay`; -1 for none), `select(p, copy)`
/ `selected()` (the original's selection: its links as tubes, a ring, a label), `info(p)` (sym, name, role, places
`[{ k, name }]`, partners by place `[{ place, name, list: [{ p, sym, here, across }] }]`, degree, moves), `moveDelta(key)`
(`[{ p, sym, lost, gained }]`: partners lost and gained by the move), `protein('SYMBOL' | index)`, `copyOf('SYM@place')`,
`proteinOf(c)`, `pos(c)`, `search(q, n)` (the original's `matches`), `moves()` / `move(key)` (name, title, text, disease,
in the set's language), `path(a, b)` (the original's `bestPath` over the copies there now), `highlight(key, pairs,
colour, opts)` and `setFocus(list, stepped)` (the original's), `isolate(placeIndex | null)`, `placeName(k)`,
`placeShort(k)`, `orgName(k)`, `places()`, `growthPath()`, `relay()`, `counts()`, `original` (the cut-out story: `NET`,
`CELL`, `MOVES`, `reachInfo`, `placeStats`, `proteinReach` ...).

## Anchors, labels, views, controls

Anchors: the organelles (`org_pm`, `org_nuc`, `org_nucl`, `org_er`, `org_golgi`, `org_mito`, `org_lyso`, `org_endo`,
`org_perox`, `org_cytosk`, the original's `orgAnchor`), and every protein copy as `SYMBOL@place` and `SYMBOL` (its usual
place). Labels (in the set's language, shown by the params): the organelles' names; EGF "growth signal", EGFR
"receptor", ERK "in the nucleus", SRF "gene switch" (teal `tl`, along the growth signal); TNF "inflammation signal" (teal),
RELA "NF-kB, waiting", IkBa "its brake", RELA "in the nucleus" (amber); CFTR "caught in the ER" and "never arrives",
TDP-43 "leaves the nucleus" and "clumps in the cytoplasm" (amber); the selected protein (cyan). Views: `default` (the
cell map's explore view, a little closer), `nucleus`, and from the side, so each way runs across the picture: `signal`
(EGF to SRF), `nfkb`, `cf`, `als`. Controls (Scenes tab, getter): View (Whole cell, Nucleus, From the surface),
Organelles (On, Faint, Off), Colour (By place, Number of places), Move (None, Inflammation, Cystic fibrosis, ALS).

## Science

As the cell map story: an illustrative, curated set of well-studied human proteins and documented interactions, placed
in a model cell (Human Protein Atlas, UniProt and the literature, as that story credits); say "in this map". The moves
and the two disease cases are the cell map's own, in its own words (`MOVES`), translated.
