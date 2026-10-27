import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { localSql,localScalar } from './local-database.mjs';
const canonical=readFileSync('supabase/admin/bootstrap-platform-owner.sql','utf8');
const users=[randomUUID(),randomUUID()];
const approval=`local-bootstrap-${randomUUID()}`;
const fixture=(id,status='verified')=>`insert into auth.users(id,email,email_confirmed_at,role) values('${id}','${id}@example.invalid',now(),'authenticated');
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values('${id}','${id}','totp','${status}',now(),now());`;
const inputs=id=>`select set_config('bewise.bootstrap_user_id','${id}',false);select set_config('bewise.bootstrap_email','${id}@example.invalid',false);select set_config('bewise.bootstrap_approval','${approval}',false);`;
let created=false,assertions=0;
async function denied(prefix,suffix='') {
  await assert.rejects(localSql(`begin; ${prefix} ${canonical} ${suffix}`));assertions++;
  assert.equal(await localScalar('select count(*) from public.team_profiles;'),'0');assertions++;
}
try {
  assert.equal(await localScalar('select count(*) from public.team_profiles;'),'0','Local team data exists; stop');
  assert.equal(await localScalar("select count(*) from public.audit_logs where action='platform_owner.bootstrap';"),'0','Existing owner evidence; stop');
  await denied('');
  await denied(fixture(users[0])+inputs(users[0])+"select set_config('bewise.bootstrap_email','wrong@example.invalid',false);");
  await denied(fixture(users[0])+inputs(users[1]));
  await denied(fixture(users[0])+inputs(users[0])+`update auth.users set email_confirmed_at=null where id='${users[0]}';`);
  await denied(fixture(users[0],'unverified')+inputs(users[0]));
  await denied(fixture(users[0])+inputs(users[0])+`delete from auth.mfa_factors where user_id='${users[0]}';`);
  await denied(fixture(users[0])+inputs(users[0])+`insert into public.team_profiles(id,full_name) values('${users[0]}','Unexpected local staff');`);
  await denied(fixture(users[0])+inputs(users[0])+"delete from public.role_permissions where role_id=(select id from public.roles where code='platform_owner') and permission_id=(select id from public.permissions where code='technical.manage');");
  await denied(fixture(users[0])+inputs(users[0])+"delete from public.role_permissions where role_id=(select id from public.roles where code='platform_owner');delete from public.roles where code='platform_owner';");
  await denied(fixture(users[0])+inputs(users[0])+"insert into public.audit_logs(action) values('platform_owner.bootstrap');");
  // Force failure AFTER profile and assignment inserts; outer transaction restores trigger/catalog.
  await denied(fixture(users[0])+inputs(users[0])+`create function pg_temp.reject_bootstrap() returns trigger language plpgsql as $$begin raise exception 'Local injected audit failure';end;$$;
create trigger local_bootstrap_audit_failure before insert on public.audit_logs for each row execute function pg_temp.reject_bootstrap();`);
  assert.equal(await localScalar(`select count(*) from public.team_role_assignments where user_id='${users[0]}';`),'0');assertions++;
  assert.equal(await localScalar(`select count(*) from public.audit_logs where resource_id='${users[0]}';`),'0');assertions++;
  await localSql('begin;'+users.map(id=>fixture(id)).join('\n')+'commit;');created=true;
  const outcomes=await Promise.allSettled(users.map(id=>localSql(inputs(id)+canonical)));
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assertions++;
  assert.equal(outcomes.filter(r=>r.status==='rejected').length,1);assertions++;
  assert.equal(await localScalar('select count(*) from public.team_profiles;'),'1');assertions++;
  assert.equal(await localScalar("select count(*) from public.team_role_assignments a join public.roles r on r.id=a.role_id where r.code='platform_owner';"),'1');assertions++;
  assert.equal(await localScalar(`select count(*) from public.audit_logs where action='platform_owner.bootstrap' and metadata->>'approval_reference'='${approval}';`),'1');assertions++;
  const winner=await localScalar('select id from public.team_profiles limit 1;');
  await assert.rejects(localSql(inputs(winner)+canonical));assertions++;
  console.log(`PASS: ${assertions} local bootstrap assertions; guards, injected audit rollback, exact role/audit, and concurrent first-owner winner 1/2.`);
} catch {console.error('Local bootstrap test failed; raw SQL, identifiers and errors suppressed.');process.exitCode=1;}
finally {
  if(created) {
    await localSql(`delete from public.audit_logs where resource_id in ('${users[0]}','${users[1]}') and metadata->>'approval_reference'='${approval}';
delete from auth.users where id in ('${users[0]}','${users[1]}') and email in ('${users[0]}@example.invalid','${users[1]}@example.invalid');`);
  }
}
