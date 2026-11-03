# Products & Innovation — Stage 4C.1

Local implementation only. Hosted Supabase, Auth settings, DNS and deployment
remain untouched. No founder identity is created and no messages are sent.

## Catalog and routes

`/products` lists only explicitly published, public products whose publication
date is not in the future. `/products/[slug]` applies the same eligibility rules;
missing/private/draft products render Next.js's not-found page. Streaming can
return HTTP 200 with the not-found boundary/noindex; the JSON catalog endpoint
returns 404 for an ineligible slug and never includes draft fields.

Development (`concept`, `in_development`, `coming_soon`, `launched`) is independent
of publication (`draft`, `published`) and visibility (`private`, `public`).
Publishing neither launches a product nor enables its waitlist. Public pages
show plain escaped text, features, approved media and an optional official HTTPS
link. No invented release dates, download links, testimonials or product images.

`/internal/products` uses existing staff sessions and AAL2. Its navigation links
are integrated with Services, Requests, Projects and Company Overview. Commands
use the caller's genuine SSR client, server authorization and permission-checked
database functions; no service-role identity substitutes for staff access.
Every update carries a version and stale writes fail with a conflict. There are
no automatic mutation retries. Reload to reconcile uncertain results.

`/products/withdraw` is a deliberate confirmation page, never a GET mutation.
All public form submissions require the configured trusted Origin, matching Host
and consistent forwarded headers; this follows the existing CSRF guard.

## Local migration and initialization

New migration: `20261102020000_products_waitlists.sql`. Earlier migrations are
unchanged. It introduces four tables in the existing unexposed `business_private`
schema: `products`, `product_assets`, `product_waitlist_entries` and
`product_waitlist_buckets`. RLS is enabled on all four. API roles have no direct
table access. Restrictive MFA policies additionally protect the three staff-data
tables; narrowly scoped SECURITY DEFINER functions use an empty search_path and
qualified objects. Anonymous users can execute only safe public catalog reads;
the two submission/withdrawal RPCs require the fixed server-only ingress client.

Use the existing local Docker/Supabase environment, then:

```powershell
npx supabase migration up --local
npm run products:init:local
npm run dev:business
```

The initializer accepts only the fixed local database helper, inserts missing
Meet My Crew once and preserves existing IDs, future edits, publication settings
and client references. It starts **draft/private, In Development, waitlist off**.
The approved product description, intended users and five concepts come from
the supplied specification. It does not seed BE WISE Merch. Therefore the initial
public catalog is intentionally empty until authorized staff explicitly publish.
No persistent demonstration staff accounts or credentials are initialized.

## Least-privilege permissions

Two new permission codes: `products.manage` (Owner) and
`products.technical.manage` (Owner and Technology). Current local catalog totals
are four roles, **29 permissions and 55 mappings**. Historical hosted totals are
not altered by this work.

- Owner creates product identities (also requires `content.create`), edits name,
  category and official external link, and retains all explicitly mapped rights.
  Slugs are validated, unique and immutable after creation; `withdraw` is reserved.
- Technology changes development state and private technical review information.
  It cannot publish or see waitlist subscribers/counts.
- Content uses existing `content.read/update` for presentation and
  `content.read/publish` for explicit publication/visibility. It cannot edit
  technical state, intake settings or subscriber data.
- Operations uses existing `waitlists.read/manage` for product-specific intake
  and verified withdrawals, and `waitlists.read` for private subscribers/counts.
  Its product projection omits editorial drafts and private technical review.

SQL rechecks these capabilities, active membership and verified AAL2 even when
the application is skipped. Anonymous, inactive, unassigned and AAL1 identities
remain denied. Profile titles never confer permissions.

## Media and original branding

Existing original BE WISE assets, palette and local Quicksand fonts are reused.
No approved product-specific assets were found, so Meet My Crew has no invented
logo, screenshot or stock illustration. The UI explains unavailable media.

Authorized presentation editors may select only registered approved media IDs,
not arbitrary URLs, uploads or filesystem paths. `product_assets` records the
approved public path, accessible alt text and SHA-256. Paths are restricted to
`/product-media/<safe-name>.(png|jpg|jpeg|webp|avif)`. Maximum 8 supporting media and
20 features. Register real approved assets through a separately reviewed trusted
local operation: copy original bytes to that public directory, verify dimensions,
file type and checksum, then register metadata and approval. No asset-registration
endpoint or public upload facility is provided. Public static media must never
contain confidential draft material; unpublishing a page does not revoke a
previously public static file.

## Account-free waitlists and withdrawal

The public form requires full name, normalized email and explicit product-specific
consent (`product-updates-v1`); international WhatsApp is optional. Consent is
unchecked initially. A honeypot, bounded strict JSON, field validation and durable
database quotas protect submission. Only eligible products with waitlists enabled
accept registrations. No account is created and no email or WhatsApp is sent.
Submitted email ownership is **not independently verified**.

