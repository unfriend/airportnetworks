# Event runbook

A checklist for showing the stories at an event: headsets in one shared room through the relay, and perhaps a kiosk.
No code needed. **Bold** words are what the app shows on its buttons and panels. Details:
[relay/README.md](../relay/README.md) ("A session on one Wi-Fi" and "If something does not work"); the rules behind
them: [AGENTS.md](../AGENTS.md) ("Shared rooms", "Placement in the headset").

## Where the controls are

| Where | How to get there | On it |
| --- | --- | --- |
| Shared panel (headset) | above the left controller; **Open** / **Close** in its header | **Exit** (leaves VR or AR); **Join**, **Start a room**; in a room **Calibrate**, **Re-align**, **Forget calibration**, **Shared space: on**, **Fresh shared space**, **Move here**, **Add here**, **Arrange all**, **Remove**, **Lock the layout**, **Leave** |
| Stories screen (headset) | after **Enter VR** / **Enter AR** from the start screen, or **Stories** on a story panel (not at a station) | **Sound**, **Sound check**, **Anchor**, **Recenter** (**Place again** when anchored), **Exit**, **Repeat all**, **Repeat one**, a card per story |
| Shared dialog (page) | **Shared** in the top bar or on the Stories screen | **Start a room**, **Join**, **Join by code**, room map, **Follow**, **Arrange all**, **Add a station**, **Lock layout**, **Fresh shared space**, **Copy link** |

**Remove**, **Forget calibration** and **Fresh shared space** act only on a second press within 3 s. **Fresh shared
space** shows only on a page that comes from the relay.

## 1. The day before

**Every headset**

- [ ] Charged; Quest Browser updated to **the same version on all of them** (two versions never shared a space; the
  Shared panel shows each version and warns when they differ).
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

**Wi-Fi and floor**

- [ ] A network where devices reach each other: eduroam and guest networks usually do not; bring a router or use a
  phone's hotspot. If you can, reserve the laptop's address: Quest Browser keeps calibrations, Anchor places and the
  accepted certificate per address.
- [ ] From a headset, `https://<address>:8787/api/ping` answers `{"now":...}`.
- [ ] Two tape crosses, A and B, a metre or more apart (50 cm at least), left down all day. A is the room's origin.
- [ ] Floor for **Arrange all**: ten stations in two rows of five, about 9.6 m by 4 m starting 1.2 m in front of you.
  Less room: place a few with **Add here** (headset) or **Add a station** (page).

## 2. Setting up

