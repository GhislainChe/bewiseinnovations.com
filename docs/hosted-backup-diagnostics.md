# Stage 2D.9A — hosted logical backup diagnostics

Reviewed 24 October 2026 (Africa/Douala). Source project:
`onfxxtvfprjnqsxdmhkp`. No migration, hosted account, Auth setting, role
assignment, or hosted data was changed.

## Diagnosis and connection method

The Supabase CLI 2.121.0 generated dump script uses the shared **session
pooler** `aws-0-eu-west-1.pooler.supabase.com:5432`, database `postgres`, with a
CLI-issued login followed by `SET ROLE postgres`. It does not use transaction
pooling (port 6543). Credentials were inspected only in process memory and
passed to diagnostic Docker clients through environment variables; no values
were printed or committed.

The PostgreSQL image is
`public.ecr.aws/supabase/postgres:17.11.0.003`; the hosted server reports 17.11.
Docker Desktop engine is 29.9.2. No native Windows `psql` or `pg_dump` was found.
A Docker `psql` SELECT through the session pooler succeeded with TLS required,
a ten-second connection timeout, and read-only session options. It confirmed
database `postgres`, effective role `postgres`, PostgreSQL 17.11, and two
deployed migration versions. Connecting as the CLI login without assuming
`postgres` instead received a schema permission error; that was a diagnostic
role-selection issue, not a backup permission defect.

Direct-host DNS resolution failed both on Windows and in the Docker client for
`db.onfxxtvfprjnqsxdmhkp.supabase.co`. No usable direct IPv4/IPv6 connection was
established; there is no basis to assume IPv6 works here. The session pooler is
the tested method. Official guidance recommends a direct connection for native
backup tools and session pooling as the alternative on IPv4-only networks:
[connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).

A 35-second minimal `pg_dump --schema-only --schema=supabase_migrations`
probe timed out. Verbose output showed steady catalog-discovery progress,
including across schema-independent function/type/operator catalogs. A second
probe with a three-minute cap completed (1,639 output bytes). The full CLI
exports subsequently completed within five-minute per-command limits:

| Export | Duration | Bytes |
| --- | ---: | ---: |
| Schema | 87 seconds | 170,275 |
| Data | 80 seconds | 28,130 |
| Roles | 19 seconds | 370 |

Thus, a zero-byte CLI output file during execution did not prove that
`pg_dump` was idle. Slow catalog processing/round trips and terminating the
earlier exports before completion contributed to the apparent stalls. No
specific schema lock, incompatible client, current TLS error, or transaction
pooling problem was found in the successful run. The earlier intermittent SSL
loss/connection termination was not reproduced or conclusively explained; it
must not be claimed fixed by this observation. A future network failure still
requires stopping rather than proceeding with an incomplete backup.

The earlier successful recovery set exported `public`, `auth`, `storage`, and
`supabase_migrations` before RBAC existed. This run additionally includes
`app_private` and captures the now-deployed RBAC objects/data. Both procedures
use the linked CLI and a compatible Supabase PostgreSQL 17 Docker image. There
is no recorded evidence that a PostgreSQL major-version change caused the
failures. The historical notes do not contain enough timing/packet information
to attribute every earlier failure to a single cause.

## Fresh verified recovery set

Private, Git-ignored directory:
`.supabase/backups/onfxxtvfprjnqsxdmhkp-20261024T002030Z/`.
Its parent ACL is protected and grants access only to the local workspace
owner. Existing backups were preserved.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `schema.sql` | 170275 | `3192b10284695d48386fc7c969ce70a4f060626690568ed03620be1b02439a8a` |
| `data.sql` | 28130 | `52770e40af6fd1da709d3a4c3e381ad38363f7e8bed058df005728f4616f9bc0` |
| `roles.sql` | 370 | `168a95a9c745af5ed4679751f90419ac9dc434240a213b03e32a06d5664c2308` |

