'use strict';
// ================================================================== sound effects ==
// HOST.sfx: the shell's sound effects (the owner, 29 October 2026: "nice sound effects to everything"). Phase 1 is here:
// the shell's own sounds (the headset menu, pointing at the shell's things, the circles, the locks, notices, a story
// loaded, walking into a circle, people coming and going) and a quiet background per story. Phase 2 (sounds inside the
// stories, tied to their timelines) waits until the owner has listened to these and approved them. Every sound is made
// here from Web Audio nodes and short generated buffers: no files. The rules:
//  - it plays through HOST.audio's one AudioContext (HOST.audio.fx()), never a context of its own: nothing before the
//    first tap, nothing while the page or the headset is out of view, and nothing while only the <audio> element engine
//    runs (Web Audio out, or the element chosen in Sound check);
//  - in a headset a sound can come from a place in the room (an HRTF panner; the listener follows your head every frame
//    from shared.js's tick, HOST.sfx.listen); on a screen it is plain stereo;
//  - it ducks under the narration (-9 dB, down in about 0.4 s, back in about 1.5 s) while HOST.audio.speaking();
//  - at most 16 voices at once (the one quietest now makes room, the oldest of equals), and each sound a minimum gap;
//  - per device, never shared in a room and never in a story's collab.state(): on or off (sfxOn, OFF by default until
//    the owner approves the sounds) and a volume (sfxVolume, 0 to 1, squared as a loudness taper; 0.75 by default);
//    #sfx=on|off in a link; a row in Sound check on the page and in the headset's menu;
//  - a quiet looping background (a bed) for the story on show, chosen from its key: the flock dusk air and distant
//    birds, the pass story a deep sea hush, the robots room tone, the soil story wind over a field, every other a calm
//    low tone with a slight movement whose colour (pitch, brightness, pace) comes from the key, so a new story gets one
//    by itself. Faded in once the story is built, out when it goes (another story, the Stories screen, a headset in a
//    shared room away from every station), ducked under the voice, off with the effects.
// SFX_LIB holds the recipes, the beds and the engine for any context: tools/sfx.html (the sound board) plays them
// with an engine of its own and renders every one to a file with an OfflineAudioContext (tools/sfx-render.mjs).
(function (root) {
  const MAX = 16;                                  // voices at once
  const DUCK = Math.pow(10, -9 / 20);              // under the voice: -9 dB
  const DUCK_IN = 0.14, DUCK_OUT = 0.5;            // the duck's ramps (time constants, s): down quickly, back gently
  const BED_IN = 3, BED_OUT = 1.5;                 // a bed's fades (s)
  const LEAD = 0.03;                               // a sound starts this far ahead of the context's clock (s)
  const VOLS = [0.25, 0.5, 0.75, 1];               // the headset menu's volume steps
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // ---- seeded randomness: the same sound each time it is made with the same seed (renders do), a little different each play
  function rng(seed) { let s = (seed >>> 0) || 0x9e3779b9; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };

  // ---- generated buffers, made once per context
  const CACHE = new WeakMap();
  const cache = c => { let m = CACHE.get(c); if (!m) CACHE.set(c, (m = {})); return m; };
  // 6 s of white, pink or brown noise that loops without a seam (its first 60 ms fade from the tail's continuation)
  function noise(c, kind) {
    const m = cache(c), k = 'n:' + kind;
    if (m[k]) return m[k];
    const n = Math.round(c.sampleRate * 6), F = Math.round(c.sampleRate * 0.06), x = new Float32Array(n + F), r = rng(hash(kind));
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n + F; i++) {
      const w = r() * 2 - 1;
      if (kind === 'pink') {   // (Paul Kellet's filter)
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; x[i] = last * 3.5; }
      else x[i] = w;
    }
    const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = i < F ? x[i] * Math.sqrt(i / F) + x[n + i] * Math.sqrt(1 - i / F) : x[i];
    return (m[k] = b);
  }
  // 32 s of slow, smooth random values between -1 and 1 (a new one about every `step` s), looped without a seam: the
  // beds' gusts, swells and drifts, so they never repeat audibly
  function wander(c, seed, step) {
    const m = cache(c), k = 'w:' + seed + ':' + step;
    if (m[k]) return m[k];
    const sr = 8000, secs = 32, n = sr * secs, r = rng(seed), P = Math.max(2, Math.round(secs / step)), pts = [];
    for (let i = 0; i < P; i++) pts.push(r() * 2 - 1);
    pts.push(pts[0]);
    const b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const u = i / n * P, j = Math.floor(u), f = (1 - Math.cos((u - j) * Math.PI)) / 2;
      d[i] = pts[j] * (1 - f) + pts[j + 1] * f;
    }
    return (m[k] = b);
  }
  // a small room's reverberation (1.8 s, stereo, darker as it fades), for chimes and distant things
  function impulse(c) {
    const m = cache(c);
    if (m.ir) return m.ir;
    const sr = c.sampleRate, n = Math.round(sr * 1.8), pre = Math.round(sr * 0.012), b = c.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch), r = rng(77 + ch);
      let y = 0;
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / sr, a = 0.85 - 0.6 * Math.min(1, t / 1.2);
        y += a * ((r() * 2 - 1) - y);
        d[i] = y * Math.exp(-6.9 * t / 1.3);
      }
    }
    return (m.ir = b);
  }
  // the output's safety: exactly level below 0.6 of full scale, gently rounded above it (a pile of voices never clips)
  function softCurve() {
    const n = 4097, k = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, a = Math.abs(x); k[i] = a < 0.6 ? x : Math.sign(x) * (0.6 + 0.4 * Math.tanh((a - 0.6) / 0.4)); }
    return k;
  }

  // ---- the graph on a context: voices into fx (and their reverb send), the bed into bed; both through the volume, the
  // duck and the safety curve to the speakers (or to `dest`, for a render)
  function graph(c, dest) {
    const G = { c };
    G.out = c.createWaveShaper(); G.out.curve = softCurve(); G.out.connect(dest || c.destination);
    G.duck = c.createGain(); G.duck.connect(G.out);
    G.vol = c.createGain(); G.vol.connect(G.duck);
    G.fx = c.createGain(); G.fx.connect(G.vol);
    G.bed = c.createGain(); G.bed.connect(G.vol);
    G.verb = c.createConvolver(); G.verb.buffer = impulse(c);
    G.wet = c.createGain(); G.wet.gain.value = 0.6; G.verb.connect(G.wet); G.wet.connect(G.vol);
    return G;
  }

  // ---- building blocks for the recipes. x: { c, out (the voice's dry input), wet (its reverb send), t (its start),
  // srcs (every source, so a voice cut short stops them), r (its random numbers) }. Times are seconds after x.t.
  function track(x, s, at, dur, offset) { s.start(x.t + at, offset || 0); s.stop(x.t + at + dur); x.srcs.push(s); return s; }
  // a gain with a linear attack (a s) to peak, held (hold s), then an exponential fall to silence over d s
  function amp(x, peak, at, a, d, hold) {
    const g = x.c.createGain(), p = g.gain, t = x.t + at, h = hold || 0;
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a);
    if (h) p.setValueAtTime(peak, t + a + h);
    p.exponentialRampToValueAtTime(peak * 0.0005, t + a + h + d); p.linearRampToValueAtTime(0, t + a + h + d + 0.01);
    return g;
  }
  function send(x, g, k) { if (!k || !x.wet) return; const s = x.c.createGain(); s.gain.value = k; g.connect(s); s.connect(x.wet); }
  // a tone: { type, peak, a, d, hold, f1 (glided to over glide s), detune (cents), send, dest }
  function tone(x, f, at, o) {
    const c = x.c, s = c.createOscillator(), t = x.t + at, a = o.a || 0.004;
    s.type = o.type || 'sine';
    s.frequency.setValueAtTime(f, t);
    if (o.f1) s.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || a + o.d));
    if (o.detune) s.detune.value = o.detune;
    const g = amp(x, o.peak, at, a, o.d, o.hold);
    s.connect(g); g.connect(o.dest || x.out); send(x, g, o.send);
    track(x, s, at, a + (o.hold || 0) + o.d + 0.03);
    return g;
  }
  // filtered noise: { kind, type (filter), f, f1 (swept to over glide s), q, peak, a, d, hold, send, dest }
  function hiss(x, at, o) {
    const c = x.c, s = c.createBufferSource(), fl = c.createBiquadFilter(), t = x.t + at, a = o.a || 0.002;
    s.buffer = noise(c, o.kind || 'white'); s.loop = true;
    fl.type = o.type || 'bandpass'; fl.Q.value = o.q || 1;
    fl.frequency.setValueAtTime(o.f, t);
    if (o.f1) fl.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || a + (o.hold || 0) + o.d));
    const g = amp(x, o.peak, at, a, o.d, o.hold);
    s.connect(fl); fl.connect(g); g.connect(o.dest || x.out); send(x, g, o.send);
    track(x, s, at, a + (o.hold || 0) + o.d + 0.03, x.r() * 5);
    return g;
  }
  // a soft glass chime: a sine and three quiet partials above it that fade sooner
  function bell(x, f, at, peak, d, wet) {
    for (const [k, g, dk] of [[1, 1, 1], [2.001, 0.15, 0.5], [3.007, 0.06, 0.32], [4.23, 0.03, 0.2]]) tone(x, f * k, at, { peak: peak * g, a: 0.005, d: d * dk, send: wet });
  }
  // a short pitched blip that settles onto its note (the toggles)
  function blip(x, f, at, peak, d) {
    tone(x, f * 1.012, at, { peak, a: 0.002, d, f1: f, glide: 0.018 });
    tone(x, f * 2, at, { peak: peak * 0.12, a: 0.002, d: d * 0.4 });
  }
  // a soft mallet on wood (a sine with a quick, higher overtone): people coming and going
  function mallet(x, f, at, peak, d, wet) {
    tone(x, f, at, { peak, a: 0.003, d, send: wet });
    tone(x, f * 3.98, at, { peak: peak * 0.18, a: 0.001, d: d * 0.16 });
    hiss(x, at, { type: 'bandpass', f: f * 6, q: 1.2, peak: peak * 0.25, a: 0.0008, d: 0.012 });
  }
  // the touch of a button: a short noise tap with a little pitched body
  function tap(x, at, peak, f) {
    hiss(x, at, { type: 'bandpass', f: f * 2.1, q: 0.9, peak, a: 0.0008, d: 0.016 });
    tone(x, f, at, { peak: peak * 0.55, a: 0.001, d: 0.034, f1: f * 0.72, glide: 0.03 });
    tone(x, f * 0.32, at, { peak: peak * 0.3, a: 0.002, d: 0.028, type: 'triangle' });
  }
  // a soft thud with a falling pitch and a short wooden knock over it (things set down on the floor). Kept above about
  // 150 Hz: a headset's speakers give little below that
  function thud(x, at, peak, f0, f1, d) {
    tone(x, f0, at, { peak, a: 0.003, d, f1, glide: d * 0.6 });
    tone(x, f0 * 2.37, at, { peak: peak * 0.35, a: 0.002, d: d * 0.3, f1: f1 * 2.37, glide: d * 0.3, type: 'triangle' });
    hiss(x, at, { kind: 'pink', type: 'bandpass', f: 900, q: 0.8, peak: peak * 0.6, a: 0.001, d: 0.035 });
  }
  // air moving: noise through a band that sweeps from f0 to f1, swelling over its first 40 %
  function swish(x, at, dur, f0, f1, peak, wet) {
    hiss(x, at, { kind: 'pink', type: 'bandpass', f: f0, f1, glide: dur, q: 1.4, peak, a: dur * 0.4, d: dur * 0.6, send: wet });
  }

  // ---- the sounds. kind: 'ui' (interface), 'room' (the shared room); gap: the least time between two of them (ms);
  // level: how loud it is, roughly (the voice limit makes room by it); make(x) returns when it has ended (s, the context's)
  const N = { A5: 880, B5: 987.77, Cs6: 1108.73, E6: 1318.51, E5: 659.26, A4: 440, Fs5: 739.99 };
  const SOUNDS = {
    click: { kind: 'ui', gap: 35, level: 0.35, desc: 'A quiet click: a button on the page or in the headset\'s menu.',
      make(x) { const v = 1 + (x.r() - 0.5) * 0.05; tap(x, 0, 0.13, 1650 * v); return x.t + 0.09; } },
    toggleOn: { kind: 'ui', gap: 35, level: 0.45, desc: 'A switch turned on: a tap and two blips going up.',
      make(x) { tap(x, 0, 0.055, 1500); blip(x, N.B5, 0.004, 0.06, 0.12); blip(x, N.E6, 0.06, 0.07, 0.16); return x.t + 0.3; } },
    toggleOff: { kind: 'ui', gap: 35, level: 0.4, desc: 'A switch turned off: a tap and two blips going down.',
      make(x) { tap(x, 0, 0.05, 1350); blip(x, N.E6, 0.004, 0.055, 0.1); blip(x, N.B5, 0.06, 0.06, 0.15); return x.t + 0.28; } },
    hover: { kind: 'ui', gap: 70, level: 0.15, desc: 'Pointing at something of the shell\'s (a menu button, the clock, a circle): a soft high tick.',
      make(x) { const v = 1 + (x.r() - 0.5) * 0.06; tone(x, 2700 * v, 0, { peak: 0.028, a: 0.0012, d: 0.022 }); hiss(x, 0, { type: 'highpass', f: 5200, q: 0.7, peak: 0.022, a: 0.0005, d: 0.007 }); return x.t + 0.05; } },
    open: { kind: 'ui', gap: 120, level: 0.6, desc: 'The menu opens from the clock: air rising and two notes going up.',
      make(x) { swish(x, 0, 0.24, 520, 2600, 0.06, 0.1); bell(x, N.A5, 0.07, 0.055, 0.45, 0.12); bell(x, N.E6, 0.14, 0.05, 0.55, 0.15); return x.t + 0.85; } },
    close: { kind: 'ui', gap: 120, level: 0.5, desc: 'The menu closes: air falling and two notes going down.',
      make(x) { swish(x, 0, 0.22, 2400, 560, 0.05, 0.08); bell(x, N.E6, 0.02, 0.045, 0.35, 0.1); bell(x, N.A5, 0.09, 0.045, 0.45, 0.12); return x.t + 0.7; } },
    lock: { kind: 'ui', gap: 120, level: 0.55, desc: 'Locked (the circles, or a story): a crisp two-part latch closing.',
      make(x) {
        hiss(x, 0, { type: 'highpass', f: 2600, q: 0.8, peak: 0.12, a: 0.0006, d: 0.012 });
        tone(x, 2350, 0, { peak: 0.03, a: 0.001, d: 0.04 });
        hiss(x, 0.032, { type: 'bandpass', f: 1800, q: 1.1, peak: 0.13, a: 0.0006, d: 0.016 });
        tone(x, 430, 0.032, { peak: 0.09, a: 0.002, d: 0.06, f1: 270, glide: 0.05, type: 'triangle' });
        return x.t + 0.16;
      } },
    unlock: { kind: 'ui', gap: 120, level: 0.45, desc: 'Unlocked: a lighter latch opening and a small note going up.',
      make(x) {
        hiss(x, 0, { type: 'bandpass', f: 2200, q: 1, peak: 0.17, a: 0.0006, d: 0.014 });
        tone(x, 300, 0, { peak: 0.075, a: 0.002, d: 0.05, f1: 430, glide: 0.04, type: 'triangle' });
        tone(x, 1900, 0.03, { peak: 0.05, a: 0.003, d: 0.08, f1: 2600, glide: 0.05 });
        hiss(x, 0.055, { type: 'highpass', f: 4200, q: 0.8, peak: 0.11, a: 0.0006, d: 0.01 });
        return x.t + 0.2;
      } },
    notice: { kind: 'ui', gap: 600, level: 0.8, desc: 'A notice in front of you: a soft two-note chime.',
      make(x) { bell(x, N.Cs6, 0, 0.06, 0.9, 0.22); bell(x, N.A5, 0.15, 0.06, 1.1, 0.25); return x.t + 1.4; } },
    ready: { kind: 'ui', gap: 1500, level: 0.85, desc: 'A story has loaded: three soft notes going up.',
      make(x) {
        bell(x, N.A5, 0, 0.047, 1.1, 0.28); bell(x, N.Cs6, 0.1, 0.043, 1.2, 0.3); bell(x, N.E6, 0.2, 0.043, 1.4, 0.32);
        tone(x, N.A4, 0, { peak: 0.026, a: 0.06, d: 1.3, send: 0.2 });
        return x.t + 1.8;
      } },
    enter: { kind: 'room', gap: 1500, level: 0.9, desc: 'Walking into a circle: a gentle swell, opening and fading.',
      make(x) {
        const c = x.c, t = x.t, lp = c.createBiquadFilter();
        lp.type = 'lowpass'; lp.Q.value = 0.7;
        lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(2300, t + 0.95); lp.frequency.exponentialRampToValueAtTime(650, t + 2.6);
        const g = amp(x, 0.05, 0, 0.9, 1.6, 0.25);
        lp.connect(g); g.connect(x.out); send(x, g, 0.35);
        for (const [f, k] of [[220, 0.55], [329.63, 0.38], [440, 0.3], [554.37, 0.17], [659.26, 0.1]]) for (const d of [-5, 5]) {
          const s = c.createOscillator(), sg = c.createGain();
          s.type = 'triangle'; s.frequency.value = f; s.detune.value = d; sg.gain.value = k;
          s.connect(sg); sg.connect(lp); track(x, s, 0, 2.85);
        }
        return t + 2.9;
      } },
    grab: { kind: 'room', gap: 150, level: 0.55, desc: 'A circle picked up: air rising and a soft lift.',
      make(x) { swish(x, 0, 0.2, 320, 1700, 0.09); tone(x, 210, 0.02, { peak: 0.1, a: 0.02, d: 0.16, f1: 340, glide: 0.12 }); tone(x, 420, 0.02, { peak: 0.03, a: 0.02, d: 0.12, f1: 680, glide: 0.12 }); tap(x, 0, 0.04, 900); return x.t + 0.3; } },
    drop: { kind: 'room', gap: 150, level: 0.6, desc: 'A circle let go: air falling and a soft landing.',
      make(x) { swish(x, 0, 0.18, 1500, 320, 0.08); thud(x, 0.12, 0.15, 210, 105, 0.2); return x.t + 0.45; } },
    place: { kind: 'room', gap: 30, level: 0.6, desc: 'A circle placed (Arrange all, Add here, Move here, the room map): a soft wooden thunk.',
      make(x) { thud(x, 0, 0.17, 175, 88, 0.24); tone(x, 520, 0, { peak: 0.035, a: 0.002, d: 0.05, f1: 450, glide: 0.04, type: 'triangle', send: 0.12 }); return x.t + 0.38; } },
    join: { kind: 'room', gap: 400, level: 0.5, desc: 'Someone joins the room: two soft wooden notes going up, from where they stand.',
      make(x) { mallet(x, N.E5, 0, 0.09, 0.32, 0.18); mallet(x, N.A5, 0.11, 0.1, 0.4, 0.2); return x.t + 0.7; } },
    leave: { kind: 'room', gap: 400, level: 0.45, desc: 'Someone leaves: the same two notes going down, softer.',
      make(x) { mallet(x, N.A5, 0, 0.075, 0.26, 0.15); mallet(x, N.E5, 0.12, 0.08, 0.36, 0.18); return x.t + 0.65; } },
    // (the sound board's 3D demo: a bright little shake that is easy to place)
    circle: { kind: 'demo', gap: 0, level: 0.4, desc: 'The 3D demo\'s sound: a small bright shake, easy to place by ear.',
      make(x) { hiss(x, 0, { type: 'bandpass', f: 3200, q: 0.6, peak: 0.3, a: 0.004, d: 0.05 }); tone(x, 1250, 0, { peak: 0.08, a: 0.002, d: 0.05 }); return x.t + 0.1; } },
  };
  // the order the sound board and the samples list them in
  const ORDER = ['click', 'toggleOn', 'toggleOff', 'hover', 'open', 'close', 'lock', 'unlock', 'notice', 'ready', 'enter', 'grab', 'drop', 'place', 'join', 'leave'];

  // one sound: its recipe into a dry gain (through an HRTF panner at a place in a headset, or a stereo panner on a
  // screen) and a reverb send. o: { gain, at: [x, y, z], spatial, pan (-1 left .. 1 right), seed }
  function voice(G, name, t, o) {
    const R = SOUNDS[name], c = G.c, k = o.gain == null ? 1 : o.gain;
    const g = c.createGain(), w = c.createGain();
    g.gain.value = k; w.gain.value = k;
    let p = null;
    if (o.at && o.spatial && c.createPanner) {
      p = c.createPanner();
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1; p.rolloffFactor = 0.8; p.maxDistance = 100;
      if (p.positionX) { p.positionX.value = o.at[0]; p.positionY.value = o.at[1]; p.positionZ.value = o.at[2]; } else p.setPosition(o.at[0], o.at[1], o.at[2]);
    } else if (o.pan && c.createStereoPanner) { p = c.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); }
    if (p) { g.connect(p); p.connect(G.fx); } else g.connect(G.fx);
    w.connect(G.verb);
    const x = { c, out: g, wet: w, t, srcs: [], r: rng(o.seed == null ? hash(name) : o.seed) };
    const end = R.make(x);
    return { name, g, w, p, srcs: x.srcs, t0: t, end, level: (R.level || 0.5) * k, spatial: !!(p && p.panningModel) };
  }

  // ---- the beds: loops that run until faded out. b: { c, out (the bed's gain), wet (its reverb send), r, next }. level:
  // each made about -35 LUFS at full effects volume (measured: tools/sfx-render.mjs), some 20 dB under the narration
  const BEDS = {
    calm: { desc: 'A calm low tone with a slight movement (every story without a bed of its own; its pitch, brightness and pace come from the story\'s key).', level: 0.076 },
    dusk: { desc: 'The flock: dusk air, swaying, and distant birds now and then.', level: 1.66 },
    sea: { desc: 'Pass it on (the fish): a deep sea hush that swells slowly, and a bubble now and then.', level: 0.172 },
    room: { desc: 'The robot gang: soft room tone with a slow movement of air.', level: 0.79 },
    wind: { desc: 'The soil story: wind over a field, gusting, and grass rustling when it blows.', level: 1 },
  };
  const bedOf = key => ({ flock: 'dusk', pass: 'sea', robots: 'room', soil: 'wind' }[key] || 'calm');
  // the calm bed's colour from the story's key: its root note, how bright, how fast it moves
  function colour(key) {
    const h = hash(key || 'calm'), roots = [98, 110, 123.47, 130.81, 146.83, 87.31, 103.83, 116.54];
    return { f0: roots[h % roots.length], bright: 520 + ((h >>> 5) % 5) * 150, move: 0.03 + ((h >>> 9) % 4) * 0.012 };
  }
  function loop(b, kind, pan) {
    const c = b.c, s = c.createBufferSource();
    s.buffer = noise(c, kind); s.loop = true;
    b.srcs.push(s); s.start(b.t, b.r() * 5);
    if (!pan || !c.createStereoPanner) return s;
    const p = c.createStereoPanner(); p.pan.value = pan; s.connect(p);
    return p;
  }
  function filter(c, type, f, q) { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q == null ? 0.7 : q; return n; }
  function gain(c, v) { const g = c.createGain(); g.gain.value = v; return g; }
  // a steady sine (or other) wave moving a parameter up and down by depth
  function lfo(b, rate, depth, param, type) {
    const c = b.c, s = c.createOscillator(), g = gain(c, depth);
    s.type = type || 'sine'; s.frequency.value = rate; s.connect(g); g.connect(param);
    b.srcs.push(s); s.start(b.t);
    return s;
  }
  // a slow random drift of a parameter by depth (the same seed: the same drift, so gusts can move several things at once)
  function drift(b, seed, step, depth, param) {
    const c = b.c, s = c.createBufferSource(), g = gain(c, depth);
    s.buffer = wander(c, seed, step); s.loop = true; s.connect(g); g.connect(param);
    b.srcs.push(s); s.start(b.t, b.r() * 20);
    return s;
  }
  function osc(b, type, f, detune) {
    const c = b.c, s = c.createOscillator();
    s.type = type; s.frequency.value = f; if (detune) s.detune.value = detune;
    b.srcs.push(s); s.start(b.t);
    return s;
  }
  // one-off sounds a bed schedules ahead of time (birds, bubbles): not tracked, they stop by themselves
  function chirp(b, t, f, dur, peak, pan) {
    const c = b.c, s = c.createOscillator(), v = c.createOscillator(), vg = gain(c, f * (0.02 + b.r() * 0.05)), g = c.createGain(), r = b.r;
    s.frequency.setValueAtTime(f, t); s.frequency.linearRampToValueAtTime(f * (1.08 + r() * 0.3), t + dur * 0.45); s.frequency.linearRampToValueAtTime(f * (0.82 + r() * 0.25), t + dur);
    v.frequency.value = 28 + r() * 40; v.connect(vg); vg.connect(s.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.008); g.gain.exponentialRampToValueAtTime(peak * 0.001, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.01);
    const lp = filter(c, 'lowpass', 5200, 0.5);
    s.connect(g); g.connect(lp);
    let o = lp;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; lp.connect(p); o = p; }
    o.connect(b.out); const w = gain(c, 1.6); o.connect(w); w.connect(b.wet);   // (distant: more of the room than of the bird)
    s.start(t); v.start(t); s.stop(t + dur + 0.02); v.stop(t + dur + 0.02);
  }
  function bubble(b, t, f, peak, pan) {
    const c = b.c, s = c.createOscillator(), g = c.createGain(), d = 0.05 + b.r() * 0.04;
    s.frequency.setValueAtTime(f, t); s.frequency.exponentialRampToValueAtTime(f * (1.8 + b.r() * 0.8), t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(peak * 0.001, t + d + 0.03); g.gain.linearRampToValueAtTime(0, t + d + 0.04);
    const lp = filter(c, 'lowpass', 2400, 0.5);
    s.connect(g); g.connect(lp);
    let o = lp;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; lp.connect(p); o = p; }
    o.connect(b.out); const w = gain(c, 0.6); o.connect(w); w.connect(b.wet);
    s.start(t); s.stop(t + d + 0.05);
  }
  const MAKE = {
    calm(b) {
      const c = b.c, { f0, bright, move } = colour(b.key), lp = filter(c, 'lowpass', bright * 1.4, 0.6), a = gain(c, 0.85);
      lp.connect(a); a.connect(b.out);
      lfo(b, move, bright * 0.3, lp.frequency); lfo(b, move * 1.618, 0.16, a.gain);
      for (const [f, k, type, pan] of [[f0, 0.34, 'sine', -0.1], [f0 * 2 + 0.13, 0.3, 'triangle', 0.35], [f0 * 3 - 0.07, 0.16, 'sine', -0.35], [f0 * 4 + 0.05, 0.08, 'sine', 0.2], [f0 * 5 - 0.04, 0.035, 'sine', -0.2]]) {
        const s = osc(b, type, f), g = gain(c, k);
        s.connect(g);
        if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(lp); } else g.connect(lp);
      }
      const air = loop(b, 'pink', 0.3), bp = filter(c, 'bandpass', 1500, 0.5), ag = gain(c, 0.03);
      air.connect(bp); bp.connect(ag); ag.connect(b.out); drift(b, 11, 3, 0.018, ag.gain);
    },
    dusk(b) {
      const c = b.c;
      for (const [pan, seed] of [[-0.7, 21], [0.7, 22]]) {
        const n = loop(b, 'pink', pan), hp = filter(c, 'highpass', 110), lp = filter(c, 'lowpass', 1300), g = gain(c, 0.07);
        n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(b.out);
        drift(b, seed, 4, 0.028, g.gain); drift(b, seed + 10, 5, 380, lp.frequency);
      }
      const hi = loop(b, 'white'), bp = filter(c, 'bandpass', 5200, 0.5), hg = gain(c, 0.0035);
      hi.connect(bp); bp.connect(hg); hg.connect(b.out);
      b.next = b.t + 1 + b.r() * 2;
      b.fill = until => {   // a phrase of two to five chirps from somewhere far off, every two to seven seconds
        while (b.next < until) {
          const pan = (b.r() * 2 - 1) * 0.9, n = 2 + Math.floor(b.r() * 4), f = 2600 + b.r() * 2000, peak = 0.01 + b.r() * 0.014;
          let t = b.next;
          for (let i = 0; i < n; i++) { const d = 0.05 + b.r() * 0.08; chirp(b, t, f * (0.9 + b.r() * 0.25), d, peak * (0.7 + b.r() * 0.3), pan); t += d + 0.04 + b.r() * 0.12; }
          b.next += 2 + b.r() * 5;
        }
      };
    },
    sea(b) {
      const c = b.c;
      for (const [pan, seed] of [[-0.6, 31], [0.6, 32]]) {
        const n = loop(b, 'brown', pan), hp = filter(c, 'highpass', 140, 0.6), lp = filter(c, 'lowpass', 560, 0.5), g = gain(c, 0.5);
        n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(b.out);
        lfo(b, 0.07 + (seed - 31) * 0.013, 200, lp.frequency); drift(b, seed, 6, 120, lp.frequency);
        lfo(b, 0.09 + (seed - 31) * 0.011, 0.07, g.gain);
      }
      const sh = loop(b, 'pink'), bp = filter(c, 'bandpass', 900, 0.7), sg = gain(c, 0.02);
      sh.connect(bp); bp.connect(sg); sg.connect(b.out); drift(b, 33, 4, 0.014, sg.gain);
      b.next = b.t + 1.5 + b.r() * 2;
      b.fill = until => {   // a bubble or a little run of them, every one to four seconds
        while (b.next < until) {
          const pan = (b.r() * 2 - 1) * 0.8, n = 1 + Math.floor(b.r() * 3);
          let t = b.next;
          for (let i = 0; i < n; i++) { bubble(b, t, 280 + b.r() * 420, 0.006 + b.r() * 0.01, pan); t += 0.06 + b.r() * 0.12; }
          b.next += 1 + b.r() * 3;
        }
      };
    },
    room(b) {
      const c = b.c;
      for (const [pan, seed] of [[-0.5, 41], [0.5, 42]]) {
        const n = loop(b, 'pink', pan), lp = filter(c, 'lowpass', 1300), hp = filter(c, 'highpass', 150), g = gain(c, 0.06);
        n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(b.out);
        drift(b, seed, 7, 0.008, g.gain); drift(b, seed + 5, 9, 160, lp.frequency);
      }
      const lo = loop(b, 'brown'), lh = filter(c, 'highpass', 120), ll = filter(c, 'lowpass', 320), lg = gain(c, 0.1);
      lo.connect(lh); lh.connect(ll); ll.connect(lg); lg.connect(b.out);
    },
    wind(b) {
      const c = b.c, gust = 51;   // (one gust drift moves the band, the strength and the rustle together)
      for (const [pan, off] of [[-0.6, 0], [0.6, 1]]) {
        const n = loop(b, 'white', pan), bp = filter(c, 'bandpass', 520 + off * 90, 0.9), g = gain(c, 0.06);
        n.connect(bp); bp.connect(g); g.connect(b.out);
        drift(b, gust + off, 2.6, 300, bp.frequency); drift(b, gust + off, 2.6, 0.04, g.gain);
      }
      const ru = loop(b, 'white', 0.2), hp = filter(c, 'highpass', 2600), bp2 = filter(c, 'bandpass', 5600, 0.4), rg = gain(c, 0.012);
      ru.connect(hp); hp.connect(bp2); bp2.connect(rg); rg.connect(b.out);
      drift(b, gust, 2.6, 0.009, rg.gain); lfo(b, 3.1, 0.004, rg.gain);
      const lo = loop(b, 'brown'), lh = filter(c, 'highpass', 90), ll = filter(c, 'lowpass', 240), lg = gain(c, 0.05);
      lo.connect(lh); lh.connect(ll); ll.connect(lg); lg.connect(b.out); drift(b, gust + 7, 3.3, 0.025, lg.gain);
    },
  };
  // a bed for a story's key, starting at t (silent until faded in)
  function bed(G, key, t, seed) {
    const c = G.c, kind = bedOf(key), out = gain(c, 0), lv = gain(c, BEDS[kind].level), wet = gain(c, 1);
    out.connect(lv); lv.connect(G.bed); wet.connect(G.verb);
    const b = { c, key, kind, out, lv, wet, t, srcs: [], r: rng(seed == null ? hash(key) : seed), next: Infinity, fill: () => {} };
    MAKE[kind](b);
    return b;
  }
  function bedIn(b, t, secs) { const p = b.out.gain; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(1, t + secs); }
  function bedOut(b, t, secs) {
    const p = b.out.gain;
    p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(0, t + secs);
    for (const s of b.srcs) { try { s.stop(t + secs + 0.05); } catch (e) { /* stopped */ } }
    b.gone = t + secs + 0.1;
  }

  // ---- the engine. A: { fx() (the context to play through now, or null), speaking() (the narration sounds now),
  // bed() (the story key whose bed should play, '' none), spatial() (in a headset: sounds come from places), get(k),
  // put(k, v) (this device's settings; null keeps them in memory) }
  function engine(A) {
    const S = { on: false, vol: 0.75, c: null, G: null, voices: [], gone: [], last: {}, played: 0, cut: 0, lastAt: 0, lastName: '', lastSpatial: false,
      speak: false, bed: null, bedKey: '', old: [], head: null, n: 0, an: null, buf: null };
    const get = k => { try { return A.get ? A.get(k) : null; } catch (e) { return null; } };
    const put = (k, v) => { try { if (A.put) A.put(k, v); } catch (e) { /* storage blocked */ } };
    S.on = get('sfxOn') === 'on';
    { const v = parseFloat(get('sfxVolume')); if (isFinite(v)) S.vol = clamp(v, 0, 1); }
    const taper = v => v * v;
    // the context to play through, the graph built on it (again when HOST.audio started a new one); null while off or silent
    function ctx() {
      let c = null;
      try { c = A.fx(); } catch (e) { c = null; }
      if (!S.on || !c) return null;
      if (c !== S.c) build(c);
      return c;
    }
    function build(c) {
      S.voices = []; S.gone = []; S.bed = null; S.bedKey = ''; S.old = []; S.an = null; S.speak = false;
      S.c = c; S.G = graph(c);
      S.G.vol.gain.value = taper(S.vol);
      listener();
    }
    const now = () => performance.now();
    function prune(c) {
      const t = c.currentTime;
      for (let i = S.voices.length - 1; i >= 0; i--) if (S.voices[i].end + 0.1 < t) { off(S.voices[i]); S.voices.splice(i, 1); }
      for (let i = S.gone.length - 1; i >= 0; i--) if (S.gone[i].end + 0.1 < t) { off(S.gone[i]); S.gone.splice(i, 1); }
      for (let i = S.old.length - 1; i >= 0; i--) if (S.old[i].gone < t) { try { S.old[i].out.disconnect(); S.old[i].wet.disconnect(); } catch (e) { /* gone */ } S.old.splice(i, 1); }
    }
    function off(v) { try { v.g.disconnect(); v.w.disconnect(); if (v.p) v.p.disconnect(); } catch (e) { /* gone */ } }
    // make room: the voice quietest now (its level times what is left of it), the oldest of equals, fades in 25 ms
    function quietest(t) {
      let best = null, bs = Infinity;
      for (const v of S.voices) { const s = v.level * clamp((v.end - t) / Math.max(0.01, v.end - v.t0), 0, 1); if (s < bs - 1e-9) { bs = s; best = v; } }
      return best;
    }
    function cut(v, t) {
      for (const p of [v.g.gain, v.w.gain]) { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(0, t + 0.025); }
      for (const s of v.srcs) { try { s.stop(t + 0.03); } catch (e) { /* stopped */ } }
      v.end = t + 0.03; S.voices.splice(S.voices.indexOf(v), 1); S.gone.push(v); S.cut++;
    }
    // play a sound now. o: { at: [x, y, z] (where, in the headset's reference space; used in a headset), pan (on a screen,
    // -1 .. 1), gain, delay (s), force (no minimum gap: the sound board's and the tests' bursts) }. The voice, or null
    function play(name, o) {
      o = o || {};
      const R = SOUNDS[name], c = R && ctx();
      if (!c) return null;
      const t0 = now();
      if (!o.force && t0 - (S.last[name] || -1e9) < (R.gap || 0)) return null;
      S.last[name] = t0;
      const t = c.currentTime;
      prune(c);
      while (S.voices.length >= MAX) cut(quietest(t), t);
      let sp = false;
      try { sp = !!(o.at && A.spatial()); } catch (e) { /* no headset */ }
      const v = voice(S.G, name, t + LEAD + Math.max(0, +o.delay || 0), { gain: o.gain, at: o.at, spatial: sp, pan: o.pan, seed: hash(name) + (++S.n) });
      S.voices.push(v); S.played++; S.lastAt = t0; S.lastName = name; S.lastSpatial = v.spatial;
      return v;
    }
    // every 100 ms (and at once on a change): the bed wanted now, the duck, the voices that have ended
    function step() {
      const c = ctx();
      let want = '';
      if (c) { try { want = A.bed() || ''; } catch (e) { want = ''; } }
      if (S.bed && (want !== S.bedKey || !c)) {
        bedOut(S.bed, S.bed.c.currentTime, c ? BED_OUT : 0.3); S.old.push(S.bed); S.bed = null; S.bedKey = '';
      }
      if (!c) { if (S.c && S.c.state !== 'closed') prune(S.c); return; }
      if (want && !S.bed) {
        S.bed = bed(S.G, want, c.currentTime + LEAD, hash(want) + (++S.n)); S.bedKey = want;
        bedIn(S.bed, c.currentTime + LEAD, BED_IN);
      }
      if (S.bed) S.bed.fill(c.currentTime + 1.5);
      let sp = false;
      try { sp = !!A.speaking(); } catch (e) { sp = false; }
      if (sp !== S.speak) {
        S.speak = sp;
        const p = S.G.duck.gain, t = c.currentTime;
        p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.setTargetAtTime(sp ? DUCK : 1, t, sp ? DUCK_IN : DUCK_OUT);
      }
      prune(c);
    }
    // the listener at your head (a headset's frame; the reference space's coordinates), or back at the origin
    function listener() {
      const c = S.c;
      if (!c || !c.listener) return;
      const L = c.listener, h = S.head || { p: [0, 0, 0], f: [0, 0, -1], u: [0, 1, 0] };
      try {
        if (L.positionX) {
          L.positionX.value = h.p[0]; L.positionY.value = h.p[1]; L.positionZ.value = h.p[2];
          L.forwardX.value = h.f[0]; L.forwardY.value = h.f[1]; L.forwardZ.value = h.f[2];
          L.upX.value = h.u[0]; L.upY.value = h.u[1]; L.upZ.value = h.u[2];
        } else { L.setPosition(h.p[0], h.p[1], h.p[2]); L.setOrientation(h.f[0], h.f[1], h.f[2], h.u[0], h.u[1], h.u[2]); }
      } catch (e) { /* an old engine: the listener stays */ }
    }
    // p: { x, y, z }, q: { x, y, z, w } (the head), or null (no headset: the listener goes back to the origin)
    function listen(p, q) {
      if (!p || !q) { if (S.head) { S.head = null; listener(); } return; }
      const rot = (vx, vy, vz) => {   // v rotated by q
        const ix = q.w * vx + q.y * vz - q.z * vy, iy = q.w * vy + q.z * vx - q.x * vz, iz = q.w * vz + q.x * vy - q.y * vx, iw = -q.x * vx - q.y * vy - q.z * vz;
        return [ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x];
      };
      S.head = { p: [p.x, p.y, p.z], f: rot(0, 0, -1), u: rot(0, 1, 0) };
      listener();
    }
    function set(on) {
      on = !!on;
      if (on === S.on) return;
      S.on = on; put('sfxOn', on ? 'on' : 'off');
      if (!on && S.c && S.c.state !== 'closed') { const t = S.c.currentTime; while (S.voices.length) cut(S.voices[0], t); }
      step();
    }
    function setVolume(v) {
      v = clamp(+v || 0, 0, 1);
      S.vol = v; put('sfxVolume', String(Math.round(v * 100) / 100));
      if (S.G) { const p = S.G.vol.gain, t = S.c.currentTime; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.setTargetAtTime(taper(v), t, 0.04); }
    }
    // the headset menu's volume button: the next step up, after the loudest the quietest
    const nextVolume = () => VOLS.find(v => v > S.vol + 0.01) || VOLS[0];
    // the output's loudest sample in the last 20 ms (0 .. 1): for tests and the sound board's meter
    function level() {
      if (!S.G || !S.c || S.c.state === 'closed') return 0;
      if (!S.an) { S.an = S.c.createAnalyser(); S.an.fftSize = 1024; S.G.out.connect(S.an); S.buf = new Float32Array(S.an.fftSize); }
      S.an.getFloatTimeDomainData(S.buf);
      let m = 0;
      for (const v of S.buf) m = Math.max(m, Math.abs(v));
      return m;
    }
    // a taste of every interface and room sound, one after another (Sound check's Try them)
    function demo() {
      ['click', 'toggleOn', 'toggleOff', 'hover', 'open', 'close', 'lock', 'unlock', 'notice', 'grab', 'drop', 'place', 'join', 'leave', 'enter', 'ready']
        .forEach((n, i) => play(n, { delay: i * 0.75, force: true }));
    }
    const pct = () => Math.round(S.vol * 100) + ' %';
    return {
      play, step, listen, set, setVolume, nextVolume, level, demo,
      on: () => S.on, volume: () => S.vol, count: () => S.played, context: () => S.c,
      sig: () => (S.on ? 'F' : 'f') + Math.round(S.vol * 100),
      // the line in Sound check (page and headset)
      line: () => 'Sound effects: ' + (S.on ? 'on, volume ' + pct() + (S.c && S.G && S.c === (A.fx() || null) ? ', ' + S.voices.length + ' playing' +
        (S.bedKey ? ', background ' + bedOf(S.bedKey) + ' (' + S.bedKey + ')' : '') + (S.speak ? ', ducked under the voice' : '') : ', silent (Web Audio not running here yet)') : 'off (volume ' + pct() + ')'),
      state: () => ({ on: S.on, volume: S.vol, voices: S.voices.length, played: S.played, cut: S.cut, last: S.lastName, spatial: S.lastSpatial, bed: S.bedKey,
        bedKind: S.bedKey ? bedOf(S.bedKey) : '', speak: S.speak, duck: S.G ? S.G.duck.gain.value : 1, ctx: S.c ? S.c.state : '', head: S.head }),
    };
  }

  // ---- renders (the sound board and tools/sfx-render.mjs): each into an OfflineAudioContext through the same graph
  const SR = 44100;
  function offline(secs, ch) { const C = root.OfflineAudioContext || root.webkitOfflineAudioContext; return new C(ch || 2, Math.ceil(secs * SR), SR); }
  function renderSound(name, o) {
    o = o || {};
    const R = SOUNDS[name], probe = offline(0.1), x0 = { c: probe, out: probe.createGain(), wet: null, t: 0, srcs: [], r: rng(1) };
    const len = R.make(x0) + 0.6;   // (its length, from a dry run; the reverb's tail after it)
    const c = offline(len, 2), G = graph(c);
    voice(G, name, 0.02, { seed: o.seed == null ? hash(name) : o.seed });
    return c.startRendering();
  }
  function renderBed(key, secs) {
    const c = offline(secs, 2), G = graph(c), b = bed(G, key, 0);
    b.fill(secs);
    const p = b.out.gain; p.setValueAtTime(0, 0); p.linearRampToValueAtTime(1, 1.5); p.setValueAtTime(1, secs - 1.5); p.linearRampToValueAtTime(0, secs);
    return c.startRendering();
  }
  // the 3D demo: the small shake circling your head twice (ear height, 1.5 m away, a step every quarter second), HRTF
  function render3d(secs) {
    const c = offline(secs, 2), G = graph(c);
    for (let i = 0, t = 0.2; t < secs - 0.4; i++, t += 0.25) {
      const a = i * Math.PI / 6;
      voice(G, 'circle', t, { at: [1.5 * Math.sin(a), 0, -1.5 * Math.cos(a)], spatial: true, seed: 900 + i });
    }
    return c.startRendering();
  }
  // the duck: a calm bed and a few clicks, with the narration (a decoded AudioBuffer, from `from` s for `len` s) speaking
  // in the middle; the duck moves exactly as the engine moves it
  function renderDuck(voiceBuf, from, len) {
    const secs = len + 7.5, c = offline(secs, 2), G = graph(c), b = bed(G, 'airports', 0);
    b.out.gain.setValueAtTime(0, 0); b.out.gain.linearRampToValueAtTime(1, 1.2);
    for (const s of b.srcs) s.stop(secs);
    const on = 3, offT = 3 + len, p = G.duck.gain;
    p.setValueAtTime(1, 0); p.setTargetAtTime(DUCK, on, DUCK_IN); p.setTargetAtTime(1, offT, DUCK_OUT);
    if (voiceBuf) {
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = voiceBuf; s.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0, on); g.gain.linearRampToValueAtTime(1, on + 0.03); g.gain.setValueAtTime(1, offT - 0.05); g.gain.linearRampToValueAtTime(0, offT);
      s.start(on, from, len); s.stop(offT + 0.05);
    }
    for (const [t, n] of [[1.5, 'click'], [on + 1.2, 'click'], [on + 2.4, 'toggleOn'], [offT + 2.5, 'click'], [offT + 3.4, 'toggleOn']]) voice(G, n, t, { seed: hash(n) + t * 10 });
    b.out.gain.setValueAtTime(1, secs - 1.2); b.out.gain.linearRampToValueAtTime(0, secs);
    return c.startRendering();
  }

  const LIB = { SOUNDS, ORDER, BEDS, MAX, DUCK, DUCK_IN, DUCK_OUT, BED_IN, BED_OUT, VOLS, bedOf, colour, graph, voice, bed, bedIn, bedOut, engine,
    renderSound, renderBed, render3d, renderDuck, hash };
  root.SFX_LIB = LIB;

  // ---- in the app: HOST.sfx, on HOST.audio's context
  // (HOST is the page's top-level const: a global name, not a property of window)
  const H = typeof HOST !== 'undefined' ? HOST : null;
  if (!H || !H.audio || typeof document === 'undefined') return;
  const quiet = fn => { const q = H.quiet; H.quiet = true; try { return fn(); } finally { H.quiet = q; } };
  const E = engine({
    fx: () => (H.audio.fx ? H.audio.fx() : null),
    speaking: () => !!(H.audio.speaking && H.audio.speaking()),
    spatial: () => !!H.session,
    // the story on show, once built (its frame loop given), not behind a Stories screen (page or headset), nor in a shared
    // room while the headset is away from every station (the story hidden)
    bed: () => (H.cur && H.curKey && !H.busy && H.loading && H.loading.ran && !H.picking && !H.onStories && !(H.room && H.room.away && H.room.away()) ? H.curKey : ''),
    get: k => localStorage.getItem(k), put: (k, v) => localStorage.setItem(k, v),
  });
  H.sfx = Object.assign(E, {
    // a story has loaded (HOST.loading: its frame loop given): a soft chime, unless it loaded behind the Stories screen
    // (asked after this task: a card's click closes the Stories screen just after the story starts); its bed follows
    ready() { setTimeout(() => { if (!H.picking) E.play('ready'); E.step(); }, 0); },
  });
  // the shell's own timer, never a story's (a story change removes only a story's listeners)
  setInterval(E.step, 100);
  // page buttons: a quiet click (a switch with aria-pressed: on or off), unless the press made a sound of its own (a lock,
  // the effects turned on); after the button's own handlers, so the switch's new state is known. Stereo by where it is.
  quiet(() => window.addEventListener('click', ev => {
    if (!E.on()) return;
    const b = ev.target && ev.target.closest ? ev.target.closest('button, [role="button"], summary') : null;
    if (!b || b.disabled || b.closest('[data-sfx="none"]')) return;
    const n = E.count(), r = b.getBoundingClientRect(), pan = innerWidth > 0 ? clamp(((r.left + r.width / 2) / innerWidth) * 2 - 1, -1, 1) * 0.35 : 0;
    setTimeout(() => {
      if (E.count() !== n || !b.isConnected) return;
      const p = b.getAttribute('aria-pressed');
      E.play(p === 'true' ? 'toggleOn' : p === 'false' ? 'toggleOff' : 'click', { pan });
    }, 0);
  }));
})(typeof self !== 'undefined' ? self : this);
