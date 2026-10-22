-- Execute only against a disposable LOCAL Supabase stack after migrations.
-- Synthetic, email-free Auth rows exist only inside this rolled-back transaction.
begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(42);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000000006');

insert into public.team_profiles (id, full_name, is_active) values
  ('00000000-0000-4000-8000-000000000001', 'Test Owner', true),
  ('00000000-0000-4000-8000-000000000002', 'Test Technical Lead', true),
  ('00000000-0000-4000-8000-000000000003', 'Test Operations Lead', true),
  ('00000000-0000-4000-8000-000000000004', 'Test Content Lead', true),
  ('00000000-0000-4000-8000-000000000005', 'Test Inactive Staff', false),
  ('00000000-0000-4000-8000-000000000006', 'Test Unassigned Staff', true);

insert into public.team_role_assignments (user_id, role_id)
select fixture.user_id, role.id
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'platform_owner'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'technical_lead'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'operations_lead'),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'content_community_lead'),
  ('00000000-0000-4000-8000-000000000005'::uuid, 'platform_owner')
) as fixture (user_id, role_code)
join public.roles as role on role.code = fixture.role_code;

insert into public.audit_logs (actor_id, action, resource_type) values
  ('00000000-0000-4000-8000-000000000001', 'technical.change', 'technical'),
  ('00000000-0000-4000-8000-000000000001', 'inquiry.review', 'inquiry');

select extensions.is((select count(*) from public.roles), 4::bigint, 'exactly four roles are seeded');
select extensions.is((select count(*) from public.permissions), 18::bigint, 'exactly 18 permissions are seeded');
select extensions.is((select count(*) from public.role_permissions), 31::bigint, 'exactly 31 role grants are seeded');
select extensions.is(
  (select pg_catalog.string_agg(permission.code, ',' order by permission.code)
   from public.role_permissions as grant_entry
   join public.roles as role on role.id = grant_entry.role_id
   join public.permissions as permission on permission.id = grant_entry.permission_id
   where role.code = 'platform_owner'),
  'audit.read,audit.technical.read,content.create,content.publish,content.read,content.update,inquiries.manage,inquiries.read,registrations.manage,registrations.read,roles.assign,settings.manage,team.manage,team.read,technical.manage,technical.read,waitlists.manage,waitlists.read',
  'owner has exactly the approved permission set'
);
select extensions.is(
  (select pg_catalog.string_agg(permission.code, ',' order by permission.code)
   from public.role_permissions as grant_entry
   join public.roles as role on role.id = grant_entry.role_id
   join public.permissions as permission on permission.id = grant_entry.permission_id
   where role.code = 'technical_lead'),
  'audit.technical.read,technical.manage,technical.read',
  'technical lead has exactly the approved permission set'
);
select extensions.is(
  (select pg_catalog.string_agg(permission.code, ',' order by permission.code)
   from public.role_permissions as grant_entry
   join public.roles as role on role.id = grant_entry.role_id
   join public.permissions as permission on permission.id = grant_entry.permission_id
   where role.code = 'operations_lead'),
  'inquiries.manage,inquiries.read,registrations.manage,registrations.read,waitlists.manage,waitlists.read',
  'operations lead has exactly the approved permission set'
);
select extensions.is(
  (select pg_catalog.string_agg(permission.code, ',' order by permission.code)
   from public.role_permissions as grant_entry
   join public.roles as role on role.id = grant_entry.role_id
   join public.permissions as permission on permission.id = grant_entry.permission_id
   where role.code = 'content_community_lead'),
  'content.create,content.publish,content.read,content.update',
  'content lead has exactly the approved permission set'
);
select extensions.ok(
  not pg_catalog.has_function_privilege('anon', 'app_private.has_permission(text)', 'EXECUTE'),
  'anonymous cannot execute the permission helper'
);
select extensions.ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.team_role_assignments', 'INSERT'),
  'authenticated clients have no role-assignment insert grant'
);

