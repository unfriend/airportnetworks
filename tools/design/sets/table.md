# table (the design room)

The props table: a round table, life size (1 unit = 1 m, floor y = 0, top 0.86 m, radius 1.15 m), a plate per story
round its rim with a place card, the stories' miniatures (from `lowpoly.js`) on the plates, and a stage in the middle
for the picked prop (40 cm, turning). See `../SPEC.md` for the layout and the records of moved miniatures.

| Param | Range | Meaning |
| --- | --- | --- |
| `table_a` | 0..1 | the set's fade (the intro fades it in) |
| `table_floor` | 0..1 | the floor and its rings (0 in passthrough) |

Views `[az, el, dist, tx, ty, tz]`: `default` (the whole table from the front), `stage` (the stage close), `above`;
`groupView(story)` gives a story's plate close up from outside the table.

API (besides the set contract): `layout(groups)`, `feed(models)`, `buildSome(ms)`, `built()`, `total()`, `keys()`,
`pickables()`, `setHover(k)`, `hovered()`, `setPick(k)`, `picked()`, `stageModel()`, `mini(k)`, `recOf(k)`,
`setRec(k, rec)`, `carryTo(k, p, q, s)`, `drop(k)`, `tidy()`, `okRec(a)`, `moved()`, `groupView(story)`, `plateOf(story)`,
`solid` (what the pointer's dot lands on), `drawCards()` (the place cards again, once the fonts are in).
