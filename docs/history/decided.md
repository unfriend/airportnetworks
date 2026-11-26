# Decisions that are made or built

This file is a record: entries of `HANDOVER.md`'s "Decisions for the owner" that say they are built or decided, moved here word for word on 26 November 2026 (v217). The open decisions stay in `HANDOVER.md`; what is built is told in `docs/history.md` and `docs/history/releases.md`.

## Item 5, the live site: the relay on a public server (29 October 2026; the password decided 3 November 2026)

   - **The relay on a public server** (the owner's Coolify, considered on 29 October 2026; the step-by-step guide is
     [relay/README.md](relay/README.md), "Public hosting on Coolify": a DNS name such as `rooms.lbi-netmed.com`,
     Dockerfile location `/relay/Dockerfile`, port 8787, the domain with HTTPS, `RELAY_ARGS="--proxy 1 --public"` in its
     environment, 512 MB, auto deploy from the branch it serves). It works wherever web pages do (eduroam, hotspots), serves the app
     too, and peer to peer stays the fallback when it is down. **`--public`** (3 November 2026; a laptop at an event
     runs as before) lets only the app's pages (`https://stories.lbi-netmed.com` and the relay's own) open a socket or
     use the API and the introduction server, lists no open rooms and names nobody in any answer or log line (*Rooms on
     this network* still lists a room to the devices on its network, without names), slows guessing codes to 30
     unknown codes a minute per address, caps new rooms (10 a minute), sockets (64) per address and every room's data
     together (64 MB), and keeps logs only with a token from Coolify's environment (`RELAY_LOG_TOKEN`; the app sends none
     yet). **A shared password (decided 3 November 2026, v110):** the owner: "i would like to add a secret to the relay
     like how this project does it: menchelab/asdf10k-collab-backend ... like one word like networksofthefuture2037 that
     i can use and enter on each client if i want it to be able to use the relay, no other way to use it", and "make sure
     to run everything so that it is quite the same if possible, we might merge at some point". The scheme follows
     asdf10k-collab-backend's `COLLAB_TOKEN`: set it in Coolify as a secret environment variable, and the relay asks for it
     on everything but `GET /api/health` and the app's own files (401, a socket closed 4401; 20 wrong ones a minute from
     one address, then 429 or 4429). Unlike there, the app's files carry no password (they are public on GitHub Pages):
     each device enters it once (the Shared dialog on a page, or the headset menu's *Relay password* keypad; lower-case
     letters and digits), kept per relay in that browser; changing it means every device enters it again. Without
     `COLLAB_TOKEN` the relay is open as before (a laptop at an event). What matches asdf10k-collab-backend and what still
     differs (protocol, routes, persistence) is in `relay/README.md`, "Compared with asdf10k-collab-backend". With it, a
     room's code alone no longer lets a stranger in; inside the relay's users the code still is the room's only key. Deployed
     since v116 (the test place) and v120 (the main site's relay): see the start of this item.

## Item 5, the live site: free hosting instead (4 November 2026)

   - **Free hosting instead** (the owner asked, 4 November 2026: "can we host the relay and its assets on free
     cloudflare workers and r2 or similar?"; researched with Cloudflare's and the other hosts' own pages that day, the
     numbers checked once more independently). Cloudflare's free plan could carry rooms (one Durable Object a room) and the
     studio's files (R2: 10 GB free, no charge for downloads; a card probably needed), but: one two-hour event with ten
     headsets and three laptops sends about 1.1 million messages, some 57 % of the free daily allowance (incoming
     WebSocket messages billed 20 to 1 against 100,000 requests a day), so two such events on one day stop the room
     syncing about 1.5 hours into the second, until 01:00 Vienna time, and anyone with the relay's address could use the
     allowance up (the password does not stop that); the paid plan ($5 a month) removes the cap. It would mean rewriting
     the relay for Workers (about 10 to 14 hours of agent work) and keeping two relays in step, and losing ffmpeg, Fresh
     shared space (the relay serves the app), rooms without internet, and uploads over about 95 MB without more work. Hosts
     that run the relay unchanged: the Coolify server (recommended), a small Hetzner server with Coolify (about EUR 6 a
     month), Fly.io (about $4.50), Northflank's free Sandbox (no card, always on; disk and EU region unclear: worth a
     trial), Oracle Always Free (card, reclaimed after 7 quiet days), Render free (rooms only, sleeps after 15 minutes).
     Recommendation: keep Coolify, keep the laptop relay at events; later, only if the scenes outgrow its disk, the
     studio's files on R2 with the rooms on Node. Open for the owner: the university's view of data on Cloudflare (a US
     company), a card, and the busiest day's number of sessions.

