// Real PostgreSQL parser/execution regression, synthetic local fixtures only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes} from 'node:crypto';
import {restoreSecuritySql,policyEquivalenceSql,comparePolicyEvidence} from './restore-security-snapshot.mjs';
const run=promisify(execFile);

test('PostgreSQL reproduces the original 42601 missing-delimiter failure and executes the corrected snapshot', {timeout:60000}, async()=>{
  const container=`bewise-verifier-regression-${Date.now()}`;
  const env={...process.env,POSTGRES_PASSWORD:randomBytes(32).toString('hex')};
  let created=false;
  const docker=args=>run('docker',args,{env,timeout:10000,maxBuffer:200000});
  function sql(statement) {
    return new Promise((resolve,reject)=>{
      const child=spawn('docker',['exec','-i',container,'psql','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
      let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(new Error('Local regression SQL timeout'));},10000);
      child.stdout.on('data',b=>{stdout+=b;});child.stderr.on('data',b=>{stderr+=b;});child.stdin.on('error',()=>{});
      child.on('error',()=>{clearTimeout(timer);reject(new Error('Local SQL unavailable'));});
      child.on('close',code=>{clearTimeout(timer);resolve({code,stdout,sqlState:stderr.match(/ERROR:\s*([A-Z0-9]{5})/)?.[1]});});child.stdin.end(statement);
    });
  }
  try {
    await docker(['run','-d','--name',container,'--network','none','--env','POSTGRES_PASSWORD','public.ecr.aws/supabase/postgres:17.11.0.003']);created=true;
    let ready=false;
    for(let i=0;i<40;i++) {
      try{const logs=await docker(['logs',container]);if((logs.stdout+logs.stderr).includes('listening on IPv4 address')){await docker(['exec',container,'pg_isready','-U','supabase_admin']);ready=true;break;}}catch{}
      await new Promise(r=>setTimeout(r,300));
    }
    assert.ok(ready,'Disposable PG17 must be available');
    // The malformed full statement fails during parsing before relation lookup.
    const original=restoreSecuritySql.trim().slice(0,-2);
    const failed=await sql(original);assert.notEqual(failed.code,0);assert.equal(failed.sqlState,'42601');
    const setup=await sql(`create schema app_private;
      create table public.roles(id integer primary key,code text);
      create table public.permissions(id integer primary key,code text);
      create table public.role_permissions(role_id integer,permission_id integer);
      insert into public.roles values(1,'synthetic_role');
      insert into public.permissions values(1,'synthetic.read');
      insert into public.role_permissions values(1,1);`);
    assert.equal(setup.code,0);
    const fixed=await sql(restoreSecuritySql);assert.equal(fixed.code,0);
    const result=JSON.parse(fixed.stdout.trim());
    assert.deepEqual(result.role_permissions,{synthetic_role:['synthetic.read']});
    assert.equal(result.private_schema_grants.length,3);
    assert.ok(Array.isArray(result.tables));

    // Real stored policy ASTs/OIDs, not mocked text normalization.
    const fixture=await sql(`create schema if not exists auth;
      create or replace function auth.uid() returns uuid language sql stable as 'select null::uuid';
      create function public.uid() returns uuid language sql stable as 'select null::uuid';
      create table public.synthetic_profiles(id uuid);
      alter table public.synthetic_profiles enable row level security;
      create policy own_profile on public.synthetic_profiles for select to authenticated using (id=auth.uid());`);
    assert.equal(fixture.code,0);
    const policy={schema:'public',table:'synthetic_profiles',name:'own_profile',mode:'PERMISSIVE',roles:['authenticated'],command:'SELECT',using:'(id = auth.uid())',check:null};
    const visible=await sql(`set search_path=auth,public; select qual from pg_policies where tablename='synthetic_profiles';`);
    assert.match(visible.stdout,/uid\(\)/);assert.doesNotMatch(visible.stdout,/auth\.uid/);
    const getEvidence=async()=>{
      const r=await sql(policyEquivalenceSql([policy]));assert.equal(r.code,0);
      return JSON.parse(r.stdout.trim());
    };
    const equivalent=await getEvidence();
    comparePolicyEvidence([{...policy,using:'(id = uid())'}],[policy],equivalent);
    const actual=equivalent.policies.find(p=>p.side==='actual');
    assert.equal(actual.functions.length,1);assert.equal(actual.functions[0].schema,'auth');
    assert.equal(actual.functions[0].name,'uid');
    assert.deepEqual(equivalent.uid_functions.map(f=>f.schema).sort(),['auth','public']);

    // Same display name, genuinely different stored function dependency.
    assert.equal((await sql('alter policy own_profile on public.synthetic_profiles using (id=public.uid());')).code,0);
    const shadowed=await getEvidence();
    assert.equal(shadowed.policies.find(p=>p.side==='actual').functions[0].schema,'public');
    assert.throws(()=>comparePolicyEvidence([policy],[policy],shadowed),/Resolved policy differs/);
    for(const predicate of ['true','id=auth.uid() or true']) {
      assert.equal((await sql(`alter policy own_profile on public.synthetic_profiles using (${predicate});`)).code,0);
      const weakened=await getEvidence();
      assert.throws(()=>comparePolicyEvidence([policy],[policy],weakened),/Resolved policy differs/);
    }
    assert.equal((await sql('drop policy own_profile on public.synthetic_profiles;')).code,0);
    const missing=await getEvidence();
    assert.throws(()=>comparePolicyEvidence([],[policy],missing),/inventory/);
    assert.throws(()=>comparePolicyEvidence([policy],[policy],missing),/Missing policy evidence/);
    assert.equal((await sql('create policy own_profile on public.synthetic_profiles as restrictive for select to authenticated using (id=auth.uid());')).code,0);
    const restrictive=await getEvidence();
    assert.throws(()=>comparePolicyEvidence([policy],[policy],restrictive),/Resolved policy differs/);
    assert.equal((await sql('alter policy own_profile on public.synthetic_profiles to anon;')).code,0);
    const wrongRole=await getEvidence();
    assert.throws(()=>comparePolicyEvidence([policy],[policy],wrongRole),/Resolved policy differs/);
  }finally {if(created)await docker(['rm','-f','-v',container]);}
});

