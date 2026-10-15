# `dna`: the basic building blocks of life (slides 9-12)

File `sets/dna.js`, one set `SETS.dna`. The set starts as a long DNA double helix. The helix coils up into the 23
chromosomes. Threads grow out of genes on the chromosomes and fold into 25 AlphaFold-style protein chains in a 5 x 5
grid. Finally that grid becomes a small framed patch in a field of 20,000 proteins.

## Params

The params build on each other: keep the earlier ones at 1 while a later one rises. The engine's current keyframes
already do this. Each param also looks right at in-between values.

| param | default | meaning |
| --- | --- | --- |
| `dna_a` | 1 | Fade (applied by the engine). |
| `dna_helix` | 1 | 0 to 1: the helix is written from the middle outwards, with a bright seam at the growing ends that fades out as it completes. At 1 it turns slowly and a soft glow runs along it "reading" the letters. 0 with everything else at 0 shows nothing. |
| `dna_chrom` | 0 | 0 to 0.3: the helix squeezes onto a coloured cord inside it (23 colours, one per chromosome, each chromatid a segment) and fades into it as a light sheath (0.17 to 0.3), its glow fading with it. 0.26 to 0.98: each chromosome in turn leaves the cord, coils up and flies (arcing towards you) into the karyotype. At 1 the chromosomes sway gently. |
| `dna_fold` | 0 | 0 to 0.18: thin white threads grow out of the chromosomes, each at its gene. 0.04 to 0.84: one chain after another leaves its gene (the last at 0.34), flies to its cell in the grid and folds, taking on its colours. 0.36 to 0.7: the chromosomes fade, so no thread is left hanging in empty space. The chains turn slowly. |
| `dna_field` | 0 | 0 to 1: the field appears from the inside out: 32 small cartoons near the grid, then 200 chains of Cα beads, then about 19,700 points out to a radius of about 15. A glowing cyan frame draws itself around the 25 (0.15 to 0.6). The grid gets a little brighter so it stays visible. |
| `dna_rainbow` | 0 | 0 to 1: protein colours morph from AlphaFold confidence to chain order (N-terminus blue, through green and yellow, to the C-terminus red), on the grid, the small cartoons and the bead chains. Explore only; the story leaves it at 0. |

Suggested story keyframes (the same as the engine draft, chapter `blocks`, `a` = chapter start):
`dna_helix` a to a+3 (0 to 1); `dna_chrom` a+8 to a+13; `dna_fold` a+16 to a+21; `dna_field` a+25 to a+32.
The chromosomes need the whole 5 s ramp, because their coiling is staggered.

## Anchors

- `helix` [0.6, 0.2, 0]: above the helix. `bp`: a base pair near the middle (a function; it follows the turning helix).
- `chrom1`, `chromX`: just above the tip of the short arm. `chrom21`: above chromosome 21, raised to the level of
  X's short arm so a label there covers neither 22 nor X. `chr1` ... `chr22`, `chrX`: centromeres. `karyotype`: centre.
- `fold0` (SRP9), `fold1` (LENEP), `fold2` (GNG5): the top-left corner of each cell, so the name sits above the chain.
  `p0` ... `p24`: cell centres. `grid`: centre.
- `field` [3.4, 2.4, 0.5]: upper right of the patch, for the field label.

## Labels (set labels)

- 'Base pair' 'A–T or G–C' at `bp`, while the helix is complete and `dna_chrom` is still 0.
- 'Chromosome 1' '248 million base pairs' and 'Chromosome 21' 'smallest, 47 million', when `dna_chrom` > 0.85
  and before the proteins start.
- 'SRP9', 'LENEP', 'GNG5' (names only, so they never overlap from oblique views; "compact", "floppy" and "one helix"
  belong in the panel text), when `dna_fold` > 0.85 and `dna_field` < 0.25.
- 'About 20,000' 'kinds of human protein' at `field`, when `dna_field` > 0.8.

**Duplicates:** the engine draft also adds story labels for SRP9, LENEP and GNG5 on `fold0` to `fold2`. Remove one of
the two sets of labels.

## Cam views

`default` [35, 12, 3.9, 0, 0, 0]: the helix in three-quarter view. `helix` [40, 8, 2.6, 0.3, 0, 0]: along the helix
in perspective. `chrom` [0, 4, 4.4, 0, -0.02, 0]: the karyotype. `fold` [0, 3, 4.6, 0, 0.03, 0]: the 5 x 5 grid. Both
leave room for the app's top bar (58 px) and timeline (about 70 px): at 1100 x 700 the karyotype spans y 76-592 px
(labels included) and the grid 78-618 px.
`field` [12, 8, 17, 0, 0, 0]: far out. A tunnel is kept clear of field objects between the grid and az 4° to 36°
(el 8°), so the grid stays in sight in the story's spin from 12° to 27°. Orbiting further round is fine; the grid is
then seen through the field.

