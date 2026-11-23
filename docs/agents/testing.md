# Testing: every suite, block and what it checks

Read on demand; the rules every agent needs are in AGENTS.md.

## When the suites run

There is no unit-test suite. When the suites run (the owner's rule: the full suites only before `main` moves): every suite below that a change touches runs before `main` moves, the smoke test always; a push to
`dev` gets only `node --check` on the changed files, the builds' `--check` (`node tools/engine/all.mjs --check` covers the fourteen that share the engine parts), `node tools/packages/scan.mjs --check` (the story packages' index is current and no folder in `packages/` is left out: `docs/agents/packages.md`) and `node tools/release.mjs --check`, and a
red result there is not chased. Each "after touching ..., run ..." below says what goes into that release run.

Every test and tool finds a story through `tools/stories.mjs` (v185: its file, sources, build and narrations, moved into
a story package or not) or, in a page, `HOST.list` and `HOST.meta(k)` (`m.pkg ? m.base + 'main.js' : 'stories/<k>.js'`):
smoke's `STORY_KEYS` are `HOST.list`'s stories (the app's own packages included, others' left out), collab's `STORIES`
are checked against `tools/stories.mjs`, so a story that moves stays in every check. `tools/engine/all.mjs --check`
covers the app's packages too.

## Windows: a tool's own folder, and line endings (fixed 16 November 2026)

- **A tool's own folder.** On Windows, `path.dirname(new URL(import.meta.url).pathname)` gives `/C:/...`, which
  `path.join`/`path.resolve` make `C:\C:\...`: the tool stopped with ENOENT on its first file. Every tool now takes its
  folder with `fileURLToPath(import.meta.url)` (`import { fileURLToPath } from 'url'`; inside a smoke block that loads its
  modules with `await import()`, `(await import('node:url')).fileURLToPath(import.meta.url)`): the studio's build and
  `tools/release.mjs` since v149, the other 29 (the story builds, their data generators and tests, `tools/smoke.mjs`,
  `relay/test.mjs` and the small build its watch test writes, `tools/collab.mjs`, `tools/peer.mjs`,
  `tools/studio/test/make.mjs`) since. On Linux and macOS nothing changes but a folder with a space in its name, which
  the old line left as `%20`. A new tool does the same; a search for `import.meta.url).pathname` finds a slip.
- **Line endings.** `.gitattributes` (`* text=auto eol=lf`) makes every checkout LF, whatever `core.autocrlf` says: the
  builds' and `tools/release.mjs`'s `--check` compare bytes, and the Windows PC's `core.autocrlf=true` (CRLF) failed
  them. Every text file was already stored with LF, so no file's content changed; Git tells binary files apart as before.
  A checkout whose files are still CRLF (made before the rule) turns LF on a clean tree with `git rm --cached -r -q .`,
  then `git reset --hard` (two commands: Windows PowerShell 5.1 has no `&&`; untracked and ignored files are kept). The
  Python data generators that write story data (`packages/endo/src`, `packages/soil/src`, `packages/topo/src` `data/gen_data.py`) open their
  output with `newline='\n'`, so a run on Windows writes LF too.
- **Checked on the Windows PC** when both were fixed: all 16 builds' `--check` and `tools/release.mjs --check` pass; the
  four small tests pass (`packages/pass/src/test-sets.mjs` after `node packages/pass/src/build.mjs`, as its usage says); the data
  generators whose inputs are in the repository (lbi, ovary, pet) write their data files unchanged;
  `tools/studio/test/make.mjs` writes the same files (its listings differ only in their times); `relay/test.mjs` gives
  the results it gives without the fix, but `--watch` now passes (its 5 failures about a relay stopped by SIGTERM and
  restarted come from Windows, with or without the fix); the smoke blocks with the changed lines, served by a plain file
  server as the smoke test asks (the relay's `--static` serves no `tools/`): studio recorder, studio paint (11) and studio
  examples (6) pass, developer mode passes but for its two "Older and Newer" steps, which fail without the fix too (they
  wait for v142), and its release step now passes. `tools/collab.mjs` and `tools/peer.mjs` (shared-room runs), the micro
  and nmd generators (their inputs stay out of the repository) and the three Python generators only as far as their
  syntax and finding their folder.

## The smoke test (`tools/smoke.mjs`)

The smoke test (serve the folder, then run it) loads every story (and the design room: its 49 miniatures built, a click putting one on the stage
with its card as `props.json` has it, a pretend headset's grip, its shared state, Tidy; and the studio, below), scrubs through it, plays it as a slideshow
(a paused scrub near a stop holding, a stop exactly at a chapter's end and at the
last one, the voice finishing the chapter there where a story has a recording,
Next on the page, in the bar and on the headset panel beside the chapter arrows,
Next going on), exercises explore
mode and the headset panels (the headset Stories screen too: its header only the title, the hint and Back to the story,
its cards in two rows, the first half of the list on top, each row level, centred and in the list's order, under the
header and within about 0.65 m of the eyes; for the muscle, endotype, PET, microanatomy, ovary, qubits, mutation, tissue topology, soil and pass stories every explore tool too,
for the tissue topology story the panes' numbers against its data (the patch's counts at the poster's snapshots, the
held-out test, a window's share of the gap, the two groups, cell v's score), for the soil story the panes' numbers
against its data (nitrate on day 24, day 70's chlorophyll read off the slides, the network's links at three thresholds,
none left shuffled, the wheat lines' own networks) and a plot and a kind picked with the pointer, for the mutation,
tissue topology and soil stories also their links (each opens explore mode on what it says), for the CDK5 story (v189) its
data's key numbers against `CDATA` and five of its links, for the pass story in both languages with its switch; for
the robot gang every rule, a click to walk, crumbs, a big open floor and one
with no area, and a pretend headset room from detected planes; for the tutorial (`tutorial: the guide`, v173) its
figure drawn by `bodies.js` (or the plain one where float vertex textures are missing) at 20 s, one figure, the
network's 10 nodes and the badge hidden at 95 s, the guide and its copy at 155 s, no narration hold on a page, a signal
from the hub spreading, practice's first four tasks ticked by calls (a page's four of four), `apply(state())` giving the
same state and a room's state taken),
loads every story again watching its load (`HOST.progress` rising from 0 to its total once per step, the page's bar
and step shown and gone, no task of the load longer than `LOAD_LIMIT`, 4 s: generous, as SwiftShader compiles one
shader at a time in software; the shared-room hooks seeing the scene only once it is built; a story picked while
another builds stopping that one's steps and keeping the controllers and place), and with a pretend headset (its
frames driven, the drawing recorded) the loading scene in VR and AR: nothing before 0.4 s, then the card 1.2 m in
front and 15 cm below the eyes (nothing at the wrist), drawn in a scene of its own (not the story's, no
listener of the story's), the clear colour kept, the card fading out over the story's first frames,
switches stories, runs anchored placement in each
story with a pretend headset (an origin that jumps, anchors that stay, saved
handles), checks the headset settings with a pretend headset in a page of
its own (labels on top and cards in 3D by default, also on a device that chose
its labels under the old key; the menu's Labels, Cards and Moving buttons
going round, each leaving the other, kept across a reload, set by `#labels=`
and `#cards=`; for the qubits, the flock and
the airports, each mode of each switch on its own: labels on top as sprites, in
3D as depth-tested upright signs turned to the head, also after it moves, and
hidden, the story panels staying as the cards have them (labels hidden leaving
both panels drawn and pointable); the two story panels in 3D in the scene
(depth-tested, writing depth, `renderOrder` -1, `alphaTest` above 0, their
materials built again only when the mode changes, the ray still reaching each),
on top as before, and with cards hidden neither panel drawn or pointable in
story and explore mode, the labels staying, A or X doing nothing and the menu's Story tab's copy of the foot bar
playing; back again
from hidden; the Stories screen's panels on top throughout; a free grip turning the scene 90 degrees with the hand, the
point held staying in it, staying when let go and facing you again with free
moving off; the panel tilting with the hand; the flock's grip taking only the
panel; subtitles: off by default with nothing drawn, on through the menu's row,
kept across a reload, set by `#subs=on`, the caption the words of the line on
show (several captions for a long line) changing with the clock, holding while
paused, none in explore mode or on the Stories screen, still for a 10 degree
turn of the head and following a 40 degree one with lag, the pass story's in
German, the hook in all sixteen; panels per story: shown by default, the menu's
Panels row going round (controls only, hidden, shown) with the story following,
no row on the Stories screen (its panels staying), each value in story and
explore mode (controls only: the foot bar alone, the text panel neither drawn
nor pointable; hidden: neither, A or X doing nothing and the Story tab's copy of the foot bar playing), cards hidden still
hiding both and labels hidden neither, each story its own (the qubits, the flock, the airports, the
design room), kept per story across a reload, set by a link for the story it
opens, the panels and cards lines in all sixteen and every page in `STORY_EXTRA`; the frame-rate read-out (off by
default with nothing drawn, on through the menu's Frame rate row, the story's frames drawn through `HOST.perf` from the
pretend head giving a second's triangles, draw calls and code time, the read-out showing them with the frames a second and
the frame times, 22 degrees down and 14 to the left 1 m away and staying so as the head turns, kept across a reload,
`#fps=off` and `#fps=on`, nothing drawn when off; a double press of B on a pretend controller turning it on with
its notice, of Y off again, one press, two 0.6 s apart and a B held as its controller appeared doing nothing); the keypad (`HOST.collab.keypad`: the menu opening with its
keys, OK and Delete greyed while empty, *atelier 22*, Delete and OK giving *atelier 2* and closing the menu again, Back
giving null, another tab giving null, and null at once on a page without a headset session); the menu's Design room
button outside a room opening the design room, the menu closing and the button
greyed there), the stories' sound effects (per story: its cue table, names the
shell knows, places that resolve, times within the story; a paused scrub across
cues playing none; a stretch played asking for exactly the cues it crosses; one
explore action's sound, `SFX_PICK`; a pretend headset's press on a story panel
button clicking; at a slideshow stop no cue past it until Next, then the next),
real-world occlusion (a pretend AR headset driven through three.js r128's own WebXR path, its depth a real WebGL2
texture array made in the page each frame, window depth with no far plane, and a pretend room scan; a magenta test plane
read back from the layer's framebuffer hidden where the real world is nearer and drawn where it is farther, in both
eyes, also the other way round, an eye without depth unoccluded, the real world 2 cm nearer not hiding it; the room's
wall hiding what stands behind it, depth sensing never paused or resumed ; off; both; the menu never hidden; the default *room and people*
and the menu's row going round, kept; a story's own cleared by a story change and the objects hung in the next story's
scene; nothing drawn after the session ends; CPU depth; `#occl=off`; `HOST.xr.request`'s ladder (a TypeError naming
`'unsigned-short'`, another refusal) and VR as ever; the session line in every story; after a sleep, the fake's
session hidden and visible again (its `visibilityState` and events), its depth dead until `resumeDepthSensing`, a
binding made after it died or never, its `depthActive`, its bindings' generation (one made before it moved on throws),
plane spaces with no pose or a new set of planes, a changed `textureType`, and the times shortened (`times()`): a short
hide changing nothing (no renew, no resume, no new binding); a long sleep with the depth dead and `depthActive` false:
asked again at once (`occlusion renew`, `wake`, how long hidden), resumed once, a new binding, `occlusion back`, the
plane hidden again in both eyes; the depth dying with no sleep: the watchdog asks again (`depth lost`), a new binding,
no resume (`depthActive` true); a binding from before throwing every frame (6 in a row here): asked again (`depth
throws`, its error), the plane hidden again; the room's planes with no pose: `occlusion room` posed 0, the room built
again (`room`), nothing hidden, then planes given again: `occlusion back`, the wall hiding again; the depth and the room
back steadily (0.3 s here): their tries started afresh (`occlusion steady`, two and one), no renew; depth that never comes
back: six tries, then `occlusion gave up` once, the line *depth stopped N s ago: leave AR and enter
again*, one notice and no more tries, and back by itself: drawn again, the line plain; one texture per eye: decided
afresh (`shape`), the plane hidden in both eyes, probed and read as a depth buffer's, and a texture array again;
never a pause; after the session, the WebGL context lost and restored (`WEBGL_lose_context`): both logged, our own GL
objects forgotten, and a new session's depth hiding the plane with them made again),
focus mode (on by default on a pretend phone, 390 x 844 and 360 px wide, and an iPad, 1180 x 820, with touch:
`HOST.focus()` true, the panel hidden, the slim bars, the subtitle strip's text the shell's caption for the line on show
and changing with the clock, none in explore mode or on the Stories screen, a chapter's title at its start, Text opening
the panel and closing it with a resize each time, explore's drawer closed by default, then open and closed; `#focus=off`
giving today's layout; a desktop page unchanged; and the framing lines in all sixteen stories and every page in
`STORY_EXTRA`),
phones and tablets (the top bar fitting at 320, 360, 390 and 430 px with a pretend AR and VR and Install, and on an
iPad either way round, on the Stories screen, in a story with focus mode on and off and in explore mode, AR always in it;
More's items, and More opening on the Stories screen without closing it; AR in focus mode's top bar only where a
pretend WebXR has it, the invitation once and not after a reload; back from a story opened from the Stories screen
returning there, forward going back in, back with Text open closing Text, the Stories button not piling entries up;
full screen asked for once per card tap through a stub, never with a pretend headset session or Enter VR just pressed,
its toggle in More only where the browser has full screen; the iPhone tip once, not after a reload, never in the Home
Screen app; the timeline's touch strip at least 20 px from both edges),
and fails on console errors:

```sh
npx http-server -p 8123 -c-1 .          # or: python3 -m http.server 8123
node tools/smoke.mjs http://127.0.0.1:8123/
node tools/smoke.mjs http://127.0.0.1:8123/ --only studio       # only the studio's pages
```

### `--only <words>`

`--only <words>` runs only the steps whose names start with the words and the blocks that hold them (each block
of steps is guarded by its name, `runs(...)`; the headset settings, a block of mixed names, runs only without it; focus
mode and phones and tablets run with `--only 'focus mode'`, `phones`, `tablets` or `iPhone`): `--only studio` the
studio's pages, `--only 'studio texture swaps'` one block of them, `--only tutorial` one story's steps (its `load
<key>` step always runs with its block, v179: before, it was filtered out by its own name and the story's steps ran on
the page's default story). For a builder's own steps; the release run is the whole test.

### smoke: away idle

Its *away idle* steps (`--only 'away idle'`, a page of their own, a minute or two): the away lines (`xrIdle` and
its call right after `xrBegin` in `frame`) in every story and every page in `STORY_EXTRA`; then for the airports (written
by hand), the qubits (built from sets) and the flock (a live simulation) a pretend VR headset driving the story's real
frame function through three.js's ArrayCamera path, `HOST.room.away` and `inRoom` stubbed: at a station every frame a
full one (`xrUpdate` each frame, the world shown and walked, the birds flying); away, a second of full frames with the
world and the panels hidden; then frames that only render (no `xrUpdate`, no set's `update`, `window.__frames` counting
on), `GL.world.updateMatrixWorld` its own no-op (moving the world and walking the scene's matrices leaves its matrix as
it was), the birds still; back, the first frame a full one, the world shown and walked again, the birds flying on from
where they were; away again and the session ending while idle: the walk given back. Its *uploads* steps (
`--only uploads`, a page of their own with WebGL2's calls counted, a minute or two): the tissue topology story paused at
212 s (the tower), the qubits at 267 s and the mutation story at 253 s sending no buffer in six frames (they sent 186,
102 and 258 before), and playing on; the robots in explore mode with 12 robots for four seconds: their cleaned floor
sent as boxes through `copyTextureToTexture` and no whole map. The design room's *few draws* step (with its other
steps, `--only design`): every miniature in one or two meshes of the two shared materials, static and with `aMat`, at
most 110 meshes shown on the table and 110 draws for it (337 and 334 before).

### smoke: stick moving

Its *stick moving* steps (`--only 'stick moving'`, a page of their own, a minute or two; a pretend VR headset whose
frames go first through the session's own `requestAnimationFrame`, the shell's hook and its own callback, and then the
story's frame with the same frame object, as three.js's would: a reference space that makes offset spaces, a new frame
each tick answering for the head, two controllers with gamepads and an anchor from where they really are; 60 frames a
second on the test's clock): off by default; one click of a stick opening the menu only after 0.4 s; a stick clicked
twice turning it on (its notice, `xrWalk`, no menu then or later), both sticks at once one click (the menu once), kept
across a reload, the left stick clicked twice again turning it off (the right stick's double click is the spaceship's since
v132), two clicks 0.6 s apart the menu twice; the left stick
pushed forward for a second moving the head three.js sees 1.5 m where it faces (within 5 cm), the story's own head with
it, the left controller's ray with it, the anchor not; a push of 0.6 to the right a quarter of the speed to the right;
the dead zone nothing; a flick of the right stick turning 30 degrees about the head (held, no more), a flick left back;
forward after a turn where the head now faces; the setting off moving nothing and keeping where you are; in the airports'
explore mode the stick's spin and zoom left alone while it applies and working again when it is off, the grip held on
the globe (`squeezestart`) its reach still following the stick with no moving, let go the stick moving you again; the
menu's row on and pressed both ways; in a pretend shared room elsewhere (`HOST.collab.joined`, `code` and `here()`
stubbed, `here()` false): moved and turned before it is joined, the travel gone as the room is joined (back where you
stand), the left stick 1.5 m where you face, a flick 30 degrees, `walkWhy` `''` and the row pressable, another room's code
while moved taking the travel back again, then moved and turned once more and in the room with the others (`here()` true)
back where you stand, the sticks
moving nothing, two clicks saying *Not while you are in the room with the others*, the row greyed, and elsewhere again
the stick moving you; in AR, in a pretend shared room with an older `shared.js` (no `here()`: any room, the travel back
to none) and with the story's `ownSticks`: the sticks moving nothing, two clicks saying why in a notice, the row greyed; the studio's
`sticks: { say, note }` and no `ownSticks`; `#walk=off` and `#walk=on`; the `xrWalking` line in every story and
`STORY_EXTRA` page, every explore stick waiting on it, and no story reading `buttons[4]`. Then the studio's two stick
modes, on its test scene with editing on, the pretend controllers pointing down, outside a room and again at a pretend
studio station in a shared room (`HOST.collab.joined`, `live`, `HOST.room`'s `inRoom`, `away`, `placing`, `gripLocked`,
`matrix` and `recenter`, and `HOST.anchor.frame` stubbed: the rig at the station's spot, the scene on the room's frame):
the setting off, the row pressable there, the left stick walking 1.5 m through the scene (`XR.walk`) and the card's line
*Sticks: the studio's*; two clicks to moving you (*Sticks: moving you*, nothing jumping, the card's line); the left stick
1.5 m through the scene where the head faces and a flick right 30 degrees about the head, three.js's head and the
shell's travel still; the box carried (the grip held): the left stick moving you 1.5 m all the same, the sticks steering
nothing, the box staying in the hand (within 1 mm) and so 1.5 m through the scene, a flick turning it 30 degrees with
you; two clicks back while carrying (*Sticks: the studio's*, nothing jumping), the right stick up pushing the box away
again; Recenter taking the walk back (at the station the station's Recenter too); in AR two clicks saying *Not in AR*.

### smoke: spaceship

Its *spaceship* steps (`--only spaceship`, a page of their own, a few minutes; the stick moving steps' pretend VR
headset, its frames through the session's own `requestAnimationFrame` so the shell's hook steps the ship, 60 frames a
second on the test's clock, which the ship's relay time follows there, `HOST.ships.testClock`; the right controller's grip
turned by the test; the drones frozen, `debug.freeze`): the right stick clicked twice launching (its notice, no menu), the
ship 0.5 m ahead of the controller facing where the head does; the left stick twice still moving with the sticks, both at
once one menu; the right stick twice again landing; a tracked right hand refused in words. The controller's tilt
steering nothing (rolled 40 degrees either way, nose up or down 40, turned 75 about the vertical, the ship flying
straight and level); the right stick full right all the way round (392 degrees in 2.8 s), banking 50 degrees; pulled back
climbing at 60 to its 3 m ceiling and held there, released level (v134's loop steps went with the loops in v137); nothing
of the tilt left (no `steer`, `angles`,
`steering`, `setSteering`, no `neutral` or `roll` in the state, `xrShipSteer` gone). The stick's numbers: full right 140
degrees a second to the right (within 3), full left the other way, 0.5 at (0.35 / 0.85)^1.5 x 140 (about 37), 0.1 nothing;
pulled back climbing at 60 degrees, pushed forward diving at 60, released level; the state's stick and the mapping
(`stick`, `axes`, `STICK`). No Steering row on the Settings tab, its height between 1,500 and 1,900 px (printed: the
canvas is 1,920). Two right-stick clicks pushed past 0.5 neither landing nor opening the menu (logged, at most once a
second); a pushed click then
one at its middle at once the menu alone (never paired); two at its middle landing. Cruise
1.2 m/s, half grip 0.72, full grip -0.5, at most 2.5 m/s2; A boosting to 3.2 m/s for 0.8 s, not again until 4 s of
recharge, braking ending it. The trigger held a second: 5 bolts at 9.2 m/s (8 plus the ship's), none older than 1.25 s.
Alone: 3 targets and 2 drones, led here; two bolts destroying a target (counted); a drone's bolt taking 10 of the shield
(the buzz 0.4 for 60 ms), refilled after 2 s, then past the shield into the health, which stays. Pickups (times
shortened): the boost's (a boost of 1.2 s, recharged in 1 s, gone after its time), rapid fire's (10 bolts in a second,
gone after its time), the reinforced shield's (150, a hit of 20 taken from the extra, which never refills), one living
1.5 s gone after it, at most 2 at once. Destroyed at 0 (*Destroyed by a drone*, no ship drawn, the strip shown), a new ship
5 s later at the controller, full, level though the controller is nosed up. Flying, the right controller's select and squeeze events
reaching no listener after the shell's guard, the left's all six; its ray at the open menu pointing at nothing (`kind`
shell, `dist` 0, no hover) where the left's points at the menu; landed, its presses heard again; a trigger and grip
pressed before the launch getting their ends through (and the next press not); moving with the sticks
on, a flick of the right stick turning nothing while the left stick moves you. In the airports' explore mode the right
stick spinning and zooming nothing while it flies, and again once landed. Flying alone (the game in its own frame),
another's ship and bolt handed in taken by nobody. The menu's Spaceship row launching and
landing; another story (the flock) keeping it flying, drawn in its scene; the session's end landing it. Heading out from
its launch spot (the set moving) it flies on past 6 m, never turned back, and the set's middle follows it (moved 3 m or
more, at most 4 m behind it; v139); the strip shown and the arrow with the head turned away; in AR a pretend wall (a plane
of the room scan 1 m ahead) not stopping it (it flies on through, its heading kept); nothing see-through among its materials but small
additive glows, each adding its colour and keeping the alpha , and drawn over a see-through background (alpha 0,
as in AR, on a canvas of its own) the glow and the shield's ring leaving the alpha at 0 everywhere while adding light; the
ship under 600 triangles.

### smoke: frame rate

Its *frame rate* steps (`--only 'frame rate'`, a page of its own, about five minutes; `FPS_FAKE`: a pretend Quest
driven through three.js r128's own WebXR path, a layer with a framebuffer of its own, two controllers; its session lists
72, 80, 90 and 120 Hz and records what `updateTargetFrameRate` is asked, which fires `frameratechange`; its layer records
what `fixedFoveation` is set to and what three.js made it with; every 2D texture upload counted per frame): a session
asking for 90 Hz and logging it (`frame rate`, `frame rate change`); the Debug tab's Refresh rate row going 90, 120, 72,
80, 90 Hz and asking each again; 100 asking 90 and 60 asking 72; nothing in `HOST.xr.sig()`; 120 kept across a reload and
asked; `#hz=72`; a session without the API asking nothing, the row greyed, logged; the read-out's words (*NN fps of 90
Hz*) and colour at 90, 88 (green), 86, 72 (amber), 71 and 40 (red), and without a rate as before. In a room on this device
with every story's station, the design room, the studio, All stories and Back to the lobby, the headset lined up on its
floor: every card that shows drawn once, at most one a frame (drawn and sent to the GPU), the nearest first (their
distances never falling), each drawn once, saying its look, kicker, title and *Nobody here* (an All stories circle *All
stories*), no back face or edge shown or pointable; every story's station playing for 2.6 s, then paused at 1:03,
a card pointed at for a second (its edge lit, gone once it is not) and another carried by the grip (its edge lit, its
ring larger, put down again): no card drawn again or sent to the GPU; someone walking into a circle drawing its card
once more (*1 person here*) and no other, and out again once more (*Nobody here*). The menu on the Debug tab: the frame rate changed three times,
its line (*... · the headset at 90 Hz*) drawn and sent alone (`texSubImage2D 652x30`), the whole menu never, the texture's
version unchanged, the row read back from the GPU the canvas's and not the line before; someone walking between two
circles drawing the Settings and Debug tabs not at all and Circles each time; the Debug tab's height printed (under 1500
px). Foveation: the story's 0.5, then the row 0, 0.5, 1 and the story's again (each set once, the 0.5 from before put
back), a story's own set back; Resolution 90, 80, 100 % from the next session (its layer made at 0.9); both kept across a
reload; `#fov=1&scale=80` and `#fov=story&scale=1`.

### smoke: developer mode

Its *developer mode* steps (`--only 'developer mode'`, a page of their own, a few minutes): off by default with
nothing shown and the switch and What is new at the Stories screen's foot; `#dev=on` showing the card over the Stories
screen with the served file's lists; Got it keeping it away for that version across a reload, a stand-in file of another
version showing it again (an empty list without its heading), Later and Escape until the next load; a link into a story
showing it over the story; What is new by hand; a file answered 404 said in one line; the switch and `#dev=off`; More's
two items at 600 px. Then a pretend headset session (as the headset settings' steps make one), the welcome on and made
1.5 s long: the menu opening at What is new only once the welcome has shown and gone, Later closing it and the menu
(again the next session), Got it closing them and keeping the version (not the next session); with the welcome off, a
moment into the session; developer mode off, never; the Settings row and the Debug tab's What is new (Back to the tab).
Without the file (404, on a page that has fetched none) the card has Later alone, focused, and the headset's page Back
alone; while it is fetched by hand (the server slowed down 1.5 s) the card says *Fetching what is new...* with Later
alone, then Got it once it has come; the page's card open as a headset session starts closes, as Later.

### smoke: update the room

Its *update the room* steps (`--only 'update the room'`, a page of its own in a room on this device, a minute or
two): the Shared dialog's button (*Reload this device* there, with its line) armed by a first press for 3 s (*Reload this
device? Press again*, then back), a second press within it sending the order to the room's other tabs and obeying it at
once here (rank 0, 0.4 s; the toast *Updating the room: reloading in 1 s.*), kept for the reload (`roomReload`), the
reload itself replaced by a test hook; the labels in a room with others (*Update the room*, *Reload every device? Press
again*); an order heard twice obeyed once (*one obeyed just now*), one 3 minutes old skipped (*too old*); the headset
menu's `room:reload` on the Circles tab of a pretend session, two presses within 3 s; a real reload by an order: back
in the story in explore mode (livePlace), in the room, `room reload back` with its shell matching; and refused (4006, the
relay's words naming a newer version) while an order counts down: status `newer`, *reloads in its turn*,
`HOST.live.roomNewer` not called and the order's own reload coming at its turn; with none under way `roomNewer` at once;
with one whose reload never came, `roomNewer` once its 40 s are up.

### smoke: phone ar

Its *phone ar* steps (`--only 'phone ar'`, two pages of their own, a minute or two): a pretend Android phone
(Chrome's user agent, touch, 412 x 860; a pretend `navigator.xr` that records what it is asked for; the airports story's
own `xrStart` through three.js r128's WebXR path, frames driven by the test; screen taps as Chrome makes them: a
transient `screen` input source, `selectstart`, a frame, `select`, `selectend`). No button on the page; the AR request
asking for `dom-overlay` once with `#xrPhone` as its root, depth sensing still asked; the round button in the session in
the window's top right corner (52 px, a 50 % radius, an icon, *Menu*), the root letting the middle of the screen
through; `beforexrselect` cancelled on the button, the sheet, a row and the sheet's heading, not on the root, the page or
the canvas; the sheet's thirteen rows in order, none under 44 px tall, each toggle (Sound, Narration, Sound effects,
Subtitles, Slideshow, Frame rate, Labels, Cards, Panels, Real world hides) changing what `HOST` says to what the headset
menu's row would and its words and `aria-pressed` saying so, Recenter asking the story to recentre, and the headset
menu's Settings tab having each of those rows; The full menu opening the 3D menu (logged as by `phone`, the sheet
closed), its row then *Close the full menu* and closing it, Close and the button closing the sheet; the notice *The
menu* saying *Tap the round button at the top right for the menu.* and the welcome a phone's words (no trigger, no
stick); Exit AR ending the session and the button gone; without the overlay (not granted) no button, two quick taps at
nothing opening and closing the 3D menu (logged as by `tap`), two 0.6 s apart not, and two at the open menu's margin
(pointed at, the menu's hover) leaving it open; the overlay refused once (a `NotSupportedError`, not the person's or
the browser's own): asked again at once without it, depth sensing still asked (two requests), the session running with
no button and two quick taps opening and closing the menu; refused again without it (a `SecurityError`, as when the tap's
activation has gone): no session, nothing of the button, and the page's line *Could not start AR: it was refused with
the menu button (...) and again without it (...). Tap Enter AR again.*; the person's own refusal (`NotAllowedError`) at
the first ask: asked once, the browser's words as they were; a headset's user agent asking for no `dom-overlay` and
showing no button. Camera mode's request is checked in `node tools/collab.mjs --camera` (its root `#camera`, `dom-overlay` once, no
phone button).

### smoke: controllers after standby

Its *controllers after standby* steps (`--only 'controllers after standby'`, a page of their own, a minute or two;
`HOST.inputsGuard`, "Controllers after standby"): a pretend Quest's VR session through three.js r128's own WebXR path (a
pretend `navigator.xr` and session, the airports story's own `xrStart`, frames driven by the test through the session's
`requestAnimationFrame`, so the guard runs before the story's frame as on a headset), two Touch controllers with
gamepads pointing at the floor, the session's events fired as a browser fires them (before the frame's callbacks) or
not, and what reaches three.js's two controllers (the story's) and the session's listeners after the shell's recorded.
The controllers the browser announces reaching the story; real presses of the trigger and the grip, and one whose event
comes a frame before the gamepad shows it down, given once each, nothing missed, given or announced. Hidden and visible
again, waking moved back two minutes (`wokeAgo`), the right controller replaced without an event: nothing the first
frame, announced the next (`inputs replaced`, `woke` about 120 s; `disconnected` and `connected` at the story's
controller, its source the new one), a real select on it reaching the story once; replaced again with the browser's own
event a frame late: not announced again. A trigger press with no `selectstart`: `press missed` (right, select, its
source came by an event, about 120 s after waking, visible, its profiles, mapped), armed, nothing at the story; its next
press given once (`selectstart` as it goes down, `select` and `selectend` as it comes up, marked synthetic at the
session); a given press with its ray on the menu's Subtitles row turning subtitles over once; a real press disarming it
(`press back`, two given), that press once; armed again, the browser's `selectstart` coming after the frame that gave the
press: stopped (the session's later listeners never hear it), the session's `select` and `selectend` ending it, the
story getting one press and the menu's row turning over once, disarmed. The grip the same (`squeezestart`, `squeeze`,
`squeezeend`). A given press's own events coming late (the window made 5 s, `lateMs`, as a frame drawn in software can
take longer than 250 ms): the session's `select` and `selectend` after the frame that gave its end stopped (the
session's later listeners never hear them), the story getting one press and the menu's row turning over once, still
armed; its whole press late (`selectstart`, `select`, `selectend`, the trigger up) stopped too, disarming it; armed
again, a real press with the trigger down again at once its own (two presses, the row back); with the window 250 ms
again, a stray `select` and `selectend` 300 ms later reaching three.js as before. A tracked hand's button with no event: nothing; a trigger pressed while the session is `visible-blurred`
and held as it is visible again: nothing missed or given.

### smoke: trackers

Its *trackers* steps (`--only trackers`, a page of its own in a room on this device, a minute or two; "Vive
trackers"): `@trk` fed through the shell's own intake (`HOST.collab.trkIn`) at relay times held (`trkTime`): a tracker
going at 1 m/s and turning 90 degrees a second drawn 40 ms behind between its samples (to 1e-6 m and 1e-4 of its turn),
carried on 60 ms past the last by its velocity and at most 100 ms (still seen at 340 ms), not heard of for 600 ms ok
false with that pose kept, one its row says is not seen held where it was; bad rows (no id, too long an id, NaN, a place
past 10 km, not an array), a late sample and a member's `@trk` (`by` set) ignored, the good row of a mixed message taken;
`tracker(id, out)`, the room's key read and written (a write keeping the rest, a name cut at 24 characters, '' taking one
out), a message with `l` '' not lined up; the story's `effect` hook never called. The Shared dialog's section with the
relay's `/api/ping`, `/api/trackers` and `/api/trackers/still` stubbed in the page (`fetch`): shown with the switch off and
the three trackers' rows (the base station counted, the Index named), turned on, a name typed into `trk.names`, a tracker
moved 5 cm lighting its row only, *Set spot A* (its question `id=LHR-A&ms=1000`, *Spot A taken (still to 1.2 mm)*), spot
B 20 cm away, 6 cm higher and with the relay's error refused in words, then 1.84 m away written as `trk.m`, B again
without A refused; once heard from, *Lined up by hand (the spots 1.84 m apart): 2 trackers in the room.* and the room
map's two dots (a pixel read at one). A pretend VR headset (a browser that is not a Quest's; local and local-floor
spaces from a pretend real room whose trackers' room stands 5 cm above its floor; frames 60 a second at relay times held,
each with the Index's head where it really is): the `'trackers'` frame after a second within 1 cm and 0.5 degrees (to
3e-6 cm), *Lined up by the PC's trackers*; the head turned 1.5 rad, moved and pitched, still there; SteamVR's space shifted
4 cm and 1.5 degrees, followed to within 1 cm and 0.5 degrees; the head turning at 3 rad/s with the trackers a frame
behind, nothing taken; `lineUp()`'s words (the room taken as one on a relay for that moment); the menu's question
answered for it (*In the room*), the frame again at once. The Debug tab's *Trackers* row turning the pucks on (kept as
`xrTrackers`): LHR-A's puck where it lies (1 mm in room coordinates, 1 cm in the story's space), depth-tested, named
*Lamp*; LHR-B's dim where it was last heard of, named *Belt*; hidden again. `body()`: this headset's head and its grips
(left, right) within 1 cm and 0.5 degrees of where they are in the room; presence's `g` `[left, right]` and its rays the
left's first though the session's sources are right, left; another person's two presences smoothed between them (their
right hand new, as it is), an older app's with no grips, nobody or a page null.

