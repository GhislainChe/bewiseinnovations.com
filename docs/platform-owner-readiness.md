# Stage 2E.1 — Platform Owner provisioning readiness

Historical readiness review. Stage 2E.2 subsequently implemented/tested MFA and
bootstrap locally; see [MFA and recovery](./mfa-and-owner-recovery.md). Hosted
MFA deployment and operational recovery approval remain outstanding.

Reviewed **26 October 2026**, Africa/Douala, for Supabase project
`onfxxtvfprjnqsxdmhkp`. Confirmed intended owner: **Ndong Ghislain Che**;
application role: **platform_owner**. The real owner email remains unknown.

**Decision:** the database catalog and existing invitation/password foundation
are ready for the next preparation stage. **An active owner role must not be
provisioned yet.** MFA enforcement, controlled enrollment/challenge, tested
bootstrap execution and recovery procedures are unresolved. No founder account,
invitation, role binding or hosted setting/data change was performed here.

## Read-only hosted findings

A bounded session-pooler query verified the project-scoped CLI connection and
used a read-only transaction. The successful observation was at **04:07:28
Africa/Douala (03:07:28 UTC)**. No password or MFA secret columns were selected.

| Check | Observed |
| --- | --- |
| Database / transaction mode | postgres / read-only |
| Deployed migration versions | 20261021010000, 20261021010100, 20261023010000 |
| Auth users, including unexpected users | 0 |
| Previous disposable UUID/email | Both absent |
| Team profiles / role assignments | 0 / 0 |
| Owner role definitions / prior bootstrap events | 1 / 0 |
| RBAC tables / Auth security tables, RLS enabled | 6 / 2 |
| Roles / permission definitions / mappings | 4 / 18 / 31 |
| All four role-permission sets vs local seed | Exact match |

The owner's 18 permissions are exactly:

```text
audit.read             audit.technical.read
content.create         content.publish
content.read           content.update
inquiries.manage       inquiries.read
registrations.manage   registrations.read
roles.assign           settings.manage
team.manage            team.read
technical.manage       technical.read
waitlists.manage       waitlists.read
```

Technical Lead has only `technical.read`, `technical.manage` and
`audit.technical.read`; Operations Lead has six inquiry/registration/waitlist
permissions; Content & Community Lead has four content permissions. No roles
were assigned to people. Some catalog permissions remain future capabilities,
not implemented administrative endpoints.

The private result is `.supabase/platform-owner-readiness-2e1.json`. The initial
inspection helper incorrectly tried to parse the trailing transaction ROLLBACK
status as JSON. Correcting the local parser produced the results above; the
failure did not establish a hosted connectivity fault. All queries were read-only.

The existing public Auth settings endpoint returned email provider enabled,
public signup disabled, and email auto-confirm disabled (confirmation required).
An anonymous call to the SELECT-only readiness RPC was denied with HTTP 401 /
PostgreSQL 42501, as intended. Password policy, anonymous-provider settings,
saved template HTML, SMTP internals and current TOTP configuration were not
independently retrieved in this stage. Do not mark those as fresh API-verified.

## Owner email and identity gates

Do not derive an owner mailbox from the company domain, GitHub account, SMTP
sender or former test account. Before a provisioning request:

1. Ask Ndong Ghislain Che for the exact intended founder email and confirmation
   that he controls the mailbox. Collect the email through an access-controlled
   private provisioning record; exclude it from Git and routine diagnostics.
2. Independently verify the person's identity and the stated address through
   an existing trusted contact channel. Record who verified it, when, and a
   non-secret approval reference. An unverified address supplied by a third
   party is not sufficient. Do not request passwords, OTPs or invitation links.
3. Review Auth Users by exact email before any invitation. Existing or duplicate
   accounts require investigation rather than automatic reuse/recreation.
4. Obtain explicit approval naming that mailbox, this project, and exactly one
   invitation. This approval covers no role binding. Start the secure loopback
   launcher only as part of the approved journey, preserving private configuration.
5. After acceptance/password setup, independently verify exact UUID/email and
   confirmed status. A second trusted reviewer should check the pair. Keep the
   actual UUID/email private; the bootstrap template remains NULL by default.

The email is not requested or configured in this readiness stage. No account
creation is needed to close the code/security gaps first.

## Bootstrap transaction review

The updated [provisioning guide](./platform-owner-provisioning.md) contains the
reviewed transaction template; **it was not executed, even locally**. Existing
deployed migrations were not edited. The template now documents/enforces:

- Exact supplied confirmed ordinary Auth UUID/email, not metadata or signup order;
  ambiguous email matches fail. The Auth row is locked against concurrent edits.
- Empty team tables and no prior bootstrap audit event. The team-table locks
  serialize attempts, preventing duplicate owner provisioning.
- Stable role/permission catalog while binding; exactly the expected owner role
  and all 18 intended permissions. Unexpected permissions fail closed.
- Verified TOTP enrollment, without selecting factor secrets. This guard proves
  only enrollment, **not** a fresh AAL2 session or deployed MFA enforcement.