## Explore

Two controls:
- `view` 'Show' with options `helix` DNA, `chrom` Chromosomes, `fold` Proteins, `field` All proteins. The option
  values match the cam names, so explore flies to the matching view. Each option sets the four look params
  cumulatively (for example `fold`: helix 1, chrom 1, fold 1, field 0).
- `colour` 'Colour' with options `conf` Confidence, `chain` Chain order (sets `dna_rainbow` 0 or 1). It changes the
  proteins only (Proteins and All proteins views). Panel text for it: "Structure viewers often colour a chain from
  its start (blue) to its end (red), so you can follow it through the fold."

The reviewer suggested a 'Turning' on/off control instead. I did not do that: every turn is a pure function of `t`
(angle = rate x t), so easing a rate param to 0 would wind each shape back through all its turns since the start in
about a second. Freezing needs accumulated state, which the pure-update rule forbids.

## Other exports

`proteins` = [{sym, residues}] for SRP9 (86), LENEP (61) and GNG5 (68), checked against UniProt (P49458, Q9Y5L5,
P63218); each chain in the grid has exactly that many residues. `counts` = { chromosomes: 23, basePairs: 3e9,
genes: 20000, proteins: 20000 } (all "about").

## Budget (measured in the harness)

| look | triangles | points | lines | draw calls |
| --- | --- | --- | --- | --- |
| helix | 16.7k | 232 | 0 | 2 |
| helix to chromosomes | 75k | 232 | 0 | 3 |
| chromosomes | 58k | 0 | 0 | 1 |
| chromosomes to proteins | 181k | 0 | 0 | 2 |
| proteins | 123k | 0 | 0 | 1 |
| field (with the grid) | 193k | 43.7k | 40 | 4 |

The helix, chromosome and field meshes are hidden when their look is off. The build took 190-600 ms in headless
Chromium while the machine was heavily loaded (load average 15-23 on 4 CPUs), typically 230-340 ms. In Node, the
fixed set and the previous version build in the same time side by side (200-340 ms each). No page errors. Every update
is a pure function of params and `t` (checked in Node: same result after an unrelated update); only uniforms, a few
transforms and material flags change per frame.

**Transparency:** fading solid meshes write depth only while they are nearly opaque (the helix while its own fade is
above 0.7, the chromosomes likewise; the protein chains whenever the set is above 0.3), and the draw order is protein
chains, then chromosomes and their cord, then the helix, then glow points. So a fading shape never cuts what lies
inside it.

## Science notes (what is real, what is illustrative)

- **DNA**: B-DNA in proportion: radius 1 nm, 10.5 base pairs per turn, a rise of 3.4 nm per turn, right-handed. The
  strands sit 140° apart around the axis, which gives a major and a minor groove. The sequence is random (41% GC):
  A green, T red, G amber, C blue. Each rung is two half-slabs, one per base.
- **Chromosomes**: the lengths of 1-22 and X are GRCh38 (chromosome 1 = 248 Mb, 21 = 47 Mb). Centromere positions are
  approximate GRCh38 values, so 13, 14, 15, 21 and 22 are acrocentric. The rows follow a karyogram: 1-5, 6-12, 13-18,
  then 19-22 and X. Each chromosome shows two sister chromatids, joined at a narrowed centromere and splaying apart
  towards their tips (in proportion to each arm, so every chromosome reads as an X). The chromatids are coiled fibres,
  mirror-handed. The colours imitate spectral karyotyping. The coiled-fibre look is a textbook
  illustration, not a structural model. One copy of each chromosome is shown (23), not 23 pairs.
- **Proteins**: chains are built in ångström from real geometry:
  - α-helices: 3.6 residues per turn, 1.5 Å rise, right-handed.
  - β-sheets: strands 4.8 Å apart, with the usual left-handed twist across the strands.
  - Packing: helices pack about 10 Å from each other and from sheets.
  - Crossovers: those between parallel strands are right-handed.
  - Loops bulge outwards; termini are floppy.

  The cartoon is drawn the way AlphaFold DB does it: spiral ribbons for helices, arrows for strands and thin tubes
  for loops. Colours use the AlphaFold pLDDT bins. Over the 25 chains, about 41% of residues are very high, 43%
  confident, 5% low and 11% very low.
