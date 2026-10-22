# Stage 2C.2 hosted readiness review and deployment plan

**Historical predeployment plan:** Stage 2C.7 subsequently deployed the two
approved RBAC migrations. See [hosted-rbac-deployment-result.md](./hosted-rbac-deployment-result.md)
for the actual outcome. The pending-migration and blocker statements below
describe earlier preflight snapshots, not the current hosted database state.

**Target:** existing Supabase project `onfxxtvfprjnqsxdmhkp`.
**Status:** read-only review on 2026-10-22; no hosted migrations, Auth settings,
users, or role assignments were changed. This document is a proposed plan, not
authorization to execute it.

## Stage 2C.3 preflight (2026-10-22)

The link again resolved to `onfxxtvfprjnqsxdmhkp`. A fresh hosted migration
listing still showed both local versions unapplied. A fresh schema-only dump
found zero application objects in hosted `public`, and `app_private` remained
absent. `npx supabase services` reported hosted PostgreSQL `17.11.0.003`,
matching the local service and the configured major version 17.

The requested `npx supabase db push --linked --dry-run` printed only:

```text
20261021010000_internal_rbac.sql
20261021010100_seed_internal_roles.sql
```

The CLI reported no additional seeds or roles. A second hosted migration
listing after the dry run still showed both versions unapplied. **No real push
occurred.**

Read-only `supabase config diff` comparisons established that the hosted Data
API exposes `public` and `graphql_public`, not `app_private`. A direct REST
schema probe returned HTTP 401 for all tested profiles, so that probe did not
independently establish schema exposure; the configuration comparison did.

Hosted configuration differs materially from the intended invitation-only
policy:

The read-only `GET /auth/v1/settings` response independently confirmed
`disable_signup: false`, `external.email: true`, anonymous users disabled,
and `mailer_autoconfirm: false` (email confirmation required). No token or
publishable key was logged.

| Setting | Hosted finding | Required follow-up |
| --- | --- | --- |
| Global signup / email provider | Global signup on; email provider on | Turn global signup off in a separately approved hosted Auth change; keep email/password provider on for invited staff. |
| Email confirmation | Enabled | Keep enabled and verify invite acceptance. |
| Site URL | `http://localhost:3000` | Set an owned production URL when a reviewed callback exists. |
| Additional redirect URLs | Empty | Add only exact trusted callback URLs when implemented; do not use a broad wildcard. |
| Minimum password length | 6 | Increase under an approved hosted Auth configuration change. |
| Password character policy | Not available from the CLI comparison | Verify in Dashboard. |
| TOTP enrollment and verification | Enabled | MFA is available, but not yet enforced by this backend. |
| Email/password provider, SMTP, templates, delivery | Not fully established by this preflight | Verify in Dashboard and with controlled delivery before invitations. |

Local `supabase/config.toml` now blocks signup globally while keeping the
email/password provider enabled for invited users. It requires email
confirmation, a 12-character minimum, and lower/upper-case letters, digits,
and symbols. Setting `[auth.email] enable_signup = false` can disable the email
provider itself in this CLI version, so global signup is the control to use
for invitation-only access. These changes affect only the local project and
do **not** update hosted Auth. Restart local Auth before relying on them.

`npx supabase backups list --project-ref onfxxtvfprjnqsxdmhkp` returned an
empty backup list and `pitr_enabled: false`. Although the response reported
`walg_enabled: true`, no restorable physical backup or PITR point was listed.
Do not assume a recovery point exists. Verify Dashboard backup status and
arrange a tested, secure backup before any hosted schema change.

## Stage 2C.4 backup verification (2026-10-22)

A private, timestamped logical backup of selected hosted database schemas was
created and restored into an isolated local PostgreSQL 17 container. The source
hosted database was read only. The backup contents, hashes, restore result, and
important recovery limitations are documented in
[hosted-database-backup.md](./hosted-database-backup.md). This provides a tested
logical recovery set, but no managed snapshot or PITR point; refresh the dump
immediately before any separately approved migration deployment.

