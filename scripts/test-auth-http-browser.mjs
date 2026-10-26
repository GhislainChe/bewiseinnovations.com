// Isolated browser/HTTP regression: synthetic data only; no Auth SDK or credentials.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const browser = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!browser) { console.error('Browser integration blocked: supported local Edge/Chrome executable unavailable.'); process.exit(1); }
mkdirSync('.supabase/browser-tests', { recursive: true });
const run = promisify(execFile);
const compiled = ts.transpileModule(readFileSync('src/lib/auth/form-submit.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
let base;
let scenario;
const posts = [];
let errors = 0;
const server = createServer((req, res) => {
  res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'POST') {
    posts.push({ scenario, origin: req.headers.origin === 'null' ? 'null' : req.headers.origin === base ? 'expected' : 'unexpected', referer: Boolean(req.headers.referer) });
    req.resume();
    if (req.headers['x-auth-form'] === '1') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ destination: '/auth/error' })); }
    else { res.writeHead(303, { Location: '/auth/error' }); res.end(); }
    return;
  }
  if (req.url === '/submitter.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(compiled); return; }
  res.setHeader('Content-Type', 'text/html');
  if (req.url === '/auth/error') { errors++; res.end('<!doctype html><p>Stable authentication error</p>'); return; }
  if (req.url === '/native') {
    res.end('<!doctype html><form action="/auth/confirm/complete" method="post"><button>Continue</button></form><script>document.querySelector("form").requestSubmit()</script>');
  } else {
    res.end(`<!doctype html><body><script type="module">
      import {createAuthFormSubmitter} from '/submitter.js';
      const submit = createAuthFormSubmitter(fetch, location.origin, path => location.replace(path));
      const fields = new URLSearchParams({type:'invite',token_hash:'synthetic-browser-fixture-only'});
      submit('/auth/confirm/complete', fields);
      submit('/auth/confirm/complete', fields);
    </script></body>`);
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
base = `http://127.0.0.1:${server.address().port}`;
try {
  for (scenario of ['native', 'fixed']) {
    const profile = resolve(mkdtempSync('.supabase/browser-tests/submit-'));
    await run(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-background-networking', '--disable-sync', '--user-data-dir=' + profile, '--dump-dom', '--virtual-time-budget=3000', base + '/' + scenario], { timeout: 25000, maxBuffer: 500000, windowsHide: true });
  }
  assert.deepEqual(posts, [
    { scenario: 'native', origin: 'null', referer: false },
    { scenario: 'fixed', origin: 'expected', referer: false },
  ]);
  assert.equal(errors, 2); // Exactly one final error GET per scenario, no loop.
  console.log('PASS: real browser native Origin=null reproduced; actual submitter preserves Origin/no-referrer; concurrent calls send one POST; final page does not loop.');

  // Existing Next.js process, anonymous requests only: never submit a valid token.
  for (let i = 0; i < 3; i++) {
    const response = await fetch('http://localhost:3000/auth/error', { redirect: 'manual', signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200); assert.equal(response.headers.has('location'), false);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    const html = await response.text(); assert.match(html, /Authentication status/);
    assert.doesNotMatch(html, /http-equiv=["']refresh/i);
  }
  for (const headers of [
    { origin: 'http://localhost:3000' }, { origin: 'null' }, {},
    { origin: 'http://localhost:3000', 'x-forwarded-host': 'untrusted.invalid' },
  ]) {
    const response = await fetch('http://localhost:3000/auth/confirm/complete', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-auth-form': '1', ...headers },
      body: 'type=invite&token_hash=x',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { destination: '/auth/error' });
  }
  console.log('PASS: real Next.js proxy/error page stable over HTTP; dummy inputs and missing/null/spoofed headers stop locally without OTP calls.');
} catch {
  console.error('Browser/HTTP regression failed or timed out; raw browser output, HTML and request data suppressed.');
  process.exitCode = 1;
} finally { server.close(); }