## Item 5, the live site: decided on 5 November 2026 (extended 6 November, v120)

   - **Decided** (the owner, 5 November 2026; extended on 6 November, v120): the main site stays on GitHub Pages from
     `main`, its rooms peer to peer unless a device enters the password of the main site's relay,
     https://main.lab.lbi-netmed.com/ (`HOME_RELAY` in `shared.js`); the test place is branch `dev` on the owner's Coolify (Hetzner) at
     `stories.lab.lbi-netmed.com`, deployed by a webhook, with the studio's scenes in R2 (built in v114, `--scenes r2`).
     Work goes to `dev` first, then `main` once the owner has tried it. `relay/README.md`, "The test place on Coolify".

## Item 7: fixed in v179, a studio circle made for one scene could come up empty

   - **Fixed in v179 (was an open problem): a studio circle made for one scene could come up empty (seen in v157's
     end-to-end round).** A device sent the scene's name before it had read the layout; now it sends nothing until it
     has (`freshWait`, `docs/agents/shared-rooms.md` "Known races"). What was seen: In a circle made with `addScene` ("Studio: <scene>"), where every device writes the scene's layout
     itself, the room's state ended as `{ scene, settings }` with no items in five of eight runs, written by the headset
     that walked in first, so every device showed an empty scene. A plain circle whose scene is picked on a page did not
     show it.

