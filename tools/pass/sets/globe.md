# `globe` - the airports' globe, and an outbreak on its routes (sets/globe.js)

The airports story's globe, exactly as it is: built by that story's own `buildScene` from its own data and shaders, cut
out of `stories/airports.js` by `build.mjs` (`PASS_AIRPORTS`, see SPEC.md). Radius 1, centred on the origin, y up,
longitude 0 towards +x, 90 E towards -z (`NET.P`). 3,214 airports, 18,858 routes (OpenFlights; the numbers come from
`api.n()` and `api.routes()`).

- **What the original draws** (its land texture, airports as dots, pillars, all routes as one line set, the atmosphere,
  its highlight tubes) is driven through its own uniforms (`GL.U`, `GL.RU`), as its `applyUniforms` and
  `updateLight` do; here from params. The set's fade is appended to every one of its shaders (the globe turns
  see-through to fade). Its light and dot sizes are set just before the set is drawn, for each eye (a probe's
  `onBeforeRender`): on a screen the light comes from over the camera's left shoulder and dots follow the camera's
  distance; in a headset the light stays in the room (the rig: `set.group.parent.parent`) and dots keep their size on the
  globe (`0.0028 * K.U.uPx * group scale`, the original's `XR.pointK`). The engine must set `K.renderer` before building
  the sets (the original sizes its land texture by the GPU).
- **The outbreak**: a seeded, discrete-time S/E/I/R model on the route network. Day by day each infectious city passes
  it over each route to a susceptible neighbour with a daily chance (spread low 0.025, medium 0.06, high 0.14) times the
  share of flights kept; one draw per city and day for all its infectious neighbours together (1 - (1 - p)^n), from a
  hash of the seed, the city and the day, so the same start and settings give the same outbreak on every device. A city
  reached is exposed for its incubation time, then infectious, then recovered (each city's times 0.7 to 1.3 times the
  settings, rounded, from the same hash). It also notes where each city got it from (the infectious neighbour with the
  highest hash), for the way it travelled. Computed in full when the start or a setting changes (a few ms); drawing is
  then a pure function of the day. From Vienna, medium spread, incubation 5 days, infectious 7, all flights:
  7 cities by day 5, 47 by day 10, 229 by 15, 676 by 20, 1,673 by 30 (slowly, then everywhere at once), 2,090 of 3,214
  in all, the last on day 92; with 30 % of the flights it never reaches half the cities (more in `test-sets.mjs`).
- **Drawn**: exposed cities amber, infectious red (a flash as they turn, then a slow pulse), recovered grey and
  smaller, over the original's dots (susceptible cities show the original's own); the infection travelling over the
  route it took (an arc from the city it came from, during the day before it arrives, with a bright head; a faint
  trace stays a few days); the way it took to a selected city as the original's stepped highlight tube, growing hop by
  hop as the days pass.

## Params

| param | default | meaning |
| --- | --- | --- |
| `globe_a` | 1 | fade (engine) |
| `globe_reveal` | 1 | the airports and routes appear (the original's `node_reveal` and `route_reveal`) |
| `globe_routes` | 1 | brightness of the routes (the original's `route_alpha`) |
| `globe_hubs` | 0 | airports coloured by their number of routes (the original's `w_deg`) |
| `globe_pillars` | 0 | pillars by number of routes (the original's `deg_h`) |
| `globe_dim` | 0 | dims the plain airports and routes, so the outbreak's colours stand out |
| `globe_out` | 0 | the outbreak shown (its cities, arcs, chain and labels) |
| `globe_day` | 0 | the outbreak's day (continuous; ease it) |

Suggested story keys (chapter 4, after `api.setup({ start: 'VIE' })`): `globe_reveal` 0 -> 1 as the globe comes in,
`globe_pillars` 0 -> 1 -> 0 for "through the hubs" (optional), then `globe_out` and `globe_dim` 0 -> 1 and `globe_day`
0 -> 40 over 30-35 s (smooth: the slow start shows), the camera from the `start` view out to `default` or `world`.

## API (`set.api`)

`setup({ start, inc, inf, spread, kept, seed })` (any subset; runs the model when something changed; inc 1-21 days,
inf 1-30, spread 'low' | 'medium' | 'high', kept 0-1; returns `summary()`), `start(i | 'IATA')`, `settings()`,
`end()` (the last day anything happens), `series()` (`{ S, E, I, R }`: cities in each state for days 0 ... end),
`count(day)`, `summary()` (`{ start, end, reached, peak }`), `arrivalDay(i)` (the day it was reached, or null),
`chain(i)` (the cities it passed through from the start), `select(i)` / `selected()` (a ring on the city, its label and
its chain; -1 for none), `pick(raycaster)` (the airport nearest a world-space ray, on the near side, within 1.5 degrees;
-1 for none), `find('IATA')`, `search(q, n)` (the airports story's search: code, city, name, country; also a city's German name), `info(i)` (code, city (in German for about 35 well-known cities: Wien, München, Peking ...), country, name, routes, lat, lon, exposed, infectious, recovered,
from), `pos(i, up)` (a point on the city, `up` above the surface; for labels), `viewOf(lat, lon, dist)` (a view facing
that point), `deg(i)`, `n()`, `routes()`, `original` (the cut-out story: `NET`, `GL`, `bestPath`, `km`, `STATS` ...).

## Anchors, labels, views, controls

Anchors `top` (north of the start city, a little off the globe: the day counter, above the city in a view facing it), `start`, `sel`, and 13 hubs by IATA code (VIE,
LHR, FRA, CDG, IST, DXB, JFK, ATL, PEK, SIN, JNB, GRU, SYD). Labels (in the set's language): **Day 37** "1,673 of 3,214
cities reached" (red outline is not available: amber), **Vienna** "it starts here" (days 0-10), the selected city
"reached on day 12" / "not yet" / "never reached" (cyan). Views: `default` (Europe, Africa and Asia), `europe`,
`atlantic`, `asia`, `world` (from afar), `start` (turned to the start city by `setup`). Controls (Scenes tab, getter):
View, Colour (Plain, Hubs), Pillars (Off, Routes per airport), Outbreak (Off, Play: four days a second from the
current start, round again).

## Science

Must say it is a simple model on the real route network, not a forecast: every route counts the same (the data has no
passenger numbers), airports stand for cities, no real disease's numbers. May say: an outbreak that reaches a hub
reaches the world within days; cutting flights slows it and makes it smaller but rarely stops it; the infection takes
the network's short paths (the airports story's small world). Data: OpenFlights (as the airports story credits it).
