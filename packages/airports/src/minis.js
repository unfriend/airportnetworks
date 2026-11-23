// The miniatures of the story package airports (Airports): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/airports/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'airports.<set>'.
// kit: b
  def('airports.globe', 'Globe of flights', 'The globe of airports as hubs and spokes: hubs as pillars coloured by their number of routes, blue through cyan to amber, and routes fanning out from the biggest.', 1190, (M, g) => {
    const lon0 = -20, deg = { FRA: 250, ATL: 245, DXB: 230, LHR: 220, CDG: 215, AMS: 210, IST: 205, ORD: 200, JFK: 175, MUC: 170, DFW: 165, MAD: 160, LAX: 150, PEK: 150,
      FCO: 140, MIA: 130, DEL: 120, SIN: 120, SFO: 120, GRU: 110, MEX: 110, YYZ: 105, LIS: 95, BOM: 95, SEA: 90, ARN: 90, BOG: 85, JNB: 85, CAI: 80, NBO: 70 };
    const spokes = { FRA: ['JFK', 'ORD', 'DXB', 'PEK', 'GRU'], ATL: ['LAX', 'MEX', 'LHR', 'BOG', 'SEA'], DXB: ['SIN', 'DEL', 'JNB', 'NBO', 'LHR'] }, routes = [];
    for (const h in spokes) for (const k of spokes[h]) routes.push([h, k]);
    const cy = globe(M, g, lon0, routes, '#cfe7ff');
    for (const k in deg) { const x = deg[k] / 250, p = ll(...AP[k], lon0, 1); M.add('glow', g.rod(p, p.map(v => v * (1.02 + 0.34 * x * x)), 0.02, 3), degCol(x)); }
    globeStand(M, g, cy);
  });