## Item 7: the next round (built in v124, 8 November 2026)

   - **The next round (built in v124, on `dev`; the owner, 8 November 2026)**: (a) no "Leave AR" message after standby
     ("The leave ar message after standby or resume can go away, alignment nearly always good and has a check now
     too"); (b) sound by mode ("On mobile and desktop default to no sounds and no narration until manually enabled, in ar
     and vr default to sounds but no narration"; then "narration in headsets should stay on when its turned on once but
     should also have a global setting where i can turn it off or on for every headset in the room at once (each headset
     could still turn it on or off individually and this would then reset once the headset goes into the lobby"): pages as
     before, a headset session with its own mute (off) and narration (off, remembered once on), a room-wide *On for all*
     / *Off for all* (`look.vg`, FORMAT networks-36) and each headset's own choice in a room until it goes to the lobby;
     (c) a welcome toast in headsets after lining up ("click the rooms to enter in case its in click to enter mode and
     to move to them if its in that mode, also quickly explain the controllers, the button for clicking and the button
     for grabbing"); (d) camera mode on an Android phone (idea 2 below; the owner checked that Android's screen
     recorder records Chrome's AR with the camera image); (e) a trigger cube that changes a texture (idea 3, no
     crossfade). On a page the owner's question whether Sound should bring the narration too was left open: it does, as
     before (one press);

## Item 7: the ideas of 8 November 2026, built but for one part (Google Drive upload skipped)

   - **The ideas of 8 November 2026: built, but for one part.** (1) Vive trackers with Mixamo rigs: v126; (2) camera
     mode: v124; (3) a trigger cube that changes a texture: v124 (a crossfade would add about 2 hours: dropped, the owner's "no crossfade needed", `tools/studio/engine/e6i_tex.js`
     line 3, `docs/history.md` v124); (4) uploading
     from Google Drive: skipped for now (not built on 26 November 2026: no Google Picker in the code). The part that was still open that day, a character worn with a headset and
     controllers alone (below), is built (26 November 2026 check: v164, v201, v204; what remains is under the next
     paragraph). The estimates as given that day, kept for the record: 2 and 3 were built in v124;
     1 was on the maybe list, then (the same day, with 9 to 11 Vive Tracker 3.0, three base stations, a Valve Index and a
     Windows PC with SteamVR) "we go for 1 and 3 with mixamo rigs for now, 2 and 4 we can save up for maybe later": the
     plan is `tools/trackers/SPEC.md` (the solver from v125, the rest in v126); 4 is skipped for now. Deferred within it (the
     owner, 8 November 2026): a character worn with the headset and controllers alone, whose legs would need stepping of
     their own ("skip that part for now, note it down for later and maybe the quest body tracking can solve it"): first a
     probe of Quest Browser's experimental WebXR body tracking (1 to 2 hours, 0.5M tokens).
     **Since built, by our own solver (found in the code on 26 November 2026):** people's bodies in a room are posed from
     the head and the two grips, the feet stepped, since v164 (`bodies.js`, `ik.js` setup `'head'`); a studio character
     takes any mix of trackers, a headset, controllers and tracked hands since v201 (`rig: 'any'`, `ik.js` `match` and
     `fit`: each device tied to the part it is nearest to; a foot with nothing on it is stepped, a hand with nothing on it
     hangs); *Mirror the visitor* (v204, `puppet.mirror`) drives a character from head and hands alone. What the code
     asks at least: `pupReady` in `tools/studio/engine/e6l_puppet.js` wants one device on the head or the hips (a headset
     alone will do), and with no tracker and no headset at all the card says "Nothing is seen" and nothing is worn; a
     device near neither the head nor the hips gives a red card. **What is still open:** how a headset-only body looks
     on a real character on a headset (untested; `tools/trackers/SPEC.md`, "Headset only"), and the probe of Quest
     Browser's WebXR body tracking (`body-tracking`), maybe later, not made.
     (1) *a human mesh worn and animated with Vive trackers* (maybe list) (wear trackers, line yourself up with a rigged mesh, press,
     and the mesh follows you; record takes). Quest Browser does not see Vive trackers, so they need a Windows PC with
     SteamVR (or HTC's VIVE Hub) and their dongle or base stations. A small bridge program would read their poses and
     send them to the relay. The trackers' space would be lined up with the room by setting a tracker on spot A and
     spot B. Then: inverse kinematics for arms and legs, the "stand in it and press" pose, retargeting onto common
     skeletons (Mixamo, Biped, VRM), live for everyone at the circle, and a take recorded as a clip in a GLB that the
     studio already plays. About 3 to 4 days, 12 to 16M tokens, and sessions with the owner wearing them (nothing of
     it can be judged headless). Cheaper first step: a probe of Quest Browser's own experimental WebXR body tracking
     (since Quest Browser 32, March 2024; the upper body tracked, the legs only estimated). The probe would take 1 to 2
     hours and 0.5M tokens; if it works, the puppet without trackers would take about 2 days and 8 to 10M tokens. For
     making animations alone it is overkill: Mixamo (free auto-rigging and clips) and phone-video motion capture give FBX
     clips the studio already converts and plays. It pays off for live puppetry in front of people.
     (2) *a camera mode*: an Android phone in AR (ARCore) lined up with the room, showing the circles, the stories and
     the people over the camera, following a person or a circle, its own interface hidden, so a screen recording shows
     the mixed view. It would line up by aiming a crosshair at spot A and spot B (WebXR hit test on the floor), and use
     an HTML overlay for Follow, Calibrate and Hide. About 1 day, 3 to 4M tokens. Check first, on the phone: does
     Android's own screen recorder capture the camera image of Chrome's AR (reports say pages cannot record it
     themselves). If it does not, in-page recording through Chrome's camera access would add about 3 to 4 hours.
     (3) *a trigger cube that changes a texture*: a third list on a cube (an object, a material, a slot and one of the
     scene's pictures), applied while the cube is active for you and decided by the cube entered last, as show and hide
     are, using Change texture's machinery. Per person, as every cube is; `FORMAT` networks-36. About 4 to 6 hours and
     about 2M tokens; a crossfade instead of a switch adds about 2 hours.
     (4) *uploading from Google Drive* (skipped for now): works today with Google Drive for desktop (Drive as a folder on the laptop,
     dragged onto the Upload page or picked with *Choose a folder*). Built in: *From Google Drive...* in the Upload
     pane through Google's Picker (the `drive.file` scope, non-sensitive), feeding the pane's plan as dropped files.
     That needs a Google Cloud project with an OAuth client and an API key (free, about 30 minutes of the owner's
     setup) and Google's own scripts, loaded only when pressed (an exception to the rule of no external scripts). An
     institution's Google Workspace may need its admin to allow the app. About 3 to 4 hours, 1 to 1.5M tokens. An
     import on the relay from a share link (big files straight into R2) would add about 2 to 3 hours;

## Item 7: the queue of 29 October 2026 (built)

   - **The queue** (the owner, 29 October 2026): rooms on this network, first in it, the loading bar queued alongside,
     panels per story, the design room's part 2, follow a person and the ten-headset round's changes are built and
     released as networks-v97, and the sixteenth story, on soil (item 11 below), and sound effects' phase 1 (item 12) as
     networks-v98 (see "Where things stand"). Phase 2 of the sound effects waits for the owner's listening round. Each
     item is described below;

## Item 7: rooms on this network and follow a person (built)

   - **rooms on this network**: built (see "Where things stand");
   - **follow a person**: built (see "Where things stand");

## Item 7: the design room part 2, the loading bar, station icons, live updates and subtitles (built)

   - **the design room, part 2**: built (see "Where things stand": the menu's *Design room* button, the table as a
     circle in a shared room, the stations' icons from the miniatures). Part 1 (the table) is built too (docs/agents/stories.md "The
     design room"). Of the first plan (a catalogue of the props, a player for stories written as
     data, the room with live reload, a bridge to Claude on a laptop, push-to-talk in the headset) the catalogue, the
     room's table and live reload are built and the player was dropped; the bridge and push-to-talk wait for the owner
     (the microphone inside a headset session is untested on Quest);
   - **a loading bar in the headset** (in front of you while a story loads; until v102 also a ring at the wrist clock): built (see "Where
     things stand"; docs/agents/shell.md "How the shell and stories fit together" and "Inside a story"). What could come next: a
     single shader's compile is still one task (three.js r128 cannot compile in parallel), and a few sets take 0.2 to
     0.5 s to build here; both would need changes inside three.js or the sets;
   - **station icons**: built, and since the design room's part 2 made from the miniatures (see "Where things
     stand"). (Since v190 each story's miniature is in its own package.) **For the owner, still unanswered:** approve the contact sheet of all nineteen, the sixteen stories', the design room's and, since v104, the All stories and Back to the lobby circles' (open `tools/icons.html` next to the app;
     `&turns=4` shows each from four sides) or say which miniature should stand for a story (its `icon` in
     `stories/list.js`). How they read from across a real room is untested on a headset;
   - **live updates and hot reload**: built (see "Where things stand"; docs/agents/shell.md "Hot reload and live updates";
     [docs/setup-and-release.md](docs/setup-and-release.md), step 5b and the table in section 2). A release now ends
     with `node tools/release.mjs` after bumping `VERSION` (it writes `version.json` and stamps the shell's release into
     `index.html`). Taken without asking: a new story's card, a changed story (the one on show swapped in place at a
     quiet moment, keeping its place); asked first (Reload now or Later): a new shell, a new `FORMAT`, a story that
     needs a newer shell, a station whose story the device does not know (its card says "Update needed"). While
     developing: `node relay/server.mjs --lan --watch --build`. **Untested on a headset:** a swap in place inside a
     session, the question's panel and its buttons, Enter VR to continue, and the watch channel in Quest Browser;
   - **subtitles in the headset**: built as a setting for the whole room, on or off (the owner, 29 October: "a
     switchable option per room"), replacing the earlier plan of a per-person choice (off / follow / placed, a strip
     picked up and left in the room). The strip follows the head loosely (it stays until you turn about 15 degrees
     away, then glides back); the words are the panel's, timed by word count from each line's start. Every story has a
     voice since v109, so they follow it (useful when the panel is out of view, or with the sound off). A caption bar on screens and phones, and placing the strip by hand, were not built. How they read and
     follow on a headset is untested.

## Item 9: the fourteenth story, the mutation machine (built, October 2026)

9. **The fourteenth story: "The mutation machine" (built, October 2026).** From the poster "Converting Mutation into a
   Machinery: DNA Substitution Models as Quantum Circuits" (Enes Berk Sakalli, Arndt von Haeseler; a draft, its footer
   still has placeholders), with the first author's answers on the values, the turn and how to word the result (MM2 to
   MM4 in [docs/questions-for-authors.md](docs/questions-for-authors.md)). Sources in `packages/mutation/src/` (`SPEC.md`,
   `README.md`, the sets' manifests); its maths checked by `node packages/mutation/src/test-mmath.mjs`.
   - **What it is** (about 8.5 minutes, 8 chapters, then explore): a text in four letters copied with swaps; a family
     tree in 3D that grows up from its root, its branch lengths real lengths, so you walk round it and look up into it
     (letters ride up the branches, a swap flashes where it happens); a letter as two qubits and its read-outs; the rule
     of change as balls and arrows and a path through a pyramid of mixes; the machine for one branch (copy, then turn)
     and its circuit, one machine per branch; an RNA stem, a pair breaking and the coupling; the ancestor of three
     species rebuilt 2,000 times three ways (the authors' 10 %, 43 % and 20 %, worded as the author asked: the coupling
     favours matching pairs too strongly, so its percentages are not true chances); what it is for. Explore: Letters,
     Rule, Tree, Stem and Scenes. Example numbers computed live; the poster's numbers only "in the authors' test"; the
     coupling computed live in explore is our stand-in for their circuit, labelled so. British spelling.
   - **Untested:** everything in a headset (the panels, picking branches and fields with the ray, the family tree
     standing about 1.5 m tall in front of you, its crown above your eyes, in the story and in explore's Stand in it)
     and the big tree's comfort there; so far only the headless tests have run it.
   - **Still open:** MM1 (is the poster final?), MM5 (credit and title) and MM6 (is our coupled stand-in a fair picture
     of their circuit, and may explore show it live?).

## Item 10: the fifteenth story, the shape of tissue (built, October 2026)

10. **The fifteenth story: "The shape of tissue" (built, October 2026).** From the poster "topocyte: scale-resolved
    topological phenotyping of tissue architecture across spatial modalities" (Simon Schindler, André Rendeiro, Jörg
    Menche), with the authors' GTEx liver cohort and their package topocyte, shared for this story, and their answers on
    the credit, the data, the local radius and three details (T1 to T4 in
    [docs/questions-for-authors.md](docs/questions-for-authors.md)). Sources in `packages/topo/src/` (`SPEC.md`, `README.md`,
    the sets' manifests). Its data is written by `packages/topo/src/data/gen_data.py` (Python: it runs topocyte and the poster's
    figure scripts on the authors' files, which stay out of the repository; see
    [docs/setup-and-release.md](docs/setup-and-release.md)) and checked by `node packages/topo/src/test-data.mjs`.
    - **What it is** (about 8 minutes, 8 chapters, then explore): the tour's body with its liver lifted out, a slice of
      it falling flat as a slide of real cells drawn in H&E; other ways of measuring tissue, sketched, then only the
      cells' positions; the single scales other tools fix; balls growing round the poster's 110 cells until pieces join
      and loops open and close, and the tower of scales, where the radius becomes height; 123 slides as a rack of glass
      slides with their curves, their main shapes and the space of their scores; a classifier's wall, its fair test (109
      of 123 right) and its weight for every radius (loops of 5 to 15 µm speak for cirrhosis); a new slide scored cell
      by cell, its scars red and raised, and its cells in two groups with their cell types. Explore: Patch, Cohort,
      Scales, Cells and Scenes. Every number is topocyte's: the app only looks them up. Slides are numbered, never named;
      no GTEx images. British spelling.
    - **Untested:** everything in a headset (the panels, picking slides and cells with the ray, the tower of scales
      standing about 1.5 m tall in front of you in chapters 3 and 4 and in explore's Stand at it) and the tower's comfort
      there; so far only the headless tests have run it.
    - **Still open:** T5 (the poster's panel e prints its cell v's score as 26.57; the figure's own data and topocyte
      give 6.97, which the story shows).

## Item 11: the sixteenth story, holding on to nitrogen (built, October 2026; released in v98)

11. **The sixteenth story: "Holding on to nitrogen" (built, October 2026; released in networks-v98).** For
    the Global Peter Drucker Forum in Vienna (a lay, business audience), from Christa Schleper's soil microbiology group
    at the University of Vienna: a PhD student's project, Marina Montserrat Díez's, with partners at JIRCAS in Japan, the
    University of Thessaly and Université Lyon 1. After the slides "Exploring the Effects of Biological Nitrification
    Inhibition on the Rhizosphere Microbiome of a BNI-enabled Winter Wheat" and the field trial's data behind them,
    shown with the authors' permission given through the owner (29 October 2026; anything unknown illustrative and
    labelled so). Sources in `packages/soil/src/` (`SPEC.md` with the owner's decisions, `README.md`, the sets' manifests). Its
    data is written by `packages/soil/src/data/gen_data.py` from the authors' three CSVs (kept out of the repository; see
    [docs/setup-and-release.md](docs/setup-and-release.md)), with the slides' charts read off by two readers
    (`packages/soil/src/data/reconcile.py`), and checked by `node packages/soil/src/test-data.mjs`.
    - **What it is** (11:03 as narrated since v109, 8 chapters, then explore): a cut-away block of soil with a wheat plant, where less than half
      the fertiliser reaches the crop and the microbes' relay turns the rest into nitrate and nitrous oxide; a wheat
      given a piece of chromosome from a wild grass that slows the relay (BNI); the globe and the hop to the field trial
      in Japan (24 plots, three regimes, five dates, 119 samples); the BNI wheat greener and leaking less nitrate, and
      the jars' nitrous oxide read off the slides; a crowd of about 100,000 kinds of microbe and the network of those
      that rise and fall together, which follows the fertiliser and the plots far more than the wheat. Explore: Field,
      Nitrogen (a sketch), Microbes, Network and Scenes. Its hedges: strong indications, not yet proof; rising together
      is not working together; the network is ours, built for the story. British spelling.
    - **Integrated** (29 October 2026): its card (`stories/list.js`, icon `soil.soil`), `sw.js` (`SHELL` and `AUDIO`),
      three miniatures (`soil.soil`, `soil.field`, `soil.net` in `tools/lowpoly/`), the design room's catalogue
      (`tools/design/props.json`, [docs/props.md](docs/props.md)), the smoke test (every explore tool and its links)
      and the shared-room test (`STORIES`), the docs; released in networks-v98 (`index.html`'s head, the brand and the
      start screen's title say sixteen).
    - **Untested:** everything in a headset (the panels, picking plots and kinds with the ray, the pore's bubble and the
      network at their close views); so far only the headless tests have run it.
    - **Still open:** S1 to S9 in [docs/questions-for-authors.md](docs/questions-for-authors.md) (the two N2O
      measurements, the tables behind slides 6, 7 and 9, the chlorophyll's dates, DCD, the dates, the plot map, the other
      microbes, our network, and whether the story may be public before the work is published: **TO FILL (owner)** in
      [docs/data-and-permissions.md](docs/data-and-permissions.md)).

## data-and-permissions.md, "Before the repository or the site is public": the snapshot of 22 October 2026

**Both are public already.** Checked on 22 October 2026: GitHub reports `unfriend/airportnetworks` as public, and
GitHub Pages serves it at `https://stories.lbi-netmed.com/` (the github.io address redirects there) with the same version as `main`
(`networks-v64`; nine stories, the microanatomy story is not on `main` yet).

## data-and-permissions.md, the third-party table as it stood (v217); the OpenFlights, Kokoro and Piper rows are kept in the file

Third-party material:

| What | Where | Licence or terms |
| --- | --- | --- |
| three.js r128 | `three.min.js` | MIT; the notice is `three.LICENSE.txt` and must ship with it |
| PeerJS 1.5.5 | `peerjs.min.js` (loaded only for a peer-to-peer room) | MIT; the notice is `PEERJS-LICENSE.txt` and must ship with it |
| B612 font | `fonts/` (since v213; until then loaded from Google Fonts), in `sw.js` `SHELL` | SIL Open Font License 1.1, the B612 Project Authors; the licence ships with it (`fonts/OFL.txt`) |
| App icons | `icons/` | the project's own, CC BY 4.0 (the owner, 20 November 2026: "icons are fine under cc 4.0") |
| OpenFlights routes, 2014 | embedded in `packages/airports/main.js`; positions reused in `packages/lbi/main.js` | ODbL: credit OpenFlights (the story does), and a database adapted from it and used in public, such as the embedded routes, has to be offered under the ODbL too. Check how this fits the project licence |
| Natural Earth coastlines | `packages/airports/main.js` | public domain |
| Geist et al., Med 2025 | `packages/pet/src/` | CC BY 4.0: credit the authors (the story does) |
| Buljan et al., bioRxiv 2025 | `packages/micro/src/` | CC BY-NC: credit, and no commercial use |
| EndotypY | used by `packages/endo/src/data/gen_data.py` only, not shipped | MIT |
| Kokoro-82M v1.0 (hexgrad), its American voice `af_heart` | every story's narration but the airports' (since v109; the tour's since October 2026), `packages/<key>/audio/narration.mp3`, made by `tools/voice/` (the model is not shipped) | Apache-2.0: the recordings it makes are ours to use; no speaker to ask. Each story's credits say the narration is a synthetic voice (Kokoro; the pass story's German: Piper's Thorsten). kokoro-onnx (MIT), espeak-ng and phonemizer (GPL-3) only run offline to make it: nothing of them ships |
| Piper's German voice Thorsten, high quality (`de_DE-thorsten-high`, from `rhasspy/piper-voices` on Hugging Face) | the pass story's German narration, `packages/pass/audio/narration-de.mp3`, made by `tools/voice/` (the model is not shipped; its English one is Kokoro's, above) | Its model card (`de/de_DE/thorsten/high/MODEL_CARD`): dataset Thorsten-Voice (github.com/thorstenMueller/Thorsten-Voice), licence CC0; training: finetuned from the U.S. English lessac voice (high quality). The voices repository is marked MIT. The lessac voice's model card gives its dataset's licence as the Blizzard 2013 Lessac data's (cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html), a research licence: research purposes only, no commercial use (checklist below). The speaker gave his voice under CC0: no speaker to ask. The story's credits should say the German narration is a synthetic voice (Piper, Thorsten). piper-tts (GPL-3.0-or-later) and its espeak-ng only run offline to make it: nothing of them ships |

