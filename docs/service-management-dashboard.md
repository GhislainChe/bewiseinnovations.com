# Stage 4A.3 — local service management and request inbox

Implemented 1 November 2026. Extends the [backend](./services-request-foundation.md)
and [public interface](./services-request-ui.md). All database work and test identities
are local only. Existing Auth/MFA flows and deployed migrations remain unchanged.

## Review routes and local startup

With Docker and the existing local Supabase stack running:

```powershell
npx supabase migration up --local
npm run services:init:local
npm run dev:business
```

Open `http://localhost:3022/services` and `/request-a-quote` for public review;
`/internal/services` for catalog management and `/internal/requests` for the private
operational inbox. Staff use the existing `/auth/sign-in`, `/auth/mfa` and
`/auth/sign-out` flows at the same origin. An authenticated, active, assigned AAL2
identity is mandatory. No founder or permanent demo staff identity is provisioned.
Anonymous/AAL1/unauthorized visitors see a denial page without private records.
Automated tests create and remove synthetic local staff only; this does not supply
a permanent staff login for manual review. Provisioning a real founder remains separate.

The local launcher reads only the ignored local integration environment, sets the
trusted origin to `http://localhost:3022`, keeps recovery disabled, and suppresses
raw request output. Existing private environment files are not overwritten. Do not
run the hosted-auth launcher for this business workspace. Business runtime guards
refuse hosted API URLs and managed deployments.

## Approved catalog initialization

`scripts/approved-services.mjs` contains the seven user-approved titles, exact
descriptions and range boundaries. `scripts/init-local-services.mjs` uses the fixed
local Docker PostgreSQL socket; it accepts no remote database connection or key.
It creates published, intake-enabled services with six options each (four bounded
ranges, one open-ended range and “Not sure yet”). Currency is **XAF**, displayed as
FCFA/XAF; XAF uses whole units, not a cent-based multiplier.

A single transaction and advisory lock serialize initialization. The service slug
is the unique insertion key. Budgets are inserted **only for services returned by
that insertion**, never for an existing service. A rerun therefore cannot duplicate
options, overwrite staff edits, reactivate paused options/intake or change existing
IDs/client references. It deliberately skips an entire existing slug, even if its
budgets differ or are missing: reconcile that case through authorized management,
not by silently replacing it. Concurrent initializers have a single winner.
No DELETE, reset, user creation, hosted access or external messages are involved.

Initial local result: **7 services and 42 budget options** inserted. A subsequent
run added **0/0**. Transactional regression tests temporarily edit a description,
budget label and intake state, rerun initialization and verify preservation, then
roll back all test edits. Initialization itself is local setup, not a staff action
attributed to a fabricated founder. Subsequent staff changes are audited by the RPCs.

Budgets describe the client's estimate, never fixed charges or minimum service fees.
They appear inside the quote form, not on service cards. Intake pausing leaves the
published description visible while removing it from new-request selection. Request
service/budget snapshots retain the submission-time description even after edits.

## Staff functions and permission boundaries

- Catalog: view status/intake and all budgets; edit title/description and permitted
  publication state; pause/resume intake. Existing `content.update` is required;
  editing published services or changing status also requires `content.publish`.
  Owner and Content can edit existing published content; Operations has read-only
  service content, with budget editing separately enabled.
- Budgets: edit label, XAF amounts, order and availability; add an option. Requires
  `services.budgets.manage` (Owner/Operations). The last active uncertainty option
  cannot be disabled or converted into a numeric range. Historical options are
  deactivated instead of deleted. Staff must maintain labels consistently with
  amounts; no automatic pricing decision is made.
- Requests: Owner/Operations use `inquiries.read` to list the latest 100 requests,
  search a **complete exact reference**, open contact/requirements/deadline and
  immutable service/budget snapshots, and inspect attachment scan metadata.
  Content and Technical have no business inbox access.
