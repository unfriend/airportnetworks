# The script: Invisible threads (the exposome story)

Written by the main conversation (25 November 2026) from the paper: Lombardo, Hütter, Unterlass, Menche, *A
network-based map of the chemical exposome connects molecular interactions to public health*, Nature Communications 17,
5754 (2026), doi 10.1038/s41467-026-72402-y. For a lay audience: no term without a gloss, one running image (threads).

Each part: **say** (the voice, `data-say`; one `data-at` line each) and **panel** (key points, exact numbers). `{...}`
is a number looked up in the story's data as the page runs (the paper's value in brackets, to check the generator
against); speech rounds it with the story's helpers. British spelling. Where the data cannot give a number or an
example, change the words to what the data says and tell the main conversation; never hard-code the bracketed value.

Title: **Invisible threads** · sub: *the chemicals around us and the diseases they touch* · kick: *Chemical exposome*.
The title and headings are silent (`data-say=""`), as in `packages/ppicell`.

## 1. `cloud` Ten thousand substances (about 50 s)

Scene: you stand inside a slow cloud of points; then they sort onto shelves (rings) by chemical family.

1. **say**: Take a breath. With it comes exhaust from the street, a trace of smoke, perhaps a little perfume. Now add
   your breakfast, your coffee, and the pill you took this morning.
   **panel**: Air, water, food, medicines, cosmetics, the workplace: what reaches the body from outside.
2. **say**: Scientists have a word for all of it together: the exposome. Everything that reaches your body from the
   outside, over a whole life.
   **panel**: The **exposome**: every exposure of a lifetime. Here, its chemical part.
3. **say**: Here is its chemical part. Every dot around you is one substance. There are nearly {ten thousand} of them:
   pollutants, pesticides, medicines, things in our food.
   **panel**: {N} [9,887] substances with a known effect on human genes (the Comparative Toxicogenomics Database).
4. **say**: How do you put ten thousand substances in order? A chemist sorts them by what they are made of. Each colour
   here is one chemical family.
   **panel**: Sorted by chemistry: the largest families with their counts ({organic} [5,594] organic chemicals,
   {hetero} [3,950] heterocyclic compounds, {poly} [1,621] polycyclic compounds ...; a substance can belong to several).
5. **say**: It is tidy. But it does not tell us what we most want to know. What does each of them do to us?
   **panel**: The question: not what a substance is, but what it does.

## 2. `reach` One substance reaches in (about 65 s)

Scene: one dot comes forward (benzo(a)pyrene); the model cell of *Back into the cell* appears; threads run from the
substance to the proteins of the genes it disturbs. Then one protein (CASP3) and threads back out to its substances.

1. **say**: To find out, we follow one substance into the body. This one is called benzo-a-pyrene. It is in cigarette
   smoke, in car exhaust, and in the black crust of a grilled steak.
   **panel**: **Benzo(a)pyrene**: from burning; in smoke, exhaust and charred food.
2. **say**: And this is a human cell, with its rooms. Every small dot is one of its proteins: the workers that our
   genes hold the plans for.
   **panel**: A model cell; each dot a protein, placed where it works.
3. **say**: When the substance arrives, some genes are switched up and others down. Watch. Every thread is one gene it
   disturbs.
   **panel**: A thread: an experiment in which the substance changed a gene's activity or its protein.
4. **say**: This is one of the most studied chemicals of all, and it has been seen to touch about {sixteen thousand}
   genes. Most substances touch far fewer: half of them fewer than {median}.
   **panel**: Benzo(a)pyrene: {bap} [16,470] genes, the most of any substance here. Half of all substances: fewer
   than {median}.
5. **say**: Curators read thousands of studies like this, one paper at a time, and gathered them in one public
   collection. More than half a million threads, between ten thousand substances and {twenty-five thousand} genes.
   **panel**: {links} [573,674] curated links between {N} [9,887] substances and {genes} [25,580] genes.
