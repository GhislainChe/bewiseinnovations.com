# Stage 2C.4 hosted database recovery point

**Source project:** `onfxxtvfprjnqsxdmhkp` (PostgreSQL 17.11.0.003).
**Created:** 2026-10-22 04:18:41 UTC, before the two RBAC migrations.
**Local backup:** `.supabase/backups/onfxxtvfprjnqsxdmhkp-20261022T041841Z/`.
This is a local, ACL-restricted directory under the ignored `.supabase/` tree.
It is not a Supabase-managed snapshot, PITR point, or off-site copy. Keep the
directory private and never commit, email, or print its SQL files. Protect any
additional copy with encryption and restricted access.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `schema.sql` | 158794 | `F7D614B1854F74053FB411988A43443DB2DEFCDF753060D458ED432AA034DD6C` |
| `data.sql` | 10715 | `DD7FE7BC13E756538FE2DC9C09FAB6979F40972799C8F92068D0E2511B7A47EB` |
| `roles.sql` | 370 | `168A95A9C745AF5ED4679751F90419AC9DC434240A213B03E32A06D5664C2308` |

The files were produced with the linked Supabase CLI's read-only `db dump`
command: schema plus data for `public`, `auth`, `storage`, and
`supabase_migrations`, and a separate role dump. The schema file contains 27
Auth and eight Storage table definitions; the data file contains 26 Auth and
seven Storage COPY blocks. Hosted `public` had no application objects and no
RBAC migration history at this point. The restore test found zero Auth users and
zero Storage object metadata rows. The backup does **not** include Storage object
bytes, Auth/SMTP/Dashboard configuration, API/JWT secrets, Vault secrets,
extensions' implementation, or every Supabase-managed schema. It is a logical
recovery set for the selected database schemas, not a complete project clone.
Password hashes and other sensitive data could appear in future dumps, even if
this one has no Auth users.

## Verification performed

All three files were nonempty and hashed. `schema.sql` and `data.sql` were
restored with `psql -v ON_ERROR_STOP=1` into a fresh `backup_verify` database in
a separate, network-isolated container using the Supabase PostgreSQL 17 image.
The restored database contained 27 Auth and eight Storage tables. The separate
role dump also executed successfully after creating the missing
`supabase_realtime_admin` platform role in that disposable container. This
demonstrates SQL execution against a compatible engine, but does not prove a
full hosted Supabase service recovery or application login. The tested local
development database was not overwritten.

To recheck the files without displaying their contents, use PowerShell:

```powershell
$dir = '.supabase/backups/onfxxtvfprjnqsxdmhkp-20261022T041841Z'
Get-ChildItem -LiteralPath $dir -File | Select-Object Name,Length
Get-ChildItem -LiteralPath $dir -File | Get-FileHash -Algorithm SHA256
```

Compare sizes and hashes with the table above. A file's existence or hash alone
does not prove restorable content; retain the restore-test result as well.

## Safe recovery procedure

1. Confirm the intended **destination**, take a new recovery point of its
   current state, and plan downtime. A restore can replace newer accounts,
   migrations, and audit data. Never point these files at the linked hosted
   project or the existing local development database by default.
2. Use a newly provisioned, compatible Supabase/PostgreSQL 17 environment with
   required platform roles and extensions. Restrict access to the backup and
   database. Verify file hashes before use.
3. Restore the schema and data to an empty isolated database with `psql -X
   --set ON_ERROR_STOP=1 --file schema.sql` followed by `data.sql`. Run as a
   suitably privileged database administrator. Restore `roles.sql` only after
   verifying its role statements against the destination's existing platform
   roles; it can require platform roles such as `supabase_realtime_admin`.
4. Validate schemas, table and row counts, constraints, Auth sign-in and
   Storage behavior in that isolated environment. Separately restore required
   Storage object bytes and configure Auth, SMTP, secrets, and API settings
   from their own secure records. Review migration history before any later
   migration or traffic cutover.
5. Any hosted restore requires a separate, explicit approval and a reviewed
   runbook for the specific failure. Prefer a forward corrective migration
   when a full restore would discard newer data.

Recreate a fresh predeployment dump immediately before any approved hosted
schema change; this 2026-10-22 snapshot can become stale. The project's PITR
was disabled and the CLI listed no managed restorable backup at this check.
See [Supabase's backup guide](https://supabase.com/docs/guides/platform/backups)
and [CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
for product-specific recovery requirements.
