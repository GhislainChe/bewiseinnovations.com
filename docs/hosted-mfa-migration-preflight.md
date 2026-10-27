# Stage 2E.4 — hosted MFA migration preflight

**Deployment update:** the separately authorized Stage 2E.6 deployment completed
on 26 October 2026. The fourth migration is applied and the final dry run has no
pending migrations. See the [deployment result](./hosted-mfa-deployment.md) for
post-deployment evidence, verifier issues and remaining hosted behavioral tests.
The preflight findings below describe the historical state before deployment.

Reviewed 26 October 2026. Target: `onfxxtvfprjnqsxdmhkp`, database `postgres`,
PostgreSQL **17.11**. Hosted work was limited to read-only catalog/API queries
and the requested migration dry run. No migration, account, email, assignment,
Auth configuration, application deployment or production recovery change occurred.

## Hosted findings

The exact project reference was checked both in the CLI link file and in the
linked session-pooler username. The connection uses the expected Supabase session
pooler on port 5432 with TLS required. Credentials stay in memory/environment,
never command arguments or output. Connection, statement, lock and client timeouts
are bounded. The catalog inspector explicitly runs `BEGIN READ ONLY` and verifies
`transaction_read_only = on` before accepting its result.

An initial SELECT-only inspection showed that the session pooler did not preserve
the requested startup `default_transaction_read_only` option. No write SQL was
issued. The new inspector was corrected to require an explicit read-only
transaction; the repeated inspection confirmed enforcement. Do not depend on
`PGOPTIONS` alone as a write barrier through this pooler.

Confirmed:

- Remote history contains exactly `20261021010000`, `20261021010100`,
  `20261023010000`; MFA version `20261026010000` is absent.
- Six public RBAC tables and both private Auth-security tables exist, owned by
  `postgres`, with RLS enabled. No additional public/private application tables
  were observed.
- Six existing permissive SELECT policies match the deployed RBAC design. No
  policy names ending in `_mfa` and no `has_aal2_session` function exist in the
  inspected public/private schemas. There is no proposed object-name conflict.
- Anonymous roles have no table SELECT access. Authenticated roles have SELECT
  only on RBAC tables, without INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER.
  Both Auth-security tables deny direct access to ordinary API roles and
  `service_role`.
- Four public Auth-store functions retain only the intended `service_role`
  execution grant; PUBLIC/anon/authenticated cannot execute them. Existing
  private authorization helpers are caller-scoped, use an empty search path,
  and retain the reviewed authenticated-only execution grants.
- Role catalog: **4 roles, 18 permissions, 31 mappings**. Owner has exactly 18;
  Technical Lead has only `technical.read`, `technical.manage`,
  `audit.technical.read`; Operations Lead has the six inquiry/registration/
  waitlist permissions; Content & Community Lead has four content permissions.
- **0 Auth users, 0 team profiles, 0 role assignments** were observed. No founder
  activation has occurred.
- All nine required Auth columns exist with compatible types: sessions
  `id/user_id/factor_id` UUID, `aal` assurance enum, `not_after` timestamptz;
  factors `id/user_id` UUID, `factor_type` and `status` enums. Required enum
  values `aal2`, `totp`, `verified` exist. Extra provider enum values do not
  authorize this application's TOTP-only policy.
- `postgres` has BYPASSRLS and SELECT on both Auth tables, as needed by the
  SECURITY DEFINER helper. Its lookups use existing primary-key identities.
- Final grant recheck confirmed anon/service_role have neither USAGE nor CREATE
  on `app_private`; authenticated has USAGE only, without CREATE. The target,
  three-version history, zero user/profile/assignment counts and absence of
  conflicts remained unchanged.
- Database role settings did not independently report the Data API schema
  allowlist. A separate publishable-key GET with `Accept-Profile: app_private`
  returned **406 / PGRST106**, confirming that private schema is not exposed.
  No private schema exposure or grants were changed.

`node scripts/inspect-hosted-mfa-preflight.mjs` reproduces the bounded inspection.
It accepts no target/SQL arguments and prints catalog definitions/counts only.
Schema inspection completed; there is no unresolved catalog-check blocker.

## Migration security review

Reviewed file: `supabase/migrations/20261026010000_require_staff_mfa.sql`.
SHA-256: `70605be41eaf9837037973f54f5804d433f01c053bac1a237a28950ff203e830`.
The three already-deployed migration files were reviewed and remain unchanged.