- One correctly named profile, exactly one owner assignment and one meaningful
  `platform_owner.bootstrap` audit row in a single transaction. A NULL actor
  truthfully represents a trusted administrative bootstrap, with non-secret
  approval reference and target UUID. It must not pretend the new owner acted.
- Lock/statement timeouts and transaction rollback on any guard, constraint or
  audit failure. There is no public bootstrap endpoint, privileged mutation RPC
  for end users, or automatic grant to the first signup.

**Blocking local verification work:** execute this revised template only in a
separately approved local test stage using disposable local Auth/MFA fixtures.
Cover wrong/missing/unconfirmed UUID-email, duplicate/ambiguous identity,
unexpected profile/assignment/prior bootstrap, missing or unverified factor,
catalog drift, concurrent bootstrap, audit failure and complete rollback.
Existing 66/74 tests do not test this revised SQL template or prove MFA safety.

Auth account creation and role binding remain separate approved operations.
Failed/unaccepted invitation: do not bind. Failed binding: inspect actual state,
keep the account unprivileged, and do not blindly retry. If a later binding is
committed but security verification fails, suspend access through a separately
reviewed audited administrative operation; do not delete evidence or create a
replacement owner automatically.

## MFA enforcement requirements — blocking activation

Current `core.ts`, `server.ts` and `supabase-gateway.ts` verify identity, active
profile, assigned database roles and permissions. They do not check AAL2.
Hosted policies/helpers inspected here contain no MFA/AAL predicate. Existing
RLS grants allow appropriate staff reads at AAL1; table mutation grants remain
closed to ordinary Auth users. This is an enforcement gap before owner activation,
not a claim that current anonymous users can promote themselves.

Required future work, with its own review, tests and deployment approval:

1. Build a controlled enrollment, challenge/verify and fresh sign-in harness or
   minimal secure interface. Use the installed SDK's `mfa.enroll`, `challenge` /
   `verify` or `challengeAndVerify`; do not log QR codes, TOTP seeds or OTPs.
   Unassigned invitees must be able to enroll their own factor without acquiring
   staff access. Password setup currently signs out, and there is no sign-in/MFA
   interface today. First enrollment is not achievable through current pages.
2. Add a fail-closed server guard combining verified identity, current active
   database membership/permissions, and **cryptographically verified** current
   AAL2 claims. Do not merely decode cookies or use the SDK's unverified local
   session view as authorization. Require it on every privileged operation,
   including any operation using a service/secret credential that bypasses RLS.
3. Add matching database restrictions for sensitive direct-API access, through
   a new separately approved migration. Supabase documents restrictive RLS
   checks of the trusted `auth.jwt()->>'aal'` claim. Cover owners with no enrolled
   factor too; an optional-MFA rule that permits unenrolled owners at AAL1 is
   insufficient. Preserve narrow permission predicates and avoid RLS recursion.
   Allow limited self-enrollment/session operations without opening audit/team
   administration. Design and test this policy boundary before changing SQL.
4. Test AAL1/unenrolled, expired/tampered claims, AAL2 without roles, inactive
   owners, wrong users, direct REST bypass attempts, service-backed route
   authorization, stale sessions after factor changes and successful least-
   privilege AAL2 access. UI redirects alone do not enforce these rules.
5. Define recent-challenge requirements for role/account/factor changes and
   protect removal of the final factor. Reverify session state after factor
   changes; do not assume enrollment or a historical challenge lasts forever.

