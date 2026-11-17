// OSC for the output page (relay/server.mjs --osc-out, --osc-in; tools/output/SPEC.md, Wire 3 and Wire 4). The output page
// (output.js, a computer in the room) hands its OSC messages to the relay over its room socket as JSON ({ t: 'osc', m });
// the relay makes each one an OSC 1.0 datagram and sends it on UDP to every target its command line names; datagrams that
// come in on --osc-in go back to the output pages as the fx '@osc'. Node 18 or newer, no packages. Also imported by
// relay/test.mjs (encode, decode, checkMsg, parseTarget, parseIn).
//
// A message, both ways: [address, types, ...args]. Out (Wire 3): address /^\/[!-~]{0,255}$/, types /^[ifsTFN]{0,32}$/ (no
// comma), one arg per i (an int32), f (a finite number, within float32) or s (at most 256 characters), none for T, F, N.
// In: the same, with what came normalised: i (i, and h within a safe integer), f (f, d, and other h), s (s, S, c), T, F,
// N, I (no arg); a bundle's messages flattened (nested bundles to depth 4, timetags ignored); any other type, or a bad
// layout, and the whole packet is refused (null).
import dgram from 'node:dgram';
import dns from 'node:dns';
import net from 'node:net';

export const OSC_RATE = 2000;            // messages a second from one member (the rest dropped and counted)
export const OSC_IN_RATE = 500;          // @osc a second to one member
export const OSC_MAX_FRAME = 64 << 10;   // one { t: 'osc' } frame
export const OSC_MAX_MSGS = 128;         // messages in it
export const OSC_MAX_TARGETS = 8;
const ADDR = /^\/[!-~]{0,255}$/, TYPES = /^[ifsTFN]{0,32}$/;
const IN_ADDR = /^\/[!-~]{0,1023}$/;     // (an incoming address: printable, no spaces; the page matches it against its own)
const MAX_STR = 256, MAX_DEPTH = 4, MAX_IN_MSGS = 1024, F32 = 3.4028234663852886e38;
const RELOOK = 10000;                    // a target's name looked up again after a send error, at most this often

// ---- a message from the page: true when it can be sent as it is
export function checkMsg(msg) {
  if (!Array.isArray(msg) || typeof msg[0] !== 'string' || typeof msg[1] !== 'string' || !ADDR.test(msg[0]) || !TYPES.test(msg[1])) return false;
  const types = msg[1];
  let a = 2;
  for (const t of types) {
    if (t === 'T' || t === 'F' || t === 'N') continue;
    const v = msg[a++];
    if (t === 'i' && !(Number.isInteger(v) && v >= -2147483648 && v <= 2147483647)) return false;
    if (t === 'f' && !(typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= F32)) return false;
    if (t === 's' && !(typeof v === 'string' && v.length <= MAX_STR && !v.includes('\0'))) return false;
  }
  return a === msg.length;   // (no arg left over)
}

// ---- encoding (OSC 1.0: strings NUL-terminated and padded to 4 bytes, int32 and float32 big-endian)
const pad4 = n => (n + 4) & ~3;   // a string of n bytes with at least one NUL, padded
function oscString(s) {
  const b = Buffer.from(s, 'utf8'), out = Buffer.alloc(pad4(b.length));
  b.copy(out);
  return out;
}
// a page's message as one datagram (null: not a message checkMsg takes)
export function encode(msg) {
  if (!checkMsg(msg)) return null;
  const parts = [oscString(msg[0]), oscString(',' + msg[1])];
  let a = 2;
  for (const t of msg[1]) {
    if (t === 'i') { const b = Buffer.alloc(4); b.writeInt32BE(msg[a++]); parts.push(b); }
    else if (t === 'f') { const b = Buffer.alloc(4); b.writeFloatBE(msg[a++]); parts.push(b); }
    else if (t === 's') parts.push(oscString(msg[a++]));
  }
  return Buffer.concat(parts);
}

