-- Run only in the Dashboard SQL Editor for project onfxxtvfprjnqsxdmhkp.
-- Read-only catalog inspection; share object names/counts, never credentials.
select current_database() as database_name, current_setting('server_version') as postgres_version;

select n.nspname as schema_name
from pg_catalog.pg_namespace n
where n.nspname in ('public', 'app_private', 'auth', 'supabase_migrations')
order by n.nspname;

select n.nspname as schema_name, c.relname as object_name, c.relkind, c.relrowsecurity
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'app_private')
  and c.relkind in ('r', 'p', 'v', 'm', 'S')
order by n.nspname, c.relname;

select n.nspname as schema_name, p.proname as function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'app_private')
order by n.nspname, p.proname;

select n.nspname as schema_name, c.relname as table_name, t.tgname as trigger_name
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'app_private') and not t.tgisinternal
order by n.nspname, c.relname, t.tgname;

select schemaname, tablename, policyname, roles, cmd
from pg_catalog.pg_policies
where schemaname in ('public', 'app_private')
order by schemaname, tablename, policyname;

select n.nspname as schema_name, t.typname as type_name
from pg_catalog.pg_type t
join pg_catalog.pg_namespace n on n.oid = t.typnamespace
where n.nspname in ('public', 'app_private')
  and t.typtype in ('d', 'e', 'c')
order by n.nspname, t.typname;

select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema in ('public', 'app_private')
  and grantee in ('anon', 'authenticated')
order by table_schema, table_name, grantee, privilege_type;

select version from supabase_migrations.schema_migrations order by version;
