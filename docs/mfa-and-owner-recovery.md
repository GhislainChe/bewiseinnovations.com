# Stage 2E.2 — local TOTP enforcement and owner recovery

Current hosted status: [Stage 2E.6 deployed MFA migration](./hosted-mfa-deployment.md).
Controlled hosted testing is planned in [Stage 2E.7 integration readiness](./hosted-mfa-integration-readiness.md).
The Stage 2E.2/2E.3 observations below are historical local-only records;
references to the migration being local-only describe that earlier stage.

Reviewed 26 October 2026 (Africa/Douala). **Local implementation and tests only.**
Hosted project `onfxxtvfprjnqsxdmhkp` was not contacted or modified. No founder
accounts, emails, hosted roles, Auth settings or deployed policies were changed.
Production recovery remains disabled. No application deployment occurred.

## Architecture and security boundaries

| Boundary | Enforcement |
| --- | --- |
| Identity | Request-scoped Supabase SSR client; `getUser()` and signature/expiry-verified `getClaims()` must identify the same user |
| Current assurance | Only known `aal1`/`aal2`, authenticated role, future expiry and a session identifier are accepted; no client-supplied MFA flag |
| Staff access | AAL2, verified TOTP, active current profile, assigned valid database roles and the individual required permission |
| Direct Data API | Existing role policies intersect new restrictive MFA policies on all six RBAC tables |
| Live database session | JWT AAL2 and expiry, matching current `auth.sessions` user/session/AAL2, unexpired `not_after`, and that session's still-verified TOTP factor |
| Privileged secrets | Existing Auth-store client stays server-only, restricted to its fixed ticket/quota RPC operations; no secret enters browser code |

`getCurrentTeamMember`, `requireTeamMember`, `hasPermission`, `requirePermission`
and `signInTeamMember` are the reusable staff boundary in `src/lib/auth/core.ts`
and `server.ts`. Their production gateway uses the caller's SSR client/RLS,
not a service-role client. A valid Auth account or MFA session alone never
creates a profile or grants a role. Database/profile changes are reread for
each operation; user metadata is not an authorization source.

`signInTeamMember` now throws `MfaRequiredError` for a verified AAL1 login,
retaining only the session needed for MFA. Callers must offer `/auth/mfa` and
must not treat that exception as a staff sign-in success. Unassigned AAL2 users
still fail staff authorization. The minimal sign-in route intentionally permits
an unassigned Auth session solely for setup/challenge; there is no registration.

No business/admin write endpoints exist yet. Every future service-backed
business operation must call the request-scoped `requirePermission` first;
service_role bypasses RLS, so adding database policies cannot secure an
unprotected service client. Invitation/password/recovery ticket operations
remain narrowly scoped pre-staff operations that must work at AAL1. They do
not grant business permissions and must not be repurposed as admin endpoints.

## Minimal authentication workflows

- `/auth/sign-in` and POST `/auth/sign-in/complete`: email/password sign-in to
  `/auth/mfa`; generic failures, no public signup or role assignment. Explicit
  CORS-mode form submission preserves Origin under no-referrer.
- `/auth/mfa`: minimal accessible setup/challenge panel. It loads only the
  current user's assurance and factor IDs/status, and displays a neutral pending
  activation message for an unassigned account even after successful MFA.
- GET `/auth/mfa/session`: verified current identity, AAL and factor metadata.
  It never enrolls/challenges factors or returns a setup secret.
- POST `/auth/mfa/session`: strict trusted Origin/Host/forwarding checks,
  bounded form fields, own-identity factor list and explicit enroll/verify
  operations. No user UUID/role/assurance input is accepted.
- `/auth/sign-out`: the existing checked, user-initiated sign-out workflow.

