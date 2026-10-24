# Stage 2D.7 hosted authentication security preflight

This is a historical preflight. Stage 2D.9B subsequently completed the conflict,
backup, deployment, and verification gates; see
[the hosted deployment result](./hosted-auth-security-deployment-result.md).

**Reviewed:** 24 October 2026 (Africa/Douala)

**Target:** `onfxxtvfprjnqsxdmhkp`

**Status:** read-only preflight; deployment is blocked pending the catalog check
below and a fresh restore-tested backup.

No hosted schema, data, Auth setting, account, email template, or credential was
changed during this review.

## Hosted findings

The linked project file contains the expected project reference. The hosted
migration history contains `20261021010000` and `20261021010100`; local version
`20261023010000` is not recorded remotely. A linked dry run reported exactly:

```text
20261023010000_auth_flow_security.sql
```

The read-only hosted table inspection found the six deployed RBAC tables and
the expected estimated catalog counts: four roles, 18 permissions, 31 role
permission mappings, and zero profiles, assignments, and audit rows. Neither
new Auth security table appeared in that inspection.

A narrowly scoped `public,app_private` schema dump stalled and was terminated
after bounded waits. Its local output file was empty. Consequently, this
preflight did **not** freshly verify all hosted function names, function grants,
policies, or every object in `app_private`. Do not deploy until an authorized
administrator runs the following SELECT-only query in the SQL Editor for the
exact project and confirms:

- `app_private.auth_flow_tickets` and
  `app_private.auth_recovery_buckets` are absent;
- all four listed `public` functions are absent;
- migration `20261023010000` is absent; and
- no unexpected object uses one of those names.

```sql
select current_database() as database_name,
       current_setting('server_version') as postgres_version;

select pg_catalog.to_regclass('app_private.auth_flow_tickets') as ticket_table,
       pg_catalog.to_regclass('app_private.auth_recovery_buckets') as quota_table;

select n.nspname as schema_name,
       p.proname as function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'auth_flow_store_ready',
    'register_auth_flow_ticket',
    'redeem_auth_flow_ticket',
    'consume_recovery_budget'
  )
order by p.proname, arguments;

select version
from supabase_migrations.schema_migrations
where version = '20261023010000';
```

Expected results before deployment are two NULL table values, zero function
rows, and zero migration rows. Any other result is a stopping condition.

## Migration security review

`20261023010000_auth_flow_security.sql` is additive. It contains no DROP,
TRUNCATE, DELETE, UPDATE of existing application data, migration-history repair,
or Auth-user creation. It depends only on the existing `app_private` schema,
standard PostgreSQL functions, `auth.users`, and Supabase roles already used by
the deployed RBAC migration. It requires no new extension.

The migration creates two private tables with RLS enabled and revokes all
direct table privileges from `public`, `anon`, `authenticated`, and
`service_role`. No RLS policies grant row access. Four `SECURITY DEFINER`
functions have an empty `search_path`, schema-qualify every database object,
accept hashes rather than raw tickets or emails, and grant EXECUTE only to
`service_role`. PostgreSQL's default PUBLIC function EXECUTE privilege is
explicitly revoked.

Ticket redemption is one atomic conditional UPDATE. A matching unexpired,
unredeemed digest can transition once, even under concurrent requests. The
recovery limiter takes a transaction-level advisory lock before checking and
incrementing the fixed hourly global and per-email buckets. Local concurrent
tests confirmed one success from 12 ticket redemptions, three accepted requests
from 12 requests for one email bucket, and 30 accepted requests from 33 distinct
email buckets sharing the global bucket.

Operational limitations remain: expired ticket and rate-limit rows need a
future privileged retention/cleanup job, and the global limit of 30 accepted
recovery requests per hour is intentionally conservative and can deny legitimate
requests during abuse. Neither issue weakens privilege boundaries, but both
must be monitored after controlled deployment.

## Server credential readiness

`SUPABASE_AUTH_STORE_SECRET_KEY` is referenced only by a module marked
`server-only`. It is never prefixed with `NEXT_PUBLIC_`, returned in a response,
written to a cookie, or logged. The browser client continues to use only the
publishable key. The server client disables session persistence, refresh, and
URL session detection and calls four fixed RPC names.

For production, configure a hosted Supabase secret/service-role credential in
the deployment platform's encrypted server environment only. Do not place it
in `.env.example`, source control, browser code, build output, client telemetry,
or a public hosting variable. The ignored `.env.integration.local` remains
local-only and uses local CLI credentials; it must never be copied to the
production deployment. Rotate the hosted credential after suspected exposure.

The production application currently remains deliberately closed: recovery
submission rejects `NODE_ENV=production`, and the recovery mail redirect is
fixed to `http://localhost:3000/auth/confirm`. Before production recovery is
enabled, replace that fixed URL with a validated server-only application origin,
keep an explicit enablement gate, and rerun the hosted end-to-end tests. This is
an application-release blocker, not a blocker to installing the private store
objects by themselves.

## Hosted Auth, email, and URL readiness

The supported read-only config comparison reported that hosted signup and
anonymous sign-in are disabled, email/password and email confirmation are
enabled, minimum password length is 12, Site URL is
`http://localhost:3000`, and the additional redirect list is empty. Hosted TOTP
enrollment and verification are enabled. The hosted email OTP length is eight
and email resend frequency is one minute. No hosted password composition rule
was reported, so only the confirmed minimum length can be claimed.

Custom SMTP is enabled with the configured OVHcloud server and sender identity.
The comparison does not verify the SMTP password, sender-domain authentication,
delivery, or template bodies. Invite and recovery template subjects exist, but
their action links still require a manual Dashboard review.

