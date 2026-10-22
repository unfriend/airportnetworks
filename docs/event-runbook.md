# Event runbook

A checklist for showing the stories at an event: headsets sharing one room through the relay, and perhaps a kiosk.
It needs no code. Words in **bold** are what the app shows on its buttons and panels. The full reference is
[relay/README.md](../relay/README.md) ("A session on one Wi-Fi, step by step" and "If something does not work"); the
rules behind it are in [AGENTS.md](../AGENTS.md) ("Shared rooms" and "Placement in the headset").

## Where the controls are

| Where | How to get there | What is on it |
| --- | --- | --- |
| Shared panel (headset) | above the left controller (beside the story panel without one); **Open** and **Close** in its header | **Exit** (leaves VR or AR) in the header. Before a room: **Open rooms** with **Join**, **Start a room**, **Refresh**. In a room: **Calibrate**, **Re-align**, **I am elsewhere**, **Forget calibration**, **Shared space: on**, **Fresh shared space**; Stations: **Move here**, **Add here**, **Arrange all**, **Remove**, **Lock the layout**; You: **Another name**, **Leave** |
| Stories screen (headset) | after **Enter VR** or **Enter AR** from the start screen, or **Stories** on a story panel (not shown at a station) | **Sound**, **Sound check**, **Anchor**, **Recenter** (**Place again** when anchored), **Exit**, **Repeat all**, **Repeat one**, one card per story (**Start**) |
| Shared dialog (page) | **Shared** in the top bar or on the Stories screen | **Start a room**, **Join**, **Join by code**; in a room the room map, **Follow** per station, **Arrange all**, **Add a station**, **Lock layout**, **Fresh shared space**, **Copy link**, **Leave** |
| Stories screen (page) | the landing page | **Repeat all**, **Repeat one**, **Sound check**, **Shared** |

Three buttons act only on a second press within 3 s: **Remove** (*Remove for everyone?*), **Forget calibration**
(*Forget? Press again*) and **Fresh shared space** (*Sure? Press again*). **Fresh shared space** shows only on a page
that comes from the relay.

## 1. The day before

**Headsets (every one)**

- [ ] Charged.
- [ ] Quest Browser updated, to **the same version on every headset**: two versions never shared a space. The Shared
  panel shows each headset's version and warns when they differ.
- [ ] Quest Browser, `chrome://flags`: **WebXR experiments** set to Enabled, then the browser restarted completely
  (an update can reset the flag).
- [ ] Headset settings: **Enhanced spatial services** on (privacy, device permissions) and **Physical space
  features** on (developer settings).
- [ ] **Space Setup** run in the event room (the shared space and saved calibrations rest on that scan; without it the
  panel says *No room scan here*). If you can only get into the room on the day, do it first thing then.
- [ ] A headset that showed *Anchors not saved (the store is full)* before: clear Quest Browser's cookies and site
  data. This also forgets the app's calibration, Anchor place and sound settings on that headset.
- [ ] Kiosk headsets: install the app from the live copy ([README.md](../README.md), "Installing"; the address is in
  [setup-and-release.md](setup-and-release.md), "Deploying"). For a shared room use a bookmark of the relay's address
  instead: a copy from the live site cannot reach a relay with a self-signed certificate.

**The laptop for the relay**

- [ ] Node 18 or newer, `openssl` (on Windows, run the relay from Git Bash) and the repository, brought up to date
  with `git pull` now, not during the event.
- [ ] Start it once with `node relay/server.mjs --lan` in the repository folder. It makes its own certificate in
  `relay/.lan/` for the laptop's current addresses. On another network or address it makes a new one, and every
  headset must accept it again.
- [ ] Firewall: allow port 8787 (macOS and Windows ask on the first start: allow it on private networks).
- [ ] Mains power, and no sleep while the relay runs: a sleeping laptop stops answering.
  **TO FILL (owner):** the power and sleep settings you use.

**Wi-Fi**

- [ ] A network where devices can reach each other. eduroam and guest networks usually keep them apart: bring your own
  router or use a phone's hotspot.
- [ ] If you can, give the laptop the same address each time (a reservation on your own router). Each address is a
  separate site for Quest Browser: calibrations, Anchor places and the accepted certificate do not carry over.
- [ ] Test from a headset: `https://<address>:8787/api/ping` answers `{"now":...}`.

**Floor**

- [ ] Two tape crosses on the floor (or a table), a metre or more apart (50 cm at least), labelled A and B. Mark A is
  the room's origin. Leave them down all day: headsets are calibrated on them.
- [ ] Room for the stations: **Arrange all** puts the ten stories in two rows of five and needs about 9.6 m by 4 m of
  floor, starting 1.2 m in front of you. In a smaller room, place a few stations with **Add here** (headset) or **Add
  a station** (page).

