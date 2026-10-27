-- Stage 2E.2. New local-only migration: retain permission policies and intersect MFA.
create function app_private.has_aal2_session()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select auth.jwt()->>'aal') = 'aal2'
    and case when (select auth.jwt()->>'exp') ~ '^[0-9]{1,12}$'
      then (select auth.jwt()->>'exp')::numeric > extract(epoch from now()) else false end
    and exists (
      select 1 from auth.sessions s
      join auth.mfa_factors f on f.id = s.factor_id and f.user_id = s.user_id
      where s.id = case when (select auth.jwt()->>'session_id') ~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then (select auth.jwt()->>'session_id')::uuid else null end
        and s.user_id = (select auth.uid()) and s.aal = 'aal2'
        and (s.not_after is null or s.not_after > now())
        and f.factor_type = 'totp' and f.status = 'verified'
    ), false);
$$;
revoke all on function app_private.has_aal2_session() from public, anon, authenticated, service_role;
grant execute on function app_private.has_aal2_session() to authenticated;

create policy team_profiles_mfa on public.team_profiles as restrictive for all to authenticated
using ((select app_private.has_aal2_session())) with check ((select app_private.has_aal2_session()));
create policy roles_mfa on public.roles as restrictive for all to authenticated
using ((select app_private.has_aal2_session())) with check ((select app_private.has_aal2_session()));
create policy permissions_mfa on public.permissions as restrictive for all to authenticated
using ((select app_private.has_aal2_session())) with check ((select app_private.has_aal2_session()));
create policy role_permissions_mfa on public.role_permissions as restrictive for all to authenticated
using ((select app_private.has_aal2_session())) with check ((select app_private.has_aal2_session()));
create policy team_role_assignments_mfa on public.team_role_assignments as restrictive for all to authenticated
using ((select app_private.has_aal2_session())) with check ((select app_private.has_aal2_session()));
create policy audit_logs_mfa on public.audit_logs as restrictive for all to authenticated
using ((select app_private.has_aal2_session())) with check ((select app_private.has_aal2_session()));

comment on function app_private.has_aal2_session() is
  'Read-only current caller assurance check. JWT signature verified by API gateway; session and factor must still exist. No membership grant.';
