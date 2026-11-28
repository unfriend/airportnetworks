Network stories - installable web app
  - Network theory, told with the world's airports  (packages/airports/main.js)
  - A glimpse into the future of network medicine: a 3D tour of the Ludwig
     Boltzmann Institute for Network Medicine  (packages/lbi/main.js)
  - Muscle and heart: rare diseases of nerves and muscles in a 71-layer
     network, after Iker Núñez-Carpintero and Philipp Friedrich  (packages/nmd/main.js)
  - Endotypes: one rare disease of the junction between nerve and muscle, 35
     genes and 12 hidden mechanisms, after the EndotypY poster by Chloé Bûcheron
     and colleagues  (packages/endo/main.js)
  - One scan, one system: a PET scanner, the body's organs and the network of
     their metabolism from 658 scans, after Barbara K Geist and colleagues
     (packages/pet/main.js)
  - Tissue and time: the small working units organs are built from, in 24,945
     slides, and how they change with age, after Iva Buljan and colleagues
     (packages/micro/main.js)
  - The aging ovary: what 255 ovaries show about aging, from the reserve of
     follicles to two deep-learning methods and the trends with age, after the
     poster by Parijat Chakraborty, Samir Moustafa and André Rendeiro
     (packages/ovary/main.js)
  - Three qubits: how a gene network is shrunk to fit on a tiny quantum
     computer, and broken into building blocks it runs well, after Joel
     Hancock's method and figures  (packages/qubits/main.js)
  - The mutation machine: how DNA changes letter by letter along a family
     tree, and how a rule for those changes becomes a quantum circuit, one
     machine per branch; after the poster by Enes Berk Sakalli and Arndt von
     Haeseler  (packages/mutation/main.js)
  - The shape of tissue: where cells sit in slides of liver, read at every
     scale at once (persistent homology), and which scales tell cirrhosis from
     healthy tissue, down to every cell; after the poster by Simon Schindler,
     André Rendeiro and Jörg Menche, on their data  (packages/topo/main.js)
  - Pass it on (Weitersagen!): how warnings, viruses and signals spread, from
     a school of fish to the world's flights to a cell; for everyone, in
     English and German  (packages/pass/main.js)
  - Holding on to nitrogen: a wheat, its soil and the microbes in between;
     a wheat that slows the soil's microbes stays greener and leaks less
     nitrate in a field trial in Japan, while the crowd of microbes follows the
     fertiliser far more than the wheat; after the slides and field trial of
     Marina Montserrat Díez, Christa Schleper and colleagues  (packages/soil/main.js)
  - Spatial interactome, where proteins meet in a cell  (packages/spatial/main.js)
  - Back into the cell: an interactome of 13,460 proteins put back into a
     model cell, which of its links can happen where, which side of a membrane
     each protein sits on (UniProt) and its machines (the Complex Portal's
     complexes)  (packages/ppicell/main.js). In its explore mode the Network
     tab changes the method's limits live (how many links are drawn, the least
     support a link needs, the Atlas's reliability levels and the places that
     count, communities on or off; Reset limits), and on a laptop or desktop
     takes your own network: a .tsv, .csv or .txt file (or pasted text), one
     pair a line, two identifiers (gene symbols, UniProt accessions, NCBI gene
     numbers or Ensembl gene ids), then if you like a score and a kind; Try an
     example loads GRB2's neighbourhood. It reports what was read and what was
     not found (a list you can download), then draws your network in the cell,
     judged as the map is. Your network stays in your browser: it is sent
     nowhere unless you press Share with this room (in a shared room) or Put
     on the relay (outside one), which put its pairs, scores and kinds on the
     relay for everyone at your station, and anyone who can open that relay's
     rooms, to see until you press Remove from the relay. It is kept only if
     you press Keep on this device (Forget it removes it). Not shared, in a
     room it is yours alone; the others keep seeing the room's network. Shared,
     everyone at the station sees it and changes its limits and picks
     together; Back to the built-in network takes everyone back. A headset
     cannot choose a file: its Network tab offers the built-in network, one
     kept in its own browser and the networks on the relay
     (#ppicell&explore&net=<id> opens one). Sharing needs a relay that keeps
     them (v208 or newer, with scenes or --nets). Export for wwiznet (ZIP), on
     the same tab on a laptop, saves the network on show as a dataset for
     wwiznet, the Menche lab's 3D network explorer: unzip it into the data
     folder of a wwiznet deployment, add the line its HOW-TO-OPEN.txt gives to
     data/index.json, run python3 server.py there and open /?dataset=ppicell.
     From the command line: node packages/ppicell/src/export-wwiznet.mjs
     <deployment>/data/ppicell (options in packages/ppicell/README.md).
     The same tab also opens a wwiznet dataset as your own network: choose or
     drop its edges.tsv (and its nodes.tsv, or the whole folder). Only the
     edges' two ends, one score and one kind column and the column naming the
     proteins are read; every other column is skipped and never kept or sent.
  And an introduction, Your guide: a robot guide shows you how the app works
     in a headset, then a few tasks to practise (packages/tutorial/main.js; the last
     story card on the Stories screen)

Experiments: the last card on the Stories screen, Experiments, opens a second
set of cards (in a headset a second arch of cards), with a card back to the
main set; #experiments opens it too. In it:
  - The switch that sticks: CDK5, a switch in neurons, among 16,376 human
     proteins, from healthy signalling to the cut that leaves it stuck on, as
     in Alzheimer's disease, and a landscape of diseases; after the Menche
     lab's CDK5_data repository, by Christiane Hütter  (packages/cdk5/main.js;
     not yet tried on a headset)
  - Invisible threads: nearly ten thousand substances from air, water, food
     and medicines, tied together by the genes they disturb, their groups,
     where they hit the cell's network of proteins, the diseases close to them
     and what European countries release; after Lombardo, Hütter, Unterlass and
     Menche, Nature Communications 2026  (packages/exposome/main.js; not yet
     tried on a headset)
  - Network medicine, told with the proteins in a cell  (packages/proteins/main.js)
  - Flock: 200 starlings at dusk flying all around you, each following its
     seven nearest neighbours  (packages/flock/main.js)
  - Robot gang: robot vacuums in your room that bump and turn, follow you
     about or form a conga line; in a headset they find your floor and walls
     (packages/robots/main.js)
  - Cell stress test: the cell map's model cell filled with made-up proteins,
     to read a headset's frame rate  (packages/cellstress/main.js)
  - Protein crowds: up to a million balls standing for proteins, drawn two
     ways and culled four ways, with what each frame costs
     (packages/crowds/main.js)
  - Six handshakes: the example story package  (packages/hello/main.js)
  Each opens by its address too (#proteins, #flock ...). In a shared room an
  experiment can be a circle (Add places it); Arrange all leaves them out.

Story packages: more stories, each in a folder of its own (packages/<key>/,
written by people the owner trusts and brought in through git), get a card on
the Stories screen after these (list "stories" in its story.json), in the
Experiments set (list "experiments"), or hidden (list "hidden": only in developer
mode and by their address, #<key>). node tools/packages/scan.mjs lists them in
packages/index.json; tools/packages/SPEC.md says how to write one.

The design room (a table with a small model of every prop of the stories) is
put away for now (v217): it is no longer in the app; its sources stay in
tools/design/. In a shared room, over every circle its story's small model
turns, so circles tell apart.

The studio (#studio, stories/studio.js; not on the Stories screen either) is
for your own scenes: your models (textured, some animated), placed life size
in the room, with see-through trigger cubes that show and hide them as people
walk in and out, and sounds placed where they belong. A scene is one folder of
files; the relay serves the folders and saves where everything stands. At an
event, on the laptop on the headsets' Wi-Fi:

  node relay/server.mjs --lan --scenes <folder>

Each subfolder of <folder> is one scene. Open the address it prints followed by
/upload on a laptop to add files, and #studio on every headset and screen (or
Studio in the headset's menu, Settings tab; in a shared room Studio here puts
its circle at your feet, for everyone at it). In a shared room each scene can be
a circle of its own: Add (the Shared dialog, or Add here in the headset's menu)
lists Studio: <scene> for every scene of the relay, and the circle opens that
scene for everyone at it; several studio circles can stand in a room. Since
v125 a scene in a shared room stands on the room's spots (spot A its origin,
x towards spot B), not round its circle: the circle is only the way in, and
moving or turning it moves nothing of the scene, so a scene stands at the same
place in the room whichever circle shows it. A scene placed before then stood
round its circle: Move the scene to this circle (the Scene pane, editing on, at
its circle) moves every item there again, for everyone (one Undo step).
- Sequences: a timeline of events on items (play an animation, show or hide
  an item, play a sound, change a picture, start another sequence). Add >
  Sequence in the studio (editing on); the card lists its events, and on a
  laptop a lane view lets you drag them. Play for everyone starts it for
  everyone at the circle on the room's clock; Play here is your own. Visitors
  can play one too.
- Press and point: an object or shape can react when it is pressed (a click, or
  the trigger in a headset, with editing off, visitors too) and while it is
  pointed at. On its card, When pressed and While pointed at, Add a reaction...
  (it can start an animation, sound, path, motion, show or hide things, or start
  a sequence). A press is shared with everyone at the circle; pointing at
  something is your own.
- Colour: Any colour... on an object's tint, a shape's colour and the paint
  colour opens one picker (a hue ring and square, hex, swatches, recent colours
  kept on your device); in a headset drag it with the trigger. Let go and it is
  one Undo step.
- Upload (<address>/upload, or the studio's Upload tab on a laptop or desktop):
  pick a scene or New scene, drop files or whole folders, read the plan, then
  Convert and upload. Models (FBX, OBJ with its MTL, glTF, GLB, PLY, STL) become
  GLB files in the scene's models/ folder (metres, upright, textures as the
  Textures choice says: compressed as KTX2 up to 8,192 px by default, which a
  headset keeps compressed, made on the laptop; or JPEG/PNG up to 4,096 or
  2,048 px); sounds become mono, so
  they come from one point (sounds/); everything you gave is also kept as it was
  in originals/. Then Open the scene.
- Formats, if you prepare files by hand: GLB for models (FBX works but loads
  slower and may say the wrong size), JPEG textures (PNG only where see-through),
  about 300,000 triangles a model and 500,000 a scene on a Quest; mono sounds,
  WAV for short loops, MP3 for long ones. tools/studio/README.md has the details.
- Textures: the studio also reads TIFF, PSD and DDS pictures, and finds a
  texture a model names under another name by itself (brick.tga finds
  brick.png; stone_diffuse.jpg finds Stone-BaseColor.dds). One still missing:
  the object's card (on a laptop, editing on) offers Use <a picture of the
  scene> or Choose a picture..., and Add a texture... lays a picture on a model
  that has none (Colour, Normal, Roughness...). Either makes the model a GLB with
  the picture in it at once. The upload page pairs what was dropped the same way.
- Editing: Edit on the studio's Scene pane. On a laptop click an item and drag
  its arrows (W, E, R: move, turn, size); Walk lets you walk through the scene,
  where the trigger cubes act. In a headset point and pull the trigger to pick,
  hold the grip to carry, both grips to size; in VR the sticks walk and turn,
  and steer what you carry. Click the left stick twice for the other way of using
  them: the sticks move you, also while you carry something, which comes along
  (carry it far across the scene); twice again for the studio's own.
- Behaviours: an object, a shape or an empty can look at people, follow them,
  keep away from them or follow another item (Behaviour on its card, with whom
  it reacts to: the nearest or the first to come close, and how far and how
  fast). In a room it reacts to one headset at a time, the same for everyone at
  the circle; with nobody near it goes back to its place.
- Motions: an object, a shape or an empty can spin, wobble, bob, pulse, orbit
  or sway on its own (Motion on its card, with its speed, how far, its axis and
  whether it runs always or from when a cube shows it). Its place is not
  changed, and it keeps moving while selected so you see it at once.
- Placing what moves: while something you selected moves away from its place,
  a pale ghost stands where it is placed. On a page its arrows stand on the
  ghost; in a headset the grip on the ghost (or on the thing) carries it from
  there. A cut-out or a following sound selected stands what it is on still.
  Motions: paused (the Scene tab, its card, or P on a page) stands
  everything still on this device while you place things.
- Recorded paths: an object, a shape, an empty or a sound can play back a
  movement you made. In a headset press Record its movement on its card, then
  carry it with a grip (the sticks turn it and push it) and let go; on a page
  press Record, move it with the arrows or its card's buttons, then Stop. It
  plays from where it stands (Loop, Once or Back and forth, Always or When
  shown, slower or faster); moving it moves its whole path. A group has none:
  record its members one by one. While you record, a ghost stays where it
  began: end there (it lights up) and a loop closes smoothly, its still start
  and end cut (Keep it as recorded undoes that).
- Longer recordings and your voice (v125): with a relay that takes uploads a
  recording may run up to ten minutes; one past two minutes (or with many
  keys) is kept as a file of the scene, recordings/<name>-<n>.json, which
  every device fetches. With my voice: on (on the recorder's rows; allow the
  microphone, on the 2D page first for a headset) records your voice with the
  movement and keeps it as a sound that follows the thing and plays with its
  path, from each start of it, for everyone at the circle at the same moment
  (Record again makes a new voice file; Undo brings the old one back).
- Stays on the floor (v130, on the recorder's rows, this device's own, off
  until turned on): a recording first sets the thing down on the floor, then
  it only slides along the floor and turns about the vertical, the side that
  was lowest kept down, however you lift or tilt it. An empty and a sound keep
  the height they start at.
- As it moves (v164): a model with a walk clip can play it by the distance it
  covers (Animation on its card: As it moves, then its clip), one step cycle a
  stride, backwards when it goes backwards, on its recorded path, a behaviour,
  a motion or carried. Standing still it settles to its Standing clip (or Still:
  the walk held with its feet together). Stride: Shorter or Longer when its feet
  slide; As measured goes back to the stride read from the clip.
- A trigger cube can change a model's picture while you are in it: on the
  cube's card Change a texture..., point at the model (or pick it), then its
  material, a slot (Colour first) and one of the scene's pictures. Walk in and
  the picture switches at once, walk out and its own is back (a cube that stays
  keeps it); the one entered last wins. Only that object changes, not others of
  the same file, and each person sees what their own place does.
- A trigger cube can start things (v136): on the cube's card Start
  something..., point at a character or a prop (or pick it), then what (one of
  its animations, its sound, its recorded path or its motion), how (Once, Loop
  or Hold while you are inside, or Stop) and when (walking in or walking out).
  A clip blends in and out over its own animation; a sound a cube starts, and a
  path or motion, waits until then. The last thing started on an item decides.
  Each person gets it as they walk in (nothing is sent); Try plays it here.
- Works for: Each person / Everyone here on a cube's card (v137): everyone here
  makes the cube act for every device at its circle while anyone in a headset
  is inside it (what it shows, hides, changes and starts, at the same moment).
- Shows in: AR and VR / Only AR / Only VR on an item's card (v137): a stand-in
  wall or floor for VR visitors that an AR visitor's own room replaces.
- On a wall (Behaviour on its card, v137): in AR an item goes onto the room
  scan's walls, in its direction, on the nearest wall or following the person
  along the walls; without walls (VR, a page) it stays where it is placed.
- Examples on the Scene pane (v137): scenes that come with the app. Open opens
  one read only; Copy to the relay (with a relay that takes uploads, on a page
  or in a headset) makes it a scene of your own to edit. At a circle in a shared
  room the example opens from the relay for everyone at that circle: the first
  press copies it there, later presses open that copy (only once all of it is
  there: while a copy is still on its way it says "Being copied...", and a copy
  that broke off is finished by the next press). It is greyed there only while
  the circle's story is locked, while it is being copied, or while the room's
  relay takes no uploads (a line says why). The first is Bliss XP: the music video "Bliss (Windows XP)"
  taken apart into a room of our own drawings (the desktop, windows, balloons,
  the door onto the hill, the solitaire win, Clippy chilling on his deckchair),
  with trigger cubes as a walk through it and its windows on your walls in AR.
  Press things (a click, or the trigger in a headset): icons open their windows,
  Start opens its menu, the player plays music, balloons burst, Clippy dances.
  Stand in the middle of the room facing a wall and Recenter before it starts
  (#studio&scenes=examples&scene=bliss-xp opens it directly).
- The studio tour (Examples, studio-tour): a hall with a stand for each thing
  the studio does, each working with a sign saying what it is and what to do,
  and at the end a shuttle: sit inside and the hall gives way to another world;
  the VR goggles are on its shelf
  (#studio&scenes=examples&scene=studio-tour opens it directly).
- The tracker guide (Experiments, Tracker guide; or Examples, tracker-guide):
  stands you walk round, one for each way to wear trackers, from eleven on the
  whole body to a headset alone, each on the tutorial's robot with a sign; at
  the end a robot to wear yourself with any mix of trackers, a headset and
  controllers (open the scene from Examples, turn on Edit, select it, Line up
  with the performer: step into it, or with no headset it comes to you; each
  device is tied to the part it is nearest to, shown as a line before it is
  taken).
- A sound can follow a model, or one of its bones: on the sound's card Follow
  an object..., point at the figure (or click it), then pick a bone (Head,
  Chest, a hand...; More bones... lists them all). A voice placed at her mouth
  then moves and turns with her head, and is heard only while she is shown.
- A cut-out hides part of a model without changing its file (a door in a scanned
  wall): select the model, then Cut out a part on its card (or Cut-out box under
  Add). A box appears where you selected the model; move and size it over the
  part. A trigger cube can show it, so the wall opens as people walk up
  (Preview: Cut on its card shows the hole while you edit).
- Groups move things together: on an item's card Make a group..., then point
  at (or click) the others, Done. A click on a member selects the group (a faint
  box round it), a second click that member alone. The arrows, Turn 90°, the
  size steps and On the floor move, turn and size the group; in a headset the
  grip on a member carries it and both grips size it. Duplicate, Ungroup and
  Delete on its card.
- Faces on a model's card: As in the file, Both sides (walls and leaves seen
  from behind too), or Inside out (a model whose faces point the wrong way, or a
  room to see from inside). Each placed copy has its own; the file is unchanged.
- Tint and Brightness on a model's card: a colour (ten swatches, or any colour on
  a laptop) its colours are multiplied by, and Darker, Brighter and Reset (25 % to
  400 %). Each placed copy has its own; a group selected sets all its models.
- Vive trackers (v126; the PC's, through its relay and SteamVR: tools/trackers/):
  on an object's, a shape's or an empty's card Follows a tracker makes it move
  with one of them, from where it stands (Snap onto it puts it right on it). A
  character rigged by Mixamo can be worn by a performer: Wear it (whole body, or
  feet and a headset), Line up with the performer (a T-pose, 5 s), On; Record a
  take makes the moves a clip of its GLB. Not yet tried with real trackers.
- Looking closely (a laptop or desktop): Preview on an Upload row, Look closer on
  a model's Fewer triangles card and Look on an Add card show the model over the
  whole window. Drag to spin, wheel to zoom, right-drag to pan, double-click to
  frame it; for a model being made lighter, All triangles, Lighter or Side by side
  and the share on a slider; Wireframe and Textures. Esc or Close goes back.
- Saving: Save writes the scene's layout.json in its folder on the laptop (the
  one before is kept in the scene's .history/, the last 20). With
  --scenes-readonly nothing is written: Download layout.json instead.
- Password: with COLLAB_TOKEN=<word> before the command every device enters the
  word once (the Shared dialog, or the headset menu's Circles tab); the scenes'
  files need it too. On the internet (--public) the relay needs one for scenes.
- ffmpeg on the laptop (brew install ffmpeg, sudo apt install ffmpeg, winget
  install ffmpeg) makes long uploaded sounds mono MP3; without it they are kept
  as given. The relay's Docker image has it.
- In a shared room lock the studio's circle (Lock story in the Shared dialog, or
  Lock this story in the menu there) so nobody moves things by accident, and give
  visitors a link with &visit (#studio&visit: no editing at all).
How a scene looks and feels in a headset (its size, the grips, the sounds) is
not yet tried on one.

index.html is the app: it shows a start screen to pick a story, and the Stories
button (top bar, and the panel in VR/AR) brings it back. Stories are loaded into
the same page, so changing story never ends a VR or AR session; entering VR or
AR from the start screen opens a Stories screen in the headset (its title and
one card per story, in two rows in front of you; the sound, Sound check,
Anchor, Exit, Recenter and Repeat are in the headset's menu: click a stick);
entering from inside a story resumes it where you were. In a shared
room a headset has no Stories screen: you walk to a story's station instead.
In a shared room the headset's menu is a short one for visitors (play, start
again, sound, subtitles, leave the circle, line up again) unless the Shared
dialog's switch says Menus: full; staff unlock one headset by holding both
sticks down for 2 seconds (the same again locks it).
The start screen is the landing page (no hash, or #stories). The address
follows you: #stories on the Stories screen (page or headset), #airports,
#proteins, #spatial, #lbi, #nmd, #endo, #pet, #micro, #ovary, #qubits, #mutation, #topo, #soil, #cdk5, #exposome, #ppicell, #pass, #flock, #robots or #tutorial in a story, so links can be shared and open that story
directly (proteins.html and spatial.html forward there). Taking the headset off and on returns to the Stories menu
(and, unless Anchor is on, places everything in front of the next wearer).
A story builds in steps while it loads: the page shows a thin bar and the step
under its loading line, and a headset shows a card with the story's name and a
bar in front of you until the story appears.
Repeat all and Repeat one (on the page's Stories screen, in a headset in its
menu) keep the app
playing for an exhibition: Repeat all plays the stories one after another
without end, Repeat one plays the story you pick again and again. Press the lit
button to turn it off. It is remembered on the device; a link ending in
#airports&repeat=all (or repeat=one) sets it.
Focus view (phones and tablets): the story's 3D fills the screen, with a slim
bar at the foot (play, the chapter arrows and its name, the timeline, sound and
Text), the narration's words as subtitles just above it and each chapter's title
for a moment as it starts. Text brings the story's full panel back; in explore
mode Controls pulls the tools up from the bar. It is on by default on phones and
tablets and off on computers; switch it with Focus view on the Stories screen or
in the ... menu at the top. It is remembered on the device; #focus=on (or
#focus=off) in a link sets it.
Phones and tablets: on a narrow screen the top bar keeps Stories, Sound, AR and
a ... menu with the rest (Explore now, Install, Shared, VR, Full screen, Focus
view). Where the phone has AR (Android's Chrome with ARCore; iPhones and iPads
have none), Enter AR stays in the top bar, and the first time a story opens a
small card offers it once ("See it in your room"). In AR on a phone, a round
menu button at the top right opens a sheet with the menu's main switches (Exit
AR, Recenter, Sound, Narration, Sound effects, Subtitles, Slideshow, Frame rate,
Labels, Cards, Panels, Real world hides) and The full menu, the headset's menu
in front of you (tap its buttons on the screen); a tap anywhere else points at
the scene as before. Where the phone's browser gives no such button, tap twice
quickly on the screen, pointing at nothing, to open and close the menu (if the
browser refuses the button, AR asks again at once without it; refused again,
the page says to tap Enter AR again). Opening a story from the
Stories screen on a phone or tablet goes full screen where the browser allows it
(Android's Chrome, iPad's Safari); Full screen in the ... menu switches it. An
iPhone cannot go full screen in Safari: a tip says once to add the app to the
Home Screen (Share, then Add to Home Screen), where it opens without Safari's
bars. The back button (Android's back, iOS's swipe) closes what is open first
(the story's text, the controls, the ... menu), then returns from a story to
the Stories screen; on the Stories screen it leaves as usual. On touch screens
the timeline and the bars keep clear of the screen's edges, where iOS takes a
swipe as back or home.
Slideshow: a story stops at the end of each chapter, with all its text shown,
until you press Next (or Play). The narration finishes
the chapter's last words before it waits. Next is at the foot of the story
panel (on a phone, beside Play), and in a headset under the panel where the
chapter's name was. Turn it on for one story
with "Slideshow: off/on" at the foot of the story panel (in a headset, beside
the clock under the panel), or for every story with
Slideshow on the Stories screen (in a headset, in the menu's Settings tab).
It is remembered on the device; #slides=on (or #slides=off) in a link sets it
for every story. In a shared room a stop pauses the station for everyone there,
like a pause by hand.
Developer mode (for testers; off by default, this device's own): the small
switch at the foot of the Stories screen (also in More on a phone, and in a
headset in the menu's Settings tab), or #dev=on in a link. While it is on, a
box says what is new in this release and what to test: over the Stories screen
when the app opens, and in a headset at the start of each session (the menu
opens at it once the welcome has gone). Got it (the quiet button on the right) hides it until the next release
on this device; Later (the main one) until the app opens again (in a headset, the next
session). What is new, beside the switch and on the headset menu's Debug tab,
shows it any time. The lists come from whatsnew.json, rewritten at every
release; while it is fetched, or when it cannot be (and none was before), the
box has Later alone.
Anchor (in the headset's menu) keeps the network and the panels at one spot
in the real room, for every story: through taking the headset off and on (the
next wearer still starts on the Stories menu), recentring, leaving VR and
reloading. While anchored the grip moves nothing; Place again puts everything
in front of you and anchors it there. To arrange things first, leave Anchor off,
move them with the grip, then press Anchor. It uses the Quest Browser's room
anchors (not in private browsing; clearing the site's data forgets the place);
without them the place holds until you leave VR. #anchor=on (or #anchor=off) in
a link sets it.
Room names: a room's three-letter code is its address, and anyone in the room can
also give it a name (the Shared dialog's Name this room field, or Name in the
headset menu's Circles tab, which opens a keypad with a Shift key). The name
shows beside the code in the dialog and the menu, in the lists of rooms on this
network and in the notices about the room, for everyone. On a public relay a
room's name is shown to devices on the same network.

Shared rooms (Shared button, top bar and Stories screen; in a headset the
menu's Circles tab: click a stick): several headsets and screens join one
room and see the same stations, a story each at a spot in the room, in step on
every device (anyone can play, pause, jump or change a control; the last action
wins). A headset runs only the station it has gone into. Since v120 the circles
ask first by default: point at a circle's card or model and press, and a small
panel in front of you asks whether to go in (Go in or Not now; it goes by itself
after 10 seconds); walking into a circle does nothing then, and no rings are
drawn (Show all rings brings them back). The story stays at its circle; the lobby
asks the same way, and walking into it still takes you back to the lobby. For
walking in instead, turn the circles to walk in (Circles: walk in, in the
headset menu's Circles tab or the Shared dialog, for everyone in the room): then
walk into a station's circle and after a second its story plays there; the
others show as rings floating half a metre over the floor with a card over each
(its story and how many people are there; it lights up while you point at it).
Above each circle a small turning model of its story in its colour lets you
tell the circles apart from across the room. Away from every station no story shows, only the cards,
the models (and with the circles walked into, the rings), the other people and
the menu. Inside a circle the other stations show only their models (pointing at
a model shows its card; with the circles walked into a ring comes back when you
come within 2 m of it), and your own ring is hidden (Show all rings in the menu
shows every ring); walk out of a circle and you stay in its story until you go
into another. With the circles walked into, pointing at a card and pulling
the trigger does not take you there: walk into its circle. A headset in a room never shows
the Stories screen (leave the room in the menu and it comes back), except at the
room's arc or an All stories circle; in a room with no stations at all the menu
opens by itself, with Arrange all.
A room starts as a shared Stories screen (the room's arc): the page that starts
it, or the first headset, makes an arc of story cards, and the first headset in
the room (in AR, or in VR in the same room) puts it 1.2 m in front of itself,
facing away. Every headset in the room is at it without walking anywhere and
every page shows it as its Stories screen; the story picked there plays for
everyone. Anyone moves it with the grip on its cards (point to swing, raise or
lower to push or pull, twist to turn), its dot on the Shared dialog's map, or
Move here; Lock circles stops that. The first other circle added, or Arrange
all, turns it into an ordinary All stories circle where it stands (whoever was
at it stays with it); removed, it does not come back.
All stories and Back to the lobby (two circles of the app's own): step into an
All stories circle and you see the Stories screen, as on your own; the story you pick plays
there for everyone in that circle, from its start, and the Stories button on its
panel takes everyone there back to the cards. Its switch (the menu's Circles tab
at that circle, or its row in the Shared dialog) is Own stories at first: With
the room's circles, a story picked there joins the room's circle of that story,
the same moment for the people at both. Walk into a Back to the lobby circle
(added from Add, like any circle) and your story ends: the room shows as at the
start, every circle with its card and model, until you walk into another circle.
Arrange all leaves both kinds where they are; screens follow an All stories
circle like any other (its Stories screen while it shows its cards, and its row
in the Shared dialog has a story picker), and the lobby has no Follow.
Room setup (in a headset the menu's Circles tab, Room setup; on a page the
Shared dialog's Setting up a room) takes a group through starting a shared room
from zero, and it is part of every headset's start. Before the event every Quest
scans the room once, all run the same Quest Browser version, the same bookmarked
address and the same Wi-Fi, and the room has two tape crosses on the floor, A
and B, about 2 m apart (1 m at least), with an arrow from A to B: they set the
room and its floor (since v122), so every headset that calibrates on them stands
the room on the real floor, whatever its own floor says. Each time a headset
enters AR in a shared room (in VR: answered In this room), its menu opens by
itself at Line up, which says how it lines up now and what to do: the room's
first headset calibrates on the two spots (Calibrate: the controller pointing
down, the bright ring at its tip on spot A on the floor, the trigger, then spot
B), which sets the room and its floor for everyone, however far off a
headset's own floor is (spots at different heights are refused: touch them
again on the floor); the others
calibrate on the same spots, or, already lined up by them (their calibration
found again, or through the shared space from someone who calibrated), are asked
by eye instead: the two orange crosses show where the headset puts the spots and
a small panel asks Are both crosses on your spots? Yes counts as a check; No,
calibrate again opens Line up. The same question comes after waking, a Re-align,
or whenever the room may have moved in the headset. Check: press Check at A and
touch spot A itself, on the floor (the result says how much of it is in height
when that is 2 cm or more: a headset whose floor differs); up to 10 cm is green,
up to 25 cm amber (fine for walking about), and either closes the menu (lined
up, for this session); more is red and goes back to Line up to calibrate again.
Skip for now closes it until a red check or until the headset is still not lined
up 20 s after entering AR with another headset there. Touch the spot checks two
headsets against each other: two people hold a controller's tip on one spot (one
after the other, or tip to tip) and each presses Check here within 20 s of the
other (the only check while the room has no spots). The page's dialog lists
every headset, how it lines up and whether it was checked; the guide's last page
says what to do when one is not lined up: Re-align, calibrate on the spots, or a
fresh shared space.
Calibrating on the same two spots lines every headset up
(Calibrate: touch spot A, then spot B, on the floor with the ring at the tip
of a controller held pointing down; orange crosses then show where the headset
puts the spots, and two anchors keep the calibration for next time and after
the headset was off; since v130 a headset keeps a calibration per shared room,
its place, so it lines itself up in each of several rooms, and joins the room
whose place it stands in by itself when it is in no room or one it joined by
itself: at most eight saved anchors in all, two for a new place, the places
made first going down to one each as more come (since v131; Places, in the
menu's Debug tab, with each place's Forget); since v131 one shared room can also
have more tape crosses in other areas (Room setup, its last page, Areas: a
lined-up headset adds them, every headset can calibrate on the nearest and lines
up again from them as it walks there, in the same room; since v139 every area's
crosses show while the menu is open and for 30 s after lining up); if
the panel says the anchor store is full, clearing Quest Browser's site data may
help, see relay/README.md; after standby the headset looks for its spots again
by itself and asks whether the orange crosses sit on them: if not, calibrate
again). A headset's own calibration is
never overridden, and the room's floor comes from the spots, so a headset
with a wrong floor still shows things at the same height. Headsets without
marks line up through Quest Browser's experimental shared space (on unless
switched off in the menu; every headset needs the same browser version
and the WebXR experiments flag), and line up again after standby; if one is
still off, press Re-align in its menu (it lines that headset up again
from the start), or calibrate it on the spots. If two calibrated headsets find the shared space puts them
far apart (each headset can keep its own copy of it), Fresh shared space in the
menu (twice) moves the whole room to a new address where the headsets
make a new one: start AR on one headset first, then the others. The relay keeps the headsets' logs in
relay/logs/ for checking alignment. After an update of the app (a deploy, a new release)
press Update the room (twice: the Shared dialog under the room's code, or the
headset menu's Circles tab): every device in the room reloads into the new
version, one after another, and comes back into the room; headsets then press
Enter VR to continue and are at their circle again (v136). A room also moves on
to a newer version by itself once the last device of the old one has reloaded,
and a device that joins it meanwhile waits rather than being refused. A relay
started with --keep <file> keeps its rooms across restarts. People elsewhere and
screens
see the stations round their own spot. Screens get a room map and Follow a
station, or Follow a person in a headset (in the Shared dialog's people list:
the screen shows whichever station they stand at, switching as they walk, for
people watching without a headset). An Android phone with AR (Chrome with Google
Play Services for AR) can film the room: Camera mode in its Shared dialog, or
the room's link with &camera added (#s=XYZ&camera: one big Start the camera
button), shows the room through the phone's camera as the headsets see it,
with the stories, the circles and the people in headsets. Aim at spot A on
the floor and tap Set spot A, then spot B, so it lines up with the headsets;
Follow a person or a circle in its small overlay; Panels, People, Sound,
Subtitles and Hide are the phone's own (a double tap brings the controls back),
and Exit ends it. It changes nothing in the room. Film it with Android's own
screen recorder (untested on a real phone).
A computer can be a preview camera for a TV or a projector (v153): Preview
camera in its Shared dialog, or the room's link with &camera added on a
computer, shows the room from one fixed spot as the headsets see it (the
stories, the circles, everyone in a headset). Place it on any page's room map
(drag the camera, or its handle to aim it), from a headset's menu (Place the
preview camera, then pull the trigger with the controller held where the
camera should be, aimed where it should look), or on the camera's own screen:
type its numbers (x, y, z in metres from spot A, aim, tilt, field of view),
hold WASD or the arrows to move it smoothly along the floor, Q and E for
height, J and L to turn it, I and K to tilt it (Shift: slow; Speed: slow,
normal or fast; Keys: steps moves it a step a press instead), click the picture
to look around with the mouse (Esc lets the mouse go) or drag it, + and - or
the wheel to zoom, R to level it. Labels and Cards hide the labels, name tags
and circles' cards on this screen only. Its controls and the mouse pointer hide
after 3 s without the mouse; Full screen and Stop are among them. Untested on a
real TV, projector, keyboard, mouse or headset.
Vive trackers (v126): when the relay runs on the PC with SteamVR and its trackers
(relay/README.md says how), the Shared dialog has The PC's trackers: Use the PC's
trackers in this room, then line them up by hand: lay a tracker flat on spot A
(the tape cross on the floor), pick it in the list, press Set spot A and leave
it still for a second, then the same on spot B. Move a tracker to see which row
lights, and give it a name there. The room map shows them as small dots; in a
headset, Trackers: shown on the menu's Debug tab draws each as a small puck with
its name. The PC's own page in VR with the Valve Index lines itself up from the
trackers (no spots and no shared space needed). Untested with real trackers.
The output page (v157; MIDI and OSC): a laptop or the room's PC (Chrome or
Edge) presses Output page (MIDI and OSC) in its Shared dialog, or opens the
room's link with &output added. It follows a studio circle and sends what
happens there as MIDI (to a virtual port: loopMIDI on Windows, the IAC Driver
on a Mac, a virtual ALSA port on Linux; then Cardinal, a DAW ...) and as OSC
(through a relay on the same machine or network started with --osc-out and
--osc-in): presses, sequences starting and stopping, trigger cubes walked into
and out of with who it was, people's heads and hands, the PC's trackers,
items, and streams such as a head's height as a controller. MIDI and OSC
coming in press items, start and stop sequences, show and hide items and
switch cubes, and MIDI clock sets the room's beat, which motions can follow. A
cube sends only when it is switched on on its card (Sends to the output
page); what it shows stays each person's own. The scene's sends are set on
the studio's cards; streams and incoming mappings on the output page (kept on
that machine; Export and Import). Setting it up: tools/output/README.md.
Untested with real MIDI and OSC software, virtual cables and headsets.
Talk (v178, rooms on a relay only): the people in a room who are not in the
same place talk to each other through the relay. Each device's own and off by
default: Talk: on (the Shared dialog, the headset menu's Circles tab, the phone
sheet) asks for the microphone and turns the sound on; Mic: muted closes the
microphone and only listens. Open mic: nothing is sent while you are silent,
and no button is taken. People in the same place never hear each other through
it (in AR a headset counts as being in the room until I am elsewhere on the
Debug tab; in VR answer the menu's question first). A screen always counts as
elsewhere: next to the headsets keep Talk off; headphones help. In a headset a
voice comes from the talker's head. The line under the row names what a
browser lacks. Untested on a Quest so far.
In a headset you stay in a story once you
have gone into its circle, wherever you walk, until you go into another
circle; while you are in one, the other stations show only their small 3D
models (point at one to see its card), and with the circles walked into a
circle's ring appears as you come within 2 m of it; other people are drawn only when they are
at your circle (People: everyone in the menu shows them all). Since v164 they are drawn as
whole bodies with legs and feet, in armour of their own colour, posed from their headset
and controllers (in AR only people who are elsewhere; Bodies: off, on the Debug tab, draws
heads and hands as before). My body (Settings tab, off by default) shows your own body when
you look down, in VR. Over each station's ring a small 3D model of its story turns, in its
colour, so you can tell the circles apart from across the room. A station moves with the grip on its ring, model or card in a headset (point
to swing it round, raise or lower to push or pull, twist to turn it), or by
dragging its dot (or its square, to turn it) on the room map; everyone sees it
move. Lock circles (headset menu or Shared dialog) then keeps them where they are,
until someone unlocks it. Recenter (on the story panel and next to Exit in the
headset's menu) at a station puts its scene and panel back where the story
starts them, for everyone at that circle (not while the story is locked). A
headset joins a room by its code from the menu: Join with a code (Another room
when already in one) opens a keypad for its three letters. At a station in a headset the grip moves the scene
or the story panel and both grips resize the scene, during the story too, for
everyone at once (unless that story is locked: Lock this story in the menu at its
circle, or Lock story per station in the Shared dialog; among the fish of Pass it on the
grip in the sea moves the school, for everyone there too); each station keeps
its story, so the story panel has no Stories button there: another story is
another station. In a headset the menu is closed at first (a note at the start
says how to open it). Click either stick to open the menu (it opens a moment
after the click, as two quick clicks move you with the sticks; with hand tracking,
pinch twice quickly with your left hand while it points at nothing); it floats
in front of you, about 80 cm away, with the time in its header, and the same, or
Close, closes it again; unused for 20 seconds it closes by itself. Point at it
and hold the grip to move it (nearer, further, higher or lower): it stays where
you put it, and opens there next time. It has four tabs: Story (the story
panel and play bar of the story on show, usable there as on the story itself,
so the story's controls are at hand even when its panels are hidden or out of
sight), Settings (Exit, which leaves VR or AR, as the story panels have none;
Recenter; Anchor; Slideshow and Repeat for every story; four headset settings
for every story; Frame rate, My body, Developer mode, My menu and Real world hides, this headset's own; Sound, this headset's own on or
off; the sound switches; the studio), Circles (the shared
room: rooms to join, a room by its code, Room setup, the stations, the locks,
Show all rings, circles walked into or asked first, the people, your name) and Debug (calibration and alignment, Check here, People, Bodies, Sound check, Trackers, Refresh rate, Foveation and Resolution, What is new, the version,
the connection and the frame rate). With hand tracking a fingertip presses its
buttons too, or pinch while pointing. Labels,
the small labels inside the scenes: on top (the default: drawn over
everything), in 3D (signs in the scene turned to you, hidden by what is in
front of them) or hidden. Cards, the larger ones (the story's text panel and
its play and pause bar, the stations' cards over the circles and people's name
tags): in 3D (the default: they stand in the scene, hidden by what is in front
of them), on top (drawn over everything, as before) or hidden (no story panels
at all, in the story and in explore mode, no station cards and no name tags;
the menu's Story tab still plays and pauses, and the menu brings them back). The
two are independent; each press goes to the next. Moving:
free (the default: the grip holds the scene like a real object and turns it
with your hand, two hands turn it too; the story panel can tilt; Recenter
puts things back) or facing you (things you move keep facing you and the
panel stays upright). Subtitles: off (the default) or on (the narration's words
in a strip low in your view while a story plays, following your head when you
turn away; #subs=on in a link turns them on; each device's own, and in a
shared room each headset's own over the room's default, Subtitles at the start
in the Shared dialog). In a shared room the other three settings are the
room's, the same for everyone in it (also set in the Shared dialog; the locks
do not stop them), and a scene turned at a station is
turned for everyone there.
#labels=face|fixed|hidden, #cards=face|fixed|hidden and #free=on|off in a link set them. Frame rate (off
by default, this headset's own, never the room's; #fps=on in a link): a small
read-out low in your view with the frames a second, the time a frame takes (on
average and at worst) and the story's triangles and draw calls, for checking
how heavy a scene is; pressing B or Y twice quickly turns it on and off. It
says the headset's refresh rate too ("88 fps of 90 Hz") and is green within
3 % of it, amber within 20 %, else red. Refresh rate (the Debug tab; 90 Hz by
default, this headset's own; #hz=72, 90 or 120 in a link): what each session
asks the browser for (Quest Browser runs a page at 72 Hz unless asked), each
press the next rate the headset offers; greyed in a browser that cannot set it.
Two experiments on the Debug tab, this headset's own: Foveation (as the story
sets it, the default, or 0, 0.5 or 1: less detail at the edges of the view,
less work for the headset; #fov=) and Resolution (100 %, the default, 90 % or
80 %, from the next session; #scale=). Moving
with the sticks (off by default, this headset's own, never the room's; #walk=on
in a link): click the left stick twice quickly, or use its row on the Settings tab,
and in VR the left stick moves you along the floor where you look and the right
stick turns you, smoothly as you push it (Turn: smooth, the default) or 30
degrees a flick (Turn: steps; the row under it, #turn=steps in a link); a controller whose grip is held keeps its
stick for what it carries. Not in AR (there you walk for real) and not in a
shared room (the others need to see where you really stand): there two clicks
say so. In the studio the two clicks switch its sticks between its own (walk,
turn, steer what you carry) and moving you, also while you carry something
(it comes along in your hand) and in a shared room too (the scene moves, so the
others still see you where you really stand). Turned off,
you stay where you moved to; a new session starts where you stand. A and X play
and pause nothing (play and pause are on the story's panels and the menu's Story
tab), but A boosts a spaceship. Spaceships (v132, a small game over every story,
VR or AR with a controller in your right hand): click the right stick twice (or
Spaceship: launch on the Settings tab) and a little ship flies from your right
controller. Steer it with the right stick (v133): right and left turn, forward
dives and back climbs, as in a flight simulator (at most 60 degrees: v134's
loops went again in v137); how you hold the controller does not matter (v132's
steering by tilting the controller went). While it flies a
click of the right stick counts only at its middle, so a hard push that clicks
does not land the ship. It always
flies forward; the grip brakes, held fully it backs off slowly; A boosts for a
moment; the trigger shoots. Shield and health 100 each: hits take the shield first,
which refills 2 s after the last hit; health does not. Destroyed, a new ship comes
5 s later. Drifting crystals and red-eyed drones fly about to practise on, and
stay when others fly too, so you can fight them together; now and then a pickup
appears (amber: a stronger boost for 15 s; red: faster shooting for 12 s; blue: 50
extra shield). In a shared room everyone in a headset sees every ship; the Shared
dialog's people list says who flies and what they destroyed. Click the right stick
twice again to land. There is no edge (v139): the crystals, drones and
pickups follow the flying ships about, only the floor and a 3 m ceiling hold a
ship, and in AR it flies through real walls. Nothing of it is kept. VR goggles
(v197): a studio scene may hold a pair (Add, VR goggles). In a headset, with
editing off, take them with the grip and bring them to your face: you fly a little
ship through the cell of Back into the cell, its real proteins in their places,
drawn over the room for you alone. Right stick: turn, climb, dive; grip: brake;
trigger: scan the protein in your sights, then fly to the green light to follow
its link to a partner. Sit or stand still: moved more than about 40 cm from where
you put them on, the game fades to the room and waits. Grip near your face and
pull away (or the menu's Goggles off) to take them off; the spaceship waits
meanwhile. My menu
(this headset's own, never the room's): only me (the default) or my circle. With
my circle, in a shared room the other headsets at your circle see your menu while
it is open, as a picture where it floats with your name over it, so you can show
someone where things are; they cannot press it, and it goes when you close it
(and while the relay's password page is open). The row's note says who sees it
now, or why nobody does (v139).
The Shared dialog's people list says who is showing their menu. Real world
hides (AR only, this headset's own, never the room's; #occl=both|room|depth|off in a link):
yes (the default since v195: what the headset's depth sees, people, hands, furniture,
anything moving), yes, with the room scan (its walls and furniture too: run Space Setup on
the Quest), room scan only, or nothing. Real things in front of a scene hide it as they
would a real object. Smooth edges (AR only, beside it, on by default, this headset's own;
#occlsmooth=on|off) softens the edges round real things at a small cost: turn it
off if the frame rate drops. The menu, the notices, the subtitles and whatever is set on top are never hidden; a studio
scene may ask for its own, until the next story. Panels, a fifth
row, is for the story on show only: shown, controls only (just the play bar
under the panel, good with subtitles) or hidden (play and pause on the menu's
Story tab); each story
keeps its own, in a shared room each station's, for everyone at its circle (also
per station in the Shared dialog); #panels=controls in a link sets it for the
story the link opens.
At a station the flock flies round the station's spot and the school of Pass it on swims there, the same for everyone
bird by bird and fish by fish (one device leads and sends every bird or fish three times a second, the others follow
it), with the same falcons and sharks: up to four of each at once, and everyone who is the shark has a shark of their
own, which the others see in that person's colour. The robots move separately on each device; their controls and crumbs are shared. Others join a room through the relay
(relay/, Node, no packages), which GitHub Pages cannot run: for now it runs on a
machine on the same Wi-Fi as the headsets and serves the app itself (node
relay/server.mjs --lan prints the https:// address to open on each headset; see
relay/README.md). GitHub Pages serves everything else; a copy there can join a
relay elsewhere with &relay=wss://... in the room link. Since v116 the owner's
Coolify server runs the test place (branch dev, the app and its relay at
https://stories.lab.lbi-netmed.com/, the studio's scenes in Cloudflare R2), while
the main site stays on GitHub Pages from main. Since v120 Coolify runs main too,
as the main site's relay (https://main.lab.lbi-netmed.com/), and the main site
offers it: the Shared dialog (or the headset menu's Circles, Relay password)
asks once for its password, and that device's rooms and the studio's scenes are
then on it; without the password rooms run peer to peer, as before; see
relay/README.md, "The test place on Coolify". #s=XYZ in a link joins
room XYZ. A relay can have a password (COLLAB_TOKEN; relay/README.md): each
device enters it once, in the Shared dialog or, in a headset, under the menu's
Circles, Relay password (a keypad of lower-case letters and digits). The device
keeps it for that relay; links and rooms never carry it. While a relay waits for
its password, nothing starts or is joined anywhere else. Vive trackers (v126): on
a Windows PC with SteamVR, node relay/server.mjs --lan --trackers and uv run
tools/trackers/bridge.py send every tracker's pose to the rooms on that relay
that turn them on, lined up by hand on the two spots (the Shared dialog's
Trackers); setting it up: tools/trackers/README.md (untested with real
trackers). The output page's OSC (v157): node relay/server.mjs --lan
--osc-out 127.0.0.1:9000 --osc-in 9001 sends OSC on UDP only to the targets on
its command line and takes OSC in on its port, from this machine only unless an address such as
0.0.0.0:9001 is given (relay/README.md, "OSC and the
output page"). Without a relay (none known, or none answers) a room runs peer to
peer: one page hosts it and the others link to it directly (PeerJS, vendored;
its public introduction server and Cloudflare's STUN server introduce the
devices, and they and the other devices see each device's IP address). The
dialog and the menu say "peer to peer · hosted here" or "hosted by" a name.
Start such a room on a laptop or desktop page that stays awake (a headset that
starts one hands it to the first such page that joins); when the host leaves,
the one longest in the room takes over within seconds (up to about a minute
when it vanished without leaving). It needs internet access and a network that
lets devices reach each other directly (bring your own router; the test page
p2p/ checks a network first). There is no Fresh shared space and no stored logs
then. &peer=host:port/path in a link uses another introduction server (the
relay has one at /peerjs), &peer=off none. When peer to peer cannot be had
either, a room still works on
the device alone: Start a room here in the headset's menu places the stories in
your room (Arrange all, moving them, Lock circles, calibrating); the room is kept
on the device, and once a relay answers it moves there and others can join it.
Rooms on this network (the same router or internet address) are listed in the
Shared dialog and the headset's menu, one press to join; a device that was in a
room joins it again by itself when the app opens on that network within a week
(never one it left or was never in; elsewhere it offers Start room XYZ again,
and Show on this network hides a room). Only a short hash of the network's
address is used, never the address itself.
Nothing changes for anyone not in a room. Tried on two Quest 3 headsets in one
room several times; what they did, and what is still unconfirmed, is in
docs/quest-shared-space-findings.md.

Upload the whole folder to any HTTPS web server (GitHub Pages, Netlify,
your university web space ...). Installing and VR both need https://.

VR asks the headset for less than AR (no room scan, no shared space): a Quest 3
left VR for its home at once when asked for everything. If VR still closes by
itself within 10 seconds, press Enter VR again: each such try asks for less.
Sound check shows what VR asks for now.

Install:
- Meta Quest Browser: open the page, then use the Install button in the
  address bar (or the "Install" button in the page's top bar if shown).
  The app then appears in your Library under "Unknown sources"/apps.
- Chrome / Edge (desktop, Android): Install button in the top bar or the
  install icon in the address bar.
- iPhone/iPad Safari: Share > Add to Home Screen.

Narration: every story keeps its recording in its own folder,
packages/<key>/audio/narration.mp3 (the pass story's German packages/pass/audio/narration-de.mp3
beside it), listed in packages/index.json by node tools/packages/scan.mjs (the airports
one is a human recording; every other story has a synthetic voice, made by tools/voice/: Kokoro's American af_heart,
and for the pass story's German Piper's Thorsten); see the note in the audio folder for chapter timings
and how to record one, and docs/narration.md for the words. It plays in
sync with the story, follows pause, seeking and chapter jumps, and has a Sound
on/off button (top bar, and Sound in the headset's menu under Settings). On a
page (a phone, a tablet, a computer) the sound is off until you turn it on: the
button says Sound off, and a press turns the narration and the effects on; each
device remembers its choice, and #sound=on or #sound=off in a link sets it. In a
headset (VR or AR) the effects are on from the start and the narration is off
until you turn it on with the story panel's button (Narration on / Narration
off) or the menu's Narration row; the headset remembers it. In a shared room the
menu's Circles tab has Narration for everyone here (On for all, Off for all),
and the page's Shared dialog the same: each headset can still change its own
afterwards, until it goes to Back to the lobby. Muted, a story runs on its own clock with its subtitles. Browsers
only start sound after a tap or click: the first one in the app (Enter VR
counts) starts it for every story, also when you change story inside the
headset. If the button says Play sound, press it. Without the file the story runs silently, at a pace that leaves time
to read its panel (tools/pace.mjs sets it from the words).
No sound? Open Sound check on the Stories screen (on the page; in a headset in
its menu's Debug tab): it shows what the sound system is doing, plays a test beep
through each of the app's two ways to play sound (Web Audio and an audio
element) and lets you choose the one you hear. Reset clears the saved choices.
A link ending in #soundcheck opens it.
Sound effects (clicks and chimes for buttons and the shared room, each story's
own sounds at its moments and in explore mode, and a quiet background for the
flock and Pass it on only, all made in code) are on unless turned off. Two
switches, each for every story at once: Sound effects and Narration (off: the
narration is silent and the story runs on its own clock; subtitles and effects
go on). They are in the headset's menu, the page's Shared dialog and Sound check,
and #sfx=off or #voice=off in a link sets them; in a shared room Sound effects is
the room's, for every page and headset in it, once someone there sets it (until
then each device keeps its own), and the narration as above. The effects' volume (Sound check, the
headset's menu) is each device's own. The Sound button (off until pressed) silences the narration
and the effects together on that device, and the effects dip under the
narration while it plays. tools/sfx.html is a sound board that plays every one and renders a
story's whole sound track; node tools/sfx-render.mjs writes them to files
(--story <key> for a story's track), and node tools/sfx-cues.mjs checks every
story's sound cues.

After changing any file (including adding or replacing a narration file),
bump VERSION in sw.js so installed copies update, then run node
tools/release.mjs (it writes version.json). Online, the app always fetches
its shell files fresh (the cache is for offline use). Each story's file and
miniatures are taken when the app is installed or updated, only the ones
that changed, so every story opens offline; a story's other files and its
narration are kept once it has opened or played on the device, so offline
you have the narrations you have heard (Take all stories takes the rest). A copy that is open picks up
a release by itself, about once a minute: new and changed stories are taken
without losing your place (the story on show is swapped at a quiet moment),
and a new shell asks first (Reload now or Later; on the Stories screen it
reloads by itself). While developing, node relay/server.mjs --static . --watch swaps a
saved story in place on every page and headset showing it.

Protein data: an illustrative, hand-curated subnetwork of 254 well-documented
human proteins and 375 interactions (complexes and pathways from the
literature), not the full interactome. Essential genes follow DepMap common
essentials; disease genes are a small textbook set. Statistics were computed
with NetworkX (Louvain modules, betweenness). Good for teaching, not research.

Cell map data (spatial.html): an illustrative, hand-curated set of 249
well-documented human proteins in 13 compartments of a model cell. Proteins
found in several places get one copy per place (282 copies), joined by dotted
lines; 252 documented interactions join copies that meet (same compartment, or
across a membrane they share). Places follow the Human Protein Atlas and
UniProt. Seven "moves" (NF-kB, apoptosis, TFEB, GLUT4, NRF2, and the disease
cases ALS and cystic fibrosis) switch copies on and off. The lists PROTEINS,
LINKS, TOGETHER and MOVES sit at the top of packages/spatial/main.js and can be
edited; the cell model and protein positions are built when the page loads.
Good for teaching, not research.

Tour data (packages/lbi/main.js): mostly illustrative and built when the story
loads. The interactome has about 9,100 proteins and 22,100 interactions, of which
the 254 named proteins (in ten groups) are the curated set of the
network-medicine story. The friendship globe uses the real positions of the
3,214 airports; its ties are illustrative. ATP synthase follows the textbook
structure (13 of its proteins, two of them assembly helpers that leave;
8-subunit c-ring, 8 protons and 3 ATP per turn). The immunity Sankey uses the totals of Guthrie et al. 2023 (173 genes,
9 clinical categories, 19 clusters); the flows between them are illustrative,
as are the disease modules, the patient, the organ network and the tissue.

Muscle story data (packages/nmd/main.js): the authors' analysis files (kept out of the repository)
(no patient data): 13 disease groups of the 2024 Gene Table of Neuromuscular
Disorders, their known genes, the genes the random walk added and their
endotypes; 15,246 links among 1,182 genes in the 27 protein layers, and the
phenotype and co-expression layers for the overlap of congenital myopathies and
cardiomyopathies. The other layers show no links yet. Layer z-scores and walk
visits are computed in this map on the protein layers; endotype names are the
most typical GO process of their genes. The motor unit and the supercomputer
are illustrative.

Endotype story data (packages/endo/main.js): the authors' EndotypY run on congenital
myasthenic syndromes (no patient data): the 35 genes of the Gene Table of
Neuromuscular Disorders, their protein network (18,306 proteins, 316,613
links) and their 12 endotypes of 393 genes. Only the numbers the story needs
are in the repository (packages/endo/src/sets/data.js), not the authors' files. The
steps before the endotypes (seed groups, the walk, neighbourhoods, the GO
annotation, the tree) are re-run with the package's default settings to show
the method; the tree is drawn to agree with the authors' endotypes. Endotype
names follow their strongest COMPARTMENTS term. The synapse is illustrative.

PET story data (packages/pet/main.js): the paper by Geist et al. (Med 6, 100881,
2025; CC BY 4.0) and the poster "Shaping a New Era in Nuclear Medicine". No
patient data: the network of all 658 scans is printed in the paper (Figure 2A);
the other networks are read off its figures (packages/pet/src/data/figures.json).
Typical organ uptakes and the synthetic cohort behind explore's matrix and
scatter views are illustrative stand-ins. node packages/pet/src/data/gen_data.mjs
writes packages/pet/src/sets/data.js.

Microanatomy story data (packages/micro/main.js): the preprint by Buljan, Bago-Horvath
and Rendeiro (bioRxiv 2025, CC BY-NC), its poster and talk, and Iva Buljan's
network of organ architecture (kept out of the repository; only the numbers
are in packages/micro/src/sets/data.js, from node packages/micro/src/data/gen_data.mjs). The
slides and sections are drawn, not the GTEx images.

Aging ovary story data (packages/ovary/main.js): the poster "Mapping the histological
landscape of human ovarian aging" by Chakraborty, Moustafa and Rendeiro
(public; data GTEx). Its numbers are typed in (packages/ovary/src/sets/data.js, from
node packages/ovary/src/data/gen_data.mjs), values read off its figures are in
packages/ovary/src/data/figures.json. Its neighbor network is illustrative, and the
counts on the ovary are read off the poster's lines (approximate); the ovary,
slides and sections are drawn, not GTEx images.

Qubits story (packages/qubits/main.js): after Joel Hancock's method and figures
(network compression onto qubits and the Pauli decomposition). The networks it
shows are examples made up for the story and computed in the page (no STRING
data, no gene names, no patient data); the real run's summary numbers (on
STRING v12.5) are typed in from his brief (packages/qubits/src/sets/data.js) and shown
only as "in the real network". The cut stands in for the authors' beam search,
and the walkers' valleys are illustrative. This story alone uses American
spelling, as its author asked.

The mutation machine (packages/mutation/main.js): after the poster "Converting
Mutation into a Machinery: DNA Substitution Models as Quantum Circuits" by Enes
Berk Sakalli and Arndt von Haeseler (a draft) and the first author's answers to
our questions. As in the authors' own test, the numbers drawn are examples,
computed in the page (packages/mutation/src/sets/mmath.js); the poster's numbers are
typed in (packages/mutation/src/sets/data.js) and shown only as "in the authors' test".
The coupling computed live is our stand-in for their circuit, and says so. The
test is synthetic (no patient data); the poster's figures are redrawn in 3D, its
pictures never shown.

The shape of tissue (packages/topo/main.js): after the poster "topocyte:
scale-resolved topological phenotyping of tissue architecture across spatial
modalities" by Simon Schindler, André Rendeiro and Jörg Menche, and the
package's documentation (topocyte.lab.lbi-netmed.com). Every number is computed
by the authors' package topocyte and the poster's own figure scripts on the
authors' GTEx liver cohort (123 slides, 66 healthy and 57 with cirrhosis, 30.8
million cells found by HistoPLUS, CC BY 4.0), by packages/topo/src/data/gen_data.py;
the page only looks the numbers up (packages/topo/src/sets/data.js). The authors'
files, slide ids, donor details and images are not in the repository: slides
are numbered, and the tissue is drawn from the cells' positions and types.
topocyte (GPL-3) is run offline only, none of its code is in the app. The cell
types are the cell classifier's labels; the genes and proteins of the last
chapter are sketches of the workflow, not data.

Holding on to nitrogen (packages/soil/main.js): after the slides "Exploring the
Effects of Biological Nitrification Inhibition on the Rhizosphere Microbiome of
a BNI-enabled Winter Wheat" by Marina Montserrat Díez, Tadashi Yoshihashi,
Guntur Subbarao Ventaka, Eleftheria Bachtsevani, Dimitrios Karpouzas, Christina
Hazard, Melina Kerou and Christa Schleper (University of Vienna, University of
Thessaly, Université Lyon 1, JIRCAS), and their field trial's data, shown with
the authors' permission (made for the Global Peter Drucker Forum in Vienna).
The field measures, the microbes and the network are the trial's data (the
network built for this story with a standard method: correlation, not
interaction); day 70's chlorophyll, the jars' nitrous oxide and the qPCR counts
are read off the slides; the soil block, its flows, the relay and the field's
layout are illustrative, and the story says so. The authors' files are not in
the repository (packages/soil/src/data/gen_data.py reads them); kinds of microbe are
numbered, and none of the slides' pictures is shown.

The switch that sticks (packages/cdk5/main.js, on the Experiments set): written
by Christiane Hütter on a fork of the app, after the Menche lab's public
repository CDK5_data (github.com/menchelab/CDK5_data): its CDK5_analytics VR
project, six scenes on the human interactome (16,376 proteins) made with
cartoGRAPHs. Every layout, colour and link is the authors', decoded from their
textures by packages/cdk5/src/data/gen_data.py (the clone is not in this
repository); the close-ups at the centre, the tags, the counts of disease terms
among CDK5's partners and neighbours, and the names of the process knots (from
today's Gene Ontology) are ours, and the story says so.

Pass it on (packages/pass/main.js): an outreach story of the Ludwig Boltzmann
Institute for Network Medicine, in English and German (a switch, EN | DE, on the
story panel and above the explore tabs; German when the device's language is,
remembered on the device; #pass&lang=de in a link). The globe is the airports
story's own (OpenFlights routes, Natural Earth coastlines) and the cell the cell
map story's own (Human Protein Atlas, UniProt), taken unchanged from those
stories when it is built. The fish are a live simulation, and the outbreak is a
simple model on the real route network, not a forecast (every route counts the
same, an airport stands for its city, no real disease's numbers).

Flock (packages/flock/main.js): a live simulation, not data. Each bird follows its
seven nearest neighbours (Ballerini et al. 2008) and keeps its distance; the
flock as a whole wheels about in front of you and now and then swoops round you;
a falcon sets off a wave of alarm that passes from neighbour to neighbour. Sky, land and birds are illustrative.

Your guide (packages/tutorial/main.js, the tutorial): a robot guide, the armour figure
people have in a shared room, posed by code from a script; its moves and words
were written by Claude. It stands about two metres in front of you on your floor
and shows how to point, play a story, explore, open the menu, Recenter and share
a room; then explore mode is practice, seven small tasks it nods at (the ticks
are your own). On a screen it runs as a window onto the room; it is made for a
headset. Its narration is not recorded yet (the voice will be the stories'
synthetic one); in a headset with narration off it waits once for you to turn
the voice on, or to press Play.

Robot gang (packages/robots/): a live simulation, not data, and no particular
brand of robot. On a screen the robots live in a model living room and you click
the floor to walk. In a headset they use your own room: every story asks the
headset for the floor, walls and furniture of its room setup (WebXR plane and
mesh detection, an optional feature; the Quest Browser may ask you to allow
it). Without a room setup they get a virtual room round you, and the panel
offers Set up your room. Point at the floor and pull the trigger to spill
crumbs. Speeds and cleaning times are tuned to look right, not measured.

Files: index.html (the app), packages/ (every story and the tutorial, each a story package since v187: main.js,
story.json, its narration in audio/, its sources in src/; order.json their order, index.json written by
node tools/packages/scan.mjs), stories/ (the studio and list.js; design.js, the design room's, unused since v217),
version.json (the latest release: running copies pick up new and changed stories from it, written by
tools/release.mjs), proteins.html and
spatial.html (forward to the app), manifest.webmanifest, sw.js (offline cache), audio/,
shared.js (shared rooms), sfx.js (sound effects; tools/sfx.html is its sound board), occlusion.js (real-world occlusion in AR) and ships.js (the spaceships), both loaded when a headset session starts, flight.js (the VR goggles' flight through the cell, loaded on demand by the studio), notes.js and notes/ (the developer notebook, loaded with developer mode, and its notes page), perfrun.js (the performance run: every story and some studio scenes played and measured by themselves, and a short hands-on test; developer mode or #perfrun), peerjs.min.js (PeerJS, MIT: peer-to-peer rooms), p2p/ (a test page: do devices link
directly? Two laptops on a local network did, 29 October 2026), relay/ (the shared rooms' server; with --scenes it also serves and saves the studio's scenes; with --trackers it takes the PC's Vive trackers), tools/trackers/ (the trackers' bridge for SteamVR, a fake one for tests, and the plan), docs/ (the shared rooms' plan and the handover notes), HANDOVER.md (start here when taking the project over),
AGENTS.md and CLAUDE.md (notes for AI coding agents), tools/smoke.mjs (headless test),
tools/collab.mjs (headless test of shared rooms, peer to peer too; node relay/test.mjs tests the relay),
packages/lbi/src/ (sources of the tour; node packages/lbi/src/build.mjs writes packages/lbi/main.js),
packages/nmd/src/ (sources of the muscle story; node packages/nmd/src/build.mjs
writes packages/nmd/main.js), packages/endo/src/ (sources of the endotype story; node
packages/endo/src/build.mjs writes packages/endo/main.js), packages/pet/src/ (sources of the PET story; node
packages/pet/src/build.mjs writes packages/pet/main.js), packages/micro/src/ (sources of the microanatomy story; node
packages/micro/src/build.mjs writes packages/micro/main.js), packages/ovary/src/ (sources of the aging ovary story; node
packages/ovary/src/build.mjs writes packages/ovary/main.js), packages/qubits/src/ (sources of the qubits story; node
packages/qubits/src/build.mjs writes packages/qubits/main.js), packages/mutation/src/ (sources of the mutation story;
node packages/mutation/src/build.mjs writes packages/mutation/main.js), packages/topo/src/ (sources of the tissue topology
story; node packages/topo/src/build.mjs writes packages/topo/main.js; its data from the authors' files, not in the repository),
packages/soil/src/ (sources of the soil story; node packages/soil/src/build.mjs writes packages/soil/main.js; its data from the
authors' files, not in the repository),
packages/cdk5/src/ (sources of the CDK5 story; node packages/cdk5/src/build.mjs writes packages/cdk5/main.js; its data from a
clone of the Menche lab's public CDK5_data repository, not in this one),
packages/exposome/src/ (sources of the exposome story; node packages/exposome/src/build.mjs writes packages/exposome/main.js,
also from the cell story's model cell and the airports story's globe; its data from the authors' Zenodo deposit, not in the
repository),
packages/pass/src/ (sources of the pass story; node
packages/pass/src/build.mjs writes packages/pass/main.js from them and from the airports and cell map stories;
packages/airports/, proteins/ and spatial/ are hand-written: main.js is their source), packages/flock/src/ (sources of the flock; node packages/flock/src/build.mjs
writes packages/flock/main.js), packages/robots/src/ (sources of the robot gang,
a story package: node packages/robots/src/build.mjs writes packages/robots/main.js), packages/tutorial/src/ (sources of the tutorial; node
packages/tutorial/src/build.mjs writes packages/tutorial/main.js, node packages/tutorial/src/test-script.mjs checks the guide's script), tools/design/ (sources of the design room, parked since v217; node
tools/design/build.mjs writes stories/design.js), tools/studio/ (sources of the studio; node tools/studio/build.mjs
writes stories/studio.js; its README is the formats guide), tools/lowpoly/ (the miniatures' kits; node tools/lowpoly/build.mjs writes
lowpoly.js, the shell's own miniatures, and each package's minis.js from its src/minis.js: the miniatures the stations'
icons use), tools/voice/ (a
synthetic narration: node tools/voice/narrate.mjs <story>; German with Piper), tools/release.mjs (writes version.json), tools/live.mjs
(headless test of live updates), tools/icons.html (the stations' icons side by side),
icons/, three.min.js (three.js r128, MIT licence, see three.LICENSE.txt), LICENSE and NOTICE.md (the licences).

Licence: the code is under the MIT licence (LICENSE). The stories' words, the
narrations (the airports' recorded, the others synthetic), the documentation
and the icons are under CC BY 4.0. The data in the
stories keeps its sources' terms, and the parts written by others keep their
own licences: NOTICE.md lists them all.