The browser locks concurrent submissions and retains one idempotency key/body in
RAM for an explicit unchanged retry after uncertain results. The server creates
domain-separated HMAC identifiers; the database atomically handles idempotency,
per-product normalized-email deduplication, quotas and auditing. A replay with a
changed body fails. Duplicate joins never replace contact details, consent or a
withdrawal credential. Withdrawn addresses are suppressed from anonymous rejoin;
re-consent is deliberately not implemented.

All successful new/duplicate/withdrawn submissions receive the same generic
feedback and opaque link shape. Only a genuinely new registration's link binds
to that row. An unchanged idempotent retry returns the same link. A fresh-key
duplicate receives an unbound capability, so it cannot take over an existing
registration or reveal membership. The UI explains that existing subscribers
need their original saved link. This avoids disclosing whether someone joined.

The visitor privately saves `/products/withdraw#token=…`; no link is emailed.
Only SHA-256 of a usable capability is stored. The fragment never enters the
application's HTTP request target. A beforeInteractive bootstrap removes it
from the visible address bar and exposes a single-use RAM reader, with pagehide
cleanup. No localStorage/sessionStorage or persistent browser token store is used.
An explicit, Origin-checked POST withdraws; GET and link scanners cannot consume
it. Unknown/already-used capabilities receive identical generic feedback.
Withdrawal clears name, email, phone and usable token hash, while retaining
HMAC suppression, consent/withdrawal timestamps and minimal audit metadata.

Anyone holding a valid capability can withdraw that one registration. Browser
history synchronization, extensions, screenshots and endpoint security remain
operational risks. Never put capabilities into query strings, analytics, logs or
support screenshots. Arbitrary legacy/malformed query URLs may be logged by the
framework before application code runs; URL cleanup cannot eliminate that risk.
The withdrawal page uses no-referrer/noindex/no-store protections; APIs never
redirect to a private link. Existing Auth confirmation behavior is unchanged.

If the saved link is lost, Operations must independently verify a private request
and use the audited staff withdrawal action with a case reference. Knowing an
email alone is not sufficient verification. Do not record correspondence, secrets
or private links in the audit reference. Contact intake/case tooling is outside
this stage; no public email-only reset or recovery endpoint exists.

### Shared abuse store

Hourly quotas: join global 120, per-email across products 3, per-product 60;
withdraw global 120 and per-capability 8. Keys are HMACs, never client-selected
quota identities. Concurrent instances share PostgreSQL budgets and an atomic
transaction lock. Storage/audit failures roll back and fail closed. No IP or
forwarded address is used as a trusted identity. Invalid requests still need
future upstream resource protection; these limits are a local foundation, not
a claim of complete bot resistance.

The ingress is restricted to the existing explicitly local business runtime and
two fixed RPC endpoints, with server-only credentials, no redirects and bounded
timeouts. Its signing key must remain stable: rotating it changes deduplication,
quota and suppression identities and requires a reviewed data migration.

## Auditing, privacy and operational limits

Identity/copy/status/publication/intake changes and successful joins/withdrawals
are transactionally audited. Public join audit metadata includes product and
consent version, never contact data or capabilities. Retries do not create duplicate
join/withdraw events. There is no public subscriber directory or count.
Operations lists the latest 200 registrations; authorized counts include all rows.
Pagination/export, automated retention/erasure, verified opt-in, messaging workers
and self-service re-consent remain future work before a production mailing list.

Tests create only synthetic local identities and products, then delete their exact
records. The approved Meet My Crew draft and existing service/client records are
preserved. Shared development quota counters are not reset for unrelated traffic.

## Validation and review

Commands: `npm run test:products`, `npm run test:products:local`,
`npm run test:db:fresh`, `npm run test:auth`, `npm run typecheck`,
`npm run lint`, `npm run build`. Active local database/Auth/browser suites must
run serially to avoid fixture-count interference. Fresh isolated PG17 tests use
their own disposable database and preserve development data.

Executed on 2 November 2026:

- **11/11** new product unit/HTTP-adapter/fragment tests. These use mocked
  boundaries/VM execution and do not constitute real Auth integration.
- **146/146** combined authentication and business unit/adapter regressions:
  78 Auth, 32 Services, 9 Quotations, 9 Delivery, 7 Projects and 11 Products.
  Original logo checksums and legacy immutable PDF byte checks also passed.
- **344/344** pgTAP assertions on the active local PostgreSQL database, including
  54 new Product assertions. Independently, a fresh isolated PostgreSQL 17 database
  replayed all 11 application migrations and passed the same 344 assertions.
  SQL tests cover consent, private projections, AAL1/inactive/unassigned denial,
  grants/RLS, CAS conflicts, publication, duplicate safety, withdrawal replay,
  audit rollback and failed quota-store behavior.
