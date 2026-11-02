# Stage 4A.1 — local services and project-request backend

Implemented locally on 31 October 2026 against the
[platform specification](./platform-specification.md). No hosted Supabase request,
migration, account operation, email, WhatsApp message or deployment was performed.
No public/dashboard UI, quotation/PDF, product, editorial, program, event or project
milestone feature was implemented. Existing Auth/MFA flow code is unchanged.

## Database and authorization

New migration: `20261031010000_services_project_requests.sql`, applied through
`supabase migration up --local` only. Existing development data was preserved;
no database reset was used. Earlier deployed migration files are untouched.

- `public.services`: plain-text safe catalog fields, draft/published/retired states,
  intake availability, optimistic version and timestamps. No starting-price field.
- `public.service_budget_options`: per-service labels, explicit optional currency,
  safe integer minor-unit min/max, uncertainty choice, active/order/version fields.
  No real budget amounts or currency defaults were seeded. Test USD values are
  synthetic fixtures, not approved company pricing.
- `business_private.project_requests`: non-sequential 128-bit random reference,
  service/budget foreign keys and immutable submission snapshots, name/email/WhatsApp,
  requirements, optional preferred date, consent-policy identifier/time, lifecycle,
  version, private idempotency and payload digests. No visitor Auth account needed.
  This is the specification's logical quote-request entity, named project_requests
  to distinguish intake from later quotation documents and delivery projects.
- `business_private.submission_buckets`: separate durable HMAC-keyed hourly limits.
  Auth tickets and Auth quota tables are neither reused nor altered.
- `business_private.request_attachments`: exact request FK/generated object key,
  private bucket, safe filename, MIME, byte size, checksum, quarantine/scan state.
  No public metadata insert/update path or scanning override was added.

All five new tables have RLS and explicit grants. The business schema is not
exposed through the Data API (real local API check returned 406). Public callers
read only published services/active published budgets. Requests and attachment
metadata require inquiries.read AND live verified AAL2/active staff. Technical and
Content staff cannot read client requests. No ordinary role has direct table
mutation grants; staff RPCs enforce exact permission, transition/version and audit.
Service-role has no direct private-table grants and only the ingress RPC grant
among this module's public functions; its general platform privilege still makes
the credential sensitive. Do not treat it as narrowly privileged outside this code.

Only **services.budgets.manage** is introduced, mapped explicitly to platform_owner
and operations_lead. Local totals are now **4 roles / 19 permissions / 33 mappings**.
All original grants remain. Existing content.create/update/publish manage service
descriptions; publication authority is checked even when editing published content.
Existing inquiries.read/manage govern request reads/triage. No display title or
browser-supplied role is used as authorization.

The tested private-schema decision is narrow public RPC interfaces plus private
RLS tables, not exposing a schema to make SDK CRUD work. Functions are qualified,
use empty search_path, explicitly restrict EXECUTE and independently validate caller
permissions/AAL2 before definer access. Pure RLS tests exercise direct authenticated
SQL in addition to real caller-JWT API tests. No business extension was added to
the fixed Auth-store client.

## Server interfaces

`src/features/services/validation.ts` normalizes and validates service/budget/request
inputs; rejects unknown fields/role/status injection, unsafe integer money, invalid
dates, wrong phone format, oversized text and honeypot input. WhatsApp uses explicit
international `+` format. Preferred deadline can be null; known dates must be today
through ten years ahead. Contact syntax is not proof of verified ownership.

`server.ts` supplies request-scoped caller-SSR repository operations:
published catalog, authorized draft/budget catalog, service/budget save, bounded
request list/detail, status changes and clean-attachment download authorization.
Staff methods use existing server authorization plus independently guarded RPCs.
Mutation and minimal audit insert commit atomically. No administrative staff
HTTP CRUD endpoint was added; future forms/routes must preserve CSRF and no-store.

New backend-only Next.js routes:

- `GET /api/services`: explicit public projection, no draft leakage even when a
  staff session is present; bounded catalog, no-store during this local stage.
- `POST /api/project-requests`: anonymous JSON ingress, strict configured Origin/
  Host/forwarded consistency, UUID Idempotency-Key, 16 KiB streamed body limit,
  honeypot, field validation and server-computed HMACs. Returns HTTP 202 with
  reference only. All validation/quota/store/conflict failures return a generic
  HTTP 400 and no private payload/provider error. No GET-by-reference endpoint.