The proposed migration adds one private boolean helper, its restricted execution
grant/comment, and six restrictive policies. No DROP, TRUNCATE, DELETE, data
update, seed, owner assignment, public RPC or unrelated schema operation occurs.
The role/permission catalog and existing policies are untouched.

Each new policy applies to all authenticated commands, with USING and WITH CHECK.
It intersects the existing permissive policies: permission/active-profile checks
remain necessary and AAL2 becomes additionally necessary. It cannot independently
grant access or make client writes possible. No recursive team-table query is
introduced into the new helper.

The helper uses verified API JWT claims plus a matching live Auth session owned
by `auth.uid()`, AAL2, future JWT expiry and unexpired session lifetime. The exact
factor referenced by that session must still belong to the user and be verified
TOTP. Enrollment alone, a different user's factor, removed factors, revoked or
expired sessions, AAL1 and forged bearer tokens do not satisfy that boundary.
JWT verification is performed by Supabase's gateway; arbitrary SQL/administrative
connections are a separate trusted boundary, not ordinary browser API access.

The SQL SECURITY DEFINER function has an empty search path, qualified references,
no mutation or parameters, and an authenticated-only EXECUTE grant. PUBLIC, anon
and service_role EXECUTE are explicitly revoked. The private schema remains
non-exposed and unprivileged callers cannot create/replace its objects.

Server `requirePermission` / `getCurrentTeamMember` separately require verified
identity/claims, AAL2, verified TOTP, active matching profile, assigned valid roles
and the individual permission. All authorization reads use the caller's SSR
client and RLS. No business/admin mutation endpoint currently exists.

**Service-role caveat:** a privileged database/service client inherently bypasses
RLS. The current server-only client exposes only four fixed ticket/quota RPC
operations needed before staff assignment. These do not grant staff access.
Every future privileged business operation must independently call the caller's
permission/AAL2 boundary first. This migration cannot secure an unguarded future
service-role operation or trusted administrative SQL.

**Compatibility caveat:** the live-session/factor checks depend on Supabase-owned
Auth catalog columns, beyond a JWT-only policy. They exist remotely now and passed
local real Auth tests. Recheck after provider/Auth upgrades; do not broaden grants
or silently drop those checks if a future schema changes. The existing permission
helpers alone do not enforce MFA, and future tables need their own MFA policies.

## Local validation and preservation

`npm run test:db:fresh` creates a new **network-isolated PostgreSQL 17 container**
and an empty application database. Only the schema of the existing LOCAL Auth
baseline is copied, without rows, ACLs, owners, credentials or hosted data. It
provides the ordinary local Auth roles/functions and pgTAP test extension, then
executes all four unchanged migration SQL files in filename order, each inside
its own transaction as `postgres`. It replays the repeatable role seed once more
and verifies mappings remain 31.

This tests a fresh application installation on a matching Supabase Auth baseline,
not creation of a complete Supabase service cluster from four application files.
The clone's test-only Auth administrator/extension privileges model the local
platform baseline; application grants come from the migrations themselves.
An initial clone run needed the baseline extension-schema USAGE grants for
anon/service_role so pgTAP could report assertions under those roles. Only the
disposable harness was corrected; application grants/migrations were not changed.

All pgTAP, canonical bootstrap and concurrency tests pass in that clone. The
existing scripts can target only the normal local container or a strictly named
disposable preflight container, over its Unix socket; they accept no remote URL.
The clone/container/volume is removed afterward. Existing development data and
Supabase services are preserved. Real MFA/SSR tests run separately against the
existing LOCAL Auth/API stack with disposable identities and cleanup.

Reproduce the local checks with `npm run test:db:fresh`,
`npm run test:auth:mfa:local`, `npm run test:auth`,
`npx supabase test db --local`,
`node --test scripts/logical-backup-expectations.test.mjs`,
`npm run typecheck`, `npm run lint`, and `npm run build`.
Run database/bootstrap/integration tests sequentially; do not run a production
build against the same `.next` directory while a browser test server is running.
After this run, read-only checks found zero local users, profiles and assignments.

