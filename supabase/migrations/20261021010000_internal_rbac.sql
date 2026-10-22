-- Stage 2B: internal identities, authorization catalog, and audit storage.
-- All client mutations are deliberately closed until a reviewed server workflow exists.
-- Apply only after comparing this migration with the remote public schema.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table public.team_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_profiles_full_name_valid
    check (full_name = pg_catalog.btrim(full_name) and pg_catalog.length(full_name) between 1 and 200)
);

create table public.roles (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  constraint roles_code_valid
    check (code ~ '^[a-z][a-z0-9_]*$' and pg_catalog.length(code) <= 64),
  constraint roles_name_valid
    check (name = pg_catalog.btrim(name) and pg_catalog.length(name) between 1 and 120),
  constraint roles_description_valid
    check (description is null or pg_catalog.length(description) <= 1000)
);

create table public.permissions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  code text not null unique,
  description text,
  constraint permissions_code_valid
    check (code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and pg_catalog.length(code) <= 128),
  constraint permissions_description_valid
    check (description is null or pg_catalog.length(description) <= 1000)
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.team_role_assignments (
  user_id uuid not null references public.team_profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  primary key (user_id, role_id)
);

create table public.audit_logs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  actor_id uuid references public.team_profiles (id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_valid
    check (action = pg_catalog.btrim(action) and pg_catalog.length(action) between 1 and 128),
  constraint audit_logs_resource_type_valid
    check (resource_type is null or (resource_type = pg_catalog.btrim(resource_type) and pg_catalog.length(resource_type) between 1 and 100)),
  constraint audit_logs_resource_id_valid
    check (resource_id is null or (resource_id = pg_catalog.btrim(resource_id) and pg_catalog.length(resource_id) between 1 and 255)),
  constraint audit_logs_metadata_object check (pg_catalog.jsonb_typeof(metadata) = 'object')
);

create index role_permissions_permission_role_idx
  on public.role_permissions (permission_id, role_id);
create index team_role_assignments_role_user_idx
  on public.team_role_assignments (role_id, user_id);
create index audit_logs_created_at_idx
  on public.audit_logs (created_at desc);
create index audit_logs_actor_created_at_idx
  on public.audit_logs (actor_id, created_at desc) where actor_id is not null;
create index audit_logs_resource_created_at_idx
  on public.audit_logs (resource_type, resource_id, created_at desc)
  where resource_type is not null;

create function app_private.touch_team_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger team_profiles_updated_at
before update on public.team_profiles
for each row execute function app_private.touch_team_profile_updated_at();

-- These helpers only return facts about the authenticated caller. The migration
-- owner must retain BYPASSRLS so the lookups do not recurse through table policies.
create function app_private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_profiles as profile
    where profile.id = (select auth.uid())
      and profile.is_active
  );
$$;

create function app_private.has_permission(required_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_profiles as profile
    join public.team_role_assignments as assignment on assignment.user_id = profile.id
    join public.role_permissions as grant_entry on grant_entry.role_id = assignment.role_id
    join public.permissions as permission on permission.id = grant_entry.permission_id
    where profile.id = (select auth.uid())
      and profile.is_active
      and permission.code = required_code
  );
$$;

revoke execute on all functions in schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_active_staff() to authenticated;
grant execute on function app_private.has_permission(text) to authenticated;

alter table public.team_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.team_role_assignments enable row level security;
alter table public.audit_logs enable row level security;

-- Supabase can auto-grant new public tables. Reset explicit grants here so no
-- anonymous or authenticated role can write through the Data API.
revoke all on public.team_profiles, public.roles, public.permissions,
  public.role_permissions, public.team_role_assignments, public.audit_logs
  from public, anon, authenticated;
grant select on public.team_profiles, public.roles, public.permissions,
  public.role_permissions, public.team_role_assignments, public.audit_logs
  to authenticated;

create policy team_profiles_staff_select
on public.team_profiles for select to authenticated
using (
  (id = (select auth.uid()) and (select app_private.is_active_staff()))
  or (select app_private.has_permission('team.read'))
);

create policy roles_active_staff_select
on public.roles for select to authenticated
using ((select app_private.is_active_staff()));

create policy permissions_active_staff_select
on public.permissions for select to authenticated
using ((select app_private.is_active_staff()));

create policy role_permissions_active_staff_select
on public.role_permissions for select to authenticated
using ((select app_private.is_active_staff()));

create policy team_role_assignments_staff_select
on public.team_role_assignments for select to authenticated
using (
  (user_id = (select auth.uid()) and (select app_private.is_active_staff()))
  or (select app_private.has_permission('team.read'))
);

create policy audit_logs_authorized_select
on public.audit_logs for select to authenticated
using (
  (select app_private.has_permission('audit.read'))
  or (
    resource_type = 'technical'
    and (select app_private.has_permission('audit.technical.read'))
  )
);

comment on schema app_private is 'Internal RLS helpers; never expose via the Data API';
comment on table public.team_role_assignments is
  'Multiple roles are supported; an eventual controlled provisioning workflow enforces the initial one-role-per-founder rule.';
comment on table public.audit_logs is
  'Append-only through a future trusted server workflow; ordinary authenticated users have SELECT only.';
