// MUT_DATA: the poster's numbers, typed in exactly from "Converting Mutation into a Machinery: DNA Substitution Models
// as Quantum Circuits" by Enes Berk Sakalli and Arndt von Haeseler (a draft of 26 Oct 2026, not in the repository) and
// from Enes's answers to our questions (27 Oct 2026). Everything else the story shows is computed live from example
// numbers (MMATH, sets/mmath.js). The story says "in the authors' test" wherever it uses these numbers. British spelling.
// Fields:
//   poster        the title, the authors and their institutes, the date of the draft, the six references (shortened, in
//                 the poster's order: [1] is refs[0])
//   fig1          Figure 1: the ancestor and its two descendants, and the swaps that make them (1-based positions,
//                 [position, from, to]); codes, the two qubits of each letter (|01> means first 0, then 1)
//   test          Figure 5 and the result (section "Result"): a synthetic stem of six pairs in three species, drawn as
//                 two rows: top the outgoing half 5' to 3', left to right; bottom the returning half under it, so top[i]
//                 pairs with bottom[i] (the loop is at the right end). broken: the pairs the figure marks as broken
//                 (1-based). tree: the species tree, the root the ancestor. truth: the true ancestor. rebuilt: one
//                 rebuilt ancestor per method, as the figure shows them. n: ancestors rebuilt per method; pairs: pairs
//                 in the stem; w: how much more likely a matching pair is than a mismatched one (the poster, and Enes:
//                 "eight times more likely than mismatched pairs"); intact: the share of rebuilt ancestors with all six
//                 pairs matching, per method (indep: letter by letter, coupled: the circuit with coupling, exact: the
//                 exact pair model); allSixPrior: Enes's words for how many ancestors have all six pairs matching
//                 (words only: no number was given)
//   pairsOk       the pairs that hold in a stem (the poster: A-T, C-G and G-T), both ways round
//   count         the combinations a pair model must track (the poster, "Result"): 16 for a pair, about a million for
//                 ten linked letters, against two qubits a letter (20 for ten)
const MUT_DATA = {
  poster: {
    title: 'Converting Mutation into a Machinery: DNA Substitution Models as Quantum Circuits',
    authors: [
      { name: 'Enes Berk Sakalli', inst: 'Ludwig Boltzmann Institute for Network Medicine at the University of Vienna' },
      { name: 'Arndt von Haeseler', inst: 'Center for Integrative Bioinformatics Vienna (CIBIV), Max Perutz Labs, University of Vienna and Medical University of Vienna' },
    ],
    date: '26 Oct 2026 (draft)',
    refs: [
      'Hadfield et al., Nextstrain, Bioinformatics 2018',
      'Arenas and Posada, Curr HIV Res 2010',
      'Schöniger and von Haeseler, Mol Phylogenet Evol 1994',
      'Doria-Rose et al., J Virol 2005',
      'Rolland et al., J Virol 2007',
      'Li et al., Oncogene 2026',
    ],
  },
  fig1: {
    ancestor: 'ACGTTAGC', d1: 'ACGTCGGC', d2: 'ACATTAGT',
    swaps: { d1: [[5, 'T', 'C'], [6, 'A', 'G']], d2: [[3, 'G', 'A'], [8, 'C', 'T']] },
    codes: { A: '00', C: '01', G: '10', T: '11' },
  },
  test: {
    species: {
      s1: { top: 'ATTACT', bottom: 'CGATAG', broken: [1, 5] },
      s2: { top: 'ATTACT', bottom: 'CTTTGA', broken: [1, 2, 3] },
      s3: { top: 'GTTACT', bottom: 'TGAGGC', broken: [4, 6] },
    },
    tree: '((s1, s2), s3)',
    truth: { top: 'GTTACT', bottom: 'TGATGC', broken: [6] },
    rebuilt: {
      indep: { top: 'ATTACT', bottom: 'CGATGC', broken: [1, 6] },
      coupled: { top: 'GTTACT', bottom: 'TGATGA', broken: [] },
      exact: { top: 'ATTACT', bottom: 'CGATGA', broken: [1] },
    },
    n: 2000, pairs: 6, w: 8,
    intact: { indep: 0.10, coupled: 0.43, exact: 0.20 },
    allSixPrior: 'about a quarter',
  },
  pairsOk: ['AT', 'TA', 'CG', 'GC', 'GT', 'TG'],
  count: { pair: 16, ten: 'about a million', tenQubits: 20 },
};
