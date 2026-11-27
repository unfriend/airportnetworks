# The shell: history (moved out of docs/agents/shell.md)

Sentences that only tell what happened (a bug found, what the first version did, the owner's words that started a change), moved
word for word out of `docs/agents/shell.md` at v224, when that file was given a heading per topic. The rule each one sat beside
stays in `docs/agents/shell.md`, under the same heading. It is history: when a rule changes, change `docs/agents/shell.md`.
The rest of the shell's history (version by version) is in `docs/history/releases.md`.

## Sharp text: when things go wrong, and what was tried

- Why (the owner's note, 25 November 2026, Quest Browser 157, v199 and v200: "In VR the texts are not sharp, neither the
  panels in the stories nor the menu"; its log *sharp text {"err":"no layers in this session"}* in VR and in AR): a
  single VR session that closed by itself in its first 10 s, or whose page went with it (a reload), had set `noLayers`
  for good on that headset, so every later session, VR and AR, asked for no layers. That is the cause the code allows
  (the only path to a session without `'layers'` while Sharp text is on in Quest Browser); the new `xr session` log line
  confirms it in the next note. (Was in the bullet *When things go wrong (v176)*, after "a drop stored before v202 is
  forgotten once".)
- Tried again after v177 (the owner, 20 November 2026: "this works and does not cost a lot"): the menu as a layer and
  the cost on a Quest. (Was in the bullet *Tried on a Quest (v174 ...)*.)

## Sound belongs to the shell (`HOST.audio`)

- the narration used to work on the Quest when it started right at Enter VR, and stopped when it started only after a
  pick on the headset Stories screen. (Was in the paragraph on the two engines (after "opening the real one again inside
  a headset can fail;").)

## Real-world occlusion (`HOST.occlusion`, `occlusion.js`)

- Until v195 the default was `'both'` and the words *room and people* / *room* / *people* / *nothing* (the owner, 24
  November 2026: the room scan "does not really occlude well usually"; the keys stayed, so nothing was migrated). (Was
  in the bullet *The setting.* of Real-world occlusion, after the line on the default.)

## A story's copy (arrangements, `HOST.arrange`, v170)

- The owner, 18 and 19 November 2026: "a copy button to copy them to the relay and then edit in case this is wanted";
  "rearranging and timing etc, no logic". (Was in the opening paragraph of A story's copy.)
