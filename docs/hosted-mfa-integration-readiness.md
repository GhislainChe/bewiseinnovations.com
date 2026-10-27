# Stage 2E.7 — controlled hosted MFA test readiness

Follow-up: [Stage 2E.10 role-permission preparation](./hosted-role-permission-test-preparation.md)
adds locally tested content-only binding/unbinding transactions and a private
caller-session permission probe. Hosted execution remains blocked on approved
factor mitigation and separate role-test/cleanup approvals. Earlier statements
below that Phase B artifacts were not implemented describe the Stage 2E.7 review.

Follow-up: [Stage 2E.8 current hosted TOTP configuration verification](./hosted-totp-configuration-verification.md)
confirmed enrollment/verification enabled and capacity 10. The unverified TOTP
configuration statements below describe the historical Stage 2E.7 review;
the saved invitation link was subsequently owner-confirmed in Stage 2E.8.
Physical-device tests and Phase B artifact/approval gates remain separate.

Reviewed **26 October 2026** for project **onfxxtvfprjnqsxdmhkp**. This stage
performed local automated tests and read-only hosted checks only. No account,
email, factor, staff record, assignment, audit row, ticket or quota was created
or changed remotely. No environment values, settings, grants or migrations
were changed. Production recovery remains disabled; the app was not started.

The complete hosted browser matrix below is **planned, not executed**. Earlier
local browser/integration passes and the historical hosted invitation pass do
not constitute a hosted MFA pass.

## Verified current state

The linked project and bounded session-pooler inspection match the approved
deployment. The SQL transaction explicitly enforced read-only mode. Its entire
captured catalog equals the Stage 2E.6 post-deployment snapshot within that
inspector's scope: PostgreSQL 17.11, four deployed migrations, six restrictive
MFA policies, preserved functions/grants and exact role-permission mappings.
Counts remain **4 roles / 18 permissions / 31 mappings / 0 Auth users /
0 team profiles / 0 assignments**. No new migration preview or deployment was
needed; all four recorded versions are:

```text
20261021010000
20261021010100
20261023010000
20261026010000
```

Fresh bounded read-only API probes at **10:05:37.547 UTC** passed:

| Probe | Observed response |
| --- | --- |
| Request private schema through Data API | 406 / PGRST106 |
| Anonymous read of public team_profiles | 401 / 42501 |
| Same read with an intentionally invalid dummy JWT | 401 / PGRST301 |

Only fixed status/error codes were retained, never response bodies, keys or
Authorization headers. These independently resolve the outstanding readiness
checks; the cause of the Stage 2E.6 inconclusive wrapper remains unestablished.

`npm run auth:hosted:check` passed its **SELECT-only** readiness RPC using the
existing protected test configuration. This verifies the configured project,
credential acceptance, signing-secret format, file privacy and disabled recovery
gate; it does not invoke ticket registration, redemption or quotas. Readiness
is not a substitute for real MFA verification or complete hosted Auth settings.

## Minimum identity and role scope

Use **one** disposable hosted Auth identity and one independently verified,
owner-controlled mailbox, separate from all four founders' planned accounts.
No recipient is selected or authorized by this document. The previous test
identity was deleted; do not assume permission to recreate it or reuse its UUID.

- **Phase A:** no profile and no role. Test invitation, password setup, AAL1,
  primary/backup TOTP, AAL2 without membership, and sign-out.
- **Phase B, separate approval:** bind that same exact UUID to one temporary
  active test profile and **exactly one existing role**,
  `content_community_lead`. It has the four content permissions and lacks
  `team.manage`, `roles.assign`, `audit.read` and private business permissions.
  It supplies both a permission-positive and permission-negative case.
- No `platform_owner`, founder profile, owner-bootstrap transaction, new role,
  changed mapping or administrator assignment is needed. No real founder's
  identity or name should label the disposable profile.

A second identity is unnecessary for this matrix. Cross-user row isolation,
other founder-role combinations and actual private-business records are outside
this minimal test; expanding them requires another explicit scope/approval.
No business tables or records should be created to manufacture a test.

