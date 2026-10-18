# Shared space: one room frame for several headsets (Quest)

How co-located headsets agree on where things are, so people in one room see the same virtual objects in the
same physical place, can point at them together, and so on. Condensed from another WebXR project that built and
tested this on two Quest 3 headsets (Quest Browser 152, October 2026). *Verified* marks what was seen on
devices; the rest is design or the browser vendor's explainer. Syncing state between the headsets is in
[multiplayer.md](multiplayer.md).

## 1. The problem

Each headset tracks in its own reference space. With **`local-floor`** the floor height agrees (gravity, y = 0
on the floor), but the yaw and the x/z origin do not. WebXR anchors exist on Quest Browser (persistent ones
too) but only per device; Meta's shared spatial anchors and colocation are for native apps, except through the
experimental *shared spaces* below.

## 2. Use `local-floor`, never `local`, for anything shared or saved

- `local` puts the origin at the head when the session starts and makes it again per session and on every
  recentre: a room frame or a placement saved in `local` coordinates lives in a dead coordinate system after
  the next entry. This was the main cause of "quirky alignment" there.
- `local-floor` was taken there for the Guardian (stage) origin, stable across sessions; only the viewer height
  was *verified* (1.73 m standing). **This app's first test on two Quest 3s says otherwise**: in upstream
  Chromium's OpenXR path `local`/`local-floor` start at the headset's pose when the session starts (or at the
  last recentre), a recentre moves them **without a `reset` event** (Chromium dispatches resets without a
  transform, and OpenXR never sets the reset flag), and a floor not known is estimated 1.6 m below the head. So
  coordinates saved in `local-floor` are stale next session and after a recentre: keep a room frame on
  anchors, or calibrate again.
- **This app uses `local` today** (`setReferenceSpaceType('local')` in every story's `e5_xr.js` or its hand-written
  copy) and treats the floor as 1.6 m below the head. A shared space needs `local-floor` (with a fallback to
  `local` when it is refused), and every story's placement code must then use the known floor.

## 3. The room frame

- **Room frame** = an origin and a horizontal x axis per headset, in that headset's `local-floor` space. Make it
  the matrix of **one root group** that holds everything placed in the room (there: panels, the graph box;
  here: the stations, their panels and stories). Content is then stored in room coordinates natively, and a
  calibration, an adoption from another headset or a reference-space reset only changes that one matrix.
- Store every shared pose (station places, panel poses, pointers) in room coordinates, in metres.
- A **reference-space reset**: with a transform, correct the frame (content follows through the root); without
  one, change nothing (with `local-floor`). Attach the `reset` listener at session start, not on the first frame.
- Never let a reset move shared content for everybody: shared poses live in room coordinates and are never
  rewritten by a local reset (only the local frame is).
- Stick locomotion in VR must move the rig (or the room transform), never every scene child, or shared poses
  drift per person.

## 4. Getting the frame: the alignment state machine

One idempotent `ensureAligned()` per session, run on headset entry **and** when the session connects (joining
while already in AR must align too). States: unaligned -> shared space adopted | shared space defined | marks
-> aligned; show the state in the UI.

In this app (after the first test on two Quest 3s, where neither the shared space nor the marks lined the
headsets up: the shared space overrode each fresh calibration, see below), first found first:

1. **This headset's own marks**: calibrated this session, or last time's found again by the **two anchors** made
   at them. Nothing overrides them: tape marks are the truth. With a shared space, the headset publishes its
   frame for that space (with the marks, so others can draw them) and only *reports* how far the shared space
   puts another calibrated headset's marks from its own (a line on the panel: the measure of the shared
   space's accuracy).
2. **A frame published for this shared space** (key `rf.<id>`, grade `marks` or `shared`), **unless switched off**
   (*Shared space: not used* on the panel; it was off by default after the measurements in section 9, and is on
   again since two headsets on one browser version lined up through it): adopted by headsets without marks
   ("Aligned automatically"), first on the headset's own floor and then held at that height in the shared space,
   followed when it moves by more than **3 cm, 1 degree or 2 cm in height** ("Re-aligned"). An adopted frame is
   never published again. A space that is just this headset's own floor is the first headset's, or, when someone
   present had already published for the id as it appeared, not joined: nothing is taken or published through it
   then. A frame from someone who has left may be last time's (the id stayed the same across days): taken only
   after 8 s, and replaced by the first headset's own space. A height change alone moves things without a
   notice.