### Playwright, SwiftShader and what only a headset shows

It needs Playwright with a Chromium build (`npm i --no-save playwright` and
`npx playwright install chromium` once, or a global install; see
`docs/setup-and-release.md`). A 404 for a missing narration MP3 is expected and ignored.
WebGL runs in software (SwiftShader) headlessly, so frame rates are low;
real-headset behaviour (controllers, session hand-over between stories,
placement and comfort) can only be confirmed on a device - say so when you
report results.

### smoke: studio (the main studio block and its numbered pages)

The smoke test's studio block runs on a page of its own at
`#studio&scenes=tools/studio/test/scenes&scene=test&edit` (the committed test scene, no relay): not on the Stories
screen, in `STORY_EXTRA`; every file loaded with its sizes and the two guesses in the card's words (and one the studio
refuses, and one sized to 1 m), the clips, the missing texture, the opacity-0 material drawn solid and a mesh without
normals; the layout read; a pretend head moved into the cube showing the figure and the sound and hiding the box,
fading over 0.4 s (stepped frame by frame), the figure's take from when it was shown, out again the reverse, a
`stay` cube holding; nothing see-through while editing (the box the cube hides not drawn but its outline at once,
with its tag *Box · 12 ▲ · hidden*, pointed at through its unseen box, the labels pointed at and selected with its
triangles, the tag following a stand-in Fewer triangles preview; a pretend headset's grip and the page's arrows holding
it drawn whole, every material its own, its outline again once let go; the cube's edges only, in its own colour inside,
darker outside, lighter selected, picked from inside and outside; a shape the cube hides its edges and tag, a ball that
hides things its three rings, depth only, its unseen fill; nothing drawn of the items, their looks and tags see-through;
a pixel at the hidden box's middle the same with its outline drawn as without, and the box drawn there showing; not
editing, as before); editing on the page (a click selecting, the arrows moving it,
a cube grown, *Shows* under the box's Items card linking it, Add and Delete, Undo); the shared state and back (`apply(state())` the same), a state from
the room taken, bad values ignored; a pretend headset's grip carrying an object, both grips sizing it, a corner
stretching a cube, the VR stick walk (none in passthrough) and Recenter; the sticks while something is carried (the
other hand's left stick up held 1.5 s doubling the box about its middle, right a quarter turn in a second, the right stick
up pushing it away along the hand's line by e^0.75, left turning it back, no walk meanwhile, one Undo step; a group about
its pivot, twice and a quarter turn; a sound's reach; a locked box refused); the relay's watch (a scene added, a layout
removed) and its password (one refusal told once, nothing more asked until another; a stubbed `fetch`); the emitter's
HRTF panner at its place once shown, silent while muted; a sound longer than 20 s streamed through an element (no
decoded buffer), a short one decoded, paused while muted; GLB first (the Add list's folders, an OBJ from `originals/`,
*Convert to GLB* in the page offered as a download, its bytes a GLB whose record names the original and that loads back
with the same triangles and clip, a placed figure switched to it keeping where it stands, its corners within 1 mm);
the Upload pane with no relay (the test originals dropped: the plan's rows, grouping and names, converting offered as
downloads, a mono WAV of each sound, each model row's picture of its GLB); the Add pane's grid and pictures (no
relay: a card per model with a plain tile and its kind, the cards' words, sounds a list, 3 to 5 a row; *Convert to GLB*
making the figure's picture, 256 px with the model in the middle and dark corners, its record's `size` and `n`, shown on
its card; *Make pictures* making the box's and the crate's for this page, its line, *Stop* after one; a picture made for
an opening of the scene that is over kept nowhere; the headset's
canvas, three a row, a picture drawn and a plain tile without; `previews/` in a listing never among the scene's files
or textures, an older relay's `image` taken by its path); the Items pane as cards (with a group of a ball that spins
and an empty, a cut-out on the box and three shapes, one locked and hiding things, put in for it: the box's picture made
for this page, the figure's plain tile with its kind, a tile per shape, the empty, the cube and the sound, really drawn in
their colours; the order, the group's heading and its members first, the cut-out a tag after the box's face, the
sections by kind; the lines and the marks; a press on a card selecting it, its card lit under Items, the tag selecting
the cut-out, the heading the group; the cube selected, *Shows* and *Hides* under every card but its own and under the
cut-out's tag, three presses three Undo steps; the ball's faint line saying it spins; a pick by a press, the card ticked
with a green border, and the cut-out's tag pressed, on the list and green; the headset's canvas: three a row, paged by
More, the box's picture and the ball's tile bright where the figure's plain tile is dark, the selected card's border in
the accent colour, the cut-out's tag the card's width less its margins with its toggles on a row under it, picked, its
edge green, a toggle and a card's face pressed by a pretend ray); Fewer triangles and Change texture (a dense ball with a red and green checker
made in the page, 24,320 triangles, served as `ball.glb` and placed twice, nothing committed: its card's preview at 20 %
within 1 % on that object only, every corner's texture coordinates as before and its colours as before, the selected
ball's label and the other ball's tag counting their triangles (the preview's, its own; after the switch, the new
model's), the slider at 50 %, the pretend headset's card (steps and quick picks, its 10 %, Save only with a relay that takes uploads), Save
downloaded with `tris` in its record, both balls switched to it with the original as the base (*The model here has only
N*), Change texture's list, figure.png shown on that ball only, Cancel putting its own picture back, Save with `tex` in
its record, the headset's ray choosing and cancelling, nothing for a visitor; the Upload pane's share (20 %, its count
read from the bytes, 30 % on its slider), its picture and its conversion with that share); the gaps filled (a dense
ball whose picture is an atlas of 128 wavy pieces with 6 px of black between them, made in the page, placed as scanned:
pixels read back from four sides, none black with all its triangles, many at 10 % without the fill and none with it in
the preview, the same in the GLB Save downloads against the converter's own made with `fill: false`, the fill worked out
once for two shares, the record's `fill` and its note, the placed GLB's card line and Fewer triangles on it filling nothing
again; a picture that tiles and one a plane uses whole left alone; a piece drawn down 4 times by the converter's reading
filled with no dark rim beside it, the same drawn down by hand with one; a see-through picture whose gaps are clear left
alone and said, one whose gaps are opaque black filled with its alpha kept); the headset panels' panes and its Stories screen (no Upload tab and no Convert
there); *Download layout.json* giving the layout; `#studio&upload` opening the Upload pane.

### smoke: studio textures

Its *studio textures* steps
run on another page, at `&scene=textures` (the second test scene, every model placed): every rung of the ladder; TIFF
(LZW, PackBits), a PSD named by an FBX (the `.ps~` renaming) and DDS (DXT1, BC5) read in the page, their pixels sampled
against those they were made from (`tools/studio/test/pictures.mjs`); a refused picture's sentence; the cards' lines;
*Use paint.png* and *Choose a picture...* (the chooser stubbed with a file) each converting at once to a downloaded GLB
whose record has `tex` and that loads back textured, the object switched to it where it stands (corners within 1 mm),
its card then naming the picture; *Add a texture...* on a box with no material (Roughness preselected by the picture's
name, Colour chosen); no UVs refused in words; roughness and metalness packed into one; the crate's bump made a normal
map; the Upload pane's plan (`only`, `ext`, `similar`, *Not this* and *Use*, a picture dropped onto a row) and its four
GLBs with their records; no texture buttons, and nothing converted, for a visitor (`&visit`) or with editing off; the
headset's card (no texture buttons, *Add a texture on a laptop*).

### smoke: studio follow

Its *studio follow* steps run on a third page, at
`&scene=rig` (the third test scene: a skinned dancer whose bones are named in mixed conventions, Bob's box, the Z-up
figure, and *Voice* following her head by an FBX's name for it): the sound at her head bone plus its offset (worked out
on its own from the bone's matrix, within 1 mm) every frame the page draws and every 1/30 s of her clip, and at three
moments (her head through more than 0.5 m); the short list of bones and the lenient match (*mixamorig:Head*,
*mixamorigHead*, *MIXAMORIG_HEAD*, *Bip01 L Hand*); a part of Bob's box rising with it and the whole model; attaching,
another bone, *Move onto it* and *Stop following* each keeping it where it is (one Undo step each), and the page's card
(the pick list, the bone row, *More bones*) and its label (*→ Dancer · Head*), and the line to her head; a pretend
headset's grip carrying it (not following meanwhile, then following from there with a new offset); her size steps, both
grips and the arrows' size scaling its offset (the same point on her, within 1 mm, one Undo step each); *Convert to GLB*
of the figure (a turn baked in, a sound on its whole model) and of the dancer (*Voice* on her head bone) switching where
they stand, both sounds within 1 mm; her deletion (the sound stays, following nothing; Undo brings both back) and a
copy of *Voice*; a cube hiding her silencing *Voice* (its gain to 0 though it is shown) and showing her again starting
it from its beginning; the state with `on`, `bone` and `o` and back, bad values refused or dropped, a state without her
(the sound at its own place), `layout.json`'s rules (a sound whose object the layout lacks keeping what it follows),
Rigify's spine in the short list, the object it follows picked again changing nothing, a move while her model is not
here writing its place only, both grips between their writes and a sound naming a bone the figure lacks turned with
its GLB; the headset's card (its rows, a page of eight bones at a time, a
bone she lacks refused, the list of objects and the trigger on her).

### smoke: studio cuts

Its *studio cuts* steps run on a fourth page, at
`&scene=cuts` (the fourth test scene: a wall whose *Door* the cube *Doorway* shows, *Box A* with a *Hole* and *Box B* of
the same file, the dancer, the figure): pixels read back from a render of the scene prove each cut (inside the box where
the model was: what is behind it; outside: the model): the hole in *Box A* and none in *Box B* (one file, two objects, only
the first's materials patched); the wall whole with your head outside *Doorway* and opened inside it, whole again outside;
the wall moved, turned and sized (the door's corners in the wall's own frame unchanged, its record scaled with the size,
one Undo step) and the hole still where the door is; the dancer's posed head (her clip held where it is far from her
rest pose) cut by a box round it, her rest-pose place not; *Convert to GLB* of the figure (a turn and a scale baked in)
switching with its cut-out's corners within 1 mm and still cutting; the state with `x.<id>` and back, bad records
refused, unknown fields ignored, a state without the wall (the door kept, cutting nothing) and back; 16 on one object and
no more; `layout.json` with and without `cuts`; the page's card (*Cut out a part* where the click met the wall, the
size steps, *Preview: Whole*, *Cut* and *As seen*, Delete and Undo; deleting the wall taking its cut-outs and Undo
bringing them back; duplicating it copying them; *Move onto another object...* keeping its place); the Add pane's
button; the page's arrows; the pointer (a thin cut-out inside the wall found through the wall's unseen box, the wall
found in a pick, Box B moved in front of the door found first); *Preview: Cut* opening the door its cube hides, *As
seen* shutting it, editing off forgetting it; a new cut-out (and one put back by Undo) cutting at its first frame; 17 on
one object made in reverse id order (the 16 lowest cutting, the 17th said); a cut-out's copy and the wall's copy's door
in the cube's list; Box B sized with a 30 m cut-out held at 50 m and said on its card; *Cut out a part* from a ray at the
dancer's posed head landing on her as drawn; a pretend headset's grip carrying one, both grips sizing it and a corner
stretching it; nothing of a box drawn when not editing (only the hole); the Items pane (the wall's cut-outs tags on its card) and the headset's card (its rows;
Preview pressed there); the wall's cut-outs locked from its card (one Undo step): the door cutting as before, its box hidden and
never pointed at, sizing it, deleting it or the wall and a new cut-out on the wall refused, the card and the Items pane
saying so, the state and `layout.json` carrying `cutsLocked` (a bad one refused, false not kept), a copy of the wall not
locked, unlocked its box back, Undo bringing it all back; no see-through fill (the door's box with no mesh that shows, its edges lit when pointed at or selected, lighter with denser dashes and ticks a third long, plain again after; v131: its lines, ticks and corners opaque, previewed whole (cutting nothing) darker; the pixel at its middle the same with its box drawn as without, plain, pointed at and selected). v118 adds three steps after the pretend headset's grips: inside a model (the pretend controller in the figure's unseen box
pointing at nothing: the figure pointed at, its dot on its box, the trigger selecting it; pointing at the box from there:
the box; outside every box: nothing, and the trigger clearing; editing off: nothing; Walk view with the camera in her box:
a click on nothing selects her, one on the floor walks), *Hold it* (on her headset card only; armed, a grip of the other
hand on nothing carries her from where she stands, one Undo step; without it nothing; another selection or a second press
disarming it), the sticks (the ray on the panel: the left stick pushed down scrolls her card, held to its end and no
further, the dead zone nothing, pushed up back to the top, a ramp, neither the left stick walking nor the right turning
there, a hand carrying something not scrolling; pointing away the left stick walks again), and New scene and From
another scene (neither with the folder of scenes; with a relay and the keypad stubbed: the page's field and *Make it*,
the name rules said here first, a name taken, the headset's keypad asked, cancelled and given, no field in a headset;
neither for a visitor, while locked or on a read-only relay; a circle made for one scene opened `'fresh'`, one with items
from the room, a station changed to the same scene opened again).

### smoke: studio groups

Its *studio groups* steps run on a fifth page, at `&scene=rig` (with, put in for them, the figure,
a sound *Free*, a sound *Out* following the figure, a cut-out *Hole* on the box and a cube *Lamp* outside the group):
*Make a group...* on the box's card and its pick mode (the dancer Ctrl-clicked and *Free* Shift-clicked in the scene,
*Voice*, *Out* and *Curtain* by their cards under Items, *Done*: one Undo step each); a click on a member selecting the
group, again the member alone (*In group*, *Select the group*); hover naming the group (*Group · Dancer*); its box only while
selected and editing; the Items pane (the group's heading, its members' cards under it, the hole a tag on the box's card); *Make a group...* then
*Done* with one item leaving no step; a group picking its one member left out of `layout.json` and *Unsaved changes*;
Undo of the pick that gave a group its second member, after *Done* and while picking, leaving it picking again (*Done*
then taking it back as never made, no step left over); the arrows' move, turn (the vertical ring only; a tilt given dropped) and size about
the pivot moving every member exactly (places, turns, sizes, the cube's size and yaw, the sounds' reach; the hole on the
box and *Voice* on her head bone and *Out* on the figure outside the group, within 1 mm), one Undo step each, and Undo
bringing the state back; the pivot staying within 2 mm after a turn of 0.6 rad, a quarter turn more and a size; the
card's *Turn 90°*, ×2 and *On the floor* (lifted 0.4 m first, *Curtain* centred on the floor not counted); ×20 holding
two sounds' reach at 20 m, said on the card; ×400 holding a place at 1 km (every member written, none left behind); *Duplicate* (a new group of the six copies and the hole's copy, the box's copy beside it,
*Voice*'s copy on the dancer's copy, *Out*'s still on the figure beside it, *Curtain*'s copy hiding the dancer's copy,
the copies in *Lamp*'s list, one step), *Ungroup* and *Delete* (every member and the hole, *Lamp* letting them go) with
Undo; *Free* moved into the figure's own group, the figure then deleted and its group, left with one, going in the same
step (*Out* left following nothing), Undo bringing both back; *Lamp*'s pick toggling the group's members, its cube too (a member, a cube
of the group, the group's heading under Items; a group of cubes alone putting both on the list, the pick going on, v154); the
state with `g.<id>` and back, `norm`'s rules, a bad group from the room
ignored, an id two groups name staying in the lower id's in either order of the keys; `layout.json` with and without
`groups`, and groups naming items the layout lacks; a pretend headset's trigger (the group, then the member), its grip
carrying the group (one step), turning with the hand only while moving freely, both grips doubling its size about the
pivot, a member selected alone carried alone, the box carried alone and the other grip on the dancer carrying her alone
(one step), the group held and then gone from the room ending its change in the next frame (Undo working at once), and
the headset's cards (the group's rows, *Add or remove items...* pressed
twice; a member's *Select the group*, *Make a new group...* and Faces).

### smoke: studio faces

Its *studio faces* steps run on a sixth page, at
`&scene=rig` (the box still, and *Twin*, a copy of its file): pixels read back from renders, each with the object drawn
and not: from inside a box *As in the file* shows nothing of it and *Inside out* and *Both sides* show it, two copies of
one file each as set (their materials' sides too); from outside *As in the file* and *Both sides* its near side, *Inside
out* its far inner side, which a cut-out taking the far half away removes (and leaves *As in the file*'s near side); with
a cut-out in its near side *Both sides* showing its far inner side through the hole and *As in the file* nothing, lit and
as scanned; *Inside out* kept through a rebuild of its file (`fileChanged`) and the figure's *Both sides* through *Convert
to GLB* and the switch; the state and `layout.json` with `faces` (`null` read as absent, other values refused); the page's Faces row (one Undo
step each) and the headset's.

### smoke: studio tint

Its *studio tint* steps run on a page of their own, at `&scene=rig` (the box still, and
*Twin*, a copy of its file, beside it; `--only 'studio tint'`): pixels read back from renders of both near sides: a red tint
(`#ff5a4b`) making the box redder, brightness 2 brighter and 0.5 darker, Twin unchanged, lit and as scanned; the box's
materials its colour as loaded times the tint times 1.5, each its own; kept through a rebuild of its file (`fileChanged`)
and the figure's *Convert to GLB* and switch; the state and `layout.json` with `tint` and `bright` and back, `norm`'s rules
(a colour lower-cased, other values refused, a brightness held at 0.25 and 4, 1 dropped, rounded to 2 decimals); the
page's rows (a swatch, *Any colour*, Darker, Brighter, Reset greyed at 100 %, None: one Undo step each; Darker held at 25 %
and greyed; not refused by a lock in place), a group's rows (both objects in one step, *Brightness: they differ*, Brighter
on each one's own) and the headset's (a swatch and Brighter pressed on its panel, no colour field there). Its *studio
viewer* steps run on a page of their own, at `&scene=test` (`--only 'studio viewer'`), the viewer's pixels read from
the canvas in the same task as it draws: an Add card's Look (none in a headset; the overlay at z-index 14 over the whole
window, the canvas raised to 13, Close focused; the box, 12 triangles, 0.5 m, 5 cm grid squares, turning by itself; drawn
in the middle with the background at the sides; a click stopping it, a drag of 100 by 20 px turning it 40 degrees round
and 6 up, the wheel zooming out by e^0.24, a right drag panning, a double click framing it again exactly; Wireframe
changing over 1,000 pixels; Textures off taking every picture off and on putting them back; As scanned; Delete, Ctrl+Z
and P reaching nothing behind it; Esc: the overlay gone, the canvas under the page again, nothing written, Undo unchanged,
the studio drawing again); an Upload row's Preview (the test originals dropped: the figure stood up, 1.7 m, its 12
triangles, drawn in the middle; Close leaving *Seen in the viewer* on its row; then a dense ball made in the page: 24,320
triangles, 20 % kept within 1 %, *All: 24,320 · Lighter: 4,8xx*; the wireframe changing more pixels for all its triangles
than for the lighter one; Side by side drawing both, the left half with more edges, each said over it; the slider at 50 %
making it again within 2 %; Close putting 50 % and what was seen on the row; nothing written); and Fewer triangles' Look
closer on the ball placed and tinted red (its tint on the viewer's materials and drawn red, 24,320 triangles at the card's
20 %; the slider at 30 % showing it side by side; Esc putting 30 % on the card, its preview made again; nothing written).

### smoke: studio shapes

Its *studio ktx2* steps (v151, `--only 'studio ktx2'`, about a minute) run on a page of their own at `&scene=test` with
the page's default texture kind, KTX2 up to 8k (`browser.newPage({ studioTex: null })`: every other page of the smoke test
and of `tools/collab.mjs` starts with the studio's textures *JPEG/PNG, up to 2k*, `studioTexKind` = `img2`, as their steps,
written before v151, read the GLBs they make back with a plain GLTFLoader): the kind by default (`ktx8`, 8,192 px, effort
1); a GLB written in the page from a quad whose colour picture is 4,096 px (with its mips more than the encoder's
12,582,912 texels) and has alpha in its top 64 rows and whose normal map is 1,002 x 602: `KHR_texture_basisu` used and
required, both textures with the extension and no other source, the record's `ktx2` `{ n: 2, effort: 1, max: 8192, zstd:
true }`, the GLB's length and every bufferView 4-byte aligned, both images `image/ktx2`, UASTC, zstd; the colour one 4,096 px,
13 levels, sRGB, alpha; the normal map 1,004 x 604 (a multiple of 4), 10 levels, linear, no alpha; every chain ending at
1 x 1; the 4,096 px one made in more strips than levels; its notes and progress. A 64 px black and white checkerboard
used as base colour and normal map (one texture), emission (another) and roughness and metalness (a third), all one
picture: two images, an sRGB KTX2 for base colour and emission and a linear one for the normal map and roughness, four
textures (the one used both ways copied for its data use), the list's copy and the note; level 1 of each read back by the
transcoder 188 (averaged in linear light) and 128; a clearcoat slot taken as data. Loaded for display through the studio's
`ktxLoader()`: compressed textures, ASTC 4 x 4 where the renderer offers it (SwiftShader does), 13 levels at 4,096 px and
sRGB for colour, 10 at 1,004 x 604 and linear for the normal map; drawn at 1:1 (nearest, a 1,024 px window of the middle,
into a target read back) against the picture it was made from (as three.js draws it on the quad, flipped): a mean
difference under 2 of 255 and under 0.2 % of samples more than 24 off (here 0.13 and 0.008 %); `capCompressed` with an
explicit `&maxtex=` of 1,024 dropping its top two levels (11 left, 1,024 px, its words *KTX2, ASTC here*, its bytes).
Read for conversion (no KTX2 loader, maxTex 2,048): plain pictures on canvases, level 1 (2,048 px) of the 4,096 px one,
its full size counted (`CONV.stats`: *4096x4096 KTX2*, *1004x604 KTX2*), its pictures counting as filled where its record
says `fill`; made again with no KTX2 as a GLB of PNG or JPEG that a plain GLTFLoader reads at 2,048 px, its record's fill
kept and no `ktx2`. Placed in the scene (routed as `models/quad.glb`): its model ready, every texture `KTX2, ... here` with
its bytes, the card's Textures line *4096 × 4096 (KTX2, ASTC here)* and *Its textures are KTX2 (compressed): all kept
compressed on the GPU, N MB with their mipmaps.*; the viewer's Add card (`vwLoad`, routed as `models/quad2.glb`)
reading it at most 4,096 px with the default kind (`maxTexView()`, `CONV.load` wrapped to see its `maxTex`: 4,096 where
`maxTexNow()` is 8,192), and with *JPEG/PNG, up to 2k* both 2,048; the Upload pane's *Textures* row and its line; *JPEG/PNG, up to 4k*
pressed (kept as `img4`, its words), *Compressed (KTX2), up to 4k* (`ktx4`) and back to the default (nothing stored); a
pretend headset session (`XR.on`): *JPEG/PNG, up to 2k* whatever was chosen, no KTX2, and the words *compressed (KTX2)
textures are made on a laptop or desktop*.

Its *studio shapes* steps run on a seventh page, at `&scene=test` : the Add pane's four shapes and an empty
(their records, geometries and names), a shape's card (a colour's swatch, *Hides things*, size per side and every side, its
kind, five Undo steps), the page's arrows sizing it per axis in its own frame, the Items pane's Shapes and Empties cards, the
headset's card (its rows, a colour pressed); pixels read back from renders: a shape that hides things between the camera
and the box shows the sky behind where the box was, one in red draws red, and editing shows its opaque edges alone (
no fill; an unseen one pointable) while it still hides (pixels); a
sound following an empty (picked by pointing, following as it moves, the cards on both sides, silenced by a cube hiding the
empty), an empty drawn only while editing; *Lock in place* on the card (one Undo step, the move buttons greyed, the arrows
off, the 🔒 in the label) refusing the card's actions, the Delete key, *Hold it*, a pretend headset's grip, both grips and a
corner; a group with a locked member not moving or going and saying which, a group's lock holding its member and refusing
*Ungroup*, an object with a locked cut-out not deleted; *Unlock* from the card (the turn then working) and *Lock* from the
headset's card (its move and Delete buttons then not offered); the scene's settings rows (page and headset, only while
editing, one Undo step each) and the shell's hooks, stubbed, told in order: outside a room only the real world, at a
pretend station the other circles hidden, away both off, *Never*, back; another scene's settings and its hooks off; the
lobby hook forgetting a cube that stays and starting a `shown` animation again, writing nothing; the state with `p.<id>`,
`e.<id>`, `locked` and `settings` and back, the room's records taken (colour lower-cased, `locked: false` dropped), bad
ones and bad settings ignored, a state without settings a new scene's, 200 shapes at most from the room, `layout.json`
with shapes, empties and settings read back the same, an older layout read as before, bad settings and a bad shape
counted, a group of a shape and an empty; and the hooks off as the studio goes.

### smoke: studio behaviours

Its *studio behaviours* steps run on a page
of its own at `&scene=test` (with a turned shape that looks, a ball that follows, an empty that keeps away and a cube
that follows the ball put in for them, a pretend head moved about, `STU.head` with its turn, and the clock held, `behNow`):
the look's front to the head, its middle still; the ball 1 m in front of the head at its own height and turned to it,
never faster than its speed; the cube at its offset on the ball as drawn, and still while the ball spins; the empty at
least its distance from the head within its area, cornered to the far side of its area, home once home is clear of the
head; an object (the box) looking; nobody in range, all of them where they are placed and every record unchanged; who it
reacts to with pretend others (`BEH.fake`): nearest (one nearer by 0.2 m not taking over, by 0.4 m taking over, kept to
range + 0.5 m, ties by id), first (the first kept while the other stands nearer, until they leave; ties by id), this
device driving only while it is the one, a page with no head counting for nothing; going on while selected (editing:
still driven here, away from its place, its ghost at its placed pose) and resting while carried and while paused, starting
again from its place each time ; a pretend other device's samples (its effect, `studioEffect`) drawn
120 ms behind (within 2 mm) and going home once they end; the page's Behaviour rows (Follow, First to come close, More,
Closer, Faster, Keep away, Less, Look at, Follow an item... by pointing and by the list, None: one Undo step each, the
pick none) and the headset's; the state and `layout.json` carrying behaviours and giving them back, `norm`'s rules (bad
kinds, whos, numbers and targets refused, out of range held, another kind's fields dropped, a cube's and a sound's
ignored), a bad behaviour in a layout counted, a group's copy following its own; and Faces: the cube following the
ball with Faces *The item* turned to face the ball within a degree, its middle unchanged, and back as placed; the item's
Faces row on a page (kept when another item is picked) and on the headset's card (Right then Them: one record with `side`
and `face`; Look at dropping it); `face` through the state and `layout.json`, and `norm`'s rules for it.

### smoke: studio motions

Its *studio motions* steps run on two pages
of their own at `&scene=test` (with a shape turned and sized per axis, an empty, a sound following the empty and a
cut-out on the box put in for them): each kind's drawn pose at two moments its formula (about its middle, in the scene's
axes, for the shape, the box and the empty), its holder and record unchanged; the sound on the bobbing empty, the cut-out
on the spinning box and a sound on the pulsing box (its offset grown with it) coming along; no motion, at rest; `always`
drawn alike on both pages at one room time (a pretend station, `HOST.collab.now` stubbed), `shown` from its showing and
from its beginning when shown again; going on while selected (editing) and its group selected (both members' ghosts
shown, the group's pivot still while they move), resting while a sound on it is selected or carried and while a pretend
headset's grip carries it, moving again after ; the page's Motion rows (a kind, Faster, Less, an axis, When
shown, another kind, The other way, None: one Undo step each, the line about the ghost, the list's *spins*) and the
headset's (Pulse, More, None); then a step for the ghost: none before it is selected, at its placed pose while a
bob draws it 1 m above, one part and one unseen box; the page's arrows on its stand-in (`TCP`), a drag through
`TransformControls`' own events moving its record by 0.5 m with it resting there meanwhile (one Undo step) and moving on
from there after; a ray at where it is placed (under where it is drawn) finding the item through its ghost, a pretend
headset's grip there carrying it from its placed pose and moving it 0.3 m; an object's ghost (its clip off) as many
parts as its model's meshes, opaque light grey, writing depth , a big one (`GHOST.tris` lowered) only its outline
box, an empty's two parts, a sound's (its own path) two, none of them see-through, none once deselected; the box with its
clip playing while editing: a ghost at its placed pose, its opaque outline box only , and still once selected, the
page's arrows on its holder there ; its ghost built again while its clip stands still, the model
keeping its frame ; Pause from the Scene pane (every item at rest, the box's clip time held over 0.7 s of scene
clock, the pane saying so, `state()` unchanged), the card's switch playing them again (the arrows back on the ghost), P
pausing (the arrows back on the item), editing off playing them again; Start again on a motion that starts when shown
(its clock from now, no Undo step); a cut-out on the spinning box and a sound following the orbiting empty, each
selected: what it is on resting, no ghost, the arrows on its own holder, a drag through `TransformControls`' events not
moving it as it begins and moving it by just the 0.1 m dragged (one Undo step), let go within the record's rounding, both
moving again once deselected; and a cut-out made where a click met the spinning box (its clip off) put on that part
of it in its own frame, within 1 mm, though it spun on before *Cut out a part*; the state and `layout.json` carrying motions and giving them back, `norm`'s
rules (bad kinds, values, axes and starts refused, out of range held, a cube's ignored), a bad motion in a layout counted.

### smoke: studio paths

Its *studio paths* steps run on a page of their own at `&scene=test` (with a shape, an empty and two sounds put in
for them, the recorder's clock the test's): a recording by a pretend headset's grip (Record its movement armed on the
box's card, a grip on nothing, 3 s at 30 frames a second, the hand moving and turning, the right stick pushing and the
left turning): fewer than half the samples kept as keys, the pose at every sample's time (between keys too) within 5 mm
at its middle and 1 degree of what was recorded, one Undo step, its place unchanged, playing at once while selected and
drawn there as recorded, playing on once selected again, Undo taking it back; a path of three keys on the shape at chosen
times looped, once and back and forth, at ×2 and when shown, a bob on top, the shape moved and turned (its path with
it), a sound following it, a sound's own path (and its emitter), a following sound's own path waiting, the box's cut-out
coming along, at rest without one; the refusals in words (too short, not moved, a jittery 700 frames needing more than
600 keys, ten empties of 599 keys leaving no room for the scene's 6,000 and their copies refused, the shared state's limit
lowered, a locked item, a following sound, a group) with nothing changed, and 120 s stopping it and keeping it (its slow
drift's last centimetre cut as a still end, v122); a page's
recording (Record on the card, the Move arrows dragged 0.6 m over a second through `TransformControls`' own events, half
a second still, the size steps and the Size arrows refused, Turn 90° on its card, half a second still, Stop): its timing
as recorded, its still end cut (it ends 1.533 s in, the first sample after the turn: it loops), the card saying its end is
60 cm and 90° from its start and 0.5 s of stillness cut, one Undo step, its place as before, playing at once with its
arrows on its ghost; the page's rows (Once, Back and forth, When shown, Faster, Slower, Loop, Start again with its
*shown* clock from now and drawn at its path's start, no Undo step, Delete recording: one Undo step each) and the
headset's (no page Record, Record its movement armed and disarmed, Back and forth, Faster, Delete recording); the
recording's ghost and the loop join : a pretend headset's recording of the box (12 frames still, a circle 0.5 m
across at 2.5 s a turn stopping 4.2 cm short of its start, 12 frames still), its ghost at its start pose in every frame
and lit from the frame it came back within 5 cm (frame 85), a pulse of 0.1 on the stubbed haptic actuator and a forced
`hover` tick asked of the stubbed `HOST.sfx.play` in that frame; the path cut to 73 frames (2.433 s, moving within 0.1
s), its last key its first's pose, drawn within 5 mm across the seam and its velocity over the last and the first 0.05
s within 30 % of each other; one Undo step, its place unchanged; the card's *Loop closed: its end met its start (4 cm, 0°
apart; 0.8 s of stillness cut)* and *Keep it as recorded* (the raw 3.233 s path, its last key 4.2 cm from its first, one
Undo step); one ending 40 cm away not joined (*Its end is 40 cm from its start, so it jumps back each loop...*, nothing to
keep); a back-and-forth one recorded again neither cut nor bent and no line; a page's recording through the arrows (0.3
m out and back to 2 cm, 10 frames still, Stop) its ghost lit and joined (*... (2 cm, 0° apart; 0.3 s of stillness
cut)*, its last key its first's pose, 0.967 s, one Undo step); Stays on the floor : the page's row off by default
and on once pressed (`studioRecFloor`), a pretend headset's recording of the box started 0.5 m up and tilted (asin 0.6
about x and turned) with the hand lifting, tilting and turning it and the sticks pushing and turning: drawn on the floor
and turned only about the vertical after every frame's carry, every key's turn within 0.05 degrees of a turn about the
vertical and its lowest point within 1 mm of the floor (and drawn so by its path), its record set down on the floor with
its turn and x and z as they were, one Undo step, Undo putting it back up; an empty and a sound lifted and tilted keeping
their height; a page's recording of the shape with the Turn arrows tilting it as they turn it (no tilting rings, the
scene's frame, the tilt dropped from its record and holder), *Stand up* refused, the Move arrows with no up arrow and a
lift dropped, its keys on the floor and turned 0.9 rad about the vertical, one Undo step; Record then Cancel leaving the
raised box as it was with nothing to undo; the headset card's row pressed off and on; kept across a reload (the page
loaded again, the row on, then turned off); the state and `layout.json` carrying paths (an
object's, a shape's, an empty's, a sound's) and giving them back, `norm`'s rules (2 to 600 keys, the first at 0, strictly
later, at most 120 s, 8 finite numbers a key, a turn of length 0, play, start and speed, a cube's and a cut-out's
ignored, a following sound's kept and not played), a layout and a state from the room past 6,000 keys, and a GLB switch
of the figure turning its keys (drawn where it was, its turn times the baked one).

### smoke: studio walks

Its *studio walks* steps (`--only 'studio walks'`, about a minute; v164) run on a page of their own at `&scene=walks&edit`
(the walks test scene: the neon walker's Walk in place, Idle and Walk forward; Walker on a recorded path, Follower
following it), frames run by the test at a held scene clock: `norm`'s rules for `anim: 'move'`, `idle` and `strideK`
(kept, none dropped, held at their limits, bad ones refused), the state both ways (a factor from the room taken) and
`layout.json` both ways, a copy keeping them (one Undo step); the stride measured from Walk in place within 6 % of its
1.27 m by design, its feet together where it stands, Walk forward's root motion measured within 2 % and its hips' travel
taken out of what plays (under 1 cm a cycle); on the path, the clip's time where the path's distance at its moment puts
it (its timeline held at five moments and scrubbed a tenth of a second; the stride fitted to the loop), Idle on the
path's still start (half faded after 5 frames, gone after 15, Idle on the scene's clock), walking again, Pause holding
the frame and a held path still scrubbing it, a path played once walking on its way and standing with Idle at its end;
the follower walking by what it is drawn doing; an object moved by hand (forward on, backwards back, sideways on by its
size, a 3 m jump counting nothing; standing with its walk held where its feet are together), its stride times its size
and factor; the cards' rows on the page (*As it moves*, *Standing*, *Stride*, *Longer*, *As measured*, Loop bringing the
clip's timeline back and taking Standing away; one Undo step each) and on the headset's card (*Shorter*, *Still*, the next
standing clip, *As measured*).

### smoke: studio recorder

Its *studio recorder* steps (`--only 'studio recorder'` runs them alone, about two minutes) run on a page served by a
relay of its own (`--static . --scenes` on a temporary copy of the test scene, ports from 8930: uploads land there and are
read back from the disk) in a browser of its own with Chromium's fake microphone (`--use-fake-ui-for-media-stream
--use-fake-device-for-media-stream`): a ten-minute page recording of the box (18,000 frames of a circle on the recorder's
clock, the test's) stopping by itself at 10 minutes, simplified a slice at a time (`SIMP.last`: at least 2 slices, the
longest under 100 ms) and kept as `recordings/Box-1.json` through the relay (its record's
`src`, `len` and `n`, more than 600 keys, the file's `n`, `k` and `len` the same, one Undo step, its place unchanged, its
card's line), drawn at 10, 50 and 90 % in within 5 mm and 1 degree of the samples and a loop later the same, then its keys
dropped here and read back from the scene as another device reads them; 18,000 jittery samples (a shaky hand for ten
minutes, made in the page) simplified at once, a slice at a time and by the simplifier as it was before slices, the same
keys all three ways (its times printed, the longest slice under 100 ms); a 3 s one still in the record; the refusals with
the relay's uploads turned off (its longest 120 s, a recording past 2 minutes, more than 600 keys: in words, nothing
changed, no file); `norm`'s rules for `src`, `len` and `n`; the state and `layout.json` giving a file's path back (the
scene's 6,000 not counting it); the figure given that path and switched to a GLB, a new file `recordings/Figure-1.json` with
its keys turned, drawn where it was (within 1.5 mm), and with the relay's uploads off (or its file not in the scene, said
within 3 s) not switched at all: the figure left on `figure.fbx` with its path, no Undo step, its card and the note saying
why (*Not switched to models/figure-x.glb: its recorded path is kept as the file ...*); *Move the scene to this circle* at
a pretend station's circle (2 m off, turned a quarter) with a sound whose own path is a file: refused in words with the
uploads off, nothing moved; with them, a new file `recordings/Walking-1.json`, the sound drawn where it was turned with the
scene (within 1.5 mm), one Undo step, Undo giving its file back; then *With my voice* turned on (the card's switch says so), a page
recording of 4 s in real time (0.6 s still, then round) with the fake microphone: its sound `sounds/Box-voice-1.wav` on the
relay's disk (a mono 16-bit WAV at 48 kHz) placed as *Box voice* following the box with `sync`, `loop: false`, `skip` the
loop join's cut start less how late the microphone began (within 2 ms) and `len` to the path's end (`dur - skip`, at most
the path's), the path and the sound one Undo step; with the sound on, its voice where the path's clock says within 50 ms
as it plays and again at the path's next pass; *Record again* with the microphone 1.5 s late (`getUserMedia` delayed in
the page, the movement begun at once): a new file `sounds/Box-voice-2.wav` (the first one's on the disk unchanged), the
same sound pointed at it, `skip` below 0 and `len` to the path's end, more than the file's length (the old rule cut it),
still synced 0.3 s before its end and heard within 50 ms of the path's clock; the state and `layout.json` round trip;
`norm`'s rules for `sync`, `skip` and `len`; the recording deleted leaving the sound, its card saying *no longer synced*,
and Undo taking each step back (the voice's first file again). Then a streamed voice: `sounds/long.wav` (25 s) synced to a
40 s path of the box, playing through its element: its moment within 80 ms of the path's clock as it plays (median 60
ms, at most 120 over 3 s, sampled every 0.2 s), put 0.5 s off and set again within 3 s, and started again (as a new pass)
at its level at once. It prints what it measured (keys, the drawn distance, the simplification's slices, the voices'
offsets).

### smoke: studio texture swaps

Its *studio texture swaps* steps run on a page of their own at `&scene=test` (`--only 'studio texture swaps'` runs
them alone, about two minutes), with two solid 8 px pictures made in the page and served as the scene's own
(`tex/magenta.png`, `tex/lime.png`), *Twin* (a second object of `box.glb`) and three cubes put in for them (*Magenta* and
*Lime* overlapping, both on the box's colour, and *Stays*, a cube that stays, on it in lime): the pictures read once, a
GLB's without flipping and sent to the GPU ahead; pixels read back from renders of the box's and Twin's fronts with a
pretend head moved about: outside its own, in *Magenta* magenta, in both *Lime* (entered last), in *Lime* alone lime, in
both again *Magenta* (entered last), outside its own, in *Stays* lime and still lime outside, in *Magenta* after it
magenta and lime again outside, Twin its own throughout and its materials untouched; Reset what I have seen and the lobby
hook giving its own back; Change texture's preview opened on the box with the head in *Magenta* (its own shown, the box
`held`), the cube's again once it closes; as scanned (its material as scanned made while the cube's picture was on: from
its own) the colour change shown and a normal-map entry on its lit material only, out of the cube both materials' own
pictures; the state and `layout.json` carrying `tex` and giving it back, `norm`'s rules (an entry that is not one
dropped: an id that is not one, a material of -1, 1.5 or 256, a slot it has not, a path with `..`, a model's file, `{}`,
`null`, a list; a second for the same object, material and slot; 17 kept as 16; `null` or `[]` absent; a string or an
object a bad cube; an unknown field dropped), a layout's four bad entries counted (`texBad`) and one for an object it
lacks dropped, a cube whose `tex` is a string bad, the Scene pane's sentence; the page's card: *Change a texture...*, the
object from the card's list, *Another object...*, Twin by a click in the scene (`pressItem`), Glow and *lime.png*: the
entry added (one Undo step), Twin glowing lime in the cube and the box magenta, nothing outside; its row flashing the box
in amber (no Undo step); ✕ (one Undo step) and Undo; the Items card *Cube · shows 0, hides 0, textures 2*; editing off and
a visitor (`OPT.visit`): no pick, no change, the button greyed; the headset's card (its rows, *Change a texture...*
pressed, the trigger on the box, Occlusion and *magenta.png* pressed on the panel, the entry added, ✕: one Undo step
each); deleting the box taking its entries out of all three cubes (one Undo step, Undo bringing them back), duplicating it
adding an entry for the copy beside the box's in *Magenta* and *Stays*, a cube's copy keeping its entries, a group (the
box and *Lime*) copied (the cube's copy on the box's copy, *Magenta* gaining an entry for it); `texRemap` (two materials
swapped by meshes and names, by names, none known) and `texSwitched` (a material's index changed in a switch's change,
Undo); and the figure, with an entry, converted to a GLB in the page and switched to it: its entry kept, its material found
again (`[0]`), put on its GLB's model in the cube and off outside.

### smoke: studio cube starts

Its *studio cube starts* steps (`--only 'studio cube starts'`, about three minutes) run on a page of their own at
`&scene=test` with editing on: *Lift* (1 s, up 0.4 m) added to `box.glb`'s clips in the page, *Twin* (a second object of
`box.glb`, Animation Off) and four cubes apart from Doorway (*W*, *S* a cube that stays, *D*, *H*), the studio's clock held
by the test (`trgClock`) and a pretend head moved about. Clips (the box's node read back): a once from its start (y 0.03 at
150 ms, half blended in; 0.2 at 500 ms; on after leaving; fading from its end; gone with no layers and its end logged), Twin
still throughout; a new run 360 ms after leaving crossfading from the old one's frame (0.222: half Lift(0.96), half
Lift(0.15)); out 100 ms and in again one start; a loop on the stay cube on after leaving until Reset what I have seen
(at rest at once, logged); a hold at its end, coming off 0.3 s after leaving, fading, gone; H's stop blending S's loop out,
not back while S stays active, again as S is entered again; a stop as you leave 0.3 s after; over the box's own Spin (at
full weight no turn, its own weight 0; after it its own Spin again on its clock); a timeline's hold showing its own Spin
alone, the layer back once let go; Pause holding the frame; a clip it lacks (nothing, its end logged as missing, the card's
amber line); the ghost while a cube plays a clip with Animation Off its outline only. Sounds (the real clock, the sound on):
a sound a cube names shown but silent; the tone's once from its start at its level at once, over at its end, again from its
start entered again; a long once (streamed) on after leaving; a loop in the stay cube replacing it, its element looping on
its run's clock (within 0.3 s), on after leaving; a stop fading it to 0 and stopping it; hidden 2 s into a run silent, shown
again back on its run's clock. Paths and motions (a shape on a 2 s path, an empty spinning, a shape wobbling, a voice
recorded with the path): waiting at its start; once 1 then 2 (its end logged), waiting at its end, the next run from 0; the
voice from each run's start (`'r<n>:0'`), silent past its 0.6 s; carried and paused at its placed pose; a loop off 0.3 s
after leaving finishing its pass (1.5 at 3.5 s, 2 at 4.1 s); a hold held at its end, going back (1.5 at 3.9 s, 0 at 5.5 s);
a stop mid-once where it is; a spin once (90° at 0.5 s, 180° at 1 s, at rest at 2.1 s), a loop finishing its turn (270° at
3.5 s, at rest at 4.1 s); a wobble at most 2° 50 ms in and 20° mid-run; an entry on the voice ignored, the card saying to
start the path. The state and `layout.json` carry `plays` and give them back; `norm`'s rules (each bad entry dropped, one
per item, what and moment, 16 at most, a clip on a stop dropped, how written as once, `when: 'enter'` dropped, `null` or `[]`
absent, a string or an object a bad cube); a layout's four bad entries counted (`playBad`), one naming an item it lacks or
of the wrong kind dropped, a cube whose `plays` is a string bad, the Scene pane's sentence. The page's card: one pick at a
time (Pick what it shows, Change a texture..., Start something...); *Start something...*, the shape from the list (its
path), *Another item...*, the box by a click in the scene (`pressItem`, its first animation), *Lift*, *Hold*, no When, the
sentence, *Add* (one Undo step); *Replace* in its place; a second entry on the sound; its row flashing the box in blue (no
Undo step); ✕ and Undo; *Try* (the box's Bob here, no Undo step; a tried loop off after 10 s, and pressed again at once:
*Stop*); the Items card *Cube · shows 0, hides 0, starts 2* and the box's *started by a cube*; editing off and a visitor:
no pick, no change, the button greyed. The headset's card: its rows, *Start something...* pressed, the trigger on the box,
*Bob*, *Loop* and *Add* pressed on the panel (Replace in its place), ✕. An entry taken away: its cube keeps no inside
(`trgList` drops the edge of a cube with no starts left), so a leave entry put back after you walked out fires nothing, and
a sound whose only entry goes ends its run there (`trgList` ends a sound's, path's or motion's run no cube names any
more). Deleting the box taking its entries out of both
cubes (one Undo step, Undo bringing them back), duplicating it adding entries for the copy beside its own, a cube's copy
keeping its entries, a group (the box and *S*) copied (the cube's copy on the box's copy, *W* gaining an entry); the
figure with an entry on its take converted to a GLB in the page and switched to it: its entry kept, its take played on its
GLB's model; and the lobby stopping every run at once (the box at rest, the sound stopped, logged) and a cube you stand in
firing again the next frame.

### smoke: studio cube switches

Its *studio cube switches* steps (`--only 'studio cube switches'`, about two minutes) run on a page of their own at
`&scene=test` with editing on, the clocks held by the test (`behNow` and `trgClock` both `window.__T`), with cubes made
in the page: *Bee* (3 m) holding *Ant* (1 m) in its middle, and a pretend head inside both, in Bee alone or outside
("Cubes that switch cubes" under "The studio"). Ant hiding Bee: in Bee alone the box hidden; in Ant too Bee switched off
by Ant (`on` false, `raw` true, not inside, its out moment then, the box shown again); the page's card (*Switched off by
Ant. It reacts to no one until it is switched on again.*), the blocks both twins draw and its heading, Bee's edges much
darker (`CUBE_EDGE.off`, 0.42 of its colour) and its tag *Bee · switched off*, the Items card's *switched off*, Ant
selected: one red line to Bee's middle; out of Ant, Bee switched on and entered at that moment; `norm` dropping a cube's
own id from its lists and keeping another cube's. *Dot*, which Ant (a stay cube) shows: switched off with you inside
(*Switched off: it waits for Ant to switch it on*), on for good once Ant was entered, off again after *Reset what I have
seen*. Bee showing the figure and looping *Bob* on the box, with a leave entry on the tone: switched off by Ant while
inside, the figure hidden at once, the loop off and the leave entry fired 0.3 s later (both at that moment); switched on
(out of Ant, in Bee) the figure shown and the loop started again at once; as a stay cube, switched off it stays active
(the figure shown, the loop on) and its leave entry fires. Picking (Ant's *Pick what it hides*): a press on *Cat* puts
it on the list (one Undo step, the pick going on, Ant still selected, a tick *✕ switched off by Ant* over Cat), *Eel*'s
Items card with `link` and its Shows and Hides ticks, Undo; a group of Cat, Eel, the figure and Ant itself: a press on
Eel puts Cat, Eel and the figure on the list (not Ant), the group's heading `linkg` and ticked, again taking them off. A
sequence (*Flip*) hiding Bee at 0.5 s: on at 0.2 s, off at 0.6 s (*Switched off by the sequence Flip*), on again once
rewound; its event row *0.50 s · Bee · switches off* and the options *Switch it on*, *Switch it off*. A press on *Knob*
showing Bee: Bee waits (*Switched off: it waits for Knob to be pressed or pointed at*), pressed (`pr.<id>` in the state)
it is on and entered; its row *Bee · switches on*. Two cubes switching each other off walked into at once: 20 frames
alike, the lower id off; side by side and walked into one after the other (the lower id first, then the higher id
first): the first one keeps the second off, 10 frames alike; a chain against the id order (Cat off Bee, Bee off Ant)
settled in one frame (Ant on, Bee off, Cat on, nothing held); a ring of three held (`STUDIO.switches()` `held` 3), 20
frames alike. Duplicate Bee: the copy on Ant's hide list and Cat's show list beside Bee, an event and a press entry for
it beside Bee's, its own lists kept, one Undo step; Delete Bee: off every list, Flip's event and Knob's press gone, Undo
bringing them back; a group of Ant and Bee copied (Ant's copy hiding Bee's copy, Cat showing both); the state and
`layout.json` giving back cube ids in lists, a sequence's event and a press's entry on a cube. Two pages whose clocks
differ, Bee and Ant both for everyone (Bee hiding the box and looping Bob on it): another person's head in Bee (its
sample 300 ms before the room's now), then in Ant too: on both pages Bee switched off by Ant with its out moment Ant's
entry (that head's sample), the box shown, the loop's start the first sample, coming off 0.3 s after the switch.

### smoke: studio edit speed

Its *studio edit speed* steps (`--only 'studio edit speed'`, a minute) run on a page of their own at `&scene=test`
with editing on, what edit mode no longer does every frame ("Editing without the cost" under "The studio"): a hover (the
figure) and a selection (the box) held 60 frames drawn as a headset draws its labels (sprites, the scene rendered each
frame): no `texImage2D`, no `linkProgram`, the same sprites, pictures, shader programs and HTML, and the hover moved to the
sound made again once (one upload) and then held; `rayPick` making no world matrices (GL.world's `updateMatrixWorld` not
called) and still finding the box, `pagePick` once, a pretend headset's `xrPoint` none with `XR.pickStale` false and once
with it true; the panel's signature the same whatever item is pointed at; on the main panel, a tab pointed at: no
`texImage2D`, the texture's version and full draws unchanged, one `texSubImage2D` a rectangle (pixels sent the rectangles'
area, under 4 % of the card), one `generateMipmap`, nothing outside the rectangles changed and within them a full redraw's
pixels (a mean difference under 1), the GPU texture there the canvas's (read back through a framebuffer) and the menu's
Story tab drawing that texture; pointing off it a patch too, another pane a full redraw; an Items card's face pointed at
(a cube selected) drawing its whole background (taller than its face) again; the tags and lines drawn together (those
shown gathered, `LOOKS.BT.stats`, each on the layer no camera sees, the tags' draw an instance each, the figure's where its
sprite is and its size, its picture its own on the tags' canvas, the selected cube's edges in their colour in the depth-tested
lines' draw; ten more empties adding at most ten draws, their dots, where each was three); and the page's panes not built
while `GL.renderer.xr.isPresenting` (the HTML unchanged, `X.dirty` kept, `X.skipped` counting) and built once it is not.

### smoke: studio everyone

Its *studio everyone* steps (`--only 'studio everyone'`, a minute) run on two pages of their own at `&scene=test`,
another person's head given as a pretend head with the time stamp of its sample (`BEH.fake`), the room's clock and the
clock of what cubes start held by the test: an each-person cube (Doorway, starting Bob once) changing nothing for another
person's head; set to *Everyone here* on the page's card (one Undo step), the box hidden and the figure and the tone shown
for that head, its run started at the sample's room moment on both pages though their own clocks differ (999800 and
1999800 there, 4999800 in the room's), its out moment that of the sample outside; a stay one active after the head has
left, until Reset; two everyone cubes over the box entered at one moment, the higher id deciding, both ways round; at a
pretend station (`atStation` and the shell's `heads` stubbed) a head with no time, and one whose time is not a number,
entering at the room's time now (no NaN) and leaving at it; the headset's row (Each person, one Undo step, Undo); norm's
rules (`all` true kept, false and null absent, anything else bad), the state and `layout.json` both ways.

### smoke: studio walls

Its *studio walls* steps (`--only 'studio walls'`, a minute) run on a page of their own at `&scene=test` with
pretend walls (`STUDIO.walls`: a 4 x 5 m room) and four shapes on walls: with no walls where they are placed (the card
says so); the walls' normals into the room; one in its direction on the near wall at x 1.25, its back 3 cm off it, facing
into the room; one turned to face +x on the nearest, the right wall, facing -x; one 2.4 m up, 40 cm tall, held at 2.3 m
with no gap; one following a pretend person onto the right wall, never faster than 0.6 m/s, and with nobody back on the
wall in its direction; the near wall 50 cm nearer: eased (not jumped after one frame), there within 1.5 s; no walls again:
back where placed; every record unchanged; carried, at its placed pose; one wall given the wrong way round (its normal
out of the room): turned towards the head as it was read and kept so with the head moved beyond it, the one in its
direction at x 1.25 from there; one wall with no head turned towards the scene's origin; one wall in two pieces both
turned to the head; the walls read by `wallsXR` from a pretend AR frame's planes (a near and a right wall, a door and
the floor left out: their segments, heights and normals). Then the card's rows on the page (On a wall, Nearest, Gap
more, Follows the person: one Undo step each, the record in order) and the headset's (In its direction, Gap less twice);
norm's rules (`at` required among three, defaults, the gap's default not written, held at 0.5 m, a person's fields
dropped elsewhere), the state and `layout.json`.

### smoke: studio shows

Its *studio shows* steps (`--only 'studio shows'`, under a minute) run on a page of their own at `&scene=test` with
a pretend session's kind (`STUDIO.sess`): the box only for AR, the tone only for VR, a ball only for VR and an empty only
for AR, shown and heard in AR, in VR and on a page (as VR) as their records say, the tone inside the cube heard in VR and
not in AR; editing on a page the box drawn as a hidden item is (its edges, its tag *Box · 12 ▲ · AR only*, pointed at;
the labels pointed at and selected), the ball not; in AR the ball's tag *· VR only*; the page's row (Only AR, Only VR,
AR and VR: one Undo step each), the headset's (on the tone); norm's rules (on objects, sounds, shapes and empties; a
cube's ignored), the state and `layout.json`.

### smoke: studio screens

Its *studio screens* steps (`--only 'studio screens'`, a few minutes; needs `ffmpeg` to make its WebM clips, else
skipped with a note, since Playwright's Chromium has no H.264 or AAC): adding a screen, an audio player and one from a
video's card; its picture and its sound through an HRTF panner, silent when muted; the bar shown and pressed by ray and by
pointer (play, pause, previous, next, seek and a seek drag, volume), each writing `play` with no Undo step; loop all, one
and off, shuffle's order; a cube hiding it; the 4 and 2 limits; sync own; who may use the bar (editing, anyone, a locked
story, `&visit`); `norm`'s rules, `layout.json` without `play`, *Unsaved changes* ignoring it, the headset's card and bar;
and two pages carrying the state between them. `node relay/test.mjs --video` runs the relay's video kinds, uploads under
`videos/` and the conversion job (a real `ffmpeg` with libx264 where the machine has one).

### smoke: studio paint

Its *studio paint* steps (`--only 'studio paint'`, a few minutes): paint mode on and off; the four brushes (their
triangles, opaque materials, at most four draws, pixels read back); a real pointer drag on a page; sampling, simplifying
and the spray's seed; the Eraser (one Undo step); the 4,000 points refused in words without a relay; `norm`'s rules and
the layout and state round trips; a cube hiding it, groups, Duplicate, a lock refusing, Clear, the Items card; a pretend
headset's trigger with pressure, the ribbon's normal, the tip ball, a panel press, the grip carrying it and the Paint
pane's buttons; and on a relay of its own, a painting kept as a file past 4,000 points, read back from the relay, brought
back into the record by erasing, a big Duplicate a new file. The *developer mode* steps also step Older and Newer
on the card and the headset's page, scroll them (Up, More, the stick), and run the release script's `whatsnew/` writing
and `--check` on a copy.

### smoke: studio examples

Its *studio examples* steps (`--only 'studio examples'`, about four minutes): the test example
(`tools/studio/test/examples/tiny`, `&examples=` pointing there) listed on the Scene pane, Copy greyed with no relay;
Open opening it from the examples' folder, read only, its three items and their models in; the headset's Scene pane
with Open and Copy drawn but Copy greyed (no region to press), Back to your scenes pressed there, back at the test scene.
Then, each on a relay of its own (from port 8960, `--static . --scenes` on a temporary copy of the test scene; the
example's files given to its page by the test, its service worker blocked): Copy to the relay: the scene `tiny` on the
relay's disk with `models/box.glb` and `sounds/tone.wav` as in the example and its `layout.json` (its cube for everyone),
the copy opened from the relay with editing on (3 of 3, its words); a second copy `tiny 2`. At a pretend circle (
`HOST.collab.live` giving the studio's station, `HOST.collab.stationLock` its lock; what the circle gets is
`HOST.cur.collab.state()`): an example open off the circle, then the circle with the relay answering in 0.6 s, longer than
a frame: the state polled at once (before a frame) no scene and no items, back to the relay asked for once, the relay's
only scene opened by itself there; the example open again and the room's state (`{ scene: 'test' }`) applied in the same
task: `test` opened from the relay with its items, nothing on the relay's disk but `test`. With no copy on the relay: the
example's button and Copy offered on the page and pressable in a headset, the pane's line about the first press; pressed:
copied as `tiny` (its files on the disk as in the example) and opened from the relay with editing off, the note *... and
opened it for everyone at this circle.*, the circle's state `tiny` with its three items, the button then *✓ tiny* and
greyed; another scene picked and the button pressed again on the page, then in a headset: the relay's copy (*Opened tiny
for everyone at this circle.*), no second copy on the disk; Copy on the page and in a headset: `tiny 2` and `tiny 3`
opened for everyone at the circle; the circle's story locked: both greyed (drawn in a headset with nothing to press), the
amber line, pressing them doing nothing, offered again once unlocked. A copy not whole on the relay: the relay's
upload of `sounds/tone.wav` refused once (a route of the test's): the copy at the circle not opened, the scene there still
`test`, the note *... but 1 file could not be copied: sounds/tone.wav (...). Not opened here: press tiny again to copy the
rest.*, `relay` empty and `parts` `{ tiny: 'broken' }`, its box and layout on the disk and no tone, the button offered with
the line about a copy that broke off; pressed again: only the tone uploaded (the box's and the layout's times unchanged, no
`.history`), opened for everyone (*Finished copying tiny to the relay and opened it for everyone at this circle.*), the
note gone once another scene is picked; a scene `tiny` written on the disk by hand, its box, then its tone (its listing
changing): `busy`, the button *Being copied...* and greyed (drawn in a headset with nothing to press), the line, a press
doing nothing; quiet for `EX.quiet` (shortened to 1.5 s): `broken`, offered; its `layout.json` written: whole once the
relay's layout event has the scenes listed again; a scene `tiny` with only its box hidden from the page's listing and the
button pressed (the relay answers 409): finished with it (the box's time unchanged, the tone and layout added) and opened;
off the circle, Copy with that listing: the next free name, `tiny 2`. A relay with `--scenes-readonly`: both greyed with *this relay
takes no uploads* in the amber line (`why`), nothing pressable in a headset; a copy of the example put on the relay's disk
(told by its watch): the button offered and opening it from the relay for everyone there.

### smoke: studio trackers

Its *studio trackers* steps (`--only 'studio trackers'`, about a minute) run on a page of their own at `&scene=test`,
a pretend studio station (`HOST.collab.live`) and its trackers given in the page (`HOST.collab.trackers` stubbed, so each
frame's poses are exact; the shell's stream is the shell lane's), with a shape, a sound following it and an empty put in
for them: the card's *Follows a tracker* (its list by name, else serial; pressed on the headset's card too); a tracker
chosen (one Undo step) leaving the shape where it stands (within 2 mm), then the tracker moved and turned and the shape on
it within 5 mm, its pose on it kept; the sound following it moving with it; a tracker gone from the list held, one not
`ok` at the pose the shell keeps; carried and paused at its placed pose; *Snap onto it* (right on it, one Undo step, Undo);
another station (none seen there) at its placed pose; *None* leaving it where the tracker had it (one Undo step, Undo);
locked, no new tracker; the empty's tracker chosen on the headset's card and an object's; `norm`'s rules (defaults, rounding,
bad ids, offsets and turns, a cube's and a sound's dropped), the state both ways (a bad `trk` from the room ignored) and
`layout.json` both ways; a copy and a group's copies on no tracker; a GLB switch's turn (the model where it was on its
tracker, within 1e-3); where the shell has its test hook `HOST.collab.trkIn`, a tracker fed through it as the relay sends
`@trk` and a shape following it within 5 mm (skipped, and said, where it has none); and the rig scene's dancer refused in
words (*Not a Mixamo rig...*, *Wear it* greyed), a box with no bones offering nothing.

### smoke: studio puppet

Its *studio puppet* steps (`--only 'studio puppet'`, under two minutes) run on two pages at `&scene=puppet`, the puppet
test scene's rig loaded a second time in the page by three.js's own GLTFLoader as the performer (its Walk the truth),
trackers worn on its bones with seeded random offsets (as `tools/studio/test-ik.mjs` has them; the mean of their offsets
along the floor made zero by the hips' or the headset's, so lining up puts the character right where the performer
stands), given as the shell's trackers (the Index's kinds too) or as `HOST.collab.body`, frames run at held times: *Wear
it* (whole body), the countdown on the card (Line up and Cancel pressed on the headset's card), then lined up from a
T-pose (the six parts found, the character moved to the performer within 3 mm and sized, one Undo step; Undo, again);
3.3 s of the walk with its hands and feet within 5 mm of the truth (0.06 mm), its clip off; Pause holding it; *Off* (on the
headset's card) giving its clip back, *On* again; a sound on its head bone following it; `norm`'s rules, the state and
`layout.json` both ways, a copy worn by nobody, locked not lined up; a second page with the first's record solving the same
23 bones at one held moment (within 1 degree and 1 mm: 0.0000 of both); a 3 s take (its countdown, 91 keys, *Stop*)
made into a GLB, downloaded (no relay), whose clips are *Walk* and *Take 1* (3 s, a track a bone and the hips' place),
*Take 1* at 1.5 s within 0.1 degrees of the bones solved then; and *feet and headset* with the PC's Index (lined up: the
feet and the Index's headset and controllers), then with a performer's own headset (`HOST.collab.body`): the feet within
5 mm and the hands within 1 cm (0.05 and 0.06 mm); a part given another tracker (swapping), not lined up until it is again.

### smoke: studio sequences

Its *studio sequences* steps (`--only 'studio sequences'`, about two minutes) run on a page of their own at `&scene=test` with the studio's clocks held by the test (`behNow = trgClock`): the record's rules (`norm`, bad events counted, 50 and 200 and 2,000 limits, Delete and Duplicate keeping events in step), every event kind firing at its moment (clips, sounds, paths and motions through the cubes' runs, `show` and `hide` with a fade or `cut`, `tex`, `seq`), the cube rule (the later source deciding, a sequence's and a cube's), Play, Stop and Rewind, a loop and `start: 'open'`, a late joiner working the same result out from `qr.<id>` and the clock, `sync: 'own'` never sent, the card, the preview and the lane view (drag, marquee, Alt copy), the headset's card and bar, and a second page drawing the same moment from the shared state alone.

### smoke: studio press

Its *studio press* steps (`--only 'studio press'`, a few minutes): the record's rules, a press firing for everyone from `pr.<id>` (a late joiner too, an odd press starting a loop and the next stopping it), `who: 'own'`, hover starting on pointing and ending 0.3 s after, show and hide as sources, a `seq` entry started on the presser's device only, pressable only with editing off (a visitor and a locked story still press), the page's click and the headset's trigger, the 250 ms limit, Delete and Duplicate, the card and *Try press*.

### smoke: studio live

`--only 'studio live'` (v162, a minute; `tools/output/SPEC.md` "v162" 3b and 5), on a page of its own at
`&scene=rig&edit` with no relay: 50 Opus frames of a 440 Hz tone encoded in the test (`AudioEncoder`; skipped, said, in
a browser without it) fed to `HOST.collab.liveFx` and `liveIn` with one left out and one of another `sid`: decoded and
played through the shell's context (`liveSound()`: `playing`, a level, `lost` 1, a lag about the 0.25 s buffer), then
dropped on `on: false`; then with the shell's node stubbed (a `GainNode` made by the test, `liveClaim`/`liveRelease`
counted): `norm` of a live record, Add's live sound, the claim and its panner at the item, the panner following a move,
no handover for 0.3 m and one for more, the card's *Only the nearest*, the records through `state()`, `apply()` and
`layout.json` with `file: '@live'`, Source off and on (a file picked, the last file kept), released when the items go;
the real shell claimed by a live item and released when another story comes; no request for `@live`.

### smoke: talk

`--only talk` (v178, a minute or two; `docs/agents/shared-rooms.md` "Talk"): four steps, each in a browser context of its
own whose pages count `getUserMedia` calls (refused there: no microphone in a test) and `AudioContext`s made. (1) On
`#airports`: every talk function of `HOST.collab` there, Talk off by default, `talkOn` not stored, the microphone never
asked, `talkLacks()` an array (logged), and `talkLine` word for word for a base state and twenty changes (every phrase
of the line). (2) `#airports&s=TLK&peer=off` (a room on this device): the Shared dialog's `.sh-talk` row greyed with
*Not available: rooms on a relay only.*; `setTalk(true)` turning Talk on (stored, Sound on, no microphone asked), the Mic
still greyed, a click turning it off. (3) A page in no room, Sound on and a tap, `talkTest(true)`: three talkers from a
list (`talkFx`), 50 frames each of a tone encoded in the test fed through `talkIn` (one left out, two spurts): decoded and
played through the shell's context (`rec`, `frames`, `lost`, `playing`, a level, the jitter target, `gain`, a lag, none
panned), the Sound button fading every gain to 0, a talker gone from the list, a stray frame counted, no new
`AudioContext`. (4) A pretend headset (`FPS_FAKE`) in a room on this device: a talker elsewhere with a head 2 m in front
heard through the panner at that head (within 0.05 m), one here not heard (its frames stray), one with no head flat; the
head moved 20 m away: the voice 6 m from the ear; flat again within 0.5 s of the session's end. The page is shrunk to
480 x 300 after the tap (the globe in software holds the page's timers up).

### smoke: studio sends

Its *studio streams*, *studio loops* and *studio trails* steps (v158, `--only 'studio streams'`, `'studio loops'`,
`'studio trails'`, a minute or two each; `tools/studio/SPEC.md` "Streams on a card", "Loops on the beat", "Trails"):
stream entries checked and round-tripped through the state and `layout.json`, the cards on page and headset, `out.value`
and cubes' poses, the scene's 64; a path and a sequence locked to the beat drawn and fired at known beat positions with
`loopClock`, the count-in starting at the downbeat and stopping after N bars, recorded events quantised to the grid, a
tempo whose beat is not a whole ms, a selection during a recording cancelling it; trails validated, pixels of a lit
ribbon behind a moving shape and none with it off, the jump and hidden breaks, the vertex cap, a pretend person's hand
trails at this circle only. `node tools/output/test-page.mjs` gains (v158) MIDI clock in with Start, Song Position and
the bar, OSC `/studio/bar`, the Tempo part, clock out (24 a beat within 2 ms of their timestamps, Start at a downbeat,
a restart, a tempo change, Stop) and the scene's streams (velocity, 14-bit pairs, threshold notes, velocity from speed).

Its *studio sends* steps (`--only 'studio sends'`, a couple of minutes; v157, `tools/studio/SPEC.md` "Sends to the output page (MIDI and OSC)") run on a page of their own at `&scene=test&edit` with the studio's clocks held by the test: the send entries' rules (a cube's, a press's, a sequence's: a wrong `on`, note and cc both, a note of 128, a hold on leaving, a bad address and a duplicate dropped; `t` only for `at`; channel 1 never written; at most 8; a press with only sends kept; a motion's `beat`), the state and `layout.json` carrying them and a layout's bad entries counted on the Scene pane; the cards on both twins (a cube's *Sends to the output page* On and Off, *Add a send...* with the page-only fields, Try sending the effect with `try`, ✕, an object's Sends, a sequence's *At ... s*, a motion's *On the beat*, each one Undo step, `STUDIO.sendSet` and Undo); a listener on `STUDIO.out` getting a press stamp's `press` with its `by` as a member id, a sequence's `start`, an `at` and its `stop`, an everyone cube entered by a pretend head (`enter` with that head's id, `leave` 0.3 s after), the effect `send` with `who` its `by` (a bad one ignored), nothing old replayed; this device's own cube sending `enter` and `leave` (a spy in place of `HOST.collab.effect`; back within 0.3 s nothing), a cube without sends never, pointing sending `hover` and `unhover` (quiet), at most 10 a second (the rest counted); `act()` for each `do` and its refusals, `sw` hiding and showing an object (a 0.4 s fade) and switching a cube off (*Switched off by the output page*), `sw` and `bt` in the state and `apply()`, and a motion on the beat following `bt`'s phase.

