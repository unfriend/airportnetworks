# Chunk 02: handover and planning pages in docs/ (working notes, rewritten at the end)
Read: docs/event-runbook.md (563 lines)
Read: docs/history.md (921 lines)
notes runbook: living operator reference; 61 KB; line 14 one table cell ~4 KB; sec 7 untested list ~60 lines repeats shared-rooms.md "tried on headsets"; 4x TO FILL (owner) lines 111,364,451,523
notes history: FORMAT para lines 155-198 one 8 KB run-on, dup networks-48/49 inside line 198, missing '.' before networks-56; fragments starting "(" or ";" at 202,210,228,241,247,253,262,284,295,399,405,420,428,436,445,452,459,465,486; testing 878-919 = 40 "came in" lines, 'developer mode' twice (883,897); line 577 tools/tutorial/SPEC.md stale; headline says networks-10 to -61
Read: docs/multiplayer.md (104 lines)
Read: docs/packages-migration-review.md (108 lines)
Read: docs/packages-migration.md (663 lines)
notes multiplayer: lessons from another project (Oct 2026), pre-design; stale vs app: "No auth: code is the secret" (password v110), ?s= (app #s=), "No undo"
notes review: record, has a note at top; 9 KB; archive
notes migration: finished at v190; lines 218-663 (~43 KB) superseded sections 0-12; live part = "Left for later" 110-189; lines 191-216 "Moving a built story" sits inside Left for later (b), stale (nothing left to move); line 16 tools/lbi/sets/body.js; 104-108 small leftovers
Read: docs/pet-poster-comparison.md (60 lines)
Read: docs/quest-shared-space-findings.md (176 lines)
Read: docs/questions-for-authors.md (235 lines)
notes pet-poster: finished review 29 Oct, small (4.7 KB), referenced from pet SPEC/main.js/HANDOVER; open points live in questions-for-authors P4-P11; keep, mark as record
notes quest-findings: lessons record Oct 2026 with 2 later patches (v122, v124); "Still untested" list (165-169) is 3rd copy of runbook sec 7 / shared-rooms.md 2232; ref'd from shared.js? check
notes questions: living; 12x "Contact person: TO FILL (owner)"; step 2 says run the smoke test (rule: only before main); ikerdata/ named as source folder though removed 3 Nov (N5 says so)
Read: docs/setup-and-release.md (446 lines)
notes setup: living; stale: l.231 VERSION v212/v213 next (now v216), l.240 FORMAT networks-59 (now 61), l.419 "no licence" (LICENSE exists?), l.130 tools/<key>/ built first, l.217-227 dependants table 3rd copy & incomplete (organs: no pet; look: no cdk5; no exposome/pass rows), l.234 file list misses bodies.js ik.js flight.js output.js fonts/; sec 3 table (18 rows, ~9 KB) = 3rd copy of AGENTS Testing + docs/agents/testing.md
notes props (lines 1-420 read): catalogue of 51 sets, one ~40-line entry each (param table, view table, controls, anchors, labels, exports); text says values "read by building every set in Node and dumping"; descriptions truncated with "…", label strings with newlines stripped ("Screws53 of them") => machine-written once; twin = packages/<key>/src/props.json; l.91-94 says exposome+ppicell not catalogued (checked v212); int_path0..9 = 10 identical rows; sankey_h1..9 9 rows
