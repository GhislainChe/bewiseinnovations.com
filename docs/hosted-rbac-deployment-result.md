# Stage 2C.7 hosted RBAC deployment result

On 2026-10-23 (Africa/Douala), the approved migrations were applied to the
linked Supabase project `onfxxtvfprjnqsxdmhkp`:

- `20261021010000_internal_rbac.sql`
- `20261021010100_seed_internal_roles.sql`

No other migration, seed file, role file, Vault change, Auth setting, founder
account, or website deployment was applied. The predeployment dry run listed
exactly those two files. The real command was `npx supabase db push --linked
--skip-vault`, and it exited successfully. A subsequent read-only migration
listing recorded both versions as applied.

## Fresh recovery point

Before deployment, the read-only Supabase CLI created a schema, data, and role
dump in the private, Git-ignored directory
`.supabase/backups/onfxxtvfprjnqsxdmhkp-20261022T230319Z/` (UTC timestamp).

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `schema.sql` | 158794 | `F7D614B1854F74053FB411988A43443DB2DEFCDF753060D458ED432AA034DD6C` |
| `data.sql` | 10715 | `2867543AB815443D13A0FB0AC6651D4AF72EB30C380449B702ADF3EE14EB65B6` |
| `roles.sql` | 370 | `168A95A9C745AF5ED4679751F90419AC9DC434240A213B03E32A06D5664C2308` |

All files were nonempty and hashed. `schema.sql`, `data.sql`, and `roles.sql`
executed successfully in a separate, network-isolated Supabase PostgreSQL 17
container; the restored database had 27 Auth and eight Storage tables and no
Auth users or Storage object metadata. The roles restore required adding the
missing `supabase_realtime_admin` platform role in that disposable container.
The existing local development database was not overwritten. This logical
backup has the same incomplete-project-recovery limitations documented in
[hosted-database-backup.md](./hosted-database-backup.md); it is not PITR or a
complete restore of Supabase services.

## Read-only post-deployment verification

- Hosted `public` contains exactly the six RBAC tables, each with RLS enabled.
  The schema snapshot showed the six intended SELECT policies.
- Table grants in the snapshot gave `authenticated` SELECT only and gave
  `anon` no table privilege. The two private permission functions are callable
  by `authenticated`; neither writes data. A publishable-key REST request
  without a user session received HTTP 401 for every RBAC table. This confirms
  denial on that request path; the local pgTAP suite is the direct RLS test.
- A read-only public data dump contained exactly four roles, 18 permissions,
  and 31 role-permission rows. `team_profiles`, `team_role_assignments`, and
  `audit_logs` each contained zero rows.
- TypeScript, ESLint, and the production build passed. The previously tested
  local pgTAP suite passed 42/42 and mocked Auth tests passed 10/10; these were
  not rerun during this deployment step.

This stage did not provision founders. Hosted Auth settings and actual
invitation/recovery delivery remain separate follow-up work.