### smoke: studio colour

Its *studio colour* steps (`--only 'studio colour'`, a minute): the picker for a tint, a shape's colour and the paint colour on a page (ring and square, hex, swatches, recents `studioColours`, arrow keys, the preview on this device only, one Undo step a drag, Esc taking the preview back) and on the headset's card (a drag as a timeline's bar is, its strip sent alone, one Undo step when let go, a lost controller committing). After changing `tools/studio/xp/`, the `studio xp` steps also check what the Bliss room's presses and sequences do.

### collab.mjs --names (room names)

`node tools/collab.mjs --names` (`namesRound`, also in the main run after the rooms on this network; a relay of its own with `--proxy` and a small proxy per pretend network, as `--near` has, a few minutes): a room named on a page (typed with a control character, cleaned, the key's `by`, the dialog's room row), seen on another page within 5 s, set again from another page with the circles and a story locked, the cleaning (50 characters cut to 40, bidi and newline stripped, blanks clearing it), a pretend headset's menu (the heading and the `room:name` row), the keypad path (`caps`: Shift lit before a first letter and after a space, `kp:ok` writing *Hall b*, an empty OK clearing it), the room listed under its name on this network for a page on the same network and not another, the relay's `title`, the kept copy and the rejoin notice (*Back in Lab Two (room XYZ)*), the offer (*Start Lab Two again*), peer to peer (a slot's answer with the title), a room on this device kept across a reload, no name in any log, and a networks-46 socket refused. `relay/test.mjs` has the step *a room's name* (stored, `title` in `/api/near` and `/api/rooms` cleaned and cut to 40 code points, none for an empty or malformed value, none in the relay's output) and its `--public` step has the unnamed row's keys unchanged and a named row's with `title`. With `--shots`: `names-1-dialog.png`, `names-2-near.png`, `names-3-menu.png`, `names-4-keypad.png`.

### smoke: studio xp

Its *studio xp* steps (`--only 'studio xp'`, about two minutes) open the Bliss XP room read only from `examples/`
(`#studio&scenes=examples&scene=bliss-xp&edit`): every model of its listing placed once more and loaded with no console
error, each under 30,000 triangles and the room under 250,000 as placed, every picture at most 1,024 px, the clips its
layout names there; every sound decoded (mono, 22,050 Hz); its layout read with no bad items, every record as the
studio's own `norm` gives it back, v137's fields used, the Scene pane's Examples (the default folder) listing it, and the
generator's own rules on it (`checkLayout`: every id a cube, a sound, a group or a behaviour names in the room, nothing a
cube starts on something an overlapping cube hides, no sound a cube starts once on something a cube shows); and on
pretend walls of a 3 x 3.5 m room (`STUDIO.walls`, an AR session pretended, `STUDIO.sess('ar')`) every wall item and
what rides on it inside the room, the anchors against a wall, failing when they have not settled within 48 s. After changing `tools/studio/xp/`, run
`node tools/studio/xp/make.mjs` and its `--check`.

### smoke: bodies

`--only bodies` (v164): people's bodies (`bodies.js`, "People's bodies" in `docs/agents/shared-rooms.md`) with a
pretend Quest (`FPS_FAKE`, the frame rate block's: three.js r128's own WebXR path, two controllers, its floor 1.6 m under
the head) in a room on this device (`#airports&s=BDY&peer=off`), others fed through `HOST.collab.presIn` as if heard,
in real time (the shell's frames are timed by the clock). Four steps:
- A person walking 2.75 m along an arc with grips, then standing: `bodies.js` and `ik.js` loaded on demand (not before
  anyone shows; Bodies on and My body off and unset by default), one body instance and no head, one draw a frame (an
  eye) for the bodies and one for their glows; while walking, six steps at least, 80 % by turns, never both feet off the
  floor, the planted ankles 5 to 12 cm over the floor; standing, both feet planted and no steps from a second on. Four
  people (one with no grips: their hands hanging): four instances, still one draw and one. Prints the walk's steps and
  what a body costs (ms a person a frame to pose and write; SwiftShader's machine).
- Bodies off (the Debug tab's *Bodies* row, pressed through `HOST.collab.menuFind`): no bodies, four heads, kept as
  `collabBodies` off; on again, four bodies. A jump of 3 m: both feet planted under the new place within a frame of it
  showing, not walked there.
- My body: off by default; its Settings row turns it on (kept as `xrBody`): one more instance, the only one with the self
  flag, its neck folded away, its feet planted on the floor under you, its hands on your controllers; off again, gone.
- AR (the session made AR as it runs: a pretend headset has no spots to line up by): a person in the room with you (a
  member `here`) gets neither a body nor a head, one elsewhere a body; My body draws none.
- A story's set (v173, on a page of its own): `HOST.needBodies()` resolves true; `HOST.bodies.set(2)` draws two figures
  (one with `hide: 2`, a part dark, `power: 0.4`, a flash) into a picture of its own, a third refused (the cap); the
  people's set's stats untouched meanwhile; a figure with no look gives the same pixels (within 2 a channel) drawn by the
  people's set, by a story's set, and by the people's set again after a story's set was made, drawn and disposed; hiding
  the emblem changes the picture, hiding every part (511) leaves it empty.

### smoke: sharp text

Sharp text (v174, on by default since v175; `--only 'sharp text'`, a page of its own): the story's two panels and the
headset menu (v177) as WebXR quad layers, on the pretend Quest (`FPS_FAKE`) with `SHARP_FAKE` (a `renderState` as the spec has it: `baseLayer` null once
`layers` is set, both at once refused; `XRRigidTransform`; an `XRWebGLBinding` whose quad layers are real GL textures,
`getSubImage` throwing until a layer is in the session's list, `__sh.refuse` making `createQuadLayer` throw). The page has Quest Browser's user agent (the
default *layer* is Quest Browser's only, v176: `sharpDefault` says *off* for a desktop and a Pico; v174's `xrSharp` key
ignored). `#sharp=off` asks for nothing and leaves three.js's `baseLayer`; *layer* asks for `layers`
and the first `updateRenderState` goes in as four layers (main, foot, the menu, then three.js's; RGBA8, mono, 1024 x
1200, 1024 x 176 and 720 x 1920) with `renderState.baseLayer` still answering; the layers sit at the panels with half extents and hold their
canvases (read back: flipped, premultiplied), the panels' materials erase the eye buffer (a hole counted in the left
eye), a still second writes at most 10 times a layer; the menu opened (v177): its layer shown, after the panels' in the list (main, foot, menu, then three.js's), its top
edge at the menu's
(by `localToWorld`), as wide as it, as tall as the whole canvas, holding the canvas, its material a hole, and out of
sight once closed; live *for text* (`text-optimized`) and *off* (out of sight, the
panels as ever), *in front* waiting for the next session (`next`), the Settings tab's row pressed through; a story swap (out
of sight while the next builds, then its panels); a session started *in front* (three.js's layer first, then the panels' two, no menu layer, no hole, *layer*
then waiting); a notebook picture's pause (`sharpPause`: no hole within a few frames, the layers back after), writes
failing (`__sh.failSub`: the panel back at once, the reason after 90, tried again once they work) and a new base layer
dropping the layers; the VR ladder dropping `layers` first after a session that went down with its page (`xrSteps`
seeded), and the Settings tab's row asking for them again; AR (with depth sensing); a binding that refuses quad layers falls back to three.js's own layer with the
reason. Steps wait on frames, not time: in this suite's software drawing a layer's write takes a few hundred ms. Only this block's page (and any page given Quest Browser's user agent, as the 'phone ar' block's Quest
is) asks for `layers`: every other pretend headset has Sharp text off by default, as a desktop browser does.

### smoke: auto quality (and other steps changed by automatic quality)

The automatic quality steps (`--only 'auto quality'`, a page of their own, run on a quiet machine): on by default, a
Quest 3S told from a Quest 3 (rate step first or last), `#aq=off` kept; late frames stepping foveation to 0.75 and 1 and, with
no `requestViewportScale`, stopping at L2 and then 72 Hz as the last step, nothing at 90 Hz on time; with the API (stubbed: it
records 0.9, 0.8, 0.7) the view shrinking past L2, the viewport logged once and frames on time bringing it all back in order;
CPU-bound windows (act `cpu`) never stepping; the rate-first order on a 3S; the debug rows and `frameTimes()`. Other steps that
changed in v145: `frame rate` (Foveation and Resolution default to auto, a whole menu redraw is a patch so count `S.draws`, not
`tex.version`), `away idle` (the cards branch of `xrIdle`), `occlusion` (`frame times` lines skipped by the log counter).

## `tools/perf.mjs` (measuring, not a test)

`node tools/perf.mjs` (a measuring tool, exits 0 always, not a test): serves the folder itself (and a heavy synthetic
studio scene made in a temporary folder, only without a url), drives each scene's frames in smoke.mjs's pretend Quest
(`FPS_FAKE`, set to 90 Hz) or pretend AR headset (`OCCL_FAKE`), both read out of `tools/smoke.mjs`'s text, so renaming or
reshaping them breaks the tool. Per frame it records script ms (less render submit ms), draw calls, triangles, WebGL calls
(texture and buffer bytes, links, mipmaps, readPixels), the see-through layers as a fill-rate proxy, scene objects with
`matrixAutoUpdate` on, heap allocated and `renderer.info.memory`. **GPU time cannot be measured here** (software drawing), so
a result is script and counts, never milliseconds on a Quest. Ids like `room:lobby`, `story:qubits`, `pass:75%`; run groups of
scenes (a full run of about 90 exceeds a background limit). A baseline from before v145 and the after run are compared by
`--from`; known worse after v145: the design room (the miniatures built inside the window), the robots' 0.4 s floor-map
send, and a few stories' script means within noise.

## `tools/audio.mjs` (narration and sound effects)

After touching sound, also run `node tools/audio.mjs http://127.0.0.1:8123/`.
Headless Chromium plays sound without a tap, so the test imitates the strict
rule (an `AudioContext` starts locked and only a real tap unlocks it; an
`<audio>` element plays only once started inside a tap; its pages start as a
device that turned the sound on, `narrationMuted3` `'0'`, whose headset turned its narration on, `xrNarration` `'on'`,
with the headsets' welcome off) and checks a headset session's own sound (on a fresh device a pretend session
unmuted with effects playing and its narration off, the story panel's button saying *Narration off*; that button turning
the narration on, playing, remembered across a reload and a new session; the page's own mute, *Sound off*, unchanged
after the session; the menu's Sound row the session's mute, `xrMuted`, its Narration row the session's, `xrNarration`,
and a controller's press on the story panel's button turning the narration off and on), the sound
off by default (a fresh device, also one with the sound on under the old key,
showing *Sound off*, a tap playing the story silently, no narration and no
effects, until Sound is pressed; a page without a recording (the design room) having the button
too; the choice kept across a reload, on and off; `#sound=on` and `#sound=off`),
that the narration plays after a click, after a story change with no tap (as in the
headset's Stories menu), through pause, jumps, the Sound button, the Stories
screen and a headset session going hidden and visible; that old saved mutes are
ignored, Play sound never mutes and the hum runs; Sound check's beeps and engine
choice; and that the `<audio>` element takes over when Web Audio cannot decode,
never starts, or its clock stops. For the sound effects (`HOST.sfx`): on by
default (a device that saved them off keeps them off); the bar's Sound button
silencing them with the narration, and bringing them back; turned off and on in
Sound check (with its volume kept, Try them) or by `#sfx=off` and `#sfx=on`;
nothing before a tap; a sound really going through the narration's one context
(the output's level); a page button's click; a background only for the flock and
the pass story (the library's, and the flock's heard, gone with the sound off and
on the Stories screen; none for the airports), and `vacuum` the only continuous
sound; ducked 9 dB under the narration and back; at most 16 voices; none with the
`<audio>` element engine or when Web Audio never starts; the two switches (the
Narration switch silencing the narration only, the story's clock running on, the
effects playing and nothing ducked; the Sound effects switch the effects only;
both from the Shared dialog's Sound row outside a room, kept across a reload and
shown so in Sound check, whose buttons turn them on again; `#voice=off`,
`#voice=on` and `#sfx=off` in a link); the headset menu's rows (Sound, Sound effects,
Narration, the effects' volume steps), and in a pretend headset the listener at the
head, a sound from a place through an HRTF panner, and a press on a story panel's
button clicking at it. The stories' sounds: a cue at its time (the log, the
engine, the output), none while paused or over a jump, the next one as the clock
passes it, the first again after Replay; a continuous sound while the clock is in
its span, gone after a pause and a jump out; an explore pick; the busiest moment
of the airports, the tour, the soil story and the robots within the voice limit
(nothing cut, at most 4 continuous). Whether sound really comes out of a headset
can only be confirmed on the device (use Sound check there), and how the effects
sound only by ear (the sound board, `tools/sfx.html`, and
`node tools/sfx-render.mjs` for files, `--story <key>` for a story's whole
track).

## `tools/sfx-cues.mjs` and `tools/sfx-render.mjs`

After changing a story's sound cues, run `node tools/sfx-cues.mjs
http://127.0.0.1:8123/ <key>` (seconds; `all` for every story and the design
room; the app's own stories on either set of cards, the Experiments set's too since v189): every name a sound the shell knows, every place finite, every time within
the story, 6 to 60 cues (the tour up to 80, the tutorial up to 70; the flock, the robots and the design
room at least 1), at most 4 onsets in 3 s outside a marked sequence, no two of
one sound closer than its gap, at most 6 cue voices and 2 continuous sounds at
once; then render the story's track for the owner (`node tools/sfx-render.mjs
http://127.0.0.1:8123/ <out> --story <key>`) and report how it sounds as unheard.

## `tools/live.mjs` (hot reload and live updates)

After touching `HOST.live`, `HOST.swap`, `HOST.load`, `tools/release.mjs` or the
relay's `--watch`, run `node tools/live.mjs` (a few minutes; it changes a story wherever it is, `tools/stories.mjs`: a package's
`main.js` and then its index again; once every story is a package its live story and its card change are packages
too; it copies the app to
a temporary folder and changes it there as a release or an editor would): a story
added live (its card without a reload), a changed story not on show fetched fresh,
the story on show swapped in place (explore state and view; at a slideshow stop
its mode, chapter, time and slideshow; a playing chapter only at its end), another
shell asked about first (the page's bar and the headset's panel, pointed at through
the shell's hooks) and the place restored after Reload now, `version.json` through
the service worker uncached; with the relay's `--watch --build`: a story file
touched swapping within about 2 s, a set's source touched building and swapping
its story, the list read again, a swap at a station writing nothing to the room, a
station of a story this device does not know, in a shared room a new `FORMAT` asked about with the bar's third
button *Reload every device* (its first press arming it), the countdown, *Not now* holding it off and then the page
taking it by itself, back in the room with its place, and a shell file reloading the page with its place.

## `tools/update.mjs` (service worker updates)

After changing `sw.js` or how files are loaded, run the update test with an
earlier version checked out next to this one:
`git worktree add /tmp/old <earlier commit> && node tools/update.mjs /tmp/old .`
It installs the old version, serves this one like GitHub Pages (ten-minute
browser caching, ETags) and checks that the page and its stories are both new
on the first visit after the update, on the next visit and offline. It finds the airports story's file through
`tools/stories.mjs` (`stories/airports.js` in an older tree, `packages/airports/main.js` since v187), asks the browser for
the new worker and waits until it is installed before going offline (it takes every package's `main.js`, about 13 MB),
checks byte ranges of a package narration from the packages' cache offline (asked with `no-store`: the browser's own
cache answers a range it cannot satisfy with the whole file), and says what the page shows when no story runs.

## `relay/test.mjs` and `tools/collab.mjs` (shared rooms)

### relay/test.mjs

After touching `shared.js`, the relay or a story's shared-room hooks, run
`node relay/test.mjs` (the protocol: rooms, writes and their order, the epoch
rule, `fx`, timeouts, bad frames, static serving, `--logs`, the introduction
server at `/peerjs`, rooms on this network: `/api/near` by the asker's network, a private address by its /24, IPv6 by its
/64, `--proxy` and `X-Forwarded-For` ignored without it, `--proxy 2` taking the second address from the right (the first
when there is only one) and `--proxy` alone the last, an empty room still listed on its members' networks, `near`
off, and no address in any answer or log line, nor a network's id in the log; `--public` and each of its rules: origins
allowed and refused, no room list or names, unknown codes, sockets and new rooms capped per address (4429), the log
token, `--store`, and nothing of it without `--public`; the relay's password: off by default with `/api/health` open,
`COLLAB_TOKEN`, `--token` and in `RELAY_ARGS`, `COLLAB_PORT` and `COLLAB_HOST`, 401 for ping, near, rooms, a room, a new
room, log, watch, `/peerjs` and its ids without it or with a wrong one, `Authorization: Bearer` and `?token=` working, a
preflight allowing `Authorization`, the app's files open, the socket's `error` and close 4401 before anything of a room,
`/peerjs` with PeerJS's default key refused and with the password as key open, `/api/watch` with `?token=`, the
Dockerfile's health check (`/api/health`), 20 wrong ones from an address then 429, 4429 and PeerJS's `ERROR`, none at all
not counted, nor PeerJS's default key, nor unknown room codes asked with the password, and the password in no log line or file;
the studio's scenes (`--scenes`, seven steps, about 15 s more: `/api/ping` saying so and none without it, the list and
one scene by the listing rules, `tools/studio/scan.mjs` writing `index.json` and `files.json` as the API answers and
nothing when run again, files with their types, `ETag` and 304, `no-cache`, byte ranges and CORS, `..`, dot files,
backslashes, NUL and links out refused, a saved layout written whole with the old one in `.history/` (20 kept) and a
bad, too big or unknown one refused, the watch's `hello`, a file added, changed and removed once settled, a saved
layout and a new scene, nothing for `.history/` or temporary files, the password on every scene endpoint and file
(Bearer or `?token=`, wrong ones counted, never in a log line) and `--public` refusing to start without one,
`COLLAB_SCENES`, `RELAY_ARGS` and the options refused at the start) and its uploads (five steps: `GET /api/scenes`
saying `upload`, `ffmpeg` and `maxUpload`, a scene made by `POST /api/scenes` (the name rule, 409, `--scenes-readonly`)
and told at once, a file written whole where it goes with its folders, 409 unless `replace=1`, the paths and kinds
taken and refused, the size counted as it streams and nothing left behind; the sound endpoint with a stand-in `ffmpeg`
(one generated script under the names ok, fail, empty, hang and broken: its failures, its time limit, two at once, none
at all) and, when the machine has one, a real `ffmpeg` making a generated stereo 48 kHz WAV a mono 96 kbit/s 44.1 kHz
MP3 (its frames read), else skipped with a note; `/upload`'s redirects, to the relay's own app or `--app` with its
`wss://` address, no password asked and the query never passed on), duplicates (v167, `POST /api/scenes { name, from }`: every listed file and the saved layout with its lock, no
`.history/`, 409, 404, 400 and 403 read only), copies from another scene (`POST .../copy`: the
same bytes at the same path or `as`, told at once, 409 then `replace`, an upload's kinds by where it goes, sources no
listing shows, bad bodies and the file onto itself 400, missing scenes and files 404, a link out 404, over
`--max-upload` 413, `--scenes-readonly` 403, the password), the models' pictures (`previews:`: `previews/<path>.jpg`
taken, listed and told with the kind `preview`, served as a JPEG, any other kind or name there, too deep and `Previews/` in another case 400, exactly
200 KB taken and past it 413 by its length and as it streams, nothing left behind, copies by the same rule), recordings kept
as files (`recordings:`: `recordings/<name>.json` taken, listed and told with the kind `recording`, served as
`application/json`, a sound there by its own kind, a `.json` anywhere else, `.JSON`, too deep or a temporary name 400,
`uploadPath`'s 4 MB, past `--max-upload` 413 by its length and as it streams, copies by the same rule; and with R2 through
the relay and straight into the bucket, stored and signed as `application/json`), and the scenes in R2 (thirteen steps against the stand-in
S3 `relay/s3fake.mjs`, which checks every signature: `relay/test-r2.mjs` first (the signer against AWS's published
Signature Version 4 examples, byte for byte, and the client), then the folder's steps again with `--scenes r2` (the
start and its CORS check, the listing with a signed link per file, the redirect, saving with `.history/`, the watch from
the relay's writes and from changes made straight in the bucket, uploads through the relay), direct uploads (`.../put`,
a body of another size or type refused, `.../done`), copies by the bucket's CopyObject (its `x-amz-copy-source` signed in
the header, which `relay/test-r2.mjs` and the stand-in check: one unsigned refused), the models' pictures (through the
relay and straight into the bucket, `.../put` refusing one over 200 KB, `done` leaving one over it that no link of the
relay's brought, a copy by the same rule, all told as `preview`), `ffmpeg` with `from=`, the password everywhere and in no link, the
start refusing missing settings (named, never a value), a wrong key or bucket and an address that is no one's,
`--r2-check`, the start's upload-link check against the stand-in told (`quirks`) to refuse a signed length, both, or to
ignore `If-None-Match`, `.../done` removing past `--max-upload` only what its own link brought, a save the bucket
refuses costing no history, three uploads through the relay at once, a 5xx or nothing at the bucket's address at the
start (listening anyway, found later), and `tools/studio/r2sync.mjs` with its conflicts and `.history/` copies), and the
PC's Vive trackers (`--trackers` with the fake bridge `tools/trackers/fake.mjs`; `node relay/test.mjs --trackers`
runs only these, in seconds: nothing of it without `--trackers`; the UDP intake, `/api/ping`, `GET /api/trackers` raw
within 0.1 mm; `/api/trackers/still` (still, moved, not seen, nudged, lost; bad asks); the frame from an area's
crosses (`m.k`, `ra`, `rb`) against the room's truth and `shared.js`'s own `fitFrame` (200 random rooms and areas, within
1e-6 m); the room's frame from `m` against
`shared.js`'s own `fromMarks`, `floorUnder` and `basis` run with three.js; a room lined up by hand getting `@trk` about 60
times a second, every pose within 1 mm and 0.05 degrees of the truth; only rooms with `trk.on` and `m`, `l: ''` without;
the bridge silent; bad datagrams counted; the password; `RELAY_ARGS`; a UDP port held; `bridge.py --fake` where
`python3` is), and rooms across updates (`node relay/test.mjs --rooms` runs only these, seconds: `/api/ping`'s
`versions` and `reload`, a room of networks-41 refusing networks-42 while one of its own is connected and taking it once
none is (one that has said no hello not counted), never an older one, versions that are not networks-<n> only the same,
a taken code's 409 naming its version; the reload order: 404, 400, 405, 200 with every member of every version getting
`q.reload` by the relay, 429 within 10 s, the newcomer it names (half a second after the order) moving the room on with
two old members there, who get the order again: one that ignores orders refused 3 s later, one whose hello says
`reload: 1` not within 9 s of its order and refused about 12 s after it; `--keep`: written within 6 s of a change, atomically, and as the relay stops,
read back with its seq, version and keys, another relay's write taken, expired rooms and bad keys left out, a bad file
kept aside as `.bad`, nothing without it; and the order needing the password); no browser, seconds; `node tools/peer.mjs` links two pages of
the test page `p2p/` through it) and

