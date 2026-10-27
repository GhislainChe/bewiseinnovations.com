-- PREPARATION ONLY. Not a migration/RPC. Separate explicit hosted approval required.
-- Administrative channel sets bewise.permission_test_{user_id,email,run,approval,
-- factor_id,retired_factor_id,mitigation} on this connection using bound values.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
do $binding$
declare
  u uuid := nullif(current_setting('bewise.permission_test_user_id',true),'')::uuid;
  e text := nullif(current_setting('bewise.permission_test_email',true),'');
  run_id text := nullif(current_setting('bewise.permission_test_run',true),'');
  approval text := nullif(current_setting('bewise.permission_test_approval',true),'');
  factor uuid := nullif(current_setting('bewise.permission_test_factor_id',true),'')::uuid;
  retired uuid := nullif(current_setting('bewise.permission_test_retired_factor_id',true),'')::uuid;
  mitigation text := nullif(current_setting('bewise.permission_test_mitigation',true),'');
  v_role_id uuid;
begin
  if current_user <> 'postgres' or u is null or e is null or e <> btrim(e)
     or run_id is null or run_id !~ '^permission-test-[a-f0-9-]{36}$'
     or approval is null or btrim(approval) = '' or length(approval)>200
     or factor is null or retired is null or factor=retired
     or mitigation is null or btrim(mitigation) = '' or length(mitigation)>200 then
    raise exception 'Reviewed test identity, approval and factor mitigation required';
  end if;
  lock table public.team_profiles, public.team_role_assignments in share row exclusive mode;
  lock table public.roles, public.permissions, public.role_permissions in share mode;
  perform 1 from auth.users where id=u and lower(email)=lower(e)
    and email_confirmed_at is not null and role='authenticated'
    and not coalesce(is_super_admin,false) for update;
  if not found or (select count(*) from auth.users where lower(email)=lower(e))<>1 then
    raise exception 'Confirmed exact Auth identity required';
  end if;
  if exists(select from public.team_profiles) or exists(select from public.team_role_assignments)
     or exists(select from public.audit_logs where metadata->>'test_run'=run_id) then
    raise exception 'Unexpected team state or reused test run';
  end if;
  -- An approval string is NOT proof that a seed is private. The operator must
  -- separately attest mitigation; these metadata checks enforce its boundaries.
  if exists(select from auth.mfa_factors where id=retired)
     or (select count(*) from auth.mfa_factors where user_id=u)<>1 then
    raise exception 'Retired factor or unexpected additional enrollment remains';
  end if;
  perform 1 from auth.mfa_factors where id=factor and user_id=u
    and factor_type='totp' and status='verified' for share;
  if not found then raise exception 'Pinned replacement verified TOTP required'; end if;
  perform 1 from auth.sessions where user_id=u and factor_id=factor and aal='aal2'
    and (not_after is null or not_after>now()) for share;
  if not found or exists(select from auth.sessions where user_id=u
    and (factor_id is distinct from factor or aal is distinct from 'aal2'::auth.aal_level
      or (not_after is not null and not_after<=now()))) then
    raise exception 'Fresh replacement-factor AAL2 session required; reconcile other sessions';
  end if;
  select id into strict v_role_id from public.roles where code='content_community_lead';
  if (select array_agg(p.code order by p.code) from public.role_permissions rp
      join public.permissions p on p.id=rp.permission_id where rp.role_id=v_role_id)
    is distinct from array['content.create','content.publish','content.read','content.update']::text[] then
    raise exception 'Unexpected content role permissions';
  end if;
  insert into public.team_profiles(id,full_name,is_active)
    values(u,'Disposable permission test '||run_id,true);
  insert into public.team_role_assignments(user_id,role_id) values(u,v_role_id);
  insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
    values(null,'test.staff_binding','team_profile',u::text,jsonb_build_object(
      'test_run',run_id,'approval_reference',approval,'mitigation_reference',mitigation,
      'role_code','content_community_lead','factor_id',factor,'performed_via','reviewed_admin_sql'));
end;
$binding$;
commit;