## Stage 2C.6 connection diagnostic (2026-10-22)

The linked ref was again `onfxxtvfprjnqsxdmhkp`. Read-only `supabase inspect
db table-stats --linked` connected successfully and returned no application
table rows; `migration list --linked` connected and still showed both RBAC
versions pending. The migration dry run listed exactly those two files. These
small queries establish reachability, but do not inspect all relevant catalog
objects. The previous large `pg_dump` SSL EOF/stall is consistent with a
long-running dump path or transient network interruption; its precise cause is
not proven. No evidence isolates pooling, TLS negotiation, Docker, or a CLI
timeout as the cause. Do not infer an empty `app_private` schema or absence of
function/trigger conflicts from table statistics alone.

Before any hosted write, run the SELECT-only
[hosted-schema-catalog-check.sql](./hosted-schema-catalog-check.sql) in the
Supabase Dashboard **SQL Editor** for this exact project. Confirm there are no
preexisting RBAC table, function, trigger, policy, or custom-type conflicts;
check the output against both pending migrations. Do not paste secrets or
private rows into a review. This catalog verification remains an open
deployment blocker until its results are inspected.

## Stage 2C.5 final preflight (2026-10-22)

The three backup files still match their documented lengths and SHA-256 hashes;
the private backup ACL is intact. The linked ref is still
`onfxxtvfprjnqsxdmhkp`. Hosted migration history still marks both RBAC versions
unapplied, and `npx supabase db push --linked --dry-run` listed only those two
files, with no seeds or roles. **No hosted migration was executed.**

The read-only Auth settings endpoint now reports global signup **disabled**,
email sign-in enabled, email confirmation required, and anonymous sign-in
disabled. This is a hosted Auth change since Stage 2C.3; it was not made by this
preflight. Read-only config comparison still reports Site URL
`http://localhost:3000`, no additional redirects, minimum password length 6,
and TOTP enrollment/verification available. Password character requirements
were not exposed by this comparison; invite/recovery email delivery was not
tested. Verify both in Dashboard before founder provisioning. TOTP availability
does not enforce MFA.

A fresh hosted `public` schema dump failed once with an SSL EOF and hung on
retry, so **schema drift could not be ruled out**. The migration history and dry
run are not substitutes for a fresh schema comparison. Re-run a read-only
schema dump or equivalent trusted SQL catalog inspection before approving a
real push; stop if any of the six table names or `app_private` has appeared.
The first migration creates exactly six application tables, `app_private`
helpers, indexes, grants, and SELECT-only RLS policies. The second seeds four
roles, 18 permissions, and 31 grants. No DROP, TRUNCATE, DELETE, Auth account,
or founder profile operation was found. The helpers require a migration owner
able to bypass RLS; `pg_catalog.gen_random_uuid()` is built into PostgreSQL
17. The 42 real local pgTAP assertions and 10 mocked Auth tests passed, along
with TypeScript, ESLint, and the production build.

### Exact approval-gated migration sequence

From the reviewed repository checkout, with the linked project ref displayed
and checked independently:

```powershell
Get-Content supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db dump --linked --schema public --file .supabase/predeploy-public-schema.sql
npx supabase db push --linked --dry-run
```

Inspect the fresh dump and dry-run output; do not proceed on a failed or
incomplete dump. Create and verify a **new** restricted, timestamped logical
backup immediately before deployment. The existing `.supabase/backups` parent
must still have its restricted ACL; verify that before writing files:

```powershell
$root = '.supabase/backups'
if (-not (Get-Acl -LiteralPath $root).AreAccessRulesProtected) { throw 'Backup ACL is not restricted' }
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$dir = Join-Path $root "onfxxtvfprjnqsxdmhkp-$stamp"
New-Item -ItemType Directory -Path $dir | Out-Null
npx supabase db dump --linked --schema public,auth,storage,supabase_migrations --file (Join-Path $dir 'schema.sql')
npx supabase db dump --linked --schema public,auth,storage,supabase_migrations --data-only --use-copy --file (Join-Path $dir 'data.sql')
npx supabase db dump --linked --role-only --file (Join-Path $dir 'roles.sql')
Get-ChildItem -LiteralPath $dir -File | Select-Object Name,Length
Get-ChildItem -LiteralPath $dir -File | Get-FileHash -Algorithm SHA256
```