Initial TOTP enrollment is allowed before team assignment, using Auth's own
authenticated user APIs. A setup key is returned in a private no-store POST
response and shown as text for manual authenticator setup. It stays only in
browser memory/DOM and is discarded on verification or navigation; no
localStorage/sessionStorage, external QR renderer, otpauth URL link or analytics
is used. The setup key is necessarily visible to the owner and to their
authenticator. Protect against browser extensions, screenshots and XSS; memory
is not a guaranteed secure-erasure mechanism. Do not share keys, codes or HARs.

Verify uses `challengeAndVerify` with a factor from the caller's own Auth factor
list and a six-digit TOTP. Auth verifies the code and issues the elevated session;
the server then verifies the new identity/claims before accepting success. SSR
cookie updates are applied to the response. An enrolled factor without a fresh
MFA-authenticated session is still AAL1 and cannot access staff data.

Adding a backup factor requires an existing AAL2 session if any verified factor
exists. New enrollment is limited to five factors by the application; duplicate
submissions while pending are prevented. There is no automatic retry or factor
deletion. An interrupted enrollment leaves an unverified factor that does not
grant access; refresh and inspect status or use a separately approved cleanup.
The UI provides no last-factor removal or recovery bypass.

All responses are private/no-store, no-referrer, noindex/nofollow through the
route/proxy. Passwords, setup secrets and OTPs never enter request URLs or
application logs. Confirmation still uses fragments and an inert GET followed
by explicit POST, with single-use durable flow tickets.

## Rate limits and production limitations

Sign-in fails closed without the existing server-only Auth-store configuration
and shared quota RPC. It reuses the current HMAC quota store: a separate
`sign-in:` identifier namespace, three attempts per normalized email per fixed
hour, and the same thirty-attempt global hourly budget used by recovery. It
stores no cleartext email. All failures remain generic. This conservative
shared global quota is deliberately susceptible to availability exhaustion;
review capacity, separate budgets and edge/CAPTCHA protections before public
deployment. It is not a comprehensive distributed denial-of-service defense.

MFA challenge/verification additionally uses Supabase Auth's provider rate limits
and factor-ownership/assurance rules. The app never forwards untrusted client
IP headers as a trusted abuse signal. Review provider MFA limits, proxy egress
behavior, monitoring and anti-abuse settings before exposing these pages.
Do not enable hosted recovery simply because the sign-in/MFA pages work locally.

## New local database migration

`20261026010000_require_staff_mfa.sql` adds only:

- `app_private.has_aal2_session()`, a read-only SECURITY DEFINER SQL function
  with empty search_path and fully qualified object references. It reads only
  the caller's session/factor status and returns a boolean. Execute is revoked
  from PUBLIC/anon/service_role and granted only to authenticated.
- Six restrictive policies (`*_mfa`), one on each existing RBAC table, applying
  to authenticated commands with both USING and WITH CHECK. These intersect
  the existing permissive permission policies; no table grants were broadened.

JWT signature verification belongs to Supabase's API gateway. Ordinary API users
cannot set PostgreSQL request claims. The helper also checks a live matching
session and verified TOTP, preventing stale AAL2 JWTs from retaining RBAC access
after session revocation or factor removal. `auth.jwt()` is not trusted merely
because a browser submitted an arbitrary JSON object. Real tests alter a signed
JWT's assurance and confirm the API rejects it.

Authentication and permission predicates remain separate. The existing private
`has_permission` is a permission lookup, not by itself proof of MFA. New tables
and future privileged functions need both boundaries; they do not automatically
inherit these six policies. Existing authenticated grants permit a provisioned
active user to read their own profile at AAL2 even if no role is assigned;
unassigned users cannot read others or acquire staff permissions.

Auth's MFA APIs operate independently of application RBAC policies. An invitee
can therefore enroll/challenge before a team profile exists. No private schema
is exposed and no new public RPC exists. The first three deployed migrations
were not edited. At Stage 2E.2 this fourth migration was applied **locally only**;
its later hosted deployment is recorded in the current-status link above.

## Canonical first-owner bootstrap

`supabase/admin/bootstrap-platform-owner.sql` is the reviewed parameterized
administrative transaction, not a migration or public function. Supply privately
on a dedicated trusted connection:

- `bewise.bootstrap_user_id`
- `bewise.bootstrap_email`
- `bewise.bootstrap_approval`

Missing/empty parameters fail. Close/discard the connection afterward. The script
locks the selected confirmed ordinary Auth identity and empty team tables,
serializes attempts, freezes the permission catalog, requires verified TOTP,
rejects any prior bootstrap audit, checks all 18 owner permissions, and atomically
creates exactly one profile/role assignment/audit event. Inputs and founder
email remain absent from source. The actual owner email is still unknown.

The SQL verifies **enrollment**, not an AAL2 session: a trusted project/database
administrator executes it under separately reviewed approval. The application
and restrictive database policies enforce session AAL2 after binding. No
frontend flag, first-signup rule or automatic role assignment exists.

The bootstrap was executed only with disposable local identities/fixtures.
Tests include missing/wrong/unconfirmed identity, absent/unverified TOTP,
unexpected team data, missing role, permission drift, prior bootstrap event,
duplicate attempts, injected audit failure/whole-transaction rollback, exact
audit creation and concurrent attempts (one winner). A separate real local Auth
test enrolled/verified TOTP through the actual API before executing the same
canonical script. Local test profiles are removed after each run.

## Owner recovery and emergency lockout runbook

Before founder activation, designate a trusted Supabase infrastructure/project
administrator and independent reviewer, protect their own administrator access
with MFA, privately record their contacts and test access during an app outage.
Application roles do not grant Dashboard access. Until a second trusted recovery
custodian exists, first-owner recovery depends on that single infrastructure
administrator/provider support; this is an operational single point of failure.
No hidden account, permanent recovery code or privileged web endpoint solves it.

### Lost password with authenticator available

Use separately approved rate-limited recovery to the independently verified
owner mailbox and explicit fragment confirmation POST. For an enrolled owner,
complete a challenge at `/auth/mfa` in that verified recovery session **before**
submitting the password update, then return to `/auth/reset-password` while the
same user-bound ten-minute recovery ticket is valid. GET does not redeem it.
Password update consumes the ticket and performs checked sign-out; subsequent
sign-in needs a fresh MFA challenge. Password recovery does not bypass MFA or
restore a suspended profile. A dedicated MFA-enrolled recovery/password-change
integration test and streamlined browser handoff were added in Stage 2E.3 below.
The original 45-assertion HTTP run alone did not exercise that recovery journey.
The application now checks verified assurance and factor status before redeeming
a password ticket, so an enrolled AAL1 user can step up without burning it.
Hosted recovery stays disabled until real delivery, quotas and the full hosted
recovery journey have been separately reviewed/tested. Do not reset a founder
password through chat or supply it to an operator.

### Lost authenticator with backup available

Enroll a distinct backup TOTP factor on a separately controlled device **while
the owner still has AAL2 access**. Verify the new device and its distinct factor
before relying on it; the real local test covers this flow. Store backup device
access/recovery material outside this repository, restricted to the owner.
When one device is lost, challenge the surviving factor, then perform separately
reviewed revocation of the lost factor and audit it. The application does not
provide a removal UI in this stage. Never remove the last working factor based
on a password/email link alone. Current database checks deny stale sessions if
their associated verified factor is removed.

### Compromise, lost mailbox/all factors, or administrative lockout

1. Verify the person and exact UUID/email independently through pre-established
   trusted contact channels, using an independent reviewer and incident approval
   reference. Do not accept mailbox control as the sole proof of factor-reset
   authority. Do not disclose codes, seeds, tokens or passwords to the operator.
2. A trusted infrastructure administrator suspends the exact profile using a
   reviewed transaction that locks/checks that UUID, sets `is_active=false` and
   appends an audit event atomically. Use actor NULL for infrastructure actions,
   target UUID, named approval/operator record, outcome and reason; never secrets.
   This disables staff access across sessions on subsequent operations without
   relying on JWT expiry. Do not clear role tables or add another owner.