## Approval-gated matrix

All user-specific results below remain pending. Record each outcome as
pass/fail/not-run, UTC timestamp, run reference, UUID/factor reference and safe
reason code in a private ledger. Record no secrets or full email-link URLs.

| # | Test and evidence required | Temporary staff assignment? |
| --- | --- | --- |
| 1 | Send exactly one approved invitation; same UUID remains throughout. Fragment landing GET removes the fragment and does not verify it. Continue POST verifies once. Set a private password of at least 12 characters; ticket becomes redeemed, session ends and pending activation appears. | No |
| 2 | Sign in at /auth/sign-in; GET /auth/mfa/session reports aal1. Incomplete enrollment is never evidence of AAL2. | No |
| 3 | Enroll one primary TOTP factor on the current identity. Import its setup key privately into a physical authenticator. Before verification, factor remains unverified and session remains AAL1. | No |
| 4 | Explicitly submit the current code. Verify the factor is verified and the request's real session reaches AAL2; unassigned staffAccess remains false. | No |
| 5 | After Phase B binding, sign out and sign in afresh. At AAL1, server staff authorization is denied and direct caller-authenticated RBAC SELECT returns no rows, despite the assigned role. | Yes for a meaningful MFA-isolation test |
| 6 | Before binding any profile/role, AAL2 still has staffAccess false; requireTeamMember/requirePermission deny, and direct team data is empty. | No |
| 7 | At AAL2 after exact Phase B binding, staffAccess is true and server requirePermission(content.read) succeeds for the exact test UUID. Reading its own profile and assignment through the caller's Data API client returns the known records. | Yes |
| 8 | The same AAL2 identity is denied requirePermission(team.manage), roles.assign and audit.read. No protected action is executed merely to test a permission lookup. | Yes |
| 9 | Compare direct Data API requests at AAL1 and AAL2 using the user's signed bearer, not a service key. The known nonempty own profile/assignment is invisible at AAL1, visible at authorized AAL2. Audit reads remain filtered for the content role. Anonymous/invalid JWT denial is checked separately. | Both phases; positive RLS boundary requires Phase B |
| 10 | Checked user-initiated sign-out succeeds, current session disappears, MFA status becomes unauthenticated and flow/project auth cookies (including chunks) are absent. Never record a success after a sign-out error. | Either |
| 11 | While AAL2, enroll and verify a distinct backup factor on a separately held device. Fresh AAL1 login challenges that factor and obtains AAL2. Enrollment alone and copying the primary seed do not satisfy this test. | No |
| 12 | Following separate exact cleanup approval, remove the UUID and removable test fixtures, verify no live session/refresh token, factor, ticket, profile or assignment remains, and confirm unchanged role/permission catalogs. Reconcile explicitly retained audit/quota artifacts. | Cleanup of both phases |

Use the user JWT against the Data API to test gateway/RLS behavior. A database
administrator connection, service key or manually set SQL JWT claims cannot
prove ordinary API enforcement. A successful HTTP response with empty data is
not sufficient for a positive access test: compare to the known own-record UUID.
No current business write endpoints exist, so the content permission-positive
case is an authorization lookup, **not a claim that content publishing works**.

The existing permissive catalog policies allow active profiles at AAL2 to read
role/permission catalogs. They do not hide those catalogs per role. Do not invent
a different expected policy while testing or confuse profile presence with
application staff authorization, which additionally requires a valid role.

## Browser and server procedure after approval

1. Obtain the approvals below and freeze a private run ledger. Recheck project,
   account/catalog baseline, template/URLs and current Auth-store readiness.
   Record the expected UUID immediately after invitation; stop on duplicates.
2. Run `npm run auth:hosted:dev` in a VS Code terminal and
   `npm run auth:hosted:logs` in another. The launcher binds only 127.0.0.1:3000,
   uses http://localhost:3000 as trusted Origin and explicitly loads the private
   hosted-test environment. Do not use a tunnel or default npm dev launcher.
   Do not overwrite .env.local or .env.integration.local. Wait for the sanitized
   auth_preflight ready label. Recovery stays disabled.
