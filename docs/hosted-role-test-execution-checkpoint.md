# Stage 2E.12 — temporary role-test execution checkpoint

**Ready to submit a narrowly scoped execution request; no execution is authorized
by this report.** No hosted profile/role was created, permission probe run,
session revoked, factor changed, identity deleted or migration/setting changed.

## Current pinned state

A fresh bounded read-only query matched project **onfxxtvfprjnqsxdmhkp**, the
original confirmed UUID/email for **hndstudy2026@gmail.com**, exactly one verified
replacement TOTP factor and one AAL2 session linked to it. The retired factor is
absent; no other Auth identity, staff profile or role assignment exists. The
four migration records and role-permission digest still match the baseline:
**4 roles / 18 permissions / 31 mappings**. Exact identifiers and observation
time are in the protected Git-ignored `stage-2e12-readiness.json` record.

This establishes database metadata, not freshness of the browser's present
access JWT. The execution flow must verify the genuine caller through getUser
and getClaims; expired/missing/mismatched credentials stop the probe. No token
or setup secret was fetched for this checkpoint. Factor replacement is recorded;
independent seed secrecy/device security is not claimed.

## Harness now wired privately

`scripts/serve-hosted-permission-test.ts` adapts the existing server-only probe
to a **separate, one-use localhost process**, not a Next.js or deployed route.
It binds only **127.0.0.1:3012** and accepts browser Host/Origin
**http://localhost:3012**, no forwarded headers, a random in-memory nonce and an
empty explicit CORS-mode POST. GET renders an inert page and never probes Auth.
One submitted request consumes the process's attempt; duplicate POSTs are denied.
The page disables its button and never retries or redirects automatically.

The actual browser sends its normal host-only localhost SSR cookie across ports.
The adapter parses it in memory and constructs a publishable-key SSR client.
It never constructs a service-role client, stores a token/cookie in a file,
returns it to the page, places it in a URL or logs a raw error/request/header.
Provider transport is restricted to GET/HEAD on the fixed Auth identity/JWKS and
six reviewed RBAC read paths. POST refresh, sign-out, RPCs, data writes and other
origins/paths are blocked. Thus an expired session fails closed instead of
performing a hidden refresh. Cookie updates are not emitted by this read-only
adapter. The normal app owns any separately approved reauthentication.

The adapter pins the verified replacement factor. For the AAL2 positive probe,
it also requires exactly content_community_lead and exactly its four permissions
before displaying permission results. Output is reconstructed from fixed
booleans and own-row/audit counts; only that safe summary/run reference is saved.
Unexpected data/permissions fail the expected result; no correction is attempted.
The page has no third-party assets, no-store/no-referrer and restrictive CSP.

Before startup, a trusted operator must create the private approval record
`.supabase/hosted-mfa-stage-2e9/content-permission-run.json` **after explicit
execution approval**, with these exact fields:

| Field | Value |
| --- | --- |
| project | onfxxtvfprjnqsxdmhkp |
| userId, email | Original private UUID and approved disposable mailbox |
| factorId | Pinned verified replacement factor UUID |
| roleCode | content_community_lead |
| runId | New permission-test-UUID run reference, shared with binding SQL |
| approvalReference | Actual user execution-approval reference |
| operations | Exactly the single entry permission_reads |

The record is currently **absent**. The bridge was **not started** and no hosted
probe was executed. An operator record references approval; it is not a
cryptographic substitute for the actual user instruction. The local test
runners cannot be redirected to hosted Supabase and must not be used as launchers.

## Binding and cleanup

The reviewed `supabase/admin/bind-disposable-content-test.sql` remains unchanged:
confirmed exact UUID/email, empty team baseline, pinned replacement/retired-factor
checks, live linked AAL2 session, exact content mapping, serialization locks,
atomic profile + sole assignment + binding audit. No role parameter allows
platform_owner or any other role. Operator inputs must come from the private
original/pinned ledger, not arbitrary browser values.

Unbinding remains an exact UUID/email/run/profile-label/sole-role transaction
requiring the original binding audit ID. It deletes only the test assignment
and profile and inserts one cleanup audit atomically. Retain both minimal audit
events and shared quotas. Auth identity/factor deletion is **not** part of the
minimal permission test or this proposed unbinding approval. Do not revoke an
unrelated session or reset counters. Partial/uncertain outcomes require read-only
inspection, never blind retries.

