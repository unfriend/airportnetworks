# The Bliss XP room (the studio's first example scene)

`examples/bliss-xp/` is a studio scene that ships with the app: the music video "Bliss (Windows XP)" by anabology taken
apart into its components and built again as a room you walk through, in VR on our painted hill and in AR on your own
walls. It is made by the generator in this folder; **never edit `examples/bliss-xp/` by hand**: change the generator
and run it again. To change the room for yourself, open it in the studio and *Copy to the relay*, then edit the copy.

The owner, 11 November 2026: "we need it almost 1 to 1, but the elements separated and dynamic on detected walls",
"the elements, but detached and mapped onto the room, with spatial audio of course", "it may need to be reactive and
react to user movements, where the user goes, instead of a static variant", "so this could actually be built like a
studio scene with trigger cubes etc that we can edit", "make sure its all cool and fancy 3d if possible", and "Also add
a little 3d version of clippy that is there and chills".

## Making it

```sh
node tools/studio/xp/make.mjs            # builds every part, writes examples/bliss-xp/ and the listings
node tools/studio/xp/make.mjs --check    # says whether examples/bliss-xp is current (exit 1 when not)
node tools/studio/xp/make.mjs --only clippy,door --out /tmp/xp --sheet /tmp/xp/sheet.png   # while working on parts
```

It needs Playwright with a Chromium build, as `tools/smoke.mjs` and `tools/studio/convert.mjs` do (`PLAYWRIGHT_MODULE`
and `CHROMIUM_PATH` as there); it takes about 15 s. It is deterministic (every random number seeded): run it again and
the same bytes come out. `--check` builds into a temporary folder and compares: `layout.json` exactly, the same files,
each within 2 % of its size; then `tools/studio/scan.mjs examples --check`.

## What is here

- `COMPONENTS.md`: the video's components second by second, and what each became in the room (a model, a picture on a
  model, a sound, a behaviour, a trigger cube, AR or VR only, on a wall), with what was left out and why.
- `make.mjs`: opens `page.html` in headless Chromium, builds each part, writes it as a binary glTF with its clips
  (three.js r128's own `GLTFExporter`), reads it back with `GLTFLoader`, checks it and draws its picture for the studio's
  Add pane (`previews/<the model's path>.jpg`, 256 px, as the studio draws them: lit as it lights a scene, a little above
  and in front, on a dark ground); then the sounds, the layout and the listings.
- `page.html`, `kit.js`: the generator's page and its kit: seeded numbers, canvas painting (our own rolling hill under a
  blue sky with clouds, `XP.hill`; a meadow; our emblem, a little green hill in a rounded square), the Luna look (title
  bars, buttons, menus), slabs whose face carries a canvas picture and whose raised parts (buttons, keys, tiles) show the
  same picture on their tops and its border on their sides, balloons, text traced off a canvas and extruded in 3D, merging
  into one indexed geometry per material, and the export and pictures.
- `parts/*.js`: one module per family of components (the screens, titles, landscape and starfield, clouds, grass, icons
  and the bin, the taskbar and Start menu, the windows, the media player, the drag trail, solitaire, balloons, cursors,
  things: the door, the flip phone, the glass CRT, the duck; Clippy and his lounge). Each registers
  `XP.part(name, { file, build })`; `build()` returns `{ root, clips }`, metres, Y up, its front +z. Wall items have their
  back at z = 0 and their middle at x = y = 0; floor items stand on y = 0.
- `sounds.mjs`: every sound synthesised in Node (mono 16-bit WAV at 22,050 Hz): the startup swell, shutdown, ding,
  critical stop, balloon pop, new message, nudge, hardware in and out, click, the bin's crumple, typing, solitaire flips
  and the outdoors (wind and birds), the loops made seamless.
- `layout.mjs`: the room (below).

## The room

About 5 x 5 m round the scene's origin, where you stand at first, -z ahead: the desktop on the front wall (the boot and
welcome screens, the wallpaper in AR, the icons, the taskbar and the balloons over its clock, the Start menu), chats and
notes on the left wall, the pages and the door outside on the right wall, the way out and the solitaire win on the back
wall, the grass, the glass CRT and the flip phone in the middle, Clippy chilling under his beach umbrella in the front
left corner, clouds drifting under the ceiling, and in VR our hill and sky round it all, with big clouds far off.

It is written for the studio's v137 contract (FORMAT networks-43): wall items carry the `wall` behaviour (`direction`
for most, `nearest` for the taskbar, the Start menu and the balloons by the clock so they keep their order, `person` for
Clippy's chat window, which slides along the walls with you), so in AR they move onto the walls the headset finds; the
landscape, the far clouds, the starfield and the wind are `shows: 'vr'`, the wallpaper `shows: 'ar'`; some cubes are for
everyone at the circle (`all: true`). A studio without v137 reads the wall items as bad and leaves them out.

The walk (trigger cubes): stepping forward shows the welcome screen, "welcome back.", the giant cursor (which then
follows you at your right) and its balloon, with the startup swell, for everyone, once; the start button opens the Start
menu; Clippy waves and asks whether you are trying to go outside; the bin crumples; the left wall's chat chimes, nudges
and types; the door opens onto the hill, the outdoors coming through it, with its balloons; touching the grass is found
as new hardware for everyone, and Clippy dances, asking whether you are trying to be happy; the solitaire win in the back
left corner; the critical stop at the Task Manager; the way out says it is now safe to turn off your computer, with the
shutdown, and in VR the hill gives way to the starfield; the back right corner is the error corner, for everyone: the
cursor's error, the drag trail and the ding, the giant cursor gone while anyone is there. Every sound is an emitter at
its object (`on`), so it comes from there. The taskbar, Clippy's corner and the door are groups.

## Budgets

Every model under 30,000 triangles and the room under 250,000 as placed (about 69,000), every picture at most 1,024 px
(JPEG where opaque), few draws per model (static parts merged by material; only parts that move are nodes of their own),
the folder under 6 MB (about 5.3). `make.mjs` stops when one is passed. Unlit models (the windows' faces are, and the
landscape, the grass, the clouds and the cursors, their light baked into their corners) look the same in any light; some
have no normals (they need none), which the studio's Add pane notes as it does for a scan.

## The rules

- Our own drawings only: no frame, still or likeness of the performer or anyone else (no people at all: the assistant's
  part is Clippy's, our own paperclip, built from scratch), and none of the video's pictures.
- No logos: never the four-coloured flag or the system's or its maker's wordmarks; our own emblem and the word "bliss"
  on the boot and welcome screens. The UI's generic labels are fine (start, My Computer, Recycle Bin, Notepad, Task
  Manager, title bars and buttons).
- No sound files or tunes of the real system: every sound is our own synthesis.
- No song lyrics: only the few short phrases the video's UI shows as window titles and balloons ("Go touch the grass",
  "Close all your windows", "Bliss is a real place", "It looks like you're trying to go outside.", the diary's one line);
  the chats, pages and search results are our own words.
- The wallpaper is a photograph: our hill and sky are painted in code (`XP.hill`), never traced from it.
- The video's frames were only looked at, never copied into the repository.

## Untested

Everything on a headset: how the room maps onto real walls (the studio's `wall` behaviour), how the windows, balloons
and titles read there, the frame rate with the whole room (about 69,000 triangles and at most 122 draws in VR, fewer
while cubes hide things), the sounds through HRTF (unheard here: synthesised and checked for length and level only),
Clippy's clips life size, and how the everyone cubes feel with several people.
