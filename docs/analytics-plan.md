# Analytics for studies: parked plan

**Status: parked** (20 November 2026). Nothing is built. The owner asked for it, then stopped it to rethink it together
with the survey data the studies need. Start here when it comes back.

## The request

The owner, 20 November 2026: "Add analytics? Like who looks at what, where do people spend most time, how long per
person, etc, make it so that we can use this for a publication and studies?" Then: "i have to rethink this and also
think about the kind of survey data that i need, note it down for later for now".

## Decisions still open

These were asked and not yet answered. Each changes what gets built.

1. **Consent: who is recorded.** Data for a publication needs informed consent (GDPR, the ethics committee).
   - An opt-in card for everyone: asked once, nothing sent before Yes; study links (`&study=CODE`) show the study's own
     text and tag the data.
   - Study links only: the public site never asks and never records.
   - Anonymous counts for everyone (no id at all), and per-person paths and times only after Yes.
2. **Detail beyond time per story, chapter and mode, by device** (any of):
   - explore choices (the selected airport or protein, the tab), from each story's `collab.state()`;
   - headset gaze: head position and direction once a second in VR and AR (larger files, its own line on the card);
   - a participant code (typed by the experimenter or in the link), to join the logs with questionnaires;
   - interaction counts: taps, clicks, controller presses, seeks and pauses per chapter.
3. **Results:** an export tool on a laptop (tidy CSV for R or Python: sessions, story visits, chapters, events) and a
   one-page HTML report; or that and a live page on the relay behind its password.
4. **Budget:** about +0.8M tokens (core only), +1.5M (everything, built in the main conversation, one Sonnet review),
   or +3M (two builders in parallel, review, fix round, relay and shared-room runs).

In every option the data stays on the owner's own relay: no third party, a random pseudonymous id, no IP addresses,
names or device fingerprints.

## Survey data to decide first (the owner's open point)

The logs are only as useful as what they can be joined to. To settle before building:

- **The research question.** Learning (what people understand and remember), engagement (time, completion, what they
  explore), presence and comfort in a headset, or a comparison of devices or settings. It decides the instruments and
  the design (within or between people, sample size).
- **Conditions to compare.** Device (headset VR, headset AR, desktop, phone), alone or in a shared room, narrated or
  self-paced, which story.
- **When people answer.** Before and after a story, and perhaps a delayed follow-up (retention after days or weeks).
- **Instruments, for example:** a few knowledge items per story (matched to its chapters, so they can be set against
  time per chapter), interest in or attitudes to science, presence (IPQ), simulator sickness (SSQ), usability (SUS),
  engagement (UES short form), workload (NASA-TLX). Keep it short: people at events have little time.
- **Background, kept minimal:** age band, prior VR experience, role or education. No names; nothing that identifies a
  person on its own.
- **Where people answer.** In the university's survey tool, joined by a participant code; or inside the app, in the
  headset (asking in VR avoids taking the headset off between the experience and the questions). In-app questions
  would be a feature of their own.
- **Consent and paperwork.** One consent covering logs and survey together; the privacy notice and consent text checked
  by the university's data protection officer; the ethics committee's approval before data for a publication is
  collected. Retention period and how a person withdraws (by their code).

## What the code already offers (found 20 November 2026, at v178)

A sampler in the shell could record everything above without touching the sixteen stories:

- The story on show: `HOST.curKey`, set in `HOST.run` (`index.html`); `HOST.picking` while the Stories screen is open.
- Mode, clock and playing: `HOST.cur.collab.APP` (`mode` 'story' or 'explore', `t`, `playing`).
- Chapters: `HOST.cur.peek('CH')` gives each chapter's `key`, `name`, `na` and `nb` on the clock; `peek('T_END')` the
  end. Focus mode's `chAt(ch, t)` already finds the chapter at a time.
- Headset: `HOST.session` and `HOST.mode` ('immersive-vr' or 'immersive-ar').
- Explore choices: `HOST.cur.collab.state()` (plain JSON of outcomes, the same in every story).
- Sending: the relay already answers other origins (`cors` in `relay/server.mjs`), and the main site on GitHub Pages
  knows its relay (`HOME_RELAY` in `shared.js`: `stories.lbi-netmed.com` to `main.lab.lbi-netmed.com`).
- Storing: `relay/notes.mjs` is the pattern for a store on disk or in R2. R2 objects cannot be appended to, so events
  would be kept in batches (one object per batch or per few minutes), and a day's log read back from them.

A sketch, not decided: a shell file (say `analytics.js`) samples once a second, adds the time to (story, mode, chapter,
device), leaves out hidden pages and idle time, and sends batches with `navigator.sendBeacon` to `POST /api/analytics`
on the relay, which keeps nothing unless started with `--analytics`. The rules it would meet: the new file in `sw.js`
`SHELL` and `relay/server.mjs` `APP_FILES`, a `VERSION` bump, never anything in `collab.state()` (so no `FORMAT` bump),
the consent choice per device like the headset settings, and the methods (what is sampled, how often, what counts as
idle) written down for a paper's methods section.