- **76** real local Auth/TOTP/JWT/RPC/HTTP checks: real password-only AAL1 denial,
  forged JWT rejection, genuine verified AAL2 caller sessions, least-privilege
  roles, every development status, private/draft eligibility, two-instance
  duplicate races, unchanged idempotent retries, changed-payload rejection,
  suppression after withdrawal and exact contact/audit preservation. Per-email
  race accepted 3/8; global/product last-slot races accepted 1/3 each. The latter
  intentionally prefill isolated quota fixtures instead of issuing hundreds of
  unnecessary requests. No production or physical authenticator test is claimed.
- **26** actual headless Chrome browser checks: Owner creation and presentation,
  Technology technical editing, Content publication, Operations intake and private
  subscribers, anonymous staff denial, private Meet My Crew not-found behavior,
  public detail/catalog, original logo, 375-pixel responsive layout/form labels,
  invalid-email validation, real join with repeated-submit suppression (one HTTP
  request), fragment cleanup before confirmation, inert withdrawal GET, deliberate
  POST withdrawal and erased contact details. Observed browser HTTP request URLs
  contained no withdrawal capability. A synthetic mobile screenshot was visually
  inspected and is kept Git-ignored at
  `.supabase/browser-tests/products-public-mobile.png`.
- **30/30** isolated owner-bootstrap assertions and **58/58** active-local
  content-role binding/cleanup assertions passed, including rollback/concurrency.
  Existing atomic ticket/email/global quota concurrency checks passed in isolated
  PG17. Approved Services initializer preservation/concurrency checks passed.
- **TypeScript, ESLint and production build passed**. All 28 generated production
  browser artifacts were scanned in memory against privately configured secret
  values; no matches. Private environments and generated browser evidence remain
  Git-ignored. No credentials were printed or changed.

An initial browser fixture generated an overlong email local part; production
validation correctly rejected it. The fixture now uses a valid synthetic address.
Browser waits account for streamed Next.js not-found rendering; no security or
publication checks were weakened to make the tests pass.

Post-test local state: zero Auth users, staff profiles/assignments, waitlist rows
and synthetic projects. One original client request, seven approved services and
42 budget options remain. The only product is the unchanged private/draft Meet My
Crew, In Development, intake off. Four roles/29 permissions/55 mappings remain.
Test-scoped quota keys are removed when tracked; harmless hashed historical test
quota rows and shared hourly counters are not broadly purged. No hosted operation
was performed. The local-only server was restarted after the build for review.

Review locally at `http://localhost:3022/products`,
`http://localhost:3022/internal/products` and
`http://localhost:3022/products/withdraw`. `/products/meet-my-crew` remains
unavailable publicly while the initialized product is private/draft. Staff review
requires an authorized local active identity and real verified AAL2 session.

Before hosting: separately review/deploy local migrations and permissions, configure
trusted production Origin/HTTPS and private ingress secrets, approve product copy
and real assets, define data retention and independently verified withdrawal
handling, add production anti-abuse protection and verified opt-in before any
mailing. No hosted configuration or transport is enabled here.

Recommended next stage: approve product copy and original product media, review
waitlist consent/retention and operational pagination requirements, and choose
the next approved implementation scope. Public launch and actual subscriber
messaging require separate readiness review. Do not automatically deploy or
begin another module.

## File inventory

New application files: `src/features/products/` contains the models/validation,
caller repository, fixed ingress, HTTP handlers, public pages/form, fragment
bootstrap/withdrawal, staff UI, client helper, styles and focused tests.
Thin App Router files are `src/app/products/{page,loading}.tsx`,
`src/app/products/[slug]/page.tsx`, `src/app/products/withdraw/page.tsx`,
`src/app/internal/products/page.tsx`, `src/app/internal/products-api/route.ts`,
`src/app/api/products/route.ts`, `src/app/api/product-waitlists/route.ts` and
`src/app/api/product-waitlists/withdraw/route.ts`.

New local scripts: `initial-products.mjs`, `init-local-products.mjs`,
`local-browser-session.mjs`, `test-products-browser.mjs` and
`test-local-products-integration.ts`. New SQL files are the migration named above
and `supabase/tests/products.test.sql`.

Updated integration points: `src/app/layout.tsx` (separate withdrawal bootstrap;
existing Auth bootstrap unchanged), `next.config.ts` (withdrawal privacy headers),
public Services navigation, staff Services/Projects navigation, package scripts,
README and this report. Existing local RBAC/Services/Quotation/Delivery/Projects
test expectations, content-role tests, fresh-database runner and reviewed owner
bootstrap prerequisites now include the explicitly added permission catalog.
No historical migration or existing authentication/MFA handler was modified.
