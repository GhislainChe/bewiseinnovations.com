# Stage 2E.6 — hosted MFA security migration deployed

Next preparation stage: [controlled hosted MFA integration readiness](./hosted-mfa-integration-readiness.md).
That plan grants no account, invitation or temporary role authorization.

Target: **onfxxtvfprjnqsxdmhkp**, PostgreSQL **17.11**.
The explicitly approved migration was applied once on **26 October 2026**;
the CLI completed successfully at **09:47:51.934 UTC**.

```text
20261026010000_require_staff_mfa.sql
```

No other migration, Auth setting, account, role assignment, business record,
production recovery setting or website deployment was changed. Founder
onboarding remains separately approval-gated.

## Final gates before deployment

- The CLI link file and session-pooler connection identity matched the exact
  project. The bounded database inspection enforced `BEGIN READ ONLY` and
  confirmed `transaction_read_only = on`.
- Current hosted catalog, policy/function definitions, dependency identities,
  checked grants, relevant Auth column/enum metadata, counts and migration history
  matched the approved Stage 2E.5D baseline exactly within its inspected scope.
- The three SQL files in the existing private backup matched their recorded
  SHA-256 checksums and known approved hashes, with total size **212,750 bytes**.
  The private directory remained Git-ignored:
  `.supabase/backups/onfxxtvfprjnqsxdmhkp-20261026T084803Z/`.
- The Stage 2E.5D isolated PostgreSQL 17 restore report remained present and
  successful: six policies, seven security functions, checked grants and exact
  permission mappings matched. The restored database contained the three
  pre-MFA migrations, 4 roles, 18 permissions, 31 mappings and no Auth users,
  staff profiles or assignments. A second restore/new backup was not needed;
  those original backup bytes and the scoped hosted baseline were unchanged.
- The migration SHA-256 still equaled
  `70605be41eaf9837037973f54f5804d433f01c053bac1a237a28950ff203e830`.
- The final preview exited 0 and listed only the authorized migration. Its
  freshness, exact filename, migration hash, linked project and four-file local
  migration inventory were checked again immediately before the push.

## Executed sequence

```powershell
npx supabase db push --linked --dry-run
npx supabase db push --linked --skip-vault
npx supabase db push --linked --dry-run
```

The middle command was executed **once**, after all pre-deployment gates passed.
No `--include-all`, migration repair, forced history change, remote reset or
deployment retry occurred. A private exclusive attempt marker and separate CLI
result/log preserve the attempt and outcome.

## Read-only post-deployment verification

The subsequent catalog inspection again enforced an explicit read-only
transaction. Verification completed at approximately **09:50 UTC**.

| Check | Result |
| --- | --- |
| Hosted migration history | All four expected versions below |
| Restrictive MFA policies | Six, on precisely the six public RBAC tables |
| Policy commands and roles | `ALL`, `authenticated` only |
| Policy mode | `RESTRICTIVE` |
| `USING` and `WITH CHECK` | Both call `app_private.has_aal2_session()` through the reviewed scalar subquery |
| Helper definition | Body matches approved migration, boolean SQL function, STABLE, SECURITY DEFINER, empty search path, owned by postgres |
| Helper execution | authenticated allowed; PUBLIC, anon and service_role denied |
| Existing objects | Six RBAC tables, two security tables, six prior policies and seven prior functions retained |
| Existing security settings | Inspected table/function/schema grants, RLS and original function definitions unchanged |
| Permission catalog | Four roles, 18 permissions, 31 mappings, exact role-permission sets unchanged |
| Account state | Zero Auth users, zero staff profiles, zero role assignments |
| Private Data API exposure | Publishable-key GET with `Accept-Profile: app_private` returned **406 / PGRST106** |
| Final migration preview | Exit 0, **no pending migrations**, “Remote database is up to date” at 09:50:27.054 UTC |

Recorded migration history:

```text
20261021010000
20261021010100
20261023010000
20261026010000
```

