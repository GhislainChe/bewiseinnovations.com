# Stage 2E.14 — controlled hosted test cleanup

**PASSED.** Cleanup completed on 27 October 2026. Final read-only database
observation: **2026-10-27T21:49:05Z**. Project: **onfxxtvfprjnqsxdmhkp**.
No founder onboarding or additional development stage was started.

## Identity, dependencies and authorization

The linked project reference, fixed hosted API URL and session-pooler database
username/project suffix matched. The original protected invitation record's UUID
was independently matched to the confirmed disposable identity
**hndstudy2026@gmail.com**, the approved run, binding audit and replacement-factor
records. Exact identifiers remain in the private ledger rather than this report.

Preflight found exactly one Auth identity, one active temporary profile bearing
the exact run label, one content_community_lead assignment and no other role.
There was one verified pinned TOTP factor, one session, one refresh-token record,
and one flow ticket with no usable redemption remaining. One binding audit and
12 shared recovery-quota records were inventoried. No password/hash, factor
secret, cookie or access/refresh token was retrieved.

Catalog inspection confirmed Auth identity/session/factor/challenge dependencies,
the application ticket's ON DELETE CASCADE reference to auth.users, and the audit
actor's ON DELETE SET NULL reference to team_profiles. Both test audit actors are
null; their resource UUID and metadata references are retained. The only custom
application trigger is the existing profile-updated-at trigger. No target-owned
Storage objects, OAuth authorizations/consents, WebAuthn records, SCIM links or MFA
recovery-code sets were found. No unrelated identity existed in the deletion set.

## Executed changes

1. The previously reviewed `supabase/admin/unbind-disposable-content-test.sql`
   matched its frozen SHA-256 review record. It ran once on a dedicated bounded
   administrative connection with the exact UUID/email/run/binding audit and
   Stage 2E.14 cleanup approval. It atomically removed the single content role
   assignment and temporary profile and inserted one `test.staff_unbinding`
   audit event. Read-only reconciliation passed before Auth deletion.
2. The UUID/email and confirmation state were independently checked again using
   the server-only Admin client. One supported
   [Supabase Admin deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
   request hard-deleted that exact identity. A fixed-origin/path transport guard,
   exclusive attempt record and request counter prevented an automatic second
   deletion request. Supabase accepted the request. No direct deletion from
   Auth-owned SQL tables was performed.
3. Read-only reconciliation verified the actual resulting state and cascades.
   No separate factor removal, session revocation, quota reset, audit deletion,
   schema change or migration-history repair was executed.

Auth deletion and application unbinding were separate operations, not one
cross-service transaction. Both succeeded; no partial cleanup remains.

## Final verification

| Check | Actual result |
| --- | --- |
| Disposable Auth UUID and exact email | Absent; total Auth users zero |
| Temporary profile and assignment | Absent; total profiles/assignments zero |
| Target sessions and refresh tokens | Zero, including unrevoked refresh records |
| Target factors, identities, MFA challenges and one-time tokens | Zero |
| Target flow tickets | Zero; the redeemed record cascaded with Auth deletion |
| Binding audit | Original full-row digest unchanged |
| Cleanup audit | Exactly one new matching `test.staff_unbinding` event |
| Retained application audit history | Two events: binding and unbinding |
| Shared recovery-quota records | All 12 retained; full aggregate digest unchanged |
| Application roles / permissions / mappings | 4 / 18 / 31, unchanged mapping digest |
| Migrations | Four original versions; full history digest unchanged |
| RLS and security tables | Eight tables remain, all RLS enabled |
| Restrictive MFA policies | Six remain; full policy snapshot unchanged |
| Security functions, definitions and grants | Snapshot unchanged |
| Database dependencies and application triggers | Unchanged |
| Private schema exposure | Data API rejected app_private with HTTP 406 / PGRST106 |
| Other identities | None before or after; no unrelated identity deleted |

Migration versions remain `20261021010000`, `20261021010100`,
`20261023010000` and `20261026010000`. No migration was deployed.

## Validation and retained evidence

- **58/58 real local PostgreSQL transaction assertions passed**, including exact
  identity/role guards, rollback on audit failure, retained audits and one-winner
  binding/cleanup concurrency. These used disposable local fixtures only.
- **5/5 focused session-bridge tests passed**, including real loopback HTTP with
  a mocked probe callback. These are not additional hosted browser tests.
- No application source, schema or previously deployed migration changed, so a
  production build and broad suites were not repeated for this cleanup-only stage.

Private before/after catalog snapshots, original identifiers, one-attempt markers,
command outcomes and completion record are retained in the protected Git-ignored
`.supabase/hosted-mfa-stage-2e9/` directory (`stage2e14-*`). The local operational
runner `cleanup-stage2e14.mjs` is private and not a public endpoint. Its destructive
modes must not be repeated; exclusive markers prohibit them. No credential values
were printed or included in documentation. Existing private backups, diagnostics
and source files were not deleted.

## Remaining limitations

Deletion of server sessions/refresh records is verified. Previously issued JWTs
may remain cryptographically valid until expiry; no real old token was retrieved
or replayed to test it. Staff access still requires the existing live session,
verified factor, active profile and role checks, whose supporting records are
now absent. No claim of instantaneous global JWT cryptographic invalidation is
made. Browser cookie absence was not newly tested after Admin deletion; stale
local cookie material may remain until normal application/browser cleanup.

This completes the approved Stage 2E hosted invitation, single-computer MFA,
content-role AAL2/AAL1 authorization test and disposable-account cleanup scope.
It does not establish independent-device/backup-factor readiness, emergency
recovery governance, production password recovery or founder activation readiness.
Production recovery remains disabled. No email was sent, Auth setting changed,
founder account created, owner bootstrap executed or website deployed.

Files added in this stage: this report and the Git-ignored private operational
runner/evidence. The previous execution report gains a pointer to this result;
its earlier retained-record statements describe historical checkpoints.