Check every command's exit status and every file's nonzero length; a successful
hash alone is insufficient. Use the restore procedure in
[hosted-database-backup.md](./hosted-database-backup.md) on an isolated target.
Confirm an off-site encrypted copy or another approved recovery arrangement.
After separate, explicit approval for the hosted write, the one deployment
command is:

```powershell
npx supabase db push --linked --skip-vault
```

This applies hosted SQL and migration history. `--skip-vault` avoids an
unrelated Vault update. Never replace the dry run with this command during a
read-only preflight.

### Exact post-deployment verification checklist

Before any account provisioning, use a trusted read-only SQL session and the
Dashboard to confirm:

1. `npx supabase migration list --linked` shows both versions applied, with no
   unexpected migration. Confirm the linked project ref again.
2. All six public tables exist, with intended columns, foreign keys,
   constraints, indexes, and `relrowsecurity = true`; `app_private` exists and
   is absent from the Data API exposed-schema list.
3. Each table has only its intended SELECT RLS policy; `anon` has no table
   access, `authenticated` has SELECT only, and neither has mutation access to
   roles, assignments, profiles, or audit logs. Verify private helper EXECUTE
   grants and that the functions are owned by an appropriately privileged
   migration role.
4. Catalog counts are exactly four roles, 18 permissions, and 31 mappings.
   Compare every role mapping to the reviewed seed file. Profiles, assignments,
   and audit logs remain empty immediately after deployment.
5. Confirm hosted `auth.users` has not been populated by the migrations. Test
   actual permissions only later with approved, verified founder accounts or
   a separately authorized controlled test; do not run the pgTAP fixture on
   hosted Auth because it writes synthetic rows.
6. Confirm Auth signup remains disabled, email/password and confirmation remain
   enabled, anonymous access remains disabled, and only trusted callback URLs
   are allowed. Record the verified password policy and invitation/recovery
   delivery result without recording credentials or message links.

If any check fails, stop provisioning and preserve evidence. Prefer a reviewed
forward repair; a full restore can discard newer Auth, migration, and audit
data and cannot restore missing non-database Supabase services by itself.

## Observed hosted state

- The CLI link points to the expected project reference.
- `npx supabase migration list --linked` listed both local versions
  (`20261021010000` and `20261021010100`) with empty remote versions.
- `npx supabase db dump --linked --schema public` produced a schema-only
  snapshot with no tables, views, functions, policies, or types in `public`.
  Thus none of the six RBAC tables exists there at the time of inspection.
- A schema-only dump for `app_private` returned "no matching schemas were
  found". A schema-only dump for `auth` confirmed `auth.users` exists. No Auth
  user data was read.
- Stage 2C.3 subsequently verified PostgreSQL 17.11.0.003, Data API schemas
  `public` and `graphql_public`, and the Auth settings listed above. The local
  Auth config remains distinct from hosted settings. Recheck before deployment.
- The snapshots are ignored local files under `.supabase/`; they are inspection
  artifacts, not backup copies of data.

## Hosted Auth checks before provisioning

