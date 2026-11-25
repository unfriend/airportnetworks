// Where each protein of Back into the cell's model cell stands (packages/ppicell): its cell set run in Node (three.js and
// the kit, no drawing, as packages/ppicell/src/export-wwiznet.mjs does), each protein's dot at its main place (or its
// first listed place; a protein without a place where the cell puts it, outside). Read by gen_data.py (stdout, JSON):
// { sym: [...], pos: [x, y, z, ...] (the cell's frame, radius about 1), place: [0-12, or 13: none] }.
// usage: node packages/exposome/src/data/gen_cell.mjs > cell.json
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const { loadCell } = await import(pathToFileURL(path.join(here, '../../../ppicell/src/export-wwiznet.mjs')).href);
const C = loadCell(), W = C.api.wiz({}), P = C.PDATA;
const N = P.N, pos = new Array(3 * N).fill(0), place = new Array(N).fill(13);
for (let p = 0; p < N; p++) {
  let l = -1;
  for (let k = P.lOf[p]; k < P.lOf[p + 1]; k++) if (l < 0 || (P.main[p] >> P.lPlace[k] & 1 && !(P.main[p] >> P.lPlace[l] & 1))) l = k;
  const at = l >= 0 ? W.pos.subarray(3 * l, 3 * l + 3) : C.api.outPos(p);
  for (let j = 0; j < 3; j++) pos[3 * p + j] = Math.round(at[j] * 1e4) / 1e4;
  if (l >= 0) place[p] = P.lPlace[l];
}
process.stdout.write(JSON.stringify({ sym: P.sym, pos, place, places: P.places }));