// ---- decoding: a packet as a list of messages, or null
const UTF8 = new TextDecoder('utf-8');
function readString(buf, at) {   // { s, next } or null: NUL-terminated, padded to 4
  const end = buf.indexOf(0, at);
  if (end < 0) return null;
  const next = pad4(end - at) + at;
  if (next > buf.length) return null;
  for (let i = end; i < next; i++) if (buf[i] !== 0) return null;
  return { s: UTF8.decode(buf.subarray(at, end)), next };
}
function decodeMessage(buf) {
  const a = readString(buf, 0);
  if (!a || !IN_ADDR.test(a.s)) return null;
  if (a.next === buf.length) return [a.s, ''];   // (no type tags at all: an old sender's message without arguments)
  const t = readString(buf, a.next);
  if (!t || t.s[0] !== ',') return null;
  const msg = [a.s, ''];
  let at = t.next, types = '';
  const need = n => at + n <= buf.length;
  for (const c of t.s.slice(1)) {
    if (c === 'i') { if (!need(4)) return null; msg.push(buf.readInt32BE(at)); at += 4; types += 'i'; }
    else if (c === 'f') { if (!need(4)) return null; const v = buf.readFloatBE(at); at += 4; if (!Number.isFinite(v)) return null; msg.push(v); types += 'f'; }
    else if (c === 'd') { if (!need(8)) return null; const v = buf.readDoubleBE(at); at += 8; if (!Number.isFinite(v)) return null; msg.push(v); types += 'f'; }
    else if (c === 'h') {
      if (!need(8)) return null;
      const v = buf.readBigInt64BE(at), n = Number(v);
      at += 8;
      msg.push(n); types += Number.isSafeInteger(n) && BigInt(n) === v ? 'i' : 'f';
    }
    else if (c === 's' || c === 'S') { const s = readString(buf, at); if (!s) return null; msg.push(s.s); at = s.next; types += 's'; }
    else if (c === 'c') { if (!need(4)) return null; const v = buf.readUInt32BE(at); at += 4; if (v > 0x10ffff) return null; msg.push(String.fromCodePoint(v)); types += 's'; }
    else if (c === 'T' || c === 'F' || c === 'N' || c === 'I') types += c;
    else return null;   // (b blobs, t timetags, r colours, m MIDI, [ ] arrays, anything else)
  }
  if (at !== buf.length) return null;
  msg[1] = types;
  return msg;
}
function decodeInto(buf, out, depth) {
  if (buf.length < 4 || buf.length % 4) return false;
  if (buf[0] === 0x2f) { const m = decodeMessage(buf); if (!m) return false; out.push(m); return out.length <= MAX_IN_MSGS; }   // '/'
  if (depth >= MAX_DEPTH || buf.length < 16 || buf.toString('latin1', 0, 8) !== '#bundle\0') return false;
  for (let at = 16; at < buf.length;) {   // (8 bytes of '#bundle', 8 of timetag, then size and element, size and element ...)
    if (at + 4 > buf.length) return false;
    const n = buf.readInt32BE(at);
    at += 4;
    if (n <= 0 || n % 4 || at + n > buf.length) return false;
    if (!decodeInto(buf.subarray(at, at + n), out, depth + 1)) return false;
    at += n;
  }
  return true;
}
export function decode(buf) {
  if (!Buffer.isBuffer(buf)) return null;
  const out = [];
  try { return decodeInto(buf, out, 0) && out.length ? out : null; } catch { return null; }
}

