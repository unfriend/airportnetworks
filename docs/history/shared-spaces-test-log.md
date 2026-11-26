# Shared spaces: the dated test reports (October 2026)

This file is a record: section 9 of `docs/shared-spaces.md` ("Measured on two Quest 3s"), its reports moved here word for word on 26 November 2026, with the old text of section 2's third bullet at the end. The conclusions are the closing paragraph of that section; what is current is `docs/agents/shared-rooms.md`.

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

- **After a night's standby** (18 October): one of two headsets lined up through the shared space was offset, the
  other right. No logs of it (and the pages may still have run the previous day's version: a page in a headset does
  not reload by itself). Two independent readings of the code found one likely way: the shared space came back made
  again under the same id, around the headset that woke first; that headset held the room where its floor's resets
  carried it, and the other followed last night's frame through the new space. Now (`wakeOK`): a space that agrees
  is trusted again 3 s after waking, one that disagrees is judged only after 20 s; a headset's own frame is written
  into a space that disagrees once it holds still (not into one that is just its own floor); someone else's frame
  is followed through a space that disagrees only when written since this headset fell asleep (frames carry `p`,
  when they were written) or when the floor moved with no transform; a headset still outside the others' space 15 s
  after waking asks for it once more; and **Re-align** in the headset's menu lines a headset up again by hand (the
  shared space asked for again, the room's frame written again by whoever wrote it, then taken).

- **19 October, two Quest 3s on Quest Browser 152, the same address** (logs `2026-10-19-*`): the evening
  started aligned through the shared space. Then one headset left AR and entered it again: its space came back
  under the same id, but as its own floor (the identity pose, drifting up to 3 cm), while the other's stayed
  exactly where it was. That headset had published the room's frame itself, so it counted as first and took its
  own old frame through its new space: offset from the other, though both said aligned. Re-align (pressed seven
  times) asked for the same space again. Then *Shared space: not used* was pressed on it; that was remembered, so
  every later room that evening on that headset ignored the shared space (calibrate, or its own floor). Now:
  presence carries the space id and how each headset is aligned (`sp`, `al`), and a headset whose space is its
  own floor while another here is aligned through that id has not joined (`alignedHere`); the own-floor test has
  hysteresis (enter at 2 cm and 1.5 degrees, leave at 15 cm or 2 degrees); the switch is for the page only and
  the panel says when it is off.

- **20 October, rooms GLI, GSZ and OOO** (the same two Quest 3s, Quest Browser 152): each headset's tape marks, found
  again by its anchors, sat at the same place in its own shared space in every session (to 3 to 7 cm), but the two
  copies of space 699c04b0 were 2.6 m and 11 to 13 degrees apart, then 3.4 m and 6 degrees after one headset came out
  of a 15-minute standby with no room scan and its anchors not found. Clearing nothing in the app could join them,
  so a room can now move to a fresh page address (*Fresh shared space*, `s/<n>/`), and anchors not found after
  waking are looked for again every 10 s (they were found once AR was entered again).

- **20 October, room XRE, a fresh shared space**: *Fresh shared space* moved the pages to `/s/1/` and `/s/2/`. One
  headset got a new id at each address (024894e1, 77bcbdf1) with its origin where its old space's was (the tape
  marks at the same spot in all of them). The other first got its own old origin under a default id, then that
  headset's id 77bcbdf1, but placed 8 to 13 m and about 120 degrees away (the app's compare: 7.6 m, 116 degrees;
  flagged split after 5 s). Both lined up through the tape calibrations found again from their anchors after a
  night ("Room calibration from last time").

## Section 2, third bullet, as it stood before it was reworded

- **This app uses `local` today** (`setReferenceSpaceType('local')` in every story's `e5_xr.js` or its hand-written
  copy) and treats the floor as 1.6 m below the head. A shared space needs `local-floor` (with a fallback to
  `local` when it is refused), and every story's placement code must then use the known floor.
