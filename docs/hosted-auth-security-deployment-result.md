# Stage 2D.9B — hosted Auth security deployment result

On 24 October 2026 (Africa/Douala), the single authorized migration
`20261023010000_auth_flow_security.sql` was deployed successfully to
`onfxxtvfprjnqsxdmhkp` through the Supabase session pooler on port 5432.

No other migration, seed, role export, Vault change, Auth setting, account,
invitation, founder assignment, or website deployment was performed.

## Preconditions and recovery point

The link file and successful remote history queries confirmed the intended
target and the two already-deployed RBAC migrations. The SELECT-only catalog
check confirmed both proposed tables and all four function names were absent.
An initial multiline JSON parsing error in the local inspection helper was
corrected; the database query itself had succeeded. There was no connection
failure during the approved deployment sequence.

All three files in the Stage 2D.9A backup
`.supabase/backups/onfxxtvfprjnqsxdmhkp-20261024T002030Z/` still matched their
recorded hashes and its isolated restore result was verified. To cover any
possible schema/data drift since that snapshot, a fresh private recovery set
was created immediately before deployment:

`.supabase/backups/onfxxtvfprjnqsxdmhkp-20261024T003327Z/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `schema.sql` | 170275 | `3192b10284695d48386fc7c969ce70a4f060626690568ed03620be1b02439a8a` |
| `data.sql` | 28130 | `725f0d8816da9fdd27e7c93785e2143669181c30e27c84009ab6bdd13c019a25` |
| `roles.sql` | 370 | `168a95a9c745af5ed4679751f90419ac9dc434240a213b03e32a06d5664c2308` |

The backup includes `public`, `app_private`, `auth`, `storage`, and
`supabase_migrations`, plus a role export. It is Git-ignored and inherits the
restricted backup-parent ACL. All three files were nonempty, hash-checked, and
restored successfully with `ON_ERROR_STOP` into a new isolated PostgreSQL 17
container. Restored counts were six RBAC tables, four roles, 18 permissions,
31 mappings, 27 Auth tables, eight Storage tables, zero Auth users/profiles/
assignments/Storage objects, and the two predeployment migration versions.
The disposable container and its volume were removed; existing backups and
the local development database were preserved.

This is a logical database recovery set. It does not recover Storage object
bytes, Auth/SMTP settings, API/JWT/Vault secrets, or all Supabase services. See
[backup diagnostics](./hosted-backup-diagnostics.md) and
[recovery limitations](./hosted-database-backup.md).

## Deployment evidence

The final command `npx supabase db push --linked --dry-run` exited successfully
and listed exactly `20261023010000_auth_flow_security.sql`, with no seeds or
roles. The migration SHA-256 was checked immediately before execution:

`698fa938adebde457befdc133d1ed26256123fbb6a0ffe7c73ec2f58368b6576`

The authorized command was:

```powershell
npx supabase db push --linked --skip-vault
```

It exited successfully and reported only the approved migration applied. No
retry, reset, or migration-history repair was needed. Independent migration
listing afterward showed all three versions present locally and remotely:
`20261021010000`, `20261021010100`, and `20261023010000`.

## Read-only hosted verification

`scripts/inspect-hosted-auth-security.mjs` queried PostgreSQL catalogs through
the working session pooler with read-only transaction defaults and bounded
connection/statement/client timeouts. No test rows or Auth users were inserted.

- `app_private.auth_flow_tickets` and `app_private.auth_recovery_buckets` exist.
- RLS is enabled on both; both have zero row-access policies (default deny).
- Neither table grants direct SELECT or mutation privileges to `anon`,
  `authenticated`, or `service_role`.
- All four public functions exist with exactly the intended argument lists:
  `auth_flow_store_ready`, `register_auth_flow_ticket`,
  `redeem_auth_flow_ticket`, and `consume_recovery_budget`.
- All four are owned by `postgres`, use SECURITY DEFINER with an empty
  `search_path`, deny EXECUTE to PUBLIC/anon/authenticated, and allow EXECUTE
  to `service_role`. Database owner/administrative privileges remain as usual.
- The six public RBAC tables still exist with RLS enabled and their existing
  SELECT policies intact.
- Counts remain four roles, 18 permissions, and 31 mappings. Profiles,
  assignments, and Auth users remain zero.
- Read-only hosted configuration comparison before and after deployment
  matched the reviewed local Data API schema list `public,graphql_public`.
  The API scope was compared with no differences or unmanaged fields;
  `app_private` is not exposed.

## Validation results

All checks ran after the successful deployment:

| Check | Result |
| --- | --- |
| Mocked authentication unit/rendering tests | 27/27 passed |
| Local PostgreSQL pgTAP | 74/74 passed |
| Local concurrent ticket redemption | 1/12 accepted, as intended |
| Local concurrent per-email recovery quota | 3/12 accepted, as intended |
| Local concurrent global recovery quota | 30/33 accepted, as intended |
| TypeScript | Passed |
| ESLint | Passed |
| Next.js production build | Passed |

The real local Auth/Mailpit invitation and recovery tests previously passed
in Stage 2D.6. They were not rerun against hosted Auth, and this deployment does
not establish hosted SMTP or invitation/recovery end-to-end readiness.

## Next authentication requirements

The database security foundation is deployed and verified. Before approved
hosted Auth integration testing, separately configure the same project's
`SUPABASE_AUTH_STORE_SECRET_KEY` and a strong `AUTH_FLOW_SIGNING_SECRET` in a
server-only secret environment. No hosted secret key was obtained or configured
in this stage; the local integration environment remains separate.

Review and approve exact redirect URLs, token-hash Invite User/Reset Password
templates, and SMTP delivery. Keep Site URL at localhost until an approved
application origin is deployed and reachable. Production recovery submission
remains disabled, and the current recovery redirect is fixed to localhost;
these need a reviewed origin/enablement change before production use.

Any controlled hosted test account or first-owner invitation requires its own
explicit authorization. Founder identity verification, Auth UUID confirmation,
atomic role binding/audit, and MFA remain separate procedures. Retention cleanup
for expired private tickets/quotas and recovery operations should be planned
before public production traffic.
