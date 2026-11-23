// The stories, in the order of the Stories screen (on the page and in the headset) and of Arrange all (pages that are not
// stories, such as the design room, are in STORY_EXTRA at the end). The shell reads
// this file at start (index.html: HOST.list) and again while it runs (HOST.live: a story added in a release gets its
// card without a reload); tools/release.mjs lists it in version.json. Each entry: key (the file stories/<key>.js), kick,
// title, col and desc (its card), page, brand and sub (the tab's and the top bar's title), aria, thing and loading (the
// canvas, the AR button, the loading line), len (the length on its card); icon: its miniature in lowpoly.js (a key of
// LOWPOLY_MODELS: the one that says the story best), drawn over its stations' rings in a shared room; life: life size in
// a headset (only its panel moves); needs (optional): the oldest shell it works with, as a release number
// (tools/release.mjs otherwise takes the shell it was released with, see version.json); intro (optional, the tutorial):
// an introduction, not one of the stories, which the shell skips in three places (index.html): the default start (with
// no #key the first entry without intro is built behind the Stories screen), Repeat all (passes it by) and HOST.count()
// ("sixteen stories" counts only the entries without it). The tutorial is the last card since v180 (the owner, 20
// November 2026: "Move the tutorial to the last story card"; first from v173).
self.STORY_LIST = [
  { key: 'airports', kick: 'Network theory', title: 'Airports', col: '#46d9ff', icon: 'airports.globe',
    desc: '3,214 airports and 18,858 routes. Hubs, communities, shortest paths and what happens when airports close.',
    page: "Network theory, told with the world's airports", brand: 'Network theory', sub: "told with the world's airports",
    aria: 'Interactive globe of the world airline network', thing: 'globe', loading: 'Plotting 3,214 airports and 18,858 routes', len: 'Story 3:51 · globe' },
  { key: 'proteins', kick: 'Network medicine', title: 'Proteins', col: '#ff5fd2', icon: 'proteins.cell',
    desc: '254 proteins inside a human cell. Essential hubs, disease modules, drug targets and knockouts.',
    page: 'Network medicine, told with the proteins in a cell', brand: 'Network medicine', sub: 'told with the proteins in a cell',
    aria: 'Interactive 3D cell of protein interactions', thing: 'cell', loading: 'Placing 254 proteins and 375 interactions', len: 'Story 5:48 · cell' },
  { key: 'spatial', kick: 'Spatial interactome', title: 'Cell map', col: '#3ee08f', icon: 'spatial.cell',
    desc: '249 proteins in the compartments of a model cell. Proteins that move, signals that cross the cell, proteins in the wrong place.',
    page: 'Spatial interactome, where proteins meet in a cell', brand: 'Spatial interactome', sub: 'where proteins meet in a cell',
    aria: 'Interactive 3D model of a human cell and its protein network', thing: 'cell', loading: 'Building the cell', len: 'Story 5:41 · cell model' }
];
// Pages that are not stories (the same fields): started by their key (#design, HOST.go) and swapped and titled like a
// story, but not one of them (the Stories screens, Arrange all, the count, Repeat see only STORY_LIST; the station
// picker lists them after the stories, and the headset's menu has a Design room button). tools/release.mjs lists them
// in version.json too, so live updates reach them.
self.STORY_EXTRA = [
  { key: 'design', kick: 'Design room', title: 'The props table', col: '#f0d58c', icon: 'design.table',
    desc: 'Every prop of the stories as a small model on one table, by story. Pick one up, or put it on the stage to see what it is made of: its params, its views and its source.',
    page: 'The design room: every prop of the stories on one table', brand: 'Design room', sub: 'the props table',
    aria: 'Interactive 3D table with small models of every 3D set of the stories', thing: 'table', loading: 'Laying the table', len: 'No story · a table to explore', life: true },
  { key: 'studio', kick: 'Studio', title: 'Your own scenes', col: '#e6d3b8', icon: 'studio.stage',
    desc: 'Your own models, textured and animated, placed life size in the room, with see-through trigger cubes that show and hide them as people walk about, and sounds placed where they belong.',
    page: 'The studio: your own scenes, placed in the room', brand: 'Studio', sub: 'your own scenes',
    aria: 'Interactive 3D studio for placing your own models, trigger cubes and sounds in a room', thing: 'scene', loading: 'Opening the studio', len: 'No story · your own scenes', life: true },
];
