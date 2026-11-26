# Chunk 10: per-frame shell modules (people's bodies, their solver, the goggles' game)
Read: bodies.js (1008 lines, 74 KB)
Read: ik.js (762 lines, 55 KB)
Read: flight.js (893 lines, 61 KB)
(Also looked at, for the callers only: shared.js 4195-4306 and 4407-4481; index.html:2342.)

## What runs per frame (no measurement here: counts from the code; times are estimates)
- bodies.js, per session frame with bodies on (shared.js:8471 bodiesBegin, drawPeople -> bodyOf -> add, drawSelf, bodiesEnd):
  per person `addTo` (l.844): eyeStep (a 60-float sort only every 0.5 s), 2 x hang(), one `IK.solve`, 2 x
  getWorldPosition, then 23 bones x (one Matrix4 multiply by toWorld + 12 float writes). `endOf` (l.903): the whole
  bones texture re-sent, two instance attributes (n rows only). GPU: 2 draws for everyone; per person 2,470 body
  triangles + 840 halo triangles (210 additive quads), 4 texture fetches per vertex, each eye.
- ik.js `solve` (l.499), once per person per frame: ~23 quaternion multiplies (RWQ), ~12 fk, 4 two-bone solves (2 basisQ
  each), 22 local turns, 45 regular-expression tests, then `hips.updateMatrixWorld(true)` (23 compose + 23 multiply);
  `steps` (l.644) for the feet. No allocation per frame apart from one 2-item array literal (l.560); a step's start
  and a jump allocate (rare). Order of 0.05 to 0.1 ms a person on a Quest CPU (estimate): 10 people about 1 ms, the
  cap of 48 about 4 ms of an 8 to 14 ms frame.
- flight.js: nothing unless the goggles are on (`frame` l.678 returns at once; loaded on demand). On: `aimAt` over all
  13,460 proteins (l.216), 40 drones x 3 sines twice (step and draw), <= 64 markers and <= 24 instance matrices sent,
  one Points draw of about 19,500 additive points, canvases only when their text changes.

## Findings
### Every person is solved and drawn at full detail, seen or not   [perf-frame]  gain: medium (high in a full room)  risk: medium  sure: plausible
Where: bodies.js:844-898 (`addTo`), 716 (`frustumCulled = false`); caller shared.js:4481 (`bodyOf` for every person with `asBody`)
What: Each person in the room costs one full `IK.solve` plus 3,310 triangles in each eye every frame, whether they are
behind you, 15 m away or behind a wall; nothing in bodies.js or the call I read tests the view or the distance. With
48 people that is 48 solves and about 159,000 triangles x 2 eyes.
Change: In `bodyOf`/`add`, skip the row for a person whose head is outside the view cone (plus a margin for limbs), and
solve them at a lower rate (every 2nd to 4th frame, with the summed dt) or not at all (the `jump` path already replants
feet when they come back). For people beyond about 8 m, drop the halo row (a second, smaller instance count is not
possible in one draw, so: a per-instance flag that sends halo vertices behind the far plane, as hidden parts do at
l.658). Device-only to judge; test `bodies` smoke block reads `stats().n`.

### `getWorldPosition` twice per person re-walks 7 ancestors each, right after the whole skeleton was updated   [perf-frame]  gain: low-medium  risk: low  sure: confirmed
Where: bodies.js:874 (after ik.js:613 `B.hips.updateMatrixWorld(true)`)
What: `getWorldPosition` calls `updateWorldMatrix(true, false)`: for each shoulder it recomposes and multiplies the
arm, shoulder, three spines, hips and root again: 14 compose + 14 multiply a person a frame, against 23 for the real
update, so about 60 % extra matrix work for values that are already in `matrixWorld`.
Change: `B.H[i].sh.setFromMatrixPosition(B.rig.bones[...].matrixWorld)`. The same in ik.js:646 (`rig.root.getWorldPosition`)
and `frameOf` (ik.js:183-184: `updateWorldMatrix` + `decompose` every solve for a root that only changes in `sizeTo`):
bodies.js could hand the solver a cached frame, or `frameOf` could skip when the parent's matrixWorld is unchanged.

