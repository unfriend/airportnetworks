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

65 objects (58 models), 11 trigger cubes, 17 sound emitters and 8 groups. In VR it stands round you as placed, in a room of
5 x 5 m (walls at +-2.5 m round the scene's origin, where you stand at first, -z ahead), on our painted hill under its
sky. In AR it goes onto your own walls: the studio's `wall` behaviour (v137) maps each wall item onto the walls the
headset's room scan finds, so the same layout fits any room from about 3 x 3 m to 5 x 5 m.

- **Clusters on the walls.** Each wall holds clusters, each one an anchor with the `wall` behaviour (`direction`: the
  ray from the walls' middle along its placed direction) and its neighbours riding on it (the behaviour `item`: they keep
  their offsets from it, so a cluster stays one piece in any room). The anchors are placed on the ray that, in the
  smallest room (3 x 3 m), meets their wall where they are meant to be, so in a bigger room the clusters spread with the
  walls and never pile up; `layout.mjs`'s `anchor`, `rider` and `onAnchor` work the poses out from each part's box.
  - The front wall is the desktop, riding on the taskbar's bar (centred, 2.55 m wide): its buttons and tray ("9:41 AM"),
    the Start menu over the start button (in front of the icons, as the menu covers them), the balloons over the clock,
    the wallpaper (AR only), the boot screen and the welcome screen in the middle, "welcome back." and "bliss" in 3D, the
    four icons down the left and the hourglass spinning out from the wall at the right.
  - The left wall: Clippy's corner (his deckchair against the wall, Clippy on it, his two balloons over him, the duck's
    chat above), the notes (diary.txt, the On-Screen Keyboard under it, Confirm File Replace over both), Paint over Media
    Player.
  - The right wall: the pages (the bliss network and how to go outside, the Recycle Bin on the floor under them), the door
    outside with the hand pointing at its handle, its two balloons and "Bliss is a real place" over it, and the picture
    viewer.
  - The back wall: Task Manager, the solitaire win (its cards bounce down to the floor), the way out (Turn off computer,
    "It's now safe to turn off your computer." under it, "Go touch the grass" over it), Remote Assistance with "Close all
    your windows" over it, and the window trail with the error dialog where it comes out of the wall.
  - Clippy's chat window slides along the walls to the person nearest it (`wall`, `person`).
- **In the middle** (inside the smallest room): three patches of grass, the clear CRT on them with the rubber duck
  watching it, the flip phone, and five small clouds drifting under the ceiling; the giant cursor follows you at your
  right, facing where you look (`follow`, side right, face along).
- **VR only** (`shows: 'vr'`): the hill and sky, four big clouds far in the sky, the starfield and the wind and birds.
  **AR only** (`shows: 'ar'`): the wallpaper.
- **The walk** (trigger cubes; each reaches from inside the smallest room out past the walls of the biggest, so it is
  walked into in any of them):
  - *Entry* (everyone, stays): a step forward hides the boot screen and shows the welcome screen, "welcome back.", the
    giant cursor and its balloon, with the startup swell.
  - *Start menu*: at the start button, the Start menu with a click.
  - *Clippy*: near him, he waves and asks whether you are trying to go outside (his balloon pops in).
  - *Recycle Bin*: the crumple.
  - *Chat*: at the notes, the new-message chime, the chat's nudge and the typing (while you stand there).
  - *Door*: the door opens onto the hill and stays open while you stand there, a click, the outdoors coming through it;
    "Go. Click the door" and "Bliss: Sonoma County" pop in, the hand goes.
  - *Grass* (everyone): "Found New Hardware: Grass" with the two notes up (and down as you leave), and Clippy dances,
    asking whether you are trying to be happy.
  - *Solitaire*: the solitaire win with its flips, Task Manager out of its way.
  - *Task Manager*: the critical stop.
  - *Way out*: Turn off computer and "It's now safe", the shutdown; in VR the hill gives way to the starfield.
  - *Error corner* (everyone): the trail, the error dialog and "Close all your windows", the ding; the giant cursor goes
    while anyone is there.
- **Sounds**: 14 synthesised sounds as 17 emitters, each at its object (`on`), so it comes from there.
- **Where to stand.** In AR the walls' middle is the room scan's, but the floor things and the cubes stand round the
  scene's origin: start in the middle of the room, facing the wall you want the desktop on. In a shared room the
  scene's frame is the room's (spot A): there, put spot A in the middle of the room. Rooms much wider than deep (facing a
  long wall) push a few side-wall windows a few centimetres past the corners.

## Budgets

Every model under 30,000 triangles (the biggest, the hill, 7,368) and the room 67,378 triangles as placed in VR (50,286 in
AR), every picture at most 1,024 px (JPEG where opaque), few draws per model (static parts merged by material; only parts
that move are nodes of their own): 118 draws with everything shown in VR (95 before any cube shows something), 110 in AR
(90). The folder is 5.3 MB (under 6). `make.mjs` stops when a budget is passed. Unlit models (the windows' faces, the
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

Everything on a headset: how the room maps onto a real Quest's room scan (the studio's `wall` behaviour on its planes:
checked here only on pretend walls, rooms of 3 x 3 to 6 x 5 m, in headless Chromium), how the windows, balloons and
titles read life size, the frame rate with the whole room (about 67,000 triangles and at most 118 draws in VR), the
sounds through HRTF (unheard here: synthesised and checked for length and level only), Clippy's clips life size, the
giant cursor at your right, and how the everyone cubes feel with several people.
