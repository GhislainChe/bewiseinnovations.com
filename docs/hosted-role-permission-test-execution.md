# Stage 2E.13 — controlled hosted role test, execution checkpoints

Subsequent separately authorized cleanup completed in Stage 2E.14; see the
[cleanup result](./hosted-role-test-cleanup-result.md). Retained temporary records
described below are historical checkpoints, not the current hosted state.

## Final execution result — reviewed AAL2/AAL1 probes PASSED

The saved genuine-caller AAL1 result at 2026-10-27T20:24:04Z independently
matches the user's report: passed=true, assuranceMatched=true, expected=aal1.
All eleven tested permission decisions were false. Direct caller RLS queries
returned ownProfileCount=0, ownAssignmentCount=0 and visibleAuditCount=0,
despite the known active profile and content role. Together with the recorded
AAL2 result below, this verifies permission-positive content decisions only at
AAL2 and denial of the tested owner/admin/business permissions at both levels.
No client-supplied assurance override, business write or hosted self-assignment
write was attempted; those distinctions and prior local evidence remain below.

Final read-only inspection at 2026-10-27T20:25:13Z confirmed the exact confirmed
disposable identity, one verified replacement factor, one intended active test
profile, one content_community_lead assignment and exactly one matching binding
audit event. The four migrations/catalog digests and 4/18/31 counts remain
unchanged. No additional audit, profile or assignment was created. There is one
live AAL1 session and one unrevoked refresh record from the approved fresh login;
the earlier tested AAL2 session remains absent. This is not a final sign-out or
cleanup claim. No raw credentials or caller cookies were persisted by the probe.

The completed AAL1 bridge was stopped after verifying its exact process identity.
The normal application was not stopped. Both bridge results and final snapshots
remain private. **Temporary profile, role assignment, audit record, Auth identity
and verified factor remain in place.** No unbinding, account deletion or factor
change was executed. Any cleanup requires separate explicit approval; audit
retention must follow the reviewed cleanup procedure. No founder onboarding began.

## Password-only login checkpoint — AAL1 confirmed

The user reported aal1. Read-only hosted verification at
2026-10-27T20:14:58Z confirmed one fresh live AAL1 session, the previous tested
AAL2 session absent, and unchanged temporary profile, sole content role, audit
event, verified replacement factor and catalog counts. One unrevoked refresh
record belongs to the normal new login. No MFA challenge was performed by the
agent. The private one-use browser-session bridge is prepared in AAL1 mode;
permission/RLS results remain PENDING the user's explicit probe POST.

## Sign-out checkpoint — PASSED

The user reported successful sign-out and absence of the project's authentication
cookie and its .0/.1 chunks. Read-only hosted verification at
2026-10-27T20:03:56Z confirmed the tested AAL2 session is absent, no sessions
remain and refresh-token record counts are zero (including unrevoked records).
No additional sign-out or revocation was performed by the agent.

The exact confirmed identity and verified replacement factor remain intact.
The single temporary profile, content_community_lead assignment and binding audit
event remain unchanged, as do migration/catalog digests and 4/18/31 counts.
The private after-sign-out snapshot is retained. A fresh password-only login and
genuine AAL1 caller probe remain PENDING; the user must stop before entering TOTP.

## AAL2 caller-session permission probe — PASSED

The user clicked the one-use bridge and supplied its sanitized result. The
matching private server result was independently read and checked: passed=true,
assuranceMatched=true, expected=aal2. All four content permission decisions
were true; team.manage, roles.assign, settings.manage, audit.read,
inquiries.read, registrations.read and waitlists.read were false. The genuine
caller Data API returned ownProfileCount=1, ownAssignmentCount=1 and
visibleAuditCount=0 despite the known binding audit record. The adapter also
verified the exact sole content role, exact four permissions and replacement
factor before probing. No service-role client or admin SQL supplied the caller's
authorization/RLS decisions. No business operation or hosted write attempt ran.

These are permission decisions, not a claim that content publishing or an owner
dashboard exists. Self-assignment is corroborated by reviewed hosted grants and
prior local negative-write tests, not a new hosted INSERT. The completed AAL2
bridge was stopped. Temporary membership and the binding audit remain unchanged;
no unbinding or cleanup was performed. AAL1 denial and its sign-out/login/cookie
checkpoints are still PENDING. Next manual step: one normal local-scope sign-out,
then stop before the fresh password-only login for read-only session verification.

## Latest checkpoint — temporary binding committed and verified

The user explicitly clicked the Auth-only preflight and reported success. Its
private record verified the genuine caller's exact confirmed UUID/email,
authenticated JWT role, AAL2/expiry, session ID and pinned replacement factor
using a publishable-key SSR client. A fresh read-only database check then matched
that exact browser session to a live AAL2 session/factor; the reviewed source
hashes matched. The account remained active with no existing team records.

