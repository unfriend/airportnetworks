# Event runbook

A checklist for showing the stories at an event: headsets in one shared room, peer to peer on your own router or
through the laptop relay, and perhaps a kiosk.
No code needed. **Bold** words are what the app shows on its buttons and panels. Details:
[relay/README.md](../relay/README.md) ("A session on one Wi-Fi" and "If something does not work"); the rules behind
them: [AGENTS.md](../AGENTS.md) ("Shared rooms", "Placement in the headset").

## Where the controls are

| Where | How to get there | On it |
| --- | --- | --- |
| Menu (headset) | closed at first (nothing at the wrist; a note at the start says how to open it). Click either stick to open it (hand tracking: two quick pinches of the left hand while it points at nothing); it floats in front of you, about 80 cm away, the time in its header; the same, or **Close**, closes it, and it closes by itself after 20 s unused. Point at it and hold the grip to move it: it stays there and opens there next time (per headset) | Four tabs. **Story**: the story panel and play bar of the story on show, usable there (handy with Panels hidden). **Settings**: **Exit** (leaves VR or AR), **Recenter**, **Slideshow: on/off** (every story); **Labels** (the scenes' small labels: on top / in 3D / hidden), **Cards** (story panels, station cards, name tags: in 3D / on top / hidden), **Moving**, **Subtitles** (every story; in a room the room's); **Panels: shown / controls only / hidden** (the story on show; in a room for everyone at its circle); **Sound effects**, **Narration**, **Effects volume**; **Design room** (opens the props table; in a room **Design room here** puts it at your feet as a circle) and **Studio** beside it (your own scenes, section 4; in a room **Studio here**). **Circles**: **Join**, **Start a room**, **Join with a code**; in a room **Another room**, **Move here**, **Add here**, **Arrange all**, **Remove**, **Lock circles** (for the whole room), **Lock this story** (at a circle: its scene and panels, for everyone there), at an All stories circle **Own stories / With the room's circles** (its switch, for everyone there) and **Back to all stories**, **Show all rings** (this headset only), **On this network**, **Circles: ask first / walk in** (for the whole room; ask first by default, step 10), **Room setup** (the steps for lining up, how this headset lines up, **Check here**), the people, **Leave**. **Debug**: **Calibrate**, **Re-align**, **Check here** (Touch the spot), **Forget calibration**, **Shared space: on**, **Fresh shared space**, **People: same circle / everyone** (this headset only: whom it draws), **Sound check**, the version, the connection and the frame rate |
| Stories screen (headset) | outside a shared room only: after **Enter VR** / **Enter AR** from the start screen, or **Stories** on a story panel | Its title, **Back to the story** (when you came from one) and a card per story in two rows, the first half of the stories on top (the sound, **Sound check**, **Anchor**, **Recenter** or **Place again**, **Exit** and **Repeat** are in the menu) |
| Shared dialog (page) | **Shared** in the top bar or on the Stories screen | **Start a room**, **Join**, **Join by code**, *Setting up a room* (how each headset lines up, and the steps), room map, **Follow** (a station, or a person in a headset in the people list), **Panels** and **Lock story** (per station: what the headsets at its circle show of the story's panels, and whether they can move its scene and panels), **Arrange all**, **Add a station** (after the stories: the design room, the studio, **All stories**, **Back to the lobby**), an All stories circle's story picker and **Own stories / With the room's circles**, **Lock circles**, **Circles: ask first / walk in** (for the room; ask first by default), **Fresh shared space**, **Copy link** |

**Remove**, **Forget calibration** and **Fresh shared space** act only on a second press within 3 s. **Fresh shared
space** shows only on a page that comes from the relay.

## Three ways to run a room

- **Peer to peer** (no laptop relay): the devices open the live copy (GitHub Pages), a page starts a room and the
  others open its link. A public server only introduces them (PeerJS's, `0.peerjs.com`; Cloudflare's STUN server tells
  each its address); then they talk directly. It needs internet access to be introduced, and a network that lets the
  devices reach each other directly: **bring your own router** (eduroam and guest networks keep devices apart).
  Calibrations, Anchor places and shared spaces belong to the live copy's address. **Fresh shared space** and the
  headsets' logs need the relay, so they are not there.
- **The main site's relay** (since v120): the live copy (GitHub Pages) offers the owner's relay at
  `main.lab.lbi-netmed.com` in its Shared dialog (in a headset the menu's **Circles** > **Relay password**). With its
  password, entered once per device, that device's rooms run there: devices need not reach each other directly, so a
  network that keeps them apart (eduroam, a guest network, a hotspot) may do (untested there so far). Without the password the live copy runs rooms peer to peer,
  as above. **Fresh shared space** shows only on the relay's own copy (`https://main.lab.lbi-netmed.com/`), and the
  headsets' logs are not kept there.
- **The laptop relay** (section 2): the fallback when neither works on the network, and the way to collect
  the headsets' alignment logs. A page that comes from the relay always uses it.

Peer to peer, one page **hosts** the room: the first that started it, and later the one longest in it. **Start the room
on a laptop or desktop page that stays awake** (mains power, no sleep, the page visible): a headset sleeps when taken
off. A headset that started a room hands it to the first laptop or desktop page that joins. When the host leaves, the
next one takes over by itself within a few seconds (*The host has gone: taking over*); when it vanishes without leaving
(asleep, out of Wi-Fi), the others wait until the public server lets go of it, up to about a minute. The dialog and the
menu say *peer to peer · hosted here* or *hosted by* a name.

**Rooms on this network**: the first time, **one press**. Each device opens the app (the live copy, or the laptop
relay's address), **Shared** on a page or the menu (click a stick; **Circles**) in a headset, and **Join** next to
the room under **Rooms on this network** (*On this network* in the menu): the rooms with someone on the same network
(the same router, or the same address on the internet). **After that, by itself**: a device that was in a room joins it
again on its own when the app opens on that network within a week (after a restart, a sleep, the next day), with a
short notice (*Back in room XYZ*, with **Leave**). Peer to peer, when nobody holds the room yet, the first device back
hosts it from its own copy (stations and their places) and the others link to it; two at once do not split it. A
device never joins by itself a room it was never in, nor one it left with **Leave** (until it is joined again by hand),
nor on another network: there it offers one button, **Start room XYZ again**. **Show on this network** (in the room's
Shared dialog and menu) takes a room off the list for everyone. On a big shared network (eduroam, a campus, a
conference's Wi-Fi) strangers share the address: the list may show their rooms too, and nobody joins anything new by
itself.

**Check the network first** with the test page: open `<live copy>/p2p/` on two or more devices on the router, give
them the same code, press **Start**: the links should open within a second or two and keep running inside VR or AR
for a minute (it reports how fast). To test without the internet, run the relay and add
`&peer=<laptop address>:8787/peerjs` to the test page's address (it uses the relay's own introduction server; a page
on https needs the relay's certificate trusted). First real devices (the owner, 29 October 2026): two laptops on a
local network found each other this way, and then shared a peer-to-peer room; headsets and phones are still to try.

## 1. The day before

**Every headset**

- [ ] Charged; Quest Browser updated to **the same version on all of them** (two versions never shared a space; the
  headset's menu shows each version and warns when they differ).
- [ ] Quest Browser `chrome://flags`: **WebXR experiments** Enabled, then restart the browser fully (updates can
  reset it). Settings: **Enhanced spatial services** on (privacy, device permissions), **Physical space features** on
  (developer settings).
- [ ] **Space Setup** done in the event room (else the panel says *No room scan here*); if you only get in on the day,
  do it first thing.
- [ ] Showed *Anchors not saved (the store is full)* before? Clear Quest Browser's cookies and site data (this also
  forgets the app's calibration, Anchor place and sound settings there).
- [ ] Kiosk headsets: install the app from the live copy ([README.md](../README.md), "Installing"; address in
  [setup-and-release.md](setup-and-release.md), "Deploying"). Shared-room headsets: use a bookmark of the relay's
  address instead; the live copy cannot reach a relay with a self-signed certificate.

**The relay laptop**

- [ ] Node 18 or newer, `openssl` (Windows: run from Git Bash), the repository updated with `git pull` now, not at the
  event.
- [ ] `node relay/server.mjs --lan` once: it makes a certificate in `relay/.lan/` for the laptop's current addresses.
  A new network or address means a new certificate, accepted again on every headset.
- [ ] Firewall allows port 8787 (allow it on private networks when asked).
- [ ] Mains power, no sleep while the relay runs. **TO FILL (owner):** the power and sleep settings you use.
- [ ] A password for the relay, if you want one (anyone on the Wi-Fi could otherwise use it): start it with
  `COLLAB_TOKEN=<word> node relay/server.mjs --lan` (Windows PowerShell: `$env:COLLAB_TOKEN="<word>"` first), a word of
  lower-case letters and digits such as `networksofthefuture2037` (the headset's keypad has only those, and case
  counts). The public relay on Coolify has its own, set there (relay/README.md, "The shared password").

**The password, on every device** (only when the relay has one)

- [ ] Before the event, once per device: open the relay's address (or the live copy with `&relay=`), **Shared**, type the
  password under *This relay needs its password*, **Use**. The device keeps it for that relay. On a Quest the easiest
  is its 2D page in Quest Browser before entering VR or AR; in a headset session it is the menu's **Circles** tab,
  **Relay password** (a keypad). A device that has it never asks again; links and room codes never carry it.
- [ ] Changed the password? Every device enters the new one (the old one is refused and forgotten:
  *The password this device kept is no longer this relay's*). **Forget the password** (the Shared dialog's relay part)
  takes it off a device.

**Peer to peer** (if you use it)

- [ ] Your router, with internet access, and every device on it. The test page `p2p/` links them (above).
- [ ] The laptop or desktop page that will host: mains power, no sleep, the browser in front.

**Wi-Fi and floor**

- [ ] A network where devices reach each other: eduroam and guest networks usually do not; bring a router or use a
  phone's hotspot. If you can, reserve the laptop's address: Quest Browser keeps calibrations, Anchor places and the
  accepted certificate per address.
- [ ] From a headset, `https://<address>:8787/api/ping` answers `{"now":...}` (with a password: `/api/health` answers
  `{"ok":true,...}`, and `/api/ping` says `missing or wrong token`, which is right).
- [ ] Two tape crosses **on the floor**, A and B, about 2 m apart in the middle of the play area (1 m at least), with an
  arrow from A to B, left all day (and for the next session). Since v122 they set the room's floor too: every headset
  that calibrates on them stands the room on the real floor, whatever its own floor says, however far off (no table
  corners: spots on a table would put the room's floor on the table).
  Every headset calibrates on them as it starts and checks on them; the first headset's calibration makes them the
  room's. Label them A and B: a headset that touches them the other way round stands the room the other way round.
- [ ] Floor for **Arrange all**: sixteen stations in two rows, eight and eight behind them, about 17 m by 4 m starting 1.2 m in front of you.
  Less room: place a few with **Add here** (headset) or **Add a station** (page).

## 2. Setting up

1. On the laptop, in the repository: `node relay/server.mjs --lan`. Note the address it prints (the one on the
   headsets' Wi-Fi if there are several) and leave the window open.
2. Open **exactly that address** in Quest Browser on every headset and bookmark it (shared spaces need the same
   address). Accept the certificate warning once per headset and per desktop browser.
3. Once: **Shared** on a page (also in Quest Browser before AR) or a headset's menu (click a stick; the **Circles** tab), then **Start
   a room**. The address now ends in `#s=` and three letters. Others **Join** it under **Rooms on this network** (or
   **Open rooms**), or open the link from **Copy link** (not shown for a room that lives on one device only). Peer to
   peer (steps 1 and 2 skipped: every device opens the live copy): start the room on the laptop page; the others find
   it under **Rooms on this network** (or open its link, or **Join by code** on a page). From then on each device
   rejoins the room by itself when the app opens again (a restart, the next morning): nothing to press.
4. **Line up, one headset at a time: it is part of every headset's start.** Each time a headset enters AR in the room
   (in VR: after answering *Are you in the same room as the others?* with **In this room**; **Somewhere else** skips all
   this), its menu opens by itself at **Room setup**, *Line up*, with a live status line (*Lining up with the room...*,
   *Lined up from the room's spots (shared space)*, *Lined up from the room's spots, found again*, *Room
   ready*, or *Not lined up yet* with why: no shared space, not in the others' shared space, no room scan, another
   Quest Browser version, or nothing after 20 s). It says what to do:
   - **The first headset** (no spots in the room yet): *Put two tape crosses on the floor*: press **Calibrate**, hold
     the controller pointing down, the bright ring at its tip still on spot A on the floor, and pull the trigger, then
     on spot B. That sets the room and its floor for everyone, today and next time. Spots at different heights (more
     than 4 cm: the tip held off the floor) go back to spot A.
   - **The others**, one by one: if the room has its spots and the headset is not lined up by them, *Calibrate on them*
     (spot A, then spot B). A headset already lined up by them (its own calibration found again, or through the shared
     space from someone who calibrated) is asked by eye instead: the two orange crosses show where it puts the spots and
     a small panel asks *Are both crosses on your spots?* **Yes** counts as its check (*checked by eye* on the laptop);
     **No, calibrate again** opens *Line up*. The same question comes after a headset wakes, after **Re-align** and
     whenever the room may have moved in it: look at both crosses before you answer.
   - **Check** (every headset, once a session): press **Check at A**, hold the ring still on spot A itself, on the floor
     (not on the orange cross: it hides while you check), and pull the trigger. The result says how much of it is in
     height when that is 2 cm or more (*14 cm out at spot A (12 cm in height)*): a headset lined up through the shared
     space keeps its own floor, so that is its floor being off; calibrate it on the spots. Green (up to 10 cm) or amber (10 to 25 cm): *Lined
     up*, and the menu closes. Red (over 25 cm): back to *Line up* with why; calibrate on the spots and check again.
     **Check at B** works too. One or two presses for a headset already lined up.
   - **Skip for now** closes it for this session; it comes back only after a red check, when the headset is still not
     lined up 20 s after entering with another headset there (at *Not lined up?*, step 8), or once when the room gets
     its spots later. **Room setup** under **Circles** opens it by hand (four pages: *Before you start*, *Line up*,
     *Check that you line up*, *Not lined up?*).
   On the laptop the Shared dialog's *Setting up a room* lists each headset: *Anna: lined up (the room's spots, checked
   3 cm at spot A)*, *Ben: lined up (shared space, not checked yet)*, *Cleo: not lined up (no room scan)*, and *3 of 3
   headsets in the room lined up, 1 checked*.
   A room starts as a shared Stories screen (since v109): the page that
   starts it (or the first headset, in a room started in a headset) makes the room's arc of story cards, and the first
   headset in the room (aligned, in the room with the others) puts it where it stands, the cards in front of it as on a headset on its own (in a room whose first headset calibrates on the spots, once that is done). Every
   headset in the room is at it without walking anywhere, and every page shows it as its Stories screen: the story
   picked there plays for everyone (the story panel's **Stories** button takes everyone back to the cards). Anyone can
   move it: point at the cards and hold the grip (point to swing, raise or lower to push or pull, twist to turn), or drag
   its dot on the Shared dialog's map, or **Move here** in the menu; **Lock circles** stops that. As soon as someone adds
   another circle (**Add here**, **Add a station**, **Design room here**, a lobby) or presses **Arrange all**, the arc
   becomes an ordinary **All stories** circle where it stands: whoever was at it stays with it, and from then on it is
   gone into as any circle (step 10). It runs its own stories at first; **With the room's circles** (the
   menu at that circle, or its row in the Shared dialog) makes a story picked there join the room's circle of that
   story. Removed, it does not come back by itself (**Add here** or **Add a station** puts an All stories circle again).
   A **Back to the lobby** circle (added the same way; none is placed by itself) ends the story of whoever walks into
   it: the room shows as at the start.
5. In each headset's menu press **Sound check** and both beeps (in a room there is no Stories screen but the room's arc
   or an All stories circle; a room with no stations at all opens the menu by itself).
6. **Arrange all** on a headset: two rows in front of you (from a page: round spot A). To move a station, point at its
   ring or card and hold the grip: point to swing, raise or lower to push or pull, twist to turn. On the page, drag its
   dot (move) or square (turn). The design room's table is not one of the stories: to have it, stand where it should
   go, facing the way it should face, and press **Design room here** in the menu (or choose **Design room** under
   **Add a station** on the page); Arrange all leaves it where it is, and the All stories and lobby circles too. Over each ring its story's small model turns
   (the design room's: a little table), so circles can be told apart from across the room.
7. **Check again when in doubt** (*Lined up* is only what the app believes). A quick look: before anyone goes into a
   circle everyone's name tag shows, and it should float just above the real person's head (others' rays should start
   at their real controllers). **Check at A** (step 4) checks one headset against the spots. **Touch the spot** checks
   two headsets against each other (the only check while the room has no spots, and the one that catches two headsets
   that calibrated on the spots the other way round): on each, **Check here** (the guide's third page, or the menu's
   **Debug** tab beside **Re-align**), then hold the bright ring at the controller's tip still on spot A and pull the
   trigger: one person after the other, or the two tips touching, within 20 s of each other. Both headsets show how far
   apart their rooms put that spot: up to 10 cm green (*Lined up: 4 cm*), 10 to 25 cm amber (*14 cm out: fine for
   walking about; calibrate on the spots for close work*), over 25 cm red (*60 cm out: not lined up*, and the guide
   opens again). Alone it says *Waiting for someone else to press Check here (20 s)*. The laptop's list shows each
   headset's last check. The result stands until the next check or until the headset lines up afresh.
8. **Not lined up?** (the guide's last page, which opens by itself 20 s after entering AR without lining up while another
   headset is in the room and the startup flow was skipped, or after a red check with someone while the room has no
   spots): (1) **Re-align** (one press: the shared space is asked for again and the room's frame taken again), then
   check again. (2) **Calibrate** on the two spots, on every headset, one after another: the bright ring at the
   controller's tip on spot A, hold still, pull the trigger; then spot B. It never depends on the shared space, nothing
   overrides it, and the headset finds it again next time; check again. *Your marks are ... than the room's* or *Spots
   at different heights*: calibrate again. *Your floor is ... than the room's (allowed for)*: fix that floor in the
   boundary settings later. The **orange crosses** (shown 30 s after lining up, and while the menu is open, but not
   while you calibrate or check) should sit on the spots. (3) Still out: check that each headset has scanned this room and runs the same Quest Browser version; then
   **Fresh shared space** (twice): every page moves to a new address, everyone leaves AR, one headset enters first and
   the others after *Room ready*.
9. Two locks. **Lock circles** (in the menu, or on the page): nobody can move, add or remove a circle until someone
   unlocks it; the stories' scenes and panels stay free. **Lock this story** (in the menu at a circle, or the
   station's **Lock story** on the page): nobody at that circle can move, turn or resize its scene or move its panel;
   each circle has its own, and the circles lock does not touch it. Lock the circles once they are placed, and a story
   once its scene and panel stand where you want them. (A room locked in v96 comes back with only its circles locked:
   lock its stories once.)
   Panels per station stay free: at a circle, **Panels** in the menu (or the station's **Panels** button in the page's
   Shared dialog) goes **shown**, **controls only** (only the play bar under the panel: good with **Subtitles: on**) and
   **hidden** (A or X still plays and pauses), for everyone at that circle; each station keeps its own.
10. Go into a station's circle. Since v120 the circles **ask first** by default: point at a circle's card or model and
    press; a small panel in front of you asks whether to go in (**Go in** or **Not now**; it closes by itself after
    10 s). Walking into a circle does nothing then, and no rings are drawn (**Show all rings** in the menu brings them
    back); the story stays at its circle, so walk over to it. **Back to the lobby** asks the same way, and walking into it
    still ends your story. For a room with space to walk, **Circles: walk in** (the menu's **Circles** tab, or the same
    button in the page's Shared dialog, for everyone in the room) goes back to walking in: stand in a station's circle
    (a second there) and its story runs there; pointing at a card or ring and pulling the trigger then does not go
    there. Either way its story runs there as it does for everyone there, and you stay in it wherever you walk afterwards
    (it keeps playing, in step with the room; its sound fades with distance) until you go into another circle. In a
    circle the other circles show only their models: point at one and its card comes up, and fades 2 s after you look
    away (with the circles walked into, a ring shows as you come within 2 m). Before a headset has gone into any circle
    it shows no story, only the cards, models (and rings, walked into), people and the menu. Screens **Follow** a station from the room map. **Leave** in the menu brings the headset's Stories screen back.
    Other people are drawn (name tag, head, hands) only when they are at your circle (everyone before your first
    circle). For debugging, **People: everyone** in a headset's menu draws them all again (that headset only).
11. **A laptop for people without a headset** (a guide leads): in its Shared dialog, under **People**, press
    **Follow** beside the guide (any person in a headset). The laptop then shows the guide's story, switching when they
    walk into the next circle; between circles it stays on the last one (as the guide's headset does). The dialog says
    *Following Ann (at The flock)*. It stops when the guide leaves the room (the laptop stays at their last station), or
    when someone at the laptop follows a station or picks a story by hand; **Stop following** ends it. Tell the laptop
    which name is the guide's (shown under **You** in the headset's menu; typed in the Shared dialog on the headset's
    page before entering VR or AR, or **Another name** in the menu).

## 3. Kiosk: one headset or screen on its own

Outside a shared room only (at a station a story ends in explore mode, as for everyone there).

- Link `<address>#airports&repeat=all&anchor=on`, remembered on the device; or press **Repeat all** and **Anchor** in
  the headset's menu (press a lit one to turn it off).
- **Repeat all**: each story is followed by the next, the last by the first, with no explore mode. **Repeat one**
  replays one story.
- **Anchor**: scenes and panels stay at one spot in the room through taking the headset off, recentring, leaving VR
  and reloading. **Place again** sets them in front of you; the grip moves nothing. The Stories screen says how long
  the place holds.
- A new wearer (headset off for over 3 s) lands on the Stories screen and picks a story with the trigger or a pinch.
- Sound starts after a first tap or click (**Enter VR** counts; on a screen, click once). Only **Airports** and **The
  future** have a narration so far; the other stories have no voice until they get one (**Subtitles: on** shows the
  panel's words low in the view), but every story has its sound effects (on by default: soft sounds at its moments,
  in explore mode and on its panel's buttons; a quiet background only for the flock and Pass it on). Too much in a busy
  hall, or neighbours hearing each other's headsets: in the menu's Settings tab **Effects volume** (25, 50, 75,
  100 %, per headset), or **Sound effects: off** and **Narration: off** (in a shared room for everyone in it, pages
  too; also in the page's Shared dialog, so a guide can switch them from a laptop); the story panel's **Sound** button
  silences the narration and the effects together on that headset only.
- **TO FILL (owner):** headset settings used for a kiosk (sleep, boundary), if any.

## 4. The studio: your own scenes

The studio (`#studio`) shows your own models, see-through trigger cubes that show and hide them (or change their
pictures) as people walk in and out, and sounds placed in the room, life size; the relay on the laptop serves the files and saves where everything
stands. Details: [tools/studio/README.md](../tools/studio/README.md) (the formats) and
[relay/README.md](../relay/README.md) ("Your own scenes").

**Before the event**

- [ ] A folder of scenes on the laptop, outside the repository (say `~/scenes`): each subfolder is one scene (a name of
  letters, digits, spaces, `_ . -`).
- [ ] If the scenes live in the Cloudflare R2 bucket (the relay on Coolify with `--scenes r2`; relay/README.md, "Scenes
  in Cloudflare R2"), pull them onto the laptop the day before, with the `R2_*` variables set in the shell (from a file
  of your own, never the repository): `node tools/studio/r2sync.mjs pull --all ~/scenes` (only what changed comes;
  `node tools/studio/r2sync.mjs list` shows what the bucket holds). The event then needs no internet. Afterwards push the
  layouts saved there back: `node tools/studio/r2sync.mjs push ~/scenes --all` (`--dry` first to see what it would send).
  A file newer where it would go is never overwritten without `--force`: the line `kept <scene>/layout.json in the
  bucket: it is newer there` means someone saved that scene on Coolify since the pull; decide which to keep (the pushed
  one wins with `--force`, and the bucket's then stays in its `.history/`). Every `layout.json` replaced, here or there,
  is copied into that side's `.history/` first.
  If the venue's internet is good, the headsets can use the relay on Coolify instead and the files come straight from
  Cloudflare: nothing to pull.
- [ ] Start the relay with it: `node relay/server.mjs --lan --scenes ~/scenes` (with a password:
  `COLLAB_TOKEN=<word>` first, as in section 1; the scenes' files then need it too). It prints how many scenes it found.
- [ ] Upload on a laptop or desktop, not a headset: open `https://<address>:8787/upload`, pick a scene or **New scene**,
  drop the files or whole folders, read the plan (one row per thing it will make; a missing texture is said there), keep
  **For Quest** on, **Convert and upload**, then **Open the scene**. Models become GLB in `models/`, sounds mono in
  `sounds/`, and what you gave is kept in `originals/`. `ffmpeg` on the laptop makes long sounds mono MP3 (without it
  they are kept as given).
- [ ] Place things: **Edit** on the Scene pane (laptop: click, then the arrows, W E R; **Walk** to try the cubes; a
  headset: trigger to pick, grip to carry, both grips to size). **Save** writes the scene's `layout.json` in its folder
  (the one before goes into its `.history/`). Mind the cards' warnings: about 300,000 triangles a model and 500,000 a
  scene are the most a Quest takes well.
- [ ] Try it in one headset before the day: the scene's size, its sounds (the Sound button on), and the frame rate with
  your biggest model.

**On the day**

- [ ] In a shared room: stand where the scene should be and press **Studio here** in the menu (Settings tab), or **Add a
  station**, the studio, on a page; walk into its circle; everyone at it sees one scene and its layout. Arrange all
  leaves it where it is.
- [ ] Then lock it so nobody moves things by accident: **Lock this story** in the menu at its circle, or **Lock story**
  on its row in the Shared dialog (editing is refused while locked; the circle itself: **Lock circles**).
- [ ] A visitor's headset or screen on its own: the link `https://<address>:8787/#studio&scene=<name>&visit` (no
  editing and no uploads at all), with `&anchor=on` to keep the scene at one spot in the real room.
- [ ] Each person's trigger cubes are their own: what one headset's place reveals, another's may not (also a picture a
  cube changes on a model).
- [ ] The scene's sounds follow each device's **Sound** button only (not **Sound effects** or **Narration**).

## 5. When things go wrong

| Symptom | Try, in this order |
| --- | --- |
| Headsets not lined up | **Check at A** (**Room setup**, *Check*) says how far one headset is from the spots, **Touch the spot** (**Check here**) how far two are apart. **Calibrate** on the two spots and check again; or the guide's last page: **Re-align** on the headset that is off, then check again; look at the orange crosses (menu open). *Not in the others' shared space* or *Shared space not usable*: calibrate on the spots, or press **Fresh shared space** twice (every page moves to `/s/1/` and the like, headsets leave AR; start one, wait for *Room ready*, then the others; rooms and calibrations stay). Last resort: relay/README.md, "Starting the shared space afresh". |
| *Quest Browser ... here, ... on ...* | Versions differ: update both; meanwhile calibrate on the spots. |
| *No shared space (check the WebXR flag ...)*, *No room scan here*, *Shared space switched off here* | Section 1's settings and Space Setup; **Shared space: off** switches it on. Or calibrate on the spots. |
| Off after standby | Crosses show 30 s (*Check the spots*). *Leave AR and enter it again*: do so. Through the shared space: wait 20 s, then **Re-align**. Still off: **Calibrate**. |
| Calibrate after every restart, or *Anchors not saved (the store is full)* | Clear Quest Browser's cookies and site data on that headset, then calibrate. |
| No sound | Only **Airports** and **The future** have a narration. **Play sound**, or **Sound off** to turn it back on; the headset's volume; stand within 1.5 m of the station's spot. **Sound check**: press both beeps; hearing one, choose it (**Web Audio** or **Audio element**); **Reset** unmutes and goes back to **Automatic**. Photograph its lines for the developer. |
| Stuck on its loading line, or *Could not load the ... story* | Check the relay window and `/api/ping`, then reload (headset: **Exit**, reload, enter AR again; the room link rejoins). Pages from the relay have no offline copy. |
| A headset lost its room | *connecting...*: the relay is not answering (laptop asleep, Wi-Fi, relay stopped); it reconnects by itself. *Room XYZ · this headset*: kept on the headset until the relay answers (asked every 15 s). *There is no room XYZ ...*: **Join** one under **Open rooms**, or start one and **Arrange all** (rooms go 6 hours after the last person leaves). |
| Peer to peer: *The host has gone: taking over* | Wait: the next device takes over by itself (seconds; up to about a minute when the host vanished without leaving). Bring the host page back, or keep a laptop page in the room as the host. |
| Peer to peer: *No link to the room's host yet* | The network keeps the devices apart: check with the test page `p2p/`; your own router; else the laptop relay. |
| Peer to peer: *Room XYZ is on this device only* | The public introduction server was not reached (no internet, or blocked): it asks again every 15 s. Else the laptop relay. |
| *This room runs another version of the app* | Reload on every device, then join again. |
| The relay restarted | Rooms come back by themselves from any device that was in them. Calibrations stay if the laptop's address did not change; a new address means a new certificate and calibrating again. |
| No page, or no **Enter VR** / **Enter AR** | `/api/ping` from the headset; the `https://` address on the Wi-Fi; devices kept apart by the network; the firewall. |

## 6. After the event

- [ ] Headsets: **Exit**. Laptop: `Ctrl+C` in the relay window (it tells every device first).
- [ ] Scenes kept in R2: push what was saved at the event back into the bucket (`node tools/studio/r2sync.mjs push
  ~/scenes --all`; section 4).
- [ ] Collect `relay/logs/` from the repository on the laptop: one file per headset, room and day
  (`<day>-<room>-<name>-<id>.jsonl`), written while the relay runs with `--lan`. Add a note: date, room code, headsets
  and their Quest Browser versions, and what you did when ("14:05 Ada's headset in standby for 10 minutes").
- [ ] Send them: **TO FILL (owner):** who receives the logs, and how.
- [ ] Privacy: they hold the names people used (headsets pick names such as Ada, pages take typed ones), room codes,
  positions and the page address. Never put them in a public repository: `relay/logs/` is git-ignored, and
  relay/README.md's advice to push them as a branch does not apply while the repository is public. Where they are kept:
  [data-and-permissions.md](data-and-permissions.md).

## 7. Still untested on headsets

Two Quest 3s were tried in one room several times: see [quest-shared-space-findings.md](quest-shared-space-findings.md)
and the end of AGENTS.md "Shared rooms". Not yet confirmed on a device:

- lining up again after standby, and after a night;
- whether **Re-align** (or asking again by itself 15 s after waking) joins the others' shared space;
- whether a headset that left AR and came back is told *Not in the others' shared space*;
- saved anchors found again after a restart (the calibration's, and **Anchor**'s kiosk place);
- what a recentre (long press on the Meta button) does to the room;
- moving and resizing scenes with the grips at a station (comfort, and how it looks to others);
- subtitles (**Subtitles: on** in the menu, the same for the whole room): how they read and how they follow the head;
- the stations' icons (each story's miniature over its ring): whether they tell the circles apart from across a real
  room; the design room's table at its circle (**Design room here**): its size and height, and picking props up there;
- follow a person: a laptop following a guide in a headset as they walk from circle to circle (how quickly it
  switches, and that it stays put between circles);
- after the ten-headset test (29 October 2026, which went very well): staying in your story out of its circle (and
  its narration heard from there), **Lock circles** and **Lock this story** in use, and other people shown only at your
  circle (**People: everyone** to see them all);
- after the owner's notes of 30 October 2026 (v101): in a circle the other stations as their 3D models only, a ring
  appearing within 2 m of its spot (whether 2 m feels right), a card on pointing at a model (how it reads, the 2 s
  fade); **Recenter** at a station (on the story panel and beside Exit in the menu: the scene and panel back where the
  story starts them, for everyone at that circle, refused while the story is locked); joining a room by its code from
  the menu (**Join with a code**, or **Another room** in a room: the keypad);
- panels per station (**Panels: controls only** or **hidden** in the menu or the Shared dialog): whether a circle
  reads better with only the play bar (with subtitles on) or none, and that everyone at that circle gets it;
- sound zones: each station's narration heard from where it stands;
- the studio (section 4): a scene's size and placement in AR and VR, carrying, sizing and stretching things with the
  grips, the VR stick walk, objects on the real floor in AR, the trigger cubes as people walk (and the pictures they
  change on models: the switch, and a Quest's memory with many 2,048 px pictures), the scene's sounds through
  the headset (streamed long ones too), the frame rate with a big scan (the 397,066-triangle atelier), **Studio here**
  and standing in its circle, and a visitor's headset with `&visit`;
- the room setup guide and its startup flow (v107, v109): whether it opens at the right moments (as every headset
  enters a room, at Check when it is lined up by the spots already; after a red check; not lined up 20 s in), whether it
  feels light for a headset already lined up (Check at A, the trigger, done), how its pages read, how accurately a
  controller's tip finds a tape cross on the floor (Check at A on a headset that is lined up: a few cm?), the floor
  spots (v122: is the room's floor on the real floor in every headset, also one whose own floor is off? The headsets'
  logs say `floor spots` with the touch heights, which measure the 2 cm the tip is taken to be over the floor), and
  **Touch the spot** on real headsets: how near two tips held on the same spot come out when the headsets do line up
  (the green limit is 10 cm), and the laptop's list during a setup;
- comfort and frame rate with other people drawn;
- whether the link to the relay keeps running inside a headset session;
- rooms on this network on real networks: the STUN server's address on a home router, a mobile hotspot, eduroam or a
  conference Wi-Fi (devices behind one address should see each other's rooms; IPv6-only networks and VPNs untried), a
  relay behind Coolify with `--proxy` and `--public` (relay/README.md, "Public hosting on Coolify": its last paragraph
  lists what only a deployment can show), a headset rejoining by itself after a restart or the next morning (and its
  calibration found by its anchors), a headset that ends up hosting handing over to the first laptop page;
- peer to peer: rooms with headsets and phones (so far two laptops: they found each other on a local network with the
  test page `p2p/` and were in one peer-to-peer room, the owner, 29 October 2026), links that keep running inside VR and
  AR, a host change at an event, a headset host handing over to a laptop, and how long PeerJS's public server keeps the
  id of a headset that went to sleep (tested otherwise only between pages on one machine).

**If there is time, a test round for the logs**, on fresh headsets (**TO FILL (owner):** new or reset headsets, or only
their site data cleared). Note the time and headset for every step.

| Step | Note down |
| --- | --- |
| AR on one headset, the other ten seconds later, no tape | each panel's *Shared space ...* line; do both point at one spot? |
| **Calibrate** both on the tape | *The shared space puts ...'s marks ... cm, ...° from yours* |
| One headset in standby 5 minutes | still lined up? which notices? |
| **Re-align** on a headset that is off | back in place? |
| Leave AR and enter again on one | *Not in the others' shared space*? |
| Restart Quest Browser, enter AR | *Lined up from the room's spots, found again*? crosses on the spots? **Check at A** green? |
| A recentre (long press on the Meta button) | room still on the tape? |
| Next morning, same headsets and address | lined up? crosses on the tape? |

## 8. Room and depth test (one Quest 3)

Before the app hides virtual things behind real hands, people, walls and furniture, this test page finds out what a
Quest 3 gives a web page and how much it costs. One headset, about ten minutes. The page has been checked only in a
desktop browser with a pretend headset: this is its first real try.

- [ ] Before: the room scanned (Settings, Physical space, Space setup) and Quest Browser up to date.
- [ ] In Quest Browser open `<site>/room-test/` (the app's address with `room-test/` after it, for example
  `https://<the app's site>/room-test/`, or the relay's `https://<address>:8787/room-test/`).
- [ ] Press **Enter AR** and allow what it asks. A panel 0.9 m in front of you shows what came back; point at its buttons
  (controller or hand) and pull the trigger or pinch. **Bring here** puts it and the test things in front of you again.
- [ ] Press **Mode** to go through the five modes, and stay at least 5 seconds in each (its frame time and the GPU's time are measured):
  **Depth picture** (colours over the room: near warm, far cool), **Occlusion** (hold a hand in front of the pillars, the
  ball and the purple panel, and let someone walk in front: they should hide them), **Room** (the room scan's parts with
  their names), **Room hides** (walk so a wall, table or sofa stands between you and the test things: they should hide
  behind it), **Nothing**.
- [ ] Take a photo in the headset (Meta button, then the trigger) of **Occlusion** and of **Room hides** with a hand in
  front of the test things.
- [ ] If a hand hides things in the wrong place (beside it, or upside down), press **Depth as** and try each reading;
  note which one looked right. **Draw with** switches between the 3D engine and plain WebGL: note whether both work.
- [ ] If the panel offers **Set up the room** (no room scan came within 5 s), press it and follow the headset.
- [ ] Press **Save report**, then **Exit**. (The report is also kept every few seconds, so if the headset is taken off
  or the browser closes, the page still has it when you open it again.) On the page, press **Copy** and paste the report into the chat, or
  **Download** it and send the file; served by the laptop relay, **Send to the relay** keeps it in `relay/logs/`.
- [ ] If there is time, **Try VR too** (it records whether depth works in VR as well; if the headset leaves VR at once,
  say so: that is an answer too).

