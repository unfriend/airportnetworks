// Since v187 every story is a story package (packages/<key>/: story.json holds what an entry here held, packages/order.json
// the Stories screen's order; docs/packages-migration.md), so STORY_LIST is empty. It stays, as does this file: older
// shells read it, and the shell still takes an entry here (before the packages) if one is ever added: key (the file
// stories/<key>.js), kick, title, col and desc (its card), page, brand and sub (the tab's and the top bar's title), aria,
// thing and loading (the canvas, the AR button, the loading line), len (the length on its card); icon: its miniature in
// lowpoly.js (a key of LOWPOLY_MODELS), drawn over its stations' rings in a shared room; life: life size in a headset
// (only its panel moves); needs (optional): the oldest shell it works with, as a release number; intro (optional, the
// tutorial's): an introduction, not one of the stories, skipped by the default start, Repeat all and HOST.count(). The
// shell reads this file at start (index.html, as stories/list.js?v=<its fingerprint>, stamped by tools/release.mjs) and
// again while it runs (HOST.live); tools/release.mjs lists it in version.json.
self.STORY_LIST = [
];
// Pages that are not stories (the same fields): started by their key (#studio, HOST.go) and swapped and titled like a
// story, but not one of them (the Stories screens, Arrange all, the count, Repeat see only STORY_LIST; the station
// picker lists them after the stories, and the headset's menu has a Studio button). tools/release.mjs lists them in
// version.json too, so live updates reach them. The design room (#design, the props table) is parked since v217 (the
// owner, 26 November 2026): its sources stay in tools/design/ (README.md says how to bring it back: its entry here).
self.STORY_EXTRA = [
  { key: 'studio', kick: 'Studio', title: 'Your own scenes', col: '#e6d3b8', icon: 'studio.stage',
    desc: 'Your own models, textured and animated, placed life size in the room, with see-through trigger cubes that show and hide them as people walk about, and sounds placed where they belong.',
    page: 'The studio: your own scenes, placed in the room', brand: 'Studio', sub: 'your own scenes',
    aria: 'Interactive 3D studio for placing your own models, trigger cubes and sounds in a room', thing: 'scene', loading: 'Opening the studio', len: 'No story · your own scenes', life: true },
];