6. **say**: Now turn it round, and take one gene. This is caspase 3, a protein that tells a damaged cell to die. About
   {seventeen hundred} different substances pull on it.
   **panel**: **CASP3**, a switch for cell death: disturbed by {casp3} [1,701] substances, the most of any gene; then
   {g2} [BCL2, 1,078] and {g3} [BAX, 968].
7. **say**: So here is a thought. If two substances pull on the same genes, should we not tie them together?
   **panel**: Two substances, the same genes?

## 3. `threads` Tying the threads (about 55 s)

Scene: two substances, their gene threads compared, the shared ones glow and become one thread between the two; then
all threads appear in the shelved cloud; then the cloud relaxes into the network's own arrangement (by biology) and the
shelves fall apart, colours still the chemical families.

1. **say**: That is the idea behind this map. We take two substances and compare the genes they disturb. If they share
   many more than chance would give, we tie a thread between them.
   **panel**: A link between two substances: the genes they share are more than chance explains (tested for every
   pair).
2. **say**: We do that for every pair, and there are nearly fifty million pairs. We keep only the strongest threads,
   about {seven hundred thousand}.
   **panel**: {nodes} [9,764] substances, {edges} [736,470] links kept: the strongest tenth.
3. **say**: And now we let the threads pull. Substances that share a lot move close together. Watch the chemist's tidy
   shelves fall apart.
   **panel**: The same substances, now arranged by the genes they share.
4. **say**: Look at the colours. The chemical families are mixed right through. What a substance is made of tells you
   almost nothing about which genes it disturbs.
   **panel**: Alike in chemistry and alike in effect: almost unrelated in this map (correlation {rho} [0.005], where 1
   would be a perfect match).
5. **say**: So what do these new neighbours have in common?
   **panel**: New neighbours.

## 4. `sort` Sorted by what they do (about 80 s)

Scene: colours change from chemical family to community; the broad communities separate a little and get their plain
labels; then we fly into one, to the sub-group of 21 substances for blood clotting, and four of its members come
forward with their names and their shared gene.

1. **say**: The network falls into groups, where the threads are dense. Here are the largest, each in its own colour.
   And every group has a theme.
   **panel**: Communities: groups of substances with many links inside and few outside. {broad} [13] broad ones here.
2. **say**: (as the labels come up, name three from the data in plain words, for example:) This one disturbs
   inflammation. This one, how the body handles fat and sugar. This one, how cells divide.
   **panel**: Each community with what its genes do (the processes its shared genes are known for), in plain words.
3. **say**: Inside each group there are smaller groups, and smaller ones again. Let us go down into one.
   **panel**: Three levels: {l1} [125], {l2} [152] and {l3} [456] communities, from broad to fine.
4. **say**: Twenty-one substances. One is heparin, a blood thinner you get in hospital. One is a hormone from the
   contraceptive pill. One is a contrast dye for X-ray pictures. And one is a sedative.
   **panel**: A fine community of {n} [21]: heparins and other blood thinners, hormones of the pill, the contrast
   agent ioxaglic acid, the sedative clobazam.
5. **say**: A chain of sugars, a hormone, a dye, a sedative. As chemicals they have nothing in common. But they all
   pull on the same few genes, and those genes control how our blood clots.
   **panel**: All four touch **SERPINC1** (antithrombin, a brake on clotting); the group's shared genes belong to
   blood clotting.
6. **say**: That is the heart of it. The body does not care what a molecule looks like. It reacts to which of its
   systems is disturbed.
   **panel**: Not what it is: what it disturbs.
7. **say**: And that is useful. When a new substance that nobody has studied well lands in this group, we have a first
   guess at what it may do.
   **panel**: A new substance's neighbours give a first guess at its effect.
8. **say**: But which disturbances are the dangerous ones?
   **panel**: Which ones are dangerous?

## 5. `centre` Where it hits (about 85 s)