- **SRP9, LENEP, GNG5**: stylised after their AlphaFold models.
  - SRP9: an α-β-β-β-α fold, a three-stranded antiparallel sheet with both helices on one face.
  - LENEP: mostly disordered, with two short low-confidence helices.
  - GNG5: one long helix with floppy ends.

  The other 22 grid chains are anonymous, illustrative folds. They are of real kinds: TIM barrel, Rossmann and
  flavodoxin-like, ferredoxin-like, Ig sandwich, SH3/OB barrel, helix bundles, globin-like, HEAT solenoid,
  seven-transmembrane, zinc fingers, a leucine-rich-repeat horseshoe, a calmodulin-like dumbbell, a coiled-coil
  hairpin, two-domain and mostly disordered chains. The field is all illustrative.
- The threads come out of the genes' places on chromosome 1 for the three named proteins: SRP9 at 1q42.12, LENEP at
  1q21.3 and GNG5 at 1p22.3. The places of the other 22 are random.

**The narrator may say:** 23 chromosomes; about 3 billion base pairs (letters); about 20,000 protein-coding genes;
each gene is the recipe for a protein; AlphaFold (2021) predicted the shapes of nearly all human proteins;
the colours show how sure AlphaFold is (blue sure, yellow-orange unsure or floppy); chromosome 1 is the largest
(248 million base pairs), 21 the smallest (47 million).

**The narrator must not say:** that the 22 unnamed shapes, the field, or the DNA sequence are real data. Do not say
that these are the real AlphaFold models of SRP9, LENEP or GNG5 ("in the style of" is right). Do not say that a
chromosome is one long coil exactly like this, or that we have only 23 chromosomes: we have 23 pairs. Say "23
different chromosomes" or "23 pairs".

**Checked:** residue counts against UniProt (SRP9 86, LENEP 61, GNG5 68) and the gene bands against NCBI Gene
(SRP9 1q42.12 at 225.8 Mb, LENEP 1q21.3 at 155.0 Mb, GNG5 1p22.3 at 84.5 Mb of chromosome 1's 249 Mb).

## Sources

- International Human Genome Sequencing Consortium, Nature 409, 860 (2001).
- Genome Reference Consortium GRCh38 (chromosome lengths and centromeres); NCBI Gene (gene bands); UniProt
  P49458, Q9Y5L5, P63218 (residue counts).
- Jumper et al., Nature 596, 583 (2021) and Tunyasuvunakool et al., Nature 596, 590 (2021): AlphaFold, the human
  proteome, and the pLDDT colour scheme of AlphaFold DB.
- Textbook protein geometry: Branden and Tooze, Introduction to Protein Structure; Chothia, J Mol Biol 75, 295 (1973)
  on the twist of β-sheets; Richardson, Adv Protein Chem 34, 167 (1981) on right-handed crossovers.

## Deviations from the spec

- **Mini-structures:** the mini-structures near the camera path are one merged mesh, with every mini a different fold,
  rather than an InstancedMesh of repeated templates. The cost is the same, there is one draw call, and no shape
  repeats. Between them and the far points I added a level of 200 chains of Cα beads (points), which turn as the
  minis do.
- **Grid frame:** the field look adds a thin glowing frame around the grid, so "the 25 are a tiny patch" reads at a
  glance.
- **Field size:** the field fills a ball of radius about 15. The `field` camera sits at the edge of the ball (dist 17).
  Points fade out within about 4 units of the eye, so in a headset the field is around you without blurring your view.

## Changes after review 1

- Helix to cord hand-over: per-material depth writes and draw order (see Budget); the helix halo fades with the helix;
  the fading helix brightens into a light sheath instead of leaving dark smudges; it squeezes onto the cord (to 16%,
  not 8%), and the cord is thicker (radius 0.018), so the second after the helix goes shows a bold coloured cord.
- Base pairs glow more (self-glow 0.42 on the slabs, 0.12 on the backbones), so the letters read by colour.
- The write seam fades out over the last part of the reveal instead of switching off.
- Chromosomes splay at their tips in proportion to their arms: clear X shapes, also for the small ones.
- Proteins leave their genes by `dna_fold` 0.34 and the chromosomes fade from 0.36 to 0.7.
- `chrom` and `fold` cams pulled back and centred for the app's bars; label texts shortened, no leading spaces;
  the chromosome 21 label raised clear of 22 and X; 'About 20,000'.
- LENEP has 61 residues (UniProt), and its chain now has 61.
- New explore control 'Colour' (Confidence / Chain order) with the param `dna_rainbow`.

Untested here (needs a headset): comfort and fill rate inside the point field, and how the labels sit in stereo.
