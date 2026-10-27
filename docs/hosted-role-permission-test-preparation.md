# Stage 2E.10 — hosted role-permission preparation

Follow-up: [Stage 2E.10B final safety check](./hosted-role-test-final-safety-check.md)
reconfirmed exact identity and zero membership read-only. Hosted execution
remains blocked on factor mitigation and private browser-session bridge review.

**Preparation only. Hosted execution is blocked by the uncertain TOTP factor.**
No hosted staff profile, assignment, audit event, quota change, factor change,
session revocation or Auth deletion was performed. No email was sent, migration
added/deployed, hosted setting changed or website deployed. Recovery stays off.
The development server remains stopped; cookie diagnostics are off by default.

## Read-only hosted findings

Inspected on 27 October 2026 using bounded, explicit read-only session-pooler
queries. Connection metadata/link matched **onfxxtvfprjnqsxdmhkp**; PostgreSQL
**17.11**, eight RLS-protected application/security tables, six restrictive MFA
policies, four roles, 18 permissions and 31 mappings remain. Recorded versions:

```text
20261021010000
20261021010100
20261023010000
20261026010000
```

These match the four local migration files; no new migration was prepared.
Catalog assertions confirmed no anonymous SELECT or ordinary authenticated write
grant on the eight tables. All four public Auth-store RPCs retain service_role
execution without anon/authenticated/PUBLIC execution; private security tables
remain inaccessible directly to authenticated and service-role API clients.
There is one confirmed Auth identity: the privately tracked disposable UUID for
hndstudy2026@gmail.com. There are **zero profiles and zero assignments**, and no
other Auth users. The one verified TOTP factor is unchanged; one older AAL2
session remains. It was not revoked. Session/factor metadata cannot establish
which historical screenshot exposed a seed; no secret was read or compared.

The content role has exactly `content.create`, `content.publish`, `content.read`
and `content.update`. A fresh Data API probe requesting app_private returned
**406 / PGRST106**, confirming the schema is not exposed. Catalog role settings
alone returned no explicit Data API schema setting; that absence was not used
as proof. Private snapshots are in the Git-ignored, protected
`.supabase/hosted-mfa-stage-2e9/role-permission-preparation/` directory.

## Factor mitigation — separate approval, before any staff binding

Treat the current factor as unsuitable for permission-positive testing. The
recommended sequence preserves the account UUID and avoids granting privileges
while any uncertain factor remains:

1. Reverify the exact UUID/email, no profile/assignment, current factor IDs and
   session inventory against the private ledger. Pin the uncertain factor ID.
2. Obtain separate approval to remove **only that factor** through supported
   administrative Auth tooling and invalidate that disposable identity's test
   sessions. No other identity is in scope. Supabase documents that Admin
   `auth.admin.mfa.deleteFactor({userId,id})` logs out all active sessions when
   the deleted factor was verified. Do not invoke it now or retry an uncertain
   result blindly. Never delete managed Auth SQL rows to simulate this operation.
3. Read-only verification must show the pinned factor absent and all old sessions
   reconciled. Keep the identity unassigned; stop on unexpected enrollments.
4. The user signs in privately, observes AAL1, enrolls exactly one replacement
   primary TOTP factor and configures KeePassXC without screenshots, chat, logs
   or persistent unprotected setup-key storage. This replaces the uncertain
   factor; it is not an independently held backup factor.
5. Verify the replacement factor with a real challenge. Pin its new factor ID,
   verified status and creation time. Require a live AAL2 session tied to it and
   the same confirmed Auth UUID. Verify the old factor and its sessions are gone.
6. Record an operator-reviewed mitigation reference and user confirmation of
   private setup. Metadata proves identity/state, **not secrecy of the new seed**.
   Uncertainty means stop; no assertion that a factor is secure based on status
   alone. Keep ownership/recovery acceptance separate from this functional test.

