# Stage 2E.10B — final hosted role-test safety check

Follow-up: [Stage 2E.11 factor removal](./hosted-totp-factor-removal.md) removed
the pinned factor once. The remaining session was downgraded to AAL1 but not
revoked; cleanup and replacement enrollment remain pending. The factor-state
findings below are the historical pre-removal safety check.

**Decision: BLOCKED for hosted role binding. Read-only preparation review only.**
The content role is narrow, but its assignment is real authorization, not an
isolated test tenant. Do not use this report as approval to bypass factor
mitigation, create a profile, bind a role, revoke sessions or delete an account.

## Fresh identity and hosted inventory

The link and session-pooler identity matched **onfxxtvfprjnqsxdmhkp**. Catalog
queries ran in an explicit read-only transaction. Four deployed migration
versions match the four local files: 20261021010000, 20261021010100,
20261023010000 and 20261026010000. Counts remain 4 roles, 18 permissions,
31 mappings, one Auth identity, zero team profiles and zero assignments.

The broad enrollment-history helper failed without sufficient error detail to
establish why. A single narrower bounded SELECT-only check succeeded at
**2026-10-27 14:43:30 UTC / 15:43:30 Africa/Douala**. It matched the exact UUID
from the original private invitation-result record to the confirmed email
hndstudy2026@gmail.com; that mailbox matched exactly one Auth user. There were
no other Auth identities. One verified TOTP factor with the earlier creation
timestamp and one session remain. No factor seed, token, password hash or
credential was retrieved or compared. The UUID and snapshots remain private
in the Git-ignored stage directory. The initial helper failure is unresolved,
not evidence of a security-state change.

The inspected public/app_private ordinary-table inventory is exactly the six
RBAC tables and two Auth-security tables, all RLS-enabled, with no anonymous
SELECT or ordinary authenticated write grant. No customer/content/business
tables or founder profiles are present within this inventory. This is not an
audit of every Supabase service, Storage object, exposed view or future schema.

## Isolation and permission scope

Reviewed `scripts/permission-test-harness.ts`, existing application guards,
the canonical binding/unbinding SQL and the local integration cases.

The private probe verifies the exact expected caller identity, uses its actual
authenticated client and existing requirePermission checks, and returns only
fixed permission decisions, assurance and counts. It performs no INSERT,
UPDATE, DELETE, UPSERT, role mutation, owner bootstrap or business operation.
Its direct reads are own profile IDs, own assignment keys and an RLS-filtered
audit HEAD/count. Authorization also reads that caller's profile/name and
role/permission catalogs; it does not fetch customer records, founder profiles
or audit payloads. The temporary profile contains a test label only. No public
probe endpoint, browser service credential or general privileged SQL interface
exists. Auth verification can involve normal provider/session handling; this
is not a claim that every future authenticated request is externally side-effect-free.

The content role has exactly content.create, content.publish, content.read and
content.update. It lacks team.manage, roles.assign, settings.manage, audit.read
and private inquiry/registration/waitlist permissions. The SQL has no selectable
role parameter, checks the exact mapping and creates one profile/assignment and
one approval-linked audit event atomically. It rejects conflicting team state,
reused runs, mismatched confirmed identities and missing factor prerequisites.

This is sufficient **conditional scope for a future permission-decision test**,
not a guarantee that a potentially compromised identity can safely receive a
real role. Binding would affect all genuine sessions of this identity. Freeze
and recheck the inventory and mapping immediately before any future approved
binding; stop if real content/data, extra roles or unexpected access appears.
Do not execute content publishing or an actual owner operation to test denial.

## Coverage and readiness

| Boundary | Existing evidence / pending hosted work |
| --- | --- |
| Assigned AAL1 denied | Tested with real local Auth and caller Data API; hosted case not run |
| Assigned AAL2 permitted | Four content permission decisions and own-row visibility tested locally; no business publishing claim |
| AAL2 missing permission / owner denial | team.manage, roles.assign, settings.manage and private/audit permission checks denied locally; owner bootstrap never invoked |
| Direct RLS | Real local caller JWT, AAL1/AAL2 own-row visibility, inactive denial and private schema restrictions tested |
| Self-assignment / escalation | Ordinary assignment INSERT, profile UPDATE and privileged RPC denied locally; grants reviewed read-only remotely |
| Unassigned / wrong identity | Local probe denial and exact-user mismatch rejection tested; current hosted zero membership confirmed |
| Transaction failure / concurrency | 58 local assertions previously passed, including audit-trigger rollback and one winner out of two binding and cleanup attempts |

Stage 2E.10 previously passed 45 real local Auth/Data API/harness checks, 92 pgTAP
assertions, 78 authentication tests, concurrency, TypeScript, ESLint and build.
Those tests were reviewed, **not rerun in this diagnosis-only stage**. No
application code, database policy or migration changed here.

The harness is a callable server-only module, not an executable hosted browser
bridge. Secure localhost-only wiring to the approved user's SSR session still
needs implementation/review and an explicit test scope. Never transfer browser
cookies/JWTs into chat, files, shell arguments or a public endpoint. Negative
write attempts and inactive-profile changes need their own hosted approval.

## Factor and cleanup blockers

Factor verification/AAL2 does not prove the historical setup secret stayed
private. The current factor is **not accepted as uncompromised**. The existing
binding SQL requires a pinned replacement factor, absence of the pinned retired
factor, reviewed mitigation evidence and a live replacement-factor AAL2 session
with other sessions reconciled. A mitigation string alone is not proof; do not
supply an unrelated retired-factor UUID to evade this operational safeguard.
Use the separately approved replacement procedure in the preparation report.

Cleanup remains prepared and separately approval-gated: verify the exact
UUID/email/run/profile label/sole role and original binding audit UUID; execute
atomic unbinding; retain minimal binding/unbinding audit events; verify no
membership remains; then, only if separately approved, perform supported Admin
deletion of the same disposable UUID. Reconcile Auth cascades, sessions, factors,
challenges and flow tickets read-only. Stop on partial or unexpected outcomes.
Preserve role catalogs, unrelated records and shared quota counters. Never
reset shared tables or delete managed Auth rows through administrative SQL.
If no binding ever occurs, do not manufacture membership merely to run unbinding.

## Minimum mutation scope for later approval

1. **Mitigation prerequisite:** remove only the pinned uncertain factor through
   supported Auth tooling; reconcile/invalidate this disposable account's old
   sessions; enroll and verify one replacement primary factor. These operations
   change provider-managed factor/challenge/session records and are not authorized
   now. Preserve the account UUID and all unrelated identities.
2. **Role test:** one temporary active profile, one content-role assignment and
   one binding audit insert. Normal explicitly approved sign-ins/MFA challenges
   create/update test sessions and consume normal shared quotas; checked sign-out
   invalidates only its intended session. The permission-decision/SELECT-only RLS
   probes require no business-data writes or new application tables.
3. **Optional additional cases:** inactive-profile denial requires one exact-user
   deactivation and restoration with reviewed auditing; real hosted failed-write
   probes require explicit attempt approval. Keep these local if not approved.
4. **Cleanup:** delete the one assignment and profile and insert one cleanup audit
   atomically; supported Auth deletion is a distinct separately approved step
   with verified cascades. Retain audit history and shared quotas unless a new,
   exact retention decision approves otherwise.

No further hosted actions are cleared by this stage. Exact next approval should
address factor-security mitigation first, not role assignment. Hosted session
bridge review, narrowly scoped test authorization and cleanup approval follow
only after mitigation evidence passes. No founder account, invitation, role,
configuration change, migration or deployment is involved.
