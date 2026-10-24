// SELECT-only hosted catalog inspection. No Auth accounts or test fixtures.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
const run = promisify(execFile);
const ref = 'onfxxtvfprjnqsxdmhkp';
if (readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref) throw new Error('Unexpected project.');
let script;
try {
  ({stdout:script}=await run('cmd.exe',['/d','/s','/c','npx supabase db dump --linked --schema public --dry-run'],{timeout:45000,maxBuffer:100000}));
} catch {
  // A child-process Error may contain stdout with a temporary password.
  console.error('Unable to obtain linked connection metadata safely.');
  process.exit(1);
}
const env={...process.env,PGCONNECT_TIMEOUT:'10',PGSSLMODE:'require',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=20000 -c lock_timeout=5000'};
for(const key of ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE']) {
  const match=script.match(new RegExp(`export ${key}="([^"\\r\\n]*)"`));
  if(!match) throw new Error('Connection metadata unavailable.');
  env[key]=match[1];
}
if(!env.PGUSER.endsWith(`.${ref}`)||env.PGPORT!=='5432') throw new Error('Unexpected connection.');
const catalogSql=`set role postgres;
select json_build_object(
 'database',current_database(), 'role',current_user, 'version',current_setting('server_version'),
 'migrations',(select json_agg(version order by version) from supabase_migrations.schema_migrations),
 'tables',(select json_agg(x order by x.schema,x.name) from (
   select n.nspname as schema,c.relname as name,c.relrowsecurity as rls,
     (select count(*) from pg_catalog.pg_policy p where p.polrelid=c.oid) as policies,
     (select count(*) from (values ('anon'),('authenticated'),('service_role')) r(role)
       where pg_catalog.has_table_privilege(r.role,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) as api_roles_with_direct_privileges
   from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   where c.relkind='r' and ((n.nspname='public' and c.relname in ('team_profiles','roles','permissions','role_permissions','team_role_assignments','audit_logs'))
     or (n.nspname='app_private' and c.relname in ('auth_flow_tickets','auth_recovery_buckets')))
 ) x),
 'functions',(select json_agg(x order by x.schema,x.name) from (
   select n.nspname as schema,p.proname as name,pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
     p.prosecdef as security_definer,p.proconfig as settings,pg_catalog.pg_get_userbyid(p.proowner) as owner,
     pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
     pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
     pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
     exists(select from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute
   from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','app_private') and p.proname in ('auth_flow_store_ready','register_auth_flow_ticket','redeem_auth_flow_ticket','consume_recovery_budget')
 ) x),
 'roles',(select count(*) from public.roles), 'permissions',(select count(*) from public.permissions),
 'mappings',(select count(*) from public.role_permissions), 'profiles',(select count(*) from public.team_profiles),
 'assignments',(select count(*) from public.team_role_assignments), 'auth_users',(select count(*) from auth.users),
 'authenticator_api_settings',(select rolconfig from pg_catalog.pg_roles where rolname='authenticator')
);`;
const readySql = `set role service_role;
select json_build_object('role',current_user,
 'public_schema_usage',pg_catalog.has_schema_privilege(current_user,'public','USAGE'),
 'store_ready',public.auth_flow_store_ready());`;
const sql = process.argv.includes('--ready') ? readySql : catalogSql;
const name=`bewise-hosted-inspect-${Date.now()}`;
const args=['run','--rm','--name',name];
for(const key of ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGCONNECT_TIMEOUT','PGSSLMODE','PGOPTIONS'])args.push('--env',key);
args.push('--entrypoint','psql','public.ecr.aws/supabase/postgres:17.11.0.003','-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql);
try {
  const {stdout}=await run('docker',args,{env,timeout:60000,maxBuffer:200000});
  const start=stdout.indexOf('{');
  if(start<0) throw new Error('Catalog result missing.');
  const data=JSON.parse(stdout.slice(start).trim());
  // Print catalog/count metadata only; never provider credentials or row data.
  data.authenticator_api_settings=(data.authenticator_api_settings??[]).filter(s=>s.startsWith('pgrst.db_schemas='));
  console.log(JSON.stringify(data,null,2));
} catch (error) {
  await run('docker',['rm','-f',name],{timeout:10000}).catch(()=>{});
  console.error('Read-only hosted catalog inspection failed or timed out. No sensitive error output printed.');
  console.error(String(error.stderr??'').replaceAll(env.PGPASSWORD,'[redacted]').slice(0,1200));
  process.exitCode=1;
}