3. Revoke sessions through a verified supported provider operation. The installed
   SDK's `auth.admin.signOut(jwt, 'global')` requires an actual user's JWT kept
   only in server memory, not just a UUID; do not fabricate one or request a
   paste into chat. Where no valid session is available, use reviewed Dashboard/
   provider-assisted recovery and, for compromise, an independently approved
   Auth account ban as appropriate. Do not assume a local-scope sign-out revoked
   every device. Suspension must remain in force until revocation is verified.
4. Only after independent identity review, use the supported trusted Admin MFA
   factor operation to revoke the specifically lost/compromised factor, or
   restore the verified mailbox through approved recovery. Keep the profile
   inactive throughout. New enrollment/challenge works without active staff
   privileges. Do not disable MFA/RLS globally or enable a public reset endpoint.
5. Verify ownership of a new factor with a real challenge; validate current
   session assurance, fresh credentials, revoked old sessions/factors, exact
   role/permission set and original UUID. Reactivation requires its own reviewed
   atomic profile + audit operation and the independent reviewer. Never restore
   access on an uncertain result or automatically retry destructive admin calls.
6. Record Auth-side operations and database-side outcomes separately. Auth and
   application SQL are not one transaction: an Auth failure after suspension
   leaves the account inactive; an incomplete recovery stays blocked. Preserve
   audit evidence and reconcile read-only before proceeding.

No automatic emergency mutations or recovery endpoint were implemented or
executed. Stage 2E.3 rehearses suspension, supported global revocation, factor deletion
and replacement locally. The selected human custodians must still rehearse
and approve the runbook; an automated drill is not identity verification or
human approval. Account-ban behavior was not exercised. Auth audit logs cover provider MFA activity; only the
bootstrap currently appends an application audit event automatically. Future
factor/account administrative tooling must append meaningful audit outcomes.
Recovery codes are not implemented in this app; do not promise native recovery
code availability or store a TOTP seed as a plaintext repository backup.

## Local setup and test evidence

Docker and the existing local PostgreSQL/Auth/Kong/REST/Mailpit stack were
available. Only local `[auth.mfa.totp]` enrollment/verification flags were enabled.
The CLI stopped the local stack with its normal backup and started from that
backup; no database reset occurred. Required services were healthy and the new
migration applied with `migration up --local`.

```powershell
npx supabase start --exclude studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor
npx supabase migration up --local
npm run test:auth
npx supabase test db --local
npm run test:db:bootstrap
npm run test:db:concurrency
npm run test:auth:mfa:local
npm run typecheck
npm run lint
npm run build
```

Do not run database/integration scripts concurrently with bootstrap tests:
they intentionally exercise locks/temporary catalog changes. Use the ignored
`.env.integration.local` file with URL exactly `http://127.0.0.1:65421`, the local
publishable/service credential, and local signing secret. Existing hosted and
local environment files were not overwritten. The MFA integration runner refuses
any other URL, forces recovery disabled, starts its own loopback Next.js process,
creates one disposable `example.invalid` identity without mail, exercises real
Auth/SSR/RLS/bootstrap, removes only its own test records and stops its process.
Its per-email quota bucket is also removed. Shared global quota counters and
provider Auth audit history are retained so the harness cannot erase unrelated
requests or evidence; they contain no retained test account/session access.
It suppresses passwords, seeds, codes, tokens and raw SDK/browser/server output.

| Test class | Evidence |
| --- | --- |
| Unit/mocked/rendering | 71/71: existing coverage plus verified-claims failures, AAL1 gating, initial/backup enrollment rules, own-factor validation and successful/failed challenges |
| Real local PostgreSQL pgTAP | 92/92: original 74 plus 18 MFA/RLS/grant/session/factor checks; original RBAC assertions now run with explicit synthetic AAL2 fixtures |
| Real local SQL bootstrap | 30 assertions; canonical transaction guards, audit failure rollback, exact catalog and concurrent winner 1/2 |
| Real local ticket/quota concurrency | Ticket 1/12, per-email 3/12, global 30/33, preserving the existing limits |
| Real local Auth/HTTP SSR/SQL | 45 assertions: enrollment/invalid and valid challenges, unassigned AAL2 denial, actual bootstrap, AAL1/forged/expired/inactive denial, second factor, cookies, revocation/stale JWT denial, and known-secret absence in inspected traces/logs |
| TypeScript / ESLint / production build | Passed |

