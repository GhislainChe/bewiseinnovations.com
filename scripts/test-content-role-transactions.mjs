// Actual LOCAL PostgreSQL transactions only. No connection URL is accepted.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {localSql,localScalar} from './local-database.mjs';
const bind=readFileSync('supabase/admin/bind-disposable-content-test.sql','utf8');
const unbind=readFileSync('supabase/admin/unbind-disposable-content-test.sql','utf8');
const u=randomUUID(), factor=randomUUID(), retired=randomUUID(), session=randomUUID(), other=randomUUID();
const email=`${u}@example.invalid`, run=`permission-test-${randomUUID()}`;
const settings={user_id:u,email,run,approval:'local-only-binding',factor_id:factor,retired_factor_id:retired,mitigation:'local-synthetic-factor-mitigation'};
const params=(extra={})=>Object.entries({...settings,...extra}).map(([k,v])=>`select set_config('bewise.permission_test_${k}','${v}',false);`).join('');
const fixture=`insert into auth.users(id,email,email_confirmed_at,role) values('${u}','${email}',now(),'authenticated');
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values('${factor}','${u}','totp','verified',now(),now());
insert into auth.sessions(id,user_id,factor_id,aal) values('${session}','${u}','${factor}','aal2');`;
let assertions=0,created=false;
const eq=(a,b)=>{assert.deepEqual(a,b);assertions++;};
async function rejectBinding(change='',extra={}) {
  await assert.rejects(localSql(`begin;${fixture}${change}${params(extra)}${bind}`));assertions++;
  eq(await localScalar('select count(*) from public.team_profiles;'),'0');
  eq(await localScalar(`select count(*) from public.audit_logs where metadata->>'test_run'='${run}';`),'0');
}
try {
  eq(await localScalar('select count(*) from public.team_profiles;'),'0');
  eq(await localScalar('select count(*) from public.team_role_assignments;'),'0');
  await assert.rejects(localSql(bind));assertions++;
  await rejectBinding('',{email:'wrong@example.invalid'});
  await rejectBinding('',{user_id:other});
  await rejectBinding(`update auth.users set email_confirmed_at=null where id='${u}';`);
  await rejectBinding('',{mitigation:''});
  await rejectBinding('',{retired_factor_id:factor});
  await rejectBinding(`insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values('${retired}','${u}','totp','verified',now(),now());`);
  await rejectBinding(`update auth.mfa_factors set status='unverified' where id='${factor}';`);
  await rejectBinding(`update auth.sessions set aal='aal1' where id='${session}';`);
  await rejectBinding(`update auth.sessions set not_after=now()-interval '1 minute' where id='${session}';`);
  await rejectBinding(`insert into public.team_profiles(id,full_name) values('${u}','Unexpected local profile');`);
  await rejectBinding(`insert into public.role_permissions select r.id,p.id from public.roles r,public.permissions p where r.code='content_community_lead' and p.code='team.manage';`);
  await rejectBinding(`create function pg_temp.reject_test_audit() returns trigger language plpgsql as $$begin raise exception 'Synthetic audit failure'; end;$$;
    create trigger reject_test_audit before insert on public.audit_logs for each row execute function pg_temp.reject_test_audit();`);
  // A caller cannot run the admin script or self-promote through ordinary grants.
  await rejectBinding('set local role authenticated;');
  await localSql(`begin;${fixture}commit;`);created=true;
  const raced=await Promise.allSettled([localSql(params()+bind),localSql(params()+bind)]);
  eq(raced.filter(x=>x.status==='fulfilled').length,1);
  eq(await localScalar(`select count(*) from public.team_role_assignments a join public.roles r on r.id=a.role_id where user_id='${u}' and r.code='content_community_lead';`),'1');
  const audit=await localScalar(`select id from public.audit_logs where metadata->>'test_run'='${run}' and action='test.staff_binding';`);
  assert.match(audit,/^[a-f0-9-]{36}$/);assertions++;
  const cleanup=extra=>params({binding_audit_id:audit,cleanup_approval:'local-only-cleanup',...extra})+unbind;
  await assert.rejects(localSql(cleanup({user_id:other})));assertions++;
  await assert.rejects(localSql(cleanup({email:'wrong@example.invalid'})));assertions++;
  await assert.rejects(localSql(cleanup({binding_audit_id:randomUUID()})));assertions++;
  await assert.rejects(localSql(`begin;insert into public.team_role_assignments select '${u}',id from public.roles where code='technical_lead';${cleanup({})}`));assertions++;
  eq(await localScalar(`select count(*) from public.team_role_assignments where user_id='${u}';`),'1');
  await assert.rejects(localSql(`begin;create function pg_temp.reject_cleanup_audit() returns trigger language plpgsql as $$begin raise exception 'Synthetic cleanup audit failure';end;$$;
    create trigger reject_cleanup_audit before insert on public.audit_logs for each row execute function pg_temp.reject_cleanup_audit();${cleanup({})}`));assertions++;
  eq(await localScalar(`select count(*) from public.team_profiles where id='${u}';`),'1');
  const cleanupRace=await Promise.allSettled([localSql(cleanup({})),localSql(cleanup({}))]);
  eq(cleanupRace.filter(x=>x.status==='fulfilled').length,1);
  eq(await localScalar(`select count(*) from public.team_profiles where id='${u}';`),'0');
  eq(await localScalar(`select count(*) from public.team_role_assignments where user_id='${u}';`),'0');
  eq(await localScalar(`select count(*) from auth.users where id='${u}';`),'1'); // Separate Auth operation, never implicit.
  eq(await localScalar(`select count(*) from public.audit_logs where metadata->>'test_run'='${run}';`),'2');
  eq(await localScalar("select concat((select count(*) from public.roles),':',(select count(*) from public.permissions),':',(select count(*) from public.role_permissions));"),'4:18:31');
  console.log(`PASS: ${assertions} real local binding/cleanup assertions; rollback, exact identity/factor/role, retained audit and concurrency 1/2 for each transaction.`);
} catch {console.error('Local content-role transaction test failed; raw SQL and identifiers suppressed.');process.exitCode=1;}
finally {
  if(created) await localSql(`delete from public.audit_logs where metadata->>'test_run'='${run}' and resource_id='${u}';delete from auth.users where id='${u}' and email='${email}';`);
}
