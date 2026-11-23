# Review of docs/packages-migration.md (23 November 2026, v184)

Verdict: **go with changes**. The mechanism is sound (both forms already run side by side; a story moves in one commit).
The plan is too big: roughly half of it (G4, G5, G6 proper, R1 to R3) is not needed to move a single story, and some of
it adds risk (a `FORMAT` bump, rewrites of three stories).

## 1. Factual checks (what holds, what does not)

Holds, checked in code: `appKey` in `HOST.packages.entry` (index.html ~2865) refuses a key still in `STORY_LIST` or
`STORY_EXTRA`; `merge()` puts the app's own entries first and the listed packages after (index order); `HOST.load` uses
`pk.base + 'main.js?v=' + pk.fp`; `packages.read()` calls `HOST.live.changed` for a changed `fp`; `scan.mjs` leaves
`src/` out of `fp`; `sw.js` has the `PKG` rule before the narration rule, `SHELL` and `AUDIO` are written by
`release.mjs` from `stories/list.js` and `audio/`; `shared.js` `iconOf` reads `meta(key).icon`; `FORMAT` is
`networks-55`; the built stories differ from ppicell's engine only in `e1_head` (`KEY`, `pkgUrl`, `pkgMeta`) and
`e7_app` (`narrationFile`, `hasNarration`).

Wrong or doubtful:
- `tools/engine/all.mjs` selects builds by the text `'../engine/parts.mjs'`. `packages/ppicell/src/build.mjs` loads
  parts through `path.join(root, 'tools', 'engine', 'parts.mjs')`, so the plan's "imports tools/engine/parts.mjs"
  match will skip every package build unless the matcher changes (not mentioned in G3).
- `tools/collab.mjs` (lines 367 to 377) silently prunes `STORIES` of any key not in `STORY_LIST` ("its round is left
  out"), and `tools/smoke.mjs` line 63 takes `STORY_KEYS` from `STORY_LIST` only. Moving a story therefore does not fail
  a test, it quietly removes the story from the hook-line checks. The plan knows (G2) but ranks it as tidying; it is
  the first thing that must exist before any move.
- Section 7 says the new worker "fetches nothing of the moved story" and section 5 says install takes `main.js`.
  They agree only once G6's install part is in; the pilot release must not ship without it, or an installed device
  that updates offline loses that story.
- Sections 0 and 4 treat "equal state across copies" as a risk to engineer for. A move keeps the key and the engine,
  so the `state()` shape is byte-identical; see finding 1.

## 2. Findings, ranked (high severity only)

1. **G4 (`FORMAT` bump, `COLLAB_V` in every built story, `st.<id>.pk`, `rev`/`fp` guard, `--copies` round) is not needed
   for the migration and is the riskiest groundwork.** A `FORMAT` change makes every room refuse every device on the
   old format, at once, for no change of shape. `COLLAB_V` in the shared `e4_explore` part forces a rebuild of all
   built stories and a hand edit of the three hand-written ones before anything moves. The mixed-copy cases it
   guards are already handled: a stale shell is refused by `needs` and asked to reload (`HOST.live`), a missing package
   is `HOST.unknown`, and two copies of one release come from one host. Mixed hosts (Pages vs relay) already exist
   today for any story file. Keep it as a separate, later feature if the owner wants it.
2. **R1 to R3 (rewriting airports, proteins and spatial) are 4.7M Opus plus 1.5M Sonnet and buy nothing for packaging.**
   The hand-written files already do `HOST.register('<key>', ...)` and take no shell API a package lacks. A package can be
   the file itself: `git mv stories/airports.js packages/airports/main.js`, a `story.json`, and the three narration
   literals changed (`audio/narration.mp3` at airports.js ~3214, `-proteins` at proteins.js ~3222, spatial likewise) to
   `HOST.pkgUrl(...)`, or leave the audio in `audio/`. `tools/pass/build.mjs` `ORIGINALS` changes one path per file.
   The plan's own proof burden (pictures within a threshold, state converters, a millisecond table for the human
   recording, owner decisions on lost headset details) disappears. One check to run first: `tools/packages/check.mjs`
   rules on the hand-written files (renderer, navigation, `--load`), to be seen before committing to this.
3. **The pilot is the wrong story.** Flock is `HEADSET_STORY` (collab's last entry, used at lines 1989, 2024, 2074,
   2914): moving it first entangles the pilot with the heaviest test. Use `robots` (tail of the list, life size, no
   shared sets, no collab role).