Supported references: [Admin factor deletion](https://supabase.com/docs/reference/javascript/auth-admin-deletefactor),
[user factor unenrollment](https://supabase.com/docs/reference/javascript/auth-mfa-unenroll).
Self-service unenrollment requires AAL2 and the current app has no unenroll UI;
this plan does not introduce a public factor-reset endpoint or recovery bypass.
No second factor or physical-device pass is claimed. A lost/compromised seed may
also require broader review; permission testing is not founder readiness.

## Reviewed binding transaction

`supabase/admin/bind-disposable-content-test.sql` is an administrative transaction,
**not a migration, function, automatic launcher or publicly callable endpoint**.
It has no role-selection input. The only inserted role is the existing
`content_community_lead`, and its four exact permissions are checked under locks.

A trusted operator loads the private reviewed ledger, not browser input. Before
execution, compare the UUID to the original Stage 2E.9 invitation-result record,
match the email exactly to the approved disposable mailbox and verify the linked
project again. Reject founder names/emails or a different UUID; the profile label
is `Disposable permission test <run>`, never a founder's name. The generic SQL
parameters permit local generated fixtures; **do not treat the SQL template as
an identity allowlist or execute arbitrary operator-supplied values remotely**.
There is no hosted runner that substitutes inputs or executes this file.

Using parameterized set_config calls on one dedicated administrative connection,
set these `bewise.permission_test_*` inputs, then execute the reviewed file on
that same connection. Never pass a password/token in shell arguments or chat:

| Suffix | Required value |
| --- | --- |
| user_id, email | Exact approved UUID/mailbox from the private original identity ledger |
| run | `permission-test-<new UUID>` tracked exclusively for this test |
| approval | Separate role-binding approval reference |
| factor_id | Pinned verified replacement primary TOTP factor UUID |
| retired_factor_id | Pinned former uncertain factor UUID, now absent |
| mitigation | Reviewed rotation/verification evidence reference |

The transaction requires administrative postgres execution, confirmed exact
UUID/email, no other team data, no reused run, exactly one verified replacement
TOTP factor, retired factor absence and a live AAL2 session tied to the replacement.
Other or stale sessions block binding. Enrollment and AAL2 remain distinct checks.
Table locks serialize competing bindings and stabilize role mappings; row locks
stabilize the selected identity/factor/session during insertion. One profile,
one assignment and a minimal `test.staff_binding` audit event commit atomically.
Any failure rolls everything back. An approval/mitigation string is evidence
reference, not automatic enforcement of human approval or proof of seed secrecy.

Record the exact profile/assignment keys, binding audit UUID and factor/session
references privately. Duplicate execution is rejected, not an invitation to
repair or broaden the transaction. These conservative scripts require empty
team tables and are unsuitable once founder onboarding begins without new review.

## Private caller-session harness and hosted test matrix

`scripts/permission-test-harness.ts` is a server-only callable probe. It takes
the **actual caller's SSR client** and exact expected UUID, verifies Auth identity,
then runs existing application requirePermission checks and caller-JWT Data API
reads. It returns only assurance, fixed permission decisions and counts. A
service-role token cannot supply an authenticated user claim to this probe.
No admin credential is used to prove RLS, no JWT is synthesized and no public
or production diagnostic route was added.

It is deliberately not an executable hosted browser bridge: before hosted
execution, separately review how the localhost-only runner will obtain that
approved browser's SSR session in memory. Do not paste cookies/tokens into a CLI,
chat or file, expose a new public endpoint or point automatic local test runners
at hosted Supabase. The callable harness was exercised end-to-end against real
local Auth and REST; hosted browser wiring/permission execution remain pending.

| Case | Expected evidence | Hosted mutation approval needed? |
| --- | --- | --- |
| Unassigned AAL2 | No member/permission, own-profile count zero | No binding; only approved login/MFA activity |
| Assigned AAL1 | content.read false; known own profile/assignment invisible under RLS | Binding first; normal fresh login |
| Assigned AAL2 | Four content permissions true; own profile/assignment count one | Binding and fresh replacement-factor challenge |
| Missing permission | team.manage, roles.assign, settings.manage, audit.read, inquiries/registrations/waitlists.read false | No protected business operation should execute |
| Direct RLS | Real caller Data API matches AAL1/AAL2 boundaries; audit visibility zero | Read-only queries; no administrator client as substitute |
| Inactive staff | content.read denied and own profile hidden | Separate exact-UUID deactivate/reactivate transactions plus audit; not authorized by binding alone |
| Self-assignment / private RPC | Authenticated INSERT and privileged Auth-store RPC execution denied | Real attempted writes were tested locally; hosted negative-write attempts need separate approval |
| Privileged application guard | Existing requirePermission rejects owner/admin permission codes | No owner/bootstrap call; no dashboard/business write route exists to claim tested |
| Cleanup | Known test rows removed, original catalog unchanged, retained audit explicit | Separate cleanup approval; see below |

Permission-positive content checks are **authorization decisions**, not content
publishing: no content module/business table exists. Existing catalog RLS permits
active AAL2 profiles to read role/permission catalogs; those catalogs are not
private business records. Private helpers are not stand-alone business mutations;
the RLS MFA predicate and application checks intersect their permission facts.
The privileged Auth-store client exposes only its fixed ticket/quota RPCs; it
must never be used as a general authorization-testing or role-writing client.
No new privileged application route exists here.

## Staged cleanup and exact-UUID reconciliation

Auth deletion and application SQL cannot share a transaction. Stop after a partial
failure, preserve the ledger and inspect read-only before any approved follow-up.
Never blindly retry a destructive operation.

1. Reverify project, exact UUID/email, temporary profile marker, sole content-role
   assignment and exact binding audit event. Inventory all account sessions,
   factors, flow tickets and any known test fixtures. Fail on unexpected roles
   or records; do not widen deletion predicates.
2. With separate cleanup approval, execute
   `supabase/admin/unbind-disposable-content-test.sql` on a dedicated admin
   connection. Inputs are user_id/email/run, binding_audit_id and
   cleanup_approval. It rechecks identity, exact profile label, one content-role
   assignment and matching original audit event; it atomically removes only
   that assignment/profile and inserts `test.staff_unbinding`. Audit failure
   rolls back deletion. Repeated/concurrent cleanup is rejected after one winner.
   The account itself is intentionally untouched by this SQL.
3. Verify public rows absent. Then separately approved supported Admin
   `deleteUser(exactUuid)` may hard-delete **only the same disposable identity**.
   No managed Auth SQL deletion is permitted. If the test was never bound, skip
   the unbinding transaction after verifying no profile/assignment exists;
   do not manufacture a binding audit or role merely to satisfy cleanup.
4. Verify user/identities/sessions/refresh tokens/factors/challenges/one-time
   records for the UUID are absent as applicable. Check Auth deletion cascades
   the exact user's auth_flow_tickets and that profile/assignment remain absent.
   Verify all eight tables, policies/functions/grants, four migrations and
   4/18/31 catalog counts remain unchanged. Check no other identity changed.
   Deletion/revocation does not imply every previously issued JWT immediately
   loses cryptographic validity; live session/factor RLS checks remain required.
5. Retain the two minimal security audit events (actor null, resource UUID and
   run/approval references; no secret/email payload). Do not silently erase audit
   history. Any audit deletion or local artifact deletion requires new exact
   approval and its own retention decision.
6. Global quotas are shared: preserve them. Per-email quota hashes may span
   prior testing and flow types; retain unless specific rows/windows and a
   separate cleanup approval establish safe ownership. Do not reset counters
   to bypass limits or rotate the signing secret. Expiry ends enforcement, not
   necessarily physical row retention. Provider logs/mailbox messages have their
   own retention. No quota cleanup or audit purge is built into these scripts.

## Local execution and results

Prerequisites: running local Supabase containers, all four migrations, the
Git-ignored `.env.integration.local` pointed **exactly** at
http://127.0.0.1:65421. The runners reject a different API target and accept no
hosted database URL. The SQL runner uses only the existing Docker/socket helper.
Run database fixture tests serially because each expects initially empty local
team tables. Never reset active development data to satisfy this prerequisite.

```powershell
npm run test:db:content-role
npm run test:auth:content:local
npx supabase test db --local
npm run test:db:concurrency
npm run test:auth
npm run typecheck
npm run lint
```

| Validation | Actual result |
| --- | --- |
| Real PostgreSQL transaction tests | 58 assertions passed: UUID/email/confirmation/factor/permission guards, administrative-only execution, rollback after failed audit inserts, exact role/audit, binding concurrency one winner of two and cleanup concurrency one winner of two |
| Real local Auth / caller REST-RLS / server application harness | 45 checks passed: real TOTP challenge, unassigned denial, content-only permission-positive and owner/private permission-negative cases, caller mutation denial, private-schema/RPC denial, assigned AAL1 denial, inactive denial, staged unbinding, retained audits and supported local Auth deletion/cascades |
| Existing local pgTAP | 92/92 passed across three files |
| Existing concurrency | Ticket 1/12, per-email quota 3/12, global quota 30/33 passed |
| Unit/mocked/rendering auth tests | 78/78 passed |
| TypeScript / ESLint | Passed |
| Production build | Passed |

The transaction tests use SQL-created synthetic local Auth/session/factor rows:
they prove real PostgreSQL guards, not real MFA enrollment. The 45-check runner
separately uses actual local Supabase Auth enrollment/challenge and signed JWTs
through the real API gateway. It is not a new physical-device or browser test,
nor a hosted permission-positive pass. Its synthetic seed/password/JWT exist
only in process memory; no email is sent. Local fixtures and their local test
audit rows are removed only after retained-audit behavior is asserted. Hosted
audit retention is not changed by that local fixture cleanup.
Final local reconciliation found zero Auth users, profiles, assignments, flow
tickets and test binding/unbinding audit fixtures, with catalog counts 4/18/31.

## Approval gates and remaining risks

Approve in separate scopes: **(1)** exact-factor removal/session reconciliation
and one replacement primary enrollment, **(2)** replacement factor/private setup
acceptance, **(3)** exact temporary content-only binding, reviewed caller-session
bridge and hosted test matrix (including any transient inactive-profile or
negative write attempts), **(4)** exact staged cleanup and retained artifacts.
No role assignment may precede mitigation. No accounts, invitations, founder
roles, owner bootstrap, settings, migrations or production recovery are included.

Remaining blockers: uncertain factor, one older session requiring approved
reconciliation, actual secure replacement-factor ceremony, private hosted browser
bridge review and explicit mutation approvals. Physical independent-device and
backup-factor testing plus recovery-governance decisions remain founder-readiness
requirements, not things established by this single-computer content-role test.
