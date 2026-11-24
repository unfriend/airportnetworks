// The studio tour's sounds: short mono 16-bit WAV files at 11,025 Hz, synthesised here from sine tones with envelopes and
// seeded noise (our own; no samples, no music of anyone else). Deterministic: the same bytes every run.
// makeSounds() -> [{ path, bytes }]
const RATE = 11025;   // (every partial here is under 4 kHz: half the bytes of 22,050 Hz, nothing lost)
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
function wav(f32) {
  const n = f32.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, f32[i])) * 32767), 44 + i * 2);
  return b;
}
const buf = s => new Float32Array(Math.round(s * RATE));
const hz = m => 440 * Math.pow(2, (m - 69) / 12);   // (a MIDI note's frequency)
// a bell-like note: a few partials, each dying away, added at t seconds into out
function bell(out, t, f, len, amp, o = {}) {
  const P = o.partials || [[1, 1, 1], [2.01, 0.35, 1.8], [3.02, 0.15, 2.6], [4.1, 0.06, 3.5]], i0 = Math.round(t * RATE), n = Math.round(len * RATE);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const s = i / RATE, att = Math.min(1, s / 0.004);
    let v = 0;
    for (const [k, a, d] of P) v += a * Math.sin(2 * Math.PI * f * k * s) * Math.exp(-s * d * (o.decay || 3));
    out[i0 + i] += amp * att * v;
  }
}
// a looping sound's ends joined: its last 20 ms faded into its first
function seam(out) { const n = Math.round(0.02 * RATE); for (let i = 0; i < n; i++) { const k = i / n; out[i] = out[i] * k + out[out.length - n + i] * (1 - k); } return out.subarray(0, out.length - n); }
const norm = (out, peak) => { let m = 0; for (const v of out) m = Math.max(m, Math.abs(v)); const k = m ? peak / m : 1; for (let i = 0; i < out.length; i++) out[i] *= k; return out; };

const SOUNDS = {
  // a soft bell (the trigger cube that starts things, the button that is pressed)
  'sounds/bell.wav': () => { const o = buf(1.1); bell(o, 0, hz(81), 1.1, 1, { decay: 2.4 }); return norm(o, 0.5); },
  // a music box tune of eight notes, 2 s, looping (the sounds stand: started while you stand on its pad)
  'sounds/music-box.wav': () => { const o = buf(2.02); [76, 79, 83, 81, 79, 76, 74, 79].forEach((m, i) => bell(o, i * 0.25, hz(m), 0.6, 0.6, { decay: 4 })); return norm(seam(o), 0.4); },
  // a bee's buzz, 0.5 s, looping (it follows the bee)
  'sounds/buzz.wav': () => { const o = buf(0.52), r = rng(7); for (let i = 0; i < o.length; i++) { const s = i / RATE, f = 190 + 6 * Math.sin(2 * Math.PI * 4 * s); let v = 0; for (let k = 1; k < 9; k++) v += Math.sin(2 * Math.PI * f * k * s) / k; o[i] = v * 0.5 + (r() - 0.5) * 0.08; } return norm(seam(o), 0.3); },
  // a pop (the ball dropped in the basket)
  'sounds/pop.wav': () => { const o = buf(0.25); for (let i = 0; i < o.length; i++) { const s = i / RATE; o[i] = Math.sin(2 * Math.PI * (900 - 2400 * s) * s) * Math.exp(-s * 22); } return norm(o, 0.5); },
  // three notes for the sequence: do, mi, so
  'sounds/note-c.wav': () => { const o = buf(0.5); bell(o, 0, hz(72), 0.5, 1, { decay: 4 }); return norm(o, 0.45); },
  'sounds/note-e.wav': () => { const o = buf(0.5); bell(o, 0, hz(76), 0.5, 1, { decay: 4 }); return norm(o, 0.45); },
  'sounds/note-g.wav': () => { const o = buf(0.5); bell(o, 0, hz(79), 0.5, 1, { decay: 4 }); return norm(o, 0.45); },
  // two little tunes for the screen's playlist, 1.9 s each (plucked notes over a soft bass)
  'sounds/tune-1.wav': () => { const o = buf(1.9); [[0, 60], [0.3, 64], [0.6, 67], [0.9, 72], [1.2, 67], [1.5, 64], [1.5, 60]].forEach(([t, m]) => bell(o, t, hz(m), 0.7, 0.6, { decay: 5 })); [[0, 48], [1.0, 43]].forEach(([t, m]) => bell(o, t, hz(m), 1.2, 0.4, { decay: 1.5, partials: [[1, 1, 1], [2, 0.2, 2]] })); return norm(o, 0.45); },
  'sounds/tune-2.wav': () => { const o = buf(1.9); [[0, 69], [0.25, 72], [0.5, 76], [0.75, 74], [1.0, 72], [1.25, 69], [1.5, 71], [1.5, 64]].forEach(([t, m]) => bell(o, t, hz(m), 0.6, 0.6, { decay: 5 })); [[0, 45], [1.0, 40]].forEach(([t, m]) => bell(o, t, hz(m), 1.4, 0.4, { decay: 1.5, partials: [[1, 1, 1], [2, 0.2, 2]] })); return norm(o, 0.45); },
  // the shuttle's start as you sit in it: a rising whoosh of filtered noise, 1.4 s
  'sounds/whoosh.wav': () => { const o = buf(1.4), r = rng(11); let lp = 0; for (let i = 0; i < o.length; i++) { const s = i / RATE, k = 0.02 + 0.25 * (s / 1.4); lp += (r() * 2 - 1 - lp) * k; o[i] = lp * Math.sin(Math.PI * s / 1.4) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * s)); } return norm(o, 0.4); },
};
export const SOUND_FILES = Object.keys(SOUNDS);
export function makeSounds() { return Object.entries(SOUNDS).map(([path, f]) => ({ path, bytes: wav(f()) })); }