SQL export total: **198,775 bytes**. A private `manifest.json` records sizes and
hashes; `restore-verification.json` records the successful restore. Restore logs
are private artifacts and must never be copied to source control or issue
trackers because future backups may contain account or business data.

## Isolated restoration results

All three files executed successfully with `psql -X -v ON_ERROR_STOP=1` in a
new `backup_verify` database in a disposable PostgreSQL 17 container. The
container had `--network none`, no published port, and no mount of local
development database data. Manifest hashes were checked before restoration.

The image uses a temporary initialization server before its final server.
An initial readiness check accepted that temporary server and encountered a
shutdown; the verifier now waits for the final server's TCP-listening log and
successful readiness check. The `postgres` role cannot create reserved platform
roles, so restore uses the disposable image's local `supabase_admin` superuser.
The missing `supabase_realtime_admin` platform role is created in that isolated
container before loading the role dump, matching the earlier restore procedure.
These adjustments affect only the disposable restore environment.

Verified restored counts:

- PostgreSQL major version 17;
- six RBAC tables, four roles, 18 permissions, 31 role-permission mappings;
- 27 Auth tables and eight Storage tables;
- zero Auth users, team profiles, role assignments, and Storage objects;
- migration versions `20261021010000` and `20261021010100`.

The disposable container and its anonymous volume were removed after the
successful check. The existing Supabase local development database and all
backup files were preserved.

## Future backup procedure

1. Check `supabase/.temp/project-ref` is exactly `onfxxtvfprjnqsxdmhkp` and run
   `npx supabase migration list --linked`. Stop on an unexpected target/history
   or a failed connection. Never use a transaction pooler for this procedure.
2. Ensure Docker and the PostgreSQL 17 image are available. Verify the private
   `.supabase/backups` parent ACL and Git exclusion. Do not print CLI dump
   `--dry-run` scripts: they can contain a temporary database password.
3. Run `node scripts/create-hosted-logical-backup.mjs`. It creates a new
   timestamped directory, runs the following equivalent exports, and records
   nonzero lengths and hashes. Each command has a five-minute limit. Do not
   cancel merely because the destination is still empty after 30 seconds.

   ```powershell
   npx supabase db dump --linked --schema public,app_private,auth,storage,supabase_migrations --file <private-directory>/schema.sql
   npx supabase db dump --linked --schema public,app_private,auth,storage,supabase_migrations --data-only --use-copy --file <private-directory>/data.sql
   npx supabase db dump --linked --role-only --file <private-directory>/roles.sql
   ```

4. If a command fails or reaches its limit, preserve the partial directory,
   stop, and inspect/terminate only the diagnostic process/container belonging
   to that attempt. Do not use an incomplete manifest or retry indefinitely.
5. Run `node scripts/verify-logical-backup.mjs <private-directory>`. Success
   requires matching hashes, all three restores exiting cleanly, and the
   expected database counts/history. This version expects the pre-auth-security
   migration state; review its expected counts/history before using it after
   later migrations. A file hash alone is not a restore test.
6. Retain the recovery set privately. Arrange an encrypted off-device copy
   under an approved recovery policy before relying on it for production
   operations. Any restoration into a hosted target needs its own explicit
   approval, destination verification, recovery point, and downtime plan.

Use `node scripts/diagnose-hosted-backup.mjs` only for bounded read-only
connection diagnosis. It prints statuses and small identity results rather
than SQL dumps or credentials. It does not deploy anything.

## Limitations and status

This is a logical recovery set of the named schemas and role export, **not** a
complete Supabase-service backup. It excludes Storage object bytes, Auth/SMTP
settings, API/JWT and Vault secrets, nonselected managed schemas, service
configuration, and external integrations. It does not prove Auth sign-in or
SMTP delivery after a hosted recovery. PITR was previously disabled and no
managed restore point has been established by this stage.

Current backup creation and isolated restore verification succeeded. This
stage performs no migration deployment and does not waive the final dry-run,
freshness, target, or post-deployment security checks in Stage 2D.9.