| Check | Stage 2E.4 result |
| --- | --- |
| Auth unit/mocked/rendering | 73/73 passed |
| Existing local PostgreSQL pgTAP | 92/92 passed |
| Fresh isolated PostgreSQL pgTAP | 92/92 passed |
| Fresh isolated canonical owner bootstrap | 30/30 passed, including audit rollback and concurrent winner 1/2 |
| Fresh isolated PostgreSQL concurrency | Ticket 1/12, email quota 3/12, global quota 30/33 passed |
| Real LOCAL MFA/Auth/HTTP/SSR | 45/45 passed |
| Restore expectation regression tests | 2/2 passed; reviewed migration prefixes and fail-closed catalog/history checks |
| TypeScript / ESLint / production build | Passed |
| Real Edge browser baseline | Prior Stage 2E.3: 71/71; not rerun for this preflight, which changes no application authentication flow |

## Migration preview

Executed with a 60-second bound:

```powershell
npx supabase db push --linked --dry-run
```

Exit status 0. The only pending file was:

```text
20261026010000_require_staff_mfa.sql
```

No actual push occurred. Stop if a later preview differs, the reviewed file hash
changes, any conflict appears or an inspection/backup cannot complete.

## Backup, recovery and deployment sequence — NOT EXECUTED

Existing recovery sets `20261024T002030Z` and `20261024T003327Z` still match their
recorded integrity hashes and retain successful isolated restore reports. They
predate Auth-security deployment and subsequent test activity, so they are not
a current pre-MFA recovery point. No new hosted backup was needed or created
for this read-only preflight. A fresh one is mandatory immediately before an
approved deployment.

The previous restore verifier hardcoded two migration versions. It now accepts
explicit reviewed two/three/four-version prefixes and verifies the associated
private Auth tables/RLS and MFA-policy/helper presence. Historical no-argument
behavior remains two versions; **use the explicit three-version argument below
for the new pre-MFA backup**. Those expectation branches have automated tests;
a fresh three-version backup/actual restore must still pass before deployment.

Only after separate deployment approval:

1. Reconfirm the exact link/ref, read-only schema findings, zero unexpected
   staff/accounts, current compatibility and reviewed file hash. Stop on drift.
2. Create and verify a fresh private logical recovery set:

   ```powershell
   node scripts/create-hosted-logical-backup.mjs
   node scripts/verify-logical-backup.mjs '<new-private-backup-directory>' --expected-migrations=20261021010000,20261021010100,20261023010000
   ```

   Use the actual timestamped directory printed by the first command, never an
   old/incomplete directory. The creator checks project, restricted parent ACL
   and Git exclusion. It exports schema/data for `public,app_private,auth,storage,
   supabase_migrations`, plus roles, with nonempty files and SHA-256 manifest.
   Each export is bounded to five minutes using the proven session-pooler method.
   The verifier rechecks hashes, loads roles/schema/data with ON_ERROR_STOP in a
   new network-isolated PostgreSQL 17 database and checks restored objects/counts/
   history. Stop if anything fails; preserve the files and development database.
3. Freeze changes for this brief deployment window and rerun:

   ```powershell
   node scripts/inspect-hosted-mfa-preflight.mjs
   npx supabase db push --linked --dry-run
   ```

   Success requires no conflicts and only the exact MFA file pending. The single
   dump components are not a cross-file coordinated snapshot; avoid concurrent
   app/provisioning/admin changes, compare representative source/restored counts,
   and recreate/reverify on drift.
4. Only if approval covers this exact file and all preceding gates pass:

   ```powershell
   npx supabase db push --linked --skip-vault
   ```

   Do not add include-all/seed/role/reset/repair flags or deploy additional files.
   If connection/result is uncertain, stop: read hosted history and objects before
   deciding whether anything applied. Never blindly retry or repair history.
5. Post-deployment read-only verification:
   - `npx supabase migration list --linked`: all four versions recorded, none extra.
   - New helper exists with reviewed body, `postgres` owner, SECURITY DEFINER,
     empty search path, authenticated-only execution and no public mutation RPC.
   - Six new RESTRICTIVE ALL policies have both the expected USING/WITH CHECK;
     the six old permissive SELECT policies and grants remain unchanged.
   - Eight tables retain RLS; 4 roles, 18 permissions, 31 exact mappings remain;
     no profile, assignment, account or test data was introduced by deployment.
   - Private Auth tables still deny direct API grants, four existing Auth-store
     RPCs remain service-only and `app_private` is still not Data API-exposed.
   - Recheck the helper's live Auth dependencies and grants. Run local suites again.
     Actual hosted AAL1/AAL2 user tests require separately approved identity/testing;
     no account or email is implicitly authorized by migration deployment.