### 45 regular-expression tests per person per frame in the solver   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: ik.js:564 (`LIMB_RE.test(p)` over 23 parts), ik.js:610 (`TOE_RE.test(p)` over 22), ik.js:560 (`['lsh', 'rsh']` made each solve)
What: The part names never change, yet each solve classifies them again by regex; a comment at l.457 already notes the
care taken not to build the regex per frame. 48 people: about 2,200 regex tests a frame.
Change: In `rigOf`, store `rig.trunk` (the parts l.564 walks) and a per-part flag `rig.end[p]` (headtop and toes), and a
module constant for the two shoulder names; loop over those.

### The bones' texture is re-sent whole every frame, 54 KB for one body   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: bodies.js:909 (`S.tex.needsUpdate = true`), 686-688 (70 x 49 RGBA float), comment l.679-680
What: three.js r128 re-specifies a DataTexture with `texImage2D` on every update: 54,880 bytes of float RGBA each
frame however many rows are used (1 for My body alone). Small, but it is a re-allocation of the texture's storage on
a mobile GPU each frame.
Change: Make the people's set grow (cap 4 -> 16 -> 49: `newSet` already takes a cap and the free list keeps the
wrappers), or keep 49 and accept it. Also l.910: `for (const a of [S.inst, S.col])` makes an array a frame (trivial).

### Body fragment shader: view-space up and the fixed light worked out per fragment   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: bodies.js:585-586 (FRAG), 594-596, 605
What: Every body fragment does a mat4 x vec4 and a normalize for `up`, normalizes a constant `L`, and runs two `exp`,
five `pow` and a `sin`; someone standing 1 m away fills a large part of both eyes with it.
Change: `up` as a varying set in the vertex shader (or a uniform written in `beginOf`), `L` as a constant already
normalized; the visor's `exp(-pow(...))` only inside `if (glass > 0.5)`. Looks unchanged; a headset shows the gain.

### The halo: 210 additive camera-facing quads a person, no distance cut   [perf-frame]  gain: low-medium  risk: medium  sure: plausible
Where: bodies.js:479-497 (the chains: a spot every 0.6 of its size), 645-652 (HVERT), 712-714
What: 840 triangles of blended, depth-tested, double-sided quads per person, each up to about 3 degrees wide; a person
1 m away is several hundred thousand blended fragments per eye (overlapping spots along every light strip), and a
person 20 m away still sends all 210 quads at a pixel or two each.
Change: Fewer spots per chain (step 0.9 of the size instead of 0.6, about a third fewer quads), and collapse the quad
(as l.658 does) when its size on screen is under a pixel or the person is far. Needs the owner's eye on the look.

### flight.js: the console canvas (768 x 300) is redrawn and re-uploaded for every metre flown towards the next partner   [perf-frame]  gain: low-medium  risk: low  sure: confirmed
Where: flight.js:810-812 (`dn` rounded to 1 m is part of the redraw test), 827-833; 425 (`CanvasTexture` with default mipmaps)
What: At the top speed of 2 m/s the dash is redrawn about twice a second while a link is followed: four `fit` loops
of `measureText`, a 768 x 300 upload (0.9 MB RGBA) and, since `CanvasTexture` keeps mipmaps on, a mipmap chain each
time: a likely dropped frame on a Quest, twice a second. The name tags (512 x 128) also carry mipmaps.
Change: Show the distance in steps of 5 m (or redraw at most once a second), and set `generateMipmaps = false`,
`minFilter = LinearFilter` on the dash (it sits 0.6 m from the eye, never minified much).