1. On the laptop, in the repository: `node relay/server.mjs --lan`. Note the address it prints (the one on the
   headsets' Wi-Fi if there are several) and leave the window open.
2. Open **exactly that address** in Quest Browser on every headset and bookmark it (shared spaces need the same
   address). Accept the certificate warning once per headset and per desktop browser.
3. Once: **Shared** on a page (also in Quest Browser before AR) or **Open** on a headset's Shared panel, then **Start
   a room**. The address now ends in `#s=` and three letters. Others **Join** it under **Open rooms**, or open the link
   from **Copy link** (not shown for a room that lives on one device only).
4. **Enter AR** on one headset; after about ten seconds (*Shared space found*, or *Room calibration from last time*)
   the others, one by one. In VR, answer *Are you in the same room as the others?* with **In this room**.
5. While a headset still shows its Stories screen, press **Sound check** and both beeps (not reachable at a station).
6. **Arrange all** on a headset: two rows in front of you (from a page: round mark A). To move a station, point at its
   ring or card and hold the grip: point to swing, raise or lower to push or pull, twist to turn. On the page, drag its
   dot (move) or square (turn).
7. **Calibrate** each headset in the room, one after another: put the bright ring at the controller's tip on mark A,
   hold still, pull the trigger; then mark B. It never depends on the shared space and nothing overrides it.
8. Check each headset: the **orange crosses** sit on the tape (shown 30 s after aligning, and while the Shared panel is
   open), and others' rays start at their real controllers. *Your marks are ... than the room's* or *Marks at different
   heights*: calibrate again. *Your floor is ... than the room's (allowed for)*: fix that floor in the boundary
   settings later.
9. **Lock the layout** (**Lock layout** on the page): nobody can move, add or remove a station, or move a scene or
   panel, until someone unlocks it.
10. Walk up to a station, or point at its card and pull the trigger: it runs for everyone there. Screens **Follow** a
    station from the room map.

## 3. Kiosk: one headset or screen on its own

Outside a shared room only (at a station a story ends in explore mode, as for everyone there).

- Link `<address>#airports&repeat=all&anchor=on`, remembered on the device; or press **Repeat all** and **Anchor** on
  the headset's Stories screen (press a lit one to turn it off).
- **Repeat all**: each story is followed by the next, the last by the first, with no explore mode. **Repeat one**
  replays one story.
- **Anchor**: scenes and panels stay at one spot in the room through taking the headset off, recentring, leaving VR
  and reloading. **Place again** sets them in front of you; the grip moves nothing. The Stories screen says how long
  the place holds.
- A new wearer (headset off for over 3 s) lands on the Stories screen and picks a story with the trigger or a pinch.
- Sound starts after a first tap or click (**Enter VR** counts; on a screen, click once). Only **Airports** has a
  narration; the other nine stories are silent by design.
- **TO FILL (owner):** headset settings used for a kiosk (sleep, boundary), if any.

## 4. When things go wrong

| Symptom | Try, in this order |
| --- | --- |
| Headsets not lined up | Look at the orange crosses (Shared panel open). Off the tape: **Calibrate** again. No tape used: **Re-align** on the headset that is off, then the other. *Not in the others' shared space* or *Shared space not usable*: calibrate on the tape, or press **Fresh shared space** twice (every page moves to `/s/1/` and the like, headsets leave AR; start one, wait for *Shared space found*, then the others; rooms and calibrations stay). Last resort: relay/README.md, "Starting the shared space afresh". |
| *Quest Browser ... here, ... on ...* | Versions differ: update both; meanwhile calibrate on the tape. |
| *No shared space (check the WebXR flag ...)*, *No room scan here*, *Shared space switched off here* | Section 1's settings and Space Setup; **Shared space: off** switches it on. Or calibrate on the tape. |
| Off after standby | Crosses show 30 s (*Check the marks*). *Leave AR and enter it again*: do so. Through the shared space: wait 20 s, then **Re-align**. Still off: **Calibrate**. |
| Calibrate after every restart, or *Anchors not saved (the store is full)* | Clear Quest Browser's cookies and site data on that headset, then calibrate. |
| No sound | Only **Airports** has a narration. **Play sound**, or **Sound off** to turn it back on; the headset's volume; stand within 1.5 m of the station's spot. **Sound check**: press both beeps; hearing one, choose it (**Web Audio** or **Audio element**); **Reset** unmutes and goes back to **Automatic**. Photograph its lines for the developer. |
| Stuck on its loading line, or *Could not load the ... story* | Check the relay window and `/api/ping`, then reload (headset: **Exit**, reload, enter AR again; the room link rejoins). Pages from the relay have no offline copy. |
| A headset lost its room | *connecting...*: the relay is not answering (laptop asleep, Wi-Fi, relay stopped); it reconnects by itself. *Room XYZ · this headset*: kept on the headset until the relay answers (asked every 15 s). *There is no room XYZ ...*: **Join** one under **Open rooms**, or start one and **Arrange all** (rooms go 6 hours after the last person leaves). |
| *This room runs another version of the app* | Reload on every device, then join again. |
| The relay restarted | Rooms come back by themselves from any device that was in them. Calibrations stay if the laptop's address did not change; a new address means a new certificate and calibrating again. |
| No page, or no **Enter VR** / **Enter AR** | `/api/ping` from the headset; the `https://` address on the Wi-Fi; devices kept apart by the network; the firewall. |

## 5. After the event

- [ ] Headsets: **Exit**. Laptop: `Ctrl+C` in the relay window (it tells every device first).
- [ ] Collect `relay/logs/` from the repository on the laptop: one file per headset, room and day
  (`<day>-<room>-<name>-<id>.jsonl`), written while the relay runs with `--lan`. Add a note: date, room code, headsets
  and their Quest Browser versions, and what you did when ("14:05 Ada's headset in standby for 10 minutes").
- [ ] Send them: **TO FILL (owner):** who receives the logs, and how.
- [ ] Privacy: they hold the names people used (headsets pick names such as Ada, pages take typed ones), room codes,
  positions and the page address. Never put them in a public repository: `relay/logs/` is git-ignored, and
  relay/README.md's advice to push them as a branch does not apply while the repository is public. Where they are kept:
  [data-and-permissions.md](data-and-permissions.md).

## 6. Still untested on headsets

Two Quest 3s were tried in one room several times: see [quest-shared-space-findings.md](quest-shared-space-findings.md)
and the end of AGENTS.md "Shared rooms". Not yet confirmed on a device:

- lining up again after standby, and after a night;
- whether **Re-align** (or asking again by itself 15 s after waking) joins the others' shared space;
- whether a headset that left AR and came back is told *Not in the others' shared space*;
- saved anchors found again after a restart (the calibration's, and **Anchor**'s kiosk place);
- what a recentre (long press on the Meta button) does to the room;
- moving and resizing scenes with the grips at a station (comfort, and how it looks to others);
- sound zones: each station's narration heard from where it stands;
- comfort and frame rate with other people drawn;
- whether the link to the relay keeps running inside a headset session.

**If there is time, a test round for the logs**, on fresh headsets (**TO FILL (owner):** new or reset headsets, or only
their site data cleared). Note the time and headset for every step.

| Step | Note down |
| --- | --- |
| AR on one headset, the other ten seconds later, no tape | each panel's *Shared space ...* line; do both point at one spot? |
| **Calibrate** both on the tape | *The shared space puts ...'s marks ... cm, ...° from yours* |
| One headset in standby 5 minutes | still lined up? which notices? |
| **Re-align** on a headset that is off | back in place? |
| Leave AR and enter again on one | *Not in the others' shared space*? |
| Restart Quest Browser, enter AR | *Room calibration from last time*? crosses on the tape? |
| A recentre (long press on the Meta button) | room still on the tape? |
| Next morning, same headsets and address | lined up? crosses on the tape? |