// ---- the command line's words
// --osc-out <host:port>: { host, port } or null (host: an IPv4 address or a name)
export function parseTarget(s) {
  const m = /^([A-Za-z0-9](?:[A-Za-z0-9.-]{0,252}[A-Za-z0-9])?):(\d{1,5})$/.exec(String(s).trim());
  if (!m || !(+m[2] >= 1 && +m[2] <= 65535)) return null;
  if (/^[\d.]+$/.test(m[1]) && !net.isIPv4(m[1])) return null;
  return { host: m[1], port: +m[2] };
}
// --osc-in <port> or <addr:port>: { addr, port } or null (addr an IPv4 address, 127.0.0.1 unless given: UDP has no password, so
// another machine's OSC needs the address said, such as 0.0.0.0; port 0 picks a free one)
export function parseIn(s) {
  const m = /^(?:([\d.]+):)?(\d{1,5})$/.exec(String(s).trim());
  if (!m || +m[2] > 65535 || (m[1] && !net.isIPv4(m[1]))) return null;
  return { addr: m[1] || '127.0.0.1', port: +m[2] };
}

// ---- the sockets. o: { out: [{ host, port }], inAddr, inPort (-1: none), log, onIn(msgs, at) }. Its methods: listen() (a
// promise of the in port, 0 none: the in socket's errors reject it), send(buf) (to every target: false when there are
// none), count, targets (their words, for the start line only), close()
export function makeOsc(o = {}) {
  const log = o.log || (() => {});
  const targets = (o.out || []).map(t => ({ ...t, ip: net.isIPv4(t.host) ? t.host : '', looked: 0, busy: false, said: '' }));
  const count = { sent: 0, errors: 0, got: 0, gotPackets: 0, badIn: 0 };
  let outSock = null, inSock = null, inPort = 0, closed = false;

  function lookup(t) {
    if (net.isIPv4(t.host) || t.busy || closed) return;
    const now = Date.now();
    if (t.looked && now - t.looked < RELOOK) return;
    t.looked = now; t.busy = true;
    dns.lookup(t.host, { family: 4 }, (err, ip) => {
      t.busy = false;
      if (err || !ip) { const said = err ? err.code || err.message : 'no address'; if (said !== t.said) { t.said = said; log(`OSC: cannot look up ${t.host} (${said}): messages to it wait until it can be`); } return; }
      if (ip !== t.ip && t.ip) log(`OSC: ${t.host} is now ${ip}`);
      t.ip = ip; t.said = '';
    });
  }
  function send(buf) {
    if (!outSock || !targets.length) return false;
    for (const t of targets) {
      if (!t.ip) { lookup(t); continue; }
      outSock.send(buf, t.port, t.ip, err => {
        if (!err) { count.sent++; return; }
        count.errors++;
        if (err.code !== t.said) { t.said = err.code || err.message; log(`OSC: a send to ${t.host}:${t.port} failed (${t.said})`); }
        lookup(t);
      });
    }
    return true;
  }
  function take(buf) {
    const msgs = decode(buf);
    if (!msgs) { count.badIn++; return; }
    count.gotPackets++; count.got += msgs.length;
    if (o.onIn) { try { o.onIn(msgs, Date.now()); } catch (err) { log(`OSC: ${err.message}`); } }
  }
  return {
    count,
    get targets() { return targets.map(t => `${t.host}:${t.port}`); },
    get inPort() { return inPort; },
    async listen() {
      if (targets.length) {
        outSock = dgram.createSocket('udp4');
        outSock.on('error', err => log(`OSC: ${err.message}`));
        await new Promise(r => outSock.bind(0, r));
        outSock.unref();
        for (const t of targets) lookup(t);
      }
      if (o.inPort >= 0) {
        inSock = dgram.createSocket('udp4');
        await new Promise((resolve, reject) => {
          inSock.once('error', reject);
          inSock.bind({ port: o.inPort, address: o.inAddr || '127.0.0.1', exclusive: true }, () => {
            inSock.removeListener('error', reject);
            inSock.on('error', err => log(`OSC: ${err.message}`));
            resolve();
          });
        });
        inSock.on('message', take);
        inPort = inSock.address().port;
      }
      return inPort;
    },
    send,
    close() { closed = true; for (const s of [outSock, inSock]) { try { s && s.close(); } catch { /* closed */ } } },
  };
}