set local role anon;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select extensions.throws_ok($$select count(*) from public.team_profiles$$, '42501', null, 'anonymous cannot read team profiles');
select extensions.throws_ok($$select count(*) from public.team_role_assignments$$, '42501', null, 'anonymous cannot read role assignments');
select extensions.throws_ok($$select count(*) from public.audit_logs$$, '42501', null, 'anonymous cannot read audit logs');
select extensions.throws_ok($$select count(*) from public.roles$$, '42501', null, 'anonymous cannot read the role catalog');

reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select extensions.is((select count(*) from public.team_profiles), 6::bigint, 'owner can read team profiles');
select extensions.is((select count(*) from public.team_role_assignments), 5::bigint, 'owner can read team assignments');
select extensions.is((select count(*) from public.audit_logs), 2::bigint, 'owner can read all audit records');
select extensions.ok(app_private.has_permission('team.manage'), 'owner has account management permission');
select extensions.throws_ok(
  $$insert into public.team_role_assignments (user_id, role_id)
      select '00000000-0000-4000-8000-000000000001'::uuid, id
      from public.roles where code = 'technical_lead'$$,
  '42501', null, 'even owner cannot assign a role through the client connection'
);
select extensions.throws_ok(
  $$update public.audit_logs set action = 'changed' where resource_type = 'technical'$$,
  '42501', null, 'ordinary client cannot update audit records'
);
select extensions.throws_ok(
  $$delete from public.audit_logs where resource_type = 'technical'$$,
  '42501', null, 'ordinary client cannot delete audit records'
);

select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select extensions.is((select count(*) from public.team_profiles), 1::bigint, 'technical lead reads only their profile');
select extensions.is((select count(*) from public.team_role_assignments), 1::bigint, 'technical lead reads only their assignment');
select extensions.is((select count(*) from public.audit_logs), 1::bigint, 'technical lead reads technical audit only');
select extensions.ok(app_private.has_permission('technical.manage'), 'technical lead has technical operations permission');
select extensions.ok(not app_private.has_permission('inquiries.read'), 'technical lead lacks private inquiries permission');
select extensions.ok(not app_private.has_permission('team.manage'), 'technical lead lacks team management permission');

select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select extensions.is((select count(*) from public.team_profiles), 1::bigint, 'operations lead reads only their profile');
select extensions.is((select count(*) from public.audit_logs), 0::bigint, 'operations lead cannot read audit logs');
select extensions.ok(app_private.has_permission('inquiries.read'), 'operations lead has inquiries permission');
select extensions.ok(not app_private.has_permission('team.manage'), 'operations lead lacks team management permission');
select extensions.throws_ok(
  $$insert into public.team_role_assignments (user_id, role_id)
      select '00000000-0000-4000-8000-000000000003'::uuid, id
      from public.roles where code = 'platform_owner'$$,
  '42501', null, 'operations lead cannot promote themselves'
);

select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select extensions.is((select count(*) from public.team_profiles), 1::bigint, 'content lead reads only their profile');
select extensions.is((select count(*) from public.audit_logs), 0::bigint, 'content lead cannot read audit logs');
select extensions.ok(app_private.has_permission('content.publish'), 'content lead has content publishing permission');
select extensions.ok(not app_private.has_permission('inquiries.read'), 'content lead lacks private inquiries permission');
select extensions.throws_ok(
  $$update public.team_profiles set full_name = 'Promoted' where id = '00000000-0000-4000-8000-000000000004'$$,
  '42501', null, 'content lead cannot update even their own team profile through the client'
);

select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select extensions.is((select count(*) from public.team_profiles), 0::bigint, 'inactive staff cannot read profiles');
select extensions.is((select count(*) from public.roles), 0::bigint, 'inactive staff cannot read the role catalog');
select extensions.ok(not app_private.has_permission('team.read'), 'inactive owner assignment gives no permission');

select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select extensions.is((select count(*) from public.team_profiles), 1::bigint, 'active unassigned staff can read their own profile');
select extensions.is((select count(*) from public.team_role_assignments), 0::bigint, 'unassigned staff has no role assignment');
select extensions.ok(not app_private.has_permission('team.read'), 'unassigned staff has no team permission');

select * from extensions.finish();
rollback;
