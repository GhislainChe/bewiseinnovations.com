# Hosted MFA backup checkpoint — existing recovery set verified

**Subsequent deployment:** Stage 2E.6 reused this unchanged, verified pre-MFA
recovery set and deployed only the separately approved MFA migration. See
[the hosted MFA deployment report](./hosted-mfa-deployment.md). The backup still
contains the three pre-deployment migrations; its SQL files were not changed.

## Stage 2E.5D — policy equivalence verified; checkpoint complete

26 October 2026. The existing backup was reused; **no new hosted backup was
created and no hosted changes were made**. The isolated restore passed at
**09:26:32.547 UTC**, after starting at 09:26:19.941 UTC. Subsequent bounded
hosted inspections and the migration dry run passed. MFA migration deployment
can be submitted for **separate explicit approval**; nothing was deployed here.

### Confirmed policy mismatch root cause

PostgreSQL deparses stored policy expressions according to the session's
`search_path`. Qualification in `pg_policies` is reconstructed display text,
not a different function binding. The restored session's path includes `public`,
`auth` and `extensions`; the hosted inspection path is `"$user", public`.
The restored display omits `auth.` because that function is visible there.
The hosted display retains `auth.` because it is not visible on that path.
See PostgreSQL's [catalog information functions](https://www.postgresql.org/docs/17/functions-info.html)
for `pg_get_expr` and `pg_function_is_visible` behavior.

The decisive evidence is from `pg_policy` → `pg_depend` → `pg_proc` →
`pg_namespace`, not text substitution:

| Evidence | Hosted database | Isolated restoration |
| --- | --- | --- |
| Referenced function | `auth.uid()` | `auth.uid()` |
| Function OID | `16538` | `16753` |
| Arguments / return | no arguments / `uuid` | no arguments / `uuid` |
| Other functions named `uid` | none | none |
| Affected policies | `team_profiles_staff_select`, `team_role_assignments_staff_select` | same |

OIDs are database-local and are **not expected to match across restoration**.
Both policies in each database reference its exact `auth.uid()` OID. The
historical source snapshot did not record OIDs; the hosted values above were
obtained in this stage's read-only inspection after local verification passed.
The complete current hosted policy/function/grant snapshots still match that
historical baseline. No shadowing or changed binding was found.

### Fail-closed comparison correction

`policyEquivalenceSql` reparses each saved baseline predicate on an empty
temporary `LIKE` table in the disposable restore database only. It never changes
restored application policies. The reference policies and actual stored policies
are deparsed under the same explicit `search_path=pg_catalog`; temporary objects
are removed by `ROLLBACK`.

The comparison requires the exact policy inventory, schema/table/name, command,
roles, permissive/restrictive mode, canonical `USING` and `WITH CHECK`
expressions, and resolved non-built-in function dependency OIDs and qualified
identities **within that database**. It does not strip qualifications, accept
arbitrary logical equivalence or skip predicates. A stronger but differently
structured expression may still fail, deliberately requiring review. Existing
table RLS/API-grant checks, function definitions/security settings/execution
grants, schema grants and exact permission mappings remain enforced. Isolated
import ownership differences remain the documented exception.

### Existing-backup integrity and actual restore

Private directory:
`.supabase/backups/onfxxtvfprjnqsxdmhkp-20261026T084803Z/`.

All original SHA-256 checksums and file sizes still match `manifest.json`:
`schema.sql` **177,727 bytes**, `data.sql` **34,653 bytes**, `roles.sql`
**370 bytes**; total **212,750 bytes**. Git exclusion was reconfirmed.
All three loaded with `ON_ERROR_STOP` into a new, network-isolated PostgreSQL 17
container. Its container and volumes were removed afterward; the active local
development database was untouched.

Verified restoration:

- Six RBAC tables and two Auth-security tables, all with expected RLS/grants.
- All six RLS policies and seven public/private security functions match.
- Four roles, 18 permissions, 31 mappings, including exact permission sets.
- Exactly the three deployed migration records; no MFA helper/policies yet.
- Zero Auth users, profiles, assignments and Storage object records.
- Auth and Storage schemas loaded (27 and eight tables respectively).

