# Quest shared spaces: what we learnt

October 2026. From a WebXR app that lines up two Quest 3 headsets in one room (Quest Browser) for one shared
scene. It adds to the notes `shared-spaces.md` and `multiplayer.md`. Their design held: keep a room frame in each
headset's `local-floor`, pass it on through the shared space, use two tape marks as the fallback, keep anchors to
follow origin jumps, and follow a new frame only past 3 cm or 1 degree. What the notes did not say is how Quest
behaves. We learnt that from alignment logs both headsets sent to our relay. Each item says what we saw and
what we do about it.

## In short

1. Give every headset the same Quest Browser version. The same shared-space id does not mean the same space.
2. The first headset's space is exactly its own floor. Decide "first" or "not joined" when the id appears, from
   frames published for that id and from other headsets that say they are aligned through it.
3. A `local-floor` reset transform maps old coordinates to new ones. Use only its turn and its move along the floor.
4. After waking, the shared space gives the head's pose for up to 15 s. Ignore it, and hold the frame.
5. Take the room's floor from the tape marks, not from each headset's floor.
6. The persistent anchor store fills up. Delete unknown anchors, then ask again.
7. Send each headset's log to a server. Nothing here could be seen from inside one headset.
8. Leave Physical space features on and run Space Setup. Without a room scan, two headsets on the same version
   and address were in two spaces 2.6 m apart under one id.

## 1. One browser version on every headset

- **The same id is not one space.** In three tests both Quest 3s reported the same shared-space id, but they
  were never in one space. Quest Browser 149 got the id at once with an identity pose: its space was its own
  floor, a new place every session. Quest Browser 150 got a default space for 1.5 s, then the real one, which
  held to 1-2 cm over 71 minutes and three sessions.
- So the error between them was a different rigid offset each session (0.9 m and 19 degrees, then 1.2 m and 28,
  then 2.4 m and 84). That is two spaces, not one inaccurate space.
- With both headsets on the same version, the shared space lined them up with no tape at all.
- What we do: show the browser version on the panel. Judge a space by how far it puts two calibrated headsets'
  marks apart (shown on the panel too), never by its id.
- Read the id every frame. It is empty right after the request, and it can arrive or change without a reset.
- Our reading of the pose is right: `floorFromShared = inverse(localFloorInLocal) x getPose(shared, local)`. It
  kept each headset's own marks in one place across its resets to 1-2 cm. Read the other way round they moved
  by 80 cm and more.

## 2. First in the space, or not joined?

- The first headset's space is exactly its own floor (an identity pose). So is a space a headset has not really
  joined. The pose cannot tell them apart.
- We decide once, when the id appears: if someone in the room has already published a frame for that id, this
  headset is not the first. An own-floor space then means "not joined": nothing is taken or published through
  it, and the panel says "Not in the others' shared space".
- If someone here published for a different id, the others are elsewhere. This headset's own space then never
  becomes the room.
- **Leaving AR and entering it again.** With both headsets on Quest Browser 152, one left AR and came back. Its
  space came back under the same id but as its own floor, while the other headset's space stayed exactly where it
  was: two spaces again. It had published the room's frame itself, so the rule above (a frame by someone else)
  did not apply, and it took its own old frame through the new space: the room stood somewhere else for it alone.
  What we do: every headset sends its space id and how it is aligned with its presence. A headset whose space is
  its own floor while another headset here is aligned through a space with that id has not joined, whoever
  published the frame. We make that call once per session for each id, so asking for the space again later
  never turns the true first headset (whose space is its own floor too) into "not joined". To fix it, restart the
  browser on both headsets and start them one after the other, or calibrate both on tape.
- An own-floor space drifts: up to 8 cm (its turn under half a degree) in our logs. A test at 2 cm flapped. We
  enter "own floor" within 2 cm and 1.5 degrees, and leave it only beyond 15 cm or 2 degrees.
- **Physical space features off.** With that developer setting off (no boundary, and no scan of the room), two
  Quest 3s on Quest Browser 152 at the same address got the same id and were in two spaces 2.6 m and 11 degrees
  apart. Neither space was its own floor, so nothing in the poses could tell; only both calibrating on the same tape
  showed it. Meta staff say turning the setting off may also turn off spatial anchors. What we do: a headset whose
  session has plane detection but finds no plane or mesh within 20 s says it has no room scan. Once two calibrated headsets find
  the space puts their marks more than 10 cm or 3 degrees apart, the room marks that space as split and nobody takes
  anything through it while both are there.
- A switch that turns the shared space off should not be remembered. One headset had it left off and quietly ignored
  the space in every room of an evening.
