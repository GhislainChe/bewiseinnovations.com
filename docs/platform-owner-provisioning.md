# First Platform Owner provisioning — Stage 2E.1 review

**Target:** Supabase project `onfxxtvfprjnqsxdmhkp`. **Status:** preparation
only. No Auth user, profile, assignment, or audit row was created in this stage.
This updates the Stage 2D.1 preparation guide. See the current
[readiness report](./platform-owner-readiness.md) for observed hosted state and
blocking MFA/recovery work. This procedure requires separate explicit approvals
for invitation and for role binding. It is not ready to execute today.

## Readiness gates

Read-only checks on 26 October 2026 confirmed global signup disabled, email
sign-in enabled and email confirmation required. No hosted Auth users, team
profiles or role assignments remain. Password minimum **12**, disabled anonymous
signup, custom OVHcloud SMTP and exact fragment templates were previously
configured/confirmed by the owner; not every saved setting is readable through
the public settings endpoint. Reconfirm the Dashboard gates before invitation:

1. **Authentication > Security and Protection > Password Security** (or Email
   provider settings): minimum at least 12 characters, appropriate password
   strength/leaked-password protection where supported. Do not paste passwords.
2. **Authentication > URL Configuration:** retain Site URL
   `http://localhost:3000` and exact redirect
   `http://localhost:3000/auth/confirm` for controlled local testing. Do not use
   the production domain until actually deployed and reachable. Start the
   localhost-only secure test launcher only for separately approved testing.
3. **Authentication > Email > Templates:** confirm the fragment links in the
   readiness report. **Email > SMTP Settings:** reconfirm sender/provider and
   limits without copying SMTP credentials. Previous real hosted invitation
   delivery/password setup succeeded, but delivered fragment links have not
   yet been retested through a new real email.
4. **Authentication > Multi-Factor Authentication:** confirm TOTP enrollment
   and verification enabled. Build/test a controlled enrollment and challenge
   path first; current pages do not implement it. Owner privileged operations
   require server-verified AAL2 and matching Data API/RLS enforcement, including
   denial of unenrolled owners. Neither enforcement layer exists today.
5. Reconfirm public/anonymous signup disabled, confirmation required, the
   linked project and a reviewed recovery/lockout runbook. Do not activate the
   owner until the blocking gates in the readiness report are closed.

No one should send a real invitation until these gates and a separate account
creation approval are complete. Never share passwords, invitation links, OTPs,
service-role keys, or database credentials in chat or source control.

## Identity and Auth account (separate approved operation)

1. Independently verify that the person is **Ndong Ghislain Che** and confirm
   the actual email address through a trusted out-of-band channel. The email is
   unknown and intentionally absent from this repository. Ask the owner to
   provide the exact intended mailbox privately, confirm control and its intended
   founder use, and verify it independently with the person through an existing
   trusted contact method. Do not infer it from the disposable test address,
   website domain, SMTP sender or GitHub identity. No verification mail is sent
   until specifically approved. Keep the email/UUID review record access-controlled
   and Git-ignored; commit only a non-secret approval reference.
2. An authorized Supabase project administrator checks **Authentication >
   Users** for an existing account with that exact email. If one exists, stop
   and investigate its origin and identity; never assume it belongs to the
   founder. Do not create a duplicate.
3. If none exists, use Dashboard's administrative invitation flow or a
   restricted server-only Auth Admin operation after explicit approval. Do not
   use public signup, a browser service-role key, a public bootstrap endpoint,
   or a guessed password. Verify delivery and acceptance through the approved
   redirect. Do not bind a role merely because an invitation was sent.
4. After identity and email confirmation, independently record the actual
   `auth.users.id` from the Dashboard and verify it corresponds to the exact
   approved email. A second trusted reviewer should approve the ID/email pair
   and the planned `platform_owner` binding. Complete password setup, verified
   TOTP enrollment and a fresh AAL2 challenge using a separately reviewed harness
   or future secure interface. Password setup signs out; there is no existing
   login/MFA page, so this subsequent flow still needs implementation/testing.
   The account remains without staff access until the next transaction commits.

## One-time binding transaction (reviewed template; do not execute yet)

Run only in the **SQL Editor of the confirmed project** as a trusted database
administrator, after separate explicit approval for this write. Replace the
three `NULL` inputs with the verified UUID, verified email, and non-secret
approval reference. Keep the input values out of committed files. Check the
selected project and preview the Auth user before running the transaction.
The transaction fails closed if inputs are missing, the email/UUID do not match
one confirmed ordinary Auth user, team data or a prior bootstrap event exists,
verified TOTP is absent, or the owner permission set differs from the reviewed
seed. A failure rolls back profile, assignment, and audit together. Database
administrators retain an access-controlled approval/execution record.

The revised template below has **not been executed**, even locally, in Stage
2E.1. It needs a separate local bootstrap test stage with disposable local Auth
and MFA fixtures before approval to execute against hosted data. Its TOTP check
proves enrollment only, not current-session AAL2. Server/RLS MFA enforcement and
recovery readiness are external prerequisites; SQL cannot attest application
deployment. This creates an active owner and must remain blocked until those
prerequisites are implemented and verified.

```sql
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';

do $bootstrap$
declare
  v_auth_user_id uuid := null; -- replace with verified Auth UUID
  v_expected_email text := null; -- replace with verified email
  v_approval_reference text := null; -- replace with non-secret approval ID
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
```

`actor_id` is NULL because a trusted database administrator performs the
bootstrap; attributing the write to the newly created owner would be false.
The approval reference identifies the separately retained operator record.
The SQL performs no Auth account creation. It does not trust browser metadata,
and ordinary authenticated users have no mutation grants on these tables.

## Verification and partial-failure recovery

After commit, a trusted administrator uses SELECT-only SQL to confirm exactly
one profile with the reviewed UUID and full name, exactly one assignment to
`platform_owner`, the expected role permission set, and one matching bootstrap
audit row. Confirm that no other Auth user or team row changed. Do not publish
the founder's email or Auth ID in logs. Test sign-in only through a separately
approved secure interface or controlled harness; the app has limited local
callback routes but no login/MFA interface. Verify AAL1 and missing/expired
sessions cannot perform privileged operations through either server routes or
direct Data API requests. Verify AAL2 retains only the assigned permissions.
Do not assume recovery codes exist: this application and its installed SDK have
no recovery-code workflow. Approve and test alternate-factor/emergency recovery
handling first, with secure storage and audit controls.

If invitation fails or is unaccepted, do not run the binding transaction.
Correct delivery/redirect settings through a separately approved Auth change,
then resend only after identity review. If the SQL fails, the transaction must
roll back; inspect errors and current rows before any retry. If Auth invitation
succeeds but binding does not, leave the account unprivileged and reconcile it
manually. If binding succeeds but sign-in/MFA fails, suspend account access and
investigate without adding another owner. A corrective or revocation operation
requires its own reviewed transaction and audit event; never delete evidence or
automatically promote another signup. Recovery email and lost-factor procedures
must reverify identity through a trusted administrator and preserve an audit
trail.

The existing 74-assertion local pgTAP suite verifies RLS denial for anon,
self-promotion denial, inactive staff denial, and intended owner permissions.
The 66 Auth tests include denial of unassigned Auth users and checked sign-out
failure behavior. These tests do not prove MFA enforcement, the revised bootstrap
template, recovery readiness or delivery of the new fragment templates. Test
those separately before approving first-owner privileges. No existing deployed
RBAC migration or runtime authorization code was modified for this review.