## 2. Setting up

1. On the laptop, in the repository: `node relay/server.mjs --lan`. It prints the address to open (for example
   `https://192.168.1.20:8787/`) and where the logs go. If it prints several addresses, take the one on the headsets'
   Wi-Fi. Leave the window open.
2. On every headset, open **exactly that address** in Quest Browser and bookmark it (shared spaces need the same
   address everywhere). Accept the certificate warning once per headset, and once per desktop browser.
3. Start the room once: **Shared** on a page (also in Quest Browser before entering AR), or **Open** on a headset's
   Shared panel, then **Start a room**. The address then ends in `#s=` and the room's three letters. Everyone else
   picks it under **Open rooms** and presses **Join** (or opens the link from **Copy link**).
4. **Enter AR** on one headset first. Wait about ten seconds (it says *Shared space found*, or *Room calibration from
   last time*), then the others, one by one. In VR the panel asks once *Are you in the same room as the others?*:
   answer **In this room**.
5. While a headset still shows its Stories screen: **Sound check**, and press both beeps (at a station the Stories
   screen is not available).
6. **Arrange all** from a headset: two rows in front of you, each station facing away from you (from a page they go
   round mark A). To move a station in a headset, point at its ring or card and hold the grip: point to swing it,
   raise or lower the controller to push or pull it, twist to turn it. On the page, drag its dot to move it, or its
   square to turn it.
7. **Calibrate** every headset in the room, one after another (it does not depend on the shared space, and nothing
   overrides it). A bright ring at the controller's tip is the point that counts: put it on mark A, hold still, pull
   the trigger; then mark B. **Stop calibrating** cancels.
8. Check every headset: the **orange crosses** sit on the tape (they show for 30 s after aligning, and whenever the
   Shared panel is open). Point at one spot together: each ray starts at the other person's real controller. If the
   panel says *Your marks are ... further apart than the room's: other tape?* or *Marks at different heights*,
   calibrate again. *Your floor is ... cm lower than the room's (allowed for)*: fine for today; fix that headset's
   floor in its boundary settings later.
9. **Lock the layout** (**Lock layout** on the page). Nobody can then move, add or remove a station, or move a scene or
   panel. Anyone can unlock it.
10. Walk up to a station, or point at its card and pull the trigger: its story runs for everyone there. At a station
    the grip moves the scene or the panel for everyone, and both grips resize the scene, unless the layout is locked.
    Screens **Follow** a station from the room map.

## 3. Kiosk: one headset or screen on its own

For a headset or a screen outside a shared room (at a station a story ends in explore mode, as for everyone there).

- **The link:** `<address>#airports&repeat=all&anchor=on` sets both, and the device remembers them. Or press **Repeat
  all** and **Anchor** on the headset's Stories screen (a lit button pressed again turns it off; `#anchor=off` too).
- **Repeat all:** each story is followed by the next, the last by the first, with no explore mode in between.
  **Repeat one** plays the same story again and again.
- **Anchor** (headset): the scenes and panels stay at one spot in the room, also when the headset is taken off,
  recentres, leaves VR or reloads. **Place again** puts everything in front of you and anchors it there; while
  anchored the grip moves nothing. The Stories screen says how long the place holds (*Anchored in the room ...*, or
  *... the place holds until you leave VR* on a headset that gives no anchors).
- **A new wearer** (the headset off for more than 3 s) lands on the Stories screen and points at a story and pulls the
  trigger (or pinches). Without Anchor, everything is set in front of them.
- **Sound** starts only after a first tap or click (**Enter VR** counts; on a screen, click once). Only **Airports**
  has a narration: the other nine stories are silent by design.
- **TO FILL (owner):** headset settings used for a kiosk (sleep, boundary), if any.

## 4. When things go wrong