3. **The shared space's own origin** when nobody (still here) has published for it ("Shared space found"; also
   unless switched off), published with grade `shared` (unless the room was calibrated in another space by someone still
   there: then calibrate).
4. **Two-point calibration**: the person touches mark A, then mark B (tape crosses on a table or the floor, a
   metre or more apart, at least 50 cm). A gives the translation, A->B the yaw, gravity the rest. The point
   taken is the controller's target-ray origin where it was held still 70 to 260 ms before the trigger (the
   pull moves the hand); a bright ring shows that point while calibrating, and orange crosses show the marks
   afterwards, where the headset puts them, so a bad touch is seen at once. Expected accuracy 1-2 cm and under
   1 degree with a metre between the marks.

What went wrong before (phase 0): the shared space came first and a headset's newer marks went out to the
others through it, so every calibration was transported through the shared space's error to the other
headset, and calibrating that one only sent the error back; frames that were not calibrations were stamped
"now" and so beat older real marks; saved `local-floor` coordinates were used when the anchor was not found;
and the anchor's orientation was trusted for the room's direction.

VR users and people in other rooms skip all this: their room frame is their own floor origin (they share the
content, not the room).

**Persistent anchors** (Quest Browser, optional feature `anchors`, *verified* working): create **two**, at mark A
and mark B, after each calibration, and use **only their positions** (an anchor's orientation is not trusted;
WebXR does not promise to keep the one asked for). Check them once tracked: new ones within 5 cm of where they
were asked for, restored ones as far apart as the marks were; else drop them. Keep their handles in
`localStorage` (never the coordinates alone), delete the old ones (**8 per site**). They keep the frame on the
marks when the origin moves (a recentre) and find the marks next session. Restoring took more than 3 s once
(*verified*): allow about 8 s. This app's `HOST.anchor` manages one more persistent anchor per site for headset
placement (the same budget and code). Without anchors, a reset event or a jump of the head (more than 6 m/s or
1150 degrees a second, the origin moving under it) asks to calibrate again.

**Notices** in the headset: a small self-closing panel in front of the person for each step ("Aligned
automatically", "Shared space found", "Room calibration from last time", "Calibrate the room" with the how-to
and the flag tip, "Room calibrated", "Re-aligned").

## 5. Quest Browser shared spaces (experimental)

- Since Quest Browser v39 (June 2025): headsets in the same room get a **common reference space** with an id, so
  coordinates can be exchanged directly. Built on Meta's colocation. Explainer and demo:
  https://github.com/cabanier/shared-spaces (demo https://sharedshooter.arvr.social/).
- API: add `'shared'` to the session's optional features; once the session runs,
  `session.requestReferenceSpace('shared')` returns an `XRSharedReferenceSpace`.
- Verified on Quest 3 (browser 152): `session.enabledFeatures` listed `shared` (requested with
  `optionalFeatures: ['hand-tracking', 'shared', 'anchors']`). The id property is spelt **`UUId`** (not `uuid` as in
  the explainer; read `UUId ?? uuid ?? UUID`), and it is **empty right after the request**: it arrives with the
  space's `reset` event 0.1-4 s later. `frame.getPose(shared, localFloor)` returns a pose **only inside the XR
  frame callback** (null from a timer with the last frame).
- Behaviour (explainer): finding the right space can take a few seconds (a default one is reported until then;
  then `reset` fires with new coordinates and a new id); **no reset for the first headset** to go immersive; the
  common origin is the first headset's origin; bounded by the room's size; **per page URL** (keep the URL
  identical on every headset, query string included, until known otherwise); a headset that leaves WebXR loses
  the space; the space is gone when the last one leaves.
- Hence: **do not use the shared space as the room frame itself** (its origin is the first headset's and it is
  lost when everyone leaves, so stored poses would move between sessions). Use it only to **transfer** a room
  frame: publish `{ uuid, o: [x, y, z], x: [x, y, z], by, at, src }`, the room frame expressed in shared-space
  coordinates (`localFromShared = frame.getPose(shared, localFloor).transform.matrix`).
