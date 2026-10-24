// Read-only HTTP checks using only the existing publishable key, never a secret.
import { readFileSync } from 'node:fs';
const source = readFileSync('.env.local', 'utf8');
function publicValue(name) {
  const line = source.split(/\r?\n/).find(value => value.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
}
const url = publicValue('NEXT_PUBLIC_SUPABASE_URL');
const key = publicValue('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if (url !== 'https://onfxxtvfprjnqsxdmhkp.supabase.co' || !key?.startsWith('sb_publishable_') || key.includes('REPLACE_WITH')) {
  console.error('Hosted public configuration is missing or targets a different project.');
  process.exit(1);
}
try {
  const settings = await fetch(`${url}/auth/v1/settings`, { headers:{ apikey:key, origin:'http://localhost:3000' }, signal:AbortSignal.timeout(15000) });
  if (!settings.ok) throw new Error('Auth settings request failed.');
  const data = await settings.json();
  console.log(JSON.stringify({ project:'onfxxtvfprjnqsxdmhkp', authSettingsStatus:settings.status,
    authCorsAllowedOrigin:settings.headers.get('access-control-allow-origin'),
    emailProvider:data.external?.email, publicSignupDisabled:data.disable_signup,
    emailAutoconfirm:data.mailer_autoconfirm },null,2));
  // This readiness function is SELECT true only. Anonymous execution must fail.
  // Do not call registration/redemption/quota mutation RPCs in a hosted check.
  const readiness = await fetch(`${url}/rest/v1/rpc/auth_flow_store_ready`, {
    method:'POST', headers:{ apikey:key, 'content-type':'application/json' },
    body:'{}', signal:AbortSignal.timeout(15000),
  });
  const result = await readiness.json();
  console.log(JSON.stringify({ anonymousReadyStatus:readiness.status, postgresErrorCode:result.code??null,
    permissionDeniedAsExpected:[401,403].includes(readiness.status)&&result.code==='42501' },null,2));
  if (![401,403].includes(readiness.status) || result.code!=='42501') process.exitCode=1;
} catch {
  console.error('Read-only hosted Auth/API check failed; no credentials or response payload logged.');
  process.exitCode=1;
}
