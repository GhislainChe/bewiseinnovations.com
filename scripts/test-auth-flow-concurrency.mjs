// LOCAL-ONLY PostgreSQL integration test. Never accepts a remote URL.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const run = promisify(execFile);
const container = 'supabase_db_bewiseinnovations.com';
const uuid = randomUUID();
const ticketHash = randomBytes(32).toString('hex');
const emailHash = randomBytes(32).toString('hex');
const globalHash = randomBytes(32).toString('hex');
const secondGlobalHash = randomBytes(32).toString('hex');
const distinctEmails = Array.from({ length: 33 }, () => randomBytes(32).toString('hex'));

async function sql(statement) {
  const { stdout } = await run('docker', [
    'exec', container, 'psql', '-U', 'postgres', '-d', 'postgres',
    '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', statement,
  ], { timeout: 30000, maxBuffer: 1024 * 1024 });
  return stdout.trim().split(/\r?\n/).at(-1)?.trim();
}

let setupComplete = false;
try {
  await sql(`insert into auth.users (id) values ('${uuid}');`);
  setupComplete = true;
  await sql(`set role service_role;
    select public.register_auth_flow_ticket('${ticketHash}', '${uuid}', 'invite', now() + interval '5 minutes');`);

  const redemptions = await Promise.all(Array.from({ length: 12 }, () =>
    sql(`set role service_role; select public.redeem_auth_flow_ticket('${ticketHash}', '${uuid}', 'invite');`)));
  assert.equal(redemptions.filter((value) => value === 't').length, 1);
  assert.equal(redemptions.filter((value) => value === 'f').length, 11);

  const emailAttempts = await Promise.all(Array.from({ length: 12 }, () =>
    sql(`set role service_role; select public.consume_recovery_budget('${emailHash}', '${globalHash}');`)));
  assert.equal(emailAttempts.filter((value) => value === 't').length, 3);
  assert.equal(emailAttempts.filter((value) => value === 'f').length, 9);

  const globalAttempts = await Promise.all(distinctEmails.map((hash) =>
    sql(`set role service_role; select public.consume_recovery_budget('${hash}', '${secondGlobalHash}');`)));
  assert.equal(globalAttempts.filter((value) => value === 't').length, 30);
  assert.equal(globalAttempts.filter((value) => value === 'f').length, 3);
  process.stdout.write('Local PostgreSQL concurrency: ticket 1/12, email quota 3/12, global quota 30/33 passed.\n');
} finally {
  if (setupComplete) {
    const cleanupHashes = [emailHash, globalHash, secondGlobalHash, ...distinctEmails]
      .map((hash) => `decode('${hash}', 'hex')`).join(',');
    await sql(`delete from auth.users where id = '${uuid}';
      delete from app_private.auth_recovery_buckets where key_hash in (${cleanupHashes});`);
  }
}