`node relay/test.mjs --osc` (also in the full run; `relay/osc.mjs`, `tools/output/SPEC.md` Wire 3): the OSC codec (round
trips of every type, padding at every length mod 4, a bundle in a bundle and the depth limit, bad packets refused, int64
and float64 normalised, `checkMsg`, the flags' words); a relay without the flags doing nothing of OSC; with `--osc-out`
to a UDP listener here and `--osc-in 0`: the start line, `/api/ping`'s `osc` with no target's address, `out: 1` in the
members list; an output page's `osc` reaching the listener byte for byte, bad messages dropped and counted; a member
without `out`, empty, 129-message and non-list frames, and a member's own `@osc` refused; `osc-cfg` answered with its
status, the status every 2 s, no contents in the log; the rate cap (3,000 in a burst: 2,000 sent, 1,000 dropped and a
count in the log); a datagram on the in port reaching the `out` pages of two rooms only (bundles flattened and
normalised, bad packets nowhere); `--public` without a password refused for either flag, with one starting, `RELAY_ARGS`,
bad words, nine targets and a held port refused; with `--trackers 0` and `tools/trackers/fake.mjs` (SteamVR space turned
37 degrees and moved): `/room/tracker/<serial>` at about 90 a second each, the still trackers within 1 mm and 0.05
degrees of `@trk`, the circling one within 1 mm of the truth, kinds and names, and the status through `unaligned`, `on`,
`off`, `on` and `other` as a second room's output page asks. Before that, `node tools/output/test-page.mjs` is the output
page's own test (Web MIDI and `HOST.cur.out` stubbed; a room on this device and a plain relay): `&output` and the
dialog's button, MIDI notes and their held ends, OSC arguments, slots and a CC stream from pretend presence, incoming
MIDI, OSC and MIDI clock calling `act()`, Learn, validation, Export and Import, a reload resuming it, a phone ignoring it.
Its live sound (v162) reads and encodes the input on the page's main thread, which a page drawing in software headlessly
(frames a hundred ms and more apart) starves: the pace (50 frames a second), the kbit/s and the count of frames are then
printed as `note ... cannot be checked here` (v188), never failed; alone the same pipe gives 50 a second headless. The
owner checks those on a real device.

The collab arc round (`--all`, v188) steps the pretend headset until every card of the arch is drawn (the Stories screen
draws two new cards a frame, `XR.landN`) and opens the set of cards (`HOST.menu`) of the card it presses (its
`PICK_STORY`, proteins, is an Experiment); the ask round (`--ask`) gives the pretend headset frames until it is aligned
(30 s at most). The main run places the Experiments set's stories that have rounds (proteins, the flock, the robots)
with Add in a third row after Arrange all, which leaves them out.

`node relay/test.mjs --talk` runs only Talk's steps (v178, also in the main run after live sound's; `relay/README.md`
"Talk (v178)"), eight of them: `/api/ping`'s `talk: true` and `welcome`'s `talk: 1`, no `@talk` on a join into a room
where nobody talks; the refusals (`talk-start` from the output page or a camera once a socket, bad cfgs, a bad
`talk-sub`), a tag-2 frame from a member not talking counted and never closed, a plain member's tag-1 frame still 1003;
two talkers and a listener (the list to every member, frames byte for byte but `sid` to those who hear, none of one's own,
none without `talk-sub`, `st` `subs`, the list after a joiner's welcome); `here` (a listener here does not hear a talker
here, one elsewhere does, and the talker saying it is elsewhere sends a new list); the rate (80 frames in a burst: 55 to
61 through, the rest `dropped`) and sizes (`bad`); full at eight (the ninth refused, then in after one stops); stop,
leave and reconnect (lists without the talker, no frames to a new socket before its `talk-sub`); the log's lines with no
name or cfg.