### flight.js: points past the fade distance are still rasterised   [perf-frame]  gain: low  risk: low  sure: plausible
Where: flight.js:336-345 (GLOW_V), 472-492 (one Points of W.N + dots, about 13,460 + 6,100), 420/489 (`frustumCulled = false`)
What: A protein beyond `uFar` (40 m; the cell is 80 m across) gets colour 0 but keeps its point size, so it is blended
as black: up to a third of the points from the edge of the cell.
Change: In GLOW_V, when the fade is 0 set `gl_PointSize = 0.0` / move the vertex outside the clip volume. `aimAt`
(l.216, all 13,460 proteins each frame, one sqrt each in reach) is fine at this size; it could run only on the frame
the trigger goes down plus every 3rd frame for the white marker.

### flight.js: the world is built in one block the moment the goggles are first wanted   [perf-load]  gain: low  risk: low  sure: plausible
Where: flight.js:289-306 (`prepare`), 143-177 (`buildWorld`), 114 (`any`: `B.list.filter` for each of about 2,000 proteins in bodies)
What: 1.16 MB of text fetched and `JSON.parse`d (941 KB of it the base64 links), then `buildWorld` in one task: a
generator closure and a filtered array per protein, 141,000 links walked twice. In a headset this lands inside the
session (e6z_goggles.js:23 calls `prepare` when the studio's goggles are made), a hitch of tens of ms.
Change: Split `buildWorld` at `later()` every few thousand proteins; group `B.list` by place once instead of
filtering per protein. The fields `rel` and `com` (61 KB) are parsed and never used here; no cheap fix without a
second data file.

### ik.js ships a 72-line, 8 KB header comment and an unused function, twice   [repo-cost]  gain: low  risk: low  sure: confirmed
Where: ik.js:1-72 (8,198 bytes); ik.js:210-251 `assign` ("kept, unused by the studio"); pasted whole into stories/studio.js (tools/studio/build.mjs:82)
What: The header repeats the contract kept in tools/trackers/SPEC.md "The solver (`ik.js`)" (l.382-482); `assign` is
called only by tools/studio/test-ik.mjs:138-143. Both copies (root and the studio's built file) carry them, and an
agent editing `solve` reads all 762 lines. Comment lines are 178 of 762 here, 215 of 1,008 in bodies.js, 132 of 893
in flight.js.
Change: Keep one copy of the solver's contract (SPEC.md; a 10-line header with the function list in ik.js); move
`assign` and its test out or delete both. bodies.js would be far easier to work on with `mannequin()` (l.51-507, 457
lines of geometry that never changes with the per-frame code) in its own file, e.g. generated into a data file by
the miniature-style build: it would also remove the first-body build (string keys and Maps for about 10,000 corners,
l.442-467) from the headset.

## Not worth changing
- bodies.js `addTo`: no objects made per frame (scratch vectors, typed arrays written in place); `eyeStep` sorts 60
  floats only twice a second per person; instance attributes send only the rows used (l.910).
- ik.js `solve`/`steps`/`twoBone`: scratch kept between calls, part names prebuilt (`SN`), `SOLVED` frozen; `match`,
  `fit`, `calibrate`, `hungarian` allocate freely but run on a button press, not per frame.
- bodies.js programs are linked ahead (`warm`, l.943); two draws for any number of people; the story set shares geometry.
- flight.js when off: one early return a frame. When on: markers, drones and the guide write into kept arrays with
  update ranges; links rebuilt only when the scanned protein changes; tags redrawn only when their protein changes;
  status strings compared by number before any string is made (l.812). The 1.16 MB data fetch is once and on demand.
- The 23 `toWorld` multiplies per person (bodies.js:881): about a microsecond; not worth a per-instance matrix.

## Bugs seen
- None certain. bodies.js:802 `SORT.fill(-Infinity); SORT.set(E.ring); if (E.n < EYE.n) SORT.fill(-Infinity, E.n)`:
  correct only while the ring fills from index 0 (it does); the first `fill` is redundant.
- flight.js:741 reads `renderState.baseLayer.framebufferHeight`; with sharp text's layers on, `baseLayer` may be null
  and the canvas height is used instead, so glow sizes may differ between the two modes (untested, device only).
