// Bounded SELECT-only inspection. Never accepts SQL or a target from arguments.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
const run = promisify(execFile);
const ref = 'onfxxtvfprjnqsxdmhkp';
if (readFileSync('supabase/.temp/project-ref','utf8').trim() !== ref) throw new Error('Wrong linked project');
let metadata;
try {
  ({stdout:metadata} = await run('cmd.exe',['/d','/s','/c','npx supabase db dump --linked --schema public --dry-run'],{timeout:45000,maxBuffer:100000}));
} catch { console.error('Connection metadata unavailable; no hosted changes attempted.'); process.exit(1); }
const env = {...process.env,PGCONNECT_TIMEOUT:'10',PGSSLMODE:'require',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=20000 -c lock_timeout=5000'};
for (const key of ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE']) {
  const m=metadata.match(new RegExp(`export ${key}="([^"\\r\\n]*)"`));
  if(!m) throw new Error('Connection metadata incomplete'); env[key]=m[1];
}
if(!env.PGUSER.endsWith(`.${ref}`)||!env.PGHOST.endsWith('.pooler.supabase.com')||env.PGPORT!=='5432'||env.PGDATABASE!=='postgres') throw new Error('Unexpected database identity');
const sql=`begin read only;set local role postgres;
select json_build_object(
 'project','${ref}','database',current_database(),'effective_role',current_user,
 'postgres_version',current_setting('server_version'),'read_only',current_setting('transaction_read_only'),
 'policy_resolution',json_build_object('search_path',current_setting('search_path'),
   'uid_functions',(select json_agg(json_build_object('oid',p.oid,'schema',n.nspname,'name',p.proname,
     'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),
     'visible',pg_function_is_visible(p.oid)) order by n.nspname,p.oid)
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='uid'),
   'policies',(select json_agg(json_build_object('schema',n.nspname,'table',c.relname,'name',p.polname,
     'functions',(select coalesce(json_agg(json_build_object('oid',f.oid,'schema',ns.nspname,'name',f.proname,
       'arguments',pg_get_function_identity_arguments(f.oid)) order by ns.nspname,f.proname,f.oid),'[]'::json)
       from pg_depend d join pg_proc f on f.oid=d.refobjid join pg_namespace ns on ns.oid=f.pronamespace
       where d.classid='pg_policy'::regclass and d.objid=p.oid and d.refclassid='pg_proc'::regclass)) order by n.nspname,c.relname,p.polname)
     from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
     where n.nspname in ('public','app_private'))),
 'migrations',(select json_agg(version order by version) from supabase_migrations.schema_migrations),
 'tables',(select json_agg(json_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,
   'owner',pg_get_userbyid(c.relowner),'anon_select',has_table_privilege('anon',c.oid,'SELECT'),
   'authenticated_select',has_table_privilege('authenticated',c.oid,'SELECT'),
   'authenticated_write',has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
   'service_direct',has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) order by n.nspname,c.relname)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('public','app_private')),
 'policies',(select json_agg(json_build_object('schema',schemaname,'table',tablename,'name',policyname,'mode',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check) order by schemaname,tablename,policyname)
   from pg_policies where schemaname in ('public','app_private')),
 'functions',(select json_agg(json_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
   'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,
   'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE'),
   'public_execute',exists(select from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'),
   'definition',pg_get_functiondef(p.oid)) order by n.nspname,p.proname)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private')),
 'auth_columns',(select json_agg(json_build_object('table',c.table_name,'column',c.column_name,'type',c.udt_name) order by c.table_name,c.column_name)
   from information_schema.columns c where c.table_schema='auth' and
   ((c.table_name='sessions' and c.column_name in ('id','user_id','factor_id','aal','not_after')) or
    (c.table_name='mfa_factors' and c.column_name in ('id','user_id','factor_type','status')))),
 'auth_enums',(select json_agg(json_build_object('type',t.typname,'value',e.enumlabel) order by t.typname,e.enumsortorder)
   from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='auth' and t.typname in ('aal_level','factor_type','factor_status')),
 'postgres_bypassrls',(select rolbypassrls from pg_roles where rolname='postgres'),
 'private_schema_grants',(select json_agg(json_build_object('role',r.name,'usage',has_schema_privilege(r.name,'app_private','USAGE'),'create',has_schema_privilege(r.name,'app_private','CREATE'))) from (values('anon'),('authenticated'),('service_role')) r(name)),
 'postgres_auth_select',has_table_privilege('postgres','auth.sessions','SELECT') and has_table_privilege('postgres','auth.mfa_factors','SELECT'),
 'role_permissions',(select json_object_agg(code,permissions) from (select r.code,array_agg(p.code order by p.code) as permissions from public.roles r
   join public.role_permissions rp on rp.role_id=r.id join public.permissions p on p.id=rp.permission_id group by r.code) x),
 'counts',json_build_object('roles',(select count(*) from public.roles),'permissions',(select count(*) from public.permissions),'mappings',(select count(*) from public.role_permissions),
   'profiles',(select count(*) from public.team_profiles),'assignments',(select count(*) from public.team_role_assignments),'auth_users',(select count(*) from auth.users)),
 'api_schema_settings',(select json_agg(setting) from (select unnest(rolconfig) setting from pg_roles where rolname='authenticator'
   union all select unnest(setconfig) from pg_db_role_setting) x where setting like 'pgrst.db_schemas=%')
);commit;`;
const container=`bewise-mfa-readonly-${Date.now()}`;
const args=['run','--rm','--name',container];
for(const key of ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGCONNECT_TIMEOUT','PGSSLMODE','PGOPTIONS']) args.push('--env',key);
args.push('--entrypoint','psql','public.ecr.aws/supabase/postgres:17.11.0.003','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',sql);
try {
  const {stdout}=await run('docker',args,{env,timeout:60000,maxBuffer:200000});
  const data=JSON.parse(stdout.split(/\r?\n/).find(line=>line.startsWith('{')));
  if(data.read_only!=='on') throw new Error('Read-only transaction not enforced');
  const conflicts=(data.functions??[]).filter(f=>f.name==='has_aal2_session').map(f=>`${f.schema}.${f.name}`);
  for(const p of data.policies??[]) if(p.name.endsWith('_mfa')) conflicts.push(`${p.schema}.${p.table}.${p.name}`);
  // Only catalog definitions/counts. No identities, row data or credentials.
  console.log(JSON.stringify({...data,conflicts},null,2));
  if(conflicts.length) process.exitCode=2;
} catch {
  await run('docker',['rm','-f',container],{timeout:10000}).catch(()=>{});
  console.error('Bounded hosted MFA inspection incomplete; raw connection errors suppressed.'); process.exitCode=1;
}
