// Real Edge + local Auth/SSR/SQL/Mailpit. Never uses hosted environment files.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localSql, localScalar } from './local-database.mjs';

const require = createRequire(import.meta.url);
// Reuse Next's installed WebSocket implementation; no new browser dependency.
const WebSocket = require('next/dist/compiled/ws');
const env = {};
for (const line of readFileSync('.env.integration.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
}
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:65421', 'Local API required');
assert.ok(env.SUPABASE_AUTH_STORE_SECRET_KEY && env.AUTH_FLOW_SIGNING_SECRET);
const app = 'http://localhost:3000', api = env.NEXT_PUBLIC_SUPABASE_URL, mail = 'http://127.0.0.1:65424';
const sdk = key => createClient(api, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = sdk(env.SUPABASE_AUTH_STORE_SECRET_KEY);
const email = `browser-mfa-${randomBytes(8).toString('hex')}@example.invalid`;
const password = `Local!${randomBytes(24).toString('base64url')}`;
const replacement = `New!${randomBytes(24).toString('base64url')}`;
const approval = `local-recovery-${randomBytes(8).toString('hex')}`;
const root = resolve('.supabase/browser-tests');
const profile = resolve(root, `mfa-${randomBytes(8).toString('hex')}`);
const binary = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
let next, browser, socket, userId, primary, backup, pendingSecret;
let unsafeRequestUrl = false, nonlocalRequest = false;
let phase = 'prerequisites', assertions = 0;
let reportedPhase;
const progress = setInterval(() => { if (reportedPhase !== phase) { console.log(`Local browser test: ${phase}`); reportedPhase = phase; } }, 15000);
const mailIds = [], sensitive = [password, replacement, env.SUPABASE_AUTH_STORE_SECRET_KEY, env.AUTH_FLOW_SIGNING_SECRET];
const delay = ms => new Promise(r => setTimeout(r, ms));
const ok = value => { assert.ok(value); assertions++; };
const equal = (a, b) => { assert.deepEqual(a, b); assertions++; };
const calls = new Map(); let sequence = 0;
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { calls.delete(id); reject(new Error('Browser command timed out')); }, 15000);
    calls.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
}
async function js(expression) {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error('Browser evaluation failed');
  return result.result.value;
}
async function until(expression, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { if (await js(expression)) return; } catch {} await delay(200); }
  throw new Error('Browser condition timed out');
}
async function go(path) {
  await cdp('Page.navigate', { url: app + path });
  await until(`document.readyState === "complete" && location.pathname === ${JSON.stringify(new URL(path,app).pathname)}`);
}
async function click(selector) {
  // AuthForm intentionally disables native submission until hydration. Wait for
  // the actual enabled control, rather than racing the previous document.
  await until(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return e && !e.disabled;})()`);
  const point = await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled) return null;e.scrollIntoView();const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  assert.ok(point);
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function fill(selector, value) {
  await js(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
  await cdp('Input.insertText', { text: value });
}
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0; const bytes = [];
  for (const char of secret.replace(/=+$/, '')) { const n = alphabet.indexOf(char); assert.ok(n >= 0); value = value << 5 | n; bits += 5; if (bits >= 8) { bits -= 8; bytes.push(value >>> bits & 255); } value &= (1 << bits) - 1; }
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', Buffer.from(bytes)).update(counter).digest(), offset = hash[19] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
async function fresh(secret) { const previous = totp(secret); while (totp(secret) === previous) await delay(300); }
const state = () => js('fetch("/auth/mfa/session",{cache:"no-store"}).then(async r=>({status:r.status,...await r.json()}))');
async function signIn(pass = password) {
  await go('/auth/sign-in'); await until('!!document.querySelector("input[name=email]")');
  await fill('input[name=email]', email); await fill('input[name=password]', pass);
  await click('button[type=submit]'); await until('location.pathname === "/auth/mfa" && document.body.innerText.includes("Current assurance:")');
  equal((await state()).aal, 'aal1'); equal((await state()).staffAccess, false);
}
async function enroll() {
  await click('form:first-of-type button'); await until('!!document.querySelector("code")');
  const secret = await js('document.querySelector("code").textContent');
  const id = await js('document.querySelector("#factor").value'); sensitive.push(secret);
  const storage = await js('JSON.stringify({local:{...localStorage},session:{...sessionStorage}})');
  ok(!storage.includes(secret)); equal((await state()).aal, primary ? 'aal2' : 'aal1');
  return { id, secret };
}
async function verify(factor) {
  await js(`document.querySelector('#factor').value=${JSON.stringify(factor.id)}`);
  await fill('#code', totp(factor.secret)); await click('form:last-of-type button');
  await until('document.body.innerText.includes("Current assurance: aal2") && !document.querySelector("code")');
  equal((await state()).aal, 'aal2');
}
async function signOut() {
  await go('/auth/sign-out'); await click('button[type=submit]');
  await until('location.pathname === "/auth/error" && document.body.innerText.includes("You have been signed out.")');
  const cookies = (await cdp('Network.getCookies', { urls: [app + '/auth/mfa'] })).cookies;
  ok(!cookies.some(c => c.name === 'auth_flow' || c.name.includes('auth-token')));
  equal((await state()).status, 401);
}
async function recoverMessage() {
  const previous = new Set((await (await fetch(mail + '/api/v1/messages')).json()).messages.map(m => m.ID));
  await go('/auth/forgot-password'); await fill('input[name=email]', email); await click('button[type=submit]');
  await until('location.pathname === "/auth/forgot-password" && location.search.includes("sent=")');
  for (let i = 0; i < 40; i++) {
    const messages = (await (await fetch(mail + '/api/v1/messages')).json()).messages;
    const message = messages.find(m => !previous.has(m.ID) && m.To.some(t => t.Address === email));
    if (message) {
      mailIds.push(message.ID);
      const html = (await (await fetch(mail + '/view/' + encodeURIComponent(message.ID) + '.html')).text()).replaceAll('&amp;', '&');
      const match = html.match(/http:\/\/localhost:3000\/auth\/confirm#[^"'\s<>]+/); ok(match);
      const link = new URL(match[0]); equal(new URLSearchParams(link.hash.slice(1)).get('type'), 'recovery');
      sensitive.push(new URLSearchParams(link.hash.slice(1)).get('token_hash'));
      await go(link.pathname + link.hash); await until('location.hash === "" && !!document.querySelector("button[type=submit]")');
      // Landing remains inert; no recovery ticket is created by GET.
      equal(await localScalar(`select count(*) from app_private.auth_flow_tickets where user_id='${userId}';`), '0');
      await click('button[type=submit]'); await until('location.pathname === "/auth/reset-password"');
      return;
    }
    await delay(300);
  }
  throw new Error('Local recovery message unavailable');
}
async function auditSuspension(active, action) {
  // Exact disposable fixture only. Simulates independently approved trusted
  // infrastructure actions, not a public recovery endpoint or human approval.
  await localSql(`begin;select id from public.team_profiles where id='${userId}' for update;
    update public.team_profiles set is_active=${active} where id='${userId}';
    insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
    values(null,'${action}','team_profile','${userId}',jsonb_build_object('approval_reference','${approval}','simulation',true));commit;`);
}
async function recoveryAudit(action) {
  await localSql(`insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
    values(null,'${action}','auth_user','${userId}',jsonb_build_object('approval_reference','${approval}','simulation',true));`);
}
async function main() {
  assert.ok(binary, 'Browser unavailable; use documented manual procedure');
  equal(await localScalar('select count(*) from public.team_profiles;'), '0');
  try { await fetch(app, { signal: AbortSignal.timeout(500) }); throw new Error('Port occupied'); } catch (e) { if (e.message === 'Port occupied') throw e; }
  phase = 'start isolated local browser and app';
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3000'], {
    env: { ...process.env, ...env, NODE_ENV: 'development', AUTH_TRUSTED_ORIGIN: app, AUTH_RECOVERY_MODE: 'local', AUTH_RECOVERY_TEST_ORIGIN: '', AUTH_LOCAL_PREFLIGHT: '0' }, stdio: 'ignore', windowsHide: true });
  let ready = false;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(app + '/auth/sign-in', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {} await delay(400); } ok(ready);
  mkdirSync(profile, { recursive: true });
  browser = spawn(binary, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-background-networking', '--disable-sync', '--disable-features=PasswordManagerOnboarding,PasswordLeakDetection', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 60 && !existsSync(resolve(profile, 'DevToolsActivePort')); i++) await delay(300);
  const port = Number(readFileSync(resolve(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
  assert.ok(Number.isInteger(port) && port > 0);
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const address = new URL(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  assert.ok(['localhost', '127.0.0.1'].includes(address.hostname));
  socket = new WebSocket(address.toString());
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', () => reject(new Error('Local browser unavailable'))); });
  socket.on('message', message => { const result = JSON.parse(message); if (result.method === 'Network.requestWillBeSent') { const url = new URL(result.params.request.url); if (['http:','https:'].includes(url.protocol)) { if (!['localhost','127.0.0.1'].includes(url.hostname)) nonlocalRequest = true; if (url.searchParams.has('token_hash') || sensitive.filter(Boolean).some(value => url.href.includes(value))) unsafeRequestUrl = true; } } if (!result.id) return; const call = calls.get(result.id); if (!call) return; calls.delete(result.id); clearTimeout(call.timer); if (result.error) call.reject(new Error('Browser command failed')); else call.resolve(result.result); });
  socket.on('error', () => {});
  await cdp('Page.enable'); await cdp('Network.enable');
  phase = 'create disposable LOCAL identity';
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); ok(!created.error); userId = created.data.user.id;
  phase = 'real browser password sign-in and enrollment';
  await signIn(); const first = await enroll();
  phase = 'invalid browser challenge';
  await fill('#code', totp(first.secret) === '000000' ? '111111' : '000000'); await click('form:last-of-type button');
  await until('document.querySelector("[role=status]").textContent.includes("MFA request failed")'); equal((await state()).aal, 'aal1');
  phase = 'valid browser challenge and unassigned denial';
  await verify(first); primary = first;
  const sessionCookies = (await cdp('Network.getCookies', { urls: [app + '/auth/mfa'] })).cookies.filter(c => c.name.includes('auth-token'));
  ok(sessionCookies.length > 0); ok(sessionCookies.every(c => c.sameSite === 'Lax' && c.domain === 'localhost' && c.path === '/'));
  equal((await state()).staffAccess, false); ok(await js('document.body.innerText.includes("pending activation")'));
  phase = 'browser backup enrollment and verification';
  backup = await enroll(); await verify(backup); equal((await state()).factors.filter(f => f.verified).length, 2);
  phase = 'browser checked logout and password reauthentication';
  await signOut(); await signIn();
  equal(await js('document.querySelector("form:first-of-type button").disabled'), true);
  phase = 'lost primary: browser backup challenge';
  await fresh(backup.secret); await verify(backup); equal((await state()).staffAccess, false);
  phase = 'local owner fixture for recovery boundary drills';
  await localSql(`select set_config('bewise.bootstrap_user_id','${userId}',false);select set_config('bewise.bootstrap_email','${email}',false);select set_config('bewise.bootstrap_approval','${approval}',false);${readFileSync('supabase/admin/bootstrap-platform-owner.sql','utf8')}`);
  equal((await state()).staffAccess, true);
  phase = 'forgotten password with enrolled MFA via browser and Mailpit';
  await signOut(); await recoverMessage();
  phase = 'browser recovery AAL1 page and unconsumed ticket';
  await until('document.body.innerText.includes("Verify your authenticator")');
  equal((await state()).aal, 'aal1'); equal((await state()).staffAccess, false);
  // Crafted POST cannot burn a valid recovery ticket before step-up.
  const direct = await js(`fetch('/auth/reset-password/complete',{method:'POST',mode:'cors',referrerPolicy:'no-referrer',headers:{'x-auth-form':'1'},body:new URLSearchParams({password:${JSON.stringify(replacement)},confirmation:${JSON.stringify(replacement)}})}).then(r=>r.json())`);
  equal(direct.destination, '/auth/mfa');
  equal(await localScalar(`select count(*) from app_private.auth_flow_tickets where user_id='${userId}' and redeemed_at is null;`), '1');
  phase = 'browser recovery MFA handoff';
  await click('a[href="/auth/mfa"]'); await until('document.body.innerText.includes("Current assurance: aal1")');
  await fresh(backup.secret); await verify(backup);
  phase = 'browser recovery return link after step-up';
  await until('!!document.querySelector('+JSON.stringify('a[href="/auth/reset-password"]')+')'); await click('a[href="/auth/reset-password"]');
  await until('!!document.querySelector("input[name=password]")');
  phase = 'browser recovered password update and checked sign-out';
  await fill('input[name=password]', replacement); await fill('input[name=confirmation]', replacement); await click('button[type=submit]');
  await until('location.pathname === "/auth/error" && document.body.innerText.includes("Password reset.")');
  equal((await state()).status, 401);
  const remaining = (await cdp('Network.getCookies', { urls: [app + '/auth/mfa'] })).cookies;
  ok(!remaining.some(c => c.name === 'auth_flow' || c.name.includes('auth-token')));
  equal(await localScalar(`select count(*) from app_private.auth_flow_tickets where user_id='${userId}' and redeemed_at is not null;`), '1');
  const oldPassword = await sdk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).auth.signInWithPassword({email,password}); ok(oldPassword.error);
  phase = 'compromise and emergency owner lockout simulation';
  await signIn(replacement); await fresh(backup.secret); await verify(backup); equal((await state()).staffAccess, true);
  phase = 'browser expired-session denial';
  await localSql(`update auth.sessions set not_after=now()-interval '1 second' where user_id='${userId}';`);
  equal((await state()).staffAccess ?? false, false);
  phase = 'audited owner suspension and global revocation';
  await auditSuspension(false, 'team.recovery.suspended'); equal((await state()).staffAccess, false);
  const device = sdk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const deviceLogin = await device.auth.signInWithPassword({email,password:replacement}); ok(!deviceLogin.error);
  const jwt = deviceLogin.data.session.access_token; sensitive.push(jwt);
  equal((await device.from('team_profiles').select('id')).data, []);
  // Supported global revocation with a real local JWT, never guessed from UUID.
  ok(!(await admin.auth.admin.signOut(jwt, 'global')).error);
  await recoveryAudit('team.recovery.sessions_revoked');
  equal(await localScalar(`select count(*) from auth.sessions where user_id='${userId}';`), '0');
  const stale = await fetch(api + '/rest/v1/team_profiles?select=id', { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${jwt}` } });
  if (stale.ok) equal(await stale.json(), []); else ok([401,403].includes(stale.status));
  equal((await state()).staffAccess ?? false, false);
  phase = 'all factors lost: approved LOCAL admin reset while inactive';
  for (const f of [primary, backup]) {
    ok(!(await admin.auth.admin.mfa.deleteFactor({userId,id:f.id})).error);
    await recoveryAudit('team.recovery.factor_removed');
  }
  equal(await localScalar(`select count(*) from auth.mfa_factors where user_id='${userId}';`), '0');
  equal(await localScalar(`select is_active from public.team_profiles where id='${userId}';`), 'f');
  phase = 'browser cleanup after remote session revocation';
  // Clear invalidated browser cookies by the checked own-user sign-out flow.
  await go('/auth/sign-out'); await click('button[type=submit]'); await until('location.pathname === "/auth/error"');
  // This fourth sign-in correctly exceeds the same-email app quota. It is a
  // recovery drill, so a new provider session is installed by LOCAL SDK in RAM;
  // the limiter is not reset, broadened or bypassed by a public app endpoint.
  const repaired = sdk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  phase = 'new local password session after lost-factor reset';
  const repairedLogin = await repaired.auth.signInWithPassword({email,password:replacement}); ok(!repairedLogin.error);
  phase = 'replacement local factor enrollment while suspended';
  const newFactor = await repaired.auth.mfa.enroll({factorType:'totp',friendlyName:'Local recovery replacement'}); ok(!newFactor.error);
  pendingSecret = newFactor.data.totp.secret; sensitive.push(pendingSecret);
  equal((await repaired.from('team_profiles').select('id')).data, []);
  phase = 'replacement local factor verification while suspended';
  ok(!(await repaired.auth.mfa.challengeAndVerify({factorId:newFactor.data.id,code:totp(pendingSecret)})).error);
  equal((await repaired.from('team_profiles').select('id')).data, []);
  await auditSuspension(true, 'team.recovery.reactivated');
  phase = 'reactivation permission and audit verification';
  equal((await repaired.from('team_profiles').select('id')).data, [{id:userId}]);
  equal(await localScalar(`select count(*) from public.team_role_assignments where user_id='${userId}' and role_id=(select id from public.roles where code='platform_owner');`), '1');
  equal(await localScalar(`select count(*) from public.audit_logs where resource_id='${userId}' and action like 'team.recovery.%';`), '5');
  const claims = await repaired.auth.getClaims(); const sessionId = claims.data.claims.session_id;
  await localSql(`update auth.sessions set not_after=now()-interval '1 second' where id='${sessionId}';`);
  equal((await repaired.from('team_profiles').select('id')).data, []);
  phase = 'trace privacy and exact role catalog';
  equal(unsafeRequestUrl, false); equal(nonlocalRequest, false);
  for (const file of ['.next/dev/trace','.next/dev/logs/next-development.log']) if (existsSync(file)) {
    const text = readFileSync(file, 'utf8'); ok(!sensitive.filter(Boolean).some(value => text.includes(value)));
  }
  equal(await localScalar("select count(*) from public.roles;"), '4');
  equal(await localScalar("select count(*) from public.permissions;"), '18');
  equal(await localScalar("select count(*) from public.role_permissions;"), '31');
  console.log(`PASS: ${assertions} real Edge/local Auth/SSR/Mailpit/SQL assertions; browser MFA, backup factor, recovery, suspension, global revocation, factor replacement and expiry. No hosted requests.`);
}
void main().catch(() => { console.error(`Local browser/recovery test stopped at ${phase} after ${assertions} checks; raw browser/provider output and all secrets suppressed.`); process.exitCode = 1; }).finally(async () => {
  try {
    if (userId) {
      await localSql(`delete from public.audit_logs where resource_id='${userId}' and metadata->>'approval_reference'='${approval}';`);
      ok(!(await admin.auth.admin.deleteUser(userId)).error);
    }
    if (mailIds.length) { const r = await fetch(mail + '/api/v1/messages', {method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({IDs:mailIds})}); if (!r.ok) throw new Error('Local mail cleanup failed'); }
    for (const identifier of [email, `sign-in:${email}`]) {
      const hash = createHmac('sha256',env.AUTH_FLOW_SIGNING_SECRET.trim()).update('recovery-email:').update(identifier).digest('hex');
      await localSql(`delete from app_private.auth_recovery_buckets where scope='email' and key_hash=decode('${hash}','hex');`);
    }
  } catch { console.error('Exact local fixture cleanup needs review; no automatic retry.'); process.exitCode = 1; }
  socket?.close();
  clearInterval(progress);
  for (const child of [browser,next]) if (child?.pid) try { execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true}); } catch {}
  // Only this run's isolated browser profile; never existing traces/profiles.
  if (profile.startsWith(root + sep) && existsSync(profile)) {
    try { rmSync(profile,{recursive:true,maxRetries:3,retryDelay:300}); } catch { console.error('Private disposable browser profile remains; review before cleanup.'); process.exitCode = 1; }
  }
});