The real Auth test uses actual TOTP codes generated in RAM from disposable
provider-issued secrets, not mocked verification. The SQL bootstrap guard tests
also use explicitly synthetic factor rows, distinguished from the separate real
Auth test. The Stage 2E.2 integration tests used HTTP/SDK/cookie jars, not real-browser
MFA form interactions. Stage 2E.3 adds the separate Edge browser/Mailpit drill
described below. The original Stage 2E.2 MFA tests generated no emails.

Integration corrections: expiry testing now uses a separate stepped-up device
and never resurrects an invalidated session. Stale-token denial accepts either
gateway rejection or an RLS-empty result and checks the actual session row is
gone after successful sign-out; it does not confuse expired SDK state with a
sign-out failure. The original sign-out failure tests remain intact.

## Hosted prerequisites and remaining blockers

1. Review this code/migration and recovery policy, including the chosen trusted
   custodian and independent verifier. The owner's real email is still unknown.
2. Confirm hosted TOTP enrollment/verification, signup/confirmation/password
   settings and approved fragment templates/URLs. Do not change them implicitly.
3. Separately approve a fresh hosted backup/restore-test, schema-conflict check,
   migration dry run showing only the new reviewed MFA migration, deployment,
   and read-only post-verification. Nothing in this stage authorizes those writes.
4. Verify hosted policies, Auth schema compatibility, grants, service-backed
   authorization and the chosen recovery/global-revocation procedure. Rehearse
   recovery locally and approve the custodian/runbook before owner activation.
5. Review minimal MFA UI in a real browser, provider/edge rate limits, CSP/HTTPS
   and secrets management. Do not expose public production recovery or deploy
   an unrestricted login as a side effect of controlled localhost testing.
6. Only afterward approve one invitation to the independently verified founder
   email, then a separate exact UUID/email bootstrap. Confirm MFA before role
   binding and AAL1 denial/AAL2 permission-scoped success after binding.

