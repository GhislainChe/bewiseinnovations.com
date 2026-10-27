-- Reviewed administrative transaction, NOT a migration or publicly callable RPC.
-- Set the three bewise.bootstrap_* session parameters privately before execution.
-- They are NULL/missing by default and fail closed. Never execute against hosted without separate approval.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';

do $bootstrap$
declare
  v_auth_user_id uuid := nullif(current_setting('bewise.bootstrap_user_id',true),'')::uuid; -- supplied privately
  v_expected_email text := nullif(current_setting('bewise.bootstrap_email',true),''); -- supplied privately
  v_approval_reference text := nullif(current_setting('bewise.bootstrap_approval',true),''); -- supplied privately
  v_role_id uuid;
begin
  if v_auth_user_id is null or v_expected_email is null
     or pg_catalog.btrim(v_expected_email) = ''
     or v_expected_email <> pg_catalog.btrim(v_expected_email)
     or v_approval_reference is null
     or pg_catalog.btrim(v_approval_reference) = '' then
    raise exception 'Missing reviewed bootstrap inputs';
  end if;

  -- Serialize concurrent bootstrap attempts; these locks release on commit.
  lock table public.team_profiles, public.team_role_assignments
    in share row exclusive mode;
  lock table public.roles, public.permissions, public.role_permissions
    in share mode;

  -- Lock the selected identity so concurrent email/deletion changes cannot
  -- make the reviewed UUID/email pair stale within this transaction.
  perform 1 from auth.users
      where id = v_auth_user_id
        and pg_catalog.lower(email) = pg_catalog.lower(v_expected_email)
        and email_confirmed_at is not null
        and role = 'authenticated' and not coalesce(is_super_admin, false)
      for update;
  if not found then
    raise exception 'Verified Auth identity does not match';
  end if;
  if (select count(*) from auth.users
      where pg_catalog.lower(email) = pg_catalog.lower(v_expected_email)) <> 1 then
    raise exception 'Ambiguous Auth email';
  end if;

  if exists (select 1 from public.team_profiles)
     or exists (select 1 from public.team_role_assignments) then
    raise exception 'First-owner bootstrap requires empty team tables';
  end if;
  if exists (select 1 from public.audit_logs
             where action = 'platform_owner.bootstrap') then
    raise exception 'A prior first-owner bootstrap is recorded';
  end if;

  -- Never read or output factor secrets. Enrollment does not replace an AAL2
  -- challenge or the future server/database MFA enforcement prerequisites.
  perform 1 from auth.mfa_factors
    where user_id = v_auth_user_id and factor_type = 'totp'
      and status = 'verified'
    for share;
  if not found then
    raise exception 'Verified TOTP enrollment required';
  end if;

  select id into strict v_role_id
  from public.roles where code = 'platform_owner';

  if (select pg_catalog.array_agg(p.code order by p.code)
      from public.role_permissions rp
      join public.permissions p on p.id = rp.permission_id
      where rp.role_id = v_role_id) is distinct from array[
    'audit.read', 'audit.technical.read', 'content.create', 'content.publish',
    'content.read', 'content.update', 'inquiries.manage', 'inquiries.read',
    'registrations.manage', 'registrations.read', 'roles.assign', 'settings.manage',
    'team.manage', 'team.read', 'technical.manage', 'technical.read',
    'waitlists.manage', 'waitlists.read'
  ]::text[] then
    raise exception 'Unexpected owner permission catalog';
  end if;

  insert into public.team_profiles (id, full_name, is_active)
  values (v_auth_user_id, 'Ndong Ghislain Che', true);

  insert into public.team_role_assignments (user_id, role_id)
  values (v_auth_user_id, v_role_id);

  insert into public.audit_logs
    (actor_id, action, resource_type, resource_id, metadata)
  values
    (null, 'platform_owner.bootstrap', 'team_profile',
     v_auth_user_id::text,
     pg_catalog.jsonb_build_object(
       'approval_reference', v_approval_reference,
       'performed_via', 'reviewed_admin_sql',
       'role_code', 'platform_owner'
     ));
end;
$bootstrap$;

commit;