3. Use a dedicated private browser profile with no extensions/sync, password
   export, HAR recording, screenshots of setup material or shared DevTools.
   Do not persist tokens/seeds in localStorage, sessionStorage or files. A token
   necessarily exists transiently in the email, browser memory and POST body;
   no controlled server request URL should contain it.
4. After the single approved invitation, complete matrix case 1 once. On timeout
   or uncertain result, inspect sanitized stage labels and exact account/session
   state; do not automatically resend, verify again or recreate the identity.
5. First sign-in: perform Phase A and enroll/verify the physical primary and
   backup factors. Confirm AAL2 without staff access. Complete the unassigned
   server authorization probe before binding any role.
6. If separately approved, execute a reviewed, parameterized administrative
   **test-binding transaction**, not the owner bootstrap. It must lock and
   recheck the exact confirmed UUID/email and run reference, verified TOTP,
   expected empty staff baseline and exact content-role mapping; atomically
   insert one test profile, one assignment and a minimal approval-linked audit
   event. Reject any other profile/assignment or unexpected state. No automatic
   self-provisioning endpoint or browser-supplied role is permitted.
7. Test AAL2 content permission-positive/administrative-negative behavior, then
   sign out. Second sign-in: check assigned AAL1 denial and challenge the
   primary factor. Third sign-in: check AAL1 again and challenge the backup.
   End each session with checked sign-out and cookie inspection.
8. Stop after results are recorded. Reconcile the ledger and obtain the distinct
   cleanup approval before any deletion. Preserve uncertainty instead of
   attempting corrective hosted operations without approval.

The existing /auth/mfa/session endpoint reports current assurance, factors and
staffAccess, **not individual permission decisions**. Before Phase B execution,
prepare/review a private localhost-only browser/server test harness for
`requirePermission` using `createSupabaseAuthGateway` and the actual caller's
SSR cookies/session. Keep cookies/JWTs in process memory; never ask the user to
paste them into chat, a shell argument, a URL or a persistent file. No public
diagnostic endpoint or service-role permission test is acceptable. That hosted
harness and the exact test-binding/cleanup transactions are **not implemented or
approved in this preparation stage**. Existing local runners remain loopback-only;
do not remove their target guards or point their automatic fixture cleanup at
the hosted project.

Plan at most three normal app sign-ins per email per fixed-hour window. Sign-in
uses the shared quota store: three per email and 30 globally. Failed attempts
also spend quota. Reserve budget before execution, stop/wait for the next window
if exhausted, and never reset counters or rotate the signing secret to bypass
limits. Extra invalid-password/recovery attempts need a separate plan. Production
and controlled hosted password recovery remain disabled throughout this matrix.

## Record inventory, tracking and cleanup

Create a protected Git-ignored ledger outside source control before execution.
Track project/run/approval references; exact Auth UUID and privately verified
mailbox; session/factor/challenge IDs where safely available; profile and
assignment keys; created audit IDs; ticket record reference (never raw ticket);
per-email quota row coordinates; baseline catalog digests/counts; outcomes and
operator/reviewer timestamps. The UUID is mandatory for every targeted mutation.
Do not retain password hashes, keys, seeds, JWTs, cookies or invitation tokens.