Official references: [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa),
[TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp), and
[SSR identity verification](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
MFA support/enrollment is not session authorization; the local checks above
implement those separate boundaries without claiming hosted enforcement yet.

## File inventory

Created:

- `src/lib/auth/assurance.ts`, `assurance.test.ts`, `mfa.ts`, `mfa.test.ts`,
  `sign-in.ts`.
- `src/components/auth/mfa-panel.tsx`.
- `src/app/auth/mfa/page.tsx`, `mfa/session/route.ts`,
  `src/app/auth/sign-in/page.tsx`, `sign-in/complete/route.ts`.
- `supabase/migrations/20261026010000_require_staff_mfa.sql`,
  `supabase/admin/bootstrap-platform-owner.sql`, `supabase/tests/mfa.test.sql`.
- `scripts/local-database.mjs`, `test-owner-bootstrap.mjs`,
  `test-local-mfa-integration.ts`.
- This report.

Modified:

- `src/lib/auth/core.ts`, `core.test.ts`, `supabase-gateway.ts`, `form-submit.ts`;
  existing `server.ts` exports inherit the strengthened core checks.
- `src/app/auth/error/page.tsx` for generic sign-in failures and the invitation
  setup-to-MFA link.
- `supabase/config.toml` for local TOTP flags and `supabase/tests/rbac.test.sql`
  for explicit synthetic AAL2 contexts; all original 42 RBAC assertions remain.
- `package.json` test commands; `.env.example` comment clarifying shared
  sign-in quota credential requirements, without changing credential values.
- `docs/platform-owner-provisioning.md`, `platform-owner-readiness.md`,
  `auth-flows.md` for current workflow/evidence links.

No dependency was added. Private environment values and the first three
deployed migration files were preserved. The temporary local test server is
stopped; the local Supabase services remain available with TOTP enabled.

## Stage 2E.3 — browser verification and recovery governance

This stage uses only local PostgreSQL, Auth, Kong/REST and Mailpit. The runner
rejects any API URL except `http://127.0.0.1:65421`. It loads the existing ignored
`.env.integration.local`, overrides the child application's environment explicitly,
binds Next.js to loopback and uses `http://localhost:3000`. Neither hosted test
credentials nor hosted configuration are read or changed. Recovery is enabled
only inside this disposable **local** child process; production recovery remains
disabled and all existing environment files are preserved.

### Browser runner and evidence boundaries

Run `npm run test:auth:mfa:browser` with local Supabase already running and port
3000 free. The runner uses installed Edge (or Chrome) in headless mode, its real
cookie jar, actual hydrated React forms and mouse/keyboard input through the
loopback DevTools protocol. It reuses Next's installed WebSocket implementation;
no browser package or production dependency was added. It is not a mocked DOM
test. A temporary DevTools port/profile is private, never published or reused.
No screenshots, HAR, CDP payload dumps, password-manager exports or QR images
are retained. Disposable TOTP seeds, passwords, codes and tokens stay in process
memory and the browser's required transient DOM; they are never printed.

The browser tests initial sign-in, incomplete enrollment/AAL1, invalid and valid
codes, AAL2 with no staff role, second-factor enrollment, checked sign-out and
cookie cleanup, fresh AAL1 sign-in, and step-up with the backup factor. It then
uses the canonical bootstrap **locally with a disposable fixture**, so recovery
tests exercise real owner permissions rather than assuming MFA grants access.
This is not a founder account or a hosted assignment.

Forgotten-password testing submits the actual browser form, captures one local
Mailpit email addressed to the disposable `example.invalid` mailbox and follows
its fragment link. GET clears the fragment without consuming the token. The
explicit Continue POST establishes an AAL1 recovery session. The reset page
requires MFA; a crafted password POST also redirects to `/auth/mfa` **without
redeeming the durable ticket**. A backup challenge reaches AAL2, the fixed
`Continue password recovery` link returns to `/auth/reset-password`, and the
password update consumes the ticket and signs out. The old password fails;
the new password works but a fresh login is AAL1, with no staff access until MFA.

The MFA return link is derived from a fresh, no-store session response that
checks the current user-bound recovery cookie; it is not a user-supplied return
URL or cached page property. Password updates additionally require matching
live identity, verified JWT claims and successful factor discovery. Missing
assurance or factor services fail closed before redemption. An update failure
after redemption still burns the ticket as before; request a new approved link.
The ten-minute ticket is not extended by visiting the MFA page.

The emergency part uses real local SDK and SQL operations alongside browser
checks. It expires a local browser session and checks staff denial, atomically
suspends the exact fixture with an audit event, globally revokes sessions using
a supported Admin API and an actual disposable JWT held in RAM, verifies no
session rows remain, and checks stale-token Data API denial. Only then does it
remove the fixture's two lost factors while leaving the profile inactive.
Re-enrollment and a real challenge do not restore staff access until a separately
audited local reactivation. The original UUID/owner assignment is preserved.
The replacement-factor portion uses the real SDK rather than browser forms.
It does not reset the app's sign-in quota to make another browser login pass.

Every trusted recovery mutation in this simulation has an approval reference
and a database audit record (suspend, sessions revoked, two factors removed,
reactivate); provider Auth audit history independently records Auth operations.
These are separate transactions: uncertainty after an Auth mutation requires
read-only reconciliation, not blind retry. Incomplete recovery stays inactive.
The runner removes only its own UUID, approval-scoped application audit events,
mail IDs, per-email quota hashes and newly created browser profile. Shared global
quota counters and provider audit history remain. It stops only its own app and
browser processes and does not remove unrelated traces or local project data.

Initial harness runs exposed test timing/selector issues: navigation must wait
for the requested document and the enabled, hydrated button, not click a previous
document or a deliberately disabled pre-hydration control. Those harness fixes
do not weaken the application's Origin guard or enable native form submission.

### Recovery governance — decisions required before owner activation

No custodian, reviewer, successor or notification recipient is appointed by
this document. Record the approved choices privately before provisioning:

| Required decision | Minimum policy |
| --- | --- |
| Recovery executor | Trusted Supabase infrastructure administrator with independently secured MFA and tested access during an application outage |
| Independent reviewer | A different approved person where possible; review the exact UUID, reason, scope, evidence and proposed actions before execution |
| Identity evidence | Pre-established independent contact channel and agreed identity evidence; mailbox control, a chat request or knowledge of company details alone is insufficient |
| Custody | Separately protected owner-controlled primary and backup authenticator devices; infrastructure recovery access kept outside the repository and owner device |
| Notifications | Agreed independent channel for the owner and reviewer; send initiation, sensitive-change, completion and unresolved-failure notices without tokens, seeds or passwords |
| Audit retention | Approval reference, exact target UUID, operator/reviewer identifiers, UTC time, reason, before/after state, action outcome and notification outcome; no secrets |
| Break-glass exception | Explicitly approved exceptional process if two-person review is unavailable; no automatic exception, permanent bypass account, master password or application endpoint |

For loss of one device, challenge a previously verified backup at AAL1 to obtain
AAL2. Verify the exact lost factor and approve its revocation separately; audit
and notify the owner. Enrolling the replacement requires AAL2 while a verified
factor remains. A copied primary seed is not an independently held second
factor. Inventory factor IDs privately so the wrong device is never revoked.

For loss of **all** factors or suspected compromise, keep the exact profile
inactive from first suspension through independent identity review, session
revocation, targeted factor reset, fresh factor verification, credential review
and exact permission verification. Use supported privileged Auth operations
through a trusted administrative channel only. Do not request JWTs or secrets
in chat. If no usable JWT is available for supported global sign-out, stop and
use a reviewed Dashboard/provider-assisted session-revocation procedure; do not
pretend that passing a UUID to `admin.signOut` revokes that user's sessions.
The local drill has a disposable JWT; this does not prove the no-session human
lockout case is operationally solved. Keep staff access suspended meanwhile.

Password recovery alone never resets MFA, activates a profile, changes a role
or grants AAL2. New enrollment alone is also insufficient. Reactivation requires
fresh verified MFA, the original UUID, unchanged approved permission mappings,
confirmation that old factors/sessions are unusable, the reviewer's approval,
an atomic profile/audit transaction and recovery-event notification.

Infrastructure and Auth operations cannot share one transaction. Record intent
before an external action and its verified outcome afterward; if outcome-audit
recording fails, retain the suspension and reconcile through the incident record.
Do not claim the current app automatically supplies approval enforcement,
emergency notifications or a durable cross-service audit workflow: these remain
manual governance and future trusted tooling requirements. No recovery endpoint,
factor-reset endpoint, recovery code or bypass was added here.

Until an independent recovery executor/reviewer and offline contact procedure
are approved and rehearsed, the first owner has an infrastructure single point
of failure. Loss of owner and infrastructure recovery access requires provider
support; it must not be solved by weakening AAL2 policies. A physical authenticator
app/device review, notification drill and no-session lockout rehearsal with the
chosen people remain manual acceptance steps. Automated in-memory TOTP codes
verify the browser/API protocol, not a physical phone or independent human.

### Manual browser acceptance procedure

If a browser binary/runner is unavailable, mark browser tests **not executed**.
Use a separately approved disposable **local** mailbox/identity, never a founder:

1. Start the local stack, apply only local migrations and launch Next using a
   separately loaded local environment; verify the local API URL and localhost
   trusted Origin before entering credentials. Never run a default launcher
   that loads hosted `.env.local` for these tests.
2. Sign in at `/auth/sign-in`, open `/auth/mfa`, enter the displayed setup key
   into a test authenticator privately, and verify a current code. Check AAL2
   and pending activation for an unassigned identity.
3. Add a separate backup authenticator while AAL2; verify it, sign out, check
   authentication/flow cookies are absent, then sign in again. Check AAL1 and
   no staff access. Try an invalid code, then challenge the backup successfully.
4. Request local recovery through `/auth/forgot-password`; open only that local
   Mailpit message. Confirm GET is inert, click Continue once, complete the MFA
   handoff and reset. Check sign-out and a fresh AAL1 login with the new password.
5. Use the automated SQL/SDK drill for destructive local recovery actions, or a
   separately reviewed exact-UUID administrative plan. Never reset real factors,
   bypass permissions or modify the hosted project as a testing shortcut.
6. Remove only the approved local fixture/mail/test records and private browser
   profile. Never share a HAR, cookie export, setup key, password or email token.

### Hosted release gate

At the conclusion of Stage 2E.3 the MFA migration was **local only**. Hosted deployment was not approved
by those tests. It required separate reviewed backup/restore, conflict inspection,
the expected-only dry run, explicit migration approval and post-deployment RLS
verification. Before founder activation also approve custodians, identity review,
notifications, independent recovery access, current hosted TOTP configuration
and browser/HTTPS security. Keep hosted/production recovery disabled pending its
own approved configuration, delivery and end-to-end verification. No founder
invitations, hosted data changes or deployments occurred in Stage 2E.3.

### Stage 2E.3 validation record

| Check | Result |
| --- | --- |
| Mocked/unit/rendering authentication tests | 73/73 passed; two added cases cover pre-redemption MFA step-up and fail-closed assurance/factor lookup |
| Real Edge + local Auth/SSR/Mailpit/SQL | 71/71 explicit checks passed, including browser cookie attributes/cleanup, network URL privacy, backup factor, password recovery and emergency recovery |
| Real Auth/HTTP/SSR integration | Existing 45/45 checks passed again, including forged JWT, inactive account, expiry and stale-token denial |
| Real PostgreSQL pgTAP | 92/92 passed across all three test files |
| Canonical local owner bootstrap | 30/30 passed, including audit failure rollback and concurrent winner 1/2 |
| Real PostgreSQL concurrency | Ticket 1/12; email quota 3/12; global quota 30/33 — all expected limits passed |
| TypeScript / ESLint / production build | Passed |

The emergency simulation is an automated technical drill, not approval to run
it against the hosted owner. The physical phone/backup-device and human recovery
governance checks above remain open. No existing deployed SQL or new migration
was changed in this stage. Changes are limited to the recovery/MFA handoff,
pre-redemption assurance checks, regression tests, browser runner and this guide.

Read-only cleanup verification found zero local Auth users, profiles, role
assignments, flow tickets and Mailpit messages. The catalog still has 4 roles,
18 permissions and 31 mappings. Both test launchers stopped their own development
processes; port 3000 has no remaining test listener. Sixteen generated production
browser scripts were inspected in memory: neither the local privileged key nor
signing secret, nor the Auth-store secret variable name, was present. The private
environment files and browser-test directory remain Git-ignored. This targeted
scan is evidence about those bundles, not a guarantee against extensions/XSS or
all possible infrastructure logging.

Stage 2E.3 files: `scripts/test-local-mfa-browser.mjs`, `package.json`,
`src/lib/auth/password-mfa.ts`, `password-operation.ts`,
`password-operation.test.ts`, `password-response.ts`,
`src/app/auth/reset-password/page.tsx`, `src/app/auth/mfa/session/route.ts`,
`src/components/auth/mfa-panel.tsx`, and this document. Prior Stage 2E.2 work
was preserved. No dependencies or database migrations were added in Stage 2E.3.
