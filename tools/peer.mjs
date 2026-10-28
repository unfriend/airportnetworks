// End-to-end test of the relay's introduction server for peer to peer (PeerJS's protocol at /peerjs).
//   node tools/peer.mjs
// It starts its own relay (relay/server.mjs --static .) on a free port, opens the peer-to-peer test page (p2p/) from
// it in two headless Chromium pages with &peer= pointing at the relay, and checks: the page says which introduction
// server it uses (PeerJS's public one without &peer=); the first page takes the room's id and hosts, the second finds
// it taken, gets an id from the relay and links to the host; the data channel opens and messages go both ways (each
// side's name, the stream, round trips); the relay logs the ids joining and leaving; when the host leaves, its id is
// free and the other page takes it over. Nothing goes to the internet: the pages use only this relay (STUN to
// Cloudflare may be tried and fail; two pages on one machine link by their host addresses). Seconds, not minutes.
// The protocol itself (ids, OPEN, ID-TAKEN, EXPIRE, timeouts) is checked without a browser by relay/test.mjs.
// Needs Playwright as tools/smoke.mjs does (PLAYWRIGHT_MODULE, CHROMIUM_PATH). Exits 1 on any failure.
import { spawn } from 'child_process';
import path from 'path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fails = [], errors = [];
const check = (name, ok, detail) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (!ok && detail ? ': ' + detail : '')); if (!ok) fails.push(name); };

// ---- the relay (its log kept: the test reads the join and leave lines)
let out = '';
const relay = spawn(process.execPath, ['relay/server.mjs', '--port', '0', '--host', '127.0.0.1', '--static', '.'], { cwd: root });
const port = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('the relay did not start: ' + out)), 10000);
  relay.stdout.on('data', d => { out += d; const m = /listening on http:\/\/[^:]+:(\d+)/.exec(out); if (m) { clearTimeout(t); res(+m[1]); } });
  relay.stderr.on('data', d => { out += d; });
  relay.on('exit', c => rej(new Error('the relay stopped (' + c + '): ' + out)));
});

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  // (host candidates as plain addresses, not mDNS names a container cannot resolve; no proxy for 127.0.0.1)
  args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection', '--no-proxy-server'],
});
const until = async (page, fn, arg, ms = 15000) => { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch { return false; } };
const peek = (page, fn, arg) => page.evaluate(fn, arg);
const logged = async (line, ms = 5000) => { for (const end = Date.now() + ms; !out.includes(line) && Date.now() < end;) await sleep(50); return out.includes(line); };
const linkOf = page => peek(page, () => { const L = [...S.links.values()][0]; return L ? { state: L.state, name: L.name, kind: L.kind, rx: L.rx.length, rtt: L.rtt.length, openMs: L.openMs, err: L.err } : null; });

try {
  const ctx = await browser.newContext();
  const pages = [];
  const open = async (hash, name) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|stun|ERR_NAME_NOT_RESOLVED/i.test(m.text())) errors.push(`${name}: ${m.text()}`); });
    await p.goto(`http://127.0.0.1:${port}/p2p/index.html${hash}`);
    await p.fill('#name', name);
    pages.push(p);
    return p;
  };

  // without &peer= the page names PeerJS's public server (and is not started here: no internet in tests)
  const plain = await open('', 'Plain');
  check('without &peer= the page uses PeerJS\'s public server', /0\.peerjs\.com/.test(await plain.textContent('#sServer')), await plain.textContent('#sServer'));
  await plain.close();

  const code = 'E2E' + Math.floor(Math.random() * 1e4), server = `127.0.0.1:${port}/peerjs`, hash = `#room=${code}&peer=${server}`;
  const A = await open(hash, 'Alpha'), B = await open(hash, 'Beta');
  check('with &peer= the page says which server it uses', (await A.textContent('#sServer')).includes(server), await A.textContent('#sServer'));

  await A.click('#start');
  check('the first page takes the room\'s id and hosts', await until(A, () => S.role === 'host'), await peek(A, () => S.role + ' ' + S.server + ' ' + S.serverErr));
  check('it says it reached this server', /reached in .*127\.0\.0\.1/.test(await A.textContent('#sServer')), await A.textContent('#sServer'));
  check('the address keeps the server after Start', (await peek(A, () => location.hash)).includes('peer=' + server), await peek(A, () => location.hash));

  const t0 = Date.now();
  await B.click('#start');
  check('the second finds the id taken, gets one from the relay and links to the host', await until(B, () => S.role === 'guest'), await peek(B, () => S.role + ' ' + S.serverErr));
  const opened = await until(B, () => [...S.links.values()].some(L => L.state === 'open')) && await until(A, () => [...S.links.values()].some(L => L.state === 'open'));
  check(`the data channel opens on both pages (in ${((Date.now() - t0) / 1000).toFixed(1)} s)`, opened, JSON.stringify([await linkOf(A), await linkOf(B)]));
  const named = await until(A, () => [...S.links.values()].some(L => L.name === 'Beta')) && await until(B, () => [...S.links.values()].some(L => L.name === 'Alpha'));
  check('messages go both ways: each page hears the other\'s name', named, JSON.stringify([await linkOf(A), await linkOf(B)]));
  const flowing = await until(A, () => { const L = [...S.links.values()][0]; return L && L.rx.length > 5 && L.rtt.length > 0; }) &&
    await until(B, () => { const L = [...S.links.values()][0]; return L && L.rx.length > 5 && L.rtt.length > 0; });
  check('the stream and round trips flow on both pages', flowing, JSON.stringify([await linkOf(A), await linkOf(B)]));
  const guestId = await peek(B, () => S.peer && S.peer.id);
  check('the relay logs the ids joining (ids only)', out.includes(`peer join lbinet-p2ptest-${code} (`) && out.includes(`peer join ${guestId} (`) && !/peer .*token/.test(out),
    out.split('\n').filter(l => / peer /.test(l)).join(' | '));

  // the host leaves: its id is freed at once, and the other page takes over as host (the page tries again after 3 s)
  await A.click('#stop');
  check('the host leaving frees its id', await logged(`peer leave lbinet-p2ptest-${code} (`), out.split('\n').filter(l => / peer /.test(l)).join(' | '));
  check('the other page takes the id over and hosts', await until(B, () => S.role === 'host', null, 15000), await peek(B, () => S.role + ' ' + S.serverErr));
  check('no page errors', !errors.length, errors.join(' | '));
} catch (err) {
  check('the test ran', false, err.stack || String(err));
} finally {
  await browser.close();
  relay.kill();
}
console.log(fails.length ? `\n${fails.length} failed` : '\nall passed');
process.exit(fails.length ? 1 : 0);