The separate privileged ingress transport can POST only to the fixed LOCAL
submit_project_request RPC; it cannot follow redirects or choose another origin,
table, path, recipient, role, resource owner or status. There is no visitor-accessible
privileged RPC execution grant. No request-body/cookie/token logging was added.

SQL atomically serializes idempotency lookup, eligible service/budget snapshot and
shared quota consumption. Same key+payload returns the same reference without
another record/quota count; same key+different payload is rejected. Different
keys are subject to **3 accepted requests per email/hour and 30 global/hour**.
HMAC contact identifiers never need to be logged; global cap protects against
rotating email addresses. No untrusted forwarded IP is used as identity.
The global lock is deliberately simple for low-volume intake, not a high-throughput
queue architecture. Production WAF/challenge/network-abuse review remains necessary.

Foundation lifecycle: received → triaging → discussing; supported branches to
declined/cancelled and discussing → closed. Terminal records cannot be silently
reopened. Quoted/approved transitions are deliberately not implemented until
quotation/agreement/verified-contact prerequisites exist. A request does not create
a delivery project or verified client_contact record automatically.

## Attachment access and limits

Created private bucket `project-request-documents`, 10 MiB object limit and allowed
PDF/JPEG/PNG MIME declarations. No anonymous or ordinary staff upload policy exists.
Only an inquiries.read + AAL2 caller may obtain an audited download authorization
for a clean metadata record, and Storage SELECT policy independently enforces the
same boundary. Signed downloads expire after 60 seconds and must remain private/
no-store; they are bearer secrets and may remain usable until their expiry after
permissions change. No signed URL or storage key is logged.

**Public attachments are disabled in this stage.** Unknown attachment fields on
request submission are rejected. MIME declarations are not malware validation.
Future work must implement single-submission upload reservation/finalization,
signature/type/size checks, up-to-three-files enforcement, malware scanner/quarantine,
orphan cleanup and reviewed retention. There is no callable “mark clean” function.
The integration test uses synthetic local metadata to simulate clean/quarantined
states; it does not claim a real malware scan passed. Until that pipeline exists,
do not enable public attachments or manually mark real documents clean.

## Local configuration and test isolation

Runtime operations are off by default. They require:

```dotenv
BUSINESS_BACKEND_ENABLED=local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:65421
SUPABASE_BUSINESS_INGRESS_SECRET_KEY=<local-only Supabase server secret>
BUSINESS_SUBMISSION_SECRET=<independent stable random secret, at least 32 bytes>
```

Use a separate Git-ignored private `.env.business.local` if manual app testing is
approved; privately populate the local publishable key and **all** local Auth-store,
signing and trusted-origin settings too. Never inherit a hosted Auth-store secret
from `.env.local` while pointing the browser at local Supabase. Use only supported
local CLI secret retrieval captured privately, not pasted terminal status or chat.
Do not change `.env.local`, `.env.integration.local` or the hosted-test file.
The existing hosted-test launcher must not launch this business environment.

For a manual dedicated local app process after checking port availability:

```powershell
node --env-file=.env.business.local node_modules/next/dist/bin/next dev --hostname 127.0.0.1
```

Use AUTH_TRUSTED_ORIGIN=http://localhost:3000, local publishable/secret keys,
an independent local AUTH_FLOW_SIGNING_SECRET, recovery disabled and diagnostics
off. Process variables override Next's dotenv values; configure the complete local
environment deliberately. No such private file or secret was created in this stage.
Hosted URLs and managed deployments are refused by the new business runtime guard.

Automated local integration reads the existing `.env.integration.local`, asserts
the exact loopback API target, uses its local-only secret in memory and generates
an independent in-memory test HMAC key. It creates/deletes disposable LOCAL Auth
fixtures, not founders, and removes only its exact synthetic business/storage/audit/
quota fixtures. Concurrency uses fixed local Docker/socket access, never a remote URL.

The running stack initially excluded Storage. A data-preserving local stop/start
added the already-downloaded Storage service; database state was not reset. CLI
startup/status can print credentials by default: future calls must capture and
sanitize that output. Local default credentials are not suitable for deployment.

## Tests and verification

Commands:

```powershell
npm run test:services
npm run test:services:local
npm run test:services:concurrency
npx supabase test db --local
npm run test:db:fresh
npm run test:db:content-role
npm run test:auth
npm run typecheck
npm run lint
npm run build
```

Results at this stage:

- **14/14 unit/HTTP-handler tests**, with mocked ingress for validation, Origin,
  body-size, response privacy, local runtime and store-failure behavior.