- The id stays the same across sessions and days, so a frame stored for it may be last time's. If its writer has
  left, everyone waits 8 s, then the first headset replaces it with its own.

## 3. Standby and waking

- **Reset transforms.** On waking, `local-floor` fired two `reset` events with a transform. The matrix carries
  points from the old coordinates into the new ones, the opposite of how we had read the spec. Applied inverted,
  it turned the room -126 degrees instead of +126. Applied this way, it matched a fresh calibration on the same
  tape within 1 to 1.5 cm.
- Its height is the change in the head's height, not the floor's. Use only its turn about the vertical and its
  move along the floor.
- **The head glitch.** For up to 15 s after waking, `getPose(shared, local)` returned the head's pose on both
  headsets. Frames published or compared then were metres out. We ignore a shared pose within 5 cm of the head,
  and publish or compare nothing through the space for 20 s after waking.
- **Holding the frame.** After waking, the frame the resets carried over holds until the shared space agrees with
  it again (10 cm and 3 degrees along the floor), or until the space has held still for 5 s and is not just this
  headset's own floor.
- **The height.** The floor came back 12 to 17 cm off after waking. With the shared space in use we keep the
  room's height in the space's coordinates, not over the floor.
- **Anchors.** Anchors made during the session were not tracked again after waking. We wait up to 5 s, then look
  them up again by their persistent handles. Waking never drops a calibration: asking to calibrate after every
  wake was worse.
- **After a night** (seen once, no logs yet): one of two headsets was offset, the other right. Our reading: the
  space can come back made again under the same id, around whichever headset woke first. So we hold the frame the
  resets carried until the space agrees, judge a space that disagrees only after 20 s, write our own frame into it
  (never into one that is just our own floor), and follow someone else's frame through a disagreeing space only if
  it was written after we fell asleep (frames carry a write time). A **Re-align** button lines a headset up again
  by hand: it asks for the shared space again and has whoever wrote the room's frame write it again.

## 4. Floors and origins move

- Two headsets' floors differed by 28 cm in one test and about 50 cm in another. One wearer's head read 1.9 to
  2.05 m.
- What we do: the first headset to calibrate stores mark A's height over its own floor (and the distance between
  the marks, to recognise the same marks later). Every other headset puts the room's floor that far below its own
  mark A, and the panel says by how much its floor differs.
- In one session a headset's whole origin jumped 5.5 m and its floor 0.7 m. In our logs a recentre moved
  `local-floor` with no `reset` event we could see. Two anchors at the marks (positions only) catch both.

## 5. The persistent anchor store fills up

- `requestPersistentHandle` failed with "Maximum number of anchors reached!". One Quest 3 refused every handle
  with 9 anchors listed for the site; the other saved with 11 listed. So the limit is not simply per site. Meta's
  docs say 8 per site; the browser's author says a limited set across all sites.
- That headset asked to calibrate after every restart.
- What we do: at session start, delete saved anchors nobody knows (`session.persistentAnchors` minus our own
  handles). When a handle is refused as full, delete again and ask once more. If it is still refused, the marks
  hold for this session only, and the panel says a restart will ask to calibrate. Clearing the browser's data
  should free the store (not confirmed on our headsets).

## 6. Calibration details

- Take a mark where the controller's ray origin was 70 to 260 ms before the trigger: pulling the trigger moves
  the controller. Show that point as a ring.
- Ignore a second pull within 0.6 s (a double pull once took mark B 0.1 s after mark A). Ask for marks at least
  50 cm apart, and add a note when they are more than 5 cm apart in height.
- A headset's own marks always win over a frame from the shared space. A calibrated headset still publishes its
  marks through the space and shows how far the space puts another calibrated headset's marks from its own.
  That distance is the best accuracy test we have.

## 7. Log to a server

Every 10 s each headset in a room posts its log to the relay. The log holds alignment samples every 5 s (the
frame, `local-floor` in `local`, the shared space in `local-floor`, the head, the anchors), every reset with its
transform, anchor results with the browser's reasons for refusals, the browser version and the page address.
Comparing both headsets' logs afterwards found every item on this page.

## Still untested on headsets

Whether headsets line up again after standby (and after a night) with these rules, whether asking for the shared
space again joins the others' space, whether restored persistent anchors hold, whether a recentre ever fires a
reset, and whether a headset that left AR and came back is now told it has not joined.

## Sources

- Shared spaces explainer and demo: https://github.com/cabanier/shared-spaces
- Meta, WebXR mixed reality (anchors and their persistence):
  https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/
- Persistent anchor limits and deleting them: https://github.com/immersive-web/anchors/issues/79
