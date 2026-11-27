# History: why the rules are as they are

`AGENTS.md` and `docs/agents/*.md` say how the app works now. This file keeps what they no longer say: when things
came, what they replaced, and the owner's own words that explain why a rule exists. It is grouped by area, the same
areas as the detail files; within an area by topic. Nothing here is a rule by itself: where it disagrees with a detail
file, the detail file says what is current.

- The shell: loading, controllers, headset settings, focus mode, sound, occlusion, ships, live updates (`docs/agents/shell.md`).
- Shared rooms and the PC's trackers, with the history of every `FORMAT` bump (`docs/agents/shared-rooms.md`).
- The built stories (`docs/agents/stories.md`).
- The studio (`docs/agents/studio.md`).
- Testing (`docs/agents/testing.md`).

The longer retellings that were moved out of the detail files, word for word, are in `docs/history/<file>.md` (`testing.md`, `shell.md`,
`shared-rooms.md`, `studio-spec.md`, `specs/cdk5-superseded.md`); `docs/agents/layout.md` lists them.

## The shell (moved out of AGENTS.md, now docs/agents/shell.md)

### Loading
- 29 October 2026, the owner: "some rooms like 'the future' take a little time to load" (why stories load in steps).
- Until v102 the headset's loading card also had a ring with the share done on the left wrist, where the menu's clock sat.

### Controllers after standby (`HOST.inputsGuard`)
- v124; the owner, 8 November 2026: "sometimes after sleep the controllers cannot click on buttons and one has to open the quest menu and close it again".
- Until v130 the guard acted only from the session going hidden until a minute after it was visible again (the tests' pretend headsets swapped their sources by hand: nothing on a headset needed the window). Since v130 (the owner, 10 November 2026: "Sometimes the right controller cannot click after standby and only going quest menu and back lets it click again") at any time of the session. Pressed and not heard came in v130.

### Headset Stories screen, Repeat, Anchor, history entries
- The headset Stories screen's layout dates from v109; until v109 it had Repeat's buttons and the Anchor button; Sound check was a panel of it until v109.
- The back button on phones (`HOST.hist`) came in v109.
- `HOST.xr.request(mode)` in every story's `xrStart` since v119.
- VR asks for less: a Quest 3 left VR for its home at once with the full list (October 2026).

### Four headset settings
- The owner, October 2026: "the settings systemwide, with the default being that everything is 3D"; 29 October: "add subtitles in the headsets as a switchable option per room" (replaced on 26 November 2026, v215: "make subtitles per headset", then "add a room default for subtitles too": each headset's own, in a room its own choice over the room's default, never sent or stored and forgotten on rejoining; the Shared dialog's row sets the default, and a change of it takes every headset back to it); 30 October: "an independent switch for the small labels that are shown inside the 3d models and one for the larger ones like the play pause cards? the smaller models should be on top by default and the other ones should be 3d by default", and "the name tags go into the same category as the cards and are 3d by default, keep all choices 3d, on top, hidden for both".
- The labels moved to a new key (`xrLabels2`) in v100. The two sound switches came in v100.
- Frame rate read-out: v118 (the owner, 5 November 2026); double press of B or Y v119 (the owner, 6 November 2026: "Fps counter should start with a hotkey like double press b or y"). *NN fps of 90 Hz* since v136.
- Refresh rate: v136; the owner, 11 November 2026: "make sure that we get a good framerate everywhere, even in the lobby with only the stations visible i could not reach 90fps". Until v136 nothing asked for a rate, while the read-out painted 72 green. Foveation and Resolution rows' defaults are as before v136.
- Automatic quality: v145; the owner, 14 November 2026: "Do a performance review of this whole webxr app focused on getting high fps at all times". Auto off gives what was there before v145. The refresh rate first on every headset (90 to 72 Hz before foveation or resolution): v151; the owner, 16 November 2026: "fallback first to 72 fps before reducing resolution etc" (until then only a Quest 3S, a Quest 3 last).
- Real-world occlusion setting: v119.
- Your menu shown to your circle: v120; the owner, 6 November 2026: "the menu window of each person should optionally be visible for everyone so that i can explain it easier", then "menu shown to others in my circle". Same-bytes skip v121; people walking between circles moved `cver` until v136. v139 (the owner, 12 November 2026: "Menu sharing not working, i turn it on but the others in the same studio circle dont see it"; not reproduced: in `node tools/collab.mjs --menus` with `MENUS_STORY=studio` B draws A's menu at a studio circle) added the `toBlob` and `FileReader` timeouts, the `toDataURL` fallback and the note of who sees it.
- Moving with the sticks: v125; the owner, 8 November 2026: "Add Movement in vr mode, maybe with sticks, switchable by double pressing a stick?". Until v132 either stick's double click toggled it; since v132 the right stick's is the spaceship's; since v133 the right stick's press counts only at its middle while a ship flies. No page says `ownSticks` since v125.
- In a shared room, elsewhere: v128; the owner, 9 November 2026, after trying it: "should also work in shared rooms everywhere when the user is in vr and not in the same room".
- The studio's two stick modes: v125; the owner, 8 November 2026: "i want stick movement in studio mode too, just make it switchable with the double stick click so that i can switch between the two modes of stick operation in studio mode". Left stick only since v132.

### Focus mode, phones and tablets
- Focus mode: v106; the owner, 2 November 2026: "on a mobile device, phone as well as the ipad it needs less of the ui, maybe just a small bar and subtitles so the main focus is on the 3d models"; on by default there with a Text button to bring the panel back, each chapter's title shown briefly, explore's controls in a pull-up drawer. AR in its top bar since v109.
- Phones and tablets: v109; the owner, 3 November 2026: AR more prominent where a phone has it, a top bar that fits, the back button, "mobile browsers do not properly fullscreen", and "on iphone and ipad one goes back when they want to move the story timeline on the bottom".
- Phone AR menu: v125; the owner, 8 November 2026: "No access to menu in ar on android, make it one button on the top right".

### Panels per story, developer mode
- Panels per story: the owner, 29 October 2026: "i would want that for every story as an independent per story toggle maybe inside the clock menu". A and X play and pause nothing since v125.
- Developer mode: v125; the owner, 8 November 2026: "A box at the beginning of a session that tells me the most recent changes and what i should test, optionally enabled when in 'developer mode' a switch in the menu". `whatsnew/` history since v144.

### Sound
- Sound by mode: v124; the owner, 8 November 2026: "On mobile and desktop default to no sounds and no narration until manually enabled, in ar and vr default to sounds but no narration"; "narration in headsets should stay on when its turned on once".
- The page mute on by default since v109; the owner, November 2026: "Default to sound off in all modes" (kept for pages). The headset session's own mute off by default since v124. The Narration switch v100. Narration decoded only when audible v145. The studio's `OfflineAudioContext` exception v111; a voice recorded with a movement through `monoWav` v125.
- Sound effects: the owner, 29 October 2026: "nice sound effects to everything"; after phase 1: "sounds are fine, go on", and explore mode gets sounds too. Phase 1: the shell's own sounds and a quiet background per story. On by default since phase 2. v100 (the owner, 30 October 2026, after listening to every story's track): "remove the background hums, they are not good, i like the interaction feedback and the small woshes and beeps. make it so that we have a switch for sound effects and one for narration, both global in the clock menu and the shared menu on the desktop"; "flock and pass it on can keep their sounds as is, all other background noise can go"; "vacuum sounds keep". The machines' hum, `machine`, went in v100 with its four spans in the tour, the muscle, PET and mutation stories and its two explore-mode uses (ATP synthase's rotor, the PET scanner's ring). The calm tone, the robots' room tone and the soil story's wind went too.
- The narration in headsets: v124; the owner, 8 November 2026: "narration in headsets should stay on when its turned on once but should also have a global setting where i can turn it off or on for every headset in the room at once (each headset could still turn it on or off individually and this would then reset once the headset goes into the lobby". Studio emitters ignoring the switches since v111. Spaceships' sounds v132.

### Real-world occlusion
- v119; the owner, 6 November 2026: "also plan for adding the occlusions", "occlusion should be on by default".
- v124: until then depth sensing was paused while unused, and a Quest whose depth was paused from the session's first frame (setting *nothing*) never gave it back (the owner, 8 November 2026). `paused` in `state()` went in v124.
- After a sleep: v131; the owner, 10 November 2026: "Occlusion stops working after longer sleep in quest 3s? Maybe in 3 too, will test". Until then everything was decided once a session and nothing asked again; failures were silent. The state fields `lastDepthAt` and the rest came in v131.
- Merged room: v145 (a scan of 40 planes was 80 draws and 40 uniform sets a frame).
- The room scan no longer hides by default: v195; the owner, 24 November 2026: "Real world and people occlusions work fine in AR, but if there is a room scan it does not really occlude well usually, so can we make that room scan not occlude by default?". The default went from `'both'` to `'depth'` (the live depth alone), and the words with it: the live depth hides behind everything it sees, not only people, so *room and people* / *room* / *people* / *nothing* became *yes* / *yes, with the room scan* / *room scan only* / *nothing*, in that order. The keys (`xrOccl`, `#occl=`) stayed: `xrOccl` was only ever written when a person pressed the row or a link set it, so a headset that never chose follows the new default and one that chose keeps its choice; no migration. A studio scene's *Always* (`scene(true)`, the studio's `'both'`) became the depth alone for the same reason; `'both'` by name still works.
- Smooth edges: v195; the owner, 24 November 2026: "Occlusions have jagged edges, can we smooth them? Make that a switch in case it costs lots of performance?". The depth (320 x 320 an eye on a Quest 3) was read one texel a pixel, so every edge of a real thing was a staircase of texels. Option one of the design the owner agreed: four taps blended by hand (the session's texture may be an integer one that cannot be filtered linearly, and it is the session's own, set to nearest), mixed in metres since a window value is not linear; a tap with no depth makes the pixel take the nearest texel, so no depth is never blended into a real one. A switch, off by default, because its cost on a headset at 120 Hz was unknown; off keeps the old shader exactly. Not built: dithering, smoothing over time, soft fades.
- Smooth edges on by default: v196; the owner, 24 November 2026, after trying v195 in a Quest 3 in AR: "OK, the new settings work, so my defaults would be Real world hides: yes, and Smooth edges on. And that should be the defaults." *Real world hides: yes* (`depth`) was already the default; `xrOcclSmooth` is still written only when a person chooses, so a headset that never chose turns it on and a stored `off` stays off. `tools/perf.mjs` sets it explicitly in its occlusion scenes, so their numbers stay comparable with v195's.

### Developer notebook
- v142; the owner, 13 November 2026: "a developer notebook function where i can directly record some spoken audio in ar or vr and then it gets transcribed ... and i can also attach a screenshot ... the more direct the better"; "holding y or b to record".

### Sharp text (WebXR layers)
- v174; the owner, 20 November 2026, sharing the WebXR user-studies site's rendering lab (`web/lab/`, its *Composition
  layers* page): "the lab folder here includes a trick to make text supersharp in vr and ar on quest". The trick: the
  panel as a quad layer the compositor draws itself. Then "do it" to a switchable test in the shell for the story panel,
  off by default, all four values live in one session so the owner can compare on a Quest. Behind with a hole is the
  lab's (and three.js's webxr_vr_layers) pattern; in front is there in case the compositor ignores the eye buffer's alpha.
