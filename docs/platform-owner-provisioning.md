# First Platform Owner provisioning — local Stage 2E.2 verification

**Target:** Supabase project `onfxxtvfprjnqsxdmhkp`. **Status:** preparation
only for hosted Supabase. No hosted Auth user, profile, assignment or audit row
was created. Disposable local test records were created and cleaned up.
Stage 2E.2 implemented and tested MFA locally; see [MFA and recovery](./mfa-and-owner-recovery.md). The new MFA migration is NOT deployed. This updates the Stage 2D.1 preparation guide. See the current
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
   path first; Stage 2E.2 supplies minimal local sign-in/MFA pages. Owner privileged operations
   require server-verified AAL2 and matching Data API/RLS enforcement, including
   denial of unenrolled owners. Both enforcement layers are now locally implemented/tested; the new database migration is not deployed remotely.
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
   or future secure interface. Password setup signs out; the local sign-in/MFA pages support this subsequent flow, but hosted operation remains approval-gated.
   The account remains without staff access until the next transaction commits.

## One-time binding transaction (reviewed template; do not execute yet)

For a future hosted execution, use a secure administrative channel in the
confirmed project only after separate explicit approval for that write. Supply
the three private session inputs described below. Keep the input values out of committed files. Check the
selected project and preview the Auth user before running the transaction.
The transaction fails closed if inputs are missing, the email/UUID do not match
one confirmed ordinary Auth user, team data or a prior bootstrap event exists,
verified TOTP is absent, or the owner permission set differs from the reviewed
seed. A failure rolls back profile, assignment, and audit together. Database
administrators retain an access-controlled approval/execution record.

Stage 2E.2 tested the canonical transaction locally: 30 bootstrap assertions,
including concurrency and injected audit failure/rollback, plus a real local Auth
user whose TOTP was enrolled and verified through Auth APIs. Its TOTP check proves
enrollment only, not current-session AAL2. Application and database MFA checks
were separately tested locally. Hosted MFA deployment, recovery/operator review,
actual owner identity verification and separate write approvals remain prerequisites.
Do not execute it against hosted Supabase merely because local tests passed.

The canonical reviewed/tested transaction is [bootstrap-platform-owner.sql](../supabase/admin/bootstrap-platform-owner.sql).
It is an administrative script, not a migration, public function or endpoint.
Its body remains the reviewed atomic profile + exact role + audit transaction.
The only input mechanism is three session parameters, all missing/empty by default:

- `bewise.bootstrap_user_id`: independently verified actual Auth UUID.
- `bewise.bootstrap_email`: independently verified exact owner email.
- `bewise.bootstrap_approval`: non-secret approval/reference identifying the trusted operator review.

Supply these privately on the SAME trusted administrative connection before the
script. Do not place actual founder inputs in source, chat, shell history or
application request parameters. Close/discard that dedicated connection afterward;
never reuse privileged pooled application connections for bootstrap parameters.
The script contains its own BEGIN/COMMIT and bounded locks. A failed transaction
must be rolled back before any further work. No hosted execution is authorized.

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
callback routes with minimal local sign-in/MFA routes that are not deployed. Verify AAL1 and missing/expired
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

The 92-assertion local pgTAP suite verifies RLS denial for anon,
self-promotion denial, inactive staff denial, and intended owner permissions.
The 71 Auth tests include denial of unassigned Auth users and checked sign-out
failure behavior. MFA and bootstrap now have additional real local integration/concurrency coverage;
see the current MFA report for exact evidence and limits. No hosted MFA policy,
founder record, or Auth setting was modified. Real hosted recovery and the final
owner provisioning journey remain untested and separately approved.
