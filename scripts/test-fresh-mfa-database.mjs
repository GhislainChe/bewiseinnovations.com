// Replays application migrations into a disposable, network-isolated PG17 DB.
// Only Auth schema (no rows/secrets) is copied from the LOCAL baseline.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const run=promisify(execFile);
const image='public.ecr.aws/supabase/postgres:17.11.0.003';
const container=`bewise-mfa-preflight-${Date.now()}`;
const env={...process.env,POSTGRES_PASSWORD:randomBytes(32).toString('hex'),BEWISE_TEST_DATABASE_CONTAINER:container};
let created=false,phase='local prerequisites';
async function docker(args,timeout=30000){return run('docker',args,{env,timeout,maxBuffer:2000000});}
async function sql(statement,database='mfa_preflight') {
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',container,'psql','-h','/var/run/postgresql','-U','supabase_admin','-d',database,'-X','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output='',errors=''; const timer=setTimeout(()=>{child.kill();reject(new Error('Local SQL timeout'));},30000);
    child.stdout.on('data',b=>{output+=b;}); child.stderr.on('data',b=>{errors+=b;});child.stdin.on('error',()=>{});
    child.on('error',()=>{clearTimeout(timer);reject(new Error('Local SQL unavailable'));});
    child.on('close',code=>{clearTimeout(timer);if(code===0)resolve(output);else reject(new Error('Disposable SQL rejected '+(errors.match(/ERROR:\s*([A-Z0-9]{5})/)?.[1]??'unknown')));}); child.stdin.end(statement);
  });
}
try {
  const source=await docker(['exec','supabase_db_bewiseinnovations.com','pg_dump','-h','/var/run/postgresql','-U','postgres','-d','postgres','--schema-only','--schema=auth','--no-owner','--no-acl']);
  assert.ok(source.stdout.includes('CREATE TABLE auth.sessions') && source.stdout.includes('CREATE TABLE auth.mfa_factors'));
  phase='start isolated PostgreSQL 17';
  await docker(['run','-d','--name',container,'--network','none','--label','bewise.preflight=mfa','--env','POSTGRES_PASSWORD',image]); created=true;
  let ready=false;
  for(let i=0;i<40;i++) {
    try { const logs=await docker(['logs',container],5000);
      if((logs.stdout+logs.stderr).includes('listening on IPv4 address')) {await docker(['exec',container,'pg_isready','-U','supabase_admin'],5000);ready=true;break;}
    }catch{} await new Promise(r=>setTimeout(r,500));
  }
  assert.ok(ready);
  await sql('create database mfa_preflight owner postgres;','postgres');
  phase='install matching local Auth schema and test extension';
  await sql(source.stdout);
  await sql(`create schema extensions;create extension pgtap with schema extensions;
    grant usage on schema auth to anon,authenticated,service_role,postgres;
    grant all on all tables in schema auth to postgres;
    grant usage on schema extensions to postgres,anon,authenticated,service_role;`);
  phase='apply all application migrations in order';
  const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
  assert.deepEqual(files,['20261021010000_internal_rbac.sql','20261021010100_seed_internal_roles.sql','20261023010000_auth_flow_security.sql','20261026010000_require_staff_mfa.sql']);
  for(const file of files) {
    await sql(`begin;set local role postgres;${readFileSync('supabase/migrations/'+file,'utf8')}commit;`);
    console.log('Fresh isolated migration applied: '+file);
  }
  // Catalog seed is designed to be repeatable; DDL migrations run once/in order.
  await sql(`begin;set local role postgres;${readFileSync('supabase/migrations/20261021010100_seed_internal_roles.sql','utf8')}commit;`);
  assert.equal((await sql('select count(*) from public.role_permissions;')).trim(),'31');
  phase='fresh isolated pgTAP authorization tests';
  let passed=0;
  for(const file of readdirSync('supabase/tests').filter(f=>f.endsWith('.sql')).sort()) {
    phase='fresh isolated pgTAP '+file;
    const tap=await sql('set role postgres;'+readFileSync('supabase/tests/'+file,'utf8'));
    const count=(tap.match(/^ok [0-9]+\b/gm)||[]).length;
    assert.ok(count>0 && !/^not ok\b/m.test(tap) && !/Looks like you/i.test(tap));passed+=count;
  }
  assert.equal(passed,92);console.log('Fresh isolated pgTAP: 92/92 passed; repeat seed retains 31 mappings.');
  phase='fresh isolated canonical owner bootstrap tests';
  for(const file of ['test-owner-bootstrap.mjs','test-auth-flow-concurrency.mjs']) {
    const result=await run(process.execPath,['scripts/'+file],{env,timeout:120000,maxBuffer:200000});
    // Those scripts emit fixed summaries only, no generated secrets/identities.
    console.log(result.stdout.trim());
  }
  console.log('PASS: fresh PG17 application migration ordering and security tests; existing development database preserved.');
}catch(error) {console.error(`Fresh isolated database verification failed at ${phase}; ${/^Disposable SQL rejected [A-Z0-9]{5}$/.test(error.message)?error.message:'test assertion failed'}; raw SQL and credentials suppressed.`);process.exitCode=1;}
finally {if(created) {try {await docker(['rm','-f','-v',container]);}catch{console.error('Disposable preflight container cleanup requires review.');process.exitCode=1;}}}