- v175; the owner, after trying v174 on a Quest: "the sharp text works, what are the different settings for? all of them
  do it so just use the cheapest one per default". *layer* became the default (under a new key, so devices left on *off*
  while testing start on it): the cheapest that keeps rays, dots and the menu over the panel (*in front* costs the same
  but covers them; *for text* adds the compositor's filter every frame), and a session makes only the two layers its
  value needs (v174 made four for comparing).
- v176, after a review of the default: on by default only in Quest Browser (its half extents are its own: a browser that
  follows the spec would show a quarter-size panel in a dark one); layers are the first thing the VR ladder drops; a
  failing layer puts its panel back and is retried; the notebook's pictures pause the layers for a moment. Left as it is:
  in AR a real hand in front of a panel behind the scene does not hide it (no fix with layers; the owner to decide).
- v177; the owner: "no sharp text is also important in ar, it is ok that it does not hide in that case, also make the
  menu use the sharp text feature". Kept on in AR; the headset menu became a third layer, behind the scene only (in
  front, the fallback, it would cover the Story tab's mirrors, the notices and the rays that point at it).
- Tried: the owner, 20 November 2026, after v177 on a Quest: "this works and does not cost a lot".

### Spaceships
- v132; the owner, 10 November 2026: "if we double click the right stick in ar or vr mode we get a little spaceship that we can control with the right controllers position in space, it is automatically going forward and the grip is brakes/reverse, trigger is shooting, each ship has a shield and health, shield fills up again, health does not, both get lower when hit, first shield then health, a is boost but that only lasts briefly"; steering "like a joystick is better since otherwise one could not fully turn", "new ship after 5s", ships seen by "everyone", practice targets alone "yes totally, maybe some ships that also fly around"; then "leave the drifting targets and the drones in when more join so players can also coop against them, also add some addons like additional boost and faster shooting for some times and reinforced shields pickups that spawn from time to time".
- Steering: v132 flew by the controller's tilt like a joystick (its roll turned, its pitch from the angle held at launch climbed and dived: in the history at v132); v133 (the owner, 11 November 2026: "please also add joystick controls for the ships, right joystick should control left right with left right and up down with up down", "the pitch of the up down should be reversed like in flightsim", "also remove the controller motion steering from the ships for now, its not working well anyway") moved it to the right stick and removed the Steering setting `xrShipSteer`. The right stick's press counting only at its middle came in v133.
- Loops: v134 let it loop (the owner: "the sticks should have more freedom so that one can do a looping": pitch a rate, bounced off floor and ceiling); v137 took it out (the owner, the same day: "Airplanes should not be able to do a looping after all, switch them back to how they were before"); in the history at v134.
- The arena: until v138 round where the pilot stood at launch, 5 m along the floor, turned back within 0.6 m of its edge and bounced at it; v132 to v138 the room scan's planes bounced it (`planesBounce`, with a bump). v139 (the owner, 12 November 2026: "Planes have a limited range from when i start them it feels, should be unlimited with enemies following around", then "the real walls also should not block them, they are unrealiable") removed the edge and the planes; the set follows the pilots since v139.
- v135: a bolt that a non-leader device said hit was lost before; a given pickup came back on such a device 3 s later; a headset back from its system menu took everyone for gone.
- v134, the owner: "ships and pickups have a black halo around glowing stuff in ar" (why `ADD` custom blending). Nothing see-through for the frame rate: v131. Performance pass: v145.

### Hot reload and live updates
- The owner said go, 29 October 2026. No swap in a session unless quiet: v145. In a shared room: v136. Until v111 `HOST.live` looked at the stories only, so a station of the design room asked every page and headset to update, and a page on its Stories screen reloaded itself.
- v193 (the owner, 23 November 2026: the CDK5 story's author should "just work on her story and do it on dev so she can
  directly see the results"): `tools/packages/publish.mjs`. A package-only change needs no new `VERSION` (the index's
  fingerprint reaches every page; checked headless), which also keeps her pushes from colliding with the maintainer's
  releases in `sw.js`, `version.json` and `whatsnew/`. The check found that a package fetched fresh lost its offline copy
  (`sw.js` kept it under its `&fresh=` address): fixed in the same release.

### Inside a story
- Focus mode's framing came in v106. Every story has a recording since v109.

### Shared engine parts (v168)
- The owner, 18 November 2026, on turning the stories into packages the studio can host and colleagues can write:
  collapse the code copied between the sixteen stories ("yes that makes sense"); older stories may take the newer
  engine's ways; colleagues' stories come in through git, each "all contained within a folder and independent from the
  rest of the app"; our own stories stay in git as they are, with a button to copy one to the relay to edit it there.
  Step 1 (v168): every built story's engine shares one version of each family in `tools/engine/`, with nothing meant to
  change in what a story shows.
- Step 2 (v169): story packages (`packages/<key>/`, `tools/packages/SPEC.md`, `docs/agents/packages.md`). Trusted code
  only, from the app's own folder (not a sandbox: the owner's "lab colleagues and people i trust, others can just host
  their own version"); their own cache, so a package changes without an app release; the example `hello` hidden. From
  the review: a package file is cached under its whole address with its version, so a slow network never answers a new
  address with an old file; the start waits for the packages' index only when the address names a package; the check
  runs a package's own build only when asked (`--build`), as it is a pull request's code.
- Step 3 (v170): arrangements, a story's copy on the relay retimed and rearranged (`tools/engine/SPEC.md`). The owner:
  stories stay in git, "a copy button to copy them to the relay and then edit"; "rearranging and timing etc, no logic";
  captions with live numbers. A copy is a relay scene (`{ studio: 1, story }`), so the relay needed no change; every edit
  names what it changed from and is dropped, never misapplied, when the story has changed. As built, a lengthened
  chapter plays longer and its narration line by line (the recording is the clock), a shortened one cuts lines.
- v171 (the owner: "each story folder could be removed without influencing any other parts"): the kit moved from the
  tour's folder to `tools/engine/kit.js`, so no story folder is a library of the others; `tools/release.mjs` writes
  `sw.js`'s story files (`SHELL`) and narrations (`AUDIO`) from `stories/list.js` and `audio/`, so a removed story can
  never leave a missing file in `SHELL` (one fails the whole offline install); the smoke test's stories come from the
  list, and `tools/collab.mjs` leaves out the rounds of stories no longer listed. Removing one of our stories is now its
  entry in `stories/list.js`, its files, the design room's props, the steps that test it by name, and a release.
- v185 to v187 (the owner, 23 November 2026: every story a story package "like the new ppicell"): the stories moved
  into `packages/<key>/` one commit each (`tools/packages/move.mjs`), the three hand-written ones wrapped as they were
  (v187), `STORY_LIST` left empty. v187's update test found a new page given the browser's old `stories/list.js` (ten
  minutes on GitHub Pages; a reload's memory cache), which named stories that had moved: `index.html` now loads it as
  `stories/list.js?v=<its fingerprint>`, stamped by `tools/release.mjs` like the shell's release. Shared sets stay with
  their owners and are read by path (the lean route; a shared library later).

- v202, the owner's headset notes of 25 November 2026 (Quest 3, Quest Browser 157). "In VR the texts are not sharp,
  neither the panels in the stories nor the menu. We should do the same trick as in AR": the VR ladder's `noLayers`,
  set by one VR session that closed by itself (or whose page went with it), had held for good and for AR too; now two
  in a row, VR only, an old drop forgotten once, and every session's request logged (`xr session`). "These corners look
  a bit glitchy ... change the outline of these cards so that it matches the top bar, or the top bar so that it matches
  the rounded corner": the headset cards' colour bar clipped to their outline. "Later should be the default and got it
  should be the greyed out button on the right so that it's actually an active step": What is new's buttons swapped.
  "Moving with the sticks ... make the left stick continuous instead of like in angles" (the turning stick): *Turn:
  smooth* (the default, up to 90 degrees a second) or *steps*.

## Shared rooms and the PC trackers (now docs/agents/shared-rooms.md)

Moved out of AGENTS.md (docs/agents/shared-rooms.md); the facts and the owner's words that explain why rules exist.

### FORMAT bumps (networks-10 to networks-61)

(FORMAT networks-10; networks-11 when the eighth story came, networks-12 the ninth, networks-13 the tenth, networks-14 the eleventh, networks-15 the twelfth, networks-16 the thirteenth, networks-17 when the PET story's `state()` lost its one-scan fields, networks-18 when its liver scene came back, networks-19 when the ovary story's charts went, networks-20 when the pass story's school got a shared place at a station, networks-21 when the fourteenth story came, networks-22 when the scene's and the panel's turn joined a station's place, networks-23 when the fifteenth story came, networks-24 when subtitles joined `look`, networks-25 when `near` and `rid`
came with rooms on this network, and `st.<id>.ui` with panels per story in the same round, and its `lock` when the
layout lock became two locks after the ten-headset test, networks-26 when moves by hand gained `ts` and `h` and the
explore view became `{ v, story }`, for motion smoothing, networks-27 when the two sound switches, `sfx` and `voice`,
and the cards' setting, `cards`, joined `look` in v100, networks-28 when the shell's own two kinds of circle came in v104:
an All stories circle `st.<id>` = `{ story: 'all' | <a story's key>, kind: 'all', sync, x, z, yaw }` and a lobby circle
`{ story: 'lobby', kind: 'lobby', x, z, yaw }`, with the room's key `allp` (`{ by, at }`: the first headset's All stories
circle placed), below; networks-29 when the room's first All stories circle became the room's arc in v109: `st.all01`
gains `arc` (`true` while it is the arc, `false` once it became a circle) and `allp` may carry `pg: 1` (the arc a page
made, not yet moved by a headset), and a room now starts with the arc, below; networks-30 when a studio sound could
follow an object or a bone in v112: a sound's record in the studio's `state()` gained `on`, `bone` and `o`; networks-31
when the studio's cut-outs came in v113: its `state()` gained a field per cut-out, `x.<id>`; networks-32 when the studio's
groups and Faces came in v114: its `state()` gained a field per group, `g.<id>`, and an object's record an optional
`faces`; networks-33 when the circles asked first came in v118: `look` gained `ask`, which an older device writing `look`
would drop, and in the same round a studio circle made for a scene its record's `sc: true`; networks-34 when the studio's
shapes, empties, locks and scene settings came in v119: its `state()` gained a field per shape, `p.<id>`, and per empty,
`e.<id>`, every item's and group's record an optional `locked`, a sound's `on` an empty or a shape too, and the scene's
`settings`; networks-35 when circles became asked first by default and the studio's items gained motions, recordings and
behaviours in v120: a room that never wrote `look`'s `ask` asks first, which an older device would walk into; the studio's
`state()` gained an optional `motion` on an object's, a shape's and an empty's record and, with the recorder, an optional
recorded `path` on those and on a sound's, and in the same round an optional `behaviour` on an object's, a shape's and an
empty's; networks-36 in v124: `look` gained `vg`, the generation of the room-wide narration (*On for all* / *Off for all*),
which an older device writing `look` would drop, and the studio's `state()` gained an optional `tex` on a cube's record
(the texture changes) and an optional `cutsLocked` on an object's; networks-37 in v125: the studio's `state()` gained an
optional `tint` and `bright` on an object's record, a recorded `path` kept as a file of the scene (`src`, `len`, `n` in
place of its keys) and, on a voice recorded with a movement, a sound's `sync`, `skip` and `len`; networks-38 in v126: the
room's key `trk` (the PC's trackers: "Vive trackers" below) and, from the studio in the same release, its records' `trk`
(an item following a tracker) and `puppet` (a Mixamo character worn with trackers); networks-39 in v127: the studio's
`state()` gained an optional `side` on a `follow` behaviour (Follow behind or at a side), which an older device would
drop; networks-40 in v128: the studio's `state()` gained an optional `face` on a `follow` and an `item` behaviour (which way
it faces: *Them* or *Where they look*, *The item* or *As placed*), which an older device would drop; networks-41 in v131:
the room's areas, a key each, `rp.<id>` (more tape crosses in one room: "Areas" below; an older device would take an
area's crosses for spots A and B and write the room's floor from them, moving everyone's origin), a frame published for
a shared space whose `m` may be an area's `{ k, a, b }`, `rm` gaining `t` (when spots A and B were taped) and `trk.m`
gaining `k`, `ra` and `rb`; networks-42 in v136: the studio's `state()` gained an optional `plays` on a cube's record (what
it starts as you walk in or out: "Trigger cubes that start things" under "The studio"), which an older device would drop;
networks-43 in v137: the studio's `state()` gained an optional `all` on a cube's record (a cube that works for everyone
here), an optional `shows` on an object's, a sound's, a shape's and an empty's (only in AR or only in VR) and a behaviour's
kind `wall` (things on the room's walls: "Cubes for everyone", "AR or VR only" and "Things on walls" under "The studio"),
which an older device would drop or refuse; networks-44 in v140: an optional `grab` on an object's and a shape's record
(anyone may move it without editing) and an optional `key` on a cube's (the item it reacts to): "Moved by anyone" and "Cubes
with a key" under "The studio"); networks-45 in v143: the studio's `state()` gained a field per screen, `v.<id>` (a video
or audio player with a playlist and its shared play state: "Screens" under "The studio"), which an older device ignores); networks-46 in v144: a field per painting, `d.<id>` (strokes drawn in the air:
"Paintings" under "The studio"), which an older device ignores); networks-47 in v146: the room's key `name` (a label for the room, `{ v, by, at }`: "Room names" below) and the studio's new state fields, `q.<id>` (a sequence), `qr.<id>` (its play state) and `pr.<id>` (an item's press stamp) and an optional `press` on an object's and a shape's record, which an older device ignores or drops); networks-48 in v153: the room's key `pcam` (the desktop preview camera's place, `{ p, q, fov, ts, by }` in room coordinates: "The desktop preview camera" below) and `pc: 1` in a camera's presence, which an older device ignores (it shows the preview camera as a phone's camera). networks-49 in v154: a studio cube's `show` and `hide` lists, a sequence's show and hide events and a press's show and hide entries may name another cube, switched off and on ("Cubes that switch cubes" under "The studio"); the records keep their shape, but an older device would keep the ids and let a switched-off cube act for its people (and, for a cube for everyone, start its runs for everyone).; networks-48 in v153: the room's key `pcam` (the desktop preview camera's place); networks-49 in v154: a trigger cube's show and hide lists may name other cubes; networks-50 in v156: a studio scene's settings may carry `grid: 'hidden'` (the floor grid hidden); networks-51 in v157: the studio's records may carry `send` entries (a cube's, a press record's, a sequence's) and a motion's `beat`, its state gains `sw.<id>` (an outside switch by the output page) and `bt` (the room's beat), and hello and presence gain `out` (the output page: "The output page (MIDI and OSC)" in `docs/agents/shared-rooms.md`); an older device would drop the new fields, write records back without them, or ignore an outside switch; networks-52 in v158: the studio's `stream` and `trail` fields, a path's `sync` and `beats`, a sequence's `beats` and its events `press` and `send`, the scene's `hands` and `bt.bar` ("The output page" in `docs/agents/shared-rooms.md`); networks-53 in v164: a studio object's `anim` may be `'move'` (*As it moves*, its clip following the distance it covers) with its optional `idle` and `strideK` ("As it moves" under "The studio"), which an older device would refuse (the record bad) or drop; networks-54 in v170: a station's key `st.<id>.arr` (`{ v, story, by, at }`: the copy of its story on the relay it runs, an arrangement: "A story's copy" in `docs/agents/shell.md`, `tools/engine/SPEC.md`), which an older device would ignore and play the story as its own; networks-55 in v172: a circle's record `st.<id>` may carry `ask: 'walk' | 'ask'`, its own way in beating the room's switch ("Circles asked first" in `docs/agents/shared-rooms.md`), which an older device would ignore and write back without networks-56 in v197: a studio shape's record may be `shape: 'goggles'` (the VR goggles, "VR goggles" under "The studio"; wearing them is each device's own, never in the state), which an older device took as a bad record and dropped. networks-57 in v205: the cell story's (*Back into the cell*, `ppicell`) `collab.state()` gains `cx` (a complex picked) and its cell's controls `sides` (carried, named only, none) and `cx` (the complexes on or off), its own `v` 3; an older device would ignore them and show the old judgement without sides. networks-58 in v207: the cell story's `collab.state()` gains `lim` (the Network tab's limits: `top` links drawn, `sup` the least support, `rel` the Atlas's reliability levels counted, `pls` the places counted, `grp` communities on or off), its own `v` 4; an older device would ignore it and draw the map without limits. A network chosen on a page (its own network) is never in the state: that device keeps the room's state of the built-in network for when it goes back. networks-59 in v208: the cell story's `collab.state()` gains `net` (the id of a network shared through the relay, `relay/nets.mjs`; absent for the built-in one), its own `v` 5; an older device would ignore it and keep drawing the built-in map. A network not shared stays out of the state as before. networks-60 in v214: the room's key `menus` (`{ full, by, at }`: the headsets' menus limited, the default and also when the key is absent, or full for everyone: "The headset's menu" in `docs/agents/shared-rooms.md`); an older device would ignore it and show every headset the full menu. networks-61 in v215: `look`'s `subs` becomes the room's default for subtitles, each headset's own choice over it never sent; an older device would take it as the room's setting and write it for everyone when it changed its own.

### All stories and Back to the lobby (v104)

(v104; the owner, 2 November 2026: "a circle with all stories that looks exactly
  like the single player story menu and that should be the default for new shared rooms in ar and vr, placed directly
  in front of the player ... one should also be able to place it in a shared space and then decide if it is in sync with
  the stories there or if it can run its own stories"; "a 'back to the lobby' circle where the headsets go back to the
  lobby")

### The room's arc (v109)

(v109; the owner, 3 November 2026: "Change it so that the room behaves like a shared version of the
    single player room and the players can move the story arc around by dragging it, change it to a circle once a player
    places the first other circle or arrange all";

### Lobby (v119)

The lobby with circles asked first: v119; the owner, 6 November 2026: "the lobby ring can go away too for now but in that one the headsets shall go to the lobby automatically".

### look defaults

`look` without `ask`: circles asked first since v120 (networks-35); walked into before.

### Room names (v146)

Room names: the owner, 15 November 2026: a room gets a name as a label; the three-letter code stays the address.

### Room setup guide (v107, v109, v122)

(v107; the owner, 2 November 2026: "a guided room setup and
  an alignment check, so a group can start a shared room from zero and know whether the headsets line up"; "make it so
  that we can run the touch the spot"; v109, 3 November: "just do the calibrated marks but make it part of the startup
  flow to check and make people check and calibrate if needed": two fixed spots are more accurate than two people
  touching controllers; v122, 7 November, floor spots: the two spots are tape crosses on the floor, which set the room's
  floor too, "The room's floor is under the marks" below). Nothing in how alignment works changed: `lineUp()`

### lineUp

Since v124 `R.reenter` (own spots' anchors not found after waking) no longer counts as not lined up.

### Check by eye (v119)

(v119; the owner, 6 November 2026: "At the beginning of every session and on wakeup etc we need an
    alignment flow where it shows the two marks and where it thinks they are in the room and ask the user to align again
    when they are not there"; "it should run anytime there could be misalignment";

### Check by eye: where the crosses are (v130)

(v130; the owner, 10 November 2026: "When asking people if they are aligned with the crosses, highlight the crosses
    and add some arrow or something that points towards where it believes they are so that they see better where they
    should be";

### Walk-in only (October 2026, after ten headsets)

(the owner, October
  2026: "the stories can only be visited by going to their circle"), and a
  story is left only by walking into another circle (the owner, 29 October
  2026, after ten headsets: "One should only exit a story when walking into a
  new circle, otherwise stay in the story even if they move away from the
  story's circle").

### Circles asked first (v118, v120)

(v118; the owner, 5 November 2026: "a switch for the circles so that they are only accessible by
  clicking a circle's card or the icon, then a dialogue asks if you want to go into that story, works better in tight
  rooms"; a room setting, walking in doing nothing, the story staying at its circle, a small panel with the story's title
  in its colour, Go in and Not now, gone after 10 s, the lobby the same).

### Circles asked first default

Until v120 circles asked first was off by default.

### Station ring and card

Ring and card: the owner, 31 October 2026: "Circles sollten ca 50 cm in der luft sein", "Circle card soll mittig ueber circle sein"; until v101 the card stood where the content floats, 1.4 m ahead.

### Station card (until v136, v137)

Until v136 it said the
  station's time and was drawn again and sent to the GPU whole, 560 x 330 with its mipmaps, every second for every
  playing station, all in one frame; v136 said *Playing* or *Paused at 1:03* and still drew it again whenever it was
  pointed at or carried.

### In a circle, icons only (v100)

(the owner, 30 October 2026, after v100: "Once
  inside a story hide the circles and show only the 3d icons, show circle once
  a person moves close to the 3d icon of that story"; from 29 October to v100
  it was the other way round, rings only):

### Own station

Own station hidden: the owner, 31 October 2026: "just hide it once i am inside, only show it if i turn on the show all rings in the menu".

### Camera mode (v124)

(v124; the owner, 8 November 2026: "Camera mode, where an android in ar mode is aligned with the room and
  then acts as a camera, i can just record the screen to see what people see in vr with the real world overlaid, would
  make sense combined with the follow feature to give people outside an option to see the things too";

### The desktop preview camera (v153)

The owner, 16 November 2026: "A preview cam on desktop that shows what people are doing inside the virtual world and that
i can move around so that i can place it in real space in the real position". Asked what it is for and how to place it,
the owner chose: mainly a screen for onlookers (a TV or a projector at an event showing what the people in headsets are
doing, from a fixed spot in the real room), placed first from a headset (hold a controller at the real spot, aim it,
press), then fine-tuned on the desktop (position, height, aim, field of view) with mouse and keys, the field of view
settable so it could match a real camera later (not built). Asked whether to build it, the owner: "build it but make it so
that it can be placed on desktop too": so it is placed from a computer alone as well (the room map, its typed numbers, the
mouse and keys), not only fine-tuned there. Built as camera mode's sibling (`CAM.pc`), so camera mode's rules for an
observer apply to it; it writes only its own place, `pcam` (FORMAT networks-48). Why a pretend headset session rather than
a camera of its own: the stories' shared hooks stay identical everywhere, so the camera goes through the same `HOST.xr.request`
and `xrAdopt` path as a headset, and shows exactly what a headset at a circle sees.

The owner, 16 November 2026, after trying it: "Preview cam needs options for continuous movement with wasd/ijkl or mouse ,
mouse catching and hiding, turn off labels". Read as (told to the owner): holding WASD moves the camera smoothly, holding
IJKL turns and tilts it, a click on the picture catches the mouse, which then turns and tilts the view, Esc lets it go;
the pointer hides with the buttons; a Labels switch turns labels off. So *Keys: smooth* became the default (a key held
moves it every frame, eased in and out over 0.25 s so a TV's picture never jerks; *Speed* slow, normal or fast), with
*Keys: steps* keeping the earlier step a press; the mouse caught by pointer lock; *Labels* and *Cards* on the camera
only (the headsets' Labels and Cards settings are the room's, so the camera's own switches never touch them; the story
panels already had *Panels*). Its writes while it moves stay rare (at most two a second and one as it stops), as every
move by hand in a room is written as it ends, not every frame.

### People's bodies and My body (v164)

The owner, 18 November 2026: "body with feet possible for everyone even just headset and controllers". After a
discussion of the ways to do it, the owner chose: our own solver now (`ik.js`'s `'head'` setup, written for the studio's
puppet, never used until then); Quest Browser's WebXR body tracking maybe later, after a probe on a headset, not now; a
mannequin made in code, "make sure the mannequin looks cool and cyberpunk"; your own legs when you look down "off by
default"; one release with the studio's walks.

Two designs were made and a judge compared their pictures: 'street armour' (opaque faceted plates over an undersuit,
both a deep shade of the person's colour, the colour itself in thick lights: a V visor, a crest, gems, a network emblem
on the chest) and 'light frame' (a figure drawn in lines of light). The judge picked street armour, with ideas from the
light frame folded in during its polish: a scan climbing the body every 5 s, circuit traces ending in pads, gem nodes at
the elbows and a spine of nodes down the back. Its solid, opaque shape reads across a room and over a lit AR room; the
light frame's thin lines flickered at a distance and vanished over passthrough.

Choices made building it: every body in one draw and their glows in one more (the owner's frame rate, as the people's
heads and hands were in five draws since v137), each person's bones in a row of a float texture; loaded on demand, as the
output page is, so phones never fetch it; a person's size from their standing eye height (a high percentile over half a
minute), so crouching bends the legs rather than shrinking them; Bodies: on / off this headset's own, beside People.
The design found that `ik.js`'s stepping hopped with straight legs at rest (a planted foot out of reach as soon as the
hips moved, so both feet were forced up together) and bent the mannequin's knees to hide it; the solver itself was fixed
(a step forced only when it would help, one foot at a time, the other landing sooner meanwhile), and the knees stayed a
little bent for longer steps and a stance. Looking down bent the whole back in the solver (the hips pushed 15 cm back and
your own feet out of your view): the chest now takes a tenth of the head's nod. Faster than a walk (the sticks), the feet
glide under the hips instead of stepping frantically.

The glows in AR (v194): the halo's draw used three.js's `AdditiveBlending` with its fragment's alpha 1, so each soft spot
added its whole square to the layer's alpha and showed as an opaque patch over the passthrough, black where the light
faded. The owner, 24 November 2026, in the tutorial in AR: "I think this should all be lights and maybe transparent ...
And they are not see-through. They have like a black ... it's like a billboard around it." The fix is the ships' v134
`ADD`: colour added, alpha kept (Zero, One), in `bodies.js`, so people's bodies, My body and the tutorial's guide all
have it; the tutorial's own additive trails, beads and ray got the same (with the source alpha, which carries their fade).

### Talk (v178)

The owner, 20 November 2026: "lets try open mic with mute row? yes talk only in relay rooms is ok for now", then "lets
go". So people in one shared room who are not in the same physical room talk to each other through the relay. Why it is
as it is:

- **Relay rooms only.** The relay already carries live sound's binary frames (v162) and knows every member's `here`;
  peer-to-peer rooms (a host page relaying every voice) and rooms on one device (nobody to talk to) were left for later.
- **Open mic with a Mic row**, not push to talk: no controller button is taken (A and X are the spaceship's boost, the
  sticks move you, the triggers point), and a voice gate keeps silence off the wire. *Mic: muted* closes the microphone
  and the stream, so a muted person holds no place under the cap of 8.
- **Off by default**, per device, never in the room's state: no microphone is opened until the person turns Talk on, and
  after a reload it opens by itself only where the browser already allows it and in the same room.
- **People here never hear each other through it**: they hear each other in the air, and speakers in one room would
  double every voice and feed back. The known limit (two separate groups both `here`; AR counts as here until *I am
  elsewhere*) was accepted for now.
- **The row is on the menu's Circles tab**, not Settings: the Settings tab had no room left (1,858 of 1,920 px), and the
  menu's quad layer (v177) is pinned at 720 x 1920.

### Two locks

Two locks: the owner, 29 October 2026: "one toggle for locking the circles' movement globally and one toggle per room for locking its panels and story elements"; a "room" there is a story's circle. The circles lock was the layout lock of v96.

### Menu watch

Until v102 a clock (watch) showed the time on the left wrist, and the loading ring sat there too; the owner, 1 November 2026: "Watch can be totally hidden now, not needed anymore if we can open the menu with stick click or double pinch".

### Limited and full menus (v214)

The owner, 26 November 2026: the headset menu showed event visitors everything, so two menus, limited and full, the
"limited menu (which should be the default in shared rooms)"; outside a room nothing changes. The room's switch
(`menus`) sits in the page's Shared dialog. Staff unlock one headset: "the staff unlock with two sticks pressed for 2
seconds sounds good". A secret gesture alone was dropped: a single stick click happens by accident (it opens the
menu), and the double clicks are taken (the left stick's moves you with the sticks, the right stick's launches the
spaceship), so the unlock is a deliberate hold that counts as nothing else, and it locks again by itself (another hold,
joining or leaving a room, the session's end, the headset taken off). It is kept nowhere and is not developer mode,
which keeps its meaning (the Debug tab's extra rows); developer mode's *What is new* does not open by itself over a
limited menu. What a headset shows by itself (the room setup guide, the check by eye with Calibrate behind *Not lined
up?*, the questions, *Getting around*) still comes; the first time in an empty room the menu no longer opens by itself
on a limited headset (it has no Arrange all).

### One send per change (v221)

Until v221 `publish()` sent a value again at every poll for as long as its acknowledgement had not come back, each time
with a new `cid`, and only the newest `cid`'s acknowledgement counted. On a slow page (frames over about 190 ms) the
acknowledgement of one send came after the next was out, so the re-sends never ended; when someone else then changed the
same station's explore state, a late re-send landed after theirs and the two pages merged each other's writes back and
forth (the whole suite on v220: pass and exposome "comes back the other way" failed). Suspected first, the relay's
corking and set log (c8aad49) were not the cause: the same failures came with v219's relay. Since v221 a value equal to
the one still pending is not sent again. Nothing is lost by that: on one socket the relay (or a peer-to-peer host, or a
room on this device) answers every set with its broadcast or a refusal naming the keys, a slow reader's socket is closed
rather than skipped, and every new socket's welcome clears what was pending and takes the room's values.

### Smaller files and memory only when it is used (v226, audit row J)

The audit found every page paying for what only some use. The studio's 2.33 MB file was 22% comments and carried a
model converter that only uploads use. v226 builds it without comments (licence lines kept) and in three files: the
core, `stories/studio-convert.js` (the FBX, OBJ, MTL, PLY, STL and TGA loaders, the exporter, the simplifier) and
`stories/studio-edit.js` (the page's arrows), each part checked against the core's build. The core is 1.47 MB, 429 KB
gzipped (39% less). The shell no longer loads the occlusion, spaceship and notebook files (190 KB) with every page:
`HOST.mods` fetches them when a headset session is asked for (earlier, in idle time, on a device that can enter VR),
when someone's ship is first heard, or with developer mode. The headset's canvases (a story's panel and foot, a card
per story on the Stories screen, `shared.js`'s menu, notices and subtitles) take their memory only at their first draw:
counted in headless Chromium after GC, airports held 27 canvases before and none after (about 51 MB had each been drawn:
width x height x 4 summed, a size, not measured memory; a browser may hold a canvas's pixels only once drawn, or on the
graphics card), the tour 53 MB and 2 MB the same way (its own two screen pictures); bytes before ready fell 184 KB on the
start page, airports and the tour (measured); the measured heap, ArrayBuffers and script time did not change beyond
noise, so the real saving is not known. A note left in the notebook's outbox while developer mode is off now waits until
developer mode is on again. The review round: the three modules are fetched as `<file>?v=<fp>` and run only when their
fingerprint is the one `tools/release.mjs` stamped (`MODS_FP`), a failed one is tried again 30 s on at the earliest, a
ship click while `ships.js` comes is answered once; the studio's comment strip reads `/` after `++` and `--` as division,
and every build proves each built file parses and is unchanged by a second strip. Left: the arrangement editor stays inline (its editor shares
its state with the copy's runtime that every station needs at a story's load); `ik.js` is still pasted into the studio;
`xrWarm` still compiles the headset's materials on every device; the example scenes' KTX2 textures (the generators
would need the Basis encoder in their pages; Bliss XP about 70 MB on the graphics card, 18 MB with KTX2).

Calibration (v226): from v218 to v225, alone in a fresh room in AR, Calibrate, spot A then spot B made both crosses and
their line vanish and the room stayed not lined up. The owner bisected it on the headset: v217 works, v218 does not.
The one hunk of v218 in the alignment path was the once-a-frame guard on `HOST.room`'s `update()` (`R.lastF`: a second
call with the same XRFrame skipped); v226 takes it out, so `update()` runs on every call again (the story's
`HOST.anchor.frame` and the shell's tick), as in v217. The rest of v218's savings stay. No pretend headset showed the
fault, so the fix rests on the bisect alone; `node tools/collab.mjs --calib` repeats the owner's steps headlessly and
guards those steps only, not the fault itself. The owner confirmed on 27 November 2026 that calibration works again on
v226.

The exposome's scene stuck to the head (after v226, 27 November 2026): from v212 (commit 01b57c2) the cloud's draw hook
(`points.onBeforeRender`) called `camera.getWorldDirection`. In a headset that camera is three.js r128's eye camera,
whose pose lives only in its matrix, so the call recomposed it from its unset position and turn and put both eyes at
the session's origin for everything drawn after the cloud, every frame: the scene, the controllers' rays and the
shell's read-outs stuck to the head. The owner reported it in AR and VR ("my virtual beams are way lower than the
hands and the exposome is stuck to my head"). The cloud now reads the direction from the camera's `matrixWorld`, and the
globe's probe its turn likewise; it shipped as a package change after v226, with no new `VERSION`, and a smoke step
gives every story's draw hooks an eye camera posed by its matrix alone. Untested in a headset.

### Loading late and holding less (v225, audit row I)

The audit found stories waiting at the load for things their first chapter does not need, keeping copies they never
read again, and working out the same layouts on every visit. v225, without changing what anyone sees (pixel hashes at
the opening and after seeks, compared with v224 headless) or any `state()` or `FORMAT`: Back into the cell no longer
fetches the crowd's four models, drawn only as balls (it also fetched the lenses' and sites' models after the load,
ready about 1.8 s sooner at 20 Mbit/s; the review round took that back: a seek, a room's jump or a link into those
chapters before the models came showed them without lenses or sites, with no loading card); the tour copies its DNA
meshes out of their builders' doubled capacity (it also dropped the JavaScript copies of its never-updated buffers
after upload, 77 to 56 MB; taken back likewise: three.js uploads them again from those arrays after a lost WebGL
context is restored, and emptied arrays drew nothing) and the body and tissue sets their staging arrays (micro 35 to
28 MB, PET 32 to 26, topo 25 to 22, ovary 33 to 30, soil 25 to 23 with its unseen tree cut to 1,000 nodes); the ovary
sections and the muscle heart make 40% and 25% less garbage while built. The cell map's layout (about 0.1 s, before
any loading card) and the quantum story's two load layouts (about 90 ms cold) are stored instead of solved (the cell's
by `packages/spatial/src/layout.mjs` in headless Chromium, because Node 22's and Chromium 158's `sin`, `cos` and
`pow` differ in the last digit and 380 relaxation steps turned that into up to 0.11 of the cell's radius; so a
browser with other maths made a slightly different cell before and now shows Chromium's). Each is used only while a
signature of its inputs matches; otherwise the page solves as before. Left: the exposome's `diseases.bin` (its ppi set
needs it while being built: Asthma's knot and view), the tour's sets built per chapter, PET's two bodies and liver,
ppicell's network built twice, the tour's 9,800-node interactome (about 20 structures from one seeded stream, used by
labels, cameras and explore: storing them is a set rewrite), the endotype layouts (measured: the net set's whole step
118 ms and the tree's 47 ms on a laptop, not the 1.3 s once noted) and airports' data as binary files (below the cut
of this release: see RUN.md row I).

### The stories' frame costs (v224, audit row F)

The audit found the stories doing work every frame that changed nothing (docs/agents/stories.md, "Shared engine
parts"). v224 cut it without changing what anyone sees, any `state()` or `FORMAT`. In the engine: a pointing ray that
has not moved, over a scene that has not changed, is not tested again (`pickMemo`; topo, soil, CDK5 and the muscle
tower, whose one pick cost up to 2.4 ms, now 0.01 to 0.02 ms asked again); something made after the load (a label,
a late mesh) is compiled with the scene's lights at once (`compileLate`: three.js r128 keys every program by the
light counts, so the label sprites were linked a second time in the middle of a story); a paused story on a page draws
nothing until something changes (`pageIdle`: topo, soil and CDK5 drew 8 to 25 frames a second with the main thread
fully busy, now one a second at 0.05 to 0.14 s of work a second; in story mode only, not in the flock, robots,
pass or tutorial, and after the review round it draws on for 2 s of frame time (summed dt, not the clock) after any change, as some sets ease on the frame's dt); labels read the panel's place before the frame
writes anything. By hand in airports, proteins and spatial (the same three; their paused pages 5, 25 and 11 renders a
second down to 1, the main thread's work 1.0 s a second down to 0.27, 0.06 and 0.12). Airports' closures slider
writes only the airports that changed and sends only the stretch of route flags they touch (a step was 0.45 ms and
813 KB, now 0.01 to 0.03 ms and 169 to 271 KB). Pass sends its hidden sets to the card before they show, as the other
built stories do (reasoned: the headless run never primes); the microanatomy story's organ models and the ovary's
sections have their programs linked and textures sent when built (their geometry still goes up at the first draw)
(micro at half way: four program links on the first frames, now one). The keep-clear sampler makes no array per point
or triangle (the same samples, bit for bit). Measured headless with a pretend headset; the gains on a Quest are
reasoned, not measured. Left for the load row (I): the keep-clear sampling itself (some 850 KB of garbage a frame
while it runs, about 0.5 s of work in the exposome story), ovary's stain and the muscle story's heart (build costs).

### The studio's frame costs (v223, audit row E)

The audit found the studio doing work every frame that changed nothing (docs/agents/studio.md, "Frame costs cut"). v223
cut it without changing what anyone sees, `layout.json`, the room's keys, `state()` or `FORMAT`: the scene's record kept as
one object while nothing in it changes, and turned into text by the shell only when it is new (or once a second); the
pane's signature built once a frame, its per-item part only on the Item and Items tabs (walking into a trigger cube on the
Scene tab: one full panel redraw and 4.9 MB sent before, none now); one whole-scene matrix walk fewer a frame on a page and
in a headset (`updateMatrix` calls 1,951 to 1,512 a frame viewing a 39-item scene); ghost faces culled to the view; the
trackers', screens' and texture swaps' checks only when the items change; the trackers' drawn pose without new arrays.
Measured headless with a pretend headset; the gains on a Quest are reasoned, not measured. Not done: `LOOKS.fill`'s walk
of the visible scene (measured 0.02 to 0.14 ms a frame; a registry of tags and lines would reorder the lines and hold
dropped ones), `placeSync`'s and `drawPreviews`' small allocations.

### A room's running costs (v222, audit row D)

The audit (docs/audit-2026-11) found a shared room doing work every frame or every 0.4 s that changed nothing. v222 cut
it without changing what anyone sees, the room's keys, any `state()` or `FORMAT` (docs/agents/shared-rooms.md, "A room's
running costs cut"). Measured headless, a page in a room while someone else carried a circle for 6 s (91 writes) with
seven other rooms kept on the device (about 60 KB each), over 9 s: local storage writes 13 (7.0 KB) to 1 (0.5 KB); reads
108 (6.4 MB) to 4 (none of a kept room); `JSON.parse` 208 calls (6.4 MB) to 103 (13 KB, the relay's messages); the
station list built again 91 times to 0; the circle and the kept copy ended at the same place in both. The people's pose
mix (`personMixer`) gives the same numbers as `MIX.person` (20,000 random cases) in 0.43 instead of 0.78 microseconds
and with about 50 times fewer garbage collections. Only reasoned, not measured (they need a headset session): the menu's
signature built at most 10 times a second instead of every frame, the subtitles' walk only when a cue's text changed,
the trackers' key read once per value, a pending write's text kept (the studio's whole scene record turned into text
once a poll instead of up to three times). Measured headless: bodies out of view not solved or
drawn (each a full IK solve and about 3,300 triangles per eye per person), 8.1 to 4.1 bodies a frame and 0.32 to 0.17 ms.
Sending a presence's fixed fields only on change was not done: the relay skips presence
when a socket is backed up (v220), so a change could be lost.

### Getting around (v124)

(v124; the owner, 8 November 2026: "a little popup toast at the beginning after alignment that tells
  people to click the rooms to enter in case its in click to enter mode and to move to them if its in that mode, also
  quickly explain the controllers, the button for clicking and the button for grabbing";

### Floor spots (v122)

(v122; the owner, 7 November 2026: "is it
  possible to make the floor also set by the two points for calibration? Meaning i would put these on the floor and that
  would be where the virtual floor sits too? Asking because the floor was off so many times now in various headsets",
  then "floor spots sounds good, lets try that"):

### Spot A height limit

A Quest whose floor put spot A 92 cm up was refused by v122's first 45 cm limit; the owner, 7 November 2026: "that was an error by the headset floor and exactly what i want to avoid".

### Marks lost after waking

Until v124 a notice and the panel asked to leave AR and enter it again after standby; the owner, 8 November 2026: "The leave ar message after standby or resume can go away, alignment nearly always good and has a check now too".

### Areas (v131)

; the owner, 10 November 2026,
  after trying v130's places: "Multiple rooms ... work in general, but rooms are not autojoined, there is a message about
  it after exiting ar and entering in a new room, i think i would prefer one room that can have multiple anchors so that
  people stay in the same one and there are just multiple spots where things can line up again"; asked, tape crosses in
  every area, measured once and shared by every headset)

### Places (v130)

; the
  owner, 10 November 2026: "Would it be possible to have multiple anchor points like the calibration points are now so
  that i can do multiple rooms and it aligns itself in each of them with the points?", then, of one shared room per
  physical room, "ok sounds good, lets start with a and also add an option to only use one anchor per room if possible
  for a max of 8 rooms")

### Places before v131 (v3)

Before v131: a place was a calibration made in a room, kept per room code: `localStorage` `roomFrames` = `{ v: 3, one, places:
    [{ code, rid, a, b, at, used, anchors, n, f }] }`, most recently used first (

### Anchor budget (v131)

The anchor budget replaced v130's setting *Anchors per room*; the owner, 10 November 2026: "two by default until 4 areas, then once a fifth area is opened the first only has one, then the second and so on".

### v130's Anchors per room setting

A place on
    one anchor is as v130's one-anchor places were: Before v131, Anchors per room (this headset's own, `roomFrames.one`; the Debug tab's *Anchors per room: two* / *one*, a note
    beside it): two (the default, the most accurate: at spot A and spot B, positions only) or one, at spot A, made turned
    about the vertical so its x axis lies level towards spot B (`yawTo`):

### v130 cap rule (placeCap)

Limits (`placeCap`): at most 8 saved anchors in all places together (Meta
    documents 8 per site; one Quest 3 refused a 9th), less one while `HOST.anchor` keeps a placement of its own (Anchor:
    on): 4 rooms with two anchors, 8 (7) with one. A calibration that would pass it drops the places used least
    recently, their anchors deleted, with a notice naming them (*Older places dropped*, log `places dropped`).

### Others' moves, smooth

(the owner, 30 October 2026: "can you interpolate movements that others are doing in
  multiplayer to smooth them out? like i was standing inside a large network and my colleague spun that and it was a
  bit jerky on my side"; then "make it smooth").

### The test place (v116)

The test place (v116; the owner, 5 November 2026: "the main page will stay on
  github pages, deployed from main and works as it always worked and i will add the
  dev branch with a hook to the app1 on coolify that is at stories.lab.lbi-netmed.com
  and saves models to cloudflare r2", and the main site "does not need a hosted relay
  for now ... a good place to test the peer to peer functionality"; `relay/README.md`,
  "The test place on Coolify"):

### Relay hosting

HOME_RELAY was empty from v116 to v119 (the main site's rooms peer to peer). Branch `main` on Coolify as the main site's relay since v120 (the owner, 6 November 2026). v114 and v115 had planned the main site on Coolify and a test copy on Pages (v115 only reached `dev`).

### Updating a room

`FORMAT` changed in 12 of the 24 releases from v112 to v131.

### Reload order grace

Review of v136: all were refused 3 s after the first newcomer, and a device whose turn came later reloaded at once on a page or was asked in a headset mid-countdown, losing the stagger; hence `ORDER_GRACE`.

### Relay password (v110)

(v110; the owner, 3 November 2026: "i would like to add a
  secret to the relay like how this project does it: menchelab/asdf10k-collab-backend
  ... like one word like networksofthefuture2037 that i can use and enter on each
  client if i want it to be able to use the relay, no other way to use it"):

### Studio scenes on the relay (v111)

Studio scenes on the relay: the owner, 3 November 2026: "the relay idea sounds good, then i can run a relay and serve the fbx and glb files from that and also save the json files directly".

### Scenes in R2 (v114)

Scenes in R2: the owner, 5 November 2026: "we have the coolify server going on hetzner so i guess i will use that and the r2, also implement the r2 things right away".

### Tried on headsets

Tried on two Quest 3 headsets in one room several times: in phase 0 neither the
shared space nor the calibration lined them up; the relay's logs of the second
test led to the rules above (own marks win, the floor from the marks); with
both on one Quest Browser version the shared space lined them up, but one was
offset after standby, and one of two after a night's standby (the rules for
waking above); later the two headsets each kept their own copy of the shared
space, and even at a fresh address (`s/<n>/`) the second joined the first's id
8 to 13 m off, while the tape calibrations, found again from their anchors
after a night, lined them up. Not confirmed on headsets yet: whether they line up again after
standby (and a night) now, whether asking for the shared space again (Re-align,
or 15 s after waking) joins the others' space,
how a scene moved, resized or turned at a station looks for the others, people's
name tags in each cards mode, the story panels in 3D in the life-size and
stand-inside views (the labels, the story panels and the station cards in 3D,
hidden, and the grip moving and turning scenes and panels, alone and at a
station, were checked on a Quest 3, 28 October 2026, as one setting; labels and
cards as two independent ones, labels on top by default, are untested there),
persistent anchors restored (one headset's handles were refused; the log now
says why), whether a recentre fires a reset, sound zones heard, comfort and
frame rate with presence drawn, and whether the socket keeps running inside an
immersive session. Peer to peer on real devices (the owner, 29 October 2026):
two laptops found each other on a local network with the test page `p2p/`, and
two laptops were in one peer-to-peer room; not yet tried: headsets and phones in
such a room, links inside VR and AR, a host change and a headset's hand-over at
an event, and how long PeerJS's public server keeps a sleeping host's id. Ten
headsets (the owner, 29 October 2026, main v96 through a local relay on the
owner's computer and one router on site): "everything worked very well"; the
changes it asked for (stay in your story out of its circle, rings only in a
circle with a card on pointing, two locks, people at your circle only) are
untested on headsets: how a ring's card reads when pointed at, the story and its
narration heard from out of the circle, the locks and the People toggle in use.

## The built stories (moved from AGENTS.md, now docs/agents/stories.md)

### The muscle story
- The authors' analysis files were removed from the repository on 3 November 2026 (`ikerdata/` in its history).

### Build budget (v136)
- The sweep found 5 to 10 ms of building a frame in the first seconds of the ovary, microanatomy, muscle and endotype stories, each hidden set taking 3 or 4 ms and two at a time; hence the shared budget. Before v136 the jobs ran 5 to 15 ms between yields.

### The PET story
- The vision row as 3D organ models since v104 (the owner's wish: "way more 3d", "better colors").
- The paper's networks as 3D models since v107 (the owner, 2 November 2026: "the network scene not yet, also should all be the same in explore mode").
- October 2026: the one-scan network, index, survival and immunotherapy results were taken out (they did not match the poster), with the `people` set and explore's One scan and People tabs; the explore-only `liver` scene went too and came back the same day; the Network chapter's matrix of all scans and scatter plot went.
- 28 October 2026, after the owner's notes: the last chapter (Vision: the row again, prognosis and medication) went; the second chapter became "How PET sees"; organ labels became names only; the AI became "segmentation algorithms".
- Explore's hand-over: the owner, 1 November 2026: "better hide the scanner, rotate the body, fade out the organs and then show the sugar thing ... the explore mode does not do the same"; back: "play reverse".

### The aging ovary story
- v105: the age histogram became twenty towers of slides on the floor in an arc (the owner: the flat one was "hard to see").
- October 2026, the owner's rule against 2D graphs: the Agree? chapter, explore's Charts scene and the illustrative dots went.
- v105: one model out before the next comes in (the owner, 2 November 2026: "two 3d models exactly overlapping which leads to z fighting inside the headsets").
- v107: no depth written while a set fades (the owner: "ovary section and more still overlaps on transitions").

### The mutation machine
- The author's answers on the turn and the wording of the result date from 27 October 2026.

### Tissue topology, qubits, mutation (v136)
- The sweep found the tower re-sending 630 KB of instance buffers a frame (31 calls) even paused, and the qubits and mutation stories' pools their whole buffers every frame; hence `upload` sending only what changed.
- The owner on topocyte: "use the topocyte code for all calculations" (kept inline as the reason).

### The soil story
- Permission from the authors, through the owner, 29 October 2026.
- 11:03 as narrated since v109.

### The pass story
- The school's height, the grip and the new shark were checked on a Quest 3 in October 2026.
- Up to four sharks: the owner, 31 October and 1 November 2026, after a test with headsets: "if be the shark is on on one player the shark should be shared for all of them"; one or several: "ok lets make it 4".

### The flock
- Up to four falcons: the owner, 1 November 2026: "yes also make it 4 falcons".
- Bird by bird: the owner, the same day: the birds shared exactly too.

### The robot gang
- v136: the cleaned floor sent as boxes, every 0.4 s in a headset.

### The tutorial (v173)
- The owner's decisions, November 2026 (`tools/tutorial/SPEC.md`): only the robot (no robot vacuums); AR and VR first,
  the page done differently later (for now it must load and run, with a notice); its moves and words are written by
  Claude and the credits say so; the stories' synthetic voice (Kokoro `af_heart`); British English; sound only through
  `HOST.audio.fx` with existing `SFX_LIB` sounds, no hum or background.
- First in the list, as an introduction (`intro: true`): the Stories screen is where a newcomer lands, and its first card
  is the one people try first; the shell skips it for the default start, Repeat all and the count, so "sixteen stories"
  stays true. v180 moved it to the last card (the owner, 20 November 2026: "Move the tutorial to the last story card"),
  its kicker *Introduction* in place of *Start here*; the three skips hold wherever it stands.
- `FORMAT` stayed `networks-55`: no room key and no existing story's state changed shape (the sixteenth story came
  without a bump too; a station whose story a device does not know is shown as *Not on this device*).

### Back into the cell: your own network (v207)
- The owner, 25 November 2026: "make this an interactive app where one can upload their own PPI, select limits etc,
  live control them even"; decided to wait until the sides and complexes were done, then built in stages: (1) the
  method in the page with live limits on the built-in map, (2) a network of one's own chosen on a page, (3) live
  control in a room through the relay (v208, below).
- The told story must not change: at every limit's default the cell is v205's, the generator's communities and layout
  (checked by hash against v206's page), and the page's own communities (the generator's method ported to the last
  tie) take over only when a limit moves. Everything new is explore mode's *Network* tab.
- A chosen network stays in the browser (privacy): no fetch but the package's own files, never in `state()`, the
  address, a log or a note; kept only on *Keep on this device*. In a room it is that device's alone, and the room's
  state is kept for the way back (`X.bi`), so applying a room's state never throws on it.

### Back into the cell: shared networks (v208)
- Stage 3 of the owner's wish: "someone at a laptop changes the limits, headsets see the cell change; a headset takes the
  network through the relay". The limits were the station's since v207; two pages showed they hold (nothing fixed).
- A network leaves the browser only on its owner's press (*Share with this room*, *Put on the relay*), with a sentence
  saying where it goes and who can read it, and only as what was read (symbols, links, kinds, scores, the file's name).
- Its own small store on the relay (`relay/nets.mjs`), not a story's copy: copies are the owner's scenes, named and saved
  with the password, and hold a timeline's arrangement, not data. Beside the notes' store and by its rules (folder or R2,
  off on a public relay without a password, a limit per address under `--public`). Addressed by a hash of its content,
  so the same network is one id and nothing can overwrite another.
- A device that cannot have the station's network keeps the room's state as it came (`SNET.pend`) and shows the built-in
  network: sending its own state back would have taken the whole room off the shared network.
- The limit (250,000 links, 12 MB as sent) from measuring the built-in map as pairs and 250,000 links headless.

### The design room
- The owner, 29 October 2026: "the design room as a room where we have a table with the low poly versions of all props".
- v136, few draws: the sweep found 235 draws an eye and 5.4 ms of script a frame, a mesh per material of every miniature.
- v217, parked: the owner, 26 November 2026: "remove the whole design room for now". Out of the app (no `STORY_EXTRA`
  entry, not precached or served, not built by `tools/engine/all.mjs`, its tests gone), its sources kept in `tools/design/`
  (its `README.md` says how to bring it back). `FORMAT` unchanged: no key or `state()` changed shape, only a station kind
  stopped being offered; an old room's design station shows as *Not on this device*.

## The studio (moved out of AGENTS.md, now docs/agents/studio.md)

### The studio
- The studio came in v111.
- The owner, 3 November 2026: "i actually need a room where i can place some fbx or other format files in a folder and then i have textured objects, in some case with animations and then i can place them and somehow save where they are placed ... and i also need semi-transparent trigger cubes that i can use to let the 3d objects appear and disapear depending on where the user goes"; then "also add some spatial audio emitters and let me hide and show multiple objects with each trigger cube".

### GLB first
- The owner, 4 November 2026: "maybe we should work with these and use a converter like you mentioned glb better than fbx and we can just convert it".

### Textures
- The owner, 4 November 2026: "it needs a way to add textures to models in case they are missing, preferably with autoassign and direct convert to good formats".

### Texture size, compressed textures and three.js r128 (v150, v151)
- The owner, 16 November 2026: "Why max 2k texture for quest? Can we compress somehow to get more? Is this a hard limit?
  In unity i also uses 4k and 8k and it worked, what is different in unity and how could we match it?" The 2,048 px cap
  was a memory choice, not a hard limit: a texture sits in the GPU uncompressed (RGBA, 4 bytes a pixel plus a third for
  mips: 8k is about 341 MB), while Unity ships ASTC, which a Quest's GPU reads compressed (8k about 85 MB).
- "add the debug lines so i can check": v150's Debug tab lines (*Textures: at most ... · compressed: ...*, the GPU's name on
  the Browser line). The owner then read on the Quest 3: Adreno 740, at most 8,192 px, ASTC, ETC1 and ETC2.
- "yes build it, encoding in browser since that can be done on a desktop and be fast?": v151, Basis UASTC in KTX2,
  encoded in the page on a laptop or desktop (workers, strips under the encoder's 12.6 million texel limit), loaded as
  ASTC 4x4 through three.js r133's plain-script KTX2Loader on our r128 (r133 to r143 ship one; r144 on have none, and
  r143's needs `Data3DTexture`, which r128 lacks). Headsets never encode.
- "why not update the three.js if newer versions support it?" (the same day): not needed for compressed textures (the
  r133 loader runs on r128), and an upgrade is not a drop-in: the plain-script builds and `examples/js` went (r148 to
  r161: the app would become ES modules), colour management and `colorSpace` (r152), shader chunks (r154) and physically
  correct lights (r155) change how every story looks and must be tuned again, WebGL 1 went (r163), and WebXR changed
  (r170, r187). So r128 stays until there is a reason worth a pass over all sixteen stories, the design room and the
  studio.

### The upload page
- The owner, 4 November 2026: "the relay should offer an upload page where everything gets converted into the right formats directly and then sorted into a folder if possible".
- v127, the owner, 9 November 2026: "add option to remove items from upload list before uploading, one slider for all models reduction when uploading" (the × per row and *Triangles kept, every model*).

### Fewer triangles and Change texture
- v119; the owner, 6 November 2026: "models need to be way less triangles", "needs a percentage and should be adjustable per model with a preview", "20 percent by default for everything", "preview in ar/vr would really be helpful", and "a change texture button on models placed in the scene".
- Until v125 the Upload pane's Preview showed a small picture of both side by side; since v125 it opens the viewer.

### The fill
- v120; the owner, 6 November 2026: "The reduction works really well but leaves black artifacts in the textured models ... maybe just needs changes to the texture like adding fade out color around all tiles".

### The viewer
- v125; the owner, 8 November 2026: "Studio uploader needs better preview, also for the reductions, can use the whole viewport, show the model and be able to spin it etc".

### Pictures in the Add pane
- v120; the owner, 6 November 2026: "Models in add dialogue should have preview images and show in a grid ... 3d preview? overkill?", then "add pane with pictures sounds good, leave 3d models for now".

### layout.json
- Fields by release: `tex` and `cutsLocked` v124; `tint`, `bright`, a sound's `sync`, `skip`, `len` and a recording kept as a file v125; `trk` and `puppet` v126; `plays` v136; `all`, `shows` and the `wall` behaviour v137. A layout without `cuts` (v112's), `groups` (v113's), `settings` (v118's), `behaviour` or `motion` (v119's) reads as before. Until v124 a station's scene frame was the circle's spot; since v125 the room's frame.

### Trigger cubes
- v117: before, a `stay` cube walked into again counted only the first time, so with a `stay` cube showing an item and another hiding it the item stayed hidden after the first round (the owner's report of 5 November 2026). v119: away from its station in a room nothing is shown.
- v131: cubes drawn as edges only while editing (no walls); until v130 a model a cube hides from you was drawn faint, at 0.3.

### Cubes for everyone
- v137; the owner, 11 November 2026: "Trigger cube starts are each person's own, the same as how cubes already show and hide things. THIS MIGHT NEED A SWITCH FOR BOTH OPTIONS if possible, so it should also be possible to have a cube that triggers things for everyone in the same studio scene".

### Cubes that switch cubes
- v154; the owner, 16 November 2026: "can triggercubes now be disabled by other trigger cubes? can they also be disabled as part
  of a group?" Told that neither worked yet (a cube's pick skipped other cubes, a group's pick left its cubes out, sequences
  and presses could not show or hide a cube), asked "Trigger cubes switching other trigger cubes off and on (from a cube's
  hide/show lists, a whole group's cubes at once, and from sequences and press reactions): build it now?", they answered
  "Yes, build it". To "If you are standing inside a cube when another cube switches it off, what should happen to what that
  cube was doing for you?" they chose "As if you left": its while-inside effects end at once (items it showed hide again,
  loops come off); things it made stay from then on stay. Until v153 a click on a cube while picking selected it (ending
  the pick), and a cube in a group of cubes alone did the same. FORMAT networks-49.
- The floor grid and a camera's view of the studio: v156; the owner, 16 November 2026: "looks like edit mode is on in the
  desktop cam view in a studio scene, if easy please turn that off, also add an option to hide the blue studio floor grid
  for a studio scene". A camera (camera mode, the desktop preview camera) never shows editing; a scene's settings gained
  *Floor grid: Shown / Hidden*, written only when hidden. FORMAT networks-50.
- The output page, MIDI and OSC: v157; the owner, 16 November 2026, asked to send and receive MIDI and OSC from the shared
  rooms and the studio, and answered the questions put to them: whether a trigger cube sends by itself, "make it opt in by
  default and say who entered" (a cube sends only when its card's *Sends to the output page* is on, and the message
  names the person: the one exception to "what a cube reveals is never sent", and only the fact of walking in or out);
  MIDI or OSC, "both"; which ways, "in and out"; where it runs, "output page and then midi or local relay for osc and
  trackers i guess?" (a page of the app on a laptop or the room's PC running the studio scene itself, Web MIDI there, OSC
  on UDP through a relay on that machine or network, `--osc-out`, `--osc-in`, which also sends the trackers as OSC).
  It builds the "Cardinal on a laptop" item the owner had parked in the maybe-later list the same day. The scene's own
  sends are kept in `layout.json`; streams and incoming mappings on the output page's machine. FORMAT networks-51.

### Moved by anyone
- v140; the owner, 13 November 2026: "possibility to have objects that people can move in studio non edit mode".

### Cubes with a key
- v140; the owner, 13 November 2026: "trigger cubes that react to a specific item like a key".

### Screens
- v143; the owner, 14 November 2026: "a video/audio player with playlist and an option to show controls even outside studio mode that can playback video or audio files from the relay".

### Paintings
- v144; the owner, 14 November 2026: "Paint mode in studio mode, optionally with brushes and a spraycan".

### The room scan
- v141; the owner, 13 November 2026: "Possible to use the quest for scanning? That would also be perfect for setting up a new room with a scan directly inside the headset".

### AR or VR only
- Came in v137, for the Bliss XP room.

### Trigger cubes that change textures
- v124; the owner, 8 November 2026: "trigger cube replace texture mode so that it can replace a texture on a model in the scene", then "no crossfade needed".

### Trigger cubes that start things
- v136; the owner, 11 November 2026: "Trigger cube should also be able to trigger things like an animation or a soundfile being played on a character or prop".

### Sounds that follow a model
- The owner, 4 November 2026: "also sound should follow a model, sometimes i might also want to select bones like the head for voice, breast for sounds she makes while moving etc". Shared as its record from v112 (FORMAT networks-30). Shapes and empties as targets since v119.

### Cut-outs
- The owner, 4 November 2026: "is it possible to remove parts of a glb model nondestructive? like a door in a wall etc?", then "for the models i would just do parts that are hidden, which i can draw on the models or remove with boolean ops like a cube, whatever is easier".
- v125; the owner, 8 November 2026: "Framerate bad in studio edit mode when cutouts are active, they should not have this transparency": its faint fill went (a layer the size of the box on screen, two seen from outside). v131: lines, ticks and corners opaque too.
- Lock cut-outs, v124; the owner, 8 November 2026: "add cutout lock mode where the cutouts for an object are locked and cannot be moved anymore, cutout boxes should be hidden then but show again if it is unlocked".
- Cut-outs came in v113 (FORMAT networks-31).

### Groups
- The owner, 5 November 2026: "grouping things (models, sounds, etc) in studio mode so that they move together". Shapes and empties as members since v119; the group's box opaque since v131. Before the pivot was the mean of the members' middles, the middle of their box shifted after a turn that was not a quarter, and the next turn hopped. Groups came in v114 (FORMAT networks-32).

### Faces
- The owner, 5 November 2026: "double sided and flip inside out settings per model?".

### Tint and brightness
- v125; the owner, 8 November 2026: "Studio: add tinting and brightness for models placed in the scene".

### The colour picker
- v146; the owner, 15 November 2026.

### Sequences
- v146; the owner, 15 November 2026: "A kind of timeline that can playback animations, show items, hide them, play audiofiles on items, etc".

### Press and hover
- v146; the owner, 15 November 2026: "press an item (anyone, visitors too, editing off too) ... plus 'only while pointed at' (hover) reactions".

### Shapes, empties, locks, settings, lobby
- v119; the owner, 6 November 2026: "Needs invisible occlusion cubes and other primitives to hide things and just in general"; "Needs empty objects for example to place sounds in space"; "an option to lock things in space so we cannot accidentally move them"; "an option to hide all other icons and circles in studio mode". v131: a shape that hides things drawn as edges only, no fill.

### Locked in place
- v128, the owner, 9 November 2026: "move the locked toggle all the way to the top"; until then it sat by Duplicate and Delete.

### Behaviours
- v120; the owner, 6 November 2026: "Add follow the player/avoid the player/an object etc to objects", then "behaviours should be shared for each headset so only react to one headset, example closest or first player who walks close". v127 (FORMAT networks-39), the owner: "follow mode should also be able to be behind someone", "left right sounds good too" (`side`). v128 (FORMAT networks-40), the owner, 9 November 2026: "when a model is in follow there should be a switch to look at the person or item it is following instead of into the same direction as the person" (`face`). v137: the `wall` kind.

### Things on walls
- v137; the owner, 11 November 2026, of a room built as a studio scene: its elements "dynamisch auf detected walls", "losgelöst und auf raum gemappt", and "it may need to be reactive and react to user movements, where the user goes, instead of a static variant".

### Motions
- v120; the owner, 6 November 2026: "Add little animations like spin and wobble etc for models?", then "animations do 1 and 2" (1 simple motions, 2 the recorder, curves later). Since v122 a motion goes on while selected (before, it rested while selected).

### Recorded paths
- v120; the owner, 6 November 2026: "just animate objects by dragging them? Animation recorder?", then "animations do 1 and 2". v122: a path plays on while selected; *Play it here* (`STU.recPlay`) went, *Start again* took its place. v128: a path's timeline.

### Ten minutes, as a file
- v125; the owner, 8 November 2026: "Add voice recording option to the motion recorder, make length up to ten minutes possible?".

### A voice with the movement
- Came in v125.

### Stays on the floor
- v130; the owner, 10 November 2026: "When animating an item have an option that keeps it grounded, stuck to the floor with the side thats closest to the floor when starting".

### The ghost, Pause and placing what moves
- v122; the owner, 7 November 2026: "when selecting animations on the item motion tab they should also show on the item as a preview"; "to make placing easier add a pause motion button but i also want to be able to move moving/animated items to select their exact place". v124 (the owner, 8 November 2026: "in edit mode Ghosts should always be visible for animated things"): every item that moves while editing has its ghost. v125 (the owner: "I do not see the ghosts of moving things in studio mode"): a model its own clip moves too. v129: its parts taken in their rest pose and put back, never through the mixer (with its clip standing still three.js's mixer wrote nothing back and left the model in its rest pose). v131 (the owner, 10 November 2026: "ghosts for example can just be a light gray"; of clip ghosts: "outline box is fine, just make sure it has no transparent walls"): opaque light grey; until v130 pale blue-white at 0.25, no depth written. The recording's ghost, the owner: "when animating a 'ghost' of the model should stay in the initial place so that one can hit it again for better loops, these loops could then even autosmooth if the start and the end are close".

### A model's timeline
- v127; the owner, 9 November 2026: "items that have an animation should show a timeline and play pause in edit mode when selected", "play and pause for everyone in the circle", "pause and scrubbing is temporary"; v128, after trying it: "please add timeline and play pause also for recorded items", of a 1.3 s clip in a headset "i could not see a timeline" (the path timeline and the headset's bar came in v128).

### As it moves (clip by distance)
- v164; the owner, 18 November 2026, of characters that walk about a scene: "would also need feet solver for npcs that
  move around?". Of the options discussed, the owner chose "clip by distance" first: the clip's time follows the
  distance covered, one cycle a stride, standing still when it stops. Foot locking (each foot pinned while the clip has it on the ground) maybe later,
  on top of it; the stride is measured from the clip so that the feet slide as little as a clip alone allows.

### Nothing see-through while editing
- v131; the owner, 10 November 2026: "All transparent things are problematic when it comes to framerate in edit mode i feel, can we somehow reduce them? Like ghosts for example can just be a light gray, rooms that are not currently shown because a cube hides them could just be a empty square with a name? cubes that hide things need no walls too, same for walls that hide things, and the cutouts can also be without walls". Held while hidden, the owner: "if i grab it it should show but just 100% not transparent". Triangles in space, the owner: "In edit mode show triangle count per item next to its name in space", "on every" model.

### Performance
- v145; the owner, 14 November 2026: a big studio scene unloaded after 2 minutes away.

### Editing without the cost
- v136; the owner, 11 November 2026: "The edit mode still has worse framerates than not editing, why?". Before v136 `labelSet` compared two words with the three it keeps, so a new canvas, texture, sprite material and shader program linked every frame something was pointed at (every frame in a room scan); the scene's matrices were made again for each pick; the whole panel was drawn and sent for every item or button the ray crossed; the page's panes were built while a headset presented; every tag and line was a draw of its own.

### Editing
- The sticks while carrying, v120; the owner, 6 November 2026: "Things in edit mode should be turnable and zoomable with the sticks once grabbed like the models in the stories"; "left stick up down is zoom, left stick right left is turn, right stick up down is move away, move to me, right stick left right is also turn for now".
- From the inside, v118; the owner, 5 November 2026: "models should be able to be touched/moved from the inside". Walk view's mouse, v127; the owner, 9 November 2026: "mouse movement switch left right and also grab mouse focus with esc to ungrab", "like most games, in both cases".

### The panes
- New scene and From another scene came in v118; the scene's settings and Shapes in v119; the Add pane's grid of cards in v120; the Items pane's cards in v122 (the owner, 7 November 2026: "items need a preview in the items list tab, should show the same image and look like the add item part"); Examples in v137. v117: a cube's show and hide buttons flash the item's box.

### Example scenes
- v137. v137b (the owner, 12 November 2026: "bliss is greyed out, why": the button was greyed at a circle and Copy a page's, so a headset at a circle could do nothing): Copy in headsets too, and at a circle the example opens from the relay for everyone. v137c (the review of v137b: a copy under way or broken off was opened for everyone, emptying the circle's scene): only a whole copy is opened; `relay` in `STUDIO.examples()` since v137b, `parts` since v137c.

### Placement in a headset
- v125; the owner, 8 November 2026: "In studio mode align all things to the room marks and have the circle only be the entry, so that moving the circle does not move the studios scene content". Until v124 the scene stood round the circle's spot and moved with it.

### Trackers
- Props on trackers and the worn character came in v126 (FORMAT networks-38).
- Lining up by nearness (v201). The owner, 25 November 2026: attach each device to the bone it is nearest to, any mix of
  devices, step into the figure. Until v200 the trackers' parts came from a rule on the T-pose (highest the head, lowest
  two the feet, the two furthest out the hands...), which needed six trackers at least and a hand found on both sides, and
  a character was worn one of two fixed ways (`'full'`, `'feet'`). Now one way, `'any'`: every device (trackers, a
  headset, controllers, tracked hands) is tied to the part it is nearest to, all together, shown as lines before it is
  taken, and whatever has none is worked out. In a headset the character is sized to it and stepped into; with none it
  comes to the performer (`fit`). The tracker guide's T-pose stand, its spoken lines and its try-it robot (one now, not
  two) were changed to match. No FORMAT bump: no room key or `state()` changed shape.

### The mirror (v204)
- The owner, 25 November 2026, in VR at the tracker guide's end: "add a third robot here that is controlled just with a
  headset and controllers or hands so that everyone can really try this"; decided since: a mirror, and "also show where
  the robot sees your trackers". The robot that is lined up by hand needs Edit, a relay with trackers and not visiting;
  the mirror needs only a headset. It is a studio feature (`puppet.mirror`, *Mirror the visitor*), each headset's own
  like a trigger cube's reveal: nothing sent, saved or in `state()`. A true mirror image (reflected, not turned), so your
  left hand moves the hand on your left. Trackers near the body are tied by `match` against the pose the headset and hands
  give (no T-pose). No FORMAT bump: no room key or `state()` changed shape (the record's new field is optional).
- The hands' turn (v216). The owner's note, 26 November 2026, a Quest 3 in VR on v212 at stand 8 *Your mirror*: "looks
  like the hands are off by 90 degrees like if I hold my controller straight as you can tell here they are off especially
  the left one is visibly [so] and at the end I will hold it up and then it's right" (his pictures: controllers held
  ahead, the robot's hands turned a quarter, the pucks edge-on; the left held up, that hand right). The grips' offsets
  (`bodies.js`'s, which the mirror copies) read WebXR's grip as a hammer grip, +y up the arm; a Quest's grip lies along
  the controller (-z ahead along the hand, +y up), so every hand pointed down when held ahead, in people's bodies and *My
  body* as in the mirror; the tests' pretend grips held naturally too but nothing checked which way a hand pointed. Fixed
  in the offsets (and the hanging hand's grip, so it hangs as before), a tracked hand's wrist made a grip where no grip
  space comes (sent as `g` too: values, not shape, so no FORMAT bump), the hands' pucks facing the way they point; new
  checks in `test-ik.mjs` and the smoke test (`tools/trackers/SPEC.md`, "Grip and wrist frames").

### The studio tour and the VR goggles after the owner's headset notes (v203)
- The owner, 25 November 2026, walking the tour on v199 in a Quest 3. "The cube the vases stand on is not larger ... left
  and right are actually mid-air"; "lots of tables are too small ... check the table sizes and make them right sized":
  the plinths' sizes had their along-the-hall and across-the-hall sides swapped. Every table was resized to what stands on
  it, and `make.mjs` now fails when anything overhangs its table (`tools/studio/tour/checks.mjs`, 2 cm in at least).
  "The cube is too small", "or actually we don't need a cube at all here" (the Sequences stand): the block went, each
  light on a thin post. "The front legs here should go to the outside": the easel's front legs splay outwards.
- "An ugly overlay effect where the blue and the green overlay here exactly", "some glitches where the shuttle stands":
  two sections' floor bands overlapped at the same height, the strips lay 4 mm over the floor (and it 4 mm over the
  stage's), and the shuttle's floor shared a plane with its hull. The floor is now tiles side by side, 12 mm up, pads
  12 mm over it; both example scenes' builds fail when two faces facing up overlap less than a centimetre apart.
- "If I enable the player here, I get these weird artifacts ... they move around while I move my head": the screen's bar
  and card pictures had no mipmaps (the bar's 1,500 px drawn over 0.9 m), so the text sparkled; now mipmapped.
- "The auto drive in the game is weird, so let's use the grip on both hands for throttle control" (the decision: each
  grip its own throttle, both sticks steer): no drive of its own, the grips' sum the thrust, the sticks added. The left
  grip is the game's while it runs (the shell's input guard may now claim one button of a controller).
- "Why don't we have a screen here?" (the shuttle's sign said *still to come*): built as the screen of stage 2's plan, a
  material named GameScreen that the studio draws; for the others in the room the wearer's device sends the game's status
  (counts and protein names, never a pose) as an ephemeral effect, so "nothing sent" now has that one exception. No
  FORMAT bump: no room key or `state()` changed shape, and older devices ignore the effect.

### Scene circles wait for their layout (v179)
- The owner, 20 November 2026, on the open problem that a studio circle made for one scene could come up empty (v157's
  end-to-end round, five of eight runs): "fix this". A device that had opened the scene but not read its saved layout
  yet sent the scene's name alone, which could reach the relay after another device's whole layout, so every device
  emptied the circle. Now the studio sends nothing until it has read the layout, placed an item or taken the room's
  (`freshWait`: `state()` is `undefined`, which the shell's `statePoll` sends as nothing); a station's one scene opened by
  itself (`chooseScene`) is opened *fresh* too, so items from the room that come first are taken there as well.

### The Bliss XP room
- v137; the owner, 11 November 2026: "we need it almost 1 to 1, but the elements separated and dynamic on detected walls", "the elements, but detached and mapped onto the room, with spatial audio of course", "it may need to be reactive and react to user movements, where the user goes, instead of a static variant", "so this could actually be built like a studio scene with trigger cubes etc that we can edit", "make sure its all cool and fancy 3d if possible", "Also add a little 3d version of clippy that is there and chills". v146 made it interactive (presses, hovers and sequences).



## Testing (moved out of AGENTS.md, now docs/agents/testing.md)

- smoke `--only <story>`: its `load <story>` step always runs with its block since v179 (the owner, 20 November 2026:
  "fix this"); before, it was filtered out by its own name and the story's steps ran on the page's default story.

- smoke `away idle` steps: came in v136.
- smoke `uploads` steps: came in v136.
- smoke `stick moving` steps: came in v125.
- smoke `spaceship` steps: came in v132.
- smoke `frame rate` steps: came in v136.
- smoke `developer mode` steps: came in v125.
- smoke `update the room` steps: came in v136.
- smoke `phone ar` steps: came in v125.
- smoke `controllers after standby` steps: came in v130.
- smoke `trackers` steps: came in v126.
- smoke `studio tint` steps: came in v125.
- smoke `studio recorder` steps: came in v125.
- smoke `studio cube starts` steps: came in v136.
- smoke `studio edit speed` steps: came in v136.
- smoke `studio everyone` steps: came in v137.
- smoke `studio walls` steps: came in v137.
- smoke `studio shows` steps: came in v137.
- smoke `studio screens` steps: came in v143.
- smoke `studio paint` steps: came in v144.
- smoke `developer mode` steps: came in v144.
- smoke `studio examples` steps: came in v137.
- smoke `studio trackers` steps: came in v126.
- smoke `studio puppet` steps: came in v126.
- smoke `studio sequences` steps: came in v146.
- smoke `studio press` steps: came in v146.
- smoke `studio colour` steps: came in v146.
- smoke `studio xp` steps: came in v137.
- smoke `studio shapes` steps: came in v119.
- smoke `studio behaviours` steps: came in v120.
- smoke `studio motions` steps: came in v120.
- smoke `studio paths` steps: came in v120.
- smoke `studio texture swaps` steps: came in v124.
- collab.mjs `areasRound`: came in v131.
- collab.mjs `reloadRound`: came in v136.
- collab.mjs `walkRound`: came in v128.
- collab.mjs `shipsRound`: came in v132.
- collab.mjs `askRound`: came in v118.
- collab.mjs `menusRound`: came in v120.
- collab.mjs `scenesRound`: came in v118.
- collab.mjs `homeRound`: came in v120.
- collab.mjs `behaveRound`: came in v120.
- collab.mjs `trackersRound`: came in v126.
- When the suites run: the owner, 7 November 2026: "only running when pushing to main makes sense for now".
- Other inline version tags (v103 to v146) that only dated a test step were dropped from docs/agents/testing.md; `git log` of AGENTS.md has them.
