// The Bliss XP room's sounds, synthesised here (never a recording, never the real system's sounds or tunes): mono 16-bit
// WAV at 22,050 Hz, short, seeded so the same bytes come out every time. Each is placed in layout.json as an emitter at
// its object, so it comes from there.
const SR = 22050;
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const TAU = Math.PI * 2;
const note = n => 440 * 2 ** ((n - 69) / 12);   // (a MIDI note's frequency)

// ---- building blocks: a buffer of seconds, things added into it at a time
const buf = s => new Float32Array(Math.round(s * SR));
function add(out, at, src, gain = 1) { const o = Math.round(at * SR); for (let i = 0; i < src.length && o + i < out.length; i++) if (o + i >= 0) out[o + i] += src[i] * gain; return out; }
// a bell: sine partials, each dying away (a struck glass or a chime)
function bell(f, dur, o = {}) {
  const b = buf(dur), P = o.partials || [[1, 1, 1], [2.76, 0.45, 2.2], [5.4, 0.22, 3.6], [8.93, 0.09, 5.5]];
  for (const [r, a, d] of P) { const fr = f * r; if (fr > SR * 0.45) continue; for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] += a * Math.sin(TAU * fr * t) * Math.exp(-t * (o.decay || 3) * d) * Math.min(1, t / 0.003); } }
  return b;
}
// a soft pad voice: a few harmonics, slowly in and out, a little detuned against itself
function pad(f, dur, att, rel, o = {}) {
  const b = buf(dur);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR, env = Math.min(1, t / att) * Math.min(1, Math.max(0, (dur - t) / rel)), det = 1 + (o.det || 0.003) * Math.sin(TAU * 0.3 * t);
    b[i] = env * (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * det * t + 1) + 0.25 * Math.sin(TAU * 2 * f * t) + 0.12 * Math.sin(TAU * 3 * f * det * t));
  }
  return b;
}
// a plucked tone: a triangle-ish wave dying away
function pluck(f, dur, o = {}) {
  const b = buf(dur);
  for (let i = 0; i < b.length; i++) { const t = i / SR, ph = (f * t) % 1, tri = 1 - 4 * Math.abs(ph - 0.5); b[i] = (0.7 * tri + 0.3 * Math.sin(TAU * f * t)) * Math.exp(-t * (o.decay || 9)) * Math.min(1, t / 0.002); }
  return b;
}
// RBJ biquads over a buffer, in place
function biquad(b, type, f, q = 0.707) {
  const w = TAU * f / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; } else { b0 = al; b1 = 0; b2 = -al; }
  a0 = 1 + al; a1 = -2 * c; a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < b.length; i++) { const x = b[i], y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; b[i] = y; }
  return b;
}
const noise = (s, R) => { const b = buf(s); for (let i = 0; i < b.length; i++) b[i] = R() * 2 - 1; return b; };
// a small room's reverb (Schroeder: four combs, two all-passes), mixed in
function reverb(b, mix = 0.25, len = 1) {
  const out = new Float32Array(b.length), combs = [[1557, 0.84], [1617, 0.83], [1491, 0.85], [1422, 0.86]].map(([d, g]) => [Math.round(d * SR / 44100 * len), g]);
  for (const [d, g] of combs) { const z = new Float32Array(d); let k = 0; for (let i = 0; i < b.length; i++) { const y = z[k]; z[k] = b[i] + y * g; out[i] += y * 0.25; k = (k + 1) % d; } }
  for (const d0 of [225, 556]) { const d = Math.round(d0 * SR / 44100), z = new Float32Array(d); let k = 0; for (let i = 0; i < out.length; i++) { const y = z[k], x = out[i]; z[k] = x + y * 0.5; out[i] = y - x * 0.5; k = (k + 1) % d; } }
  for (let i = 0; i < b.length; i++) b[i] = b[i] * (1 - mix) + out[i] * mix;
  return b;
}
const fade = (b, a, r) => { const A = Math.round(a * SR), Rr = Math.round(r * SR); for (let i = 0; i < A && i < b.length; i++) b[i] *= i / A; for (let i = 0; i < Rr && i < b.length; i++) b[b.length - 1 - i] *= i / Rr; return b; };
const norm = (b, peak) => { let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); const k = m ? peak / m : 0; for (let i = 0; i < b.length; i++) b[i] *= k; return b; };
// a loop made seamless: the last `x` seconds laid over the start, fading across
function seamless(b, x) { const X = Math.round(x * SR), n = b.length - X, out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = b[i]; for (let i = 0; i < X; i++) { const k = i / X; out[i] = b[i] * k + b[n + i] * (1 - k); } return out; }
function wav(b) {
  const data = Buffer.alloc(b.length * 2);
  for (let i = 0; i < b.length; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(b[i] * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii'); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8, 'ascii'); h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36, 'ascii'); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// ---- the sounds
const SOUNDS = {
  // the startup swell: a warm chord breathing in, a rising sparkle of bells over it (our own: a plain broken chord)
  startup() {
    const b = buf(4.4), R = rng(1);
    for (const n of [48, 55, 60, 64, 67, 74]) add(b, 0, pad(note(n), 4.2, 1.1, 1.8), n < 55 ? 0.22 : 0.14);
    const sw = biquad(noise(1.4, R), 'bp', 1800, 0.8); fade(sw, 1.1, 0.25); add(b, 0, sw, 0.12);
    [79, 84, 88, 91, 96].forEach((n, i) => add(b, 0.85 + i * 0.16, bell(note(n), 2.2, { decay: 2.2 }), 0.18 - i * 0.015));
    return norm(fade(reverb(b, 0.3, 1.2), 0.01, 0.6), 0.7);
  },
  // the shutdown: the chord settling down, bells falling
  shutdown() {
    const b = buf(3.2);
    for (const n of [43, 50, 55, 59, 62]) add(b, 0, pad(note(n), 3.0, 0.3, 1.6), 0.16);
    [91, 86, 83, 79].forEach((n, i) => add(b, 0.15 + i * 0.2, bell(note(n), 2, { decay: 2.6 }), 0.16));
    return norm(fade(reverb(b, 0.3, 1.2), 0.01, 0.8), 0.7);
  },
  // a ding: one struck bell
  ding() { const b = buf(1.3); add(b, 0, bell(note(81), 1.3, { decay: 2.4 })); add(b, 0, bell(note(93), 0.6, { decay: 5 }), 0.15); return norm(fade(reverb(b, 0.2), 0.002, 0.2), 0.7); },
  // critical stop: two hard chords, low and close together
  critical() {
    const b = buf(1.0);
    for (const [at, ns] of [[0, [45, 52, 57, 60]], [0.16, [44, 51, 56, 59]]]) for (const n of ns) {
      const t = buf(0.8), f = note(n); for (let i = 0; i < t.length; i++) { const s = i / SR; let v = 0; for (let k = 1; k <= 7; k += 2) v += Math.sin(TAU * f * k * s) / k; t[i] = v * Math.exp(-s * 5) * Math.min(1, s / 0.004); }
      add(b, at, biquad(t, 'lp', 2400), 0.25);
    }
    return norm(fade(reverb(b, 0.15), 0.002, 0.25), 0.7);
  },
  // a balloon's pop-in: a quick bright bloop
  pop() { const b = buf(0.35); for (let i = 0; i < b.length; i++) { const t = i / SR, f = 380 + 900 * (1 - Math.exp(-t * 30)); b[i] = Math.sin(TAU * f * t) * Math.exp(-t * 16) * Math.min(1, t / 0.002); } add(b, 0.06, bell(note(88), 0.25, { decay: 9 }), 0.25); return norm(fade(b, 0.001, 0.05), 0.65); },
  // a new message: two bell notes up
  chime() { const b = buf(1.2); add(b, 0, bell(note(79), 1.0, { decay: 3 })); add(b, 0.17, bell(note(86), 1.0, { decay: 3 })); return norm(fade(reverb(b, 0.2), 0.002, 0.2), 0.65); },
  // a nudge: a rattling buzz that shakes
  nudge() {
    const b = buf(0.8), R = rng(4);
    for (let i = 0; i < b.length; i++) { const t = i / SR, sq = Math.sign(Math.sin(TAU * 96 * t)) * 0.5 + Math.sin(TAU * 192 * t) * 0.3; b[i] = (sq + (R() - 0.5) * 0.4) * (0.55 + 0.45 * Math.sin(TAU * 17 * t)) * Math.exp(-t * 2.5); }
    return norm(fade(biquad(b, 'lp', 1500), 0.005, 0.12), 0.6);
  },
  // hardware: two notes up as it comes, two down as it goes
  hwin() { const b = buf(0.7); add(b, 0, pluck(note(76), 0.5)); add(b, 0.14, pluck(note(83), 0.55)); return norm(fade(reverb(b, 0.15), 0.001, 0.1), 0.6); },
  hwout() { const b = buf(0.7); add(b, 0, pluck(note(83), 0.5)); add(b, 0.14, pluck(note(76), 0.55)); return norm(fade(reverb(b, 0.15), 0.001, 0.1), 0.6); },
  // a click
  click() { const R = rng(7), b = biquad(noise(0.06, R), 'hp', 2500); for (let i = 0; i < b.length; i++) b[i] *= Math.exp(-i / SR * 120); add(b, 0, bell(2100, 0.03, { decay: 60, partials: [[1, 1, 1]] }), 0.4); return norm(b, 0.55); },
  // paper crumpled into the bin: many small crackles
  crumple() {
    const R = rng(9), b = buf(1.0);
    for (let k = 0; k < 70; k++) { const at = 0.02 + R() * 0.75 * (k < 50 ? 1 : 1.2), d = 0.004 + R() * 0.025, g = biquad(noise(d, R), 'bp', 1500 + R() * 4000, 1.2); for (let i = 0; i < g.length; i++) g[i] *= Math.sin(Math.PI * i / g.length); add(b, at, g, 0.3 + R() * 0.7); }
    return norm(fade(b, 0.005, 0.15), 0.6);
  },
  // typing on a keyboard (a loop): keys at an uneven pace, now and then the space bar
  typing() {
    const R = rng(12), L = 3.0, b = buf(L + 0.2);
    for (let t = 0.05; t < L; t += 0.07 + R() * 0.16) {
      const big = R() < 0.12, key = biquad(noise(big ? 0.03 : 0.018, R), 'hp', big ? 900 : 2200); for (let i = 0; i < key.length; i++) key[i] *= Math.exp(-i / SR * (big ? 120 : 220));
      add(b, t, key, big ? 0.7 : 0.45 + R() * 0.3); add(b, t, bell(big ? 140 : 190, 0.03, { decay: 80, partials: [[1, 1, 1]] }), 0.35);
    }
    return norm(seamless(b, 0.2), 0.55);
  },
  // cards flipping (a loop): a quick even riffle
  flips() {
    const R = rng(15), L = 2.0, b = buf(L + 0.15);
    for (let t = 0.02; t < L; t += 0.06 + R() * 0.03) { const d = 0.035, g = noise(d, R); for (let i = 0; i < g.length; i++) { const k = i / g.length; g[i] *= Math.sin(Math.PI * k) ** 2; } biquad(g, 'bp', 2200 + R() * 1500, 1.5); add(b, t, g, 0.5 + R() * 0.4); }
    return norm(seamless(b, 0.15), 0.55);
  },
  // outdoors (a loop): wind breathing in the grass and a few birds far off
  outdoor() {
    const R = rng(21), L = 6.0, X = 1.0, b = buf(L + X);
    const wind = noise(L + X, R); biquad(wind, 'lp', 420); biquad(wind, 'lp', 600);
    for (let i = 0; i < wind.length; i++) { const t = i / SR; wind[i] *= 0.55 + 0.3 * Math.sin(TAU * t / (L + X)) + 0.15 * Math.sin(TAU * t * 3 / (L + X) + 1); }
    add(b, 0, wind, 1.6);
    const chirp = (at, f0, n, gain) => { for (let k = 0; k < n; k++) { const d = 0.06 + R() * 0.05, c = buf(d), f1 = f0 * (1.15 + R() * 0.3); for (let i = 0; i < c.length; i++) { const t = i / SR, q = t / d, f = f0 + (f1 - f0) * Math.sin(Math.PI * q); c[i] = Math.sin(TAU * f * t + 3 * Math.sin(TAU * 38 * t)) * Math.sin(Math.PI * q); } add(b, at + k * (d + 0.03 + R() * 0.04), c, gain); } };
    for (const [at, f, n] of [[0.6, 3200, 3], [1.9, 4100, 2], [3.1, 2800, 4], [4.4, 3600, 2], [5.3, 4500, 3]]) chirp(at, f, n, 0.07 + R() * 0.05);
    return norm(seamless(b, X), 0.4);
  },
};
export const SOUND_FILES = { startup: 'sounds/startup.wav', shutdown: 'sounds/shutdown.wav', ding: 'sounds/ding.wav', critical: 'sounds/critical-stop.wav', pop: 'sounds/balloon-pop.wav',
  chime: 'sounds/new-message.wav', nudge: 'sounds/nudge.wav', hwin: 'sounds/hardware-in.wav', hwout: 'sounds/hardware-out.wav', click: 'sounds/click.wav', crumple: 'sounds/recycle.wav',
  typing: 'sounds/typing.wav', flips: 'sounds/solitaire-flips.wav', outdoor: 'sounds/outdoors.wav' };
export function makeSounds() { return Object.entries(SOUND_FILES).map(([k, path]) => ({ path, bytes: wav(SOUNDS[k]()) })); }
