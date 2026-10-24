// Read-only diagnostics. Credentials stay in process environment, never argv/output.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lookup } from 'node:dns/promises';
const run = promisify(execFile);
const image = 'public.ecr.aws/supabase/postgres:17.11.0.003';
const ref = 'onfxxtvfprjnqsxdmhkp';
const { stdout } = await run('cmd.exe', ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'], { timeout: 45000, maxBuffer: 100000 });
const connection = {};
for (const name of ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE']) {
  const match = stdout.match(new RegExp(`export ${name}="([^"\\r\\n]*)"`));
  if (!match) throw new Error('CLI connection export unavailable.');
  connection[name] = match[1];
}
if (!connection.PGUSER.endsWith(`.${ref}`) || connection.PGPORT !== '5432') throw new Error('Unexpected target or pool mode.');
console.log('CLI export uses shared session pooler, port 5432; PostgreSQL image 17.11.0.003.');
try { const addresses = await lookup(`db.${ref}.supabase.co`, { all: true }); console.log('Direct DNS address families:', addresses.map(a=>a.family).join(',')); } catch { console.log('Direct DNS lookup failed.'); }
async function test(label, program, args, overrides = {}) {
  const name = `bewise-backup-diag-${Date.now()}`;
  const env = { ...process.env, ...connection, PGCONNECT_TIMEOUT:'10', PGSSLMODE:'require', PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=20000 -c lock_timeout=5000', ...overrides };
  const dockerArgs = ['run','--rm','--name',name];
  for (const key of ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGCONNECT_TIMEOUT','PGSSLMODE','PGOPTIONS']) dockerArgs.push('--env',key);
  dockerArgs.push('--entrypoint',program,image,...args);
  try {
    const result = await run('docker',dockerArgs,{env,timeout:180000,maxBuffer:2000000});
    console.log(`${label}: PASS (${Buffer.byteLength(result.stdout)} bytes)`);
    if (program === 'psql') console.log(result.stdout.trim());
  } catch (error) {
    const message = `${error.stderr ?? ''}`.replaceAll(connection.PGPASSWORD,'[redacted]').slice(-2500);
    console.log(`${label}: FAIL ${error.killed ? 'bounded timeout; ' : ''}${message}`);
    await run('docker',['rm','-f',name],{timeout:10000}).catch(()=>{});
  }
}
await test('Docker session-pooler SELECT','psql',['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',"set role postgres; select current_database(), current_user, current_setting('server_version'), (select count(*) from supabase_migrations.schema_migrations);"]);
await test('Minimal migration metadata dump','pg_dump',['--verbose','--lock-wait-timeout=5s','--schema-only','--schema=supabase_migrations','--role=postgres','--no-password']);
await test('Direct SELECT','psql',['-X','-A','-t','-c','select current_database();'],{PGHOST:`db.${ref}.supabase.co`,PGUSER:'cli_login_postgres'});
