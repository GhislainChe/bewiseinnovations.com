# Stage 4A.2 — public Services and Project Request interface

Implemented locally, 1 November 2026. This extends the tested
[backend foundation](./services-request-foundation.md), without hosted access,
deployment, founder provisioning, real messages, schema changes or new permissions.

## Routes and components

- `/services`: responsive published catalog fetched from `GET /api/services`,
  with backend titles/descriptions, decorative blue vector artwork, intake-paused
  states and service-specific Request a Quote links. No starting prices or fake
  catalog examples are displayed. Approved service photos are not available in
  the current backend schema; the abstract artwork makes no claim about a service.
- `/request-a-quote`: public anonymous form. Optional `?service=<public UUID>`
  selects an eligible service; unknown/paused IDs are not trusted or echoed as copy.
- `PublicServices`, `ServicesContent`, `ProjectRequestForm`: scoped components in
  `src/features/services/public-services.tsx`; CSS module styling leaves Auth pages
  and the existing homepage unchanged.
- `public-model.ts`: public catalog shape validation, budget formatting, field-level
  validation and the in-memory submission/idempotency controller. No server secrets
  or privileged clients are imported by this client module.

Catalog and form have explicit loading, empty and failure states. Catalog requests
have a 12-second timeout and user-initiated reload button, without automatic retry.
Only current backend services and active service-specific budget options are used.
The form lists intake-enabled services; published paused services remain visible
in the catalog but do not offer a quote link. A service with no budget options
can accept a null budget, matching the backend contract.

## Actual form behavior

Required: full name, email, international WhatsApp number, available service,
20–10,000-character project description and acknowledgement of using the details
to review/respond. A budget is required only when the service has active options.
The consent identifier is `services-request-local-v1`, a local development wording
version, not an approved legal/privacy notice for launch.

Budget options use database labels and actual min/max integer minor units with
their configured currency. Intl currency precision handles different minor-unit
exponents; uncertainty choices show only their configured label. Values are estimates
provided for the visitor's plans, not published starting prices or instant quotes.
No currency/range was seeded or chosen as company pricing in this stage.

Deadline defaults to **Not sure yet**, submitted as null. Choosing a date requires
a real non-past date within the backend's ten-year bound. Changing services clears
the prior budget. Client checks also enforce the server's 16 KiB JSON byte bound,
including multibyte text. The backend remains authoritative for every value,
service state, option relationship, quota and write.

On valid submit, the browser generates a UUID Idempotency-Key and posts JSON to
the existing `/api/project-requests`. No visitor cookies/credentials are sent.
The control disables while sending, ignores repeated submissions and never retries
automatically. A successful reference is checked for the expected format, shown
in a focused receipt panel and distinguished from quotation/delivery acceptance.
No email/WhatsApp delivery is claimed or performed.

After a failure or lost response, inputs stay locked. The explicit **Retry the
same request** action retains exactly the original body/key. It cannot generate a
new duplicate request or silently send edited details. The server returns the same
receipt if the first write actually committed. No personal details/idempotency
material are put in localStorage or sessionStorage. Leaving/reloading the page
loses the in-memory retry information; the UI warns against submitting a fresh
copy after uncertainty. Cross-tab/reload duplicate prevention is not guaranteed.
If an option closed or a quota is exhausted, the user must wait/contact the team;
the UI does not bypass the backend to force submission.

Public uploads remain disabled: no file input, upload endpoint or attachment object
is introduced. The honeypot remains out of keyboard/screen-reader navigation.

## Accessibility and privacy

Mobile-first layout, desktop service grid, visible focus, skip link/main landmark,
labelled controls, required indicators, error summary links, aria-invalid/describedby,
status announcements, keyboard navigation, adequate control borders and responsive
reference wrapping are implemented. Request submission waits for hydration; the
form also declares a POST action so a fallback cannot put contact details in a GET
query. No analytics, remote assets, new fonts or public token storage were added.

Client text is rendered as escaped React content. Public service IDs in CTA queries
are not private request lookup credentials. Sensitive details are never placed in
success URLs or logs. Origin/CSRF, server validation, durable quotas, RLS and MFA
checks from Stage 4A.1 are unchanged. Local pages are marked noindex during this
pre-launch stage. Full accessibility certification/manual assistive-technology
testing is still outstanding; automated basics are not a WCAG conformance claim.

## Local preview and verification infrastructure

Run `npm run dev:business`, then open:

- `http://localhost:3022/services`
- `http://localhost:3022/request-a-quote`

The new launcher reads only the existing private `.env.integration.local`, verifies
the exact local API `http://127.0.0.1:65421`, privately supplies local server keys
and explicitly overrides hosted dotenv values. None of the existing env files is
modified. Recovery/preflight/cookie diagnostics remain off. The local business HMAC
key is domain-separated from the existing local signing secret and stable across
restarts; deployment would require the separately approved production configuration.
Never copy this local launcher or its local credentials to hosting.

