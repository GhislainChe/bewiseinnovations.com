-- PREPARATION ONLY. Separate cleanup approval required. No managed Auth SQL writes.
-- Same user_id/email/run inputs, plus permission_test_binding_audit_id and
-- permission_test_cleanup_approval. Retain both minimal audit events.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
do $cleanup$
declare
  u uuid := nullif(current_setting('bewise.permission_test_user_id',true),'')::uuid;
  e text := nullif(current_setting('bewise.permission_test_email',true),'');
  run_id text := nullif(current_setting('bewise.permission_test_run',true),'');
  binding uuid := nullif(current_setting('bewise.permission_test_binding_audit_id',true),'')::uuid;
  approval text := nullif(current_setting('bewise.permission_test_cleanup_approval',true),'');
  v_role_id uuid;
begin
  if current_user<>'postgres' or u is null or e is null or e<>btrim(e)
     or run_id is null or run_id !~ '^permission-test-[a-f0-9-]{36}$'
     or binding is null or approval is null or btrim(approval)='' or length(approval)>200 then
    raise exception 'Reviewed exact cleanup inputs required';
  end if;
  lock table public.team_profiles, public.team_role_assignments in share row exclusive mode;
  lock table public.roles, public.permissions, public.role_permissions in share mode;
  perform 1 from auth.users where id=u and lower(email)=lower(e)
    and email_confirmed_at is not null for update;
  if not found then raise exception 'Cleanup identity mismatch'; end if;
  perform 1 from public.audit_logs where id=binding and action='test.staff_binding'
    and resource_id=u::text and metadata->>'test_run'=run_id
    and metadata->>'role_code'='content_community_lead' for update;
  if not found or exists(select from public.audit_logs where action='test.staff_unbinding'
    and resource_id=u::text and metadata->>'test_run'=run_id) then
    raise exception 'Missing binding evidence or cleanup already recorded';
  end if;
  select id into strict v_role_id from public.roles where code='content_community_lead';
  if not exists(select from public.team_profiles where id=u
       and full_name='Disposable permission test '||run_id)
     or (select count(*) from public.team_role_assignments where user_id=u)<>1
     or not exists(select from public.team_role_assignments a where a.user_id=u and a.role_id=v_role_id) then
    raise exception 'Unexpected profile or assignment; do not broaden cleanup';
  end if;
  delete from public.team_role_assignments where user_id=u and team_role_assignments.role_id=v_role_id;
  delete from public.team_profiles where id=u;
  insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
    values(null,'test.staff_unbinding','team_profile',u::text,jsonb_build_object(
      'test_run',run_id,'approval_reference',approval,'binding_audit_id',binding,
      'role_code','content_community_lead','performed_via','reviewed_admin_sql'));
end;
$cleanup$;
commit;