| Symptom | Try, in this order |
| --- | --- |
| Headsets not lined up | Open the Shared panel and look at the orange crosses. Off the tape: **Calibrate** that headset again, holding still at each mark. Not calibrated: **Re-align** on the headset that is off, then on the other. Panel says *Not in the others' shared space* or *Shared space not usable*: calibrate both on the tape; or **Fresh shared space** (twice): every page moves to a new address (`/s/1/`, ...) and the headsets leave AR; start AR on one, wait for *Shared space found*, then the others. Rooms and calibrations stay. Last resort: relay/README.md, "Starting the shared space afresh". |
| *Quest Browser ... here, ... on ...* | Versions differ: update both. Meanwhile calibrate on the tape. |
| *No shared space (check the WebXR flag, spatial services)*, *No room scan here*, *Shared space switched off here* | Check the flag, Enhanced spatial services and Space Setup (section 1); press **Shared space: off** to switch it on. Or calibrate on the tape. |
| Off after standby (switched off and on) | The crosses show for 30 s (*Check the marks*). *Leave AR and enter it again*: do that. Lined up through the shared space: wait 20 s, then **Re-align**. Still off: **Calibrate**. |
| Asks to calibrate after every restart, or *Anchors not saved (the store is full)* | Clear Quest Browser's cookies and site data on that headset, then calibrate again. |
| No sound | Only **Airports** has a narration. Press **Play sound**, or **Sound off** to turn it on again; check the headset's volume. A station's narration is full only within 1.5 m of its spot. **Sound check**: press both beeps; if you hear only one, choose that one (**Web Audio** or **Audio element**). **Reset** unmutes and goes back to **Automatic**. Photograph its lines for the developer. |
| A story stays on its loading line, or *Could not load the ... story* | Check the relay window and `/api/ping`. Then reload: in a headset **Exit**, reload in Quest Browser, enter VR or AR again (the room link brings you back). From the relay there is no offline copy. |
| A headset lost its room | Panel line *connecting...*: the relay is not answering (laptop asleep, Wi-Fi, relay stopped); it reconnects by itself. *Room XYZ · this headset*: the relay was not reached; the room moves there once it answers (it asks every 15 s). *There is no room XYZ ...*: pick a room under **Open rooms**, or start one and **Arrange all** again (a room is deleted 6 hours after the last person left). |
| *This room runs another version of the app* | Reload the page on every device, then join again. |
| The relay restarted | Its rooms are emptied, but any device that was in a room brings it back by itself under the same code. Calibrations stay on the headsets if the laptop's address did not change; a new address means a new certificate to accept and calibrating again. |
| A headset cannot open the page; no **Enter VR** or **Enter AR** | `/api/ping` from the headset; the right address (`https://`, the Wi-Fi one); a network that keeps devices apart; the firewall. |

## 5. After the event

- [ ] Headsets: **Exit**. Laptop: `Ctrl+C` in the relay's window (it tells every device first).
- [ ] Collect the logs: the folder `relay/logs/` in the repository on the laptop, one file per headset, room and day
  (`<day>-<room>-<name>-<id>.jsonl`). Headsets in a room send them every 10 s while the relay runs with `--lan`. Add a
  short note: the date, the room code, the headsets and their Quest Browser versions, and what you did when (for
  example "14:05 Ada's headset in standby for 10 minutes").
- [ ] Send them: **TO FILL (owner):** who receives the logs, and how.
- [ ] Privacy: the logs hold the names people used (headsets pick names such as Ada or Alan, people type theirs on a
  page), room codes, positions in the room and the page's address. Never put them in a public repository. `relay/logs/`
  is git-ignored; the advice in relay/README.md ("Logs") to push them as a branch does not apply while the repository
  is public. Where they are kept: [data-and-permissions.md](data-and-permissions.md).

## 6. Still untested on headsets

Two Quest 3 headsets were tried in one room several times. What they did is in
[quest-shared-space-findings.md](quest-shared-space-findings.md), and the full list of open points closes the testing
note of AGENTS.md "Shared rooms". Not confirmed on a device yet:

- lining up again after standby, and after a night;
- whether asking for the shared space again (**Re-align**, or by itself 15 s after waking) joins the others' space;
- whether a headset that left AR and came back is told *Not in the others' shared space*;
- saved anchors found again after a restart (the calibration's, and **Anchor**'s place for a kiosk);
- what a recentre (a long press on the Meta button) does to the room;
- moving and resizing scenes with the grips at a station (comfort, and how it looks for the others);
- sound zones: each station's narration heard from where it stands;
- comfort and frame rate with other people drawn;
- whether the connection to the relay keeps running inside a headset session.

**If there is time: a test round for the logs.** Use headsets that are fresh (**TO FILL (owner):** new or reset
headsets, or only their site data cleared). Note the time and the headset for every step.

| Step | Note down |
| --- | --- |
| Start AR on one headset, then the other after ten seconds; no tape | the panel's *Shared space ...* line on each; do both point at the same spot? |
| **Calibrate** both on the tape | the line *The shared space puts ...'s marks ... cm, ...° from yours* |
| One headset in standby for 5 minutes, then back | still lined up? which notices showed? |
| **Re-align** on a headset that is off | did it come back? |
| Leave AR on one headset and enter it again | *Not in the others' shared space*? |
| Restart Quest Browser and enter AR | *Room calibration from last time*? crosses on the tape? |
| A recentre (long press on the Meta button) | does the room stay on the tape? |
| The next morning, same headsets, same address | lined up? crosses on the tape? |