Port 3022 is deliberately explicit; check it is free before launching. Existing
port-3000 processes must not be replaced. The launcher uses supported webpack
development mode and suppresses raw child/request output. Next-generated private
development logs still exist under ignored `.next/`; do not share them unreviewed.
The owned preview is stopped after validation; restart with the command above.

Browser diagnostics initially saw repeated mounts/recompilations in Turbopack,
not a passed UI test. Switching to webpack exposed a concrete pre-existing Node
runtime bundling problem: the disabled Node-only Auth preflight import was being
compiled for another runtime and reached `node:crypto`. `src/instrumentation.ts`
now places that import inside the explicit `NEXT_RUNTIME === 'nodejs'` branch
recommended by the installed Next guide. All original execution gates remain;
no Auth/session/MFA behavior or preflight eligibility was changed. Webpack browser
testing passes; the exact cause of the earlier Turbopack remount pattern is not
independently established. Do not claim a browser refresh loop was a CSRF failure.

The browser test uses an isolated headless Edge profile outside the repository,
real Next routes, real local API and real PostgreSQL. Synthetic services/budgets
are labelled LOCAL TEST; they carry no illustrative prices. Temporary service,
budget and request rows are removed by exact IDs. Only the test's email quota keys
are removed; shared development global quotas are preserved. Expired hourly windows
stop enforcing old counts normally; tests do not reset shared counters to bypass limits.
Screenshots are private under `.supabase/browser-tests/` and are fixture evidence,
not approved company content. No hosted Auth account or real email is used.

## Validation and remaining work

Focused commands:

```powershell
npm run dev:business
# In a second terminal, while the local preview runs:
npm run test:services:browser
npm run test:services
npx supabase test db --local
npm run test:auth
npm run typecheck
npm run lint
# Stop the owned dev preview before building into the shared .next directory:
npm run build
```

The tests cover backend catalog rendering/draft exclusion/paused intake, service-
specific budgets/reset, invalid forms without a POST, labelled fields, keyboard
and viewport overflow checks, valid anonymous submission, one POST for a double
submit, lost-response retry producing one database record, no app storage and
catalog failure feedback. The unit sender uses a mocked network for uncertainty;
the separate browser test really commits through the local API before deliberately
dropping its first response. Native minor-unit formatting is unit tested with
synthetic currencies/values, never published as approved ranges.

The backend pgTAP quota assertions were scoped to their exact fixture hash so
legitimate shared development counters do not cause false failures. No migration
or security policy changed. Earlier uncommitted Stage 4A.0/4A.1 work is preserved.

Final results:

- **23/23** service/public-model validation and submission-controller unit/handler
  checks passed (14 existing backend tests plus nine UI-model tests).
- **24/24** real headless Edge/Next/local-DB UI checks passed. Desktop catalog and
  375-pixel mobile form screenshots were inspected; no horizontal overflow was
  observed at the tested widths. These are accessibility basics, not an automated
  accessibility audit or exhaustive browser/device certification.
- **140/140** local pgTAP assertions and **78/78** existing Auth unit/rendering
  regressions passed.
- TypeScript, ESLint, production Turbopack build, documentation links and whitespace
  checks passed. Privileged credential identifiers were absent from browser assets.
- Final local checks found zero synthetic services/requests and zero Auth users or
  team profiles. Shared hourly development quota counters were retained. The owned
  preview was stopped before building; local Supabase remains available.

Created files: `src/app/services/page.tsx`, `src/app/request-a-quote/page.tsx`,
`src/features/services/public-services.tsx`, `public-services.module.css`,
`public-model.ts`, `public-model.test.ts`, `scripts/dev-local-business.mjs`,
`scripts/test-local-services-browser.mjs` and this report. Updated `package.json`
test/preview commands, the README pointer, the narrow instrumentation runtime guard
and fixture-scoped assertions in `supabase/tests/services_requests.test.sql`.
No existing private environment file, Auth/MFA flow library, policy or migration
was modified during Stage 4A.2.

Normal review may show an empty catalog: **no approved company services or budgets
have been supplied/seeded**. The empty state is deliberate, not a hardcoded demo
substitution. Populate approved local records through the existing authorized
backend under a later reviewed content/setup scope. Consent/retention copy and
currency policy still need approval before real public collection. Remote HTTPS,
real-device testing, deployment, founder onboarding, uploads/scanning, quotations
and PDFs remain outside this stage.

Recommended next stage: approve service/budget content and privacy wording, then
build a narrowly scoped local staff catalog/request-management interface or finish
the attachment pipeline under a separate explicit scope. Do not start another
business module or deploy automatically.
