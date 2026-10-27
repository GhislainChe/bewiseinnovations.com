# Stage 2E.5A — hosted Supabase connectivity diagnosis

Observed **26 October 2026, 08:07–08:14 UTC** (09:07–09:14 Africa/Douala).
Project: `onfxxtvfprjnqsxdmhkp`.

**Current result:** authenticated CLI access and read-only PostgreSQL inspection
work again. The migration preview lists only the pending MFA migration. No backup
was created in this diagnostic stage, and no hosted application records, schemas,
policies, Auth settings, credentials, roles, accounts or recovery settings changed.

## Official service status and uncertainty

Checked the official [status page](https://status.supabase.com/),
[summary feed](https://status.supabase.com/api/v2/summary.json),
[component feed](https://status.supabase.com/api/v2/components.json), and
[Management API incident](https://status.supabase.com/incidents/01M5J8ZQ04EZXAYF10Q75MGC1T).

- An incident named **Elevated Mgmt API Error Rates in Multiple Regions** remains
  in **monitoring**. The feed records creation at **2026-10-22 17:01:52 UTC** and
  its latest update at **2026-10-23 10:54:49 UTC**, describing further mitigations.
- The same summary reports **All Systems Operational**. An incident left open
  for monitoring does not by itself prove an outage at the time of our requests.
- The full component feed returns 189 entries; all 11 entries named `eu-west-1`
  are marked operational. Their last-change timestamps are 7 October. The public
  page groups regional components under services including Management API,
  Postgres and Connection Pooler, but the flat JSON feed omits parent/service
  identifiers. Do not infer an individual project's health from that summary.
- No current eu-west-1 database/pooler outage was established. The open Management
  API incident is relevant context, **not proof** of the Stage 2E.5 timeout cause.
  The official feeds and direct observations must be considered separately.

UTC incident times above come from the JSON feeds; rendered incident-page times
may use a different timezone. Service state can change after this observation.

## Bounded diagnostics

Added `scripts/diagnose-hosted-connectivity.mjs`. It uses fixed, validated project
endpoints and the existing publishable key only for project HTTP probes. It never
uses that key as a Bearer JWT. No privileged credential, connection URL, response
body, cookie or token is printed. CLI project-list output is parsed in memory and
reduced to authentication/target-presence booleans.

| Probe | Result |
| --- | --- |
| Local link and cached session-pooler identity | Exact expected project; port 5432; cached URL contains no password |
| Direct DNS A/AAAA using Node's resolver | `ECONNREFUSED` for Management API, project, pooler and direct DB names |
| Windows/system lookup | Management API/project/pooler resolve successfully to IPv4; no IPv6 result returned |
| Direct DB hostname through system lookup | `ENOTFOUND`; no direct IPv4/IPv6 database connection established |
| API/project TCP 443 and strict TLS | IPv4 connections succeed; TLS 1.3, certificate verified |
| Unauthenticated Management API GET | HTTP 401 in approximately 0.5–0.8 seconds, expected without a token; proves HTTP reachability only |
| CLI authenticated project list | Succeeds in approximately 2.4 seconds; intended project visible |
| Hosted Auth health with publishable key | HTTP 200 in approximately 0.7–1.6 seconds |
| Hosted REST root | HTTP 401; root alone is not a sufficient health/authentication classifier |
| Hosted REST `roles` query with zero-row limit | HTTP 401 / PostgreSQL `42501`: expected anonymous authorization denial; REST reaches PostgreSQL |
| Session pooler TCP 5432 | IPv4 TCP connection succeeds and PostgreSQL accepts SSL negotiation |
| Strict Node pooler TLS verification | `SELF_SIGNED_CERT_IN_CHAIN`; no certificate-validation bypass attempted |
| Installed CLI linked connection metadata, dry run | Completes in 10.964 seconds; target suffix, session port and database match |
| PostgreSQL through the previously validated session pooler | Complete read-only catalog inspection succeeds, PostgreSQL 17.11 |
| Migration preview | Completes in 12.053 seconds, exit 0, only the reviewed MFA file pending |

Direct DNS-query refusal is different from a system resolver failure: the actual
HTTPS/CLI paths work through the system resolver. The direct-query path may be
restricted by this environment/network, but its exact policy was not established.
It must not be reported as a total DNS outage or used to justify changing DNS.

The TLS probe uses Node's default trust store and rejects the pooler chain. That
does not mean TCP/SSL is down, nor establish a new server-certificate problem.
The existing PostgreSQL inspection uses its previously reviewed `sslmode=require`
configuration, enforcing encrypted transport. This is not equivalent to hostname
and CA verification. Supabase documents supplying its CA certificate for
`verify-full`; obtaining/configuring it is separate hardening work, not a change
made in this stage. No SSL enforcement, trust store or credential was changed.
See [SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement)
and [PostgreSQL connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres).

Timeouts: direct DNS 3-second resolver timeout/one try with a 4-second cap;
system lookup 4 seconds; TCP/TLS 6 seconds; HTTPS 10 seconds; CLI authentication
20 seconds; connection-metadata comparison 30 seconds. The existing catalog
inspector bounds metadata/connection/statement/client work; the final preview
has a 60-second process-tree bound. No unlimited retries or large schema dump
was used. No database password was requested or reset.

## What can be concluded

The previous **45-second CLI metadata** and **8-second HTTP** timeouts are no
longer reproducible. Current HTTP calls respond in under two seconds; metadata
and preview finish in approximately 11–12 seconds without raising their limits.
Successful authenticated CLI/project access argues against a presently invalid
CLI token; successful PostgreSQL inspection argues against a presently invalid
database login or unavailable session pooler.

The historical attempt did not retain enough detailed network-stage evidence
to distinguish a transient local network issue from Management API/backplane
degradation. A present-day certificate trust error in a different client and a
refused direct-DNS probe cannot retroactively establish that cause. There is no
basis to claim credentials were bad, the database was down, or longer dump
timeouts alone solved the failure. Slow historical `pg_dump` exports are a
separate documented issue; no export ran here.

## Recovered hosted inspection

`node scripts/inspect-hosted-mfa-preflight.mjs` completed through the validated
session pooler with TLS required and an explicit `BEGIN READ ONLY`; PostgreSQL
reported `transaction_read_only = on`.

- Exact linked project, database `postgres`, PostgreSQL 17.11.
- Applied versions: `20261021010000`, `20261021010100`, `20261023010000`.
- Six public RBAC tables plus two private Auth-security tables, all with RLS.
- Six existing permissive RBAC policies and reviewed helper/RPC grants remain.
- Four roles, 18 permissions, 31 exact role-permission mappings.
- Zero Auth users, team profiles and assignments.
- Required Auth session/factor columns exist; no proposed MFA helper/policy
  name conflicts were found. No unexpected application schema drift was observed
  relative to the Stage 2E.4 inspection.

At **2026-10-26 08:13:12.672 UTC**, the command

```powershell
npx supabase db push --linked --dry-run
```

exited 0 and listed exactly:

```text
20261026010000_require_staff_mfa.sql
```

No real push, migration repair, reset, backup, account creation, email or founder
assignment occurred. Production password recovery remains unchanged/disabled.

## Safe next step

Connectivity is currently sufficient to **resume Stage 2E.5 backup verification**.
Do not regard this as a completed backup checkpoint or permission to deploy.
In that separate resumed stage:

1. Repeat the bounded target/history check immediately before export; stop on
   connection failure, unexpected migration or schema drift.
2. Run `node scripts/create-hosted-logical-backup.mjs` to create a **new** private
   timestamped recovery set. Preserve all existing/partial backups.
3. Verify hashes and run isolated restoration with the explicit current history:

   ```powershell
   node scripts/verify-logical-backup.mjs '<new-private-backup-directory>' --expected-migrations=20261021010000,20261021010100,20261023010000
   ```

4. Verify restored policies/grants/catalog, repeat read-only source inspection
   and the single-migration preview. A failure stops the checkpoint.
5. Only after fresh backup/restore success may actual MFA deployment be submitted
   for separate explicit approval. No backup or hosted write is authorized by
   this diagnostic stage's successful connectivity result.

No application or credential configuration changed. Files added in Stage 2E.5A:
the bounded diagnostic script and this report; the historical checkpoint report
links here. Script syntax checking and ESLint passed. No unrelated application
tests or production builds were necessary for these diagnostic/documentation
changes.