No SQL load errors occurred. Raw import notices/logs remain private. This is
verification of the documented logical database scope, **not a complete
Supabase-service restore**. Storage file bytes, hosted Auth/SMTP/URL settings,
API/JWT/encryption/Vault secrets and other service configuration are excluded.
No actual Auth login, SMTP operation or encrypted MFA portability is established
by SQL restoration. The backup remains sensitive and requires private storage;
encrypted off-device retention and managed restore/PITR remain operational work.

Private verification evidence:
`verification-1793006779944/` inside that directory contains
`restored-security.json`, `policy-evidence.json`, import logs and the archived
preceding failure report. The root `restore-verification.json` now accurately
records `restored: true`, `securityMatchesSource: true`, counts and timestamps.
Prior failed attempts and their diagnostics were preserved.

### Final hosted inspection and preview

Verified project **onfxxtvfprjnqsxdmhkp**, PostgreSQL **17.11**, with an enforced
read-only transaction over the session pooler. Current tables, policies,
function definitions/grants, private schema grants, role mappings, relevant Auth
column/enum metadata, migration history and account counts match the baseline.
No unexpected MFA object names or account/schema drift was observed within those
checks. Counts remain 4 / 18 / 31, with zero Auth users/profiles/assignments.
This is a scoped catalog comparison, not proof that every Supabase setting or
every catalog object was unchanged.

`npx supabase db push --linked --dry-run` exited **0** and listed **only**:

```text
20261026010000_require_staff_mfa.sql
```

Private final evidence: `hosted-stage-2e5d.json`,
`hosted-stage-2e5d-resolution.json`, and `stage-2e5d-dry-run.log` in the backup
directory. No real push, migration repair, user creation/deletion, invitation,
role assignment, hosted Auth change or production recovery change occurred.

### Tests and next approval gate

Verifier/backup tests passed **10/10**, including a real isolated PostgreSQL 17
regression test. That test reproduces the prior SQLSTATE 42601 delimiter defect,
proves qualification changes with a fixed stored function reference, then rejects
a different same-named function, weakened predicates, missing policies and changed
policy roles/permissiveness. Unit tests also reject changed OIDs/namespaces,
`WITH CHECK`, commands, uncontrolled deparser paths and API/function/schema grant
drift. Script syntax checks and repository ESLint passed. These are verifier
tests; application/browser suites were not rerun for these script-only changes.

Files changed in Stage 2E.5D: `scripts/restore-security-snapshot.mjs`,
`scripts/restore-security-snapshot.test.mjs`, `scripts/restore-security-sql.test.mjs`,
`scripts/verify-logical-backup.mjs`, `scripts/inspect-hosted-mfa-preflight.mjs`,
and this report. No migration, application, credential or backup SQL was changed.

**Backup checkpoint complete.** The next separately approved deployment stage
must reconfirm the linked project, backup integrity/freshness and single-migration
preview immediately before any push, then verify deployed MFA policies/helper,
grants, preserved counts and migration history. Founder provisioning still needs
its own approvals and the physical-authenticator/recovery-governance requirements
in the MFA preflight and recovery guide. Keep production recovery disabled.

The earlier sections below are historical failed checkpoints, superseded by
this successful verification; their reports remain preserved privately.

## Stage 2E.5C — syntax repaired; policy comparison remains blocked

The existing recovery set was reused without creating another backup:
`.supabase/backups/onfxxtvfprjnqsxdmhkp-20261026T084803Z/`.
All three SQL files still match their original SHA-256 checksums and sizes
(177727 / 34653 / 370 bytes; total **212,750 bytes**) and remain Git-ignored.

### Confirmed syntax root cause and correction

The Stage 2E.5B error was in `restoreSecuritySql`, the **security-snapshot query**
executed after the complete count query. Its final private-schema-grants subquery
closed, but the surrounding `json_build_object(` did not. The final alias/subquery
ending needed `r(name)));` instead of `r(name))`. The substantive fix is the
missing closing parenthesis; the explicit final semicolon also makes termination
clear. It was not a backup-file error, shell quoting problem, interpolation
failure or need for multi-statement execution.

