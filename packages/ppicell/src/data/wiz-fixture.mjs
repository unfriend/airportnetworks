// The export's and the import's test network (test-wiz.mjs, test-pnet.mjs): made up for the tests.
// a made-up network: real proteins (so the map places them), links invented for the test, with scores and kinds
export const FIXTURE = `# a made-up network for the export's test: a dozen proteins, links invented
a\tb\tscore\tkind
TP53\tMDM2\t0.9\tbinary
GRB2\tSOS1\t0.8\tbinary
EGFR\tGRB2\t0.7\tsignalling
CALR\tRELA\t0.4\tliterature
APOH\tGRB2\t0.3\tbinary
CYCS\tSLC25A4\t0.6\tcomplex
CYCS\tRELA\t0.2\tliterature
KPNB1\tRELA\t0.5\tbinary
HSPA5\tCALR\t0.9\tcomplex
TP53\tKPNB1\t0.1\tliterature
SRC\tEGFR\t0.8\tsignalling
TP53\tTP53\t0.5\tbinary
`;
