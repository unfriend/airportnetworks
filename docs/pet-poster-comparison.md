# The PET story and the poster

How "One scan, one system" (`stories/pet.js`, built from `tools/pet/`) compares with the poster "Shaping a New Era in
Nuclear Medicine" (Barbara K Geist, Alexander Grentner, Joel Fischer, Josef Yu, Dato Tsomaia, Adna Smajlovic, Stefan
Grünert, Marcus Hacker; Division of Nuclear Medicine, Medical University of Vienna; LBI for Network Medicine). Two
independent comparisons, 29 October 2026, each against the poster itself and the paper it builds on (Geist et al., "The
metabolic organ connectome", Med 6, 100881, 2025).

## Verdict

The story follows the poster up to the Organs chapter (the scanner, the tracer, segmentation, each organ's uptake) and
then tells the paper: the network across many scans, density and disorder, from health to disease. Every number it
gives is right for the paper. None of the poster's own results is in it. Of the poster it keeps the title (in the
small print), the authors and the framing of the body as one system; the vision row in the intro comes from the
separate vision slide. The version before commit b7053fb (23 October 2026) told the poster's one-scan story with its
numbers; it was taken out after a colleague's note that it "did not match the poster". Which poster was meant is
still being asked.

## The poster, section by section

| Poster | In the story? |
| --- | --- |
| Title and authors | Yes: the authors at the end, the title in the small print |
| Motivation: PET holds more than cancer staging; the body as one system | Partly: the Sugar chapter ("Yet the scan holds every organ's metabolism at once") |
| Methods: builds on the paper's population networks | Yes, at length: the Network and Health chapters are the paper's |
| Card 1: 630 baseline scans (six groups) and 84 follow-up scans | No: the story's cohort is the paper's (658 scans of 548 people) |
| Card 2: uptake read automatically in seven tissues | Partly: the story reads the paper's 13 organs, each divided by the aorta |
| Card 3: one network per scan (pairwise ratios of two tissues, a threshold) | No (explore's liver borrows the idea, as an illustration) |
| Card 4: Clearance and Heterogeneity | No (the story's density and disorder are the paper's measures of a group's network) |
| The metabolic displacement index; four groups on its scale | No |
| Survival by thirds of the index (cancer patients) | No |
| Response to immunotherapy before surgery (19 people with lung cancer) | No |
| Follow-up after surgery and immunotherapy; UMAP; robustness | No (the poster shows no panel for these either) |

## Fixed in the story (29 October 2026, the owner's go)

- Intro: "From PET scans to a network of organs, from health to disease" (was "From one PET scan ..."); the vision row
  captioned as the aim, prognosis and medication "goals, not yet shown" (its labels: "a goal").
- Sugar: FDG "mostly" not taken back; a hot spot is "the main application of PET scans in routine care: finding and
  staging cancer".
- Network: "A network like this needs many scans: one scan gives only one row of numbers. These networks are the
  paper's, each of a group of scans." Organs rise and fall together "across scans" (the 658 include repeat scans).
- Health: group wording ("in the heavier group, the brain is a hub"; "groups with more tumour load have thinner
  networks ... so do groups with more stress hormone"); healthy against cancer "compared within this one set of scans";
  the CRP thirds dropped (they mix healthy people and patients; within either group CRP made no clear difference), the
  tumour-load networks shown in their place. Fewer numbers on the panel than before.
- Credits: the numbers and networks are the paper's; the intro's pictures are the vision slide's.
- Explore, Liver: "a rule like the poster's, applied here to patches of one organ, as an illustration".

## Open points

For the owner: which poster the colleague meant, and whether the note was about the content or how it was drawn. The
rebuild of the second half around the poster (HANDOVER.md item 8) waits for that answer.

For the authors (P4 to P11 in [questions-for-authors.md](questions-for-authors.md)): the threshold and which way each
ratio is taken; the formulas of Clearance, Heterogeneity and the index; which way is healthy on the index's scale, and
whether it is a position or a distance; what the dashed lines bound; means or medians and the spread; why 593 and 410
scans against 630; what the p values test (all above 0.05, in 19 people); the follow-up results, which no panel shows.

The poster's numbers, as group summaries, are in git: `git show b7053fb^:tools/pet/sets/data.js` (under `poster`).