- Status: `inquiries.manage` permits only the existing received → triaging →
  discussing lifecycle and its supported declined/cancelled/closed branches.
  No quotation, approval, pricing, PDF or outbound message workflow was added.
- Files: clean metadata alone enables a download button, but the server rechecks
  current access/scan state and audits the authorization; Storage independently
  enforces its policy. The short-lived local signed URL is fetched without cookies
  or referrer and is not placed into navigation or persistent storage. Quarantined
  files have no download action. Public uploads and scanning remain unimplemented.

`/internal/business-api` is a fixed caller-SSR adapter, not a privileged generic
database API. Every repository operation checks verified identity, live TOTP/AAL2,
active profile and exact permission. PostgreSQL independently enforces permissions
and assurance. No role string, display title or service-role session from the browser
is trusted. Mutation JSON is streamed with a 16 KiB bound and must pass the existing
strict configured Origin/Host/forwarded-consistency guard. All private responses
are no-store/no-referrer/noindex; the existing `/internal` proxy refreshes sessions.

Service, budget and request updates pass exact optimistic versions. Concurrent
changes return a safe 409 and require a reload. Buttons have an immediate in-memory
submission lock and no automatic mutation retries. On uncertain network outcomes,
reload and inspect the record before retrying; do not interpret a timeout as rollback.
Mutation and audit insert remain atomic in the database.
The staff pages explicitly use dynamic rendering, so a build-time denied state
cannot become a cached answer for a later authorized caller.

## Local migration and file inventory

New local migration `20261101010000_service_management.sql` adds:

- `public.find_project_request(text)` — exact, indexed reference lookup.
- `public.list_request_attachments(uuid)` — authorized safe metadata, without keys
  or checksum/credential fields.
- A private trigger protecting the last active uncertainty choice.

Both read RPCs use qualified objects, empty search paths, independent permission/
MFA checks and authenticated-only EXECUTE grants. Anonymous and service-role callers
receive no execution grant. No schema exposure, table grants, permission definitions
or mappings were broadened. Local catalog remains **4 roles / 19 permissions /
33 mappings** from Stage 4A.1; hosted catalog was not inspected or modified here.
The follow-up `20261101010100_business_conflict_responses.sql` corrects the three
business mutation RPCs' optimistic-conflict SQLSTATE from `40001` to `PT409`.
Real REST/browser testing exposed that PostgREST 14 retries the former as a transient
serialization failure until timeout, instead of returning the intended stale-edit
response. This behavior is documented by [Supabase](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions).
The follow-up preserves signatures, authorization, locks, version predicates and
transactional auditing. Earlier migration files are not rewritten. Both new local
migrations were applied via `supabase migration up --local`. There are seven local
migrations; only the original four are deployed hosted.

Created: the two migrations; `scripts/approved-services.mjs`, `init-local-services.mjs`,
`test-local-catalog.mjs`, `test-local-staff-browser.mjs`; `staff-http.ts`,
`staff-page.tsx`, `staff-workspace.tsx`, `staff-model.ts`, `staff.module.css`,
`staff.test.ts` in `src/features/services`; the two `/internal` pages and private
route adapter; `supabase/tests/service_management.test.sql`; this report.

Modified: services `server.ts` (reference/metadata interfaces, safe conflict error),
`package.json`, README, the local real integration/fresh replay runners and the
existing business pgTAP fixture assertions (scoped to their own synthetic IDs so
the approved catalog does not invalidate a test). Existing pending work from
Stages 4A.0–4A.2 is preserved.

## Verification and limitations

Commands: `npm run test:services`, `npm run test:services:catalog`,
`npm run test:services:local`, `npm run test:services:staff:browser`,
`npx supabase test db --local`, `npm run test:db:fresh`, `npm run test:auth`,
`npm run typecheck`, `npm run lint`, `npm run build`.

Completed results:

