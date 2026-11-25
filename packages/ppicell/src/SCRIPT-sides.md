# The script for sides and complexes (25 November 2026)

Written by the main conversation for stage B. Each part: **say** (the voice, `data-say`) and **panel** (the key points
and exact numbers). `{...}` is a number computed from the data as the page runs, with today's value (carried sides) in
brackets; round it in speech as the story's helpers do (`near`, `in100`, `word`). British spelling. Parts not listed
here keep their words.

## Walls (chapter 3): two new parts, after the receptor and before the gates

1. **say**: So a protein has more than an address. It has a side. It can float inside a room. It can cling to a wall
   from the cytosol's side, or from the far side. Or it can go right through, once, or many times, like our receptor.
   **panel**: A protein in a place with a membrane is inside the space, on the membrane's cytosol side, on its far
   side, through it once, through it several times, or secreted.
2. **say**: How do we know? Partly from experiments, and partly from the protein's own build. A greasy stretch marks a
   crossing. A short tag at the start means: send me inside. No tag means: I stay on the cytosol's side. That last one
   is a textbook rule, and it has exceptions.
   **panel**: From UniProt where it names the place ({named} [1,994] of {all} [4,359] membrane places); elsewhere from
   the protein's own build: membrane spans, lipid anchors, a signal peptide ({carried} [1,862] more). No signal
   peptide is taken as the cytosol's side: a rule with exceptions.
3. In the gates part, after the mitochondrion's channel. **say**: A mitochondrion even has two walls. So there are four
   places to be: the outer wall, the gap, the inner wall, and the innermost room, the matrix.
   **panel**: Mitochondria: outer membrane, the gap between, inner membrane, matrix (told apart for {mito} [395]
   proteins).

## Back into the cell (chapter 4): one new line, after "each mitochondrion keeps its links to itself"

- **say**: And a protein that belongs to a wall settles on it: on its own side, or straddling it.
  **panel**: A membrane protein sits on its side of the membrane, or through it.

## Can they meet? (chapter 5): the opening and the three counts

- Opening. **say**: Now the test. For every link we ask: can these two proteins actually meet? We take the links where
  both partners have an address, about {J} [99,000] of them. Where we know a protein's side, we use it. Where we do
  not, we assume it is inside.
  **panel**: The {J} [99,479] links that suggest contact, between proteins that both have a place. Sides where known;
  otherwise inside (the strict reading):
- Possible. **say**: {Eight} in ten pass. Both partners share a room, or one reaches into the other's room through a
  wall. These keep the colour of their room.
  **panel**: {s0} [83,847] possible ({pct} %): a shared space, or a side that faces it.
- Through a gate. **say** and **panel**: as now, with the new count ({s1} [14,445]).
- Impossible. **say**: And about {s2} [1,200] links should be impossible. Their partners share no room, no wall and no
  door. Those are red.
  **panel**: {s2} [1,187] impossible ({pct} %): no shared space, no side that faces it, no known crossing.
- RELA: as now.

## Machines (a new chapter 6, key `machines`, about 55 s)

1. **say**: Some proteins never work alone. They lock together into machines. Biologists call them complexes, and
   curators have collected about {two thousand} human ones by hand. In our cell, a machine is a group of dots held in
   one outline.
   **panel**: {n} [2,126] curated human complexes with at least two proteins in this map (the Complex Portal). Each is
   its proteins held in one outline.
2. **say**: Most sit inside one room, like the ribosome of the mitochondria. Some coat a wall from one side, like the
   coats that shape vesicles. And some go right through a wall. The pore in the nuclear envelope is one. So is the
   turbine that makes the cell's fuel, A T P.
   **panel** (steps, each lit on the cell with its example): {inside} [1,243] inside a space (the mitochondrial
   ribosome) · {face} [96] on a face (the COPII coat) · {span} [157] through a membrane (the nuclear pore, ATP
   synthase).
3. **say**: But look at these. A few hundred machines have their parts listed in different rooms. Take the proteasome,
   the cell's shredder. Most of its parts are listed in the nucleus, a few in the cytosol. Yet we know it is one
   machine. So here it is not the link that is wrong. It is an address.
   **panel** (amber): {apart} [243] complexes have members listed in different spaces; in most, a single member is the
   odd one out. A known machine in pieces: a place is off, not the link.
4. **say**: It happens to the best. The Atlas lists BiP, the most famous resident of the E R's inside, only in the
   cytosol.
   **panel**: HSPA5 (BiP), a chaperone of the ER lumen, is listed only in the cytosol.
   (Only if the data still says so; else drop this part.)

## Why red? (now chapter 7)

- The second line of the opening. **say**: So either the link is wrong, or an address is. We have just seen addresses
  go wrong. To see how links can, we have to look at how they are found in the first place. There are three main ways.
- The three methods and "a pattern, not proof": as now (their numbers follow the data).
- The sides part replaces "Part of the problem is the Atlas itself ...", in three parts:
  1. **say**: And the sides matter. The Atlas only tells us that a protein belongs to an organelle, not on which side
     of its wall. Without sides, everything hung on a guess. Assume inside, and about {three thousand} links were red.
     Allow either side, and none were.
     **panel**: Without sides: {old s2} [2,958] impossible if inside only, {old g2} [none] if either side.
  2. **say**: With sides, the guess shrinks. About {three quarters} of that doubt is settled. And what is left is
     firmer. Read the unknown ones strictly, and about {twelve hundred} links are red. Read them generously, and about
     {nine hundred} still are. No reading makes them go away any more.
     **panel**: Sides settle {pct} [74] % of the links that hung on the reading. Now: {s2} [1,187] impossible if the
     unknown sides are inside, {g2} [866] if either side.
  3. **say**: And sides cut both ways. About {three hundred} links that looked fine are now red. A protein on an
     organelle's outer face does not share its inside.
     **panel** (amber): {worse} [300] links are worse off with sides: on an organelle's cytosol side is not inside it.
- The last part (the proteins without a place): as now.

## What it would take (chapter 8): unchanged

## Credits (small print, where the story's other credits stand)

- Sides: UniProt (CC BY 4.0). Complexes: the EBI Complex Portal. The judgement is this story's own.