- **40 real local integration checks** using actual Auth password/MFA sessions,
  caller-JWT REST, RPCs and Storage: AAL1 denial; Operations request access; Content
  denied; inactive profile denied; private schema inaccessible; quarantined direct
  and authorized downloads denied; clean authorized signed file actually fetched;
  cross-role signing denied; idempotent ingress and HTTP-handler receipt verified.
  Handler Request/Response calls are in-process, not a full Next.js browser test.
- **140/140 local pgTAP assertions**: original 92 retained, plus 48 business assertions
  including direct RLS/grants, role separation, unassigned/inactive/AAL1 denial,
  cross-service budgets, snapshots, state/version checks, durable limits and rollback
  when audit insertion fails. Synthetic SQL claims are not real Auth integration;
  the separate 40-check runner supplies genuine signed sessions.
- **Concurrent real PostgreSQL requests passed**: 12 same-key attempts yield one
  receipt; email total capped at 3 and global total at 30 under concurrent load.
- **78/78 existing auth tests passed**; TypeScript, ESLint and production build passed.
- **58/58 prior local role-binding/cleanup assertions passed** against the extended
  catalog.
- **Fresh isolated PostgreSQL 17 replay passed:** all five migrations in order,
  140/140 pgTAP assertions, 30/30 owner-bootstrap assertions and existing atomic
  ticket/Auth-quota concurrency checks. The disposable container was removed;
  existing development data was preserved.

The fresh-isolated verifier now imports LOCAL Auth **and Storage schema only**, no
data/credentials, before replaying all five app migrations. It recreates matching
Storage owner/grant prerequisites and omits only the app Storage policy from the
baseline dump because the new migration must create it after its private tables.
The first replay exposed that missing verifier prerequisite; no production grant
was broadened to make it pass. Actual local migration/API tests independently
verify real Supabase behavior.

The reviewed owner-bootstrap SQL's exact permission allowlist was extended by this
single new approved permission, with no change to identity/MFA/duplicate/atomicity
logic. It has **not** been executed hosted. This updated local script must fail
closed against the old hosted 18-permission catalog until a separately approved
deployment/review; do not bypass that mismatch. Existing role/catalog test
expectations were updated to explicit 19/33 counts and exact owner/operations sets.
No deployed migration was rewritten and no current role gained team-management
privileges through this extension.

## File inventory

Created:

- `supabase/migrations/20261031010000_services_project_requests.sql`
- `supabase/tests/services_requests.test.sql`
- `src/features/services/validation.ts`, `runtime.ts`, `server.ts`, `submission.ts`
  and `services.test.ts`
- `src/app/api/services/route.ts` and `src/app/api/project-requests/route.ts`
- `scripts/test-local-services-integration.ts`
- `scripts/test-service-request-concurrency.mjs`
- `docs/services-request-foundation.md`

Modified:

- `.env.example` (names/placeholders only), `package.json` (focused test commands),
  `README.md` (current report pointer)
- `supabase/tests/rbac.test.sql` (exact approved catalog expectations)
- `supabase/admin/bootstrap-platform-owner.sql` (exact permission allowlist only;
  no hosted execution)
- `scripts/test-content-role-transactions.mjs` (catalog count assertion)
- `scripts/test-fresh-mfa-database.mjs` (fifth migration, Storage schema prerequisites
  and extended test counts)

No private environment file was changed. New privileged business credential
identifiers were absent from the built browser assets. Documentation links and
`git diff --check` passed. Synthetic fixture cleanup was independently checked:
zero local Auth users/profiles, services, requests, attachment metadata, business
quota fixtures or objects in the new private bucket; catalog remains 4/19/33.

## Remaining work / next stage

Approve real service content, currency/ranges, consent/privacy wording and retention
before real collection. Implement reviewed staff forms/public UI only under a later
scope. Finish attachment scanning/upload before enabling attachments. Future quotation
and PDF/contact-verification workflows, referred technical assessments and client
project conversion remain unimplemented. Shared/public anti-abuse configuration
requires remote-host trust and operational review before deployment; this is not a
claim of internet-production readiness. Outbox/email/WhatsApp remain absent.

The five Stage 4A.0 specification files were already pending and were preserved.
This stage adds the new migration, backend module/routes, focused tests/runners and
this report, and updates only example configuration, package commands, catalog-
dependent local test helpers/bootstrap allowlist and the README pointer. No real
company services or client records were seeded. No founder provisioning occurred.