Added a real, network-isolated PostgreSQL 17 regression test using synthetic
local catalog fixtures. It reproduces SQLSTATE **42601** with the original full
unterminated query and successfully executes the corrected full query. Combined
verifier tests passed **5/5**; script syntax checking and ESLint passed.

The verifier now tracks the current restore/verification step, records safe
SQLSTATE/line metadata where available, and reports nonzero failure status without
claiming success. New per-attempt private directories preserve current logs and
snapshots, and archive the preceding `restore-verification.json`; backup SQL and
its manifest are not changed. Assertions continue to fail closed.

### Actual existing-backup restoration and new stopping condition

A new disposable, network-isolated PostgreSQL 17 container restored all three
existing SQL exports successfully with `ON_ERROR_STOP`. The original count-query
checks completed: PostgreSQL 17, six RBAC tables, two RLS-enabled Auth-security
tables, 4 roles, 18 permissions, 31 mappings and the three expected migration
records; no deployed MFA helper/restrictive policies were expected or found.

The corrected security query executed successfully. The subsequent comparison
passed table metadata, including RLS and ordinary API table grants, but failed
on **policy USING-expression text**. The private assertion diff identifies a
qualification difference: the restored expression renders `uid()` whereas the
hosted baseline renders `auth.uid()`. This is consistent with differing
`pg_policies` deparser/search-path contexts, but function resolution/shadowing
has not been conclusively ruled out. **Do not strip schema qualifiers or weaken
comparison to make it pass.** The next fix should establish deterministic
deparsing and verify the resolved function identity.

The first failed check is now `security_snapshot_comparison`, not SQL parsing.
SQLSTATE and SQL line are correctly unavailable for this JavaScript assertion.
Function-definition/execution-grant comparison and exact mapping comparison
were not reached. Their validation is therefore incomplete even though mapping
counts passed. Restored profile/assignment/user counts were not fully compared
to the source baseline after that failed check; do not substitute historical
zero-count observations for a completed comparison.

This attempt ran **2026-10-26 09:05:49.079–09:06:05.896 UTC**. Private diagnostics:
`.supabase/backups/onfxxtvfprjnqsxdmhkp-20261026T084803Z/verification-1793005549081/`.
The root `restore-verification.json` records `restored: false` and the failed
step. The prior Stage 2E.5B report is preserved as `previous-verification.json`
inside that attempt directory. The disposable container/volume were removed;
no verification container remains. The active development database was untouched.

As required, no restore retry, hosted inspection or migration dry run followed
this failure. No new backup was created. No hosted database or Auth operation,
account change, invitation, role assignment, migration, production recovery or
website deployment occurred.

**Checkpoint status: incomplete. Hosted MFA deployment is not backup-ready for
separate approval.** The next scoped task is to diagnose policy deparsing/function
resolution locally, preserve the security checks and rerun verification only
after a reviewed correction. Hosted inspection and the exact single-migration
dry run must still follow a successful restore, with freshness/drift assessed
before deployment is submitted for approval.

Files changed: `scripts/restore-security-snapshot.mjs`,
`scripts/verify-logical-backup.mjs`, this report. Added:
`scripts/restore-security-sql.test.mjs`. No application code, credentials,
connection settings, SQL backup files or migration files were changed.

## Stage 2E.5B — fresh export completed; restore verification blocked

26 October 2026. The initial read-only inspection succeeded for project
`onfxxtvfprjnqsxdmhkp`, PostgreSQL 17.11, with exactly the three expected deployed
migrations. Counts remained 4 roles, 18 permissions, 31 mappings, zero Auth users,
zero team profiles and zero assignments. No MFA object conflict was found.

The existing session-pooler backup method was reused without changing credentials,
DNS, TLS or connection settings. Docker 29.9.2 was available, approximately 48 GB
of disk space was free, the backup parent's restricted ACL was verified and Git
confirmed artifact exclusion. Existing backups/development data were preserved.

### Fresh private recovery set

Created **2026-10-26 08:48:03.309 UTC**, in:

`.supabase/backups/onfxxtvfprjnqsxdmhkp-20261026T084803Z/`

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `schema.sql` | 177727 | `0d02b739f0036fec9bdf4e9f4fa1c0bad910500a34a8b5b31a2ebc58edb43e7a` |
| `data.sql` | 34653 | `2e6c1e5a12ea84d84750dc863196197bc0b39b15376923e4086c9a9164d4d3fa` |
| `roles.sql` | 370 | `168a95a9c745af5ed4679751f90419ac9dc434240a213b03e32a06d5664c2308` |

SQL total: **212,750 bytes**. Exports completed in approximately 52/55/27 seconds,
each within its existing five-minute limit. All three files were nonempty and
matched their manifest sizes/SHA-256 checksums. The approved scope is schema/data
for `public`, `app_private`, `auth`, `storage`, `supabase_migrations`, plus the CLI
role export. SQL contents and records were not printed. A sanitized manifest and
read-only pre-export catalog snapshot are private artifacts alongside the files.

The initial snapshot is also preserved at
`.supabase/backups/checkpoint-before-20261026T084656Z.json`; no existing artifact
was overwritten or deleted.

### Isolated restore outcome — incomplete verification, no retry

Ran the existing restore procedure with the explicit history expectation:

```powershell
node scripts/verify-logical-backup.mjs '.supabase/backups/onfxxtvfprjnqsxdmhkp-20261026T084803Z' '--expected-migrations=20261021010000,20261021010100,20261023010000'
```

The disposable Supabase PostgreSQL 17 container had no network access or published
ports and did not mount the development database. It initialized the compatible
platform roles and a new `backup_verify` database using only a disposable local
password held in process environment. The three files **all loaded successfully
with `ON_ERROR_STOP`**, in roles/schema/data order. Their private load logs record
zero warnings, notices and errors.

However, the subsequent verifier SQL failed with **`syntax error at end of input`**,
reported at line 17. This is a failure in the post-load verification phase, not a
reported error while executing the three dump files. Its precise SQL construction/
transport cause has not yet been established. No backup corruption is established,
but successful loading alone is insufficient evidence of a verified recovery set.

`restore-verification.json` records `restored: false`; start/end timestamps are
**08:50:36.053 / 08:51:00.654 UTC**. Detailed SQL diagnostics remain only in the
private `restore-error.log`. The container and its disposable volume were removed
by the verifier's cleanup; no verification container remains. No restore retry,
hosted SQL change or repair operation was attempted.

Restored counts, policies, function grants/definitions and exact permission
mappings therefore remain **unverified**. Additional source-comparison checks
were prepared in the verifier with unit-tested comparison logic, but this attempt
did not reach a successful comparison or produce `restored-security.json`.

### Stop condition and remaining work

The checkpoint stopped at the restore-verification failure as requested. The
final hosted drift inspection and `npx supabase db push --linked --dry-run` were
**not run in Stage 2E.5B**. The expected pending file remains the last confirmed
Stage 2E.5A result, not a newly verified preview:

`20261026010000_require_staff_mfa.sql`

The safe next task is to diagnose/correct the verifier SQL using only an isolated
local environment and synthetic or this private recovery set. Do not rerun
destructive operations blindly, alter credentials or modify the hosted database.
Then, on separately resumed verification, recheck integrity, restore-test, verify
all required catalog/grants/counts, inspect hosted drift and repeat the exact-only
dry run. Check source freshness and create a new recovery point if the hosted
state has changed in the meantime.

**Hosted MFA deployment cannot yet be submitted as backup-ready.** No real push,
hosted record modification, account creation/deletion, email, role assignment,
Auth-setting change, recovery enablement or website deployment occurred.

This remains a selected logical database recovery set, not full Supabase-service
recovery. It excludes Storage object bytes, Auth/SMTP settings, API/JWT/Vault/
encryption secrets and other service configuration. SQL loading does not prove
Auth login, SMTP operation or encrypted MFA portability after recovery. Keep
all SQL/log files private; an encrypted off-device recovery copy and a managed
restore/PITR plan remain separate operational decisions.

Files changed in this attempt: this checkpoint report and
`scripts/verify-logical-backup.mjs`. Added comparison helper/tests:
`scripts/restore-security-snapshot.mjs`, `scripts/restore-security-snapshot.test.mjs`.
Their unit tests plus existing backup-expectation tests passed **4/4**; script
syntax checking and ESLint passed. Those checks do not replace the failed real
catalog verification. No application, migration or credential files were changed.

