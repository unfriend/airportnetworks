# `hier` - organ architecture and domain contacts (sets/hier.js)

Two pictures in one set, centred on the origin, facing +z.

- **The four-level network** (`MICRO_DATA.graph`, Iva Buljan's network; the talk's Figure 5a in 3D): four stacked
  horizontal rings, wide at the top and bottom and narrow in the middle, so the network stands as an hourglass:
  organs (29, y 0.66, radius 0.9, dark green `#1f8a4c`), tissues (24, y 0.28, radius 0.7, green `#7ccf7e`), tissue
  types (10, y -0.1, radius 0.4, salmon `#ef8f7a`) at the waist, domains (70, y -0.62, radius 0.9, blue `#5aa9ff`; no
  ring is wider than the organs', so the level labels on the right have room).
  Nodes are lit spheres with a soft additive halo, sized by degree (domains, which all have one link, by the graph's
  abundance); each organ is its small 3D model (`ORGAN3D`, `sets/organs.md`; radius 0.062 + 0.005 √degree), turning
  slowly in a glow of the level's dark green, built between frames from the story's start (spheres until then). Links
  hang between the rings as soft glowing tubes (radius 0.0095, six-sided, curves that leave each node vertically,
  lit across, bright along their middle and fading to their edges), in a gradient from the upper level's colour to the
  lower one's, with a light running down them now and then. While a node is focused its links grow a little, brighten
  and whiten at their core; the others stay in view as coloured tubes at 55 % (never hairlines). Each level is the glowing rim of a faint plate (a soft bright line at the
  ring's radius with a sheen fading inwards over 0.16), so the stack reads as four floors in depth from any side. The order round each ring is computed so that threads stay short (tissue types ordered by the
  organs they share, organs and tissues pulled towards their rare tissue types, domains in arcs under their tissue type);
  the whole is turned so that connective tissue, the biggest hub, faces you. The graph's five tissue type-tissue type
  links are loops of a type to itself and are left out (199 links drawn).
- **One organ's domain-contact network**, in front of it (centre [0, 0.02, 0.45], at most 0.95 wide and 0.85 tall): its
  domains as spheres in domain colours, contacts as glowing tubes ("bands") whose width is the share of contacts. On its
  right a column of notes, each joined to its band by a thin leader line in the band's colour: the changing contacts and
  "The core stays", at their bands' heights (spread at least 0.085 apart); the column's top row says the drawing is
  illustrative, its foot gives the age. The `contacts` view looks at a point right of the network's middle so the
  column is in the picture. With
  `hier_contacts` the network steps back (z -0.85, scaled 0.8, dimmed to about a tenth; the organ's own node stays lit),
  and the organ's domains fly out of the domain ring into the contact network (a domain not in the graph, calcified
  plaque, flies from the organ's tissue node). As `hier_age` goes from 20 to 70 years, the contacts that change grow or
  shrink and glow warm (amber, more contacts) or cool (cyan, fewer; only just tinted at 20, fully at 70); the rest, the
  core, stays as it is, in pale lilac tinted towards the two domains it joins (a gradient along the band). The bands are
  soft-edged tubes with a bright core and carry a quiet flow of light.

## Params

| Param | Range | Meaning | Suggested keyframes |
| --- | --- | --- | --- |
| `hier_a` | 0..1 | the set's fade | |
| `hier_grow` | 0..1 (rest 1) | the network grows top to bottom: organs 0-0.18, tissues 0.22-0.4, tissue types 0.44-0.62, domains 0.66-0.84 (each ring grows round from the back; threads draw down to each node as it appears; a node grows over 0.1 from its start, `api().layout().start`); the connective tissue callout from 0.8. Below 0 is 0 | chapter 5: keyed with the atlas set's `atlas_net` at the same times, from -1/3 to 1 over 16.5 s, so the network grows as the atlas's things arrive at its nodes (see `atlas.md`, "The morph into the network") |
| `hier_focus` | -1..132 (rest -1) | a node index into `MICRO_DATA.graph.nodes`: it and everything linked to it up and down the levels light up (direct links fully, two steps 0.6, three steps 0.35), the rest dims; the node grows and gets a pulsing ring; its label and up to six neighbours' labels show. From a domain that the talk's atlas names, the walk up reaches only the organs whose atlas maps show it (and their tissues) | **put it in the engine's `STEP` set** (jump; the set crossfades for 0.3 s by itself). A fractional value crossfades the two nodes either side |
| `hier_contacts` | 0..1 | the contact network comes forward: nodes fly 0.04-0.56, bands draw from both ends to the middle 0.55-0.95, its labels from 0.55 | chapter 8: 0 to 1 over 3 s |
| `hier_organ` | 0..5 (rest 0) | which contact network: 0 Colon, 1 Skin, 2 Ovary, 3 Fallopian tube, 4 Uterus, 5 Coronary artery (`api().contactOrgans`) | **put it in `STEP`** (the set crossfades 0.3 s); a fractional value crossfades the two networks |
| `hier_age` | 0..1 | age 20 (0) to 70 (1): the changing bands' widths and colours; nodes of the preprint's examples change size (corpus albicans grows, the gut's submucosa shrinks a little: fourth root of the abundance ratio) | chapter 8: 0 to 1 over 8 s, per organ |

`update(S, t, dt)` is pure in the params except the 0.3 s crossfade after a jump of `hier_focus` or `hier_organ`
during play or while paused. A seek shows the new value at once, so it is exact whatever `dt` the engine passes: the
set takes `t` going back, or on by more than max(0.3 s, 2.5 dt + 0.05 s), as a seek; so are the first frame, the first
after the set was hidden, and `dt` of 0 or over 0.25 s. Time only drives the lights running along threads and bands and
the focus ring's pulse.

## Anchors

`top` (above the organ ring's centre), `bottom` (below the domain ring's centre), `focus` (the focused node, or the
origin), `contacts` (above the contact network's top left, for its title), `change` (the middle of the shown organ's
first changing band), `core` (the middle of its strongest unchanging band), `age` (the foot of the notes' column, below
the lowest node), `connective` (just below and right of the connective tissue node, so its label clears the node),
`lv0`..`lv3` (the right-hand edge of each ring, for the level labels). The network's anchors follow it as it steps
back. The set's own node labels start at a node's edge, not its centre.

## Labels (the set's own)

- Level labels on `lv0`..`lv3` as each level grows: "Organs · 29" and "Tissues · 24 in this map" (green), "Tissue
  types · 10" (amber), "Domains · 70" (cyan; short so it fits beside the ring on a narrow screen: the 70 are this map's
  domain nodes, see below); hidden while a node is focused or the contacts show.
- "Connective tissue · in 28 of 29 organs" (amber, once the domains have grown; computed: organs that reach it directly
  or through a tissue; the brain's two tissues have only neuronal tissue).
- Focus: the focused node "Name · summary" (organ: "Colon · 2 tissues, 3 types"; tissue: "... · 3 tissue types";
  tissue type: "Connective tissue · 28 organs, 19 domains"; domain: "Submucosa · connective tissue, in 4 organs of the
  atlas"), coloured by level; up to six neighbours by name (minor): its direct links when it has at most 8, then for
  an organ the tissue types of its tissues; for a domain its tissue type and the organs whose atlas maps show it. A hub
  (connective tissue, glandular tissue ...) names no neighbours.
- Contacts: "Colon · domain contacts" (title on `contacts`), "Illustrative · trends from the study" (top of the
  column), each domain's name (minor, beside its node), in the column each changing contact ("Muscularis–submucosa ·
  fewer with age", cyan; "Plaque–intima · more with age", amber; names shortened: no "tunica", "calcified" or
  "ovarian"; when one of the organ's names is long, all its notes say only "· more" or "· fewer"; the first two, the
  findings' first, stay on narrow screens, a third is minor), "The core stays" (neutral, from age about 25) and an age
  readout "20 years" ... "70 years" (minor, on `age`, by decade).

## Cam views

`default` [0, 12, 4.15, 0, -0.03, 0] (the whole hourglass), `net` [28, 38, 4.6, 0, -0.2, 0] (from above: the rings),
`contacts` [0, 6, 2.8, 0.28, 0.05, 0.45] (the contact network left of the middle, its notes' column right), `grow` [6, 20,
4.4, 0, 0, 0.12] (from a little above and further back: wide enough for the atlas's sections in front of the network,
while the atlas turns into it in the story).

## Controls (explore)

View (Network / Contacts), Organ (Colon, Skin, Ovary, Fallopian tube, Uterus, Coronary artery; only with Contacts),
Age (20 years / 70 years; only with Contacts). `explore(c)` returns `hier_grow` 1, `hier_contacts`, `hier_organ`,
`hier_age`; it does not touch `hier_focus` (the engine's Organs and Domains tabs set it).

## Explore API `api()`

- `nodes`: `[{ i, name, level (0..3), levelName }]` in graph order; `levels` (`MICRO_DATA.levels`).
- `pick(raycaster)` -> node index or -1 (the nearest visible node along the ray within 1.6 radii; with the contacts
  shown, the shown organ's contact nodes: a domain's graph index, -1 for calcified plaque).
- `find(name)` -> index or -1 (case-insensitive); `linked(i)` -> `{ up, down }` (direct links, indices);
  `organsOfType(i)` -> the organ indices a tissue type is found in; `organsOfDomain(i)` -> the organ indices whose
  maps in the talk's atlas (`MICRO_DATA.figures.atlas`) show domain i (48 of the 70 domains; [] for the rest or
  without figures): for the Domains tab's "found in".
- `contactOrgans`: `[{ name, organ (graph index), tissue (graph index or -1), domains: [names], changes: [{ a, b, dir,
  from, to (shares at 20 and 70), fig (true when from the figures) }] }]`.
- `layout()`: where the network stands and when each node grows, for the atlas set's morph into it (the engine hands it
  over in `buildScene`): `pos` (rest positions in this set's frame, no contacts shown), `level`, `name`, `up` (direct
  links upwards), `start` (the `hier_grow` at which a node starts to grow; `span` 0.1 later it is grown, scale from 0.25
  and alpha from 0), `size` (its radius grown; an organ's model's `ORAD`), `spin` and `spinRate` (an organ model's turn
  is t x spinRate + spin), `levelStart` (each level's start).
- `levelColour(level)` -> '#rrggbb'; `useColours(fn)`: recolour the contact networks' domains with the atlas set's
  `domainColour(name)` (the set also takes `K.domainColour` at build time if the engine puts it there). Until then
  domains take the talk's tissue-type colours (Figure 5b), a little varied per domain; calcified plaque is bone white.

## Data and what is illustrative

- The four-level network is the data (`MICRO_DATA.graph`): 29 organs, 24 tissues (the sampling sites of the 13 organs
  sampled at more than one site; the other 16 organs are one tissue each, so 24 + 16 = the 40 tissues), 10 tissue
  types, 70 domain nodes. The domain nodes are named domains of this map (some merged, such as "adrenal cortex or
  medulla"); they are not the preprint's 218 domains or 74 domain types, so the label says "70 in this map".
- Domains hang only from tissue types in the graph: the graph does not say which organ a domain is found in. The
  talk's atlas does, for the organs it maps (one map per organ; names matched, the figure's spellings such as
  "adventita subserosa" and "adipose tissue" for fat mapped): focusing such a domain lights its tissue type fully and
  only those organs (0.6) and their tissues; a domain the atlas does not name lights every organ with its tissue type
  faintly (0.6, 0.35).
- The contact networks: which domains each organ shows, which pairs touch and the base shares are illustrative
  (layers that touch in that organ's wall). The changes come from the preprint's findings
  (`MICRO_DATA.findings.interactions`): colon muscularis–submucosa fewer, skin subdermis–reticular dermis fewer, ovary
  mucosa–fibromuscular tissue more, fallopian tube mucosa–muscularis fewer and mucosa–fibromuscular tissue more, the
  uterus's endometrium towards connective tissue (drawn as endometrium–"connective tissue and adipose tissue" more),
  coronary artery calcified plaque–tunica intima more. Without figures a change is 0.26 of share over 50 years
  (illustrative).
- From the talk's figures (`MICRO_DATA.figures`, read when present): Figure 5e's changes per decade
  (`borderContactAndMotifs.borderContactChangePerDecade.rows`: a pair read both ways is averaged; under 1 point per
  decade, as fallopian tube muscularis–fibromuscular tissue, is left out; unnamed clusters are left out), and Figure
  5f, g's trajectories (`trajectories`, "a-b, tissue" with points by age) for the shares at 20 and 70. Today that sets:
  fallopian tube mucosa–muscularis 84 % to 46 % and mucosa–fibromuscular tissue 20 % to 66 % (the trajectories);
  ovary ovarian stroma–corpus albicans +4.5 and ovarian stroma–ovarian cortex -4.6 per decade; uterus
  myometrium–endometrium +6.0 per decade; coronary artery fat ("adipose tissue" in the figure)–tunica media +5.5 and
  fat–tunica intima +5.4 per decade (new, thin bands that grow). The colon's figure rows are the small intestine's,
  so the colon keeps the findings' direction with the illustrative size. `figures.interactions` (the coronary artery's
  network of tissue types at five ages, other organs' tissue-type motifs) is at the level of tissue types, not
  domains, and has no calcified plaque, so the set does not draw it.

## Narrator: may and must not say

- May: organs are built from a few kinds of tissue, and the same kinds recur; connective tissue is shared most widely
  (in 28 of the 29 organs here); the levels organ, tissue, tissue type, domain; most of an organ's contact network stays
  the same with age (a resilient core) while a few contacts change; the named changes above.
- Must not: give the drawn band widths or the 0.26 default as measurements; say that a focused domain is found only in
  the organs that light up (the atlas maps one section per organ); say the network has 218 domains (it has 70 domain
  nodes, "Domains · 70"); call the contact networks of colon, skin and uterus measured beyond the direction of the
  named change.

## Cost

7 draw calls (threads, rings, nodes, halos, organs, bands, leader lines), about 98,000 triangles (threads 41,000,
rings 1,300, nodes, halos and bands) plus the organs' models (46,000), 18 line segments, no points. Built in 85-100 ms
in headless Chromium on a machine with a load average of about 15 (the version before it took the same in the same
runs, 45-65 ms unloaded); the organs' models build separately, between frames (`idle` steps them 3 ms a frame while the
set is hidden, `update` 4 ms while it shows; `finish` builds them at once for the harness and the sweeps).