- **32/32 service/model/mocked HTTP tests**, including nine new staff adapter/form
  tests for Origin, private response headers, denied reads, fixed commands, byte
  bounds, version conflicts, metadata-only GET and supported transitions.
- **154/154 PostgreSQL pgTAP assertions**, including 14 new metadata/search/uncertainty
  protection assertions. These use synthetic SQL claims and rollback fixtures.
- **52 real local Auth/REST/Storage/HTTP-handler checks**, including exact-reference
  search, metadata privacy and cross-role denial, clean/quarantined Storage, stale
  service/budget/request rejection, and one winner for concurrent request updates.
- **25 real Edge/Next/Auth/MFA staff browser checks**: anonymous/AAL1/Technical denial;
  AAL2 Operations inbox/search/detail/status/budget editing; Content service edit/
  pause and inbox/budget denial; audited updates, safe HTTP 409, approved public
  range selection, mobile width and labelled controls. Genuine caller SSR cookies
  originate from synthetic local Auth password/TOTP sessions; the runner seeds
  those cookies into its isolated headless browser. It does not claim that a human
  enrolled a physical authenticator or that sign-in UI was newly tested here.
- **24 existing public browser checks passed**, including duplicate submission,
  lost-response retry, catalog failure, service-specific selection and keyboard/mobile.
- **78/78 existing authentication tests passed**; existing authentication code unchanged.
- Real request-ingress concurrency passed: 12 identical calls produce one receipt;
  email quota remains 3 and global quota 30 under parallel load.
- Initializer rollback/rerun and concurrent initializer tests passed. All browser/
  integration fixture identities, profiles, requests and audits are removed by exact
  IDs; the approved catalog and unrelated shared development quotas are preserved.

Run database suites sequentially with browser/integration fixture runners: older
RBAC suites assume no concurrent staff fixtures. One overlapping run correctly
observed extra synthetic staff/request rows; a clean sequential rerun passed all
154 assertions. Cold development compilation also caused bounded browser startup
timeouts; no failed attempt is counted as a successful test. The 40001 retry issue
was resolved through the follow-up migration, not by ignoring a timeout.

Final TypeScript, ESLint and production build checks passed. A fresh network-isolated
PostgreSQL 17 replay applied all seven local migrations in order and passed 154/154
pgTAP assertions, 30/30 owner-bootstrap checks and existing ticket/Auth-quota
concurrency tests. The disposable replay container was removed. No hosted database
was used or changed; no founder account or real message was created/sent.
Final local inventory: 7 services, 42 budget options, 4 roles, 19 permissions and
33 mappings; zero Auth users, staff profiles, assignments, client requests or
attachment records after synthetic fixture cleanup. The preview process on 3022
was stopped for the build; use `npm run dev:business` to reopen it. Private environment
files remain ignored and unchanged. A scan of the production browser JavaScript
found no configured privileged secrets or server-secret variable names. Documentation
and whitespace checks passed.

Screenshots were inspected at desktop 1280px and mobile 375px; generated review
images are private/ignored under `.supabase/browser-tests/`. They contain only
approved catalog content and synthetic local test contacts, no credentials. Mocked
tests, real local signed sessions and database claims are distinguished above.

The inbox is a bounded latest-100 view with exact-reference lookup, not pagination,
fuzzy full-text search, analytics or export. Service creation/deletion, quotations,
PDFs, email/WhatsApp, attachment upload/scanner, task boards and unrelated modules
are outside scope. The draft local privacy/retention acknowledgement from Stage 4A.2
still needs legal/business approval before collecting real client data. Accessibility
checks are basic keyboard/labels/responsiveness checks, not a full assistive-technology
audit. Public hosting and founder onboarding remain separately approved work.

Recommended next stage: review this local workflow, approve privacy/retention and
verified client-contact requirements, then implement the internal Project Request
PDF and reviewed quotation preparation under a separate scope. Do not infer approval
for outbound delivery, attachment uploads or hosted migration deployment.
