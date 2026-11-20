# Six handshakes (the example story package)

A story of about a minute and a half, then an explore mode: 60 people stand in a ring, each knowing the two people on
either side. Rewiring a few of the friendships at random (keeping one end, moving the other to anyone on the ring)
makes everyone close: the average number of handshakes between two people falls from 7.9 to about 5 with five
shortcuts, while the ring still looks local (friends of friends still know each other). Rewire everything and it
becomes a random tangle: close, but no longer local. That is the small-world network of Duncan Watts and Steven
Strogatz:

> D. J. Watts and S. H. Strogatz, Collective dynamics of 'small-world' networks. Nature 393, 440 to 442 (1998).

- Made by: the app's authors, as the example for `tools/packages/template` (hidden: open it with `#hello`, or from the
  Stories screen in developer mode).
- Data: none. The network is an example, made from a seeded random draw (`src/sets/net.js`, `HELLO`), and every
  number the story and explore mode show is computed from it as the page runs ("in this example"). Nothing to ask
  permission for.
- Narration: none (captions only). To add one, put `audio/narration.mp3` here, write its timing into
  `NARRATION_SYNC` in `src/engine/e3_story.js`, build, and run `node tools/packages/scan.mjs`.

## Building it

`src/` is a copy of `tools/packages/template` with its own sets (`net.js`, the network and its numbers; `ring.js`, the
people, the links and the counter; `path.js`, the chain from A to B) and story (`src/engine/e3_story.js`) and explore
pane (`e4_explore.js`, its twin for the headset in `e6_panels.js`).

```
node packages/hello/src/build.mjs            # writes packages/hello/main.js
node tools/packages/scan.mjs                 # the index
node tools/packages/check.mjs packages/hello --load
```

The network's numbers can be checked in Node: `node -e "const H = require('./packages/hello/src/sets/net.js');
console.log(H.stats(0), H.stats(0.05))"`.

Its address: `#hello`, `#hello&t=60` (a moment of the story), `#hello&explore&rw=0.1&a=1&b=31` (explore mode, a tenth of
the links rewired, people 1 and 31 picked; `view=top` or `low`).