This follows Supabase's
[MFA enforcement guidance](https://supabase.com/docs/guides/auth/auth-mfa) and
[TOTP flow](https://supabase.com/docs/guides/auth/auth-mfa/totp). Those APIs being
available does not enforce application MFA; current project availability must
also be reconfirmed in Dashboard → Authentication → Multi-Factor Authentication.

## Recovery and emergency owner lockout — blocking activation

The recovery handler has shared PostgreSQL quotas and generic responses but
remains disabled in production and in the dedicated hosted-test launcher.
The hosted-local override is not a production enablement option. Real hosted
recovery has not been tested, and there is no production sign-in destination.

Before activation, approve and rehearse these cases locally:

| Incident | Required controlled response |
| --- | --- |
| Lost password, authenticator retained | Generic rate-limited email recovery, explicit confirmation POST, new password, sign-out/session review, then fresh MFA challenge before privileged use |
| Lost authenticator, alternate factor retained | Fresh approved alternate-factor challenge; verify identity and audit replacement; never remove the last trusted factor through AAL1-only self-service |
| All factors or mailbox lost | Independent identity review and trusted Supabase project administrator recovery; no automated email-only MFA reset or new owner promotion |
| Suspected compromise | Reviewed audited suspension via `team_profiles.is_active=false` first; investigate and use separately approved provider-supported account/session controls; reset/re-enroll only after identity verification |

Identify an authorized infrastructure/project recovery custodian and a separate
trusted reviewer. Application founder roles do not automatically grant Supabase
Dashboard or infrastructure access. Protect those administrator accounts with
their own MFA, restrict privileged secrets, and keep a private recovery/contact
runbook accessible during application lockout. Do not create a hidden default
owner, publish a break-glass endpoint, weaken RLS/AAL2, or auto-promote a signup.

The installed application has no recovery-code generation/storage/redemption
workflow. Do not promise usable Supabase recovery codes or ask for a TOTP seed
to place in this repository. Decide/test whether supported alternate factors or
reviewed emergency administration are the recovery mechanism; store any approved
recovery material offline or in an access-controlled vault, never logs/chat.

Recovery administration must use a separately approved exact-UUID operation,
record approver/reviewer/target/action/time in an append-only audit event without
passwords, links, OTPs or factor secrets, and
verify the post-state before reactivation. Document failure between Auth and
database steps: keep the profile inactive until both are reconciled, do not
blindly retry, and retain evidence. Factor enrollment/removal, password-recovery,
session revocation, suspension/reactivation and role changes need meaningful
auditing; current automatic application audit coverage for these events is not
implemented. Provider Auth logs and the bootstrap audit alone are insufficient.

Immediate suspension must rely on current profile state, not JWT expiry alone.
Supabase notes that [signed-out access JWTs may persist until expiry](https://supabase.com/docs/guides/auth/signout).
A reliable reviewed administrative session-revocation procedure still needs
selection/testing; do not assume signOut called by a local application revokes
every owner device or addresses a lost authenticator.

## Email, localhost and privacy readiness

- Owner-confirmed saved Site URL: `http://localhost:3000`; exact allowlist:
  `http://localhost:3000/auth/confirm`. Do not switch to a production domain yet.
- Owner-confirmed saved links, Stage 2D.24:
  `{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&type=invite` and the
  same link with `type=recovery` (`&amp;` inside HTML is equivalent).
- Custom OVHcloud SMTP delivered the approved disposable invitation, and hosted
  acceptance/password setup/sign-out succeeded before cleanup. Fragment landing
  pages were subsequently tested with synthetic tokens and real Edge/HTTP;
  actual email delivery of the updated fragment links has not been retested.
- Dashboard saved template HTML, Site URL/allowlist, password minimum and SMTP
  status are previously owner-verified, not freshly fetched here. Reconfirm
  those exact values before an approved send; never expose SMTP credentials.
- Current confirmation uses memory-only fragment extraction/early URL cleanup,
  inert GET, explicit CORS-mode POST, strict trusted Origin, no-store/no-referrer,
  server-verified identity and one-time durable tickets. Logout errors are
  checked; unassigned users receive pending activation without role creation.
- The development server remains stopped and historical `.next/dev/trace`
  remains absent. Existing secret/signing environment files were untouched.
  Future legacy query URLs, email rewriting or request-body telemetry can still
  leak tokens; keep analytics, third-party scripts and raw logging away from
  auth pages and protect private logs/backups.

## Safe founder provisioning order and approvals

1. **Next recommended approval:** a local-only MFA/enrollment, server/RLS
   enforcement and recovery-design/test stage. Approve no hosted write as part
   of that work. Collect/reverify the real owner email privately as preparation,
   without authorizing an invitation.
2. Test the revised bootstrap template locally. Review any new migration,
   backups, policy diffs and rollback plan; separately approve deployment of
   actual MFA enforcement/configuration before owner activation.
3. After all gates pass, approve exactly one invitation to the verified owner
   email. Accept, set password, enroll/verify TOTP and confirm the exact Auth
   UUID/email. Keep the account unassigned meanwhile.
4. Separately approve the first-owner binding transaction with private inputs.
   Verify profile, exactly one owner role, exact permissions and audit event;
   test AAL1 denial/AAL2 permission-scoped success and recovery before proceeding.
5. Provision each remaining founder individually, with independently verified
   actual email, per-account invitation approval and separate reviewed role
   binding: Kevin Omgba → `technical_lead`, Nateu Farhel → `operations_lead`,
   Divine Nguemo → `content_community_lead`. Do not reuse the first-owner
   transaction (its empty-team guard should fail). Each needs a scoped workflow,
   audit, MFA/security gates and exactly one initial role; those binding
   operations are not implemented or authorized by this report.
6. Verify each person's denied permissions as well as permitted ones. Never
   silently fall back to owner privileges if another role operation fails.

## Validation and changes

Authentication tests: **66/66 passed**. Real local pgTAP: **74/74 passed**.
TypeScript, ESLint and production build passed. These preserve existing RBAC
and authentication behavior; they do **not** establish MFA/recovery/bootstrap
readiness. No hosted users or retained test identities were created. The pgTAP
suite's transactional local fixtures were rolled back as usual.

Changed documentation: this report, `platform-owner-provisioning.md` and a link
in `auth-flows.md`. The ignored private inspection helper/result contain no
credentials or Auth row data. No runtime code, deployed migration, environment
file, hosted Auth setting or hosted record was changed. No hosted account,
email, role assignment, bootstrap execution, trace deletion or deployment occurred.