For controlled localhost testing, an authorized administrator must separately
approve and then configure:

1. Keep Site URL at `http://localhost:3000` only while the application is
   intentionally tested locally.
2. Add exactly `http://localhost:3000/auth/confirm` to the redirect allowlist;
   do not add a wildcard.
3. Set the Invite User action link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`.
4. Set the Reset Password action link to
   `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`.
5. Review final rendered links, sender identity, SPF/DKIM/DMARC, SMTP TLS,
   provider quotas, and spam placement before relying on delivery.

Do not change the Site URL to `https://bewiseinnovation.com` until the reviewed
application is deployed and reachable there. The production redirect allowlist
must then contain only the exact deployed confirmation URL.

## Backup and recovery gate

The two existing private logical backups remain present and match their
documented lengths and SHA-256 hashes. Their restore tests succeeded previously,
but they predate this deployment and are not complete Supabase-project backups.
The latest read-only backup check still reports no listed managed backup and
`pitr_enabled: false`; `walg_enabled: true` alone is not a verified restore
point.

Immediately before an approved deployment, create a new timestamped backup in
the ACL-restricted, Git-ignored `.supabase/backups` directory. Include
`public`, `app_private`, `auth`, `storage`, and `supabase_migrations` schema and
data plus a role dump. Verify nonzero sizes and hashes, then restore all three
files into a fresh, isolated PostgreSQL 17/Supabase-compatible environment.
Confirm expected schemas, migration history, table counts, Auth-user count, and
Storage metadata count without touching the tested local development database.
Follow [hosted-database-backup.md](./hosted-database-backup.md). Stop if any dump,
hash, or restore step fails.

## Approval-gated deployment and verification sequence

Every numbered gate must pass before proceeding. A failure stops the sequence;
it does not authorize a retry with broader permissions or a migration repair.

1. **Target and catalog:** confirm `supabase/.temp/project-ref` equals
   `onfxxtvfprjnqsxdmhkp`; rerun migration history; complete the SELECT-only
   catalog query above. Success means no conflicting security object and only
   version `20261023010000` remains pending.
2. **Fresh recovery point:** create the timestamped logical backup described
   above, hash it, and restore-test it in an isolated PostgreSQL 17 environment.
   Success means every file is nonempty and the clean restore validation passes.
3. **Final preview:** run `npx supabase db push --linked --dry-run`. Success
   means it lists only `20261023010000_auth_flow_security.sql`, with no seed,
   role, Vault, or additional migration change.
4. **Database deployment:** only after explicit approval, run
   `npx supabase db push --linked --skip-vault`. Success means the command exits
   cleanly and migration history records exactly `20261023010000` once.
5. **Hosted security verification:** use SELECT-only catalog checks to confirm
   two private RLS-enabled tables, no policies/direct grants on them, exactly
   four intended RPC signatures, EXECUTE only for `service_role`, restricted
   search paths, and `app_private` absent from exposed Data API schemas. Stop
   before credentials or accounts if any privilege differs.
6. **Server environment:** configure `SUPABASE_AUTH_STORE_SECRET_KEY` and
   `AUTH_FLOW_SIGNING_SECRET` as encrypted server-only variables in the future
   deployment environment. Success means build/runtime server checks work and
   no secret appears in browser bundles, logs, or responses.
7. **Email configuration:** after separate approval, configure the exact
   localhost or deployed redirect, reviewed token-hash templates, and SMTP
   settings. Success means a transport-only message reaches a verified test
   mailbox with expected sender authentication; no account is created for this
   transport test.
8. **Controlled Auth flow:** after the application is reachable and recovery
   has a reviewed production gate/origin, perform one approved disposable
   hosted invitation and recovery test. Success means GET does not consume the
   token, POST verifies it, ticket replay fails, password rotation works, and
   the unassigned identity has no staff access. Delete only the authorized test
   identity and record no token or password.
9. **Platform Owner invitation:** separately verify Ndong Ghislain Che and the
   real email out of band, obtain explicit account-creation approval, and send
   one invitation. Success means the email is confirmed, MFA is enrolled, and
   the actual Auth UUID/email pair is independently reviewed. Invitation alone
   grants no staff access.
10. **Owner binding:** after separate approval, run the reviewed atomic profile,
    `platform_owner` assignment, and audit transaction from
    [platform-owner-provisioning.md](./platform-owner-provisioning.md). Success
    means exactly one active profile, one owner assignment, and one bootstrap
    audit event match the verified UUID.
11. **Hosted authorization:** test owner allow/deny cases, unassigned and
    inactive denial, session refresh/sign-out, recovery, MFA/AAL expectations,
    and audit visibility. Stop rollout and revoke affected sessions on any
    privilege or identity mismatch.

Rollback is not an automatic down migration. Before account provisioning,
prefer a reviewed forward fix for a schema defect. A full restore can discard
newer Auth and audit records and does not restore SMTP, Auth settings, Storage
objects, or project secrets; it requires its own explicit approval and outage
plan.

## Validation results

- Mocked Auth tests: 27/27 passed.
- Local PostgreSQL pgTAP: 74/74 passed.
- Multi-session concurrency: passed (1/12 ticket, 3/12 email, 30/33 global).
- TypeScript: passed.
- ESLint: passed.
- Next.js production build: passed.

The migration SQL is locally validated and its dry run is clean. Hosted
deployment is **not yet approved or unblocked** because the fresh object-level
catalog query and fresh restore-tested backup remain required.