- Requirements on every headset: `chrome://flags` > "WebXR experiments" > Enabled, then **restart the browser**
  completely; **Enhanced spatial services** on (Quest settings, privacy / device permissions; Meta requires it for
  colocated experiences); all headsets in the same room, on the same page, the first staying in AR while the
  others enter.
- **Seen there**: two headsets in one room got **different** ids (probably enhanced spatial services off; not
  re-tested). Keep the two-point calibration as the fallback.
- **The same id does not prove one space** (section 9, fourth test): two Quest 3s reported the same id while one
  of them (Quest Browser 149) had just its own floor as the space in every session and the other (150) had one
  frame that held for 71 minutes. Compare the browser versions (the panel shows them), and judge a space by the
  calibrated headsets' distance (`R.cmp`, on the panel), never by its id.

## 6. Panels and placed things

- Shared panel poses are applied directly in room coordinates; a local drag wins while it lasts. Publish a pose
  only for real moves (2 mm tolerance), after a drag, or as a spawn claim (random 0.3-1.2 s wait; see
  [multiplayer.md](multiplayer.md)).
- Dispose panels at session end and place them anew in the next session (old world poses are wrong).
- Changes below a few millimetres are rounding: no refit, no republish (resets re-round values).
- Fit content from stable bounds (a layout's bounds), never from live bounds that move while people drag
  things, or headsets that apply the fit at different times get different scales.

## 7. Testing on headsets

- WebXR needs a secure context. Serve over HTTPS on the LAN, or use `adb reverse tcp:<port> tcp:<port>` per
  headset (USB or Wi-Fi adb) so `http://localhost:<port>` is secure.
- DevTools per headset: `adb -s <serial> forward tcp:922X localabstract:chrome_devtools_remote`, then the Chrome
  DevTools protocol on `localhost:922X` (`curl -s localhost:922X/json` lists targets) to navigate and evaluate
  (read the session log ring buffer). Never take DevTools screenshots while the headset presents.
- Quest Browser 152 refuses `requestSession` without a click; `navigator.xr.offerSession` shows the browser's own
  Enter AR prompt, which the person accepts with a controller.
- Long-running servers belong in the person's own terminal (background shells of agents stop).
- Log, in the session ring buffer: the session's enabled features, getting the shared space (and its property
  names), its resets and id, publishing or adopting a frame, fallbacks, viewer height, reference-space resets.

## 8. Open questions (from that test)

1. Does enhanced spatial services give both headsets the same shared-space id?
2. Does the query string count as part of the page for the shared space?
3. How long does a second headset take to get the first one's id?
4. How accurate is the shared space compared with tape marks?
5. Is a reset with a transform on `local-floor` right at session start related to the shared space?

## 9. Measured on two Quest 3s (this app's relay logs, October 2026)

Two Quest 3 headsets in one room, Quest Browser with WebXR experiments and Enhanced spatial services on, the
same page address, the relay on the same Wi-Fi; every 5 s each headset logged its frame, `local-floor` in
`local`, the shared space in `local-floor`, its head and its anchors (`relay/logs/`).

- **The shared space's id** was the same on both headsets at once (it came with a `reset` without a transform
  right at the start), but on the second headset the space was at first just its own `local-floor` (identity),
  so "Aligned automatically" meant nothing. About 40 s later it jumped by 40 cm and 74 degrees, then settled.
- **Its accuracy**: with both headsets calibrated on the same tape marks (both measured 1.59 m between them),
  the shared space put one headset's marks **0.84 to 0.90 m and 18 to 19 degrees** from the other's, steadily.
  For some seconds it also reported the head's pose as its own (the space's origin at the head).
- **The floor**: one headset's `local-floor` was about **28 cm too low** (the tape on a table measured 1.13 m
  there and 0.85 m on the other; its wearer's head stood at 1.9 to 2.05 m). Later its whole origin jumped by
  5.5 m and its floor by 0.7 m (anchors measured it). The other headset's `local-floor` moved by 0.3 m in height
  when it went hidden and visible again (taken off, or the Meta button).