## Minimal approved sequence (proposed, not executed)

1. Obtain explicit approval for the following exact mutation list and test
   scope. Freeze the run ledger. Recheck identity, replacement factor, current
   role mapping and zero membership. Have the user confirm current AAL2 in the
   normal localhost app; any necessary refresh/login/challenge must fall within
   the separately approved normal authentication scope, not the probe.
2. On the reviewed dedicated admin connection, load exact pinned values and
   execute the existing binding transaction once. Record its audit UUID and
   verify exactly one profile and the sole content-role assignment read-only.
3. Populate the private approval record from that explicit approval/run. Launch:

   ```powershell
   node --conditions=react-server --import tsx scripts/serve-hosted-permission-test.ts aal2
   ```

   In the same browser/profile, open http://localhost:3012 and click its probe
   button once. Expected: four content permission decisions true; owner/admin,
   private inquiry/registration/waitlist and audit permissions false; own profile
   and assignment counts one; visible audit count zero. No content publishing,
   owner bootstrap or real business operation is executed. Stop on failure.
4. Stop that identified bridge. User performs checked **local-scope** sign-out
   and fresh password-only login in the normal app, with no MFA challenge yet.
   Recheck the exact account's AAL1 state. Launch the same command with `aal1`,
   then one explicit POST: all permission decisions false and known own rows
   hidden by RLS. Stop the bridge. No repeat MFA test is needed if these two
   checks suffice; any extra challenge must be separately in scope.
5. Perform checked sign-out for the test session; inspect cookie presence and
   exact affected session state without recording values. Execute the separately
   approved canonical unbinding transaction. Verify zero membership, retained
   audit events and unchanged 4/18/31 catalogs. Preserve the disposable identity
   and replacement factor; account deletion requires a different approval.

### Exact minimum mutation list

- Binding: **one profile INSERT, one assignment INSERT, one audit INSERT**.
- Normal approved browser authentication: sign-out, one fresh password login
  and final sign-out; provider-managed session/refresh/audit state and ordinary
  rate-limit counters change normally. No shared quota reset. A fresh AAL2
  challenge is needed only if current authentication is stale before execution.
- Unbinding, if included in explicit approval: **one assignment DELETE, one
  profile DELETE, one cleanup audit INSERT**; retain both audit events.
- Permission/RLS probes: **GET/HEAD only**, no business-data mutations.

No new account, invitation, role definition, mapping, business table, settings,
migration, founder onboarding or website deployment is required.

## Coverage and focused checks

The existing 58 real SQL transaction assertions and 45 real local Auth/Data API
checks already cover binding/rollback/concurrency, AAL1 denial, AAL2 permitted
and missing permissions, owner guard denial, RLS, inactive/unassigned denial and
actual rejected role self-assignment. They were not broadly rerun here.

The hosted minimal probe does not attempt an INSERT to prove self-assignment
denial: use the deployed authenticated write-grant/policy inventory plus those
local negative tests. Any actual hosted failed-write attempt or temporary
inactive-profile mutation needs explicit additional approval. These are not
silently added to the minimum scope.

New focused bridge tests: **5/5 passed**, including an actual local HTTP server
with a mocked permission callback, inert GET, explicit/duplicate POST behavior,
Origin/Host/nonce guards, fixed safe output, approval pinning and the read-only
provider path/method allowlist. The initial HTTP fixture used Node fetch, which
replaced its Host override; the fixture now uses Node's HTTP client at an
ephemeral test port. No production guard was relaxed. This is not a real hosted
browser probe or another MFA integration pass. The first genuine browser/SSR
probe remains part of the explicitly approved execution.

Run focused checks with `npm run test:permission:bridge`, `npm run typecheck`,
and ESLint on the three new scripts; all passed for this checkpoint. No Next.js application route or migration
was changed. No broad security review or repeat enrollment/device test was run.

**Approval conclusion:** no current metadata blocker remains for submitting the
temporary content-role execution request. Approval itself, actual browser JWT
freshness at execution, and successful first caller-session probe remain gates.
Stop on drift, expiry, factor mismatch, unexpected permissions or ambiguous SQL
outcome; do not grant additional access or retry mutations automatically.
