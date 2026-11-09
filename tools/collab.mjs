// Headless test of shared rooms (docs/shared-space-plan.md, section 9).
//   node tools/collab.mjs [--shots <dir>]
// It starts its own relay (relay/server.mjs --static .) on a free port, so no other server is needed, and
// checks: a page served by the relay starts a room; a mistyped code makes no room; Arrange all's two rows; three
// pages see the same stations; Remove asks first; per story in STORIES (below) play, pause, a jump and mode
// changes reach a following page (within 5 s: a busy machine is slow), the explore state round-trips both ways
// and the story's effect reaches the others; two people changing different controls at once both keep their
// change; a switch asked for while a story loads is not lost; a story picked by hand stops following; the stories'
// sound effects (on the first story followed: every page at the station plays the same cues at the same moment, a pause
// on one stops them on all, a page joining mid-play plays none of the past ones, a slideshow stop plays none past it;
// the flock's falcon and the robots' crumbs sounding on the others: STORIES' sound); no writes while idle (no ping-pong); a late joiner gets everything; a page follows a pretend person in a headset (from the
// people list's Follow: the station they walk into, switching as they walk, staying when they step out of every circle,
// stopping when they leave, or when the page follows a station or picks a story by hand; the dialog's line "Following
// <name> (at <story>)"); a relay restart is survived; the headsets' settings
// (labels, cards, free moving) are the room's: labels on top and cards in 3D in a room without them, set on one page, in the Shared
// dialog or the headset's menu for every page and headset, never refused by the circles lock, kept across a relay
// restart and in a room on this device, free moving off taking the turns out of places and panels, and a free grip
// at a station turning the scene and the panel for everyone; a station's panels (shown, controls only, hidden: key
// st.<id>.ui) and its story's lock set in a page's Shared dialog or a headset's menu, with the circles locked too, for
// everyone at that circle and no other, kept across a relay restart; a pretend headset (fake local-floor and shared spaces,
// as tools/smoke.mjs pretends) aligns from a published frame, shows no story and no Stories screen away from every
// station (the story hidden, not pointable, paused, nothing written), stands at its station once it walks into its
// circle (the others then icons only, a ring within 2 m), stays there when taken off and on again, never shows a Stories screen in a room,
// stays in its story when it walks out (shown, playing, in step both ways; a story is left only by walking into another
// circle) and nothing happens when it walks back in,
// sends its rays in room coordinates, re-aligns when the frame moves, switches story by walking to another station
// (and takes its state; the trigger on a card runs nothing from afar), lets the story's own panel win over a card
// behind it, has Sound check in its menu; a headset without a shared space calibrates from two marks (its panel's
// Stop calibrating still works), saves the frame with an anchor at mark A and finds it again next time; a VR
// headset asks once whether it is in the room, and takes its own floor when elsewhere; the headset's menu (closed
// at first, nothing at the wrist, a notice saying how to open it; opened by either stick's click or two quick
// pinches of the left hand pointing at nothing, floating in front of you, carried by the grip, closing by itself
// unused; four tabs, the Story tab working the story's own panels, Exit under Settings); a headset in an empty room sees only the menu, opened by
// itself, and leaving the room brings its Stories screen back. Then peer to peer (no relay: pages whose relay calls go
// nowhere, as on GitHub Pages, introduced by the relay's own introduction server at /peerjs, so nothing goes to the
// internet): a page starts a room and hosts it, two more join by its link (the dialog says who hosts it); Arrange all,
// presence, play, pause and a
// jump at a station, an explore state both ways; the host leaves and the page longest in the room takes it over (the
// stations and keys kept, the station's clock without a jump though the new host's own clock is 3 s off), the other
// follows it, the old host comes back as a guest; a host that falls silent (its id still held) is replaced once its id
// is free; an introduction server that cannot be reached leaves the room on this device; a relay that cannot be
// reached as a room is joined makes it peer to peer; a headset that hosts hands the room to the first screen that
// joins. --shots also saves pictures (the Shared dialog on a desktop and a phone, eight pretend headset views). --quick
// runs only the last story of STORIES in the per-story part (for a quicker run while working on the rest); --p2p runs
// only the peer-to-peer part; --design only the design room in a room (its station from the page's dialog and the
// headset menu's button, the lock, Arrange all, the icons from the miniatures; with --shots its pictures); --follow only
// following a person (a room of its own with two stations; with --shots the people list with Follow and the dialog
// following someone); --circles only the ten-headset round (headsetRound: a room of its own with three stations; rings
// only in a circle and a ring's card on pointing, people at your circle, the two locks; with --shots its pictures);
// --smooth only others' moves drawn smoothly (smoothRound: a raw socket turning a station's scene and its explore view,
// moving its panel, carrying another station and walking a person's head at 15 Hz with ts, a pretend headset there
// moving steadily, about DELAY behind, landing where it was let go; a grip there right after never pulled back; a value
// with no ts gliding; one for another story moving nothing; a held grip writing at most 16 place values a second);
// --all only the room's arc and the All stories and Back to the lobby circles (allRound: rooms of its own; the arc a page
// makes, followed by every page and at every headset without walking in, moved in front of the first headset, a pick for
// everyone there, carried by the grip on its cards and on the map, turned into a circle by Add, Arrange all and the lobby;
// a headset first in a room; a room from before v109; then its switch joining the room's circle of that story, the lobby,
// Arrange all; with --shots its pictures, all-*.png);
// --guide only the room setup guide, its startup flow and the checks (guideRound: a room of its own with two pretend
// headsets; the flow opening by itself every session, Skip for now, its pages, two checks with someone 3 cm and 40 cm
// apart, one alone; the first headset's calibration on two spots setting the room, the second straight to Check, checks
// on their own at spot A and B, green and red, Calibrate from Line up; the laptop's Setting up a room; with --shots its
// pictures);
// --token only the relay's password (tokenRound, not in the main run: a relay of its own with COLLAB_TOKEN; a page
// without it sees the dialog's field and nothing starts or is joined peer to peer; a wrong one refused; the right one
// starts the room and is kept; a second page joins by the link, which has no password; a pretend headset uses the menu's
// keypad page and joins; the password in no log, address, room key or relay line; Forget the password; with --shots
// token-*.png);
// --studio only the studio in a room (studioRound, also in the main run: relays of its own from port 8790 up, with --scenes
// on a temporary copy of tools/studio/test/scenes; three pages and a pretend headset at a studio station: Studio here, a
// scene picked for all, two edits at once both kept, the headset's trigger cube, Save from the headset (.history/), a file
// added to the folder in the Add lists, the story's lock, Convert to GLB switching every page, a texture added from a
// card, a ball made on a page saved lighter (Fewer triangles) and given a picture from the headset (Change texture, saved
// there), a sound following the dancer's head on every device and in the saved layout, a long sound streamed, the
// relay's /upload and the Upload pane sorting the test originals into models/, sounds/ and originals/; then a relay with
// COLLAB_TOKEN: nothing without the password, everything with it, the password written nowhere; then the scenes in R2
// (--scenes r2) against the stand-in S3 on another port (from 8840 up): files by signed links, Save, Convert to GLB and
// the Upload pane straight into the bucket, the pretend headset, the password nowhere; with --shots studio-*.png);
// --ask only the circles asked first (askRound, also in the main run after the ten-headset round: a room of its own with two
// story circles and the lobby; a page's dialog turns the room's switch on; a pretend headset walking into a circle enters
// nothing; the trigger on another circle's icon asks in front of it, Not now, closing by itself after 10 s, Go in entering
// it from elsewhere, the lobby's Go in ending the station; the menu's row turning it off and walking in working again;
// nothing written but look; with --shots ask-1-question.png);
// --menus only your menu shown to your circle (menusRound, also in the main run after the circles asked first: a room of
// its own with two story circles, a page and three pretend headsets; off by default; A's My menu: my circle drawn on B, at
// the same circle, where A's menu floats, its picture A's menu, under 48 KB and at most one every 1.5 s (every 4 s while
// only a button's light changes), following A's menu as it glides, gone when it closes, the setting goes off or the session ends; nothing on C at the other circle; the page's
// people list; with --shots menus-*.png);
// --studio-scenes only the studio's scenes as circles (scenesRound, also in the main run after the studio round: a relay of
// its own with --scenes on the test scenes, read only; the page's Add listing "Studio: <scene>" after the studio, adding
// one writing the station and its state with the scene, two at once, their titles, Studio here's rule);
// --behave only the studio's behaviours shared (behaveRound, also in the main run after the studio's scenes as circles: a
// relay of its own with --scenes on the test scene alone; two pretend headsets at a studio circle and a page following it:
// the nearest headset drives a ball that follows, every device saying so and drawing it where it does (120 ms behind its
// samples while it walks), the other coming nearer by more than 0.3 m taking it over, a looker staying the first one's
// until they leave, nobody in range: both home everywhere);
// --standby only the pretend headset's standby with the shared space in use (standbyRound: a room of its own with a station
// per story, the pretend headset aligned through the shared space as in the main run, then the main run's own steps,
// standbySteps: the shared space at the head and as its own floor, standby with the floor moved 15 cm and a wrong space
// held off, the room back at the same height once the space agrees, woken again on the first floor; a minute or two);
// --narration only the narration in headsets and the welcome (narrationRound, also in the main run after your menu shown to
// your circle: a room of its own with a story circle and the lobby, a page and two pretend headsets; the narration off by
// default in a session; the page's dialog's Narration for everyone (look's vg); one headset's own Off (its menu, its story
// panel's button) an override never written to the room; Off for all and On for all from a headset's menu dropping them;
// an override kept through a new session, dropped in the lobby and on leaving; the welcome after lining up, asked first,
// walked into, tracked hands, once a session, not while the guide shows, outside a room, never in camera mode);
// --walk only moving with the sticks for a VR headset elsewhere in a room (walkRound, v128, also in the main run after the
// narration round: a room of its own with an airports circle and Back to the lobby, a page and a pretend VR headset that
// answers Somewhere else, its frames through the session's own requestAnimationFrame so the shell's hook moves three.js's
// space: the left stick moves it, the page hears its head move as far, the room's frame and the circles stay put, no jump
// and no calibrate; walked into a circle by the sticks, into Back to the lobby with the circles asked first; a flick a
// turn; a headset in AR gets no travel; In this room takes it back; a minute or two);
// --trackers only the PC's Vive trackers end to end (trackersRound, also in the main run after the studio's behaviours: a
// relay of its own from port 8730 up with --trackers and --scenes on a copy of the test and puppet scenes, the fake bridge
// with SteamVR's space turned and moved against the room, three pages and a pretend VR headset that is not a Quest's
// browser: the dialog's switch, lining up by hand through /api/trackers/still, names; the trackers within 2 mm of the truth
// at one held time; the headset lined up by them (the Index); at a studio circle a shape on a prop tracker within 5 mm, the
// puppet rig worn from a walking performer's trackers solved alike everywhere, a take saved through the relay that plays
// on another page; with --shots trackers-1-dialog.png);
// --port N runs the relay on port N (default: any free port).
// Needs Playwright as tools/smoke.mjs does (PLAYWRIGHT_MODULE, CHROMIUM_PATH). Exits 1 on any failure.
//
// Adding a story: give it its hooks (the plan's section 7, as the flock has them), then an entry in STORIES:
//   change / back: code (run with HOST.cur.peek) that changes the story's shared explore state, and changes it
//                  again differently (both must change what collab.state() returns)
//   effect (optional): quiet stops the story's own effects, idle is true when none is playing, send causes one
//                  (calling HOST.collab.effect), seen is true on the other page once it plays there
//   more (optional): async (A, B, C) => more checks of its own, after the effect (A changed things, B and C follow)
//   sound (optional): the sound effects the effect plays on the others (their SFXQ.log), e.g. the flock's falcon
// The first entry starts on every page's Stories screen with its story already loaded (Follow must close it);
// the last is the station page A follows last, so it is the pretend headset's (HEADSET_STORY).
import { spawn } from 'child_process';
import { connect as tcpConnect } from 'net';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const STORIES = {
  airports: {
    change: "(showTab('closures'), xrSetK(20), setView('color', 'btw'))",
    back: "(X.manual.add(A('LHR')), updateClosures(), showTab('communities'), X.iso = 3, renderCommunities(), X.hubsBy = 'btw', renderHubs(), X.routes = 1.1)",
  },
  proteins: {
    change: "(selectAirport(A('TP53')), showTab('communities'), X.iso = 3, renderCommunities(), xrSetK(20), setView('pillars', 'btw'))",
    back: "(X.manual.add(A('EGFR')), updateClosures(), xrPathPreset(A('BACE1'), A('BRCA1')), showTab('path'), X.hubsBy = 'btw', renderHubs(), setView('color', 'deg'), X.routes = 1.1)",
  },
  spatial: {
    change: "setView('color', 'deg'); setMove(MV.nfkb, true); runPath(A('EGF'), A('SRF'))",
    back: "showTab('prox'); setBait(CP('NUP153')); X.proxR = 0.12; selectProtein(A('RELA'), false)",
  },
  lbi: {
    change: "openScene('atp'); setCtl('atp', 'view', 'network')",
    back: "showTab('protein'); selectProtein(findProtein('TP53')); xrPathPreset(findProtein('TP53'), findProtein('BRCA1'))",
  },
  nmd: {
    change: "selectGroup(5); togglePick(5, 13); runWalk(5); setCtl('tower', 'show', 'walk')",
    back: "addMine(findGene('TTN')); addMine(findGene('DES')); runWalk('mine'); knockRandom(10); showTab('layers')",
  },
  endo: {
    change: "selectEndo(2); showTab('method'); showStep(0); setK(8)",
    back: "showTab('genes'); selectGene(GL.sets.net.api().geneIndex('SNAP25')); setCtl('net', 'walkers', 'on'); setK(3)",
  },
  pet: {
    change: "showNet('A_high'); selectOrgan('liver'); setCtl('scan', 'view', 'inside')",
    back: "showNet('C_high'); selectOrgan('muscle'); setCtl('scan', 'view', 'ring')",
  },
  micro: {
    change: "selectOrgan('Ovary'); setAge(70); setStep(3)",
    back: "selectDomain('submucosa'); showTab('domains'); setCtl('hier', 'view', 'contacts')",
  },
  qubits: {
    change: "sceneCtl('cube', 'net', '2'); selectBrick('X2X1'); setCtl('cube', 'bits', '2')",
    back: "setSum(6); setCtl('cube', 'alg', '0'); showTab('depth'); sceneCtl('chart', 'view', 'circuit')",
  },
  pass: {
    // (and the school's place at the station, sea: moved with the grip there, the same for everyone)
    change: "pickTab('outbreak'); setStart('LHR'); setOut('inc', 3); setOut('cut', 50); selectCity('SYD'); XR.lifeSt.set(0.4, -0.3, 1.25)",
    back: "selectProtein('RELA'); setMove('nfkb'); setFishK(3); setFishN(450); pickTab('fish'); XR.lifeSt.set(-1.5, 0.2, 0)",
    effect: { quiet: "setCtl('fish', 'shark', 'off')", idle: '!GL.sets.fish.sharkOn()', send: 'sendShark(null)', seen: 'GL.sets.fish.sharkOn()' },
    // up to four sharks (the owner, 1 November 2026): A and B being the shark, both their sharks swim on C, each in its
    // owner's colour; and the school is shared fish by fish: every page records its fish as drawn in each frame (the
    // frame's relay time, FSY.at), and each frame of a follower is compared with the leader's two round it
    async more(A, B, C) {
      const ids = await Promise.all([A, B].map(p => p.evaluate(() => HOST.collab.id)));
      for (const [k, p] of [A, B].entries()) {
        await peek(p, 'setShark(true)');
        await p.evaluate(k => { window.__steer = setInterval(() => { const f = HOST.cur.peek('GL.sets.fish'), c = f.state().centre, t = performance.now() / 1000; f.steer([c[0] + 2.5 * Math.cos(t * 0.8 + k * 3), c[1] + 0.3 * k, c[2] + 2.5 * Math.sin(t * 0.8 + k * 3)]); }, 50); }, k);
      }
      const farOn = 'GL.sets.fish.state().sharks.filter(H => H.on && H.kind === "far")';
      const two = await until(C, ([ids, q]) => HOST.cur.peek(q).map(H => H.who + (/^#/.test(H.col) ? '' : '?')).sort().join() === ids.slice().sort().join(), [ids, farOn], 8000);
      check('pass: two people being the shark: both their sharks swim on a third page, each in its owner\'s colour', two, JSON.stringify(await peek(C, `${farOn}.map(H => [H.who, H.col])`)));
      const meds = [];
      // (smaller pages while it records: three drawing the sea in software here can fall to a frame a second, too few to keep a leader)
      const size = A.viewportSize();
      for (const p of [A, B, C]) await p.setViewportSize({ width: 320, height: 200 });
      await sleep(2000);
      await Promise.all([A, B, C].map(p => p.evaluate(() => { const R = window.__rec = { f: [], id: HOST.collab.id }; const tick = () => { if (window.__rec !== R) return; const at = HOST.cur.peek('FSY.at'), s = HOST.cur.peek('GL.sets.fish');
        if (at && (!R.f.length || R.f[R.f.length - 1].at !== at)) { const z = s.state(), l = z.lag || 0; R.f.push({ at, lead: HOST.cur.peek('FSY.lead'), P: Array.from(z.P.subarray(0, z.N * 3), (x, i) => x + z.V[i] * l) }); }
        requestAnimationFrame(tick); }; requestAnimationFrame(tick); })));
      await sleep(10000);
      const recs = await Promise.all([A, B, C].map(p => p.evaluate(() => { const R = window.__rec; window.__rec = null; return R; })));
      for (const p of [A, B, C]) await p.setViewportSize(size);
      // (the leader: the page the others follow in most of their frames; only its frames while it leads and theirs while
      // they follow it count, as pages drawing a frame every few seconds here can lose the lead for a moment)
      const votes = {}; for (const r of recs) for (const x of r.f) if (x.lead) votes[x.lead] = (votes[x.lead] || 0) + 1;
      const lid = Object.keys(votes).sort((x, y) => votes[y] - votes[x])[0];
      const L = recs.find(r => r.id === lid), Lf = L ? L.f.filter(x => !x.lead) : [];
      // (and a follower's frames only once it has followed it for 3 s on end: after losing it, it glides back at 4 m/s)
      const steady = F => { let t0 = null; return F.f.filter(x => { if (x.lead !== lid) { t0 = null; return false; } if (t0 === null) t0 = x.at; return x.at - t0 >= 3000; }); };
      if (L) for (const F of recs.filter(r => r !== L)) for (const f of steady(F)) {
        const k = Lf.findIndex((a, j) => j + 1 < Lf.length && a.at <= f.at && Lf[j + 1].at >= f.at), a = Lf[k], b = Lf[k + 1];
        if (k < 0 || a.P.length !== f.P.length || b.at - a.at > 1500) continue;
        const u = b.at > a.at ? (f.at - a.at) / (b.at - a.at) : 0, d = [];
        for (let i = 0; i < f.P.length / 3; i++) d.push(Math.hypot(...[0, 1, 2].map(c => f.P[i * 3 + c] - (a.P[i * 3 + c] + (b.P[i * 3 + c] - a.P[i * 3 + c]) * u))));
        meds.push(d.sort((x, y) => x - y)[d.length >> 1]);
      }
      const ms = meds.sort((x, y) => x - y), mm = ms[ms.length >> 1];
      // (pages too slow to keep a leader here, a frame every few seconds, are said so and not judged)
      // (but followers that drew frames enough, three a second, and still seldom held one leader for 3 s on end are
      // judged: a leader that keeps changing is a failure, not a slow machine; below about 1.5 a second it changes here)
      const plenty = !!L && recs.filter(r => r !== L).every(r => r.f.length >= 30);
      if (ms.length < 4) console.log(`     (pass: ${plenty ? 'frames enough but' : 'too few frames:'} ${ms.length} steady follower frames in 10 s (frames per page ${recs.map(r => r.f.length).join(', ')})${plenty ? '' : ', not judged'})`);
      check('pass: the school is shared fish by fish (with two sharks in it): a follower\'s fish within 0.5 m of the leader\'s (median)', !!L && (ms.length < 4 ? !plenty : mm < 0.5),
        `median over ${ms.length} follower frames ${mm === undefined ? '-' : mm.toFixed(3)} m, 90th percentile ${ms.length ? ms[Math.floor(ms.length * 0.9)].toFixed(3) : '-'} m`);
      for (const p of [A, B]) await p.evaluate(() => { clearInterval(window.__steer); HOST.cur.peek('setShark(false)'); });
      check('pass: let go, their sharks swim off on the third page', await until(C, q => !HOST.cur.peek(q).length, farOn, 6000));
    },
  },
  ovary: {
    change: "selectKind('follicle'); setAge(60); setMethod('seg')",
    back: "showTab('scenes'); openScene('section'); setCtl('section', 'view', 'kinds'); selectKind('vessel')",
  },
  mutation: {
    change: "pickTab('rule'); sceneCtl('rule', 'model', 'even'); sceneCtl('rule', 'start', 'C'); setTime(0.8)",
    // (the pair favour picked by hand turns the stem's numbers to this example, computed live)
    back: "pickTab('tree'); sceneCtl('tree', 'seed', '3'); selectBranch(4); setW(20)",
  },
  topo: {
    change: "pickTab('cohort'); sceneCtl('cohort', 'dim', '0'); showView('cohort', 'space'); selectSlide(16); setR(30, false)",
    back: "pickTab('cells'); sceneCtl('map', 'delta', '100'); selectCell(1233); setMR(4.8); setFrom(10); setTo(20)",
  },
  soil: {
    // (the network: a module, a threshold, split by wheat line; then the field: a date, its nitrate, a group of plots)
    change: "pickTab('network'); selectModule(2); setRho(0.72); setSplit('line')",
    back: "pickTab('field'); sceneCtl('field', 'date', '2'); pickShow('no3'); selectPlot(4)",
  },
  robots: {
    change: "setCtl('robots', 'rule', 'chain'); setCtl('robots', 'robots', '12')", back: "setCtl('robots', 'trails', 'on'); setCtl('robots', 'links', 'on')",
    effect: { quiet: '0', idle: "(window.__c0 = GL.sets.robots.anchors.crumbs().join(), true)", send: 'spillCrumbs()', seen: "GL.sets.robots.anchors.crumbs().join() !== window.__c0" },
    sound: ['patter'],   // (sound effects: crumbs spilled on one page patter on the others)
    // the pile lands at the same spot everywhere, and a dusty floor again (a counter, not state) dusts the others' too
    async more(A, B) {
      const pile = p => peek(p, 'GL.sets.robots.anchors.crumbs().join()');
      const [a, b] = [await pile(A), await pile(B)];
      check('robots: the crumbs land at the same spot on the others', a === b, `A ${a}, B ${b}`);
      const d0 = await peek(A, 'Math.floor(XS.robots_dust || 0)');
      await peek(B, 'dustAgain()');
      check('robots: a dusty floor again on one page dusts the others', await until(A, d => HOST.cur.peek('Math.floor(XS.robots_dust || 0)') === d + 1, d0, 5000),
        `A from ${d0} to ${await peek(A, 'XS.robots_dust')}`);
    },
  },
  flock: {
    change: "setCtl('flock', 'birds', '400')", back: "setCtl('flock', 'birds', '100')",
    effect: { quiet: "setCtl('flock', 'falcon', 'off')", idle: '!GL.sets.flock.falconOn()', send: 'sendFalcon(null)', seen: 'GL.sets.flock.falconOn()' },
    sound: ['whoosh', 'flutter'],   // (sound effects: each falcon's dive and the flock bursting away, on every page)
    // the flock belongs to the station: the same falcon everywhere; one page leads, the others take its flight time
    // and fly with its flock (positions in the set's frame, the same on every page)
    async more(A, B, C) {
      const fal = p => peek(p, 'GL.sets.flock.falconOn() ? GL.sets.flock.state().falcon.p.slice() : null');
      const [fa, fb] = await Promise.all([fal(A), fal(B)]);
      check('flock: the falcon flies the same way on the others', !!fa && !!fb && Math.hypot(fa[0] - fb[0], fa[1] - fb[1], fa[2] - fb[2]) < 10, `A ${fa}, B ${fb}`);
      await sleep(3000);
      for (const p of [A, B, C]) await until(p, () => !HOST.cur.peek('GL.sets.flock.falconOn()'), null, 15000);   // scattered birds gather again
      await sleep(3000);
      const fl = p => peek(p, '(() => { const s = GL.sets.flock, f = s.flight(); return { lead: !s.following(), t: f.t, m: f.m }; })()');
      const f = await Promise.all([A, B, C].map(fl)), d = (a, b) => Math.hypot(a.m[0] - b.m[0], a.m[1] - b.m[1], a.m[2] - b.m[2]);
      const show = JSON.stringify(f.map(x => ({ lead: x.lead, t: +x.t.toFixed(2), m: x.m.map(v => +v.toFixed(1)) })));
      check('flock: one page at the station leads, the others follow it', f.filter(x => x.lead).length === 1, show);
      check('flock: every page flies on the leader\'s flight time', Math.max(...f.map(x => x.t)) - Math.min(...f.map(x => x.t)) < 0.6, show);
      check('flock: the flocks fly together (their middles within 5 m)', d(f[0], f[1]) < 5 && d(f[0], f[2]) < 5, show);
      // up to four falcons (the owner, 1 November 2026): two sent at once from two pages fly on the third; and the birds
      // are shared bird by bird: every page records its birds as drawn in each frame (the frame's relay time, FSY.at),
      // and each frame of a follower is compared with the leader's two round it
      await peek(A, 'sendFalcon(null)'); await peek(B, 'sendFalcon([0, 0.4, -1])');
      check('flock: two falcons at once, sent from two pages, fly on the third', await until(C, () => HOST.cur.peek('GL.sets.flock.falcons()') === 2, null, 5000), String(await peek(C, 'GL.sets.flock.falcons()')));
      const meds = [];
      // (smaller pages while it records: three drawing the sky in software here can fall to a frame a second, too few to keep a leader)
      const size = A.viewportSize();
      for (const p of [A, B, C]) await p.setViewportSize({ width: 320, height: 200 });
      await sleep(2000);
      await Promise.all([A, B, C].map(p => p.evaluate(() => { const R = window.__rec = { f: [], id: HOST.collab.id }; const tick = () => { if (window.__rec !== R) return; const at = HOST.cur.peek('FSY.at'), s = HOST.cur.peek('GL.sets.flock');
        if (at && (!R.f.length || R.f[R.f.length - 1].at !== at)) { const z = s.state(), l = z.lag || 0; R.f.push({ at, lead: HOST.cur.peek('FSY.lead'), P: Array.from(z.P.subarray(0, z.N * 3), (x, i) => x + z.V[i] * l) }); }
        requestAnimationFrame(tick); }; requestAnimationFrame(tick); })));
      await sleep(10000);
      const recs = await Promise.all([A, B, C].map(p => p.evaluate(() => { const R = window.__rec; window.__rec = null; return R; })));
      for (const p of [A, B, C]) await p.setViewportSize(size);
      // (the leader: the page the others follow in most of their frames; only its frames while it leads and theirs while
      // they follow it count, as pages drawing a frame every few seconds here can lose the lead for a moment)
      const votes = {}; for (const r of recs) for (const x of r.f) if (x.lead) votes[x.lead] = (votes[x.lead] || 0) + 1;
      const lid = Object.keys(votes).sort((x, y) => votes[y] - votes[x])[0];
      const L = recs.find(r => r.id === lid), Lf = L ? L.f.filter(x => !x.lead) : [];
      // (and a follower's frames only once it has followed it for 3 s on end: after losing it, it glides back at 4 m/s)
      const steady = F => { let t0 = null; return F.f.filter(x => { if (x.lead !== lid) { t0 = null; return false; } if (t0 === null) t0 = x.at; return x.at - t0 >= 3000; }); };
      if (L) for (const F of recs.filter(r => r !== L)) for (const fr of steady(F)) {
        const k = Lf.findIndex((a, j) => j + 1 < Lf.length && a.at <= fr.at && Lf[j + 1].at >= fr.at), a = Lf[k], b = Lf[k + 1];
        if (k < 0 || a.P.length !== fr.P.length || b.at - a.at > 1500) continue;
        const u = b.at > a.at ? (fr.at - a.at) / (b.at - a.at) : 0, dd = [];
        for (let i = 0; i < fr.P.length / 3; i++) dd.push(Math.hypot(...[0, 1, 2].map(c => fr.P[i * 3 + c] - (a.P[i * 3 + c] + (b.P[i * 3 + c] - a.P[i * 3 + c]) * u))));
        meds.push(dd.sort((x, y) => x - y)[dd.length >> 1]);
      }
      const ms = meds.sort((x, y) => x - y), mm = ms[ms.length >> 1];
      // (pages too slow to keep a leader here, a frame every few seconds, are said so and not judged)
      // (but followers that drew frames enough, three a second, and still seldom held one leader for 3 s on end are
      // judged: a leader that keeps changing is a failure, not a slow machine; below about 1.5 a second it changes here)
      const plenty = !!L && recs.filter(r => r !== L).every(r => r.f.length >= 30);
      if (ms.length < 4) console.log(`     (flock: ${plenty ? 'frames enough but' : 'too few frames:'} ${ms.length} steady follower frames in 10 s (frames per page ${recs.map(r => r.f.length).join(', ')})${plenty ? '' : ', not judged'})`);
      check('flock: the birds are shared bird by bird (two falcons passing): a follower\'s birds within 0.5 m of the leader\'s (median)', !!L && (ms.length < 4 ? !plenty : mm < 0.5),
        `median over ${ms.length} follower frames ${mm === undefined ? '-' : mm.toFixed(3)} m, 90th percentile ${ms.length ? ms[Math.floor(ms.length * 0.9)].toFixed(3) : '-'} m`);
    },
  },
};
// the stories a pretend headset walks between: its own (the last in STORIES, whose station has an explore clock and
// stored state; the flock's sky catches every ray, so its rays have a length), another, one whose card it points at
// (the trigger there runs nothing: stations are walk-in only) and one it moves by its card
const HEADSET_STORY = 'flock', OTHER_STORY = 'spatial', PICK_STORY = 'proteins', MOVE_STORY = 'nmd';   // (PICK_STORY: its card is pointed at)

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2), shots = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : '';
const P2P = argv.includes('--p2p'), P2P_KEY = 'proteins', P2P_T = STORIES[P2P_KEY];   // (peer to peer: the station followed there)
const NEAR_ONLY = argv.includes('--near');   // (only rooms on this network)
const DESIGN_ONLY = argv.includes('--design');   // (only the design room in a room: designOnly)
const FOLLOW_ONLY = argv.includes('--follow');   // (only following a person: personFollow, in a room of its own)
const CIRCLES_ONLY = argv.includes('--circles');   // (only the ten-headset round: headsetRound, in a room of its own)
const SMOOTH_ONLY = argv.includes('--smooth');   // (only others' moves drawn smoothly: smoothRound, in a room of its own)
const CODE_ONLY = argv.includes('--code');   // (only a room joined by its code from a headset's menu: codeRound)
const ALL_ONLY = argv.includes('--all');   // (only the All stories and Back to the lobby circles: allRound, in a room of its own)
const GUIDE_ONLY = argv.includes('--guide');   // (only the room setup guide and Touch the spot: guideRound, in a room of its own)
const TOKEN_ONLY = argv.includes('--token');   // (only the relay's password: tokenRound, a relay of its own with COLLAB_TOKEN; not in the main run)
const STUDIO_ONLY = argv.includes('--studio');   // (only the studio in a room: studioRound, relays of its own with --scenes)
const ASK_ONLY = argv.includes('--ask');   // (only the circles asked first: askRound, in a room of its own)
const SCENES_ONLY = argv.includes('--studio-scenes');   // (only the studio's scenes as circles: scenesRound, a relay of its own with --scenes)
const HOME_ONLY = argv.includes('--home');   // (only the relay the main site offers: homeRound, a browser of its own that takes the site's names for this machine)
const MENUS_ONLY = argv.includes('--menus');   // (only your menu shown to your circle: menusRound, in a room of its own)
const BEHAVE_ONLY = argv.includes('--behave');   // (only the studio's behaviours shared: behaveRound, a relay of its own with --scenes)
const NARR_ONLY = argv.includes('--narration');   // (only the narration in headsets and the welcome: narrationRound, in a room of its own)
const CAMERA_ONLY = argv.includes('--camera');   // (only camera mode: cameraRound, in a room of its own)
const STANDBY_ONLY = argv.includes('--standby');   // (only the pretend headset's standby with the shared space in use: standbyRound, in a room of its own)
const WALK_ONLY = argv.includes('--walk');   // (only moving with the sticks for a VR headset elsewhere in a room: walkRound, in a room of its own)
const TRACKERS_ONLY = argv.includes('--trackers');   // (only the PC's Vive trackers end to end: trackersRound, a relay of its own with --trackers and --scenes, and the fake bridge)
const ALL_T = STORIES[PICK_STORY];   // (the All stories round's story: kept, as --quick drops it from STORIES)
if (argv.includes('--quick')) for (const k of Object.keys(STORIES).slice(0, -1)) delete STORIES[k];
const relayPort = argv.includes('--port') ? +argv[argv.indexOf('--port') + 1] : 0;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
// (peer to peer: host candidates as plain addresses, not mDNS names, and links between pages on this machine)
// (the fake microphone, granted without asking: the studio's voice recorded with a movement, v125)
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection',
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: LAUNCH_ARGS });
// every device starts with the room's automatic All stories circles off (a page's arc in a room with no stations, the
// first headset's circle: v109), as installXR turns the first headset's off: only the All stories round asks for them
// ({ arc: true } with a context's options, or open(hash, size, true)). Likewise every device starts with a room that never
// wrote look's ask walking into its circles, as before v120 (collabAskDefault = walk), since nearly every round walks in:
// only the round of the circles asked first takes the new default ({ ask: true }, or open(hash, size, arc, true)). And every
// device starts with the headsets' welcome (v124, Getting around: once a session, in front of the headset) off, so a
// pretend headset's view and its notices are as before (the notice The menu shows instead); installXR turns it on for a
// session that asks ({ welcome: true }: the narration round's)
const newContext = browser.newContext.bind(browser);
browser.newContext = async (o = {}) => {
  const { arc, ask, welcome, ...rest } = o, ctx = await newContext(rest);
  await ctx.addInitScript(w => { try { if (!w.arc) localStorage.setItem('collabAutoAll', 'off'); if (!w.ask) localStorage.setItem('collabAskDefault', 'walk'); if (!w.welcome) localStorage.setItem('collabAutoWelcome', 'off'); } catch (e) { /* storage blocked */ } }, { arc: !!arc, ask: !!ask, welcome: !!welcome });
  return ctx;
};
const fails = [], errors = [];
const check = (name, ok, detail) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (!ok && detail ? ': ' + detail : ''));
  if (!ok) fails.push(name);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const near = (a, b, tol) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const fmt = a => '[' + a.map(v => (+v).toFixed(4)).join(', ') + ']';
const r3 = x => Math.round(x * 1000) / 1000;
const angle = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };

// ---- the relay
let relay = null, port = 0;
function startRelay(p) {
  return new Promise((res, rej) => {
    const r = spawn(process.execPath, ['relay/server.mjs', '--port', String(p || 0), '--static', '.', '--quiet'], { cwd: root });
    let out = '';
    const t = setTimeout(() => rej(new Error('the relay did not start: ' + out)), 10000);
    r.stdout.on('data', d => {
      out += d;
      const m = /listening on http:\/\/[^:]+:(\d+)/.exec(out);
      if (m) { clearTimeout(t); port = +m[1]; relay = r; res(r); }
    });
    r.stderr.on('data', d => { out += d; });
    r.on('exit', c => { if (!port) rej(new Error('the relay stopped (' + c + '): ' + out)); });
  });
}
const stopRelay = () => new Promise(res => { if (!relay) return res(); relay.once('exit', res); relay.kill('SIGTERM'); relay = null; });
const base = () => `http://127.0.0.1:${port}/`;
const roomInfo = async code => (await fetch(base() + 'api/rooms/' + code)).json();

// ---- pages: each in its own browser context (its own storage, like separate devices)
async function open(hash, size, arc, ask) {
  // (arc: the room's automatic All stories circles on; ask: a room that never wrote look's ask asks first, v120's default)
  const ctx = await browser.newContext({ viewport: size || { width: 640, height: 400 }, arc: !!arc, ask: !!ask });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.stack || e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(base() + 'index.html' + hash, { timeout: 90000 });   // (pages already open draw in software: a busy machine loads slowly)
  await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
  return page;
}
const until = (page, fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 1000, polling: 30 }).then(() => true, () => false);
const peek = (page, src) => page.evaluate(s => HOST.cur.peek(s), src);
const ready = (page, key, ms) => until(page, k => HOST.curKey === k && HOST.cur && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0') &&
  (!HOST.cur.collab || HOST.collab.internals().ready), key, ms || 40000);
const clockOf = page => peek(page, '[APP.mode, APP.playing, APP.t]');
const stateOf = page => page.evaluate(() => JSON.stringify(HOST.cur.collab.state()));
const stationOf = (page, story) => page.evaluate(k => (HOST.collab.stations().find(s => s.story === k) || {}).id, story);

// ---- poses in the pretend room: [x, y, z, yaw] (yaw about the vertical, three.js's way)
const rot = (yaw, v) => [v[0] * Math.cos(yaw) + v[2] * Math.sin(yaw), v[1], -v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw)];
const apply = (P, v) => { const r = rot(P[3], v); return [r[0] + P[0], r[1] + P[1], r[2] + P[2]]; };
const unapply = (P, v) => rot(-P[3], [v[0] - P[0], v[1] - P[1], v[2] - P[2]]);
const unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
// the physical room: the room frame, the shared space's origin, this headset's local-floor and local origins
let ROOM = [2, 0, 1, 0.3];
const SHARED = [-1, 0, 0.5, 1.1], FLOOR = [0.4, 0, -0.7, -0.5], LOCAL = [0.9, 1.6, 0.2, 0.8];
// the calibration spots are tape crosses on the floor (v122), touched with the controller's tip on it: its target ray's
// origin TIP over the true floor (y 0 in the pretend room; shared.js's FLOOR_TIP)
const TIP = 0.02;
const frameFor = (P, uuid, by, at) => ({ uuid, o: unapply(SHARED, [P[0], P[1], P[2]]), x: rot(-SHARED[3], rot(P[3], [1, 0, 0])), by, at, src: 'marks' });

// a pretend headset session in a page (WebXR in software, as tools/smoke.mjs does): fake spaces and frames
// whose poses come from the room above; the story's xrBegin and the shell's own frame callback are driven by step()
function installXR(o) {
  if (HOST.collab.autoAll) HOST.collab.autoAll(!!o.autoAll);   // (the first headset's All stories circle: only where a test asks for it)
  if (HOST.collab.autoGuide) HOST.collab.autoGuide(!!o.guide);   // (the room setup guide opening by itself: likewise)
  if (HOST.collab.autoWelcome) HOST.collab.autoWelcome(!!o.welcome);   // (the welcome, Getting around, once a session: likewise)
  const V = (x, y, z) => new THREE.Vector3(x, y, z), Y = V(0, 1, 0);
  const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(Y, a[3]), V(1, 1, 1));
  const X = window.__xr = { W: { local: M(o.local), floor: M(o.floor), shared: M(o.shared), head: M(o.head) }, raf: [], made: [], handles: window.__handles || new Map(), resets: {}, n: 0 };
  window.__handles = X.handles;   // saved anchors outlive a session, as on a headset
  const sp = name => ({ name, addEventListener(t, fn) { (X.resets[name] = X.resets[name] || []).push(fn); }, removeEventListener() {} });
  X.spaces = { local: sp('local'), 'local-floor': sp('local-floor'), shared: Object.assign(sp('shared'), { UUId: o.sharedId || '' }) };
  // (o.walk: moving with the sticks, the walk round's: the local space makes offset spaces, as WebXR's do, its origin at the
  // offset's pose in it: what the shell's hook answers three.js's questions from while the sticks have moved you)
  if (o.walk) X.spaces.local.getOffsetReferenceSpace = T => { const m = new THREE.Matrix4().fromArray(T.matrix); return Object.defineProperty(sp('local-moved'), 'world', { get: () => X.W.local.clone().multiply(m) }); };
  // a phone (o.phone: camera mode's round): its viewer space is where its camera is (the head), aimed by X.look
  if (o.phone) X.spaces.viewer = Object.defineProperty(sp('viewer'), 'world', { get: () => X.W.head });
  const world = s => s.world || X.W[{ local: 'local', 'local-floor': 'floor', shared: 'shared' }[s.name]];
  const pose = m => {
    const p = V(), q = new THREE.Quaternion(), sc = V();
    m.decompose(p, q, sc);
    return { transform: { position: { x: p.x, y: p.y, z: p.z, w: 1 }, orientation: { x: q.x, y: q.y, z: q.z, w: q.w }, matrix: Float32Array.from(m.elements) } };
  };
  // (a phone's Chrome: anchors without persistent handles)
  const mkAnchor = w => o.phone ? { anchorSpace: { world: w }, delete() {} } : mkAnchorQ(w);
  const mkAnchorQ = w => { const a = { anchorSpace: { world: w }, delete() {},
    requestPersistentHandle: () => {   // a full store (o.cap handles) refuses, with Quest Browser's words
      if (o.cap && X.handles.size >= o.cap) return Promise.reject(new DOMException('Failed to execute \'requestPersistentHandle\' on \'XRAnchor\': Maximum number of anchors reached!', 'InvalidStateError'));
      const u = 'room' + ++X.n + Math.random().toString(36).slice(2, 6); X.handles.set(u, w); return Promise.resolve(u);
    } }; return a; };
  X.frame = {
    getPose: (s, b) => pose(world(b).clone().invert().multiply(world(s))),
    getViewerPose: b => pose(world(b).clone().invert().multiply(X.W.head)),
    getJointPose: (j, b) => (j && j.world ? pose(world(b).clone().invert().multiply(j.world)) : null),   // a tracked hand's joint
    createAnchor(t, b) {
      const w = world(b).clone().multiply(new THREE.Matrix4().compose(V(t.position.x, t.position.y, t.position.z),
        new THREE.Quaternion(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w), V(1, 1, 1)));
      X.made.push({ p: [t.position.x, t.position.y, t.position.z], space: b.name });
      return Promise.resolve(mkAnchor(w));
    },
  };
  // a phone's hit test (o.phone): its view straight ahead meets the floor (y 0 of the pretend room) where it points down,
  // nothing while it has not found the floor yet (X.noFloor) or points up
  if (o.phone) X.frame.getHitTestResults = src => {
    if (!src || src !== X.hitSrc || X.noFloor) return [];
    const p = V().setFromMatrixPosition(X.W.head), d = V(0, 0, -1).transformDirection(X.W.head);
    if (d.y > -0.05) return [];
    const at = p.addScaledVector(d, -p.y / d.y);
    return [{ getPose: b => pose(world(b).clone().invert().multiply(new THREE.Matrix4().makeTranslation(at.x, 0, at.z))) }];
  };
  X.sl = []; X.ev = {};
  X.session = { mode: o.mode, enabledFeatures: o.features, visibilityState: 'visible', renderState: {},
    addEventListener(t, fn) { if (t === 'visibilitychange') X.sl.push(fn); else (X.ev[t] = X.ev[t] || []).push(fn); },
    removeEventListener(t, fn) { X.sl = X.sl.filter(f => f !== fn); if (X.ev[t]) X.ev[t] = X.ev[t].filter(f => f !== fn); }, inputSources: [],
    requestReferenceSpace: t => (t === 'local' || o.features.includes(t) || (o.phone && t === 'viewer') ? Promise.resolve(X.spaces[t]) : Promise.reject(new Error(t + ' not supported'))),
    requestAnimationFrame(cb) { X.raf.push(cb); return X.raf.length; },
    restorePersistentAnchor: u => (X.handles.has(u) ? Promise.resolve(mkAnchor(X.handles.get(u))) : Promise.reject(new Error('unknown'))),
    deletePersistentAnchor: u => { if (X.stuck) return Promise.reject(new DOMException('cannot delete', 'InvalidStateError')); X.handles.delete(u); return Promise.resolve(); },
    get persistentAnchors() { return [...X.handles.keys()]; } };
  // (o.walk: two controllers with sticks, held a little in front of the head, as the shell's hook and its double clicks
  // read them: X.stick(hand, x, y) pushes one, X.click(hand) presses and lets go its stick)
  if (o.walk) {
    const pad = () => ({ axes: [0, 0, 0, 0], buttons: [0, 1, 2, 3, 4, 5].map(() => ({ pressed: false, touched: false, value: 0 })), hapticActuators: [] });
    const held = dx => Object.defineProperty({}, 'world', { get: () => X.W.head.clone().multiply(M([dx, -0.4, -0.3, 0])) });
    X.L = { handedness: 'left', targetRayMode: 'tracked-pointer', targetRaySpace: held(-0.2), gripSpace: held(-0.2), gamepad: pad() };
    X.R = { handedness: 'right', targetRayMode: 'tracked-pointer', targetRaySpace: held(0.2), gripSpace: held(0.2), gamepad: pad() };
    X.session.inputSources.push(X.L, X.R);
    X.stick = (h, x, y) => { const a = X[h].gamepad.axes; a[2] = x; a[3] = y; };
  }
  // (and a phone's session ends as a person ends it: Exit, camera mode's)
  if (o.phone) Object.assign(X.session, { domOverlayState: o.overlay === false ? undefined : { type: 'screen' }, end: () => { X.ended = (X.ended || 0) + 1; X.end(); return Promise.resolve(); },
    requestHitTestSource: q => (q && q.space === X.spaces.viewer ? Promise.resolve(X.hitSrc = { space: q.space, cancel() { if (X.hitSrc === this) X.hitSrc = null; } }) : Promise.reject(new Error('no such space'))) });
  const xr = HOST.renderer.xr;
  X.getRef = X.getRef || xr.getReferenceSpace;
  xr.getReferenceSpace = () => X.spaces.local;
  X.begin = () => {
    HOST.closePicker();
    HOST.mode = o.mode; HOST.session = X.session;
    HOST.cur.peek('(XR.session = HOST.session, XR.mode = HOST.mode, xrEnterScene())');
  };
  // one frame: the story's headset loop (which asks HOST.anchor.frame), then the shell's own callback
  // (while a story changes, the next one only joins in once it has taken over the session: xrAdopt)
  X.step = () => {
    if (HOST.cur && HOST.cur.peek('typeof XR !== "undefined" && XR.on')) HOST.cur.peek('xrBegin')(X.frame, 0.016);
    for (const cb of X.raf.splice(0)) cb(performance.now(), X.frame);
  };
  X.head = h => { X.W.head = M(h); };
  // the phone held at eye (room coordinates), its camera looking at target: where its view straight ahead goes
  X.look = (eye, target) => { X.W.head = new THREE.Matrix4().lookAt(V(...eye), V(...target), Y).setPosition(V(...eye)); };
  // the headset taken off (hidden) or put on again (visible): its listeners in the order they were added
  X.visibility = v => { X.session.visibilityState = v; for (const fn of X.sl.slice()) fn({ session: X.session }); };
  // a session event (squeezestart, squeezeend) to the listeners the page added
  X.fire = (t, e) => { for (const fn of (X.ev[t] || []).slice()) fn(e); };
  // controller i by its whole pose in the story's local space: the story's controller and the session's input
  // source (whose target ray the shell reads while it carries a station)
  X.aim = (i, m) => {
    const c = HOST.cur.peek('XR.ctrls')[i];
    const src = X.session.inputSources[i] || (X.session.inputSources[i] = { targetRayMode: 'tracked-pointer', handedness: i ? 'left' : 'right', gamepad: null, targetRaySpace: {} });
    c.src = src; c.g.visible = true; c.g.matrix.copy(m);
    src.targetRaySpace.world = X.W.local.clone().multiply(m);
  };
  // a controller's ray, given in the room (world) coordinates
  X.ctrl = (i, ow, dw) => {
    const c = HOST.cur.peek('XR.ctrls')[i];
    if (!ow) { c.src = null; c.g.visible = false; return; }
    const inv = X.W.local.clone().invert(), ol = V(...ow).applyMatrix4(inv), dl = V(...dw).normalize().transformDirection(inv);
    c.src = c.src || { targetRayMode: 'tracked-pointer', handedness: i ? 'left' : 'right', gamepad: null };
    c.g.visible = true;
    c.g.matrix.compose(ol, new THREE.Quaternion().setFromUnitVectors(V(0, 0, -1), dl), V(1, 1, 1));
  };
  X.end = () => { try { HOST.cur.peek('xrEnded()'); } catch (e) { /* no story */ } HOST.session = null; HOST.mode = null; xr.getReferenceSpace = X.getRef; };
  // local-floor moves to F (the room's pose of its origin) and says so as Quest Browser does: a reset whose
  // transform carries points from the old coordinates into the new ones, its height the head's change (dy, which
  // must not count); err moves the reported origin (Quest's was 1 to 1.5 cm out)
  X.floorReset = (F, dy, err) => {
    const old = X.W.floor, E = err ? M([F[0] + err[0], F[1], F[2] + err[2], F[3]]) : M(F);
    X.W.floor = M(F);
    const newFromOld = new THREE.Matrix4().makeTranslation(0, dy || 0, 0).multiply(E.clone().invert().multiply(old));
    for (const fn of X.resets['local-floor'] || []) fn({ transform: { matrix: Float32Array.from(newFromOld.elements), inverse: { matrix: Float32Array.from(newFromOld.clone().invert().elements) } } });
  };
  return true;
}
// the pretend headset H put down and woken up (standbySteps, and the main run's nights): the floor moved to F (its reset
// saying how) and the shared space at S meanwhile, then 20 frames; and the shared space back at S (its reset; nothing is
// let go within 20 s of waking, so that time is taken as passed), giving when the room last looked at the space
const sleepWake = (H, F, S) => H.evaluate(([F, S]) => {
  const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
  X.visibility('hidden'); X.floorReset(F, 0.2); X.W.shared = M(S); X.visibility('visible');
  for (let k = 0; k < 20; k++) X.step();
  return { src: HOST.room.src, frame: HOST.room.frame && { o: HOST.room.frame.o.slice(), x: HOST.room.frame.x.slice() }, held: window.__collabLog.slice(-40).some(e => e.ev === 'shared held after wake') };
}, [F, S]);
const spaceBack = (H, S) => H.evaluate(S => {
  const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z);
  X.W.shared = new THREE.Matrix4().compose(V(S[0], S[1], S[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), S[3]), V(1, 1, 1));
  for (const fn of X.resets.shared || []) fn({ transform: null });
  HOST.room.internals().visibleAt -= 21000;   // (nothing is let go within 20 s of waking)
  return HOST.room.internals().recAt;   // (when the room last looked at the shared space: not since the hold began)
}, S);
// a pretend headset aligned through the shared space (U1, the room's frame published for it, src 'adopted', its floor
// FLOOR): the shared space glitching as Quest Browser's did, then standby with the shared space in use, and woken again on
// the first floor (the main run's pretend headset, and --standby's: standbyRound). wantO: the room's origin on FLOOR
async function standbySteps(H, wantO) {
  // the shared space as the relay logs caught Quest Browser: its pose at the head right after waking (not used,
  // nothing compared or published from it), and a space that is just this headset's own floor (named on the panel)
  const glitch = await H.evaluate(() => {
    const X = window.__xr, keep = X.W.shared, R = HOST.room.internals(), sa = R.sharedAlign;
    R.sharedAlign = false;   // the adopted frame stays put meanwhile
    X.head([-6, 1.6, 6, 0]);   // away from the stations (a second at one would make it the headset's)
    X.W.shared = X.W.head.clone(); X.step(); X.step();
    const atHead = !R.sharedOK && R.sharedHead && window.__collabLog.some(e => e.ev === 'shared at head');
    X.W.shared = X.W.floor.clone(); X.step(); X.step();
    const own = R.sharedOK && /your own floor/.test(HOST.room.sharedLine());
    X.W.shared = keep; X.step(); X.step();
    R.sharedAlign = sa;
    return { atHead, own, back: R.sharedOK && !R.sharedHead && !/your own floor/.test(HOST.room.sharedLine()) };
  });
  check('headset: a shared space at the head is not used, and one that is just its own floor is named on the panel', glitch.atHead && glitch.own && glitch.back, JSON.stringify(glitch));
  // standby with the shared space in use: the floor moves while the headset sleeps (a reset says how; Quest's floor
  // came back 12 to 17 cm off) and the shared space is wrong for a while: the frame the reset carried over holds;
  // once the space is back and agrees, the room is where it was, and at the same height as before
  const F6 = [FLOOR[0] + 0.5, -0.15, FLOOR[2] - 0.3, FLOOR[3] + 0.6], JUNK = [SHARED[0] + 0.8, 0, SHARED[2] - 0.4, SHARED[3] + 0.35];
  const held6 = await sleepWake(H, F6, JUNK);
  const r6 = await spaceBack(H, SHARED);
  // The room takes the space's frame again, at its held height, on its first look at the space once the space agrees
  // (a look at most every 500 ms, R.recAt, and only in a frame). This step used to wait a fixed 800 ms of frames, which
  // failed in every main run of v119 and v120: a page drawing in software spends 1 to 4 s on some of its frames (shaders
  // compiled as the stations' icons and cards first show), and where those frames fall had moved. When the room's last look
  // before the standby came less than 500 ms before the space agreed (the menu's notice, waited for above, came late, just
  // after such a frame), the next such frame took the rest of the 800 ms, and the height was read before the room had
  // looked again. So the frames go on until that look has been made (up to 8 s), and the room is read then. (recAt only
  // grows by a look, to that moment's performance.now(): a reset that had zeroed it leaves r6 at 0, and only a look after
  // it passes.) A wait that runs out fails the check below, which says so
  const t6 = Date.now();
  const looked = await until(H, r => { window.__xr.step(); const R = HOST.room.internals(); return !R.wakeHold && R.recAt > r; }, r6, 8000);
  const waited = Date.now() - t6;
  console.log(looked ? `     (the room looked at the shared space again ${waited} ms after it was back)`
    : `     (the room had not looked at the shared space again, or still held its frame, ${waited} ms after it was back)`);
  const back6 = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, note: HOST.room.floorNote(), after: window.__collabLog.filter(e => e.ev === 'shared after wake').slice(-1)[0] || null,
    // (what the room did meanwhile, for a failure: its height comes back from the shared space, and is lost if the space's id changed)
    trail: window.__collabLog.filter(e => /shared|floor|wake|frame|reset|visib|height/.test(e.ev)).slice(-16).map(e => [e.t, e.ev, e.id || e.src || e.d || e.was || ''].join(' ')) }));
  const w6 = unapply(F6, ROOM.slice(0, 3)), x6 = rot(-F6[3], rot(ROOM[3], [1, 0, 0]));
  check('headset: after standby, while the shared space is wrong, the frame the floor\'s reset carried over holds', held6.src === 'adopted' && held6.held && !!held6.frame &&
    near([held6.frame.o[0], held6.frame.o[2]], [w6[0], w6[2]], 2e-3) && near(held6.frame.x, x6, 2e-3), JSON.stringify(Object.assign(held6, { want: [w6, x6] })));
  check('headset: once the shared space agrees again the room is where it was, at the same height though the floor moved 15 cm', looked && back6.src === 'adopted' &&
    near(back6.frame.o, [w6[0], 0.15, w6[2]], 2e-3) && near(back6.frame.x, x6, 2e-3) && !!back6.after && back6.after.agree && /floor moved 15 cm down/.test(back6.note),
    (looked ? '' : 'the room did not look at the shared space again within 8 s: ') + JSON.stringify(Object.assign(back6, { want: [w6, x6], waited, r6 })));
  await sleepWake(H, FLOOR, SHARED);   // and back to the floor the rest expects
  await H.evaluate(() => { HOST.room.internals().visibleAt -= 21000; });   // (held for 20 s after waking, at the height it had)
  await frames(H, 800);
  // (a frame or two at a time on a busy machine: given up to 8 s more to come back)
  await until(H, w => { window.__xr.step(); const o = HOST.room.frame && HOST.room.frame.o; return !!o && Math.abs(o[0] - w[0]) < 2e-3 && Math.abs(o[1]) < 2e-3 && Math.abs(o[2] - w[2]) < 2e-3; }, wantO, 8000);
  check('headset: woken again on the first floor, the room is back on it', near(await H.evaluate(() => HOST.room.frame.o), [wantO[0], 0, wantO[2]], 2e-3),
    fmt(await H.evaluate(() => HOST.room.frame.o)));
}
// --standby: only the pretend headset's alignment through the shared space and its standby steps (standbySteps), in a
// room of its own set up as the main run's pretend headset finds it: a station for every story (Arrange all), the room's
// frame published for the shared space U1 by a page, the headset away from the stations, aligned through U1 (a minute)
async function standbyRound() {
  const A = await open('#stories');
  await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(A, () => HOST.collab.status === 'open', null, 10000);
  const rc = await A.evaluate(() => HOST.collab.code);
  await A.evaluate(() => HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }));
  await until(A, () => HOST.collab.stations().length === HOST.list.length && !HOST.collab.internals().pending.size, null, 5000);
  const H = await open('#s=' + rc);
  await until(H, () => HOST.collab.status === 'open' && HOST.collab.stations().length === HOST.list.length, null, 20000);
  await ready(H, 'airports');
  const aId = await A.evaluate(() => HOST.collab.id);
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);
  await H.evaluate(() => HOST.room.sharedAlign(true));
  await H.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [0, 1.6, 0, 0] });
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 400);
  await H.evaluate(() => window.__xr.head([-6, 1.6, 6, 0]));   // (away from the stations, as in the main run)
  await H.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'U1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
  await frames(H, 300);
  const fr = await H.evaluate(() => HOST.room.frame && { o: HOST.room.frame.o, x: HOST.room.frame.x, src: HOST.room.src });
  const wantO = unapply(FLOOR, ROOM.slice(0, 3)), wantX = rot(-FLOOR[3], rot(ROOM[3], [1, 0, 0]));
  check('standby: the pretend headset aligns from the frame published for its shared space', fr && fr.src === 'adopted' && near(fr.o, [wantO[0], 0, wantO[2]], 1e-4) && near(fr.x, wantX, 1e-4),
    fr ? `${fr.src} o ${fmt(fr.o)} x ${fmt(fr.x)}, want o ${fmt(wantO)} x ${fmt(wantX)}` : 'no frame');
  // (the main run waits here for the notice saying how to open the menu, 2.5 s into the session)
  await until(H, () => { window.__xr.step(); return window.__collabLog.some(e => e.ev === 'notice' && e.title === 'The menu'); }, null, 8000);
  await standbySteps(H, wantO);
  await H.evaluate(() => window.__xr.end()).catch(() => {});
  for (const p of [A, H]) await p.context().close();
}
// frames for a while (real time passes: the station dwell, the reconciliation)
const frames = (page, ms) => page.evaluate(async ms => {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) { window.__xr.step(); await new Promise(r => setTimeout(r, 16)); }
}, ms);
const rigOf = page => page.evaluate(() => { const r = HOST.cur.peek('GL.rig'); return [r.position.x, r.position.y, r.position.z, 2 * Math.atan2(r.quaternion.y, r.quaternion.w)]; });
// where a story's rig must stand at station s: its spot at eye height, in this headset's local space
const rigAt = (s, L) => { L = L || LOCAL; const w = apply(ROOM, [s.x, 1.6, s.z]); return [...unapply(L, w), ROOM[3] + s.yaw - L[3]]; };
const headAt = (s, yaw) => [...apply(ROOM, [s.x, 1.6, s.z]), yaw || 0];
// a spot 2 m (or a little more) from station s with every other station more than 1.7 m away (room coordinates [x, z]):
// walking there leaves s's circle and enters no other
const awaySpot = (page, s) => page.evaluate(s => {
  const all = HOST.collab.stations().filter(o => o.id !== s.id);
  for (let r = 2; r < 4; r += 0.5) for (let k = 0; k < 24; k++) {
    const a = k * Math.PI / 12, x = s.x + r * Math.sin(a), z = s.z + r * Math.cos(a);
    if (all.every(o => Math.hypot(o.x - x, o.z - z) > 1.7)) return [x, z];
  }
  return null;
}, s);
// where a ray rests on station id, in the story's space: a point on its ring, 0.5 m over the floor (its near side, seen
// from the pretend headset's head) while the ring can be pointed at, else its icon (in a circle the others show their icons only,
// and a ring only within 2 m of its spot)
const ringAt = (page, id) => page.evaluate(id => {
  const X = window.__xr, O = HOST.collab.overlay(), o = O.rings.get(id);
  if (!o) return null;
  if (!O.hit.includes(o.ring)) return o.ball.getWorldPosition(new THREE.Vector3()).toArray();
  const c = o.ring.getWorldPosition(new THREE.Vector3()), head = new THREE.Vector3().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
  return c.addScaledVector(head.sub(c).setY(0).normalize(), 0.48).toArray();
}, id);
// controller 0 of a pretend headset pointing from just below its head at t (the story's space), for a couple of frames
// (the session's input source too, whose grip the shell hears)
const pointAt = (page, t) => page.evaluate(t => {
  const X = window.__xr, V = THREE.Vector3;
  const head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert()), o = head.clone().add(new V(0.12, -0.3, -0.1));
  X.aim(0, new THREE.Matrix4().compose(o, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), new V(...t).sub(o).normalize()), new V(1, 1, 1)));
  X.step(); X.step();
  const h = HOST.collab.internals().hov.get(0);
  return h && h.target.kind === 'station' ? h.target.id : '';
}, t);
// walk a pretend headset to station s: after a second there its story starts (frames go on until it has), and
// takes over the session as a story does in its init (xrAdopt). Returns whether it switched, and not too early.
async function walk(page, s, story, yaw, ms) {
  await page.evaluate(h => window.__xr.head(h), headAt(s, yaw));
  await frames(page, 500);
  const early = await page.evaluate(k => HOST.curKey === k, story);
  let ok = false;
  for (let i = 0; i < 40 && !ok; i++) { await frames(page, 300); ok = await page.evaluate(k => HOST.curKey === k, story); }
  ok = ok && await ready(page, story, ms || 40000);   // (ms: a scene story on a machine busy with other pages loads slowly)
  if (ok) { await page.evaluate(() => HOST.cur.peek('xrAdopt()')); await frames(page, 200); }
  return ok && !early;
}

// ---- the design room in a room (not a story): the Shared dialog's station picker lists it after the stories, and adding
// it there makes a station every page sees; refused while the layout is locked (Add, and the headset menu's Design room
// button through HOST.collab.design); Arrange all leaves it where it is, never moving or removing it. Removed at the end
// (the rest counts one station per story). The headset's button is checked with the pretend headset (headsetDesign)
async function designRoom(A, B, C) {
  const n0 = await A.evaluate(() => HOST.collab.stations().length);
  const dsg = await A.evaluate(async () => {
    HOST.collab.dialog(true); await new Promise(r => setTimeout(r, 300));
    const sel = document.querySelector('#shAdd'), opts = [...sel.options].map(o => o.value), last = sel.options[HOST.list.length];   // (then All stories and Back to the lobby)
    sel.value = 'design'; document.querySelector('[data-sh="add"]').click();
    for (let k = 0; k < 20 && !HOST.collab.stations().some(x => x.story === 'design'); k++) await new Promise(r => setTimeout(r, 100));
    const st = HOST.collab.stations().find(x => x.story === 'design');
    HOST.collab.dialog(false);
    return { opts, n: HOST.list.length, extra: (self.STORY_EXTRA || []).map(m => m.key), last: last && last.textContent, st };
  });
  const id = dsg.st && dsg.st.id, same = (p, want) => until(p, w => { const s = HOST.collab.station(w.id); return !!s && s.story === 'design' && Math.abs(s.x - w.x) < 1e-6 && Math.abs(s.z - w.z) < 1e-6 && Math.abs(s.yaw - w.yaw) < 1e-6; }, want, 5000);
  const seen = !!id && await same(B, dsg.st) && await same(C, dsg.st);
  // (the pages that are not stories, STORY_EXTRA's design room and studio, after the stories; then the shell's two circles)
  check('the design room: the Shared dialog\'s station picker lists it after the stories (then the studio, All stories and Back to the lobby), and Add makes its station for every page',
    dsg.opts.slice(dsg.n).join() === dsg.extra.concat('all', 'lobby').join() && dsg.extra[0] === 'design' && dsg.opts.indexOf('design') === dsg.n && /design room/i.test(dsg.last) && seen, JSON.stringify(dsg));
  // locked: Add and the menu's button (HOST.collab.design) refused; nothing added or moved
  await A.evaluate(() => HOST.collab.lock(true));
  await until(B, () => HOST.collab.locked, null, 3000);
  const lk = await B.evaluate(async () => {
    const a = HOST.collab.add('design', { x: 1, z: 1, yaw: 0 }), d = HOST.collab.design({ x: -1, z: 2, yaw: 1 });
    await new Promise(r => setTimeout(r, 400));
    return { a, d, n: HOST.collab.stations().length };
  });
  const lkSame = !!id && await same(A, dsg.st);
  await A.evaluate(() => HOST.collab.lock(false));
  await until(B, () => !HOST.collab.locked, null, 3000);
  check('the design room: while the layout is locked neither Add nor the Design room button places it (nothing added or moved)', lk.a === '' && lk.d === '' && lk.n === n0 + 1 && lkSame, JSON.stringify(lk));
  // Arrange all: the stories in their rows as before, the design room's table left where it is
  await A.evaluate(() => HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }));
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);
  await sleep(300);
  const arr = await B.evaluate(() => ({ n: HOST.collab.stations().length, stories: HOST.collab.stations().filter(s => HOST.list.some(m => m.key === s.story)).length }));
  check('the design room: Arrange all leaves its station where it is (never part of Arrange all)', !!id && await same(B, dsg.st) && arr.n === n0 + 1 && arr.stories === n0,
    JSON.stringify(arr));
  // the menu's button in a room when the room has a table: it moves that one to your feet (one table, not a pile)
  const mv = await B.evaluate(async id => { const d = HOST.collab.design({ x: 3.5, z: 1.25, yaw: 0.5 }); await new Promise(r => setTimeout(r, 400)); return { d, n: HOST.collab.stations().length, s: HOST.collab.station(id) }; }, id);
  const moved = await same(A, { id, x: 3.5, z: 1.25, yaw: 0.5 });
  check('the design room: with a table in the room, the Design room button moves it to your feet for everyone (no second table)', mv.d === id && mv.n === n0 + 1 && moved, JSON.stringify(mv));
  await A.evaluate(id => HOST.collab.remove(id), id);
  await until(B, id => !HOST.collab.station(id), id, 5000); await until(C, id => !HOST.collab.station(id), id, 5000);
}

// a pretend headset's head put at (x, y, z) in room coordinates, looking along yaw (room)
const goRoom = (p, x, y, z, yaw) => p.evaluate(([x, y, z, yaw]) => {
  const X = window.__xr, R = HOST.room.internals(), v = new THREE.Vector3(x, y, z).applyMatrix4(R.m).applyMatrix4(X.W.local);
  const a = yaw + R.yaw + Math.atan2(-X.W.local.elements[2], X.W.local.elements[0]);
  X.head([v.x, v.y, v.z, a]);
}, [x, y, z, yaw]);
// render what H sees from its head, looking at yaw (room) and pitch
// (size [w, h]: drawn at twice that off screen and scaled down, instead of at the page's size)
// (pre: code run in the story just before drawing, as HOST.cur.peek runs it)
async function headView(H, file, yawRoom, pitch, size, pre) {
  const url = await H.evaluate(([yawRoom, pitch, size, pre]) => {
    const X = window.__xr, R = HOST.room.internals(), r = HOST.renderer;
    const loop = HOST.cur.peek('frame');
    r.setAnimationLoop(null);
    // (placed as its frame places it in a headset: a story built from sets by its view, a life-size one round you)
    HOST.cur.peek('(typeof xrPlace === "function" && xrPlace(APP.mode === "story" ? storyCam(storyT(APP.t)) : orbit.cur), (APP.mode === "story" || typeof XS !== "undefined") && ' +
      'xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS), XR.panels.forEach(P => { P.last = ""; P.t = -1e9; panelTick(P, performance.now() + 1e6); }))');
    if (pre) HOST.cur.peek(pre);
    HOST.collab.internals().pumpAt = 0;
    for (const cb of X.raf.splice(0)) cb(performance.now(), X.frame);
    const hp = new THREE.Vector3().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
    const cam = new THREE.PerspectiveCamera(84, size ? size[0] / size[1] : r.domElement.width / r.domElement.height, 0.05, 2000);
    cam.position.copy(hp);
    cam.quaternion.setFromEuler(new THREE.Euler(pitch, yawRoom + R.yaw, 0, 'YXZ'));
    const sc = HOST.cur.peek('GL.scene');
    sc.updateMatrixWorld(true);
    let u;
    if (size) {
      const w = size[0] * 2, h = size[1] * 2, rt = new THREE.WebGLRenderTarget(w, h), px = new Uint8Array(w * h * 4);
      r.setRenderTarget(rt); r.render(sc, cam); r.readRenderTargetPixels(rt, 0, 0, w, h, px); r.setRenderTarget(null); rt.dispose();
      const big = document.createElement('canvas'), out = document.createElement('canvas'), id = new ImageData(w, h);
      for (let y = 0; y < h; y++) id.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);   // (its rows come bottom up)
      big.width = w; big.height = h; big.getContext('2d').putImageData(id, 0, 0);
      out.width = size[0]; out.height = size[1];
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#040912'; ctx.fillRect(0, 0, size[0], size[1]); ctx.drawImage(big, 0, 0, size[0], size[1]);
      u = out.toDataURL('image/png');
    } else { r.render(sc, cam); u = r.domElement.toDataURL('image/png'); }
    r.setAnimationLoop(loop);
    return u;
  }, [yawRoom, pitch, size || null, pre || '']);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
}

// ---- the design room in a headset in a room (after designRoom, with a pretend headset H aligned in the room; S any
// station, to find a spot away from them all): every station's icon built from its story's miniature (lowpoly.js, the
// entry's icon), in its colour and turning (hidden but built when the headset is in a circle already); with the circles
// locked the menu's Design room button is greyed and places nothing; pressed, it puts the props table at the headset's
// feet as a circle facing its way, which every page sees; the headset standing in it, it becomes its station and the
// design room opens there, its icon gone over it; walked out, the headset stays at the design room (its icon still gone,
// built from the table's miniature); Add here lists the design room after the stories. The station is removed at the
// end. shots: pictures of the menu and the table at its station (design-*.png)
async function headsetDesign(A, B, H, S, shots) {
  const step = n => frames(H, n);
  const press = id => H.evaluate(async id => {
    const X = window.__xr; X.step(); X.step();
    const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn();
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(res => setTimeout(res, 20)); }
    return !!(r && r.fn);
  }, id);
  const ids = () => H.evaluate(() => { window.__xr.step(); window.__xr.step(); return HOST.collab.menuIds(); });
  // away from every station, facing the room's origin
  const sp = await awaySpot(H, S);
  await goRoom(H, sp[0], 1.6, sp[1], Math.atan2(sp[0], sp[1]));
  await step(800);
  // every station's icon: its miniature, in its colour, turning
  const icons = () => H.evaluate(() => [...HOST.collab.overlay().rings].map(([id, o]) => {
    const I = o.icon, s = HOST.collab.station(id), m = s && HOST.meta(s.story);
    return { id, story: s && s.story, model: I.model, want: m && m.icon, col: '#' + I.halo.material.color.getHexString(), wcol: m && m.col.toLowerCase(), a: I.spin.rotation.y,
      tris: (I.mesh.geometry.attributes.position.count + (I.see ? I.see.geometry.attributes.position.count : 0)) / 3, on: I.g.visible && I.k > 0.9 };
  }));
  const built = await until(H, () => { window.__xr.step(); return [...HOST.collab.overlay().rings.values()].every(o => o.icon.model); }, null, 20000);
  const i0 = await icons();
  // (a headset that has walked into a circle sees the others' icons, not its own station's)
  const own = await H.evaluate(() => (HOST.collab.live() ? HOST.collab.mine() : ''));
  // (frames until each has turned, up to 5 s: a page drawing in software can draw none in 400 ms)
  let i1 = [];
  for (let k = 0; k < 12; k++) { await step(400); i1 = await icons(); if (i1.every((x, j) => x.id === own || angle(x.a, i0[j].a) > 0.05)) break; }
  const bad = i1.filter((x, k) => !(x.model && x.model === x.want && x.col === x.wcol && x.tris > 300 && (x.id === own ? !x.on : x.on && angle(x.a, i0[k].a) > 0.05)));
  check(`design room: every station's icon is built from its story's miniature (lowpoly.js), in its colour and turning${own ? ' (but its own station\'s: the headset is in its circle)' : ''}`,
    built && i1.length > 5 && !bad.length, JSON.stringify({ built, n: i1.length, bad }));
  // locked: the button greyed, nothing placed
  const n0 = await H.evaluate(() => HOST.collab.stations().length);
  await A.evaluate(() => HOST.collab.lock(true));
  await until(H, () => HOST.collab.locked, null, 3000);
  await H.evaluate(() => HOST.collab.panelOpen(true));
  const lockedIds = await ids(), lockedPress = await press('design');
  await step(300);
  const nL = await H.evaluate(() => HOST.collab.stations().length);
  await A.evaluate(() => HOST.collab.lock(false));
  await until(H, () => !HOST.collab.locked, null, 3000);
  check('design room: with the circles locked the menu\'s Design room button is greyed and places nothing', !lockedIds.includes('design') && !lockedPress && nL === n0,
    JSON.stringify({ lockedIds: lockedIds.slice(0, 12), lockedPress, nL, n0 }));
  // Add here lists it after the stories
  await press('addpage');
  const addIds = (await ids()).filter(x => x.startsWith('add:'));
  await press('add:cancel');
  const [nStories, extra] = await H.evaluate(() => [HOST.list.length, (self.STORY_EXTRA || []).map(m => m.key)]);
  check('design room: the menu\'s Add here lists the design room after the stories (then the studio, All stories and Back to the lobby)',
    addIds.slice(nStories).join() === extra.concat('all', 'lobby', 'cancel').map(k => 'add:' + k).join() && addIds[nStories] === 'add:design', addIds.join());
  // pressed: the props table at its feet, facing its way, for every page
  const at = await H.evaluate(() => { window.__xr.step(); const R = HOST.room.internals(); return { x: R.hr.x, z: R.hr.z, yaw: R.hyaw }; });
  const menuShot = shots && await H.evaluate(() => { const S = HOST.collab.overlay().panel, c = document.createElement('canvas'); c.width = S.w; c.height = S.vis; c.getContext('2d').drawImage(S.cv, 0, 0); return c.toDataURL('image/png'); });
  if (menuShot) fs.writeFileSync(path.join(shots, 'design-menu.png'), Buffer.from(menuShot.split(',')[1], 'base64'));
  const pd = await press('design');
  let id = '';
  for (let k = 0; k < 30 && !id; k++) { await step(100); id = await H.evaluate(() => (HOST.collab.stations().find(s => s.story === 'design') || {}).id || ''); }
  const st = id && await H.evaluate(id => HOST.collab.station(id), id);
  const seen = !!id && await until(A, id => !!HOST.collab.station(id), id, 5000) && await until(B, id => !!HOST.collab.station(id), id, 5000);
  check('design room: the menu\'s Design room button in a room puts the props table at its feet as a circle, facing its way, for every page',
    pd && !!st && Math.hypot(st.x - at.x, st.z - at.z) < 0.02 && angle(st.yaw, at.yaw) < 0.02 && seen, JSON.stringify({ pd, at, st, seen }));
  await H.evaluate(() => HOST.collab.panelOpen(false));
  // standing in it: its station, the design room opens there, its own icon gone
  let inD = false;
  for (let k = 0; k < 40 && !inD; k++) { await step(300); inD = await H.evaluate(() => HOST.curKey === 'design'); }
  inD = inD && await ready(H, 'design', 60000);
  if (inD) {
    await H.evaluate(() => HOST.cur.peek('xrAdopt()'));
    // (the table's miniatures, built a few a frame)
    await until(H, () => { window.__xr.step(); return HOST.cur.peek('GL.sets.table.built() === GL.sets.table.total()'); }, null, 60000);
    await step(600);
  }
  const there = await H.evaluate(id => { HOST.cur.peek('xrUpdate(XS)'); const o = HOST.collab.overlay().rings.get(id);
    return { mine: HOST.collab.mine() === id, key: HOST.curKey, away: HOST.room.away(), world: HOST.cur.peek('GL.world.visible'), mode: HOST.cur.peek('APP.mode'),
      icon: !!o && o.icon.g.visible && o.icon.k > 0.9, card: HOST.collab.overlay().cards.has(id), table: HOST.cur.peek('GL.sets.table.built() + "/" + GL.sets.table.total()'),
      ready: HOST.collab.internals().ready }; }, id);
  check('design room: standing in it the headset takes it as its station and the design room opens there at its table (explore mode; its icon and card gone)',
    inD && there.mine && there.key === 'design' && !there.away && there.world && there.mode === 'explore' && !there.icon && !there.card, JSON.stringify({ inD, there }));
  if (shots && inD) {
    // (a left controller held low, out of the way)
    const lowClock = () => H.evaluate(() => {
      const X = window.__xr, V = THREE.Vector3, R = HOST.room.internals(), Y = R.hyaw + R.yaw;
      const hp = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
      const lp = hp.add(new V(-Math.sin(Y), 0, -Math.cos(Y)).multiplyScalar(0.3)).add(new V(-Math.cos(Y), -9, Math.sin(Y)).multiplyScalar(0.06));
      X.aim(1, new THREE.Matrix4().compose(lp, new THREE.Quaternion().setFromAxisAngle(new V(0, 1, 0), Y), new V(1, 1, 1)));
    });
    await lowClock(); await step(300);
    await headView(H, path.join(shots, 'design-station.png'), st.yaw, -0.42, [1280, 800]);
    // from outside its circle (behind it and to one side), looking at its ring, card and icon among the others
    const back = [st.x + 2.6 * Math.sin(st.yaw) + 0.8 * Math.cos(st.yaw), st.z + 2.6 * Math.cos(st.yaw) - 0.8 * Math.sin(st.yaw)];
    const look = Math.atan2(-(st.x - back[0]), -(st.z - back[1]));
    await goRoom(H, back[0], 1.6, back[1], look);
    await step(900); await lowClock(); await step(300);
    await headView(H, path.join(shots, 'design-circle.png'), look, 0.02, [1280, 800]);
    await H.evaluate(() => { const c = HOST.cur.peek('XR.ctrls')[1]; c.g.visible = false; c.src = null; window.__xr.session.inputSources.length = 0; });
  }
  // walked out: still at the design room (a story is left only by walking into another circle), its icon still gone,
  // built from the table's miniature all the same
  const sp2 = await awaySpot(H, st);
  await goRoom(H, sp2[0], 1.6, sp2[1], 0);
  await step(1500);
  const out = await H.evaluate(id => { window.__xr.step(); HOST.cur.peek('xrUpdate(XS)'); const o = HOST.collab.overlay().rings.get(id);
    return { mine: HOST.collab.mine() === id, key: HOST.curKey, away: HOST.room.away(), world: HOST.cur.peek('GL.world.visible'), model: o && o.icon.model, k: o && +o.icon.k.toFixed(2) }; }, id);
  check('design room: walked out of its circle the headset stays at the design room (its station, shown; its icon still gone, built from the props table\'s miniature)',
    out.mine && out.key === 'design' && !out.away && out.world && out.model === 'design.table' && out.k < 0.05, JSON.stringify(out));
  await A.evaluate(id => HOST.collab.remove(id), id);
  await until(H, id => !HOST.collab.station(id), id, 5000);
}

// ---- --design: only the design room in a room (a quicker run while working on it): three pages and Arrange all,
// designRoom, then a pretend headset aligned as in the main run, and headsetDesign; --shots also saves its pictures
async function designOnly() {
  const A = await open('#stories');
  await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(A, () => HOST.collab.status === 'open', null, 10000);
  const code = await A.evaluate(() => HOST.collab.code);
  await A.evaluate(() => HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }));
  const all = p => until(p, () => HOST.collab.status === 'open' && HOST.collab.stations().length === HOST.list.length, null, 20000);
  await all(A);
  const B = await open('#s=' + code), C = await open('#s=' + code);
  await all(B); await all(C);
  await designRoom(A, B, C);
  const H = await open('#s=' + code);
  await all(H);
  await ready(H, 'airports');
  const aId = await A.evaluate(() => HOST.collab.id);
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);
  await H.evaluate(() => HOST.room.sharedAlign(true));
  await H.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [-6, 1.6, 6, 0] });
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 400);
  await H.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'U1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
  await frames(H, 300);
  check('design room: the pretend headset aligns in the room', await H.evaluate(() => HOST.room.aligned && HOST.room.src === 'adopted'));
  if (shots) fs.mkdirSync(shots, { recursive: true });
  await headsetDesign(A, B, H, (await H.evaluate(() => HOST.collab.stations()))[0], shots);
  await H.evaluate(() => window.__xr.end());
}

// ---- peer to peer: pages whose relay calls go nowhere (as on GitHub Pages), introduced by the relay's own
// introduction server (&peer=, its /peerjs), so nothing goes to the internet
async function p2p() {
  const server = `127.0.0.1:${port}/peerjs`, all = [];
  const popen = async (hash, o = {}) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 640, height: 400 } }, o.ctx));
    await ctx.route('**/api/**', r => r.abort());   // (no relay here)
    if (o.skew) await ctx.addInitScript(ms => { const n = Date.now; Date.now = () => n() + ms; }, o.skew);   // (this device's clock is off)
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.stack || e.message));
    page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|ERR_FAILED|WebSocket connection/.test(m.text())) errors.push(m.text()); });
    await page.goto(base() + 'index.html' + hash, { timeout: 90000 });
    await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
    all.push(ctx);
    return page;
  };
  const way = p => p.evaluate(() => ({ code: HOST.collab.code, via: HOST.collab.via, role: HOST.collab.role, status: HOST.collab.status, members: HOST.collab.members.map(m => m.name + (m.host ? ' (host)' : '')),
    stations: HOST.collab.stations().length, note: HOST.collab.internals().note, log: window.__collabLog.filter(e => /peer|take|host|close|local|link|join/.test(e.ev)).slice(-6).map(e => e.ev + (e.reason ? ' ' + e.reason : '') + (e.type ? ' ' + e.type : '')).join(', ') }));
  const inRoom = (p, role, n, ms) => until(p, ([role, n]) => HOST.collab.status === 'open' && HOST.collab.via === 'peer' && (!role || HOST.collab.role === role) && (!n || HOST.collab.members.length === n), [role, n], ms || 30000);
  const idOf = p => p.evaluate(() => HOST.collab.id);
  try {
    // A starts a room and hosts it; B (whose clock is 3 s off) and C join by its link
    const PA = await popen('#stories&peer=' + server);
    await PA.evaluate(() => HOST.collab.create());
    const aHost = await inRoom(PA, 'host');
    const link = await PA.evaluate(() => location.hash), pcode = await PA.evaluate(() => HOST.collab.code);
    check('peer to peer: with no relay a page starts a room and hosts it, and its link carries the introduction server', aHost && link === `#s=${pcode}&peer=${server}`, JSON.stringify([await way(PA), link]));
    const PB = await popen(link, { skew: 3000 });
    const bIn = await inRoom(PB, 'guest', 2);
    const PC = await popen(link);
    const cIn = await inRoom(PC, 'guest', 3);
    const aId = await idOf(PA), hostIs = (p, id) => p.evaluate(id => { const h = HOST.collab.members.filter(m => m.host); return h.length === 1 && h[0].id === id; }, id);
    check('peer to peer: two more pages join by the link as guests, and every page lists the three with the host marked', bIn && cIn && await inRoom(PA, 'host', 3, 5000) &&
      await hostIs(PA, aId) && await hostIs(PB, aId) && await hostIs(PC, aId), JSON.stringify([await way(PA), await way(PB), await way(PC)]));
    // the Shared dialog: how the room runs and who hosts it, the people (the host marked) and Copy link
    const dlgOf = p => p.evaluate(async () => {
      HOST.collab.dialog(true); await new Promise(r => setTimeout(r, 300));
      const out = { status: document.querySelector('#shared .sh-status').textContent, copy: !!document.querySelector('[data-sh="copy"]'),
        people: [...document.querySelectorAll('#shared .sh-people li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()) };
      HOST.collab.dialog(false);
      return out;
    });
    const [dA, dB] = [await dlgOf(PA), await dlgOf(PB)];
    check('peer to peer: the Shared dialog says how the room runs (hosted here, hosted by), lists the three with the host marked and offers Copy link',
      /peer to peer · hosted here/.test(dA.status) && /peer to peer · hosted by /.test(dB.status) && dA.copy && dB.copy && dB.people.length === 3 && dB.people.filter(l => /hosts the room/.test(l)).length === 1,
      JSON.stringify({ dA, dB }));
    // the stations, from the host and from a guest
    await PA.evaluate(() => HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }));
    const full = p => until(p, () => HOST.collab.stations().length === HOST.list.length && !HOST.collab.internals().pending.size, null, 10000);
    const arranged = await full(PA) && await full(PB) && await full(PC);
    const mid = await stationOf(PC, 'nmd');
    await PC.evaluate(id => HOST.collab.move(id, { x: 0.5, z: -6, yaw: 0.3 }), mid);
    const moved = p => until(p, id => { const s = HOST.collab.station(id); return !!s && s.z === -6; }, mid, 5000);
    check('peer to peer: Arrange all on the host and a station moved on a guest reach every page', arranged && await moved(PA) && await moved(PB), JSON.stringify([await way(PB), await way(PC)]));
    const seen = p => until(p, () => HOST.collab.people().size === 2, null, 8000);
    check('peer to peer: presence goes round (every page hears the other two)', await seen(PA) && await seen(PB) && await seen(PC),
      JSON.stringify(await Promise.all([PA, PB, PC].map(p => p.evaluate(() => HOST.collab.people().size)))));
    // a station followed on every page: play, pause and a jump reach the others within 5 s
    const sid = await stationOf(PA, P2P_KEY);
    for (const p of [PA, PB, PC]) await p.evaluate(i => HOST.collab.follow(i), sid);
    const rd = (await Promise.all([PA, PB, PC].map(p => ready(p, P2P_KEY, 60000)))).every(Boolean);
    check('peer to peer: Follow shows the station\'s story on every page', rd, (await Promise.all([PA, PB, PC].map(p => p.evaluate(() => HOST.curKey)))).join(', '));
    await until(PB, () => !HOST.cur.peek('APP.playing'), null, 3000);
    await peek(PA, 'APP.playing || APP.togglePlay()');
    const playing = p => until(p, () => HOST.cur.peek('APP.mode === "story" && APP.playing'), null, 5000);
    check('peer to peer: play on the host reaches the guests', await playing(PB) && await playing(PC), JSON.stringify([await clockOf(PB), await clockOf(PC)]));
    await sleep(1500);
    await peek(PB, 'APP.togglePlay()');
    const still = p => until(p, () => !HOST.cur.peek('APP.playing'), null, 5000);
    const ps = await still(PA) && await still(PC);
    const [ca, cb, cc] = [await clockOf(PA), await clockOf(PB), await clockOf(PC)];
    check('peer to peer: a pause on a guest reaches the host and the other guest, at the same moment', ps && Math.abs(ca[2] - cb[2]) < 0.3 && Math.abs(cc[2] - cb[2]) < 0.3, JSON.stringify([ca, cb, cc]));
    await peek(PA, 'APP.seek(20)');
    const at20 = p => until(p, () => Math.abs(HOST.cur.peek('APP.t') - 20) < 0.3, null, 5000);
    check('peer to peer: a jump reaches them', await at20(PB) && await at20(PC), JSON.stringify([await clockOf(PB), await clockOf(PC)]));
    // an explore state, both ways
    await peek(PA, 'APP.enterExplore()');
    const exploring = p => until(p, () => HOST.cur.peek('APP.mode') === 'explore', null, 5000);
    await exploring(PB); await exploring(PC);
    await sleep(500);
    const same = (p, s) => until(p, s => JSON.stringify(HOST.cur.collab.state()) === s, s, 6000);
    const s0 = await stateOf(PA);
    await peek(PA, P2P_T.change);
    const s1 = await stateOf(PA);
    const sOut = s1 !== s0 && await same(PB, s1) && await same(PC, s1);
    await peek(PC, P2P_T.back);
    const s2 = await stateOf(PC);
    check('peer to peer: an explore state reaches the others, and comes back the other way', sOut && s2 !== s1 && await same(PA, s2) && await same(PB, s2), `${s1} / ${s2} / A ${await stateOf(PA)}`);
    // the station playing again; then the host leaves
    await peek(PA, 'APP.enterStory(0)');
    await until(PC, () => HOST.cur.peek('APP.mode') === 'story', null, 5000);
    await peek(PA, 'APP.playing || APP.togglePlay()');
    await playing(PB); await playing(PC);
    await sleep(1500);
    // the station's clock as a page reckons it from the room (and its own time), and the story's
    const stClock = (p, id) => p.evaluate(id => { const v = HOST.collab.val('st.' + id + '.play'); return { at: Date.now(), t: v.t + (v.playing ? (HOST.collab.now() - v.at) / 1000 : 0), app: HOST.cur.peek('APP.t'), keys: HOST.collab.internals().keys.size }; }, id);
    const [b0, c0] = [await stClock(PB, sid), await stClock(PC, sid)];
    const t0 = Date.now();
    await PA.evaluate(() => HOST.collab.leave());
    const hosted = await until(PB, () => HOST.collab.role === 'host' && HOST.collab.status === 'open', null, 20000);
    const tTake = (Date.now() - t0) / 1000;
    const followed = await inRoom(PC, 'guest', 2, 20000) && await hostIs(PC, await idOf(PB));
    check(`peer to peer: the host leaves, and the page longest in the room takes the room over (in ${tTake.toFixed(1)} s) and hosts it; the other follows it`, hosted && followed,
      JSON.stringify([await way(PB), await way(PC)]));
    await sleep(2500);   // (a few round trips: the clock measured against the new host)
    const [b1, c1] = [await stClock(PB, sid), await stClock(PC, sid)];
    const jump = (x0, x1) => x1.t - (x0.t + (x1.at - x0.at) / 1000);
    const [jb, jc] = [jump(b0, b1), jump(c0, c1)];
    check(`peer to peer: the stations and keys are kept, and the station's clock goes on without a jump (${jb.toFixed(2)} s, ${jc.toFixed(2)} s; the new host's own clock is 3 s off)`,
      Math.abs(jb) < 0.5 && Math.abs(jc) < 0.5 && Math.abs(c1.app - c1.t) < 0.5 && b1.keys === b0.keys && c1.keys === c0.keys &&
      (await PB.evaluate(() => HOST.collab.stations().length)) === (await PC.evaluate(() => HOST.collab.stations().length)), JSON.stringify({ b0, b1, c0, c1 }));
    await peek(PC, 'APP.togglePlay()');
    const cPaused = await still(PB);
    await peek(PB, 'APP.enterExplore()');
    await exploring(PC);
    await peek(PB, P2P_T.change);
    const s3 = await stateOf(PB);
    check('peer to peer: the room goes on with the new host (a pause from the guest, an explore state from the host)', cPaused && await same(PC, s3), `${s3} / C ${await stateOf(PC)}`);
    // the old host comes back: as a guest
    await PA.evaluate(c => HOST.collab.join(c), pcode);
    check('peer to peer: the old host comes back as a guest', await inRoom(PA, 'guest', 3) && await hostIs(PA, await idOf(PB)), JSON.stringify(await way(PA)));
    // the host falls silent with its id still held (asleep): the others try now and then, and the one longest in the room
    // takes the room over once the introduction server lets go of the id (here a second later; PeerJS's: up to a minute)
    await PB.evaluate(() => HOST.collab.internals().ws.vanish());
    const t1 = Date.now();
    await sleep(1000);
    await PB.evaluate(() => HOST.collab.internals().ws.peer.disconnect());
    const silentNew = await until(PC, () => HOST.collab.role === 'host' && HOST.collab.status === 'open', null, 40000);
    const tSilent = (Date.now() - t1) / 1000;
    const aFollows = await until(PA, cid => HOST.collab.status === 'open' && HOST.collab.role === 'guest' && HOST.collab.members.some(m => m.host && m.id === cid), await idOf(PC), 30000);
    check(`peer to peer: a host that falls silent is replaced (in ${tSilent.toFixed(1)} s) by the page longest in the room, once its id is free; the other follows`,
      silentNew && aFollows && tSilent > 5, JSON.stringify([await way(PC), await way(PA)]));
    await PB.context().close();
    // an introduction server that cannot be reached: the room on this device only, as before
    const PU = await popen('#s=ZZQ&peer=127.0.0.1:9/peerjs');
    check('peer to peer: an introduction server that cannot be reached leaves the room on this device only', await until(PU, () => HOST.collab.code === 'ZZQ' && HOST.collab.local && HOST.collab.status === 'open', null, 20000),
      JSON.stringify(await way(PU)));
    await PU.context().close();
    // a relay that cannot be reached as a room is joined: peer to peer
    const PR = await popen('#s=QQR&relay=' + encodeURIComponent('ws://127.0.0.1:9') + '&peer=' + server);
    check('peer to peer: a relay that cannot be reached as a room is joined makes the room peer to peer', await until(PR, () => HOST.collab.code === 'QQR' && HOST.collab.via === 'peer' && HOST.collab.status === 'open', null, 30000),
      JSON.stringify(await way(PR)));
    await PR.context().close();
    // a headset that hosts hands the room to the first screen that joins (a screen stays awake)
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/40.0 SamsungBrowser/4.0 Chrome/130.0.0.0 VR Safari/537.36';
    const PH = await popen('#stories&peer=' + server, { ctx: { userAgent: ua } });
    await PH.evaluate(() => HOST.collab.create());
    const hHost = await inRoom(PH, 'host');
    await PH.evaluate(() => HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }));
    await full(PH);
    const PS = await popen(await PH.evaluate(() => location.hash));
    const handed = hHost && await until(PS, () => HOST.collab.role === 'host' && HOST.collab.status === 'open' && HOST.collab.members.length === 2 && HOST.collab.stations().length === HOST.list.length, null, 30000) &&
      await until(PH, () => HOST.collab.role === 'guest' && HOST.collab.status === 'open' && HOST.collab.members.length === 2, null, 30000);
    check('peer to peer: a headset that hosts hands the room (its stations) to the first screen that joins', handed, JSON.stringify([await way(PH), await way(PS)]));
  } finally {
    for (const c of all) await c.close().catch(() => {});
  }
}

// ---- rooms on this network (--near runs only this part). Its own relay, told it is behind a proxy (--proxy), and in
// front of it one small proxy per pretend network that puts that network's address in X-Forwarded-For, as Coolify's
// does: pages of one network open the app through its proxy (the relay hashes the address it is given). Peer to peer
// (no relay: pages whose /api goes nowhere) the pages pretend a network (#net=<word>) and meet at the relay's own
// introduction server. Nothing goes to the internet.
const HOME = '198.51.100.7', AWAY = '203.0.113.50', DAY = 86400000;
async function nearby() {
  const N = { proc: null, port: 0, out: '' }, servers = [], all = [];
  N.proc = spawn(process.execPath, ['relay/server.mjs', '--port', '0', '--host', '127.0.0.1', '--static', '.', '--proxy', '--expire', '3'], { cwd: root });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('the relay for rooms on this network did not start: ' + N.out)), 10000);
    N.proc.stdout.on('data', d => { N.out += d; const m = /listening on http:\/\/[^:]+:(\d+)/.exec(N.out); if (m && !N.port) { N.port = +m[1]; clearTimeout(t); res(); } });
    N.proc.stderr.on('data', d => { N.out += d; });
  });
  // a reverse proxy in front of the relay for one pretend network: every request and socket carries its address
  const proxy = addr => new Promise(res => {
    const srv = http.createServer((q, s) => {
      const up = http.request({ host: '127.0.0.1', port: N.port, method: q.method, path: q.url, headers: Object.assign({}, q.headers, { 'x-forwarded-for': addr }) }, r => { s.writeHead(r.statusCode, r.headers); r.pipe(s); });
      up.on('error', () => { try { s.writeHead(502); s.end(); } catch (e) { /* gone */ } });
      q.pipe(up);
    });
    srv.on('upgrade', (q, sock, head) => {
      const up = tcpConnect(N.port, '127.0.0.1', () => {
        const lines = [`${q.method} ${q.url} HTTP/1.1`];
        for (let i = 0; i < q.rawHeaders.length; i += 2) if (!/^x-forwarded-for$/i.test(q.rawHeaders[i])) lines.push(q.rawHeaders[i] + ': ' + q.rawHeaders[i + 1]);
        up.write(lines.concat('X-Forwarded-For: ' + addr, '', '').join('\r\n'));
        if (head && head.length) up.write(head);
        sock.pipe(up); up.pipe(sock);
      });
      up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy());
    });
    servers.push(srv);
    srv.listen(0, '127.0.0.1', () => res(srv.address().port));
  });
  const nopen = async (url, o = {}) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 760, height: 640 } }, o.state ? { storageState: o.state } : {}));
    if (o.noApi) await ctx.route('**/api/**', r => r.abort());   // (no relay here)
    if (o.skew) await ctx.addInitScript(ms => { const n = Date.now; Date.now = () => n() + ms; }, o.skew);   // (days later)
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.stack || e.message));
    page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|ERR_FAILED|WebSocket connection/.test(m.text())) errors.push(m.text()); });
    await page.goto(url, { timeout: 90000 });
    await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
    all.push(ctx);
    return page;
  };
  // the app opened again with no room in its link (a restart)
  const reopen = async (page, url) => {
    await page.goto('about:blank');
    await page.goto(url, { timeout: 90000 });
    await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
  };
  const shot = async (page, file, o) => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot(Object.assign({ path: path.join(shots, file) }, o)); } };
  // (generous waits: pages drawing in software on a busy machine answer late)
  const listed = (p, c, ms) => until(p, c => [...document.querySelectorAll('#shared .sh-near li b')].some(b => b.textContent === c), c, ms || 40000);
  const looked = (p, ms) => until(p, () => Array.isArray(HOST.collab.nearby()) && !HOST.collab.internals().nearBusy && HOST.collab.internals().netState !== 'finding', null, ms || 25000);
  const rowOf = (p, c) => p.evaluate(c => { const li = [...document.querySelectorAll('#shared .sh-near li')].find(l => l.querySelector('b') && l.querySelector('b').textContent === c); return li ? li.textContent.replace(/\s+/g, ' ').trim() : ''; }, c);
  const inRoom = (p, c, role) => until(p, ([c, role]) => HOST.collab.code === c && HOST.collab.status === 'open' && (!role || HOST.collab.role === role), [c, role || ''], 60000);
  const way = p => p.evaluate(() => ({ code: HOST.collab.code, via: HOST.collab.via, role: HOST.collab.role, status: HOST.collab.status, auto: HOST.collab.internals().auto, net: !!HOST.collab.net,
    stations: HOST.collab.stations().length, offer: (HOST.collab.offer() || {}).code, log: window.__collabLog.filter(e => /rejoin|network|join|leave|host|peer|shown/.test(e.ev)).slice(-6).map(e => e.ev + (e.why ? ' ' + e.why : '') + (e.code ? ' ' + e.code : '')).join(', ') }));
  try {
    // ---- with a relay
    const HP = await proxy(HOME), AP = await proxy(AWAY), at = (pp, hash) => `http://127.0.0.1:${pp}/index.html${hash}`;
    const nearOf = async pp => (await (await fetch(`http://127.0.0.1:${pp}/api/near`)).json());
    const A = await nopen(at(HP, '#stories'));
    // (the relay found first, as the other parts do: on a busy machine its 5 s probe can lapse, and the room is then made
    // peer to peer or on the page alone, where no relay lists it)
    await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
    await until(A, () => HOST.collab.status === 'open' && HOST.collab.via === 'relay' && !!HOST.collab.net, null, 15000);
    const R1 = await A.evaluate(() => HOST.collab.code), NS = await A.evaluate(() => HOST.list.length);
    await A.evaluate(() => HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }));
    await until(A, () => HOST.collab.stations().length === HOST.list.length && !HOST.collab.internals().pending.size, null, 8000);
    const aNet = await A.evaluate(() => HOST.collab.net), aHash = await A.evaluate(a => HOST.collab.netHash(a), HOME), aName = await A.evaluate(() => HOST.collab.name);
    check('rooms on this network: the page knows its network from the relay, the same id as its own hash of the address (as the STUN server would give it)', !!aNet && aNet === aHash, `${aNet} ${aHash}`);
    const B = await nopen(at(HP, '#stories'));
    await B.evaluate(() => HOST.collab.dialog(true));
    const bSees = await listed(B, R1), bRow = await rowOf(B, R1);
    await shot(B, 'near-dialog.png');
    await B.evaluate(c => { const b = document.querySelector(`#shared .sh-near [data-sh="join:${c}"]`); if (b) b.click(); }, R1);
    const bIn = await inRoom(B, R1);
    const Cp = await nopen(at(AP, '#stories'));
    await Cp.evaluate(() => HOST.collab.dialog(true));
    const cLooked = await looked(Cp), cNear = await Cp.evaluate(() => (HOST.collab.nearby() || []).map(r => r.code));
    const cOpen = await until(Cp, c => [...document.querySelectorAll('#shared .sh-rooms li b')].some(b => b.textContent === c), R1, 5000);
    check('rooms on this network (relay): a page on the same network sees the room (with its first member\'s name and people), one press on Join joins it; a page on another network does not see it there (only among the relay\'s open rooms)',
      bSees && bRow.includes('with ' + aName) && /1 person/.test(bRow) && bIn && cLooked && !cNear.includes(R1) && cOpen, JSON.stringify({ bSees, bRow, bIn: await way(B), cLooked, cNear, cOpen }));
    // a page on this network that was never in the room: listed, never joined by itself
    const E = await nopen(at(HP, '#stories'));
    await E.evaluate(() => HOST.collab.dialog(true));
    const eSees = await listed(E, R1);
    await sleep(3000);
    check('rooms on this network (relay): a room this device was never in is listed but never joined by itself', eSees && !(await E.evaluate(() => HOST.collab.joined)), JSON.stringify(await way(E)));
    await E.context().close();
    // Show on this network: off (for everyone in the room, from the dialog), and on again
    await A.evaluate(() => { HOST.collab.dialog(true); });
    await sleep(300);
    await A.evaluate(() => document.querySelector('#shared [data-sh="near"]').click());
    const bOff = await until(B, () => HOST.collab.nearOn === false, null, 5000);
    const offList = (await nearOf(HP)).rooms.map(r => r.code);
    await A.evaluate(() => HOST.collab.setNear(true));
    await until(A, () => HOST.collab.nearOn && !HOST.collab.internals().pending.size, null, 5000);
    const onList = (await nearOf(HP)).rooms.map(r => r.code);
    check('rooms on this network (relay): Show on this network off (a room key, for everyone in it) takes the room off the list, on puts it back',
      bOff && !offList.includes(R1) && onList.includes(R1), JSON.stringify({ bOff, offList, onList }));
    // the headset's menu lists the rooms on this network too, and one press there joins
    const Hm = await nopen(at(HP, '#airports'));
    await ready(Hm, 'airports');
    await Hm.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [0, 1.6, 0, 0] });
    await Hm.evaluate(() => { window.__xr.begin(); HOST.collab.panelOpen(true); });
    await frames(Hm, 400);
    await until(Hm, c => (HOST.collab.nearby() || []).some(r => r.code === c), R1, 15000);
    await frames(Hm, 400);
    const hReg = await Hm.evaluate(c => !!HOST.collab.menuFind('near:' + c), R1);
    if (shots) {
      const u = await Hm.evaluate(() => HOST.collab.overlay().panel.ctx.canvas.toDataURL('image/png'));
      fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, 'near-menu.png'), Buffer.from(u.split(',')[1], 'base64'));
    }
    await Hm.evaluate(c => { const r = HOST.collab.menuFind('near:' + c); if (r && r.fn) r.fn(); }, R1);
    check('rooms on this network (relay): the headset\'s menu lists the room under On this network, and one press there joins it', hReg && await inRoom(Hm, R1), JSON.stringify(await way(Hm)));
    await Hm.evaluate(() => window.__xr.end());
    await Hm.context().close();
    // rejoin by itself: the app opened again with no room in its link (a restart)
    await B.evaluate(() => HOST.collab.dialog(false));
    await reopen(B, at(HP, '#stories'));
    const bBack = await until(B, c => HOST.collab.code === c && HOST.collab.status === 'open' && HOST.collab.internals().auto === c, R1, 40000);   // (a page drawing in software may take more than 20 s)
    // (the notice goes by itself after 20 s: a page busy drawing in software may answer later than that)
    const tText = await B.evaluate(() => { const t = document.getElementById('shToast'); return t && window.__collabLog.some(e => e.ev === 'notice' && e.title === 'Back in room') ? t.textContent : ''; });
    if (shots) { await ready(B, 'airports', 40000); await B.evaluate(() => { const t = document.getElementById('shToast'); t.hidden = false; t.style.display = 'flex'; }); }   // (the picture: the Stories screen behind the notice)
    await shot(B, 'near-toast.png');
    check('rejoin (relay): a page that was in the room joins it again by itself when the app opens again, with a notice (and Leave in it)', bBack && /Back in room/.test(tText) && /Leave/.test(tText), JSON.stringify({ way: await way(B), tText }));
    // and the notice goes: its close button takes it off the page (shown again here, should its 20 s have passed already;
    // its own display used to outrank the hidden attribute, so it stayed up for good)
    const tGone = await B.evaluate(() => { const t = document.getElementById('shToast'); if (!t) return null; t.hidden = false; t.style.display = 'flex';
      const shown = getComputedStyle(t).display, b = t.querySelector('[data-toast="close"]'); if (b) b.click(); return [shown, getComputedStyle(t).display, !!b]; });
    check('rejoin (relay): the notice closes with its close button (gone from the page, not only marked hidden)', !!tGone && tGone[0] === 'flex' && tGone[1] === 'none' && tGone[2], JSON.stringify(tGone));
    // a day later, after everyone had gone (the relay forgot the room meanwhile): joined again by itself, and the room is
    // back from this device's copy (its stations)
    const bState = await B.context().storageState();
    await A.context().close(); await B.context().close(); await Cp.context().close();
    let gone = false;
    for (let k = 0; k < 40 && !gone; k++) { await sleep(250); gone = (await fetch(`http://127.0.0.1:${N.port}/api/rooms/${R1}`)).status === 404; }
    const B2 = await nopen(at(HP, '#stories'), { state: bState, skew: DAY });
    const b2Back = await until(B2, ([c, n]) => HOST.collab.code === c && HOST.collab.status === 'open' && HOST.collab.stations().length === n, [R1, NS], 25000);
    check('rejoin (relay): a day later, the relay having forgotten the room overnight, the page joins it again by itself and the room comes back from its copy (its stations)', gone && b2Back, JSON.stringify({ gone, way: await way(B2) }));
    // Leave on purpose: not joined again by itself (nor offered)
    await B2.evaluate(() => HOST.collab.dialog(true));
    await sleep(300);
    await B2.evaluate(() => document.querySelector('#shared [data-sh="leave"]').click());
    await until(B2, () => !HOST.collab.joined, null, 5000);
    await reopen(B2, at(HP, '#stories'));
    await sleep(5000);
    const b2Out = await way(B2);
    check('rejoin (relay): a room left on purpose (Leave) is not joined again by itself when the app opens again, nor offered', !b2Out.code && !b2Out.offer && b2Out.net, JSON.stringify(b2Out));
    // more than a week later: nothing by itself
    const B8 = await nopen(at(HP, '#stories'), { state: bState, skew: 8 * DAY });
    await sleep(5000);
    const b8 = await way(B8);
    check('rejoin (relay): more than a week after its last use, a room is not joined again by itself', !b8.code && !b8.offer, JSON.stringify(b8));
    // the relay forgot the room and gave its code to another room (which has its own id, rid): never joined by itself
    for (let k = 0; k < 40 && (await fetch(`http://127.0.0.1:${N.port}/api/rooms/${R1}`)).status !== 404; k++) await sleep(250);
    const made = (await fetch(`http://127.0.0.1:${N.port}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app: 'networks', code: R1 }) })).status;
    const X = new WebSocket(`ws://127.0.0.1:${N.port}/api/ws?room=${R1}&id=someoneelse1`);
    await new Promise(r => { X.onmessage = r; X.onerror = r; });
    X.send(JSON.stringify({ t: 'set', batch: [['rid', 'anotherroom'], ['st.zz', { story: 'flock', x: 0, z: 0, yaw: 0 }]], cid: 1 }));
    await sleep(300);
    const Bx = await nopen(at(HP, '#stories'), { state: bState, skew: DAY });
    await sleep(6000);
    const bx = Object.assign(await way(Bx), { note: await Bx.evaluate(() => HOST.collab.internals().note) });
    const xKept = await Bx.evaluate(c => { try { const o = JSON.parse(localStorage.getItem('collabRoom.' + c)); return !!o && !!o.gone && !o.keys['st.zz']; } catch (e) { return false; } }, R1);
    check('rejoin (relay): a code the relay gave to another room meanwhile (another id) is never joined by itself, nor offered; this device keeps its own copy, not the other room\'s',
      made === 201 && !bx.code && !bx.offer && /another room/.test(bx.note || '') && xKept, JSON.stringify({ made, bx, xKept }));
    // a copy kept without the room's own id (the page went before its rid came back): another room under the code could
    // not be told from it, so it is never joined by itself (here the code is another room's), only offered
    const noRid = JSON.parse(JSON.stringify(bState));
    for (const o of noRid.origins || []) for (const e of o.localStorage || []) if (e.name === 'collabRoom.' + R1) { const v = JSON.parse(e.value); delete v.keys.rid; delete v.gone; delete v.left; e.value = JSON.stringify(v); }
    const Bn = await nopen(at(HP, '#stories'), { state: noRid, skew: DAY });
    await sleep(6000);
    const bn = await way(Bn);
    await Bn.evaluate(() => HOST.collab.dialog(true));
    const bnRow = (await until(Bn, c => !!document.querySelector(`#shared .sh-near [data-sh="again:${c}"]`), R1, 15000)) ? await Bn.evaluate(() => document.querySelector('#shared .sh-near li.again').textContent) : '';
    check('rejoin (relay): a room kept without its own id (rid) is never joined by itself (its code is another room\'s here), only offered: Join room XYZ again, saying why',
      !bn.code && !/rejoin/.test(bn.log) && bn.offer === R1 && /did not keep its id/.test(bnRow), JSON.stringify({ bn, bnRow }));
    X.close();
    for (const c of all.splice(0)) await c.close().catch(() => {});
    // ---- peer to peer (no relay): pretend networks, the relay's introduction server
    const server = `127.0.0.1:${N.port}/peerjs`, pat = net => `http://127.0.0.1:${N.port}/index.html#stories&peer=${server}&net=${net}`, nop = { noApi: true };
    const P1 = await nopen(pat('home'), nop);
    await P1.evaluate(() => HOST.collab.create());
    await until(P1, () => HOST.collab.status === 'open' && HOST.collab.role === 'host' && !!HOST.collab.net, null, 30000);
    const Q1 = await P1.evaluate(() => HOST.collab.code), p1Name = await P1.evaluate(() => HOST.collab.name);
    await P1.evaluate(() => HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }));
    await until(P1, () => HOST.collab.stations().length === HOST.list.length && !HOST.collab.internals().pending.size, null, 8000);
    const shown = await until(P1, () => window.__collabLog.some(e => e.ev === 'shown on this network'), null, 15000);
    const P2 = await nopen(pat('home'), nop);
    await P2.evaluate(() => HOST.collab.dialog(true));
    const p2Sees = await listed(P2, Q1, 45000), p2Row = await rowOf(P2, Q1);
    await P2.evaluate(c => { const b = document.querySelector(`#shared .sh-near [data-sh="join:${c}"]`); if (b) b.click(); }, Q1);
    const p2In = await inRoom(P2, Q1, 'guest');
    const P3 = await nopen(pat('away'), nop);
    await P3.evaluate(() => HOST.collab.dialog(true));
    const p3Looked = await looked(P3), p3Near = await P3.evaluate(() => (HOST.collab.nearby() || []).map(r => r.code));
    check('rooms on this network (peer to peer): the host holds a slot on its network; a page on the same network sees the room (hosted by), one press joins it; a page on another network does not see it',
      shown && p2Sees && p2Row.includes('hosted by ' + p1Name) && p2In && p3Looked && !p3Near.includes(Q1), JSON.stringify({ shown, p2Sees, p2Row, p1: await way(P1), p2: await way(P2), p3Looked, p3Near }));
    // Show on this network off: the host lets go of its slot; on again: found again. A page never in the room: never joined
    await P1.evaluate(() => HOST.collab.setNear(false));
    await until(P2, () => HOST.collab.nearOn === false, null, 5000);
    await sleep(1000);
    const P4 = await nopen(pat('home'), nop);
    await P4.evaluate(() => HOST.collab.dialog(true));
    await looked(P4);
    const offSeen = await P4.evaluate(c => (HOST.collab.nearby() || []).some(r => r.code === c), Q1);
    await P1.evaluate(() => HOST.collab.setNear(true));
    await until(P1, () => window.__collabLog.filter(e => e.ev === 'shown on this network').length >= 2, null, 10000);
    await P4.evaluate(() => HOST.collab.findNear());
    const onSeen = await until(P4, c => (HOST.collab.nearby() || []).some(r => r.code === c), Q1, 25000);
    check('rooms on this network (peer to peer): Show on this network off takes the room off the list (the host lets go of its slot), on puts it back; a page never in it is never joined by itself',
      !offSeen && onSeen && !(await P4.evaluate(() => HOST.collab.joined)), JSON.stringify({ offSeen, onSeen, p4: await way(P4) }));
    // rejoin by itself after the app opens again: linked to whoever holds the room
    await reopen(P2, pat('home'));
    const p2Back = await until(P2, c => HOST.collab.code === c && HOST.collab.status === 'open' && HOST.collab.role === 'guest' && HOST.collab.internals().auto === c, Q1, 60000);
    check('rejoin (peer to peer): a page that was in the room joins it again by itself when the app opens again (linked to its host)', p2Back, JSON.stringify(await way(P2)));
    // a day later, nobody holding the room: the first page back hosts it from its copy, the next one links to it
    const s1 = await P1.context().storageState(), s2 = await P2.context().storageState();
    for (const c of all.splice(0)) await c.close().catch(() => {});
    await sleep(1500);
    const P2b = await nopen(pat('home'), Object.assign({ state: s2, skew: DAY }, nop));
    const p2Host = await until(P2b, ([c, n]) => HOST.collab.code === c && HOST.collab.status === 'open' && HOST.collab.role === 'host' && HOST.collab.stations().length === n, [Q1, NS], 40000);
    const P1b = await nopen(pat('home'), Object.assign({ state: s1, skew: DAY }, nop));
    const p1Guest = await until(P1b, c => HOST.collab.code === c && HOST.collab.status === 'open' && HOST.collab.role === 'guest' && HOST.collab.members.length === 2, Q1, 40000);
    check('rejoin (peer to peer): a day later with nobody holding the room, the first page back on its network hosts it from its copy (its stations), and the next one links to it',
      p2Host && p1Guest, JSON.stringify([await way(P2b), await way(P1b)]));
    // on another network: nothing by itself, but Start room XYZ again, which hosts it from this device's copy
    const s1b = await P1b.context().storageState();
    for (const c of all.splice(0)) await c.close().catch(() => {});
    await sleep(1500);
    const P1c = await nopen(pat('away'), Object.assign({ state: s1b, skew: DAY }, nop));
    await sleep(6000);
    const p1cOut = await way(P1c);
    await P1c.evaluate(() => HOST.collab.dialog(true));
    const again = await until(P1c, c => !!document.querySelector(`#shared .sh-near [data-sh="again:${c}"]`), Q1, 15000);
    await looked(P1c);
    await shot(P1c, 'near-again.png');
    await P1c.evaluate(c => document.querySelector(`#shared [data-sh="again:${c}"]`).click(), Q1);
    const p1cHost = await until(P1c, ([c, n]) => HOST.collab.code === c && HOST.collab.status === 'open' && HOST.collab.role === 'host' && HOST.collab.stations().length === n, [Q1, NS], 40000);
    check('rejoin (peer to peer): on another network nothing by itself; the dialog offers Start room XYZ again, whose one press hosts it from this device\'s copy',
      !p1cOut.code && p1cOut.offer === Q1 && again && p1cHost, JSON.stringify({ p1cOut, again, now: await way(P1c) }));
    // Leave on purpose: not joined again by itself (this network is now where it was used last)
    await P1c.evaluate(() => document.querySelector('#shared [data-sh="leave"]').click());
    await until(P1c, () => !HOST.collab.joined, null, 5000);
    await reopen(P1c, pat('away'));
    await sleep(6000);
    const p1cLeft = await way(P1c);
    check('rejoin (peer to peer): a room left on purpose is not joined again by itself', !p1cLeft.code && !p1cLeft.offer, JSON.stringify(p1cLeft));
    // the relay's log names no address it was given (nor any network's id)
    check('rooms on this network: the relay\'s log names none of the pretend addresses', !N.out.includes(HOME) && !N.out.includes(AWAY) && !N.out.includes(aNet), N.out.split('\n').filter(l => l.includes(HOME) || l.includes(AWAY)).slice(0, 3).join(' / '));
  } finally {
    for (const c of all) await c.close().catch(() => {});
    for (const s of servers) s.close();
    N.proc.kill();
  }
}

// ---- follow a person (a page only): a pretend person in a headset (a socket of its own speaking as a headset's page
// does: hello as 'ar', presence ten times a second with the station it stands at, st) and a page D that follows them from
// its Shared dialog: not at a station yet (the dialog stays, saying so), into a circle (the page follows that station),
// on to the next (it switches), out of every circle and their presence quiet (it stays on the last one); a station
// followed by hand, Stop following in their row and a story picked by hand each stop it; they leave the room (it stops,
// the page stays at their last station). dir: pictures of the people list with Follow and the dialog following them
const FORMAT = /const FORMAT = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'shared.js'), 'utf8'))[1];
function person(code, id, name) {
  const G = { id, st: '', head: [0, 1.6, 0], on: true, timer: 0, ws: new WebSocket(`ws://127.0.0.1:${port}/api/ws?room=${code}&id=${id}&proto=1`) };
  G.open = new Promise((res, rej) => { G.ws.onopen = res; G.ws.onerror = () => rej(new Error('the person\'s socket failed')); });
  G.ws.onmessage = () => {};
  G.open.then(() => {
    G.ws.send(JSON.stringify({ t: 'hello', name, color: '#ff7a59', kind: 'ar', here: true, version: FORMAT, proto: 1, dev: 'headset' }));
    G.timer = setInterval(() => {
      if (G.on && G.ws.readyState === 1) G.ws.send(JSON.stringify({ t: 'fx', k: 'p.' + id, v: { st: G.st, head: [...G.head, 0, 0, 0, 1], hands: [], bv: '', sp: '', al: '' } }));
    }, 100);
  }, () => {});
  G.close = () => { clearInterval(G.timer); try { G.ws.close(1000); } catch (e) { /* closed */ } };
  return G;
}
async function personFollow(code, dir) {
  const D = await open('#s=' + code, { width: 760, height: 900 });
  await until(D, () => HOST.collab.status === 'open' && HOST.collab.stations().length > 1, null, 30000);
  const [s1, s2] = [await stationOf(D, PICK_STORY), await stationOf(D, OTHER_STORY)];
  const [t1, t2] = await D.evaluate(k => k.map(x => HOST.meta(x).title), [PICK_STORY, OTHER_STORY]);
  const G = person(code, 'guide' + Math.random().toString(36).slice(2, 7), 'Guide');
  await G.open;
  // (where they stand: on a station's spot, or a step back from it)
  const spot = await D.evaluate(ids => ids.map(id => { const s = HOST.collab.station(id); return [s.x, 1.6, s.z]; }), [s1, s2]);
  const go = (st, i, off) => { G.st = st; G.head = [spot[i][0], 1.6, spot[i][2] + (off || 0)]; };
  const line = () => D.evaluate(() => { const e = document.querySelector('#shared .sh-room span'); return e ? e.textContent : ''; });
  const fol = () => D.evaluate(() => [HOST.collab.followingWho(), HOST.collab.following(), HOST.curKey]);
  const at = (id, k) => until(D, ([i, k]) => HOST.collab.following() === i && HOST.curKey === k && !HOST.busy, [id, k], 60000).then(ok => ok && ready(D, k, 60000));
  const click = q => D.evaluate(q => { HOST.collab.dialog(true); const b = document.querySelector('#shared ' + q); if (b) b.click(); return !!b; }, q);
  const see = async (q, file) => { if (!dir) return; await D.evaluate(q => { const e = document.querySelector('#shared ' + q); if (e) e.scrollIntoView({ block: 'center' }); }, q); await sleep(300); await D.screenshot({ path: path.join(dir, file) }); };
  try {
    // the people list: Follow for a person in a headset; none for a screen or for you
    await D.evaluate(() => HOST.collab.dialog(true));
    const btn = await until(D, id => !!document.querySelector(`#shared [data-sh="who:${id}"]`), G.id, 15000);
    const rows = await D.evaluate(() => [...document.querySelectorAll('#shared .sh-people li')].map(li => [li.textContent.replace(/\s+/g, ' ').trim(), !!li.querySelector('[data-sh^="who:"]')]));
    check('follow a person: the people list has Follow for a person in a headset, none for a screen or for you',
      btn && rows.filter(r => r[1]).length === 1 && rows.some(r => /Guide/.test(r[0]) && /headset/.test(r[0]) && r[1]) && rows.some(r => /\(you\)/.test(r[0]) && !r[1]) && rows.some(r => /screen/.test(r[0]) && !/\(you\)/.test(r[0]) && !r[1]), JSON.stringify(rows));
    await see('.sh-people', 'follow-person-1-people.png');
    // not at a station yet: the dialog stays open and says so
    await click(`[data-sh="who:${G.id}"]`);
    const w0 = await until(D, () => !document.getElementById('shared').hidden && document.querySelector('#shared .sh-room span').textContent === 'Following Guide (not at a station yet)', null, 5000);
    check('follow a person not at a station yet: the dialog stays open and says so', w0 && (await fol())[0] === G.id, JSON.stringify([await line(), await fol()]));
    // they walk into a circle: the page follows that station, and the dialog says where they are
    go(s1, 0);
    const a1 = await at(s1, PICK_STORY), l1 = await line();
    check('following a person: the page follows the station they walk into, and the dialog says "Following Guide (at <story>)"', a1 && l1 === `Following Guide (at ${t1})`, JSON.stringify({ f: await fol(), l1 }));
    await D.evaluate(() => HOST.collab.dialog(true));
    await see('.sh-room', 'follow-person-2-following.png');
    await see('.sh-people', 'follow-person-3-people-following.png');
    const stopRow = await D.evaluate(id => { const b = document.querySelector('#shared .sh-people li.on [data-sh="unfollow"]'); return !!b && /Guide/.test(b.closest('li').textContent); }, G.id);
    check('... and their row in the people list says Stop following', stopRow);
    // on to the next circle: it switches
    go(s2, 1);
    const a2 = await at(s2, OTHER_STORY), l2 = await line();
    check('... and switches as they walk to the next circle', a2 && l2 === `Following Guide (at ${t2})`, JSON.stringify({ f: await fol(), l2 }));
    // out of every circle: it stays on the last one; their presence quiet too (a headset taken off)
    go('', 1, 1.8);
    await until(D, () => /; in no circle now\)$/.test(document.querySelector('#shared .sh-room span').textContent), null, 6000);   // (a busy page: its pump waits for frames)
    const [f3, l3] = [await fol(), await line()];
    G.on = false;
    await sleep(4500);
    const f4 = await fol();
    G.on = true;
    check('... and stays on the last one when they step out of every circle (and when their presence goes quiet)',
      f3.join() === [G.id, s2, OTHER_STORY].join() && l3 === `Following Guide (last at ${t2}; in no circle now)` && f4.join() === f3.join(), JSON.stringify({ f3, l3, f4 }));
    // a station followed by hand stops it: their walking no longer moves the page
    const hb = await click(`[data-sh="follow:${s1}"]`);
    const h1 = await at(s1, PICK_STORY);
    go(s2, 1);
    await sleep(3500);
    const f5 = await fol();
    check('a station followed by hand stops following the person (their walking no longer moves the page)', hb && h1 && f5.join() === ['', s1, PICK_STORY].join(), JSON.stringify(f5));
    // followed again (now at the second station): the page goes there and the dialog closes; Stop following in their row
    await click(`[data-sh="who:${G.id}"]`);
    const a6 = await at(s2, OTHER_STORY), shut = await D.evaluate(() => document.getElementById('shared').hidden);
    await click('.sh-people [data-sh="unfollow"]');
    const f6 = await fol();
    check('followed again: the page goes to their station (the dialog closes); Stop following in their row stops it', a6 && shut && f6[0] === '' && f6[1] === '', JSON.stringify({ a6, shut, f6 }));
    // a story picked by hand stops it
    await D.evaluate(id => HOST.collab.followPerson(id), G.id);
    await until(D, id => HOST.collab.following() === id, s2, 5000);
    await D.evaluate(k => HOST.start(k), PICK_STORY);
    await ready(D, PICK_STORY, 60000);
    go(s1, 0); await sleep(500); go(s2, 1);
    await sleep(3000);
    const f7 = await fol();
    check('a story picked by hand stops following the person (and the station), and their walking no longer moves the page', f7.join() === ['', '', PICK_STORY].join(), JSON.stringify(f7));
    // they leave the room: following them stops after a moment (a socket back within it keeps them), the page stays at their last station
    await D.evaluate(id => HOST.collab.followPerson(id), G.id);
    const a8 = await at(s2, OTHER_STORY);
    G.close();
    await sleep(4000);
    const mid = await fol();
    const gone = await until(D, () => !HOST.collab.followingWho(), null, 25000);
    await until(D, () => / has left the room\)$/.test(document.querySelector('#shared .sh-room span').textContent), null, 3000);   // (the dialog redrawn)
    const [f8, l8] = [await fol(), await line()];
    check('they leave the room: following them stops after a moment, the page stays at their last station and the dialog says they have left',
      a8 && mid[0] === G.id && gone && f8.join() === ['', s2, OTHER_STORY].join() && l8 === `Following ${t2} on this page (Guide has left the room)`, JSON.stringify({ mid, f8, l8 }));
  } finally {
    G.close();
    await D.context().close();
  }
}
// --follow: only following a person, in a room of its own with the two stations it needs (and --shots its pictures)
async function followOnly() {
  const A = await open('#stories');
  await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(A, () => HOST.collab.status === 'open', null, 10000);
  const c = await A.evaluate(() => HOST.collab.code);
  await A.evaluate(k => { k.forEach((s, i) => HOST.collab.add(s, { x: i ? 1.2 : -1.2, z: -1.2, yaw: 0 })); }, [PICK_STORY, OTHER_STORY]);
  await until(A, () => HOST.collab.stations().length === 2 && !HOST.collab.internals().pending.size, null, 5000);
  if (shots) fs.mkdirSync(shots, { recursive: true });
  await personFollow(c, shots);
}

// ---- the owner's ten-headset round (29 October 2026), in a room of its own with three stations: a pretend headset H
// before any circle sees every card and icon and everyone, the station cards and name tags following Cards (in 3D by
// default, on top, hidden with the rings and icons staying) and not Labels; in a circle the other stations show their icons only
// (a ring within 2 m of its spot; a ray resting on an icon shows its card, which fades about 2 s after it moves off; the
// trigger there runs nothing),
// and only the people at its circle are drawn (People: everyone in the menu, this headset's own, draws them all);
// walked out of its circle it stays in its story, and walking into another circle switches; the circles lock refuses
// the circle moves and nothing else; a story's lock (the menu's Lock this story at its circle, Lock story in a page's
// dialog) refuses the scene and panel grips at that circle for everyone, and nothing at other circles. (The rest of
// walking out, and both locks across a relay restart, are in the main run.) dir: the pictures for the owner
async function headsetRound(dir) {
  const K1 = 'qubits', KEYS = [K1, HEADSET_STORY, PICK_STORY];   // (first a story built from sets, with a scene to stand at in the pictures)
  const A = await open('#stories');
  await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(A, () => HOST.collab.status === 'open', null, 10000);
  const rc = await A.evaluate(() => HOST.collab.code);
  // (the first in front of the room's origin, the other two further on to either side: seen from the first, in view)
  await A.evaluate(k => k.forEach((s, i) => HOST.collab.add(s, [{ x: 0, z: 0, yaw: 0 }, { x: 1.8, z: -2.6, yaw: -0.3 }, { x: -1.8, z: -2.6, yaw: 0.3 }][i])), KEYS);
  await until(A, () => HOST.collab.stations().length === 3 && !HOST.collab.internals().pending.size, null, 5000);
  const three = p => until(p, () => HOST.collab.status === 'open' && HOST.collab.stations().length === 3, null, 20000);
  // (the headset's page small: its story draws every frame in software, and a scene story is slow at full size)
  const B = await open('#s=' + rc, { width: 1000, height: 760 }), H = await open('#s=' + rc, { width: 320, height: 200 });
  await three(B); await three(H);
  await ready(H, 'airports');
  const aId = await A.evaluate(() => HOST.collab.id);
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);
  await H.evaluate(() => { HOST.room.sharedAlign(true); localStorage.removeItem('collabPeople'); });
  await H.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [-6, 1.6, 6, 0] });
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 400);
  await H.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'U1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
  await frames(H, 300);
  const sts = await A.evaluate(() => HOST.collab.stations()), [S1, S2, S3] = KEYS.map(k => sts.find(s => s.story === k)), ids = [S1.id, S2.id, S3.id];
  check('round: the pretend headset aligns in a room of its own with three stations', await H.evaluate(() => HOST.room.aligned) && !!S1 && !!S2 && !!S3);
  const seenRound = () => H.evaluate(ids => { window.__xr.step(); const O = HOST.collab.overlay();
    return { cards: ids.map(id => { const c = O.cards.get(id); return !!c && c.mesh.visible && c.mesh.material.opacity > 0.9 && O.hit.includes(c.mesh); }),
      icons: ids.map(id => { const o = O.rings.get(id); return !!o && o.icon.g.visible && o.icon.k > 0.9; }),
      rings: ids.map(id => { const o = O.rings.get(id); return !!o && o.g.visible && O.hit.includes(o.ring); }), away: HOST.room.away(), mine: HOST.collab.mine() }; }, ids);
  // three people injected for a few frames, at the stations given ('' none): which of them are drawn
  const crowd = at => H.evaluate(async at => {
    const C = HOST.collab.internals();
    for (let k = 0; k < 6; k++) {
      at.forEach((st, i) => {
        const id = 'zz-p' + i;
        if (!C.members.some(m => m.id === id)) C.members.push({ id, name: 'Person ' + (i + 1), color: '#ff7a59', kind: 'ar', here: true });
        C.pres.set(id, { id, at: performance.now(), st, head: [i - 1, 1.6, 1.5, 0, 0, 0, 1], hands: [] });
      });
      window.__xr.step(); await new Promise(r => setTimeout(r, 15));
    }
    return at.map((st, i) => { const o = HOST.collab.overlay().people.get('zz-p' + i); return !!o && o.g.visible; });
  }, at);
  const menu = id => H.evaluate(async id => {
    const X = window.__xr; HOST.collab.panelOpen(true); X.step(); X.step();
    const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn();
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(res => setTimeout(res, 20)); }
    HOST.collab.panelOpen(false); X.step();
    return !!(r && r.fn);
  }, id);
  try {
    // before any circle: every card and icon, and everyone
    await until(H, () => { window.__xr.step(); return [...HOST.collab.overlay().rings.values()].every(o => o.icon.k > 0.9); }, null, 8000);
    const r0 = await seenRound(), p0 = await crowd([S1.id, S2.id, '']);
    check('round: before any circle the headset sees every station\'s card, icon and ring, and draws everyone', r0.away && !r0.mine && r0.cards.every(Boolean) && r0.icons.every(Boolean) &&
      r0.rings.every(Boolean) && p0.every(Boolean), JSON.stringify({ r0, p0 }));
    // each ring floats 0.5 m over the floor, and each card stands over its ring's middle (its own middle at 1.45 m)
    const geo = await H.evaluate(ids => { const O = HOST.collab.overlay(); return ids.map(id => { const o = O.rings.get(id), c = O.cards.get(id), s = HOST.collab.stations().find(x => x.id === id), p = c && c.mesh.position;
      return { ring: +o.ring.position.y.toFixed(4), tip: +o.tip.position.y.toFixed(4), card: !!p && Math.hypot(p.x - s.x, p.z - s.z) < 1e-3 && Math.abs(p.y - 1.45) < 1e-6 }; }); }, ids);
    check('round: the rings float 0.5 m over the floor, and each card stands over its ring\'s middle', geo.every(g => g.ring === 0.5 && Math.abs(g.tip - 0.501) < 1e-4 && g.card), JSON.stringify(geo));
    // the station cards and people's name tags are cards (HOST.xr.cards, with the story panels): the room's, in 3D in a
    // room without the setting, and they follow Cards, not Labels: on top, hidden (no card and no tag; the rings, still
    // pointable, and the icons stay), and in 3D again with the labels hidden
    const cardLook = () => H.evaluate(async () => {
      const C = HOST.collab.internals(), id = 'zz-tag', O = HOST.collab.overlay();
      if (!C.members.some(m => m.id === id)) C.members.push({ id, name: 'Tag', color: '#ff7a59', kind: 'ar', here: true });
      for (let k = 0; k < 4; k++) { C.pres.set(id, { id, at: performance.now(), st: '', head: [0.5, 1.6, 1.5, 0, 0, 0, 1], hands: [] }); window.__xr.step(); await new Promise(r => setTimeout(r, 15)); }
      const o = O.people.get(id), c = [...O.cards.values()], m = x => x.mesh.material;
      const out = { mode: HOST.xr.cards() + '/' + HOST.xr.labels(), n: c.length,
        cards: !c.length ? '?' : c.every(x => !x.mesh.visible) ? 'hidden' : !c.every(x => x.mesh.visible) ? '?' : c.every(x => m(x).depthTest && m(x).depthWrite && m(x).alphaTest > 0 && x.mesh.renderOrder === -1) ? 'fixed' :
          c.every(x => m(x).depthTest && !m(x).depthWrite && !m(x).alphaTest && x.mesh.renderOrder === 49) ? 'face' : '?',
        tag: !o ? '?' : o.tag.visible && !o.sign.visible ? 'face' : o.sign.visible && !o.tag.visible ? 'fixed' : !o.tag.visible && !o.sign.visible ? 'hidden' : '?',
        icons: [...O.rings.values()].every(r => r.g.visible && r.icon.k > 0.5) };
      C.pres.delete(id); C.members = C.members.filter(x => x.id !== id); window.__xr.step();
      return out;
    });
    const cl0 = await cardLook();
    await A.evaluate(() => HOST.xr.setCards('face'));
    const clF = await until(H, () => HOST.xr.cards() === 'face', null, 3000) && await cardLook();
    await A.evaluate(() => HOST.xr.setCards('hidden'));
    const clH = await until(H, () => HOST.xr.cards() === 'hidden', null, 3000) && await cardLook(), rH = await seenRound();
    await A.evaluate(() => { HOST.xr.setCards('fixed'); HOST.xr.setLabels('hidden'); });
    const clL = await until(H, () => HOST.xr.cards() === 'fixed' && HOST.xr.labels() === 'hidden', null, 3000) && await cardLook();
    await A.evaluate(() => HOST.xr.setLabels('face'));
    await until(H, () => HOST.xr.labels() === 'face', null, 3000);
    check('round: the station cards and a person\'s name tag follow Cards (in 3D by default, on top, hidden: the rings and icons stay), not Labels (hidden, they stay in 3D)',
      cl0.mode === 'fixed/face' && cl0.cards === 'fixed' && cl0.tag === 'fixed' && clF.cards === 'face' && clF.tag === 'face' && clH.cards === 'hidden' && clH.tag === 'hidden' &&
      clH.icons && rH.rings.every(Boolean) && clL.mode === 'fixed/hidden' && clL.cards === 'fixed' && clL.tag === 'fixed', JSON.stringify({ cl0, clF, clH, clL, rings: rH.rings }));
    // in its circle: the others' icons only (their rings 3.2 m away: gone), and of its own neither ring nor icon (the
    // owner, 31 October 2026: hidden once you are inside); only the people at its circle drawn
    const in1 = await walk(H, S1, K1, 0, 150000);
    // (its station in explore mode, so its scene shows in the pictures)
    await A.evaluate(id => HOST.collab.publish([['st.' + id + '.play', { mode: 'explore', t: 0, playing: false, at: Math.round(HOST.collab.now()) }]]), S1.id);
    await until(H, () => { window.__xr.step(); return HOST.cur.peek('APP.mode') === 'explore'; }, null, 8000);
    // (the rings fade by each frame's time, at most 0.1 s a frame: a slow page in a long run takes a while)
    await until(H, ids => { window.__xr.step(); const O = HOST.collab.overlay(); return !O.rings.get(ids[0]).ring.visible && ids.slice(1).every(id => O.rings.get(id).icon.k > 0.9 && !O.rings.get(id).ring.visible && !O.cards.get(id).mesh.visible); }, ids, 30000);
    const r1 = await seenRound(), p1 = await crowd([S1.id, S2.id, '']);
    const balls = await H.evaluate(ids => { const O = HOST.collab.overlay(); return ids.map(id => O.hit.includes(O.rings.get(id).ball)); }, ids);
    check('round: in its circle the other stations show their icons only (no ring, no card; the icons pointable), and of its own nothing (no ring, not pointable)', in1 && r1.mine === S1.id && !r1.cards[1] && !r1.cards[2] &&
      r1.icons[1] && r1.icons[2] && !r1.icons[0] && !r1.rings[1] && !r1.rings[2] && !r1.rings[0] && balls.join() === 'false,true,true', JSON.stringify({ r1, balls }));
    check('round: in its circle only the people at its circle are drawn (not those at another circle or at none)', p1.join() === 'true,false,false', JSON.stringify(p1));
    // People in the menu: everyone (this headset's own: kept on it, nothing written to the room), and back
    // (what the headset writes meanwhile but its explore view at its station: nothing)
    const q0 = (await roomInfo(rc)).seq, hId = await H.evaluate(() => HOST.collab.id);
    const m1 = await menu('people'), p2 = await crowd([S1.id, S2.id, '']), kept = await H.evaluate(() => [localStorage.getItem('collabPeople'), HOST.collab.seeAll()]);
    const m2 = await menu('people'), p3 = await crowd([S1.id, S2.id, '']);
    const wrote = Object.entries((await roomInfo(rc)).keys).filter(([k, e]) => e.seq > q0 && e.by === hId && !/\.view$/.test(k)).map(([k]) => k);
    check('round: People in the clock menu draws everyone (kept on this headset, never written to the room) and the same circle again', m1 && m2 && p2.every(Boolean) &&
      kept.join() === 'all,true' && p3.join() === 'true,false,false' && !wrote.length && !Object.keys((await roomInfo(rc)).keys).some(k => /people|see/i.test(k)), JSON.stringify({ p2, kept, p3, wrote }));
    // Show all rings in the menu (under Circles; this headset's own, kept on it, nothing written): every ring at any
    // distance, its own too (pointable, to grab it); off again, its own hidden and the far ones gone
    const q1 = (await roomInfo(rc)).seq, ringsOn = ids => H.evaluate(ids => { window.__xr.step(); const O = HOST.collab.overlay(); return ids.map(id => O.rings.get(id).ring.visible); }, ids);
    const a1 = await menu('rings');
    await until(H, ids => { window.__xr.step(); const O = HOST.collab.overlay(); return ids.every(id => O.rings.get(id).near > 0.98); }, ids, 8000);
    const ra = await seenRound(), keptR = await H.evaluate(() => [localStorage.getItem('collabRings'), HOST.collab.allRings()]);
    const a2 = await menu('rings');
    await until(H, ids => { window.__xr.step(); const O = HOST.collab.overlay(); return ids.every(id => !O.rings.get(id).ring.visible); }, ids, 8000);
    const rb = await ringsOn(ids);
    const wroteR = Object.entries((await roomInfo(rc)).keys).filter(([k, e]) => e.seq > q1 && e.by === hId && !/\.view$/.test(k)).map(([k]) => k);
    check('round: Show all rings in the clock menu shows every ring at any distance, its own too (pointable), kept on this headset and never written to the room; off, its own hidden again',
      a1 && a2 && ra.rings.every(Boolean) && keptR.join() === 'all,true' && !rb.some(Boolean) && !wroteR.length && !Object.keys((await roomInfo(rc)).keys).some(k => /ring/i.test(k)), JSON.stringify({ ra, keptR, rb, wroteR }));
    // a ray resting on another station's icon: its card while it points, still there a second after, gone a few seconds
    // later (the icon stays); the trigger there runs nothing (walk into its circle)
    // (the pretend session never presents, so the story's xrUpdate, which hides the Stories screen's cards every frame in
    // a headset, runs only when asked: its two rows at 1.25 m would otherwise stand in the ray's way as last shown)
    await H.evaluate(() => HOST.cur.peek('xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS)'));
    const at2 = await ringAt(H, S2.id), on2 = await pointAt(H, at2);
    const shown2 = on2 === S2.id && await until(H, ([a, b]) => { window.__xr.step(); const O = HOST.collab.overlay(), c = O.cards.get(a), o = O.rings.get(a);
      return !!c && c.mesh.visible && c.mesh.material.opacity > 0.95 && O.hit.includes(c.mesh) && o.icon.k > 0.9 && !O.cards.get(b).mesh.visible && O.rings.get(b).icon.k > 0.9; }, [S2.id, S3.id], 10000);
    const d2 = await H.evaluate(([a, b]) => { const O = HOST.collab.overlay(), c = O.cards.get(a), h = HOST.collab.internals().hov.get(0);
      return { vis: c && c.mesh.visible, op: c && +c.mesh.material.opacity.toFixed(2), hit: c && O.hit.includes(c.mesh), k: +O.rings.get(a).icon.k.toFixed(2), peek: O.rings.get(a).peek,
        other: O.cards.get(b) && O.cards.get(b).mesh.visible, ok: +O.rings.get(b).icon.k.toFixed(2), hov: h && h.target, age: h && performance.now() - h.at,
        ray: (r => r && { near: r.near, n: r.n, o: r.o.toArray().map(v => +v.toFixed(2)), d: r.d.toArray().map(v => +v.toFixed(2)) })(HOST.collab.internals().rays.get(0)),
        root: !!(O.root && O.root.visible && O.root.parent), ball: (b => b && b.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)))(O.rings.get(a).ball),
        inHit: O.hit.includes(O.rings.get(a).ball), mode: HOST.cur.peek('APP.mode'), panels: HOST.cur.peek('[XR.main.mesh.visible, XR.foot.mesh.visible]'),
        phit: HOST.cur.peek('XR.raycaster.intersectObjects(XR.panelMeshes.filter(m => m.visible), false).map(h => [XR.panels.indexOf(XR.panels.find(q => q.mesh === h.object)), h.object === XR.main.mesh ? "main" : h.object === XR.foot.mesh ? "foot" : "?", +h.distance.toFixed(2)])'),
        mainAt: HOST.cur.peek('XR.main.mesh.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2))'), footAt: HOST.cur.peek('XR.foot.mesh.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2))'),
        rig: HOST.cur.peek('[GL.rig.position.x, GL.rig.position.y, GL.rig.position.z].map(v => +v.toFixed(2))'), cm: HOST.cur.peek('XR.cm'), st: HOST.collab.val('st.' + HOST.collab.mine() + '.panel') }; }, [S2.id, S3.id]);
    if (dir) { await headView(H, path.join(dir, 'round-2-pointed.png'), -0.55, -0.25, [960, 600]); await pointAt(H, at2); }   // (drawing took a while: pointed at again)
    await H.evaluate(() => window.__xr.ctrl(0, null));
    const t0 = Date.now();
    await frames(H, 1000);
    const still = await H.evaluate(id => { const c = HOST.collab.overlay().cards.get(id); return c.mesh.visible && HOST.collab.overlay().rings.get(id).icon.k > 0.9; }, S2.id);
    const gone = await until(H, id => { window.__xr.step(); const O = HOST.collab.overlay(); return !O.cards.get(id).mesh.visible && O.rings.get(id).icon.k > 0.9; }, S2.id, 8000), after = (Date.now() - t0) / 1000;
    check(`round: a ray resting on another station's icon shows its card (and no other), still there a second after it moves off, faded about 2 s after, the icon staying (gone after ${after.toFixed(1)} s)`,
      shown2 && still && gone && after > 1.9, JSON.stringify({ on2, shown2, d2, still, gone, after }));
    await pointAt(H, await ringAt(H, S2.id));
    await H.evaluate(() => { HOST.cur.peek('XR.ctrls')[0].wantPress = true; });
    await frames(H, 300);
    const tr = await H.evaluate(() => ({ key: HOST.curKey, mine: HOST.collab.mine(), note: (window.__collabLog.filter(e => e.ev === 'notice').slice(-1)[0] || {}).title }));
    await H.evaluate(() => window.__xr.ctrl(0, null));
    check('round: the trigger on another station\'s icon runs nothing (a notice: walk into its circle)', tr.key === K1 && tr.mine === S1.id && tr.note === 'Walk into its circle', JSON.stringify(tr));
    if (dir) {
      // in its circle, the others as icons only (looking between them), and the menu with its two locks and People
      await frames(H, 4000);
      await headView(H, path.join(dir, 'round-1-rings.png'), 0, -0.3, [960, 600]);
      // (each tab: Circles, with the locks, Show all rings and People, then Settings and Debug)
      for (const [tab, file] of [['circles', 'round-3-menu.png'], ['settings', 'round-3-settings.png'], ['debug', 'round-3-debug.png']]) {
        const shot = await H.evaluate(async tab => { const X = window.__xr; HOST.collab.panelOpen(true); HOST.collab.menuTab(tab); for (let k = 0; k < 3; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); }
          const S = HOST.collab.overlay().panel, c = document.createElement('canvas'); c.width = S.w; c.height = S.vis; c.getContext('2d').drawImage(S.cv, 0, 0); HOST.collab.panelOpen(false); X.step(); return c.toDataURL('image/png'); }, tab);
        fs.writeFileSync(path.join(dir, file), Buffer.from(shot.split(',')[1], 'base64'));
      }
    }
    // walked out of its circle: still in its story; then into another circle: it switches
    const sp = await awaySpot(H, S1);
    await goRoom(H, sp[0], 1.6, sp[1], 0);
    await frames(H, 1500);
    const out = await H.evaluate(() => { HOST.cur.peek('xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS)'); return { mine: HOST.collab.mine(), key: HOST.curKey, away: HOST.room.away(), world: HOST.cur.peek('GL.world.visible') }; });
    check('round: walked out of its circle the headset stays in its story (its station, shown)', out.mine === S1.id && out.key === K1 && !out.away && out.world, JSON.stringify(out));
    // 1.6 m from another station's spot (out of its 1.1 m circle): its ring comes back (pointable), and goes beyond 2.2 m
    const ringNear = async (s, dist) => {
      await goRoom(H, s.x, 1.6, s.z - dist, 0);   // (beyond it, away from the other two)
      await until(H, ([id, on]) => { window.__xr.step(); const o = HOST.collab.overlay().rings.get(id); return on ? o.near > 0.95 : !o.ring.visible; }, [s.id, dist < 2], 8000);   // (it fades in and out)
      return H.evaluate(id => { window.__xr.step(); const O = HOST.collab.overlay(), o = O.rings.get(id); return { vis: o.ring.visible, hit: O.hit.includes(o.ring), k: +o.near.toFixed(2), mine: HOST.collab.mine() }; }, s.id);
    };
    const nr = await ringNear(S3, 1.6), fr = await ringNear(S3, 2.6);
    check('round: in a circle another station\'s ring shows within 2 m of its spot (pointable) and goes again further off, the headset staying at its own',
      nr.vis && nr.hit && nr.k > 0.9 && !fr.vis && !fr.hit && nr.mine === S1.id && fr.mine === S1.id, JSON.stringify({ nr, fr }));
    const in2 = await walk(H, S2, HEADSET_STORY, 0, 150000), m3 = await H.evaluate(() => HOST.collab.mine());
    check('round: walking into another circle switches to its story', in2 && m3 === S2.id, JSON.stringify({ in2, m3 }));
    // the circles lock: the grip on another station's ring and Arrange all refused; the grip at its own station free (the
    // flock is life size: its panel), and its story's lock still set from the menu
    // (the grip on the scene, or on the panel: in a life-size story such as the flock only the panel moves)
    const tryGrip = kind => H.evaluate(kind => {
      const X = window.__xr;
      X.aim(0, new THREE.Matrix4().makeTranslation(0, 1.4, -0.4)); X.step();
      HOST.cur.peek(`(c => { c.hover = ${kind === 'panel' ? '{ kind: "panel", P: XR.main, x: 10, y: 10, point: XR.main.mesh.getWorldPosition(new THREE.Vector3()) }' : '{ kind: "globe", i: -1, point: c.o.clone() }'}; xrGrab(c, true); })(XR.ctrls[0])`);
      const g = HOST.cur.peek('!!XR.ctrls[0].grab');
      HOST.cur.peek('xrGrab(XR.ctrls[0], false)'); X.ctrl(0, null); X.step();
      return { locked: HOST.anchor.locked('globe') || HOST.anchor.locked('panel'), grabbed: g, hint: HOST.room.gripHint };
    }, kind || 'globe');
    await A.evaluate(() => HOST.collab.lock(true));
    await until(H, () => HOST.collab.locked, null, 3000);
    const hov3 = await pointAt(H, await ringAt(H, S3.id));
    const gr = await H.evaluate(async id => {
      const X = window.__xr, before = JSON.stringify(HOST.collab.station(id));
      X.step();   // (a hover older than 250 ms is gone: a busy page may come back later than that)
      const h0 = HOST.collab.internals().hov.get(0); window.__dbg = { t: h0 && h0.target, age: h0 && performance.now() - h0.at };
      X.fire('squeezestart', { inputSource: X.session.inputSources[0] });
      for (let k = 0; k < 4; k++) { X.step(); await new Promise(r => setTimeout(r, 30)); }
      const moving = HOST.room.moving;
      X.fire('squeezeend', { inputSource: X.session.inputSources[0] }); X.ctrl(0, null);
      const st = JSON.stringify(HOST.collab.stations());
      HOST.collab.arrange({ x: 4, z: 4, yaw: 1 });
      return { moving, same: before === JSON.stringify(HOST.collab.station(id)), arranged: st !== JSON.stringify(HOST.collab.stations()), note: (window.__collabLog.filter(e => e.ev === 'notice').slice(-1)[0] || {}).title, dbg: window.__dbg };
    }, S3.id);
    const free = await tryGrip('panel'), lockedMenu = await menu('stlock');
    const sl = lockedMenu && await until(B, id => HOST.collab.stationLock(id), S2.id, 3000);
    check('round: the circles lock refuses the grip on a station\'s ring and Arrange all, and nothing else (the scene grip at its station free, Lock this story in the menu works)',
      hov3 === S3.id && !gr.moving && gr.same && !gr.arranged && gr.note === 'The circles are locked' && !free.locked && free.grabbed && sl, JSON.stringify({ hov3, gr, free, sl }));
    // its story locked from the menu: the grips refused at its circle for everyone (the room has it), the panel says so
    const lockedG = await tryGrip('panel'), kv = (await roomInfo(rc)).keys['st.' + S2.id + '.ui'];
    check('round: Lock this story in the clock menu at its circle refuses the scene and panel grips there (the panel says so) and goes to the room for everyone',
      lockedG.locked && !lockedG.grabbed && /locked/.test(lockedG.hint) && !!kv && kv.v.lock === true && kv.v.story === HEADSET_STORY, JSON.stringify({ lockedG, ui: kv && kv.v }));
    const un = await menu('lock'), unA = un && await until(A, () => !HOST.collab.locked, null, 3000);
    // at another circle nothing is locked; a page's dialog locks that one (Lock story), and unlocks both
    const in3 = await walk(H, S1, K1, 0, 150000), other = await tryGrip('globe'), s2still = await B.evaluate(id => HOST.collab.stationLock(id), S2.id);
    check('round: the menu\'s Lock circles unlocks the circles for everyone; at another circle the scene and panel grips are free (only the locked story\'s circle is locked)',
      unA && in3 && !other.locked && other.grabbed && s2still, JSON.stringify({ un, unA, in3, other, s2still }));
    const dl = await B.evaluate(async id => {
      HOST.collab.dialog(true); await new Promise(r => setTimeout(r, 200));
      const q = () => document.querySelector(`[data-sh="stlock:${id}"]`), was = q() && q().textContent;
      if (q()) q().click();
      await new Promise(r => setTimeout(r, 200));
      return [was, q() && q().textContent];
    }, S1.id);
    const hl = await until(H, () => { window.__xr.step(); return HOST.anchor.locked('globe') && HOST.anchor.locked('panel'); }, null, 10000);
    if (dir) {
      await B.evaluate(() => { const e = document.querySelector('#shared .sh-stations'); if (e) e.scrollIntoView({ block: 'start' }); });
      await sleep(400);
      await B.screenshot({ path: path.join(dir, 'round-4-dialog.png') });
    }
    await B.evaluate(ids => { for (const id of ids) document.querySelector(`[data-sh="stlock:${id}"]`).click(); }, [S1.id, S2.id]);
    const hd = await H.evaluate(id => ({ ui: HOST.collab.val('st.' + id + '.ui'), live: HOST.collab.live() && HOST.collab.live().id, placing: HOST.room.placing(), key: HOST.curKey }), S1.id);
    const hu = await until(H, () => { window.__xr.step(); return !HOST.anchor.locked('globe') && !HOST.anchor.locked('panel'); }, null, 10000);
    const both = await A.evaluate(ids => ids.map(id => HOST.collab.stationLock(id)), [S1.id, S2.id]);
    check('round: Lock story in a page\'s Shared dialog locks that station\'s scene and panel at its circle (the headset there), and unlocks it again',
      dl.join() === 'Lock story,Story locked' && hl && hu && both.join() === 'false,false', JSON.stringify({ dl, hl, hd, S1: S1.id, hu, both }));
  } finally {
    await H.evaluate(() => window.__xr.end()).catch(() => {});
    for (const p of [A, B, H]) await p.context().close();
  }
}
// --circles: only the ten-headset round, in a room of its own (with --shots, its pictures)
async function circlesOnly() {
  if (shots) fs.mkdirSync(shots, { recursive: true });
  await headsetRound(shots);
}

// ---- circles asked first (askRound; --ask runs only it, also in the main run after the ten-headset round): a room of its
// own with two story circles and Back to the lobby, a page and a pretend headset, both with v120's default (no
// collabAskDefault). A fresh room asks first with nobody having written look's ask (the page, the headset, the dialog's
// button); a page's Shared dialog turns it to walk in (look's ask false written, the headset too) and back to ask first
// (look's ask true); no ring drawn or pointable then, the cards and icons staying, Show all rings bringing them
// back (v119); the headset walking into a circle and standing there 3 s enters nothing; the trigger on another station's
// icon (pointed at first) opens the question in front of it (that circle's title, in its colour, Go in and Not now; no
// notice); Not now closes it; opened again it closes by itself after 10 s; Go in enters (its live station, the story at its
// circle, its presence there); the lobby by Go in ends it, and so does walking into it (still walked into, its ring
// hidden), the story loaded hearing both (a stub for HOST.cur.lobby, the studio's); Go in pressed while standing in the
// lobby holds; the menu's row turns the switch off for the room, and walking in works again; nothing written to the room
// but look. Then a studio circle: at it, HOST.collab.hideOthers(true) hides every other station's ring, card and icon,
// nothing of them pointable and none walked into but the lobby, and it lapses as the station ends there. dir: pictures (ask-*.png)
async function askRound(dir) {
  const K1 = 'qubits', K2 = HEADSET_STORY;
  const A = await open('#stories', null, false, true);   // (v120's default: a room that never wrote ask asks first)
  await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(A, () => HOST.collab.status === 'open', null, 10000);
  const rc = await A.evaluate(() => HOST.collab.code);
  await A.evaluate(k => { HOST.collab.add(k[0], { x: 0, z: 0, yaw: 0 }); HOST.collab.add(k[1], { x: 1.8, z: -2.6, yaw: -0.3 }); HOST.collab.add('lobby', { x: -1.8, z: -2.6, yaw: 0.3 }); }, [K1, K2]);
  await until(A, () => HOST.collab.stations().length === 3 && !HOST.collab.internals().pending.size, null, 5000);
  const H = await open('#s=' + rc, { width: 320, height: 200 }, false, true);
  await until(H, () => HOST.collab.status === 'open' && HOST.collab.stations().length === 3, null, 20000);
  await ready(H, 'airports');
  const aId = await A.evaluate(() => HOST.collab.id), hId = await H.evaluate(() => HOST.collab.id);
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);
  await H.evaluate(() => HOST.room.sharedAlign(true));
  await H.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [-6, 1.6, 6, 0] });
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 400);
  await H.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'U1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
  await frames(H, 300);
  const sts = await A.evaluate(() => HOST.collab.stations()), S1 = sts.find(s => s.story === K1), S2 = sts.find(s => s.story === K2), SL = sts.find(s => s.kind === 'lobby');
  check('ask: the pretend headset aligns in a room of its own with two story circles and the lobby', await H.evaluate(() => HOST.room.aligned) && !!S1 && !!S2 && !!SL);
  // the question in front of the headset: { id, title (its canvas's), vis, d (from the head), hit (pointable) } or null
  const asked = () => H.evaluate(() => { window.__xr.step(); const a = HOST.collab.asking(), S = HOST.collab.overlay().ask, X = window.__xr;
    const head = new THREE.Vector3().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
    return a && { id: a.id, left: a.left, title: S.sig.split('|')[1], vis: S.mesh.visible, d: +S.mesh.position.distanceTo(head).toFixed(2), hit: HOST.collab.overlay().hit[0] === S.mesh, top: !S.mesh.material.depthTest && S.mesh.renderOrder >= 54 }; });
  // the trigger on station id's icon, pointed at first (the unseen ball round it)
  const askAt = async id => {
    const t = await H.evaluate(id => HOST.collab.overlay().rings.get(id).ball.getWorldPosition(new THREE.Vector3()).toArray(), id), on = await pointAt(H, t);
    await H.evaluate(() => { HOST.cur.peek('XR.ctrls')[0].wantPress = true; });
    await frames(H, 300);
    await H.evaluate(() => window.__xr.ctrl(0, null));
    return on;
  };
  // a press on the question's button (its region on the canvas, by the ray), as a person's trigger does
  const askPress = id => H.evaluate(async id => {
    const X = window.__xr, V = THREE.Vector3, S = HOST.collab.overlay().ask, r = S.regions.find(q => q.id === id);
    if (!r || !S.mesh.visible) return 'no ' + id;
    const p = S.mesh.localToWorld(new V(((r.x + r.w / 2) / S.w - 0.5) * S.mw, (0.5 - (r.y + r.h / 2) / S.h) * S.mw * S.h / S.w, 0));
    const head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert()), o = head.clone().add(new V(0.1, -0.25, 0));
    X.aim(0, new THREE.Matrix4().compose(o, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), p.clone().sub(o).normalize()), new V(1, 1, 1)));
    X.step(); X.step();
    const h = HOST.collab.internals().hov.get(0);
    if (!h || h.target.kind !== 'ask') return 'pointed at ' + JSON.stringify(h && h.target);
    HOST.cur.peek('XR.ctrls')[0].wantPress = true;
    for (let k = 0; k < 6; k++) { X.step(); await new Promise(res => setTimeout(res, 30)); }
    try { X.ctrl(0, null); X.step(); } catch (e) { /* (Go in: the next story is loading, its controllers not there yet) */ }
    return 'pressed';
  }, id);
  const menu = id => H.evaluate(async id => {
    const X = window.__xr; HOST.collab.panelOpen(true); X.step(); X.step();
    const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn();
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(res => setTimeout(res, 20)); }
    HOST.collab.panelOpen(false); X.step();
    return !!(r && r.fn);
  }, id);
  // a press on the question's button by the right index fingertip (a tracked hand): hovered 4 cm in front of it, then
  // within 1.5 cm, then pulled back; { hov: the button hovered, closed: the question gone after }
  const askPoke = id => H.evaluate(async id => {
    const X = window.__xr, V = THREE.Vector3, M4 = THREE.Matrix4, S = HOST.collab.overlay().ask, r = S.regions.find(q => q.id === id);
    if (!r || !S.mesh.visible) return { no: id };
    const tip = { world: new M4() }, keep = X.session.inputSources[0];
    X.session.inputSources[0] = { handedness: 'right', targetRayMode: 'tracked-pointer', gamepad: null, targetRaySpace: { world: X.W.local.clone() }, hand: new Map([['index-finger-tip', tip]]) };
    const at = d => S.mesh.localToWorld(new V(((r.x + r.w / 2) / S.w - 0.5) * S.mw, (0.5 - (r.y + r.h / 2) / S.h) * S.mw * S.h / S.w, d));
    const tipAt = v => { tip.world = X.W.local.clone().multiply(new M4().makeTranslation(v.x, v.y, v.z)); };
    const steps = async n => { for (let k = 0; k < n; k++) { X.step(); await new Promise(res => setTimeout(res, 20)); } };
    tipAt(at(0.04)); await steps(2);
    const hov = HOST.collab.overlay().ask.hover;
    tipAt(at(0.005)); await steps(2);
    tipAt(at(0.06)); await steps(1);
    if (keep) X.session.inputSources[0] = keep; else X.session.inputSources.length = 0;
    await steps(1);
    return { hov, closed: !HOST.collab.asking() };
  }, id);
  const where = () => H.evaluate(() => ({ mine: HOST.collab.mine(), away: HOST.room.away(), key: HOST.curKey, placing: HOST.room.placing() }));
  // every station's ring, icon and card as the headset draws them (a few frames first), the live one's left out on ask: ring
  // drawn, hit (the ring pointable), icon (drawn and pointable), card (drawn)
  const rings = live => H.evaluate(live => { const X = window.__xr; for (let k = 0; k < 3; k++) X.step(); const O = HOST.collab.overlay(), mine = HOST.collab.mine();
    return [...O.rings.entries()].filter(([id]) => !live || id !== mine).map(([id, o]) => ({ id, ring: o.ring.visible, hit: O.hit.includes(o.ring), icon: o.icon.g.visible && O.hit.includes(o.ball),
      card: !!(O.cards.get(id) && O.cards.get(id).mesh.visible) })); }, !!live);
  // the same once want holds of them, or ms have passed (they fade over frames, and a page drawing in software steps few)
  const ringsWhen = async (want, ms, live) => { const t0 = Date.now(); let r; do { await frames(H, 300); r = await rings(live); } while (!want(r) && Date.now() - t0 < ms); return r; };
  // the story loaded hears each time this headset goes to the lobby (HOST.cur.lobby, the studio's): a stub counting them
  const stubLobby = () => H.evaluate(() => { window.__lobbyN = window.__lobbyN || 0; HOST.cur.lobby = () => { window.__lobbyN++; }; return window.__lobbyN; });
  const lobbyN = () => H.evaluate(() => window.__lobbyN || 0);
  // the Shared dialog's switch on page A: { was, now } as [its text, aria-pressed], pressed once (press false: read only)
  const dlgAsk = press => A.evaluate(async press => {
    HOST.collab.dialog(true); await new Promise(r => setTimeout(r, 200));
    const b = () => document.querySelector('[data-sh="ask"]'), was = b() && [b().textContent, b().getAttribute('aria-pressed')];
    if (b() && press) b().click();
    await new Promise(r => setTimeout(r, 200));
    const now = b() && [b().textContent, b().getAttribute('aria-pressed')];
    HOST.collab.dialog(false);
    return { was, now };
  }, press);
  // what the headset holds of look's ask, said when a wait for it fails
  const hsLook = () => H.evaluate(() => { const I = HOST.collab.internals(), e = I.keys && I.keys.get('look'); return { welcomed: I.welcomed, ws: I.ws && I.ws.readyState, look: e ? { seq: e.seq, ask: e.v && e.v.ask } : null }; });
  try {
    // (v120) asked first by default: in this fresh room nobody has written look's ask, and the page, the headset and the
    // dialog's button all say ask first
    const lk0 = (await roomInfo(rc)).keys.look, d0 = await dlgAsk(false);
    const af0 = await H.evaluate(() => [HOST.collab.askDefault(), HOST.collab.askFirst()]), afA = await A.evaluate(() => [HOST.collab.askDefault(), HOST.collab.askFirst()]);
    check('ask: a fresh room asks first by default, with nobody having written look\'s ask (the page, the headset and the dialog\'s button)', (!lk0 || lk0.v.ask === undefined) &&
      af0.join() === 'true,true' && afA.join() === 'true,true' && d0.was && d0.was.join() === 'Circles: ask first,true', JSON.stringify({ look: lk0 && lk0.v, af0, afA, d0 }));
    // the dialog's switch turns it to walk in for the room: look's ask false written, the headset too
    const q0 = (await roomInfo(rc)).seq;
    const d1 = await dlgAsk(true);
    const off1 = await until(H, () => !HOST.collab.askFirst(), null, 15000), lk1 = (await roomInfo(rc)).keys.look;
    check('ask: the Shared dialog\'s switch turns the circles to walk in for the room (look\'s ask false written), the headset too', off1 && d1.was && d1.was.join() === 'Circles: ask first,true' &&
      d1.now.join() === 'Circles: walk in,false' && !!lk1 && lk1.v.ask === false && lk1.by === aId, JSON.stringify({ d1, off1, look: lk1, headset: off1 ? null : await hsLook() }));
    // and back to ask first: the room's (look's ask true), for the headset too
    const dlg = await dlgAsk(true);
    // (the key comes in with the socket's message, set at once; a machine loaded with software drawing once took more
    // than 5 s to deliver it, so a longer wait, and what the headset holds is said if it never comes)
    const on = await until(H, () => HOST.collab.askFirst(), null, 15000), lk = (await roomInfo(rc)).keys.look;
    const hs = on ? null : await hsLook();
    check('ask: a page\'s Shared dialog turns the circles to ask first again for the room (look\'s ask true), the headset too', on && dlg.was && dlg.was.join() === 'Circles: walk in,false' && dlg.now.join() === 'Circles: ask first,true' &&
      !!lk && lk.v.ask === true, JSON.stringify({ dlg, on, look: lk && lk.v, headset: hs }));
    // (v119) asked first, no ring is drawn or pointable, before any circle too and the lobby's as well; the cards and icons
    // stay (they are what is pressed); Show all rings brings every ring back, and off again they go
    const r0 = await ringsWhen(r => r.every(x => !x.ring), 8000), ra = await H.evaluate(() => HOST.collab.allRings(true));
    const r1 = await ringsWhen(r => r.every(x => x.ring && x.hit), 8000);
    await H.evaluate(() => HOST.collab.allRings(false));
    const r2 = await ringsWhen(r => r.every(x => !x.ring), 8000);
    check('ask: asked first, no ring is drawn or pointable (the lobby\'s too), the cards and icons stay; Show all rings brings them back, off again they go',
      r0.length === 3 && r0.every(r => !r.ring && !r.hit && r.icon && r.card) && ra && r1.length === 3 && r1.every(r => r.ring && r.hit) && r2.every(r => !r.ring && !r.hit && r.icon && r.card), JSON.stringify({ r0, r1, r2 }));
    // walking into a circle and standing there 3 s enters nothing
    await goRoom(H, S1.x, 1.6, S1.z, 0);
    await frames(H, 3000);
    const w1 = await where();
    check('ask: with the circles asked first, walking into a circle and standing there 3 s enters nothing', !w1.mine && w1.away && w1.key !== K1, JSON.stringify(w1));
    // the trigger on another station's icon: the question, with that circle's title, in front of the headset, on top and pointable; no notice
    const n0 = await H.evaluate(() => HOST.collab.notes().length);
    const p1 = await askAt(S2.id), a1 = await asked(), n1 = await H.evaluate(() => HOST.collab.notes().slice(-1)[0]), t2 = await H.evaluate(k => HOST.meta(k).title, K2);
    if (dir) await headView(H, path.join(dir, 'ask-1-question.png'), -0.2, -0.15, [960, 600]);
    check('ask: the trigger on another station\'s icon opens the question in front of the headset (its title, on top, pointable; no notice)', p1 === S2.id && !!a1 && a1.id === S2.id && a1.title === t2 && a1.vis &&
      a1.d > 0.8 && a1.d < 1 && a1.hit && a1.top && (await H.evaluate(() => HOST.collab.notes().length)) === n0, JSON.stringify({ p1, a1, t2, n1 }));
    // Not now closes it, and nothing is entered
    const nn = await askPress('ask:not'), a2 = await asked(), w2 = await where();
    check('ask: Not now closes the question and enters nothing', nn === 'pressed' && !a2 && !w2.mine && w2.away, JSON.stringify({ nn, a2, w2 }));
    // opened again, it closes by itself after 10 s
    await askAt(S2.id);
    const a3 = await asked(), t0 = Date.now();
    await frames(H, 7500);
    const a4 = await asked();
    // (its age counted from when it opened: the time it had left when first read, as opening it may take a loaded machine a while)
    const gone = await until(H, () => { window.__xr.step(); return !HOST.collab.asking(); }, null, 4000), after = (Date.now() - t0) / 1000 + (a3 ? (10000 - a3.left) / 1000 : 0), w3 = await where();
    check(`ask: the question closes by itself after 10 s (gone after ${after.toFixed(1)} s), entering nothing`, !!a3 && !!a4 && gone && after > 9.5 && after < 12 && !w3.mine, JSON.stringify({ a3, a4, after, w3 }));
    // Not now pressed by the right index fingertip
    await askAt(S2.id);
    const pk = await askPoke('ask:not'), w3b = await where();
    check('ask: the right index fingertip presses the question\'s buttons (Not now, hovered first)', pk.hov === 'ask:not' && pk.closed && !w3b.mine, JSON.stringify({ pk, w3b }));
    // (asking, Not now and the time running out wrote nothing to the room)
    const quiet = Object.entries((await roomInfo(rc)).keys).filter(([, e]) => e.seq > q0 && e.by === hId).map(([k]) => k);
    check('ask: the headset wrote nothing to the room while it asked, said Not now and let the question close', !quiet.length, JSON.stringify(quiet));
    // Go in: its live station (the headset still standing in the other circle), the story at its circle, its presence there
    await askAt(S2.id);
    const gi = await askPress('ask:go');
    let inS2 = false;
    for (let k = 0; k < 60 && !inS2; k++) { await frames(H, 300); inS2 = await H.evaluate(k => HOST.curKey === k, K2); }
    inS2 = inS2 && await ready(H, K2, 150000);
    if (inS2) { await H.evaluate(() => HOST.cur.peek('xrAdopt()')); await frames(H, 600); }
    const w4 = await where(), rig = await rigOf(H), want = rigAt(S2), pres = await until(A, ([h, s]) => { const P = HOST.collab.people().get(h); return !!P && P.st === s; }, [hId, S2.id], 5000);
    check('ask: Go in enters that circle (its live station, its story placed at its circle, the presence there), the headset standing elsewhere', gi === 'pressed' && inS2 && w4.mine === S2.id && !w4.away && w4.placing &&
      near(rig.slice(0, 3), want.slice(0, 3), 0.02) && angle(rig[3], want[3]) < 0.02 && pres, JSON.stringify({ gi, inS2, w4, rig: fmt(rig), want: fmt(want), pres }));
    // still standing in the first circle: nothing enters it
    await frames(H, 2500);
    const w5 = await where();
    check('ask: standing in another circle after Go in enters nothing', w5.mine === S2.id, JSON.stringify(w5));
    // Back to the lobby by Go in: the live station ends (away, every circle shown again), and the story loaded hears it
    await stubLobby();
    await askAt(SL.id);
    const a6 = await asked(), gl = await askPress('ask:go');
    await frames(H, 600);
    const w6 = await where(), l6 = await lobbyN();
    check('ask: the lobby asks too (Back to the lobby), and its Go in ends the station (away, in no circle); the story loaded hears it (HOST.cur.lobby)', !!a6 && a6.id === SL.id && a6.title === 'Back to the lobby' && gl === 'pressed' && !w6.mine && w6.away && l6 === 1,
      JSON.stringify({ a6, gl, w6, l6 }));
    // (v119) the lobby is still walked into with the circles asked first, its ring hidden: from a story (Go in), walking
    // into it ends the station and the story loaded hears it again
    await askAt(S2.id);
    const g7 = await askPress('ask:go');
    await frames(H, 800);
    const w7 = await where();
    await stubLobby();
    await goRoom(H, SL.x, 1.6, SL.z, 0);
    await frames(H, 2500);
    const w8 = await where(), l8 = await lobbyN(), lr = (await rings()).find(r => r.id === SL.id);
    check('ask: asked first, the lobby is still walked into (its ring hidden): standing in it 1 s ends the station, and the story loaded hears it',
      g7 === 'pressed' && w7.mine === S2.id && !w8.mine && w8.away && l8 === 2 && !!lr && !lr.ring && !lr.hit, JSON.stringify({ g7, w7, w8, l8, lr }));
    // Go in pressed while standing in the lobby: not taken back to the lobby until the headset has stepped out of it
    await askAt(S2.id);
    const g9 = await askPress('ask:go');
    await frames(H, 2500);
    const w9 = await where(), l9 = await lobbyN();
    check('ask: Go in pressed while standing in the lobby holds (not taken back there until you step out of it)', g9 === 'pressed' && w9.mine === S2.id && l9 === 2, JSON.stringify({ g9, w9, l9 }));
    // the menu's row turns the switch off for the room (out of every circle first); nothing written by the headset but look
    const sp1 = await awaySpot(H, S1);
    await goRoom(H, sp1[0], 1.6, sp1[1], 0);
    await frames(H, 300);
    const m1 = await menu('askfirst'), off = m1 && await until(A, () => !HOST.collab.askFirst(), null, 5000);
    // (besides look, at most what any headset arriving at a station writes: its story's state and view there)
    const ri = await roomInfo(rc), wrote = Object.entries(ri.keys).filter(([k, e]) => e.seq > q0 && e.by === hId && !new RegExp('^st\\.' + S2.id + '\\.(x|view)$').test(k)).map(([k]) => k);
    check('ask: the headset menu\'s Circles row turns the circles back to walk in, for the room (look\'s ask false written); the headset wrote nothing else to the room but look',
      m1 && off && wrote.join() === 'look' && ri.keys.look.v.ask === false, JSON.stringify({ m1, off, wrote, look: ri.keys.look && ri.keys.look.v }));
    // walking in works again
    const in1 = await walk(H, S1, K1, 0, 150000);
    check('ask: switched off, walking into a circle enters it again', in1 && (await where()).mine === S1.id, JSON.stringify(await where()));
    // (v119) the other circles hidden at a studio station (HOST.collab.hideOthers, the studio's switch): another station's
    // ring, card and icon neither drawn nor pointable there; refused elsewhere; it lapses once the live station changes
    const no0 = await H.evaluate(() => HOST.collab.hideOthers(true));
    await H.evaluate(() => HOST.collab.hideOthers(false));
    await A.evaluate(() => HOST.collab.add('studio', { x: -1.8, z: 2.6, yaw: Math.PI }));
    await until(H, () => HOST.collab.stations().some(s => s.story === 'studio'), null, 5000);
    const SS = (await H.evaluate(() => HOST.collab.stations())).find(s => s.story === 'studio');
    const inS = !!SS && await walk(H, SS, 'studio', 0, 150000);
    await frames(H, 600);
    const v0 = await rings(true), on1 = await H.evaluate(() => HOST.collab.hideOthers(true));
    const v1 = await ringsWhen(r => r.every(x => !x.icon && !x.card), 8000, true), pt1 = await pointAt(H, await H.evaluate(id => HOST.collab.overlay().rings.get(id).ball.getWorldPosition(new THREE.Vector3()).toArray(), S1.id));
    await H.evaluate(() => window.__xr.ctrl(0, null));
    // (a circle hidden is not walked into: none of them is seen; the lobby, where the headsets charge, still is, which ends
    // the station, and the hiding lapses with it; then circles are walked into again)
    await goRoom(H, S1.x, 1.6, S1.z, 0);
    await frames(H, 2500);
    const wH3 = await where(), onH3 = await H.evaluate(() => HOST.collab.hideOthers());
    await goRoom(H, SL.x, 1.6, SL.z, 0);
    await frames(H, 2500);
    const wH4 = await where(), off3 = await H.evaluate(() => HOST.collab.hideOthers()), v2 = await ringsWhen(r => r.some(x => x.icon), 8000, true);
    const in3 = await walk(H, S1, K1, 0, 150000);
    check('ask: hideOthers at a studio station hides every other station\'s ring, card and icon (nothing of them pointable); refused elsewhere; a hidden circle is not walked into, the lobby still is, and the hiding lapses with the station; then circles are walked into again',
      no0 === false && inS && v0.some(r => r.icon) && on1 === true && v1.length === 3 && v1.every(r => !r.ring && !r.hit && !r.icon && !r.card) && pt1 === '' &&
      wH3.mine === SS.id && onH3 === true && !wH4.mine && off3 === false && v2.some(r => r.icon) && in3,
      JSON.stringify({ no0, inS, v0, on1, v1, pt1, wH3, onH3, wH4, off3, v2, in3 }));
  } finally {
    await H.evaluate(() => window.__xr.end()).catch(() => {});
    for (const p of [A, H]) await p.context().close();
  }
}

// ---- the narration in headsets and the welcome (narrationRound; --narration runs only it, also in the main run after your
// menu shown to your circle): a room of its own with a story circle and Back to the lobby, a page and two pretend headsets
// lined up through the shared space, a few minutes. The narration (v124): off by default in a headset session (the room
// never wrote it; the page's own on), the session's mute off; the page's Shared dialog's Narration pressed twice (Off for
// all, then On for all, each moving look's vg on) reaching both headsets; one headset's own Off (its menu's Narration row)
// an override for this room only, kept on the headset and never written to the room, the other headset staying on; the
// other's story panel button (its Sound button, the narration in a session) the same; Off for all and On for all from a
// headset's menu (the Circles tab) dropping both overrides; an override surviving a new session; walking into Back to the
// lobby dropping it; leaving the room dropping it. The welcome (Getting around): not before lining up, then once, asked
// first (the trigger's words, the controllers' buttons), closed early by the menu and not again that session; walked into
// (the walk's words); not while the room setup guide shows, then after; tracked hands (the pinch's words, no grip);
// outside a room 2.5 s in, never in camera mode (a stub of the other lane's HOST.collab.cameraMode)
async function narrationRound() {
  const K1 = 'qubits';
  const A = await open('#stories');
  await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(A, () => HOST.collab.status === 'open', null, 10000);
  const rc = await A.evaluate(() => HOST.collab.code);
  await A.evaluate(k => { HOST.collab.add(k, { x: 0, z: 0, yaw: 0 }); HOST.collab.add('lobby', { x: -1.8, z: -2.6, yaw: 0.3 }); }, K1);
  await until(A, () => HOST.collab.stations().length === 2 && !HOST.collab.internals().pending.size, null, 5000);
  const H1 = await open('#s=' + rc, { width: 320, height: 200 }), H2 = await open('#s=' + rc, { width: 320, height: 200 });
  for (const H of [H1, H2]) { await until(H, () => HOST.collab.status === 'open' && HOST.collab.stations().length === 2, null, 20000); await ready(H, 'airports'); }
  const aId = await A.evaluate(() => HOST.collab.id), h1 = await H1.evaluate(() => HOST.collab.id), h2 = await H2.evaluate(() => HOST.collab.id);
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);
  const xrOpts = { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [-6, 1.6, 6, 0] };
  // the shared space's id comes: lined up through it (the room's frame for U1)
  const lineUpH = async H => {
    await H.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'U1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
    for (let k = 0; k < 24 && !(await H.evaluate(() => HOST.room.aligned)); k++) await frames(H, 250);
    return H.evaluate(() => HOST.room.aligned);
  };
  // a new session (the last one ended), lined up unless o.later; o.hands: the left input source a tracked hand
  const session = async (H, o = {}) => {
    await H.evaluate(() => { if (window.__xr && HOST.session) window.__xr.end(); });
    await H.evaluate(installXR, Object.assign({}, xrOpts, o));
    if (o.hands) await H.evaluate(() => { window.__xr.session.inputSources.push({ handedness: 'left', targetRayMode: 'tracked-pointer', gamepad: null, targetRaySpace: {}, hand: new Map([['wrist', {}]]) }); });
    await H.evaluate(() => { HOST.room.sharedAlign(true); window.__xr.begin(); });
    await frames(H, 300);
    return o.later ? false : lineUpH(H);
  };
  // the narration as a headset has it: [voice(), why, its override kept on it (xrNarrRoom), the session's mute, the story panel's label]
  const NV = () => { const o = localStorage.getItem('xrNarrRoom'); return { on: HOST.xr.voice(), why: HOST.xr.voiceWhy(), ovr: o && JSON.parse(o), muted: HOST.audio.muted,
    label: HOST.cur.peek('AUD ? AUD.label() : ""'), look: HOST.collab.look() && { voice: HOST.collab.look().voice, vg: HOST.collab.look().vg, vset: HOST.collab.look().vset } }; };
  const nv = H => H.evaluate(NV);
  const voiceIs = (H, on, why) => until(H, ([on, why]) => { window.__xr.step(); return HOST.xr.voice() === on && (!why || HOST.xr.voiceWhy() === why); }, [on, why], 8000);
  // a press of a button in the headset's menu (whichever tab has it)
  const menuTap = (H, id) => H.evaluate(async id => {
    const X = window.__xr; HOST.collab.panelOpen(true); X.step(); X.step();
    const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn();
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(res => setTimeout(res, 20)); }
    HOST.collab.panelOpen(false); X.step();
    return !!(r && r.fn);
  }, id);
  // the page's Shared dialog's Narration button pressed: [its text before, after]
  const dlgVoice = () => A.evaluate(async () => {
    HOST.collab.dialog(true); await new Promise(r => setTimeout(r, 200));
    const b = () => document.querySelector('[data-sh="voice"]'), was = b().textContent;
    b().click(); await new Promise(r => setTimeout(r, 300));
    const now = b().textContent; HOST.collab.dialog(false);
    return [was, now];
  });
  const lookOfRoom = async () => { const e = (await roomInfo(rc)).keys.look; return e ? { v: e.v, seq: e.seq, by: e.by } : null; };
  const WEL = H => H.evaluate(() => { window.__xr.step(); const w = HOST.collab.welcome(), O = HOST.collab.overlay();
    const L = window.__collabLog, i = L.map(e => e.ev).lastIndexOf('test welcome'), menuNote = L.slice(i + 1).some(e => e.ev === 'notice' && e.title === 'The menu');
    return Object.assign(w, { vis: !!(O.wel && O.wel.mesh.visible), hit: !!(O.wel && O.hit.includes(O.wel.mesh)), lu: HOST.collab.guide().status.k, menuNote }); });
  const welWhen = async (H, want, ms) => { const t0 = Date.now(); let w; do { await frames(H, 250); w = await WEL(H); } while (!want(w) && Date.now() - t0 < ms); return w; };
  try {
    // ---- the narration
    const al = (await session(H1)) && (await session(H2));
    const n1 = await nv(H1), n2 = await nv(H2), pa = await A.evaluate(() => [HOST.xr.voice(), HOST.xr.voiceWhy(), HOST.audio.muted]);
    check('narration: in a headset session it is off by default (the room never wrote it), the session\'s mute off, the story panel\'s button saying Narration off; the page\'s own on, its mute on',
      al && [n1, n2].every(n => n.on === false && n.why === 'own' && !n.ovr && n.muted === false && n.label === 'Narration off' && n.look && !n.look.vset) && pa.join() === 'true,own,true', JSON.stringify({ n1, n2, pa }));
    // the page's dialog: Off for all, then On for all (each a write of look with vg moved on), both headsets following
    const d1 = await dlgVoice(), l1 = await lookOfRoom(), off1 = await voiceIs(H1, false, 'room') && await voiceIs(H2, false, 'room');
    const d2 = await dlgVoice(), l2 = await lookOfRoom(), on2 = await voiceIs(H1, true, 'room') && await voiceIs(H2, true, 'room');
    check('narration: the page\'s Shared dialog sets it for everyone (Off for all, then On for all, look\'s vg moving on each time), both headsets following',
      d1.join() === 'Narration: on,Narration: off' && d2.join() === 'Narration: off,Narration: on' && !!l1 && l1.v.voice === false && l1.v.vg === 1 && !!l2 && l2.v.voice === true && l2.v.vg === 2 &&
      l2.by === aId && off1 && on2, JSON.stringify({ d1, d2, l1, l2, off1, on2, H1: await nv(H1) }));
    // one headset's own Off (its menu's Narration row): an override for this room, kept on it, never written to the room
    const q0 = (await roomInfo(rc)).seq, lk0 = await lookOfRoom();
    const t1 = await menuTap(H1, 'voice'), own1 = await voiceIs(H1, false, 'mine');
    await frames(H2, 600);
    const o1 = await nv(H1), o2 = await nv(H2), lk1 = await lookOfRoom();
    const wrote1 = Object.entries((await roomInfo(rc)).keys).filter(([, e]) => e.seq > q0 && e.by === h1).map(([k]) => k);
    check('narration: one headset\'s own Off (its menu) is an override for this room ({ code, vg, on } kept on the headset), the other headset staying on, nothing written to the room',
      t1 && own1 && !!o1.ovr && o1.ovr.code === rc && o1.ovr.vg === 2 && o1.ovr.on === false && o2.on === true && o2.why === 'room' && !!lk1 && lk1.seq === lk0.seq && !wrote1.length,
      JSON.stringify({ t1, o1, o2, lk0, lk1, wrote1 }));
    // the other headset's story panel button (its Sound button: the narration in a session) likewise
    const p2 = await H2.evaluate(() => { HOST.cur.peek('audioToggle()'); window.__xr.step(); window.__xr.step(); return null; });
    const own2 = await voiceIs(H2, false, 'mine'), o2b = await nv(H2), lk2 = await lookOfRoom();
    check('narration: the story panel\'s button in a session turns this headset\'s narration off (an override; its label Narration off), nothing written to the room',
      p2 === null && own2 && !!o2b.ovr && o2b.ovr.on === false && o2b.label === 'Narration off' && lk2.seq === lk0.seq, JSON.stringify({ o2b, lk2 }));
    // Off for all, then On for all, from a headset's menu (the Circles tab): every override goes, both follow the room
    const m3 = await menuTap(H2, 'voiceall:off'), off3 = await voiceIs(H1, false, 'room') && await voiceIs(H2, false, 'room'), l3 = await lookOfRoom();
    const m4 = await menuTap(H2, 'voiceall:on'), on4 = await voiceIs(H1, true, 'room') && await voiceIs(H2, true, 'room'), l4 = await lookOfRoom(), o4 = [await nv(H1), await nv(H2)];
    check('narration: Off for all and On for all from a headset\'s menu (Circles) set every headset, the overrides dropped (vg moving on)',
      m3 && off3 && m4 && on4 && l3.v.voice === false && l3.v.vg === 3 && l4.v.voice === true && l4.v.vg === 4 && l4.by === h2 && o4.every(n => !n.ovr), JSON.stringify({ m3, m4, l3, l4, o4 }));
    // an override survives a new session in the same room
    await menuTap(H1, 'voice');
    const pre = await voiceIs(H1, false, 'mine');
    await H1.evaluate(() => window.__xr.end());
    const pg = await nv(H1);   // (between sessions: the page's, the room's)
    const re = await session(H1), kept = await voiceIs(H1, false, 'mine'), o5 = await nv(H1);
    check('narration: an override survives a new session in the same room (between them the page follows the room\'s)',
      pre && re && kept && pg.on === true && pg.why === 'room' && !!o5.ovr && o5.ovr.vg === 4, JSON.stringify({ pg, o5 }));
    // walking into Back to the lobby drops it: the room's again
    const SL = (await A.evaluate(() => HOST.collab.stations())).find(s => s.kind === 'lobby');
    await goRoom(H1, SL.x, 1.6, SL.z, 0);
    await frames(H1, 2500);
    const lob = await voiceIs(H1, true, 'room'), o6 = await nv(H1), dropped = await H1.evaluate(() => window.__collabLog.some(e => e.ev === 'narration own dropped' && e.why === 'lobby'));
    check('narration: walking into Back to the lobby drops this headset\'s own (the room\'s again)', lob && !o6.ovr && dropped, JSON.stringify({ o6, dropped }));
    // nothing of an override ever written to the room: look only from the page and H2's room-wide presses
    const wroteAll = Object.entries((await roomInfo(rc)).keys).filter(([k, e]) => e.by === h1 && /look|voice|narr/.test(k)).map(([k]) => k);
    check('narration: no override was written to the room (the headset with its own wrote no look)', !wroteAll.length, JSON.stringify(wroteAll));
    // ---- the welcome (Getting around), on H2: asked first, not before lining up, then once
    await A.evaluate(() => HOST.collab.setAsk(true));
    await until(H2, () => HOST.collab.askFirst(), null, 8000);
    await H2.evaluate(() => window.__collabLog.push({ ev: 'test welcome' }));
    await session(H2, { welcome: true, later: true });
    const w0 = await welWhen(H2, w => w.done, 3500);
    const lined = await lineUpH(H2), w1 = await welWhen(H2, w => w.shown, 10000);
    check('welcome: not before this headset is lined up; then once, asked first: the trigger\'s words and the controllers\' buttons, in front of it, not pointable, no notice The menu',
      !w0.done && w0.lu !== 'ok' && lined && w1.shown && w1.vis && !w1.hit && w1.lu === 'ok' && w1.mode === 'ask' && !w1.hands &&
      /Point at a circle's card or icon and press the trigger to go in\./.test(w1.text) && /Trigger \(index finger\): click\./.test(w1.text) &&
      /Grip \(middle finger\): grab and move things\./.test(w1.text) && /Click a stick: the menu\./.test(w1.text) && !w1.menuNote, JSON.stringify({ w0, w1 }));
    // the menu opening closes it early, and it does not come back this session
    await H2.evaluate(() => { HOST.collab.panelOpen(true); window.__xr.step(); window.__xr.step(); });
    const w2 = await WEL(H2);
    await H2.evaluate(() => HOST.collab.panelOpen(false));
    const w3 = await welWhen(H2, w => w.shown, 3000);
    check('welcome: the menu opening closes it early, and it does not come again in the same session', !w2.shown && !w2.vis && !w3.shown && w3.at === w1.at, JSON.stringify({ w2, w3 }));
    // walked into: the walk's words
    await A.evaluate(() => HOST.collab.setAsk(false));
    await until(H2, () => !HOST.collab.askFirst(), null, 8000);
    await session(H2, { welcome: true });
    const w4 = await welWhen(H2, w => w.shown, 10000);
    check('welcome: a new session shows it again; with the circles walked into, the walk\'s words', w4.shown && w4.mode === 'walk' && /Walk into a circle to go in\./.test(w4.text) && w4.at > 0, JSON.stringify(w4));
    // not while the room setup guide shows (the menu with it), then once it is closed
    await session(H2, { welcome: true, later: true });
    await H2.evaluate(() => HOST.collab.guideOpen(1));
    await lineUpH(H2);
    const w5 = await welWhen(H2, w => w.done, 3500), g5 = await H2.evaluate(() => HOST.collab.guide().open);
    await H2.evaluate(() => HOST.collab.panelOpen(false));
    const w6 = await welWhen(H2, w => w.shown, 8000);
    check('welcome: not while the room setup guide shows; once it is closed, it shows', g5 && !w5.done && w6.shown, JSON.stringify({ g5, w5, w6 }));
    // tracked hands (the left input source a hand), asked first: the pinch's words, no grip
    await A.evaluate(() => HOST.collab.setAsk(true));
    await until(H2, () => HOST.collab.askFirst(), null, 8000);
    await session(H2, { welcome: true, hands: true });
    const w7 = await welWhen(H2, w => w.shown, 10000);
    check('welcome: with tracked hands, the pinch\'s words (a pinch clicks, two of the left hand open the menu; nothing grabs)', w7.shown && w7.hands && w7.mode === 'ask' &&
      /pinch to go in\./.test(w7.text) && /Pinch: click\./.test(w7.text) && /Pinch twice with your left hand: the menu\./.test(w7.text) && !/Grip|Trigger/.test(w7.text), JSON.stringify(w7));
    // ---- leaving the room drops an override; outside a room the welcome comes 2.5 s in, never in camera mode
    await menuTap(H1, 'voice');
    const pre8 = await voiceIs(H1, false, 'mine');
    await H1.evaluate(() => HOST.collab.leave());
    const o8 = await nv(H1);
    check('narration: leaving the room drops this headset\'s own (outside a room the headset\'s own: off, never turned on here)', pre8 && !o8.ovr && o8.on === false && o8.why === 'own', JSON.stringify(o8));
    await H1.evaluate(() => { HOST.collab.cameraMode = () => true; });
    await session(H1, { welcome: true, later: true });
    const w8 = await welWhen(H1, w => w.done, 4000);
    await H1.evaluate(() => { delete HOST.collab.cameraMode; });
    const w9 = await welWhen(H1, w => w.shown, 4000);
    check('welcome: outside a room it shows a moment into the session (no circles\' line), never in camera mode', !w8.done && w9.shown && w9.mode === '' && /Getting around Trigger/.test(w9.text), JSON.stringify({ w8, w9 }));
  } finally {
    for (const H of [H1, H2]) await H.evaluate(() => { if (HOST.session) window.__xr.end(); }).catch(() => {});
    for (const p of [A, H1, H2]) await p.context().close();
  }
}

// ---- moving with the sticks for a VR headset elsewhere in a room (walkRound, v128; --walk runs only it, also in the main
// run after the narration round; the owner, 9 November 2026: "should also work in shared rooms everywhere when the user is
// in vr and not in the same room"): a room of its own with an airports circle 3 m ahead of where the headset joins (its own
// floor is the room's, centred where it stands, facing -z) and Back to the lobby 3.5 m beyond it, a page and a pretend VR
// headset that answers Somewhere else, a minute or two. Its frames go through the session's own requestAnimationFrame, so
// the shell's hook (index.html) moves three.js's space as on a headset (installXR's walk: an offset space, controllers with
// sticks). It applies there (walkWhy ''); two stick clicks turn it on, saying the others see you move; the left stick moves
// it (HOST.xr.travel) and its head in the room by as far, the page hearing the same in its presence (smoothed, within a few
// cm once at rest); the room's frame (its own floor) and the circles drawn where they were in three.js's space; no jump of
// the origin and no notice to calibrate, also through a 30 degree flick (its presence's heading turning 30 degrees); with
// the circles walked into, the sticks take it into the airports circle (its station); with the circles asked first, on into
// Back to the lobby (its station ends); a reset of the floor with its transform (a recentre) leaving it where it was in the
// room; a second pretend headset in AR gets no travel from its sticks; the first answering In this room goes back to no
// travel, its sticks moving nothing
async function walkRound() {
  const K = 'airports';
  const A = await open('#stories');
  await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(A, () => HOST.collab.status === 'open', null, 10000);
  const rc = await A.evaluate(() => HOST.collab.code);
  await A.evaluate(k => { HOST.collab.add(k, { x: 0, z: -3, yaw: 0 }); HOST.collab.add('lobby', { x: 0, z: -6.5, yaw: 0 }); }, K);
  await until(A, () => HOST.collab.stations().length === 2 && !HOST.collab.internals().pending.size, null, 5000);
  const [S1, SL] = await A.evaluate(k => [HOST.collab.stations().find(s => s.story === k), HOST.collab.stations().find(s => s.kind === 'lobby')], K);
  const H = await open('#s=' + rc, { width: 320, height: 200 });
  let H2 = null;   // (the headset in AR: opened only for its check, so one page fewer draws in software meanwhile)
  await until(H, () => HOST.collab.status === 'open' && HOST.collab.stations().length === 2, null, 20000); await ready(H, K);
  const hid = await H.evaluate(() => HOST.collab.id);
  // what the headset knows of itself: the travel, why it applies or not, its head and heading in the room (R.hr, R.hyaw),
  // the room's frame, its live station, the lobby circle's icon in three.js's space, the notices and log lines about
  // jumps and calibrating
  const ME = () => {
    const R = HOST.room.internals(), o = HOST.collab.overlay().rings.get(HOST.collab.stations().find(s => s.kind === 'lobby').id);
    if (o) o.g.updateWorldMatrix(true, false);
    const L = window.__collabLog;
    return { travel: HOST.xr.travel(), why: HOST.xr.walkWhy(), walking: HOST.xr.walking(), hr: R.hr.toArray(), hyaw: R.hyaw, src: HOST.room.src,
      frame: HOST.room.frame && { o: HOST.room.frame.o.slice(), x: HOST.room.frame.x.slice() }, live: HOST.collab.live() ? HOST.collab.live().id : '',
      lobby: o ? o.g.getWorldPosition(new THREE.Vector3()).toArray() : null, jumps: L.filter(e => e.ev === 'origin moved').length,
      calib: L.filter(e => e.ev === 'notice' && /Calibrate/.test(e.title || '')).length, state: HOST.room.state };
  };
  const me = P => P.evaluate(ME);
  // the headset as the page hears it: its head in room coordinates, smoothed from its presence, and the station it says
  // (age: ms since its last presence came; raw: whether that one had a head). Read while the headset goes on drawing frames
  // (ms of them): a presence older than 2 s is no one's head, and a busy machine may let the page take that long
  const heard = ms => Promise.all([frames(H, ms || 600), sleep((ms || 600) * 0.6).then(() => A.evaluate(id => { const b = HOST.collab.body(id), P = HOST.collab.people().get(id);
    return { head: b && b.head, st: P ? P.st : null, age: P ? Math.round(performance.now() - P.at) : null, raw: !!(P && P.head) }; }, hid))]).then(r => r[1]);
  // a stick pushed for ms of frames, then let go and a few frames more
  const push = async (P, hand, x, y, ms) => { await P.evaluate(([h, x, y]) => window.__xr.stick(h, x, y), [hand, x, y]); await frames(P, ms); await P.evaluate(h => window.__xr.stick(h, 0, 0), hand); await frames(P, 100); };
  // the left stick held forward until its head is past z in the room (or 40 s: a frame's step is at most 0.1 s of moving,
  // and a busy machine draws a pretend headset's frames far apart)
  const forwardTo = (P, z) => P.evaluate(async z => {
    const X = window.__xr, R = HOST.room.internals(), t0 = performance.now();
    X.stick('L', 0, -1);
    while (R.hr.z > z && performance.now() - t0 < 40000) { X.step(); await new Promise(r => setTimeout(r, 16)); }
    X.stick('L', 0, 0); X.step();
    return R.hr.z;
  }, z);
  // frames until its live station is id ('' none), up to 15 s (the circle's second of standing there)
  const liveIs = (P, id) => until(P, id => { window.__xr.step(); const L = HOST.collab.live(); return (L ? L.id : '') === id; }, id, 15000);
  // a stick clicked twice (two presses within 0.4 s, a frame each), then the last notice
  const twice = P => P.evaluate(() => { const X = window.__xr, b = X.L.gamepad.buttons[3];
    for (let k = 0; k < 2; k++) { b.pressed = true; X.step(); b.pressed = false; X.step(); }
    const n = HOST.collab.notes().slice(-1)[0] || {}; return [n.title || '', n.text || ''].join(': '); });
  const xz = v => [v[0], v[2]], d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  try {
    // ---- a VR headset elsewhere: its own floor, the room's circles round it
    await H.evaluate(installXR, { mode: 'immersive-vr', features: ['local-floor', 'anchors'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [0.3, 1.7, -0.2, 0.6], walk: true });
    await H.evaluate(() => { HOST.collab.menuIdle(400); window.__xr.begin(); HOST.collab.setHere(false); });   // (Somewhere else)
    await frames(H, 600);
    await H.evaluate(() => { HOST.collab.panelOpen(false); HOST.collab.menuIdle(20000); });
    const m0 = await me(H), w0 = await H.evaluate(() => [HOST.collab.here(), HOST.xr.walk()]);
    const n0 = await twice(H), on0 = await H.evaluate(() => HOST.xr.walk());
    const row0 = await H.evaluate(() => { HOST.collab.panelOpen(true); HOST.collab.menuTab('settings'); window.__xr.step(); const r = HOST.collab.menuFind('walk'); HOST.collab.panelOpen(false); return r ? (r.fn ? 'on' : 'greyed') : 'none'; });
    check('walk: a VR headset elsewhere in a room (Somewhere else) may move with the sticks: walkWhy \'\', no travel yet, its own floor; two clicks turn it on, saying the others see it move; the menu\'s row pressable',
      m0.src === 'own' && w0[0] === false && !w0[1] && m0.why === '' && !m0.travel.space && on0 && n0 === 'Moving with the sticks: on: Left stick: move. Right stick: turn. The others see you move. Click a stick twice to stop.' && row0 === 'on',
      JSON.stringify({ m0, w0, n0, on0, row0 }));
    // ---- the left stick: the travel, its head in the room and the page hearing it, by as far; the circles stay put
    const h0 = await heard();
    await push(H, 'L', 0, -1, 700);
    const h1 = await heard(800), m1 = await me(H);
    const moved = Math.hypot(m1.travel.x - m0.travel.x, m1.travel.z - m0.travel.z), mine = d2(xz(m1.hr), xz(m0.hr)), theirs = h0.head && h1.head ? d2([h1.head[0], h1.head[2]], [h0.head[0], h0.head[2]]) : -1;
    check('walk: the left stick moves it (HOST.xr.travel) and its head in the room by as far, towards -z where it faces; the page hears the same in its presence (smoothed, within a few cm once at rest)',
      m1.walking && moved > 0.4 && Math.abs(mine - moved) < 0.01 && m1.hr[2] < m0.hr[2] - 0.4 && Math.abs(theirs - moved) < 0.05 && d2([h1.head[0], h1.head[2]], xz(m1.hr)) < 0.05,
      JSON.stringify({ moved, mine, theirs, hr: [m0.hr, m1.hr], heard: [h0, h1] }));
    check('walk: the room\'s frame (its own floor) and the circles stay where they were in three.js\'s space while it moves; no jump of the origin, no notice to calibrate',
      m1.src === 'own' && near(m1.frame.o, m0.frame.o, 1e-9) && near(m1.frame.x, m0.frame.x, 1e-9) && !!m1.lobby && dist(m1.lobby, m0.lobby) < 1e-6 && !m1.jumps && !m1.calib,
      JSON.stringify({ frame: [m0.frame, m1.frame], lobby: [m0.lobby, m1.lobby], jumps: m1.jumps, calib: m1.calib }));
    // ---- a 30 degree flick right and back: its heading in the room and in its presence, no jump
    await push(H, 'R', 0.9, 0, 120);
    const m2 = await me(H), h2 = await heard(800), yawOf = q => { const f = new Array(3); const [x, y, z, w] = q.slice(3); f[0] = -2 * (x * z + w * y); f[2] = -(1 - 2 * (x * x + y * y)); return Math.atan2(-f[0], -f[2]); };
    const turn = angle(m2.hyaw, m1.hyaw), hTurn = h1.head && h2.head ? angle(yawOf(h2.head), yawOf(h1.head)) : -1;
    await push(H, 'R', -0.9, 0, 120);
    const m3 = await me(H);
    check('walk: a flick of the right stick turns it 30 degrees about its head (in the room, and in what the page hears), no jump of the origin, no notice to calibrate, the room\'s frame unchanged',
      Math.abs(turn - Math.PI / 6) < 0.01 && Math.abs(hTurn - Math.PI / 6) < 0.05 && d2(xz(m2.hr), xz(m1.hr)) < 0.01 && angle(m3.hyaw, m1.hyaw) < 0.01 && !m3.jumps && !m3.calib &&
      near(m3.frame.o, m0.frame.o, 1e-9), JSON.stringify({ turn, hTurn, hr: [m1.hr, m2.hr], hyaw: [m1.hyaw, m2.hyaw, m3.hyaw], jumps: m3.jumps, calib: m3.calib, heard: [h1, h2] }));
    // ---- walked into: the sticks take it into the airports circle (its station, the page hearing it there)
    await A.evaluate(() => HOST.collab.setAsk(false));
    await until(H, () => { window.__xr.step(); return !HOST.collab.askFirst(); }, null, 8000);
    const z1 = await forwardTo(H, S1.z + 0.3), in4 = await liveIs(H, S1.id);
    // (the page asked while the headset goes on drawing frames, so its presence keeps coming)
    const st4 = (await Promise.all([frames(H, 2500), until(A, ([id, s]) => { const P = HOST.collab.people().get(id); return !!P && P.st === s; }, [hid, S1.id], 2400)]))[1];
    const m4 = await me(H);
    check('walk: with the circles walked into, the sticks take it into the airports circle: its station (the page hearing it there), the room\'s frame unchanged',
      m4.live === S1.id && st4 && d2(xz(m4.hr), [S1.x, S1.z]) < 1.1 && near(m4.frame.o, m0.frame.o, 1e-9) && !m4.jumps && !m4.calib, JSON.stringify({ z1, in4, m4, st4 }));
    // ---- asked first: on into Back to the lobby (its station ends)
    await A.evaluate(() => HOST.collab.setAsk(true));
    await until(H, () => { window.__xr.step(); return HOST.collab.askFirst(); }, null, 8000);
    const z2 = await forwardTo(H, SL.z + 0.3), out5 = await liveIs(H, '');
    const m5 = await me(H);
    check('walk: with the circles asked first, the sticks take it on into Back to the lobby: its station ends', m5.live === '' && d2(xz(m5.hr), [SL.x, SL.z]) < 1.1 && !m5.jumps && !m5.calib,
      JSON.stringify({ z2, out5, m5, log: await H.evaluate(() => window.__collabLog.filter(e => /lobby|station|zone/.test(e.ev)).slice(-6)) }));
    // ---- a recentre (the floor's reset with its transform): it stays where it was in the room
    const m6a = await me(H);
    // (the origins of local and local-floor both moved by G in the room, the head where it was; the reset as Quest Browser
    // sends it for local-floor: old coordinates to new)
    await H.evaluate(() => {
      const X = window.__xr, G = new THREE.Matrix4().compose(new THREE.Vector3(0.7, 0, -0.4), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1.1), new THREE.Vector3(1, 1, 1));
      const old = X.W.floor.clone();
      X.W.floor = G.clone().multiply(X.W.floor); X.W.local = G.clone().multiply(X.W.local);
      const nfo = X.W.floor.clone().invert().multiply(old);
      for (const fn of X.resets['local-floor'] || []) fn({ transform: { matrix: Float32Array.from(nfo.elements), inverse: { matrix: Float32Array.from(nfo.clone().invert().elements) } } });
    });
    await frames(H, 300);
    const m6 = await me(H);
    check('walk: a reset of the floor with its transform (a recentre) leaves it where it was in the room (the travel moved with the room\'s frame)',
      d2(xz(m6.hr), xz(m6a.hr)) < 0.01 && angle(m6.hyaw, m6a.hyaw) < 0.01 && m6.src === 'own' && !m6.calib, JSON.stringify({ before: m6a.hr, after: m6.hr, hyaw: [m6a.hyaw, m6.hyaw], travel: [m6a.travel, m6.travel] }));
    // ---- a second headset in the room with the others (AR): no travel from its sticks
    H2 = await open('#s=' + rc, { width: 320, height: 200 });
    await until(H2, () => HOST.collab.status === 'open' && HOST.collab.stations().length === 2, null, 20000); await ready(H2, K);
    await H2.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [-6, 1.6, 6, 0], walk: true });
    await H2.evaluate(() => { window.__xr.begin(); HOST.xr.setWalk(true); });
    await frames(H2, 300);
    await push(H2, 'L', 0, -1, 500);
    await push(H2, 'R', 0.9, 0, 120);
    const a2 = await H2.evaluate(() => [HOST.xr.walkWhy(), HOST.xr.walking(), HOST.xr.travel(), HOST.collab.here()]);
    check('walk: a headset in AR (in the room with the others) gets no travel from its sticks (walkWhy ar)', a2[0] === 'ar' && !a2[1] && !a2[2].space && !a2[2].x && !a2[2].z && !a2[2].yaw && a2[3] === true, JSON.stringify(a2));
    // ---- the first answering In this room: back to no travel, its sticks moving nothing, the row greyed with its words
    await H.evaluate(() => HOST.collab.setHere(true));
    await frames(H, 300);
    const m7 = await me(H);
    await push(H, 'L', 0, -1, 400);
    const m8 = await me(H), n8 = await twice(H);
    const row8 = await H.evaluate(() => { HOST.collab.panelOpen(true); HOST.collab.menuTab('settings'); window.__xr.step(); const r = HOST.collab.menuFind('walk'); HOST.collab.panelOpen(false); return r ? (r.fn ? 'on' : 'greyed') : 'none'; });
    check('walk: the headset answering In this room goes back to no travel, its sticks move nothing, two clicks say why, the menu\'s row greyed',
      m7.why === 'room' && !m7.walking && !m7.travel.space && !m7.travel.x && !m7.travel.z && !m7.travel.yaw && !m8.travel.space && !m8.travel.x && !m8.travel.z &&
      n8 === 'Moving with the sticks: Not while you are in the room with the others: there you walk for real.' && row8 === 'none', JSON.stringify({ m7: m7.travel, m8: m8.travel, why: m7.why, n8, row8 }));
  } finally {
    for (const P of [H, H2].filter(Boolean)) await P.evaluate(() => { if (HOST.session) window.__xr.end(); }).catch(() => {});
    for (const P of [A, H, H2].filter(Boolean)) await P.context().close().catch(() => {});
  }
}

// ---- your menu shown to your circle (menusRound; --menus runs only it, also in the main run after the circles asked
// first): a room of its own with two story circles, a page and three pretend headsets, A and B at one circle and C at the
// other, a few minutes. Off by default: A's menu open sends nothing. A turns My menu: my circle on in its menu (Settings):
// B draws a plane where A's menu floats (its top edge's middle, its turn and width, within 1 cm and a degree) with a
// picture of A's menu (pixels not dark, the shape A's menu shows), in the room (depth-tested, under the story panels set
// on top and the menus), never pointable, A's name over it; C, at the other circle, draws nothing; the page's Shared
// dialog says A shows their menu.
// A's tabs pressed four times a second until 2 pictures have gone out (4 to 20 s): at most a picture every 1.5 s by A's
// clock, every effect under 48 KB, B taking every one; a ray moving over A's buttons for 4.5 s (only their light
// changing): a picture at most every 4 s by A's clock (one sooner at most, and only after a change of what the menu shows,
// its cver), under 24 KB a second sent; the Story tab's picture (its shape, the
// story's panels drawn in: lit below its top quarter); A's head turned away, its menu glides back in front: B's plane
// follows (at most 5 poses a second meanwhile) and ends where A's stands. A silent (a headset taken off): gone on B after
// 3 s with nothing closed (quiet, by B's log), back once A goes on. A closes its menu, B holding a copy fresh from frames
// both draw: gone on B as its closed comes (by B's log, within 2 s; a failure shows B's log of A's copy, a closed it
// ignored too, and A's own closed lines); opened again, back; the setting turned off (the same way): gone (closed), and
// nothing sent with the menu open; on again and A's session ends (the same way): gone (closed). (A pretend headset's frames run only between the round's steps, and
// slowly in software: B's copy goes 3 s after A's last sample, as on a headset taken off, so each step lets both run
// first; and a busy machine, as in the whole run, draws them seconds apart, so each change the round makes is seen by a
// frame of its own and each rate is measured on A's clock.) dir: pictures (menus-*.png)
async function menusRound(dir) {
  const K1 = PICK_STORY, K2 = HEADSET_STORY;
  const P = await open('#stories');
  await P.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(P, () => HOST.collab.status === 'open', null, 10000);
  const rc = await P.evaluate(() => HOST.collab.code);
  await P.evaluate(k => { HOST.collab.add(k[0], { x: 0, z: 0, yaw: 0 }); HOST.collab.add(k[1], { x: 4, z: -3, yaw: -0.3 }); }, [K1, K2]);
  await until(P, () => HOST.collab.stations().length === 2 && !HOST.collab.internals().pending.size, null, 5000);
  const pId = await P.evaluate(() => HOST.collab.id);
  await P.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', pId, Date.now() - 60000));
  await until(P, () => !HOST.collab.internals().pending.size, null, 3000);
  const sts = await P.evaluate(() => HOST.collab.stations()), S1 = sts.find(s => s.story === K1), S2 = sts.find(s => s.story === K2);
  const H = [];
  for (let i = 0; i < 3; i++) {
    const h = await open('#s=' + rc, { width: 320, height: 200 });
    await until(h, () => HOST.collab.status === 'open' && HOST.collab.stations().length === 2, null, 20000);
    await ready(h, 'airports');
    await h.evaluate(() => HOST.room.sharedAlign(true));
    await h.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [-6, 1.6, 6, 0] });
    await h.evaluate(() => window.__xr.begin());
    await frames(h, 400);
    await h.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'U1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
    await frames(h, 300);
    H.push(h);
  }
  const [A, B, C] = H, aId = await A.evaluate(() => HOST.collab.id);
  // frames on the headsets given while fn is looked for on page Q (or for ms), as the guide round's
  const run = (h, ms) => h.evaluate(async ms => { window.__go = true; const t0 = performance.now(); while (window.__go && performance.now() - t0 < ms) { window.__xr.step(); await new Promise(r => setTimeout(r, 16)); } }, ms);
  const runUntil = async (hs, Q, fn, arg, ms) => {
    const go = Promise.all(hs.map(h => run(h, ms))), ok = Q ? await until(Q, fn, arg, ms) : (await sleep(ms), true);
    await Promise.all(hs.map(h => h.evaluate(() => { window.__go = false; })));
    await go;
    return ok;
  };
  const sent = () => A.evaluate(() => HOST.collab.menuSent());
  const seen = h => h.evaluate(id => { window.__xr.step(); return HOST.collab.menus().find(m => m.id === id) || null; }, aId);
  // A's menu as it floats: its top edge's middle and its turn in the room, its width and height (m), the part shown (px)
  const aPose = () => A.evaluate(() => {
    const O = HOST.collab.overlay(), G = O.panelG, R = HOST.room.internals(), p = HOST.room.toRoom(G.position);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(R.mi)).multiply(G.quaternion);
    return { p: p.toArray(), q: q.toArray(), w: O.panel.mw * G.scale.x, h: O.panel.mw * O.panel.vis / O.panel.w * G.scale.x, vis: O.panel.vis, open: HOST.collab.menu };
  });
  // A's menu and B's copy, read while both draw frames (once B's copy is drawn, at most 6 s): between the round's steps the
  // pretend headsets draw none, and B lets A's copy go 3 s after its last sample, as for a headset taken off. On a busy
  // machine stopping the frames and reading A alone took that long, so a copy read after them was gone or being fetched
  const both = async () => {
    const go = Promise.all([A, B].map(h => run(h, 30000)));
    await until(B, id => { const m = HOST.collab.menus(false, false).find(x => x.id === id); return !!m && m.drawn; }, aId, 6000);
    const ap = await aPose(), bm = await B.evaluate(id => HOST.collab.menus().find(m => m.id === id) || null, aId);
    await Promise.all([A, B].map(h => h.evaluate(() => { window.__go = false; })));
    await go;
    return [ap, bm];
  };
  const qd = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) / (Math.hypot(...a) * Math.hypot(...b))));
  const press = id => A.evaluate(id => { const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn(); window.__xr.step(); return !!(r && r.fn); }, id);
  // why B let A's copy go last since B's time t (its log: 'closed' as A said, 'quiet' after MSH.gone without a sample), B's
  // time, and whether B holds A's copy drawn (no pixels read back: a poll that reads them waits on a busy machine's GPU)
  const goneWhy = t => B.evaluate(([id, t]) => (window.__collabLog.filter(e => e.ev === 'menu gone' && e.by === id && e.t >= t).pop() || {}).why || '', [aId, t]);
  const bNow = () => B.evaluate(() => Math.floor(performance.now()));
  // (for a failure's detail: B's log of A's copy since B's time bt, a closed it ignored too, and A's own closed lines since
  // A's time at: so a copy that stayed after A's closed is told from one that never heard it, and from a slow machine)
  const aNow = () => A.evaluate(() => Math.floor(performance.now()));
  const menuLog = async (bt, at) => ({
    b: await B.evaluate(([id, t]) => window.__collabLog.filter(e => (e.ev === 'menu gone' || e.ev === 'menu closed ignored') && e.by === id && e.t >= t), [aId, bt]),
    a: await A.evaluate(t => window.__collabLog.filter(e => e.ev === 'menu share' && e.closed !== undefined && e.t >= t), at) });
  const bGone = id => { window.__xr.step(); return !HOST.collab.menus(false, false).some(x => x.id === id && x.drawn); };
  // act on A while A and B draw frames, once B holds A's copy, its last sample under 1.5 s old (at most 10 s), and B's copy
  // gone after it (within ms): held, what act gave, gone, B's reason since and the log above. (Between the round's steps
  // the pretend headsets draw none, and B lets a copy go 3 s after its last sample, rightly, as for a headset taken off: on
  // a busy machine the reads before a step took that long, so the copy went quiet just before A's closed came, which B
  // then ignored, having no copy left to drop)
  const closeOn = async (act, ms) => {
    const go = Promise.all([A, B].map(h => run(h, 30000)));
    const held = await until(B, id => { const m = HOST.collab.menus(false, false).find(x => x.id === id); return !!m && m.drawn && m.age < 1500; }, aId, 10000);
    const bt = await bNow(), at = await aNow(), r = await A.evaluate(act);
    const gone = await until(B, bGone, aId, ms);
    await Promise.all([A, B].map(h => h.evaluate(() => { window.__go = false; })));
    await go;
    return { held, r, gone, why: await goneWhy(bt), log: await menuLog(bt, at) };
  };
  // B's picture of A's menu as it came (the PNG of its canvas), and what B sees of it from its head
  const fresh = ms => runUntil([A, B], B, id => { window.__xr.step(); const m = HOST.collab.menus().find(x => x.id === id); return !!m && m.drawn && m.lit > 0.02; }, aId, ms || 6000);
  const pics = async n => {
    if (!dir) return;
    await fresh();
    const u = await B.evaluate(id => (HOST.collab.menus(true).find(m => m.id === id) || {}).url, aId);
    if (u) fs.writeFileSync(path.join(dir, `menus-${n}-picture.png`), Buffer.from(u.split(',')[1], 'base64'));
    await headView(B, path.join(dir, `menus-${n}-seen.png`), 0.86, -0.12, [640, 400]);
  };
  try {
    check('menus: three pretend headsets align in a room of their own with two story circles', (await Promise.all(H.map(h => h.evaluate(() => HOST.room.aligned)))).every(Boolean) && !!S1 && !!S2);
    const inA = await walk(A, S1, K1, 0, 150000), inB = await walk(B, S1, K1, Math.PI, 150000), inC = await walk(C, S2, K2, 0, 150000);
    // B a step to A's side, facing where A's menu will float
    await goRoom(B, S1.x + 0.7, 1.6, S1.z - 0.2, 0.86);
    check('menus: A and B walk into one circle, C into the other', inA && inB && inC);
    // off by default: A's menu open sends nothing, and B draws nothing
    await A.evaluate(() => HOST.collab.menuIdle(600000));   // (unused for 20 s it would close by itself: not in this round)
    const off0 = await A.evaluate(() => [HOST.collab.menuShare(), localStorage.getItem('xrMenuShare')]);
    await A.evaluate(() => { HOST.collab.panelOpen(true); HOST.collab.menuTab('settings'); });
    await runUntil([A, B], null, null, null, 1500);
    const s0 = await sent(), b0 = await seen(B);
    check('menus: off by default (My menu: only me), nothing sent with the menu open and nothing drawn on B', off0[0] === false && off0[1] === null && s0.pics === 0 && s0.poses === 0 && !s0.st && !b0,
      JSON.stringify({ off0, s0, b0 }));
    // A turns it on in its menu: B draws a plane where A's menu floats, with A's picture
    const lab0 = await A.evaluate(() => { const r = HOST.collab.menuFind('menushare'); return r && HOST.collab.overlay().panel.regions.some(q => q.id === 'menushare') ? HOST.collab.menuTab() : ''; });
    const pr = await press('menushare');
    const drawn = await runUntil([A, B, C], B, id => { window.__xr.step(); const m = HOST.collab.menus().find(x => x.id === id); return !!m && m.drawn && m.lit > 0.02; }, aId, 15000);
    await runUntil([A, B], null, null, null, 600);
    const [ap, bm] = await both(), cm = await seen(C), s1 = await sent(), aName = await A.evaluate(() => HOST.collab.name);
    check('menus: My menu: my circle on (Settings), A\'s menu open: B draws it where it floats on A (its top edge\'s middle, its turn and width within 1 cm and a degree), the picture\'s shape A\'s menu\'s',
      lab0 === 'settings' && pr && drawn && !!bm && dist(bm.p, ap.p) < 0.01 && qd(bm.q, ap.q) < 0.0175 && Math.abs(bm.w - ap.w) < 0.01 && Math.abs(bm.h - ap.h) < 0.01 && Math.abs(bm.ih / bm.iw - ap.vis / 720) < 0.02,
      JSON.stringify({ lab0, pr, drawn, bm: bm && Object.assign({}, bm, { pose: undefined }), ap }));
    check('menus: B\'s picture is A\'s menu (its pixels not empty), in the room (depth-tested, under the story panels set on top and the menus), never pointable, A\'s name over it; A says it is on in its menu',
      !!bm && bm.lit > 0.02 && bm.depth === true && bm.order < 50 && bm.order > 49 && bm.gorder === 0 && !bm.hit && bm.name === aName && s1.on && s1.st === S1.id && s1.pics >= 1 &&
      await A.evaluate(() => (HOST.collab.menuFind('menushare') || {}).id === 'menushare'),
      JSON.stringify({ bm: bm && { lit: bm.lit, depth: bm.depth, order: bm.order, gorder: bm.gorder, hit: bm.hit, name: bm.name }, aName, s1 }));
    check('menus: C, at the other circle, draws none of it', !cm || !cm.drawn, JSON.stringify(cm));
    // the page's Shared dialog: A shows their menu
    const dl = await runUntil([A], P, () => { HOST.collab.dialog(true); return [...document.querySelectorAll('#shared .sh-people li')].some(li => /showing their menu/.test(li.textContent)); }, null, 8000);
    await P.evaluate(() => HOST.collab.dialog(false));
    check('menus: the page\'s Shared dialog says who shows their menu', dl);
    await pics(1);
    // A's menu changes four times a second (its tabs), each change seen by a frame of A's, for at least 4 s and until two
    // pictures have gone out since (at most 20 s): at most a picture every 1.5 s, each effect under 48 KB, B taking every
    // one (got: every picture B took, whatever became of its copy). (A makes its pictures in its frames, and a busy machine
    // draws the pretend headsets' frames seconds apart: in the whole run, with every earlier round's pages still drawing,
    // a fixed 4 s window saw one picture. So the window lasts until two, and the bounds go by A's own clock)
    await fresh();
    const n0 = (await sent()).pics, f0 = await A.evaluate(() => { window.__flipped = false; return performance.now(); });
    const flip = A.evaluate(async n0 => {
      const tabs = ['settings', 'circles', 'debug', 'settings'], t0 = performance.now();
      for (let k = 0; ; k++) {
        HOST.collab.menuTab(tabs[k % 4]); window.__xr.step();
        await new Promise(r => setTimeout(r, 250));
        const el = performance.now() - t0;
        if (el >= 20000 || (el >= 4000 && HOST.collab.menuSent().pics - n0 >= 2)) break;
      }
      HOST.collab.menuTab('settings'); window.__xr.step();
      window.__flipped = true;
    }, n0);
    await runUntil([A, B], A, () => window.__flipped, null, 30000);
    await flip;
    await runUntil([A, B], null, null, null, 1200);   // (the last tab's picture)
    const s2 = await sent(), fs2 = (await A.evaluate(() => performance.now()) - f0) / 1000, at = s2.at.filter(t => t >= f0), gaps = at.slice(1).map((t, k) => t - at[k]);
    // (B took every picture A sent since the setting went on, in all: a picture being made as the frames stopped may still
    // go out, so at least those counted and at most those sent by then)
    const took = await until(B, n => HOST.collab.menuSent().got >= n, s2.pics, 3000), g2 = await B.evaluate(() => HOST.collab.menuSent().got), s2b = await sent();
    check('menus: A\'s menu changing four times a second: at most a picture every 1.5 s (each 1,490 ms or more apart), every effect under 48 KB, B taking every one',
      s2.pics - n0 >= 2 && s2.pics - n0 <= fs2 / 1.5 + 1 && gaps.every(g => g >= 1490) && s2b.most < 48 * 1024 && took && g2 >= s2.pics && g2 <= s2b.pics,
      JSON.stringify({ pics: s2.pics - n0, all: s2.pics, after: s2b.pics, secs: fs2, gaps: gaps.map(Math.round), most: s2b.most, step: s2.step, took: g2 }));
    // a ray moving over A's buttons (Settings), a button every 300 ms for 4.5 s, a frame of A's right after each move (as a
    // headset's next frame sees it: the pretend headset's own frames come seconds apart on a busy machine, and a ray never
    // seen lit nothing): only their light changes, so at most one picture every 4 s (MSH.hovMs: each 3,990 ms or more
    // after the last, at most one per 4 s of A's own clock, which a busy machine stretches) and under 24 KB a second sent
    // (a picture every 500 ms was up to about 95 KB a second). A change of what the menu shows meanwhile (cver, which the
    // light of what is pointed at never moves: its clock's minute) may bring one picture 1.5 s after the last: one at most,
    // and only where the later picture shows a later cver than the one before it (menuSent's cv), so a picture made for
    // the light alone never hides behind another change. (Pictures made, by their numbers: a want's answer, the last one
    // sent again to someone who lacks it, is no new picture; its bytes count)
    await A.evaluate(() => HOST.collab.menuTab('settings'));
    const cur = await runUntil([A, B], A, () => HOST.collab.menuSent().cur, null, 15000);   // (the Settings tab's picture out first)
    const h0 = await sent(), hA = await A.evaluate(() => [performance.now(), HOST.collab.overlay().panel.cver]);
    const lit = A.evaluate(async () => {
      const X = window.__xr, V = THREE.Vector3, S = HOST.collab.overlay().panel, seen = new Set();
      const rs = S.regions.filter(r => r.id !== 'close' && !/^tab/.test(r.id) && r.y + r.h < S.vis).slice(0, 4);
      const H = S.mw * S.h / S.w;
      for (let k = 0; k < 15 && rs.length; k++) {
        const r = rs[k % rs.length], p = S.mesh.localToWorld(new V(((r.x + r.w / 2) / S.w - 0.5) * S.mw, (0.5 - (r.y + r.h / 2) / S.vis) * H, 0));
        const head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert()), o = head.clone().add(new V(0.1, -0.25, 0));
        X.aim(0, new THREE.Matrix4().compose(o, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), p.clone().sub(o).normalize()), new V(1, 1, 1)));
        X.step();
        if (S.hover) seen.add(S.hover);
        await new Promise(res => setTimeout(res, 300));
      }
      X.ctrl(0, null);
      return [...seen];
    });
    await runUntil([A, B], null, null, null, 4700);
    const hov = await lit, h1 = await sent(), hA1 = await A.evaluate(() => [performance.now(), HOST.collab.overlay().panel.cver]);
    // (each picture by its first sending: when it went and the cver it shows; the last one before the window first)
    const made = [...new Set(h1.ns.filter(n => n > h0.n))], one = (S, n) => { const i = S.ns.indexOf(n); return [S.at[i], S.cv[i]]; };
    const pk = [...(h0.ns.includes(h0.n) ? [one(h0, h0.n)] : []), ...made.map(n => one(h1, n))], hgaps = pk.slice(1).map((p, k) => p[0] - pk[k][0]);
    // (what the menu shows changed meanwhile, counted from the last picture before the window; at most one allowed)
    const hs = (hA1[0] - hA[0]) / 1000, hb = (h1.bytes - h0.bytes) / hs, hc = hA1[1] - Math.min(hA[1], pk.length ? pk[0][1] : hA[1]), allow = Math.min(hc, 1);
    const short = hgaps.map((g, k) => k).filter(k => hgaps[k] < 3990), paired = short.every(k => pk[k + 1][1] > pk[k][1]);
    check('menus: a ray moving over A\'s buttons for 4.5 s (only their light changing): a picture at most every 4 s (each 3,990 ms or more after the last, but one after a change of what it shows) and under 24 KB a second sent',
      hov.length >= 3 && h1.n - h0.n <= Math.floor(hs / 4) + 1 + allow && short.length <= allow && paired && hb < 24 * 1024,
      JSON.stringify({ lit: hov, made: h1.n - h0.n, sent: h1.pics - h0.pics, gaps: hgaps.map(Math.round), cvs: pk.map(p => p[1]), short, paired, cver: hc, perSec: Math.round(hb), secs: hs, cur }));
    // the Story tab: the story's own panels drawn into the picture (its shape is that tab's, lit below its top quarter
    // where the panels are). (A pretend headset's step runs the story's xrBegin, not its panels' drawing: drawn here once)
    await A.evaluate(() => { HOST.cur.peek('XR.panels.forEach(P => { P.last = ""; P.t = -1e9; panelTick(P, performance.now() + 1e6); })'); HOST.collab.menuTab('story'); });
    // (its height once a frame of A's has drawn the Story tab: read before one, it was the Settings tab's, so a copy of the
    // Settings picture passed for the Story tab's and the Story tab's own never did)
    const vis2 = await A.evaluate(() => { window.__xr.step(); return HOST.collab.menuTab() === 'story' ? HOST.collab.overlay().panel.vis : 0; });
    const storyPic = ([id, r]) => { window.__xr.step(); const m = HOST.collab.menus().find(x => x.id === id); return !!m && m.drawn && Math.abs(m.ih / m.iw - r) < 0.02 && m.low > 0.008; };
    const st = await runUntil([A, B], B, storyPic, [aId, vis2 / 720], 12000);
    await runUntil([A, B], null, null, null, 900);
    // (B's copy once both have run again: a pretend headset's frames stop between the round's steps, so B may have let
    // A's copy go meanwhile, 3 s after its last sample, and be taking it again, its picture asked for: up to MSH.picMs)
    const st2 = await runUntil([A, B], B, storyPic, [aId, vis2 / 720], 6000);
    const [ap2, bm2] = await both(), mir = await A.evaluate(() => Object.values(HOST.collab.overlay().mirror).every(m => m.visible));
    await pics(2);
    check('menus: the Story tab\'s picture, the story\'s panels drawn in (its shape the tab\'s, lit where the panels are)', vis2 > 0 && vis2 === ap2.vis && st && st2 && mir && !!bm2 && Math.abs(bm2.ih / bm2.iw - ap2.vis / 720) < 0.02 && bm2.low > 0.008 && Math.abs(bm2.h - ap2.h) < 0.01,
      JSON.stringify({ st, st2, mir, ih: bm2 && bm2.ih, iw: bm2 && bm2.iw, vis2, vis: ap2.vis, lit: bm2 && bm2.lit, low: bm2 && bm2.low, h: [bm2 && bm2.h, ap2.h] }));
    // A turns away: its menu glides back in front of it, B's follows (at most 5 poses a second meanwhile) and ends where A's stands
    const p0 = (await sent()).poses, before = await aPose();
    await goRoom(A, S1.x, 1.6, S1.z, 1.2);
    const t0 = Date.now();
    await runUntil([A, B], null, null, null, 3000);
    const dt = (Date.now() - t0) / 1000, p1 = (await sent()).poses;
    const qT = await bNow();   // (from here on, B letting go of A's copy is the silent step's: its reason is looked at there)
    await runUntil([A, B], null, null, null, 800);
    const [ap3, bm3] = await both();
    check('menus: A\'s menu glides back in front of A as it turns away: B\'s follows (at most 5 poses a second) and ends where A\'s stands',
      dist(before.p, ap3.p) > 0.3 && p1 - p0 >= 2 && p1 - p0 <= 5 * dt + 3 && !!bm3 && !!bm3.p && dist(bm3.p, ap3.p) < 0.01 && qd(bm3.q, ap3.q) < 0.0175,
      JSON.stringify({ moved: dist(before.p, ap3.p), poses: p1 - p0, dt, b: bm3 && bm3.p, a: ap3.p }));
    // A silent (a headset taken off: no frames): B's copy gone 3 s after A's last sample, nothing closed; back once A goes on
    const c0 = (await sent()).closed, q0 = Date.now();
    const quiet = await runUntil([B], B, id => { window.__xr.step(); return !HOST.collab.menus(false, false).some(x => x.id === id); }, aId, 6000);
    const qs = (Date.now() - q0) / 1000, c1 = (await sent()).closed, qWhy = await goneWhy(qT);
    const again = await fresh(10000);
    check('menus: A silent (a headset taken off): gone on B after a few seconds with nothing closed (quiet, by B\'s own reckoning); back once A goes on', quiet && c1 === c0 && qWhy === 'quiet' && again,
      JSON.stringify({ quiet, qs, closed: c1 - c0, why: qWhy, again }));
    // A closes its menu, B holding its copy: gone on B as A's closed comes (B's own reason, so not MSH.gone's 3 s without a
    // pose), within 2 s; opened again, back. (The whole run, its earlier rounds' pages still drawing in software, once missed
    // a second here: B's polls read the picture's pixels back, each waiting on the busy GPU process. They read none now, and
    // the reason tells closed from quiet whatever the time)
    const cl0 = (await sent()).closed;
    const CL = await closeOn(() => { HOST.collab.panelOpen(false); window.__xr.step(); }, 2000);
    const s3 = await sent();
    await A.evaluate(() => { HOST.collab.panelOpen(true); HOST.collab.menuTab('settings'); });
    const back = await runUntil([A, B], B, id => { window.__xr.step(); const m = HOST.collab.menus(false, false).find(x => x.id === id); return !!m && m.drawn; }, aId, 10000);
    check('menus: A closes its menu: gone on B as its closed comes (B\'s reason, within 2 s); opened again, back', CL.held && CL.gone && CL.why === 'closed' && s3.closed === cl0 + 1 && !s3.st && back, JSON.stringify(Object.assign({ s3, back }, CL)));
    // the setting off (with the menu open): gone on B as its closed comes, and nothing sent meanwhile
    const OF = await closeOn(() => { const r = HOST.collab.menuFind('menushare'); if (r && r.fn) r.fn(); window.__xr.step(); return !!(r && r.fn); }, 2000);
    const s4 = await sent();
    await runUntil([A, B], null, null, null, 1500);
    const s5 = await sent(), off1 = await A.evaluate(() => [HOST.collab.menuShare(), localStorage.getItem('xrMenuShare'), HOST.collab.menu]);
    check('menus: My menu: only me again (the menu open): gone on B (closed), nothing more sent', OF.held && OF.r && OF.gone && OF.why === 'closed' && !off1[0] && off1[1] === null && off1[2] && s5.pics === s4.pics && s5.poses === s4.poses && !s5.st,
      JSON.stringify(Object.assign({ off1, s4, s5 }, OF)));
    // on again, then A's session ends: gone on B
    await press('menushare');
    const back2 = await runUntil([A, B], B, id => { window.__xr.step(); const m = HOST.collab.menus(false, false).find(x => x.id === id); return !!m && m.drawn; }, aId, 10000);
    const kept = await A.evaluate(() => localStorage.getItem('xrMenuShare'));
    // (A's frames stop with its session: its loop told first)
    const EN = await closeOn(() => { window.__go = false; window.__xr.end(); }, 1500);
    check('menus: on again (kept on the headset), then A\'s session ends: gone on B (closed)', back2 && kept === 'circle' && EN.held && EN.gone && EN.why === 'closed', JSON.stringify(Object.assign({ back2, kept }, EN)));
  } finally {
    for (const h of H) await h.evaluate(() => window.__xr.end()).catch(() => {});
    for (const p of [P, ...H]) await p.context().close();
  }
}

// ---- the studio's behaviours shared (behaveRound; --behave runs only it, also in the main run after the studio's scenes as
// circles): a relay of its own (from port 8750 up) with --scenes on a copy of the test scene alone (so every device at a
// studio circle opens it by itself), a studio circle at the room's origin facing -z (its scene's frame the room's), two
// pretend headsets in it and a page following it. A ball that follows (nearest, range 3, 1 m in front, 1 m/s) and a cube
// that looks (first, range 3) put in on the page: the nearest headset drives the ball and every device says so; where it
// draws it reaches the other headset and the page 120 ms behind its samples (the median within 5 cm while the driver
// walks); Pause on the page (editing on there) writes nothing to the room, the page drawing the ball where it is placed
// while the other headset still draws it where the driver's samples put it, and played again the page follows them again;
// the other headset coming nearer by more than 0.3 m takes over; the first headset stays the looker's while it is
// within range + 0.5 m, though the other stands nearer, and leaves it once further; nobody in range, both items back where
// they are placed on every device. Nothing of it in the room's keys but the records
async function behaveRound() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-behave-'));
  fs.cpSync(path.join(root, 'tools', 'studio', 'test', 'scenes', 'test'), path.join(tmp, 'test'), { recursive: true });
  const pages = [];
  let R = null;
  const sopen = async (url, name, size) => {
    const ctx = await browser.newContext({ viewport: size || { width: 640, height: 400 } });
    await ctx.addInitScript(n => { try { localStorage.setItem('collabName', n); } catch (e) { /* storage blocked */ } }, name);
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('behave round: ' + (e.stack || e.message)));
    p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|WebSocket connection/.test(m.text())) errors.push('behave round: ' + m.text()); });
    await p.goto(url, { timeout: 90000 });
    await p.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
    pages.push(p);
    return p;
  };
  const sp = (p, s) => p.evaluate(s => HOST.cur.peek(s), s);
  const sUntil = (p, s, ms) => until(p, s => { try { return !!HOST.cur.peek(s); } catch (e) { return false; } }, s, ms || 10000);
  try {
    R = await relayOn(['--static', '.', '--scenes', tmp, '--scenes-readonly', '--quiet'], {}, 8750);
    const sb = `http://127.0.0.1:${R.port}/`;
    const A = await sopen(sb + 'index.html#stories', 'Pia');
    await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
    await until(A, () => HOST.collab.status === 'open', null, 10000);
    const rc = await A.evaluate(() => HOST.collab.code);
    const sid = await A.evaluate(() => HOST.collab.add('studio', { x: 0, z: 0, yaw: 0 }));
    await until(A, () => HOST.collab.stations().length === 1 && !HOST.collab.internals().pending.size, null, 5000);
    const H1 = await sopen(sb + 'index.html#s=' + rc, 'Hana', { width: 320, height: 200 }), H2 = await sopen(sb + 'index.html#s=' + rc, 'Ivo', { width: 320, height: 200 });
    for (const p of [H1, H2]) { await until(p, c => HOST.collab.code === c && HOST.collab.status === 'open' && HOST.collab.stations().length === 1, rc, 20000); await ready(p, 'airports'); }
    // both headsets lined up through the shared space (as in the main run)
    const aId = await A.evaluate(() => HOST.collab.id);
    await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
    await until(A, () => !HOST.collab.internals().pending.size, null, 3000);
    for (const [H, head] of [[H1, [-1, 1.6, 2, 0.4]], [H2, [1, 1.6, 2, -0.4]]]) {
      await H.evaluate(() => HOST.room.sharedAlign(true));
      await H.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head });
      await H.evaluate(() => window.__xr.begin());
    }
    await Promise.all([frames(H1, 400), frames(H2, 400)]);
    for (const H of [H1, H2]) await H.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'U1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
    await Promise.all([frames(H1, 300), frames(H2, 300)]);
    const st = await A.evaluate(id => HOST.collab.station(id), sid);
    const al = (await H1.evaluate(() => HOST.room.aligned)) && (await H2.evaluate(() => HOST.room.aligned));
    // both walk into the circle (the studio opens there, its one scene by itself), the page follows it
    const in1 = await walk(H1, st, 'studio', 0, 90000), in2 = await walk(H2, st, 'studio', 0, 90000);
    await A.evaluate(id => HOST.collab.follow(id), sid);
    await ready(A, 'studio', 90000);
    const loaded = [];
    for (const p of [A, H1, H2]) loaded.push(await sUntil(p, `STU.scene === 'test' && STUDIO.ready() && atStation()`, 90000));
    const [id1, id2] = [await H1.evaluate(() => HOST.collab.id), await H2.evaluate(() => HOST.collab.id)];
    check('behave: two pretend headsets stand in a studio circle at the room\'s origin and a page follows it, the test scene open on all three', !!sid && al && in1 && in2 && loaded.every(Boolean), JSON.stringify({ sid, al, in1, in2, loaded }));
    // the items, put in on the page; both headsets far from them first
    await Promise.all([goRoom(H1, 5, 1.6, 4, 0), goRoom(H2, -5, 1.6, 4, 0)]);
    await sp(A, `(putItem('bfo001', 'p', norm('p', { name: 'Ball', shape: 'sphere', p: [0, 0.5, -2], behaviour: { kind: 'follow', range: 3, dist: 1, speed: 1 } })),
      putItem('bfi001', 'p', norm('p', { name: 'Looker', shape: 'cube', p: [2, 0.5, -2], behaviour: { kind: 'look', who: 'first', range: 3 } })), 0)`);
    const all = [A, H1, H2], names = ['page', 'H1', 'H2'];
    const run = ms => Promise.all([frames(H1, ms), frames(H2, ms), sleep(ms)]);
    let got = [];
    for (let k = 0; k < 30 && got.length < 3; k++) { await run(300); got = (await Promise.all(all.map(p => sp(p, `!!(STU.items.get('bfo001') && STU.items.get('bfi001'))`)))).filter(Boolean); }
    // what each device says of an item: who, driven here, from where, and where it is drawn (its middle: the shapes' holders)
    const info = id => Promise.all(all.map(p => sp(p, `(() => { const b = STUDIO.behave('${id}'), P = STUDIO.pose('${id}'), m = P ? (P.drawn || P.placed) : null; return b && { who: b.who, drive: b.drive, src: b.src, on: b.on, at: m ? [m[12], m[13], m[14]] : null }; })()`)));
    const spread = I => Math.max(...I.map(a => Math.max(...I.map(b => (a && b && a.at && b.at ? Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1], a.at[2] - b.at[2]) : 99)))));
    // waits (frames on both headsets, the page drawing by itself) until want(info of id) on every device, or ms
    const waitFor = async (id, want, ms) => { const t0 = Date.now(); let I; do { await run(400); I = await info(id); } while (!want(I) && Date.now() - t0 < ms); return I; };
    const say = I => JSON.stringify(I.map((x, k) => [names[k], x && x.who === id1 ? 'H1' : x && x.who === id2 ? 'H2' : x && x.who, x && x.drive, x && x.src, x && x.at && x.at.map(v => +v.toFixed(3))]));

    // ---- nearest: H1 1.5 m from the ball (looking along -x), H2 far: H1 drives it to 1 m in front of itself, everywhere
    await goRoom(H1, 1.5, 1.6, -2, Math.PI / 2);
    const n1 = await waitFor('bfo001', I => I.every(x => x && x.who === id1 && x.at && Math.hypot(x.at[0] - 0.5, x.at[2] + 2) < 0.05), 30000);
    check('behave: the nearest headset (H1) is the ball\'s on every device, drives it (the others draw its samples) to 1 m in front of itself, where every device draws it (within 5 cm)',
      got.length === 3 && n1.every(x => x && x.who === id1) && n1[1].drive && !n1[0].drive && !n1[2].drive && n1[0].src === 'by:' + id1 && n1[2].src === 'by:' + id1 && spread(n1) < 0.05 &&
      n1.every(x => Math.hypot(x.at[0] - 0.5, x.at[1] - 0.5, x.at[2] + 2) < 0.05), say(n1));
    const l1 = await info('bfi001');
    check('behave: the looker (first) is H1\'s on every device, H1 driving it', l1.every(x => x && x.who === id1) && l1[1].drive && !l1[0].drive && !l1[2].drive, say(l1));

    // ---- 120 ms behind: H1 walks 1.5 m along +z in 3 s, the ball with it; each frame's place on the page and on H2 against
    // where H1 had it 120 ms before (the relay's clock on all three)
    await Promise.all(all.map(p => sp(p, 'BEH.log = new Map()')));
    for (let k = 1; k <= 30; k++) { await goRoom(H1, 1.5, 1.6, -2 + 1.5 * k / 30, Math.PI / 2); await run(100); }
    await run(1500);
    const logs = await Promise.all(all.map(p => sp(p, `JSON.stringify(BEH.log.get('bfo001') || [])`).then(JSON.parse)));
    const drv = logs[1].filter(e => e[4] === 'me');
    const behind = L => {
      const errs = [];
      let run0 = null, src = '';
      for (const e of L) {
        if (e[4] !== src) { src = e[4]; run0 = e[0]; }
        if (src !== 'by:' + id1 || e[0] - run0 < 500) continue;   // (blended in over its first moments)
        const t = e[0] - 120, j = drv.findIndex(d => d[0] >= t);
        if (j < 1) continue;
        const a = drv[j - 1], b = drv[j], f = (t - a[0]) / Math.max(1, b[0] - a[0]);
        errs.push(Math.hypot(e[1] - (a[1] + (b[1] - a[1]) * f), e[2] - (a[2] + (b[2] - a[2]) * f)));
      }
      errs.sort((x, y) => x - y);
      return { n: errs.length, median: errs.length ? +errs[errs.length >> 1].toFixed(3) : null, p90: errs.length ? +errs[Math.floor(errs.length * 0.9)].toFixed(3) : null };
    };
    const bp = behind(logs[0]), bh = behind(logs[2]), moved = drv.length ? Math.hypot(drv[drv.length - 1][1] - drv[0][1], drv[drv.length - 1][2] - drv[0][2]) : 0;
    console.log('      behaviour samples 120 ms behind: page ' + JSON.stringify(bp) + ', H2 ' + JSON.stringify(bh) + ', the driver\'s frames ' + drv.length + ', moved ' + moved.toFixed(2) + ' m');
    check('behave: while H1 walks, the ball as the page and H2 draw it is where H1 had it 120 ms before (median within 5 cm)', moved > 1 && bp.n >= 5 && bh.n >= 5 && bp.median < 0.05 && bh.median < 0.05,
      JSON.stringify({ bp, bh, moved, drv: drv.length }));

    // ---- Pause on the page (this device's own, editing on there; v122): nothing goes to the room (its state() and the
    // station's key as they were), the page draws the ball where it is placed while H2 still draws it where H1's samples
    // put it; played again, the page follows them again
    const roomX = async () => { const k = (await (await fetch(sb + 'api/rooms/' + rc)).json()).keys['st.' + sid + '.x']; return k ? JSON.stringify([k.seq, k.v]) : ''; };
    const ps0 = await sp(A, `(setEdit(true), JSON.stringify(collabState()))`), rx0 = await roomX();
    await sp(A, `(pauseSet(true), 0)`);
    await run(1500);
    const pz = await info('bfo001'), ps1 = await sp(A, `[MPAUSE.on, JSON.stringify(collabState())]`), rx1 = await roomX();
    const atPlace = x => !!(x && x.at && Math.hypot(x.at[0], x.at[1] - 0.5, x.at[2] + 2) < 1e-6), byH1 = (x, y) => !!(x && y && x.who === id1 && x.src === 'by:' + id1 && x.at && y.at && Math.hypot(x.at[0] - y.at[0], x.at[1] - y.at[1], x.at[2] - y.at[2]) < 0.05);
    await sp(A, `(pauseSet(false), setEdit(false), 0)`);
    const pz2 = await waitFor('bfo001', I => byH1(I[0], I[1]) && byH1(I[2], I[1]), 15000);
    check('behave: Pause on the page writes nothing to the room (its state() and the station\'s key unchanged) and draws the ball where it is placed, while H2 still draws it where H1\'s samples put it (within 5 cm of H1); played again, the page follows H1 again',
      ps1[0] && ps1[1] === ps0 && !!rx0 && rx1 === rx0 && atPlace(pz[0]) && !pz[0].drive && pz[1].drive && byH1(pz[2], pz[1]) && byH1(pz2[0], pz2[1]) && byH1(pz2[2], pz2[1]),
      JSON.stringify({ paused: ps1[0], state: ps1[1] === ps0, room: rx1 === rx0 }) + ' ' + say(pz) + ' ' + say(pz2));

    // ---- H2 comes nearer than H1 by more than 0.3 m: it takes the ball over, everywhere
    await goRoom(H2, 0.3, 1.6, -0.2, 0);
    const n2 = await waitFor('bfo001', I => I.every(x => x && x.who === id2 && x.at && Math.hypot(x.at[0] - 0.3, x.at[2] + 1.2) < 0.05), 30000);
    check('behave: H2 coming nearer than H1 by more than 0.3 m takes the ball over on every device (H2 drives, 1 m in front of it, within 5 cm everywhere)',
      n2.every(x => x && x.who === id2) && n2[2].drive && !n2[1].drive && !n2[0].drive && n2[0].src === 'by:' + id2 && spread(n2) < 0.05, say(n2));

    // ---- first: H2 right by the looker, H1 3.2 m off (within range + 0.5): still H1's; H1 4 m off: H2's
    await Promise.all([goRoom(H2, 2.2, 1.6, -2.1, 0), goRoom(H1, 5.2, 1.6, -2, Math.PI / 2)]);
    await run(3000);
    const f1 = await info('bfi001');
    await goRoom(H1, 6, 1.6, -2, Math.PI / 2);
    const f2 = await waitFor('bfi001', I => I.every(x => x && x.who === id2), 20000);
    check('behave: the looker (first) stays H1\'s while H1 is within range + 0.5 m though H2 stands nearer, and is H2\'s once H1 is further, on every device',
      f1.every(x => x && x.who === id1) && f1[1].drive && f2.every(x => x && x.who === id2) && f2[2].drive && !f2[1].drive && !f2[0].drive, say(f1) + ' ' + say(f2));

    // ---- nobody in range: both back where they are placed, on every device
    await Promise.all([goRoom(H1, 6, 1.6, 4, 0), goRoom(H2, -6, 1.6, 4, 0)]);
    const home = I => I.every(x => x && !x.who && !x.on && !x.drive);
    const b1 = await waitFor('bfo001', home, 30000), b2 = await waitFor('bfi001', home, 20000);
    const placed = await Promise.all(all.map(p => sp(p, `['bfo001', 'bfi001'].map(id => { const P = STUDIO.pose(id), m = P.drawn || P.placed; return Math.max(...m.map((v, i) => Math.abs(v - P.placed[i]))); })`)));
    check('behave: with nobody in range both go back where they are placed, on every device', home(b1) && home(b2) && placed.every(a => a.every(d => d < 1e-6)), say(b1) + ' ' + say(b2) + ' ' + JSON.stringify(placed));
    // the room keeps the records and nothing else of it (the samples are effects, never stored)
    const keys = (await (await fetch(sb + 'api/rooms/' + rc)).json()).keys, x = keys['st.' + sid + '.x'] && keys['st.' + sid + '.x'].v;
    check('behave: the room keeps the two records with their behaviours, and no key of the samples', !!x && JSON.stringify(x['p.bfo001'].behaviour) === '{"kind":"follow","who":"nearest","range":3,"dist":1,"speed":1}' &&
      JSON.stringify(x['p.bfi001'].behaviour) === '{"kind":"look","who":"first","range":3}' && !Object.keys(keys).some(k => /beh/.test(k)), JSON.stringify(Object.keys(keys)));
  } finally {
    for (const p of pages) await p.context().close().catch(() => {});
    await relayOff(R);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
// ---- the PC's Vive trackers end to end (trackersRound; --trackers runs only it, also in the main run after the studio's
// rounds; tools/trackers/SPEC.md, Tests): a relay of its own with --trackers (a free UDP port) and --scenes on a temporary
// copy of the test and puppet scenes (it takes uploads), and the fake bridge (tools/trackers/fake.mjs) whose SteamVR space
// is the room turned and moved by a known transform, so every pose's truth is known: a tracker lying on spot A and then on
// spot B, a prop tracker going round a circle, the Index (its headset and controllers), a base station, and a performer's
// six trackers worn on a walking copy of the puppet test rig (worked out here in Node, as tools/studio/test-ik.mjs does). A
// page's Trackers section (the switch, lining up by hand through the real /api/trackers/still, names, a write keeping the
// other fields), every page and a pretend headset given @trk, within 2 mm of the truth at one held relay time; that
// headset (not a Quest's browser, the fake's 'h' its head) lined up by the 'trackers' frame source; at a studio station a
// shape following the prop tracker on every device, the rig worn from the performer's trackers (lined up from a T-pose)
// solved alike everywhere, and a take saved through the relay as a GLB whose Take 1 plays on another page. A held time:
// the fake paused for a moment, so every device keeps the same last samples, and each holds the relay's time
// (HOST.collab.trkTime) in the middle of them.
// The performer: the puppet test rig loaded in Node, walking (Walk) or at rest (a T-pose), its root at AT facing +z; six
// trackers fixed to its bones with seeded offsets as the smoke test's, their mean offset along the floor made zero by the
// hips', so lining up puts the character right where the performer stands. at(t): the six trackers' room poses at the
// fake's clock t ({ hips: { p, q }, ... }); bones(t): the truth's hips, hands and feet in room coordinates
async function performer(file, AT) {
  const require = createRequire(import.meta.url), THREE = require(path.join(root, 'three.min.js'));
  globalThis.THREE = THREE;
  if (!THREE.GLTFLoader) new Function(fs.readFileSync(path.join(root, 'tools', 'studio', 'vendor', 'GLTFLoader.js'), 'utf8'))();
  const IK = new Function(fs.readFileSync(path.join(root, 'tools', 'studio', 'engine', 'ik.js'), 'utf8') + '\nreturn makeIK;')()(THREE);
  const b = fs.readFileSync(file);
  const truth = await new Promise((res, rej) => new THREE.GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), '', res, rej));
  const TR = IK.rigOf(truth.scene), mixer = new THREE.AnimationMixer(truth.scene), walk = mixer.clipAction(truth.animations.find(a => a.name === 'Walk'));
  let seed = 20261109;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, c) => a + (c - a) * rnd(), V = (...a) => new THREE.Vector3(...a);
  const randQ = () => { const u = rnd(), v = rnd() * 2 * Math.PI, w = rnd() * 2 * Math.PI, a = Math.sqrt(1 - u), c = Math.sqrt(u); return new THREE.Quaternion(a * Math.sin(v), a * Math.cos(v), c * Math.sin(w), c * Math.cos(w)); };
  const world = n => { const p = V(), q = new THREE.Quaternion(), s = V(); n.matrixWorld.decompose(p, q, s); return { p, q }; };
  const pose = tw => {   // (tw: the walk's time, or null at rest)
    const r = truth.scene;
    r.position.set(AT.x, 0, AT.z); r.quaternion.identity(); r.scale.setScalar(1);
    if (tw !== null) { if (!walk.isRunning()) walk.play(); mixer.setTime(tw); } else { walk.stop(); TR.toRest(); }
    r.updateMatrixWorld(true);
  };
  pose(null);
  const restQ = part => world(TR.bones[part]).q;
  const wear = (part, at, turn) => ({ part, o: at.clone().applyQuaternion(restQ(part).invert()), q: restQ(part).invert().multiply(turn) });
  const W = {
    hips: wear('hips', V(rr(-0.08, 0.08), 0, rr(-0.15, -0.1)), randQ()),
    head: wear('head', V(rr(-0.04, 0.04), rr(0.1, 0.14), rr(-0.04, 0.04)), randQ()),
    lhand: wear('lhand', V(rr(-0.06, -0.03), rr(-0.02, 0.04), rr(-0.03, 0.03)), randQ()),
    rhand: wear('rhand', V(rr(0.03, 0.06), rr(-0.02, 0.04), rr(-0.03, 0.03)), randQ()),
    lfoot: wear('lfoot', V(rr(-0.02, 0.02), rr(0.03, 0.06), rr(0.02, 0.08)), randQ()),
    rfoot: wear('rfoot', V(rr(-0.02, 0.02), rr(0.03, 0.06), rr(0.02, 0.08)), randQ()),
  };
  const ID = { hips: 'LHR-HIPS0001', head: 'LHR-HEAD0002', lhand: 'LHR-LHND0003', rhand: 'LHR-RHND0004', lfoot: 'LHR-LFOT0005', rfoot: 'LHR-RFOT0006' };
  const parts = Object.keys(W), trk = k => { const w = W[k], c = world(TR.bones[w.part]); return { p: w.o.clone().applyQuaternion(c.q).add(c.p), q: c.q.clone().multiply(w.q) }; };
  // (the worn offsets' mean along the floor against their bones, at rest, made zero by moving the hips' tracker)
  { const m = V(); for (const k of parts) { const t = trk(k).p, c = world(TR.bones[W[k].part]).p; m.x += t.x - c.x; m.z += t.z - c.z; }
    W.hips.o.sub(V(m.x, 0, m.z).applyQuaternion(restQ('hips').invert())); }
  const P = { ID, parts, walk0: null, memo: new Map() };
  const twOf = t => (P.walk0 === null ? null : Math.max(0, t - P.walk0));
  P.at = t => {
    const tw = twOf(t), key = tw === null ? 'rest' : tw.toFixed(6);
    let o = P.memo.get(key);
    if (!o) {
      pose(tw);
      o = Object.fromEntries(parts.map(k => { const x = trk(k); return [k, { p: x.p.toArray(), q: x.q.toArray() }]; }));
      P.memo.set(key, o);
      if (P.memo.size > 32) P.memo.delete(P.memo.keys().next().value);
    }
    return o;
  };
  P.bones = t => { pose(twOf(t)); return Object.fromEntries(['hips', 'lhand', 'rhand', 'lfoot', 'rfoot'].map(k => [k, world(TR.bones[k]).p.toArray()])); };
  return P;
}
async function trackersRound(dir) {
  const { startFake, qYaw, qAxis, qMul, qAngle } = await import(new URL('trackers/fake.mjs', import.meta.url).href);
  // (a vector turned by a quaternion [x, y, z, w], as three.js's applyQuaternion)
  const qRot = (q, v) => { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
  const SC = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-trk-'));
  for (const n of ['test', 'puppet']) fs.cpSync(path.join(root, 'tools', 'studio', 'test', 'scenes', n), path.join(SC, n), { recursive: true });
  const AT = { x: 0.6, z: -1.2 }, PF = await performer(path.join(SC, 'puppet', 'rig.glb'), AT);
  // the fake's clock (s) from T0, by the wall clock the relay stamps each reading with as it comes: the truth at the relay's
  // time D is every device's pose at clock (D - T0) / 1000
  const T0 = Date.now(), clock = () => (Date.now() - T0) / 1000;
  const TURN = 0.7, MOVE = [1.3, 0.02, -0.6];   // (SteamVR's space: the room turned 40 degrees about y and moved)
  const IDX = { x: -1.2, z: 1.4, yaw: 0.4 };   // (the Index's head, still, in the room: where the studio's circle goes)
  const SPOT = 'LHR-SPOT0001', PROP = 'LHR-PROP0002', HMD = 'LHR-INDX0007', BASE = 'LHB-BASE0001', OM = 2 * Math.PI * 0.12;
  const still = (p, q) => () => ({ p, q: q || [0, 0, 0, 1] });
  const devices = [
    { s: SPOT, k: 'trk', b: 0.9, pose: still([0, 0, 0]) },   // (lying on spot A: the room's origin)
    { s: PROP, k: 'trk', b: 0.7, pose: t => ({ p: [1 + 0.5 * Math.cos(OM * t), 1, 1 - 0.5 * Math.sin(OM * t)], q: qMul(qYaw(OM * t), qAxis([1, 0, 0], 0.3)) }) },   // (0.38 m/s)
    { s: HMD, k: 'hmd', b: null, pose: still([IDX.x, 1.6, IDX.z], qYaw(IDX.yaw)) },
    { s: 'LHR-INDL0008', k: 'ctl', h: 'l', b: 0.8, pose: still([IDX.x - 0.25, 1.15, IDX.z - 0.3], qAxis([1, 0, 0], -0.6)) },
    { s: 'LHR-INDR0009', k: 'ctl', h: 'r', b: 0.75, pose: still([IDX.x + 0.25, 1.15, IDX.z - 0.3], qAxis([1, 0, 0], -0.5)) },
    { s: BASE, k: 'base', b: null, pose: still([-2, 2.3, 2], qMul(qYaw(-0.8), qAxis([1, 0, 0], -0.5))) },
    ...PF.parts.map(k => ({ s: PF.ID[k], k: 'trk', b: 0.8, pose: t => PF.at(t)[k] })),
  ];
  const kindOf = d => (d.k === 'ctl' ? d.h : { trk: 't', hmd: 'h' }[d.k]);
  const truthAt = (id, D) => (F ? F.devices : devices).find(x => x.s === id).pose((D - T0) / 1000);   // (the fake's own list: set() changes a pose there)
  const pages = [];
  let R = null, F = null;
  const sopen = async (url, name, size) => {
    const ctx = await browser.newContext({ viewport: size || { width: 640, height: 400 } });
    await ctx.addInitScript(n => { try { localStorage.setItem('collabName', n); } catch (e) { /* storage blocked */ } }, name);
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('trackers round: ' + (e.stack || e.message)));
    p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|WebSocket connection/.test(m.text())) errors.push('trackers round: ' + m.text()); });
    await p.goto(url, { timeout: 90000 });
    await p.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
    pages.push(p);
    return p;
  };
  const sp = (p, s) => p.evaluate(s => HOST.cur.peek(s), s);
  const sUntil = (p, s, ms) => until(p, s => { try { return !!HOST.cur.peek(s); } catch (e) { return false; } }, s, ms || 10000);
  const key = async rc => { const x = (await (await fetch(`http://127.0.0.1:${R.port}/api/rooms/${rc}`)).json()).keys.trk; return x ? x.v : null; };
  // a held time: the fake paused (every device keeps the same last samples: each waits until it has the last reading, as a
  // page busy drawing in software takes the relay's messages late), the relay's time T held on each in the middle of them
  // (drawn at D = T - 40 ms, between samples, never past the last); what fn(page, T) gives on each, then all let go and the
  // fake on again
  const held = async (list, fn) => {
    F.pause(true);
    await sleep(400);
    let L = 0, id = '';
    for (const [s, h] of F.history) if (h.length && h[h.length - 1].at > L) { L = h[h.length - 1].at; id = s; }
    const D = L - 50, T = D + 40, out = [], caught = [];
    for (const p of list) caught.push(await until(p, ([id, L]) => { const C = HOST.collab, h = C.trkTime(), H = L + 1e5; C.trkTime(H); const x = C.tracker(id); C.trkTime(h); return !!x && H - x.age >= L - 1; }, [id, L], 8000));
    try { for (const p of list) out.push(await fn(p, T)); }
    finally { for (const p of list) await p.evaluate(() => HOST.collab.trkTime(null)).catch(() => {}); F.pause(false); }
    return { D, T, out, caught };
  };
  try {
    R = await relayOn(['--static', '.', '--scenes', SC, '--trackers', '0', '--quiet'], {}, 8730);
    const udp = +((/UDP 127\.0\.0\.1:(\d+)/.exec(R.out) || [])[1] || 0), sb = `http://127.0.0.1:${R.port}/`;
    F = startFake({ port: udp, rate: 90, turn: TURN, move: MOVE, clock, devices });
    const A = await sopen(sb + 'index.html#stories', 'Anna', { width: 1000, height: 760 });
    await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
    await until(A, () => HOST.collab.status === 'open', null, 10000);
    const rc = await A.evaluate(() => HOST.collab.code);
    const B = await sopen(sb + 'index.html#s=' + rc, 'Ben'), C = await sopen(sb + 'index.html#s=' + rc, 'Cleo');
    const H = await sopen(sb + 'index.html#s=' + rc, 'Iris', { width: 320, height: 200 });
    for (const p of [B, C, H]) await until(p, c => HOST.collab.code === c && HOST.collab.status === 'open', rc, 20000);
    // (the airports story they open with is not this round's: its globe stops drawing in software, which would starve the
    // pages' timers and messages for seconds; the studio draws its own once followed)
    for (const p of [B, C, H]) { await ready(p, 'airports'); await p.evaluate(() => HOST.renderer.setAnimationLoop(null)); }
    const ping = await (await fetch(sb + 'api/ping')).json(), on = [];
    for (const p of [A, B, C, H]) on.push(await p.evaluate(() => HOST.collab.trkPing()));
    check('trackers: the relay with --trackers takes the fake bridge\'s readings (its ping: trackers, 8 seen) and every page and the headset hear it has them',
      udp > 0 && ping.trackers === true && ping.trackersSeen === 8 && on.every(Boolean), JSON.stringify({ udp, ping, on }));
    // the Index: a pretend VR headset whose browser is not a Quest's (Chromium's own user agent), its head where the fake's
    // 'h' is in the pretend real room (the room at ROOM there). In VR before the room uses the trackers: the question asked
    // (in this room?), nothing to line up by yet; its first frames, slow in software, over before the trackers come
    const head = [...apply(ROOM, [IDX.x, 1.6, IDX.z]), ROOM[3] + IDX.yaw];
    await H.evaluate(installXR, { mode: 'immersive-vr', features: ['local-floor'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head });
    await H.evaluate(() => window.__xr.begin());
    await frames(H, 3000);
    const ask0 = await H.evaluate(() => [HOST.collab.guide().status.w, HOST.room.src, HOST.collab.notes().map(n => n.title)]);

    // ---- the page's Trackers section: shown, the switch writes trk.on; on but not lined up, every page told so (l '')
    await A.evaluate(() => HOST.collab.dialog(true));
    const shown = await until(A, () => { const b = document.querySelector('#shared .sh-trk'); return !!b && !b.hidden && /^Not used in this room/.test(document.querySelector('#shared .sh-trkst').textContent); }, null, 8000);
    await A.evaluate(() => document.querySelector('#shared [data-sh="trkon"]').click());
    let k = null;
    for (let i = 0; i < 30 && !(k && k.on === true); i++) { await sleep(150); k = await key(rc); }
    const told = [];
    for (const p of [A, B, C, H]) told.push(await until(p, () => { const t = HOST.collab.trk(); return t.on && t.l === '' && t.heard !== null && t.heard < 2500; }, null, 6000));
    const st0 = await A.evaluate(() => [document.querySelector('#shared [data-sh="trkon"]').textContent, document.querySelector('#shared .sh-trkst').textContent]);
    check('trackers: the Shared dialog\'s section shows while the relay has them; its switch writes trk.on for the room, and every page and the headset hear it is not lined up yet (@trk with l \'\')',
      shown && !!k && k.on === true && k.m === null && told.every(Boolean) && st0[0] === 'Use the PC\'s trackers in this room: on' && /^Not lined up yet/.test(st0[1]), JSON.stringify({ shown, k, told, st0 }));

    // ---- lining up by hand through the relay's /api/trackers/still: the spot tracker on spot A, then sliding while spot B
    // is read (refused), then still on spot B: trk.m the two points SteamVR reads there
    const pick = await until(A, id => [...document.querySelectorAll('#shTrkPick option')].some(o => o.value === id), SPOT, 8000);
    await A.evaluate(id => { const s = document.querySelector('#shTrkPick'); s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); }, SPOT);
    const spot = async w => {
      await A.evaluate(w => document.querySelector(`#shared [data-sh="trkspot:${w}"]`).click(), w);
      await sleep(200);
      await until(A, () => !/^Reading spot/.test(document.querySelector('#shared .sh-trknote').textContent), null, 8000);
      return A.evaluate(() => document.querySelector('#shared .sh-trknote').textContent);
    };
    const nA = await spot('a');
    const t0 = clock();
    F.set(SPOT, t => ({ p: [2 + 0.03 * Math.max(0, t - t0), 0, 0], q: [0, 0, 0, 1] }));   // (sliding 3 cm a second)
    await sleep(300);
    const nB0 = await spot('b'), m0 = (await key(rc)).m;
    F.set(SPOT, still([2, 0, 0]));
    await sleep(400);
    const nB = await spot('b');
    for (let i = 0; i < 30 && !(k && k.m); i++) { await sleep(150); k = await key(rc); }
    const ra = F.raw([0, 0, 0]), rb = F.raw([2, 0, 0]), mErr = k && k.m ? Math.max(dist(k.m.a, ra), dist(k.m.b, rb)) * 1000 : 99;
    check('trackers: lining up by hand through /api/trackers/still: spot A taken, spot B refused while the tracker slides, then taken; trk.m the two points SteamVR reads on the spots (within 0.2 mm)',
      pick && /^Spot A taken/.test(nA) && /^Spot B not taken: tracker LHR-SPOT0001 moved \d+ mm meanwhile/.test(nB0) && m0 === null && /^Lined up by hand: the spots are 2\.00 m apart/.test(nB) && !!k && k.on === true && mErr < 0.2,
      JSON.stringify({ pick, nA, nB0, m0, nB, k, ra, rb, mErr }));
    const st1 = await until(A, () => document.querySelector('#shared .sh-trkst').textContent === 'Lined up by hand (the spots 2.00 m apart): 8 trackers in the room.', null, 6000);
    const used = [];
    for (const p of [A, B, C, H]) used.push(await until(p, () => { const t = HOST.collab.trk(); return t.used && t.l === 'hand' && HOST.collab.trackers().length === 11; }, null, 6000));
    check('trackers: lined up, the dialog says so (the spots 2.00 m apart, 8 trackers) and every page and the headset get the 11 tracked devices (no base station)', st1 && used.every(Boolean),
      JSON.stringify({ st: await A.evaluate(() => document.querySelector('#shared .sh-trkst').textContent), used, n: await B.evaluate(() => HOST.collab.trackers().map(t => t.id)) }));

    // ---- a name typed in the dialog reaches the other pages; a write of one field keeps the others (a newer app's too)
    await until(A, id => !!document.querySelector(`#shared input[data-trkname="${id}"]`), PROP, 5000);
    await A.evaluate(id => { const i = document.querySelector(`#shared input[data-trkname="${id}"]`); i.value = 'Cup'; i.dispatchEvent(new Event('change', { bubbles: true })); }, PROP);
    const named = [];
    for (const p of [B, C, H]) named.push(await until(p, id => HOST.collab.trk().names[id] === 'Cup' && (HOST.collab.trackers().find(t => t.id === id) || {}).name === 'Cup', PROP, 6000));
    const kc = await C.evaluate(() => HOST.collab.trk().key);
    await C.evaluate(v => HOST.collab.publish([['trk', Object.assign({}, v, { zz: 7 })]]), kc);   // (a newer app's field)
    const zz = await until(B, () => !!HOST.collab.trk().key && HOST.collab.trk().key.zz === 7, null, 5000);
    await B.evaluate(id => HOST.collab.trkName(id, 'Spot'), SPOT);
    for (let i = 0; i < 30 && !(k && k.names && k.names[SPOT]); i++) { await sleep(150); k = await key(rc); }
    const kb = await B.evaluate(() => HOST.collab.id);
    check('trackers: a name typed in the dialog reaches the other pages and the headset; another page\'s name kept beside it, and a write of one field keeps the others (on, m, a newer app\'s field), through the relay',
      named.every(Boolean) && zz && !!kc && !!k && k.on === true && JSON.stringify(k.m) === JSON.stringify(kc.m) && JSON.stringify(k.names) === JSON.stringify({ [PROP]: 'Cup', [SPOT]: 'Spot' }) && k.zz === 7 && k.by === kb,
      JSON.stringify({ named, zz, k, kc }));
    if (dir) await A.screenshot({ path: path.join(dir, 'trackers-1-dialog.png') });
    await A.evaluate(() => HOST.collab.dialog(false));

    // ---- the Index, now that the room uses the trackers: lined up by the 'trackers' frame source; the question answered
    // for it
    let lined = false;
    const trace = [], tl0 = Date.now();   // (how it went: the page's relay clock against this machine's, the stream heard, estimates)
    for (let i = 0; i < 40 && !lined; i++) {
      await frames(H, 250);
      const x = await H.evaluate(() => { const t = HOST.collab.trk(); return { lined: HOST.room.src === 'trackers' && !!HOST.room.frame, d: [Math.round(HOST.collab.now() - Date.now()), Math.round(HOST.collab.internals().rtt), t.heard, t.used ? 1 : 0, t.est, HOST.room.state] }; });
      lined = x.lined; trace.push(x.d.join(' '));
    }
    console.log(`      the Index lined up by the trackers in ${((Date.now() - tl0) / 1000).toFixed(1)} s` + (Date.now() - tl0 > 3000 ? ' (each 0.25 s: the page\'s relay clock less this machine\'s, ms; the round trip; heard ms ago; used; estimates; state): ' + trace.join(' | ') : ''));
    await frames(H, 600);
    const ix = await H.evaluate(() => ({ ua: /OculusBrowser|Quest/.test(navigator.userAgent), o: HOST.room.frame && HOST.room.frame.o.slice(), x: HOST.room.frame && HOST.room.frame.x.slice(), src: HOST.room.src,
      lu: HOST.collab.guide().status, here: HOST.collab.internals().hereSet, notes: HOST.collab.notes().map(n => n.title),
      log: window.__collabLog.filter(e => /^(notice|align|here|trackers)/.test(e.ev)).slice(-24).map(e => [e.t, e.ev, e.state || e.title || e.here || ''].join(' ')) }));
    const wantO = unapply(FLOOR, ROOM.slice(0, 3)), wantX = rot(-FLOOR[3], rot(ROOM[3], [1, 0, 0]));
    const ixCm = ix.o ? dist(ix.o, wantO) * 100 : 99, ixDeg = ix.x ? angle(Math.atan2(-ix.x[2], ix.x[0]), Math.atan2(-wantX[2], wantX[0])) * 180 / Math.PI : 99;
    console.log(`      the Index's frame from the trackers: ${ixCm.toFixed(2)} cm and ${ixDeg.toFixed(3)} degrees from the room's`);
    await A.evaluate(() => HOST.collab.dialog(true));
    // (the headset's frames go on meanwhile: its presence, which carries how it lines up, goes out from them)
    const [luA] = await Promise.all([until(A, () => /lined up \(the PC's trackers[,)]/.test((document.querySelector('#shared .sh-lu') || {}).textContent || ''), null, 8000), frames(H, 3000)]);
    const luT = await A.evaluate(() => (document.querySelector('#shared .sh-lu') || {}).textContent || '');
    await A.evaluate(() => HOST.collab.dialog(false));
    check('trackers: a pretend VR headset that is not a Quest\'s browser, its head the fake\'s Index, in VR asked whether it is in the room until the trackers come, then lined up by them (src trackers) within 1 cm and 0.5 degrees; lineUp says so, the question is answered for it (In the room), never asked to calibrate meanwhile, the pages\' list says lined up (the PC\'s trackers)',
      ask0[0] === 'ask' && ask0[1] !== 'trackers' && !ask0[2].includes('Calibrate the room') && lined && !ix.ua && ix.src === 'trackers' && ixCm < 1 && ixDeg < 0.5 && ix.lu.k === 'ok' && ix.lu.h === 'trackers' && ix.lu.text === 'Lined up by the PC\'s trackers' && ix.here === true && ix.notes.includes('In the room') && !ix.notes.includes('Calibrate the room') && luA,
      JSON.stringify({ ask0, lined, ix, wantO, wantX, ixCm, ixDeg, luA, luT, trace }));

    // ---- every page and the headset: the trackers in room coordinates within 2 mm of the truth at one held relay time
    const hT = await held([A, B, C, H], (p, T) => p.evaluate(T => { HOST.collab.trkTime(T); return HOST.collab.trackers().map(t => ({ id: t.id, kind: t.kind, p: t.p, q: t.q, ok: t.ok })); }, T));
    let tmm = 0, tdeg = 0, kinds = true, ids = true;
    const want = devices.filter(d => d.k !== 'base').map(d => d.s).sort().join();
    for (const L of hT.out) {
      if (L.map(t => t.id).sort().join() !== want) ids = false;
      for (const t of L) {
        const d = devices.find(x => x.s === t.id);
        if (!d || t.kind !== kindOf(d) || !t.ok) { kinds = false; continue; }
        const w = truthAt(t.id, hT.D);
        tmm = Math.max(tmm, dist(t.p, w.p) * 1000); tdeg = Math.max(tdeg, qAngle(t.q, w.q));
      }
    }
    console.log(`      the trackers at a held time on 3 pages and the headset: within ${tmm.toFixed(2)} mm and ${tdeg.toFixed(3)} degrees of the truth`);
    check('trackers: every page and the headset have the 11 devices (their kinds t, h, l, r; never the base station) in room coordinates within 2 mm and 0.2 degrees of the truth at one held relay time',
      hT.caught.every(Boolean) && ids && kinds && tmm < 2 && tdeg < 0.2, JSON.stringify({ caught: hT.caught, ids, kinds, tmm, tdeg, n: hT.out.map(L => L.length) }));

    // ---- a studio circle for the test scene where the Index stands: it walks in, the pages follow
    const sid = await A.evaluate(b => HOST.collab.addScene('test', b), { x: IDX.x, z: IDX.z, yaw: IDX.yaw });
    await until(A, () => !HOST.collab.internals().pending.size, null, 5000);
    const st = await A.evaluate(id => HOST.collab.station(id), sid);
    const inS = !!st && await walk(H, st, 'studio', ROOM[3] + IDX.yaw, 90000);
    for (const p of [A, B, C]) await p.evaluate(id => HOST.collab.follow(id), sid);
    for (const p of [A, B, C]) await ready(p, 'studio', 90000);
    const sc0 = [];
    for (const p of [A, B, C, H]) sc0.push(await sUntil(p, `STU.scene === 'test' && STUDIO.ready() && atStation() && TRK.st !== '' && TRK.at.size === 11`, 90000));
    const stillLined = await H.evaluate(() => HOST.room.src === 'trackers');
    check('trackers: the headset walks into a studio circle for the test scene where it stands (still lined up by the trackers), three pages follow it; every device has the 11 trackers in the studio',
      !!sid && inS && sc0.every(Boolean) && stillLined, JSON.stringify({ sid, inS, sc0, stillLined, at: await Promise.all([A, B, C, H].map(p => sp(p, `[STU.scene, STUDIO.ready(), atStation(), TRK.st, TRK.at.size]`))) }));

    // ---- a shape set (on a page's card) to follow the prop tracker going round: drawn where it should be on every device
    await sp(A, `(setEdit(true), putItem('tkp001', 'p', norm('p', { name: 'Lamp', shape: 'cube', p: [1.4, 1.2, 0.8], q: [0, 0.2588, 0, 0.9659], size: [0.2, 0.3, 0.15] })), 0)`);
    const gotP = [];
    for (const p of [B, C, H]) gotP.push(await sUntil(p, `!!STU.items.get('tkp001')`, 10000));
    await sp(A, `(select('tkp001'), itemAct('trk', '${PROP}', 'tkp001'), select(''), 0)`);
    const rt = await sp(A, `STU.items.get('tkp001').rec.trk`);
    const gotT = [];
    for (const p of [B, C, H]) gotT.push(await sUntil(p, `(STU.items.get('tkp001').rec.trk || {}).id === '${PROP}'`, 10000));
    await sleep(1000);
    const hS = await held([A, B, C, H], async (p, T) => {
      await p.evaluate(T => HOST.collab.trkTime(T), T);
      if (p === H) await frames(H, 700); else await sleep(700);
      return sp(p, `(() => { const P = STUDIO.pose('tkp001'), m = new THREE.Matrix4().fromArray(P.drawn || P.placed), a = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(a, q, s); return { p: a.toArray(), q: q.toArray(), moving: P.moving, on: STUDIO.trk('tkp001').item.on }; })()`);
    });
    const tp = truthAt(PROP, hS.D), wp = rt ? qRot(tp.q, rt.o).map((v, i) => v + tp.p[i]) : null, wq = rt ? qMul(tp.q, rt.q) : null;
    let smm = 0, sdeg = 0;
    for (const o of hS.out) { smm = Math.max(smm, wp ? dist(o.p, wp) * 1000 : 99); sdeg = Math.max(sdeg, wq ? qAngle(o.q, wq) : 99); }
    console.log(`      a shape on the prop tracker at a held time on 3 pages and the headset: within ${smm.toFixed(2)} mm and ${sdeg.toFixed(3)} degrees of where it should be`);
    check('trackers: a shape set on a page\'s card to follow the prop tracker going round is drawn where the tracker\'s true pose and its offset put it, on every page and the headset at one held time (within 5 mm and 0.5 degrees)',
      gotP.every(Boolean) && !!rt && gotT.every(Boolean) && hS.caught.every(Boolean) && hS.out.every(o => o.moving && o.on) && smm < 5 && sdeg < 0.5, JSON.stringify({ gotP, rt, gotT, caught: hS.caught, smm, sdeg, out: hS.out, want: [wp, wq] }));

    // ---- the puppet scene; the spot and prop trackers put away (switched off), the performer standing in a T-pose
    await sp(A, `(openScene('puppet', 'pick'), 0)`);
    const pu = [];
    for (const p of [A, B, C, H]) pu.push(await sUntil(p, `STU.scene === 'puppet' && STUDIO.ready() && !!(STU.items.get('pup001') || {}).model`, 90000));
    F.off(SPOT); F.off(PROP);
    await sleep(1200);
    await sp(A, `(setEdit(true), select('pup001'), itemAct('pwear', 'full', 'pup001'), itemAct('pupline', '', 'pup001'), 0)`);
    const count = await sp(A, `!!PUP.line`);
    const lu = await sUntil(A, `!PUP.line && !!(STU.items.get('pup001').rec.puppet || {}).on`, 15000);
    const pr = await sp(A, `[STU.items.get('pup001').rec, PUP.note]`), rec = pr[0];
    const mapOk = !!rec.puppet && !!rec.puppet.map && Object.keys(rec.puppet.map).length === 6 && PF.parts.every(s => rec.puppet.map[s] === PF.ID[s]) && Object.keys(rec.puppet.cal || {}).length === 6;
    const recs = [];
    for (const p of [B, C, H]) recs.push(await sUntil(p, `JSON.stringify(STU.items.get('pup001').rec.puppet) === ${JSON.stringify(JSON.stringify(rec.puppet))} && STUDIO.puppet('pup001').on`, 10000));
    check('trackers: the puppet scene picked for the circle; the rig worn whole body and lined up from the performer\'s T-pose (after its 5 s countdown) through the relay\'s trackers: its six parts found, moved to where the performer stands (within 3 mm), sized to them, the record and its solving on every device',
      pu.every(Boolean) && count && lu && mapOk && Math.hypot(rec.p[0] - AT.x, rec.p[2] - AT.z) < 0.003 && Math.abs(rec.s - 1) < 0.002 && recs.every(Boolean), JSON.stringify({ pu, count, lu, mapOk, rec, note: pr[1], recs }));

    // ---- the performer walks: at one held time every device's solved bones within 1 degree of each other (and its hands
    // and feet where the performer's are)
    PF.walk0 = clock();
    await frames(H, 2500);
    const hB = await held([A, B, C, H], async (p, T) => {
      await p.evaluate(T => HOST.collab.trkTime(T), T);
      if (p === H) await frames(H, 900); else await sleep(900);
      return sp(p, `(() => { const it = STU.items.get('pup001'), R = pupRig(it); GL.items.updateMatrixWorld(true); const W = n => GL.items.worldToLocal(R.bones[n].getWorldPosition(new THREE.Vector3())).toArray();
        return { q: R.parts.map(n => R.bones[n].quaternion.toArray()), at: Object.fromEntries(['hips', 'lhand', 'rhand', 'lfoot', 'rfoot'].map(n => [n, W(n)])), on: STUDIO.puppet('pup001').on, why: STUDIO.puppet('pup001').why }; })()`);
    });
    let bdeg = 0, emm = 0;
    const tb = PF.bones((hB.D - T0) / 1000), A0 = hB.out[0], b0 = PF.bones(PF.walk0);
    for (const o of hB.out) {
      if (!o.on || o.q.length !== A0.q.length) { bdeg = 99; continue; }
      o.q.forEach((q, i) => { bdeg = Math.max(bdeg, qAngle(q, A0.q[i])); });
      for (const s of ['lhand', 'rhand', 'lfoot', 'rfoot']) emm = Math.max(emm, dist(o.at[s], tb[s]) * 1000);
    }
    const moved = Math.max(...['lhand', 'rhand', 'lfoot', 'rfoot'].map(s => dist(b0[s], tb[s])));
    console.log(`      the worn rig at a held time: ${A0.q.length} bones on 3 pages and the headset within ${bdeg.toFixed(4)} degrees of each other; its hands and feet within ${emm.toFixed(2)} mm of the performer's`);
    check('trackers: the performer walking, every page\'s and the headset\'s solved bones within 1 degree of each other at one held time (and its hands and feet within 1 cm of the performer\'s)',
      hB.caught.every(Boolean) && A0.q.length >= 20 && bdeg < 1 && emm < 10 && moved > 0.05, JSON.stringify({ caught: hB.caught, bdeg, emm, moved, why: hB.out.map(o => o.why) }));

    // ---- a 3 s take on the page (its 3 s countdown), saved through the relay as models/rig.glb with Take 1; another page
    // switches to it and plays Take 1 once the character is worn no more
    await sp(A, `(select('pup001'), itemAct('take', '', 'pup001'), 0)`);
    const rec0 = await sUntil(A, `!!PUP.take && PUP.take.phase === 'rec'`, 8000);
    const rec3 = await sUntil(A, `!!PUP.take && PUP.take.samples.length > 1 && PUP.take.samples[PUP.take.samples.length - 1].t >= 3`, 15000);
    const nk = await sp(A, `PUP.take ? PUP.take.samples.length : 0`);
    await sp(A, `(itemAct('takestop', '', 'pup001'), 0)`);
    const made = await sUntil(A, `!PUP.take`, 90000);
    const note = await sp(A, `STUDIO.puppet('pup001').note`), glbPath = path.join(SC, 'puppet', 'models', 'rig.glb');
    let clips = '', tdur = 0, tracks = 0;
    if (fs.existsSync(glbPath)) {
      const g = fs.readFileSync(glbPath);
      const gl = await new Promise((res, rej) => new globalThis.THREE.GLTFLoader().parse(g.buffer.slice(g.byteOffset, g.byteOffset + g.length), '', res, rej)).catch(() => null);
      if (gl) { clips = gl.animations.map(a => a.name).sort().join(); const tk = gl.animations.find(a => a.name === 'Take 1'); tdur = tk ? tk.duration : 0; tracks = tk ? tk.tracks.length : 0; }
    }
    console.log(`      a take of ${nk} keys: models/rig.glb with ${clips || 'no clips'}, Take 1 ${tdur.toFixed(2)} s and ${tracks} tracks`);
    check('trackers: a 3 s take (its countdown, then recorded on the room\'s clock, Stop) saved through the relay as models/rig.glb with its Walk and Take 1 (about 3 s, a track per part and the hips\' place)',
      rec0 && rec3 && made && /^Take 1 \(/.test(note) && clips === 'Take 1,Walk' && tdur >= 2.9 && tdur < 4.5 && tracks === 24, JSON.stringify({ rec0, rec3, nk, made, note, clips, tdur, tracks }));
    const sw = await sUntil(B, `STU.items.get('pup001').rec.file === 'models/rig.glb' && !!STU.items.get('pup001').model && ((STU.items.get('pup001').E || {}).clips || []).some(c => c.name === 'Take 1')`, 30000);
    await sp(A, `(itemAct('pupon', 'off', 'pup001'), setRec('pup001', { clip: 'Take 1', anim: 'loop', start: 'always' }), 0)`);
    const plays = await sUntil(B, `(() => { const it = STU.items.get('pup001'); return !STUDIO.puppet('pup001').on && !!it.action && it.action.getClip().name === 'Take 1' && it.action.isRunning(); })()`, 15000);
    const bonesB = () => sp(B, `(() => { const R = pupRig(STU.items.get('pup001')); return R.parts.map(n => R.bones[n].quaternion.toArray()); })()`);
    const q1 = await bonesB();
    await sleep(700);
    const q2 = await bonesB(), rest = await sp(B, `(() => { const R = pupRig(STU.items.get('pup001')); return R.parts.map(n => R.rest[n].q.toArray()); })()`);
    const step = Math.max(...q1.map((q, i) => qAngle(q, q2[i]))), fromRest = Math.max(...q2.map((q, i) => qAngle(q, rest[i])));
    check('trackers: another page switches to models/rig.glb with Take 1 and plays it once the character is worn no more (its bones moving, some degrees from rest)',
      sw && plays && step > 1 && fromRest > 5, JSON.stringify({ sw, plays, step, fromRest }));
  } finally {
    for (const p of pages) { await p.evaluate(() => window.__xr && window.__xr.end()).catch(() => {}); await p.context().close().catch(() => {}); }
    if (F) F.stop();
    await relayOff(R);
    fs.rmSync(SC, { recursive: true, force: true });
  }
}
// ---- studio scenes as circles (scenesRound; --studio-scenes runs only it, also in the main run after the studio round): a
// relay of its own with --scenes on the test scenes (read only). The page's Add lists, after the studio, one entry per
// scene ("Studio: <scene>"); adding one makes a studio station whose state names that scene, in one batch, for every page;
// two studio circles stand at once (and a third, plain); their titles in the dialog's rows are "Studio: <scene>"; Studio
// here adds the room's plain studio circle, then moves it, also once a scene is picked there (plain or not is how a circle
// was made, its record's sc, never its state); a scene circle moved keeps its sc
async function scenesRound() {
  const R = await relayOn(['--static', '.', '--scenes', path.join(root, 'tools', 'studio', 'test', 'scenes'), '--scenes-readonly', '--quiet'], {}, 8770);
  const b = `http://127.0.0.1:${R.port}/`, pages = [];
  const sopen = async hash => {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('scenes round: ' + (e.stack || e.message)));
    p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('scenes round: ' + m.text()); });
    await p.goto(b + 'index.html' + hash, { timeout: 90000 });
    await p.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
    pages.push(p);
    return p;
  };
  try {
    const list = await (await fetch(b + 'api/scenes')).json(), names = list.scenes.map(s => s.name).sort();
    const A = await sopen('#stories');
    await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
    await until(A, () => HOST.collab.status === 'open', null, 10000);
    const rc = await A.evaluate(() => HOST.collab.code), B = await sopen('#s=' + rc);
    await until(B, () => HOST.collab.status === 'open', null, 20000);
    // the dialog's Add: after the studio, one entry per scene, then All stories and Back to the lobby
    const opts = await A.evaluate(async () => {
      HOST.collab.dialog(true);
      for (let k = 0; k < 50 && ![...document.querySelectorAll('#shAdd option')].some(o => /^scene:/.test(o.value)); k++) await new Promise(r => setTimeout(r, 100));
      return [...document.querySelectorAll('#shAdd option')].map(o => [o.value, o.textContent]);
    });
    const vals = opts.map(o => o[0]), si = vals.indexOf('studio'), sc = opts.filter(o => /^scene:/.test(o[0]));
    check('scenes: the page\'s Add lists, after the studio, one entry per scene of the studio\'s relay ("Studio: <scene>"), then All stories and Back to the lobby',
      si > 0 && sc.map(o => o[0].slice(6)).sort().join() === names.join() && sc.every(o => o[1] === 'Studio: ' + o[0].slice(6)) && vals.indexOf(sc[0][0]) === si + 1 &&
      vals.slice(si + 1 + sc.length).join() === 'all,lobby', JSON.stringify({ opts: opts.slice(si), names }));
    // adding "Studio: test": a studio station whose state names the scene, in one batch, for every page
    const add = v => A.evaluate(async v => {
      const n0 = HOST.collab.stations().length, sel = document.querySelector('#shAdd'); sel.value = v; document.querySelector('[data-sh="add"]').click();
      for (let k = 0; k < 30 && HOST.collab.stations().length === n0; k++) await new Promise(r => setTimeout(r, 100));
      return HOST.collab.stations().slice(n0).map(s => s.id)[0] || '';
    }, v);
    const id1 = await add('scene:test');
    const seen1 = !!id1 && await until(B, id => { const s = HOST.collab.station(id), x = HOST.collab.val('st.' + id + '.x'); return !!s && s.story === 'studio' && JSON.stringify(x) === '{"scene":"test"}'; }, id1, 5000);
    const k1 = (await roomInfo2(b, rc)).keys, st1 = k1['st.' + id1], x1 = k1['st.' + id1 + '.x'];
    check('scenes: adding "Studio: test" makes a studio station whose state names the scene (st.<id> and st.<id>.x, written together), for every page',
      seen1 && !!st1 && !!x1 && JSON.stringify(x1.v) === '{"scene":"test"}' && st1.v.story === 'studio' && st1.v.sc === true && Object.keys(st1.v).sort().join() === 'sc,story,x,yaw,z', JSON.stringify({ id1, st1, x1 }));
    // two studio circles at once, each titled by its scene (the dialog's rows, on both pages)
    const id2 = await add('scene:' + names.find(n => n !== 'test'));
    const rows = p => p.evaluate(async () => { HOST.collab.dialog(true); await new Promise(r => setTimeout(r, 300)); const t = [...document.querySelectorAll('#shared .sh-stations li b')].map(e => e.textContent); return t; });
    await until(B, id => !!HOST.collab.station(id) && !!HOST.collab.val('st.' + id + '.x'), id2, 5000);
    const rA = await rows(A), rB = await rows(B), want = ['Studio: test', 'Studio: ' + names.find(n => n !== 'test')];
    check('scenes: two studio circles stand at once, each titled "Studio: <scene>" in every page\'s dialog', !!id2 && want.every(t => rA.includes(t) && rB.includes(t)), JSON.stringify({ rA, rB, want }));
    // Studio here: with no plain studio circle it adds one at your feet; with that one alone (no scene), it moves it
    const h1 = await A.evaluate(() => HOST.collab.studio({ x: 3, z: 1, yaw: 0.2 })), n3 = await A.evaluate(() => HOST.collab.stations().filter(s => s.story === 'studio').length);
    await sleep(400);
    const h2 = await A.evaluate(() => HOST.collab.studio({ x: 3.5, z: 1.5, yaw: 0.4 })), n4 = await A.evaluate(() => HOST.collab.stations().filter(s => s.story === 'studio').length);
    const moved = await until(B, ([id]) => { const s = HOST.collab.station(id); return !!s && Math.abs(s.x - 3.5) < 1e-6 && Math.abs(s.z - 1.5) < 1e-6; }, [h1], 5000);
    const rB2 = await rows(B);
    check('scenes: Studio here adds a plain studio circle beside the scenes\' (titled "Studio") and then moves that one, the only plain one', !!h1 && ![id1, id2].includes(h1) && n3 === 3 && h2 === h1 && n4 === 3 && moved &&
      rB2.includes(await B.evaluate(() => HOST.meta('studio').title)), JSON.stringify({ h1, h2, n3, n4, moved, rB2 }));
    // a scene picked at that plain circle (its state names it, as the studio writes it there): still the room's plain one,
    // so Studio here moves it again rather than adding a fourth (plain or not is how a circle was made, never its state)
    await A.evaluate(id => HOST.collab.publish([['st.' + id + '.x', { scene: 'test' }]]), h1);
    const picked = await until(B, id => HOST.collab.sceneOf(id) === 'test', h1, 5000), rB3 = await rows(B);
    const h3 = await A.evaluate(() => HOST.collab.studio({ x: 4, z: 2, yaw: 0.6 })), n5 = await A.evaluate(() => HOST.collab.stations().filter(s => s.story === 'studio').length);
    const moved3 = await until(B, ([id]) => { const s = HOST.collab.station(id); return !!s && Math.abs(s.x - 4) < 1e-6 && Math.abs(s.z - 2) < 1e-6; }, [h1], 5000);
    check('scenes: a scene picked at the plain studio circle (titled "Studio: test" then) and Studio here still moves that one, no fourth circle', picked && h3 === h1 && n5 === 3 && moved3 &&
      rB3.filter(t => t === 'Studio: test').length === 2, JSON.stringify({ picked, h3, n5, moved3, rB3 }));
    // a scene circle moved keeps its mark (every move writes it again), and Studio here then still moves the plain one
    await A.evaluate(id => HOST.collab.move(id, { x: -3, z: 2, yaw: 0.3 }), id1);
    const kept = await until(B, id => { const s = HOST.collab.station(id); return !!s && Math.abs(s.x + 3) < 1e-6 && s.sc === true; }, id1, 5000);
    const st1b = (await roomInfo2(b, rc)).keys['st.' + id1];
    const h4 = await A.evaluate(() => HOST.collab.studio({ x: 4.5, z: 2.5, yaw: 0.8 })), n6 = await A.evaluate(() => HOST.collab.stations().filter(s => s.story === 'studio').length);
    check('scenes: a scene circle moved keeps its mark (sc), and Studio here then still moves the plain one', kept && !!st1b && st1b.v.sc === true && Math.abs(st1b.v.x + 3) < 1e-6 &&
      h4 === h1 && n6 === 3, JSON.stringify({ kept, st1b, h4, n6 }));
  } finally {
    for (const p of pages) await p.context().close().catch(() => {});
    await relayOff(R);
  }
}
const roomInfo2 = async (b, code) => (await fetch(b + 'api/rooms/' + code)).json();

// ---- others' moves drawn smoothly (snapshot interpolation, shared.js's SMOOTH): a raw socket at a station (speaking as the
// follow-a-person test's pretend person does) turns the station's scene steadily about the vertical (90 degrees a second)
// at 15 Hz with ts and h, each send up to 25 ms late, then lets go; a pretend headset standing at that station records
// its scene's turn every frame. Pass: after 0.5 s no frame without motion while the writer turns, the speed per frame
// within 35 % of the writer's in at least 85 % of frames, about DELAY behind (within 80 ms), and landing exactly where it
// was let go with no overshoot, at the frame that reaches it (no glide on top). The same for the station's panel, another
// station carried by the grip (its ring), the explore view (the headset writing nothing meanwhile) and a person's head
// (0.5 m/s). A place or view with no ts still glides; a sample written for another story moves nothing; a grip here right
// after someone else let go is never pulled back to where they left it; a held grip on the headset writes at most 16
// place values a second
function writer(code, id) {
  const W = { id, sets: [], cid: 0, ws: new WebSocket(`ws://127.0.0.1:${port}/api/ws?room=${code}&id=${id}&proto=1`) };
  W.open = new Promise((res, rej) => { W.ws.onopen = res; W.ws.onerror = () => rej(new Error('the writer\'s socket failed')); });
  W.ws.onmessage = e => { let m = null; try { m = JSON.parse(e.data); } catch (err) { return; } if (m && m.t === 'set') W.sets.push({ at: Date.now(), by: m.by, batch: m.batch || [] }); };
  W.open.then(() => W.ws.send(JSON.stringify({ t: 'hello', name: 'Spinner', color: '#ff7a59', kind: 'ar', here: true, version: FORMAT, proto: 1, dev: 'headset' })), () => {});
  W.set = (k, v) => { if (W.ws.readyState === 1) W.ws.send(JSON.stringify({ t: 'set', batch: [[k, v]], cid: 'w' + ++W.cid })); };
  W.fx = (k, v) => { if (W.ws.readyState === 1) W.ws.send(JSON.stringify({ t: 'fx', k, v })); };
  W.close = () => { try { W.ws.close(1000); } catch (e) { /* closed */ } };
  return W;
}
// a writer's move: every 66 ms for ms the value f(s since the start) at that moment, stamped with the relay's time (the
// relay runs on this machine: Date.now) and sent up to 25 ms late, as over a busy network; then, 66 ms on, once more
// without h (let go). send(v, ts, held)
async function drive(send, ms, f) {
  const t0 = Date.now(), held = [];
  const out = (v, ts, h) => setTimeout(() => send(v, ts, h), Math.random() * 25);
  for (let k = 1; k * 66 <= ms; k++) {
    await sleep(Math.max(0, t0 + k * 66 - Date.now()));
    const ts = Date.now();
    held.push(ts); out(f((ts - t0) / 1000), ts, true);
  }
  await sleep(Math.max(0, held[held.length - 1] + 66 - Date.now()));
  const end = Date.now(), last = f((end - t0) / 1000);
  out(last, end, false);
  await sleep(40);
  return { t0, held, end, last };
}
// a pretend headset's frames for ms, each recorded after it ran: [the time its frame drew others' moves for (the shell's
// tick), the relay's time then, the render time (what it drew), what] (what: 'rot' its scene's turn about the vertical,
// 'size' its size, 'view' its explore view's first component (the turn) as it stands, 'head:<id>' where it draws that
// person's head, x). (Its page renders the story in between, which takes long in software and varies, and a machine busy
// with other pages stalls now and then: the frame's own time is the one its moves were drawn for)
const record = (page, ms, what) => page.evaluate(async ([ms, what]) => {
  const X = window.__xr, out = [], t0 = performance.now();
  const get = () => {
    if (what === 'rot') { const q = HOST.cur.xrPose().rot; return 2 * Math.atan2(q.y, q.w); }
    if (what === 'size') return HOST.cur.xrPose().s;
    if (what === 'x') return HOST.cur.xrPose().off.x;
    if (what === 'panel') return HOST.cur.xrPose().pp.x;
    if (what === 'view') return HOST.cur.peek('orbit.cur[0]');
    if (what.startsWith('ring:')) { const o = HOST.collab.overlay().rings.get(what.slice(5)); return o ? o.g.position.x : null; }
    const o = HOST.collab.overlay().people.get(what.slice(5));
    return o && o.e ? o.e.p.x : null;
  };
  while (performance.now() - t0 < ms) {
    X.step();
    const S = HOST.collab.smooth();
    out.push([S.RT.at, HOST.collab.now() - (performance.now() - S.RT.at), S.RT.t, get()]);
    await new Promise(r => setTimeout(r, 16));
  }
  return out;
}, [ms, what]);
// frames on until the render time is past relay time T (at most ms)
const drawnPast = (page, T, ms) => until(page, T => { window.__xr.step(); return HOST.collab.smooth().RT.t > T; }, T, ms || 10000);
// how steadily a recording follows a writer whose value went x0 + rate * (s since t0) until its last held sample: the frames
// whose render time falls between 0.5 s in and that sample. Returns the frames, the share within 35 % of the writer's speed,
// the frames without motion, the median lag behind the writer (ms) and the speeds' 5th, 50th and 95th percentile (of rate)
function steadiness(rec, rate, t0, x0, lastHeld) {
  const win = rec.filter(f => f[2] >= t0 + 500 && f[2] <= lastHeld - 20);
  let ok = 0, still = 0, n = 0;
  const speeds = [];
  for (let i = 1; i < win.length; i++) {
    const dt = (win[i][0] - win[i - 1][0]) / 1000, dx = win[i][3] - win[i - 1][3];
    if (dt <= 0) continue;
    n++;
    if (Math.abs(dx) < 1e-6) still++;
    speeds.push(dx / dt / rate);
    if (Math.abs(dx / dt / rate - 1) <= 0.35) ok++;
  }
  const lags = win.map(f => f[1] - (t0 + (f[3] - x0) / rate * 1000));
  const med = a => { const b = a.slice().sort((p, q) => p - q); return b.length ? b[b.length >> 1] : NaN; };
  const sp = speeds.slice().sort((p, q) => p - q), pct = k => (sp.length ? sp[Math.min(sp.length - 1, Math.floor(k * sp.length))] : NaN);
  return { frames: n, share: n ? ok / n : 0, still, lag: med(lags), spread: [pct(0.05), med(speeds), pct(0.95)].map(v => +v.toFixed(2)) };
}
// an angle recorded in [-full/2, full/2] taken round to the turn nearest where the writer had it at the frame's render time
// (a frame after a stall can be more than half a turn on)
const turnNear = (rec, rate, t0, x0, end, full) => rec.map(f => {
  const want = x0 + rate * Math.min(Math.max(f[2] - t0, 0), end - t0) / 1000;
  return [f[0], f[1], f[2], f[3] + full * Math.round((want - f[3]) / full)];
});
// ---- a room by its code from a headset's menu (the owner, 30 October 2026: "Joining a room with code not possible in
// ar/vr?"; --code runs only this, a minute): a pretend headset in no room opens the menu's Join with a code, types the
// room's three letters on its keypad (Join greyed until then, Delete taking one back) and joins; in the room the menu's
// Another room opens the keypad again, the room's own code greyed, and a code with no room behind it says so
async function codeRound() {
  const A = await open('#stories');
  await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(A, () => HOST.collab.status === 'open', null, 10000);
  const rc = await A.evaluate(() => HOST.collab.code);
  const H = await open('#airports', { width: 320, height: 200 });
  await ready(H, 'airports');
  await H.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [0, 1.6, 0, 0] });
  await H.evaluate(() => { window.__xr.begin(); HOST.collab.panelOpen(true); });
  await frames(H, 300);
  // a press on the menu (a region's own function, as a ray or a fingertip gives it), then a frame so it draws again
  const tap = id => H.evaluate(async id => { const X = window.__xr, r = HOST.collab.menuFind(id), ok = !!(r && r.fn); if (ok) r.fn();
    for (let k = 0; k < 2; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); } return ok; }, id);
  const has = id => H.evaluate(id => { const r = HOST.collab.menuFind(id); return r ? !!r.fn : null; }, id);
  const page = await tap('codepage'), join0 = await has('code:join');
  let typed = true;
  for (const ch of rc) typed = (await tap('key:' + ch)) && typed;
  const typo = await tap('key:Q'), del = await tap('code:del');   // (a fourth letter refused; Delete takes the third back)
  for (const ch of rc.slice(2)) typed = (await tap('key:' + ch)) && typed;
  const ready3 = await has('code:join'), joined = (await tap('code:join')) && await until(H, c => HOST.collab.code === c && HOST.collab.status === 'open', rc, 10000);
  check('a headset in no room joins one by its code: the menu\'s Join with a code, its keypad (Join greyed until three letters, a fourth refused, Delete), then Join',
    page && join0 === null && typed && !typo && del && ready3 === true && joined, JSON.stringify({ page, join0, typed, typo, del, ready3, joined, code: await H.evaluate(() => [HOST.collab.code, HOST.collab.status]) }));
  // in the room: Another room opens the keypad again; its own code greyed; a code with no room says so
  await frames(H, 300);
  const again = await tap('codepage');
  for (const ch of rc) await tap('key:' + ch);
  const same = await has('code:join');
  for (let k = 0; k < 3; k++) await tap('code:del');
  const bad = rc === 'QQZ' ? 'QQY' : 'QQZ';
  for (const ch of bad) await tap('key:' + ch);
  await tap('code:join');
  const out = await until(H, () => !HOST.collab.joined && /no room/i.test(HOST.collab.internals().note), null, 8000);
  check('in a room the menu\'s Another room opens the keypad (the room\'s own code greyed), and a code with no room behind it says so',
    again && same === null && out, JSON.stringify({ again, same, out, note: await H.evaluate(() => HOST.collab.internals().note) }));
  await H.evaluate(() => window.__xr.end());
  await H.context().close(); await A.context().close();
}

// ---- the room's arc and the All stories and Back to the lobby circles (v104, v109; --all runs only this, rooms of its
// own, several minutes). A page on a story starts a room: the room's arc (an All stories circle at the room's origin, its
// only station) is made, and the page follows it and shows its Stories screen without Follow, as a page joining does;
// the first headset moves it to where it stands, facing its way, and is at it without walking in (its cards there,
// the scene hidden, nothing of it drawn, the rig at its spot, its presence there); a card pressed there picks that story
// for everyone (from its start, playing), and the story panel's Stories button goes back to the cards; the grip on its
// cards carries it for everyone (held writes, then where it was let go), the room map moves it (the headset's cards
// glide there), the circles lock refuses the grip, Move here puts it at the headset; Add from the headset turns it into
// a circle where it stands (the headset still at it, its ring now drawn while outside it; the pages still following);
// then as for any All stories circle: its switch on (the menu's row) joining the room's circle of that story, state and
// clock both ways, off again (the dialog's toggle) its own keys; the linked circle given another story; the dialog's
// picker; the lobby (no Follow): walking in ends the headset's story, every ring and card showing; a story circle, then
// the All stories circle walked into again (its cards); Arrange all leaves both kinds. Then an arc turned into a circle
// by Arrange all and by adding the lobby, and left one when every other circle goes; removed, it does not come back; a
// headset first in a room of its own makes the arc in front of itself; a room kept from before v109 (all01 without arc,
// alone) is the arc once joined
async function allRound() {
  const PK = PICK_STORY, T = ALL_T, AID = 'all01';
  const A = await open('#airports', null, true);
  await ready(A, 'airports');
  await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(A, () => HOST.collab.status === 'open', null, 10000);
  const rc = await A.evaluate(() => HOST.collab.code);
  const kinds = p => p.evaluate(() => HOST.collab.stations().filter(s => s.kind).map(s => ({ id: s.id, kind: s.kind, story: s.story, sync: s.sync, arc: s.arc, x: s.x, z: s.z, yaw: s.yaw })));
  const arcOf = p => p.evaluate(() => { const s = HOST.collab.arc(); return s && { id: s.id, kind: s.kind, story: s.story, arc: s.arc, x: s.x, z: s.z, yaw: s.yaw }; });
  const keysOf = (p, id) => p.evaluate(id => [...new Set([...HOST.collab.internals().keys.keys()])].filter(k => k.startsWith('st.' + id + '.')).sort(), id);
  const following = (p, id, ms) => until(p, id => HOST.collab.following() === id && HOST.picking, id, ms || 5000);
  // the room's arc, made by the page that started the room: it follows it and shows its Stories screen
  const made = await until(A, () => !!HOST.collab.arc(), null, 8000);
  const a0 = await arcOf(A), p0 = await A.evaluate(() => HOST.collab.val('allp')), aOn = await following(A, AID);
  check('arc: a page that starts a room makes the room\'s arc (an All stories circle at the room\'s origin, its only station; allp a page\'s) and shows its Stories screen, following it without Follow',
    made && !!a0 && a0.id === AID && a0.kind === 'all' && a0.story === 'all' && a0.arc === true && !a0.x && !a0.z && !a0.yaw && !!p0 && p0.pg === 1 && aOn && (await A.evaluate(() => HOST.collab.stations().length)) === 1,
    JSON.stringify({ made, a0, p0, aOn }));
  const B = await open('#s=' + rc, { width: 480, height: 320 }, true), H = await open('#s=' + rc, { width: 320, height: 200 }, true);
  const bOn = await following(B, AID, 20000);
  check('arc: a page joining the room follows the arc and shows its Stories screen (no Follow), and makes no arc of its own', bOn && (await B.evaluate(() => HOST.collab.stations().length)) === 1,
    JSON.stringify({ bOn, b: await B.evaluate(() => [HOST.collab.following(), HOST.picking, HOST.collab.stations().length]) }));
  // (frames on the pretend headset until fn is true there: a page drawing in software takes its time)
  const stepUntil = async (fn, arg, ms) => { const t0 = Date.now(); for (;;) { await frames(H, 300); if (await H.evaluate(fn, arg)) return true; if (Date.now() - t0 > ms) return false; } };
  // (the pretend session never presents, so the stories' own xrUpdate does not run: it is run here, and the panels drawn)
  const redraw = () => H.evaluate(() => HOST.cur.peek('xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS), XR.panels.forEach(P => { P.last = ""; P.t = -1e9; panelTick(P, performance.now() + 1e6); })'));
  // the first headset: aligned in the room, in AR, it moves the page's arc in front of its head, facing away from it
  await ready(H, 'airports');
  const aId = await A.evaluate(() => HOST.collab.id), hId = await H.evaluate(() => HOST.collab.id);
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);
  await H.evaluate(() => HOST.room.sharedAlign(true));
  const HEAD = { x: -0.4, z: 1.5, yaw: 0.35 };   // (the head in the room: facing a little to the left of -z)
  await H.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: headAt(HEAD, ROOM[3] + HEAD.yaw), autoAll: true });
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 400);
  await H.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'U1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
  const want = [HEAD.x, HEAD.z], at = (w, s) => !!s && Math.hypot(s.x - w[0], s.z - w[1]) < 0.06;
  // (aligned first: through the shared space a busy machine may take a while; then the 1.5 s the headset waits)
  const t0 = Date.now(), aligned = await stepUntil(() => HOST.room.aligned, null, 30000), tAl = Date.now() - t0;
  const moved = aligned && await stepUntil(w => { const s = HOST.collab.arc(); return !!s && Math.hypot(s.x - w[0], s.z - w[1]) < 0.06; }, want, 15000);
  await until(A, w => { const s = HOST.collab.arc(); return !!s && Math.hypot(s.x - w[0], s.z - w[1]) < 0.06; }, want, 5000);
  const a1 = await arcOf(A), p1 = await A.evaluate(() => HOST.collab.val('allp'));
  check('arc: the first headset in the room moves the page\'s arc to where it stands, facing its way (its cards ahead, as on the single-player Stories screen) (allp its own now), still the arc', moved && at(want, a1) && a1.arc === true && angle(a1.yaw, HEAD.yaw) < 0.05 &&
    !!p1 && p1.by === hId && !p1.pg, JSON.stringify({ a1, p1, want, aligned, tAl, moved, ms: Date.now() - t0, pendA: await A.evaluate(() => [...HOST.collab.internals().pending.keys()]),
      onH: await H.evaluate(() => [HOST.collab.arc(), HOST.collab.val('allp')]), log: await H.evaluate(() => window.__collabLog.filter(e => /all stories|arc|station|align|frame/.test(e.ev)).slice(-8).map(e => e.ev)),
      why: await H.evaluate(() => { const C = HOST.collab.internals(), R = HOST.room.internals(); return { auto: C.autoAll, allpFor: C.allpFor, code: C.code, allpAt: C.allpAt, welcomed: C.welcomed, session: !!R.session, aligned: R.aligned, headOK: R.headOK,
        locked: HOST.collab.locked, arc: HOST.collab.arc(), mode: HOST.mode, hereSet: C.hereSet, failed: window.__collabLog.filter(e => e.ev === 'frame failed').slice(-2),
        notYet: window.__collabLog.filter(e => e.ev === 'all stories not yet').slice(-3), n: window.__collabLog.filter(e => e.ev === 'all stories not yet').length }; }) }));
  // at it without walking in (it stands where the headset stands, and zoneStep never walks into it): its cards (the
  // single-player Stories screen) there, the scene hidden, nothing of it drawn, the rig at its spot, its presence there,
  // nothing synced
  await stepUntil(id => HOST.collab.mine() === id && HOST.cur.peek('XR.stories'), AID, 8000);
  await frames(H, 800);
  const ALs = await H.evaluate(() => HOST.collab.arc());
  const c1 = await H.evaluate(id => {
    window.__xr.step(); HOST.cur.peek('xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS)');
    const O = HOST.collab.overlay(), o = O.rings.get(id), cd = O.cards.get(id);
    return { mine: HOST.collab.mine(), cards: HOST.room.cards(), here: HOST.room.allHere(), away: HOST.room.away(), stories: HOST.cur.peek('XR.stories'), world: HOST.cur.peek('GL.world.visible'),
      land: HOST.cur.peek('XR.land.slice(1).every(P => P.mesh.visible)'), back: HOST.cur.peek('!!XR.land[0].regions.find(r => r.id === "back")'),
      drawn: (!!o && (o.ring.visible || o.icon.g.visible)) || !!(cd && cd.mesh.visible), zone: HOST.collab.internals().zone };
  }, AID);
  const rig = await rigOf(H), rw = rigAt(ALs), pres = await until(A, ([id, st]) => (HOST.collab.people().get(id) || {}).st === st, [hId, AID], 3000), quiet = await keysOf(A, AID);
  check('arc: the headset is at the arc without walking in (standing at its spot, never walked into): its cards in front (no Back), the scene hidden, no ring, card or icon for it, the rig at its spot, its presence there, nothing synced',
    c1.mine === AID && c1.cards && c1.here && !c1.away && c1.stories && !c1.world && c1.land && !c1.back && !c1.drawn && dist(rig.slice(0, 3), rw.slice(0, 3)) < 0.02 && angle(rig[3], rw[3]) < 0.02 &&
    c1.zone !== AID && pres && !quiet.length, JSON.stringify({ c1, rig, rw, pres, quiet }));
  if (shots) { fs.mkdirSync(shots, { recursive: true }); await headView(H, path.join(shots, 'all-1-arc.png'), HEAD.yaw, -0.08, [1280, 800]); }   // (the arc's cards, as the first headset sees them)
  // a card pressed on the headset (its landing card's region) picks that story for everyone at the arc: the pages too
  await redraw();
  const press = await H.evaluate(k => { const i = HOST.list.findIndex(m => m.key === k) + 1, P = HOST.cur.peek('XR.land')[i], r = P && P.regions.find(r => r.id === 'card'); if (r) r.fn(); return !!r; }, PK);
  await until(A, ([id, k]) => (HOST.collab.station(id) || {}).story === k, [AID, PK], 5000);
  const play0 = await A.evaluate(id => HOST.collab.val('st.' + id + '.play'), AID);
  let switched = false;
  for (let i = 0; i < 40 && !switched; i++) { await frames(H, 300); switched = await H.evaluate(k => HOST.curKey === k, PK); }
  switched = switched && await ready(H, PK);
  if (switched) { await H.evaluate(() => HOST.cur.peek('xrAdopt()')); await frames(H, 600); }
  const okA = await ready(A, PK), okB = await ready(B, PK);
  await sleep(1500);
  await frames(H, 300);   // (the pretend headset's clock moves only in frames it is given: none while the pages loaded)
  const hc = await clockOf(H), bc = await clockOf(B), ac = await clockOf(A), still = await arcOf(A), hs = await H.evaluate(() => (HOST.cur.peek('xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS)'), { stories: HOST.cur.peek('XR.stories'), world: HOST.cur.peek('GL.world.visible'), placing: HOST.room.placing(), cards: HOST.room.cards() }));
  // (from its start: no further on than the time since the pick, which a loaded machine's story load can make long)
  const since = play0 ? (await A.evaluate(() => HOST.collab.now()) - play0.at) / 1000 : 0;
  check('arc: a card pressed there picks its story for everyone: the arc\'s story its key (still the arc), from its start, playing, on the headset and both pages following it',
    press && !!play0 && play0.mode === 'story' && play0.t === 0 && play0.playing === true && switched && okA && okB && hc[0] === 'story' && hc[1] && hc[2] < since + 2 && bc[0] === 'story' && bc[1] && Math.abs(bc[2] - hc[2]) < 3 &&
    ac[0] === 'story' && ac[1] && !!still && still.story === PK && !hs.stories && hs.world && hs.placing && !hs.cards && !(await B.evaluate(() => HOST.picking)), JSON.stringify({ press, play0, switched, okA, okB, hc, bc, ac, since, still, hs }));
  if (shots) await headView(H, path.join(shots, 'all-2-picked.png'), ALs.yaw, -0.2, [1280, 800]);   // (the story picked there, playing)
  // the story panel's Stories button: back to the cards, for everyone there (the arc's keys gone)
  await frames(H, 300);
  await redraw();
  const sb = await H.evaluate(() => { const r = HOST.cur.peek('XR.main').regions.find(r => r.id === 'stories'); if (r) r.fn(); return !!r; });
  await until(A, id => (HOST.collab.station(id) || {}).story === 'all', AID, 5000);
  await frames(H, 600);
  const back = await H.evaluate(() => (HOST.cur.peek('xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS)'), { cards: HOST.room.cards(), stories: HOST.cur.peek('XR.stories'), world: HOST.cur.peek('GL.world.visible'), playing: HOST.cur.peek('APP.playing') }));
  check('arc: the story panel\'s Stories button goes back to the cards for everyone (its keys gone; both pages show their Stories screen)', sb && back.cards && back.stories && !back.world && !back.playing &&
    !(await keysOf(A, AID)).length && await until(B, () => HOST.picking, null, 3000) && await until(A, () => HOST.picking, null, 3000), JSON.stringify({ sb, back, keys: await keysOf(A, AID) }));
  // the grip on its cards carries it for everyone (as a station's ring is carried): out to the room while held, put down
  // where it was let go. P(s, d, side): a point d m ahead of s's spot and side m to its right, 1.5 m up, in the room
  const P = (s, d, side) => [s.x - d * Math.sin(s.yaw) + side * Math.cos(s.yaw), 1.5, s.z - d * Math.cos(s.yaw) - side * Math.sin(s.yaw)];
  const DRAG = async (p, pts, ms) => p.evaluate(async ([pts, ms]) => {
    const X = window.__xr, V = THREE.Vector3, src = () => X.session.inputSources[0], wait = t => new Promise(r => setTimeout(r, t));
    const head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert()), o = head.clone().add(new V(0.12, -0.3, -0.1));
    const aim = pt => { const t = HOST.room.toLocal(new V(...pt)); X.aim(0, new THREE.Matrix4().compose(o, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), t.clone().sub(o).normalize()), new V(1, 1, 1))); };
    aim(pts[0]); X.step(); X.step();   // (a grip comes between frames, on a fresh ray)
    X.fire('squeezestart', { inputSource: src() }); X.step();
    const grabbed = HOST.room.moving, n = pts.length > 1 ? Math.max(1, Math.round(ms / 60)) : 0;
    for (let k = 1; k <= n; k++) { const f = k / n, a = pts[0], b = pts[1]; aim([a[0] + (b[0] - a[0]) * f, a[1], a[2] + (b[2] - a[2]) * f]); X.step(); await wait(40); }
    X.fire('squeezeend', { inputSource: src() }); X.step();
    const s = HOST.collab.station('all01'), notes = HOST.collab.notes().map(x => x.title);
    X.ctrl(0, null); X.step();
    return { grabbed, after: HOST.room.moving, s: s && { x: s.x, z: s.z, yaw: s.yaw, arc: s.arc }, notes };
  }, [pts, ms]);
  const g0 = await H.evaluate(() => HOST.collab.arc());
  const seenHeld = A.evaluate(async id => { const t0 = performance.now(); let n = 0; while (performance.now() - t0 < 15000) { const v = HOST.collab.val('st.' + id); if (v && v.h === 1) n++; else if (n) break;
    await new Promise(r => setTimeout(r, 30)); } return n; }, AID);
  const dr = await DRAG(H, [P(g0, 1.4, 0), P(g0, 1.4, 1.1)], 1500), held = await seenHeld;
  const landed = await until(A, ([id, s]) => { const v = HOST.collab.val('st.' + id); return !!v && v.h === undefined && v.arc === true && Math.abs(v.x - s.x) < 0.002 && Math.abs(v.z - s.z) < 0.002; }, [AID, dr.s], 5000) &&
    await until(B, ([id, s]) => { const v = HOST.collab.station(id); return !!v && Math.abs(v.x - s.x) < 0.002 && Math.abs(v.z - s.z) < 0.002; }, [AID, dr.s], 5000);
  // (the arc stands where the headset stands, so the hand is at its spot: pointing to the side swings it round the hand,
  // and the point held, 1.4 m ahead of its spot, stays under the ray: seen from the head, it lies where the ray went)
  const hp = P(dr.s, 1.4, 0), fa = P(g0, 1.4, 1.1), under = angle(Math.atan2(hp[0] - HEAD.x, hp[2] - HEAD.z), Math.atan2(fa[0] - HEAD.x, fa[2] - HEAD.z));
  check('arc: the grip on its cards carries it for everyone (out to the room while held, then where it was let go, still the arc), swung round with the pointing',
    dr.grabbed === AID && dr.after === '' && held > 0 && landed && angle(dr.s.yaw, g0.yaw) > 0.15 && under < 0.15 && dr.s.arc === true, JSON.stringify({ dr, held, landed, g0, under }));
  // the room map moves it too, and the headset's cards glide there (the rig, frame by frame)
  const mp = await A.evaluate(async id => {
    HOST.collab.dialog(true);
    const cv = document.querySelector('#shMap');
    for (let k = 0; k < 30 && !HOST.collab.mapView(); k++) await new Promise(r => setTimeout(r, 100));   // (drawn by the pump)
    const tf = HOST.collab.mapView(), s = HOST.collab.station(id);
    if (!tf || !s) return { err: 'no map' };
    const r = cv.getBoundingClientRect(), ev = (type, x, z) => cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + tf.X(x), clientY: r.top + tf.Y(z), pointerId: 11, buttons: type === 'pointerup' ? 0 : 1, bubbles: true }));
    ev('pointerdown', s.x, s.z); ev('pointermove', s.x + 0.4, s.z + 0.2); await new Promise(r => setTimeout(r, 150)); ev('pointermove', s.x + 0.8, s.z + 0.4); ev('pointerup', s.x + 0.8, s.z + 0.4);
    const m = HOST.collab.station(id);
    HOST.collab.dialog(false);
    return { from: [s.x, s.z], to: [m.x, m.z], arc: m.arc, follow: HOST.collab.following() };
  }, AID);
  const got = !mp.err && await until(H, ([id, x, z]) => { const s = HOST.collab.station(id); return !!s && Math.abs(s.x - x) < 0.01 && Math.abs(s.z - z) < 0.01; }, [AID, mp.to[0], mp.to[1]], 5000);
  const r0 = await rigOf(H), path1 = await H.evaluate(async () => { const X = window.__xr, out = []; for (let k = 0; k < 30; k++) { X.step(); const r = HOST.cur.peek('GL.rig.position'); out.push([r.x, r.y, r.z]); await new Promise(res => setTimeout(res, 30)); } return out; });
  const r1 = rigAt(await H.evaluate(() => HOST.collab.arc())), mid = path1.filter(q => dist(q, r0.slice(0, 3)) > 0.01 && dist(q, r1.slice(0, 3)) > 0.01).length;
  check('arc: the room map moves it (still the arc, the page still following it), and the headset\'s cards glide there', got && mp.arc === true && mp.follow === AID && Math.abs(mp.to[0] - mp.from[0] - 0.8) < 0.05 &&
    mid >= 2 && dist(path1[path1.length - 1], r1.slice(0, 3)) < 0.02, JSON.stringify({ mp, got, mid, last: path1[path1.length - 1], r1 }));
  // the circles lock refuses the grip on it (a notice says so); Move here (the menu) puts it at the headset, facing its way
  await A.evaluate(() => HOST.collab.lock(true));
  await until(H, () => HOST.collab.locked, null, 3000);
  const g1 = await H.evaluate(() => HOST.collab.arc()), lk = await DRAG(H, [P(g1, 1.4, 0)], 0);
  await A.evaluate(() => HOST.collab.lock(false));
  await until(H, () => !HOST.collab.locked, null, 3000);
  check('arc: the circles lock refuses the grip on it (a notice says so)', !lk.grabbed && lk.notes.includes('The circles are locked') && Math.abs(lk.s.x - g1.x) < 1e-6, JSON.stringify(lk));
  const mh = await H.evaluate(async () => { const X = window.__xr; HOST.collab.panelOpen(true); X.step(); X.step(); const r = HOST.collab.menuFind('move'), ok = !!(r && r.fn); if (ok) r.fn();
    X.step(); HOST.collab.panelOpen(false); X.step(); return ok; });
  const mhA = await until(A, h => { const s = HOST.collab.arc(); return !!s && Math.hypot(s.x - h.x, s.z - h.z) < 0.05; }, HEAD, 5000), a2 = await arcOf(A);
  check('arc: Move here (the menu) puts it at the headset, facing its way, still the arc', mh && mhA && !!a2 && angle(a2.yaw, HEAD.yaw) < 0.05, JSON.stringify({ mh, mhA, a2 }));
  // stepped back 1.5 m: still at it (no walking in)
  const HB = { x: HEAD.x + 1.5 * Math.sin(HEAD.yaw), z: HEAD.z + 1.5 * Math.cos(HEAD.yaw), yaw: HEAD.yaw };
  await H.evaluate(h => window.__xr.head(h), headAt(HB, ROOM[3] + HB.yaw));
  await frames(H, 1500);
  // Add from the headset (as its menu's Add here does; here at a spot far off): the arc becomes an ordinary All stories
  // circle where it stands, in the same batch; the headset still at it, its ring now drawn while it stands outside it; the
  // pages still following it
  await A.evaluate(() => HOST.collab.dialog(true));
  await sleep(300);
  const [opts, extra] = await A.evaluate(() => [[...document.querySelectorAll('#shAdd option')].map(o => o.value), (self.STORY_EXTRA || []).map(m => m.key)]);
  await A.evaluate(() => HOST.collab.dialog(false));
  check('all: the page\'s Add lists All stories and Back to the lobby after the design room and the studio', opts.slice(-2 - extra.length).join() === extra.concat('all', 'lobby').join() && extra[0] === 'design', opts.join());
  const SP = { x: 3, z: -3.2, yaw: 0 };   // (the room's circle of the story picked later: for the switch)
  const SPid = await H.evaluate(([k, b]) => HOST.collab.add(k, b), [PK, SP]);
  const conv = await until(A, ([id, sp]) => !HOST.collab.arc() && !!HOST.collab.station(sp) && HOST.collab.val('st.' + id).arc === false, [AID, SPid], 5000) &&
    await until(B, ([id, sp]) => !HOST.collab.arc() && !!HOST.collab.station(sp) && HOST.collab.station(id).arc === false, [AID, SPid], 5000);
  await frames(H, 1200);
  const AL = await A.evaluate(id => HOST.collab.station(id), AID);
  const c2 = await H.evaluate(id => { window.__xr.step(); const O = HOST.collab.overlay(), o = O.rings.get(id), cd = O.cards.get(id);
    return { mine: HOST.collab.mine(), cards: HOST.room.cards(), stories: HOST.cur.peek('XR.stories'), ring: !!o && o.ring.visible, icon: !!o && o.icon.g.visible, card: !!(cd && cd.mesh.visible) }; }, AID);
  const fol = await A.evaluate(() => HOST.collab.following()) === AID && await B.evaluate(() => HOST.collab.following()) === AID;
  check('arc: Add (the headset\'s) turns the arc into an All stories circle where it stands (arc false); the headset still at it with its cards, its ring now drawn (it stands outside it), no card or icon; the pages still following it',
    !!SPid && conv && Math.hypot(AL.x - HEAD.x, AL.z - HEAD.z) < 0.05 && c2.mine === AID && c2.cards && c2.stories && c2.ring && !c2.icon && !c2.card && fol, JSON.stringify({ SPid, conv, AL, c2, fol }));
  if (shots) await headView(H, path.join(shots, 'all-4-circle.png'), HB.yaw, -0.3, [1280, 800]);   // (its ring now, beneath its cards)
  // the switch on, from the headset's menu at the circle; a card again: it joins the room's circle of that story
  const sw = await H.evaluate(async () => { const X = window.__xr; HOST.collab.panelOpen(true); X.step(); X.step(); const r = HOST.collab.menuFind('allsync'), ok = !!(r && r.fn); if (ok) r.fn();
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(res => setTimeout(res, 20)); } HOST.collab.panelOpen(false); X.step(); return ok; });
  check('all: the menu\'s row at the circle turns its switch on (With the room\'s circles), for the room', sw && await until(A, id => HOST.collab.station(id).sync === true, AID, 3000));
  await A.evaluate(id => HOST.collab.follow(id), SPid);
  await ready(A, PK);
  await A.evaluate(() => HOST.cur.peek('APP.enterExplore()'));
  await sleep(800);
  await redraw();
  await H.evaluate(k => { const i = HOST.list.findIndex(m => m.key === k) + 1, r = HOST.cur.peek('XR.land')[i].regions.find(r => r.id === 'card'); r.fn(); }, PK);
  await until(A, ([id, k]) => (HOST.collab.station(id) || {}).story === k, [AID, PK], 5000);
  const live = () => frames(H, 5000);
  let run = live();
  const joined = await until(H, sp => { const S = HOST.collab.session(); return !!S && S.id === sp && HOST.cur.peek('APP.mode') === 'explore' && !HOST.room.cards(); }, SPid, 6000);
  await run;
  const own0 = await keysOf(A, AID);
  // explore state both ways, and the clock: a change on the page at the room's circle reaches the headset, and one the
  // headset makes reaches the page; the headset's presence still the All stories circle's
  await peek(A, T.change);
  run = live();
  const s1 = await stateOf(A), got1 = await until(H, s => JSON.stringify(HOST.cur.collab.state()) === s, s1, 5000);
  await run;
  await peek(H, T.back);
  run = live();
  const s2 = await stateOf(H), got2 = await until(A, s => JSON.stringify(HOST.cur.collab.state()) === s, s2, 5000);
  await run;
  await peek(A, 'APP.enterStory(30)');
  run = live();
  const got3 = await until(H, () => HOST.cur.peek('APP.mode') === 'story' && HOST.cur.peek('APP.t') > 29 && HOST.cur.peek('APP.t') < 45, null, 5000);
  await run;
  const pres2 = await A.evaluate(id => (HOST.collab.people().get(id) || {}).st, hId);
  check('all: with the switch on and a circle of that story in the room, the headset at the All stories circle joins its session: explore state and clock both ways, its presence still the All stories circle\'s',
    joined && !own0.length && got1 && got2 && got3 && pres2 === AID, JSON.stringify({ joined, own0, got1, got2, got3, pres2, AL: AID, sp: SPid }));
  // (the linked circle's scene moved, for the switch turned off below: it stays where it is, not back where the story puts it)
  await A.evaluate(([id, k]) => HOST.collab.publish([['st.' + id + '.place', { x: 0.2, y: 0, z: 0, s: 1, story: k }]]), [SPid, PK]);
  await until(H, id => { const v = HOST.collab.val('st.' + id + '.place'); return !!v && v.x === 0.2; }, SPid, 5000);
  // off again, from the page's dialog: its own keys (seeded where the session was: its clock, state and the scene's place),
  // the story going on
  await A.evaluate(() => HOST.collab.dialog(true));
  await sleep(300);
  await A.click(`[data-sh="allsync:${AID}"]`);
  run = live();
  const ownAgain = await until(H, id => { const S = HOST.collab.session(); return !!S && S.id === id; }, AID, 5000);
  await run;
  const own1 = await keysOf(A, AID), hm = await clockOf(H), pl1 = await A.evaluate(id => HOST.collab.val('st.' + id + '.place'), AID);
  check('all: the dialog\'s toggle turns the switch off: its own keys again (the clock, the state and the scene\'s place carried over), the story going on there',
    ownAgain && own1.includes('st.' + AID + '.play') && !!pl1 && pl1.x === 0.2 && hm[0] === 'story' && !(await A.evaluate(id => HOST.collab.station(id).sync, AID)),
    JSON.stringify({ ownAgain, own1, pl1, hm }));
  // on again, then the linked circle given another story: the All stories circle goes on alone from where the story is
  // (its own clock written by the people at it), not left without a clock
  await A.click(`[data-sh="allsync:${AID}"]`);
  run = live();
  const rejoined = await until(H, sp => { const S = HOST.collab.session(); return !!S && S.id === sp; }, SPid, 6000);
  await run;
  await peek(H, 'APP.enterStory(32)');
  await sleep(500);
  const spv = await A.evaluate(id => HOST.collab.val('st.' + id), SPid);
  await A.evaluate(([id, v, k]) => HOST.collab.publish([['st.' + id, Object.assign({}, v, { story: k })]]), [SPid, spv, OTHER_STORY]);
  run = live();
  const alone = await until(A, id => { const v = HOST.collab.val('st.' + id + '.play'); return !!v && v.mode === 'story' && v.t > 30; }, AID, 8000);
  await run;
  const hm2 = await clockOf(H), ses2 = await H.evaluate(() => (HOST.collab.session() || {}).id);
  check('all: with the linked circle given another story, the All stories circle goes on alone where its story was (its own clock written), still the same story',
    rejoined && alone && ses2 === AID && hm2[0] === 'story' && hm2[2] > 30, JSON.stringify({ rejoined, alone, ses2, hm2 }));
  await A.click(`[data-sh="allsync:${AID}"]`);   // (and its switch off again)
  await until(A, id => HOST.collab.station(id).sync === false, AID, 3000);
  // the dialog's picker: back to its cards (Choosing a story), for everyone there
  await A.selectOption(`[data-sh-pick="${AID}"]`, 'all');
  run = live();
  const cardsAgain = await until(H, () => HOST.room.cards() && HOST.cur.peek('XR.stories'), null, 5000);
  await run;
  check('all: the dialog\'s picker sends the circle back to its cards', cardsAgain && (await A.evaluate(id => HOST.collab.station(id).story, AID)) === 'all');
  // the lobby, from the page: listed without Follow; walking in ends the headset's station (away: the story hidden and
  // paused) and every ring and card shows; then a story circle is entered as usual
  const LB = { x: -3.4, z: -3.2, yaw: 0 };
  await A.evaluate(b => HOST.collab.add('lobby', b), LB);
  await until(H, () => HOST.collab.stations().some(s => s.kind === 'lobby'), null, 5000);
  const LBid = (await kinds(A)).find(s => s.kind === 'lobby').id;
  await sleep(300);
  const noFollow = await A.evaluate(id => !document.querySelector(`[data-sh="follow:${id}"]`) && !!document.querySelector(`[data-sh="remove:${id}"]`), LBid);
  await H.evaluate(h => window.__xr.head(h), headAt(LB, ROOM[3]));
  await stepUntil(() => HOST.collab.mine() === '', null, 10000);
  await frames(H, 1200);
  const lob = await H.evaluate(([lb]) => { window.__xr.step(); HOST.cur.peek('xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS)'); const O = HOST.collab.overlay(), st = HOST.collab.stations();
    return { mine: HOST.collab.mine(), away: HOST.room.away(), cards: HOST.room.cards(), world: HOST.cur.peek('GL.world.visible'), stories: HOST.cur.peek('XR.stories'), playing: HOST.cur.peek('APP.playing'),
      rings: st.every(s => { const o = O.rings.get(s.id); return !!o && o.ring.visible && o.icon.g.visible; }), cardsOn: st.filter(s => s.id !== lb).every(s => { const c = O.cards.get(s.id); return !!c && c.mesh.visible; }) }; }, [LBid]);
  if (shots) await headView(H, path.join(shots, 'all-3-lobby.png'), Math.atan2(-(AL.x - LB.x), -(AL.z - LB.z)), 0.02, [1280, 800]);   // (from the lobby: every circle again)
  check('all: walking into the lobby ends the headset\'s story (away: hidden, paused) and every ring, icon and card shows; the page lists it without Follow',
    noFollow && lob.mine === '' && lob.away && !lob.cards && !lob.world && !lob.stories && !lob.playing && lob.rings && lob.cardsOn, JSON.stringify({ noFollow, lob }));
  const SPs = await A.evaluate(id => HOST.collab.station(id), SPid);
  // (walk: its story loaded, a scene story on a machine busy with other pages slowly, and taking the session, as a story does)
  const inSP = await walk(H, SPs, SPs.story, ROOM[3] + SPs.yaw);
  const sp1 = await H.evaluate(id => ({ mine: HOST.collab.mine(), placing: HOST.room.placing(), away: HOST.room.away(), cur: HOST.curKey, ok: HOST.collab.mine() === id }), SPid);
  check('all: after the lobby, walking into a story circle enters it as usual', inSP && sp1.ok && sp1.placing && !sp1.away, JSON.stringify({ inSP, sp1, story: SPs.story }));
  // the All stories circle that was the arc, walked into again: its cards, as any All stories circle's
  await H.evaluate(h => window.__xr.head(h), headAt(AL, ROOM[3] + AL.yaw));
  const inAgain = await stepUntil(id => HOST.collab.mine() === id && HOST.room.cards() && HOST.cur.peek('XR.stories'), AID, 15000);
  check('all: walked into again, the All stories circle that was the arc shows its cards', inAgain,
    JSON.stringify(await H.evaluate(() => ({ mine: HOST.collab.mine(), cards: HOST.room.cards(), cur: HOST.curKey, on: HOST.cur.peek('XR.on'), stories: HOST.cur.peek('XR.stories') }))));
  // Arrange all leaves both kinds where they are
  const before = await kinds(A);
  await A.evaluate(() => HOST.collab.arrange({ x: 0, z: 6, yaw: 0 }));
  await until(A, () => HOST.collab.stations().length >= HOST.list.length + 2 && !HOST.collab.internals().pending.size, null, 5000);
  await sleep(500);
  const after = await kinds(A);
  check('all: Arrange all leaves the All stories and lobby circles where they are', before.length === 2 && JSON.stringify(after) === JSON.stringify(before), JSON.stringify({ before, after }));
  // an arc again (every other circle gone, written as the arc), turned into a circle by Arrange all, and again by adding
  // the lobby; with every other circle gone, a circle stays a circle
  const NS = await A.evaluate(() => HOST.list.length);
  const arcAgain = () => A.evaluate(id => { const v = Object.assign({}, HOST.collab.val('st.' + id), { arc: true }); delete v.ts; delete v.h;
    HOST.collab.publish(HOST.collab.stations().filter(s => s.id !== id).map(s => ['st.' + s.id, null]).concat([['st.' + id, v]])); }, AID);
  const onlyIt = () => A.evaluate(id => HOST.collab.publish(HOST.collab.stations().filter(s => s.id !== id).map(s => ['st.' + s.id, null])), AID);
  await arcAgain();
  const arc3 = await until(H, id => !!HOST.collab.arc() && HOST.collab.stations().length === 1 && HOST.collab.mine() === id, AID, 5000), a3 = await arcOf(A);
  await A.evaluate(() => HOST.collab.arrange({ x: 0, z: 8, yaw: 0 }));
  const byArr = await until(B, ([id, n]) => !HOST.collab.arc() && !!HOST.collab.station(id) && HOST.collab.station(id).arc === false && HOST.collab.stations().length === n + 1, [AID, NS], 6000);
  await frames(H, 600);
  const s3 = await A.evaluate(id => HOST.collab.station(id), AID), m3 = await H.evaluate(() => HOST.collab.mine());
  check('arc: Arrange all turns the arc into a circle where it stands (the headset still at it)', arc3 && byArr && !!a3 && Math.abs(s3.x - a3.x) < 1e-6 && Math.abs(s3.z - a3.z) < 1e-6 && m3 === AID, JSON.stringify({ arc3, byArr, a3, s3, m3 }));
  await onlyIt();
  await until(A, () => HOST.collab.stations().length === 1, null, 5000);
  await frames(H, 2500);
  const stays = await A.evaluate(id => !HOST.collab.arc() && HOST.collab.val('st.' + id).arc === false, AID) && await H.evaluate(id => !HOST.collab.arc() && HOST.collab.mine() === id, AID);
  check('arc: with every other circle gone, the circle that was the arc stays a circle', stays);
  await arcAgain();
  await until(A, () => !!HOST.collab.arc(), null, 5000);
  await A.evaluate(b => HOST.collab.add('lobby', b), LB);
  const byLobby = await until(B, id => !HOST.collab.arc() && HOST.collab.station(id).arc === false && HOST.collab.stations().some(s => s.kind === 'lobby'), AID, 6000);
  check('arc: adding the lobby turns the arc into a circle too', byLobby);
  // removed, it does not come back by itself (the room has had one: allp)
  await A.evaluate(() => HOST.collab.publish(HOST.collab.stations().map(s => ['st.' + s.id, null])));
  await frames(H, 3500);
  check('arc: removed, the room\'s All stories circle does not come back', !(await kinds(A)).length && !(await kinds(B)).length && !(await kinds(H)).length);
  // a headset first in a room of its own (another room, its frame written by someone there): the arc in front of itself,
  // and it is at it at once
  const mk = async () => (await (await fetch(base() + 'api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app: 'networks', version: FORMAT }) })).json()).code;
  const c3 = await mk(), W3 = writer(c3, 'w3' + Date.now().toString(36));
  await W3.open; await sleep(400);
  W3.set(await H.evaluate(() => HOST.room.frameKey('U1')), frameFor(ROOM, 'U1', W3.id, Date.now() - 60000));
  await sleep(400);
  const H3 = { x: 0.6, z: 0.4, yaw: -0.3 }, want3 = [H3.x, H3.z];
  await H.evaluate(h => window.__xr.head(h), headAt(H3, ROOM[3] + H3.yaw));
  await H.evaluate(c => HOST.collab.join(c), c3);
  const first = await stepUntil(([w, id]) => { const s = HOST.collab.arc(); return !!s && Math.hypot(s.x - w[0], s.z - w[1]) < 0.06 && HOST.collab.mine() === id && HOST.room.cards(); }, [want3, AID], 25000);
  const v3 = (await roomInfo(c3)).keys;
  check('arc: a headset first in a room makes the room\'s arc where it stands, facing its way (allp its own), and is at it at once', first && !!v3['st.' + AID] && v3['st.' + AID].v.arc === true &&
    angle(v3['st.' + AID].v.yaw, H3.yaw) < 0.05 && !!v3.allp && v3.allp.v.by === hId, JSON.stringify({ first, st: v3['st.' + AID] && v3['st.' + AID].v, allp: v3.allp && v3.allp.v, src: await H.evaluate(() => [HOST.room.aligned, HOST.room.src, HOST.collab.code]) }));
  W3.close();
  // a room kept from before v109 (its first All stories circle, all01 without arc, its only station): the arc once joined,
  // by a page whose own arc is off
  const c2r = await mk(), W2 = writer(c2r, 'w2' + Date.now().toString(36));
  await W2.open; await sleep(400);
  W2.set('st.' + AID, { story: 'all', kind: 'all', sync: false, x: 1, z: -1, yaw: 0.5 });
  W2.set('allp', { by: W2.id, at: Date.now() });
  await sleep(500);
  W2.close();
  const J = await open('#s=' + c2r, { width: 480, height: 320 });
  const up = await until(J, id => { const s = HOST.collab.arc(); return !!s && s.id === id && HOST.collab.following() === id && HOST.picking; }, AID, 20000);
  await sleep(500);
  const kv = (await roomInfo(c2r)).keys['st.' + AID];
  check('arc: a room kept from before (all01 without arc, its only station) is the room\'s arc once joined: the page follows it and shows its Stories screen',
    up && !!kv && kv.v.arc === true && kv.v.x === 1 && kv.v.yaw === 0.5, JSON.stringify({ up, kv: kv && kv.v }));
  await H.evaluate(() => window.__xr.end());
  for (const p of [A, B, H, J]) await p.context().close();
}

async function smoothRound() {
  const K = 'qubits';
  const A = await open('#stories');
  await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(A, () => HOST.collab.status === 'open', null, 10000);
  const rc = await A.evaluate(() => HOST.collab.code);
  await A.evaluate(k => HOST.collab.add(k, { x: 0, z: 0, yaw: 0 }), K);
  await A.evaluate(() => HOST.collab.add('flock', { x: 3, z: 0, yaw: 0 }));   // (another station, carried by someone else)
  await until(A, () => HOST.collab.stations().length === 2 && !HOST.collab.internals().pending.size, null, 5000);
  const SS = await A.evaluate(() => HOST.collab.stations()), S = SS.find(s => s.story === K), S2 = SS.find(s => s.story === 'flock');
  const H = await open('#s=' + rc, { width: 320, height: 200 });
  await until(H, () => HOST.collab.status === 'open' && HOST.collab.stations().length === 2, null, 20000);
  await ready(H, 'airports');
  const aId = await A.evaluate(() => HOST.collab.id);
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);
  await H.evaluate(() => { HOST.room.sharedAlign(true); HOST.collab.dialog(false); });   // (a headset has no dialog open)
  await H.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [-6, 1.6, 6, 0] });
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 400);
  await H.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'U1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
  await frames(H, 300);
  const inS = await walk(H, S, K, 0, 150000);
  // (in explore mode: the view is shared there; the scene's place in both modes)
  await A.evaluate(id => HOST.collab.publish([['st.' + id + '.play', { mode: 'explore', t: 0, playing: false, at: Math.round(HOST.collab.now()) }]]), S.id);
  const expl = await until(H, () => { window.__xr.step(); return HOST.cur.peek('APP.mode') === 'explore' && !!HOST.cur.collab.view(); }, null, 15000);
  check('smooth: a pretend headset stands at a station in explore mode (a room of its own)', inS && expl, JSON.stringify({ inS, expl }));
  const W = writer(rc, 'spin' + Math.random().toString(36).slice(2, 7));
  await W.open;
  const hId = await H.evaluate(() => HOST.collab.id), DELAY = await H.evaluate(() => HOST.collab.smooth().SMOOTH.DELAY);
  const kPl = 'st.' + S.id + '.place', kV = 'st.' + S.id + '.view', W2 = Math.PI / 2;
  const mine = (from, to, k) => W.sets.filter(s => s.by === hId && s.at >= from && s.at <= to && s.batch.some(p => p[0] === k));
  const line = (what, st, more) => console.log(`      ${what}: ${st.frames} frames, ${(st.share * 100).toFixed(0)} % within 35 % of the writer's speed (5th, 50th, 95th percentile: ${st.spread.join(', ')} of it), ${st.still} without motion, ${st.lag.toFixed(0)} ms behind${more || ''}`);
  try {
    await frames(H, 600);
    // the scene turned steadily about the vertical, 90 degrees a second for 3 s, then let go
    const qAt = a => { const q = [0, Math.sin(a / 2), 0, Math.cos(a / 2)], k = q[3] < 0 ? -1 : 1; return q.map(c => Math.round(k * c * 10000) / 10000 + 0); };
    const recP = record(H, 4300, 'rot');
    await sleep(300);
    const sp = await drive((a, ts, h) => W.set(kPl, Object.assign({ x: 0, y: 0, z: 0, s: 1, q: qAt(a), story: K, ts }, h ? { h: 1 } : {})), 3000, s => s * W2);
    const r1 = await recP, a0 = r1[0][3];
    await drawnPast(H, sp.end + 30);
    const r1b = await record(H, 300, 'rot'), RR = turnNear(r1.concat(r1b), W2, sp.t0, a0, sp.end, 2 * Math.PI);
    const st1 = steadiness(RR, W2, sp.t0, a0, sp.held[sp.held.length - 1]);
    const endA = a0 + (sp.end - sp.t0) / 1000 * W2, fin = RR[RR.length - 1][3], over = Math.max(...RR.map(f => f[3])) - endA;
    // (landed at the frame whose render time reaches the let-go, not glided there: every frame from then on exactly there)
    const after1 = RR.filter(f => f[2] >= sp.end + 1), off1 = Math.max(...after1.map(f => Math.abs(f[3] - endA)));
    line('the scene\'s turn', st1, `; let go, ${((fin - endA) * 180 / Math.PI).toFixed(3)} degrees from where it was let go, ${(Math.max(0, over) * 180 / Math.PI).toFixed(3)} past it at most, ${(off1 * 180 / Math.PI).toFixed(3)} off at most in the ${after1.length} frames from the let-go's render time on`);
    check('smooth: a station\'s scene turned steadily by someone else turns steadily here (moving every frame, within 35 % of their speed in 85 % of frames, about DELAY behind) and lands where it was let go, no further, at the frame that reaches it',
      st1.frames >= 12 && st1.still === 0 && st1.share >= 0.85 && Math.abs(st1.lag - DELAY) <= 80 && Math.abs(fin - endA) < 0.003 && over < 0.003 && after1.length >= 2 && off1 < 0.003, JSON.stringify({ st1, endA, fin, over, off1, n: after1.length }));
    // someone else turns it for a second and lets go, and the headset grips it at once and lets go a moment later: it stays
    // where the headset left it (their samples dropped as the grip takes it, never put again once it is let go here)
    // (the headset's frames run on meanwhile, and it grips as soon as their let-go has come)
    const rgP = H.evaluate(async kPl => {
      const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z), R = HOST.cur.peek('GL.rig');
      const at = p => X.aim(0, new THREE.Matrix4().compose(V(...p).applyMatrix4(R.matrixWorld), R.quaternion.clone(), V(1, 1, 1)));
      const grab = on => HOST.cur.peek(`(c => { if (${on}) c.hover = { kind: "globe", i: -1, point: c.o.clone() }; xrGrab(c, ${on}); })(XR.ctrls[0])`);
      const B = () => HOST.collab.smooth().BUF.get(kPl), w0 = performance.now();
      while (!(B() && B().s.length > 3 && !B().s[B().s.length - 1].h) && performance.now() - w0 < 8000) { X.step(); await new Promise(r => setTimeout(r, 4)); }
      at([0.1, -0.2, -0.6]); X.step();
      const x0 = HOST.cur.xrPose().off.x, gripAt = Date.now();
      const had = HOST.collab.smooth().BUF.has(kPl);
      grab(true); X.step();
      const dropped = !HOST.collab.smooth().BUF.has(kPl);
      // (its frames back to back, without yielding: the page draws the story's own frames in software in between, which
      // can take a second, and the let-go must come well within their samples' second)
      const t0 = performance.now();
      for (let i = 1; i <= 10; i++) { at([0.1 + 0.03 * i, -0.2, -0.6]); X.step(); }
      grab(false); X.step();
      X.ctrl(0, null); X.step();
      return { x0, x1: HOST.cur.xrPose().off.x, had, dropped, ms: performance.now() - t0, gripAt, at: Date.now() };
    }, kPl);
    await sleep(200);
    const sr = await drive((a, ts, h) => W.set(kPl, Object.assign({ x: 0, y: 0, z: 0, s: 1, q: qAt(a), story: K, ts }, h ? { h: 1 } : {})), 1000, s => s * W2);
    const rg = await rgP;
    const regrip = await record(H, 1500, 'x'), back = Math.max(...regrip.map(f => Math.abs(f[3] - rg.x1)));
    console.log(`      a grip right after someone else let go: gripped ${rg.gripAt - sr.end} ms after they let go, held ${rg.ms.toFixed(0)} ms, moved ${(rg.x1 - rg.x0).toFixed(3)} m, let go ${rg.at - sr.end} ms after them; then at most ${back.toFixed(4)} m from there in ${regrip.length} frames`);
    check('smooth: a grip here right after someone else let go drops their samples and stays where it is let go (never pulled back to theirs)',
      rg.had && rg.dropped && rg.x1 - rg.x0 > 0.2 && back < 0.005, JSON.stringify({ rg, back, end: sr.end }));
    // a sample written for another story (from before the station changed story) moves nothing: the relay refuses it
    const xNow = await H.evaluate(() => HOST.cur.xrPose().off.x);
    for (let i = 0; i < 4; i++) { W.set(kPl, { x: xNow + 1, y: 0, z: 0, s: 1, story: 'airports', ts: Date.now(), h: 1 }); await sleep(66); }
    await frames(H, 600);
    const xOther = await H.evaluate(() => HOST.cur.xrPose().off.x);
    check('smooth: a place written for another story moves nothing', Math.abs(xOther - xNow) < 0.001, JSON.stringify({ xNow, xOther }));
    // the station's panel moved steadily sideways (0.3 m/s) by someone else, then let go
    const recPn = record(H, 4300, 'panel');
    await sleep(300);
    const pp = await drive((x, ts, h) => W.set('st.' + S.id + '.panel', Object.assign({ x, y: 1.3, z: -0.7, yaw: 0, story: K, ts }, h ? { h: 1 } : {})), 3000, s => -0.3 + 0.3 * s);
    const rpn = await recPn;
    await drawnPast(H, pp.end + 30);
    const RP = rpn.concat(await record(H, 300, 'panel')), st4 = steadiness(RP, 0.3, pp.t0, -0.3, pp.held[pp.held.length - 1]);
    const pAfter = RP.filter(f => f[2] >= pp.end + 1), pOff = Math.max(...pAfter.map(f => Math.abs(f[3] - pp.last))), pOver = Math.max(...RP.map(f => f[3])) - pp.last;
    line('the panel', st4, `; lands ${pOff.toFixed(4)} m off at most in the ${pAfter.length} frames from the let-go on, ${Math.max(0, pOver).toFixed(4)} m past it at most`);
    check('smooth: the station\'s panel moved steadily by someone else moves steadily here (every frame, within 35 % in 85 % of frames, about DELAY behind) and lands where it was let go, no further',
      st4.frames >= 12 && st4.still === 0 && st4.share >= 0.85 && Math.abs(st4.lag - DELAY) <= 80 && pAfter.length >= 2 && pOff < 0.002 && pOver < 0.002, JSON.stringify({ st4, pOff, pOver, n: pAfter.length }));
    // another station carried by the grip (0.5 m/s) by someone else: its ring moves steadily here, and lands where it is put down
    const recSt = record(H, 4300, 'ring:' + S2.id);
    await sleep(300);
    const cs = await drive((x, ts, h) => W.set('st.' + S2.id, Object.assign({ story: 'flock', x, z: 0, yaw: 0, ts }, h ? { h: 1 } : {})), 3000, s => 3 + 0.5 * s);
    const rst = await recSt;
    await drawnPast(H, cs.end + 30);
    const RS = rst.concat(await record(H, 300, 'ring:' + S2.id)).filter(f => f[3] !== null), st5 = steadiness(RS, 0.5, cs.t0, 3, cs.held[cs.held.length - 1]);
    const sAfter = RS.filter(f => f[2] >= cs.end + 1), sOff = Math.max(...sAfter.map(f => Math.abs(f[3] - cs.last))), sOver = Math.max(...RS.map(f => f[3])) - cs.last;
    line('a station carried', st5, `; put down ${sOff.toFixed(4)} m off at most in the ${sAfter.length} frames from then on, ${Math.max(0, sOver).toFixed(4)} m past it at most`);
    check('smooth: a station carried by someone else moves steadily here (every frame, within 35 % in 85 % of frames, about DELAY behind) and lands where it is put down, no further',
      st5.frames >= 12 && st5.still === 0 && st5.share >= 0.85 && Math.abs(st5.lag - DELAY) <= 80 && sAfter.length >= 2 && sOff < 0.002 && sOver < 0.002, JSON.stringify({ st5, sOff, sOver, n: sAfter.length }));
    // a value with no ts (a write by hand, an older device): it glides in as before
    await A.evaluate(([k, s]) => HOST.collab.publish([[k, { x: 0.2, y: 0.1, z: -0.3, s: 0.5, story: s }]]), [kPl, K]);
    const rs = (await record(H, 1200, 'size')).map(f => f[3]);
    const between = rs.filter(v => v > 0.52 && v < 0.98).length, landed = await until(H, () => { window.__xr.step(); return HOST.cur.xrPose().s === 0.5; }, null, 8000);
    check('smooth: a place with no ts still glides in (sizes between, then exactly there)', between >= 3 && landed, JSON.stringify({ between, landed, last: rs[rs.length - 1] }));
    // the explore view turned steadily (90 degrees a second, its first component: the scene's turn), then let go; the
    // headset follows and writes nothing meanwhile
    const base = await H.evaluate(() => HOST.cur.collab.view()), norm = d => { const r = Math.round(d * 10) / 10; return Math.round((((r + 180) % 360 + 360) % 360 - 180) * 10) / 10; };
    const vAt = s => base.map((c, k) => (k ? c : norm(c + 90 * s)));
    const rvP = record(H, 4300, 'view'), vFrom = Date.now();
    await sleep(300);
    const sv = await drive((v, ts, h) => W.set(kV, Object.assign({ v, story: K, ts }, h ? { h: 1 } : {})), 3000, vAt);
    const rv = await rvP, v0 = rv[0][3];
    await drawnPast(H, sv.end + 30);
    await frames(H, 1200);
    const RV = turnNear(rv, 90, sv.t0, v0, sv.end, 360), st2 = steadiness(RV, 90, sv.t0, v0, sv.held[sv.held.length - 1]);
    const vEnd = await H.evaluate(() => HOST.cur.collab.view()), wroteV = mine(vFrom, Date.now(), kV).length;
    const vOver = Math.max(...RV.map(f => f[3])) - (v0 + 90 * (sv.end - sv.t0) / 1000);
    line('the explore view', st2, `; ends ${JSON.stringify(vEnd)} (let go at ${JSON.stringify(sv.last)}), ${wroteV} writes from the headset`);
    check('smooth: the explore view turned by someone else turns steadily here (every frame, within 35 % in 85 % of frames, about DELAY behind), ends exactly where it was let go, and the headset writes nothing meanwhile',
      st2.frames >= 12 && st2.still === 0 && st2.share >= 0.85 && Math.abs(st2.lag - DELAY) <= 80 && JSON.stringify(vEnd) === JSON.stringify(sv.last) && vOver < 0.15 && !wroteV, JSON.stringify({ st2, vEnd, last: sv.last, vOver, wroteV }));
    // a view with no ts (a write by hand, an older device): the story's own glide (its short glide started, not put there
    // at once; the pretend headset's page draws the story's own frames only now and then, so the glide is seen starting
    // rather than sampled), then exactly there, and nothing written back
    const vTo = vEnd.map((c, k) => (k ? c : norm(c + 60))), nFrom = Date.now();
    await A.evaluate(([k, v, s]) => HOST.collab.publish([[k, { v, story: s }]]), [kV, vTo, K]);
    const vGlide = await until(H, () => { window.__xr.step(); return !!HOST.cur.peek('orbit.to && orbit.fast'); }, null, 5000);
    const vLanded = await until(H, to => { window.__xr.step(); return JSON.stringify(HOST.cur.collab.view()) === JSON.stringify(to); }, vTo, 8000);
    await frames(H, 600);
    const wroteN = mine(nFrom, Date.now(), kV).length;
    check('smooth: a view with no ts still glides in (the story\'s glide, then exactly there) and the headset writes nothing back',
      vGlide && vLanded && !wroteN, JSON.stringify({ vGlide, vLanded, wroteN, vEnd, vTo }));
    // a person's head moving at 0.5 m/s (presence, 15 a second with ts), at this circle
    const hx = s => -1 + 0.5 * s, hp = (x, ts) => W.fx('p.' + W.id, { st: S.id, head: [S.x + x, 1.6, S.z - 1.2, 0, 0, 0, 1], hands: [], ts });
    const rhP = record(H, 4300, 'head:' + W.id);
    await sleep(300);
    const sh = await drive((x, ts) => hp(x, ts), 3000, hx);
    const rh = (await rhP).filter(f => f[3] !== null).map(f => [f[0], f[1], f[2], f[3] - S.x]);
    const st3 = steadiness(rh, 0.5, sh.t0, -1, sh.held[sh.held.length - 1]);
    line('a person\'s head', st3);
    check('smooth: a person\'s head moving at 0.5 m/s is drawn moving steadily (every frame, within 35 % in 85 % of frames, about DELAY behind)',
      st3.frames >= 12 && st3.still === 0 && st3.share >= 0.85 && Math.abs(st3.lag - DELAY) <= 80, JSON.stringify(st3));
    // a grip held on the scene here, the hand moving all the while: at most 16 place values in any second (one every 66 ms
    // at most), each with ts and h, and the last (let go) without h
    const gFrom = Date.now();
    const gr = await H.evaluate(async () => {
      const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z), R = HOST.cur.peek('GL.rig');
      const at = p => X.aim(0, new THREE.Matrix4().compose(V(...p).applyMatrix4(R.matrixWorld), R.quaternion.clone(), V(1, 1, 1)));
      const grab = on => HOST.cur.peek(`(c => { if (${on}) c.hover = { kind: "globe", i: -1, point: c.o.clone() }; xrGrab(c, ${on}); })(XR.ctrls[0])`);
      at([0.1, -0.2, -0.6]); X.step(); X.step();
      grab(true);
      const t0 = performance.now();
      let n = 0;
      // (2 s and at least 150 frames, at most 10 s: a machine busy with other pages stalls now and then)
      while ((performance.now() - t0 < 2000 || n < 150) && performance.now() - t0 < 10000) {
        const s = (performance.now() - t0) / 1000;
        at([0.1 + 0.25 * Math.sin(s * 3), -0.2, -0.6]); X.step(); n++;
        await new Promise(r => setTimeout(r, 4));
      }
      const held = HOST.cur.xrPose().held;
      grab(false); X.step(); X.step();
      X.ctrl(0, null); X.step();
      return { ms: performance.now() - t0, held, frames: n };
    });
    await sleep(500);
    const gw = mine(gFrom, Date.now(), kPl).map(s => s.batch.find(p => p[0] === kPl)[1]), hw = gw.filter(v => v.h === 1);
    // (the most in any second, and the closest two: a page that stalls in software writes fewer, never more)
    const hts = hw.map(v => v.ts), most = Math.max(0, ...hts.map(a => hts.filter(b => b >= a && b < a + 1000).length)), lastG = gw[gw.length - 1];
    const gap = Math.min(...hts.slice(1).map((b, i) => b - hts[i]));
    console.log(`      a held grip: ${hw.length} held writes in ${(gr.ms / 1000).toFixed(2)} s over ${gr.frames} frames, at most ${most} in any second, ${gap} ms apart at the closest; ${gw.length - hw.length} without h`);
    check('smooth: a grip held on the scene writes at most 16 place values a second, each with ts and h: 1, and the one on letting go without h',
      /globe/.test(gr.held) && hw.length >= 10 && most <= 16 && gap >= 60 && gw.every(v => Number.isFinite(v.ts)) && !!lastG && !lastG.h, JSON.stringify({ gr, n: gw.length, held: hw.length, most, gap, lastG }));
  } finally {
    W.close();
    await H.evaluate(() => window.__xr.end()).catch(() => {});
    for (const p of [A, H]) await p.context().close();
  }
}

// ---- the room setup guide and the startup flow (v107, v109; --guide runs only this, a room of its own, five minutes or
// so): a page starts a room with one station. The first pretend headset enters AR alone: the flow opens by itself at Line
// up, as the room's first headset with no spots yet (pick two and calibrate), and Skip for now closes it and the menu;
// it becomes the room's origin (Room ready). The second lines up through the shared space and its flow opens at Line up
// (no spots yet: check with someone, or calibrate); its pages (Back, Next, Skip for now, Room setup opening it again where
// it was, Close, the live status, the headsets lined up); the laptop's Setting up a room lists both, not checked yet;
// Touch the spot with the two tips 3 cm apart (green on both, checked 3 cm), then 40 cm apart (red on both, the last
// page opened by itself); a check alone timing out; the second back with no shared space: its flow skipped, the last
// page opens by itself once it is late; back in the shared space, the flow again (every session). Then the spots: the
// first headset calibrates on two from Line up (its calibration sets the room: rm and a frame from the spots for the
// space), Check at A 3 cm off, green, the flow done; the second, taking that frame through the shared space, is asked by
// eye (v119: the orange crosses on the two spots, drawn over everything, and Are both crosses on your spots? in front),
// Yes standing as a check by eye (the laptop's list says so); after a wake and after a floor reset asked again, No opening
// Line up to calibrate on the spots (not lined up, by eye, in the laptop's list); entering again, the startup flow asks by
// eye instead of opening at Check; No, Next, Check at A 3 cm off: green, the guide and the menu close; 40 cm off: red,
// back to Line up; Calibrate there on the spots, on to Check by itself, Check at B: green; the laptop's list says checked
// at which spot. The spots are tape crosses on the floor (v122: TIP over the true floor); at the end floor spots
// (floorSpots: headsets whose own floors are 20 cm too high and 15 cm too low on the true floor, the refusals, an older
// calibration). With --shots its pictures: guide-*.png (the menu's canvas on each page and case, waiting, green, red, the
// Circles tab, alone, no shared space, calibrating, the question by eye, spot A refused; the laptop's Setting up a room)
async function guideRound() {
  const A = await open('#stories');
  await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(A, () => HOST.collab.status === 'open', null, 10000);
  const rc = await A.evaluate(() => HOST.collab.code);
  await A.evaluate(k => HOST.collab.add(k, { x: 5, z: -5, yaw: 0 }), PICK_STORY);   // (a station far off: no menu opening by itself for an empty room)
  const H1 = await open('#s=' + rc, { width: 320, height: 200 }), H2 = await open('#s=' + rc, { width: 320, height: 200 });
  for (const H of [H1, H2]) { await until(H, () => HOST.collab.status === 'open' && HOST.collab.stations().length === 1, null, 20000); await ready(H, 'airports'); }
  const xr = (H, head, o) => H.evaluate(installXR, Object.assign({ mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head, guide: true }, o || {}));
  const inSpace = H => H.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'G1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
  const stepUntil = async (H, fn, arg, ms) => { const t0 = Date.now(); for (;;) { await frames(H, 300); if (await H.evaluate(fn, arg)) return true; if (Date.now() - t0 > ms) return false; } };
  const both = ms => Promise.all([frames(H1, ms), frames(H2, ms)]);   // (presence goes out only while a headset's frames run)
  // frames on both headsets while fn is looked for on page P, as they run, stopping once it holds (three pages drawing in
  // software step a few times a second, so a headset's presence comes every few hundred ms and can lapse between steps:
  // looked at only after the frames, it may just have gone)
  const run = (H, ms) => H.evaluate(async ms => { window.__go = true; const t0 = performance.now(); while (window.__go && performance.now() - t0 < ms) { window.__xr.step(); await new Promise(r => setTimeout(r, 16)); } }, ms);
  const bothUntil = async (P, fn, arg, ms) => {
    const go = Promise.all([run(H1, ms), run(H2, ms)]), ok = await until(P, fn, arg, ms);
    await Promise.all([H1, H2].map(H => H.evaluate(() => { window.__go = false; })));
    await go;
    return ok;
  };
  const pres = P => P.evaluate(() => [...HOST.collab.people()].map(([id, Q]) => [id, Q.lu, Q.al, !!Q.head, Math.round(performance.now() - Q.at)]));
  const G = H => H.evaluate(() => Object.assign(HOST.collab.guide(), { menu: HOST.collab.menu, tab: HOST.collab.menuTab(), local: localStorage.getItem('roomGuide'), src: HOST.room.src }));
  const tap = (H, id) => H.evaluate(async id => { const X = window.__xr, r = HOST.collab.menuFind(id), ok = !!(r && r.fn); if (ok) r.fn();
    for (let k = 0; k < 2; k++) { X.step(); await new Promise(res => setTimeout(res, 20)); } return ok; }, id);
  const has = (H, id) => H.evaluate(id => { const r = HOST.collab.menuFind(id); return r ? !!r.fn : null; }, id);
  const listText = () => A.evaluate(() => [...document.querySelectorAll('#shared .sh-lu li')].map(li => li.className + ': ' + li.textContent));
  // (what the laptop and the headsets say when its list is not as expected)
  const hs = H => H.evaluate(() => { const C = HOST.collab.internals(); return [HOST.collab.id, HOST.room.aligned, HOST.collab.status, C.ws && C.ws.readyState, Math.round(performance.now() - C.presAt), Math.round(performance.now() - (C.tickAt || 0)), window.__collabLog.slice(-8).map(e => e.ev)]; });
  const diag = async () => JSON.stringify([await listText(), await pres(A), await A.evaluate(() => [HOST.collab.status, HOST.collab.id, Math.round(performance.now()), window.__collabLog.slice(-8).map(e => e.ev)]), await hs(H1), await hs(H2)]);
  const lu = re => new RegExp(re).test([...document.querySelectorAll('#shared .sh-lu li')].map(li => li.textContent).join('|'));
  const listed = re => bothUntil(A, lu, re.source, 15000);
  const menuPic = async (H, file, which) => {
    if (!shots) return;
    const u = await H.evaluate(w => { window.__xr.step(); const S = HOST.collab.overlay()[w || 'panel'], c = document.createElement('canvas'); c.width = S.w; c.height = S.vis; c.getContext('2d').drawImage(S.cv, 0, 0); return c.toDataURL('image/png'); }, which);
    fs.writeFileSync(path.join(shots, file), Buffer.from(u.split(',')[1], 'base64'));
  };
  // the check by eye as headset H shows it: whether it asks, is on show and why; the orange crosses (drawn, over everything)
  // and where they stand in the pretend room; the question (drawn, how far from the head, the ray's first target, on top)
  const EY = H => H.evaluate(() => {
    const X = window.__xr, O = HOST.collab.overlay(), e = HOST.collab.eye(), w = o => o.getWorldPosition(new THREE.Vector3()).applyMatrix4(X.W.local).toArray().map(v => +v.toFixed(3));
    X.step();
    const head = new THREE.Vector3().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert()), S = O.eye;
    return Object.assign(e, { marks: O.marks.visible, top: O.crossA.children.every(m => !m.material.depthTest), a: w(O.crossA), b: w(O.crossB),
      q: { vis: S.mesh.visible, d: +S.mesh.position.distanceTo(head).toFixed(2), hit: O.hit[0] === S.mesh, top: !S.mesh.material.depthTest && S.mesh.renderOrder >= 54 } });
  });
  // a press on the question's button by the ray, as a person's trigger does (as the circles' question is pressed)
  const eyePress = (H, id) => H.evaluate(async id => {
    const X = window.__xr, V = THREE.Vector3, S = HOST.collab.overlay().eye, r = S.regions.find(q => q.id === id);
    if (!r || !S.mesh.visible) return 'no ' + id;
    const p = S.mesh.localToWorld(new V(((r.x + r.w / 2) / S.w - 0.5) * S.mw, (0.5 - (r.y + r.h / 2) / S.h) * S.mw * S.h / S.w, 0));
    const head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert()), o = head.clone().add(new V(0.1, -0.25, 0));
    X.aim(0, new THREE.Matrix4().compose(o, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), p.clone().sub(o).normalize()), new V(1, 1, 1)));
    X.step(); X.step();
    const h = HOST.collab.internals().hov.get(0);
    if (!h || h.target.kind !== 'eye') return 'pointed at ' + JSON.stringify(h && h.target);
    HOST.cur.peek('XR.ctrls')[0].wantPress = true;
    for (let k = 0; k < 6; k++) { X.step(); await new Promise(res => setTimeout(res, 30)); }
    X.ctrl(0, null); X.step();
    return 'pressed';
  }, id);
  // the laptop's Setting up a room once it says what re says, the headsets' frames running meanwhile (their presence fresh)
  const laptopPic = async (file, re) => {
    if (!shots) return;
    await A.setViewportSize({ width: 820, height: 800 });
    const go = Promise.all([run(H1, 15000), run(H2, 15000)]);
    // (once it says so, the list is held as it is for the picture: a copy in its place, the list itself hidden. Pages
    // drawing in software on a busy machine send their presence every few seconds, so it can lapse between two reads)
    const said = await until(A, re => {
      const ul = document.querySelector('#shared .sh-lu'), ok = new RegExp(re).test([...ul.querySelectorAll('li')].map(li => li.textContent).join('|'));
      if (ok) { const f = ul.cloneNode(true); f.dataset.held = '1'; ul.after(f); ul.style.display = 'none'; }
      return ok; }, re.source, 15000);
    if (!said) console.log(`  (${file}: the list did not say ${re.source} within 15 s: ${await diag()})`);
    const clip = await A.evaluate(() => { const h = document.querySelector('#shared .sh-lu').previousElementSibling, d = document.querySelector('#shared .sh-guide'), box = document.querySelector('#shared .box');
      box.scrollTop += h.getBoundingClientRect().top - box.getBoundingClientRect().top - 74;
      const a = h.getBoundingClientRect(), b = d.getBoundingClientRect(); return { x: Math.max(0, Math.min(a.left, b.left) - 8), y: Math.max(0, a.top - 8), width: Math.max(a.right, b.right) - Math.min(a.left, b.left) + 16, height: Math.min(b.bottom, 800) - a.top + 16 }; });
    await A.screenshot({ path: path.join(shots, file), clip });
    await A.evaluate(() => { for (const f of document.querySelectorAll('#shared .sh-lu[data-held]')) f.remove(); const ul = document.querySelector('#shared .sh-lu'); if (ul) ul.style.display = ''; });
    await Promise.all([H1, H2].map(H => H.evaluate(() => { window.__go = false; })));
    await go;
  };
  // the controller's tip held still on p (room coordinates of the pretend room), then the trigger
  const touch = async (H, p) => {
    await H.evaluate(p => window.__xr.ctrl(0, p, [0, -1, 0]), p); await frames(H, 650);
    await H.evaluate(() => HOST.cur.peek('XR.ctrls[0].wantPress = true')); await frames(H, 150);
  };
  // Calibrate pressed on the guide's page, then spot A and spot B touched
  const calibrateOn = async (H, a, b) => {
    const ok = await tap(H, 'guide:cal');
    const st = await H.evaluate(() => HOST.room.state);
    await touch(H, a); await touch(H, b);
    await H.evaluate(() => window.__xr.ctrl(0, null)); await frames(H, 300);
    return ok && st === 'mark-a';
  };
  // Check at A (or B) on the guide's Check page, then the tip held still at p and the trigger
  const selfCheck = async (H, spot, p) => {
    const ok = await tap(H, 'guide:self' + spot);
    const armed = await H.evaluate(() => HOST.collab.guide().check.s === 'armed');
    await touch(H, p);
    await H.evaluate(() => window.__xr.ctrl(0, null)); await frames(H, 100);
    return ok && armed;
  };
  if (shots) fs.mkdirSync(shots, { recursive: true });
  // the first headset, alone among headsets: the flow opens by itself at Line up (the room's first, no spots yet), Skip
  // for now closes it (and the menu it opened); then it becomes the room's origin once its shared space has nobody's frame
  await xr(H1, [0, 1.6, 0, 0]);
  await H1.evaluate(() => window.__xr.begin());
  await frames(H1, 300);
  await inSpace(H1);
  const f1 = await stepUntil(H1, () => HOST.collab.guide().open, null, 15000);
  const g1 = await G(H1);
  await menuPic(H1, 'guide-01-first.png');
  check('guide: the first headset entering AR gets the startup flow by itself at Line up: the room\'s first, no spots yet (pick two and calibrate)',
    f1 && g1.open && g1.menu && g1.tab === 'circles' && g1.step === 1 && g1.flow === 'on' && g1.case === 'first' && g1.spots === null && g1.local === null && await has(H1, 'guide:cal') === true && await has(H1, 'guide:skip') === true,
    JSON.stringify(g1));
  const sk1 = await tap(H1, 'guide:skip'), g1s = await G(H1);
  check('guide: Skip for now closes the flow and the menu it opened', sk1 && !g1s.open && !g1s.menu && g1s.flow === 'skipped', JSON.stringify(g1s));
  const ready1 = await stepUntil(H1, () => HOST.room.src === 'shared' && HOST.collab.guide().status.k === 'ok', null, 20000);
  const g1r = await G(H1);
  check('guide: the first headset becomes the room\'s origin (Room ready), and the skipped flow stays shut',
    ready1 && g1r.status.h === 'origin' && /^Room ready/.test(g1r.status.text) && !g1r.open && !g1r.menu && g1r.flow === 'skipped' && await H1.evaluate(() => HOST.collab.notes().some(n => n.title === 'Room ready')),
    JSON.stringify({ ready1, g1r }));
  // the second: lines up through the shared space; its flow opens at Line up (no spots yet, not the first)
  await frames(H1, 200);
  await xr(H2, [0.6, 1.6, 0.4, 0.3]);
  await H2.evaluate(() => window.__xr.begin());
  await frames(H2, 300);
  await inSpace(H2);
  const lined2 = await stepUntil(H2, () => HOST.room.src === 'adopted' && HOST.collab.guide().open && HOST.collab.guide().status.k === 'ok', null, 20000);
  const ln1 = await bothUntil(H1, () => HOST.collab.guide().lined.slice(0, 2).join() === '2,2', null, 10000), ln2 = await bothUntil(H2, () => HOST.collab.guide().lined.slice(0, 2).join() === '2,2', null, 10000);
  const g2 = await G(H2), g1b = await G(H1);
  await menuPic(H2, 'guide-02-none.png');
  check('guide: the second headset lines up through the shared space and its flow opens by itself at Line up (no spots yet: check with someone, or calibrate)',
    lined2 && g2.open && g2.menu && g2.tab === 'circles' && g2.step === 1 && g2.flow === 'on' && g2.case === 'none' && g2.status.k === 'ok' && g2.status.h === 'shared' &&
    g2.status.text === 'Lined up through the shared space' && await has(H2, 'guide:tocheck') === true && g2.local === null, JSON.stringify(g2));
  check('guide: the first headset\'s flow stays shut when the second comes in; both count the headsets lined up, none checked',
    !g1b.open && g1b.flow === 'skipped' && ln1 && ln2 && g2.lined[2] === 0, JSON.stringify({ g1b, ln1, ln2, p1: await pres(H1), p2: await pres(H2) }));
  // its pages: Back greyed on the first; Next, Back; Skip for now (the menu closes); Room setup on the Circles tab opens
  // it again where it was, now with Close; Check here on its check page and the Debug tab; Re-align and Calibrate on its last
  const p0 = await H2.evaluate(() => { HOST.collab.guideOpen(0); window.__xr.step(); return HOST.collab.guide().step; });
  await menuPic(H2, 'guide-03-before.png');
  const back0 = await has(H2, 'guide:back'), nx = await tap(H2, 'guide:next') && (await G(H2)).step === 1;
  const nx2 = await tap(H2, 'guide:next') && (await G(H2)).step === 2, chk = await has(H2, 'guide:check');
  await menuPic(H2, 'guide-04-check-with-someone.png');
  const nx3 = await tap(H2, 'guide:next') && (await G(H2)).step === 3, fix = (await has(H2, 'guide:realign')) && (await has(H2, 'guide:cal'));
  await menuPic(H2, 'guide-05-not-lined-up.png');
  const bk = await tap(H2, 'guide:back') && (await G(H2)).step === 2;
  const sk = await tap(H2, 'guide:skip'), gs = await G(H2), skipped = sk && !gs.open && !gs.menu && gs.flow === 'skipped';
  await H2.evaluate(() => HOST.collab.panelOpen(true));
  const again = await has(H2, 'guide') === true && await tap(H2, 'guide') && (await G(H2)).open && (await G(H2)).step === 2 && (await G(H2)).flow === 'skipped' && await has(H2, 'guide:close') === true;
  const cl = await tap(H2, 'guide:close') && !(await G(H2)).open && (await G(H2)).menu;
  const dbg = await has(H2, 'check');   // (the Debug tab's Check here, beside Re-align)
  await H2.evaluate(() => { HOST.collab.menuTab('circles'); HOST.collab.panelOpen(false); });
  check('guide: its pages (Back greyed on the first; Next, Back; Skip for now closing the flow and its menu; Room setup opening it again where it was, then with Close; Check here on its check page and the Debug tab; Re-align and Calibrate on its last page)',
    p0 === 0 && back0 === null && nx && nx2 && chk === true && nx3 && fix && bk && skipped && again && cl && dbg === true, JSON.stringify({ p0, back0, nx, nx2, chk, nx3, fix, bk, skipped, gs, again, cl, dbg }));
  // the laptop's Setting up a room: both headsets, how they line up, not checked yet
  await A.evaluate(() => HOST.collab.dialog(true));
  const l1 = await listed(/room ready \(the room's origin, not checked yet\).*lined up \(shared space, not checked yet\).*2 of 2 headsets in the room lined up, 0 checked|lined up \(shared space, not checked yet\).*room ready \(the room's origin, not checked yet\).*2 of 2 headsets in the room lined up, 0 checked/);
  check('guide: the laptop\'s Setting up a room lists both headsets: room ready (the room\'s origin) and lined up (shared space), not checked yet; 2 of 2, 0 checked', l1, await diag());
  // Touch the spot: both tips on one spot (3 cm apart): green on both, the check this session's
  const SPOT = [1.2, 0.04, -0.6];
  const touchSpot = async (H, p) => {   // (Check here pressed on the guide's check page, then the tip held still on the spot and the trigger)
    await H.evaluate(() => { HOST.collab.guideOpen(2); window.__xr.step(); });
    const ok = await tap(H, 'guide:check');
    await touch(H, p);
    await H.evaluate(() => window.__xr.ctrl(0, null));
    return ok;
  };
  const a1 = await touchSpot(H1, SPOT), w1 = (await G(H1)).check;
  await menuPic(H1, 'guide-06-waiting.png');
  const a2 = await touchSpot(H2, [SPOT[0] + 0.03, SPOT[1], SPOT[2]]);
  await both(600);
  const c1 = await G(H1), c2 = await G(H2);
  await menuPic(H2, 'guide-07-green.png');
  check('guide: Touch the spot 3 cm apart: the first waits for someone else, then both show green, Lined up: 3 cm, a check that stands this session',
    a1 && a2 && w1.s === 'wait' && /^Waiting for someone else to press Check here \(\d+ s\)$/.test(w1.text) && c1.check.s === 'done' && c2.check.s === 'done' &&
    /^Lined up: 3 cm \(with /.test(c1.check.text) && /^Lined up: 3 cm/.test(c2.check.text) && c1.check.col === '#3ee08f' && c2.status.c === 3 && c2.status.k === 'ok' &&
    c1.flow === 'done' && c2.flow === 'done' && c1.ok && c1.ok.how === 'p' && c2.ok && c2.ok.how === 'p', JSON.stringify({ a1, a2, w1, c1: [c1.check, c1.flow, c1.ok], c2: [c2.check, c2.flow, c2.ok], s2: c2.status }));
  const l2 = await listed(/room ready \(the room's origin, checked 3 cm\)/) && await listed(/lined up \(shared space, checked 3 cm\)/) && await listed(/2 of 2 headsets in the room lined up, 2 checked/);
  await laptopPic('guide-08-laptop.png', /checked 3 cm.*checked 3 cm/);
  check('guide: the laptop\'s list says each headset\'s check (checked 3 cm; 2 checked)', l2, JSON.stringify(await listText()));
  // 40 cm apart: red on both, and the last page (Not lined up?) opens by itself on both (the room has no spots)
  const b1 = await touchSpot(H1, SPOT);
  await H1.evaluate(() => HOST.collab.panelOpen(false));
  const b2 = await touchSpot(H2, [SPOT[0] + 0.4, SPOT[1], SPOT[2]]);
  await both(600);
  const r1 = await G(H1), r2 = await G(H2);
  check('guide: Touch the spot 40 cm apart: red on both (40 cm out: not lined up), and the guide\'s last page opened by itself on both (no spots in the room)',
    b1 && b2 && [r1, r2].every(g => g.check.s === 'done' && /^40 cm out: not lined up/.test(g.check.text) && g.check.col === '#ff6b6b' && g.status.k === 'no' && g.status.w === 'check' &&
      g.open && g.menu && g.step === 3 && !g.ok && g.red && g.red.spot === 'p'), JSON.stringify({ b1, b2, r1: [r1.open, r1.step, r1.check, r1.status, r1.red], r2: [r2.open, r2.step, r2.check, r2.status, r2.red] }));
  await menuPic(H2, 'guide-09-red-last-page.png');
  await H2.evaluate(() => { HOST.collab.menuTab('circles'); window.__xr.step(); });   // (the Circles tab: Room setup, and how it lines up beside it)
  await menuPic(H2, 'guide-10-circles-tab.png');
  const l3 = await listed(/not lined up \(checked 40 cm out\)/);
  await laptopPic('guide-11-laptop-red.png', /checked 40 cm out.*checked 40 cm out/);
  check('guide: the laptop\'s list says not lined up (checked 40 cm out)', l3, JSON.stringify(await listText()));
  // a check alone: waiting, then nobody within the window (shortened to 8 s here)
  await H1.evaluate(() => HOST.collab.guideTimes({ win: 14000 }));   // (shortened: 14 s, as the steps before the reading can take several seconds on pages drawing in software on a busy machine)
  await H1.evaluate(() => HOST.room.realignNow());   // (Re-align takes the red result away: check again)
  await frames(H1, 400);
  const cs0 = (await G(H1)).check, cleared = cs0.s !== 'done';
  await touchSpot(H1, SPOT);
  const al1 = (await G(H1)).check;
  await sleep(14300); await frames(H1, 200);
  const al2 = (await G(H1)).check;
  await menuPic(H1, 'guide-12-alone.png');
  check('guide: Re-align takes the red result away; a check alone waits, then says nobody else pressed Check here in time',
    cleared && al1.s === 'wait' && al2.s === 'late' && /^Nobody else pressed Check here within 14 s/.test(al2.text), JSON.stringify({ cs0, al1, al2, log: await H1.evaluate(() => [HOST.collab.now(), window.__collabLog.filter(e => /check|guide|realign/.test(e.ev)).slice(-12)]) }));
  await H1.evaluate(() => HOST.collab.guideTimes({ win: 20000 }));
  // the second headset back with no shared space: its flow opens at Line up again (a new session), Skip for now, and the
  // last page opens by itself once it is late, saying why
  await H2.evaluate(() => window.__xr.end());
  await frames(H1, 200);
  await xr(H2, [0.6, 1.6, 0.4, 0.3], { features: ['local-floor', 'anchors'] });
  await H2.evaluate(() => window.__xr.begin());
  const f2 = await stepUntil(H2, () => HOST.collab.guide().open && HOST.collab.guide().flow === 'on', null, 15000);
  const n1 = await G(H2);
  const sk2 = await tap(H2, 'guide:skip');
  await H2.evaluate(() => HOST.collab.guideTimes({ late: 2500 }));   // (shortened once skipped: it is late at once)
  const late = await stepUntil(H2, () => HOST.collab.guide().open && HOST.collab.guide().step === 3, null, 10000);
  const n2 = await G(H2);
  check('guide: a new session opens the flow again (every session, at Line up); skipped, a headset not lined up (no shared space) gets the last page by itself once it is late, saying why',
    f2 && n1.step === 1 && n1.case === 'none' && sk2 && late && n2.status.k === 'no' && n2.status.w === 'space' && /no shared space/.test(n2.status.text), JSON.stringify({ f2, n1: [n1.step, n1.case, n1.flow, n1.status], sk2, n2 }));
  await menuPic(H2, 'guide-13-no-space.png');
  await H2.evaluate(() => HOST.collab.guideTimes({ late: 20000 }));   // (back to the default: the next phase must not open late)
  // back in the shared space, lined up: the flow opens at Line up again; skipped
  await H2.evaluate(() => window.__xr.end());
  await xr(H2, [0.6, 1.6, 0.4, 0.3]);
  await H2.evaluate(() => window.__xr.begin());
  await frames(H2, 300);
  await inSpace(H2);
  const f3 = await stepUntil(H2, () => HOST.room.src === 'adopted' && HOST.collab.guide().open && HOST.collab.guide().flow === 'on', null, 15000);
  const n3 = await G(H2);
  const sk3 = await tap(H2, 'guide:skip');
  check('guide: back again and lined up, the flow opens again at Line up (no spots yet), and Skip for now closes it', f3 && n3.step === 1 && n3.case === 'none' && n3.status.k === 'ok' && sk3 && !(await G(H2)).open,
    JSON.stringify({ f3, n3 }));
  // ------------------------------------------------------------ the spots --
  // the first headset (the room's origin, no spots in the room) calibrates on two from Line up: its calibration sets the
  // room (rm, and a frame from the spots for its shared space); on to Check by itself; Check at A 3 cm off: green, done
  const SA = [1.0, TIP, -0.8], SB = [2.8, TIP, -0.2];   // (tape crosses on the floor: v122)
  await H1.evaluate(() => { HOST.collab.guideOpen(1); window.__xr.step(); });
  const q1 = await G(H1);
  await menuPic(H1, 'guide-14-first-red-line.png');
  const cal1 = await calibrateOn(H1, SA, SB);
  const to2 = await stepUntil(H1, () => HOST.collab.guide().open && HOST.collab.guide().step === 2, null, 5000);
  const q2 = await G(H1);
  const rm = await H1.evaluate(() => [HOST.collab.internals().keys.get('rm'), HOST.collab.internals().keys.get(HOST.room.frameKey('G1')), HOST.collab.id]);
  await menuPic(H1, 'guide-15-check-spots.png');
  check('guide: the first headset with no spots in the room is asked to pick two (Line up, the room\'s first, the red check\'s why above it); its calibration sets the room (rm and a frame from the spots for the shared space), and the guide goes on to Check by itself',
    q1.step === 1 && q1.case === 'first' && cal1 && to2 && q2.src === 'marks' && q2.case === 'check' && Array.isArray(q2.spots) && Math.abs(q2.spots[1] - Math.hypot(SB[0] - SA[0], SB[2] - SA[2])) < 0.01 &&
      rm[0] && rm[0].v && rm[0].v.by === rm[2] && Math.abs(rm[0].v.a - TIP) < 1e-3 && rm[0].v.f === 1 && rm[1] && rm[1].v && rm[1].v.g === 'marks' && rm[1].v.by === rm[2] && await has(H1, 'guide:selfA') === true && await has(H1, 'guide:selfB') === true,
    JSON.stringify({ q1: [q1.step, q1.case, q1.red], cal1, to2, q2: [q2.step, q2.case, q2.src, q2.spots], rm }));
  const s1 = await selfCheck(H1, 'A', [SA[0] + 0.03, SA[1], SA[2]]);
  const q3 = await G(H1);
  check('guide: Check at A with the tip 3 cm off spot A: green (Lined up: 3 cm at spot A), the flow done and the guide closed',
    s1 && q3.check.s === 'done' && q3.check.text === 'Lined up: 3 cm at spot A' && q3.check.col === '#3ee08f' && q3.status.c === 3 && q3.ok && q3.ok.how === 'a' && q3.flow === 'done' && !q3.open,
    JSON.stringify(q3));
  // (v119) the second headset (in a session, its flow skipped) takes the frame from the spots through the shared space:
  // the room moved in it, so the check by eye asks (once things settle): the orange crosses where it puts spot A and B
  // (drawn over everything), and the question in front of it, on top and pointable; Yes stands as a check (by eye), the
  // laptop's list says so
  const sp = await bothUntil(H2, () => HOST.room.src === 'adopted' && !!HOST.room.marks && HOST.collab.eye().shown, null, 25000);
  const e1 = await EY(H2), v1 = await G(H2);
  await menuPic(H2, 'guide-16-eye-question.png', 'eye');
  check('guide: the room gets its spots: a headset lined up through the shared space from them is asked by eye (the crosses on the two spots, drawn over everything, the question in front, on top, pointable; the guide shut)',
    sp && e1.shown && e1.marks && e1.top && near(e1.a, SA, 0.02) && near(e1.b, SB, 0.02) && e1.q.vis && e1.q.d > 0.75 && e1.q.d < 1 && e1.q.hit && e1.q.top && !v1.open,
    JSON.stringify({ sp, e1, v1: [v1.open, v1.flow, v1.case] }));
  const y1 = await eyePress(H2, 'eye:yes'), v1b = await G(H2), e1b = await EY(H2);
  check('guide: Yes to the check by eye stands as a check (by eye): the flow done, the question gone', y1 === 'pressed' && v1b.ok && v1b.ok.how === 'e' && v1b.flow === 'done' && !e1b.ask && !e1b.shown && !v1b.open,
    JSON.stringify({ y1, ok: v1b.ok, flow: v1b.flow, e1b }));
  const le = await listed(/lined up \(shared space, checked by eye\)/);
  check('guide: the laptop\'s list says checked by eye', le, await diag());
  // after a wake (the session hidden, then visible again): asked again
  await H2.evaluate(() => window.__xr.visibility('hidden'));
  await frames(H2, 400);
  await H2.evaluate(() => window.__xr.visibility('visible'));
  const wk = await stepUntil(H2, () => HOST.collab.eye().shown, null, 20000), e2 = await EY(H2);
  const y2 = await eyePress(H2, 'eye:yes'), v2y = await G(H2);
  check('guide: after a wake the check by eye asks again (why: the headset was off), and Yes stands again', wk && e2.why === 'wake' && e2.marks && y2 === 'pressed' && v2y.ok && v2y.ok.how === 'e',
    JSON.stringify({ wk, e2, y2, ok: v2y.ok }));
  // after a reset of the floor (Quest Browser's, with a transform that moves nothing here): asked again; No opens the
  // guide at Line up, to calibrate on the room's spots, saying why; the laptop's list says not lined up, by eye
  await H2.evaluate(F => window.__xr.floorReset(F, 0), FLOOR);
  const rs = await stepUntil(H2, () => HOST.collab.eye().shown, null, 20000), e3 = await EY(H2);
  const n3e = await eyePress(H2, 'eye:no'), v3n = await G(H2);
  await menuPic(H2, 'guide-17-eye-no.png');
  check('guide: after a floor reset the check by eye asks again; No opens the guide at Line up (calibrate on the room\'s spots, why above), not lined up meanwhile',
    rs && e3.why === 'reset' && n3e === 'pressed' && v3n.open && v3n.menu && v3n.step === 1 && v3n.case === 'room' && v3n.flow === 'on' && v3n.red && v3n.red.spot === 'e' && !v3n.ok &&
      v3n.status.k === 'no' && v3n.status.w === 'eye' && !(await EY(H2)).ask && await has(H2, 'guide:cal') === true,
    JSON.stringify({ rs, e3, n3e, v3n: [v3n.open, v3n.step, v3n.case, v3n.flow, v3n.red, v3n.status] }));
  const ln = await listed(/not lined up \(its crosses off the spots, by eye\)/);
  check('guide: the laptop\'s list says not lined up (its crosses off the spots, by eye)', ln, await diag());
  await tap(H2, 'guide:skip');
  // entering again: lined up through the shared space from the room's spots, the startup flow asks by eye instead of
  // opening at Check; No, then Next to Check, Check at A 3 cm off: green, the guide and the menu it opened close
  await H2.evaluate(() => window.__xr.end());
  await frames(H1, 200);
  await xr(H2, [0.6, 1.6, 0.4, 0.3]);
  await H2.evaluate(() => window.__xr.begin());
  await frames(H2, 300);
  await inSpace(H2);
  const st2 = await stepUntil(H2, () => HOST.collab.eye().shown, null, 25000);
  const v2 = await G(H2), e4 = await EY(H2);
  check('guide: a headset lined up through the shared space from the room\'s spots is asked by eye as it enters (the startup flow\'s question, not the guide at Check)',
    st2 && v2.src === 'adopted' && v2.flow === 'eye' && !v2.open && e4.why === 'start' && e4.marks, JSON.stringify({ st2, v2: [v2.open, v2.step, v2.case, v2.src, v2.flow, v2.status], e4 }));
  const n4 = await eyePress(H2, 'eye:no'), nx4 = await tap(H2, 'guide:next');
  const s2 = await selfCheck(H2, 'A', [SA[0] + 0.03, SA[1], SA[2]]);
  const v3 = await G(H2);
  check('guide: No, then Next to Check, Check at A 3 cm off: green, the guide and its menu close',
    n4 === 'pressed' && nx4 && s2 && v3.check.text === 'Lined up: 3 cm at spot A' && v3.ok && v3.ok.how === 'a' && v3.flow === 'done' && !v3.open && !v3.menu &&
      await H2.evaluate(() => HOST.collab.notes().some(n => n.title === 'Lined up: 3 cm')), JSON.stringify({ n4, nx4, s2, v3 }));
  const l4 = await listed(/lined up \(shared space, checked 3 cm at spot A\)/);
  check('guide: the laptop\'s list says checked 3 cm at spot A', l4, await diag());
  // 40 cm off: red, back to Line up (calibrate on the room's spots, and why); Calibrate there, on to Check by itself,
  // Check at B: green
  await H2.evaluate(() => { HOST.collab.guideOpen(2); window.__xr.step(); });
  const s3 = await selfCheck(H2, 'A', [SA[0] + 0.4, SA[1], SA[2]]);
  const v4 = await G(H2);
  await menuPic(H2, 'guide-17-red-line-up.png');
  check('guide: Check at A 40 cm off: red (40 cm out at spot A: not lined up), back to Line up to calibrate on the room\'s spots, saying why',
    s3 && v4.open && v4.step === 1 && v4.case === 'room' && v4.flow === 'on' && v4.check.text === '40 cm out at spot A: not lined up' && v4.status.k === 'no' && v4.status.w === 'check' && v4.red && v4.red.spot === 'a' && !v4.ok,
    JSON.stringify(v4));
  const cal2 = await tap(H2, 'guide:cal');
  await frames(H2, 100);
  await menuPic(H2, 'guide-18-calibrating.png');
  await touch(H2, SA); await touch(H2, SB);
  await H2.evaluate(() => window.__xr.ctrl(0, null));
  const to2b = await stepUntil(H2, () => { const g = HOST.collab.guide(); return g.open && g.step === 2 && g.case === 'check'; }, null, 5000);
  const v5 = await G(H2);
  const s4 = await selfCheck(H2, 'B', [SB[0], SB[1], SB[2] + 0.02]);
  const v6 = await G(H2);
  check('guide: Calibrate on the room\'s two spots from Line up goes on to Check by itself; Check at B 2 cm off: green, the flow done',
    cal2 && to2b && v5.src === 'marks' && !v5.red && s4 && v6.check.text === 'Lined up: 2 cm at spot B' && v6.ok && v6.ok.how === 'b' && v6.flow === 'done' && !v6.open &&
      await H2.evaluate(id => { const M = HOST.collab.internals().keys.get('rm'); return !!(M && M.v.by === id); }, await H1.evaluate(() => HOST.collab.id)),
    JSON.stringify({ cal2, to2b, v5: [v5.step, v5.case, v5.src, v5.red], s4, v6 }));
  const l5 = await listed(/lined up \(the room's spots, checked 2 cm at spot B\)/) && await listed(/lined up \(the room's spots, checked 3 cm at spot A\)/) && await listed(/2 of 2 headsets in the room lined up, 2 checked/);
  await laptopPic('guide-19-laptop-spots.png', /checked 2 cm at spot B/);
  check('guide: the laptop\'s list says each headset lined up from the room\'s spots and checked at its spot (2 of 2, 2 checked)', l5, await diag());
  await floorSpots({ H1, H2, A, xr, inSpace, stepUntil, tap, touch, selfCheck, G, menuPic });
  for (const H of [H1, H2]) await H.evaluate(() => window.__xr.end()).catch(() => {});
  for (const p of [A, H1, H2]) await p.context().close();
}

// ---- floor spots (v122; the end of the guide round, so --guide runs it): the spots are tape crosses on the floor, so a
// calibration's floor is the floor under them (mark A's touch less FLOOR_TIP), whatever a headset's own floor says. The
// first headset back with its own floor 20 cm too high (and a room scan's floor plane) finds its spots again, the room's
// floor on the true floor; calibrating on them again, spot B 5 cm higher is refused (back to spot A), then the spots on
// the floor (B 3 cm higher, within the 4 cm allowed): the room's floor on the true floor within 1 cm, its rm { a:
// FLOOR_TIP, f: 1 } and the log's touch heights and dh (over its floor and over the scan's). Back with its own floor 90 cm
// too low (the owner's Quest, 7 November 2026: spot A 92 cm over its floor, which v122's first limit refused), calibrating
// on them again is taken: no limit on how high spot A is over a headset's floor. The second with its own floor 15 cm too low the same,
// within 1 cm of the first, writing nothing to the room's floor; lined up through the shared space instead (its own floor
// kept there), Check at A on the spot says the 15 cm are in height. A calibration from before v122 (no f: two table
// corners) found again keeps the old rule: its own floor while the room's floor is other spots (and the room's floor spots
// left alone), the floor under it that an older device's rm says for its corners
async function floorSpots({ H1, H2, A, xr, inSpace, stepUntil, tap, touch, selfCheck, G, menuPic }) {
  const FUP = [FLOOR[0], 0.2, FLOOR[2], FLOOR[3]], FDN = [FLOOR[0], -0.15, FLOOR[2], FLOOR[3]];   // (each headset's floor: 20 cm too high, 15 cm too low)
  const SA = [1.0, TIP, -0.8], SB = [2.8, TIP, -0.2], dAB = Math.hypot(SB[0] - SA[0], SB[2] - SA[2]);
  // the room's frame as the pretend room has it: its origin and x axis in the room, what the headset's floor says, the room's floor
  const roomOf = H => H.evaluate(() => {
    const X = window.__xr, f = HOST.room.frame, R = HOST.room.internals(), M = HOST.collab.internals().keys.get('rm');
    return { src: HOST.room.src, o: f ? new THREE.Vector3(...f.o).applyMatrix4(X.W.floor).toArray().map(v => +v.toFixed(4)) : null,
      x: f ? new THREE.Vector3(...f.x).transformDirection(X.W.floor).toArray().map(v => +v.toFixed(4)) : null, y: f ? +f.o[1].toFixed(4) : null,
      mk: HOST.room.marks, note: HOST.room.floorNote(), f: R.saved ? R.saved.f : null, rm: M ? M.v : null, state: HOST.room.state };
  });
  const since = (H, mark) => H.evaluate(m => { const L = window.__collabLog, i = L.map(e => e.ev).lastIndexOf(m); return L.slice(i + 1); }, mark);
  const lastNote = H => H.evaluate(() => HOST.collab.notes().slice(-1)[0] || null);
  const calib = H => H.evaluate(() => { const c = HOST.room.internals().calib; return [HOST.room.state, c ? c.step : '']; });
  const back = async (H, head, floor, o) => {   // (a new session on that floor, in the shared space, its spots found again)
    await H.evaluate(() => window.__xr.end());
    await xr(H, head, Object.assign({ floor }, o || {}));
    await H.evaluate(p => { if (p) window.__xr.frame.detectedPlanes = new Set([{ semanticLabel: 'floor', planeSpace: { world: new THREE.Matrix4() }, polygon: [] }]); window.__xr.begin(); }, !!(o && o.plane));
    await frames(H, 300);
    await inSpace(H);
    return stepUntil(H, () => HOST.room.src === 'anchor' && !!HOST.room.frame, null, 15000);
  };
  // the first headset, its own floor 20 cm too high, with a room scan whose floor plane is the true floor: its spots found
  // again put the room's floor on the true floor
  const f1 = await back(H1, [0, 1.6, 0, 0], FUP, { plane: true, features: ['local-floor', 'anchors', 'shared', 'plane-detection'] });
  const r1 = await roomOf(H1);
  check('floor spots: a headset whose own floor is 20 cm too high finds its floor spots again: the room\'s floor on the true floor (within 1 cm), and it says its floor is 20 cm higher',
    f1 && r1.src === 'anchor' && near(r1.o, [SA[0], 0, SA[2]], 0.01) && Math.abs(r1.y + 0.2) < 0.01 && r1.f === 1 && /floor is 20 cm higher than the room/.test(r1.note), JSON.stringify(r1));
  // calibrating on them again: spot B 5 cm higher than spot A refused (back to A), then both on the floor (B 3 cm higher
  // than A, as a controller tilted another way puts its tip: taken)
  await H1.evaluate(() => { HOST.collab.guideOpen(1); window.__xr.step(); });
  const c0 = await tap(H1, 'guide:cal');
  await H1.evaluate(() => window.__collabLog.push({ ev: 'test floor spots' }));
  await touch(H1, SA); await touch(H1, [SB[0], SB[1] + 0.05, SB[2]]);
  const s1 = await calib(H1), n1 = await lastNote(H1);
  check('floor spots: spot B 5 cm higher than spot A is refused, back to spot A (Spots at different heights: both on the floor)',
    c0 && s1[0] === 'mark-a' && s1[1] === 'a' && !!n1 && n1.title === 'Spots at different heights' && /^Spot B is 5 cm higher than spot A\. Both spots must be on the floor/.test(n1.text), JSON.stringify({ c0, s1, n1 }));
  await touch(H1, SA); await touch(H1, [SB[0], SB[1] + 0.03, SB[2]]);
  await H1.evaluate(() => window.__xr.ctrl(0, null));
  await stepUntil(H1, () => HOST.room.src === 'marks', null, 5000);
  const r2 = await roomOf(H1), l1 = (await since(H1, 'test floor spots')).filter(e => /^(mark refused|floor spots)$/.test(e.ev));
  const sp = l1.find(e => e.ev === 'floor spots') || null, rh = l1.find(e => e.ev === 'mark refused' && e.why === 'heights') || null, h1Id = await H1.evaluate(() => HOST.collab.id);
  check('floor spots: on the floor (B 3 cm higher than A) they are taken, the room\'s floor on the true floor (within 1 cm) though this headset\'s floor is 20 cm too high; the room\'s floor is floor spots (rm: a 2 cm, f 1)',
    r2.src === 'marks' && near(r2.o, [SA[0], 0, SA[2]], 0.01) && r2.f === 1 && !!r2.mk && Math.abs(r2.mk[0] - TIP) < 2e-3 && Math.abs(r2.mk[1] - dAB) < 0.01 &&
      !!r2.rm && r2.rm.f === 1 && Math.abs(r2.rm.a - TIP) < 1e-3 && r2.rm.by === h1Id && /floor is 20 cm higher than the room/.test(r2.note), JSON.stringify(r2));
  check('floor spots: the log has the refusals (B 5 cm over A) and the touch heights, over this headset\'s floor (-18 cm and -15 cm, 3 cm apart) and over the room scan\'s floor plane (2 cm and 5 cm)',
    l1.filter(e => e.ev === 'mark refused').map(e => e.why).join() === 'heights' && !!rh && Math.abs(rh.dh - 0.05) < 3e-3 && !!sp && Math.abs(sp.a + 0.18) < 3e-3 &&
      Math.abs(sp.b + 0.15) < 3e-3 && Math.abs(sp.dh - 0.03) < 3e-3 && Array.isArray(sp.scan) && Math.abs(sp.scan[0] - TIP) < 3e-3 && Math.abs(sp.scan[1] - TIP - 0.03) < 3e-3 &&
      sp.tip === TIP, JSON.stringify(l1));
  // the owner's case: back with its own floor 90 cm too low, spot A touched on the floor is 92 cm over this headset's
  // floor; taken (nothing refused), the room's floor on the true floor (within 1 cm), its floor said 90 cm lower
  await frames(H1, 600);   // (the new spots' anchors made before the session ends)
  const FLOW = [FLOOR[0], -0.9, FLOOR[2], FLOOR[3]];
  const f9 = await back(H1, [0, 1.6, 0, 0], FLOW);
  await H1.evaluate(() => window.__collabLog.push({ ev: 'test floor spots low' }));
  await H1.evaluate(() => { HOST.collab.guideOpen(1); window.__xr.step(); });
  const c9 = await tap(H1, 'guide:cal');
  await touch(H1, SA);
  const s9 = await calib(H1);
  await touch(H1, SB);
  await H1.evaluate(() => window.__xr.ctrl(0, null));
  await stepUntil(H1, () => HOST.room.src === 'marks', null, 5000);
  const r9 = await roomOf(H1), l9 = (await since(H1, 'test floor spots low')).filter(e => /^(mark refused|floor spots)$/.test(e.ev));
  const sp9 = l9.find(e => e.ev === 'floor spots') || null;
  await menuPic(H1, 'guide-20-floor-far-off.png');
  check('floor spots: a headset whose own floor is 90 cm too low (spot A 92 cm over it, the owner\'s Quest) calibrates on them: spot A taken, nothing refused, the room\'s floor on the true floor (within 1 cm), its floor said 90 cm lower',
    f9 && c9 && s9[0] === 'mark-b' && s9[1] === 'b' && r9.src === 'marks' && near(r9.o, [SA[0], 0, SA[2]], 0.01) && r9.f === 1 && Math.abs(r9.y - 0.9) < 0.01 &&
      /floor is 90 cm lower than the room/.test(r9.note) && !l9.some(e => e.ev === 'mark refused') && !!sp9 && Math.abs(sp9.a - 0.92) < 3e-3 &&
      !!r9.rm && r9.rm.f === 1 && Math.abs(r9.rm.a - TIP) < 1e-3, JSON.stringify({ f9, c9, s9, r9, l9 }));
  // the second headset, its own floor 15 cm too low: its floor spots found again, then calibrated on again, the room's
  // floor within 1 cm of the first's, nothing written to the room's floor (the same spots: within 10 cm of the distance)
  const rmWas = JSON.stringify((await roomOf(H1)).rm);
  await H2.evaluate(() => window.__collabLog.push({ ev: 'test floor spots' }));
  const f2 = await back(H2, [0.6, 1.6, 0.4, 0.3], FDN);
  const r3a = await roomOf(H2);
  await H2.evaluate(() => { HOST.collab.guideOpen(1); window.__xr.step(); });
  const c2 = await tap(H2, 'guide:cal');
  await touch(H2, SA); await touch(H2, SB);
  await H2.evaluate(() => window.__xr.ctrl(0, null));
  await stepUntil(H2, () => HOST.room.src === 'marks', null, 5000);
  await frames(H2, 1200);   // (its room's floor looked at again meanwhile)
  const r3b = await roomOf(H2), r1b = await roomOf(H1), cl2 = (await since(H2, 'test floor spots')).filter(e => e.ev === 'floor claimed');
  check('floor spots: a second headset whose own floor is 15 cm too low finds its floor spots again and calibrates on them again: the room\'s floor within 1 cm of the first headset\'s (origin and direction)',
    f2 && r3a.src === 'anchor' && near(r3a.o, [SA[0], 0, SA[2]], 0.01) && c2 && r3b.src === 'marks' && r3b.f === 1 && near(r3b.o, r1b.o, 0.01) && near(r3b.x, r1b.x, 0.005) &&
      Math.abs(r3b.y - 0.15) < 0.01 && /floor is 15 cm lower than the room/.test(r3b.note), JSON.stringify({ f2, r3a, r3b, r1b }));
  check('floor spots: the second headset writes nothing to the room\'s floor (the same spots, within 10 cm of the distance)', !cl2.length && JSON.stringify(r3b.rm) === rmWas,
    JSON.stringify({ cl2, rm: r3b.rm, rmWas }));
  // lined up through the shared space instead (Forget: it keeps its own floor there), Check at A with the tip on spot A:
  // 15 cm out, all of it in height (this headset's floor against the room's)
  await H2.evaluate(() => HOST.room.forget());
  const ad = await stepUntil(H2, () => HOST.room.src === 'adopted' && !!HOST.room.marks, null, 20000);
  await H2.evaluate(() => { HOST.collab.guideOpen(2); window.__xr.step(); });
  const sc = await selfCheck(H2, 'A', SA), gc = await G(H2);
  check('floor spots: a headset lined up through the shared space keeps its own floor (15 cm too low); Check at A on the spot says so: 15 cm out at spot A (15 cm in height)',
    ad && sc && gc.check.text === '15 cm out at spot A (15 cm in height): fine for walking about; calibrate on the spots for close work' &&
      await H2.evaluate(() => HOST.collab.notes().some(n => n.title === '15 cm out (15 cm in height)')), JSON.stringify({ ad, sc, check: gc.check, src: gc.src }));
  // a calibration from before v122 (no f: two table corners, 1.2 m apart), found again: the old rule. The room's floor is
  // other spots, so its own floor; the room's floor spots left alone (their headset is here)
  await H1.evaluate(() => window.__xr.end());   // (no session: nobody writes the room's floor spots again below)
  const TA = [1.4, 0.76, 0.5], TB = [2.6, 0.76, 0.5];
  await H2.evaluate(() => window.__xr.end());
  await H2.evaluate(([F, a, b]) => {
    const V = (x, y, z) => new THREE.Vector3(x, y, z), W = new THREE.Matrix4().compose(V(F[0], F[1], F[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), F[3]), V(1, 1, 1)).invert();
    const lf = p => V(...p).applyMatrix4(W).toArray().map(v => Math.round(v * 1000) / 1000), ha = 'old-a-' + Date.now(), hb = 'old-b-' + Date.now();
    window.__handles.set(ha, new THREE.Matrix4().makeTranslation(...a)); window.__handles.set(hb, new THREE.Matrix4().makeTranslation(...b));
    const S = { v: 2, a: lf(a), b: lf(b), at: Date.now() - 86400000, anchors: [ha, hb] };
    localStorage.setItem('roomFrame', JSON.stringify(S)); HOST.room.internals().saved = S;
    window.__collabLog.push({ ev: 'test old marks' });
  }, [FDN, TA, TB]);
  const rmOld = JSON.stringify((await roomOf(H2)).rm);
  await xr(H2, [0.6, 1.6, 0.4, 0.3], { floor: FDN, features: ['local-floor', 'anchors'] });
  await H2.evaluate(() => window.__xr.begin());
  const fo = await stepUntil(H2, () => HOST.room.src === 'anchor' && !!HOST.room.frame, null, 15000);
  await frames(H2, 1200);
  const o1 = await roomOf(H2), oc = (await since(H2, 'test old marks')).filter(e => e.ev === 'floor claimed');
  check('floor spots: a calibration from before v122 (no f, two table corners) found again keeps the old rule: its own floor (the room\'s floor is other spots), the room\'s floor spots left alone',
    fo && o1.src === 'anchor' && !o1.f && Math.abs(o1.y) < 3e-3 && Math.abs(o1.o[1] + 0.15) < 0.01 && !!o1.mk && Math.abs(o1.mk[0] - 0.91) < 0.01 && Math.abs(o1.mk[1] - 1.2) < 0.01 &&
      !oc.length && JSON.stringify(o1.rm) === rmOld, JSON.stringify({ fo, o1, oc, rmOld }));
  // ...and an older device's floor for those corners (rm: mark A 76 cm over the true floor, no f): the room stands on it
  const aId = await A.evaluate(() => HOST.collab.id);
  await A.evaluate(v => HOST.collab.publish([['rm', v]]), { a: 0.76, d: 1.2, by: aId, at: Date.now() });
  const ot = await stepUntil(H2, () => Math.abs(HOST.room.frame.o[1] - 0.15) < 0.01, null, 10000);
  const o2 = await roomOf(H2);
  check('floor spots: ...and with an older device\'s floor for those corners (rm without f) it stands the room on it, as before v122 (the room\'s floor on the true floor)',
    ot && Math.abs(o2.o[1]) < 0.01 && !!o2.mk && Math.abs(o2.mk[0] - 0.76) < 0.01 && !!o2.rm && o2.rm.by === aId, JSON.stringify(o2));
  await H2.evaluate(() => { localStorage.removeItem('roomFrame'); window.__xr.end(); });
}

// ---- the relay's password (--token runs only this part; a relay of its own with COLLAB_TOKEN, a minute or two). A page
// without it sees the dialog's field, and nothing starts or is joined peer to peer or on the device meanwhile; a wrong one
// is refused with its note; the right one starts the room on the relay and is kept for the relay's origin; a page that has
// it joins by the link, which carries none; a pretend headset without it gets the menu's Relay password row and its keypad
// page (letters and digits, Delete, Use greyed while empty, a wrong one refused) and joins; the password is in no log, no
// address, no room key and none of the relay's lines or files; Forget the password asks for it again
async function tokenRound() {
  const PASS = 'networks' + Math.floor(1000 + Math.random() * 9000) + 'future';   // (made here: no password is kept in the repository)
  const logs = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-pass-'));
  const T = { proc: null, port: 0, out: '' };
  T.proc = spawn(process.execPath, ['relay/server.mjs', '--port', '0', '--host', '127.0.0.1', '--static', '.', '--logs', logs], { cwd: root, env: { ...process.env, RELAY_ARGS: '', COLLAB_TOKEN: PASS } });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('the relay with a password did not start: ' + T.out)), 10000);
    T.proc.stdout.on('data', d => { T.out += d; const m = /listening on http:\/\/[^:]+:(\d+)/.exec(T.out); if (m && !T.port) { T.port = +m[1]; clearTimeout(t); res(); } });
    T.proc.stderr.on('data', d => { T.out += d; });
  });
  const tb = `http://127.0.0.1:${T.port}/`, origin = `http://127.0.0.1:${T.port}`, pages = [];
  const topen = async (hash, o = {}) => {
    const ctx = await browser.newContext({ viewport: o.size || { width: 900, height: 700 } });
    if (o.token) await ctx.addInitScript(([k, t]) => { try { localStorage.setItem('relayTokens', JSON.stringify({ [k]: t })); } catch (e) { /* storage blocked */ } }, [origin, o.token]);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.stack || e.message));
    page.on('console', m => { if (m.type() === 'error' && !/404|401|Failed to load resource|WebSocket connection/.test(m.text())) errors.push(m.text()); });
    await page.goto(tb + 'index.html' + hash, { timeout: 90000 });
    await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
    pages.push(page);
    return page;
  };
  const auth = p => p.evaluate(() => HOST.collab.auth());
  const kept = p => p.evaluate(o => { try { return (JSON.parse(localStorage.getItem('relayTokens') || '{}') || {})[o] || ''; } catch (e) { return ''; } }, origin);
  const peerish = p => p.evaluate(() => window.__collabLog.filter(e => /^(peer to peer|local room|hosting)/.test(e.ev)).map(e => e.ev));
  const shot = async (page, file) => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, file) }); } };
  try {
    // a page without the password: the relay serves it, and the dialog asks for its password; nothing starts meanwhile
    const A = await topen('#stories');
    await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.dialog(true); });
    const need = await until(A, () => HOST.collab.auth().state === 'need', null, 10000);
    const field = await until(A, () => { const d = document.querySelector('#shared .sh-pass'); return !!d && !d.hidden && getComputedStyle(d).display !== 'none' && /needs its password/.test(d.textContent); }, null, 5000);
    await A.evaluate(() => HOST.collab.create());
    await sleep(2500);
    const a0 = await A.evaluate(() => ({ code: HOST.collab.code, via: HOST.collab.via, a: HOST.collab.auth(), relay: HOST.collab.relay }));
    await A.evaluate(() => HOST.collab.join('QQJ'));
    await sleep(2500);
    const j0 = await A.evaluate(() => ({ code: HOST.collab.code, via: HOST.collab.via, status: HOST.collab.status, local: HOST.collab.local }));
    await A.evaluate(() => HOST.collab.leave());
    const p0 = await peerish(A);
    await shot(A, 'token-1-field.png');
    check('password: a page without the relay\'s password sees the dialog\'s field (This relay needs its password); Start a room waits for it, a join by code waits for it on the relay, nothing peer to peer or on this device',
      need && field && !a0.code && a0.a.create && a0.relay === origin && j0.code === 'QQJ' && j0.via === 'relay' && j0.status === 'auth' && !j0.local && !p0.length,
      JSON.stringify({ need, field, a0, j0, p0, a: await auth(A) }));
    // a wrong one: refused, said so, nothing kept
    await A.fill('#shPass', 'wrong' + PASS.slice(5, 9));
    await A.click('[data-sh="pass"]');
    const wrong = await until(A, () => HOST.collab.auth().state === 'wrong' && /not this relay's password/.test(document.querySelector('#shared .sh-passnote').textContent), null, 8000);
    await shot(A, 'token-2-wrong.png');
    check('password: a wrong one is refused with "That is not this relay\'s password", and nothing is kept', wrong && !(await kept(A)) && !(await A.evaluate(() => HOST.collab.code)),
      JSON.stringify({ wrong, a: await auth(A), note: await A.evaluate(() => document.querySelector('#shared .sh-passnote').textContent) }));
    // the right one: the room waiting to start starts on the relay; the password kept for the relay's origin
    await A.fill('#shPass', PASS);
    await A.press('#shPass', 'Enter');
    const opened = await until(A, () => HOST.collab.status === 'open' && HOST.collab.via === 'relay' && !!HOST.collab.code, null, 15000);
    const rc = await A.evaluate(() => HOST.collab.code), aDone = await auth(A), aKept = await kept(A);
    const hidden = await A.evaluate(() => document.querySelector('#shared .sh-pass').hidden);
    check('password: the right one is accepted, kept under the relay\'s origin (relayTokens), the field goes, and the room that waited starts on the relay',
      opened && aKept === PASS && !aDone.state && aDone.kept && hidden, JSON.stringify({ opened, rc, aDone, kept: aKept === PASS, hidden, st: await A.evaluate(() => [HOST.collab.status, HOST.collab.via]) }));
    // a second device that has it joins by the link, which carries no password
    const link = await A.evaluate(() => location.href.replace(/#.*$/, '') + HOST.collab.hash());
    const B = await topen(link.slice(link.indexOf('#')), { token: PASS });
    const bIn = await until(B, c => HOST.collab.code === c && HOST.collab.status === 'open' && HOST.collab.via === 'relay', rc, 20000);
    check('password: a second page that has it joins by the room\'s link; the link and the address carry no password', bIn && !link.includes(PASS) && link.includes('s=' + rc) &&
      !(await B.evaluate(() => location.href)).includes(PASS) && !(await A.evaluate(() => location.href)).includes(PASS), JSON.stringify({ bIn, link: link.replace(PASS, '<the password>') }));
    // a pretend headset without it: the menu's Relay password row, its keypad page, a wrong one refused, then the right one
    const H = await topen('#airports', { size: { width: 320, height: 200 } });
    await ready(H, 'airports');
    await H.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [0, 1.6, 0, 0] });
    await H.evaluate(async () => { window.__xr.begin(); await HOST.collab.detect(); HOST.collab.panelOpen(true); HOST.collab.menuTab('circles'); });
    await frames(H, 300);
    const tap = id => H.evaluate(async id => { const X = window.__xr, r = HOST.collab.menuFind(id), ok = !!(r && r.fn); if (ok) r.fn();
      for (let k = 0; k < 2; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); } return ok; }, id);
    const has = id => H.evaluate(id => { const r = HOST.collab.menuFind(id); return r ? !!r.fn : null; }, id);
    const hNeed = await until(H, () => HOST.collab.auth().state === 'need', null, 10000);
    const row = await has('pass'), page = await tap('pass'), use0 = await has('pass:use'), keys = await H.evaluate(() => HOST.collab.menuIds().filter(i => /^pk:/.test(i)).map(i => i.slice(3)).join(''));
    if (shots) { const u = await H.evaluate(() => HOST.collab.overlay().panel.ctx.canvas.toDataURL('image/png')); fs.writeFileSync(path.join(shots, 'token-3-keypad.png'), Buffer.from(u.split(',')[1], 'base64')); }
    let typed = true;
    for (const ch of 'nope1') typed = (await tap('pk:' + ch)) && typed;
    const use1 = await has('pass:use');
    await tap('pass:use');
    const hWrong = await until(H, () => HOST.collab.auth().state === 'wrong', null, 8000);
    await frames(H, 200);
    const stillPage = await has('pass:del');
    for (let k = 0; k < 5; k++) await tap('pass:del');
    const emptied = await has('pass:use');
    for (const ch of PASS + 'z') typed = (await tap('pk:' + ch)) && typed;
    const del = await tap('pass:del');
    await tap('pass:use');
    const hOk = await until(H, () => !HOST.collab.auth().state && HOST.collab.auth().kept, null, 10000);
    await frames(H, 200);
    const rowGone = await has('pass');
    await H.evaluate(c => HOST.collab.join(c), rc);
    const hIn = await until(H, c => HOST.collab.code === c && HOST.collab.status === 'open' && HOST.collab.via === 'relay', rc, 20000);
    check('password: a pretend headset without it gets the menu\'s Relay password row; its keypad page (26 letters and 10 digits, Use greyed while empty, Delete) refuses a wrong one and takes the right one; the row goes and it joins the room',
      hNeed && row === true && page && use0 === null && keys === 'abcdefghijklmnopqrstuvwxyz0123456789' && typed && use1 === true && hWrong && stillPage === true && emptied === null && del && hOk && rowGone === null && hIn && (await kept(H)) === PASS,
      JSON.stringify({ hNeed, row, page, use0, keys, typed, use1, hWrong, stillPage, emptied, del, hOk, rowGone, hIn, a: await auth(H) }));
    // nowhere else: the pages' logs and addresses, the room's keys, the relay's lines and its log files
    await frames(H, 11000);   // (a headset in a room sends its log to the relay every 10 s)
    const inLog = [];
    for (const p of [A, B, H]) if (await p.evaluate(t => JSON.stringify(window.__collabLog).includes(t) || location.href.includes(t) || JSON.stringify([...HOST.collab.internals().keys]).includes(t), PASS)) inLog.push(pages.indexOf(p));
    const room = await (await fetch(tb + 'api/rooms/' + rc, { headers: { Authorization: 'Bearer ' + PASS } })).text();
    const files = fs.readdirSync(logs).map(f => fs.readFileSync(path.join(logs, f), 'utf8')).join('\n');
    check('password: in no page\'s log (window.__collabLog), address or room key, not in the room the relay keeps, nor in the relay\'s lines or its log files',
      !inLog.length && room.includes(rc) && !room.includes(PASS) && !T.out.includes(PASS) && files.length > 0 && !files.includes(PASS) && /A password is needed/.test(T.out),
      JSON.stringify({ inLog, room: room.length, out: T.out.includes(PASS), files: files.length, inFiles: files.includes(PASS) }));
    // Forget the password (the dialog's relay part): asked for again
    await A.evaluate(() => { HOST.collab.leave(); HOST.collab.dialog(true); });
    const fb = await until(A, () => { const b = document.querySelector('[data-sh="forget"]'); return !!b && !b.hidden && !b.closest('[hidden]'); }, null, 5000);
    await A.click('[data-sh="forget"]');
    const forgot = await until(A, () => HOST.collab.auth().state === 'need' && !document.querySelector('#shared .sh-pass').hidden, null, 10000);
    check('password: Forget the password in the dialog\'s relay part takes it off this device, and the field asks for it again', fb && forgot && !(await kept(A)),
      JSON.stringify({ fb, forgot, a: await auth(A) }));
    await H.evaluate(() => window.__xr.end()).catch(() => {});
    // ---- the relay a page offers (v115, HOME_RELAY: the main site on GitHub Pages offers the Coolify relay): a page whose
    // own server is no relay (the main test relay's /api turned away for it, as GitHub Pages has none), offered this
    // relay by the test hook. Without the password its rooms are not on the relay (here, with &peer=off, on this device);
    // a wrong one changes nothing; the right one makes it this device's relay (kept), and a room then starts there;
    // Forget the password, out of a room, gives the offer back. A pretend headset takes it through the menu's keypad
    const hopen = async (hash, o = {}) => {
      const ctx = await browser.newContext({ viewport: o.size || { width: 900, height: 700 } });
      await ctx.route(base() + 'api/**', r => r.abort());   // (the page's own server is no relay here)
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.stack || e.message));
      page.on('console', m => { if (m.type() === 'error' && !/404|401|Failed to load resource|ERR_FAILED|WebSocket connection/.test(m.text())) errors.push(m.text()); });
      await page.goto(base() + 'index.html' + hash, { timeout: 90000 });
      await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
      pages.push(page);
      return page;
    };
    const O = await hopen('#stories&peer=' + `127.0.0.1:${port}/peerjs`);   // (peer to peer through the test relay's introduction server, never the internet)
    const offered = await O.evaluate(async u => { await HOST.collab.detect(); const o = HOST.collab.homeRelay(u); HOST.collab.dialog(true); return o; }, tb);
    const box = () => O.evaluate(() => { const d = document.querySelector('#shared .sh-home'); return !!d && !d.hidden && getComputedStyle(d).display !== 'none' && !d.closest('[hidden]'); });
    for (const p of [A, B, H]) await p.context().close().catch(() => {});   // (three pages drawing in software slow the next one down)
    const shown0 = await until(O, () => { const d = document.querySelector('#shared .sh-home'); return !!d && !d.hidden; }, null, 15000);
    const said = await O.evaluate(() => [document.querySelector('#shared .sh-homewhat').textContent, document.querySelector('#shared .sh-status').textContent]);
    await O.evaluate(() => HOST.collab.create());
    const local = await until(O, () => !!HOST.collab.code && HOST.collab.via === 'peer' && HOST.collab.status === 'open', null, 20000);
    const o0 = await O.evaluate(() => ({ code: HOST.collab.code, via: HOST.collab.via, relay: HOST.collab.relay }));
    await O.evaluate(() => { HOST.collab.leave(); HOST.collab.dialog(true); });
    check('the relay a page offers: shown in the Shared dialog while no relay is in use (out of a room), saying rooms run peer to peer without it; a room started then is not on the relay',
      offered === tb.replace(/\/$/, '') && shown0 && await box() && /peer to peer/.test(said[0]) && /relay's password/.test(said[1]) && local && o0.via === 'peer' && !o0.relay,
      JSON.stringify({ offered, shown0, box: await box(), said, o0 }));
    await O.fill('#shHome', 'wrong' + PASS.slice(5, 9));
    await O.click('[data-sh="home"]');
    const oWrong = await until(O, () => HOST.collab.auth().home === 'wrong' && /not the relay's password/.test(document.querySelector('#shared .sh-homenote').textContent), null, 8000);
    const oStill = await O.evaluate(() => ({ relay: HOST.collab.relay, offer: HOST.collab.auth().offer }));
    check('the relay a page offers: a wrong password is refused and said so; the device keeps no password and no relay, and the offer stays',
      oWrong && !oStill.relay && !!oStill.offer && !(await kept(O)), JSON.stringify({ oWrong, oStill }));
    await O.fill('#shHome', PASS);
    await O.press('#shHome', 'Enter');
    const oOk = await until(O, o => HOST.collab.relay === o && !HOST.collab.auth().offer && document.querySelector('#shared .sh-home').hidden, origin, 10000);
    const oKept = await kept(O), oStored = await O.evaluate(() => localStorage.getItem('collabRelay'));
    await O.evaluate(() => HOST.collab.create());
    const oRoom = await until(O, () => HOST.collab.status === 'open' && HOST.collab.via === 'relay' && !!HOST.collab.code, null, 15000);
    check('the relay a page offers: the right password makes it this device\'s relay (kept, as one typed in, with its password), the offer goes, and a room then starts on it',
      oOk && oKept === PASS && oStored === origin && oRoom, JSON.stringify({ oOk, kept: oKept === PASS, oStored, oRoom, a: await auth(O) }));
    await O.evaluate(() => { HOST.collab.leave(); HOST.collab.dialog(true); });
    await O.click('[data-sh="forget"]');
    const oBack = await until(O, () => !HOST.collab.relay && !!HOST.collab.auth().offer && !document.querySelector('#shared .sh-home').hidden && document.querySelector('#shared .sh-pass').hidden, null, 8000);
    check('the relay a page offers: Forget the password, out of a room, takes the password and the relay off this device, and the offer is back',
      oBack && !(await kept(O)) && !(await O.evaluate(() => localStorage.getItem('collabRelay'))), JSON.stringify({ oBack, a: await auth(O), relay: await O.evaluate(() => HOST.collab.relay) }));
    // the studio asks the offered relay for its scenes (relayFind gives it, with no password yet); its 401 brings up This
    // relay needs its password (the offer's own box giving way to it), and the password given there makes it this device's
    const rf = await O.evaluate(() => HOST.collab.relayFind());
    await O.evaluate(b => { HOST.collab.relaySaw(b, 401, '', { error: 'missing or wrong token' }); HOST.collab.dialog(true); }, rf && rf.base);
    const asked = await until(O, () => !document.querySelector('#shared .sh-pass').hidden && document.querySelector('#shared .sh-home').hidden, null, 8000);
    await O.fill('#shPass', PASS);
    await O.click('[data-sh="pass"]');
    const viaPass = await until(O, o => HOST.collab.relay === o && !HOST.collab.auth().state, origin, 10000);
    check('the relay a page offers: the studio asks it for its scenes (relayFind gives it, no password yet); a 401 there brings up This relay needs its password in place of the offer, and the password given there makes it this device\'s relay',
      !!rf && rf.base === tb.replace(/\/$/, '') && !rf.token && asked && viaPass && (await kept(O)) === PASS, JSON.stringify({ rf, asked, viaPass, a: await auth(O) }));
    // a pretend headset: the menu's Circles tab offers it (Relay password), its keypad takes the password
    const G = await hopen('#airports&peer=off', { size: { width: 320, height: 200 } });
    await ready(G, 'airports');
    await G.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [0, 1.6, 0, 0] });
    await G.evaluate(async u => { window.__xr.begin(); await HOST.collab.detect(); HOST.collab.homeRelay(u); HOST.collab.panelOpen(true); HOST.collab.menuTab('circles'); }, tb);
    await frames(G, 300);
    const gtap = id => G.evaluate(async id => { const X = window.__xr, r = HOST.collab.menuFind(id), ok = !!(r && r.fn); if (ok) r.fn();
      for (let k = 0; k < 2; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); } return ok; }, id);
    const ghas = id => G.evaluate(id => { const r = HOST.collab.menuFind(id); return r ? !!r.fn : null; }, id);
    const gRow = await ghas('homepass'), gPage = await gtap('homepass'), gKeys = await ghas('pk:a');
    let gTyped = true;
    for (const ch of PASS) gTyped = (await gtap('pk:' + ch)) && gTyped;
    await gtap('pass:use');
    const gOk = await until(G, o => HOST.collab.relay === o && !HOST.collab.auth().offer, origin, 10000);
    await frames(G, 200);
    const gGone = await ghas('homepass');
    check('the relay a page offers: a pretend headset\'s menu (Circles) has a Relay password row for it; its keypad takes the password, and the headset uses the relay from then on (the row gone)',
      gRow === true && gPage && gKeys === true && gTyped && gOk && gGone === null && (await kept(G)) === PASS, JSON.stringify({ gRow, gPage, gKeys, gTyped, gOk, gGone, a: await auth(G) }));
    await G.evaluate(() => window.__xr.end()).catch(() => {});
  } finally {
    for (const p of pages) await p.context().close().catch(() => {});
    await new Promise(r => { T.proc.once('exit', r); T.proc.kill(); });
    fs.rmSync(logs, { recursive: true, force: true });
  }
}

// ---- the studio in a room (--studio runs only this; also in the main run): a relay of its own (from port 8790 up) that
// serves the app and, with --scenes, a temporary copy of tools/studio/test/scenes and a second scene (so none is picked by
// itself: a station picks a scene only when the listing has exactly one); three pages and a pretend headset at a studio
// station. The headset menu's Studio here puts the circle at its feet; the scene picked on one page reaches all; an
// object moved by the arrows on one page and a cube added on another at once both kept; the headset inside the cube sees
// the figure (and not the box) while a page walking outside it does not; Save from the headset's panel writes layout.json
// (the old one in .history/, a second save a second), every page then saved by its name; a file copied into the scene's
// folder appears in the Add lists within a few seconds; the station's story locked refuses a page's edits and the
// headset's grip; Convert to GLB on a page writes models/figure.glb and every page's and the headset's figure switches to
// it where it stands (corners within 1 mm), the FBX under Originals; a sound made on a page to follow the rig scene's
// dancer's head (her model copied in): every page and the headset take it, each sound where its own dancer's head bone
// puts it at one scene clock (within 1 cm), and the saved layout.json carries on, bone and o; a cut-out made on a page on
// the box taken by every page and the headset (its corners within 1 cm, cutting there), and the saved layout.json carrying
// it under cuts; a group made on a page (the box, the figure, Tone and Doorway) and turned and sized there, taken by every
// page and the headset (each member within 1 cm), a Faces setting from another page reaching every device's materials, and
// the saved layout.json carrying groups and faces; a tint and a brightness set on a page (v125) reaching every device's
// record and the box's own materials, and saved; a shape that hides things and an empty with a sound following it made on a
// page, the shape locked and the scene's other circles hidden on another, reaching every page and the headset (the lock
// refusing a third page's card, the headset told to hide the other circles there) and saved in layout.json (v119); motions
// (v120: a wobble and an orbit set on two pages drawn in the same phase on every page and the headset at one held room time,
// saved in layout.json); a recorded path (v120: the headset records the box's movement with a grip; every page takes the
// path and, with the headset, draws the box at the same pose along it at one held room time); a ten-minute recording kept as
// a file and a voice (v125: made on a page, Chromium's fake microphone; every device draws the box at the same pose at one held
// room time, puts the voice at the same moment of its file, and two hear it where the room's clock says); From another scene (a model of a second scene copied into the open
// one with the files it names, an OBJ under originals/, a name taken: a new one; every device taking it); a circle made
// for one scene as the shell writes it opening that scene and writing its saved layout on the pages that follow it; New
// scene from the headset's panel (the shell's keypad stubbed) opening the new scene at its station; a long sound streamed (an
// element, no decoded buffer); the relay's /upload redirecting to the Upload pane, where a page makes a new scene and uploads the test
// originals (sorted into models/, sounds/ and originals/; the GLBs loading with their records; a short sound as a mono
// 16-bit WAV; a long one made mono MP3 by the relay's ffmpeg when this machine has it, else a mono WAV). Then a relay with
// COLLAB_TOKEN: a page without the password cannot list or save, one with it lists, saves and keeps a studio station in a
// room; the password is in no page's log, address or room key, nor in the relay's lines, log files or the saved layout.
// Then the scenes in Cloudflare R2 (--scenes r2) against the stand-in S3 (relay/s3fake.mjs) on another port (from 8840
// up): a page and the pretend headset open the test scene from the bucket (every file by its signed link, CORS, ranges
// and crossOrigin exercised by the browser; a long sound streamed), Save writes layout.json and .history/ there, Convert
// to GLB and the Upload pane send their files straight into the bucket (signed PUTs), a link the bucket refuses is read
// again, an upload it refuses goes through the relay, a copy from another scene is the bucket's (CopyObject), and the
// password goes nowhere.
// dir: pictures (studio-*.png)
async function relayOn(args, env, from) {
  for (let p = from; p < from + 20; p++) {
    const R = { proc: null, port: 0, out: '' };
    const ok = await new Promise(res => {
      R.proc = spawn(process.execPath, ['relay/server.mjs', '--port', String(p), '--host', '127.0.0.1', ...args],
        { cwd: root, env: { ...process.env, RELAY_ARGS: '', COLLAB_TOKEN: '', COLLAB_SCENES: '', ...env } });
      const t = setTimeout(() => res(false), 15000);
      R.proc.stdout.on('data', d => { R.out += d; if (!R.port && /listening on http:\/\/[^:]+:\d+/.test(R.out)) { R.port = p; clearTimeout(t); res(true); } });
      R.proc.stderr.on('data', d => { R.out += d; });
      R.proc.on('exit', () => { clearTimeout(t); res(false); });
    });
    if (ok) return R;
    if (R.proc.exitCode === null) R.proc.kill();
    if (!/EADDRINUSE/.test(R.out)) throw new Error('the relay did not start: ' + R.out);
  }
  throw new Error('no free port from ' + from);
}
const relayOff = R => new Promise(r => { if (!R || !R.proc || R.proc.exitCode !== null) return r(); R.proc.once('exit', r); R.proc.kill(); });
// an MP3's first frame (past an ID3 tag): MPEG-1 layer III, 44.1 kHz, mono?
function mp3Head(buf) {
  let i = buf.toString('latin1', 0, 3) === 'ID3' ? 10 + ((buf[6] & 127) << 21 | (buf[7] & 127) << 14 | (buf[8] & 127) << 7 | (buf[9] & 127)) : 0;
  for (; i < buf.length - 4; i++) if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) break;
  if (i >= buf.length - 4) return null;
  const h = buf.readUInt32BE(i);
  return { mpeg1: ((h >> 19) & 3) === 3, layer3: ((h >> 17) & 3) === 1, rate44: ((h >> 10) & 3) === 0, mono: ((h >> 6) & 3) === 3 };
}
async function studioRound(dir) {
  const tmp = n => fs.mkdtempSync(path.join(os.tmpdir(), 'collab-' + n + '-'));
  const SC = tmp('scenes'), SC2 = tmp('scenes-pass'), logs = tmp('logs-pass'), TEST = path.join(root, 'tools', 'studio', 'test', 'scenes');
  fs.cpSync(TEST, SC, { recursive: true }); fs.cpSync(TEST, SC2, { recursive: true });
  // (the textures, rig, cuts and puppet test scenes left out: the pages here list exactly two scenes; a model of each of the
  // first two comes into test/ below)
  for (const d of [SC, SC2]) for (const n of ['textures', 'rig', 'cuts', 'puppet']) fs.rmSync(path.join(d, n), { recursive: true, force: true });
  fs.mkdirSync(path.join(SC, 'quiet'));
  fs.copyFileSync(path.join(SC, 'test', 'tone.wav'), path.join(SC, 'quiet', 'tone.wav'));
  if (dir) fs.mkdirSync(dir, { recursive: true });
  const pages = [];
  let R = null, T = null, Q = null, S3r = null;
  // a page of its own (another device): its name in the room, and the relay's password kept for it when given
  const sopen = async (url, o = {}) => {
    const ctx = await browser.newContext({ viewport: o.size || { width: 640, height: 400 } });
    await ctx.addInitScript(([n, k, t]) => { try { if (n) localStorage.setItem('collabName', n); if (t) localStorage.setItem('relayTokens', JSON.stringify({ [k]: t })); } catch (e) { /* storage blocked */ } }, [o.name || '', o.origin || '', o.token || '']);
    const page = await ctx.newPage();
    if (o.reqs) page.on('response', r => { const u = new URL(r.url()); if (/^\/(api\/scenes|scenes\/)/.test(u.pathname)) o.reqs.push([r.status(), decodeURIComponent(u.pathname), u.searchParams.has('token'), !!r.request().headers().authorization]); });
    page.on('pageerror', e => errors.push('studio round: ' + (e.stack || e.message)));
    page.on('console', m => { if (m.type() === 'error' && !/404|401|Failed to load resource|WebSocket connection/.test(m.text())) errors.push('studio round: ' + m.text()); });
    await page.goto(url, { timeout: 90000 });
    await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
    pages.push(page);
    return page;
  };
  const sp = (p, s) => p.evaluate(s => HOST.cur.peek(s), s);
  const sUntil = (p, s, ms) => until(p, s => { try { return !!HOST.cur.peek(s); } catch (e) { return false; } }, s, ms || 10000);
  const studioIn = (p, ms) => until(p, () => HOST.curKey === 'studio' && !!HOST.cur && !!HOST.cur.collab.scene(), null, ms || 60000);
  const shot = async (p, f) => { if (dir) await p.screenshot({ path: path.join(dir, f) }); };
  // a pane's button pressed once it is drawn and enabled (the panes are drawn again a few times a second)
  const click = async (p, sel) => (await until(p, sel => { const b = document.querySelector(sel); return !!b && !b.disabled; }, sel, 8000)) &&
    p.evaluate(sel => { const b = document.querySelector(sel); if (b && !b.disabled) { b.click(); return true; } return false; }, sel);
  try {
    R = await relayOn(['--static', '.', '--scenes', SC], {}, 8790);
    const sb = `http://127.0.0.1:${R.port}/`;
    const A = await sopen(sb + 'index.html#stories', { name: 'Anna' });
    await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
    await until(A, () => HOST.collab.status === 'open', null, 10000);
    const rc = await A.evaluate(() => HOST.collab.code);
    const B = await sopen(sb + 'index.html#s=' + rc, { name: 'Ben', size: { width: 900, height: 640 } }), C = await sopen(sb + 'index.html#s=' + rc, { name: 'Cleo' });
    const H = await sopen(sb + 'index.html#s=' + rc, { name: 'Hana', size: { width: 320, height: 200 } });
    for (const p of [B, C, H]) await until(p, c => HOST.collab.code === c && HOST.collab.status === 'open', rc, 20000);
    await ready(H, 'airports');
    // the pretend headset aligned through the shared space (as in the main run)
    const aId = await A.evaluate(() => HOST.collab.id);
    await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
    await until(A, () => !HOST.collab.internals().pending.size, null, 3000);
    await H.evaluate(() => HOST.room.sharedAlign(true));
    await H.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [-1, 1.6, 2, 0.4] });
    await H.evaluate(() => window.__xr.begin());
    await frames(H, 400);
    await H.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'U1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
    await frames(H, 300);
    const al = await H.evaluate(() => HOST.room.aligned && HOST.room.src === 'adopted');

    // ---- the menu's Studio here: the circle at the headset's feet, facing its way, for every page
    const press = id => H.evaluate(async id => {
      const X = window.__xr; X.step(); X.step();
      const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn();
      for (let k = 0; k < 3; k++) { X.step(); await new Promise(res => setTimeout(res, 20)); }
      return !!(r && r.fn);
    }, id);
    await H.evaluate(() => HOST.collab.panelOpen(true));
    const at = await H.evaluate(() => { window.__xr.step(); const R = HOST.room.internals(); return { x: R.hr.x, z: R.hr.z, yaw: R.hyaw }; });
    const ph = await press('studio');
    let sid = '';
    for (let k = 0; k < 30 && !sid; k++) { await frames(H, 100); sid = await H.evaluate(() => (HOST.collab.stations().find(s => s.story === 'studio') || {}).id || ''); }
    const st = sid ? await H.evaluate(id => HOST.collab.station(id), sid) : null;
    let seen = !!sid;
    for (const p of [A, B, C]) seen = seen && await until(p, id => !!HOST.collab.station(id), sid, 5000);
    const nSt = await A.evaluate(() => HOST.collab.stations().length);
    const play = sid ? ((await (await fetch(sb + 'api/rooms/' + rc)).json()).keys['st.' + sid + '.play'] || {}).v : null;
    check('studio: the headset menu\'s Studio here puts the studio\'s circle at its feet, facing its way, for every page (its clock in explore mode)',
      al && ph && !!st && Math.hypot(st.x - at.x, st.z - at.z) < 0.02 && angle(st.yaw, at.yaw) < 0.02 && seen && nSt === 1 && !!play && play.mode === 'explore', JSON.stringify({ al, ph, at, st, seen, nSt, play }));
    await H.evaluate(() => HOST.collab.panelOpen(false));
    // standing in it the headset takes it as its station (the studio opens there); the pages follow it
    let inS = false;
    for (let k = 0; k < 40 && !inS; k++) { await frames(H, 300); inS = await H.evaluate(() => HOST.curKey === 'studio'); }
    inS = inS && await ready(H, 'studio', 60000);
    if (inS) { await H.evaluate(() => HOST.cur.peek('xrAdopt()')); await frames(H, 300); }
    for (const p of [A, B, C]) await p.evaluate(i => HOST.collab.follow(i), sid);
    for (const p of [A, B, C]) await ready(p, 'studio', 60000);
    const lst = [];
    for (const p of [A, B, C, H]) lst.push(await sUntil(p, `SRC.state === 'ok' && SRC.kind === 'relay' && atStation()`, 20000));
    const s0 = await Promise.all([A, B, C, H].map(p => sp(p, `[SRC.scenes.map(s => s.name).join(), STU.scene, APP.mode, STU.items.size, editOn()]`)));
    const mine = await H.evaluate(id => HOST.collab.mine() === id, sid);
    check('studio: the headset standing in it takes it as its station and three pages follow it: each lists the relay\'s two scenes, none picked by itself, in explore mode, editing off',
      inS && mine && lst.every(Boolean) && s0.every(s => s[0] === 'quiet,test' && s[1] === '' && s[2] === 'explore' && s[3] === 0 && !s[4]), JSON.stringify({ inS, mine, lst, s0 }));

    // ---- the scene picked on one page reaches every page and the headset
    await sUntil(A, `!!document.querySelector('#pane-scene [data-act="scene"][data-v="test"]')`, 10000);
    const picked = await click(A, '#pane-scene [data-act="scene"][data-v="test"]');
    const loaded = [];
    for (const p of [A, B, C, H]) loaded.push(await sUntil(p, `STU.scene === 'test' && STU.items.size === 4 && STUDIO.ready()`, 60000));
    check('studio: the scene picked on one page (its Scene pane) reaches every page and the headset, its four items and every model and sound in', picked && loaded.every(Boolean),
      JSON.stringify({ picked, loaded, at: await Promise.all([A, B, C, H].map(p => sp(p, `[STU.scene, STU.listing, STU.items.size, STUDIO.ready(), Object.values(STUDIO.state().models).map(m => m.state).join()]`))) }));
    // (a studio's station is no story this device lacks: nobody is asked to update or reload for it)
    const asked = await Promise.all([A, B, C, H].map(p => p.evaluate(() => { const b = document.getElementById('livebar'); return b && !b.hidden ? b.textContent : ''; })));
    check('studio: at a studio station no page and no headset is asked to update (the studio is a page the app knows, not a newer story)', asked.every(t => !t), JSON.stringify(asked));

    // ---- an object moved on one page (the arrows) and a cube added on another, at the same moment: both kept
    await sp(A, `(setEdit(true), setView('orbit'), select('box001'), 0)`);
    await sp(B, `(setEdit(true), 0)`);
    const tcOk = await sp(A, `!!(GL.tc && GL.tc.object === STU.items.get('box001').holder)`);
    const [, nc] = await Promise.all([
      sp(A, `(GL.tc && GL.tc.object ? (GL.tc.dispatchEvent({ type: 'dragging-changed', value: true }), STU.items.get('box001').holder.position.x += 0.5, GL.tc.dispatchEvent({ type: 'objectChange' }), GL.tc.dispatchEvent({ type: 'dragging-changed', value: false })) : 0, 0)`),
      sp(B, 'addCube()'),
    ]);
    const both = [];
    for (const p of [A, B, C, H]) both.push(await sUntil(p, `JSON.stringify(STU.items.get('box001').rec.p) === '[-0.5,0.25,-2]' && STU.items.has('${nc}') && STU.items.size === 5`, 10000));
    check('studio: an object moved by the arrows on one page and a cube added on another at the same moment are both kept, on every page and the headset', tcOk && !!nc && both.every(Boolean),
      JSON.stringify({ tcOk, nc, both, A: await sp(A, 'Object.keys(collabState()).join()'), boxA: await sp(A, `STU.items.get('box001').rec.p`), box: await sp(C, `STU.items.get('box001').rec.p`) }));

    // ---- triggers are each device's own: the headset's head put at a point of the scene, then its items worked out as
    // its frame does in a headset (the pretend session is not three.js's own: the renderer says it presents only then)
    const hShown = p3 => H.evaluate(p3 => {
      const X = window.__xr, xr = HOST.renderer.xr, P = s => HOST.cur.peek(s);
      const live = fn => { xr.isPresenting = true; try { return fn(); } finally { xr.isPresenting = false; } };
      X.step();
      live(() => P('(xrPlace(orbit.cur), GL.world.updateMatrixWorld(true))'));
      const w = P('GL.world').localToWorld(new THREE.Vector3(...p3)).applyMatrix4(X.W.local);
      X.head([w.x, w.y, w.z, 0]);
      X.step();
      return live(() => P(`(xrPlace(orbit.cur), GL.world.updateMatrixWorld(true), itemsStep(0.5, performance.now()), itemsStep(0.5, performance.now()), {
        head: headPoint(new THREE.Vector3()).toArray().map(v => +v.toFixed(3)), shown: Object.fromEntries([...STU.items.values()].filter(it => it.kind !== 'c').map(it => [it.id, it.shown])),
        inside: [...STU.items.values()].filter(it => it.kind === 'c' && it.inside).map(it => it.id) })`));
    }, p3);
    const hOut = await hShown([0, 1.6, 3]), hIn = await hShown([0, 1.6, 0]);
    await sp(B, `(setView('walk'), WALK.pos.set(0, 1.6, 3), WALK.yaw = 0, WALK.pitch = -0.08, WALK.to = null, 0)`);
    const bOut = await sUntil(B, `(() => { const h = headPoint(new THREE.Vector3()); return !!h && h.z > 2 && !STU.items.get('fig001').shown && STU.items.get('box001').shown && !STU.items.get('cube01').inside; })()`, 8000);
    const aSees = await sp(A, `['fig001', 'box001', 'snd001'].map(i => STU.items.get(i).shown).join()`);
    check('studio: the headset inside the Doorway cube sees the figure and its sound, not the box (outside it the reverse), while a page walking outside it and one in Orbit view see the box, not the figure',
      !!hOut.shown && hOut.shown.fig001 === false && hOut.shown.box001 === true && hIn.inside.includes('cube01') && hIn.shown.fig001 === true && hIn.shown.snd001 === true && hIn.shown.box001 === false &&
        bOut && aSees === 'false,true,false', JSON.stringify({ hOut, hIn, bOut, aSees }));
    if (dir) {
      await B.evaluate(() => HOST.collab.dialog(false));
      await sleep(600);
      await shot(B, 'studio-2-page-walking-outside.png');
      await headView(H, path.join(dir, 'studio-3-headset-inside-cube.png'), st.yaw, -0.12, [640, 400],
        '(HOST.renderer.xr.isPresenting = true, (() => { try { xrPlace(orbit.cur); GL.world.updateMatrixWorld(true); itemsStep(0.5, performance.now()); itemsStep(0.5, performance.now()); xrUpdate(XS); } finally { HOST.renderer.xr.isPresenting = false; } })())');
    }
    await sp(B, `(setView('orbit'), 0)`);

    // ---- Save from the headset's panel: layout.json written (the old one in .history/), every page saved; a second
    // (a button below the card's fold, as a model's Turn 90° under its timeline since v127: scrolled down to, as a person would)
    const hPanel = (tab, id) => sp(H, `(() => { X.tab = ${JSON.stringify(tab)}; X.scroll = {};
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } return XR.main.regions.find(q => q.id === ${JSON.stringify(id)}); };
      let r = draw();
      for (let k = 0; k < 12 && !(r && r.fn) && (X.scroll[X.tab] || 0) < (X.scrollMax[X.tab] || 0); k++) { X.scroll[X.tab] = (X.scroll[X.tab] || 0) + Math.round(X.scrollView * 0.5); r = draw(); }
      if (r && r.fn) { r.fn(); return true; } return false; })()`);
    const layoutOf = () => { try { return JSON.parse(fs.readFileSync(path.join(SC, 'test', 'layout.json'), 'utf8')); } catch (e) { return null; } };
    const hist = () => { try { return fs.readdirSync(path.join(SC, 'test', '.history')).length; } catch (e) { return 0; } };
    const boxOf = L => (L && (L.objects || []).find(o => o.id === 'box001')) || {};
    const e1 = await hPanel('scene', 'edit'), uH = await sp(H, 'editOn() && unsaved()');
    const s1 = await hPanel('scene', 'save');
    const saved1 = await sUntil(H, `!STU.saving && !unsaved() && !STU.saveNote && STU.savedAt > 0`, 10000);
    const L1 = layoutOf(), h1 = hist();
    const others = [];
    for (const p of [A, B]) others.push(await sUntil(p, `!unsaved() && / by Hana/.test(savedLine())`, 10000));
    await hPanel('items', 'sel:box001');
    const t2 = await hPanel('item', 'turn');
    await sUntil(H, 'unsaved()', 3000);
    const s2 = await hPanel('scene', 'save');
    const saved2 = await sUntil(H, `!STU.saving && !unsaved() && !STU.saveNote`, 10000);
    const L2 = layoutOf(), h2 = hist();
    check('studio: Save from the headset\'s panel writes layout.json on the relay (what is placed now: the box moved, the new cube; by its name), the old one kept in .history/, and every page is then saved ("by Hana"); a second save keeps a second in .history/',
      e1 && uH && s1 && saved1 && JSON.stringify(boxOf(L1).p) === '[-0.5,0.25,-2]' && !!L1 && L1.cubes.some(c => c.id === nc) && L1.by === 'Hana' && h1 === 1 && others.every(Boolean) &&
        t2 && s2 && saved2 && h2 === 2 && JSON.stringify(boxOf(L2).q) !== JSON.stringify(boxOf(L1).q),
      JSON.stringify({ e1, uH, s1, saved1, box1: boxOf(L1), cubes: L1 && L1.cubes.map(c => c.id), by: L1 && L1.by, h1, others, t2, s2, saved2, box2: boxOf(L2), h2, note: await sp(H, 'STU.saveNote') }));
    await hPanel('items', 'sel:box001');   // (selected no more)
    if (dir) { await sp(A, `(select(''), X.tab = 'scene', renderPanes(), 0)`); await sleep(800); await shot(A, 'studio-1-page-at-the-station.png'); }

    // ---- a file copied into the scene's folder: in the Add lists within a few seconds (the relay's watch)
    fs.mkdirSync(path.join(SC, 'test', 'models'), { recursive: true });
    const tc0 = Date.now();
    fs.copyFileSync(path.join(SC, 'test', 'box.glb'), path.join(SC, 'test', 'models', 'extra.glb'));
    const addSeen = [];
    for (const p of [A, B, H]) addSeen.push(await sUntil(p, `sceneLists().models.some(f => f.path === 'models/extra.glb')`, 12000));
    const dtAdd = (Date.now() - tc0) / 1000;
    const hAdd = await sp(H, `(() => { X.tab = 'add'; X.scroll = {}; for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } return XR.main.regions.some(r => r.id === 'add:models/extra.glb'); })()`);
    check(`studio: a file copied into the scene's folder appears in the Add lists of the pages and the headset (its panel's Add pane too) within a few seconds (${dtAdd.toFixed(1)} s)`,
      addSeen.every(Boolean) && hAdd && dtAdd < 10, JSON.stringify({ addSeen, hAdd, dtAdd }));

    // ---- the station's story locked (Lock this story): a page's edits and the headset's grip refused; unlocked, back
    const hGrip = () => sp(H, `(() => { const a = XR.ctrls[0], it = STU.items.get('box001'), w = it.holder.getWorldPosition(new THREE.Vector3());
      a.src = { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: null }; a.g.visible = true;
      a.g.matrix.compose(w.clone().add(new THREE.Vector3(0, 0.2, 0.3)), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); a.o.setFromMatrixPosition(a.g.matrix);
      a.hover = { kind: 'item', id: 'box001' }; xrGrab(a, true); const took = !!(a.grab && a.grab.id === 'box001'); xrGrab(a, false);
      a.hover = null; a.src = null; a.g.visible = false; return took; })()`);
    await A.evaluate(id => HOST.collab.setStationLock(id, true), sid);
    const lockSeen = [];
    for (const p of [B, H]) lockSeen.push(await sUntil(p, 'editLocked() && !editOn()', 5000));
    const r0 = await sp(B, `JSON.stringify(STU.items.get('box001').rec)`);
    const lk = await sp(B, `(() => { itemAct('turn', null, 'box001'); const c = addCube(); X.tab = 'scene'; renderPanes(); const e = document.querySelector('#pane-scene [data-act="edit"]');
      return { c, same: JSON.stringify(STU.items.get('box001').rec) === ${JSON.stringify(r0)}, n: STU.items.size, dis: !!(e && e.disabled), note: /locked/i.test(document.querySelector('#pane-scene').textContent) }; })()`);
    const hLocked = await hGrip();
    await A.evaluate(id => HOST.collab.setStationLock(id, false), sid);
    const unl = [];
    for (const p of [B, H]) unl.push(await sUntil(p, '!editLocked() && editOn()', 5000));
    const hFree = await hGrip();
    check('studio: with the station\'s story locked a page\'s edits are refused (turn, Add; Edit greyed, the pane says it is locked) and so is the headset\'s grip; unlocked, both work again',
      lockSeen.every(Boolean) && lk.c === '' && lk.same && lk.n === 5 && lk.dis && lk.note && !hLocked && unl.every(Boolean) && hFree, JSON.stringify({ lockSeen, lk, hLocked, unl, hFree }));

    // ---- Convert to GLB on a page: models/figure.glb through the relay, every figure switched where it stands
    const corners = `(() => { const b = objBox(STU.items.get('fig001')); return b ? [...b.min.toArray(), ...b.max.toArray()] : null; })()`;
    const cb0 = await sp(B, corners);
    await sp(A, `(setEdit(true), select('fig001'), X.tab = 'item', renderPanes(), 0)`);
    const btn = await sUntil(A, `!!document.querySelector('#pane-item [data-act="convert"][data-v="figure.fbx"]:not([disabled])')`, 5000);
    const tcv = Date.now();
    await click(A, '#pane-item [data-act="convert"][data-v="figure.fbx"]');
    const cvDone = await sUntil(A, `!CV.busy && CV.done.includes('models/figure.glb')`, 90000);
    const cvT = (Date.now() - tcv) / 1000, onDisk = fs.existsSync(path.join(SC, 'test', 'models', 'figure.glb'));
    const sw = [];
    for (const p of [A, B, C, H]) sw.push(await sUntil(p, `(() => { const it = STU.items.get('fig001'), E = LIB.get('models/figure.glb'); return it.rec.file === 'models/figure.glb' && !!E && E.state === 'ready' && !!it.model && it.built === E.gen; })()`, 30000));
    const cb1 = await sp(B, corners);
    const worst = cb0 && cb1 ? Math.max(...cb0.map((v, i) => Math.abs(v - cb1[i]))) : Infinity;
    const lists = await sUntil(B, `(() => { const L = sceneLists(); return L.orig.some(f => f.path === 'figure.fbx') && L.models.some(f => f.path === 'models/figure.glb') && !L.models.some(f => f.path === 'figure.fbx'); })()`, 10000);
    const rec = await sp(B, `[glbRec('models/figure.glb') || null, STU.items.get('fig001').rec]`);
    check(`studio: Convert to GLB on a page writes models/figure.glb through the relay (${cvT.toFixed(1)} s), every page's and the headset's figure switches to it where it stands (corners within 1 mm), and the Add list shows the FBX under Originals`,
      btn && cvDone && onDisk && sw.every(Boolean) && worst < 0.001 && lists && !!rec[0] && rec[0].from === 'figure.fbx',
      JSON.stringify({ btn, cvDone, onDisk, sw, worst, lists, rec, note: await sp(A, 'CV.note') }));

    // ---- its picture for the Add pane (v120, tools/studio/SPEC.md "Pictures in the Add pane"): made with the GLB, uploaded
    // through the relay as previews/models/figure.glb.jpg, listed as kind preview, and shown on another page's card
    const pvFile = path.join(SC, 'test', 'previews', 'models', 'figure.glb.jpg');
    let pvOn = false;
    for (const end = Date.now() + 15000; !pvOn && Date.now() < end; await sleep(100)) pvOn = fs.existsSync(pvFile);
    const pvBytes = pvOn ? fs.readFileSync(pvFile) : Buffer.alloc(0), pvJpeg = pvBytes.length > 1000 && pvBytes.length <= 200 << 10 && pvBytes[0] === 0xff && pvBytes[1] === 0xd8;
    const pvListed = await (await fetch(`http://127.0.0.1:${R.port}/api/scenes/test`)).json().then(j => (j.files || []).find(f => f.path === 'previews/models/figure.glb.jpg'), () => null);
    const bEdit = await sp(B, 'STU.edit');
    await sp(B, `(setEdit(true), X.tab = 'add', renderPanes(), 0)`);
    const pvB = await sUntil(B, `(renderPanes(), PV.files.has('previews/models/figure.glb.jpg') && !STU.files.some(f => f.path.startsWith('previews/')) && !!document.querySelector('#pane-add .stu-card[data-v="models/figure.glb"] .pic img'))`, 20000);
    const pvH = await sUntil(H, `(() => { X.tab = 'add'; X.scroll = {}; const P = XR.main; P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); return P.regions.some(r => r.id === 'add:models/figure.glb') && (PV.img.get('previews/models/figure.glb.jpg') || {}).state === 'ready'; })()`, 20000);
    await sp(B, `(setEdit(${bEdit}), X.tab = 'scene', renderPanes(), 0)`);
    await sp(H, `(X.tab = 'scene', 0)`);
    check('studio: Convert to GLB also makes its picture: previews/models/figure.glb.jpg through the relay (a JPEG under 200 KB), listed with kind preview, and another page\'s Add pane card and the headset\'s canvas show it (never among the scene\'s files)',
      pvOn && pvJpeg && !!pvListed && pvListed.kind === 'preview' && pvB && pvH, JSON.stringify({ pvOn, bytes: pvBytes.length, pvListed, pvB, pvH, B: await sp(B, 'pvState()') }));

    // ---- a texture added from a page's card: a model that lacks its picture (the textures scene's rust.obj names
    // rust_old.png) copied into the scene and placed; its card's Use paint.png converts it at once, through the relay
    for (const f of ['rust.obj', 'rust.mtl', 'paint.png']) fs.copyFileSync(path.join(TEST, 'textures', f), path.join(SC, 'test', f));
    const rSeen = await sUntil(A, `STU.fileMap.has('rust.obj') && STU.fileMap.has('paint.png')`, 12000);
    const rustId = rSeen ? await sp(A, `addModel('rust.obj')`) : '';
    const rLoaded = [];
    for (const p of [A, B, C, H]) rLoaded.push(!!rustId && await sUntil(p, `(() => { const it = STU.items.get('${rustId}'); return !!(it && it.E && it.E.state === 'ready' && it.E.missing.has('rust_old.png') && it.model); })()`, 30000));
    const rBox = `(() => { const b = objBox(STU.items.get('${rustId}')); return b ? [...b.min.toArray(), ...b.max.toArray()] : null; })()`;
    const rc0 = await sp(B, rBox);
    await sp(A, `(setEdit(true), select('${rustId}'), X.tab = 'item', renderPanes(), 0)`);
    const useBtn = await sUntil(A, `!!document.querySelector('#pane-item [data-act="tex:use"][data-v*="paint.png"]:not([disabled])')`, 8000);
    if (useBtn) await click(A, '#pane-item [data-act="tex:use"][data-v*="paint.png"]');
    const tDone = useBtn && await sUntil(A, `!CV.busy && CV.done.includes('models/rust.glb')`, 90000);
    const tRec = (() => { try { const b = fs.readFileSync(path.join(SC, 'test', 'models', 'rust.glb')); return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))).asset.extras.studio; } catch (e) { return null; } })();
    const tsw = [];
    for (const p of [A, B, C, H]) tsw.push(await sUntil(p, `(() => { const it = STU.items.get('${rustId}'), E = LIB.get('models/rust.glb'); let n = 0; if (it && it.model) for (const o of it.model.meshes || []) if ([].concat(o.material).some(m => m.map)) n++; return !!it && it.rec.file === 'models/rust.glb' && !!E && E.state === 'ready' && it.built === E.gen && n > 0; })()`, 30000));
    const rc1 = await sp(B, rBox), tWorst = rc0 && rc1 ? Math.max(...rc0.map((v, i) => Math.abs(v - rc1[i]))) : Infinity;
    check('studio: a texture added from a page\'s card (Use paint.png for the rust_old.png the model lacks) converts it at once: models/rust.glb through the relay, the picture in its record, and every page\'s and the headset\'s object switches to it, textured, where it stands',
      rSeen && !!rustId && rLoaded.every(Boolean) && useBtn && tDone && !!tRec && JSON.stringify(tRec.tex) === '[{"name":"rust_old.png","mat":"","slot":"","from":"paint.png","how":"chosen"}]' && tsw.every(Boolean) && tWorst < 0.001,
      JSON.stringify({ rSeen, rustId, rLoaded, useBtn, tDone, tRec, tsw, tWorst, note: await sp(A, 'CV.note') }));
    await sp(A, `(select(''), X.tab = 'scene', renderPanes(), 0)`);

    // ---- Fewer triangles and Change texture (e7d_lite.js): a dense ball made on a page (24,320 triangles, a red and green
    // checker) put in the scene's folder and placed; its share saved on a page at 20 %: models/ball.glb through the relay,
    // every page's and the headset's ball switched to it, as light as the page previewed it; then a picture put in its colour
    // slot from the headset's card and saved from the headset: made again from ball.glb with the share kept
    const ballB64 = await sp(A, `(async () => {
      exporterLoad();
      const T = THREE, g = new T.SphereGeometry(0.5, 128, 96), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.04 * Math.sin(20 * x) * Math.sin(20 * y) * Math.sin(20 * z); p.setXYZ(i, x * k, y * k, z * k); }
      g.computeVertexNormals();
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#e02020' : '#20c020'; x.fillRect(i * 8, j * 8, 8, 8); }
      const root = new T.Group(); root.add(new T.Mesh(g, new T.MeshStandardMaterial({ name: 'skin', map: new T.CanvasTexture(cv), roughness: 1, metalness: 0 })));
      const glb = await new Promise(res => new T.GLTFExporter().parse(root, res, { binary: true }));
      const u = new Uint8Array(glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s);
    })()`);
    fs.writeFileSync(path.join(SC, 'test', 'ball.glb'), Buffer.from(ballB64, 'base64'));
    const bSeen = await sUntil(A, `STU.fileMap.has('ball.glb')`, 12000);
    const ballId = bSeen ? await sp(A, `(setEdit(true), addModel('ball.glb'))`) : '';
    const bIn = [];
    for (const p of [A, B, C, H]) bIn.push(!!ballId && await sUntil(p, `(() => { const it = STU.items.get('${ballId}'); return !!(it && it.model && it.E.state === 'ready'); })()`, 30000));
    await sp(A, `(select('${ballId}'), X.tab = 'item', renderPanes(), ftOpen('${ballId}'), 0)`);
    const fPv = await sUntil(A, `!!FT.pv && !FT.busy && FT.pv.keep === 0.2`, 30000), fWant = await sp(A, 'FT.pv ? FT.pv.to : 0'), fOthers = await sp(B, `STUDIO.tris('${ballId}')`);
    if (fPv) await click(A, '#pane-item [data-act="ft:save"]');
    const fDone = fPv && await sUntil(A, `!CV.busy && CV.done.includes('models/ball.glb')`, 90000);
    const glbRecOf = f => { try { const b = fs.readFileSync(path.join(SC, 'test', f)); return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))).asset.extras.studio; } catch (e) { return null; } };
    const fRec = glbRecOf('models/ball.glb'), fsw = [];
    for (const p of [A, B, C, H]) fsw.push(await sUntil(p, `(() => { const it = STU.items.get('${ballId}'), E = LIB.get('models/ball.glb'); return !!it && it.rec.file === 'models/ball.glb' && !!E && E.state === 'ready' && it.built === E.gen && STUDIO.tris('${ballId}') === ${fWant}; })()`, 30000));
    check('studio: Fewer triangles saved on a page (20 %, previewed there only): models/ball.glb through the relay with tris in its record, and every page\'s and the headset\'s ball switches to it, as light as previewed',
      bSeen && !!ballId && bIn.every(Boolean) && fPv && fOthers === 24320 && fDone && !!fRec && !!fRec.tris && fRec.tris.from === 24320 && fRec.tris.to === fWant && fRec.tris.keep === 0.2 && fsw.every(Boolean),
      JSON.stringify({ bSeen, ballId, bIn, fPv, fWant, fOthers, fDone, fRec, fsw, note: await sp(A, 'CV.note') }));
    const cXR = await sp(H, 'XR.on'), cd0 = await sp(H, 'CV.done.length');
    await sp(H, `(setEdit(true), select('${ballId}'), X.tab = 'item', act('ct:open', '${ballId}'), act('ct:pic', 'paint.png'), 0)`);
    const cShown = await sUntil(H, `!!(CT.saved && CT.saved.length) && !CT.busy`, 20000);
    if (cShown) await sp(H, `(act('ct:save'), 0)`);
    const cDone = cShown && await sUntil(H, `!CV.busy && !CT.saving && CV.done.length > ${cd0}`, 90000);
    const cRec = glbRecOf('models/ball.glb'), csw = [];
    for (const p of [A, B, C, H]) csw.push(await sUntil(p, `(() => { const it = STU.items.get('${ballId}'), E = LIB.get('models/ball.glb'); return !!it && !!E && E.state === 'ready' && it.built === E.gen && !!E.record && (E.record.tex || []).some(x => x.from === 'paint.png' && x.slot === 'map') && STUDIO.tris('${ballId}') === ${fWant}; })()`, 30000));
    check('studio: Change texture from the headset\'s card (paint.png in the colour slot, shown there, saved from the headset through the relay): models/ball.glb made again from ball.glb with the picture in its record and its share kept, on every page and the headset',
      cXR && cShown && cDone && !!cRec && !!cRec.tex && cRec.tex.some(x => x.from === 'paint.png' && x.slot === 'map' && x.mat === 'skin') && !!cRec.tris && cRec.tris.keep === 0.2 && cRec.from === 'ball.glb' && csw.every(Boolean),
      JSON.stringify({ cXR, cShown, cDone, cRec, csw, note: await sp(H, 'CV.note') }));
    await sp(A, `(select(''), X.tab = 'scene', renderPanes(), 0)`);
    await sp(H, `(select(''), 0)`);

    // ---- a sound that follows a model: the rig scene's dancer copied into the scene and placed on a page, a sound there
    // made to follow her head; every page and the headset take it (each poses its own dancer: at one scene clock, their
    // sound where their own head bone and its offset put it, within 1 cm of the first page's), and the layout saved from a
    // page carries what it follows (on, bone, o)
    fs.copyFileSync(path.join(TEST, 'rig', 'dancer.glb'), path.join(SC, 'test', 'dancer.glb'));
    const dSeen = await sUntil(A, `STU.fileMap.has('dancer.glb')`, 12000);
    const danId = dSeen ? await sp(A, `(setEdit(true), addModel('dancer.glb'))`) : '';
    const dIn = [];
    for (const p of [A, B, C, H]) dIn.push(!!danId && await sUntil(p, `(() => { const it = STU.items.get('${danId}'); return !!(it && it.model && it.E && it.built === it.E.gen); })()`, 30000));
    const vId = danId && dIn[0] ? await sp(A, `(() => { const sid = addSound('tone.wav'), d = STU.items.get('${danId}'); setRec(sid, { p: [d.rec.p[0], 1.8, d.rec.p[2] + 0.15] }); itemsStep(0, performance.now());
      itemAct('follow', '${danId}', sid); itemAct('bone', 'mixamorigHead', sid); return sid; })()`) : '';
    const vTook = [];
    for (const p of [B, C, H]) vTook.push(!!vId && await sUntil(p, `(() => { const it = STU.items.get('${vId}'); return !!(it && it.rec.on === '${danId}' && it.rec.bone === 'mixamorigHead'); })()`, 10000));
    // (the scene's clock held at 0.7 s on each, once the room's glides are done there, her own first placement too, which
    // can reach the others with the sound: where its own dancer's head puts the sound)
    const vAt = p => sp(p, `(() => { const sc = sceneClock, it = STU.items.get('${vId}'); if (!it) return null; sceneClock = () => 0.7; try { itemsStep(0, performance.now()); const f = STUDIO.follow('${vId}'); return f ? [f.node, it.holder.position.toArray(), f.d, JSON.stringify(it.rec)] : null; } finally { sceneClock = sc; } })()`);
    const vs = [];
    for (const p of [A, B, C, H]) { if (vId) await sUntil(p, `[...STU.items.values()].every(it => !it.gl)`, 5000); vs.push(vId ? await vAt(p) : null); }
    const vFar = vs.every(Boolean) ? Math.max(...vs.map(v => Math.hypot(...v[1].map((x, i) => x - vs[0][1][i])))) : Infinity;
    await sp(A, 'saveLayout()');
    const vSaved = await sUntil(A, `!STU.saving && !unsaved() && !STU.saveNote`, 10000);
    const vL = (layoutOf() || { sounds: [] }).sounds.find(x => x.id === vId);
    check(`studio: a sound made on a page to follow the dancer's head (her model copied into the scene) is taken by every page and the headset, each with its sound where its own dancer's head bone and its offset put it at one scene clock (within ${(vFar * 100).toFixed(2)} cm of the first page's), and the saved layout.json carries on, bone and o`,
      dSeen && !!danId && dIn.every(Boolean) && !!vId && vTook.every(Boolean) && vs.every(v => v && v[0] === 'mixamorigHead' && v[2] < 1e-6 && v[3] === vs[0][3]) && vFar < 0.01 &&
        vSaved && !!vL && vL.on === danId && vL.bone === 'mixamorigHead' && Array.isArray(vL.o) && vL.o.length === 3,
      JSON.stringify({ dSeen, danId, dIn, vId, vTook, vs, vFar, vSaved, vL }));
    if (vId) await sp(A, `(deleteItem('${vId}'), deleteItem('${danId}'), select(''), 0)`);

    // ---- a cut-out: made on a page on the test scene's box; every page and the headset take it (its box's corners in
    // the scene's frame within 1 cm of the first page's on each, cutting there), and the layout saved from a page carries
    // it under cuts
    const xId = await sp(A, `(setEdit(true), addCut('box001'))`);
    const xTook = [];
    for (const p of [B, C, H]) xTook.push(!!xId && await sUntil(p, `(() => { const c = STUDIO.cut('${xId}'); return !!(c && c.on === 'box001' && c.cutting && c.list.includes('${xId}')); })()`, 15000));
    const xs = [];
    for (const p of [A, B, C, H]) { if (xId) await sUntil(p, `[...STU.items.values()].every(it => !it.gl)`, 5000); xs.push(xId ? await sp(p, `(itemsStep(0, performance.now()), [STUDIO.cut('${xId}').corners, JSON.stringify(STU.items.get('${xId}').rec)])`) : null); }
    const xFar = xs.every(Boolean) ? Math.max(...xs.map(x => Math.max(...x[0].map((q, i) => Math.hypot(...q.map((v, k) => v - xs[0][0][i][k])))))) : Infinity;
    await sp(A, 'saveLayout()');
    const xSaved = await sUntil(A, `!STU.saving && !unsaved() && !STU.saveNote`, 10000);
    const xL = ((layoutOf() || {}).cuts || []).find(x => x.id === xId);
    check(`studio: a cut-out made on a page on the box is taken by every page and the headset, cutting there, its corners within ${(xFar * 100).toFixed(2)} cm of the first page's, and the saved layout.json carries it under cuts`,
      !!xId && xTook.every(Boolean) && xs.every(x => x && x[1] === xs[0][1]) && xFar < 0.01 && xSaved && !!xL && xL.on === 'box001' && Array.isArray(xL.size) && xL.size.length === 3,
      JSON.stringify({ xId, xTook, recs: xs.map(x => x && x[1]), xFar, xSaved, xL }));
    if (xId) await sp(A, `(deleteItem('${xId}'), select(''), 0)`);

    // ---- a group: made on a page (the box, the figure, Tone and Doorway), then turned a quarter and sized ×1.5 on its card
    // there; every page and the headset take it (each member where the first page has it, within 1 cm, once the room's
    // glides are done); Faces set on another page (the box inside out) reaches every device (its own materials' side); the
    // layout saved from a page carries groups and faces
    {
    const gId = await sp(A, `(() => { setEdit(true); select('box001'); itemAct('mkgroup'); const g = STU.gpick && STU.gpick.id; if (!g) return ''; for (const id of ['fig001', 'snd001', 'cube01']) groupToggle(g, id); gpickEnd(); select(g); itemAct('turn'); itemAct('size', 1.5); select(''); return g; })()`);
    const gAt = p => sp(p, `(() => { itemsStep(0, performance.now()); const g = STU.items.get('${gId}'); return g ? [JSON.stringify(g.rec), members(g).map(m => [m.id, m.holder.position.toArray(), JSON.stringify(m.rec)])] : null; })()`);
    const gs = [];
    for (const p of [A, B, C, H]) { if (gId) await sUntil(p, `(() => { const g = STU.items.get('${gId}'); return !!g && members(g).length === 4 && [...STU.items.values()].every(it => !it.gl); })()`, 15000); gs.push(gId ? await gAt(p) : null); }
    const gFar = gs.every(Boolean) ? Math.max(...gs.map(g => Math.max(...g[1].map(([, q], i) => Math.hypot(...q.map((v, k) => v - gs[0][1][i][1][k])))))) : Infinity;
    await sp(B, `(setEdit(true), itemAct('faces', 'inside', 'box001'), 0)`);
    const fIn = [];
    for (const p of [A, B, C, H]) fIn.push(await sUntil(p, `(() => { const it = STU.items.get('box001'); return !!it && it.rec.faces === 'inside' && !!it.model && it.model.meshes.every(m => [].concat(m.material).every(x => x.side === THREE.BackSide)); })()`, 10000));
    await sp(A, 'saveLayout()');
    const gSaved = await sUntil(A, `!STU.saving && !unsaved() && !STU.saveNote`, 10000);
    const gL = layoutOf() || {}, gLg = (gL.groups || []).find(x => x.id === gId), gLb = (gL.objects || []).find(x => x.id === 'box001');
    check(`studio: a group made on a page (the box, the figure, Tone and Doorway), turned and sized there, is taken by every page and the headset, every member within ${(gFar * 100).toFixed(2)} cm of the first page's; Faces (the box inside out) set on another page reaches every device's materials; the saved layout.json carries groups and faces`,
      !!gId && gs.every(g => g && g[0] === gs[0][0] && g[1].length === 4 && g[1].every((m, i) => m[2] === gs[0][1][i][2])) && gFar < 0.01 && fIn.every(Boolean) && gSaved &&
        !!gLg && JSON.stringify(gLg.items) === JSON.stringify(['box001', 'fig001', 'snd001', 'cube01']) && !!gLb && gLb.faces === 'inside',
      JSON.stringify({ gId, recs: gs.map(g => g && g[0]), gFar, fIn, gSaved, gLg, faces: gLb && gLb.faces }));
    if (gId) await sp(A, `(itemAct('faces', 'file', 'box001'), select('${gId}'), itemAct('ungroup'), select(''), 0)`);
    }   // (a block of its own: the R2 part below names its own gs and gSaved)

    // ---- a tint and a brightness (v125): set on one page (the box red, 125 %), on every device's record and the box's own
    // materials (each one's colour as loaded times the tint times 1.25); the saved layout.json carries them
    {
    // (first A's last writes, the box's faces back and the group gone, on every device: the station's state is one value,
    // so a tint written on C before A's writes have reached it is lost to them, both having changed the box's record)
    for (const p of [A, B, C, H]) await sUntil(p, `(() => { const b = STU.items.get('box001'); return !!b && !b.rec.faces && !groupOf('box001'); })()`, 15000);
    await sp(C, `(setEdit(true), itemAct('tint', '#ff5a4b', 'box001'), itemAct('bright', 1.25, 'box001'), 0)`);
    const tIn = [];
    for (const p of [A, B, C, H]) tIn.push(await sUntil(p, `(() => { const it = STU.items.get('box001'); if (!it || it.rec.tint !== '#ff5a4b' || it.rec.bright !== 1.25 || !it.model) return false; const T = new THREE.Color('#ff5a4b');
      return it.model.meshes.every(m => [].concat(m.userData.lit || []).every(x => !x.color || x.color.equals(new THREE.Color().fromArray(x.userData.col0).multiply(T).multiplyScalar(1.25)))); })()`, 10000));
    await sp(A, 'saveLayout()');
    const tSaved = await sUntil(A, `!STU.saving && !unsaved() && !STU.saveNote`, 10000);
    const tLb = ((layoutOf() || {}).objects || []).find(x => x.id === 'box001');
    check('studio: a tint and a brightness set on a page (the box red, 125 %) reach every page\'s and the headset\'s record and the box\'s own materials; the saved layout.json carries them',
      tIn.every(Boolean) && tSaved && !!tLb && tLb.tint === '#ff5a4b' && tLb.bright === 1.25, JSON.stringify({ tIn, tSaved, tint: tLb && tLb.tint, bright: tLb && tLb.bright }));
    await sp(C, `(itemAct('tint', '', 'box001'), itemAct('bright', 'reset', 'box001'), 0)`);
    }

    // ---- a model's timeline held for the circle (v127): the box selected on a page while editing, its Spin held at 1.0 s
    // there, every other page and the headset draw that frame (a quiet effect, nothing stored); deselected, they all go
    // back to the scene's clock. And Follow's side (v127) and Faces (v128, pressed on the card: Them) in a record: set on
    // a page, on every device's
    {
    const onClock = `(() => { const it = STU.items.get('box001'), c = sceneClock(performance.now()), w = ((c % it.dur) + it.dur) % it.dur; return !ANIM.heard.has('box001') && Math.min(Math.abs(it.action.time - w), it.dur - Math.abs(it.action.time - w)) < 0.25; })()`;
    await sp(C, `(setEdit(true), select('box001'), animSet(STU.items.get('box001'), 1, false), 0)`);
    const aMine = await sp(C, `[!!ANIM.mine, atStation()]`);
    const aIn = [];
    for (const p of [A, B, H]) aIn.push(await sUntil(p, `ANIM.heard.has('box001') && Math.abs(STU.items.get('box001').action.time - 1) < 0.02`, 8000));
    await sp(C, `(select(''), 0)`);
    const aOut = [];
    for (const p of [A, B, H]) aOut.push(await sUntil(p, onClock, 8000));
    check('studio: a model\'s timeline held on a page (the box\'s Spin at 1.0 s) is the frame every other page and the headset draw; deselected there, every device goes back to the scene\'s clock',
      aMine.join() === 'true,true' && aIn.every(Boolean) && aOut.every(Boolean), JSON.stringify({ aMine, aIn, aOut }));
    await sp(C, `(setRec('box001', { behaviour: { kind: 'follow', side: 'left' } }), 0)`);
    const sIn = [];
    for (const p of [A, B, H]) sIn.push(await sUntil(p, `(STU.items.get('box001').rec.behaviour || {}).side === 'left'`, 8000));
    const fSet = await sp(C, `(setEdit(true), itemAct('bface', 'them', 'box001'), (STU.items.get('box001').rec.behaviour || {}).face || '')`);
    for (const p of [A, B, H]) sIn.push(await sUntil(p, `(() => { const b = STU.items.get('box001').rec.behaviour || {}; return b.side === 'left' && b.face === 'them'; })()`, 8000));
    await sp(C, `(setRec('box001', { behaviour: undefined }), 0)`);
    const sOut = [];
    for (const p of [A, B, H]) sOut.push(await sUntil(p, `!STU.items.get('box001').rec.behaviour`, 8000));
    check('studio: Follow at their left set on a page, and Faces: Them pressed there (v128), are in every page\'s and the headset\'s record, and go with it', fSet === 'them' && sIn.every(Boolean) && sOut.every(Boolean), JSON.stringify({ fSet, sIn, sOut }));
    }

    // ---- a recorded path's timeline held for the circle (v128): the box given a path on a page (2 s, a loop); C holds it
    // at 0.7 s, paused (a quiet effect, nothing stored); at one room time held on each, A, B and the headset draw the box
    // where C does (within 1 mm), where the path has it at 0.7 s; C lets go (The scene's clock), and every device lets go
    {
    const K = [[0, 0, 0, 0, 0, 0, 0, 1], [1, 0.6, 0, 0, 0, 0, 0, 1], [2, 0.6, 0.6, 0, 0, 0.7071, 0, 0.7071]];
    await sp(B, `(setEdit(true), setRec('box001', { path: { k: ${JSON.stringify(K)} } }), select(''), 0)`);
    const hTook = [];
    for (const p of [A, B, C, H]) hTook.push(await sUntil(p, `(() => { const b = STU.items.get('box001'); return !!(b && b.rec.path && b.rec.path.k.length === 3) && !b.gl; })()`, 15000));
    await sp(C, `(setEdit(true), select('box001'), animSet(STU.items.get('box001'), 0.7, false, false, 'path'), 0)`);
    const hMine = await sp(C, `[!!ANIM.mineP && !ANIM.mineP.p && +ANIM.mineP.t.toFixed(3), atStation()]`);
    const hIn = [];
    for (const p of [A, B, H]) hIn.push(await sUntil(p, `!!ANIM.heard.get('box001:p') && Math.abs(ANIM.heard.get('box001:p').t - 0.7) < 0.002`, 8000));
    const hT = Date.now() + 777, hAt = [];
    for (const p of [C, A, B, H]) {
      hAt.push(await sp(p, `(() => { const n = HOST.collab.now; HOST.collab.now = () => ${hT}; try {
        ${p === C ? '' : "select('');"} itemsStep(0, performance.now()); const pb = STUDIO.pose('box001'), r = STU.items.get('box001').rec, d = new THREE.Vector3(), q = new THREE.Quaternion();
        pathAt(r.path, pathTime(r.path, 0.7), d, q); const w = new THREE.Vector3(...r.p).add(d.applyQuaternion(new THREE.Quaternion(...r.q).normalize()));
        return [pb, pb.drawn ? Math.hypot(pb.drawn[12] - w.x, pb.drawn[13] - w.y, pb.drawn[14] - w.z) : null];
      } finally { HOST.collab.now = n; } })()`));
    }
    const dOf = (a, b) => { const pd = Math.hypot(a.drawn[12] - b.drawn[12], a.drawn[13] - b.drawn[13], a.drawn[14] - b.drawn[14]); let rd = 0; for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) rd = Math.max(rd, Math.abs(a.drawn[i] - b.drawn[i])); return [pd, rd]; };
    const hFar = hAt.every(r => r && r[0] && r[0].drawn) ? hAt.map(r => dOf(r[0], hAt[0][0])).reduce((a, b) => a.map((v, i) => Math.max(v, b[i]))) : [Infinity, Infinity];
    await sp(C, `(ANIM_ACT['ap:free'](), 0)`);
    const hOut = [];
    for (const p of [A, B, H]) hOut.push(await sUntil(p, `!ANIM.heard.has('box001:p')`, 8000));
    const hFree = await sp(C, 'ANIM.mineP');
    check(`studio: a recorded path's timeline held on a page (the box's path at 0.7 s, paused) is where every other page and the headset draw it at one held room time (within ${(hFar[0] * 1000).toFixed(3)} mm of the first page's, where the path has it then); let go there (The scene's clock), every device lets go`,
      hTook.every(Boolean) && hMine.join() === '0.7,true' && hIn.every(Boolean) && hFar[0] < 0.001 && hFar[1] < 0.001 && hAt.every(r => r && r[1] !== null && r[1] < 0.001) && hOut.every(Boolean) && hFree === null,
      JSON.stringify({ hTook, hMine, hIn, hFar, hAt: hAt.map(r => r && [r[0] && r[0].moving, r[1]]), hOut, hFree }));
    await sp(B, `(setRec('box001', { path: undefined }), 0)`);
    for (const p of [A, B, C, H]) await sUntil(p, `!STU.items.get('box001').rec.path`, 15000);
    await sp(C, `(select(''), 0)`);
    }

    // ---- a shape, an empty, a lock and a scene setting (v119): a box that hides things and an empty with Tone following it
    // made on a page; the box locked and the scene's other circles hidden on another page; every page and the headset take
    // them (the same records, the sound where the empty puts it, the settings), a third page's card refusing to move the
    // locked box, the headset at this studio's circle telling its shell to hide the other circles (the hook recorded there);
    // the saved layout.json carries shapes, empties and settings
    {
    await H.evaluate(() => { window.__hk = []; if (HOST.collab) HOST.collab.hideOthers = v => window.__hk.push(['hide', v]); });
    const pr = await sp(A, `(() => { setEdit(true); const p = addShape('cube'); setRec(p, { p: [1.5, 0.4, -1], size: [0.8, 0.8, 0.8], look: 'hide' }); const e = addEmpty(); setRec(e, { p: [-1.5, 1.6, -1] }); const s = addSound('tone.wav'); itemAct('follow', e, s); select(''); return p && e && s ? [p, e, s] : null; })()`);
    const [pId, eId, sId] = pr || ['', '', ''];
    const pAtB = !!pr && await sUntil(B, `STU.items.has('${pId}') && STU.items.has('${eId}') && STU.items.has('${sId}')`, 15000);   // (B has them before it locks one)
    if (pAtB) await sp(B, `(setEdit(true), select('${pId}'), itemAct('lock'), setSetting('others:hidden'), select(''), 0)`);
    const pTook = [], pRecs = [];
    for (const p of [A, B, C, H]) pTook.push(!!pr && await sUntil(p, `(() => { const s = STU.items.get('${pId}'), e = STU.items.get('${eId}'), f = STUDIO.follow('${sId}'); return !!s && s.rec.locked === true && s.rec.look === 'hide' && !!e && !!f && f.d < 0.01 && STU.settings.others === 'hidden'; })()`, 15000));
    const rOf = id => `(STU.items.get('${id}') || {}).rec || null`;
    for (const p of [A, B, C, H]) pRecs.push(pr ? await sp(p, `JSON.stringify([${rOf(pId)}, ${rOf(eId)}, ${rOf(sId)}, STU.settings])`) : null);
    const pLock = pTook.every(Boolean) ? await sp(C, `(setEdit(true), select('${pId}'), itemAct('turn'), itemAct('psize', 2), deleteItem('${pId}'), select(''), [STU.items.has('${pId}'), JSON.stringify((STU.items.get('${pId}') || { rec: {} }).rec.q), String((STU.items.get('${pId}') || { rec: { size: [] } }).rec.size)])`) : null;
    const hHide = await H.waitForFunction(() => (window.__hk || []).some(x => x[0] === 'hide' && x[1] === true), null, { timeout: 10000 }).then(() => true, () => false);
    await sp(A, 'saveLayout()');
    const pSaved = await sUntil(A, `!STU.saving && !unsaved() && !STU.saveNote`, 10000);
    const pL = layoutOf() || {}, pLs = (pL.shapes || []).find(x => x.id === pId), pLe = (pL.empties || []).find(x => x.id === eId);
    check('studio: a shape that hides things and an empty with a sound following it, made on a page, the shape locked and the other circles hidden on another, reach every page and the headset (the same records, the sound at the empty), the lock refuses a third page\'s card, the headset at the circle tells its shell to hide the other circles, and the saved layout.json carries shapes, empties and settings',
      !!pr && pTook.every(Boolean) && pRecs.every(r => r === pRecs[0]) && JSON.stringify(pLock) === JSON.stringify([true, '[0,0,0,1]', '0.8,0.8,0.8']) && hHide && pSaved &&
        !!pLs && pLs.locked === true && pLs.look === 'hide' && !!pLe && !!pL.settings && pL.settings.others === 'hidden',
      JSON.stringify({ pr, pAtB, pTook, recs: pRecs.map(r => r && r.slice(0, 160)), pLock, hHide, pSaved, pLs, pLe, settings: pL.settings, hk: await H.evaluate(() => window.__hk) }));
    if (pr) await sp(B, `(setEdit(true), select('${pId}'), itemAct('lock'), deleteItem('${pId}'), deleteItem('${sId}'), deleteItem('${eId}'), setSetting('others:shown'), select(''), 0)`);
    }

    // ---- motions (v120): a wobble set on the box on one page and an orbit on the figure on another, both 'always': every
    // page and the headset take them (the same records) and, at one room time held on each (HOST.collab.now stubbed: the
    // station's clock), draw each in the same phase (their holders' matrices within 1 mm and 0.001 rad of the first page's),
    // the box neither selected nor carried anywhere; the saved layout.json carries motion. (Set on B and C: A's Undo list,
    // which From another scene counts below, stays short of its 30)
    {
    await sp(B, `(setEdit(true), select(''), itemAct('motion', 'wobble', 'box001'), itemAct('mamount', 1, 'box001'), 0)`);
    const mOn = await sUntil(C, `(STU.items.get('box001') || { rec: {} }).rec.motion`, 10000);
    if (mOn) await sp(C, `(setEdit(true), select(''), itemAct('motion', 'orbit', 'fig001'), 0)`);
    const mTook = [], mAt = [];
    for (const p of [A, B, C, H]) mTook.push(mOn && await sUntil(p, `(() => { const b = STU.items.get('box001'), f = STU.items.get('fig001'); return !!(b && f && b.rec.motion && b.rec.motion.kind === 'wobble' && f.rec.motion && f.rec.motion.kind === 'orbit') && [...STU.items.values()].every(it => !it.gl); })()`, 15000));
    const T = Date.now() + 98765.4321;
    for (const p of [A, B, C, H]) {
      mAt.push(await sp(p, `(() => { const n = HOST.collab.now; HOST.collab.now = () => ${T}; try {
        select(''); const now = performance.now(); itemsStep(0, now); const pb = STUDIO.pose('box001'), pf = STUDIO.pose('fig001');
        return [Math.abs(sceneClock(now) - ${T / 1000}) < 1e-6, pb, pf, JSON.stringify([STU.items.get('box001').rec, STU.items.get('fig001').rec])];
      } finally { HOST.collab.now = n; } })()`));
    }
    // (how far each device's drawn box and figure are from the first page's: places in m, turns in rad)
    const dOf = (a, b) => { if (!a || !b || !a.drawn || !b.drawn) return [Infinity, Infinity]; const d = M => { const m = new Float64Array(16); M.forEach((v, i) => { m[i] = v; }); return m; }, A1 = d(a.drawn), B1 = d(b.drawn);
      const pd = Math.hypot(A1[12] - B1[12], A1[13] - B1[13], A1[14] - B1[14]); let rd = 0; for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) rd = Math.max(rd, Math.abs(A1[i] - B1[i])); return [pd, rd]; };
    const mFar = mAt.every(Boolean) ? mAt.map(m => [dOf(m[1], mAt[0][1]), dOf(m[2], mAt[0][2])].flat()).reduce((a, b) => a.map((v, i) => Math.max(v, b[i]))) : [Infinity];
    const mMoving = mAt.every(m => m && m[0] && m[1] && m[1].moving && !m[1].rests && m[2] && m[2].moving && !m[2].rests && m[3] === mAt[0][3]);
    await sp(A, 'saveLayout()');
    const mSaved = await sUntil(A, `!STU.saving && !unsaved() && !STU.saveNote`, 10000);
    const mL = layoutOf() || {}, mLb = (mL.objects || []).find(x => x.id === 'box001'), mLf = (mL.objects || []).find(x => x.id === 'fig001');
    check(`studio: motions set on two pages (a wobble on the box, an orbit on the figure, always) reach every page and the headset, each drawing them in the same phase at one held room time (within ${mFar.slice(0, 1).concat(mFar.slice(2, 3)).map(v => (v * 1000).toFixed(3)).join(' and ')} mm of the first page's), the records unchanged but for them, and the saved layout.json carries them`,
      !!mOn && mTook.every(Boolean) && mMoving && mFar.every(v => v < 0.001) && mSaved && !!mLb && !!mLb.motion && mLb.motion.kind === 'wobble' && mLb.motion.amount === 15 && !!mLf && !!mLf.motion && mLf.motion.kind === 'orbit',
      JSON.stringify({ mOn: !!mOn, mTook, mFar, mAt: mAt.map(m => m && [m[0], m[1] && [m[1].moving, m[1].rests], m[2] && [m[2].moving, m[2].rests], m[3] === mAt[0][3]]), mSaved, b: mLb && mLb.motion, f: mLf && mLf.motion }));
    await sp(B, `(itemAct('motion', 'none', 'box001'), itemAct('motion', 'none', 'fig001'), select(''), 0)`);
    }

    // ---- a recorded path (v120): the headset records the box's movement (Record its movement armed on its card, a grip on
    // nothing, the hand swinging it for 2 s at 30 frames a second, the recorder's clock the test's); let go, the path is in
    // its record (its place unchanged) and reaches every page; at one room time held on each (HOST.collab.now stubbed, half
    // way through the path's loop), every page and the headset draw the box at the same pose (within 1 mm and 0.001 rad of
    // the first page's), away from where it is placed. (Recorded on the headset, taken back on B: A's Undo list stays short.
    // First every device has B's last write of the box, the motions taken off: a write of the same record still on its way
    // from B would land after the headset's and take the path away again, the last writer winning)
    {
    for (const p of [A, B, C, H]) await sUntil(p, `(() => { const b = STU.items.get('box001'), f = STU.items.get('fig001'); return !!(b && f) && !b.rec.motion && !f.rec.motion && !b.gl; })()`, 15000);
    await sleep(1000);
    const rRec = await sp(H, `(() => {
      const V = (...a) => new THREE.Vector3(...a), it = STU.items.get('box001'), a = XR.ctrls[0], rc = recClock, p0 = JSON.stringify(it.rec.p);
      let T = 1000; recClock = () => T;
      try {
        setEdit(true); select('box001'); itemAct('recArm');
        const armed = XR.rec === 'box001', w = it.holder.getWorldPosition(V());
        const put = p => { a.g.matrix.compose(p, new THREE.Quaternion(), V(1, 1, 1)); a.o.setFromMatrixPosition(a.g.matrix); };
        a.src = { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: { axes: [0, 0, 0, 0], buttons: [] } }; a.g.visible = true;
        put(w.clone().add(V(0.3, 0.2, 0.6))); a.hover = null; xrGrab(a, true);
        const began = !!REC;
        for (let i = 1; i <= 60; i++) { T += 1000 / 30; put(w.clone().add(V(0.3 + 0.5 * Math.sin(i / 10), 0.2 + 0.01 * i, 0.6))); carry(a, 1 / 30); }
        xrGrab(a, false);
        a.src = null; a.g.visible = false; a.hover = null; select('');
        const P = it.rec.path;
        return { armed, began, keys: P ? P.k.length : 0, D: P ? pathLen(P) : 0, same: JSON.stringify(it.rec.p) === p0, note: REC_NOTE.text };
      } finally { recClock = rc; }
    })()`);
    const rTook = [];
    for (const p of [A, B, C]) rTook.push(rRec.keys > 1 && await sUntil(p, `(() => { const b = STU.items.get('box001'); return !!(b && b.rec.path && b.rec.path.k.length === ${rRec.keys}) && !b.gl; })()`, 15000));
    const D = rRec.D || 1, T = (Math.round(Date.now() / 1000 / D) * D + D / 2) * 1000, rAt = [];
    for (const p of [A, B, C, H]) {
      rAt.push(await sp(p, `(() => { const n = HOST.collab.now; HOST.collab.now = () => ${T}; try {
        select(''); const now = performance.now(); itemsStep(0, now); const pb = STUDIO.pose('box001');
        return [pb, JSON.stringify(STU.items.get('box001').rec)];
      } finally { HOST.collab.now = n; } })()`));
    }
    const dOf = (a, b) => { const pd = Math.hypot(a.drawn[12] - b.drawn[12], a.drawn[13] - b.drawn[13], a.drawn[14] - b.drawn[14]); let rd = 0; for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) rd = Math.max(rd, Math.abs(a.drawn[i] - b.drawn[i])); return [pd, rd]; };
    const rFar = rAt.every(r => r && r[0] && r[0].drawn) ? rAt.map(r => dOf(r[0], rAt[0][0])).reduce((a, b) => a.map((v, i) => Math.max(v, b[i]))) : [Infinity, Infinity];
    const rMoved = rAt.every(r => r && r[0] && r[0].moving && r[1] === rAt[0][1]) && Math.hypot(rAt[0][0].drawn[12] - rAt[0][0].placed[12], rAt[0][0].drawn[13] - rAt[0][0].placed[13], rAt[0][0].drawn[14] - rAt[0][0].placed[14]) > 0.05;
    check(`studio: a path recorded on the headset (${rRec.keys} keys over ${rRec.D} s, its place unchanged) reaches every page, and at one held room time the pages and the headset draw the box at the same pose (within ${(rFar[0] * 1000).toFixed(3)} mm of the first page's), along its path`,
      rRec.armed && rRec.began && rRec.keys > 1 && rRec.same && Math.abs(rRec.D - 2) < 0.002 && rTook.every(Boolean) && rMoved && rFar[0] < 0.001 && rFar[1] < 0.001,
      JSON.stringify({ rRec, rTook, rFar, rAt: rAt.map(r => r && [r[0] && r[0].moving, r[1] === rAt[0][1]]) }));
    await sp(B, `(setEdit(true), itemAct('recDel', null, 'box001'), select(''), 0)`);
    }

    // ---- a ten-minute recording and a voice (v125): C records the box's movement for 10 minutes on the page (the recorder's
    // clock the test's), kept as the file recordings/Box-1.json through the relay; every page and the headset take its record
    // (the same src, len and n), read the file from the relay and, at one room time held on each, draw the box at the same
    // pose (within 1 mm of C's). Then C records it again with its voice (Chromium's fake microphone, real time): the path and
    // the voice's sound (sounds/Box-voice-1.wav, following the box, sync box001) reach everyone; at one room time held on each
    // every device puts the voice at the same moment of its file (within 1 ms), and with the sound on, B and C hear it where
    // the room's clock says (within 50 ms). (C's own Undo list; the items taken away after)
    {
    for (const p of [A, B, C, H]) await sUntil(p, `(() => { const b = STU.items.get('box001'); return !!b && !b.rec.path && !b.gl; })()`, 15000);
    await sleep(500);
    const lRec = await sp(C, `(() => {
      const it = STU.items.get('box001'), H = it.holder, rc = recClock, p0 = H.position.clone();
      let T = 1000; recClock = () => T;
      try {
        setEdit(true); select('box001'); itemAct('rec');
        const began = !!(REC && REC.by === 'page'), cap = REC ? REC.cap : 0;
        for (let i = 1; i <= 18100 && REC; i++) { T += 1000 / 30; const a = 2 * Math.PI * (i / 30) / 20; H.position.set(p0.x + Math.sin(a), p0.y + 0.2 * Math.sin(a / 3), p0.z + 1 - Math.cos(a)); H.quaternion.setFromEuler(new THREE.Euler(0, a / 2, 0)); recStep(); }
        select('');
        return { began, cap, left: !!REC };
      } finally { recClock = rc; }
    })()`);
    const lKept = lRec.began && await sUntil(C, `(() => { const b = STU.items.get('box001'); return !KEEP.has('box001') && !!(b.rec.path && b.rec.path.src); })()`, 60000);
    const lP = lKept ? await sp(C, `STU.items.get('box001').rec.path`) : null, lTook = [];
    for (const p of [A, B, H]) lTook.push(!!lP && await sUntil(p, `(() => { const b = STU.items.get('box001'), P = b && b.rec.path, f = P && STUDIO.pf(P.src); return !!(P && P.src === '${lP && lP.src}' && P.n === ${lP ? lP.n : 0} && f && f.state === 'ok' && f.n === P.n) && !b.gl; })()`, 20000));
    const lT = (Math.round(Date.now() / 1000) + 123.456) * 1000, lAt = [];
    for (const p of [C, A, B, H]) {
      lAt.push(await sp(p, `(() => { const n = HOST.collab.now; HOST.collab.now = () => ${lT}; try {
        select(''); const now = performance.now(); itemsStep(0, now); return STUDIO.pose('box001');
      } finally { HOST.collab.now = n; } })()`));
    }
    const pd = (a, b) => Math.hypot(a.drawn[12] - b.drawn[12], a.drawn[13] - b.drawn[13], a.drawn[14] - b.drawn[14]);
    const lFar = lAt.every(r => r && r.drawn) ? Math.max(...lAt.map(r => pd(r, lAt[0]))) : Infinity;
    const lMoved = lAt.every(r => r && r.moving) && lAt[0] && lAt[0].drawn && Math.hypot(lAt[0].drawn[12] - lAt[0].placed[12], lAt[0].drawn[13] - lAt[0].placed[13], lAt[0].drawn[14] - lAt[0].placed[14]) > 0.05;
    const lFile = (() => { try { const j = JSON.parse(fs.readFileSync(path.join(SC, 'test', 'recordings', 'Box-1.json'), 'utf8')); return [j.n, j.k.length, j.len]; } catch (e) { return null; } })();
    check(`studio: a ten-minute recording made on a page (${lP ? lP.n : 0} keys over ${lP ? lP.len : 0} s) is kept as the file recordings/Box-1.json through the relay; every page and the headset take its record, read the file and, at one held room time, draw the box at the same pose (within ${(lFar * 1000).toFixed(3)} mm of the first page's)`,
      lRec.began && lRec.cap === 600 && !lRec.left && !!lP && lP.src === 'recordings/Box-1.json' && lP.n > 600 && lP.len > 599 && lTook.every(Boolean) && lMoved && lFar < 0.001 && !!lFile && lFile[0] === lP.n && lFile[1] === lP.n && lFile[2] === lP.len,
      JSON.stringify({ lRec, lKept, lP, lTook, lFar, lMoved, lFile }));
    // the voice: recorded with C's fake microphone, 4 s in real time (0.6 s still, then round)
    await C.evaluate(() => HOST.audio.mute(false));
    await B.evaluate(() => HOST.audio.mute(false));
    await sp(C, `(setEdit(true), select('box001'), itemAct('recVoice'), 0)`);
    const vOn = await sUntil(C, 'VOICE.on && !VOICE.asking', 15000);
    if (vOn) {
      await sp(C, `(recClock = () => performance.now(), select('box001'), itemAct('rec'), window.__vr = { p0: STU.items.get('box001').holder.position.clone(), r0: performance.now() }, 0)`);
      await sUntil(C, `!!(REC && REC.v && REC.v.state === 'on')`, 10000);
      await sp(C, `(window.__vr.iv = setInterval(() => { if (!REC) return; const s = Math.max(0, (performance.now() - window.__vr.r0) / 1000 - 0.6), a = 2 * Math.PI * s / 3, H = STU.items.get('box001').holder, p0 = window.__vr.p0; H.position.set(p0.x + 0.5 * Math.sin(a), p0.y, p0.z + 0.5 - 0.5 * Math.cos(a)); recStep(); }, 20), 0)`);
      await sleep(4000);
      await sp(C, `(clearInterval(window.__vr.iv), itemAct('recStop'), select(''), 0)`);
    }
    const vKept = vOn && await sUntil(C, `!KEEP.has('box001') && !!voiceOf('box001') && !!STU.items.get('box001').rec.path.k`, 30000);
    const vRec = vKept ? await sp(C, `(() => { const s = voiceOf('box001'); return { id: s.id, rec: s.rec }; })()`) : null, vTook = [];
    for (const p of [A, B, H]) vTook.push(!!vRec && await sUntil(p, `(() => { const s = STU.items.get('${vRec && vRec.id}'), F = s && s.F; return !!(s && JSON.stringify(s.rec) === ${JSON.stringify(JSON.stringify(vRec && vRec.rec))} && F && (F.state === 'ready' || F.state === 'bytes' || F.state === 'decoding') && STU.items.get('box001').rec.path && STU.items.get('box001').rec.path.k); })()`, 20000));
    // (at one held room time every device puts the voice at the same moment of its file)
    const vT = (Math.round(Date.now() / 1000) + 61.234) * 1000, vAt = [];
    for (const p of [C, A, B, H]) vAt.push(!!vRec && await sp(p, `(() => { const n = HOST.collab.now; HOST.collab.now = () => ${vT}; try { select(''); const it = STU.items.get('${vRec && vRec.id}'), s = syncAt(it, performance.now(), 600); return s ? s.at : null; } finally { HOST.collab.now = n; } })()`));
    const vFar = vAt.every(x => typeof x === 'number') ? Math.max(...vAt.map(x => Math.abs(x - vAt[0]))) : Infinity;
    // (and with the sound on, B and C hear it where the room's clock says)
    const vHeard = [];
    for (const p of [C, B]) {
      const ok = !!vRec && await sUntil(p, `!!STUDIO.voice('${vRec && vRec.id}').playing`, 20000);
      vHeard.push(ok ? await sp(p, `(() => { const s = STUDIO.voice('${vRec.id}'); return s.now && s.log && s.voiceNow != null ? s.voiceNow - ((s.log.skip || 0) + s.now.e) : null; })()`) : null);
    }
    const vWav = (() => { try { const b = fs.readFileSync(path.join(SC, 'test', 'sounds', 'Box-voice-1.wav')); return [b.toString('latin1', 0, 4), b.readUInt16LE(22), b.readUInt32LE(24)]; } catch (e) { return null; } })();
    check(`studio: a voice recorded with the movement on a page (Chromium's fake microphone) reaches every page and the headset as a sound following the box (sync box001, ${vWav ? 'a mono WAV' : 'no file'}); at one held room time every device puts it at the same moment of its file (within ${(vFar * 1000).toFixed(3)} ms), and B and C hear it where the room's clock says (${vHeard.map(x => (x == null ? '?' : (x * 1000).toFixed(1) + ' ms')).join(', ')})`,
      vOn && vKept && !!vRec && vRec.rec.sync === 'box001' && vRec.rec.on === 'box001' && vRec.rec.file === 'sounds/Box-voice-1.wav' && vTook.every(Boolean) && vFar < 0.001 && vHeard.every(x => typeof x === 'number' && Math.abs(x) <= 0.05) && !!vWav && vWav[0] === 'RIFF' && vWav[1] === 1,
      JSON.stringify({ vOn, vKept, vRec, vTook, vAt, vHeard, vWav, note: await sp(C, 'REC_NOTE.text') }));
    await C.evaluate(() => HOST.audio.mute(true));
    await B.evaluate(() => HOST.audio.mute(true));
    await sp(C, `(VOICE.on && itemAct('recVoice', null, 'box001'), voiceOf('box001') && deleteItem(voiceOf('box001').id), itemAct('recDel', null, 'box001'), select(''), 0)`);
    }

    // ---- a long sound (25 s) streamed: an element on the shell's context, nothing decoded; another device, muted, silent
    await B.evaluate(() => HOST.audio.mute(false));
    await sp(B, `(X.tab = 'scene', renderPanes(), 0)`);
    await B.click('#explore .tabs button[data-tab="scene"]', { timeout: 5000 }).catch(() => {});   // (a tap: the sound may start)
    const lid = await sp(B, `addSound('sounds/long.wav')`);
    const streamed = !!lid && await sUntil(B, `(() => { const it = STU.items.get('${lid}'); return !!(it && it.st && !it.st.el.paused && it.gt > 0); })()`, 20000);
    const ls = await sp(B, `(() => { const F = SND.get('sounds/long.wav'), it = STU.items.get('${lid}'); return { F: F ? [F.state, F.stream, Math.round(F.dur), !!F.buf, !!F.bytes].join() : '', el: !!(it && it.st && it.st.el.src.includes('sounds/long.wav')) }; })()`);
    const aQuiet = !!lid && await sUntil(A, `!!STU.items.get('${lid}')`, 5000) && await sp(A, `(() => { const it = STU.items.get('${lid}'); return HOST.audio.muted && !(it.st && !it.st.el.paused); })()`);
    check('studio: a 25 s sound placed on a page is streamed there (an element, no decoded buffer, playing); it reaches the others, and a device with its sound off plays nothing',
      streamed && ls.F === 'stream,true,25,false,false' && ls.el && aQuiet, JSON.stringify({ lid, streamed, ls, aQuiet }));
    await B.evaluate(() => HOST.audio.mute(true));
    await sp(B, `(deleteItem('${lid}'), 0)`);

    // ---- From another scene: a scene of the relay's (shelf, made now) holds an FBX naming its picture and an OBJ with its
    // MTL and picture outside originals/; a page at the station copies each into the open scene through its Add pane (the
    // picture with the FBX at the same paths; the OBJ and what it names under originals/, the only place an upload may put
    // an OBJ), and places it, one Undo step; every page and the headset take it, its model in (the FBX with its picture); a
    // second copy of the FBX gets a new name and keeps this scene's picture; the headset's Add pane offers it too
    {
    const SH = path.join(SC, 'shelf');
    fs.mkdirSync(path.join(SH, 'props'), { recursive: true }); fs.mkdirSync(path.join(SH, 'crates'), { recursive: true });
    fs.copyFileSync(path.join(TEST, 'test', 'figure.fbx'), path.join(SH, 'props', 'statue.fbx'));
    fs.copyFileSync(path.join(TEST, 'test', 'figure.png'), path.join(SH, 'props', 'figure.png'));
    for (const f of ['crate.obj', 'crate.mtl', 'crate.png']) fs.copyFileSync(path.join(TEST, 'test', 'originals', f), path.join(SH, 'crates', f));
    const shSeen = await sUntil(A, `SRC.scenes.some(s => s.name === 'shelf')`, 15000);
    await sp(A, `(setEdit(true), select(''), X.tab = 'add', act('from'), act('fromScene', 'shelf'), renderPanes(), 0)`);
    const listed = await sUntil(A, `!!FROM.files && !FROM.loading && fromLists(FROM.files).models.map(f => f.path).join() === 'crates/crate.obj,props/statue.fbx'`, 10000);
    await sp(A, '(renderPanes(), 0)');
    // (a copy placed selects it, which shows its card: the Add pane again before each press)
    const u0 = await sp(A, 'UNDO.length'), copiedAs = async (want, li) => (await sp(A, `(X.tab = 'add', renderPanes(), 0)`), await click(A, `#pane-add li[data-act="fromFile"][data-v="${li}"]`)) &&
      await sUntil(A, `!!STUDIO.copied && STUDIO.copied.path === ${JSON.stringify(want)} && !FROM.busy`, 30000);
    const c1 = await copiedAs('props/statue.fbx', 'props/statue.fbx'), cp1 = await sp(A, '[STUDIO.copied, UNDO.length, FROM.note]');
    const same = f => fs.existsSync(path.join(SC, 'test', f)) && fs.readFileSync(path.join(SC, 'test', f)).equals(fs.readFileSync(path.join(SH, f)));
    const id1 = cp1[0] && cp1[0].id, took1 = [];
    for (const p of [A, B, C, H]) took1.push(!!id1 && await sUntil(p, `(() => { const it = STU.items.get('${id1}'); return !!(it && it.rec.file === 'props/statue.fbx' && it.model && it.E && it.E.texPaths.has('props/figure.png')); })()`, 40000));
    check('studio: From another scene on a page at the station copies an FBX of the relay\'s shelf scene into the open scene with the picture it names (the same paths, the same bytes), places it (one Undo step), and every page and the headset take it, its picture found',
      shSeen && listed && c1 && JSON.stringify(cp1[0].copied) === '["props/figure.png"]' && !cp1[0].kept.length && cp1[1] === u0 + 1 && same('props/statue.fbx') && same('props/figure.png') && took1.every(Boolean),
      JSON.stringify({ shSeen, listed, c1, cp1, u0, took1 }));
    const c2 = await copiedAs('originals/crates/crate.obj', 'crates/crate.obj'), cp2 = await sp(A, 'STUDIO.copied'), id2 = cp2 && cp2.id;
    const objIn = [];
    for (const p of [A, H]) objIn.push(!!id2 && await sUntil(p, `(() => { const it = STU.items.get('${id2}'); return !!(it && it.rec.file === 'originals/crates/crate.obj' && it.model); })()`, 40000));
    const c3 = await copiedAs('props/statue 2.fbx', 'props/statue.fbx'), cp3 = await sp(A, 'STUDIO.copied');
    const hFrom = await sp(H, `(() => { X.tab = 'add'; X.scroll = {}; const seen = new Set(); for (let off = 0; off < 6000; off += 150) { X.scroll.add = off; for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } for (const r of XR.main.regions) seen.add(r.id); } X.scroll = {}; return seen.has('from'); })()`);
    check('studio: an OBJ copied from the shelf goes under originals/ with its MTL and picture (an upload may put an OBJ only there) and its model loads; a second copy of the FBX gets a new name and keeps this scene\'s picture; the headset\'s Add pane offers From another scene',
      c2 && JSON.stringify(cp2.copied.slice().sort()) === '["originals/crates/crate.mtl","originals/crates/crate.png"]' && ['crate.obj', 'crate.mtl', 'crate.png'].every(f => fs.existsSync(path.join(SC, 'test', 'originals', 'crates', f))) &&
        !fs.existsSync(path.join(SC, 'test', 'crates')) && objIn.every(Boolean) && c3 && JSON.stringify(cp3.kept) === '["props/figure.png"]' && !cp3.copied.length && fs.existsSync(path.join(SC, 'test', 'props', 'statue 2.fbx')) && hFrom,
      JSON.stringify({ c2, cp2, objIn, c3, cp3, hFrom }));
    await sp(A, `(${JSON.stringify([id1, id2, cp3 && cp3.id])}.forEach(i => i && deleteItem(i)), FROM.open = false, select(''), X.tab = 'scene', 0)`);
    }

    // ---- the scene on the room's frame (v125; the owner, 8 November 2026: "align all things to the room marks and have the
    // circle only be the entry"): the headset at the studio's circle (not at the room's origin) draws every item where its
    // record puts it in room coordinates (its world place turned back through the headset's room frame, within 1 mm); the
    // circle moved 2 m and turned 90 degrees as the page's room map moves it, the items stay where they are in the room
    // (frame by frame while the circle glides there) and the headset stays at its station, its rig at the new spot; Move
    // the scene to this circle on a page (its Scene pane, editing on) refused while an item is locked (it says which), then
    // moving every item to the circle's spot transform of its old place (within 1 mm), one Undo step, every device's
    // records the same and the headset drawing them there; Undo takes it back. Set up first, so that nothing from the
    // round's earlier steps moves them: the four items without a motion, a path or a behaviour, nothing locked in place,
    // no cube listing them (shown on every device), and the circle moved to a known spot away from the room's origin
    {
    const IDS = ['box001', 'fig001', 'cube01', 'snd001'];
    await sp(B, `(() => { setEdit(true); select('');
      const ids = ${JSON.stringify(IDS)};
      for (const it of [...STU.items.values()]) {
        const patch = {};
        if (ids.includes(it.id)) for (const k of ['motion', 'path', 'behaviour']) if (it.rec[k] !== undefined) patch[k] = undefined;
        if (it.rec.locked) patch.locked = undefined;
        if (it.kind === 'c' && (it.rec.show.concat(it.rec.hide)).some(i => ids.includes(i))) { patch.show = it.rec.show.filter(i => !ids.includes(i)); patch.hide = it.rec.hide.filter(i => !ids.includes(i)); }
        if (Object.keys(patch).length) setRec(it.id, patch);
      }
      return 0; })()`);
    const plain = `(() => { const ids = ${JSON.stringify(IDS)}, all = [...STU.items.values()];
      return ids.every(i => { const it = STU.items.get(i); return !!it && !it.gl && it.rec.motion === undefined && it.rec.path === undefined && it.rec.behaviour === undefined && (it.kind === 'c' || it.shown); }) &&
        !all.some(it => it.rec.locked || (it.kind === 'c' && it.rec.show.concat(it.rec.hide).some(i => ids.includes(i)))); })()`;
    // (the headset's frames are the test's: stepped while it waits, so its items take the room's records, glide and show)
    const isPlain = [];
    for (const p of [A, B, C]) isPlain.push(await sUntil(p, plain, 15000));
    isPlain.push(await until(H, s => { window.__xr.step(); try { return !!HOST.cur.peek(s); } catch (e) { return false; } }, plain, 15000));
    const S0 = { x: 1.6, z: -0.9, yaw: 0.7 };
    await B.evaluate(([id, to]) => HOST.collab.move(id, to), [sid, S0]);
    // where the headset draws each item, in room coordinates (a frame of its own, the renderer told it presents for it)
    const hRoom = () => H.evaluate(ids => {
      const X = window.__xr, xr = HOST.renderer.xr, P = s => HOST.cur.peek(s);
      X.step();
      xr.isPresenting = true;
      try { P('(xrPlace(orbit.cur), GL.rig.updateMatrixWorld(true), GL.world.updateMatrixWorld(true), 0)'); } finally { xr.isPresenting = false; }
      const out = {};
      for (const id of ids) {
        const it = P(`STU.items.get('${id}')`);
        if (!it) continue;
        const w = it.holder.getWorldPosition(new THREE.Vector3()), r = HOST.room.toRoom(w);
        out[id] = { at: [r.x, r.y, r.z], p: it.rec.p.slice() };
      }
      const rig = HOST.room.toRoom(P('GL.rig').getWorldPosition(new THREE.Vector3()));
      return { out, atSt: P('XR.atSt'), mine: HOST.collab.mine(), placing: HOST.room.placing(), rig: [rig.x, rig.y, rig.z] };
    }, IDS);
    const off = R0 => Math.max(...Object.values(R0.out).map(o => dist(o.at, o.p)));
    let R0 = await hRoom();
    for (let k = 0; k < 40 && dist(R0.rig, [S0.x, 1.6, S0.z]) > 0.002; k++) { await frames(H, 100); R0 = await hRoom(); }
    const st0 = await A.evaluate(id => HOST.collab.station(id), sid);
    check(`studio: set up (no motion, path, behaviour or lock, no cube listing them) and its circle moved to (${st0.x.toFixed(2)}, ${st0.z.toFixed(2)}, turned ${st0.yaw.toFixed(2)}), away from the room's origin, the headset there draws every item where its record puts it in room coordinates (within ${(off(R0) * 1000).toFixed(3)} mm)`,
      isPlain.every(Boolean) && Math.abs(st0.x - S0.x) < 0.01 && Math.abs(st0.z - S0.z) < 0.01 && angle(st0.yaw, S0.yaw) < 0.01 && dist(R0.rig, [S0.x, 1.6, S0.z]) < 0.002 &&
        R0.atSt && R0.mine === sid && Object.keys(R0.out).length === IDS.length && off(R0) < 0.001, JSON.stringify({ isPlain, st0, R0 }));
    // the circle moved 2 m and turned a quarter, as the room map moves it (from a page)
    const to = { x: st0.x + 2, z: st0.z, yaw: st0.yaw + Math.PI / 2 };
    await B.evaluate(([id, to]) => HOST.collab.move(id, to), [sid, to]);
    let worst = 0, R1 = null;
    for (let k = 0; k < 40; k++) { R1 = await hRoom(); worst = Math.max(worst, off(R1)); await sleep(30); }
    for (let k = 0; k < 30 && dist(R1.rig, [to.x, 1.6, to.z]) > 0.002; k++) { await frames(H, 100); R1 = await hRoom(); worst = Math.max(worst, off(R1)); }
    const st1 = await A.evaluate(id => HOST.collab.station(id), sid);
    check(`studio: the circle moved 2 m and turned 90 degrees on a page (as its room map moves it): every item stays where it is in the room on the headset, frame by frame while the circle glides there (within ${(worst * 1000).toFixed(3)} mm), and the headset stays at its station, its rig at the new spot`,
      Math.abs(st1.x - to.x) < 0.01 && angle(st1.yaw, to.yaw) < 0.01 && worst < 0.001 && R1.atSt && R1.mine === sid && R1.placing && dist(R1.rig, [to.x, 1.6, to.z]) < 0.002, JSON.stringify({ st1, worst, R1 }));
    // Move the scene to this circle (a page's Scene pane): refused while an item is locked, then every item moved there
    const recs = p => sp(p, `JSON.stringify([...STU.items.values()].filter(it => it.kind !== 'g').map(it => [it.id, it.rec]).sort((a, b) => (a[0] < b[0] ? -1 : 1)))`);
    const before = JSON.parse(await recs(A));
    await sp(A, `(setEdit(true), select('box001'), itemAct('lock'), select(''), X.tab = 'scene', renderPanes(), 0)`);
    // (Undo told by the list's length and its last step's content: A's list emptied here, so it can grow, never full)
    const undoNow = () => sp(A, `[UNDO.length, JSON.stringify((UNDO[UNDO.length - 1] || []).map(u => [u.id, u.kind, u.before]).sort((a, b) => (a[0] < b[0] ? -1 : 1)))]`);
    const locked0 = await sp(A, `STU.items.get('box001').rec.locked === true`);
    await sp(A, `(UNDO.length = 0, 0)`);
    const pr1 = await click(A, '#pane-scene [data-act="circle"]');
    const refused = await sp(A, `[CIRC.note, JSON.stringify(STU.items.get('box001').rec.p)]`);
    const u1 = await undoNow();
    await sp(A, `(select('box001'), itemAct('lock'), select(''), X.tab = 'scene', renderPanes(), 0)`);
    const u2 = await undoNow(), unl = await recs(A);
    const pr2 = await click(A, '#pane-scene [data-act="circle"]');
    const u3 = await undoNow();
    const nMoved = await sp(A, `[...STU.items.values()].filter(it => ['o', 'p', 'e', 'c', 's'].includes(it.kind)).length`);
    // (the move's step: every item it moved, once each, each with its record as it was just before the move)
    const unlMap = new Map(JSON.parse(unl)), step3 = JSON.parse(u3[1]);
    const stepOk = step3.length === nMoved && new Set(step3.map(u => u[0])).size === nMoved &&
      step3.every(([id, kind, b]) => ['o', 'p', 'e', 'c', 's'].includes(kind) && unlMap.has(id) && JSON.stringify(b) === JSON.stringify(unlMap.get(id)));
    const c = Math.cos(st1.yaw), sn = Math.sin(st1.yaw), want = {};
    for (const [id, r] of before) if (IDS.includes(id) && !(r.on)) want[id] = [st1.x + c * r.p[0] + sn * r.p[2], r.p[1], st1.z - sn * r.p[0] + c * r.p[2]];
    const after = await recs(A), same = [];
    for (const p of [B, C, H]) same.push(await sUntil(p, `${JSON.stringify(after)} === JSON.stringify([...STU.items.values()].filter(it => it.kind !== 'g').map(it => [it.id, it.rec]).sort((a, b) => (a[0] < b[0] ? -1 : 1)))`, 10000));
    const A2 = new Map(JSON.parse(after)), mvd = Math.max(...Object.entries(want).map(([id, w]) => dist(A2.get(id).p, w)));
    const cubeYaw = A2.get('cube01') ? A2.get('cube01').yaw : null, cube0 = before.find(b => b[0] === 'cube01')[1].yaw;
    // (the room's records glide in over 0.25 s on the headset's own frames: drawn once they have landed)
    let R2 = await hRoom();
    for (let k = 0; k < 40 && off(R2) >= 0.001; k++) { await sleep(250); R2 = await hRoom(); }
    check(`studio: Move the scene to this circle on a page is refused while an item is locked (it says which, nothing changes), then moves every item to the circle's spot transform of its old place (within ${(mvd * 1000).toFixed(3)} mm; the cube turned with it), one Undo step, every device's records the same and the headset drawing them there (within ${(off(R2) * 1000).toFixed(3)} mm)`,
      locked0 && pr1 && /Box/.test(refused[0]) && /locked/.test(refused[0]) && u1[0] === 0 && refused[1] === JSON.stringify(before.find(b => b[0] === 'box001')[1].p) &&
        u2[0] === 1 && pr2 && u3[0] === u2[0] + 1 && stepOk && Object.keys(want).length >= 3 && mvd < 0.001 && angle(cubeYaw, cube0 + st1.yaw) < 0.001 && same.every(Boolean) && off(R2) < 0.001,
      JSON.stringify({ locked0, pr1, refused, u1: u1[0], u2: u2[0], u3: u3[0], stepOk, step3: step3.map(u => u[0]), nMoved, pr2, mvd, cubeYaw, cube0, yaw: st1.yaw, same, note: await sp(A, 'CIRC.note'), R2 }));
    await sp(A, 'undo()');
    const back = [];
    for (const p of [A, B, C, H]) back.push(await sUntil(p, `${JSON.stringify(JSON.stringify(before))} === JSON.stringify([...STU.items.values()].filter(it => it.kind !== 'g').map(it => [it.id, it.rec]).sort((a, b) => (a[0] < b[0] ? -1 : 1)))`, 10000));
    check('studio: Undo takes the move back on every page and the headset', back.every(Boolean), JSON.stringify({ back }));
    }

    // ---- a circle made for one scene, as the shell writes it (st.<id> with the studio, st.<id>.x naming the scene, in one
    // batch): two pages following it open that scene and write its saved layout alike (each item once in the room), and
    // the first station keeps its own scene
    {
    fs.writeFileSync(path.join(SC, 'quiet', 'layout.json'), JSON.stringify({ studio: 1, scene: 'quiet', saved: new Date().toISOString(),
      sounds: [{ id: 'qtone1', name: 'Quiet tone', file: 'tone.wav', p: [0, 1.2, -1.5], vol: 0.5, r: 1.5, loop: true, start: 'always' }],
      cubes: [{ id: 'qcube1', name: 'Quiet cube', p: [0, 1, 0], yaw: 0, size: [1, 2, 1], mode: 'while', show: ['qtone1'], hide: [] }] }));
    const nid = 'quiet' + Math.floor(Math.random() * 1e6).toString(36);
    await A.evaluate(id => HOST.collab.publish([['st.' + id, { story: 'studio', x: 6, z: -6, yaw: 0 }], ['st.' + id + '.x', { scene: 'quiet' }]]), nid);
    // (each page follows it once it has the station: a follow of a station a page has not heard of yet does nothing)
    let nSeen = true;
    for (const p of [B, C]) { nSeen = await until(p, id => !!HOST.collab.station(id), nid, 5000) && nSeen; await p.evaluate(i => HOST.collab.follow(i), nid); }
    const qOpen = [];
    for (const p of [B, C]) qOpen.push(await sUntil(p, `atStation() && STU.scene === 'quiet' && STU.listing === 'ok' && STU.items.size === 2 && STU.items.has('qtone1') && STU.items.has('qcube1')`, 20000));
    await sleep(1500);
    const qRoom = ((await (await fetch(sb + 'api/rooms/' + rc)).json()).keys['st.' + nid + '.x'] || {}).v || {};
    const aStill = await sp(A, `[STU.scene, atStation(), STU.items.size]`), qCount = await Promise.all([B, C].map(p => sp(p, 'STU.items.size')));
    check('studio: a circle made for one scene as the shell writes it (st.<id> with the studio and st.<id>.x naming the scene, in one batch): two pages following it open that scene and write its saved layout alike, the room holding each item once; the first station keeps its own scene',
      nSeen && qOpen.every(Boolean) && Object.keys(qRoom).sort().join() === 'c.qcube1,s.qtone1,scene,settings' && qRoom.scene === 'quiet' && qCount.every(n => n === 2) && aStill[0] === 'test' && aStill[1],
      JSON.stringify({ nSeen, qOpen, qRoom: Object.keys(qRoom), qCount, aStill }));
    }

    // ---- New scene from the headset (the shell's keypad, HOST.collab.keypad: stubbed here, giving the name): made on the
    // relay, opened at the headset's station and so on the page following it
    {
    await H.evaluate(() => { window.__kpAsked = null; HOST.collab.keypad = async o => { window.__kpAsked = o; return 'from headset'; }; });
    const hk = await hPanel('scene', 'newscene');
    const madeH = await sUntil(H, `STU.scene === 'from headset' && STU.listing === 'ok' && editOn()`, 15000);
    const aOn = await sUntil(A, `STU.scene === 'from headset' && STU.listing === 'ok'`, 15000);
    const asked = await H.evaluate(() => window.__kpAsked);
    check('studio: New scene on the headset\'s panel asks the shell\'s keypad for the name, makes the scene on the relay and opens it at the station, where the page following it switches to it too',
      hk && madeH && aOn && fs.existsSync(path.join(SC, 'from headset')) && !!asked && asked.title === 'New scene' && asked.max === 64, JSON.stringify({ hk, madeH, aOn, asked }));
    }
    for (const p of pages.splice(0)) await p.context().close().catch(() => {});

    // ---- the relay's /upload: to the Upload pane, a new scene, the test originals converted and sorted into its folders
    const red = await fetch(sb + 'upload', { redirect: 'manual' });
    const loc = red.headers.get('location');
    const U = await sopen(sb + 'upload', { name: 'Ulla', size: { width: 900, height: 640 } });
    await studioIn(U);
    const upTab = await sUntil(U, `X.tab === 'upload' && SRC.state === 'ok' && SRC.kind === 'relay' && SRC.upload && !!document.querySelector('#pane-upload [data-act="up:new"]')`, 20000);
    const ff = await sp(U, 'SRC.ffmpeg');
    check('studio: the relay\'s /upload redirects (302) to /#studio&upload, which opens the studio\'s Upload pane with a relay that takes uploads',
      red.status === 302 && loc === '/#studio&upload' && upTab && /#studio&upload/.test(U.url()), JSON.stringify({ status: red.status, loc, upTab, url: U.url(), ff }));
    await click(U, '#pane-upload [data-act="up:new"]');
    await sUntil(U, `!!document.querySelector('#stuNewName')`, 5000);
    await U.evaluate(() => { const i = document.querySelector('#stuNewName'); i.value = 'made'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await click(U, '#pane-upload [data-act="up:make"]');
    const made = await sUntil(U, `UP.scene === 'made' && SRC.scenes.some(s => s.name === 'made')`, 10000) && fs.existsSync(path.join(SC, 'made'));
    await U.setInputFiles('#stuFiles', ['figure.fbx', 'figure.png', 'originals/crate.obj', 'originals/crate.mtl', 'originals/crate.png', 'tone.wav', 'sounds/long.wav'].map(f => path.join(TEST, 'test', f)));
    const planned = await sUntil(U, `!UP.planning && UP.rows.length > 0 && UP.rows.every(r => r.how !== 'measuring')`, 30000);
    const plan = await sp(U, `UP.rows.map(r => [r.kind, r.src.map(e => e.path).join('+'), r.out.join('+'), r.how || ''])`);
    const row = (kind, src) => plan.find(r => r[0] === kind && r[1] === src) || [];
    const longOut = ff ? 'sounds/long.mp3' : 'sounds/long.wav';
    const planOk = plan.length === 4 && row('model', 'figure.fbx+figure.png')[2] === 'models/figure.glb+originals/figure.fbx+originals/figure.png' &&
      row('model', 'crate.obj+crate.mtl+crate.png')[2] === 'models/crate.glb+originals/crate.obj+originals/crate.mtl+originals/crate.png' &&
      row('sound', 'tone.wav')[2] === 'sounds/tone.wav+originals/tone.wav' && row('sound', 'tone.wav')[3] === 'wav' &&
      row('sound', 'long.wav')[2] === longOut + '+originals/long.wav' && row('sound', 'long.wav')[3] === (ff ? 'mp3' : 'wav22');
    check('studio: the Upload pane makes a new scene on the relay, and the test originals dropped on it give the plan: each model with the files it names, each sound on its own, where each goes',
      made && planned && planOk, JSON.stringify({ made, planned, plan, ff }));
    if (dir) { await U.evaluate(() => { const p = document.querySelector('#panel'), pl = document.querySelector('#pane-upload .stu-plan'); if (p && pl) p.scrollTop = pl.offsetTop - 120; }); await sleep(400); await shot(U, 'studio-4-upload-plan.png'); }
    const tr = Date.now();
    await click(U, '#pane-upload [data-act="up:run"]');
    const ran = await sUntil(U, `!UP.busy && UP.ran`, 180000);
    const rows = await sp(U, `UP.rows.map(r => [r.kind, r.state, r.msg])`);
    const M = path.join(SC, 'made'), want = ['models/figure.glb', 'models/crate.glb', 'sounds/tone.wav', longOut, 'originals/figure.fbx', 'originals/figure.png', 'originals/crate.obj',
      'originals/crate.mtl', 'originals/crate.png', 'originals/tone.wav', 'originals/long.wav'];
    const missing = want.filter(p => !fs.existsSync(path.join(M, p)));
    const wav = fs.existsSync(path.join(M, 'sounds/tone.wav')) ? fs.readFileSync(path.join(M, 'sounds/tone.wav')) : Buffer.alloc(0);
    const wavHead = wav.length > 44 ? [wav.toString('latin1', 0, 4), wav.readUInt16LE(20), wav.readUInt16LE(22), wav.readUInt16LE(34)].join() : '';
    const lb = fs.existsSync(path.join(M, longOut)) ? fs.readFileSync(path.join(M, longOut)) : Buffer.alloc(0);
    const longOk = ff ? (h => !!h && h.mpeg1 && h.layer3 && h.rate44 && h.mono)(mp3Head(lb)) : lb.length > 44 && lb.readUInt16LE(22) === 1;
    if (dir) { await U.evaluate(() => { const p = document.querySelector('#panel'), pl = document.querySelector('#pane-upload .stu-plan'); if (p && pl) p.scrollTop = pl.offsetTop - 120; }); await sleep(400); await shot(U, 'studio-5-upload-done.png'); }
    check(`studio: Convert and upload (${((Date.now() - tr) / 1000).toFixed(1)} s) sorts everything into the new scene: two GLBs in models/, the short sound a mono 16-bit WAV and the long one ${ff ? 'a mono 44.1 kHz MP3 made by the relay\'s ffmpeg' : 'a mono WAV (no ffmpeg on this machine)'} in sounds/, every given file in originals/`,
      ran && rows.every(r => r[1] === 'done') && !missing.length && wavHead === 'RIFF,1,1,16' && longOk, JSON.stringify({ ran, rows, missing, wavHead, long: ff ? mp3Head(lb) : lb.length }));
    await click(U, '#pane-upload [data-act="up:open"]');
    const opened = await sUntil(U, `STU.scene === 'made' && STU.listing === 'ok' && X.tab === 'add' && editOn()`, 20000);
    const L = await sp(U, `(() => { const L = sceneLists(); return [L.models.map(f => f.path).join(), L.sounds.map(f => f.path).join(), L.orig.map(f => f.path).join()]; })()`);
    await sp(U, `[addModel('models/figure.glb'), addModel('models/crate.glb')]`);
    const glbs = await sUntil(U, `['models/figure.glb', 'models/crate.glb'].every(p => { const E = LIB.get(p); return E && E.state === 'ready' && !!E.record; })`, 30000);
    const recs = await sp(U, `['models/figure.glb', 'models/crate.glb'].map(p => { const E = LIB.get(p); return E ? [E.state, E.record && E.record.from, E.clips.map(c => c.name).join()] : null; })`);
    check('studio: Open the scene shows the GLBs and sounds to place (the originals folded), and the GLBs load with their records naming the files they were made from',
      opened && L[0] === 'models/crate.glb,models/figure.glb' && L[1] === `${longOut},sounds/tone.wav`.split(',').sort().join() && L[2].split(',').length === 7 && glbs &&
        recs[0][1] === 'originals/figure.fbx' && recs[0][2] === 'Take 001' && recs[1][1] === 'originals/crate.obj', JSON.stringify({ opened, L, glbs, recs }));
    for (const p of pages.splice(0)) await p.context().close().catch(() => {});
    await relayOff(R); R = null;

    // ---- a relay with a password (COLLAB_TOKEN): without it nothing is listed or saved and the studio asks it once; a
    // wrong one typed in the Shared dialog is never sent by the studio; the right one opens the scene without a reload;
    // then a save, an upload and a studio station in a room, and the password written nowhere
    const PASS = 'studio' + Math.floor(1000 + Math.random() * 9000) + 'scenes';   // (made here: no password is kept in the repository)
    T = await relayOn(['--static', '.', '--scenes', SC2, '--logs', logs], { COLLAB_TOKEN: PASS }, 8791);
    const tb = `http://127.0.0.1:${T.port}/`, reqs = [];   // (the studio's calls: [status, path, ?token= carried, header carried]; never their addresses)
    const P = await sopen(tb + 'index.html#studio&scene=test&edit', { name: 'Pia', size: { width: 900, height: 700 }, reqs });
    await studioIn(P);
    const held = await sUntil(P, `SRC.state === 'auth' && SRC.held && STU.listing !== 'ok'`, 20000);
    await sleep(7000);   // (and nothing more asked of the relay meanwhile)
    const n401 = () => reqs.filter(r => r[0] === 401).length;
    const p1 = await sp(P, `[SRC.scenes.length, canSave(), STU.items.size, /needs its password/.test(document.querySelector('#pane-scene').textContent)]`);
    const before = fs.readFileSync(path.join(SC2, 'test', 'layout.json'), 'utf8');
    const raw = [(await fetch(tb + 'api/scenes')).status, (await fetch(tb + 'api/scenes/test/layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studio: 1, scene: 'test', objects: [] }) })).status];
    const after = fs.readFileSync(path.join(SC2, 'test', 'layout.json'), 'utf8');
    await shot(P, 'studio-6-password-needed.png');
    check('studio with a password: a page without it lists nothing and cannot save (one refused call, then nothing more for 7 s; the Scene pane says the relay needs its password; the API answers 401 and layout.json stays as it was)',
      held && n401() === 1 && reqs.length === 1 && p1[0] === 0 && !p1[1] && p1[2] === 0 && p1[3] && raw.join() === '401,401' && before === after, JSON.stringify({ held, reqs, p1, raw, same: before === after }));
    // a wrong one typed in the Shared dialog: the shell says so, the studio sends nothing with it
    await P.evaluate(() => HOST.collab.dialog(true));
    await until(P, () => { const d = document.querySelector('#shared .sh-pass'); return !!d && !d.hidden; }, null, 5000);
    const n0 = reqs.length;
    await P.fill('#shPass', 'not' + PASS.slice(6, 10) + 'it');
    await P.click('[data-sh="pass"]');
    const wrong = await until(P, () => /not this relay's password/.test(document.querySelector('#shared').textContent), null, 8000);
    await sleep(4500);   // (the studio looks at the shell's password every 2 s)
    const quiet = reqs.length === n0 && await sp(P, 'SRC.held');
    // the right one: the scene opens, no reload, every file fetched with the password
    await P.fill('#shPass', PASS);
    await P.click('[data-sh="pass"]');
    const t0 = Date.now();
    const passOk = await sUntil(P, `SRC.state === 'ok' && !SRC.held && STU.listing === 'ok' && STU.items.size === 4 && STUDIO.ready()`, 30000);
    const tOpen = (Date.now() - t0) / 1000;
    await P.evaluate(() => HOST.collab.dialog(false));
    const files = reqs.filter(r => r[0] >= 200 && r[0] < 300 && /^\/scenes\/test\//.test(r[1]));
    check(`studio with a password: a wrong one typed in the Shared dialog is refused and the studio sends nothing with it; the right one opens the scene without a reload (${tOpen.toFixed(1)} s), every file fetched with it (a header or ?token=), still one refusal in all`,
      wrong && quiet && passOk && n401() === 1 && files.length >= 3 && files.every(r => r[2] || r[3]), JSON.stringify({ wrong, quiet, passOk, n401: n401(), files: files.length, bare: files.filter(r => !r[2] && !r[3]).map(r => r[1]) }));
    // with it: a save, an upload (tone.wav into sounds/), a studio station in a room on that relay
    await sp(P, `(setEdit(true), change(() => setRec('box001', { p: [-1.25, 0.25, -2] })), 0)`);
    await sp(P, 'saveLayout()');
    const saved = await sUntil(P, `!STU.saving && !unsaved() && !STU.saveNote`, 10000);
    const Ls = JSON.parse(fs.readFileSync(path.join(SC2, 'test', 'layout.json'), 'utf8'));
    await sp(P, `(pickTab('upload'), upPick('test'), 0)`);
    await sUntil(P, `UP.scene === 'test' && !!UP.have`, 5000);
    await P.setInputFiles('#stuFiles', [path.join(TEST, 'test', 'tone.wav')]);
    await sUntil(P, `!UP.planning && UP.rows.length === 1 && UP.rows[0].how === 'wav'`, 20000);
    await click(P, '#pane-upload [data-act="up:run"]');
    const upDone = await sUntil(P, `!UP.busy && UP.ran && UP.rows.every(r => r.state === 'done')`, 30000);
    const posts = reqs.filter(r => /^\/api\/scenes\/test\/(file|layout)$/.test(r[1]));
    const upOk = upDone && fs.existsSync(path.join(SC2, 'test', 'sounds', 'tone.wav')) && fs.existsSync(path.join(SC2, 'test', 'originals', 'tone.wav'));
    await P.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
    const open2 = await until(P, () => HOST.collab.status === 'open' && HOST.collab.via === 'relay' && !!HOST.collab.code, null, 15000);
    const code2 = await P.evaluate(() => HOST.collab.code);
    const sid2 = await P.evaluate(() => HOST.collab.add('studio', { x: 0, z: 0, yaw: 0 }));
    await P.evaluate(id => HOST.collab.follow(id), sid2);
    await studioIn(P);
    await sUntil(P, `atStation() && SRC.state === 'ok' && STU.scene === 'test' && STU.items.size === 4`, 30000);
    await sp(P, `(setEdit(true), change(() => setRec('box001', { p: [-1.5, 0.25, -2] })), 0)`);
    let roomTxt = '';
    for (let k = 0; k < 30; k++) {
      roomTxt = await (await fetch(tb + 'api/rooms/' + code2, { headers: { Authorization: 'Bearer ' + PASS } })).text();
      if (roomTxt.includes('box001') && roomTxt.includes('"scene":"test"')) break;
      await sleep(300);
    }
    const leak = await P.evaluate(t => JSON.stringify(window.__collabLog || []).includes(t) || location.href.includes(t) || JSON.stringify([...HOST.collab.internals().keys]).includes(t), PASS);
    const logTxt = fs.readdirSync(logs).map(f => fs.readFileSync(path.join(logs, f), 'utf8')).join('\n'), saveTxt = fs.readFileSync(path.join(SC2, 'test', 'layout.json'), 'utf8');
    check('studio with a password: with it a page saves layout.json, uploads (a sound into sounds/ and originals/, every upload with it) and keeps a studio station in a room on that relay; the password is in no page log, address or room key, nor in the room the relay keeps, its lines, its log files or the saved layout',
      saved && JSON.stringify(boxOf(Ls).p) === '[-1.25,0.25,-2]' && upOk && posts.length >= 3 && posts.every(r => r[0] < 300 && r[3]) && open2 && !!sid2 && roomTxt.includes('box001') &&
        roomTxt.includes('"scene":"test"') && !leak && !roomTxt.includes(PASS) && !T.out.includes(PASS) && !logTxt.includes(PASS) && !saveTxt.includes(PASS),
      JSON.stringify({ saved, box: boxOf(Ls).p, upOk, posts, rows: await sp(P, 'UP.rows.map(r => [r.state, r.msg])'), open2, sid2, roomHas: roomTxt.includes('box001'), leak, out: T.out.includes(PASS), logs: logTxt.includes(PASS), save: saveTxt.includes(PASS) }));

    // ---- the scenes in Cloudflare R2 (--scenes r2; relay/README.md, "Scenes in Cloudflare R2"), against the stand-in S3
    // (relay/s3fake.mjs, which checks every signature) on another port, so every file comes from another origin, as from
    // Cloudflare: a page and the pretend headset open the test scene from it (its models, a texture, a decoded and a
    // streamed sound: CORS, ranges and crossOrigin exercised by the browser), Save writes layout.json and .history/ there,
    // Convert to GLB and the Upload pane send their files straight into it, and the password goes nowhere
    for (const p of pages.splice(0)) await p.context().close().catch(() => {});
    await relayOff(T); T = null;
    const { startFake } = await import(new URL('../relay/s3fake.mjs', import.meta.url));
    const { typeOf } = await import(new URL('../relay/scenes.mjs', import.meta.url));
    const R2K = 'COLLABTESTKEYID', R2S = 'collab-made-up-secret-' + Math.floor(Math.random() * 1e9);
    for (let p = 8840; p < 8860 && !S3r; p++) S3r = await startFake({ port: p, bucket: 'scenes', keys: { [R2K]: R2S } }).catch(() => null);
    const walk = (d, rel = '') => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name), rel + e.name + '/') : [rel + e.name]));
    for (const rel of walk(path.join(TEST, 'test'))) S3r.put('studio/test/' + rel, fs.readFileSync(path.join(TEST, 'test', rel)), { type: typeOf(rel) });
    // (a second scene, to copy from)
    S3r.put('studio/shelf/props/statue.fbx', fs.readFileSync(path.join(TEST, 'test', 'figure.fbx')), { type: typeOf('statue.fbx') });
    S3r.put('studio/shelf/props/figure.png', fs.readFileSync(path.join(TEST, 'test', 'figure.png')), { type: 'image/png' });
    const PASS3 = 'rtwo' + Math.floor(1000 + Math.random() * 9000) + 'scenes';
    Q = await relayOn(['--static', '.', '--scenes', 'r2'], { R2_ENDPOINT: S3r.url, R2_ACCESS_KEY_ID: R2K, R2_SECRET_ACCESS_KEY: R2S, R2_BUCKET: 'scenes', R2_PREFIX: 'studio', R2_POLL: '1', COLLAB_TOKEN: PASS3 }, 8792);
    const qb = `http://127.0.0.1:${Q.port}/`, qo = `http://127.0.0.1:${Q.port}`, s3o = S3r.url;
    const fromPage = () => S3r.requests.filter(r => r.origin === qo);   // (what the page's browser asked of the bucket itself)
    const G = await sopen(qb + 'index.html#studio&scene=test&edit', { name: 'Gus', size: { width: 900, height: 700 }, token: PASS3, origin: qo });
    await studioIn(G);
    const gOk = await sUntil(G, `SRC.state === 'ok' && SRC.direct && SRC.linkTtl > 0 && STU.listing === 'ok' && STU.items.size === 4 && STUDIO.ready()`, 60000);
    const gst = await sp(G, `({ links: STU.files.every(f => f.url && f.url.startsWith(${JSON.stringify(s3o)} + '/scenes/studio/test/')), models: Object.values(STUDIO.state().models).map(m => m.state).join(),
      tex: !!(LIB.get('figure.fbx') && LIB.get('figure.fbx').texPaths.has('figure.png')), tone: (SND.get('tone.wav') || {}).state })`);   // (its figure_spec.png is missing on purpose)
    const got = fromPage().filter(r => r.method === 'GET');
    const gotPaths = ['box.glb', 'figure.fbx', 'figure.png', 'tone.wav'].map(n => got.some(r => r.url.startsWith('/scenes/studio/test/' + n + '?') && r.auth === 'query' && r.status < 400));
    check('studio from R2: a page opens the test scene from the bucket (another origin): every file by its signed link, the models with their texture and the short sound in, each fetched by the browser straight from the bucket (query-signed, CORS), none refused, no request signed in a header',
      gOk && gst.links && /^(ready,?)+$/.test(gst.models) && gst.tex && ['bytes', 'ready'].includes(gst.tone) && gotPaths.every(Boolean) && fromPage().every(r => r.status < 400 && r.auth !== 'header'),
      JSON.stringify({ gOk, gs: gst, gotPaths, bad: fromPage().filter(r => r.status >= 400 || r.auth === 'header').map(r => [r.method, r.url.split('?')[0], r.status, r.auth]) }));
    // a long sound streamed straight from the bucket: an element with crossOrigin, its ranges from the bucket
    await G.evaluate(() => HOST.audio.mute(false));
    await G.click('#explore .tabs button[data-tab="scene"]', { timeout: 5000 }).catch(() => {});
    const gl = await sp(G, `addSound('sounds/long.wav')`);
    const gStream = !!gl && await sUntil(G, `(() => { const it = STU.items.get('${gl}'); return !!(it && it.st && !it.st.el.paused && it.gt > 0); })()`, 20000);
    const gEl = gl ? await sp(G, `(() => { const it = STU.items.get('${gl}'); return !!(it && it.st && it.st.el.src.startsWith(${JSON.stringify(s3o)}) && it.st.el.crossOrigin === 'anonymous'); })()`) : false;
    const ranged = fromPage().some(r => r.url.startsWith('/scenes/studio/test/sounds/long.wav?') && r.status === 206);
    check('studio from R2: a 25 s sound placed there is streamed straight from the bucket (an element with crossOrigin anonymous, playing; its byte ranges answered 206 by the bucket)',
      gStream && gEl && ranged, JSON.stringify({ gl, gStream, gEl, ranged }));
    await G.evaluate(() => HOST.audio.mute(true));
    if (gl) await sp(G, `(deleteItem('${gl}'), 0)`);
    // Save: layout.json into the bucket, the old one into .history/
    await sp(G, `(setEdit(true), change(() => setRec('box001', { p: [-0.75, 0.25, -2] })), 0)`);
    await sp(G, 'saveLayout()');
    const gSaved = await sUntil(G, `!STU.saving && !unsaved() && !STU.saveNote`, 10000);
    const lay = S3r.objects.get('studio/test/layout.json'), gHist = S3r.keys().filter(k => k.startsWith('studio/test/.history/layout-'));
    const gL = lay ? JSON.parse(lay.body.toString()) : null;
    check('studio from R2: Save writes layout.json into the bucket (the box where it was moved, application/json), the old one kept in .history/',
      gSaved && !!gL && JSON.stringify(boxOf(gL).p) === '[-0.75,0.25,-2]' && lay.type === 'application/json' && gHist.length === 1, JSON.stringify({ gSaved, box: gL && boxOf(gL), hist: gHist.length, note: await sp(G, 'STU.saveNote') }));
    // Convert to GLB: models/figure.glb straight into the bucket (a signed PUT from the page), the figure switched
    await sp(G, `(setEdit(true), select('fig001'), X.tab = 'item', renderPanes(), 0)`);
    const gBtn = await sUntil(G, `!!document.querySelector('#pane-item [data-act="convert"][data-v="figure.fbx"]:not([disabled])')`, 5000);
    if (gBtn) await click(G, '#pane-item [data-act="convert"][data-v="figure.fbx"]');
    const gCv = gBtn && await sUntil(G, `!CV.busy && CV.done.includes('models/figure.glb')`, 90000);
    const gGlb = S3r.objects.get('studio/test/models/figure.glb');
    const gSw = await sUntil(G, `(() => { const it = STU.items.get('fig001'), E = LIB.get('models/figure.glb'); return it.rec.file === 'models/figure.glb' && !!E && E.state === 'ready' && !!it.model; })()`, 30000);
    await sp(G, 'saveLayout()');   // (so the headset below opens the scene as it is now)
    const gSaved2 = await sUntil(G, `!STU.saving && !unsaved() && !STU.saveNote`, 10000);
    // (the record as the Add list reads it for a GLB not loaded here: its first bytes, a range of the file in the bucket)
    await sp(G, `(GLBREC.delete('models/figure.glb'), glbRec('models/figure.glb'), 0)`);
    await sUntil(G, `!!glbRec('models/figure.glb')`, 10000);
    const gPut = fromPage().some(r => r.method === 'PUT' && r.auth === 'query' && r.url.startsWith('/scenes/studio/test/models/figure.glb?') && r.status === 200);
    // (a range asked of the bucket: 206, or 304 when the browser holds the file already from loading it and only checks
    // its ETag with the bucket: R2's ETag and 304 at work, the range then cut from the browser's copy)
    const gGlbGets = fromPage().filter(r => r.method === 'GET' && r.url.startsWith('/scenes/studio/test/models/figure.glb?')).map(r => [r.status, r.headers.range || '']);
    const gHead = gGlbGets.some(([st, range]) => /^bytes=0-/.test(range) && (st === 206 || st === 304));
    check('studio from R2: Convert to GLB sends models/figure.glb straight into the bucket (the page\'s signed PUT, then .../done), the figure switches to it, and its record is read with a byte range from the bucket (206, or 304 from its ETag)',
      gCv && !!gGlb && gGlb.type === 'model/gltf-binary' && gSw && gSaved2 && gPut && gHead && /models\/figure\.glb came straight into the bucket/.test(Q.out) && !/wrote models\/figure\.glb/.test(Q.out),
      JSON.stringify({ gBtn, gCv, glb: !!gGlb, gSw, gSaved2, gPut, gHead, gGlbGets, note: await sp(G, 'CV.note') }));
    // (its picture for the Add pane goes the same way: straight into the bucket by a signed PUT of the page's)
    const gPv = S3r.objects.get('studio/test/previews/models/figure.glb.jpg'), gPvPut = fromPage().some(r => r.method === 'PUT' && r.url.startsWith('/scenes/studio/test/previews/models/figure.glb.jpg?') && r.status === 200);
    check('studio from R2: Convert to GLB\'s picture goes straight into the bucket too (previews/models/figure.glb.jpg, image/jpeg, the page\'s signed PUT), listed there as kind preview',
      !!gPv && gPv.type === 'image/jpeg' && gPvPut && await sUntil(G, `PV.files.has('previews/models/figure.glb.jpg') && !!PV.files.get('previews/models/figure.glb.jpg').url`, 10000), JSON.stringify({ pv: !!gPv, type: gPv && gPv.type, gPvPut, pics: await sp(G, 'pvState().listed') }));
    // a signed link the bucket refuses (as one that lapsed while a headset was taken off): the listing read again and the
    // file fetched by its new link; links past half their life read again before a file is used
    const gRe = await sp(G, `(async () => {
      const f = STU.fileMap.get('box.glb'), good = f.url, bad = good.replace(/X-Amz-Signature=[0-9a-f]{64}/, 'X-Amz-Signature=' + '0'.repeat(64));
      f.url = bad;
      const b = await getBytes(fileUrl('box.glb'));
      const again = STU.fileMap.get('box.glb').url;
      SRC.linksAt = Date.now() - 13 * 3600e3;
      fileUrl('box.glb');
      for (let i = 0; i < 100 && Date.now() - SRC.linksAt > 60000; i++) await new Promise(r => setTimeout(r, 50));
      return { bytes: b.byteLength, again: again !== bad && /X-Amz-Signature=[0-9a-f]{64}/.test(again) && again.split('?')[0] === good.split('?')[0], fresh: Date.now() - SRC.linksAt < 60000 };
    })()`);
    const gRefused = fromPage().some(r => r.url.startsWith('/scenes/studio/test/box.glb?') && r.status === 403);
    check('studio from R2: a link the bucket refuses (403) makes the page read the listing again and fetch the file by its new link; links past half their life are read again',
      !!gRe && gRe.bytes > 1000 && gRe.again && gRe.fresh && gRefused, JSON.stringify({ gRe, gRefused }));
    // the Upload pane: a new scene, the test originals uploaded straight into the bucket (a long sound made MP3 by the
    // relay's ffmpeg from its original there, when this machine has ffmpeg)
    await sp(G, `(select(''), pickTab('upload'), 0)`);
    await click(G, '#pane-upload [data-act="up:new"]');
    await sUntil(G, `!!document.querySelector('#stuNewName')`, 5000);
    await G.evaluate(() => { const i = document.querySelector('#stuNewName'); i.value = 'made'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await click(G, '#pane-upload [data-act="up:make"]');
    const gMade = await sUntil(G, `UP.scene === 'made' && SRC.scenes.some(s => s.name === 'made')`, 10000) && !!S3r.objects.get('studio/made/.scene');
    await G.setInputFiles('#stuFiles', ['figure.fbx', 'figure.png', 'tone.wav', 'sounds/long.wav'].map(f => path.join(TEST, 'test', f)));
    await sUntil(G, `!UP.planning && UP.rows.length === 3 && UP.rows.every(r => r.how !== 'measuring')`, 30000);
    const gFf = await sp(G, 'SRC.ffmpeg');
    await click(G, '#pane-upload [data-act="up:run"]');
    const gRan = await sUntil(G, `!UP.busy && UP.ran`, 180000);
    const gRows = await sp(G, `UP.rows.map(r => [r.kind, r.state, r.msg])`);
    const gLong = gFf ? 'sounds/long.mp3' : 'sounds/long.wav';
    const gWant = ['models/figure.glb', 'sounds/tone.wav', gLong, 'originals/figure.fbx', 'originals/figure.png', 'originals/tone.wav', 'originals/long.wav'];
    const gMissing = gWant.filter(p => !S3r.objects.get('studio/made/' + p));
    const gDirect = ['models/figure.glb', 'sounds/tone.wav', 'originals/figure.fbx', 'originals/long.wav'].every(p => fromPage().some(r => r.method === 'PUT' && r.url.startsWith('/scenes/studio/made/' + p + '?') && r.status === 200));
    const gThrough = /scenes: made: wrote (models|originals|sounds\/tone)/.test(Q.out);
    const gMp3 = gFf ? (h => !!h && h.mono)(mp3Head(S3r.objects.get('studio/made/sounds/long.mp3')?.body || Buffer.alloc(0))) && /wrote sounds\/long\.mp3 into the bucket .* from originals\/long\.wav/.test(Q.out) : true;
    check(`studio from R2: the Upload pane makes a scene in the bucket and sends the test originals straight into it (each by the page's signed PUT, none through the relay), the long sound ${gFf ? 'made a mono MP3 by the relay\'s ffmpeg from its original in the bucket (from=)' : 'a mono WAV (no ffmpeg here)'}`,
      gMade && gRan && gRows.every(r => r[1] === 'done') && !gMissing.length && gDirect && !gThrough && gMp3, JSON.stringify({ gMade, gRan, gRows, gMissing, gDirect, gThrough, gMp3, gFf }));
    // the bucket refusing the page's upload (its CORS rule or a signed header it will not take, here a 403 for every
    // presigned PUT): the file goes through the relay instead, and so does the next without trying the bucket
    S3r.quirks.fail = (m, key, q) => (m === 'PUT' && q.has('X-Amz-Signature') ? 403 : 0);
    const fb1 = await sp(G, `upSend(fileApi('made', 'originals/fallback.bin', false), new Blob(['fallback bytes'])).then(j => j && j.path, e => 'error: ' + e.message)`);
    const fb2 = await sp(G, `upSend(fileApi('made', 'originals/fallback2.bin', false), new Blob(['two'])).then(j => j && j.path, e => 'error: ' + e.message)`);
    S3r.quirks = {};
    const fbPuts = p => fromPage().filter(r => r.method === 'PUT' && r.url.startsWith('/scenes/studio/made/' + p + '?')).map(r => r.status);
    check('studio from R2: an upload the bucket refuses (403 for the page\'s signed PUT) goes through the relay instead, and the next one goes there without trying the bucket',
      fb1 === 'originals/fallback.bin' && fb2 === 'originals/fallback2.bin' && S3r.objects.get('studio/made/originals/fallback.bin')?.body.toString() === 'fallback bytes' && !!S3r.objects.get('studio/made/originals/fallback2.bin') &&
        /wrote originals\/fallback\.bin into the bucket/.test(Q.out) && /wrote originals\/fallback2\.bin into the bucket/.test(Q.out) && fbPuts('originals/fallback.bin').join() === '403' && !fbPuts('originals/fallback2.bin').length,
      JSON.stringify({ fb1, fb2, puts1: fbPuts('originals/fallback.bin'), puts2: fbPuts('originals/fallback2.bin') }));
    // From another scene with R2: the page reads the FBX by its signed link, the relay has the bucket copy it and the
    // picture it names (CopyObject, signed in the header), and the page places it, its model in
    {
    const n0 = S3r.requests.length;
    await sp(G, `(setEdit(true), select(''), X.tab = 'add', FROM.open = false, act('from'), act('fromScene', 'shelf'), 0)`);
    const gl = await sUntil(G, `FROM.scene === 'shelf' && !!FROM.files && !FROM.loading`, 10000);
    await sp(G, `(copyIn('props/statue.fbx'), 0)`);
    const gc = await sUntil(G, `!!STUDIO.copied && STUDIO.copied.path === 'props/statue.fbx' && !FROM.busy`, 30000), gcp = await sp(G, 'STUDIO.copied');
    const gIn = !!(gcp && gcp.id) && await sUntil(G, `(() => { const it = STU.items.get('${gcp && gcp.id}'); return !!(it && it.model && it.E.texPaths.has('props/figure.png')); })()`, 40000);
    const cps = S3r.requests.slice(n0).filter(r => r.method === 'PUT' && r.headers['x-amz-copy-source']);
    check('studio from R2: From another scene copies a model and the picture it names inside the bucket (CopyObject, its x-amz-copy-source signed in the header), and the page places it, its model and picture in',
      gl && gc && JSON.stringify(gcp.copied) === '["props/figure.png"]' && gIn && cps.length === 2 && cps.every(r => r.auth === 'header' && r.status === 200 && /SignedHeaders=[^,]*x-amz-copy-source/.test(r.headers.authorization)) &&
        !!S3r.objects.get('studio/test/props/statue.fbx') && !!S3r.objects.get('studio/test/props/figure.png'),
      JSON.stringify({ gl, gc, gcp, gIn, cps: cps.map(r => [r.headers['x-amz-copy-source'], r.status, r.auth]) }));
    if (gcp && gcp.id) await sp(G, `(deleteItem('${gcp.id}'), select(''), 0)`);
    }
    // the pretend headset opens the scene from the bucket too
    const H2 = await sopen(qb + 'index.html#studio&scene=test', { name: 'Hal', size: { width: 320, height: 200 }, token: PASS3, origin: qo });
    await studioIn(H2);
    await H2.evaluate(installXR, { mode: 'immersive-vr', features: ['local-floor'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [0, 1.6, 0, 0] });
    await H2.evaluate(() => window.__xr.begin());
    await frames(H2, 300);
    const hR2 = await sUntil(H2, `XR.on && SRC.state === 'ok' && STU.scene === 'test' && STU.listing === 'ok' && STU.items.size === 4 && STUDIO.ready() && STU.files.every(f => f.url)`, 60000);
    const hModel = await sp(H2, `STU.items.get('fig001').rec.file`);
    check('studio from R2: the pretend headset (in VR) opens the scene from the bucket too, the figure as last saved there (its GLB)', hR2 && hModel === 'models/figure.glb', JSON.stringify({ hR2, hModel }));
    // the password nowhere: not in what reached the bucket, the relay's lines, a signed link, or a page's log or address
    const leak3 = [];
    for (const p of [G, H2]) leak3.push(await p.evaluate(t => JSON.stringify(window.__collabLog || []).includes(t) || location.href.includes(t) || JSON.stringify(HOST.cur.peek('STU.files')).includes(t), PASS3));
    check('studio from R2: the password reached neither the bucket nor any signed link, nor the relay\'s lines or a page\'s log or address; the bucket\'s secret is in no line of the relay',
      !JSON.stringify(S3r.requests).includes(PASS3) && !Q.out.includes(PASS3) && !Q.out.includes(R2S) && !/X-Amz-Signature/.test(Q.out) && leak3.every(x => !x), JSON.stringify({ leak3 }));
  } finally {
    for (const p of pages) await p.context().close().catch(() => {});
    await relayOff(R); await relayOff(T); await relayOff(Q);
    if (S3r) await S3r.close();
    for (const d of [SC, SC2, logs]) fs.rmSync(d, { recursive: true, force: true });
  }
}

// ---- the relay the main site offers (homeRound, v120; --home runs only it, also in the main run, a minute): HOME_RELAY in
// shared.js, by the page's host. A browser of its own takes the main site's name (stories.lbi-netmed.com) and the test
// place's (stories.lab.lbi-netmed.com) for this machine, the page served by the test relay (as http: the offer goes by the
// host alone), its /api turned away as GitHub Pages has none, and nothing let out to any other address (the offered
// relay's real one included). As the main site the page offers https://main.lab.lbi-netmed.com (homeRelay(), the Shared
// dialog's box naming it) and sends it nothing before a password is typed; as the test place's name and on 127.0.0.1 it
// offers none
async function homeRound() {
  const SITE = 'stories.lbi-netmed.com', LAB = 'stories.lab.lbi-netmed.com', OFFER = 'https://main.lab.lbi-netmed.com';
  const b2 = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: [...LAUNCH_ARGS, `--host-resolver-rules=MAP ${SITE} 127.0.0.1, MAP ${LAB} 127.0.0.1`] });
  // the page at host: { host, offer: homeRelay(), box: the dialog's offer shown, what: its words, sent: what it tried
  // to reach that was turned away (its own /api, any other address) }
  const look = async host => {
    const ctx = await b2.newContext({ viewport: { width: 900, height: 700 }, serviceWorkers: 'block' }), sent = [];
    await ctx.addInitScript(() => { try { localStorage.setItem('collabAutoAll', 'off'); } catch (e) { /* storage blocked */ } });
    await ctx.route(u => u.hostname !== host || u.port !== String(port) || /^\/api\//.test(u.pathname), r => { sent.push(r.request().url()); return r.abort(); });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.stack || e.message));
    try {
      await page.goto(`http://${host}:${port}/index.html#stories&peer=off&net=home`, { timeout: 90000 });
      await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
      const r = await page.evaluate(async () => {
        await HOST.collab.detect(); HOST.collab.dialog(true); await new Promise(res => setTimeout(res, 400));
        const d = document.querySelector('#shared .sh-home'), w = document.querySelector('#shared .sh-homewhat');
        return { host: location.hostname, offer: HOST.collab.homeRelay(), served: HOST.collab.relay || '', box: !!d && !d.hidden && !d.closest('[hidden]') && getComputedStyle(d).display !== 'none', what: w ? w.textContent : '' };
      });
      return Object.assign(r, { sent: sent.filter(u => !/fonts\.(googleapis|gstatic)\.com/.test(u)) });
    } finally { await ctx.close(); }
  };
  try {
    const m = await look(SITE);
    check(`home relay: the main site (${SITE}) offers ${OFFER} in the Shared dialog while no relay is in use, and sends it nothing before a password is typed`,
      m.host === SITE && m.offer === OFFER && !m.served && m.box && m.what.includes(OFFER.replace('https://', '')) && !m.sent.some(u => new URL(u).hostname !== SITE), JSON.stringify(m));
    const l = await look(LAB), h = await look('127.0.0.1');
    check(`home relay: the test place's name (${LAB}) and this machine (127.0.0.1) offer none`, l.host === LAB && !l.offer && !l.box && h.host === '127.0.0.1' && !h.offer && !h.box,
      JSON.stringify({ l, h }));
  } finally { await b2.close(); }
}

// ---- camera mode (cameraRound; --camera runs only it, also in the main run after the studio's behaviours): a room of its
// own with two story circles, a page, a pretend headset (Quest Browser's user agent) calibrated on the room's floor spots,
// and a pretend Android phone (Chrome's user agent; immersive-ar offered by a pretend navigator.xr; a pretend AR session
// that the story's own xrStart starts, through HOST.xr.request, with a viewer pose it aims, a hit test of its view straight
// ahead against the floor, the DOM overlay's state, no shared space and anchors without persistent handles). The Shared
// dialog's Camera mode button on the phone only (not on the page, not in the headset's browser); the session asked for
// hit-test and dom-overlay with #camera as its root (and depth sensing still); the overlay; nothing guided or asked by eye,
// no menu; before the floor is found Move the phone slowly; spot A and spot B aimed at and set: the phone's room is the
// headset's (origin within 1 cm, direction within 0.5 degrees) and nothing written for it (no rm); following the headset
// from the overlay: the phone's live station and story are the headset's, its rig at the station's spot, its clock the
// station's once the headset plays, the headset drawn where its presence puts it (its tag; no head or hands over a person
// in the room); the headset never draws the camera, nor counts it (lined up, heads for the studio's behaviours) and the page
// cannot follow it; the headset's menu names it a camera; the headset walks into the other circle and the phone follows; the phone walked into a circle changes
// nothing; a tap on its image presses nothing (its ray on the story's panel is the shell's with nothing to press, and
// beforexrselect is cancelled on the overlay); Panels hidden hides the story's panels on the phone only (nothing written);
// People hidden draws nobody; the subtitles strip shows the caption; nothing sent by the phone but its presence (kind cam),
// no key of the room by it; the page's list says camera; Hide and a double tap; Exit ends the session and the page follows
// on; a session its own request did not give is not the camera's; started again it lines up afresh (no marks kept or
// looked for). Then a link with &camera: its own page, Start the camera. dir: pictures (camera-*.png)
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const QUEST_UA = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/40.2.0.4.30 SamsungBrowser/4.0 Chrome/130.0.0.0 VR Safari/537.36';
// a page as a device: its user agent, and navigator.xr pretending immersive-ar is offered (ar); requestSession records what
// it is asked for and gives the page's pretend session (installXR), and every set and fx the page sends is recorded
async function openDevice(hash, size, ua, ar) {
  const phone = ua === ANDROID_UA, ctx = await browser.newContext({ viewport: size, userAgent: ua, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(ar => {
    const fake = { isSessionSupported: m => Promise.resolve(m === 'immersive-ar' ? ar : false), addEventListener() {}, removeEventListener() {},
      requestSession: (m, init) => {
        const r = init && init.domOverlay && init.domOverlay.root;
        (window.__xrAsks = window.__xrAsks || []).push({ m, feats: (init && init.optionalFeatures) || [], root: r ? r.id : '', depth: !!(init && init.depthSensing) });
        const X = window.__xr;
        return X && X.session ? Promise.resolve(X.session) : Promise.reject(new DOMException('no pretend session', 'NotSupportedError'));
      } };
    try { Object.defineProperty(Navigator.prototype, 'xr', { get: () => fake, configurable: true }); } catch (e) { /* kept */ }
    const s0 = WebSocket.prototype.send;
    WebSocket.prototype.send = function (d) {
      try { const m = JSON.parse(d); if (m && (m.t === 'set' || m.t === 'fx')) (window.__sent = window.__sent || []).push({ t: m.t, k: m.k || '', keys: m.batch ? m.batch.map(p => p[0]) : [], at: performance.now() }); } catch (e) { /* not ours */ }
      return s0.call(this, d);
    };
  }, ar);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.stack || e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(base() + 'index.html' + hash, { timeout: 90000 });
  await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
  return page;
}
async function cameraRound(dir) {
  const ROOM0 = ROOM;
  ROOM = [2, 0, 1, 0.3];   // (the room as the headset calibrates it: spot A its origin, spot B 2 m along its x axis)
  const K1 = 'qubits', K2 = HEADSET_STORY, SA = apply(ROOM, [0, 0, 0]), SB = apply(ROOM, [2, 0, 0]);
  const PL = [-1.2, 1.4, 0.6, -0.9], PF = [-1, 0.05, 0.4, -0.7];   // (the phone's local and local-floor origins: its floor estimated 5 cm off)
  const A = await open('#stories');
  await A.evaluate(async () => { await HOST.collab.detect(); HOST.collab.create(); });
  await until(A, () => HOST.collab.status === 'open', null, 10000);
  const rc = await A.evaluate(() => HOST.collab.code);
  await A.evaluate(k => { HOST.collab.add(k[0], { x: 0.5, z: -2.5, yaw: 0 }); HOST.collab.add(k[1], { x: 4, z: -2.5, yaw: 0 }); }, [K1, K2]);
  await until(A, () => HOST.collab.stations().length === 2 && !HOST.collab.internals().pending.size, null, 5000);
  const sts = await A.evaluate(() => HOST.collab.stations()), S1 = sts.find(s => s.story === K1), S2 = sts.find(s => s.story === K2);
  const H = await openDevice('#s=' + rc + '&flock', { width: 320, height: 200 }, QUEST_UA, true);
  const P = await openDevice('#s=' + rc + '&flock', { width: 412, height: 860 }, ANDROID_UA, true);
  let L = null;
  const pics = async (file, page) => { if (dir) await (page || P).screenshot({ path: path.join(dir, file) }); };
  try {
    for (const p of [H, P]) { await until(p, () => HOST.collab.status === 'open' && HOST.collab.stations().length === 2, null, 20000); await ready(p, 'flock'); }
    const hId = await H.evaluate(() => HOST.collab.id), pId = await P.evaluate(() => HOST.collab.id);
    // the Shared dialog's Camera mode button: on the phone (its dialog opens by itself as it joins by a link), not on the
    // page (no AR) nor in the headset's browser (a headset)
    const dlgCam = p => p.evaluate(async () => { HOST.collab.dialog(true); await new Promise(r => setTimeout(r, 300)); const b = document.querySelector('#shared [data-sh="camera"]');
      return { offered: HOST.collab.cameraOffered(), button: !!b, text: b ? b.closest('.sh-cam').textContent.replace(/\s+/g, ' ').trim() : '' }; });
    await until(P, () => !!document.querySelector('#shared [data-sh="camera"]'), null, 8000);
    const dP = await dlgCam(P), dA = await dlgCam(A), dH = await dlgCam(H);
    await A.evaluate(() => HOST.collab.dialog(false)); await H.evaluate(() => HOST.collab.dialog(false));
    check('camera: the Shared dialog\'s Camera mode button on a phone with AR, with a line saying what it is (none on a desktop page, none in a headset\'s browser)',
      dP.offered && dP.button && /phone's camera/.test(dP.text) && /screen recorder/.test(dP.text) && !dA.button && !dA.offered && !dH.button && !dH.offered, JSON.stringify({ dP, dA, dH }));
    // the headset: lined up on the room's floor spots (its controller's tip on each tape cross), then into the first circle
    await H.evaluate(installXR, { mode: 'immersive-ar', features: ['local-floor', 'anchors'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [...apply(ROOM, [1, 1.6, 1.5]), 0] });
    await H.evaluate(() => window.__xr.begin());
    await frames(H, 600);
    const touch = async p => { await H.evaluate(p => window.__xr.ctrl(0, p, [0, -1, 0]), p); await frames(H, 650); await H.evaluate(() => HOST.cur.peek('XR.ctrls[0].wantPress = true')); await frames(H, 150); };
    await H.evaluate(() => HOST.room.calibrate());
    await touch([SA[0], TIP, SA[2]]); await touch([SB[0], TIP, SB[2]]);
    await H.evaluate(() => window.__xr.ctrl(0, null)); await frames(H, 400);
    // a device's room in the pretend room: its origin and the yaw of its x axis
    // frames for a while on a page; the headset's frames running while fn waits for something (its presence goes out only
    // from them)
    const run = (p, ms) => p.evaluate(async ms => { window.__go = true; const t0 = performance.now(); while (window.__go && performance.now() - t0 < ms) { window.__xr.step(); await new Promise(r => setTimeout(r, 16)); } }, ms);
    const whileH = async fn => { const go = run(H, 240000); try { return await fn(); } finally { await H.evaluate(() => { window.__go = false; }); await go; } };
    const roomOf = p => p.evaluate(() => {
      const X = window.__xr, m = HOST.room.matrix(), o = new THREE.Vector3().applyMatrix4(m).applyMatrix4(X.W.local), x = new THREE.Vector3(1, 0, 0).transformDirection(m).transformDirection(X.W.local);
      return { o: o.toArray().map(v => +v.toFixed(4)), yaw: Math.atan2(-x.z, x.x), src: HOST.room.src, aligned: HOST.room.aligned };
    });
    const rH = await roomOf(H);
    check('camera: the headset is lined up on the room\'s floor spots (its room the pretend room\'s)', rH.aligned && rH.src === 'marks' && dist(rH.o, SA) < 0.01 && angle(rH.yaw, ROOM[3]) < 0.005, JSON.stringify(rH));
    const inH = await walk(H, S1, K1, 0, 150000);
    check('camera: the headset walks into the first circle', inH && await H.evaluate(id => HOST.collab.mine() === id, S1.id));
    // the phone: Camera mode pressed in its dialog starts the story's AR session (as Enter AR does)
    await P.evaluate(installXR, { phone: true, guide: true, mode: 'immersive-ar', features: ['local-floor', 'anchors', 'hit-test', 'dom-overlay'], local: PL, floor: PF, shared: SHARED, sharedId: '', head: [...apply(ROOM, [1, 1.4, 2]), 0] });
    await P.evaluate(() => { window.__xr.noFloor = true; HOST.renderer.xr.setSession = async () => {}; window.__sent = []; HOST.collab.dialog(true); });
    await until(P, () => !!document.querySelector('#shared [data-sh="camera"]'), null, 4000);
    await P.evaluate(() => document.querySelector('#shared [data-sh="camera"]').click());
    const on = await until(P, () => HOST.collab.cameraMode() && !!HOST.session, null, 10000);
    await frames(P, 600);
    const ask = await P.evaluate(() => (window.__xrAsks || []).slice(-1)[0]), c0 = await P.evaluate(() => HOST.collab.camera());
    const ov = await P.evaluate(() => { const e = document.getElementById('camera'); return { shown: !!e && !e.hidden, live: !!e && e.classList.contains('live'), dlg: !document.getElementById('shared').hidden, aim: !!e && e.classList.contains('aim'),
      step: e && e.querySelector('.cam-step').textContent, set: e && e.querySelector('[data-cam="set"]').disabled, mode: HOST.mode, phone: HOST.collab.phone ? HOST.collab.phone() : null }; });
    check('camera: Camera mode starts the story\'s AR session through HOST.xr.request, asking also for hit-test and dom-overlay (its root #camera, once; not a phone AR\'s #xrPhone, whose menu button never shows) with depth sensing still asked',
      on && !!ask && ask.m === 'immersive-ar' && ask.feats.includes('hit-test') && ask.feats.filter(f => f === 'dom-overlay').length === 1 && ask.feats.includes('depth-sensing') && ask.root === 'camera' && ask.depth && ov.mode === 'immersive-ar' &&
        !(ov.phone && (ov.phone.button || ov.phone.root || ov.phone.ar)),
      JSON.stringify({ on, ask, ov }));
    check('camera: the overlay shows (the dialog closed): before the floor is found, the crosshair and "Move the phone slowly", Set spot A greyed',
      ov.shown && ov.live && !ov.dlg && ov.aim && /Move the phone slowly so it finds the floor/.test(ov.step) && ov.set === true && c0.on && c0.calib === 'a' && !c0.lined, JSON.stringify({ ov, c0 }));
    const mA = await A.evaluate(id => { const m = HOST.collab.members.find(x => x.id === id); return m && { kind: m.kind, name: m.name }; }, pId);
    check('camera: the page hears the phone as a camera (kind cam, named Camera)', !!mA && mA.kind === 'cam' && mA.name === 'Camera', JSON.stringify(mA));
    // aimed at spot A, then spot B: the floor found, Set spot A and Set spot B
    // the phone carried smoothly to eye, looking at target (a frame every 4 cm or so: a pose that jumps is taken for the
    // origin moving, which starts a calibration again, as it should on a phone)
    const glide = (eye, target) => P.evaluate(async ([e1, t1]) => {
      const X = window.__xr, V = THREE.Vector3, p0 = new V().setFromMatrixPosition(X.W.head), t0 = p0.clone().addScaledVector(new V(0, 0, -1).transformDirection(X.W.head), 1.5);
      const e = new V(...e1), t = new V(...t1), n = Math.max(12, Math.ceil(Math.max(p0.distanceTo(e), t0.distanceTo(t)) / 0.04));
      for (let k = 1; k <= n; k++) { const f = k / n; X.look(p0.clone().lerp(e, f).toArray(), t0.clone().lerp(t, f).toArray()); X.step(); await new Promise(r => setTimeout(r, 16)); }
    }, [eye, target]);
    const aimAt = async p => { await glide([p[0] + 0.35, 1.35, p[2] + 0.85], p); await frames(P, 700); };
    // Set spot A (or B) tapped between two of the phone's frames, as on a phone whose frames run all the time (the aim is
    // taken only while fresh: a test that pauses the frames, a picture say, would find it stale)
    const setSpot = () => P.evaluate(async () => { const X = window.__xr; X.step(); X.step(); document.querySelector('#camera [data-cam="set"]').click(); for (let k = 0; k < 4; k++) { X.step(); await new Promise(r => setTimeout(r, 16)); } });
    const hitW = () => P.evaluate(() => { const c = HOST.collab.camera(), X = window.__xr; return c.hit && new THREE.Vector3(...c.hit).applyMatrix4(X.W.local).toArray(); });
    await P.evaluate(() => { window.__xr.noFloor = false; });
    await aimAt(SA);
    const wA = await P.evaluate(() => HOST.collab.camera().words), hA = await hitW(), ret = await P.evaluate(() => HOST.collab.overlay().camRet.visible);
    await pics('camera-1-aim.png');
    await setSpot(); await frames(P, 200);
    const c1 = await P.evaluate(() => HOST.collab.camera());
    await aimAt(SB);
    await setSpot(); await frames(P, 500);
    const c2 = await P.evaluate(() => HOST.collab.camera()), rP = await roomOf(P);
    check('camera: aimed at spot A (the floor found: "Aim at spot A and tap Set spot A", the hit on the spot, a ring on the floor there), Set spot A, then spot B: the phone is lined up',
      wA && /Aim at spot A and tap Set spot A/.test(wA[1]) && !!hA && dist(hA, SA) < 0.005 && ret && c1.calib === 'b' && c2.lined && !c2.calib, JSON.stringify({ wA, hA, ret, c1, c2 }));
    check('camera: the phone\'s room is the headset\'s (origin within 1 cm, direction within 0.5 degrees), its floor the spots\' (its own 5 cm off)',
      rP.aligned && dist(rP.o, rH.o) < 0.01 && angle(rP.yaw, rH.yaw) < 0.5 * Math.PI / 180, JSON.stringify({ rP, rH }));
    const g = await P.evaluate(() => ({ guide: HOST.collab.guide().open, flow: HOST.collab.guide().flow, eye: HOST.collab.eye().ask, menu: HOST.collab.menu, note: HOST.collab.overlay().note.mesh.visible }));
    const rm = (await roomInfo(rc)).keys.rm;
    check('camera: no room setup guide, startup flow, check by eye, menu or notice in 3D on the phone; the room\'s floor (rm) is the headset\'s, not written by the phone',
      !g.guide && !g.flow && !g.eye && !g.menu && !g.note && !!rm && rm.by === hId, JSON.stringify({ g, rm }));
    // following the headset: its station, its story, the rig at its spot, the station's clock, the headset drawn
    await P.evaluate(() => document.querySelector('#camera [data-cam="follow"]').click());
    await until(P, id => !!document.querySelector(`#camera [data-cam="who:${id}"]`), hId, 3000);
    const list = await P.evaluate(() => [...document.querySelectorAll('#camera .cam-list button')].map(b => b.dataset.cam));
    await P.evaluate(id => document.querySelector(`#camera [data-cam="who:${id}"]`).click(), hId);
    // (the headset's frames run meanwhile: its presence, which says where it is, goes out only from them)
    const f1 = await whileH(async () => await until(P, k => HOST.curKey === k, K1, 30000) && await ready(P, K1, 120000));
    if (f1) { await P.evaluate(() => HOST.cur.peek('xrAdopt()')); }
    await frames(P, 600);
    const c3 = await P.evaluate(() => HOST.collab.camera()), rig = await rigOf(P), want = rigAt(S1, PL);
    check('camera: the overlay lists the people in a headset and the circles; following the headset, the phone\'s live station is the headset\'s, its story loaded there and its rig at the station\'s spot',
      list.includes('who:' + hId) && list.includes('st:' + S1.id) && list.includes('st:' + S2.id) && list.includes('none') && f1 && c3.follow === 'person:' + hId && c3.station === S1.id &&
      dist(rig.slice(0, 3), want.slice(0, 3)) < 0.03 && angle(rig[3], want[3]) < 0.02, JSON.stringify({ list, f1, c3, rig, want }));
    await peek(H, 'APP.playing || APP.togglePlay()');
    await Promise.all([frames(H, 2500), frames(P, 2500)]);
    const clk = await P.evaluate(id => { const v = HOST.collab.val('st.' + id + '.play'), t = HOST.cur.peek('APP.t'); return { key: HOST.curKey, live: HOST.collab.live() && HOST.collab.live().id, v, t, exp: v && (v.playing ? v.t + (HOST.collab.now() - v.at) / 1000 : v.t), playing: HOST.cur.peek('APP.playing') }; }, S1.id);
    // where the phone draws the headset (its presence, room coordinates), and what the headset makes of the phone
    await Promise.all([run(H, 1500), run(P, 1500)]);
    const drawn = await P.evaluate(id => { const o = HOST.collab.overlay().people.get(id); return o && { g: o.g.visible, p: o.e && o.e.p.toArray(), avatar: o.avatar.visible, tag: o.tag.visible || o.sign.visible }; }, hId);
    const hSide = await H.evaluate(id => ({ drawn: HOST.collab.overlay().people.has(id), heads: (HOST.collab.heads() || { list: [] }).list.map(x => x.id), lined: HOST.collab.guide().lined, pres: !!HOST.collab.people().get(id), cam: !!(HOST.collab.people().get(id) || {}).cam }), pId);
    const aFollow = await A.evaluate(id => HOST.collab.followPerson(id), pId);
    check('camera: the phone plays on the station\'s clock once the headset plays (within 1 s)', !!clk.v && clk.v.playing && clk.playing && Math.abs(clk.t - clk.exp) < 1, JSON.stringify(clk));
    check('camera: the phone draws the headset where its presence puts it (its name tag; no head or hands over a person in the room, as a headset in AR)',
      !!drawn && drawn.g && drawn.tag && !drawn.avatar && dist(drawn.p, [S1.x, 1.6, S1.z]) < 0.05, JSON.stringify(drawn));
    check('camera: the headset hears the phone as a camera and never counts it: not drawn, not among the heads at its circle, lined up 1 of 1; the page cannot follow it',
      hSide.pres && hSide.cam && !hSide.drawn && hSide.heads.join() === hId && hSide.lined[1] === 1 && aFollow === false, JSON.stringify({ hSide, aFollow }));
    // the headset's menu (its Circles tab, the people): the phone as a camera, never a headset here or elsewhere (what its
    // canvas is given to write is read as it draws)
    const mrow = await H.evaluate(async () => {
      const X = window.__xr, seen = [], f0 = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { seen.push(String(t)); return f0.call(this, t, ...a); };
      try { HOST.collab.panelOpen(true); HOST.collab.menuTab('circles'); for (let k = 0; k < 3; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); } }
      finally { CanvasRenderingContext2D.prototype.fillText = f0; HOST.collab.panelOpen(false); X.step(); }
      const i = seen.indexOf('Camera');
      return { name: i >= 0, row: i >= 0 ? seen.slice(i, i + 2) : [], here: seen.filter(x => /^, (here|elsewhere)/.test(x)) };
    });
    check('camera: the headset\'s menu lists the phone among the people as a camera (camera (filming)), never as a headset here or elsewhere',
      mrow.name && mrow.row.length === 2 && /^camera \(filming\)/.test(mrow.row[1]) && !mrow.here.length, JSON.stringify(mrow));
    await pics('camera-2-following.png');
    // the headset walks into the other circle: the phone follows; the phone walked into a circle changes nothing
    const inH2 = await walk(H, S2, K2, 0, 150000);
    const f2 = await whileH(async () => await until(P, k => HOST.curKey === k, K2, 30000) && await ready(P, K2, 120000));
    if (f2) await P.evaluate(() => HOST.cur.peek('xrAdopt()'));
    await frames(P, 500);
    const c4 = await P.evaluate(() => HOST.collab.camera());
    check('camera: the headset walks into the other circle and the phone follows (its station and story)', inH2 && f2 && c4.station === S2.id && c4.follow === 'person:' + hId, JSON.stringify({ inH2, f2, c4 }));
    { const w = apply(ROOM, [S1.x, 1.5, S1.z]); await glide(w, [w[0], 0, w[2] - 1.5]); }
    await Promise.all([run(H, 2500), run(P, 2500)]);
    const c5 = await P.evaluate(() => HOST.collab.camera());
    check('camera: the phone walked into the first circle (standing in it 2.5 s) changes nothing', c5.station === S2.id && c5.follow === 'person:' + hId, JSON.stringify(c5));
    // a tap on the image presses nothing: a screen's ray on the story's own panel is the shell's, with nothing to press; the
    // overlay cancels every select (beforexrselect)
    { const w = apply(ROOM, [S2.x, 1.5, S2.z + 0.4]); await glide(w, [w[0], 1.2, w[2] - 2]); }
    await frames(P, 300);
    const tap = await P.evaluate(async () => {
      const X = window.__xr, V = THREE.Vector3, main = HOST.cur.peek('XR.main.mesh'), t = main.getWorldPosition(new V());
      const head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert()), d = t.clone().sub(head).normalize();
      X.aim(0, new THREE.Matrix4().compose(head, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), d), new V(1, 1, 1)));
      X.session.inputSources[0].targetRayMode = 'screen';
      const c = HOST.cur.peek('XR.ctrls')[0], on = new THREE.Raycaster(head, d).intersectObject(main).length > 0, was = HOST.cur.peek('[APP.mode, APP.playing].join()');
      X.step(); X.step();
      const hov = c.hover && c.hover.kind;
      c.wantPress = true; X.step(); const press = c.press; X.step();
      X.ctrl(0, null); X.session.inputSources.length = 0;
      const ev = el => { const e = new Event('beforexrselect', { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
      const root = document.getElementById('camera');
      return { visible: main.visible, on, hov, press: !!press, same: HOST.cur.peek('[APP.mode, APP.playing].join()') === was, image: ev(root), button: ev(root.querySelector('[data-cam="hide"]')) };
    });
    check('camera: a tap on the image presses nothing (a screen ray on the story\'s panel is the shell\'s, nothing pressed; beforexrselect cancelled on the overlay and its buttons)',
      tap.visible && tap.on && tap.hov === 'shell' && !tap.press && tap.same && tap.image && tap.button, JSON.stringify(tap));
    // Panels hidden: the story's panels hidden on the phone only, nothing written; People hidden: nobody drawn
    // (the pretend session never presents, so the story's own xrUpdate, which shows and hides its panels every frame, is
    // run here, as other rounds do)
    const panels = p => p.evaluate(() => HOST.cur.peek('xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS), [XR.main.mesh.visible, XR.foot.mesh.visible].join()'));
    await P.evaluate(() => document.querySelector('#camera [data-cam="panels"]').click());
    await Promise.all([run(H, 600), run(P, 600)]);
    const pn = { phone: await panels(P), headset: await panels(H), ui: (await roomInfo(rc)).keys['st.' + S2.id + '.ui'] || null, label: await P.evaluate(() => document.querySelector('#camera [data-cam="panels"]').textContent),
      // (the station's own panels, as the page's dialog reads and sets them, unchanged on both: the camera's are its own)
      st: [await P.evaluate(id => HOST.collab.stationPanels(id), S2.id), await H.evaluate(id => typeof HOST.collab.setStationPanels === 'function' && HOST.collab.stationPanels(id), S2.id)] };
    await pics('camera-3-panels-hidden.png');
    await P.evaluate(() => document.querySelector('#camera [data-cam="panels"]').click()); await frames(P, 400);
    pn.back = await panels(P);
    check('camera: Panels hidden hides the story\'s panels on the phone only (the headset at the same circle keeps them; nothing written), and shown again', pn.phone === 'false,false' && pn.headset === 'true,true' && !pn.ui &&
      pn.label === 'Panels: hidden' && pn.back === 'true,true' && pn.st.join() === 'shown,shown', JSON.stringify(pn));
    await P.evaluate(() => document.querySelector('#camera [data-cam="people"]').click());
    await Promise.all([run(H, 600), run(P, 600)]);
    const pp = await P.evaluate(id => { const o = HOST.collab.overlay().people.get(id); return { drawn: !!(o && o.g.visible), label: document.querySelector('#camera [data-cam="people"]').textContent }; }, hId);
    await P.evaluate(() => document.querySelector('#camera [data-cam="people"]').click());
    await Promise.all([run(H, 600), run(P, 600)]);
    pp.back = await P.evaluate(id => { const o = HOST.collab.overlay().people.get(id); return !!(o && o.g.visible); }, hId);
    check('camera: People hidden draws nobody, shown again the headset', !pp.drawn && pp.label === 'People: hidden' && pp.back, JSON.stringify(pp));
    // the subtitles: the caption on show as a strip at the foot (the headset plays its circle's story)
    await peek(H, 'APP.playing || APP.togglePlay()');
    await P.evaluate(() => document.querySelector('#camera [data-cam="subs"]').click());
    let sub = null;
    for (let k = 0; k < 12; k++) {
      await Promise.all([run(H, 700), run(P, 700)]);
      sub = await P.evaluate(() => { const s = document.querySelector('#camera .cam-sub'); return { shown: !s.hidden, text: s.textContent, cap: HOST.collab.caption().text, label: document.querySelector('#camera [data-cam="subs"]').textContent }; });
      if (sub.shown && sub.text) break;
    }
    await pics('camera-4-subtitles.png');
    check('camera: Subtitles on shows the narration\'s caption as a strip at the foot', sub.label === 'Subtitles: on' && sub.shown && !!sub.text, JSON.stringify(sub));
    // nothing sent by the phone but its presence, and no key of the room by it
    const sent = await P.evaluate(id => (window.__sent || []).filter(m => !(m.t === 'fx' && m.k === 'p.' + id)), pId);
    const presN = await P.evaluate(id => (window.__sent || []).filter(m => m.t === 'fx' && m.k === 'p.' + id).length, pId), info = await roomInfo(rc);
    const byP = Object.entries(info.keys).filter(([, e]) => e.by === pId).map(([k]) => k), quietP = await P.evaluate(() => HOST.collab.camera().quiet);
    check('camera: the phone sends nothing but its presence (no write to the room, no effect), and no key of the room is its', !sent.length && presN > 5 && !byP.length, JSON.stringify({ sent: sent.slice(0, 8), presN, byP, quietP }));
    // the page's list: a camera, with no Follow
    const row = await A.evaluate(async id => { HOST.collab.dialog(true); await new Promise(r => setTimeout(r, 400));
      const li = [...document.querySelectorAll('#shared .sh-people li')].find(l => /Camera/.test(l.textContent)); const r = li ? { text: li.textContent.replace(/\s+/g, ' ').trim(), follow: !!li.querySelector('[data-sh^="who:"]') } : null; HOST.collab.dialog(false); return r; }, pId);
    check('camera: the page\'s people list shows the phone as a camera, with no Follow', !!row && /camera \(filming\)/.test(row.text) && !row.follow, JSON.stringify(row));
    // Hide, and a double tap on the image brings the controls back (a single one does not)
    const vis = () => P.evaluate(() => { const e = document.getElementById('camera'); return { hid: e.classList.contains('hid'), bar: getComputedStyle(e.querySelector('.cam-bar')).display !== 'none', state: HOST.collab.camera().hidden }; });
    const tapImg = () => P.evaluate(() => { const e = document.getElementById('camera'); e.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 200, clientY: 500 })); });
    await P.evaluate(() => document.querySelector('#camera [data-cam="hide"]').click());
    const h1 = await vis(); await tapImg(); await sleep(600); await tapImg(); const h2 = await vis(); await sleep(600);
    await tapImg(); await sleep(120); await tapImg(); const h3 = await vis();
    check('camera: Hide hides the controls; two taps 0.6 s apart do not bring them back, a double tap does', h1.hid && !h1.bar && h1.state && h2.state && !h3.hid && h3.bar && !h3.state, JSON.stringify({ h1, h2, h3 }));
    // Exit: the session ends, camera mode off, and the page follows on as a page does (the headset's station)
    await P.evaluate(() => document.querySelector('#camera [data-cam="exit"]').click());
    await sleep(400);
    const x = await P.evaluate(() => { const e = document.getElementById('camera'); return { ended: window.__xr.ended || 0, session: !!HOST.session, cam: HOST.collab.cameraMode(), shown: !e.hidden || getComputedStyle(e).display !== 'none', c: HOST.collab.camera(), key: HOST.curKey }; });
    const mA2 = await until(A, id => { const m = HOST.collab.members.find(q => q.id === id); return !!m && m.kind === 'desktop' && m.name !== 'Camera'; }, pId, 8000);
    check('camera: Exit ends the session (camera mode off, its overlay gone, a page again for the room) and the page follows the headset on', x.ended === 1 && !x.session && !x.cam && !x.shown &&
      x.c.follow === 'person:' + hId && x.c.station === S2.id && x.key === K2 && mA2, JSON.stringify({ x, mA2 }));
    // only the session its own request gave is the camera's: Start pressed, then another AR session (not through the
    // request: here set directly, Enter AR stood aside) is not taken, and Start's wish goes with it
    const other = await P.evaluate(() => {
      const b = document.getElementById('btnAR'), n0 = window.__collabLog.n || 0;   // (the log keeps its last 1000: by number)
      if (b) b.id = 'btnAR-aside';
      let r;
      try {
        const asked = HOST.collab.cameraStart('test'), want = HOST.collab.camera().want;
        HOST.mode = 'immersive-ar'; HOST.session = window.__xr.session;
        r = { asked, want, on: HOST.collab.cameraMode(), after: HOST.collab.camera().want, phase: HOST.collab.camera().phase, told: window.__collabLog.some(e => e.n > n0 && e.ev === 'camera: not this session') };
      } finally { HOST.session = null; HOST.mode = null; if (b) b.id = 'btnAR'; }
      r.off = !HOST.collab.cameraMode() && !HOST.collab.camera().want;
      return r;
    });
    check('camera: an AR session its own request did not give is not the camera\'s (Start\'s wish dropped with it)',
      other.asked && other.want && !other.on && !other.after && other.told && other.off, JSON.stringify(other));
    // started again: it lines up afresh (Set spot A at once), with no marks kept from before; marks that a browser kept with
    // handles (planted here: a phone's Chrome keeps none) are let go, never looked for
    await P.evaluate(installXR, { phone: true, guide: true, mode: 'immersive-ar', features: ['local-floor', 'anchors', 'hit-test', 'dom-overlay'], local: PL, floor: PF, shared: SHARED, sharedId: '', head: [...apply(ROOM, [1, 1.4, 2]), 0] });
    const i1 = await P.evaluate(() => {
      const R = HOST.room.internals(), X = window.__xr;
      X.handles.set('old1', new THREE.Matrix4()); X.handles.set('old2', new THREE.Matrix4().makeTranslation(2, 0, 0));
      R.saved = { v: 2, a: [0, 0.02, 0], b: [2, 0.02, 0], at: 1, anchors: ['old1', 'old2'], f: 1 };
      localStorage.setItem('roomFrame', JSON.stringify(R.saved));
      HOST.renderer.xr.setSession = async () => {}; HOST.collab.dialog(true);
      return window.__collabLog.n || 0;
    });
    await until(P, () => !!document.querySelector('#shared [data-sh="camera"]'), null, 4000);
    await P.evaluate(() => document.querySelector('#shared [data-sh="camera"]').click());
    const on2 = await until(P, () => HOST.collab.cameraMode() && !!HOST.session, null, 10000);
    await frames(P, 600);
    const again = await P.evaluate(i1 => {
      const R = HOST.room.internals(), c = HOST.collab.camera(), L = window.__collabLog.filter(e => e.n > i1);
      return { on: c.on, calib: c.calib, lined: c.lined, state: HOST.room.state, saved: R.saved, tried: !!R.anchorTried, stored: localStorage.getItem('roomFrame'),
        kept: ['old1', 'old2'].filter(u => window.__xr.handles.has(u)), looked: L.filter(e => /anchors (not found|found again)|^restor/.test(e.ev)).map(e => e.ev) };
    }, i1);
    check('camera: started again, it lines up afresh (Set spot A at once, not lined up), no marks kept or looked for (the old handles let go, nothing stored)',
      on2 && again.on && again.calib === 'a' && !again.lined && again.state === 'mark-a' && again.saved === null && !again.tried && again.stored === null && !again.kept.length && !again.looked.length,
      JSON.stringify(again));
    await P.evaluate(() => document.querySelector('#camera [data-cam="exit"]').click());
    await until(P, () => !HOST.session && !HOST.collab.cameraMode(), null, 5000);
    // a link with &camera: its own page with one big button, Start the camera (the dialog does not open)
    L = await openDevice('#s=' + rc + '&camera&flock', { width: 412, height: 860 }, ANDROID_UA, true);
    const lk = await until(L, () => { const e = document.getElementById('camera'), b = e && e.querySelector('.cam-go'); return !!(e && !e.hidden && b && !b.disabled && !b.hidden); }, null, 20000);
    const lv = await L.evaluate(() => { const e = document.getElementById('camera'); return { pre: e.classList.contains('pre'), go: e.querySelector('.cam-go').textContent, dlg: !document.getElementById('shared').hidden }; });
    await pics('camera-5-link.png', L);
    check('camera: a link with &camera opens its own page: Start the camera (once joined; the dialog not opened)', lk && lv.pre && lv.go === 'Start the camera' && !lv.dlg, JSON.stringify(lv));
  } finally {
    ROOM = ROOM0;
    for (const p of [H, P]) await p.evaluate(() => window.__xr && window.__xr.end()).catch(() => {});
    for (const p of [A, H, P, L].filter(Boolean)) await p.context().close().catch(() => {});
  }
}

let code = '', NST = 0;   // the room's code; how many stories (one station each after Arrange all)
let slidesSeen = false;   // the slideshow's stop and Next in a room: checked on the first story followed
try {
  await startRelay(relayPort);
  main: {   // (--p2p: only the peer-to-peer part, after this block; --near: only rooms on this network)
  if (P2P || NEAR_ONLY) break main;
  if (DESIGN_ONLY) { await designOnly(); break main; }
  if (FOLLOW_ONLY) { await followOnly(); break main; }
  if (CIRCLES_ONLY) { await circlesOnly(); break main; }
  if (SMOOTH_ONLY) { await smoothRound(); break main; }
  if (CODE_ONLY) { await codeRound(); break main; }
  if (ALL_ONLY) { await allRound(); break main; }
  if (GUIDE_ONLY) { await guideRound(); break main; }
  if (TOKEN_ONLY) { await tokenRound(); break main; }
  if (STUDIO_ONLY) { await studioRound(shots); break main; }
  if (ASK_ONLY) { if (shots) fs.mkdirSync(shots, { recursive: true }); await askRound(shots); break main; }
  if (SCENES_ONLY) { await scenesRound(); break main; }
  if (HOME_ONLY) { await homeRound(); break main; }
  if (MENUS_ONLY) { if (shots) fs.mkdirSync(shots, { recursive: true }); await menusRound(shots); break main; }
  if (BEHAVE_ONLY) { await behaveRound(); break main; }
  if (STANDBY_ONLY) { await standbyRound(); break main; }
  if (NARR_ONLY) { await narrationRound(); break main; }
  if (WALK_ONLY) { await walkRound(); break main; }
  if (CAMERA_ONLY) { if (shots) fs.mkdirSync(shots, { recursive: true }); await cameraRound(shots); break main; }
  if (TRACKERS_ONLY) { if (shots) fs.mkdirSync(shots, { recursive: true }); await trackersRound(shots); break main; }
  // ------------------------------------------------------------ rooms --
  const A = await open('#stories');
  check('a page served by the relay finds it', await A.evaluate(async () => { await HOST.collab.detect(); return HOST.collab.relay === location.origin; }));
  await A.evaluate(() => HOST.collab.create());
  check('a page starts a room', await until(A, () => HOST.collab.status === 'open' && /^#s=[A-Z]{3}$/.test(location.hash), null, 10000));
  code = await A.evaluate(() => HOST.collab.code);
  await A.evaluate(() => HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }));
  check('Arrange all makes a station for every story', await until(A, () => HOST.collab.stations().length === HOST.list.length && !HOST.collab.internals().pending.size, null, 3000));
  const B = await open('#s=' + code), C = await open('#s=' + code);
  const st7 = p => until(p, () => HOST.collab.status === 'open' && HOST.collab.stations().length === HOST.list.length, null, 20000);
  await st7(B); await st7(C);
  const sts = p => p.evaluate(() => JSON.stringify(HOST.collab.stations()));
  const sa = await sts(A);
  check('three pages in the room see the same stations', sa === await sts(B) && sa === await sts(C));
  const others = [B, C];
  // Arrange all (from the room's origin, facing -z): a row of half the stories (rounded up) 1.2 m ahead and the rest 2.6 m behind,
  // 2.4 m apart, all facing away (so a station's own 1.1 m zone never touches another's)
  const arranged = JSON.parse(sa), keys = await A.evaluate(() => HOST.list.map(m => m.key));
  NST = keys.length;
  const front = Math.ceil(NST / 2), wantSpot = i => (i < front ? [(i - (front - 1) / 2) * 2.4, -1.2] : [(i - front - (NST - front - 1) / 2) * 2.4, -3.8]);
  const spotsOk = keys.every((k, i) => { const s = arranged.find(x => x.story === k); return s && near([s.x, s.z], wantSpot(i), 1e-3) && Math.abs(s.yaw) < 1e-3; });
  let closest = Infinity;
  for (const a of arranged) for (const b of arranged) if (a !== b) closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
  check(`Arrange all: two rows (${Math.ceil(NST / 2)} + ${Math.floor(NST / 2)}), spots 2.4 m apart, the rows 2.6 m apart, all facing away from you`, spotsOk && closest > 2.2 - 1e-6,
    arranged.map(s => `${s.story} ${s.x},${s.z} ${s.yaw}`).join('; '));
  // a mistyped code (or an old link) makes no room: the page says so and stays out
  const E = await open('#stories');
  const bad = 'QQZ' === code ? 'QQY' : 'QQZ';
  await E.evaluate(async c => { await HOST.collab.detect(); HOST.collab.join(c); }, bad);
  const out = await until(E, () => !HOST.collab.joined && /no room/i.test(HOST.collab.internals().note), null, 8000);
  const listed = (await (await fetch(base() + 'api/rooms')).json()).some(r => r.code === bad);
  check('a code with no room behind it makes no room: the page says so and stays out', out && !listed,
    `${await E.evaluate(() => HOST.collab.status + ' ' + HOST.collab.internals().note)}, listed ${listed}`);
  await E.context().close();
  // Remove asks first ("Remove for everyone?"), and only a second press removes the station, for everyone
  const rmId = await stationOf(A, 'airports');
  await A.evaluate(() => HOST.collab.dialog(true));
  await sleep(200);
  // (both presses in one go, with no wait between: a page busy building shaders in software can block for
  // longer than the 3 s the first press lasts, which would only arm Remove again)
  const rm = await A.evaluate(id => {
    const q = () => document.querySelector(`[data-sh="remove:${id}"]`);
    q().click();
    const text = q() && q().textContent, still = !!HOST.collab.station(id);
    q().click();
    return { text, still };
  }, rmId);
  const gone = await until(B, id => !HOST.collab.station(id), rmId, 5000);
  check('Remove asks first (Remove for everyone?), and a second press removes the station for everyone', rm.text === 'Remove for everyone?' && rm.still && gone,
    `first press: ${rm.text}, still there ${rm.still}, then gone ${gone} (A: ${await A.evaluate(id => !!HOST.collab.station(id), rmId)})`);
  // the room map: a station's dot dragged moves it, its square dragged turns it, for everyone
  const mapT = await A.evaluate(async () => {
    const cv = document.querySelector('#shMap'), s = HOST.collab.stations().find(x => x.story === 'proteins') || HOST.collab.stations()[0];
    for (let k = 0; k < 20 && !HOST.collab.mapView(); k++) await new Promise(r => setTimeout(r, 100));   // drawn by the pump
    const tf = HOST.collab.mapView();
    if (!tf || !s) return { err: 'no map' };
    const r = cv.getBoundingClientRect(), ev = (type, x, z) => cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + tf.X(x), clientY: r.top + tf.Y(z), pointerId: 7, buttons: type === 'pointerup' ? 0 : 1, bubbles: true }));
    ev('pointerdown', s.x, s.z); ev('pointermove', s.x + 0.5, s.z + 0.3); await new Promise(r => setTimeout(r, 150)); ev('pointermove', s.x + 1, s.z + 0.6); ev('pointerup', s.x + 1, s.z + 0.6);
    const m = HOST.collab.station(s.id), tf2 = HOST.collab.mapView(), r2 = cv.getBoundingClientRect(), a = s.yaw + Math.PI / 2;
    const at = (x, z) => ({ clientX: r2.left + tf2.X(x), clientY: r2.top + tf2.Y(z), pointerId: 8, bubbles: true });
    cv.dispatchEvent(new PointerEvent('pointerdown', at(m.x - 1.4 * Math.sin(m.yaw), m.z - 1.4 * Math.cos(m.yaw))));
    cv.dispatchEvent(new PointerEvent('pointermove', Object.assign(at(m.x - 1.4 * Math.sin(a), m.z - 1.4 * Math.cos(a)), { buttons: 1 })));
    cv.dispatchEvent(new PointerEvent('pointerup', at(m.x - 1.4 * Math.sin(a), m.z - 1.4 * Math.cos(a))));
    const after = HOST.collab.station(s.id), lockB = document.querySelector('[data-sh="lock"]');
    lockB.click(); await new Promise(r => setTimeout(r, 300));
    const tf3 = HOST.collab.mapView(), r3 = cv.getBoundingClientRect(), at3 = (x, z, b) => ({ clientX: r3.left + tf3.X(x), clientY: r3.top + tf3.Y(z), pointerId: 9, buttons: b, bubbles: true });
    cv.dispatchEvent(new PointerEvent('pointerdown', at3(after.x, after.z, 1))); cv.dispatchEvent(new PointerEvent('pointermove', at3(after.x - 1, after.z, 1)));
    cv.dispatchEvent(new PointerEvent('pointerup', at3(after.x - 1, after.z, 0)));
    const still = HOST.collab.station(s.id), arrOff = document.querySelector('[data-sh="arrange"]').disabled, label = lockB.textContent;
    const followed = HOST.collab.internals().follow;   // (a drag on the locked map is no click: it follows nothing)
    lockB.click(); await new Promise(r => setTimeout(r, 300));
    return { id: s.id, from: [s.x, s.z, s.yaw], moved: [m.x, m.z], turned: after.yaw, follow: HOST.collab.internals().follow, locked: { kept: Math.abs(still.x - after.x) < 1e-6, arrOff, label, followed, unlocked: !HOST.collab.locked } };
  });
  const mapB = !mapT.err && await until(B, ([id, x, z, yaw]) => { const s = HOST.collab.station(id); return !!s && Math.abs(s.x - x) < 0.005 && Math.abs(s.z - z) < 0.005 && Math.abs(Math.sin(s.yaw - yaw)) < 0.005; },
    [mapT.id, mapT.from[0] + 1, mapT.from[1] + 0.6, mapT.from[2] + Math.PI / 2], 6000);   // (another page drawing in software may answer late)
  check('the room map: a station\'s dot dragged moves it and its square dragged turns it, for everyone (a drag follows nothing)', !mapT.err &&
    near(mapT.moved, [mapT.from[0] + 1, mapT.from[1] + 0.6], 0.005) && Math.abs(Math.sin(mapT.turned - mapT.from[2] - Math.PI / 2)) < 0.005 && !mapT.follow && mapB, JSON.stringify(mapT));
  check('the room map: with the circles locked (Lock circles) a station cannot be dragged and Arrange all is off; unlocked again', !mapT.err &&
    mapT.locked.kept && mapT.locked.arrOff && mapT.locked.label === 'Unlock circles' && !mapT.locked.followed && mapT.locked.unlocked, JSON.stringify(mapT.locked));
  await A.evaluate(() => { HOST.collab.dialog(false); HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }); });
  await st7(B); await st7(C);
  await designRoom(A, B, C);

  // ----------------------------------------- the headsets' settings --
  // labels (the scenes' small ones) and cards (the story panels, station cards and name tags), each on top, in 3D or
  // hidden, free moving and subtitles are the room's, the same on every page and headset in it (key look): a room
  // without the key gives labels on top, cards in 3D and no subtitles; set on one page, the others follow at once, also
  // from the Shared dialog's row and with the layout locked (it never refuses them); free moving off takes the turns out
  // of the stations' places and panels
  const LOOKS = () => [HOST.xr.labels(), HOST.xr.cards(), HOST.xr.free()].join();
  const lookOf = p => p.evaluate(LOOKS);
  const lookIs = (p, want) => until(p, w => [HOST.xr.labels(), HOST.xr.cards(), HOST.xr.free()].join() === w, want, 6000);   // (as subsIs: a loaded machine)
  const look0 = await Promise.all([A, B, C].map(lookOf));
  check('the headsets\' settings: a room without them gives labels on top, cards in 3D and free moving on every page',
    !(await roomInfo(code)).keys.look && look0.every(l => l === 'face,fixed,true'), look0.join('; '));
  await A.evaluate(() => HOST.xr.setLabels('hidden'));
  const lookSet = await lookIs(B, 'hidden,fixed,true') && await lookIs(C, 'hidden,fixed,true');
  await B.evaluate(() => HOST.xr.setCards('face'));
  const cardSet = await lookIs(A, 'hidden,face,true') && await lookIs(C, 'hidden,face,true');
  check('the headsets\' settings: set on one page, every other page in the room follows (the labels from one page, then the cards from another, each leaving the other)',
    lookSet && cardSet, (await Promise.all([A, B, C].map(lookOf))).join('; '));
  // subtitles: off in a room without them; on from one page, for every page
  const subsOf = p => p.evaluate(() => [HOST.xr.subs(), HOST.collab.look().subs].join());
  const subsIs = (p, want) => until(p, w => HOST.xr.subs() === w, want, 6000);   // (a loaded machine can take a few seconds)
  const subs0 = await Promise.all([A, B, C].map(subsOf));
  await A.evaluate(() => HOST.xr.setSubs(true));
  const subsSet = await subsIs(B, true) && await subsIs(C, true);
  check('the headsets\' settings: subtitles are off in a room without them; turned on on one page, they are on on every page', subs0.every(v => v === 'false,false') && subsSet,
    subs0.join('; ') + ' -> ' + (await Promise.all([A, B, C].map(subsOf))).join('; '));
  // the two sound switches (the owner, 30 October 2026): sound effects and narration, the room's too, for every page and
  // headset in it (key look: sfx, voice); a room without them gives both on; turned off on one page, off on every page
  const SND = () => [HOST.xr.sfx(), HOST.xr.voice(), HOST.sfx.on(), HOST.collab.look().sfx, HOST.collab.look().voice].join();
  const sndOf = p => p.evaluate(SND), sndIs = (p, want) => until(p, w => [HOST.xr.sfx(), HOST.xr.voice(), HOST.sfx.on(), HOST.collab.look().sfx, HOST.collab.look().voice].join() === w, want, 6000);
  const snd0 = await Promise.all([A, B, C].map(sndOf));
  await A.evaluate(() => { HOST.sfx.set(false); HOST.xr.setVoice(false); });
  const sndSet = await sndIs(B, 'false,false,false,false,false') && await sndIs(C, 'false,false,false,false,false');
  check('the sound switches: sound effects and narration on in a room without them; turned off on one page, off on every page in the room',
    snd0.every(v => v === 'true,true,true,true,true') && sndSet, snd0.join('; ') + ' -> ' + (await Promise.all([A, B, C].map(sndOf))).join('; '));
  // a station's scene turned and its panel tilted (as a free grip leaves them), and the layout locked; then B's
  // Shared dialog: labels on top, cards hidden, free moving off
  const tId = await stationOf(A, 'lbi'), kTp = 'st.' + tId + '.place', kTn = 'st.' + tId + '.panel';
  await A.evaluate(([a, b]) => {
    HOST.collab.publish([[a, { x: 0.1, y: 0, z: -0.2, s: 1, q: [0, 0.7071, 0, 0.7071], story: 'lbi' }], [b, { x: -0.5, y: 1.5, z: -0.6, yaw: 0.3, q: [0.2, 0.1, 0, 0.9747], story: 'lbi' }]]);
    HOST.collab.lock(true);
  }, [kTp, kTn]);
  const turned = await until(B, k => HOST.collab.locked && !!HOST.collab.val(k) && !!HOST.collab.val(k).q, kTp, 3000);
  const dlg = await B.evaluate(async () => {
    HOST.collab.dialog(true); await new Promise(r => setTimeout(r, 300));
    const sl = document.querySelector('#shLabels'), sc = document.querySelector('#shCards'), fb = document.querySelector('[data-sh="free"]'), sb = document.querySelector('[data-sh="subs"]'),
      shown = sl && sl.value, shownC = sc && sc.value, subs = sb && sb.textContent;
    const xb = document.querySelector('[data-sh="sfx"]'), vb = document.querySelector('[data-sh="voice"]'), snd = [xb.textContent, vb.textContent, document.querySelector('.sh-sound span').textContent].join();
    sl.value = 'face'; sl.dispatchEvent(new Event('change', { bubbles: true })); sc.value = 'hidden'; sc.dispatchEvent(new Event('change', { bubbles: true }));
    fb.click(); sb.click(); xb.click(); vb.click();
    await new Promise(r => setTimeout(r, 300));
    const out = { shown, shownC, sel: sl.value, selC: sc.value, btn: fb.textContent, subs, sbtn: sb.textContent, snd, snd2: [xb.textContent, vb.textContent].join() };
    HOST.collab.dialog(false);
    return out;
  });
  const lk2 = await lookIs(A, 'face,hidden,false') && await lookIs(C, 'face,hidden,false') && await subsIs(A, false) && await subsIs(C, false) &&
    await sndIs(A, 'true,true,true,true,true') && await sndIs(C, 'true,true,true,true,true');
  for (let k = 0; k < 15 && ((await roomInfo(code)).keys[kTp] || { v: {} }).v.q; k++) await sleep(200);
  const rk2 = (await roomInfo(code)).keys, unq = !!rk2[kTp] && !rk2[kTp].v.q && !!rk2[kTn] && !rk2[kTn].v.q && rk2[kTn].v.yaw === 0.3;
  const aUnq = await A.evaluate(([a, b]) => !HOST.collab.val(a).q && !HOST.collab.val(b).q, [kTp, kTn]);
  check('the headsets\' settings and the sound switches: the Shared dialog\'s rows set them for everyone, also with the layout locked; free moving off takes the turns out of the stations\' places and panels',
    turned && dlg.shown === 'hidden' && dlg.shownC === 'face' && dlg.sel === 'face' && dlg.selC === 'hidden' && dlg.btn === 'Moving: facing you' && dlg.subs === 'Subtitles: on' && dlg.sbtn === 'Subtitles: off' && lk2 && unq && aUnq &&
      dlg.snd === 'Sound effects: off,Narration: off,For everyone in this room, pages and headsets:' && dlg.snd2 === 'Sound effects: on,Narration: on' &&
      !!rk2.look && rk2.look.v.labels === 'face' && rk2.look.v.cards === 'hidden' && rk2.look.v.free === false && rk2.look.v.subs === false && rk2.look.v.sfx === true && rk2.look.v.voice === true,
    JSON.stringify({ turned, dlg, lk2, place: rk2[kTp], panel: rk2[kTn], look: rk2.look }));
  await A.evaluate(([a, b]) => { HOST.collab.lock(false); HOST.collab.publish([[a, null], [b, null]]); HOST.xr.setLabels('face'); HOST.xr.setCards('fixed'); HOST.xr.setFree(true); }, [kTp, kTn]);
  await lookIs(B, 'face,fixed,true'); await lookIs(C, 'face,fixed,true');

  // ------------------------------------------------- each story, followed --
  for (const [key, T] of Object.entries(STORIES)) {
    const id = await stationOf(A, key);
    for (const p of [A, B, C]) { await p.evaluate(i => HOST.collab.follow(i), id); }
    for (const p of [A, B, C]) await ready(p, key);
    // (and closes the Stories screen, also where the story was loaded already: while it shows, nothing syncs)
    const shown = await Promise.all([A, B, C].map(p => p.evaluate(() => HOST.curKey + (HOST.picking ? ' on its Stories screen' : ''))));
    check(`${key}: Follow shows the station's story on every page`, shown.every(k => k === key), shown.join(', '));
    await until(B, () => !HOST.cur.peek('APP.playing'), null, 3000);
    const t0 = Date.now(), from = (await clockOf(A))[2];
    await peek(A, 'APP.playing || APP.togglePlay()');
    check(`${key}: play reaches a following page`, await until(B, () => HOST.cur.peek('APP.mode === "story" && APP.playing'), null, 5000));
    await sleep(1500);
    // read just after the shell's five-times-a-second check (a page rendering a frame a second, as headless
    // software WebGL can, falls behind between two checks: the stories cap a frame's step at 0.1 s), after five
    // checks in a row, and keep the read nearest the clock: a long frame can still come between a check and a read
    const reads = await B.evaluate(() => new Promise(r => {
      const C = HOST.collab.internals(), out = []; let p0 = C.pumpAt;
      const iv = setInterval(() => { if (C.pumpAt !== p0) { p0 = C.pumpAt; out.push([HOST.cur.peek('APP.t'), Date.now()]); if (out.length === 5) { clearInterval(iv); r(out); } } }, 1);
    }));
    const [run, ran] = reads.map(([v, at]) => [v, from + (at - t0) / 1000]).sort((a, b) => Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]))[0];
    check(`${key}: a playing station runs on the relay's clock (a following page keeps up)`, Math.abs(run - ran) < 0.45, `B at ${run.toFixed(2)} s, ${ran.toFixed(2)} s since play`);
    await peek(A, 'APP.togglePlay()');
    const paused = await until(B, () => !HOST.cur.peek('APP.playing'), null, 5000);
    const [ca, cb] = [await clockOf(A), await clockOf(B)];
    await sleep(500);
    const cb2 = await clockOf(B);
    check(`${key}: pause reaches it, at the same moment, and it stays there`, paused && Math.abs(ca[2] - cb[2]) < 0.3 && Math.abs(cb2[2] - cb[2]) < 0.02, `A ${ca}, B ${cb}, then ${cb2}`);
    await peek(A, 'APP.seek(20)');
    check(`${key}: a jump reaches it`, await until(B, () => Math.abs(HOST.cur.peek('APP.t') - 20) < 0.3, null, 5000));
    // slideshow on page A only (a setting per device): its stop at a chapter's end pauses the station for the others
    // at that t, and its Next plays it again (once, on the first story followed here)
    if (!slidesSeen) {
      slidesSeen = true;
      // sound effects (phase 2): every page at the station plays the same story cues at the same moment (each its own,
      // off the station's clock: SFXQ.log, what each asked for); a pause on one page stops them on all; a page that joins
      // mid-play plays none of the cues it missed
      if (await peek(A, 'typeof SFXQ !== "undefined"')) {
        const cues = await peek(A, 'SFXQ.cues.map(c => [c.name, Math.round(c.n * 1000) / 1000]).sort((a, b) => a[1] - b[1])');
        const busy = cues.find(c => cues.filter(d => d[1] >= c[1] && d[1] < c[1] + 6).length >= 3) || cues[0];
        const w0 = Math.max(0, busy[1] - 2), w1 = w0 + 9, n = p => peek(p, 'SFXQ.n');
        const cueOf = e => cues.find(c => c[0] === e[0] && e[1] >= c[1] - 0.006 && e[1] - c[1] < 1.6);   // (the log keeps APP.t to the hundredth)
        const logOf = (p, a, b) => peek(p, `SFXQ.log.filter(e => e[2] === 'story' && e[1] > ${a} && e[1] <= ${b})`);
        // each page's frames as it drew them (requestAnimationFrame: the time, its clock, playing), so that a page is
        // asked for exactly the cues its own frames reach: a cue more than 1.5 s late is dropped by design (sfxStep), and
        // three pages drawing the globe in software on a busy machine can draw one frame every few seconds (a headset
        // draws 72 to 90 a second); a page too slow for every cue is said so, not counted as hearing them
        for (const p of [A, B, C]) await p.evaluate(() => { const F = window.__sfxF = []; const f = () => { if (window.__sfxF !== F) return; F.push([performance.now(), HOST.cur.peek('APP.t'), HOST.cur.peek('APP.mode === "story" && APP.playing') ? 1 : 0]); requestAnimationFrame(f); }; requestAnimationFrame(f); });
        await peek(A, `(APP.seek(${w0}), APP.playing || APP.togglePlay())`);
        for (const p of [A, B, C]) await until(p, w => HOST.cur.peek('APP.t') > w, w1, 25000);
        const logs = await Promise.all([A, B, C].map(p => logOf(p, w0, w1 + 1.6)));
        const fr = await Promise.all([A, B, C].map(p => p.evaluate(() => { const F = window.__sfxF || []; window.__sfxF = null; return F; })));
        const want = cues.filter(c => c[1] > w0 + 0.4 && c[1] <= w1), seqs = logs.map(l => l.map(cueOf).filter(Boolean).map(c => c.join(' ')));
        // a cue a page's frames reach: two frames in a row while playing, its clock before the cue and at most 1.2 s past
        // it after (the rule's 1.5 s less a frame's step), moved no further than the time between them and the room's drift
        const reach = (F, c) => F.some((f, i) => i > 0 && F[i - 1][2] && f[2] && F[i - 1][1] < c[1] && f[1] > c[1] && f[1] - c[1] <= 1.2 &&
          f[1] - F[i - 1][1] <= (f[0] - F[i - 1][0]) / 1000 + 0.25);
        const asked = fr.map(F => want.filter(c => reach(F, c)).map(c => c.join(' ')));
        const heard = seqs.map(q => q.filter(k => want.some(c => c.join(' ') === k)));
        const once = seqs.every(q => new Set(q).size === q.length), all = asked.every((q, i) => q.every(k => heard[i].includes(k)));
        // how far apart the pages that played a cue saw it (each at its next frame)
        const gap = Math.max(...fr.map(F => Math.max(0, ...F.slice(1).map((f, i) => (f[0] - F[i][0]) / 1000))));
        const spread = want.map(c => c.join(' ')).map(k => { const ts = logs.map(l => (l.find(e => cueOf(e) && cueOf(e).join(' ') === k) || [0, NaN])[1]).filter(x => !isNaN(x)); return ts.length > 1 ? +(Math.max(...ts) - Math.min(...ts)).toFixed(2) : 0; });
        const judged = asked.map(q => q.length);
        check(`${key}: sound effects: every page at the station plays the same cues at the same moment (each every cue its frames reach, none twice)`,
          want.length >= 1 && judged.reduce((a, b) => a + b, 0) >= 1 && once && all && spread.every(d => d < 0.3 + 2 * gap),
          JSON.stringify({ want, asked, seqs, spread, slowest: +gap.toFixed(2) }));
        if (judged.some(n => n === 0)) console.log(`     (${['A', 'B', 'C'].filter((_, i) => !judged[i]).join(', ')} drew too few frames to be asked for any cue: longest gap between frames ${gap.toFixed(1)} s)`);
        await peek(B, 'APP.togglePlay()');
        for (const p of [A, C]) await until(p, () => !HOST.cur.peek('APP.playing'), null, 5000);
        const p0 = await Promise.all([A, B, C].map(n));
        await sleep(1500);
        const p1 = await Promise.all([A, B, C].map(n));
        check(`${key}: sound effects: a pause on one page stops the cues on every page`, p0.join() === p1.join(), `${p0} -> ${p1}`);
        // C leaves the station, A plays the stretch again, C comes back in the middle of it
        await C.evaluate(() => HOST.collab.unfollow());
        await peek(A, `(APP.seek(${w0}), APP.playing || APP.togglePlay())`);
        await until(A, w => HOST.cur.peek('APP.t') > w, busy[1] + 1, 20000);
        const c0 = await n(C), at = await peek(A, 'APP.t');
        await C.evaluate(i => HOST.collab.follow(i), id);
        await until(C, a => HOST.cur.peek('APP.playing') && HOST.cur.peek('APP.t') > a, at, 10000);
        await sleep(1000);
        const late = (await peek(C, `SFXQ.log.slice(-${Math.max(1, Math.min(64, (await n(C)) - c0))})`)).filter(e => e[2] === 'story' && cueOf(e) && cueOf(e)[1] < at - 0.3);
        check(`${key}: sound effects: a page that joins mid-play plays none of the cues it missed`, (await n(C)) === c0 || !late.length, JSON.stringify({ at, late }));
        await peek(A, 'APP.togglePlay()');
        for (const p of [B, C]) await until(p, () => !HOST.cur.peek('APP.playing'), null, 5000);
      }
      await A.evaluate(k => HOST.slides.set(k, true), key);
      const s = await peek(A, 'slideStop(1)');
      await peek(A, `(APP.seek(${s} - 2), APP.playing || APP.togglePlay())`);
      const stopped = await until(A, s => !HOST.cur.peek('APP.playing') && HOST.cur.peek('APP.t') === s, s, 20000) && await until(B, () => !HOST.cur.peek('APP.playing'), null, 5000);
      const [ca, cb] = [await clockOf(A), await clockOf(B)];
      check(`${key}: a slideshow stop on one page pauses the station at the end of the chapter`, stopped && Math.abs(cb[2] - s) < 0.3, `stop ${s}, A ${ca}, B ${cb}`);
      // (sound effects: no cue past the stop on either page while the station waits there)
      if (await peek(A, 'typeof SFXQ !== "undefined"')) {
        await sleep(800);
        const hi = [await peek(A, 'SFXQ.hi'), await peek(B, 'SFXQ.hi')];
        check(`${key}: sound effects: at a slideshow stop no page plays a cue past it`, hi.every(h => h <= s + 0.3), `stop ${s}, latest cues ${hi}`);
      }
      await A.evaluate(() => document.getElementById('btnNext').click());
      check(`${key}: Next on that page plays the station again`, await until(B, s => HOST.cur.peek('APP.playing') && HOST.cur.peek('APP.t') > s - 0.3, s, 5000), JSON.stringify(await clockOf(B)));
      await A.evaluate(() => HOST.slides.setGlobal(false));
      await peek(A, 'APP.togglePlay()');
      await until(B, () => !HOST.cur.peek('APP.playing'), null, 5000);
    }
    await peek(A, 'APP.enterExplore()');
    check(`${key}: explore mode reaches it`, await until(B, () => HOST.cur.peek('APP.mode') === 'explore', null, 5000));
    await sleep(500);
    const s0 = await stateOf(A);
    await peek(A, T.change);
    const s1 = await stateOf(A);
    const same = (p, s) => until(p, s => JSON.stringify(HOST.cur.collab.state()) === s, s, 6000);
    check(`${key}: the explore state reaches the others`, s1 !== s0 && await same(B, s1) && await same(C, s1), `${s0} -> ${s1}, B ${await stateOf(B)}`);
    await peek(B, T.back);
    const s2 = await stateOf(B);
    check(`${key}: and comes back the other way`, s2 !== s1 && await same(A, s2), `B ${s2}, A ${await stateOf(A)}`);
    if (T.effect) {
      const E = T.effect;
      await peek(A, E.quiet);
      await sleep(400);
      const calm = await until(B, s => HOST.cur.peek(s), E.idle, 20000) && await until(A, s => HOST.cur.peek(s), E.idle, 20000);
      const sn = T.sound ? await Promise.all([B, C].map(p => peek(p, 'typeof SFXQ !== "undefined" ? SFXQ.n : -1'))) : null;
      await peek(A, E.send);
      check(`${key}: its effect plays at the others`, calm && await until(B, s => HOST.cur.peek(s), E.seen, 5000));
      // (sound effects: the others hear it too, as it arrives: each page's own live sounds)
      if (T.sound) {
        await sleep(1200);
        const heard = await Promise.all([B, C].map(async (p, i) => sn[i] < 0 ? 'no SFXQ' : (await peek(p, `SFXQ.log.slice(-${Math.max(1, Math.min(64, (await peek(p, 'SFXQ.n')) - sn[i]))}).map(e => e[0])`)).join(' ')));
        check(`${key}: sound effects: the others play its sounds (${T.sound.join(', ')})`, heard.every(h => T.sound.every(nm => h.split(' ').includes(nm))), JSON.stringify(heard));
      }
    }
    if (T.more) await T.more(A, B, C);
    await peek(B, 'APP.enterStory(0)');
    check(`${key}: Replay story on another page reaches the first`, await until(A, () => HOST.cur.peek('APP.mode === "story" && APP.t < 2'), null, 5000));
    await peek(A, 'APP.enterExplore()');
    await until(C, () => HOST.cur.peek('APP.mode') === 'explore', null, 5000);
  }

  // ----------------------------------- two people, two controls, at once --
  // A and B change different controls of the station they follow (the last story's) at the same moment: neither
  // change is undone by the other. First as people do (each page publishes at its next poll), then with both
  // writes on their way at once (each page sees the other's while its own is unacknowledged)
  {
    const lastKey = Object.keys(STORIES).at(-1), ctl = async p => JSON.parse(await stateOf(p));
    await until(A, k => HOST.curKey === k, lastKey, 5000);
    const s0 = await ctl(A), f = Object.keys(s0);
    // the first two fields of the state, each set to another of its control's options
    const other = (k, v) => `(GL.sets.${lastKey}.controls.find(c => c.key === '${k}').options.map(o => o[0]).find(o => o !== ${JSON.stringify(v)}))`;
    const twice = async (now, label) => {
      const a0 = await ctl(A), [va, vb] = [await peek(A, other(f[0], a0[f[0]])), await peek(B, other(f[1], a0[f[1]]))];
      const send = now ? `; HOST.collab.publish([['st.' + HOST.collab.live().id + '.x', HOST.cur.collab.state()]])` : '';
      await Promise.all([
        A.evaluate(([k, v, send]) => HOST.cur.peek(`setCtl('${HOST.curKey}', '${k}', '${v}')${send}`), [f[0], va, send]),
        B.evaluate(([k, v, send]) => HOST.cur.peek(`setCtl('${HOST.curKey}', '${k}', '${v}')${send}`), [f[1], vb, send]),
      ]);
      const both = (p, w) => until(p, ([a, b, va, vb]) => { const x = HOST.cur.collab.state(); return x[a] === va && x[b] === vb; }, [f[0], f[1], va, vb], 5000);
      const ok = await both(A) && await both(B) && await both(C);
      check(`two people change two controls at once (${label}): both changes stay, on every page`, ok,
        `want ${f[0]} ${va}, ${f[1]} ${vb}; A ${await stateOf(A)}, B ${await stateOf(B)}, C ${await stateOf(C)}`);
    };
    await twice(false, 'each at its next poll');
    await twice(true, 'both writes on their way');
  }

  // ------------------------------------------- switches and own choices --
  // two stations followed back to back on a page: the second is not lost while the first story loads
  {
    const lastKey = Object.keys(STORIES).at(-1), [k1, k2] = ['spatial', 'robots'].filter(k => k !== lastKey).concat(['airports']).slice(0, 2);
    const [i1, i2] = [await stationOf(B, k1), await stationOf(B, k2)];
    await B.evaluate(([a, b]) => { HOST.collab.follow(a); HOST.collab.follow(b); }, [i1, i2]);
    const sw = await until(B, ([k, id]) => HOST.curKey === k && !HOST.busy && HOST.collab.live() && HOST.collab.live().id === id, [k2, i2], 60000) && await ready(B, k2);
    check('a page that follows two stations back to back ends at the second (a switch while a story loads is not lost)', sw,
      `story ${await B.evaluate(() => HOST.curKey)}, live ${await B.evaluate(() => (HOST.collab.live() || {}).story)}`);
    // a story picked by hand (the Stories screen) leaves the station: no longer following, and not pulled back
    await B.evaluate(k => HOST.start(k), lastKey === 'airports' ? 'proteins' : 'airports');
    const own = lastKey === 'airports' ? 'proteins' : 'airports';
    await ready(B, own);
    const left = await B.evaluate(() => [HOST.collab.following(), HOST.collab.mine(), !!HOST.collab.live()]);
    const nudge = await stationOf(A, 'nmd');
    await A.evaluate(id => { const s = HOST.collab.station(id); HOST.collab.publish([['st.' + id, { story: s.story, x: s.x + 0.01, z: s.z, yaw: s.yaw }]]); }, nudge);
    await sleep(3500);
    const stay = await B.evaluate(() => HOST.curKey);
    check('a story picked by hand stops following the station, and a change in the room does not pull the page back', !left[0] && !left[1] && !left[2] && stay === own,
      `following ${left[0] || '-'}, mine ${left[1] || '-'}, live ${left[2]}, now ${stay}`);
    await A.evaluate(id => { const s = HOST.collab.station(id); HOST.collab.publish([['st.' + id, { story: s.story, x: s.x - 0.01, z: s.z, yaw: s.yaw }]]); }, nudge);
    await B.evaluate(id => HOST.collab.follow(id), await stationOf(B, lastKey));
    await ready(B, lastKey);
  }

  // ------------------------------------------------------ no ping-pong --
  await sleep(800);
  const q0 = (await roomInfo(code)).seq;
  await sleep(5000);
  const q1 = (await roomInfo(code)).seq;
  check('no ping-pong: no writes in 5 s of idle with three pages following', q1 === q0, `${q1 - q0} writes`);

  // ------------------------------------------------------- late joiner --
  // at the station page A followed last
  const key0 = Object.keys(STORIES).at(-1), id0 = await stationOf(A, key0);
  const D = await open('#s=' + code);
  await st7(D);
  await D.evaluate(i => HOST.collab.follow(i), id0);
  await ready(D, key0);
  const sA = await stateOf(A);
  check('a late joiner gets the stations, the clock and the explore state', await until(D, s => HOST.cur.peek('APP.mode') === 'explore' && JSON.stringify(HOST.cur.collab.state()) === s, sA, 5000),
    `A ${sA}, D ${await stateOf(D)}`);
  await D.context().close();

  // --------------------------------------------------- follow a person --
  await personFollow(code, '');

  // ------------------------------------------------ panels per station --
  // (key st.<id>.ui) set in a page's Shared dialog for one station, with the circles locked (never refused by it): the
  // pages at that station have it, another station keeps its own (shown); and the story's lock there (Lock story, in the
  // same key), also with the circles locked, for every page
  const idOther = await stationOf(B, OTHER_STORY), kUi = id => 'st.' + id + '.ui';
  await B.evaluate(() => HOST.collab.lock(true));
  await until(A, () => HOST.collab.locked, null, 3000);
  const pclick = await B.evaluate(id => {
    HOST.collab.dialog(true);
    const q = () => document.querySelector(`[data-sh="panels:${id}"]`), was = q() && q().textContent;
    if (q()) q().click();
    return [was, q() && q().textContent, q() && q().getAttribute('aria-label')];
  }, id0);
  const pA = await until(A, id => HOST.collab.stationPanels(id) === 'controls' && HOST.panels.get(HOST.curKey) === 'controls', id0, 3000);
  const pO = await A.evaluate(id => [HOST.collab.stationPanels(id), HOST.panels.get(HOST.collab.station(id).story)], idOther);
  let rkU = {};
  for (let k = 0; k < 15 && !(rkU[kUi(id0)]); k++) { rkU = (await roomInfo(code)).keys; if (!rkU[kUi(id0)]) await sleep(200); }
  check('panels per station: set in a page\'s Shared dialog (with the circles locked), the pages at that station have them; another station keeps its own',
    pclick[0] === 'Panels: shown' && pclick[1] === 'Panels: controls only' && /hidden/.test(pclick[2] || '') && pA && pO.join() === 'shown,shown' &&
      !!rkU[kUi(id0)] && rkU[kUi(id0)].v.panels === 'controls' && rkU[kUi(id0)].v.story === key0 && !rkU[kUi(idOther)],
    JSON.stringify({ pclick, pA, pO, ui: rkU[kUi(id0)], other: rkU[kUi(idOther)] }));
  const lclick = await B.evaluate(async id => {
    const q = () => document.querySelector(`[data-sh="stlock:${id}"]`), was = q() && q().textContent;
    if (q()) q().click();
    await new Promise(r => setTimeout(r, 200));
    return [was, q() && q().textContent, q() && q().getAttribute('aria-pressed')];
  }, id0);
  const lA = await until(A, id => HOST.collab.stationLock(id) && HOST.collab.stationPanels(id) === 'controls', id0, 3000), lO = await A.evaluate(id => HOST.collab.stationLock(id), idOther);
  let rkL = {};
  for (let k = 0; k < 15 && !(rkL[kUi(id0)] && rkL[kUi(id0)].v.lock); k++) { rkL = (await roomInfo(code)).keys; await sleep(100); }
  check('a story\'s lock: Lock story in a page\'s Shared dialog (with the circles locked) locks that station for every page, its panels kept; another station not',
    lclick[0] === 'Lock story' && lclick[1] === 'Story locked' && lclick[2] === 'true' && lA && !lO && !!rkL[kUi(id0)] && rkL[kUi(id0)].v.lock === true && rkL[kUi(id0)].v.panels === 'controls',
    JSON.stringify({ lclick, lA, lO, ui: rkL[kUi(id0)] && rkL[kUi(id0)].v }));
  await B.evaluate(() => { HOST.collab.dialog(false); HOST.collab.lock(false); });
  await until(A, () => !HOST.collab.locked, null, 3000);

  // ---------------------------------------------------- relay restart --
  // (the headsets' labels in 3D, cards hidden, subtitles on and the narration off first: the restarted relay gets the room's settings back too)
  await A.evaluate(() => { HOST.xr.setLabels('fixed'); HOST.xr.setCards('hidden'); HOST.xr.setSubs(true); HOST.xr.setVoice(false); });
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);
  const before = await roomInfo(code), keep = port;
  await stopRelay();
  await sleep(400);
  await startRelay(keep);
  const back = p => until(p, () => HOST.collab.status === 'open' && HOST.collab.stations().length === HOST.list.length, null, 25000);
  const allBack = (await Promise.all([A, ...others].map(back))).every(Boolean);
  const after = await roomInfo(code).catch(() => ({ keys: {} }));
  const kx = 'st.' + id0 + '.x';
  check('a relay restart is survived: the room comes back with its stations and state', allBack && Object.keys(after.keys || {}).filter(k => /^st\.[\w-]+$/.test(k)).length === NST &&
    JSON.stringify(after.keys[kx] && after.keys[kx].v) === JSON.stringify(before.keys[kx].v), JSON.stringify(after.keys && after.keys[kx]));
  await peek(A, STORIES[key0].change);
  const sR = await stateOf(A);
  check('and a change after the restart still reaches the others', await until(B, s => JSON.stringify(HOST.cur.collab.state()) === s, sR, 5000));
  let lookR = null;
  for (let k = 0; k < 25 && !lookR; k++) { const r = await roomInfo(code).catch(() => ({ keys: {} })); lookR = r.keys && r.keys.look && r.keys.look.v; if (!lookR) await sleep(200); }
  check('a relay restart keeps the headsets\' settings and the sound switches (labels in 3D, cards hidden, subtitles on, the narration off here) for every page', !!lookR && lookR.labels === 'fixed' && lookR.cards === 'hidden' &&
    lookR.free === true && lookR.subs === true && lookR.sfx === true && lookR.voice === false && await lookIs(B, 'fixed,hidden,true') && await lookIs(C, 'fixed,hidden,true') && await subsIs(B, true) && await subsIs(C, true) &&
    await sndIs(B, 'true,false,true,true,false') && await sndIs(C, 'true,false,true,true,false'), JSON.stringify({ lookR, B: await lookOf(B), subs: await subsOf(B), snd: await sndOf(B) }));
  await A.evaluate(() => { HOST.xr.setLabels('face'); HOST.xr.setCards('fixed'); HOST.xr.setSubs(false); HOST.xr.setVoice(true); });
  await lookIs(B, 'face,fixed,true'); await lookIs(C, 'face,fixed,true'); await subsIs(B, false); await subsIs(C, false); await sndIs(B, 'true,true,true,true,true'); await sndIs(C, 'true,true,true,true,true');
  let uiR = null;
  for (let k = 0; k < 25 && !uiR; k++) { const r = await roomInfo(code).catch(() => ({ keys: {} })); uiR = r.keys && r.keys[kUi(id0)] && r.keys[kUi(id0)].v; if (!uiR) await sleep(200); }
  check('a relay restart keeps a station\'s panels and its story\'s lock', !!uiR && uiR.panels === 'controls' && uiR.lock === true &&
    await until(C, id => HOST.collab.stationPanels(id) === 'controls' && HOST.collab.stationLock(id), id0, 3000), JSON.stringify(uiR));
  await C.evaluate(id => { HOST.collab.setStationPanels(id, 'shown'); HOST.collab.setStationLock(id, false); }, id0);   // (shown and unlocked again: the headset below arrives at that station)
  await until(A, id => HOST.collab.stationPanels(id) === 'shown' && !HOST.collab.stationLock(id), id0, 3000);

  // ------------------------------------------------- a pretend headset --
  const H = await open('#s=' + code);
  let hLoads = 0; H.on('load', () => hLoads++);   // (a reload of the pretend headset's page would end its session: counted for the failures' notes)
  await st7(H);
  await ready(H, 'airports');
  const aId = await A.evaluate(() => HOST.collab.id);
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);   // stored before the headset's writes are counted
  const xrOpts = { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [0, 1.6, 0, 0] };
  await H.evaluate(() => HOST.room.sharedAlign(true));   // aligning from the shared space is off unless asked for
  await H.evaluate(installXR, xrOpts);
  const q2 = (await roomInfo(code)).seq, hId0 = await H.evaluate(() => HOST.collab.id);
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 400);
  // (then away from the stations, before it lines up: at [0, 1.6, 0] it stands 0.54 m from the endotype story's spot,
  // and a second there once aligned walked it in now and then; that story then built in software and starved the night
  // steps below. The story has placed its scene from where the head began, as the steps below expect)
  await H.evaluate(() => window.__xr.head([-6, 1.6, 6, 0]));
  check('headset: waits for the shared space\'s id', await H.evaluate(() => HOST.room.state === 'shared-wait'), await H.evaluate(() => HOST.room.state));
  // the id arrives with the space's reset event, a moment later
  await H.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'U1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
  await frames(H, 300);
  const fr = await H.evaluate(() => HOST.room.frame && { o: HOST.room.frame.o, x: HOST.room.frame.x, src: HOST.room.src });
  const wantO = unapply(FLOOR, ROOM.slice(0, 3)), wantX = rot(-FLOOR[3], rot(ROOM[3], [1, 0, 0]));
  check('headset: aligns from the frame published for its shared space', fr && fr.src === 'adopted' && near(fr.o, [wantO[0], 0, wantO[2]], 1e-4) && near(fr.x, wantX, 1e-4),
    fr ? `${fr.src} o ${fmt(fr.o)} x ${fmt(fr.x)}, want o ${fmt(wantO)} x ${fmt(wantX)}` : 'no frame');
  // the menu is closed at the start of a session (nothing of it shows: the watch went in v103), and a notice says how to
  // open it a moment in
  await until(H, () => { window.__xr.step(); return window.__collabLog.some(e => e.ev === 'notice' && e.title === 'The menu'); }, null, 8000);
  const menu0 = await H.evaluate(() => { const O = HOST.collab.overlay(); return { open: HOST.collab.menu, clock: 'clockG' in O, panel: O.panelG.visible,
    regions: O.panel.regions.length, hit: !O.hit.includes(O.panel.mesh), note: (HOST.collab.notes().find(n => n.title === 'The menu') || {}).text }; });   // (as it showed: another may have followed it)
  check('headset: the menu is closed at first, with no watch on the wrist, and a notice says how to open it', !menu0.open && !menu0.clock && !menu0.panel &&
    !menu0.regions && menu0.hit && /stick|pinch/i.test(menu0.note || ''), JSON.stringify(menu0));
  await standbySteps(H, wantO);   // (the shared space glitching, then standby with the shared space in use)
  // Re-align by hand (in the menu): a headset left offset (as one was after a long standby) goes back to the
  // room's frame through the shared space, which is asked for again
  const qA = (await roomInfo(code)).seq;   // (the room's frame is written on purpose from here to qB)
  const ra = await H.evaluate(async () => {
    const X = window.__xr, R = HOST.room.internals();
    X.head([-6, 1.6, 6, 0]);   // away from the stations
    const good = R.frame.o.slice(), t = performance.now();
    R.frame.o[0] += 0.6; R.frame.o[2] -= 0.4; R.wakeHold = t; R.stillSince = t;   // offset, and held as after waking
    for (let k = 0; k < 3; k++) X.step();
    const off = Math.hypot(R.frame.o[0] - good[0], R.frame.o[2] - good[2]);
    HOST.collab.panelOpen(true); X.step(); X.step();
    const S = HOST.collab.overlay().panel, last = HOST.collab.menuFind('col:7'), fits = !!last && last.y + last.h <= S.h;   // the whole panel on its canvas
    const r = HOST.collab.menuFind('realign');
    if (r) r.fn();
    // (it waits up to 3 s for the room's frame written again, which a page without a headset never does)
    for (let k = 0; k < 70; k++) { X.step(); await new Promise(res => setTimeout(res, 60)); if (!R.again) break; }
    HOST.collab.panelOpen(false);
    return { region: !!r, fits, off, d: Math.hypot(R.frame.o[0] - good[0], R.frame.o[2] - good[2]), src: R.src, again: R.again,
      asked: window.__collabLog.some(e => e.ev === 'shared asked again' && e.why === 'realign'), note: (window.__collabLog.filter(e => e.ev === 'notice').slice(-1)[0] || {}).title };
  });
  check('Re-align: an offset headset goes back to the room\'s frame through the shared space, asked for again (the panel fits its canvas)', ra.region && ra.fits && ra.off > 0.5 && ra.d < 2e-3 &&
    ra.src === 'adopted' && !ra.again && ra.asked && ra.note === 'Re-aligned', JSON.stringify(ra));
  // back from standby but still not in the others' space 15 s later (here: no pose but the head's): asked for again
  const rq = await H.evaluate(async () => {
    const X = window.__xr, R = HOST.room.internals(), keep = X.W.shared;
    X.visibility('hidden'); X.visibility('visible');
    X.W.shared = X.W.head.clone(); X.step(); X.step();
    R.visibleAt -= 16000; X.step(); X.step();
    await new Promise(res => setTimeout(res, 50));
    X.step(); X.step();
    const asked = window.__collabLog.filter(e => e.ev === 'shared asked again' && e.why === 'wake').length;
    X.W.shared = keep; R.visibleAt -= 21000;
    return { asked };
  });
  await frames(H, 600);
  check('after standby, a headset still outside the shared space 15 s later asks for it again (once)', rq.asked === 1, JSON.stringify(rq));
  // after a night the shared space may come back made again under the same id. A follower holds the room where it
  // was rather than take last night's frame through the new space, and follows the room's frame once its writer has
  // written it again since
  const frameIn = (S, P, uuid, by, g, p) => ({ uuid, o: unapply(S, [P[0], P[1], P[2]]), x: rot(-S[3], rot(P[3], [1, 0, 0])), by, g, at: Date.now() - 60000, p });
  const F8 = [FLOOR[0] + 0.3, 0, FLOOR[2] + 0.5, FLOOR[3] + 0.4], NEWS = [SHARED[0] + 1.3, 0, SHARED[2] - 0.6, SHARED[3] - 0.8], ROOM2 = [ROOM[0] + 0.5, 0, ROOM[2] - 0.4, ROOM[3] + 0.2];
  const inFloor = (F, P) => [unapply(F, P.slice(0, 3)), rot(-F[3], rot(P[3], [1, 0, 0]))];
  const nap = (F, S) => H.evaluate(([F, S]) => {
    const X = window.__xr, R = HOST.room.internals(), V = (x, y, z) => new THREE.Vector3(x, y, z);
    const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
    X.visibility('hidden'); X.floorReset(F, 0.1); X.W.shared = M(S); X.visibility('visible');
    for (let k = 0; k < 4; k++) X.step();
    R.visibleAt -= 21000; R.stillSince -= 6000;   // settled, and the space still for 5 s
    for (let k = 0; k < 4; k++) X.step();
    return { src: R.src, o: R.frame.o.slice(), x: R.frame.x.slice(), hold: !!R.wakeHold, held: window.__collabLog.slice(-30).some(e => e.ev === 'shared held after wake') };
  }, [F, S]);
  const fz = await nap(F8, NEWS), [fo8, fx8] = inFloor(F8, ROOM);
  check('after a night, a follower holds the room where it was rather than take last night\'s frame through a space made again', fz.src === 'adopted' && fz.hold && fz.held &&
    near([fz.o[0], fz.o[2]], [fo8[0], fo8[2]], 2e-3) && near(fz.x, fx8, 2e-3), JSON.stringify(Object.assign(fz, { want: [fo8, fx8] })));
  // (the writer writes it again a moment after it woke, as a headset does once settled, some 20 s later: written within
  // a second of the nap, by the other page's measure of the relay's clock it could still be before this headset fell
  // asleep, two pages' measures differing by about a second on a machine drawing in software)
  await sleep(3000);
  const rewrote = await A.evaluate(f => { const v = Object.assign(f, { p: Math.round(HOST.collab.now()) }); return { sent: HOST.collab.publish([[HOST.room.frameKey('U1'), v]]), p: v.p, open: HOST.collab.status }; }, frameIn(NEWS, ROOM2, 'U1', aId, 'shared'));
  // (stepped until it follows, 8 s at most: a page drawing in software may take a single step in 400 ms, before the
  // write has reached it)
  await until(H, p => { window.__xr.step(); return (HOST.collab.val(HOST.room.frameKey('U1')) || {}).p === p && !HOST.room.internals().wakeHold; }, rewrote.p, 8000);
  const fw2 = await H.evaluate(() => {
    const R = HOST.room.internals(), P = HOST.collab.val(HOST.room.frameKey('U1')) || {}, t = performance.now();
    return { src: HOST.room.src, o: HOST.room.frame.o.slice(), x: HOST.room.frame.x.slice(), hold: !!R.wakeHold,
      why: { p: P.p, by: P.by === HOST.collab.id ? 'me' : P.by, slept: R.sleptRel, still: Math.round(t - R.stillSince), own: R.sharedOwn, blind: R.blind,
        now: Math.round(HOST.collab.now()), log: window.__collabLog.slice(-12).filter(e => /wake|frame/.test(e.ev)).map(e => e.ev + (e.fresh !== undefined ? ' fresh ' + e.fresh : '')),
        cur: HOST.curKey, zones: window.__collabLog.filter(e => /^(aligned|zone|station|switch)$/.test(e.ev)).slice(-6).map(e => e.ev + ' ' + (e.st || e.story || e.src || '')) } };
  }), [fo2, fx2] = inFloor(F8, ROOM2);
  fw2.wrote = rewrote; fw2.loads = hLoads;
  check('and follows the room\'s frame once its writer has written it into the space again', fw2.src === 'adopted' && !fw2.hold && near([fw2.o[0], fw2.o[2]], [fo2[0], fo2[2]], 2e-3) &&
    near(fw2.x, fx2, 2e-3), JSON.stringify(Object.assign(fw2, { want: [fo2, fx2] })));
  // the room's frame written by this headset itself, after a night in a space made again: written into the new space
  // as it was held, so whoever is in that space finds the room where it was
  const hIdW = await H.evaluate(() => HOST.collab.id), F9 = [FLOOR[0] - 0.4, 0, FLOOR[2] + 0.2, FLOOR[3] - 0.6], NEW9 = [SHARED[0] - 0.7, 0, SHARED[2] + 0.9, SHARED[3] + 1.1];
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameIn(NEWS, ROOM2, 'U1', hIdW, 'shared'));
  await frames(H, 300);
  const rp = await H.evaluate(async ([F9, NEW9]) => {
    const X = window.__xr, R = HOST.room.internals(), V = (x, y, z) => new THREE.Vector3(x, y, z), key = HOST.room.frameKey('U1');
    const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
    const world = () => V(R.frame.o[0], 0, R.frame.o[2]).applyMatrix4(X.W.floor), w0 = world();
    X.visibility('hidden'); X.floorReset(F9, 0.1); X.W.shared = M(NEW9); X.visibility('visible');
    for (let k = 0; k < 4; k++) X.step();
    R.visibleAt -= 21000; R.stillSince -= 6000;
    for (let k = 0; k < 4; k++) { X.step(); await new Promise(res => setTimeout(res, 20)); }
    const P = HOST.collab.val(key);
    return { held: world().distanceTo(w0), sent: V(...P.o).applyMatrix4(X.W.shared).setY(0).distanceTo(w0.clone().setY(0)), by: P.by === HOST.collab.id, fresh: !!P.p,
      hold: !!R.wakeHold, rep: window.__collabLog.slice(-40).some(e => e.ev === 'shared after wake' && e.republished) };
  }, [F9, NEW9]);
  check('after a night, the room\'s frame written by this headset goes into the space made again as it was held', rp.held < 2e-3 && rp.sent < 2e-3 && rp.by && rp.fresh &&
    !rp.hold && rp.rep, JSON.stringify(rp));
  // back to the room as the rest expects: the space where it was, the room's frame by A, the first floor
  await spaceBack(H, SHARED);
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
  await sleepWake(H, FLOOR, SHARED);
  await H.evaluate(() => HOST.room.realignNow());
  for (let k = 0; k < 10 && !(await H.evaluate(() => !HOST.room.internals().again)); k++) await frames(H, 500);
  const rb = await H.evaluate(() => ({ src: HOST.room.src, o: HOST.room.frame.o }));
  check('and back in the room\'s space, it takes the room\'s frame again', rb.src === 'adopted' && near([rb.o[0], rb.o[2]], [wantO[0], wantO[2]], 2e-3), JSON.stringify(rb));
  const qB = (await roomInfo(code)).seq;
  // in a room, away from every station, a headset shows no story: no Stories screen (one opened is closed at once), the
  // story's scene, panels and labels hidden, nothing of it to point at, paused and silent (a story left playing, its
  // clock standing still), no Stories button; the menu's clock in front of you (no left controller); nothing written
  const away0 = await H.evaluate(async () => {
    const X = window.__xr, P = s => HOST.cur.peek(s), V = THREE.Vector3, O = HOST.collab.overlay();
    const steps = async n => { for (let k = 0; k < n; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); } };
    P('(APP.mode !== "story" && APP.enterStory(0), APP.playing = true, XR.stories = true, XR.inStory = false)');
    await steps(4);
    // a ray at the globe from half a metre outside it: nothing to point at while away (the same ray hits the globe once
    // the shell says the headset is not away)
    const mid = P('GL.world.getWorldPosition(new THREE.Vector3())'), dir = mid.clone().sub(new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert())).normalize();
    const rad = 1.04 * P('GL.world.getWorldScale(new THREE.Vector3()).x') + 0.5, c = P('XR.ctrls')[0];
    if (!c) return { noCtrls: true, key: HOST.curKey, mine: HOST.collab.mine() };   // (reported by the check below, so the run goes on)
    c.src = c.src || { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: null };
    c.g.visible = true; c.g.matrix.compose(mid.clone().addScaledVector(dir, -rad), new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), dir), new V(1, 1, 1));
    P('(XR.main.last = "", XR.main.t = -1e9)');
    await steps(3);
    P('xrUpdate(storyState(storyT(APP.t)))');   // (a pretend session's frames run only xrBegin: what xrUpdate shows, asked here)
    const t0 = P('APP.t');
    const out = { away: HOST.room.away(), mine: HOST.collab.mine(), stories: P('XR.stories'), playing: P('APP.playing'), world: P('GL.world.visible'),
      panels: P('XR.main.mesh.visible || XR.foot.mesh.visible'), land: P('XR.land.some(Q => Q.mesh.visible)'), kind: c.hover && c.hover.kind,
      button: P('XR.main.regions.some(r => r.id === "stories")') };
    await steps(10);
    out.still = P('APP.t') === t0 && !P('APP.playing');
    const aw = HOST.room.away;
    HOST.room.away = () => false; X.step(); out.control = c.hover && c.hover.kind; HOST.room.away = aw;
    P('(APP.playing = false)');
    c.g.visible = false; c.src = null;
    await steps(2);
    return out;
  });
  check('headset: away from every station in a room no story shows (no Stories screen, the scene and panels hidden, nothing to point at, paused, no Stories button)',
    away0.away && !away0.mine && !away0.stories && !away0.playing && !away0.world && !away0.panels && !away0.land && !away0.kind && away0.control === 'globe' && !away0.button &&
    away0.still, JSON.stringify(away0));
  // before any circle every station shows its story's icon over its ring: its miniature (lowpoly.js, its entry's icon;
  // built one a frame, the fallback until then), in the story's colour and turning, and its card
  const stationFor = async k => { const s = await H.evaluate(k => HOST.collab.stations().find(s => s.story === k) || null, k); if (!s) throw new Error('no station for ' + k); return s; };
  const iconsSeen = () => H.evaluate(() => [...HOST.collab.overlay().rings].map(([id, o]) => {
    const I = o.icon, s = HOST.collab.station(id), m = s && HOST.meta(s.story);
    return { id, story: s && s.story, key: I && I.key, model: I && I.model, wantModel: m && m.icon, tris: I && I.mesh.geometry.attributes.position.count / 3,
      col: I && '#' + I.halo.material.color.getHexString(), want: m && m.col.toLowerCase(), a: I && I.spin.rotation.y,
      on: !!I && I.g.visible && I.k > 0.9, y: I && +(I.g.position.y * o.g.scale.y).toFixed(3), mine: id === HOST.collab.mine() };
  }));
  const built = await until(H, () => { window.__xr.step(); return [...HOST.collab.overlay().rings.values()].every(o => o.icon.model); }, null, 20000);
  const ic0 = await iconsSeen();
  await frames(H, 400); await frames(H, 200);   // (twice: one slow frame can fill a whole wait, drawn at its start)
  const ic1 = await iconsSeen(), nSt = await H.evaluate(() => HOST.collab.stations().length);
  const iconOk = (x, i) => x.key === x.story && x.col === x.want && x.y > 1.9 && x.on && angle(x.a, ic0[i].a) > 0.05 && x.model === x.wantModel && x.tris > 300;
  const cards0 = await H.evaluate(() => [...HOST.collab.overlay().cards.values()].filter(c => c.mesh.visible).length);
  check('headset: before any circle every station shows its story\'s icon over its ring (its miniature, in its colour, turning) and its card', built && ic1.length === nSt &&
    !ic1.some(x => x.mine) && ic1.every(iconOk) && cards0 === nSt, JSON.stringify({ cards0, bad: ic1.filter((x, i) => !iconOk(x, i)) }));
  // walk to the headset story's station: after a second there it becomes this headset's story, placed at the station
  const S1 = await stationFor(HEADSET_STORY);
  const switched = await walk(H, S1, HEADSET_STORY, 0.4);
  const rig = await rigOf(H), want = rigAt(S1);
  check('headset: a second at a station switches to its story, which stands at the station', switched && near(rig.slice(0, 3), want.slice(0, 3), 1e-4) && angle(rig[3], want[3]) < 1e-4,
    `story ${await H.evaluate(() => HOST.curKey)}, rig ${fmt(rig)}, want ${fmt(want)}`);
  const shownAt = await H.evaluate(() => { HOST.cur.peek('xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS)');
    return { away: HOST.room.away(), world: HOST.cur.peek('GL.world.visible'), main: HOST.cur.peek('XR.main.mesh.visible'), card: HOST.collab.overlay().cards.has(HOST.collab.mine()) }; });
  check('headset: and there its story shows (scene and panel; its own card gone)', !shownAt.away && shownAt.world && shownAt.main && !shownAt.card, JSON.stringify(shownAt));
  // in a circle the other stations show their icons only (no card; the icons there to point at and grab; a ring only
  // within 2 m of its spot, and the others are 2.4 m apart or more), and of its own nothing (no ring, no icon)
  const iconsOnly = () => H.evaluate(() => { const O = HOST.collab.overlay(), id = HOST.collab.mine(), R = HOST.room.internals();
    const far = s => Math.hypot(R.hr.x - s.x, R.hr.z - s.z) > 2.2;
    return { icons: [...O.rings].filter(([k, o]) => k !== id && o.icon.k > 0.9 && O.hit.includes(o.ball)).length, ownIcon: O.rings.get(id).icon.k > 0.05,
      cards: [...O.cards].filter(([, c]) => c.mesh.visible).map(([k]) => k), own: O.hit.includes(O.rings.get(id).ring),
      farRings: HOST.collab.stations().filter(s => far(s) && O.hit.includes(O.rings.get(s.id).ring)).map(s => s.id) }; });
  // (the rings fade out over a second or so of frames)
  const inRing = await until(H, () => { window.__xr.step(); const O = HOST.collab.overlay(), id = HOST.collab.mine(), R = HOST.room.internals();
    return [...O.rings].every(([k, o]) => (k === id ? o.icon.k < 0.05 : o.icon.k > 0.9)) && [...O.cards.values()].every(c => !c.mesh.visible) &&
      HOST.collab.stations().every(s => Math.hypot(R.hr.x - s.x, R.hr.z - s.z) < 2.2 || !O.rings.get(s.id).ring.visible); }, null, 10000);
  const ro = await iconsOnly();
  check('headset: in its circle the other stations show their icons only (pointable; no card, no ring further than 2 m off), and of its own nothing (no ring, no icon)', inRing &&
    ro.icons === nSt - 1 && !ro.ownIcon && !ro.cards.length && !ro.farRings.length && !ro.own, JSON.stringify(ro));
  // the headset recentres (its local origin moves; the story's own reset listener asks to recentre): the story
  // stays at its station, placed there again every frame
  const relocal = L => H.evaluate(L => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z);
    X.W.local = new THREE.Matrix4().compose(V(L[0], L[1], L[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), L[3]), V(1, 1, 1));
    for (const fn of X.resets.local || []) fn({ transform: null });
  }, L);
  const L2 = [LOCAL[0] + 0.7, LOCAL[1], LOCAL[2] - 0.4, LOCAL[3] + 0.9];
  await relocal(L2); await frames(H, 250);
  const rigR = await rigOf(H), wantR = rigAt(S1, L2);
  await relocal(LOCAL); await frames(H, 250);
  check('headset: when the headset recentres, the story stays at its station', near(rigR.slice(0, 3), wantR.slice(0, 3), 1e-4) && angle(rigR[3], wantR[3]) < 1e-4,
    `rig ${fmt(rigR)}, want ${fmt(wantR)}`);
  // taken off for more than 3 s and put on again: outside a room the story would restart for a new wearer on its
  // Stories screen; at a station it stays, and nothing is written (the station's clock and state go on applying)
  const q3 = (await roomInfo(code)).seq;
  await H.evaluate(() => window.__xr.visibility('hidden'));
  await sleep(3300);
  await H.evaluate(() => window.__xr.visibility('visible'));
  await frames(H, 600);
  const q4 = (await roomInfo(code)).seq, modeBack = await H.evaluate(() => HOST.cur.peek('APP.mode'));
  check('headset: taken off and put on again, it writes nothing and takes the station\'s clock again', q4 === q3 && modeBack === 'explore', `${q4 - q3} writes, mode ${modeBack}`);
  const onAgain = await H.evaluate(() => [HOST.curKey, HOST.cur.peek('XR.stories'), HOST.collab.mine()]);
  check('headset: and it stays in its story at its station (no Stories screen)', onAgain[0] === HEADSET_STORY && onAgain[1] === false && onAgain[2] === S1.id, JSON.stringify(onAgain));
  check('headset: at the station, HOST.anchor holds the place; the grip may move the panel and the scene (for everyone), not the shell\'s things',
    await H.evaluate(() => HOST.anchor.held() && !HOST.anchor.locked('globe') && !HOST.anchor.locked('panel') && HOST.anchor.locked('shell') && HOST.room.inRoom()));
  const since = e => (e.seq > q2 && e.seq <= qA) || e.seq > qB;   // (not the writes the standby tests made on purpose)
  const wrote = Object.entries((await roomInfo(code)).keys).filter(([, e]) => since(e)).map(([k, e]) => `${k} by ${e.by === hId0 ? 'the headset' : e.by}`);
  const wroteWhy = wrote.length ? ' ' + JSON.stringify(Object.entries((await roomInfo(code)).keys).filter(([, e]) => since(e)).map(([k, e]) => [k, e.seq, e.v])) + ' ' +
    await H.evaluate(() => JSON.stringify(window.__collabLog.filter(e => /publish|switch|attach|apply|recv|go|station|adopt|hold/.test(e.ev)).slice(-40).map(e => [e.t, e.ev, e.keys || e.st || e.story || e.id || '']))) : '';
  check('headset: arriving at a station and starting a session write nothing', !wrote.length, wrote.join(', ') + wroteWhy);
  check('headset: the station\'s clock and state apply there', await until(H, s => HOST.cur.peek('APP.mode') === 'explore' && JSON.stringify(HOST.cur.collab.state()) === s, await stateOf(A), 2000));
  // in a room no Stories screen: one opened at a station anyway (as an older shell would) closes at once, and restarts
  // nothing for the others
  const q5 = (await roomInfo(code)).seq;
  await H.evaluate(() => HOST.cur.peek('(XR.stories = true, XR.inStory = false)'));
  await frames(H, 400);
  const q6 = (await roomInfo(code)).seq, card = await H.evaluate(() => HOST.cur.peek('[APP.mode, XR.stories]')), modeA = (await clockOf(A))[0];
  check('headset: in a room a Stories screen opened at a station closes at once and restarts nothing (no writes, still exploring)', q6 === q5 && card[0] === 'explore' &&
    card[1] === false && modeA === 'explore', `${q6 - q5} writes, headset ${card}, A ${modeA}`);
  // walking out of the circle (into no other) the headset stays in its story (the owner, 29 October 2026, after ten
  // headsets: "one should only exit a story when walking into a new circle"): shown, still its station, playing on the
  // station's clock and in step with the room both ways (a change on a page following the station taken, a pause here
  // sent), the walk itself writing nothing; the others' cards and icons stay hidden, its own icon gone; taken off and put
  // on again out there, still in its story; walking back in changes nothing (no second arrival)
  const kP1 = 'st.' + S1.id + '.play', play1 = (await roomInfo(code)).keys[kP1].v;
  await A.evaluate(k => HOST.collab.publish([[k, { mode: 'story', t: 20, playing: true, at: Math.round(HOST.collab.now()) }]]), kP1);
  const playsH = await until(H, () => { window.__xr.step(); return HOST.cur.peek('APP.mode === "story" && APP.playing'); }, null, 6000);
  const arrivals = () => H.evaluate(id => window.__collabLog.filter(e => e.ev === 'station' && e.st === id).length, S1.id);
  const spot = await awaySpot(H, S1), q7 = (await roomInfo(code)).seq, n7 = await arrivals();
  await H.evaluate(h => window.__xr.head(h), [...apply(ROOM, [spot[0], 1.6, spot[1]]), 0]);
  await frames(H, 1500);
  const seen1 = id => H.evaluate(id => { HOST.cur.peek('xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS)'); const O = HOST.collab.overlay();
    return { away: HOST.room.away(), mine: HOST.collab.mine(), live: !!HOST.collab.live(), mode: HOST.cur.peek('APP.mode'), playing: HOST.cur.peek('APP.playing'), t: HOST.cur.peek('APP.t'),
      world: HOST.cur.peek('GL.world.visible'), main: HOST.cur.peek('XR.main.mesh.visible'), stories: HOST.cur.peek('XR.stories'), card: O.cards.has(id),
      icon: (I => I.g.visible && I.k > 0.05)(O.rings.get(id).icon), others: [...O.cards.values()].filter(c => c.mesh.visible).length,
      icons: [...O.rings].filter(([k, o]) => k !== id && o.icon.k > 0.9).length, n: HOST.collab.stations().length,
      zone: (R => Math.hypot(R.hr.x - HOST.collab.station(id).x, R.hr.z - HOST.collab.station(id).z))(HOST.room.internals()) }; }, id);   // (zone: how far out it stands)
  const out1 = await seen1(S1.id), q8 = (await roomInfo(code)).seq, want1 = await A.evaluate(k => { const P = HOST.collab.val(k); return P.t + (HOST.collab.now() - P.at) / 1000; }, kP1);
  check('headset: walking out of its circle (into no other) it stays in its story: still its station, shown (scene and panel), playing on the station\'s clock, the others\' cards still hidden and their icons shown, the walk writing nothing',
    playsH && !!spot && out1.zone > 1.6 && !out1.away && out1.mine === S1.id && out1.live && out1.playing && out1.mode === 'story' && out1.world && out1.main && !out1.card && !out1.icon &&
    !out1.others && out1.icons === out1.n - 1 && Math.abs(out1.t - want1) < 1.5 && q8 === q7, JSON.stringify({ playsH, spot, out1, want1, writes: q8 - q7 }));
  // in step both ways while out there: a change on A (which follows the station) reaches the headset; a pause on the
  // headset reaches the room and A
  await peek(A, STORIES[HEADSET_STORY].change);
  const sOut = await stateOf(A);
  const tookOut = await until(H, s => { window.__xr.step(); return JSON.stringify(HOST.cur.collab.state()) === s; }, sOut, 6000);
  await H.evaluate(() => HOST.cur.peek('APP.togglePlay()'));
  const [, pausedA] = await Promise.all([frames(H, 1500), until(A, () => !HOST.cur.peek('APP.playing'), null, 6000)]);
  const room9 = (await roomInfo(code)).keys[kP1].v;
  check('headset: out of its circle it stays in step with the room both ways (a change on a page following the station reaches it; a pause on it reaches the room and the page)',
    tookOut && pausedA && !room9.playing && room9.mode === 'story', JSON.stringify({ tookOut, state: await stateOf(H), want: sOut, pausedA, room9 }));
  await H.evaluate(() => window.__xr.visibility('hidden'));
  await sleep(3300);
  await H.evaluate(() => window.__xr.visibility('visible'));
  await frames(H, 600);
  const out2 = await seen1(S1.id);
  check('headset: taken off and put on again out there, it is still in its story (no Stories screen, still its station, shown)', !out2.stories && !out2.away && out2.mine === S1.id &&
    out2.world && out2.main, JSON.stringify(out2));
  // back in: it never left, so nothing happens (no second arrival, nothing written)
  const q9a = (await roomInfo(code)).seq;
  await H.evaluate(h => window.__xr.head(h), headAt(S1, 0.4));
  await frames(H, 1500);
  const out3 = await seen1(S1.id), q9 = (await roomInfo(code)).seq, n9 = await arrivals();
  check('headset: walking back into its circle changes nothing (still its station and shown, no second arrival, nothing written)', !out3.away && out3.mine === S1.id && out3.world &&
    out3.main && !out3.icon && n9 === n7 && q9 === q9a, JSON.stringify({ out3, arrivals: n9 - n7, writes: q9 - q9a }));
  await A.evaluate(([k, v]) => HOST.collab.publish([[k, v]]), [kP1, play1]);   // (the station back in explore mode, as the rest expects)
  await until(H, () => { window.__xr.step(); return HOST.cur.peek('APP.mode') === 'explore'; }, null, 6000);
  // a ray: the others see it in room coordinates
  const ow = apply(ROOM, [S1.x + 0.2, 1.3, S1.z - 0.1]), dw = unit([0.3, -0.2, -1]);
  await H.evaluate(([o, d]) => window.__xr.ctrl(0, o, d), [ow, dw]);
  const hId = await H.evaluate(() => HOST.collab.id);
  let seen = null;   // presence goes out 15 times a second; a busy machine may take a while to show it
  for (let k = 0; k < 8 && !(seen && seen.hands.length); k++) {
    await frames(H, 400);
    seen = await A.evaluate(id => { const P = HOST.collab.people().get(id); return P && P.head ? { head: P.head, hands: P.hands, st: P.st } : null; }, hId);
  }
  const wantRay = [...unapply(ROOM, ow), ...rot(-ROOM[3], dw)], headRoom = unapply(ROOM, headAt(S1));
  check('headset: its rays reach the others in room coordinates', seen && seen.hands.length === 1 && near(seen.hands[0].slice(0, 6), wantRay, 3e-3) && seen.hands[0][6] > 0,
    seen ? `got ${fmt(seen.hands[0] || [])}, want ${fmt(wantRay)}` : 'no presence');
  check('headset: and its head, and the station it is at', seen && near(seen.head.slice(0, 3), headRoom, 3e-3) && seen.st === S1.id);
  // another person's presence (a headset elsewhere, in room coordinates, at this headset's station) is drawn in this
  // headset's room: the ray from its hand along its direction to its length, a dot at the end, a name tag; an avatar (not
  // here). At another circle, or at none, nobody is drawn (the people at your circle only), unless People: everyone
  const drawn = await H.evaluate(async () => {
    const C = HOST.collab.internals(), R = HOST.room.internals(), id = 'zz-test';
    const put = st => {
      if (!C.members.some(m => m.id === id)) C.members.push({ id, name: 'Test', color: '#ff7a59', kind: 'vr', here: false });
      C.pres.set(id, { id, at: performance.now(), st, head: [1, 1.6, -2, 0, 0, 0, 1], hands: [[1.2, 1.3, -2.1, 0.6, 0, -0.8, 2]] });
    };
    const run = async st => { for (let k = 0; k < 30; k++) { put(st); window.__xr.step(); await new Promise(r => setTimeout(r, 10)); } return HOST.collab.overlay().people.get(id); };
    const o = await run(HOST.collab.mine());
    if (!o) return null;
    o.g.updateMatrixWorld(true);
    const a = new THREE.Vector3(0, 0, 0).applyMatrix4(o.rays[0].matrixWorld), b = new THREE.Vector3(0, 0, 1).applyMatrix4(o.rays[0].matrixWorld);
    const toRoom = v => v.clone().applyMatrix4(R.mi).toArray();
    const out = { from: toRoom(a), to: toRoom(b), dot: toRoom(o.dots[0].getWorldPosition(new THREE.Vector3())), avatar: o.avatar.visible, tag: o.name, vis: o.g.visible };
    const other = HOST.collab.stations().find(s => s.id !== HOST.collab.mine()).id;
    out.other = (await run(other)).g.visible; out.none = (await run('')).g.visible;
    HOST.collab.seeAll(true);
    out.all = (await run(other)).g.visible && (await run('')).g.visible; out.kept = localStorage.getItem('collabPeople');
    HOST.collab.seeAll(false);
    out.back = (await run(other)).g.visible;
    C.pres.delete(id); C.members = C.members.filter(m => m.id !== id);
    return out;
  });
  const rayEnd = [1.2 + 0.6 * 2, 1.3, -2.1 - 0.8 * 2];
  check('headset: another person at its circle: their ray, dot, tag and avatar are drawn where they are in the room', drawn && drawn.vis && near(drawn.from, [1.2, 1.3, -2.1], 1e-3) &&
    near(drawn.to, rayEnd, 1e-3) && near(drawn.dot, rayEnd, 1e-3) && drawn.avatar && drawn.tag === 'Test', JSON.stringify(drawn));
  check('headset: a person at another circle or at none is not drawn; People: everyone (this headset\'s, kept here) draws them, and back again',
    drawn && !drawn.other && !drawn.none && drawn.all && drawn.kept === 'all' && !drawn.back, JSON.stringify(drawn));
  // the sound zone: the narration comes from the station's content (a panner there, the listener at your head)
  // and the <audio> element plays fainter with distance
  const cz = [S1.x - 1.4 * Math.sin(S1.yaw), 1.4, S1.z - 1.4 * Math.cos(S1.yaw)], czLocal = unapply(LOCAL, apply(ROOM, cz));
  const headLocal = unapply(LOCAL, headAt(S1)), dz = Math.hypot(...czLocal.map((v, i) => v - headLocal[i])), vol = Math.min(1, 1.5 / (1.5 + 2.5 * Math.max(0, dz - 1.5)));
  const zone = await H.evaluate(() => { const A = HOST.audio.state(), p = A.pan, L = A.ctx && A.ctx.listener;
    return { pan: p ? [p.positionX.value, p.positionY.value, p.positionZ.value] : null, ear: L ? [L.positionX.value, L.positionY.value, L.positionZ.value] : null, vol: A.el.volume, model: p && p.panningModel,
      refDistance: p && p.refDistance }; });
  check('headset: the sound zone puts the narration at the station, at full volume at its spot', zone.pan && zone.model === 'HRTF' && near(zone.pan, czLocal, 1e-3) &&
    near(zone.ear, headLocal, 1e-3) && Math.abs(zone.vol - vol) < 0.012 && vol === 1 && zone.refDistance === 1.5, `${JSON.stringify(zone)}, want ${fmt(czLocal)} at volume ${vol.toFixed(3)}`);
  // pointing with the trigger: the menu's clock only shows the time (the trigger there opens nothing); another station's
  // card takes the press
  const press = async target => {
    await H.evaluate(t => {
      const X = window.__xr, c = HOST.cur.peek('XR.ctrls')[0], V = THREE.Vector3;
      const head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
      const o = head.clone().add(new V(0.12, -0.3, -0.1)), d = new V(...t).sub(o).normalize();
      c.src = c.src || { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: null };
      c.g.visible = true;
      c.g.matrix.compose(o, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), d), new V(1, 1, 1));
      c.wantPress = true;
    }, target);
    await frames(H, 150);
  };
  await H.evaluate(() => HOST.collab.panelOpen(true));
  await frames(H, 150);
  const opened = await H.evaluate(() => { const O = HOST.collab.overlay(); return { open: HOST.collab.menu, panel: O.panelG.visible, vis: O.panel.vis, ids: HOST.collab.menuIds() }; });
  check('headset: open, the menu has Close in its header, its four tabs and Exit',
    opened.open && opened.panel && opened.vis > 200 && ['close', 'exit', 'tab:story', 'tab:settings', 'tab:circles', 'tab:debug'].every(i => opened.ids.includes(i)), JSON.stringify(opened));
  // the Story tab (at its station): the story's own two panels on the menu (their textures, under its tabs), a press there
  // is a press on the story's own panel (its Replay story, then Explore now, through the copy), and the grip on the copy
  // moves the menu, never the story's panel
  const storyTab = await H.evaluate(async () => {
    const X = window.__xr, V = THREE.Vector3, M4 = THREE.Matrix4, O = HOST.collab.overlay(), P = s => HOST.cur.peek(s);
    // (the story's panels drawn each step: this pretend headset runs the story's xrBegin, not its own frame, so they would
    // keep their last drawing, as of story mode, with its button for the other mode)
    const draw = () => { for (const M of P('XR.panels')) { M.last = ''; M.t = -1e9; P('panelTick')(M, performance.now() + 1e6); } };
    const steps = async n => { for (let k = 0; k < n; k++) { X.step(); draw(); await new Promise(r => setTimeout(r, 20)); } };
    HOST.collab.menuTab('story'); await steps(4);
    const sp = HOST.cur.panels(), out = { main: O.mirror.main.visible && O.mirror.main.material.map === sp.main.tex, foot: O.mirror.foot.visible && O.mirror.foot.material.map === sp.foot.tex,
      under: O.mirror.main.getWorldPosition(new V()).y < O.panelG.getWorldPosition(new V()).y, mode0: P('APP.mode') };
    const head = () => new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
    const c = P('XR.ctrls')[0];
    // (the session's own input source, so the shell can tell which controller holds the grip)
    c.src = X.session.inputSources[0] || (X.session.inputSources[0] = { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: null, targetRaySpace: {} });
    const aimAt = p => { const o = head().add(new V(0.12, -0.3, -0.1)); c.g.visible = true; c.g.matrix.compose(o, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), p.clone().sub(o).normalize()), new V(1, 1, 1)); };
    // a button of the story's main panel, through the menu's copy: its point on the copy
    const onCopy = id => { const Q = sp.main, r = Q.regions.find(x => x.id === id && x.fn); if (!r) return null;
      O.panelG.updateMatrixWorld(true);   // (where the menu is now: the shell moves it each frame)
      return O.mirror.main.localToWorld(new V((r.x + r.w / 2) / Q.w - 0.5, 0.5 - (r.y + r.h / 2) / Q.h, 0)); };
    for (const want of ['story', 'explore']) {
      await steps(3);
      const at = onCopy('mode');
      if (!at) { out['no' + want] = true; break; }
      aimAt(at); await steps(3); out['hover' + want] = c.hover && c.hover.kind === 'panel' && c.hover.P === sp.main && !!c.hover.menu && (sp.main.at(c.hover.x, c.hover.y) || {}).id === 'mode';
      c.wantPress = true; await steps(2); c.g.dispatchEvent({ type: 'selectend' }); await steps(2);   // (pressed on a frame, let go: the button's own release)
      for (let k = 0; k < 60 && P('APP.mode') !== want; k++) await steps(1);
      out['mode' + want] = P('APP.mode');
    }
    // the grip on the copy: the menu goes with the controller, the story's panel stays
    const pk = 'st.' + HOST.collab.mine() + '.panel', before = JSON.stringify(HOST.collab.internals().keys.get(pk) || null), g0 = O.panelG.position.clone();
    O.panelG.updateMatrixWorld(true);
    const at = O.mirror.main.localToWorld(new V(0, 0, 0));
    aimAt(at); await steps(3); X.step();   // (a grip comes between frames, on a fresh hover)
    X.fire('squeezestart', { inputSource: c.src }); await steps(2);
    out.grabbed = HOST.collab.menuGrab && !P('XR.ctrls[0].grab');
    aimAt(at.clone().add(new V(0.3, 0, 0))); await steps(4);
    out.moved = +O.panelG.position.distanceTo(g0).toFixed(3);
    X.fire('squeezeend', { inputSource: c.src }); await steps(2);
    out.storyPanel = JSON.stringify(HOST.collab.internals().keys.get(pk) || null) === before;
    c.g.visible = false;
    HOST.collab.panelOpen(false); HOST.collab.menuTab('settings'); await steps(2);
    localStorage.removeItem('xrMenuAt');
    return out;
  });
  check('headset: the menu\'s Story tab shows the story\'s own panels, a press there works the story\'s panel (Replay story, Explore now), and the grip on it moves the menu, not the story\'s panel',
    storyTab.main && storyTab.foot && storyTab.under && storyTab.mode0 === 'explore' && storyTab.hoverstory && storyTab.modestory === 'story' && storyTab.modeexplore === 'explore' &&
    storyTab.grabbed && storyTab.moved > 0.1 && storyTab.storyPanel, JSON.stringify(storyTab));
  await frames(H, 150);
  // a station's card 1 m behind the story's own panel: the panel takes the ray (it is nearer, and drawn on top);
  // without the panel in front the card would have taken it
  const depth = await H.evaluate(async () => {
    const C = HOST.collab.internals(), R = HOST.room.internals(), V = THREE.Vector3, X = window.__xr;
    const P = HOST.cur.peek('XR.main && XR.main.mesh');
    if (!P || !P.visible) return { err: 'no story panel' };
    const pc = P.getWorldPosition(new V()), head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
    // in the room: the card's centre 1 m on along the line from the head through the panel, level, facing back
    const pr = pc.clone().applyMatrix4(R.mi), hr = head.clone().applyMatrix4(R.mi), dir = pr.clone().sub(hr).setY(0).normalize();
    const cc = pr.clone().addScaledVector(dir, 1); cc.y = 1.45;
    // its spot further on (facing back), so the headset does not walk into it
    const yaw = Math.atan2(dir.x, dir.z), id = 'zzdepth', st = { id, story: 'robots', x: cc.x + 1.4 * Math.sin(yaw), z: cc.z + 1.4 * Math.cos(yaw), yaw };
    C.st.push(st); C.stById.set(id, st);
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); }
    // (in a circle another station's card shows only while it is pointed at: as if it just had been)
    const rg = HOST.collab.overlay().rings.get(id);
    if (rg) { rg.seenAt = performance.now() + 60000; rg.peek = 1; }
    for (let k = 0; k < 2; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); }
    const card = HOST.collab.overlay().cards.get(id);
    if (!card || !card.mesh.visible) return { err: 'no card' };
    const cw = card.mesh.getWorldPosition(new V()), d = cw.clone().sub(pc).normalize(), o = pc.clone().addScaledVector(d, -0.6);
    const c = HOST.cur.peek('XR.ctrls')[0];
    c.src = c.src || { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: null };
    c.g.visible = true; c.g.matrix.compose(o, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), d), new V(1, 1, 1));
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); }
    const kind = c.hover && c.hover.kind, alone = HOST.collab.ray(0, o, d), behind = HOST.collab.ray(0, o, d, 0.6);
    C.st.splice(C.st.indexOf(st), 1); C.stById.delete(id);
    c.g.visible = false; c.src = null;
    for (let k = 0; k < 2; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); }
    return { kind, alone: alone && alone.dist, behind: !!behind, toCard: cw.distanceTo(o) };
  });
  check('headset: the story\'s own panel in front of a station\'s card takes the ray (the card alone would)', depth.kind === 'panel' && depth.alone && Math.abs(depth.alone - depth.toCard) < 0.05 && !depth.behind,
    JSON.stringify(depth));
  // stations are walk-in only: the trigger on another station's card runs nothing from afar (a notice says to walk into
  // its circle), and the headset stays at its own. In a circle that card shows once its icon is pointed at
  const SP = await stationFor(PICK_STORY);
  const ringP = await ringAt(H, SP.id), hovRing = !!ringP && await pointAt(H, ringP) === SP.id;
  const peeked = hovRing && await until(H, id => { window.__xr.step(); const O = HOST.collab.overlay(), c = O.cards.get(id); return !!c && c.mesh.visible && O.hit.includes(c.mesh); }, SP.id, 3000);
  const cardAt = await H.evaluate(id => { const c = HOST.collab.overlay().cards.get(id); return c ? c.mesh.getWorldPosition(new THREE.Vector3()).toArray() : null; }, SP.id);
  const hovCard = peeked && !!cardAt && await pointAt(H, cardAt) === SP.id;
  if (cardAt) await press(cardAt);
  const went = await until(H, k => HOST.curKey === k || HOST.busy, PICK_STORY, 3000);
  await frames(H, 200);
  const pk = await H.evaluate(() => ({ key: HOST.curKey, mine: HOST.collab.mine(), note: (window.__collabLog.filter(e => e.ev === 'notice').slice(-1)[0] || {}).title }));
  const rigP = await rigOf(H), wantP = rigAt(S1, LOCAL);
  check(`headset: the trigger on another station's card runs nothing from afar (${PICK_STORY}): a notice says to walk into its circle, and the headset stays at its own`,
    hovRing && peeked && hovCard && !went && pk.key === HEADSET_STORY && pk.mine === S1.id && pk.note === 'Walk into its circle' && near(rigP.slice(0, 3), wantP.slice(0, 3), 1e-4),
    JSON.stringify({ hovRing, peeked, hovCard, went, pk, rig: rigP, want: wantP }));
  // the grip on another station's card picks it up: pointed 20 degrees further left it swings round the hand, raised
  // 10 degrees it goes further, a twist of the wrist turns it; the room has it while it moves (ten times a second)
  // and where it is put down; when someone else moves it, its ring here glides there
  const SM = await stationFor(MOVE_STORY);
  const grabStep = (what, deg) => H.evaluate(async ([id, what, deg]) => {
    const X = window.__xr, V = THREE.Vector3, Q = THREE.Quaternion, rad = deg * Math.PI / 180;
    const run = async ms => { const t0 = performance.now(); while (performance.now() - t0 < ms) { X.step(); await new Promise(r => setTimeout(r, 16)); } };
    const G = window.__grab = window.__grab || {};
    if (what === 'peek') {   // (in a circle another station's card shows once its icon is pointed at, or its ring's near side when it shows)
      const O = HOST.collab.overlay(), o = O.rings.get(id), head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
      const c = o.ring.getWorldPosition(new V()), p = O.hit.includes(o.ring) ? c.clone().addScaledVector(head.clone().sub(c).setY(0).normalize(), 0.48) : o.ball.getWorldPosition(new V());
      G.o = head.clone().add(new V(0.12, -0.3, -0.1)); G.q = new Q().setFromUnitVectors(new V(0, 0, -1), p.sub(G.o).normalize());
    } else if (what === 'aim') {
      const card = HOST.collab.overlay().cards.get(id);
      if (!card) return { err: 'no card' };
      const head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
      G.o = head.clone().add(new V(0.12, -0.3, -0.1));
      G.q = new Q().setFromUnitVectors(new V(0, 0, -1), card.mesh.getWorldPosition(new V()).sub(G.o).normalize());
    } else if (what === 'swing') G.q.premultiply(new Q().setFromAxisAngle(new V(0, 1, 0), rad));
    else if (what === 'raise') { const f = new V(0, 0, -1).applyQuaternion(G.q); G.q.premultiply(new Q().setFromAxisAngle(f.cross(new V(0, 1, 0)).normalize(), rad)); }
    else if (what === 'twist') G.q.premultiply(new Q().setFromAxisAngle(new V(0, 0, -1).applyQuaternion(G.q), rad));
    if (G.o) X.aim(0, new THREE.Matrix4().compose(G.o, G.q, new V(1, 1, 1)));
    if (what === 'grip') { X.step(); X.fire('squeezestart', { inputSource: X.session.inputSources[0] }); }   // (a grip comes between frames, on a fresh hover)
    if (what === 'let go') X.fire('squeezeend', { inputSource: X.session.inputSources[0] });
    await run(what === 'aim' || what === 'peek' ? 200 : 400);
    const h = HOST.collab.internals().hov.get(0), o = HOST.room.toRoom(G.o.clone());
    return { hov: h && h.target.kind === 'station' ? h.target.id : '', moving: HOST.room.moving, hand: [o.x, o.z], st: HOST.collab.station(id) };
  }, [SM.id, what, deg || 0]);
  await grabStep('peek');
  const g0 = await grabStep('aim'), g1 = await grabStep('grip');
  const sM0 = g1.st, vM0 = [sM0.x - g1.hand[0], 0, sM0.z - g1.hand[1]], deg = d => d * Math.PI / 180;
  const g2 = await grabStep('swing', 20);
  const vM1 = rot(deg(20), vM0), wM1 = [g1.hand[0] + vM1[0], g1.hand[1] + vM1[2], sM0.yaw + deg(20)];
  const seenA = await until(A, ([id, w]) => { const s = HOST.collab.station(id); return !!s && Math.hypot(s.x - w[0], s.z - w[1]) < 0.01; }, [SM.id, wM1], 3000);
  await grabStep('raise', 10);
  await grabStep('twist', 30);
  const g5 = await grabStep('let go');
  // (raised 10 degrees it goes exp(2 x 0.17) further, but never beyond 12 m from the hand, as carryStation has it: with
  // the stories' order since v107 the station carried stands about 10 m from the headset's own)
  const dM0 = Math.hypot(vM1[0], vM1[2]), kM2 = Math.min(12, Math.max(Math.min(0.3, dM0), dM0 * Math.exp(2 * deg(10)))) / dM0;
  const wantM = [g1.hand[0] + vM1[0] * kM2, g1.hand[1] + vM1[2] * kM2, Math.atan2(Math.sin(sM0.yaw + deg(20) - deg(30)), Math.cos(sM0.yaw + deg(20) - deg(30)))];
  const putA = await until(A, ([id, w]) => { const s = HOST.collab.station(id); return !!s && Math.hypot(s.x - w[0], s.z - w[1]) < 0.01 && Math.abs(Math.sin(s.yaw - w[2])) < 0.01; }, [SM.id, wantM], 3000);
  check('headset: the grip on a station\'s card picks it up (its story does not move), pointing swings it round, and the others see it move',
    g0.hov === SM.id && g1.moving === SM.id && !(await H.evaluate(() => HOST.cur.peek('XR.ctrls[0].grab'))) && !!g2.st && Math.hypot(g2.st.x - wM1[0], g2.st.z - wM1[1]) < 0.01 && seenA,
    JSON.stringify({ hov: g0.hov, moving: g1.moving, st: g2.st, want: wM1, seenA }));
  check('headset: raised it goes further, a twist of the wrist turns it, and the room has it where it is put down', putA && !g5.moving &&
    Math.hypot(g5.st.x - wantM[0], g5.st.z - wantM[1]) < 0.01 && Math.abs(Math.sin(g5.st.yaw - wantM[2])) < 0.01, JSON.stringify({ st: g5.st, want: wantM, putA }));
  await A.evaluate(s => HOST.collab.publish([['st.' + s.id, { story: s.story, x: s.x, z: s.z, yaw: s.yaw }]]), sM0);
  await until(H, ([id, x]) => { const s = HOST.collab.station(id); return !!s && Math.abs(s.x - x) < 1e-6; }, [SM.id, sM0.x], 3000);
  const glide = await H.evaluate(async ([id, x, z]) => {
    const X = window.__xr, ring = () => { const g = HOST.collab.overlay().rings.get(id).g; return Math.hypot(g.position.x - x, g.position.z - z); };
    const before = ring(); X.step(); const one = ring();
    let n = 1;   // (in frames: a slow machine draws few, and each eases at most a tenth of a second's worth)
    for (; n < 120 && ring() > 0.002; n++) { X.step(); await new Promise(r => setTimeout(r, 16)); }
    return { before, one, after: ring(), frames: n };
  }, [SM.id, sM0.x, sM0.z]);
  check('headset: a station someone else moves glides to its new place here', glide.before > 0.5 && glide.one > 0.02 && glide.one < glide.before && glide.after < 0.002 && glide.frames > 2, JSON.stringify(glide));
  // the circles lock: locked from a page, the grip moves no station and Arrange all is refused; unlocked with the
  // headset panel's button, for everyone
  await A.evaluate(() => HOST.collab.lock(true));
  const lockSeen = await until(H, () => HOST.collab.locked, null, 3000);
  await grabStep('peek');
  const lk0 = await grabStep('aim'), lk1 = await grabStep('grip');
  await grabStep('let go');
  const arrRefused = await H.evaluate(() => { const before = JSON.stringify(HOST.collab.stations()); HOST.collab.arrange({ x: 5, z: 5, yaw: 0 }); return before === JSON.stringify(HOST.collab.stations()); });
  await H.evaluate(() => HOST.collab.panelOpen(true));
  await frames(H, 300);
  const unlockBtn = await H.evaluate(() => { const r = HOST.collab.menuFind('lock'); if (!r || !r.fn) return false; r.fn(); return true; });
  const unlocked = await until(A, () => !HOST.collab.locked, null, 3000);
  await H.evaluate(() => HOST.collab.panelOpen(false));
  check('headset: the circles lock (from a page) stops the grip moving a station and Arrange all; the menu\'s Lock circles button unlocks it for everyone',
    lockSeen && lk0.hov === SM.id && !lk1.moving && !!lk1.st && Math.abs(lk1.st.x - lk0.st.x) < 1e-6 && arrRefused && unlockBtn && unlocked,
    JSON.stringify({ lockSeen, hov: lk0.hov, moving: lk1.moving, arrRefused, unlockBtn, unlocked }));
  // Sound check in the menu (the stories have theirs on the Stories screen, which a room never shows): a page in place of
  // the rest of the menu, a beep through each engine, the engine choice (the audio element, then automatic again) and
  // what the sound system is doing; Back goes back to the menu
  const snd = await H.evaluate(async () => {
    const X = window.__xr, S = HOST.collab.overlay().panel, ids = () => S.regions.map(r => r.id);
    const tap = id => { const r = S.regions.find(x => x.id === id); if (r && r.fn) { r.fn(); return true; } return false; };
    const steps = async n => { for (let k = 0; k < n; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); } };
    HOST.collab.panelOpen(true); await steps(3);
    const sb = HOST.collab.menuFind('sound'), out = { button: !!sb, tab: HOST.collab.menuTab() };
    if (sb) sb.fn();
    await steps(3);
    out.page = ids(); out.tall = S.vis;
    const beep = HOST.audio.beep, beeps = [];
    HOST.audio.beep = e => { beeps.push(e); };   // (asked for through the engine named; no sound in a test)
    tap('snd:beepW'); tap('snd:beepM');
    HOST.audio.beep = beep; out.beeps = beeps.join();
    tap('snd:media'); await steps(3); out.media = HOST.audio.pref;
    tap('snd:auto'); await steps(3); out.auto = HOST.audio.pref;
    tap('snd:back'); await steps(3);
    out.back = ids().includes('tab:settings') && ids().includes('sound') && !ids().includes('snd:beepW');
    HOST.collab.panelOpen(false); await steps(2);
    return out;
  });
  check('headset: Sound check in the menu (under Debug): a beep through each engine, the engine choice and what the sound system is doing; Back returns to the tab',
    snd.button && snd.tab === 'debug' && ['snd:beepW', 'snd:beepM', 'snd:auto', 'snd:webaudio', 'snd:media', 'snd:reset', 'snd:back'].every(id => snd.page.includes(id)) && !snd.page.includes('exit') &&
    snd.tall > 600 && snd.beeps === 'webaudio,media' && snd.media === 'media' && snd.auto === 'auto' && snd.back, JSON.stringify(snd));
  // a click of either stick opens the menu, floating in front of you (0.8 m ahead and a little below your eyes, turned to
  // you), and closes it again; unused (no press, no ray or fingertip on it) it closes by itself, not while calibrating;
  // it stays put while you look about a little and glides back in front once you have turned further; the grip on it
  // carries it, where it is let go it stays (not following your head), and it opens there next time (its distance and
  // height kept on this headset); with tracked hands two quick pinches of the left hand pointing at nothing open and
  // close the menu (one pinch, two slow ones, the right hand's or the left's pointing at a panel do not), and the right
  // index fingertip presses its buttons by touch
  const hand = await H.evaluate(async () => {
    const X = window.__xr, V = THREE.Vector3, M4 = THREE.Matrix4, O = HOST.collab.overlay(), S = O.panel;
    const steps = async n => { for (let k = 0; k < n; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); } };
    const wait = async ms => { const t0 = performance.now(); while (performance.now() - t0 < ms) await steps(1); };
    HOST.collab.panelOpen(false);
    const inv = () => X.W.local.clone().invert();
    const headNow = () => new V().setFromMatrixPosition(X.W.head).applyMatrix4(inv());
    const gaze = () => new V(0, 0, -1).transformDirection(X.W.head).transformDirection(inv());
    const head = headNow(), lp = head.clone().add(new V(-0.2, -0.35, -0.3));
    X.aim(1, new M4().compose(lp, new THREE.Quaternion(), new V(1, 1, 1)));
    await steps(4);
    localStorage.removeItem('xrMenuAt');
    const out = { closed: !HOST.collab.menu && !O.panelG.visible };
    // where the open menu is: its middle's distance from the eyes, how far ahead along the gaze (level), and whether it
    // faces you
    const mid = () => S.mesh.getWorldPosition(new V());
    const where = () => { const m = mid(), h = headNow(), d = m.clone().sub(h), f = gaze(); f.y = 0; f.normalize(); const dl = d.clone(); dl.y = 0; dl.normalize();
      return { dist: +d.length().toFixed(3), flat: +Math.hypot(d.x, d.z).toFixed(3), ahead: +dl.dot(f).toFixed(3), faces: +new V(0, 0, 1).applyQuaternion(O.panelG.quaternion).dot(h.clone().sub(m).normalize()).toFixed(3), p: m.toArray().map(v => +v.toFixed(3)) }; };
    // the left stick's click (button 3), pressed and let go: open; again: closed; the right stick's the same. Since v125 a
    // click opens or closes the menu once 0.4 s have passed with no second click (two are moving with the sticks): each
    // click is let go, then 0.5 s pass before the menu is read
    const btn = { pressed: false }, rbtn = { pressed: false };
    X.session.inputSources[1].gamepad = { buttons: [{}, {}, {}, btn], axes: [0, 0, 0, 0], hapticActuators: [] };
    await steps(2);
    btn.pressed = true; await steps(2); btn.pressed = false; await wait(500); await steps(3); out.stick = HOST.collab.menu;
    out.float = where(); out.pscale = O.panelG.scale.x; out.d0 = HOST.collab.menuPos().d;
    out.ids = S.regions.map(r => r.id).slice(0, 5);
    btn.pressed = true; await steps(2); btn.pressed = false; await wait(500); await steps(2);
    out.stickClosed = !HOST.collab.menu && !O.panelG.visible;
    const right = X.session.inputSources[0] || (X.session.inputSources[0] = { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: null, targetRaySpace: {} });
    right.gamepad = { buttons: [{}, {}, {}, rbtn], axes: [0, 0, 0, 0], hapticActuators: [] };
    await steps(2);
    rbtn.pressed = true; await steps(2); rbtn.pressed = false; await wait(500); await steps(2); out.rstick = HOST.collab.menu;
    rbtn.pressed = true; await steps(2); rbtn.pressed = false; await wait(500); await steps(2); out.rstickClosed = !HOST.collab.menu;
    right.gamepad = null;
    // the right controller held low, pointing at the floor (nothing of the menu)
    const at = () => X.aim(0, new M4().compose(head.clone().add(new V(0.3, -0.6, 0)), new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), new V(0, -1, 0)), new V(1, 1, 1)));
    at(); await steps(2);
    // unused, it closes by itself (here after 0.6 s); a ray resting on it keeps it open; not while calibrating (the right
    // controller put away meanwhile: its ray, straight ahead from beside the clock, can rest on the menu)
    const idle0 = HOST.collab.menuIdle(), away0 = () => { const c = HOST.cur.peek('XR.ctrls')[0]; c.g.visible = false; };
    HOST.collab.menuIdle(600); away0(); await steps(2);
    btn.pressed = true; await steps(2); btn.pressed = false; await steps(2);
    await wait(1100); for (let k = 0; k < 40 && HOST.collab.menu; k++) await wait(100);   // (a slow page draws a frame a second: given time, as below)
    out.idleClosed = !HOST.collab.menu && (window.__collabLog.filter(e => e.ev === 'menu').pop() || {}).by === 'idle';
    btn.pressed = true; await steps(2); btn.pressed = false; await steps(2);
    const c0 = HOST.cur.peek('XR.ctrls')[0], ro = headNow().add(new V(0.1, -0.2, 0));
    c0.src = c0.src || right; c0.g.visible = true;
    const aimMenu = () => c0.g.matrix.compose(ro, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), mid().sub(ro).normalize()), new V(1, 1, 1));
    const t0 = performance.now(); while (performance.now() - t0 < 1200) { aimMenu(); await steps(1); }
    out.idleHeld = HOST.collab.menu;
    away0();
    await wait(1100); for (let k = 0; k < 40 && HOST.collab.menu; k++) await wait(100);   // (a frame a second here: given time)
    out.idleAfter = !HOST.collab.menu;
    HOST.room.calibrate(); btn.pressed = true; await steps(2); btn.pressed = false; await steps(2);
    await wait(1000); out.idleCalib = HOST.collab.menu && !!HOST.room.internals().calib;
    HOST.room.cancel(); HOST.collab.panelOpen(false); await steps(2);
    HOST.collab.menuIdle(idle0);   // (the right controller stays away for the follow below: a ray on the menu holds it)
    // it stays put as you look about a little (15 degrees), and glides back in front once you have turned further (60)
    const H0 = X.W.head.clone(), turn = a => { X.W.head = H0.clone().multiply(new M4().makeRotationY(a)); };
    btn.pressed = true; await steps(2); btn.pressed = false; await wait(500); await steps(3);
    const p0 = mid(); turn(15 * Math.PI / 180); await steps(10);
    out.still = +mid().distanceTo(p0).toFixed(4);
    turn(60 * Math.PI / 180); await wait(1500);
    out.follow = where();
    X.W.head = H0; HOST.collab.panelOpen(false); await steps(3);
    // the grip on it (the right controller's ray on its middle) carries it: let go 0.3 m to the side it stays there, even
    // with the head turned 60 degrees; closed and opened again it opens at the distance and height it was left at
    btn.pressed = true; await steps(2); btn.pressed = false; await wait(500); await steps(3);
    const aimTo = p => { const m = new M4().compose(ro, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), p.clone().sub(ro).normalize()), new V(1, 1, 1)); X.aim(0, m); };
    const m0 = mid(); aimTo(m0); await steps(3);
    X.fire('squeezestart', { inputSource: X.session.inputSources[0] }); await steps(2);
    out.grab = HOST.collab.menuGrab;
    const to = m0.clone().add(new V(-0.3, 0.1, -0.2)); aimTo(to); await steps(4);
    X.fire('squeezeend', { inputSource: X.session.inputSources[0] }); await steps(2);
    out.carried = +mid().distanceTo(m0).toFixed(3); out.put = !HOST.collab.menuGrab; out.pos = HOST.collab.menuPos(); out.kept = localStorage.getItem('xrMenuAt');
    at(); await steps(2);
    const p1 = mid(); turn(60 * Math.PI / 180); await wait(1500);
    out.pinnedStill = +mid().distanceTo(p1).toFixed(4);
    X.W.head = H0; HOST.collab.panelOpen(false); await steps(3);
    btn.pressed = true; await steps(2); btn.pressed = false; await wait(500); await steps(3);
    // (along the floor, against the first opening: it hangs from its top edge, so its middle's height follows the tab
    // shown, and this test's head is a few centimetres from the shell's eye; both open straight ahead)
    out.again = where(); out.againWant = +(out.float.flat + out.pos.d - out.d0).toFixed(3);
    HOST.collab.panelOpen(false); localStorage.removeItem('xrMenuAt'); await steps(2);
    btn.pressed = true; await steps(2); btn.pressed = false; await steps(2);
    // hands: a left wrist turned every which way, its ray pointing up (at nothing); the right index fingertip
    const J = m => ({ world: X.W.local.clone().multiply(m) }), tip = J(new M4());
    const tipAt = v => { tip.world = X.W.local.clone().multiply(new M4().makeTranslation(v.x, v.y, v.z)); };
    const wq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0.7, -0.3)), wp = head.clone().add(new V(-0.15, -0.4, -0.35)), wm = new M4().compose(wp, wq, new V(1, 1, 1));
    HOST.collab.panelOpen(false);
    const left = { handedness: 'left', targetRayMode: 'tracked-pointer', gamepad: null, targetRaySpace: J(wm), hand: new Map([['wrist', J(wm)]]) };
    const rightH = { handedness: 'right', targetRayMode: 'tracked-pointer', gamepad: null, targetRaySpace: J(new M4()), hand: new Map([['index-finger-tip', tip]]) };
    X.session.inputSources[1] = left; X.session.inputSources[0] = rightH;
    const up = new M4().compose(lp, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), new V(0, 1, 0)), new V(1, 1, 1));
    X.aim(1, up); left.targetRaySpace = J(up);
    tipAt(head.clone().add(new V(0.3, -0.3, -0.2)));
    await steps(25);
    out.handClosed = !HOST.collab.menu;
    const pinch = src => X.fire('selectstart', { inputSource: src });
    // (no frame stepped between the two: on a loaded machine one step can take longer than the 0.4 s a double pinch has)
    pinch(left); await wait(150); pinch(left); await steps(2); out.pinch2 = HOST.collab.menu;
    pinch(left); await wait(120); pinch(left); await steps(2); out.pinch2Closed = !HOST.collab.menu;
    pinch(left); await wait(700); out.pinch1 = HOST.collab.menu;
    pinch(left); await wait(600); pinch(left); await steps(2); out.pinchSlow = HOST.collab.menu;
    await wait(500);
    pinch(rightH); await wait(120); pinch(rightH); await steps(2); out.pinchRight = HOST.collab.menu;
    await wait(500);
    // two pinches with the left hand's ray on the story's own panel are the panel's, not a toggle (the scene, the
    // flock's sky here, counts as nothing: the double pinches above pointed up into it)
    const pm = HOST.cur.peek('XR.main && XR.main.mesh.visible ? XR.main.mesh.getWorldPosition(new THREE.Vector3()) : null');
    if (pm) {
      const m = new M4().compose(lp, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), pm.clone().sub(lp).normalize()), new V(1, 1, 1));
      X.aim(1, m); left.targetRaySpace = J(m); await steps(3);
      pinch(left); await wait(120); pinch(left); await steps(2); out.pinchOnPanel = HOST.collab.menu;
      X.aim(1, up); left.targetRaySpace = J(up); await steps(3); await wait(500);
    } else out.pinchOnPanel = 'no panel';
    // open (by two pinches), the left hand's ray on the menu: two pinches there are the menu's, not a toggle
    pinch(left); await wait(120); pinch(left); await steps(3);
    const lo = headNow().add(new V(-0.15, -0.25, -0.1)), onMenu = () => { const m = new M4().compose(lo, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), mid().sub(lo).normalize()), new V(1, 1, 1)); X.aim(1, m); left.targetRaySpace = J(m); };
    onMenu(); await steps(3); onMenu(); await steps(2);
    pinch(left); await wait(120); onMenu(); pinch(left); await steps(2); out.pinchOnMenu = HOST.collab.menu;
    X.aim(1, up); left.targetRaySpace = J(up); await steps(3);
    // a fingertip on Exit (under Settings): hovered 4 cm in front of it, pressed within 1.5 cm, once, again after pulling back
    HOST.collab.menuTab('settings'); await steps(3);
    out.finger = HOST.collab.menu && O.panelG.visible;
    const s = X.session, e0 = s.end; let n = 0; s.end = () => { n++; };
    const r = S.regions.find(x => x.id === 'exit'), Hh = S.mw * S.h / S.w;
    if (!r) { out.noExit = HOST.collab.menuIds(); HOST.collab.panelOpen(false); return out; }   // (the menu not open: say so, not crash)
    const onExit = d => S.mesh.localToWorld(new V((r.x + r.w / 2) / S.w * S.mw - S.mw / 2, (0.5 - (r.y + r.h / 2) / S.vis) * Hh, d / O.panelG.scale.x));
    tipAt(onExit(0.04)); await steps(2); out.pokeHover = S.hover;
    tipAt(onExit(0.005)); await steps(2); out.poke1 = n; await steps(2); out.poke1b = n;
    tipAt(onExit(0.04)); await steps(2); tipAt(onExit(0.005)); await steps(2); out.poke2 = n;
    // a poke and a pinch on the ray at the same button at once press it once; a pinch a second later is its own
    const cr = HOST.cur.peek('XR.ctrls')[0], ro2 = headNow().add(new V(0.1, -0.2, 0)), rd = onExit(0).sub(ro2).normalize();
    cr.src = cr.src || { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: null };
    cr.g.visible = true; cr.g.matrix.compose(ro2, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), rd), new V(1, 1, 1));
    tipAt(onExit(0.04)); await steps(3);
    const n3 = n;
    tipAt(onExit(0.005)); await steps(1); cr.wantPress = true; await steps(4); out.pokePinch = n - n3;
    await new Promise(r => setTimeout(r, 800)); cr.wantPress = true; await steps(4); out.pinchLater = n - n3;
    cr.g.visible = false;
    if (e0) s.end = e0; else delete s.end;
    tipAt(head.clone().add(new V(0.3, -0.3, -0.2))); await steps(2);
    HOST.collab.panelOpen(false);
    for (const k of [0, 1]) { const c = HOST.cur.peek('XR.ctrls')[k]; c.g.visible = false; c.src = null; }
    X.session.inputSources.length = 0;
    await steps(3);
    return out;
  });
  check('headset: a click of the left stick opens the menu floating in front of you (0.8 m ahead, a little below your eyes, turned to you; Close and the four tabs at its top) and closes it again; so does the right stick\'s',
    hand.closed && hand.stick && hand.float.dist > 0.72 && hand.float.dist < 0.9 && hand.float.ahead > 0.95 && hand.float.faces > 0.95 && Math.abs(hand.pscale - 1.05) < 1e-6 &&
    hand.ids.join() === 'close,tab:story,tab:settings,tab:circles,tab:debug' && hand.stickClosed && hand.rstick && hand.rstickClosed, JSON.stringify(hand));
  check('headset: the grip carries the menu; let go, it stays where it was put (also with the head turned away) and opens there again next time',
    hand.grab && hand.put && hand.carried > 0.2 && hand.pos.pinned && !!hand.kept && hand.pinnedStill < 1e-3 && Math.abs(hand.again.flat - hand.againWant) < 0.03 && hand.again.faces > 0.95, JSON.stringify(hand));
  check('headset: unused, the menu closes by itself; a ray resting on it keeps it open; it stays open while calibrating', hand.idleClosed && hand.idleHeld && hand.idleAfter && hand.idleCalib, JSON.stringify(hand));
  check('headset: the menu stays put as you look about a little and glides back in front once you have turned further', hand.still < 1e-3 && hand.follow.ahead > 0.95 && hand.follow.faces > 0.95, JSON.stringify(hand));
  check('headset: with tracked hands two quick pinches of the left hand pointing at no panel (the scene counts as nothing) open and close the menu (not one, not two slow ones, not the right hand\'s, not the left\'s on the story\'s panel or on the menu)',
    hand.handClosed && hand.pinch2 && hand.pinch2Closed && !hand.pinch1 && !hand.pinchSlow && !hand.pinchRight && hand.pinchOnPanel === false && hand.pinchOnMenu, JSON.stringify(hand));
  check('headset: the right index fingertip presses the menu\'s buttons by touch (once, again after pulling back)',
    hand.finger && hand.pokeHover === 'exit' && hand.poke1 === 1 && hand.poke1b === 1 && hand.poke2 === 2, JSON.stringify(hand));
  check('headset: a fingertip poke and a pinch on the ray at the same button press it once (a pinch a second later again)', hand.pokePinch === 1 && hand.pinchLater === 2, JSON.stringify(hand));
  await frames(H, 150);
  // the room frame moves (newer marks elsewhere): this headset follows within a second
  ROOM = [2.05, 0, 1, 0.3];
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now()));
  await frames(H, 900);
  const fr2 = await H.evaluate(() => HOST.room.frame.o), wantO2 = unapply(FLOOR, ROOM.slice(0, 3));
  check('headset: re-aligns when the published frame moves more than 3 cm', near(fr2, [wantO2[0], 0, wantO2[2]], 1e-4), `${fmt(fr2)} want ${fmt(wantO2)}`);
  // walk on to another station: placed there, with that station's clock and state
  const S2 = await stationFor(OTHER_STORY);
  await H.evaluate(() => window.__xr.ctrl(0, null));
  const sw2 = await walk(H, S2, OTHER_STORY, 1);
  const rig2 = await rigOf(H), want2 = rigAt(S2);
  check(`headset: walking on to ${OTHER_STORY} switches again, placed at its station`, sw2 && near(rig2.slice(0, 3), want2.slice(0, 3), 1e-4) && angle(rig2[3], want2[3]) < 1e-4,
    `story ${await H.evaluate(() => HOST.curKey)}, rig ${fmt(rig2)}, want ${fmt(want2)}`);
  const keys2 = (await roomInfo(code)).keys, x2 = keys2['st.' + S2.id + '.x'], mode2 = (keys2['st.' + S2.id + '.play'] || { v: {} }).v.mode;
  check(`headset: and ${OTHER_STORY}'s clock and explore state apply there`, !!x2 && await until(H, ([s, m]) => HOST.cur.peek('APP.mode') === m && JSON.stringify(HOST.cur.collab.state()) === s, [JSON.stringify(x2.v), mode2], 3000),
    `room ${x2 && JSON.stringify(x2.v)}, headset ${await stateOf(H)}`);
  // in explore mode at a station the scene's view (how it is turned and sized: where it stands in the room) is
  // shared by the headsets there: this one publishes its view, glides to one published by someone else, and a turn
  // made here goes out (the room's value: { v, story }, with ts while it turns)
  const kv = 'st.' + S2.id + '.view', viewV = e => (e && e.v && e.v.v) || null;
  await H.evaluate(() => { if (HOST.cur.peek('APP.mode') !== 'explore') HOST.cur.peek('APP.enterExplore()'); });
  // (the view syncs on the headset's frames: wait while driving them)
  const viewIs = async want => { for (let k = 0; k < 24; k++) { if (await H.evaluate(w => { const v = HOST.cur.collab.view(); return !!v && JSON.stringify(v) === w; }, JSON.stringify(want))) return true; await frames(H, 250); } return false; };
  let v0 = null;
  for (let k = 0; k < 20 && !v0; k++) { await frames(H, 250); v0 = await H.evaluate(() => HOST.cur.collab.view()); }
  for (let k = 0; k < 12 && JSON.stringify(viewV((await roomInfo(code)).keys[kv])) !== JSON.stringify(v0); k++) await frames(H, 250);
  const pub0 = viewV((await roomInfo(code)).keys[kv]);
  const v1 = [v0[0] > 0 ? v0[0] - 12 : v0[0] + 12, Math.round(((v0[1] + 220) % 360 - 180) * 10) / 10, Math.round(v0[2] * 0.8 * 100) / 100, v0[3], v0[4]];
  await A.evaluate(([k, v]) => HOST.collab.publish([[k, v]]), [kv, { v: v1, story: OTHER_STORY }]);   // (no ts: it glides in)
  const got1 = await viewIs(v1);
  await H.evaluate(() => { const o = HOST.cur.peek('orbit'); o.to = null; o.cur[1] += 25; });
  const v2 = await H.evaluate(() => HOST.cur.collab.view());
  for (let k = 0; k < 12 && JSON.stringify(viewV((await roomInfo(code)).keys[kv])) !== JSON.stringify(v2); k++) await frames(H, 250);
  const pub2 = viewV((await roomInfo(code)).keys[kv]);
  check(`headset: in explore mode at a station the scene's view is shared (${OTHER_STORY}: published, followed, a turn here goes out)`,
    !!v0 && JSON.stringify(pub0) === JSON.stringify(v0) && got1 && JSON.stringify(pub2) === JSON.stringify(v2), JSON.stringify({ v0, pub0, v1, got1, v2, pub2 }));
  // in a shared room the story panel has no Stories button (at a station too), and a Stories screen left open closes by
  // itself (the story goes on as the room has it)
  const sb = await H.evaluate(async () => {
    const X = window.__xr, ids = () => HOST.cur.peek('XR.main.regions.map(r => r.id)');
    HOST.cur.peek('(XR.main.last = "", XR.main.t = -1e9, panelTick(XR.main, performance.now() + 1e6))');
    const none = ids().length > 0 && !ids().includes('stories'), mode = HOST.cur.peek('APP.mode');
    HOST.cur.peek('(XR.stories = true)');
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); }
    return { none, closed: !HOST.cur.peek('XR.stories'), same: HOST.cur.peek('APP.mode') === mode, ids: ids() };
  });
  check('headset: in a shared room no Stories button at a station either, and a Stories screen closes by itself (the story goes on)', sb.none && sb.closed && sb.same, JSON.stringify(sb));
  // the scene and the panel at a station: both grips on the scene resize it (and move it with their middle), one grip
  // on the panel moves it; it goes out to the room (st.<id>.place, st.<id>.panel) and comes back from it, gliding
  const kPl = 'st.' + S2.id + '.place', kPn = 'st.' + S2.id + '.panel';
  const pl = await H.evaluate(async () => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z), wait = () => new Promise(r => setTimeout(r, 30));
    const at = (i, x, y, z) => X.aim(i, new THREE.Matrix4().makeTranslation(x, y, z));
    const grab = (i, kind, on) => HOST.cur.peek(`(c => { if (${on}) c.hover = ${kind === 'panel' ? '{ kind: "panel", P: XR.main, x: 10, y: 10, point: XR.main.mesh.getWorldPosition(new THREE.Vector3()) }' : '{ kind: "globe", i: -1, point: c.o.clone() }'}; xrGrab(c, ${on}); })(XR.ctrls[${i}])`);
    const R = HOST.cur.peek('GL.rig'), o = V(0, -0.2, -0.6).applyMatrix4(R.matrixWorld);
    at(0, o.x - 0.1, o.y, o.z); at(1, o.x + 0.1, o.y, o.z);
    X.step(); X.step();
    const s0 = HOST.cur.peek('XR.size');
    grab(0, 'globe', true); grab(1, 'globe', true);
    for (let k = 0; k < 3; k++) { X.step(); await wait(); }
    at(0, o.x - 0.2, o.y + 0.1, o.z); at(1, o.x + 0.2, o.y + 0.1, o.z);   // twice as far apart, 10 cm higher
    for (let k = 0; k < 8; k++) { X.step(); await wait(); }
    const mid = { size: HOST.cur.peek('XR.size'), off: HOST.cur.peek('XR.globeOff.toArray()'), held: HOST.cur.xrPose().held };
    grab(1, 'globe', false);
    for (let k = 0; k < 2; k++) { X.step(); await wait(); }
    at(0, o.x - 0.2, o.y + 0.1, o.z - 0.3);   // the other hand carries on alone: 30 cm further
    for (let k = 0; k < 6; k++) { X.step(); await wait(); }
    grab(0, 'globe', false);
    for (let k = 0; k < 4; k++) { X.step(); await wait(); }
    const one = { size: HOST.cur.peek('XR.size'), off: HOST.cur.peek('XR.globeOff.toArray()') };
    // the panel, with one grip
    const p0 = HOST.cur.peek('XR.panelGroup.position.toArray()');
    const pw = HOST.cur.peek('XR.main.mesh.getWorldPosition(new THREE.Vector3())');
    at(0, pw.x, pw.y, pw.z + 0.3); X.step(); grab(0, 'panel', true);
    at(0, pw.x + 0.25, pw.y, pw.z + 0.3);
    for (let k = 0; k < 6; k++) { X.step(); await wait(); }
    grab(0, 'panel', false);
    for (let k = 0; k < 4; k++) { X.step(); await wait(); }
    X.ctrl(0, null); X.ctrl(1, null);
    return { s0, mid, one, p0, p1: HOST.cur.peek('XR.panelGroup.position.toArray()') };
  });
  for (let k = 0; k < 10 && !((await roomInfo(code)).keys[kPl] && (await roomInfo(code)).keys[kPn]); k++) await frames(H, 200);
  const rk = (await roomInfo(code)).keys, rPl = rk[kPl] && rk[kPl].v, rPn = rk[kPn] && rk[kPn].v;
  check('headset: both grips on the scene resize it (twice as far apart: twice the size) and move it with their middle; one hand carries on alone',
    Math.abs(pl.mid.size - 2 * pl.s0) < 0.02 && pl.mid.held && Math.abs(pl.mid.off[1] - 0.1) < 0.01 && Math.abs(pl.one.size - pl.mid.size) < 1e-6 &&
    Math.abs(Math.hypot(...pl.one.off.map((v, k) => v - pl.mid.off[k])) - 0.3) < 0.03, JSON.stringify(pl));
  check('headset: the scene\'s place and size and the moved panel go out to the room', !!rPl && Math.abs(rPl.s - pl.one.size) < 0.002 &&
    near([rPl.x, rPl.y, rPl.z], pl.one.off, 2e-3) && !!rPn && Math.abs(rPn.x - pl.p1[0]) < 2e-3 && Math.abs(rPn.y - 1.6 - pl.p1[1]) < 2e-3 &&
    Math.hypot(...pl.p1.map((v, k) => v - pl.p0[k])) > 0.2, JSON.stringify({ rPl, rPn, pl }));
  // someone else's: it glides in here
  await A.evaluate(([a, b]) => HOST.collab.publish([[a, { x: 0.2, y: 0.1, z: -0.3, s: 0.5 }], [b, { x: -0.7, y: 1.5, z: -0.6, yaw: 0.4 }]]), [kPl, kPn]);
  const pglide = await H.evaluate(async () => {
    const X = window.__xr, seen = [];
    const there = () => HOST.cur.peek('XR.size === 0.5 && XR.panelGroup.position.distanceTo(new THREE.Vector3(-0.7, -0.1, -0.6)) < 1e-6 && XR.globeOff.distanceTo(new THREE.Vector3(0.2, 0.1, -0.3)) < 1e-6');
    for (let k = 0; k < 150 && !there(); k++) { X.step(); await new Promise(r => setTimeout(r, 16)); seen.push(HOST.cur.peek('XR.size')); }
    return { size: HOST.cur.peek('XR.size'), off: HOST.cur.peek('XR.globeOff.toArray()'), pp: HOST.cur.peek('XR.panelGroup.position.toArray()'), pr: HOST.cur.peek('XR.panelGroup.rotation.y'),
      between: seen.some(v => v > 0.52 && v < 1.9), frames: seen.length };
  });
  check('headset: a place, size and panel from someone else pglide in', Math.abs(pglide.size - 0.5) < 1e-3 && near(pglide.off, [0.2, 0.1, -0.3], 2e-3) &&
    near(pglide.pp, [-0.7, -0.1, -0.6], 2e-3) && Math.abs(pglide.pr - 0.4) < 3e-3 && pglide.between, JSON.stringify(pglide));
  // Recenter at its station (the owner, 30 October 2026): the menu's and the story's own (the panel's button, the hook the
  // menu calls) take the station's place and panel out of the room, so the scene and the panel glide back where the story
  // puts them, for everyone at its circle; refused while its story is locked (a notice; the menu's Recenter greyed); in
  // explore mode the view goes back to where the story put it there, not to one glided to from the room
  const rcHome = () => H.evaluate(async s0 => {
    const X = window.__xr, there = () => HOST.cur.peek(`Math.abs(XR.size - ${s0}) < 1e-3 && XR.globeOff.length() < 1e-3`);
    for (let k = 0; k < 150 && !there(); k++) { X.step(); await new Promise(r => setTimeout(r, 16)); }
    return { size: HOST.cur.peek('XR.size'), off: HOST.cur.peek('XR.globeOff.toArray()'), pp: HOST.cur.peek('XR.panelGroup.position.toArray()') };
  }, pl.s0);
  const rcMenu = () => H.evaluate(async () => {
    const X = window.__xr;
    HOST.collab.panelOpen(true);
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); }
    const r = HOST.collab.menuFind('recenter'), ok = !!(r && r.fn);
    if (ok) r.fn();
    HOST.collab.panelOpen(false); X.step();
    return ok;
  });
  const rcLeft = () => roomInfo(code).then(r => [kPl, kPn].filter(k => r.keys[k]));
  const rcA = await rcMenu();
  await until(A, ([a, b]) => !HOST.collab.val(a) && !HOST.collab.val(b), [kPl, kPn], 3000);
  const rcH1 = await rcHome(), rcL1 = await rcLeft();
  check('headset: Recenter in the menu at its station takes its place and panel out of the room, and the scene and the panel glide back where the story puts them',
    rcA && !rcL1.length && Math.abs(rcH1.size - pl.s0) < 1e-3 && near(rcH1.off, [0, 0, 0], 1e-3) && near(rcH1.pp, pl.p0, 2e-3), JSON.stringify({ rcA, rcL1, rcH1, p0: pl.p0 }));
  const rcPut = () => A.evaluate(([a, b]) => HOST.collab.publish([[a, { x: 0.2, y: 0.1, z: -0.3, s: 0.5 }], [b, { x: -0.7, y: 1.5, z: -0.6, yaw: 0.4 }]]), [kPl, kPn]);
  const rcMoved = () => until(H, () => { window.__xr.step(); return HOST.cur.peek('Math.abs(XR.size - 0.5) < 1e-3'); }, null, 6000);
  await rcPut(); await rcMoved();
  const rcB = await H.evaluate(() => HOST.cur.recenter());
  const rcH2 = await rcHome(), rcL2 = await rcLeft();
  check('headset: and the story\'s own Recenter (its panel\'s button) does the same there', rcB === true && !rcL2.length && Math.abs(rcH2.size - pl.s0) < 1e-3, JSON.stringify({ rcB, rcL2, rcH2 }));
  // locked: refused, a notice, the menu's Recenter greyed, the room keeps it
  await rcPut(); await rcMoved();
  await A.evaluate(id => HOST.collab.setStationLock(id, true), S2.id);
  await until(H, id => HOST.collab.stationLock(id), S2.id, 3000);
  const rcC = await H.evaluate(() => HOST.cur.recenter()), rcCm = await rcMenu();
  await frames(H, 300);
  const rcLk = await H.evaluate(() => ({ note: (window.__collabLog.filter(e => e.ev === 'notice').slice(-1)[0] || {}).title, size: HOST.cur.peek('XR.size') })), rcL3 = await rcLeft();
  await A.evaluate(id => HOST.collab.setStationLock(id, false), S2.id);
  await until(H, id => !HOST.collab.stationLock(id), S2.id, 3000);
  check('headset: Recenter is refused while its story is locked (a notice says so; the menu\'s Recenter greyed; the room keeps its place and panel)',
    rcC === false && !rcCm && rcLk.note === 'This story is locked' && Math.abs(rcLk.size - 0.5) < 1e-3 && rcL3.length === 2, JSON.stringify({ rcC, rcCm, rcLk, rcL3 }));
  // explore mode: the view goes back to where the story put it (not one glided to from the room), for everyone there
  const rcKv = 'st.' + S2.id + '.view', rcKp = 'st.' + S2.id + '.play', rcPlay = (await roomInfo(code)).keys[rcKp].v;
  await A.evaluate(k => HOST.collab.publish([[k, { mode: 'explore', t: 0, playing: false, at: Math.round(HOST.collab.now()) }]]), rcKp);
  const rcV0 = await until(H, () => { window.__xr.step(); return HOST.cur.peek('APP.mode') === 'explore' && !!HOST.cur.collab.view(); }, null, 8000) &&
    await H.evaluate(async () => { for (let k = 0; k < 10; k++) { window.__xr.step(); await new Promise(r => setTimeout(r, 20)); } return HOST.cur.collab.view(); });
  const rcTurned = rcV0 && [rcV0[0] + 10, ((rcV0[1] + 40 + 180) % 360) - 180].concat(rcV0.slice(2));
  if (rcTurned) await A.evaluate(([k, v]) => HOST.collab.publish([[k, { v, story: 'spatial' }]]), [rcKv, rcTurned]);
  const rcThere = !!rcTurned && await until(H, v => { window.__xr.step(); return JSON.stringify(HOST.cur.collab.view()) === JSON.stringify(v); }, rcTurned, 6000);
  const rcD = await H.evaluate(() => HOST.cur.recenter());
  const rcBack = await until(H, v => { window.__xr.step(); return JSON.stringify(HOST.cur.collab.view()) === JSON.stringify(v); }, rcV0, 6000);
  const rcRoom = rcBack && await until(A, ([k, v]) => { const x = HOST.collab.val(k); return !!x && JSON.stringify(x.v) === JSON.stringify(v); }, [rcKv, rcV0], 4000);
  check('headset: in explore mode Recenter also puts the view back where the story put it there (not where the room had turned it), for everyone at its circle',
    !!rcV0 && rcThere && rcD === true && rcBack && rcRoom, JSON.stringify({ rcV0, rcTurned, rcThere, rcD, rcBack, rcRoom, now: await H.evaluate(() => HOST.cur.collab.view()) }));
  await A.evaluate(([k, v]) => HOST.collab.publish([[k, Object.assign({}, v, { at: Math.round(HOST.collab.now()) })]]), [rcKp, rcPlay]);
  await until(H, m => { window.__xr.step(); return HOST.cur.peek('APP.mode') === m; }, rcPlay.mode, 8000);
  await rcPut(); await rcMoved();
  // free moving (the room's setting, on by default): the grip turns the scene with the hand and tilts the panel; the
  // turns go out with the place and the panel (q, to 4 decimals), and the other pages hold the same values
  // degrees between two turns (normalised: the room's are rounded to 4 decimals)
  const qang = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) / Math.hypot(...a) / Math.hypot(...b))) * 180 / Math.PI;
  const fm = await H.evaluate(async () => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z), R = HOST.cur.peek('GL.rig');
    const run = async n => { for (let k = 0; k < n; k++) { X.step(); await new Promise(r => setTimeout(r, 30)); } };
    // controller i at p in the rig's frame, turned yaw about its vertical and pitched (radians)
    const at = (i, p, yaw, pitch) => X.aim(i, new THREE.Matrix4().compose(V(...p).applyMatrix4(R.matrixWorld),
      R.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch || 0, yaw || 0, 0, 'YXZ'))), V(1, 1, 1)));
    const grab = (i, kind, on) => HOST.cur.peek(`(c => { if (${on}) c.hover = ${kind === 'panel' ? '{ kind: "panel", P: XR.main, x: 10, y: 10, point: XR.main.mesh.getWorldPosition(new THREE.Vector3()) }' : '{ kind: "globe", i: -1, point: c.o.clone() }'}; xrGrab(c, ${on}); })(XR.ctrls[${i}])`);
    const free = HOST.xr.free(), rot0 = HOST.cur.peek('XR.rot.toArray()');
    // the scene: held, the hand turned 90 degrees about the vertical as it moves
    at(0, [0.1, -0.2, -0.6]); await run(2);
    grab(0, 'globe', true); await run(2);
    for (let k = 1; k <= 6; k++) { at(0, [0.1 + 0.02 * k, -0.2, -0.6 + 0.01 * k], k * Math.PI / 12); await run(2); }
    grab(0, 'globe', false); await run(6);
    const rot = HOST.cur.peek('XR.rot.toArray()');
    // the panel: held, the hand turned 20 degrees and pitched 30
    const pw = HOST.cur.peek('GL.rig.worldToLocal(XR.main.mesh.getWorldPosition(new THREE.Vector3())).toArray()');
    at(0, [pw[0], pw[1], pw[2] + 0.3]); await run(1); grab(0, 'panel', true);
    at(0, [pw[0] + 0.05, pw[1] + 0.05, pw[2] + 0.3], 20 * Math.PI / 180, 30 * Math.PI / 180); await run(6);
    grab(0, 'panel', false); await run(6);
    X.ctrl(0, null);
    return { free, rot0, rot, want: new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2).multiply(new THREE.Quaternion().fromArray(rot0)).toArray(),
      pq: HOST.cur.peek('XR.panelGroup.quaternion.toArray()'), up: HOST.cur.peek('new THREE.Vector3(0, 1, 0).applyQuaternion(XR.panelGroup.quaternion).y') };
  });
  let rk3 = {};
  for (let k = 0; k < 15; k++) { rk3 = (await roomInfo(code)).keys; if (rk3[kPl] && rk3[kPl].v.q && rk3[kPn] && rk3[kPn].v.q) break; await frames(H, 200); }
  const fq = rk3[kPl] && rk3[kPl].v.q, fpq = rk3[kPn] && rk3[kPn].v.q;
  const vals = await Promise.all([A, B].map(p => p.evaluate(([a, b]) => JSON.stringify([HOST.collab.val(a).q, HOST.collab.val(b).q]), [kPl, kPn])));
  const tilt = Math.acos(Math.min(1, fm.up)) * 180 / Math.PI;
  check('headset: free moving at a station, the grip turns the scene with the hand (90 degrees) and tilts the panel (30 degrees); the turns go out to the room, and the others have the same',
    fm.free && !!fq && !!fpq && qang(fm.rot, fm.want) < 0.05 && qang(fq, fm.rot) < 0.05 && tilt > 25 && tilt < 35 && qang(fpq, fm.pq) < 0.05 &&
    vals.every(v => v === JSON.stringify([fq, fpq])), JSON.stringify({ fm, fq, fpq, vals, tilt }));
  // the headset's menu sets them for everyone in the room: Moving: facing you (the turns go, the scene faces you
  // again and the panel stands upright), then Labels round (in 3D, hidden, on top) and Cards round (on top, hidden, in
  // 3D), each followed by the pages
  const menuPress = id => H.evaluate(async id => {
    const X = window.__xr; X.step(); X.step();
    const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn();
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(res => setTimeout(res, 20)); }
    return !!(r && r.fn);
  }, id);
  await H.evaluate(() => HOST.collab.panelOpen(true));
  const pf = await menuPress('free');
  const offAB = await lookIs(A, 'face,fixed,false') && await lookIs(B, 'face,fixed,false');
  let rk4 = {};
  for (let k = 0; k < 15; k++) { rk4 = (await roomInfo(code)).keys; if (!rk4[kPl].v.q && !rk4[kPn].v.q) break; await frames(H, 200); }
  await frames(H, 100);
  const hOff = await H.evaluate(() => ({ free: HOST.cur.peek('XR.free'), rot: HOST.cur.peek('XR.rot.toArray()'), up: HOST.cur.peek('new THREE.Vector3(0, 1, 0).applyQuaternion(XR.panelGroup.quaternion).y') }));
  check('headset: Moving in the headset\'s menu turns free moving off for everyone: the turns leave the room, the scene faces you again and the panel stands upright',
    pf && offAB && !rk4[kPl].v.q && !rk4[kPn].v.q && !hOff.free && qang(hOff.rot, [0, 0, 0, 1]) < 1e-6 && Math.abs(hOff.up - 1) < 1e-6, JSON.stringify({ pf, offAB, place: rk4[kPl], panel: rk4[kPn], hOff }));
  // what the headset draws of the room in each: the other stations' cards (all of them as if their rings had just been
  // pointed at: in a circle they show only then) and a person's name tag (someone at its circle, injected for a few frames)
  const roomLook = () => H.evaluate(async () => {
    const C = HOST.collab.internals(), id = 'zz-look', O = HOST.collab.overlay();
    if (!C.members.some(m => m.id === id)) C.members.push({ id, name: 'Look', color: '#ff7a59', kind: 'vr', here: false });
    for (const r of O.rings.values()) { r.seenAt = performance.now() + 60000; r.peek = 1; }
    for (let k = 0; k < 4; k++) { C.pres.set(id, { id, at: performance.now(), st: HOST.collab.mine(), head: [1, 1.6, -2, 0, 0, 0, 1], hands: [] }); window.__xr.step(); await new Promise(r => setTimeout(r, 10)); }
    for (const r of O.rings.values()) r.seenAt = 0;
    const o = O.people.get(id), f = m => ({ vis: m.visible, dt: m.material.depthTest, dw: m.material.depthWrite, at: m.material.alphaTest, ro: m.renderOrder });
    const out = { cards: [...O.cards.values()].map(c => Object.assign(f(c.mesh), { back: c.back.renderOrder, same: c.back.material === c.mesh.material, v: c.mesh.material.version })),
      tag: o ? f(o.tag) : null, sign: o ? { vis: o.sign.visible, faces: o.sign.children.map(f) } : null,
      menu: [O.panel, O.note].map(S => !S.mesh.material.depthTest && S.mesh.renderOrder > 50) };
    C.pres.delete(id); C.members = C.members.filter(m => m.id !== id);
    return out;
  });
  const lseen = [], cseen = [], looks = {}, lab = {};
  for (let k = 0; k < 3; k++) {
    const ok = await menuPress('labels'), w = await H.evaluate(() => HOST.xr.labels());
    lseen.push(w + '/' + await peek(H, 'XR.lm') + (ok && await lookIs(A, w + ',fixed,false') && await lookIs(C, w + ',fixed,false') ? '' : ' (not on the pages)'));
    lab[w] = await roomLook();   // (the cards stay in 3D whatever the labels)
  }
  check('headset: Labels in the headset\'s menu goes round (in 3D, hidden, on top), for its story and every page in the room, the cards staying in 3D',
    lseen.join() === 'fixed/fixed,hidden/hidden,face/face', lseen.join(', '));
  for (let k = 0; k < 3; k++) {
    const ok = await menuPress('cards'), w = await H.evaluate(() => HOST.xr.cards());
    cseen.push(w + '/' + await peek(H, 'XR.cm') + (ok && await lookIs(A, 'face,' + w + ',false') && await lookIs(C, 'face,' + w + ',false') ? '' : ' (not on the pages)'));
    looks[w] = await roomLook();
    if (w === 'fixed') looks.again = await roomLook();
  }
  check('headset: Cards in the headset\'s menu goes round (on top, hidden, in 3D), for its story and every page in the room, the labels staying on top',
    cseen.join() === 'face/face,hidden/hidden,fixed/fixed' && await H.evaluate(() => HOST.xr.labels() === 'face' && HOST.cur.peek('XR.lm') === 'face'), cseen.join(', '));
  // on top the cards are drawn after the scenes (before the story's panels, depth-tested) and the tag is a sprite over
  // everything, as before; in 3D both are drawn as the labels' signs are (first of the see-through things, writing
  // depth, their clear corners cut away; both faces), so a glowing or glass model in front hides them, and their
  // materials are built again only when the mode changes; hidden, neither is drawn. The menu, its clock and the
  // shell's note stay on top in every mode. The labels' own setting leaves them as they are
  const LK = looks, cardsAre = (L, want) => !!L && L.cards.length > 5 && L.cards.every(c => c.same && want(c));
  const in3D = L => cardsAre(L, c => c.vis && c.dt && c.dw && c.at > 0 && c.ro === -1 && c.back === -1) && L.tag && !L.tag.vis && L.sign.vis;
  check('headset: the station cards and a person\'s name tag follow Cards, not Labels: in 3D with every label mode',
    ['fixed', 'hidden', 'face'].every(m => in3D(lab[m])), JSON.stringify(['fixed', 'hidden', 'face'].map(m => lab[m] && { tag: lab[m].tag, sign: lab[m].sign.vis, card: lab[m].cards[0] })));
  check('headset: the other stations\' cards and a person\'s name tag are on top as before with cards on top, drawn in the scene as the labels\' signs are with cards in 3D, and not drawn with cards hidden; the menu stays on top',
    cardsAre(LK.face, c => c.vis && c.dt && !c.dw && !c.at && c.ro === 49 && c.back === 49) && LK.face.tag && LK.face.tag.vis && !LK.face.tag.dt && LK.face.tag.ro > 50 && !LK.face.sign.vis &&
    cardsAre(LK.fixed, c => c.vis && c.dt && c.dw && c.at > 0 && c.ro === -1 && c.back === -1) && LK.fixed.tag && !LK.fixed.tag.vis && LK.fixed.sign.vis &&
    LK.fixed.sign.faces.length === 2 && LK.fixed.sign.faces.every(x => x.dt && x.dw && x.at > 0 && x.ro === -1) &&
    LK.again.cards.every((c, i) => c.v === LK.fixed.cards[i].v) &&
    !!LK.hidden && LK.hidden.cards.every(c => !c.vis) && LK.hidden.tag && !LK.hidden.tag.vis && !LK.hidden.sign.vis &&
    ['face', 'fixed', 'hidden'].every(m => LK[m] && LK[m].menu.every(Boolean)),
    JSON.stringify({ face: LK.face && Object.assign({}, LK.face, { cards: LK.face.cards.slice(0, 2) }), fixed: LK.fixed && Object.assign({}, LK.fixed, { cards: LK.fixed.cards.slice(0, 2) }),
      hidden: LK.hidden && Object.assign({}, LK.hidden, { cards: LK.hidden.cards.slice(0, 2) }) }));
  // panels per station: set on a page for the station the headset stands at, it follows (controls only: the foot bar
  // alone); the station it is not at keeps its own
  const hPanels = () => H.evaluate(() => { window.__xr.step(); HOST.cur.peek('xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS)');
    return [HOST.curKey, HOST.panels.get(HOST.curKey), HOST.cur.peek('XR.main.mesh.visible') ? 'main' : '-', HOST.cur.peek('XR.foot.mesh.visible') ? 'foot' : '-'].join(); });
  await B.evaluate(id => HOST.collab.setStationPanels(id, 'controls'), S2.id);
  const hp1 = await until(H, () => { window.__xr.step(); return HOST.panels.get(HOST.curKey) === 'controls'; }, null, 3000) && await hPanels();
  const hp1o = await H.evaluate(id => HOST.collab.stationPanels(id), S1.id);
  check('headset: a station\'s panels set on a page reach the headset at its circle (controls only: the foot bar alone); another station keeps its own',
    hp1 === `${OTHER_STORY},controls,-,foot` && hp1o === 'shown', JSON.stringify({ hp1, hp1o }));
  await H.evaluate(() => HOST.collab.panelOpen(false));
  await A.evaluate(() => HOST.xr.setFree(true));
  check('headset: and free moving on again from a page', await until(H, () => { window.__xr.step(); return HOST.xr.free() && HOST.cur.peek('XR.free'); }, null, 3000));
  // the circles lock never locks a scene or a panel; the story's own lock (set on a page for this station: for everyone
  // at its circle) stops the grip on both
  const tryGrip = () => H.evaluate(() => {
    const X = window.__xr;
    X.aim(0, new THREE.Matrix4().makeTranslation(0, 1.4, -0.4)); X.step();
    HOST.cur.peek('(c => { c.hover = { kind: "globe", i: -1, point: c.o.clone() }; xrGrab(c, true); })(XR.ctrls[0])');
    const g = HOST.cur.peek('!!XR.ctrls[0].grab');
    HOST.cur.peek('xrGrab(XR.ctrls[0], false)'); X.ctrl(0, null);
    return { locked: HOST.anchor.locked('globe') || HOST.anchor.locked('panel'), grabbed: g, hint: HOST.room.gripHint };
  });
  await A.evaluate(() => HOST.collab.lock(true));
  await until(H, () => HOST.collab.locked, null, 3000);
  const freeG = await tryGrip();
  await A.evaluate(() => HOST.collab.lock(false));
  await A.evaluate(id => HOST.collab.setStationLock(id, true), S2.id);
  const lockSeenG = await until(H, id => HOST.collab.stationLock(id), S2.id, 3000);
  const lockG = await tryGrip();
  // (and the menu's Panels row, not locked with the story, sets this station's for everyone at its circle: hidden)
  await H.evaluate(() => HOST.collab.panelOpen(true));
  const pp = await menuPress('panels');
  await H.evaluate(() => HOST.collab.panelOpen(false));
  const hp2 = pp && await until(A, id => HOST.collab.stationPanels(id) === 'hidden', S2.id, 3000) && await hPanels();
  const uiL = (await roomInfo(code)).keys['st.' + S2.id + '.ui'].v;
  await A.evaluate(id => HOST.collab.setStationLock(id, false), S2.id);
  check('headset: the circles lock leaves the grip on the scene and the panel free at its station', !freeG.locked && freeG.grabbed && !/locked/.test(freeG.hint), JSON.stringify(freeG));
  check('headset: while its story is locked (from a page) the grip moves no scene and no panel (and the panel says so)', lockSeenG && lockG.locked && !lockG.grabbed && /locked/.test(lockG.hint),
    JSON.stringify(lockG));
  check('headset: the menu\'s Panels row sets its station\'s panels for everyone at its circle, also with the story locked (hidden: neither panel; the lock kept)',
    hp2 === `${OTHER_STORY},hidden,-,-` && uiL.panels === 'hidden' && uiL.lock === true, JSON.stringify({ pp, hp2, uiL }));
  check('headset: and back again', await walk(H, S1, HEADSET_STORY, 0));
  const hp3 = await hPanels();
  check('headset: at the other station its own panels (shown), the first station\'s kept (hidden)', hp3 === `${HEADSET_STORY},shown,main,foot` &&
    await A.evaluate(id => HOST.collab.stationPanels(id), S2.id) === 'hidden', hp3);
  await A.evaluate(id => HOST.collab.setStationPanels(id, 'shown'), S2.id);
  // the design room: the menu's button in a room, its station, the icons from the miniatures (then back to S1)
  await headsetDesign(A, B, H, S1, '');
  check('headset: back at its station after the design room', await walk(H, S1, HEADSET_STORY, 0));
  // Remove on the headset panel asks first: the first press only arms it (for 3 s), the station stays
  await H.evaluate(() => HOST.collab.panelOpen(true));
  await frames(H, 150);
  const rm1 = await H.evaluate(() => { const r = HOST.collab.menuFind('remove'); if (r) r.fn(); return !!r; });
  await frames(H, 150);
  const rmLabel = await H.evaluate(() => HOST.collab.internals().rm && HOST.collab.internals().rm.id);
  await sleep(3200);
  await frames(H, 100);
  const rmAfter = await H.evaluate(id => [!!HOST.collab.station(id), HOST.collab.internals().rm && performance.now() < HOST.collab.internals().rm.until], S1.id);
  check('headset: Remove asks first (one press arms it for 3 s, the station stays)', rm1 && rmLabel === S1.id && rmAfter[0] && !rmAfter[1], JSON.stringify([rm1, rmLabel, rmAfter]));
  await H.evaluate(() => HOST.collab.panelOpen(false));
  await H.evaluate(() => window.__xr.end());
  const quietAfter = await H.evaluate(() => { const A = HOST.audio.state(); return { pan: !!A.pan, vol: A.el.volume, held: HOST.anchor.held(), lock: HOST.anchor.locked('globe'), shell: HOST.anchor.locked('shell') }; });
  check('headset: after the session no sound zone and no hold (all as outside a room)', !quietAfter.pan && quietAfter.vol === 1 && !quietAfter.held && !quietAfter.lock, JSON.stringify(quietAfter));
  check('headset: the grip on the shell\'s own things never moves the scene', quietAfter.shell);

  // ----------------------------------------- calibration from two marks --
  // a headset without a shared space and without saved marks: calibrate, touching mark A then mark B
  await H.evaluate(() => { localStorage.removeItem('roomFrame'); HOST.room.internals().saved = null; });
  await H.evaluate(installXR, Object.assign({}, xrOpts, { features: ['local-floor', 'anchors'] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 300);
  check('calibration: a headset with no shared space and no marks asks to calibrate', await H.evaluate(() => HOST.room.state === 'calibrate'), await H.evaluate(() => HOST.room.state));
  check('a new session sees no story until it walks into a circle (the last session\'s station is not its own)', await H.evaluate(() => !HOST.collab.mine() && !HOST.collab.live() && HOST.room.away()),
    JSON.stringify(await H.evaluate(() => [HOST.collab.mine(), !!HOST.collab.live(), HOST.room.away()])));
  const markA = [1.0, TIP, -0.4], markB = [2.2, TIP, 0.9];   // (floor spots)
  const touch = async p => {   // held still on the mark, then the trigger (a second pull within 0.6 s would be ignored)
    await H.evaluate(p => window.__xr.ctrl(0, p, [0, -1, 0]), p); await frames(H, 650);
    await H.evaluate(() => HOST.cur.peek('XR.ctrls[0].wantPress = true')); await frames(H, 100);
  };
  // pressed by mistake: the panel's Stop calibrating still takes the trigger (no mark is taken)
  await H.evaluate(() => { HOST.room.calibrate(); HOST.collab.panelOpen(true); });
  await frames(H, 200);
  await H.evaluate(() => HOST.collab.menuFind('cal'));   // (under Debug: that tab shown, and drawn, before it is aimed at)
  await frames(H, 200);
  const stopAt = await H.evaluate(() => {
    const S = HOST.collab.overlay().panel, r = HOST.collab.menuFind('cal');
    if (!r || !S.mesh.parent.visible) return null;
    S.mesh.parent.updateMatrixWorld(true);   // (where the menu is now)
    const H = S.mw * S.h / S.w, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    return S.mesh.localToWorld(new THREE.Vector3((cx / S.w - 0.5) * S.mw, (0.5 - cy / S.vis) * H, 0)).toArray();
  });
  if (stopAt) await press(stopAt);
  const stopped = await H.evaluate(() => [HOST.room.state, !!HOST.room.internals().calib, !!HOST.room.frame]);
  check('calibration: while calibrating, the panel\'s Stop calibrating still works (the press takes no mark)', !!stopAt && stopped[0] === 'calibrate' && !stopped[1] && !stopped[2], JSON.stringify(stopped));
  await H.evaluate(() => { HOST.collab.panelOpen(false); window.__xr.ctrl(0, null); });
  await frames(H, 100);
  await H.evaluate(() => HOST.room.calibrate());
  // mark A, and at once (in the same moment of the page, so no slow frame between puts it past the 0.6 s) a second pull
  await H.evaluate(p => window.__xr.ctrl(0, p, [0, -1, 0]), markA); await frames(H, 650);
  const [stA, dbl] = await H.evaluate(p => {
    const X = window.__xr;
    HOST.cur.peek('XR.ctrls[0].wantPress = true');
    for (let k = 0; k < 20 && HOST.room.state !== 'mark-b'; k++) X.step();
    const a = HOST.room.state;
    X.ctrl(0, p, [0, -1, 0]); HOST.cur.peek('XR.ctrls[0].wantPress = true'); X.step();
    return [a, HOST.room.state];
  }, markB);
  check('calibration: a second pull right after a mark (a double pull) is ignored', dbl === 'mark-b' &&
    await H.evaluate(() => window.__collabLog.some(e => e.ev === 'mark ignored')), dbl);
  await touch([markA[0] + 0.1, markA[1], markA[2] + 0.05]);
  const stClose = await H.evaluate(() => HOST.room.state);
  await touch(markB);
  // the anchors at A and B are made, checked against the marks, and their handles saved
  const keptMarks = () => H.evaluate(() => { const s = JSON.parse(localStorage.getItem('roomFrame') || 'null'); return !!(s && s.anchors && s.anchors.length === 2); });
  for (let k = 0; k < 12 && !(await keptMarks()); k++) await frames(H, 250);
  const cal = await H.evaluate(() => ({ frame: HOST.room.frame, src: HOST.room.src, saved: JSON.parse(localStorage.getItem('roomFrame') || 'null'), made: window.__xr.made,
    mk: HOST.room.marks, line: HOST.room.sourceLine() }));
  const fa = unapply(FLOOR, markA), fb = unapply(FLOOR, markB), cx = unit([fb[0] - fa[0], 0, fb[2] - fa[2]]), dAB = Math.hypot(fb[0] - fa[0], fb[2] - fa[2]);
  check('calibration: mark A, then a mark B too close is refused', stA === 'mark-b' && stClose === 'mark-b', `${stA}, ${stClose}`);
  check('calibration: two marks give the expected frame (A the origin, A to B the x axis)', cal.src === 'marks' && near(cal.frame.o, [fa[0], 0, fa[2]], 2e-3) && near(cal.frame.x, cx, 2e-3),
    `${cal.src} o ${fmt(cal.frame ? cal.frame.o : [])} x ${fmt(cal.frame ? cal.frame.x : [])}, want ${fmt(fa)} ${fmt(cx)}`);
  check('calibration: saved with two anchors, at mark A and at mark B (their handles kept, no coordinates trusted alone)', cal.saved && cal.saved.v === 2 &&
    near(cal.saved.a, fa, 2e-3) && near(cal.saved.b, fb, 2e-3) && cal.saved.anchors.length === 2 && cal.saved.anchors.every(Boolean) && cal.made.length === 2 &&
    cal.made.every(m => m.space === 'local-floor') && near(cal.made[0].p, fa, 2e-3) && near(cal.made[1].p, fb, 2e-3), JSON.stringify({ saved: cal.saved, made: cal.made }));
  check('calibration: the marks are drawn where they were touched (A at the origin, B along x), and the panel says the room rests on them',
    !!cal.mk && Math.abs(cal.mk[0] - fa[1]) < 2e-3 && Math.abs(cal.mk[1] - dAB) < 2e-3 && Math.abs(cal.mk[2] - fb[1]) < 2e-3 && /own marks, held by two anchors/.test(cal.line),
    JSON.stringify({ mk: cal.mk, line: cal.line, want: [fa[1], dAB, fb[1]] }));
  // the room's floor: floor spots set it, the floor under them (key rm: { a: FLOOR_TIP, d, f: 1 }, the headset's own);
  // an older device's floor for them (rm with a lower a and no f) moves nothing here, and this headset writes the room's
  // floor spots again (the headsets' floors 20 cm apart on floor spots: the guide round, guideRound)
  const rm0 = ((await roomInfo(code)).keys.rm || {}).v || null, hIdC = await H.evaluate(() => HOST.collab.id);
  await H.evaluate(() => window.__collabLog.push({ ev: 'test old floor' }));
  await A.evaluate(v => HOST.collab.publish([['rm', v]]), { a: r3(fa[1] + 0.15), d: r3(dAB), by: aId, at: Date.now() });
  // (the room's floor looked at twice a second, and the value comes through the relay: a slow machine may need a few frames)
  const claimedAgain = () => H.evaluate(() => { const L = window.__collabLog, i = L.map(e => e.ev).lastIndexOf('test old floor'); return L.slice(i + 1).find(e => e.ev === 'floor claimed') || null; });
  let rmB = null, seenOld = null;
  for (let k = 0; k < 24; k++) {
    await frames(H, 250);
    const v = ((await roomInfo(code)).keys.rm || {}).v || null;
    seenOld = await claimedAgain();
    if (seenOld && v && v.f === 1 && v.by === hIdC) { rmB = v; break; }
  }
  const fl = await H.evaluate(() => ({ y: HOST.room.frame.o[1], mk: HOST.room.marks, note: HOST.room.floorNote(), saved: HOST.room.internals().saved.f,
    log: window.__collabLog.filter(e => e.ev === 'floor spots').slice(-1)[0] || null }));
  check('the room\'s floor: floor spots set it, the floor under them (rm: a 2 cm, f 1); an older device\'s floor for them changes nothing here, and the room gets the floor spots back',
    !!rm0 && rm0.f === 1 && Math.abs(rm0.a - TIP) < 1e-3 && Math.abs(rm0.d - dAB) < 2e-3 && rm0.by === hIdC && fl.saved === 1 && Math.abs(fl.y) < 3e-3 && Math.abs(fl.mk[0] - TIP) < 3e-3 &&
    !fl.note && !!rmB && Math.abs(rmB.a - TIP) < 1e-3 && !!seenOld && seenOld.was === aId && seenOld.f === 1 && !!fl.log && Math.abs(fl.log.a - TIP) < 3e-3 && Math.abs(fl.log.b - TIP) < 3e-3 && fl.log.scan === null,
    JSON.stringify({ rm0, rmB, seenOld, fl }));
  // the Guardian origin moves within the session (a reset with a transform): the frame follows at once
  const F2 = [0.1, 0, -0.2, 0.2];
  const moved = await H.evaluate(F2 => { window.__xr.floorReset(F2, 0.3); return HOST.room.frame; }, F2);
  const mo = unapply(F2, apply(FLOOR, [fa[0], 0, fa[2]])), mx = rot(-F2[3], rot(FLOOR[3], cx));
  check('a reset of local-floor as Quest Browser sends it (old to new, the head\'s height ignored) moves the frame into the new coordinates',
    moved && near(moved.o, [mo[0], 0, mo[2]], 2e-3) && near(moved.x, mx, 2e-3), `${moved ? fmt(moved.o) + ' ' + fmt(moved.x) : 'no frame'}, want ${fmt(mo)} ${fmt(mx)}`);
  // a recentre without a word (Quest Browser fires no reset): local and local-floor both move; the two anchors
  // keep the frame on the marks
  const F3 = [-0.6, 0, 0.5, -0.9], L3 = [F3[0], 1.6, F3[2], F3[3]];
  await H.evaluate(([F, L]) => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z);
    const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
    X.W.floor = M(F); X.W.local = M(L);
  }, [F3, L3]);
  const fa3 = unapply(F3, markA), fb3 = unapply(F3, markB), cx3 = unit([fb3[0] - fa3[0], 0, fb3[2] - fa3[2]]);
  // (the anchors are read every 0.5 s, at once when the origin seems to jump: a slow machine may need a few frames)
  let rc = null;
  for (let k = 0; k < 16; k++) {
    await frames(H, 250);
    rc = await H.evaluate(() => ({ frame: HOST.room.frame, src: HOST.room.src }));
    if (rc.frame && near(rc.frame.o, [fa3[0], 0, fa3[2]], 2e-3)) break;
  }
  check('a recentre without a reset event: the anchors keep the frame on the marks', rc.src === 'marks' && rc.frame && near(rc.frame.o, [fa3[0], 0, fa3[2]], 2e-3) && near(rc.frame.x, cx3, 2e-3),
    `${rc.src} ${rc.frame ? fmt(rc.frame.o) + ' ' + fmt(rc.frame.x) : 'no frame'}, want ${fmt(fa3)} ${fmt(cx3)} ` +
    await H.evaluate(() => JSON.stringify(window.__collabLog.slice(-25).map(e => [e.t, e.ev, e.why || e.src || '']))));
  // taken off and on again (as two Quest 3s did): the origin moves and a reset says how (4 cm out here), and the
  // anchors are not tracked any more: the frame follows the reset at once, and the anchors found again by their
  // saved handles put it back on the marks
  const F4 = [0.8, 0, 0.9, 2.1], L4 = [F4[0], 1.6, F4[2], F4[3]];
  const wk0 = await H.evaluate(([F, L]) => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z);
    const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
    const stale = new Set(HOST.room.internals().anchors || []);
    X.visibility('hidden');
    X.floorReset(F, -0.25, [0.04, 0, 0]); X.W.local = M(L);
    X.frame.trackedAnchors = { has: a => !stale.has(a) };
    X.visibility('visible');
    window.__collabLog.push({ ev: 'test woke' });
    return HOST.room.frame;
  }, [F4, L4]);
  const fa4 = unapply(F4, markA), fb4 = unapply(F4, markB), cx4 = unit([fb4[0] - fa4[0], 0, fb4[2] - fa4[2]]);
  const sinceWake = () => H.evaluate(() => { const L = window.__collabLog, i = L.map(e => e.ev).lastIndexOf('test woke'); return L.slice(i + 1).map(e => e.ev); });
  for (let k = 0; k < 40 && !(await sinceWake()).includes('anchors moved'); k++) await frames(H, 250);
  const wk = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, state: HOST.room.state }));
  wk.log = await sinceWake();
  await H.evaluate(() => { delete window.__xr.frame.trackedAnchors; });
  check('off and on again: the frame follows the reset at once (the right way round), and is kept', !!wk0 && dist(wk0.o, [fa4[0], 0, fa4[2]]) < 0.05 &&
    near(wk0.x, cx4, 3e-3) && Math.abs(wk0.o[1]) < 3e-3, JSON.stringify({ o: wk0 && wk0.o, x: wk0 && wk0.x, want: [fa4, cx4] }));
  check('off and on again, the anchors not tracked: found again by their saved handles, the frame back on the marks', ['marks', 'anchor'].includes(wk.src) && !!wk.frame &&
    near(wk.frame.o, [fa4[0], 0, fa4[2]], 3e-3) && near(wk.frame.x, cx4, 3e-3) && wk.log.includes('marks unanswered') && !wk.log.includes('calibrate'),
    JSON.stringify(Object.assign(wk, { want: [fa4, cx4] })));
  // ...and when the headset cannot find them by their handles at first (two Quest 3s did not, after 5 and 15 minutes
  // asleep, and did once AR was entered again): it keeps looking every 10 s, and the frame goes back on the marks
  // once they come
  const Fr5 = [0.7, 0, 1.0, 2.2], Lr5 = [Fr5[0], 1.6, Fr5[2], Fr5[3]];
  const hidN = await H.evaluate(([F, L]) => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z), R = HOST.room.internals();
    const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
    const stale = new Set(R.anchors || []), ids = (R.saved && R.saved.anchors) || [];
    window.__hidden = ids.map(u => [u, X.handles.get(u)]);
    for (const u of ids) X.handles.delete(u);   // the browser does not find them by their handles for now
    X.visibility('hidden');
    X.floorReset(F, -0.2, [0.03, 0, 0]); X.W.local = M(L);
    X.frame.trackedAnchors = { has: a => !stale.has(a) };
    X.visibility('visible');
    window.__collabLog.push({ ev: 'test woke' });
    return ids.length;
  }, [Fr5, Lr5]);
  for (let k = 0; k < 60 && !(await sinceWake()).includes('anchors not found'); k++) await frames(H, 250);
  const nfr5 = (await sinceWake()).includes('anchors not found');
  await frames(H, 100);
  const lost5 = await H.evaluate(() => ({ reenter: HOST.room.internals().reenter, line: HOST.room.sourceLine(), state: HOST.room.state,
    lost: window.__collabLog.filter(e => e.ev === 'marks lost').slice(-1)[0] || null, note: (window.__collabLog.filter(e => e.ev === 'notice').slice(-1)[0] || {}).title,
    notes: HOST.collab.notes().map(n => n.title), lu: HOST.collab.guide().status }));
  // (v124, the owner: "The leave ar message after standby or resume can go away": no notice asks to leave AR, and the
  // headset still counts as lined up while it looks for its anchors again)
  check('off and on again, the marks not found in the session: the frame held, the anchors looked for again, no notice to leave AR, still lined up',
    lost5.reenter === true && /looking for their anchors again/.test(lost5.line) && !/leave AR/i.test(lost5.line) && !!lost5.lost && lost5.lost.why === 'wake' &&
    lost5.state !== 'calibrate' && !lost5.notes.some(t => /leave AR/i.test(t)) && !(lost5.lu && lost5.lu.w === 'marks'), JSON.stringify(lost5));
  await H.evaluate(() => { for (const [u, w] of window.__hidden) window.__xr.handles.set(u, w); });
  for (let k = 0; k < 90 && !(await sinceWake()).includes('anchors moved'); k++) await frames(H, 250);
  const far5 = unapply(Fr5, markA), fbr5 = unapply(Fr5, markB), cxr5 = unit([fbr5[0] - far5[0], 0, fbr5[2] - far5[2]]);
  const rtw = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, state: HOST.room.state }));
  rtw.log = await sinceWake();
  await H.evaluate(() => { delete window.__xr.frame.trackedAnchors; });
  check('off and on again, the anchors not found by their handles at first: looked for again (every 10 s), the frame back on the marks once they come',
    hidN === 2 && nfr5 && rtw.log.includes('anchors found again') && ['marks', 'anchor'].includes(rtw.src) && !!rtw.frame && near(rtw.frame.o, [far5[0], 0, far5[2]], 3e-3) &&
    near(rtw.frame.x, cxr5, 3e-3) && !rtw.log.includes('calibrate'), JSON.stringify(Object.assign(rtw, { hidN, nfr5, want: [far5, cxr5] })));
  const back5 = await H.evaluate(() => ({ reenter: HOST.room.internals().reenter, line: HOST.room.sourceLine() }));
  check('the marks found after all: the panel no longer says it is looking', back5.reenter === false && !/looking for their anchors/.test(back5.line), JSON.stringify(back5));
  // a jump of the origin while the marks' anchors are not found (their tries over) but their handles are saved: the
  // calibration is kept (a new AR session finds the marks), the panel says it is looking for their anchors again (no
  // notice to leave AR since v124), and the anchors are looked for again at once
  const jmp = await H.evaluate(() => {
    const X = window.__xr, R = HOST.room.internals(), ids = (R.saved && R.saved.anchors) || [];
    window.__hidden = ids.map(u => [u, X.handles.get(u)]);
    for (const u of ids) X.handles.delete(u);
    for (const a of R.anchors || []) { try { a.delete(); } catch (e) { /* gone */ } }
    Object.assign(R, { anchors: null, anchorIds: null, anchorsOK: false, anchorP: null, anchorTried: true, retryAt: 0, retryFrom: 0 });   // as when the tries ran out
    window.__collabLog.push({ ev: 'test jump' });
    const f0 = HOST.room.frame && HOST.room.frame.o.slice();
    R.prev = { p: [9, 1.6, 9], q: [0, 0, 0, 1], t: performance.now() - 20 }; R.originCheck(performance.now());
    return { f0, n: ids.length };
  });
  const sinceJump = () => H.evaluate(() => { const L = window.__collabLog, i = L.map(e => e.ev).lastIndexOf('test jump'); return L.slice(i + 1); });
  for (let k = 0; k < 40 && !(await sinceJump()).some(e => e.ev === 'anchors not found'); k++) await frames(H, 250);
  const jl = await H.evaluate(() => ({ state: HOST.room.state, frame: HOST.room.frame, reenter: HOST.room.internals().reenter, line: HOST.room.sourceLine(), saved: !!localStorage.getItem('roomFrame'),
    notes: HOST.collab.notes().map(n => n.title) }));
  jl.log = (await sinceJump()).map(e => e.ev + (e.why ? ':' + e.why : ''));
  check('a jump of the origin with saved anchors not found: the calibration kept, the panel says it looks for their anchors again (no notice to leave AR)',
    jmp.n === 2 && jl.state !== 'calibrate' && !!jl.frame && !!jmp.f0 && near(jl.frame.o, jmp.f0, 1e-3) && jl.reenter === true && /looking for their anchors again/.test(jl.line) &&
    !jl.notes.some(t => /leave AR/i.test(t)) && jl.saved &&
    jl.log.includes('marks lost:jump') && jl.log.includes('anchors not found'), JSON.stringify(Object.assign(jl, { jmp })));
  await H.evaluate(() => { for (const [u, w] of window.__hidden) window.__xr.handles.set(u, w); });
  for (let k = 0; k < 90 && !(await sinceJump()).some(e => e.ev === 'anchors found again'); k++) await frames(H, 250);
  const jb = await H.evaluate(() => ({ reenter: HOST.room.internals().reenter, src: HOST.room.src }));
  jb.found = (await sinceJump()).some(e => e.ev === 'anchors found again');
  check('...and found on the next try: no longer looking', jb.found && jb.reenter === false && ['marks', 'anchor'].includes(jb.src), JSON.stringify(jb));
  // next session (or a reload): the anchors at mark A and mark B bring the frame back; handles nobody knows go
  await H.evaluate(() => window.__xr.end());
  await H.evaluate(() => window.__handles.set('junk-left-over', new THREE.Matrix4()));
  await H.evaluate(installXR, Object.assign({}, xrOpts, { features: ['local-floor', 'anchors'] }));
  await H.evaluate(() => window.__xr.begin());
  for (let k = 0; k < 12 && !(await H.evaluate(() => HOST.room.src)); k++) await frames(H, 250);   // a busy machine draws few frames
  const re = await H.evaluate(() => ({ frame: HOST.room.frame, src: HOST.room.src }));
  const tidy = await H.evaluate(() => ({ junk: window.__handles.has('junk-left-over'), ours: HOST.room.handles().every(u => window.__handles.has(u)) }));
  check('a new session deletes saved anchors nobody knows (they fill the browser\'s few slots), and keeps the room\'s', !tidy.junk && tidy.ours, JSON.stringify(tidy));
  check('calibration: the next session finds the frame again by its two anchors', re.src === 'anchor' && re.frame && near(re.frame.o, cal.frame.o, 2e-3) && near(re.frame.x, cal.frame.x, 2e-3),
    `${re.src} ${re.frame ? fmt(re.frame.o) : ''} ` + await H.evaluate(() => JSON.stringify(window.__collabLog.slice(-10).map(e => [e.ev, e.state || e.src || e.e || '']))));
  // Forget calibration (two presses on the shell's panel): the marks and their saved anchors go, and the headset
  // lines up again from the start (here, with no shared space, it asks to calibrate); the panel says there is no
  // shared space
  await H.evaluate(() => HOST.collab.panelOpen(true));
  await frames(H, 200);   // the panel draws (and lists its buttons) in the headset's frames
  const forgot = await H.evaluate(() => {
    const S = HOST.collab.overlay().panel, ids = (HOST.room.internals().saved || {}).anchors || [];
    const press = () => { const r = HOST.collab.menuFind('forget'); if (r && r.fn) r.fn(); return !!(r && r.fn); };
    // both presses at once: a busy page can take longer than the 3 s the first press arms it for
    const first = press(), kept = !!localStorage.getItem('roomFrame') && !!HOST.room.frame, second = press();
    return { first, kept, second, ids, gone: ids.every(u => !window.__xr.handles.has(u)), saved: localStorage.getItem('roomFrame'), frame: HOST.room.frame, line: HOST.room.sharedLine() };
  });
  await frames(H, 300);
  const forgotState = await H.evaluate(() => { HOST.collab.panelOpen(false); return HOST.room.state; });
  check('Forget calibration: the first press only asks, the second forgets the marks and their anchors, and the headset asks to calibrate again',
    forgot.first && forgot.kept && forgot.second && forgot.ids.length === 2 && forgot.gone && !forgot.saved && !forgot.frame && forgotState === 'calibrate' && /No shared space/.test(forgot.line),
    JSON.stringify(Object.assign({ state: forgotState }, forgot)));
  // calibrating again drops the old marks' anchors at once (they would pull the new frame back to the old marks)
  const savedIds = () => H.evaluate(() => { const S = HOST.room.internals().saved; return S && S.anchors.length === 2 ? S.anchors.slice() : null; });
  const recal = async () => {
    await H.evaluate(() => HOST.room.calibrate());
    await touch(markA); await touch(markB);
    for (let k = 0; k < 8 && !(await savedIds()); k++) await frames(H, 250);
    return savedIds();
  };
  const h1 = await recal(), h2 = await recal();
  const hs = await H.evaluate(([a, b]) => [a.some(u => window.__xr.handles.has(u)), b.every(u => window.__xr.handles.has(u))], [h1 || [], h2 || []]);
  check('calibrating again replaces the old marks\' anchors (their saved handles are deleted)', !!h1 && !!h2 && h1[0] !== h2[0] && !hs[0] && hs[1], JSON.stringify({ h1, h2, hs }));
  // Forget while the next session is still finding those anchors: the anchors that arrive afterwards are not used
  await H.evaluate(() => window.__xr.end());
  await H.evaluate(installXR, Object.assign({}, xrOpts, { features: ['local-floor', 'anchors'] }));
  await H.evaluate(() => {
    const S = window.__xr.session, restore = S.restorePersistentAnchor;
    window.__releaseAnchors = [];
    S.restorePersistentAnchor = u => new Promise(r => { window.__releaseAnchors.push(() => r(restore(u))); });
    window.__xr.begin();
  });
  for (let k = 0; k < 12 && (await H.evaluate(() => HOST.room.state)) !== 'restoring'; k++) await frames(H, 250);
  const lateSt = await H.evaluate(() => { const st = HOST.room.state; HOST.room.forget(); for (const f of window.__releaseAnchors) f(); return st; });
  await frames(H, 400);
  const late = await H.evaluate(h => ({ anchors: !!HOST.room.internals().anchors, state: HOST.room.state, frame: !!HOST.room.frame, handles: h.filter(u => window.__xr.handles.has(u)) }), h2 || []);
  check('Forget while last time\'s anchors are still being found: the late anchors are not used, and the headset asks to calibrate',
    lateSt === 'restoring' && !late.anchors && !late.frame && late.state === 'calibrate' && !late.handles.length, JSON.stringify(Object.assign({ was: lateSt }, late)));
  await H.evaluate(() => window.__xr.end());

  // ----------------------------- the shared space never overrides marks --
  // a headset in shared space U1 with no marks takes the frame published for U1; once calibrated it keeps its own
  // marks, publishes them for U1 (with the marks, for drawing), ignores a newer frame someone else publishes there,
  // and only says how far the shared space puts that one's marks from its own
  check('shared space: used unless switched off (the default)', await A.evaluate(() => HOST.room.sharedAlign()) === true);
  // a headset whose shared space is just its own floor while someone here published for it has not joined (one
  // Quest 3 had that every session): it takes nothing through it and says so
  await H.evaluate(() => HOST.room.sharedAlign(true));
  await H.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U1', shared: FLOOR, head: [-6, 1.6, 6, 0] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 3000);
  const nj = await H.evaluate(() => ({ state: HOST.room.state, frame: HOST.room.frame, line: HOST.room.sourceLine(), shared: HOST.room.sharedLine(),
    log: window.__collabLog.some(e => e.ev === 'shared not joined') }));
  check('shared space: a headset whose space is just its own floor takes no frame through it from someone here, and says it has not joined',
    !nj.frame && nj.state === 'shared-wait' && /Not in the others/.test(nj.line) && /your own floor/.test(nj.shared) && nj.log, JSON.stringify(nj));
  await H.evaluate(() => window.__xr.end());
  // a frame published there by someone who has left is last time's (the space was made again under its id): after
  // the wait the first headset in the space replaces it with its own; and a frame someone here publishes later for
  // that space is taken, though the first headset's space is its own floor
  // (with another headset in the room since before this one, not yet in the space: this one, first in the space,
  // still becomes the room; a rule that counted that headset as someone here stopped alignment on two Quest 3s)
  const rfKey1 = await H.evaluate(() => HOST.room.frameKey('U1'));
  await B.evaluate(() => { const C = HOST.collab.internals(); C.ws.send(JSON.stringify({ t: 'hello', name: C.name, color: C.color, kind: 'ar', here: true })); });
  await until(H, bid => HOST.collab.members.some(m => m.id === bid && m.kind === 'ar' && m.here), await B.evaluate(() => HOST.collab.id), 3000);
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey1, Object.assign(frameFor([ROOM[0] + 1, 0, ROOM[2], ROOM[3]], 'U1', 'left-long-ago', Date.now() - 3600e3), { g: 'shared' })]);
  // (the headset holds that frame before its session begins: with the one before it, a page's here, it would judge
  // itself not first in the space, as it should then; a loaded machine once began the session first)
  const held7 = await until(H, k => (HOST.collab.val(k) || {}).by === 'left-long-ago', rfKey1, 10000);
  await H.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U1', shared: FLOOR, head: [-6, 1.6, 6, 0] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 3000);
  const early7 = await H.evaluate(() => ({ src: HOST.room.src, state: HOST.room.state }));
  for (let k = 0; k < 60 && (await H.evaluate(() => HOST.room.src)) !== 'shared'; k++) await frames(H, 250);   // after the 8 s wait
  await frames(H, 600);
  const sU7 = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, id: HOST.collab.id, first: HOST.room.internals().firstHere }));
  const pub7 = ((await roomInfo(code)).keys[rfKey1] || {}).v || null;
  await B.evaluate(() => HOST.collab.me({}));   // (a page again)
  check('shared space: a frame there from someone who has left waits, then the first headset\'s own space replaces it (another headset in the room since before)', early7.src === '' && early7.state === 'shared-wait' &&
    sU7.src === 'shared' && sU7.first === true && !!sU7.frame && near(sU7.frame.o, [0, 0, 0], 1e-3) && !!pub7 && pub7.by === sU7.id, JSON.stringify({ held7, early7, sU7, pub7 }) + ' ' +
    await H.evaluate(() => JSON.stringify({ members: HOST.collab.members.map(m => [m.id, m.kind, m.here, m.since]), log: window.__collabLog.filter(e => /shared|first|frame|welcome|close|connect/.test(e.ev)).slice(-20) })));
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey1, frameFor(ROOM, 'U1', aId, Date.now())]);
  await frames(H, 1000);
  const took7 = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, line: HOST.room.sourceLine() }));
  const w7 = unapply(SHARED, ROOM.slice(0, 3));   // its space is its floor here, so the frame lands where the space puts it
  check('shared space: the first headset (its space is its own floor) takes a frame someone here publishes for it', took7.src === 'adopted' &&
    near(took7.frame.o, [w7[0], 0, w7[2]], 2e-3) && !/Not in the others/.test(took7.line), JSON.stringify(took7));
  await H.evaluate(() => window.__xr.end());
  // a Quest that left AR and entered it again got its space back under the same id but as its own floor, while the
  // other headset, aligned through the space, stayed where it was (two spaces, the relay's logs): with another headset
  // here aligned in that id, its own frame from before is not taken through it (not joined), also once the space
  // drifts a few cm (a judgement flapping at 2 cm took it)
  const hRe = await H.evaluate(() => HOST.collab.id);
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey1, Object.assign(frameFor([ROOM[0] + 1, 0, ROOM[2], ROOM[3]], 'U1', hRe, Date.now() - 600e3), { g: 'shared' })]);
  // (page B plays a headset aligned in U1: one presence through the relay, then kept fresh on H, since a page in a
  // background tab runs its timers about once a minute)
  const bRe = await B.evaluate(() => {
    const C = HOST.collab.internals(), ws = C.ws, send = ws.send.bind(ws);
    ws.send = m => { if (!/"t":"fx","k":"p\./.test(m)) send(m); };   // (its own presence, a page's, held back)
    send(JSON.stringify({ t: 'hello', name: C.name, color: C.color, kind: 'ar', here: true }));
    send(JSON.stringify({ t: 'fx', k: 'p.' + C.id, v: { st: '', head: [0, 1.6, 0, 0, 0, 0, 1], hands: [], sp: 'U1', al: 'adopted' } }));
    return C.id;
  });
  await until(H, bid => HOST.collab.members.some(m => m.id === bid && m.kind === 'ar' && m.here), bRe, 3000);
  const preRe = await until(H, bid => { const P = HOST.collab.people().get(bid); return !!P && P.sp === 'U1' && P.al === 'adopted'; }, bRe, 3000);
  await H.evaluate(bid => Object.defineProperty(HOST.collab.people().get(bid), 'at', { get: () => performance.now(), set() {}, configurable: true }), bRe);
  await H.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U1', shared: FLOOR, head: [-6, 1.6, 6, 0] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 2500);
  await H.evaluate(() => { const X = window.__xr; X.W.shared = X.W.floor.clone().multiply(new THREE.Matrix4().makeTranslation(0.05, 0, 0.03)); });
  await frames(H, 1500);
  const reIn = await H.evaluate(() => { const R = HOST.room.internals(); return { src: HOST.room.src, frame: HOST.room.frame, first: R.firstHere, own: R.sharedOwn, line: HOST.room.sourceLine(),
    log: window.__collabLog.filter(e => /^shared (first|own|not joined|joined)/.test(e.ev)).slice(-6) }; });
  const rePub = ((await roomInfo(code)).keys[rfKey1] || {}).v || null;
  check('shared space: back in AR, its space now its own floor while another headset here is aligned in that id, a headset does not take its own frame from before through it (not joined; also with the space 6 cm off)',
    preRe && !reIn.frame && reIn.first === false && reIn.own === true && /Not in the others/.test(reIn.line) && !!rePub && rePub.by === hRe && rePub.g === 'shared', JSON.stringify({ preRe, reIn, rePub }));
  await H.evaluate(() => window.__xr.end());
  // ...but the true first headset in a space (its space is its own floor too) stays first once the others are
  // aligned through it: Re-align, and its id flicking to a default space and back, do not make it 'not joined'
  await H.evaluate(bid => HOST.collab.people().delete(bid), bRe);
  await H.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U1', shared: FLOOR, head: [-6, 1.6, 6, 0] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 2000);
  const fst0 = await H.evaluate(() => ({ src: HOST.room.src, first: HOST.room.internals().firstHere }));
  await B.evaluate(() => { const C = HOST.collab.internals(); WebSocket.prototype.send.call(C.ws, JSON.stringify({ t: 'fx', k: 'p.' + C.id, v: { st: '', head: [0, 1.6, 0, 0, 0, 0, 1], hands: [], sp: 'U1', al: 'adopted' } })); });
  await until(H, bid => { const P = HOST.collab.people().get(bid); return !!P && P.sp === 'U1'; }, bRe, 3000);
  await H.evaluate(bid => Object.defineProperty(HOST.collab.people().get(bid), 'at', { get: () => performance.now(), set() {}, configurable: true }), bRe);
  await H.evaluate(() => HOST.room.realignNow());
  await frames(H, 2500);
  await H.evaluate(() => { window.__xr.spaces.shared.UUId = 'D1'; });
  await frames(H, 600);
  await H.evaluate(() => { window.__xr.spaces.shared.UUId = 'U1'; });
  await frames(H, 2500);
  const fst = await H.evaluate(() => { const R = HOST.room.internals(); return { src: HOST.room.src, frame: !!HOST.room.frame, first: R.firstHere, own: R.sharedOwn, nj: R.notJoined, aloneAt: R.aloneAt, id: R.sharedId,
    log: window.__collabLog.filter(e => /^shared (first|own|not joined|joined|id)|realign/.test(e.ev)).slice(-8) }; });
  check('shared space: the first headset in a space stays first with another headset aligned through it, after Re-align and an id flicking away and back',
    (fst0.src === 'adopted' || fst0.src === 'shared') && fst0.first === true && fst.frame && fst.first === true && fst.own === true && !fst.nj && !fst.aloneAt && fst.id === 'U1', JSON.stringify({ fst0, fst }));
  await H.evaluate(() => window.__xr.end());
  await H.evaluate(bid => HOST.collab.people().delete(bid), bRe);
  await B.evaluate(() => { delete HOST.collab.internals().ws.send; HOST.collab.me({}); });
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey1, frameFor(ROOM, 'U1', aId, Date.now() - 60000)]);
  await H.evaluate(() => HOST.room.sharedAlign(false));
  await H.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U1' }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 1500);
  const off = await H.evaluate(() => ({ state: HOST.room.state, frame: HOST.room.frame }));
  check('shared space: switched off on the panel, a headset without marks asks to calibrate', off.state === 'calibrate' && !off.frame, JSON.stringify(off));
  await H.evaluate(() => HOST.room.sharedAlign(true));
  for (let k = 0; k < 12 && (await H.evaluate(() => HOST.room.src)) !== 'adopted'; k++) await frames(H, 250);
  const ad0 = await H.evaluate(() => HOST.room.src);
  const hId2 = await H.evaluate(() => HOST.collab.id);
  await H.evaluate(() => window.__xr.head([-6, 1.6, 6, 0]));   // away from the stations: no story switch while calibrating
  await frames(H, 300);
  await recal();
  await frames(H, 1200);
  const rfKey = await H.evaluate(() => HOST.room.frameKey('U1'));
  const pub = ((await roomInfo(code)).keys[rfKey] || {}).v || null;
  const own1 = await H.evaluate(() => {
    const O = HOST.collab.overlay(), h = HOST.collab.internals().hov.get(0), r = HOST.collab.internals().rays.get(0);
    return { src: HOST.room.src, frame: HOST.room.frame, cur: HOST.curKey, root: !!(O.root && O.root.parent), vis: !!(O.root && O.root.visible),
      hov: h ? [h.target.kind, Math.round(performance.now() - h.at)] : null, ray: r ? [Math.round(performance.now() - r.at)] : null,
      log: window.__collabLog.slice(-25).map(e => e.ev + (e.state ? ':' + e.state : e.st ? ':' + e.st : e.story ? ':' + e.story : e.why ? ':' + e.why : '')) };
  });
  check('shared space: a headset without marks takes the published frame; once calibrated it uses its marks and publishes them for its space',
    ad0 === 'adopted' && own1.src === 'marks' && near(own1.frame.o, [fa[0], 0, fa[2]], 2e-3) && !!pub && pub.by === hId2 && pub.g === 'marks' && Array.isArray(pub.m) &&
    Math.abs(pub.m[1] - dAB) < 2e-3, JSON.stringify({ ad0, own1, pub }));
  const yawW = Math.atan2(-(markB[2] - markA[2]), markB[0] - markA[0]);
  const P3 = Object.assign(frameFor([markA[0] + 0.1, 0, markA[2], yawW + 0.05], 'U1', aId, Date.now() + 5000), { g: 'marks', m: [0.7, 1.5, 0.72] });
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey, P3]);
  await frames(H, 1500);
  const kept = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, cmp: HOST.room.cmp, line: HOST.room.sourceLine() }));
  check('shared space: a newer frame published by someone else does not move a calibrated headset; the panel says how far apart their marks are',
    kept.src === 'marks' && near(kept.frame.o, [fa[0], 0, fa[2]], 2e-3) && !!kept.cmp && Math.abs(kept.cmp.d - 0.1) < 3e-3 && Math.abs(kept.cmp.a - 2.9) < 0.15 && /puts .*'s marks 10 cm, 2\.\d\u00b0 from yours/.test(kept.line),
    JSON.stringify(kept));
  await H.evaluate(() => HOST.room.forget());
  await frames(H, 800);
  const ad1 = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, mk: HOST.room.marks, line: HOST.room.sourceLine() }));
  const w3 = unapply(FLOOR, [markA[0] + 0.1, 0, markA[2]]);
  check('shared space: after Forget calibration the headset takes that frame instead, marks included', ad1.src === 'adopted' && near(ad1.frame.o, [w3[0], 0, w3[2]], 2e-3) &&
    JSON.stringify(ad1.mk) === JSON.stringify(P3.m) && /through the shared space/.test(ad1.line), JSON.stringify(ad1));
  await H.evaluate(() => window.__xr.end());

  // ------------------------------------------ a shared space found split; no room scan --
  // two calibrated headsets whose marks the shared space puts 60 cm apart (two spaces under one id, as two Quest 3s
  // were): the room is told (rs.<id>), and told it is whole again once they agree; a headset without marks then takes
  // nothing through that space and asks to calibrate. A headset with plane detection but no planes says it has no
  // room scan (Space Setup not run, or Physical space features off), and stops once planes come
  const rsKey = 'rs.U1', rsOf = async () => ((await roomInfo(code)).keys[rsKey] || {}).v || null;
  await H.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U1', features: xrOpts.features.concat(['plane-detection']), head: [-6, 1.6, 6, 0] }));
  await H.evaluate(() => { window.__xr.frame.detectedPlanes = new Set(); window.__xr.begin(); });
  await frames(H, 300);
  await recal();
  await frames(H, 600);
  const far = Object.assign(frameFor([markA[0] + 0.6, 0, markA[2], yawW], 'U1', aId, Date.now() + 9000), { g: 'marks', m: [0.7, 1.5, 0.72] });
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey, far]);
  for (let k = 0; k < 40 && !((await rsOf()) || {}).bad; k++) await frames(H, 250);
  const sp1 = await rsOf(), hSp = await H.evaluate(() => HOST.collab.id);
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey, Object.assign({}, far, frameFor([markA[0] + 0.01, 0, markA[2], yawW], 'U1', aId, Date.now() + 9500))]);
  for (let k = 0; k < 20 && ((await rsOf()) || {}).bad; k++) await frames(H, 250);
  const sp2 = await rsOf();
  check('shared space split: two calibrated headsets 60 cm apart through it tell the room, and tell it again once they agree',
    !!sp1 && sp1.bad === true && Math.abs(sp1.d - 0.6) < 0.02 && sp1.by === hSp && sp1.with === aId && !!sp2 && sp2.bad === false, JSON.stringify({ sp1, sp2 }));
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey, Object.assign({}, far, { at: Date.now() + 10000 })]);
  for (let k = 0; k < 40 && !((await rsOf()) || {}).bad; k++) await frames(H, 250);
  await H.evaluate(() => HOST.room.forget());
  await frames(H, 1500);
  const sp3 = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, state: HOST.room.state, line: HOST.room.sourceLine(),
    note: window.__collabLog.some(e => e.ev === 'notice' && e.title === 'Shared space not usable') }));
  check('shared space split: a headset without marks takes nothing through it and asks to calibrate, saying why',
    !sp3.frame && sp3.state === 'calibrate' && /puts calibrated headsets here 60 cm apart/.test(sp3.line) && sp3.note, JSON.stringify(sp3));
  for (let k = 0; k < 100 && !(await H.evaluate(() => HOST.room.internals().noScan)); k++) await frames(H, 250);   // (20 s into the session)
  await frames(H, 1200);
  const scan1 = await H.evaluate(() => { const R = HOST.room.internals(); return { none: R.noScan, n: R.scanN, note: window.__collabLog.some(e => e.ev === 'notice' && e.title === 'No room scan') }; });
  await H.evaluate(() => { window.__xr.frame.detectedPlanes = new Set([{}]); });
  await frames(H, 1500);
  const scan2 = await H.evaluate(() => { const R = HOST.room.internals(); return { none: R.noScan, n: R.scanN }; });
  check('no room scan: a headset with plane detection and no planes says so after 20 s, and stops once planes come',
    scan1.none === true && scan1.n === 0 && scan1.note && scan2.none === false && scan2.n === 1, JSON.stringify({ scan1, scan2 }));
  await H.evaluate(() => window.__xr.end());
  await A.evaluate(([k, a]) => HOST.collab.publish([[k, { uuid: 'U1', bad: false, d: 0, a: 0, by: a, with: a, at: Date.now() }]]), [rsKey, aId]);

  // -------------------------------------------- a calibration without anchors --
  // a browser without anchors: the marks hold for the session until the origin moves (a reset, or the head
  // seeming to jump), then the headset asks to calibrate again; a mark is taken where the controller was held
  // still, not where the trigger pull moved it
  await H.evaluate(installXR, Object.assign({}, xrOpts, { features: ['local-floor'] }));
  await H.evaluate(() => { delete window.__xr.frame.createAnchor; window.__xr.begin(); });
  await frames(H, 300);
  await H.evaluate(p => { HOST.room.calibrate(); window.__xr.ctrl(0, p, [0, -1, 0]); }, markA);
  await frames(H, 300);
  const stillA = await H.evaluate(async p => {
    // held still right up to the pull (a busy machine can take longer between two calls than the half second of
    // history the mark looks back over)
    for (let k = 0; k < 4; k++) { window.__xr.step(); await new Promise(r => setTimeout(r, 40)); }
    window.__xr.ctrl(0, [p[0] + 0.03, p[1] - 0.01, p[2]], [0, -1, 0]); HOST.cur.peek('XR.ctrls[0].wantPress = true'); window.__xr.step();
    const c = HOST.room.internals().calib; return c && c.a ? c.a.toArray() : null;
  }, markA);
  const stillWhy = stillA && near(stillA, fa, 5e-3) ? '' : ' ' + await H.evaluate(() => { const h = HOST.collab.internals().rays.get(0), t = performance.now();
    return JSON.stringify({ story: HOST.curKey, hist: h && h.hist ? h.hist.map(e => Math.round(t - e[0])) : null, log: window.__collabLog.slice(-14).map(e => [Math.round(t - e.t), e.ev, e.st || e.story || e.state || e.step || '']) }); });
  check('calibration: the mark is where the controller was held still before the trigger, not where the pull moved it', !!stillA && near(stillA, fa, 5e-3), `${stillA && fmt(stillA)} want ${fmt(fa)}` + stillWhy);
  await touch(markB);
  await frames(H, 300);
  const noA = await H.evaluate(() => ({ src: HOST.room.src, line: HOST.room.sourceLine(), saved: localStorage.getItem('roomFrame') }));
  await H.evaluate(() => { for (const fn of window.__xr.resets['local-floor'] || []) fn({ transform: null }); });
  await frames(H, 200);
  const afterReset = await H.evaluate(() => HOST.room.state);
  await recal();
  await frames(H, 200);
  const jumped = await H.evaluate(() => { const R = HOST.room.internals(); R.prev = { p: [9, 1.6, 9], q: [0, 0, 0, 1], t: performance.now() - 20 }; R.originCheck(performance.now()); return HOST.room.state; });
  await recal();
  await frames(H, 200);
  check('without anchors: the marks hold for the session (nothing saved), and a reset with no transform or a jump of the origin asks to calibrate again',
    noA.src === 'marks' && /no anchors/.test(noA.line) && !noA.saved && afterReset === 'calibrate' && jumped === 'calibrate', JSON.stringify({ noA, afterReset, jumped }));
  // off and on again with a reset that says how the origin moved: the frame follows it and stays (asking to
  // calibrate after every wake was worse), and the marks are shown to check by eye
  const F5 = [0.2, 0, 0.3, 1.2];
  await H.evaluate(F => { const X = window.__xr; X.visibility('hidden'); X.floorReset(F, 0.1); X.visibility('visible'); }, F5);
  await frames(H, 300);
  const woke = await H.evaluate(() => ({ state: HOST.room.state, frame: HOST.room.frame }));
  await frames(H, 5200);
  const woke2 = await H.evaluate(() => ({ state: HOST.room.state, last: window.__collabLog.filter(e => e.ev === 'marks unanswered').slice(-1)[0] || null }));
  const fa5 = unapply(F5, markA), fb5 = unapply(F5, markB), cx5 = unit([fb5[0] - fa5[0], 0, fb5[2] - fa5[2]]);
  check('without anchors, off and on again: the frame follows the reset and is kept (no new calibration asked)', woke.state === 'marks' && !!woke.frame &&
    near([woke.frame.o[0], woke.frame.o[2]], [fa5[0], fa5[2]], 3e-3) && near(woke.frame.x, cx5, 3e-3) && woke2.state === 'marks' && !!woke2.last && woke2.last.reset === true,
    JSON.stringify({ woke, woke2, want: [fa5, cx5] }));
  await H.evaluate(() => window.__xr.end());

  // a full store of saved anchors (one Quest 3 refused every handle: "Maximum number of anchors reached!"): the
  // leftovers nobody knows are deleted and the handles asked again; when the store cannot be freed the marks hold
  // for the session and the panel says a restart will ask to calibrate
  const fullStore = async stuck => {
    await H.evaluate(() => { localStorage.removeItem('roomFrame'); HOST.room.internals().saved = null; });
    await H.evaluate(installXR, Object.assign({}, xrOpts, { features: ['local-floor', 'anchors'], cap: 8 }));
    await H.evaluate(stuck => { window.__xr.stuck = stuck; window.__xr.begin(); }, stuck);
    await frames(H, 300);
    await H.evaluate(() => { const X = window.__xr; for (let i = 0; X.handles.size < 8; i++) X.handles.set('junk-' + i, new THREE.Matrix4()); window.__collabLog.push({ ev: 'test full' }); });
    await recal();
    for (let k = 0; k < 8 && !(await H.evaluate(() => window.__collabLog.some(e => e.ev === 'handles again'))); k++) await frames(H, 250);
    const r = await H.evaluate(() => {
      const L = window.__collabLog, i = L.map(e => e.ev).lastIndexOf('test full'), after = L.slice(i + 1), S = HOST.room.internals().saved;
      return { made: after.find(e => e.ev === 'anchors made') || null, tidied: after.find(e => e.ev === 'anchors tidied') || null, again: after.find(e => e.ev === 'handles again') || null,
        saved: S ? S.anchors.length : -1, junk: [...window.__xr.handles.keys()].filter(u => /^junk/.test(u)).length, full: HOST.room.internals().full, state: HOST.room.state };
    });
    await H.evaluate(() => window.__xr.end());
    return r;
  };
  const fs1 = await fullStore(false), fs2 = await fullStore(true);
  check('a full anchor store: leftovers deleted, the handles asked again and saved', !!fs1.made && /Maximum number of anchors/.test((fs1.made.err || [])[0] || '') &&
    !!fs1.tidied && fs1.tidied.deleted >= 1 && !!fs1.again && fs1.again.saved && fs1.saved === 2 && !fs1.junk && !fs1.full && fs1.state === 'marks', JSON.stringify(fs1));
  check('a full anchor store that cannot be freed: the marks hold for the session, and the panel says so', !!fs2.again && !fs2.again.saved && fs2.full &&
    fs2.saved === 0 && fs2.state === 'marks' && !!fs2.tidied && fs2.tidied.failed.length > 0, JSON.stringify(fs2));

  // ------------------------------------------ a VR headset elsewhere --
  await H.evaluate(installXR, Object.assign({}, xrOpts, { mode: 'immersive-vr', head: [0.3, 1.7, -0.2, 0.6] }));
  await H.evaluate(() => { HOST.collab.menuIdle(400); window.__xr.begin(); });   // (closing by itself soon: but not while it asks)
  await frames(H, 300);
  const own = await H.evaluate(() => ({ frame: HOST.room.frame, src: HOST.room.src, here: HOST.collab.members.find(m => m.id === HOST.collab.id).here }));
  const oh = unapply(FLOOR, [0.3, 1.7, -0.2]);
  check('VR elsewhere: its own floor, centred where it stands, facing its way', own.src === 'own' && !own.here && near(own.frame.o, [oh[0], 0, oh[2]], 1e-4) &&
    near(own.frame.x, rot(0.6 - FLOOR[3], [1, 0, 0]), 1e-4), JSON.stringify(own));
  // in VR the shell's panel asks once per room whether you are in the room with the others; the answer is kept
  const regionIds = () => H.evaluate(() => HOST.collab.menuIds());
  const pressRegion = id => H.evaluate(id => { const r = HOST.collab.menuFind(id); if (r) r.fn(); return !!r; }, id);
  await frames(H, 900);   // (longer than it waits unused: the question keeps it open, on Circles)
  const asked = (await regionIds()).includes('ask:in') && await H.evaluate(() => HOST.collab.menu && HOST.collab.menuTab() === 'circles' && (window.__collabLog.filter(e => e.ev === 'notice').slice(-1)[0] || {}).title === 'One question');
  await H.evaluate(() => HOST.collab.menuIdle(20000));
  await pressRegion('ask:in');
  await frames(H, 300);
  const inRoom = await H.evaluate(() => [HOST.collab.internals().hereSet, HOST.room.src, HOST.room.state]);
  await frames(H, 100);
  const sayAway = (await regionIds()).includes('here') && await pressRegion('here');
  await frames(H, 300);
  const away = await H.evaluate(c => [HOST.collab.internals().hereSet, HOST.room.src, JSON.parse(localStorage.getItem('collabHere') || '{}')[c]], code);
  await H.evaluate(() => window.__xr.end());
  await H.evaluate(installXR, Object.assign({}, xrOpts, { mode: 'immersive-vr', head: [0.3, 1.7, -0.2, 0.6] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 300);
  const shut = await H.evaluate(() => !HOST.collab.menu);   // (asked already: the menu stays closed)
  await H.evaluate(() => HOST.collab.panelOpen(true));
  await frames(H, 150);
  const again = !shut || (await regionIds()).some(id => id.startsWith('ask:'));
  check('VR: the panel asks once whether you are in the room with the others (opened by itself on Circles, kept open until answered; In this room: aligned with them; Say I am elsewhere: your own floor; kept for the room)',
    asked && inRoom[0] === true && inRoom[1] !== 'own' && sayAway && away[0] === false && away[1] === 'own' && away[2] === false && !again,
    JSON.stringify({ asked, inRoom, sayAway, away, again }));
  // Exit (leaving VR or AR) is inside the headset's menu, and not on the story panel; closed, only the clock shows
  await H.evaluate(() => HOST.collab.panelOpen(false));
  await frames(H, 200);
  const exitClosed = await H.evaluate(() => { const O = HOST.collab.overlay(); return !O.panelG.visible && !O.panel.regions.some(x => x.id === 'exit'); });
  await H.evaluate(() => HOST.collab.panelOpen(true));
  await frames(H, 200);
  const exitT = await H.evaluate(() => {
    const s = HOST.session, e0 = s.end, r = HOST.collab.menuFind('exit');
    let n = 0; s.end = () => { n++; };
    if (r) r.fn();
    if (e0) s.end = e0; else delete s.end;
    return { found: !!r, ended: n, story: HOST.cur.peek("XR.main.regions.some(r => r.id === 'exit')") };
  });
  await H.evaluate(() => HOST.collab.panelOpen(false));
  check('Exit is inside the headset\'s menu (not on the closed clock) and ends the session; the story panel has none', exitClosed && exitT.found && exitT.ended === 1 && exitT.story === false,
    JSON.stringify(Object.assign({ exitClosed }, exitT)));
  // the Stories screen's settings in the menu's Settings tab (v109): Sound (this device's mute, off by default), Anchor
  // (in a room it can be turned off, not on: greyed while off) and Repeat (each press the next: off, all, one)
  await H.evaluate(() => HOST.collab.panelOpen(true));
  await frames(H, 100);
  const setT = await H.evaluate(() => {
    const m0 = HOST.audio.muted, a0 = HOST.anchor.on, r0 = HOST.repeat;
    HOST.anchor.set(true);   // (in a room a greyed button, Anchor off, has no region: on first, to be found)
    const ids = HOST.collab.menuIds(), find = id => HOST.collab.menuFind(id), tap = id => { const r = find(id); if (r && r.fn) r.fn(); return !!(r && r.fn); };
    const out = { ids: ['set:sound', 'set:anchor', 'set:repeat'].filter(i => ids.includes(i)).join(), tab: (find('set:sound'), HOST.collab.menuTab()) };
    out.sound = [m0, tap('set:sound'), HOST.audio.muted, tap('set:sound'), HOST.audio.muted].join();
    out.anchor = [tap('set:anchor'), HOST.anchor.on, !!find('set:anchor')].join();   // (off now: greyed in a room)
    HOST.setRepeat('off');
    out.repeat = [1, 2, 3].map(() => (tap('set:repeat'), HOST.repeat)).join();
    HOST.setRepeat(r0); HOST.anchor.set(a0); if (HOST.audio.muted !== m0) HOST.audio.mute(m0);
    HOST.collab.panelOpen(false);
    return out;
  });
  check('the headset\'s menu has Sound, Anchor and Repeat under Settings: Sound turns the mute off and on, Anchor turns off (in a room not on), Repeat goes off, all, one, off',
    setT.ids === 'set:sound,set:anchor,set:repeat' && setT.tab === 'settings' && setT.sound === [setT.sound.split(',')[0], 'true', String(setT.sound.split(',')[0] !== 'true'), 'true', setT.sound.split(',')[0]].join() &&
    setT.anchor === 'true,false,false' && setT.repeat === 'all,one,off', JSON.stringify(setT));

  // ------------------------------------------- a fresh shared space --
  // Fresh shared space (two presses): every page in the room moves to the app under s/<n>/ (a new page address, so
  // Quest Browser gives the headsets a new shared space) and joins the room again there; a headset arriving there is
  // told to start one headset first; a page opened at the old address later is moved too, and the log has the
  // whole address. In a room of its own, so the other pages stay where they are
  const Fp1 = await open('');
  await Fp1.evaluate(() => HOST.collab.detect());   // (the relay found first, as for Fp4 below)
  await Fp1.evaluate(() => HOST.collab.create());
  await until(Fp1, () => !!HOST.collab.code && HOST.collab.status === 'open', null, 8000);
  const fcode = await Fp1.evaluate(() => HOST.collab.code);
  const Fp2 = await open('#s=' + fcode);
  await until(Fp2, c => HOST.collab.code === c && HOST.collab.status === 'open' && HOST.collab.members.length === 2 && HOST.collab.internals().served === true, fcode, 8000);   // (Fresh needs to know the relay serves the page)
  const fVia = await Promise.all([Fp1, Fp2].map(P => P.evaluate(() => HOST.collab.via)));   // (for the report: Fresh needs the relay)
  const fOnce = await Fp2.evaluate(() => { HOST.collab.fresh(); return HOST.collab.val('sg'); });   // armed only
  await Fp2.evaluate(() => HOST.collab.fresh());
  const fMoved = await Promise.all([Fp1, Fp2].map(P => P.waitForURL(/\/s\/1\/(index\.html)?#/, { timeout: 15000 }).then(() => true, () => false)));
  const fBack = await Promise.all([Fp1, Fp2].map(P => P.waitForFunction(c => typeof HOST !== 'undefined' && HOST.collab && HOST.collab.code === c && HOST.collab.status === 'open' &&
    HOST.collab.internals().served === true, fcode, { timeout: 20000, polling: 100 }).then(() => true, () => false)));
  const fFin = await Fp1.evaluate(() => ({ gen: HOST.collab.gen, path: location.pathname, relay: HOST.collab.relay, note: HOST.collab.internals().note, story: HOST.curKey }));
  check('fresh shared space: two presses move every page in the room to the app under s/1/, where they join the room again (the relay still at the root)',
    !fOnce && fMoved.every(Boolean) && fBack.every(Boolean) && fFin.gen === 1 && /\/s\/1\/$/.test(fFin.path) && !/\/s\//.test(fFin.relay) && /fresh shared space/.test(fFin.note || ''),
    JSON.stringify({ fVia, fOnce, fMoved, fBack, fFin }));
  await Fp2.evaluate(() => HOST.start('airports'));
  await ready(Fp2, 'airports');
  await Fp2.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U9', shared: SHARED }));
  await Fp2.evaluate(() => { HOST.landingVR = true; window.__xr.begin(); });   // (as Enter VR on the start screen)
  await frames(Fp2, 1200);
  // (the room's frame comes through the shared space first: on a loaded machine the menu opens a few seconds in)
  await until(Fp2, () => { window.__xr.step(); return HOST.collab.menu; }, null, 8000);
  const fXr = await Fp2.evaluate(() => { const L = window.__collabLog, s = L.filter(e => e.ev === 'session').pop() || {};
    return { told: L.some(e => e.ev === 'notice' && e.title === 'A fresh shared space'), page: s.page, sg: s.sg, search: s.search }; });
  // this room has no stations yet: entered from the start screen, the headset shows no Stories screen and no story, only
  // the menu, opened by itself (Arrange all in it); leaving the room brings the Stories screen back (as for a new
  // wearer), and joining one closes it again
  const fEmpty = await Fp2.evaluate(async c => {
    const X = window.__xr, P = s => HOST.cur.peek(s), steps = async n => { for (let k = 0; k < n; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); } };
    const shown = () => { P('xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : exploreStep(0))'); return { stories: P('XR.stories'), world: P('GL.world.visible'), main: P('XR.main.mesh.visible'), land: P('XR.land[0].mesh.visible') }; };
    const out = { menu: HOST.collab.menu, by: (window.__collabLog.filter(e => e.ev === 'menu').pop() || {}).by, arrange: !!HOST.collab.menuFind('arrange'),
      in: shown() };
    HOST.collab.leave(); await steps(4);
    out.left = Object.assign(shown(), { inStory: P('XR.inStory') });
    HOST.collab.join(c); await steps(4);
    out.joined = shown();
    return out;
  }, fcode);
  check('an empty room in a headset (entered from the start screen): no Stories screen and no story, only the menu, opened by itself with Arrange all; leaving the room brings the Stories screen back, joining one closes it',
    fEmpty.menu && fEmpty.by === 'empty' && fEmpty.arrange && !fEmpty.in.stories && !fEmpty.in.world && !fEmpty.in.main && !fEmpty.in.land &&
    fEmpty.left.stories && !fEmpty.left.inStory && fEmpty.left.land && !fEmpty.left.main && !fEmpty.joined.stories && !fEmpty.joined.land && !fEmpty.joined.world, JSON.stringify(fEmpty));
  await Fp2.evaluate(() => window.__xr.end());
  const Fp3 = await open('?probe=1#s=' + fcode);
  const fp3 = await Fp3.waitForURL(/\/s\/1\/\?probe=1#/, { timeout: 15000 }).then(() => true, () => false);
  const f3In = fp3 && await Fp3.waitForFunction(c => typeof HOST !== 'undefined' && HOST.collab && HOST.collab.code === c && HOST.collab.status === 'open', fcode, { timeout: 20000, polling: 100 }).then(() => true, () => false);
  check('fresh shared space: a headset there is told to start one headset first, its log has the whole address; a page opened at the old address is moved too (its query kept)',
    fXr.told && /\/s\/1\/$/.test(fXr.page || '') && fXr.sg === 1 && fXr.search === '' && fp3 && f3In, JSON.stringify({ fXr, fp3, f3In }));
  // a page at a fresh address in a room with no generation (a relay restarted, a link to a new room) stays there and
  // gives the room its generation, instead of going back to the old address
  const Fp4 = await (await browser.newContext({ viewport: { width: 640, height: 400 } })).newPage();
  Fp4.on('pageerror', e => errors.push(e.stack || e.message));
  await Fp4.goto(base() + 's/1/index.html', { timeout: 90000 });
  await Fp4.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });   // (as open(): a busy machine loads slowly)
  // (the relay found first: on a busy machine the page's first question can wait behind its files for more than the 5 s
  // a room's start waits for it, and the room then starts peer to peer, where no generation is given)
  await Fp4.evaluate(() => HOST.collab.detect());
  await Fp4.evaluate(() => HOST.collab.create());
  // (generous: a fresh page on a busy machine first finds the relay, then makes the room)
  const f4 = await until(Fp4, () => !!HOST.collab.code && HOST.collab.status === 'open' && !!HOST.collab.val('sg'), null, 30000);
  await sleep(1500);
  const f4s = await Fp4.evaluate(() => ({ path: location.pathname, sg: HOST.collab.val('sg'), gen: HOST.collab.gen, code: HOST.collab.code, status: HOST.collab.status,
    via: HOST.collab.via, log: window.__collabLog.slice(-14).map(e => e.ev + (e.keys ? ' ' + e.keys : '') + (e.served !== undefined ? ' ' + e.served : '') + (e.via ? ' ' + e.via : '')).join(', ') }));
  check('fresh shared space: a page at s/1/ in a room with no generation stays there and gives the room generation 1',
    f4 && /\/s\/1\/$/.test(f4s.path) && f4s.gen === 1 && !!f4s.sg && f4s.sg.n === 1, JSON.stringify({ f4, f4s }));
  await Promise.all([Fp1, Fp2, Fp3, Fp4].map(P => P.context().close()));

  // ------------------------------------------- a room on this device --
  // no relay known (a copy on a plain web host) and peer to peer off: a room still works on the page alone, kept in its storage
  const lctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
  await lctx.route('**/api/**', r => r.abort());   // this host answers no relay calls
  const Lp = await lctx.newPage();
  Lp.on('pageerror', e => errors.push(e.stack || e.message));
  Lp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  const lopen = async () => { await Lp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 }); };
  // (peer to peer off: the room on this device; the link turns this device's own sound switches off before it joins)
  await Lp.goto(base() + 'index.html#s=LCL&peer=off&sfx=off&voice=off', { timeout: 90000 }); await lopen();
  const lj = await until(Lp, () => HOST.collab.code === 'LCL' && HOST.collab.local && HOST.collab.status === 'open', null, 8000);
  check('no relay known, peer to peer off: a link opens its room on this device', lj, JSON.stringify(await Lp.evaluate(() => [HOST.collab.code, HOST.collab.local, HOST.collab.status, HOST.collab.relay])));
  // a device that turned the sound switches off keeps them off in a room that never wrote them, and saves them on nowhere;
  // another setting written meanwhile leaves them out of the room's key (it must not hand this device's own to everyone)
  await Lp.evaluate(() => HOST.xr.setSubs(true));
  const lown = await until(Lp, () => { const v = HOST.collab.val('look'); return !!v && v.subs === true && !('sfx' in v) && !('voice' in v) && !HOST.xr.sfx() && !HOST.xr.voice() &&
    !HOST.sfx.on() && localStorage.getItem('sfxOn') === 'off' && localStorage.getItem('narrationOn') === 'off'; }, null, 3000);
  check('a room on this device: a device that turned the sound switches off keeps them off in a room that never wrote them (another setting written leaves them out)', lown,
    JSON.stringify(await Lp.evaluate(() => [HOST.collab.val('look'), HOST.xr.sfx(), HOST.xr.voice(), HOST.sfx.on(), localStorage.getItem('sfxOn'), localStorage.getItem('narrationOn')])));
  await Lp.evaluate(() => { HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }); });
  await until(Lp, () => HOST.collab.stations().length === HOST.list.length && !HOST.collab.internals().pending.size, null, 3000);
  const lsid = await stationOf(Lp, OTHER_STORY);
  await Lp.evaluate(id => { HOST.collab.move(id, { x: 0.5, z: -3, yaw: 0.2 }); HOST.collab.lock(true); }, lsid);
  check('a room on this device: Arrange all, moving a station and the lock work alone', await until(Lp, () => HOST.collab.stations().length === HOST.list.length && HOST.collab.locked &&
    !HOST.collab.internals().pending.size, null, 3000));
  // the headsets' settings in a room on this device: the room's too (with the layout locked), and kept with it
  await Lp.evaluate(() => { HOST.xr.setLabels('hidden'); HOST.xr.setCards('face'); HOST.xr.setFree(false); HOST.xr.setSubs(true); HOST.sfx.set(false); HOST.xr.setVoice(false); });
  const lookL = () => { const L = HOST.collab.look(); return !!L && L.labels === 'hidden' && L.cards === 'face' && L.free === false && L.subs === true && L.sfx === false && L.voice === false; };
  const llook = await until(Lp, `(${lookL})() && !HOST.collab.internals().pending.size`, null, 3000);
  await sleep(700);   // kept at most 0.4 s after a change
  await Lp.reload({ timeout: 90000 }); await lopen();
  const lk = await until(Lp, id => HOST.collab.code === 'LCL' && HOST.collab.local && HOST.collab.stations().length === HOST.list.length && HOST.collab.locked &&
    HOST.collab.station(id) && HOST.collab.station(id).z === -3 && HOST.collab.kept().some(r => r.code === 'LCL' && r.stations === HOST.list.length), lsid, 8000);
  check('a room on this device: kept across a reload (stations, places, the lock)', lk, JSON.stringify(await Lp.evaluate(() => [HOST.collab.code, HOST.collab.local, HOST.collab.stations().length, HOST.collab.locked, HOST.collab.kept()])));
  const llook2 = await until(Lp, `HOST.collab.code === 'LCL' && (${lookL})() && HOST.xr.labels() === 'hidden' && HOST.xr.cards() === 'face' && !HOST.xr.free() && HOST.xr.subs() && !HOST.sfx.on() && !HOST.xr.voice()`, null, 8000);
  check('a room on this device: the headsets\' settings and the sound switches are the room\'s (set with the layout locked) and kept across a reload', llook && llook2,
    JSON.stringify(await Lp.evaluate(() => [HOST.collab.look(), HOST.xr.labels(), HOST.xr.cards(), HOST.xr.free(), HOST.xr.subs(), HOST.sfx.on(), HOST.xr.voice()])));
  await Lp.evaluate(() => { HOST.collab.lock(false); HOST.xr.setLabels('face'); HOST.xr.setCards('fixed'); HOST.xr.setFree(true); HOST.xr.setSubs(false); HOST.sfx.set(true); HOST.xr.setVoice(true); });
  await ready(Lp, 'airports');
  // a headset alone (no shared space): the stations stand on its floor; the panel has Re-align, not the question
  // whether it is in the room with the others; walking up to a station plays its story there
  await Lp.evaluate(installXR, Object.assign({}, xrOpts, { mode: 'immersive-vr', features: ['local-floor', 'anchors'] }));
  await Lp.evaluate(() => window.__xr.begin());
  await frames(Lp, 400);
  const lf = await Lp.evaluate(() => ({ src: HOST.room.src, aligned: HOST.room.aligned, o: HOST.room.frame && HOST.room.frame.o, ids: HOST.collab.menuIds() }));
  check('a room on this device, in a headset: the stations stand on its floor, and the panel offers Re-align (no question about the others)',
    lf.src === 'floor' && lf.aligned && near(lf.o, [0, 0, 0], 1e-6), JSON.stringify(lf));
  await Lp.evaluate(() => HOST.collab.panelOpen(true));
  await frames(Lp, 100);
  const lids = await Lp.evaluate(() => HOST.collab.menuIds());
  // (the menu at its tallest, a room on this headset with a three-line note: You and its colours still on it)
  const lfit = await Lp.evaluate(() => {
    const X = window.__xr, C = HOST.collab.internals(), S = HOST.collab.overlay().panel, keep = C.note;
    const fits = () => { const c = S.regions.find(x => x.id === 'col:7'); return !!c && c.y + c.h <= S.vis && S.vis <= S.h; };
    HOST.collab.menuTab('circles'); X.step(); X.step();   // (its tallest tab)
    const plain = fits();
    C.note = 'A note three lines long: the relay could not be reached, so this room stays on this headset until one answers, and nobody else can join it yet.';
    S.sig = ''; X.step(); X.step();
    const out = { plain, tall: fits(), vis: S.vis, h: S.h };
    C.note = keep; S.sig = ''; X.step();
    return out;
  });
  const lfits = lfit.plain && lfit.tall;
  const lre = lfits && lids.includes('realign') && !lids.includes('here') && !lids.some(id => id.startsWith('ask:')) &&
    await Lp.evaluate(() => { HOST.collab.menuFind('realign').fn(); return !!HOST.room.internals().again; });
  await frames(Lp, 200);
  const lre2 = await Lp.evaluate(() => ({ again: HOST.room.internals().again, src: HOST.room.src, note: window.__collabLog.filter(e => e.ev === 'notice').slice(-1)[0] }));
  check('a room on this device: Re-align with nothing to line up with keeps the stations where they are (the menu fits, also with a long note)', lre && !lre2.again && lre2.src === 'floor' &&
    lre2.note && lre2.note.title === 'Nothing to re-align to', JSON.stringify({ lids, lfit, lre, lre2 }));
  const ROOM0 = ROOM;
  ROOM = FLOOR;   // this headset's room is its floor
  const lS = await Lp.evaluate(k => HOST.collab.stations().find(s => s.story === k), HEADSET_STORY);
  const lw = await walk(Lp, lS, HEADSET_STORY, 0.2);
  const lrig = await rigOf(Lp), lwant = rigAt(lS);
  ROOM = ROOM0;
  check('a room on this device, in a headset: a second at a station plays its story there', lw && near(lrig.slice(0, 3), lwant.slice(0, 3), 1e-4), `rig ${fmt(lrig)}, want ${fmt(lwant)}`);
  // a relay entered later: the room goes there (made from this device's copy), and others can join it; the headset
  // keeps its placement and is not asked whether it is with the others
  await lctx.unroute('**/api/**');
  await Lp.evaluate(u => HOST.collab.setRelay(u), base().replace(/^http/, 'ws'));
  const lback = await until(Lp, () => { window.__xr.step(); return !HOST.collab.local && HOST.collab.status === 'open'; }, null, 10000);
  await frames(Lp, 400);
  const lkeep = await Lp.evaluate(() => ({ src: HOST.room.src, o: HOST.room.frame && HOST.room.frame.o, ask: HOST.collab.menuIds().some(i => i.startsWith('ask:')), here: HOST.collab.internals().hereSet }));
  check('moving to the relay, the headset keeps its placement (no question about the others)', lkeep.src === 'floor' && near(lkeep.o || [9, 9, 9], [0, 0, 0], 1e-6) && !lkeep.ask && lkeep.here === true, JSON.stringify(lkeep));
  await Lp.evaluate(() => window.__xr.end());
  const linfo = lback ? await until(Lp, () => !HOST.collab.internals().pending.size, null, 5000) && await roomInfo('LCL') : null;
  const ist = linfo ? Object.keys(linfo.keys).filter(k => /^st\.[\w-]+$/.test(k)).length : 0;
  check('a room on this device goes to a relay once one answers, with its stations', lback && ist === NST && linfo.keys['st.' + lsid].v.z === -3, JSON.stringify({ lback, ist }));
  const Lo = await open('#s=LCL');
  check('and another device joins it there', await st7(Lo));
  await Lo.context().close();
  await lctx.close();
  // a relay that cannot be reached as the room is joined, peer to peer off: the room goes on, on this device
  const uctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
  const Up = await uctx.newPage();
  Up.on('pageerror', e => errors.push(e.stack || e.message));
  await Up.goto(base() + 'index.html#s=QQQ&relay=' + encodeURIComponent('ws://127.0.0.1:9') + '&peer=off', { timeout: 90000 });
  await Up.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
  check('a relay that cannot be reached, peer to peer off: the room opens on this device instead', await until(Up, () => HOST.collab.code === 'QQQ' && HOST.collab.local && HOST.collab.status === 'open', null, 10000),
    JSON.stringify(await Up.evaluate(() => [HOST.collab.code, HOST.collab.local, HOST.collab.status, window.__collabLog.filter(e => /local|close|join/.test(e.ev)).slice(-5)])));
  await uctx.close();

  // ------------------------------------- the ten-headset round (a room of its own) --
  if (shots) fs.mkdirSync(shots, { recursive: true });
  await headsetRound(shots);
  // --------------------------------------- circles asked first (a room of its own) --
  await askRound(shots);
  // ------------------------------------ your menu shown to your circle (a room of its own) --
  await menusRound(shots);
  // --------------------------- the narration in headsets and the welcome (a room of its own) --
  await narrationRound();
  // ----------------- moving with the sticks for a VR headset elsewhere in a room (a room of its own) --
  await walkRound();
  // --------------------------------- others' moves drawn smoothly (a room of its own) --
  await smoothRound();
  // ------------------------------------------- a room by its code, from a headset's menu --
  await codeRound();
  // ------------------------- the All stories and Back to the lobby circles (a room of its own) --
  await allRound();
  // ------------------------------------------ the room setup guide and Touch the spot (a room of its own) --
  await guideRound();
  // ------------------------------------------ the studio in a room (relays of its own, with --scenes) --
  await studioRound(shots);
  // ----------------------------- the studio's scenes as circles (a relay of its own, with --scenes) --
  await scenesRound();
  // ------------------- the relay the main site offers (HOME_RELAY, by the page's host; a browser of its own) --
  await homeRound();
  // ------------------------------ the studio's behaviours shared (a relay of its own, with --scenes) --
  await behaveRound();
  // ------------------- the PC's Vive trackers end to end (a relay of its own with --trackers and --scenes; the fake bridge) --
  await trackersRound(shots);
  // ------------------------------------------- camera mode (a phone filming the room; a room of its own) --
  await cameraRound(shots);

  // ------------------------------------------------------ pictures --
  if (shots) {
    fs.mkdirSync(shots, { recursive: true });
    // another person in VR (page C), standing at the room's middle and pointing at H
    const Sf = S1;
    await C.evaluate(installXR, Object.assign({}, xrOpts, { mode: 'immersive-vr', head: [0.3, 1.7, -0.2, 0.6] }));
    await C.evaluate(() => { HOST.collab.me({ name: 'Grace', color: '#ff5ad9' }); window.__xr.begin(); });
    await frames(C, 300);
    // both in their own frames (made from the same spot): room coordinates agree. (Grace stands at no circle: H draws her
    // with People: everyone, as for debugging; at its circle it would draw only the people there)
    await H.evaluate(() => { HOST.collab.me({ name: 'Ada', color: '#3ee08f' }); HOST.collab.seeAll(true); });
    await goRoom(H, Sf.x, 1.6, Sf.z, Sf.yaw);
    await frames(H, 1300);
    await ready(H, HEADSET_STORY, 40000);
    await goRoom(C, 0.4, 1.65, -0.3, Math.atan2(-(Sf.x - 0.4), -(Sf.z + 0.3)));
    await C.evaluate(([x, z]) => {
      const X = window.__xr, R = HOST.room.internals(), L = X.W.local;
      const o = new THREE.Vector3(0.6, 1.3, -0.4).applyMatrix4(R.m).applyMatrix4(L), t = new THREE.Vector3(x, 0, z).applyMatrix4(R.m).applyMatrix4(L);
      X.ctrl(0, o.toArray(), t.sub(o).normalize().toArray());
    }, [Sf.x * 0.5 + 1.2, Sf.z * 0.5 - 1.2]);   // pointing at the floor, off to the side (seen from H)
    await frames(C, 600);
    await frames(H, 400);
    const view = (file, yawRoom, pitch, size) => headView(H, path.join(shots, file), yawRoom, pitch, size);
    const face = Math.atan2(-(0.4 - Sf.x), -(-0.3 - Sf.z));
    await view('headset-people.png', face, -0.12);
    await H.evaluate(() => HOST.collab.panelOpen(true));
    await frames(H, 200);
    await view('headset-panels.png', Sf.yaw + 0.85, -0.18);
    // the menu floating in front of you, on its Settings tab and then its Story tab (the story's own panels on it)
    await H.evaluate(() => { HOST.collab.panelOpen(false); HOST.collab.panelOpen(true); HOST.collab.menuTab('settings'); });
    await frames(H, 300);
    await view('headset-menu.png', Sf.yaw, -0.13);
    await H.evaluate(() => HOST.collab.menuTab('story'));
    await frames(H, 300);
    await view('headset-story-tab.png', Sf.yaw, -0.13);
    // Sound check in the menu
    await H.evaluate(() => { const r = HOST.collab.menuFind('sound'); if (r) r.fn(); });
    await frames(H, 300);
    await view('headset-sound.png', Sf.yaw, -0.13);
    await H.evaluate(() => HOST.collab.panelOpen(false));
    await H.evaluate(() => { const c = HOST.cur.peek('XR.ctrls')[1]; c.g.visible = false; c.src = null; window.__xr.session.inputSources.length = 0; });
    // stepped out of the station's circle, facing the stations: still in its story (the scene and its panel where the
    // station has them), the others as icons only, the other person, and the menu's clock beside the story panel
    const sp = await awaySpot(H, Sf);
    if (sp) {
      const toward = Math.atan2(-(Sf.x - sp[0]), -(Sf.z - sp[1]));
      await goRoom(H, sp[0], 1.6, sp[1], toward);
      await frames(H, 800);
      await view('headset-away.png', toward, -0.08);
    }
    // the stations' icons over their rings, from 3.8 m behind the first row and from near its left end, along it, seen by
    // C (in VR, in no circle yet: everything shows; in a circle only the rings would)
    await H.evaluate(() => HOST.collab.seeAll(false));
    await C.evaluate(() => window.__xr.ctrl(0, null));
    await goRoom(C, 0, 1.6, 2.6, 0);
    await frames(C, 800);
    await headView(C, path.join(shots, 'headset-icons.png'), 0, 0.05, [1280, 800]);
    await goRoom(C, -4.8, 1.6, 0.6, -0.67);
    await frames(C, 800);
    await headView(C, path.join(shots, 'headset-icons-near.png'), -0.67, 0.1, [1280, 800]);
    // the page's dialog with the room map, on a desktop and on a phone
    await A.setViewportSize({ width: 1000, height: 760 });
    const alive = Promise.all([frames(H, 3500), frames(C, 3500)]);   // the two headsets keep sending where they are
    await sleep(1200);
    await A.evaluate(() => HOST.collab.dialog(true));
    await sleep(900);
    await A.screenshot({ path: path.join(shots, 'dialog-desktop.png') });
    await alive;
    const P = await open('#s=' + code, { width: 390, height: 844 });
    await st7(P);
    await P.evaluate(() => HOST.collab.dialog(true));
    await sleep(900);
    await P.screenshot({ path: path.join(shots, 'dialog-phone.png') });
    await P.evaluate(() => document.querySelector('#shared .box').scrollTo(0, 420));
    await sleep(300);
    await P.screenshot({ path: path.join(shots, 'dialog-phone-2.png') });
    console.log('pictures in ' + shots);
  }
  }   // (main)
  if (!NEAR_ONLY && !DESIGN_ONLY && !FOLLOW_ONLY && !CIRCLES_ONLY && !SMOOTH_ONLY && !CODE_ONLY && !ALL_ONLY && !GUIDE_ONLY && !TOKEN_ONLY && !STUDIO_ONLY && !ASK_ONLY && !SCENES_ONLY && !HOME_ONLY && !MENUS_ONLY && !BEHAVE_ONLY && !STANDBY_ONLY && !NARR_ONLY && !WALK_ONLY && !CAMERA_ONLY && !TRACKERS_ONLY) await p2p();
  if (!P2P && !DESIGN_ONLY && !FOLLOW_ONLY && !CIRCLES_ONLY && !SMOOTH_ONLY && !CODE_ONLY && !ALL_ONLY && !GUIDE_ONLY && !TOKEN_ONLY && !STUDIO_ONLY && !ASK_ONLY && !SCENES_ONLY && !HOME_ONLY && !MENUS_ONLY && !BEHAVE_ONLY && !STANDBY_ONLY && !NARR_ONLY && !WALK_ONLY && !CAMERA_ONLY && !TRACKERS_ONLY) await nearby();
} catch (e) {
  console.log('FAIL ' + (e.stack || e.message));
  fails.push('exception');
} finally {
  await browser.close();
  await stopRelay();
}
if (errors.length) { console.log('\npage errors:\n' + errors.join('\n\n')); fails.push('page errors'); }
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
console.log('\nall good');
