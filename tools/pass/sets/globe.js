SETS.globe = function (K) { const set = K.newSet('globe'); return Object.assign(set, { params: { globe_a: 1 }, update() {}, anchors: {}, labels: [], cam: { default: [0, 10, 3.6, 0, 0, 0] } }); };