### collab.mjs main run (per story, then the rounds `codeRound`, `allRound`, `guideRound`, `placesRound`, `areasRound`, `reloadRound`, the design room, settings, follow, pretend headset, peer to peer, rooms on this network)

`node tools/collab.mjs` (about a quarter of an hour; it starts its own relay with
`--static .`, so no server is needed). For every story in its `STORIES` table,
three pages in a room follow its station and check play, pause, jumps, mode
changes and Replay (within 5 s), the relay's clock, the explore state both
ways and the story's effect (for the tutorial a signal from the hub and its pulse on the others; for the robots also the pile's spot and dust, and the
crumbs' patter on the others; for the flock the same falcon, one page leading, the
same flight time and the flocks together, its dive and flutter on the others, two
falcons sent at once from two pages flying on the third, and the birds shared bird by
bird: every page records its birds as drawn in each frame for 10 s (the pages made
small meanwhile, so each draws a few frames a second), and a follower's birds, once it
has followed the leader for 3 s on end, are within 0.5 m of the leader's at the same
moment (the median over its frames; too few such frames are said so, not judged); for
the pass story two pages being the shark, both their sharks swimming on the third in
their owners' colours and swimming off once let go, and the school shared fish by fish
the same way, with the two sharks in it);
on the first story followed, also its sound cues (every page playing the same cues at
the same moment, each every cue its own frames reach, none twice: a cue more than 1.5 s
late is dropped by design, and three pages drawing in software can draw a frame only
every few seconds; a pause on one stopping them on all, a page joining mid-play playing
none it missed, none past a slideshow stop), a slideshow stop on one page pausing the
station for the others at the chapter's end, and its Next playing it again.
Before that: Arrange all's rows, a code with no room, Remove asking first.
After: a station moved and turned on the room map (and refused while the
circles are locked), a room joined by its code from a pretend headset's menu (`codeRound`; `--code` runs only it, a
minute: *Join with a code*, the keypad, Join greyed until three letters, a fourth refused, Delete; in the room *Another
room*, its own code greyed, a code with no room saying so), the room's arc and the All stories and lobby circles (`allRound`, after
the code round in the main run; `--all` runs only it, rooms of its own, several minutes; its devices with `arc: true`, the
others in the run starting with the automatic circles off: a page on a story starting a room making the arc at the room's
origin (its only station, `allp` with `pg`) and showing its Stories screen without Follow, as a page joining does; a
pretend headset (`autoAll: true` in its `installXR`) moving it to where it stands, facing its way (`allp` its own),
and at it without walking in, at its spot: the Stories screen (its cards, no Back), the scene hidden, no ring,
card or icon for it, the rig at its spot, its presence there, nothing written to its keys; a landing card pressed picking
that story for everyone, from its start and playing on the headset and both pages; the story panel's Stories button back
to the cards, the keys gone; the grip on its cards carrying it for everyone (held writes seen on a page, then where it
was let go, swung round, still the arc); the room map moving it and the headset's cards gliding there; the circles lock
refusing the grip, with its notice; Move here putting it at the headset; Add from the headset turning it into a circle
where it stands (`arc` false), the headset still at it with its cards and now its ring (it stands 1.5 m off), the pages
still following; the dialog's Add listing All stories and Back to the lobby after the design room; then as any All stories
circle: the menu's switch row turning sync on, and with a circle of that story in the room the headset joining its
session: explore state and clock both ways with a page following that circle, its presence still the All stories
circle's; the dialog's toggle turning it off, its own keys seeded (the clock, state and the linked circle's moved scene)
and the story going on; on again and the linked circle given another story, the circle going on alone where its story
was (its own clock written); the dialog's picker back to the cards; the lobby added from the page, listed without Follow,
walking in ending the headset's story with every ring, icon and card showing, then a story circle entered as usual, then
the circle that was the arc walked into again (its cards); Arrange all leaving both kinds where they are; an arc again
turned into a circle by Arrange all and by adding the lobby, and left a circle once every other circle is gone; removed,
it not coming back; the headset first in a room of its own making the arc in front of itself, at it at once; a room from
before v109 (`all01` without `arc`, alone, written by a raw socket) the arc once a page joins; with `--shots` its
pictures: `all-1-arc.png`, the arc's cards as the first headset sees them, `all-2-picked.png`, a story picked there,
`all-3-lobby.png`, the All stories circle seen from the lobby, and `all-4-circle.png`, the arc turned into a circle, its
ring under its cards), the room setup guide (`guideRound`, after the All stories
round in the main run; `--guide` runs only it, a room of its own, about six minutes: a page starts the room with a
station far off; the first pretend headset enters AR alone and its startup flow opens by itself at *Line up* as the
room's first with no spots (*Put two tape crosses on the floor*), *Skip for now* closing it and the menu it opened; it becomes the
room's origin, *Room ready*; the second lines up through the shared space and its flow opens at *Line up* (no spots
yet: *Check with someone*), the first's staying shut, both counting 2 of 2 lined up, none checked; the pages: Back
greyed on the first, Next, Back, *Skip for now*, *Room setup* opening it again where it was (with Close), *Check here*
there and in the Debug tab; the laptop's *Setting up a room* listing both, *not checked yet*; Touch the spot with the
tips 3 cm apart, the first waiting, then green on both, the flow done, and *checked 3 cm* in the laptop's list; 40 cm
apart, red on both, *Not lined up?* opened by itself on both, the laptop's list saying so; Re-align taking the red
result away and a check alone timing out (the window shortened to 14 s); the second back with no shared space: its flow
again (every session), skipped, *Not lined up?* by itself once late (shortened), saying why; back again lined up, the
flow again, skipped. Then the spots (tape crosses on the floor: every touch at the true floor plus `FLOOR_TIP`, `TIP`
in the test): the first headset (the room's origin) calibrates on two from *Line up* (case
*first*, the red check's reason above), which writes `rm` (`{ a: FLOOR_TIP, f: 1 }`) and a frame from the spots for the space, and the guide goes on
to *Check* by itself; *Check at A* 3 cm off spot A: green, the flow done, the guide closed; the second, taking that frame
through the shared space, asked by eye (the orange crosses on the two spots within 2 cm, drawn over everything, the
question 0.75 to 1 m in front, on top and the ray's first target, the guide shut; both crosses lit and larger, the
foot of each beam and its letter over its cross within 2 cm, the beam 1.2 m tall, over everything, an arrow to each
under the question, within 0.35 m of it, pointing at its cross within 5 degrees of the line from where the arrow floats,
its words its letter and its distance along the floor from the head, *A 1.3 m*; the head turned round, spot A behind
it: a U-turn to the left and *, behind you*), *Yes* standing as a check (by eye, the flow done, the laptop's list
*checked by eye*; the crosses as they were, no beam, letter or arrow); after a wake (hidden, then visible) asked again (why *wake*), *Yes*;
after a floor reset asked again (why *reset*), *No* opening *Line up* (case *room*, why in red, not lined up: the
laptop's list *not lined up (its crosses off the spots, by eye)*), skipped; entering again the startup flow asks by eye
(flow *eye*, why *start*, the guide shut) instead of opening at *Check*; *No*, *Next*, *Check at A* 3 cm off:
green, the guide and its menu closed, the laptop's list *checked 3 cm at spot A*; 40 cm off: red, back to *Line up*
(case *room*, why); Calibrate there on the spots, on to *Check* by itself, *Check at B* 2 cm off: green (the room's `rm`
still the first's); the laptop's list *lined up (the room's spots, checked ... at spot ...)* for both, 2 checked. Then
floor spots (`floorSpots`): the first headset back in a new session with its own floor 20 cm too high and a room
scan whose floor plane is the true floor, its spots found again by their anchors: the room's floor on the true floor
within 1 cm and *Your floor is 20 cm higher*; calibrating on them again, spot B 5 cm higher refused (*Spots at different
heights*, back to spot A), then both on the floor taken (B 3 cm higher than A): the room's floor on the true floor
within 1 cm, `rm` `{ a: FLOOR_TIP, f: 1 }` its own, and the log's `mark refused` (heights with `dh` 5 cm) and `floor
spots` (touch heights -18 and -15 cm over its floor, `dh` 3 cm, 2 and 5 cm over the scan's floor); back again with its
own floor 90 cm too low (the owner's Quest), calibrating on them again: spot A, 92 cm over its floor, taken, nothing
refused, the room's floor on the true floor within 1 cm, *Your floor is 90 cm lower*, the log's touch height 92 cm; the
second back with its own
floor 15 cm too low, its spots found again (the true floor within 1 cm), then
calibrated on again: its room's origin and direction within 1 cm of the first's, *Your floor is 15 cm lower*, nothing
written to `rm` (no `floor claimed`, `rm` unchanged); Forget, lined up through the shared space (its own floor kept),
*Check at A* with the tip on spot A: *15 cm out at spot A (15 cm in height)*; a calibration from before v122 (no `f`,
two table corners 1.2 m apart, set as its calibration with anchors at the corners, no room's place yet) found again: its own floor (the
room's floor is other spots), *f* absent, nothing written to `rm`; an older device's `rm` for those corners (`a` 0.76,
no `f`): the room stands on it, on the true floor within 1 cm. With
`--shots` its pictures, `guide-*.png`: each page and case of the menu's canvas, waiting, green, red, alone, no shared
space, calibrating, the question by eye (`guide-16-eye-question.png`, its sheet; the scene from the head with the
arrows and a lit cross, `guide-16b-eye-arrows.png`, and turned round, `guide-16c-eye-behind.png`), *No* to it (`guide-17-eye-no.png`),
calibrating with its floor 90 cm too low (`guide-20-floor-far-off.png`), and the laptop's section), places (`placesRound`,
after the guide round in the main run; `--places` runs only it, rooms of their own, eight or nine minutes: two pages each
start a room, X and Y, and a pretend AR headset with saved anchors, a handle taken out of the map standing for an anchor
not in that room: calibrated in X and, joined by hand, in Y, on spots 13 m apart, two places with their anchors and X's
stored in `roomFrames` with the room's own id; standing in Y while in Y, Y here and nothing offered; in Y joined by hand,
standing in X's place, Y not left, X offered (a notice, *Join X* and each place's *Forget* under Debug, no *Anchors per
room* since v131); out of the room (not on purpose), a new session in no room standing in Y with X's handles hidden and the floor
moved: Y joined by itself (its notice) and lined up from its marks within 1 cm and 0.5 degrees; with a place QPA
planted 6 m from where it stands (one anchor, found at once): a new session in Y, Y's own anchors answering after 5 s,
the decision waiting for them (`place wait`) and Y, nearest, holding (nothing joined or offered); woken with Y's
anchors lost (it lined the headset up as it went off), carried to 1.5 m from QPA's spot A: Y holding (`place held`,
`lost`), QPA offered; a new session with Y's anchors not found at all, 6 m from QPA's spot A: Y holding (`gone`, further
than 4 m), QPA offered; walking into X with Y's
anchors gone (their handles, the ones held untracked): X joined by itself from Y, lined up, Y not marked left; X left on
purpose only offered, the offer's button joining it (counted as by its place); a new session's tidy deleting a stranger and keeping every
place's anchors; Forget Y (two presses) keeping X, which still lines the headset up; three more places planted (two
anchors each, used days ago, no `yb`) and Y calibrated anew: the one made first dropped with its anchors (its `yb` not
known, so not taken down to one), *Older places dropped*; the budget : Y's place and three planted after it with
two anchors and `yb`, X calibrated anew (a fifth place, 10 anchors): Y's and the first planted down to anchor A alone, B's
anchors deleted, 8 in all, *Older places on one anchor*; with Anchor on (7) X anew again takes the next one down; Y's
place on one anchor found again in a new session on another floor within 1 cm and 0.5 degrees (*held by one anchor*);
its turn read with a wobble of up to 0.6 degrees at each reading (`installXR`'s `X.jit`): for 5 s the room's
direction within 0.3 degrees and moved at most once; local-floor turned 10 degrees without a reset event: the room's
first move the whole turn, none creeping after, lined up within 1 cm and 0.5 degrees; seven one-anchor places planted
and Y's: eight fitting, then a ninth (X, two anchors) dropping the two used least recently; an older `roomFrame` (v2, no room)
kept as a place with no room and taken by Y, the first room it lines up in), areas (`areasRound`, after the places
round in the main run; `--areas` runs only it, a room of its own, a few minutes: a page starts the room, two pretend AR
headsets with saved anchors; headset 1 calibrates on spots A and B, walks 12 m to a floor 15 cm higher and adds Lab
there, `rp.<id>` with letters C and D and its crosses within 1 cm of the truth, its base spots A and B's, its own place
there with `yb`, and Lab's crosses and sign drawn at once beside spots A and B's (`areaMarks`); headset 2, its floor 3 cm high and turned otherwise, calibrates on C and D only: its room within 1 cm
and 0.5 degrees of the truth and of headset 1's, the room's floor under it, the same room, nothing joined, its crosses
at Lab's points lettered C and D with the sign *Lab: C and D*; C and D touched 50 cm short refused in words; a new
session of headset 1 at Lab, spots A and B's anchors hidden: lined up from its Lab place, no join, the check by eye's
crosses C and D and arrows *C ... m*; walking back to spots A and B: `area switch`, the truth, the check by eye asks why
`area`, its crosses A and B; a v3 place without `yb` read as spots A and B's and learning it, kept as v4; a frame from
Lab's marks through the shared space never compared or split, one from spots A and B's compared; *Forget area* (two
presses on the Debug tab): its tombstone, headset 2's Lab place and anchors gone at its next session; another area,
Hall, C and D again, stale once spots A and B are taped again and its place dropped at the next session; a socket of
networks-40 refused), camera mode on an area's crosses (in the camera round: the overlay's *Spots: C and D (Lab)*, Set
spot C and D, the phone's room still the headset's, no place kept; and Update the room not offered in camera mode), rooms
across updates and Update the room (`reloadRound`, after the areas round in the main run; `--reload` runs only it, a
few minutes, `--cases 2,5` only those of its six: a relay of its own on port 8712, restarted serving another copy of the app as a deploy; three copies made in a
temporary folder by `tools/release.mjs`: this code at its `FORMAT`, this code at `FORMAT` + 1, and v135 (git `7c32b37`) at
`FORMAT`; service workers blocked, every page on a story (the Stories screen takes a waiting update by itself) with
`liveCountdown` off: (1) a deploy bumping the format with two old pages in a room, which make it again under the old one;
a new page joining waits (`older`), one old page reloaded by hand waits too, and once the last has reloaded all three are
in the same room with its stations and explore state, the room on the new format; (2) the switch for the same version:
three pages and a pretend AR headset lined up and at a station, the first press arming it, the headset's notice, every
device reloading once in its turn (ranks 0, 1, 2 and the presser 3; waits 0.4, 0.9, at least 3 s for the headset, 1.9 s),
all back with new ids, the page that followed the station following it again at its paused clock, the headset showing
*Enter AR to continue* and, entered, at its station without walking in; (3) across the format: a new page refused by the
old room offering *Update the room* and pressing it, the endpoint reaching the old pages (this code), everyone back new and
the room moved on; then v135 pages, which ignore the order, refused once the new page is back, and new after a reload by
hand; (4) the relay restarted between press and reloads: the presser bringing the room back first; (5) peer to peer, the
order from a guest, everyone back on the new id, one host, every station; (6) a v135 page in a room with a page of this
code ignoring the order, an order older than 2 minutes ignored, two presses at once giving one order and one reload per
device, and a reload that comes back with a stale `index.html` (`page.route`) reloading twice more and then saying so),
the design room (the Shared dialog's picker listing it after
the stories, its station added there for every page, refused while locked from
Add and the Design room button, left where it is by Arrange all, the button
moving the room's one to your feet rather than adding a second), the headsets' four settings and the two sound switches
as the room's (labels on top, cards in 3D, no subtitles, sound effects and narration on for pages that have them on, in a room without them; set on one
page (the labels from one, the cards from another, each leaving the other), or in another's Shared dialog (both pickers)
with the circles locked, for every page; free moving off taking the turns
out of the stations' places and panels; kept across the relay restart and, in a
room on this device, across a reload), a station's panels set in a page's
Shared dialog with the circles locked (reaching the pages at that station,
another station keeping its own; kept across the relay restart), and its
story's lock there (*Lock story*, also with the circles locked; every page has
it, another station not; kept across the relay restart),
two controls changed at once on two pages (both kept), two stations
followed back to back (the second not lost), a story picked by hand (stops
following), no writes while idle (no ping-pong), a late joiner, a page following a
pretend person in a headset (a socket of its own speaking as a headset's page:
the people list's Follow for them and none for a screen or for you; not at a
station yet, the dialog open and saying so; the station they walk into, then the
next, the line "Following Guide (at <story>)"; out of every circle and their
presence quiet, the last one kept; a station followed by hand, Stop following in
their row and a story picked by hand each stopping it; they leave, it stops after
15 s and the page stays at their last station), a relay restart, and
a pretend headset with fake `local-floor` and `shared` spaces: alignment,
away from every station no story (no Stories screen, the scene and panels
hidden, nothing to point at, paused, no Stories button),
before any circle every station's icon over its ring (its story's miniature, in
its colour, turning) and its card, placement at its station once it walks into
its circle (the story shown; the other stations' icons only, pointable, no card and no
ring further than 2 m off, of its own nothing), a recentre, taken off and on again (it stays in its story),
a Stories screen opened at a station closing at once (restarting nothing),
walking out of the circle into no other (still its station and shown, playing
on the station's clock, the others still icons only, the walk writing nothing;
in step both ways out there: a change on a page following the station taken, a
pause on the headset reaching the room; taken off and on again out there,
still in its story) and back in (nothing happens: no second arrival), the hold
and the lock, a station's panels set on a page reaching the headset at its
circle (controls only: the foot bar alone; the station it is not at keeping its
own) and set from its menu's Panels row for everyone there with the story
locked (hidden), its own station's back again (shown) when it walks there, the
design room in the headset (every station's icon built from its story's
miniature, in its colour, hidden in a circle; the menu's Design room button
greyed while the circles are locked; Add here listing the design room after the
stories; the button putting the props table at its feet facing its way for
every page; standing in it, its station, the design room open there at its
table in explore mode, its icon and card gone; walked out, still at the design
room, its icon still gone and built from the table's miniature),
the station's clock and state, rays and head in room coordinates, another
person at its circle drawn (one at another circle or at none not; all with
People: everyone), the sound zone, the trigger on
another station's card running nothing (its icon pointed at first, bringing
the card up; a notice: walk into its circle), the story panel winning over a
card behind it, a station moved with the grip on its card (its icon pointed at
first; swung, pushed further, turned; the others see it while it moves) and
gliding into place when someone else moves it, the circles lock (the grip and
Arrange all refused; unlocked from the headset's menu), the menu (closed at
first with nothing at the wrist, and a notice saying how to open it;
opened and closed by a click of the left stick or the right (each read 0.5 s after its click: since v125 a single click
acts once 0.4 s have passed with no second one), floating in front of you (0.8 m ahead, a little below
your eyes, turned to you; Close and its four tabs at its top); the grip carrying it, let go staying where it was put
(also with the head turned away) and opening there again next time; its Story tab showing the story's own panels
(their textures), a press there working the story's panel (Replay story, Explore now) and the grip there moving the
menu, not the story's panel; closing by itself unused (not with a
ray resting on it, not while calibrating); staying put as you look about a little and gliding back in front once you
have turned further; with tracked hands two quick pinches of the left hand pointing at nothing opening and closing it
(not one pinch, not two slow ones, not the right hand's, not the left's on the story's panel or the menu); Exit under Settings; buttons
pressed by a fingertip, a poke and a pinch at once pressing once; at its tallest, You still on it; Sound check under
Debug: both beeps, the engine choice, Back), re-alignment, walking to another station
and back, Remove asking first; calibration from two marks (Stop calibrating
still pressable, two anchors made and checked, the marks drawn), a reset with
a transform, a recentre without a reset (the anchors keep the frame), the
anchors found next session, Forget calibration (two presses; also while those
anchors are still being found), a new calibration replacing the old anchors,
the shared space never overriding marks (a newer frame from someone else only
reported, as a distance; not used at all by default), a space found split by two
calibrated headsets (the room told, whole again once they agree; a headset
without marks takes nothing through it), no room scan said and taken back, a fresh shared space (two presses move the
room's pages to `s/1/`, where they join again; a headset there told to start
one headset first; a page opened at the old address moved too; that room has
no stations: entered from the start screen, the headset shows no Stories
screen and no story, only the menu, opened by itself with Arrange all;
leaving the room brings the Stories screen back, joining one closes it), anchors not
found by their handles after waking and found by a later try (meanwhile, since
v124, no message: still lined up, the Debug line says it looks again; a jump with
their handles saved keeps the calibration), the room's floor from
floor spots (the marks touched at the true floor plus `FLOOR_TIP`; `rm` `{ a: FLOOR_TIP, d, f: 1 }` this
headset's own; an older device's `rm` for them, a higher `a` and no `f`, moving nothing here, and this headset writing
the room's floor spots again; the log's `floor spots`), no mark from a double
pull, Forget taking the published frame, the shared space on by default
(off: calibrate), a space that is just this headset's own floor while someone
here published (not joined: nothing taken), a headset back in AR whose space
is its own floor while another here is aligned through that id (its own
earlier frame not taken, also with the space drifting 6 cm), the first headset
in a space staying first with another aligned through it (Re-align, an id
flicking away and back), a frame from someone who has left
(waited for, then replaced by the first headset's own space), the first
headset taking a frame someone here publishes later, standby with the shared space in use
(a wrong space held off, then the room where it was and at the same height
though the floor moved), a reset as Quest Browser
sends it (old to new coordinates, the head's height ignored), a calibration
without anchors asked again after a reset without a transform or a jump, and
kept (moved by the reset) off and on again, off and on again with the anchors
not tracked (the frame follows the reset at once, then the anchors found
again by their handles), unknown saved anchors deleted at session start, a
full anchor store (cleaned and asked again; still full: the marks hold and the
panel says so), the mark taken where the
controller was held still, VR elsewhere with its in-room question (then the menu's
Settings tab: Sound turning the mute off and on, Anchor turning off and greyed while off in
a room, Repeat going off, all, one); in a
room no Stories button (at a station either) and a Stories screen closing by itself, the grip on
the scene and the panel unlocked there (not locked by the circles lock; locked by
its story's lock, set on a page), both grips
resizing the scene and one hand carrying on, the place, size and panel going
out to the room and gliding in from it, Recenter there (the menu's and the story's own: the place and panel keys out
of the room, the scene and panel gliding back where the story puts them; refused while its story is locked, with a
notice and the menu's Recenter greyed; in explore mode the view back where the story put it, not where the room had
turned it, for everyone there), a free grip turning the scene 90 degrees
and tilting the panel (the turns in the room, the other pages holding the same
`q`), Moving in the headset's menu turning free moving off for everyone (the
turns gone, the scene facing you again, the panel upright), Labels going
round there for every page (the cards staying in 3D) and Cards going round
there for every page (the labels staying on top; the other stations' cards, as
if their rings had been pointed at, and the name tag of a person at its circle
on top as before, drawn as the labels' signs in 3D, not drawn when hidden; the
menu on top in every mode); Re-align
(an offset headset back on the room's frame, the shared space asked for again),
and after a night: a headset still outside the space asking for it again, a
follower holding against a space made again and following the room's frame
once written again, this headset's own frame written into a space made again;
a room on this device (no relay known and `&peer=off`: a link opens it, the link's sound switches turned off on the
device staying off there while the room never wrote them (subtitles written leaving them out), Arrange all, a moved
station, the circles lock and the headsets' settings kept across a reload, a headset alone on its floor with
Re-align, a station played there, the room taken to a relay that answers and
joined there by another page; a relay that cannot be reached); then peer to peer
(pages whose `/api` goes nowhere, as on GitHub Pages, introduced by the test
relay's own `/peerjs` through `&peer=`, so nothing goes to the internet): a page
starts a room and hosts it, its link carrying the introduction server; two more
join by the link as guests (the host marked in every list, the Shared dialog saying
*peer to peer · hosted here* or *hosted by*, with Copy link); Arrange all and a
station moved on a guest; presence; play, pause from a guest and a jump at a
station within 5 s; an explore state both ways; the host leaves and the page
longest in the room takes it over, its stations and keys kept and the station's
clock without a jump (the new host's own clock 3 s off); the room goes on; the
old host back as a guest; a host fallen silent with its id held, replaced once
its id is free (after the 6 s); an introduction server that cannot be reached
(the room on this device); a relay that cannot be reached as a room is joined
(peer to peer); a headset (by its user agent) that hosts handing the room to the
first screen that joins. `--p2p` runs only that part (about two minutes). Then rooms on this network (`--near` runs
only that part, about five minutes; its own relay with `--proxy`, and in front of it one small proxy per pretend
network that puts that network's address in `X-Forwarded-For`, as Coolify's does; peer to peer, `#net=home` and
`#net=away` with the relay's `/peerjs`): with a relay, the page's network id the same as its own hash of the address;
two pages on one network see each other's room (the first member's name, people) in the dialog and one press joins,
a page on another network does not (only among the open rooms); a page never in the room is never joined by itself;
*Show on this network* off and on; the headset's menu listing it under *On this network*, one press joining; a page
that was in the room joining it again by itself when the app opens again (the notice, which its close button takes off the page); a day later (the page's clock
moved on, its storage kept) with the relay having forgotten the room, joined again and the room back from its copy;
Leave on purpose, then nothing by itself; more than a week later, nothing; a code the relay gave to another room
meanwhile (another `rid`), never joined, nothing of it kept; a copy kept without the room's `rid`, never joined by
itself, only offered. Peer to peer: the host holding a slot, a page on its
network seeing the room (hosted by) and joining with one press, a page on another not; *Show on this network* off
(the slot let go) and on; a page that was in the room rejoining its host by itself; a day later with nobody holding
it, the first page back hosting it from its copy and the next linking to it; on another network nothing by itself,
*Start room XYZ again* hosting it with one press; Leave on purpose, nothing by itself; the relay's log naming none of
the pretend addresses.

### collab.mjs --quick

`--quick` runs only the last story in the per-story part.

### collab.mjs --arr

`--arr` (v170, not in the main run) runs only a story's copy on the relay (`arrRound`, a relay of its own with `--scenes`
on a temporary folder; the qubits story; "A story's copy" in `docs/agents/shell.md`): in developer mode the bar's *Copy to
relay* makes `qubits-copy`, plays it and opens the editor, the address `#qubits&arr=qubits-copy&edit`; the first
chapter's length typed in the editor reaches the story's `arrange.apply`, and *Save* writes `layout.json`
`{ studio: 1, story }` with it; a page opened with `&arr=` reads it back and lays it over the story (its bar *Copy: ...*,
no *Copy to relay* outside developer mode); `&arr=no-such-copy` says *Copy not found*; in a room two pages following a
station: the copy opened there is `st.<id>.arr` `{ v, story, by, at }` and both play it (never in `collab.state()`), a
save there reaches the other page, *Own story* ends it on both. A story whose engine has no `arrange` yet gets a stand-in
made from its own `CH`, `NARRATION_SYNC` and `TR` (`ARR_STANDIN`, the test's only); one that has it is wrapped to count
the calls.

### collab.mjs --standby

`--standby` runs only the pretend
headset's standby with the shared space in use (`standbyRound`, a room of its own set up as the main run's pretend headset
finds it, a minute or two, running the main run's own steps, `standbySteps`): the shared space at the head and as this
headset's own floor, standby with the floor 15 cm lower and a wrong space held off, the room back where it was and at the
same height once the space agrees, read once the room has looked at the space again (up to 8 s of frames; the fixed
800 ms read before missed that look whenever one of a software-drawn page's 1 to 4 s frames fell there, as in every
main run of v119 and v120), and woken again on the first floor.

### collab.mjs --narration

`--narration` runs only the narration in headsets and
the welcome (`narrationRound`, also in the main run after your menu shown to your circle; a room of its own with a story
circle and the lobby, a page and two pretend headsets lined up through the shared space, a few minutes): the narration
off by default in a session (the session's mute off, the panel's button *Narration off*; the page's own on, its mute on);
the page's Shared dialog's Narration pressed twice (Off for all, then On for all, `look`'s `vg` 1 and 2) reaching both
headsets; one headset's own Off from its menu an override (`xrNarrRoom` `{ code, vg, on }`), the other staying on,
`look` unchanged and nothing written by it; the other's story panel button the same; Off for all and On for all from a
headset's menu (Circles) dropping both overrides (`vg` 3 and 4); an override kept through a new session (between
sessions the page follows the room's); walking into Back to the lobby dropping it (the log's `narration own dropped`,
`lobby`); no `look` ever written by the headset with its own; leaving the room dropping it. The welcome: not before
lining up (3.5 s with no shared space id), then once, asked first (the trigger's words and the controllers' buttons, in
front, not pointable, no notice *The menu*); the menu opening closing it, not again that session; walked into, the walk's
words; not while the room setup guide shows, then once it is closed; tracked hands, the pinch's words and no grip;
outside a room 2.5 s in, never while a stub of `HOST.collab.cameraMode` says camera mode.

### collab.mjs --walk

`--walk` runs only moving with the
sticks for a VR headset elsewhere in a room (`walkRound`, also in the main run after the narration round; a room of
its own with an airports circle 3 m ahead of where the headset joins and Back to the lobby 3.5 m beyond it, a page and a
pretend VR headset that answers *Somewhere else*, a minute or two; `installXR`'s `walk: true` gives its local space offset
spaces and two controllers with sticks, `X.stick(hand, x, y)`, and its frames go through the session's own
`requestAnimationFrame`, so the shell's hook moves three.js's space as on a headset): `walkWhy` `''` with no travel yet and
its own floor; two stick clicks turning it on, the notice saying *The others see you move*, the menu's row pressable; the
left stick moving it (`HOST.xr.travel()`) and its head in the room by as far towards -z, the page hearing its presence's
head move by the same within 5 cm once at rest (`HOST.collab.body`); the room's frame and the lobby's icon in three.js's
space unchanged, no `origin moved` in the log and no notice to calibrate; a flick turning it 30 degrees (its heading in
the room, and in its presence on the page within 3 degrees), back again, no jump; with the circles walked into the
sticks taking it into the airports circle (its live station, its presence's `st` on the page); with the circles asked
first on into Back to the lobby (its station ended); a recentre (local and local-floor moved by one transform, the reset
as Quest Browser sends it) leaving it where it was in the room within 1 cm; a second pretend headset in AR getting no
travel from its sticks (`walkWhy` `'ar'`); the first answering *In this room* back to no travel, its sticks moving
nothing, two clicks saying *Not while you are in the room with the others*, the row greyed.

### collab.mjs --ships

`--ships` runs only the
spaceships in a shared room (`shipsRound`, also in the main run after the walk round; a room of its own with two
story circles, a page and two pretend AR headsets lined up through the shared space, with controllers (`installXR`'s
`walk`), each at its own circle, a few minutes): A launches by its right stick clicked twice; B, at the other circle, draws
A's ship where A had it at the relay time it draws (against A's own track, `debug.track`: the median within 3 cm); A
leads 2 drones and 3 targets (frozen, `debug.freeze`: still, holding fire, their shields not refilling), which B draws where A has them; B launches, a third drone, the set
kept, A still leading; A and B each hit the same drone, A deciding (its shield 10 after A's bolt, then 0 and its health
50 after B's, on both devices), and B's last bolt destroying it, credited to B on A, B and the page (its people list); B
whose frames pause 2.6 s while A flies on keeping A the leader on its first frame back; B missing A's presence (its quiet
time made 0) and taking itself for the leader: a pickup A gives away meanwhile gone from
B's own copy, and its bolt on a drone said by B and A taking no frames until B's word has come: the drone's shield 30 to
10 on A all the same, and once B hears A again A leads on both ; a pickup B flies through given to B by A (B's rapid fire on, gone for everyone), and one claimed by both at once given to
one only; A lands, B leading and taking the set over where it was (the drones within 5 cm, their shield and health, a
destroyed one's time, a pickup's time left), back to two drones; A, back in the air, fires at B's ship from behind: B
decides, its shield 80 on B, on A and in the page's people list; nine more and B is destroyed, credited to A on every
device and the page; B back 5 s later full, seen so by A (frames until it is, 8 s more at most on a loaded machine; the 5 s
itself is the smoke test's); no room key written by the game while it played, and no effect
reaching a story's effect hook.

### collab.mjs --camera

`--camera` runs only camera mode (`cameraRound`, also in
the main run after the studio's behaviours; a room of its own with two story circles, a page, a pretend headset with
Quest Browser's user agent and a pretend Android phone with Chrome's (`openDevice`: a pretend `navigator.xr` offering
`immersive-ar` that records what `requestSession` is asked and gives the page's pretend session, and every set and fx the
page sends recorded; `installXR` with `phone: true`: a viewer space at the phone's camera, aimed by `X.look`, a hit test of
its view straight ahead against the floor, `X.noFloor` while it has found none, the DOM overlay's state, anchors without
persistent handles, no shared space, and `end()`), a few minutes): the Shared dialog's *Camera mode* on the phone (with
its line), none on the page or in the headset's browser; the headset calibrated on the room's floor spots (its tip on
each) and walked into the first circle; *Camera mode* pressed: the story's own `xrStart` asks, through `HOST.xr.request`,
for `hit-test` and `dom-overlay` (once) with `#camera` as the root (and depth sensing still; no phone AR menu button,
`#xrPhone`, shown); the overlay shown, the dialog
closed, *Move the phone slowly* and *Set spot A* greyed before the floor is found; the page hears a member of kind `cam`
named *Camera*; aimed at spot A (*Aim at spot A and tap Set spot A*, the hit on the spot, the ring there), Set, then spot
B: lined up, the phone's room the headset's (origin within 1 cm, direction within 0.5 degrees, its own floor 5 cm off);
no guide, flow, check by eye, menu or notice in 3D, the room's `rm` the headset's; *Follow* lists the headset, both
circles and Nobody, and following the headset the phone's station and story are its, the rig at the station's spot
(within 3 cm), its clock the station's once the headset plays (within 1 s), the headset drawn where its presence puts it
(its tag; no head or hands over a person in the room); the headset hears a camera (`P.cam`) and never draws or counts it
(heads, lined up 1 of 1), and the page cannot follow it; the headset's menu (its Circles tab's people, read as its canvas
is written) lists the phone as *camera (filming)*, never *here* or *elsewhere*; the headset walks into the other circle and the phone follows;
the phone standing 2.5 s in the first circle changes nothing; a screen ray on the story's own panel is the shell's and
presses nothing, and `beforexrselect` is cancelled on the overlay and its buttons; *Panels: hidden* hides the story's
panels on the phone only (the headset at the same circle keeps them, no `ui` key written), and back; *People: hidden*
draws nobody, and back; *Subtitles: on* shows the caption at the foot once the headset plays; nothing sent by the phone
but its presence and no key of the room its; the page's people list says *camera (filming)* with no Follow; *Hide* and a
double tap (two taps 0.6 s apart are none); *Exit* ends the session (camera mode off, the overlay gone, a page again for
the room) and the page follows the headset on; Start pressed and then an AR session its own request did not give (set
directly, Enter AR stood aside): not the camera's, Start's wish dropped; started again with marks and two handles planted
as a browser that keeps handles would have them: Set spot A at once, not lined up, no marks kept or looked for, the
handles let go, no places kept (nothing in `roomFrames` or `roomFrame`), and *Exit* again; a link with `&camera`: its own page, *Start the camera* once
joined, no dialog; with `--shots` its pictures, `camera-*.png`: the overlay while aiming, following,
panels hidden, subtitles, and the link's page).

### collab.mjs --preview

`--preview` runs only the desktop preview camera (`previewRound`, also in the main run after camera mode; a room of its
own with two story circles, a page A, a desktop page D (a computer's: `openDevice` with no user agent, its pretend
`navigator.xr` offering nothing, every set and fx it sends recorded) and a pretend headset H (Quest Browser's user
agent), about four minutes; with `--shots` its pictures, `preview-*.png`: A's dialog, D's overlay, D's picture with the
overlay hidden, the headset drawn on D, the link's page, D after keys held, D with the mouse caught, D with Labels
hidden): `FORMAT` networks-48 or later; the Shared dialog's *Preview camera* on D with its line (*TV or a projector*,
*Not placed yet*), none in H's browser; with no `pcam`, the default (3 m behind the first circle, 1.6 m up, looking at
it, 60 degrees) and nothing written; on A's room map (no headset in the room) the camera dragged: one write as it is let
go (`ts`, `by`; its height, turn and field of view kept), then its handle dragged towards the second circle: one more
write (aimed there within 0.3 degrees, level); *Preview camera* pressed on D: the story's own `xrStart` gets the shell's
pretend `immersive-vr` session (three.js presenting it, the canvas and its viewport 960 x 540, the room's frame src
`pcam`, the dialog closed, `body.pcam`), its three.js camera at the key's place and turn (1 mm, 0.1 degree) with its
field of view, A hearing a member of kind `cam` named *Preview camera*, D following the circle it looks at (*What it
looks at*: the second, its story loaded); the overlay shown, hidden with the pointer after 3 s without the mouse
(computed `cursor: none` on `#pcam` and on the canvas `#gl`), both back as it moves; its numbers typed and Enter: one
write (`ts`, `by`), the three.js camera on it; *Keys: smooth* by default, pressed: *Keys: steps* (kept in
`localStorage`); with steps, keys (ArrowUp three times, Shift+E): shown at once, one write as the run ends (30 cm along
its aim, 1 cm up), Space reaching no story; the wheel (two steps: 52 degrees, one write) and a drag on the picture (50
px right, 20 px up: aim +10 and tilt +4 degrees, one write); H lined up on the floor spots and in the first circle, its
menu open: the camera's marker at its place (opaque lines, over everything); *Place the preview camera*: the marker
where a press would put it, the ray's hover the shell's (`pcam`), the button *Placing: pull the trigger*; the trigger:
one write from H (the controller's tip within 1 cm, its ray within 0.1 degree, level), placing over; D's three.js camera
on it (1 mm, 0.1 degree, its field of view kept); H drawn on D (head, hand, ray); a turn with a roll (5 degrees, written
by A): D's *Level* says so, R levels it (one write, aim and tilt kept); steps: J twice and Shift+I (2 degrees left, 0.1
up, one write); *Keys: smooth* again, keys held with Playwright's own key events, the time held measured around them
(each within 6%, the events' own time and 1 cm): W held 1.5 s moves it forward along its aim at 0.75 m/s, moving while
held, its turn and height kept, written at least three times, at most one write per 0.5 s while it moves (every gap 480
ms or more) plus one as it stops, the key on its last place; Shift+W a quarter of that; L held turns it right and I held
tilts it up at 45 degrees a second, its place kept; *Speed* cycles normal, fast (kept), slow, normal, and E held at fast
goes up at 1 m/s; a key held stops at once when the window loses the focus (a `blur` event) or the tab is hidden
(`hidden` made true, a `visibilitychange`), written once, the key let go later moving nothing; a click on the picture
catches the mouse (pointer lock on `#pcam`: headless Chromium grants it; the bar hidden, *Mouse caught: Esc lets it go*
shown; before, the mouse line *Click the picture to look with the mouse; Esc lets the mouse go*); the lock's movement
fed as `pointermove` events with `movementX`/`movementY` on `#pcam` (Playwright's mouse moves nothing while it is
locked: each move comes back as its opposite): 200 px right and 100 px up turn it 20 degrees and tilt it 10, Shift 40 px
one more degree, a 600 px jump dropped, its place kept, written once it settles; S held and the lock ended
(`document.exitPointerLock()`, as Esc): it stops at once, the overlay back; with H stepping its frames, *Labels: hidden*
on D: `HOST.xr.labels()` `hidden` there and H's name tag drawn neither on top nor in 3D, kept in `localStorage`, H's and
A's `HOST.xr.labels()` and the room's `look` unchanged; shown again: the tag back, `HOST.xr.sig()` changed; *Cards:
hidden* (D following nobody: both circles' cards on show before): no circle's card drawn on D, kept; shown again: both
back; the second circle followed again; D sent nothing but its presence and `pcam`; *Stop*: the pretend session ended, a
page again (kind `desktop`, following on), the browser's `XRWebGLLayer` back, nothing kept for a reload; a link with
`&camera` on a computer: its own page, *Start the preview camera* (no dialog, not camera mode's page), which starts it;
reloaded as a release reloads a page (`HOST.live.reload`), it starts again by itself (no *Enter VR to continue*);
stopped, it stays stopped; a circle added under the camera's glyph on A's map keeps its click (A follows it) and its
drag (it moves), and the camera's key is not touched (`mapGrab` tests circles first).

### collab.mjs --design

`--design` runs only the design room
in a room (three pages and a pretend headset, a minute or two; with `--shots` its pictures: `design-menu.png`, the menu's
canvas, `design-station.png`, the table at its circle, `design-circle.png`, its ring, card and icon among the others).

### collab.mjs --token

`--token` runs only the relay's password (`tokenRound`, not in the main run; a relay of its own with `COLLAB_TOKEN`, a
minute or two): a page without it sees the Shared dialog's field, and Start a room and a join by code wait for it on the
relay (nothing peer to peer or on this device); a wrong one refused with its note and nothing kept; the right one kept
under the relay's origin, the field gone and the room that waited started on the relay; a second page that has it
joining by the room's link, which (and every address) carries no password; a pretend headset without it getting the
menu's *Relay password* row and its keypad page (26 letters and 10 digits, Use greyed while empty, a wrong one refused,
Delete), then joining; the password in no page's `window.__collabLog`, address or room key, nor in the room the relay
keeps, its lines or its log files; *Forget the password* asking for it again (with `--shots`: `token-1-field.png`,
`token-2-wrong.png`, `token-3-keypad.png`).

### collab.mjs --studio

`--studio` runs only the studio in a room (`studioRound`, also in the main run, after the room setup guide's round;
about three minutes): relays of its own from port 8790 up, `--static .` with `--scenes` on a temporary copy of
`tools/studio/test/scenes` and a second scene (so none is picked by itself); three pages and a pretend headset: the
menu's *Studio here* putting the circle at its feet, its clock in explore mode, the headset standing in it and the
pages following, none asked to update; the scene picked on one page reaching all; a move by the arrows on one page and a
cube added on another at once, both kept; the headset inside the cube seeing the figure and its sound and not the box,
while a page walking outside and one in Orbit view see the box; a cube that starts something (*Bobber*, Bob looping
on the box, added on a page) held alike by every page and the headset, `plays` included, the headset walking into it
playing Bob on its box (one layer at full weight, the box where Bob puts it) while the pages (one walking outside it, one in
Orbit view) play nothing, the room's keys and every device's state's keys unchanged but for the cube and no effect sent;
deleted on another page, gone everywhere and the headset's box back to its own Spin; *Save* from the headset's panel writing `layout.json`
*by* its name, `.history/` holding 1 file and then 2, every page then *Saved*; a file copied into the folder in the Add
lists within a few seconds; the story's lock refusing a page's edits and the headset's grip; *Convert to GLB* writing
`models/figure.glb`, every device's figure switching to it (corners within 1 mm), the FBX under *Originals*, and its
picture written through the relay as `previews/models/figure.glb.jpg` (a JPEG under 200 KB), listed as kind
`preview` and shown on another page's Add pane card and the headset's canvas; a model
lacking its picture (the textures scene's `rust.obj`, copied in; that scene itself left out of the copy) given *Use
paint.png* on a page's card: `models/rust.glb` through the relay with the picture in its record, every device's object
switched to it, textured, where it stands; Fewer triangles and Change texture (a dense textured ball made on a page
and put in the folder, saved at 20 % on a page through the relay, every page's and the headset's switched to it as light
as previewed, its record's `tris`; a picture put in its colour slot and saved from the headset, made again from the ball
with its share kept); the rig scene's dancer copied in and placed on a page, a sound made there to
follow her head taken by every page and the headset (each sound where its own dancer's head bone puts it at one held
scene clock, within 1 cm of the first page's) and the saved `layout.json` carrying `on`, `bone` and `o` (that scene
itself left out of the copy); a cut-out made on a page on the test scene's box reaching every page and the headset (its
corners in the scene's frame within 1 cm of the first page's on each, cutting there) and the saved `layout.json` carrying
it under `cuts` (the cuts scene left out of the copy); a group made on a page (the box, the figure, Tone and Doorway),
turned and sized on its card there, taken by every page and the headset (each member within 1 cm of the first page's, the
records the same), a Faces setting (the box inside out) from another page reaching every device's materials, and the
saved `layout.json` carrying `groups` and `faces`; a tint and a brightness (the box red, 125 %) set on a third page
reaching every page's and the headset's record and the box's own materials, and saved; a shape that hides things and an empty with Tone following it made on
a page, the shape locked and the scene's other circles hidden on another, reaching every page and the headset (the same
records, the sound at the empty), a third page's card refused by the lock, the headset at the circle telling its shell
(the hook recorded) to hide the other circles, the saved `layout.json` carrying `shapes`, `empties` and `settings` ;
motions (a wobble set on the box on one page and an orbit on the figure on another reaching every page and the
headset, each drawing both in the same phase at one room time held on each, within 1 mm, and the saved `layout.json`
carrying them); a recorded path (the headset records the box's movement, Record its movement armed and a grip on
nothing, 2 s at 30 frames a second with the recorder's clock the test's; its place unchanged, the path reaching every page,
and at one room time held on each, half way through its loop, every page and the headset drawing the box at the same
pose along it, within 1 mm); a ten-minute recording and a voice (with Chromium's fake microphone, which every
browser `tools/collab.mjs` starts has: C records the box for 10 minutes on the test's clock, kept as `recordings/Box-1.json`
through the relay; every page and the headset take its record (the same `src` and `n`), read the file from the relay and,
at one room time held on each, draw the box at the same pose within 1 mm of C's; then C records it again with its voice,
4 s in real time: the path and `sounds/Box-voice-1.wav` (a mono WAV) following the box with `sync` reach every page and the
headset, at one held room time every device puts the voice at the same moment of its file (within 1 ms), and with the
sound on B and C hear it where the room's clock says, within 50 ms; taken away after); a 25 s sound streamed; From another scene (a scene `shelf` made in
the folder with an FBX naming its picture and an OBJ with its MTL and picture: copied into the open scene from a page's
Add pane with the picture at the same paths and the same bytes, placed, one Undo step, taken by every page and the
headset with its picture; the OBJ and what it names under `originals/`, its model in; a second copy of the FBX a new name,
this scene's picture kept; the headset's Add pane offering it); the scene on the room's frame (set up first, so
that nothing from the round's earlier steps moves them: the box, the figure, the cube and the sound without a motion, a
path or a behaviour, nothing locked in place, no cube listing them, and the circle moved to a known spot away from the
room's origin; the headset at the studio's circle drawing the box, the figure, the cube and the sound where their records
put them in room coordinates, their world places turned back through its room frame, within 1 mm; the circle moved 2 m
and turned 90 degrees from a page (`HOST.collab.move`, as the room map moves it): every item where it was in the room
frame by frame while the circle glides, within 1 mm, the headset still at the station, its rig at the new spot; *Move the
scene to this circle* on a page refused while the box is locked (naming it, nothing changed), then every item at the
circle's spot transform of its old place within 1 mm, the cube's yaw turned with it, one Undo step (the list one
longer, its last step every item it moved, once each, with its record as it was just before), every page's and the
headset's records the same and the headset drawing them there; Undo taking it back everywhere); a circle made for one scene written as the shell will
(`st.<id>` and `st.<id>.x` naming `quiet`, with a saved layout of a sound and a cube): two pages following it open it and
write the layout, the room holding each item once, the first station keeping its scene; New scene on the headset's panel
with the shell's keypad stubbed (`HOST.collab.keypad`): made on the relay and opened at its station, the page following it
switching too. Uploads: `/upload` redirecting (302) to `/#studio&upload`; the Upload pane making a new scene, planning the
test originals and sorting them into `models/`, `sounds/` (a mono 16-bit WAV, and a mono 44.1 kHz MP3 from the relay's
`ffmpeg`, else a mono WAV) and `originals/`; the GLBs loading with their records. Then a relay with `COLLAB_TOKEN`: a
page without the password making one refused call and then none, nothing listed or saved (the API 401, `layout.json`
unchanged); a wrong password typed in the Shared dialog never sent by the studio; the right one opening the scene without
a reload, every file and upload carrying it; save, upload and a studio station in a room working; the password in no
page log, address, room key, relay line, log file or saved layout. Then the scenes in R2 : the stand-in S3
(`relay/s3fake.mjs`) on another port (from 8840 up), so every file comes from another origin, and a relay with `--scenes
r2` and a password: a page opens the test scene from it (every file by its signed link, straight from the bucket, CORS,
none refused, none signed in a header), a 25 s sound streamed from it (an element with `crossOrigin`, its ranges 206),
Save writing `layout.json` and `.history/` there, Convert to GLB sending `models/figure.glb` straight into it (a signed
PUT, the record read with a range) and its picture too (`previews/models/figure.glb.jpg`, `image/jpeg`, listed with its
link), From another scene by the bucket's CopyObject (a second scene in the bucket; the FBX
and its picture, each copy's `x-amz-copy-source` signed in the header; placed, its model in), a link the bucket refuses read again and the file fetched by its new one, links past
half their life read again, the Upload pane making a scene and sending the test originals straight into it (the long
sound made MP3 by the relay's `ffmpeg` from its original there), an upload the bucket refuses sent through the relay
(and the next without trying the bucket), the pretend headset opening the scene from it, and the password in neither
the bucket's requests nor a link, the relay's lines or a page. With `--shots`: `studio-*.png`. The design and All
stories rounds expect `STORY_EXTRA`'s pages (the design room, then the studio) after the stories in the pickers.

### collab.mjs --follow

`--follow` runs only following a person (a room of its own with two stations, a minute or two; with `--shots` the
people list with Follow, `follow-person-1-people.png`, and the dialog following someone, `follow-person-2-following.png`
and `follow-person-3-people-following.png`).

### collab.mjs --circles (ten-headset round)

The ten-headset round (`headsetRound`, also in the main run, after the
room on this device; `--circles` runs only it, a room of its own with three stations, about four minutes): a pretend
headset sees every card and icon and everyone before any circle, the station cards and a person's name tag following
Cards (in 3D by default, on top, hidden with the rings and icons staying) and not Labels (hidden, still in 3D); the rings 0.5 m over the floor and each card over its ring's middle; in its circle the others' icons only (pointable; their rings gone) and of its own nothing, and only the
people at its circle; *People* in the clock menu drawing everyone and back (kept on the headset, nothing written);
*Show all rings* there showing every ring at any distance, its own too (pointable; kept on the headset, nothing
written), and off again; a ray
resting on another station's icon bringing up its card (no other), still there a second after it moves off, gone about
2 s later, the icon staying; the trigger there running nothing; walked out, still in its story; 1.6 m from another
station's spot its ring there (pointable), 2.6 m off gone again; walking into another circle switching;
the circles lock refusing the grip on a ring and Arrange all and nothing else (the grip at its station free, *Lock this
story* in the menu still working); *Lock this story* refusing the scene and panel grips there, for the room; *Lock
circles* in the menu unlocking; at another circle nothing locked; *Lock story* in a page's dialog locking and unlocking
the headset's circle. With `--shots` its pictures: `round-1-rings.png` (in a circle, the others as icons only),
`round-2-pointed.png` (an icon pointed at, its card up), `round-3-menu.png` (the menu's canvas with *Lock
circles*, *Lock this story* and *People*) and `round-4-dialog.png` (the Shared dialog with *Lock circles* and each
station's *Lock story*).

### collab.mjs --ask (circles asked first)

Circles asked first (`askRound`, also in the main run, right after the ten-headset round;
`--ask` runs only it, a room of its own with two story circles and Back to the lobby, a page and a pretend headset, a few
minutes; its two devices the only ones in the run without `collabAskDefault` = `walk`, so v120's default): the fresh room
asking first with nobody having written `look`'s `ask` (the page, the headset and the dialog's button *Circles: ask
first*); a page's Shared dialog turning the room's switch to walk in (`look`'s `ask` false written, the headset too) and
back on (*Circles: walk in* to *Circles: ask first*, `look`'s `ask` true, the headset too); no ring drawn or pointable then, the lobby's too, the cards and icons staying, *Show all
rings* bringing every ring back and off again hiding them ; the headset walking into a circle and standing there 3 s entering nothing; the trigger on
another station's icon (pointed at first) opening the question in front of it (that circle's title, 0.8 to 1 m away, on
top and the ray's first target; no notice); *Not now* (pressed by the ray at its button) closing it, nothing entered;
opened again, gone by itself after 10 s; *Not now* pressed by the right index fingertip (a pretend tracked hand, hovering
first); the headset having written nothing to the room meanwhile; *Go in* entering that
circle from the other one (its live station, its story loaded and its rig at that circle's spot, the page seeing its
presence there) and standing on in the first circle entering nothing; the lobby's question (*Back to the lobby*) and its
*Go in* ending the station, the story loaded hearing it (a stub for `HOST.cur.lobby`); from a story again, walking into
the lobby (its ring hidden) ending the station after 1 s and the stub called again; *Go in* pressed while standing in the
lobby holding (not taken back there); the menu's *Circles* row turning it off for the room (`look`'s `ask` false), the headset having written nothing but
`look` (and what any arrival writes: its story's state and view there); walking in working again; then a studio
circle added from the page: `HOST.collab.hideOthers(true)` refused (false) at a story's circle, and at the studio's
(walked into, the studio loaded) every other station's ring, card and icon gone and nothing of them pointable, a hidden
story circle not walked into (still at the studio after standing in it), the lobby still walked into (the station ends
and the hiding lapses with it), then a story circle walked into again (with `--shots`: `ask-1-question.png`).

### collab.mjs --menus (your menu shown to your circle)

Your
menu shown to your circle (`menusRound`, also in the main run, right after the circles asked first; `--menus` runs
only it, a room of its own with two story circles, a page and three pretend headsets, A and B walked into one circle and
C into the other, a few minutes; `MENUS_STORY=studio` in the environment makes A and B's circle a studio circle, v139):
off by default (*My menu: only me*, nothing kept), A's menu open sending nothing and B
drawing nothing; A's *My menu: my circle* (Settings) pressed: B draws a plane where A's menu floats (its top edge's middle,
its turn and width within 1 cm and a degree, the picture's shape that of the part A's menu shows; A's menu and B's copy
read while both draw frames, since between the round's steps a pretend headset draws none and B lets a copy go 3 s after
its last sample), its picture A's menu
(its pixels not dark), depth-tested, `renderOrder` between 49 and 50 (its group's 0), never pointable, A's name on its tag; C draws none
of it; the page's Shared dialog says *showing their menu*; A's tabs changed four times a second, a frame of A's with
each change, for at least 4 s and until 2 pictures have gone out (at most 20 s: a busy machine draws the pretend
headsets' frames seconds apart, and pictures are made in frames): at most one sent every 1.5 s by A's own clock (a
want's answer counted, as it is sent too), each 1,490
ms or more after the last, every effect under 48 KB, B taking every one (its `got`); a pretend controller's ray moving
over A's buttons for 4.5 s, a frame of A's with each move (only their light changing, at least three buttons lit): a
picture made at most every 4 s by A's clock, each 3,990 ms or more after the last (pictures by their numbers: a want's
answer is no new one), but one sooner at most, and only where the later picture shows a later `cver` than the one before
it (`menuSent`'s `cv`: what the menu shows changed meanwhile, as its clock's minute; the light of what is pointed at
never moves it), and under 24 KB a second sent; the Story tab's picture (its
shape that tab's, its height read once a frame of A's has drawn the tab, lit below its top quarter where the story's
panels are drawn in; a pretend headset's step does not draw the story's panels, so the round draws them once first); A's head turned 69
degrees, its menu gliding back in front: B's plane following (at most 5 poses a second) and ending where A's stands; A
silent (no frames, as a headset taken off): gone on B after a few seconds with nothing closed (B's `menu gone` says
`quiet`), and back once A goes on (B asking for the picture it lacks); A's menu closed, while both draw frames and B
holds a copy whose last sample is under 1.5 s old (else, frames stopped between the round's steps, B let it go quiet
first, rightly): gone on B as its `closed` comes
(B's `menu gone` says `closed`, so not the 3 s without a pose; within 2 s, B's polls reading no pixels back; a failure
shows B's log of A's copy, a `closed` it ignored too, and A's own closed lines), opened
again, back; *My menu: only me* again with the menu open (the same way): gone on B (`closed`), nothing more sent; on
again (kept as `xrMenuShare`) and A's session ended (the same way): gone on B (`closed`) (with `--shots`: `menus-1-picture.png` and `menus-2-picture.png`, the pictures B holds of A's
Settings and Story tabs, and `menus-1-seen.png`, `menus-2-seen.png`, what B sees from its head).

### collab.mjs --studio-scenes

The studio's scenes as circles (`scenesRound`, also in the main run after the studio round;
`--studio-scenes` runs only it, a relay of its own from port 8770 up with `--scenes tools/studio/test/scenes
--scenes-readonly`, a minute): the page's Add listing after *Studio* one entry per scene of the relay (*Studio: <scene>*,
values `scene:<name>`), then All stories and Back to the lobby; adding *Studio: test* writing `st.<id>` `{ story:
'studio', sc: true, x, z, yaw }` and `st.<id>.x` `{ scene: 'test' }` for every page; a second scene's circle at once, both
titled *Studio: <scene>* in every page's dialog; *Studio here* adding a plain studio circle beside them and then moving
that one; a scene picked at that plain circle (its state naming it, its title *Studio: <scene>*) and *Studio here* still
moving it (no fourth circle); a scene circle moved keeping its `sc`, and *Studio here* then still moving the plain one.

### collab.mjs --home

The relay the main site offers (`homeRound`, also in the main run after the scenes round; `--home` runs only it,
under a minute): a browser of its own that takes `stories.lbi-netmed.com` and `stories.lab.lbi-netmed.com` for this
machine (`--host-resolver-rules`), the page served there by the test relay as plain http (the offer goes by the host
alone), its `/api` turned away as GitHub Pages has none and nothing let out to any other address: as the main site it
offers `https://main.lab.lbi-netmed.com` (`HOST.collab.homeRelay()`, the Shared dialog's box naming it) and sends that
address nothing before a password is typed; as the test place's name and on `127.0.0.1` it offers none (`HOME_RELAY`).

### collab.mjs --behave

The studio's behaviours shared (`behaveRound`, also in the main run after the scenes round; `--behave` runs only it, a
relay of its own from port 8750 up with `--scenes` on a copy of the test scene alone, a few minutes): a studio circle at the
room's origin facing -z (its scene's frame the room's), two pretend headsets in it and a page following it; a ball that
follows (nearest, range 3, 1 m, 1 m/s) and a cube that looks (first) put in on the page; the nearest headset is the ball's
on every device and drives it (the others drawing its samples) to 1 m in front of itself, where all three draw it within 5
cm, and the looker's; while it walks 1.5 m the page and the other headset draw the ball where it had it 120 ms before (the
median within 5 cm, by the relay's clock; it prints the median and the 90th percentile); Pause on the page (editing
on there) writing nothing to the room (its `state()` and the station's key unchanged), the page drawing the ball where it
is placed while the other headset still draws it within 5 cm of the driver, and played again the page following it again;
the other headset coming nearer by more than 0.3 m taking the ball over everywhere; the looker staying the first headset's while it is within range + 0.5
m though the other stands nearer, and the other's once it is further; nobody in range, both back where they are placed on
every device; the room keeping the two records and no key of the samples.

### collab.mjs --trackers

The PC's Vive trackers end to end (`trackersRound`, also in the main run after the studio's behaviours; `--trackers`
runs only it, three to five minutes; `tools/trackers/SPEC.md`, "Tests"): the bridge's lane, the shell's and the studio's
together through a relay of its own from port 8730 up (`--trackers 0`, a free UDP port read from its start line, and
`--scenes` on a copy of the test and puppet scenes, taking uploads) and the fake bridge (`startFake` with SteamVR's space
the room turned 0.7 rad and moved by (1.3, 0.02, -0.6) m): one tracker laid on spot A then spot B, a prop tracker going
round at 0.38 m/s, the Index's headset and controllers, a base station, and six trackers worn on a performer, a walking
copy of the puppet test rig worked out in Node (three.js and its GLTFLoader, as `tools/studio/test-ik.mjs` loads them; the
smoke test's seeded offsets, their mean along the floor zero), fed to the fake as functions of its clock. Three pages and
a pretend VR headset with Chromium's own user agent (not a Quest's; in VR from the start, asked whether it is in the room
while the room does not use the trackers yet; the airports story they open with stops drawing its globe, which in software
starved the pages for seconds): the relay's ping (8 trackers seen); the Shared
dialog's section and its switch (`trk.on` in the room, every device then told `l: ''`); spot A and spot B through the real
`/api/trackers/still` (spot B refused while the tracker slides 3 cm a second, then taken), `trk.m` within 0.2 mm of where
SteamVR reads the spots, the status *Lined up by hand (the spots 2.00 m apart): 8 trackers in the room.*, the 11 tracked
devices on every device (no base station); a name typed in the dialog reaching the others, another page's name and a
newer app's field kept by a write; the headset, the fake's `'h'` its head, lined up by the trackers (`'trackers'`) within
1 cm and 0.5 degrees (0.01 cm and 0.003 degrees), *In the room* answered for it, never *Calibrate the room* meanwhile, the
pages' list *lined up (the PC's trackers, ...)*; at a held relay time every device's trackers within 2 mm and 0.2 degrees
of the truth (0.6 to 1 mm and up to 0.06 degrees); a studio circle for the test scene where the headset stands, three pages following
it, a shape set on a page's card to follow the prop tracker drawn within 5 mm and 0.5 degrees of where its true pose and
offset put it on every device at a held time (0.1 to 0.7 mm, under 0.05 degrees); the puppet scene picked there, the spot and prop
trackers switched off, the rig worn whole body and lined up from the T-pose after its 5 s countdown (its six parts found,
moved to the performer within 3 mm, sized 1), the record and its solving on every device; the performer walking, the 23
bones on every device within 1 degree of each other at a held time (0.0000) and its hands and feet within 1 cm of the
performer's (0.6 to 2 mm); a 3 s take (its countdown, Stop) saved through the relay as `models/rig.glb` with *Walk* and
*Take 1* (3.1 to 3.4 s, 24 tracks, read back in Node; 9 or 10 keys from a page drawing in software), another page switching to it and playing *Take 1* once it is worn no
more. A held time: the fake paused for a moment, each device waiting for the last reading (a page busy drawing in software
takes the relay's messages late), the relay's time held (`HOST.collab.trkTime`) between the last samples. With `--shots`,
`trackers-1-dialog.png`.

### collab.mjs --output

`--output` runs only the output page end to end (`outputRound`, also in the main run after the preview camera's round;
v157, `tools/output/SPEC.md`, Tests: integrator; four or five minutes): a relay of its own with `--osc-out` to a UDP
listener in the test, `--osc-in 127.0.0.1:0`, `--trackers 0` and `--scenes` (the test scene), its ping saying `osc`
(one target, its in port, trackers) and no target's address; page A (Anna) adds a plain studio circle, a pretend AR
headset H (Hana, aligned through the shared space as in the studio round) walks into it, A follows it and picks the test
scene on its Scene pane, and both have its four items (not a circle made for the scene: see "Known races" in the
output page's section of `docs/agents/shared-rooms.md`);
the output page O (`#s=XYZ&output` on a computer's page; Web MIDI stubbed as Wire 5 names it, one output *loopMIDI Port*
and one input *Pads*, what it sends kept in `window.__midiSent`) starts by itself, follows that circle and listens to
`HOST.cur.out`; its mapping (MIDI, OSC, MIDI clock; a stream and an incoming row) set with no problems; the others hear it
as the output page and never as a person (`HOST.collab.persons()`). Send entries are written on A with
`STUDIO.sendSet` (cube01: a held note 36 on entering and its leave; a new cube Gate with only a held note 38 on entering;
box001's press: note 60) and a cube Plain without any; then (1) H's head walked into cube01 gives
`/studio/cube/cube01/enter` `ssssi` on UDP saying who (Hana, her colour and member id), the cube's name and 1, note on 36
on the stub, and walking out its `leave` with 0 and the note off (H's effects spied: exactly enter and leave); Gate
(only a held enter) still sends its leave, so note 38 ends as H walks out, with no OSC for the leave; Plain (walked into
too) sends nothing at all: no effect, no event on O, nothing on UDP; (2) `pressFire` on A gives
`/studio/item/box001/press` saying Anna and note 60 on and off; (3) `/studio/press box001` sent on UDP to the relay's in
port advances `pr.box001` on A (its `by` *Output page*), a note 62 from the stub's input port, mapped to start the
sequence Intro by its name (added on A just before), writes `qr.sq0001` on, and `/studio/hide Box` (by name) writes
`sw.box001` by O's member id and hides the box on A (then `/studio/clear`); (4) 48 ticks of MIDI clock at 120 bpm (at
their exact moments, `HOST.out.midiIn(bytes, at)`) give `bt` within 0.5 bpm of 120 on A, by O; (5) *People as OSC*:
H alone in `persons()` and in slot 1, `/room/person/1/head` `fffffff` 1.6 m up at its circle (within 5 cm), 6 to 50 in
3 s, and `/room/person/1/info` `ssss` (Hana, colour, id, `ar`); (6) the stream (the head's height, 0 to 2 m, to CC 7):
`0xB0 7 102` on the stub, at most three CCs (only as the value changes); (7) `tools/trackers/fake.mjs` on the relay's
bridge port, the room's `trk` lined up by a write from A and *Trackers as OSC* on: O's status `on`,
`/room/tracker/LHR-FA4E0A01` `fffffffis` within 1 mm of the room's origin (ok 1, kind `t`), 60 or more in 2.5 s, all eight
tracked devices and no base station, and its `/name` (*Spot A*); and nothing on UDP that is not OSC. `--shots <dir>`:
`output-1-page.png` (O's overlay) and `output-2-cube-card.png` (cube01's card, its Sends rows). Untested here: real MIDI
ports and software, real OSC programs, a firewall, a real headset's cubes and pointing.

### collab.mjs --talk

`--talk` runs only Talk end to end (`talkRound`, v178, **not** in the main run; a minute): a room of its own on the run's
relay, three pages elsewhere at 320 x 200, the browser's fake microphone granted without asking (`LAUNCH_ARGS`). A talks
(`talkGate(0)`: the fake microphone beeps), B has Talk on with its Mic muted (listening only, so C counts one talker), C
has Talk off. B hears A (25 frames decoded and playing within 15 s), A's `talkMic()` is open with `subs` 1, and C's line
reads *1 person is talking: turn Talk on to hear them*; A's Mic muted: B's talkers gone within 2 s; A's Mic on again,
then A's socket closed by the test: after the reconnect B hears A again (a new stream) within 10 s. Why 25 frames in 15 s
and not 50 in 8: three globes drawn in software (10 frames a second, the main thread full) starve the talking page's
track reader, which handed over 3 to 20 of the 50 packets a second here (a light page blocked for up to 80 ms at a time
lost none). Its log line gives B's counts (frames, lost, late, the jitter target, the lag). No pictures.

### collab.mjs --smooth

Others' moves drawn smoothly (`smoothRound`, also in the main run, after the ten-headset round;
`--smooth` runs only it, a room of its own with two stations, three or four minutes): a raw socket at the station (speaking
as the follow-a-person test's pretend person does) turns its scene about the vertical at 90 degrees a second, 15 writes
a second with `ts` and `h`, each sent up to 25 ms late, then lets go; a pretend headset standing there in explore mode
records its scene's turn every frame (by the frame's own time: the page renders in between, slowly and unevenly in
software): after 0.5 s no frame without motion, the speed per frame within 35 % of the writer's in at least 85 % of
frames, the turn about `SMOOTH.DELAY` behind (within 80 ms), landing where it was let go with no overshoot; a place with
no `ts` still gliding in; landing at the frame whose render time reaches the let-go (not glided there); someone else
turning it and letting go, the headset gripping it at once (their samples dropped) and letting go a moment later, and
it staying where the headset left it; a place written for another story moving nothing (the relay refuses it); the same
for the station's panel moved sideways at 0.3 m/s, for a second station carried by the writer at 0.5 m/s (its ring),
for the explore view (and the headset writing nothing to the room meanwhile, its view ending exactly as let go; a view
with no `ts` gliding in by the story's own glide, nothing written back) and a person's head walking at 0.5 m/s; a grip held on the scene there writing at most 16
place values in any second (66 ms apart at the closest), each with `ts` and `h`, and the last without `h`. It prints
what it measured (frames, the share within 35 %, the speeds' 5th, 50th and 95th percentile, the lag, how far from where
it was let go). A new story needs an entry in `STORIES`
(`change` and `back`: code that changes its `state()`, and optional `effect`
and `more`); the headset's story (`HEADSET_STORY`) stays the last entry.
`--shots <dir>` also saves pictures of rooms on this network (`near-dialog.png`, `near-toast.png`, `near-again.png`,
the menu's canvas `near-menu.png`), of the dialog and eight headset views (the menu open on its Settings tab, its Story tab, its Sound check,
stepped out of a station's circle: still in its story, the others as icons only, and the stations' icons from behind the first row and along it, as a headset in no circle sees them, at 1280 x 800), and the ten-headset round's four.

## `tools/room-test.mjs` (room and depth test page)

After changing the room and depth test page (`room-test/`), run `node tools/room-test.mjs` (a minute; it starts its own
relay on port 8131 with `--logs` in a temporary folder): a pretend headset drives three.js r128's own WebXR path with a
real WebGL2 depth texture array made in the page, a new one every frame with WebGL's default filter (near on the left
half of each eye, far on the right), drawn into a framebuffer of the pretend layer's own, and its pixels show the test pillar and panel hidden where the depth is nearer and drawn where it is farther, in
both eyes, through three.js and through raw WebGL; depth of 1.9 and 2.1 m against the 2 m pillar; an eye with no depth
for a frame; rows split top and bottom (identity, *Depth as: metres, flipped*, and a matrix that turns y over); window
depth for its own near and far (auto reading it so, the close steps right), and with no far plane (`depthFar` Infinity:
the report's `infinite`, the probe in metres, the same occlusion and close steps, the picture drawn); depth seen from a view
0.3 m ahead of each eye (a surface 1.9 m from there drawn 2.2 m from the eye, the 2 m pillar in front of it, behind it
with *Depth seen from: the eye*; the offset in the report); the room marked changed every frame with the same shapes
(nothing rebuilt or gone for a frame) and a real change rebuilt once; the ladder after another error; also the
depth picture's colours, an integer (`'unsigned-short'`)
texture, CPU depth, a pretend wall, floor and table (Room's labels, Room hides hiding what stands behind the wall), a
pretend controller pressing the panel's Mode, a session without depth, the format ladder, the frame times (Nothing asking
for no depth, the GPU's done-by time per mode), the autosave and the report, and Send to the relay.

## Set harnesses (`shot.mjs`, `sweep.mjs`, `test-data.mjs`)

For the tour, test a changed set on its own in the set harness first
(`packages/lbi/src/shot.mjs`, much cheaper than the whole story), then the story at a
few seconds (`packages/lbi/src/sweep.mjs`), then the smoke test. The muscle story has
the same tools in `packages/nmd/src/` (`shot.mjs`, `sweep.mjs`), and so have the
endotype story in `packages/endo/src/`, the PET story in `packages/pet/src/`, the microanatomy story in `packages/micro/src/`, the ovary story in `packages/ovary/src/`, the qubits story in `packages/qubits/src/`, the mutation story in `packages/mutation/src/`, the tissue topology story in `packages/topo/src/` (also `test-data.mjs`: its data and decoders against the poster's numbers, a second), the soil story in `packages/soil/src/` (also `test-data.mjs`: its data, decoders and the story's key numbers, a second), the pass story in `packages/pass/src/`, the robot gang in `packages/robots/src/` and the tutorial in `packages/tutorial/src/` (also
`test-script.mjs`: the guide's script against the rules of its `SPEC.md`, section C, in story and in real time, a
second; a cheap check, run on `dev` too; its harness loads `ik.js` and `bodies.js` itself: `harness.html?set=guide&t=60`,
`mode=1` practice, `nofvt` the plain figure).

## The studio's tools (`scan.mjs`, `convert.mjs`, `test-images.mjs`, `test-ik.mjs`, `test-ktx2.mjs`)

The studio's two tools: `node tools/studio/scan.mjs <folder> [--check]` writes a plain folder's `index.json` and
`<name>/files.json` as the relay's API answers them (only what changed; `--check` exits 1 when one is not current, the
files' times aside: run it on `tools/studio/test/scenes` after changing the test scene). `node tools/studio/convert.mjs
<model> [out.glb] [--max-texture 4096] [--no-weld] [--keep 0.2] [--no-fill] [--shots <dir>]` (FBX, glTF, GLB, OBJ, PLY or STL; Playwright and
Chromium, as the smoke test) converts one model with the studio's own converter in a headless page, then checks the GLB
against the original (triangles, size, textures, clips, bones, where the bones and a sample of skinned corners are at
four moments of each clip, and pictures from three sides) and writes nothing when something did not come through (exit
1); it prints the record it wrote (`asset.extras.studio`). The default output is `<name>.glb` beside the input
(`<name>-<max>.glb` for a GLB). It is both a tool for the owner's batches and the test of the converter on real files
(the owner's two, outside the repository). `--textures <dir>` adds pictures to look in, `--texture <name>=<picture>`
gives a texture the model names and `--texture <material>:<slot>=<picture>` lays one on; it prints what each texture was
found as and writes `tex` into the record. `--ktx2` (v151) writes its pictures as KTX2 with the studio's own encoder in
workers of the page (`basis/`, served to it; `--max-texture` 8,192 by default then, `--effort <0 to 10>` 1 by default),
checks the GLB loaded back with its KTX2 pictures read back to plain ones (at most 1,024 px, their full sizes counted) and
prints each picture's levels, strips, time and bits a texel; a GLB input's default output is `<name>-ktx2-<max>.glb`.
`node tools/studio/test-ktx2.mjs` (v151, seconds, no browser) checks `tools/studio/engine/ktx2.js` in Node: the KTX2
container written and read (levels smallest first, aligned to 16 bytes, or 1 supercompressed; its DFD's sRGB and alpha),
a cut file refused in words, a GLB split and made again with a bufferView replaced (4-byte aligned, the lengths right),
colour and data images (every texture slot, the extensions' too: clearcoat and transmission data, a sheen colour colour),
an image used both ways split (its data uses on a linear copy with a bufferView of its own, a texture used both ways
copied, one used as data only pointed at it), the mip chain (sizes to 1 x 1, colour averaged in linear light: black and white to 188, data and
alpha to 128, an odd side's shares), the strips (8,192 px: 16 of 512 rows; none under a quarter of a million texels);
and with `basis/`'s own encoder and transcoder (`require`d) and the module's own worker code run in a `vm` as a worker
runs it: a 260 x 132 level whole and in three strips the same blocks byte for byte (no zstd), the strips joined with zstd
read back by the transcoder to the same pixels as the whole (and over 35 dB from the picture), and `encode()` through a
pool that runs that worker code making a 512 x 520 chain (10 levels) in strips, sRGB, alpha forced on every strip though
only the top rows have it, read back at level 0 and at the largest level at most 64 px (4: 32 x 32), and levels 0, 3 and 4
pixel for pixel as each level encoded on its own reads back; run it after changing `ktx2.js` or `basis/`.
`node tools/studio/test-images.mjs` (seconds, no browser) reads the textures
test scene's pictures and more kinds made in memory back against the pixels they were made from (exactly, or within the
block format's error for DXT1, DXT5 and BC5), and checks the refusals, broken and forged files refused in words and
quickly (strips or tiles of no size, sizes their data cannot hold, RLE counts past the end, a Deflate strip that unpacks
to 64 MB), a PSD's named alpha channel not taken for transparency, LZW and PackBits round trips, the ladder, `slotOf`
(colour words first, the last word only), `texRank` and the `.psd` renaming, and the fill of the gaps between a picture's
pieces (`cover` marking the texels whose centres its triangles hold, a tiny one's own; `fillGaps` on an atlas of
three shaded pieces on black: the covered texels unchanged, no black left, the texels beside a piece exact copies of
its edge colours, alpha kept or filled, a picture drawn down 2 and 4 times with a dark halo without `rim` and none with
it, a strip two texels wide keeping its own, a 4,096 px one); run it after changing `tools/studio/engine/images.js` or
`tools/studio/test/pictures.mjs` (then `node tools/studio/test/make.mjs`). `node tools/studio/test-ik.mjs` (under a
second, no browser) checks the trackers' solver (`ik.js`, at the repository's root since v164) on the puppet test scene's
rig loaded twice, one walking as the performer: the parts found (and refused in words), which tracker is which from a
T-pose, and every frame of the whole body (6 and 11 trackers, a performer 1.1 times the size), the feet and a headset,
and a headset alone (stepped feet: by turns, never both up, a planted foot sliding under 1 cm and lifting under 1.5)
against the truth, the same output twice, and a take replayed; and since v164, for people's bodies, a headset alone on
this rig with straight legs at rest: the head bobbing 2.5 cm over its height at rest and swaying (no steps, both feet
planted, none sliding: the old solver stepped 19 times), looking down 1 rad (the back upright, the hips under the head:
before, 15 cm back and 32 degrees), and moving at 1.6 m/s (the feet glide, no steps; stepping again once slow); run it
after changing `ik.js` or the puppet in `tools/studio/test/make.mjs`.

## Refactor checks: does a change of the shared engine change what a story does?

`tools/engine/` has three comparisons of two copies of the app (before: e.g. `git worktree add <scratch>/before <commit>`;
after: this folder), written for the shared engine parts (`docs/agents/stories.md`, "Shared engine parts"). Not tests of
the release run: run them when a change means to change nothing.

- `node tools/engine/same.mjs <before> [<after>] [--keys a,b] [--views desk,phone] [--shots dir] [--wait ms]`: pictures
  of each built story paused at a quarter, half and three quarters of its length and in explore mode, desktop and
  phone, compared pixel by pixel. Unchanged code gives 0.00% at the paused moments (now and then a set still building:
  run that story again with `--wait 3000`); explore mode moves by itself (0 to 3%, the muscle story up to 19%); the
  live simulations (flock, robots, pass) are compared only in explore mode.
- `node tools/engine/xrsame.mjs <before> <after> [--keys a,b] [--out dir]`: drives each story's headset code by hand
  (a pretend session: enter, recentre, place, point in nine directions, trigger, grip and carry, panel grip, end) and
  compares about 1,000 to 1,850 recorded values; nmd, endo and pet once more life size.
- `node tools/engine/panelsame.mjs <before> <after> [--keys a,b] [--out dir]`: draws the headset's main panel and footer
  at about 30 moments, tabs and scenes and compares signature, regions and pixels (its 'playing' moment may differ by
  itself).

## Story packages (`tools/packages/check.mjs`, `scan.mjs`)

- `node tools/packages/scan.mjs --check` (a cheap check): `packages/index.json` is current and no folder is left out.
- `node tools/packages/check.mjs packages/<key> [--build] [--load] [--phone] [--shots <dir>]`: the rules a package keeps
  (`tools/packages/SPEC.md`), one line per finding (`FAIL` or `warn`), then `packages/<key>: ok` or the count; exits 1 on a
  failure. Static: `story.json` field by field (as the scan), the key (its folder's name, not taken, not reserved),
  `main.js` registering its own key, and in every served `.js` (not `src/`), its code with the comments taken out: `new
  AudioContext` or `webkitAudioContext`, `new THREE.WebGLRenderer`, `location.href =`, `location.assign`,
  `location.replace`, `history.pushState`, `HOST.start(`, `buttons[4]`, `eval(` or `new Function(` (the engine's own
  `peek: src => eval(src)` excepted), and any string with an address on another origin (`http://`, `https://`, `ws://`,
  `wss://` with a host, or `//host`; XML namespaces on `www.w3.org` excepted); a file over 16 MB or the folder over 64 MB.
  Warns on `main.js` over 4 MB, no `README.md`, an `icon.png` not square or over 512 px or 200 KB, a file too deep to be
  listed, and (only with `--build`, which runs the author's own build script: read it first) a `main.js` that is not
  what its `src/build.mjs --check` makes. `--load` (it runs the package's code in a page: read it first too) (only when the static rules pass;
  Playwright with Chromium) serves the app with this package alone (an index made in memory, so the folder may be
  anywhere and `packages/index.json` need not be current), opens `#<key>` on a 960 x 600 page (and 390 x 844 with
  `--phone`), waits for `LOAD.done`, plays 3 s (the clock must move), pauses half way, opens explore mode, checks that
  `collab.apply(collab.state())` gives the same state back, and fails on any page error, console error, or a 4xx answer
  for one of the package's own files (the shell's own asks a plain server cannot answer, such as a relay's `api/ping`,
  are not counted). `--shots` keeps the story moment and explore mode. Run it on a package after building it; the
  example, `packages/hello`, passes it with `--load --phone`.

## Useful URL hashes and the console

Useful URL hashes: `#spatial&t=95` (open at that second of the timeline, paused),
`#proteins&explore&q=TP53` (explore mode with a search),
`#spatial&explore&tab=moves&move=nfkb&now=1`, `#lbi&t=140` (the tour at a
second), `#lbi&explore&scene=atp&view=network&now=1` (a scene with its controls),
`#lbi&explore&route=TP53,BRCA1`, `#nmd&explore&group=Cardiomyopathies`,
`#nmd&explore&pick=5:13,11:7` (endotypes, group:number), `#nmd&explore&walk=5` or
`&walk=TTN,DES`, `#nmd&explore&inside`, `#endo&explore&endo=2`, `#endo&explore&gene=COLQ`,
`#endo&explore&tab=method&step=1&k=20`, `#endo&explore&scene=syn&view=cleft`, `#endo&explore&inside`, `#pet&t=40`, `#pet&explore&tab=networks&net=C_high`, `#pet&explore&organ=muscle`,
`#pet&explore&scene=scan&view=ring`, `#pet&explore&life`, `#micro&t=100`,
`#micro&explore&organ=Ovary`, `#micro&explore&tab=age&age=70`, `#micro&explore&scene=atlas&view=volcano`, `#ovary&t=200`,
`#ovary&explore&kind=follicle`, `#ovary&explore&tab=age&age=60`, `#ovary&explore&scene=section&view=forest`, `#ovary&explore&scene=section&view=kinds&age=60`, `#ovary&explore&method=seg`, `#qubits&t=100`, `#qubits&explore&tab=network&net=blurred&cut=random&bits=2`,
`#qubits&explore&brick=X2X1&alg=so6`, `#qubits&explore&sum=10`, `#qubits&explore&tab=depth&ex=on`, `#qubits&explore&scene=pairs&view=hoods`,
`#mutation&t=100`, `#mutation&explore&tab=letters&mix=G` (or `mix=rule&time=0.45&reads=100`),
`#mutation&explore&tab=rule&model=even&start=C&time=0.8`, `#mutation&explore&tab=rule&view=steps&parent=T`,
`#mutation&explore&tab=tree&seed=3&speed=2&branch=5`, `#mutation&explore&tab=stem&src=live&w=20` (`&rebuild=2` its seed),
`#mutation&explore&scene=tree&view=up` (the tree's own cameras: `up`, `stand`, `crown`),
`#topo&t=100`, `#topo&explore&tab=patch&r=13.5&tower=on` (`tower=off`: the balls; `view=bars`: the barcode; `lit=loops`),
`#topo&explore&tab=cohort&dim=1&view=space&slide=17` (`dim=0`: pieces; `view=rack|space|held`),
`#topo&explore&tab=scales&dim=1&from=5&to=15` (`to=above`), `#topo&explore&tab=cells&cell=1234&r=4.8&delta=50`
(`show=map|split|genes|proteins`), `#topo&explore&scene=slide&mode=points`, `#topo&explore&scene=body&liver=slice`,
`#topo&explore&scene=tower&view=up` (the tower's own cameras: `up`, `stand`),
`#soil&t=100`, `#soil&explore&tab=field&date=4&show=chl` (`show=nh4|no3|n2o|ph`, `line=0|1`, `fert=0|1|2`, `view=jars`;
`plot=1` a group of plots, line * 3 + regime), `#soil&explore&tab=nitrogen&wheat=bni&dcd=on`,
`#soil&explore&tab=microbes&colour=guild&kind=215` (a kind by its number), `#soil&explore&tab=network&mod=3&rho=0.7`
(`&shuffle`, `&split=line|fert|random`), `#soil&explore&scene=web` (the globe and the hop; `&now=1` skips the glide),
`#pass&t=180&lang=de` (German), `#pass&explore&tab=fish&k=1&links=on&shark`, `#pass&explore&start=LHR&spread=high&cut=50&day=20&city=SYD`,
`#pass&explore&protein=CFTR&move=cf`, `#pass&explore&scene=globe&pillars=on`, `#flock&explore&view=afar&links=on&birds=400`
(`&hunt` sends a falcon), `#tutorial&t=60` (the guide on its markers; `&focus` the 3D alone),
`#tutorial&explore&net=badge&view=side` (practice; `&signal` sends a signal from the hub), `?nofvt#tutorial` (the plain
figure), `#robots&explore&rule=chain&robots=12&trails=on&links=on&view=low`
(`&crumbs` spills a pile, `&walk=1.5,1.2` walks you there), `#airports&repeat=all` (a kiosk that plays
every story in turn), `#airports&slides=on` (every story as a slideshow), `#anchor=on` (anchored headset placement), `#qubits&panels=controls` (that story's panels in the headset: only the foot bar), `#stories&net=home` (pretend to be on a network, without a relay: rooms on this network in tests),
`#design` (the design room's table), `#design&pick=lbi.atp&view=stage` (a prop on the stage, its card; `view=above`,
`view=group:pet` a story's plate, `&tab=all`, `&now`), `#studio` (the studio: the last scene used here, else the only
one, else the list), `#studio&scene=atelier` (a scene), `#studio&scenes=tools/studio/test/scenes&scene=textures&edit` (the textures test
scene: place its models to see the ladder and the cards), `&edit` (editing on), `&visit` (a visitor's kiosk: no editing
and no uploads at all), `&upload` (the Upload pane, where the relay's `/upload` sends people; `&relay=wss://...` with
it for a relay elsewhere), `&tab=scene|add|item|items|upload`, `&view=walk`, `&scenes=tools/studio/test/scenes&scene=walks` (the walkers, v164), `&scenes=tools/studio/test/scenes&scene=test`
(a static folder of scenes instead of the relay's: a relative path only), `&maxtex=2048` (the texture limit, 512 to
8,192; 4,096 by default). In the console,
`HOST.cur.peek('expression')` evaluates inside the current story
(e.g. `HOST.cur.peek('NET.P')`).

## From CLAUDE.md

These notes were in `CLAUDE.md` (Notes for Claude Code); they are kept here word for word, beside the area they belong to.

- When the test suites run (the owner, 7 November 2026: "only running when
  pushing to main makes sense for now"): the full suites (smoke, relay, shared
  rooms, and update, live, sound and room test where a change touches them)
  run only before `main` moves. A push to `dev` gets the cheap checks only:
  `node --check` on the changed files, the builds' `--check`,
  `node tools/packages/scan.mjs --check` and
  `node tools/release.mjs --check`; no smoke test or shared-room run, and a
  red result is not chased on `dev`. Every "run ... after touching" line below
  and in `AGENTS.md` names what goes into that release run. Why: running is
  free (CPU), but chasing red results costs tokens, and most were the tests'
  own or the machine's ("Working economically" in `AGENTS.md`).
- After any change to app files, bump `VERSION` in `sw.js`. After changing
  `sw.js` or how files load, run `tools/update.mjs` (see "`tools/update.mjs`" above).