## Historical Stage 2E.5 / 2E.5A

Follow-up: [Stage 2E.5A connectivity diagnosis](./hosted-connectivity-diagnosis.md)
confirmed connectivity and the single-migration dry run on 26 October at 08:13
UTC. No backup was created there; this backup checkpoint still needs resumption.

26 October 2026, approximately 07:00 UTC. Intended project:
`onfxxtvfprjnqsxdmhkp`.

**No fresh backup or restore was attempted. No deployment readiness is claimed.**
The initial hosted identity/history check could not complete, so the procedure
stopped before database exports. No hosted migration, data, account, email, role,
Auth setting, production recovery setting or application deployment was changed.

## Evidence and limits

- The local CLI link file still matches the intended project exactly.
- `scripts/inspect-hosted-mfa-preflight.mjs` failed during the initial bounded
  read-only inspection. Its wrapper did not retain a detailed failure category.
- One bounded follow-up connection-metadata diagnostic using
  `npx supabase db dump --linked --schema public --dry-run` timed out after
  **45 seconds**. This was only a connection-metadata dry run, not a schema
  export. Any temporary credential output stayed in process memory and was
  never printed or saved.
- An independent **unauthenticated** request to the Supabase management API
  (`api.supabase.com`) also timed out, with an eight-second limit. This supports
  an API/network reachability problem from this environment, but does not prove
  a provider outage or establish whether DNS, firewall, proxy, VPN, TLS or another
  network condition is responsible. Database credentials were not determined
  to be invalid and were not changed.
- Docker was accessible (engine 29.9.2). The private backup parent still had a
  protected ACL granting the current Windows account FullControl. Existing
  backups were preserved; no new timestamped recovery directory was created.
- A timed-out Windows command left an identified metadata-diagnostic child tree.
  Its identity was checked before attempting targeted cleanup; it had already
  exited when cleanup was attempted, so no process was terminated.

Hosted identity, current migration history and schema drift are **not verified
in this checkpoint**. Stage 2E.4's successful observations are historical evidence,
not a substitute for the current read-only gate.

## Results

| Check | Status |
| --- | --- |
| Exact project in local link file | Confirmed |
| Live hosted target/history | Blocked by bounded connection-metadata failure |
| Fresh schema/data/roles export | Not started |
| Fresh integrity manifest | Not created |
| Isolated PostgreSQL 17 restore | Not started |
| Final hosted schema inspection | Not run after the failure |
| `db push --linked --dry-run` | Not run in Stage 2E.5 |

The last successful Stage 2E.4 preview listed only
`20261026010000_require_staff_mfa.sql`; that result was **not reconfirmed here**.
No actual database push occurred.

## Safe next step

Restore/verify connectivity from this environment to Supabase's management API.
Do not reset passwords, rotate keys, repair migration history or change database
settings based solely on a timeout. If checking manually in a private terminal,
`npx supabase migration list --linked` is read-only; stop a stalled command and
do not paste credentials or debug output into chat.

Once connectivity is stable, repeat the existing approved checkpoint: verify the
exact target/history, create a new private export, check integrity, restore into
an isolated PostgreSQL 17 database using the explicit three-version expectation,
verify restored policies/grants/catalog, repeat source drift checks and confirm
the single pending MFA migration. See the exact procedure in
[the Stage 2E.4 preflight](./hosted-mfa-migration-preflight.md).

A logical recovery set excludes Storage object bytes, Auth/SMTP settings,
API/JWT/Vault/encryption secrets and other Supabase service configuration.
Successful SQL restoration would not demonstrate full service recovery or
future encrypted MFA-secret portability. A fresh backup and verified restore
remain mandatory before separately approving migration deployment.

An untested extension to restore comparisons prepared during this attempt was
removed when the connection gate failed. The previously reviewed restore
procedure and all migration/application/credential files remain unchanged by
this stage. Syntax checking and the two existing backup-expectation tests passed;
they do not substitute for an actual fresh backup and restore.