The canonical binding transaction was executed **once**, guarded by an exclusive
private attempt marker. The command succeeded. Subsequent read-only verification
confirmed **one active test profile**, **one content_community_lead assignment**,
and **one test.staff_binding audit event** with matching run, UUID, approval and
factor reference. The role has exactly the four content permissions. There is
no owner assignment or other profile. The total application audit count increased
by exactly one. Role-permission/migration digests, four migration records,
4/18/31 counts, replacement factor and recorded session state remain unchanged.

The authenticated role lacks assignment/profile write grants, corroborating
self-assignment denial without attempting an unapproved hosted INSERT. Existing
local rejected-write tests remain evidence; a new hosted write attempt was
**NOT EXECUTED**. No unbinding, profile deletion or cleanup is authorized.

The completed port-3013 helper was stopped. The one-use private permission
bridge was launched in AAL2 mode on 127.0.0.1:3012; its initial GET is inert.
**AAL2 permission/RLS results are PENDING the user's explicit probe POST**.
No permission-positive probe was performed by the agent or an admin client.
AAL1 testing and subsequent session/cookie checkpoints remain PENDING.

Private binding before/after snapshots, one-attempt marker, command result and
verified audit UUID are retained under the protected stage directory. Exact
temporary records must remain in place unless separately authorized for cleanup.
If a permission probe fails, stop and preserve this binding unchanged.

The earlier preflight table below describes the previous checkpoint.

## Authorized scope

Project **onfxxtvfprjnqsxdmhkp**; only the original privately pinned disposable
UUID/email for hndstudy2026@gmail.com. Explicit authorization permits exactly
one temporary profile, one content_community_lead assignment, one binding audit
event, read-only caller-session permission probes and this account's normal
sign-out/login steps for AAL1 testing. **No unbinding, profile deletion, Auth
deletion, factor change, owner operation or additional role is authorized.**
This supersedes the optional cleanup proposal in the Stage 2E.12 document.

## Current status — before browser preflight

| Check | Status |
| --- | --- |
| Linked project and bounded read-only connection | PASSED |
| Confirmed active exact UUID/email and no other Auth identity | PASSED via read-only identity predicates |
| Pinned verified replacement factor; retired factor absent | PASSED |
| One linked AAL2 session with valid recorded session lifetime | PASSED as database metadata |
| Zero profiles/assignments; unchanged 4 roles, 18 permissions, 31 mappings | PASSED |
| Four migration records/catalog digest unchanged | PASSED |
| Re-review/freeze binding and harness files; focused regression checks | PASSED, 5/5 local bridge tests |
| Genuine browser UUID/email, verified JWT AAL2/expiry and pinned factor | PENDING user POST |
| Temporary binding and binding audit | NOT EXECUTED |
| Hosted AAL2/AAL1 permission/RLS probes | NOT EXECUTED |
| Hosted staff self-assignment write attempt | NOT EXECUTED; not in read-only scope |
| Local negative self-assignment/forged-assurance regression evidence | Previously passed; not a new hosted write test |
| Cleanup | NOT AUTHORIZED |

The current files were re-reviewed against the Stage 2E.12 source and focused
tests, then SHA-256-frozen privately for this run. No historical hash manifest
was claimed to exist for Stage 2E.12. Check the frozen hashes again immediately
before binding and refuse any unreviewed change.

## Required manual pre-binding browser checkpoint

A private one-use Auth-only helper listens at **http://localhost:3013** on
127.0.0.1. Its GET is inert. In the same browser/profile, the user clicks
**Verify current AAL2 identity once**. It verifies getUser/getClaims with the
publishable-key SSR client, exact UUID/email, JWT authenticated role, AAL2,
expiry and replacement-factor identity. Only provider GET identity/JWKS reads
are permitted; refresh/logout/writes and staff-data reads are blocked. A missing
or expired session fails closed and stops the stage; no token is consumed from
an email and no sign-in or factor challenge is performed by the helper.

The callback uses strict localhost Host/Origin, an in-memory random CSRF nonce,
explicit CORS fetch, empty POST, no forwarded headers, duplicate suppression,
no-store/no-referrer and CSP. Tokens/cookies stay in request/process memory;
only verified identity/session/factor references and expiry metadata are saved
privately, never raw credentials. Output is a fixed success/failure message.
No service-role credential is used for the browser check.

Stop for this user interaction before the atomic binding. Once it passes,
recheck the exact verified browser session ID against a live AAL2 session and
the pinned factor in the database, verify the frozen files and execute the
already-approved binding once. No re-request of the existing authorization is
needed. On any failure or ambiguous mutation result, stop, reconcile read-only
and leave any existing temporary binding unchanged.

Private run records live in the protected Git-ignored Stage 2E.9 directory:
the current approval manifest, reviewed-file hashes, database preflight, future
browser preflight and future exact binding-attempt/result records. No public
report prints their UUIDs, factor IDs, cookies or tokens. The normal localhost
app remains available; no second port-3000 server was started.