4. **Order of the Stories screen needs far less than `order.json` + `pos` + a boot wait.** Packages already append after
   the app's entries. Moving the tail first (tutorial, robots, flock, spatial, proteins, then up) keeps every position.
   Only the index's own order (a `pos` or `order` number from `story.json`) is needed. The boot wait in G1 is needed
   only when `STORY_LIST` can be empty, which is the last step.
5. **G5 (miniatures in packages) and G6's *Take all stories* are new features, not migration.** `story.json` can
   carry `icon: "robots.x"` naming a miniature that stays in `lowpoly.js` (the shell's `iconOf` already reads
   `meta.icon`; the entry copy is a one-line change in `HOST.packages.entry`). The design room is untouched.
   The only part of G6 the migration needs is the install-time fetch of each listed package's `main.js` (and the
   `NARR` copies, see 6), so installed copies keep opening every story offline.
6. **Narrations are the quiet regression.** A moved mp3 lives at a new address in `PKG`, never in the `NARR` copy a
   headset already holds (up to 60 MB), and `PKG` stores only whole non-range responses. Event headsets prepared before
   the release go silent offline until re-taken, and the old `NARR` bytes sit unused. Cheapest fix: leave the
   narrations in `audio/` during the move (no byte or address change, `AUDIO` list unchanged) and move them only in the
   cleanup step, if at all.
7. **Smaller:** the proteins and spatial `.html` stubs and `#key` deep links are fine; `tools/update.mjs` and
   `tools/live.mjs` need only one new case each (a story moved), not a rewrite; `version.json` `packages` (G7) is useful
   but `missing(key)` already works from the index.

## 3. Can stories move one by one with both forms side by side?

Yes. The commit removes the `list.js` entry and the `stories/<key>.js` file and adds the folder. Old pages keep their
cached file and cached `list.js` (their `appKey` check drops the new index entry); a new page loads the package. The
one-version rule holds through `needs` and the `?v=fp` addresses. Required before the first move: G2's key source for
smoke and collab, G7's `release.mjs` accepting a shrinking `STORY_LIST` and stamping `needs`, and the install-time
fetch. Not required: `tools/lib`, rooms changes, miniatures, rewrites.

## 4. Cost

The plan: about 11M Opus + 4.5M Sonnet, 22 to 25 sessions. Inflated by: R1 to R3 (4.7M + 1.5M); G4 (0.8M + 0.3M);
G5 (0.5M + 0.2M); G6's offline manager (0.5M of 0.7M); per-batch Sonnet review and doc rounds for what a script does
the same way each time. The 14 built-story moves are one recipe (`git mv`, `story.json` from the list entry, build.mjs
from the template, scan, `same.mjs`): script it once (`tools/packages/move.mjs`), and batches A to C are reviews of
diffs, not builds. The plan prices them at 3.2M Opus for 14 stories; a script plus one pilot makes that about 1.2M.

## 5. Leaner alternative (and the smallest first slice)

First slice (groundwork subset plus pilot): G2 (`tools/stories.mjs`; smoke and collab keys from `HOST.list`), G1-lite
(`icon` and `intro` accepted in `story.json`, the scan's order, index order in the merge), G7-lite (`release.mjs`
with a shrinking list, `needs`), install-time precache of listed `main.js`, then **robots** as pilot, proven by
`same.mjs`, `xrsame.mjs`, `panelsame.mjs`, `check.mjs --load`, smoke and `tools/update.mjs` with its move case. That
proves the format, the one-version rule and offline for about 1.8M Opus + 0.7M Sonnet, 3 to 4 sessions.

Then: `move.mjs`, the other built stories tail first in three batches (shared sets stay where they are, read by
relative path from `packages/<key>/src/`; `tools/lib` only if wanted later); the tutorial last of the built ones;
the three hand-written stories wrapped (move + path patches, pass `ORIGINALS` paths), airports last; narrations stay
in `audio/` until cleanup; Z cleanup.

Estimate: about 4.5M Opus + 2M Sonnet, 10 to 12 sessions. Deferred as separate, optional items: G4's guard,
package miniatures, *Take all stories*, the rewrites (each only if the owner asks for it for its own sake).

## 6. Questions that change the plan

- Is the owner after the packaging, or the rewrites? Only the second needs R1 to R3 and Q1.
- Must the shared-room `rev` guard exist now? If not, `FORMAT` stays at 55 through the whole migration.