| Artifact created by a future test | Removal or retention rule |
| --- | --- |
| One Auth user/email identity and invitation/one-time Auth records | After exact-identity recheck and cleanup approval, one supported Admin hard-delete for the exact UUID; verify related managed records are gone. No direct writes to managed Auth SQL tables. |
| Sessions, refresh tokens, AMR records, two factors/challenges | Check session termination after sign-out; before hard-delete reconcile all sessions/factors for this UUID. Use approved supported global revocation if any session remains. Verify the Auth deletion's cascades afterward instead of assuming them. |
| One invitation flow ticket | Expected redeemed after password update; auth_flow_tickets.user_id has ON DELETE CASCADE. Verify zero tickets for this UUID after deletion; no broad ticket purge. |
| One optional profile and content-role assignment | One exact scoped transaction can remove the approved assignment/profile with a cleanup audit, then the Auth deletion follows. Alternatively rely on reviewed cascades but verify afterward. Never delete or modify the shared role definition or permission mappings. |
| Test-email sign-in quota rows | HMAC identifiers, not cleartext emails; identify privately with the unchanged signing secret and run windows. Require exact row-level cleanup approval, preferably only after the window closes, otherwise retain as documented expired test residue. No quota bypass during testing. |
| Shared global quota rows | Preserve. They include other traffic and cannot safely be attributed solely to this test. Record expected increments and let the window expire; expiry stops enforcement but does not itself delete rows. Any future pruning needs a separate approved retention job. |
| Administrative assignment/cleanup audit rows | Prefer retain minimal approval-linked security evidence. Never pretend identity deletion erases audit history. If zero test-specific public audit rows is required, separately approve exact audit IDs and retention/export requirements; no automatic audit deletion. |
| Provider Auth audit/SMTP logs, delivered mailbox message | Provider/mailbox retention applies. Do not purge shared provider logs. Owner may remove the invitation message and authenticator entries after cleanup confirmation; do not export setup material. |
| Private browser profile/local diagnostics | Stop only this run's identified processes; separately approve exact local artifacts for deletion after sanitized summaries are preserved. Do not delete backups, unrelated traces or other profiles. |

Security audit retention and global quota residue mean **complete cleanup does
not mean erasing every trace of the event**. Agree retained records and any exact
audit deletion in the approval scope before creating the identity. No hosted
cleanup script is authorized by this document.