Use the [project's Dashboard](https://supabase.com/dashboard/project/onfxxtvfprjnqsxdmhkp)
with an authorized administrator. Record the reviewed settings and date without
recording secrets:

1. Open **Authentication > Settings** (or the Dashboard's current **General**
   panel) and **Authentication > Sign In / Providers > Email**. Confirm **Allow
   new users to sign up** is off, anonymous sign-in is off, the Email provider
   remains enabled, and email confirmation is on. Do not rely on the absence
   of a signup UI.
2. In **Authentication > URL Configuration**, confirm the Site URL and each redirect URL are exact,
   owned destinations. Remove broad production wildcards and unrelated preview
   hosts. Add an invitation/recovery callback only when it exists and has been
   reviewed; the current website has no callback route.
3. In **Authentication > Security and Protection > Password Security** (or the
   current password policy panel), confirm an appropriate minimum length and
   character policy; enable leaked-password protection if the project plan
   supports it. Review rate limits and attack protection before exposing a
   sign-in endpoint.
4. In **Authentication > Security and Protection > Multi-Factor Authentication**,
   confirm TOTP MFA can be enabled and plan server-side AAL2 enforcement for
   privileged operations. Merely enabling enrollment does not enforce MFA.
5. In **Authentication > Email > Templates** and **Authentication > Emails > SMTP Settings**,
   verify the sender, invite and recovery templates, approved recipients, and
   delivery using a controlled test. The default SMTP service is restricted
   and is not a production mail-delivery plan. Configure a trusted custom SMTP
   provider before relying on founder invitation and recovery email.
6. In **Project Settings > Data API** (or the Dashboard's current API settings),
   confirm `app_private` is **not** in the exposed schemas. Confirm
   database credentials and any later admin secret stay server-only.

References: [Auth configuration](https://supabase.com/docs/guides/auth/general-configuration),
[redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls),
[password security](https://supabase.com/docs/guides/auth/password-security),
[MFA](https://supabase.com/docs/guides/auth/auth-mfa), and
[SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Proposed deployment sequence — do not execute in this review

1. **Freeze and confirm the target.** From the repository root, inspect
   `supabase/.temp/project-ref` and confirm it equals
   `onfxxtvfprjnqsxdmhkp`. Re-run the read-only commands below and compare
   the schema snapshot with the two migration files. Confirm remote PostgreSQL
   major version is compatible with local `supabase/config.toml` (17). Stop if
   the hosted schema or history has changed or a name conflict appears.

   ```powershell
   Get-Content supabase/.temp/project-ref
   npx supabase migration list --linked
   npx supabase db dump --linked --schema public --file .supabase/predeploy-public-schema.sql
   ```

2. **Secure a recovery point.** In Dashboard **Database > Backups**, verify an
   available backup or PITR restore point immediately before deployment and
   document its time and retention. If the project plan has no managed backup,
   have a database administrator create an encrypted logical backup to a
   restricted location and verify a restore procedure. A schema-only dump is
   not a data backup. Do not place a data dump in the repository.
3. **Revalidate locally.** On disposable local PostgreSQL, run
   `npx supabase db reset --local` and `npx supabase test db` (42 pgTAP
   assertions). Run `npm run test:auth`, `npm run typecheck`, `npm run lint`,
   and `npm run build`. The reset destroys **local** data only.
4. **Review the pending deployment.** Immediately before a separately approved
   hosted change, rerun `npx supabase db push --linked --dry-run`. It should list only
   `20261021010000_internal_rbac.sql` and
   `20261021010100_seed_internal_roles.sql`. The dry run does not prove that
   every statement will succeed; it is not a substitute for the backup and
   schema review. Stop if it lists anything unexpected.
5. **Deploy only after another explicit go-ahead.** Run
   `npx supabase db push --linked --skip-vault` from the reviewed checkout. This command
   changes the hosted database: the first migration creates six tables,
   private helpers, grants, and RLS policies; the second seeds four roles,
   18 permissions, and 31 mappings. `--skip-vault` avoids an unrelated Vault
   configuration update. Never use `db reset --linked` or
   `migration repair` as a shortcut.
6. **Verify hosted state before accounts.** Re-run
   `npx supabase migration list --linked`. Using a read-only SQL session or
   Dashboard SQL editor, check the six tables, `relrowsecurity = true` on
   each, six SELECT-only policies, no `anon` table grants, no authenticated
   write grants, and exact role/permission counts and mappings. Confirm no
   team profiles or assignments were created by the migrations. Verify the
   private schema is not API-exposed. Do not run the pgTAP file against the
   hosted database: its fixtures insert synthetic Auth rows, even though its
   transaction rolls back.

   Run these read-only checks in a trusted SQL session; compare the resulting
   role mappings with `supabase/migrations/20261021010100_seed_internal_roles.sql`:

   ```sql
   select current_setting('server_version_num') as server_version_num;
   select c.relname, c.relrowsecurity
   from pg_catalog.pg_class as c
   join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('team_profiles', 'roles', 'permissions',
       'role_permissions', 'team_role_assignments', 'audit_logs')
   order by c.relname;
   select (select count(*) from public.roles) as roles,
     (select count(*) from public.permissions) as permissions,
     (select count(*) from public.role_permissions) as role_permissions,
     (select count(*) from public.team_profiles) as team_profiles,
     (select count(*) from public.team_role_assignments) as assignments;
   select r.code, pg_catalog.string_agg(p.code, ',' order by p.code) as permissions
   from public.roles as r
   join public.role_permissions as rp on rp.role_id = r.id
   join public.permissions as p on p.id = rp.permission_id
   group by r.code order by r.code;
   select grantee, table_name, privilege_type
   from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('team_profiles', 'roles', 'permissions',
       'role_permissions', 'team_role_assignments', 'audit_logs')
     and grantee in ('anon', 'authenticated')
   order by grantee, table_name, privilege_type;
   ```
7. **Bootstrap the owner in a separate approved step.** Verify Ndong Ghislain
   Che's real email and identity out of band. From the Dashboard or restricted
   Auth admin environment, send an invitation and read the resulting actual
   `auth.users.id`; do not guess an email or ID. A trusted database
   administrator reviews that verified ID and confirmed email, then performs
   one transaction to insert `team_profiles`, assign the seeded
   `platform_owner` role exactly once, and append an audit event. Check the
   resulting permissions. Never promote the first signup automatically.
8. **Provision the other founders separately.** Apply the same verification,
   invitation, profile, single-role assignment, and audit procedure for Kevin
   Omgba (`technical_lead`), Nateu Farhel (`operations_lead`), and Divine
   Nguemo (`content_community_lead`). Reject duplicate or self-directed role
   changes. No public invitation endpoint is part of this plan.
9. **Validate real sessions when an approved auth interface or test harness
   exists.** Test a verified founder's sign-in, sign-out, token refresh,
   inactive-account denial, unassigned-account denial, and each role's
   permitted and denied operations. Verify recovery email delivery, one-time
   code handling, allowed redirects, and session invalidation. This cannot be
   completed with the current UI-free backend and no founder accounts.
10. **Establish recovery operations.** Define who may request a recovery email,
    who can revoke sessions, how identity is reverified, how to replace a lost
    MFA factor, and how actions are audited. Keep the emergency owner bootstrap
    path restricted to database administrators with independent review.

## Rollback and failure handling

Migrations are forward changes; there is no automatic safe down migration.
If the second migration fails after the first succeeds, the schema may exist
without a complete authorization catalog. Keep the application inaccessible,
inspect migration history and catalog state, then repair forward using a
reviewed migration. Do not mark a failed migration as applied without checking
its effects.

If a problem appears after account provisioning, disable access or revoke the
affected sessions first. Choose between a reviewed corrective migration and
restoring the verified predeployment backup. A full restore can lose changes
made after its restore point, including Auth accounts and audit events; verify
scope and coordinate downtime before restoring. Preserve audit evidence and
recheck roles, policies, and invitations afterward. Supabase's
[backup guidance](https://supabase.com/docs/guides/platform/backups) describes
plan-dependent recovery options.

## Current readiness decision

The Stage 2C.4 logical backup was locally restored and remains hash-verified,
but it is not a complete hosted-project recovery point. The 42-assertion local
suite passes and PostgreSQL major versions match. Hosted migration deployment
still requires a **fresh successful schema comparison**, a refreshed and
appropriately protected recovery point, and explicit approval. Founder
provisioning is **not ready**: the hosted Site URL is unsuitable, the password
policy and email delivery need review, and real session validation awaits an
approved interface or controlled test harness. Hosted global signup is now
disabled, as observed in the Stage 2C.5 read-only Auth check.