Scene: back to the model cell; its proteins' contacts appear; the proteins leave the cell and settle by number of
contacts, the best connected in the middle, the loners at the rim (each keeps its direction from the cell's centre).
Then four example substances, one per pattern, light their targets. Then every substance with a hazard score is shown
as a small flare where its targets sit, the more harmful the brighter.

1. **say**: For that, we go back into the cell. Its proteins do not work alone. They touch each other, pass signals
   on, and build machines together. Draw every known contact and you get another network.
   **panel**: The human interactome: {P} [18,815] proteins, {L} [482,935] physical contacts.
2. **say**: Let us take it out of the cell and sort it. The proteins with the most contacts go to the middle. The
   loners go out to the rim.
   **panel**: The same proteins, sorted by how many contacts they have: hubs in the middle.
3. **say**: Now we can ask where a substance hits. There are four patterns. Some hit a tight group right in the
   middle. More than {four in ten} do this.
   **panel**: **A central module** ({central} [43] %): targets that touch each other, among the hubs.
4. **say**: Some hit a few big hubs and little else.
   **panel**: **Hubs** ({hub} [15] %): well connected targets that do not touch each other much.
5. **say**: Some hit a tight group far out at the rim.
   **panel**: **A module at the edge** ({peri} [8] %): targets that touch each other, without hubs.
6. **say**: And for {a third}, the hits are scattered, with no pattern we can see. Perhaps partly because our map of
   the cell is not finished.
   **panel**: **Scattered** ({scat} [34] %): no group, no hubs. The map of contacts is incomplete.
7. **say**: Now compare this with what toxicologists know. For about half of the substances there is a hazard score,
   from harmless to very harmful.
   **panel**: A hazard score from 0 to 1 for {haz} [47] % of the substances (the NORMAN network's list); those
   without one are mostly natural compounds.
8. **say**: The substances that hit the middle score highest, on average. The more central the target, the greater
   the harm.
   **panel**: Most harmful on average: a central module, then hubs. Harm rises with the best connected target (a weak
   but clear trend, r = {r} [0.24]).
9. **say**: It makes sense. Pull a thread at the edge of a web and little happens. Pull one in the middle and the
   whole web moves.
   **panel**: A hit in the middle spreads.
10. **say**: And what if the part that moves matters for a disease?
    **panel**: And disease?

## 6. `disease` Disease neighbourhoods (about 65 s)

Scene: in the sorted interactome, asthma's genes light as a neighbourhood; ozone's targets light in another colour;
the shortest paths between them are drawn and counted. Then many pairs flash, near ones bright.

1. **say**: Diseases have their place in this network too. The genes behind asthma, for example, sit close together,
   like a neighbourhood.
   **panel**: A disease's genes cluster in the interactome: its module. {D} [6,177] diseases here.
2. **say**: So we can measure a distance. From the proteins a substance hits, how many steps is it to the
   neighbourhood of the disease?
   **panel**: Distance: from each target, the steps to the nearest disease protein, averaged, and compared with
   chance.
3. **say**: Here is ozone, the gas of summer smog. Its targets lie right beside the asthma neighbourhood. And doctors
   have long known that ozone makes asthma worse.
   **panel**: **Ozone and asthma**: close in the map (the pair's own numbers from the data), and well known in
   medicine.
4. **say**: The map did not know that. It only counted steps.
   **panel**: The map only counts steps.
5. **say**: We measured {sixty million} pairs of substance and disease. About {one and a half million} came out
   close: closer than chance allows.
   **panel**: {pairs} [60,855,804] pairs tested, {near} [1,601,884] significantly close. Shared proteins alone would
   find {overlap} [28,403].
6. **say**: Can we trust it? One test is the medical literature. The closer a pair sits in the network, the more often
   the two are written about together.
   **panel**: Checked against 42 million PubMed records: the closer the pair, the more papers name both.
7. **say**: But papers are not people. Does any of this show up in real populations?
   **panel**: And in real populations?

## 7. `europe` Out into the world (about 85 s)

Scene: the interactome shrinks to a point and we rise to the globe (the airports story's globe), turned to Europe. The
countries with data get a marker; each country's elevated substances rise as points above it. Italy: endrin, threads
down to its nearest diseases, colon and rectum cancer named. Then all countries: each one's column is its risk score.

1. **say**: For that we leave the cell and go up. A long way up. This is Europe.
   **panel**: {C} [32] European countries, 2007 to 2020.
2. **say**: Factories here must report what they release into the air and into water. So for every country we know
   which substances stand out.
   **panel**: Industrial releases reported to the European Environment Agency: per country, the substances far above
   the European level (about seven to air, eight to water).
3. **say**: Take Italy. One substance that stands out there is endrin, an insecticide that was banned long ago, but
   still turns up in the reports.
   **panel**: **Italy**: {it} [57] substances stand out. One is **endrin**, a long-banned insecticide.
4. **say**: From endrin we follow the threads: to its genes, to their proteins, and on to the diseases that sit close
   by. One of them is cancer of the colon.
   **panel**: Diseases close to endrin's targets in the map; among them cancer of the colon and rectum.
5. **say**: And in Italy that cancer is more common: about four times the world's average, and a little above the
   rest of western Europe.
   **panel**: Colon and rectum cancer in Italy: {x} [4.05] times the global rate, {w} [1.14] times western Europe's
   (Global Burden of Disease).
6. **say**: One case proves nothing. Italy is richer and older than most of the world, and that alone means more
   cancer. So we did it for every country and every substance.
   **panel**: One case is not proof: age and wealth differ too.
7. **say**: In about {two thirds} of the countries, the diseases close to a country's chemicals are more common there
   than the diseases far from them.
   **panel**: Close diseases more frequent than distant ones in {a} [17] of {A} [24] countries for air, {b} [16] of
   {B} [23] for water. A modest trend overall (correlation {rho} [0.26]).
8. **say**: It is a tendency, not a proof. The map cannot say that a chemical caused a disease. It says where to
   look.
   **panel**: A link in the data, not a cause.
9. **say**: Each column here is a country's score: how much it releases, counted more when the targets are central.
   **panel**: A country's score: its elevated releases, weighted by how well connected their targets are (the
   authors' risk score, as a share of the total).

## 8. `end` A map to look with (about 45 s)

Scene: back out through the scales in one move: globe, interactome, the network of substances all around you again.

1. **say**: So that is the map. From a molecule, to a gene, to a cell, to a continent, all tied together by threads
   you cannot see.
   **panel**: Molecule, gene, cell, population: one map.
2. **say**: It leaves a lot out. It does not know the dose. It does not know how long you were exposed, or how
   substances add up. And it only knows what somebody has already studied.
   **panel**: Not in the map: dose, duration, mixtures, how the body breaks a substance down; and whatever has not
   been studied yet.
3. **say**: But it gives ten thousand substances a place. And when the next new chemical comes along, we can ask who
   its neighbours are.
   **panel**: A place for every substance, and a first guess for the next one.
4. **say**: Now it is yours. Pick a substance, a disease or a country, and follow the threads.
   **panel**: Explore: substances, groups, diseases, countries.

Credits (`.credits`, never read): the paper and its authors with the doi; data: the authors' deposit (Zenodo,
doi 10.5281/zenodo.14566377, CC BY 4.0), built on the Comparative Toxicogenomics Database, DisGeNET, the NORMAN network,
the European Environment Agency and the Global Burden of Disease study (IHME); the model cell from *Back into the
cell*; the narration is a synthetic voice (Kokoro). Nothing here is medical advice.

## Wording rules for this story

- "Substance" in speech, "exposure" introduced once on the panel; "thread" for a link; "group" for a community.
- Never "causes": a substance *disturbs* or *touches* a gene, a disease is *close* in the map, *more common where*.
- Every statistic on the substances' own network says "in this map" or "here" on the panel.
- No brand names; no health advice; no country is called dirty or dangerous (a score is "its releases, weighted").
- Countries: incidence per country only; nothing about people.
