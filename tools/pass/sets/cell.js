SETS.cell = function (K) { const set = K.newSet('cell'); return Object.assign(set, { params: { cell_a: 1 }, update() {}, anchors: {}, labels: [], cam: { default: [0, 10, 3.6, 0, 0, 0] } }); };