Reverify UUID/email, absence of unexpected roles/ownership, and each exact
removable record before destruction. Browser sign-out uses scope local; it is
not proof that every session on other devices has ended. Supported global
sign-out requires a valid JWT in the trusted process, not a UUID supplied as a
JWT. If that session is unavailable, use a reviewed Dashboard/provider recovery
procedure; do not improvise Auth-table deletes. Stateless access JWTs can remain
cryptographically valid until expiry after sign-out/deletion. The current MFA
RLS additionally requires a live matching session/factor, so database access
must remain denied after revocation. See
[Supabase sign-out](https://supabase.com/docs/guides/auth/signout) and
[user deletion limitations](https://supabase.com/docs/guides/auth/managing-user-data).

Final read-only cleanup checks must show zero rows for the exact UUID in Auth
users/identities/sessions/unrevoked refresh tokens/factors/challenges/one-time
records where applicable, profiles, assignments and flow tickets. Confirm no
other identity changed; all eight protected tables, 12 policies, eight security
functions, four migrations, 4 roles, 18 permissions and 31 mappings remain
intact. Team tables must be empty again before future first-owner bootstrap.
Use distinct test audit action names; never emit platform_owner.bootstrap.
Retained audit/quota/provider records must be listed, not silently omitted.

## Physical devices and recovery governance

Hosted TOTP enrollment/verification flags and maximum verified-factor capacity
were **not independently retrieved here**. Before invitation, inspect the
project's Authentication MFA/App Authenticator (TOTP) controls; confirm enrollment
and verification are enabled and capacity allows two verified factors. If the
Dashboard does not expose a needed setting, obtain supported read-only project
configuration review by the infrastructure administrator. Provider-default TOTP
support is not project-specific verification. Do not change settings in this
stage. [Supabase TOTP documentation](https://supabase.com/docs/guides/auth/auth-mfa/totp)
describes enrollment versus verification; neither alone proves current AAL2.

Use two independently held physical authenticators with distinct generated
factor secrets. Automatic clock synchronization, private setup and an actual
fresh-login challenge with each device are prerequisites. Software-generated
local test OTPs and copied seeds do not establish physical recovery readiness.

**Kevin Omgba and Nateu Farhel are proposed recovery reviewers only.** This
document appoints neither person as a custodian/executor and grants no account,
role, recovery permission or infrastructure access. Their organizational roles
do not imply the ability to recover or override an owner account.

Before owner activation, explicitly decide and rehearse:

- An independently secured infrastructure executor and an independent reviewer;
  two-person approval where possible, with an explicitly reviewed exception
  policy if that is unavailable. Reviewer/executor authority must be agreed
  outside mutable frontend metadata and outside this application's RBAC alone.
- Independent identity evidence/contact channels, designated custodians and
  separate custody of backup devices/infrastructure recovery access. Mailbox
  access alone is insufficient for an emergency MFA reset.
- Lost-one-device recovery through the verified backup, and all-devices-lost
  handling: suspend staff access, revoke sessions, independently verify identity,
  approve targeted factor reset, re-enroll/verify and recheck permissions before
  audited reactivation. No permanent bypass or master password.
- No-session lockout recovery when a valid JWT is unavailable, including the
  supported Dashboard/provider-assisted revocation procedure. This remains an
  operational blocker for owner activation, despite the successful local drill.
- Mandatory approval-linked audit, secure event notifications, incident evidence
  retention and review of compromise/password change. Cross-service operations
  are not atomic; uncertainty stays suspended pending reconciliation.

Do not run a hosted recovery drill, remove factors, reset a password, enable
recovery or bootstrap the owner as part of this invitation/MFA test.

## Exact approvals still required and readiness decision

1. **Readiness prerequisites:** confirm current hosted TOTP capacity/flags, the
   two physical devices, approved fragment invitation template and exact
   localhost Site URL/redirect. Historical template confirmations are not a new
   inspection of today's saved HTML. Launcher/configuration and readiness RPC
   are ready; the server remains stopped until the approved test.
2. **Phase A approval:** name one independently verified non-founder mailbox;
   explicitly authorize exactly one disposable identity/invitation, password
   setup, primary/backup enroll-and-verify operations, bounded sign-ins/challenges
   and resulting session/ticket/quota records. Agree audit retention and cleanup
   scope first. No automatic retry or resend after uncertainty.
3. **Phase B approval:** review the private permission/RLS harness and exact
   transactional UUID/email binding; authorize one temporary active profile,
   one content_community_lead assignment and named audit events. No owner role.
   Phase A approval does not authorize this binding.
4. **Cleanup approval:** specify exact UUID, assignment/profile, cascaded Auth
   and ticket records, any exact test-email quota/audit rows, revocation actions
   and local artifacts. Hard deletion is irreversible; stop on partial results
   and reconcile read-only rather than blindly retrying.

**Ready for scoped approval preparation, not an unconditional hosted execution
pass.** Phase A requires the manual/device prerequisites above. Phase B also
requires the reviewed private harness and binding/cleanup transactions. Owner
onboarding remains blocked on separate identity, MFA and recovery-governance
acceptance; no privilege was granted to the proposed reviewers.

## Validation in this stage

| Check | Result |
| --- | --- |
| Existing mocked/unit/rendering authentication tests | 73/73 passed |
| Real local PostgreSQL pgTAP tests | 92/92 passed across three files |
| Hosted read-only catalog vs deployment snapshot | Exact match within inspected scope |
| Hosted Auth-store readiness RPC/config privacy checks | Passed; recovery disabled |
| Read-only hosted API probes | 3/3 passed, as recorded above |
| New hosted user-specific browser/MFA matrix | Not run; no identities created |
| Earlier real local Auth/HTTP/browser and bootstrap tests | Historical only; not rerun here |

Local pgTAP checks use synthetic database JWT/session fixtures, not a new real
hosted Auth integration. No owner-bootstrap transaction, local or hosted, was
executed in this stage. No application or SQL code changed, so TypeScript/build
and browser suites were not rerun for this documentation-only stage.

Private evidence: `hosted-stage-2e7.json` and `stage-2e7-api-probes.json` in the
existing Git-ignored backup directory. These are metadata-only inspection
artifacts, not a new hosted backup. Existing credentials and backup bytes were
preserved. See [deployed MFA result](./hosted-mfa-deployment.md),
[MFA/recovery architecture](./mfa-and-owner-recovery.md) and
[prior exact-account cleanup](./auth-test-cleanup-result.md).