The inspector supports both pre/post states: it prints the complete catalog and
flags existing MFA objects as preflight conflicts. **After deployment that
conflict exit is expected**, not a failed migration; assess the expected objects
and history read-only, do not run deployment again to clear it.

### Rollback and forward fix

DDL is additive but taking locks or incorrect Auth assumptions could deny staff
access. Preview does not execute the function or prove real hosted MFA sessions.
Prefer a reviewed forward migration retaining fail-closed behavior. On uncertainty
pause provisioning and keep privileged access blocked; inspect before taking action.

An emergency rollback would require **new explicit approval**. Removing these
six restrictive policies and the helper returns the database to password-only
RBAC, so it is a security downgrade, not a safe automatic availability fix.
Do not execute DROP statements, restore the whole database in place or repair
history as part of this preflight. Prepare/review any compensating migration
separately, retain audit evidence and test it locally first. Whole logical restore
is last-resort disaster recovery with an outage/data-loss analysis and separate
target approval; it is not needed to undo this additive change normally.

Logical recovery does **not** include Storage object bytes, SMTP/Auth settings,
API/JWT/Vault/encryption secrets or all Supabase services. Restored SQL loading
does not prove encrypted Auth/MFA data can be used in another project; provider
encryption-root prerequisites need separate handling. PITR/current hosted restore
points were not newly verified here. Do not treat prior SQL restore success as a
complete service recovery guarantee.

## First-owner activation and remaining gates

After MFA deployment/post-verification is separately approved and completed:

1. Independently verify the real owner's email (still not supplied) and separately
   approve exactly one invitation. Use the reviewed fragment template/localhost
   URLs; no GET consumes its token.
2. Owner confirms by POST and sets a private password. Verify the exact Auth UUID/
   confirmed email; unassigned identity remains pending activation and has no role.
3. Sign in; enroll and verify primary TOTP, then a separately held backup factor
   while AAL2. Check the current session is actually AAL2, not merely enrolled.
4. Physical-device rehearsal: sign out, sign in to AAL1, confirm staff denial,
   challenge each factor in turn and verify cookie/session cleanup. AAL2 without
   a profile/role is still denied. Unassigned users can use own-identity MFA APIs,
   so this ordering does not require a role or create a bootstrap deadlock.
5. Separately approve the canonical bootstrap transaction with the exact reviewed
   UUID/email/approval reference. It atomically creates one profile/owner assignment/
   audit and rejects duplicates/catalog drift. SQL requires at least one verified
   TOTP factor; the reviewer must additionally verify the backup factor and current
   AAL2 session before execution. Enrollment and live session assurance differ.
6. Verify permission-scoped access, audit record, AAL1/inactive/direct-API denial,
   and exact unchanged role/permission mappings under separately approved testing.
7. Approve/rehearse independent recovery executor/reviewer contacts, two-person
   emergency approval where possible, notification channels, session revocation,
   audited suspension/targeted factor reset/re-enrollment/reactivation. No person
   is appointed here. The no-session lockout/provider-assisted revocation path
   and loss of infrastructure access remain operational acceptance requirements.

Losing factors before role binding leaves an unprivileged Auth account; do not
bootstrap around missing MFA. Use separately approved verified-identity Auth
recovery, re-enroll/challenge and recheck the original UUID before binding.
No automatic promotion, MFA bypass, permanent recovery backdoor or public
privileged recovery endpoint exists.

Confirm hosted TOTP enrollment/verification are enabled through the Dashboard
before owner activation; this preflight did not change or establish those flags.
Physical authenticator tests, named custodians, independent identity verification,
emergency approvals/notifications and no-session recovery are still required.
Hosted/production password recovery remains disabled. Future tables/privileged
server operations need explicit MFA/permission guards rather than inheriting
protection automatically.

**Conclusion:** no schema/security incompatibility was found. Migration deployment
can be separately approved with the fresh verified backup and final drift/preview
gates above. This does not authorize deployment or founder activation.

References: [Supabase MFA and restrictive RLS](https://supabase.com/docs/guides/auth/auth-mfa),
[logical backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
and [database backup limitations](https://supabase.com/docs/guides/platform/backups).

Files added: this report, `scripts/inspect-hosted-mfa-preflight.mjs`,
`scripts/test-fresh-mfa-database.mjs`, `scripts/logical-backup-expectations.mjs`
and its test. Updated: local SQL/concurrency test helpers, logical restore
verifier, npm test command and the MFA guide link. No application flow,
deployed migration, pending migration or credential file was changed.