- **Anchors**: two anchors per calibration were made and checked within 5 cm on both headsets; on one the
  persistent handles were refused (the reason is now logged).
- **Calibration**: one headset's first mark A was 16 cm (and 11 cm in height) off its second; a double pull
  took mark B 0.1 s after mark A; presses meant for a story panel took marks while calibrating.

- **Off and on again** (third test): with both headsets calibrated by hand things lined up, but switching one
  off and on left it far off for good: the origin moves while the headset is off, and the frame stayed where the
  old origin put it until its anchors answered, which they did not. Now a woken headset waits 5 s for its
  anchors, then finds them again by their saved handles, else asks to calibrate; and saved anchors nobody knows
  are deleted at session start (the Quest refuses new handles when its few slots are full).
- **Off and on again, measured** (fourth test): on waking Quest Browser sent two `reset` events of
  `local-floor`, each with a transform. Its matrix carries points from the old coordinates into the new ones,
  the opposite of how we had read the spec: applied our way it turned the room -126 instead of +126 degrees;
  applied its way it matched a calibration on the same tape right after within 1 to 1.5 cm. Its height was the
  change of the head's height, not the floor's. The anchors made in the session were not tracked again after
  waking. Now the reset moves the frame (its turn about the vertical and its move along the floor only), the
  anchors are looked for again by their saved handles, and waking never drops the calibration.
- **A full anchor store**: one Quest 3 refused every persistent handle ("InvalidStateError: Failed to execute
  'requestPersistentHandle' on 'XRAnchor': Maximum number of anchors reached!") with 9 anchors listed for the
  site, while the other saved with 11 listed, so the limit is not simply per site (perhaps per device, or
  counting older addresses of the relay). That headset asked to calibrate after every restart. Deleting the
  unknown anchors at session start did not free it; the log now says what deleting did, and the room deletes
  and asks again when a handle is refused.
- **The floor**: in the fourth test one headset's floor was about 50 cm off the other's; the room's floor
  from the marks allowed for it.
- **The shared space, from all three tests' logs** (checked twice, independently): our reading of its pose is
  right. Through it, each headset's own tape marks stay in one place across its own resets and wakes, to 1-2 cm
  and 0.2 degrees; read the other way round (as the reset transforms need) they move by 80 cm and more. But the
  two headsets were never in one space, though both reported the same id (`a4f5d9f5...`) in all three tests:
  - the headset with Quest Browser 149 got that id at once, with the identity pose: its space was its own floor at
    the start of each session (a new place every session);
  - the headset with Quest Browser 150 got a default space for 1.5 s, then a reset to that id, and one frame that
    held for 71 minutes over three sessions and many resets, to 1-2 cm (its origin 0.94 m under the floor);
  - so the offset between them was a different rigid one every session: 0.9 m and 19 degrees, 1.2 m and 28,
    2.4 m and 84, always 44 cm in height. Not an inaccurate shared space: two spaces.
  - Right after the headset became visible again, `getPose(shared, local)` returned the head's pose for up to
    15 s (on both headsets); frames published and compared then were metres out. Such poses are now ignored, and
    nothing is published or compared through the space within 20 s of waking.
  Next test: the same Quest Browser version on both, the same page address, both in AR, one started ten
  seconds before the other; the second's panel must not say *your own floor*, and the distance line should then
  read a few centimetres if the space is usable.
- **Fifth test**: with both headsets on the same Quest Browser version the shared space lined them up "perfectly"
  (no tape), so it is used by default again. After standby one headset was offset (no logs yet). What the earlier
  logs say happens on waking: the floor's resets move the origin (applied), the space gives the head's pose for
  up to 15 s (ignored), and the floor comes back 12 to 17 cm off. Now a frame from the shared space holds as the
  resets carried it until the space agrees with it again (or holds still for 5 s and is not just this headset's
  own floor), and its height is kept in the space.

So: tape marks on every headset, the room's height taken from the marks (the first calibration's height of
mark A over its floor, others allowing for their own floor), anchors to follow origin jumps, and the shared
space on by default (the same Quest Browser version on every headset) with its measured distance shown. A short
summary for other projects: [quest-shared-space-findings.md](quest-shared-space-findings.md).

