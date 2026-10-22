# Stage 2D.1 — first Platform Owner preparation

**Target:** Supabase project `onfxxtvfprjnqsxdmhkp`. **Status:** preparation
only. No Auth user, profile, assignment, or audit row was created in this stage.
This procedure requires a separate, explicit approval to execute.

## Readiness gates

Read-only checks on 2026-10-23 found global signup disabled, email sign-in
enabled, email confirmation required, anonymous sign-in disabled, and TOTP
enrollment/verification available. Hosted password minimum length was **6**,
Site URL was **`http://localhost:3000`**, and redirect allowlist was empty.
Password character policy and invitation/recovery delivery were not verified.
TOTP availability does not enforce MFA.

Before inviting the owner, an authorized project administrator must review and
separately approve corrections in Dashboard:

1. **Authentication > Security and Protection > Password Security:** increase
   the minimum to at least 12 characters, confirm the character/leaked-password
   policy and applicable plan support. Document the actual setting.
2. **Authentication > URL Configuration:** replace the localhost Site URL with
   the reviewed owned destination for invitation/recovery links. Add only exact
   trusted callback URLs after a secure callback exists. No such website route
   exists yet; do not send an invite that redirects to an unimplemented page.
3. **Authentication > Email > Templates** and **Authentication > Emails > SMTP
   Settings:** review invite/recovery templates, sender, SMTP provider, quotas,
   and controlled delivery. Do not treat the default mail service as verified.
4. **Authentication > Security and Protection > Multi-Factor Authentication:**
   confirm TOTP is enabled. Enroll the owner in a trusted authenticator after
   invitation acceptance; later privileged operations should enforce AAL2.
5. Reconfirm signup/confirmation/provider settings and the linked project ref.

No one should send a real invitation until these gates and a separate account
creation approval are complete. Never share passwords, invitation links, OTPs,
service-role keys, or database credentials in chat or source control.

## Identity and Auth account (separate approved operation)

1. Independently verify that the person is **Ndong Ghislain Che** and confirm
   the actual email address through a trusted out-of-band channel. The email is
   intentionally absent from this repository.
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
   and the planned `platform_owner` binding. The account remains without staff
   access until the next transaction commits.

## One-time binding transaction (reviewed template; do not execute yet)

Run only in the **SQL Editor of the confirmed project** as a trusted database
administrator, after separate explicit approval for this write. Replace the
three `NULL` inputs with the verified UUID, verified email, and non-secret
approval reference. Keep the input values out of committed files. Check the
selected project and preview the Auth user before running the transaction.
The transaction fails closed if inputs are missing, the email/UUID do not match
one confirmed Auth user, any owner or target profile/assignment already exists,
or the seeded role is missing. A failure rolls back profile, assignment, and
audit together. Database administrators should retain an access-controlled
record of the approval and execution result.

```sql
begin;

do $bootstrap$
declare
  v_auth_user_id uuid := null; -- replace with verified Auth UUID
  v_expected_email text := null; -- replace with verified email
  v_approval_reference text := null; -- replace with non-secret approval ID
  v_role_id uuid;
begin
  if v_auth_user_id is null or v_expected_email is null
     or pg_catalog.btrim(v_expected_email) = ''
     or v_approval_reference is null
     or pg_catalog.btrim(v_approval_reference) = '' then
    raise exception 'Missing reviewed bootstrap inputs';
  end if;

  -- Serialize concurrent bootstrap attempts; these locks release on commit.
  lock table public.team_profiles, public.team_role_assignments
    in share row exclusive mode;

  if (select count(*) from auth.users
      where id = v_auth_user_id
        and pg_catalog.lower(email) = pg_catalog.lower(v_expected_email)
        and email_confirmed_at is not null) <> 1 then
    raise exception 'Verified Auth identity does not match';
  end if;

  if exists (select 1 from public.team_profiles)
     or exists (select 1 from public.team_role_assignments) then
    raise exception 'First-owner bootstrap requires empty team tables';
  end if;

  select id into strict v_role_id
  from public.roles where code = 'platform_owner';

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
approved secure interface or controlled harness; the current app has no login
UI or callback. Confirm TOTP enrollment and establish protected recovery codes.

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

The existing 42-assertion local pgTAP suite verifies RLS denial for anon,
self-promotion denial, inactive staff denial, and intended owner permissions.
The 10 mocked Auth tests verify that an unassigned Auth user gains no staff
access. Those tests do not prove hosted email delivery or the future bootstrap
execution; the UUID/email match and empty-team guards above are the controls
against binding an unintended Auth user.
