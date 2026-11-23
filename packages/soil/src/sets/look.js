// SLOOK: the soil story's palette and the colour rules its sets and the engine share (SPEC.md, "Look"). Plain constants
// and small functions: colours as '#rrggbb' strings and as [r, g, b] in 0..1 (rgb()). Shapes come from TLOOK (the tissue
// topology story's look, unchanged: tubes, rings, balls, boxes, halos, cones, glass) and from the sets themselves; a
// shape both the soil and the field sets draw (the wheat plant) may be added here, so the two stay alike.
const SLOOK = (() => {
  const rgb = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const mix = (a, b, t, out) => { const o = out || [0, 0, 0]; for (let j = 0; j < 3; j++) o[j] = a[j] + (b[j] - a[j]) * t; return o; };
  // nitrogen as it moves: fertiliser grains, ammonium, nitrite, nitrate, nitrous oxide, nitrogen in the plant
  const N = { grain: '#f1eee2', nh4: '#ffb43b', no2: '#ff7ab8', no3: '#4d9de0', no3Glow: '#7cc0ff', n2o: '#d9ccff', plant: '#7bd389', tracer: '#ffffff' };
  // the two wheat lines and the three regimes (the slides' own colours: BNI teal, control orange; not fertilised green,
  // fertilised purple, fertilised + DCD yellow)
  const LINE = ['#2ec4b6', '#f08a3c'];
  const FERT = ['#5cc96b', '#a77bff', '#f2d14b'];
  // the BNI halo round the roots (the line's teal, glowing) and the synthetic inhibitor's granules
  const HALO = '#5ff2e0', DCD = '#f2d14b';
  // the relay's microbes, by guild (SOIL_DATA.guilds.keys): archaea magenta, the two ammonia-oxidising bacteria coral and
  // salmon, Nitrospira cyan, uncultured Nitrosomonadaceae (role unknown) grey-violet; comammox (a Nitrospira that does
  // both steps) cyan with an amber core in the relay
  const GUILD = { aoa: '#ff5ad9', nsp: '#ff7a59', nsm: '#ffa07a', nit: '#46d9ff', mnd: '#9a8cc8' };
  // soil and plant: loam, grains, pores, roots, leaves (by chlorophyll), ripe ears, straw, the netting
  const SOIL = { loam: '#3b2a1e', loamLight: '#5a3f2a', grain: '#7a5a3c', sand: '#a88a62', pore: '#120c08', water: '#9fd8ff',
    root: '#e8dcc0', rootHair: '#f5eedc', ear: '#e3c15a', straw: '#cdb46a', net: '#cfd8e6', post: '#8a7a64' };
  // leaf colour by chlorophyll (SPAD index, the slides' axis 45 to 65): straw yellow at 45, deep green at 65
  const CHL = [[45, '#c9b44a'], [50, '#a9bb43'], [55, '#7fb23e'], [60, '#53a03a'], [65, '#2f8a3a']].map(([v, h]) => [v, rgb(h)]);
  function chl(spad, out) {
    const v = Math.min(65, Math.max(45, +spad || 45));
    for (let i = 1; i < CHL.length; i++) if (v <= CHL[i][0]) return mix(CHL[i - 1][1], CHL[i][1], (v - CHL[i - 1][0]) / (CHL[i][0] - CHL[i - 1][0]), out);
    return mix(CHL[CHL.length - 1][1], CHL[CHL.length - 1][1], 0, out);
  }
  // phyla (SOIL_DATA.phyla.names): a colour by name, readable on the dark background; Other and Unassigned grey
  const PHYLUM = { Proteobacteria: '#5aa9ff', Actinobacteriota: '#ffb347', Acidobacteriota: '#7bd389', Verrucomicrobiota: '#ff7eb6',
    Chloroflexi: '#c39bff', Gemmatimonadota: '#4dd0c8', Crenarchaeota: '#ff5ad9', Firmicutes: '#f2d14b', Bacteroidota: '#ff8a65',
    Planctomycetota: '#9ccc65', Myxococcota: '#80deea', Methylomirabilota: '#bcaaa4', Other: '#8e98ab', Unassigned: '#5c6678' };
  const SPARE = ['#e6ee9c', '#f48fb1', '#90caf9', '#ffcc80'];
  const phylum = (name, i) => PHYLUM[name] || SPARE[(i || 0) % SPARE.length];
  // modules (by size, SOIL_DATA.net.mods): the big ones vivid, the small ones softer; links positive pale cyan, negative
  // (one rises as the other falls) faint warm red
  const MODULE = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#cc5de8', '#ff922b', '#66d9e8', '#f783ac', '#a9e34b', '#9775fa',
    '#ffa8a8', '#74c0fc', '#ffe066', '#8ce99a', '#e599f7', '#ffc078', '#99e9f2'];
  const module = m => (m >= 0 && m < 255 ? MODULE[m % MODULE.length] : '#8e98ab');
  const LINK = { pos: '#9fe8ff', neg: '#ff7a6b' };
  // the app's own: highlights cyan, text ink, muted grey
  const UI = { cyan: '#46d9ff', amber: '#ffb43b', red: '#ff7a6b', blue: '#7cc0ff', green: '#3ee08f', grey: '#8e98ab' };
  return { rgb, mix, N, LINE, FERT, HALO, DCD, GUILD, SOIL, chl, PHYLUM, phylum, MODULE, module, LINK, UI };
})();
