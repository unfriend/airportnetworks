# Invisible threads (the exposome story)

A story package (`packages/exposome/`, `#exposome`): nearly ten thousand substances from air, water, food and medicines,
the genes they have been seen to disturb, the network that ties two substances when they share more genes than chance
would give, its communities (what their genes do, in plain words), where substances hit the cell's network of proteins,
the diseases close to them in that network, and the substances released in European countries.

## Who made it

- **The science and the data**: Lombardo, Hütter, Unterlass and Menche, *A network-based map of the chemical exposome
  connects molecular interactions to public health*, Nature Communications 17, 5754 (2026), doi
  10.1038/s41467-026-72402-y. Their deposit: Zenodo record 18793297 (concept doi 10.5281/zenodo.10829456), licence
  CC BY 4.0; their code: github.com/menchelab/Exposome (MIT).
- **The model cell**: *Back into the cell* (`packages/ppicell`): its cell run in Node puts each protein where that story
  draws it (`src/data/gen_cell.mjs`).
- **The story**: the app's authors. The narration is a synthetic voice (Kokoro, `audio/narration.mp3`, made for v212; unheard by the owner).

## Where its numbers come from

`src/data/gen_data.py` reads the deposit (the unpacked zip's `Exposurome_withfiles/` folder, given on the command line)
and writes derived numbers only: `src/sets/data.js` (embedded in `main.js`) and `data/targets.bin`, `data/ppi.bin`,
`data/diseases.bin`, `data/names.json` (fetched when needed). None of the deposit's files go into the repository. The
deposit is built on public sources with their own terms: the Comparative Toxicogenomics Database (substances and genes),
the interactome of the authors' lab (HuRI and others), DisGeNET (diseases and genes), the NORMAN network (hazard scores),
the European Environment Agency (E-PRTR releases) and the Global Burden of Disease study (IHME; only a few ratios the
authors printed in their Source Data are shown). Every number, and which ones differ from the paper: `src/SPEC.md`,
"The data" and "Numbers".

Run it again (from the repository root; Python 3.10+ with `src/data/requirements.txt`):

```
node packages/exposome/src/data/gen_cell.mjs > /tmp/cell.json
python3 -I packages/exposome/src/data/gen_data.py <deposit>/Exposurome_withfiles /tmp/cell.json
node packages/exposome/src/test-data.mjs
node packages/exposome/src/build.mjs && node tools/packages/scan.mjs
```

The plain words for the communities are `src/data/labels.json`, written by hand from `src/data/terms.json` (each
community's enriched terms with their FDR, generated): check a label against its terms before changing it. A rerun may
reshuffle `terms.json`'s samples of members: keep the committed file then (only `labels.json` feeds the app).

On the Experiments set of cards (`story.json` `list: "experiments"`, in `packages/order.json`). Its card's miniature is
`exposome.threads` (`src/minis.js`, built by `node tools/lowpoly/build.mjs`); `icon.png` a frame of the network in its
communities' colours. The build also reads `packages/ppicell/src/sets/cell.js` (the model cell's skins) and
`packages/airports/main.js` (the globe): rebuild after either changes. The chemical families' colours are ours
(`LOOK.family`), the communities' the authors'.

Nothing here is about people: countries are shown by their rates only. Nothing here is medical advice.