The six new policy names are `team_profiles_mfa`, `roles_mfa`,
`permissions_mfa`, `role_permissions_mfa`, `team_role_assignments_mfa` and
`audit_logs_mfa`. They intersect the preserved permissive permission policies;
they do not grant membership or create staff write privileges.

All new policy dependencies resolve to the same hosted private helper, OID
**17886**. OIDs are database-local evidence, not portable expected identifiers.
Every predicate and policy attribute was checked; no qualification was removed
to force a match. Prior policy dependencies remained unchanged.

## Verification issues and behavioral limits

An initial one-stage verifier incorrectly expected one `pg_depend` function row
per MFA policy. PostgreSQL returned **two references to the same helper**,
corresponding to the `USING` and `WITH CHECK` expressions. Read-only inspection
confirmed both exact predicates and both identical function references. The
local checker was corrected to require both entries, their qualified identity
and the same OID. Its initial failed report was preserved. This required no
hosted correction, deployment retry or relaxation of policy verification.

The preflight inspector intentionally exits 2 when MFA object names exist.
Post-deployment this is expected: its output was accepted only after separately
checking the exact one helper and six policies, not by ignoring that exit code.

An additional anonymous/invalid-JWT HTTP denial probe failed to complete its
full assertions and returned a generic local wrapper failure. It did not retain
an exception category or partial response, so neither its precise cause nor
either individual behavioral result is established. It was not retried. **Do
not report these extra HTTP denial probes as passed.** The successful separate
private-schema API probe and inspected database grants are independently
confirmed above.

No hosted identities were created for testing. Real hosted AAL1/AAL2 sessions,
TOTP verification/revocation, inactive-user denial and application authorization
journeys therefore remain pending separately approved testing. Their previous
local tests remain evidence for local behavior, not a new hosted integration
pass. Administrative/service-role connections remain a separate privileged
boundary; the database helper does not replace server-side MFA and permission
checks. Future tables/operations need their own guards.

No application, SQL migration or credential file changed in this stage, so
application unit/browser/build suites were not rerun. The validation performed
here was the gated migration preview, hosted catalog comparison, exact reviewed
helper/policy checks and read-only Data API exposure probe.

## Evidence and recovery

Private artifacts in the reviewed backup directory include:

- `hosted-stage-2e6-before.json` and `hosted-stage-2e6-after.json`.
- `stage-2e6-before-dry-run.log`, `stage-2e6-preview.json`.
- `stage-2e6-deployment-attempt.json`, `stage-2e6-deployment-result.json` and
  `stage-2e6-deployment.log`.
- `stage-2e6-verification-initial.json`, `stage-2e6-verification.json` and the
  one-stage read-only `stage-2e6-verify.mjs` checker.
- `stage-2e6-after-dry-run.log`, `stage-2e6-final-preview.json`.

These ignored files remain private. No database credentials, API keys, tokens,
password hashes or personal account records were printed or added to docs.

The retained logical backup is a **pre-MFA database recovery set**, not a full
Supabase-service backup. Storage object bytes, hosted Auth/SMTP/URL settings,
API/JWT/encryption/Vault secrets and other service configuration are excluded.
Do not restore it over the hosted project to undo this additive migration.
Any forward fix or rollback requires separate review and approval; removing MFA
policies would be a security downgrade. See the
[backup checkpoint](./hosted-mfa-backup-checkpoint.md) and
[preflight recovery plan](./hosted-mfa-migration-preflight.md).

## Remaining approval gates

Keep production password recovery disabled. Before provisioning the first owner,
separately approve the actual independently verified owner email and invitation,
confirm hosted TOTP options, rehearse physical primary/backup authenticators,
verify current AAL2, and settle independent recovery verification, custodians,
emergency approvals, notifications and session revocation. The canonical owner
bootstrap must receive its own approval against the exact verified Auth UUID
and email. Do not infer provisioning approval from this migration deployment.

See [MFA and owner recovery](./mfa-and-owner-recovery.md). No founder onboarding
was started in Stage 2E.6.
