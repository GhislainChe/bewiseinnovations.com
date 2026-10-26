import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

// Deliberately override inherited shell variables: .env.local targets hosted Supabase.
for (const line of readFileSync('.env.integration.local', 'utf8').split(/\r?\n/)) {
  const index = line.indexOf('=');
  if (index > 0) process.env[line.slice(0, index)] = line.slice(index + 1);
}
const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(api, 'http://127.0.0.1:65421', 'Integration tests require the local API.');
assert.ok(process.env.SUPABASE_AUTH_STORE_SECRET_KEY && process.env.AUTH_FLOW_SIGNING_SECRET);
const mail = 'http://127.0.0.1:65424';
const app = 'http://localhost:3000';
const { createClient } = await import('@supabase/supabase-js');
const admin = createClient(api, process.env.SUPABASE_AUTH_STORE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const publicClient = () => createClient(api, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `auth-local-${Date.now()}-${randomBytes(4).toString('hex')}@example.invalid`;
const firstPassword = `Aa1!${randomBytes(24).toString('base64url')}`;
const secondPassword = `Bb2!${randomBytes(24).toString('base64url')}`;
let userId;
let next;
let phase = 'initialization';
const createdMail = [];
const cookies = new Map();

function updateCookies(response) {
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';', 1)[0];
    const index = pair.indexOf('=');
    if (index < 0) continue;
    const name = pair.slice(0, index);
    const value = pair.slice(index + 1);
    if (/max-age=0/i.test(header) || !value) cookies.delete(name);
    else cookies.set(name, value);
  }
}
async function request(path, fields, useCookies = true) {
  const response = await fetch(`${app}${path}`, {
    method: fields ? 'POST' : 'GET', redirect: 'manual',
    headers: {
      ...(fields ? { origin: app, 'content-type': 'application/x-www-form-urlencoded' } : {}),
      ...(useCookies && cookies.size ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
    },
    body: fields ? new URLSearchParams(fields) : undefined,
  });
  updateCookies(response);
  return response;
}
async function messages() {
  const response = await fetch(`${mail}/api/v1/messages`);
  assert.equal(response.status, 200);
  return (await response.json()).messages;
}
async function nextMessage(previous) {
  for (let i = 0; i < 40; i++) {
    const fresh = (await messages()).find((message) => !previous.has(message.ID));
    if (fresh) {
      createdMail.push(fresh.ID);
      const html = await fetch(`${mail}/view/${encodeURIComponent(fresh.ID)}.html`);
      assert.equal(html.status, 200);
      const content = (await html.text()).replaceAll('&amp;', '&');
      const match = content.match(/https?:\/\/localhost:3000\/auth\/confirm#[^"'\s<>]+/);
      assert.ok(match, 'Expected local confirmation link in Mailpit.');
      const link = new URL(match[0]);
      assert.equal(link.origin, app);
      assert.equal(link.pathname, '/auth/confirm');
      return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Mailpit did not capture a message.');
}
async function waitApp() {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`${app}/auth/forgot-password`)).status === 200) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Next.js did not start.');
}
async function confirm(link, type) {
  const parameters = new URLSearchParams(link.hash.slice(1));
  assert.equal(parameters.get('type'), type);
  const token = parameters.get('token_hash');
  assert.ok(token);
  const before = { token_hash: token, type };
  for (let i = 0; i < 2; i++) {
    const page = await request(link.pathname);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /Secure confirmation/);
    assert.equal(html.includes(token), false);
  }
  const response = await request('/auth/confirm/complete', before);
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get('location')).pathname, type === 'invite' ? '/auth/set-password' : '/auth/reset-password');
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.ok(cookies.has('auth_flow'));
  assert.ok(response.headers.getSetCookie().some((cookie) => cookie.startsWith('auth_flow=') && /httponly/i.test(cookie) && /samesite=lax/i.test(cookie)));
  return before;
}
async function savePassword(type, password) {
  const path = type === 'invite' ? '/auth/set-password' : '/auth/reset-password';
  const page = await request(path);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /password/i);
  const mismatch = await request(`${path}/complete`, { password, confirmation: `${password}x` });
  assert.equal(new URL(mismatch.headers.get('location')).pathname, path);
  const weak = await request(`${path}/complete`, { password: 'short', confirmation: 'short' });
  assert.equal(new URL(weak.headers.get('location')).pathname, path);
  const otherPath = type === 'invite' ? '/auth/reset-password/complete' : '/auth/set-password/complete';
  const wrongFlow = await request(otherPath, { password, confirmation: password });
  assert.equal(new URL(wrongFlow.headers.get('location')).pathname, '/auth/error');
  const savedCookies = new Map(cookies);
  const response = await request(`${path}/complete`, { password, confirmation: password });
  assert.equal(response.status, 303);
  assert.match(response.headers.get('location') ?? '', /auth\/error/);
  const flowDeletion = response.headers.getSetCookie().find((cookie) => cookie.startsWith('auth_flow='));
  assert.ok(flowDeletion, 'Expected flow-cookie expiration.');
  assert.match(flowDeletion, /Path=\/auth(?:;|$)/);
  assert.match(flowDeletion, /Max-Age=0/i);
  assert.match(flowDeletion, /Expires=Thu, 01 Jan 1970/i);
  assert.ok(!cookies.has('auth_flow'));
  const currentCookies = new Map(cookies);
  cookies.clear();
  for (const [key, value] of savedCookies) cookies.set(key, value);
  const replay = await request(`${path}/complete`, { password, confirmation: password });
  assert.equal(new URL(replay.headers.get('location')).pathname, '/auth/error');
  cookies.clear();
  for (const [key, value] of currentCookies) cookies.set(key, value);
}
try {
  phase = 'start local Next.js';
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3000'], {
    env: { ...process.env, NODE_ENV: 'development', AUTH_TRUSTED_ORIGIN: 'http://localhost:3000' }, stdio: 'ignore', windowsHide: true,
  });
  await waitApp();
  phase = 'invitation delivery';
  const beforeInvite = new Set((await messages()).map((message) => message.ID));
  const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${app}/auth/confirm` });
  assert.ifError(invited.error);
  userId = invited.data.user.id;
  const inviteLink = await nextMessage(beforeInvite);
  phase = 'invitation confirmation and password';
  const invalidToken = await request('/auth/confirm/complete', { token_hash: 'x'.repeat(64), type: 'invite' });
  assert.equal(new URL(invalidToken.headers.get('location')).pathname, '/auth/error');
  const wrongType = await request('/auth/confirm/complete', { token_hash: new URLSearchParams(inviteLink.hash.slice(1)).get('token_hash'), type: 'signup' });
  assert.equal(new URL(wrongType.headers.get('location')).pathname, '/auth/error');
  await confirm(inviteLink, 'invite');
  await savePassword('invite', firstPassword);
  assert.ok((await publicClient().auth.signInWithPassword({ email, password: firstPassword })).data.user);
  const profiles = await admin.from('team_profiles').select('id').eq('id', userId);
  const assignments = await admin.from('team_role_assignments').select('user_id').eq('user_id', userId);
  assert.equal(profiles.data?.length, 0);
  assert.equal(assignments.data?.length, 0);
  console.log('PASS local invitation, GET safety, session cookies, password setup, no staff assignment');

  phase = 'recovery delivery';
  const beforeRecovery = new Set((await messages()).map((message) => message.ID));
  const recoveryRequest = await request('/auth/forgot-password/request', { email }, false);
  assert.equal(recoveryRequest.status, 303);
  assert.equal(new URL(recoveryRequest.headers.get('location')).pathname, '/auth/forgot-password');
  const recoveryLink = await nextMessage(beforeRecovery);
  phase = 'recovery confirmation and password';
  await confirm(recoveryLink, 'recovery');
  await savePassword('recovery', secondPassword);
  assert.ok((await publicClient().auth.signInWithPassword({ email, password: firstPassword })).error);
  assert.ok((await publicClient().auth.signInWithPassword({ email, password: secondPassword })).data.user);
  console.log('PASS local recovery, Mailpit delivery, password rotation');
} catch (error) {
  console.error(`FAIL ${phase}: ${error instanceof Error ? error.message.replaceAll(email, '[local identity]').replace(/token_hash=[^&\s]+/g, 'token_hash=[redacted]') : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
  if (createdMail.length) await fetch(`${mail}/api/v1/messages`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ IDs: createdMail }) });
  if (next) next.kill();
}
